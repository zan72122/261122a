import * as THREE from '../lib/three.module.js';
import { VoxelBuilder } from './voxel.js';
import { createWholeTomato, createWholeCucumber, createWholeCarrot } from './veggies.js';

const DRY_SOIL = new THREE.Color(0xcfa97e);
const WET_SOIL = new THREE.Color(0x573722);
const _tmpCol = new THREE.Color();

/**
 * Sunny 3D Voxel Balcony Home Garden:
 * - Warm wooden deck, cream-wood apartment facade, sliding glass patio door into Kitchen
 * - 3 voxel planters: Cherry Tomato (vine), Cucumber (trellis), Carrot (cutaway soil window!)
 * - Sky-blue & yellow voxel watering can (drag to pour, tap to splash)
 * - Outdoor balcony faucet (tap or dip can to fill & overflow!)
 * - Rainbow voxel pinwheel (poke or splash to spin with chimes!)
 * - Woven voxel harvest basket (fills visibly -> opens patio door to Kitchen!)
 */
export class BalconyScene {
  constructor(root, mats, particles, sound, callbacks) {
    this.root = root;
    this.mats = mats;
    this.particles = particles;
    this.sound = sound;
    this.callbacks = callbacks;

    this.group = new THREE.Group();
    this.root.add(this.group);

    this.round = 1;
    this.harvestedItems = []; // { type, mesh }
    this.flyingVeggies = [];
    this.doorOpenTarget = 0;
    this.doorOpen = 0;
    this.autoEnterTimer = -1;
    this.idleTime = 0;

    // Interactive state
    this.wateringCan = null;
    this.canHome = new THREE.Vector3(2.45, 0, 2.35);
    this.canPos = this.canHome.clone();
    this.canTargetPos = this.canHome.clone();
    this.canTilt = 0;
    this.canWaterLevel = 1.0;
    this.isDraggingCan = false;
    this.canTapSplash = 0;
    this.pourAccum = 0;
    this.dropSoundAccum = 0;

    this.outdoorFaucetOn = false;
    this.faucetAccum = 0;
    this.faucetBasinLevel = 0.15;

    this.pinwheelSpeed = 0.35;
    this.pinwheelAngle = 0;
    this.pinwheelClickAccum = 0;

    this.draggedVeggie = null;
    this.planters = [];
    this.veggieNodes = [];
    this.hitTargets = []; // Objects tagged with userData.action

    this._buildEnvironment();
    this._buildPlanters();
    this._buildWateringCan();
    this._buildBasket();
    this._buildOutdoorFaucet();
    this._buildPinwheel();
    this._buildClouds();
  }

  _buildEnvironment() {
    // 1. Warm honey-oak wooden balcony deck (alternating plank tones)
    const deck = new VoxelBuilder(0.5);
    const plankColors = [0xdba66e, 0xd49c63, 0xe0ae77, 0xcf965d];
    for (let i = 0; i < 19; i++) {
      const z = -3.0 + i * 0.52;
      deck.addBox(0, -0.18, z, 13.6, 0.36, 0.50, plankColors[i % plankColors.length], 0.5);
    }
    // Outer stone balcony slab edge
    deck.addBox(0, -0.52, 1.5, 14.2, 0.34, 10.2, 0xe8e2d8, 0.6);
    this.group.add(deck.buildMesh(this.mats.matte, false, true));

    // 2. Back apartment wall (warm cream brick/wood blocks) with central opening for sliding patio door
    this.facadeGroup = new THREE.Group();
    this.group.add(this.facadeGroup);

    const wall = new VoxelBuilder(0.5);
    // Left wall segment (x: -6.8 .. -2.5)
    wall.addBox(-4.65, 2.3, -3.25, 4.3, 4.6, 0.5, 0xf6ebd8, 0.5);
    // Right wall segment (x: 2.5 .. 6.8)
    wall.addBox(4.65, 2.3, -3.25, 4.3, 4.6, 0.5, 0xf6ebd8, 0.5);
    // Upper header above door (y: 4.15 .. 4.65)
    wall.addBox(0, 4.40, -3.25, 5.4, 0.55, 0.5, 0xf6ebd8, 0.5);
    // Cute pastel coral-terracotta awning / eaves blocks along top!
    for (let i = -6; i <= 6; i++) {
      const stripeCol = i % 2 === 0 ? 0xf27d52 : 0xfff4e0;
      wall.addBox(i * 1.0, 4.72, -2.55, 0.98, 0.28, 1.75, stripeCol, 0.5);
    }
    // Clean apartment balcony roof cap right behind the awning
    wall.addBox(0, 4.96, -3.95, 13.6, 0.34, 1.9, 0xf6ebd8, 0.5);
    // Warm cedar sliding door frame
    wall.addBox(-2.55, 2.10, -3.15, 0.24, 4.2, 0.65, 0xb87642, 0.35);
    wall.addBox(2.55, 2.10, -3.15, 0.24, 4.2, 0.65, 0xb87642, 0.35);
    wall.addBox(0, 4.18, -3.15, 5.34, 0.24, 0.65, 0xb87642, 0.35);
    wall.addBox(0, 0.05, -3.15, 5.34, 0.12, 0.55, 0x996033, 0.35);
    this.facadeGroup.add(wall.buildMesh(this.mats.matte, true, true));

    // Sliding glass patio door panels (left & right)
    this.doorLeft = this._makeSlidingDoorPanel(-1.25);
    this.doorRight = this._makeSlidingDoorPanel(1.25);
    this.facadeGroup.add(this.doorLeft, this.doorRight);

    // Invisible big click trigger over patio doorway (active when door opens!)
    const doorHit = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 4.0, 0.8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    doorHit.position.set(0, 2.1, -3.0);
    doorHit.userData = { action: 'enterKitchen' };
    this.group.add(doorHit);
    this.hitTargets.push(doorHit);

    // 3. Left & Right crisp white & wood slatted balcony railings
    const rail = new VoxelBuilder(0.35);
    [-6.35, 6.35].forEach((sideX) => {
      // Top cedar handrail & bottom bar
      rail.addBox(sideX, 2.25, 0.8, 0.30, 0.22, 7.6, 0xc48047, 0.35);
      rail.addBox(sideX, 0.22, 0.8, 0.22, 0.22, 7.6, 0xffffff, 0.35);
      // Vertical white slats
      for (let z = -2.6; z <= 4.3; z += 0.65) {
        rail.addBox(sideX, 1.24, z, 0.16, 1.95, 0.18, 0xffffff, 0.35);
      }
      // Corner post
      rail.addBox(sideX, 1.25, 4.45, 0.36, 2.5, 0.36, 0xf2eadf, 0.35);
    });
    // Low decorative front trim blocks right at the actual front deck edge (z = 6.45)
    rail.addBox(0, 0.12, 6.45, 13.4, 0.28, 0.24, 0xffffff, 0.4);
    this.group.add(rail.buildMesh(this.mats.matte, true, true));

    // 4. Cheerful distant voxel neighborhood blocks & leafy trees outside left/right balcony!
    const bg = new VoxelBuilder(0.8);
    // Left distant voxel tree & cozy house roof
    bg.addBox(-9.5, -1.0, -2.0, 1.0, 3.6, 1.0, 0x8d5b34, 0.8);
    bg.addBox(-9.5, 1.6, -2.0, 3.2, 2.6, 3.2, 0x62bf54, 0.8);
    bg.addBox(-9.5, 3.1, -2.0, 2.0, 1.2, 2.0, 0x7ad468, 0.8);
    bg.addBox(-11.5, -1.8, -6.5, 3.8, 4.4, 3.8, 0xffe4c4, 0.8);
    bg.addBox(-11.5, 1.0, -6.5, 4.2, 1.2, 4.2, 0xf27d52, 0.8);
    // Right distant voxel tree & cozy pastel house
    bg.addBox(9.8, -1.0, -1.5, 1.0, 3.4, 1.0, 0x8d5b34, 0.8);
    bg.addBox(9.8, 1.5, -1.5, 3.0, 2.4, 3.0, 0x56b84b, 0.8);
    bg.addBox(9.8, 2.9, -1.5, 1.8, 1.1, 1.8, 0x73d164, 0.8);
    bg.addBox(11.4, -1.6, -6.2, 3.6, 4.2, 3.6, 0xe8f4fc, 0.8);
    bg.addBox(11.4, 1.0, -6.2, 4.0, 1.1, 4.0, 0x5ca4e6, 0.8);
    this.group.add(bg.buildMesh(this.mats.matte, false, false));

    // 5. Little sunny stepping-stone mat in front of patio door
    const matVb = new VoxelBuilder(0.25);
    matVb.addBox(0, 0.04, -2.25, 2.4, 0.08, 0.9, 0x76c770, 0.25);
    matVb.addBox(0, 0.05, -2.25, 1.8, 0.08, 0.5, 0x9be082, 0.25);
    this.group.add(matVb.buildMesh(this.mats.matte, false, true));
  }

