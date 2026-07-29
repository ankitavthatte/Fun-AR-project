/* ------------------------------------------------------------------
   Magician's top hat — a vector face filter that rides on your head.

   Uses Face Mesh landmarks to find head width, the top of the forehead,
   and the head-tilt (roll), then draws a classic magician top hat
   (brim + crown + band + a little sparkle) that tracks all three.
------------------------------------------------------------------- */

// coverMap() is shared from beauty.js (same global scope).

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

  // Head "up" direction (chin -> forehead) to lift the hat above the hairline.
  let ux = foreheadTop.x - chin.x, uy = foreheadTop.y - chin.y;
  const ulen = Math.hypot(ux, uy) || 1;
  ux /= ulen; uy /= ulen;

  const anchorX = foreheadTop.x + ux * faceW * 0.42;
  const anchorY = foreheadTop.y + uy * faceW * 0.42;

  // Roll: tilt of the line across the cheeks.
  const roll = Math.atan2(right.y - left.y, right.x - left.x);

  ctx.save();
  if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
  ctx.translate(anchorX, anchorY);
  ctx.rotate(roll);

  // --- proportions (all relative to face width) ---
  const brimRx = faceW * 0.92;
  const brimRy = faceW * 0.17;
  const crownH = faceW * 1.02;
  const baseHalf = faceW * 0.34;   // crown width at the brim
  const topHalf = faceW * 0.38;    // crown width at the top (classic flare)

  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = faceW * 0.12;
  ctx.shadowOffsetY = faceW * 0.05;

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

  // --- crown (flared quad + rounded top) ---
  const crownGrad = ctx.createLinearGradient(-topHalf, 0, topHalf, 0);
  crownGrad.addColorStop(0, '#050507');
  crownGrad.addColorStop(0.5, '#26262e');
  crownGrad.addColorStop(0.55, '#2c2c35');
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
  ctx.ellipse(0, 0, baseHalf, faceW * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();

  // top cap ellipse (slightly lighter to read as the top surface)
  ctx.fillStyle = '#1c1c24';
  ctx.beginPath();
  ctx.ellipse(0, -crownH, topHalf, faceW * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();

  // sheen stripe down the crown
  const sheen = ctx.createLinearGradient(-topHalf * 0.5, 0, topHalf * 0.1, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.16)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.moveTo(-baseHalf, 0);
  ctx.lineTo(-topHalf, -crownH);
  ctx.lineTo(topHalf, -crownH);
  ctx.lineTo(baseHalf, 0);
  ctx.closePath();
  ctx.fill();

  // --- coloured band near the base (magician purple) ---
  const bandTop = -crownH * 0.20;
  const bandBot = -crownH * 0.05;
  const bandGrad = ctx.createLinearGradient(0, bandTop, 0, bandBot);
  bandGrad.addColorStop(0, '#8f6bff');
  bandGrad.addColorStop(1, '#5a34d6');
  ctx.fillStyle = bandGrad;
  ctx.beginPath();
  // follow the crown's slight flare across the band
  const wTop = baseHalf + (topHalf - baseHalf) * 0.20;
  const wBot = baseHalf + (topHalf - baseHalf) * 0.05;
  ctx.moveTo(-wBot, bandBot);
  ctx.lineTo(-wTop, bandTop);
  ctx.lineTo(wTop, bandTop);
  ctx.lineTo(wBot, bandBot);
  ctx.closePath();
  ctx.fill();

  // --- a golden sparkle on the band ---
  drawStar(ctx, baseHalf * 0.45, (bandTop + bandBot) / 2, faceW * 0.09, faceW * 0.04, 4, '#ffe07a');

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
