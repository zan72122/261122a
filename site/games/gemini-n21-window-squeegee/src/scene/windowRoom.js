import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function loadTex(loader, path, { srgb = false, repeat = [1, 1], anisotropy = 4 } = {}) {
  const tex = loader.load(path);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = anisotropy;
  return tex;
}

function makeMergedMesh(geos, mat, { castShadow = false, receiveShadow = false } = {}) {
  const normalized = geos.map((g) => {
    const nonIdx = g.index ? g.toNonIndexed() : g;
    if (!nonIdx.attributes.uv) {
      const count = nonIdx.attributes.position.count;
      nonIdx.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    return nonIdx;
  });
  const merged = mergeGeometries(normalized, false);
  geos.forEach((g) => g.dispose());
  normalized.forEach((g) => { if (g !== merged) g.dispose(); });
  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  return mesh;
}

function positionedBox(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

/**
 * Photorealistic real-scale (1 unit = 1m) sunlit house living-room window,
 * warm solid oak window sill & recessed casing, brushed aluminum sash with dark EPDM gaskets,
 * softly pleated woven linen curtains, sunlit exterior wooden terrace & real Poly Haven backyard garden!
 * Static geometry is merged per material to keep draw calls well under mobile budget!
 */
export function buildWindowRoom(scene, { texLoader, gltfLoader, anisotropy = 4 }) {
  const root = new THREE.Group();
  root.name = 'window_room_root';
  scene.add(root);

  const PANE_W = 1.38;
  const PANE_H = 1.04;
  const PANE_CY = 1.15;
  const SILL_Y = PANE_CY - PANE_H * 0.5 - 0.055; // 0.575m
  const RECESS_DEPTH = 0.22;

  // --- Real CC0 PBR Textures ---
  const oakDiff = loadTex(texLoader, './assets/textures/oak_veneer_01/oak_veneer_01_diff_1k.jpg', { srgb: true, repeat: [2.2, 0.75], anisotropy });
  const oakNor = loadTex(texLoader, './assets/textures/oak_veneer_01/oak_veneer_01_nor_gl_1k.jpg', { repeat: [2.2, 0.75], anisotropy });
  const oakArm = loadTex(texLoader, './assets/textures/oak_veneer_01/oak_veneer_01_arm_1k.jpg', { repeat: [2.2, 0.75], anisotropy });

  const wallDiff = loadTex(texLoader, './assets/textures/beige_wall_001/beige_wall_001_diff_1k.jpg', { srgb: true, repeat: [3.4, 2.5], anisotropy });
  const wallNor = loadTex(texLoader, './assets/textures/beige_wall_001/beige_wall_001_nor_gl_1k.jpg', { repeat: [3.4, 2.5], anisotropy });
  const wallArm = loadTex(texLoader, './assets/textures/beige_wall_001/beige_wall_001_arm_1k.jpg', { repeat: [3.4, 2.5], anisotropy });

  const linenDiff = loadTex(texLoader, './assets/textures/rough_linen/rough_linen_diff_1k.jpg', { srgb: true, repeat: [2.4, 4.2], anisotropy });
  const linenNor = loadTex(texLoader, './assets/textures/rough_linen/rough_linen_nor_gl_1k.jpg', { repeat: [2.4, 4.2], anisotropy });
  const linenArm = loadTex(texLoader, './assets/textures/rough_linen/rough_linen_arm_1k.jpg', { repeat: [2.4, 4.2], anisotropy });

  const metalDiff = loadTex(texLoader, './assets/textures/Metal049A/Metal049A_1K-JPG_Color.jpg', { srgb: true, repeat: [2, 2], anisotropy });
  const metalNor = loadTex(texLoader, './assets/textures/Metal049A/Metal049A_1K-JPG_NormalGL.jpg', { repeat: [2, 2], anisotropy });
  const metalRough = loadTex(texLoader, './assets/textures/Metal049A/Metal049A_1K-JPG_Roughness.jpg', { repeat: [2, 2], anisotropy });
  const metalMet = loadTex(texLoader, './assets/textures/Metal049A/Metal049A_1K-JPG_Metalness.jpg', { repeat: [2, 2], anisotropy });

  const oakSillMat = new THREE.MeshStandardMaterial({
    map: oakDiff,
    normalMap: oakNor,
    normalScale: new THREE.Vector2(0.55, 0.55),
    aoMap: oakArm,
    aoMapIntensity: 0.75,
    roughnessMap: oakArm,
    roughness: 0.54,
    metalness: 0.0,
    color: new THREE.Color(0xf2dec5),
  });

  const wallMat = new THREE.MeshStandardMaterial({
    map: wallDiff,
    normalMap: wallNor,
    normalScale: new THREE.Vector2(0.38, 0.38),
    aoMap: wallArm,
    aoMapIntensity: 0.65,
    roughnessMap: wallArm,
    roughness: 0.94,
    metalness: 0.0,
    color: new THREE.Color(0xf4eee4),
  });

  const aluminumSashMat = new THREE.MeshStandardMaterial({
    map: metalDiff,
    normalMap: metalNor,
    normalScale: new THREE.Vector2(0.24, 0.24),
    roughnessMap: metalRough,
    metalnessMap: metalMet,
    roughness: 0.34,
    metalness: 0.86,
    color: new THREE.Color(0xd7dbdf),
  });

  const darkAnodizedMat = new THREE.MeshStandardMaterial({
    map: metalDiff,
    normalMap: metalNor,
    normalScale: new THREE.Vector2(0.22, 0.22),
    roughnessMap: metalRough,
    roughness: 0.42,
    metalness: 0.76,
    color: new THREE.Color(0x414549),
  });

  const rubberGasketMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x1b1d1f),
    roughness: 0.88,
    metalness: 0.03,
  });

  const curtainMat = new THREE.MeshStandardMaterial({
    map: linenDiff,
    normalMap: linenNor,
    normalScale: new THREE.Vector2(0.62, 0.62),
    aoMap: linenArm,
    aoMapIntensity: 0.6,
    roughnessMap: linenArm,
    roughness: 0.94,
    metalness: 0.0,
    color: new THREE.Color(0xfff1dc),
    side: THREE.DoubleSide,
  });

  // =========================================================
  // 1. OUTDOOR SUNLIT BACKYARD GARDEN + REAL 3D VERANDA DEPTH
  // =========================================================
  const outdoorGroup = new THREE.Group();
  outdoorGroup.name = 'outdoor_garden';
  root.add(outdoorGroup);

  // Outer ambient sky dome
  const gardenTex = texLoader.load('./assets/hdri/suburban_garden_1k.jpg');
  gardenTex.colorSpace = THREE.SRGBColorSpace;
  gardenTex.mapping = THREE.EquirectangularReflectionMapping;
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(32, 32, 20),
    new THREE.MeshBasicMaterial({ map: gardenTex, side: THREE.BackSide, depthWrite: false })
  );
  skyDome.rotation.y = Math.PI * 0.50;
  skyDome.position.set(0, 1.35, 0);
  outdoorGroup.add(skyDome);

  // Ultra-crisp 1024px cropped sunlit backyard garden cyclorama right outside the veranda (7x pixel density!)
  const vistaTex = texLoader.load('./assets/hdri/suburban_garden_vista_1k.jpg');
  vistaTex.colorSpace = THREE.SRGBColorSpace;
  vistaTex.anisotropy = anisotropy;
  const vistaRadius = 15.0;
  const vistaArc = Math.PI * 0.46; // ~83 degrees across the window vista
  const vistaGeo = new THREE.CylinderGeometry(
    vistaRadius, vistaRadius, 13.8, 36, 1, true,
    Math.PI - vistaArc * 0.5, vistaArc
  );
  // Flip U horizontally so inside of cylinder displays garden unmirrored
  const vUv = vistaGeo.attributes.uv;
  for (let i = 0; i < vUv.count; i++) {
    vUv.setX(i, 1 - vUv.getX(i));
  }
  const vistaMesh = new THREE.Mesh(
    vistaGeo,
    new THREE.MeshBasicMaterial({ map: vistaTex, side: THREE.BackSide })
  );
  vistaMesh.position.set(0, 1.45, 0.2);
  outdoorGroup.add(vistaMesh);

  const extWoodMat = new THREE.MeshStandardMaterial({
    map: oakDiff,
    normalMap: oakNor,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: oakArm,
    roughness: 0.78,
    metalness: 0.0,
    color: new THREE.Color(0xcab08e),
  });

  // Exterior sill flashing
  const extSill = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.026, 0.16), darkAnodizedMat);
  extSill.position.set(0, SILL_Y - 0.015, -0.09);
  extSill.rotation.x = 0.05;
  outdoorGroup.add(extSill);

  // Merged exterior sunlit wooden veranda railing & deck (1 draw call!)
  const railZ = -1.65;
  const deckGeos = [
    positionedBox(3.8, 0.052, 0.085, 0, 0.84, railZ),
    positionedBox(3.8, 0.036, 0.06, 0, 0.34, railZ),
    positionedBox(4.4, 0.06, 2.0, 0, 0.24, -0.90),
  ];
  for (let i = -9; i <= 9; i++) {
    deckGeos.push(positionedBox(0.030, 0.50, 0.030, i * 0.19, 0.59, railZ));
  }
  outdoorGroup.add(makeMergedMesh(deckGeos, extWoodMat, { castShadow: false, receiveShadow: true }));

  // Subtle sunlit outdoor veranda plant tucked gracefully at far-left corner (properly real-scale ~42cm!)
  const outdoorPlantPivot = new THREE.Group();
  outdoorPlantPivot.position.set(-0.76, 0.42, -1.28);
  outdoorGroup.add(outdoorPlantPivot);

  gltfLoader.load('./assets/models/potted_plant_02/potted_plant_02_1k.gltf', (gltf) => {
    const model = gltf.scene;
    // Realistic ~42cm outdoor terracotta patio planter — frames the corner without blocking the sunny garden!
    model.scale.setScalar(1.08);
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = true;
      }
    });
    outdoorPlantPivot.add(model);
  });

  // =========================================================
  // 2. MERGED MULTI-PART ALUMINUM SASH & EPDM RUBBER GASKET
  // =========================================================
  const fThick = 0.046;
  const fDepth = 0.075;
  const gThick = 0.011;

  const pushFrameBoxes = (arr, w, h, thickness, depth, zPos) => {
    arr.push(
      positionedBox(w + thickness * 2, thickness, depth, 0, PANE_CY + h * 0.5 + thickness * 0.5, zPos),
      positionedBox(w + thickness * 2, thickness, depth, 0, PANE_CY - h * 0.5 - thickness * 0.5, zPos),
      positionedBox(thickness, h, depth, -w * 0.5 - thickness * 0.5, PANE_CY, zPos),
      positionedBox(thickness, h, depth, w * 0.5 + thickness * 0.5, PANE_CY, zPos),
    );
  };

  const darkFrameGeos = [];
  pushFrameBoxes(darkFrameGeos, PANE_W + fThick * 1.4, PANE_H + fThick * 1.4, 0.026, 0.09, -0.005);
  // Curtain rod + brackets merged into dark anodized hardware
  const openingW = PANE_W + fThick * 2 + 0.048; // 1.52m
  const openingH = PANE_H + fThick * 2 + 0.048; // 1.18m
  const rodY = PANE_CY + openingH * 0.5 + 0.095;
  const rodZ = RECESS_DEPTH + 0.165;
  const rodGeo = new THREE.CylinderGeometry(0.011, 0.011, openingW + 0.95, 16);
  rodGeo.rotateZ(Math.PI * 0.5);
  rodGeo.translate(0, rodY, rodZ);
  darkFrameGeos.push(rodGeo);
  for (const side of [-1, 1]) {
    darkFrameGeos.push(positionedBox(0.018, 0.036, 0.155, side * (openingW * 0.5 + 0.24), rodY, RECESS_DEPTH + 0.085));
    const finial = new THREE.SphereGeometry(0.018, 12, 10);
    finial.translate(side * (openingW * 0.5 + 0.475), rodY, rodZ);
    darkFrameGeos.push(finial);
  }
  root.add(makeMergedMesh(darkFrameGeos, darkAnodizedMat, { castShadow: true, receiveShadow: true }));

  const alumGeos = [];
  pushFrameBoxes(alumGeos, PANE_W, PANE_H, fThick, fDepth, 0.008);
  // Brushed aluminum casement lock escutcheon & lever on right stile
  const lx = PANE_W * 0.5 + fThick * 0.48;
  const ly = PANE_CY - 0.06;
  alumGeos.push(
    positionedBox(0.025, 0.074, 0.015, lx, ly, 0.048),
    positionedBox(0.013, 0.096, 0.012, lx, ly - 0.032, 0.066)
  );
  root.add(makeMergedMesh(alumGeos, aluminumSashMat, { castShadow: true, receiveShadow: true }));

  const gasketGeos = [];
  pushFrameBoxes(gasketGeos, PANE_W - 0.016, PANE_H - 0.016, gThick, 0.022, 0.012);
  root.add(makeMergedMesh(gasketGeos, rubberGasketMat, { castShadow: false, receiveShadow: true }));

  // =========================================================
  // 3. WARM SOLID OAK WINDOW SILL & RECESSED PLASTER WALLS
  // =========================================================
  const sillW = openingW + 0.08;
  const sillDepth = RECESS_DEPTH + 0.140;
  const sillThick = 0.038;

  const oakGeos = [
    positionedBox(sillW, sillThick, sillDepth - 0.019, 0, SILL_Y - sillThick * 0.5, sillDepth * 0.5 - 0.015),
    positionedBox(openingW + 0.14, 0.064, 0.026, 0, SILL_Y - sillThick - 0.032, RECESS_DEPTH + 0.013),
  ];
  const bullnoseGeo = new THREE.CylinderGeometry(sillThick * 0.5, sillThick * 0.5, sillW, 18);
  bullnoseGeo.rotateZ(Math.PI * 0.5);
  bullnoseGeo.translate(0, SILL_Y - sillThick * 0.5, sillDepth - 0.024);
  oakGeos.push(bullnoseGeo);
  root.add(makeMergedMesh(oakGeos, oakSillMat, { castShadow: true, receiveShadow: true }));

  // Merged recessed interior plaster walls & reveals (1 draw call!)
  const wallZ = RECESS_DEPTH + 0.02;
  const wallGeos = [
    positionedBox(openingW, 0.04, RECESS_DEPTH + 0.02, 0, PANE_CY + openingH * 0.5 + 0.02, RECESS_DEPTH * 0.5),
    positionedBox(0.04, openingH + 0.04, RECESS_DEPTH + 0.02, -openingW * 0.5 - 0.02, PANE_CY, RECESS_DEPTH * 0.5),
    positionedBox(0.04, openingH + 0.04, RECESS_DEPTH + 0.02, openingW * 0.5 + 0.02, PANE_CY, RECESS_DEPTH * 0.5),
    positionedBox(5.2, 1.5, 0.04, 0, PANE_CY + openingH * 0.5 + 0.75, wallZ),
    positionedBox(5.2, 1.2, 0.04, 0, SILL_Y - sillThick - 0.60, wallZ),
    positionedBox(1.8, openingH + 0.12, 0.04, -openingW * 0.5 - 0.90, PANE_CY, wallZ),
    positionedBox(1.8, openingH + 0.12, 0.04, openingW * 0.5 + 0.90, PANE_CY, wallZ),
  ];
  root.add(makeMergedMesh(wallGeos, wallMat, { castShadow: false, receiveShadow: true }));

  // Recessed contact AO strip along back of oak sill where it joins aluminum window frame
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = 128;
  aoCanvas.height = 32;
  const actx = aoCanvas.getContext('2d');
  const agrad = actx.createLinearGradient(0, 0, 0, 32);
  agrad.addColorStop(0, 'rgba(18, 12, 6, 0.48)');
  agrad.addColorStop(0.5, 'rgba(18, 12, 6, 0.14)');
  agrad.addColorStop(1, 'rgba(18, 12, 6, 0.0)');
  actx.fillStyle = agrad;
  actx.fillRect(0, 0, 128, 32);
  const aoStripMat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(aoCanvas),
    transparent: true,
    depthWrite: false,
    opacity: 0.78,
  });
  const sillBackAO = new THREE.Mesh(new THREE.PlaneGeometry(openingW, 0.075), aoStripMat);
  sillBackAO.rotation.x = -Math.PI * 0.5;
  sillBackAO.position.set(0, SILL_Y + 0.0008, 0.07);
  root.add(sillBackAO);

  // =========================================================
  // 4. SOFT WOVEN LINEN CURTAINS FRAMING LEFT & RIGHT EDGES
  // =========================================================
  const buildCurtainPanel = (side) => {
    const w = 0.48;
    const h = 1.66;
    const geo = new THREE.PlaneGeometry(w, h, 24, 18);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const u = (px + w * 0.5) / w;
      const v = (py + h * 0.5) / h;
      const pleat = Math.sin(u * Math.PI * 7.0) * (0.032 + (1 - v) * 0.018)
        + Math.sin(u * Math.PI * 3.0 + 0.6) * 0.015;
      const gather = Math.sin(v * Math.PI) * 0.014 * side;
      pos.setZ(i, pleat);
      pos.setX(i, px + gather);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, curtainMat);
    mesh.position.set(side * (openingW * 0.5 + 0.205), rodY - h * 0.5 - 0.015, rodZ + 0.025);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };
  const curtainLeft = buildCurtainPanel(-1);
  const curtainRight = buildCurtainPanel(1);
  root.add(curtainLeft, curtainRight);

  // =========================================================
  // 5. DANCING SPECTRAL RAINBOW CAUSTICS FROM HANGING CRYSTAL
  // =========================================================
  const rainbowCanvas = document.createElement('canvas');
  rainbowCanvas.width = 256;
  rainbowCanvas.height = 128;
  const rctx = rainbowCanvas.getContext('2d');
  const rgrad = rctx.createLinearGradient(24, 64, 232, 64);
  rgrad.addColorStop(0.0, 'rgba(255, 70, 90, 0)');
  rgrad.addColorStop(0.16, 'rgba(255, 95, 75, 0.78)');
  rgrad.addColorStop(0.34, 'rgba(255, 195, 65, 0.82)');
  rgrad.addColorStop(0.50, 'rgba(255, 250, 145, 0.78)');
  rgrad.addColorStop(0.66, 'rgba(95, 238, 170, 0.76)');
  rgrad.addColorStop(0.82, 'rgba(95, 180, 255, 0.78)');
  rgrad.addColorStop(0.93, 'rgba(180, 115, 255, 0.58)');
  rgrad.addColorStop(1.0, 'rgba(180, 115, 255, 0)');
  rctx.filter = 'blur(8px)';
  rctx.fillStyle = rgrad;
  rctx.beginPath();
  rctx.ellipse(128, 64, 98, 25, 0, 0, Math.PI * 2);
  rctx.fill();
  const rainbowTex = new THREE.CanvasTexture(rainbowCanvas);
  rainbowTex.colorSpace = THREE.SRGBColorSpace;

  const rainbowSpots = [];
  const rainbowConfigs = [
    { pos: [-0.30, SILL_Y + 0.002, 0.21], rot: [-Math.PI * 0.5, 0, 0.28], scale: [0.19, 0.085, 1] },
    { pos: [-0.04, SILL_Y + 0.002, 0.26], rot: [-Math.PI * 0.5, 0, -0.18], scale: [0.15, 0.068, 1] },
    { pos: [0.24, SILL_Y + 0.002, 0.22], rot: [-Math.PI * 0.5, 0, 0.38], scale: [0.16, 0.072, 1] },
    { pos: [-openingW * 0.5 + 0.003, PANE_CY - 0.14, 0.14], rot: [0, Math.PI * 0.5, 0.22], scale: [0.17, 0.08, 1] },
  ];
  for (const cfg of rainbowConfigs) {
    const rMat = new THREE.MeshBasicMaterial({
      map: rainbowTex,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const rMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), rMat);
    rMesh.position.set(...cfg.pos);
    rMesh.rotation.set(...cfg.rot);
    rMesh.scale.set(...cfg.scale);
    rMesh.userData.basePos = rMesh.position.clone();
    root.add(rMesh);
    rainbowSpots.push(rMesh);
  }

  return {
    root,
    PANE_W,
    PANE_H,
    PANE_CY,
    SILL_Y,
    RECESS_DEPTH,
    outdoorPlantPivot,
    curtainLeft,
    curtainRight,
    rainbowSpots,
    materials: { oakSillMat, aluminumSashMat, darkAnodizedMat, rubberGasketMat, curtainMat },
    update(dt, elapsed, cleanRatio, prismAngle = 0) {
      outdoorPlantPivot.rotation.z = Math.sin(elapsed * 1.15) * 0.02 + Math.sin(elapsed * 2.4) * 0.007;
      outdoorPlantPivot.rotation.x = Math.cos(elapsed * 0.9) * 0.01;
      curtainLeft.rotation.y = Math.sin(elapsed * 0.72) * 0.014;
      curtainRight.rotation.y = Math.cos(elapsed * 0.68 + 1.1) * 0.014;

      const targetOpacity = THREE.MathUtils.smoothstep(cleanRatio, 0.18, 0.80) * 0.58;
      for (let i = 0; i < rainbowSpots.length; i++) {
        const sp = rainbowSpots[i];
        sp.material.opacity += (targetOpacity - sp.material.opacity) * Math.min(1, dt * 3.5);
        const bp = sp.userData.basePos;
        const dance = prismAngle * (0.35 + i * 0.14);
        const shimmer = Math.sin(elapsed * 1.4 + i * 1.7) * 0.008;
        if (i < 3) {
          sp.position.x = bp.x + dance + shimmer;
          sp.position.z = bp.z + Math.cos(elapsed * 1.1 + i) * 0.006 + Math.abs(prismAngle) * 0.05;
        } else {
          sp.position.y = bp.y + dance * 0.7 + shimmer;
        }
      }
    },
  };
}
