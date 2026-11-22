import * as THREE from '../vendor/three.module.js';
import {
  COOKIE_SHAPES,
  DOUGH_FLAVORS,
  createCookieShape,
  createCookiePath,
  createScallopedShape,
  createRoundedRectShape,
  extrudePaperFlat,
  buildCookieCutterMesh,
} from './shapes.js';

export const ICING_COLORS = [
  { id: 'pink',      hex: '#f26d85' },
  { id: 'white',     hex: '#fffaf0' },
  { id: 'mint',      hex: '#5fd0b8' },
  { id: 'lemon',     hex: '#ffd24c' },
  { id: 'choco',     hex: '#6b3e2e' },
  { id: 'rainbow',   hex: '#f26d85', rainbow: true },
];

export const TOPPING_TYPES = [
  { id: 'sprinkles',  cupColor: '#ffca5c' },
  { id: 'strawberry', cupColor: '#f26d85' },
  { id: 'starheart',  cupColor: '#8d7ae6' },
  { id: 'pearls',     cupColor: '#67c8d6' },
  { id: 'rosette',    cupColor: '#f5a5b8' },
];

// 1. Scalloped Parchment Sheet pinned with cut-paper tape
export function createParchmentSheet(mats) {
  const group = new THREE.Group();
  const sheetShape = createRoundedRectShape(4.45, 3.45, 0.28);
  const sheetGeo = extrudePaperFlat(sheetShape, 0.018, 0.004);
  const sheet = new THREE.Mesh(sheetGeo, mats.layered('#fffbf2', 0.3));
  sheet.receiveShadow = true;
  group.add(sheet);

  // Subtle decorative cut-paper corner tape strips
  const tapeMat = mats.paper('#9ad6c7', { roughness: 0.84, opacity: 0.92 });
  const corners = [
    [-2.08, -1.58, -0.75],
    [2.08, -1.58, 0.75],
    [-2.08, 1.58, 0.75],
    [2.08, 1.58, -0.75],
  ];
  for (const [cx, cz, rot] of corners) {
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.012, 0.2), tapeMat);
    tape.position.set(cx, 0.025, cz);
    tape.rotation.y = rot;
    group.add(tape);
  }
  return group;
}

// 2. Layered Cut-Paper Dough (transforms from thick 4-tier mound -> wide flat sheet with real cutout holes!)
export function createDoughSystem(mats) {
  const group = new THREE.Group();
  let flavorKey = 'vanilla';
  let rollProgress = 0; // 0 .. 1
  const holes = []; // { x, z, shapeId, scale }

  const baseMat = mats.paper(DOUGH_FLAVORS.vanilla.rawBase, { unique: true, roughness: 0.9 });
  const midMat = mats.paper(DOUGH_FLAVORS.vanilla.rawTop, { unique: true, roughness: 0.88 });
  const topMat = mats.paper('#fdf0cf', { unique: true, roughness: 0.87 });
  const edgeMat = mats.paper('#fbf4e6', { unique: true, roughness: 0.95, bumpScale: 0.01 });

  // Stage 1: 4 stepped concentric paper discs that spread & flatten as you roll
  const moundGroup = new THREE.Group();
  group.add(moundGroup);

  const tierRadii = [1.05, 0.88, 0.68, 0.45];
  const tierHeights = [0.16, 0.14, 0.12, 0.09];
  const tierMeshes = [];
  for (let i = 0; i < 4; i++) {
    const sc = createScallopedShape(tierRadii[i], 14 + i * 2, 0.045);
    const geo = extrudePaperFlat(sc, tierHeights[i], 0.014);
    const face = i === 0 ? baseMat : i < 3 ? midMat : topMat;
    const mesh = new THREE.Mesh(geo, [face, edgeMat]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    moundGroup.add(mesh);
    tierMeshes.push(mesh);
  }

  // Flecks scattered onto dough when flavor shakers are tapped
  const fleckGroup = new THREE.Group();
  group.add(fleckGroup);

  // Stage 2: Flat dough sheet mesh that can be rebuilt with real cookie-cutter holes!
  let flatSheetMesh = null;
  let flatTopMesh = null;

  function updateMoundTransform() {
    const p = Math.min(1, Math.max(0, rollProgress));
    const ease = 1 - Math.pow(1 - p, 1.8);
    // Spread radially from ~1.05 -> ~1.98 while flattening vertically
    const baseScaleXZ = 1.0 + ease * 0.88;
    const scaleY = 1.0 - ease * 0.72;

    let accY = 0;
    for (let i = 0; i < tierMeshes.length; i++) {
      const m = tierMeshes[i];
      // Inner tiers widen faster so at p=1 it becomes a clean 2-step flat sheet!
      const tierSpread = baseScaleXZ * (1 + i * ease * 0.14);
      m.scale.set(tierSpread, scaleY, tierSpread * 0.86);
      m.position.y = accY;
      accY += tierHeights[i] * scaleY * (i >= 2 ? 1 - ease * 0.65 : 0.92);
    }
    fleckGroup.scale.set(baseScaleXZ, 1, baseScaleXZ * 0.86);
    fleckGroup.position.y = accY + 0.012;
  }

  function setFlavor(newFlavor) {
    flavorKey = newFlavor;
    const fl = DOUGH_FLAVORS[flavorKey] || DOUGH_FLAVORS.vanilla;
    baseMat.color.set(fl.rawBase);
    midMat.color.set(fl.rawTop);
    const light = new THREE.Color(fl.rawTop).lerp(new THREE.Color('#ffffff'), 0.18);
    topMat.color.copy(light);

    // Add colorful cut-paper flavor flecks on top
    const fleckColor =
      flavorKey === 'cocoa' ? '#5c341f' : flavorKey === 'strawberry' ? '#e66384' : '#fff8e2';
    const fMat = mats.paper(fleckColor);
    const fGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.012, 6);
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 0.82;
      const dot = new THREE.Mesh(fGeo, fMat);
      dot.position.set(Math.cos(a) * r, 0.006, Math.sin(a) * r * 0.85);
      dot.rotation.y = Math.random() * Math.PI;
      fleckGroup.add(dot);
    }
    if (fleckGroup.children.length > 42) {
      while (fleckGroup.children.length > 42) fleckGroup.remove(fleckGroup.children[0]);
    }
  }

  function rebuildFlatSheet() {
    if (flatSheetMesh) {
      group.remove(flatSheetMesh);
      flatSheetMesh.geometry.dispose();
      flatSheetMesh = null;
    }
    if (flatTopMesh) {
      group.remove(flatTopMesh);
      flatTopMesh.geometry.dispose();
      flatTopMesh = null;
    }

    // Outer scalloped oval-ish cookie dough sheet
    const shape = new THREE.Shape();
    const lobes = 24;
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const bump = Math.abs(Math.sin(a * lobes * 0.5)) * 0.055;
      const rx = 1.98 + bump;
      const rz = 1.56 + bump * 0.85;
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * rz;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    // Punch real shaped cutout holes where cookies were stamped!
    for (const h of holes) {
      const pts = createCookiePath(h.shapeId, h.scale * 1.03).getPoints(28);
      const holePath = new THREE.Path();
      // ExtrudeGeometry rotated -PI/2 around X maps shape(x, y) -> world(x, -y)
      holePath.moveTo(pts[0].x + h.x, pts[0].y - h.z);
      for (let i = 1; i < pts.length; i++) {
        holePath.lineTo(pts[i].x + h.x, pts[i].y - h.z);
      }
      holePath.closePath();
      shape.holes.push(holePath);
    }

    const geo = extrudePaperFlat(shape, 0.11, 0.014);
    flatSheetMesh = new THREE.Mesh(geo, [baseMat, edgeMat]);
    flatSheetMesh.castShadow = true;
    flatSheetMesh.receiveShadow = true;
    group.add(flatSheetMesh);

    // Subtle inset paper surface layer when no holes yet (gives extra crisp papercraft layering!)
    if (holes.length === 0) {
      const inner = new THREE.Shape();
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const x = Math.cos(a) * 1.72;
        const y = Math.sin(a) * 1.32;
        if (i === 0) inner.moveTo(x, y);
        else inner.lineTo(x, y);
      }
      inner.closePath();
      const topGeo = extrudePaperFlat(inner, 0.018, 0.004);
      flatTopMesh = new THREE.Mesh(topGeo, [midMat, edgeMat]);
      flatTopMesh.position.y = 0.115;
      flatTopMesh.receiveShadow = true;
      group.add(flatTopMesh);
    }
  }

  function switchToFlatSheet() {
    moundGroup.visible = false;
    fleckGroup.position.y = 0.125;
    fleckGroup.scale.set(1.75, 1, 1.45);
    rebuildFlatSheet();
  }

  function addHole(x, z, shapeId, scale) {
    holes.push({ x, z, shapeId, scale });
    rebuildFlatSheet();
  }

  function reset() {
    holes.length = 0;
    rollProgress = 0;
    flavorKey = 'vanilla';
    const fl = DOUGH_FLAVORS.vanilla;
    baseMat.color.set(fl.rawBase);
    midMat.color.set(fl.rawTop);
    topMat.color.set('#fdf0cf');
    while (fleckGroup.children.length) fleckGroup.remove(fleckGroup.children[0]);
    if (flatSheetMesh) {
      group.remove(flatSheetMesh);
      flatSheetMesh.geometry.dispose();
      flatSheetMesh = null;
    }
    if (flatTopMesh) {
      group.remove(flatTopMesh);
      flatTopMesh.geometry.dispose();
      flatTopMesh = null;
    }
    moundGroup.visible = true;
    updateMoundTransform();
  }

  updateMoundTransform();

  return {
    group,
    get flavor() {
      return flavorKey;
    },
    get progress() {
      return rollProgress;
    },
    set progress(v) {
      rollProgress = Math.min(1, Math.max(0, v));
      updateMoundTransform();
    },
    holes,
    setFlavor,
    switchToFlatSheet,
    addHole,
    reset,
  };
}

