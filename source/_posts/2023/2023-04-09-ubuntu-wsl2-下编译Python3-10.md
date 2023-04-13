---
title: ubuntu(wsl2)下编译Python3.10
date: 2023-04-09 23:40:04
tags: Linux
categories: Learning
---
<!-- cspell: disable -->
因为torch2.0的`model.compile`暂时只支持Linux系统，所以在windows上用wsl2装一个torch，顺便编译一下python3.10

## 1. 下载源码

```bash
wget https://www.python.org/ftp/python/3.10.11/Python-3.10.11.tgz
tar -zxf Python-3.10.11.tgz
cd Python-3.10.11
```

## 2. 安装依赖

- 编译源码需要`gcc`和`make`，如果已经有了可以跳过安装这两个

```bash
sudo apt install gcc make
```

- 安装依赖

有了gcc和make之后理论上就可以编译源码了，但是由于依赖的问题，会导致一些模块无法编译，所以需要根据需要安装一些依赖

![直接编译的结果](./missing_module.png)

```bash
sudo apt install libbz2-dev libncurses5-dev libncursesw5-dev libgdbm-dev uuid-dev libffi-dev liblzma-dev libsqlite3-dev libssl-dev zlib*-dev libreadline-dev
```

`build-essential`：用于编译`_ctypes`模块
`libbz2-dev`：用于编译`_bz2`模块
`libncurses5-dev`：用于编译`_curses`模块
`libncursesw5-dev`：用于编译`_curses`模块
`libgdbm-dev`：用于编译`_gdbm`模块
`uuid-dev`：用于编译`_uuid`模块
`libffi-dev`：用于编译`_ctypes`模块
`liblzma-dev`：用于编译`_lzma`模块
`libsqlite3-dev`：用于编译`_sqlite3`模块
`libssl-dev`：用于编译`_ssl`模块
`zlib*-dev`：用于编译`zlib`模块
`libreadline-dev`：用于编译`readline`模块
(上边这些都是copilot自动补全的，模块对应的不知道对不对，但是这些依赖没有问题)

## 3. 编译

安装完之后编译，可能只有小部分模块还有问题，但是不影响使用(我这里是_dbm和_tkinter没有编译)

```bash
./configure --enable-optimizations --prefix=</Your/Path>
make -j8
sudo make install
```

> configure的时候可以加上`--enable-optimizations`，这样编译出来的python会有一些优化，但是编译时间会变长, `--prefix`指定安装路径
> make的时候加上`-j8`，表示开启8个线程编译，加快编译速度

安装完后之后可能还需要做一些软连接的操作，我这里安装目录是`/usr`，所以不需要这些了
直接运行`python3 -V`就可以看到版本了

## 4. cuda-toolkit安装

因为宿主机上已经有了nvidia的驱动，所以wsl2上不需要再装驱动了，可以用`nvidia-smi`查看显卡信息。
cuda-toolkit是另外的的东西，在[这里](https://developer.nvidia.com/cuda-downloads?target_os=Linux&target_arch=x86_64&Distribution=WSL-Ubuntu&target_version=2.0)选好系统后，安装类型选**deb(netword)**，然后复制命令运行就好

> 具体细节可以看这篇[文章](../2021/10-29-Tensorflow%E4%B8%8ECUDA%E7%9A%84%E5%AE%89%E8%A3%85)

```bash
wget https://developer.download.nvidia.com/compute/cuda/repos/wsl-ubuntu/x86_64/cuda-keyring_1.0-1_all.deb
sudo dpkg -i cuda-keyring_1.0-1_all.deb
sudo apt-get update
sudo apt-get -y install cuda
```
