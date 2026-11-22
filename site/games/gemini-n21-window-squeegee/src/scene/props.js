import * as THREE from 'three';

function createContactShadowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  g.addColorStop(0, 'rgba(18, 11, 5, 0.62)');
  g.addColorStop(0.55, 'rgba(18, 11, 5, 0.24)');
  g.addColorStop(1, 'rgba(18, 11, 5, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/**
 * Clean ZERO-TEXT frosted water-droplet label mapped to the Poly Haven bottle sticker UV region.
 * (In multi_cleaner_bottle_diff_1k.jpg, the front sticker occupies roughly u: 0.00..0.30, v: 0.56..1.00 from top!)
 */
function createWordlessBottleLabelTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Clean frosted pale-blue wrap covering whole sticker UV island
  const bg = ctx.createLinearGradient(0, 0, 0, 512);
  bg.addColorStop(0, '#f4fafd');
  bg.addColorStop(0.6, '#e2f2fa');
  bg.addColorStop(1, '#cbe7f6');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 512);

  // Soft sky-blue clean wave band across entire sticker UV island (zero text!)
  ctx.fillStyle = '#4ba7d4';
  ctx.fillRect(0, 446, 512, 66);
  ctx.fillStyle = '#89cfe9';
  ctx.fillRect(0, 434, 512, 10);

  const drawEmblem = (cx, cy, s) => {
    ctx.fillStyle = '#3b9cc9';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 38 * s);
    ctx.bezierCurveTo(cx + 20 * s, cy - 8 * s, cx + 25 * s, cy + 12 * s, cx + 25 * s, cy + 20 * s);
    ctx.arc(cx, cy + 20 * s, 25 * s, 0, Math.PI, false);
    ctx.bezierCurveTo(cx - 25 * s, cy + 12 * s, cx - 20 * s, cy - 8 * s, cx, cy - 38 * s);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(cx - 8 * s, cy + 14 * s, 5 * s, 11 * s, -0.3, 0, Math.PI * 2);
    ctx.fill();

    for (const [ox, oy, br] of [[30, -14, 8], [40, 6, 5], [-28, -8, 6]]) {
      ctx.strokeStyle = 'rgba(59, 156, 201, 0.78)';
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      ctx.arc(cx + ox * s, cy + oy * s, br * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.beginPath();
      ctx.arc(cx + (ox - br * 0.3) * s, cy + (oy - br * 0.3) * s, br * 0.28 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  drawEmblem(76, 378, 0.92);
  drawEmblem(202, 378, 0.85);
  drawEmblem(340, 378, 0.85);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds all real interactive props on the wooden oak sill and window frame:
 * 1. Foaming Glass Cleaner Trigger Spray Bottle (Poly Haven ribbed bottle body + realistic trigger sprayer head!)
 * 2. Professional Window Squeegee (stainless channel, brass clips, EPDM rubber blade, ergonomic oak+rubber handle)
 * 3. Potted Houseplant (Poly Haven potted_plant_04)
 * 4. Warm Steaming Stoneware Teacup on Saucer (tap to puff steam & re-mist glass!)
 * 5. Hanging Faceted Crystal Suncatcher (casts dancing prism rainbows!)
 */
export function buildProps(scene, room, { gltfLoader }) {
  const propsRoot = new THREE.Group();
  propsRoot.name = 'interactive_props';
  scene.add(propsRoot);

  const sillY = room.SILL_Y;
  const shadowTex = createContactShadowTexture();
  const makeContactShadow = (sx, sz, opacity = 0.76) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(sx, sz),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity })
    );
    m.rotation.x = -Math.PI * 0.5;
    m.position.y = 0.0012;
    return m;
  };

  // =========================================================
  // 1. REAL FOAMING GLASS CLEANER TRIGGER SPRAY BOTTLE
  // =========================================================
  // Positioned cleanly in left-center of oak sill (100% visible in BOTH 390x844 portrait & 1024x768 landscape!)
  const sprayRestPos = new THREE.Vector3(-0.17, sillY, 0.225);
  // Angled slightly right-profile so the recognizable trigger & nozzle silhouette pops immediately!
  const sprayRestRot = new THREE.Euler(0, -1.12, 0);

  const sprayGroup = new THREE.Group();
  sprayGroup.name = 'prop_spray_bottle';
  sprayGroup.position.copy(sprayRestPos);
  sprayGroup.rotation.copy(sprayRestRot);
  propsRoot.add(sprayGroup);

  const sprayShadow = makeContactShadow(0.145, 0.145, 0.80);
  sprayShadow.position.set(sprayRestPos.x, sillY + 0.0012, sprayRestPos.z);
  propsRoot.add(sprayShadow);

  const sprayHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.30, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  sprayHit.position.set(0, 0.15, 0);
  sprayHit.userData.propId = 'spray';
  sprayGroup.add(sprayHit);

  const bottleModelHolder = new THREE.Group();
  sprayGroup.add(bottleModelHolder);

  const cleanLabelTex = createWordlessBottleLabelTexture();

  // Real Poly Haven scanned bottle body (6.7k tris, ribbed HDPE + PBR maps)
  gltfLoader.load('./assets/models/multi_cleaner_bottle/multi_cleaner_bottle_1k.gltf', (gltf) => {
    const model = gltf.scene;
    model.scale.setScalar(0.95);
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.userData.propId = 'spray';

      if (child.name.toLowerCase().includes('sticker')) {
        child.material = new THREE.MeshStandardMaterial({
          map: cleanLabelTex,
          roughness: 0.44,
          metalness: 0.0,
          normalMap: child.material.normalMap || null,
          normalScale: new THREE.Vector2(0.14, 0.14),
        });
      } else if (child.material) {
        // Subtle clean translucent-frosted sky-tinted HDPE cleaner bottle
        child.material.color = new THREE.Color(0xdcf0f8);
        child.material.roughness = 0.32;
        child.material.envMapIntensity = 1.05;
      }
    });
    bottleModelHolder.add(model);
  });

  // --- Realistic Multi-Part Trigger Sprayer Head mounted directly onto bottle neck (y = 0.205m) ---
  // Local convention: nozzle points along -Z (forward toward the window when held!)
  const sprayerWhiteMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xf6f7f8),
    roughness: 0.28,
    metalness: 0.0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
  });
  const sprayerBlueMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x2e94c8),
    roughness: 0.32,
    metalness: 0.0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.24,
  });

  const sprayerHead = new THREE.Group();
  sprayerHead.position.set(0, 0.202, 0);
  sprayGroup.add(sprayerHead);

  // Threaded ribbed collar covering the screw cap seamlessly
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.0195, 0.021, 0.026, 20), sprayerBlueMat);
  collar.position.y = 0.011;
  collar.castShadow = true;
  sprayerHead.add(collar);

  // Vertical neck stem rising into contoured sprayer shroud
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.028, 16), sprayerWhiteMat);
  stem.position.y = 0.032;
  stem.castShadow = true;
  sprayerHead.add(stem);

  // Contoured ergonomic trigger sprayer head shroud (extruded realistic side profile)
  const shroudShape = new THREE.Shape();
  shroudShape.moveTo(-0.024, 0.036);
  shroudShape.quadraticCurveTo(-0.032, 0.064, -0.012, 0.074);
  shroudShape.lineTo(0.044, 0.072);
  shroudShape.quadraticCurveTo(0.056, 0.070, 0.058, 0.056);
  shroudShape.lineTo(0.056, 0.044);
  shroudShape.lineTo(0.018, 0.042);
  shroudShape.quadraticCurveTo(0.005, 0.032, -0.024, 0.036);
  shroudShape.closePath();

  const shroudGeo = new THREE.ExtrudeGeometry(shroudShape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 4,
  });
  // Orient extrusion profile so +X of shape points along -Z (forward nozzle)
  shroudGeo.translate(0, 0, -0.012);
  shroudGeo.rotateY(Math.PI * 0.5);
  const shroudMesh = new THREE.Mesh(shroudGeo, sprayerWhiteMat);
  shroudMesh.castShadow = true;
  shroudMesh.receiveShadow = true;
  sprayerHead.add(shroudMesh);

  // Rotating square foam-sprayer nozzle cap at the front tip (-Z)
  const nozzleCap = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.019, 0.016), sprayerBlueMat);
  nozzleCap.position.set(0, 0.056, -0.062);
  nozzleCap.castShadow = true;
  sprayerHead.add(nozzleCap);

  // Flip-up foaming screen gate & tiny orifice on front of nozzle
  const orifice = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0032, 0.0032, 0.004, 10),
    room.materials.darkAnodizedMat
  );
  orifice.rotation.x = Math.PI * 0.5;
  orifice.position.set(0, 0.056, -0.071);
  sprayerHead.add(orifice);

  // Hinged ergonomic squeeze trigger lever (animates realistically on every spray burst!)
  const triggerPivot = new THREE.Group();
  triggerPivot.position.set(0, 0.048, -0.020);
  sprayerHead.add(triggerPivot);

  const trigShape = new THREE.Shape();
  trigShape.moveTo(0, 0);
  trigShape.lineTo(0.026, -0.004);
  trigShape.quadraticCurveTo(0.035, -0.024, 0.030, -0.048);
  trigShape.lineTo(0.020, -0.048);
  trigShape.quadraticCurveTo(0.024, -0.026, 0.012, -0.010);
  trigShape.lineTo(0, -0.009);
  trigShape.closePath();
  const trigGeo = new THREE.ExtrudeGeometry(trigShape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 3,
  });
  trigGeo.translate(0, 0, -0.006);
  trigGeo.rotateY(Math.PI * 0.5);
  const triggerMesh = new THREE.Mesh(trigGeo, sprayerBlueMat);
  triggerMesh.castShadow = true;
  triggerPivot.add(triggerMesh);

  sprayerHead.traverse((c) => {
    if (c.isMesh) c.userData.propId = 'spray';
  });

  // Exact nozzle tip marker for 3D mist spray cone origin
  const nozzleTip = new THREE.Object3D();
  nozzleTip.position.set(0, 0.056, -0.074);
  sprayerHead.add(nozzleTip);

  // =========================================================
  // 2. REAL PROFESSIONAL WINDOW SQUEEGEE (Custom High-Detail PBR)
  // =========================================================
  const squeegeeRestPos = new THREE.Vector3(0.155, sillY + 0.017, 0.245);
  const squeegeeRestRot = new THREE.Euler(0, -0.52, 0);

  const squeegeeGroup = new THREE.Group();
  squeegeeGroup.name = 'prop_squeegee';
  squeegeeGroup.position.copy(squeegeeRestPos);
  squeegeeGroup.rotation.copy(squeegeeRestRot);
  propsRoot.add(squeegeeGroup);

  const squeegeeShadow = makeContactShadow(0.32, 0.18, 0.74);
  squeegeeShadow.position.set(squeegeeRestPos.x, sillY + 0.0012, squeegeeRestPos.z);
  squeegeeShadow.rotation.z = -0.52;
  propsRoot.add(squeegeeShadow);

  const squeegeeVisual = new THREE.Group();
  squeegeeGroup.add(squeegeeVisual);

  const steelMat = room.materials.aluminumSashMat.clone();
  steelMat.color.set(0xdde1e6);
  steelMat.roughness = 0.22;
  steelMat.metalness = 0.94;

  const brassMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xcba35a),
    roughness: 0.26,
    metalness: 0.92,
  });

  const gripRubberMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x202429),
    roughness: 0.78,
    metalness: 0.05,
  });

  const bladeRubberMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x141618),
    roughness: 0.52,
    metalness: 0.04,
  });

  const handleWoodMat = room.materials.oakSillMat.clone();
  handleWoodMat.color.set(0xd6aa76);
  handleWoodMat.roughness = 0.40;

  const BLADE_W = 0.27;

  const channel = new THREE.Mesh(new THREE.BoxGeometry(BLADE_W, 0.011, 0.022), steelMat);
  channel.position.set(0, 0, -0.055);
  channel.castShadow = true;
  channel.receiveShadow = true;
  squeegeeVisual.add(channel);

  for (const sx of [-1, 1]) {
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.013, 0.024), brassMat);
    clip.position.set(sx * (BLADE_W * 0.5 - 0.010), 0, -0.055);
    clip.castShadow = true;
    squeegeeVisual.add(clip);
  }

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, -0.0042);
  bladeShape.lineTo(-0.026, -0.0012);
  bladeShape.lineTo(-0.027, 0.0);
  bladeShape.lineTo(-0.026, 0.0012);
  bladeShape.lineTo(0, 0.0042);
  bladeShape.closePath();

  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: BLADE_W + 0.008, bevelEnabled: false });
  bladeGeo.translate(0, 0, -(BLADE_W + 0.008) * 0.5);
  bladeGeo.rotateY(-Math.PI * 0.5);
  const rubberBlade = new THREE.Mesh(bladeGeo, bladeRubberMat);
  rubberBlade.position.set(0, 0, -0.064);
  rubberBlade.castShadow = true;
  rubberBlade.receiveShadow = true;
  squeegeeVisual.add(rubberBlade);

  const clampPlate = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.017, 0.032), steelMat);
  clampPlate.position.set(0, 0.002, -0.044);
  clampPlate.castShadow = true;
  squeegeeVisual.add(clampPlate);

  const rivetGeo = new THREE.CylinderGeometry(0.0038, 0.0038, 0.021, 10);
  for (const rx of [-0.018, 0.018]) {
    const rivet = new THREE.Mesh(rivetGeo, brassMat);
    rivet.position.set(rx, 0.002, -0.044);
    squeegeeVisual.add(rivet);
  }

  const neckMesh = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.013, 0.056), steelMat);
  neckMesh.position.set(0, 0.005, -0.010);
  neckMesh.rotation.x = -0.14;
  neckMesh.castShadow = true;
  squeegeeVisual.add(neckMesh);

  const handlePts = [
    new THREE.Vector2(0.008, 0.0),
    new THREE.Vector2(0.014, 0.014),
    new THREE.Vector2(0.016, 0.045),
    new THREE.Vector2(0.0145, 0.095),
    new THREE.Vector2(0.0175, 0.138),
    new THREE.Vector2(0.0155, 0.158),
    new THREE.Vector2(0.009, 0.168),
    new THREE.Vector2(0.0001, 0.172),
  ];
  const handleGeo = new THREE.LatheGeometry(handlePts, 18);
  handleGeo.rotateX(Math.PI * 0.5);
  const handleMesh = new THREE.Mesh(handleGeo, handleWoodMat);
  handleMesh.position.set(0, 0.009, 0.012);
  handleMesh.rotation.x = -0.08;
  handleMesh.castShadow = true;
  handleMesh.receiveShadow = true;
  squeegeeVisual.add(handleMesh);

  const gripCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0155, 0.058, 18), gripRubberMat);
  gripCollar.rotation.x = Math.PI * 0.5 - 0.08;
  gripCollar.position.set(0, 0.004, 0.062);
  gripCollar.castShadow = true;
  squeegeeVisual.add(gripCollar);

  const plowFoamMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xf9fdff),
    roughness: 0.20,
    metalness: 0.0,
    transmission: 0.15,
    clearcoat: 0.85,
    clearcoatRoughness: 0.10,
    transparent: true,
    opacity: 0.0,
  });
  const plowBead = new THREE.Mesh(new THREE.CapsuleGeometry(0.0065, BLADE_W * 0.86, 6, 12), plowFoamMat);
  plowBead.rotation.z = Math.PI * 0.5;
  plowBead.position.set(0, 0.006, -0.089);
  squeegeeVisual.add(plowBead);

  squeegeeVisual.traverse((c) => {
    if (c.isMesh) c.userData.propId = 'squeegee';
  });
  const squeegeeHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.09, 0.28),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  squeegeeHit.position.set(0, 0.018, 0.02);
  squeegeeHit.userData.propId = 'squeegee';
  squeegeeGroup.add(squeegeeHit);

  // =========================================================
  // 3. REAL POTTED HOUSEPLANT ON FAR LEFT SILL (Poly Haven CC0)
  // =========================================================
  const plantGroup = new THREE.Group();
  plantGroup.name = 'prop_potted_plant';
  plantGroup.position.set(-0.56, sillY, 0.19);
  propsRoot.add(plantGroup);

  const plantShadow = makeContactShadow(0.20, 0.20, 0.74);
  plantShadow.position.set(-0.56, sillY + 0.0012, 0.19);
  propsRoot.add(plantShadow);

  const plantHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.075, 0.22, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  plantHit.position.y = 0.11;
  plantHit.userData.propId = 'plant';
  plantGroup.add(plantHit);

  gltfLoader.load('./assets/models/potted_plant_04/potted_plant_04_1k.gltf', (gltf) => {
    const model = gltf.scene;
    model.scale.setScalar(1.05);
    model.traverse((child) => {
      if (child.isMesh) {
        if (child.name.toLowerCase().includes('ground')) {
          child.visible = false;
          return;
        }
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData.propId = 'plant';
      }
    });
    plantGroup.add(model);
  });

  // =========================================================
  // 4. WARM STEAMING STONEWARE TEACUP ON SAUCER (Far Right Sill)
  // =========================================================
  const cupGroup = new THREE.Group();
  cupGroup.name = 'prop_steaming_cup';
  cupGroup.position.set(0.55, sillY, 0.20);
  propsRoot.add(cupGroup);

  const cupShadow = makeContactShadow(0.18, 0.18, 0.74);
  cupShadow.position.set(0.55, sillY + 0.0012, 0.20);
  propsRoot.add(cupShadow);

  const ceramicMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xefe6d8),
    roughness: 0.24,
    metalness: 0.0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.14,
  });
  const ceramicRimMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xb88b63),
    roughness: 0.58,
    metalness: 0.0,
  });

  const saucerPts = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.044, 0.0),
    new THREE.Vector2(0.056, 0.005),
    new THREE.Vector2(0.072, 0.015),
    new THREE.Vector2(0.074, 0.018),
    new THREE.Vector2(0.069, 0.018),
    new THREE.Vector2(0.050, 0.008),
    new THREE.Vector2(0.001, 0.007),
  ];
  const saucer = new THREE.Mesh(new THREE.LatheGeometry(saucerPts, 26), ceramicMat);
  saucer.castShadow = true;
  saucer.receiveShadow = true;
  cupGroup.add(saucer);

  const cupPts = [
    new THREE.Vector2(0.001, 0.007),
    new THREE.Vector2(0.032, 0.007),
    new THREE.Vector2(0.041, 0.025),
    new THREE.Vector2(0.045, 0.068),
    new THREE.Vector2(0.046, 0.082),
    new THREE.Vector2(0.042, 0.083),
    new THREE.Vector2(0.040, 0.068),
    new THREE.Vector2(0.035, 0.022),
    new THREE.Vector2(0.001, 0.016),
  ];
  const cupBody = new THREE.Mesh(new THREE.LatheGeometry(cupPts, 26), ceramicMat);
  cupBody.castShadow = true;
  cupBody.receiveShadow = true;
  cupGroup.add(cupBody);

  const lipRing = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.0022, 8, 24), ceramicRimMat);
  lipRing.rotation.x = Math.PI * 0.5;
  lipRing.position.y = 0.0825;
  cupGroup.add(lipRing);

  const cupHandle = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0046, 10, 16, Math.PI * 1.15), ceramicMat);
  cupHandle.position.set(0.045, 0.048, 0);
  cupHandle.rotation.z = -Math.PI * 0.56;
  cupHandle.castShadow = true;
  cupGroup.add(cupHandle);

  const teaSurface = new THREE.Mesh(
    new THREE.CircleGeometry(0.040, 22),
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x7c3e18),
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
    })
  );
  teaSurface.rotation.x = -Math.PI * 0.5;
  teaSurface.position.y = 0.071;
  cupGroup.add(teaSurface);

  // Rising steam wisps
  const steamCanvas = document.createElement('canvas');
  steamCanvas.width = 64;
  steamCanvas.height = 64;
  const sctx = steamCanvas.getContext('2d');
  const sg = sctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  sg.addColorStop(0, 'rgba(255,255,255,0.44)');
  sg.addColorStop(0.5, 'rgba(255,255,255,0.16)');
  sg.addColorStop(1, 'rgba(255,255,255,0.0)');
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 64, 64);
  const steamTex = new THREE.CanvasTexture(steamCanvas);

  const steamPuffs = [];
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: steamTex, transparent: true, opacity: 0.0, depthWrite: false })
    );
    sp.position.set(0, 0.09, 0);
    sp.userData = { phase: i / 6, driftX: (Math.random() - 0.5) * 0.03, driftZ: -0.015 - Math.random() * 0.02 };
    cupGroup.add(sp);
    steamPuffs.push(sp);
  }

  cupGroup.traverse((c) => {
    if (c.isMesh) c.userData.propId = 'cup';
  });
  const cupHit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.16, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  cupHit.position.y = 0.07;
  cupHit.userData.propId = 'cup';
  cupGroup.add(cupHit);

  // =========================================================
  // 5. HANGING FACETED CRYSTAL SUNCATCHER (Upper Left of Window)
  // =========================================================
  const prismPivot = new THREE.Group();
  prismPivot.name = 'prop_crystal_prism';
  prismPivot.position.set(-0.46, room.PANE_CY + room.PANE_H * 0.5 + 0.02, 0.085);
  propsRoot.add(prismPivot);

  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0007, 0.0007, 0.24, 6),
    new THREE.MeshStandardMaterial({ color: 0xe6e2d8, roughness: 0.4, transparent: true, opacity: 0.72 })
  );
  cord.position.y = -0.12;
  prismPivot.add(cord);

  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0012, 8, 14), brassMat);
  bail.position.y = -0.242;
  prismPivot.add(bail);

  const crystalGeo = new THREE.OctahedronGeometry(0.027, 0);
  crystalGeo.scale(0.82, 1.38, 0.82);
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xf6fbff),
    roughness: 0.04,
    metalness: 0.08,
    transmission: 0.78,
    ior: 1.85,
    thickness: 0.06,
    iridescence: 1.0,
    iridescenceIOR: 1.45,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 2.6,
  });
  const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
  crystalMesh.position.y = -0.278;
  crystalMesh.userData.propId = 'prism';
  prismPivot.add(crystalMesh);
  // Crisp delicate prism facet edges catching sunlight glint
  const facetLines = new THREE.LineSegments(
    new THREE.EdgesGeometry(crystalGeo),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
  );
  crystalMesh.add(facetLines);

  const beadMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.008, 0), crystalMat);
  beadMesh.position.y = -0.22;
  prismPivot.add(beadMesh);

  const prismHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 10, 10),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  prismHit.position.y = -0.278;
  prismHit.userData.propId = 'prism';
  prismPivot.add(prismHit);

  const state = {
    plantBounceVel: 0,
    plantAngle: 0,
    prismVel: 0,
    prismAngle: 0,
    prismSpin: 0,
    steamBurstTimer: 0,
  };

  return {
    root: propsRoot,
    sprayGroup,
    sprayShadow,
    sprayRestPos,
    sprayRestRot,
    nozzleTip,
    triggerPivot,
    bottleModelHolder,
    squeegeeGroup,
    squeegeeVisual,
    squeegeeShadow,
    squeegeeRestPos,
    squeegeeRestRot,
    plowBead,
    plowFoamMat,
    plantGroup,
    cupGroup,
    prismPivot,
    crystalMesh,
    state,

    triggerPlantRustle(strength = 1.0) {
      state.plantBounceVel += (Math.random() > 0.5 ? 1 : -1) * 0.45 * strength;
    },

    triggerPrismSwing(impulse = 1.0) {
      state.prismVel += (Math.random() > 0.5 ? 1 : -1) * 1.9 * impulse;
      state.prismSpin += 3.2 * impulse;
    },

    triggerSteamBurst() {
      state.steamBurstTimer = 2.6;
    },

    update(dt, elapsed) {
      const kPlant = 24.0, dPlant = 4.2;
      state.plantBounceVel += (-kPlant * state.plantAngle - dPlant * state.plantBounceVel) * dt;
      state.plantAngle += state.plantBounceVel * dt;
      plantGroup.rotation.z = state.plantAngle;
      plantGroup.rotation.x = state.plantAngle * 0.4;

      const kPrism = 9.5, dPrism = 0.72;
      state.prismVel += (-kPrism * state.prismAngle - dPrism * state.prismVel) * dt;
      state.prismAngle += state.prismVel * dt;
      prismPivot.rotation.z = state.prismAngle + Math.sin(elapsed * 0.85) * 0.014;
      state.prismSpin *= Math.exp(-dt * 1.4);
      crystalMesh.rotation.y += (0.28 + state.prismSpin) * dt;

      if (state.steamBurstTimer > 0) {
        state.steamBurstTimer = Math.max(0, state.steamBurstTimer - dt);
      }
      const burstBoost = state.steamBurstTimer > 0 ? 1.0 : 0.0;
      for (let i = 0; i < steamPuffs.length; i++) {
        const sp = steamPuffs[i];
        const ud = sp.userData;
        ud.phase = (ud.phase + dt * (0.24 + burstBoost * 0.42)) % 1.0;
        const p = ud.phase;
        sp.position.set(
          ud.driftX * p + Math.sin(elapsed * 2.2 + i * 1.3) * 0.016 * p - burstBoost * p * 0.24,
          0.085 + p * (0.20 + burstBoost * 0.40),
          ud.driftZ * p - burstBoost * p * 0.16
        );
        const sc = (0.042 + p * 0.105) * (1 + burstBoost * 1.5);
        sp.scale.set(sc, sc, 1);
        sp.material.opacity = Math.sin(p * Math.PI) * (0.22 + burstBoost * 0.40);
      }
    },
  };
}
