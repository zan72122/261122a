import * as THREE from '../vendor/three.module.js';

// 5 iconic cookie shapes (normalized radius ~ 1.0)
export const COOKIE_SHAPES = [
  { id: 'star',   cutterColor: '#e85d56' },
  { id: 'heart',  cutterColor: '#e55c92' },
  { id: 'flower', cutterColor: '#3fb5a8' },
  { id: 'bow',    cutterColor: '#f2b138' },
  { id: 'moon',   cutterColor: '#7a6ad4' },
];

export const DOUGH_FLAVORS = {
  vanilla: {
    rawBase: '#f6dfaa',
    rawTop: '#fbe9be',
    bakedBase: '#c98842',
    bakedTop: '#dfa056',
    darkBakedBase: '#9e5d24',
    darkBakedTop: '#b97536',
    crumb: '#f7e5bc',
  },
  cocoa: {
    rawBase: '#9b6b4c',
    rawTop: '#ad7c5c',
    bakedBase: '#633c26',
    bakedTop: '#784b31',
    darkBakedBase: '#492919',
    darkBakedTop: '#5d3724',
    crumb: '#8c5a3c',
  },
  strawberry: {
    rawBase: '#f7b8c6',
    rawTop: '#fccad6',
    bakedBase: '#db7d91',
    bakedTop: '#eb94a6',
    darkBakedBase: '#bd6074',
    darkBakedTop: '#d07488',
    crumb: '#f7b4c2',
  },
};

// Build crisp 2D point loop for each cookie shape (counter-clockwise)
export function getShapePoints(shapeId, scale = 1.0) {
  const pts = [];
  if (shapeId === 'star') {
    const spikes = 5;
    const outer = 1.0 * scale;
    const inner = 0.48 * scale;
    const total = spikes * 2;
    for (let i = 0; i < total; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / total) * Math.PI * 2 + Math.PI / 2;
      pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    return subdivideRounded(pts, 3, 0.22);
  }

  if (shapeId === 'heart') {
    const n = 36;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push(new THREE.Vector2((x / 16.5) * scale, ((y + 1.8) / 16.5) * scale));
    }
    return subdivideRounded(pts, 1, 0.24);
  }

  if (shapeId === 'flower') {
    const n = 48;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = (0.76 + 0.24 * Math.pow(Math.abs(Math.cos(3 * a)), 0.72)) * scale;
      pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    return pts;
  }

  if (shapeId === 'bow') {
    // Crisp papercraft ribbon bow silhouette
    const raw = [
      [0.0, 0.3],
      [0.22, 0.26],
      [0.86, 0.66],
      [1.0, 0.26],
      [0.94, 0.0],
      [1.0, -0.26],
      [0.86, -0.66],
      [0.22, -0.26],
      [0.0, -0.3],
      [-0.22, -0.26],
      [-0.86, -0.66],
      [-1.0, -0.26],
      [-0.94, 0.0],
      [-1.0, 0.26],
      [-0.86, 0.66],
      [-0.22, 0.26],
    ].map(([x, y]) => new THREE.Vector2(x * scale, y * scale));
    return subdivideRounded(raw, 2, 0.22);
  }

  if (shapeId === 'moon') {
    // Plump cheerful crescent moon with generous body width (zero inner overlap!)
    const outerN = 24;
    const innerN = 18;
    const startA = -Math.PI * 0.65;
    const endA = Math.PI * 0.65;
    for (let i = 0; i <= outerN; i++) {
      const a = startA + (i / outerN) * (endA - startA);
      pts.push(new THREE.Vector2((Math.cos(a) * 0.96 - 0.14) * scale, Math.sin(a) * 0.96 * scale));
    }
    for (let i = innerN; i >= 0; i--) {
      const a = -Math.PI * 0.44 + (i / innerN) * Math.PI * 0.88;
      pts.push(new THREE.Vector2((Math.cos(a) * 0.42 + 0.46) * scale, Math.sin(a) * 0.56 * scale));
    }
    return subdivideRounded(pts, 2, 0.26);
  }

  // Fallback scalloped circle
  const n = 32;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector2(Math.cos(a) * scale, Math.sin(a) * scale));
  }
  return pts;
}