// 3. Faceted Papercraft Rolling Pin
export function createRollingPin(mats) {
  const root = new THREE.Group();
  const roller = new THREE.Group();
  root.add(roller);

  // 10-sided folded paper barrel
  const barrelGeo = new THREE.CylinderGeometry(0.24, 0.24, 2.25, 10);
  barrelGeo.rotateZ(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, mats.paper('#e6be8a', { corrugated: true, bumpScale: 0.014 }));
  barrel.castShadow = true;
  barrel.receiveShadow = true;
  roller.add(barrel);

  // Cream cut-paper end rings
  const ringGeo = new THREE.CylinderGeometry(0.255, 0.255, 0.08, 10);
  ringGeo.rotateZ(Math.PI / 2);
  for (const sx of [-1.1, 1.1]) {
    const ring = new THREE.Mesh(ringGeo, mats.paper('#fff7ea'));
    ring.position.x = sx;
    ring.castShadow = true;
    roller.add(ring);

    // Bright red folded-paper handles
    const handleGeo = new THREE.CylinderGeometry(0.115, 0.14, 0.62, 8);
    handleGeo.rotateZ(Math.PI / 2);
    const handle = new THREE.Mesh(handleGeo, mats.paper('#e85d56'));
    handle.position.x = sx + Math.sign(sx) * 0.34;
    handle.castShadow = true;
    roller.add(handle);

    const knobGeo = new THREE.CylinderGeometry(0.145, 0.12, 0.14, 8);
    knobGeo.rotateZ(Math.PI / 2);
    const knob = new THREE.Mesh(knobGeo, mats.paper('#ff877d'));
    knob.position.x = sx + Math.sign(sx) * 0.66;
    knob.castShadow = true;
    roller.add(knob);
  }

  return { root, roller };
}

// 4. Three Folded-Paper Flavor Shakers (Vanilla / Cocoa / Strawberry)
export function createFlavorShakers(mats) {
  const configs = [
    { key: 'vanilla',    body: '#fff2cf', band: '#f0cb75', cap: '#fff9ec' },
    { key: 'cocoa',      body: '#8b573c', band: '#5c341f', cap: '#d6b494' },
    { key: 'strawberry', body: '#f79ab0', band: '#e35b7c', cap: '#ffe8ee' },
  ];
  const shakers = [];

  for (const cfg of configs) {
    const g = new THREE.Group();
    g.userData.flavorKey = cfg.key;

    // 8-sided folded cardstock shaker body
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.62, 8), mats.paper(cfg.body));
    body.position.y = 0.31;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    // Cut-paper label band (color-coded, zero text!)
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.268, 0.278, 0.2, 8), mats.paper(cfg.band));
    band.position.y = 0.31;
    g.add(band);

    // Cute cut-paper star/circle emblem on front
    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.03, 8), mats.paper('#fffaf0'));
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(0, 0.31, 0.265);
    g.add(emblem);

    // Shaker cap with dark paper holes
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.14, 8), mats.paper(cfg.cap));
    cap.position.y = 0.69;
    cap.castShadow = true;
    g.add(cap);

    const holeMat = mats.paper('#4d382c');
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const r = i === 0 ? 0 : 0.11;
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.015, 6), holeMat);
      dot.position.set(Math.cos(a) * r, 0.765, Math.sin(a) * r);
      g.add(dot);
    }

    shakers.push({ group: g, flavorKey: cfg.key, anim: 0, basePos: new THREE.Vector3() });
  }
  return shakers;
}

