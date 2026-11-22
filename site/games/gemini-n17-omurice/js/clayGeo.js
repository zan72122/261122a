import * as THREE from '../vendor/three/three.module.min.js';

/**
 * Deterministic 3D organic clay lump displacement + thumb-press dents.
 * Gives every geometry authentic hand-molded clay character without excessive triangles.
 */
export function sculptClay(geometry, opts = {}) {
  const {
    amp = 0.045,
    freq = 2.6,
    seed = 1.0,
    thumbDents = 3,
    dentDepth = 0.04,
    dentRadius = 0.45,
    flattenBottom = null, // y-threshold below which clay gently flattens onto table
    scaleX = 1,
    scaleY = 1,
    scaleZ = 1,
  } = opts;

  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();

  // Pre-generate deterministic thumb dent directions
  const dents = [];
  for (let i = 0; i < thumbDents; i++) {
    const a = seed * 13.7 + i * 2.39996;
    const b = seed * 7.1 + i * 1.618;
    const dir = new THREE.Vector3(
      Math.cos(a) * Math.cos(b),
      Math.sin(b) * 0.7 + 0.2,
      Math.sin(a) * Math.cos(b)
    ).normalize();
    dents.push(dir);
  }

  // Compute approximate bounding radius so displacement scales cleanly with object size
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const size = new THREE.Vector3();
  box.getSize(size);
  const avgR = Math.max(0.05, (size.x + size.y + size.z) / 6);

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const len = v.length();
    const dir = len > 1e-5 ? v.clone().divideScalar(len) : new THREE.Vector3(0, 1, 0);

    // Multi-frequency gentle hand-kneaded lumpiness
    const nx = v.x * freq + seed * 3.1;
    const ny = v.y * freq + seed * 5.7;
    const nz = v.z * freq + seed * 2.3;

    const lump1 =
      Math.sin(nx * 1.1 + Math.cos(ny * 0.9)) *
      Math.cos(nz * 1.05 + Math.sin(nx * 0.8));
    const lump2 =
      Math.sin(ny * 2.1 - nz * 1.7 + seed) * 0.45 +
      Math.cos(nx * 1.9 + ny * 1.5 - seed * 0.7) * 0.35;

    let disp = (lump1 * 0.65 + lump2 * 0.35) * amp * avgR;

    // Subtle thumb dents pressed into the clay
    for (let d = 0; d < dents.length; d++) {
      const dot = dir.dot(dents[d]);
      const thresh = 1.0 - dentRadius;
      if (dot > thresh) {
        const t = (dot - thresh) / dentRadius;
        disp -= t * t * (3 - 2 * t) * dentDepth * avgR;
      }
    }

    v.addScaledVector(dir, disp);
    v.set(v.x * scaleX, v.y * scaleY, v.z * scaleZ);

    if (flattenBottom !== null && v.y < flattenBottom) {
      v.y = flattenBottom + (v.y - flattenBottom) * 0.12;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Create a plump clay blob sphere (good for rice, peas, tomatoes, heads, clouds, etc.)
 */
export function makeClayBlob(radius = 0.5, segW = 16, segH = 12, opts = {}) {
  const geo = new THREE.SphereGeometry(radius, segW, segH);
  return sculptClay(geo, opts);
}

/**
 * Create a soft rounded clay cylinder (no razor edges) using LatheGeometry
 */
export function makeClayPuck(radius = 1, height = 0.4, bevel = 0.1, radialSegs = 24, opts = {}) {
  const r = radius;
  const h = height * 0.5;
  const b = Math.min(bevel, r * 0.4, h * 0.85);
  const pts = [
    new THREE.Vector2(0, -h),
    new THREE.Vector2(r - b, -h),
    new THREE.Vector2(r - b * 0.3, -h + b * 0.25),
    new THREE.Vector2(r, -h + b),
    new THREE.Vector2(r, h - b),
    new THREE.Vector2(r - b * 0.3, h - b * 0.25),
    new THREE.Vector2(r - b, h),
    new THREE.Vector2(0, h),
  ];
  const geo = new THREE.LatheGeometry(pts, radialSegs);
  return sculptClay(geo, opts);
}

/**
 * Create an almond/football-shaped hand-sculpted Omurice dome!
 * Flat bottom, plump curved top, tapered ends, with subtle handmade asymmetry.
 */
export function makeOmuriceGeometry(length = 2.65, width = 1.52, height = 0.88, seed = 4.2) {
  const geo = new THREE.SphereGeometry(1, 32, 22);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);

    // Classic pointed-oval omurice silhouette along X
    const ax = Math.abs(v.x);
    const taper = 1.0 - 0.34 * Math.pow(ax, 2.2);

    let x = v.x * (length * 0.5);
    let z = v.z * (width * 0.5) * taper;
    let y;

    if (v.y >= 0) {
      // Plump rounded dome on top
      y = Math.pow(v.y, 0.84) * height * (0.94 + 0.08 * (1 - ax));
    } else {
      // Softly tucked bottom resting on plate
      y = v.y * (height * 0.16);
    }

    // Handmade clay organic variation + subtle pinch crease along bottom rim
    const lump =
      Math.sin(x * 2.4 + seed) * Math.cos(z * 3.1 - seed) * 0.022 +
      Math.sin(x * 4.5 - z * 3.8) * 0.01;
    y += lump * (v.y > 0 ? 1 : 0.2);
    z += Math.sin(x * 2.1 + seed * 1.3) * 0.018;

    pos.setXYZ(i, x, y, z);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Evaluate the top surface Y height of the omurice dome at local (x, z),
 * so ketchup tubes, mayo ribbons, and clay toppings hug the curved surface perfectly!
 */
export function sampleOmuriceSurface(x, z, length = 2.65, width = 1.52, height = 0.88) {
  const nx = x / (length * 0.5);
  const ax = Math.min(1, Math.abs(nx));
  const taper = 1.0 - 0.34 * Math.pow(ax, 2.2);
  const nz = z / Math.max(0.05, (width * 0.5) * taper);
  const r2 = nx * nx + nz * nz;
  if (r2 >= 0.96) return null;
  const vy = Math.sqrt(Math.max(0.0001, 1.0 - r2));
  const y = Math.pow(vy, 0.84) * height * (0.94 + 0.08 * (1 - ax));
  return y;
}

/**
 * Create a hand-molded clay ceramic plate (shallow rimmed oval or round dish)
 */
export function makeClayPlate(radiusX = 2.1, radiusZ = 1.55, rimHeight = 0.24, seed = 7.7) {
  // Proper outward-normal CCW LatheGeometry winding: bottom-center -> outer -> rim -> inner -> inner-center
  const pts = [
    new THREE.Vector2(0.0, -0.1),
    new THREE.Vector2(0.72, -0.1),
    new THREE.Vector2(0.84, -0.05),
    new THREE.Vector2(1.01, rimHeight * 0.45),
    new THREE.Vector2(1.06, rimHeight * 0.92),
    new THREE.Vector2(1.02, rimHeight),
    new THREE.Vector2(0.95, rimHeight * 0.72),
    new THREE.Vector2(0.82, 0.05),
    new THREE.Vector2(0.68, 0.0),
    new THREE.Vector2(0.0, 0.0),
  ];
  const geo = new THREE.LatheGeometry(pts, 32);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) * radiusX;
    let y = pos.getY(i);
    let z = pos.getZ(i) * radiusZ;
    // Slight handmade wobble around rim
    const ang = Math.atan2(z, x);
    const wob = Math.sin(ang * 3 + seed) * 0.018 + Math.cos(ang * 5 - seed) * 0.01;
    if (y > 0.05) {
      y += wob;
    }
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/**
 * Create a chunky hand-molded clay star (for star-cut carrots / souvenir stars)
 */
export function makeClayStar(outerR = 0.22, innerR = 0.11, thickness = 0.09, points = 5) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.35,
    bevelSize: outerR * 0.1,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.center();
  geo.rotateX(-Math.PI / 2);
  return sculptClay(geo, { amp: 0.03, freq: 6, thumbDents: 1, dentDepth: 0.02 });
}

/**
 * Create a plump clay heart (for reactions, cheese heart garnish, etc.)
 */
export function makeClayHeart(size = 0.22, thickness = 0.09) {
  const s = size;
  const shape = new THREE.Shape();
  shape.moveTo(0, -s * 0.72);
  shape.bezierCurveTo(s * 0.95, -s * 0.15, s * 0.98, s * 0.8, 0, s * 0.35);
  shape.bezierCurveTo(-s * 0.98, s * 0.8, -s * 0.95, -s * 0.15, 0, -s * 0.72);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.4,
    bevelSize: s * 0.12,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.center();
  return sculptClay(geo, { amp: 0.025, freq: 5, thumbDents: 1, dentDepth: 0.02 });
}

/**
 * Create a clay squeeze bottle (ketchup / mayo) with plump squeezable body & conical clay nozzle
 */
export function makeClaySqueezeBottle(scale = 1.0) {
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.32, 0.0),
    new THREE.Vector2(0.38, 0.08),
    new THREE.Vector2(0.41, 0.42),
    new THREE.Vector2(0.39, 0.92),
    new THREE.Vector2(0.33, 1.12),
    new THREE.Vector2(0.20, 1.24),
    new THREE.Vector2(0.22, 1.32),
    new THREE.Vector2(0.18, 1.38),
    new THREE.Vector2(0.0, 1.38),
  ];
  const bodyGeo = new THREE.LatheGeometry(pts, 20);
  bodyGeo.scale(scale, scale, scale);
  sculptClay(bodyGeo, { amp: 0.032, freq: 3.1, seed: 2.8, thumbDents: 3, dentDepth: 0.04 });

  const capPts = [
    new THREE.Vector2(0.0, 1.35),
    new THREE.Vector2(0.23, 1.35),
    new THREE.Vector2(0.22, 1.50),
    new THREE.Vector2(0.13, 1.62),
    new THREE.Vector2(0.065, 1.94),
    new THREE.Vector2(0.038, 2.02),
    new THREE.Vector2(0.0, 2.02),
  ];
  const capGeo = new THREE.LatheGeometry(capPts, 16);
  capGeo.scale(scale, scale, scale);
  sculptClay(capGeo, { amp: 0.02, freq: 4.0, seed: 5.5, thumbDents: 1, dentDepth: 0.02 });

  return { bodyGeo, capGeo };
}
