const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const W = 480;
const H = 720;
canvas.width = W;
canvas.height = H;

const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');
const finalScoreEl = document.getElementById('finalScore');
const finalHighScoreEl = document.getElementById('finalHighScore');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const calibrationStatus = document.getElementById('calibrationStatus');
const video = document.getElementById('webcam');

const isMobile = window.innerWidth <= 520 || 'ontouchstart' in window;
const GRAVITY = isMobile ? 0.25 : 0.375;
const UPWARD_FORCE = isMobile ? -5.6 : -8.0;
const UPWARD_FORCE = -8.0;
const BIRD_X = W * 0.25;
const BIRD_RADIUS = 18;
const OBSTACLE_WIDTH = 60;
const GAP_SIZE_BASE = 170;
const GAP_SIZE_MIN = 150;
const OBSTACLE_SPEED_INITIAL = 3.5;
const OBSTACLE_SPEED_MAX = 7.0;
const SPEED_INCREMENT = 0.04;
const SPAWN_INTERVAL_INITIAL = 1900;
const SPAWN_INTERVAL_MIN = 1100;

let bird = { x: BIRD_X, y: H / 2, vy: 0 };
let obstacles = [];
let score = 0;
let highScore = parseInt(localStorage.getItem('flappyFaceHighScore')) || 0;
let gameState = 'loading';
let gameSpeed = OBSTACLE_SPEED_INITIAL;
let lastSpawnTime = 0;
let frameCount = 0;
let highScoreElapsed = false;

highScoreEl.textContent = highScore;

let touchMode = false;

let handDetected = false;
let palmTracking = false;

let readyCountdown = 3;
let readyStartTime = 0;

function createObstacle() {
  const gapY = 100 + Math.random() * (H - GAP_SIZE_BASE - 200);
  const currentGap = Math.max(
    GAP_SIZE_MIN,
    GAP_SIZE_BASE - Math.min(score * 0.8, 20)
  );
  return { x: W, gapY, gapSize: currentGap, passed: false };
}

function drawSpikeTeeth(edge, toothCount, toothHeight, direction) {
  const toothWidth = OBSTACLE_WIDTH / toothCount;
  for (let i = 0; i < toothCount; i++) {
    const baseY = edge - Math.sign(direction) * toothHeight;
    const tipY = edge;
    const x1 = i * toothWidth;
    const x2 = x1 + toothWidth / 2;
    const x3 = x1 + toothWidth;
    if (direction < 0) {
      ctx.lineTo(x2, tipY);
      ctx.lineTo(x3, baseY);
    } else {
      ctx.lineTo(x2, tipY);
      ctx.lineTo(x3, baseY);
    }
  }
}

