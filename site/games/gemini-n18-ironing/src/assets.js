import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadAllAssets(renderer) {
  const texLoader = new THREE.TextureLoader();
  const hdrLoader = new HDRLoader();
  const gltfLoader = new GLTFLoader();
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

  function loadTex(url, isColor, repeatX = 1, repeatY = 1) {
    return new Promise((resolve, reject) => {
      texLoader.load(
        url,
        (tex) => {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(repeatX, repeatY);
          tex.anisotropy = maxAniso;
          tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          tex.needsUpdate = true;
          resolve(tex);
        },
        undefined,
        reject
      );
    });
  }

  async function loadPBR(name, rx = 1, ry = 1) {
    const base = `./assets/textures/${name}`;
    const [map, normalMap, armMap] = await Promise.all([
      loadTex(`${base}/diffuse.jpg`, true, rx, ry),
      loadTex(`${base}/nor_gl.jpg`, false, rx, ry),
      loadTex(`${base}/arm.jpg`, false, rx, ry),
    ]);
    return { map, normalMap, armMap };
  }

  async function loadMetalBrushed(rx = 2, ry = 2) {
    const base = `./assets/textures/metal_brushed`;
    const [map, normalMap, roughnessMap, metalnessMap] = await Promise.all([
      loadTex(`${base}/color.jpg`, true, rx, ry),
      loadTex(`${base}/normalgl.jpg`, false, rx, ry),
      loadTex(`${base}/roughness.jpg`, false, rx, ry),
      loadTex(`${base}/metalness.jpg`, false, rx, ry),
    ]);
    return { map, normalMap, roughnessMap, metalnessMap };
  }

  function loadHDR(url) {
    return new Promise((resolve, reject) => {
      hdrLoader.load(
        url,
        (tex) => {
          tex.mapping = THREE.EquirectangularReflectionMapping;
          resolve(tex);
        },
        undefined,
        reject
      );
    });
  }

  function loadGLTF(url) {
    return new Promise((resolve, reject) => {
      gltfLoader.load(
        url,
        (gltf) => {
          gltf.scene.traverse((obj) => {
            if (obj.isMesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              for (const m of mats) {
                if (!m) continue;
                if (m.map) m.map.anisotropy = maxAniso;
                if (m.normalMap) m.normalMap.anisotropy = maxAniso;
                if (m.roughnessMap) m.roughnessMap.anisotropy = maxAniso;
                m.envMapIntensity = 0.8;
              }
            }
          });
          resolve(gltf.scene);
        },
        undefined,
        reject
      );
    });
  }

  const [
    hdriWarm,
    roughLinen,
    stretchPoplin,
    ginghamCheck,
    floralJacquard,
    waffleCotton,
    woodFloor,
    whitePlaster,
    whiteOak,
    metalBrushed,
    wickerBasket,
    sideTable,
    pottedPlant,
    sofa,
  ] = await Promise.all([
    loadHDR('./assets/hdri/lebombo_1k.hdr'),
    loadPBR('rough_linen', 3.4, 1.5),
    loadPBR('stretch_poplin', 3.0, 3.0),
    loadPBR('gingham_check', 2.6, 2.6),
    loadPBR('floral_jacquard', 2.2, 2.2),
    loadPBR('waffle_pique_cotton', 3.0, 3.0),
    loadPBR('wood_floor', 4.0, 3.6),
    loadPBR('white_plaster_02', 3.0, 1.8),
    loadPBR('white_oak_veneer', 2.0, 2.0),
    loadMetalBrushed(2, 2),
    loadGLTF('./assets/models/wicker_basket_02/wicker_basket_02_1k.gltf'),
    loadGLTF('./assets/models/side_table_01/side_table_01_1k.gltf'),
    loadGLTF('./assets/models/potted_plant_04/potted_plant_04_1k.gltf'),
    loadGLTF('./assets/models/sofa_03/sofa_03_1k.gltf'),
  ]);

  // Create natural dyed variants from real photographed Poly Haven weaves (preserving 100% real thread slub!)
  const ecruLinenMap = createDyedFabricTexture(roughLinen.map, '#ece5d8', 3.6, 1.5, maxAniso);
  const rugLinenMap = createDyedFabricTexture(roughLinen.map, '#d4cab9', 3.4, 2.4, maxAniso);
  const sleeveLinenMap = createDyedFabricTexture(roughLinen.map, '#dfd6c6', 4.0, 4.0, maxAniso);
  const skyWhitePoplinMap = createDyedFabricTexture(stretchPoplin.map, '#e4edf5', 3.0, 3.0, maxAniso);
  const creamWaffleMap = createDyedFabricTexture(waffleCotton.map, '#ebe0cc', 3.0, 3.0, maxAniso);

  return {
    hdriWarm,
    textures: {
      roughLinen,
      ecruLinen: { map: ecruLinenMap, normalMap: roughLinen.normalMap, armMap: roughLinen.armMap },
      rugLinen: { map: rugLinenMap, normalMap: roughLinen.normalMap, armMap: roughLinen.armMap },
      sleeveLinen: { map: sleeveLinenMap, normalMap: roughLinen.normalMap, armMap: roughLinen.armMap },
      stretchPoplin: { map: skyWhitePoplinMap, normalMap: stretchPoplin.normalMap, armMap: stretchPoplin.armMap },
      ginghamCheck,
      floralJacquard,
      waffleCotton: { map: creamWaffleMap, normalMap: waffleCotton.normalMap, armMap: waffleCotton.armMap },
      woodFloor,
      whitePlaster,
      whiteOak,
      metalBrushed,
    },
    models: {
      wickerBasket,
      sideTable,
      pottedPlant,
      sofa,
    },
  };
}

