import * as THREE from 'three';

const FULLSCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Smooth 4-tap bilinear pre-filter downsample (eliminates aliasing & comb artifacts)
const DOWNSAMPLE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform vec2 uTexelSize;
  varying vec2 vUv;

  void main() {
    vec2 o = uTexelSize * 0.75;
    vec3 c0 = texture2D(tDiffuse, clamp(vUv + vec2(-o.x, -o.y), vec2(0.002), vec2(0.998))).rgb;
    vec3 c1 = texture2D(tDiffuse, clamp(vUv + vec2( o.x, -o.y), vec2(0.002), vec2(0.998))).rgb;
    vec3 c2 = texture2D(tDiffuse, clamp(vUv + vec2(-o.x,  o.y), vec2(0.002), vec2(0.998))).rgb;
    vec3 c3 = texture2D(tDiffuse, clamp(vUv + vec2( o.x,  o.y), vec2(0.002), vec2(0.998))).rgb;
    vec3 col = (c0 + c1 + c2 + c3) * 0.25;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Smooth 9-tap separable Gaussian bokeh blur at quarter-res (zero striping!)
const BLUR_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform vec2 uStep;
  varying vec2 vUv;

  void main() {
    float weights[5];
    weights[0] = 0.227027;
    weights[1] = 0.1945946;
    weights[2] = 0.1216216;
    weights[3] = 0.054054;
    weights[4] = 0.016216;

    vec3 acc = texture2D(tDiffuse, vUv).rgb * weights[0];
    float wSum = weights[0];
    for (int i = 1; i < 5; i++) {
      vec2 off = uStep * float(i);
      vec3 cp = texture2D(tDiffuse, clamp(vUv + off, vec2(0.002), vec2(0.998))).rgb;
      vec3 cm = texture2D(tDiffuse, clamp(vUv - off, vec2(0.002), vec2(0.998))).rgb;
      float lp = dot(cp, vec3(0.299, 0.587, 0.114));
      float lm = dot(cm, vec3(0.299, 0.587, 0.114));
      float wp = weights[i] * (1.0 + smoothstep(0.85, 1.9, lp) * 0.35);
      float wm = weights[i] * (1.0 + smoothstep(0.85, 1.9, lm) * 0.35);
      acc += cp * wp + cm * wm;
      wSum += wp + wm;
    }
    gl_FragColor = vec4(acc / wSum, 1.0);
  }
`;

// Final photographic tilt-shift composite: razor-sharp focus plane + creamy macro bokeh + ACES film grade
const COMPOSITE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tSharp;
  uniform sampler2D tBlur;
  uniform vec2 uTexelSize;
  uniform float uFocusY;
  uniform float uFocusBand;
  uniform float uBlurStrength;
  uniform float uTime;
  uniform float uWarmth;
  varying vec2 vUv;

  float getCoc(vec2 uv) {
    float dy = uv.y - uFocusY;
    // Top background blurs slightly deeper than bottom foreground (true miniature tabletop lens!)
    float asym = dy > 0.0 ? dy * 1.15 : abs(dy) * 0.88;
    float edge = abs(uv.x - 0.5) * 0.12;
    float dist = max(0.0, asym + edge - uFocusBand);
    return clamp(dist * 2.55 * uBlurStrength, 0.0, 1.0);
  }

  vec3 acesFilm(vec3 x) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    float coc = getCoc(vUv);
    vec3 sharp = texture2D(tSharp, vUv).rgb;
    vec3 blurred = texture2D(tBlur, vUv).rgb;

    // Creamy continuous macro DoF blend (with subtle micro-blur ring in the transition zone)
    float blend = smoothstep(0.0, 0.88, coc);
    vec3 col = mix(sharp, blurred, blend);

    // Subtle photographic micro-contrast only in the tack-sharp focal zone
    float sharpMask = 1.0 - blend;
    vec3 rightC = texture2D(tSharp, vUv + vec2(uTexelSize.x, 0.0)).rgb;
    vec3 upC = texture2D(tSharp, vUv + vec2(0.0, uTexelSize.y)).rgb;
    vec3 detail = sharp - 0.5 * (rightC + upC);
    col += detail * 0.12 * sharpMask;

    // Warm miniature studio photography balance
    col *= vec3(1.03 + uWarmth * 0.06, 1.01 + uWarmth * 0.02, 0.96 - uWarmth * 0.03);

    // ACES Filmic tone mapping
    col = acesFilm(col * 1.12);

    // Rich appetizing natural saturation
    float gray = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(gray), col, 1.11);

    // Gentle natural macro lens vignette
    vec2 centered = vUv - 0.5;
    float vig = smoothstep(0.88, 0.30, length(centered));
    col *= mix(0.80, 1.0, vig);

    // Linear to sRGB
    col = pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));

    // Ultra-fine authentic film grain
    float grain = (hash12(vUv * 820.0 + fract(uTime) * 37.0) - 0.5) * 0.012;
    col = clamp(col + grain, 0.0, 1.0);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class TiltShiftComposer {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.enabled = true;
    this.focusY = 0.45;
    this.targetFocusY = 0.45;
    this.focusBand = 0.2;
    this.targetFocusBand = 0.2;
    this.blurStrength = 1.0;
    this.targetBlurStrength = 1.0;
    this.warmth = 0.15;
    this.targetWarmth = 0.15;

    const isWebGL2 = renderer.capabilities.isWebGL2;
    const hasHalfFloat =
      isWebGL2 &&
      (renderer.extensions.has('EXT_color_buffer_half_float') ||
        renderer.extensions.has('EXT_color_buffer_float'));

    const type = hasHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const rtOpts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type,
      depthBuffer: true,
      stencilBuffer: false
    };
    const blurOpts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type,
      depthBuffer: false,
      stencilBuffer: false
    };

    this.rtScene = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    this.rtHalf = new THREE.WebGLRenderTarget(1, 1, blurOpts);
    this.rtQuarterA = new THREE.WebGLRenderTarget(1, 1, blurOpts);
    this.rtQuarterB = new THREE.WebGLRenderTarget(1, 1, blurOpts);

    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geom = new THREE.PlaneGeometry(2, 2);

    this.downMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: DOWNSAMPLE_FRAG,
      uniforms: {
        tDiffuse: { value: null },
        uTexelSize: { value: new THREE.Vector2(1 / 640, 1 / 480) }
      },
      depthTest: false,
      depthWrite: false
    });

    this.blurMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: BLUR_FRAG,
      uniforms: {
        tDiffuse: { value: null },
        uStep: { value: new THREE.Vector2(1 / 320, 0) }
      },
      depthTest: false,
      depthWrite: false
    });

    this.compositeMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        tSharp: { value: this.rtScene.texture },
        tBlur: { value: this.rtQuarterA.texture },
        uTexelSize: { value: new THREE.Vector2(1 / 1280, 1 / 960) },
        uFocusY: { value: this.focusY },
        uFocusBand: { value: this.focusBand },
        uBlurStrength: { value: this.blurStrength },
        uTime: { value: 0 },
        uWarmth: { value: this.warmth }
      },
      depthTest: false,
      depthWrite: false
    });

    this.quadMesh = new THREE.Mesh(geom, this.downMat);
    this.quadMesh.frustumCulled = false;
    this.quadScene.add(this.quadMesh);

    this.setSize(width, height);
  }

  setFocus({ focusY = 0.45, focusBand = 0.2, blurAmount = 5.0, warmth = 0.15 } = {}) {
    this.targetFocusY = focusY;
    this.targetFocusBand = focusBand;
    this.targetBlurStrength = THREE.MathUtils.clamp(blurAmount / 5.2, 0.55, 1.45);
    this.targetWarmth = warmth;
  }

  setSize(width, height) {
    const dpr = this.renderer.getPixelRatio();
    const w = Math.max(4, Math.floor(width * dpr));
    const h = Math.max(4, Math.floor(height * dpr));
    const hw = Math.max(4, Math.floor(w * 0.5));
    const hh = Math.max(4, Math.floor(h * 0.5));
    const qw = Math.max(4, Math.floor(w * 0.25));
    const qh = Math.max(4, Math.floor(h * 0.25));

    this.rtScene.setSize(w, h);
    this.rtHalf.setSize(hw, hh);
    this.rtQuarterA.setSize(qw, qh);
    this.rtQuarterB.setSize(qw, qh);

    this.fullTexel = new THREE.Vector2(1 / w, 1 / h);
    this.halfTexel = new THREE.Vector2(1 / hw, 1 / hh);
    this.quarterTexel = new THREE.Vector2(1 / qw, 1 / qh);
    this.compositeMat.uniforms.uTexelSize.value.copy(this.fullTexel);
  }

  render(scene, camera, dt, elapsed) {
    const lerpK = 1 - Math.exp(-dt * 4.5);
    this.focusY += (this.targetFocusY - this.focusY) * lerpK;
    this.focusBand += (this.targetFocusBand - this.focusBand) * lerpK;
    this.blurStrength += (this.targetBlurStrength - this.blurStrength) * lerpK;
    this.warmth += (this.targetWarmth - this.warmth) * lerpK;

    if (!this.enabled) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }

    const prevTone = this.renderer.toneMapping;
    this.renderer.toneMapping = THREE.NoToneMapping;

    // 1. Full-res 3D miniature render
    this.renderer.setRenderTarget(this.rtScene);
    this.renderer.clear();
    this.renderer.render(scene, camera);

    // 2. Smooth 2-step pyramid downsample (Full -> Half -> Quarter) to eliminate any aliasing/striping
    this.quadMesh.material = this.downMat;
    this.downMat.uniforms.tDiffuse.value = this.rtScene.texture;
    this.downMat.uniforms.uTexelSize.value.copy(this.fullTexel);
    this.renderer.setRenderTarget(this.rtHalf);
    this.renderer.render(this.quadScene, this.quadCamera);

    this.downMat.uniforms.tDiffuse.value = this.rtHalf.texture;
    this.downMat.uniforms.uTexelSize.value.copy(this.halfTexel);
    this.renderer.setRenderTarget(this.rtQuarterA);
    this.renderer.render(this.quadScene, this.quadCamera);

    // 3. Two smooth separable Gaussian bokeh passes at quarter-res (creamy DSLR blur!)
    this.quadMesh.material = this.blurMat;
    for (let pass = 0; pass < 2; pass++) {
      const stepScale = pass === 0 ? 1.1 : 1.45;
      this.blurMat.uniforms.tDiffuse.value = this.rtQuarterA.texture;
      this.blurMat.uniforms.uStep.value.set(this.quarterTexel.x * stepScale, 0);
      this.renderer.setRenderTarget(this.rtQuarterB);
      this.renderer.render(this.quadScene, this.quadCamera);

      this.blurMat.uniforms.tDiffuse.value = this.rtQuarterB.texture;
      this.blurMat.uniforms.uStep.value.set(0, this.quarterTexel.y * stepScale);
      this.renderer.setRenderTarget(this.rtQuarterA);
      this.renderer.render(this.quadScene, this.quadCamera);
    }

    // 4. Final tilt-shift composite + ACES filmic grading to screen
    this.compositeMat.uniforms.uFocusY.value = this.focusY;
    this.compositeMat.uniforms.uFocusBand.value = this.focusBand;
    this.compositeMat.uniforms.uBlurStrength.value = this.blurStrength;
    this.compositeMat.uniforms.uTime.value = elapsed;
    this.compositeMat.uniforms.uWarmth.value = this.warmth;
    this.quadMesh.material = this.compositeMat;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCamera);

    this.renderer.toneMapping = prevTone;
  }

  dispose() {
    this.rtScene.dispose();
    this.rtHalf.dispose();
    this.rtQuarterA.dispose();
    this.rtQuarterB.dispose();
    this.downMat.dispose();
    this.blurMat.dispose();
    this.compositeMat.dispose();
    this.quadMesh.geometry.dispose();
  }
}
