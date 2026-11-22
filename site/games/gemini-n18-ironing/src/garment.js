import * as THREE from 'three';
import { BOARD_Y } from './room.js';
import { createSoftClothShadowTexture } from './assets.js';

export const GARMENT_CATALOG = [
  {
    id: 'gingham_handkerchief',
    shape: 'square',
    width: 0.34,
    depth: 0.29,
    texKey: 'ginghamCheck',
    tint: '#ffffff',
    roughness: 0.88,
    wrinkleHeight: 0.026,
    foldSteps: 2,
    thickness: 0.011,
  },
  {
    id: 'poplin_shirt',
    shape: 'shirt',
    width: 0.40,
    depth: 0.31,
    texKey: 'stretchPoplin',
    tint: '#ffffff', // Already cleanly dyed crisp sky-white cotton poplin!
    roughness: 0.84,
    wrinkleHeight: 0.027,
    foldSteps: 3,
    thickness: 0.016,
  },
  {
    id: 'floral_scarf',
    shape: 'square',
    width: 0.35,
    depth: 0.28,
    texKey: 'floralJacquard',
    tint: '#ffffff',
    roughness: 0.82,
    wrinkleHeight: 0.025,
    foldSteps: 2,
    thickness: 0.012,
  },
  {
    id: 'waffle_towel',
    shape: 'rect',
    width: 0.38,
    depth: 0.27,
    texKey: 'waffleCotton',
    tint: '#ffffff', // Dyed warm ecru-cream waffle cotton!
    roughness: 0.94,
    wrinkleHeight: 0.026,
    foldSteps: 2,
    thickness: 0.019,
  },
  {
    id: 'chambray_linen_shirt',
    shape: 'shirt',
    width: 0.39,
    depth: 0.30,
    texKey: 'roughLinen',
    tint: '#f2f5fa', // Authentic soft chambray blue linen shirt!
    roughness: 0.91,
    wrinkleHeight: 0.028,
    foldSteps: 3,
    thickness: 0.016,
  },
];

