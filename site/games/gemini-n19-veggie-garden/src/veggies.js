import * as THREE from '../lib/three.module.js';
import { VoxelBuilder } from './voxel.js';

/**
 * Reusable 3D Voxel Building-Block Vegetable Builders:
 * - Whole veggies (with attachable dirt specks for washing!)
 * - Cutaway/sliced veggies (for chopping on the board & tossing in the salad bowl!)
 */

function addDirtSpecks(group, positions, mats) {
  const dirtGroup = new THREE.Group();
  const vb = new VoxelBuilder(0.08);
  const browns = [0x6e4427, 0x57341c, 0x855532, 0x613b20];
  positions.forEach(([x, y, z, s], idx) => {
    vb.addBox(x, y, z, s, s, s, browns[idx % browns.length], 0);
  });
  const mesh = vb.buildMesh(mats.matte, false, false);
  dirtGroup.add(mesh);
  group.add(dirtGroup);
  group.userData.dirtGroup = dirtGroup;
  return dirtGroup;
}

export function createWholeTomato(mats, { golden = false, withDirt = true } = {}) {
  const group = new THREE.Group();
  const mainColor = golden ? 0xffc928 : 0xeb3136;
  const hiColor = golden ? 0xfff08a : 0xff6b6b;
  const darkColor = golden ? 0xe09f10 : 0xc92027;

  const vb = new VoxelBuilder(0.11);
  // Chunky stepped voxel cherry tomato (3x3x3 core + side caps)
  vb.addBox(0, 0, 0, 0.36, 0.34, 0.36, mainColor, 0.12);
  vb.addBox(0, 0, 0, 0.42, 0.24, 0.26, mainColor, 0.12);
  vb.addBox(0, 0, 0, 0.26, 0.24, 0.42, mainColor, 0.12);
  vb.addBox(0, -0.02, 0, 0.24, 0.38, 0.24, darkColor, 0.12);
  // Crisp voxel specular highlight block
  vb.addBox(-0.1, 0.09, 0.14, 0.09, 0.09, 0.08, hiColor, 0);
  const body = vb.buildMesh(mats.gloss);
  group.add(body);

  // Cute star-shaped green voxel calyx + tiny stem
  const cv = new VoxelBuilder(0.08);
  cv.addBox(0, 0.20, 0, 0.24, 0.06, 0.08, 0x3ba832, 0);
  cv.addBox(0, 0.20, 0, 0.08, 0.06, 0.24, 0x3ba832, 0);
  cv.addBox(0, 0.26, 0, 0.06, 0.10, 0.06, 0x2c8225, 0);
  group.add(cv.buildMesh(mats.matte));

  if (withDirt) {
    addDirtSpecks(group, [
      [0.16, -0.06, 0.13, 0.075],
      [-0.17, -0.04, 0.10, 0.065],
      [0.05, -0.14, 0.16, 0.07],
      [-0.08, 0.05, -0.18, 0.065],
    ], mats);
  }

  group.userData.veggieType = golden ? 'goldTomato' : 'tomato';
  return group;
}

export function createWholeCucumber(mats, { star = false, withDirt = true } = {}) {
  const group = new THREE.Group();
  const baseGreen = star ? 0x1eb858 : 0x1e8438;
  const darkGreen = star ? 0x137a3a : 0x145e27;
  const bumpGreen = star ? 0x7ef7a6 : 0x62db6a;

  const vb = new VoxelBuilder(0.14);
  // Chunky slightly curved vertical voxel cucumber (centered at 0)
  vb.addBox(0, 0.28, 0.01, 0.28, 0.28, 0.28, darkGreen, 0.14);
  vb.addBox(0, 0.0, 0.03, 0.34, 0.36, 0.34, baseGreen, 0.14);
  vb.addBox(0, -0.28, 0.01, 0.30, 0.30, 0.30, baseGreen, 0.14);
  vb.addBox(0, -0.46, -0.01, 0.22, 0.14, 0.22, darkGreen, 0.12);
  // Cute yellow tiny blossom tip at bottom of fresh garden cucumber!
  vb.addBox(0, -0.56, 0, 0.12, 0.09, 0.12, 0xffe042, 0);
  // Crisp voxel bumps / ridges along cucumber skin
  vb.addBox(0.18, 0.12, 0.08, 0.07, 0.09, 0.07, bumpGreen, 0);
  vb.addBox(-0.18, -0.05, 0.10, 0.07, 0.09, 0.07, bumpGreen, 0);
  vb.addBox(0.16, -0.26, -0.05, 0.07, 0.09, 0.07, bumpGreen, 0);
  vb.addBox(-0.16, 0.22, -0.04, 0.07, 0.09, 0.07, bumpGreen, 0);
  vb.addBox(0.02, -0.14, 0.19, 0.08, 0.08, 0.07, bumpGreen, 0);
  // Stem nub at top
  vb.addBox(0, 0.48, 0.0, 0.09, 0.14, 0.09, 0x8ce043, 0);

  group.add(vb.buildMesh(mats.gloss));

  if (withDirt) {
    addDirtSpecks(group, [
      [0.14, -0.18, 0.14, 0.08],
      [-0.15, 0.06, 0.15, 0.075],
      [0.06, -0.36, 0.13, 0.08],
      [-0.12, -0.28, -0.12, 0.075],
      [0.12, 0.18, -0.11, 0.07],
    ], mats);
  }

  group.userData.veggieType = star ? 'starCucumber' : 'cucumber';
  return group;
}