// 5. Cookie Cutters Set (5 shapes)
export function createCookieCutters(mats) {
  return COOKIE_SHAPES.map((cfg) => {
    const mesh = buildCookieCutterMesh(cfg.id, cfg.cutterColor, mats, 0.56);
    mesh.userData.shapeId = cfg.id;
    return {
      id: cfg.id,
      color: cfg.cutterColor,
      group: mesh,
      homePos: new THREE.Vector3(),
      wiggle: 0,
    };
  });
}

// 6. Papercraft Baking Tray with 4 embossed parchment slots
export function createBakingTray(mats) {
  const group = new THREE.Group();

  // Dark charcoal-slate folded cardstock rim
  const trayShape = createRoundedRectShape(3.2, 2.35, 0.18);
  const trayGeo = extrudePaperFlat(trayShape, 0.09, 0.012);
  const trayBase = new THREE.Mesh(trayGeo, mats.layered('#4c5461', 0.45));
  trayBase.castShadow = true;
  trayBase.receiveShadow = true;
  group.add(trayBase);

  // Parchment sheet inside tray
  const linerShape = createRoundedRectShape(2.92, 2.08, 0.12);
  const linerGeo = extrudePaperFlat(linerShape, 0.018, 0.003);
  const liner = new THREE.Mesh(linerGeo, mats.layered('#fcf5e6', 0.25));
  liner.position.y = 0.092;
  liner.receiveShadow = true;
  group.add(liner);

  // Red paper-folded side handles
  for (const sx of [-1.66, 1.66]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.78), mats.paper('#e85d56'));
    h.position.set(sx, 0.085, 0);
    h.castShadow = true;
    group.add(h);
  }

  // 4 subtle circular parchment target marks (visual affordance: 4 cookie spots!)
  const slotPositions = [
    new THREE.Vector3(-0.76, 0.115, -0.48),
    new THREE.Vector3(0.76, 0.115, -0.48),
    new THREE.Vector3(-0.76, 0.115, 0.48),
    new THREE.Vector3(0.76, 0.115, 0.48),
  ];

  const ringGeo = new THREE.RingGeometry(0.46, 0.52, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = mats.paper('#e6d4b8', { side: THREE.DoubleSide });
  for (const pos of slotPositions) {
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(pos.x, 0.115, pos.z);
    group.add(ring);
  }

  return { group, slotPositions };
}