function hash2(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function noise2D(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/**
 * Physical crumpled-laundry ridge field: sharp domain-warped triangular creases + broad rumples.
 */
function clothCreaseHeight(u, v, seed) {
  const wx = (noise2D(u * 4.4, v * 4.4, seed + 1.1) - 0.5) * 0.52;
  const wy = (noise2D(u * 4.4, v * 4.4, seed + 5.7) - 0.5) * 0.52;
  const nu = u + wx;
  const nv = v + wy;

  const r1 = 1 - Math.abs(noise2D(nu * 5.6, nv * 5.6, seed + 11.3) * 2 - 1);
  const r2 = 1 - Math.abs(noise2D(nu * 11.0, nv * 11.0, seed + 23.9) * 2 - 1);
  const broad = noise2D(nu * 2.6, nv * 2.6, seed + 37.1);

  const d1 = 1 - Math.abs(((nu * 2.2 + nv * 1.5 + wx * 1.4 + 10) % 1) * 2 - 1);
  const d2 = 1 - Math.abs(((nu * 1.7 - nv * 2.4 + wy * 1.4 + 10) % 1) * 2 - 1);

  const ridge = Math.pow(r1, 2.3) * 0.48 + Math.pow(r2, 2.6) * 0.24 + Math.pow(d1, 3.2) * 0.15 + Math.pow(d2, 3.2) * 0.13;
  return Math.min(1, Math.max(0, ridge * 0.86 + broad * 0.22));
}

export function createGarmentManager(scene, assets, room) {
  const { textures } = assets;
  const garmentRoot = new THREE.Group();
  scene.add(garmentRoot);

  // Centered neatly on the left-middle working zone of the ironing board
  const workCenter = new THREE.Vector3(-0.085, BOARD_Y + 0.0022, 0.012);

  const MAP_SIZE = 256;
  const stateCanvas = document.createElement('canvas');
  stateCanvas.width = MAP_SIZE;
  stateCanvas.height = MAP_SIZE;
  const stateCtx = stateCanvas.getContext('2d');

  const SEG_X = 78;
  const SEG_Z = 60;
  const VERT_COUNT = (SEG_X + 1) * (SEG_Z + 1);

  const basePos = new Float32Array(VERT_COUNT * 3);
  const creaseAmp = new Float32Array(VERT_COUNT);
  const wrinkle = new Float32Array(VERT_COUNT);
  const moisture = new Float32Array(VERT_COUNT);
  const warmth = new Float32Array(VERT_COUNT);
  const mask = new Float32Array(VERT_COUNT);

  const stackGroup = new THREE.Group();
  stackGroup.position.copy(room.stackSurfacePos);
  scene.add(stackGroup);
  const stackedItems = [];
  let stackHeight = 0;

  // Real draped crumpled fabric sheets tucked inside the wicker laundry basket!
  const basketLaundryGroup = new THREE.Group();
  basketLaundryGroup.position.copy(room.basketRimPos);
  scene.add(basketLaundryGroup);
  const basketSheets = buildBasketLaundry(basketLaundryGroup, textures);

  let currentCatalogIdx = 0;
  let activeMesh = null;
  let activeMat = null;
  let activeExtras = new THREE.Group();
  let activeButtons = [];
  let activeSpec = null;
  let activeColorTex = null;
  let baseImgData = null;

  let foldTargetStage = 0;
  let foldFromStage = 0;
  let foldAnim = 1;
  let idleCurl = 0;
  let flyAnim = null;
  let smoothness = 0;

  // Soft feathered contact shadow under the garment (ZERO hard dark grey box!)
  const softShadowTex = createSoftClothShadowTexture();
  const clothShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.36),
    new THREE.MeshBasicMaterial({
      map: softShadowTex,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    })
  );
  clothShadow.rotation.x = -Math.PI / 2;
  clothShadow.position.set(workCenter.x, BOARD_Y + 0.0007, workCenter.z);
  garmentRoot.add(clothShadow);

  function buildShirtMask(u, v) {
    const inTorso = u >= 0.04 && u <= 0.88 && v >= 0.17 && v <= 0.83;
    const inSleeve = u >= 0.56 && u <= 0.86 && v >= 0.03 && v <= 0.97;
    const inCollar = u > 0.88 && u <= 0.96 && v >= 0.34 && v <= 0.66;
    return inTorso || inSleeve || inCollar;
  }

  function prepareGarmentCanvas(spec) {
    const pbr = textures[spec.texKey];
    const img = pbr.map.image;
    stateCtx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

    const temp = document.createElement('canvas');
    temp.width = MAP_SIZE;
    temp.height = MAP_SIZE;
    const tctx = temp.getContext('2d');
    const rep = spec.id === 'gingham_handkerchief' ? 2 : 3;
    const tile = MAP_SIZE / rep;
    for (let x = 0; x < rep; x++) {
      for (let y = 0; y < rep; y++) {
        tctx.drawImage(img, x * tile, y * tile, tile, tile);
      }
    }

    const tint = new THREE.Color(spec.tint);
    const idata = tctx.getImageData(0, 0, MAP_SIZE, MAP_SIZE);
    const d = idata.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, Math.round(d[i] * tint.r));
      d[i + 1] = Math.min(255, Math.round(d[i + 1] * tint.g));
      d[i + 2] = Math.min(255, Math.round(d[i + 2] * tint.b));
    }

    tctx.putImageData(idata, 0, 0);
    // Subtle real single-needle stitched hem border
    tctx.strokeStyle = 'rgba(55, 48, 42, 0.22)';
    tctx.lineWidth = 1.1;
    tctx.setLineDash([4, 3]);
    tctx.strokeRect(7, 7, MAP_SIZE - 14, MAP_SIZE - 14);
    tctx.setLineDash([]);

    baseImgData = tctx.getImageData(0, 0, MAP_SIZE, MAP_SIZE);
    stateCtx.putImageData(baseImgData, 0, 0);

    if (activeColorTex) activeColorTex.dispose();
    activeColorTex = new THREE.CanvasTexture(stateCanvas);
    activeColorTex.colorSpace = THREE.SRGBColorSpace;
    activeColorTex.anisotropy = 8;
    return activeColorTex;
  }

  function updateGarmentColorCanvas() {
    if (!baseImgData || !activeColorTex) return;
    const out = stateCtx.createImageData(MAP_SIZE, MAP_SIZE);
    const src = baseImgData.data;
    const dst = out.data;

    for (let py = 0; py < MAP_SIZE; py++) {
      const v = py / (MAP_SIZE - 1);
      const gz = Math.min(SEG_Z, Math.round(v * SEG_Z));
      for (let px = 0; px < MAP_SIZE; px++) {
        const u = px / (MAP_SIZE - 1);
        const gx = Math.min(SEG_X, Math.round(u * SEG_X));
        const vi = gz * (SEG_X + 1) + gx;
        const w = wrinkle[vi];
        const m = moisture[vi];
        const ca = creaseAmp[vi];

        // Realistic crevice ambient occlusion inside pinched folds + visible damp cloth darkening!
        const creaseShade = 1.0 - w * (1.0 - ca) * 0.22;
        const dampShade = 1.0 - m * 0.28;
        const mul = creaseShade * dampShade;

        const p = (py * MAP_SIZE + px) * 4;
        dst[p] = Math.max(0, Math.min(255, src[p] * mul));
        dst[p + 1] = Math.max(0, Math.min(255, src[p + 1] * mul));
        dst[p + 2] = Math.max(0, Math.min(255, src[p + 2] * mul));
        dst[p + 3] = 255;
      }
    }
    stateCtx.putImageData(out, 0, 0);
    activeColorTex.needsUpdate = true;
  }

  function spawnGarment(index = currentCatalogIdx, animateFromBasket = false) {
    currentCatalogIdx = index % GARMENT_CATALOG.length;
    const spec = GARMENT_CATALOG[currentCatalogIdx];
    activeSpec = spec;
    foldTargetStage = 0;
    foldFromStage = 0;
    foldAnim = 1;
    idleCurl = 0;

    if (activeMesh) {
      garmentRoot.remove(activeMesh);
      activeMesh.geometry.dispose();
      activeMesh.material.dispose();
    }
    garmentRoot.remove(activeExtras);
    activeExtras = new THREE.Group();
    activeButtons = [];

    const seed = 3.7 + currentCatalogIdx * 19.3 + 2.1;
    const geo = new THREE.PlaneGeometry(spec.width, spec.depth, SEG_X, SEG_Z);
    geo.rotateX(-Math.PI / 2);

    const posAttr = geo.attributes.position;
    const uvAttr = geo.attributes.uv;

    for (let i = 0; i < VERT_COUNT; i++) {
      const u = uvAttr.getX(i);
      const v = 1 - uvAttr.getY(i);
      const x = posAttr.getX(i);
      let z = posAttr.getZ(i);

      let inMask = 1;
      if (spec.shape === 'shirt') {
        const sleeveFactor = THREE.MathUtils.smoothstep(u, 0.52, 0.64) * (1 - THREE.MathUtils.smoothstep(u, 0.84, 0.94));
        const collarNeck = THREE.MathUtils.smoothstep(u, 0.86, 0.98);
        const zScale = 0.72 + sleeveFactor * 0.30 - collarNeck * 0.28;
        z *= zScale;
        inMask = buildShirtMask(u, v) ? 1 : 0.85;
      }

      const edgeWave = (noise2D(u * 6, v * 6, seed + 41) - 0.5) * 0.0055;
      const edgeDist = Math.min(u, 1 - u, v, 1 - v);
      const edgeDrop = edgeDist < 0.03 ? (1 - edgeDist / 0.03) * 0.0022 : 0;

      basePos[i * 3] = x + edgeWave;
      basePos[i * 3 + 1] = -edgeDrop;
      basePos[i * 3 + 2] = z + edgeWave;

      creaseAmp[i] = clothCreaseHeight(u, v, seed);
      const edgeFade = Math.min(1, edgeDist * 9.5 + 0.34);
      wrinkle[i] = 0.88 + 0.12 * hash2(u * 20, v * 20, seed);
      creaseAmp[i] *= edgeFade;
      moisture[i] = 0;
      warmth[i] = 0;
      mask[i] = inMask;
    }

    const colorTex = prepareGarmentCanvas(spec);
    const pbr = textures[spec.texKey];
    activeMat = new THREE.MeshPhysicalMaterial({
      map: colorTex,
      normalMap: pbr.normalMap,
      normalScale: new THREE.Vector2(0.88, 0.88),
      roughnessMap: pbr.armMap,
      roughness: spec.roughness,
      metalness: 0.0,
      sheen: 0.34,
      sheenRoughness: 0.76,
      sheenColor: new THREE.Color('#ffffff'),
      side: THREE.DoubleSide,
      envMapIntensity: 0.52,
    });

    activeMesh = new THREE.Mesh(geo, activeMat);
    activeMesh.position.copy(workCenter);
    activeMesh.castShadow = true;
    activeMesh.receiveShadow = true;
    garmentRoot.add(activeMesh);

    if (spec.shape === 'shirt') {
      buildShirtDetails(activeExtras, activeButtons, spec, activeMat);
      activeExtras.position.copy(workCenter);
      garmentRoot.add(activeExtras);
    }

    clothShadow.scale.set(spec.width / 0.34, spec.depth / 0.29, 1);

    rebuildClothGeometry();
    updateGarmentColorCanvas();
    recomputeSmoothness();

    if (animateFromBasket) {
      flyAnim = {
        type: 'fromBasket',
        t: 0,
        duration: 0.62,
        from: room.basketRimPos.clone(),
        to: workCenter.clone(),
      };
    }
  }

  function buildShirtDetails(group, buttonsOut, spec, clothMat) {
    const placket = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.74, 0.0022, 0.023), clothMat);
    placket.position.set(-0.01, 0.002, 0);
    placket.receiveShadow = true;
    group.add(placket);

    for (const side of [-1, 1]) {
      const collarLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.0032, 0.044), clothMat);
      collarLeaf.position.set(spec.width * 0.39, 0.0052, side * 0.030);
      collarLeaf.rotation.y = side * 0.34;
      collarLeaf.rotation.z = -0.06;
      collarLeaf.castShadow = true;
      collarLeaf.receiveShadow = true;
      group.add(collarLeaf);
    }

    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.002, 0.058), clothMat);
    pocket.position.set(spec.width * 0.14, 0.0022, -0.058);
    pocket.receiveShadow = true;
    group.add(pocket);

    const pearlMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f4f1e8'),
      roughness: 0.16,
      metalness: 0.05,
      clearcoat: 0.85,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.2,
    });
    for (let i = 0; i < 4; i++) {
      const bx = -spec.width * 0.28 + i * (spec.width * 0.19);
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.0062, 0.0025, 16), pearlMat);
      btn.position.set(bx, 0.0044, 0);
      btn.castShadow = true;
      btn.receiveShadow = true;
      group.add(btn);
      buttonsOut.push({ mesh: btn, localX: bx, localZ: 0, lastClick: 0 });
    }
  }

  function rebuildClothGeometry() {
    if (!activeMesh || !activeSpec) return;
    const pos = activeMesh.geometry.attributes.position;
    const uv = activeMesh.geometry.attributes.uv;
    const wH = activeSpec.wrinkleHeight;
    const hd = activeSpec.depth * 0.5;

    const f1 = getFoldProgress(1);
    const f2 = getFoldProgress(2);
    const f3 = getFoldProgress(3);

    for (let i = 0; i < VERT_COUNT; i++) {
      const u = uv.getX(i);
      const v = 1 - uv.getY(i);
      const w = wrinkle[i];
      const ca = creaseAmp[i];

      let x = basePos[i * 3];
      let y = basePos[i * 3 + 1];
      let z = basePos[i * 3 + 2];

      const h = w * ca * wH;
      const bunch = 1.0 - w * 0.062;
      x *= bunch;
      z *= bunch;
      y += h;

      if (idleCurl > 0.001 && foldTargetStage < activeSpec.foldSteps) {
        if (foldTargetStage === 0 && u < 0.26) {
          const k = Math.pow((0.26 - u) / 0.26, 1.8);
          y += k * idleCurl * 0.022;
          x += k * idleCurl * 0.009;
        } else if (foldTargetStage === 1 && activeSpec.foldSteps === 3 && u > 0.74) {
          const k = Math.pow((u - 0.74) / 0.26, 1.8);
          y += k * idleCurl * 0.022;
          x -= k * idleCurl * 0.009;
        } else if (v > 0.74) {
          const k = Math.pow((v - 0.74) / 0.26, 1.8);
          y += k * idleCurl * 0.022;
          z -= k * idleCurl * 0.009;
        }
      }

      if (activeSpec.foldSteps === 2) {
        if (f1 > 0.001 && x < 0) {
          const ang = f1 * Math.PI;
          const dist = -x;
          const arcLift = Math.sin(ang) * 0.012;
          x = -Math.cos(ang) * dist;
          y = y * Math.cos(ang) + Math.sin(ang) * dist + f1 * 0.0045 + arcLift;
        }
        if (f2 > 0.001 && z > 0) {
          const ang = f2 * Math.PI;
          const dist = z;
          const arcLift = Math.sin(ang) * 0.012;
          z = Math.cos(ang) * dist;
          y += Math.sin(ang) * dist + f2 * 0.0075 + arcLift;
        }
      } else {
        const zSplit = hd * 0.30;
        if (f1 > 0.001 && z < -zSplit) {
          const ang = f1 * Math.PI;
          const dist = -zSplit - z;
          z = -zSplit + Math.cos(Math.PI - ang) * dist;
          y += Math.sin(ang) * dist + f1 * 0.004;
        }
        if (f2 > 0.001 && z > zSplit) {
          const ang = f2 * Math.PI;
          const dist = z - zSplit;
          z = zSplit + Math.cos(ang) * dist;
          y += Math.sin(ang) * dist + f2 * 0.0065;
        }
        if (f3 > 0.001 && x < 0) {
          const ang = f3 * Math.PI;
          const dist = -x;
          x = -Math.cos(ang) * dist;
          y += Math.sin(ang) * dist + f3 * 0.010;
        }
      }

      pos.setXYZ(i, x, Math.max(0.0002, y), z);
    }

    pos.needsUpdate = true;
    activeMesh.geometry.computeVertexNormals();

    if (activeSpec.shape === 'shirt') {
      const centerIdx = Math.floor(SEG_Z * 0.5) * (SEG_X + 1) + Math.floor(SEG_X * 0.5);
      activeExtras.position.y = workCenter.y + wrinkle[centerIdx] * activeSpec.wrinkleHeight * 0.45;
      activeExtras.visible = f3 < 0.55;
    }
  }

  function getFoldProgress(stepNumber) {
    if (foldTargetStage < stepNumber) return 0;
    if (foldFromStage >= stepNumber) return 1;
    const t = Math.min(1, Math.max(0, foldAnim));
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function recomputeSmoothness() {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < VERT_COUNT; i++) {
      if (mask[i] > 0.5) {
        sum += 1 - wrinkle[i];
        count++;
      }
    }
    smoothness = count > 0 ? sum / count : 1;
    return smoothness;
  }

  let canvasDirtyTimer = 0;
  function applyIronPress(wx, wz, rotY, speed, dt, time) {
    if (!activeMesh || !activeSpec || foldTargetStage > 0 || flyAnim) {
      return { onCloth: false, smoothedAmount: 0, steamFromMoisture: 0, hitButton: false };
    }

    const lx = wx - workCenter.x;
    const lz = wz - workCenter.z;
    const hw = activeSpec.width * 0.5;
    const hd = activeSpec.depth * 0.5;

    if (Math.abs(lx) > hw + 0.11 || Math.abs(lz) > hd + 0.11) {
      return { onCloth: false, smoothedAmount: 0, steamFromMoisture: 0, hitButton: false };
    }

    const cosR = Math.cos(-rotY);
    const sinR = Math.sin(-rotY);
    let touched = 0;
    let smoothedAmount = 0;
    let steamFromMoisture = 0;

    const baseRate = (3.0 + Math.min(4.4, speed * 5.4)) * dt;

    for (let i = 0; i < VERT_COUNT; i++) {
      const vx = basePos[i * 3];
      const vz = basePos[i * 3 + 2];
      const dx = vx - lx;
      const dz = vz - lz;
      if (dx * dx + dz * dz > 0.022) continue;

      const ix = dx * cosR - dz * sinR;
      const iz = dx * sinR + dz * cosR;
      if (iz < -0.128 || iz > 0.115) continue;

      const t = (0.115 - iz) / 0.243;
      const plateHW = 0.064 * Math.pow(Math.max(0.001, 1 - Math.pow(Math.max(0, t - 0.12) / 0.88, 1.5)), 0.72);
      const ax = Math.abs(ix);
      if (ax <= plateHW) {
        touched++;
        const edgeSoft = Math.min(1, (plateHW - ax) / 0.018);
        const dampBoost = 1 + moisture[i] * 2.5;
        const prev = wrinkle[i];
        const next = Math.max(0, prev - baseRate * edgeSoft * dampBoost);
        wrinkle[i] = next;
        smoothedAmount += prev - next;

        if (moisture[i] > 0.01) {
          const evap = Math.min(moisture[i], dt * 1.45 * edgeSoft);
          moisture[i] -= evap;
          steamFromMoisture += evap;
        }
        warmth[i] = Math.min(1, warmth[i] + dt * 1.8 * edgeSoft);
      }
    }

    let hitButton = false;
    if (activeButtons.length > 0) {
      for (const b of activeButtons) {
        const d = Math.hypot(b.localX - lx, b.localZ - lz);
        if (d < 0.042 && time - b.lastClick > 0.55 && speed > 0.06) {
          b.lastClick = time;
          hitButton = true;
        }
      }
    }

    if (touched > 0) {
      rebuildClothGeometry();
      recomputeSmoothness();
      canvasDirtyTimer += dt;
      if (canvasDirtyTimer > 0.05) {
        updateGarmentColorCanvas();
        canvasDirtyTimer = 0;
      }
    }

    return { onCloth: touched > 0, smoothedAmount, steamFromMoisture, hitButton };
  }

  function applyWaterMist(wx, wz, radius = 0.115) {
    if (!activeMesh || !activeSpec || foldTargetStage > 0) return;
    const lx = wx - workCenter.x;
    const lz = wz - workCenter.z;
    const r2 = radius * radius;
    let changed = false;

    for (let i = 0; i < VERT_COUNT; i++) {
      const dx = basePos[i * 3] - lx;
      const dz = basePos[i * 3 + 2] - lz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r2) {
        const falloff = 1 - Math.sqrt(d2) / radius;
        const speckle = 0.65 + 0.35 * Math.random();
        moisture[i] = Math.min(1, moisture[i] + falloff * 0.82 * speckle);
        changed = true;
      }
    }
    if (changed) updateGarmentColorCanvas();
  }

  function triggerNextFold() {
    if (!activeSpec || flyAnim || foldAnim < 0.85) return false;
    if (foldTargetStage >= activeSpec.foldSteps) return false;
    foldFromStage = foldTargetStage;
    foldTargetStage++;
    foldAnim = 0;
    idleCurl = 0;
    return true;
  }

  function addFoldedItemToStack(spec) {
    const fw = spec.shape === 'shirt' ? 0.175 : 0.155;
    const fd = spec.shape === 'shirt' ? 0.20 : 0.155;
    const fh = spec.thickness;

    const itemGroup = new THREE.Group();
    const pbr = textures[spec.texKey];
    const mat = new THREE.MeshStandardMaterial({
      map: pbr.map,
      normalMap: pbr.normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: pbr.armMap,
      color: new THREE.Color(spec.tint),
      roughness: spec.roughness,
      metalness: 0.0,
    });

    const shape = new THREE.Shape();
    const r = 0.015;
    const hw = fw * 0.5;
    const hd = fd * 0.5;
    shape.moveTo(-hw + r, -hd);
    shape.lineTo(hw - r, -hd);
    shape.quadraticCurveTo(hw, -hd, hw, -hd + r);
    shape.lineTo(hw, hd - r);
    shape.quadraticCurveTo(hw, hd, hw - r, hd);
    shape.lineTo(-hw + r, hd);
    shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
    shape.lineTo(-hw, -hd + r);
    shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: fh * 0.65,
      bevelEnabled: true,
      bevelThickness: fh * 0.28,
      bevelSize: 0.005,
      bevelSegments: 3,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, fh * 0.28, 0);
    // Scale UVs so real fabric weave (gingham checks, linen threads, waffle cotton) shows crisply on the stack!
    const uvAttr = geo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setXY(i, uvAttr.getX(i) * 5.2 + 0.5, uvAttr.getY(i) * 5.2 + 0.5);
    }
    uvAttr.needsUpdate = true;

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    itemGroup.add(mesh);

    if (spec.shape === 'shirt') {
      const pearlMat = new THREE.MeshPhysicalMaterial({ color: '#f4f1e8', roughness: 0.18, clearcoat: 0.8 });
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.0025, 12), pearlMat);
      btn.position.set(0, fh + 0.001, -0.022);
      itemGroup.add(btn);
    }

    const idx = stackedItems.length;
    const jitterX = Math.sin(idx * 2.7) * 0.007;
    const jitterZ = Math.cos(idx * 3.1) * 0.006;
    const jitterRot = Math.sin(idx * 4.3) * 0.08;

    const targetY = stackHeight;
    itemGroup.position.set(jitterX, targetY, jitterZ);
    itemGroup.rotation.y = jitterRot;
    stackGroup.add(itemGroup);
    stackedItems.push({ group: itemGroup, baseY: targetY, bounce: 1.0 });
    stackHeight += fh * 1.08;

    return {
      worldTarget: new THREE.Vector3(
        room.stackSurfacePos.x + jitterX,
        room.stackSurfacePos.y + targetY + fh * 0.5,
        room.stackSurfacePos.z + jitterZ
      ),
      itemGroup,
    };
  }

  let stackJiggle = 0;
  function pokeStack() {
    stackJiggle = 1.0;
  }

  function update(dt, time, readyForFold, onStackLanded) {
    let moistureChanged = false;
    for (let i = 0; i < VERT_COUNT; i++) {
      if (moisture[i] > 0.001) {
        moisture[i] = Math.max(0, moisture[i] - dt * 0.045);
        moistureChanged = true;
      }
      if (warmth[i] > 0.001) {
        warmth[i] = Math.max(0, warmth[i] - dt * 0.12);
      }
    }
    if (moistureChanged) {
      canvasDirtyTimer += dt;
      if (canvasDirtyTimer > 0.15) {
        updateGarmentColorCanvas();
        canvasDirtyTimer = 0;
      }
    }

    if (foldAnim < 1) {
      foldAnim = Math.min(1, foldAnim + dt * 2.2);
      rebuildClothGeometry();
      if (foldAnim >= 1 && foldTargetStage >= activeSpec.foldSteps && !flyAnim) {
        const placed = addFoldedItemToStack(activeSpec);
        placed.itemGroup.visible = false;
        flyAnim = {
          type: 'toStack',
          t: 0,
          duration: 0.72,
          from: workCenter.clone(),
          to: placed.worldTarget,
          revealGroup: placed.itemGroup,
          onDone: onStackLanded,
        };
      }
    } else if (readyForFold && !flyAnim) {
      const targetCurl = 0.55 + Math.sin(time * 2.6) * 0.45;
      idleCurl += (targetCurl - idleCurl) * Math.min(1, dt * 4);
      rebuildClothGeometry();
    } else if (idleCurl > 0.001) {
      idleCurl = Math.max(0, idleCurl - dt * 4);
      rebuildClothGeometry();
    }

    if (flyAnim && activeMesh) {
      flyAnim.t += dt / flyAnim.duration;
      const t = Math.min(1, flyAnim.t);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const arcY = Math.sin(ease * Math.PI) * 0.18;
      activeMesh.position.lerpVectors(flyAnim.from, flyAnim.to, ease);
      activeMesh.position.y += arcY;
      activeExtras.position.copy(activeMesh.position);

      if (flyAnim.type === 'toStack') {
        activeMesh.scale.setScalar(1 - ease * 0.18);
        clothShadow.material.opacity = 0.48 * (1 - ease);
        if (t >= 1) {
          activeMesh.visible = false;
          activeExtras.visible = false;
          if (flyAnim.revealGroup) flyAnim.revealGroup.visible = true;
          const cb = flyAnim.onDone;
          flyAnim = null;
          if (cb) cb();
        }
      } else if (flyAnim.type === 'fromBasket') {
        activeMesh.visible = true;
        activeMesh.scale.setScalar(0.45 + ease * 0.55);
        activeMesh.rotation.y = (1 - ease) * 0.5;
        clothShadow.material.opacity = 0.48 * ease;
        if (t >= 1) {
          activeMesh.position.copy(workCenter);
          activeMesh.scale.setScalar(1);
          activeMesh.rotation.y = 0;
          activeExtras.position.copy(workCenter);
          flyAnim = null;
        }
      }
    }

    if (stackJiggle > 0.001) stackJiggle = Math.max(0, stackJiggle - dt * 2.2);
    for (let i = 0; i < stackedItems.length; i++) {
      const it = stackedItems[i];
      if (it.bounce > 0.001) {
        it.bounce = Math.max(0, it.bounce - dt * 3.5);
        it.group.scale.y = 1 - Math.sin(it.bounce * Math.PI) * 0.18;
      } else {
        it.group.scale.y = 1;
      }
      if (stackJiggle > 0.001) {
        it.group.rotation.z = Math.sin(time * 18 - i * 0.7) * stackJiggle * 0.004 * (i + 1);
      } else {
        it.group.rotation.z *= 0.85;
      }
    }

    for (let i = 0; i < basketSheets.length; i++) {
      const b = basketSheets[i];
      const pulse = b.userData.invite ? Math.sin(time * 4.5 + i) * 0.007 : 0;
      b.position.y = b.userData.baseY + pulse;
    }
  }

  function setBasketInvite(invite) {
    for (const b of basketSheets) b.userData.invite = invite;
  }

  spawnGarment(0, false);

  return {
    workCenter,
    stackGroup,
    basketLaundryGroup,
    getActiveMesh: () => activeMesh,
    getActiveSpec: () => activeSpec,
    getSmoothness: () => smoothness,
    getFoldStage: () => foldTargetStage,
    getStackCount: () => stackedItems.length,
    isAnimating: () => Boolean(flyAnim) || foldAnim < 1,
    applyIronPress,
    applyWaterMist,
    triggerNextFold,
    spawnNextFromBasket: () => spawnGarment(currentCatalogIdx + 1, true),
    setBasketInvite,
    pokeStack,
    addFoldedItemToStack,
    update,
  };
}

