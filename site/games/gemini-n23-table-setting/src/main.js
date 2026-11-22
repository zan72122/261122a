import * as THREE from 'three';
import { buildEnvironment, SEAT_CONFIGS } from './environment.js';
import { FamilyMember } from './characters.js';
import {
  DINNER_MENUS,
  DinnerPlate,
  ChopstickPair,
  DinnerCup,
  DinnerPot,
  DinnerLadle,
  TeaPitcher,
  SprinkleShaker,
  ServiceBell,
} from './items.js';
import { ComicFX } from './fx.js';
import { sound } from './audio.js';

// ---------- Renderer & Scene Setup ----------
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // Crisp vivid cel-anime colors!

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffe1c2);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);

// Warm golden-hour cel-anime lighting
const hemiLight = new THREE.HemisphereLight(0xfff1dc, 0x8e6fa3, 1.12);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff4da, 1.65);
sunLight.position.set(-4.2, 7.2, 4.5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 20;
sunLight.shadow.camera.left = -5.2;
sunLight.shadow.camera.right = 5.2;
sunLight.shadow.camera.top = 5.2;
sunLight.shadow.camera.bottom = -4.2;
sunLight.shadow.bias = -0.0008;
scene.add(sunLight);

// Subtle warm rim from pendant lamp
const rimLight = new THREE.PointLight(0xffd27d, 0.65, 10);
rimLight.position.set(0, 3.2, 0.1);
scene.add(rimLight);

// ---------- Build World ----------
const fx = new ComicFX(scene);
const { seats } = buildEnvironment(scene);
const family = seats.map((s) => new FamilyMember(s, scene, fx));

// Interactive Items on Front Serving Counter
const plateStackBase = new THREE.Vector3(-2.18, 0.025, 1.96);
const plates = SEAT_CONFIGS.map((cfg, i) => {
  const home = plateStackBase.clone().add(new THREE.Vector3(0, i * 0.088, 0));
  return new DinnerPlate(i, cfg, home, scene);
});

const chopHomes = [
  new THREE.Vector3(-1.18, 0.048, 1.88),
  new THREE.Vector3(-1.18, 0.048, 2.06),
  new THREE.Vector3(-1.18, 0.048, 2.24),
];
const chopsticks = SEAT_CONFIGS.map((cfg, i) => new ChopstickPair(i, cfg, chopHomes[i], scene));

const cupHomes = [
  new THREE.Vector3(0.98, 0.046, 1.9),
  new THREE.Vector3(1.28, 0.046, 2.12),
  new THREE.Vector3(1.56, 0.046, 1.88),
];
const cups = SEAT_CONFIGS.map((cfg, i) => new DinnerCup(i, cfg, cupHomes[i], scene));

const pot = new DinnerPot(new THREE.Vector3(-0.04, 0.045, 1.9), scene);
const ladleClosedHome = new THREE.Vector3(0.46, 0.04, 2.52);
const ladleOpenHome = new THREE.Vector3(0.14, 0.34, 1.92);
const ladle = new DinnerLadle(ladleClosedHome, scene);
const pitcher = new TeaPitcher(new THREE.Vector3(2.14, 0.025, 1.82), scene);
const shaker = new SprinkleShaker(new THREE.Vector3(2.16, 0.025, 2.38), scene);
const bell = new ServiceBell(new THREE.Vector3(-2.18, 0.025, 2.48), scene);

// Soft drop shadow blob that follows currently dragged item on the tabletop!
const dragShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.38, 18),
  new THREE.MeshBasicMaterial({
    color: 0x1a1324,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  })
);
dragShadow.rotation.x = -Math.PI / 2;
dragShadow.position.y = 0.028;
dragShadow.visible = false;
scene.add(dragShadow);

// Collect all raycastable interactive hit meshes
function getInteractables() {
  const list = [
    ladle.hitMesh,
    pot.lidHitMesh,
    pot.potHitMesh,
    pitcher.hitMesh,
    shaker.hitMesh,
    ...plates.map((p) => p.hitMesh),
    ...chopsticks.map((c) => c.hitMesh),
    ...cups.map((c) => c.hitMesh),
    ...family.map((f) => f.hitMesh),
  ];
  if (bell.unlocked) list.push(bell.hitMesh);
  return list;
}

