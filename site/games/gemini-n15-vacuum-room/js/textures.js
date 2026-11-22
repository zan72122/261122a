import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Seeded PRNG for deterministic realistic micro-textures
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

/**
 * Brushed anodized aluminum (for vacuum wand & metallic trim)
 */
export function createBrushedMetalTextures() {
  const w = 512, h = 512;
  const rand = mulberry32(101);

  const roughCanvas = makeCanvas(w, h);
  const rCtx = roughCanvas.getContext('2d');
  rCtx.fillStyle = '#525252';
  rCtx.fillRect(0, 0, w, h);

  const bumpCanvas = makeCanvas(w, h);
  const bCtx = bumpCanvas.getContext('2d');
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, w, h);

  for (let i = 0; i < 2400; i++) {
    const y = rand() * h;
    const x = rand() * w;
    const len = 60 + rand() * 260;
    const rv = Math.floor(62 + rand() * 58);
    const bv = Math.floor(110 + rand() * 36);
    rCtx.fillStyle = `rgba(${rv},${rv},${rv},0.22)`;
    rCtx.fillRect(x, y, len, 1);
    bCtx.fillStyle = `rgba(${bv},${bv},${bv},0.25)`;
    bCtx.fillRect(x, y, len, 1);
  }

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 4);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 4);

  return { roughnessMap, bumpMap };
}

/**
 * Satin matte molded ABS / soft-touch polymer micro-grain
 */
export function createMattePolymerTextures() {
  const w = 256, h = 256;
  const rand = mulberry32(202);
  const rCanvas = makeCanvas(w, h);
  const rCtx = rCanvas.getContext('2d');
  const img = rCtx.createImageData(w, h);

  const bCanvas = makeCanvas(w, h);
  const bCtx = bCanvas.getContext('2d');
  const bImg = bCtx.createImageData(w, h);

  for (let i = 0; i < w * h; i++) {
    const n = (rand() + rand()) * 0.5;
    const rv = Math.floor(135 + (n - 0.5) * 38);
    const bv = Math.floor(128 + (n - 0.5) * 44);
    const idx = i * 4;
    img.data[idx] = img.data[idx + 1] = img.data[idx + 2] = rv;
    img.data[idx + 3] = 255;
    bImg.data[idx] = bImg.data[idx + 1] = bImg.data[idx + 2] = bv;
    bImg.data[idx + 3] = 255;
  }
  rCtx.putImageData(img, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(4, 4);

  const bumpMap = new THREE.CanvasTexture(bCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(4, 4);

  return { roughnessMap, bumpMap };
}

/**
 * Fine perforated stainless steel mesh shroud inside transparent cyclone cup
 */
export function createCycloneMeshTextures() {
  const w = 512, h = 256;
  const colCanvas = makeCanvas(w, h);
  const cCtx = colCanvas.getContext('2d');
  cCtx.fillStyle = '#6c727a';
  cCtx.fillRect(0, 0, w, h);

  const bumpCanvas = makeCanvas(w, h);
  const bCtx = bumpCanvas.getContext('2d');
  bCtx.fillStyle = '#d4d4d4';
  bCtx.fillRect(0, 0, w, h);

  const stepX = 12;
  const stepY = 12;
  for (let row = 0; row < h / stepY; row++) {
    const offset = (row % 2) * (stepX * 0.5);
    for (let col = -1; col < w / stepX + 1; col++) {
      const cx = col * stepX + offset;
      const cy = row * stepY + 6;
      cCtx.fillStyle = '#0f1114';
      cCtx.beginPath();
      cCtx.arc(cx, cy, 3.6, 0, Math.PI * 2);
      cCtx.fill();

      bCtx.fillStyle = '#0c0c0c';
      bCtx.beginPath();
      bCtx.arc(cx, cy, 3.8, 0, Math.PI * 2);
      bCtx.fill();
    }
  }

  // Subtle horizontal brushed band lines top/bottom
  cCtx.fillStyle = '#8b929b';
  cCtx.fillRect(0, 0, w, 18);
  cCtx.fillRect(0, h - 18, w, 18);

  const map = new THREE.CanvasTexture(colCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 1);

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 1);

  return { map, bumpMap };
}

/**
 * Subtle real polycarbonate roughness variation (faint dust-cup micro-swirl wear)
 */
export function createAcrylicRoughnessTexture() {
  const w = 512, h = 256;
  const rand = mulberry32(303);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#141414'; // base ~0.08 roughness
  ctx.fillRect(0, 0, w, h);

  // Subtle horizontal cyclone swirl micro-haze in lower-middle cup area
  for (let i = 0; i < 650; i++) {
    const x = rand() * w;
    const y = h * 0.18 + rand() * h * 0.72;
    const len = 30 + rand() * 140;
    const alpha = 0.03 + rand() * 0.08;
    ctx.strokeStyle = `rgba(110,110,110,${alpha})`;
    ctx.lineWidth = 0.7 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (rand() - 0.5) * 4);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Soft woven microfiber roller brush texture (for spinning floor-head brush)
 */
export function createRollerBrushTextures() {
  const w = 512, h = 256;
  const rand = mulberry32(404);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3c434d'; // muted charcoal velour
  ctx.fillRect(0, 0, w, h);

  // Diagonal woven soft-roller stripes (crisp visible rotation cue when vacuuming!)
  ctx.save();
  ctx.lineWidth = 42;
  ctx.strokeStyle = '#607a94';
  for (let x = -h; x < w + h; x += 108) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + h * 0.85, h);
    ctx.stroke();
  }
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#b0513c';
  for (let x = -h + 48; x < w + h; x += 108) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + h * 0.85, h);
    ctx.stroke();
  }
  ctx.restore();

  // Velour fiber micro-noise
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const jitter = (rand() - 0.5) * 26;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + jitter));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + jitter));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + jitter));
  }
  ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return { map };
}

