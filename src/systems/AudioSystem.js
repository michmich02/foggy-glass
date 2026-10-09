// AudioSystem.js
// Detects breath/blowing into the microphone using Web Audio API

export class AudioSystem {
  constructor(onBreath) {
    this.onBreath = onBreath;
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.dataArray = null;
    
    // Thresholds for detecting "breath" vs normal noise
    this.volumeThreshold = 25; 
    this.lowFreqBias = true;
    this.currentVolume = 0; // expose for external reading
  }

  async initialize() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      
      // We want to detect low, rumbly breath noises
      this.analyser.fftSize = 256; 
      this.analyser.smoothingTimeConstant = 0.8;
      
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);
      
      this.bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(this.bufferLength);
      
      console.log('Audio system initialized');
      return true;
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      return false;
    }
  }

  update() {
    if (!this.analyser) return;

    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Calculate average volume, focusing on lower frequencies (first half of the bins)
    // as breath is typically low frequency wind noise.
    let sum = 0;
    const checkLength = this.lowFreqBias ? Math.floor(this.bufferLength / 2) : this.bufferLength;
    
    for(let i = 0; i < checkLength; i++) {
        sum += this.dataArray[i];
    }
    
    const average = sum / checkLength;
    
    if (average > this.volumeThreshold) {
      // Normalize intensity (0.0 to 1.0 roughly)
      const intensity = Math.min((average - this.volumeThreshold) / (200 - this.volumeThreshold), 1.0);
      this.currentVolume = intensity;
      
      if (this.onBreath) {
        this.onBreath(intensity);
      }
    } else {
      this.currentVolume = 0;
    }
  }
}
