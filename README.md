# ✨ Magic Hands — AR Playground

A **fun, camera-driven AR playground you control with your bare hands.** No
headset, no install, no app store — just your webcam and a browser. It tracks
your hands in real time and turns them into magic wands, bubble-poppers,
mid-air paintbrushes, and a gravity-bending force field.

Built with plain HTML/CSS/JS + [MediaPipe Hands](https://developers.google.com/mediapipe)
for on-device hand tracking. **Everything runs locally — your video never
leaves your browser.**

---

## 🎮 Modes

| Mode | What you do |
|------|-------------|
| 🪄 **Wand** | Wave your hands — every fingertip leaves a trail of colourful sparkles, and your hand gets a glowing skeleton outline. |
| 🫧 **Bubble Pop** | Floating bubbles rise up the screen; poke them with a fingertip (or **pinch** to pop bigger ones) to score points. |
| 🎨 **Air Paint** | **Pinch** thumb + index to draw glowing neon strokes in the air; release to lift the brush. The colour cycles as you draw. |
| 🌀 **Force Field** | A cloud of stars reacts to you — an **open palm pushes** them away, a **pinch pulls** them into a swirling vortex. |

### Gestures
- **Move / wave** — trails and effects follow every fingertip.
- **Pinch** (thumb + index finger together) — grab, paint, pop, and attract.
- **Open palm** — repel in Force Field mode.

Works with **one or two hands** at once.

---

## ▶️ Run it

It's a static site — no build step. You just need to serve the folder over
`http://localhost` (browsers only grant camera access on `localhost` or `https`).

**Option A — Python (already on most machines):**
```bash
cd Fun-AR-project
python3 -m http.server 8000
```
Then open <http://localhost:8000> and click **Enable Camera & Play**.

**Option B — Node:**
```bash
npx serve Fun-AR-project
```

**Option C — VS Code:** right-click `index.html` → *Open with Live Server*.

> 📷 The first time, your browser will ask for camera permission — click
> **Allow**. Good lighting and keeping your hands in frame gives the best
> tracking.

---

## 🕹️ Controls

| Control | Action |
|---------|--------|
| Mode buttons | Switch between the four modes |
| `1` `2` `3` `4` | Keyboard shortcuts for the modes |
| 🎩 / `H` | Toggle the magician top hat (on by default) |
| 🧹 / `C` | Clear the screen |
| 🪞 | Toggle mirror (selfie) view |
| ⛶ | Fullscreen |

### 🎩 Magician hat

A cute little vector magician's top hat perches, tilted, on the side of your
head — tracking your head's position, size, and tilt via
[MediaPipe Face Mesh](https://developers.google.com/mediapipe). It's **on by
default** — toggle it with the 🎩 button or the `H` key. Runs entirely
on-device like everything else.

---

## 🧠 How it works

```
webcam ──▶ MediaPipe Hands ──▶ 21 landmarks/hand ──▶ active mode ──▶ <canvas> overlay
```

- **`js/app.js`** — camera + MediaPipe setup, the render loop, and UI.
- **`js/modes.js`** — the four modes plus hand/pinch math and gesture helpers.
- **`js/particles.js`** — a small, capped particle engine (trails, bursts, stars, rings).
- **`css/style.css`** — the glassy neon HUD and splash screen.

The `<video>` and a transparent `<canvas>` are stacked; effects are drawn on
the canvas in sync with the tracked landmarks, so the magic lines up with your
real hands.

---

## 📱 Notes & tips

- Best in **Chrome/Edge** (desktop or Android). Works on iOS Safari too.
- Needs **camera access** and a reasonably modern device (hand tracking is
  GPU/CPU work).
- Requires an internet connection on first load to fetch the MediaPipe model
  from a CDN.
- No data is uploaded — the model and all processing run **on your device**.

Have fun. 🖐️✨
