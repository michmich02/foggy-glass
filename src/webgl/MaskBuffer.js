// MaskBuffer.js
// Manages an off-screen 2D canvas representing the cleared areas of the fog.

import * as THREE from 'three';

export class MaskBuffer {
  constructor(width, height) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    
    // Initialize with black (fully fogged)
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, width, height);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
  }

  resize(width, height) {
    // Save current content
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this.canvas, 0, 0);

    // Resize
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Restore content scaled
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.drawImage(tempCanvas, 0, 0, width, height);
    
    this.texture.needsUpdate = true;
  }

  // Draw a wipe at (x,y) in normalized coordinates (0 to 1)
  addWipe(x, y, radius = 50, intensity = 0.5) {
    const px = x * this.canvas.width;
    const py = y * this.canvas.height;
    
    const grad = this.ctx.createRadialGradient(px, py, 0, px, py, radius);
    // Add white (wiped) with some alpha
    grad.addColorStop(0, `rgba(255, 255, 255, ${intensity})`);
    grad.addColorStop(0.5, `rgba(255, 255, 255, ${intensity * 0.5})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    this.ctx.globalCompositeOperation = 'screen';
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(px, py, radius, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.texture.needsUpdate = true;
  }

  // Draw a thin writing stroke at (x,y) — for finger writing on fogged glass
  addWriteStroke(x, y) {
    const px = x * this.canvas.width;
    const py = y * this.canvas.height;
    const radius = 8; // thin
    const intensity = 0.7;

    this.ctx.globalCompositeOperation = 'screen';

    // Draw connecting line from last write position for smooth strokes
    if (this.lastWriteX !== undefined) {
      const dx = px - this.lastWriteX;
      const dy = py - this.lastWriteY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 200) { // only connect if close enough (same stroke)
        this.ctx.strokeStyle = `rgba(255, 255, 255, ${intensity})`;
        this.ctx.lineWidth = radius * 1.5;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastWriteX, this.lastWriteY);
        this.ctx.lineTo(px, py);
        this.ctx.stroke();
      }
    }

    // Draw the fingertip dot
    const grad = this.ctx.createRadialGradient(px, py, 0, px, py, radius);
    grad.addColorStop(0, `rgba(255, 255, 255, ${intensity})`);
    grad.addColorStop(0.6, `rgba(255, 255, 255, ${intensity * 0.4})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(px, py, radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.lastWriteX = px;
    this.lastWriteY = py;
    this.texture.needsUpdate = true;
  }

  // Call when finger writing stops to reset stroke connection
  resetWriteStroke() {
    this.lastWriteX = undefined;
    this.lastWriteY = undefined;
  }

  // Draw a breath clearing at the mouth position (x,y in normalized 0-1 coords)
  addBreath(x, y, intensity) {
    // Only draw if there's enough intensity
    if (intensity < 0.1) return;
    
    const px = x * this.canvas.width;
    const py = y * this.canvas.height;
    
    const radius = this.canvas.width * 0.08 * intensity + 15;
    
    const grad = this.ctx.createRadialGradient(px, py, 0, px, py, radius);
    grad.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.8})`);
    grad.addColorStop(0.5, `rgba(255, 255, 255, ${intensity * 0.4})`);
    grad.addColorStop(0.7, `rgba(255, 255, 255, ${intensity * 0.15})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    this.ctx.globalCompositeOperation = 'screen';
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(px, py, radius, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.texture.needsUpdate = true;
  }

  // Gradually fade the canvas to black (fog returning)
  update() {
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.0008)'; // Extremely slow fade — fog returns very gradually
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.texture.needsUpdate = true;
  }
}