  _makeSlidingDoorPanel(baseX) {
    const panel = new THREE.Group();
    panel.position.set(baseX, 0, -3.15);
    panel.userData.baseX = baseX;

    const frame = new VoxelBuilder(0.2);
    frame.addBox(0, 4.05, 0, 2.5, 0.18, 0.14, 0xffffff, 0.25);
    frame.addBox(0, 0.18, 0, 2.5, 0.22, 0.14, 0xffffff, 0.25);
    frame.addBox(-1.18, 2.1, 0, 0.18, 4.0, 0.14, 0xffffff, 0.25);
    frame.addBox(1.18, 2.1, 0, 0.18, 4.0, 0.14, 0xffffff, 0.25);
    // Warm wooden door handle
    const handleX = baseX < 0 ? 0.95 : -0.95;
    frame.addBox(handleX, 1.7, 0.12, 0.12, 0.55, 0.12, 0xd48e48, 0);
    panel.add(frame.buildMesh(this.mats.matte, true, false));

    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.18, 3.65, 0.05), this.mats.glass);
    glass.position.set(0, 2.1, 0);
    panel.add(glass);

    return panel;
  }

  _buildClouds() {
    this.clouds = [];
    const positions = [
      [-9, 7.6, -10, 1.1],
      [-2, 8.8, -14, 1.3],
      [7.5, 7.8, -11, 1.0],
      [12, 6.8, -8, 0.85],
    ];
    positions.forEach(([x, y, z, s], i) => {
      const vb = new VoxelBuilder(0.5);
      vb.addBox(0, 0, 0, 2.6, 0.85, 1.3, 0xffffff, 0.5);
      vb.addBox(-0.5, 0.55, 0, 1.3, 0.7, 1.1, 0xffffff, 0.5);
      vb.addBox(0.55, 0.45, 0.1, 1.1, 0.55, 1.0, 0xf7fbff, 0.5);
      const mesh = vb.buildMesh(this.mats.matte, false, false);
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(s);
      mesh.userData.baseX = x;
      mesh.userData.speed = 0.16 + i * 0.04;
      this.group.add(mesh);
      this.clouds.push(mesh);
    });
  }

  _buildPlanters() {
    // 3 Planters side by side, clean spacing for both iPhone portrait and iPad landscape
    const configs = [
      { id: 'tomato', x: -2.45, z: -0.25 },
      { id: 'cucumber', x: 0.0, z: -0.25 },
      { id: 'carrot', x: 2.45, z: -0.25 },
    ];

    configs.forEach((cfg, idx) => {
      const pGroup = new THREE.Group();
      pGroup.position.set(cfg.x, 0, cfg.z);
      this.group.add(pGroup);

      const isCarrot = cfg.id === 'carrot';
      const boxH = isCarrot ? 1.12 : 0.96;

      // Wooden cedar/terracotta voxel planter box
      const box = new VoxelBuilder(0.24);
      const woodA = isCarrot ? 0xc97b42 : idx === 0 ? 0xd46f4d : 0xb87a44;
      const woodB = isCarrot ? 0xb36834 : idx === 0 ? 0xbd5d3e : 0xa36937;
      // Feet
      box.addBox(-0.82, 0.08, 0.62, 0.24, 0.16, 0.24, woodB, 0);
      box.addBox(0.82, 0.08, 0.62, 0.24, 0.16, 0.24, woodB, 0);
      box.addBox(-0.82, 0.08, -0.62, 0.24, 0.16, 0.24, woodB, 0);
      box.addBox(0.82, 0.08, -0.62, 0.24, 0.16, 0.24, woodB, 0);
      // Base
      box.addBox(0, 0.22, 0, 1.96, 0.16, 1.56, woodB, 0.25);
      // Back, Left, Right walls
      box.addBox(0, 0.24 + boxH * 0.5, -0.72, 2.02, boxH, 0.16, woodA, 0.25);
      box.addBox(-0.94, 0.24 + boxH * 0.5, 0, 0.16, boxH, 1.56, woodA, 0.25);
      box.addBox(0.94, 0.24 + boxH * 0.5, 0, 0.16, boxH, 1.56, woodA, 0.25);

      if (!isCarrot) {
        // Solid front wall + HOLLOW 4-piece rim so dry->wet soil is 100% visible!
        box.addBox(0, 0.24 + boxH * 0.5, 0.72, 2.02, boxH, 0.16, woodA, 0.25);
        box.addBox(0, 0.24 + boxH + 0.05, 0.72, 2.14, 0.14, 0.20, woodB, 0.25);
        box.addBox(0, 0.24 + boxH + 0.05, -0.72, 2.14, 0.14, 0.20, woodB, 0.25);
        box.addBox(-0.98, 0.24 + boxH + 0.05, 0, 0.20, 0.14, 1.66, woodB, 0.25);
        box.addBox(0.98, 0.24 + boxH + 0.05, 0, 0.20, 0.14, 1.66, woodB, 0.25);
      } else {
        // Carrot cutaway front frame so child SEES orange carrots growing underground!!
        box.addBox(-0.84, 0.24 + boxH * 0.5, 0.72, 0.34, boxH, 0.16, woodA, 0.25);
        box.addBox(0.84, 0.24 + boxH * 0.5, 0.72, 0.34, boxH, 0.16, woodA, 0.25);
        box.addBox(0, 0.34, 0.72, 1.96, 0.22, 0.16, woodB, 0.25);
        box.addBox(0, 0.24 + boxH + 0.05, 0.72, 2.14, 0.14, 0.20, woodB, 0.25);
        box.addBox(0, 0.24 + boxH + 0.05, -0.72, 2.14, 0.14, 0.20, woodB, 0.25);
        box.addBox(-0.98, 0.24 + boxH + 0.05, 0, 0.20, 0.14, 1.66, woodB, 0.25);
        box.addBox(0.98, 0.24 + boxH + 0.05, 0, 0.20, 0.14, 1.66, woodB, 0.25);
      }
      pGroup.add(box.buildMesh(this.mats.matte, true, true));

      // Soil block (own material so its color smoothly darkens when watered!)
      const soilMat = new THREE.MeshStandardMaterial({
        color: DRY_SOIL.clone(),
        map: this.mats.blockTex,
        roughness: 0.92,
        metalness: 0.0,
      });
      if (!isCarrot) {
        const soilMesh = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.78, 1.32), soilMat);
        soilMesh.position.set(0, 0.26 + 0.42, 0);
        soilMesh.receiveShadow = true;
        pGroup.add(soilMesh);
      } else {
        // Recessed cutaway soil bed so 3 bright orange carrots sit right against the front glass window!
        const backSoil = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.96, 0.86), soilMat);
        backSoil.position.set(0, 0.26 + 0.48, -0.22);
        backSoil.receiveShadow = true;
        pGroup.add(backSoil);
        // Cute soil divider walls between the 3 carrots so they look nestled right inside the earth!
        [-0.76, -0.25, 0.25, 0.76].forEach((sx) => {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.92, 0.44), soilMat);
          rib.position.set(sx, 0.26 + 0.46, 0.43);
          pGroup.add(rib);
        });
        // Thin bottom earth shelf beneath carrot tips
        const floorEarth = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.18, 0.46), soilMat);
        floorEarth.position.set(0, 0.35, 0.43);
        pGroup.add(floorEarth);
      }

      // Cute bumpy soil voxel tufts on top
      const tuftGroup = new THREE.Group();
      for (let t = 0; t < 6; t++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.28), soilMat);
        m.position.set(-0.55 + (t % 3) * 0.55, 0.26 + (isCarrot ? 0.96 : 0.80), t < 3 ? -0.26 : 0.14);
        tuftGroup.add(m);
      }
      pGroup.add(tuftGroup);

      if (isCarrot) {
        // Clear cutaway window glass in front of soil!
        const glass = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.86, 0.05), this.mats.glass);
        glass.position.set(0, 0.84, 0.73);
        pGroup.add(glass);
      }

      // Hitbox for tapping planter (causes dry wobble + invites watering can)
      const planterHit = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 1.3, 1.7),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      planterHit.position.set(0, 0.7, 0);
      planterHit.userData = { action: 'tapPlanter', planterIndex: idx };
      pGroup.add(planterHit);
      this.hitTargets.push(planterHit);

      const planter = {
        id: cfg.id,
        index: idx,
        x: cfg.x,
        z: cfg.z,
        soilTopY: 0.26 + (isCarrot ? 0.96 : 0.82),
        group: pGroup,
        soilMat,
        wetness: 0,
        growth: 0,
        overwater: 0,
        stageReached: 0,
        bonusSpawned: false,
        wobble: 0,
        plantGroup: new THREE.Group(),
        flowers: [],
        veggies: [],
      };
      pGroup.add(planter.plantGroup);

      if (cfg.id === 'tomato') this._populateTomatoPlanter(planter);
      if (cfg.id === 'cucumber') this._populateCucumberPlanter(planter);
      if (cfg.id === 'carrot') this._populateCarrotPlanter(planter);

      this.planters.push(planter);
    });
  }

  _populateTomatoPlanter(planter) {
    const sy = planter.soilTopY;
    // Wooden support stakes (always visible from start!)
    const stake = new VoxelBuilder(0.16);
    stake.addBox(-0.42, sy + 1.2, -0.15, 0.14, 2.5, 0.14, 0xb88652, 0.2);
    stake.addBox(0.42, sy + 1.2, -0.15, 0.14, 2.5, 0.14, 0xb88652, 0.2);
    stake.addBox(0, sy + 1.1, -0.15, 1.15, 0.11, 0.11, 0xa87642, 0.2);
    stake.addBox(0, sy + 1.95, -0.15, 1.15, 0.11, 0.11, 0xa87642, 0.2);
    planter.group.add(stake.buildMesh(this.mats.matte, true, true));

    // Growing vine & leafy bush (scales smoothly from baby sprout 0.22 -> lush 1.0!)
    const vine = new VoxelBuilder(0.18);
    vine.addBox(0, 0.85, 0, 0.18, 1.7, 0.18, 0x3b9c33, 0.18);
    vine.addBox(-0.4, 1.1, 0.12, 0.72, 0.20, 0.20, 0x3b9c33, 0.18);
    vine.addBox(0.42, 1.45, 0.10, 0.72, 0.20, 0.20, 0x3b9c33, 0.18);
    // Lush voxel foliage clusters
    const leafCoords = [
      [-0.55, 0.65, 0.12, 0.55, 0.35, 0.50, 0x45b53a],
      [0.52, 0.78, 0.08, 0.55, 0.35, 0.48, 0x3ba632],
      [-0.45, 1.38, 0.05, 0.68, 0.42, 0.55, 0x4ec441],
      [0.48, 1.55, 0.05, 0.66, 0.42, 0.54, 0x42b037],
      [0.0, 1.88, 0.0, 0.84, 0.48, 0.62, 0x56cf48],
      [0.0, 1.12, -0.12, 0.76, 0.44, 0.44, 0x33962b],
    ];
    leafCoords.forEach(([x, y, z, sx, sy2, sz, c]) => {
      vine.addBox(x, y, z, sx, sy2, sz, c, 0.22);
    });
    const vineMesh = vine.buildMesh(this.mats.matte, true, true);
    planter.plantGroup.position.set(0, sy, 0);
    planter.plantGroup.add(vineMesh);
    planter.vineMesh = vineMesh;

    // Yellow voxel tomato blossoms (pop open mid-growth!)
    const flowerSpots = [
      [-0.58, 1.15, 0.38],
      [0.55, 1.32, 0.36],
      [0.0, 1.62, 0.38],
      [-0.28, 1.72, 0.34],
    ];
    flowerSpots.forEach(([fx, fy, fz]) => {
      const fv = new VoxelBuilder(0.08);
      fv.addBox(0, 0, 0, 0.22, 0.08, 0.08, 0xffe042, 0);
      fv.addBox(0, 0, 0, 0.08, 0.22, 0.08, 0xffe042, 0);
      fv.addBox(0, 0, 0.03, 0.08, 0.08, 0.08, 0xff9f1c, 0);
      const fm = fv.buildMesh(this.mats.matte, false, false);
      fm.position.set(fx, fy, fz);
      fm.scale.setScalar(0.001);
      planter.plantGroup.add(fm);
      planter.flowers.push(fm);
    });

    // 5 Cherry Tomatoes + 1 Bonus Golden Cherry Tomato!
    const tomatoSpots = [
      { pos: [-0.56, 0.92, 0.40], golden: false },
      { pos: [-0.22, 1.28, 0.46], golden: false },
      { pos: [0.34, 1.02, 0.44], golden: false },
      { pos: [0.56, 1.48, 0.38], golden: false },
      { pos: [-0.05, 1.72, 0.40], golden: false },
      { pos: [0.22, 1.98, 0.32], golden: true }, // Bonus unlocked by extra water!
    ];
    tomatoSpots.forEach((s, i) => {
      const veg = createWholeTomato(this.mats, { golden: s.golden, withDirt: true });
      veg.position.set(s.pos[0], s.pos[1], s.pos[2]);
      veg.scale.setScalar(0.001);
      planter.plantGroup.add(veg);

      // Generous invisible touch sphere/box for 5yo finger!
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.62, 0.62),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      veg.add(hit);

      const node = {
        planter,
        type: s.golden ? 'goldTomato' : 'tomato',
        isBonus: s.golden,
        mesh: veg,
        hit,
        basePos: new THREE.Vector3(...s.pos),
        ripe: false,
        harvested: false,
        phase: i * 1.1,
        growScale: 0.001,
      };
      hit.userData = { action: 'harvestVeggie', node };
      this.hitTargets.push(hit);
      planter.veggies.push(node);
      this.veggieNodes.push(node);
    });
  }

  _populateCucumberPlanter(planter) {
    const sy = planter.soilTopY;
    // Arched voxel wooden trellis!
    const tr = new VoxelBuilder(0.16);
    tr.addBox(-0.68, sy + 1.25, -0.1, 0.14, 2.55, 0.14, 0xc29058, 0.2);
    tr.addBox(0.68, sy + 1.25, -0.1, 0.14, 2.55, 0.14, 0xc29058, 0.2);
    tr.addBox(0, sy + 2.52, -0.1, 1.56, 0.16, 0.16, 0xb58148, 0.2);
    tr.addBox(0, sy + 1.92, -0.1, 1.36, 0.10, 0.10, 0xc29058, 0.2);
    tr.addBox(0, sy + 1.32, -0.1, 1.36, 0.10, 0.10, 0xc29058, 0.2);
    tr.addBox(0, sy + 0.72, -0.1, 1.36, 0.10, 0.10, 0xc29058, 0.2);
    tr.addBox(0, sy + 1.62, -0.1, 0.10, 1.85, 0.10, 0xc29058, 0.2);
    planter.group.add(tr.buildMesh(this.mats.matte, true, true));

    // Climbing lush cucumber vines & big broad voxel leaves
    const vine = new VoxelBuilder(0.2);
    vine.addBox(-0.52, 1.15, 0.04, 0.18, 2.2, 0.18, 0x359633, 0.2);
    vine.addBox(0.52, 1.15, 0.04, 0.18, 2.2, 0.18, 0x359633, 0.2);
    vine.addBox(0, 2.28, 0.04, 1.35, 0.22, 0.22, 0x3ea83b, 0.2);
    // Broad chunky cucumber leaves (bright spring green so dark-emerald bumpy cucumbers POP!)
    const leaves = [
      [-0.64, 0.85, 0.14, 0.62, 0.44, 0.28, 0x62d952],
      [0.62, 0.92, 0.14, 0.62, 0.44, 0.28, 0x57cc47],
      [-0.56, 1.72, 0.14, 0.68, 0.46, 0.30, 0x6ce35b],
      [0.58, 1.78, 0.14, 0.68, 0.46, 0.30, 0x60d650],
      [0.0, 2.38, 0.10, 1.24, 0.44, 0.48, 0x74eb63],
      [-0.25, 1.35, -0.06, 0.56, 0.42, 0.26, 0x4cc441],
      [0.28, 1.48, -0.06, 0.56, 0.42, 0.26, 0x4cc441],
    ];
    leaves.forEach(([x, y, z, sx, sy2, sz, c]) => {
      vine.addBox(x, y, z, sx, sy2, sz, c, 0.24);
    });
    const vineMesh = vine.buildMesh(this.mats.matte, true, true);
    planter.plantGroup.position.set(0, sy, 0);
    planter.plantGroup.add(vineMesh);
    planter.vineMesh = vineMesh;

    // Bright yellow cucumber flowers
    [[-0.55, 1.42, 0.32], [0.55, 1.52, 0.32], [0.0, 2.12, 0.34]].forEach(([fx, fy, fz]) => {
      const fv = new VoxelBuilder(0.08);
      fv.addBox(0, 0, 0, 0.26, 0.10, 0.08, 0xffd93b, 0);
      fv.addBox(0, 0, 0, 0.10, 0.26, 0.08, 0xffd93b, 0);
      const fm = fv.buildMesh(this.mats.matte, false, false);
      fm.position.set(fx, fy, fz);
      fm.scale.setScalar(0.001);
      planter.plantGroup.add(fm);
      planter.flowers.push(fm);
    });

    // 3 Chunky Cucumbers + 1 Bonus Star Cucumber!
    const cucSpots = [
      { pos: [-0.46, 1.32, 0.36], star: false },
      { pos: [0.02, 1.74, 0.38], star: false },
      { pos: [0.48, 1.24, 0.36], star: false },
      { pos: [0.02, 1.05, 0.38], star: true }, // Bonus unlocked by extra water!
    ];
    cucSpots.forEach((s, i) => {
      const veg = createWholeCucumber(this.mats, { star: s.star, withDirt: true });
      veg.position.set(s.pos[0], s.pos[1], s.pos[2]);
      veg.scale.setScalar(0.001);
      planter.plantGroup.add(veg);

      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(0.60, 1.15, 0.62),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      veg.add(hit);

      const node = {
        planter,
        type: s.star ? 'starCucumber' : 'cucumber',
        isBonus: s.star,
        mesh: veg,
        hit,
        basePos: new THREE.Vector3(...s.pos),
        ripe: false,
        harvested: false,
        phase: i * 1.4,
        growScale: 0.001,
      };
      hit.userData = { action: 'harvestVeggie', node };
      this.hitTargets.push(hit);
      planter.veggies.push(node);
      this.veggieNodes.push(node);
    });
  }

  _populateCarrotPlanter(planter) {
    const sy = planter.soilTopY;
    planter.plantGroup.position.set(0, sy, 0);

    // 3 Orange Carrots (clearly visible right behind the cutaway glass window!) + 1 Bonus Rainbow Carrot!
    const carrotSpots = [
      { pos: [-0.50, -0.26, 0.48], rainbow: false },
      { pos: [0.0, -0.26, 0.48], rainbow: false },
      { pos: [0.50, -0.26, 0.48], rainbow: false },
      { pos: [0.0, -0.24, -0.10], rainbow: true }, // Bonus unlocked by extra water!
    ];
    carrotSpots.forEach((s, i) => {
      const veg = createWholeCarrot(this.mats, { rainbow: s.rainbow, withDirt: true });
      veg.position.set(s.pos[0], s.pos[1], s.pos[2]);
      // Start as tiny sprout peeking just out of soil!
      veg.scale.set(0.28, 0.28, 0.28);
      if (s.rainbow) veg.scale.setScalar(0.001);
      planter.plantGroup.add(veg);

      // Generous hitbox covering both the leafy green top and the orange carrot body!
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 1.35, 0.62),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.set(0, 0.25, 0);
      veg.add(hit);

      const node = {
        planter,
        type: s.rainbow ? 'rainbowCarrot' : 'carrot',
        isBonus: s.rainbow,
        mesh: veg,
        hit,
        basePos: new THREE.Vector3(...s.pos),
        ripe: false,
        harvested: false,
        phase: i * 1.3,
        growScale: s.rainbow ? 0.001 : 0.28,
      };
      hit.userData = { action: 'harvestVeggie', node };
      this.hitTargets.push(hit);
      planter.veggies.push(node);
      this.veggieNodes.push(node);
    });
  }

  _buildWateringCan() {
    const can = new THREE.Group();
    const vb = new VoxelBuilder(0.16);
    const blue = 0x35b8f2;
    const blueDark = 0x2299d4;
    const yellow = 0xffd43b;
    const yellowDark = 0xf2b705;

    // Hollow-top chunky voxel watering can body!
    // Base + 4 walls so sparkling water is visible inside!
    vb.addBox(0, 0.10, 0, 1.05, 0.20, 0.92, blueDark, 0.18);
    vb.addBox(0, 0.56, 0.40, 1.05, 0.74, 0.14, blue, 0.18);
    vb.addBox(0, 0.56, -0.40, 1.05, 0.74, 0.14, blue, 0.18);
    vb.addBox(-0.46, 0.56, 0, 0.14, 0.74, 0.80, blue, 0.18);
    vb.addBox(0.46, 0.56, 0, 0.14, 0.74, 0.80, blue, 0.18);
    // Cute sunny yellow top rim + decorative voxel stripe
    vb.addBox(0, 0.96, 0.40, 1.12, 0.12, 0.16, yellow, 0.18);
    vb.addBox(0, 0.96, -0.40, 1.12, 0.12, 0.16, yellow, 0.18);
    vb.addBox(0.46, 0.96, 0, 0.16, 0.12, 0.86, yellow, 0.18);
    vb.addBox(-0.46, 0.96, 0, 0.16, 0.12, 0.86, yellow, 0.18);
    vb.addBox(0, 0.52, 0.48, 0.36, 0.28, 0.04, yellow, 0); // cute front badge block!
    // Curved rear handle (+X side)
    vb.addBox(0.68, 0.78, 0, 0.34, 0.15, 0.20, yellow, 0.16);
    vb.addBox(0.78, 0.48, 0, 0.16, 0.62, 0.20, yellowDark, 0.16);
    vb.addBox(0.64, 0.24, 0, 0.34, 0.15, 0.20, yellow, 0.16);
    // Top carry arch handle
    vb.addBox(0.14, 1.24, 0, 0.68, 0.14, 0.18, yellow, 0.16);
    vb.addBox(-0.18, 1.10, 0, 0.14, 0.28, 0.18, yellowDark, 0.16);
    vb.addBox(0.46, 1.10, 0, 0.14, 0.28, 0.18, yellowDark, 0.16);
    // Stepped voxel spout pointing left (-X)
    vb.addBox(-0.62, 0.38, 0, 0.32, 0.20, 0.22, blueDark, 0.16);
    vb.addBox(-0.84, 0.56, 0, 0.32, 0.20, 0.20, blue, 0.16);
    vb.addBox(-1.04, 0.76, 0, 0.28, 0.20, 0.20, blue, 0.16);
    // Chunky yellow sprinkler rose head!
    vb.addBox(-1.24, 0.90, 0, 0.22, 0.42, 0.42, yellow, 0.14);
    vb.addBox(-1.36, 0.90, 0, 0.06, 0.32, 0.32, yellowDark, 0.10);

    can.add(vb.buildMesh(this.mats.gloss, true, true));

    // Visible shimmering voxel water inside the can!
    this.canWaterMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.66, 0.66),
      this.mats.water
    );
    this.canWaterMesh.position.set(0, 0.52, 0);
    can.add(this.canWaterMesh);

    // Spout tip marker for accurate particle emission
    this.spoutTip = new THREE.Object3D();
    this.spoutTip.position.set(-1.42, 0.90, 0);
    can.add(this.spoutTip);

    // Extra generous invisible touch hitbox for 5yo one-finger grab!
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.9, 1.8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.set(-0.15, 0.72, 0);
    hit.userData = { action: 'grabCan' };
    can.add(hit);
    this.hitTargets.push(hit);

    can.position.copy(this.canHome);
    this.group.add(can);
    this.wateringCan = can;
  }

  _buildBasket() {
    const basket = new THREE.Group();
    const vb = new VoxelBuilder(0.18);
    const w1 = 0xd9a15b;
    const w2 = 0xc48a45;
    const rim = 0xe8b772;

    // Woven wooden voxel harvest basket (hollow inside so harvested veggies sit visibly inside!)
    vb.addBox(0, 0.08, 0, 1.56, 0.16, 1.18, w2, 0.2);
    // Woven alternating stripes on walls
    for (let row = 0; row < 3; row++) {
      const y = 0.26 + row * 0.22;
      const colA = row % 2 === 0 ? w1 : w2;
      const colB = row % 2 === 0 ? w2 : w1;
      vb.addBox(0, y, 0.56, 1.64, 0.20, 0.14, colA, 0.22);
      vb.addBox(0, y, -0.56, 1.64, 0.20, 0.14, colA, 0.22);
      vb.addBox(-0.78, y, 0, 0.14, 0.20, 1.12, colB, 0.22);
      vb.addBox(0.78, y, 0, 0.14, 0.20, 1.12, colB, 0.22);
    }
    // Thick braided rim
    vb.addBox(0, 0.86, 0.58, 1.78, 0.14, 0.18, rim, 0.2);
    vb.addBox(0, 0.86, -0.58, 1.78, 0.14, 0.18, rim, 0.2);
    vb.addBox(-0.82, 0.86, 0, 0.18, 0.14, 1.24, rim, 0.2);
    vb.addBox(0.82, 0.86, 0, 0.18, 0.14, 1.24, rim, 0.2);
    basket.add(vb.buildMesh(this.mats.matte, true, true));

    // Pivoting carry arch handle (flips up eagerly once basket has veggies!)
    this.basketHandle = new THREE.Group();
    this.basketHandle.position.set(0, 0.84, 0);
    const hv = new VoxelBuilder(0.16);
    hv.addBox(-0.78, 0.36, 0, 0.14, 0.72, 0.16, w2, 0.16);
    hv.addBox(0.78, 0.36, 0, 0.14, 0.72, 0.16, w2, 0.16);
    hv.addBox(0, 0.72, 0, 1.70, 0.16, 0.18, rim, 0.18);
    this.basketHandle.add(hv.buildMesh(this.mats.matte, true, true));
    this.basketHandle.rotation.x = -Math.PI * 0.44; // rests back while empty
    basket.add(this.basketHandle);

    // Container for veggies stacked inside the basket
    this.basketContents = new THREE.Group();
    basket.add(this.basketContents);

    // Big friendly touch hitbox
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.6, 1.7),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.set(0, 0.75, 0);
    hit.userData = { action: 'tapBasket' };
    basket.add(hit);
    this.hitTargets.push(hit);

    basket.position.set(-2.45, 0, 2.35);
    this.group.add(basket);
    this.basket = basket;
    this.basketBounce = 0;
  }

  _buildOutdoorFaucet() {
    const fg = new THREE.Group();
    fg.position.set(-4.35, 0, -1.75);

    const vb = new VoxelBuilder(0.18);
    // Stone basin + wooden faucet post
    vb.addBox(0, 0.18, 0.32, 1.22, 0.36, 1.04, 0xc7c2b8, 0.25);
    vb.addBox(0, 0.44, 0.78, 1.22, 0.24, 0.14, 0xd9d4ca, 0.25);
    vb.addBox(-0.54, 0.44, 0.32, 0.14, 0.24, 0.92, 0xd9d4ca, 0.25);
    vb.addBox(0.54, 0.44, 0.32, 0.14, 0.24, 0.92, 0xd9d4ca, 0.25);
    vb.addBox(0, 0.92, -0.22, 0.38, 1.84, 0.38, 0x9e7147, 0.24);
    fg.add(vb.buildMesh(this.mats.matte, true, true));

    // Brass voxel spigot
    const mv = new VoxelBuilder(0.12);
    mv.addBox(0, 1.56, 0.16, 0.18, 0.18, 0.56, 0xe8ba46, 0.14);
    mv.addBox(0, 1.42, 0.38, 0.16, 0.22, 0.16, 0xd4a432, 0.12);
    fg.add(mv.buildMesh(this.mats.metal, true, true));

    // Bright red spinning wheel handle on top!
    this.faucetWheel = new THREE.Group();
    this.faucetWheel.position.set(0, 1.76, 0.14);
    const wv = new VoxelBuilder(0.1);
    wv.addBox(0, 0, 0, 0.44, 0.10, 0.12, 0xe84343, 0);
    wv.addBox(0, 0, 0, 0.12, 0.10, 0.44, 0xe84343, 0);
    wv.addBox(0, -0.08, 0, 0.10, 0.16, 0.10, 0xe8ba46, 0);
    this.faucetWheel.add(wv.buildMesh(this.mats.gloss, true, false));
    fg.add(this.faucetWheel);

    // Rising water surface in stone basin
    this.basinWater = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.34, 0.74),
      this.mats.water
    );
    this.basinWater.position.set(0, 0.26, 0.32);
    fg.add(this.basinWater);

    // Touch trigger
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 2.2, 1.4),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.set(0, 1.0, 0.2);
    hit.userData = { action: 'toggleOutdoorFaucet' };
    fg.add(hit);
    this.hitTargets.push(hit);

    this.group.add(fg);
    this.outdoorFaucetPos = new THREE.Vector3(-4.35, 1.32, -1.36);
  }

  _buildPinwheel() {
    const pg = new THREE.Group();
    pg.position.set(-4.45, 0, 0.65);

    const stick = new VoxelBuilder(0.14);
    // Mini pot + wooden stick
    stick.addBox(0, 0.26, 0, 0.64, 0.52, 0.64, 0xe07b54, 0.2);
    stick.addBox(0, 0.56, 0, 0.72, 0.12, 0.72, 0xc96742, 0.2);
    stick.addBox(0, 1.48, 0, 0.14, 1.95, 0.14, 0xd49a5d, 0.18);
    pg.add(stick.buildMesh(this.mats.matte, true, true));

    // Spinning rainbow voxel blades
    this.pinwheelBlades = new THREE.Group();
    this.pinwheelBlades.position.set(0, 2.35, 0.14);
    const bv = new VoxelBuilder(0.12);
    bv.addBox(0, 0, 0.06, 0.20, 0.20, 0.14, 0xffffff, 0);
    // 4 vibrant voxel sails
    bv.addBox(0.28, 0.22, 0, 0.42, 0.30, 0.08, 0xff5964, 0.14);
    bv.addBox(-0.22, 0.28, 0, 0.30, 0.42, 0.08, 0xffd43b, 0.14);
    bv.addBox(-0.28, -0.22, 0, 0.42, 0.30, 0.08, 0x38d9a9, 0.14);
    bv.addBox(0.22, -0.28, 0, 0.30, 0.42, 0.08, 0x4dabf7, 0.14);
    this.pinwheelBlades.add(bv.buildMesh(this.mats.gloss, true, false));
    pg.add(this.pinwheelBlades);

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.5, 0.9),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.set(0, 2.2, 0.1);
    hit.userData = { action: 'spinPinwheel' };
    pg.add(hit);
    this.hitTargets.push(hit);

    this.group.add(pg);
    this.pinwheelPos = new THREE.Vector3(-4.45, 2.35, 0.75);
  }

  resetForNewRound() {
    this.round++;
    this.harvestedItems = [];
    this.flyingVeggies = [];
    this.doorOpenTarget = 0;
    this.autoEnterTimer = -1;
    this.canWaterLevel = 1.0;
    this.canTargetPos.copy(this.canHome);
    this.canPos.copy(this.canHome);
    this.isDraggingCan = false;
    this.outdoorFaucetOn = false;

    // Clear basket visual contents
    while (this.basketContents.children.length > 0) {
      this.basketContents.remove(this.basketContents.children[0]);
    }

    // Reset all planters & regrow fresh veggies!
    this.planters.forEach((p) => {
      p.wetness = 0;
      p.growth = 0;
      p.overwater = 0;
      p.stageReached = 0;
      p.bonusSpawned = false;
      p.soilMat.color.copy(DRY_SOIL);
      p.flowers.forEach((f) => f.scale.setScalar(0.001));
      p.veggies.forEach((n) => {
        n.ripe = false;
        n.harvested = false;
        n.growScale = n.planter.id === 'carrot' && !n.isBonus ? 0.28 : 0.001;
        n.mesh.visible = true;
        n.mesh.position.copy(n.basePos);
        n.mesh.rotation.set(0, 0, 0);
        n.mesh.scale.setScalar(n.growScale);
      });
    });
  }

  getHitTargets() {
    return this.hitTargets;
  }

  onPointerDown(hitObj, worldOnFloor, raycaster) {
    this.idleTime = 0;
    if (!hitObj) return false;
    const act = hitObj.userData.action;

    if (act === 'grabCan') {
      this.isDraggingCan = true;
      this.canGrabStart = performance.now();
      this.canDraggedDist = 0;
      this.sound.playMarimba(3, 0.22, 0.14);
      this._updateCanDrag(raycaster);
      return true;
    }

    if (act === 'harvestVeggie') {
      const node = hitObj.userData.node;
      if (!node || node.harvested) return false;
      if (!node.ripe) {
        // Not grown yet -> wiggle planter & invite watering can!
        this._nudgeDryPlanter(node.planter);
        return true;
      }
      this._harvestNode(node);
      return true;
    }

    if (act === 'tapPlanter') {
      const planter = this.planters[hitObj.userData.planterIndex];
      if (!planter) return false;
      // Check if any ripe veggie is close to tap point — generous forgiveness!
      const ripe = planter.veggies.find((v) => v.ripe && !v.harvested);
      if (ripe) {
        this._harvestNode(ripe);
        return true;
      }
      this._nudgeDryPlanter(planter);
      return true;
    }

    if (act === 'toggleOutdoorFaucet') {
      this.outdoorFaucetOn = !this.outdoorFaucetOn;
      this.sound.playMarimba(this.outdoorFaucetOn ? 6 : 2, 0.26, 0.16);
      if (this.outdoorFaucetOn) {
        this.sound.playSplash(0.8);
      }
      return true;
    }

    if (act === 'spinPinwheel') {
      this.pinwheelSpeed = Math.min(24, this.pinwheelSpeed + 10);
      this.sound.playPinwheelClick(Math.floor(Math.random() * 6));
      this.particles.emitSparkles(this.pinwheelPos.x, this.pinwheelPos.y, this.pinwheelPos.z, 7);
      return true;
    }

    if (act === 'tapBasket') {
      this.basketBounce = 1.0;
      if (this.harvestedItems.length >= 1) {
        this.sound.playMarimba(7, 0.3, 0.24);
        this.callbacks.onEnterKitchen(this.harvestedItems.map((h) => h.type));
      } else {
        // Empty basket gives a warm hollow wood knock!
        this.sound.playBasketThud(1);
      }
      return true;
    }

    if (act === 'enterKitchen') {
      if (this.harvestedItems.length >= 1) {
        this.sound.playMarimba(7, 0.3, 0.24);
        this.callbacks.onEnterKitchen(this.harvestedItems.map((h) => h.type));
        return true;
      }
    }

    return false;
  }

  onPointerMove(raycaster) {
    this.idleTime = 0;
    if (this.isDraggingCan) {
      this._updateCanDrag(raycaster);
      return true;
    }
    return false;
  }

  onPointerUp() {
    if (this.isDraggingCan) {
      const heldMs = performance.now() - this.canGrabStart;
      if (heldMs < 240 && this.canDraggedDist < 0.35) {
        // Short tap -> cute playful splash right in place!
        this.canTapSplash = 0.45;
        this.sound.playSplash(0.85);
      }
      this.isDraggingCan = false;
      this.canTargetPos.copy(this.canHome);
    }
  }

  _updateCanDrag(raycaster) {
    // Intersect drag ray at soil plane (y = 1.05) so water pours DEAD-CENTER right under the child's finger!
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.05);
    const hitPt = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hitPt)) {
      // Spout pours at (canX - 1.55, canZ), so place can +1.55 to the right of finger point!
      let tx = THREE.MathUtils.clamp(hitPt.x + 1.55, -3.4, 5.2);
      let tz = THREE.MathUtils.clamp(hitPt.z, -2.0, 2.8);

      // Gentle invisible magnetic assist toward nearest planter soil so a 5yo's messy drag hits smoothly!
      const spoutX = tx - 1.55;
      for (const p of this.planters) {
        const dx = p.x - spoutX;
        const dz = p.z - tz;
        if (Math.abs(dx) < 1.35 && Math.abs(dz) < 1.35) {
          tx += dx * 0.55;
          tz += dz * 0.6;
          break;
        }
      }

      this.canDraggedDist += Math.hypot(tx - this.canTargetPos.x, tz - this.canTargetPos.z);
      this.canTargetPos.set(tx, 2.55, tz);
    }
  }

  _nudgeDryPlanter(planter) {
    planter.wobble = 1.0;
    this.sound.playMarimba(1, 0.18, 0.12);
    // Invite attention gently toward watering can without auto-watering!
    if (!this.isDraggingCan) {
      this.canHop = 1.0;
    }
  }

  _harvestNode(node) {
    node.harvested = true;
    node.ripe = false;

    const worldPos = new THREE.Vector3();
    node.mesh.getWorldPosition(worldPos);
    node.mesh.visible = false;

    // Distinct tactile sound & burst per vegetable!
    if (node.type === 'carrot' || node.type === 'rainbowCarrot') {
      this.sound.playUproot();
      this.particles.emitDirtBurst(worldPos.x, node.planter.soilTopY + 0.1, worldPos.z, 18, 0.05);
      node.planter.wobble = 0.7;
    } else if (node.type === 'cucumber' || node.type === 'starCucumber') {
      this.sound.playSnap();
      this.particles.emitSparkles(worldPos.x, worldPos.y, worldPos.z, 8, [0x7ef7a0, 0xffe066, 0xffffff]);
    } else {
      this.sound.playPop(node.type === 'goldTomato' ? 1.25 : 1.0);
      this.particles.emitSparkles(worldPos.x, worldPos.y, worldPos.z, 8, [0xff8080, 0xffe066, 0xffffff]);
    }

    // Create flying veggie clone that arcs gracefully into the harvest basket!
    let clone;
    if (node.type === 'tomato' || node.type === 'goldTomato') {
      clone = createWholeTomato(this.mats, { golden: node.type === 'goldTomato', withDirt: true });
    } else if (node.type === 'cucumber' || node.type === 'starCucumber') {
      clone = createWholeCucumber(this.mats, { star: node.type === 'starCucumber', withDirt: true });
    } else {
      clone = createWholeCarrot(this.mats, { rainbow: node.type === 'rainbowCarrot', withDirt: true });
    }

    clone.position.copy(worldPos);
    this.group.add(clone);

    const slotIdx = this.harvestedItems.length + this.flyingVeggies.length;
    const col = slotIdx % 4;
    const row = Math.floor(slotIdx / 4);
    const localTarget = new THREE.Vector3(
      -0.46 + col * 0.30 + (Math.random() - 0.5) * 0.06,
      0.42 + row * 0.22,
      -0.25 + (row % 2) * 0.32 + (Math.random() - 0.5) * 0.1
    );
    const worldTarget = this.basket.position.clone().add(localTarget);

    this.flyingVeggies.push({
      type: node.type,
      mesh: clone,
      start: worldPos.clone(),
      target: worldTarget,
      localTarget,
      t: 0,
      duration: 0.56,
    });
  }

  _onVeggieLandedInBasket(item) {
    this.group.remove(item.mesh);
    item.mesh.position.copy(item.localTarget);
    item.mesh.rotation.set(
      (Math.random() - 0.5) * 0.8,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.8
    );
    item.mesh.scale.setScalar(0.88);
    this.basketContents.add(item.mesh);
    this.harvestedItems.push({ type: item.type, mesh: item.mesh });

    this.basketBounce = 1.0;
    this.sound.playBasketThud(this.harvestedItems.length);
    this.particles.emitSparkles(
      this.basket.position.x,
      this.basket.position.y + 0.9,
      this.basket.position.z,
      6
    );

    // Open the sliding patio door once 3+ veggies are harvested!
    if (this.harvestedItems.length >= 3 && this.doorOpenTarget < 1) {
      this.doorOpenTarget = 1;
      this.sound.playSlideDoor();
      this.sound.playSparkleClean();
    }

    // Check if ALL regular veggies across all 3 planters are harvested!
    const remainingRegular = this.veggieNodes.filter((n) => !n.isBonus && !n.harvested).length;
    if (remainingRegular === 0 && this.autoEnterTimer < 0) {
      this.doorOpenTarget = 1;
      this.autoEnterTimer = 1.6;
      this.sound.playFanfare();
      this.particles.emitConfetti(this.basket.position.x, 1.4, this.basket.position.z, 26);
    }
  }

  _applyWaterAt(wx, wz, dt) {
    // Check if pouring onto pinwheel!
    if (Math.hypot(wx - this.pinwheelPos.x, wz - this.pinwheelPos.z) < 1.2) {
      this.pinwheelSpeed = Math.min(26, this.pinwheelSpeed + 22 * dt);
    }

    // Check planters
    for (const p of this.planters) {
      if (Math.abs(wx - p.x) < 1.25 && Math.abs(wz - p.z) < 1.15) {
        p.wetness = Math.min(1, p.wetness + dt * 0.85);
        _tmpCol.copy(DRY_SOIL).lerp(WET_SOIL, p.wetness);
        p.soilMat.color.copy(_tmpCol);

        if (p.growth < 1.0) {
          p.growth = Math.min(1.0, p.growth + dt * 0.44);
          // Milestone joyful pops!
          const stage = p.growth >= 0.99 ? 3 : p.growth >= 0.65 ? 2 : p.growth >= 0.30 ? 1 : 0;
          if (stage > p.stageReached) {
            p.stageReached = stage;
            p.wobble = 0.85;
            this.sound.playGrowthPop(stage);
            this.particles.emitSparkles(p.x, p.soilTopY + 1.1, p.z, 10);
            if (stage === 3) {
              // Mark all non-bonus veggies ripe!
              p.veggies.forEach((v) => {
                if (!v.isBonus && !v.harvested) v.ripe = true;
              });
            }
          }
        } else {
          // Overwatering past full growth -> unlocks surprise bonus rare veggie!
          p.overwater = Math.min(1.0, p.overwater + dt * 0.48);
          if (p.overwater >= 1.0 && !p.bonusSpawned) {
            p.bonusSpawned = true;
            const bonus = p.veggies.find((v) => v.isBonus);
            if (bonus && !bonus.harvested) {
              bonus.ripe = true;
              this.sound.playSparkleClean();
              this.particles.emitSparkles(p.x, p.soilTopY + 1.5, p.z, 18, [0xffe066, 0xff8fab, 0xffffff, 0x7ef7d4]);
            }
          }
        }
      }
    }
  }

  update(dt, time, isActive) {
    // Clouds always drift softly across the sunny sky
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 16) c.position.x = -15;
    }

    // Sliding glass patio door animation
    this.doorOpen += (this.doorOpenTarget - this.doorOpen) * Math.min(1, dt * 4.5);
    this.doorLeft.position.x = -1.25 - this.doorOpen * 1.95;
    this.doorRight.position.x = 1.25 + this.doorOpen * 1.95;

    if (!isActive) {
      this.sound.setWaterStream(false);
      return;
    }

    this.idleTime += dt;

    // Auto-enter kitchen smoothly once all regular veggies are harvested
    if (this.autoEnterTimer > 0) {
      this.autoEnterTimer -= dt;
      if (this.autoEnterTimer <= 0) {
        this.autoEnterTimer = -1;
        this.callbacks.onEnterKitchen(this.harvestedItems.map((h) => h.type));
        return;
      }
    }

    // 1. Watering can physics, pouring & refilling!
    this.canPos.lerp(this.canTargetPos, Math.min(1, dt * 13));
    let hopY = 0;
    if (this.canHop > 0) {
      this.canHop = Math.max(0, this.canHop - dt * 2.8);
      hopY = Math.sin(this.canHop * Math.PI) * 0.45;
    }
    // Gentle wordless invitation ONLY after 10s of total idleness (0-6s completely calm!)
    const idleWobble =
      !this.isDraggingCan && this.idleTime > 10 && this.harvestedItems.length === 0
        ? Math.sin((this.idleTime - 10) * 4.5) * 0.08
        : 0;

    this.wateringCan.position.set(this.canPos.x, this.canPos.y + hopY, this.canPos.z);

    // Check if held under outdoor balcony faucet!
    const distToFaucet = Math.hypot(
      this.canPos.x - this.outdoorFaucetPos.x,
      this.canPos.z - this.outdoorFaucetPos.z
    );
    const underFaucet = this.isDraggingCan && distToFaucet < 1.35;
    if (underFaucet && !this.outdoorFaucetOn) {
      this.outdoorFaucetOn = true;
      this.sound.playMarimba(6, 0.22, 0.14);
    }

    const isPouring =
      (this.isDraggingCan && !underFaucet) || this.canTapSplash > 0;
    if (this.canTapSplash > 0) this.canTapSplash -= dt;

    const targetTilt = isPouring ? 0.62 : idleWobble;
    this.canTilt += (targetTilt - this.canTilt) * Math.min(1, dt * 11);
    this.wateringCan.rotation.z = this.canTilt;

    // Gentle passive dew refill when resting at home so a 5yo never gets stuck
    if (!this.isDraggingCan && this.canWaterLevel < 0.85) {
      this.canWaterLevel = Math.min(1.0, this.canWaterLevel + dt * 0.12);
    }

    // Pour voxel water cubes from spout!
    if (isPouring) {
      this.canWaterLevel = Math.max(0.18, this.canWaterLevel - dt * 0.035);
      this.pourAccum += dt * 44;
      const tipWorld = new THREE.Vector3();
      this.spoutTip.getWorldPosition(tipWorld);

      while (this.pourAccum >= 1) {
        this.pourAccum -= 1;
        this.particles.spawn({
          x: tipWorld.x + (Math.random() - 0.5) * 0.16,
          y: tipWorld.y + (Math.random() - 0.5) * 0.14,
          z: tipWorld.z + (Math.random() - 0.5) * 0.18,
          vx: -1.1 + (Math.random() - 0.5) * 0.7,
          vy: -1.8 + (Math.random() - 0.5) * 0.5,
          vz: (Math.random() - 0.5) * 0.6,
          size: 0.10 + Math.random() * 0.06,
          maxLife: 0.62,
          gravity: -15,
          floorY: 0.06,
          bounce: 0.34,
          bouncesLeft: 1,
          color: Math.random() > 0.35 ? 0x4fd2ff : 0x99e9ff,
          kind: 'water',
        });
      }

      // Compute landing point of water stream (~0.35s fall)
      const landX = tipWorld.x - 0.38;
      const landZ = tipWorld.z;
      this._applyWaterAt(landX, landZ, dt);

      this.dropSoundAccum += dt;
      if (this.dropSoundAccum > 0.14) {
        this.dropSoundAccum = 0;
        this.sound.playWaterDrop(0.95 + Math.random() * 0.25);
      }
    }

    // 2. Outdoor Faucet gushing & overflowing!
    if (this.outdoorFaucetOn) {
      this.faucetWheel.rotation.y += dt * 6;
      this.faucetAccum += dt * 36;
      while (this.faucetAccum >= 1) {
        this.faucetAccum -= 1;
        this.particles.spawn({
          x: this.outdoorFaucetPos.x + (Math.random() - 0.5) * 0.08,
          y: this.outdoorFaucetPos.y,
          z: this.outdoorFaucetPos.z + (Math.random() - 0.5) * 0.08,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -2.2,
          vz: (Math.random() - 0.5) * 0.4,
          size: 0.11,
          maxLife: 0.52,
          gravity: -14,
          floorY: 0.45,
          bounce: 0.35,
          bouncesLeft: 1,
          color: 0x56d8ff,
          kind: 'water',
        });
      }

      if (underFaucet) {
        this.canWaterLevel = Math.min(1.18, this.canWaterLevel + dt * 0.55);
        if (this.canWaterLevel > 1.0) {
          // Delightful watering can overflow!
          if (Math.random() < dt * 16) {
            this.particles.emitWaterSplash(
              this.canPos.x,
              this.canPos.y + 0.98,
              this.canPos.z,
              4,
              0.06,
              1.6
            );
          }
        }
      } else {
        this.faucetBasinLevel = Math.min(1.2, this.faucetBasinLevel + dt * 0.35);
        if (this.faucetBasinLevel > 1.0 && Math.random() < dt * 14) {
          this.particles.emitWaterSplash(
            this.outdoorFaucetPos.x,
            0.55,
            this.outdoorFaucetPos.z + 0.2,
            3,
            0.05,
            1.7
          );
        }
      }
    } else {
      this.faucetBasinLevel = Math.max(0.15, this.faucetBasinLevel - dt * 0.08);
    }
    this.basinWater.scale.y = Math.min(1.05, this.faucetBasinLevel);
    this.basinWater.position.y = 0.22 + this.basinWater.scale.y * 0.17;

    // Update visible water level inside watering can
    const visLevel = THREE.MathUtils.clamp(this.canWaterLevel, 0.08, 1.05);
    this.canWaterMesh.scale.y = visLevel;
    this.canWaterMesh.position.y = 0.20 + visLevel * 0.33;

    // Continuous water stream audio
    this.sound.setWaterStream(isPouring || this.outdoorFaucetOn, 1.0, underFaucet ? 1200 : 920);

    // 3. Pinwheel spinning!
    this.pinwheelSpeed = Math.max(0.35, this.pinwheelSpeed - dt * 2.8);
    this.pinwheelAngle -= this.pinwheelSpeed * dt;
    this.pinwheelBlades.rotation.z = this.pinwheelAngle;
    if (this.pinwheelSpeed > 2.2) {
      this.pinwheelClickAccum += this.pinwheelSpeed * dt;
      if (this.pinwheelClickAccum > 2.4) {
        this.pinwheelClickAccum = 0;
        this.sound.playPinwheelClick(Math.floor(this.pinwheelSpeed));
      }
    }

    // 4. Planters & Veggies smooth animated growth and playful sway
    for (const p of this.planters) {
      if (p.wobble > 0) {
        p.wobble = Math.max(0, p.wobble - dt * 3.0);
      }
      const wobRot = Math.sin(p.wobble * Math.PI * 3) * p.wobble * 0.08;

      if (p.vineMesh) {
        const targetS = 0.24 + p.growth * 0.76;
        p.vineMesh.scale.y += (targetS - p.vineMesh.scale.y) * Math.min(1, dt * 6);
        p.vineMesh.scale.x = 0.42 + (p.vineMesh.scale.y - 0.24) * 0.76;
        p.vineMesh.scale.z = p.vineMesh.scale.x;
        p.vineMesh.rotation.z = Math.sin(time * 1.8 + p.index) * 0.025 + wobRot;
      }

      // Flowers pop between growth 0.32 and 0.90
      const flTarget = p.growth > 0.32 ? Math.min(1, (p.growth - 0.32) * 3.5) : 0.001;
      for (const f of p.flowers) {
        f.scale.x += (flTarget - f.scale.x) * Math.min(1, dt * 8);
        f.scale.setScalar(f.scale.x);
        f.rotation.z = Math.sin(time * 2.4 + f.position.x) * 0.12;
      }

      // Veggies plump up!
      for (const v of p.veggies) {
        if (v.harvested) continue;
        let targetScale = 0.001;
        if (v.isBonus) {
          targetScale = v.ripe ? 1.12 : 0.001;
        } else if (p.id === 'carrot') {
          targetScale = 0.28 + p.growth * 0.82;
        } else {
          targetScale = p.growth > 0.55 ? 0.15 + ((p.growth - 0.55) / 0.45) * 0.92 : 0.001;
        }
        v.growScale += (targetScale - v.growScale) * Math.min(1, dt * 7);
        const pulse = v.ripe ? 1 + Math.sin(time * 4.2 + v.phase) * 0.05 : 1;
        v.mesh.scale.setScalar(v.growScale * pulse);

        if (p.id === 'carrot') {
          // Carrots push up slightly when plump and ripe!
          const popUp = v.ripe ? 0.12 + Math.sin(time * 3.5 + v.phase) * 0.02 : 0;
          v.mesh.position.y = v.basePos.y + popUp;
          v.mesh.rotation.z = wobRot * 1.4;
        } else {
          v.mesh.rotation.z = Math.sin(time * 2.4 + v.phase) * (v.ripe ? 0.09 : 0.03) + wobRot;
        }
      }
    }

    // 5. Flying veggies arcing gracefully into basket
    for (let i = this.flyingVeggies.length - 1; i >= 0; i--) {
      const f = this.flyingVeggies[i];
      f.t += dt / f.duration;
      if (f.t >= 1) {
        this.flyingVeggies.splice(i, 1);
        this._onVeggieLandedInBasket(f);
      } else {
        const u = f.t;
        const arcY = Math.sin(u * Math.PI) * 2.4;
        f.mesh.position.lerpVectors(f.start, f.target, u);
        f.mesh.position.y += arcY;
        f.mesh.rotation.x += dt * 5;
        f.mesh.rotation.y += dt * 4;
      }
    }

    // 6. Basket bounce & handle lift when ready for kitchen!
    if (this.basketBounce > 0) {
      this.basketBounce = Math.max(0, this.basketBounce - dt * 3.5);
    }
    const bHop = Math.sin(this.basketBounce * Math.PI) * 0.25;
    const readyHop =
      this.harvestedItems.length >= 3
        ? Math.abs(Math.sin(time * 3.4)) * 0.09
        : 0;
    this.basket.position.y = bHop + readyHop;
    const handleTarget = this.harvestedItems.length >= 3 ? 0 : -Math.PI * 0.44;
    this.basketHandle.rotation.x += (handleTarget - this.basketHandle.rotation.x) * Math.min(1, dt * 6);
  }
}
