import * as THREE from '../vendor/three/three.module.min.js';
import { createClayMaterial, createGlossyClayMaterial } from './clayMaterial.js';
import {
  sculptClay,
  makeClayBlob,
  makeClayPuck,
  makeClayPlate,
  makeOmuriceGeometry,
  sampleOmuriceSurface,
  makeClaySqueezeBottle,
  makeClayStar,
  makeClayHeart,
} from './clayGeo.js';
import { DINING_CENTER } from './kitchenScene.js';
import { audio } from './audio.js';

export const OMURICE_LEN = 2.34;
export const OMURICE_WID = 1.38;

export class StageDecorate {
  constructor(scene, recipeState, onServe) {
    this.scene = scene;
    this.recipe = recipeState;
    this.onServe = onServe;

    this.group = new THREE.Group();
    this.group.position.set(DINING_CENTER.x, 0.06, DINING_CENTER.z + 0.14);
    scene.add(this.group);

    this.active = false;
    this.idleTimer = 0;

    // Shared Plate & Omurice group (handed over visually to Stage 4!)
    this.plateGroup = new THREE.Group();
    this.group.add(this.plateGroup);

    this.omuriceMesh = null;
    this.omuriceInnerRice = null;
    this.omuriceHeight = 0.86;
    this.decorLayer = new THREE.Group();
    this.plateGroup.add(this.decorLayer);

    // High-performance InstancedMesh ketchup & mayo ribbons (just 2 draw calls total!)
    this.maxInstBeads = 450;
    this.ketchupBeadCount = 0;
    this.mayoBeadCount = 0;
    this.ketchupInst = null;
    this.mayoInst = null;
    this.garnishGroup = new THREE.Group();
    this.decorLayer.add(this.garnishGroup);
    this._dummy = new THREE.Object3D();

    // Active drawing tool: 'ketchup' | 'mayo' | 'star' | 'heart'
    this.activeTool = 'ketchup';
    this.isDrawing = false;
    this.pointerDownOnPlate = false;
    this.lastDrawPt = null;
    this.currentHoldInfo = null; // { kind: 'ketchup'|'mayo', idx, pos }
    this.holdTime = 0;
    this.strokeCount = 0;
    this.bellTapsBeforeDraw = 0;

    // Physical tool models (cleanly arranged outside the plate rim with zero clipping!)
    this.toolsGroup = new THREE.Group();
    this.group.add(this.toolsGroup);

    this.ketchupBottle = null;
    this.ketchupHome = new THREE.Vector3(-2.48, 0.0, 0.56);
    this.mayoBottle = null;
    this.mayoHome = new THREE.Vector3(-2.52, 0.0, -0.64);
    this.garnishDish = null;
    this.napkinGroup = null;
    this.bellGroup = null;
    this.bellPlunger = null;
    this.bellBounce = 0;

    this.beadGeo = makeClayBlob(0.072, 10, 8, { amp: 0.055, seed: 88 });
    this.ketchupDrawMat = createGlossyClayMaterial('#df2217', { roughness: 0.24, normalStrength: 0.5 });
    this.mayoDrawMat = createGlossyClayMaterial('#f8f1d6', { roughness: 0.32, normalStrength: 0.5 });
    this.starGeo = makeClayStar(0.15, 0.075, 0.06, 5);
    this.starMat = createClayMaterial('#f28533', { normalStrength: 0.9 });
    this.heartGeo = makeClayHeart(0.14, 0.06);
    this.heartMat = createClayMaterial('#fae282', { normalStrength: 0.85 });

    this.omuriceHitMesh = null;
    this.activeBottleTarget = new THREE.Vector3();

    this._initInstancedBeads();
    this._buildPlateAndOmurice();
    this._buildTools();

    this.group.visible = false;
  }