// 7. Papercraft Tabletop Oven (with clear vellum window, dancing paper flames, corrugated dial, hinged door, chimney flag!)
export function createOven(mats) {
  const root = new THREE.Group();

  // Outer cream/terracotta layered paper body (hollow interior!)
  const creamMat = mats.paper('#fbf0df');
  const coralMat = mats.paper('#e3705b');
  const trimMat = mats.paper('#fffaf0');
  const darkInnerMat = mats.paper('#453531', { roughness: 0.96 });

  const W = 4.6, H = 3.1, D = 2.95;

  // Back wall & warm dark cocoa interior backing so dancing flames pop cleanly!
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.22), creamMat);
  back.position.set(0, H / 2, -D / 2 + 0.11);
  back.castShadow = true;
  back.receiveShadow = true;
  root.add(back);

  const innerBack = new THREE.Mesh(new THREE.BoxGeometry(3.38, 2.66, 0.06), darkInnerMat);
  innerBack.position.set(-0.48, 1.56, -D / 2 + 0.25);
  root.add(innerBack);

  // Floor & Roof (layered coral cardstock cap!)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.28, D), creamMat);
  floor.position.set(0, 0.14, 0);
  floor.castShadow = true;
  floor.receiveShadow = true;
  root.add(floor);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.16, 0.3, D + 0.14), coralMat);
  roof.position.set(0, H + 0.08, 0);
  roof.castShadow = true;
  roof.receiveShadow = true;
  root.add(roof);

  // Paper trim lip on roof
  const roofLip = new THREE.Mesh(new THREE.BoxGeometry(W + 0.22, 0.07, D + 0.2), trimMat);
  roofLip.position.set(0, H - 0.06, 0);
  root.add(roofLip);

  // Left wall
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, H, D), creamMat);
  leftWall.position.set(-W / 2 + 0.12, H / 2, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  root.add(leftWall);

  // Right control panel column (houses the rotary dial!)
  const rightCol = new THREE.Mesh(new THREE.BoxGeometry(1.12, H, D), creamMat);
  rightCol.position.set(W / 2 - 0.56, H / 2, 0);
  rightCol.castShadow = true;
  rightCol.receiveShadow = true;
  root.add(rightCol);

  // Coral accent panel on control column face
  const panelFace = new THREE.Mesh(new THREE.BoxGeometry(0.96, 2.68, 0.05), mats.paper('#f6e2ca'));
  panelFace.position.set(W / 2 - 0.56, 1.52, D / 2 + 0.01);
  root.add(panelFace);

  // Internal wire/paper shelf rack inside oven
  const rack = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.07, 2.35), mats.paper('#8c8279'));
  rack.position.set(-0.48, 0.88, 0);
  rack.receiveShadow = true;
  root.add(rack);

  // Warm interior oven light (ramps up when baking!)
  const innerLight = new THREE.PointLight('#ff9a3c', 0, 5.5, 1.4);
  innerLight.position.set(-0.48, 2.15, 0.15);
  root.add(innerLight);

  // 3 Layered Cut-Paper Flames visibly dancing along back inside oven!
  const flamesGroup = new THREE.Group();
  flamesGroup.position.set(-0.48, 0.88, -1.05);
  root.add(flamesGroup);

  const flames = [];
  for (let i = -1; i <= 1; i++) {
    const fg = new THREE.Group();
    fg.position.set(i * 0.88, 0, 0);

    const outerFlame = new THREE.Shape();
    outerFlame.moveTo(-0.36, 0);
    outerFlame.quadraticCurveTo(-0.32, 0.55, 0, 0.92);
    outerFlame.quadraticCurveTo(0.32, 0.55, 0.36, 0);
    outerFlame.closePath();

    const fGeo1 = extrudePaperFlat(outerFlame, 0.04, 0.006);
    fGeo1.rotateX(Math.PI / 2);
    const m1 = new THREE.Mesh(
      fGeo1,
      new THREE.MeshBasicMaterial({ color: '#ff7a33' })
    );

    const fGeo2 = extrudePaperFlat(outerFlame, 0.04, 0.005);
    fGeo2.rotateX(Math.PI / 2);
    const m2 = new THREE.Mesh(
      fGeo2,
      new THREE.MeshBasicMaterial({ color: '#ffd94a' })
    );
    m2.scale.set(0.62, 0.65, 1);
    m2.position.set(0, 0.04, 0.045);

    fg.add(m1, m2);
    fg.scale.setScalar(0.001);
    flamesGroup.add(fg);
    flames.push(fg);
  }

  // Hinged Pull-Down Paper Oven Door (pivots around bottom front edge!)
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.48, 0.28, D / 2 + 0.02);
  root.add(doorPivot);

  const doorW = 3.38, doorH = 2.68;
  // Build frame around large vellum window so cookies inside are super visible!
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.36, 0.14), coralMat);
  topBar.position.set(0, doorH - 0.18, 0);
  const botBar = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.3, 0.14), coralMat);
  botBar.position.set(0, 0.15, 0);
  const lBar = new THREE.Mesh(new THREE.BoxGeometry(0.32, doorH, 0.14), coralMat);
  lBar.position.set(-doorW / 2 + 0.16, doorH / 2, 0);
  const rBar = new THREE.Mesh(new THREE.BoxGeometry(0.32, doorH, 0.14), coralMat);
  rBar.position.set(doorW / 2 - 0.16, doorH / 2, 0);
  [topBar, botBar, lBar, rBar].forEach((b) => {
    b.castShadow = true;
    doorPivot.add(b);
  });

  // White paper inner window mat frame
  const wFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.08, doorH - 0.62, 0.16), trimMat);
  wFrameL.position.set(-doorW / 2 + 0.34, doorH / 2 + 0.02, 0);
  const wFrameR = wFrameL.clone();
  wFrameR.position.x = doorW / 2 - 0.34;
  doorPivot.add(wFrameL, wFrameR);

  // Translucent frosted vellum window
  const windowGlass = new THREE.Mesh(new THREE.PlaneGeometry(doorW - 0.64, doorH - 0.66), mats.vellumMat);
  windowGlass.position.set(0, doorH / 2 + 0.03, 0.01);
  doorPivot.add(windowGlass);

  // Tactile horizontal wooden-paper door handle
  const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.0, 8), mats.paper('#fff7ea'));
  handleBar.rotation.z = Math.PI / 2;
  handleBar.position.set(0, doorH - 0.16, 0.24);
  handleBar.castShadow = true;
  doorPivot.add(handleBar);

  for (const hx of [-0.72, 0.72]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.22), mats.paper('#d9a878'));
    post.position.set(hx, doorH - 0.16, 0.12);
    doorPivot.add(post);
  }

  // CHUNKY CORRUGATED ROTARY DIAL (on right control face)
  const dialCenter = new THREE.Group();
  dialCenter.position.set(W / 2 - 0.56, 1.72, D / 2 + 0.05);
  root.add(dialCenter);

  // Color heat arc around the dial (zero numbers!)
  const arcPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), mats.ovenArcMat);
  arcPlane.position.z = 0.01;
  dialCenter.add(arcPlane);

  // Rotating knob group
  const dialKnob = new THREE.Group();
  dialKnob.position.z = 0.08;
  dialCenter.add(dialKnob);

  const knobDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.3, 0.18, 16),
    mats.paper('#fff8ec', { corrugated: true, bumpScale: 0.03 })
  );
  knobDrum.rotation.x = Math.PI / 2;
  knobDrum.castShadow = true;
  dialKnob.add(knobDrum);

  // Raised cherry-red pointer fin on the knob (unmistakable turn affordance!)
  const pointer = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.34, 0.14), mats.paper('#e85d56'));
  pointer.position.set(0, 0.12, 0.09);
  pointer.castShadow = true;
  dialKnob.add(pointer);

  // Lower indicator lamp (glows golden when baking, mint when done!)
  const lampRing = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12), mats.paper('#fff8ee'));
  lampRing.rotation.x = Math.PI / 2;
  lampRing.position.set(W / 2 - 0.56, 0.85, D / 2 + 0.04);
  root.add(lampRing);

  const lampMat = new THREE.MeshStandardMaterial({
    color: '#d9cfc2',
    emissive: '#000000',
    roughness: 0.5,
  });
  const lampBulb = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.08, 12), lampMat);
  lampBulb.rotation.x = Math.PI / 2;
  lampBulb.position.set(W / 2 - 0.56, 0.85, D / 2 + 0.06);
  root.add(lampBulb);

  // Cute Chimney & Pop-up Done Flag on top of oven!
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.45, 8), mats.paper('#e3705b'));
  chimney.position.set(-1.25, H + 0.42, -0.35);
  chimney.castShadow = true;
  root.add(chimney);

  const chimneyRim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.09, 8), trimMat);
  chimneyRim.position.set(-1.25, H + 0.65, -0.35);
  root.add(chimneyRim);

  // Pop-up celebration paper star flag inside chimney
  const flagGroup = new THREE.Group();
  flagGroup.position.set(-1.25, H + 0.25, -0.35);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 6), mats.paper('#fff7ea'));
  pole.position.y = 0.42;
  const starGeo = extrudePaperFlat(createCookieShape('star', 0.26), 0.035, 0.006);
  starGeo.rotateX(Math.PI / 2);
  const flagStar = new THREE.Mesh(starGeo, mats.foil('#ffd447'));
  flagStar.position.set(0, 0.92, 0);
  flagGroup.add(pole, flagStar);
  flagGroup.scale.setScalar(0.001);
  root.add(flagGroup);

  // Cute paper oven feet
  for (const fx of [-W / 2 + 0.35, W / 2 - 0.35]) {
    for (const fz of [-D / 2 + 0.35, D / 2 - 0.35]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.16, 8), mats.paper('#d9a878'));
      foot.position.set(fx, -0.04, fz);
      root.add(foot);
    }
  }

  return {
    root,
    doorPivot,
    dialKnob,
    dialCenter,
    innerLight,
    flames,
    lampMat,
    flagGroup,
    windowGlass,
    trayInsidePos: new THREE.Vector3(-0.48, 0.94, -0.18),
    trayPulledPos: new THREE.Vector3(-0.48, 0.94, 2.15),
  };
}

