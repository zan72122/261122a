import * as THREE from 'three';
import {
  INK_COLOR,
  createToonMesh,
  createToonMaterial,
  createWoodTableTexture,
  createCounterTileTexture,
  createPlacematTexture,
  createWallTexture,
  createSunsetWindowTexture,
  addOutline,
} from './toon.js';

export const SEAT_CONFIGS = [
  {
    id: 0,
    role: 'mama',
    name: 'mama',
    accentHex: '#ff6b7a',
    accentColor: 0xff6b7a,
    lightHex: '#fff0f2',
    motif: 'flower',
    matPos: new THREE.Vector3(-1.82, 0.012, -0.22),
    matRotY: 0.16,
    standPos: new THREE.Vector3(-2.12, 0, -1.48),
    sitPos: new THREE.Vector3(-1.95, 0, -1.04),
    chairBackZ: -1.32,
    chairSitZ: -1.06,
    chairX: -1.96,
    faceYaw: 0.18,
  },
  {
    id: 1,
    role: 'papa',
    name: 'papa',
    accentHex: '#3f72d8',
    accentColor: 0x3f72d8,
    lightHex: '#eef4ff',
    motif: 'wave',
    matPos: new THREE.Vector3(0.0, 0.012, -0.52),
    matRotY: 0,
    standPos: new THREE.Vector3(0.0, 0, -1.86),
    sitPos: new THREE.Vector3(0.0, 0, -1.36),
    chairBackZ: -1.66,
    chairSitZ: -1.38,
    chairX: 0.0,
    faceYaw: 0,
  },
  {
    id: 2,
    role: 'kid',
    name: 'kid',
    accentHex: '#f5a623',
    accentColor: 0xf5a623,
    lightHex: '#fff9e6',
    motif: 'star',
    matPos: new THREE.Vector3(1.82, 0.012, -0.22),
    matRotY: -0.16,
    standPos: new THREE.Vector3(2.12, 0, -1.48),
    sitPos: new THREE.Vector3(1.95, 0, -1.04),
    chairBackZ: -1.32,
    chairSitZ: -1.06,
    chairX: 1.96,
    faceYaw: -0.18,
  },
];

