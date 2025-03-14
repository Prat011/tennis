// Retro Tennis Game - Client Side JavaScript

// Connect to the server
const socket = io();

// Add connection debugging
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
});

// Game variables
let canvas, ctx;
let gameActive = false;
let isHost = false;
let currentRoomCode = null;
let playerReady = false;
let opponentReady = false;
let leftScore = 0;
let rightScore = 0;
let winningScore = 10;

// WebRTC variables
let peer = null;
let peerConnected = false;
let useWebRTC = true; // Set to true to use WebRTC, false to use WebSockets
const connectionText = document.getElementById('connection-text');

// Game objects
const paddleHeight = 100;
const paddleWidth = 15;
const ballSize = 15;
let leftPaddle = {
    x: 50,
    y: 250,
    dy: 0,
    speed: 8,
    score: 0
};
let rightPaddle = {
    x: 735,
    y: 250,
    dy: 0,
    speed: 8,
    score: 0
};
let ball = {
    x: 400,
    y: 300,
    dx: 5,
    dy: 5,
    speed: 5
};

// Sound effects
const paddleHitSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
const wallHitSound = new Audio('https://assets.mixkit.co/active_storage/sfx/270/270-preview.mp3');
const scoreSound = new Audio('https://assets.mixkit.co/active_storage/sfx/221/221-preview.mp3');
const gameStartSound = new Audio('https://assets.mixkit.co/active_storage/sfx/217/217-preview.mp3');
const gameOverSound = new Audio('https://assets.mixkit.co/active_storage/sfx/3/3-preview.mp3');

// DOM elements
const menuScreen = document.getElementById('menu-screen');
const roomScreen = document.getElementById('room-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over-screen');

const createGameBtn = document.getElementById('create-game-btn');
const joinGameBtn = document.getElementById('join-game-btn');
const createRoomPanel = document.getElementById('create-room-panel');
const joinRoomPanel = document.getElementById('join-room-panel');
const roomCodeDisplay = document.getElementById('room-code');
const roomCodeInput = document.getElementById('room-code-input');
const joinRoomBtn = document.getElementById('join-room-btn');
const joinError = document.getElementById('join-error');
const backFromCreateBtn = document.getElementById('back-from-create');
const backFromJoinBtn = document.getElementById('back-from-join');
const readyBtn = document.getElementById('ready-btn');
const playerStatusDisplay = document.getElementById('player-status');
const opponentStatusDisplay = document.getElementById('opponent-status');
const leftScoreDisplay = document.getElementById('left-score');
const rightScoreDisplay = document.getElementById('right-score');
const finalLeftScoreDisplay = document.getElementById('final-left-score');
const finalRightScoreDisplay = document.getElementById('final-right-score');
const winnerDisplay = document.getElementById('winner-display');
const playAgainBtn = document.getElementById('play-again-btn');
const mainMenuBtn = document.getElementById('main-menu-btn');

// 3D Camera and Perspective Settings
const FIELD_OF_VIEW = 90;
const PROJECTION_CENTER_X = 500;
const PROJECTION_CENTER_Y = 350;
const PERSPECTIVE = 500;

// Camera settings
let camera = {
    x: 0,
    y: 8, // Height of camera
    z: -45, // Distance behind player
    rotationX: 0.3, // Tilt down slightly
    rotationY: 0,
    followPlayer: true
};

// Convert 3D coordinates to 2D screen coordinates
function project3D(x, y, z) {
    // Translate point relative to camera
    let pointX = x - camera.x;
    let pointY = y - camera.y;
    let pointZ = z - camera.z;

    // Rotate point around camera
    let rotatedX = pointX * Math.cos(camera.rotationY) - pointZ * Math.sin(camera.rotationY);
    let rotatedZ = pointZ * Math.cos(camera.rotationY) + pointX * Math.sin(camera.rotationY);
    let rotatedY = pointY * Math.cos(camera.rotationX) - rotatedZ * Math.sin(camera.rotationX);
    rotatedZ = rotatedZ * Math.cos(camera.rotationX) + pointY * Math.sin(camera.rotationX);

    // Project 3D coordinates to 2D screen
    if (rotatedZ > 0) {
        let scale = PERSPECTIVE / rotatedZ;
        let x2d = PROJECTION_CENTER_X + rotatedX * scale;
        let y2d = PROJECTION_CENTER_Y + rotatedY * scale;
        return { x: x2d, y: y2d, scale: scale };
    }
    return null;
}

