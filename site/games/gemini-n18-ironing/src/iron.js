import * as THREE from 'three';
import { BOARD_Y } from './room.js';
import { createContactShadowTexture } from './assets.js';

function soleHalfWidth(z) {
  const t = Math.min(1, Math.max(0, (0.115 - z) / 0.24));
  if (t < 0.14) {
    const k = (0.14 - t) / 0.14;
    return 0.056 * Math.sqrt(Math.max(0.01, 1 - k * k * 0.52));
  }
  const u = (t - 0.14) / 0.86;
  return 0.056 * Math.pow(Math.max(0.0001, 1 - Math.pow(u, 1.55)), 0.72);
}

function buildLoftedShell(zMin, zMax, zSteps, radSteps, profileFn) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let iz = 0; iz <= zSteps; iz++) {
    const tz = iz / zSteps;
    const z = zMin + (zMax - zMin) * tz;
    for (let ir = 0; ir <= radSteps; ir++) {
      const tr = ir / radSteps;
      const angle = tr * Math.PI;
      const pt = profileFn(z, tz, angle, tr);
      positions.push(pt.x, pt.y, pt.z);
      uvs.push(tr, tz);
    }
  }

  const stride = radSteps + 1;
  for (let iz = 0; iz < zSteps; iz++) {
    for (let ir = 0; ir < radSteps; ir++) {
      const a = iz * stride + ir;
      const b = a + 1;
      const c = (iz + 1) * stride + ir;
      const d = c + 1;
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a realistic household steam iron + dynamic braided power cord +
 * anatomical first-person right hand with natural oatmeal-linen sleeve cuff.
 */
export function buildSteamIron(scene, assets, restCenter) {
  const { textures } = assets;
  const ironGroup = new THREE.Group();
  ironGroup.name = 'steamIron';
  scene.add(ironGroup);

  const soleMetalMat = new THREE.MeshStandardMaterial({
    map: textures.metalBrushed.map,
    normalMap: textures.metalBrushed.normalMap,
    normalScale: new THREE.Vector2(0.32, 0.32),
    roughnessMap: textures.metalBrushed.roughnessMap,
    metalnessMap: textures.metalBrushed.metalnessMap,
    roughness: 0.22,
    metalness: 0.93,
    color: new THREE.Color('#dfe3e6'),
    envMapIntensity: 1.35,
  });

  const satinWhiteMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#eae5dc'),
    roughness: 0.34,
    metalness: 0.02,
    envMapIntensity: 0.85,
  });

  const sageBodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#5a726d'),
    roughness: 0.34,
    metalness: 0.06,
    envMapIntensity: 0.9,
  });

  // Translucent glossy clear-tinted water tank (fast physical clearcoat — zero expensive transmission pass!)
  const waterTankMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#9ec0c8'),
    roughness: 0.09,
    metalness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.62,
    envMapIntensity: 1.55,
  });

  const rubberGripMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#303438'),
    roughness: 0.76,
    metalness: 0.04,
    envMapIntensity: 0.45,
  });

  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1f2226'),
    roughness: 0.42,
    metalness: 0.72,
  });

  // ---------------------------------------------------------
  // 1. BRUSHED STAINLESS STEEL SOLEPLATE + STEAM VENTS
  // ---------------------------------------------------------
  const soleShape = new THREE.Shape();
  const sPts = 48;
  for (let i = 0; i <= sPts; i++) {
    const z = 0.115 - (i / sPts) * 0.24;
    const x = soleHalfWidth(z);
    if (i === 0) soleShape.moveTo(x, -z);
    else soleShape.lineTo(x, -z);
  }
  for (let i = sPts; i >= 0; i--) {
    const z = 0.115 - (i / sPts) * 0.24;
    const x = -soleHalfWidth(z);
    soleShape.lineTo(x, -z);
  }
  soleShape.closePath();

  const soleGeo = new THREE.ExtrudeGeometry(soleShape, {
    depth: 0.0082,
    bevelEnabled: true,
    bevelThickness: 0.0022,
    bevelSize: 0.0022,
    bevelSegments: 3,
  });
  soleGeo.rotateX(-Math.PI / 2);
  soleGeo.translate(0, 0.0022, 0);
  const soleMesh = new THREE.Mesh(soleGeo, soleMetalMat);
  soleMesh.castShadow = true;
  soleMesh.receiveShadow = true;
  ironGroup.add(soleMesh);

  // Dark stainless heat-break gasket + matte cream skirt directly above soleplate
  const gasketGeo = new THREE.ExtrudeGeometry(soleShape, {
    depth: 0.003,
    bevelEnabled: false,
  });
  gasketGeo.rotateX(-Math.PI / 2);
  gasketGeo.scale(0.95, 1, 0.96);
  gasketGeo.translate(0, 0.0108, 0.001);
  ironGroup.add(new THREE.Mesh(gasketGeo, darkMetalMat));

  const skirtGeo = new THREE.ExtrudeGeometry(soleShape, {
    depth: 0.009,
    bevelEnabled: true,
    bevelThickness: 0.0015,
    bevelSize: 0.001,
    bevelSegments: 2,
  });
  skirtGeo.rotateX(-Math.PI / 2);
  skirtGeo.scale(0.955, 1.0, 0.965);
  skirtGeo.translate(0, 0.0135, 0.001);
  const skirtMesh = new THREE.Mesh(skirtGeo, satinWhiteMat);
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  ironGroup.add(skirtMesh);

  // Recessed steam vents on underside
  const ventGeo = new THREE.CylinderGeometry(0.0022, 0.0022, 0.002, 8);
  const ventPositions = [];
  for (let i = 0; i < 9; i++) {
    const z = -0.095 + i * 0.021;
    const hw = soleHalfWidth(z) * 0.62;
    ventPositions.push([hw, z], [-hw, z]);
  }
  const ventsMesh = new THREE.InstancedMesh(ventGeo, darkMetalMat, ventPositions.length);
  const dummy = new THREE.Object3D();
  ventPositions.forEach(([vx, vz], idx) => {
    dummy.position.set(vx, 0.0004, vz);
    dummy.updateMatrix();
    ventsMesh.setMatrixAt(idx, dummy.matrix);
  });
  ironGroup.add(ventsMesh);

  // ---------------------------------------------------------
  // 2. TRANSLUCENT TINTED WATER TANK + LIVE SLOSHING WATER
  // ---------------------------------------------------------
  const tankGeo = buildLoftedShell(-0.104, 0.096, 26, 20, (z, tz, angle) => {
    const hw = soleHalfWidth(z) * 0.92;
    const domeH = 0.042 * Math.sin(Math.pow(tz, 0.85) * Math.PI * 0.92) + 0.013;
    const x = Math.cos(angle) * hw;
    const y = 0.021 + Math.sin(angle) * domeH;
    return { x, y, z };
  });
  const tankMesh = new THREE.Mesh(tankGeo, waterTankMat);
  tankMesh.castShadow = true;
  tankMesh.receiveShadow = true;
  ironGroup.add(tankMesh);

  // Inner sloshing water volume
  const innerWaterGroup = new THREE.Group();
  innerWaterGroup.position.set(0, 0.032, -0.006);
  const innerWaterGeo = new THREE.CylinderGeometry(0.033, 0.039, 0.017, 20);
  innerWaterGeo.scale(0.84, 1, 1.82);
  const innerWaterMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#6ca8b8'),
    roughness: 0.08,
    clearcoat: 0.9,
    transparent: true,
    opacity: 0.52,
  });
  const innerWaterMesh = new THREE.Mesh(innerWaterGeo, innerWaterMat);
  innerWaterGroup.add(innerWaterMesh);
  ironGroup.add(innerWaterGroup);

  // ---------------------------------------------------------
  // 3. SCULPTED UPPER BODY COWLING, CHROME TRIM & HANDLE
  // ---------------------------------------------------------
  const cowlGeo = buildLoftedShell(-0.084, 0.110, 24, 20, (z, tz, angle) => {
    const hw = soleHalfWidth(z) * (0.76 + 0.12 * tz);
    const crown = 0.024 + 0.041 * Math.pow(tz, 0.72);
    const x = Math.cos(angle) * hw;
    const y = 0.037 + Math.sin(angle) * crown;
    return { x, y, z };
  });
  const cowlMesh = new THREE.Mesh(cowlGeo, sageBodyMat);
  cowlMesh.castShadow = true;
  cowlMesh.receiveShadow = true;
  ironGroup.add(cowlMesh);

  // Crisp brushed stainless accent trim along the side waist seam (major realism detail!)
  for (const side of [-1, 1]) {
    const trimCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.016, 0.044, -0.082),
      new THREE.Vector3(side * 0.041, 0.049, -0.022),
      new THREE.Vector3(side * 0.049, 0.056, 0.052),
      new THREE.Vector3(side * 0.044, 0.064, 0.104),
    ]);
    const trimMesh = new THREE.Mesh(new THREE.TubeGeometry(trimCurve, 22, 0.0022, 8, false), soleMetalMat);
    ironGroup.add(trimMesh);
  }

  // Rear heel plate
  const heelShape = new THREE.Shape();
  heelShape.moveTo(-0.044, 0.015);
  heelShape.quadraticCurveTo(-0.050, 0.06, -0.033, 0.113);
  heelShape.quadraticCurveTo(0, 0.124, 0.033, 0.113);
  heelShape.quadraticCurveTo(0.050, 0.06, 0.044, 0.015);
  heelShape.closePath();
  const heelGeo = new THREE.ExtrudeGeometry(heelShape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 3,
  });
  heelGeo.translate(0, 0, 0.102);
  const heelMesh = new THREE.Mesh(heelGeo, satinWhiteMat);
  heelMesh.castShadow = true;
  heelMesh.receiveShadow = true;
  ironGroup.add(heelMesh);

  // Ergonomic swept handle
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.056, -0.070),
    new THREE.Vector3(0, 0.097, -0.046),
    new THREE.Vector3(0, 0.122, 0.008),
    new THREE.Vector3(0, 0.120, 0.074),
    new THREE.Vector3(0, 0.096, 0.110),
  ]);
  const handleGeo = new THREE.TubeGeometry(handleCurve, 36, 0.018, 16, false);
  handleGeo.scale(1.12, 0.88, 1.0);
  const handleMesh = new THREE.Mesh(handleGeo, satinWhiteMat);
  handleMesh.castShadow = true;
  handleMesh.receiveShadow = true;
  ironGroup.add(handleMesh);

  // Charcoal soft-touch rubber grip inset
  const gripCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.107, -0.034),
    new THREE.Vector3(0, 0.127, 0.010),
    new THREE.Vector3(0, 0.124, 0.072),
  ]);
  const gripGeo = new THREE.TubeGeometry(gripCurve, 22, 0.014, 14, false);
  gripGeo.scale(1.14, 0.72, 1.0);
  const gripMesh = new THREE.Mesh(gripGeo, rubberGripMat);
  gripMesh.castShadow = true;
  ironGroup.add(gripMesh);

  // Temperature dial tucked under handle
  const dialGroup = new THREE.Group();
  dialGroup.position.set(0, 0.068, 0.014);
  dialGroup.rotation.x = 0.22;
  const dialBody = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.023, 0.012, 28), darkMetalMat);
  dialBody.castShadow = true;
  dialGroup.add(dialBody);
  const dialCap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 24), soleMetalMat);
  dialGroup.add(dialCap);
  ironGroup.add(dialGroup);

  // Top steam-burst button + water fill cap
  const steamBtn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.0105, 0.008, 18),
    new THREE.MeshStandardMaterial({ color: '#456b7a', roughness: 0.34, metalness: 0.1 })
  );
  steamBtn.position.set(0, 0.121, -0.030);
  steamBtn.rotation.x = -0.36;
  steamBtn.castShadow = true;
  ironGroup.add(steamBtn);

  const fillCap = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.005, 0.024), waterTankMat);
  fillCap.position.set(0, 0.078, -0.066);
  fillCap.rotation.x = 0.44;
  ironGroup.add(fillCap);

  // Subtle warm amber heating pilot light
  const ledMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ff9d42'),
    emissive: new THREE.Color('#ff7b1c'),
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const ledMesh = new THREE.Mesh(new THREE.SphereGeometry(0.0036, 12, 12), ledMat);
  ledMesh.scale.set(1.2, 0.7, 1.5);
  ledMesh.position.set(0, 0.112, 0.096);
  ironGroup.add(ledMesh);

  // Rear swivel cord boot
  const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0105, 0.032, 14), rubberGripMat);
  boot.rotation.x = Math.PI * 0.42;
  boot.position.set(0, 0.081, 0.122);
  boot.castShadow = true;
  ironGroup.add(boot);

  // ---------------------------------------------------------
  // 4. DYNAMIC BRAIDED FABRIC POWER CORD
  // ---------------------------------------------------------
  const cordMat = new THREE.MeshStandardMaterial({
    map: textures.ecruLinen.map,
    normalMap: textures.ecruLinen.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5),
    color: new THREE.Color('#5a5b5d'),
    roughness: 0.86,
    metalness: 0.0,
  });

  const cordPts = [
    new THREE.Vector3(0.35, BOARD_Y + 0.08, 0.1),
    new THREE.Vector3(0.46, BOARD_Y + 0.02, 0.13),
    new THREE.Vector3(0.54, BOARD_Y - 0.16, 0.15),
    new THREE.Vector3(0.60, BOARD_Y - 0.44, 0.10),
    new THREE.Vector3(0.68, 0.06, -0.04),
  ];
  const cordCurve = new THREE.CatmullRomCurve3(cordPts);
  const cordMesh = new THREE.Mesh(new THREE.TubeGeometry(cordCurve, 24, 0.0046, 7, false), cordMat);
  cordMesh.castShadow = true;
  scene.add(cordMesh);

  const bootLocal = new THREE.Vector3(0, 0.081, 0.136);
  const bootWorld = new THREE.Vector3();

  function updateCord() {
    ironGroup.updateMatrixWorld(true);
    bootWorld.copy(bootLocal).applyMatrix4(ironGroup.matrixWorld);
    cordPts[0].copy(bootWorld);
    cordPts[1].set(
      Math.max(bootWorld.x + 0.07, 0.48),
      Math.min(bootWorld.y - 0.02, BOARD_Y + 0.025),
      bootWorld.z + 0.04
    );
    cordPts[2].set(0.56, BOARD_Y - 0.16, 0.13);
    cordPts[3].set(0.62, BOARD_Y - 0.44, 0.08);
    cordPts[4].set(0.70, 0.06, -0.05);

    const nextGeo = new THREE.TubeGeometry(cordCurve, 22, 0.0046, 7, false);
    cordMesh.geometry.dispose();
    cordMesh.geometry = nextGeo;
  }

  // Soft dark soleplate contact shadow right underneath the iron so it sits heavily grounded!
  const ironShadowTex = createContactShadowTexture();
  const ironShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.155, 0.275),
    new THREE.MeshBasicMaterial({
      map: ironShadowTex,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
    })
  );
  ironShadow.rotation.x = -Math.PI / 2;
  ironShadow.position.set(0, 0.0004, -0.005);
  ironGroup.add(ironShadow);

  // ---------------------------------------------------------
  // 5. NATURAL FIRST-PERSON RIGHT HAND + FOREGROUND-ANGLED LINEN SLEEVE
  // ---------------------------------------------------------
  const handGroup = buildFirstPersonHand(textures);
  handGroup.position.set(0.0, 0.118, 0.032);
  ironGroup.add(handGroup);

  const restPos = new THREE.Vector3(restCenter.x, restCenter.y + 0.0055, restCenter.z);
  const restRotY = Math.PI * 0.48;
  ironGroup.position.copy(restPos);
  ironGroup.rotation.set(0, restRotY, 0);
  updateCord();

  let handPresence = 0;
  let targetHandPresence = 0;
  let sloshX = 0;
  let sloshZ = 0;

  function setHeld(held, instant = false) {
    targetHandPresence = held ? 1 : 0;
    if (instant) handPresence = targetHandPresence;
  }

  function updateVisuals(dt, velX, velZ, isSteaming, time) {
    handPresence += (targetHandPresence - handPresence) * Math.min(1, dt * 11);
    handGroup.visible = handPresence > 0.02;
    if (handGroup.visible) {
      const retreat = 1 - handPresence;
      handGroup.position.set(0.002 + retreat * 0.08, 0.114 - retreat * 0.025, 0.026 + retreat * 0.15);
      handGroup.rotation.set(-retreat * 0.15, retreat * 0.1, 0);
      steamBtn.position.y = 0.121 - (isSteaming ? 0.0028 : 0);
    }

    // Fade soleplate contact shadow gently if iron lifts above board
    const heightAbove = Math.max(0, ironGroup.position.y - (BOARD_Y + 0.006));
    ironShadow.material.opacity = Math.max(0.08, 0.56 - heightAbove * 9.0);
    ironShadow.position.y = Math.max(-0.04, -heightAbove + 0.0005);

    const targetSloshZ = THREE.MathUtils.clamp(velX * 0.35, -0.22, 0.22);
    const targetSloshX = THREE.MathUtils.clamp(-velZ * 0.35, -0.22, 0.22);
    sloshX += (targetSloshX - sloshX) * Math.min(1, dt * 8);
    sloshZ += (targetSloshZ - sloshZ) * Math.min(1, dt * 8);
    innerWaterGroup.rotation.x = sloshX;
    innerWaterGroup.rotation.z = sloshZ;

    ledMat.emissiveIntensity = 1.4 + Math.sin(time * 2.2) * 0.22 + (isSteaming ? 0.5 : 0);
    updateCord();
  }

  return {
    group: ironGroup,
    handGroup,
    restPos,
    restRotY,
    setHeld,
    updateVisuals,
    updateCord,
  };
}

