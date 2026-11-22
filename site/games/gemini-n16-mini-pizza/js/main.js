import * as THREE from 'three';
import { audio } from './audio.js';
import { TiltShiftComposer } from './postprocess.js';
import { buildStudioEnvironment, createEnvironment } from './environment.js';
import { MiniPizza, PIZZA_FULL_RADIUS } from './pizza.js';
import { createTools, ParticleSystem } from './tools.js';
import { createFamily } from './family.js';

const STAGES = {
  DOUGH: 'DOUGH',
  SAUCE: 'SAUCE',
  TOPPINGS: 'TOPPINGS',
  OVEN_IN: 'OVEN_IN',
  BAKING: 'BAKING',
  OVEN_OUT: 'OVEN_OUT',
  CUTTING: 'CUTTING',
  SERVING: 'SERVING'
};

const CUT_ANGLES = [0, Math.PI / 3, (2 * Math.PI) / 3];

// =========================================================
// Renderer & Scene Setup
// =========================================================
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
let currentDpr = Math.min(window.devicePixelRatio || 1, isTouchDevice ? 1.5 : 2.0);
renderer.setPixelRatio(currentDpr);
renderer.setSize(window.innerWidth, window.innerHeight, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2e2118);
scene.fog = new THREE.FogExp2(0x3a2a1e, 0.032);
scene.environment = buildStudioEnvironment(renderer);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.2, 45);
camera.position.set(0, 3.65, 4.15);
camera.lookAt(0, 0.25, -0.05);

const composer = new TiltShiftComposer(renderer, window.innerWidth, window.innerHeight);

// =========================================================
// Build Miniature Diorama World
// =========================================================
const env = createEnvironment(scene);
const pizza = new MiniPizza();
scene.add(pizza.group);
const tools = createTools(scene);
const particles = new ParticleSystem(scene);
const family = createFamily(scene);

// =========================================================
// Game State & Smooth Choreography Targets
// =========================================================
let stage = STAGES.DOUGH;
let isPortrait = window.innerHeight > window.innerWidth;
let elapsed = 0;
let idleTime = 0;
let nextIdleNudge = 9.0;

const camPosTarget = new THREE.Vector3(0, 3.65, 4.15);
const camLookCurrent = new THREE.Vector3(0, 0.25, -0.05);
const camLookTarget = new THREE.Vector3(0, 0.25, -0.05);
let camFovTarget = 38;

const boardTargetZ = { value: 0.35 };
const pizzaPosTarget = new THREE.Vector3(0, 0.12, 0.35);

// Stage-specific interactive state
let stageTimer = 0;
let ovenAnimT = 0;
let bakeProgress = 0;
let bakeBellRung = false;
let bakeReadyTimer = 0;
let lastBubbleSfx = 0;
let lastSteamEmit = 0;

// Tool targets
const pinTargetPos = new THREE.Vector3(1.12, 0.24, 1.05);
let pinTargetRotY = -0.58;
let pinSpinVel = 0;

const crockTargetPos = new THREE.Vector3(2.35, 0, -0.82);
const ladleTargetPos = new THREE.Vector3(2.35, 0.42, -0.82);
let ladleActive = false;
let sauceCrockWobble = 0;

const peelTargetPos = new THREE.Vector3(2.65, 0.05, 1.95);
let peelTargetRotY = 0.22;
let peelVisibleReady = false;
let toppingsDroppedCount = 0;
let selectedToppingId = 'cheese';
let lastBowlTapTime = 0;
let lastBowlTapId = null;

// Cutting animation state
let activeCutAnim = null; // { cutIdx, t, angle }
const cutterTargetPos = new THREE.Vector3(1.45, 0.12, 1.35);
let cutterTargetRotY = -0.45;
let cutDragStart = null;
let cutDragActive = false;

// Serving state
let draggingSlice = null; // sliceData
let selectedSlice = null; // for tap-slice -> tap-plate fallback
let draggingToppingType = null;
let lastPointerWorld = new THREE.Vector3();
let activePointerId = null;
let pointerDownPos = new THREE.Vector2();
let pointerDownWorld = new THREE.Vector3();
let pointerDownTime = 0;
let isDragging = false;
let dragMode = null; // 'dough' | 'sauce' | 'topping' | 'peel' | 'cut' | 'slice'
let lastDragWorld = new THREE.Vector3();
let celebrationDone = false;

// Raycaster & Ground Intersect Planes
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.14);
const liftPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.46);
const tmpVec3 = new THREE.Vector3();

function getWorldOnPlane(clientX, clientY, plane = tablePlane, out = new THREE.Vector3()) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  raycaster.ray.intersectPlane(plane, out);
  return out;
}