  _initInstancedBeads() {
    this.ketchupInst = new THREE.InstancedMesh(this.beadGeo, this.ketchupDrawMat, this.maxInstBeads);
    this.ketchupInst.count = 0;
    this.ketchupInst.castShadow = true;
    this.ketchupInst.frustumCulled = false;
    this.decorLayer.add(this.ketchupInst);

    this.mayoInst = new THREE.InstancedMesh(this.beadGeo, this.mayoDrawMat, this.maxInstBeads);
    this.mayoInst.count = 0;
    this.mayoInst.castShadow = true;
    this.mayoInst.frustumCulled = false;
    this.decorLayer.add(this.mayoInst);
  }

  _buildPlateAndOmurice() {
    // Hand-molded warm cream ceramic clay plate (cleanly proportioned for zero side clipping!)
    const plateGeo = makeClayPlate(1.86, 1.36, 0.24, 7.7);
    const plateMat = createGlossyClayMaterial('#f7f0e2', { roughness: 0.42, normalStrength: 0.65 });
    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.castShadow = true;
    plateMesh.receiveShadow = true;
    plateMesh.userData = { interact: 'plateSurface' };
    this.plateGroup.add(plateMesh);

    const rimGeo = new THREE.TorusGeometry(1.66, 0.038, 8, 36);
    rimGeo.rotateX(Math.PI / 2);
    rimGeo.scale(1.0, 1.0, 1.36 / 1.86);
    const rimMat = createClayMaterial('#d97859', { normalStrength: 0.8, roughness: 0.65 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.y = 0.21;
    this.plateGroup.add(rim);

    // Side clay garnishes nestled neatly on the plate rim: 2 cherry tomatoes + curly clay parsley
    const tomMat = createGlossyClayMaterial('#e03426', { roughness: 0.3, normalStrength: 0.55 });
    const leafMat = createClayMaterial('#4f9442', { normalStrength: 0.95, roughness: 0.8 });
    const tomPositions = [
      [-1.24, 0.23, -0.46],
      [-1.02, 0.22, -0.68],
    ];
    tomPositions.forEach((p, idx) => {
      const t = new THREE.Mesh(makeClayBlob(0.18, 12, 10, { amp: 0.05, seed: 100 + idx }), tomMat);
      t.position.set(...p);
      t.castShadow = true;
      this.plateGroup.add(t);

      const sepal = new THREE.Mesh(makeClayStar(0.09, 0.038, 0.028, 5), leafMat);
      sepal.position.set(p[0], p[1] + 0.16, p[2]);
      this.plateGroup.add(sepal);
    });

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const pLeaf = new THREE.Mesh(
        makeClayBlob(0.125, 10, 8, { amp: 0.16, seed: 110 + i, scaleY: 0.6 }),
        leafMat
      );
      pLeaf.position.set(1.18 + Math.cos(a) * 0.14, 0.21 + (i % 2) * 0.055, -0.56 + Math.sin(a) * 0.12);
      pLeaf.castShadow = true;
      this.plateGroup.add(pLeaf);
    }

    // Inner ketchup rice core + visible clay peas/chicken revealed when family scoops bites in Stage 4!
    this.omuriceInnerRice = new THREE.Group();
    const innerGeo = makeOmuriceGeometry(OMURICE_LEN * 0.9, OMURICE_WID * 0.87, 0.7, 6.1);
    this.innerRiceMat = createClayMaterial('#e84e24', { normalStrength: 1.0, roughness: 0.88 });
    const innerCore = new THREE.Mesh(innerGeo, this.innerRiceMat);
    innerCore.castShadow = true;
    this.omuriceInnerRice.add(innerCore);

    // Embedded colorful peas & chicken chunks on the right-side cross section
    const peaMat = createClayMaterial('#5aa848', { normalStrength: 0.85 });
    const chMat = createClayMaterial('#c77a46', { normalStrength: 0.85 });
    const innerBits = [
      [0.85, 0.22, 0.12, peaMat],
      [0.72, 0.34, -0.18, chMat],
      [0.92, 0.16, -0.14, peaMat],
      [0.64, 0.28, 0.24, chMat],
      [0.78, 0.18, 0.26, peaMat],
    ];
    innerBits.forEach(([bx, by, bz, mat], idx) => {
      const bit = new THREE.Mesh(makeClayBlob(0.08, 8, 6, { amp: 0.08, seed: 130 + idx }), mat);
      bit.position.set(bx, by, bz);
      this.omuriceInnerRice.add(bit);
    });

    this.omuriceInnerRice.position.set(0, 0.08, 0);
    this.omuriceInnerRice.visible = false;
    this.plateGroup.add(this.omuriceInnerRice);

    this._rebuildOmuriceMesh(0.86);
  }

  _rebuildOmuriceMesh(height) {
    if (this.omuriceMesh) {
      this.plateGroup.remove(this.omuriceMesh);
      this.omuriceMesh.geometry.dispose();
    }
    this.omuriceHeight = height;
    const omuGeo = makeOmuriceGeometry(OMURICE_LEN, OMURICE_WID, height, 4.2);
    const omuMat = createClayMaterial('#f6c12e', {
      normalStrength: 1.0,
      roughness: 0.72,
    });
    this.omuriceMesh = new THREE.Mesh(omuGeo, omuMat);
    this.omuriceMesh.position.set(0, 0.1, 0);
    this.omuriceMesh.castShadow = true;
    this.omuriceMesh.receiveShadow = true;
    this.omuriceMesh.userData = { interact: 'omuriceCanvas' };
    this.plateGroup.add(this.omuriceMesh);
    this.omuriceHitMesh = this.omuriceMesh;
  }

  _buildTools() {
    // 1. Red Clay Ketchup Squeeze Bottle
    {
      const g = new THREE.Group();
      const { bodyGeo, capGeo } = makeClaySqueezeBottle(0.8);
      const body = new THREE.Mesh(
        bodyGeo,
        createClayMaterial('#d93426', { normalStrength: 1.0, roughness: 0.72 })
      );
      body.castShadow = true;
      g.add(body);
      const cap = new THREE.Mesh(
        capGeo,
        createClayMaterial('#f3ebe0', { normalStrength: 0.85, roughness: 0.78 })
      );
      cap.castShadow = true;
      g.add(cap);

      const tom = new THREE.Mesh(
        makeClayBlob(0.11, 8, 6, { amp: 0.05, seed: 3, scaleZ: 0.5 }),
        createClayMaterial('#ff6247', { normalStrength: 0.8 })
      );
      tom.position.set(0, 0.55, 0.33);
      g.add(tom);

      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 1.9, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.9;
      hit.userData = { interact: 'toolKetchup' };
      g.add(hit);

      g.position.copy(this.ketchupHome);
      this.ketchupBottle = g;
      this.toolsGroup.add(g);
    }

    // 2. Creamy Clay Mayo Squeeze Bottle
    {
      const g = new THREE.Group();
      const { bodyGeo, capGeo } = makeClaySqueezeBottle(0.74);
      const body = new THREE.Mesh(
        bodyGeo,
        createClayMaterial('#f5ebd2', { normalStrength: 0.95, roughness: 0.76 })
      );
      body.castShadow = true;
      g.add(body);
      const cap = new THREE.Mesh(
        capGeo,
        createClayMaterial('#e34f44', { normalStrength: 0.85, roughness: 0.74 })
      );
      cap.castShadow = true;
      g.add(cap);

      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 1.8, 10),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.85;
      hit.userData = { interact: 'toolMayo' };
      g.add(hit);

      g.position.copy(this.mayoHome);
      this.mayoBottle = g;
      this.toolsGroup.add(g);
    }

    // 3. Cute Clay Garnish Dish (Star-Cut Carrots & Cheese Hearts!) - neatly outside plate!
    {
      const g = new THREE.Group();
      g.position.set(2.52, 0.0, 0.62);

      const dish = new THREE.Mesh(
        makeClayPuck(0.56, 0.13, 0.05, 18, { amp: 0.028, seed: 71 }),
        createClayMaterial('#f0e4d2', { normalStrength: 0.85 })
      );
      dish.position.y = 0.065;
      dish.castShadow = true;
      dish.receiveShadow = true;
      g.add(dish);

      const starBtn = new THREE.Group();
      starBtn.position.set(-0.18, 0.21, 0.06);
      const starMesh = new THREE.Mesh(makeClayStar(0.21, 0.105, 0.08, 5), this.starMat);
      starMesh.castShadow = true;
      starBtn.add(starMesh);
      const starHit = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 8, 6),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      starHit.userData = { interact: 'toolStar' };
      starBtn.add(starHit);
      g.add(starBtn);
      this.starBtn = starBtn;

      const heartBtn = new THREE.Group();
      heartBtn.position.set(0.2, 0.21, -0.06);
      const heartMesh = new THREE.Mesh(makeClayHeart(0.19, 0.08), this.heartMat);
      heartMesh.rotation.x = -Math.PI / 2;
      heartMesh.castShadow = true;
      heartBtn.add(heartMesh);
      const heartHit = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 8, 6),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      heartHit.userData = { interact: 'toolHeart' };
      heartBtn.add(heartHit);
      g.add(heartBtn);
      this.heartBtn = heartBtn;

