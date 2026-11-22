import * as THREE from '../vendor/three.module.js';
import {
  COOKIE_SHAPES,
  DOUGH_FLAVORS,
  createPapercraftCookie,
  createCookieShape,
  createScallopedShape,
  extrudePaperFlat,
  isPointInCookie,
} from './shapes.js';
import {
  ICING_COLORS,
  TOPPING_TYPES,
  createParchmentSheet,
  createDoughSystem,
  createRollingPin,
  createFlavorShakers,
  createCookieCutters,
  createBakingTray,
  createOven,
  createDoilyTurntable,
  createCoolingRack,
  createPipingBags,
  createToppingCups,
  createToppingMesh,
  createGiftBox,
  createSealStickers,
  createFreshDoughProp,
  createIdlePaperHand,
} from './props.js';

const MAX_COOKIES = 4;
const RAINBOW_HEXES = ['#f26d85', '#ffab5e', '#ffe052', '#5fd0b8', '#6fb7f5', '#b588eb'];

export class CookieGame {
  constructor(scene, camera, mats, world, sound) {
    this.scene = scene;
    this.camera = camera;
    this.mats = mats;
    this.world = world;
    this.sound = sound;

    this.stage = 'ROLL'; // ROLL | CUT | BAKE | DECORATE | PACK
    this.packPhase = 'PLACE'; // PLACE | CLOSE_LID | TIE_RIBBON | CELEBRATE
    this.time = 0;
    this.idleTimer = 0;
    this.idleDemoActive = false;
    this.idleDemoT = 0;
    this.celebrateEnergy = 0;
    this.roundCount = 0;

    // Camera smooth spring targets
    this.camPos = new THREE.Vector3(0, 6.2, 5.2);
    this.camLook = new THREE.Vector3(0, 0.25, 0.35);
    this.camTargetPos = this.camPos.clone();
    this.camTargetLook = this.camLook.clone();
    this.isPortrait = false;

    // Active gameplay state
    this.cookies = []; // Array of cookie objects from createPapercraftCookie
    this.activeCookieIdx = 0;
    this.packedCookieIndices = [];

    // Stage 1 ROLL state
    this.isRolling = false;
    this.lastRollPoint = null;
    this.rollPinTarget = new THREE.Vector3(0, 0.42, 0.3);
    this.rollPinAngle = 0;
    this.stageTransitionTimer = 0;
    this.pendingTransition = null;

    // Stage 2 CUT state
    this.selectedCutter = null;
    this.draggingCutter = null;
    this.cutterStampAnim = null;

    // Stage 3 BAKE state
    this.dialAngle = 0; // 0 .. Math.PI * 1.38
    this.dialDragging = false;
    this.dialDragStartY = 0;
    this.dialStartAngle = 0;
    this.bakeProgress = 0; // 0 .. 1.35
    this.bakeDone = false;
    this.ovenDoorAngle = 0; // 0 closed, ~1.45 open
    this.ovenDoorTarget = 0;
    this.lastDialStep = 0;
    this.steamAccum = 0;

    // Stage 4 DECORATE state
    this.decoToolMode = 'icing'; // 'icing' | 'topping'
    this.selectedIcingIdx = 0; // Strawberry pink ready right away!
    this.selectedToppingIdx = 0;
    this.isPiping = false;
    this.lastPipeLocal = null;
    this.rainbowPhase = 0;
    this.isSpinningDoily = false;
    this.doilySpinStartAngle = 0;
    this.doilyRotStart = 0;
    this.draggingToppingCup = null;
    this.lastSprinkleTime = 0;
    this.activePipingWorldPos = new THREE.Vector3();
    this.pipingSqueeze = 0;

    // Stage 5 PACK state
    this.draggingCookieIdx = -1;
    this.draggingSeal = null;
    this.lidCloseProgress = 0; // 0 open .. 1 closed
    this.ribbonTied = false;
    this.ribbonBloom = 0;
    this.boxPeekTimer = 0;
    this.boxBounce = 0;

    // Flying animations & cut-paper particles
    this.flyAnims = [];
    this.particles = [];
    this.sharedParticleGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.016, 7);
    this.sharedConfettiGeo = new THREE.BoxGeometry(0.14, 0.016, 0.1);
    // Smooth rounded cut-paper icing beads & pill ribbons (never boxy!)
    this.sharedIcingDotGeo = new THREE.CylinderGeometry(0.058, 0.068, 0.044, 14);
    this.sharedIcingRimGeo = new THREE.CylinderGeometry(0.072, 0.074, 0.016, 14);
    this.sharedIcingSegGeo = new THREE.CylinderGeometry(0.056, 0.064, 1.0, 10);
    this.sharedIcingSegGeo.rotateZ(Math.PI / 2);