// =========================================================
// Stage Transitions & Camera Choreography
// =========================================================
function updateLayoutAndCamera() {
  isPortrait = window.innerHeight > window.innerWidth;
  tools.layoutBowls(stage, isPortrait);
  family.layout(isPortrait);

  if (stage === STAGES.DOUGH) {
    boardTargetZ.value = 0.35;
    pizzaPosTarget.set(0, 0.12, 0.35);
    if (isPortrait) {
      camPosTarget.set(0, 4.5, 5.1);
      camLookTarget.set(0, 0.22, 0.25);
      camFovTarget = 43;
      composer.setFocus({ focusY: 0.46, focusBand: 0.22, blurAmount: 4.8, warmth: 0.15 });
    } else {
      camPosTarget.set(0, 3.65, 4.25);
      camLookTarget.set(0, 0.24, -0.1);
      camFovTarget = 39;
      composer.setFocus({ focusY: 0.44, focusBand: 0.22, blurAmount: 5.0, warmth: 0.15 });
    }
    crockTargetPos.set(isPortrait ? 1.55 : 2.35, 0, isPortrait ? -1.15 : -0.82);
    peelTargetPos.set(4.6, 0.05, 2.95);
    peelTargetRotY = 0.25;
  } else if (stage === STAGES.SAUCE) {
    boardTargetZ.value = 0.35;
    pizzaPosTarget.set(0, 0.12, 0.35);
    if (isPortrait) {
      camPosTarget.set(0.05, 4.6, 5.2);
      camLookTarget.set(0.05, 0.2, 0.25);
      camFovTarget = 44;
      composer.setFocus({ focusY: 0.47, focusBand: 0.24, blurAmount: 4.6, warmth: 0.16 });
    } else {
      camPosTarget.set(0.15, 3.8, 4.4);
      camLookTarget.set(0.15, 0.2, -0.05);
      camFovTarget = 40;
      composer.setFocus({ focusY: 0.45, focusBand: 0.24, blurAmount: 4.8, warmth: 0.16 });
    }
    crockTargetPos.set(isPortrait ? 1.28 : 1.92, 0, isPortrait ? -0.95 : -0.25);
    pinTargetPos.set(-3.1, 0.14, -1.65);
    pinTargetRotY = 0.15;
    peelTargetPos.set(4.6, 0.05, 2.95);
  } else if (stage === STAGES.TOPPINGS) {
    boardTargetZ.value = 0.35;
    pizzaPosTarget.set(0, 0.12, 0.35);
    if (isPortrait) {
      camPosTarget.set(0, 6.0, 6.85);
      camLookTarget.set(0, 0.05, 0.92);
      camFovTarget = 46;
      composer.setFocus({ focusY: 0.44, focusBand: 0.34, blurAmount: 4.4, warmth: 0.15 });
    } else {
      camPosTarget.set(0, 4.7, 5.45);
      camLookTarget.set(0, 0.18, 0.05);
      camFovTarget = 42;
      composer.setFocus({ focusY: 0.44, focusBand: 0.27, blurAmount: 4.8, warmth: 0.15 });
    }
    crockTargetPos.set(isPortrait ? 2.85 : 3.45, 0, -1.45);
    if (peelVisibleReady) {
      peelTargetPos.set(isPortrait ? 1.56 : 2.38, 0.05, isPortrait ? 0.56 : 2.32);
      peelTargetRotY = isPortrait ? 0.22 : 0.48;
    } else {
      peelTargetPos.set(4.8, 0.05, 3.0);
    }
  } else if (stage === STAGES.OVEN_IN || stage === STAGES.BAKING) {
    if (isPortrait) {
      camPosTarget.set(0.0, 1.52, 1.15);
      camLookTarget.set(0, 0.48, -3.45);
      camFovTarget = 44;
      composer.setFocus({ focusY: 0.46, focusBand: 0.22, blurAmount: 5.5, warmth: 0.45 });
    } else {
      camPosTarget.set(0.0, 1.28, -0.25);
      camLookTarget.set(0, 0.46, -3.45);
      camFovTarget = 42;
      composer.setFocus({ focusY: 0.46, focusBand: 0.22, blurAmount: 5.6, warmth: 0.45 });
    }
  } else if (stage === STAGES.OVEN_OUT || stage === STAGES.CUTTING || stage === STAGES.SERVING) {
    boardTargetZ.value = 0.92;
    if (stage !== STAGES.OVEN_OUT) {
      pizzaPosTarget.set(0, 0.12, 0.92);
    }
    if (isPortrait) {
      camPosTarget.set(0, 5.85, 6.75);
      camLookTarget.set(0, 0.22, 0.08);
      camFovTarget = 46;
      composer.setFocus({ focusY: 0.48, focusBand: 0.31, blurAmount: 4.5, warmth: 0.2 });
    } else {
      camPosTarget.set(0, 4.85, 5.58);
      camLookTarget.set(0, 0.26, -0.02);
      camFovTarget = 42;
      composer.setFocus({ focusY: 0.49, focusBand: 0.28, blurAmount: 4.6, warmth: 0.2 });
    }
  }
}

function setStage(newStage) {
  stage = newStage;
  stageTimer = 0;
  idleTime = 0;
  nextIdleNudge = 9.0;
  dragMode = null;
  isDragging = false;
  draggingToppingType = null;
  tools.setDragPreview(null);

  if (newStage === STAGES.DOUGH) {
    env.flourRing.visible = true;
    tools.rollingPin.visible = true;
    pinTargetPos.set(1.08, 0.24, 1.05);
    pinTargetRotY = -0.58;
    ladleActive = false;
    peelVisibleReady = false;
    toppingsDroppedCount = 0;
    tools.pizzaCutter.visible = false;
    celebrationDone = false;
    for (const b of tools.toppingBowls) b.selected = false;
    family.resetForNewPizza();
  } else if (newStage === STAGES.SAUCE) {
    audio.playStageChime(0);
    env.flourRing.visible = false;
    ladleActive = false;
    // Give the sauce crock a friendly little bob so child notices it!
    sauceCrockWobble = 1.0;
  } else if (newStage === STAGES.TOPPINGS) {
    audio.playStageChime(1);
    tools.rollingPin.visible = false;
    ladleActive = false;
    selectedToppingId = 'cheese';
    tools.toppingBowls[0].selected = true;
    tools.toppingBowls[0].wobble = 0.9;
    for (let i = 1; i < tools.toppingBowls.length; i++) {
      tools.toppingBowls[i].selected = false;
    }
  } else if (newStage === STAGES.OVEN_IN) {
    audio.playPeelSlide();
    tools.rollingPin.visible = false;
    ovenAnimT = 0;
    for (const b of tools.toppingBowls) b.selected = false;
  } else if (newStage === STAGES.BAKING) {
    tools.rollingPin.visible = false;
    bakeProgress = 0;
    bakeBellRung = false;
    bakeReadyTimer = 0;
    audio.playOvenFireWhoosh();
    env.triggerFireBoost();
    particles.emit('spark', new THREE.Vector3(0, 0.4, -3.5), 14, 0.9);
  } else if (newStage === STAGES.OVEN_OUT) {
    audio.playPeelSlide();
    tools.rollingPin.visible = false;
    ovenAnimT = 0;
    family.setVisible(true, isPortrait);
  } else if (newStage === STAGES.CUTTING) {
    audio.playStageChime(3);
    tools.rollingPin.visible = false;
    pizza.prepareSlices();
    tools.pizzaCutter.visible = true;
    cutterTargetPos.set(1.42, 0.14, 1.38);
    cutterTargetRotY = -0.42;
    tools.pizzaCutter.position.set(2.8, 0.14, 2.0);
    peelTargetPos.set(3.5, 0.05, 2.55);
  } else if (newStage === STAGES.SERVING) {
    audio.playStageChime(4);
    tools.rollingPin.visible = false;
    cutterTargetPos.set(3.4, 0.14, 2.3);
    selectedSlice = null;
    draggingSlice = null;
  }

  updateLayoutAndCamera();
}

function resetGame(emitFlour = true) {
  particles.clear();
  if (emitFlour) audio.playFlourPoof(0.24);
  pizza.reset();
  pizza.group.position.set(0, 0.12, 0.35);
  if (emitFlour) {
    particles.emit('flour', new THREE.Vector3(0, 0.28, 0.35), 8, 0.55);
  }
  setStage(STAGES.DOUGH);
}

// =========================================================
// Hit Testing Helpers (Large Generous Forgiving Hit Zones!)
// =========================================================
function hitDistXZ(worldPos, targetX, targetZ) {
  return Math.hypot(worldPos.x - targetX, worldPos.z - targetZ);
}

