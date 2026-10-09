// HandTrackingSystem.js
// Uses MediaPipe to track hands and face from webcam.

import { HandLandmarker, FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export class HandTrackingSystem {
  constructor(videoElement, onWipe, onWrite) {
    this.videoElement = videoElement;
    this.onWipe = onWipe;
    this.onWrite = onWrite; // thin stroke callback for finger writing
    this.handLandmarker = null;
    this.faceLandmarker = null;
    this.isTracking = false;
    this.lastVideoTime = -1;
    
    // Mouth position in normalized coords (0-1), mirrored for screen
    // Default to center until face is detected
    this.mouthX = 0.5;
    this.mouthY = 0.6;
    this.isMouthPuckered = false; // true when lips are pursed/pouting
  }

  async initialize() {
    try {
      // 1. Initialize MediaPipe
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.12/wasm"
      );
      
      // Hand Landmarker
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      // Face Landmarker (for mouth tracking)
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      // 2. Setup Webcam
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: "user" } 
      });
      this.videoElement.srcObject = stream;
      
      return new Promise((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          this.videoElement.play();
          this.isTracking = true;
          console.log('Hand & face tracking initialized');
          resolve(true);
        };
      });

    } catch (err) {
      console.error('Webcam access denied or MediaPipe error:', err);
      return false;
    }
  }

  update() {
    if (!this.isTracking || !this.videoElement.videoWidth) return;
    
    const currentTime = performance.now();
    if (this.videoElement.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.videoElement.currentTime;
      
      // --- Hand Detection ---
      if (this.handLandmarker) {
        const handResults = this.handLandmarker.detectForVideo(this.videoElement, currentTime);
        
        if (handResults.landmarks && handResults.landmarks.length > 0) {
          for (const landmarks of handResults.landmarks) {
            // Detect gesture
            // Finger extended = tip.y < pip.y (in image coords, y goes down)
            const indexExtended = landmarks[8].y < landmarks[6].y;
            const middleExtended = landmarks[12].y < landmarks[10].y;
            const ringExtended = landmarks[16].y < landmarks[14].y;
            const pinkyExtended = landmarks[20].y < landmarks[18].y;
            
            const isFist = !indexExtended && !middleExtended && !ringExtended && !pinkyExtended;
            const isPointing = indexExtended && !middleExtended && !ringExtended && !pinkyExtended;
            
            if (isFist) {
              // Fist → wipe glass with knuckle area
              const palmCenter = landmarks[9];
              const knuckle = landmarks[0]; // wrist area
              
              const x1 = 1.0 - palmCenter.x;
              const y1 = palmCenter.y;
              const x2 = 1.0 - knuckle.x;
              const y2 = knuckle.y;
              
              if (this.onWipe) {
                this.onWipe(x1, y1);
                this.onWipe(x2, y2);
              }
            } else if (isPointing) {
              // Index finger only → write on glass
              const x = 1.0 - landmarks[8].x;
              const y = landmarks[8].y;
              if (this.onWrite) {
                this.onWrite(x, y);
              }
            }
            // Other gestures (open palm, peace, etc.) → do nothing
          }
        }
      }
      
      // --- Face Detection (mouth tracking + pucker detection) ---
      if (this.faceLandmarker) {
        const faceResults = this.faceLandmarker.detectForVideo(this.videoElement, currentTime);
        
        if (faceResults.faceLandmarks && faceResults.faceLandmarks.length > 0) {
          const faceLandmarks = faceResults.faceLandmarks[0];
          // Landmark 13 = upper lip center, landmark 14 = lower lip center
          const upperLip = faceLandmarks[13];
          const lowerLip = faceLandmarks[14];
          
          // Average for mouth center, mirror x
          this.mouthX = 1.0 - (upperLip.x + lowerLip.x) / 2;
          this.mouthY = (upperLip.y + lowerLip.y) / 2;
          
          // Detect puckered/pouting mouth
          // Mouth corners (61 = left inner, 291 = right inner)
          const leftCorner = faceLandmarks[61];
          const rightCorner = faceLandmarks[291];
          const mouthWidth = Math.abs(rightCorner.x - leftCorner.x);
          
          // Face width for normalization (234 = left cheek, 454 = right cheek)
          const leftCheek = faceLandmarks[234];
          const rightCheek = faceLandmarks[454];
          const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
          
          // Mouth-to-face width ratio: normal ~0.35-0.40, puckered ~0.20-0.25
          const mouthRatio = faceWidth > 0 ? mouthWidth / faceWidth : 1;
          const isPuckered = mouthRatio < 0.30;
          
          // Detect puffed cheeks: lips pressed tightly together
          // Mouth vertical opening relative to face height
          const noseTop = faceLandmarks[6]; // nose bridge
          const chin = faceLandmarks[152]; // chin bottom
          const faceHeight = Math.abs(chin.y - noseTop.y);
          const mouthOpening = Math.abs(lowerLip.y - upperLip.y);
          const openRatio = faceHeight > 0 ? mouthOpening / faceHeight : 1;
          // Puffed = lips closed tight (small gap) AND mouth not wide (not smiling)
          const isPuffed = openRatio < 0.04 && mouthRatio < 0.35;
          
          this.isMouthPuckered = isPuckered || isPuffed;
        } else {
          this.isMouthPuckered = false;
        }
      }
    }
  }
}
