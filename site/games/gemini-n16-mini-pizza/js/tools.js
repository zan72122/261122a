import * as THREE from 'three';
import {
  createCeramicTexture,
  createTomatoSauceBowlTexture,
  createPepperoniTexture,
  createMushroomTexture,
  createBasilTexture,
  createCherryTomatoTexture,
  createWoodTextures
} from './textures.js';

export const TOPPING_DEFS = [
  { id: 'cheese', bowlColor: '#ece4d5', seed: 11 },
  { id: 'pepperoni', bowlColor: '#4c5b69', seed: 22 },
  { id: 'tomato', bowlColor: '#7a947a', seed: 33 },
  { id: 'corn', bowlColor: '#3d5478', seed: 44 },
  { id: 'mushroom', bowlColor: '#ccb79c', seed: 55 },
  { id: 'basil', bowlColor: '#b86144', seed: 66 }
];

export function createTools(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const woodTex = createWoodTextures({
    baseColor: '#d1a26c',
    grainColor: '#986a3a',
    highlightColor: '#e8c493',
    planks: 2,
    seed: 88,
    size: 256
  });
  const beechMat = new THREE.MeshStandardMaterial({
    map: woodTex.map,
    roughness: 0.62,
    metalness: 0.02
  });
  const walnutMat = new THREE.MeshStandardMaterial({
    color: 0x5c361f,
    roughness: 0.56,
    metalness: 0.04
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xdcdde0,
    roughness: 0.2,
    metalness: 0.88
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd9a84c,
    roughness: 0.28,
    metalness: 0.82
  });

  // =========================================================
  // 1. Wooden Rolling Pin (めん棒)
  // =========================================================
  const rollingPin = new THREE.Group();
  rollingPin.position.set(1.12, 0.26, 1.05);
  rollingPin.rotation.y = -0.58;
  group.add(rollingPin);

  const pinBarrel = new THREE.Group();
  rollingPin.add(pinBarrel);

  const barrelMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.115, 1.02, 20),
    beechMat
  );
  barrelMesh.rotation.z = Math.PI / 2;
  barrelMesh.castShadow = true;
  barrelMesh.receiveShadow = true;
  pinBarrel.add(barrelMesh);

  // Turned wooden end caps & handles
  [-1, 1].forEach((side) => {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, 0.09, 16), beechMat);
    collar.rotation.z = side * (Math.PI / 2);
    collar.position.x = side * 0.54;
    pinBarrel.add(collar);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.34, 14), walnutMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.x = side * 0.72;
    handle.castShadow = true;
    pinBarrel.add(handle);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), walnutMat);
    tip.position.x = side * 0.89;
    pinBarrel.add(tip);
  });

  // =========================================================
  // 2. Terracotta Tomato Sauce Crock & Wooden Ladle
  // =========================================================
  const sauceCrock = new THREE.Group();
  sauceCrock.position.set(2.35, 0, -0.82);
  group.add(sauceCrock);

  const crockMat = new THREE.MeshStandardMaterial({
    map: createCeramicTexture('#e6d9c5', 71),
    roughness: 0.36,
    metalness: 0.05
  });
  const crockPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.32, 0),
    new THREE.Vector2(0.45, 0.22),
    new THREE.Vector2(0.46, 0.44),
    new THREE.Vector2(0.41, 0.49),
    new THREE.Vector2(0.37, 0.45),
    new THREE.Vector2(0.35, 0.14),
    new THREE.Vector2(0, 0.1)
  ];
  const crockMesh = new THREE.Mesh(new THREE.LatheGeometry(crockPts, 24), crockMat);
  crockMesh.castShadow = true;
  crockMesh.receiveShadow = true;
  sauceCrock.add(crockMesh);

  // Hand-painted terracotta stoneware rim lip so ruby sauce stands out sharply!
  const crockRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.425, 0.024, 10, 28),
    new THREE.MeshStandardMaterial({ color: 0xa44b2f, roughness: 0.35 })
  );
  crockRim.rotation.x = Math.PI / 2;
  crockRim.position.y = 0.468;
  sauceCrock.add(crockRim);

  const sauceSurfaceMat = new THREE.MeshPhysicalMaterial({
    map: createTomatoSauceBowlTexture(),
    roughness: 0.2,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12
  });
  const saucePool = new THREE.Mesh(new THREE.CircleGeometry(0.39, 24), sauceSurfaceMat);
  saucePool.rotation.x = -Math.PI / 2;
  saucePool.position.y = 0.39;
  sauceCrock.add(saucePool);

  // Wooden Ladle (detaches smoothly to swirl over the pizza in Stage 2!)
  const ladle = new THREE.Group();
  group.add(ladle);

  const ladleCup = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55),
    beechMat
  );
  ladleCup.castShadow = true;
  ladle.add(ladleCup);

  const ladleSauce = new THREE.Mesh(new THREE.CircleGeometry(0.145, 16), sauceSurfaceMat);
  ladleSauce.rotation.x = -Math.PI / 2;
  ladleSauce.position.y = -0.02;
  ladle.add(ladleSauce);

  const ladleStick = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.92, 12), beechMat);
  ladleStick.position.set(0.28, 0.36, 0);
  ladleStick.rotation.z = -0.66;
  ladleStick.castShadow = true;
  ladle.add(ladleStick);

  // =========================================================
  // 3. 6 Glazed Stoneware Ceramic Topping Bowls
  // =========================================================
  const bowlsGroup = new THREE.Group();
  group.add(bowlsGroup);

  const bowlPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.26, 0),
    new THREE.Vector2(0.41, 0.16),
    new THREE.Vector2(0.44, 0.32),
    new THREE.Vector2(0.39, 0.32),
    new THREE.Vector2(0.34, 0.12),
    new THREE.Vector2(0, 0.08)
  ];
  const bowlLatheGeo = new THREE.LatheGeometry(bowlPts, 24);

  const pepTex = createPepperoniTexture();
  const mushTex = createMushroomTexture();
  const basilTex = createBasilTexture();
  const tomatoTex = createCherryTomatoTexture();

  const toppingBowls = [];
  for (let i = 0; i < TOPPING_DEFS.length; i++) {
    const def = TOPPING_DEFS[i];
    const bGroup = new THREE.Group();
    bowlsGroup.add(bGroup);

    const ceramicMat = new THREE.MeshStandardMaterial({
      map: createCeramicTexture(def.bowlColor, def.seed),
      roughness: 0.32,
      metalness: 0.05
    });
    const bMesh = new THREE.Mesh(bowlLatheGeo, ceramicMat);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    bGroup.add(bMesh);

    // Fill each bowl with appetizing miniature 3D ingredients!
    const fillGrp = new THREE.Group();
    fillGrp.position.y = 0.22;
    bGroup.add(fillGrp);
    _populateBowlContents(fillGrp, def.id, pepTex, mushTex, basilTex, tomatoTex);

    toppingBowls.push({
      id: def.id,
      index: i,
      group: bGroup,
      targetPos: new THREE.Vector3(),
      restY: 0,
      wobble: 0,
      selected: false
    });
  }

  // Floating 3D preview when dragging a topping from a bowl onto the pizza
  const dragPreview = new THREE.Group();
  dragPreview.visible = false;
  group.add(dragPreview);
  const previewMeshes = {};
  for (const def of TOPPING_DEFS) {
    const pGrp = new THREE.Group();
    _populateBowlContents(pGrp, def.id, pepTex, mushTex, basilTex, tomatoTex, true);
    pGrp.visible = false;
    dragPreview.add(pGrp);
    previewMeshes[def.id] = pGrp;
  }

  // =========================================================
  // 4. Wooden Pizza Peel (木のヘラ / ピザピール)
  // =========================================================
  const pizzaPeel = new THREE.Group();
  pizzaPeel.position.set(2.3, 0.05, 1.85);
  pizzaPeel.rotation.y = 0.15;
  group.add(pizzaPeel);

  const peelBladeShape = new THREE.Shape();
  peelBladeShape.moveTo(-0.98, -0.75);
  peelBladeShape.lineTo(0.98, -0.75);
  peelBladeShape.quadraticCurveTo(1.18, -0.75, 1.18, 0.25);
  peelBladeShape.quadraticCurveTo(1.18, 1.05, 0.22, 1.18);
  peelBladeShape.lineTo(-0.22, 1.18);
  peelBladeShape.quadraticCurveTo(-1.18, 1.05, -1.18, 0.25);
  peelBladeShape.quadraticCurveTo(-1.18, -0.75, -0.98, -0.75);

  const peelGeo = new THREE.ExtrudeGeometry(peelBladeShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.016,
    bevelSegments: 2
  });
  peelGeo.rotateX(Math.PI / 2);
  const pUv = peelGeo.attributes.uv;
  for (let i = 0; i < pUv.count; i++) {
    pUv.setXY(i, pUv.getX(i) * 0.42 + 0.5, pUv.getY(i) * 0.42 + 0.5);
  }
  const peelBlade = new THREE.Mesh(peelGeo, beechMat);
  peelBlade.position.y = 0.04;
  peelBlade.castShadow = true;
  peelBlade.receiveShadow = true;
  pizzaPeel.add(peelBlade);

  const peelHandle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.055, 1.48), beechMat);
  peelHandle.position.set(0, 0.035, 1.85);
  peelHandle.castShadow = true;
  peelHandle.receiveShadow = true;
  pizzaPeel.add(peelHandle);

  // =========================================================
  // 5. Miniature Stainless-Steel Rotary Pizza Cutter
  // =========================================================
  const pizzaCutter = new THREE.Group();
  pizzaCutter.visible = false;
  group.add(pizzaCutter);

  // Wheel sits right at y = 0.19 so bottom edge touches the pizza cleanly
  const cutterWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.018, 28), steelMat);
  cutterWheel.rotation.z = Math.PI / 2;
  cutterWheel.position.y = 0.21;
  cutterWheel.castShadow = true;
  pizzaCutter.add(cutterWheel);

  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.042, 14), brassMat);
  wheelHub.rotation.z = Math.PI / 2;
  wheelHub.position.y = 0.21;
  pizzaCutter.add(wheelHub);

  // Fork neck + turned walnut handle angled up for gripping!
  const cutterArm = new THREE.Group();
  cutterArm.position.set(0, 0.21, 0);
  cutterArm.rotation.x = -0.68;
  pizzaCutter.add(cutterArm);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.3, 12), steelMat);
  neck.position.y = 0.22;
  cutterArm.add(neck);

  const bolster = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.055, 0.06, 14), brassMat);
  bolster.position.y = 0.37;
  cutterArm.add(bolster);

  const cHandle = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.56, 8, 14), walnutMat);
  cHandle.position.y = 0.72;
  cHandle.castShadow = true;
  cutterArm.add(cHandle);

  // Subtle dashed score-guide marks? NO! Remember wordless rules: zero arrows/synthetic HUD lines.
  // Instead, the cutter itself gently bobs and gleams on the right edge of the hot pizza!

  return {
    group,
    rollingPin,
    pinBarrel,
    sauceCrock,
    ladle,
    bowlsGroup,
    toppingBowls,
    dragPreview,
    previewMeshes,
    pizzaPeel,
    pizzaCutter,
    cutterWheel,
    setDragPreview(type) {
      if (!type) {
        dragPreview.visible = false;
        return;
      }
      dragPreview.visible = true;
      for (const k of Object.keys(previewMeshes)) {
        previewMeshes[k].visible = k === type;
      }
    },
    layoutBowls(stage, isPortrait) {
      // Stage-driven proximity: active bowls glide closer into easy reach; inactive sit neatly back!
      const isToppingStage = stage === 'TOPPINGS';
      const isDining = stage === 'CUTTING' || stage === 'SERVING';

      for (let i = 0; i < toppingBowls.length; i++) {
        const b = toppingBowls[i];
        const scale = isPortrait ? 0.88 : 1.0;
        b.group.scale.setScalar(scale);
        if (isDining) {
          // Neatly tucked offstage during family dining so plates & family are stars!
          const side = i < 3 ? -1 : 1;
          b.targetPos.set(side * 5.6, 0, -0.5 + (i % 3) * 0.9);
          b.restY = 0;
        } else if (isPortrait) {
          // Portrait iPhone: 2 ergonomic rows of 3 bowls cleanly framed inside viewport!
          const row = Math.floor(i / 3);
          const col = i % 3;
          const x = (col - 1) * 0.94;
          const z = isToppingStage ? 2.12 + row * 0.92 : 3.6 + row * 0.92;
          b.targetPos.set(x, 0, z);
          b.restY = 0;
        } else {
          // Landscape iPad / Desktop: 3 bowls on left, 3 bowls on right cleanly above peel!
          const side = i < 3 ? -1 : 1;
          const row = i % 3;
          const x = side * (isToppingStage ? 2.02 : 2.95);
          const z = -0.62 + row * 0.82;
          b.targetPos.set(x, 0, z);
          b.restY = 0;
        }
      }
    },
    update(dt, elapsed) {
      const k = 1 - Math.exp(-dt * 8.5);
      for (const b of toppingBowls) {
        b.wobble = Math.max(0, b.wobble - dt * 4.5);
        const lift = b.selected ? 0.16 + Math.sin(elapsed * 5) * 0.025 : 0;
        b.group.position.x = THREE.MathUtils.lerp(b.group.position.x, b.targetPos.x, k);
        b.group.position.z = THREE.MathUtils.lerp(b.group.position.z, b.targetPos.z, k);
        b.group.position.y = THREE.MathUtils.lerp(b.group.position.y, b.restY + lift, k);

        const wob = Math.sin(b.wobble * Math.PI * 5) * b.wobble * 0.14;
        b.group.rotation.z = wob;
        b.group.rotation.x = b.selected ? 0.14 : 0;
      }
    }
  };
}

