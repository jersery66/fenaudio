class ParticleSystem {
  constructor() {
    this.canvas = document.getElementById('particle-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.mouse = { x: -1000, y: -1000 };
    this.isPlaying = false;
    this.audioLevel = 0;
    this.resize();
    this.init();
    this.bindEvents();
    this.animate();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  init() {
    const area = window.innerWidth * window.innerHeight;
    const count = Math.min(50, Math.floor(area / 25000));
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle());
    }
  }

  createParticle(x, y) {
    const type = Math.random();
    let hue, sat, light;
    if (type < 0.5) {
      hue = 250 + Math.random() * 20;
      sat = 60 + Math.random() * 20;
      light = 60 + Math.random() * 15;
    } else if (type < 0.8) {
      hue = 170 + Math.random() * 15;
      sat = 50 + Math.random() * 20;
      light = 55 + Math.random() * 15;
    } else {
      hue = 330 + Math.random() * 20;
      sat = 50 + Math.random() * 20;
      light = 60 + Math.random() * 15;
    }

    return {
      x: x ?? Math.random() * this.canvas.width,
      y: y ?? Math.random() * this.canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 1.5 + 0.5,
      baseRadius: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.4 + 0.1,
      baseOpacity: Math.random() * 0.4 + 0.1,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.008 + Math.random() * 0.015,
      hue,
      sat,
      light,
    };
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.resize();
      this.init();
    });

    document.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;

      const glow = document.getElementById('cursor-glow');
      if (glow) {
        glow.style.left = e.clientX + 'px';
        glow.style.top = e.clientY + 'px';
      }

      const dot = document.getElementById('cursor-dot');
      if (dot) {
        dot.style.left = e.clientX + 'px';
        dot.style.top = e.clientY + 'px';
      }

      const ring = document.getElementById('cursor-ring');
      if (ring) {
        ring.style.left = e.clientX + 'px';
        ring.style.top = e.clientY + 'px';
      }
    });

    document.addEventListener('mouseleave', () => {
      this.mouse.x = -1000;
      this.mouse.y = -1000;
    });
  }

  setPlaying(playing) {
    this.isPlaying = playing;
  }

  setAudioLevel(level) {
    this.audioLevel = level;
  }

  animate() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const speed = this.isPlaying ? 1.5 : 0.8;
    const audioBoost = 1 + this.audioLevel * 1.5;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      p.pulse += p.pulseSpeed * speed;
      p.radius = p.baseRadius * (1 + Math.sin(p.pulse) * 0.2) * audioBoost;
      p.opacity = p.baseOpacity * (0.7 + Math.sin(p.pulse) * 0.3);

      p.x += p.vx * speed;
      p.y += p.vy * speed;

      const dx = this.mouse.x - p.x;
      const dy = this.mouse.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        const force = (150 - dist) / 150 * 0.015;
        p.vx += dx * force * 0.01;
        p.vy += dy * force * 0.01;
        p.opacity = Math.min(0.7, p.opacity + (150 - dist) / 150 * 0.2);
      }

      if (p.x < -10) p.x = this.canvas.width + 10;
      if (p.x > this.canvas.width + 10) p.x = -10;
      if (p.y < -10) p.y = this.canvas.height + 10;
      if (p.y > this.canvas.height + 10) p.y = -10;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `hsla(${p.hue}, ${p.sat}%, ${p.light}%, ${p.opacity})`;
      this.ctx.fill();
    }

    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const p1 = this.particles[i];
        const p2 = this.particles[j];
        const ddx = p1.x - p2.x;
        const ddy = p1.y - p2.y;
        const d = ddx * ddx + ddy * ddy;
        if (d < 8000) {
          const alpha = (1 - d / 8000) * 0.12;
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = `hsla(${(p1.hue + p2.hue) / 2}, 60%, 65%, ${alpha})`;
          this.ctx.lineWidth = 0.5;
          this.ctx.stroke();
        }
      }
    }

    requestAnimationFrame(() => this.animate());
  }
}

new ParticleSystem();
