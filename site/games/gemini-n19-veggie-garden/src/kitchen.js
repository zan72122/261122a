import * as THREE from '../lib/three.module.js';
import { VoxelBuilder } from './voxel.js';
import {
  createWholeTomato,
  createWholeCucumber,
  createWholeCarrot,
  createVeggieSlice,
} from './veggies.js';

/**
 * Sunlit 3D Voxel Kitchen Counter:
 * - Deep white ceramic voxel sink with rising & OVERFLOWING voxel water + bubbles
 * - Chrome faucet with big red/blue tactile lever handle
 * - Wooden end-grain cutting board & chunky toy knife (tap/swipe to chop into slices!)
 * - Large wooden salad bowl with physical tumbling slices + wooden fork & spoon servers
 * - 3 tactile dressing/topping bottles (golden oil, pink dressing, crouton shaker)
 * - Shiny brass service bell -> Grand Serving & Interactive Crunch-Eating Finale!
 * - Physical sunny balcony window / mini watering can to return outside for Round 2!
 */
export class KitchenScene {
  constructor(root, mats, particles, sound, callbacks) {
    this.root = root;
    this.mats = mats;
    this.particles = particles;
    this.sound = sound;
    this.callbacks = callbacks;

    this.group = new THREE.Group();
    // Kitchen sits directly behind the balcony patio door!
    this.group.position.set(0, 0, -12.0);
    this.root.add(this.group);

    this.hitTargets = [];
    this.faucetOn = false;
    this.waterLevel = 0.0; // 0..1 full, >1 overflowing!
    this.faucetEmitAccum = 0;
    this.overflowAccum = 0;
    this.drainTimer = 0;

    this.sinkVeggies = []; // { type, mesh, pos, vel, cleanProgress, isClean, phase }
    this.flyingItems = [];
    this.boardVeggie = null; // { type, mesh, chopsLeft, totalChops, wobble }
    this.knifeAnim = 0;

    this.saladPieces = []; // { type, mesh, pos, vel, rot, rotVel }
    this.tossEnergy = 0;
    this.tossSoundCooldown = 0;
    this.dressedCount = 0;
    this.tossedCount = 0;

    this.bottleAnims = []; // active bottle hop-pour animations
    this.bellBounce = 0;

    this.servingMode = false;
    this.eatingForkAnim = null;
    this.eatenAll = false;

    this.isSwishingSink = false;
    this.isTossingBowl = false;
    this.lastDragPt = new THREE.Vector3();
    this.idleTime = 0;

    this._buildRoomAndCounter();
    this._buildSink();
    this._buildCuttingBoard();
    this._buildSaladBowl();
    this._buildDressings();
    this._buildDinnerBell();
    this._buildReturnToGardenProp();
  }

  _buildRoomAndCounter() {
    const vb = new VoxelBuilder(0.4);
    // Warm cream floor
    vb.addBox(0, -0.15, 1.5, 14.0, 0.3, 12.0, 0xf2e4cc, 0.6);

    // Lower kitchen cabinet base (mint pastel wooden blocks) — CARVED cleanly around the recessed sink!
    // Left cabinet under x: -5.7 .. -3.82
    vb.addBox(-4.76, 0.46, 0, 1.88, 0.92, 3.6, 0xa8d8c8, 0.45);
    // Right cabinet under x: -0.88 .. +5.7
    vb.addBox(2.41, 0.46, 0, 6.58, 0.92, 3.6, 0xa8d8c8, 0.45);
    // Thin front apron panel directly in front of sink (z: 1.24 .. 1.80) so sink cavity is 100% open & deep!
    vb.addBox(-2.35, 0.46, 1.52, 2.94, 0.92, 0.56, 0xa8d8c8, 0.45);
    // Back cabinet panel behind sink (z: -1.80 .. -1.24)
    vb.addBox(-2.35, 0.46, -1.52, 2.94, 0.92, 0.56, 0xa8d8c8, 0.45);
    // Cabinet drawer panels on front (+Z)
    for (let i = -2; i <= 2; i++) {
      vb.addBox(i * 2.1, 0.48, 1.84, 1.85, 0.72, 0.10, 0xc0e8da, 0.4);
      vb.addBox(i * 2.1, 0.56, 1.92, 0.48, 0.12, 0.10, 0xd49a5d, 0);
    }

    // Countertop wooden surface (y = 1.0) — leave hole for sink at x ∈ [-3.75, -0.95], z ∈ [-1.05, 1.15]!
    const woodA = 0xe8c391;
    const woodB = 0xdfb47e;
    // Left edge of sink
    vb.addBox(-4.76, 0.98, 0.05, 2.02, 0.16, 3.9, woodA, 0.35);
    // Back strip behind sink
    vb.addBox(-2.35, 0.98, -1.48, 2.84, 0.16, 0.86, woodB, 0.35);
    // Front strip in front of sink
    vb.addBox(-2.35, 0.98, 1.58, 2.84, 0.16, 0.84, woodB, 0.35);
    // Right counter (cutting board + salad bowl area)
    vb.addBox(2.38, 0.98, 0.05, 6.66, 0.16, 3.9, woodA, 0.35);

    // Solid warm white backing BEHIND sky backdrop (z = -2.38) so window shows bright blue sky + cloud + tree!
    vb.addBox(0, 2.95, -2.38, 13.0, 4.1, 0.10, 0xf2f7f4, 0.6);

    // Kitchen Backsplash Wall (z = -1.95) with cheerful white & mint checkerboard tiles!
    for (let gx = -12; gx <= 12; gx++) {
      for (let gy = 0; gy < 7; gy++) {
        // Leave sunny window opening on left-center (gx: -9..-4, gy: 2..5)
        if (gx >= -9 && gx <= -4 && gy >= 2 && gy <= 5) continue;
        const isMint = (gx + gy) % 2 === 0;
        vb.addBox(
          gx * 0.48,
          1.28 + gy * 0.48,
          -1.98,
          0.48,
          0.48,
          0.20,
          isMint ? 0xfffdf7 : 0xdcf4eb,
          0
        );
      }
    }
    // Cute wooden spice riser ledge behind the salad bowl so all 3 dressing bottles stand proud & clear!
    vb.addBox(3.15, 1.24, -1.52, 3.05, 0.36, 0.72, 0xd49c62, 0.30);
    // Upper wall shelf on right side with cute decorative voxel jars
    vb.addBox(2.6, 3.65, -1.62, 4.4, 0.18, 0.65, 0xcf9458, 0.3);
    vb.addBox(1.2, 4.02, -1.62, 0.42, 0.54, 0.42, 0xffd166, 0.2);
    vb.addBox(1.85, 3.96, -1.62, 0.38, 0.44, 0.38, 0xff8fab, 0.2);
    vb.addBox(2.55, 4.05, -1.62, 0.44, 0.60, 0.44, 0x74c69d, 0.2);
    vb.addBox(3.45, 3.95, -1.62, 0.62, 0.42, 0.44, 0xfff3d6, 0.2);

    // Sunny kitchen window frame (x ≈ -3.1, y ≈ 3.1, z = -1.95)
    vb.addBox(-3.12, 4.18, -1.92, 3.12, 0.22, 0.32, 0xcf9458, 0.3);
    vb.addBox(-3.12, 2.02, -1.92, 3.12, 0.22, 0.32, 0xcf9458, 0.3);
    vb.addBox(-4.60, 3.10, -1.92, 0.22, 2.38, 0.32, 0xcf9458, 0.3);
    vb.addBox(-1.64, 3.10, -1.92, 0.22, 2.38, 0.32, 0xcf9458, 0.3);
    // Sky backdrop outside kitchen window
    vb.addBox(-3.12, 3.10, -2.28, 3.1, 2.2, 0.12, 0x87d4fa, 0.6);
    vb.addBox(-3.55, 3.45, -2.18, 0.9, 0.36, 0.12, 0xffffff, 0.3);
    vb.addBox(-2.45, 2.75, -2.18, 0.9, 0.65, 0.12, 0x5cc450, 0.3);

    this.group.add(vb.buildMesh(this.mats.matte, true, true));
  }

