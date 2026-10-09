// FogShader.js
// Custom GLSL shader for rendering the foggy glass effect

export const fogVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const fogFragmentShader = `
  uniform float u_time;
  uniform sampler2D u_bgTex; // The hidden scene
  uniform sampler2D u_maskTex; // The wiped area mask (red channel = wipe intensity, 0 = fogged, 1 = clear)
  uniform vec2 u_resolution;
  uniform vec2 u_videoResolution;

  varying vec2 vUv;

  // Simple pseudo-random function
  float rand(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
  }

  // Value noise
  float noise(vec2 p){
    vec2 ip = floor(p);
    vec2 u = fract(p);
    u = u*u*(3.0-2.0*u);
    
    float res = mix(
      mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
      mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
    return res*res;
  }

  // FBM (Fractal Brownian Motion) for cloudy fog
  float fbm(vec2 x) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    // Rotate to reduce axial bias
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
    for (int i = 0; i < 5; ++i) {
      v += a * noise(x);
      x = rot * x * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  // Fast gaussian blur approximation for the fogged areas
  vec4 blur(sampler2D tex, vec2 uv, vec2 resolution, float radius) {
    vec4 color = vec4(0.0);
    vec2 tex_offset = 1.0 / resolution;
    
    // 9-tap filter
    color += texture2D(tex, uv + vec2(-1.0, -1.0) * tex_offset * radius) * 0.0625;
    color += texture2D(tex, uv + vec2( 0.0, -1.0) * tex_offset * radius) * 0.125;
    color += texture2D(tex, uv + vec2( 1.0, -1.0) * tex_offset * radius) * 0.0625;
    color += texture2D(tex, uv + vec2(-1.0,  0.0) * tex_offset * radius) * 0.125;
    color += texture2D(tex, uv + vec2( 0.0,  0.0) * tex_offset * radius) * 0.25;
    color += texture2D(tex, uv + vec2( 1.0,  0.0) * tex_offset * radius) * 0.125;
    color += texture2D(tex, uv + vec2(-1.0,  1.0) * tex_offset * radius) * 0.0625;
    color += texture2D(tex, uv + vec2( 0.0,  1.0) * tex_offset * radius) * 0.125;
    color += texture2D(tex, uv + vec2( 1.0,  1.0) * tex_offset * radius) * 0.0625;
    return color;
  }

  void main() {
    // 1. Read the mask
    // Red channel represents the wiped amount. 1.0 = fully wiped, 0.0 = fully fogged
    float mask = texture2D(u_maskTex, vUv).r;
    
    // Calculate background UV with object-fit:cover (no distortion, crop excess)
    float screenAspect = u_resolution.x / u_resolution.y;
    float videoAspect = u_videoResolution.x / u_videoResolution.y;
    
    vec2 bgUv = vUv;
    if (videoAspect > 0.0) {
      if (screenAspect > videoAspect) {
        // Screen is wider than video → crop top/bottom
        bgUv.y = (vUv.y - 0.5) * (videoAspect / screenAspect) + 0.5;
      } else {
        // Screen is taller than video → crop left/right
        bgUv.x = (vUv.x - 0.5) * (screenAspect / videoAspect) + 0.5;
      }
    }
    // Mirror horizontally for selfie view
    bgUv.x = 1.0 - bgUv.x;
    
    // 2. Generate fog texture (milky, noisy)
    vec2 noiseUv = vUv * 3.0 + vec2(u_time * 0.02);
    float fogNoise = fbm(noiseUv);
    
    // Generate condensation drops
    vec2 dropUv = vUv * vec2(u_resolution.x/u_resolution.y, 1.0) * 50.0;
    float droplets = step(0.85, noise(dropUv + u_time * 0.1));
    
    // 3. Sample the background (no distortion)
    // Sharp scene for wiped areas
    vec4 sceneColor = texture2D(u_bgTex, bgUv);
    
    // Blurred scene for fogged areas
    float blurRadius = 12.0 * (1.0 - mask);
    vec4 blurredScene = blur(u_bgTex, bgUv, u_resolution, blurRadius);
    
    // 4. Composite
    vec3 fogColor = vec3(0.82, 0.86, 0.9); // Milky white with a hint of blue
    
    // Combine blurred scene with milky fog color
    vec4 foggyBackground = mix(blurredScene, vec4(fogColor, 1.0), 0.4 + fogNoise * 0.3 * (1.0 - mask));
    
    // Add droplets to fogged areas
    foggyBackground += droplets * 0.08 * (1.0 - mask);
    
    // Final mix based on mask
    float smudgeEdge = smoothstep(0.0, 0.8, mask);
    
    vec4 finalColor = mix(foggyBackground, sceneColor, smudgeEdge);
    
    gl_FragColor = finalColor;
  }
`;
