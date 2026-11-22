import * as THREE from 'three';

/**
 * Physical window glass surface simulation & photorealistic optical material.
 * State texture channels (512x512 RGBA Uint8):
 *   R = condensation fog (0..1) -> bicubic-blurred optical transmission
 *   G = mineral dirt & dusty raindrop grime (0..1) -> earthy haze & water spots
 *   B = foaming cleaner lather (0..1) -> airy white cellular soap bubbles with micro-normals
 *   A = liquid water film & running beads (0..1) -> glossy sheen, normal refraction & slow evaporation
 */
export class GlassSurface {
  constructor(width = 1.38, height = 1.04) {
    this.width = width;
    this.height = height;
    this.res = 512;
    const count = this.res * this.res;

    this.fog = new Float32Array(count);
    this.dirt = new Float32Array(count);
    this.foam = new Float32Array(count);
    this.wet = new Float32Array(count);

    this.data = new Uint8Array(count * 4);
    this.stateTex = new THREE.DataTexture(this.data, this.res, this.res, THREE.RGBAFormat);
    this.stateTex.colorSpace = THREE.NoColorSpace;
    this.stateTex.magFilter = THREE.LinearFilter;
    this.stateTex.minFilter = THREE.LinearFilter;
    this.stateTex.wrapS = THREE.ClampToEdgeWrapping;
    this.stateTex.wrapT = THREE.ClampToEdgeWrapping;
    this.stateTex.generateMipmaps = false;

    this.drips = [];
    this.dirty = true;
    this.cleanRatio = 0;
    this.foamCoverage = 0;
    this._dripAccum = 0;
    this._statsAccum = 0;

    this.uniforms = {
      uStateTex: { value: this.stateTex },
      uTime: { value: 0 },
      uAspect: { value: width / height },
    };

    this.material = this._createGlassMaterial();
    const geom = new THREE.PlaneGeometry(width, height, 1, 1);
    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.name = 'window_glass_pane';
    this.mesh.renderOrder = 2;

    this.resetToMorningFog();
  }

  _createGlassMaterial() {
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xffffff),
      roughness: 0.015,
      metalness: 0.0,
      transmission: 0.99,
      ior: 1.52,
      thickness: 0.01,
      attenuationColor: new THREE.Color(0xf8fcfb),
      attenuationDistance: 2.5,
      envMapIntensity: 0.72,
      reflectivity: 0.55,
      clearcoat: 0.22,
      clearcoatRoughness: 0.04,
      transparent: false,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uStateTex = this.uniforms.uStateTex;
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.uniforms.uAspect = this.uniforms.uAspect;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec2 vGlassUv;`
        )
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
          vGlassUv = uv;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D uStateTex;
          uniform float uTime;
          uniform float uAspect;
          varying vec2 vGlassUv;

          float gHash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }

          float gNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            float a = gHash(i);
            float b = gHash(i + vec2(1.0, 0.0));
            float c = gHash(i + vec2(0.0, 1.0));
            float d = gHash(i + vec2(1.0, 1.0));
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
          }

          vec2 gVoronoi(vec2 x) {
            vec2 n = floor(x);
            vec2 f = fract(x);
            float md = 8.0;
            vec2 mr = vec2(0.0);
            for (int j = -1; j <= 1; j++) {
              for (int i = -1; i <= 1; i++) {
                vec2 g = vec2(float(i), float(j));
                vec2 o = vec2(gHash(n + g), gHash(n + g + vec2(17.1, 31.7)));
                vec2 r = g + o - f;
                float d = dot(r, r);
                if (d < md) {
                  md = d;
                  mr = r;
                }
              }
            }
            return vec2(sqrt(md), atan(mr.y, mr.x));
          }
          `
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          vec4 gState = texture2D(uStateTex, vGlassUv);
          float gFog = gState.r;
          float gDirt = gState.g;
          float gFoam = gState.b;
          float gWet = gState.a;

          vec2 aspectUv = vec2(vGlassUv.x * uAspect, vGlassUv.y);

          // Ultra-fine real condensation micro-bead sparkle
          float mistMicro = gNoise(aspectUv * 125.0) * 0.55 + gNoise(aspectUv * 260.0) * 0.45;
          // Multi-scale real frothy soap bubbles
          vec2 bubLarge = gVoronoi(aspectUv * 72.0);
          vec2 bubSmall = gVoronoi(aspectUv * 195.0);
          float bubbleDome = smoothstep(0.54, 0.05, bubLarge.x) * 0.62 + smoothstep(0.50, 0.06, bubSmall.x) * 0.38;
          float bubbleRim = smoothstep(0.35, 0.48, bubLarge.x) * smoothstep(0.58, 0.45, bubLarge.x);

