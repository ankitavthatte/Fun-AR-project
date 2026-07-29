/* ------------------------------------------------------------------
   Hand landmark helpers + the four interactive modes.

   MediaPipe Hands returns 21 normalized landmarks per hand.
   Key indices:  0 wrist · 4 thumb-tip · 8 index-tip · 12 middle-tip
                 16 ring-tip · 20 pinky-tip
------------------------------------------------------------------- */
const TIPS = [4, 8, 12, 16, 20];

// Convert a normalized landmark to canvas pixels, honoring the mirror.
function toPx(lm, w, h, mirror) {
  return { x: (mirror ? 1 - lm.x : lm.x) * w, y: lm.y * h };
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// Pinch strength 0..1 (1 = fully closed). Normalized by hand span so it
// works at any distance from the camera.
function pinchInfo(hand, w, h, mirror) {
  const thumb = toPx(hand[4], w, h, mirror);
  const index = toPx(hand[8], w, h, mirror);
  const span = dist(toPx(hand[0], w, h, mirror), toPx(hand[12], w, h, mirror)) || 1;
  const d = dist(thumb, index);
  const strength = 1 - Math.min(d / (span * 0.6), 1);
  return {
    strength,
    isPinching: strength > 0.55,
    point: { x: (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2 },
  };
}

/* ================================================================
   MODE 1 — WAND: fingertips trail colourful sparkles.
================================================================ */
function makeWand() {
  let t = 0;
  return {
    name: 'wand',
    hint: '🪄 Move your hands — every fingertip is a magic wand',
    usesScore: false,
    update(env) {
      t += 1;
      const { hands, particles, w, h, mirror } = env;
      for (const hand of hands) {
        const baseHue = (t * 2) % 360;
        TIPS.forEach((idx, i) => {
          const p = toPx(hand[idx], w, h, mirror);
          const emphasis = idx === 8 ? 4 : 2; // index finger sparkles more
          particles.emit(p.x, p.y, emphasis, {
            speed: Math.random() * 1.4,
            size: Math.random() * 3 + 1.5,
            hue: (baseHue + i * 40) % 360,
            friction: 0.9,
            gravity: -0.02,
            shape: Math.random() < 0.15 ? 'star' : 'circle',
            decay: 0.03,
          });
        });
        drawHandGlow(env, hand, baseHue);
      }
    },
  };
}

/* ================================================================
   MODE 2 — BUBBLE POP: catch floating bubbles for points.
================================================================ */
function makeBubbles() {
  let bubbles = [];
  let spawnTimer = 0;
  const COLORS = [180, 200, 280, 320, 140, 40];

  function spawn(w, h) {
    const r = Math.random() * 26 + 26;
    bubbles.push({
      x: Math.random() * (w - r * 2) + r,
      y: h + r,
      r,
      vy: -(Math.random() * 1.1 + 0.7),
      wob: Math.random() * Math.PI * 2,
      hue: COLORS[(Math.random() * COLORS.length) | 0],
    });
  }

  return {
    name: 'bubbles',
    hint: '🫧 Pop the bubbles with your fingertips! (pinch pops bigger)',
    usesScore: true,
    enter() { bubbles = []; spawnTimer = 0; },
    update(env) {
      const { ctx, hands, particles, w, h, mirror, addScore } = env;

      spawnTimer -= 1;
      if (spawnTimer <= 0 && bubbles.length < 14) {
        spawn(w, h);
        spawnTimer = 34 + Math.random() * 30;
      }

      // Gather all fingertip points + pinch points across hands.
      const pokers = [];
      for (const hand of hands) {
        for (const idx of TIPS) pokers.push({ ...toPx(hand[idx], w, h, mirror), power: 1 });
        const pinch = pinchInfo(hand, w, h, mirror);
        if (pinch.isPinching) pokers.push({ ...pinch.point, power: 2 });
      }

      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.wob += 0.05;
        b.y += b.vy;
        b.x += Math.sin(b.wob) * 0.6;

        // off the top → gone (no penalty, keeps it chill)
        if (b.y + b.r < -10) { bubbles.splice(i, 1); continue; }

        // collision with any fingertip
        let popped = false;
        for (const pk of pokers) {
          if (Math.hypot(pk.x - b.x, pk.y - b.y) < b.r + 14 * pk.power) { popped = true; break; }
        }
        if (popped) {
          particles.burst(b.x, b.y, 26, b.hue);
          addScore(Math.round(b.r / 8));
          bubbles.splice(i, 1);
          continue;
        }
        drawBubble(ctx, b);
      }
    },
  };
}

function drawBubble(ctx, b) {
  ctx.save();
  const g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r);
  g.addColorStop(0, `hsla(${b.hue}, 90%, 85%, 0.9)`);
  g.addColorStop(0.7, `hsla(${b.hue}, 90%, 60%, 0.28)`);
  g.addColorStop(1, `hsla(${b.hue}, 90%, 55%, 0.08)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `hsla(${b.hue}, 90%, 85%, 0.7)`;
  ctx.lineWidth = 2;
  ctx.stroke();
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(b.x - b.r * 0.32, b.y - b.r * 0.34, b.r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ================================================================
   MODE 3 — AIR PAINT: pinch to draw glowing strokes.
================================================================ */
function makePaint() {
  const last = new Map(); // hand index -> last point
  let hue = 0;
  return {
    name: 'paint',
    hint: '🎨 Pinch thumb + index to paint · release to lift the brush',
    usesScore: false,
    enter() { last.clear(); },
    update(env) {
      const { ctx, hands, particles, w, h, mirror, pctx } = env;
      hue = (hue + 1.5) % 360;
      const active = new Set();

      hands.forEach((hand, hi) => {
        const pinch = pinchInfo(hand, w, h, mirror);
        const cursor = toPx(hand[8], w, h, mirror);

        if (pinch.isPinching) {
          active.add(hi);
          const prev = last.get(hi) || pinch.point;
          // draw onto the persistent paint layer
          pctx.strokeStyle = `hsl(${hue}, 90%, 60%)`;
          pctx.lineWidth = 6 + pinch.strength * 10;
          pctx.lineCap = 'round';
          pctx.lineJoin = 'round';
          pctx.shadowBlur = 18;
          pctx.shadowColor = `hsl(${hue}, 90%, 60%)`;
          pctx.beginPath();
          pctx.moveTo(prev.x, prev.y);
          pctx.lineTo(pinch.point.x, pinch.point.y);
          pctx.stroke();
          last.set(hi, pinch.point);
          particles.emit(pinch.point.x, pinch.point.y, 2, { hue, size: 2, decay: 0.05 });
        } else {
          last.delete(hi);
        }
        drawCursor(ctx, cursor, pinch.isPinching, hue);
      });

      // drop cursors for hands that vanished
      for (const key of [...last.keys()]) if (!active.has(key)) last.delete(key);
    },
  };
}

function drawCursor(ctx, p, active, hue) {
  ctx.save();
  ctx.strokeStyle = `hsl(${hue}, 90%, 65%)`;
  ctx.lineWidth = active ? 4 : 2;
  ctx.shadowBlur = 14;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.beginPath();
  ctx.arc(p.x, p.y, active ? 10 : 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* ================================================================
   MODE 4 — FORCE FIELD: a cloud of dots reacts to your hands.
   Open hand pushes them away; pinch pulls them into a vortex.
================================================================ */
function makeForce() {
  let dots = [];
  function seed(w, h) {
    dots = [];
    const n = 260;
    for (let i = 0; i < n; i++) {
      dots.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: 0, vy: 0,
        hue: Math.random() * 60 + 190,
        size: Math.random() * 2.5 + 1.5,
      });
    }
  }
  return {
    name: 'force',
    hint: '🌀 Open palm pushes the stars away · pinch to pull them in',
    usesScore: false,
    enter(env) { seed(env.w, env.h); },
    update(env) {
      const { ctx, hands, w, h, mirror } = env;
      if (dots.length === 0) seed(w, h);

      const attractors = [];
      const repellers = [];
      for (const hand of hands) {
        const palm = toPx(hand[0], w, h, mirror);
        const pinch = pinchInfo(hand, w, h, mirror);
        if (pinch.isPinching) attractors.push(pinch.point);
        else repellers.push(palm);
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const d of dots) {
        for (const a of attractors) {
          const dx = a.x - d.x, dy = a.y - d.y;
          const dd = Math.hypot(dx, dy) + 0.01;
          const f = Math.min(180 / dd, 1.4);
          d.vx += (dx / dd) * f;
          d.vy += (dy / dd) * f;
          // swirl
          d.vx += (-dy / dd) * f * 0.6;
          d.vy += (dx / dd) * f * 0.6;
        }
        for (const r of repellers) {
          const dx = d.x - r.x, dy = d.y - r.y;
          const dd = Math.hypot(dx, dy) + 0.01;
          if (dd < 220) {
            const f = (1 - dd / 220) * 3.2;
            d.vx += (dx / dd) * f;
            d.vy += (dy / dd) * f;
          }
        }
        d.vx *= 0.92; d.vy *= 0.92;
        d.x += d.vx; d.y += d.vy;

        // wrap around edges
        if (d.x < 0) d.x += w; else if (d.x > w) d.x -= w;
        if (d.y < 0) d.y += h; else if (d.y > h) d.y -= h;

        const speed = Math.hypot(d.vx, d.vy);
        const light = Math.min(55 + speed * 8, 85);
        ctx.fillStyle = `hsl(${d.hue}, 90%, ${light}%)`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size + speed * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  };
}

/* ---- shared: soft glowing outline around a detected hand ---- */
function drawHandGlow(env, hand, hue) {
  const { ctx, w, h, mirror } = env;
  const CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],[0,17],
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `hsla(${hue}, 90%, 65%, 0.35)`;
  ctx.lineWidth = 3;
  ctx.shadowBlur = 12;
  ctx.shadowColor = `hsl(${hue}, 90%, 65%)`;
  ctx.beginPath();
  for (const [a, b] of CONNECTIONS) {
    const p1 = toPx(hand[a], w, h, mirror);
    const p2 = toPx(hand[b], w, h, mirror);
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
  }
  ctx.stroke();
  ctx.restore();
}

const MODES = {
  wand: makeWand,
  bubbles: makeBubbles,
  paint: makePaint,
  force: makeForce,
};