function drawObstacles() {
  for (const obs of obstacles) {
    const { x, gapY, gapSize } = obs;
    const teeth = 5;
    const toothH = 22;

    ctx.fillStyle = '#4a4a4a';
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 2;

    if (gapY > toothH) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + OBSTACLE_WIDTH, 0);
      const baseY = gapY - toothH;
      ctx.lineTo(x + OBSTACLE_WIDTH, baseY);
      for (let i = teeth - 1; i >= 0; i--) {
        const tw = OBSTACLE_WIDTH / teeth;
        const bx = x + i * tw;
        ctx.lineTo(bx + tw / 2, gapY);
        ctx.lineTo(bx, baseY);
      }
      ctx.lineTo(x, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#5a5a5a';
      for (let i = 0; i < teeth; i++) {
        const tw = OBSTACLE_WIDTH / teeth;
        const cx = x + i * tw + tw / 2;
        ctx.beginPath();
        ctx.moveTo(cx, gapY - toothH * 0.3);
        ctx.lineTo(cx - 4, gapY);
        ctx.lineTo(cx + 4, gapY);
        ctx.closePath();
        ctx.fill();
      }
    }

    const bottomStart = gapY + gapSize;
    const bottomH = H - bottomStart;
    if (bottomH > toothH) {
      ctx.fillStyle = '#4a4a4a';
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x + OBSTACLE_WIDTH, H);
      const baseY2 = bottomStart + toothH;
      ctx.lineTo(x + OBSTACLE_WIDTH, baseY2);
      for (let i = teeth - 1; i >= 0; i--) {
        const tw = OBSTACLE_WIDTH / teeth;
        const bx = x + i * tw;
        ctx.lineTo(bx + tw / 2, bottomStart);
        ctx.lineTo(bx, baseY2);
      }
      ctx.lineTo(x, baseY2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

function rectCircleCollide(rx, ry, rw, rh, cx, cy, cr) {
  const nearestX = Math.max(rx, Math.min(cx, rx + rw));
  const nearestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < cr * cr;
}

function checkCollisions() {
  if (bird.y - BIRD_RADIUS < 0 || bird.y + BIRD_RADIUS > H) {
    return true;
  }
  for (const obs of obstacles) {
    const { x, gapY, gapSize } = obs;
    const teethH = 22;

    const topRectH = gapY;
    if (rectCircleCollide(x, 0, OBSTACLE_WIDTH, topRectH, bird.x, bird.y, BIRD_RADIUS)) {
      return true;
    }
    const bottomRectY = gapY + gapSize;
    const bottomRectH = H - bottomRectY;
    if (rectCircleCollide(x, bottomRectY, OBSTACLE_WIDTH, bottomRectH, bird.x, bird.y, BIRD_RADIUS)) {
      return true;
    }
  }
  return false;
}

function drawBird() {
  const bx = bird.x;
  const by = bird.y;
  const tilt = Math.max(-0.5, Math.min(0.5, bird.vy * 0.04));

  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(tilt);

  const bodyColor = '#FFD700';
  const bellyColor = '#FFEB99';
  const wingColor = '#E6A800';
  const beakColor = '#FF8C00';
  const eyeWhite = '#FFFFFF';
  const eyePupil = '#222';
  const cheekColor = '#FFB6C1';

  ctx.beginPath();
  ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(-2, 4, BIRD_RADIUS * 0.5, BIRD_RADIUS * 0.45, 0, 0, Math.PI * 2);
  ctx.fillStyle = bellyColor;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(-8, 2, 10, 7, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = wingColor;
  ctx.fill();
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(BIRD_RADIUS - 2, -4);
  ctx.lineTo(BIRD_RADIUS + 12, 0);
  ctx.lineTo(BIRD_RADIUS - 2, 4);
  ctx.closePath();
  ctx.fillStyle = beakColor;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(4, -4, 7, 0, Math.PI * 2);
  ctx.fillStyle = eyeWhite;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(6, -3, 4, 0, Math.PI * 2);
  ctx.fillStyle = eyePupil;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(8, -5, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(-2, 6, 5, 0, Math.PI * 2);
  ctx.fillStyle = cheekColor;
  ctx.fill();

  ctx.restore();
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#4FC3F7');
  grad.addColorStop(0.6, '#81D4FA');
  grad.addColorStop(1, '#B3E5FC');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const cloudPositions = [
    { x: (frameCount * 0.2) % (W + 100) - 100, y: 60, s: 1.2 },
    { x: (frameCount * 0.15 + 200) % (W + 100) - 100, y: 130, s: 0.9 },
    { x: (frameCount * 0.25 + 400) % (W + 100) - 100, y: 40, s: 1.0 },
    { x: (frameCount * 0.12 + 600) % (W + 100) - 100, y: 160, s: 0.7 },
  ];

  for (const cloud of cloudPositions) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    const sx = cloud.x;
    const sy = cloud.y;
    const ss = cloud.s;
    ctx.beginPath();
    ctx.arc(sx, sy, 25 * ss, 0, Math.PI * 2);
    ctx.arc(sx + 30 * ss, sy - 8 * ss, 20 * ss, 0, Math.PI * 2);
    ctx.arc(sx + 60 * ss, sy, 22 * ss, 0, Math.PI * 2);
    ctx.arc(sx + 30 * ss, sy + 5 * ss, 18 * ss, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#8BC34A';
  ctx.fillRect(0, H - 30, W, 30);
  ctx.fillStyle = '#689F38';
  ctx.fillRect(0, H - 30, W, 4);
}

function countExtendedFingers(landmarks) {
  let count = 0;
  if (landmarks[8].y < landmarks[6].y) count++;
  if (landmarks[12].y < landmarks[10].y) count++;
  if (landmarks[16].y < landmarks[14].y) count++;
  if (landmarks[20].y < landmarks[18].y) count++;
  const thumbTip = landmarks[4];
  const thumbIP = landmarks[3];
  const thumbMCP = landmarks[2];
  if (Math.abs(thumbTip.x - thumbMCP.x) > Math.abs(thumbIP.x - thumbMCP.x) * 1.2) {
    count++;
  }
  return count;
}

async function initHandTracking() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' }
    });
    video.srcObject = stream;

    const hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        handDetected = true;
        palmTracking = (countExtendedFingers(landmarks) >= 5);

        if (gameState === 'loading' || gameState === 'menu') {
          calibrationStatus.textContent = palmTracking
            ? 'Palm open! Ready to fly.'
            : 'Open your hand fully to fly.';
        }
      } else {
        handDetected = false;
        palmTracking = false;
        if (gameState === 'loading' || gameState === 'menu') {
          calibrationStatus.textContent = 'No hand detected.';
        }
      }
    });

    async function detectLoop() {
      if (video.readyState >= 2) {
        try {
          await hands.send({ image: video });
        } catch (e) {}
      }
      requestAnimationFrame(detectLoop);
    }

    video.onloadeddata = () => {
      video.play();
      video.style.display = 'block';
      document.querySelector('.webcam-wrapper').style.display = 'block';

      calibrationStatus.textContent = 'Camera ready! Click Start Game.';
      document.getElementById('startBtn').style.display = 'inline-block';
    };

    detectLoop();
  } catch (err) {
    calibrationStatus.textContent = 'Camera access denied.';
    console.error('Camera error:', err);
  }
}

