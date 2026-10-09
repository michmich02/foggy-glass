// Scene.js
// Sets up Three.js, the hidden background, and the fog post-processing plane.

import * as THREE from 'three';
import { MaskBuffer } from './MaskBuffer.js';
import { fogVertexShader, fogFragmentShader } from './FogShader.js';
import { DropletSystem } from '../systems/DropletSystem.js';

export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    
    // Main Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // No offscreen render target needed anymore, we'll use the video texture directly
    this.bgTexture = null;

    // --- Fog Scene Setup (Fullscreen Post-Process) ---
    this.fogScene = new THREE.Scene();
    // Orthographic camera for full screen plane
    this.fogCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    this.maskBuffer = new MaskBuffer(this.width, this.height);
    
    const fogGeometry = new THREE.PlaneGeometry(2, 2);
    this.fogMaterial = new THREE.ShaderMaterial({
      vertexShader: fogVertexShader,
      fragmentShader: fogFragmentShader,
      uniforms: {
        u_time: { value: 0 },
        u_bgTex: { value: null }, // Set later
        u_maskTex: { value: this.maskBuffer.texture },
        u_resolution: { value: new THREE.Vector2(this.width, this.height) },
        u_videoResolution: { value: new THREE.Vector2(0, 0) } // Set when video is ready
      },
      depthWrite: false,
      depthTest: false
    });
    
    const fogPlane = new THREE.Mesh(fogGeometry, this.fogMaterial);
    this.fogScene.add(fogPlane);
    
    // Water droplet system
    this.dropletSystem = new DropletSystem(this.maskBuffer);
    
    // Resize handler
    window.addEventListener('resize', this.onResize.bind(this));
    
    this.clock = new THREE.Clock();
    this.lastTime = 0;
  }

  setVideoBackground(videoElement) {
    this.bgTexture = new THREE.VideoTexture(videoElement);
    this.bgTexture.minFilter = THREE.LinearFilter;
    this.bgTexture.magFilter = THREE.LinearFilter;
    this.bgTexture.colorSpace = THREE.SRGBColorSpace;
    
    this.fogMaterial.uniforms.u_bgTex.value = this.bgTexture;
    
    // Check for video width periodically until it's loaded, then set it
    const checkVideo = setInterval(() => {
        if (videoElement.videoWidth > 0) {
            this.fogMaterial.uniforms.u_videoResolution.value.set(
                videoElement.videoWidth, 
                videoElement.videoHeight
            );
            clearInterval(checkVideo);
        }
    }, 100);
  }

  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    
    this.renderer.setSize(this.width, this.height);
    this.maskBuffer.resize(this.width, this.height);
    this.fogMaterial.uniforms.u_resolution.value.set(this.width, this.height);
  }
  
  handleWipe(x, y) {
    this.maskBuffer.addWipe(x, y);
    this.maskBuffer.resetWriteStroke(); // reset writing when switching to wipe
  }
  
  handleWrite(x, y) {
    this.maskBuffer.addWriteStroke(x, y);
  }
  
  handleBreath(x, y, intensity) {
    this.maskBuffer.addBreath(x, y, intensity);
  }

  render() {
    const time = this.clock.getElapsedTime();
    const deltaTime = time - this.lastTime;
    this.lastTime = time;
    
    // Update mask (fading)
    this.maskBuffer.update();
    
    // Update water droplets
    this.dropletSystem.update(deltaTime);
    
    // Render Fog Plane to Screen
    this.renderer.setRenderTarget(null);
    this.fogMaterial.uniforms.u_time.value = time;
    this.renderer.render(this.fogScene, this.fogCamera);
  }
}