/**
 * Builds soft tucked laundry mounds nestled cleanly INSIDE the wicker basket opening
 * (tightly fitted inside the woven rim so ZERO cloth clips through the basket walls!).
 */
function buildBasketLaundry(group, textures) {
  const sheets = [];
  const specs = [
    { tex: textures.stretchPoplin, tint: '#ffffff', pos: [-0.022, 0.002, 0.012], rot: [0.10, 0.45, 0.06], rad: 0.062, seed: 3.1 },
    { tex: textures.waffleCotton, tint: '#ffffff', pos: [0.020, 0.009, -0.008], rot: [-0.08, 1.25, -0.10], rad: 0.058, seed: 9.4 },
    { tex: textures.roughLinen, tint: '#edf2f8', pos: [-0.004, 0.004, -0.016], rot: [0.06, -0.65, 0.08], rad: 0.060, seed: 17.8 },
  ];

  specs.forEach((s) => {
    const rSegs = 12;
    const aSegs = 28;
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let ir = 0; ir <= rSegs; ir++) {
      const fr = ir / rSegs;
      for (let ia = 0; ia <= aSegs; ia++) {
        const ang = (ia / aSegs) * Math.PI * 2;
        const r = fr * s.rad;
        const x = Math.cos(ang) * r;
        const z = Math.sin(ang) * r;
        const dome = 0.036 * Math.cos(fr * Math.PI * 0.5) - Math.pow(fr, 2.0) * 0.028;
        const pleat = Math.sin(ang * 5 + s.seed) * 0.007 * Math.sin(fr * Math.PI) +
          (noise2D(x * 26 + s.seed, z * 26, s.seed) - 0.5) * 0.012 * Math.sin(fr * Math.PI);
        positions.push(x, dome + pleat, z);
        uvs.push(0.5 + x / (s.rad * 1.4), 0.5 + z / (s.rad * 1.4));
      }
    }
    const stride = aSegs + 1;
    for (let ir = 0; ir < rSegs; ir++) {
      for (let ia = 0; ia < aSegs; ia++) {
        const a = ir * stride + ia;
        const b = a + 1;
        const c = (ir + 1) * stride + ia;
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }
    const discGeo = new THREE.BufferGeometry();
    discGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    discGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    discGeo.setIndex(indices);
    discGeo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: s.tex.map,
      normalMap: s.tex.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: s.tex.armMap,
      color: new THREE.Color(s.tint),
      roughness: 0.90,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(discGeo, mat);
    m.position.set(...s.pos);
    m.rotation.set(...s.rot);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.baseY = s.pos[1];
    m.userData.invite = false;
    group.add(m);
    sheets.push(m);
  });

  return sheets;
}