          float dirtGrain = gNoise(aspectUv * 85.0) * 0.6 + gNoise(aspectUv * 220.0) * 0.4;

          vec3 dirtCol = mix(vec3(0.55, 0.51, 0.46), vec3(0.74, 0.70, 0.64), dirtGrain);
          vec3 fogCol = mix(vec3(0.88, 0.91, 0.94), vec3(0.97, 0.98, 0.995), mistMicro);
          vec3 foamCol = mix(vec3(0.92, 0.96, 0.99), vec3(1.0, 1.0, 1.0), clamp(bubbleDome + bubbleRim * 0.35, 0.0, 1.0));

          vec3 surfCol = vec3(0.992, 0.998, 0.996);
          surfCol = mix(surfCol, dirtCol, clamp(gDirt * 0.74, 0.0, 0.78));
          surfCol = mix(surfCol, fogCol, clamp(gFog * 0.64, 0.0, 0.68));
          surfCol = mix(surfCol, foamCol, smoothstep(0.05, 0.40, gFoam));
          diffuseColor.rgb *= surfCol;
          `
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          float rClean = 0.012;
          float rFog = mix(0.24, 0.52, mistMicro) * gFog;
          float rDirt = mix(0.20, 0.42, dirtGrain) * gDirt;
          float rFoam = mix(0.30, 0.09, bubbleDome) * smoothstep(0.05, 0.35, gFoam);
          roughnessFactor = clamp(rClean + rFog * 0.82 + rDirt * 0.60, 0.012, 0.68);
          roughnessFactor = mix(roughnessFactor, 0.022, clamp(gWet * 0.85 * (1.0 - gFoam), 0.0, 0.88));
          roughnessFactor = mix(roughnessFactor, max(0.07, rFoam), smoothstep(0.10, 0.52, gFoam));
          `
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          vec2 texel = vec2(1.0 / 512.0);
          vec4 stR = texture2D(uStateTex, vGlassUv + vec2(texel.x, 0.0));
          vec4 stL = texture2D(uStateTex, vGlassUv - vec2(texel.x, 0.0));
          vec4 stU = texture2D(uStateTex, vGlassUv + vec2(0.0, texel.y));
          vec4 stD = texture2D(uStateTex, vGlassUv - vec2(0.0, texel.y));

          float hR = stR.b * 1.35 + stR.a * 0.62 + stR.r * 0.09;
          float hL = stL.b * 1.35 + stL.a * 0.62 + stL.r * 0.09;
          float hU = stU.b * 1.35 + stU.a * 0.62 + stU.r * 0.09;
          float hD = stD.b * 1.35 + stD.a * 0.62 + stD.r * 0.09;

          vec2 grad = vec2(hL - hR, hD - hU) * 1.45;

          float foamMask = smoothstep(0.04, 0.28, gFoam);
          if (foamMask > 0.01) {
            float bEps = 0.0018;
            float b0 = gVoronoi(aspectUv * 78.0).x;
            float bx = gVoronoi((aspectUv + vec2(bEps, 0.0)) * 78.0).x;
            float by = gVoronoi((aspectUv + vec2(0.0, bEps)) * 78.0).x;
            grad += vec2(b0 - bx, b0 - by) * 1.15 * foamMask;
          }

          float fogBeadMask = smoothstep(0.15, 0.72, gFog) * (1.0 - foamMask);
          if (fogBeadMask > 0.01) {
            float fEps = 0.0025;
            float f0 = gNoise(aspectUv * 165.0);
            float fx = gNoise((aspectUv + vec2(fEps, 0.0)) * 165.0);
            float fy = gNoise((aspectUv + vec2(0.0, fEps)) * 165.0);
            grad += vec2(f0 - fx, f0 - fy) * 0.20 * fogBeadMask;
          }

          normal = normalize(normal + vec3(grad.x, grad.y, 0.0));
          `
        )
        .replace(
          '#include <transmission_fragment>',
          `#ifdef USE_TRANSMISSION
            float dynTrans = transmission;
            dynTrans *= (1.0 - gDirt * 0.28);
            dynTrans *= (1.0 - gFog * 0.16);
            dynTrans = mix(dynTrans, 0.14, smoothstep(0.08, 0.68, gFoam));
            material.transmission = clamp(dynTrans, 0.08, 0.99);
            material.transmissionAlpha = 1.0;
            material.thickness = thickness + gFoam * 0.014 + gWet * 0.007;
            material.attenuationDistance = mix(attenuationDistance, 0.45, clamp(gDirt * 0.7 + gFog * 0.25, 0.0, 1.0));
            material.attenuationColor = mix(attenuationColor, vec3(0.84, 0.82, 0.77), gDirt * 0.65);