function _populateBowlContents(parent, type, pepTex, mushTex, basilTex, tomatoTex, isSinglePreview = false) {
  if (type === 'cheese') {
    const mat = new THREE.MeshStandardMaterial({ color: 0xfff5d4, roughness: 0.72 });
    const geo = new THREE.CapsuleGeometry(0.015, 0.095, 4, 6);
    geo.rotateZ(Math.PI / 2);
    const n = isSinglePreview ? 7 : 48;
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996;
      const r = isSinglePreview ? (i / n) * 0.1 : Math.sqrt(i / n) * 0.29;
      const m = new THREE.Mesh(geo, mat);
      m.position.set(Math.cos(a) * r, (isSinglePreview ? 0.02 : 0.02 + (1 - r / 0.31) * 0.14), Math.sin(a) * r);
      m.rotation.set(Math.sin(i) * 0.45, i * 1.1, Math.cos(i) * 0.35);
      parent.add(m);
    }
  } else if (type === 'pepperoni') {
    const mat = new THREE.MeshStandardMaterial({ map: pepTex, roughness: 0.45 });
    const geo = new THREE.CylinderGeometry(0.14, 0.14, 0.022, 16);
    const n = isSinglePreview ? 1 : 9;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, mat);
      if (isSinglePreview) {
        m.position.set(0, 0.02, 0);
      } else {
        const a = (i / n) * Math.PI * 2;
        const r = i === 0 ? 0 : 0.14;
        m.position.set(Math.cos(a) * r, 0.02 + i * 0.014, Math.sin(a) * r);
        m.rotation.set(Math.sin(a) * 0.25, a, Math.cos(a) * 0.25);
      }
      parent.add(m);
    }
  } else if (type === 'tomato') {
    const skin = new THREE.MeshStandardMaterial({ color: 0xc21f16, roughness: 0.2 });
    const inside = new THREE.MeshPhysicalMaterial({
      map: tomatoTex,
      roughness: 0.2,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14
    });
    const bodyGeo = new THREE.CylinderGeometry(0.112, 0.082, 0.052, 14);
    const cutGeo = new THREE.CircleGeometry(0.106, 14);
    cutGeo.rotateX(-Math.PI / 2);
    const n = isSinglePreview ? 1 : 8;
    for (let i = 0; i < n; i++) {
      const grp = new THREE.Group();
      const d = new THREE.Mesh(bodyGeo, skin);
      d.position.y = 0.026;
      grp.add(d);
      const c = new THREE.Mesh(cutGeo, inside);
      c.position.y = 0.0535;
      grp.add(c);
      if (!isSinglePreview) {
        const a = i * 2.1;
        const r = i === 0 ? 0 : 0.14 + (i % 2) * 0.06;
        grp.position.set(Math.cos(a) * r, 0.02 + (i < 2 ? 0.06 : 0), Math.sin(a) * r);
        grp.rotation.set(Math.sin(i) * 0.32, a, Math.cos(i) * 0.28);
      }
      parent.add(grp);
    }
  } else if (type === 'corn') {
    const mat = new THREE.MeshStandardMaterial({ color: 0xf7ca36, roughness: 0.26 });
    const geo = new THREE.SphereGeometry(0.044, 7, 6);
    geo.scale(1.15, 0.75, 0.92);
    const n = isSinglePreview ? 5 : 34;
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996;
      const r = isSinglePreview ? (i / n) * 0.09 : Math.sqrt(i / n) * 0.29;
      const m = new THREE.Mesh(geo, mat);
      m.position.set(Math.cos(a) * r, isSinglePreview ? 0.02 : 0.03 + (1 - r / 0.32) * 0.11, Math.sin(a) * r);
      m.rotation.set(i, i * 0.7, 0);
      parent.add(m);
    }
  } else if (type === 'mushroom') {
    const mat = new THREE.MeshStandardMaterial({ map: mushTex, roughness: 0.78 });
    const mShape = new THREE.Shape();
    mShape.moveTo(-0.042, -0.1);
    mShape.lineTo(0.042, -0.1);
    mShape.quadraticCurveTo(0.05, -0.02, 0.115, -0.01);
    mShape.absarc(0, 0.02, 0.115, -0.2, Math.PI + 0.2, false);
    mShape.quadraticCurveTo(-0.05, -0.02, -0.042, -0.1);
    const geo = new THREE.ExtrudeGeometry(mShape, { depth: 0.022, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const mPos = geo.attributes.position;
    const mUv = geo.attributes.uv;
    for (let i = 0; i < mPos.count; i++) {
      mUv.setXY(i, (mPos.getX(i) + 0.125) / 0.25, 1 - (mPos.getZ(i) + 0.14) / 0.25);
    }
    const n = isSinglePreview ? 1 : 9;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, mat);
      if (!isSinglePreview) {
        const a = i * 1.9;
        const r = i === 0 ? 0 : 0.14;
        m.position.set(Math.cos(a) * r, 0.02 + i * 0.014, Math.sin(a) * r);
        m.rotation.set(Math.sin(i) * 0.35, a, Math.cos(i) * 0.3);
      }
      parent.add(m);
    }
  } else if (type === 'basil') {
    const mat = new THREE.MeshStandardMaterial({ map: basilTex, roughness: 0.56, side: THREE.DoubleSide });
    const bShape = new THREE.Shape();
    bShape.moveTo(0, -0.11);
    bShape.bezierCurveTo(0.11, -0.05, 0.1, 0.07, 0, 0.14);
    bShape.bezierCurveTo(-0.1, 0.07, -0.11, -0.05, 0, -0.11);
    const geo = new THREE.ShapeGeometry(bShape, 6);
    geo.rotateX(-Math.PI / 2);
    const bPos = geo.attributes.position;
    const bUv = geo.attributes.uv;
    for (let i = 0; i < bPos.count; i++) {
      bUv.setXY(i, (bPos.getX(i) + 0.11) / 0.22, (bPos.getZ(i) + 0.14) / 0.26);
    }
    const n = isSinglePreview ? 1 : 10;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, mat);
      if (!isSinglePreview) {
        const a = (i / n) * Math.PI * 2;
        const r = i < 2 ? 0.03 : 0.15;
        m.position.set(Math.cos(a) * r, 0.06 + (i % 3) * 0.04, Math.sin(a) * r);
        m.rotation.set(0.35, -a, 0.25);
      }
      parent.add(m);
    }
  }
}

