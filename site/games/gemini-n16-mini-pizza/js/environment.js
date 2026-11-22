import * as THREE from 'three';
import {
  createWoodTextures,
  createBrickTextures,
  createGinghamTextures,
  createWallTextures,
  createCeramicTexture,
  createFirebrickTexture,
  createFlameTexture,
  createBasilTexture
} from './textures.js';

export function buildStudioEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x2d2118);

  // Soft warm afternoon window light panel (left-top)
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.15, 1.85) });
  const winMesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 6), winMat);
  winMesh.position.set(-7, 6, 4);
  winMesh.lookAt(0, 0, 0);
  envScene.add(winMesh);

  // Subtle cool sky fill panel (right-top)
  const fillMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 1.15, 1.35) });
  const fillMesh = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), fillMat);
  fillMesh.position.set(7, 5, 3);
  fillMesh.lookAt(0, 0, 0);
  envScene.add(fillMesh);

  // Warm oven glow reflector (back-low)
  const ovenMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.0, 0.35) });
  const ovenMesh = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), ovenMat);
  ovenMesh.position.set(0, 1.5, -6);
  ovenMesh.lookAt(0, 0, 0);
  envScene.add(ovenMesh);

  // Overhead cozy ceiling bounce
  const topMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 1.0, 0.88) });
  const topMesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), topMat);
  topMesh.position.set(0, 8, 0);
  topMesh.rotation.x = Math.PI / 2;
  envScene.add(topMesh);

  const envRT = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  return envRT.texture;
}