/**
 * Re-dyes a real photographed fabric diffuse texture by normalizing its natural thread luminance
 * and applying an authentic dye hue, preserving every real woven fiber highlight & micro-shadow.
 */
export function createDyedFabricTexture(sourceTex, hexColor, rx = 1, ry = 1, anisotropy = 8) {
  const img = sourceTex.image;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, size, size);

  const idata = ctx.getImageData(0, 0, size, size);
  const d = idata.data;
  // Compute average luminance so the target hex matches the exact real-world brightness
  let sumL = 0;
  const pxCount = size * size;
  for (let i = 0; i < d.length; i += 4) {
    sumL += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
  }
  const avgL = Math.max(0.15, sumL / pxCount);
  const col = new THREE.Color(hexColor);
  const tr = col.r * 255;
  const tg = col.g * 255;
  const tb = col.b * 255;

  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    // Normalize thread micro-contrast cleanly around 1.0
    const rel = 1.0 + (lum / avgL - 1.0) * 1.15;
    d[i] = Math.max(0, Math.min(255, Math.round(tr * rel)));
    d[i + 1] = Math.max(0, Math.min(255, Math.round(tg * rel)));
    d[i + 2] = Math.max(0, Math.min(255, Math.round(tb * rel)));
  }
  ctx.putImageData(idata, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = anisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Soft radial contact shadow texture for grounding furniture and props.
 */
export function createContactShadowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.48);
  grad.addColorStop(0, 'rgba(26, 20, 15, 0.58)');
  grad.addColorStop(0.55, 'rgba(26, 20, 15, 0.24)');
  grad.addColorStop(1, 'rgba(26, 20, 15, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Ultra-soft feathered rounded-rectangle ambient occlusion shadow under laid-out garments.
 */
export function createSoftClothShadowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  ctx.filter = 'blur(18px)';
  ctx.fillStyle = 'rgba(38, 28, 20, 0.42)';
  ctx.beginPath();
  ctx.roundRect(38, 38, size - 76, size - 76, 16);
  ctx.fill();
  ctx.filter = 'none';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
