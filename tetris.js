document.addEventListener('DOMContentLoaded', () => {
    // キャンバスと2Dコンテキストの設定
    const canvas = document.getElementById('game-board');
    const ctx = canvas.getContext('2d');
    const nextPieceCanvas = document.getElementById('next-piece');
    const nextPieceCtx = nextPieceCanvas.getContext('2d');

    // ゲームの状態
    const gridWidth = 10;
    const gridHeight = 20;
    const cellSize = 30;
    let gameBoard = createEmptyBoard();
    let currentPiece = null;
    let nextPiece = null;
    let score = 0;
    let level = 1;
    let lines = 0;
    let gameInterval = null;
    let isPaused = false;
    let gameOver = false;
    let dropCounter = 0;
    let dropInterval = 1000; // 1秒ごとにピースが下がる
    let lastTime = 0;

    // テトリスの色
    const colors = [
        null,
        '#FF0D72', // I
        '#0DC2FF', // J
        '#0DFF72', // L
        '#F538FF', // O
        '#FF8E0D', // S
        '#FFE138', // T
        '#3877FF'  // Z
    ];

    // テトリスのピースの形を定義
    const pieces = [
        // I
        [
            [0, 1, 0, 0],
            [0, 1, 0, 0],
            [0, 1, 0, 0],
            [0, 1, 0, 0]
        ],
        // J
        [
            [0, 2, 0],
            [0, 2, 0],
            [2, 2, 0]
        ],
        // L
        [
            [0, 3, 0],
            [0, 3, 0],
            [0, 3, 3]
        ],
        // O
        [
            [4, 4],
            [4, 4]
        ],
        // S
        [
            [0, 5, 5],
            [5, 5, 0],
            [0, 0, 0]
        ],
        // T
        [
            [0, 0, 0],
            [6, 6, 6],
            [0, 6, 0]
        ],
        // Z
        [
            [7, 7, 0],
            [0, 7, 7],
            [0, 0, 0]
        ]
    ];

    // スタートボタンとポーズボタンの取得
    const startButton = document.getElementById('start-button');
    const pauseButton = document.getElementById('pause-button');

    // スコア、レベル、ラインの表示要素を取得
    const scoreElement = document.getElementById('score');
    const levelElement = document.getElementById('level');
    const linesElement = document.getElementById('lines');

    // 空のゲームボードを作成する関数
    function createEmptyBoard() {
        return Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));
    }

    // ピースを作成する関数
    function createPiece(type) {
        return {
            pos: { x: Math.floor(gridWidth / 2) - Math.floor(pieces[type][0].length / 2), y: 0 },
            matrix: pieces[type],
            type: type + 1 // 色のインデックスに合わせる
        };
    }

    // ランダムなピースを取得する関数
    function getRandomPiece() {
        const pieceType = Math.floor(Math.random() * pieces.length);
        return createPiece(pieceType);
    }

    // 次のピースを描画する関数
    function drawNextPiece() {
        nextPieceCtx.fillStyle = '#f8f8f8';
        nextPieceCtx.fillRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height);

        if (!nextPiece) return;

        const offsetX = (nextPieceCanvas.width - nextPiece.matrix[0].length * cellSize) / 2;
        const offsetY = (nextPieceCanvas.height - nextPiece.matrix.length * cellSize) / 2;

        nextPiece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    nextPieceCtx.fillStyle = colors[value];
                    nextPieceCtx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
                    nextPieceCtx.strokeStyle = '#000';
                    nextPieceCtx.strokeRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
                }
            });
        });
    }

    // ボードを描画する関数
    function drawBoard() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        gameBoard.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    ctx.fillStyle = colors[value];
                    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                    ctx.strokeStyle = '#000';
                    ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
                }
            });
        });

        if (currentPiece) {
            currentPiece.matrix.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        ctx.fillStyle = colors[value];
                        ctx.fillRect(
                            (currentPiece.pos.x + x) * cellSize,
                            (currentPiece.pos.y + y) * cellSize,
                            cellSize,
                            cellSize
                        );
                        ctx.strokeStyle = '#000';
                        ctx.strokeRect(
                            (currentPiece.pos.x + x) * cellSize,
                            (currentPiece.pos.y + y) * cellSize,
                            cellSize,
                            cellSize
                        );
                    }
                });
            });
        }

        // ゲームオーバーの表示
        if (gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = '30px Arial';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText('ゲームオーバー', canvas.width / 2, canvas.height / 2);
        }

        // 一時停止の表示
        if (isPaused && !gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = '30px Arial';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText('一時停止中', canvas.width / 2, canvas.height / 2);
        }
    }

    // 衝突検出関数
    function checkCollision(piece, pos) {
        for (let y = 0; y < piece.matrix.length; y++) {
            for (let x = 0; x < piece.matrix[y].length; x++) {
                if (
                    piece.matrix[y][x] !== 0 &&
                    (gameBoard[y + pos.y] === undefined ||
                        gameBoard[y + pos.y][x + pos.x] === undefined ||
                        gameBoard[y + pos.y][x + pos.x] !== 0)
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    // ピースを移動する関数
    function movePiece(dir) {
        currentPiece.pos.x += dir;
        if (checkCollision(currentPiece, currentPiece.pos)) {
            currentPiece.pos.x -= dir;
        }
    }

    // ピースを回転する関数
    function rotatePiece() {
        const rotated = [];
        for (let i = 0; i < currentPiece.matrix[0].length; i++) {
            rotated.push([]);
            for (let j = currentPiece.matrix.length - 1; j >= 0; j--) {
                rotated[i].push(currentPiece.matrix[j][i]);
            }
        }

        const previousMatrix = currentPiece.matrix;
        currentPiece.matrix = rotated;

        // 回転後に衝突する場合は元に戻す
        if (checkCollision(currentPiece, currentPiece.pos)) {
            currentPiece.matrix = previousMatrix;
        }
    }

    // ピースを下に移動する関数
    function dropPiece() {
        currentPiece.pos.y++;
        if (checkCollision(currentPiece, currentPiece.pos)) {
            currentPiece.pos.y--;
            mergePiece();
            removeLines();
            resetPiece();
        }
        dropCounter = 0;
    }

    // ピースをすぐに下まで落とす関数（ハードドロップ）
    function hardDrop() {
        while (!checkCollision(currentPiece, { x: currentPiece.pos.x, y: currentPiece.pos.y + 1 })) {
            currentPiece.pos.y++;
        }
        mergePiece();
        removeLines();
        resetPiece();
        dropCounter = 0;
    }

    // ピースをボードに固定する関数
    function mergePiece() {
        currentPiece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    gameBoard[y + currentPiece.pos.y][x + currentPiece.pos.x] = value;
                }
            });
        });
    }

    // 揃った行を削除する関数
    function removeLines() {
        let linesCleared = 0;

        outer: for (let y = gridHeight - 1; y >= 0; y--) {
            for (let x = 0; x < gridWidth; x++) {
                if (gameBoard[y][x] === 0) {
                    continue outer;
                }
            }

            // 行が揃っている場合、削除して上から新しい行を追加
            const row = gameBoard.splice(y, 1)[0].fill(0);
            gameBoard.unshift(row);
            y++; // 削除した行の次の行をもう一度チェック
            linesCleared++;
        }

        if (linesCleared > 0) {
            // スコア計算（1行:100点、2行:300点、3行:500点、4行:800点）
            const lineScores = [0, 100, 300, 500, 800];
            score += lineScores[linesCleared] * level;
            lines += linesCleared;

            // レベルアップ（10行ごとに1レベル）
            level = Math.floor(lines / 10) + 1;
            
            // 難易度の調整（レベルが上がるほど速くなる）
            dropInterval = Math.max(100, 1000 - (level - 1) * 100);
            
            // 画面の更新
            scoreElement.textContent = score;
            levelElement.textContent = level;
            linesElement.textContent = lines;
        }
    }

    // 新しいピースを設定する関数
    function resetPiece() {
        // 次のピースを現在のピースにする
        currentPiece = nextPiece || getRandomPiece();
        nextPiece = getRandomPiece();
        drawNextPiece();

        // ゲームオーバーの判定
        if (checkCollision(currentPiece, currentPiece.pos)) {
            gameOver = true;
            clearInterval(gameInterval);
        }
    }

    // ゲームの更新関数
    function update(time = 0) {
        if (isPaused || gameOver) return;

        const deltaTime = time - lastTime;
        lastTime = time;

        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            dropPiece();
        }

        drawBoard();
        requestAnimationFrame(update);
    }

    // ゲームの初期化関数
    function initGame() {
        gameBoard = createEmptyBoard();
        score = 0;
        level = 1;
        lines = 0;
        dropInterval = 1000;
        gameOver = false;

        scoreElement.textContent = score;
        levelElement.textContent = level;
        linesElement.textContent = lines;

        currentPiece = getRandomPiece();
        nextPiece = getRandomPiece();
        drawNextPiece();
        drawBoard();
    }

    // ゲームスタート関数
    function startGame() {
        if (gameInterval) clearInterval(gameInterval);
        initGame();
        isPaused = false;
        lastTime = 0;
        update();
    }

    // 一時停止/再開関数
    function togglePause() {
        if (gameOver) return;

        isPaused = !isPaused;
        if (!isPaused) {
            lastTime = 0;
            update();
        } else {
            drawBoard(); // 一時停止メッセージを表示するために再描画
        }
    }

    // キーボードイベントの処理
    document.addEventListener('keydown', (e) => {
        if (gameOver) return;

        switch (e.key) {
            case 'ArrowLeft':
                movePiece(-1);
                break;
            case 'ArrowRight':
                movePiece(1);
                break;
            case 'ArrowDown':
                dropPiece();
                break;
            case 'ArrowUp':
                rotatePiece();
                break;
            case ' ': // スペースキー
                hardDrop();
                break;
            case 'p':
            case 'P':
                togglePause();
                break;
        }

        drawBoard();
    });

    // ボタンイベントの処理
    startButton.addEventListener('click', startGame);
    pauseButton.addEventListener('click', togglePause);

    // 初期描画
    drawBoard();
});