// 8. Lace Doily Turntable for Stage 4 Decorating
export function createDoilyTurntable(mats) {
  const root = new THREE.Group();

  // Stacked corrugated kraft turntable pedestal
  const baseDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.52, 1.58, 0.11, 24),
    mats.paper('#e6c8a0', { corrugated: true, bumpScale: 0.02 })
  );
  baseDisc.position.y = 0.055;
  baseDisc.castShadow = true;
  baseDisc.receiveShadow = true;
  root.add(baseDisc);

  // Rotating lace doily + cookie mount
  const spinner = new THREE.Group();
  spinner.position.y = 0.116;
  root.add(spinner);

  const doily = new THREE.Mesh(new THREE.PlaneGeometry(3.25, 3.25), mats.laceDoilyMat);
  doily.rotation.x = -Math.PI / 2;
  doily.receiveShadow = true;
  spinner.add(doily);

  // Cookie holder pivot at center of doily
  const cookieMount = new THREE.Group();
  cookieMount.position.y = 0.012;
  spinner.add(cookieMount);

  return { root, spinner, cookieMount };
}

// 9. Cooling Rack holding the other cookies during Decorating
export function createCoolingRack(mats) {
  const group = new THREE.Group();
  const frameShape = createRoundedRectShape(2.55, 1.7, 0.14);
  const frameGeo = extrudePaperFlat(frameShape, 0.06, 0.008);
  const frame = new THREE.Mesh(frameGeo, mats.layered('#d4a77a', 0.4));
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  const matTop = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.02, 1.48), mats.paper('#fff8ee'));
  matTop.position.y = 0.068;
  matTop.receiveShadow = true;
  group.add(matTop);

  // Paper grid bars
  const barMat = mats.paper('#b38862');
  for (let i = -3; i <= 3; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 1.42), barMat);
    bar.position.set(i * 0.34, 0.082, 0);
    group.add(bar);
  }

  const slots = [
    new THREE.Vector3(-0.62, 0.095, -0.36),
    new THREE.Vector3(0.62, 0.095, -0.36),
    new THREE.Vector3(-0.62, 0.095, 0.36),
    new THREE.Vector3(0.62, 0.095, 0.36),
  ];

  return { group, slots };
}

// 10. Folded-Paper Icing Piping Bags (6 colors including Rainbow Striped!)
export function createPipingBags(mats) {
  return ICING_COLORS.map((cfg) => {
    const group = new THREE.Group();
    group.userData.icingId = cfg.id;

    // Rolled conical cardstock piping bag
    const coneMat = cfg.rainbow ? mats.rainbowMat : mats.paper(cfg.hex);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.88, 10), coneMat);
    cone.rotation.x = Math.PI; // Tip pointing down!
    cone.position.y = 0.56;
    cone.castShadow = true;
    cone.receiveShadow = true;
    group.add(cone);

    // Pleated white paper top cuff
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.21, 0.22, 10),
      mats.paper('#fffaf0', { corrugated: true })
    );
    cuff.position.y = 1.02;
    cuff.castShadow = true;
    group.add(cuff);

    // Paper ribbon tie around cuff
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 10), mats.paper('#e85d56'));
    tie.position.y = 0.93;
    group.add(tie);

    // Silver-paper piping nozzle tip
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 8), mats.paper('#dce2e6'));
    nozzle.rotation.x = Math.PI;
    nozzle.position.y = 0.1;
    group.add(nozzle);

    // Cute icing droplet peeking from the tip (instant color signifier!)
    const drop = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 8),
      mats.icing(cfg.rainbow ? '#ffd24c' : cfg.hex)
    );
    drop.position.y = 0.01;
    group.add(drop);

    return {
      id: cfg.id,
      hex: cfg.hex,
      rainbow: !!cfg.rainbow,
      group,
      homePos: new THREE.Vector3(),
    };
  });
}

// 11. 3D Cut-Paper Toppings Factory (cached geometries for crisp <300k tri budget!)
const toppingGeoCache = new Map();
function getToppingResources(mats) {
  if (toppingGeoCache.size > 0) return toppingGeoCache;

  // Sprinkles (cut-paper confetti rods)
  toppingGeoCache.set('sprinkleGeo', new THREE.BoxGeometry(0.14, 0.028, 0.042));

  // Cut-paper Strawberry Slice (layered red + cream + green calyx!)
  const sbShape = new THREE.Shape();
  sbShape.moveTo(0, -0.15);
  sbShape.quadraticCurveTo(0.14, -0.06, 0.12, 0.08);
  sbShape.quadraticCurveTo(0.06, 0.15, 0, 0.12);
  sbShape.quadraticCurveTo(-0.06, 0.15, -0.12, 0.08);
  sbShape.quadraticCurveTo(-0.14, -0.06, 0, -0.15);
  toppingGeoCache.set('sbOuterGeo', extrudePaperFlat(sbShape, 0.032, 0.005));

  const sbInner = new THREE.Shape();
  sbInner.moveTo(0, -0.09);
  sbInner.quadraticCurveTo(0.075, -0.03, 0.065, 0.055);
  sbInner.quadraticCurveTo(0, 0.09, -0.065, 0.055);
  sbInner.quadraticCurveTo(-0.075, -0.03, 0, -0.09);
  toppingGeoCache.set('sbInnerGeo', extrudePaperFlat(sbInner, 0.016, 0.003));

  const leafGeo = new THREE.BoxGeometry(0.15, 0.02, 0.055);
  toppingGeoCache.set('sbLeafGeo', leafGeo);

  // Mini Star & Heart cutouts
  toppingGeoCache.set('miniStarGeo', extrudePaperFlat(createCookieShape('star', 0.13), 0.03, 0.005));
  toppingGeoCache.set('miniHeartGeo', extrudePaperFlat(createCookieShape('heart', 0.12), 0.03, 0.005));

  // Faceted Sugar Pearl gem
  toppingGeoCache.set('pearlGeo', new THREE.IcosahedronGeometry(0.062, 0));

  // Pleated Whipped-Cream Rosette (2 stacked scalloped flower discs!)
  toppingGeoCache.set('rosetteBaseGeo', extrudePaperFlat(createScallopedShape(0.145, 7, 0.035), 0.038, 0.006));
  toppingGeoCache.set('rosetteTopGeo', extrudePaperFlat(createScallopedShape(0.095, 6, 0.025), 0.034, 0.006));
  toppingGeoCache.set('rosetteDotGeo', new THREE.CylinderGeometry(0.032, 0.038, 0.032, 8));

  return toppingGeoCache;
}