function checkHandGesture() {
  if (touchMode) {
    bird.vy += GRAVITY;
    return;
  }
  if (!handDetected || !palmTracking) {
    bird.vy += GRAVITY;
    return;
  }
  bird.vy = UPWARD_FORCE;
}

function startGame(mode) {
  touchMode = (mode === 'touch');
  bird = { x: BIRD_X, y: H / 2, vy: 0 };
  obstacles = [];
  score = 0;
  gameSpeed = OBSTACLE_SPEED_INITIAL;
  lastSpawnTime = 0;
  frameCount = 0;
  gameState = 'ready';
  startScreen.style.display = 'none';
  gameOverScreen.style.display = 'none';
  handDetected = false;
  palmTracking = false;
  readyCountdown = 5;
  readyStartTime = Date.now();
  scoreEl.textContent = '0';

  if (touchMode) {
    video.style.display = 'none';
    document.querySelector('.webcam-wrapper').style.display = 'none';
  }
}

function endGame() {
  gameState = 'gameover';
  const isNewHigh = score > highScore;
  if (isNewHigh) {
    highScore = score;
    localStorage.setItem('flappyFaceHighScore', highScore);
    highScoreEl.textContent = highScore;
  }
  finalScoreEl.textContent = score;
  finalHighScoreEl.textContent = highScore;
  gameOverScreen.style.display = 'flex';
}

function update() {
  if (gameState === 'ready') {
    const elapsed = (Date.now() - readyStartTime) / 1000;
    readyCountdown = 3 - Math.floor(elapsed);
    if (readyCountdown <= 0) {
      gameState = 'playing';
    }
    return;
  }

  if (gameState !== 'playing') return;
  frameCount++;

  checkHandGesture();

  bird.y += bird.vy;

  if (obstacles.length === 0 || obstacles[obstacles.length - 1].x < W - 280) {
    if (Date.now() - lastSpawnTime > SPAWN_INTERVAL_INITIAL - Math.min(score * 15, SPAWN_INTERVAL_INITIAL - SPAWN_INTERVAL_MIN)) {
      obstacles.push(createObstacle());
      lastSpawnTime = Date.now();
    }
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].x -= gameSpeed;
    if (!obstacles[i].passed && obstacles[i].x + OBSTACLE_WIDTH < bird.x) {
      obstacles[i].passed = true;
      score++;
      scoreEl.textContent = score;
      gameSpeed = Math.min(OBSTACLE_SPEED_MAX, gameSpeed + SPEED_INCREMENT);
    }
    if (obstacles[i].x + OBSTACLE_WIDTH < 0) {
      obstacles.splice(i, 1);
    }
  }

  if (checkCollisions()) {
    endGame();
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();

  if (gameState === 'ready') {
    drawBird();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 20;
    ctx.fillText(readyCountdown, W / 2, H / 2 - 20);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.fillText(touchMode ? 'Tap the screen to fly!' : 'Show your palm to the camera!', W / 2, H / 2 + 60);
    return;
  }

  drawObstacles();
  drawBird();

  const dot = document.querySelector('#faceIndicator .dot');
  if (dot) {
    dot.className = 'dot' + (palmTracking ? ' active' : '');
  }
  const label = document.querySelector('#faceIndicator .label');
  if (label) {
    label.textContent = palmTracking ? 'Palm ▲' : 'No Hand ▼';
  }
}

function gameLoop(timestamp) {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

document.getElementById('cameraBtn').addEventListener('click', () => {
  initHandTracking();
});
document.getElementById('touchBtn').addEventListener('click', () => startGame('touch'));
startBtn.addEventListener('click', () => startGame('camera'));
restartBtn.addEventListener('click', () => startGame(touchMode ? 'touch' : 'camera'));

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (gameState === 'playing') bird.vy = UPWARD_FORCE;
    else if (gameState === 'menu') { }
    else if (gameState === 'gameover') startGame(touchMode ? 'touch' : 'camera');
  }
});

canvas.addEventListener('click', () => {
  if (gameState === 'playing') bird.vy = UPWARD_FORCE;
  else if (gameState === 'menu') { }
  else if (gameState === 'gameover') startGame(touchMode ? 'touch' : 'camera');
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (gameState === 'playing') bird.vy = UPWARD_FORCE;
  else if (gameState === 'gameover') startGame(touchMode ? 'touch' : 'camera');
});

highScoreEl.textContent = highScore;
gameState = 'menu';
startScreen.style.display = 'flex';
calibrationStatus.textContent = 'Choose your play mode!';
document.querySelector('.webcam-wrapper').style.display = 'none';
requestAnimationFrame(gameLoop);
