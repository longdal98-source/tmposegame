/**
 * main.js
 * 게임 초기화 및 연결 (Simplified / Fixed)
 */

let poseEngine, gameEngine, stabilizer;
let ctx;
let currentControlMode = "WEBCAM";
let isPoseInitialized = false;

// DOMContentLoaded -> Init
document.addEventListener("DOMContentLoaded", init);

// Audio System
const audioSystem = {
  bgm: new Audio("sounds/bgm.mp3"),
  isMuted: false,

  init() {
    this.bgm.loop = true;
    this.bgm.volume = 0.5;
  },

  playBgm() {
    if (this.isMuted) return;
    this.bgm.play().catch(e => console.log("Audio play failed (user interaction needed):", e));
  },

  stopBgm() {
    this.bgm.pause();
    this.bgm.currentTime = 0;
  },

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.bgm.muted = this.isMuted;
    return this.isMuted;
  }
};

async function init() {
  gameEngine = new GameEngine();
  stabilizer = new PredictionStabilizer({ threshold: 0.7, smoothingFrames: 3 });

  audioSystem.init(); // Init Audio

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
  const btnWebcam = document.getElementById("btn-webcam");
  const btnKeyboard = document.getElementById("btn-keyboard");
  const btnStart = document.getElementById("btn-game-start");
  const loadingText = document.getElementById("loading-text");
  const overlay = document.getElementById("game-overlay");

  // 1. Control Selection
  btnWebcam.addEventListener("click", () => {
    currentControlMode = "WEBCAM";
    btnWebcam.classList.add("selected");
    btnKeyboard.classList.remove("selected");
  });

  btnKeyboard.addEventListener("click", () => {
    currentControlMode = "KEYBOARD";
    btnKeyboard.classList.add("selected");
    btnWebcam.classList.remove("selected");
  });

  // 2. Start Button Click
  btnStart.addEventListener("click", async () => {
    // Disable button to prevent double clicks
    btnStart.disabled = true;

    if (currentControlMode === "WEBCAM") {
      loadingText.style.display = "block";
      try {
        await initPoseEngine(); // Wait for camera
        startGame();
      } catch (e) {
        console.error(e);
        alert("카메라 실행 실패! 권한을 허용해주세요.");
        loadingText.style.display = "none";
        btnStart.disabled = false;
      }
    } else {
      // Keyboard Mode
      startGame();
    }
  });

  // 3. Game Inputs
  setupGameControls();

  // 4. Pause Menu & Speed Buttons
  setupPauseMenu();
  setupSpeedButton();
  setupMuteButton();
}

function setupMuteButton() {
  const btnMute = document.getElementById("btn-mute-toggle");
  if (btnMute) {
    btnMute.addEventListener("click", () => {
      const isMuted = audioSystem.toggleMute();
      btnMute.innerText = isMuted ? "🔇 Muted" : "🔊 Sound ON";
      btnMute.classList.toggle("muted", isMuted);
    });
  }
}


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
  }

  btnQuit.addEventListener("click", () => {
    if (gameEngine) {
      gameEngine.stop(); // Triggers Game Over
      audioSystem.stopBgm(); // Stop Music
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

async function initPoseEngine() {
  if (isPoseInitialized) return;

  const loadingText = document.getElementById("loading-text");

  try {
    loadingText.innerText = "로컬 AI 모델(my_model) 로딩 중...";
    poseEngine = new PoseEngine("./my_model/");

    loadingText.innerText = "카메라 권한 요청 중...";
    const { webcam } = await poseEngine.init({ size: 200, flip: true });

    loadingText.innerText = "화면 구성 중...";
    const container = document.getElementById("webcam-container");
    if (container && webcam) {
      container.innerHTML = "";
      container.appendChild(webcam.canvas);
    }

    poseEngine.setPredictionCallback(handlePrediction);
    poseEngine.start();
    isPoseInitialized = true;

  } catch (err) {
    console.error(err);
    alert("오류 발생: " + err.message + "\n(카메라 권한을 확인하거나, 로컬 서버에서 실행 중인지 확인하세요.)");
    throw err;
  }
}

function handlePrediction(prediction) {
  if (currentControlMode !== "WEBCAM" || !gameEngine.isGameActive) return;

  if (prediction) {
    const stablePose = stabilizer.update(prediction);
    gameEngine.onPoseDetected(stablePose.className);

    // Debug text if needed
    const label = document.getElementById("max-prediction");
    if (label) label.innerText = stablePose.className;
  }
}

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

  audioSystem.playBgm(); // Start Music
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

    if (e.code === "Space") gameEngine.shootLaser();
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
    if (currentControlMode === "KEYBOARD") {
      if (e.code === "ArrowDown") gameEngine.setSpeedBoost(false);
    }
  });
}
