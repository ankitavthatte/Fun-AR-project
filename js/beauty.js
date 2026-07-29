/* ------------------------------------------------------------------
   Smooth-skin ("beauty") filter.

   Uses MediaPipe Face Mesh landmarks to build a mask of the facial skin
   (the face oval minus the eyes and mouth), then blends a blurred copy of
   the video within that mask over the live feed. Partial opacity keeps
   real skin texture and edges, so it reads as "smoothed" rather than
   "blurred". Eyes and lips are cut out so they stay crisp.
------------------------------------------------------------------- */

// Ordered landmark rings (indices into Face Mesh's 468-point model).
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
  379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
  234, 127, 162, 21, 54, 103, 67, 109,
];
const LEFT_EYE = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
const RIGHT_EYE = [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382];
const LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];

// object-fit: cover mapping — matches how the <video> is scaled/cropped on
// screen, so the mask lines up with the visible face.
function coverMap(vw, vh, w, h) {
  const scale = Math.max(w / vw, h / vh);
  const dw = vw * scale, dh = vh * scale;
  return { dw, dh, ox: (w - dw) / 2, oy: (h - dh) / 2 };
}

function addRing(path, lms, indices, m, inset, cx, cy) {
  indices.forEach((idx, i) => {
    const lm = lms[idx];
    let x = m.ox + lm.x * m.dw;
    let y = m.oy + lm.y * m.dh;
    if (inset !== 1) { x = cx + (x - cx) * inset; y = cy + (y - cy) * inset; }
    if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
  });
  path.closePath();
}

/**
 * Draw the smooth-skin pass onto ctx (which sits above the <video>).
 * @param strength 0..1 — how aggressive the smoothing is.
 */
function drawBeauty(ctx, lms, video, w, h, mirror, strength = 0.8) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh || !lms) return;

  const m = coverMap(vw, vh, w, h);

  // Centroid of the face oval, used to inset the outer ring slightly so the
  // blur stays on skin and doesn't smear the background at the jaw/forehead.
  let cx = 0, cy = 0;
  for (const idx of FACE_OVAL) { cx += m.ox + lms[idx].x * m.dw; cy += m.oy + lms[idx].y * m.dh; }
  cx /= FACE_OVAL.length; cy /= FACE_OVAL.length;

  const mask = new Path2D();
  addRing(mask, lms, FACE_OVAL, m, 0.96, cx, cy); // outer skin (inset a touch)
  addRing(mask, lms, LEFT_EYE, m, 1, cx, cy);     // holes: keep eyes sharp
  addRing(mask, lms, RIGHT_EYE, m, 1, cx, cy);
  addRing(mask, lms, LIPS, m, 1, cx, cy);          // hole: keep lips sharp

  ctx.save();
  // Mirror the drawing to match the (CSS-mirrored) selfie video.
  if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }

  ctx.clip(mask, 'evenodd');
  const blur = (3 + strength * 6);
  ctx.filter = `blur(${blur.toFixed(1)}px) brightness(${(1 + strength * 0.05).toFixed(3)}) saturate(1.03)`;
  ctx.globalAlpha = 0.5 + strength * 0.35;         // blend with the sharp original beneath
  ctx.drawImage(video, m.ox, m.oy, m.dw, m.dh);

  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.restore();
}
