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

    // アニメーション用の変数
    let flashLines = []; // フラッシュさせる行
    let flashCounter = 0; // フラッシュカウンター
    let isFlashing = false; // フラッシュ中かどうか
    let gameOverAnimation = 0; // ゲームオーバーアニメーション
    let levelUpAnimation = false; // レベルアップアニメーション
    let levelUpCounter = 0; // レベルアップカウンター
    let levelUpPrevious = 1; // 前回のレベル

    // パーティクル配列
    let particles = [];

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

    // 効果音の作成関数
    function createAudio(frequency, duration, type = 'square', volume = 0.2) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.type = type;
            oscillator.frequency.value = frequency;
            gainNode.gain.value = volume;
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.start();
            
            // 指定時間後に音を停止
            setTimeout(() => {
                oscillator.stop();
                oscillator.disconnect();
                gainNode.disconnect();
            }, duration);
            
            return true;
        } catch (e) {
            console.error('効果音の作成に失敗しました:', e);
            return false;
        }
    }

    // 効果音の設定
    const sounds = {
        move: () => createAudio(200, 50, 'sine', 0.1),
        rotate: () => createAudio(300, 80, 'sine', 0.1),
        drop: () => createAudio(150, 100, 'square', 0.15),
        line: () => createAudio(440, 200, 'square', 0.2),
        levelup: () => {
            createAudio(659.25, 100, 'sine', 0.2);
            setTimeout(() => createAudio(783.99, 100, 'sine', 0.2), 100);
            setTimeout(() => createAudio(1046.50, 200, 'sine', 0.2), 200);
            return true;
        },
        gameover: () => {
            createAudio(261.63, 200, 'square', 0.2);
            setTimeout(() => createAudio(246.94, 200, 'square', 0.2), 200);
            setTimeout(() => createAudio(220.00, 400, 'square', 0.2), 400);
            return true;
        }
    };

    // ミュート設定
    let isMuted = false;

    // スタートボタンとポーズボタンの取得
    const startButton = document.getElementById('start-button');
    const pauseButton = document.getElementById('pause-button');

    // スコア、レベル、ラインの表示要素を取得
    const scoreElement = document.getElementById('score');
    const levelElement = document.getElementById('level');
    const linesElement = document.getElementById('lines');

    // 効果音を再生する関数
    function playSound(sound) {
        if (!isMuted) {
            sounds[sound]();
        }
    }

    // パーティクルクラス
    class Particle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.size = Math.random() * 5 + 5;
            this.speedX = Math.random() * 6 - 3;
            this.speedY = Math.random() * 6 - 3;
            this.alpha = 1;
            this.gravity = 0.1;
            this.friction = 0.99;
            this.fadeSpeed = 0.02;
        }

        update() {
            this.speedY += this.gravity;
            this.x += this.speedX;
            this.y += this.speedY;
            this.speedX *= this.friction;
            this.speedY *= this.friction;
            this.alpha -= this.fadeSpeed;
        }

        draw() {
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    // パーティクルを生成する関数
    function createParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            particles.push(new Particle(x, y, color));
        }
    }

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
                    
                    // ブロックの内側に光沢効果
                    nextPieceCtx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    nextPieceCtx.fillRect(offsetX + x * cellSize + 3, offsetY + y * cellSize + 3, cellSize - 6, cellSize / 2 - 3);
                    
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

        // グリッドの背景を描画
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                ctx.fillStyle = (x + y) % 2 === 0 ? '#1a1a1a' : '#222';
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }

        // ボードの描画
        gameBoard.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    // フラッシュ効果
                    let blockColor = colors[value];
                    if (isFlashing && flashLines.includes(y)) {
                        const flash = Math.sin(flashCounter * 0.3) * 127 + 128;
                        blockColor = `rgb(${flash}, ${flash}, ${flash})`;
                    }

                    // ブロックの描画
                    ctx.fillStyle = blockColor;
                    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
                    
                    // ブロックの内側に光沢効果
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.fillRect(x * cellSize + 3, y * cellSize + 3, cellSize - 6, cellSize / 2 - 3);
                    
                    ctx.strokeStyle = '#000';
                    ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
                }
            });
        });

        // 現在のピースの描画
        if (currentPiece && !isFlashing) {
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
                        
                        // ブロックの内側に光沢効果
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                        ctx.fillRect(
                            (currentPiece.pos.x + x) * cellSize + 3,
                            (currentPiece.pos.y + y) * cellSize + 3,
                            cellSize - 6,
                            cellSize / 2 - 3
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

        // パーティクルの描画と更新
        particles.forEach((particle, index) => {
            particle.update();
            particle.draw();
            if (particle.alpha <= 0) {
                particles.splice(index, 1);
            }
        });

        // レベルアップアニメーション
        if (levelUpAnimation) {
            levelUpCounter++;
            const progress = levelUpCounter / 60; // 60フレームで完了
            
            if (progress < 1) {
                ctx.globalAlpha = 1 - progress;
                ctx.fillStyle = 'rgba(255, 215, 0, 0.7)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                ctx.globalAlpha = 1;
                ctx.font = '40px Arial';
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`LEVEL UP!`, canvas.width / 2, canvas.height / 2);
                ctx.font = '30px Arial';
                ctx.fillText(`${levelUpPrevious} → ${level}`, canvas.width / 2, canvas.height / 2 + 40);
            } else {
                levelUpAnimation = false;
                levelUpCounter = 0;
            }
        }

        // ゲームオーバーアニメーション
        if (gameOver) {
            gameOverAnimation += 0.01;
            const alpha = Math.min(0.8, gameOverAnimation);
            
            // 暗いオーバーレイ
            ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // テキストが上から落ちてくるアニメーション
            if (gameOverAnimation > 0.5) {
                const textY = Math.min(canvas.height / 2, (gameOverAnimation - 0.5) * 500);
                
                // テキストの影
                ctx.font = 'bold 40px Arial';
                ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
                ctx.textAlign = 'center';
                ctx.fillText(`GAME OVER`, canvas.width / 2, textY);
                
                // スコア表示
                if (gameOverAnimation > 0.7) {
                    ctx.font = '25px Arial';
                    ctx.fillStyle = 'white';
                    ctx.fillText(`SCORE: ${score}`, canvas.width / 2, textY + 50);
                    ctx.fillText(`LINES: ${lines}`, canvas.width / 2, textY + 85);
                    ctx.fillText(`LEVEL: ${level}`, canvas.width / 2, textY + 120);
                }
            }
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
        if (isFlashing) return; // フラッシュ中は移動できない
        
        currentPiece.pos.x += dir;
        if (checkCollision(currentPiece, currentPiece.pos)) {
            currentPiece.pos.x -= dir;
        } else {
            playSound('move');
        }
    }

    // ピースを回転する関数
    function rotatePiece() {
        if (isFlashing) return; // フラッシュ中は回転できない
        
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
        } else {
            playSound('rotate');
        }
    }

    // ピースを下に移動する関数
    function dropPiece() {
        if (isFlashing) return; // フラッシュ中は移動できない
        
        currentPiece.pos.y++;
        if (checkCollision(currentPiece, currentPiece.pos)) {
            currentPiece.pos.y--;
            mergePiece();
            
            // 揃った行をチェックしてフラッシュ効果を開始
            const clearedLines = checkLines();
            if (clearedLines.length > 0) {
                flashLines = clearedLines;
                isFlashing = true;
                flashCounter = 0;
                
                // 500ミリ秒後にフラッシュを終了して行を削除
                setTimeout(() => {
                    removeLines(clearedLines);
                    isFlashing = false;
                    resetPiece();
                }, 500);
            } else {
                resetPiece();
            }
        }
        dropCounter = 0;
    }

    // ピースをすぐに下まで落とす関数（ハードドロップ）
    function hardDrop() {
        if (isFlashing) return; // フラッシュ中はハードドロップできない
        
        while (!checkCollision(currentPiece, { x: currentPiece.pos.x, y: currentPiece.pos.y + 1 })) {
            currentPiece.pos.y++;
        }
        playSound('drop');
        mergePiece();
        
        // 揃った行をチェックしてフラッシュ効果を開始
        const clearedLines = checkLines();
        if (clearedLines.length > 0) {
            flashLines = clearedLines;
            isFlashing = true;
            flashCounter = 0;
            
            // 500ミリ秒後にフラッシュを終了して行を削除
            setTimeout(() => {
                removeLines(clearedLines);
                isFlashing = false;
                resetPiece();
            }, 500);
        } else {
            resetPiece();
        }
        
        dropCounter = 0;
    }

    // ピースをボードに固定する関数
    function mergePiece() {
        if (!currentPiece) return; // currentPieceがnullの場合は何もしない
        
        currentPiece.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    // ボード範囲内かチェック
                    const boardY = y + currentPiece.pos.y;
                    const boardX = x + currentPiece.pos.x;
                    
                    if (boardY >= 0 && boardY < gridHeight && boardX >= 0 && boardX < gridWidth) {
                        gameBoard[boardY][boardX] = value;
                    }
                }
            });
        });
    }

    // 揃った行をチェックする関数
    function checkLines() {
        const clearedLines = [];
        
        outer: for (let y = gridHeight - 1; y >= 0; y--) {
            for (let x = 0; x < gridWidth; x++) {
                if (gameBoard[y][x] === 0) {
                    continue outer;
                }
            }
            clearedLines.push(y);
        }
        
        return clearedLines;
    }

    // 揃った行を削除する関数
    function removeLines(clearedLines) {
        const linesCleared = clearedLines.length;
        
        if (linesCleared > 0) {
            playSound('line');
            
            // 行ごとにパーティクルを生成
            clearedLines.forEach(y => {
                for (let x = 0; x < gridWidth; x++) {
                    const blockColor = colors[gameBoard[y][x]];
                    createParticles(x * cellSize + cellSize / 2, y * cellSize + cellSize / 2, blockColor, 5);
                }
            });
            
            // 行の削除と新しい行の追加（下から上に向かって処理）
            // clearedLinesを降順にソート
            clearedLines.sort((a, b) => b - a);
            
            clearedLines.forEach(y => {
                // 行を削除
                gameBoard.splice(y, 1);
                // 上に新しい行を追加
                gameBoard.unshift(Array(gridWidth).fill(0));
            });
            
            // スコア計算（1行:100点、2行:300点、3行:500点、4行:800点）
            const lineScores = [0, 100, 300, 500, 800];
            score += lineScores[linesCleared] * level;
            lines += linesCleared;
            
            // 前回のレベルを保存
            levelUpPrevious = level;
            
            // レベルアップ（10行ごとに1レベル）
            const newLevel = Math.floor(lines / 10) + 1;
            
            // レベルが上がったらアニメーションと効果音
            if (newLevel > level) {
                level = newLevel;
                levelUpAnimation = true;
                playSound('levelup');
            }
            
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
            gameOverAnimation = 0;
            playSound('gameover');
        }
    }

    // ゲームの更新関数
    function update(time = 0) {
        if (isPaused || (gameOver && gameOverAnimation >= 0.8)) return;

        const deltaTime = time - lastTime;
        lastTime = time;

        // フラッシュカウンターの更新
        if (isFlashing) {
            flashCounter++;
        }

        // ピースの落下処理
        if (!isFlashing) {
            dropCounter += deltaTime;
            if (dropCounter > dropInterval) {
                dropPiece();
            }
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
        isFlashing = false;
        particles = [];

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
        if (gameOver && gameOverAnimation >= 0.8) {
            // ゲームオーバー後に何かキーを押すとリスタート
            if (e.key === 'Enter' || e.key === ' ') {
                startGame();
                return;
            }
        }
        
        // フラッシュ中またはポーズ中は特定のキー以外を無視
        if (isFlashing) {
            if (e.key === 'p' || e.key === 'P' || e.key === 'm' || e.key === 'M') {
                // ポーズとミュート操作のみ許可
            } else {
                return; // その他のキーは無視
            }
        }
        
        if (isPaused) {
            if (e.key === 'p' || e.key === 'P') {
                togglePause();
            }
            return;
        }

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
            case 'm':
            case 'M':
                isMuted = !isMuted;
                break;
        }

        drawBoard();
    });

    // ボタンイベントの処理
    startButton.addEventListener('click', startGame);
    pauseButton.addEventListener('click', togglePause);

    // 初期描画
    drawBoard();
    
    // ゲーム開始時の演出
    setTimeout(() => {
        // スタート画面を表示
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = 'bold 30px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('テトリス', canvas.width / 2, canvas.height / 3);
        
        ctx.font = '20px Arial';
        ctx.fillText('スタートボタンを押してください', canvas.width / 2, canvas.height / 2);
        
        ctx.font = '16px Arial';
        ctx.fillText('操作方法:', canvas.width / 2, canvas.height * 2/3 - 30);
        ctx.fillText('← → : 左右移動', canvas.width / 2, canvas.height * 2/3);
        ctx.fillText('↑ : 回転', canvas.width / 2, canvas.height * 2/3 + 25);
        ctx.fillText('↓ : 下に移動', canvas.width / 2, canvas.height * 2/3 + 50);
        ctx.fillText('スペース : 即座に落とす', canvas.width / 2, canvas.height * 2/3 + 75);
    }, 100);
});