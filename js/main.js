// main.js
// 게임 초기화 및 연결 (Simplified / Fixed)

let gameEngine;
let ctx;
let currentControlMode = "KEYBOARD"; // Default & Only

// DOMContentLoaded -> Init
document.addEventListener("DOMContentLoaded", init);

// Audio System Removed

async function init() {
  gameEngine = new GameEngine();
  // Audio Removed
  // stabilizer = ... Removed

  // Audio Init Removed

  // Flip Screen Effect
  gameEngine.setReverseCallback((active) => {
    const body = document.body;
    if (active) body.classList.add("reverse-screen");
    else body.classList.remove("reverse-screen");
  });

  const canvas = document.getElementById("canvas");
  canvas.width = 600;
  canvas.height = 600;
  ctx = canvas.getContext("2d");

  setupUI();
  requestAnimationFrame(drawLoop);
}

function drawLoop() {
  if (gameEngine) {
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, 600, 600);

    if (gameEngine.isGameActive || gameEngine.isGameOver) {
      gameEngine.update(performance.now());
      gameEngine.draw(ctx);
    }
  }
  requestAnimationFrame(drawLoop);
}

function setupUI() {
  // const btnWebcam = ... Removed
  // const btnKeyboard = ... Removed
  const btnStart = document.getElementById("btn-game-start");
  const loadingText = document.getElementById("loading-text");
  // const overlay = ...

  // 1. Control Selection (Removed)

  // 2. Start Button Click
  btnStart.addEventListener("click", () => {
    // Unlock Audio removed

    // Disable button to prevent double clicks
    btnStart.disabled = true;

    // Direct Start
    startGame();
  });

  // 3. Game Inputs
  setupGameControls();

  // 4. Pause Menu & Speed Buttons
  setupPauseMenu();
  setupSpeedButton();
  // Mute Button Removed
}

/*
function setupMuteButton() {
 ...
} 
*/


function setupPauseMenu() {
  const btnContinue = document.getElementById("btn-continue");
  const btnQuit = document.getElementById("btn-quit");
  const pauseMenu = document.getElementById("pause-menu");

  btnContinue.addEventListener("click", () => {
    if (gameEngine) {
      gameEngine.togglePause();
      pauseMenu.classList.add("hidden");
    }
  });

  // Save Point UI Update
  const savePointContainer = document.getElementById("save-point-container");
  const saveList = document.getElementById("save-list");

  // Observer to update list when paused
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.target.classList.contains("hidden") === false) {
        // Menu Opened
        updateSaveList();
      }
    });
  });
  observer.observe(pauseMenu, { attributes: true, attributeFilter: ["class"] });

  function updateSaveList() {
    saveList.innerHTML = "";
    let found = false;
    for (let i = 10; i <= 200; i += 10) {
      const dataStr = sessionStorage.getItem(`ffc_save_${i}`);
      if (dataStr) {
        found = true;
        const btn = document.createElement("button");
        btn.className = "control-btn";
        btn.innerText = `Lv.${i} 로드`;
        btn.style.fontSize = "14px";
        btn.onclick = () => {
          if (confirm(`레벨 ${i}에서 다시 시작하시겠습니까?`)) {
            gameEngine.loadCheckpoint(i);
            gameEngine.togglePause(); // Unpause
            pauseMenu.classList.add("hidden");
          }
        };
        saveList.appendChild(btn);
      }
    }
    if (found) savePointContainer.style.display = "block";
    else savePointContainer.style.display = "none";

    // Active Effects List
    updateActiveEffectsList();
  }

  function updateActiveEffectsList() {
    let container = document.getElementById("active-effects-container");
    if (!container) {
      // Create if missing
      const parent = document.querySelector(".start-btn-container");
      container = document.createElement("div");
      container.id = "active-effects-container";
      container.style.marginTop = "15px";
      container.style.textAlign = "left";
      container.style.fontSize = "14px";
      container.style.color = "#ddd";
      parent.insertBefore(container, document.getElementById("btn-quit"));
    }

    if (gameEngine) {
      const effects = gameEngine.getActiveEffectDescriptions();
      if (effects.length > 0) {
        container.innerHTML = "<h4>현재 적용 중:</h4><ul>" + effects.map(e => `<li>${e}</li>`).join("") + "</ul>";
        container.style.display = "block";
      } else {
        container.style.display = "none";
      }
    }
  }

  btnQuit.addEventListener("click", () => {
    if (gameEngine) {
      gameEngine.stop(); // Triggers Game Over
      // audioSystem.stopBgm(); // Removed
      pauseMenu.classList.add("hidden");
      // Show Score / Game Over screen is automatic via gameEngine drawing
    }
  });
}

