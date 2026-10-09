# Foggy Glass

> An atmospheric surface that responds like condensation on glass.

[**View live demo →**](https://michmich02.github.io/foggy-glass/)

## Overview

Foggy Glass turns the browser into a tactile, misted window. Real-time hand input clears and disturbs the surface, revealing the scene underneath through a soft WebGL effect.

## Interaction

- Allow camera access.
- Hold one hand in view.
- Move across the frame to clear and reshape the fog.

## Built with

`JavaScript` · `Three.js` · `WebGL` · `MediaPipe`

## Run locally

```sh
python3 -m http.server 8000 --directory docs
```

Open [http://localhost:8000](http://localhost:8000) in a desktop browser. Camera and microphone APIs require localhost or HTTPS; external models and CDN dependencies require an internet connection.

## Design notes

- Immediate visual feedback keeps the gesture-to-effect relationship legible.
- The experience is designed as a focused, full-screen interaction.
- Processing happens in the browser; camera and microphone streams are not uploaded by this project.
