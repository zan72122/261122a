import * as THREE from 'three';

export const INK_COLOR = 0x1a1324;
export const INK_HEX = '#1a1324';

// Crisp 3-band cel-anime gradient map
let _gradient3 = null;
let _gradient2 = null;

export function getGradientMap(steps = 3) {
  if (steps === 2) {
    if (_gradient2) return _gradient2;
    const data = new Uint8Array([145, 255]);
    const tex = new THREE.DataTexture(data, 2, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    _gradient2 = tex;
    return tex;
  }
  if (_gradient3) return _gradient3;
  // Crisp comic cel bands: shadow, warm mid, bright lit
  const data = new Uint8Array([122, 208, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  _gradient3 = tex;
  return tex;
}

export function createToonMaterial(color, opts = {}) {
  const mat = new THREE.MeshToonMaterial({
    color,
    gradientMap: getGradientMap(opts.steps || 3),
    map: opts.map || null,
    side: opts.side !== undefined ? opts.side : THREE.FrontSide,
    transparent: Boolean(opts.transparent),
    opacity: opts.opacity !== undefined ? opts.opacity : 1.0,
    emissive: opts.emissive !== undefined ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: opts.emissiveIntensity !== undefined ? opts.emissiveIntensity : 0,
  });
  return mat;
}

// Inverted-hull thick comic ink outline shader extruded smoothly along vertex normals
const outlineMatCache = new Map();

export function getOutlineMaterial(thickness = 0.024, colorHex = INK_COLOR) {
  const key = `${thickness.toFixed(4)}_${colorHex}`;
  if (outlineMatCache.has(key)) return outlineMatCache.get(key);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uThickness: { value: thickness },
      uColor: { value: new THREE.Color(colorHex) },
    },
    vertexShader: `
      uniform float uThickness;
      void main() {
        vec3 n = normalize(normal);
        vec3 pos = position + n * uThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: true,
  });
  outlineMatCache.set(key, mat);
  return mat;
}

export function addOutline(mesh, thickness = 0.024, colorHex = INK_COLOR) {
  const outlineMesh = new THREE.Mesh(mesh.geometry, getOutlineMaterial(thickness, colorHex));
  outlineMesh.renderOrder = -1;
  outlineMesh.raycast = () => {}; // never block raycasts
  outlineMesh.userData.isOutline = true;
  mesh.add(outlineMesh);
  return outlineMesh;
}

export function createToonMesh(geometry, color, opts = {}) {
  const mat = opts.material || createToonMaterial(color, opts);
  const mesh = new THREE.Mesh(geometry, mat);
  if (opts.castShadow !== false) mesh.castShadow = true;
  if (opts.receiveShadow !== false) mesh.receiveShadow = true;
  const thickness = opts.outline !== undefined ? opts.outline : 0.022;
  if (thickness > 0) {
    addOutline(mesh, thickness, opts.outlineColor || INK_COLOR);
  }
  return mesh;
}

// ---------- Procedural Cel-Anime Textures (all <= 512px) ----------

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finalizeTexture(canvas, opts = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export function createWoodTableTexture() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');

  // Rich warm anime honey-wood base
  ctx.fillStyle = '#e5a45b';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle plank bands
  const planks = 5;
  const ph = 512 / planks;
  const shades = ['#e8aa62', '#de9b50', '#e6a55b', '#d99349', '#e4a258'];
  for (let i = 0; i < planks; i++) {
    ctx.fillStyle = shades[i % shades.length];
    ctx.fillRect(0, i * ph, 512, ph);

    // Bold comic wood grain strokes
    ctx.strokeStyle = '#b46b2d';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let g = 0; g < 4; g++) {
      const yBase = i * ph + 16 + g * (ph / 4.4);
      ctx.beginPath();
      ctx.moveTo(0, yBase);
      for (let x = 0; x <= 512; x += 64) {
        const wave = Math.sin(x * 0.015 + i * 2.1 + g) * 6;
        ctx.lineTo(x, yBase + wave);
      }
      ctx.stroke();
    }

    // Highlight streak for cel sheen
    ctx.strokeStyle = '#f4c583';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(20 + i * 37, i * ph + 14);
    ctx.lineTo(160 + i * 40, i * ph + 14);
    ctx.stroke();

    // Crisp dark ink plank seam
    ctx.strokeStyle = '#5c3419';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, i * ph);
    ctx.lineTo(512, i * ph);
    ctx.stroke();
  }

  // Outer comic ink border inset
  ctx.strokeStyle = INK_HEX;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 502);

  return finalizeTexture(c);
}

export function createCounterTileTexture() {
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');
  const cols = 8;
  const rows = 4;
  const tw = 512 / cols;
  const th = 256 / rows;

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const alt = (r + col) % 2 === 0;
      ctx.fillStyle = alt ? '#fff6e4' : '#f7dec0';
      ctx.fillRect(col * tw, r * th, tw, th);

      // Cel tile shine corner
      ctx.fillStyle = alt ? '#ffffff' : '#ffecd2';
      ctx.fillRect(col * tw + 6, r * th + 6, tw - 24, 7);

      ctx.strokeStyle = '#5e3c28';
      ctx.lineWidth = 3;
      ctx.strokeRect(col * tw + 1.5, r * th + 1.5, tw - 3, th - 3);
    }
  }
  ctx.strokeStyle = INK_HEX;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 504, 248);

  return finalizeTexture(c);
}

export function createPlacematTexture(accentHex, lightHex, motif) {
  const c = makeCanvas(512, 384);
  const ctx = c.getContext('2d');

  // Woven placemat base
  ctx.fillStyle = lightHex;
  ctx.fillRect(0, 0, 512, 384);

  // Subtle woven comic stripe texture
  ctx.fillStyle = accentHex;
  ctx.globalAlpha = 0.14;
  for (let x = 0; x < 512; x += 24) {
    ctx.fillRect(x, 0, 10, 384);
  }
  for (let y = 0; y < 384; y += 24) {
    ctx.fillRect(0, y, 512, 6);
  }
  ctx.globalAlpha = 1.0;

  // Bold colored comic border ribbon
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 24;
  ctx.strokeRect(18, 18, 476, 348);

  // Crisp black ink trim inside & outside
  ctx.strokeStyle = INK_HEX;
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, 500, 372);
  ctx.lineWidth = 4;
  ctx.strokeRect(30, 30, 452, 324);

  // Recessed physical plate silhouette ring (center-left)
  const px = 218;
  const py = 186;
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, 114, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(26,19,36,0.08)';
  ctx.fill();
  ctx.setLineDash([14, 10]);
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.setLineDash([]);

  // Subtle motif stamp inside plate spot (shows character's favorite pattern!)
  ctx.translate(px, py);
  ctx.fillStyle = accentHex;
  ctx.globalAlpha = 0.25;
  if (motif === 'star') {
    drawStar(ctx, 0, 0, 5, 44, 20);
    ctx.fill();
  } else if (motif === 'flower') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 24, Math.sin(a) * 24, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Indigo wave circles for Papa
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 8;
    for (let r = 16; r <= 44; r += 14) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();

  return finalizeTexture(c);
}

export function createPlateTexture(rimHex, pattern) {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');

  // Cream porcelain base
  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(0, 0, 512, 512);

  // Rim band (outer edge of UV radial or top projection)
  ctx.strokeStyle = rimHex;
  ctx.lineWidth = 54;
  ctx.beginPath();
  ctx.arc(256, 256, 224, 0, Math.PI * 2);
  ctx.stroke();

  // Inner ink trim line
  ctx.strokeStyle = INK_HEX;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(256, 256, 195, 0, Math.PI * 2);
  ctx.stroke();

  // Pattern around the rim
  ctx.save();
  ctx.translate(256, 256);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, -224);
    ctx.fillStyle = '#fffaf0';
    ctx.strokeStyle = INK_HEX;
    ctx.lineWidth = 3;
    if (pattern === 'star') {
      drawStar(ctx, 0, 0, 5, 16, 7);
      ctx.fill();
      ctx.stroke();
    } else if (pattern === 'flower') {
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillRect(-10, -6, 20, 12);
      ctx.strokeRect(-10, -6, 20, 12);
    }
    ctx.restore();
  }
  ctx.restore();

  // Cute glossy ceramic crescent highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(256, 256, 150, -Math.PI * 0.78, -Math.PI * 0.45);
  ctx.stroke();

  return finalizeTexture(c);
}

export function createWallTexture() {
  const c = makeCanvas(512, 512);
  const ctx = c.getContext('2d');

  // Warm sunset-lit cream wall with subtle anime cel gradient band
  ctx.fillStyle = '#ffeed8';
  ctx.fillRect(0, 0, 512, 512);

  // Diagonal warm sunset light band across wall
  ctx.fillStyle = '#ffd9a8';
  ctx.beginPath();
  ctx.moveTo(0, 320);
  ctx.lineTo(512, 170);
  ctx.lineTo(512, 512);
  ctx.lineTo(0, 512);
  ctx.closePath();
  ctx.fill();

  // Lower wooden wainscoting
  ctx.fillStyle = '#c47b47';
  ctx.fillRect(0, 390, 512, 122);
  ctx.strokeStyle = INK_HEX;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 390);
  ctx.lineTo(512, 390);
  ctx.stroke();

  // Subtle comic halftone dots in lower shadow corner
  ctx.fillStyle = 'rgba(130, 68, 92, 0.12)';
  for (let y = 260; y < 385; y += 16) {
    for (let x = 0; x < 512; x += 16) {
      const r = 1.6 + ((y - 260) / 125) * 2.5;
      ctx.beginPath();
      ctx.arc(x + ((y / 16) % 2) * 8, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return finalizeTexture(c);
}

export function createSunsetWindowTexture() {
  const c = makeCanvas(512, 384);
  const ctx = c.getContext('2d');

  // Anime golden-hour sunset sky bands (crisp cel-anime stripes!)
  const bands = [
    { y: 0, h: 90, col: '#5c4b8a' },
    { y: 90, h: 75, col: '#9b5882' },
    { y: 165, h: 75, col: '#e86f5c' },
    { y: 240, h: 72, col: '#f7a44c' },
    { y: 312, h: 72, col: '#ffe07a' },
  ];
  for (const b of bands) {
    ctx.fillStyle = b.col;
    ctx.fillRect(0, b.y, 512, b.h + 1);
  }

  // Big anime setting sun
  ctx.fillStyle = '#fff5b8';
  ctx.strokeStyle = '#ff9848';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(256, 290, 68, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Puffy cel-shaded comic clouds with dark outlines
  drawComicCloud(ctx, 110, 155, 1.0, '#ffccb0', '#e07a6e');
  drawComicCloud(ctx, 390, 130, 0.9, '#ffd6b8', '#d97170');
  drawComicCloud(ctx, 195, 225, 0.72, '#ffe4b5', '#eb8e60');

  // Distant anime neighborhood rooftops silhouette (warm evening purple!)
  ctx.fillStyle = '#3b2952';
  ctx.beginPath();
  ctx.moveTo(0, 384);
  ctx.lineTo(0, 330);
  ctx.lineTo(55, 298);
  ctx.lineTo(115, 330);
  ctx.lineTo(145, 330);
  ctx.lineTo(145, 310);
  ctx.lineTo(205, 310);
  ctx.lineTo(205, 342);
  ctx.lineTo(310, 342);
  ctx.lineTo(360, 304);
  ctx.lineTo(415, 336);
  ctx.lineTo(465, 315);
  ctx.lineTo(512, 340);
  ctx.lineTo(512, 384);
  ctx.closePath();
  ctx.fill();

  // Warm lit house windows in distance
  ctx.fillStyle = '#ffe57f';
  ctx.fillRect(46, 338, 16, 16);
  ctx.fillRect(164, 326, 18, 18);
  ctx.fillRect(352, 340, 18, 18);

  return finalizeTexture(c);
}

function drawComicCloud(ctx, cx, cy, s, topCol, botCol) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  const puffs = [
    [-44, 6, 24],
    [-18, -10, 32],
    [22, -6, 30],
    [52, 8, 22],
  ];
  ctx.beginPath();
  for (const [x, y, r] of puffs) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.rect(-46, 4, 98, 22);
  ctx.fillStyle = topCol;
  ctx.fill();

  // Lower shadow stripe
  ctx.fillStyle = botCol;
  ctx.fillRect(-52, 16, 108, 12);

  // Comic ink contour bottom & arcs
  ctx.strokeStyle = INK_HEX;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-64, 24);
  ctx.lineTo(66, 24);
  ctx.stroke();
  ctx.restore();
}

export function drawStar(ctx, cx, cy, spikes, outerR, innerR) {
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.closePath();
}

// Expressive comic face texture generator (dynamic swap for each character!)
export function createFaceTexture(opts) {
  const {
    skin = '#ffdfc4',
    expression = 'waiting',
    blush = '#ff7b8a',
    glasses = false,
    browColor = '#2a1c28',
    eyeOffsetX = 0,
    eyeOffsetY = 0,
    mouthOpen = 0,
  } = opts;

  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = skin;
  ctx.fillRect(0, 0, 256, 256);

  const lx = 86;
  const rx = 170;
  const ey = 122;

  // Rosy anime cheeks
  const blushAlpha = expression === 'bliss' || expression === 'eating' ? 0.72 : 0.42;
  ctx.fillStyle = blush;
  ctx.globalAlpha = blushAlpha;
  ctx.beginPath();
  ctx.ellipse(62, 152, 22, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(194, 152, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // Comic diagonal blush hash lines when super happy
  if (expression === 'bliss' || expression === 'eating' || expression === 'excited') {
    ctx.strokeStyle = '#ff4b6b';
    ctx.lineWidth = 3;
    for (const bx of [54, 186]) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(bx + i * 8, 158);
        ctx.lineTo(bx + i * 8 + 5, 146);
        ctx.stroke();
      }
    }
  }

  // Eyebrows
  ctx.strokeStyle = browColor;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  const browLift = expression === 'amazed' || expression === 'excited' ? -10 : 0;
  ctx.beginPath();
  ctx.moveTo(64, 88 + browLift);
  ctx.quadraticCurveTo(86, 78 + browLift, 106, 88 + browLift);
  ctx.moveTo(150, 88 + browLift);
  ctx.quadraticCurveTo(170, 78 + browLift, 192, 88 + browLift);
  ctx.stroke();

  // Eyes
  if (expression === 'eating' || expression === 'bliss') {
    // Happy curved ^ ^ anime eyes
    ctx.strokeStyle = INK_HEX;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(lx, ey + 8, 20, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rx, ey + 8, 20, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else if (expression === 'sipping') {
    // Refreshing > < eyes
    ctx.strokeStyle = INK_HEX;
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lx - 15, ey - 10);
    ctx.lineTo(lx + 10, ey);
    ctx.lineTo(lx - 15, ey + 10);
    ctx.moveTo(rx + 15, ey - 10);
    ctx.lineTo(rx - 10, ey);
    ctx.lineTo(rx + 15, ey + 10);
    ctx.stroke();
  } else if (expression === 'amazed' || expression === 'excited') {
    // Big glossy anime starry eyes!
    for (const ex of [lx, rx]) {
      ctx.fillStyle = INK_HEX;
      ctx.beginPath();
      ctx.ellipse(ex + eyeOffsetX * 6, ey + eyeOffsetY * 5, 19, 23, 0, 0, Math.PI * 2);
      ctx.fill();
      // Big 4-point star glint
      ctx.fillStyle = '#fff9c4';
      drawStar(ctx, ex + eyeOffsetX * 6, ey + eyeOffsetY * 5 - 2, 4, 13, 5);
      ctx.fill();
      // Small secondary glint
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + eyeOffsetX * 6 + 9, ey + eyeOffsetY * 5 + 9, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Expressive curious anime eyes tracking target
    for (const ex of [lx, rx]) {
      // White sclera
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = INK_HEX;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 20, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Dark pupil shifted toward look target
      const px = ex + eyeOffsetX * 8;
      const py = ey + eyeOffsetY * 7;
      ctx.fillStyle = INK_HEX;
      ctx.beginPath();
      ctx.ellipse(px, py, 12, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Crisp anime shine dots
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px - 4, py - 5, 5, 0, Math.PI * 2);
      ctx.arc(px + 4, py + 5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Papa's bold comic glasses (drawn right on face + 3D bridge accents)
  if (glasses) {
    ctx.strokeStyle = '#2d233a';
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.roundRect(54, 96, 62, 48, 12);
    ctx.roundRect(140, 96, 62, 48, 12);
    ctx.moveTo(116, 118);
    ctx.lineTo(140, 118);
    ctx.stroke();
    // Diagonal comic lens glint
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(64, 108);
    ctx.lineTo(78, 102);
    ctx.moveTo(150, 108);
    ctx.lineTo(164, 102);
    ctx.stroke();
  }

  // Cute anime button nose
  ctx.fillStyle = '#e89f78';
  ctx.beginPath();
  ctx.arc(128, 147, 5, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.strokeStyle = INK_HEX;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (expression === 'excited' || expression === 'bliss') {
    // Big joyful D-shaped anime smile
    ctx.fillStyle = '#e55365';
    ctx.beginPath();
    ctx.moveTo(100, 168);
    ctx.lineTo(156, 168);
    ctx.quadraticCurveTo(156, 206, 128, 206);
    ctx.quadraticCurveTo(100, 206, 100, 168);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Pink tongue
    ctx.fillStyle = '#ff8c9e';
    ctx.beginPath();
    ctx.arc(128, 198, 14, Math.PI, 0);
    ctx.fill();
  } else if (expression === 'eating') {
    // Mogu-mogu animated chewing mouth
    const h = 8 + mouthOpen * 16;
    ctx.fillStyle = '#e55365';
    ctx.beginPath();
    ctx.ellipse(128, 180, 16 + mouthOpen * 6, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'amazed') {
    // Open 'O' comic awe mouth
    ctx.fillStyle = '#e55365';
    ctx.beginPath();
    ctx.ellipse(128, 182, 16, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'sipping') {
    // Happy little 'w' sip smile
    ctx.beginPath();
    ctx.moveTo(108, 174);
    ctx.quadraticCurveTo(118, 186, 128, 174);
    ctx.quadraticCurveTo(138, 186, 148, 174);
    ctx.stroke();
  } else {
    // Warm expectant smile
    ctx.beginPath();
    ctx.arc(128, 168, 19, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }

  return finalizeTexture(c);
}

// Create sprite textures for comic 2D FX (stars, hearts, notes, droplets, steam, hand hint)
export function createComicSpriteTexture(kind) {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);

  if (kind === 'star') {
    ctx.fillStyle = '#ffe84d';
    ctx.strokeStyle = INK_HEX;
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    drawStar(ctx, 64, 64, 4, 52, 19);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    drawStar(ctx, 58, 56, 4, 18, 6);
    ctx.fill();
  } else if (kind === 'heart') {
    ctx.fillStyle = '#ff5a7e';
    ctx.strokeStyle = INK_HEX;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(64, 108);
    ctx.bezierCurveTo(16, 76, 12, 32, 38, 22);
    ctx.bezierCurveTo(54, 16, 64, 34, 64, 42);
    ctx.bezierCurveTo(64, 34, 74, 16, 90, 22);
    ctx.bezierCurveTo(116, 32, 112, 76, 64, 108);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff9bb3';
    ctx.beginPath();
    ctx.ellipse(42, 42, 10, 6, -0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'note') {
    ctx.fillStyle = '#4ad2ff';
    ctx.strokeStyle = INK_HEX;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Eighth note
    ctx.beginPath();
    ctx.ellipse(46, 92, 20, 15, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(63, 86);
    ctx.lineTo(63, 24);
    ctx.quadraticCurveTo(96, 28, 98, 54);
    ctx.stroke();
  } else if (kind === 'steam') {
    ctx.strokeStyle = INK_HEX;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(64, 114);
    ctx.bezierCurveTo(34, 88, 94, 58, 60, 18);
    ctx.stroke();

    ctx.strokeStyle = '#fffdf7';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(64, 114);
    ctx.bezierCurveTo(34, 88, 94, 58, 60, 18);
    ctx.stroke();
  } else if (kind === 'droplet') {
    ctx.fillStyle = '#ffca4b';
    ctx.strokeStyle = INK_HEX;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(64, 14);
    ctx.quadraticCurveTo(104, 68, 96, 88);
    ctx.arc(64, 86, 32, 0.1, Math.PI - 0.1);
    ctx.quadraticCurveTo(24, 68, 64, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff9d6';
    ctx.beginPath();
    ctx.ellipse(50, 74, 6, 12, 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'burst') {
    // Comic impact star ring
    ctx.fillStyle = '#fff176';
    ctx.strokeStyle = INK_HEX;
    ctx.lineWidth = 6;
    drawStar(ctx, 64, 64, 8, 56, 32);
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'hand') {
    // Simple friendly cel-shaded comic hand silhouette for rare idle demo
    ctx.fillStyle = '#fff5e4';
    ctx.strokeStyle = INK_HEX;
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    // Index finger pointing up-left slightly
    ctx.moveTo(54, 16);
    ctx.quadraticCurveTo(64, 10, 70, 20);
    ctx.lineTo(72, 54);
    ctx.quadraticCurveTo(84, 48, 90, 58);
    ctx.lineTo(94, 66);
    ctx.quadraticCurveTo(106, 66, 106, 80);
    ctx.lineTo(102, 98);
    ctx.quadraticCurveTo(96, 116, 70, 116);
    ctx.lineTo(48, 114);
    ctx.quadraticCurveTo(26, 110, 22, 84);
    ctx.lineTo(22, 72);
    ctx.quadraticCurveTo(24, 60, 38, 64);
    ctx.lineTo(44, 68);
    ctx.lineTo(44, 24);
    ctx.quadraticCurveTo(44, 16, 54, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  return finalizeTexture(c);
}
