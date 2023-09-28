---
title: 从uvicorn到fastapi处理请求之间发生了什么？
date: 2023-09-27 21:07:20
tags:
    - 源码解读
    - FastAPI
categories:
    - Learning
---

<!-- cspell: ignore uvicorn elif Multiprocess isinstance asgi asyncio Starlette -->
> 十一放假，在家学习

[FastAPI](https://fastapi.tiangolo.com/)是一个基于seattle的异步web框架， 据说其速度和go语言相当。
[uvicorn](https://www.uvicorn.org/)/[Gunicorn](https://gunicorn.org/)是一个基于asyncio的异步服务器，用于启动fastapi，其中Gunicorn多进程启动时有负载均衡的功能。

本次源码阅读主要是为了解决我内心的一些疑惑：

- uvicorn启动之后，如何将端口请求传递给fastapi？
- fastapi拿到请求后如何调用的endpoint函数？
- endpoint处理完成后如何返回请求？
- fastapi的endpoint如果做到同时适配同步函数和异步函数的？

> 源码版本
> fastapi == 0.103.1
> uvicorn == 0.23.2

## 1. 从uvicorn到fastapi

### 1.1 启动`uvicorn.run("server:app")`

```python
# uvicorn/main.py
def run(...):
    config = Config(...)
    server = Server(config=config)
    ...
    if config.should_reload:
        sock = config.bind_socket()
        ChangeReload(config, target=server.run, sockets=[sock]).run()
    elif config.workers > 1:
        sock = config.bind_socket()
        Multiprocess(config, target=server.run, sockets=[sock]).run()
    else:
        server.run()
    ...
```

uvicorn启动后将run的参数全部传给了Config，实例化之后又传递给了server对象。之后主要运行的就是`server.run()`函数。
> 可以看到在启用`reload`或`works`之后会创建一个目标端口的套接字，这个主要是为了在多个进程间共享同一个socket对象。

```python
# uvicorn/server.py
def run(self, sockets: Optional[List[socket.socket]] = None) -> None:
    ...
    return asyncio.run(self.serve(sockets=sockets))

async def serve(self, sockets: Optional[List[socket.socket]] = None) -> None:
    ...
    await self.startup(sockets=sockets)
    if self.should_exit:
        return
    await self.main_loop()
    await self.shutdown(sockets=sockets)
    ...

async def main_loop(self) -> None:
    counter = 0
    should_exit = await self.on_tick(counter)
    while not should_exit:
        counter += 1
        counter = counter % 864000
        await asyncio.sleep(0.1)
        should_exit = await self.on_tick(counter)
```

代码中可以看到`server.run()`调用了`server.serve()`函数，而`server.serve()`中主要做的就是`startup()`,`main_loop()`以及当`self.show_exit=True`之后运行的`shutdown()`函数。 `main_loop`主要的作用就是保持代码的运行。
所以关键代码应该在`startup()`中

### 1.2 启动端口监听`loop.create_server()`和ASGI协议

```python
# uvicorn/server.py
async def startup(self, sockets: Optional[List[socket.socket]] = None) -> None:
    ...
    def create_protocol(
            _loop: Optional[asyncio.AbstractEventLoop] = None,
        ) -> asyncio.Protocol:
            return config.http_protocol_class(...)
    ...
    if sockets is not None:
        ...
    elif ...
    else:
        try:
            server = await loop.create_server(
                create_protocol,
                host=config.host,
                port=config.port,
                ...
            )
        except OSError as exc:
            ...
# config.http_protocol_class的初始化在Config.load()函数中
# uvicorn/config.py
def load(self):
    ...
    if isinstance(self.http, str):
        http_protocol_class = import_from_string(HTTP_PROTOCOLS[self.http])
        self.http_protocol_class: Type[asyncio.Protocol] = http_protocol_class
    else:
        self.http_protocol_class = self.http
```

uvicorn通过asyncio的底层接`loop.create_server()`启动了一个监听指定端口的server，fastapi的应用程序就运行在这个server中。
`config.http_protocol_class()`是一个实现了python异步[基础协议](https://docs.python.org/zh-cn/3/library/asyncio-protocol.html#protocols)的类，这里默认是`uvicron.protocols.http.h11_impl.H11Protocol`。
协议规定了需要实现`data_data_received(data)`用于处理接收到的数据

```python
# uvicorn/protocols/http/h11_impl.py
def data_received(self, data: bytes) -> None:
    ...
    self.handle_events()

def handle_events(self) -> None:
    while True:
        try:
            event = self.conn.next_event()
        except h11.RemoteProtocolError:
            ...

        if event is h11.NEED_DATA:
            ...
        elif ...
        elif isinstance(event, h11.Request):
            ...
            self.headers = [(key.lower(), value) for key, value in event.headers]
            raw_path, _, query_string = event.target.partition(b"?")
            self.scope = {
                "type": "http",
                "asgi": {
                    "version": self.config.asgi_version,
                    "spec_version": "2.3",
                },
                "http_version": event.http_version.decode("ascii"),
                "server": self.server,
                "client": self.client,
                "scheme": self.scheme,
                "method": event.method.decode("ascii"),
                "root_path": self.root_path,
                "path": unquote(raw_path.decode("ascii")),
                "raw_path": raw_path,
                "query_string": query_string,
                "headers": self.headers,
                "state": self.app_state.copy(),
            }
            upgrade = self._get_upgrade()
            if upgrade == b"websocket" and self._should_upgrade_to_ws():
                self.handle_websocket_upgrade(event)
                return
            # Handle 503 responses when 'limit_concurrency' is exceeded.
            if ...
            else:
                app = self.app

            self.cycle = RequestResponseCycle(
                scope=self.scope,
                ...
            )
            task = self.loop.create_task(self.cycle.run_asgi(app))
            task.add_done_callback(self.tasks.discard)
            self.tasks.add(task)
        ...
```

这里可以看到uvicorn中解析了请求的路径、参数、请求头等并保存到了scope中，随后实例化了`RequestResponseCycle`并异步调用了`run_asgi()`方法

```python
async def run_asgi(self, app: "ASGI3Application") -> None:
    try:
        result = await app(self.scope, self.receive, self.send)
    except ...
```

这一行 `result = await app(self.scope, self.receive, self.send)`就是**ASGI**协议的主要内容。
**ASGI**规定了app需要实现`app(data, receive, send)`，从而使服务端能够与app进行通讯。

至此，我们就理解了uvicorn是如何将收到的请求传递给FastAPI的了:

1. uvicorn通过asyncio底层接口启动一个监听端口的server
2. server收到请求后解析请求头、请求路径等信息后保存在scope中
3. 通过ASGI协议调用FastAPI app，完成信息传递

## 2. FastAPI调用endpoint

app通过`app(data, receive, send)`方法来处理uvicorn传递的数据，由于fastapi的app是一个对象而非函数，所以我们从app的`__call__()`方法作为入口开始分析。

```python
# fastapi/application.py
async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
    ...
    await super().__call__(scope, receive, send)
```

FastAPI直接继承了`starlette.Starlette()`，所以我们继续去看`starlette`的代码

```python
# starlette.application.py
async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
    scope["app"] = self
    if self.middleware_stack is None:
        self.middleware_stack = self.build_middleware_stack()
    await self.middleware_stack(scope, receive, send)

def build_middleware_stack(self) -> ASGIApp:
    ...
    middleware = [Middleware(...), ...]

    app = self.router
    for cls, options in reversed(middleware):
        app = cls(app=app, **options)
    return app
```

`starlette`创建了多个中间件，并一层层额的调用，最内层为`self.router`。所以`app(scope, receive, send)`最终的调用是`self.router(scope, receive, send)`。FastAPI中router是自己定义的`APIRouter`，我们这里需要回到fastapi看它是如何实现这部分的。

```python
# fastapi/routing.py
class APIRouter(routing.Router):
# starlette/routing.py
class Router:
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        assert scope["type"] in ("http", "websocket", "lifespan")
        ...
        partial = None
        for route in self.routes:
            match, child_scope = route.matches(scope)
            if match == Match.FULL:
                scope.update(child_scope)
                await route.handle(scope, receive, send)
                return
            elif match == Match.PARTIAL and partial is None:
                partial = route
                partial_scope = child_scope

        if partial is not None:
            ...
```

当调用`router(scope, receive, send)`时，他会遍历所有注册的路由去寻找匹配的`route`来对传入的数据进行处理。
我们继续看FastAPI默认使用的`APIRoute.handle(scope, receive, send)`是如何工作的。

```python
# fastapi/routingg.py
class APIRoute(routing.Route):
    # 没有重载handle方法
# starlette/routing.py
class Route:
    async def handle(self, scope: Scope, receive: Receive, send: Send) -> None:
        if self.methods and scope["method"] not in self.methods:
            ...
        else:
            await self.app(scope, receive, send)
```

FastAPI中的`APIRoute`继承自`starlette.routing.Route`。其中`handle()`方法的主要内容就是调用了自己的`app(scope, receive, send)`方法，而FastAPI中对route的app属性做了修改，所以我们继续看FastAPI的代码。

```python
# fastapi/routing.py
class APIRoute(routing.Route):
    def __init__(self, path, endpoint, ...) -> None:
        ...
        self.endpoint = endpoint
        ...
        # 这里将endpoint保存到了dependant.call属性中
        self.dependant = get_dependant(path=self.path_format, call=self.endpoint)
        ...
        # 这里是关健
        self.app = request_response(self.get_route_handler())

    def get_route_handler(self):
        return get_request_handler(dependant=self.dependant, ...)

def get_request_handler(dependant):
    is_coroutine = asyncio.iscoroutinefunction(dependant.call)
    async def app(request: Request) -> Response:
        if ...
        else:
            raw_response = await run_endpoint_function(
                dependant=dependant, values=values, is_coroutine=is_coroutine
            )
            return response
    return app

# starlette/routing.py
def request_response(func: typing.Callable) -> ASGIApp:
    is_coroutine = is_async_callable(func)
    async def app(scope: Scope, receive: Receive, send: Send) -> None:
        request = Request(scope, receive=receive, send=send)
        if is_coroutine:
            response = await func(request)
        else:
            response = await run_in_threadpool(func, request)
        await response(scope, receive, send)

    return app
```

从上边的代码中可以看到，FastAPI中的`Route.app`实际上上是一个闭包函数。在`get_request_handler()`中定义的一个异步闭包函数，并将该函数传递给`request_response()`。`request_response()`函数调用闭包函数`app`拿到其返回值`Response`。并调用`Response()(scope, receive, send)`实现返回请求。

下面是`Response.__call__()`的代码，可以看到其中异步调用的send函数，用于返回这次请求的响应。

```python
class Response:
    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        await send(
            {
                "type": "http.response.start",
                "status": self.status_code,
                "headers": self.raw_headers,
            }
        )
        await send({"type": "http.response.body", "body": self.body})

        if self.background is not None:
            await self.background()
```

综上，FastAPI从接到请求到返回响应的完整逻辑如下：

1. 根据请求的路径寻找匹配的路由
2. 调用路由的endpoint（即我们自己定义的函数），拿到函数返回值`raw_content`
3. 根据`raw_content`生成`Response`对象
4. 调用`response(scope, receive, send)`返回响应

## 3. FastAPI如何处理同步、异步请求

在浏览上边的代码时这个问题其实已经解决了，关健就在`run_endpoint_function`函数中。

```python
async def run_endpoint_function(dependant):
    ...
    if is_coroutine:
        return await dependant.call(**values)
    else:
        return await run_in_threadpool(dependant.call, **values)
```

所以结论就是如果endpoint是一个异步函数，FastAPI会直接调用，而如果是同步函数，会将函数放入线程池中异步调用。

## 总结

从开发者定义一个endpoint到uvicorn服务启动，再到接受请求，返回响应。中间的流程如下。

1. uvicorn启动一个异步服务器，监听指定端口
2. 接收到请求后，uvicorn解析请求头、路径等参数，保存到scope中
3. 通过ASGI协议，调用app，将scope数据传递给app
4. app遍历所有`self.routes`，并找到match的路由
5. `Route`对象调用开发者挂载的endpoint函数，得到返回值
6. `Route`构造`Response`对象，将endpoint返回值发送回客户端
