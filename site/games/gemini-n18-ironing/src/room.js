import * as THREE from 'three';
import { createContactShadowTexture } from './assets.js';

export const BOARD_Y = 0.84;
export const BOARD_HALF_LEN = 0.48; // Total board length = 0.96m (compact & ergonomic for iPhone + iPad!)
export const BOARD_WIDTH = 0.37;

/**
 * Real tapered ironing-board half-width for x in [-0.48, +0.48].
 * Left (-X) tapers smoothly to a rounded nose; right (+X) is squared with soft corners.
 */
export function boardHalfWidthAt(x) {
  const halfW = BOARD_WIDTH * 0.5;
  if (x >= -0.02) {
    // Gentle corner rounding near right tail x = +0.48
    if (x > 0.40) {
      const u = Math.min(1, (x - 0.40) / 0.08);
      return halfW * Math.sqrt(Math.max(0.002, 1 - u * u * 0.82));
    }
    return halfW;
  }
  const t = Math.min(1, Math.max(0, (-0.02 - x) / 0.46));
  if (t < 0.70) {
    const k = t / 0.70;
    return halfW * (1 - 0.36 * Math.pow(k, 1.55));
  }
  const u = (t - 0.70) / 0.30;
  return halfW * 0.64 * Math.sqrt(Math.max(0.0005, 1 - u * u));
}

function groundModelToY(model, targetY = 0) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  model.position.y += targetY - box.min.y;
  model.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(model);
}

/**
 * Builds the sunlit living room, padded ecru-linen ironing board, oak side table,
 * wicker laundry basket on oak stool, potted plant by the sunlit window, and glass spray bottle.
 */