export function createEnvironment(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // --- Studio Lighting (Authentic Miniature Photography Setup) ---
  const hemi = new THREE.HemisphereLight(0xffeede, 0x6f472c, 0.72);
  scene.add(hemi);

  // Warm afternoon window key light casting soft miniature shadows
  const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.15);
  keyLight.position.set(-4.2, 7.6, 4.4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 1.5;
  keyLight.shadow.camera.far = 18;
  keyLight.shadow.camera.left = -4.8;
  keyLight.shadow.camera.right = 4.8;
  keyLight.shadow.camera.top = 4.8;
  keyLight.shadow.camera.bottom = -4.8;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.018;
  scene.add(keyLight);

  // Cool delicate rim/fill light from right window
  const rimLight = new THREE.DirectionalLight(0xcbe0f7, 0.58);
  rimLight.position.set(5.5, 4.2, -1.5);
  scene.add(rimLight);

  // Warm wood-fire oven light
  const ovenLight = new THREE.PointLight(0xff6b1c, 3.8, 9.5, 1.7);
  ovenLight.position.set(0, 0.75, -3.55);
  scene.add(ovenLight);

  // Secondary warm hearth bounce light near oven mouth
  const hearthGlow = new THREE.PointLight(0xff9b3e, 1.6, 6.0, 1.8);
  hearthGlow.position.set(0, 0.48, -2.15);
  scene.add(hearthGlow);

  // --- Oak Countertop (rich warm walnut-oak so light floury board & stoneware pop!) ---
  const counterTex = createWoodTextures({
    baseColor: '#694025',
    grainColor: '#3f2210',
    highlightColor: '#8d5b37',
    planks: 6,
    seed: 17,
    size: 512
  });
  counterTex.map.repeat.set(3.2, 2.8);
  counterTex.bumpMap.repeat.set(3.2, 2.8);

  const counterGeo = new THREE.BoxGeometry(18, 0.6, 15);
  const counterMat = new THREE.MeshStandardMaterial({
    map: counterTex.map,
    bumpMap: counterTex.bumpMap,
    bumpScale: 0.025,
    roughness: 0.68,
    metalness: 0.02
  });
  const counter = new THREE.Mesh(counterGeo, counterMat);
  counter.position.set(0, -0.3, 0.8);
  counter.receiveShadow = true;
  group.add(counter);

  // --- Back Kitchen Wall (Plaster & Cream Subway Tile) ---
  const wallTex = createWallTextures(512);
  wallTex.repeat.set(2.4, 1);
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.82,
    metalness: 0.02
  });
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), wallMat);
  backWall.position.set(0, 4.0, -5.1);
  backWall.receiveShadow = true;
  group.add(backWall);

  // Cozy wooden kitchen wall shelf in background (creates lovely tilt-shift bokeh depth!)
  const shelfWood = new THREE.MeshStandardMaterial({
    map: counterTex.map,
    roughness: 0.72
  });
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.16, 0.75), shelfWood);
  shelf.position.set(0, 3.15, -4.7);
  shelf.castShadow = true;
  shelf.receiveShadow = true;
  group.add(shelf);

  // Miniature props on the high shelf (jars, plates for authentic miniature studio feel)
  const jarColors = [0xd99b4e, 0xb83a2a, 0x5c7c47, 0xe8d9be];
  [-3.8, -3.1, 3.15, 3.85].forEach((sx, i) => {
    const jar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.24, 0.55, 16),
      new THREE.MeshStandardMaterial({
        color: jarColors[i],
        roughness: 0.25,
        metalness: 0.05
      })
    );
    jar.position.set(sx, 3.5, -4.68);
    group.add(jar);
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.23, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: 0xb68b5a, roughness: 0.8 })
    );
    lid.position.set(sx, 3.81, -4.68);
    group.add(lid);
  });

  // --- Woven Red-and-Cream Gingham Kitchen Cloth ---
  const clothTex = createGinghamTextures(256);
  clothTex.map.repeat.set(2.5, 2.2);
  clothTex.bumpMap.repeat.set(2.5, 2.2);
  const clothGeo = new THREE.BoxGeometry(2.35, 0.014, 2.15, 8, 1, 8);
  const cPos = clothGeo.attributes.position;
  for (let i = 0; i < cPos.count; i++) {
    const vx = cPos.getX(i);
    const vz = cPos.getZ(i);
    const wave = Math.sin(vx * 3.1) * Math.cos(vz * 2.7) * 0.004;
    cPos.setY(i, cPos.getY(i) + wave);
  }
  clothGeo.computeVertexNormals();

  const cloth = new THREE.Mesh(
    clothGeo,
    new THREE.MeshStandardMaterial({
      map: clothTex.map,
      bumpMap: clothTex.bumpMap,
      bumpScale: 0.014,
      roughness: 0.92
    })
  );
  cloth.position.set(-1.38, 0.01, 0.98);
  cloth.rotation.y = 0.14;
  cloth.receiveShadow = true;
  cloth.castShadow = true;
  group.add(cloth);

  // --- Flour-Dusted Oak Pastry Board (Hero Workspace!) ---
  const boardTex = createWoodTextures({
    baseColor: '#c29160',
    grainColor: '#8d5d33',
    highlightColor: '#dfba8e',
    planks: 5,
    seed: 29,
    size: 512,
    flourDust: true
  });
  const boardGroup = new THREE.Group();
  boardGroup.position.set(0, 0, 0.35);
  group.add(boardGroup);

  const boardGeo = new THREE.CylinderGeometry(1.52, 1.56, 0.12, 48);
  const boardMat = new THREE.MeshStandardMaterial({
    map: boardTex.map,
    bumpMap: boardTex.bumpMap,
    bumpScale: 0.016,
    roughness: 0.78,
    metalness: 0.01
  });
  const boardMesh = new THREE.Mesh(boardGeo, boardMat);
  boardMesh.position.y = 0.06;
  boardMesh.receiveShadow = true;
  boardMesh.castShadow = true;
  boardGroup.add(boardMesh);

  // Turned wooden handle tab on the pastry board (classic artisan pizza board!)
  const handleMat = new THREE.MeshStandardMaterial({
    map: boardTex.map,
    roughness: 0.72
  });
  const boardHandle = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.42), handleMat);
  boardHandle.position.set(1.64, 0.055, 0);
  boardHandle.castShadow = true;
  boardHandle.receiveShadow = true;
  boardGroup.add(boardHandle);
  const handleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.1, 20), handleMat);
  handleTip.position.set(1.9, 0.055, 0);
  handleTip.castShadow = true;
  handleTip.receiveShadow = true;
  boardGroup.add(handleTip);

  // Subtle dusty-flour target ring on the board surface (natural physical affordance!)
  const ringCanvas = document.createElement('canvas');
  ringCanvas.width = 256;
  ringCanvas.height = 256;
  const rCtx = ringCanvas.getContext('2d');
  rCtx.clearRect(0, 0, 256, 256);
  const rGrad = rCtx.createRadialGradient(128, 128, 86, 128, 128, 118);
  rGrad.addColorStop(0, 'rgba(255,252,245,0)');
  rGrad.addColorStop(0.52, 'rgba(255,252,245,0.22)');
  rGrad.addColorStop(0.75, 'rgba(255,252,245,0.34)');
  rGrad.addColorStop(1, 'rgba(255,252,245,0)');
  rCtx.fillStyle = rGrad;
  rCtx.fillRect(0, 0, 256, 256);
  const ringTex = new THREE.CanvasTexture(ringCanvas);
  const flourRing = new THREE.Mesh(
    new THREE.PlaneGeometry(2.55, 2.55),
    new THREE.MeshBasicMaterial({
      map: ringTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.72
    })
  );
  flourRing.rotation.x = -Math.PI / 2;
  flourRing.position.y = 0.123;
  boardGroup.add(flourRing);

  // --- Miniature Brick Pizza Oven (石窯) ---
  const ovenGroup = new THREE.Group();
  ovenGroup.position.set(0, 0, -3.55);
  group.add(ovenGroup);

  const brickTex = createBrickTextures(512);
  brickTex.map.repeat.set(2.2, 1.5);
  brickTex.bumpMap.repeat.set(2.2, 1.5);
  const brickMat = new THREE.MeshStandardMaterial({
    map: brickTex.map,
    bumpMap: brickTex.bumpMap,
    bumpScale: 0.045,
    roughness: 0.9,
    metalness: 0.02
  });

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x8d8277,
    roughness: 0.92,
    metalness: 0.04
  });

  const firebrickTex = createFirebrickTexture(256);
  firebrickTex.repeat.set(1.6, 1.4);
  const sootMat = new THREE.MeshStandardMaterial({
    map: firebrickTex,
    roughness: 0.94,
    metalness: 0.02
  });

  // Stone hearth plinth / floor extending cleanly forward (top at y = 0.15, zero z-fighting!)
  const hearthBase = new THREE.Mesh(new THREE.BoxGeometry(4.15, 0.15, 2.75), stoneMat);
  hearthBase.position.set(0, 0.075, 0.15);
  hearthBase.receiveShadow = true;
  hearthBase.castShadow = true;
  ovenGroup.add(hearthBase);

  // Inner firebrick cooking floor recessed cleanly inside the arch (front edge ends at z = +0.70, strictly behind facade!)
  const innerFloor = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.024, 1.98), sootMat);
  innerFloor.position.set(0, 0.162, -0.29);
  innerFloor.receiveShadow = true;
  ovenGroup.add(innerFloor);

  // Rear brick dome shell (ONLY rear hemisphere z <= 0 so front arch is 100% OPEN!)
  const domeGeo = new THREE.SphereGeometry(2.02, 28, 16, Math.PI, Math.PI, 0, Math.PI * 0.52);
  const domeMesh = new THREE.Mesh(domeGeo, brickMat);
  domeMesh.scale.set(1.0, 1.04, 0.88);
  domeMesh.position.set(0, 0.45, -0.05);
  domeMesh.castShadow = true;
  domeMesh.receiveShadow = true;
  ovenGroup.add(domeMesh);

  // Rear masonry lower back wall connecting dome to hearth plinth
  const rearWallGeo = new THREE.CylinderGeometry(2.02, 2.02, 0.5, 24, 1, true, Math.PI * 0.5, Math.PI);
  const rearWall = new THREE.Mesh(rearWallGeo, brickMat);
  rearWall.scale.set(1.0, 1.0, 0.88);
  rearWall.position.set(0, 0.35, -0.05);
  rearWall.castShadow = true;
  ovenGroup.add(rearWall);

  // Hollow brick side walls & arched vault roof connecting rear dome (z = -0.05) to front facade (z = +0.76)
  [-1, 1].forEach((side) => {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.38, 0.92), brickMat);
    sideWall.position.set(side * 1.68, 0.78, 0.38);
    sideWall.castShadow = true;
    sideWall.receiveShadow = true;
    ovenGroup.add(sideWall);
  });

  // Curved arched brick vault roof spanning cleanly over the open hearth
  const vaultShape = new THREE.Shape();
  vaultShape.absarc(0, 0.62, 2.02, 0, Math.PI, false);
  vaultShape.lineTo(-1.35, 0.62);
  vaultShape.absarc(0, 0.62, 1.35, Math.PI, 0, true);
  vaultShape.closePath();
  const vaultGeo = new THREE.ExtrudeGeometry(vaultShape, { depth: 0.92, bevelEnabled: false });
  const vUv = vaultGeo.attributes.uv;
  for (let i = 0; i < vUv.count; i++) {
    vUv.setXY(i, vUv.getX(i) * 0.25, vUv.getY(i) * 0.25);
  }
  const vaultRoof = new THREE.Mesh(vaultGeo, brickMat);
  vaultRoof.position.set(0, 0, -0.14);
  vaultRoof.castShadow = true;
  vaultRoof.receiveShadow = true;
  ovenGroup.add(vaultRoof);

  // Dark glowing inner rear hearth cavity (ONLY rear half z <= 0 so front view is completely unobstructed!)
  const cavityGeo = new THREE.SphereGeometry(1.62, 22, 14, Math.PI, Math.PI, 0, Math.PI * 0.55);
  const cavityMat = new THREE.MeshStandardMaterial({
    color: 0x261209,
    emissive: new THREE.Color(0x6e2005),
    emissiveIntensity: 0.68,
    roughness: 0.95,
    side: THREE.BackSide
  });
  const cavity = new THREE.Mesh(cavityGeo, cavityMat);
  cavity.scale.set(1.0, 0.98, 0.85);
  cavity.position.set(0, 0.18, -0.05);
  ovenGroup.add(cavity);

  // Dark soot-blackened inner back vertical wall behind the fire logs
  const backInnerWall = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.65),
    new THREE.MeshStandardMaterial({
      color: 0x220f08,
      emissive: new THREE.Color(0x5c1a04),
      emissiveIntensity: 0.55,
      roughness: 0.95
    })
  );
  backInnerWall.position.set(0, 0.9, -1.28);
  ovenGroup.add(backInnerWall);

  // Front brick facade with arched opening (width ~2.64, arch height ~1.94)
  const facadeShape = new THREE.Shape();
  facadeShape.moveTo(-2.02, 0.15);
  facadeShape.lineTo(2.02, 0.15);
  facadeShape.lineTo(2.02, 0.62);
  facadeShape.absarc(0, 0.62, 2.02, 0, Math.PI, false);
  facadeShape.lineTo(-2.02, 0.15);

  // Arch cutout wide & tall enough to see the fire & bubbling golden pizza clearly!
  const archHole = new THREE.Path();
  archHole.moveTo(-1.32, 0.15);
  archHole.lineTo(-1.32, 0.62);
  archHole.absarc(0, 0.62, 1.32, Math.PI, 0, true);
  archHole.lineTo(1.32, 0.15);
  archHole.lineTo(-1.32, 0.15);
  facadeShape.holes.push(archHole);

  const facadeGeo = new THREE.ExtrudeGeometry(facadeShape, {
    depth: 0.36,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.035,
    bevelSegments: 3
  });
  const fUv = facadeGeo.attributes.uv;
  for (let i = 0; i < fUv.count; i++) {
    fUv.setXY(i, fUv.getX(i) * 0.25, fUv.getY(i) * 0.25);
  }
  const facade = new THREE.Mesh(facadeGeo, brickMat);
  facade.position.set(0, 0, 0.72);
  facade.castShadow = true;
  facade.receiveShadow = true;
  ovenGroup.add(facade);

  // Individual hand-laid keystone arch bricks framing the oven mouth cleanly!
  const archBrickCount = 15;
  const archBrickMatA = new THREE.MeshStandardMaterial({ color: 0xa6482d, roughness: 0.88 });
  const archBrickMatB = new THREE.MeshStandardMaterial({ color: 0x8e3b24, roughness: 0.9 });
  for (let i = 0; i < archBrickCount; i++) {
    const t = i / (archBrickCount - 1);
    const ang = Math.PI - t * Math.PI;
    const r = 1.38;
    const bx = Math.cos(ang) * r;
    const by = 0.62 + Math.sin(ang) * r;
    const bMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.145, 0.42),
      i % 2 === 0 ? archBrickMatA : archBrickMatB
    );
    bMesh.position.set(bx, by, 0.91);
    bMesh.rotation.z = ang;
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    ovenGroup.add(bMesh);
  }

  // Brick chimney rising from front-top of oven
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.55, 0.78), brickMat);
  chimney.position.set(0, 2.75, 0.48);
  chimney.castShadow = true;
  chimney.receiveShadow = true;
  ovenGroup.add(chimney);

  const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.14, 0.94), stoneMat);
  chimneyCap.position.set(0, 3.55, 0.48);
  ovenGroup.add(chimneyCap);

  // --- Wood Fire & Glowing Embers inside the Brick Oven ---
  const fireGroup = new THREE.Group();
  fireGroup.position.set(0, 0.19, -0.78);
  ovenGroup.add(fireGroup);

  const logMat = new THREE.MeshStandardMaterial({
    color: 0x3a2013,
    emissive: new THREE.Color(0x6e1f05),
    emissiveIntensity: 0.65,
    roughness: 0.95
  });
  const logPositions = [
    { p: [-0.35, 0.08, -0.05], r: [0.1, 0.45, Math.PI / 2] },
    { p: [0.35, 0.08, -0.08], r: [-0.1, -0.4, Math.PI / 2] },
    { p: [0.0, 0.15, -0.15], r: [0.15, 0.1, Math.PI / 2] }
  ];
  for (const lp of logPositions) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.82, 10), logMat);
    log.position.set(...lp.p);
    log.rotation.set(...lp.r);
    fireGroup.add(log);
  }

  // Glowing ember bed
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xff5a12,
    emissive: new THREE.Color(0xff4e08),
    emissiveIntensity: 2.2,
    roughness: 0.7
  });
  const embers = [];
  for (let i = 0; i < 12; i++) {
    const em = new THREE.Mesh(new THREE.DodecahedronGeometry(0.065 + (i % 3) * 0.025, 0), emberMat);
    const a = (i / 12) * Math.PI * 2;
    const rad = 0.15 + (i % 4) * 0.14;
    em.position.set(Math.cos(a) * rad * 1.4, 0.05, Math.sin(a) * rad * 0.45);
    fireGroup.add(em);
    embers.push(em);
  }

  // Photographic soft feathered wood-fire flame sprites inside oven (zero sharp low-poly triangles!)
  const flameTex = createFlameTexture(128);
  const flames = [];
  const flameTints = [0xff7224, 0xffaa36, 0xffe074];
  for (let i = 0; i < 10; i++) {
    const fMat = new THREE.SpriteMaterial({
      map: flameTex,
      color: flameTints[i % flameTints.length],
      transparent: true,
      opacity: 0.86,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const sp = new THREE.Sprite(fMat);
    sp.center.set(0.5, 0.12);
    const baseW = 0.36 + (i % 3) * 0.12;
    const baseH = 0.52 + (i % 3) * 0.18;
    sp.position.set((i - 4.5) * 0.16, 0.06, (i % 2) * 0.1 - 0.1);
    sp.scale.set(baseW, baseH, 1);
    sp.userData.phase = i * 1.37;
    sp.userData.baseW = baseW;
    sp.userData.baseH = baseH;
    fireGroup.add(sp);
    flames.push(sp);
  }

  // --- Miniature Wooden Bellows (ふいご) beside the oven (interactive during baking!) ---
  const bellowsGroup = new THREE.Group();
  bellowsGroup.position.set(-2.15, 0.08, -2.32);
  bellowsGroup.rotation.y = 0.72;
  group.add(bellowsGroup);

  const bellowsWood = new THREE.MeshStandardMaterial({ color: 0x7e4626, roughness: 0.62 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x4f2318, roughness: 0.88 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd9a84c, roughness: 0.25, metalness: 0.85 });

  // Sculpted teardrop paddle profile for realistic miniature wooden bellows
  const paddleShape = new THREE.Shape();
  paddleShape.moveTo(0, 0.34);
  paddleShape.bezierCurveTo(0.28, 0.24, 0.32, -0.14, 0.11, -0.34);
  paddleShape.lineTo(-0.11, -0.34);
  paddleShape.bezierCurveTo(-0.32, -0.14, -0.28, 0.24, 0, 0.34);
  const paddleGeo = new THREE.ExtrudeGeometry(paddleShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2
  });
  paddleGeo.rotateX(Math.PI / 2);

  const bellowsLower = new THREE.Mesh(paddleGeo, bellowsWood);
  bellowsLower.position.y = 0.04;
  bellowsLower.castShadow = true;
  bellowsGroup.add(bellowsLower);

  const bellowsAccord = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.14, 16), leatherMat);
  bellowsAccord.position.set(0, 0.095, -0.02);
  bellowsAccord.scale.set(1.0, 1, 1.15);
  bellowsGroup.add(bellowsAccord);

  const bellowsUpper = new THREE.Mesh(paddleGeo, bellowsWood);
  bellowsUpper.position.y = 0.19;
  bellowsUpper.castShadow = true;
  bellowsGroup.add(bellowsUpper);

  // Brass nozzle pointing cleanly toward the brick oven mouth
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.055, 0.34, 12), brassMat);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0.09, -0.48);
  bellowsGroup.add(nozzle);

  // Turned wooden handles
  const bHandle1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.34, 10), bellowsWood);
  bHandle1.rotation.x = Math.PI / 2;
  bHandle1.position.set(0, 0.035, 0.48);
  bellowsGroup.add(bHandle1);
  const bHandle2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.34, 10), bellowsWood);
  bHandle2.rotation.x = Math.PI / 2;
  bHandle2.position.set(0, 0.18, 0.48);
  bellowsGroup.add(bHandle2);

  // --- Miniature Brass Counter Bell on the Oven Front-Right Ledge ---
  const bellGroup = new THREE.Group();
  bellGroup.position.set(1.78, 0.16, -2.35);
  group.add(bellGroup);

  const bellBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.27, 0.06, 20),
    new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.7 })
  );
  bellBase.position.y = 0.03;
  bellBase.castShadow = true;
  bellGroup.add(bellBase);

  const bellDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    brassMat
  );
  bellDome.position.y = 0.05;
  bellDome.castShadow = true;
  bellGroup.add(bellDome);

  const bellKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.08, 12), brassMat);
  bellKnob.position.y = 0.29;
  bellGroup.add(bellKnob);

  // --- Interactive Flour Pinch Bowl (tap anytime for a playful flour poof!) ---
  const flourBowlGroup = new THREE.Group();
  flourBowlGroup.position.set(-2.95, 0, -1.62);
  group.add(flourBowlGroup);

  const creamCeramic = new THREE.MeshStandardMaterial({
    map: createCeramicTexture('#ebe1d2', 19),
    roughness: 0.35,
    metalness: 0.04
  });
  const fBowlPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.22, 0),
    new THREE.Vector2(0.32, 0.14),
    new THREE.Vector2(0.34, 0.28),
    new THREE.Vector2(0.3, 0.28),
    new THREE.Vector2(0.26, 0.1),
    new THREE.Vector2(0, 0.07)
  ];
  const fBowlMesh = new THREE.Mesh(new THREE.LatheGeometry(fBowlPts, 24), creamCeramic);
  fBowlMesh.castShadow = true;
  fBowlMesh.receiveShadow = true;
  flourBowlGroup.add(fBowlMesh);

  const flourMound = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({ color: 0xfbf8f1, roughness: 0.98 })
  );
  flourMound.scale.set(1, 0.45, 1);
  flourMound.position.y = 0.19;
  flourBowlGroup.add(flourMound);

  // Tiny wooden flour scoop sticking out
  const scoopStick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.025, 0.42, 8),
    new THREE.MeshStandardMaterial({ color: 0xc5925d, roughness: 0.72 })
  );
  scoopStick.position.set(0.14, 0.33, 0.08);
  scoopStick.rotation.z = -0.58;
  scoopStick.rotation.x = 0.25;
  flourBowlGroup.add(scoopStick);

  // --- Miniature Background Studio Props (Potted Fresh Basil & Glass Olive Oil Bottle) ---
  // Terracotta basil herb pot on back-left (interactive rustle + fresh basil toss in TOPPINGS!)
  const herbPot = new THREE.Group();
  herbPot.position.set(-3.1, 0, -2.88);
  group.add(herbPot);

  const terraMat = new THREE.MeshStandardMaterial({
    map: createCeramicTexture('#ba603d', 53),
    roughness: 0.86
  });
  const potBody = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.25, 0.54, 20), terraMat);
  potBody.position.y = 0.27;
  potBody.castShadow = true;
  potBody.receiveShadow = true;
  herbPot.add(potBody);
  const potRim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.37, 0.11, 20), terraMat);
  potRim.position.y = 0.54;
  potRim.castShadow = true;
  herbPot.add(potRim);

  // Dark rich potting soil
  const soil = new THREE.Mesh(
    new THREE.CircleGeometry(0.33, 18),
    new THREE.MeshStandardMaterial({ color: 0x3b2619, roughness: 0.98 })
  );
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = 0.56;
  herbPot.add(soil);

  // Sculpted real basil leaf geometry with normalized [0..1] UVs
  const herbLeafShape = new THREE.Shape();
  herbLeafShape.moveTo(0, -0.11);
  herbLeafShape.bezierCurveTo(0.11, -0.05, 0.1, 0.08, 0, 0.16);
  herbLeafShape.bezierCurveTo(-0.1, 0.08, -0.11, -0.05, 0, -0.11);
  const herbLeafGeo = new THREE.ShapeGeometry(herbLeafShape, 8);
  herbLeafGeo.rotateX(-Math.PI / 2);
  const hPos = herbLeafGeo.attributes.position;
  const hUv = herbLeafGeo.attributes.uv;
  for (let i = 0; i < hPos.count; i++) {
    const x = hPos.getX(i);
    const z = hPos.getZ(i);
    hPos.setY(i, Math.abs(x) * 0.25 - z * z * 0.55);
    hUv.setXY(i, (x + 0.11) / 0.22, (z + 0.16) / 0.27);
  }
  herbLeafGeo.computeVertexNormals();
  const herbLeafMat = new THREE.MeshStandardMaterial({
    map: createBasilTexture(),
    roughness: 0.52,
    side: THREE.DoubleSide
  });

  const herbFoliage = new THREE.Group();
  herbFoliage.position.y = 0.56;
  herbPot.add(herbFoliage);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + (i % 3) * 0.35;
    const tier = i % 3;
    const h = 0.14 + tier * 0.14 + (i % 2) * 0.04;
    const r = 0.07 + (2 - tier) * 0.075;
    const leaf = new THREE.Mesh(herbLeafGeo, herbLeafMat);
    leaf.scale.setScalar(1.05 + (i % 2) * 0.25);
    leaf.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
    leaf.rotation.set(0.42 - tier * 0.12, -a + Math.PI / 2, (i % 2 === 0 ? 1 : -1) * 0.25);
    leaf.castShadow = true;
    herbFoliage.add(leaf);
  }

  // Miniature Olive Oil Glass Bottle on back-right (crisp specular emerald-gold glass + inner oil!)
  const oilGroup = new THREE.Group();
  oilGroup.position.set(3.05, 0, -2.62);
  group.add(oilGroup);

  // Inner golden extra-virgin olive oil column
  const oilLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.23, 0.46, 18),
    new THREE.MeshStandardMaterial({
      color: 0xc9961c,
      emissive: new THREE.Color(0x4a3104),
      emissiveIntensity: 0.25,
      roughness: 0.16,
      metalness: 0.05
    })
  );
  oilLiquid.position.y = 0.25;
  oilGroup.add(oilLiquid);

  const oilGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x4b6a2c,
    roughness: 0.06,
    metalness: 0.04,
    transparent: true,
    opacity: 0.68,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05
  });
  const bottlePts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.27, 0),
    new THREE.Vector2(0.29, 0.52),
    new THREE.Vector2(0.11, 0.84),
    new THREE.Vector2(0.092, 1.26),
    new THREE.Vector2(0.12, 1.32)
  ];
  const bottle = new THREE.Mesh(new THREE.LatheGeometry(bottlePts, 24), oilGlassMat);
  bottle.castShadow = true;
  oilGroup.add(bottle);

  // Natural hemp twine collar wrapped around bottle neck
  const twine = new THREE.Mesh(
    new THREE.TorusGeometry(0.105, 0.018, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0xcab08a, roughness: 0.95 })
  );
  twine.rotation.x = Math.PI / 2;
  twine.position.y = 0.96;
  oilGroup.add(twine);

  const cork = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.072, 0.18, 12),
    new THREE.MeshStandardMaterial({ color: 0xb68657, roughness: 0.92 })
  );
  cork.position.y = 1.38;
  oilGroup.add(cork);

  // Animation state
  let fireBoost = 0;
  let bellowsPump = 0;
  let bellBounce = 0;
  let flourWobble = 0;
  let herbRustle = 0;
  let oilClink = 0;

  return {
    group,
    boardGroup,
    flourRing,
    ovenGroup,
    bellowsGroup,
    bellGroup,
    flourBowlGroup,
    herbPot,
    oilGroup,
    ovenLight,
    hearthGlow,
    cavityMat,
    keyLight,
    triggerFireBoost() {
      fireBoost = Math.min(1.6, fireBoost + 0.95);
      bellowsPump = 1.0;
    },
    triggerBell() {
      bellBounce = 1.0;
    },
    triggerFlourWobble() {
      flourWobble = 1.0;
    },
    triggerHerbRustle() {
      herbRustle = 1.0;
    },
    triggerOilClink() {
      oilClink = 1.0;
    },
    update(dt, elapsed, isBaking = false) {
      fireBoost = Math.max(0, fireBoost - dt * 1.45);
      bellowsPump = Math.max(0, bellowsPump - dt * 3.8);
      bellBounce = Math.max(0, bellBounce - dt * 2.6);
      flourWobble = Math.max(0, flourWobble - dt * 4.5);
      herbRustle = Math.max(0, herbRustle - dt * 3.2);
      oilClink = Math.max(0, oilClink - dt * 3.5);

      // Animate oven firelight & soft feathered flames
      const baseIntensity = isBaking ? 5.6 : 3.4;
      const flicker =
        Math.sin(elapsed * 11.3) * 0.35 +
        Math.sin(elapsed * 19.7) * 0.2 +
        Math.cos(elapsed * 7.1) * 0.2;
      const boost = fireBoost * 4.2;
      ovenLight.intensity = baseIntensity + flicker + boost;
      hearthGlow.intensity = (isBaking ? 2.6 : 1.3) + flicker * 0.4 + boost * 0.45;
      cavityMat.emissiveIntensity = (isBaking ? 0.95 : 0.48) + fireBoost * 0.6;

      for (const f of flames) {
        const ph = f.userData.phase;
        const mult = 0.85 + (isBaking ? 0.32 : 0) + fireBoost * 0.58;
        const hScale = f.userData.baseH * mult * (0.84 + 0.24 * Math.sin(elapsed * 11.5 + ph));
        const wScale = f.userData.baseW * (0.9 + 0.16 * Math.cos(elapsed * 9.5 + ph));
        f.scale.set(wScale, hScale, 1);
        f.material.rotation = Math.sin(elapsed * 8.5 + ph) * 0.14;
      }

      // Bellows squeeze animation
      const sq = Math.sin(bellowsPump * Math.PI);
      bellowsUpper.position.y = 0.19 - sq * 0.085;
      bellowsAccord.scale.y = 1 - sq * 0.45;
      bellowsAccord.position.y = 0.095 - sq * 0.036;
      bHandle2.position.y = 0.18 - sq * 0.085;

      // Brass bell happy bounce
      if (bellBounce > 0) {
        const b = Math.sin(bellBounce * Math.PI * 4) * bellBounce;
        bellGroup.position.y = 0.15 + Math.abs(b) * 0.08;
        bellGroup.rotation.z = b * 0.14;
        bellKnob.position.y = 0.29 - Math.max(0, Math.sin(bellBounce * Math.PI)) * 0.035;
      } else {
        bellGroup.position.y = 0.15;
        bellGroup.rotation.z = 0;
        bellKnob.position.y = 0.29;
      }

      // Flour bowl cute jiggle
      flourBowlGroup.rotation.z = flourWobble > 0 ? Math.sin(flourWobble * Math.PI * 5) * flourWobble * 0.12 : 0;

      // Herb foliage rustle
      herbFoliage.rotation.z = herbRustle > 0 ? Math.sin(herbRustle * Math.PI * 6) * herbRustle * 0.16 : 0;
      herbFoliage.rotation.x = herbRustle > 0 ? Math.cos(herbRustle * Math.PI * 5) * herbRustle * 0.1 : 0;

      // Olive oil bottle gentle glassy clink tilt
      oilGroup.rotation.z = oilClink > 0 ? Math.sin(oilClink * Math.PI * 4) * oilClink * 0.11 : 0;
    }
  };
}
