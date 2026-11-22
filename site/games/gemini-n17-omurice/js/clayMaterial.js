import * as THREE from '../vendor/three/three.module.min.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let sharedMaps = null;

function buildNormalCanvas(height, size, strengthN) {
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const nCtx = normalCanvas.getContext('2d');
  const nImg = nCtx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;

      const tl = height[ym * size + xm];
      const t = height[ym * size + x];
      const tr = height[ym * size + xp];
      const l = height[y * size + xm];
      const r = height[y * size + xp];
      const bl = height[yp * size + xm];
      const b = height[yp * size + x];
      const br = height[yp * size + xp];

      const gx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const gy = (bl + 2 * b + br) - (tl + 2 * t + tr);

      let nx = -gx * strengthN;
      let ny = -gy * strengthN;
      let nz = 1.0;
      const invLen = 1.0 / Math.hypot(nx, ny, nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const p = (y * size + x) * 4;
      nImg.data[p] = Math.round((nx * 0.5 + 0.5) * 255);
      nImg.data[p + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nImg.data[p + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      nImg.data[p + 3] = 255;
    }
  }
  nCtx.putImageData(nImg, 0, 0);
  return normalCanvas;
}

function generateClayMaps() {
  if (sharedMaps) return sharedMaps;

  const size = 512;
  const height = new Float32Array(size * size);
  const softHeight = new Float32Array(size * size);
  const rand = mulberry32(20261122);

  // 1. Broad hand-kneaded clay undulations + matte plasticine micro-grain
  const waves = [];
  for (let i = 0; i < 14; i++) {
    waves.push({
      fx: (Math.floor(rand() * 4) + 1) * (rand() > 0.5 ? 1 : -1),
      fy: (Math.floor(rand() * 4) + 1) * (rand() > 0.5 ? 1 : -1),
      phase: rand() * Math.PI * 2,
      amp: 0.015 + rand() * 0.02,
    });
  }

  for (let y = 0; y < size; y++) {
    const ny = (y / size) * Math.PI * 2;
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * Math.PI * 2;
      let v = 0.5;
      for (let w = 0; w < waves.length; w++) {
        const wave = waves[w];
        v += Math.sin(nx * wave.fx + ny * wave.fy + wave.phase) * wave.amp;
      }
      const grain = (rand() - 0.5) * 0.02;
      softHeight[y * size + x] = v + grain * 0.7;
      height[y * size + x] = v + grain;
    }
  }

  // 2. Authentic fingertip & thumbprint impressions: mostly curved arch & loop ridges (natural human prints, NOT bullseye targets!)
  const prints = 28;
  for (let p = 0; p < prints; p++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const rx = 20 + rand() * 18;
    const ry = rx * (1.25 + rand() * 0.35);
    const angle = rand() * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const ridgeFreq = 1.15 + rand() * 0.32;
    const strength = 0.032 + rand() * 0.022;
    const isLoop = rand() < 0.35;
    const dentDepth = 0.028 + rand() * 0.022;
    const curvature = 0.012 + rand() * 0.014;
    const bound = Math.ceil(Math.max(rx, ry)) + 2;

    for (let dy = -bound; dy <= bound; dy++) {
      for (let dx = -bound; dx <= bound; dx++) {
        const lx = dx * cosA + dy * sinA;
        const ly = -dx * sinA + dy * cosA;
        const ux = lx / rx;
        const uy = ly / ry;
        const r2 = ux * ux + uy * uy;
        if (r2 >= 1.0) continue;

        const falloff = Math.pow(1.0 - r2, 2.0);
        let ridgeVal;
        if (isLoop) {
          // Hairpin ulnar/radial loop ridge (realistic thumbprint!)
          const loopDist = Math.hypot(lx * 0.85, Math.max(0, ly + ry * 0.25)) + Math.min(0, ly + ry * 0.25) * 0.35;
          ridgeVal = Math.sin(loopDist * ridgeFreq);
        } else {
          // Gentle tented arch fingerprint ridges
          const archCurve = ly + curvature * lx * lx / (1.0 + 0.002 * lx * lx);
          ridgeVal = Math.sin(archCurve * ridgeFreq);
        }

        const px = ((Math.round(cx + dx) % size) + size) % size;
        const py = ((Math.round(cy + dy) % size) + size) % size;
        const idx = py * size + px;
        height[idx] += falloff * (-dentDepth + ridgeVal * strength);
        // Very soft thumb-smoothed dent only (no noisy ridges) on background walls
        softHeight[idx] += falloff * (-dentDepth * 0.55);
      }
    }
  }

  // 3. Soft clay smoothing dimples & tiny natural pores
  for (let i = 0; i < 60; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const rad = 2.0 + rand() * 4.2;
    const depth = (rand() > 0.38 ? -1 : 1) * (0.022 + rand() * 0.024);
    const rInt = Math.ceil(rad);
    for (let dy = -rInt; dy <= rInt; dy++) {
      for (let dx = -rInt; dx <= rInt; dx++) {
        const d2 = (dx * dx + dy * dy) / (rad * rad);
        if (d2 >= 1) continue;
        const px = ((Math.round(cx + dx) % size) + size) % size;
        const py = ((Math.round(cy + dy) % size) + size) % size;
        height[py * size + px] += (1 - d2) * depth;
      }
    }
  }

  const normalCanvas = buildNormalCanvas(height, size, 1.95);
  const softNormalCanvas = buildNormalCanvas(softHeight, size, 1.15);

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');
  const rImg = rCtx.createImageData(size, size);

  const mottleCanvas = document.createElement('canvas');
  mottleCanvas.width = size;
  mottleCanvas.height = size;
  const mCtx = mottleCanvas.getContext('2d');
  const mImg = mCtx.createImageData(size, size);

  for (let i = 0; i < size * size; i++) {
    const c = height[i];
    const p = i * 4;
    const clampH = Math.max(0, Math.min(1, c));
    const roughVal = Math.round((0.86 - clampH * 0.14) * 255);
    rImg.data[p] = roughVal;
    rImg.data[p + 1] = roughVal;
    rImg.data[p + 2] = roughVal;
    rImg.data[p + 3] = 255;

    const mot = Math.round(245 + clampH * 10);
    mImg.data[p] = Math.min(255, mot + 1);
    mImg.data[p + 1] = Math.min(255, mot);
    mImg.data[p + 2] = Math.max(236, mot - 2);
    mImg.data[p + 3] = 255;
  }

  rCtx.putImageData(rImg, 0, 0);
  mCtx.putImageData(mImg, 0, 0);

  const configureTex = (canvas, isColor = false) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 2;
    if (isColor) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    tex.needsUpdate = true;
    return tex;
  };

  const normalMap = configureTex(normalCanvas, false);
  const softNormalMap = configureTex(softNormalCanvas, false);
  const roughnessMap = configureTex(roughCanvas, false);
  const mottleMap = configureTex(mottleCanvas, true);

  normalMap.repeat.set(1.6, 1.6);
  softNormalMap.repeat.set(1.4, 1.4);
  roughnessMap.repeat.set(1.6, 1.6);
  mottleMap.repeat.set(1.6, 1.6);

  sharedMaps = {
    normalMap,
    softNormalMap,
    roughnessMap,
    mottleMap,
  };

  return sharedMaps;
}

