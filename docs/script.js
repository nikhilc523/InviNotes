/* ══════════════════════════════════════════
   InviNotes Landing — Three.js + GSAP
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Demo toggle (Your screen / Their screen share) ──
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  const inviWindow = document.getElementById('invi-window');
  const labelYours = document.getElementById('demo-label-yours');
  const labelTheirs = document.getElementById('demo-label-theirs');

  toggleBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const view = btn.dataset.view;
      if (view === 'theirs') {
        inviWindow.classList.add('hidden-view');
        labelYours.classList.add('hidden');
        labelTheirs.classList.add('visible');
      } else {
        inviWindow.classList.remove('hidden-view');
        labelYours.classList.remove('hidden');
        labelTheirs.classList.remove('visible');
      }
    });
  });

  // ── Unified laptop demo with cursor behavior ──
  const lnotes = document.getElementById('lnotes');
  const desktop = document.getElementById('laptop-desktop');
  const ctBadge = document.getElementById('lnotes-ct-badge');
  const toast = document.getElementById('lbg-toast');
  const kbdPill = document.getElementById('kbd-pill');
  const blockedIndicator = document.getElementById('blocked-indicator');
  const demoCursor = document.getElementById('demo-cursor');
  const cursorStatus = document.getElementById('cursor-status');
  const opacitySlider = document.getElementById('try-opacity');
  const modeNormal = document.getElementById('tryit-mode-normal');
  const modeCT = document.getElementById('tryit-mode-ct');
  let isClickThrough = false;
  let cursorAnimTimer = null;

  function showToast(text, dur) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.remove('hidden');
    toast.style.animation = 'none'; toast.offsetHeight; toast.style.animation = '';
    setTimeout(() => toast.classList.add('hidden'), dur || 1400);
  }

  function showCursor() { if (demoCursor) { demoCursor.classList.remove('hidden'); demoCursor.classList.remove('text-mode'); } }
  function hideCursor() { if (demoCursor) demoCursor.classList.add('hidden'); }

  function showStatus(text, type) {
    if (!cursorStatus) return;
    cursorStatus.classList.remove('hidden', 'status-bad', 'status-good');
    cursorStatus.classList.add(type === 'bad' ? 'status-bad' : 'status-good');
    cursorStatus.querySelector('.cursor-status-text').textContent = text;
  }
  function hideStatus() { if (cursorStatus) cursorStatus.classList.add('hidden'); }

  // ── Cursor animation loop — shows cursor behavior for current mode ──
  function startCursorDemo() {
    stopCursorDemo();
    if (!demoCursor || !desktop) return;
    showCursor();
    let frame = 0;

    // Find Run button position relative to desktop
    const runBtn = document.querySelector('#laptop-desktop .lbg-btn[data-name="Run"]');

    function clickEffect() {
      demoCursor.classList.add('clicking');
      setTimeout(() => demoCursor.classList.remove('clicking'), 400);
    }

    function stepNormal() {
      // Click-through OFF: 2-frame loop — pointer on code, text cursor on window
      const overCode = frame % 2 === 0;
      if (overCode) {
        demoCursor.style.left = '20%';
        demoCursor.style.top = '50%';
        demoCursor.classList.remove('text-mode');
        showStatus('Pointer cursor over code — normal', 'good');
      } else {
        demoCursor.style.left = '72%';
        demoCursor.style.top = '35%';
        demoCursor.classList.add('text-mode');
        showStatus('Cursor changes to text — reveals hidden window!', 'bad');
      }
      frame++;
      cursorAnimTimer = setTimeout(stepNormal, 1800);
    }

    function stepClickThrough() {
      // Click-through ON: 4-frame loop
      // 0: pointer on code
      // 1: pointer moves over window (stays pointer)
      // 2: cursor moves to Run button (behind the window), clicks it
      // 3: pause showing toast
      const phase = frame % 4;

      if (phase === 0) {
        demoCursor.style.left = '20%';
        demoCursor.style.top = '50%';
        demoCursor.classList.remove('text-mode');
        showStatus('Pointer over code — normal', 'good');
        frame++;
        cursorAnimTimer = setTimeout(stepClickThrough, 1400);
      } else if (phase === 1) {
        // Move over window — cursor stays as pointer
        demoCursor.style.left = '72%';
        demoCursor.style.top = '35%';
        demoCursor.classList.remove('text-mode');
        showStatus('Cursor stays pointer over window — undetectable', 'good');
        frame++;
        cursorAnimTimer = setTimeout(stepClickThrough, 1400);
      } else if (phase === 2) {
        // Move to Run button position and click through the window
        if (runBtn) {
          const b = runBtn.getBoundingClientRect();
          const d = desktop.getBoundingClientRect();
          demoCursor.style.left = (b.left - d.left + b.width / 2) + 'px';
          demoCursor.style.top = (b.top - d.top + b.height / 2) + 'px';
        } else {
          demoCursor.style.left = '18%';
          demoCursor.style.top = '12%';
        }
        showStatus('Click passes through the window to the button behind', 'good');
        // Click after cursor arrives
        setTimeout(() => {
          clickEffect();
          if (runBtn) {
            runBtn.classList.add('clicked');
            setTimeout(() => runBtn.classList.remove('clicked'), 500);
          }
          showToast('Run clicked through InviNotes!', 1400);
        }, 950);
        frame++;
        cursorAnimTimer = setTimeout(stepClickThrough, 2600);
      } else {
        // Brief pause then restart
        demoCursor.style.left = '20%';
        demoCursor.style.top = '50%';
        showStatus('Clicks pass right through — apps work normally', 'good');
        frame++;
        cursorAnimTimer = setTimeout(stepClickThrough, 1400);
      }
    }

    if (isClickThrough) {
      stepClickThrough();
    } else {
      stepNormal();
    }
  }

  function stopCursorDemo() {
    if (cursorAnimTimer) { clearTimeout(cursorAnimTimer); cursorAnimTimer = null; }
  }

  // ── Mode switching ──
  function setMode(ct) {
    isClickThrough = ct;

    // Update buttons
    modeNormal.classList.toggle('active', !ct);
    modeCT.classList.toggle('active', ct);

    // Update window appearance
    lnotes.classList.toggle('clickthrough', ct);
    if (ctBadge) ctBadge.classList.toggle('hidden', !ct);
    if (ct) {
      lnotes.style.opacity = '0.35';
      if (opacitySlider) opacitySlider.value = 35;
    } else {
      lnotes.style.opacity = '0.95';
      if (opacitySlider) opacitySlider.value = 95;
    }

    // Restart cursor animation with new mode
    startCursorDemo();
  }

  if (modeNormal) {
    modeNormal.addEventListener('click', () => setMode(false));
  }
  if (modeCT) {
    modeCT.addEventListener('click', () => setMode(true));
  }

  // Opacity slider
  if (opacitySlider) {
    opacitySlider.oninput = () => {
      if (lnotes) lnotes.style.opacity = opacitySlider.value / 100;
    };
  }

  // Background button clicks (only work in click-through mode)
  document.querySelectorAll('.lbg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!isClickThrough) return;
      btn.classList.add('clicked');
      setTimeout(() => btn.classList.remove('clicked'), 400);
      showToast(btn.dataset.name + ' clicked through InviNotes!');
    });
  });

  // Dragging
  (function initDrag() {
    let dragging = false, sx, sy, nx, ny;
    const handle = document.getElementById('lnotes-drag-handle');
    if (!handle || !lnotes || !desktop) return;
    handle.onmousedown = (e) => {
      if (isClickThrough) return;
      e.preventDefault();
      dragging = true;
      const r = lnotes.getBoundingClientRect(), d = desktop.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY;
      nx = r.left - d.left; ny = r.top - d.top;
      lnotes.style.right = 'auto';
      lnotes.style.left = nx + 'px';
      lnotes.style.top = ny + 'px';
    };
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const d = desktop.getBoundingClientRect();
      let x = nx + e.clientX - sx, y = ny + e.clientY - sy;
      x = Math.max(0, Math.min(x, d.width - lnotes.offsetWidth));
      y = Math.max(0, Math.min(y, d.height - lnotes.offsetHeight));
      lnotes.style.left = x + 'px';
      lnotes.style.top = y + 'px';
    });
    window.addEventListener('mouseup', () => { dragging = false; });
  })();

  // Start cursor demo when section scrolls into view
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.create({
      trigger: '#try-it',
      start: 'top 65%',
      once: true,
      onEnter: () => startCursorDemo(),
    });
  }

  // ══════════════════════════════════════════
  // ── KEYBOARD SHORTCUTS — LAPTOP + MENU ──
  // ══════════════════════════════════════════
  const kbWin = document.getElementById('kb-win');
  const kbMenuItems = document.querySelectorAll('.kb-menu-item');
  const kbActionLabel = document.getElementById('kb-action-label');
  const kbCtBadge = document.getElementById('kb-ct-badge');
  const kbAllKeys = document.querySelectorAll('#kb-keyboard .kb-key[data-key]');

  let kbAnimTimer = null;
  let kbAnimFrame = 0;

  function showKbLabel(text) {
    if (!kbActionLabel) return;
    kbActionLabel.innerHTML = text;
    kbActionLabel.classList.add('visible');
  }
  function hideKbLabel() {
    if (kbActionLabel) kbActionLabel.classList.remove('visible');
  }
  function clearKbHighlights() {
    kbAllKeys.forEach((k) => k.classList.remove('highlight'));
  }
  function highlightKeys(keys) {
    clearKbHighlights();
    keys.forEach((key) => {
      const el = document.querySelector('#kb-keyboard .kb-key[data-key="' + key + '"]');
      if (el) el.classList.add('highlight');
    });
  }

  function resetKbWin() {
    if (!kbWin) return;
    kbWin.style.right = '16px';
    kbWin.style.top = '8px';
    kbWin.style.left = 'auto';
    kbWin.style.bottom = 'auto';
    kbWin.style.opacity = '0.95';
    kbWin.style.width = '';
    kbWin.style.maxWidth = '';
    kbWin.style.transform = '';
    kbWin.classList.remove('kb-hidden', 'kb-clickthrough');
    if (kbCtBadge) kbCtBadge.classList.add('hidden');
    hideKbLabel();
  }

  // ── Animation: Show / Hide ──
  function animateToggle() {
    kbAnimFrame = 0;
    function step() {
      highlightKeys(['lcmd', 'lshift', 'N']);
      if (kbAnimFrame % 2 === 0) {
        kbWin.classList.add('kb-hidden');
        showKbLabel('&#8984; &#8679; N &mdash; Hidden');
      } else {
        kbWin.classList.remove('kb-hidden');
        showKbLabel('&#8984; &#8679; N &mdash; Visible');
      }
      kbAnimFrame++;
      kbAnimTimer = setTimeout(step, 1300);
    }
    step();
  }

  // ── Animation: Click-through ──
  function animateClickthrough() {
    kbAnimFrame = 0;
    function step() {
      highlightKeys(['lcmd', 'lshift', 'M']);
      if (kbAnimFrame % 2 === 0) {
        kbWin.classList.add('kb-clickthrough');
        kbWin.style.opacity = '0.5';
        if (kbCtBadge) kbCtBadge.classList.remove('hidden');
        showKbLabel('Click-through ON &mdash; clicks pass through');
      } else {
        kbWin.classList.remove('kb-clickthrough');
        kbWin.style.opacity = '0.95';
        if (kbCtBadge) kbCtBadge.classList.add('hidden');
        showKbLabel('Click-through OFF &mdash; window blocks clicks');
      }
      kbAnimFrame++;
      kbAnimTimer = setTimeout(step, 1500);
    }
    step();
  }

  // ── Animation: Move ──
  function animateMove() {
    const positions = [
      { right: 'auto', left: '8px', top: '8px', keys: ['lctrl', 'lalt', 'left'], label: '&#8592; Move left' },
      { right: 'auto', left: '8px', top: '55%', keys: ['lctrl', 'lalt', 'down'], label: '&#8595; Move down' },
      { right: '16px', left: 'auto', top: '55%', keys: ['lctrl', 'lalt', 'right'], label: '&#8594; Move right' },
      { right: '16px', left: 'auto', top: '8px', keys: ['lctrl', 'lalt', 'up'], label: '&#8593; Move up' },
    ];
    kbAnimFrame = 0;
    function step() {
      const p = positions[kbAnimFrame % positions.length];
      highlightKeys(p.keys);
      kbWin.style.right = p.right;
      kbWin.style.left = p.left;
      kbWin.style.top = p.top;
      kbWin.style.bottom = 'auto';
      showKbLabel('&#8963; &#8997; Arrow &mdash; ' + p.label);
      kbAnimFrame++;
      kbAnimTimer = setTimeout(step, 1000);
    }
    step();
  }

  // ── Animation: Resize ──
  function animateResize() {
    kbAnimFrame = 0;
    function step() {
      if (kbAnimFrame % 2 === 0) {
        highlightKeys(['lcmd', 'lshift', 'equal']);
        kbWin.style.width = '55%';
        kbWin.style.maxWidth = '320px';
        showKbLabel('&#8984; &#8679; = &mdash; Larger');
      } else {
        highlightKeys(['lcmd', 'lshift', 'minus']);
        kbWin.style.width = '30%';
        kbWin.style.maxWidth = '180px';
        showKbLabel('&#8984; &#8679; &minus; &mdash; Smaller');
      }
      kbAnimFrame++;
      kbAnimTimer = setTimeout(step, 1300);
    }
    step();
  }

  // ── Animation: Opacity ──
  function animateOpacity() {
    kbAnimFrame = 0;
    const levels = [
      { o: '0.25', keys: ['lcmd', 'lshift', 'lbracket'], label: '25%' },
      { o: '0.50', keys: ['lcmd', 'lshift', 'rbracket'], label: '50%' },
      { o: '0.75', keys: ['lcmd', 'lshift', 'rbracket'], label: '75%' },
      { o: '1',    keys: ['lcmd', 'lshift', 'rbracket'], label: '100%' },
      { o: '0.50', keys: ['lcmd', 'lshift', 'lbracket'], label: '50%' },
    ];
    function step() {
      const l = levels[kbAnimFrame % levels.length];
      highlightKeys(l.keys);
      kbWin.style.opacity = l.o;
      showKbLabel('&#8984; &#8679; [ ] &mdash; Opacity ' + l.label);
      kbAnimFrame++;
      kbAnimTimer = setTimeout(step, 1000);
    }
    step();
  }

  // ── Animation: Snap ──
  function animateSnap() {
    const snaps = [
      { right: 'auto', left: '2px', top: '2px', bottom: 'auto', tf: '', keys: ['lctrl', 'lalt', 'lshift', 'up'], label: 'Top-left' },
      { right: '2px', left: 'auto', top: '2px', bottom: 'auto', tf: '', keys: ['lctrl', 'lalt', 'lshift', 'right'], label: 'Top-right' },
      { right: '2px', left: 'auto', top: 'auto', bottom: '2px', tf: '', keys: ['lctrl', 'lalt', 'lshift', 'down'], label: 'Bottom-right' },
      { right: 'auto', left: '2px', top: 'auto', bottom: '2px', tf: '', keys: ['lctrl', 'lalt', 'lshift', 'left'], label: 'Bottom-left' },
      { right: 'auto', left: '50%', top: '50%', bottom: 'auto', tf: 'translate(-50%, -50%)', keys: ['lctrl', 'lalt', 'lshift', 'C'], label: 'Center' },
    ];
    kbAnimFrame = 0;
    function step() {
      const s = snaps[kbAnimFrame % snaps.length];
      highlightKeys(s.keys);
      kbWin.style.right = s.right;
      kbWin.style.left = s.left;
      kbWin.style.top = s.top;
      kbWin.style.bottom = s.bottom;
      kbWin.style.transform = s.tf;
      showKbLabel('Snap &mdash; ' + s.label);
      kbAnimFrame++;
      kbAnimTimer = setTimeout(step, 1100);
    }
    step();
  }

  const kbAnimators = {
    toggle: animateToggle,
    clickthrough: animateClickthrough,
    move: animateMove,
    resize: animateResize,
    opacity: animateOpacity,
    snap: animateSnap,
  };

  function activateShortcut(action) {
    if (kbAnimTimer) { clearTimeout(kbAnimTimer); kbAnimTimer = null; }
    resetKbWin();
    clearKbHighlights();

    kbMenuItems.forEach((btn) => btn.classList.toggle('active', btn.dataset.action === action));

    if (kbAnimators[action]) kbAnimators[action]();
  }

  kbMenuItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      activateShortcut(btn.dataset.action);
    });
  });

  // Start animation when section scrolls into view
  if (kbWin) {
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.create({
        trigger: '#shortcuts',
        start: 'top 70%',
        once: true,
        onEnter: () => activateShortcut('toggle'),
      });
    } else {
      activateShortcut('toggle');
    }
  }

  // ══════════════════════════════════════════
  // ── THREE.JS IMMERSIVE HERO ──
  // ══════════════════════════════════════════
  const canvas = document.getElementById('hero-canvas');
  const iconWrapper = document.getElementById('hero-icon-wrapper');
  const iconContainer = document.getElementById('hero-icon-container');
  if (!canvas || typeof THREE === 'undefined') return;

  const isMobile = window.innerWidth < 768;

  // ── Mouse state ──
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

  window.addEventListener('mousemove', (e) => {
    mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.targetY = (e.clientY / window.innerHeight) * 2 - 1;
  });

  // ── 3D Icon tilt (CSS transform driven by mouse) ──
  function updateIconTilt() {
    if (!iconContainer) return;
    // Smooth lerp
    mouse.x += (mouse.targetX - mouse.x) * 0.08;
    mouse.y += (mouse.targetY - mouse.y) * 0.08;

    const tiltX = mouse.y * -12; // pitch
    const tiltY = mouse.x * 15;  // yaw
    const translateZ = 20;

    iconContainer.style.transform =
      `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(${translateZ}px)`;

    requestAnimationFrame(updateIconTilt);
  }
  if (!isMobile) {
    requestAnimationFrame(updateIconTilt);
  }

  // ── Renderer ──
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 8);

  // ── Lighting ──
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(3, 5, 4);
  scene.add(dirLight);
  const rimLight = new THREE.DirectionalLight(0x2383e2, 0.4);
  rimLight.position.set(-3, -2, -2);
  scene.add(rimLight);

  // Glow is handled by CSS (.hero-icon-glow) — no Three.js glow objects needed

  // ── Orbiting particles ──
  const particleCount = isMobile ? 120 : 350;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3); // orbit data
  const sizes = new Float32Array(particleCount);
  const baseOpacities = new Float32Array(particleCount);

  for (let i = 0; i < particleCount; i++) {
    // Distribute in a shell around center
    const r = 1.5 + Math.random() * 5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Store orbit speed & direction
    velocities[i * 3] = (Math.random() - 0.5) * 0.02;     // orbital speed X
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01; // drift Y
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02; // orbital speed Z

    sizes[i] = 0.02 + Math.random() * 0.06;
    baseOpacities[i] = 0.2 + Math.random() * 0.6;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // Circle texture for soft particles
  const pCanvas = document.createElement('canvas');
  pCanvas.width = 64;
  pCanvas.height = 64;
  const pCtx = pCanvas.getContext('2d');
  const grad = pCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  pCtx.fillStyle = grad;
  pCtx.fillRect(0, 0, 64, 64);

  const particleMat = new THREE.PointsMaterial({
    size: 0.06,
    map: new THREE.CanvasTexture(pCanvas),
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const sparkles = new THREE.Points(particleGeo, particleMat);
  scene.add(sparkles);

  // ── Accent ring particles (inner orbit) ──
  const ringCount = isMobile ? 40 : 100;
  const ringGeo = new THREE.BufferGeometry();
  const ringPos = new Float32Array(ringCount * 3);

  for (let i = 0; i < ringCount; i++) {
    const angle = (i / ringCount) * Math.PI * 2;
    const r = 2 + Math.random() * 0.5;
    ringPos[i * 3] = Math.cos(angle) * r + (Math.random() - 0.5) * 0.3;
    ringPos[i * 3 + 1] = (Math.random() - 0.5) * 0.4 + 0.5;
    ringPos[i * 3 + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * 0.3;
  }
  ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));

  const ringMat = new THREE.PointsMaterial({
    size: 0.04,
    map: new THREE.CanvasTexture(pCanvas),
    transparent: true,
    opacity: 0.4,
    color: 0x4a9eed,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const ringParticles = new THREE.Points(ringGeo, ringMat);
  scene.add(ringParticles);

  // ── Animation loop ──
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Rotate sparkle cloud slowly, with mouse influence
    sparkles.rotation.y = t * 0.04 + mouse.x * 0.3;
    sparkles.rotation.x = Math.sin(t * 0.02) * 0.08 + mouse.y * 0.15;

    // Orbit ring
    ringParticles.rotation.y = t * 0.15;
    ringParticles.rotation.x = 0.3 + Math.sin(t * 0.1) * 0.05;

    // CSS glow follows mouse via icon wrapper — no Three.js glow to update

    // Animate individual particle positions for organic drift
    const posAttr = sparkles.geometry.attributes.position;
    for (let i = 0; i < particleCount; i++) {
      const ix = i * 3;
      posAttr.array[ix] += velocities[ix] * Math.sin(t + i);
      posAttr.array[ix + 1] += velocities[ix + 1] * Math.cos(t * 0.7 + i);
      posAttr.array[ix + 2] += velocities[ix + 2] * Math.sin(t * 0.5 + i * 0.5);

      // Keep particles within bounds — gently pull back
      const dx = posAttr.array[ix];
      const dy = posAttr.array[ix + 1];
      const dz = posAttr.array[ix + 2];
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > 6) {
        posAttr.array[ix] *= 0.999;
        posAttr.array[ix + 1] *= 0.999;
        posAttr.array[ix + 2] *= 0.999;
      }
      if (dist < 1.2) {
        posAttr.array[ix] *= 1.001;
        posAttr.array[ix + 1] *= 1.001;
        posAttr.array[ix + 2] *= 1.001;
      }
    }
    posAttr.needsUpdate = true;

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ── GSAP scroll animations ──
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    // Hero parallax — move icon and content up on scroll
    gsap.to('.hero-icon-wrapper', {
      scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true },
      y: -60, opacity: 0,
    });
    gsap.to('.hero-content', {
      scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true },
      y: -80, opacity: 0,
    });

    // Section heading reveals
    document.querySelectorAll('#demo, #try-it, #shortcuts, #features, #how-it-works, #download').forEach((section) => {
      gsap.from(section.querySelector('h2'), {
        scrollTrigger: { trigger: section, start: 'top 82%' },
        opacity: 0, y: 30, duration: 0.7, ease: 'power3.out',
      });
      const desc = section.querySelector('.section-desc');
      if (desc) {
        gsap.from(desc, {
          scrollTrigger: { trigger: section, start: 'top 80%' },
          opacity: 0, y: 25, duration: 0.7, delay: 0.1, ease: 'power3.out',
        });
      }
    });

    // Demo scene
    gsap.from('.desktop-scene', {
      scrollTrigger: { trigger: '#demo', start: 'top 70%' },
      opacity: 0, y: 40, scale: 0.97, duration: 0.9, ease: 'power3.out',
    });

    gsap.from('.demo-toggle', {
      scrollTrigger: { trigger: '#demo', start: 'top 78%' },
      opacity: 0, y: 20, duration: 0.6, ease: 'power2.out',
    });

    // Mode toolbar reveal
    gsap.from('.tryit-modes', {
      scrollTrigger: { trigger: '#try-it', start: 'top 80%' },
      opacity: 0, y: 15, duration: 0.5, ease: 'power2.out',
    });

    // Laptop reveal
    gsap.from('.laptop', {
      scrollTrigger: { trigger: '#try-it', start: 'top 75%' },
      opacity: 0, y: 50, scale: 0.95, duration: 0.9, ease: 'power3.out',
    });

    // Keyboard shortcuts section reveals
    gsap.from('.kb-laptop', {
      scrollTrigger: { trigger: '#shortcuts', start: 'top 75%' },
      opacity: 0, y: 40, scale: 0.96, duration: 0.8, ease: 'power3.out',
    });
    gsap.from('.kb-menu', {
      scrollTrigger: { trigger: '#shortcuts', start: 'top 75%' },
      opacity: 0, x: 30, duration: 0.7, delay: 0.15, ease: 'power3.out',
    });
    gsap.from('.kb-keyboard', {
      scrollTrigger: { trigger: '#shortcuts', start: 'top 55%' },
      opacity: 0, y: 30, scale: 0.97, duration: 0.8, ease: 'power3.out',
    });

    // Feature cards stagger
    gsap.from('.feature-card', {
      scrollTrigger: { trigger: '#features', start: 'top 75%' },
      opacity: 0, y: 30, stagger: 0.1, duration: 0.6, ease: 'power2.out',
    });

    // Steps stagger
    gsap.from('.step', {
      scrollTrigger: { trigger: '#how-it-works', start: 'top 75%' },
      opacity: 0, y: 25, stagger: 0.15, duration: 0.6, ease: 'power2.out',
    });

    gsap.from('.step-line', {
      scrollTrigger: { trigger: '#how-it-works', start: 'top 75%' },
      opacity: 0, scaleX: 0, stagger: 0.15, duration: 0.4, delay: 0.2, ease: 'power2.out',
    });

    // Download CTA
    gsap.from('#download .download-btn', {
      scrollTrigger: { trigger: '#download', start: 'top 80%' },
      opacity: 0, y: 20, scale: 0.95, duration: 0.6, delay: 0.15, ease: 'power3.out',
    });
  } else {
    // Fallback: IntersectionObserver
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.style.opacity = '1';
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('section:not(#hero)').forEach((s) => {
      s.style.opacity = '0';
      s.style.transition = 'opacity 0.8s';
      observer.observe(s);
    });
  }
})();