// =========================================================
// Pooled Lightweight Miniature Particle System
// =========================================================
export class ParticleSystem {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pool = [];
    this.spritePool = [];

    // Soft feathered wispy cloud texture for authentic photographic flour clouds & curling pizza steam!
    const puffCanvas = document.createElement('canvas');
    puffCanvas.width = 64;
    puffCanvas.height = 64;
    const pCtx = puffCanvas.getContext('2d');
    const wisps = [
      { x: 32, y: 34, r: 22, a: 0.55 },
      { x: 24, y: 28, r: 17, a: 0.42 },
      { x: 40, y: 26, r: 16, a: 0.4 },
      { x: 32, y: 20, r: 14, a: 0.32 }
    ];
    for (const w of wisps) {
      const g = pCtx.createRadialGradient(w.x, w.y, 1, w.x, w.y, w.r);
      g.addColorStop(0, `rgba(255,252,246,${w.a})`);
      g.addColorStop(0.55, `rgba(255,251,244,${w.a * 0.45})`);
      g.addColorStop(1, 'rgba(255,251,244,0)');
      pCtx.fillStyle = g;
      pCtx.fillRect(0, 0, 64, 64);
    }
    const puffTex = new THREE.CanvasTexture(puffCanvas);

    this.spriteMats = {
      flour: new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0.36, depthWrite: false }),
      steam: new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0.2, depthWrite: false })
    };

    for (let i = 0; i < 42; i++) {
      const sp = new THREE.Sprite(this.spriteMats.steam);
      sp.visible = false;
      this.group.add(sp);
      this.spritePool.push({
        sprite: sp,
        active: false,
        type: 'steam',
        vel: new THREE.Vector3(),
        age: 0,
        life: 1,
        gravity: 0,
        startScale: 0.25,
        endScale: 0.75
      });
    }

    const sphereGeo = new THREE.SphereGeometry(0.048, 8, 6);
    const crumbGeo = new THREE.DodecahedronGeometry(0.032, 0);

    this.mats = {
      sauce: new THREE.MeshBasicMaterial({ color: 0xc92519, transparent: true, opacity: 0.92 }),
      spark: new THREE.MeshBasicMaterial({ color: 0xffb338, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      crumb: new THREE.MeshStandardMaterial({ color: 0xd99b4e, roughness: 0.85 }),
      joy: new THREE.MeshBasicMaterial({ color: 0xffe478, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
    };

    this.geos = {
      sauce: sphereGeo,
      spark: sphereGeo,
      crumb: crumbGeo,
      joy: crumbGeo
    };

    for (let i = 0; i < 55; i++) {
      const m = new THREE.Mesh(sphereGeo, this.mats.crumb);
      m.visible = false;
      this.group.add(m);
      this.pool.push({
        mesh: m,
        active: false,
        type: 'crumb',
        vel: new THREE.Vector3(),
        age: 0,
        life: 1,
        gravity: 0,
        startScale: 1,
        endScale: 1
      });
    }
  }

  clear() {
    for (const p of this.spritePool) {
      p.active = false;
      p.sprite.visible = false;
    }
    for (const p of this.pool) {
      p.active = false;
      p.mesh.visible = false;
    }
  }

  emit(type, pos, count = 6, spread = 0.25) {
    if (type === 'flour' || type === 'steam') {
      let spawned = 0;
      for (const p of this.spritePool) {
        if (p.active) continue;
        p.active = true;
        p.type = type;
        p.age = 0;
        p.sprite.material = this.spriteMats[type];
        p.sprite.visible = true;
        p.sprite.position.set(
          pos.x + (Math.random() - 0.5) * spread,
          pos.y + Math.random() * spread * 0.4,
          pos.z + (Math.random() - 0.5) * spread
        );
        if (type === 'flour') {
          p.life = 0.48 + Math.random() * 0.28;
          p.vel.set((Math.random() - 0.5) * 0.9, 0.42 + Math.random() * 0.45, (Math.random() - 0.5) * 0.9);
          p.gravity = -0.9;
          p.startScale = 0.14;
          p.endScale = 0.38;
        } else {
          p.life = 1.15 + Math.random() * 0.55;
          p.vel.set((Math.random() - 0.5) * 0.16, 0.55 + Math.random() * 0.28, (Math.random() - 0.5) * 0.16);
          p.gravity = 0.06;
          p.startScale = 0.18;
          p.endScale = 0.58;
        }
        p.sprite.scale.setScalar(p.startScale);
        spawned++;
        if (spawned >= count) break;
      }
      return;
    }

    let spawned = 0;
    for (const p of this.pool) {
      if (p.active) continue;
      p.active = true;
      p.type = type;
      p.age = 0;
      p.mesh.geometry = this.geos[type] || this.geos.crumb;
      p.mesh.material = this.mats[type] || this.mats.crumb;
      p.mesh.visible = true;
      p.mesh.position.set(
        pos.x + (Math.random() - 0.5) * spread,
        pos.y + Math.random() * spread * 0.4,
        pos.z + (Math.random() - 0.5) * spread
      );

      if (type === 'sauce') {
        p.life = 0.38 + Math.random() * 0.2;
        p.vel.set((Math.random() - 0.5) * 1.1, 0.9 + Math.random() * 0.6, (Math.random() - 0.5) * 1.1);
        p.gravity = -4.2;
        p.startScale = 0.48;
        p.endScale = 0.18;
      } else if (type === 'spark') {
        p.life = 0.6 + Math.random() * 0.55;
        p.vel.set((Math.random() - 0.5) * 1.2, 1.3 + Math.random() * 1.5, 0.5 + Math.random() * 0.9);
        p.gravity = -0.8;
        p.startScale = 0.48;
        p.endScale = 0.05;
      } else if (type === 'crumb') {
        p.life = 0.5 + Math.random() * 0.3;
        p.vel.set((Math.random() - 0.5) * 1.4, 1.1 + Math.random() * 0.9, (Math.random() - 0.5) * 1.4);
        p.gravity = -4.8;
        p.startScale = 0.75;
        p.endScale = 0.35;
      } else if (type === 'joy') {
        p.life = 0.75 + Math.random() * 0.35;
        p.vel.set((Math.random() - 0.5) * 1.0, 1.3 + Math.random() * 0.8, (Math.random() - 0.5) * 1.0);
        p.gravity = -0.9;
        p.startScale = 0.8;
        p.endScale = 0.1;
      }

      p.mesh.scale.setScalar(p.startScale);
      spawned++;
      if (spawned >= count) break;
    }
  }

  update(dt) {
    for (const p of this.spritePool) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }
      const t = p.age / p.life;
      p.vel.y += p.gravity * dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      const s = THREE.MathUtils.lerp(p.startScale, p.endScale, t) * Math.sin((1 - t * 0.75) * Math.PI * 0.5);
      p.sprite.scale.setScalar(Math.max(0.01, s));
    }

    for (const p of this.pool) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      const t = p.age / p.life;
      p.vel.y += p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.04) {
        p.mesh.position.y = 0.04;
        p.vel.multiplyScalar(0.5);
      }
      const s = THREE.MathUtils.lerp(p.startScale, p.endScale, t) * (1 - Math.pow(t, 3));
      p.mesh.scale.setScalar(Math.max(0.01, s));
      p.mesh.rotation.x += dt * 3;
      p.mesh.rotation.y += dt * 4;
    }
  }
}