let woodClayTex = null;
export function getWoodClayTexture() {
  if (woodClayTex) return woodClayTex;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(99812);

  ctx.fillStyle = '#cf9f70';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 36; i++) {
    const y = (i / 36) * size;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(145, 96, 56, 0.16)' : 'rgba(240, 210, 172, 0.14)';
    ctx.lineWidth = 4 + rand() * 7;
    ctx.beginPath();
    ctx.moveTo(0, y);
    const amp = 3 + rand() * 6;
    const freq = 1 + Math.floor(rand() * 2);
    const phase = rand() * Math.PI * 2;
    for (let x = 0; x <= size; x += 16) {
      const yy = y + Math.sin((x / size) * Math.PI * 2 * freq + phase) * amp;
      ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 28; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 28 + rand() * 55;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, rand() > 0.5 ? 'rgba(162, 114, 70, 0.09)' : 'rgba(248, 224, 192, 0.09)');
    grad.addColorStop(1, 'rgba(207, 159, 112, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  woodClayTex = new THREE.CanvasTexture(canvas);
  woodClayTex.wrapS = THREE.RepeatWrapping;
  woodClayTex.wrapT = THREE.RepeatWrapping;
  woodClayTex.colorSpace = THREE.SRGBColorSpace;
  return woodClayTex;
}

let tileClayTex = null;
export function getClayTileTexture() {
  if (tileClayTex) return tileClayTex;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(44109);

  ctx.fillStyle = '#d6bfa0';
  ctx.fillRect(0, 0, size, size);

  const cols = 4;
  const rows = 4;
  const tileW = size / cols;
  const tileH = size / rows;
  const palette = ['#f5e8d6', '#f2e2cd', '#f7ecdc', '#eedac0', '#f4e4cf'];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * tileW + 5;
      const y = r * tileH + 5;
      const w = tileW - 10;
      const h = tileH - 10;
      ctx.fillStyle = palette[Math.floor(rand() * palette.length)];

      ctx.beginPath();
      ctx.roundRect(
        x + (rand() - 0.5) * 2.5,
        y + (rand() - 0.5) * 2.5,
        w + (rand() - 0.5) * 2,
        h + (rand() - 0.5) * 2,
        12
      );
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 250, 240, 0.45)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  tileClayTex = new THREE.CanvasTexture(canvas);
  tileClayTex.wrapS = THREE.RepeatWrapping;
  tileClayTex.wrapT = THREE.RepeatWrapping;
  tileClayTex.colorSpace = THREE.SRGBColorSpace;
  return tileClayTex;
}

/**
 * Create a genuine modeling-clay material with realistic hand-pressed fingerprints & warm waxy-matte finish
 */
export function createClayMaterial(color, opts = {}) {
  const maps = generateClayMaps();
  const map = opts.map !== undefined ? opts.map : maps.mottleMap;
  const nMap = opts.softSurface ? maps.softNormalMap : maps.normalMap;

  const baseStrength = opts.normalStrength !== undefined ? opts.normalStrength : 0.78;
  const finalN = baseStrength * 0.62;

  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    map,
    normalMap: nMap,
    normalScale: new THREE.Vector2(finalN, finalN),
    roughnessMap: maps.roughnessMap,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.82,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.02,
    side: opts.side !== undefined ? opts.side : THREE.FrontSide,
    transparent: Boolean(opts.transparent),
    opacity: opts.opacity !== undefined ? opts.opacity : 1.0,
    emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: opts.emissiveIntensity || 0,
  });
}

export function createGlossyClayMaterial(color, opts = {}) {
  return createClayMaterial(color, {
    roughness: opts.roughness !== undefined ? opts.roughness : 0.3,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.04,
    normalStrength: opts.normalStrength !== undefined ? opts.normalStrength : 0.48,
    ...opts,
  });
}

export function getSharedClayMaps() {
  return generateClayMaps();
}
