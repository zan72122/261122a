import * as THREE from '../lib/three.module.js';
import { createMaterials } from './voxel.js';
import { SoundEngine } from './audio.js';
import { VoxelParticles } from './particles.js';
import { BalconyScene } from './balcony.js';
import { KitchenScene } from './kitchen.js';

/**
 * Main entry point:
 * - Strict performance caps for iPhone/iPad 30fps+:
 *   pixelRatio <= 1.5, textures <= 1024px, shadowMap 1024px, low triangle count
 * - Single-finger touch/drag/tap (tracks primary pointerId, multi-touch safe)
 * - Responsive camera framing for both iPhone portrait and iPad landscape
 * - Seamless continuous 3D camera glide between Sunny Balcony <-> Sunlit Kitchen
 */
const canvas = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x96d9f9);
scene.fog = new THREE.Fog(0xa8e0fa, 24, 52);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.2, 85);

// Warm sunlit daylight lighting
const hemiLight = new THREE.HemisphereLight(0xeef8ff, 0xffe2ba, 0.92);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xfff5dc, 1.55);
sunLight.position.set(8.5, 15.5, 9.5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
sunLight.shadow.camera.near = 2;
sunLight.shadow.camera.far = 42;
sunLight.shadow.camera.left = -10;
sunLight.shadow.camera.right = 10;
sunLight.shadow.camera.top = 10;
sunLight.shadow.camera.bottom = -16;
sunLight.shadow.bias = -0.0008;
scene.add(sunLight);

// Soft warm kitchen interior fill light
const kitchenLight = new THREE.PointLight(0xfff4d8, 1.15, 18, 1.2);
kitchenLight.position.set(0.5, 5.2, -10.5);
scene.add(kitchenLight);

const mats = createMaterials();
const sound = new SoundEngine();
const particles = new VoxelParticles(scene, mats.blockTex);

// Scene mode: 'balcony' | 'kitchen' | 'serving'
let mode = 'balcony';

const camPos = new THREE.Vector3(0, 6.9, 10.2);
const camLook = new THREE.Vector3(0, 1.55, 0.2);
const camTargetPos = camPos.clone();
const camTargetLook = camLook.clone();

function updateCameraTargets() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const portrait = aspect < 1.0;

  if (mode === 'balcony') {
    if (portrait) {
      // Pull back neatly so all 3 planters + basket + watering can fit cleanly with generous side margins
      const pull = THREE.MathUtils.clamp(1.0 / aspect, 1.05, 2.15);
      camTargetPos.set(0, 6.2 + (pull - 1) * 1.1, 11.8 + (pull - 1) * 5.2);
      camTargetLook.set(0, 1.35, 0.35);
      camera.fov = 50;
    } else {
      camTargetPos.set(0, 6.25, 10.9);
      camTargetLook.set(0, 1.65, 0.1);
      camera.fov = 41;
    }
  } else if (mode === 'kitchen') {
    if (portrait) {
      const pull = THREE.MathUtils.clamp(1.0 / aspect, 1.05, 2.15);
      camTargetPos.set(0.15, 6.4 + (pull - 1) * 1.9, -3.5 + (pull - 1) * 4.4);
      camTargetLook.set(0.15, 1.45, -12.0);
      camera.fov = 50;
    } else {
      camTargetPos.set(-0.05, 5.85, -3.95);
      camTargetLook.set(-0.05, 1.62, -12.0);
      camera.fov = 41;
    }
  } else if (mode === 'serving') {
    if (portrait) {
      camTargetPos.set(2.95, 4.3, -7.85);
      camTargetLook.set(3.05, 1.42, -11.72);
      camera.fov = 44;
    } else {
      camTargetPos.set(2.95, 3.85, -8.25);
      camTargetLook.set(3.05, 1.48, -11.72);
      camera.fov = 38;
    }
  }
  camera.updateProjectionMatrix();
}

const kitchen = new KitchenScene(scene, mats, particles, sound, {
  onServingModeChanged: (isServing) => {
    mode = isServing ? 'serving' : 'kitchen';
    updateCameraTargets();
  },
  onReturnToBalcony: () => {
    mode = 'balcony';
    balcony.resetForNewRound();
    updateCameraTargets();
  },
});

const balcony = new BalconyScene(scene, mats, particles, sound, {
  onEnterKitchen: (harvestedTypes) => {
    mode = 'kitchen';
    kitchen.loadHarvest(harvestedTypes);
    updateCameraTargets();
  },
});