  _buildSink() {
    this.sinkCenter = new THREE.Vector3(-2.35, 1.0, 0.05);
    const sg = new THREE.Group();
    sg.position.set(-2.35, 0, 0.05);
    this.group.add(sg);

    // Crisp white ceramic voxel sink basin
    const vb = new VoxelBuilder(0.24);
    const white = 0xffffff;
    const shade = 0xedf2f7;
    // Bottom of sink (y = 0.14)
    vb.addBox(0, 0.12, 0, 2.76, 0.16, 2.16, shade, 0.28);
    // Inner walls
    vb.addBox(0, 0.58, -1.04, 2.76, 0.92, 0.14, white, 0.26);
    vb.addBox(0, 0.58, 1.04, 2.76, 0.92, 0.14, white, 0.26);
    vb.addBox(-1.34, 0.58, 0, 0.14, 0.92, 2.16, white, 0.26);
    vb.addBox(1.34, 0.58, 0, 0.14, 0.92, 2.16, white, 0.26);
    // Chunky raised ceramic rim
    vb.addBox(0, 1.08, -1.08, 3.04, 0.14, 0.22, white, 0.24);
    vb.addBox(0, 1.08, 1.08, 3.04, 0.14, 0.22, white, 0.24);
    vb.addBox(-1.42, 1.08, 0, 0.22, 0.14, 2.26, white, 0.24);
    vb.addBox(1.42, 1.08, 0, 0.22, 0.14, 2.26, white, 0.24);
    sg.add(vb.buildMesh(this.mats.gloss, true, true));

    // Dark rubber drain plug at bottom of sink!
    const pv = new VoxelBuilder(0.1);
    pv.addBox(0, 0.22, 0, 0.34, 0.08, 0.34, 0x495057, 0);
    pv.addBox(0, 0.29, 0, 0.12, 0.10, 0.12, 0xdbe4eb, 0);
    this.drainPlug = pv.buildMesh(this.mats.metal, false, true);
    sg.add(this.drainPlug);

    // Curved shiny chrome voxel faucet!
    const fv = new VoxelBuilder(0.14);
    const chrome = 0xdbe6f0;
    const chromeDark = 0xb5c6d6;
    fv.addBox(0, 1.18, -1.32, 0.42, 0.22, 0.36, chromeDark, 0.16);
    fv.addBox(0, 1.72, -1.32, 0.22, 0.96, 0.22, chrome, 0.16);
    fv.addBox(0, 2.26, -1.04, 0.22, 0.22, 0.78, chrome, 0.16);
    fv.addBox(0, 2.04, -0.70, 0.24, 0.34, 0.24, chromeDark, 0.14);
    sg.add(fv.buildMesh(this.mats.metal, true, true));

    // BIG colorful tactile faucet lever handle! (coral-red top knob + white/sky bar)
    this.faucetLever = new THREE.Group();
    this.faucetLever.position.set(0.32, 1.36, -1.32);
    const lv = new VoxelBuilder(0.12);
    lv.addBox(0.18, 0.08, 0, 0.46, 0.16, 0.18, 0xff5964, 0.14);
    lv.addBox(0.38, 0.14, 0, 0.22, 0.24, 0.24, 0xffca3a, 0);
    this.faucetLever.add(lv.buildMesh(this.mats.gloss, true, false));
    sg.add(this.faucetLever);

    // Rising voxel water volume inside sink!
    this.sinkWaterMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.50, 0.88, 1.90),
      this.mats.water
    );
    this.sinkWaterMesh.position.set(0, 0.22, 0);
    this.sinkWaterMesh.scale.y = 0.001;
    this.sinkWaterMesh.visible = false;
    sg.add(this.sinkWaterMesh);

    // Faucet touch hitbox (super generous — covers lever AND faucet arch!)
    const faucetHit = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 1.55, 1.25),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    faucetHit.position.set(0.15, 1.75, -1.10);
    faucetHit.userData = { action: 'toggleFaucet' };
    sg.add(faucetHit);
    this.hitTargets.push(faucetHit);

    // Sink water swish / wash hitbox
    const sinkHit = new THREE.Mesh(
      new THREE.BoxGeometry(2.75, 1.15, 2.1),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    sinkHit.position.set(0, 0.65, 0);
    sinkHit.userData = { action: 'swishSink' };
    sg.add(sinkHit);
    this.hitTargets.push(sinkHit);

    // Veggie container inside sink
    this.sinkVeggieGroup = new THREE.Group();
    sg.add(this.sinkVeggieGroup);
    this.sinkGroup = sg;
  }

  _buildCuttingBoard() {
    this.boardCenter = new THREE.Vector3(0.75, 1.16, 0.22);
    const bg = new THREE.Group();
    bg.position.set(0.75, 1.06, 0.22);
    this.group.add(bg);

    // Warm checkered end-grain wooden voxel cutting board!
    const vb = new VoxelBuilder(0.28);
    vb.addBox(0, 0.08, 0, 1.98, 0.16, 1.72, 0xdca468, 0.32);
    vb.addBox(0, 0.165, 0, 1.76, 0.03, 1.50, 0xebc086, 0.30);
    // Cute side handle cutout rim
    vb.addBox(0, 0.08, -0.96, 0.68, 0.16, 0.24, 0xc78d52, 0.24);
    bg.add(vb.buildMesh(this.mats.matte, true, true));

    // Safe chunky wooden voxel toy knife resting beside board!
    this.knife = new THREE.Group();
    this.knifeHome = new THREE.Vector3(0.72, 0.26, 0.12);
    this.knife.position.copy(this.knifeHome);
    const kv = new VoxelBuilder(0.12);
    // Mint-pastel handle
    kv.addBox(0, 0.04, 0.56, 0.18, 0.20, 0.56, 0x4cc9b0, 0.16);
    kv.addBox(0, 0.04, 0.86, 0.20, 0.22, 0.10, 0xffe066, 0);
    // Rounded chunky light silver/wood voxel blade
    kv.addBox(0, 0.04, -0.14, 0.10, 0.34, 0.88, 0xe9eff5, 0.18);
    kv.addBox(0, 0.10, -0.62, 0.10, 0.22, 0.16, 0xe9eff5, 0);
    this.knife.add(kv.buildMesh(this.mats.gloss, true, true));
    bg.add(this.knife);

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 1.1, 1.9),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.set(0, 0.45, 0);
    hit.userData = { action: 'tapBoard' };
    bg.add(hit);
    this.hitTargets.push(hit);

    this.boardGroup = bg;
  }

  _buildSaladBowl() {
    this.bowlCenter = new THREE.Vector3(3.30, 1.08, 0.22);
    const sg = new THREE.Group();
    sg.position.set(3.30, 1.06, 0.22);
    this.group.add(sg);

    // Cheerful pastel pink/cream checkered voxel placemat underneath the bowl!
    const pm = new VoxelBuilder(0.32);
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        const col = (x + z) % 2 === 0 ? 0xffd6e0 : 0xfff8eb;
        pm.addBox(x * 0.34, 0.02, z * 0.32, 0.33, 0.04, 0.31, col, 0);
      }
    }
    sg.add(pm.buildMesh(this.mats.matte, false, true));

    // Large chunky stepped wooden voxel salad bowl (sleek wide hollow bowl so colorful salad heaps proudly!)
    const bv = new VoxelBuilder(0.22);
    const wDark = 0xa86434;
    const wMid = 0xc47d47;
    const wRim = 0xde995f;
    // Base
    bv.addBox(0, 0.14, 0, 1.62, 0.20, 1.62, wDark, 0.26);
    // Lower ring walls (slightly lower & wider so colorful veggies pop right over the rim!)
    const wallPts = [
      [0, 0.36, 0.92, 1.36, 0.36, 0.20],
      [0, 0.36, -0.92, 1.36, 0.36, 0.20],
      [0.92, 0.36, 0, 0.20, 0.36, 1.36],
      [-0.92, 0.36, 0, 0.20, 0.36, 1.36],
      [0.72, 0.36, 0.72, 0.38, 0.36, 0.38],
      [-0.72, 0.36, 0.72, 0.38, 0.36, 0.38],
      [0.72, 0.36, -0.72, 0.38, 0.36, 0.38],
      [-0.72, 0.36, -0.72, 0.38, 0.36, 0.38],
    ];
    wallPts.forEach(([x, y, z, sx, sy, sz]) => {
      bv.addBox(x, y, z, sx, sy, sz, wMid, 0.24);
      bv.addBox(x * 1.07, 0.60, z * 1.07, sx * 1.05, 0.16, sz * 1.05, wRim, 0.24);
    });
    sg.add(bv.buildMesh(this.mats.matte, true, true));

    // Wooden Voxel Salad Servers (Fork & Spoon — appear once veggies enter bowl!)
    this.serversGroup = new THREE.Group();
    this.serversGroup.visible = false;
    // Wooden Spoon
    const sp = new VoxelBuilder(0.10);
    sp.addBox(0, 0.45, 0, 0.12, 1.05, 0.10, 0xebc188, 0.14);
    sp.addBox(0, -0.10, 0, 0.34, 0.36, 0.10, 0xdfa968, 0.14);
    this.spoon = sp.buildMesh(this.mats.matte, true, false);
    this.spoon.position.set(-0.62, 0.78, -0.22);
    this.spoon.rotation.set(0.25, 0.2, 0.42);
    this.serversGroup.add(this.spoon);

    // Wooden Fork
    const fk = new VoxelBuilder(0.10);
    fk.addBox(0, 0.45, 0, 0.12, 1.05, 0.10, 0xebc188, 0.14);
    fk.addBox(0, -0.02, 0, 0.34, 0.16, 0.10, 0xdfa968, 0.12);
    fk.addBox(-0.12, -0.20, 0, 0.08, 0.24, 0.08, 0xdfa968, 0);
    fk.addBox(0, -0.20, 0, 0.08, 0.24, 0.08, 0xdfa968, 0);
    fk.addBox(0.12, -0.20, 0, 0.08, 0.24, 0.08, 0xdfa968, 0);
    this.fork = fk.buildMesh(this.mats.matte, true, false);
    this.fork.position.set(0.62, 0.78, -0.22);
    this.fork.rotation.set(0.25, -0.2, -0.42);
    this.serversGroup.add(this.fork);
    sg.add(this.serversGroup);

    // Eating fork (for the celebratory eating finale!)
    const ef = new VoxelBuilder(0.10);
    ef.addBox(0, 0.72, 0, 0.14, 1.25, 0.12, 0xff758f, 0.16);
    ef.addBox(0, 0.04, 0, 0.38, 0.16, 0.10, 0xe8eff5, 0.12);
    ef.addBox(-0.13, -0.18, 0, 0.08, 0.30, 0.08, 0xe8eff5, 0);
    ef.addBox(0, -0.18, 0, 0.08, 0.30, 0.08, 0xe8eff5, 0);
    ef.addBox(0.13, -0.18, 0, 0.08, 0.30, 0.08, 0xe8eff5, 0);
    this.eatingFork = ef.buildMesh(this.mats.gloss, true, false);
    this.eatingFork.visible = false;
    sg.add(this.eatingFork);

    // Salad pieces container inside bowl
    this.saladGroup = new THREE.Group();
    sg.add(this.saladGroup);

    // Generous hitbox for tossing / eating salad!
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(2.55, 1.55, 2.45),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.set(0, 0.65, 0);
    hit.userData = { action: 'bowlInteract' };
    sg.add(hit);
    this.hitTargets.push(hit);

    this.bowlGroup = sg;
  }

  _buildDressings() {
    this.bottles = [];
    const defs = [
      { id: 'oil', x: 2.15, z: -1.50, body: 0xffd43b, cap: 0x3da844, dropColor: 0xffe055 },
      { id: 'pink', x: 3.15, z: -1.50, body: 0xff8fab, cap: 0xffffff, dropColor: 0xffb3c6 },
      { id: 'crouton', x: 4.15, z: -1.50, body: 0xe6b365, cap: 0xc97b38, dropColor: 0xf2c97d },
    ];

    defs.forEach((d) => {
      const g = new THREE.Group();
      const home = new THREE.Vector3(d.x, 1.42, d.z);
      g.position.copy(home);

      const vb = new VoxelBuilder(0.12);
      if (d.id === 'crouton') {
        // Chunky voxel crouton shaker jar!
        vb.addBox(0, 0.36, 0, 0.50, 0.64, 0.50, 0xfff5e4, 0.16);
        vb.addBox(0, 0.30, 0, 0.40, 0.42, 0.40, d.body, 0.14);
        vb.addBox(0, 0.74, 0, 0.54, 0.16, 0.54, d.cap, 0.14);
      } else {
        // Chunky squeeze dressing bottle!
        vb.addBox(0, 0.36, 0, 0.46, 0.68, 0.46, d.body, 0.16);
        vb.addBox(0, 0.76, 0, 0.30, 0.16, 0.30, d.cap, 0.12);
        vb.addBox(0, 0.92, 0, 0.14, 0.20, 0.14, d.cap, 0);
        // Cute contrasting label stripe (pure color block, zero text!)
        vb.addBox(0, 0.36, 0.24, 0.32, 0.22, 0.04, 0xffffff, 0);
      }
      g.add(vb.buildMesh(this.mats.gloss, true, true));

      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 1.25, 0.85),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.set(0, 0.55, 0);
      const entry = { ...d, group: g, home, animT: -1 };
      hit.userData = { action: 'useBottle', bottle: entry };
      g.add(hit);
      this.hitTargets.push(hit);

      this.group.add(g);
      this.bottles.push(entry);
    });
  }

  _buildDinnerBell() {
    const g = new THREE.Group();
    g.position.set(0.75, 1.06, -1.28);

    const vb = new VoxelBuilder(0.12);
    // Dark wood base + gleaming gold voxel dome + red push-button!
    vb.addBox(0, 0.06, 0, 0.74, 0.12, 0.74, 0x5c3d28, 0.16);
    vb.addBox(0, 0.24, 0, 0.62, 0.26, 0.62, 0xffca3a, 0.16);
    vb.addBox(0, 0.42, 0, 0.44, 0.14, 0.44, 0xffd95a, 0.14);
    vb.addBox(0, 0.54, 0, 0.18, 0.12, 0.18, 0xeb3b46, 0);
    g.add(vb.buildMesh(this.mats.metal, true, true));

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.95, 1.05),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.set(0, 0.35, 0);
    hit.userData = { action: 'ringBell' };
    g.add(hit);
    this.hitTargets.push(hit);

    this.group.add(g);
    this.bell = g;
  }

  _buildReturnToGardenProp() {
    // Physical sunny miniature voxel watering can on the left counter / windowsill
    // Tap anytime to glide right back out to the balcony for another harvest!
    const g = new THREE.Group();
    g.position.set(-4.58, 1.06, -0.65);

    const vb = new VoxelBuilder(0.10);
    vb.addBox(0, 0.24, 0, 0.54, 0.44, 0.46, 0x35b8f2, 0.14);
    vb.addBox(0, 0.48, 0, 0.58, 0.08, 0.50, 0xffd43b, 0.14);
    vb.addBox(0.36, 0.28, 0, 0.22, 0.32, 0.14, 0xffd43b, 0.12);
    vb.addBox(-0.42, 0.32, 0, 0.36, 0.14, 0.14, 0x35b8f2, 0.12);
    vb.addBox(-0.62, 0.40, 0, 0.14, 0.24, 0.24, 0xffd43b, 0);
    // Cute little green sprout standing beside it on a coaster!
    vb.addBox(0.0, 0.04, 0.58, 0.42, 0.08, 0.42, 0xd46f4d, 0.14);
    vb.addBox(0.0, 0.22, 0.58, 0.08, 0.32, 0.08, 0x3bb538, 0);
    vb.addBox(-0.12, 0.36, 0.58, 0.20, 0.12, 0.14, 0x56d64b, 0);
    vb.addBox(0.12, 0.40, 0.58, 0.20, 0.12, 0.14, 0x45bf3b, 0);
    g.add(vb.buildMesh(this.mats.gloss, true, true));

    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 1.25, 1.35),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.set(-0.05, 0.45, 0.15);
    hit.userData = { action: 'backToBalcony' };
    g.add(hit);
    this.hitTargets.push(hit);

    this.group.add(g);
    this.returnProp = g;
    this.returnPropHome = g.position.clone();
  }

  /**
   * Populate the kitchen sink with the exact veggies harvested from the balcony!
   */
  loadHarvest(types) {
    this.clearKitchen();
    this.servingMode = false;
    this.eatenAll = false;
    this.returnProp.position.copy(this.returnPropHome);
    this.returnProp.scale.setScalar(1.0);

    const list = types && types.length > 0 ? types : ['tomato', 'cucumber', 'carrot'];
    list.forEach((type, idx) => {
      let mesh;
      if (type === 'tomato' || type === 'goldTomato') {
        mesh = createWholeTomato(this.mats, { golden: type === 'goldTomato', withDirt: true });
      } else if (type === 'cucumber' || type === 'starCucumber') {
        mesh = createWholeCucumber(this.mats, { star: type === 'starCucumber', withDirt: true });
      } else {
        mesh = createWholeCarrot(this.mats, { rainbow: type === 'rainbowCarrot', withDirt: true });
      }

      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const bx = -0.68 + col * 0.68 + (Math.random() - 0.5) * 0.16;
      const bz = -0.45 + (row % 2) * 0.80 + (Math.random() - 0.5) * 0.18;

      mesh.position.set(bx, 1.9 + idx * 0.35, bz);
      mesh.rotation.set(
        (Math.random() - 0.5) * 0.6,
        Math.random() * Math.PI * 2,
        Math.PI * 0.45 + (Math.random() - 0.5) * 0.4
      );
      this.sinkVeggieGroup.add(mesh);

      // Generous invisible hitbox on each sink veggie
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.85, 0.72),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      const item = {
        type,
        mesh,
        hit,
        pos: mesh.position.clone(),
        vel: new THREE.Vector3(0, -1.5, 0),
        cleanProgress: 0,
        isClean: false,
        phase: idx * 1.15,
        inSink: true,
      };
      hit.userData = { action: 'tapSinkVeggie', item };
      mesh.add(hit);
      this.hitTargets.push(hit);
      this.sinkVeggies.push(item);

      setTimeout(() => this.sound.playMarimba(idx % 6, 0.22, 0.16), idx * 90);
    });
  }

  clearKitchen() {
    this.faucetOn = false;
    this.waterLevel = 0;
    this.dressedCount = 0;
    this.tossedCount = 0;
    this.tossEnergy = 0;
    this.serversGroup.visible = false;
    this.eatingFork.visible = false;
    this.eatingForkAnim = null;

    // Remove old veggie hitboxes
    this.hitTargets = this.hitTargets.filter(
      (h) => h.userData.action !== 'tapSinkVeggie'
    );

    while (this.sinkVeggieGroup.children.length > 0) {
      this.sinkVeggieGroup.remove(this.sinkVeggieGroup.children[0]);
    }
    this.sinkVeggies = [];

    if (this.boardVeggie) {
      this.boardGroup.remove(this.boardVeggie.mesh);
      this.boardVeggie = null;
    }

    while (this.saladGroup.children.length > 0) {
      this.saladGroup.remove(this.saladGroup.children[0]);
    }
    this.saladPieces = [];

    for (const f of this.flyingItems) {
      this.group.remove(f.mesh);
    }
    this.flyingItems = [];
  }

  getHitTargets() {
    return this.hitTargets;
  }

  onPointerDown(hitObj, raycaster) {
    this.idleTime = 0;
    if (!hitObj) return false;
    const act = hitObj.userData.action;

    if (act === 'backToBalcony') {
      this.sound.playMarimba(5, 0.28, 0.24);
      this.faucetOn = false;
      this.sound.setWaterStream(false);
      this.callbacks.onReturnToBalcony();
      return true;
    }

    // In serving mode, tapping the salad bowl eats a joyful crunchy bite!
    if (this.servingMode) {
      if (act === 'bowlInteract') {
        this._eatOneBite();
        return true;
      }
      if (act === 'ringBell') {
        this.bellBounce = 1.0;
        this.sound.playBell();
        this.particles.emitSparkles(this.bowlCenter.x, 2.2, this.bowlCenter.z - 12, 16);
        return true;
      }
      if (act === 'useBottle') {
        this._triggerBottle(hitObj.userData.bottle);
        return true;
      }
      // Tapping outside or faucet exits zoom gently back to full counter!
      this.servingMode = false;
      this.returnProp.position.copy(this.returnPropHome);
      this.callbacks.onServingModeChanged(false);
      return true;
    }

    if (act === 'toggleFaucet') {
      this.faucetOn = !this.faucetOn;
      this.sound.playMarimba(this.faucetOn ? 6 : 2, 0.26, 0.16);
      if (this.faucetOn) this.sound.playSplash(0.8);
      return true;
    }

    if (act === 'tapSinkVeggie') {
      const item = hitObj.userData.item;
      if (!item || !item.inSink) return false;
      if (item.isClean) {
        this._sendCleanVeggieToBoardOrBowl(item);
        return true;
      }
      // Not clean yet!
      if (this.waterLevel > 0.14 || this.faucetOn) {
        this.isSwishingSink = true;
        this._scrubVeggie(item, 0.42);
      } else {
        // Sink is dry -> wiggle veggie & jiggle faucet lever to invite turning on water!
        item.vel.y = 2.0;
        this.faucetInvite = 1.0;
        this.sound.playMarimba(1, 0.18, 0.12);
      }
      return true;
    }

    if (act === 'swishSink') {
      this.isSwishingSink = true;
      if (this.waterLevel > 0.12 || this.faucetOn) {
        this._swishWaterAtRay(raycaster, true);
      } else {
        // Tapping dry sink invites turning on faucet!
        this.faucetInvite = 1.0;
        this.sound.playMarimba(1, 0.18, 0.12);
      }
      return true;
    }

    if (act === 'tapBoard') {
      if (this.boardVeggie) {
        this._chopBoardVeggie();
        return true;
      }
      // If board is empty and there's a clean veggie in the sink, hop it right onto the board!
      const cleanOne = this.sinkVeggies.find((v) => v.inSink && v.isClean);
      if (cleanOne) {
        this._sendCleanVeggieToBoardOrBowl(cleanOne);
        return true;
      }
      // Empty cutting board wood tap!
      this.sound.playChop(0);
      this.knifeAnim = 1.0;
      return true;
    }

    if (act === 'useBottle') {
      this._triggerBottle(hitObj.userData.bottle);
      return true;
    }

    if (act === 'bowlInteract') {
      if (this.saladPieces.length > 0) {
        this.isTossingBowl = true;
        this._recordDragPt(raycaster);
        this._tossSalad(1.0);
        return true;
      }
      // If bowl is empty & a clean veggie is ready, hop it onto cutting board!
      const cleanOne = this.sinkVeggies.find((v) => v.inSink && v.isClean);
      if (cleanOne) {
        this._sendCleanVeggieToBoardOrBowl(cleanOne);
        return true;
      }
      this.sound.playBasketThud(2);
      return true;
    }

    if (act === 'ringBell') {
      this.bellBounce = 1.0;
      this.sound.playBell();
      if (this.saladPieces.length > 0) {
        this._enterServingFinale();
      } else {
        this.particles.emitSparkles(0.75, 1.8, -13.28, 8);
      }
      return true;
    }

    return false;
  }

  onPointerMove(raycaster) {
    this.idleTime = 0;
    if (this.isSwishingSink) {
      if (this.waterLevel > 0.12 || this.faucetOn) {
        this._swishWaterAtRay(raycaster, false);
      }
      return true;
    }
    if (this.isTossingBowl && this.saladPieces.length > 0) {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.6);
      const pt = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, pt)) {
        const dist = pt.distanceTo(this.lastDragPt);
        if (dist > 0.18) {
          this.lastDragPt.copy(pt);
          this._tossSalad(Math.min(1.6, dist * 1.8));
        }
      }
      return true;
    }
    return false;
  }

  onPointerUp() {
    this.isSwishingSink = false;
    this.isTossingBowl = false;
  }

  _recordDragPt(raycaster) {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.6);
    raycaster.ray.intersectPlane(plane, this.lastDragPt);
  }

  _swishWaterAtRay(raycaster, isDown) {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(0.45 + this.waterLevel * 0.65));
    const pt = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, pt)) return;

    // Local coordinates inside sinkGroup (sinkCenter world is (-2.35, 0, -11.95))
    const lx = THREE.MathUtils.clamp(pt.x - (-2.35), -1.15, 1.15);
    const lz = THREE.MathUtils.clamp(pt.z - (-11.95), -0.85, 0.85);

    if (isDown || Math.random() < 0.45) {
      this.particles.emitWaterSplash(-2.35 + lx, 0.35 + this.waterLevel * 0.72, -11.95 + lz, isDown ? 8 : 3, 1.08, 1.8);
      if (Math.random() < 0.35) {
        this.particles.emitBubbles(-2.35 + lx, 0.42 + this.waterLevel * 0.72, -11.95 + lz, 2);
      }
    }
    if (isDown) {
      this.sound.playSplash(0.9);
    }

    // Swish boosts nearby veggies & cleans them!
    for (const v of this.sinkVeggies) {
      if (!v.inSink) continue;
      const d = Math.hypot(v.pos.x - lx, v.pos.z - lz);
      if (d < 1.35) {
        v.vel.y = Math.max(v.vel.y, 1.6);
        v.vel.x += (v.pos.x - lx) * 1.4;
        v.vel.z += (v.pos.z - lz) * 1.4;
        if (!v.isClean) {
          this._scrubVeggie(v, isDown ? 0.34 : 0.14);
        }
      }
    }
  }

  _scrubVeggie(item, amount) {
    if (item.isClean) return;
    item.cleanProgress = Math.min(1, item.cleanProgress + amount);
    item.vel.y = Math.max(item.vel.y, 1.8);

    // Knock visible dirt voxel particles flying off!
    const wp = new THREE.Vector3();
    item.mesh.getWorldPosition(wp);
    this.particles.emitDirtBurst(wp.x, wp.y + 0.15, wp.z, 5, 1.08);
    this.particles.emitBubbles(wp.x, wp.y + 0.25, wp.z, 3);
    this.sound.playBubblePop();

    if (item.mesh.userData.dirtGroup) {
      item.mesh.userData.dirtGroup.scale.setScalar(Math.max(0.001, 1 - item.cleanProgress));
    }

    if (item.cleanProgress >= 1) {
      item.isClean = true;
      if (item.mesh.userData.dirtGroup) {
        item.mesh.userData.dirtGroup.visible = false;
      }
      item.vel.y = 3.2;
      this.sound.playSparkleClean();
      this.particles.emitSparkles(wp.x, wp.y + 0.3, wp.z, 14, [0xffffff, 0x7ef7ff, 0xffe066]);
    }
  }

  _sendCleanVeggieToBoardOrBowl(item) {
    item.inSink = false;
    // Remove its sink hitbox
    const idx = this.hitTargets.indexOf(item.hit);
    if (idx >= 0) this.hitTargets.splice(idx, 1);

    const startWorld = new THREE.Vector3();
    item.mesh.getWorldPosition(startWorld);
    this.sinkVeggieGroup.remove(item.mesh);

    // Convert to kitchen group local coords
    const startLocal = startWorld.clone().sub(this.group.position);
    item.mesh.position.copy(startLocal);
    this.group.add(item.mesh);

    this.sound.playPop(1.15);
    this.particles.emitWaterSplash(startWorld.x, startWorld.y, startWorld.z, 7, 1.08, 1.6);

    if (!this.boardVeggie) {
      // Reserve cutting board right away
      const chops = item.type === 'tomato' || item.type === 'goldTomato' ? 2 : 3;
      this.boardVeggie = {
        type: item.type,
        mesh: item.mesh,
        chopsLeft: chops,
        totalChops: chops,
        wobble: 0,
        arriving: true,
      };

      const targetLocal = new THREE.Vector3(0.65, 1.44, 0.22);
      this.flyingItems.push({
        mesh: item.mesh,
        start: startLocal,
        target: targetLocal,
        t: 0,
        duration: 0.44,
        onArrive: () => {
          this.group.remove(item.mesh);
          item.mesh.position.set(-0.08, 0.36, 0);
          item.mesh.rotation.set(0, 0, Math.PI * 0.5);
          item.mesh.scale.setScalar(1.08);
          this.boardGroup.add(item.mesh);
          if (this.boardVeggie && this.boardVeggie.mesh === item.mesh) {
            this.boardVeggie.arriving = false;
            this.boardVeggie.wobble = 0.8;
          }
          this.sound.playMarimba(4, 0.24, 0.16);
        },
      });
    } else {
      // Board already occupied -> bounce whole/pre-sliced cheerfully into salad bowl!
      this.group.remove(item.mesh);
      this._spawnSlicesToBowl(item.type, startLocal);
    }
  }

  _chopBoardVeggie() {
    const bv = this.boardVeggie;
    if (!bv || bv.arriving) return;

    this.knifeAnim = 1.0;
    bv.chopsLeft--;
    bv.wobble = 1.0;
    this.sound.playChop(bv.totalChops - bv.chopsLeft);

    const wp = new THREE.Vector3(0.75, 1.48, -11.78);
    const sparkColor =
      bv.type === 'tomato' || bv.type === 'goldTomato'
        ? [0xff6b6b, 0xffe066, 0xffffff]
        : bv.type === 'carrot' || bv.type === 'rainbowCarrot'
          ? [0xff922b, 0xffd43b, 0xffffff]
          : [0x69db7c, 0xcaf7bd, 0xffffff];
    this.particles.emitSparkles(wp.x, wp.y, wp.z, 7, sparkColor);

    if (bv.chopsLeft > 0) {
      // Visually shorten slightly & pop one slice straight into the salad bowl!
      bv.mesh.scale.y *= 0.78;
      this._spawnSingleSliceToBowl(bv.type, new THREE.Vector3(0.75, 1.46, 0.22));
    } else {
      // Final chop! Remaining slices bounce joyfully into the salad bowl!
      this.boardGroup.remove(bv.mesh);
      const count = bv.type === 'tomato' || bv.type === 'goldTomato' ? 1 : 2;
      for (let i = 0; i < count; i++) {
        this._spawnSingleSliceToBowl(
          bv.type,
          new THREE.Vector3(0.75 + (i - 0.5) * 0.2, 1.46, 0.22)
        );
      }
      this.boardVeggie = null;
      this.sound.playMarimba(6, 0.28, 0.22);

      // If another clean veggie is waiting in the sink, gently bounce it to invite next!
      const nextClean = this.sinkVeggies.find((v) => v.inSink && v.isClean);
      if (nextClean) {
        nextClean.vel.y = 2.6;
      }
    }
  }

  _spawnSlicesToBowl(type, originLocal) {
    const count = type === 'tomato' || type === 'goldTomato' ? 2 : 3;
    for (let i = 0; i < count; i++) {
      this._spawnSingleSliceToBowl(type, originLocal);
    }
  }

  _spawnSingleSliceToBowl(type, startLocal) {
    const slice = createVeggieSlice(type, this.mats);
    slice.position.copy(startLocal);
    this.group.add(slice);

    const rx = (Math.random() - 0.5) * 0.95;
    const rz = (Math.random() - 0.5) * 0.95;
    const targetLocal = new THREE.Vector3(3.30 + rx, 1.52 + Math.min(0.45, this.saladPieces.length * 0.025), 0.22 + rz);

    this.flyingItems.push({
      mesh: slice,
      start: startLocal.clone(),
      target: targetLocal,
      t: 0,
      duration: 0.36 + Math.random() * 0.14,
      onArrive: () => {
        this.group.remove(slice);
        slice.position.set(rx, 0.42 + Math.min(0.48, this.saladPieces.length * 0.028), rz);
        slice.rotation.set(
          (Math.random() - 0.5) * 0.9,
          Math.random() * Math.PI * 2,
          (Math.random() - 0.5) * 0.9
        );
        this.saladGroup.add(slice);
        this.saladPieces.push({
          type,
          mesh: slice,
          pos: slice.position.clone(),
          vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.8, (Math.random() - 0.5) * 0.6),
          rot: slice.rotation.clone(),
          rotVel: new THREE.Vector3(0, 0, 0),
        });

        this.serversGroup.visible = true;
        this.sound.playMarimba(this.saladPieces.length % 8, 0.22, 0.18);
      },
    });
  }

  _triggerBottle(bottle) {
    if (bottle.animT >= 0) return;
    bottle.animT = 0;
    bottle.didPour = false;
    this.dressedCount++;
    if (bottle.id === 'crouton') {
      this.sound.playShaker();
    } else {
      this.sound.playSqueeze();
    }
  }

  _tossSalad(power = 1.0) {
    this.tossEnergy = Math.min(2.2, this.tossEnergy + power * 0.9);
    this.tossedCount++;

    if (this.tossSoundCooldown <= 0) {
      this.tossSoundCooldown = 0.18;
      this.sound.playToss();
      this.particles.emitSparkles(3.30, 2.05, -11.78, 6, [0xffe066, 0x8ce99a, 0xff8fab, 0xffffff]);
    }

    // Launch all voxel salad slices upward and swirl them tangibly!
    for (const p of this.saladPieces) {
      const ang = Math.atan2(p.pos.z, p.pos.x) + 1.1;
      p.vel.x += Math.cos(ang) * (1.2 + Math.random() * 1.1) * power;
      p.vel.z += Math.sin(ang) * (1.2 + Math.random() * 1.1) * power;
      p.vel.y = Math.max(p.vel.y, (2.2 + Math.random() * 2.2) * Math.min(1.3, power));
      p.rotVel.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );
    }
  }

  _enterServingFinale() {
    this.servingMode = true;
    this.faucetOn = false;
    this.sound.setWaterStream(false);
    this.sound.playFanfare();
    this.particles.emitConfetti(3.30, 2.4, -11.78, 48);

    // Move the mini sunny watering can cleanly to front-left beside the placemat (100% clear of cutting board!)
    this.returnProp.position.set(1.42, 1.06, 1.52);
    this.returnProp.scale.setScalar(0.88);
    this.callbacks.onServingModeChanged(true);
  }

  _eatOneBite() {
    if (this.eatingForkAnim) return;
    if (this.saladPieces.length === 0) {
      // Bowl is gleaming empty — happy sparkle burst & hop the return watering can!
      this.sound.playSparkleClean();
      this.particles.emitSparkles(3.30, 1.8, -11.78, 16);
      this.eatenAll = true;
      return;
    }

    // Scoop up to 3 top pieces onto the eating fork!
    const count = Math.min(3, this.saladPieces.length);
    const scooped = [];
    for (let i = 0; i < count; i++) {
      // Pick highest y pieces first
      let bestIdx = 0;
      for (let j = 1; j < this.saladPieces.length; j++) {
        if (this.saladPieces[j].pos.y > this.saladPieces[bestIdx].pos.y) bestIdx = j;
      }
      const p = this.saladPieces.splice(bestIdx, 1)[0];
      scooped.push(p);
    }

    this.eatingFork.visible = true;
    this.eatingForkAnim = {
      t: 0,
      scooped,
      crunched: false,
    };
  }

  update(dt, time, isActive) {
    if (!isActive) {
      this.sound.setWaterStream(false);
      return;
    }
    this.idleTime += dt;
    if (this.tossSoundCooldown > 0) this.tossSoundCooldown -= dt;

    // 1. Kitchen Faucet & Rising / Overflowing Voxel Water!
    if (this.faucetInvite > 0) {
      this.faucetInvite = Math.max(0, this.faucetInvite - dt * 2.5);
    }
    const inviteWobble = this.faucetInvite > 0 ? Math.sin(this.faucetInvite * Math.PI * 4) * 0.22 : 0;
    const leverTarget = this.faucetOn ? -0.55 : 0.1 + inviteWobble;
    this.faucetLever.rotation.z += (leverTarget - this.faucetLever.rotation.z) * Math.min(1, dt * 12);

    if (this.faucetOn) {
      this.waterLevel = Math.min(1.22, this.waterLevel + dt * 0.28);
      this.faucetEmitAccum += dt * 48;
      while (this.faucetEmitAccum >= 1) {
        this.faucetEmitAccum -= 1;
        this.particles.spawn({
          x: -2.35 + (Math.random() - 0.5) * 0.14,
          y: 1.88,
          z: -12.65 + (Math.random() - 0.5) * 0.14,
          vx: (Math.random() - 0.5) * 0.35,
          vy: -2.6,
          vz: (Math.random() - 0.5) * 0.35,
          size: 0.11 + Math.random() * 0.05,
          maxLife: 0.5,
          gravity: -15,
          floorY: 0.32 + Math.min(1, this.waterLevel) * 0.72,
          bounce: 0.3,
          bouncesLeft: 1,
          color: Math.random() > 0.35 ? 0x4fd2ff : 0x99ecff,
          kind: 'water',
        });
      }

      // Gentle auto-wash boost for veggies under the running water stream!
      for (const v of this.sinkVeggies) {
        if (v.inSink && !v.isClean && this.waterLevel > 0.2) {
          v.cleanProgress = Math.min(1, v.cleanProgress + dt * 0.24);
          if (v.mesh.userData.dirtGroup) {
            v.mesh.userData.dirtGroup.scale.setScalar(Math.max(0.001, 1 - v.cleanProgress));
          }
          if (v.cleanProgress >= 1) {
            this._scrubVeggie(v, 0.05);
          }
        }
      }

      // OVERFLOW delight when sink fills past brim!!
      if (this.waterLevel > 0.96) {
        this.overflowAccum += dt * 16;
        while (this.overflowAccum >= 1) {
          this.overflowAccum -= 1;
          const side = Math.floor(Math.random() * 4);
          const ox = side === 0 ? -3.72 : side === 1 ? -0.98 : -2.35 + (Math.random() - 0.5) * 2.4;
          const oz = side === 2 ? -10.88 : side === 3 ? -12.98 : -11.95 + (Math.random() - 0.5) * 1.8;
          this.particles.emitWaterSplash(ox, 1.15, oz, 2, 1.06, 1.5);
          if (Math.random() < 0.5) {
            this.particles.emitBubbles(ox, 1.22, oz, 2);
          }
        }
      }
    }

    // Render sink water level smoothly
    const clampedWater = Math.min(1.06, this.waterLevel);
    if (clampedWater > 0.01) {
      this.sinkWaterMesh.visible = true;
      this.sinkWaterMesh.scale.y = clampedWater;
      this.sinkWaterMesh.position.y = 0.20 + clampedWater * 0.44 + Math.sin(time * 4) * 0.012;
    } else {
      this.sinkWaterMesh.visible = false;
    }

    this.sound.setWaterStream(this.faucetOn, 1.0, 820 + this.waterLevel * 380);

    // 2. Buoyant physics for veggies inside the sink!
    const waterTopY = 0.20 + clampedWater * 0.86;
    for (const v of this.sinkVeggies) {
      if (!v.inSink) continue;

      if (this.waterLevel > 0.18) {
        // Float buoyantly on the rising voxel water!
        const targetY = Math.max(0.42, waterTopY + (v.isClean ? 0.08 : -0.02) + Math.sin(time * 3.4 + v.phase) * 0.05);
        v.vel.y += (targetY - v.pos.y) * 18 * dt;
        v.vel.y *= 1 - 5.5 * dt;
        v.mesh.rotation.y += dt * (v.isClean ? 1.1 : 0.4);
      } else {
        v.vel.y -= 14 * dt;
      }

      v.vel.x *= 1 - 4.0 * dt;
      v.vel.z *= 1 - 4.0 * dt;
      v.pos.addScaledVector(v.vel, dt);

      // Keep inside ceramic sink basin
      if (v.pos.y < 0.40) {
        v.pos.y = 0.40;
        if (v.vel.y < -0.5) v.vel.y = -v.vel.y * 0.25;
        else v.vel.y = 0;
      }
      v.pos.x = THREE.MathUtils.clamp(v.pos.x, -1.02, 1.02);
      v.pos.z = THREE.MathUtils.clamp(v.pos.z, -0.70, 0.72);
      v.mesh.position.copy(v.pos);

      // Gentle gleaming bob once clean so child notices it's ready to hop to the cutting board!
      if (v.isClean) {
        const s = 1.04 + Math.sin(time * 5 + v.phase) * 0.05;
        v.mesh.scale.setScalar(s);
      }
    }

    // 3. Cutting Board & Toy Knife chopping animation!
    if (this.knifeAnim > 0) {
      this.knifeAnim = Math.max(0, this.knifeAnim - dt * 5.2);
      const k = Math.sin(this.knifeAnim * Math.PI);
      this.knife.position.set(
        this.knifeHome.x - k * 0.76,
        this.knifeHome.y + Math.sin(this.knifeAnim * Math.PI * 2) * 0.28 + 0.12 * k,
        this.knifeHome.z
      );
      this.knife.rotation.x = -k * 0.45;
    } else {
      this.knife.position.lerp(this.knifeHome, Math.min(1, dt * 10));
      this.knife.rotation.x *= 0.85;
    }

    if (this.boardVeggie && !this.boardVeggie.arriving) {
      if (this.boardVeggie.wobble > 0) {
        this.boardVeggie.wobble = Math.max(0, this.boardVeggie.wobble - dt * 4);
      }
      const w = Math.sin(this.boardVeggie.wobble * Math.PI * 3) * this.boardVeggie.wobble * 0.16;
      this.boardVeggie.mesh.rotation.y = w;
    }

    // 4. Dressing Bottles & Crouton Shaker Animations!
    for (const b of this.bottles) {
      if (b.animT >= 0) {
        b.animT += dt * 1.15;
        const t = b.animT;
        const bowlTarget = new THREE.Vector3(3.30, 2.65, 0.15);

        if (t < 0.35) {
          const u = t / 0.35;
          b.group.position.lerpVectors(b.home, bowlTarget, u);
          b.group.position.y += Math.sin(u * Math.PI) * 0.45;
          b.group.rotation.z = u * 2.25;
        } else if (t < 0.72) {
          b.group.position.copy(bowlTarget);
          b.group.position.y += Math.sin((t - 0.35) * 32) * 0.14;
          b.group.rotation.z = 2.25 + Math.sin((t - 0.35) * 28) * 0.25;

          if (!b.didPour) {
            b.didPour = true;
            if (b.id === 'crouton') {
              // Drop 4 crunchy golden voxel croutons into the salad bowl!
              for (let c = 0; c < 4; c++) {
                this._spawnSingleSliceToBowl('crouton', new THREE.Vector3(3.30 + (c - 1.5) * 0.18, 2.25, 0.22));
              }
            }
          }
          // Emit delicious golden oil / creamy pink dressing voxel drops!
          if (Math.random() < dt * 32) {
            this.particles.spawn({
              x: 3.30 + (Math.random() - 0.5) * 0.75,
              y: 2.30,
              z: -11.78 + (Math.random() - 0.5) * 0.75,
              vx: (Math.random() - 0.5) * 0.5,
              vy: -2.5,
              vz: (Math.random() - 0.5) * 0.5,
              size: 0.10,
              maxLife: 0.55,
              gravity: -12,
              floorY: 1.52,
              bounce: 0.2,
              bouncesLeft: 1,
              color: b.dropColor,
              kind: 'drip',
            });
          }
        } else if (t < 1.0) {
          const u = (t - 0.72) / 0.28;
          b.group.position.lerpVectors(bowlTarget, b.home, u);
          b.group.rotation.z = (1 - u) * 2.25;
        } else {
          b.group.position.copy(b.home);
          b.group.rotation.set(0, 0, 0);
          b.animT = -1;
        }
      }
    }

    // 5. Physical 3D Tumbling Salad Slices & Wooden Servers!
    this.tossEnergy = Math.max(0, this.tossEnergy - dt * 2.2);
    if (this.serversGroup.visible) {
      const sway = Math.sin(time * 14) * this.tossEnergy * 0.42;
      const serveSpread = this.servingMode ? 0.22 : 0;
      this.spoon.position.x = -0.68 - serveSpread;
      this.fork.position.x = 0.68 + serveSpread;
      this.spoon.rotation.z = 0.48 + serveSpread * 0.8 + sway;
      this.spoon.position.y = 0.62 + Math.abs(sway) * 0.35;
      this.fork.rotation.z = -0.48 - serveSpread * 0.8 - sway;
      this.fork.position.y = 0.62 + Math.abs(sway) * 0.35;
    }

    for (let i = 0; i < this.saladPieces.length; i++) {
      const p = this.saladPieces[i];
      p.vel.y -= 13 * dt;
      p.pos.addScaledVector(p.vel, dt);

      // Rest floor inside wooden salad bowl (heaped colorful voxel pile!)
      const floorY = 0.38 + Math.min(0.46, (i % 14) * 0.036);
      if (p.pos.y < floorY) {
        p.pos.y = floorY;
        if (p.vel.y < -0.6) p.vel.y = -p.vel.y * 0.28;
        else p.vel.y = 0;
        p.vel.x *= 0.72;
        p.vel.z *= 0.72;
        p.rotVel.multiplyScalar(0.75);
      }

      // Soft circular bowl boundary
      const r = Math.hypot(p.pos.x, p.pos.z);
      if (r > 0.62) {
        const s = 0.62 / r;
        p.pos.x *= s;
        p.pos.z *= s;
        p.vel.x *= -0.35;
        p.vel.z *= -0.35;
      }

      p.rot.x += p.rotVel.x * dt;
      p.rot.y += p.rotVel.y * dt;
      p.rot.z += p.rotVel.z * dt;
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.copy(p.rot);
    }

    // 6. Celebratory Eating Fork Animation!
    if (this.eatingForkAnim) {
      const a = this.eatingForkAnim;
      a.t += dt * 1.35;
      if (a.t < 0.35) {
        // Dip down into bowl
        const u = a.t / 0.35;
        this.eatingFork.position.set(0, 1.65 - u * 0.95, 0.15);
        this.eatingFork.rotation.set(0.25, 0, 0.15);
      } else if (a.t < 0.85) {
        // Lift colorful scooped bite up joyfully!
        const u = (a.t - 0.35) / 0.5;
        const fy = 0.70 + u * 1.55;
        this.eatingFork.position.set(0, fy, 0.15 + u * 0.65);
        this.eatingFork.rotation.set(0.25 + u * 0.45, 0, 0.15);
        a.scooped.forEach((p, idx) => {
          p.mesh.position.set((idx - 1) * 0.14, fy - 0.16 + idx * 0.08, 0.15 + u * 0.65);
        });
        if (u > 0.62 && !a.crunched) {
          a.crunched = true;
          this.sound.playCrunchBite();
          this.particles.emitSparkles(3.30, 2.65, -11.2, 14, [0xff595e, 0x8ac926, 0xffca3a, 0xffffff]);
          a.scooped.forEach((p) => this.saladGroup.remove(p.mesh));
        }
      } else {
        this.eatingFork.visible = false;
        this.eatingForkAnim = null;
        if (this.saladPieces.length === 0) {
          this.eatenAll = true;
          this.sound.playFanfare();
          this.particles.emitConfetti(3.30, 2.3, -11.78, 45);
        }
      }
    }

    // 7. Flying items (sink -> board, board -> bowl, shaker -> bowl)
    for (let i = this.flyingItems.length - 1; i >= 0; i--) {
      const f = this.flyingItems[i];
      f.t += dt / f.duration;
      if (f.t >= 1) {
        this.flyingItems.splice(i, 1);
        f.onArrive();
      } else {
        const u = f.t;
        f.mesh.position.lerpVectors(f.start, f.target, u);
        f.mesh.position.y += Math.sin(u * Math.PI) * 1.15;
        f.mesh.rotation.x += dt * 6;
        f.mesh.rotation.y += dt * 4;
      }
    }

    // 8. Dinner bell cheerful bounce & gentle shimmer when salad is ready!
    if (this.bellBounce > 0) {
      this.bellBounce = Math.max(0, this.bellBounce - dt * 4);
    }
    const bellReadyBob =
      !this.servingMode && this.saladPieces.length >= 2
        ? Math.abs(Math.sin(time * 3.8)) * 0.07
        : 0;
    this.bell.position.y = 1.06 + Math.sin(this.bellBounce * Math.PI) * 0.18 + bellReadyBob;

    // Gentle celebratory bounce on return watering can once salad is all eaten!
    if (this.servingMode && this.eatenAll) {
      this.returnProp.position.y = 1.06 + Math.abs(Math.sin(time * 4.2)) * 0.14;
    } else {
      this.returnProp.position.y = 1.06;
    }
  }
}