export function buildRoomAndBoard(scene, assets) {
  const { textures, models } = assets;
  const contactTex = createContactShadowTexture();
  const root = new THREE.Group();
  scene.add(root);

  // =========================================================
  // 1. REAL SUNLIT LIVING ROOM ARCHITECTURE
  // =========================================================
  const floorMat = new THREE.MeshStandardMaterial({
    map: textures.woodFloor.map,
    normalMap: textures.woodFloor.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    aoMap: textures.woodFloor.armMap,
    aoMapIntensity: 0.72,
    roughnessMap: textures.woodFloor.armMap,
    roughness: 0.76,
    metalness: 0.0,
    envMapIntensity: 0.65,
  });
  const floorGeo = new THREE.PlaneGeometry(6.2, 6.0);
  floorGeo.setAttribute('uv2', floorGeo.attributes.uv);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -0.7);
  floor.receiveShadow = true;
  root.add(floor);

  // Warm woven linen area rug with subtle stitched border hem
  const rugTex = textures.rugLinen.map;
  rugTex.repeat.set(3.2, 2.4);
  const rugMat = new THREE.MeshStandardMaterial({
    map: rugTex,
    normalMap: textures.rugLinen.normalMap,
    normalScale: new THREE.Vector2(1.05, 1.05),
    aoMap: textures.rugLinen.armMap,
    aoMapIntensity: 0.75,
    roughnessMap: textures.rugLinen.armMap,
    roughness: 0.96,
    metalness: 0.0,
    color: new THREE.Color('#cfc4b2'),
    envMapIntensity: 0.3,
  });
  const rug = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.008, 1.72), rugMat);
  rug.position.set(0.35, 0.004, -1.68);
  rug.receiveShadow = true;
  root.add(rug);

  // Subtle darker woven border trim framing the rug edges
  const rugBorderMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#b6a995'),
    roughness: 0.95,
    metalness: 0.0,
  });
  const rugBorder = new THREE.Mesh(new THREE.BoxGeometry(2.61, 0.006, 1.78), rugBorderMat);
  rugBorder.position.set(0.35, 0.003, -1.68);
  rugBorder.receiveShadow = true;
  root.add(rugBorder);

  const wallMat = new THREE.MeshStandardMaterial({
    map: textures.whitePlaster.map,
    normalMap: textures.whitePlaster.normalMap,
    normalScale: new THREE.Vector2(0.28, 0.28),
    aoMap: textures.whitePlaster.armMap,
    aoMapIntensity: 0.4,
    roughnessMap: textures.whitePlaster.armMap,
    roughness: 0.92,
    metalness: 0.0,
    color: new THREE.Color('#f5f0e7'),
    envMapIntensity: 0.45,
  });

  // Back wall (generous room depth so sofa sits naturally in the sunlit background!)
  const backWallGeo = new THREE.PlaneGeometry(6.4, 3.3);
  backWallGeo.setAttribute('uv2', backWallGeo.attributes.uv);
  const backWall = new THREE.Mesh(backWallGeo, wallMat);
  backWall.position.set(0, 1.65, -2.65);
  backWall.receiveShadow = true;
  root.add(backWall);

  // Right wall
  const rightWallGeo = new THREE.PlaneGeometry(6.0, 3.3);
  rightWallGeo.setAttribute('uv2', rightWallGeo.attributes.uv);
  const rightWall = new THREE.Mesh(rightWallGeo, wallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(2.4, 1.65, -0.5);
  rightWall.receiveShadow = true;
  root.add(rightWall);

  // Left wall with bright sunlit morning window (positioned so window glow & curtain edge enrich the room!)
  const leftX = -1.48;
  const winZ1 = -2.05;
  const winZ2 = -0.35;
  const winY1 = 0.68;
  const winY2 = 2.45;

  function addLeftWallSeg(yCenter, h, zCenter, w) {
    const g = new THREE.PlaneGeometry(w, h);
    g.setAttribute('uv2', g.attributes.uv);
    const m = new THREE.Mesh(g, wallMat);
    m.rotation.y = Math.PI / 2;
    m.position.set(leftX, yCenter, zCenter);
    m.receiveShadow = true;
    root.add(m);
  }
  addLeftWallSeg(winY1 * 0.5, winY1, (winZ1 + winZ2) * 0.5, winZ2 - winZ1);
  addLeftWallSeg(winY2 + (3.3 - winY2) * 0.5, 3.3 - winY2, (winZ1 + winZ2) * 0.5, winZ2 - winZ1);
  addLeftWallSeg(1.65, 3.3, -2.65 + (winZ1 + 2.65) * 0.5, winZ1 + 2.65);
  addLeftWallSeg(1.65, 3.3, winZ2 + (2.3 - winZ2) * 0.5, 2.3 - winZ2);

  // Natural warm white-oak wood trim, baseboards, mullions & stool
  const oakMat = new THREE.MeshStandardMaterial({
    map: textures.whiteOak.map,
    normalMap: textures.whiteOak.normalMap,
    normalScale: new THREE.Vector2(0.4, 0.4),
    aoMap: textures.whiteOak.armMap,
    roughnessMap: textures.whiteOak.armMap,
    roughness: 0.62,
    metalness: 0.0,
    color: new THREE.Color('#e8d8c2'),
  });

  const baseboardBack = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.11, 0.022), oakMat);
  baseboardBack.position.set(0, 0.055, -2.64);
  baseboardBack.receiveShadow = true;
  root.add(baseboardBack);

  const baseboardLeft = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.11, 5.2), oakMat);
  baseboardLeft.position.set(leftX + 0.011, 0.055, -0.3);
  baseboardLeft.receiveShadow = true;
  root.add(baseboardLeft);

  const winW = winZ2 - winZ1;
  const winH = winY2 - winY1;
  const winZc = (winZ1 + winZ2) * 0.5;
  const winYc = (winY1 + winY2) * 0.5;

  const sill = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.038, winW + 0.14), oakMat);
  sill.position.set(leftX - 0.03, winY1 - 0.019, winZc);
  sill.castShadow = true;
  sill.receiveShadow = true;
  root.add(sill);

  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, winW + 0.08), oakMat);
  frameTop.position.set(leftX - 0.07, winY2 + 0.02, winZc);
  root.add(frameTop);

  for (const zPos of [winZ1, winZc, winZ2]) {
    const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.08, winH, 0.042), oakMat);
    mullionV.position.set(leftX - 0.09, winYc, zPos);
    mullionV.castShadow = true;
    root.add(mullionV);
  }
  const mullionH = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, winW), oakMat);
  mullionH.position.set(leftX - 0.09, winYc + 0.12, winZc);
  mullionH.castShadow = true;
  root.add(mullionH);

  // Bright morning outdoor sky + soft green garden foliage outside window
  const outsideCanvas = document.createElement('canvas');
  outsideCanvas.width = 256;
  outsideCanvas.height = 256;
  const octx = outsideCanvas.getContext('2d');
  const ograd = octx.createLinearGradient(0, 0, 0, 256);
  ograd.addColorStop(0.0, '#d8ecff');
  ograd.addColorStop(0.55, '#fff9ee');
  ograd.addColorStop(0.75, '#dce9ce');
  ograd.addColorStop(1.0, '#a3ba8e');
  octx.fillStyle = ograd;
  octx.fillRect(0, 0, 256, 256);
  const outsideTex = new THREE.CanvasTexture(outsideCanvas);
  outsideTex.colorSpace = THREE.SRGBColorSpace;

  const outsidePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(winW + 0.9, winH + 0.9),
    new THREE.MeshBasicMaterial({ map: outsideTex, toneMapped: false })
  );
  outsidePlane.rotation.y = Math.PI / 2;
  outsidePlane.position.set(leftX - 0.35, winYc, winZc);
  root.add(outsidePlane);

  // Sheer translucent pleated linen curtain (standard alpha transparency — zero extra transmission pass!)
  const curtainGeo = new THREE.PlaneGeometry(0.76, 2.45, 22, 20);
  const cPos = curtainGeo.attributes.position;
  for (let i = 0; i < cPos.count; i++) {
    const u = cPos.getX(i);
    const v = cPos.getY(i);
    const pleat = Math.sin(u * 26) * 0.026 + Math.sin(u * 11 + 0.7) * 0.014;
    const drape = (1.22 - v) * 0.018;
    cPos.setZ(i, pleat + drape);
  }
  curtainGeo.computeVertexNormals();
  const curtainMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fbf7f0'),
    roughness: 0.94,
    metalness: 0.0,
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  });
  const curtain = new THREE.Mesh(curtainGeo, curtainMat);
  curtain.rotation.y = Math.PI / 2;
  curtain.position.set(leftX + 0.09, 1.32, winZ1 + 0.25);
  root.add(curtain);

  // Warm diagonal sunlight window patch on the hardwood floor & back wall
  const sunPatchCanvas = document.createElement('canvas');
  sunPatchCanvas.width = 256;
  sunPatchCanvas.height = 256;
  const spCtx = sunPatchCanvas.getContext('2d');
  const spGrad = spCtx.createRadialGradient(128, 128, 16, 128, 128, 122);
  spGrad.addColorStop(0, 'rgba(255, 245, 222, 0.24)');
  spGrad.addColorStop(0.65, 'rgba(255, 242, 212, 0.08)');
  spGrad.addColorStop(1, 'rgba(255, 242, 212, 0.0)');
  spCtx.fillStyle = spGrad;
  spCtx.fillRect(0, 0, 256, 256);
  const sunPatchTex = new THREE.CanvasTexture(sunPatchCanvas);
  sunPatchTex.colorSpace = THREE.SRGBColorSpace;
  const floorSunPatch = new THREE.Mesh(
    new THREE.PlaneGeometry(1.85, 1.35),
    new THREE.MeshBasicMaterial({
      map: sunPatchTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  floorSunPatch.rotation.x = -Math.PI / 2;
  floorSunPatch.position.set(-0.35, 0.005, -0.95);
  root.add(floorSunPatch);

  // =========================================================
  // 2. REAL CC0 FURNITURE & ROOM PROPS (Poly Haven glTF)
  // =========================================================
  // Sofa tucked gracefully back against the sunlit living-room wall (depth, not clutter!)
  const sofa = models.sofa.clone();
  sofa.scale.setScalar(0.86);
  sofa.position.set(0.55, 0, -2.14);
  sofa.rotation.y = -0.05;
  groundModelToY(sofa, 0.008);
  root.add(sofa);

  // Potted houseplant soaking up morning sunlight near the left window
  const plant = models.pottedPlant.clone();
  plant.scale.setScalar(1.38);
  plant.position.set(-0.96, 0, -1.48);
  plant.rotation.y = 0.72;
  groundModelToY(plant, 0);
  root.add(plant);

  // Wooden Side Table positioned behind-left so its warm oak tabletop & growing folded laundry stack
  // are clearly visible right above the ironing board in BOTH iPad landscape and iPhone portrait!
  const sideTable = models.sideTable.clone();
  sideTable.scale.setScalar(1.06);
  sideTable.position.set(-0.31, 0, -0.82);
  sideTable.rotation.y = 0.12;
  const tableBox = groundModelToY(sideTable, 0);
  root.add(sideTable);

  const stackSurfacePos = new THREE.Vector3(
    (tableBox.min.x + tableBox.max.x) * 0.5,
    tableBox.max.y,
    (tableBox.min.z + tableBox.max.z) * 0.5
  );

  // Solid-oak stool + Wicker Laundry Basket positioned behind-right (-0.82) at clear eye height
  // so the real woven wicker basket & softly draped crumpled clothes are unmistakable in both views!
  const stoolH = 0.56;
  const stoolGroup = new THREE.Group();
  const stoolTop = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.16, 0.026, 28), oakMat);
  stoolTop.position.y = stoolH - 0.013;
  stoolTop.castShadow = true;
  stoolTop.receiveShadow = true;
  stoolGroup.add(stoolTop);

  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.010, stoolH - 0.02, 12), oakMat);
    leg.position.set(Math.cos(ang) * 0.11, (stoolH - 0.02) * 0.5, Math.sin(ang) * 0.11);
    leg.rotation.z = -Math.cos(ang) * 0.09;
    leg.rotation.x = Math.sin(ang) * 0.09;
    leg.castShadow = true;
    leg.receiveShadow = true;
    stoolGroup.add(leg);
  }
  stoolGroup.position.set(0.24, 0, -0.82);
  root.add(stoolGroup);

  const basketGroup = new THREE.Group();
  const basket = models.wickerBasket.clone();
  const rawBasketBox = new THREE.Box3().setFromObject(basket);
  const rawW = Math.max(0.01, rawBasketBox.max.x - rawBasketBox.min.x);
  const targetBasketW = 0.40;
  basket.scale.setScalar(targetBasketW / rawW);
  const bBox = groundModelToY(basket, 0);
  // Center basket horizontally over stool so cloth mounds align cleanly inside the basket opening!
  const bCenterX = (bBox.min.x + bBox.max.x) * 0.5;
  const bCenterZ = (bBox.min.z + bBox.max.z) * 0.5;
  basket.position.x -= bCenterX;
  basket.position.z -= bCenterZ;
  basketGroup.add(basket);
  basketGroup.position.set(0.24, stoolH, -0.82);
  basketGroup.rotation.y = -0.85; // Angle hinged lid naturally toward back-right!
  root.add(basketGroup);

  // Position cloth mounds cleanly inside the round woven opening (offset slightly toward basket body away from open lid)
  const basketRimPos = new THREE.Vector3(0.195, stoolH + (bBox.max.y - bBox.min.y) * 0.80, -0.855);

  // Soft floor contact shadows for realistic furniture grounding
  function addContactShadow(x, y, z, sx, sz, opacity = 0.5) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(sx, sz),
      new THREE.MeshBasicMaterial({
        map: contactTex,
        transparent: true,
        opacity,
        depthWrite: false,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    root.add(m);
    return m;
  }
  const tableW = tableBox.max.x - tableBox.min.x;
  const tableD = tableBox.max.z - tableBox.min.z;
  addContactShadow(-0.31, 0.003, -0.82, tableW * 1.4, tableD * 1.4, 0.52);
  addContactShadow(0.24, 0.003, -0.82, 0.52, 0.52, 0.48);
  addContactShadow(-0.96, 0.003, -1.48, 0.62, 0.62, 0.55);
  addContactShadow(0.55, 0.009, -2.06, 2.1, 0.95, 0.42);
  addContactShadow(0.0, 0.003, 0.0, 1.25, 0.58, 0.48);

  // =========================================================
  // 3. REALISTIC PADDED ECRU-LINEN IRONING BOARD
  // =========================================================
  const boardGroup = new THREE.Group();
  root.add(boardGroup);

  const boardGeo = buildIroningBoardGeometry();
  const coverMat = new THREE.MeshStandardMaterial({
    map: textures.ecruLinen.map,
    normalMap: textures.ecruLinen.normalMap,
    normalScale: new THREE.Vector2(0.82, 0.82),
    aoMap: textures.ecruLinen.armMap,
    aoMapIntensity: 0.55,
    roughnessMap: textures.ecruLinen.armMap,
    roughness: 0.91,
    metalness: 0.0,
    envMapIntensity: 0.42,
  });
  const boardTopMesh = new THREE.Mesh(boardGeo, coverMat);
  boardTopMesh.castShadow = true;
  boardTopMesh.receiveShadow = true;
  boardGroup.add(boardTopMesh);

  // Delicate stitched cotton bias-tape piping around the board edge
  const pipingCurvePts = [];
  const segs = 72;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const x = Math.cos(a) * BOARD_HALF_LEN;
    const hw = boardHalfWidthAt(x);
    const z = Math.sin(a) * hw;
    pipingCurvePts.push(new THREE.Vector3(x, BOARD_Y - 0.012, z));
  }
  const pipingCurve = new THREE.CatmullRomCurve3(pipingCurvePts, true);
  const pipingGeo = new THREE.TubeGeometry(pipingCurve, 96, 0.0036, 8, true);
  const pipingMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d4cab9'),
    roughness: 0.88,
    metalness: 0.0,
  });
  const pipingMesh = new THREE.Mesh(pipingGeo, pipingMat);
  pipingMesh.castShadow = true;
  boardGroup.add(pipingMesh);

  // Brushed satin steel folding X-frame legs (sits cleanly UNDER y = BOARD_Y - 0.044!)
  const frameMetalMat = new THREE.MeshStandardMaterial({
    map: textures.metalBrushed.map,
    normalMap: textures.metalBrushed.normalMap,
    normalScale: new THREE.Vector2(0.22, 0.22),
    roughnessMap: textures.metalBrushed.roughnessMap,
    roughness: 0.40,
    metalness: 0.68,
    color: new THREE.Color('#cfd2d4'),
    envMapIntensity: 0.9,
  });

  const darkRubberMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2b2d30'),
    roughness: 0.78,
    metalness: 0.05,
  });

  for (const rz of [-0.095, 0.095]) {
    // Tucked cleanly inside the tapered board silhouette (no protruding ends!)
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.015, 0.015), frameMetalMat);
    rail.position.set(0.05, BOARD_Y - 0.048, rz);
    rail.castShadow = true;
    boardGroup.add(rail);
  }

  function addLegTube(p1, p2, radius = 0.0125) {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    const g = new THREE.CylinderGeometry(radius, radius, len, 14);
    const m = new THREE.Mesh(g, frameMetalMat);
    m.position.addVectors(p1, p2).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.castShadow = true;
    m.receiveShadow = true;
    boardGroup.add(m);
  }

  const legYTop = BOARD_Y - 0.050;
  for (const lz of [-0.132, 0.132]) {
    addLegTube(new THREE.Vector3(-0.22, legYTop, lz * 0.72), new THREE.Vector3(0.35, 0.015, lz));
    addLegTube(new THREE.Vector3(0.31, legYTop, lz * 0.72), new THREE.Vector3(-0.28, 0.015, lz));
  }
  for (const fx of [-0.28, 0.35]) {
    addLegTube(new THREE.Vector3(fx, 0.015, -0.165), new THREE.Vector3(fx, 0.015, 0.165), 0.0125);
    for (const fz of [-0.165, 0.165]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.017, 0.030, 12), darkRubberMat);
      cap.rotation.x = Math.PI / 2;
      cap.position.set(fx, 0.015, fz);
      boardGroup.add(cap);
    }
  }
  addLegTube(new THREE.Vector3(0.04, legYTop * 0.51, -0.145), new THREE.Vector3(0.04, legYTop * 0.51, 0.145), 0.0085);

  // Heat-resistant charcoal silicone iron rest mat aligned smoothly with the resting iron!
  const restCenter = new THREE.Vector3(0.285, BOARD_Y + 0.0008, 0.032);
  const restPadGroup = new THREE.Group();
  restPadGroup.position.copy(restCenter);
  restPadGroup.rotation.y = -0.06;
  boardGroup.add(restPadGroup);

  const siliconeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#535654'),
    roughness: 0.80,
    metalness: 0.02,
    envMapIntensity: 0.4,
  });
  const padBase = new THREE.Mesh(createRoundedRectPlate(0.255, 0.168, 0.0046, 0.026), siliconeMat);
  padBase.position.y = 0.0023;
  padBase.castShadow = true;
  padBase.receiveShadow = true;
  restPadGroup.add(padBase);

  // Soft contact shadow around the silicone rest mat
  const padShadow = addContactShadow(restCenter.x, BOARD_Y + 0.0005, restCenter.z, 0.30, 0.21, 0.28);
  padShadow.parent.remove(padShadow);
  boardGroup.add(padShadow);

  const nubGeo = new THREE.CylinderGeometry(0.0048, 0.0058, 0.0024, 10);
  const nubMesh = new THREE.InstancedMesh(nubGeo, siliconeMat, 25);
  const dummy = new THREE.Object3D();
  let idx = 0;
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      dummy.position.set(gx * 0.044, 0.0054, gz * 0.028);
      dummy.updateMatrix();
      nubMesh.setMatrixAt(idx++, dummy.matrix);
    }
  }
  nubMesh.receiveShadow = true;
  restPadGroup.add(nubMesh);

  // =========================================================
  // 4. AMBER GLASS WATER MIST SPRAY BOTTLE (Sculpted Ergonomic Head!)
  // =========================================================
  const sprayBottle = buildSprayBottle(textures);
  sprayBottle.position.set(0.26, BOARD_Y, -0.118);
  sprayBottle.rotation.y = -2.35;
  boardGroup.add(sprayBottle);

  const bottleShadow = addContactShadow(0.26, BOARD_Y + 0.0009, -0.118, 0.088, 0.088, 0.44);
  bottleShadow.parent.remove(bottleShadow);
  boardGroup.add(bottleShadow);

  // =========================================================
  // 5. FLOATING SUNLIT DUST MOTES IN WINDOW SUNBEAM
  // =========================================================
  const moteCount = 55;
  const motePos = new Float32Array(moteCount * 3);
  const motePhase = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * 2.0 - 0.15;
    motePos[i * 3 + 1] = 0.78 + Math.random() * 1.05;
    motePos[i * 3 + 2] = (Math.random() - 0.5) * 1.4 - 0.35;
    motePhase[i] = Math.random() * Math.PI * 2;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteCanvas = document.createElement('canvas');
  moteCanvas.width = 32;
  moteCanvas.height = 32;
  const mctx = moteCanvas.getContext('2d');
  const mgrad = mctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  mgrad.addColorStop(0, 'rgba(255, 248, 232, 0.82)');
  mgrad.addColorStop(0.5, 'rgba(255, 244, 220, 0.25)');
  mgrad.addColorStop(1, 'rgba(255, 244, 220, 0)');
  mctx.fillStyle = mgrad;
  mctx.fillRect(0, 0, 32, 32);
  const moteMat = new THREE.PointsMaterial({
    map: new THREE.CanvasTexture(moteCanvas),
    size: 0.010,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dustMotes = new THREE.Points(moteGeo, moteMat);
  root.add(dustMotes);

  function updateRoom(time, dt) {
    curtain.rotation.z = Math.sin(time * 0.7) * 0.006;
    const arr = moteGeo.attributes.position.array;
    for (let i = 0; i < moteCount; i++) {
      const p = motePhase[i];
      arr[i * 3] += Math.sin(time * 0.25 + p) * dt * 0.007;
      arr[i * 3 + 1] += Math.cos(time * 0.18 + p * 1.3) * dt * 0.004;
    }
    moteGeo.attributes.position.needsUpdate = true;
  }

  return {
    root,
    boardGroup,
    boardTopMesh,
    restCenter,
    stackSurfacePos,
    basketGroup,
    basketRimPos,
    sprayBottle,
    bottleShadow,
    plant,
    updateRoom,
  };
}

/**
 * Generates a solid, correctly outward-wound padded ironing board geometry!
 */
function buildIroningBoardGeometry() {
  const rings = 64;
  const layers = 9;
  const positions = [];
  const uvs = [];
  const indices = [];

  const profile = [
    { scale: 0.0, y: BOARD_Y },
    { scale: 0.80, y: BOARD_Y },
    { scale: 0.92, y: BOARD_Y - 0.0020 },
    { scale: 0.985, y: BOARD_Y - 0.0068 },
    { scale: 1.0, y: BOARD_Y - 0.0145 },
    { scale: 0.992, y: BOARD_Y - 0.0235 },
    { scale: 0.955, y: BOARD_Y - 0.032 },
    { scale: 0.85, y: BOARD_Y - 0.036 },
    { scale: 0.0, y: BOARD_Y - 0.037 },
  ];

  // Outline clockwise in XZ so (a, b, c) produces outward +Y normals on top!
  const outline = [];
  for (let i = 0; i <= rings; i++) {
    const a = (i / rings) * Math.PI * 2;
    const x = Math.cos(a) * BOARD_HALF_LEN;
    const hw = boardHalfWidthAt(x);
    const z = Math.sin(a) * hw;
    outline.push({ x, z });
  }

  for (let l = 0; l < layers; l++) {
    const { scale, y } = profile[l];
    for (let i = 0; i <= rings; i++) {
      const pt = outline[i];
      const px = pt.x * scale;
      const pz = pt.z * scale;
      positions.push(px, y, pz);
      uvs.push((px + BOARD_HALF_LEN) / (BOARD_HALF_LEN * 2), (pz + BOARD_WIDTH * 0.5) / BOARD_WIDTH);
    }
  }

  const stride = rings + 1;
  for (let l = 0; l < layers - 1; l++) {
    for (let i = 0; i < rings; i++) {
      const a = l * stride + i;
      const b = a + 1;
      const c = (l + 1) * stride + i;
      const d = c + 1;
      // Outward winding (+Y on top surface!)
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('uv2', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createRoundedRectPlate(w, d, h, r) {
  const shape = new THREE.Shape();
  const hw = w * 0.5;
  const hd = d * 0.5;
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
    depth: h,
    bevelEnabled: true,
    bevelThickness: 0.0014,
    bevelSize: 0.0014,
    bevelSegments: 3,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -h * 0.5, 0);
  return geo;
}

/**
 * Builds a sleek, realistic household amber-glass fine-mist water spray bottle
 * (smooth rounded sprayer head + realistic glass clearcoat reflection without heavy transmission pass!).
 */
function buildSprayBottle(textures) {
  const group = new THREE.Group();
  group.name = 'sprayBottle';

  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.023, 0.0),
    new THREE.Vector2(0.026, 0.005),
    new THREE.Vector2(0.0265, 0.078),
    new THREE.Vector2(0.0245, 0.092),
    new THREE.Vector2(0.0165, 0.108),
    new THREE.Vector2(0.0108, 0.118),
    new THREE.Vector2(0.0108, 0.130),
  ];
  const bottleGeo = new THREE.LatheGeometry(pts, 28);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#9c622b'),
    roughness: 0.08,
    metalness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.78,
    envMapIntensity: 1.65,
  });
  const bottleMesh = new THREE.Mesh(bottleGeo, glassMat);
  bottleMesh.castShadow = true;
  bottleMesh.receiveShadow = true;
  group.add(bottleMesh);

  // Subtle internal water meniscus inside bottle
  const waterMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0235, 0.0235, 0.062, 20),
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#b6783c'),
      roughness: 0.08,
      clearcoat: 0.8,
      transparent: true,
      opacity: 0.55,
    })
  );
  waterMesh.position.y = 0.036;
  group.add(waterMesh);

  // Matte charcoal ergonomic curved sprayer head (NO sharp rectangular box!)
  const plasticMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2c3034'),
    roughness: 0.44,
    metalness: 0.05,
    envMapIntensity: 0.8,
  });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.0126, 0.0132, 0.015, 20), plasticMat);
  collar.position.y = 0.134;
  collar.castShadow = true;
  group.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0086, 0.0096, 0.016, 16), plasticMat);
  neck.position.y = 0.147;
  group.add(neck);

  // Sleek rounded capsule sprayer hood
  const headCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.155, -0.016),
    new THREE.Vector3(0, 0.162, 0.006),
    new THREE.Vector3(0, 0.160, 0.032),
  ]);
  const headGeo = new THREE.TubeGeometry(headCurve, 16, 0.0095, 14, false);
  headGeo.scale(0.92, 1.05, 1.0);
  const headMesh = new THREE.Mesh(headGeo, plasticMat);
  headMesh.castShadow = true;
  group.add(headMesh);

  // Rounded back cap
  const backCap = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 14, 12), plasticMat);
  backCap.position.set(0, 0.155, -0.016);
  group.add(backCap);

  // Brushed brass/steel fine-mist nozzle
  const nozzleMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d2d5d8'),
    roughness: 0.24,
    metalness: 0.88,
  });
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.0046, 0.0056, 0.008, 14), nozzleMat);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, 0.160, 0.036);
  group.add(nozzle);

  // Curved ergonomic trigger lever
  const triggerPivot = new THREE.Group();
  triggerPivot.position.set(0, 0.154, 0.018);
  const trigCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -0.015, 0.009),
    new THREE.Vector3(0, -0.032, 0.005),
  ]);
  const triggerMesh = new THREE.Mesh(new THREE.TubeGeometry(trigCurve, 10, 0.0036, 8, false), plasticMat);
  triggerMesh.scale.set(0.7, 1, 1.3);
  triggerPivot.add(triggerMesh);
  group.add(triggerPivot);

  // Unprinted textured kraft-linen wrap label around mid-bottle (ZERO text!)
  const labelGeo = new THREE.CylinderGeometry(0.027, 0.027, 0.036, 28, 1, true);
  const labelMat = new THREE.MeshStandardMaterial({
    map: textures.ecruLinen.map,
    normalMap: textures.ecruLinen.normalMap,
    normalScale: new THREE.Vector2(0.28, 0.28),
    color: new THREE.Color('#f2ebde'),
    roughness: 0.88,
    metalness: 0.0,
  });
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.position.y = 0.048;
  group.add(label);

  group.userData.triggerPivot = triggerPivot;
  group.userData.nozzleLocal = new THREE.Vector3(0, 0.160, 0.042);
  return group;
}