const SPRINKLE_PALETTE = ['#f26d85', '#ffd24c', '#5fd0b8', '#6daef5', '#b487eb', '#ff9457'];
const PEARL_PALETTE = ['#fff9ee', '#ffd5e0', '#cdeff0', '#fff0b3', '#e2d4fa'];

export function createToppingMesh(typeId, mats) {
  const res = getToppingResources(mats);
  const g = new THREE.Group();

  if (typeId === 'sprinkles') {
    const col = SPRINKLE_PALETTE[Math.floor(Math.random() * SPRINKLE_PALETTE.length)];
    const m = new THREE.Mesh(res.get('sprinkleGeo'), mats.paper(col, { roughness: 0.72 }));
    m.position.y = 0.015;
    m.rotation.y = Math.random() * Math.PI * 2;
    m.castShadow = true;
    g.add(m);
    return g;
  }

  if (typeId === 'strawberry') {
    const outer = new THREE.Mesh(res.get('sbOuterGeo'), mats.layered('#e84a5f', 0.65));
    outer.castShadow = true;
    const inner = new THREE.Mesh(res.get('sbInnerGeo'), mats.paper('#ffe6ea'));
    inner.position.y = 0.032;
    const leaf = new THREE.Mesh(res.get('sbLeafGeo'), mats.paper('#4fb073'));
    leaf.position.set(0, 0.044, -0.11);
    g.add(outer, inner, leaf);
    g.rotation.y = (Math.random() - 0.5) * 1.4;
    return g;
  }

  if (typeId === 'starheart') {
    const isStar = Math.random() > 0.45;
    const palette = isStar ? ['#ffd24c', '#ff9d5c', '#74c6f5'] : ['#f26d85', '#b584eb', '#ff8aa8'];
    const col = palette[Math.floor(Math.random() * palette.length)];
    const mesh = new THREE.Mesh(
      isStar ? res.get('miniStarGeo') : res.get('miniHeartGeo'),
      mats.layered(col, 0.72)
    );
    mesh.castShadow = true;
    mesh.rotation.y = (Math.random() - 0.5) * 0.9;
    g.add(mesh);
    return g;
  }

  if (typeId === 'pearls') {
    const col = PEARL_PALETTE[Math.floor(Math.random() * PEARL_PALETTE.length)];
    const m = new THREE.Mesh(res.get('pearlGeo'), mats.foil(col));
    m.position.y = 0.052;
    m.castShadow = true;
    g.add(m);
    return g;
  }

  // rosette (layered cut-paper whipped cream flower!)
  const base = new THREE.Mesh(res.get('rosetteBaseGeo'), mats.layered('#fffaf2', 0.35));
  base.castShadow = true;
  const top = new THREE.Mesh(res.get('rosetteTopGeo'), mats.layered('#ffdce5', 0.45));
  top.position.y = 0.042;
  top.rotation.y = 0.35;
  const dot = new THREE.Mesh(res.get('rosetteDotGeo'), mats.paper('#ffd24c'));
  dot.position.y = 0.088;
  g.add(base, top, dot);
  g.rotation.y = Math.random() * Math.PI;
  return g;
}

// 12. Origami Topping Cups (5 folded paper bowls filled with preview toppings!)
export function createToppingCups(mats) {
  return TOPPING_TYPES.map((cfg) => {
    const group = new THREE.Group();
    group.userData.toppingId = cfg.id;

    // Folded origami square-ish fluted cup
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.22, 0.28, 8),
      mats.paper(cfg.cupColor, { corrugated: true, bumpScale: 0.022 })
    );
    cup.position.y = 0.14;
    cup.castShadow = true;
    cup.receiveShadow = true;
    group.add(cup);

    // Crisp white paper inner liner
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.21, 0.06, 8), mats.paper('#fffaf2'));
    inner.position.y = 0.26;
    group.add(inner);

    // Pile of miniature 3D toppings brimming inside the cup (instant visual affordance!)
    const previewCount = cfg.id === 'sprinkles' ? 10 : cfg.id === 'pearls' ? 7 : 4;
    for (let i = 0; i < previewCount; i++) {
      const piece = createToppingMesh(cfg.id, mats);
      const a = (i / previewCount) * Math.PI * 2 + 0.3;
      const r = i === 0 ? 0 : 0.11 + (i % 2) * 0.04;
      piece.position.set(Math.cos(a) * r, 0.285 + (i % 2) * 0.02, Math.sin(a) * r);
      piece.scale.setScalar(cfg.id === 'sprinkles' ? 0.95 : 0.78);
      group.add(piece);
    }

    return {
      id: cfg.id,
      group,
      homePos: new THREE.Vector3(),
    };
  });
}

