import * as THREE from '../vendor/three/three.module.min.js';
import { createClayMaterial, createGlossyClayMaterial } from './clayMaterial.js';
import { sculptClay, makeClayBlob, makeClayPuck, makeClaySqueezeBottle } from './clayGeo.js';
import { audio } from './audio.js';

export class StageRice {
  constructor(scene, diorama, recipeState, onComplete) {
    this.scene = scene;
    this.diorama = diorama;
    this.recipe = recipeState;
    this.onComplete = onComplete;

    this.group = new THREE.Group();
    scene.add(this.group);

    this.active = false;
    this.phase = 'cooking'; // 'cooking' | 'ready' | 'transferring' | 'done'
    this.transferT = 0;

    this.ketchupCount = 0;
    this.cookProgress = 0;
    this.idleTimer = 0;

    // Instanced clay rice grains + underlying sculpted clay rice bed mound (huge draw-call savings!)
    this.riceCount = 76;
    this.riceInstanced = null;
    this.riceGrains = [];
    this.riceBedMesh = null;
    this.dummy = new THREE.Object3D();

    this.mixIns = []; // chicken, carrot, peas, bonus corn/wiener
    this.ketchupGlobs = [];
    this.flyingProps = [];
    this.butterPuddle = null;
    this.butterMelt = 0;
    this.hasButter = false;

    // Interactive objects (cleanly spaced with zero overlap!)
    this.ketchupBottle = null;
    this.ketchupHome = new THREE.Vector3(-2.52, 0.02, 0.65);
    this.ketchupAnim = 0;
    this.ketchupSquirtPos = new THREE.Vector3();

    this.spatula = null;
    this.spatulaHome = new THREE.Vector3(2.26, 0.16, -0.88);
    this.spatulaTarget = new THREE.Vector3(0, 1.05, 0);
    this.isStirring = false;
    this.prevStirPos = new THREE.Vector3();
    this.stirSpeed = 0;

    // Prep dish with butter & bonus mix-ins
    this.prepGroup = null;
    this.butterProp = null;
    this.bonusProps = [];

    // Waiting bowl that slides in when rice is ready
    this.bowlGroup = null;
    this.bowlPosReady = new THREE.Vector3(2.56, 0.02, -0.62);
    this.bowlPosHidden = new THREE.Vector3(5.2, 0.02, -0.62);
    this.bowlSlide = 0;
    this.transferredMound = null;

    // Shared colors for lerping
    this.whiteRiceColor = new THREE.Color('#f7f1e6');
    this.rawChickenColor = new THREE.Color('#f0c8b6');
    this.cookedChickenColor = new THREE.Color('#c97a46');
    this.toastTintColor = new THREE.Color('#9e421c');
    this._tmpColor = new THREE.Color();

    // Shared reusable geometries/materials to prevent memory leaks across replays
    this.globGeo = makeClayBlob(0.15, 10, 8, { amp: 0.14, seed: 73, scaleY: 0.55 });
    this.globMat = createGlossyClayMaterial('#df2519', { roughness: 0.25, normalStrength: 0.55 });

    this._buildActors();
    this._buildInstancedRice();
    this.group.visible = false;
  }

  _buildActors() {
    this._buildKetchupBottle();
    this._buildSpatula();
    this._buildPrepDish();
    this._buildWaitingBowl();
    this._buildButterPuddle();
  }

  _buildInstancedRice() {
    // 1. Soft sculpted clay rice bed mound inside the pan (eliminates dark gaps between grains!)
    const bedGeo = makeClayPuck(1.06, 0.26, 0.11, 24, { amp: 0.09, freq: 3.4, seed: 10.5 });
    const bedMat = createClayMaterial('#f7f1e6', { normalStrength: 0.9, roughness: 0.85 });
    this.riceBedMesh = new THREE.Mesh(bedGeo, bedMat);
    this.riceBedMesh.castShadow = true;
    this.riceBedMesh.receiveShadow = true;
    this.group.add(this.riceBedMesh);

    // 2. 76 plump hand-molded clay rice grain clusters in ONE InstancedMesh (1 draw call!)
    const baseRiceGeo = makeClayBlob(0.115, 9, 7, {
      amp: 0.12,
      freq: 5.2,
      seed: 10.1,
      scaleX: 1.38,
      scaleY: 0.72,
      scaleZ: 0.86,
    });
    // Base color MUST be white so per-instance colors tint accurately!
    const instMat = createClayMaterial('#ffffff', { normalStrength: 0.72, roughness: 0.82 });
    this.riceInstanced = new THREE.InstancedMesh(baseRiceGeo, instMat, this.riceCount);
    this.riceInstanced.castShadow = true;
    this.riceInstanced.receiveShadow = true;
    this.group.add(this.riceInstanced);
  }

  _buildKetchupBottle() {
    const g = new THREE.Group();
    const { bodyGeo, capGeo } = makeClaySqueezeBottle(0.86);
    const bodyMat = createClayMaterial('#d93829', { normalStrength: 1.0, roughness: 0.72 });
    const capMat = createClayMaterial('#f3ebe0', { normalStrength: 0.85, roughness: 0.78 });

    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const cap = new THREE.Mesh(capGeo, capMat);
    cap.castShadow = true;
    g.add(cap);

    // Sculpted clay tomato badge on the front of the ketchup bottle
    const badge = new THREE.Mesh(
      makeClayPuck(0.22, 0.07, 0.03, 14, { amp: 0.05, seed: 3.1 }),
      createClayMaterial('#f7e8c8', { normalStrength: 0.8 })
    );
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0, 0.56, 0.34);
    g.add(badge);

