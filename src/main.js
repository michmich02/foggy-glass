// main.js
// Entry point. Orchestrates the Three.js scene, Hand tracking, and Audio.

import { Scene } from './webgl/Scene.js';
import { HandTrackingSystem } from './systems/HandTrackingSystem.js';

let scene, handSystem;
let isInitialized = false;

async function init() {
  const startBtn = document.getElementById('start-btn');
  const overlay = document.getElementById('overlay');
  const videoElement = document.getElementById('webcam');
  const canvas = document.getElementById('webgl-canvas');

  // Initialize WebGL Scene
  scene = new Scene(canvas);

  startBtn.addEventListener('click', async () => {
    startBtn.innerText = 'Initializing...';
    startBtn.disabled = true;

    // Initialize Hand Tracking
    try {
      console.log('Starting hand & face tracking...');
      handSystem = new HandTrackingSystem(
        videoElement,
        // Open palm → wipe
        (x, y) => { scene.handleWipe(x, y); },
        // Pointing finger → write
        (x, y) => { scene.handleWrite(x, y); }
      );
      await handSystem.initialize();
      console.log('Hand & face tracking ready');
    } catch (error) {
      console.warn('Hand tracking failed:', error);
    }

    // Set video as background if webcam is active
    if (videoElement.srcObject) {
      scene.setVideoBackground(videoElement);
    }

    // Hide overlay regardless - let user see whatever works
    overlay.classList.add('hidden');
    isInitialized = true;
    
    // Start render loop
    animate();
  });
  
  // Initial render just to show the fully fogged screen
  scene.render();
}

function animate() {
  requestAnimationFrame(animate);

  if (isInitialized) {
    if (handSystem) {
      handSystem.update();
      
      // Puckered mouth triggers clearing — pure face detection, no mic needed
      if (handSystem.isMouthPuckered) {
        scene.handleBreath(handSystem.mouthX, handSystem.mouthY, 0.25);
      }
    }
  }
  
  if (scene) scene.render();
}

// Start application
window.addEventListener('DOMContentLoaded', init);
