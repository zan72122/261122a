import * as THREE from '../vendor/three.module.js';

// Seeded PRNG for crisp reproducible procedural papercraft textures (all <= 512px)
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function createPaperBumpTexture() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(1017);

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // Subtle pressed-pulp mottling
  for (let i = 0; i < 2400; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 1 + rng() * 5;
    const v = Math.floor(110 + rng() * 36);
    ctx.fillStyle = `rgba(${v},${v},${v},0.16)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine paper fibers
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 2200; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const ang = rng() * Math.PI * 2;
    const len = 4 + rng() * 14;
    const v = rng() > 0.5 ? 168 : 90;
    ctx.strokeStyle = `rgba(${v},${v},${v},0.22)`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function createKraftTexture() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(2029);

  ctx.fillStyle = '#d2b48c';
  ctx.fillRect(0, 0, size, size);

  // Subtle horizontal cardstock deckle tone bands
  for (let y = 0; y < size; y += 8) {
    const shift = (rng() - 0.5) * 10;
    ctx.fillStyle = `rgba(${205 + shift}, ${174 + shift}, ${134 + shift}, 0.22)`;
    ctx.fillRect(0, y, size, 8);
  }

  // Natural kraft pulp flecks
  for (let i = 0; i < 3200; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const w = 1 + rng() * 3.5;
    const h = 0.8 + rng() * 2;
    const dark = rng() > 0.3;
    ctx.fillStyle = dark ? 'rgba(128,88,52,0.18)' : 'rgba(248,236,216,0.22)';
    ctx.fillRect(x, y, w, h);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function createGinghamTexture() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(3037);

  ctx.fillStyle = '#fdf4e6';
  ctx.fillRect(0, 0, size, size);

  const step = 64;
  ctx.fillStyle = 'rgba(235, 134, 126, 0.34)';
  for (let x = 0; x < size; x += step * 2) {
    ctx.fillRect(x, 0, step, size);
  }
  for (let y = 0; y < size; y += step * 2) {
    ctx.fillRect(0, y, size, step);
  }

  // Crisp paper-cut speckle overlay
  for (let i = 0; i < 1600; i++) {
    const x = rng() * size;
    const y = rng() * size;
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(160,115,95,0.08)';
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

function createStripeBoxTexture() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(4049);

  ctx.fillStyle = '#fff5ee';
  ctx.fillRect(0, 0, size, size);

  const stripeW = 32;
  for (let x = 0; x < size; x += stripeW * 2) {
    ctx.fillStyle = '#f6a7b6';
    ctx.fillRect(x, 0, stripeW, size);
    // Thin white paper seam highlight
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(x, 0, 2, size);
  }

  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(180,100,115,0.07)';
    ctx.fillRect(rng() * size, rng() * size, 2, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

function createCorrugatedBumpTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  for (let x = 0; x < size; x++) {
    const wave = Math.sin((x / size) * Math.PI * 2 * 24) * 0.5 + 0.5;
    const v = Math.floor(55 + wave * 155);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, 0, 1, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

function createRainbowTexture() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const colors = ['#f56f89', '#ffbe55', '#ffe76b', '#67d4b3', '#6db6f5', '#b58ef5'];
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-Math.PI / 5);
  const band = 42;
  for (let i = -14; i < 14; i++) {
    ctx.fillStyle = colors[((i % colors.length) + colors.length) % colors.length];
    ctx.fillRect(-size, i * band, size * 2, band);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-size, i * band, size * 2, 3);
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createWallpaperTexture() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const rng = mulberry32(5051);

  ctx.fillStyle = '#dce7de';
  ctx.fillRect(0, 0, size, size);

  // Layered paper diamond-dot motif
  const step = 64;
  for (let y = 0; y < size + step; y += step) {
    for (let x = 0; x < size + step; x += step) {
      const ox = (Math.floor(y / step) % 2) * (step / 2);
      ctx.fillStyle = 'rgba(255, 252, 245, 0.42)';
      ctx.beginPath();
      ctx.arc(x + ox, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(95,120,105,0.06)';
    ctx.fillRect(rng() * size, rng() * size, 2, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}

function createLaceDoilyTexture() {
  const size = 512;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Scalloped paper base
  ctx.fillStyle = '#fcf8f1';
  ctx.beginPath();
  const lobes = 28;
  for (let i = 0; i <= 360; i++) {
    const a = (i / 360) * Math.PI * 2;
    const r = 236 + Math.abs(Math.sin(a * lobes * 0.5)) * 14;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  // Embossed inner ring
  ctx.strokeStyle = 'rgba(205, 190, 170, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 182, 0, Math.PI * 2);
  ctx.stroke();

  // Die-cut lace punch holes around rim
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 212, cy + Math.sin(a) * 212, 9.5, 0, Math.PI * 2);
    ctx.fill();

    const a2 = ((i + 0.5) / lobes) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a2) * 195, cy + Math.sin(a2) * 195, 5.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createOvenArcTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Paper pie segments representing heat (ZERO numbers!)
  const segments = [
    { start: -Math.PI * 0.85, end: -Math.PI * 0.45, color: '#efe5d6' },
    { start: -Math.PI * 0.45, end: -Math.PI * 0.05, color: '#ffd460' },
    { start: -Math.PI * 0.05, end: Math.PI * 0.35, color: '#ff9642' },
    { start: Math.PI * 0.35, end: Math.PI * 0.72, color: '#e65c43' },
  ];

  for (const seg of segments) {
    ctx.beginPath();
    ctx.arc(cx, cy, 114, seg.start, seg.end);
    ctx.arc(cx, cy, 78, seg.end, seg.start, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();
    ctx.strokeStyle = '#fbf6ee';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // Cute paper sun-dots along the warm zone
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.75 + (i / 6) * Math.PI * 1.38;
    ctx.fillStyle = i >= 4 ? '#fff6eb' : '#9c7861';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 96, cy + Math.sin(a) * 96, 4.5 + i * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class MaterialLibrary {
  constructor() {
    this.paperBump = createPaperBumpTexture();
    this.kraftTex = createKraftTexture();
    this.ginghamTex = createGinghamTexture();
    this.stripeBoxTex = createStripeBoxTexture();
    this.corrugatedBump = createCorrugatedBumpTexture();
    this.rainbowTex = createRainbowTexture();
    this.wallpaperTex = createWallpaperTexture();
    this.laceDoilyTex = createLaceDoilyTexture();
    this.ovenArcTex = createOvenArcTexture();

    this.cache = new Map();
    this.layeredCache = new Map();

    // Common shared materials
    this.paperEdgeWhite = this.paper('#fbf5ea', { roughness: 0.94, bumpScale: 0.01 });
    this.shadowPaper = new THREE.MeshBasicMaterial({
      color: 0x3b2618,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    });
    this.kraftMat = new THREE.MeshStandardMaterial({
      map: this.kraftTex,
      bumpMap: this.paperBump,
      bumpScale: 0.022,
      roughness: 0.92,
      metalness: 0.0,
    });
    this.ginghamMat = new THREE.MeshStandardMaterial({
      map: this.ginghamTex,
      bumpMap: this.paperBump,
      bumpScale: 0.016,
      roughness: 0.9,
      metalness: 0.0,
    });
    this.stripeBoxMat = new THREE.MeshStandardMaterial({
      map: this.stripeBoxTex,
      bumpMap: this.paperBump,
      bumpScale: 0.018,
      roughness: 0.86,
      metalness: 0.0,
    });
    this.wallpaperMat = new THREE.MeshStandardMaterial({
      map: this.wallpaperTex,
      bumpMap: this.paperBump,
      bumpScale: 0.015,
      roughness: 0.94,
      metalness: 0.0,
    });
    this.rainbowMat = new THREE.MeshStandardMaterial({
      map: this.rainbowTex,
      bumpMap: this.paperBump,
      bumpScale: 0.016,
      roughness: 0.82,
      metalness: 0.0,
    });
    this.laceDoilyMat = new THREE.MeshStandardMaterial({
      map: this.laceDoilyTex,
      bumpMap: this.paperBump,
      bumpScale: 0.012,
      transparent: true,
      alphaTest: 0.35,
      roughness: 0.92,
      side: THREE.DoubleSide,
    });
    this.ovenArcMat = new THREE.MeshBasicMaterial({
      map: this.ovenArcTex,
      transparent: true,
      depthWrite: false,
    });
    this.vellumMat = new THREE.MeshStandardMaterial({
      color: 0xfff8ee,
      transparent: true,
      opacity: 0.34,
      roughness: 0.5,
      metalness: 0.05,
      depthWrite: false,
    });
  }

  paper(hex, opts = {}) {
    const key = `${hex}_${opts.roughness ?? 0.9}_${opts.corrugated ? 1 : 0}_${opts.opacity ?? 1}_${opts.side ?? 0}`;
    if (!opts.unique && this.cache.has(key)) return this.cache.get(key);

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      bumpMap: opts.corrugated ? this.corrugatedBump : this.paperBump,
      bumpScale: opts.bumpScale ?? (opts.corrugated ? 0.032 : 0.018),
      roughness: opts.roughness ?? 0.9,
      metalness: opts.metalness ?? 0.0,
      transparent: opts.opacity !== undefined && opts.opacity < 1,
      opacity: opts.opacity ?? 1,
      side: opts.side ?? THREE.FrontSide,
    });
    if (!opts.unique) this.cache.set(key, mat);
    return mat;
  }

  // Returns [faceMaterial, cutPaperEdgeMaterial] for ExtrudeGeometry
  layered(hex, edgeBlend = 0.68) {
    const key = `${hex}_${edgeBlend}`;
    if (this.layeredCache.has(key)) return this.layeredCache.get(key);
    const face = this.paper(hex);
    const edgeColor = new THREE.Color(hex).lerp(new THREE.Color('#fffaf0'), edgeBlend);
    const edge = this.paper(`#${edgeColor.getHexString()}`, { roughness: 0.95, bumpScale: 0.01 });
    const pair = [face, edge];
    this.layeredCache.set(key, pair);
    return pair;
  }

  icing(hex) {
    const key = `icing_${hex}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      bumpMap: this.paperBump,
      bumpScale: 0.008,
      roughness: 0.38,
      metalness: 0.02,
    });
    this.cache.set(key, mat);
    return mat;
  }

  foil(hex) {
    const key = `foil_${hex}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      bumpMap: this.paperBump,
      bumpScale: 0.016,
      roughness: 0.28,
      metalness: 0.48,
    });
    this.cache.set(key, mat);
    return mat;
  }
}