      this.garnishDish = g;
      this.toolsGroup.add(g);
    }

    // 4. Folded Soft Clay Napkin (tap to wipe ketchup clean & redraw!)
    {
      const g = new THREE.Group();
      g.position.set(-2.28, 0.0, 1.48);
      g.rotation.y = 0.25;
      const clothGeo = new THREE.BoxGeometry(0.7, 0.13, 0.52, 6, 3, 6);
      sculptClay(clothGeo, { amp: 0.045, freq: 3.5, seed: 77, thumbDents: 2 });
      const cloth = new THREE.Mesh(
        clothGeo,
        createClayMaterial('#9dc4d6', { normalStrength: 0.95, roughness: 0.88 })
      );
      cloth.position.y = 0.065;
      cloth.castShadow = true;
      cloth.receiveShadow = true;
      g.add(cloth);

      const stripe = new THREE.Mesh(
        sculptClay(new THREE.BoxGeometry(0.71, 0.14, 0.11, 4, 2, 2), { amp: 0.025, seed: 78 }),
        createClayMaterial('#f5efe6', { normalStrength: 0.85 })
      );
      stripe.position.set(0, 0.07, 0.11);
      g.add(stripe);

      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.55, 0.85),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.15;
      hit.userData = { interact: 'toolWipe' };
      g.add(hit);

      this.napkinGroup = g;
      this.toolsGroup.add(g);
    }

    // 5. Chunky Brass-Gold Clay Serving Bell (CHIN! -> Serve to Family!)
    {
      const g = new THREE.Group();
      g.position.set(2.46, 0.0, -0.68);

      const base = new THREE.Mesh(
        makeClayPuck(0.5, 0.13, 0.045, 20, { amp: 0.028, seed: 82 }),
        createClayMaterial('#423b38', { normalStrength: 0.85, roughness: 0.78 })
      );
      base.position.y = 0.065;
      base.castShadow = true;
      g.add(base);

      const domeGeo = new THREE.SphereGeometry(0.42, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52);
      sculptClay(domeGeo, { amp: 0.022, freq: 3.0, seed: 83, thumbDents: 2 });
      const dome = new THREE.Mesh(
        domeGeo,
        createGlossyClayMaterial('#ebb53b', { roughness: 0.3, metalness: 0.35, normalStrength: 0.6 })
      );
      dome.position.y = 0.11;
      dome.castShadow = true;
      g.add(dome);

      this.bellPlunger = new THREE.Mesh(
        makeClayPuck(0.13, 0.13, 0.04, 12, { amp: 0.035, seed: 84 }),
        createGlossyClayMaterial('#f7d568', { roughness: 0.28, metalness: 0.35 })
      );
      this.bellPlunger.position.y = 0.56;
      g.add(this.bellPlunger);

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(0.72, 10, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.y = 0.32;
      hit.userData = { interact: 'servingBell' };
      g.add(hit);

      this.bellGroup = g;
      this.toolsGroup.add(g);
    }
  }

  clearDecorations() {
    while (this.garnishGroup.children.length > 0) {
      this.garnishGroup.remove(this.garnishGroup.children[0]);
    }
    this.ketchupBeadCount = 0;
    this.mayoBeadCount = 0;
    this.ketchupInst.count = 0;
    this.mayoInst.count = 0;
    this.strokeCount = 0;
    this.recipe.decorStrokes = 0;
  }

  enter() {
    this.active = true;
    this.group.visible = true;
    this.toolsGroup.visible = true;
    this.idleTimer = 0;
    this.activeTool = 'ketchup';
    this.isDrawing = false;
    this.pointerDownOnPlate = false;
    this.lastDrawPt = null;
    this.currentHoldInfo = null;
    this.holdTime = 0;
    this.bellTapsBeforeDraw = 0;
    this.bellBounce = 0;

    // Reset ALL plate & omurice & decor transforms cleanly (fixes replay bug!)
    this.plateGroup.position.set(0, 0, 0);
    this.plateGroup.rotation.set(0, 0, 0);
    this.plateGroup.scale.setScalar(1);

    this.decorLayer.visible = true;
    this.decorLayer.position.set(0, 0, 0);
    this.decorLayer.scale.setScalar(1);

    const h = 0.82 + Math.max(0, (this.recipe.eggCount || 2) - 1) * 0.08;
    this._rebuildOmuriceMesh(h);
    this.omuriceMesh.visible = true;

    this.omuriceInnerRice.visible = false;
    this.omuriceInnerRice.position.set(0, 0.08, 0);
    this.omuriceInnerRice.scale.setScalar(1);
    this.innerRiceMat.color.set(this.recipe.riceColorHex || '#e84e24');

    this.clearDecorations();

    this.ketchupBottle.position.copy(this.ketchupHome);
    this.ketchupBottle.rotation.set(0, 0.35, 0);
    this.mayoBottle.position.copy(this.mayoHome);
    this.mayoBottle.rotation.set(0, 0.35, 0);
  }

  hideToolsForServing() {
    this.active = false;
    this.isDrawing = false;
    this.pointerDownOnPlate = false;
    this.toolsGroup.visible = false;
  }

  hideAll() {
    this.active = false;
    this.group.visible = false;
  }

  _addInstBead(kind, x, y, z, sx, sy, sz) {
    const isMayo = kind === 'mayo';
    const inst = isMayo ? this.mayoInst : this.ketchupInst;
    const idx = isMayo ? this.mayoBeadCount : this.ketchupBeadCount;
    if (idx >= this.maxInstBeads) return -1;

    this._dummy.position.set(x, y, z);
    this._dummy.rotation.set(0, idx * 0.7, 0);
    this._dummy.scale.set(sx, sy, sz);
    this._dummy.updateMatrix();
    inst.setMatrixAt(idx, this._dummy.matrix);
    inst.count = idx + 1;
    inst.instanceMatrix.needsUpdate = true;

    if (isMayo) this.mayoBeadCount++;
    else this.ketchupBeadCount++;
    return idx;
  }

  _placeDrawingPoint(localX, localZ, isFirst) {
    const surfY = sampleOmuriceSurface(localX, localZ, OMURICE_LEN, OMURICE_WID, this.omuriceHeight);
    if (surfY === null) return;

    const pt = new THREE.Vector3(localX, surfY + 0.125, localZ);

    if (this.activeTool === 'star' || this.activeTool === 'heart') {
      if (!isFirst) return;
      if (this.garnishGroup.children.length >= 28) return;
      const mesh = new THREE.Mesh(
        this.activeTool === 'star' ? this.starGeo : this.heartGeo,
        this.activeTool === 'star' ? this.starMat : this.heartMat
      );
      mesh.position.copy(pt);
      mesh.rotation.set(
        this.activeTool === 'heart' ? -Math.PI / 2 + localZ * 0.38 : localZ * 0.38,
        Math.random() * 0.6 - 0.3,
        -localX * 0.28
      );
      mesh.castShadow = true;
      this.garnishGroup.add(mesh);
      this.strokeCount++;
      this.recipe.decorStrokes = this.strokeCount;
      audio.playPop(this.activeTool === 'star' ? 1.25 : 1.05);
      return;
    }

    const kind = this.activeTool === 'mayo' ? 'mayo' : 'ketchup';

    if (!isFirst && this.lastDrawPt) {
      const dist = pt.distanceTo(this.lastDrawPt);
      if (dist < 0.038) return;

      // Dense overlapping smooth squeezed clay ketchup ribbon along curved dome!
      const steps = Math.min(10, Math.ceil(dist / 0.042));
      let lastIdx = -1;
      for (let s = 1; s <= steps; s++) {
        const frac = s / steps;
        const ix = THREE.MathUtils.lerp(this.lastDrawPt.x, pt.x, frac);
        const iz = THREE.MathUtils.lerp(this.lastDrawPt.z, pt.z, frac);
        const iy = sampleOmuriceSurface(ix, iz, OMURICE_LEN, OMURICE_WID, this.omuriceHeight);
        if (iy === null) continue;
        lastIdx = this._addInstBead(kind, ix, iy + 0.12, iz, 1.04, 0.72, 1.04);
      }
      if (lastIdx >= 0) {
        this.currentHoldInfo = { kind, idx: lastIdx, pos: pt.clone() };
      }
      audio.playKetchupDrawTick(dist * 12, kind === 'mayo');
      this.lastDrawPt.copy(pt);
      this.holdTime = 0;
    } else {
      const idx = this._addInstBead(kind, pt.x, pt.y, pt.z, 1.1, 0.76, 1.1);
      if (idx >= 0) {
        this.currentHoldInfo = { kind, idx, pos: pt.clone() };
      }
      this.strokeCount++;
      this.recipe.decorStrokes = this.strokeCount;
      this.lastDrawPt = pt.clone();
      this.holdTime = 0;
      audio.playKetchupSquirt(kind === 'mayo' ? 1.2 : 1.0);
    }

    this.activeBottleTarget.set(pt.x, pt.y + 1.52, pt.z);
  }

  onPointerDown(hit) {
    if (!this.active) return false;
    this.idleTimer = 0;

    if (!hit) return false;
    const kind = hit.object.userData?.interact;

    if (kind === 'toolKetchup') {
      this.activeTool = 'ketchup';
      audio.playPop(0.95);
      return true;
    }
    if (kind === 'toolMayo') {
      this.activeTool = 'mayo';
      audio.playPop(1.18);
      return true;
    }
    if (kind === 'toolStar') {
      this.activeTool = 'star';
      audio.playPop(1.3);
      return true;
    }
    if (kind === 'toolHeart') {
      this.activeTool = 'heart';
      audio.playPop(1.1);
      return true;
    }
    if (kind === 'toolWipe') {
      this.clearDecorations();
      audio.playWipe();
      return true;
    }
    if (kind === 'servingBell') {
      audio.playBell();
      this.bellBounce = 1.0;
      if (this.strokeCount >= 1 || this.bellTapsBeforeDraw >= 1) {
        if (this.onServe) this.onServe();
      } else {
        this.bellTapsBeforeDraw++;
        this.idleTimer = 7.2;
      }
      return true;
    }
    if (kind === 'omuriceCanvas') {
      const localPt = this.plateGroup.worldToLocal(hit.point.clone());
      this.isDrawing = true;
      this.pointerDownOnPlate = true;
      this._placeDrawingPoint(localPt.x, localPt.z, true);
      return true;
    }
    if (kind === 'plateSurface') {
      // Allow starting a stroke on the plate edge and gliding seamlessly onto the omurice!
      this.pointerDownOnPlate = true;
      return true;
    }
    return false;
  }

  onPointerMove(hit) {
    if (!this.active || !this.pointerDownOnPlate) return;
    this.idleTimer = 0;
    if (hit && hit.object.userData?.interact === 'omuriceCanvas') {
      const localPt = this.plateGroup.worldToLocal(hit.point.clone());
      const first = !this.isDrawing;
      this.isDrawing = true;
      this._placeDrawingPoint(localPt.x, localPt.z, first);
    }
  }

  onPointerUp() {
    this.isDrawing = false;
    this.pointerDownOnPlate = false;
    this.lastDrawPt = null;
    this.currentHoldInfo = null;
    this.holdTime = 0;
  }

  update(dt, elapsed, stopMotionStep) {
    if (!this.active) return;
    this.idleTimer += dt;

    // 1. Press-and-hold ketchup/mayo puff inflation discovery!
    if (this.isDrawing && this.currentHoldInfo && (this.activeTool === 'ketchup' || this.activeTool === 'mayo')) {
      this.holdTime += dt;
      if (this.holdTime > 0.14 && this.holdTime < 1.1) {
        const s = 1.1 + (this.holdTime - 0.14) * 1.45;
        const { kind, idx, pos } = this.currentHoldInfo;
        const inst = kind === 'mayo' ? this.mayoInst : this.ketchupInst;
        this._dummy.position.copy(pos);
        this._dummy.rotation.set(0, idx * 0.7, 0);
        this._dummy.scale.set(s, s * 0.72, s);
        this._dummy.updateMatrix();
        inst.setMatrixAt(idx, this._dummy.matrix);
        inst.instanceMatrix.needsUpdate = true;
      }
    }

    // 2. Animate Ketchup & Mayo bottles
    const animBottle = (bottle, home, toolName) => {
      const isSelected = this.activeTool === toolName;
      if (isSelected && this.isDrawing) {
        bottle.position.lerp(this.activeBottleTarget, Math.min(1, dt * 24));
        bottle.rotation.z += (Math.PI - bottle.rotation.z) * Math.min(1, dt * 18);
        bottle.rotation.x += (0.18 - bottle.rotation.x) * Math.min(1, dt * 18);
        const sq = Math.sin(elapsed * 22) * 0.07;
        bottle.scale.set(0.92 - sq, 1.06 + sq, 0.92 - sq);
      } else {
        const lift = isSelected ? 0.24 : 0;
        let idleHop = 0;
        if (toolName === 'ketchup' && this.strokeCount === 0 && this.idleTimer > 7.0) {
          idleHop = Math.max(0, Math.sin((this.idleTimer - 7.0) * 5.2)) * 0.16;
        }
        const target = new THREE.Vector3(home.x, home.y + lift + idleHop, home.z);
        bottle.position.lerp(target, Math.min(1, dt * 10));
        const tiltZ = isSelected ? -0.2 : 0;
        bottle.rotation.z += (tiltZ - bottle.rotation.z) * Math.min(1, dt * 10);
        bottle.rotation.x += (0 - bottle.rotation.x) * Math.min(1, dt * 10);
        bottle.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 10));
      }
    };

    animBottle(this.ketchupBottle, this.ketchupHome, 'ketchup');
    animBottle(this.mayoBottle, this.mayoHome, 'mayo');

    this.starBtn.position.y = THREE.MathUtils.lerp(
      this.starBtn.position.y,
      this.activeTool === 'star' ? 0.36 : 0.21,
      dt * 12
    );
    this.heartBtn.position.y = THREE.MathUtils.lerp(
      this.heartBtn.position.y,
      this.activeTool === 'heart' ? 0.36 : 0.21,
      dt * 12
    );

    // 3. Serving bell subtle invitation once child has drawn something!
    if (this.bellBounce > 0) {
      this.bellBounce = Math.max(0, this.bellBounce - dt * 3.5);
      this.bellPlunger.position.y = 0.56 - Math.sin(this.bellBounce * Math.PI) * 0.12;
      this.bellGroup.scale.set(
        1 + Math.sin(this.bellBounce * Math.PI) * 0.1,
        1 - Math.sin(this.bellBounce * Math.PI) * 0.08,
        1 + Math.sin(this.bellBounce * Math.PI) * 0.1
      );
    } else if (this.strokeCount >= 1) {
      const b = Math.max(0, Math.sin(stopMotionStep * 0.48)) * 0.045;
      this.bellGroup.position.y = b;
      this.bellGroup.scale.set(1 + b * 0.4, 1 - b * 0.4, 1 + b * 0.4);
    } else {
      this.bellGroup.position.y = 0;
      this.bellGroup.scale.setScalar(1);
    }
  }
}