            vec3 pos = vWorldPosition;
            vec3 v = normalize( cameraPosition - pos );
            vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
            float transRough = clamp(material.roughness + gFog * 0.26 + gDirt * 0.10, 0.010, 0.82);
            vec4 transmitted = getIBLVolumeRefraction(
              n, v, transRough, material.diffuseContribution, material.specularColorBlended, material.specularF90,
              pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
              material.attenuationColor, material.attenuationDistance );
            material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
            totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );

            // Warm sunlit forward-scattering on frosted morning condensation & bright bubbly soap foam
            float sunWarmth = smoothstep(0.15, 0.95, vGlassUv.y * 0.65 + vGlassUv.x * 0.35);
            vec3 scatterCol = mix(vec3(0.95, 0.97, 0.99), vec3(1.0, 0.985, 0.95), sunWarmth);
            float sunScatter = gFog * 0.14 + smoothstep(0.07, 0.62, gFoam) * 0.25;
            totalDiffuse += scatterCol * sunScatter * (0.68 + 0.32 * bubbleDome);
          #endif`
        );
    };

    mat.customProgramCacheKey = () => 'photoreal-window-glass-v2';
    return mat;
  }

  /** Seed authentic morning condensation, delicate dried rain streaks, and dusty sill-edge grime */
  resetToMorningFog(seedOffset = 0) {
    const N = this.res;
    const s = seedOffset * 13.37;

    const hash = (x, y) => {
      const h = Math.sin(x * 127.1 + y * 311.7 + s) * 43758.5453123;
      return h - Math.floor(h);
    };
    const vnoise = (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y);
      const fx = x - ix, fy = y - iy;
      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);
      const a = hash(ix, iy);
      const b = hash(ix + 1, iy);
      const c = hash(ix, iy + 1);
      const d = hash(ix + 1, iy + 1);
      return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
    };
    const fbm = (x, y) => (
      vnoise(x, y) * 0.55 +
      vnoise(x * 2.15 + 4.3, y * 2.15 + 1.7) * 0.30 +
      vnoise(x * 4.6 + 9.1, y * 4.6 + 3.2) * 0.15
    );

    // Fine realistic rainwater mineral spots (smaller & more natural than giant circles!)
    const spots = [];
    for (let i = 0; i < 95; i++) {
      spots.push({
        x: 0.03 + hash(i * 3.1, 1.7) * 0.94,
        y: 0.04 + hash(i * 7.3, 4.2) * 0.92,
        r: 0.0055 + hash(i * 2.9, 8.8) * 0.013,
        strength: 0.32 + hash(i * 5.7, 2.1) * 0.52,
      });
    }

    // Fine vertical rainwater runoff streaks
    const streaks = [];
    for (let i = 0; i < 24; i++) {
      streaks.push({
        x: 0.04 + hash(i * 11.3, 9.4) * 0.92,
        yTop: 0.50 + hash(i * 4.1, 6.2) * 0.48,
        yBot: 0.02 + hash(i * 6.7, 3.3) * 0.46,
        w: 0.0035 + hash(i * 8.1, 2.9) * 0.0065,
        tilt: (hash(i * 2.3, 5.1) - 0.5) * 0.025,
        strength: 0.35 + hash(i * 9.5, 1.3) * 0.48,
      });
    }

    for (let iy = 0; iy < N; iy++) {
      const v = iy / (N - 1);
      for (let ix = 0; ix < N; ix++) {
        const u = ix / (N - 1);
        const idx = iy * N + ix;

        // Real morning condensation: thicker near cold bottom & frame perimeter, softly inviting semi-haze upper center
        const edgeDist = Math.min(u, 1 - u, v, 1 - v);
        const edgeBoost = Math.max(0, 1 - edgeDist / 0.16) * 0.26;
        const verticalGrad = (1 - v) * 0.24;
        const cloud = fbm(u * 4.4, v * 3.8);
        const upperWarmPeek = Math.exp(-(((u - 0.56) ** 2) / 0.18 + ((v - 0.68) ** 2) / 0.14)) * 0.22;

        let fogVal = 0.54 + cloud * 0.34 + edgeBoost + verticalGrad - upperWarmPeek;
        fogVal = Math.max(0.22, Math.min(0.95, fogVal));

        // Authentic outdoor dust film heavier toward bottom of window pane
        let dirtVal = (0.16 + Math.pow(1 - v, 1.5) * 0.28 + edgeBoost * 0.45) * (0.6 + fbm(u * 8.2 + 3, v * 8.2 + 2) * 0.72);

        this.fog[idx] = fogVal;
        this.dirt[idx] = Math.min(0.78, dirtVal);
        this.foam[idx] = 0;
        this.wet[idx] = 0;
      }
    }

    for (const sp of spots) {
      const cx = Math.floor(sp.x * N);
      const cy = Math.floor(sp.y * N);
      const rad = Math.max(2, Math.ceil(sp.r * N));
      for (let dy = -rad; dy <= rad; dy++) {
        const py = cy + dy;
        if (py < 0 || py >= N) continue;
        for (let dx = -rad; dx <= rad; dx++) {
          const px = cx + dx;
          if (px < 0 || px >= N) continue;
          const dist = Math.hypot(dx, dy) / rad;
          if (dist > 1) continue;
          const ring = Math.exp(-((dist - 0.74) ** 2) / 0.04) * 0.58 + (1 - dist) * 0.42;
          const idx = py * N + px;
          this.dirt[idx] = Math.min(0.92, this.dirt[idx] + ring * sp.strength * 0.56);
        }
      }
    }

    for (const st of streaks) {
      const y0 = Math.max(0, Math.floor(st.yBot * N));
      const y1 = Math.min(N - 1, Math.floor(st.yTop * N));
      const halfW = Math.max(1, Math.ceil(st.w * N));
      for (let py = y0; py <= y1; py++) {
        const t = (py - y0) / Math.max(1, y1 - y0);
        const cx = Math.floor((st.x + st.tilt * (1 - t)) * N);
        const fadeEnds = Math.sin(t * Math.PI);
        for (let dx = -halfW; dx <= halfW; dx++) {
          const px = cx + dx;
          if (px < 0 || px >= N) continue;
          const falloff = Math.cos((dx / Math.max(1, halfW)) * Math.PI * 0.5);
          const idx = py * N + px;
          const amt = falloff * falloff * fadeEnds * st.strength;
          this.dirt[idx] = Math.min(0.92, this.dirt[idx] + amt * 0.44);
          this.fog[idx] = Math.max(0.16, this.fog[idx] - amt * 0.16);
        }
      }
    }

    this.drips.length = 0;
    this.dirty = true;
    this._syncTexture();
    this._recomputeStats();
  }

  /** Cozy warm steam wave from teacup re-fogs the glass for endless play */
  addSteamWave(originU = 0.84, originV = 0.08, strength = 1.0) {
    const N = this.res;
    const seed = Math.random() * 100;
    for (let iy = 0; iy < N; iy++) {
      const v = iy / (N - 1);
      for (let ix = 0; ix < N; ix++) {
        const u = ix / (N - 1);
        const idx = iy * N + ix;
        const d = Math.hypot((u - originU) * 0.85, (v - originV) * 0.72);
        const plume = Math.max(0, 1 - d * 0.75);
        const wisp = 0.65 + 0.35 * Math.sin(u * 14 + v * 9 + seed) * Math.cos(u * 8 - v * 11);
        const addFog = (0.38 + plume * 0.54) * wisp * strength;
        this.fog[idx] = Math.min(0.93, this.fog[idx] + addFog * 0.58);
      }
    }
    for (let s = 0; s < Math.floor(24 * strength); s++) {
      const sx = 0.06 + Math.random() * 0.88;
      const sy = 0.08 + Math.random() * 0.84;
      const rad = Math.max(2, Math.ceil((0.006 + Math.random() * 0.012) * N));
      const cx = Math.floor(sx * N);
      const cy = Math.floor(sy * N);
      for (let dy = -rad; dy <= rad; dy++) {
        const py = cy + dy;
        if (py < 0 || py >= N) continue;
        for (let dx = -rad; dx <= rad; dx++) {
          const px = cx + dx;
          if (px < 0 || px >= N) continue;
          const dist = Math.hypot(dx, dy) / rad;
          if (dist > 1) continue;
          const idx = py * N + px;
          this.dirt[idx] = Math.min(0.76, this.dirt[idx] + (1 - dist) * 0.25 * strength);
        }
      }
    }
    this.dirty = true;
  }

  /** Spray realistic frothy foaming glass cleaner at UV (0..1, 0..1) */
  sprayFoam(u, v, intensity = 1.0) {
    const N = this.res;
    const aspect = this.width / this.height;
    const baseRadius = 0.072 + Math.random() * 0.022;
    const rx = Math.ceil((baseRadius / aspect) * N * 1.48);
    const ry = Math.ceil(baseRadius * N * 1.48);
    const cx = Math.floor(u * N);
    const cy = Math.floor(v * N);

    const lobes = [];
    for (let i = 0; i < 16; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.pow(Math.random(), 0.62) * baseRadius * 0.88;
      lobes.push({
        du: Math.cos(ang) * dist / aspect,
        dv: Math.sin(ang) * dist,
        r: baseRadius * (0.18 + Math.random() * 0.34),
        w: 0.45 + Math.random() * 0.65,
      });
    }

    for (let dy = -ry; dy <= ry; dy++) {
      const py = cy + dy;
      if (py < 0 || py >= N) continue;
      const pv = py / (N - 1);
      for (let dx = -rx; dx <= rx; dx++) {
        const px = cx + dx;
        if (px < 0 || px >= N) continue;
        const pu = px / (N - 1);
        const du = (pu - u) * aspect;
        const dv = pv - v;
        const dist = Math.hypot(du, dv) / baseRadius;
        if (dist > 1.38) continue;

        let foamAdd = Math.max(0, 1 - dist * dist) * 0.46;
        for (let i = 0; i < lobes.length; i++) {
          const lb = lobes[i];
          const ld = Math.hypot((pu - u - lb.du) * aspect, pv - v - lb.dv) / lb.r;
          if (ld < 1) foamAdd += (1 - ld * ld) * 0.24 * lb.w;
        }
        if (dist > 0.62) {
          const speck = Math.sin(px * 19.7 + py * 37.3) * 43758.5;
          const sf = speck - Math.floor(speck);
          if (sf > 0.82) foamAdd += 0.24 * (1.38 - dist);
        }

        if (foamAdd <= 0.005) continue;
        foamAdd *= intensity;

        const idx = py * N + px;
        this.foam[idx] = Math.min(1.0, this.foam[idx] + foamAdd);
        this.wet[idx] = Math.min(1.0, this.wet[idx] + foamAdd * 0.72);
        this.dirt[idx] = Math.max(0, this.dirt[idx] - foamAdd * 0.42);
        this.fog[idx] = Math.max(0, this.fog[idx] - foamAdd * 0.35);
      }
    }

    const centerIdx = Math.max(0, Math.min(N * N - 1, cy * N + cx));
    if (this.foam[centerIdx] > 0.48 && this.drips.length < 28) {
      this.drips.push({
        u: Math.max(0.02, Math.min(0.98, u + (Math.random() - 0.5) * 0.055)),
        v: Math.max(0.03, Math.min(0.97, v - Math.random() * 0.028)),
        speed: 0.032 + Math.random() * 0.038,
        radius: 0.0024 + Math.random() * 0.0020,
        foamLoad: 0.28 + Math.random() * 0.25,
        life: 1.6 + Math.random() * 2.2,
      });
    }

    this.dirty = true;
  }

  /**
   * CONTINUOUS analytical swept-blade squeegee wipe from (u0,v0) to (u1,v1).
   * Zero horizontal stripes or gaps regardless of swipe speed!
   * Projects every pixel in the swept bounding box onto the exact motion segment + blade axis.
   */
  wipeSqueegee(u0, v0, u1, v1, bladeAngleRad = 0, bladeHalfWidthMeters = 0.135) {
    const N = this.res;
    const aspect = this.width / this.height;
    const halfW = bladeHalfWidthMeters / this.height;

    const bx = Math.cos(bladeAngleRad);
    const by = Math.sin(bladeAngleRad);
    const nx = -by;
    const ny = bx;

    const p0x = u0 * aspect;
    const p0y = v0;
    const p1x = u1 * aspect;
    const p1y = v1;

    const mvx = p1x - p0x;
    const mvy = p1y - p0y;
    const moveLenSq = mvx * mvx + mvy * mvy;
    const moveLen = Math.sqrt(moveLenSq);

    // Swept bounding box in isotropic coords
    const bladeLip = 0.012;
    const padX = Math.abs(bx) * halfW + Math.abs(nx) * bladeLip * 2.4 + 0.012;
    const padY = Math.abs(by) * halfW + Math.abs(ny) * bladeLip * 2.4 + 0.012;

    const minX = Math.max(0, Math.floor(((Math.min(p0x, p1x) - padX) / aspect) * N));
    const maxX = Math.min(N - 1, Math.ceil(((Math.max(p0x, p1x) + padX) / aspect) * N));
    const minY = Math.max(0, Math.floor((Math.min(p0y, p1y) - padY) * N));
    const maxY = Math.min(N - 1, Math.ceil((Math.max(p0y, p1y) + padY) * N));

    // Leading edge direction along blade normal
    const leadSign = (mvx * nx + mvy * ny) >= 0 ? 1 : -1;
    // Component of movement along the blade normal (determines swept band width!)
    const sweepPerp = (mvx * nx + mvy * ny) * leadSign;

    let clearedSum = 0;
    let pushedFoamSum = 0;
    let wetSum = 0;
    let sampleCount = 0;

    for (let py = minY; py <= maxY; py++) {
      const y = py / (N - 1);
      for (let px = minX; px <= maxX; px++) {
        const x = (px / (N - 1)) * aspect;

        // Find parameter t in [0,1] where the swept blade center passes closest to pixel (x,y)
        let t = 1.0;
        if (moveLenSq > 1e-8) {
          // Exact parametric intersection with the line along blade axis through (x,y)
          // Solve dot((P0 + t*M) - (x,y), N) = 0  =>  t = dot((x,y) - P0, N) / dot(M, N)
          const denom = mvx * nx + mvy * ny;
          if (Math.abs(denom) > 1e-4) {
            t = ((x - p0x) * nx + (y - p0y) * ny) / denom;
          } else {
            // Moving nearly parallel to blade: project onto movement vector
            t = ((x - p0x) * mvx + (y - p0y) * mvy) / moveLenSq;
          }
          t = t < 0 ? 0 : (t > 1 ? 1 : t);
        }

        const cx = p0x + mvx * t;
        const cy = p0y + mvy * t;
        const dx = x - cx;
        const dy = y - cy;

        const along = dx * bx + dy * by;
        const perpSigned = (dx * nx + dy * ny) * leadSign;
        const absAlong = Math.abs(along);
        const absPerp = Math.abs(perpSigned);

        if (absAlong > halfW + 0.006) continue;

        const idx = py * N + px;

        // Leading-edge glistening foam ridge just ahead of the final blade position (t == 1)
        if (t >= 0.999 && perpSigned > bladeLip * 0.45 && perpSigned < bladeLip * 2.1 && absAlong <= halfW) {
          if (this.foam[idx] > 0.015 || pushedFoamSum > 0.05) {
            const rf = 1 - Math.abs(perpSigned - bladeLip * 1.2) / (bladeLip * 0.95);
            if (rf > 0) {
              const boost = rf * (0.045 + (absAlong / halfW) * 0.045);
              this.foam[idx] = Math.min(0.95, this.foam[idx] + boost);
              this.wet[idx] = Math.min(0.95, this.wet[idx] + boost * 0.8);
            }
          }
          continue;
        }

        if (absPerp > bladeLip) continue;

        // Crisp rubber blade edge: razor clean inside, realistic 4px feathered edge at extreme blade tips
        const tipSoft = absAlong > halfW - 0.005
          ? Math.max(0, 1 - (absAlong - (halfW - 0.005)) / 0.010)
          : 1.0;
        const lipSoft = absPerp > bladeLip * 0.65
          ? Math.max(0, 1 - (absPerp - bladeLip * 0.65) / (bladeLip * 0.35))
          : 1.0;
        const contact = Math.min(1, tipSoft * lipSoft);

        const prevFog = this.fog[idx];
        const prevDirt = this.dirt[idx];
        const prevFoam = this.foam[idx];
        const prevWet = this.wet[idx];

        const hasSoap = prevFoam > 0.03 || prevWet > 0.07;
        const dirtClear = hasSoap ? 0.995 : 0.78;

        this.fog[idx] = prevFog * (1 - contact * 0.995);
        this.dirt[idx] = prevDirt * (1 - contact * dirtClear);
        this.foam[idx] = prevFoam * (1 - contact * 0.992);

        // Ultra-thin wet sheen right behind the blade that evaporates cleanly over ~1.4s
        const sheen = hasSoap ? 0.20 : 0.07;
        this.wet[idx] = Math.max(prevWet * (1 - contact * 0.92), sheen * contact);

        // Subtle crisp thin water bead line at the outer blade corner tips when pushing foam
        if (absAlong > halfW - 0.004 && (prevFoam > 0.12 || prevWet > 0.14)) {
          this.wet[idx] = Math.min(0.82, this.wet[idx] + 0.22);
        }

        clearedSum += (prevFog - this.fog[idx]) + (prevDirt - this.dirt[idx]) + (prevFoam - this.foam[idx]);
        pushedFoamSum += prevFoam;
        wetSum += prevWet + prevFoam;
        sampleCount++;
      }
    }

    // Clear any active running drips swept over by the rubber blade!
    for (let i = this.drips.length - 1; i >= 0; i--) {
      const d = this.drips[i];
      const dx = d.u * aspect;
      const dy = d.v;
      let t = 1.0;
      if (moveLenSq > 1e-8) {
        const denom = mvx * nx + mvy * ny;
        t = Math.abs(denom) > 1e-4
          ? ((dx - p0x) * nx + (dy - p0y) * ny) / denom
          : ((dx - p0x) * mvx + (dy - p0y) * mvy) / moveLenSq;
        t = Math.max(0, Math.min(1, t));
      }
      const rx = dx - (p0x + mvx * t);
      const ry = dy - (p0y + mvy * t);
      if (Math.abs(rx * bx + ry * by) <= halfW + 0.015 && Math.abs(rx * nx + ry * ny) <= bladeLip * 2.5) {
        this.drips.splice(i, 1);
      }
    }

    // Spawn occasional delicate runoff bead at lower blade tip when pushing heavy foam
    if (sampleCount > 0 && moveLen > 0.012 && (pushedFoamSum / sampleCount) > 0.22 && Math.random() < 0.22 && this.drips.length < 24) {
      const tipSide = by > 0 ? -1 : 1;
      const tipU = u1 + (bx * halfW * tipSide) / aspect;
      const tipV = v1 + by * halfW * tipSide;
      if (tipU > 0.02 && tipU < 0.98 && tipV > 0.06 && tipV < 0.96) {
        this.drips.push({
          u: tipU,
          v: tipV,
          speed: 0.044 + Math.random() * 0.036,
          radius: 0.0022 + Math.random() * 0.0018,
          foamLoad: 0.24,
          life: 1.3 + Math.random() * 1.4,
        });
      }
    }

    this.dirty = true;
    return {
      clearedAmount: sampleCount > 0 ? clearedSum / sampleCount : 0,
      pushedFoam: sampleCount > 0 ? pushedFoamSum / sampleCount : 0,
      isWet: sampleCount > 0 ? (wetSum / sampleCount) > 0.06 : false,
    };
  }

  /** Continuous capsule bare-finger condensation trail */
  wipeBareFinger(u0, v0, u1, v1) {
    const N = this.res;
    const aspect = this.width / this.height;
    const radius = 0.025;
    const p0x = u0 * aspect, p0y = v0;
    const p1x = u1 * aspect, p1y = v1;
    const mvx = p1x - p0x, mvy = p1y - p0y;
    const lenSq = mvx * mvx + mvy * mvy;

    const minX = Math.max(0, Math.floor(((Math.min(p0x, p1x) - radius) / aspect) * N));
    const maxX = Math.min(N - 1, Math.ceil(((Math.max(p0x, p1x) + radius) / aspect) * N));
    const minY = Math.max(0, Math.floor((Math.min(p0y, p1y) - radius) * N));
    const maxY = Math.min(N - 1, Math.ceil((Math.max(p0y, p1y) + radius) * N));

    let cleared = 0;
    for (let py = minY; py <= maxY; py++) {
      const y = py / (N - 1);
      for (let px = minX; px <= maxX; px++) {
        const x = (px / (N - 1)) * aspect;
        let t = 0;
        if (lenSq > 1e-8) {
          t = Math.max(0, Math.min(1, ((x - p0x) * mvx + (y - p0y) * mvy) / lenSq));
        }
        const d = Math.hypot(x - (p0x + mvx * t), y - (p0y + mvy * t)) / radius;
        if (d > 1) continue;
        const idx = py * N + px;
        const w = 1 - d * d;
        const pf = this.fog[idx];
        this.fog[idx] *= (1 - w * 0.90);
        this.dirt[idx] *= (1 - w * 0.18);
        this.foam[idx] *= (1 - w * 0.65);
        this.wet[idx] = Math.min(0.66, this.wet[idx] + w * 0.24);
        cleared += (pf - this.fog[idx]);
      }
    }
    this.dirty = true;
    return cleared;
  }

  update(dt, elapsed) {
    this.uniforms.uTime.value = elapsed;
    const N = this.res;
    const aspect = this.width / this.height;
    let changed = false;

    for (let i = this.drips.length - 1; i >= 0; i--) {
      const d = this.drips[i];
      d.life -= dt;
      d.u += Math.sin(elapsed * 4.5 + i * 2.1) * 0.002 * dt;
      d.v -= d.speed * dt;
      d.speed = Math.min(0.10, d.speed + 0.011 * dt);

      if (d.life <= 0 || d.v < 0.012) {
        if (d.v < 0.025) {
          const px = Math.max(1, Math.min(N - 2, Math.floor(d.u * N)));
          for (let ox = -3; ox <= 3; ox++) {
            const p = Math.max(0, Math.min(N - 1, px + ox));
            const idx = 2 * N + p;
            this.foam[idx] = Math.min(0.85, this.foam[idx] + d.foamLoad * 0.22);
            this.wet[idx] = Math.min(0.9, this.wet[idx] + 0.35);
          }
          changed = true;
        }
        this.drips.splice(i, 1);
        continue;
      }

      const cx = Math.floor(d.u * N);
      const cy = Math.floor(d.v * N);
      const rx = Math.max(1, Math.ceil((d.radius / aspect) * N));
      const ry = Math.max(1, Math.ceil(d.radius * N * 1.35));
      for (let dy = -ry; dy <= ry; dy++) {
        const py = cy + dy;
        if (py < 0 || py >= N) continue;
        for (let dx = -rx; dx <= rx; dx++) {
          const px = cx + dx;
          if (px < 0 || px >= N) continue;
          const dist = Math.hypot(dx / rx, dy / ry);
          if (dist > 1) continue;
          const idx = py * N + px;
          const w = 1 - dist * dist;
          this.fog[idx] *= (1 - w * 0.62);
          this.wet[idx] = Math.min(0.88, Math.max(this.wet[idx], 0.64 * w));
          // Delicate translucent milky rim instead of thick opaque white tube
          this.foam[idx] = Math.min(0.52, this.foam[idx] + w * d.foamLoad * 0.075);
        }
      }
      changed = true;
    }

    this._dripAccum += dt;
    if (this._dripAccum > 0.065) {
      const stepDt = this._dripAccum;
      this._dripAccum = 0;
      const evapWet = stepDt * 0.26;
      const len = this.wet.length;
      for (let i = 0; i < len; i++) {
        if (this.wet[i] > 0.004) {
          this.wet[i] = Math.max(0, this.wet[i] - evapWet);
          changed = true;
        }
      }
    }

    if (this.dirty || changed) {
      this._syncTexture();
      this.dirty = false;
    }

    this._statsAccum += dt;
    if (this._statsAccum > 0.25) {
      this._statsAccum = 0;
      this._recomputeStats();
    }
  }

  _syncTexture() {
    const len = this.fog.length;
    const out = this.data;
    const fog = this.fog;
    const dirt = this.dirt;
    const foam = this.foam;
    const wet = this.wet;
    for (let i = 0; i < len; i++) {
      const o = i * 4;
      out[o] = Math.min(255, Math.max(0, (fog[i] * 255) | 0));
      out[o + 1] = Math.min(255, Math.max(0, (dirt[i] * 255) | 0));
      out[o + 2] = Math.min(255, Math.max(0, (foam[i] * 255) | 0));
      out[o + 3] = Math.min(255, Math.max(0, (wet[i] * 255) | 0));
    }
    this.stateTex.needsUpdate = true;
  }

  _recomputeStats() {
    const N = this.res;
    let cleanPixels = 0;
    let foamPixels = 0;
    let total = 0;
    for (let y = 16; y < N - 16; y += 8) {
      for (let x = 16; x < N - 16; x += 8) {
        const idx = y * N + x;
        total++;
        const obstruction = this.fog[idx] * 0.9 + this.dirt[idx] * 0.8 + this.foam[idx] * 0.7;
        if (obstruction < 0.16) cleanPixels++;
        if (this.foam[idx] > 0.18) foamPixels++;
      }
    }
    this.cleanRatio = total > 0 ? cleanPixels / total : 0;
    this.foamCoverage = total > 0 ? foamPixels / total : 0;
  }

  getPixelState(u, v) {
    const N = this.res;
    const px = Math.max(0, Math.min(N - 1, Math.floor(u * N)));
    const py = Math.max(0, Math.min(N - 1, Math.floor(v * N)));
    const idx = py * N + px;
    return {
      fog: this.fog[idx],
      dirt: this.dirt[idx],
      foam: this.foam[idx],
      wet: this.wet[idx],
    };
  }
}
