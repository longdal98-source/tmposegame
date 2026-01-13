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

async function init() {
  gameEngine = new GameEngine();
  stabilizer = new PredictionStabilizer({ threshold: 0.7, smoothingFrames: 3 });

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