function setupSpeedButton() {
  const btnSpeed = document.getElementById("btn-speed-toggle");
  if (btnSpeed) {
    btnSpeed.addEventListener("click", () => {
      if (gameEngine && gameEngine.isGameActive) {
        gameEngine.toggleSpeedBoost();
        btnSpeed.classList.toggle("active");
      }
    });
  }
}

/* Pose Engine Removed */

function startGame() {
  const overlay = document.getElementById("game-overlay");
  const btnStart = document.getElementById("btn-game-start");
  const loadingText = document.getElementById("loading-text");

  // Hide Overlay and Reset UI items
  overlay.classList.add("hidden");
  loadingText.style.display = "none";
  btnStart.disabled = false;

  gameEngine.start({
    timeLimit: 60,
    width: 600,
    height: 600
  });

  // audioSystem.playBgm(); // BGM Removed
}

function setupGameControls() {
  const handleInputStart = () => {
    if (!gameEngine) return;
    if (gameEngine.isGameOver) {
      // Game Over -> Show Title Screen (Overlay)
      const overlay = document.getElementById("game-overlay");
      overlay.classList.remove("hidden");

      // Reset button state just in case
      const btnStart = document.getElementById("btn-game-start");
      btnStart.disabled = false;

    } else if (gameEngine.isGameActive) {
      gameEngine.setSpeedBoost(true);
    }
  };

  const handleInputEnd = () => {
    if (gameEngine) gameEngine.setSpeedBoost(false);
  };

  window.addEventListener("mousedown", handleInputStart);
  window.addEventListener("mouseup", handleInputEnd);
  window.addEventListener("touchstart", handleInputStart);
  window.addEventListener("touchend", handleInputEnd);

  window.addEventListener("keydown", (e) => {
    if (!gameEngine || !gameEngine.isGameActive) return;

    if (e.code === "Space") {
      if (!e.repeat) gameEngine.shootLaser(); // Space: Fire
    }
    if (e.code === "KeyL") {
      if (!e.repeat) gameEngine.triggerSuperBeam(); // L: Instant Super Beam
    }

    if (e.code === "KeyZ") gameEngine.triggerAnnihilate();
    if (e.code === "KeyF") {
      gameEngine.togglePause();
      const pauseMenu = document.getElementById("pause-menu");
      if (gameEngine.isPaused) pauseMenu.classList.remove("hidden");
      else pauseMenu.classList.add("hidden");
    }

    if (currentControlMode === "KEYBOARD") {
      if (e.code === "ArrowLeft") gameEngine.movePlayer("Left");
      if (e.code === "ArrowRight") gameEngine.movePlayer("Right");
      if (e.code === "ArrowDown") gameEngine.setSpeedBoost(true);
    }
  });

  window.addEventListener("keyup", (e) => {
    if (!gameEngine) return;

    if (e.code === "KeyL") {
      // gameEngine.stopCharging(); // Removed
    }

    if (currentControlMode === "KEYBOARD") {
      if (e.code === "ArrowDown") gameEngine.setSpeedBoost(false);
    }
  });
}