// Chaikin corner-rounding so cut-paper stars/bows feel hand-snipped, never razor-spiky
function subdivideRounded(points, iterations = 2, ratio = 0.22) {
  let curr = points;
  for (let iter = 0; iter < iterations; iter++) {
    const next = [];
    const len = curr.length;
    for (let i = 0; i < len; i++) {
      const p0 = curr[i];
      const p1 = curr[(i + 1) % len];
      next.push(new THREE.Vector2().lerpVectors(p0, p1, ratio));
      next.push(new THREE.Vector2().lerpVectors(p0, p1, 1 - ratio));
    }
    curr = next;
  }
  return curr;
}

export function createCookieShape(shapeId, scale = 1.0) {
  const pts = getShapePoints(shapeId, scale);
  const shape = new THREE.Shape();
  shape.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i].x, pts[i].y);
  }
  shape.closePath();
  return shape;
}

export function createCookiePath(shapeId, scale = 1.0) {
  const pts = getShapePoints(shapeId, scale);
  const path = new THREE.Path();
  path.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    path.lineTo(pts[i].x, pts[i].y);
  }
  path.closePath();
  return path;
}

export function createScallopedShape(radius = 1.0, scallops = 20, amp = 0.05) {
  const shape = new THREE.Shape();
  const steps = scallops * 6;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = radius + Math.abs(Math.sin(a * scallops * 0.5)) * amp;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function createRoundedRectShape(w, h, r = 0.12) {
  const hw = w / 2;
  const hh = h / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
}

// Extrude a flat horizontal paper sheet (lying in XZ plane, thickness along +Y)
export function extrudePaperFlat(shape, depth = 0.04, bevel = 0.008) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

// Compute a clean inward-offset polygon loop (filters zero-length cusp edges so Heart & Moon are 100% crisp!)
function offsetPolygonInward(pts, offset) {
  // Remove near-duplicate points that occur at parametric cusps (like heart cleft/tip)
  const clean = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = clean.length ? clean[clean.length - 1] : pts[pts.length - 1];
    if (pts[i].distanceTo(prev) > 0.012) clean.push(pts[i]);
  }
  const n = clean.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = clean[i];
    const b = clean[(i + 1) % n];
    area += a.x * b.y - b.x * a.y;
  }
  const sign = area >= 0 ? 1 : -1;

  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = clean[(i - 1 + n) % n];
    const curr = clean[i];
    const next = clean[(i + 1) % n];

    const e1 = new THREE.Vector2().subVectors(curr, prev).normalize();
    const e2 = new THREE.Vector2().subVectors(next, curr).normalize();

    const n1 = new THREE.Vector2(-e1.y * sign, e1.x * sign);
    const n2 = new THREE.Vector2(-e2.y * sign, e2.x * sign);
    const avg = n1.add(n2);
    const avgLen = avg.length();
    if (avgLen > 1e-4) avg.divideScalar(avgLen);
    else avg.set(-e1.y * sign, e1.x * sign);

    const cosHalf = Math.max(0.62, avg.dot(n2));
    const dist = Math.min(offset / cosHalf, offset * 1.35);
    out.push(new THREE.Vector2(curr.x + avg.x * dist, curr.y + avg.y * dist));
  }
  return out;
}

function pointsToShape(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x, pts[i].y);
  s.closePath();
  return s;
}

function pointsToPath(pts) {
  const p = new THREE.Path();
  p.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
  p.closePath();
  return p;
}

