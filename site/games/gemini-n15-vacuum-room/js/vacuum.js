import * as THREE from 'three';
import {
  createBrushedMetalTextures,
  createMattePolymerTextures,
  createCycloneMeshTextures,
  createAcrylicRoughnessTexture,
  createRollerBrushTextures,
  createSkinTextures,
  createRectShadowTexture,
} from './textures.js';

/**
 * Builds a smooth organically lofted tube along a 3D curve using a twist-free
 * Parallel Transport (Bishop) frame, optional organic cloth/skin surface ripple,
 * and smoothly rounded multi-ring dome end caps (zero Frenet twisting or pinched spikes!).
 */
function buildOrganicLoft(
  curve,
  segments,
  radialSegs,
  radiusFn,
  { capStart = true, capEnd = true, refUp = new THREE.Vector3(0, 1, 0), rippleFn = null } = {}
) {
  const tangents = [];
  const normals = [];
  const binormals = [];

  for (let i = 0; i <= segments; i++) {
    tangents.push(curve.getTangentAt(i / segments).normalize());
  }

  // Initial orthogonal normal via stable reference up vector
  const n0 = new THREE.Vector3().copy(refUp);
  if (Math.abs(n0.dot(tangents[0])) > 0.92) {
    n0.set(1, 0, 0);
  }
  n0.addScaledVector(tangents[0], -n0.dot(tangents[0])).normalize();
  normals.push(n0);
  binormals.push(new THREE.Vector3().crossVectors(tangents[0], n0).normalize());

  const stepQuat = new THREE.Quaternion();
  for (let i = 1; i <= segments; i++) {
    stepQuat.setFromUnitVectors(tangents[i - 1], tangents[i]);
    const ni = normals[i - 1].clone().applyQuaternion(stepQuat);
    ni.addScaledVector(tangents[i], -ni.dot(tangents[i])).normalize();
    normals.push(ni);
    binormals.push(new THREE.Vector3().crossVectors(tangents[i], ni).normalize());
  }

  const positions = [];
  const uvs = [];
  const indices = [];
  const rings = [];

  function pushRing(center, N, B, rx, ry, shiftN, shiftB, vCoord, tForRipple) {
    const ringStart = positions.length / 3;
    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const theta = u * Math.PI * 2;
      const rScale = rippleFn ? 1 + rippleFn(tForRipple, theta) : 1;
      const ox = Math.cos(theta) * rx * rScale + shiftN;
      const oy = Math.sin(theta) * ry * rScale + shiftB;
      positions.push(
        center.x + N.x * ox + B.x * oy,
        center.y + N.y * ox + B.y * oy,
        center.z + N.z * ox + B.z * oy
      );
      uvs.push(u, vCoord);
    }
    rings.push(ringStart);
  }

  // Smooth hemispherical start cap (2 intermediate rounded rings)
  if (capStart) {
    const p0 = curve.getPointAt(0);
    const [rx0, ry0, sN0 = 0, sB0 = 0] = radiusFn(0);
    const capLen = Math.min(rx0, ry0) * 0.72;
    const tipIdx = positions.length / 3;
    const tipCenter = p0.clone().addScaledVector(tangents[0], -capLen);
    positions.push(
      tipCenter.x + normals[0].x * sN0 + binormals[0].x * sB0,
      tipCenter.y + normals[0].y * sN0 + binormals[0].y * sB0,
      tipCenter.z + normals[0].z * sN0 + binormals[0].z * sB0
    );
    uvs.push(0.5, 0);
    for (const frac of [0.82, 0.45]) {
      const c = p0.clone().addScaledVector(tangents[0], -capLen * frac);
      const shrink = Math.sqrt(Math.max(0.01, 1 - frac * frac));
      pushRing(c, normals[0], binormals[0], rx0 * shrink, ry0 * shrink, sN0, sB0, 0, 0);
    }
    const r0 = rings[0];
    for (let j = 0; j < radialSegs; j++) {
      // Outward-facing winding for start dome cap!
      indices.push(tipIdx, r0 + j + 1, r0 + j);
    }
  }

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = curve.getPointAt(t);
    const [rx, ry, shiftN = 0, shiftB = 0] = radiusFn(t);
    pushRing(pt, normals[i], binormals[i], rx, ry, shiftN, shiftB, t, t);
  }

  // Smooth hemispherical end cap (2 intermediate rounded rings)
  let endTipIdx = -1;
  if (capEnd) {
    const p1 = curve.getPointAt(1);
    const [rx1, ry1, sN1 = 0, sB1 = 0] = radiusFn(1);
    const capLen = Math.min(rx1, ry1) * 0.78;
    for (const frac of [0.45, 0.82]) {
      const c = p1.clone().addScaledVector(tangents[segments], capLen * frac);
      const shrink = Math.sqrt(Math.max(0.01, 1 - frac * frac));
      pushRing(c, normals[segments], binormals[segments], rx1 * shrink, ry1 * shrink, sN1, sB1, 1, 1);
    }
    endTipIdx = positions.length / 3;
    const tipCenter = p1.clone().addScaledVector(tangents[segments], capLen);
    positions.push(
      tipCenter.x + normals[segments].x * sN1 + binormals[segments].x * sB1,
      tipCenter.y + normals[segments].y * sN1 + binormals[segments].y * sB1,
      tipCenter.z + normals[segments].z * sN1 + binormals[segments].z * sB1
    );
    uvs.push(0.5, 1);
  }

  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    for (let j = 0; j < radialSegs; j++) {
      // Outward-facing CCW winding (matches right-handed T x N = B frame!)
      indices.push(a + j, a + j + 1, b + j);
      indices.push(b + j, a + j + 1, b + j + 1);
    }
  }

  if (capEnd && endTipIdx >= 0) {
    const rN = rings[rings.length - 1];
    for (let j = 0; j < radialSegs; j++) {
      // Outward-facing winding for end dome cap!
      indices.push(rN + j, rN + j + 1, endTipIdx);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

async function loadSleeveMaterial(maxAniso) {
  const loader = new THREE.TextureLoader();
  const load = (url, srgb) =>
    new Promise((res, rej) => {
      loader.load(
        url,
        (t) => {
          t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(3.0, 15.0);
          t.anisotropy = maxAniso;
          res(t);
        },
        undefined,
        rej
      );
    });
  const [diff, nor, arm] = await Promise.all([
    load('./assets/textures/sleeve/diff.jpg', true),
    load('./assets/textures/sleeve/nor_gl.jpg', false),
    load('./assets/textures/sleeve/arm.jpg', false),
  ]);
  return new THREE.MeshStandardMaterial({
    map: diff,
    color: new THREE.Color(0xcabfb4), // natural warm oatmeal-linen knitted cardigan
    normalMap: nor,
    normalScale: new THREE.Vector2(2.1, 2.1),
    aoMap: arm,
    aoMapIntensity: 0.78,
    roughnessMap: arm,
    roughness: 0.97,
    metalness: 0.0,
    envMapIntensity: 0.28,
    side: THREE.FrontSide,
  });
}

/**
 * Precision-engineered modern cordless cyclonic stick vacuum + realistic first-person hand.
 * Single-pass physical polycarbonate keeps draw calls & triangle count well under mobile budgets
 * while keeping internal swirling debris and spinning soft roller razor-sharp!
 */
export async function buildVacuumSystem(scene, renderer) {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const brushed = createBrushedMetalTextures();
  const polymer = createMattePolymerTextures();
  const cycloneMeshTex = createCycloneMeshTextures();
  const acrylicRoughTex = createAcrylicRoughnessTexture();
  const rollerTex = createRollerBrushTextures();
  const skinTex = createSkinTextures();
  const rectShadowTex = createRectShadowTexture();
  const sleeveMat = await loadSleeveMaterial(maxAniso);

  // --- Shared Photorealistic Materials ---
  const graphiteBodyMat = new THREE.MeshStandardMaterial({
    color: 0x32353b, // satin anodized gunmetal charcoal
    roughness: 0.44,
    roughnessMap: polymer.roughnessMap,
    bumpMap: polymer.bumpMap,
    bumpScale: 0.0005,
    metalness: 0.22,
    envMapIntensity: 1.0,
  });

  const titaniumShellMat = new THREE.MeshStandardMaterial({
    color: 0x8f8a82, // brushed warm nickel-titanium metallic housing (like real Dyson V12 / Shark)
    roughness: 0.36,
    roughnessMap: brushed.roughnessMap,
    bumpMap: brushed.bumpMap,
    bumpScale: 0.00045,
    metalness: 0.68,
    envMapIntensity: 1.15,
  });

  const darkRubberMat = new THREE.MeshStandardMaterial({
    color: 0x1d1f22,
    roughness: 0.82,
    roughnessMap: polymer.roughnessMap,
    bumpMap: polymer.bumpMap,
    bumpScale: 0.0008,
    metalness: 0.0,
  });

  const brushedAlumMat = new THREE.MeshStandardMaterial({
    color: 0xc5bfb4, // champagne-silver brushed anodized aluminum wand
    metalness: 0.86,
    roughness: 0.3,
    roughnessMap: brushed.roughnessMap,
    bumpMap: brushed.bumpMap,
    bumpScale: 0.0006,
    envMapIntensity: 1.25,
  });

  const latchRedMat = new THREE.MeshStandardMaterial({
    color: 0xa93c2b, // realistic anodized terracotta-crimson mechanical release latch
    roughness: 0.36,
    metalness: 0.28,
    roughnessMap: polymer.roughnessMap,
  });

  // Crisp single-pass physical clear polycarbonate (NO double-scene transmission pass!)
  // Shows specular window reflection streaks on curved walls while keeping internal debris 100% sharp!
  const clearPolyMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4f9ff,
    transparent: true,
    opacity: 0.24,
    roughness: 0.05,
    roughnessMap: acrylicRoughTex,
    metalness: 0.08,
    ior: 1.52,
    reflectivity: 0.96,
    envMapIntensity: 2.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    depthWrite: false,
    side: THREE.FrontSide,
  });

  const clearInnerWallMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf2f8,
    transparent: true,
    opacity: 0.08,
    roughness: 0.12,
    metalness: 0.0,
    envMapIntensity: 1.1,
    depthWrite: false,
    side: THREE.BackSide,
  });

  const clearRibMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.24,
    roughness: 0.1,
    metalness: 0.05,
    depthWrite: false,
  });

  const cycloneShroudMat = new THREE.MeshStandardMaterial({
    map: cycloneMeshTex.map,
    bumpMap: cycloneMeshTex.bumpMap,
    bumpScale: 0.0018,
    metalness: 0.82,
    roughness: 0.32,
    envMapIntensity: 1.2,
  });

  // Natural matte human skin (warm photographic tone, soft skin roughness 0.78, subtle warm subsurface sheen, zero plastic specular!)
  const skinMat = new THREE.MeshPhysicalMaterial({
    map: skinTex.map,
    color: new THREE.Color(0xf0d6c4),
    bumpMap: skinTex.bumpMap,
    bumpScale: 0.00045,
    roughnessMap: skinTex.roughnessMap,
    roughness: 0.78,
    metalness: 0.0,
    reflectivity: 0.28,
    sheen: 0.36,
    sheenRoughness: 0.84,
    sheenColor: new THREE.Color(0xd89378),
    envMapIntensity: 0.28,
  });

  const nailMat = new THREE.MeshPhysicalMaterial({
    color: 0xe8cbc0,
    roughness: 0.38,
    metalness: 0.0,
    clearcoat: 0.25,
    clearcoatRoughness: 0.34,
  });

  // =========================================================================
  // 1. MOTORIZED OPEN-WINDOW SOFT-ROLLER FLOOR HEAD (front = -Z)
  // =========================================================================
  const floorHeadGroup = new THREE.Group();
  floorHeadGroup.name = 'VacuumFloorHead';
  scene.add(floorHeadGroup);

  const headW = 0.255;
  const headD = 0.138;
  const hw = headW / 2;
  const hd = headD / 2;

  // Slim sculpted rear satin-graphite chassis (ONLY behind the large front roller chamber: Z = +0.006 to +hd)
  const rearChassisShape = new THREE.Shape();
  // In 2D shape with rotateX(-PI/2): shape +Y -> 3D -Z, shape -Y -> 3D +Z
  rearChassisShape.moveTo(-hw + 0.018, -hd);
  rearChassisShape.lineTo(hw - 0.018, -hd);
  rearChassisShape.quadraticCurveTo(hw, -hd, hw, -hd + 0.018);
  rearChassisShape.lineTo(hw, -0.004);
  rearChassisShape.lineTo(-hw, -0.004);
  rearChassisShape.lineTo(-hw, -hd + 0.018);
  rearChassisShape.quadraticCurveTo(-hw, -hd, -hw + 0.018, -hd);

  const rearChassisGeo = new THREE.ExtrudeGeometry(rearChassisShape, {
    depth: 0.02,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 3,
    curveSegments: 10,
  });
  rearChassisGeo.rotateX(-Math.PI / 2);
  const rearChassis = new THREE.Mesh(rearChassisGeo, graphiteBodyMat);
  rearChassis.position.y = 0.012;
  rearChassis.castShadow = true;
  rearChassis.receiveShadow = true;
  floorHeadGroup.add(rearChassis);

  // Subtle brushed-titanium slim top trim bridge along the rear spine (NOT a huge white block!)
  const topTrim = new THREE.Mesh(
    new THREE.BoxGeometry(headW - 0.036, 0.009, 0.034),
    titaniumShellMat
  );
  topTrim.position.set(0, 0.036, 0.032);
  topTrim.receiveShadow = true;
  floorHeadGroup.add(topTrim);

  // Recessed central suction intake channel connecting roller chamber to swivel ball
  const centerSpine = new THREE.Mesh(
    new THREE.BoxGeometry(0.056, 0.018, 0.06),
    graphiteBodyMat
  );
  centerSpine.position.set(0, 0.039, 0.028);
  floorHeadGroup.add(centerSpine);

  // Dark matte rubber rear-skirt inner brush housing (gives crisp shadow depth behind the striped roller)
  const rollerBackWall = new THREE.Mesh(
    new THREE.CylinderGeometry(0.027, 0.027, headW - 0.018, 16, 1, true, Math.PI * 0.08, Math.PI * 0.85),
    darkRubberMat
  );
  rollerBackWall.rotation.z = Math.PI / 2;
  rollerBackWall.rotation.y = Math.PI;
  rollerBackWall.position.set(0, 0.026, -0.028);
  floorHeadGroup.add(rollerBackWall);

  // Prominent Spinning Diagonal-Striped Microfiber Soft Roller Brush (clearly visible across FRONT half!)
  const rollerGroup = new THREE.Group();
  rollerGroup.position.set(0, 0.024, -0.028);
  const rollerGeo = new THREE.CylinderGeometry(0.023, 0.023, headW - 0.024, 28);
  rollerGeo.rotateZ(Math.PI / 2);
  const rollerMat = new THREE.MeshStandardMaterial({
    map: rollerTex.map,
    roughness: 0.94,
    metalness: 0.0,
    envMapIntensity: 0.45,
  });
  const rollerMesh = new THREE.Mesh(rollerGeo, rollerMat);
  rollerMesh.castShadow = true;
  rollerMesh.receiveShadow = true;
  rollerGroup.add(rollerMesh);
  floorHeadGroup.add(rollerGroup);

  // Crystal-clear curved polycarbonate top inspection window over the spinning roller
  const rollerCoverGeo = new THREE.CylinderGeometry(
    0.029,
    0.029,
    headW - 0.02,
    24,
    1,
    true,
    -Math.PI * 0.42,
    Math.PI * 0.84
  );
  rollerCoverGeo.rotateZ(Math.PI / 2);
  const rollerCover = new THREE.Mesh(rollerCoverGeo, clearPolyMat);
  rollerCover.position.set(0, 0.027, -0.028);
  rollerCover.renderOrder = 3;
  floorHeadGroup.add(rollerCover);

  // Sleek front brushed-aluminum accent bar + dark rubber soft bumper lip
  const frontLip = new THREE.Mesh(
    new THREE.BoxGeometry(headW - 0.01, 0.0065, 0.01),
    brushedAlumMat
  );
  frontLip.position.set(0, 0.019, -0.06);
  floorHeadGroup.add(frontLip);

  const bumper = new THREE.Mesh(
    new THREE.BoxGeometry(headW + 0.004, 0.01, 0.008),
    darkRubberMat
  );
  bumper.position.set(0, 0.01, -0.062);
  floorHeadGroup.add(bumper);

  // Side sculpted end-caps framing the roller, with machined axle rings & rear rubber wheels
  for (const side of [-1, 1]) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0295, 0.0295, 0.013, 20),
      graphiteBodyMat
    );
    cap.rotation.z = Math.PI / 2;
    cap.position.set(side * (hw - 0.0065), 0.027, -0.028);
    floorHeadGroup.add(cap);

    const axleCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 0.015, 14),
      brushedAlumMat
    );
    axleCap.rotation.z = Math.PI / 2;
    axleCap.position.set(side * (hw - 0.0055), 0.027, -0.028);
    floorHeadGroup.add(axleCap);

    const sideRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.013, 0.024, 0.048),
      graphiteBodyMat
    );
    sideRail.position.set(side * (hw - 0.0065), 0.022, 0.002);
    floorHeadGroup.add(sideRail);

    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0185, 0.0185, 0.014, 16),
      darkRubberMat
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * (hw - 0.018), 0.0185, hd - 0.016);
    floorHeadGroup.add(wheel);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0075, 0.0075, 0.016, 12),
      brushedAlumMat
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.set(side * (hw - 0.018), 0.0185, hd - 0.016);
    floorHeadGroup.add(hub);
  }

  // Slim recessed front LED optical strip + adaptive grazing spotlight (subtle on sunlit floor, strong under sofa!)
  const ledStripMat = new THREE.MeshStandardMaterial({
    color: 0xfffaf0,
    emissive: new THREE.Color(0xfff1d6),
    emissiveIntensity: 1.1,
    roughness: 0.2,
  });
  const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.0035, 0.004), ledStripMat);
  ledStrip.position.set(0, 0.021, -0.065);
  floorHeadGroup.add(ledStrip);

  const headLedLight = new THREE.SpotLight(0xfff4e0, 0.35, 1.35, Math.PI * 0.34, 0.85, 1.6);
  headLedLight.position.set(0, 0.026, -0.088);
  const headLedTarget = new THREE.Object3D();
  headLedTarget.position.set(0, 0.0, -0.65);
  floorHeadGroup.add(headLedLight);
  floorHeadGroup.add(headLedTarget);
  headLedLight.target = headLedTarget;

  // Dual-axis swivel ball joint at rear center
  const swivelBall = new THREE.Mesh(new THREE.SphereGeometry(0.022, 18, 14), graphiteBodyMat);
  swivelBall.position.set(0, 0.036, 0.044);
  swivelBall.castShadow = true;
  floorHeadGroup.add(swivelBall);

  // Grounded contact shadow directly underneath the floor head
  const headShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(headW + 0.075, headD + 0.075),
    new THREE.MeshBasicMaterial({
      map: rectShadowTex,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
    })
  );
  headShadow.rotation.x = -Math.PI / 2;
  headShadow.position.set(0, 0.0014, 0);
  floorHeadGroup.add(headShadow);

  // =========================================================================
  // 2. WAND + HERO TRANSPARENT CYCLONE CUP + SLEEK TITANIUM MOTOR + GRIP + HAND
  //    Origin = swivel ball pivot on floor head. +Z runs UP the wand to hand!
  // =========================================================================
  const wandGroup = new THREE.Group();
  wandGroup.name = 'VacuumWandAndBody';
  scene.add(wandGroup);

  // Ribbed corrugated flexible suction bellows hose
  const hosePts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const z = t * 0.075;
    const r = 0.017 + Math.sin(t * Math.PI * 10) * 0.0022;
    hosePts.push(new THREE.Vector2(r, z));
  }
  const hoseGeo = new THREE.LatheGeometry(hosePts, 20);
  hoseGeo.rotateX(Math.PI / 2);
  const hoseMesh = new THREE.Mesh(hoseGeo, darkRubberMat);
  hoseMesh.castShadow = true;
  wandGroup.add(hoseMesh);

  // Lower quick-release coupling collar
  const lowerCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0205, 0.022, 0.044, 20),
    graphiteBodyMat
  );
  lowerCollar.rotation.x = Math.PI / 2;
  lowerCollar.position.z = 0.094;
  lowerCollar.castShadow = true;
  wandGroup.add(lowerCollar);

  // Brushed champagne-aluminum wand shaft
  const wandBaseLen = 0.44;
  const wandTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, wandBaseLen, 24),
    brushedAlumMat
  );
  wandTube.rotation.x = Math.PI / 2;
  wandTube.position.z = 0.11 + wandBaseLen / 2;
  wandTube.castShadow = true;
  wandTube.receiveShadow = true;
  wandGroup.add(wandTube);

  // Upper handheld assembly (hand grip center is at local z = +0.285!)
  const HAND_GRIP_LOCAL_Z = 0.285;
  const handheldGroup = new THREE.Group();
  handheldGroup.position.z = 0.46;
  wandGroup.add(handheldGroup);

  // Upper quick-release collar + red push button
  const upperCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.023, 0.02, 0.044, 22),
    graphiteBodyMat
  );
  upperCollar.rotation.x = Math.PI / 2;
  upperCollar.position.z = 0.018;
  upperCollar.castShadow = true;
  handheldGroup.add(upperCollar);

  const releaseBtn = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.0065, 0.018), latchRedMat);
  releaseBtn.position.set(0, 0.0215, 0.018);
  handheldGroup.add(releaseBtn);

  // --- HERO TRANSPARENT CYCLONE DUST CUP (z = 0.036 to 0.252, diameter 11.8cm!) ---
  const cupGroup = new THREE.Group();
  cupGroup.name = 'DustCupAssembly';
  cupGroup.position.set(0, 0.004, 0.036);
  handheldGroup.add(cupGroup);

  const cupLen = 0.214;
  const cupR = 0.059;

  // Front hinged bottom dust-release lid
  const cupFlapPivot = new THREE.Group();
  cupFlapPivot.name = 'CupFlapPivot';
  cupFlapPivot.position.set(0, -cupR + 0.004, 0.002);
  cupGroup.add(cupFlapPivot);

  const lidDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(cupR + 0.002, cupR + 0.003, 0.013, 36),
    graphiteBodyMat
  );
  lidDisc.rotation.x = Math.PI / 2;
  lidDisc.position.set(0, cupR - 0.004, 0);
  lidDisc.castShadow = true;
  cupFlapPivot.add(lidDisc);

  const gasket = new THREE.Mesh(
    new THREE.TorusGeometry(cupR - 0.0045, 0.0036, 8, 32),
    darkRubberMat
  );
  gasket.position.set(0, cupR - 0.004, 0.0075);
  cupFlapPivot.add(gasket);

  const hingePin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 0.032, 10),
    brushedAlumMat
  );
  hingePin.rotation.z = Math.PI / 2;
  hingePin.position.set(0, -0.004, 0);
  cupFlapPivot.add(hingePin);

  // Inner perforated stainless-steel cyclone shroud (sharply visible inside crystal-clear cup!)
  const shroud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0235, 0.0255, cupLen * 0.72, 28, 1, true),
    cycloneShroudMat
  );
  shroud.rotation.x = Math.PI / 2;
  shroud.position.z = cupLen * 0.62;
  cupGroup.add(shroud);

  // Tapered rubber debris separator skirt ring inside cyclone
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.0245, 0.016, 26),
    darkRubberMat
  );
  skirt.rotation.x = Math.PI / 2;
  skirt.position.z = cupLen * 0.28;
  cupGroup.add(skirt);

  // Inner brushed metallic cone tip
  const innerCone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.017, 0.0235, 0.024, 22),
    brushedAlumMat
  );
  innerCone.rotation.x = Math.PI / 2;
  innerCone.position.z = cupLen * 0.17;
  cupGroup.add(innerCone);

  // Container for swirling & piling-up real 3D debris inside the transparent cyclone chamber!
  const cupDebrisContainer = new THREE.Group();
  cupDebrisContainer.name = 'CupDebrisContainer';
  cupDebrisContainer.position.z = cupLen * 0.5;
  cupGroup.add(cupDebrisContainer);

  // Inner + outer single-pass crystal clear polycarbonate cylinder walls (rendered cleanly AFTER debris!)
  const cupInnerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(cupR - 0.0025, cupR - 0.0025, cupLen, 36, 1, true),
    clearInnerWallMat
  );
  cupInnerWall.rotation.x = Math.PI / 2;
  cupInnerWall.position.z = cupLen * 0.5;
  cupInnerWall.renderOrder = 3;
  cupGroup.add(cupInnerWall);

  const cupWall = new THREE.Mesh(
    new THREE.CylinderGeometry(cupR, cupR, cupLen, 40, 1, true),
    clearPolyMat
  );
  cupWall.rotation.x = Math.PI / 2;
  cupWall.position.z = cupLen * 0.5;
  cupWall.renderOrder = 4;
  cupGroup.add(cupWall);

  // Fine brushed-silver MAX ring (zero text!)
  const maxLineRing = new THREE.Mesh(
    new THREE.TorusGeometry(cupR + 0.0007, 0.0009, 8, 40),
    brushedAlumMat
  );
  maxLineRing.position.z = cupLen * 0.36;
  cupGroup.add(maxLineRing);

  // Rear cup collar & sleek beveled anodized terracotta-red thumb release slider (no Lego brick!)
  const cupRearCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(cupR + 0.0025, cupR + 0.0025, 0.02, 36),
    graphiteBodyMat
  );
  cupRearCollar.rotation.x = Math.PI / 2;
  cupRearCollar.position.z = cupLen + 0.006;
  cupRearCollar.castShadow = true;
  cupGroup.add(cupRearCollar);

  const cupLatchGroup = new THREE.Group();
  cupLatchGroup.name = 'CupReleaseLatch';
  const latchRail = new THREE.Mesh(new THREE.BoxGeometry(0.017, 0.005, 0.044), darkRubberMat);
  latchRail.position.set(0, cupR + 0.0015, cupLen - 0.008);
  cupLatchGroup.add(latchRail);

  const latchShape = new THREE.Shape();
  latchShape.moveTo(-0.0065, -0.014);
  latchShape.lineTo(0.0065, -0.014);
  latchShape.quadraticCurveTo(0.008, -0.014, 0.008, -0.011);
  latchShape.lineTo(0.008, 0.011);
  latchShape.quadraticCurveTo(0.008, 0.014, 0.0065, 0.014);
  latchShape.lineTo(-0.0065, 0.014);
  latchShape.quadraticCurveTo(-0.008, 0.014, -0.008, 0.011);
  latchShape.lineTo(-0.008, -0.011);
  latchShape.quadraticCurveTo(-0.008, -0.014, -0.0065, -0.014);
  const latchGeo = new THREE.ExtrudeGeometry(latchShape, {
    depth: 0.0055,
    bevelEnabled: true,
    bevelThickness: 0.0018,
    bevelSize: 0.0015,
    bevelSegments: 2,
  });
  latchGeo.rotateX(-Math.PI / 2);
  const latchSlider = new THREE.Mesh(latchGeo, latchRedMat);
  latchSlider.position.set(0, cupR + 0.0028, cupLen - 0.006);
  cupLatchGroup.add(latchSlider);
  cupGroup.add(cupLatchGroup);

  // --- SLEEK SCULPTED TITANIUM MOTOR & LOW-PROFILE HEPA CAP (z = 0.258 to 0.326) ---
  // Compact tapered Dyson-style rear housing so it never blocks the transparent dust cup!
  const motorProfile = [
    new THREE.Vector2(0.056, 0.0),
    new THREE.Vector2(0.054, 0.014),
    new THREE.Vector2(0.047, 0.046),
    new THREE.Vector2(0.042, 0.062),
    new THREE.Vector2(0.037, 0.068),
    new THREE.Vector2(0.031, 0.068),
    new THREE.Vector2(0.03, 0.062), // recessed dark HEPA cap
    new THREE.Vector2(0.0, 0.062),
  ];
  const motorGeo = new THREE.LatheGeometry(motorProfile, 36);
  motorGeo.rotateX(Math.PI / 2);
  const motorBody = new THREE.Mesh(motorGeo, titaniumShellMat);
  motorBody.position.set(0, 0.004, 0.258);
  motorBody.castShadow = true;
  motorBody.receiveShadow = true;
  handheldGroup.add(motorBody);

  // Dark satin anodized rear bezel + clean single recessed HEPA vent ring
  const hepaRecess = new THREE.Mesh(new THREE.CircleGeometry(0.0305, 28), darkRubberMat);
  hepaRecess.position.set(0, 0.004, 0.321);
  handheldGroup.add(hepaRecess);

  const hepaRing = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0018, 8, 28), graphiteBodyMat);
  hepaRing.position.set(0, 0.004, 0.322);
  handheldGroup.add(hepaRing);

  const centerDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.011, 0.0035, 22),
    brushedAlumMat
  );
  centerDisc.rotation.x = Math.PI / 2;
  centerDisc.position.set(0, 0.004, 0.3215);
  handheldGroup.add(centerDisc);

  // Subtle recessed cool-white power LED dot on top of motor barrel
  const powerLedMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0x9bdcff),
    emissiveIntensity: 0.95,
    roughness: 0.2,
  });
  const powerLed = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.002, 12), powerLedMat);
  powerLed.position.set(0, 0.051, 0.28);
  handheldGroup.add(powerLed);

  // --- ERGONOMIC PISTOL GRIP HANDLE, TRIGGER & CONTOURED BEVELED BATTERY HEEL ---
  const gripCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.022, 0.272),
    new THREE.Vector3(0, -0.068, 0.292),
    new THREE.Vector3(0, -0.118, 0.304),
    new THREE.Vector3(0, -0.156, 0.295),
  ]);
  const gripGeo = buildOrganicLoft(
    gripCurve,
    18,
    18,
    (t) => [0.0155 + Math.sin(t * Math.PI) * 0.003, 0.02 + Math.sin(t * Math.PI) * 0.003],
    { capStart: true, capEnd: true, refUp: new THREE.Vector3(1, 0, 0) }
  );
  const gripMesh = new THREE.Mesh(gripGeo, graphiteBodyMat);
  gripMesh.castShadow = true;
  handheldGroup.add(gripMesh);

  // Contoured, beveled ergonomic lithium battery pack (replaces sharp toy BoxGeometry!)
  const battShape = new THREE.Shape();
  const bw = 0.022, bl = 0.044;
  battShape.moveTo(-bw + 0.008, -bl);
  battShape.lineTo(bw - 0.008, -bl);
  battShape.quadraticCurveTo(bw, -bl, bw, -bl + 0.01);
  battShape.lineTo(bw * 0.92, bl - 0.01);
  battShape.quadraticCurveTo(bw * 0.92, bl, bw - 0.01, bl);
  battShape.lineTo(-bw + 0.01, bl);
  battShape.quadraticCurveTo(-bw * 0.92, bl, -bw * 0.92, bl - 0.01);
  battShape.lineTo(-bw, -bl + 0.01);
  battShape.quadraticCurveTo(-bw, -bl, -bw + 0.008, -bl);
  const battGeo = new THREE.ExtrudeGeometry(battShape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.0045,
    bevelSegments: 3,
    curveSegments: 8,
  });
  battGeo.rotateX(Math.PI / 2);
  const batteryHeel = new THREE.Mesh(battGeo, graphiteBodyMat);
  batteryHeel.position.set(0, -0.154, 0.278);
  batteryHeel.rotation.x = 0.14;
  batteryHeel.castShadow = true;
  handheldGroup.add(batteryHeel);

  const triggerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.028, 0.012), latchRedMat);
  triggerMesh.position.set(0, -0.064, 0.265);
  triggerMesh.rotation.x = 0.24;
  handheldGroup.add(triggerMesh);

  // =========================================================================
  // 3. ANATOMICAL FIRST-PERSON RIGHT HAND & DRAPED KNITTED CARDIGAN SLEEVE
  // =========================================================================
  const handGroup = new THREE.Group();
  handGroup.name = 'FirstPersonHand';
  handGroup.position.set(0.004, -0.078, HAND_GRIP_LOCAL_Z + 0.006);
  handheldGroup.add(handGroup);

  // Smooth twist-free anatomical wrist & palm dorsum tucked cleanly INSIDE the ribbed sweater cuff (ZERO wrist bulb poking through sleeve!)
  const palmCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.044, -0.032, 0.088), // slender wrist well inside knitted cuff
    new THREE.Vector3(0.035, -0.016, 0.044), // wrist entry at cuff rim
    new THREE.Vector3(0.026, -0.001, 0.009), // back of hand (dorsum) hugging outside of grip
    new THREE.Vector3(0.018, 0.005, -0.016), // knuckle bridge cleanly outside handle
  ]);
  const palmGeo = buildOrganicLoft(
    palmCurve,
    22,
    24,
    (t) => {
      // Narrower wrist inside cuff (t=0 -> 0.015), fuller anatomical palm (t=0.6 -> 0.025)
      const rx = 0.0155 + Math.sin(Math.pow(t, 0.85) * Math.PI * 0.86) * 0.0115;
      const ry = 0.0135 + Math.sin(Math.pow(t, 0.85) * Math.PI * 0.9) * 0.0065;
      return [rx, ry];
    },
    { capStart: false, capEnd: true, refUp: new THREE.Vector3(0, 1, 0) }
  );
  const palmMesh = new THREE.Mesh(palmGeo, skinMat);
  palmMesh.castShadow = true;
  palmMesh.receiveShadow = true;
  handGroup.add(palmMesh);

  // Soft fleshy thenar eminence bridging wrist/palm smoothly into the opposable thumb
  const thenarCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.03, -0.006, 0.036),
    new THREE.Vector3(0.018, 0.011, 0.021),
    new THREE.Vector3(0.002, 0.023, 0.008),
  ]);
  const thenarGeo = buildOrganicLoft(
    thenarCurve,
    14,
    16,
    (t) => [0.0135 * (1 - t * 0.24), 0.0118 * (1 - t * 0.22)],
    { capStart: true, capEnd: true, refUp: new THREE.Vector3(0, 1, 0) }
  );
  const thenarMesh = new THREE.Mesh(thenarGeo, skinMat);
  thenarMesh.castShadow = false;
  thenarMesh.receiveShadow = true;
  handGroup.add(thenarMesh);

  function addFinger(pts, baseR, tipR, addNail = true) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = buildOrganicLoft(
      curve,
      18,
      14,
      (t) => {
        const taper = baseR * (1 - t) + tipR * t;
        const jointBump =
          Math.exp(-Math.pow((t - 0.36) / 0.12, 2)) * 0.0007 +
          Math.exp(-Math.pow((t - 0.7) / 0.11, 2)) * 0.00045;
        return [taper + jointBump, (taper + jointBump) * 0.88];
      },
      { capStart: true, capEnd: true, refUp: new THREE.Vector3(0, 1, 0) }
    );
    const fMesh = new THREE.Mesh(geo, skinMat);
    fMesh.castShadow = false;
    fMesh.receiveShadow = true;
    handGroup.add(fMesh);

    if (addNail) {
      const tipPt = curve.getPointAt(0.91);
      const tan = curve.getTangentAt(0.91);
      const nail = new THREE.Mesh(new THREE.SphereGeometry(tipR * 0.66, 10, 8), nailMat);
      nail.scale.set(0.76, 0.16, 1.02);
      nail.position.copy(tipPt).add(new THREE.Vector3(0, tipR * 0.52, 0));
      nail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
      handGroup.add(nail);
    }
  }

  // Index finger resting naturally on trigger (zero handle clipping!)
  addFinger(
    [
      new THREE.Vector3(0.02, 0.019, -0.008),
      new THREE.Vector3(0.019, 0.022, -0.03),
      new THREE.Vector3(0.003, 0.018, -0.041),
      new THREE.Vector3(-0.012, 0.013, -0.031),
    ],
    0.0074,
    0.0054
  );
  // Middle finger curled cleanly around front of pistol grip
  addFinger(
    [
      new THREE.Vector3(0.022, 0.002, -0.012),
      new THREE.Vector3(0.021, 0.002, -0.035),
      new THREE.Vector3(0.001, 0.0, -0.044),
      new THREE.Vector3(-0.016, 0.0, -0.03),
    ],
    0.0076,
    0.0056
  );
  // Ring finger
  addFinger(
    [
      new THREE.Vector3(0.023, -0.014, -0.01),
      new THREE.Vector3(0.021, -0.015, -0.033),
      new THREE.Vector3(0.002, -0.015, -0.041),
      new THREE.Vector3(-0.014, -0.015, -0.028),
    ],
    0.007,
    0.0052
  );
  // Pinky finger
  addFinger(
    [
      new THREE.Vector3(0.024, -0.029, -0.005),
      new THREE.Vector3(0.021, -0.03, -0.026),
      new THREE.Vector3(0.004, -0.03, -0.033),
      new THREE.Vector3(-0.01, -0.03, -0.022),
    ],
    0.006,
    0.0045
  );
  // Opposed thumb wrapping smoothly over the top-left of the handle
  addFinger(
    [
      new THREE.Vector3(0.014, 0.014, 0.021),
      new THREE.Vector3(-0.004, 0.028, 0.007),
      new THREE.Vector3(-0.019, 0.027, -0.01),
      new THREE.Vector3(-0.019, 0.019, -0.024),
    ],
    0.009,
    0.0066
  );

  // Continuous full-forearm Draped Knit Cardigan Sleeve with real folded ribbed wrist cuff!
  // Extends naturally BACK & slightly UP-RIGHT toward the player's elbow/shoulder (never clips into floor when crouched!)
  const sleeveCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.037, -0.02, 0.044),   // folded rib cuff cleanly enclosing wrist
    new THREE.Vector3(0.052, -0.026, 0.11),   // lower forearm
    new THREE.Vector3(0.088, -0.032, 0.28),   // mid forearm
    new THREE.Vector3(0.145, -0.036, 0.56),   // upper forearm
    new THREE.Vector3(0.22, -0.032, 0.96),    // elbow toward shoulder
    new THREE.Vector3(0.30, -0.02, 1.48),     // far behind camera near plane in every pose!
  ]);
  const sleeveGeo = buildOrganicLoft(
    sleeveCurve,
    38,
    28,
    (t) => {
      // Plush folded knitted cuff rim gently tucking inward onto wrist -> soft draped cardigan forearm
      const hemTuck = t < 0.018 ? 0.82 + (t / 0.018) * 0.18 : 1.0;
      const cuffBand = Math.exp(-Math.pow((t - 0.038) / 0.03, 2)) * 0.0042;
      const elbowDrape = Math.sin(t * Math.PI * 0.88) * 0.011;
      const rx = (0.029 + cuffBand + elbowDrape + t * 0.044) * hemTuck;
      const ry = (0.0255 + cuffBand + elbowDrape * 0.85 + t * 0.04) * hemTuck;
      return [rx, ry];
    },
    {
      capStart: true,
      capEnd: true,
      refUp: new THREE.Vector3(0, 1, 0),
      rippleFn: (t, theta) => {
        if (t < 0.075) {
          return Math.sin(theta * 20) * 0.028 * (1 - t / 0.075);
        }
        return (
          Math.sin(theta * 3 + t * 9.5) * 0.034 +
          Math.cos(theta * 5 - t * 6.0) * 0.016
        ) * Math.min(1, (t - 0.075) * 5);
      },
    }
  );
  // Add uv1 so the CC0 cotton_jersey AO map shades the knit ribs!
  const sUv = sleeveGeo.getAttribute('uv');
  if (sUv) sleeveGeo.setAttribute('uv1', sUv.clone());

  const sleeveMesh = new THREE.Mesh(sleeveGeo, sleeveMat);
  sleeveMesh.castShadow = true;
  sleeveMesh.receiveShadow = true;
  handGroup.add(sleeveMesh);

  // =========================================================================
  // 4. KINEMATIC RIG & STATE CONTROLLER
  // =========================================================================
  const neckOffsetLocal = new THREE.Vector3(0, 0.038, 0.044);
  const tmpNeckWorld = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  const tmpUp = new THREE.Vector3(0, 1, 0);
  const tmpMat = new THREE.Matrix4();

  const state = {
    headPos: new THREE.Vector3(-0.08, 0.008, -0.04),
    headYaw: 0.1,
    handAnchor: new THREE.Vector3(0.24, 0.65, 0.72),
    isSucking: true,
    cupOpenAngle: 0,
    underSofaAmount: 0,
    rollerAngle: 0,
  };

  function updatePose(
    dt,
    {
      headPos = state.headPos,
      handAnchor = state.handAnchor,
      headYaw = state.headYaw,
      sucking = state.isSucking,
      cupOpen = state.cupOpenAngle,
      tiltOverBin = 0,
      binWorldPos = null,
    } = {}
  ) {
    state.headPos.copy(headPos);
    state.handAnchor.copy(handAnchor);
    state.headYaw = headYaw;
    state.isSucking = sucking;
    state.cupOpenAngle = cupOpen;

    if (sucking) {
      state.rollerAngle -= dt * 28;
      rollerGroup.rotation.x = state.rollerAngle;
    }

    cupFlapPivot.rotation.x = cupOpen * 1.72;
    cupLatchGroup.position.z = -cupOpen * 0.012;

    // Smart adaptive LED: gentle realistic sheen on sunlit floor, strong illuminating beam under dark sofa!
    headLedLight.intensity = sucking ? 0.32 + state.underSofaAmount * 1.85 : 0.1;
    ledStripMat.emissiveIntensity = sucking ? 1.15 + state.underSofaAmount * 0.9 : 0.25;
    powerLedMat.emissiveIntensity = sucking ? 1.1 : 0.25;

    if (tiltOverBin > 0.001 && binWorldPos) {
      floorHeadGroup.visible = tiltOverBin < 0.25;
      headShadow.visible = floorHeadGroup.visible;

      const normalNeck = neckOffsetLocal.clone().applyAxisAngle(tmpUp, headYaw).add(headPos);
      // Position the clear dust-cup mouth directly centered above the open rattan wastebasket mouth!
      const dumpNose = new THREE.Vector3(
        binWorldPos.x + 0.01,
        binWorldPos.y + 0.14,
        binWorldPos.z + 0.01
      );
      wandGroup.position.lerpVectors(normalNeck, dumpNose, tiltOverBin);

      const normalMat = new THREE.Matrix4().lookAt(handAnchor, normalNeck, tmpUp);
      const normalQ = new THREE.Quaternion().setFromRotationMatrix(normalMat);

      // Natural ergonomic downward pouring tilt from right-side standing posture so arm comes cleanly from mid-right!
      const dumpHand = new THREE.Vector3(
        binWorldPos.x + 0.21,
        binWorldPos.y + 0.35,
        binWorldPos.z + 0.30
      );
      const dumpMat = new THREE.Matrix4().lookAt(dumpHand, dumpNose, tmpUp);
      const dumpQ = new THREE.Quaternion().setFromRotationMatrix(dumpMat);
      wandGroup.quaternion.slerpQuaternions(normalQ, dumpQ, tiltOverBin);

      const normalDist = Math.max(0.5, handAnchor.distanceTo(normalNeck));
      const normalHandheldZ = THREE.MathUtils.clamp(normalDist - HAND_GRIP_LOCAL_Z, 0.24, 1.15);
      handheldGroup.position.z = THREE.MathUtils.lerp(normalHandheldZ, 0.02, tiltOverBin);
      wandTube.visible = tiltOverBin < 0.18;
      hoseMesh.visible = tiltOverBin < 0.18;
      lowerCollar.visible = tiltOverBin < 0.18;
      return;
    }

    floorHeadGroup.visible = true;
    headShadow.visible = true;
    wandTube.visible = true;
    hoseMesh.visible = true;
    lowerCollar.visible = true;

    floorHeadGroup.position.copy(headPos);
    floorHeadGroup.rotation.set(0, headYaw, 0);

    tmpNeckWorld.copy(neckOffsetLocal).applyAxisAngle(tmpUp, headYaw).add(headPos);
    wandGroup.position.copy(tmpNeckWorld);

    tmpDir.subVectors(handAnchor, tmpNeckWorld);
    const dist = tmpDir.length();
    // Always keep the handheld + hand anchored directly to the player's first-person hand (no mid-room sleeve detachment!)
    const targetZ = THREE.MathUtils.clamp(dist - HAND_GRIP_LOCAL_Z, 0.22, 1.25);
    handheldGroup.position.z = targetZ;

    const tubeSpan = Math.max(0.08, targetZ - 0.106);
    wandTube.scale.y = tubeSpan / wandBaseLen;
    wandTube.position.z = 0.108 + tubeSpan * 0.5;

    tmpMat.lookAt(handAnchor, tmpNeckWorld, tmpUp);
    wandGroup.quaternion.setFromRotationMatrix(tmpMat);
  }

  function getNozzleWorldPos(out = new THREE.Vector3()) {
    return out.set(0, 0.02, -0.052).applyQuaternion(floorHeadGroup.quaternion).add(floorHeadGroup.position);
  }

  function getCupMouthWorldPos(out = new THREE.Vector3()) {
    cupGroup.updateMatrixWorld(true);
    return out.set(0, 0, 0.015).applyMatrix4(cupGroup.matrixWorld);
  }

  return {
    floorHeadGroup,
    wandGroup,
    handheldGroup,
    cupGroup,
    cupDebrisContainer,
    cupFlapPivot,
    cupLatchGroup,
    headLedLight,
    state,
    updatePose,
    getNozzleWorldPos,
    getCupMouthWorldPos,
  };
}