export function buildEnvironment(scene) {
  const envGroup = new THREE.Group();
  scene.add(envGroup);

  // ---------- 1. Cozy Cel-Anime Dining Room Backdrop ----------
  const wallTex = createWallTexture();
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 15),
    createToonMaterial(0xffffff, { map: wallTex, steps: 2 })
  );
  backWall.position.set(0, 4.2, -3.55);
  backWall.receiveShadow = true;
  envGroup.add(backWall);

  // Warm wooden floor below table
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 18),
    createToonMaterial(0xc98c57, { steps: 2 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -1.85, 1.2);
  floor.receiveShadow = true;
  envGroup.add(floor);

  // ---------- 2. Evening Sunset Window (left-back) ----------
  const winGroup = new THREE.Group();
  winGroup.position.set(-2.15, 1.92, -3.48);
  envGroup.add(winGroup);

  const skyTex = createSunsetWindowTexture();
  const skyPane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 2.2),
    new THREE.MeshBasicMaterial({ map: skyTex })
  );
  winGroup.add(skyPane);

  // Thick comic window frame + mullions
  const frameMat = createToonMaterial(0xfff5e4);
  const frameParts = [
    [3.42, 0.16, 0.14, 0, 1.12, 0.04],
    [3.42, 0.18, 0.18, 0, -1.12, 0.06],
    [0.16, 2.36, 0.14, -1.65, 0, 0.04],
    [0.16, 2.36, 0.14, 1.65, 0, 0.04],
    [0.1, 2.2, 0.1, 0, 0, 0.05],
    [3.2, 0.09, 0.1, 0, -0.08, 0.05],
  ];
  for (const [w, h, d, x, y, z] of frameParts) {
    const m = createToonMesh(new THREE.BoxGeometry(w, h, d), 0xfff5e4, {
      material: frameMat,
      outline: 0.028,
      castShadow: false,
    });
    m.position.set(x, y, z);
    winGroup.add(m);
  }

  // Cheerful coral anime curtains tied on sides of window
  const curtainMat = createToonMaterial(0xff8c69);
  for (const dir of [-1, 1]) {
    const cMesh = createToonMesh(new THREE.CylinderGeometry(0.18, 0.34, 2.35, 10), 0xff8c69, {
      material: curtainMat,
      outline: 0.028,
      castShadow: false,
    });
    cMesh.position.set(dir * 1.56, -0.02, 0.16);
    cMesh.rotation.z = dir * -0.08;
    winGroup.add(cMesh);
  }

  // Slanted golden sunset light shaft (subtle translucent graphic beam!)
  const sunBeam = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 5.4),
    new THREE.MeshBasicMaterial({
      color: 0xffd26a,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  sunBeam.position.set(-1.1, 1.3, -1.9);
  sunBeam.rotation.set(-0.35, 0.3, -0.35);
  envGroup.add(sunBeam);

  // ---------- 3. Cozy Wall Shelf + Graphic Picture Frame (right-back, zero text!) ----------
  const artGroup = new THREE.Group();
  artGroup.position.set(2.3, 1.98, -3.46);
  envGroup.add(artGroup);

  const artFrame = createToonMesh(new THREE.BoxGeometry(1.55, 1.2, 0.1), 0x9c5a32, {
    outline: 0.028,
    castShadow: false,
  });
  artGroup.add(artFrame);

  const artCanvas = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.96),
    new THREE.MeshBasicMaterial({ color: 0xfff7dc })
  );
  artCanvas.position.z = 0.056;
  artGroup.add(artCanvas);

  // Graphic sun & hills painting (purely visual, zero text)
  const artSun = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 16),
    new THREE.MeshBasicMaterial({ color: 0xff7043 })
  );
  artSun.position.set(0.28, 0.16, 0.062);
  artGroup.add(artSun);

  const artHill = new THREE.Mesh(
    new THREE.CircleGeometry(0.56, 16, 0, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x56b870 })
  );
  artHill.position.set(-0.18, -0.46, 0.062);
  artGroup.add(artHill);

  // Small potted plant on a right wall shelf
  const shelf = createToonMesh(new THREE.BoxGeometry(1.4, 0.1, 0.35), 0xb8703c, {
    outline: 0.024,
    castShadow: false,
  });
  shelf.position.set(2.3, 1.12, -3.32);
  envGroup.add(shelf);

  const plantPot = createToonMesh(new THREE.CylinderGeometry(0.16, 0.12, 0.22, 10), 0xd96645, {
    outline: 0.02,
    castShadow: false,
  });
  plantPot.position.set(2.65, 1.28, -3.28);
  envGroup.add(plantPot);

  for (let i = 0; i < 4; i++) {
    const leaf = createToonMesh(new THREE.SphereGeometry(0.12, 8, 8), 0x45b864, {
      outline: 0.018,
      castShadow: false,
    });
    const a = (i / 4) * Math.PI * 2 + 0.4;
    leaf.scale.set(1.2, 0.6, 0.8);
    leaf.position.set(2.65 + Math.cos(a) * 0.11, 1.44 + (i % 2) * 0.06, -3.28 + Math.sin(a) * 0.08);
    envGroup.add(leaf);
  }

  // ---------- 4. Hanging Warm Pendant Lamp (top center) ----------
  const lampGroup = new THREE.Group();
  lampGroup.position.set(0, 3.15, -0.7);
  envGroup.add(lampGroup);

  const cord = createToonMesh(new THREE.CylinderGeometry(0.025, 0.025, 6.0, 8), 0x2b2236, {
    outline: 0.01,
    castShadow: false,
  });
  cord.position.y = 3.0;
  lampGroup.add(cord);

  const shade = createToonMesh(
    new THREE.ConeGeometry(0.68, 0.45, 18, 1, false),
    0xffca4b,
    { outline: 0.03, castShadow: false }
  );
  shade.position.y = 0.0;
  lampGroup.add(shade);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff8cc })
  );
  bulb.position.y = -0.18;
  lampGroup.add(bulb);

  // ---------- 5. Main Wooden Dining Table ----------
  const tableTex = createWoodTableTexture();
  const tableTop = createToonMesh(
    new THREE.BoxGeometry(6.3, 0.22, 2.75),
    0xffffff,
    {
      map: tableTex,
      outline: 0.036,
      castShadow: false,
      receiveShadow: true,
    }
  );
  tableTop.position.set(0, -0.11, -0.05);
  envGroup.add(tableTop);

  // Chunky wooden table legs
  const legGeo = new THREE.CylinderGeometry(0.13, 0.1, 1.75, 10);
  const legPositions = [
    [-2.75, -1.0, -1.1],
    [2.75, -1.0, -1.1],
    [-2.75, -1.0, 0.98],
    [2.75, -1.0, 0.98],
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = createToonMesh(legGeo, 0xb87038, { outline: 0.028, castShadow: false });
    leg.position.set(lx, ly, lz);
    envGroup.add(leg);
  }

  // ---------- 6. Front Kitchen Serving Counter Strip (reachable bottom shelf!) ----------
  const tileTex = createCounterTileTexture();
  const counterTop = createToonMesh(
    new THREE.BoxGeometry(6.4, 0.26, 1.48),
    0xffffff,
    {
      map: tileTex,
      outline: 0.036,
      castShadow: false,
      receiveShadow: true,
    }
  );
  counterTop.position.set(0, -0.11, 2.08);
  envGroup.add(counterTop);

  // Subtle dark wood divider molding between counter and dining table
  const divider = createToonMesh(new THREE.BoxGeometry(6.42, 0.06, 0.1), 0x6e4024, {
    outline: 0.018,
    castShadow: false,
  });
  divider.position.set(0, 0.01, 1.33);
  envGroup.add(divider);

  // Woven pot trivet (center of serving counter)
  const trivet = createToonMesh(new THREE.CylinderGeometry(0.68, 0.72, 0.045, 22), 0xd99148, {
    outline: 0.022,
    castShadow: false,
    receiveShadow: true,
  });
  trivet.position.set(0, 0.032, 1.94);
  envGroup.add(trivet);

  // Small wooden tray under chopsticks & cups
  const chopTray = createToonMesh(new THREE.BoxGeometry(0.88, 0.035, 0.56), 0xc77d42, {
    outline: 0.018,
    castShadow: false,
    receiveShadow: true,
  });
  chopTray.position.set(-1.18, 0.028, 2.06);
  envGroup.add(chopTray);

  // Cute ceramic ladle rest dish beside the pot (zero clipping with closed lid or cups!)
  const ladleRest = createToonMesh(new THREE.CylinderGeometry(0.22, 0.18, 0.04, 16), 0xfff5e0, {
    outline: 0.016,
    castShadow: false,
    receiveShadow: true,
  });
  ladleRest.position.set(0.46, 0.03, 2.52);
  envGroup.add(ladleRest);

  const cupTray = createToonMesh(new THREE.BoxGeometry(1.06, 0.035, 0.62), 0xc77d42, {
    outline: 0.018,
    castShadow: false,
    receiveShadow: true,
  });
  cupTray.position.set(1.26, 0.028, 1.98);
  envGroup.add(cupTray);

  // ---------- 7. Three Family Placemats + Physical Spots (Chopstick Rest & Coaster) ----------
  const seats = [];
  for (const cfg of SEAT_CONFIGS) {
    const seatGroup = new THREE.Group();
    seatGroup.position.copy(cfg.matPos);
    seatGroup.rotation.y = cfg.matRotY;
    envGroup.add(seatGroup);

    const matTex = createPlacematTexture(cfg.accentHex, cfg.lightHex, cfg.motif);
    const matMesh = createToonMesh(new THREE.BoxGeometry(1.48, 0.024, 1.06), 0xffffff, {
      map: matTex,
      outline: 0.016,
      castShadow: false,
      receiveShadow: true,
    });
    seatGroup.add(matMesh);

    // Physical ceramic bean Chopstick Rest (箸置き) — invites placing chopsticks!
    const restPosLocal = new THREE.Vector3(-0.1, 0.035, 0.37);
    const restGeo = new THREE.CapsuleGeometry(0.036, 0.14, 6, 10);
    const chopRest = createToonMesh(restGeo, cfg.accentColor, {
      outline: 0.015,
    });
    chopRest.rotation.z = Math.PI / 2;
    chopRest.position.copy(restPosLocal);
    seatGroup.add(chopRest);

    // Physical Cork & Colored-Rim Coaster (コースター) — invites placing cup!
    const coasterPosLocal = new THREE.Vector3(0.47, 0.024, -0.17);
    const coaster = createToonMesh(new THREE.CylinderGeometry(0.22, 0.23, 0.03, 18), 0xd49a5c, {
      outline: 0.016,
      castShadow: false,
      receiveShadow: true,
    });
    coaster.position.copy(coasterPosLocal);
    seatGroup.add(coaster);

    const coasterRing = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.195, 18),
      new THREE.MeshBasicMaterial({ color: cfg.accentColor, side: THREE.DoubleSide })
    );
    coasterRing.rotation.x = -Math.PI / 2;
    coasterRing.position.set(coasterPosLocal.x, coasterPosLocal.y + 0.018, coasterPosLocal.z);
    seatGroup.add(coasterRing);

    // Glossy overflow puddle mesh (scales up playfully if cup overflows!)
    const puddle = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 18),
      new THREE.MeshBasicMaterial({
        color: 0xf4a835,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      })
    );
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(coasterPosLocal.x, 0.019, coasterPosLocal.z);
    puddle.scale.set(0.001, 0.001, 1);
    puddle.visible = false;
    seatGroup.add(puddle);

    // Compute world coordinates for each slot
    seatGroup.updateMatrixWorld(true);
    const plateSpot = new THREE.Vector3(-0.11, 0.025, -0.02).applyMatrix4(seatGroup.matrixWorld);
    const chopSpot = new THREE.Vector3(-0.1, 0.068, 0.37).applyMatrix4(seatGroup.matrixWorld);
    const cupSpot = new THREE.Vector3(0.47, 0.04, -0.17).applyMatrix4(seatGroup.matrixWorld);

    // Wooden dining chair behind this seat (slides forward when character sits!)
    const chairGroup = buildChair(cfg.accentColor);
    chairGroup.position.set(cfg.chairX, -0.78, cfg.chairBackZ);
    chairGroup.rotation.y = cfg.faceYaw;
    envGroup.add(chairGroup);

    seats.push({
      ...cfg,
      group: seatGroup,
      matMesh,
      chopRest,
      coaster,
      puddle,
      puddleLevel: 0,
      plateSpot,
      chopSpot,
      cupSpot,
      chair: chairGroup,
      plate: null,
      chopsticks: null,
      cup: null,
      pulse: 0,
    });
  }

  return { envGroup, seats, lampGroup };
}

