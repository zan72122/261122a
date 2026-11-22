import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GlassSurface } from './glass/glassSurface.js';
import { buildWindowRoom } from './scene/windowRoom.js';
import { buildProps } from './scene/props.js';
import { FirstPersonHand, SprayParticles } from './scene/firstPersonHand.js';
import { SoundEngine } from './audio/soundEngine.js';
import { InteractionController } from './interaction/controller.js';

const container = document.getElementById('app');

// --- WebGL2 Photorealistic Renderer ---
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: false,
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// Keep transmission sharp while respecting mobile GPU budget
renderer.transmissionResolutionScale = 1.0;

// Dynamic pixel ratio capped at 1.5 per mobile budget
let currentPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(currentPixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9bc4e6);

// --- Dual-Orientation Natural First-Person Camera (390x844 portrait & 1024x768 landscape) ---
const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.05, 65);
const camBasePos = new THREE.Vector3();
const camLookAt = new THREE.Vector3();

function updateCameraFraming() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / Math.max(1, h);
  camera.aspect = aspect;

  if (aspect < 0.85) {
    // iPhone portrait (390x844): shows full tall window, top frame, warm oak sill & BOTH hero tools with room to spare!
    camera.fov = 52;
    camBasePos.set(0.0, 1.05, 1.98);
    camLookAt.set(0.0, 0.99, 0.0);
  } else {
    // iPad landscape / desktop (1024x768): real DSLR living-room framing showing plaster wall, linen curtains, top sash, sill & all props!
    camera.fov = 44;
    camBasePos.set(0.0, 1.06, 1.78);
    camLookAt.set(0.0, 1.04, 0.0);
  }
  camera.position.copy(camBasePos);
  camera.lookAt(camLookAt);
  camera.updateProjectionMatrix();
}
updateCameraFraming();

// --- Real Indoor HDRI Environment Lighting (Poly Haven CC0) ---
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();

const hdrLoader = new HDRLoader();
hdrLoader.load('./assets/hdri/small_empty_room_1_1k.hdr', (hdrTex) => {
  hdrTex.mapping = THREE.EquirectangularReflectionMapping;
  const envRT = pmrem.fromEquirectangular(hdrTex);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.72;
  hdrTex.dispose();
  pmrem.dispose();
});

// --- Physically Motivated Single Shadow-Casting Morning Sunlight ---
const sunLight = new THREE.DirectionalLight(0xfff0d6, 2.75);
// Angling gently down from upper-right garden through the window onto the oak sill & plaster wall
sunLight.position.set(1.85, 2.65, -2.0);
sunLight.target.position.set(0, 0.72, 0.22);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 7.5;
sunLight.shadow.camera.left = -1.4;
sunLight.shadow.camera.right = 1.4;
sunLight.shadow.camera.top = 1.5;
sunLight.shadow.camera.bottom = -0.9;
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.015;
scene.add(sunLight, sunLight.target);

// Subtle ambient sky-bounce fill inside room (preserves crisp photographic shadow depth!)
const hemiLight = new THREE.HemisphereLight(0xd9e8f8, 0x7c6248, 0.36);
scene.add(hemiLight);

// --- Build Real-Scale Room, Dynamic Optical Window Glass, Interactive Props, Hand & Foley ---
const texLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());

const room = buildWindowRoom(scene, { texLoader, gltfLoader, anisotropy: maxAniso });

const glass = new GlassSurface(room.PANE_W, room.PANE_H);
glass.mesh.position.set(0, room.PANE_CY, 0.008);
scene.add(glass.mesh);

const props = buildProps(scene, room, { gltfLoader, texLoader });
const hand = new FirstPersonHand(scene, room.materials.curtainMat);
const particles = new SprayParticles(scene);
const sound = new SoundEngine();

const controller = new InteractionController({
  domElement: renderer.domElement,
  camera,
  room,
  glass,
  props,
  hand,
  particles,
  sound,
});

// --- Resize Handler ---
window.addEventListener('resize', () => {
  currentPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(currentPixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateCameraFraming();
});

// --- Dynamic Performance Monitoring & Main Render Loop ---
let prevTime = performance.now();
let elapsed = 0;
let fpsFrames = 0;
let fpsAccum = 0;
let currentFps = 60;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) * 0.001));
  prevTime = now;
  elapsed += dt;

  // Adaptive pixel ratio protection for mobile >=30fps guarantee
  fpsFrames++;
  fpsAccum += dt;
  if (fpsAccum >= 1.0) {
    currentFps = fpsFrames / fpsAccum;
    fpsFrames = 0;
    fpsAccum = 0;
    if (currentFps < 28 && currentPixelRatio > 1.0) {
      currentPixelRatio = Math.max(1.0, currentPixelRatio - 0.15);
      renderer.setPixelRatio(currentPixelRatio);
    }
  }

  // Update glass physics, props, controller, hand, spray mist & live Foley
  controller.update(dt, elapsed);
  glass.update(dt, elapsed);
  props.update(dt, elapsed);
  particles.update(dt);
  room.update(dt, elapsed, glass.cleanRatio, props.state.prismAngle);
  sound.update(dt, glass.cleanRatio);

  // Dynamic sunlight warmth & brightness boost as fog/dirt vanish from the glass!
  const targetSunIntensity = 2.05 + glass.cleanRatio * 1.15;
  sunLight.intensity += (targetSunIntensity - sunLight.intensity) * Math.min(1, dt * 3.0);

  // Subtle natural human breathing micro-sway on first-person camera (never dizzying)
  const breathY = Math.sin(elapsed * 1.1) * 0.0035;
  const breathX = Math.cos(elapsed * 0.72) * 0.0025;
  camera.position.set(camBasePos.x + breathX, camBasePos.y + breathY, camBasePos.z);
  camera.lookAt(camLookAt);

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

// Expose compact inspection & screenshot test hook (zero UI impact)
window.__WINDOW_APP__ = {
  getStats() {
    return {
      fps: Math.round(currentFps),
      pixelRatio: currentPixelRatio,
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls,
      textures: renderer.info.memory.textures,
      geometries: renderer.info.memory.geometries,
      cleanRatio: Number(glass.cleanRatio.toFixed(3)),
      foamCoverage: Number(glass.foamCoverage.toFixed(3)),
      activeTool: controller.activeTool,
      drips: glass.drips.length,
    };
  },
  setToneMapping(mode) {
    renderer.toneMapping = mode === 'aces' ? THREE.ACESFilmicToneMapping : THREE.AgXToneMapping;
  },
  setExposure(val) {
    renderer.toneMappingExposure = val;
  },
  demo(type, opts) {
    controller.runDemoAction(type, opts);
  },
  capturePng() {
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  },
};
