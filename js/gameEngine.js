/**
 * gameEngine.js
 * "하늘에서 떨어지는 과일 받기" 게임 로직
 * - 빠른 속도, 작은 바구니
 * - 4대 파워업 (자석, 쉴드, 프리즈, 거대화)
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
    this.playerPos = "Center";
    this.items = [];
    this.lasers = []; // Keep Laser feature (Spacebar)

    // Physics
    this.lastItemTime = 0;
    this.itemSpeed = 0;
    this.itemInterval = 0;
    this.isBoosted = false;
    this.isGameOver = false;

    // Legacy PowerUp (Laser)
    this.hasLaser = false; // Renamed from hasPowerUp for clarity

    // New PowerUps States
    this.activeEffects = {
      Magnet: 0,    // Timer > 0 implies active
      Shield: false, // Boolean
      Freeze: 0,
      BigBasket: 0
    };
  }

  start(config = {}) {
    this.isGameActive = true;
    this.isGameOver = false;
    this.score = 0;
    this.level = 1;
    this.timeLimit = config.timeLimit || 60;
    this.canvasWidth = config.width || 600;
    this.canvasHeight = config.height || 600;

    this.items = [];
    this.lasers = [];
    this.playerPos = "Center";

    // Faster Settings
    this.itemSpeed = 3.5; // Start fast
    this.itemInterval = 1200; // Spawn often
    this.isBoosted = false;

    // Reset PowerUps
    this.hasLaser = false;
    this.activeEffects = {
      Magnet: 0,
      Shield: false,
      Freeze: 0,
      BigBasket: 0
    };

    if (this.timeLimit > 0) {
      this.startTimer();
    }
  }

  stop() {
    this.isGameActive = false;
    this.isGameOver = true;
    this.clearTimer();

    if (this.onGameEnd) {
      this.onGameEnd(this.score, this.level);
    }
  }

  setSpeedBoost(enabled) {
    this.isBoosted = enabled;
  }

  shootLaser() {
    if (!this.isGameActive || !this.hasLaser) return;

    const laneWidth = this.canvasWidth / 3;
    const playerX = this.getLaneX(this.playerPos, laneWidth);

    this.lasers.push({
      x: playerX,
      y: this.canvasHeight - 60,
      w: 10,
      h: 30
    });
  }

  startTimer() {
    this.clearTimer();
    this.gameTimer = setInterval(() => {
      this.timeLimit--;

      // Update PowerUp Timers (1s decrement)
      if (this.activeEffects.Magnet > 0) this.activeEffects.Magnet--;
      if (this.activeEffects.Freeze > 0) this.activeEffects.Freeze--;
      if (this.activeEffects.BigBasket > 0) this.activeEffects.BigBasket--;

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

  onPoseDetected(detectedPose) {
    if (!this.isGameActive) return;
    if (["Left", "Center", "Right"].includes(detectedPose)) {
      this.playerPos = detectedPose;
    }
  }

  // Manual Move (Keyboard)
  movePlayer(direction) {
    if (!this.isGameActive) return;

    // Left <-> Center <-> Right
    if (direction === "Left") {
      if (this.playerPos === "Right") this.playerPos = "Center";
      else if (this.playerPos === "Center") this.playerPos = "Left";
    } else if (direction === "Right") {
      if (this.playerPos === "Left") this.playerPos = "Center";
      else if (this.playerPos === "Center") this.playerPos = "Right";
    }
  }

  update(timestamp) {
    if (!this.isGameActive) return;

    // 1. Calculate Speeds
    let speedMult = 1;
    if (this.isBoosted) speedMult *= 3; // 3x Boost
    if (this.activeEffects.Freeze > 0) speedMult *= 0.5; // Freeze slows down

    const currentSpeed = this.itemSpeed * speedMult;
    const currentInterval = (this.itemInterval / speedMult); // Faster speed = shorter interval

    // 2. Spawn Items
    if (timestamp - this.lastItemTime > currentInterval) {
      this.spawnItem();
      this.lastItemTime = timestamp;
    }

    // 3. Move Items
    const laneWidth = this.canvasWidth / 3;
    const playerX = this.getLaneX(this.playerPos, laneWidth);

    this.items.forEach(item => {
      // Y Movement
      item.y += currentSpeed;

      // Magnet Logic: Pull items towards player center
      if (this.activeEffects.Magnet > 0 && item.type !== "Bomb") {
        const itemLaneX = this.getLaneX(item.lane, laneWidth);
        // Only pull if close enough (y > 100)
        if (item.y > 100 && item.y < this.canvasHeight - 100) {
          const diff = playerX - itemLaneX;
          // Visual pull (note: this separates item from lane logic slightly, purely visual/collision x logic needed)
          // For simplicity, we just change the item's internal 'x_offset' if we had one, 
          // but here our collision relies on 'lane'. 
          // Let's stick to lane logic: Magnet widens pickup range effectively.
          // *Simpler implementation*: Magnet actively sucks items into the player's lane if they are adjacent.

          if (this.areLanesAdjacent(this.playerPos, item.lane)) {
            // Move item to player's lane
            item.lane = this.playerPos;
          }
        }
      }
    });

    // 4. Move Lasers
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      this.lasers[i].y -= 15;
      if (this.lasers[i].y < -50) this.lasers.splice(i, 1);
    }

    // 5. Collision
    this.checkCollisions();
  }

  areLanesAdjacent(lane1, lane2) {
    if (lane1 === lane2) return false;
    if (lane1 === "Center") return true; // Center touches both
    if (lane2 === "Center") return true;
    return false; // Left-Right are not adjacent
  }

  spawnItem() {
    const lanes = ["Left", "Center", "Right"];
    // Shuffle
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }

    let selectedLane = null;
    for (const lane of lanes) {
      const isLaneBlocked = this.items.some(item =>
        item.lane === lane && item.y < 150
      );
      if (!isLaneBlocked) {
        selectedLane = lane;
        break;
      }
    }

    if (!selectedLane) return;

    // Type Logic
    let type = "Apple";
    const rand = Math.random();

    // PowerUps (15% chance total)
    if (rand > 0.85) {
      const pRand = Math.random();
      if (pRand < 0.25) type = "Magnet";
      else if (pRand < 0.5) type = "Shield";
      else if (pRand < 0.75) type = "Freeze";
      else type = "BigBasket";

      // Keep Laser Item rare? or merge it. Let's make "Laser" separate logic or just give it with Shield?
      // User asked for "All power ups I thought of".
      // Let's add the "Laser" granting item as super rare additional chance.
      if (!this.hasLaser && Math.random() > 0.8) {
        type = "LaserGun"; // New explicit type for Laser
      }
    } else {
      // Fruits & Bombs
      if (rand < 0.25) type = "Bomb";
      else if (rand < 0.45) type = "Banana";
      else if (rand < 0.60) type = "Grape";
      else if (rand < 0.75) type = "Orange";
      else type = "Apple"; // Watermelon, etc.
    }

    this.items.push({
      lane: selectedLane,
      type: type,
      y: -50,
      w: 40,
      h: 40
    });
  }

  checkCollisions() {
    const playerY = this.canvasHeight - 60;

    // Effective Player Width
    // Base is small (40px). Big Basket makes it large (100px)
    let playerHitWidth = 40;
    if (this.activeEffects.BigBasket > 0) playerHitWidth = 120; // Huge

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      if (item.y > this.canvasHeight) {
        this.items.splice(i, 1);
        continue;
      }

      // 1. Player Collision
      // Check Lane Alignment
      let isHit = false;

      if (this.activeEffects.BigBasket > 0) {
        // Spatial collision (Lane doesn't matter as much if huge)
        // Just check distance
        const laneWidth = this.canvasWidth / 3;
        const playerX = this.getLaneX(this.playerPos, laneWidth);
        const itemX = this.getLaneX(item.lane, laneWidth);
        if (Math.abs(playerX - itemX) < playerHitWidth / 2 + 20) { // Rough check
          if (item.y + item.h >= playerY && item.y < playerY + 50) isHit = true;
        }
      } else {
        // Standard Lane Logic
        if (item.lane === this.playerPos && item.y + item.h >= playerY && item.y < playerY + 50) {
          isHit = true;
        }
      }

      if (isHit) {
        this.handleCatch(item);
        this.items.splice(i, 1);
        continue;
      }

      // 2. Laser Collision
      for (let j = this.lasers.length - 1; j >= 0; j--) {
        const laser = this.lasers[j];
        if (this.checkRectCollision(item, laser)) {
          this.lasers.splice(j, 1);
          this.items.splice(i, 1);
          if (item.type === "Bomb") this.addScore(50);
          break;
        }
      }
    }
  }

  checkRectCollision(item, laser) {
    const laneWidth = this.canvasWidth / 3;
    const itemX = this.getLaneX(item.lane, laneWidth) - 15;
    const dist = Math.abs(itemX - (laser.x - 15));
    if (dist < 30 && item.y + item.h > laser.y && item.y < laser.y + laser.h) return true;
    return false;
  }

  handleCatch(item) {
    if (item.type === "Bomb") {
      if (this.activeEffects.Shield) {
        this.activeEffects.Shield = false; // Consume Shield
        // Sound or visual effect here
      } else {
        this.stop();
      }
    } else if (["Apple", "Banana", "Grape", "Orange"].includes(item.type)) {
      let pts = 100;
      if (item.type === "Banana") pts = 200;
      if (item.type === "Grape") pts = 150;
      if (item.type === "Orange") pts = 120;
      this.addScore(pts);
    } else {
      // PowerUps
      this.activatePowerUp(item.type);
    }
  }

  activatePowerUp(type) {
    const duration = 10; // 10 seconds

    if (type === "Magnet") this.activeEffects.Magnet = duration;
    if (type === "Shield") this.activeEffects.Shield = true;
    if (type === "Freeze") this.activeEffects.Freeze = duration;
    if (type === "BigBasket") this.activeEffects.BigBasket = duration;

    if (type === "LaserGun") this.hasLaser = true;
  }

  addScore(points) {
    this.score += points;
    // Fast leveling
    if (Math.floor(this.score / 1500) + 1 > this.level) {
      this.level++;
      this.itemSpeed += 0.5;
      this.itemInterval = Math.max(800, this.itemInterval - 100);
    }
    if (this.onScoreChange) this.onScoreChange(this.score, this.level);
  }

  draw(ctx) {
    if (this.isGameOver) {
      this.drawGameOver(ctx);
      return;
    }
    if (!this.isGameActive) return;

    const laneWidth = this.canvasWidth / 3;

    // Draw Lanes
    this.drawLanes(ctx, laneWidth);

    // Draw Lasers
    ctx.fillStyle = "#00FF00";
    this.lasers.forEach(l => ctx.fillRect(l.x - 2, l.y, 4, 30));

    // Draw Items
    this.drawItems(ctx, laneWidth);

    // Draw Player
    this.drawPlayer(ctx, laneWidth);

    // Draw Interface
    this.drawUI(ctx);
  }

  drawLanes(ctx, laneWidth) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(laneWidth * i, 0);
      ctx.lineTo(laneWidth * i, this.canvasHeight);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  drawItems(ctx, laneWidth) {
    ctx.font = "30px Arial";
    this.items.forEach(item => {
      let x = this.getLaneX(item.lane, laneWidth);
      let icon = "🍎";
      if (item.type === "Banana") icon = "🍌";
      if (item.type === "Grape") icon = "🍇";
      if (item.type === "Orange") icon = "🍊";
      if (item.type === "Bomb") icon = "💣";

      if (item.type === "Magnet") icon = "🧲";
      if (item.type === "Shield") icon = "🛡️";
      if (item.type === "Freeze") icon = "❄️";
      if (item.type === "BigBasket") icon = "🍄";
      if (item.type === "LaserGun") icon = "🔫"; // Laser Gun Item

      ctx.fillText(icon, x - 15, item.y + 30);
    });
  }

  drawPlayer(ctx, laneWidth) {
    let playerX = this.getLaneX(this.playerPos, laneWidth);
    let playerY = this.canvasHeight - 60;

    // Scale for Big Basket
    let scale = 1.0;
    if (this.activeEffects.BigBasket > 0) scale = 2.0; // BIG

    ctx.save();
    ctx.translate(playerX, playerY);
    ctx.scale(scale, scale);
    ctx.translate(-playerX, -playerY); // Pivot center? Roughly.

    // 1. Effects
    // Shield
    if (this.activeEffects.Shield) {
      ctx.beginPath();
      ctx.arc(playerX, playerY + 20, 50, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 191, 255, 0.8)"; // Deep Sky Blue
      ctx.lineWidth = 5;
      ctx.shadowColor = "#00FFFF";
      ctx.shadowBlur = 10;
      ctx.stroke();
    }

    // Laser Aura
    if (this.hasLaser) {
      ctx.beginPath();
      ctx.arc(playerX, playerY + 20, 40, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
      ctx.stroke();
    }

    // 2. Basket Visual (Smaller Base)
    // Reduce drawing size compared to previous
    const w = 25; // Half width (Total 50, prev was 70)
    const h = 30;

    ctx.fillStyle = "#8B4513";
    ctx.beginPath();
    ctx.moveTo(playerX - w + 5, playerY + h);
    ctx.lineTo(playerX + w - 5, playerY + h);
    ctx.lineTo(playerX + w, playerY);
    ctx.lineTo(playerX - w, playerY);
    ctx.closePath();
    ctx.fill();

    // Handle
    ctx.beginPath();
    ctx.arc(playerX, playerY, w, Math.PI, 0);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#8B4513";
    ctx.stroke();

    ctx.restore();
  }

  drawUI(ctx) {
    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText(`Score: ${this.score}`, 10, 30);
    ctx.fillText(`Level: ${this.level}`, 10, 60);

    // Active Effects UI
    let yPos = 100;
    const drawStatus = (text, color) => {
      ctx.fillStyle = color;
      ctx.fillText(text, 10, yPos);
      yPos += 30;
    };

    if (this.isBoosted) drawStatus("⚡ 3배속!", "#FF4500");
    if (this.activeEffects.Magnet > 0) drawStatus(`🧲 자석 (${this.activeEffects.Magnet}s)`, "#FFA500");
    if (this.activeEffects.Freeze > 0) drawStatus(`❄️ 시간동결 (${this.activeEffects.Freeze}s)`, "#00FFFF");
    if (this.activeEffects.BigBasket > 0) drawStatus(`🍄 거대화 (${this.activeEffects.BigBasket}s)`, "#FF69B4");
    if (this.activeEffects.Shield) drawStatus(`🛡️ 쉴드 ON`, "#4169E1");
    if (this.hasLaser) drawStatus(`🔫 레이저 장착`, "#00FF00");
  }

  drawGameOver(ctx) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.fillStyle = "white";
    ctx.font = "bold 50px Arial";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", this.canvasWidth / 2, this.canvasHeight / 2 - 40);

    ctx.font = "30px Arial";
    ctx.fillText(`Score: ${this.score}`, this.canvasWidth / 2, this.canvasHeight / 2 + 20);

    ctx.font = "20px Arial";
    ctx.fillStyle = "#FFD700";
    ctx.fillText("클릭하여 다시 도전!", this.canvasWidth / 2, this.canvasHeight / 2 + 80);

    ctx.textAlign = "left";
  }

  getLaneX(lane, laneWidth) {
    if (lane === "Left") return laneWidth * 0.5;
    if (lane === "Center") return laneWidth * 1.5;
    if (lane === "Right") return laneWidth * 2.5;
    return laneWidth * 1.5;
  }

  setGameEndCallback(callback) { this.onGameEnd = callback; }
  setScoreChangeCallback(callback) { this.onScoreChange = callback; }
  setCommandChangeCallback(callback) { }
}

window.GameEngine = GameEngine;
