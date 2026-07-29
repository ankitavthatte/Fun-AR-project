/* ------------------------------------------------------------------
   Cute mini magician's top hat — a vector face filter that perches,
   tilted, on the side of your head.

   Uses Face Mesh landmarks to find head width, the top of the forehead,
   and the head-tilt (roll), then draws a tiny jaunty top hat (brim +
   short rounded crown + band + a little bow & sparkle) that tracks them.
------------------------------------------------------------------- */

// object-fit: cover mapping — matches how the <video> is scaled/cropped on
// screen, so the filter lines up with the visible face.
function coverMap(vw, vh, w, h) {
  const scale = Math.max(w / vw, h / vh);
  const dw = vw * scale, dh = vh * scale;
  return { dw, dh, ox: (w - dw) / 2, oy: (h - dh) / 2 };
}

function drawHat(ctx, lms, video, w, h, mirror) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh || !lms) return;

  const m = coverMap(vw, vh, w, h);
  const mp = (i) => ({ x: m.ox + lms[i].x * m.dw, y: m.oy + lms[i].y * m.dh });

  const foreheadTop = mp(10);   // top of the face oval
  const chin = mp(152);
  const left = mp(234);         // left cheek/temple
  const right = mp(454);        // right cheek/temple

  const faceW = Math.hypot(right.x - left.x, right.y - left.y);
  if (!faceW) return;

  // Head "up" direction (chin -> forehead) and "side" direction (across cheeks).
  let ux = foreheadTop.x - chin.x, uy = foreheadTop.y - chin.y;
  const ulen = Math.hypot(ux, uy) || 1; ux /= ulen; uy /= ulen;
  const sx = (right.x - left.x) / faceW, sy = (right.y - left.y) / faceW;

  // Perch the little hat above the forehead and off to one side.
  const anchorX = foreheadTop.x + ux * faceW * 0.30 + sx * faceW * 0.30;
  const anchorY = foreheadTop.y + uy * faceW * 0.30 + sy * faceW * 0.30;

  // Roll of the head + a jaunty extra tilt so it sits at a cute angle.
  const roll = Math.atan2(right.y - left.y, right.x - left.x);
  const jaunty = -0.38; // ~ -22°

  ctx.save();
  if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
  ctx.translate(anchorX, anchorY);
  ctx.rotate(roll + jaunty);

  // --- proportions: small & rounded (relative to face width) ---
  const brimRx = faceW * 0.34;
  const brimRy = faceW * 0.075;
  const crownH = faceW * 0.34;   // short crown = cute
  const baseHalf = faceW * 0.15;
  const topHalf = faceW * 0.17;  // gentle flare

  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = faceW * 0.06;
  ctx.shadowOffsetY = faceW * 0.025;

  // --- brim (ellipse) ---
  const brimGrad = ctx.createLinearGradient(0, -brimRy, 0, brimRy);
  brimGrad.addColorStop(0, '#2a2a33');
  brimGrad.addColorStop(0.5, '#0c0c12');
  brimGrad.addColorStop(1, '#1a1a22');
  ctx.fillStyle = brimGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, brimRx, brimRy, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // --- crown (gently flared quad) ---
  const crownGrad = ctx.createLinearGradient(-topHalf, 0, topHalf, 0);
  crownGrad.addColorStop(0, '#050507');
  crownGrad.addColorStop(0.5, '#2a2a33');
  crownGrad.addColorStop(0.55, '#30303a');
  crownGrad.addColorStop(1, '#050507');
  ctx.fillStyle = crownGrad;
  ctx.beginPath();
  ctx.moveTo(-baseHalf, 0);
  ctx.lineTo(-topHalf, -crownH);
  ctx.lineTo(topHalf, -crownH);
  ctx.lineTo(baseHalf, 0);
  ctx.closePath();
  ctx.fill();

  // crown base ellipse (rounds where it meets the brim)
  ctx.beginPath();
  ctx.ellipse(0, 0, baseHalf, faceW * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();

  // top cap ellipse (rounded top surface)
  ctx.fillStyle = '#1f1f28';
  ctx.beginPath();
  ctx.ellipse(0, -crownH, topHalf, faceW * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- coloured band near the base ---
  const bandTop = -crownH * 0.34;
  const bandBot = -crownH * 0.08;
  const bandGrad = ctx.createLinearGradient(0, bandTop, 0, bandBot);
  bandGrad.addColorStop(0, '#9a78ff');
  bandGrad.addColorStop(1, '#6a44e0');
  ctx.fillStyle = bandGrad;
  const wTop = baseHalf + (topHalf - baseHalf) * 0.34;
  const wBot = baseHalf + (topHalf - baseHalf) * 0.08;
  ctx.beginPath();
  ctx.moveTo(-wBot, bandBot);
  ctx.lineTo(-wTop, bandTop);
  ctx.lineTo(wTop, bandTop);
  ctx.lineTo(wBot, bandBot);
  ctx.closePath();
  ctx.fill();

  // --- cute little bow on the band + a sparkle ---
  const bandMidY = (bandTop + bandBot) / 2;
  drawBow(ctx, 0, bandMidY, faceW * 0.11, '#ff8fd0');
  drawStar(ctx, topHalf * 0.7, -crownH * 0.86, faceW * 0.06, faceW * 0.025, 4, '#ffe07a');

  ctx.restore();
}

function drawBow(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = size * 0.4;
  const wing = size, hh = size * 0.62;
  // left triangle wing
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-wing, -hh);
  ctx.lineTo(-wing, hh);
  ctx.closePath();
  ctx.fill();
  // right triangle wing
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(wing, -hh);
  ctx.lineTo(wing, hh);
  ctx.closePath();
  ctx.fill();
  // knot
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ff6fbf';
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStar(ctx, cx, cy, outer, inner, points, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = outer;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