// ---------- Responsive Camera Framing (iPhone Portrait & iPad Landscape) ----------
function updateCameraLayout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const aspect = w / Math.max(1, h);
  camera.aspect = aspect;

  if (aspect >= 1.15) {
    // iPad / Desktop Landscape (including 4:3!) — showcase expressive anime faces & sunset window!
    camera.fov = 39;
    const zoomAdjust = THREE.MathUtils.clamp(1.33 / aspect, 0.92, 1.12);
    camera.position.set(0, 4.12 * zoomAdjust, 6.42 * zoomAdjust);
    camera.lookAt(0, 0.48, 0.32);
  } else {
    // iPhone Portrait — tightly frame full counter, all 3 seats, lamp & sunset window!
    camera.fov = 44;
    const pull = THREE.MathUtils.clamp(0.92 / aspect, 1.02, 1.94);
    camera.position.set(0, 4.25 * pull, 5.75 * pull);
    camera.lookAt(0, 0.48, 0.38);
  }
  camera.updateProjectionMatrix();
}
updateCameraLayout();
window.addEventListener('resize', updateCameraLayout);

// ---------- Game State ----------
let currentMenuIndex = 0;
let feastCelebrated = false;
let idleTime = 0;
let idleDemoDone = false;
let steamTimer = 0;
let sparkleTimer = 0;

// ---------- One-Finger Pointer Drag & Tap System ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.58);
const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05);
const hitPoint = new THREE.Vector3();

let activePointerId = null;
let dragKind = null;
let dragItem = null;
let dragStartScreen = { x: 0, y: 0 };
let dragLastWorld = new THREE.Vector3();
let dragVelocity = new THREE.Vector3();
let stirPrevAngle = 0;
let pourCooldown = 0;
let shakeCooldown = 0;
let ladleServeCooldown = 0;
let activeLookTarget = null;

function setPointerNDC(e) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function getTopPlateAtStack() {
  // Always pick highest unplaced plate from the stack cleanly!
  const unplaced = plates.filter((p) => !p.seat);
  if (unplaced.length === 0) return null;
  unplaced.sort((a, b) => b.group.position.y - a.group.position.y);
  return unplaced[0];
}

function anyPlateOnTable() {
  return seats.some((s) => Boolean(s.plate));
}