// Initialize the game
function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up socket event handlers
    setupSocketHandlers();
}

document.addEventListener('DOMContentLoaded', (event) => {
    setupEventListeners();
    setupSocketHandlers();
});

// Set up event listeners
function setupEventListeners() {
    // Menu buttons
    createGameBtn.addEventListener('click', createGame);
    joinGameBtn.addEventListener('click', showJoinRoom);
    
    // Room screen buttons
    backFromCreateBtn.addEventListener('click', backToMenu);
    backFromJoinBtn.addEventListener('click', backToMenu);
    joinRoomBtn.addEventListener('click', joinGame);
    
    // Ready button
    readyBtn.addEventListener('click', playerReadyUp);
    
    // Game over screen buttons
    playAgainBtn.addEventListener('click', restartGame);
    mainMenuBtn.addEventListener('click', backToMenu);
    
    // Keyboard controls
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

// Set up socket event handlers
function setupSocketHandlers() {
    // Game created
    socket.on('gameCreated', (roomCode) => {
        console.log('Game created with room code:', roomCode);
        currentRoomCode = roomCode;
        roomCodeDisplay.textContent = roomCode;
        showCreateRoom();
        isHost = true;
    });
    
    // Game joined
    socket.on('gameJoined', (roomCode) => {
        currentRoomCode = roomCode;
        showWaitingScreen();
        
        if (useWebRTC && !isHost) {
            // Initialize WebRTC as the guest (initiator)
            initializeWebRTC(true);
        }
    });
    
    // Join error
    socket.on('joinError', (message) => {
        joinError.textContent = message;
    });
    
    // Player joined
    socket.on('playerJoined', () => {
        if (isHost) {
            showWaitingScreen();
            
            if (useWebRTC) {
                // Initialize WebRTC as the host (not initiator)
                initializeWebRTC(false);
            }
        }
    });
    
    // WebRTC signaling
    socket.on('webrtcSignal', (data) => {
        if (peer && useWebRTC) {
            try {
                peer.signal(data.signal);
            } catch (err) {
                console.error('Error signaling peer:', err);
                connectionText.textContent = 'Connection error. Falling back to WebSockets.';
                connectionText.style.color = '#f00';
                useWebRTC = false;
            }
        }
    });
    
    // Player left
    socket.on('playerLeft', () => {
        if (gameActive) {
            endGame('Opponent left the game');
        } else {
            backToMenu();
        }
        
        // Clean up WebRTC connection
        if (peer) {
            peer.destroy();
            peer = null;
            peerConnected = false;
        }
    });
    
    // Game start
    socket.on('gameStart', () => {
        startGame();
        
        // If host, immediately send initial ball state
        if (isHost) {
            setTimeout(() => {
                if (useWebRTC && peerConnected) {
                    sendWebRTCMessage({
                        type: 'ballUpdate',
                        ball: ball,
                        leftScore: 0,
                        rightScore: 0
                    });
                } else {
                    socket.emit('ballMove', {
                        roomCode: currentRoomCode,
                        ball: ball,
                        leftScore: 0,
                        rightScore: 0
                    });
                }
            }, 100); // Small delay to ensure client is ready
        }
    });
    
    // Opponent paddle move (WebSocket fallback)
    socket.on('opponentPaddleMove', (data) => {
        if (!useWebRTC || !peerConnected) {
            if (data.paddle === 'left') {
                leftPaddle.y = data.position;
            } else {
                rightPaddle.y = data.position;
            }
        }
    });
    
    // Ball update (WebSocket fallback)
    socket.on('ballUpdate', (data) => {
        if (!useWebRTC || !peerConnected) {
            if (!isHost) {
                ball = data.ball;
                updateScore(data.leftScore, data.rightScore);
            }
        }
    });
    
    // Request to send ball update (WebSocket fallback)
    socket.on('sendBallUpdate', (roomCode) => {
        if ((!useWebRTC || !peerConnected) && isHost && gameActive) {
            // Send current ball state to the server
            socket.emit('ballMove', {
                roomCode: roomCode,
                ball: ball,
                leftScore: leftScore,
                rightScore: rightScore
            });
        }
    });
    
    // Game ended
    socket.on('gameEnded', () => {
        gameActive = false;
    });
    
    // Game restarted
    socket.on('gameRestarted', () => {
        resetGame();
        showWaitingScreen();
        playerReady = false;
        opponentReady = false;
        updateReadyStatus();
    });
}

// Initialize WebRTC
function initializeWebRTC(isInitiator) {
    try {
        // Create a new peer connection
        peer = new SimplePeer({
            initiator: isInitiator,
            trickle: false
        });
        
        // Update connection status
        connectionText.textContent = 'Establishing WebRTC connection...';
        
        // Handle WebRTC signals
        peer.on('signal', (data) => {
            // Send the signal to the other peer via the server
            socket.emit('webrtcSignal', {
                roomCode: currentRoomCode,
                signal: data
            });
        });
        
        // Handle successful connection
        peer.on('connect', () => {
            peerConnected = true;
            connectionText.textContent = 'WebRTC connected! Using peer-to-peer communication.';
            connectionText.style.color = '#0f0';
            
            // If not host, request initial ball state
            if (!isHost && gameActive) {
                sendWebRTCMessage({ type: 'requestBallUpdate' });
            }
        });
        
        // Handle data messages
        peer.on('data', (data) => {
            const message = JSON.parse(data);
            handleWebRTCMessage(message);
        });
        
        // Handle errors
        peer.on('error', (err) => {
            console.error('WebRTC error:', err);
            connectionText.textContent = 'WebRTC error. Falling back to WebSockets.';
            connectionText.style.color = '#f00';
            useWebRTC = false;
            peerConnected = false;
        });
        
        // Handle connection close
        peer.on('close', () => {
            peerConnected = false;
            connectionText.textContent = 'WebRTC connection closed. Using WebSockets.';
            connectionText.style.color = '#f00';
            useWebRTC = false;
        });
    } catch (err) {
        console.error('Failed to initialize WebRTC:', err);
        connectionText.textContent = 'WebRTC not supported. Using WebSockets.';
        connectionText.style.color = '#f00';
        useWebRTC = false;
    }
}

// Send a message via WebRTC
function sendWebRTCMessage(message) {
    if (peer && peerConnected) {
        try {
            peer.send(JSON.stringify(message));
            return true;
        } catch (err) {
            console.error('Error sending WebRTC message:', err);
            return false;
        }
    }
    return false;
}

// Handle WebRTC messages
function handleWebRTCMessage(message) {
    switch (message.type) {
        case 'paddleMove':
            if (message.paddle === 'left') {
                leftPaddle.y = message.position;
            } else {
                rightPaddle.y = message.position;
            }
            break;
            
        case 'ballUpdate':
            if (!isHost) {
                ball = message.ball;
                updateScore(message.leftScore, message.rightScore);
            }
            break;
            
        case 'requestBallUpdate':
            if (isHost && gameActive) {
                sendWebRTCMessage({
                    type: 'ballUpdate',
                    ball: ball,
                    leftScore: leftScore,
                    rightScore: rightScore
                });
            }
            break;
            
        case 'gameOver':
            gameActive = false;
            break;
            
        default:
            console.warn('Unknown WebRTC message type:', message.type);
    }
}

// Create a new game
function createGame() {
    socket.emit('createGame');
}

// Show join room panel
function showJoinRoom() {
    hideAllScreens();
    roomScreen.classList.add('active');
    joinRoomPanel.style.display = 'block';
    createRoomPanel.style.display = 'none';
    roomCodeInput.focus();
}

// Show create room panel
function showCreateRoom() {
    hideAllScreens();
    roomScreen.classList.add('active');
    createRoomPanel.style.display = 'block';
    joinRoomPanel.style.display = 'none';
}

// Join an existing game
function joinGame() {
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    if (roomCode) {
        socket.emit('joinGame', roomCode);
    } else {
        joinError.textContent = 'Please enter a room code';
    }
}

// Show waiting screen
function showWaitingScreen() {
    hideAllScreens();
    waitingScreen.classList.add('active');
    updateReadyStatus();
}

// Player ready up
function playerReadyUp() {
    playerReady = true;
    playerStatusDisplay.textContent = 'READY';
    playerStatusDisplay.style.color = '#0f0';
    readyBtn.disabled = true;
    readyBtn.style.opacity = '0.5';
    
    socket.emit('playerReady', currentRoomCode);
}

// Update ready status display
function updateReadyStatus() {
    playerStatusDisplay.textContent = playerReady ? 'READY' : 'NOT READY';
    playerStatusDisplay.style.color = playerReady ? '#0f0' : '#f00';
    
    opponentStatusDisplay.textContent = opponentReady ? 'READY' : 'NOT READY';
    opponentStatusDisplay.style.color = opponentReady ? '#0f0' : '#f00';
    
    readyBtn.disabled = playerReady;
    readyBtn.style.opacity = playerReady ? '0.5' : '1';
}

// Start the game
function startGame() {
    hideAllScreens();
    gameScreen.classList.add('active');
    gameActive = true;
    gameStartSound.play();
    
    // Reset game state
    resetGameState();
    
    // For non-host players, ensure they have a valid ball object
    if (!isHost) {
        if (useWebRTC && peerConnected) {
            // Request initial ball state via WebRTC
            sendWebRTCMessage({ type: 'requestBallUpdate' });
        } else {
            // Request initial ball state via WebSockets
            socket.emit('requestBallUpdate', currentRoomCode);
        }
    }
    
    // Start the game loop
    requestAnimationFrame(gameLoop);
}

// Reset game state
function resetGameState() {
    leftPaddle = {
        x: 50,
        y: 250,
        dy: 0,
        speed: 8
    };
    rightPaddle = {
        x: 735,
        y: 250,
        dy: 0,
        speed: 8
    };
    ball = {
        x: 400,
        y: 300,
        dx: 5 * (Math.random() > 0.5 ? 1 : -1),
        dy: 5 * (Math.random() > 0.5 ? 1 : -1),
        speed: 5
    };
    leftScore = 0;
    rightScore = 0;
    updateScoreDisplay();
}

// Game loop
function gameLoop() {
    if (!gameActive) return;
    
    update();
    render();
    
    requestAnimationFrame(gameLoop);
}

// Update game state
function update() {
    // Update camera
    updateCamera();
    
    // Move paddles
    movePaddles();
    
    // If host, update ball position and check collisions
    if (isHost) {
        moveBall();
        checkCollisions();
        
        // Send ball position to the other player
        if (useWebRTC && peerConnected) {
            // Send via WebRTC
            sendWebRTCMessage({
                type: 'ballUpdate',
                ball: ball,
                leftScore: leftScore,
                rightScore: rightScore
            });
        } else {
            // Send via WebSockets
            socket.emit('ballMove', {
                roomCode: currentRoomCode,
                ball: ball,
                leftScore: leftScore,
                rightScore: rightScore
            });
        }
    }
    
    // Check for win condition
    if (leftScore >= winningScore || rightScore >= winningScore) {
        endGame();
    }
}

// Move paddles
function movePaddles() {
    // Move left paddle
    leftPaddle.y += leftPaddle.dy;
    
    // Move right paddle
    rightPaddle.y += rightPaddle.dy;
    
    // Keep paddles within bounds
    if (leftPaddle.y < 0) leftPaddle.y = 0;
    if (leftPaddle.y > canvas.height - paddleHeight) leftPaddle.y = canvas.height - paddleHeight;
    
    if (rightPaddle.y < 0) rightPaddle.y = 0;
    if (rightPaddle.y > canvas.height - paddleHeight) rightPaddle.y = canvas.height - paddleHeight;
    
    // Send paddle position to the other player
    let paddleToSend;
    let paddleSide;
    
    if (isHost) {
        paddleToSend = leftPaddle.y;
        paddleSide = 'left';
    } else {
        paddleToSend = rightPaddle.y;
        paddleSide = 'right';
    }
    
    if (useWebRTC && peerConnected) {
        // Send via WebRTC
        sendWebRTCMessage({
            type: 'paddleMove',
            paddle: paddleSide,
            position: paddleToSend
        });
    } else {
        // Send via WebSockets
        socket.emit('paddleMove', {
            roomCode: currentRoomCode,
            position: paddleToSend
        });
    }
}

// Move ball
function moveBall() {
    ball.x += ball.dx;
    ball.y += ball.dy;
}

// Check collisions
function checkCollisions() {
    // Ball collision with top and bottom walls
    if (ball.y <= 0 || ball.y + ballSize >= canvas.height) {
        ball.dy = -ball.dy;
        wallHitSound.play();
    }
    
    // Ball collision with left paddle
    if (
        ball.x <= leftPaddle.x + paddleWidth &&
        ball.y + ballSize >= leftPaddle.y &&
        ball.y <= leftPaddle.y + paddleHeight &&
        ball.dx < 0
    ) {
        ball.dx = -ball.dx;
        
        // Adjust angle based on where the ball hits the paddle
        const hitPosition = (ball.y - leftPaddle.y) / paddleHeight;
        ball.dy = 10 * (hitPosition - 0.5);
        
        // Increase speed slightly
        if (Math.abs(ball.dx) < 15) {
            ball.dx *= 1.05;
        }
        
        paddleHitSound.play();
    }
    
    // Ball collision with right paddle
    if (
        ball.x + ballSize >= rightPaddle.x &&
        ball.y + ballSize >= rightPaddle.y &&
        ball.y <= rightPaddle.y + paddleHeight &&
        ball.dx > 0
    ) {
        ball.dx = -ball.dx;
        
        // Adjust angle based on where the ball hits the paddle
        const hitPosition = (ball.y - rightPaddle.y) / paddleHeight;
        ball.dy = 10 * (hitPosition - 0.5);
        
        // Increase speed slightly
        if (Math.abs(ball.dx) < 15) {
            ball.dx *= 1.05;
        }
        
        paddleHitSound.play();
    }
    
    // Ball out of bounds (scoring)
    if (ball.x < 0) {
        // Right player scores
        rightScore++;
        updateScoreDisplay();
        resetBall(1);
        scoreSound.play();
    } else if (ball.x > canvas.width) {
        // Left player scores
        leftScore++;
        updateScoreDisplay();
        resetBall(-1);
        scoreSound.play();
    }
}

// Reset ball after scoring
function resetBall(direction) {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.dx = ball.speed * direction;
    ball.dy = ball.speed * (Math.random() > 0.5 ? 1 : -1);
}

// Update score
function updateScore(left, right) {
    if (left !== undefined) leftScore = left;
    if (right !== undefined) rightScore = right;
    updateScoreDisplay();
}

// Update score display
function updateScoreDisplay() {
    leftScoreDisplay.textContent = leftScore;
    rightScoreDisplay.textContent = rightScore;
}

// Render game
function render() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw tennis court
    drawCourt();
    
    // Draw paddles
    drawPaddle(leftPaddle.x, leftPaddle.y, -20); // Left paddle at z = -20
    drawPaddle(rightPaddle.x, rightPaddle.y, -20); // Right paddle at z = -20
    
    // Draw ball with shadow
    drawBall();
}

