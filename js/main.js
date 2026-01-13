/**
 * main.js
 * 게임 초기화 및 연결
 * 수정: 카메라 늦게 켜기, 조작 방식 선택 후 시작
 */

let poseEngine, gameEngine, stabilizer;
let ctx;
let currentControlMode = null; // "WEBCAM" or "KEYBOARD" (null initially)
let isPoseInitialized = false;

async function init() {
  // 1. GameEngine & Stabilizer 초기화 (미리 준비)
  gameEngine = new GameEngine();
  stabilizer = new PredictionStabilizer({
    threshold: 0.7,
    smoothingFrames: 3
  });

  // 2. Canvas Setup
  const canvas = document.getElementById("canvas");
  canvas.width = 600;
  canvas.height = 600;
  ctx = canvas.getContext("2d");

  // 3. UI Setup (Overlay & Buttons)
  setupUI();

  // 4. Start Render Loop (Always running to show game over screen, etc)
  requestAnimationFrame(drawLoop);
}

// 렌더링 루프
function drawLoop() {
  if (gameEngine) {
    // 배경 지우기
    ctx.fillStyle = "#333";
    ctx.fillRect(0, 0, 600, 600); // clear canvas

    // 게임 상태가 Active거나 GameOver일 때만 그리기
    if (gameEngine.isGameActive || gameEngine.isGameOver) {
      gameEngine.update(performance.now());
      gameEngine.draw(ctx);
    }
  }
  requestAnimationFrame(drawLoop);
}

// UI 이벤트 설정
function setupUI() {
  const overlay = document.getElementById("game-overlay");
  const btnWebcam = document.getElementById("btn-webcam");
  const btnKeyboard = document.getElementById("btn-keyboard");
  const startPrompt = document.querySelector(".start-prompt");

  // 초기 상태: 선택 안됨
  btnWebcam.classList.remove("selected");
  btnKeyboard.classList.remove("selected");

  // A. 카메라 버튼 클릭
  btnWebcam.addEventListener("click", async (e) => {
    e.stopPropagation();

    // 이미 키보드 모드였다면?
    currentControlMode = "WEBCAM";
    updateButtonStyles();

    // 카메라 초기화 (아직 안 했다면)
    if (!isPoseInitialized) {
      btnWebcam.innerText = "⏳ 로딩 중...";
      btnWebcam.disabled = true;
      try {
        await initPoseEngine();
        btnWebcam.innerText = "📷 카메라 (Pose)";
        btnWebcam.disabled = false;
        alert("카메라가 켜졌습니다! 몸을 움직여보세요.");
      } catch (err) {
        console.error(err);
        btnWebcam.innerText = "❌ 오류 발생";
        alert("카메라를 켤 수 없습니다.");
        currentControlMode = null;
        updateButtonStyles();
      }
    }
  });

  // B. 키보드 버튼 클릭
  btnKeyboard.addEventListener("click", (e) => {
    e.stopPropagation();
    currentControlMode = "KEYBOARD";
    updateButtonStyles();
    // 키보드는 별도 초기화 필요 없음
  });

  // C. 시작 클릭 (Overlay의 start-prompt 클릭 시)
  startPrompt.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevent bubbling if needed

    if (!currentControlMode) {
      alert("조작 방식을 선택해주세요!");
      return;
    }

    if (!gameEngine.isGameActive) {
      startGame();
    }
  });

  // Also allow clicking anywhere on overlay background if not on buttons
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      if (!currentControlMode) return;
      startGame();
    }
  });

  function updateButtonStyles() {
    if (currentControlMode === "WEBCAM") {
      btnWebcam.classList.add("selected");
      btnKeyboard.classList.remove("selected");
    } else if (currentControlMode === "KEYBOARD") {
      btnKeyboard.classList.add("selected");
      btnWebcam.classList.remove("selected");
    } else {
      btnWebcam.classList.remove("selected");
      btnKeyboard.classList.remove("selected");
    }
  }

  // D. 인게임 조작 이벤트 (마우스/터치/키보드)
  setupGameControls();
}

// PoseEngine 초기화 (카메라 모드 선택 시 호출)
async function initPoseEngine() {
  if (isPoseInitialized) return;

  poseEngine = new PoseEngine("./my_model/");
  const { maxPredictions, webcam } = await poseEngine.init({
    size: 200,
    flip: true
  });

  // 웹캠 캔버스 붙이기 (숨겨진 컨테이너에)
  const webcamContainer = document.getElementById("webcam-container");
  if (webcam && webcamContainer) {
    webcamContainer.innerHTML = ""; // 기존 내용 클리어
    webcamContainer.appendChild(webcam.canvas);
    // 라벨 등 다시 추가 필요하면 여기서.. 하지만 index.html에 틀이 있어서 appendChild만 해도 됨
  }

  // 예측 콜백 연결
  poseEngine.setPredictionCallback(handlePrediction);
  poseEngine.start();

  isPoseInitialized = true;
}

// 포즈 예측 처리
function handlePrediction(prediction) {
  // 웹캠 모드일 때만 동작
  if (currentControlMode !== "WEBCAM") return;
  if (!gameEngine || !gameEngine.isGameActive) return;

  if (prediction) {
    const stablePose = stabilizer.update(prediction);
    const poseName = stablePose.className;
    gameEngine.onPoseDetected(poseName);

    // 디버그용 텍스트 (숨겨져 있을 수 있음)
    const labelContainer = document.getElementById("max-prediction");
    if (labelContainer) {
      labelContainer.innerText = poseName;
    }
  }
}

// 인게임 컨트롤 설정
function setupGameControls() {
  // Mouse: Boost / Restart
  const handleInputStart = () => {
    if (gameEngine) {
      if (gameEngine.isGameOver) {
        // 게임 오버 상태에서 클릭하면 재시작
        startGame();
      } else if (gameEngine.isGameActive) {
        gameEngine.setSpeedBoost(true);
      }
    }
  };
  const handleInputEnd = () => {
    if (gameEngine) gameEngine.setSpeedBoost(false);
  };

  window.addEventListener("mousedown", handleInputStart);
  window.addEventListener("mouseup", handleInputEnd);
  window.addEventListener("touchstart", handleInputStart);
  window.addEventListener("touchend", handleInputEnd);

  // Keyboard
  window.addEventListener("keydown", (e) => {
    if (!gameEngine || !gameEngine.isGameActive) return;

    // Spacebar: Laser
    if (e.code === "Space") {
      gameEngine.shootLaser();
    }

    // Arrow Keys: Movement (If Keyboard Mode)
    if (currentControlMode === "KEYBOARD") {
      if (e.code === "ArrowLeft") gameEngine.movePlayer("Left");
      if (e.code === "ArrowRight") gameEngine.movePlayer("Right");

      // 키보드 모드에서도 아래키로 부스트 가능하게 할까? (마우스 클릭과 동일 기능)
      if (e.code === "ArrowDown") gameEngine.setSpeedBoost(true);
    }
  });

  window.addEventListener("keyup", (e) => {
    if (currentControlMode === "KEYBOARD") {
      if (e.code === "ArrowDown") gameEngine.setSpeedBoost(false);
    }
  });
}

// 게임 시작 실행
function startGame() {
  const overlay = document.getElementById("game-overlay");
  overlay.classList.add("hidden");

  // GameEngine 시작
  gameEngine.start({
    timeLimit: 60,
    width: 600,
    height: 600
  });
}

// 앱 시작
init();