/**
 * Natural human skin micro-texture (subtle warmth variation, pore micro-bump & natural oiliness roughness)
 */
export function createSkinTextures() {
  const w = 512, h = 512;
  const rand = mulberry32(505);

  const colCanvas = makeCanvas(w, h);
  const cCtx = colCanvas.getContext('2d');
  cCtx.fillStyle = '#deb498';
  cCtx.fillRect(0, 0, w, h);

  // Soft natural skin tone mottling (subtle warm rose / pale peach patches like real photographed skin)
  for (let i = 0; i < 160; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 18 + rand() * 55;
    const g = cCtx.createRadialGradient(x, y, 2, x, y, r);
    const warm = rand() > 0.45;
    g.addColorStop(0, warm ? 'rgba(205, 134, 108, 0.09)' : 'rgba(236, 206, 180, 0.09)');
    g.addColorStop(1, 'rgba(222, 180, 152, 0)');
    cCtx.fillStyle = g;
    cCtx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Fine skin-grain pores & knuckle crease micro-bump
  const bumpCanvas = makeCanvas(w, h);
  const bCtx = bumpCanvas.getContext('2d');
  const bImg = bCtx.createImageData(w, h);
  const rCanvas = makeCanvas(w, h);
  const rCtx = rCanvas.getContext('2d');
  const rImg = rCtx.createImageData(w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const n1 = rand();
      const crease = Math.sin(y * 0.28 + Math.sin(x * 0.06) * 1.4) * 6;
      const bv = Math.max(0, Math.min(255, Math.floor(128 + (n1 - 0.5) * 32 + crease)));
      const rv = Math.max(0, Math.min(255, Math.floor(138 + (n1 - 0.5) * 30)));
      bImg.data[idx] = bImg.data[idx + 1] = bImg.data[idx + 2] = bv;
      bImg.data[idx + 3] = 255;
      rImg.data[idx] = rImg.data[idx + 1] = rImg.data[idx + 2] = rv;
      rImg.data[idx + 3] = 255;
    }
  }
  bCtx.putImageData(bImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  const map = new THREE.CanvasTexture(colCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 3);

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 2);

  return { map, bumpMap, roughnessMap };
}

/**
 * Baked soft ambient occlusion contact shadow texture (radial falloff)
 */
