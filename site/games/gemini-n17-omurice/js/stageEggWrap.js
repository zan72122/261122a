import * as THREE from '../vendor/three/three.module.min.js';
import { createClayMaterial, createGlossyClayMaterial } from './clayMaterial.js';
import { sculptClay, makeClayBlob, makeClayPuck } from './clayGeo.js';
import { audio } from './audio.js';

export class StageEggWrap {
  constructor(scene, diorama, recipeState, onComplete) {
    this.scene = scene;
    this.diorama = diorama;
    this.recipe = recipeState;
    this.onComplete = onComplete;

    this.group = new THREE.Group();
    scene.add(this.group);

    this.active = false;
    // 'crack' -> 'whisk' -> 'placeRice' -> 'wrap' -> 'readyFlip' -> 'flipping' -> 'done'
    this.phase = 'crack';
    this.idleTimer = 0;

    // Egg carton & 3 crackable clay eggs
    this.eggTrayGroup = null;
    this.eggs = [];
    this.crackedCount = 0;
    this.crackingAnims = [];

    // Raw egg blobs in pan before fully whisked
    this.rawYolks = [];
    this.rawWhites = [];

    // Deformable golden clay egg sheet mesh (used for cooking + real 3D wrapping!)
    this.eggSheetMesh = null;
    this.eggSheetGeo = null;
    this.eggSheetBasePts = [];
    this.eggSpread = 0;
    this.eggCook = 0;
    this.frontFold = 0;
    this.backFold = 0;
    this.frontFlapHit = null;
    this.backFlapHit = null;

    // Whisking chopsticks + ceramic clay chopstick rest (no floating props!)
    this.chopsticks = null;
    this.chopstickRest = null;
    this.chopsticksHome = new THREE.Vector3(2.42, 0.22, -1.66);
    this.chopsticksTarget = new THREE.Vector3(0, 1.0, 0);
    this.isWhisking = false;
    this.prevWhiskPos = new THREE.Vector3();

    // Waiting ketchup rice bowl (carried over from Stage 1!)
    this.riceBowlGroup = null;
    this.riceBowlPos = new THREE.Vector3(2.56, 0.02, -0.62);
    this.riceMoundMesh = null;
    this.riceMoundBase = new THREE.Vector3(2.56, 0.42, -0.62);
    this.riceInPan = false;
    this.riceDropT = 0;
    this.isDraggingRice = false;

    // Active wrap drag state
    this.activeFoldFlap = null;
    this.foldStartZ = 0;
    this.foldStartVal = 0;

    // Flip animation state
    this.flipGroup = new THREE.Group();
    this.group.add(this.flipGroup);
    this.flipT = 0;

    this._buildEggTray();
    this._buildChopsticks();
    this._buildRiceBowl();
    this._buildDeformableEggSheet();

    this.group.visible = false;
  }