function findHitBowl(worldPos) {
  let best = null;
  let bestD = 0.62; // generous 5-year-old finger target
  for (const b of tools.toppingBowls) {
    const d = hitDistXZ(worldPos, b.group.position.x, b.group.position.z);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

function findHitSlice(worldPos) {
  if (!pizza.slicesGroup.visible) return null;
  const px = worldPos.x - pizza.group.position.x;
  const pz = worldPos.z - pizza.group.position.z;
  const dist = Math.hypot(px, pz);
  if (dist > PIZZA_FULL_RADIUS + 0.35) return null;

  let ang = Math.atan2(pz, px);
  if (ang < 0) ang += Math.PI * 2;

  // Prefer the exact angular wedge, or fallback to nearest unserved wedge if tapped near center!
  const wedgeAngle = (Math.PI * 2) / 6;
  const exactIdx = Math.floor(ang / wedgeAngle) % 6;
  if (pizza.slices[exactIdx] && !pizza.slices[exactIdx].served) {
    return pizza.slices[exactIdx];
  }
  // Fallback nearest available slice
  let best = null;
  let bestD = 1.4;
  for (const s of pizza.slices) {
    if (s.served) continue;
    const cx = Math.cos(s.midAngle) * 0.58 + s.baseOffset.x;
    const cz = Math.sin(s.midAngle) * 0.58 + s.baseOffset.z;
    const d = Math.hypot(px - cx, pz - cz);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

function triggerNextCut(preferredAngle = null) {
  if (activeCutAnim) return false;
  let chosen = -1;
  if (preferredAngle !== null) {
    // Pick the uncut diameter line closest to the child's drag angle!
    let bestDiff = Infinity;
    for (let i = 0; i < 3; i++) {
      if (pizza.cutStates[i]) continue;
      let diff = Math.abs(Math.atan2(Math.sin(preferredAngle - CUT_ANGLES[i]), Math.cos(preferredAngle - CUT_ANGLES[i])));
      diff = Math.min(diff, Math.abs(Math.PI - diff));
      if (diff < bestDiff) {
        bestDiff = diff;
        chosen = i;
      }
    }
  } else {
    chosen = pizza.cutStates.findIndex((c) => !c);
  }
  if (chosen < 0) return false;

  activeCutAnim = {
    cutIdx: chosen,
    t: 0,
    angle: CUT_ANGLES[chosen],
    applied: false
  };
  audio.playPizzaCut();
  return true;
}

function deliverSliceToPlate(slice, plateIdx) {
  slice.served = true;
  slice.isDragging = false;
  pizza.hideCheeseStrands();
  audio.playCeramicClink(plateIdx * 0.4);

  const member = family.members[plateIdx];
  particles.emit('steam', new THREE.Vector3(member.plateWorldPos.x, 0.25, member.plateWorldPos.z), 4, 0.25);

  family.serveSliceToMember(
    plateIdx,
    slice,
    (m) => {
      // On each joyful bite!
      audio.playMunch(0.88 + m.index * 0.14);
      particles.emit('crumb', new THREE.Vector3(m.plateWorldPos.x, 0.18, m.plateWorldPos.z), 6, 0.25);
    },
    (m) => {
      // On finishing slice!
      audio.playFamilyHappy(m.index, m.extraHappy);
      particles.emit('joy', new THREE.Vector3(m.dollGroup.position.x, m.spec.height + 0.15, m.dollGroup.position.z), m.extraHappy ? 12 : 7, 0.35);

      // Show fresh dough ball replay tray once all 4 family members have eaten (or all 6 slices served)!
      const remaining = pizza.slices.filter((s) => !s.served).length;
      if (family.allMembersServed() || remaining === 0) {
        family.setShowNextTray(true, isPortrait);
        if (!celebrationDone && family.allMembersServed()) {
          celebrationDone = true;
          // Cozy family celebration bounce!
          for (const fm of family.members) {
            fm.happyTimer = Math.max(fm.happyTimer, 2.2);
          }
          audio.playStageChime(4);
        }
      }
    }
  );
}

// =========================================================
// Unified Single-Finger Pointer Input (Zero Multi-Touch Bugs!)
// =========================================================
canvas.addEventListener('pointerdown', (e) => {
  if (activePointerId !== null) return;
  e.preventDefault();
  audio.unlock();
  activePointerId = e.pointerId;
  canvas.setPointerCapture?.(e.pointerId);

  idleTime = 0;
  pointerDownTime = performance.now();
  pointerDownPos.set(e.clientX, e.clientY);
  getWorldOnPlane(e.clientX, e.clientY, tablePlane, pointerDownWorld);
  lastDragWorld.copy(pointerDownWorld);
  lastPointerWorld.copy(pointerDownWorld);
  isDragging = true;
  dragMode = null;

  // --- Global playful miniature props (small realistic reaction without breaking stage!) ---
  // Flour pinch bowl (tap anytime for flour cloud!)
  if (
    stage !== STAGES.BAKING &&
    stage !== STAGES.OVEN_IN &&
    stage !== STAGES.OVEN_OUT &&
    hitDistXZ(pointerDownWorld, env.flourBowlGroup.position.x, env.flourBowlGroup.position.z) < 0.55
  ) {
    env.triggerFlourWobble();
    audio.playFlourPoof(0.24);
    audio.playCeramicClink(0.6);
    particles.emit('flour', new THREE.Vector3(env.flourBowlGroup.position.x, 0.32, env.flourBowlGroup.position.z), 10, 0.35);
    return;
  }

  // Brass counter bell (tap anytime for a cheerful ding; during baked-ready it also pulls pizza out!)
  if (hitDistXZ(pointerDownWorld, env.bellGroup.position.x, env.bellGroup.position.z) < 0.52) {
    env.triggerBell();
    audio.playBrassBell();
    if (stage === STAGES.BAKING && bakeProgress >= 0.92) {
      setStage(STAGES.OVEN_OUT);
    }
    return;
  }

  // Potted fresh basil herb (playful rustle anytime + secret fresh basil toss in TOPPINGS!)
  if (
    stage !== STAGES.BAKING &&
    stage !== STAGES.OVEN_IN &&
    stage !== STAGES.OVEN_OUT &&
    hitDistXZ(pointerDownWorld, env.herbPot.position.x, env.herbPot.position.z) < 0.62
  ) {
    env.triggerHerbRustle();
    audio.playToppingDrop('basil');
    if (stage === STAGES.TOPPINGS) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * PIZZA_FULL_RADIUS * 0.65;
      pizza.addTopping('basil', Math.cos(a) * r, Math.sin(a) * r);
      _onToppingAdded();
    }
    return;
  }

  // Olive oil glass bottle (playful glassy clink anytime!)
  if (
    stage !== STAGES.BAKING &&
    stage !== STAGES.OVEN_IN &&
    stage !== STAGES.OVEN_OUT &&
    hitDistXZ(pointerDownWorld, env.oilGroup.position.x, env.oilGroup.position.z) < 0.55
  ) {
    env.triggerOilClink();
    audio.playCeramicClink(1.1);
    return;
  }

  // --- Stage-Specific Primary Interactions ---
  if (stage === STAGES.DOUGH) {
    const dPizza = hitDistXZ(pointerDownWorld, pizza.group.position.x, pizza.group.position.z);
    const dPin = hitDistXZ(pointerDownWorld, tools.rollingPin.position.x, tools.rollingPin.position.z);
    if (dPizza < 1.55 || dPin < 1.05) {
      dragMode = 'dough';
      // Immediate tactile squish & flour puff on touch (<50ms feedback!)
      const p = pizza.stretchDough(0.095);
      audio.playDoughSquish(p);
      particles.emit('flour', new THREE.Vector3(pointerDownWorld.x, 0.25, pointerDownWorld.z), 6, 0.45);
      pinTargetPos.set(
        THREE.MathUtils.clamp(pointerDownWorld.x, -1.0, 1.0),
        0.26,
        THREE.MathUtils.clamp(pointerDownWorld.z, -0.6, 1.25)
      );
      pinSpinVel = 12;
      if (p >= 0.96) {
        pizza.stretchDough(0.1);
        setStage(STAGES.SAUCE);
      }
      return;
    }
    // Inactive props give gentle rattle only
    const bowl = findHitBowl(pointerDownWorld);
    if (bowl) {
      bowl.wobble = 0.8;
      audio.playCeramicClink(bowl.index * 0.25);
      return;
    }
    if (hitDistXZ(pointerDownWorld, tools.sauceCrock.position.x, tools.sauceCrock.position.z) < 0.65) {
      sauceCrockWobble = 0.8;
      audio.playCeramicClink(-0.3);
      return;
    }
    if (pointerDownWorld.z < -1.8) {
      env.triggerFireBoost();
      audio.playOvenFireWhoosh();
      particles.emit('spark', new THREE.Vector3(0, 0.45, -3.2), 6, 0.6);
      return;
    }
  } else if (stage === STAGES.SAUCE) {
    const dPizza = hitDistXZ(pointerDownWorld, pizza.group.position.x, pizza.group.position.z);
    const dCrock = hitDistXZ(pointerDownWorld, tools.sauceCrock.position.x, tools.sauceCrock.position.z);
    if (dCrock < 0.78) {
      dragMode = 'sauce';
      ladleActive = true;
      sauceCrockWobble = 0.7;
      audio.playSauceScoop();
      // Scooping from crock immediately splashes a glossy dollop onto center so tapping crock is rewarding!
      pizza.paintSauce((Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.35, 0.32);
      particles.emit('sauce', new THREE.Vector3(0, 0.28, pizza.group.position.z), 5, 0.25);
      if (pizza.sauceCoverage >= 0.68) {
        setStage(STAGES.TOPPINGS);
      }
      return;
    }
    if (dPizza < 1.45) {
      dragMode = 'sauce';
      ladleActive = true;
      const lx = pointerDownWorld.x - pizza.group.position.x;
      const lz = pointerDownWorld.z - pizza.group.position.z;
      if (pizza.paintSauce(lx, lz, 0.28)) {
        audio.playSauceScoop();
        particles.emit('sauce', new THREE.Vector3(pointerDownWorld.x, 0.24, pointerDownWorld.z), 4, 0.16);
      }
      ladleTargetPos.set(pointerDownWorld.x, 0.36, pointerDownWorld.z);
      if (pizza.sauceCoverage >= 0.68) {
        setStage(STAGES.TOPPINGS);
      }
      return;
    }
    const bowl = findHitBowl(pointerDownWorld);
    if (bowl) {
      bowl.wobble = 0.8;
      audio.playCeramicClink(bowl.index * 0.25);
      return;
    }
  } else if (stage === STAGES.TOPPINGS) {
    // 1. Check topping bowls (drag OR tap to select; double-tap tosses a piece!)
    const bowl = findHitBowl(pointerDownWorld);
    if (bowl) {
      selectedToppingId = bowl.id;
      for (const b of tools.toppingBowls) b.selected = b.id === bowl.id;
      bowl.wobble = 0.85;
      audio.playCeramicClink(bowl.index * 0.25);

      // Fun double-tap surprise: tosses topping onto a playful spot on the pizza!
      const now = performance.now();
      if (lastBowlTapId === bowl.id && now - lastBowlTapTime < 360) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * PIZZA_FULL_RADIUS * 0.65;
        pizza.addTopping(bowl.id, Math.cos(a) * r, Math.sin(a) * r);
        audio.playToppingDrop(bowl.id);
        _onToppingAdded();
      }
      lastBowlTapId = bowl.id;
      lastBowlTapTime = now;

      dragMode = 'topping';
      draggingToppingType = bowl.id;
      tools.setDragPreview(bowl.id);
      tools.dragPreview.position.set(pointerDownWorld.x, 0.45, pointerDownWorld.z);
      return;
    }

    // 2. Check wooden pizza peel OR glowing brick oven once toppings >= 4 -> slide into brick oven!
    const dPeel = hitDistXZ(pointerDownWorld, tools.pizzaPeel.position.x, tools.pizzaPeel.position.z);
    const hitOven = pointerDownWorld.z < -1.55 && Math.abs(pointerDownWorld.x) < 2.2;
    if (peelVisibleReady && (dPeel < 1.15 || hitOven)) {
      setStage(STAGES.OVEN_IN);
      return;
    }
    if (!peelVisibleReady && hitOven) {
      // Friendly fire crackle + cheese bowl jiggle hinting "add toppings first!"
      env.triggerFireBoost();
      audio.playOvenFireWhoosh();
      particles.emit('spark', new THREE.Vector3(0, 0.45, -3.2), 6, 0.5);
      tools.toppingBowls[0].wobble = 1.0;
      return;
    }

    // 3. Tap or drag directly on pizza -> sprinkles/places currently selected topping!
    const dPizza = hitDistXZ(pointerDownWorld, pizza.group.position.x, pizza.group.position.z);
    if (dPizza < PIZZA_FULL_RADIUS + 0.15) {
      dragMode = 'sprinkle';
      const lx = pointerDownWorld.x - pizza.group.position.x;
      const lz = pointerDownWorld.z - pizza.group.position.z;
      pizza.addTopping(selectedToppingId, lx, lz);
      audio.playToppingDrop(selectedToppingId);
      _onToppingAdded();
      return;
    }
  } else if (stage === STAGES.BAKING) {
    // If golden perfection reached -> tapping pizza, peel, or front hearth pulls steaming pizza out!
    if (bakeProgress >= 0.92) {
      const hitBellows = hitDistXZ(pointerDownWorld, env.bellowsGroup.position.x, env.bellowsGroup.position.z) < 0.72;
      if (!hitBellows) {
        setStage(STAGES.OVEN_OUT);
        return;
      }
    }
    // Pumping bellows or tapping the oven fire stokes golden flames, shoots sparks, and speeds baking!
    env.triggerFireBoost();
    audio.playOvenFireWhoosh();
    particles.emit('spark', new THREE.Vector3(0, 0.45, -3.45), 12, 0.85);
    particles.emit('steam', new THREE.Vector3(0, 0.35, -3.35), 4, 0.6);
    bakeProgress = Math.min(1, bakeProgress + 0.14);
    return;
  } else if (stage === STAGES.CUTTING) {
    const dPizza = hitDistXZ(pointerDownWorld, pizza.group.position.x, pizza.group.position.z);
    const dCutter = hitDistXZ(pointerDownWorld, tools.pizzaCutter.position.x, tools.pizzaCutter.position.z);
    if (dPizza < PIZZA_FULL_RADIUS + 0.55 || dCutter < 0.95) {
      dragMode = 'cut';
      cutDragStart = pointerDownWorld.clone();
      cutDragActive = true;
      return;
    }
    // Tapping eager family plates while cutting makes them wiggle expectantly!
    const pIdx = family.findClosestPlate(pointerDownWorld, 0.85);
    if (pIdx >= 0) {
      family.members[pIdx].happyTimer = 0.7;
      audio.playCeramicClink(pIdx * 0.3);
      return;
    }
  } else if (stage === STAGES.SERVING) {
    // 1. Check fresh dough ball replay tray!
    if (
      family.nextDoughTray.visible &&
      hitDistXZ(pointerDownWorld, family.nextDoughTray.position.x, family.nextDoughTray.position.z) < 0.68
    ) {
      resetGame();
      return;
    }

    // 2. Check picking up an unserved pizza slice!
    const slice = findHitSlice(pointerDownWorld);
    if (slice) {
      dragMode = 'slice';
      draggingSlice = slice;
      selectedSlice = slice;
      slice.isDragging = true;
      pizza.beginCheeseStrands(slice.index);
      audio.playDoughSquish(0.8);
      return;
    }

    // 3. Check tapping a family plate OR family doll!
    const plateIdx = family.findClosestPlate(pointerDownWorld, 0.95);
    if (plateIdx >= 0) {
      if (selectedSlice && !selectedSlice.served) {
        deliverSliceToPlate(selectedSlice, plateIdx);
        selectedSlice = null;
      } else {
        // Gentle expectant clink & wiggle — preserves physical causality!
        family.members[plateIdx].happyTimer = 0.65;
        audio.playCeramicClink(plateIdx * 0.3);
      }
      return;
    }
    const dollIdx = family.findClosestDoll(pointerDownWorld, 0.72);
    if (dollIdx >= 0) {
      family.members[dollIdx].happyTimer = 1.0;
      audio.playFamilyHappy(dollIdx, false);
      return;
    }
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (activePointerId !== e.pointerId || !isDragging) return;
  e.preventDefault();
  idleTime = 0;

  const world = getWorldOnPlane(e.clientX, e.clientY, tablePlane, tmpVec3);
  const dx = world.x - lastDragWorld.x;
  const dz = world.z - lastDragWorld.z;
  const stepDist = Math.hypot(dx, dz);
  lastPointerWorld.copy(world);

  if (dragMode === 'dough' && stage === STAGES.DOUGH) {
    if (stepDist > 0.03) {
      const clampedX = THREE.MathUtils.clamp(world.x, -1.05, 1.05);
      const clampedZ = THREE.MathUtils.clamp(world.z, -0.65, 1.35);
      pinTargetPos.set(clampedX, 0.25, clampedZ);
      pinTargetRotY = Math.atan2(dx, dz) + Math.PI / 2;
      pinSpinVel = Math.min(24, stepDist * 75);

      const dPizza = hitDistXZ(world, pizza.group.position.x, pizza.group.position.z);
      if (dPizza < 1.35) {
        const p = pizza.stretchDough(stepDist * 0.145, dx, dz);
        audio.playRollingWood(stepDist * 14);
        if (Math.random() < 0.35) {
          particles.emit('flour', new THREE.Vector3(clampedX, 0.22, clampedZ), 2, 0.28);
        }
        if (p >= 0.96) {
          pizza.stretchDough(0.1);
          setStage(STAGES.SAUCE);
          dragMode = null;
        }
      }
      lastDragWorld.copy(world);
    }
  } else if (dragMode === 'sauce' && stage === STAGES.SAUCE) {
    ladleActive = true;
    ladleTargetPos.set(
      THREE.MathUtils.clamp(world.x, -1.25, 1.65),
      0.34,
      THREE.MathUtils.clamp(world.z, -0.85, 1.55)
    );
    if (stepDist > 0.045) {
      const lx = world.x - pizza.group.position.x;
      const lz = world.z - pizza.group.position.z;
      if (pizza.paintSauce(lx, lz, 0.26)) {
        audio.playSauceSwirl(stepDist * 16);
        if (stepDist > 0.14 && Math.random() < 0.45) {
          particles.emit('sauce', new THREE.Vector3(world.x, 0.24, world.z), 2, 0.14);
        }
      }
      lastDragWorld.copy(world);
      if (pizza.sauceCoverage >= 0.68) {
        setStage(STAGES.TOPPINGS);
        dragMode = null;
      }
    }
  } else if (dragMode === 'topping' && stage === STAGES.TOPPINGS && draggingToppingType) {
    const lifted = getWorldOnPlane(e.clientX, e.clientY, liftPlane, new THREE.Vector3());
    tools.dragPreview.position.set(lifted.x, 0.44, lifted.z);
    lastDragWorld.copy(world);
  } else if (dragMode === 'sprinkle' && stage === STAGES.TOPPINGS) {
    // If child drags upward from the loaded pizza straight toward the glowing brick oven -> slide into oven!
    if (peelVisibleReady && world.z < -1.35 && pointerDownWorld.z > -0.8) {
      setStage(STAGES.OVEN_IN);
      dragMode = null;
      return;
    }
    // Sweeping finger across pizza sprinkles cheese/corn effortlessly!
    if (stepDist > (selectedToppingId === 'cheese' || selectedToppingId === 'corn' ? 0.28 : 0.45)) {
      const dPizza = hitDistXZ(world, pizza.group.position.x, pizza.group.position.z);
      if (dPizza < PIZZA_FULL_RADIUS * 0.92) {
        pizza.addTopping(selectedToppingId, world.x - pizza.group.position.x, world.z - pizza.group.position.z);
        audio.playToppingDrop(selectedToppingId);
        _onToppingAdded();
      }
      lastDragWorld.copy(world);
    }
  } else if (dragMode === 'cut' && stage === STAGES.CUTTING && cutDragActive) {
    if (!activeCutAnim && cutDragStart) {
      const dragLen = Math.hypot(world.x - cutDragStart.x, world.z - cutDragStart.z);
      if (dragLen > 0.65) {
        const ang = Math.atan2(world.z - cutDragStart.z, world.x - cutDragStart.x);
        if (triggerNextCut(ang)) {
          cutDragActive = false;
        }
      }
    }
  } else if (dragMode === 'slice' && stage === STAGES.SERVING && draggingSlice) {
    const lifted = getWorldOnPlane(e.clientX, e.clientY, liftPlane, new THREE.Vector3());
    // Center the slice's centroid smoothly right under the child's finger!
    const centroidX = Math.cos(draggingSlice.midAngle) * 0.56;
    const centroidZ = Math.sin(draggingSlice.midAngle) * 0.56;
    const localOffX = lifted.x - pizza.group.position.x - centroidX;
    const localOffZ = lifted.z - pizza.group.position.z - centroidZ;
    draggingSlice.group.position.set(localOffX, 0.36, localOffZ);

    const snapped = pizza.updateCheeseStrands(draggingSlice.group.position);
    if (snapped) audio.playCheeseSnap();
    lastDragWorld.copy(lifted);
  }
});

function handlePointerEnd(e) {
  if (activePointerId !== e.pointerId) return;
  activePointerId = null;
  isDragging = false;

  const upWorld = getWorldOnPlane(e.clientX, e.clientY, tablePlane, new THREE.Vector3());

  if (dragMode === 'topping' && stage === STAGES.TOPPINGS && draggingToppingType) {
    const dPizza = hitDistXZ(upWorld, pizza.group.position.x, pizza.group.position.z);
    if (dPizza < PIZZA_FULL_RADIUS + 0.32) {
      pizza.addTopping(
        draggingToppingType,
        upWorld.x - pizza.group.position.x,
        upWorld.z - pizza.group.position.z
      );
      audio.playToppingDrop(draggingToppingType);
      _onToppingAdded();
    }
    draggingToppingType = null;
    tools.setDragPreview(null);
  } else if (dragMode === 'cut' && stage === STAGES.CUTTING && cutDragActive) {
    // Even a simple tap on the pizza or cutter rolls one crisp cut across!
    const tapDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (tapDist < 36) {
      triggerNextCut(null);
    }
    cutDragActive = false;
  } else if (dragMode === 'slice' && stage === STAGES.SERVING && draggingSlice) {
    const slice = draggingSlice;
    draggingSlice = null;
    pizza.hideCheeseStrands();

    // Compute world position of the lifted slice centroid
    const centroidWorld = new THREE.Vector3(
      pizza.group.position.x + slice.group.position.x + Math.cos(slice.midAngle) * 0.56,
      0.14,
      pizza.group.position.z + slice.group.position.z + Math.sin(slice.midAngle) * 0.56
    );
    const plateIdx = family.findClosestPlate(centroidWorld, 1.05);
    if (plateIdx >= 0) {
      deliverSliceToPlate(slice, plateIdx);
      selectedSlice = null;
    } else {
      // Gently settles back onto board (and remains selected so tapping a plate works too!)
      slice.isDragging = false;
    }
  }

  dragMode = null;
}

canvas.addEventListener('pointerup', handlePointerEnd);
canvas.addEventListener('pointercancel', handlePointerEnd);

function _onToppingAdded() {
  toppingsDroppedCount++;
  if (toppingsDroppedCount >= 4 && !peelVisibleReady) {
    peelVisibleReady = true;
    audio.playPeelSlide();
    updateLayoutAndCamera();
  }
}

// =========================================================
// Resize & Mobile Viewport Handling
// =========================================================
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  updateLayoutAndCamera();
}
window.addEventListener('resize', onResize);

// =========================================================
// Main Animation Loop + Adaptive Mobile FPS Guard
// =========================================================
let prevTime = performance.now();
let fpsFrames = 0;
let fpsAccum = 0;
let currentFps = 60;
let lastFrameMs = 8;

function stepSimulation(dt) {
  elapsed += dt;
  stageTimer += dt;
  idleTime += dt;

  const k = 1 - Math.exp(-dt * 5.2);
  const kFast = 1 - Math.exp(-dt * 11.0);

  // Smooth camera choreography
  camera.position.lerp(camPosTarget, k);
  camLookCurrent.lerp(camLookTarget, k);
  camera.lookAt(camLookCurrent);
  if (Math.abs(camera.fov - camFovTarget) > 0.05) {
    camera.fov = THREE.MathUtils.lerp(camera.fov, camFovTarget, k);
    camera.updateProjectionMatrix();
  }

  // Smooth board sliding
  env.boardGroup.position.z = THREE.MathUtils.lerp(env.boardGroup.position.z, boardTargetZ.value, k);

  // --- Stage-Specific Animations ---
  if (stage === STAGES.DOUGH) {
    pizza.group.position.lerp(pizzaPosTarget, kFast);
    tools.rollingPin.position.lerp(pinTargetPos, kFast);
    tools.rollingPin.rotation.y = THREE.MathUtils.lerp(tools.rollingPin.rotation.y, pinTargetRotY, kFast);
    tools.pizzaPeel.position.lerp(peelTargetPos, k);
    pinSpinVel *= Math.exp(-dt * 6);
    tools.pinBarrel.rotation.x += pinSpinVel * dt;
  } else if (stage === STAGES.SAUCE) {
    pizza.group.position.lerp(pizzaPosTarget, kFast);
    tools.rollingPin.position.lerp(pinTargetPos, k);
    tools.rollingPin.rotation.y = THREE.MathUtils.lerp(tools.rollingPin.rotation.y, pinTargetRotY, k);
    tools.pizzaPeel.position.lerp(peelTargetPos, k);
    if (tools.rollingPin.position.x < -2.4) tools.rollingPin.visible = false;
  } else if (stage === STAGES.TOPPINGS) {
    pizza.group.position.lerp(pizzaPosTarget, kFast);
    tools.rollingPin.position.lerp(pinTargetPos, k);
    // Gentle inviting shimmer on the peel once ready to bake!
    const bob = peelVisibleReady ? Math.sin(elapsed * 3.2) * 0.045 : 0;
    tools.pizzaPeel.position.x = THREE.MathUtils.lerp(tools.pizzaPeel.position.x, peelTargetPos.x, k);
    tools.pizzaPeel.position.z = THREE.MathUtils.lerp(tools.pizzaPeel.position.z, peelTargetPos.z + bob, k);
    tools.pizzaPeel.rotation.y = THREE.MathUtils.lerp(tools.pizzaPeel.rotation.y, peelTargetRotY, k);
  } else if (stage === STAGES.OVEN_IN) {
    ovenAnimT = Math.min(1, ovenAnimT + dt * 0.72);
    // Phase 1 (0..0.3): peel scoops neatly under the pizza
    // Phase 2 (0.3..0.85): peel carries pizza straight into the glowing brick oven arch!
    // Phase 3 (0.85..1.0): peel withdraws smoothly leaving pizza on the hot hearth floor
    if (ovenAnimT < 0.3) {
      const t = ovenAnimT / 0.3;
      tools.pizzaPeel.position.set(
        THREE.MathUtils.lerp(peelTargetPos.x, 0, t),
        0.11,
        THREE.MathUtils.lerp(peelTargetPos.z, 0.35, t)
      );
      tools.pizzaPeel.rotation.y = THREE.MathUtils.lerp(peelTargetRotY, 0, t);
    } else if (ovenAnimT < 0.85) {
      const t = (ovenAnimT - 0.3) / 0.55;
      const smooth = t * t * (3 - 2 * t);
      const z = THREE.MathUtils.lerp(0.35, -3.38, smooth);
      const y = THREE.MathUtils.lerp(0.14, 0.19, smooth) + Math.sin(smooth * Math.PI) * 0.14;
      tools.pizzaPeel.position.set(0, y - 0.03, z);
      tools.pizzaPeel.rotation.y = 0;
      pizza.group.position.set(0, y, z);
    } else {
      const t = (ovenAnimT - 0.85) / 0.15;
      tools.pizzaPeel.position.set(0, 0.16, THREE.MathUtils.lerp(-3.38, -1.1, t));
      pizza.group.position.set(0, 0.18, -3.38);
    }
    if (ovenAnimT >= 1) {
      setStage(STAGES.BAKING);
    }
  } else if (stage === STAGES.BAKING) {
    // Live physical baking: dough puffs, leopard-spots appear, cheese melts & bubbles!
    bakeProgress = Math.min(1, bakeProgress + dt * 0.185);
    pizza.setBakeProgress(bakeProgress, elapsed);

    // Sizzling cheese bubbles audio & gentle curling steam
    if (bakeProgress > 0.25 && elapsed - lastBubbleSfx > (bakeProgress > 0.7 ? 0.38 : 0.68)) {
      lastBubbleSfx = elapsed;
      audio.playCheeseBubble();
    }
    if (bakeProgress > 0.45 && elapsed - lastSteamEmit > 0.26) {
      lastSteamEmit = elapsed;
      particles.emit('steam', new THREE.Vector3((Math.random() - 0.5) * 1.1, 0.34, -3.38 + (Math.random() - 0.5) * 0.7), 1, 0.25);
    }

    // Golden perfection! Ring the brass counter bell & slide wooden peel invitingly into view
    if (bakeProgress >= 0.98) {
      if (!bakeBellRung) {
        bakeBellRung = true;
        env.triggerBell();
        audio.playBrassBell();
      }
      bakeReadyTimer += dt;
      const peelHoverZ = -2.2 + Math.sin(elapsed * 3.8) * 0.09;
      tools.pizzaPeel.position.lerp(new THREE.Vector3(0, 0.16, peelHoverZ), k);
      tools.pizzaPeel.rotation.y = THREE.MathUtils.lerp(tools.pizzaPeel.rotation.y, 0, k);
    } else {
      tools.pizzaPeel.position.lerp(new THREE.Vector3(0.45, 0.14, -0.7), k);
    }
  } else if (stage === STAGES.OVEN_OUT) {
    ovenAnimT = Math.min(1, ovenAnimT + dt * 0.85);
    if (ovenAnimT < 0.25) {
      const t = ovenAnimT / 0.25;
      tools.pizzaPeel.position.set(0, 0.16, THREE.MathUtils.lerp(-2.2, -3.38, t));
      tools.pizzaPeel.rotation.y = 0;
    } else {
      const t = (ovenAnimT - 0.25) / 0.75;
      const smooth = t * t * (3 - 2 * t);
      const z = THREE.MathUtils.lerp(-3.38, 0.92, smooth);
      const y = THREE.MathUtils.lerp(0.19, 0.12, smooth) + Math.sin(smooth * Math.PI) * 0.22;
      tools.pizzaPeel.position.set(0, y - 0.03, z);
      pizza.group.position.set(0, y, z);
    }
    if (elapsed - lastSteamEmit > 0.18) {
      lastSteamEmit = elapsed;
      particles.emit('steam', new THREE.Vector3(pizza.group.position.x, pizza.group.position.y + 0.18, pizza.group.position.z), 1, 0.7);
    }
    if (ovenAnimT >= 1) {
      pizza.group.position.set(0, 0.12, 0.92);
      setStage(STAGES.CUTTING);
    }
  } else if (stage === STAGES.CUTTING) {
    pizza.group.position.lerp(pizzaPosTarget, kFast);
    tools.pizzaPeel.position.lerp(peelTargetPos, k);

    // Warm aromatic steam rising off freshly baked pizza!
    if (elapsed - lastSteamEmit > 0.45) {
      lastSteamEmit = elapsed;
      particles.emit('steam', new THREE.Vector3((Math.random() - 0.5) * 1.1, 0.26, 0.92 + (Math.random() - 0.5) * 0.9), 1, 0.22);
    }

    if (activeCutAnim) {
      activeCutAnim.t += dt * 2.4;
      const t = Math.min(1, activeCutAnim.t);
      const a = activeCutAnim.angle;
      const dist = THREE.MathUtils.lerp(-PIZZA_FULL_RADIUS - 0.15, PIZZA_FULL_RADIUS + 0.15, t);
      const cx = pizza.group.position.x + Math.cos(a) * dist;
      const cz = pizza.group.position.z + Math.sin(a) * dist;
      tools.pizzaCutter.position.set(cx, 0.14, cz);
      tools.pizzaCutter.rotation.y = -a + Math.PI / 2;
      tools.cutterWheel.rotation.x += dt * 18;

      if (Math.random() < 0.55) {
        particles.emit('crumb', new THREE.Vector3(cx, 0.2, cz), 2, 0.12);
      }
      if (!activeCutAnim.applied && t >= 0.52) {
        activeCutAnim.applied = true;
        pizza.applyCut(activeCutAnim.cutIdx);
        particles.emit('steam', new THREE.Vector3(pizza.group.position.x, 0.25, pizza.group.position.z), 3, 0.45);
      }
      if (t >= 1) {
        activeCutAnim = null;
        if (pizza.allCutsDone()) {
          setStage(STAGES.SERVING);
        }
      }
    } else {
      // Gentle inviting gleam/hover on rotary cutter
      const bob = Math.sin(elapsed * 3.5) * 0.035;
      tools.pizzaCutter.position.lerp(new THREE.Vector3(cutterTargetPos.x, cutterTargetPos.y + bob, cutterTargetPos.z), k);
      tools.pizzaCutter.rotation.y = THREE.MathUtils.lerp(tools.pizzaCutter.rotation.y, cutterTargetRotY, k);
    }
  } else if (stage === STAGES.SERVING) {
    pizza.group.position.lerp(pizzaPosTarget, kFast);
    tools.pizzaCutter.position.lerp(cutterTargetPos, k);

    // Subtle lift when a slice is tap-selected
    for (const s of pizza.slices) {
      if (!s.served && !s.isDragging) {
        const extraY = s === selectedSlice ? 0.14 + Math.sin(elapsed * 6) * 0.03 : 0;
        s.group.position.y = THREE.MathUtils.lerp(s.group.position.y, extraY, kFast);
      }
    }
  }

  // Sauce crock & wooden ladle motion
  sauceCrockWobble = Math.max(0, sauceCrockWobble - dt * 4.5);
  tools.sauceCrock.position.lerp(crockTargetPos, k);
  tools.sauceCrock.rotation.z = Math.sin(sauceCrockWobble * Math.PI * 5) * sauceCrockWobble * 0.12;

  if (ladleActive && stage === STAGES.SAUCE) {
    tools.ladle.position.lerp(ladleTargetPos, kFast);
    tools.ladle.rotation.z = THREE.MathUtils.lerp(tools.ladle.rotation.z, 0.18, kFast);
  } else {
    // Rest inside the sauce crock, with gentle inviting bob in Stage 2
    const bob = stage === STAGES.SAUCE ? Math.sin(elapsed * 4.2) * 0.05 : 0;
    tools.ladle.position.lerp(
      new THREE.Vector3(tools.sauceCrock.position.x, 0.42 + bob, tools.sauceCrock.position.z),
      k
    );
    tools.ladle.rotation.z = THREE.MathUtils.lerp(tools.ladle.rotation.z, -0.15, k);
  }

  // --- Gentle Wordless Idle Nudge (ONLY after ~9s of no interaction; zero arrows/text!) ---
  if (idleTime > nextIdleNudge) {
    nextIdleNudge = idleTime + 7.5;
    if (stage === STAGES.DOUGH) {
      pinSpinVel = 8;
      pizza.squashImpulse = 0.45;
    } else if (stage === STAGES.SAUCE) {
      sauceCrockWobble = 0.9;
    } else if (stage === STAGES.TOPPINGS) {
      if (peelVisibleReady) {
        env.triggerFireBoost();
      } else {
        tools.toppingBowls[0].wobble = 0.9;
      }
    } else if (stage === STAGES.BAKING && bakeProgress >= 0.95) {
      env.triggerBell();
      audio.playBrassBell();
    } else if (stage === STAGES.CUTTING) {
      tools.cutterWheel.rotation.x += 1.2;
    }
  }

  // Track lifted slice world pos so family heads follow it eagerly!
  let lookWorld = null;
  if (stage === STAGES.SERVING && draggingSlice) {
    lookWorld = new THREE.Vector3(
      pizza.group.position.x + draggingSlice.group.position.x + Math.cos(draggingSlice.midAngle) * 0.56,
      0.45,
      pizza.group.position.z + draggingSlice.group.position.z + Math.sin(draggingSlice.midAngle) * 0.56
    );
  }

  // Update world subsystems
  env.update(dt, elapsed, stage === STAGES.BAKING || stage === STAGES.OVEN_IN);
  pizza.update(dt);
  tools.update(dt, elapsed);
  family.update(dt, elapsed, lookWorld);
  particles.update(dt);
}

function animate(now) {
  requestAnimationFrame(animate);
  const rawDt = (now - prevTime) / 1000;
  prevTime = now;
  const dt = Math.min(rawDt, 0.05);

  // Rolling FPS tracker & gentle adaptive DPR guard for rock-solid >=30fps on iPhone/iPad
  // Ignore background/hidden tab throttled frames so returning to the app stays razor-sharp!
  if (!document.hidden && rawDt > 0 && rawDt < 0.2) {
    fpsFrames++;
    fpsAccum += rawDt;
    if (fpsAccum >= 1.5) {
      currentFps = fpsFrames / fpsAccum;
      if (currentFps < 28 && currentDpr > 1.0) {
        currentDpr = Math.max(1.0, currentDpr - 0.25);
        renderer.setPixelRatio(currentDpr);
        composer.setSize(window.innerWidth, window.innerHeight);
      }
      fpsFrames = 0;
      fpsAccum = 0;
    }
  }

  const t0 = performance.now();
  stepSimulation(dt);
  // Render with Tilt-Shift Macro Lens Post-Processing
  composer.render(scene, camera, dt, elapsed);
  lastFrameMs = performance.now() - t0;
}

// Start in Stage 1!
setStage(STAGES.DOUGH);
requestAnimationFrame(animate);

// Minimal inspection hook for live automated QA & thumbnail capture
window.__miniPizza = {
  getState: () => ({
    stage,
    fps: Math.round(currentFps),
    frameMs: Number(lastFrameMs.toFixed(2)),
    dpr: currentDpr,
    stretch: Number(pizza.stretchProgress.toFixed(2)),
    sauce: Number(pizza.sauceCoverage.toFixed(2)),
    toppings: pizza.getToppingCounts(),
    bake: Number(bakeProgress.toFixed(2)),
    cuts: [...pizza.cutStates],
    served: pizza.slices.filter((s) => s.served).length,
    familyServed: family.members.map((m) => m.servedCount)
  }),
  stepFrames: (n = 90) => {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) stepSimulation(1 / 60);
    composer.render(scene, camera, 1 / 60, elapsed);
    const totalMs = performance.now() - t0;
    return { stepped: n, renderMs: Number(totalMs.toFixed(2)) };
  },
  deliverSliceDebug: (sliceIdx, plateIdx) => {
    if (pizza.slices[sliceIdx] && !pizza.slices[sliceIdx].served) {
      deliverSliceToPlate(pizza.slices[sliceIdx], plateIdx);
    }
  },
  // Helper for deterministic QA inspection of stages (never used in normal gameplay)
  debugJumpToStage: (targetStage) => {
    if (targetStage === 'DOUGH') {
      resetGame(false);
    } else if (targetStage === 'SAUCE') {
      resetGame(false);
      pizza.stretchDough(1.0);
      setStage(STAGES.SAUCE);
    } else if (targetStage === 'TOPPINGS') {
      resetGame(false);
      pizza.stretchDough(1.0);
      for (let a = 0; a < Math.PI * 2; a += 0.45) {
        pizza.paintSauce(Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.36);
      }
      pizza.paintSauce(0, 0, 0.45);
      setStage(STAGES.TOPPINGS);
    } else if (targetStage === 'TOPPINGS_LOADED') {
      window.__miniPizza.debugJumpToStage('TOPPINGS');
      const preset = [
        ['cheese', 0, 0], ['cheese', 0.42, 0.22], ['cheese', -0.42, 0.28], ['cheese', 0.25, -0.46], ['cheese', -0.35, -0.35],
        ['cheese', 0.52, -0.1], ['cheese', -0.52, -0.08], ['cheese', 0.05, 0.52], ['cheese', -0.08, -0.52],
        ['pepperoni', 0.42, 0.38], ['pepperoni', -0.45, 0.35], ['pepperoni', 0.48, -0.3], ['pepperoni', -0.38, -0.42], ['pepperoni', 0.02, 0.05],
        ['tomato', 0.05, 0.58], ['tomato', -0.58, -0.05], ['tomato', 0.55, 0.05], ['tomato', -0.05, -0.58],
        ['corn', 0.25, 0.22], ['corn', -0.25, 0.28], ['corn', 0.28, -0.26], ['corn', -0.22, -0.22],
        ['mushroom', -0.25, 0.52], ['mushroom', 0.32, -0.52], ['mushroom', -0.55, -0.28],
        ['basil', 0.18, -0.08], ['basil', -0.18, 0.14], ['basil', 0.05, -0.34]
      ];
      for (const [t, x, z] of preset) pizza.addTopping(t, x, z);
      toppingsDroppedCount = preset.length;
      peelVisibleReady = true;
      updateLayoutAndCamera();
    } else if (targetStage === 'BAKING_DONE') {
      window.__miniPizza.debugJumpToStage('TOPPINGS_LOADED');
      setStage(STAGES.BAKING);
      pizza.group.position.set(0, 0.18, -3.38);
      bakeProgress = 1.0;
      pizza.setBakeProgress(1.0, 2.5);
    } else if (targetStage === 'CUTTING') {
      window.__miniPizza.debugJumpToStage('BAKING_DONE');
      family.setVisible(true, isPortrait);
      pizza.group.position.set(0, 0.12, 0.92);
      setStage(STAGES.CUTTING);
    } else if (targetStage === 'SERVING') {
      window.__miniPizza.debugJumpToStage('CUTTING');
      pizza.applyCut(0);
      pizza.applyCut(1);
      pizza.applyCut(2);
      setStage(STAGES.SERVING);
    }
  }
};