// Build a closed hollow folded-cardstock ribbon geometry directly (zero earcut glitches on concave shapes!)
function buildHollowRibbonGeometry(outerPts, innerPts, height) {
  const n = outerPts.length;
  const positions = [];
  const uvs = [];
  const indices = [];

  // Create 4 rings: outerBot, outerTop, innerTop, innerBot -> clean quad strips with crisp normals
  const pushQuad = (a, b, c, d, groupIdx) => {
    const base = positions.length / 3;
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    return groupIdx;
  };

  // Map 2D shape (x, y) -> 3D flat XZ (x, Y, -y) matching extrudePaperFlat orientation!
  const v3 = (p, y) => new THREE.Vector3(p.x, y, -p.y);

  // Group 0: Top & Bottom horizontal paper edges (mat index 0: colored face / cut edge)
  const topStart = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Top rim
    pushQuad(v3(outerPts[i], height), v3(outerPts[j], height), v3(innerPts[j], height), v3(innerPts[i], height));
    // Bottom rim
    pushQuad(v3(innerPts[i], 0), v3(innerPts[j], 0), v3(outerPts[j], 0), v3(outerPts[i], 0));
  }
  const topCount = indices.length - topStart;

  // Group 1: Outer & Inner vertical cardstock walls (mat index 1: colored paper strip)
  const wallStart = indices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    // Outer wall
    pushQuad(v3(outerPts[i], 0), v3(outerPts[j], 0), v3(outerPts[j], height), v3(outerPts[i], height));
    // Inner wall
    pushQuad(v3(innerPts[j], 0), v3(innerPts[i], 0), v3(innerPts[i], height), v3(innerPts[j], height));
  }
  const wallCount = indices.length - wallStart;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.clearGroups();
  geo.addGroup(topStart, topCount, 0);
  geo.addGroup(wallStart, wallCount, 1);
  geo.computeVertexNormals();
  return geo;
}

// Hollow papercraft cookie cutter (folded colored cardstock walls + top rim)
export function buildCookieCutterMesh(shapeId, colorHex, mats, scale = 0.56) {
  const group = new THREE.Group();
  const basePts = getShapePoints(shapeId, scale);
  const outerPts = offsetPolygonInward(basePts, -0.028);
  const innerPts = offsetPolygonInward(basePts, 0.028);

  const wallGeo = buildHollowRibbonGeometry(outerPts, innerPts, 0.29);
  const faceColor = mats.paper(colorHex);
  const edgeCream = mats.paper('#fbf5ea', { roughness: 0.94, bumpScale: 0.01 });
  const wall = new THREE.Mesh(wallGeo, [edgeCream, faceColor]);
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  // Rolled top cardstock lip for tactile grip
  const lipOuterPts = offsetPolygonInward(basePts, -0.048);
  const lipInnerPts = offsetPolygonInward(basePts, 0.036);
  const lipGeo = buildHollowRibbonGeometry(lipOuterPts, lipInnerPts, 0.045);
  const lipColor = new THREE.Color(colorHex).lerp(new THREE.Color('#ffffff'), 0.22);
  const lipMat = mats.paper(`#${lipColor.getHexString()}`);
  const lip = new THREE.Mesh(lipGeo, [lipMat, edgeCream]);
  lip.position.y = 0.275;
  lip.castShadow = true;
  lip.receiveShadow = true;
  group.add(lip);

  return group;
}

// Cache normalized cookie layer geometries per shapeId for low memory + fast creation
const cookieGeoCache = new Map();
function getCookieGeos(shapeId) {
  if (cookieGeoCache.has(shapeId)) return cookieGeoCache.get(shapeId);
  const baseShape = createCookieShape(shapeId, 1.0);
  const midShape = createCookieShape(shapeId, 0.91);
  const topShape = createCookieShape(shapeId, 0.78);

  const baseGeo = extrudePaperFlat(baseShape, 0.075, 0.014);
  const midGeo = extrudePaperFlat(midShape, 0.055, 0.012);
  const topGeo = extrudePaperFlat(topShape, 0.032, 0.008);

  const shadowGeo = new THREE.ShapeGeometry(createCookieShape(shapeId, 1.05));
  shadowGeo.rotateX(-Math.PI / 2);

  const bundle = { baseGeo, midGeo, topGeo, shadowGeo };
  cookieGeoCache.set(shapeId, bundle);
  return bundle;
}