export function createWholeCarrot(mats, { rainbow = false, withDirt = true } = {}) {
  const group = new THREE.Group();
  const c1 = rainbow ? 0xff5ca8 : 0xff7b1c;
  const c2 = rainbow ? 0xffa62b : 0xff8c2b;
  const c3 = rainbow ? 0xffd23f : 0xf26419;
  const c4 = rainbow ? 0x8e5cff : 0xe55310;

  const vb = new VoxelBuilder(0.12);
  // Tapered chunky voxel carrot body (top at y = +0.28, tip at y = -0.52)
  vb.addBox(0, 0.18, 0, 0.34, 0.22, 0.34, c1, 0.12);
  vb.addBox(0, -0.02, 0, 0.28, 0.22, 0.28, c2, 0.12);
  vb.addBox(0, -0.22, 0, 0.22, 0.20, 0.22, c3, 0.12);
  vb.addBox(0, -0.38, 0, 0.15, 0.16, 0.15, c4, 0.10);
  vb.addBox(0, -0.50, 0, 0.09, 0.10, 0.09, c4, 0);
  // Subtle darker horizontal carrot rings
  vb.addBox(0, 0.10, 0.175, 0.16, 0.035, 0.02, 0xd6530f, 0);
  vb.addBox(0, -0.10, 0.145, 0.13, 0.035, 0.02, 0xd6530f, 0);
  group.add(vb.buildMesh(mats.matte));

  // Lush feathery voxel green leaves sprouting from top!
  const lv = new VoxelBuilder(0.09);
  lv.addBox(0, 0.38, 0, 0.10, 0.22, 0.10, 0x35a832, 0);
  lv.addBox(-0.14, 0.52, 0.06, 0.14, 0.26, 0.10, 0x4bc942, 0.09);
  lv.addBox(0.14, 0.54, -0.05, 0.14, 0.28, 0.10, 0x3eb838, 0.09);
  lv.addBox(0.02, 0.58, 0.12, 0.12, 0.24, 0.10, 0x62db4f, 0.09);
  lv.addBox(-0.06, 0.56, -0.13, 0.12, 0.22, 0.10, 0x2f992c, 0.09);
  group.add(lv.buildMesh(mats.matte));

  if (withDirt) {
    addDirtSpecks(group, [
      [0.15, 0.08, 0.15, 0.09],
      [-0.16, -0.04, 0.12, 0.085],
      [0.10, -0.22, 0.12, 0.085],
      [-0.10, -0.32, -0.09, 0.08],
      [0.12, 0.02, -0.14, 0.08],
      [-0.04, -0.14, 0.15, 0.075],
    ], mats);
  }

  group.userData.veggieType = rainbow ? 'rainbowCarrot' : 'carrot';
  return group;
}

/**
 * Create a single sliced voxel piece for the cutting board & salad bowl!
 */
export function createVeggieSlice(type, mats) {
  const vb = new VoxelBuilder(0.09);
  if (type === 'tomato' || type === 'goldTomato') {
    const outer = type === 'goldTomato' ? 0xffc928 : 0xeb3136;
    const pulp = type === 'goldTomato' ? 0xffe97d : 0xff6b6b;
    const seed = 0xfff3a8;
    // Halved cherry tomato showing juicy voxel interior!
    vb.addBox(0, -0.04, 0, 0.34, 0.14, 0.34, outer, 0.11);
    vb.addBox(0, -0.12, 0, 0.24, 0.06, 0.24, outer, 0.11);
    vb.addBox(0, 0.04, 0, 0.28, 0.05, 0.28, pulp, 0);
    vb.addBox(-0.07, 0.065, 0.05, 0.06, 0.03, 0.06, seed, 0);
    vb.addBox(0.07, 0.065, -0.05, 0.06, 0.03, 0.06, seed, 0);
    vb.addBox(0.05, 0.065, 0.07, 0.05, 0.03, 0.05, seed, 0);
    return vb.buildMesh(mats.gloss);
  }

  if (type === 'cucumber' || type === 'starCucumber') {
    const rind = type === 'starCucumber' ? 0x2ec468 : 0x2a943d;
    const flesh = 0xcaf7bd;
    const core = 0xf2ffe6;
    // Crisp voxel cucumber coin slice
    vb.addBox(0, 0, 0, 0.34, 0.10, 0.24, rind, 0.10);
    vb.addBox(0, 0, 0, 0.24, 0.10, 0.34, rind, 0.10);
    vb.addBox(0, 0.005, 0, 0.24, 0.11, 0.24, flesh, 0);
    vb.addBox(0, 0.01, 0, 0.11, 0.115, 0.11, core, 0);
    return vb.buildMesh(mats.gloss);
  }

  if (type === 'carrot' || type === 'rainbowCarrot') {
    const outer = type === 'rainbowCarrot' ? 0xff6b9d : 0xff7b1c;
    const inner = type === 'rainbowCarrot' ? 0xffd23f : 0xffb347;
    // Cute voxel flower-cut carrot coin!
    vb.addBox(0, 0, 0, 0.32, 0.10, 0.20, outer, 0.10);
    vb.addBox(0, 0, 0, 0.20, 0.10, 0.32, outer, 0.10);
    vb.addBox(0, 0.005, 0, 0.16, 0.11, 0.16, inner, 0);
    return vb.buildMesh(mats.matte);
  }

  // Crunchy golden crouton cube!
  vb.addBox(0, 0, 0, 0.20, 0.20, 0.20, 0xebb963, 0);
  vb.addBox(0, 0.09, 0, 0.21, 0.04, 0.21, 0xc78836, 0);
  return vb.buildMesh(mats.matte);
}