function findNearestSeat(pos, maxDist = 1.05, filterFn = null) {
  let best = null;
  let bestD = maxDist;
  for (const s of seats) {
    if (filterFn && !filterFn(s)) continue;
    const d = Math.hypot(pos.x - s.matPos.x, pos.z - s.matPos.z);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

function findNearestCup(pos, maxDist = 0.72) {
  let best = null;
  let bestD = maxDist;
  for (const c of cups) {
    const d = Math.hypot(pos.x - c.group.position.x, pos.z - c.group.position.z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function findNearestPlacedPlate(pos, maxDist = 0.8) {
  let best = null;
  let bestD = maxDist;
  for (const s of seats) {
    if (!s.plate) continue;
    const d = Math.hypot(pos.x - s.plateSpot.x, pos.z - s.plateSpot.z);
    if (d < bestD) {
      bestD = d;
      best = s.plate;
    }
  }
  return best;
}

function resetIdle() {
  idleTime = 0;
  idleDemoDone = false;
  fx.cancelIdleHandDemo();
}

function onPointerDown(e) {
  // Strictly one-finger: ignore secondary touches while active
  if (activePointerId !== null) return;
  sound.unlock();
  resetIdle();

  setPointerNDC(e);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(getInteractables(), false);
  if (hits.length === 0) return;

  // Prefer ladle over lid if ladle is right there, or pick top hit
  let hit = hits[0];
  const kind = hit.object.userData.interactKind;
  const item = hit.object.userData.item;

  // Instant-tap items: Character, Bell, Lid
  if (kind === 'character') {
    hit.object.userData.character.onDirectTap();
    return;
  }

  if (kind === 'bell') {
    triggerNextMenuCycle();
    return;
  }

  if (kind === 'lid') {
    if (!pot.lidOpen) {
      pot.setLidOpen(true);
      sound.playLidPop(true);
      // Big anime steam cloud!
      for (let i = 0; i < 6; i++) {
        fx.spawnSteam(pot.pos.clone().add(new THREE.Vector3(0, 0.55, 0)), 0.55);
      }
      // Family sniffs eagerly!
      family.forEach((f, idx) => {
        setTimeout(() => {
          f.bounce = 0.6;
        }, idx * 90);
      });
    } else {
      pot.setLidOpen(false);
      sound.playLidPop(false);
    }
    return;
  }

  if (kind === 'pot') {
    // Tapping pot itself: open lid if closed, or grab ladle to stir!
    if (!pot.lidOpen) {
      pot.setLidOpen(true);
      sound.playLidPop(true);
      for (let i = 0; i < 6; i++) {
        fx.spawnSteam(pot.pos.clone().add(new THREE.Vector3(0, 0.55, 0)), 0.55);
      }
      return;
    }
    // Redirect smoothly to grabbing the ladle!
    startDrag(e, 'ladle', ladle);
    return;
  }

  if (kind === 'plate') {
    let targetPlate = item;
    if (!targetPlate.seat) {
      targetPlate = getTopPlateAtStack() || item;
    } else {
      // Detach from seat when picked up again (unless it already has food? Even with food, let them move it!)
      targetPlate.seat.plate = null;
      targetPlate.seat = null;
    }
    startDrag(e, 'plate', targetPlate);
    return;
  }

  if (kind === 'chopsticks') {
    if (item.seat) {
      item.seat.chopsticks = null;
      item.seat = null;
    }
    startDrag(e, 'chopsticks', item);
    return;
  }

  if (kind === 'cup') {
    if (item.seat) {
      item.seat.cup = null;
      item.seat = null;
    }
    startDrag(e, 'cup', item);
    return;
  }

  if (kind === 'ladle') {
    // If lid is still closed, pop it open automatically so child is never blocked!
    if (!pot.lidOpen) {
      pot.setLidOpen(true);
      sound.playLidPop(true);
      for (let i = 0; i < 5; i++) {
        fx.spawnSteam(pot.pos.clone().add(new THREE.Vector3(0, 0.55, 0)), 0.5);
      }
    }
    startDrag(e, 'ladle', ladle);
    return;
  }

  if (kind === 'pitcher') {
    startDrag(e, 'pitcher', pitcher);
    return;
  }

  if (kind === 'shaker') {
    startDrag(e, 'shaker', shaker);
    return;
  }
}

function startDrag(e, kind, item) {
  activePointerId = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
  dragKind = kind;
  dragItem = item;
  item.isDragging = true;
  dragStartScreen = { x: e.clientX, y: e.clientY };
  dragVelocity.set(0, 0, 0);

  sound.playPickup(kind);

  // Intersect ray on the TABLETOP plane (Y = 0.08) so dragged items stay 1:1 under finger with ZERO parallax!
  dragPlane.constant = -0.08;

  if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
    dragLastWorld.copy(hitPoint);
    if (kind === 'ladle') {
      stirPrevAngle = Math.atan2(hitPoint.z - pot.pos.z, hitPoint.x - pot.pos.x);
      // If lid is open and pot is ready, immediately scoop delicious stew on pickup so dragging straight to a plate works effortlessly!
      if (!ladle.hasScoop && pot.lidOpen) {
        ladle.fillScoop(pot.menuIndex);
        sound.playScoop();
      }
    }
  }
  dragShadow.visible = true;
}

function onPointerMove(e) {
  if (activePointerId === null || e.pointerId !== activePointerId || !dragItem) return;
  resetIdle();
  setPointerNDC(e);
  raycaster.setFromCamera(ndc, camera);

  if (!raycaster.ray.intersectPlane(dragPlane, hitPoint)) return;

  // Clamp gently to visible play bounds
  hitPoint.x = THREE.MathUtils.clamp(hitPoint.x, -3.1, 3.1);
  hitPoint.z = THREE.MathUtils.clamp(hitPoint.z, -1.25, 2.75);

  dragVelocity.subVectors(hitPoint, dragLastWorld);
  const moveSpeed = dragVelocity.length();
  dragLastWorld.copy(hitPoint);

  // Move dragged object smoothly right over the tabletop point under the finger
  dragItem.group.position.x = hitPoint.x;
  dragItem.group.position.z = hitPoint.z;

  if (dragKind === 'ladle') {
    const distPot = Math.hypot(hitPoint.x - pot.pos.x, hitPoint.z - pot.pos.z);
    if (distPot < 0.68) {
      // Inside pot! Dip down and stir the stew!
      dragItem.group.position.y = 0.36;
      dragItem.tilt = 0;
      const ang = Math.atan2(hitPoint.z - pot.pos.z, hitPoint.x - pot.pos.x);
      let dAng = ang - stirPrevAngle;
      if (dAng > Math.PI) dAng -= Math.PI * 2;
      if (dAng < -Math.PI) dAng += Math.PI * 2;
      stirPrevAngle = ang;
      if (Math.abs(dAng) > 0.03) {
        pot.stir(dAng);
        sound.playStir(Math.abs(dAng) * 8);
        if (Math.random() < 0.25) {
          fx.spawnSteam(pot.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0.36);
        }
      }
      // Scoops up stew while dipped in pot!
      if (!ladle.hasScoop) {
        ladle.fillScoop(pot.menuIndex);
        sound.playScoop();
      }
    } else {
      // Lifted out of pot!
      dragItem.group.position.y = 0.48;
      if (!ladle.hasScoop && anyPlateOnTable()) {
        ladle.fillScoop(pot.menuIndex);
        sound.playScoop();
      }
      // Check if hovering over a placed plate to serve!
      const nearPlate = findNearestPlacedPlate(hitPoint, 0.72);
      if (nearPlate && ladle.hasScoop) {
        ladle.tilt = 0.72;
        if (ladleServeCooldown <= 0) {
          servePlateWithLadle(nearPlate);
          ladleServeCooldown = 0.45;
        }
      } else {
        ladle.tilt = 0;
      }
    }
  } else if (dragKind === 'pitcher') {
    dragItem.group.position.y = 0.52;
    const cup = findNearestCup(hitPoint, 0.78);
    if (cup) {
      // Hold pitcher gracefully beside cup and pour!
      dragItem.group.position.set(cup.group.position.x + 0.4, 0.68, cup.group.position.z);
      pitcher.setPourStream(true, cup.group.position);
      if (pourCooldown <= 0) {
        pourCooldown = 0.05;
        const overflowing = cup.pour(0.11);
        sound.playPourTick(cup.fillLevel, overflowing);
        if (overflowing) {
          cup.showOverflowFoam(true);
          fx.spawnSplash(cup.group.position.clone().add(new THREE.Vector3(0, 0.36, 0)), 0xffbe42, 3);
          if (cup.seat) {
            cup.seat.puddleLevel = Math.min(1.0, cup.seat.puddleLevel + 0.14);
            const char = family[cup.seat.id];
            if (char.amazedTimer <= 0.1) {
              char.reactHappy('amazed', 'droplet');
            }
          }
        }
      }
    } else {
      pitcher.setPourStream(false);
    }
  } else if (dragKind === 'shaker') {
    dragItem.group.position.y = 0.56;
    const plate = findNearestPlacedPlate(hitPoint, 0.75);
    if (plate && plate.foodLevel > 0) {
      shaker.shaking = true;
      if (shakeCooldown <= 0) {
        shakeCooldown = 0.14;
        sound.playShakeSprinkle();
        fx.spawnSprinkle(plate.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
        if (!plate.sprinkled) {
          plate.addSprinkles();
          if (plate.seat) {
            family[plate.seat.id].reactHappy('bliss', 'star');
          }
        }
      }
    } else {
      shaker.shaking = false;
    }
  } else {
    // Plate, chopsticks, cup gentle hover height (1:1 over tabletop shadow!)
    dragItem.group.position.y = 0.34;
    if (dragKind === 'cup' && dragItem.fillLevel > 0.05 && moveSpeed > 0.02) {
      dragItem.slosh = Math.min(1, dragItem.slosh + moveSpeed * 4);
    }
  }

  dragShadow.position.set(dragItem.group.position.x, 0.028, dragItem.group.position.z);
  activeLookTarget = dragItem.group.position;
}

function servePlateWithLadle(plate) {
  ladle.emptyScoop();
  plate.addFood(pot.menuIndex);
  sound.playServePlop(plate.foodLevel);
  fx.spawnBurst(plate.group.position.clone().add(new THREE.Vector3(0, 0.25, 0)), 6, 'star', 0.9);
  fx.spawnSteam(plate.group.position.clone().add(new THREE.Vector3(0, 0.3, 0)), 0.42);

  if (plate.seat) {
    const char = family[plate.seat.id];
    if (plate.foodLevel >= 3) {
      // Giant mountain serving -> comic starry-eyed awe!
      char.reactHappy('amazed', 'star');
    } else {
      char.reactHappy('happy', 'heart');
    }
  }
  checkFeastCelebration();
}

function onPointerUp(e) {
  if (activePointerId === null || e.pointerId !== activePointerId) return;
  canvas.classList.remove('dragging');
  try {
    canvas.releasePointerCapture(e.pointerId);
  } catch (_) {}

  const movedPx = Math.hypot(e.clientX - dragStartScreen.x, e.clientY - dragStartScreen.y);
  const kind = dragKind;
  const item = dragItem;

  activePointerId = null;
  dragKind = null;
  dragItem = null;
  activeLookTarget = null;
  dragShadow.visible = false;

  if (!item) return;
  item.isDragging = false;

  if (kind === 'plate') {
    handlePlateDrop(item, movedPx);
  } else if (kind === 'chopsticks') {
    handleChopsticksDrop(item, movedPx);
  } else if (kind === 'cup') {
    handleCupDrop(item, movedPx);
  } else if (kind === 'ladle') {
    // If released over a placed plate with scoop, serve!
    const nearPlate = findNearestPlacedPlate(item.group.position, 0.85);
    if (nearPlate && ladle.hasScoop) {
      servePlateWithLadle(nearPlate);
    } else if (ladle.hasScoop) {
      // Returns smoothly to pot with a little splash
      ladle.emptyScoop();
      fx.spawnSplash(pot.pos.clone().add(new THREE.Vector3(0, 0.45, 0)), DINNER_MENUS[pot.menuIndex].brothColor, 4);
    }
    ladle.tilt = 0;
  } else if (kind === 'pitcher') {
    pitcher.setPourStream(false);
  } else if (kind === 'shaker') {
    shaker.shaking = false;
  }
}

function handlePlateDrop(plate, movedPx) {
  // Velocity-assisted forgiving target
  const dropPos = plate.group.position.clone().add(dragVelocity.clone().multiplyScalar(2.4));

  // Quick tap without moving? Gentle playful wiggle bounce (preserves causality!)
  if (movedPx < 14) {
    plate.bounce = 0.85;
    plate.wobble = 0.8;
    sound.playPlace('plate', false);
    returnPlateHome(plate);
    return;
  }

  // Try empty seat first
  const openSeat = findNearestSeat(dropPos, 1.15, (s) => !s.plate);
  if (openSeat) {
    placePlateOnSeat(plate, openSeat);
    return;
  }

  // Playful mischief: dropped onto another empty plate? Wobble clack & bounce back safely!
  const occupiedSeat = findNearestSeat(dropPos, 0.72, (s) => Boolean(s.plate));
  if (occupiedSeat && occupiedSeat.plate.foodLevel === 0) {
    occupiedSeat.plate.wobble = 1.0;
    occupiedSeat.plate.bounce = 0.9;
    sound.playPlace('plate', false);
    fx.spawnBurst(occupiedSeat.plateSpot, 3, 'star', 0.6);
  }
  returnPlateHome(plate);
}

function placePlateOnSeat(plate, seat) {
  seat.plate = plate;
  plate.seat = seat;
  plate.group.position.copy(seat.plateSpot);
  plate.group.rotation.y = seat.matRotY;
  plate.bounce = 1.0;

  const isColorMatch = plate.role === seat.role;
  sound.playPlace('plate', isColorMatch);
  fx.spawnBurst(seat.plateSpot, isColorMatch ? 7 : 4, 'star', isColorMatch ? 1.1 : 0.75);
  family[seat.id].reactHappy(isColorMatch ? 'bliss' : 'happy', isColorMatch ? 'heart' : 'star');
  checkFeastCelebration();
}

function returnPlateHome(plate) {
  plate.seat = null;
  // Restack neatly on unplaced plates
  const unplacedCount = plates.filter((p) => !p.seat && p !== plate).length;
  plate.group.position.set(
    plateStackBase.x,
    plateStackBase.y + unplacedCount * 0.088,
    plateStackBase.z
  );
  plate.group.rotation.y = 0;
}

function handleChopsticksDrop(chop, movedPx) {
  if (movedPx < 14) {
    chop.bounce = 0.85;
    sound.playPlace('chopsticks', false);
    chop.group.position.copy(chop.homePos);
    chop.group.rotation.y = 0;
    return;
  }
  const dropPos = chop.group.position.clone().add(dragVelocity.clone().multiplyScalar(2.4));
  const openSeat = findNearestSeat(dropPos, 1.15, (s) => !s.chopsticks);
  if (openSeat) {
    openSeat.chopsticks = chop;
    chop.seat = openSeat;
    chop.group.position.copy(openSeat.chopSpot);
    chop.group.rotation.y = openSeat.matRotY;
    chop.bounce = 1.0;

    const match = chop.role === openSeat.role;
    sound.playPlace('chopsticks', match);
    fx.spawnBurst(openSeat.chopSpot, match ? 6 : 3, 'star', 0.8);
    family[openSeat.id].reactHappy('happy', match ? 'heart' : 'note');
    checkFeastCelebration();
  } else {
    chop.group.position.copy(chop.homePos);
    chop.group.rotation.y = 0;
  }
}

function handleCupDrop(cup, movedPx) {
  if (movedPx < 14) {
    cup.bounce = 0.85;
    sound.playPlace('cup', false);
    cup.group.position.copy(cup.homePos);
    return;
  }
  const dropPos = cup.group.position.clone().add(dragVelocity.clone().multiplyScalar(2.4));
  const openSeat = findNearestSeat(dropPos, 1.15, (s) => !s.cup);
  if (openSeat) {
    openSeat.cup = cup;
    cup.seat = openSeat;
    cup.group.position.copy(openSeat.cupSpot);
    cup.bounce = 1.0;

    const match = cup.role === openSeat.role;
    sound.playPlace('cup', match);
    fx.spawnBurst(openSeat.cupSpot, match ? 6 : 3, 'star', 0.8);
    family[openSeat.id].reactHappy('happy', match ? 'heart' : 'star');
    checkFeastCelebration();
  } else {
    cup.group.position.copy(cup.homePos);
  }
}

function checkFeastCelebration() {
  if (feastCelebrated) return;
  const allReady = seats.every((s) => s.plate && s.plate.foodLevel > 0 && s.chopsticks && s.cup);
  if (allReady) {
    feastCelebrated = true;
    sound.playFeastFanfare();
    family.forEach((f, idx) => {
      setTimeout(() => f.triggerCelebration(), idx * 140);
    });
    // Unlock shiny dinner bell for menu-change replay!
    setTimeout(() => {
      bell.unlock();
      fx.spawnBurst(bell.homePos.clone().add(new THREE.Vector3(0, 0.25, 0)), 6, 'star', 0.85);
    }, 1400);
  }
}

function triggerNextMenuCycle() {
  bell.ring();
  sound.playBell();
  fx.spawnBurst(bell.homePos.clone().add(new THREE.Vector3(0, 0.35, 0)), 8, 'note', 1.1);

  currentMenuIndex = (currentMenuIndex + 1) % DINNER_MENUS.length;
  pot.setMenu(currentMenuIndex);
  pot.setLidOpen(false);
  feastCelebrated = false;

  // Big magical steam & sparkle puff over the new dinner pot!
  fx.spawnBurst(pot.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 10, 'star', 1.35);
  for (let i = 0; i < 6; i++) {
    fx.spawnSteam(pot.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 0.55);
  }

  // Clear plates & cups neatly back for a fresh round of table setting!
  seats.forEach((s) => {
    s.plate = null;
    s.chopsticks = null;
    s.cup = null;
    s.puddleLevel = 0;
  });
  plates.forEach((p, i) => {
    p.clearFood();
    p.eatenCount = 0;
    p.seat = null;
    p.group.position.copy(plateStackBase).add(new THREE.Vector3(0, i * 0.088, 0));
    p.group.rotation.y = 0;
    p.bounce = 0.9;
  });
  chopsticks.forEach((c) => {
    c.seat = null;
    c.group.position.copy(c.homePos);
    c.group.rotation.y = 0;
    c.bounce = 0.8;
  });
  cups.forEach((c) => {
    c.seat = null;
    c.fillLevel = 0;
    c._syncLiquid();
    c.group.position.copy(c.homePos);
    c.bounce = 0.8;
  });
  family.forEach((f) => {
    f.bounce = 0.9;
    f.biteCount = 0;
  });
}

// ---------- Subtle Single Idle Hand Demo (only after 10s untouched!) ----------
function triggerIdleDemoIfNeeded() {
  if (idleDemoDone || activePointerId !== null) return;
  idleDemoDone = true;

  // Pick the most relevant next natural step:
  // 1) Place a plate on an empty seat
  const emptyPlateSeat = seats.find((s) => !s.plate);
  const topPlate = getTopPlateAtStack();
  if (emptyPlateSeat && topPlate) {
    fx.playIdleHandDemo(
      topPlate.group.position.clone().add(new THREE.Vector3(0, 0.3, 0)),
      emptyPlateSeat.plateSpot.clone().add(new THREE.Vector3(0, 0.3, 0))
    );
    return;
  }
  // 2) Scoop food onto an empty placed plate
  const hungrySeat = seats.find((s) => s.plate && s.plate.foodLevel === 0);
  if (hungrySeat) {
    fx.playIdleHandDemo(
      pot.pos.clone().add(new THREE.Vector3(0.2, 0.55, 0)),
      hungrySeat.plateSpot.clone().add(new THREE.Vector3(0, 0.35, 0))
    );
    return;
  }
  // 3) Place chopsticks on a seat missing chopsticks
  const needChopSeat = seats.find((s) => !s.chopsticks);
  const freeChop = chopsticks.find((c) => !c.seat);
  if (needChopSeat && freeChop) {
    fx.playIdleHandDemo(
      freeChop.group.position.clone().add(new THREE.Vector3(0, 0.25, 0)),
      needChopSeat.chopSpot.clone().add(new THREE.Vector3(0, 0.25, 0))
    );
  }
}

canvas.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointercancel', onPointerUp);

// ---------- Main Loop ----------
let lastTime = performance.now();
let elapsed = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  elapsed += dt;

  if (pourCooldown > 0) pourCooldown -= dt;
  if (shakeCooldown > 0) shakeCooldown -= dt;
  if (ladleServeCooldown > 0) ladleServeCooldown -= dt;

  // Idle timer (10s before single subtle demo, re-arm after 22s)
  if (activePointerId === null) {
    idleTime += dt;
    if (idleTime > 10.0 && !idleDemoDone) {
      triggerIdleDemoIfNeeded();
    } else if (idleTime > 24.0) {
      idleTime = 10.0;
      idleDemoDone = false;
    }
  }

  // Ambient steaming from open pot & hot served plates!
  steamTimer += dt;
  if (steamTimer > 0.42) {
    steamTimer = 0;
    if (pot.lidOpen) {
      fx.spawnSteam(pot.pos.clone().add(new THREE.Vector3(0, 0.48, 0)), 0.44);
    } else if (Math.random() < 0.45) {
      // Tiny wisp escaping vent hole on closed lid!
      fx.spawnSteam(pot.pos.clone().add(new THREE.Vector3(0.22, 0.72, 0.14)), 0.26);
    }
    for (const s of seats) {
      if (s.plate && s.plate.foodLevel > 0 && Math.random() < 0.45) {
        fx.spawnSteam(s.plateSpot.clone().add(new THREE.Vector3(0, 0.25, 0)), 0.3);
      }
    }
  }

  // Gourmet sparkles on seasoned dishes
  sparkleTimer += dt;
  if (sparkleTimer > 0.55) {
    sparkleTimer = 0;
    for (const s of seats) {
      if (s.plate && s.plate.foodLevel > 0 && s.plate.sprinkled) {
        fx.spawnSprite('star', s.plateSpot.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.45,
          0.25 + Math.random() * 0.25,
          (Math.random() - 0.5) * 0.45
        )), {
          scale: 0.2,
          vy: 0.35,
          life: 0.65,
          grow: 0.15,
        });
      }
    }
  }

  // Update overflow puddles (dry gently over time)
  for (const s of seats) {
    if (s.puddleLevel > 0) {
      s.puddleLevel = Math.max(0, s.puddleLevel - dt * 0.08);
      s.puddle.visible = s.puddleLevel > 0.02;
      const sc = 0.25 + s.puddleLevel * 1.15;
      s.puddle.scale.set(sc, sc, 1);
      if (s.cup && s.puddleLevel < 0.1) s.cup.showOverflowFoam(false);
    } else {
      s.puddle.visible = false;
    }
  }

  // Continuous pouring / sprinkling while finger is held steady over a cup or plate!
  if (dragKind === 'pitcher' && dragItem) {
    const cup = findNearestCup(dragLastWorld, 0.78);
    if (cup) {
      dragItem.group.position.set(cup.group.position.x + 0.4, 0.68, cup.group.position.z);
      pitcher.setPourStream(true, cup.group.position);
      if (pourCooldown <= 0) {
        pourCooldown = 0.055;
        const overflowing = cup.pour(0.1);
        sound.playPourTick(cup.fillLevel, overflowing);
        if (overflowing) {
          cup.showOverflowFoam(true);
          fx.spawnSplash(cup.group.position.clone().add(new THREE.Vector3(0, 0.36, 0)), 0xffbe42, 3);
          if (cup.seat) {
            cup.seat.puddleLevel = Math.min(1.0, cup.seat.puddleLevel + 0.14);
            const char = family[cup.seat.id];
            if (char.amazedTimer <= 0.1) char.reactHappy('amazed', 'droplet');
          }
        }
      }
    } else {
      pitcher.setPourStream(false);
    }
  } else if (dragKind === 'shaker' && dragItem) {
    const plate = findNearestPlacedPlate(dragLastWorld, 0.75);
    if (plate && plate.foodLevel > 0) {
      shaker.shaking = true;
      if (shakeCooldown <= 0) {
        shakeCooldown = 0.15;
        sound.playShakeSprinkle();
        fx.spawnSprinkle(plate.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
        if (!plate.sprinkled) {
          plate.addSprinkles();
          if (plate.seat) family[plate.seat.id].reactHappy('bliss', 'star');
        }
      }
    } else {
      shaker.shaking = false;
    }
  }

  // Update all world actors (ladle rests cleanly on ladle-dish when lid is closed, angled clear of cups!)
  ladle.homePos.copy(pot.lidOpen ? ladleOpenHome : ladleClosedHome);
  ladle.homeRotY = pot.lidOpen ? 0 : -1.25;
  pot.update(dt, elapsed);
  ladle.update(dt, elapsed);
  pitcher.update(dt, elapsed);
  shaker.update(dt, elapsed);
  bell.update(dt, elapsed);
  plates.forEach((p) => p.update(dt, elapsed));
  chopsticks.forEach((c) => c.update(dt));
  cups.forEach((c) => c.update(dt, elapsed));
  family.forEach((f) => f.update(dt, elapsed, activeLookTarget));
  fx.update(dt);

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

// Debug / verification handle (never visible in UI!)
window.__GAME_DEBUG__ = {
  getStats: () => ({
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
    dpr: renderer.getPixelRatio(),
    seats: seats.map((s) => ({
      role: s.role,
      plate: Boolean(s.plate),
      foodLevel: s.plate ? s.plate.foodLevel : 0,
      chopsticks: Boolean(s.chopsticks),
      cup: Boolean(s.cup),
      fillLevel: s.cup ? s.cup.fillLevel : 0,
      sprinkled: s.plate ? s.plate.sprinkled : false,
    })),
    lidOpen: pot.lidOpen,
    menuIndex: pot.menuIndex,
    feastCelebrated,
    bellUnlocked: bell.unlocked,
  }),
  setVirtualViewport: (w, h) => {
    renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    camera.aspect = aspect;
    if (aspect >= 1.15) {
      camera.fov = 39;
      const zoomAdjust = THREE.MathUtils.clamp(1.33 / aspect, 0.92, 1.12);
      camera.position.set(0, 4.12 * zoomAdjust, 6.42 * zoomAdjust);
      camera.lookAt(0, 0.48, 0.32);
    } else {
      camera.fov = 44;
      const pull = THREE.MathUtils.clamp(0.92 / aspect, 1.02, 1.94);
      camera.position.set(0, 4.25 * pull, 5.75 * pull);
      camera.lookAt(0, 0.48, 0.38);
    }
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  },
  projectWorld: (vec3) => {
    const v = vec3.clone().project(camera);
    const r = canvas.getBoundingClientRect();
    return {
      x: r.left + ((v.x + 1) / 2) * r.width,
      y: r.top + ((-v.y + 1) / 2) * r.height,
    };
  },
  getScreenTargets: () => ({
    plateStack: window.__GAME_DEBUG__.projectWorld(plateStackBase.clone().add(new THREE.Vector3(0, 0.22, 0))),
    seat0Plate: window.__GAME_DEBUG__.projectWorld(seats[0].plateSpot),
    seat1Plate: window.__GAME_DEBUG__.projectWorld(seats[1].plateSpot),
    seat2Plate: window.__GAME_DEBUG__.projectWorld(seats[2].plateSpot),
    chop0: window.__GAME_DEBUG__.projectWorld(chopHomes[0]),
    seat0Chop: window.__GAME_DEBUG__.projectWorld(seats[0].chopSpot),
    cup0: window.__GAME_DEBUG__.projectWorld(cupHomes[0].clone().add(new THREE.Vector3(0, 0.2, 0))),
    seat0Cup: window.__GAME_DEBUG__.projectWorld(seats[0].cupSpot),
    potLid: window.__GAME_DEBUG__.projectWorld(pot.pos.clone().add(new THREE.Vector3(0, 0.55, 0))),
    ladle: window.__GAME_DEBUG__.projectWorld(ladle.group.position.clone().add(new THREE.Vector3(0.24, 0.35, 0))),
    pitcher: window.__GAME_DEBUG__.projectWorld(pitcher.homePos.clone().add(new THREE.Vector3(0, 0.34, 0))),
    shaker: window.__GAME_DEBUG__.projectWorld(shaker.homePos.clone().add(new THREE.Vector3(0, 0.22, 0))),
  }),
  nextMenu: () => triggerNextMenuCycle(),
  demoServeState: () => {
    // Helper for automated screenshot verification of mid-game & feast states
    pot.setLidOpen(true);
    placePlateOnSeat(plates[0], seats[0]);
    placePlateOnSeat(plates[1], seats[1]);
    placePlateOnSeat(plates[2], seats[2]);
    seats[0].chopsticks = chopsticks[0];
    chopsticks[0].seat = seats[0];
    chopsticks[0].group.position.copy(seats[0].chopSpot);
    chopsticks[0].group.rotation.y = seats[0].matRotY;
    seats[1].chopsticks = chopsticks[1];
    chopsticks[1].seat = seats[1];
    chopsticks[1].group.position.copy(seats[1].chopSpot);
    seats[1].group.rotation.y = seats[1].matRotY;
    seats[2].chopsticks = chopsticks[2];
    chopsticks[2].seat = seats[2];
    chopsticks[2].group.position.copy(seats[2].chopSpot);
    chopsticks[2].group.rotation.y = seats[2].matRotY;

    seats[0].cup = cups[0];
    cups[0].seat = seats[0];
    cups[0].group.position.copy(seats[0].cupSpot);
    cups[0].pour(0.85);
    seats[1].cup = cups[1];
    cups[1].seat = seats[1];
    cups[1].group.position.copy(seats[1].cupSpot);
    cups[1].pour(0.95);
    seats[2].cup = cups[2];
    cups[2].seat = seats[2];
    cups[2].group.position.copy(seats[2].cupSpot);
    cups[2].pour(0.8);

    plates[0].addFood(0);
    plates[0].addSprinkles();
    plates[1].addFood(0);
    plates[1].addFood(0);
    plates[1].addSprinkles();
    plates[2].addFood(0);
    checkFeastCelebration();
  },
};
