/**
 * gameEngine.js
 * "하늘에서 떨어지는 과일 받기" 게임 로직
 */

class GameEngine {
  constructor() {
    this.score = 0;
    this.level = 1;
    this.timeLimit = 0;
    this.isGameActive = false;
    this.gameTimer = null;

    // Callbacks
    this.onScoreChange = null;
    this.onGameEnd = null;

    // Game Objects
    this.playerPos = "Center"; // Left, Center, Right
    this.items = []; // falling items
    this.lastItemTime = 0;
    this.itemInterval = 1500; // ms
    this.itemSpeed = 2; // px per frame

    // Canvas properties (will be set on start)
    this.canvasWidth = 0;
    this.canvasHeight = 0;

    // Assets (Simple shapes for now, can be images)
    this.colors = {
      Left: "#FFD700",   // Gold
      Center: "#87CEEB", // SkyBlue
      Right: "#FF69B4"   // HotPink
    };
  }

  /**
   * 게임 시작
   * @param {Object} config - { timeLimit, width, height }
   */
  start(config = {}) {
    this.isGameActive = true;
    this.score = 0;
    this.level = 1;
    this.timeLimit = config.timeLimit || 60;
    this.canvasWidth = config.width || 400; // Default width
    this.canvasHeight = config.height || 400; // Default height

    this.items = [];
    this.playerPos = "Center";
    this.itemSpeed = 2;
    this.itemInterval = 1500;

    if (this.timeLimit > 0) {
      this.startTimer();
    }
  }

  /**
   * 게임 중지
   */
  stop() {
    this.isGameActive = false;
    this.clearTimer();

    if (this.onGameEnd) {
      this.onGameEnd(this.score, this.level);
    }
  }

  /**
   * 타이머 시작 (초 단위 감소)
   */
  startTimer() {
    this.clearTimer();
    this.gameTimer = setInterval(() => {
      this.timeLimit--;
      if (this.timeLimit <= 0) {
        this.stop();
      }
    }, 1000);
  }

  clearTimer() {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }
  }

  /**
   * 포즈 인식 결과 처리 (Player Movement)
   * @param {string} detectedPose - "Left", "Center", "Right"
   */
  onPoseDetected(detectedPose) {
    if (!this.isGameActive) return;

    // Update player position based on pose
    if (["Left", "Center", "Right"].includes(detectedPose)) {
      this.playerPos = detectedPose;
    }
  }

  /**
   * 게임 루프 업데이트 (Update Physics)
   * @param {number} timestamp - RequestAnimationFrame timestamp
   */
  update(timestamp) {
    if (!this.isGameActive) return;

    // 1. Spawn Items
    if (timestamp - this.lastItemTime > this.itemInterval) {
      this.spawnItem();
      this.lastItemTime = timestamp;
    }

    // 2. Move Items
    this.items.forEach(item => {
      item.y += this.itemSpeed;
    });

    // 3. Collision Detection & Cleanup
    this.checkCollisions();
  }

  spawnItem() {
    const lanes = ["Left", "Center", "Right"];
    const lane = lanes[Math.floor(Math.random() * lanes.length)];

    // 20% Bomb, 30% Banana, 50% Apple
    const rand = Math.random();
    let type = "Apple";
    if (rand < 0.2) type = "Bomb";
    else if (rand < 0.5) type = "Banana";

    this.items.push({
      lane: lane,
      type: type,
      y: -50, // Start above screen
      w: 40,
      h: 40
    });
  }

  checkCollisions() {
    const playerY = this.canvasHeight - 60; // Player is at bottom

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];

      // Screen bottom?
      if (item.y > this.canvasHeight) {
        this.items.splice(i, 1);
        continue;
      }

      // Collision with Player?
      // Simple logic: if item is low enough AND in same lane
      if (item.y + item.h >= playerY && item.y < playerY + 50 && item.lane === this.playerPos) {
        this.handleCatch(item);
        this.items.splice(i, 1);
      }
    }
  }

  handleCatch(item) {
    if (item.type === "Bomb") {
      // Game Over immediately or penalty
      // Let's do Game Over for now as per rules
      this.stop();
      alert("폭탄을 받았습니다! 💥\n게임 종료!");
    } else if (item.type === "Apple") {
      this.addScore(100);
    } else if (item.type === "Banana") {
      this.addScore(300); // Higher score
    }
  }

  addScore(points) {
    this.score += points;

    // Level Up every 1000 points
    if (Math.floor(this.score / 1000) + 1 > this.level) {
      this.level++;
      this.itemSpeed += 0.5; // Speed up
      this.itemInterval = Math.max(500, this.itemInterval - 100); // Faster spawn
    }

    if (this.onScoreChange) {
      this.onScoreChange(this.score, this.level);
    }
  }

  /**
   * 게임 요소 그리기
   * @param {CanvasRenderingContext2D} ctx 
   */
  draw(ctx) {
    if (!this.isGameActive) return;

    // Draw Lanes specific vars
    const laneWidth = this.canvasWidth / 3;

    // Draw Items
    this.items.forEach(item => {
      let x = this.getLaneX(item.lane, laneWidth);

      // Draw based on type
      ctx.font = "30px Arial";
      let icon = "🍎";
      if (item.type === "Banana") icon = "🍌";
      if (item.type === "Bomb") icon = "💣";

      ctx.fillText(icon, x - 15, item.y + 30);
    });

    // Draw Player (Bucket)
    let playerX = this.getLaneX(this.playerPos, laneWidth);
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; // Semi-transparent basket
    ctx.fillRect(playerX - 30, this.canvasHeight - 60, 60, 40);

    ctx.font = "30px Arial";
    ctx.fillText("🧺", playerX - 15, this.canvasHeight - 30);

    // Draw UI Overlay (Score)
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText(`Score: ${this.score}`, 10, 30);
    ctx.fillText(`Time: ${this.timeLimit}`, 10, 60);
    ctx.fillText(`Level: ${this.level}`, 10, 90);
  }

  getLaneX(lane, laneWidth) {
    if (lane === "Left") return laneWidth * 0.5;
    if (lane === "Center") return laneWidth * 1.5;
    if (lane === "Right") return laneWidth * 2.5;
    return laneWidth * 1.5;
  }

  setScoreChangeCallback(callback) {
    this.onScoreChange = callback;
  }

  setGameEndCallback(callback) {
    this.onGameEnd = callback;
  }
}

window.GameEngine = GameEngine;