export function createContactShadowTexture() {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.04, s / 2, s / 2, s * 0.49);
  g.addColorStop(0.0, 'rgba(18, 13, 9, 0.72)');
  g.addColorStop(0.35, 'rgba(20, 14, 10, 0.46)');
  g.addColorStop(0.68, 'rgba(22, 16, 11, 0.16)');
  g.addColorStop(1.0, 'rgba(22, 16, 11, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Baked rectangular soft shadow texture (for under sofa, rug, and floor head)
 */
export function createRectShadowTexture() {
  const w = 256, h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Layered blurred rounded rect for natural diffuse under-furniture occlusion
  for (let i = 0; i < 16; i++) {
    const pad = 12 + i * 5.2;
    const alpha = 0.055;
    ctx.fillStyle = `rgba(16, 12, 8, ${alpha})`;
    ctx.beginPath();
    ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, 28);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Soft warm sunlight floor gobo / window light pool texture (subtle natural daylight realism)
 */
export function createSunbeamPoolTexture() {
  const w = 256, h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Soft sunlit window panes with gentle blurred mullion shadow
  ctx.save();
  ctx.filter = 'blur(8px)';
  ctx.fillStyle = 'rgba(255, 244, 218, 0.24)';
  ctx.fillRect(28, 28, 92, 92);
  ctx.fillRect(136, 28, 92, 92);
  ctx.fillRect(28, 136, 92, 92);
  ctx.fillRect(136, 136, 92, 92);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Woven Scandinavian oatmeal-flax living-room rug albedo (paired with Poly Haven rough_linen normal & ARM)
 */
export function createWovenRugAlbedoTexture() {
  const w = 1024, h = 512;
  const rand = mulberry32(707);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  // Richer natural unbleached flax-oatmeal base (lets white paper scraps & crumbs pop naturally!)
  ctx.fillStyle = '#c8bca9';
  ctx.fillRect(0, 0, w, h);

  // Tactile handwoven horizontal weft yarn bands (real cotton-jute rug texture visible at camera distance)
  for (let y = 0; y < h; y += 3) {
    const shade = (rand() - 0.5) * 32;
    const warm = (rand() - 0.5) * 10;
    const r = Math.min(255, Math.max(0, 198 + shade + warm));
    const g = Math.min(255, Math.max(0, 186 + shade));
    const b = Math.min(255, Math.max(0, 167 + shade - warm));
    ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},0.72)`;
    ctx.fillRect(0, y, w, 2.2);
  }

  // Visible vertical warp weave slubs & subtle woven diamond-rib texture
  for (let x = 0; x < w; x += 4) {
    const shade = (rand() - 0.5) * 28;
    const r = Math.min(255, Math.max(0, 192 + shade));
    const g = Math.min(255, Math.max(0, 180 + shade));
    const b = Math.min(255, Math.max(0, 162 + shade));
    ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},0.42)`;
    ctx.fillRect(x, 0, 2, h);
  }

  // Natural woven heather flecks (authentic unbleached wool/flax yarn fibers)
  for (let i = 0; i < 3200; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 3 + rand() * 9;
    const dark = rand() > 0.42;
    ctx.fillStyle = dark ? 'rgba(128, 114, 96, 0.24)' : 'rgba(232, 224, 210, 0.22)';
    ctx.fillRect(x, y, len, 1.5);
  }

  // Subtle woven muted taupe-slate geometric end stripes (left & right ends)
  const drawStripe = (x, width, color) => {
    ctx.fillStyle = color;
    for (let y = 0; y < h; y += 2) {
      const jitter = (rand() - 0.5) * 2;
      ctx.fillRect(x + jitter, y, width, 1.6);
    }
  };
  drawStripe(50, 24, 'rgba(116, 105, 92, 0.65)');
  drawStripe(84, 8, 'rgba(95, 106, 114, 0.58)');
  drawStripe(w - 74, 24, 'rgba(116, 105, 92, 0.65)');
  drawStripe(w - 92, 8, 'rgba(95, 106, 114, 0.58)');

  // Stitched selvedge border shading along outer edges
  ctx.fillStyle = 'rgba(130, 118, 102, 0.42)';
  ctx.fillRect(0, 0, w, 12);
  ctx.fillRect(0, h - 12, w, 12);
  ctx.fillRect(0, 0, 10, h);
  ctx.fillRect(w - 10, 0, 10, h);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Subtle matte organic botanical linen art print for framed living-room wall decor (zero text, photographic feel)
 */
export function createFramedWallArtTexture() {
  const w = 512, h = 384;
  const rand = mulberry32(909);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  // Warm unbleached rag-paper mat background
  ctx.fillStyle = '#ece6db';
  ctx.fillRect(0, 0, w, h);

  // Subtle paper fiber noise
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 9;
    img.data[i] = Math.min(255, Math.max(0, img.data[i] + n));
    img.data[i + 1] = Math.min(255, Math.max(0, img.data[i + 1] + n));
    img.data[i + 2] = Math.min(255, Math.max(0, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  // Inner mat bevel cutout (warm oatmeal paper print inset)
  const mx = 46, my = 40, mw = w - mx * 2, mh = h - my * 2;
  ctx.fillStyle = '#e0d6c6';
  ctx.fillRect(mx, my, mw, mh);

  // Soft recessed mat inner edge shadow (top & left slightly darker from right-hand window sun)
  ctx.strokeStyle = 'rgba(110, 96, 80, 0.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(mx + 1, my + 1, mw - 2, mh - 2);

  // Minimalist warm abstract landscape / organic botanical wash (muted clay, sage, warm sand)
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx + 2, my + 2, mw - 4, mh - 4);
  ctx.clip();

  // Soft sunlit wash
  const wash = ctx.createLinearGradient(mx, my, mx + mw, my + mh);
  wash.addColorStop(0, '#e5dccb');
  wash.addColorStop(0.55, '#dcd1be');
  wash.addColorStop(1, '#cfc2ac');
  ctx.fillStyle = wash;
  ctx.fillRect(mx, my, mw, mh);

  // Soft organic warm terracotta / ochre hill arc
  ctx.fillStyle = 'rgba(176, 138, 108, 0.42)';
  ctx.beginPath();
  ctx.ellipse(mx + mw * 0.34, my + mh * 0.84, mw * 0.52, mh * 0.44, -0.08, 0, Math.PI * 2);
  ctx.fill();

  // Muted sage-olive soft curve
  ctx.fillStyle = 'rgba(120, 132, 114, 0.36)';
  ctx.beginPath();
  ctx.ellipse(mx + mw * 0.72, my + mh * 0.9, mw * 0.48, mh * 0.38, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Delicate dried-stem botanical sprig (fine charcoal-taupe watercolor strokes)
  ctx.strokeStyle = 'rgba(84, 78, 69, 0.56)';
  ctx.lineWidth = 2.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(mx + mw * 0.46, my + mh * 0.96);
  ctx.quadraticCurveTo(mx + mw * 0.48, my + mh * 0.58, mx + mw * 0.57, my + mh * 0.22);
  ctx.stroke();

  const leaves = [
    [0.48, 0.74, -0.72, 26, 11],
    [0.5, 0.63, 0.64, 24, 10],
    [0.51, 0.51, -0.68, 25, 10],
    [0.53, 0.41, 0.58, 21, 9],
    [0.55, 0.31, -0.58, 18, 8],
    [0.57, 0.21, 0.14, 15, 7],
  ];
  ctx.fillStyle = 'rgba(98, 106, 92, 0.46)';
  for (const [fx, fy, ang, rx, ry] of leaves) {
    ctx.save();
    ctx.translate(mx + mw * fx, my + mh * fy);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.ellipse(rx * 0.65, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Soft sandy-dust floor smudge texture (fades away cleanly as the vacuum sweeps over sand clusters!)
 */
export function createDustSmudgeTexture() {
  const s = 128;
  const rand = mulberry32(612);
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);

  const g = ctx.createRadialGradient(s * 0.5, s * 0.5, s * 0.06, s * 0.5, s * 0.5, s * 0.48);
  g.addColorStop(0, 'rgba(182, 162, 134, 0.42)');
  g.addColorStop(0.55, 'rgba(176, 156, 128, 0.22)');
  g.addColorStop(1, 'rgba(176, 156, 128, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);

  // Subtle fine grit specks inside the smudge
  for (let i = 0; i < 220; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * (s * 0.44);
    const x = s * 0.5 + Math.cos(a) * d;
    const y = s * 0.5 + Math.sin(a) * d;
    const alpha = (1 - d / (s * 0.46)) * (0.18 + rand() * 0.28);
    ctx.fillStyle = rand() > 0.4 ? `rgba(148, 128, 102, ${alpha})` : `rgba(218, 204, 182, ${alpha})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Clean warm sunlit interior painted plaster albedo (paired with Poly Haven white_plaster_02 normal & ARM)
 */
export function createWarmPlasterAlbedoTexture() {
  const w = 512, h = 512;
  const rand = mulberry32(808);
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  // Natural directional afternoon daylight gradient (brighter & warmer toward the right-side window!)
  const grad = ctx.createLinearGradient(0, 0, w, h * 0.85);
  grad.addColorStop(0, '#e3d9cb');
  grad.addColorStop(0.55, '#ece3d6');
  grad.addColorStop(1, '#f4ecdf');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle vertical floor-bounce darkening near bottom
  const vGrad = ctx.createLinearGradient(0, 0, 0, h);
  vGrad.addColorStop(0, 'rgba(255,250,242,0.06)');
  vGrad.addColorStop(0.75, 'rgba(0,0,0,0)');
  vGrad.addColorStop(1, 'rgba(130,112,92,0.12)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, w, h);

  // Very gentle natural matte paint/plaster tonal variation (never flat CG white)
  for (let i = 0; i < 140; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const rad = 28 + rand() * 85;
    const g = ctx.createRadialGradient(x, y, 4, x, y, rad);
    const bright = rand() > 0.45;
    g.addColorStop(0, bright ? 'rgba(255,250,242,0.06)' : 'rgba(182,168,150,0.055)');
    g.addColorStop(1, 'rgba(235,226,214,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