function buildChair(cushionColor) {
  const g = new THREE.Group();
  const wood = 0xb86f38;
  // Seat base
  const base = createToonMesh(new THREE.BoxGeometry(0.86, 0.1, 0.78), wood, { outline: 0.026 });
  g.add(base);

  // Soft colored cushion matching family member
  const cushion = createToonMesh(new THREE.BoxGeometry(0.76, 0.08, 0.68), cushionColor, {
    outline: 0.022,
  });
  cushion.position.y = 0.085;
  g.add(cushion);

  // Chair backrest posts + curved slat
  for (const sx of [-0.34, 0.34]) {
    const post = createToonMesh(new THREE.CylinderGeometry(0.045, 0.045, 1.02, 8), wood, {
      outline: 0.02,
    });
    post.position.set(sx, 0.5, -0.34);
    g.add(post);

    // Front & back legs
    const fl = createToonMesh(new THREE.CylinderGeometry(0.045, 0.038, 1.05, 8), wood, {
      outline: 0.02,
      castShadow: false,
    });
    fl.position.set(sx, -0.55, 0.3);
    g.add(fl);
    const bl = fl.clone();
    bl.position.set(sx, -0.55, -0.3);
    g.add(bl);
  }
  const backSlat = createToonMesh(new THREE.BoxGeometry(0.82, 0.28, 0.08), wood, {
    outline: 0.024,
  });
  backSlat.position.set(0, 0.84, -0.34);
  g.add(backSlat);

  return g;
}