// 13. Handcrafted Papercraft Gift Box (striped cardstock, 4 pleated cup liners, hinged window lid, origami bow, foil seals!)
export function createGiftBox(mats) {
  const root = new THREE.Group();

  const W = 3.5, D = 2.75, H = 0.76, wallT = 0.12;
  const stripeMat = mats.stripeBoxMat;
  const creamInner = mats.paper('#fff9f0');

  // Box floor
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(W, 0.09, D), creamInner);
  bottom.position.y = 0.045;
  bottom.castShadow = true;
  bottom.receiveShadow = true;
  root.add(bottom);

  // 4 Box side walls (striped pink/cream cardstock!)
  const frontW = new THREE.Mesh(new THREE.BoxGeometry(W, H, wallT), stripeMat);
  frontW.position.set(0, H / 2, D / 2 - wallT / 2);
  const backW = frontW.clone();
  backW.position.z = -D / 2 + wallT / 2;
  const leftW = new THREE.Mesh(new THREE.BoxGeometry(wallT, H, D - wallT * 2), stripeMat);
  leftW.position.set(-W / 2 + wallT / 2, H / 2, 0);
  const rightW = leftW.clone();
  rightW.position.x = W / 2 - wallT / 2;

  [frontW, backW, leftW, rightW].forEach((w) => {
    w.castShadow = true;
    w.receiveShadow = true;
    root.add(w);
  });

  // Crisp paper interior cross-dividers
  const divX = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, D - 0.28), creamInner);
  divX.position.set(0, 0.28, 0);
  const divZ = new THREE.Mesh(new THREE.BoxGeometry(W - 0.28, 0.42, 0.06), creamInner);
  divZ.position.set(0, 0.28, 0);
  root.add(divX, divZ);

  // 4 Pleated paper cushion cups inside the 4 compartments!
  const slotPositions = [
    new THREE.Vector3(-0.82, 0.14, -0.62),
    new THREE.Vector3(0.82, 0.14, -0.62),
    new THREE.Vector3(-0.82, 0.14, 0.62),
    new THREE.Vector3(0.82, 0.14, 0.62),
  ];

  const cupColors = ['#ffe5ec', '#e3f5ef', '#fff3cf', '#ece4fa'];
  const cups = [];
  slotPositions.forEach((pos, idx) => {
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.52, 0.22, 18, 1, true),
      mats.paper(cupColors[idx], { corrugated: true, side: THREE.DoubleSide })
    );
    cup.position.set(pos.x, 0.2, pos.z);
    root.add(cup);

    const cushion = new THREE.Mesh(
      new THREE.CylinderGeometry(0.54, 0.54, 0.04, 16),
      mats.paper(cupColors[idx])
    );
    cushion.position.set(pos.x, 0.11, pos.z);
    cushion.receiveShadow = true;
    root.add(cushion);
    cups.push(cup);
  });

  // Hinged Scalloped-Window Box Lid (pivots along back top edge!)
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, H, -D / 2);
  root.add(lidPivot);

  const lidW = W + 0.16, lidD = D + 0.16;
  const lidShape = createRoundedRectShape(lidW, lidD, 0.14);
  // Punch a generous window in the center of the lid so you STILL see your decorated cookies inside!
  const winW = 2.45, winH = 1.72, wr = 0.25;
  const winHole = new THREE.Path();
  winHole.moveTo(-winW / 2 + wr, -winH / 2);
  winHole.lineTo(winW / 2 - wr, -winH / 2);
  winHole.quadraticCurveTo(winW / 2, -winH / 2, winW / 2, -winH / 2 + wr);
  winHole.lineTo(winW / 2, winH / 2 - wr);
  winHole.quadraticCurveTo(winW / 2, winH / 2, winW / 2 - wr, winH / 2);
  winHole.lineTo(-winW / 2 + wr, winH / 2);
  winHole.quadraticCurveTo(-winW / 2, winH / 2, -winW / 2, winH / 2 - wr);
  winHole.lineTo(-winW / 2, -winH / 2 + wr);
  winHole.quadraticCurveTo(-winW / 2, -winH / 2, -winW / 2 + wr, -winH / 2);
  lidShape.holes.push(winHole);

  const lidTopGeo = extrudePaperFlat(lidShape, 0.075, 0.01);
  const lidTop = new THREE.Mesh(lidTopGeo, mats.layered('#f595a9', 0.65));
  lidTop.position.set(0, 0.02, D / 2);
  lidTop.castShadow = true;
  lidTop.receiveShadow = true;
  lidPivot.add(lidTop);

  // Clear frosted vellum window pane inside lid
  const lidWindow = new THREE.Mesh(new THREE.PlaneGeometry(winW + 0.06, winH + 0.06), mats.vellumMat);
  lidWindow.rotation.x = -Math.PI / 2;
  lidWindow.position.set(0, 0.055, D / 2);
  lidPivot.add(lidWindow);

  // Lid skirt walls
  const skirtMat = mats.paper('#f595a9');
  const skF = new THREE.Mesh(new THREE.BoxGeometry(lidW, 0.22, 0.08), skirtMat);
  skF.position.set(0, -0.07, D + 0.04);
  const skL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, lidD), skirtMat);
  skL.position.set(-lidW / 2 + 0.04, -0.07, D / 2);
  const skR = skL.clone();
  skR.position.x = lidW / 2 - 0.04;
  lidPivot.add(skF, skL, skR);

  // Container for foil seals stamped on the lid
  const sealsOnLid = new THREE.Group();
  sealsOnLid.position.set(0, 0.105, D / 2);
  lidPivot.add(sealsOnLid);

  // Folded-Paper Ribbon Bands (appear once lid closes!)
  const ribbonGroup = new THREE.Group();
  ribbonGroup.position.set(0, 0, 0);
  ribbonGroup.visible = false;
  root.add(ribbonGroup);

  const ribMat = mats.paper('#e84a5f', { roughness: 0.72 });
  const ribEdgeMat = mats.paper('#ffd9df', { roughness: 0.85 });

  // Sleek paper ribbon straps framing the window so ALL 4 decorated cookies shine through!
  const strapX = new THREE.Mesh(new THREE.BoxGeometry(W + 0.24, 0.036, 0.16), ribMat);
  strapX.position.set(0, H + 0.12, 0);
  const strapZ = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.036, D + 0.24), ribMat);
  strapZ.position.set(0, H + 0.125, 0);

  // Side vertical drops
  const dropL = new THREE.Mesh(new THREE.BoxGeometry(0.05, H + 0.14, 0.16), ribMat);
  dropL.position.set(-W / 2 - 0.1, H / 2 + 0.05, 0);
  const dropR = dropL.clone();
  dropR.position.x = W / 2 + 0.1;
  const dropF = new THREE.Mesh(new THREE.BoxGeometry(0.16, H + 0.14, 0.05), ribMat);
  dropF.position.set(0, H / 2 + 0.05, D / 2 + 0.1);
  const dropB = dropF.clone();
  dropB.position.z = -D / 2 - 0.1;

  ribbonGroup.add(strapX, strapZ, dropL, dropR, dropF, dropB);

  // Untied loose ribbon tails inviting a pull/tap!
  const untiedGroup = new THREE.Group();
  untiedGroup.position.set(0, H + 0.14, 0);
  for (const s of [-1, 1]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.032, 0.18), ribMat);
    tail.position.set(s * 0.34, 0.06, 0.1 * s);
    tail.rotation.y = s * 0.32;
    tail.rotation.z = s * 0.14;
    tail.castShadow = true;
    untiedGroup.add(tail);
  }
  const knotPreview = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.09, 8), ribEdgeMat);
  knotPreview.position.y = 0.06;
  untiedGroup.add(knotPreview);
  ribbonGroup.add(untiedGroup);

  // Lush 3D Origami Multi-Loop Ribbon Bow (blooms when ribbon is pulled!)
  const bowGroup = new THREE.Group();
  bowGroup.position.set(0, H + 0.15, 0);
  bowGroup.scale.setScalar(0.001);
  ribbonGroup.add(bowGroup);

  const loopShape = new THREE.Shape();
  loopShape.moveTo(0, 0);
  loopShape.bezierCurveTo(0.24, 0.25, 0.62, 0.22, 0.66, 0);
  loopShape.bezierCurveTo(0.62, -0.22, 0.24, -0.25, 0, 0);
  const loopGeo = extrudePaperFlat(loopShape, 0.05, 0.009);

  const bowAngles = [0.24, -0.24, Math.PI + 0.24, Math.PI - 0.24];
  bowAngles.forEach((ang, i) => {
    const loop = new THREE.Mesh(loopGeo, mats.layered(i % 2 === 0 ? '#e84a5f' : '#ff758a', 0.65));
    loop.rotation.y = ang;
    loop.rotation.z = (i < 2 ? 1 : -1) * 0.24;
    loop.position.y = 0.04 + (i % 2) * 0.065;
    loop.castShadow = true;
    bowGroup.add(loop);
  });

  // Notched ribbon tails
  for (const s of [-1, 1]) {
    const tShape = new THREE.Shape();
    tShape.moveTo(0, -0.085);
    tShape.lineTo(0.64, -0.12);
    tShape.lineTo(0.51, 0);
    tShape.lineTo(0.64, 0.12);
    tShape.lineTo(0, 0.085);
    tShape.closePath();
    const tGeo = extrudePaperFlat(tShape, 0.03, 0.005);
    const tail = new THREE.Mesh(tGeo, mats.layered('#e84a5f', 0.6));
    tail.rotation.y = s > 0 ? -0.68 : Math.PI + 0.68;
    tail.position.y = 0.02;
    tail.castShadow = true;
    bowGroup.add(tail);
  }

  const centerKnot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.16, 8), mats.paper('#ff8ea0'));
  centerKnot.position.y = 0.11;
  centerKnot.castShadow = true;
  bowGroup.add(centerKnot);

  // Container for packed cookies inside box
  const packedCookiesGroup = new THREE.Group();
  root.add(packedCookiesGroup);

  return {
    root,
    lidPivot,
    ribbonGroup,
    untiedGroup,
    bowGroup,
    sealsOnLid,
    packedCookiesGroup,
    slotPositions,
    cups,
  };
}