// Initialize camera right at balcony view on frame 1
updateCameraTargets();
camPos.copy(camTargetPos);
camLook.copy(camTargetLook);
camera.position.copy(camPos);
camera.lookAt(camLook);

// Resize handling
window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  updateCameraTargets();
});

// Single-finger Pointer Input (multi-touch safe!)
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let activePointerId = null;

function setRayFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sound.unlock();
  if (activePointerId !== null) return; // Ignore second finger so multi-touch never breaks state
  activePointerId = e.pointerId;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (_) {}

  setRayFromEvent(e);
  if (mode === 'balcony') {
    const hits = raycaster.intersectObjects(balcony.getHitTargets(), false);
    const hitObj = hits.length > 0 ? hits[0].object : null;
    balcony.onPointerDown(hitObj, null, raycaster);
  } else {
    const hits = raycaster.intersectObjects(kitchen.getHitTargets(), false);
    const hitObj = hits.length > 0 ? hits[0].object : null;
    kitchen.onPointerDown(hitObj, raycaster);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointerId) return;
  e.preventDefault();
  setRayFromEvent(e);
  if (mode === 'balcony') {
    balcony.onPointerMove(raycaster);
  } else {
    kitchen.onPointerMove(raycaster);
  }
});

function handlePointerEnd(e) {
  if (e.pointerId !== activePointerId) return;
  e.preventDefault();
  activePointerId = null;
  if (mode === 'balcony') {
    balcony.onPointerUp();
  } else {
    kitchen.onPointerUp();
  }
}

canvas.addEventListener('pointerup', handlePointerEnd);
canvas.addEventListener('pointercancel', handlePointerEnd);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Expose lightweight debug hook (used purely for automated verification & screenshot testing)
window.__GARDEN_DEBUG__ = {
  getStats: () => ({
    mode,
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
    pixelRatio: renderer.getPixelRatio(),
    harvestedCount: balcony.harvestedItems.length,
    sinkCount: kitchen.sinkVeggies.filter((v) => v.inSink).length,
    saladCount: kitchen.saladPieces.length,
  }),
  growAll: () => {
    balcony.planters.forEach((p) => {
      p.wetness = 1;
      p.growth = 1;
      p.stageReached = 3;
      p.soilMat.color.setHex(0x573722);
      p.veggies.forEach((v) => {
        if (!v.isBonus) v.ripe = true;
      });
    });
  },
  enterKitchenDemo: () => {
    mode = 'kitchen';
    kitchen.loadHarvest(['tomato', 'tomato', 'cucumber', 'carrot', 'carrot', 'goldTomato']);
    updateCameraTargets();
    camPos.copy(camTargetPos);
    camLook.copy(camTargetLook);
  },
  saladReadyDemo: () => {
    mode = 'kitchen';
    kitchen.loadHarvest(['tomato', 'cucumber', 'carrot', 'carrot']);
    kitchen.faucetOn = true;
    kitchen.waterLevel = 0.88;
    kitchen.sinkVeggies.forEach((v) => {
      v.cleanProgress = 1;
      v.isClean = true;
      if (v.mesh.userData.dirtGroup) v.mesh.userData.dirtGroup.visible = false;
    });
    // Put one clean carrot on the cutting board so chopping station is clearly showcased too!
    if (kitchen.sinkVeggies[3]) {
      kitchen._sendCleanVeggieToBoardOrBowl(kitchen.sinkVeggies[3]);
    }
    ['tomato', 'tomato', 'goldTomato', 'cucumber', 'cucumber', 'cucumber', 'carrot', 'carrot', 'carrot', 'crouton', 'crouton', 'crouton'].forEach((t) => {
      kitchen._spawnSingleSliceToBowl(t, new THREE.Vector3(3.3, 1.8, 0.2));
    });
    updateCameraTargets();
    camPos.copy(camTargetPos);
    camLook.copy(camTargetLook);
  },
  servingDemo: () => {
    window.__GARDEN_DEBUG__.saladReadyDemo();
    setTimeout(() => {
      kitchen._enterServingFinale();
    }, 650);
  },
};

// Main loop
let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const elapsed = now * 0.001;

  // Smooth camera glide
  const lerpK = Math.min(1, dt * 4.8);
  camPos.lerp(camTargetPos, lerpK);
  camLook.lerp(camTargetLook, lerpK);
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  balcony.facadeGroup.visible = camPos.z > -2.4 && mode === 'balcony';
  balcony.update(dt, elapsed, mode === 'balcony');
  kitchen.update(dt, elapsed, mode !== 'balcony');
  particles.update(dt);

  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