  _buildEggTray() {
    this.eggTrayGroup = new THREE.Group();
    this.eggTrayGroup.position.set(-2.55, 0.02, 0.08);
    this.group.add(this.eggTrayGroup);

    const trayMat = createClayMaterial('#d99b66', { normalStrength: 0.95, roughness: 0.85 });
    const trayGeo = new THREE.BoxGeometry(1.06, 0.24, 1.98, 8, 4, 12);
    sculptClay(trayGeo, { amp: 0.032, freq: 2.5, seed: 31.1, thumbDents: 3 });
    const tray = new THREE.Mesh(trayGeo, trayMat);
    tray.position.y = 0.12;
    tray.castShadow = true;
    tray.receiveShadow = true;
    this.eggTrayGroup.add(tray);

    const positions = [
      new THREE.Vector3(-0.07, 0.54, -0.6),
      new THREE.Vector3(0.07, 0.54, 0.02),
      new THREE.Vector3(-0.06, 0.54, 0.62),
    ];
    const colors = ['#f5e3cc', '#f2dec3', '#ebd0ae'];

    positions.forEach((pos, idx) => {
      const g = new THREE.Group();
      const eggGeo = new THREE.SphereGeometry(0.31, 16, 12);
      const p = eggGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i);
        let y = p.getY(i) * 1.28;
        let z = p.getZ(i);
        const t = (y + 0.4) / 0.8;
        const pinch = 1.0 - Math.max(0, t - 0.45) * 0.34;
        x *= pinch;
        z *= pinch;
        p.setXYZ(i, x, y, z);
      }
      p.needsUpdate = true;
      sculptClay(eggGeo, { amp: 0.028, freq: 3.5, seed: 35 + idx, thumbDents: 2 });

      const mesh = new THREE.Mesh(
        eggGeo,
        createClayMaterial(colors[idx], { normalStrength: 0.9, roughness: 0.78 })
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 8, 6),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.userData = { interact: 'clayEgg', eggIdx: idx };
      g.add(hit);

      g.position.copy(pos);
      g.rotation.z = (idx - 1) * 0.12;
      this.eggTrayGroup.add(g);

      this.eggs.push({
        group: g,
        home: pos.clone(),
        cracked: false,
        color: colors[idx],
      });
    });
  }

  _buildChopsticks() {
    // Little ceramic clay chopstick rest (hashioki) on the back-right counter
    const rest = new THREE.Mesh(
      makeClayBlob(0.16, 10, 8, { amp: 0.06, seed: 43, scaleX: 1.5, scaleY: 0.65, scaleZ: 0.85 }),
      createGlossyClayMaterial('#e3785a', { roughness: 0.4, normalStrength: 0.65 })
    );
    rest.position.set(2.38, 0.09, -1.66);
    rest.castShadow = true;
    this.chopstickRest = rest;
    this.group.add(rest);

    const g = new THREE.Group();
    const woodMat = createClayMaterial('#c78b52', { normalStrength: 0.95, roughness: 0.8 });
    for (let i = 0; i < 2; i++) {
      const stickGeo = new THREE.CylinderGeometry(0.03, 0.058, 1.85, 10, 5);
      sculptClay(stickGeo, { amp: 0.032, freq: 4, seed: 44 + i, thumbDents: 1 });
      const stick = new THREE.Mesh(stickGeo, woodMat);
      stick.position.set(i === 0 ? -0.065 : 0.065, 0.75, 0);
      stick.rotation.z = i === 0 ? 0.055 : -0.055;
      stick.castShadow = true;
      g.add(stick);
    }
    g.position.copy(this.chopsticksHome);
    g.rotation.set(0.05, 0.18, -1.42); // Resting horizontally on the clay chopstick rest!
    this.chopsticks = g;
    this.group.add(g);
  }

  _buildRiceBowl() {
    this.riceBowlGroup = new THREE.Group();
    this.riceBowlGroup.position.copy(this.riceBowlPos);
    this.group.add(this.riceBowlGroup);

    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.48, 0.0),
      new THREE.Vector2(0.72, 0.16),
      new THREE.Vector2(0.88, 0.56),
      new THREE.Vector2(0.83, 0.59),
      new THREE.Vector2(0.78, 0.51),
      new THREE.Vector2(0.64, 0.13),
      new THREE.Vector2(0.0, 0.07),
    ];
    const geo = new THREE.LatheGeometry(pts, 24);
    sculptClay(geo, { amp: 0.022, freq: 2.6, seed: 41.2, thumbDents: 3 });
    const bowlMat = createGlossyClayMaterial('#84b8c7', { roughness: 0.42, normalStrength: 0.65 });
    const mesh = new THREE.Mesh(geo, bowlMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { interact: 'ketchupRiceMound' };
    this.riceBowlGroup.add(mesh);

    // Textured hand-sculpted oval ketchup rice mound with bumpy rice grain lumps + peas + chicken!
    const moundGroup = new THREE.Group();
    const moundGeo = makeClayBlob(0.68, 20, 14, {
      amp: 0.11,
      freq: 5.5,
      seed: 42.1,
      scaleX: 1.24,
      scaleY: 0.56,
      scaleZ: 0.72,
    });
    const riceMat = createClayMaterial('#e84e24', { normalStrength: 1.0, roughness: 0.84 });
    const moundMesh = new THREE.Mesh(moundGeo, riceMat);
    moundMesh.castShadow = true;
    moundMesh.receiveShadow = true;
    moundGroup.add(moundMesh);

    // Add 14 bumpy clay rice clusters on the mound surface so it visually matches Stage 1's stir-fried rice!
    const grainGeo = makeClayBlob(0.11, 7, 6, { amp: 0.12, seed: 47, scaleX: 1.3, scaleY: 0.75 });
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt((i + 0.5) / 14) * 0.56;
      const bump = new THREE.Mesh(grainGeo, riceMat);
      bump.position.set(Math.cos(a) * r * 1.25, 0.22 + (1 - r) * 0.14, Math.sin(a) * r * 0.7);
      bump.rotation.set(i * 0.4, i * 1.1, i * 0.3);
      moundGroup.add(bump);
    }

    // Little clay peas, orange carrots & chicken pieces embedded on top
    const peaMat = createClayMaterial('#5aa848', { normalStrength: 0.85 });
    const chMat = createClayMaterial('#c77a46', { normalStrength: 0.85 });
    const carMat = createClayMaterial('#f28230', { normalStrength: 0.85 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const r = 0.22 + (i % 3) * 0.17;
      const m = i % 3 === 0 ? peaMat : i % 3 === 1 ? chMat : carMat;
      const bit = new THREE.Mesh(
        makeClayBlob(i % 3 === 0 ? 0.068 : 0.082, 8, 6, { amp: 0.08, seed: 50 + i }),
        m
      );
      bit.position.set(Math.cos(a) * r * 1.12, 0.26 + (1 - r) * 0.13, Math.sin(a) * r * 0.62);
      moundGroup.add(bit);
    }

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(1.12, 10, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.userData = { interact: 'ketchupRiceMound' };
    moundGroup.add(hit);

    moundGroup.position.copy(this.riceMoundBase);
    this.riceMoundMesh = moundGroup;
    this.riceMoundMat = riceMat;
    this.group.add(moundGroup);
  }

  _buildDeformableEggSheet() {
    // Subdivided disk with gentle thickness profile for realistic 3D clay omelette folding!
    const segs = 24;
    const geo = new THREE.PlaneGeometry(2.36, 2.36, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    this.eggSheetBasePts = [];
    for (let i = 0; i < pos.count; i++) {
      const sx = pos.getX(i) / 1.18;
      const sz = pos.getZ(i) / 1.18;
      const cx = sx * Math.sqrt(Math.max(0, 1 - (sz * sz) * 0.5));
      const cz = sz * Math.sqrt(Math.max(0, 1 - (sx * sx) * 0.5));
      const rx = cx * 1.24;
      const rz = cz * 1.22;
      const radial = Math.min(1, Math.hypot(cx, cz));
      // Soft pillowy rolled clay rim curvature (slightly domed center, rounded outer lip)
      const rimRoll = Math.sin(radial * Math.PI) * 0.032;
      const lump =
        Math.sin(rx * 3.6 + 1.2) * Math.cos(rz * 3.4 - 0.7) * 0.022 +
        Math.sin((rx + rz) * 6.0) * 0.009;
      this.eggSheetBasePts.push({ rx, rz, lump, rimRoll });
      pos.setXYZ(i, rx, 0.05 + lump + rimRoll, rz);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    this.eggSheetGeo = geo;
    const eggMat = createClayMaterial('#f7ca3e', {
      normalStrength: 0.95,
      roughness: 0.72,
      side: THREE.DoubleSide,
    });
    this.eggSheetMesh = new THREE.Mesh(geo, eggMat);
    this.eggSheetMesh.castShadow = true;
    this.eggSheetMesh.receiveShadow = true;
    this.eggSheetMesh.visible = false;
    this.flipGroup.add(this.eggSheetMesh);

    this.frontFlapHit = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.85, 1.35),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.frontFlapHit.position.set(0, 0.32, 0.76);
    this.frontFlapHit.userData = { interact: 'frontEggFlap' };
    this.frontFlapHit.visible = false;
    this.flipGroup.add(this.frontFlapHit);

    this.backFlapHit = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.85, 1.35),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.backFlapHit.position.set(0, 0.32, -0.76);
    this.backFlapHit.userData = { interact: 'backEggFlap' };
    this.backFlapHit.visible = false;
    this.flipGroup.add(this.backFlapHit);
  }

  _clearRawEggs() {
    this.rawYolks.forEach((m) => this.group.remove(m));
    this.rawWhites.forEach((m) => this.group.remove(m));
    this.rawYolks.length = 0;
    this.rawWhites.length = 0;
    this.crackingAnims.forEach((a) => this.group.remove(a.group));
    this.crackingAnims.length = 0;
  }

  enter() {
    this.active = true;
    this.group.visible = true;
    this.phase = 'crack';
    this.idleTimer = 0;
    this.crackedCount = 0;
    this.eggSpread = 0;
    this.eggCook = 0;
    this.frontFold = 0;
    this.backFold = 0;
    this.isWhisking = false;
    this.isDraggingRice = false;
    this.activeFoldFlap = null;
    this.riceInPan = false;
    this.riceDropT = 0;
    this.flipT = 0;

    this._clearRawEggs();

    this.eggs.forEach((e) => {
      e.cracked = false;
      e.group.visible = true;
      e.group.position.copy(e.home);
      e.group.scale.setScalar(1);
    });
    this.eggTrayGroup.visible = true;

    const riceCol = new THREE.Color(this.recipe.riceColorHex || '#e84e24');
    this.riceMoundMat.color.copy(riceCol);
    this.riceMoundMesh.visible = true;
    this.riceMoundMesh.position.copy(this.riceMoundBase);
    this.riceMoundMesh.rotation.set(0, 0, 0);
    this.riceMoundMesh.scale.setScalar(1);
    this.riceBowlGroup.visible = true;
    this.riceBowlGroup.position.copy(this.riceBowlPos);
    this.group.add(this.riceMoundMesh);

    const pan = this.diorama.panBasePos;
    this.flipGroup.position.set(pan.x, pan.y + 0.08, pan.z);
    this.flipGroup.rotation.set(0, 0, 0);
    this.flipGroup.scale.setScalar(1);

    this.eggSheetMesh.visible = false;
    this.frontFlapHit.visible = false;
    this.backFlapHit.visible = false;
    this.chopsticks.visible = true;
    this.chopstickRest.visible = true;
    this.chopsticks.position.copy(this.chopsticksHome);
    this.chopsticks.rotation.set(0.05, 0.18, -1.42);

    this.diorama.setFlameOn(true);
    this.diorama.steamRate = 0.35;
  }

  exit() {
    this.active = false;
    this.group.visible = false;
    this.isWhisking = false;
    this.isDraggingRice = false;
    this.activeFoldFlap = null;
    audio.setSizzle(0);
    this.diorama.steamRate = 0;
  }

  crackEgg(idx) {
    const egg = this.eggs[idx];
    if (!egg || egg.cracked) return;
    if (this.phase !== 'crack' && this.phase !== 'whisk') return;

    this.idleTimer = 0;
    egg.cracked = true;
    egg.group.visible = false;
    this.crackedCount++;
    this.recipe.eggCount = this.crackedCount;

    audio.playEggCrack();
    this.diorama.jigglePan(0.45);

    const pan = this.diorama.panBasePos;
    const ox = (this.crackedCount - 2) * 0.32 + (Math.random() - 0.5) * 0.2;
    const oz = (Math.random() - 0.5) * 0.35;

    const shellGroup = new THREE.Group();
    shellGroup.position.set(pan.x + ox, pan.y + 1.15, pan.z + oz);
    const shellMat = createClayMaterial(egg.color, { normalStrength: 0.85, side: THREE.DoubleSide });
    const halfGeoL = new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const halfL = new THREE.Mesh(halfGeoL, shellMat);
    halfL.rotation.z = Math.PI * 0.45;
    const halfR = new THREE.Mesh(halfGeoL, shellMat);
    halfR.rotation.z = -Math.PI * 0.45;
    shellGroup.add(halfL, halfR);
    this.group.add(shellGroup);
    this.crackingAnims.push({ group: shellGroup, halfL, halfR, age: 0 });

    const whiteMat = createGlossyClayMaterial('#f7f2e4', {
      roughness: 0.32,
      normalStrength: 0.5,
      transparent: true,
      opacity: 0.92,
    });
    const white = new THREE.Mesh(
      makeClayPuck(0.5, 0.08, 0.03, 18, { amp: 0.14, seed: 60 + idx }),
      whiteMat
    );
    white.position.set(pan.x + ox, pan.y + 0.12 + this.crackedCount * 0.015, pan.z + oz);
    white.scale.set(0.2, 0.2, 0.2);
    white.userData.targetScale = 1.0 + Math.random() * 0.15;
    this.group.add(white);
    this.rawWhites.push(white);

    const yolkMat = createGlossyClayMaterial('#f7a91e', { roughness: 0.28, normalStrength: 0.55 });
    const yolk = new THREE.Mesh(
      makeClayBlob(0.23, 14, 10, { amp: 0.06, seed: 65 + idx, scaleY: 0.65 }),
      yolkMat
    );
    yolk.position.set(pan.x + ox, pan.y + 0.22, pan.z + oz);
    yolk.castShadow = true;
    yolk.userData.targetScale = 1.0;
    this.group.add(yolk);
    this.rawYolks.push(yolk);

    if (this.phase === 'crack') {
      this.phase = 'whisk';
      this.eggSheetMesh.visible = true;
    }
  }

  _advanceWhisk(amount) {
    const pan = this.diorama.panBasePos;
    const heatMult = [0.75, 1.0, 1.4][this.diorama.flameLevel - 1];
    this.eggSpread = Math.min(1, this.eggSpread + amount * 0.28);
    this.eggCook = Math.min(1, this.eggCook + amount * 0.18 * heatMult);

    this.rawYolks.forEach((y, idx) => {
      const s = Math.max(0.01, 1 - this.eggSpread * 1.25);
      y.scale.set(s * 1.4, s * 0.5, s * 1.4);
      const a = idx * 2.1 + this.eggSpread * 5.0;
      y.position.x = pan.x + Math.cos(a) * 0.35 * (1 - this.eggSpread * 0.5);
      y.position.z = pan.z + Math.sin(a) * 0.35 * (1 - this.eggSpread * 0.5);
      if (s <= 0.04) y.visible = false;
    });
    this.rawWhites.forEach((w) => {
      const s = Math.max(0.01, 1 - this.eggSpread * 1.1);
      w.scale.set(s * 1.4, 1, s * 1.4);
      if (s <= 0.05) w.visible = false;
    });

    if (this.eggCook >= 1.0 && this.eggSpread >= 0.95) {
      this.phase = 'placeRice';
      this.isWhisking = false;
      this.chopsticks.visible = false;
      this.chopstickRest.visible = false;
      audio.playStageDone();
    }
  }

  _updateEggSheetGeometry(elapsed, stopMotionStep) {
    const pos = this.eggSheetGeo.attributes.position;
    const spread = Math.max(0.08, this.eggSpread);
    const puff = 1.0 + (this.crackedCount - 1) * 0.12;
    const fFold = this.frontFold;
    const bFold = this.backFold;

    const frontInvite =
      this.phase === 'wrap' && fFold < 0.85
        ? (Math.sin(stopMotionStep * 0.65) * 0.5 + 0.5) * 0.14
        : 0;
    const backInvite =
      this.phase === 'wrap' && bFold < 0.85
        ? (Math.sin(stopMotionStep * 0.65 + 2.0) * 0.5 + 0.5) * 0.14
        : 0;

    for (let i = 0; i < pos.count; i++) {
      const b = this.eggSheetBasePts[i];
      let x = b.rx * spread;
      let z = b.rz * spread;
      const bubble =
        this.eggCook > 0.25
          ? Math.sin(x * 4.5 + z * 3.2) * 0.028 * this.eggCook * puff
          : 0;
      let y = 0.045 + (b.lump + b.rimRoll) * spread + bubble;

      // Real 3D clay blanket wrapping cleanly UP & OVER the plump oval ketchup rice dome!
      const hingeZ = 0.28;
      const endTaper = Math.max(0.28, 1.0 - Math.pow(Math.abs(x) / 1.26, 2) * 0.62);
      const domeRadiusZ = 0.56 * endTaper;
      const domeHeight = 0.68 * endTaper;

      if (z > hingeZ && (fFold > 0.001 || frontInvite > 0.001)) {
        const effFold = Math.min(1, fFold + frontInvite * (1 - fFold));
        const maxExcess = Math.max(0.15, 1.22 * spread - hingeZ);
        const u = Math.min(1, (z - hingeZ) / maxExcess); // 0 at side -> 1 at flap tip
        // Target folded position hugs the outer side & curves smoothly over the top crown past center!
        const arcAngle = u * Math.PI * 0.62; // 0 = side equator, PI/2 = crown, 0.62*PI = slightly tucked past seam
        const foldedZ = Math.cos(arcAngle) * domeRadiusZ;
        const foldedY = 0.16 + Math.sin(arcAngle) * domeHeight;
        // Blend smoothly with slight upward lift mid-fold so the blanket never cuts through the rice!
        const lift = Math.sin(effFold * Math.PI) * 0.16 * u * endTaper;
        z = THREE.MathUtils.lerp(z, foldedZ, effFold);
        y = THREE.MathUtils.lerp(y, foldedY, effFold) + lift;
        x *= 1.0 - effFold * 0.06 * u;
      } else if (z < -hingeZ && (bFold > 0.001 || backInvite > 0.001)) {
        const effFold = Math.min(1, bFold + backInvite * (1 - bFold));
        const maxExcess = Math.max(0.15, 1.22 * spread - hingeZ);
        const u = Math.min(1, (-z - hingeZ) / maxExcess);
        const arcAngle = u * Math.PI * 0.64;
        const foldedZ = -Math.cos(arcAngle) * domeRadiusZ;
        // Slightly taller (+0.03) so the back flap overlaps cozily over the front seam!
        const foldedY = 0.18 + Math.sin(arcAngle) * (domeHeight + 0.03);
        const lift = Math.sin(effFold * Math.PI) * 0.18 * u * endTaper;
        z = THREE.MathUtils.lerp(z, foldedZ, effFold);
        y = THREE.MathUtils.lerp(y, foldedY, effFold) + lift;
        x *= 1.0 - effFold * 0.06 * u;
      }

      pos.setXYZ(i, x, y, z);
    }

    // Gently tuck the inner rice mound as both flaps close so it nests snugly inside the golden clay omelette!
    if (this.riceInPan && (this.phase === 'wrap' || this.phase === 'readyFlip')) {
      const wrapAmt = Math.min(1, (fFold + bFold) * 0.5);
      this.riceMoundMesh.scale.set(
        1.0 - wrapAmt * 0.14,
        1.0 - wrapAmt * 0.24,
        1.0 - wrapAmt * 0.18
      );
      this.riceMoundMesh.position.y = 0.24 - wrapAmt * 0.05;
    }

    pos.needsUpdate = true;
    this.eggSheetGeo.computeVertexNormals();
  }

  placeRiceInPan() {
    if (this.phase !== 'placeRice' || this.riceInPan) return;
    this.idleTimer = 0;
    this.riceInPan = true;
    this.isDraggingRice = false;
    this.riceDropT = 0;
    audio.playPop(1.05);
  }

  _checkWrapComplete() {
    if (this.phase === 'wrap' && this.frontFold >= 0.9 && this.backFold >= 0.9) {
      this.frontFold = 1;
      this.backFold = 1;
      this.phase = 'readyFlip';
      this.activeFoldFlap = null;
      audio.playStageDone();
      audio.playClaySquish(1.15);
      this.diorama.jigglePan(0.6);
    }
  }

  triggerFlip() {
    if (this.phase !== 'readyFlip') return;
    this.phase = 'flipping';
    this.flipT = 0;
    this.diorama.jigglePan(1.2);
    audio.playFlipWhoosh();
  }

  onPointerDown(hit, worldOnPanPlane) {
    if (!this.active || this.phase === 'flipping' || this.phase === 'done') return false;
    this.idleTimer = 0;

    if (hit) {
      const kind = hit.object.userData?.interact;
      if (kind === 'stoveKnob') {
        const lvl = this.diorama.cycleFlameLevel();
        audio.playStoveClick(lvl);
        this.diorama.jigglePan(0.25);
        return true;
      }
      if (kind === 'clayEgg') {
        this.crackEgg(hit.object.userData.eggIdx);
        return true;
      }
      if (kind === 'ketchupRiceMound' && this.phase === 'placeRice') {
        this.isDraggingRice = true;
        audio.playClaySquish(1.1);
        return true;
      }
      if (this.phase === 'wrap') {
        if (kind === 'frontEggFlap' && this.frontFold < 0.95) {
          this.activeFoldFlap = 'front';
          this.foldStartZ = worldOnPanPlane ? worldOnPanPlane.z : 0.7;
          this.foldStartVal = this.frontFold;
          this.frontFold = Math.min(1, this.frontFold + 0.5);
          audio.playClaySquish(0.95);
          this._checkWrapComplete();
          return true;
        }
        if (kind === 'backEggFlap' && this.backFold < 0.95) {
          this.activeFoldFlap = 'back';
          this.foldStartZ = worldOnPanPlane ? worldOnPanPlane.z : -0.7;
          this.foldStartVal = this.backFold;
          this.backFold = Math.min(1, this.backFold + 0.5);
          audio.playClaySquish(1.05);
          this._checkWrapComplete();
          return true;
        }
      }
      if (this.phase === 'readyFlip' && (kind === 'pan' || kind === 'panHandle' || kind === 'frontEggFlap' || kind === 'backEggFlap' || kind === 'ketchupRiceMound')) {
        this.triggerFlip();
        return true;
      }
    }

    if (worldOnPanPlane) {
      const pan = this.diorama.panBasePos;
      const distPan = Math.hypot(worldOnPanPlane.x - pan.x, worldOnPanPlane.z - pan.z);

      if (this.phase === 'readyFlip' && distPan < 2.4) {
        this.triggerFlip();
        return true;
      }

      if (this.phase === 'wrap' && distPan < 1.85) {
        const relZ = worldOnPanPlane.z - pan.z;
        if (relZ >= 0 && this.frontFold < 0.95) {
          this.activeFoldFlap = 'front';
          this.foldStartZ = worldOnPanPlane.z;
          this.foldStartVal = this.frontFold;
          this.frontFold = Math.min(1, this.frontFold + 0.5);
          audio.playClaySquish(0.95);
          this._checkWrapComplete();
          return true;
        } else if (relZ < 0 && this.backFold < 0.95) {
          this.activeFoldFlap = 'back';
          this.foldStartZ = worldOnPanPlane.z;
          this.foldStartVal = this.backFold;
          this.backFold = Math.min(1, this.backFold + 0.5);
          audio.playClaySquish(1.05);
          this._checkWrapComplete();
          return true;
        } else if (this.frontFold < 0.95) {
          this.frontFold = Math.min(1, this.frontFold + 0.55);
          audio.playClaySquish(0.95);
          this._checkWrapComplete();
          return true;
        } else if (this.backFold < 0.95) {
          this.backFold = Math.min(1, this.backFold + 0.55);
          audio.playClaySquish(1.05);
          this._checkWrapComplete();
          return true;
        }
      }

      if (this.phase === 'whisk' && distPan < 1.65) {
        this.isWhisking = true;
        this.chopsticksTarget.set(worldOnPanPlane.x, pan.y + 0.28, worldOnPanPlane.z);
        this.prevWhiskPos.copy(this.chopsticksTarget);
        this._advanceWhisk(0.45); // Tap-friendly whisk swirl pulse!
        audio.playSpatulaStir();
        return true;
      }
    }

    return false;
  }

  onPointerMove(worldOnPanPlane) {
    if (!this.active || !worldOnPanPlane) return;
    this.idleTimer = 0;
    const pan = this.diorama.panBasePos;

    if (this.phase === 'whisk' && this.isWhisking) {
      const dx = worldOnPanPlane.x - pan.x;
      const dz = worldOnPanPlane.z - pan.z;
      const d = Math.hypot(dx, dz);
      const maxR = 1.0;
      const cx = d > maxR ? pan.x + (dx / d) * maxR : worldOnPanPlane.x;
      const cz = d > maxR ? pan.z + (dz / d) * maxR : worldOnPanPlane.z;
      this.chopsticksTarget.set(cx, pan.y + 0.25, cz);

      const moveDist = Math.hypot(cx - this.prevWhiskPos.x, cz - this.prevWhiskPos.z);
      if (moveDist > 0.025) {
        this._advanceWhisk(moveDist);
        audio.playSpatulaStir();
        this.prevWhiskPos.set(cx, pan.y + 0.25, cz);
      }
      return;
    }

    if (this.phase === 'placeRice' && this.isDraggingRice) {
      this.riceMoundMesh.position.set(worldOnPanPlane.x, pan.y + 0.65, worldOnPanPlane.z);
      const distToPan = Math.hypot(worldOnPanPlane.x - pan.x, worldOnPanPlane.z - pan.z);
      if (distToPan < 1.15) {
        this.placeRiceInPan();
      }
      return;
    }

    if (this.phase === 'wrap' && this.activeFoldFlap) {
      const dz = worldOnPanPlane.z - this.foldStartZ;
      if (this.activeFoldFlap === 'front') {
        const delta = Math.max(0, -dz) / 0.8;
        this.frontFold = Math.min(1, Math.max(this.frontFold, this.foldStartVal + delta));
      } else if (this.activeFoldFlap === 'back') {
        const delta = Math.max(0, dz) / 0.8;
        this.backFold = Math.min(1, Math.max(this.backFold, this.foldStartVal + delta));
      }
      this._checkWrapComplete();
    }
  }

  onPointerUp() {
    this.isWhisking = false;
    if (this.phase === 'placeRice' && this.isDraggingRice) {
      this.placeRiceInPan();
    }
    this.isDraggingRice = false;
    this.activeFoldFlap = null;
  }

  update(dt, elapsed, stopMotionStep) {
    if (!this.active) return;
    this.idleTimer += dt;

    const pan = this.diorama.panBasePos;
    const baseSizzle = [0.18, 0.36, 0.6][this.diorama.flameLevel - 1];
    audio.setSizzle(
      this.phase === 'whisk' || this.phase === 'placeRice' || this.phase === 'wrap'
        ? baseSizzle + (this.isWhisking ? 0.25 : 0)
        : 0.1
    );
    this.diorama.steamRate = this.phase === 'whisk' ? 0.75 : this.phase === 'wrap' ? 0.4 : 0.18;

    for (let i = this.crackingAnims.length - 1; i >= 0; i--) {
      const a = this.crackingAnims[i];
      a.age += dt;
      const t = a.age / 0.55;
      a.halfL.position.x = -t * 0.65;
      a.halfR.position.x = t * 0.65;
      a.halfL.rotation.z = Math.PI * 0.45 + t * 1.4;
      a.halfR.rotation.z = -Math.PI * 0.45 - t * 1.4;
      a.group.position.y += dt * (0.4 - t * 1.8);
      const sc = Math.max(0.01, 1 - Math.max(0, t - 0.5) * 2);
      a.group.scale.setScalar(sc);
      if (t >= 1) {
        this.group.remove(a.group);
        this.crackingAnims.splice(i, 1);
      }
    }

    this.rawWhites.forEach((w) => {
      if (w.visible && this.eggSpread < 0.2) {
        const s = THREE.MathUtils.lerp(w.scale.x, w.userData.targetScale, dt * 10);
        w.scale.set(s, 1, s);
      }
    });

    this.eggs.forEach((e, idx) => {
      if (e.cracked) return;
      let hop = 0;
      if (this.phase === 'crack' && this.idleTimer > 7.0) {
        hop = Math.max(0, Math.sin((this.idleTimer - 7.0) * 5.2 + idx * 1.1)) * 0.14;
      }
      e.group.position.y = e.home.y + hop;
    });

    if (this.chopsticks.visible) {
      if (this.isWhisking) {
        this.chopsticks.position.lerp(this.chopsticksTarget, Math.min(1, dt * 20));
        this.chopsticks.rotation.set(0.25, -0.3 + Math.sin(elapsed * 18) * 0.15, -0.15);
      } else {
        let wob = 0;
        if (this.phase === 'whisk' && this.idleTimer > 7.0) {
          wob = Math.sin((this.idleTimer - 7.0) * 6) * 0.16;
        }
        const rest = this.chopsticksHome.clone();
        rest.y += Math.abs(wob) * 0.25;
        this.chopsticks.position.lerp(rest, Math.min(1, dt * 8));
        this.chopsticks.rotation.set(0.05, 0.18, -1.42 + wob);
      }
    }

    if (this.eggSheetMesh.visible) {
      const rawEggCol = new THREE.Color('#fce27c');
      const cookedEggCol = new THREE.Color('#f5be2c');
      this.eggSheetMesh.material.color.copy(rawEggCol).lerp(cookedEggCol, this.eggCook);
      this._updateEggSheetGeometry(elapsed, stopMotionStep);
    }

    if (this.phase === 'placeRice' && !this.riceInPan && !this.isDraggingRice) {
      const b = Math.max(0, Math.sin(stopMotionStep * 0.6)) * 0.08;
      this.riceMoundMesh.position.set(this.riceMoundBase.x, this.riceMoundBase.y + b, this.riceMoundBase.z);
    }

    if (this.riceInPan && this.phase === 'placeRice') {
      this.riceDropT = Math.min(1, this.riceDropT + dt * 2.1);
      const t = this.riceDropT;
      const dest = new THREE.Vector3(pan.x, pan.y + 0.32, pan.z);
      this.riceMoundMesh.position.lerpVectors(this.riceMoundBase, dest, t);
      this.riceMoundMesh.position.y += Math.sin(t * Math.PI) * 1.15;
      if (t >= 1) {
        this.flipGroup.add(this.riceMoundMesh);
        this.riceMoundMesh.position.set(0, 0.24, 0);
        this.riceBowlGroup.visible = false;
        this.eggTrayGroup.visible = false;
        this.phase = 'wrap';
        this.frontFlapHit.visible = true;
        this.backFlapHit.visible = true;
        audio.playClaySquish(1.0);
        this.diorama.jigglePan(0.45);
      }
    }

    if (this.phase === 'readyFlip') {
      const b = Math.sin(stopMotionStep * 0.7) * 0.05;
      this.flipGroup.position.y = pan.y + 0.08 + Math.max(0, b);
      this.flipGroup.scale.set(1 + b * 0.5, 1 - b * 0.5, 1 + b * 0.5);
    }

    if (this.phase === 'flipping') {
      this.flipT += dt * 1.15;
      const t = Math.min(1, this.flipT);
      const qt = Math.floor(t * 16) / 16;
      this.flipGroup.position.set(
        pan.x + qt * 3.8,
        pan.y + 0.08 + Math.sin(qt * Math.PI) * 3.1,
        pan.z
      );
      this.flipGroup.rotation.x = qt * Math.PI;
      this.flipGroup.rotation.z = -qt * 0.35;
      this.flipGroup.scale.setScalar(1.0);

      if (t >= 1) {
        this.phase = 'done';
        audio.playClaySquish(0.95);
        if (this.onComplete) this.onComplete();
      }
    }
  }
}