// Build a layered 3D papercraft cookie that supports live baking & holds icing/toppings!
export function createPapercraftCookie(shapeId, flavorKey, mats, scale = 0.74) {
  const flavor = DOUGH_FLAVORS[flavorKey] || DOUGH_FLAVORS.vanilla;
  const geos = getCookieGeos(shapeId);

  const root = new THREE.Group();
  root.userData.shapeId = shapeId;
  root.userData.flavorKey = flavorKey;
  root.userData.cookieScale = scale;
  root.userData.bakeLevel = 0;

  const body = new THREE.Group();
  body.scale.set(scale, 1, scale);
  root.add(body);

  // Unique per-cookie materials so each cookie can bake smoothly
  const baseFace = mats.paper(flavor.rawBase, { unique: true, roughness: 0.9 });
  const baseEdge = mats.paper('#faf2e3', { unique: true, roughness: 0.95, bumpScale: 0.01 });
  const midFace = mats.paper(flavor.rawTop, { unique: true, roughness: 0.88 });
  const midEdge = mats.paper('#fdf7ec', { unique: true, roughness: 0.95, bumpScale: 0.01 });
  const topFace = mats.paper(flavor.rawTop, { unique: true, roughness: 0.86 });

  const baseMesh = new THREE.Mesh(geos.baseGeo, [baseFace, baseEdge]);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  body.add(baseMesh);

  const midMesh = new THREE.Mesh(geos.midGeo, [midFace, midEdge]);
  midMesh.position.y = 0.078;
  midMesh.castShadow = true;
  midMesh.receiveShadow = true;
  body.add(midMesh);

  const topMesh = new THREE.Mesh(geos.topGeo, [topFace, midEdge]);
  topMesh.position.y = 0.132;
  topMesh.castShadow = false;
  topMesh.receiveShadow = true;
  body.add(topMesh);

  // Crisp paper-shadow disk under cookie
  const shadowMesh = new THREE.Mesh(geos.shadowGeo, mats.shadowPaper);
  shadowMesh.position.y = -0.002;
  body.add(shadowMesh);

  // Container for all icing strokes and toppings (attached directly to cookie so they travel to the Gift Box!)
  const decoGroup = new THREE.Group();
  decoGroup.position.y = 0.172;
  root.add(decoGroup);

  const cRawBase = new THREE.Color(flavor.rawBase);
  const cRawTop = new THREE.Color(flavor.rawTop);
  const cBakedBase = new THREE.Color(flavor.bakedBase);
  const cBakedTop = new THREE.Color(flavor.bakedTop);
  const cDarkBase = new THREE.Color(flavor.darkBakedBase);
  const cDarkTop = new THREE.Color(flavor.darkBakedTop);
  const cEdgeRaw = new THREE.Color('#faf2e3');
  const cEdgeBaked = new THREE.Color('#ecd6b3');

  function setBakeLevel(level) {
    // level: 0 (raw) -> 1 (golden) -> 1.4 (deep cozy caramel)
    root.userData.bakeLevel = level;
    if (level <= 1) {
      baseFace.color.lerpColors(cRawBase, cBakedBase, level);
      midFace.color.lerpColors(cRawTop, cBakedTop, level);
      topFace.color.lerpColors(cRawTop, cBakedTop, level * 0.86);
      baseEdge.color.lerpColors(cEdgeRaw, cEdgeBaked, level);
    } else {
      const extra = Math.min(1, (level - 1) / 0.45);
      baseFace.color.lerpColors(cBakedBase, cDarkBase, extra);
      midFace.color.lerpColors(cBakedTop, cDarkTop, extra);
      topFace.color.lerpColors(cBakedTop, cDarkTop, extra * 0.9);
      baseEdge.color.lerpColors(cEdgeBaked, cBakedBase, extra * 0.5);
    }
    // Gentle paper-puff expansion while baking!
    const puffY = 1 + Math.min(level, 1.2) * 0.26;
    body.scale.set(scale * (1 + Math.min(level, 1) * 0.045), puffY, scale * (1 + Math.min(level, 1) * 0.045));
    decoGroup.position.y = 0.172 * puffY;
  }

  return {
    root,
    body,
    decoGroup,
    shapeId,
    flavorKey,
    scale,
    setBakeLevel,
    decorationCount: 0,
    icingHeightMap: [], // Array of { x, z, y } samples so toppings stack cleanly atop icing!
  };
}

// Fast 2D point-in-polygon hit test in cookie local XZ space
const shapePolyCache = new Map();
export function isPointInCookie(shapeId, localX, localZ, scale = 1.0, margin = 0.96) {
  let pts = shapePolyCache.get(shapeId);
  if (!pts) {
    pts = getShapePoints(shapeId, 1.0);
    shapePolyCache.set(shapeId, pts);
  }
  // Note: ExtrudeGeometry rotated by -PI/2 around X maps shape (x, y) -> world (x, -y) in (X, Z)
  const px = localX / (scale * margin);
  const py = -localZ / (scale * margin);

  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    const intersect = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
