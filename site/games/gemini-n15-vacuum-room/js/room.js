import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import {
  createContactShadowTexture,
  createRectShadowTexture,
  createSunbeamPoolTexture,
  createWovenRugAlbedoTexture,
  createWarmPlasterAlbedoTexture,
  createFramedWallArtTexture,
} from './textures.js';

function addUV1(geometry) {
  const uv = geometry.getAttribute('uv');
  if (uv && !geometry.getAttribute('uv1')) {
    geometry.setAttribute('uv1', uv.clone());
  }
  return geometry;
}

function loadTex(loader, url, { srgb = false, repeat = [1, 1], maxAniso = 8 } = {}) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeat[0], repeat[1]);
        tex.anisotropy = maxAniso;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      reject
    );
  });
}

function loadModel(gltfLoader, url) {
  return new Promise((resolve, reject) => {
    gltfLoader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
  });
}

function tuneModelShadows(root, maxAniso = 8, { cast = true, receive = true } = {}) {
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = cast;
      obj.receiveShadow = receive;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!m) continue;
        if (m.map) m.map.anisotropy = maxAniso;
        if (m.normalMap) m.normalMap.anisotropy = maxAniso;
        if (m.roughnessMap) m.roughnessMap.anisotropy = maxAniso;
        m.needsUpdate = true;
      }
    }
  });
}

function groundToY(obj, targetY = 0) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  if (isFinite(box.min.y)) {
    obj.position.y += targetY - box.min.y;
    obj.updateMatrixWorld(true);
  }
  return new THREE.Box3().setFromObject(obj);
}

/**
 * Builds the photorealistic sunlit living room using Poly Haven CC0 HDRI, PBR maps, and glTF furniture.
 */
