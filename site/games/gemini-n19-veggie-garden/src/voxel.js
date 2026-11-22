import * as THREE from '../lib/three.module.js';

/**
 * Create a crisp 128x128 wooden-building-block / voxel bevel texture.
 * Repeats per voxel unit so merged boxes display authentic building-block seams
 * while keeping triangle counts very low for 30fps+ mobile performance.
 */
export function createBlockTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Base bright neutral fill (multiplied by vertex/material color)
  ctx.fillStyle = '#f8f6f2';
  ctx.fillRect(0, 0, size, size);

  // Subtle wooden-block warm micro-grain streaks
  for (let i = 0; i < 42; i++) {
    const y = Math.floor((i * 19) % size);
    const h = 2 + (i % 3);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(180, 155, 125, 0.045)' : 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(0, y, size, h);
  }

  // Soft inner bevel highlight (top & left edges)
  const b = 8;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
  ctx.fillRect(0, 0, size, b);
  ctx.fillRect(0, 0, b, size);

  // Soft inner bevel shade (bottom & right edges)
  ctx.fillStyle = 'rgba(50, 35, 25, 0.14)';
  ctx.fillRect(0, size - b, size, b);
  ctx.fillRect(size - b, 0, b, size);

  // Crisp outer 2px seam line for unmistakable wooden building-block look
  ctx.strokeStyle = 'rgba(65, 48, 35, 0.16)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function createMaterials() {
  const blockTex = createBlockTexture();
  return {
    blockTex,
    matte: new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: blockTex,
      roughness: 0.72,
      metalness: 0.03,
    }),
    gloss: new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: blockTex,
      roughness: 0.28,
      metalness: 0.06,
    }),
    metal: new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: blockTex,
      roughness: 0.24,
      metalness: 0.58,
    }),
    water: new THREE.MeshStandardMaterial({
      color: 0x52d4ff,
      map: blockTex,
      roughness: 0.16,
      metalness: 0.05,
      transparent: true,
      opacity: 0.78,
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xdcf6ff,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
  };
}

// Face directional shading multipliers for crisp 3D voxel depth
const FACE_DEFS = [
  // +X
  {
    normal: [1, 0, 0],
    shade: 0.94,
    corners: (hx, hy, hz) => [
      [hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz],
    ],
    uvDims: (sx, sy, sz) => [sz, sy],
  },
  // -X
  {
    normal: [-1, 0, 0],
    shade: 0.87,
    corners: (hx, hy, hz) => [
      [-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz],
    ],
    uvDims: (sx, sy, sz) => [sz, sy],
  },
  // +Y (top brightest)
  {
    normal: [0, 1, 0],
    shade: 1.05,
    corners: (hx, hy, hz) => [
      [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz],
    ],
    uvDims: (sx, sy, sz) => [sx, sz],
  },
  // -Y (bottom darkest)
  {
    normal: [0, -1, 0],
    shade: 0.76,
    corners: (hx, hy, hz) => [
      [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz],
    ],
    uvDims: (sx, sy, sz) => [sx, sz],
  },
  // +Z (front warm)
  {
    normal: [0, 0, 1],
    shade: 0.99,
    corners: (hx, hy, hz) => [
      [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz],
    ],
    uvDims: (sx, sy, sz) => [sx, sy],
  },
  // -Z
  {
    normal: [0, 0, -1],
    shade: 0.90,
    corners: (hx, hy, hz) => [
      [hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz],
    ],
    uvDims: (sx, sy, sz) => [sx, sy],
  },
];

const _tmpColor = new THREE.Color();

/**
 * Merges multiple voxel boxes into a single optimized BufferGeometry
 * with tiled building-block UVs and directional vertex shading.
 */
export class VoxelBuilder {
  constructor(voxelUnit = 0.25) {
    this.voxelUnit = voxelUnit;
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.colors = [];
    this.indices = [];
    this.vertCount = 0;
  }

  /**
   * Add a box centered at (cx, cy, cz) with size (sx, sy, sz).
   * tileUnit controls block-seam repetition (pass 0 to stretch single block per face).
   */
  addBox(cx, cy, cz, sx, sy, sz, colorHex, tileUnit = this.voxelUnit) {
    const hx = sx * 0.5;
    const hy = sy * 0.5;
    const hz = sz * 0.5;
    _tmpColor.setHex(colorHex);

    for (let f = 0; f < 6; f++) {
      const def = FACE_DEFS[f];
      const pts = def.corners(hx, hy, hz);
      const [du, dv] = def.uvDims(sx, sy, sz);
      const uRep = tileUnit > 0 ? Math.max(1, Math.round(du / tileUnit)) : 1;
      const vRep = tileUnit > 0 ? Math.max(1, Math.round(dv / tileUnit)) : 1;

      const r = Math.min(1, _tmpColor.r * def.shade);
      const g = Math.min(1, _tmpColor.g * def.shade);
      const b = Math.min(1, _tmpColor.b * def.shade);

      const base = this.vertCount;
      const uvs = [
        [0, 0], [uRep, 0], [uRep, vRep], [0, vRep],
      ];

      for (let i = 0; i < 4; i++) {
        this.positions.push(cx + pts[i][0], cy + pts[i][1], cz + pts[i][2]);
        this.normals.push(def.normal[0], def.normal[1], def.normal[2]);
        this.uvs.push(uvs[i][0], uvs[i][1]);
        this.colors.push(r, g, b);
      }

      this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      this.vertCount += 4;
    }
    return this;
  }

  /**
   * Add a single voxel cube on an integer grid scaled by `unit` centered around `origin`.
   */
  addCell(gx, gy, gz, unit, colorHex, ox = 0, oy = 0, oz = 0) {
    return this.addBox(
      ox + gx * unit,
      oy + gy * unit,
      oz + gz * unit,
      unit,
      unit,
      unit,
      colorHex,
      0
    );
  }

  buildGeometry() {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geom.setIndex(this.indices);
    geom.computeBoundingSphere();
    return geom;
  }

  buildMesh(material, castShadow = true, receiveShadow = true) {
    const mesh = new THREE.Mesh(this.buildGeometry(), material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    return mesh;
  }
}

/**
 * Helper: create a single colored voxel block mesh quickly.
 */
export function makeVoxelBlock(sx, sy, sz, colorHex, material, tileUnit = 0) {
  const vb = new VoxelBuilder(tileUnit || 0.25);
  vb.addBox(0, 0, 0, sx, sy, sz, colorHex, tileUnit);
  return vb.buildMesh(material);
}