    // Raycasting helpers
    this.raycaster = new THREE.Raycaster();
    this.pointerNDC = new THREE.Vector2();
    this.tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.14);
    this.ovenDialPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    this._buildAllProps();
    this._setupStage('ROLL', true);
  }

  _buildAllProps() {
    // Stage 1 & 2 Workbench Group
    this.workGroup = new THREE.Group();
    this.scene.add(this.workGroup);

    this.parchment = createParchmentSheet(this.mats);
    this.parchment.position.set(0, 0.036, 0.55);
    this.workGroup.add(this.parchment);

    this.dough = createDoughSystem(this.mats);
    this.dough.group.position.set(0, 0.058, 0.55);
    this.workGroup.add(this.dough.group);

    this.rollingPin = createRollingPin(this.mats);
    this.rollingPin.root.position.set(0, 0.64, 0.85);
    this.workGroup.add(this.rollingPin.root);

    this.shakers = createFlavorShakers(this.mats);
    this.shakers.forEach((sh, i) => {
      sh.basePos.set(-2.95 + i * 0.68, 0.04, -1.55);
      sh.group.position.copy(sh.basePos);
      this.workGroup.add(sh.group);
    });

    this.cutters = createCookieCutters(this.mats);
    this.cutters.forEach((ct, i) => {
      ct.homePos.set(-2.4 + i * 1.2, 0.04, 2.72);
      ct.group.position.copy(ct.homePos);
      this.workGroup.add(ct.group);
    });

    // Baking Tray (moves seamlessly between Cut -> Oven -> Decorate!)
    this.bakingTray = createBakingTray(this.mats);
    this.bakingTray.group.position.set(3.25, 0.04, -0.55);
    this.bakingTray.group.scale.setScalar(0.72);
    this.scene.add(this.bakingTray.group);

    // Papercraft Tabletop Oven (always part of the physical world at the back, clear of parchment!)
    this.oven = createOven(this.mats);
    this.oven.root.position.set(0, 0.1, -2.85);
    this.scene.add(this.oven.root);

    // Stage 4 Decorating Station Group
    this.decoGroup = new THREE.Group();
    this.decoGroup.visible = false;
    this.scene.add(this.decoGroup);

    this.doily = createDoilyTurntable(this.mats);
    this.doily.root.position.set(0, 0.035, 0.72);
    this.decoGroup.add(this.doily.root);

    this.coolingRack = createCoolingRack(this.mats);
    this.coolingRack.group.position.set(-2.55, 0.035, -1.15);
    this.decoGroup.add(this.coolingRack.group);

    this.pipingBags = createPipingBags(this.mats);
    this.pipingBags.forEach((pb) => this.decoGroup.add(pb.group));

    this.toppingCups = createToppingCups(this.mats);
    this.toppingCups.forEach((tc) => this.decoGroup.add(tc.group));

    // Gift Box (visible as invitation at top-right in Stage 4, center-stage in Stage 5!)
    this.giftBox = createGiftBox(this.mats);
    this.giftBox.root.position.set(2.85, 0.035, -1.15);
    this.giftBox.root.scale.setScalar(0.55);
    this.giftBox.root.visible = false;
    this.scene.add(this.giftBox.root);

    // Stage 5 Extras: Foil Seals & Fresh Dough Replay Prop
    this.packExtrasGroup = new THREE.Group();
    this.packExtrasGroup.visible = false;
    this.scene.add(this.packExtrasGroup);

    this.seals = createSealStickers(this.mats);
    this.seals.forEach((s) => this.packExtrasGroup.add(s.group));

    this.freshDoughProp = createFreshDoughProp(this.mats);
    this.freshDoughProp.visible = false;
    this.packExtrasGroup.add(this.freshDoughProp);

    // Subtle idle cut-paper hand hint (hidden until >10s idle)
    this.idleHand = createIdlePaperHand(this.mats);
    this.scene.add(this.idleHand);

    this._layoutResponsiveProps();
  }

  setAspect(aspect) {
    this.isPortrait = aspect < 0.98;
    this._layoutResponsiveProps();
    this._updateCameraTargets();
  }

  _layoutResponsiveProps() {
    const p = this.isPortrait;

    // Stage 1 shakers: clearly visible along the LEFT of the parchment (never behind oven!)
    this.shakers.forEach((sh, i) => {
      if (p) {
        sh.basePos.set(-0.95 + i * 0.95, 0.04, 2.75);
      } else {
        sh.basePos.set(-2.95, 0.04, -0.25 + i * 0.85);
      }
      if (sh.anim <= 0) sh.group.position.copy(sh.basePos);
    });

    // Stage 2 cutters: crisp non-overlapping row along front edge (tucked aside in ROLL!)
    const cutterSpread = p ? 0.92 : 1.24;
    this.cutters.forEach((ct, i) => {
      ct.homePos.set((i - 2) * cutterSpread, 0.04, p ? 2.68 : 2.68);
      if (this.stage === 'CUT' && this.draggingCutter !== ct) {
        ct.group.position.copy(ct.homePos);
      }
    });

    // Stage 4 Piping Bags (well inside frame on BOTH 4:3 landscape AND iPhone portrait!)
    this.pipingBags.forEach((pb, i) => {
      if (p) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        pb.homePos.set(-1.62 + col * 0.56, 0.04, 2.38 + row * 0.72);
        pb.group.scale.setScalar(0.84);
      } else {
        const col = i % 2;
        const row = Math.floor(i / 2);
        pb.homePos.set(-2.88 + col * 0.66, 0.04, 0.18 + row * 0.88);
        pb.group.scale.setScalar(0.88);
      }
      if (!this.isPiping || this.selectedIcingIdx !== i) {
        pb.group.position.copy(pb.homePos);
      }
    });

    // Stage 4 Topping Cups (symmetrical right rail, never clipped!)
    this.toppingCups.forEach((tc, i) => {
      if (p) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        tc.homePos.set(0.48 + col * 0.62, 0.04, 2.42 + row * 0.72);
      } else {
        const col = i % 2;
        const row = Math.floor(i / 2);
        tc.homePos.set(2.22 + col * 0.76, 0.04, 0.24 + row * 0.88);
      }
      if (this.draggingToppingCup !== tc) {
        tc.group.position.copy(tc.homePos);
      }
    });

    // Stage 4 Cooling Rack & Gift Box top anchors
    if (this.stage === 'DECORATE') {
      this.coolingRack.group.position.set(p ? -1.18 : -2.35, 0.035, p ? -1.48 : -1.25);
      this.coolingRack.group.scale.setScalar(p ? 0.78 : 0.92);
      this.giftBox.root.position.set(p ? 1.28 : 2.38, 0.035, p ? -1.48 : -1.22);
      this.giftBox.root.scale.setScalar(p ? 0.44 : 0.52);
    }

    // Stage 5 Foil Seals & Fresh Dough Replay Prop
    this.seals.forEach((s, i) => {
      s.homePos.set(p ? -0.92 + i * 0.92 : 2.55, 0.045, p ? 2.45 : -0.75 + i * 0.82);
      if (this.draggingSeal !== s) s.group.position.copy(s.homePos);
    });
    this.freshDoughProp.position.set(p ? -1.35 : -2.65, 0.045, p ? 1.55 : 0.85);
  }

  _updateCameraTargets() {
    const p = this.isPortrait;
    if (this.stage === 'ROLL') {
      this.camTargetPos.set(0, p ? 8.3 : 5.4, p ? 6.4 : 5.75);
      this.camTargetLook.set(0, 0.35, 0.15);
    } else if (this.stage === 'CUT') {
      this.camTargetPos.set(p ? 0 : 0.28, p ? 9.2 : 6.85, p ? 6.2 : 5.55);
      this.camTargetLook.set(p ? 0 : 0.28, 0.18, 0.48);
    } else if (this.stage === 'BAKE') {
      this.camTargetPos.set(0.15, p ? 4.75 : 3.45, p ? 6.45 : 4.25);
      this.camTargetLook.set(0.12, 1.72, -2.5);
    } else if (this.stage === 'DECORATE') {
      this.camTargetPos.set(0, p ? 9.6 : 7.05, p ? 5.6 : 4.95);
      this.camTargetLook.set(0, 0.22, p ? 0.88 : 0.45);
    } else if (this.stage === 'PACK') {
      this.camTargetPos.set(0, p ? 8.4 : 5.45, p ? 6.3 : 5.25);
      this.camTargetLook.set(0, 0.42, p ? 0.55 : 0.25);
    }
  }

  _setupStage(nextStage, immediate = false) {
    this.stage = nextStage;
    this.idleTimer = 0;
    this.idleDemoActive = false;
    this.idleHand.visible = false;
    this.pendingTransition = null;
    this._layoutResponsiveProps();
    this._updateCameraTargets();

    if (immediate) {
      this.camPos.copy(this.camTargetPos);
      this.camLook.copy(this.camTargetLook);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
    }

    if (nextStage === 'ROLL') {
      this.workGroup.visible = true;
      this.decoGroup.visible = false;
      this.packExtrasGroup.visible = false;
      this.giftBox.root.visible = false;
      this.oven.root.visible = true;
      this.ovenDoorTarget = 0;
      this.bakingTray.group.visible = true;
      this.bakingTray.group.position.set(this.isPortrait ? 2.45 : 3.55, 0.04, -0.75);
      this.bakingTray.group.scale.setScalar(0.62);
      this.bakingTray.group.rotation.set(0, 0, 0);

      // Show rolling pin resting on dough, tuck cutters softly to the side
      this.rollingPin.root.visible = true;
      this.rollPinTarget.set(0, 0.62, 0.72);
      this.rollingPin.root.position.copy(this.rollPinTarget);
      this.shakers.forEach((s) => (s.group.visible = true));
      this.cutters.forEach((ct, i) => {
        ct.group.visible = true;
        ct.group.position.set(this.isPortrait ? -2.2 + i * 0.9 : 3.7, 0.04, this.isPortrait ? 3.55 : 0.65 + i * 0.55);
        ct.group.scale.setScalar(0.75);
      });
    } else if (nextStage === 'CUT') {
      this.workGroup.visible = true;
      this.decoGroup.visible = false;
      this.packExtrasGroup.visible = false;
      this.dough.switchToFlatSheet();
      this.selectedCutter = this.cutters[0];

      // Tuck rolling pin neatly on the upper-left rack
      this.rollPinTarget.set(this.isPortrait ? -1.85 : -3.55, 0.28, -0.7);
      this.shakers.forEach((s) => (s.group.visible = false));

      // Slide baking tray into clear view at top-right / back
      this.bakingTray.group.visible = true;
      const trayPos = this.isPortrait ? new THREE.Vector3(0.0, 0.04, -1.68) : new THREE.Vector3(3.15, 0.04, -0.35);
      this._animateMove(this.bakingTray.group, trayPos, 0.6, 0.25, this.isPortrait ? 0.68 : 0.78);

      // Bring the 5 colorful cookie cutters proudly to the front edge!
      this.cutters.forEach((ct, i) => {
        ct.group.visible = true;
        this._animateMove(ct.group, ct.homePos, 0.5 + i * 0.05, 0.35, 1.0);
      });
    } else if (nextStage === 'BAKE') {
      this.workGroup.visible = false;
      this.decoGroup.visible = false;
      this.packExtrasGroup.visible = false;
      this.giftBox.root.visible = false;
      this.oven.root.visible = true;
      this.bakeProgress = 0;
      this.bakeDone = false;
      this.dialAngle = 0;
      this.lastDialStep = 0;
      this.oven.dialKnob.rotation.z = 0;
      this.oven.flagGroup.scale.setScalar(0.001);
      this.oven.lampMat.color.set('#d9cfc2');
      this.oven.lampMat.emissive.set('#000000');

      // Ensure every cookie is seated cleanly inside its baking tray slot!
      this.cookies.forEach((c, i) => {
        this.bakingTray.group.add(c.root);
        c.root.position.copy(this.bakingTray.slotPositions[i]);
        c.root.scale.setScalar(1.0);
        c.root.rotation.set(0, 0, 0);
      });

      // Attach tray to oven interior & smoothly slide inside, then close door!
      this.oven.root.add(this.bakingTray.group);
      this.bakingTray.group.scale.setScalar(0.76);
      this.bakingTray.group.position.set(-0.48, 0.94, 2.05);
      this.ovenDoorTarget = 1.35;
      this.ovenDoorAngle = 1.35;
      this._animateMove(this.bakingTray.group, this.oven.trayInsidePos, 0.65, 0.05, 0.76, () => {
        this.ovenDoorTarget = 0;
        this.sound.playBoxFold();
      });
    } else if (nextStage === 'DECORATE') {
      this.workGroup.visible = false;
      this.decoGroup.visible = true;
      this.packExtrasGroup.visible = false;
      this.oven.root.visible = false;
      this.bakingTray.group.visible = false;

      // Put Gift Box open & inviting at top-right!
      this.giftBox.root.visible = true;
      this.giftBox.ribbonGroup.visible = false;
      this.giftBox.lidPivot.rotation.x = -1.75;
      this.lidCloseProgress = 0;
      this._layoutResponsiveProps();

      // Place first cookie HUGE on the lace doily turntable, others on cooling rack
      this.activeCookieIdx = 0;
      this.doily.spinner.rotation.y = 0;
      this._placeCookiesForDecorate();

      // Default tool: Strawberry Pink icing piping bag ready!
      this.decoToolMode = 'icing';
      this.selectedIcingIdx = 0;
      this.sound.playPop(4);
    } else if (nextStage === 'PACK') {
      this.workGroup.visible = false;
      this.decoGroup.visible = false;
      this.oven.root.visible = false;
      this.bakingTray.group.visible = false;
      this.packExtrasGroup.visible = true;
      this.packPhase = 'PLACE';
      this.packedCookieIndices = [];
      this.lidCloseProgress = 0;
      this.ribbonTied = false;
      this.ribbonBloom = 0;
      this.celebrateEnergy = 0;

      // Center the handcrafted Gift Box!
      this.giftBox.root.visible = true;
      this.giftBox.ribbonGroup.visible = false;
      this.giftBox.untiedGroup.visible = true;
      this.giftBox.bowGroup.scale.setScalar(0.001);
      while (this.giftBox.sealsOnLid.children.length) {
        this.giftBox.sealsOnLid.remove(this.giftBox.sealsOnLid.children[0]);
      }
      this._animateMove(this.giftBox.root, new THREE.Vector3(0, 0.04, -0.32), 0.55, 0.15, 1.0);
      this.giftBox.lidPivot.rotation.x = -1.95;

      // Hide seals & fresh-dough replay until bow is tied!
      this.seals.forEach((s) => (s.group.visible = false));
      this.freshDoughProp.visible = false;

      // Line up all decorated cookies cleanly in front of the open Gift Box (zero overlap!)
      const count = this.cookies.length;
      const spread = this.isPortrait ? 1.06 : 1.56;
      const cookiePackScale = this.isPortrait ? 0.74 : 0.84;
      this.cookies.forEach((c, i) => {
        this.scene.add(c.root);
        const zRow = this.isPortrait ? (i < 2 ? 1.72 : 2.82) : 2.02;
        const xCol = this.isPortrait
          ? ((i % 2) - 0.5) * 1.48
          : (i - (count - 1) / 2) * spread;
        const target = new THREE.Vector3(xCol, 0.055, zRow);
        if (immediate) {
          c.root.position.copy(target);
          c.root.scale.setScalar(cookiePackScale);
        } else {
          this._animateMove(c.root, target, 0.52 + i * 0.05, 0.42, cookiePackScale);
        }
        c.root.rotation.set(0, 0, 0);
      });
      if (immediate) {
        this.giftBox.root.position.set(0, 0.04, -0.32);
        this.giftBox.root.scale.setScalar(1.0);
      }
    }
  }

  _placeCookiesForDecorate() {
    this.cookies.forEach((c, i) => {
      if (i === this.activeCookieIdx) {
        this.doily.cookieMount.add(c.root);
        c.root.position.set(0, 0, 0);
        c.root.rotation.set(0, 0, 0);
        c.root.scale.setScalar(1.62); // Big & joyful to paint and decorate!
      } else {
        this.coolingRack.group.add(c.root);
        const slot = this.coolingRack.slots[i % this.coolingRack.slots.length];
        c.root.position.copy(slot);
        c.root.rotation.set(0, 0, 0);
        c.root.scale.setScalar(0.62);
      }
    });
  }

  // ==================== POINTER INPUT ====================

  _setPointerNDC(clientX, clientY, domEl) {
    const rect = domEl.getBoundingClientRect();
    this.pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);
  }

  _intersectPlane(planeY = 0.14) {
    this.tablePlane.constant = -planeY;
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.tablePlane, hit) ? hit : null;
  }

  onPointerDown(clientX, clientY, domEl) {
    this.sound.unlock();
    this.idleTimer = 0;
    this.idleDemoActive = false;
    this.idleHand.visible = false;
    this._setPointerNDC(clientX, clientY, domEl);

    if (this.stage === 'ROLL') this._downRoll();
    else if (this.stage === 'CUT') this._downCut();
    else if (this.stage === 'BAKE') this._downBake(clientY);
    else if (this.stage === 'DECORATE') this._downDecorate();
    else if (this.stage === 'PACK') this._downPack();
  }

  onPointerMove(clientX, clientY, domEl) {
    this.idleTimer = 0;
    this._setPointerNDC(clientX, clientY, domEl);

    if (this.stage === 'ROLL') this._moveRoll();
    else if (this.stage === 'CUT') this._moveCut();
    else if (this.stage === 'BAKE') this._moveBake(clientY);
    else if (this.stage === 'DECORATE') this._moveDecorate();
    else if (this.stage === 'PACK') this._movePack();
  }

  onPointerUp() {
    if (this.stage === 'ROLL') {
      this.isRolling = false;
      this.lastRollPoint = null;
    } else if (this.stage === 'CUT') {
      this._upCut();
    } else if (this.stage === 'BAKE') {
      this.dialDragging = false;
    } else if (this.stage === 'DECORATE') {
      this._upDecorate();
    } else if (this.stage === 'PACK') {
      this._upPack();
    }
  }

  // ---------- STAGE 1: ROLL ----------

  _downRoll() {
    // 1. Check Flavor Shakers (Discovery #1! Ignore shakers currently mid-air over dough)
    for (let i = 0; i < this.shakers.length; i++) {
      const sh = this.shakers[i];
      if (sh.anim > 0.15) continue;
      if (this.raycaster.intersectObject(sh.group, true).length > 0) {
        sh.anim = 1.0;
        this.dough.setFlavor(sh.flavorKey);
        this.sound.playShake(i);
        const fl = DOUGH_FLAVORS[sh.flavorKey];
        this._spawnPaperBurst(
          new THREE.Vector3(0, 0.72, 0.55),
          14,
          [fl.crumb, fl.rawBase, '#fff9ec'],
          0.95
        );
        return;
      }
    }

    // 2. Check non-active props (subtle wiggle only!)
    for (const ct of this.cutters) {
      if (this.raycaster.intersectObject(ct.group, true).length > 0) {
        ct.wiggle = 1.0;
        this.sound.playBouncingCrumb();
        return;
      }
    }

    // 3. Check rolling pin or dough or parchment
    const pt = this._intersectPlane(0.35);
    if (!pt) return;
    if (Math.hypot(pt.x, pt.z - 0.55) < 2.65) {
      this.isRolling = true;
      this.lastRollPoint = pt.clone();
      this.rollPinTarget.set(
        THREE.MathUtils.clamp(pt.x * 0.45, -1.1, 1.1),
        0.54 - this.dough.progress * 0.22,
        THREE.MathUtils.clamp(pt.z, -0.75, 1.85)
      );
      // Even a gentle tap advances rolling slightly with flour puff so tapping kids get instant feedback!
      this._advanceRoll(0.06, pt);
    }
  }

  _moveRoll() {
    if (!this.isRolling) return;
    const pt = this._intersectPlane(0.35);
    if (!pt) return;
    if (!this.lastRollPoint) {
      this.lastRollPoint = pt.clone();
      return;
    }

    const dx = pt.x - this.lastRollPoint.x;
    const dz = pt.z - this.lastRollPoint.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.03) {
      this.rollPinTarget.set(
        THREE.MathUtils.clamp(pt.x * 0.48, -1.15, 1.15),
        0.54 - this.dough.progress * 0.22,
        THREE.MathUtils.clamp(pt.z, -0.82, 1.92)
      );
      this.rollPinAngle += dz * 2.8 + dx * 0.8;
      this._advanceRoll(dist * 0.14, pt, dist * 5);
      this.lastRollPoint.copy(pt);
    }
  }

  _advanceRoll(amount, worldPos, speed = 0.6) {
    if (this.stage !== 'ROLL' || this.pendingTransition) return;
    this.dough.progress = this.dough.progress + amount;
    this.sound.playRollTick(speed);

    if (Math.random() < 0.48) {
      this._spawnPaperBurst(
        new THREE.Vector3(
          THREE.MathUtils.clamp(worldPos.x, -1.5, 1.5),
          0.32,
          THREE.MathUtils.clamp(worldPos.z, -0.5, 1.6)
        ),
        3,
        ['#fffaf0', '#f7ecd8', DOUGH_FLAVORS[this.dough.flavor].crumb],
        0.7
      );
    }

    if (this.dough.progress >= 1.0 && !this.pendingTransition) {
      this.isRolling = false;
      this.sound.playPop(5);
      this._spawnPaperBurst(new THREE.Vector3(0, 0.35, 0.55), 18, ['#fffaf0', '#ffd24c', '#f26d85'], 1.25);
      this.pendingTransition = { target: 'CUT', delay: 0.45 };
    }
  }

  // ---------- STAGE 2: CUT ----------

  _downCut() {
    if (this.pendingTransition) return;

    // 1. Tap Oven directly if >= 1 cookie already on tray -> bake early!
    if (this.cookies.length >= 1 && this.raycaster.intersectObject(this.oven.root, true).length > 0) {
      this.sound.playPop(6);
      this._setupStage('BAKE');
      return;
    }

    // 2. Grab a cookie cutter?
    for (const ct of this.cutters) {
      if (this.raycaster.intersectObject(ct.group, true).length > 0) {
        this.selectedCutter = ct;
        this.draggingCutter = ct;
        this.sound.playPaperRustle(0.6, 1.2);
        const pt = this._intersectPlane(0.6);
        if (pt) ct.group.position.set(pt.x, 0.52, pt.z);
        return;
      }
    }

    // 3. Direct tap on the dough sheet -> stamp with currently selected cutter!
    const pt = this._intersectPlane(0.18);
    if (pt && this._isOnDoughSheet(pt.x, pt.z) && this.selectedCutter) {
      this._stampCutterAt(this.selectedCutter, pt.x, pt.z);
    }
  }

  _moveCut() {
    if (!this.draggingCutter) return;
    const pt = this._intersectPlane(0.55);
    if (!pt) return;
    this.draggingCutter.group.position.set(
      THREE.MathUtils.clamp(pt.x, -3.2, 3.2),
      0.56,
      THREE.MathUtils.clamp(pt.z, -1.6, 3.1)
    );
  }

  _upCut() {
    if (!this.draggingCutter) return;
    const ct = this.draggingCutter;
    this.draggingCutter = null;

    if (this._isOnDoughSheet(ct.group.position.x, ct.group.position.z)) {
      this._stampCutterAt(ct, ct.group.position.x, ct.group.position.z);
    } else {
      // Gently bounce back to tray (it remains selected so tapping dough next also works!)
      this._animateMove(ct.group, ct.homePos, 0.3, 0.25, 1.0);
    }
  }

  _isOnDoughSheet(wx, wz) {
    const dx = wx / 1.9;
    const dz = (wz - 0.55) / 1.48;
    return dx * dx + dz * dz <= 1.08;
  }

  _findClearDoughSpot(wx, wz) {
    // Magnetic forgiveness: clamp inside dough sheet and gently nudge away from existing cutout holes
    let x = THREE.MathUtils.clamp(wx, -1.22, 1.22);
    let z = THREE.MathUtils.clamp(wz - 0.55, -0.88, 0.88);
    for (let iter = 0; iter < 8; iter++) {
      let pushed = false;
      for (const h of this.dough.holes) {
        const dx = x - h.x;
        const dz = z - h.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.02) {
          const ang = d < 0.01 ? iter * 1.4 : Math.atan2(dz, dx);
          x += Math.cos(ang) * (1.04 - d) * 0.65;
          z += Math.sin(ang) * (1.04 - d) * 0.65;
          x = THREE.MathUtils.clamp(x, -1.25, 1.25);
          z = THREE.MathUtils.clamp(z, -0.9, 0.9);
          pushed = true;
        }
      }
      if (!pushed) break;
    }
    return { x, z };
  }

  _stampCutterAt(ct, wx, wz) {
    if (this.cookies.length >= MAX_COOKIES || this.pendingTransition) return;

    const local = this._findClearDoughSpot(wx, wz);
    const worldX = local.x;
    const worldZ = local.z + 0.55;

    // Visual stamp drop
    ct.group.position.set(worldX, 0.08, worldZ);
    this.sound.playCutStamp();

    // Punch REAL shaped hole into the layered dough sheet!
    this.dough.addHole(local.x, local.z, ct.id, 0.64);

    // Paper dough curls & sparkles burst!
    const fl = DOUGH_FLAVORS[this.dough.flavor];
    this._spawnPaperBurst(new THREE.Vector3(worldX, 0.22, worldZ), 12, [fl.crumb, ct.color, '#fffaf0'], 1.1);

    // Spawn the actual 3D layered papercraft cookie!
    const cookie = createPapercraftCookie(ct.id, this.dough.flavor, this.mats, 0.64);
    const slotIdx = this.cookies.length;
    this.cookies.push(cookie);

    // Put cookie onto baking tray via joyful parabolic hop!
    this.bakingTray.group.add(cookie.root);
    const localStart = this.bakingTray.group.worldToLocal(new THREE.Vector3(worldX, 0.22, worldZ));
    cookie.root.position.copy(localStart);
    const slotTarget = this.bakingTray.slotPositions[slotIdx];
    this._animateMove(cookie.root, slotTarget, 0.52, 0.95, 1.0, () => {
      this.sound.playPop(slotIdx + 1);
    });

    // Return cutter cleanly to its home slot after crisp stamp beat
    setTimeout(() => {
      if (this.stage === 'CUT' && this.draggingCutter !== ct) {
        this._animateMove(ct.group, ct.homePos, 0.34, 0.3, 1.0);
      }
    }, 170);

    // Once 4 cookies fill the baking tray, glide smoothly into the Oven!
    if (this.cookies.length >= MAX_COOKIES) {
      this.pendingTransition = { target: 'BAKE', delay: 0.78 };
    }
  }

  // ---------- STAGE 3: BAKE ----------

  _downBake(clientY) {
    // 1. If baking is done, tapping the open oven door or tray pulls cookies out to decorate!
    if (this.bakeDone) {
      if (
        this.raycaster.intersectObject(this.bakingTray.group, true).length > 0 ||
        this.raycaster.intersectObject(this.oven.doorPivot, true).length > 0 ||
        this.raycaster.intersectObject(this.oven.root, true).length > 0
      ) {
        this.sound.playPop(5);
        this._spawnPaperBurst(new THREE.Vector3(0, 1.3, -1.2), 14, ['#ffd24c', '#fffaf0', '#f26d85'], 1.1);
        this._setupStage('DECORATE');
        return;
      }
    }

    // 2. Check chunky rotary dial (generous hitbox on right side of oven!)
    if (this.raycaster.intersectObject(this.oven.dialCenter, true).length > 0) {
      this.dialDragging = true;
      this.dialDragStartY = clientY;
      this.dialStartAngle = this.dialAngle;
      // Even a simple tap advances the dial!
      this._setDialAngle(Math.min(Math.PI * 1.35, this.dialAngle + 0.58));
      return;
    }

    // 3. Tapping the oven glass jiggles the cookies happily inside! (Playful discovery!)
    if (this.raycaster.intersectObject(this.oven.windowGlass, true).length > 0) {
      this.sound.playPop(Math.floor(Math.random() * 5));
      for (const c of this.cookies) {
        c.root.position.y += 0.16;
      }
      return;
    }

    // 4. Anywhere on the right panel also catches the dial forgivingly
    if (this.raycaster.intersectObject(this.oven.root, true).length > 0) {
      this.dialDragging = true;
      this.dialDragStartY = clientY;
      this.dialStartAngle = this.dialAngle;
      this._setDialAngle(Math.min(Math.PI * 1.35, this.dialAngle + 0.45));
    }
  }

  _moveBake(clientY) {
    if (!this.dialDragging) return;
    const dy = this.dialDragStartY - clientY;
    const nextAngle = THREE.MathUtils.clamp(this.dialStartAngle + dy * 0.016, 0, Math.PI * 1.38);
    this._setDialAngle(nextAngle);
  }

  _setDialAngle(angle) {
    this.dialAngle = angle;
    this.oven.dialKnob.rotation.z = -angle;
    const step = Math.floor(angle / 0.24);
    if (step !== this.lastDialStep) {
      this.lastDialStep = step;
      this.sound.playDialClick(step);
      if (angle > 0.55 && !this.bakeDone) {
        this.sound.playOvenWarmPulse();
      }
    }
  }

  // ---------- STAGE 4: DECORATE ----------

  _downDecorate() {
    // 1. Tap open Gift Box at top-right -> move to Stage 5 PACK!
    if (this.raycaster.intersectObject(this.giftBox.root, true).length > 0) {
      this.sound.playPop(6);
      this._setupStage('PACK');
      return;
    }

    // 2. Tap another cookie on the cooling rack -> swap it onto the lace doily!
    for (let i = 0; i < this.cookies.length; i++) {
      if (i === this.activeCookieIdx) continue;
      if (this.raycaster.intersectObject(this.cookies[i].root, true).length > 0) {
        this.activeCookieIdx = i;
        this._placeCookiesForDecorate();
        this.sound.playPaperRustle(0.75, 1.15);
        this.sound.playPop(i + 2);
        return;
      }
    }

    // 3. Tap a Piping Bag -> select icing color!
    for (let i = 0; i < this.pipingBags.length; i++) {
      if (this.raycaster.intersectObject(this.pipingBags[i].group, true).length > 0) {
        this.decoToolMode = 'icing';
        this.selectedIcingIdx = i;
        this.sound.playPop(i);
        this.sound.playPaperRustle(0.45, 1.2);
        return;
      }
    }

    // 4. Tap or start dragging from a Topping Origami Cup!
    for (let i = 0; i < this.toppingCups.length; i++) {
      if (this.raycaster.intersectObject(this.toppingCups[i].group, true).length > 0) {
        this.decoToolMode = 'topping';
        this.selectedToppingIdx = i;
        this.draggingToppingCup = this.toppingCups[i];
        this.sound.playPop(i + 3);
        this.sound.playPaperRustle(0.55, 1.35);
        return;
      }
    }

    // 5. Interact with active Cookie or Lace Doily Turntable!
    const cookie = this.cookies[this.activeCookieIdx];
    if (!cookie) return;
    const hit = this._intersectPlane(0.36);
    if (!hit) return;

    const local = cookie.decoGroup.worldToLocal(hit.clone());
    const onCookie = isPointInCookie(cookie.shapeId, local.x, local.z, cookie.scale * 1.03);

    if (onCookie) {
      if (this.decoToolMode === 'icing') {
        this.isPiping = true;
        this.lastPipeLocal = local.clone();
        this.activePipingWorldPos.copy(hit);
        this._addIcingDot(cookie, local.x, local.z);
        this.sound.playIcingSquish(0.6);
      } else {
        this._dropToppingOnCookie(cookie, local.x, local.z, TOPPING_TYPES[this.selectedToppingIdx].id);
        this.lastSprinkleTime = this.time;
      }
      return;
    }

    // Check outer lace doily rim -> spin turntable OR playful stray sprinkle bounce!
    const dCenter = Math.hypot(hit.x - this.doily.root.position.x, hit.z - this.doily.root.position.z);
    if (dCenter < 1.88) {
      if (this.decoToolMode === 'topping') {
        // Playful detour reaction: stray topping bounces off lace doily!
        this.sound.playBouncingCrumb();
        this._spawnPaperBurst(new THREE.Vector3(hit.x, 0.22, hit.z), 5, ['#f26d85', '#ffd24c', '#5fd0b8'], 0.85);
      }
      this.isSpinningDoily = true;
      this.doilySpinStartAngle = Math.atan2(
        hit.z - this.doily.root.position.z,
        hit.x - this.doily.root.position.x
      );
      this.doilyRotStart = this.doily.spinner.rotation.y;
    }
  }

  _moveDecorate() {
    const cookie = this.cookies[this.activeCookieIdx];
    if (!cookie) return;

    // Dragging directly from a topping cup onto the cookie
    if (this.draggingToppingCup) {
      const hit = this._intersectPlane(0.5);
      if (hit) {
        const local = cookie.decoGroup.worldToLocal(hit.clone());
        if (
          isPointInCookie(cookie.shapeId, local.x, local.z, cookie.scale * 1.02) &&
          this.time - this.lastSprinkleTime > 0.14
        ) {
          this._dropToppingOnCookie(cookie, local.x, local.z, this.draggingToppingCup.id);
          this.lastSprinkleTime = this.time;
        }
      }
      return;
    }

    // Spinning the lace doily turntable
    if (this.isSpinningDoily) {
      const hit = this._intersectPlane(0.2);
      if (hit) {
        const ang = Math.atan2(
          hit.z - this.doily.root.position.z,
          hit.x - this.doily.root.position.x
        );
        this.doily.spinner.rotation.y = this.doilyRotStart - (ang - this.doilySpinStartAngle);
      }
      return;
    }

    // Continuous 3D layered paper icing piping!
    if (this.isPiping) {
      const hit = this._intersectPlane(0.38);
      if (!hit) return;
      this.activePipingWorldPos.copy(hit);
      const local = cookie.decoGroup.worldToLocal(hit.clone());
      if (!isPointInCookie(cookie.shapeId, local.x, local.z, cookie.scale * 1.02)) {
        this.lastPipeLocal = null;
        return;
      }
      if (!this.lastPipeLocal) {
        this.lastPipeLocal = local.clone();
        this._addIcingDot(cookie, local.x, local.z);
        return;
      }
      const dist = Math.hypot(local.x - this.lastPipeLocal.x, local.z - this.lastPipeLocal.z);
      if (dist > 0.055) {
        this._addIcingSegment(cookie, this.lastPipeLocal.x, this.lastPipeLocal.z, local.x, local.z);
        this.lastPipeLocal.copy(local);
        this.pipingSqueeze = 1.0;
        this.sound.playIcingSquish(dist * 10);
      }
      return;
    }

    // Dragging across cookie in topping mode scatters sprinkles/toppings smoothly!
    if (this.decoToolMode === 'topping' && this.time - this.lastSprinkleTime > 0.14) {
      const hit = this._intersectPlane(0.38);
      if (hit) {
        const local = cookie.decoGroup.worldToLocal(hit.clone());
        if (isPointInCookie(cookie.shapeId, local.x, local.z, cookie.scale * 1.0)) {
          this._dropToppingOnCookie(cookie, local.x, local.z, TOPPING_TYPES[this.selectedToppingIdx].id);
          this.lastSprinkleTime = this.time;
        }
      }
    }
  }

  _upDecorate() {
    this.isPiping = false;
    this.lastPipeLocal = null;
    this.isSpinningDoily = false;
    this.draggingToppingCup = null;
  }

  _getNextIcingHex() {
    const cfg = ICING_COLORS[this.selectedIcingIdx];
    if (!cfg.rainbow) return cfg.hex;
    this.rainbowPhase += 0.22;
    return RAINBOW_HEXES[Math.floor(this.rainbowPhase) % RAINBOW_HEXES.length];
  }

  _sampleIcingHeight(cookie, x, z, radius = 0.14) {
    let maxY = 0;
    for (let i = 0; i < cookie.icingHeightMap.length; i++) {
      const s = cookie.icingHeightMap[i];
      const dx = s.x - x;
      const dz = s.z - z;
      if (dx * dx + dz * dz < radius * radius) {
        if (s.y > maxY) maxY = s.y;
      }
    }
    return maxY;
  }

  _addIcingDot(cookie, x, z) {
    if (cookie.decoGroup.children.length > 260) return; // Safe mobile triangle cap!
    const hex = this._getNextIcingHex();
    const baseY = Math.min(0.09, this._sampleIcingHeight(cookie, x, z, 0.1) * 0.52);
    const rim = new THREE.Mesh(this.sharedIcingRimGeo, this.mats.paperEdgeWhite);
    rim.position.set(x, baseY + 0.009, z);
    const mesh = new THREE.Mesh(this.sharedIcingDotGeo, this.mats.icing(hex));
    mesh.position.set(x, baseY + 0.025, z);
    mesh.receiveShadow = true;
    cookie.decoGroup.add(rim, mesh);
    cookie.icingHeightMap.push({ x, z, y: baseY + 0.048 });
    cookie.decorationCount++;
  }

  _addIcingSegment(cookie, x0, z0, x1, z1) {
    if (cookie.decoGroup.children.length > 260) return;
    const hex = this._getNextIcingHex();
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(z1 - z0, x1 - x0);
    const baseY = Math.min(0.09, this._sampleIcingHeight(cookie, mx, mz, 0.09) * 0.48);

    const mat = this.mats.icing(hex);
    const seg = new THREE.Mesh(this.sharedIcingSegGeo, mat);
    seg.scale.set(len + 0.015, 0.52, 1.0);
    seg.position.set(mx, baseY + 0.024, mz);
    seg.rotation.y = -ang;
    seg.receiveShadow = true;
    cookie.decoGroup.add(seg);

    const cap = new THREE.Mesh(this.sharedIcingDotGeo, mat);
    cap.position.set(x1, baseY + 0.025, z1);
    cap.receiveShadow = true;
    cookie.decoGroup.add(cap);

    cookie.icingHeightMap.push({ x: x1, z: z1, y: baseY + 0.048 });
    cookie.decorationCount++;
  }

  _dropToppingOnCookie(cookie, x, z, typeId) {
    if (cookie.decoGroup.children.length > 270) return;
    const count = typeId === 'sprinkles' ? 3 : 1;
    for (let k = 0; k < count; k++) {
      const ox = k === 0 ? 0 : (Math.random() - 0.5) * 0.24;
      const oz = k === 0 ? 0 : (Math.random() - 0.5) * 0.24;
      const tx = x + ox;
      const tz = z + oz;
      if (!isPointInCookie(cookie.shapeId, tx, tz, cookie.scale * 0.98)) continue;

      const mesh = createToppingMesh(typeId, this.mats);
      const surfaceY = this._sampleIcingHeight(cookie, tx, tz, 0.15);
      mesh.position.set(tx, surfaceY + 0.42, tz);
      cookie.decoGroup.add(mesh);
      this._animateMove(mesh, new THREE.Vector3(tx, surfaceY + 0.005, tz), 0.22, 0.05, 1.0);
      cookie.decorationCount++;
    }
    this.sound.playPop(cookie.decorationCount);
  }

  // ---------- STAGE 5: PACK & CELEBRATE ----------

  _downPack() {
    if (this.packPhase === 'PLACE') {
      // Grab or tap any unpacked cookie!
      for (let i = 0; i < this.cookies.length; i++) {
        if (this.packedCookieIndices.includes(i)) continue;
        if (this.raycaster.intersectObject(this.cookies[i].root, true).length > 0) {
          this.draggingCookieIdx = i;
          this.sound.playPaperRustle(0.6, 1.15);
          return;
        }
      }
      // Also allow tapping directly inside the open box to auto-fly the next unpacked cookie in!
      if (this.raycaster.intersectObject(this.giftBox.root, true).length > 0) {
        for (let i = 0; i < this.cookies.length; i++) {
          if (!this.packedCookieIndices.includes(i)) {
            this._packCookieIntoNextSlot(i);
            return;
          }
        }
      }
      return;
    }

    if (this.packPhase === 'CLOSE_LID') {
      if (this.raycaster.intersectObject(this.giftBox.root, true).length > 0) {
        this._closeGiftBoxLid();
      }
      return;
    }

    if (this.packPhase === 'TIE_RIBBON') {
      if (this.raycaster.intersectObject(this.giftBox.root, true).length > 0) {
        this._tieGiftBoxRibbon();
      }
      return;
    }

    if (this.packPhase === 'CELEBRATE') {
      // 1. Tap Fresh Dough Mini-Prop -> archive finished Gift Box onto bakery shelf & bake a new batch!
      if (
        this.freshDoughProp.visible &&
        this.raycaster.intersectObject(this.freshDoughProp, true).length > 0
      ) {
        this._startNextRoundWithShelfTrophy();
        return;
      }

      // 2. Tap or drag a Foil Seal -> stamp onto the gift box lid!
      for (const s of this.seals) {
        if (s.group.visible && this.raycaster.intersectObject(s.group, true).length > 0) {
          this.draggingSeal = s;
          this.sound.playPaperRustle(0.55, 1.3);
          return;
        }
      }

      // 3. Tap finished Gift Box -> joyful bounce + peek open lid + sparkle shower!
      if (this.raycaster.intersectObject(this.giftBox.root, true).length > 0) {
        this.boxBounce = 1.0;
        this.boxPeekTimer = 1.25;
        this.celebrateEnergy = Math.min(1.4, this.celebrateEnergy + 0.8);
        this.sound.playRibbonBloom();
        this._spawnConfetti(new THREE.Vector3(0, 1.2, -0.3), 24);
      }
    }
  }

  _movePack() {
    if (this.packPhase === 'PLACE' && this.draggingCookieIdx >= 0) {
      const hit = this._intersectPlane(0.75);
      if (hit) {
        const c = this.cookies[this.draggingCookieIdx];
        c.root.position.set(
          THREE.MathUtils.clamp(hit.x, -3.2, 3.2),
          0.78,
          THREE.MathUtils.clamp(hit.z, -2.0, 2.8)
        );
      }
    } else if (this.packPhase === 'CELEBRATE' && this.draggingSeal) {
      const hit = this._intersectPlane(0.95);
      if (hit) {
        this.draggingSeal.group.position.set(hit.x, 1.05, hit.z);
      }
    }
  }

  _upPack() {
    if (this.packPhase === 'PLACE' && this.draggingCookieIdx >= 0) {
      const idx = this.draggingCookieIdx;
      this.draggingCookieIdx = -1;
      // Both drag-to-box AND quick tap pack the cookie cleanly into the box!
      this._packCookieIntoNextSlot(idx);
    } else if (this.packPhase === 'CELEBRATE' && this.draggingSeal) {
      const s = this.draggingSeal;
      this.draggingSeal = null;
      this._stampSealOnBox(s);
    }
  }

  _packCookieIntoNextSlot(cookieIdx) {
    if (this.packedCookieIndices.includes(cookieIdx)) return;
    const slotIdx = this.packedCookieIndices.length;
    this.packedCookieIndices.push(cookieIdx);

    const cookie = this.cookies[cookieIdx];
    const worldPos = new THREE.Vector3();
    cookie.root.getWorldPosition(worldPos);

    this.giftBox.packedCookiesGroup.add(cookie.root);
    cookie.root.position.copy(this.giftBox.packedCookiesGroup.worldToLocal(worldPos));

    const targetSlot = this.giftBox.slotPositions[slotIdx];
    this._animateMove(cookie.root, targetSlot, 0.45, 0.72, 0.86, () => {
      this.sound.playPop(slotIdx + 2);
      this._spawnPaperBurst(
        this.giftBox.packedCookiesGroup.localToWorld(targetSlot.clone()).add(new THREE.Vector3(0, 0.2, 0)),
        8,
        ['#fffaf0', '#ffd24c', '#f26d85'],
        0.9
      );
      if (this.packedCookieIndices.length >= this.cookies.length) {
        this.packPhase = 'CLOSE_LID';
      }
    });
  }

  _closeGiftBoxLid() {
    this.packPhase = 'TIE_RIBBON';
    this.lidCloseProgress = 1;
    this.sound.playBoxFold();
    setTimeout(() => {
      if (this.stage === 'PACK') {
        this.giftBox.ribbonGroup.visible = true;
        this.sound.playPaperRustle(0.65, 1.3);
      }
    }, 340);
  }

  _tieGiftBoxRibbon() {
    this.packPhase = 'CELEBRATE';
    this.ribbonTied = true;
    this.giftBox.untiedGroup.visible = false;
    this.celebrateEnergy = 1.25;
    this.boxBounce = 1.0;
    this.sound.playRibbonBloom();
    setTimeout(() => this.sound.playCelebration(), 220);

    // Big paper confetti shower!
    this._spawnConfetti(new THREE.Vector3(0, 1.35, -0.3), 42);

    // Reveal the 3 shiny foil seals & the fresh-dough replay mat!
    this.seals.forEach((s, i) => {
      s.group.visible = true;
      s.group.scale.setScalar(0.01);
      s.group.position.copy(s.homePos);
      this._animateMove(s.group, s.homePos, 0.45 + i * 0.08, 0.2, 1.0);
    });

    this.freshDoughProp.visible = true;
    this.freshDoughProp.scale.setScalar(0.01);
    this._animateMove(this.freshDoughProp, this.freshDoughProp.position.clone(), 0.65, 0.25, 1.0);
  }

  _stampSealOnBox(sealObj) {
    const corners = [
      new THREE.Vector3(-1.32, 0.015, -0.95),
      new THREE.Vector3(1.32, 0.015, -0.95),
      new THREE.Vector3(1.32, 0.015, 0.95),
      new THREE.Vector3(-1.32, 0.015, 0.95),
    ];
    const idx = this.giftBox.sealsOnLid.children.length % corners.length;
    const stamp = new THREE.Group();
    const baseGeo = extrudePaperFlat(createScallopedShape(0.28, 12, 0.03), 0.025, 0.004);
    const base = new THREE.Mesh(baseGeo, this.mats.foil(sealObj.color));
    const emblemGeo = extrudePaperFlat(createCookieShape(sealObj.shape, 0.16), 0.018, 0.004);
    const emblem = new THREE.Mesh(emblemGeo, this.mats.paper('#fffaf0'));
    emblem.position.y = 0.028;
    stamp.add(base, emblem);
    stamp.position.copy(corners[idx]);
    stamp.rotation.y = (Math.random() - 0.5) * 0.45;
    this.giftBox.sealsOnLid.add(stamp);

    this.sound.playPop(5 + idx);
    this._spawnConfetti(new THREE.Vector3(0, 1.25, -0.3), 12);

    // Return source seal nicely back to tray so child can stamp more!
    this._animateMove(sealObj.group, sealObj.homePos, 0.3, 0.2, 1.0);
  }

  _startNextRoundWithShelfTrophy() {
    this.sound.playPop(6);
    this.sound.playPaperRustle(0.85, 1.1);

    // Add a miniature papercraft Gift Box trophy onto the back bakery shelf! ("遊びの記憶を接続")
    const trophyIdx = this.roundCount % 4;
    const trophy = new THREE.Group();
    const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.26, 0.52), this.mats.stripeBoxMat);
    boxMesh.position.y = 0.13;
    const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.56), this.mats.paper('#f595a9'));
    lidMesh.position.y = 0.27;
    const bowColors = ['#e84a5f', '#5fd0b8', '#ffd24c', '#987ce8'];
    const bowMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 0.12, 8),
      this.mats.paper(bowColors[this.roundCount % bowColors.length])
    );
    bowMesh.position.y = 0.35;
    trophy.add(boxMesh, lidMesh, bowMesh);
    trophy.position.set(trophyIdx * 0.85, 0, (trophyIdx % 2) * 0.06);
    trophy.rotation.y = (Math.random() - 0.5) * 0.22;
    if (this.world.trophyShelfGroup.children.length >= 4) {
      this.world.trophyShelfGroup.remove(this.world.trophyShelfGroup.children[0]);
    }
    this.world.trophyShelfGroup.add(trophy);
    this.roundCount++;

    // Clear previous batch of cookies cleanly & reset dough!
    for (const c of this.cookies) {
      if (c.root.parent) c.root.parent.remove(c.root);
    }
    this.cookies = [];
    this.packedCookieIndices = [];
    this.dough.reset();
    this.scene.add(this.bakingTray.group);

    this._setupStage('ROLL');
  }

  // ==================== ANIMATION & PARTICLE HELPERS ====================

  _animateMove(obj, targetPos, duration = 0.45, arcHeight = 0.4, targetScale = null, onDone = null) {
    // Cancel any existing animation on the same object
    this.flyAnims = this.flyAnims.filter((a) => a.obj !== obj);
    this.flyAnims.push({
      obj,
      startPos: obj.position.clone(),
      targetPos: targetPos.clone(),
      startScale: obj.scale.x,
      targetScale: targetScale !== null ? targetScale : obj.scale.x,
      t: 0,
      duration,
      arcHeight,
      onDone,
    });
  }

  _spawnPaperBurst(origin, count, colorList, power = 1.0) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 90) break;
      const col = colorList[i % colorList.length];
      const mesh = new THREE.Mesh(this.sharedParticleGeo, this.mats.paper(col));
      mesh.position.copy(origin);
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.8 + Math.random() * 1.4) * power;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: Math.cos(ang) * spd,
        vy: (1.5 + Math.random() * 1.8) * power,
        vz: Math.sin(ang) * spd,
        rx: (Math.random() - 0.5) * 9,
        rz: (Math.random() - 0.5) * 9,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.45,
        gravity: 6.2,
      });
    }
  }

  _spawnConfetti(origin, count) {
    const colors = ['#f26d85', '#ffd24c', '#5fd0b8', '#73b3f5', '#b584eb', '#fffaf0'];
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 130) break;
      const col = colors[i % colors.length];
      const mesh = new THREE.Mesh(this.sharedConfettiGeo, this.mats.paper(col));
      mesh.position.copy(origin);
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.2 + Math.random() * 2.5;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: Math.cos(ang) * spd,
        vy: 2.8 + Math.random() * 3.0,
        vz: Math.sin(ang) * spd,
        rx: (Math.random() - 0.5) * 12,
        rz: (Math.random() - 0.5) * 12,
        life: 0,
        maxLife: 1.2 + Math.random() * 0.9,
        gravity: 3.4,
      });
    }
  }

  _spawnSteamPuff() {
    if (this.particles.length > 110) return;
    const mesh = new THREE.Mesh(
      this.sharedParticleGeo,
      this.mats.paper('#fffaf2', { opacity: 0.78 })
    );
    mesh.scale.setScalar(2.4 + Math.random() * 1.4);
    mesh.position.set(-1.25 + (Math.random() - 0.5) * 0.35, 3.85, -2.9 + (Math.random() - 0.5) * 0.25);
    this.scene.add(mesh);
    this.particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 0.35,
      vy: 1.15 + Math.random() * 0.55,
      vz: (Math.random() - 0.5) * 0.25,
      rx: 0.8,
      rz: 1.2,
      life: 0,
      maxLife: 1.25,
      gravity: -0.35,
    });
  }

  // ==================== MAIN UPDATE LOOP ====================

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);
    this.time += clampedDt;
    this.idleTimer += clampedDt;

    // 1. Smooth camera glide
    const camLerp = 1 - Math.exp(-5.2 * clampedDt);
    this.camPos.lerp(this.camTargetPos, camLerp);
    this.camLook.lerp(this.camTargetLook, camLerp);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // 2. Ambient papercraft world animation
    this.celebrateEnergy = Math.max(0, this.celebrateEnergy - clampedDt * 0.22);
    this.world.updateAmbient(this.time, this.celebrateEnergy);

    // 3. Pending smooth stage transition
    if (this.pendingTransition) {
      this.pendingTransition.delay -= clampedDt;
      if (this.pendingTransition.delay <= 0) {
        const next = this.pendingTransition.target;
        this.pendingTransition = null;
        this._setupStage(next);
      }
    }

    // 4. Flying animations
    for (let i = this.flyAnims.length - 1; i >= 0; i--) {
      const a = this.flyAnims[i];
      a.t += clampedDt;
      const u = Math.min(1, a.t / a.duration);
      const ease = 1 - Math.pow(1 - u, 3);
      a.obj.position.lerpVectors(a.startPos, a.targetPos, ease);
      a.obj.position.y += Math.sin(u * Math.PI) * a.arcHeight;
      const sc = THREE.MathUtils.lerp(a.startScale, a.targetScale, ease);
      a.obj.scale.setScalar(sc);
      if (u >= 1) {
        const cb = a.onDone;
        this.flyAnims.splice(i, 1);
        if (cb) cb();
      }
    }

    // 5. Cut-paper particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += clampedDt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= p.gravity * clampedDt;
      p.mesh.position.x += p.vx * clampedDt;
      p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.vy * clampedDt);
      p.mesh.position.z += p.vz * clampedDt;
      p.mesh.rotation.x += p.rx * clampedDt;
      p.mesh.rotation.z += p.rz * clampedDt;
      const fade = 1 - p.life / p.maxLife;
      p.mesh.scale.setScalar(Math.max(0.01, fade * (p.gravity < 0 ? 3.2 : 1.0)));
    }

    // 6. Stage-specific physics & subtle living motion
    this._updateStageBehaviors(clampedDt);

    // 7. Gentle idle hand demo ONLY after 10+ seconds of complete inactivity
    this._updateIdleHint(clampedDt);
  }

  _updateStageBehaviors(dt) {
    // Rolling pin spring follow
    if (this.stage === 'ROLL' || this.stage === 'CUT') {
      this.rollingPin.root.position.lerp(this.rollPinTarget, 1 - Math.exp(-12 * dt));
      this.rollingPin.roller.rotation.x = THREE.MathUtils.lerp(
        this.rollingPin.roller.rotation.x,
        this.rollPinAngle,
        1 - Math.exp(-14 * dt)
      );
      if (this.stage === 'ROLL' && !this.isRolling && this.idleTimer > 3.5) {
        // Gentle beckoning rock of the rolling pin
        this.rollingPin.root.rotation.z = Math.sin(this.time * 4.2) * 0.045;
      } else {
        this.rollingPin.root.rotation.z *= 0.85;
      }
    }

    // Flavor shaker tip animation
    for (const sh of this.shakers) {
      if (sh.anim > 0) {
        sh.anim = Math.max(0, sh.anim - dt * 1.9);
        const arc = Math.sin(sh.anim * Math.PI);
        sh.group.position.set(
          THREE.MathUtils.lerp(sh.basePos.x, -0.35, arc),
          sh.basePos.y + arc * 1.25,
          THREE.MathUtils.lerp(sh.basePos.z, 0.45, arc)
        );
        sh.group.rotation.z = -arc * 2.15 + Math.sin(sh.anim * 28) * 0.16 * arc;
      }
    }

    // Cookie cutter highlight / wiggle
    for (const ct of this.cutters) {
      if (ct.wiggle > 0) {
        ct.wiggle = Math.max(0, ct.wiggle - dt * 3.5);
        ct.group.rotation.y = Math.sin(ct.wiggle * 26) * 0.18;
      }
      if (this.stage === 'CUT' && this.draggingCutter !== ct) {
        const lift = ct === this.selectedCutter ? 0.14 + Math.sin(this.time * 4.2) * 0.035 : 0;
        ct.group.position.y = THREE.MathUtils.lerp(ct.group.position.y, 0.04 + lift, 1 - Math.exp(-10 * dt));
      }
    }

    // Oven door smooth hinge + live baking physics!
    this.ovenDoorAngle = THREE.MathUtils.lerp(
      this.ovenDoorAngle,
      this.ovenDoorTarget,
      1 - Math.exp(-7 * dt)
    );
    this.oven.doorPivot.rotation.x = this.ovenDoorAngle;

    if (this.stage === 'BAKE') {
      // Smoothly return any jiggled cookies to tray slots
      this.cookies.forEach((c, idx) => {
        const slot = this.bakingTray.slotPositions[idx];
        if (slot) c.root.position.y = THREE.MathUtils.lerp(c.root.position.y, slot.y, 1 - Math.exp(-12 * dt));
      });

      const heat = THREE.MathUtils.clamp((this.dialAngle - 0.35) / 2.2, 0, 1.35);
      if (heat > 0.05) {
        // Warm glow & dancing cut-paper flames!
        this.oven.innerLight.intensity = 1.6 + heat * 2.2 + Math.sin(this.time * 14) * 0.25;
        this.oven.flames.forEach((fg, i) => {
          const s = 0.65 + heat * 0.55 + Math.sin(this.time * 11 + i * 2.1) * 0.14;
          fg.scale.set(s, s * (0.9 + Math.cos(this.time * 14 + i) * 0.16), 1);
        });
        this.oven.lampMat.color.set('#ffaa3b');
        this.oven.lampMat.emissive.set('#ff6f1f');

        // Advance baking visibly in real time (~3.6s to golden perfection!)
        const maxAllowed = heat > 1.05 ? 1.35 : 1.02;
        if (this.bakeProgress < maxAllowed) {
          this.bakeProgress = Math.min(maxAllowed, this.bakeProgress + dt * (0.24 + heat * 0.14));
          for (const c of this.cookies) c.setBakeLevel(this.bakeProgress);
        }

        // Paper steam puffs from chimney
        this.steamAccum += dt * (1.2 + heat * 2.2);
        if (this.steamAccum >= 0.45) {
          this.steamAccum = 0;
          this._spawnSteamPuff();
        }

        // Trigger cheerful *DING!* once golden!
        if (!this.bakeDone && this.bakeProgress >= 1.0) {
          this.bakeDone = true;
          this.sound.playOvenDing();
          this.oven.lampMat.color.set('#5fd0b8');
          this.oven.lampMat.emissive.set('#2ea88d');
          this.ovenDoorTarget = 1.38;
          this._animateMove(this.bakingTray.group, this.oven.trayPulledPos, 0.7, 0.04, 0.86);
          this._spawnPaperBurst(new THREE.Vector3(-0.48, 1.85, -1.2), 18, ['#ffd24c', '#fffaf0', '#ff9b54'], 1.25);
        }
      } else {
        this.oven.innerLight.intensity = THREE.MathUtils.lerp(this.oven.innerLight.intensity, 0, 8 * dt);
        this.oven.flames.forEach((fg) => fg.scale.lerp(new THREE.Vector3(0.001, 0.001, 0.001), 8 * dt));
      }

      if (this.bakeDone) {
        const targetFlag = new THREE.Vector3(1, 1, 1);
        this.oven.flagGroup.scale.lerp(targetFlag, 1 - Math.exp(-8 * dt));
        this.oven.flagGroup.rotation.y = Math.sin(this.time * 5.2) * 0.35;
      }
    }

    // Stage 4: Piping bags & topping cups tactile lift + active piping animation!
    if (this.stage === 'DECORATE') {
      this.pipingSqueeze = Math.max(0, this.pipingSqueeze - dt * 5);

      this.pipingBags.forEach((pb, i) => {
        const isSelected = this.decoToolMode === 'icing' && this.selectedIcingIdx === i;
        if (isSelected && this.isPiping) {
          // Physically swoop piping bag right over your drawing finger!
          const target = new THREE.Vector3(
            this.activePipingWorldPos.x + 0.16,
            0.44,
            this.activePipingWorldPos.z + 0.16
          );
          pb.group.position.lerp(target, 1 - Math.exp(-22 * dt));
          pb.group.rotation.z = THREE.MathUtils.lerp(pb.group.rotation.z, 0.36, 14 * dt);
          pb.group.rotation.x = THREE.MathUtils.lerp(pb.group.rotation.x, -0.25, 14 * dt);
          const sq = 1 - this.pipingSqueeze * 0.12;
          pb.group.scale.set(sq, 1 + this.pipingSqueeze * 0.08, sq);
        } else {
          const lift = isSelected ? 0.24 + Math.sin(this.time * 4.5) * 0.04 : 0;
          const target = new THREE.Vector3(pb.homePos.x, pb.homePos.y + lift, pb.homePos.z);
          pb.group.position.lerp(target, 1 - Math.exp(-11 * dt));
          pb.group.rotation.z = THREE.MathUtils.lerp(pb.group.rotation.z, isSelected ? 0.15 : 0, 10 * dt);
          pb.group.rotation.x = THREE.MathUtils.lerp(pb.group.rotation.x, 0, 10 * dt);
          const restScale = this.isPortrait ? 0.82 : 0.88;
          pb.group.scale.lerp(new THREE.Vector3(restScale, restScale, restScale), 10 * dt);
        }
      });

      this.toppingCups.forEach((tc, i) => {
        const isSelected = this.decoToolMode === 'topping' && this.selectedToppingIdx === i;
        const lift = isSelected ? 0.2 + Math.sin(this.time * 4.8) * 0.035 : 0;
        const target = new THREE.Vector3(tc.homePos.x, tc.homePos.y + lift, tc.homePos.z);
        tc.group.position.lerp(target, 1 - Math.exp(-11 * dt));
        tc.group.scale.setScalar(THREE.MathUtils.lerp(tc.group.scale.x, isSelected ? 1.12 : 1.0, 10 * dt));
      });

      // Gift Box gently breathes wider once any cookie is decorated!
      const totalDeco = this.cookies.reduce((acc, c) => acc + c.decorationCount, 0);
      if (totalDeco > 0) {
        this.giftBox.lidPivot.rotation.x = -1.75 + Math.sin(this.time * 3.4) * 0.14;
      }
    }

    // Stage 5: Gift Box lid fold, ribbon bow bloom, playful bounce & peek!
    if (this.stage === 'PACK') {
      let targetLidRot = -1.92;
      if (this.packPhase === 'CLOSE_LID') {
        // Lid leans slightly forward invitingly!
        targetLidRot = -1.32 + Math.sin(this.time * 4.0) * 0.12;
      } else if (this.lidCloseProgress > 0.5) {
        targetLidRot = this.boxPeekTimer > 0 ? -0.68 : 0.0;
      }
      this.giftBox.lidPivot.rotation.x = THREE.MathUtils.lerp(
        this.giftBox.lidPivot.rotation.x,
        targetLidRot,
        1 - Math.exp(-8 * dt)
      );

      if (this.boxPeekTimer > 0) {
        this.boxPeekTimer = Math.max(0, this.boxPeekTimer - dt);
      }

      if (this.packPhase === 'TIE_RIBBON') {
        // Untied ribbon tails flutter gently to invite a tap/pull!
        this.giftBox.untiedGroup.rotation.y = Math.sin(this.time * 4.8) * 0.14;
      }

      if (this.ribbonTied) {
        this.ribbonBloom = Math.min(1, this.ribbonBloom + dt * 2.8);
        // Overshoot spring bloom for the origami bow!
        const s = this.ribbonBloom < 1
          ? 1 + Math.sin(this.ribbonBloom * Math.PI) * 0.25 - (1 - this.ribbonBloom)
          : 1.0;
        this.giftBox.bowGroup.scale.setScalar(Math.max(0.001, s));
      }

      if (this.boxBounce > 0) {
        this.boxBounce = Math.max(0, this.boxBounce - dt * 2.4);
        this.giftBox.root.position.y = 0.04 + Math.sin(this.boxBounce * Math.PI) * 0.34;
      }

      if (this.freshDoughProp.visible) {
        this.freshDoughProp.rotation.y = Math.sin(this.time * 1.8) * 0.12;
      }
    }
  }

  _updateIdleHint(dt) {
    // Wordless rule: 0-10s do NOTHING; after 10s show 1 gentle physical paper-hand demonstration!
    if (this.idleTimer > 10.5 && !this.idleDemoActive) {
      this.idleDemoActive = true;
      this.idleDemoT = 0;
      this.idleHand.visible = true;
    }
    if (!this.idleDemoActive) return;

    this.idleDemoT += dt;
    if (this.idleDemoT > 3.2) {
      this.idleDemoActive = false;
      this.idleHand.visible = false;
      this.idleTimer = 3.0; // Pause another ~7.5s before ever nudging again
      return;
    }

    const u = (this.idleDemoT % 1.6) / 1.6;
    const wave = Math.sin(u * Math.PI);
    if (this.stage === 'ROLL') {
      this.idleHand.position.set(0.35, 0.85, 0.15 + Math.sin(u * Math.PI * 2) * 0.72);
    } else if (this.stage === 'CUT') {
      const start = this.cutters[0].homePos;
      this.idleHand.position.set(
        THREE.MathUtils.lerp(start.x, 0, u),
        0.75 + wave * 0.45,
        THREE.MathUtils.lerp(start.z, 0.55, u)
      );
    } else if (this.stage === 'BAKE') {
      if (this.bakeDone) {
        this.idleHand.position.set(-0.35, 1.35 + wave * 0.25, -0.2 + u * 0.6);
      } else {
        const dialPos = new THREE.Vector3();
        this.oven.dialCenter.getWorldPosition(dialPos);
        this.idleHand.position.set(dialPos.x + 0.15, dialPos.y + u * 0.45, dialPos.z + 0.35);
      }
    } else if (this.stage === 'DECORATE') {
      const ang = u * Math.PI * 2;
      this.idleHand.position.set(Math.cos(ang) * 0.55, 0.68, 0.72 + Math.sin(ang) * 0.55);
    } else if (this.stage === 'PACK') {
      if (this.packPhase === 'PLACE' && this.cookies[0]) {
        const p0 = this.cookies[0].root.position;
        this.idleHand.position.set(
          THREE.MathUtils.lerp(p0.x, -0.6, u),
          0.9 + wave * 0.4,
          THREE.MathUtils.lerp(p0.z, -0.35, u)
        );
      } else {
        this.idleHand.position.set(0.15, 1.35 + wave * 0.28, -0.3);
      }
    }
  }

  // ==================== QA / DEBUG HELPER (invisible to player) ====================

  debugJumpStage(stageName) {
    this.flyAnims = [];
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles = [];
    if (stageName === 'ROLL') {
      this.dough.reset();
      this._setupStage('ROLL', true);
    } else if (stageName === 'CUT') {
      this.dough.progress = 1.0;
      this._setupStage('CUT', true);
      this.flyAnims = [];
      this.rollingPin.root.position.copy(this.rollPinTarget);
      const trayPos = this.isPortrait ? new THREE.Vector3(0.0, 0.04, -1.68) : new THREE.Vector3(3.15, 0.04, -0.35);
      this.bakingTray.group.position.copy(trayPos);
      this.bakingTray.group.scale.setScalar(this.isPortrait ? 0.68 : 0.78);
      this.cutters.forEach((ct) => {
        ct.group.position.copy(ct.homePos);
        ct.group.scale.setScalar(1.0);
      });
    } else if (stageName === 'BAKE') {
      this._ensureDemoCookies();
      this._setupStage('BAKE', true);
      this.flyAnims = [];
      this.bakingTray.group.position.copy(this.oven.trayInsidePos);
      this.bakingTray.group.scale.setScalar(0.76);
      this.ovenDoorTarget = 0;
      this.ovenDoorAngle = 0;
      this._setDialAngle(1.65);
      this.bakeProgress = 0.68;
      this.cookies.forEach((c) => c.setBakeLevel(0.68));
    } else if (stageName === 'DECORATE') {
      this._ensureDemoCookies();
      this.cookies.forEach((c) => c.setBakeLevel(1.0));
      this._setupStage('DECORATE', true);
      this.flyAnims = [];
    } else if (stageName === 'PACK') {
      this._ensureDemoCookies();
      this.cookies.forEach((c) => {
        c.setBakeLevel(1.0);
        if (c.decorationCount === 0) this._addDemoDecorations(c);
      });
      this._setupStage('PACK', true);
      this.flyAnims = [];
    } else if (stageName === 'CELEBRATE') {
      this._ensureDemoCookies();
      this.cookies.forEach((c) => {
        c.setBakeLevel(1.0);
        if (c.decorationCount === 0) this._addDemoDecorations(c);
      });
      this._setupStage('PACK', true);
      this.flyAnims = [];
      this.cookies.forEach((c, i) => {
        this.packedCookieIndices.push(i);
        this.giftBox.packedCookiesGroup.add(c.root);
        c.root.position.copy(this.giftBox.slotPositions[i]);
        c.root.scale.setScalar(0.86);
      });
      this.giftBox.root.position.set(0, 0.04, -0.32);
      this.giftBox.root.scale.setScalar(1.0);
      this.lidCloseProgress = 1;
      this.giftBox.lidPivot.rotation.x = 0;
      this.giftBox.ribbonGroup.visible = true;
      this._tieGiftBoxRibbon();
      this.flyAnims = [];
      this.ribbonBloom = 1;
      this.giftBox.bowGroup.scale.setScalar(1);
      this.seals.forEach((s) => {
        s.group.visible = true;
        s.group.position.copy(s.homePos);
        s.group.scale.setScalar(1);
      });
      this.freshDoughProp.visible = true;
      this.freshDoughProp.scale.setScalar(1);
    }
  }

  _ensureDemoCookies() {
    if (this.cookies.length >= MAX_COOKIES) return;
    const shapes = ['star', 'heart', 'flower', 'bow'];
    const flavors = ['vanilla', 'strawberry', 'vanilla', 'cocoa'];
    while (this.cookies.length < MAX_COOKIES) {
      const idx = this.cookies.length;
      const c = createPapercraftCookie(shapes[idx], flavors[idx], this.mats, 0.64);
      this.bakingTray.group.add(c.root);
      c.root.position.copy(this.bakingTray.slotPositions[idx]);
      this.cookies.push(c);
    }
  }

  _addDemoDecorations(cookie) {
    // Spiraled icing strokes + cut-paper strawberries, stars, sprinkles, rosettes
    const prevIdx = this.selectedIcingIdx;
    this.selectedIcingIdx = cookie.shapeId === 'heart' ? 0 : cookie.shapeId === 'star' ? 3 : cookie.shapeId === 'flower' ? 2 : 5;
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * Math.PI * 2;
      const a1 = ((i + 1) / 16) * Math.PI * 2;
      const r = 0.28 + (i % 2) * 0.08;
      this._addIcingSegment(cookie, Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r);
    }
    this.selectedIcingIdx = prevIdx;

    const extras = [
      { id: 'strawberry', x: -0.18, z: -0.08 },
      { id: 'rosette', x: 0.2, z: 0.08 },
      { id: 'starheart', x: 0.0, z: -0.22 },
      { id: 'pearls', x: -0.12, z: 0.2 },
      { id: 'sprinkles', x: 0.12, z: -0.15 },
    ];
    for (const ex of extras) {
      if (isPointInCookie(cookie.shapeId, ex.x, ex.z, cookie.scale * 0.92)) {
        const m = createToppingMesh(ex.id, this.mats);
        const sy = this._sampleIcingHeight(cookie, ex.x, ex.z, 0.16);
        m.position.set(ex.x, sy + 0.005, ex.z);
        cookie.decoGroup.add(m);
        cookie.decorationCount++;
      }
    }
  }
}
