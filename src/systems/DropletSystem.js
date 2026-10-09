// DropletSystem.js
// Simulates condensation water droplets that drip down the fogged glass.

export class DropletSystem {
  constructor(maskBuffer) {
    this.maskBuffer = maskBuffer;
    this.droplets = [];
    this.maxDroplets = 60;
    this.spawnTimer = 0;
    this.spawnInterval = 0.3; // seconds between spawns
  }

  spawnDroplet() {
    if (this.droplets.length >= this.maxDroplets) return;

    const droplet = {
      // Normalized coordinates (0-1)
      x: Math.random(),
      y: Math.random() * 0.3, // spawn in upper portion
      size: 1.5 + Math.random() * 3, // pixel radius
      speed: 0.0001 + Math.random() * 0.0003, // normalized units per frame
      wobble: (Math.random() - 0.5) * 0.0002, // slight horizontal drift
      trail: [], // stores past positions for the water streak
      maxTrailLength: 30 + Math.floor(Math.random() * 40),
      opacity: 0.15 + Math.random() * 0.15,
      // Some droplets pause briefly before sliding
      pauseFrames: Math.floor(Math.random() * 120),
      age: 0,
      // Acceleration (starts slow, speeds up)
      velocity: 0,
      acceleration: 0.000002 + Math.random() * 0.000005,
    };

    this.droplets.push(droplet);
  }

  update(deltaTime) {
    // Spawn new droplets periodically
    this.spawnTimer += deltaTime;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnDroplet();
    }

    const w = this.maskBuffer.canvas.width;
    const h = this.maskBuffer.canvas.height;
    const ctx = this.maskBuffer.ctx;

    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const d = this.droplets[i];
      d.age++;

      // Wait during pause phase
      if (d.age < d.pauseFrames) continue;

      // Accelerate downward
      d.velocity += d.acceleration;
      d.velocity = Math.min(d.velocity, 0.003); // terminal velocity

      // Store current position in trail
      d.trail.push({ x: d.x, y: d.y });
      if (d.trail.length > d.maxTrailLength) {
        d.trail.shift();
      }

      // Move droplet
      d.y += d.velocity;
      d.x += d.wobble * Math.sin(d.age * 0.05); // gentle wobble

      // Draw the trail (thin water streak) onto the mask
      if (d.trail.length >= 2) {
        const prevPos = d.trail[d.trail.length - 2];
        const curPos = d.trail[d.trail.length - 1];

        ctx.globalCompositeOperation = 'screen';
        ctx.strokeStyle = `rgba(255, 255, 255, ${d.opacity * 0.3})`;
        ctx.lineWidth = d.size * 0.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(prevPos.x * w, prevPos.y * h);
        ctx.lineTo(curPos.x * w, curPos.y * h);
        ctx.stroke();
      }

      // Draw the droplet head (brighter, rounder)
      const px = d.x * w;
      const py = d.y * h;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, d.size);
      grad.addColorStop(0, `rgba(255, 255, 255, ${d.opacity})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, d.size, 0, Math.PI * 2);
      ctx.fill();

      // Remove if off screen
      if (d.y > 1.05) {
        this.droplets.splice(i, 1);
      }
    }

    this.maskBuffer.texture.needsUpdate = true;
  }
}