// Draw tennis court
function drawCourt() {
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;
    
    // Draw court outline
    let courtPoints = [
        {x: -40, y: 0, z: -40}, // Back left
        {x: 40, y: 0, z: -40},  // Back right
        {x: 40, y: 0, z: 40},   // Front right
        {x: -40, y: 0, z: 40}   // Front left
    ];
    
    // Project and draw court lines
    ctx.beginPath();
    for (let i = 0; i < courtPoints.length; i++) {
        let point = project3D(courtPoints[i].x, courtPoints[i].y, courtPoints[i].z);
        if (point) {
            if (i === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        }
    }
    ctx.closePath();
    ctx.stroke();
    
    // Draw center line
    let centerStart = project3D(0, 0, -40);
    let centerEnd = project3D(0, 0, 40);
    if (centerStart && centerEnd) {
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(centerStart.x, centerStart.y);
        ctx.lineTo(centerEnd.x, centerEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    // Draw service lines
    drawServiceLines();
}

// Draw service lines
function drawServiceLines() {
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 1;
    
    // Service line coordinates
    let servicePoints = [
        {x: -20, y: 0, z: -20}, // Back left
        {x: 20, y: 0, z: -20},  // Back right
        {x: 20, y: 0, z: 20},   // Front right
        {x: -20, y: 0, z: 20}   // Front left
    ];
    
    // Project and draw service box
    ctx.beginPath();
    for (let i = 0; i < servicePoints.length; i++) {
        let point = project3D(servicePoints[i].x, servicePoints[i].y, servicePoints[i].z);
        if (point) {
            if (i === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        }
    }
    ctx.closePath();
    ctx.stroke();
}

// Draw paddle
function drawPaddle(x, y, z) {
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 2;
    
    // Convert paddle coordinates to 3D space
    let paddleX = x - canvas.width/2;
    let paddleY = y - canvas.height/2;
    
    // Draw paddle wireframe
    let points = [
        {x: paddleX, y: paddleY, z: z},
        {x: paddleX + paddleWidth, y: paddleY, z: z},
        {x: paddleX + paddleWidth, y: paddleY + paddleHeight, z: z},
        {x: paddleX, y: paddleY + paddleHeight, z: z}
    ];
    
    // Project and draw paddle
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
        let point = project3D(points[i].x, points[i].y, points[i].z);
        if (point) {
            if (i === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        }
    }
    ctx.closePath();
    ctx.stroke();
    
    // Add glow effect
    ctx.shadowColor = '#0f0';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
}

// Draw ball
function drawBall() {
    if (!ball || typeof ball.x !== 'number' || typeof ball.y !== 'number') return;
    
    // Convert ball coordinates to 3D space
    let ballX = ball.x - canvas.width/2;
    let ballY = ball.y - canvas.height/2;
    let ballZ = 0;
    
    // Project ball position
    let projectedBall = project3D(ballX, ballY, ballZ);
    
    if (projectedBall) {
        // Draw ball
        ctx.fillStyle = '#0f0';
        let scaledSize = ballSize * projectedBall.scale;
        
        // Add glow effect
        ctx.shadowColor = '#0f0';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(projectedBall.x, projectedBall.y, scaledSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Draw ball shadow
        let shadowProj = project3D(ballX, 0, ballZ);
        if (shadowProj) {
            ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
            ctx.beginPath();
            ctx.ellipse(shadowProj.x, shadowProj.y, scaledSize, scaledSize * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// Handle key down events
function handleKeyDown(e) {
    if (!gameActive) return;
    
    if (isHost) {
        // Host controls left paddle
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
            leftPaddle.dy = -leftPaddle.speed;
        } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
            leftPaddle.dy = leftPaddle.speed;
        }
    } else {
        // Guest controls right paddle
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
            rightPaddle.dy = -rightPaddle.speed;
        } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
            rightPaddle.dy = rightPaddle.speed;
        }
    }
    
    // Camera controls
    if (e.key === 'c' || e.key === 'C') {
        camera.followPlayer = !camera.followPlayer;
        if (!camera.followPlayer) {
            // Reset camera to default position
            camera.x = 0;
            camera.y = 8;
            camera.z = -45;
            camera.rotationX = 0.3;
            camera.rotationY = 0;
        }
    }
}

// Handle key up events
function handleKeyUp(e) {
    if (!gameActive) return;
    
    if (isHost) {
        // Host controls left paddle
        if ((e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') && leftPaddle.dy < 0) {
            leftPaddle.dy = 0;
        } else if ((e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') && leftPaddle.dy > 0) {
            leftPaddle.dy = 0;
        }
    } else {
        // Guest controls right paddle
        if ((e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') && rightPaddle.dy < 0) {
            rightPaddle.dy = 0;
        } else if ((e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') && rightPaddle.dy > 0) {
            rightPaddle.dy = 0;
        }
    }
}

// Update camera position
function updateCamera() {
    if (camera.followPlayer) {
        let targetX = isHost ? leftPaddle.x - canvas.width/2 : rightPaddle.x - canvas.width/2;
        let targetY = isHost ? leftPaddle.y - canvas.height/2 : rightPaddle.y - canvas.height/2;
        
        // Smoothly move camera to follow player
        camera.x += (targetX - camera.x) * 0.1;
        camera.y = 8 + (targetY - camera.y) * 0.05;
    }
}

// End the game
function endGame(message) {
    gameActive = false;
    gameOverSound.play();
    
    // Update final score display
    finalLeftScoreDisplay.textContent = leftScore;
    finalRightScoreDisplay.textContent = rightScore;
    
    // Determine winner
    if (message) {
        winnerDisplay.textContent = message;
    } else if (leftScore > rightScore) {
        winnerDisplay.textContent = 'PLAYER 1 WINS!';
    } else {
        winnerDisplay.textContent = 'PLAYER 2 WINS!';
    }
    
    // Show game over screen
    hideAllScreens();
    gameOverScreen.classList.add('active');
    
    // Notify other player
    if (useWebRTC && peerConnected) {
        sendWebRTCMessage({ type: 'gameOver' });
    } else {
        socket.emit('gameOver', currentRoomCode);
    }
}

// Restart game
function restartGame() {
    socket.emit('restartGame', currentRoomCode);
}

// Reset game
function resetGame() {
    leftScore = 0;
    rightScore = 0;
    updateScoreDisplay();
    gameActive = false;
}

// Back to menu
function backToMenu() {
    hideAllScreens();
    menuScreen.classList.add('active');
    currentRoomCode = null;
    isHost = false;
    playerReady = false;
    opponentReady = false;
    resetGame();
    
    // Clean up WebRTC connection
    if (peer) {
        peer.destroy();
        peer = null;
        peerConnected = false;
    }
}

// Hide all screens
function hideAllScreens() {
    menuScreen.classList.remove('active');
    roomScreen.classList.remove('active');
    waitingScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
}

// Initialize the game when the page loads
window.onload = init; 