    const miniTomato = new THREE.Mesh(
      makeClayBlob(0.11, 10, 8, { amp: 0.05, seed: 3.2, scaleZ: 0.55 }),
      createClayMaterial('#e33224', { normalStrength: 0.85 })
    );
    miniTomato.position.set(0, 0.54, 0.38);
    g.add(miniTomato);

    const miniStem = new THREE.Mesh(
      makeClayBlob(0.045, 8, 6, { amp: 0.07, seed: 3.3, scaleX: 1.5, scaleY: 0.5 }),
      createClayMaterial('#4d8c45', { normalStrength: 0.85 })
    );
    miniStem.position.set(0, 0.65, 0.38);
    g.add(miniStem);

    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 2.0, 10),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.95;
    hit.userData = { interact: 'ketchupBottle' };
    g.add(hit);

    g.position.copy(this.ketchupHome);
    g.rotation.y = 0.45;
    this.ketchupBottle = g;
    this.group.add(g);
  }

  _buildSpatula() {
    const g = new THREE.Group();
    const woodMat = createClayMaterial('#d49e66', { normalStrength: 1.0, roughness: 0.8 });

    const handleGeo = new THREE.CylinderGeometry(0.085, 0.105, 1.35, 12, 6);
    sculptClay(handleGeo, { amp: 0.042, freq: 3.5, seed: 18.1, thumbDents: 2 });
    const handle = new THREE.Mesh(handleGeo, woodMat);
    handle.position.y = 0.85;
    handle.castShadow = true;
    g.add(handle);

    const bladeGeo = new THREE.BoxGeometry(0.46, 0.72, 0.11, 6, 8, 3);
    sculptClay(bladeGeo, { amp: 0.05, freq: 3.2, seed: 18.5, thumbDents: 2, dentDepth: 0.038 });
    const blade = new THREE.Mesh(bladeGeo, woodMat);
    blade.position.y = 0.05;
    blade.castShadow = true;
    g.add(blade);

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 2.2, 0.85),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.55;
    hit.userData = { interact: 'spatula' };
    g.add(hit);

    // Cute clay spoon rest under the resting wooden spatula (no floating!)
    const rest = new THREE.Mesh(
      makeClayPuck(0.42, 0.08, 0.035, 16, { amp: 0.035, seed: 19.2 }),
      createClayMaterial('#f3e8d7', { normalStrength: 0.8, roughness: 0.78 })
    );
    rest.position.set(2.22, 0.04, -0.88);
    rest.castShadow = true;
    rest.receiveShadow = true;
    this.group.add(rest);

    g.position.copy(this.spatulaHome);
    g.rotation.set(0.08, -0.25, -1.48);
    this.spatula = g;
    this.group.add(g);
  }

  _buildPrepDish() {
    this.prepGroup = new THREE.Group();
    this.prepGroup.position.set(-2.54, 0.02, -0.88);
    this.group.add(this.prepGroup);

    const dishMat = createClayMaterial('#f3e8d7', { normalStrength: 0.8, roughness: 0.78 });
    const dish = new THREE.Mesh(
      makeClayPuck(0.64, 0.14, 0.05, 20, { amp: 0.028, seed: 22.1 }),
      dishMat
    );
    dish.position.y = 0.07;
    dish.castShadow = true;
    dish.receiveShadow = true;
    this.prepGroup.add(dish);

    // Pat of yellow clay butter!
    const butterGeo = new THREE.BoxGeometry(0.38, 0.2, 0.3, 6, 4, 6);
    sculptClay(butterGeo, { amp: 0.045, freq: 4.0, seed: 22.4, thumbDents: 2 });
    const butterMat = createClayMaterial('#fae27a', { normalStrength: 0.85, roughness: 0.65 });
    const butter = new THREE.Group();
    const bMesh = new THREE.Mesh(butterGeo, butterMat);
    bMesh.castShadow = true;
    butter.add(bMesh);
    const bHit = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 8, 6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    bHit.userData = { interact: 'prepButter' };
    butter.add(bHit);
    butter.position.set(-0.18, 0.24, 0.08);
    butter.rotation.y = 0.3;
    this.butterProp = butter;
    this.prepGroup.add(butter);

    // Cute bonus clay toppings (mini pink sausage, sweet corn, extra peas)
    const bonusConfigs = [
      { kind: 'wiener', color: '#e67c73', pos: [0.22, 0.21, -0.14], scale: [0.15, 0.095, 0.15] },
      { kind: 'corn', color: '#f5c736', pos: [0.24, 0.2, 0.18], scale: [0.12, 0.11, 0.12] },
      { kind: 'pea', color: '#58a846', pos: [0.0, 0.2, -0.28], scale: [0.11, 0.11, 0.11] },
    ];
    bonusConfigs.forEach((cfg, idx) => {
      const g = new THREE.Group();
      const mesh = new THREE.Mesh(
        makeClayBlob(1.0, 10, 8, { amp: 0.08, seed: 30 + idx }),
        createClayMaterial(cfg.color, { normalStrength: 0.9 })
      );
      mesh.scale.set(...cfg.scale);
      mesh.castShadow = true;
      g.add(mesh);

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 8, 6),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.userData = { interact: 'prepBonus', bonusIdx: idx };
      g.add(hit);

      g.position.set(...cfg.pos);
      g.userData = { ...cfg, used: false, home: new THREE.Vector3(...cfg.pos) };
      this.bonusProps.push(g);
      this.prepGroup.add(g);
    });
  }

  _buildWaitingBowl() {
    this.bowlGroup = new THREE.Group();
    this.bowlGroup.position.copy(this.bowlPosHidden);
    this.group.add(this.bowlGroup);

    // Warm glazed-clay sky-blue serving bowl waiting for the ketchup rice
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
    this.bowlGroup.add(mesh);

    const moundGeo = makeClayBlob(0.64, 16, 12, {
      amp: 0.1,
      freq: 4.5,
      seed: 42.1,
      scaleX: 1.15,
      scaleY: 0.68,
      scaleZ: 0.9,
    });
    this.transferredMound = new THREE.Mesh(
      moundGeo,
      createClayMaterial('#e84e24', { normalStrength: 1.0 })
    );
    this.transferredMound.position.set(0, 0.38, 0);
    this.transferredMound.visible = false;
    this.transferredMound.castShadow = true;
    this.bowlGroup.add(this.transferredMound);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 10, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.y = 0.38;
    hit.userData = { interact: 'riceBowl' };
    this.bowlGroup.add(hit);
  }

  _buildButterPuddle() {
    const mat = createGlossyClayMaterial('#f9dc6a', {
      roughness: 0.25,
      normalStrength: 0.45,
      transparent: true,
      opacity: 0.85,
    });
    const geo = makeClayPuck(0.7, 0.05, 0.02, 18, { amp: 0.08, seed: 51 });
    this.butterPuddle = new THREE.Mesh(geo, mat);
    this.butterPuddle.position.set(0, 0.8, -0.1);
    this.butterPuddle.scale.set(0.01, 0.01, 0.01);
    this.butterPuddle.visible = false;
    this.group.add(this.butterPuddle);
  }

  _clearPanContents() {
    this.mixIns.forEach((item) => this.group.remove(item.mesh));
    this.mixIns.length = 0;
    this.ketchupGlobs.forEach((item) => this.group.remove(item.mesh));
    this.ketchupGlobs.length = 0;
    this.flyingProps.forEach((f) => this.group.remove(f.mesh));
    this.flyingProps.length = 0;
    this.riceGrains.length = 0;
  }

  _populatePanContents() {
    this._clearPanContents();

    const panCenter = this.diorama.panBasePos;

    // Position the sculpted clay rice bed snugly on the pan floor
    this.riceBedMesh.position.set(panCenter.x, panCenter.y + 0.14, panCenter.z);
    this.riceBedMesh.scale.set(1, 1, 1);
    this.riceBedMesh.visible = true;
    this.riceBedMesh.material.color.copy(this.whiteRiceColor);

    // 76 plump hand-molded clay rice grain clusters packed lushly over the bed
    for (let i = 0; i < this.riceCount; i++) {
      const ang = i * 2.39996;
      const r = Math.sqrt((i + 0.35) / this.riceCount) * 0.98;
      const x = panCenter.x + Math.cos(ang) * r;
      const z = panCenter.z + Math.sin(ang) * r;
      const dome = Math.max(0, 1 - (r / 1.05) * (r / 1.05));
      const y = panCenter.y + 0.21 + dome * 0.16 + (i % 3) * 0.025;
      const sc = 0.82 + (i % 5) * 0.075;

      this.riceGrains.push({
        x,
        y,
        z,
        rx: (i % 7) * 0.35,
        ry: i * 1.15,
        rz: (i % 5) * 0.25,
        sc,
        vx: 0,
        vy: 0,
        vz: 0,
        redness: 0,
        toast: 0,
        baseY: y,
      });
    }
    this._syncRiceInstances(this._getTargetRiceColor(), 1.0);

    // Chicken chunks, carrot dice, and green peas nestled on top of the rice mound
    const chickenGeo = sculptClay(new THREE.BoxGeometry(0.18, 0.13, 0.16, 4, 4, 4), { amp: 0.12, seed: 14.1 });
    const carrotGeo = sculptClay(new THREE.BoxGeometry(0.13, 0.1, 0.13, 4, 3, 4), { amp: 0.1, seed: 14.4 });
    const peaGeo = makeClayBlob(0.082, 8, 6, { amp: 0.07, seed: 14.8 });

    const addMixIn = (kind, geo, color, count) => {
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + Math.random() * 0.6;
        const r = 0.12 + Math.random() * 0.78;
        const x = panCenter.x + Math.cos(ang) * r;
        const z = panCenter.z + Math.sin(ang) * r;
        const y = panCenter.y + 0.38 + Math.random() * 0.08;
        const mesh = new THREE.Mesh(geo, createClayMaterial(color, { normalStrength: 0.85 }));
        mesh.position.set(x, y, z);
        mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        mesh.castShadow = true;
        this.group.add(mesh);
        this.mixIns.push({ kind, mesh, vx: 0, vy: 0, vz: 0, cooked: 0 });
      }
    };

    addMixIn('chicken', chickenGeo, '#efbda8', 8);
    addMixIn('carrot', carrotGeo, '#f28230', 8);
    addMixIn('pea', peaGeo, '#5aa848', 11);
  }

  _syncRiceInstances(targetRiceColor, globalScale = 1.0) {
    let avgRed = 0;
    let avgToast = 0;
    for (let i = 0; i < this.riceGrains.length; i++) {
      const g = this.riceGrains[i];
      this.dummy.position.set(g.x, g.y, g.z);
      this.dummy.rotation.set(g.rx, g.ry, g.rz);
      const s = g.sc * globalScale;
      this.dummy.scale.set(s * 1.1, s * 0.82, s);
      this.dummy.updateMatrix();
      this.riceInstanced.setMatrixAt(i, this.dummy.matrix);

      this._tmpColor.copy(this.whiteRiceColor).lerp(targetRiceColor, g.redness);
      if (g.toast > 0) {
        this._tmpColor.lerp(this.toastTintColor, g.toast);
      }
      this.riceInstanced.setColorAt(i, this._tmpColor);
      avgRed += g.redness;
      avgToast += g.toast;
    }
    this.riceInstanced.instanceMatrix.needsUpdate = true;
    if (this.riceInstanced.instanceColor) {
      this.riceInstanced.instanceColor.needsUpdate = true;
    }

    if (this.riceGrains.length > 0 && this.riceBedMesh) {
      avgRed /= this.riceGrains.length;
      avgToast /= this.riceGrains.length;
      this._tmpColor.copy(this.whiteRiceColor).lerp(targetRiceColor, avgRed);
      if (avgToast > 0) this._tmpColor.lerp(this.toastTintColor, avgToast);
      this.riceBedMesh.material.color.copy(this._tmpColor);
    }
  }

  enter() {
    this.active = true;
    this.group.visible = true;
    this.phase = 'cooking';
    this.transferT = 0;
    this.ketchupCount = 0;
    this.cookProgress = 0;
    this.idleTimer = 0;
    this.isStirring = false;
    this.stirSpeed = 0;

    this.hasButter = false;
    this.butterMelt = 0;
    this.butterPuddle.visible = false;
    this.butterProp.visible = true;
    this.butterProp.position.set(-0.18, 0.24, 0.08);
    this.butterProp.scale.setScalar(1);

    this.bonusProps.forEach((b) => {
      b.visible = true;
      b.userData.used = false;
      b.position.copy(b.userData.home);
      b.scale.setScalar(1);
    });

    this.ketchupBottle.position.copy(this.ketchupHome);
    this.ketchupBottle.rotation.set(0, 0.45, 0);
    this.ketchupBottle.scale.setScalar(1);
    this.ketchupAnim = 0;

    this.spatula.position.copy(this.spatulaHome);
    this.spatula.rotation.set(0.08, -0.25, -1.48);

    this.bowlSlide = 0;
    this.bowlGroup.position.copy(this.bowlPosHidden);
    this.transferredMound.visible = false;

    this.diorama.setFlameOn(true);
    this.diorama.setFlameLevel(2);
    this.diorama.steamRate = 0.6;

    this._populatePanContents();
  }

  exit() {
    this.active = false;
    this.group.visible = false;
    this.isStirring = false;
    audio.setSizzle(0);
    this.diorama.steamRate = 0;
  }

  squirtKetchup() {
    if (this.phase === 'transferring' || this.phase === 'done') return;
    this.idleTimer = 0;
    this.ketchupCount++;
    this.recipe.ketchupAmount = this.ketchupCount;
    this.ketchupAnim = 1.0;

    const pan = this.diorama.panBasePos;
    const ox = (Math.random() - 0.5) * 0.78;
    const oz = (Math.random() - 0.5) * 0.78;
    this.ketchupSquirtPos.set(pan.x + ox, pan.y + 0.48, pan.z + oz);

    audio.playKetchupSquirt(0.95 + Math.random() * 0.16);
    this.diorama.jigglePan(0.35);

    // Spawn 5 plump glossy clay ketchup globs splashing onto the rice
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
      const dist = i === 0 ? 0 : 0.13 + Math.random() * 0.22;
      const mesh = new THREE.Mesh(this.globGeo, this.globMat);
      const sc = 0.85 + Math.random() * 0.35;
      mesh.scale.set(sc, sc, sc);
      mesh.position.set(
        this.ketchupSquirtPos.x + Math.cos(a) * dist,
        pan.y + 0.94 + Math.random() * 0.22,
        this.ketchupSquirtPos.z + Math.sin(a) * dist
      );
      mesh.castShadow = true;
      this.group.add(mesh);
      this.ketchupGlobs.push({ mesh, vy: -1.8, life: 1.0 });
    }
  }

  addButter() {
    if (this.hasButter || this.phase === 'transferring') return;
    this.idleTimer = 0;
    this.hasButter = true;
    this.recipe.hasButter = true;
    this.butterProp.visible = false;
    audio.playPop(0.92);

    // Launch visible butter pat in a joyful claymation hop from prep dish into pan!
    const start = new THREE.Vector3();
    this.butterProp.getWorldPosition(start);
    const pan = this.diorama.panBasePos;
    const flyMesh = new THREE.Mesh(
      sculptClay(new THREE.BoxGeometry(0.36, 0.18, 0.28, 5, 3, 5), { amp: 0.04, seed: 22.4 }),
      createClayMaterial('#fae27a', { normalStrength: 0.85, roughness: 0.6 })
    );
    flyMesh.position.copy(start);
    flyMesh.castShadow = true;
    this.group.add(flyMesh);
    this.flyingProps.push({
      mesh: flyMesh,
      start,
      end: new THREE.Vector3(pan.x, pan.y + 0.44, pan.z),
      t: 0,
      onLand: () => {
        this.butterPuddle.position.set(pan.x, pan.y + 0.38, pan.z);
        this.butterPuddle.visible = true;
        this.butterMelt = 0.05;
        audio.playButterMelt();
        this.diorama.jigglePan(0.45);
        this.diorama.spawnSteam(pan.x, pan.y + 0.58, pan.z, 1.25);
      },
    });
  }

  addBonusTopping(idx) {
    const prop = this.bonusProps[idx];
    if (!prop || prop.userData.used || this.phase === 'transferring') return;
    this.idleTimer = 0;
    prop.userData.used = true;
    prop.visible = false;
    this.recipe.bonusToppings.push(prop.userData.kind);
    audio.playPop(1.0 + idx * 0.15);

    const start = new THREE.Vector3();
    prop.getWorldPosition(start);
    const pan = this.diorama.panBasePos;
    const geo = makeClayBlob(0.11, 8, 6, {
      amp: 0.09,
      seed: 95 + idx,
      scaleY: prop.userData.kind === 'wiener' ? 0.65 : 1.0,
    });
    const mat = createClayMaterial(prop.userData.color, { normalStrength: 0.9 });

    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(start);
      mesh.castShadow = true;
      this.group.add(mesh);
      const end = new THREE.Vector3(
        pan.x + (Math.random() - 0.5) * 0.85,
        pan.y + 0.42,
        pan.z + (Math.random() - 0.5) * 0.85
      );
      this.flyingProps.push({
        mesh,
        start: start.clone(),
        end,
        t: -i * 0.12,
        keepOnLand: true,
        onLand: () => {
          if (i === 0) this.diorama.jigglePan(0.32);
          this.mixIns.push({
            kind: prop.userData.kind,
            mesh,
            vx: (Math.random() - 0.5) * 0.4,
            vy: 0.4,
            vz: (Math.random() - 0.5) * 0.4,
            cooked: 0,
          });
        },
      });
    }
  }

  startTransfer() {
    if (this.phase !== 'ready') return;
    this.phase = 'transferring';
    this.transferT = 0;
    this.isStirring = false;
    audio.playFlipWhoosh();
    this.diorama.jigglePan(1.0);

    const targetColor = this._getTargetRiceColor();
    this.recipe.riceColorHex = '#' + targetColor.getHexString();
    this.transferredMound.material.color.copy(targetColor);
  }

  _getTargetRiceColor() {
    // Vibrant mouthwatering ketchup rice orange-red!
    const richness = Math.min(1, 0.5 + (this.ketchupCount - 1) * 0.25);
    const c = new THREE.Color('#f0642b').lerp(new THREE.Color('#dc381c'), richness);
    if (this.hasButter) {
      c.lerp(new THREE.Color('#f58a2e'), 0.14);
    }
    return c;
  }

  onPointerDown(hit, worldOnPanPlane) {
    if (!this.active || this.phase === 'transferring' || this.phase === 'done') return false;
    this.idleTimer = 0;

    if (hit) {
      const kind = hit.object.userData?.interact;
      if (kind === 'stoveKnob') {
        const lvl = this.diorama.cycleFlameLevel();
        audio.playStoveClick(lvl);
        this.diorama.jigglePan(0.28);
        return true;
      }
      if (kind === 'ketchupBottle') {
        this.squirtKetchup();
        return true;
      }
      if (kind === 'prepButter') {
        this.addButter();
        return true;
      }
      if (kind === 'prepBonus') {
        this.addBonusTopping(hit.object.userData.bonusIdx);
        return true;
      }
      if (kind === 'riceBowl' && this.phase === 'ready') {
        this.startTransfer();
        return true;
      }
      if (kind === 'panHandle') {
        if (this.phase === 'ready') {
          this.startTransfer();
        } else {
          this._tossPan();
        }
        return true;
      }
      if (kind === 'spatula' || kind === 'pan') {
        this._beginStir(worldOnPanPlane);
        return true;
      }
    }

    if (worldOnPanPlane) {
      const pan = this.diorama.panBasePos;
      const dist = Math.hypot(worldOnPanPlane.x - pan.x, worldOnPanPlane.z - pan.z);
      if (dist < 1.65) {
        this._beginStir(worldOnPanPlane);
        return true;
      }
    }
    return false;
  }

  _beginStir(worldPos) {
    this.isStirring = true;
    const pan = this.diorama.panBasePos;
    const p = worldPos || pan;
    const dx = p.x - pan.x;
    const dz = p.z - pan.z;
    const d = Math.hypot(dx, dz);
    const maxR = 1.02;
    const clampedX = d > maxR ? pan.x + (dx / d) * maxR : p.x;
    const clampedZ = d > maxR ? pan.z + (dz / d) * maxR : p.z;
    this.spatulaTarget.set(clampedX, pan.y + 0.36, clampedZ);
    this.prevStirPos.copy(this.spatulaTarget);
    // Give a satisfying stir burst on tap too so tap-only 5yo play still mixes & progresses!
    this._stirParticles(clampedX, clampedZ, Math.cos(this.idleTimer + 1), Math.sin(this.idleTimer + 1), 0.42);
    audio.playSpatulaStir();
  }

  _tossPan() {
    audio.playFlipWhoosh();
    this.diorama.jigglePan(0.9);
    const hopBoost = 1.85;
    this.riceGrains.forEach((g) => {
      g.vy = hopBoost + Math.random() * 0.9;
      g.vx += (Math.random() - 0.5) * 0.9;
      g.vz += (Math.random() - 0.5) * 0.9;
      if (this.ketchupCount > 0) {
        g.redness = Math.min(1, g.redness + 0.16);
      }
    });
    this.mixIns.forEach((m) => {
      m.vy = hopBoost + Math.random() * 1.1;
      m.vx += (Math.random() - 0.5) * 1.1;
      m.vz += (Math.random() - 0.5) * 1.1;
    });
    if (this.ketchupCount > 0) {
      this._advanceCook(0.16);
    }
  }

  onPointerMove(worldOnPanPlane) {
    if (!this.active || !this.isStirring || !worldOnPanPlane) return;
    this.idleTimer = 0;

    if (this.phase === 'ready' && worldOnPanPlane.x > 1.85) {
      this.startTransfer();
      return;
    }

    const pan = this.diorama.panBasePos;
    const dx = worldOnPanPlane.x - pan.x;
    const dz = worldOnPanPlane.z - pan.z;
    const d = Math.hypot(dx, dz);
    const maxR = 1.04;
    const cx = d > maxR ? pan.x + (dx / d) * maxR : worldOnPanPlane.x;
    const cz = d > maxR ? pan.z + (dz / d) * maxR : worldOnPanPlane.z;

    this.spatulaTarget.set(cx, pan.y + 0.34, cz);

    const moveDist = Math.hypot(cx - this.prevStirPos.x, cz - this.prevStirPos.z);
    if (moveDist > 0.03) {
      this.stirSpeed = Math.min(2.5, this.stirSpeed + moveDist * 3.5);
      const dirX = (cx - this.prevStirPos.x) / moveDist;
      const dirZ = (cz - this.prevStirPos.z) / moveDist;
      this._stirParticles(cx, cz, dirX, dirZ, moveDist);
      audio.playSpatulaStir();
      this.prevStirPos.set(cx, pan.y + 0.34, cz);
    }
  }

  onPointerUp() {
    this.isStirring = false;
  }

  _stirParticles(sx, sz, dirX, dirZ, moveDist) {
    const heatMult = [0.75, 1.0, 1.45][this.diorama.flameLevel - 1];
    const hasKetchup = this.ketchupCount > 0;

    for (let i = 0; i < this.riceGrains.length; i++) {
      const g = this.riceGrains[i];
      const dx = g.x - sx;
      const dz = g.z - sz;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.76) {
        const push = (1 - dist / 0.76) * Math.min(1.2, moveDist * 4.5);
        g.vx += (dirX * 1.4 + (Math.random() - 0.5) * 0.9) * push;
        g.vz += (dirZ * 1.4 + (Math.random() - 0.5) * 0.9) * push;
        if (g.y <= g.baseY + 0.04) {
          g.vy = Math.max(g.vy, 0.7 + push * 1.4);
        }
        if (hasKetchup) {
          g.redness = Math.min(1, g.redness + moveDist * 0.45 * heatMult);
        }
        if (this.diorama.flameLevel === 3) {
          g.toast = Math.min(0.24, g.toast + moveDist * 0.045);
        }
      } else if (hasKetchup) {
        g.redness = Math.min(1, g.redness + moveDist * 0.1 * heatMult);
      }
    }

    for (let i = 0; i < this.mixIns.length; i++) {
      const m = this.mixIns[i];
      const dx = m.mesh.position.x - sx;
      const dz = m.mesh.position.z - sz;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.8) {
        const push = (1 - dist / 0.8) * Math.min(1.2, moveDist * 4.2);
        m.vx += (dirX * 1.3 + (Math.random() - 0.5) * 0.8) * push;
        m.vz += (dirZ * 1.3 + (Math.random() - 0.5) * 0.8) * push;
        m.vy = Math.max(m.vy, 0.85 + push * 1.4);
      }
      m.cooked = Math.min(1, m.cooked + moveDist * 0.14 * heatMult);
    }

    for (let i = this.ketchupGlobs.length - 1; i >= 0; i--) {
      const k = this.ketchupGlobs[i];
      k.life -= moveDist * 0.34;
      const sc = Math.max(0.05, k.life);
      k.mesh.scale.set(sc * 1.2, sc * 0.6, sc * 1.2);
      if (k.life <= 0.08) {
        this.group.remove(k.mesh);
        this.ketchupGlobs.splice(i, 1);
      }
    }

    if (hasKetchup) {
      this._advanceCook(moveDist * 0.15 * heatMult);
    }
  }

  _advanceCook(delta) {
    this.cookProgress = Math.min(1.25, this.cookProgress + delta);
    if (this.phase === 'cooking' && this.cookProgress >= 1.0 && this.ketchupCount >= 1) {
      this.phase = 'ready';
      audio.playStageDone();
    }
  }

  update(dt, elapsed, stopMotionStep) {
    if (!this.active) return;

    this.idleTimer += dt;
    this.stirSpeed = Math.max(0, this.stirSpeed - dt * 3.8);

    const baseSizzle = [0.22, 0.42, 0.72][this.diorama.flameLevel - 1];
    audio.setSizzle(this.phase === 'transferring' ? 0 : baseSizzle + this.stirSpeed * 0.28);
    this.diorama.steamRate = (0.45 + this.diorama.flameLevel * 0.45) + this.stirSpeed * 0.75;

    const pan = this.diorama.panBasePos;
    const targetRiceColor = this._getTargetRiceColor();

    // 0. Animate flying butter/toppings arcing into the pan
    for (let i = this.flyingProps.length - 1; i >= 0; i--) {
      const f = this.flyingProps[i];
      f.t += dt * 2.8;
      if (f.t < 0) continue;
      const t = Math.min(1, f.t);
      const qt = Math.floor(t * 10) / 10;
      f.mesh.position.lerpVectors(f.start, f.end, qt);
      f.mesh.position.y += Math.sin(qt * Math.PI) * 1.35;
      f.mesh.rotation.x += dt * 7;
      f.mesh.rotation.z += dt * 5;
      if (t >= 1) {
        if (!f.keepOnLand) this.group.remove(f.mesh);
        if (f.onLand) f.onLand();
        this.flyingProps.splice(i, 1);
      }
    }

    // 1. Animate ketchup bottle squirt arc & clay squash-stretch
    if (this.ketchupAnim > 0) {
      this.ketchupAnim = Math.max(0, this.ketchupAnim - dt * 1.85);
      const t = 1 - this.ketchupAnim;
      const arc = Math.sin(t * Math.PI);
      this.ketchupBottle.position.lerpVectors(this.ketchupHome, this.ketchupSquirtPos, arc);
      this.ketchupBottle.position.y = this.ketchupHome.y + arc * 1.95;
      this.ketchupBottle.rotation.z = -arc * 2.55;
      const sq = Math.sin(t * Math.PI * 2) * 0.18 * arc;
      this.ketchupBottle.scale.set(1 - sq, 1 + sq * 0.8, 1 - sq);
    } else {
      let hop = 0;
      let tilt = 0;
      if (this.ketchupCount === 0 && this.idleTimer > 7.0) {
        const w = Math.sin((this.idleTimer - 7.0) * 5.0);
        hop = Math.max(0, w) * 0.16;
        tilt = Math.sin((this.idleTimer - 7.0) * 10.0) * 0.1;
      }
      this.ketchupBottle.position.set(this.ketchupHome.x, this.ketchupHome.y + hop, this.ketchupHome.z);
      this.ketchupBottle.rotation.set(0, 0.45, tilt);
      this.ketchupBottle.scale.setScalar(1);
    }

    // 2. Animate butter melting puddle
    if (this.hasButter && this.butterPuddle.visible && this.butterMelt < 1) {
      this.butterMelt = Math.min(1, this.butterMelt + dt * 0.85);
      const s = 0.25 + this.butterMelt * 0.9;
      this.butterPuddle.scale.set(s, 1, s);
      this.butterPuddle.material.opacity = Math.max(0.16, 0.82 - this.butterMelt * 0.55);
    }

    // 3. Animate wooden clay spatula
    if (this.isStirring) {
      this.spatula.position.lerp(this.spatulaTarget, Math.min(1, dt * 20));
      const tiltX = 0.35 + Math.sin(elapsed * 14) * 0.08;
      this.spatula.rotation.set(tiltX, -0.35, -0.25 - (this.spatulaTarget.x - pan.x) * 0.25);
    } else {
      let idleWob = 0;
      if (this.ketchupCount > 0 && this.phase === 'cooking' && this.idleTimer > 7.0) {
        idleWob = Math.sin((this.idleTimer - 7.0) * 6.5) * 0.18;
      }
      const restPos = this.spatulaHome.clone();
      restPos.y += Math.abs(idleWob) * 0.25;
      this.spatula.position.lerp(restPos, Math.min(1, dt * 8));
      this.spatula.rotation.set(0.08, -0.25, -1.48 + idleWob);
    }

    // 4. Physics & stop-motion color blending of rice clumps & mix-ins
    if (this.phase !== 'transferring') {
      const gravity = -9.8;
      const maxPanR = 0.98;

      for (let i = 0; i < this.riceGrains.length; i++) {
        const g = this.riceGrains[i];
        g.vy += gravity * dt;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        g.z += g.vz * dt;

        if (g.y < g.baseY) {
          g.y = g.baseY;
          g.vy = Math.abs(g.vy) > 0.6 ? -g.vy * 0.25 : 0;
          g.vx *= 0.82;
          g.vz *= 0.82;
        } else {
          g.rx += dt * 4.5;
          g.rz += dt * 3.5;
        }

        const dx = g.x - pan.x;
        const dz = g.z - pan.z;
        const dist = Math.hypot(dx, dz);
        if (dist > maxPanR) {
          g.x = pan.x + (dx / dist) * maxPanR;
          g.z = pan.z + (dz / dist) * maxPanR;
          g.vx *= -0.45;
          g.vz *= -0.45;
        }
      }
      this._syncRiceInstances(targetRiceColor, 1.0);

      for (let i = 0; i < this.mixIns.length; i++) {
        const m = this.mixIns[i];
        m.vy += gravity * dt;
        m.mesh.position.x += m.vx * dt;
        m.mesh.position.y += m.vy * dt;
        m.mesh.position.z += m.vz * dt;
        const floorY = pan.y + 0.38;
        if (m.mesh.position.y < floorY) {
          m.mesh.position.y = floorY;
          m.vy = 0;
          m.vx *= 0.82;
          m.vz *= 0.82;
        } else {
          m.mesh.rotation.x += dt * 5;
          m.mesh.rotation.y += dt * 4;
        }
        const dx = m.mesh.position.x - pan.x;
        const dz = m.mesh.position.z - pan.z;
        const dist = Math.hypot(dx, dz);
        if (dist > maxPanR * 0.9) {
          m.mesh.position.x = pan.x + (dx / dist) * maxPanR * 0.9;
          m.mesh.position.z = pan.z + (dz / dist) * maxPanR * 0.9;
          m.vx *= -0.4;
          m.vz *= -0.4;
        }
        if (m.kind === 'chicken') {
          m.mesh.material.color.copy(this.rawChickenColor).lerp(this.cookedChickenColor, m.cooked);
        }
      }

      for (let i = 0; i < this.ketchupGlobs.length; i++) {
        const k = this.ketchupGlobs[i];
        if (k.mesh.position.y > pan.y + 0.42) {
          k.vy -= 10 * dt;
          k.mesh.position.y = Math.max(pan.y + 0.42, k.mesh.position.y + k.vy * dt);
        }
      }
    }

    // 5. Waiting bowl slides in once rice is ready
    if (this.phase === 'ready' || this.phase === 'transferring') {
      this.bowlSlide = Math.min(1, this.bowlSlide + dt * 2.2);
      const ease = 1 - Math.pow(1 - this.bowlSlide, 3);
      this.bowlGroup.position.lerpVectors(this.bowlPosHidden, this.bowlPosReady, ease);
      if (this.phase === 'ready') {
        const b = Math.sin(stopMotionStep * 0.55) * 0.055;
        this.bowlGroup.position.y = this.bowlPosReady.y + Math.max(0, b);
        const sq = Math.sin(stopMotionStep * 0.55) * 0.035;
        this.bowlGroup.scale.set(1 + sq, 1 - sq, 1 + sq);
      } else {
        this.bowlGroup.scale.setScalar(1);
      }
    }

    // 6. Transferring ketchup rice in a joyful claymation arc into the bowl!
    if (this.phase === 'transferring') {
      this.transferT += dt * 1.15;
      const t = Math.min(1, this.transferT);
      const arcY = Math.sin(t * Math.PI) * 1.95;

      const dest = this.bowlPosReady;
      const stepT = Math.floor(t * 14) / 14;
      this.riceBedMesh.scale.setScalar(Math.max(0.01, 1 - stepT * 1.25));
      if (stepT > 0.8) this.riceBedMesh.visible = false;

      for (let i = 0; i < this.riceGrains.length; i++) {
        const g = this.riceGrains[i];
        const localT = Math.max(0, Math.min(1, stepT * 1.2 - (i % 6) * 0.03));
        g.x = THREE.MathUtils.lerp(g.x, dest.x, localT * 0.28);
        g.z = THREE.MathUtils.lerp(g.z, dest.z, localT * 0.28);
        g.y = pan.y + 0.35 + Math.sin(localT * Math.PI) * 1.65;
      }
      this._syncRiceInstances(targetRiceColor, Math.max(0.01, (1 - stepT) * 0.95));

      this.mixIns.forEach((m) => {
        m.mesh.position.x = THREE.MathUtils.lerp(m.mesh.position.x, dest.x, stepT * 0.28);
        m.mesh.position.z = THREE.MathUtils.lerp(m.mesh.position.z, dest.z, stepT * 0.28);
        m.mesh.position.y = pan.y + 0.35 + arcY;
        m.mesh.scale.setScalar(Math.max(0.01, 1 - stepT));
      });

      if (t > 0.55) {
        this.transferredMound.visible = true;
        const mSc = Math.min(1, (t - 0.55) / 0.35);
        this.transferredMound.scale.set(mSc, mSc * (1 + (1 - mSc) * 0.3), mSc);
      }

      if (t >= 1) {
        this.phase = 'done';
        audio.playClaySquish(1.1);
        if (this.onComplete) this.onComplete();
      }
    }
  }
}
