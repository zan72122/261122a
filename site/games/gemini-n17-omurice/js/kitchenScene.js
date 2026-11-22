import * as THREE from '../vendor/three/three.module.min.js';
import {
  createClayMaterial,
  createGlossyClayMaterial,
  getWoodClayTexture,
  getClayTileTexture,
} from './clayMaterial.js';
import { sculptClay, makeClayBlob, makeClayPuck, makeClayStar } from './clayGeo.js';

export const KITCHEN_CENTER = new THREE.Vector3(0, 0.76, 0);
export const DINING_CENTER = new THREE.Vector3(11.0, 0.55, 0.25);

export class KitchenDiorama {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);

    this.flameLevel = 2; // 1 = low, 2 = medium, 3 = high
    this.flameOn = true;
    this.flameGroup = new THREE.Group();
    this.flameFrames = [];
    this.knobGroup = null;
    this.knobTargetAngle = 0;
    this.panGroup = null;
    // Slightly elevated on chunky stove grates so flames lick strictly under/outside the bottom rim!
    this.panBasePos = new THREE.Vector3(0, 0.74, -0.1);
    this.panWobble = 0;

    // Reusable stop-motion clay steam puffs
    this.steamPuffs = [];
    this.steamTimer = 0;
    this.steamRate = 0;

    // Souvenir clay stars on the kitchen shelf (persistent play memory!)
    this.souvenirGroup = new THREE.Group();
    this.souvenirCount = 0;

    // Interactive hit meshes
    this.knobHitMesh = null;
    this.panHandleHitMesh = null;

    this._buildTableAndWalls();
    this._buildStove();
    this._buildFryingPan();
    this._buildSteamPool();
    this._buildDiningMat();
  }

  _buildTableAndWalls() {
    // 1. Continuous hand-sculpted wood-clay tabletop spanning kitchen & dining (deep enough for tall portrait phones!)
    const tableMat = createClayMaterial('#d4a77b', {
      map: getWoodClayTexture(),
      softSurface: true,
      normalStrength: 0.3,
      roughness: 0.84,
    });
    tableMat.map.repeat.set(5, 3.6);

    const tableGeo = new THREE.BoxGeometry(28, 0.8, 17, 28, 2, 16);
    sculptClay(tableGeo, {
      amp: 0.006,
      freq: 0.7,
      seed: 1.4,
      thumbDents: 2,
      dentDepth: 0.003,
    });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.set(5.5, -0.4, 3.6);
    table.receiveShadow = true;
    this.root.add(table);

    // Hand-rolled clay molding edge along the front of the counter
    const rimGeo = new THREE.CylinderGeometry(0.14, 0.14, 28, 12, 20);
    rimGeo.rotateZ(Math.PI / 2);
    sculptClay(rimGeo, { amp: 0.015, freq: 1.3, seed: 2.1, thumbDents: 1 });
    const rimMat = createClayMaterial('#b88557', { roughness: 0.84, normalStrength: 0.45 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(5.5, -0.04, 12.05);
    rim.receiveShadow = true;
    this.root.add(rim);

    // 2. Kitchen tiled clay backsplash wall (left half)
    const tileTex = getClayTileTexture();
    tileTex.repeat.set(4.5, 2.5);
    const tileWallMat = createClayMaterial('#ffffff', {
      map: tileTex,
      softSurface: true,
      normalStrength: 0.28,
      roughness: 0.84,
    });
    const wallGeo = new THREE.BoxGeometry(13.5, 9.0, 0.45, 16, 10, 2);
    sculptClay(wallGeo, { amp: 0.006, freq: 0.9, seed: 3.3, thumbDents: 2, dentDepth: 0.003 });
    const kitchenWall = new THREE.Mesh(wallGeo, tileWallMat);
    kitchenWall.position.set(-0.6, 4.0, -3.55);
    kitchenWall.receiveShadow = true;
    this.root.add(kitchenWall);

    // 3. Dining cozy warm clay plaster wall (right half)
    const diningWallMat = createClayMaterial('#f0d8be', {
      softSurface: true,
      normalStrength: 0.25,
      roughness: 0.88,
    });
    const dWallGeo = new THREE.BoxGeometry(16, 9.0, 0.45, 16, 10, 2);
    sculptClay(dWallGeo, { amp: 0.008, freq: 0.7, seed: 6.2, thumbDents: 3, dentDepth: 0.005 });
    const diningWall = new THREE.Mesh(dWallGeo, diningWallMat);
    diningWall.position.set(13.8, 4.0, -3.55);
    diningWall.receiveShadow = true;
    this.root.add(diningWall);

    // Cozy clay dado rail / trim strip separating kitchen & dining wall
    const trimMat = createClayMaterial('#c79263', { normalStrength: 0.7 });
    const trimGeo = new THREE.BoxGeometry(28, 0.24, 0.22, 20, 2, 2);
    sculptClay(trimGeo, { amp: 0.018, freq: 1.5, seed: 4.9, thumbDents: 1 });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(5.5, 1.45, -3.28);
    trim.castShadow = true;
    trim.receiveShadow = true;
    this.root.add(trim);

    // 4. Kitchen wooden-clay wall shelf with miniature handmade props + souvenir star rail
    const shelfGeo = new THREE.BoxGeometry(6.4, 0.22, 0.88, 12, 2, 4);
    sculptClay(shelfGeo, { amp: 0.022, freq: 1.8, seed: 8.1, thumbDents: 2, dentDepth: 0.018 });
    const shelf = new THREE.Mesh(shelfGeo, rimMat);
    shelf.position.set(0.0, 2.75, -2.95);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    this.root.add(shelf);

    // Miniature clay spice jar + clay herb pot on shelf edges
    const jarMat = createClayMaterial('#e37c5b', { normalStrength: 1.0 });
    const jarGeo = makeClayPuck(0.24, 0.42, 0.08, 16, { amp: 0.04, seed: 11 });
    const jar = new THREE.Mesh(jarGeo, jarMat);
    jar.position.set(-2.55, 3.07, -2.92);
    jar.castShadow = true;
    this.root.add(jar);

    const lidMat = createClayMaterial('#f5e5cc', { normalStrength: 0.9 });
    const lid = new THREE.Mesh(makeClayPuck(0.2, 0.14, 0.05, 14, { amp: 0.04, seed: 12 }), lidMat);
    lid.position.set(-2.55, 3.33, -2.92);
    this.root.add(lid);

    // Tiny terracotta clay herb pot on right of shelf
    const potMat = createClayMaterial('#c96844', { normalStrength: 1.0 });
    const pot = new THREE.Mesh(makeClayPuck(0.25, 0.36, 0.07, 16, { amp: 0.05, seed: 14 }), potMat);
    pot.position.set(2.55, 3.04, -2.92);
    pot.castShadow = true;
    this.root.add(pot);

    const leafMat = createClayMaterial('#5c9451', { normalStrength: 1.0 });
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + 0.4;
      const leaf = new THREE.Mesh(
        makeClayBlob(0.15, 10, 8, { amp: 0.06, seed: 20 + i, scaleX: 1.3, scaleY: 0.65, scaleZ: 0.8 }),
        leafMat
      );
      leaf.position.set(2.55 + Math.cos(ang) * 0.14, 3.32 + (i % 2) * 0.06, -2.92 + Math.sin(ang) * 0.12);
      leaf.rotation.set(0.3, ang, 0.4);
      this.root.add(leaf);
    }

    // Souvenir stars group on the shelf
    this.souvenirGroup.position.set(0, 3.02, -2.85);
    this.root.add(this.souvenirGroup);

    // 5. Cozy framed clay diorama picture on dining wall (recessed sky, sun with rays, fluffy cloud & hills)
    const frameGroup = new THREE.Group();
    frameGroup.position.set(11.0, 3.35, -3.26);
    const frameOuter = new THREE.Mesh(
      sculptClay(new THREE.BoxGeometry(2.35, 1.65, 0.16, 8, 6, 2), { amp: 0.018, seed: 30 }),
      rimMat
    );
    frameOuter.castShadow = true;
    frameGroup.add(frameOuter);

    const skyBack = new THREE.Mesh(
      new THREE.BoxGeometry(1.96, 1.26, 0.18),
      createClayMaterial('#e4eef4', { softSurface: true, normalStrength: 0.35 })
    );
    frameGroup.add(skyBack);

    const sun = new THREE.Mesh(
      makeClayPuck(0.24, 0.1, 0.04, 14, { amp: 0.04, seed: 31 }),
      createClayMaterial('#f5b83d', { normalStrength: 0.85 })
    );
    sun.rotation.x = Math.PI / 2;
    sun.position.set(-0.48, 0.22, 0.1);
    frameGroup.add(sun);

    // Cute clay cloud
    const cloudMat = createClayMaterial('#fbf7ee', { normalStrength: 0.7 });
    [
      [0.32, 0.24, 0.12],
      [0.48, 0.28, 0.14],
      [0.62, 0.22, 0.11],
    ].forEach(([cx, cy, cr], idx) => {
      const c = new THREE.Mesh(makeClayBlob(cr, 10, 8, { amp: 0.06, seed: 34 + idx, scaleZ: 0.45 }), cloudMat);
      c.position.set(cx, cy, 0.11);
      frameGroup.add(c);
    });

    // Layered rolling clay hills clipped neatly inside the frame width
    const hillBack = new THREE.Mesh(
      makeClayBlob(0.42, 12, 8, { amp: 0.04, seed: 32, scaleX: 1.9, scaleY: 0.65, scaleZ: 0.18 }),
      createClayMaterial('#8cb374', { normalStrength: 0.7 })
    );
    hillBack.position.set(-0.22, -0.36, 0.09);
    frameGroup.add(hillBack);

    const hillFront = new THREE.Mesh(
      makeClayBlob(0.38, 12, 8, { amp: 0.04, seed: 33, scaleX: 1.85, scaleY: 0.58, scaleZ: 0.2 }),
      createClayMaterial('#6f9b5d', { normalStrength: 0.75 })
    );
    hillFront.position.set(0.28, -0.4, 0.11);
    frameGroup.add(hillFront);

    // Inner frame lip strips so hills stay tucked neatly inside the frame
    const lipBottom = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.22, 0.24), rimMat);
    lipBottom.position.set(0, -0.72, 0.04);
    frameGroup.add(lipBottom);
    const lipLeft = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.65, 0.24), rimMat);
    lipLeft.position.set(-1.08, 0, 0.04);
    frameGroup.add(lipLeft);
    const lipRight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.65, 0.24), rimMat);
    lipRight.position.set(1.08, 0, 0.04);
    frameGroup.add(lipRight);

    this.root.add(frameGroup);
  }

  _buildStove() {
    const stoveGroup = new THREE.Group();
    stoveGroup.position.set(0, 0, -0.1);
    this.root.add(stoveGroup);

    // Chunky cream hand-molded clay stove body
    const bodyMat = createClayMaterial('#e9dcc8', { normalStrength: 0.8, roughness: 0.84 });
    const bodyGeo = new THREE.BoxGeometry(3.55, 0.5, 3.2, 16, 6, 14);
    sculptClay(bodyGeo, { amp: 0.022, freq: 1.5, seed: 4.1, thumbDents: 4, dentDepth: 0.02 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.25, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    stoveGroup.add(body);

    // Sage clay top bezel
    const topMat = createClayMaterial('#b9c4b0', { normalStrength: 0.8, roughness: 0.82 });
    const topGeo = makeClayPuck(1.48, 0.09, 0.04, 24, { amp: 0.02, seed: 4.4 });
    const topRing = new THREE.Mesh(topGeo, topMat);
    topRing.position.set(0, 0.51, 0);
    topRing.receiveShadow = true;
    stoveGroup.add(topRing);

    // Dark iron-clay burner hub & 4 taller chunky grate arms supporting the pan cleanly above the flames
    const ironMat = createClayMaterial('#424045', { normalStrength: 0.9, roughness: 0.86 });
    const burner = new THREE.Mesh(
      makeClayPuck(0.76, 0.16, 0.04, 18, { amp: 0.03, seed: 4.7 }),
      ironMat
    );
    burner.position.set(0, 0.56, 0);
    burner.castShadow = true;
    stoveGroup.add(burner);

    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const prongGeo = new THREE.BoxGeometry(0.18, 0.18, 0.78, 4, 3, 6);
      sculptClay(prongGeo, { amp: 0.035, seed: 5 + i, thumbDents: 1 });
      const prong = new THREE.Mesh(prongGeo, ironMat);
      prong.position.set(Math.cos(ang) * 0.92, 0.61, Math.sin(ang) * 0.92);
      prong.rotation.y = -ang + Math.PI / 2;
      prong.castShadow = true;
      stoveGroup.add(prong);
    }

    // Stop-motion clay flame frames licking STRICTLY AROUND THE OUTSIDE LOWER BELLY of the frying pan (never poking inside!)
    this.flameGroup.position.set(0, 0.54, 0);
    stoveGroup.add(this.flameGroup);

    const flameOuterMat = createClayMaterial('#ff7b29', {
      emissive: '#ff5511',
      emissiveIntensity: 0.6,
      normalStrength: 0.75,
      roughness: 0.62,
    });
    const flameInnerMat = createClayMaterial('#ffd84d', {
      emissive: '#ffaa22',
      emissiveIntensity: 0.7,
      normalStrength: 0.65,
      roughness: 0.58,
    });
    const flameBlueMat = createClayMaterial('#56a8ff', {
      emissive: '#2f82ff',
      emissiveIntensity: 0.58,
      normalStrength: 0.65,
      roughness: 0.58,
    });

    for (let f = 0; f < 3; f++) {
      const frame = new THREE.Group();
      const count = 12;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + f * 0.22;
        // Radius 1.54..1.62 sits neatly outside the pan's lower wall (pan outer radius is 1.26 at y=0.64 -> 1.48 at y=0.76)
        const r = 1.52;
        const hScale = 0.78 + ((i + f) % 3) * 0.22;

        const tongueGeo = new THREE.ConeGeometry(0.115, 0.34 * hScale, 8, 3);
        sculptClay(tongueGeo, { amp: 0.08, seed: 60 + f * 10 + i, thumbDents: 1 });
        const tongue = new THREE.Mesh(
          tongueGeo,
          i % 3 === 0 ? flameInnerMat : flameOuterMat
        );
        tongue.position.set(Math.cos(ang) * r, 0.14 * hScale, Math.sin(ang) * r);
        // Lean outward away from the pan rim so flames visibly dance around the pan exterior!
        tongue.rotation.z = -Math.cos(ang) * 0.72;
        tongue.rotation.x = Math.sin(ang) * 0.72;
        frame.add(tongue);

        if (i % 2 === 0) {
          const blue = new THREE.Mesh(
            makeClayBlob(0.08, 8, 6, { amp: 0.07, seed: 90 + f * 7 + i, scaleY: 1.2 }),
            flameBlueMat
          );
          blue.position.set(Math.cos(ang) * (r - 0.12), 0.06, Math.sin(ang) * (r - 0.12));
          frame.add(blue);
        }
      }
      frame.visible = f === 0;
      this.flameFrames.push(frame);
      this.flameGroup.add(frame);
    }

    // Chunky clickable RED CLAY STOVE KNOB on the front-left corner of the stove
    this.knobGroup = new THREE.Group();
    this.knobGroup.position.set(-1.12, 0.26, 1.62);
    stoveGroup.add(this.knobGroup);

    const knobBaseMat = createClayMaterial('#d9cab5', { normalStrength: 0.9 });
    const knobBack = new THREE.Mesh(
      makeClayPuck(0.32, 0.1, 0.04, 16, { amp: 0.03, seed: 7.2 }),
      knobBaseMat
    );
    knobBack.rotation.x = Math.PI / 2;
    this.knobGroup.add(knobBack);

    const knobRedMat = createClayMaterial('#dd4f3e', { normalStrength: 1.05, roughness: 0.72 });
    const knobDial = new THREE.Mesh(
      makeClayPuck(0.24, 0.16, 0.05, 16, { amp: 0.04, seed: 7.5 }),
      knobRedMat
    );
    knobDial.rotation.x = Math.PI / 2;
    knobDial.position.z = 0.09;
    knobDial.castShadow = true;
    this.knobGroup.add(knobDial);

    const barGeo = new THREE.BoxGeometry(0.11, 0.42, 0.15, 4, 6, 4);
    sculptClay(barGeo, { amp: 0.06, seed: 7.9, thumbDents: 1 });
    const bar = new THREE.Mesh(barGeo, createClayMaterial('#f36954', { normalStrength: 1.0 }));
    bar.position.z = 0.16;
    bar.castShadow = true;
    this.knobGroup.add(bar);

    // Three tiny sculpted clay flame-level dots above the knob
    const dotMat = createClayMaterial('#f09d38', { normalStrength: 0.8 });
    const dotSizes = [0.042, 0.062, 0.085];
    const dotAngles = [-0.75, 0, 0.75];
    for (let i = 0; i < 3; i++) {
      const a = dotAngles[i];
      const dot = new THREE.Mesh(makeClayBlob(dotSizes[i], 8, 6, { amp: 0.05, seed: 80 + i }), dotMat);
      dot.position.set(-1.12 + Math.sin(a) * 0.39, 0.26 + Math.cos(a) * 0.37, 1.64);
      stoveGroup.add(dot);
    }

    const hitGeo = new THREE.SphereGeometry(0.58, 10, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.knobHitMesh = new THREE.Mesh(hitGeo, hitMat);
    this.knobHitMesh.position.set(0, 0, 0.12);
    this.knobHitMesh.userData = { interact: 'stoveKnob' };
    this.knobGroup.add(this.knobHitMesh);

    this.setFlameLevel(2);
  }

  _buildFryingPan() {
    this.panGroup = new THREE.Group();
    this.panGroup.position.copy(this.panBasePos);
    this.root.add(this.panGroup);

    // Watertight thick-walled hand-molded clay frying pan
    const pts = [
      new THREE.Vector2(0.0, -0.10),
      new THREE.Vector2(1.22, -0.10),
      new THREE.Vector2(1.42, 0.04),
      new THREE.Vector2(1.62, 0.42),
      new THREE.Vector2(1.60, 0.50),
      new THREE.Vector2(1.48, 0.48),
      new THREE.Vector2(1.30, 0.08),
      new THREE.Vector2(1.16, 0.02),
      new THREE.Vector2(0.0, 0.02),
    ];
    const panGeo = new THREE.LatheGeometry(pts, 36);
    sculptClay(panGeo, { amp: 0.014, freq: 2.2, seed: 9.2, thumbDents: 4, dentDepth: 0.012 });

    const panMat = createClayMaterial('#524f58', {
      normalStrength: 0.8,
      roughness: 0.74,
      metalness: 0.06,
    });
    const panMesh = new THREE.Mesh(panGeo, panMat);
    panMesh.castShadow = true;
    panMesh.receiveShadow = true;
    panMesh.userData = { interact: 'pan' };
    this.panGroup.add(panMesh);

    const floorMat = createClayMaterial('#5d5a63', {
      softSurface: true,
      normalStrength: 0.45,
      roughness: 0.68,
      metalness: 0.05,
    });
    const floorMesh = new THREE.Mesh(
      makeClayPuck(1.18, 0.04, 0.02, 24, { amp: 0.006, seed: 9.4 }),
      floorMat
    );
    floorMesh.position.y = 0.03;
    floorMesh.receiveShadow = true;
    floorMesh.userData = { interact: 'pan' };
    this.panGroup.add(floorMesh);

    // Chunky sculpted terracotta-wood clay handle angled cleanly toward front-right (leaving right-back open for bowl & spatula!)
    const handleGroup = new THREE.Group();
    handleGroup.position.set(1.24, 0.42, 0.94);
    handleGroup.rotation.y = -0.68;
    handleGroup.rotation.z = 0.16;
    this.panGroup.add(handleGroup);

    const collar = new THREE.Mesh(
      makeClayPuck(0.21, 0.28, 0.06, 12, { amp: 0.04, seed: 9.6 }),
      panMat
    );
    collar.rotation.z = Math.PI / 2;
    collar.position.x = 0.08;
    handleGroup.add(collar);

    const handleGeo = new THREE.CylinderGeometry(0.14, 0.185, 1.44, 14, 6);
    handleGeo.rotateZ(Math.PI / 2);
    sculptClay(handleGeo, { amp: 0.038, freq: 3.1, seed: 9.9, thumbDents: 3, dentDepth: 0.035 });
    const handleMat = createClayMaterial('#c77a48', { normalStrength: 1.0, roughness: 0.8 });
    const handleMesh = new THREE.Mesh(handleGeo, handleMat);
    handleMesh.position.x = 0.82;
    handleMesh.castShadow = true;
    handleMesh.receiveShadow = true;
    handleGroup.add(handleMesh);

    this.panHandleHitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.75, 0.75),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.panHandleHitMesh.position.x = 0.8;
    this.panHandleHitMesh.userData = { interact: 'panHandle' };
    handleGroup.add(this.panHandleHitMesh);
  }

  _buildSteamPool() {
    // Bright warm cotton-clay steam wisps (never gray balls!)
    const baseSteamMat = createClayMaterial('#fffaf2', {
      softSurface: true,
      normalStrength: 0.4,
      roughness: 0.92,
      emissive: '#fff5e4',
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.72,
    });
    const puffGeo = makeClayBlob(0.13, 10, 8, { amp: 0.14, seed: 120 });
    for (let i = 0; i < 12; i++) {
      const puff = new THREE.Mesh(puffGeo, baseSteamMat.clone());
      puff.castShadow = false;
      puff.receiveShadow = false;
      puff.visible = false;
      this.root.add(puff);
      this.steamPuffs.push({
        mesh: puff,
        active: false,
        age: 0,
        life: 1.15,
        vx: 0,
        vy: 0,
        vz: 0,
        baseScale: 1,
      });
    }
  }

  _buildDiningMat() {
    // Cozy warm woven-clay gingham placemat at dining zone (wide enough for plate + all tools with zero overhang!)
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f8f0e2';
    ctx.fillRect(0, 0, size, size);
    const step = 32;
    for (let y = 0; y < size; y += step) {
      for (let x = 0; x < size; x += step) {
        const ix = (x / step) % 2;
        const iy = (y / step) % 2;
        if (ix === 0 && iy === 0) ctx.fillStyle = 'rgba(222, 106, 86, 0.55)';
        else if (ix === 0 || iy === 0) ctx.fillStyle = 'rgba(222, 106, 86, 0.22)';
        else continue;
        ctx.fillRect(x, y, step, step);
      }
    }
    const matTex = new THREE.CanvasTexture(c);
    matTex.wrapS = THREE.RepeatWrapping;
    matTex.wrapT = THREE.RepeatWrapping;
    matTex.repeat.set(3.2, 2.0);
    matTex.colorSpace = THREE.SRGBColorSpace;

    const clothMat = createClayMaterial('#ffffff', {
      map: matTex,
      softSurface: true,
      normalStrength: 0.45,
      roughness: 0.9,
    });
    const clothGeo = new THREE.BoxGeometry(6.8, 0.06, 4.15, 16, 2, 10);
    sculptClay(clothGeo, { amp: 0.012, freq: 1.4, seed: 55.2, thumbDents: 2, dentDepth: 0.006 });
    const cloth = new THREE.Mesh(clothGeo, clothMat);
    cloth.position.set(DINING_CENTER.x, 0.025, DINING_CENTER.z + 0.14);
    cloth.receiveShadow = true;
    this.root.add(cloth);
  }

  setFlameLevel(level) {
    this.flameLevel = Math.max(1, Math.min(3, level));
    const angles = [0.75, 0, -0.75];
    this.knobTargetAngle = angles[this.flameLevel - 1];
  }

  cycleFlameLevel() {
    const next = (this.flameLevel % 3) + 1;
    this.setFlameLevel(next);
    return next;
  }

  setFlameOn(on) {
    this.flameOn = on;
    this.flameGroup.visible = on;
  }

  jigglePan(strength = 1.0) {
    this.panWobble = Math.max(this.panWobble, strength);
  }

  spawnSteam(x, y, z, scale = 1.0) {
    for (let i = 0; i < this.steamPuffs.length; i++) {
      const p = this.steamPuffs[i];
      if (!p.active) {
        p.active = true;
        p.age = 0;
        p.life = 0.8 + Math.random() * 0.45;
        p.vx = (Math.random() - 0.5) * 0.35;
        p.vy = 0.9 + Math.random() * 0.45;
        p.vz = (Math.random() - 0.5) * 0.35;
        p.baseScale = (0.55 + Math.random() * 0.35) * scale;
        p.mesh.position.set(x, y, z);
        p.mesh.scale.setScalar(0.1);
        p.mesh.material.opacity = 0.68;
        p.mesh.visible = true;
        return;
      }
    }
  }

  addSouvenirStar() {
    this.souvenirCount++;
    const idx = (this.souvenirCount - 1) % 7;
    const colors = ['#f5c342', '#e86850', '#7ac46b', '#f29cb8', '#68b4e3', '#f59f42', '#c88ce6'];
    const starMat = createClayMaterial(colors[idx], { normalStrength: 1.0, roughness: 0.75 });
    const star = new THREE.Mesh(makeClayStar(0.22, 0.11, 0.1, 5), starMat);
    star.rotation.x = Math.PI / 2;
    star.rotation.z = (idx - 3) * 0.12;
    star.position.set(-1.55 + idx * 0.52, 0.08 + Math.floor((this.souvenirCount - 1) / 7) * 0.22, 0);
    star.castShadow = true;
    this.souvenirGroup.add(star);
  }

  update(dt, elapsed, stopMotionStep) {
    if (this.knobGroup) {
      this.knobGroup.rotation.z += (this.knobTargetAngle - this.knobGroup.rotation.z) * Math.min(1, dt * 14);
    }

    if (this.flameOn) {
      const frameIdx = stopMotionStep % this.flameFrames.length;
      for (let i = 0; i < this.flameFrames.length; i++) {
        this.flameFrames[i].visible = i === frameIdx;
      }
      const scaleByLevel = [0.72, 1.0, 1.32][this.flameLevel - 1];
      const wobble = 1.0 + Math.sin(stopMotionStep * 1.9) * 0.08;
      this.flameGroup.scale.set(
        0.96 + (scaleByLevel - 1) * 0.16,
        scaleByLevel * wobble,
        0.96 + (scaleByLevel - 1) * 0.16
      );
    }

    if (this.panWobble > 0.001) {
      this.panWobble = Math.max(0, this.panWobble - dt * 3.4);
      const s = Math.sin(elapsed * 32) * this.panWobble;
      this.panGroup.rotation.z = s * 0.055;
      this.panGroup.rotation.x = Math.cos(elapsed * 26) * this.panWobble * 0.038;
      this.panGroup.position.y = this.panBasePos.y + Math.abs(s) * 0.075;
    } else {
      this.panGroup.rotation.set(0, 0, 0);
      this.panGroup.position.copy(this.panBasePos);
    }

    if (this.steamRate > 0) {
      this.steamTimer += dt * this.steamRate;
      if (this.steamTimer >= 1) {
        this.steamTimer = 0;
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * 0.72;
        this.spawnSteam(
          this.panBasePos.x + Math.cos(ang) * rad,
          this.panBasePos.y + 0.56,
          this.panBasePos.z + Math.sin(ang) * rad,
          0.7 + this.flameLevel * 0.18
        );
      }
    }

    for (let i = 0; i < this.steamPuffs.length; i++) {
      const p = this.steamPuffs[i];
      if (!p.active) continue;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      const qT = Math.floor(t * 10) / 10;
      const sc = p.baseScale * (0.45 + Math.sin(qT * Math.PI) * 0.85);
      p.mesh.scale.setScalar(Math.max(0.05, sc));
      p.mesh.rotation.y = stopMotionStep * 0.35 + i;
      p.mesh.material.opacity = Math.max(0, (1 - qT) * 0.65);
    }
  }
}
