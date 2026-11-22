import * as THREE from 'three';
import { createDustSmudgeTexture } from './textures.js';

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

function createCrumbGeometry() {
  const geo = new THREE.IcosahedronGeometry(0.0052, 1);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n =
      0.72 +
      0.34 * Math.sin(x * 420 + y * 310) +
      0.22 * Math.cos(z * 510 - x * 270);
    pos.setXYZ(i, x * n * 1.15, y * n * 0.72, z * n * 0.95);
  }
  geo.computeVertexNormals();
  return geo;
}

function createSandGeometry() {
  const geo = new THREE.OctahedronGeometry(0.0031, 0);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = 0.72 + 0.38 * Math.abs(Math.sin(x * 900 + z * 700 + y * 500));
    pos.setXYZ(i, x * n * 1.25, y * n * 0.65, z * n);
  }
  geo.computeVertexNormals();
  return geo;
}

function createPaperScrapGeometry() {
  // Irregular torn & gently curled paper scrap (~18mm x 14mm)
  const geo = new THREE.PlaneGeometry(0.022, 0.017, 3, 2);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    // Irregular torn silhouette
    const edgeJitter = 0.82 + 0.36 * Math.sin(x * 240 + z * 190);
    x *= edgeJitter;
    z *= 0.86 + 0.28 * Math.cos(x * 180 - z * 230);
    // Natural paper curl lifting the corners ~2-3mm off the floor
    const curl = (x * x * 520 + z * z * 340) * 0.012 + Math.sin(x * 120) * 0.0014;
    y += curl + 0.0012;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

const CRUMB_COLORS = [0xdab87c, 0xc38a46, 0xe4cca0, 0xb17636, 0xca9c5a, 0x9b652c];
const SAND_COLORS = [0x9e886c, 0x867258, 0xb79f80, 0x73624d, 0xc8b498, 0x625444];
const PAPER_COLORS = [0xf2efe8, 0xebe3d3, 0xcbb190, 0xb9c4b5, 0xd8bab5, 0xc1cbd2];

function createCoinGeometry() {
  const geo = new THREE.CylinderGeometry(0.011, 0.011, 0.0024, 18);
  return geo;
}

export class DebrisSystem {
  constructor(scene, roomInfo, vacuumSys) {
    this.scene = scene;
    this.roomInfo = roomInfo;
    this.vacuumSys = vacuumSys;
    this.rand = mulberry32(20261121);

    this.items = []; // unified list of all debris pieces
    this.cupItems = []; // items currently inside the transparent dust cup
    this.sandPatches = []; // subtle sandy floor dust smudges that fade away as sand is vacuumed!
    this.cupCapacity = 72; // fills up clearly mid-clean before needing to empty into the wicker basket!
    this.maxCounts = { crumb: 130, sand: 280, paper: 72, coin: 4 };

    // Shared geometries & photorealistic PBR materials
    const crumbGeo = createCrumbGeometry();
    const crumbMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.5,
    });

    const sandGeo = createSandGeometry();
    const sandMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.62,
      metalness: 0.05,
      envMapIntensity: 0.72,
    });

    const paperGeo = createPaperScrapGeometry();
    const paperMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.89,
      metalness: 0.0,
      side: THREE.DoubleSide,
      envMapIntensity: 0.48,
    });

    // Lost warm brushed-brass coins / buttons tucked under the sofa (delightful surprise discovery!)
    const coinGeo = createCoinGeometry();
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xd9b366,
      roughness: 0.28,
      metalness: 0.86,
      envMapIntensity: 1.35,
    });

    this.dustSmudgeTex = createDustSmudgeTexture();

    // World-space instanced meshes (for floor, sucking, dumping, binned)
    this.worldMeshes = {
      crumb: new THREE.InstancedMesh(crumbGeo, crumbMat, this.maxCounts.crumb),
      sand: new THREE.InstancedMesh(sandGeo, sandMat, this.maxCounts.sand),
      paper: new THREE.InstancedMesh(paperGeo, paperMat, this.maxCounts.paper),
      coin: new THREE.InstancedMesh(coinGeo, coinMat, this.maxCounts.coin),
    };

    // Cup-local instanced meshes (attached directly inside vacuumSys.cupDebrisContainer!)
    this.cupMeshes = {
      crumb: new THREE.InstancedMesh(crumbGeo, crumbMat, this.maxCounts.crumb),
      sand: new THREE.InstancedMesh(sandGeo, sandMat, this.maxCounts.sand),
      paper: new THREE.InstancedMesh(paperGeo, paperMat, this.maxCounts.paper),
      coin: new THREE.InstancedMesh(coinGeo, coinMat, this.maxCounts.coin),
    };

    for (const type of ['crumb', 'sand', 'paper', 'coin']) {
      const wm = this.worldMeshes[type];
      wm.castShadow = type !== 'sand';
      wm.receiveShadow = true;
      wm.frustumCulled = false;
      wm.count = 0;
      scene.add(wm);

      const cm = this.cupMeshes[type];
      cm.castShadow = false;
      cm.receiveShadow = false;
      cm.frustumCulled = false;
      cm.renderOrder = 2; // Render BEFORE transparent outer acrylic cup wall (renderOrder 4)!
      cm.count = 0;
      vacuumSys.cupDebrisContainer.add(cm);
    }

    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._nozzlePos = new THREE.Vector3();
    this._tmpVec = new THREE.Vector3();
  }

  getFloorY(x, z) {
    const r = this.roomInfo.rugBounds;
    if (x >= r.minX + 0.01 && x <= r.maxX - 0.01 && z >= r.minZ + 0.01 && z <= r.maxZ - 0.01) {
      return r.height;
    }
    return 0.0;
  }

  addPiece(type, x, z, zone = 'room', initialState = 'floor') {
    const typeItems = this.items.filter((it) => it.type === type);
    if (typeItems.length >= this.maxCounts[type]) return null;

    const r = this.rand;
    const palette =
      type === 'crumb'
        ? CRUMB_COLORS
        : type === 'sand'
        ? SAND_COLORS
        : type === 'coin'
        ? [0xe5c16c, 0xd4a456]
        : PAPER_COLORS;
    const hex = palette[Math.floor(r() * palette.length)];
    const yBase = this.getFloorY(x, z);

    const scaleBase =
      type === 'crumb'
        ? 0.78 + r() * 0.95
        : type === 'sand'
        ? 0.85 + r() * 0.95
        : type === 'coin'
        ? 1.0
        : 0.78 + r() * 0.65;

    const piece = {
      id: this.items.length,
      type,
      typeIdx: typeItems.length,
      zone, // 'room' | 'underSofa'
      state: initialState, // 'floor' | 'sucking' | 'cup' | 'dumping' | 'binned'
      colorHex: hex,
      pos: new THREE.Vector3(x, yBase + (type === 'paper' ? 0.0008 : type === 'coin' ? 0.0014 : 0.0026), z),
      vel: new THREE.Vector3(),
      rot: new THREE.Euler(
        type === 'paper' ? (r() - 0.5) * 0.2 : type === 'coin' ? 0 : r() * Math.PI,
        r() * Math.PI * 2,
        type === 'paper' ? (r() - 0.5) * 0.2 : type === 'coin' ? 0 : r() * Math.PI
      ),
      scale:
        type === 'coin'
          ? new THREE.Vector3(1, 1, 1)
          : new THREE.Vector3(
              scaleBase * (0.85 + r() * 0.35),
              scaleBase * (0.8 + r() * 0.35),
              scaleBase * (0.85 + r() * 0.35)
            ),
      suckProgress: 0,
      suckStart: new THREE.Vector3(),
      // Cylindrical coordinates strictly inside transparent cyclone dust cup (inner shroud r=0.025, outer wall r=0.059)
      cupAngle: r() * Math.PI * 2,
      cupRadius: type === 'paper' ? 0.034 + r() * 0.01 : 0.031 + r() * 0.015,
      cupZ: -0.09 + r() * 0.092,
      cupSpinSpeed: (type === 'paper' ? 7.8 : type === 'coin' ? 3.2 : type === 'crumb' ? 5.8 : 4.6) * (0.8 + r() * 0.5),
      cupSettledZ: -0.09,
    };

    this.items.push(piece);
    if (initialState === 'cup') {
      this.cupItems.push(piece);
      this._assignCupSettledZ(piece, this.cupItems.length - 1);
    }

    // Set instance colors on both world and cup instanced meshes
    this._color.setHex(hex);
    this.worldMeshes[type].setColorAt(piece.typeIdx, this._color);
    this.cupMeshes[type].setColorAt(piece.typeIdx, this._color);
    this.worldMeshes[type].count = piece.typeIdx + 1;
    this.cupMeshes[type].count = piece.typeIdx + 1;
    if (this.worldMeshes[type].instanceColor) this.worldMeshes[type].instanceColor.needsUpdate = true;
    if (this.cupMeshes[type].instanceColor) this.cupMeshes[type].instanceColor.needsUpdate = true;

    return piece;
  }

  _assignCupSettledZ(piece, orderIdx) {
    // Pile stacks visibly from front lid (z = -0.086) backward toward MAX ring (z = +0.01)
    const frac = Math.min(1, orderIdx / Math.max(1, this.cupCapacity));
    const jitter = (this.rand() - 0.5) * 0.018;
    piece.cupSettledZ = -0.084 + frac * 0.085 + jitter;
    piece.cupZ = Math.max(piece.cupSettledZ, 0.035 + (this.rand() - 0.5) * 0.03);
  }

  /**
   * Populates realistic living-room messes:
   * - Breadcrumbs scattered near coffee table & croissant, plus rug edge
   * - Tracked-in sand clusters on hardwood floor & rug corner
   * - Torn craft paper scraps across rug & open floor
   * - Hidden crumbs, sand & paper tucked naturally UNDER THE SOFA!
   */
  populateInitialMess({ prefillCupSample = 0 } = {}) {
    const r = this.rand;

    // 1. Breadcrumbs spilled from the croissant near coffee table & front rug
    const crumbClusters = [
      { cx: -0.58, cz: 0.06, rad: 0.24, count: 22 },
      { cx: -0.18, cz: 0.16, rad: 0.26, count: 18 },
      { cx: 0.22, cz: -0.34, rad: 0.22, count: 14 },
    ];
    for (const c of crumbClusters) {
      for (let i = 0; i < c.count; i++) {
        const ang = r() * Math.PI * 2;
        const dist = Math.sqrt(r()) * c.rad;
        this.addPiece('crumb', c.cx + Math.cos(ang) * dist, c.cz + Math.sin(ang) * dist, 'room');
      }
    }

    // 2. Tracked-in fine sand patches on hardwood & rug border (with subtle soft dust-smudge decals that clear as you sweep!)
    const sandClusters = [
      { cx: 0.42, cz: 0.16, rad: 0.2, count: 58 },
      { cx: 0.16, cz: -0.04, rad: 0.18, count: 44 },
      { cx: -0.44, cz: -0.46, rad: 0.2, count: 38 },
    ];
    for (const c of sandClusters) {
      const yPatch = this.getFloorY(c.cx, c.cz) + 0.0012;
      const mat = new THREE.MeshBasicMaterial({
        map: this.dustSmudgeTex,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      });
      const smudge = new THREE.Mesh(new THREE.PlaneGeometry(c.rad * 2.1, c.rad * 2.1), mat);
      smudge.rotation.x = -Math.PI / 2;
      smudge.rotation.z = r() * Math.PI * 2;
      smudge.position.set(c.cx, yPatch, c.cz);
      this.scene.add(smudge);
      const patch = { mesh: smudge, mat, cx: c.cx, cz: c.cz, rad: c.rad, pieces: [] };
      for (let i = 0; i < c.count; i++) {
        const ang = r() * Math.PI * 2;
        const dist = Math.sqrt(r()) * c.rad;
        const p = this.addPiece('sand', c.cx + Math.cos(ang) * dist, c.cz + Math.sin(ang) * dist, 'room');
        if (p) patch.pieces.push(p);
      }
      this.sandPatches.push(patch);
    }

    // 3. Torn paper scraps scattered naturally across rug & floor
    const paperClusters = [
      { cx: -0.05, cz: -0.18, rad: 0.34, count: 13 },
      { cx: 0.46, cz: -0.22, rad: 0.26, count: 10 },
      { cx: -0.38, cz: 0.26, rad: 0.24, count: 8 },
    ];
    for (const c of paperClusters) {
      for (let i = 0; i < c.count; i++) {
        const ang = r() * Math.PI * 2;
        const dist = Math.sqrt(r()) * c.rad;
        this.addPiece('paper', c.cx + Math.cos(ang) * dist, c.cz + Math.sin(ang) * dist, 'room');
      }
    }

    // 4. Hidden debris UNDER THE SOFA (revealed by vacuum LED light + 2 lost shiny brass coins!)
    const u = this.roomInfo.sofaUnderBounds;
    for (let i = 0; i < 16; i++) {
      const x = THREE.MathUtils.lerp(u.minX + 0.08, u.maxX - 0.08, r());
      const z = THREE.MathUtils.lerp(u.minZ + 0.1, u.maxZ - 0.06, r());
      this.addPiece('crumb', x, z, 'underSofa');
    }
    for (let i = 0; i < 42; i++) {
      const x = THREE.MathUtils.lerp(u.minX + 0.1, u.maxX - 0.1, r());
      const z = THREE.MathUtils.lerp(u.minZ + 0.12, u.maxZ - 0.05, r());
      this.addPiece('sand', x, z, 'underSofa');
    }
    for (let i = 0; i < 11; i++) {
      const x = THREE.MathUtils.lerp(u.minX + 0.12, u.maxX - 0.12, r());
      const z = THREE.MathUtils.lerp(u.minZ + 0.12, u.maxZ - 0.06, r());
      this.addPiece('paper', x, z, 'underSofa');
    }
    // 2 shiny lost brass coins tucked under the sofa arches!
    this.addPiece('coin', u.minX + 0.32, u.minZ + 0.36, 'underSofa');
    this.addPiece('coin', u.maxX - 0.36, u.minZ + 0.28, 'underSofa');

    // Optional prefill for representative scene screenshot evaluation of the transparent dust cup
    for (let i = 0; i < prefillCupSample; i++) {
      const kind = i % 5 === 0 ? 'paper' : i % 3 === 0 ? 'crumb' : 'sand';
      this.addPiece(kind, 0, 0, 'room', 'cup');
    }

    this.syncInstances(0, true);
  }

  /**
   * Drop fresh crumbs from the croissant on the coffee table (replayable toy mechanic!)
   */
  spawnFreshMessNearTable() {
    const r = this.rand;
    let added = 0;
    for (let i = 0; i < 12; i++) {
      const x = -0.62 + (r() - 0.5) * 0.55;
      const z = 0.08 + (r() - 0.5) * 0.45;
      if (this.addPiece('crumb', x, z, 'room')) added++;
    }
    for (let i = 0; i < 18; i++) {
      const x = 0.12 + (r() - 0.5) * 0.5;
      const z = -0.05 + (r() - 0.5) * 0.45;
      if (this.addPiece('sand', x, z, 'room')) added++;
    }
    for (let i = 0; i < 5; i++) {
      const x = -0.1 + (r() - 0.5) * 0.65;
      const z = -0.15 + (r() - 0.5) * 0.5;
      if (this.addPiece('paper', x, z, 'room')) added++;
    }
    return added;
  }

  getCupFillRatio() {
    return Math.min(1, this.cupItems.length / this.cupCapacity);
  }

  isCupFull() {
    return this.cupItems.length >= this.cupCapacity;
  }

  getRemainingCounts() {
    let room = 0;
    let underSofa = 0;
    for (const it of this.items) {
      if (it.state === 'floor' || it.state === 'sucking') {
        if (it.zone === 'underSofa') underSofa++;
        else room++;
      }
    }
    return { room, underSofa, total: room + underSofa, inCup: this.cupItems.length };
  }

  /**
   * Triggers dumping all accumulated debris from the open dust cup into the wicker wastebasket!
   */
  releaseCupIntoBin(mouthWorldPos, binPos) {
    const r = this.rand;
    const released = this.cupItems.length;
    for (const it of this.cupItems) {
      it.state = 'dumping';
      it.pos.copy(mouthWorldPos).add(
        new THREE.Vector3((r() - 0.5) * 0.055, (r() - 0.5) * 0.03, (r() - 0.5) * 0.055)
      );
      it.vel.set(
        (binPos.x - it.pos.x) * (1.2 + r() * 0.8) + (r() - 0.5) * 0.22,
        -0.35 - r() * 0.45,
        (binPos.z - it.pos.z) * (1.2 + r() * 0.8) + (r() - 0.5) * 0.22
      );
    }
    this.cupItems.length = 0;
    return released;
  }

  /**
   * Drop fresh potting soil sand near the potted plant when tapped!
   */
  spawnPlantSoilMess() {
    const r = this.rand;
    let added = 0;
    for (let i = 0; i < 14; i++) {
      const x = 0.78 + (r() - 0.5) * 0.36;
      const z = -1.06 + (r() - 0.5) * 0.34;
      if (this.addPiece('sand', x, z, 'room')) added++;
    }
    return added;
  }

  /**
   * Updates suction physics, cyclone swirl inside the transparent dust cup, full-cup puff feedback, and dumping gravity.
   * Returns { suckedCount, suckedTypes, fullBump } for responsive sound feedback!
   */
  update(dt, { sucking = false, headYaw = 0 } = {}) {
    const suckedTypes = [];
    let fullBump = false;
    this.vacuumSys.getNozzleWorldPos(this._nozzlePos);
    let inFlightCount = 0;
    for (const it of this.items) {
      if (it.state === 'sucking') inFlightCount++;
    }
    const binPos = this.roomInfo.binPos;

    // Suction radius (generous & tactile for a 5-year-old, slightly wider along head width)
    const cosY = Math.cos(-headYaw);
    const sinY = Math.sin(-headYaw);

    for (const it of this.items) {
      if (it.state === 'floor') {
        if (sucking) {
          const dx = it.pos.x - this._nozzlePos.x;
          const dz = it.pos.z - this._nozzlePos.z;
          const lx = dx * cosY - dz * sinY;
          const lz = dx * sinY + dz * cosY;

          if (Math.abs(lx) < 0.145 && lz > -0.13 && lz < 0.075) {
            const dist = Math.hypot(lx * 0.72, lz + 0.02);
            const hasRoom = this.cupItems.length + inFlightCount < this.cupCapacity;
            if (hasRoom) {
              if (dist < 0.105) {
                it.state = 'sucking';
                it.suckProgress = 0;
                it.suckStart.copy(it.pos);
                inFlightCount++;
                suckedTypes.push(it.type);
              } else {
                const pull = dt * (0.48 / Math.max(0.06, dist));
                it.pos.x -= dx * Math.min(0.45, pull);
                it.pos.z -= dz * Math.min(0.45, pull);
                it.rot.y += dt * 4.5;
              }
            } else if (dist < 0.115) {
              // Cup is FULL! Gently flutter & nudge floor crumbs slightly outward so the child feels the full cup!
              const push = dt * 0.18;
              it.pos.x += (dx / Math.max(0.03, dist)) * push;
              it.pos.z += (dz / Math.max(0.03, dist)) * push;
              it.rot.y += dt * 7.5;
              fullBump = true;
            }
          }
        }
      } else if (it.state === 'sucking') {
        it.suckProgress += dt * 7.8;
        const t = Math.min(1, it.suckProgress);
        const ease = t * t;
        it.pos.lerpVectors(it.suckStart, this._nozzlePos, ease);
        it.pos.y += Math.sin(t * Math.PI) * 0.032;
        it.rot.x += dt * 14;
        it.rot.z += dt * 11;

        if (t >= 1) {
          it.state = 'cup';
          this.cupItems.push(it);
          this._assignCupSettledZ(it, this.cupItems.length - 1);
        }
      } else if (it.state === 'cup') {
        // Real cyclonic swirling motion inside the transparent dust cup!
        const swirlMult = sucking ? 1.0 : 0.04;
        it.cupAngle += dt * it.cupSpinSpeed * swirlMult;

        if (sucking) {
          const flutter =
            it.type === 'paper'
              ? Math.sin(it.cupAngle * 1.3 + it.id) * 0.022
              : Math.sin(it.cupAngle * 0.9 + it.id) * 0.008;
          const targetZ = Math.min(0.072, it.cupSettledZ + (it.type === 'paper' ? 0.026 : 0.01) + flutter);
          it.cupZ += (targetZ - it.cupZ) * Math.min(1, dt * 3.8);
          it.rot.x += dt * 4.2;
          it.rot.y += dt * 5.8;
        } else {
          it.cupZ += (it.cupSettledZ - it.cupZ) * Math.min(1, dt * 5.5);
        }
      } else if (it.state === 'dumping') {
        it.vel.y -= 5.4 * dt; // natural gravity
        it.pos.addScaledVector(it.vel, dt);
        it.rot.x += dt * 8.5;
        it.rot.z += dt * 7.0;

        // Constrain gently within the wicker basket inner walls as it falls inside
        const floorBinY = 0.055 + (it.id % 14) * 0.0045;
        if (it.pos.y <= binPos.y + 0.02) {
          const bx = it.pos.x - binPos.x;
          const bz = it.pos.z - binPos.z;
          const br = Math.hypot(bx, bz);
          if (br > 0.095) {
            const s = 0.095 / br;
            it.pos.x = binPos.x + bx * s;
            it.pos.z = binPos.z + bz * s;
          }
        }
        if (it.pos.y <= floorBinY) {
          it.pos.y = floorBinY;
          it.state = 'binned';
        }
      }
    }

    // Fade sandy floor dust smudges cleanly as their sand grains get vacuumed up!
    for (const patch of this.sandPatches) {
      let remCount = 0;
      for (const p of patch.pieces) {
        if (p.state === 'floor') remCount++;
      }
      const targetOpacity = (remCount / Math.max(1, patch.pieces.length)) * 0.65;
      patch.mat.opacity += (targetOpacity - patch.mat.opacity) * Math.min(1, dt * 6);
      patch.mesh.visible = patch.mat.opacity > 0.015;
    }

    this.syncInstances(dt, sucking);
    return { suckedCount: suckedTypes.length, suckedTypes, fullBump };
  }

  syncInstances() {
    const dummy = this._dummy;
    const hideMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

    for (const it of this.items) {
      const wm = this.worldMeshes[it.type];
      const cm = this.cupMeshes[it.type];

      if (it.state === 'cup') {
        wm.setMatrixAt(it.typeIdx, hideMatrix);

        const cx = Math.cos(it.cupAngle) * it.cupRadius;
        const cy = Math.sin(it.cupAngle) * it.cupRadius;
        dummy.position.set(cx, cy, it.cupZ);
        dummy.rotation.copy(it.rot);
        const cupScaleBoost =
          it.type === 'paper' ? 0.72 : it.type === 'sand' ? 1.15 : it.type === 'coin' ? 0.95 : 0.94;
        dummy.scale.copy(it.scale).multiplyScalar(cupScaleBoost);
        dummy.updateMatrix();
        cm.setMatrixAt(it.typeIdx, dummy.matrix);
      } else {
        cm.setMatrixAt(it.typeIdx, hideMatrix);

        dummy.position.copy(it.pos);
        dummy.rotation.copy(it.rot);
        const sMult = it.state === 'sucking' ? Math.max(0.3, 1 - it.suckProgress * 0.55) : 1.0;
        dummy.scale.copy(it.scale).multiplyScalar(sMult);
        dummy.updateMatrix();
        wm.setMatrixAt(it.typeIdx, dummy.matrix);
      }
    }

    for (const type of ['crumb', 'sand', 'paper', 'coin']) {
      this.worldMeshes[type].instanceMatrix.needsUpdate = true;
      this.cupMeshes[type].instanceMatrix.needsUpdate = true;
    }
  }
}
