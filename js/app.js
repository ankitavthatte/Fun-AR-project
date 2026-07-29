/* ------------------------------------------------------------------
   Magic Hands — app bootstrap.
   Wires the webcam + MediaPipe Hands into a canvas render loop and
   dispatches every frame to the active mode.
------------------------------------------------------------------- */
(() => {
  const video = document.getElementById('video');
  const overlay = document.getElementById('overlay');
  const ctx = overlay.getContext('2d');

  const splash = document.getElementById('splash');
  const hud = document.getElementById('hud');
  const startBtn = document.getElementById('startBtn');
  const loadStatus = document.getElementById('loadStatus');
  const scoreEl = document.getElementById('score');
  const scoreBox = document.getElementById('scoreBox');
  const modeHint = document.getElementById('modeHint');

  // Persistent layer for Air Paint (kept between frames).
  const paintCanvas = document.createElement('canvas');
  const pctx = paintCanvas.getContext('2d');

  const particles = new ParticleSystem(950);

  const state = {
    hands: [],           // array of 21-landmark arrays
    face: null,          // 468 face-mesh landmarks (or null)
    mirror: true,
    hat: true,           // magician hat on by default
    modeName: 'wand',
    mode: MODES.wand(),
    score: 0,
    running: false,
  };

  /* ---------- canvas sizing ---------- */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [overlay, paintCanvas]) {
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.matchMedia('(pointer: coarse)').matches);

  const W = () => overlay.width / (Math.min(window.devicePixelRatio || 1, 2));
  const H = () => overlay.height / (Math.min(window.devicePixelRatio || 1, 2));

  /* ---------- scoring ---------- */
  function addScore(n) {
    state.score += n;
    scoreEl.textContent = state.score;
    scoreBox.classList.remove('pop');
    void scoreBox.offsetWidth; // restart animation
    scoreBox.classList.add('pop');
  }

  /* ---------- mode switching ---------- */
  function setMode(name) {
    if (!MODES[name]) return;
    state.modeName = name;
    state.mode = MODES[name]();
    document.querySelectorAll('.mode-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.mode === name));

    const env = baseEnv();
    state.mode.enter?.(env);

    // score box only for scoring modes
    scoreBox.classList.toggle('hidden-soft', !state.mode.usesScore);
    if (state.mode.usesScore) { state.score = 0; scoreEl.textContent = '0'; }

    // clear the paint layer when leaving/entering
    pctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);

    showHint(state.mode.hint);
  }

  let hintTimer = null;
  function showHint(text) {
    modeHint.textContent = text;
    modeHint.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => modeHint.classList.remove('show'), 3200);
  }

  function baseEnv() {
    return {
      ctx, pctx, particles,
      w: W(), h: H(),
      hands: state.hands,
      mirror: state.mirror,
      addScore,
      now: performance.now(),
    };
  }

  /* ---------- render loop ---------- */
  function frame() {
    if (!state.running) return;
    const w = W(), h = H();

    // Clear the overlay every frame so the live camera shows through.
    // (Effect trails come from the particles' own fade, not a dark wash —
    // a full-canvas translucent fill would accumulate and hide the video.)
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);

    // Face filters sit under the effects, over the live video.
    if (state.face && state.hat) {
      drawHat(ctx, state.face, video, w, h, state.mirror);
    }

    // blit persistent paint layer (paint mode)
    if (state.modeName === 'paint') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(paintCanvas, 0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }

    state.mode.update(baseEnv());
    particles.update(ctx);

    requestAnimationFrame(frame);
  }

  /* ---------- MediaPipe wiring ---------- */
  let hands = null;
  let faceMesh = null;
  let camera = null;

  function onHandResults(results) {
    state.hands = results.multiHandLandmarks || [];
  }
  function onFaceResults(results) {
    const faces = results.multiFaceLandmarks;
    state.face = (faces && faces.length) ? faces[0] : null;
  }

  async function initTracking() {
    loadStatus.textContent = 'Loading hand-tracking model…';
    hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
    });
    hands.setOptions({
      maxNumHands: 2,
      // Lighter model on phones keeps tracking smooth; full model on desktop.
      modelComplexity: isMobile ? 0 : 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });
    hands.onResults(onHandResults);

    // Face Mesh powers the magician-hat filter. Optional: if it fails to load
    // the app still runs (just without the hat).
    if (typeof FaceMesh !== 'undefined') {
      loadStatus.textContent = 'Loading face model…';
      faceMesh = new FaceMesh({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      faceMesh.onResults(onFaceResults);
    }

    // Alternate the two models across frames on mobile to protect the frame
    // rate; run both every frame on desktop.
    let tick = 0;
    camera = new Camera(video, {
      onFrame: async () => {
        tick++;
        await hands.send({ image: video });
        if (faceMesh && state.hat && (!isMobile || tick % 2 === 0)) {
          await faceMesh.send({ image: video });
        }
      },
      // Front-facing camera + a lighter capture size on mobile.
      facingMode: 'user',
      width: isMobile ? 640 : 1280,
      height: isMobile ? 480 : 720,
    });
    await camera.start();
  }

  /* ---------- start ---------- */
  async function start() {
    startBtn.disabled = true;
    loadStatus.textContent = 'Requesting camera…';
    try {
      if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
        throw new Error('Hand-tracking library failed to load. Check your connection and reload.');
      }
      await initTracking();
      state.running = true;
      splash.classList.add('hidden');
      hud.classList.remove('hidden');
      setMode('wand');
      requestAnimationFrame(frame);
      setTimeout(() => (splash.style.display = 'none'), 600);
    } catch (err) {
      console.error(err);
      startBtn.disabled = false;
      loadStatus.textContent =
        (err && err.name === 'NotAllowedError')
          ? '⚠️ Camera permission denied. Allow access and try again.'
          : `⚠️ ${err.message || 'Could not start. Try reloading.'}`;
    }
  }

  /* ---------- UI events ---------- */
  startBtn.addEventListener('click', start);

  document.getElementById('modeSwitch').addEventListener('click', (e) => {
    const btn = e.target.closest('.mode-btn');
    if (btn) setMode(btn.dataset.mode);
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    particles.clear();
    pctx.clearRect(0, 0, paintCanvas.width, paintCanvas.height);
    ctx.clearRect(0, 0, W(), H());
    if (state.mode.usesScore) { state.score = 0; scoreEl.textContent = '0'; }
    state.mode.enter?.(baseEnv());
  });

  const mirrorBtn = document.getElementById('mirrorBtn');
  mirrorBtn.addEventListener('click', () => {
    state.mirror = !state.mirror;
    video.classList.toggle('no-mirror', !state.mirror);
    mirrorBtn.classList.toggle('active', state.mirror);
  });

  const hatBtn = document.getElementById('hatBtn');
  hatBtn.addEventListener('click', () => {
    state.hat = !state.hat;
    hatBtn.classList.toggle('active', state.hat);
    showHint(state.hat ? '🎩 Magician hat on' : 'Magician hat off');
  });

  document.getElementById('fsBtn').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  });

  // keyboard shortcuts: 1-4 switch modes, C clears
  window.addEventListener('keydown', (e) => {
    const map = { '1': 'wand', '2': 'bubbles', '3': 'paint', '4': 'force' };
    if (map[e.key]) setMode(map[e.key]);
    if (e.key.toLowerCase() === 'c') document.getElementById('clearBtn').click();
    if (e.key.toLowerCase() === 'h') hatBtn.click();
  });
})();
