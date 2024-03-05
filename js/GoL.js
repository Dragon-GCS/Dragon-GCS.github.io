function drawLine(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke()
}

function drawBlock(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(
        x * BLOCK_WIDTH + 1,
        y * BLOCK_HEIGHT + 1,
        BLOCK_WIDTH - 2,
        BLOCK_HEIGHT - 2
    );
}

function initCanvas(ctx) {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = DEAD_COLOR;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    for (let i = 0; i < SIZE; i++) {
        drawLine(ctx, i * BLOCK_WIDTH, 0 , i * BLOCK_WIDTH, CANVAS_HEIGHT);
    }
    for (let j = 0; j < SIZE; j++) {
        drawLine(ctx, 0, j * BLOCK_HEIGHT, CANVAS_WIDTH, j * BLOCK_HEIGHT);
    }
    drawLine(ctx, CANVAS_WIDTH, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawLine(ctx, 0, CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function initGame(ctx, clear = false) {
    initCanvas(ctx);
    let currentStatus = [];
    for (i = 0; i < SIZE; i++) {
        currentStatus.push([]);
        for (j = 0; j < SIZE; j++) {
            _status = 0
            if (!clear && Math.random() < LIVE_BLOCK_RATE) {
                _status = 1;
                drawBlock(ctx, i, j, LIVE_COLOR);
            }
            currentStatus[i].push(_status);
        }
    }
    return currentStatus
}

function clickBlock(e) {
    let x = Math.floor(e.offsetX / BLOCK_WIDTH);
    let y = Math.floor(e.offsetY / BLOCK_HEIGHT);
    currentStatus[x][y] = 1 - currentStatus[x][y];
    drawBlock(ctx, x, y, currentStatus[x][y] ? LIVE_COLOR : DEAD_COLOR);
}

function update(ctx) {
    if (!GAMING) { return; }
    let nextStatus = [];
    let changeFlag = 0
    for (i = 0; i < SIZE; i++) {
        nextStatus.push([]);
        for (j = 0; j < SIZE; j++) {
            let liveCount = 0;
            for (k = -1; k <= 1; k++) {
                for (l = -1; l <= 1; l++) {
                    if (i + k >= 0 && i + k < SIZE && j + l >= 0 && j + l < SIZE) {
                        liveCount += currentStatus[i + k][j + l];
                    }
                }
            }
            liveCount -= currentStatus[i][j];
            if (currentStatus[i][j] == 1) {
                if (liveCount < 2 || liveCount > 3) {
                    nextStatus[i].push(0);
                    drawBlock(ctx, i, j, DEAD_COLOR);
                } else {
                    nextStatus[i].push(1);
                }
            } else {
                if (liveCount == 3) {
                    nextStatus[i][j] = 1;
                    drawBlock(ctx, i, j, LIVE_COLOR);
                } else {
                    nextStatus[i][j] = 0;
                }
            }
            changeFlag += currentStatus[i][j] != nextStatus[i][j];
        }
    }
    if (changeFlag == 0) { GAMING = false; alert("Game Over"); }
    currentStatus = nextStatus
}

function changeSize(e) {
    if (GAMING) { return }
    SIZE = e.srcElement.value;
    document.getElementsByClassName("size")[0].innerHTML = SIZE;
    BLOCK_WIDTH = CANVAS_WIDTH / SIZE;
    BLOCK_HEIGHT = CANVAS_HEIGHT / SIZE;
    currentStatus = initGame(ctx);
}

function changeLiveRate(e) {
    LIVE_BLOCK_RATE = e.srcElement.value;
    document.getElementsByClassName("liveRate")[0].innerHTML = LIVE_BLOCK_RATE;
    if (!GAMING) { currentStatus = initGame(ctx); }
}
const LIVE_COLOR = 'rgba(0,0,0,1)';
const DEAD_COLOR = 'rgba(255,255,255,1)';

let canvas = document.getElementById("canvas");
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

let SIZE = document.getElementById("size").value;
document.getElementsByClassName("size")[0].innerHTML = SIZE;

let BLOCK_HEIGHT = CANVAS_HEIGHT / SIZE;
let BLOCK_WIDTH = CANVAS_WIDTH / SIZE;

let LIVE_BLOCK_RATE = document.getElementById("liveRate").value;
document.getElementsByClassName("liveRate")[0].innerHTML = LIVE_BLOCK_RATE;

let FPS = 15;
let GAMING = false;

let ctx = canvas.getContext("2d");
let currentStatus = initGame(ctx);

canvas.addEventListener("click", clickBlock);
document.getElementById("size").onchange = changeSize;
document.getElementById("liveRate").onchange = changeLiveRate;
document.getElementById("start").onclick = () => {
    GAMING = true;
    setInterval(() => {
        update(ctx)
    }, 1000 / FPS);
};
document.getElementById("stop").onclick = () => {
    GAMING = false;
};
document.getElementById('restart').onclick = () => {
    GAMING = false
    currentStatus = initGame(ctx);
};
document.getElementById('clear').onclick = () => {
    GAMING = false
    currentStatus = initGame(ctx, clear=true);
};