export async function buildLivingRoom(scene, renderer) {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const texLoader = new THREE.TextureLoader();
  const gltfLoader = new GLTFLoader();
  const hdrLoader = new HDRLoader();

  // 1. Load real indoor sunlit apartment HDRI -> PMREM environment
  const hdrTex = await new Promise((resolve, reject) => {
    hdrLoader.load('./assets/hdri/photo_studio_loft_hall_1k.hdr', resolve, undefined, reject);
  });
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromEquirectangular(hdrTex);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.72;
  scene.environmentRotation = new THREE.Euler(0, Math.PI * 0.35, 0);
  hdrTex.dispose();
  pmrem.dispose();

  scene.background = new THREE.Color(0xe6dfd4);

  // 2. Lighting: Single shadow-casting warm afternoon window sun + natural interior bounce
  const sunLight = new THREE.DirectionalLight(0xfff0d8, 3.05);
  sunLight.position.set(3.0, 3.3, 1.8);
  sunLight.target.position.set(-0.2, 0.1, -0.65);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 0.8;
  sunLight.shadow.camera.far = 9.2;
  sunLight.shadow.camera.left = -2.3;
  sunLight.shadow.camera.right = 2.3;
  sunLight.shadow.camera.top = 2.2;
  sunLight.shadow.camera.bottom = -2.1;
  sunLight.shadow.bias = -0.00045;
  sunLight.shadow.normalBias = 0.016;
  sunLight.shadow.radius = 2.4;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Soft interior bounce fill (prevents crushed dark areas while keeping realistic shadow contrast)
  const hemiLight = new THREE.HemisphereLight(0xfcf5eb, 0x9c8066, 0.44);
  scene.add(hemiLight);

  // 3. Load CC0 PBR textures in parallel
  const [
    floorDiff, floorNor, floorArm,
    rugNor, rugArm,
    wallNor, wallArm,
  ] = await Promise.all([
    loadTex(texLoader, './assets/textures/floor/diff.jpg', { srgb: true, repeat: [3.2, 3.0], maxAniso }),
    loadTex(texLoader, './assets/textures/floor/nor_gl.jpg', { repeat: [3.2, 3.0], maxAniso }),
    loadTex(texLoader, './assets/textures/floor/arm.jpg', { repeat: [3.2, 3.0], maxAniso }),

    loadTex(texLoader, './assets/textures/rug_linen/nor_gl.jpg', { repeat: [4.5, 2.8], maxAniso }),
    loadTex(texLoader, './assets/textures/rug_linen/arm.jpg', { repeat: [4.5, 2.8], maxAniso }),

    loadTex(texLoader, './assets/textures/wall/nor_gl.jpg', { repeat: [3.2, 1.6], maxAniso }),
    loadTex(texLoader, './assets/textures/wall/arm.jpg', { repeat: [3.2, 1.6], maxAniso }),
  ]);

  const roomGroup = new THREE.Group();
  roomGroup.name = 'LivingRoom';
  scene.add(roomGroup);

  const contactShadowTex = createContactShadowTexture();
  const rectShadowTex = createRectShadowTexture();
  const sunbeamTex = createSunbeamPoolTexture();
  const wovenRugAlbedo = createWovenRugAlbedoTexture();
  const warmPlasterAlbedo = createWarmPlasterAlbedoTexture();

  // --- Hardwood Plank Floor (real scale 5.6m x 5.2m) ---
  const floorGeo = addUV1(new THREE.PlaneGeometry(5.6, 5.2));
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorDiff,
    color: new THREE.Color(0xf4ebe0), // warm natural oak tone
    normalMap: floorNor,
    normalScale: new THREE.Vector2(0.8, 0.8),
    aoMap: floorArm,
    aoMapIntensity: 0.72,
    roughnessMap: floorArm,
    roughness: 0.82, // subtle satin oiled-wood sheen catching afternoon sun
    metalness: 0.0,
    envMapIntensity: 0.92,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.set(0, 0, -0.35);
  floorMesh.receiveShadow = true;
  floorMesh.name = 'HardwoodFloor';
  roomGroup.add(floorMesh);

  // Subtle warm sunlit window gobo across the hardwood floor (adds authentic afternoon daylight depth!)
  const floorSunPool = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 1.55),
    new THREE.MeshBasicMaterial({
      map: sunbeamTex,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  floorSunPool.rotation.x = -Math.PI / 2;
  floorSunPool.rotation.z = 0.24;
  floorSunPool.position.set(0.28, 0.0018, 0.06);
  roomGroup.add(floorSunPool);

  // --- Woven Oatmeal Linen Area Rug (1.44m x 0.86m, real 8mm thickness + woven end stripes & fringe!) ---
  const rugW = 1.44;
  const rugD = 0.86;
  const rugH = 0.008;
  const rugX = -0.26;
  const rugZ = -0.32;

  const rugBoxGeo = addUV1(new THREE.BoxGeometry(rugW, rugH, rugD, 16, 1, 10));
  // Gently round/taper outer perimeter vertices downward so the rug edge lies naturally on hardwood!
  const rPos = rugBoxGeo.getAttribute('position');
  for (let i = 0; i < rPos.count; i++) {
    const vx = rPos.getX(i);
    const vy = rPos.getY(i);
    const vz = rPos.getZ(i);
    if (vy > 0) {
      const edgeX = Math.max(0, (Math.abs(vx) - (rugW * 0.5 - 0.035)) / 0.035);
      const edgeZ = Math.max(0, (Math.abs(vz) - (rugD * 0.5 - 0.035)) / 0.035);
      const drop = Math.min(1, Math.max(edgeX, edgeZ));
      rPos.setY(i, vy - drop * 0.0032);
    }
  }
  rugBoxGeo.computeVertexNormals();

  const rugMat = new THREE.MeshStandardMaterial({
    map: wovenRugAlbedo,
    normalMap: rugNor,
    normalScale: new THREE.Vector2(1.25, 1.25),
    aoMap: rugArm,
    aoMapIntensity: 0.72,
    roughnessMap: rugArm,
    roughness: 0.96,
    metalness: 0.0,
    envMapIntensity: 0.42,
  });
  const rugMesh = new THREE.Mesh(rugBoxGeo, rugMat);
  rugMesh.position.set(rugX, rugH * 0.5, rugZ);
  rugMesh.castShadow = true;
  rugMesh.receiveShadow = true;
  rugMesh.name = 'AreaRug';
  roomGroup.add(rugMesh);

  // Authentic cotton fringe tassels along the left & right short ends of the woven rug (organic pairs + interactive flutter!)
  const tasselCountPerSide = 28;
  const tasselGeo = new THREE.CylinderGeometry(0.0021, 0.0014, 0.044, 5, 3);
  tasselGeo.rotateZ(Math.PI / 2);
  // Subtle natural downward drape along each yarn tassel
  const tPos = tasselGeo.getAttribute('position');
  for (let i = 0; i < tPos.count; i++) {
    const tx = tPos.getX(i);
    tPos.setY(i, tPos.getY(i) - Math.pow(tx / 0.022, 2) * 0.0018);
  }
  tasselGeo.computeVertexNormals();
  const tasselMat = new THREE.MeshStandardMaterial({
    color: 0xded4c3,
    roughness: 0.96,
    metalness: 0.0,
  });
  const tassels = new THREE.InstancedMesh(tasselGeo, tasselMat, tasselCountPerSide * 2);
  const td = new THREE.Object3D();
  const tasselBaseData = [];
  let ti = 0;
  for (const side of [-1, 1]) {
    for (let k = 0; k < tasselCountPerSide; k++) {
      // Natural slightly irregular paired spacing (like real knotted cotton rug fringe)
      const pairShift = (k % 2 === 0 ? -0.004 : 0.004);
      const f = (k + 0.5) / tasselCountPerSide;
      const tz = rugZ - rugD * 0.475 + f * rugD * 0.95 + pairShift;
      const jitterYaw = Math.sin(k * 9.7 + side * 3.1) * 0.24;
      const lenScale = 0.84 + Math.abs(Math.sin(k * 4.3 + side)) * 0.28;
      const bx = rugX + side * (rugW * 0.5 + 0.017);
      const by = 0.0024;
      td.position.set(bx, by, tz);
      td.rotation.set(0, jitterYaw, 0);
      td.scale.set(lenScale, 1, 1);
      td.updateMatrix();
      tassels.setMatrixAt(ti, td.matrix);
      tasselBaseData.push({
        idx: ti,
        x: bx,
        y: by,
        z: tz,
        side,
        baseYaw: jitterYaw,
        lenScale,
        flutter: 0,
      });
      ti++;
    }
  }
  tassels.instanceMatrix.needsUpdate = true;
  tassels.receiveShadow = true;
  roomGroup.add(tassels);

  // Subtle rug perimeter contact shadow on wood floor
  const rugShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(rugW + 0.08, rugD + 0.08),
    new THREE.MeshBasicMaterial({
      map: rectShadowTex,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    })
  );
  rugShadow.rotation.x = -Math.PI / 2;
  rugShadow.position.set(rugX, 0.0007, rugZ);
  roomGroup.add(rugShadow);

  // --- Architecture: Clean Warm Sunlit Plaster Walls, Wooden Baseboards, Sunlit Window ---
  const wallMat = new THREE.MeshStandardMaterial({
    map: warmPlasterAlbedo,
    normalMap: wallNor,
    normalScale: new THREE.Vector2(0.28, 0.28),
    aoMap: wallArm,
    aoMapIntensity: 0.28,
    roughnessMap: wallArm,
    roughness: 0.92,
    metalness: 0.0,
    envMapIntensity: 0.5,
  });

  const backWall = new THREE.Mesh(addUV1(new THREE.PlaneGeometry(5.6, 2.85)), wallMat);
  backWall.position.set(0, 1.425, -2.02);
  backWall.receiveShadow = true;
  roomGroup.add(backWall);

  const leftWall = new THREE.Mesh(addUV1(new THREE.PlaneGeometry(5.2, 2.85)), wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-2.35, 1.425, -0.35);
  leftWall.receiveShadow = true;
  roomGroup.add(leftWall);

  // Right wall with sunlit window recess
  const rightWallX = 2.05;
  const rWallBottom = new THREE.Mesh(addUV1(new THREE.PlaneGeometry(5.2, 0.62)), wallMat);
  rWallBottom.rotation.y = -Math.PI / 2;
  rWallBottom.position.set(rightWallX, 0.31, -0.35);
  rWallBottom.receiveShadow = true;
  roomGroup.add(rWallBottom);

  const rWallTop = new THREE.Mesh(addUV1(new THREE.PlaneGeometry(5.2, 0.55)), wallMat);
  rWallTop.rotation.y = -Math.PI / 2;
  rWallTop.position.set(rightWallX, 2.575, -0.35);
  roomGroup.add(rWallTop);

  const rWallBack = new THREE.Mesh(addUV1(new THREE.PlaneGeometry(1.15, 1.68)), wallMat);
  rWallBack.rotation.y = -Math.PI / 2;
  rWallBack.position.set(rightWallX, 1.46, -1.48);
  rWallBack.receiveShadow = true;
  roomGroup.add(rWallBack);

  const rWallFront = new THREE.Mesh(addUV1(new THREE.PlaneGeometry(1.85, 1.68)), wallMat);
  rWallFront.rotation.y = -Math.PI / 2;
  rWallFront.position.set(rightWallX, 1.46, 1.32);
  roomGroup.add(rWallFront);

  // Baseboards (warm satin ivory-painted wood skirting with real top chamfer cap molding)
  const baseboardMat = new THREE.MeshStandardMaterial({
    color: 0xf1ece3,
    roughness: 0.48,
    metalness: 0.0,
  });
  const bbBack = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.092, 0.018), baseboardMat);
  bbBack.position.set(0, 0.046, -2.011);
  bbBack.receiveShadow = true;
  roomGroup.add(bbBack);

  const bbBackCap = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.012, 0.022), baseboardMat);
  bbBackCap.position.set(0, 0.094, -2.009);
  bbBackCap.receiveShadow = true;
  roomGroup.add(bbBackCap);

  const bbLeft = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.092, 5.2), baseboardMat);
  bbLeft.position.set(-2.341, 0.046, -0.35);
  bbLeft.receiveShadow = true;
  roomGroup.add(bbLeft);

  const bbRight = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.092, 5.2), baseboardMat);
  bbRight.position.set(rightWallX - 0.009, 0.046, -0.35);
  bbRight.receiveShadow = true;
  roomGroup.add(bbRight);

  // Subtle sunlit afternoon window glow on back plaster wall (breaks up flat beige wall with authentic daylight!)
  const wallSunPatch = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.35),
    new THREE.MeshBasicMaterial({
      map: sunbeamTex,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  wallSunPatch.position.set(0.32, 1.38, -2.012);
  wallSunPatch.rotation.z = -0.16;
  roomGroup.add(wallSunPatch);

  // Understated framed botanical linen print above sofa (hung at authentic 15cm-above-sofa height, cleanly framed in both 1024x768 and 390x844!)
  const artGroup = new THREE.Group();
  const artW = 0.64, artH = 0.44, frameDepth = 0.026, frameThick = 0.021;
  const oakFrameMat = new THREE.MeshStandardMaterial({
    color: 0xa6835e,
    roughness: 0.56,
    metalness: 0.0,
    envMapIntensity: 0.65,
  });
  // Soft wall drop-shadow behind frame (shifted down-left matching afternoon right-window sun!)
  const artShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(artW + 0.08, artH + 0.08),
    new THREE.MeshBasicMaterial({
      map: rectShadowTex,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    })
  );
  artShadow.position.set(-0.026, -0.024, 0.002);
  artGroup.add(artShadow);

  const artTex = createFramedWallArtTexture();
  const artCanvas = new THREE.Mesh(
    new THREE.PlaneGeometry(artW - frameThick * 2, artH - frameThick * 2),
    new THREE.MeshStandardMaterial({
      map: artTex,
      roughness: 0.88,
      metalness: 0.0,
      envMapIntensity: 0.35,
    })
  );
  artCanvas.position.z = 0.012;
  artCanvas.receiveShadow = true;
  artGroup.add(artCanvas);

  // Subtle anti-glare picture glass catching soft window sheen
  const artGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(artW - frameThick * 2, artH - frameThick * 2),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      roughness: 0.08,
      metalness: 0.0,
      reflectivity: 0.8,
      envMapIntensity: 1.2,
      depthWrite: false,
    })
  );
  artGlass.position.z = 0.019;
  artGroup.add(artGlass);

  // Four oak frame rails
  const railTop = new THREE.Mesh(new THREE.BoxGeometry(artW, frameThick, frameDepth), oakFrameMat);
  railTop.position.set(0, (artH - frameThick) * 0.5, frameDepth * 0.5);
  const railBot = railTop.clone();
  railBot.position.y = -(artH - frameThick) * 0.5;
  const railL = new THREE.Mesh(new THREE.BoxGeometry(frameThick, artH - frameThick * 2, frameDepth), oakFrameMat);
  railL.position.set(-(artW - frameThick) * 0.5, 0, frameDepth * 0.5);
  const railR = railL.clone();
  railR.position.x = (artW - frameThick) * 0.5;
  artGroup.add(railTop, railBot, railL, railR);

  artGroup.position.set(-0.26, 1.24, -2.018);
  roomGroup.add(artGroup);

  // Subtle baseboard-floor ambient occlusion strip along back wall
  const wallAo = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 0.22),
    new THREE.MeshBasicMaterial({
      map: rectShadowTex,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    })
  );
  wallAo.rotation.x = -Math.PI / 2;
  wallAo.position.set(0, 0.001, -1.94);
  roomGroup.add(wallAo);

  // Ceiling
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 5.2),
    new THREE.MeshStandardMaterial({ color: 0xf6f2ec, roughness: 0.96 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 2.82, -0.35);
  roomGroup.add(ceiling);

  // 4. Load CC0 Poly Haven glTF Living Room Furniture in parallel
  const [sofa, coffeeTable, plant, basket, croissant, plate] = await Promise.all([
    loadModel(gltfLoader, './assets/models/sofa_02/sofa_02.gltf'),
    loadModel(gltfLoader, './assets/models/modern_coffee_table_01/modern_coffee_table_01.gltf'),
    loadModel(gltfLoader, './assets/models/potted_plant_02/potted_plant_02.gltf'),
    loadModel(gltfLoader, './assets/models/wicker_basket_02/wicker_basket_02.gltf'),
    loadModel(gltfLoader, './assets/models/croissant/croissant.gltf'),
    loadModel(gltfLoader, './assets/models/carved_wooden_plate/carved_wooden_plate.gltf'),
  ]);

  // --- Sofa (positioned cleanly so open wicker wastebasket fits completely inside BOTH 390x844 Portrait and 1024x768 Landscape!) ---
  tuneModelShadows(sofa, maxAniso);
  sofa.position.set(-0.28, 0, -1.36);
  sofa.rotation.y = 0;
  const sofaBox = groundToY(sofa, 0);
  roomGroup.add(sofa);

  // Deep realistic ambient occlusion shadow underneath the sofa cavity
  const sofaUnderShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.94, 0.94),
    new THREE.MeshBasicMaterial({
      map: rectShadowTex,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    })
  );
  sofaUnderShadow.rotation.x = -Math.PI / 2;
  sofaUnderShadow.position.set(-0.28, 0.0011, -1.44);
  roomGroup.add(sofaUnderShadow);

  // --- Modern Coffee Table (left-midground, clearly showing croissant plate in landscape!) ---
  tuneModelShadows(coffeeTable, maxAniso);
  coffeeTable.position.set(-1.08, 0, -0.36);
  coffeeTable.rotation.y = 0.14;
  const tableBox = groundToY(coffeeTable, 0);
  roomGroup.add(coffeeTable);

  // Grounded contact shadows directly beneath the table's hardwood legs (NO floating grey box on top of the rug!)
  const tableShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 1.18),
    new THREE.MeshBasicMaterial({
      map: rectShadowTex,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    })
  );
  tableShadow.rotation.x = -Math.PI / 2;
  tableShadow.rotation.z = -0.14;
  tableShadow.position.set(-1.12, 0.0013, -0.36);
  roomGroup.add(tableShadow);

  // --- Carved Wooden Plate & Croissant on Coffee Table edge (natural breadcrumb origin!) ---
  tuneModelShadows(plate, maxAniso);
  plate.scale.setScalar(0.92);
  plate.position.set(-0.89, 0, -0.12);
  const plateBox = groundToY(plate, tableBox.max.y - 0.002);
  roomGroup.add(plate);

  tuneModelShadows(croissant, maxAniso);
  croissant.scale.setScalar(0.98);
  croissant.position.set(-0.88, 0, -0.11);
  croissant.rotation.y = 0.55;
  groundToY(croissant, plateBox.max.y - 0.018);
  roomGroup.add(croissant);

  // --- Potted Plant (right-back sunlit corner by window) ---
  tuneModelShadows(plant, maxAniso);
  plant.scale.setScalar(1.06);
  plant.position.set(1.14, 0, -1.42);
  plant.rotation.y = -0.75;
  groundToY(plant, 0);
  roomGroup.add(plant);

  const plantShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.66, 0.66),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    })
  );
  plantShadow.rotation.x = -Math.PI / 2;
  plantShadow.position.set(1.14, 0.0014, -1.42);
  roomGroup.add(plantShadow);

  // --- Wicker Wastebasket (positioned visibly inside BOTH 390x844 Portrait and 1024x768 Landscape!) ---
  const binGroup = new THREE.Group();
  binGroup.name = 'WasteBasket';
  tuneModelShadows(basket, maxAniso);
  basket.scale.set(1.26, 1.34, 1.26);
  groundToY(basket, 0);
  binGroup.add(basket);

  // Dark inner base inside the wicker wastebasket
  const binInnerFloor = new THREE.Mesh(
    new THREE.CircleGeometry(0.11, 24),
    new THREE.MeshStandardMaterial({ color: 0x241d17, roughness: 0.95, metalness: 0.0 })
  );
  binInnerFloor.rotation.x = -Math.PI / 2;
  binInnerFloor.position.y = 0.032;
  binInnerFloor.receiveShadow = true;
  binGroup.add(binInnerFloor);

  // Subtle crumpled off-white paper tissues resting at bottom of basket (instant wastebasket affordance!)
  const tissueMat = new THREE.MeshStandardMaterial({ color: 0xede8df, roughness: 0.92, metalness: 0.0 });
  for (let i = 0; i < 2; i++) {
    const tGeo = new THREE.IcosahedronGeometry(0.034, 1);
    const pos = tGeo.getAttribute('position');
    for (let k = 0; k < pos.count; k++) {
      const vx = pos.getX(k), vy = pos.getY(k), vz = pos.getZ(k);
      const bump = 0.78 + 0.42 * Math.abs(Math.sin(vx * 55 + vy * 70 + i * 3));
      pos.setXYZ(k, vx * bump, vy * bump * 0.72, vz * bump);
    }
    tGeo.computeVertexNormals();
    const tissue = new THREE.Mesh(tGeo, tissueMat);
    tissue.position.set(i === 0 ? -0.022 : 0.028, 0.055, i === 0 ? 0.015 : -0.018);
    tissue.castShadow = false;
    tissue.receiveShadow = true;
    binGroup.add(tissue);
  }

  // Generous invisible touch-hit proxy around the wicker basket for effortless 5-year-old tapping!
  const binHitProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.2, 0.42, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  binHitProxy.position.y = 0.21;
  binGroup.add(binHitProxy);

  // Placed right beside the sofa's right leg so the full open basket is clearly visible even on 390x844 iPhone portrait!
  const binX = 0.46;
  const binZ = -0.82;
  binGroup.position.set(binX, 0, binZ);
  roomGroup.add(binGroup);

  const binShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.44, 0.42),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    })
  );
  binShadow.rotation.x = -Math.PI / 2;
  binShadow.position.set(binX, 0.0015, binZ);
  roomGroup.add(binShadow);

  const binWorldBox = new THREE.Box3().setFromObject(binGroup);

  return {
    roomGroup,
    sunLight,
    floorSunPool,
    wallSunPatch,
    tassels,
    tasselBaseData,
    rugBounds: {
      minX: rugX - rugW / 2,
      maxX: rugX + rugW / 2,
      minZ: rugZ - rugD / 2,
      maxZ: rugZ + rugD / 2,
      height: rugH,
    },
    sofaObj: sofa,
    sofaBox,
    sofaUnderBounds: {
      minX: sofaBox.min.x + 0.14,
      maxX: sofaBox.max.x - 0.14,
      minZ: sofaBox.min.z + 0.08,
      maxZ: sofaBox.max.z - 0.02,
      clearanceY: 0.185,
    },
    tableBox,
    plantObj: plant,
    binGroup,
    binPos: new THREE.Vector3(binX, binWorldBox.max.y, binZ),
    croissantObj: croissant,
    plateObj: plate,
  };
}