// 14. Foil Seal Stickers (for Stage 5 finishing touch!)
export function createSealStickers(mats) {
  const specs = [
    { id: 'star',   shape: 'star',   color: '#ffd447' },
    { id: 'heart',  shape: 'heart',  color: '#f26d85' },
    { id: 'flower', shape: 'flower', color: '#5fd0b8' },
  ];
  return specs.map((sp) => {
    const g = new THREE.Group();
    g.userData.sealId = sp.id;
    const baseGeo = extrudePaperFlat(createScallopedShape(0.32, 12, 0.035), 0.03, 0.005);
    const base = new THREE.Mesh(baseGeo, mats.foil(sp.color));
    base.castShadow = true;
    const emblemGeo = extrudePaperFlat(createCookieShape(sp.shape, 0.19), 0.02, 0.004);
    const emblem = new THREE.Mesh(emblemGeo, mats.paper('#fffaf0'));
    emblem.position.y = 0.032;
    g.add(base, emblem);
    return { id: sp.id, color: sp.color, shape: sp.shape, group: g, homePos: new THREE.Vector3() };
  });
}

// 15. Fresh Dough Mini-Prop (tactile zero-text "Bake Another Box" trigger in Stage 5!)
export function createFreshDoughProp(mats) {
  const g = new THREE.Group();
  const matShape = createScallopedShape(0.66, 14, 0.04);
  const matMesh = new THREE.Mesh(extrudePaperFlat(matShape, 0.025, 0.005), mats.layered('#fffaf0', 0.35));
  matMesh.receiveShadow = true;
  g.add(matMesh);

  const dough1 = new THREE.Mesh(
    extrudePaperFlat(createScallopedShape(0.38, 12, 0.03), 0.14, 0.01),
    mats.layered('#f6dfaa', 0.5)
  );
  dough1.position.y = 0.026;
  dough1.castShadow = true;
  g.add(dough1);

  const dough2 = new THREE.Mesh(
    extrudePaperFlat(createScallopedShape(0.25, 10, 0.025), 0.1, 0.01),
    mats.layered('#fbe9be', 0.5)
  );
  dough2.position.y = 0.16;
  dough2.castShadow = true;
  g.add(dough2);

  // Tiny rolling pin resting atop it
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.65, 8), mats.paper('#e6be8a'));
  pin.rotation.z = Math.PI / 2;
  pin.rotation.y = 0.4;
  pin.position.set(0.02, 0.28, 0.05);
  pin.castShadow = true;
  g.add(pin);

  for (const sx of [-0.42, 0.42]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.2, 6), mats.paper('#e85d56'));
    h.rotation.z = Math.PI / 2;
    h.position.set(Math.cos(0.4) * sx + 0.02, 0.28, -Math.sin(0.4) * sx + 0.05);
    g.add(h);
  }

  return g;
}

// 16. Subtle Cut-Paper Idle Hand (ONLY appears after >10s of inactivity, demonstrates gently once!)
export function createIdlePaperHand(mats) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  // Cute simplified cut-paper mitten hand pointing slightly forward
  s.moveTo(-0.14, -0.22);
  s.lineTo(0.14, -0.22);
  s.quadraticCurveTo(0.24, -0.1, 0.22, 0.08);
  s.lineTo(0.12, 0.12);
  s.lineTo(0.08, 0.36);
  s.quadraticCurveTo(0, 0.42, -0.08, 0.36);
  s.lineTo(-0.12, 0.12);
  s.quadraticCurveTo(-0.24, 0.04, -0.24, -0.06);
  s.quadraticCurveTo(-0.22, -0.18, -0.14, -0.22);

  const geo = extrudePaperFlat(s, 0.035, 0.008);
  const handMat = mats.paper('#fff5e6', { opacity: 0.92 });
  const edgeMat = mats.paper('#f28c88', { opacity: 0.92 });
  const mesh = new THREE.Mesh(geo, [handMat, edgeMat]);
  mesh.castShadow = true;
  g.add(mesh);
  g.visible = false;
  return g;
}
