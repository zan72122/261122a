import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Deterministic pseudo-random helper for rich repeatable organic textures
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

export function createWoodTextures({
  baseColor = '#8f5e3b',
  grainColor = '#5e381e',
  highlightColor = '#b48056',
  planks = 5,
  seed = 11,
  size = 512,
  flourDust = false
} = {}) {
  const rand = mulberry32(seed);
  const cColor = makeCanvas(size, size);
  const ctx = cColor.getContext('2d');
  const cBump = makeCanvas(size, size);
  const bCtx = cBump.getContext('2d');

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  const plankH = size / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * plankH;
    // Slight per-plank tonal shift
    const toneShift = (rand() - 0.5) * 18;
    ctx.fillStyle = `rgba(${toneShift > 0 ? 255 : 30}, ${toneShift > 0 ? 230 : 15}, ${toneShift > 0 ? 190 : 5}, ${Math.abs(toneShift) / 255})`;
    ctx.fillRect(0, y0, size, plankH);

    // Organic wood grain fibers
    for (let i = 0; i < 65; i++) {
      const y = y0 + rand() * plankH;
      const amp = 1.5 + rand() * 3.5;
      const freq = 0.008 + rand() * 0.018;
      const phase = rand() * Math.PI * 2;
      const isDark = rand() > 0.3;

      ctx.strokeStyle = isDark ? grainColor : highlightColor;
      ctx.globalAlpha = 0.09 + rand() * 0.16;
      ctx.lineWidth = 0.8 + rand() * 2.2;
      ctx.beginPath();
      for (let x = 0; x <= size; x += 16) {
        const yy = Math.max(y0 + 1, Math.min(y0 + plankH - 1, y + Math.sin(x * freq + phase) * amp));
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();

      bCtx.strokeStyle = isDark ? '#666666' : '#9c9c9c';
      bCtx.globalAlpha = 0.18;
      bCtx.lineWidth = 1.2;
      bCtx.stroke();
    }

    // Occasional subtle wood knot
    if (rand() > 0.45) {
      const kx = (0.15 + rand() * 0.7) * size;
      const ky = y0 + (0.25 + rand() * 0.5) * plankH;
      const kr = 6 + rand() * 11;
      const grad = ctx.createRadialGradient(kx, ky, 1, kx, ky, kr);
      grad.addColorStop(0, grainColor);
      grad.addColorStop(0.6, 'rgba(70,40,18,0.35)');
      grad.addColorStop(1, 'rgba(70,40,18,0)');
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(kx, ky, kr * 1.5, kr * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Plank seam
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#2d190c';
    ctx.fillRect(0, y0, size, 2);
    bCtx.globalAlpha = 0.85;
    bCtx.fillStyle = '#242424';
    bCtx.fillRect(0, y0, size, 3);
  }
  ctx.globalAlpha = 1;
  bCtx.globalAlpha = 1;

  // Fine tactile micro-pores
  for (let i = 0; i < 900; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 3 + rand() * 14;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(40,20,8,0.06)' : 'rgba(255,235,205,0.05)';
    ctx.fillRect(x, y, w, 1);
  }

  // Optional pastry board flour dusting + subtle dusty working ring
  if (flourDust) {
    // Subtle knife score marks
    ctx.strokeStyle = 'rgba(240,218,190,0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 24; i++) {
      const cx = size * (0.25 + rand() * 0.5);
      const cy = size * (0.25 + rand() * 0.5);
      const ang = (rand() - 0.5) * 1.2;
      const len = 18 + rand() * 48;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(ang) * len, cy - Math.sin(ang) * len);
      ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
      ctx.stroke();
    }

    // Soft matte flour cloud in the center
    const fGrad = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.05, size * 0.5, size * 0.5, size * 0.44);
    fGrad.addColorStop(0, 'rgba(252,248,240,0.42)');
    fGrad.addColorStop(0.65, 'rgba(252,248,240,0.22)');
    fGrad.addColorStop(0.82, 'rgba(252,248,240,0.28)');
    fGrad.addColorStop(1, 'rgba(252,248,240,0)');
    ctx.fillStyle = fGrad;
    ctx.fillRect(0, 0, size, size);

    // Tiny flour dust speckles
    for (let i = 0; i < 1600; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.pow(rand(), 0.72) * size * 0.45;
      const fx = size * 0.5 + Math.cos(a) * r;
      const fy = size * 0.5 + Math.sin(a) * r;
      ctx.fillStyle = `rgba(255,252,246,${0.12 + rand() * 0.35})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 0.7 + rand() * 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const map = new THREE.CanvasTexture(cColor);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

export function createBrickTextures(size = 512) {
  const rand = mulberry32(42);
  const cColor = makeCanvas(size, size);
  const ctx = cColor.getContext('2d');
  const cBump = makeCanvas(size, size);
  const bCtx = cBump.getContext('2d');

  // Sandy lime mortar background
  ctx.fillStyle = '#cfc2ae';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#383838';
  bCtx.fillRect(0, 0, size, size);

  // Mortar sand speckles
  for (let i = 0; i < 2000; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(90,75,58,0.14)' : 'rgba(255,250,240,0.16)';
    ctx.fillRect(rand() * size, rand() * size, 2, 2);
  }

  const rows = 10;
  const cols = 5;
  const rowH = size / rows;
  const colW = size / cols;
  const mortar = 6;
  const palette = ['#a44a2f', '#b55939', '#8f3f27', '#bd6442', '#9b442b', '#7f3824'];

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const bx = c * colW + offset + mortar * 0.5;
      const by = r * rowH + mortar * 0.5;
      const bw = colW - mortar;
      const bh = rowH - mortar;

      const base = palette[Math.floor(rand() * palette.length)];
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 4);
      ctx.fill();

      // Subtle kiln firing mottling on each miniature brick
      const g = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
      g.addColorStop(0, 'rgba(255,220,185,0.12)');
      g.addColorStop(0.5, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(40,15,5,0.22)');
      ctx.fillStyle = g;
      ctx.fill();

      // Tiny terracotta grain
      for (let s = 0; s < 22; s++) {
        ctx.fillStyle = rand() > 0.45 ? 'rgba(50,18,8,0.15)' : 'rgba(245,205,175,0.12)';
        ctx.fillRect(bx + rand() * bw, by + rand() * bh, 2 + rand() * 3, 2);
      }

      // Bump height for brick face
      bCtx.fillStyle = `rgb(${180 + Math.floor(rand() * 45)},${180 + Math.floor(rand() * 45)},${180 + Math.floor(rand() * 45)})`;
      bCtx.beginPath();
      bCtx.roundRect(bx + 1, by + 1, bw - 2, bh - 2, 4);
      bCtx.fill();
    }
  }

  const map = new THREE.CanvasTexture(cColor);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

export function createGinghamTextures(size = 256) {
  const cColor = makeCanvas(size, size);
  const ctx = cColor.getContext('2d');
  const cBump = makeCanvas(size, size);
  const bCtx = cBump.getContext('2d');

  ctx.fillStyle = '#f6efe4';
  ctx.fillRect(0, 0, size, size);

  const stripe = 32;
  ctx.fillStyle = 'rgba(186, 56, 46, 0.48)';
  for (let x = 0; x < size; x += stripe * 2) {
    ctx.fillRect(x, 0, stripe, size);
  }
  for (let y = 0; y < size; y += stripe * 2) {
    ctx.fillRect(0, y, size, stripe);
  }

  // Woven linen thread micro-pattern
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(60,30,20,0.06)';
    ctx.fillRect(0, y, size, 1);
    bCtx.fillStyle = y % 6 === 0 ? '#a8a8a8' : '#585858';
    bCtx.fillRect(0, y, size, 1);
  }
  for (let x = 0; x < size; x += 3) {
    ctx.fillStyle = x % 6 === 0 ? 'rgba(255,255,255,0.07)' : 'rgba(60,30,20,0.05)';
    ctx.fillRect(x, 0, 1, size);
    bCtx.fillStyle = x % 6 === 0 ? '#9c9c9c' : '#646464';
    bCtx.fillRect(x, 0, 1, size);
  }

  const map = new THREE.CanvasTexture(cColor);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(cBump);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap };
}

export function createWallTextures(size = 512) {
  const rand = mulberry32(77);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');

  // Warm Mediterranean plaster upper half
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#e8dccb');
  grad.addColorStop(0.65, '#dfd0bc');
  grad.addColorStop(1, '#d3c1aa');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle plaster trowel patches
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,248,238,0.08)' : 'rgba(130,104,78,0.06)';
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 8 + rand() * 32, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cream ceramic kitchen tiles along the lower backsplash
  const tileStart = Math.floor(size * 0.58);
  const tileH = 36;
  const tileW = 72;
  ctx.fillStyle = '#c8baa6';
  ctx.fillRect(0, tileStart, size, size - tileStart);
  for (let y = tileStart + 3; y < size; y += tileH) {
    const off = (Math.floor((y - tileStart) / tileH) % 2) * (tileW * 0.5);
    for (let x = -tileW; x < size + tileW; x += tileW) {
      const shade = 240 + Math.floor((rand() - 0.5) * 14);
      ctx.fillStyle = `rgb(${shade}, ${shade - 8}, ${shade - 19})`;
      ctx.fillRect(x + off + 2, y + 2, tileW - 4, tileH - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x + off + 2, y + 2, tileW - 4, 3);
    }
  }
  // Wooden molding rail separating plaster & tile
  ctx.fillStyle = '#7b5033';
  ctx.fillRect(0, tileStart - 8, size, 12);

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  return map;
}

export function createCeramicTexture(hexColor = '#e8dfd1', seed = 9) {
  const rand = mulberry32(seed);
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');

  ctx.fillStyle = hexColor;
  ctx.fillRect(0, 0, size, size);

  // Handcrafted stoneware iron speckles & subtle glaze variation
  for (let i = 0; i < 650; i++) {
    const dark = rand() > 0.25;
    ctx.fillStyle = dark ? `rgba(70,52,38,${0.08 + rand() * 0.16})` : 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 0.6 + rand() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Horizontal pottery wheel turning lines
  for (let y = 0; y < size; y += 5) {
    ctx.fillStyle = y % 10 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(40,25,15,0.035)';
    ctx.fillRect(0, y, size, 2);
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}

export function createDoughTextures(size = 512) {
  const rand = mulberry32(101);
  // Raw dough color canvas + Baked golden-leopard crust canvas + shared bump
  const cRaw = makeCanvas(size, size);
  const ctxR = cRaw.getContext('2d');
  const cBaked = makeCanvas(size, size);
  const ctxB = cBaked.getContext('2d');
  const cBump = makeCanvas(size, size);
  const ctxM = cBump.getContext('2d');

  const half = size * 0.5;

  // Raw floury cream dough
  ctxR.fillStyle = '#f3e5cb';
  ctxR.fillRect(0, 0, size, size);

  // Baked golden crust base
  const bakedGrad = ctxB.createRadialGradient(half, half, size * 0.12, half, half, size * 0.5);
  bakedGrad.addColorStop(0, '#e3be82');
  bakedGrad.addColorStop(0.68, '#d9a45b');
  bakedGrad.addColorStop(0.84, '#c7843a');
  bakedGrad.addColorStop(0.96, '#ab6124');
  bakedGrad.addColorStop(1, '#8c4919');
  ctxB.fillStyle = bakedGrad;
  ctxB.fillRect(0, 0, size, size);

  ctxM.fillStyle = '#808080';
  ctxM.fillRect(0, 0, size, size);

  // Organic flour dimples & yeasty pores
  for (let i = 0; i < 1800; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * 5;
    ctxR.fillStyle = rand() > 0.45 ? 'rgba(255,252,245,0.22)' : 'rgba(212,188,150,0.16)';
    ctxR.beginPath();
    ctxR.arc(x, y, r, 0, Math.PI * 2);
    ctxR.fill();

    ctxM.fillStyle = rand() > 0.5 ? 'rgba(175,175,175,0.22)' : 'rgba(92,92,92,0.22)';
    ctxM.beginPath();
    ctxM.arc(x, y, r * 1.1, 0, Math.PI * 2);
    ctxM.fill();
  }

  // Authentic Neapolitan leopard-spotted blisters around the cornicione rim (baked)
  for (let i = 0; i < 65; i++) {
    const ang = rand() * Math.PI * 2;
    const dist = size * (0.37 + rand() * 0.11);
    const bx = half + Math.cos(ang) * dist;
    const by = half + Math.sin(ang) * dist;
    const br = 5 + rand() * 14;

    const spot = ctxB.createRadialGradient(bx, by, br * 0.12, bx, by, br);
    spot.addColorStop(0, 'rgba(54, 24, 9, 0.88)');
    spot.addColorStop(0.45, 'rgba(104, 48, 16, 0.65)');
    spot.addColorStop(0.8, 'rgba(170, 96, 36, 0.25)');
    spot.addColorStop(1, 'rgba(170, 96, 36, 0)');
    ctxB.fillStyle = spot;
    ctxB.beginPath();
    ctxB.ellipse(bx, by, br * (0.85 + rand() * 0.5), br * (0.7 + rand() * 0.4), ang, 0, Math.PI * 2);
    ctxB.fill();

    // Raised blister bump
    const bSpot = ctxM.createRadialGradient(bx, by, 1, bx, by, br);
    bSpot.addColorStop(0, 'rgba(245,245,245,0.55)');
    bSpot.addColorStop(1, 'rgba(128,128,128,0)');
    ctxM.fillStyle = bSpot;
    ctxM.beginPath();
    ctxM.arc(bx, by, br, 0, Math.PI * 2);
    ctxM.fill();
  }

  // Subtle baked toasted mottling over the whole crust
  for (let i = 0; i < 360; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 3 + rand() * 11;
    ctxB.fillStyle = rand() > 0.5 ? 'rgba(130,68,22,0.12)' : 'rgba(250,218,160,0.12)';
    ctxB.beginPath();
    ctxB.arc(x, y, r, 0, Math.PI * 2);
    ctxB.fill();
  }

  const bumpMap = new THREE.CanvasTexture(cBump);
  return { rawCanvas: cRaw, bakedCanvas: cBaked, bumpMap };
}

export function createPepperoniTexture() {
  const rand = mulberry32(202);
  const size = 128;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const h = size / 2;

  const grad = ctx.createRadialGradient(h, h, 4, h, h, h);
  grad.addColorStop(0, '#a82c22');
  grad.addColorStop(0.75, '#96231b');
  grad.addColorStop(0.92, '#731812');
  grad.addColorStop(1, '#58110c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Authentic marbled fat flecks
  for (let i = 0; i < 42; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * (h - 10);
    const fx = h + Math.cos(a) * r;
    const fy = h + Math.sin(a) * r;
    ctx.fillStyle = `rgba(245, 214, 194, ${0.42 + rand() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(fx, fy, 1.5 + rand() * 4.5, 1.2 + rand() * 3.2, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Tiny pepper spices
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = 'rgba(55,10,8,0.45)';
    ctx.fillRect(rand() * size, rand() * size, 2, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMushroomTexture() {
  const size = 128;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');

  // Creamy inner mushroom flesh
  ctx.fillStyle = '#efe5d6';
  ctx.fillRect(0, 0, size, size);

  // Cremini toasted brown outer cap rim along top arc
  const capGrad = ctx.createRadialGradient(64, 58, 36, 64, 58, 66);
  capGrad.addColorStop(0, 'rgba(138,104,76,0)');
  capGrad.addColorStop(0.76, 'rgba(138,104,76,0.18)');
  capGrad.addColorStop(0.9, 'rgba(122,86,58,0.85)');
  capGrad.addColorStop(1, 'rgba(92,62,40,0.95)');
  ctx.fillStyle = capGrad;
  ctx.fillRect(0, 0, size, size);

  // Dark earthy gill crescents on left & right beneath the cap
  [-1, 1].forEach((side) => {
    const gx = 64 + side * 24;
    const gy = 66;
    const g = ctx.createRadialGradient(gx, gy, 3, gx, gy, 24);
    g.addColorStop(0, 'rgba(72,50,38,0.9)');
    g.addColorStop(0.65, 'rgba(105,78,62,0.58)');
    g.addColorStop(1, 'rgba(105,78,62,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(gx, gy, 22, 14, side * 0.25, 0, Math.PI * 2);
    ctx.fill();
  });

  // Subtle fibrous stem & gill striations
  ctx.strokeStyle = 'rgba(98,74,56,0.22)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 16; i++) {
    ctx.beginPath();
    ctx.moveTo(64 + (i - 7.5) * 1.4, 118);
    ctx.lineTo(18 + i * 6, 30);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCherryTomatoTexture() {
  const size = 128;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const h = size / 2;

  // Juicy crimson outer skin & flesh gradient
  const grad = ctx.createRadialGradient(h, h, 8, h, h, h);
  grad.addColorStop(0, '#f48668');
  grad.addColorStop(0.26, '#e64632');
  grad.addColorStop(0.76, '#d92f20');
  grad.addColorStop(0.92, '#b31c14');
  grad.addColorStop(1, '#8c120c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // 3 glossy translucent seed locule pockets
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const lx = h + Math.cos(a) * 23;
    const ly = h + Math.sin(a) * 23;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a);
    ctx.fillStyle = 'rgba(148, 22, 16, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 19, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pale golden tomato seeds nestled in each pocket
    ctx.fillStyle = 'rgba(255, 226, 152, 0.92)';
    for (let s = -1; s <= 1; s++) {
      ctx.beginPath();
      ctx.ellipse((s % 2) * 3 - 1, s * 6.5, 2.3, 3.6, s * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Soft pale central pith cross
  ctx.fillStyle = 'rgba(252, 192, 158, 0.58)';
  ctx.beginPath();
  ctx.arc(h, h, 10, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFirebrickTexture(size = 256) {
  const rand = mulberry32(909);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2d211b';
  ctx.fillRect(0, 0, size, size);

  const step = 32;
  for (let y = 0; y < size; y += step) {
    const off = ((y / step) % 2) * 16;
    for (let x = -step; x < size + step; x += step) {
      const v = 42 + Math.floor(rand() * 20);
      ctx.fillStyle = `rgb(${v + 12}, ${v + 2}, ${v - 4})`;
      ctx.fillRect(x + off + 1.5, y + 1.5, step - 3, step - 3);
    }
  }
  // Fine hearth soot & warm ash dust
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = rand() > 0.35 ? 'rgba(18,10,6,0.22)' : 'rgba(185,155,130,0.08)';
    ctx.fillRect(rand() * size, rand() * size, 2 + rand() * 3, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createFlameTexture(size = 128) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  // Outer warm orange-red glow
  const g1 = ctx.createRadialGradient(size * 0.5, size * 0.68, 4, size * 0.5, size * 0.54, size * 0.48);
  g1.addColorStop(0, 'rgba(255, 250, 210, 0.98)');
  g1.addColorStop(0.24, 'rgba(255, 195, 68, 0.92)');
  g1.addColorStop(0.55, 'rgba(255, 92, 16, 0.58)');
  g1.addColorStop(0.82, 'rgba(195, 34, 4, 0.16)');
  g1.addColorStop(1, 'rgba(140, 12, 0, 0)');

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.06);
  ctx.bezierCurveTo(size * 0.86, size * 0.38, size * 0.88, size * 0.86, size * 0.5, size * 0.95);
  ctx.bezierCurveTo(size * 0.12, size * 0.86, size * 0.14, size * 0.38, size * 0.5, size * 0.06);
  ctx.closePath();
  ctx.fillStyle = g1;
  ctx.fill();
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBasilTexture() {
  const size = 128;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#2e7d32');
  g.addColorStop(0.5, '#3b8c3e');
  g.addColorStop(1, '#256428');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Central vein & side veins
  ctx.strokeStyle = 'rgba(165, 224, 130, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(64, 118);
  ctx.lineTo(64, 12);
  ctx.stroke();

  ctx.lineWidth = 1.8;
  for (let y = 30; y <= 98; y += 16) {
    ctx.beginPath();
    ctx.moveTo(64, y);
    ctx.quadraticCurveTo(40, y - 6, 22, y - 18);
    ctx.moveTo(64, y);
    ctx.quadraticCurveTo(88, y - 6, 106, y - 18);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBirchWoodTexture() {
  const rand = mulberry32(303);
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#eed9bd';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 70; i++) {
    const x = rand() * size;
    ctx.strokeStyle = rand() > 0.5 ? 'rgba(182,140,98,0.16)' : 'rgba(255,248,236,0.18)';
    ctx.lineWidth = 1 + rand() * 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + (rand() - 0.5) * 14, size * 0.33, x + (rand() - 0.5) * 14, size * 0.66, x, size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTomatoSauceBowlTexture() {
  const rand = mulberry32(404);
  const size = 256;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const h = size / 2;

  const g = ctx.createRadialGradient(h - 15, h - 15, 10, h, h, h);
  g.addColorStop(0, '#c8291d');
  g.addColorStop(0.6, '#aa1c14');
  g.addColorStop(1, '#7a110b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Pulp chunks & oregano specks
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = rand() > 0.2 ? 'rgba(224,72,46,0.38)' : 'rgba(42,74,28,0.58)';
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 1.2 + rand() * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
