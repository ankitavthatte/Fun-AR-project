/* ------------------------------------------------------------------
   Lightweight particle system used by every mode.
   Particles are pooled-ish (just capped) to stay smooth on phones.
------------------------------------------------------------------- */
class Particle {
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    const a = opts.angle ?? Math.random() * Math.PI * 2;
    const spd = opts.speed ?? Math.random() * 2 + 0.5;
    this.vx = (opts.vx ?? Math.cos(a) * spd);
    this.vy = (opts.vy ?? Math.sin(a) * spd);
    this.gravity = opts.gravity ?? 0;
    this.friction = opts.friction ?? 0.96;
    this.size = opts.size ?? Math.random() * 4 + 2;
    this.decay = opts.decay ?? Math.random() * 0.02 + 0.012;
    this.life = 1;
    this.hue = opts.hue ?? Math.random() * 360;
    this.sat = opts.sat ?? 90;
    this.light = opts.light ?? 62;
    this.shape = opts.shape ?? 'circle'; // 'circle' | 'star' | 'ring'
    this.spin = Math.random() * 0.3 - 0.15;
    this.rot = Math.random() * Math.PI;
  }

  update() {
    this.vx *= this.friction;
    this.vy *= this.friction;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.rot += this.spin;
    this.life -= this.decay;
    return this.life > 0;
  }

  draw(ctx) {
    const alpha = Math.max(this.life, 0);
    ctx.globalAlpha = alpha;
    const color = `hsl(${this.hue}, ${this.sat}%, ${this.light}%)`;
    ctx.fillStyle = color;
    ctx.shadowBlur = 16;
    ctx.shadowColor = color;

    if (this.shape === 'star') {
      this._star(ctx, this.x, this.y, this.size * 1.6, this.size * 0.7, 5);
    } else if (this.shape === 'ring') {
      ctx.globalAlpha = alpha * 0.9;
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * (2 - this.life), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * (0.6 + alpha * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _star(ctx, cx, cy, outer, inner, points) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rot);
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (Math.PI / points) * i;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

class ParticleSystem {
  constructor(max = 900) {
    this.particles = [];
    this.max = max;
  }

  emit(x, y, count, opts = {}) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.max) break;
      this.particles.push(new Particle(x, y, opts));
    }
  }

  burst(x, y, count, hue) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.max) break;
      this.particles.push(new Particle(x, y, {
        speed: Math.random() * 7 + 2,
        size: Math.random() * 5 + 2,
        gravity: 0.12,
        friction: 0.93,
        hue: hue + (Math.random() * 50 - 25),
        shape: Math.random() < 0.35 ? 'star' : 'circle',
        decay: Math.random() * 0.02 + 0.01,
      }));
    }
    // a couple of expanding shock rings
    for (let i = 0; i < 2; i++) {
      this.particles.push(new Particle(x, y, {
        vx: 0, vy: 0, friction: 1, size: 8 + i * 6,
        hue, decay: 0.05, shape: 'ring',
      }));
    }
  }

  update(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p.update()) {
        this.particles.splice(i, 1);
      } else {
        p.draw(ctx);
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  clear() { this.particles.length = 0; }
  get count() { return this.particles.length; }
}