function buildFirstPersonHand(textures) {
  const group = new THREE.Group();
  group.name = 'firstPersonHand';

  // Warm realistic skin tone with subtle pore & blush variation (zero pale mannequin look!)
  const skinCanvas = document.createElement('canvas');
  skinCanvas.width = 256;
  skinCanvas.height = 256;
  const sctx = skinCanvas.getContext('2d');
  const sgrad = sctx.createLinearGradient(0, 0, 0, 256);
  sgrad.addColorStop(0, '#c89578');
  sgrad.addColorStop(0.5, '#d19f82');
  sgrad.addColorStop(1, '#bd896c');
  sctx.fillStyle = sgrad;
  sctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 1 + Math.random() * 3.0;
    sctx.fillStyle = Math.random() > 0.5 ? 'rgba(155, 92, 68, 0.07)' : 'rgba(240, 198, 174, 0.06)';
    sctx.beginPath();
    sctx.arc(x, y, r, 0, Math.PI * 2);
    sctx.fill();
  }
  const skinTex = new THREE.CanvasTexture(skinCanvas);
  skinTex.colorSpace = THREE.SRGBColorSpace;

  const skinMat = new THREE.MeshPhysicalMaterial({
    map: skinTex,
    roughness: 0.62,
    metalness: 0.0,
    sheen: 0.22,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color('#df9e82'),
    envMapIntensity: 0.42,
  });

  const nailMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#deb7a7'),
    roughness: 0.30,
    metalness: 0.0,
    clearcoat: 0.28,
    clearcoatRoughness: 0.28,
  });

  // Natural woven oatmeal-linen cardigan/shirt sleeve extending seamlessly toward the viewer's right shoulder!
  const sleeveMat = new THREE.MeshStandardMaterial({
    map: textures.sleeveLinen.map,
    normalMap: textures.sleeveLinen.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    aoMap: textures.sleeveLinen.armMap,
    roughnessMap: textures.sleeveLinen.armMap,
    color: new THREE.Color('#ddd4c4'),
    roughness: 0.92,
    metalness: 0.0,
  });

  // Sculpted hand dorsum seamlessly bridging into the wrist (zero visible seam!)
  const palmGeo = new THREE.SphereGeometry(0.036, 24, 18);
  palmGeo.scale(1.02, 0.56, 1.38);
  const palm = new THREE.Mesh(palmGeo, skinMat);
  palm.position.set(0.002, 0.015, 0.028);
  palm.rotation.set(-0.10, -0.22, -0.10);
  palm.castShadow = true;
  palm.receiveShadow = true;
  group.add(palm);

  // Soft wrist-dorsum transition pad so palm flows organically into forearm
  const wristBridge = new THREE.Mesh(new THREE.SphereGeometry(0.028, 18, 14), skinMat);
  wristBridge.scale.set(1.05, 0.72, 1.45);
  wristBridge.position.set(-0.012, 0.011, 0.068);
  wristBridge.rotation.y = -0.34;
  wristBridge.castShadow = true;
  group.add(wristBridge);

  // Soft knuckle ridge blending palm into fingers
  const knuckleRidge = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.044, 8, 14), skinMat);
  knuckleRidge.rotation.x = Math.PI / 2;
  knuckleRidge.position.set(-0.015, 0.014, 0.014);
  knuckleRidge.scale.set(0.9, 1.0, 0.78);
  knuckleRidge.castShadow = true;
  group.add(knuckleRidge);

  function addCurvedFinger(pts, rBase, rTip, hasNail = true) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const segs = 16;
    const radSegs = 12;
    const frames = curve.computeFrenetFrames(segs, false);
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = curve.getPointAt(t);
      let r = THREE.MathUtils.lerp(rBase, rTip, Math.pow(t, 0.85));
      r *= 1 + 0.04 * Math.sin(t * Math.PI * 3);
      if (t > 0.9) r *= Math.sqrt(Math.max(0.02, 1 - Math.pow((t - 0.9) / 0.1, 2)));
      const N = frames.normals[i];
      const B = frames.binormals[i];
      for (let j = 0; j <= radSegs; j++) {
        const a = (j / radSegs) * Math.PI * 2;
        const ca = Math.cos(a) * r;
        const sa = Math.sin(a) * r * 0.92;
        positions.push(
          p.x + N.x * ca + B.x * sa,
          p.y + N.y * ca + B.y * sa,
          p.z + N.z * ca + B.z * sa
        );
        uvs.push(j / radSegs, t);
      }
    }

    const stride = radSegs + 1;
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < radSegs; j++) {
        const a = i * stride + j;
        const b = a + 1;
        const c = (i + 1) * stride + j;
        const d = c + 1;
        // Outward-facing winding so fingers are 100% solid & sunlit!
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, skinMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    if (hasNail) {
      const tip = curve.getPointAt(0.92);
      const tan = curve.getTangentAt(0.92);
      const nail = new THREE.Mesh(new THREE.SphereGeometry(rTip * 0.70, 10, 8), nailMat);
      nail.scale.set(0.85, 0.24, 1.1);
      nail.position.copy(tip).add(new THREE.Vector3(0, rTip * 0.40, 0));
      nail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), tan);
      group.add(nail);
    }
  }

  // Fuller, realistic wrapped fingers gripping snugly around the charcoal iron handle
  addCurvedFinger([
    new THREE.Vector3(-0.013, 0.016, -0.012),
    new THREE.Vector3(-0.022, 0.012, -0.032),
    new THREE.Vector3(-0.024, -0.004, -0.040),
    new THREE.Vector3(-0.015, -0.017, -0.036),
  ], 0.0108, 0.0080);

  addCurvedFinger([
    new THREE.Vector3(-0.014, 0.016, 0.006),
    new THREE.Vector3(-0.024, 0.007, -0.008),
    new THREE.Vector3(-0.024, -0.011, -0.010),
    new THREE.Vector3(-0.013, -0.019, -0.004),
  ], 0.0110, 0.0082);

  addCurvedFinger([
    new THREE.Vector3(-0.013, 0.015, 0.024),
    new THREE.Vector3(-0.023, 0.004, 0.012),
    new THREE.Vector3(-0.022, -0.012, 0.011),
    new THREE.Vector3(-0.012, -0.019, 0.015),
  ], 0.0102, 0.0076);

  addCurvedFinger([
    new THREE.Vector3(-0.010, 0.013, 0.040),
    new THREE.Vector3(-0.020, 0.002, 0.030),
    new THREE.Vector3(-0.018, -0.012, 0.029),
    new THREE.Vector3(-0.009, -0.017, 0.032),
  ], 0.0088, 0.0066);

  // Thumb curving naturally along the viewer-facing side of the handle
  addCurvedFinger([
    new THREE.Vector3(0.024, 0.008, 0.026),
    new THREE.Vector3(0.028, 0.004, -0.002),
    new THREE.Vector3(0.022, 0.002, -0.025),
    new THREE.Vector3(0.014, 0.003, -0.036),
  ], 0.0122, 0.0090);

  // Wrist & forearm angled NATURALLY back-and-down toward the first-person viewer's right shoulder
  // (local -X,+Z when iron faces left = right-foreground bottom corner of camera! Never floats mid-air!)
  const wristCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.004, 0.012, 0.052),
    new THREE.Vector3(-0.032, 0.004, 0.115),
    new THREE.Vector3(-0.088, -0.018, 0.185),
  ]);
  const wristGeo = new THREE.TubeGeometry(wristCurve, 18, 0.026, 16, false);
  wristGeo.scale(1.06, 0.86, 1.0);
  const wristMesh = new THREE.Mesh(wristGeo, skinMat);
  wristMesh.castShadow = true;
  wristMesh.receiveShadow = true;
  group.add(wristMesh);

  // Softly draped woven linen sleeve extending all the way out past the bottom-right foreground of camera!
  const cuffCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.048, -0.002, 0.132),
    new THREE.Vector3(-0.145, -0.038, 0.255),
    new THREE.Vector3(-0.295, -0.095, 0.42),
    new THREE.Vector3(-0.48, -0.16, 0.62),
  ]);
  const cuffGeo = new THREE.TubeGeometry(cuffCurve, 26, 0.037, 18, false);
  // Subtle organic fabric folds along the sleeve so it looks like soft linen, not a rigid cylinder
  const cp = cuffGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    const y = cp.getY(i);
    const z = cp.getZ(i);
    const fold = Math.sin(z * 48 + x * 20) * 0.0022;
    cp.setXYZ(i, x + fold, y + fold * 0.8, z);
  }
  cuffGeo.computeVertexNormals();
  const cuffMesh = new THREE.Mesh(cuffGeo, sleeveMat);
  cuffMesh.castShadow = true;
  cuffMesh.receiveShadow = true;
  group.add(cuffMesh);

  // Soft rolled cuff edge oriented along the wrist tangent
  const cuffDir = cuffCurve.getTangentAt(0).normalize();
  const hemRing = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.007, 10, 22), sleeveMat);
  hemRing.position.copy(cuffCurve.getPointAt(0));
  hemRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), cuffDir);
  hemRing.castShadow = true;
  group.add(hemRing);

  return group;
}
