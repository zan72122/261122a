// Faithful 3D voxel-slice builders matching refs/ref_front_iso.jpg, refs/ref_back_iso.jpg, and refs/ref_props_turnaround.jpg
window.VoxelLib = (() => {
  const P = window.PAL;
  const CU = window.ColorUtil;

  class VoxelGrid {
    constructor(w, d, h) {
      this.w = w; // X axis (+wx = down-right at 45°)
      this.d = d; // Y axis (+wy = down-left at 45°)
      this.h = h; // Z axis (up)
      this.data = new Array(w * d * h).fill(null);
    }
    set(x, y, z, col) {
      x = Math.round(x);
      y = Math.round(y);
      z = Math.round(z);
      if (x < 0 || x >= this.w || y < 0 || y >= this.d || z < 0 || z >= this.h) return;
      this.data[z * this.w * this.d + y * this.w + x] = col;
    }
    get(x, y, z) {
      if (x < 0 || x >= this.w || y < 0 || y >= this.d || z < 0 || z >= this.h) return null;
      return this.data[z * this.w * this.d + y * this.w + x];
    }
    box(x0, y0, z0, x1, y1, z1, col) {
      const colFn = typeof col === 'function' ? col : () => col;
      for (let z = z0; z <= z1; z++) {
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const c = colFn(x, y, z);
            if (c !== undefined) this.set(x, y, z, c);
          }
        }
      }
    }
    cyl(cx, cy, r, z0, z1, col, innerR = -1) {
      const colFn = typeof col === 'function' ? col : () => col;
      const r2 = r * r;
      const ir2 = innerR >= 0 ? innerR * innerR : -1;
      for (let z = z0; z <= z1; z++) {
        for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
          for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
            const dx = x - cx;
            const dy = y - cy;
            const dist2 = dx * dx + dy * dy;
            if (dist2 <= r2 && dist2 > ir2) {
              const c = colFn(x, y, z, Math.sqrt(dist2));
              if (c !== undefined) this.set(x, y, z, c);
            }
          }
        }
      }
    }
    ellipsoid(cx, cy, cz, rx, ry, rz, col) {
      const colFn = typeof col === 'function' ? col : () => col;
      for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
          for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const nx = (x - cx) / rx;
            const ny = (y - cy) / ry;
            const nz = (z - cz) / rz;
            if (nx * nx + ny * ny + nz * nz <= 1.0) {
              const c = colFn(x, y, z, nx, ny, nz);
              if (c !== undefined) this.set(x, y, z, c);
            }
          }
        }
      }
    }

    // Bake into an array of tiny offscreen slice canvases (z = 0..h-1)
    bake(opts = {}) {
      const slices = [];
      const aoStrength = opts.ao !== undefined ? opts.ao : 0.14;
      const topBoost = opts.topBoost !== undefined ? opts.topBoost : 0.06;
      const skipShade = !!opts.skipShade;

      for (let z = 0; z < this.h; z++) {
        const cv = document.createElement('canvas');
        cv.width = this.w;
        cv.height = this.d;
        const c = cv.getContext('2d');
        let hasPixel = false;
        const heightFrac = this.h > 1 ? z / (this.h - 1) : 1;

        for (let y = 0; y < this.d; y++) {
          for (let x = 0; x < this.w; x++) {
            const raw = this.get(x, y, z);
            if (!raw) continue;
            hasPixel = true;
            let col = raw;
            if (!skipShade) {
              // Subtle vertical ambient occlusion + top highlight so stacked layers read as crisp 3D volume
              const above = this.get(x, y, z + 1);
              let factor = 1.0 - aoStrength * (1.0 - heightFrac);
              if (!above) factor += topBoost;
              // Slight side bevel darkening on bottom layer
              if (z === 0 && this.h > 3) factor *= 0.92;
              col = CU.shadeHex(raw, factor);
            }
            c.fillStyle = col;
            c.fillRect(x, y, 1, 1);
          }
        }
        slices.push(hasPixel ? cv : null);
      }
      return {
        w: this.w,
        d: this.d,
        h: this.h,
        cx: this.w / 2,
        cy: this.d / 2,
        slices,
      };
    }
  }

  // 1. Rounded-square walnut turntable base + checkered kitchen tiles & honey-oak dining planks
  function buildBase() {
    const W = 104, D = 104, H = 8;
    const g = new VoxelGrid(W, D, H);
    const half = W / 2;
    const cornerR = 14;
    const innerBound = half - cornerR;

    function insideRounded(x, y, inset) {
      const dx = Math.abs(x - (half - 0.5)) - (innerBound - inset);
      const dy = Math.abs(y - (half - 0.5)) - (innerBound - inset);
      const ox = Math.max(0, dx);
      const oy = Math.max(0, dy);
      return ox * ox + oy * oy <= cornerR * cornerR;
    }

    for (let z = 0; z < H; z++) {
      for (let y = 0; y < D; y++) {
        for (let x = 0; x < W; x++) {
          if (z <= 4) {
            // Thick walnut turntable rim (slightly beveled at z=0)
            const inset = z === 0 ? 1.2 : 0;
            if (!insideRounded(x, y, inset)) continue;
            let col = z === 0 ? P.walnutEdge : z <= 2 ? P.walnutDark : z === 3 ? P.walnutMid : P.walnutTop;
            if (z === 4 && !insideRounded(x, y, 1.5)) col = P.walnutMid;
            g.set(x, y, z, col);
          } else if (z === 5) {
            if (!insideRounded(x, y, 0.5)) continue;
            // Raised walnut outer lip around the floor inset
            if (!insideRounded(x, y, 3.6)) {
              g.set(x, y, z, P.walnutTop);
            } else {
              g.set(x, y, z, P.oakDark);
            }
          } else {
            // Floor surface (z=6..7) inset inside walnut rim
            if (!insideRounded(x, y, 3.8)) continue;
            const wx = x - half;
            const wy = y - half;
            // Kitchen checkered tile zone: front-left (wx < 22 && wy > -8)
            const isKitchen = wx < 22 && wy > -8;
            if (isKitchen) {
              const tx = Math.floor((x + 2) / 8);
              const ty = Math.floor((y + 2) / 8);
              const check = (tx + ty) % 2 === 0;
              const edge = ((x + 2) % 8 === 0) || ((y + 2) % 8 === 0);
              let col = check ? P.tileCream : P.tileButter;
              if (edge && z === 7) col = check ? P.tileCreamShade : P.tileButterShade;
              g.set(x, y, z, col);
            } else {
              // Honey-oak wood planks running along wx (matching ref_front_iso & ref_back_iso)
              const plank = Math.floor(y / 6);
              const seamY = y % 6 === 0;
              const jointX = (x + plank * 19) % 28 === 0;
              let col = plank % 3 === 0 ? P.oakLight : plank % 3 === 1 ? P.oakMid : P.oakDark;
              if ((seamY || jointX) && z === 7) col = P.oakSeam;
              // Border trim between kitchen tile and oak floor
              if ((wx === 22 && wy > -8) || (wy === -8 && wx < 22)) col = P.oakSeam;
              g.set(x, y, z, col);
            }
          }
        }
      }
    }
    return g.bake({ ao: 0.08, topBoost: 0.04 });
  }

  // 2. Cream Kitchen Counter (front cabinet doors on +x, 3-panel back on -x, butcher-block top)
  function buildCounter() {
    const W = 24, D = 50, H = 17;
    const g = new VoxelGrid(W, D, H);

    // 4 short wooden feet at corners (z = 0..1)
    g.box(2, 2, 0, 4, 4, 1, P.cabRecess);
    g.box(W - 5, 2, 0, W - 3, 4, 1, P.cabRecess);
    g.box(2, D - 5, 0, 4, D - 3, 1, P.cabRecess);
    g.box(W - 5, D - 5, 0, W - 3, D - 3, 1, P.cabRecess);

    // Main cream cabinet body (z = 1..13)
    g.box(2, 2, 1, W - 3, D - 3, 13, (x, y, z) => {
      // Front face (+x = W-3): cabinets + top drawer + handles (from ref_front_iso.jpg)
      if (x === W - 3) {
        if (z === 1 || z === 13 || y === 2 || y === D - 3) return P.cabMid;
        // Center divider between left & right cabinet sections
        if (y === 24 || y === 25) return P.cabRecess;
        // Left/front section (y = 26..46): top drawer (z=10..12) + double doors (z=3..8)
        if (y >= 27 && y <= 45) {
          if (z === 9) return P.cabRecess;
          if (z >= 10 && z <= 12) {
            if (y >= 34 && y <= 38 && z === 11) return P.cabKnob;
            if (y === 27 || y === 45 || z === 10 || z === 12) return P.cabRecess;
            return P.cabPanel;
          }
          if (z >= 3 && z <= 8) {
            if (y === 36) return P.cabRecess;
            if ((y === 34 || y === 38) && (z === 5 || z === 6)) return P.cabKnob;
            if (y === 28 || y === 35 || y === 37 || y === 44 || z === 3 || z === 8) return P.cabRecess;
            return P.cabPanel;
          }
        }
        // Back/right section (y = 4..22): tall double cabinet doors (z=3..11)
        if (y >= 4 && y <= 22) {
          if (z >= 3 && z <= 11) {
            if (y === 13) return P.cabRecess;
            if ((y === 11 || y === 15) && (z === 6 || z === 7)) return P.cabKnob;
            if (y === 5 || y === 12 || y === 14 || y === 21 || z === 3 || z === 11) return P.cabRecess;
            return P.cabPanel;
          }
        }
        return P.cabLight;
      }
      // Back face (-x = 2): 3 clean recessed cream panels (matching ref_back_iso.jpg!)
      if (x === 2) {
        if (z >= 3 && z <= 11) {
          if (y === 17 || y === 32) return P.cabRecess;
          const inP1 = y >= 5 && y <= 15;
          const inP2 = y >= 19 && y <= 30;
          const inP3 = y >= 34 && y <= 44;
          if (inP1 || inP2 || inP3) {
            const onEdge = z === 3 || z === 11 || y === 5 || y === 15 || y === 19 || y === 30 || y === 34 || y === 44;
            return onEdge ? P.cabRecess : P.cabPanel;
          }
        }
        return P.cabMid;
      }
      // Side faces (y=2 or y=D-3)
      if (y === 2 || y === D - 3) {
        if (z >= 3 && z <= 11 && x >= 5 && x <= W - 6) {
          const onEdge = z === 3 || z === 11 || x === 5 || x === W - 6;
          return onEdge ? P.cabRecess : P.cabPanel;
        }
        return P.cabMid;
      }
      return P.cabLight;
    });

    // Overhanging butcher-block wood countertop (z = 14..16)
    g.box(0, 0, 14, W - 1, D - 1, 16, (x, y, z) => {
      if (z === 14) return P.butcherDark;
      if (x === 0 || x === W - 1 || y === 0 || y === D - 1) return P.butcherDark;
      const stripe = Math.floor(x / 4) % 2 === 0;
      const grain = (x % 4 === 0) || ((y + x * 7) % 17 === 0);
      if (grain && z === 16) return P.butcherGrain;
      return stripe ? P.butcherLight : P.butcherTop;
    });

    return g.bake({ ao: 0.11, topBoost: 0.05 });
  }

  // 3. Wooden Cutting Board
  function buildCuttingBoard() {
    const W = 16, D = 24, H = 3;
    const g = new VoxelGrid(W, D, H);
    g.box(0, 0, 0, W - 1, D - 1, H - 1, (x, y, z) => {
      // Slightly rounded corners
      if ((x === 0 || x === W - 1) && (y === 0 || y === D - 1)) return undefined;
      if (z === 0) return P.boardSide;
      if (x === 0 || x === W - 1 || y === 0 || y === D - 1) return P.boardSide;
      if (x === 1 || y === 1) return P.boardLight;
      return (x % 4 === 0) ? P.boardLight : P.boardTop;
    });
    return g.bake({ ao: 0.08, topBoost: 0.04 });
  }

  // 4. Whole & Chopped Vegetables + Knife (matched to ref_props_turnaround.jpg)
  function buildCarrotWhole() {
    const W = 12, D = 14, H = 5;
    const g = new VoxelGrid(W, D, H);
    // Tapered diagonal-ish carrot body along y (from leafy top at y=2 to pointed tip at y=12)
    for (let y = 3; y <= 12; y++) {
      const t = (y - 3) / 9; // 0 at thick base, 1 at tip
      const r = 2.4 * (1 - t * 0.72);
      const cx = 5.5;
      const cz = 2.0;
      for (let z = 0; z < H; z++) {
        for (let x = 0; x < W; x++) {
          const dx = (x - cx) / Math.max(0.7, r);
          const dz = (z - cz) / Math.max(0.7, r * 0.85);
          if (dx * dx + dz * dz <= 1.0) {
            let col = P.carrotMain;
            if (y % 3 === 0 && z >= 2) col = P.carrotDark;
            else if (z >= 3) col = P.carrotLight;
            g.set(x, y, z, col);
          }
        }
      }
    }
    // Leafy green carrot top (y = 0..2)
    g.box(4, 1, 1, 7, 2, 3, P.carrotLeaf);
    g.set(3, 0, 2, P.carrotLeafLight);
    g.set(5, 0, 3, P.carrotLeafLight);
    g.set(7, 0, 2, P.carrotLeafLight);
    g.set(6, 1, 4, P.carrotLeafLight);
    return g.bake({ ao: 0.1 });
  }

  function buildCarrotChopped() {
    const W = 11, D = 11, H = 4;
    const g = new VoxelGrid(W, D, H);
    // 4 cute orange carrot coins/chunks scattered neatly
    const chunks = [[2.5, 3, 1.8], [7.2, 2.8, 1.7], [3.5, 7.5, 1.8], [7.5, 7.2, 1.6]];
    chunks.forEach(([cx, cy, r], idx) => {
      g.cyl(cx, cy, r, 0, idx % 2 === 0 ? 2 : 1, (x, y, z, dist) => {
        if (z >= 1 && dist < r * 0.55) return P.carrotLight;
        return dist > r * 0.82 ? P.carrotDark : P.carrotMain;
      });
    });
    return g.bake({ ao: 0.08 });
  }

  function buildPotatoWhole() {
    const W = 10, D = 10, H = 5;
    const g = new VoxelGrid(W, D, H);
    g.ellipsoid(4.5, 4.5, 2.0, 3.6, 3.0, 2.1, (x, y, z) => {
      if ((x === 3 && y === 3 && z === 3) || (x === 6 && y === 5 && z === 3)) return P.potatoDark;
      return z >= 3 ? P.potatoLight : z === 0 ? P.potatoDark : P.potatoMain;
    });
    return g.bake({ ao: 0.1 });
  }

  function buildPotatoChopped() {
    const W = 11, D = 11, H = 4;
    const g = new VoxelGrid(W, D, H);
    // 4 chunky golden-yellow potato cubes with pale cream cut faces
    const boxes = [
      [1, 1, 0, 4, 4, 2],
      [6, 2, 0, 9, 4, 2],
      [2, 6, 0, 5, 9, 2],
      [6, 6, 0, 9, 9, 1],
    ];
    boxes.forEach(([x0, y0, z0, x1, y1, z1]) => {
      g.box(x0, y0, z0, x1, y1, z1, (x, y, z) => {
        if (z === z1) return P.potatoInside;
        if (x === x0 || y === y0) return P.potatoDark;
        return P.potatoMain;
      });
    });
    return g.bake({ ao: 0.08 });
  }

  function buildOnionWhole() {
    const W = 10, D = 10, H = 7;
    const g = new VoxelGrid(W, D, H);
    g.ellipsoid(4.5, 4.5, 2.4, 3.3, 3.3, 2.5, (x, y, z) => {
      const stripe = (x + y) % 2 === 0;
      if (z === 0) return P.onionDark;
      return stripe ? P.onionLight : P.onionMain;
    });
    // Cute pointy onion stem tuft on top (z=5..6)
    g.box(4, 4, 5, 5, 5, 5, P.onionMain);
    g.set(4, 4, 6, P.onionDark);
    return g.bake({ ao: 0.1 });
  }

  function buildOnionChopped() {
    const W = 11, D = 11, H = 4;
    const g = new VoxelGrid(W, D, H);
    // Creamy ivory onion wedges
    const pieces = [
      [1, 2, 0, 4, 4, 2],
      [6, 1, 0, 8, 4, 2],
      [2, 6, 0, 5, 8, 2],
      [6, 6, 0, 9, 8, 1],
    ];
    pieces.forEach(([x0, y0, z0, x1, y1, z1]) => {
      g.box(x0, y0, z0, x1, y1, z1, (x, y, z) => {
        if (z === z1) return P.onionInside;
        return (x === x0) ? P.onionMain : P.onionLight;
      });
    });
    return g.bake({ ao: 0.07 });
  }

  function buildBroccoliWhole() {
    const W = 11, D = 11, H = 7;
    const g = new VoxelGrid(W, D, H);
    // Pale green stalk
    g.cyl(5, 5, 1.7, 0, 2, P.brocStem);
    // 3 bumpy dark/mid/light green floret domes
    g.ellipsoid(3.5, 4.2, 4.0, 2.5, 2.5, 2.2, (x, y, z) => z >= 5 ? P.brocLight : (x + y + z) % 2 ? P.brocMid : P.brocDark);
    g.ellipsoid(6.8, 4.2, 4.2, 2.4, 2.4, 2.2, (x, y, z) => z >= 5 ? P.brocLight : (x + y + z) % 2 ? P.brocMid : P.brocDark);
    g.ellipsoid(5.0, 6.8, 4.0, 2.5, 2.3, 2.1, (x, y, z) => z >= 5 ? P.brocLight : (x + y + z) % 2 ? P.brocMid : P.brocDark);
    return g.bake({ ao: 0.1 });
  }

  function buildBroccoliChopped() {
    const W = 11, D = 11, H = 4;
    const g = new VoxelGrid(W, D, H);
    const florets = [[2.8, 3.0], [7.5, 3.2], [3.2, 7.5], [7.4, 7.4]];
    florets.forEach(([cx, cy]) => {
      g.cyl(cx, cy, 1.0, 0, 1, P.brocStem);
      g.ellipsoid(cx, cy, 2.3, 1.7, 1.7, 1.4, (x, y, z) => z >= 3 ? P.brocLight : (x + y) % 2 ? P.brocMid : P.brocDark);
    });
    return g.bake({ ao: 0.08 });
  }

  function buildKnife() {
    const W = 14, D = 6, H = 3;
    const g = new VoxelGrid(W, D, H);
    // Wooden handle (x = 0..4)
    g.box(0, 2, 0, 4, 3, 2, (x, y, z) => z === 2 ? P.knifeHandle : P.knifeHandleDark);
    // Shiny steel blade (x = 5..12)
    g.box(5, 1, 1, 11, 4, 1, (x, y) => {
      if (y === 1) return P.knifeShine;
      if (y === 4) return P.knifeEdge;
      return P.knifeBlade;
    });
    g.box(12, 1, 1, 12, 3, 1, P.knifeShine);
    g.box(5, 2, 2, 10, 2, 2, P.knifeShine);
    return g.bake({ ao: 0.06 });
  }

  // 5. Gas Stove (Front oven/doors + red knob on +y; rear vent panel on -y; cast-iron grate on top)
  function buildStove(knobState = 1) {
    const W = 24, D = 24, H = 18;
    const g = new VoxelGrid(W, D, H);

    // 4 dark corner feet (z = 0..1)
    g.box(1, 1, 0, 3, 3, 1, P.stoveFoot);
    g.box(W - 4, 1, 0, W - 2, 3, 1, P.stoveFoot);
    g.box(1, D - 4, 0, 3, D - 2, 1, P.stoveFoot);
    g.box(W - 4, D - 4, 0, W - 2, D - 2, 1, P.stoveFoot);

    // Cream enamel stove body (z = 1..14)
    g.box(1, 1, 1, W - 2, D - 2, 14, (x, y, z) => {
      // Top surface (z = 14)
      if (z === 14) {
        if (x === 1 || x === W - 2 || y === 1 || y === D - 2) return P.stoveShade;
        // Dark burner center circle
        const dx = x - 11.5, dy = y - 11.5;
        if (dx * dx + dy * dy <= 24) return P.stoveGrate;
        return P.stoveTop;
      }
      // Front face (+y = D-2): grill window, lower twin doors, red dial knob on right (+x)
      if (y === D - 2) {
        // Upper control band (z = 8..12)
        if (z >= 8 && z <= 12) {
          // Dark oven/grill window on left (x = 3..13)
          if (x >= 3 && x <= 13) {
            if (x === 3 || x === 13 || z === 8 || z === 12) return P.stoveOvenFrame;
            if (z === 11 && x >= 5 && x <= 11) return P.stoveOvenGlassHi;
            return P.stoveOvenGlass;
          }
          // Cream knob housing on right (x = 15..20)
          if (x === 15 && z === 12) return P.stoveShade;
          return P.stoveTop;
        }
        // Lower twin doors (z = 2..7)
        if (z >= 2 && z <= 7) {
          if (x === 11 || x === 12) return P.stoveShade;
          if ((x === 9 || x === 14) && (z === 5 || z === 6)) return P.cabKnob;
          if (x === 2 || x === W - 3 || z === 2 || z === 7) return P.stoveShade;
          return P.stoveDoor;
        }
        return P.stoveSide;
      }
      // Back face (-y = 1): horizontal vent slits near top (from ref_props_turnaround.jpg!)
      if (y === 1) {
        if (z === 12 && x >= 4 && x <= W - 5 && x % 3 !== 0) return P.stoveVent;
        if (z === 11 && x >= 4 && x <= W - 5 && x % 3 !== 0) return P.stoveShade;
        return P.stoveSide;
      }
      // Left & right side panels
      if (x === 1 || x === W - 2) {
        if (z === 13) return P.stoveTop;
        if (z <= 2) return P.stoveShade;
        return P.stoveSide;
      }
      return P.stoveSide;
    });

    // Protruding Cherry-Red Stove Knob on front-right (+y = D-1, x = 15..20, z = 7..12)
    g.box(15, D - 2, 7, 20, D - 2, 12, (x, y, z) => {
      if ((x === 15 || x === 20) && (z === 7 || z === 12)) return P.stoveTop;
      return P.stoveShade;
    });
    g.box(16, D - 1, 8, 19, D - 1, 11, (x, y, z) => {
      if (z === 11) return P.stoveKnobHi;
      if (z === 8) return P.stoveKnobDark;
      return P.stoveKnob;
    });
    // White dial indicator mark shifts by heat level (0=top, 1=right, 2=down)
    if (knobState === 0) g.set(17, D - 1, 11, '#FFF8EA');
    else if (knobState === 1) g.set(19, D - 1, 10, '#FFF8EA');
    else g.set(18, D - 1, 8, '#FFF8EA');

    // Cast-iron square burner trivet/grate on top (z = 15..17)
    g.box(4, 4, 15, 19, 19, 16, (x, y, z) => {
      const onRim = x === 4 || x === 19 || y === 4 || y === 19;
      const onCross = (Math.abs(x - 11.5) <= 1.2 || Math.abs(y - 11.5) <= 1.2) &&
        ((x - 11.5) * (x - 11.5) + (y - 11.5) * (y - 11.5) >= 12);
      if (onRim || onCross) return z === 16 ? P.stoveGrateHi : P.stoveGrate;
      return undefined;
    });
    // 4 raised pot support prongs (z = 17)
    g.box(5, 11, 17, 7, 12, 17, P.stoveGrateHi);
    g.box(16, 11, 17, 18, 12, 17, P.stoveGrateHi);
    g.box(11, 5, 17, 12, 7, 17, P.stoveGrateHi);
    g.box(11, 16, 17, 12, 18, 17, P.stoveGrateHi);

    return g.bake({ ao: 0.1, topBoost: 0.05 });
  }

  // 6. Cherry-Red Enamel Curry Pot (wider chunky Dutch oven matching ref_front_iso.jpg, hollow interior!)
  function buildCurryPot() {
    const W = 28, D = 28, H = 11;
    const g = new VoxelGrid(W, D, H);
    const cx = 13.5, cy = 13.5;

    // Solid rounded pot bottom (z = 0..2)
    g.cyl(cx, cy, 9.4, 0, 0, P.potDeep);
    g.cyl(cx, cy, 10.2, 1, 2, (x, y, z, dist) => {
      if (dist < 8.1 && z === 2) return P.potInner;
      return x < cx ? P.potRed : P.potDark;
    });

    // Hollow chunky cherry-red enameled walls (z = 3..9) — thick 2.2-voxel wall for zero pixel gaps!
    g.cyl(cx, cy, 10.4, 3, 9, (x, y, z, dist) => {
      if (dist < 8.6) return P.potInner;
      if (x < cx - 3 && y > cy - 2 && z >= 4 && z <= 8) return P.potLight;
      if (x > cx + 4 && y < cy + 2) return P.potDark;
      return P.potRed;
    }, 8.1);

    // Metallic light enamel rim lip (z = 10)
    g.cyl(cx, cy, 10.6, 10, 10, (x, y, z, dist) => dist > 9.3 ? P.potRim : P.potLight, 8.2);

    // Two chunky curved cherry-red side loop handles along ±x (z = 7..9)
    for (const side of [-1, 1]) {
      for (let z = 7; z <= 9; z++) {
        for (let dy = -3; dy <= 3; dy++) {
          const hx = Math.round(cx + side * (Math.abs(dy) <= 1 ? 12.6 : 11.4));
          const hy = Math.round(cy + dy);
          if (Math.abs(dy) <= 1 && z === 8) continue; // cute handle loop hole!
          g.set(hx, hy, z, z === 9 ? P.potLight : z === 7 ? P.potDeep : P.potRed);
          if (Math.abs(dy) === 2) {
            g.set(Math.round(cx + side * 10.8), hy, z, P.potDark);
          }
        }
      }
    }
    return g.bake({ ao: 0.09, topBoost: 0.04 });
  }

  // 7. Wooden Ladle (angled ladle for stirring & scooping!)
  function buildLadle() {
    const W = 16, D = 10, H = 12;
    const g = new VoxelGrid(W, D, H);
    // Small rounded wooden ladle bowl at bottom-left (x=3..6, y=3..6, z=0..2)
    g.cyl(4.5, 4.5, 2.3, 0, 2, (x, y, z, dist) => (z === 2 && dist < 1.3) ? P.ladleDark : P.ladleWood);
    // Slanted wooden handle rising up-right (x=6..14, z=2..11)
    for (let i = 0; i <= 9; i++) {
      const x = 5 + i;
      const z = 2 + i;
      g.box(x, 4, z, x + 1, 5, z, z >= 9 ? P.ladleLight : P.ladleWood);
    }
    return g.bake({ ao: 0.08 });
  }

  // 8. White Japanese Rice Cooker (body + removable hinged lid, matching ref_props_turnaround.jpg & ref_back_iso.jpg)
  function buildRiceCookerBody() {
    const W = 16, D = 16, H = 10;
    const g = new VoxelGrid(W, D, H);
    const cx = 7.5, cy = 7.5;

    // 4 tiny dark rubber feet (z = 0)
    g.box(4, 4, 0, 5, 5, 0, P.cookerCord);
    g.box(10, 4, 0, 11, 5, 0, P.cookerCord);
    g.box(4, 10, 0, 5, 11, 0, P.cookerCord);
    g.box(10, 10, 0, 11, 11, 0, P.cookerCord);

    // Rounded off-white body (z = 1..8)
    g.cyl(cx, cy, 6.2, 1, 8, (x, y, z, dist) => {
      if (z >= 4 && dist < 4.8) return undefined; // hollow inner bowl
      // Front control panel (+x side facing kitchen)
      if (x >= 12 && y >= 6 && y <= 9 && z >= 3 && z <= 6) {
        if (z === 4 || z === 5) return P.cookerScreen;
        return P.cookerPanel;
      }
      // Rear cord socket (-x side, matching ref_back_iso.jpg!)
      if (x <= 2 && y >= 6 && y <= 9 && z >= 2 && z <= 4) {
        return P.cookerCord;
      }
      return z <= 2 ? P.cookerShade : P.cookerWhite;
    });
    // Dark inner rice bowl rim (z = 8..9)
    g.cyl(cx, cy, 5.4, 8, 9, P.cookerInner, 4.3);
    // Fluffy snowy white rice mound inside the open cooker! (z = 4..9)
    g.ellipsoid(cx, cy, 6.6, 4.3, 4.3, 2.5, (x, y, z) => (x + y + z) % 3 === 0 ? P.riceShade : P.riceWhite);

    // Little side handles along ±y (z = 6..7)
    g.box(6, 0, 6, 9, 1, 7, P.cookerShade);
    g.box(6, 14, 6, 9, 15, 7, P.cookerShade);

    return g.bake({ ao: 0.08, topBoost: 0.04 });
  }

  function buildRiceCookerLid() {
    const W = 16, D = 16, H = 5;
    const g = new VoxelGrid(W, D, H);
    const cx = 7.5, cy = 7.5;
    g.cyl(cx, cy, 6.1, 0, 1, P.cookerShade);
    g.cyl(cx, cy, 5.6, 2, 2, P.cookerWhite);
    g.cyl(cx, cy, 4.6, 3, 3, (x, y) => {
      // Steam vent + latch button
      if (x >= 9 && x <= 10 && y >= 7 && y <= 8) return P.cookerPanel;
      if (x >= 4 && x <= 5 && y >= 7 && y <= 8) return P.cookerDark;
      return P.cookerWhite;
    });
    // Rear lid hinge (-x)
    g.box(1, 6, 0, 2, 9, 2, P.cookerDark);
    return g.bake({ ao: 0.07 });
  }

  // 9. Curry Roux Silver Tray & Individual Scored Roux Cube (2x2 bar!)
  function buildRouxTray() {
    const W = 13, D = 15, H = 2;
    const g = new VoxelGrid(W, D, H);
    g.box(0, 0, 0, W - 1, D - 1, 0, P.trayDark);
    g.box(0, 0, 1, W - 1, D - 1, 1, (x, y) => {
      if (x === 0 || x === W - 1 || y === 0 || y === D - 1) return P.trayLight;
      return P.trayMid;
    });
    return g.bake({ ao: 0.05 });
  }

  function buildRouxCube() {
    const W = 6, D = 6, H = 3;
    const g = new VoxelGrid(W, D, H);
    g.box(0, 0, 0, 5, 5, 0, P.rouxDark);
    g.box(0, 0, 1, 5, 5, 1, P.rouxMid);
    g.box(1, 1, 2, 4, 4, 2, (x, y) => (x === 1 || y === 1) ? P.rouxLight : P.rouxTop);
    return g.bake({ ao: 0.06 });
  }

  // 10. Cute Compact Red Fukujinzuke Pickle Jar (clearly packed with vibrant crimson pickles!)
  function buildPickleJar() {
    const W = 7, D = 7, H = 6;
    const g = new VoxelGrid(W, D, H);
    const cx = 3.0, cy = 3.0;
    g.cyl(cx, cy, 2.7, 0, 3, (x, y, z, dist) => {
      if (z === 0) return P.jarGlass;
      // Show bright crimson pickles right through the clear glass with a crisp white glass glint!
      if (x === 1 && y === 4 && z >= 1 && z <= 3) return P.jarGlassHi;
      if (dist > 2.2 && z === 3) return P.jarGlass;
      return (x + y + z) % 2 === 0 ? P.pickleRed : P.pickleDark;
    });
    g.cyl(cx, cy, 2.8, 4, 5, (x, y, z) => z === 5 ? P.potLight : P.jarLid);
    return g.bake({ ao: 0.08 });
  }

  // 11. Honey-Oak Dining Table (generous depth D=24 so serving plate & 3 placemats never crowd!)
  function buildDiningTable() {
    const W = 50, D = 24, H = 14;
    const g = new VoxelGrid(W, D, H);
    // 4 square legs (z = 0..10)
    const legCoords = [[2, 2], [W - 5, 2], [2, D - 5], [W - 5, D - 5]];
    legCoords.forEach(([lx, ly]) => {
      g.box(lx, ly, 0, lx + 2, ly + 2, 10, (x, y, z) => (x === lx || y === ly) ? P.tableDark : P.chairWood);
    });
    // Apron beams under tabletop (z = 9..10)
    g.box(3, 3, 9, W - 4, D - 4, 10, (x, y) => {
      if (x > 4 && x < W - 5 && y > 4 && y < D - 5) return undefined;
      return P.tableDark;
    });
    // Honey-oak planked tabletop (z = 11..13)
    g.box(0, 0, 11, W - 1, D - 1, 13, (x, y, z) => {
      if (z === 11) return P.tableDark;
      if (x === 0 || x === W - 1 || y === 0 || y === D - 1) return P.tableDark;
      const seam = y % 6 === 0;
      if (seam && z === 13) return P.oakSeam;
      return (Math.floor(y / 6) % 2 === 0) ? P.tableLight : P.tableTop;
    });
    return g.bake({ ao: 0.1, topBoost: 0.05 });
  }

  // 12. Wooden Slatted Chairs (split cleanly into Seat + Backrest so characters sit INSIDE smoothly at 360°!)
  function buildChairSeat() {
    const W = 12, D = 12, H = 8;
    const g = new VoxelGrid(W, D, H);
    // 4 legs (z = 0..5)
    [[1, 1], [9, 1], [1, 9], [9, 9]].forEach(([lx, ly]) => {
      g.box(lx, ly, 0, lx + 1, ly + 1, 5, P.chairDark);
    });
    // Side stretchers
    g.box(1, 2, 2, 2, 9, 2, P.chairDark);
    g.box(9, 2, 2, 10, 9, 2, P.chairDark);
    // Wooden seat (z = 6..7)
    g.box(0, 0, 6, W - 1, D - 1, 7, (x, y, z) => (z === 6 || x === 0 || x === W - 1 || y === 0 || y === D - 1) ? P.chairDark : P.chairLight);
    return g.bake({ ao: 0.1 });
  }

  function buildChairBack() {
    const W = 12, D = 3, H = 18;
    const g = new VoxelGrid(W, D, H);
    // Left & right vertical backrest posts (z = 0..17)
    g.box(0, 0, 0, 1, 2, 17, P.chairWood);
    g.box(10, 0, 0, 11, 2, 17, P.chairWood);
    // Top rail (z = 15..16) & mid rail (z = 8..9)
    g.box(1, 0, 15, 10, 2, 16, P.chairLight);
    g.box(1, 0, 8, 10, 2, 9, P.chairDark);
    // 3 vertical backrest slats (from ref_props_turnaround.jpg!)
    g.box(3, 1, 9, 3, 1, 15, P.chairWood);
    g.box(6, 1, 9, 6, 1, 15, P.chairWood);
    g.box(8, 1, 9, 8, 1, 15, P.chairWood);
    return g.bake({ ao: 0.1 });
  }

  // 13. Adorable Seated Family Members (Mama, Papa, Little Girl — expressive faces & crisp 2-voxel eyes!)
  // Faces +y (toward table & stove); Back is -y (visible at 180° rotation!)
  function buildPerson(who, happy = false) {
    const isGirl = who === 'girl';
    const W = 18, D = 16, H = isGirl ? 24 : 28;
    const g = new VoxelGrid(W, D, H);
    const cx = 8.5;

    const hair = who === 'mama' ? P.mamaHair : who === 'papa' ? P.papaHair : P.girlHair;
    const hairHi = who === 'mama' ? P.mamaHairHi : who === 'papa' ? P.papaHairHi : P.girlHairHi;
    const hairDark = who === 'mama' ? P.mamaHairDark : who === 'papa' ? P.papaHairDark : P.girlHairDark;
    const topCol = who === 'mama' ? P.mamaTop : who === 'papa' ? P.papaCardi : P.girlDress;
    const topHi = who === 'mama' ? P.mamaTopHi : who === 'papa' ? P.papaCardiHi : P.girlDressHi;
    const topDark = who === 'mama' ? P.mamaTopDark : who === 'papa' ? P.papaCardiDark : P.girlDressDark;
    const pantsCol = who === 'mama' ? P.mamaPants : who === 'papa' ? P.papaPants : P.girlDress;

    const torsoZ0 = isGirl ? 7 : 8;
    const torsoZ1 = isGirl ? 13 : 15;
    const headZ0 = torsoZ1 + 1;
    const headZ1 = H - 2;

    // Seated legs/lap (z = 2..torsoZ0)
    g.box(5, 6, 2, 7, 10, torsoZ0, pantsCol);
    g.box(10, 6, 2, 12, 10, torsoZ0, pantsCol);
    g.box(5, 9, 1, 7, 11, 2, isGirl ? P.girlDressDark : P.mamaHairDark);
    g.box(10, 9, 1, 12, 11, 2, isGirl ? P.girlDressDark : P.mamaHairDark);

    // Torso (sweater / cardigan / dress)
    const tx0 = isGirl ? 5 : 4;
    const tx1 = isGirl ? 12 : 13;
    g.box(tx0, 5, torsoZ0, tx1, 10, torsoZ1, (x, y, z) => {
      if (who === 'papa' && y === 10 && x >= 7 && x <= 10 && z >= torsoZ1 - 2) {
        if (z === torsoZ1 - 2 && (x === 7 || x === 10)) return topCol;
        return P.papaShirt;
      }
      if (isGirl && y === 10 && z === torsoZ1 && x >= 6 && x <= 11) {
        return P.girlCollar;
      }
      if (z === torsoZ1) return topHi;
      if (y === 5) return topDark;
      return topCol;
    });

    // Arms! Raised cheerfully OUT TO THE SIDES when happy (never blocking their adorable faces!)
    if (happy) {
      g.box(tx0 - 2, 6, torsoZ0 + 3, tx0 - 1, 8, torsoZ1 + 1, topCol);
      g.box(tx1 + 1, 6, torsoZ0 + 3, tx1 + 2, 8, torsoZ1 + 1, topCol);
      g.box(tx0 - 3, 6, torsoZ1 + 1, tx0 - 2, 8, torsoZ1 + 2, P.skinLight);
      g.box(tx1 + 2, 6, torsoZ1 + 1, tx1 + 3, 8, torsoZ1 + 2, P.skinLight);
    } else {
      g.box(tx0 - 1, 8, torsoZ0 + 1, tx0, 12, torsoZ0 + 3, topCol);
      g.box(tx1, 8, torsoZ0 + 1, tx1 + 1, 12, torsoZ0 + 3, topCol);
      g.box(tx0 - 1, 12, torsoZ0 + 1, tx0, 13, torsoZ0 + 2, P.skinLight);
      g.box(tx1, 12, torsoZ0 + 1, tx1 + 1, 13, torsoZ0 + 2, P.skinLight);
    }

    // Neck
    g.box(7, 6, torsoZ1, 10, 9, headZ0, P.skinMid);

    // Big adorable chunky pixel head matching ref_front_iso.jpg!
    const hRx = isGirl ? 4.4 : 4.8;
    const hRy = 4.3;
    const hCz = (headZ0 + headZ1) * 0.5;
    const hRz = (headZ1 - headZ0) * 0.54;
    const eyeZ = Math.round(hCz - 0.5);

    g.ellipsoid(cx, 7.6, hCz, hRx, hRy, hRz, (x, y, z) => {
      const isTop = z >= headZ1 - 2;
      const isBack = y <= 6;
      const isSideHair = (x <= cx - hRx + 1.2 || x >= cx + hRx - 1.2) && y <= 9;
      const isBangs = y >= 9 && z >= headZ1 - 2;

      if (isTop || isBack || isSideHair || isBangs) {
        if (who === 'mama' && isBangs && x === 8 && z === headZ1 - 2) return P.skinLight;
        return z >= headZ1 - 1 ? hairHi : y <= 5 ? hairDark : hair;
      }

      // Crisp 2-voxel-deep front facial features (y >= 10) so eyes & glasses stay 100% readable while rotating!
      if (y >= 10) {
        // 2-tall crisp dark pixel eyes!
        if ((z === eyeZ || z === eyeZ + 1) && (x === 6 || x === 11)) return P.eye;
        // Papa's sleek pixel glasses (clean top brow bar + bridge + temples, keeping lower face bright!)
        if (who === 'papa') {
          if (z === eyeZ + 2 && ((x >= 5 && x <= 7) || (x >= 10 && x <= 12))) return P.papaHairDark;
          if (z === eyeZ + 1 && (x === 5 || x === 8 || x === 9 || x === 12)) return P.papaHairDark;
        }
        // Bright rosy cheeks!
        if (z === eyeZ - 1 && (x === 5 || x === 12)) return P.cheek;
        // Cute smile (bright happy grin when eating/cheering!)
        if (z === eyeZ - 2 && (x === 8 || x === 9)) return happy ? P.girlRibbon : P.mamaHair;
      }
      return z >= hCz ? P.skinLight : P.skinMid;
    });

    // Signature Hair Silhouettes (readable from ALL 360°!)
    if (who === 'mama') {
      // Smooth chestnut bob flaring down around sides & back!
      g.box(3, 3, headZ0 - 1, 14, 7, headZ0 + 4, (x, y, z) => {
        if (x >= 6 && x <= 11 && y >= 6) return undefined;
        return y === 3 ? hairDark : z === headZ0 + 4 ? hairHi : hair;
      });
    } else if (who === 'girl') {
      // Two adorable side pigtails + cherry-red hair ribbons (visible front, side & back!)
      for (const side of [-1, 1]) {
        const rx = Math.round(cx + side * 5.0);
        g.box(rx - (side < 0 ? 1 : 0), 6, headZ0 + 3, rx + (side > 0 ? 1 : 0), 8, headZ0 + 4, P.girlRibbon);
        g.set(rx, 7, headZ0 + 5, P.girlRibbonHi);
        const px = Math.round(cx + side * 6.5);
        g.box(px - 1, 6, headZ0 + 1, px + 1, 8, headZ0 + 4, (x, y, z) => z >= headZ0 + 4 ? hairHi : hair);
      }
    }

    return g.bake({ ao: 0.08, topBoost: 0.04 });
  }

  // 14. Placemat, Silver Spoon, Oval Plate (empty rice-half, or filled curry!)
  function buildPlacemat() {
    const W = 16, D = 12, H = 1;
    const g = new VoxelGrid(W, D, H);
    g.box(0, 0, 0, W - 1, D - 1, 0, (x, y) => {
      if (x === 0 || x === W - 1 || y === 0 || y === D - 1) return P.matDark;
      return (x + y) % 2 === 0 ? P.matLight : P.matDark;
    });
    return g.bake({ skipShade: true });
  }

  function buildSpoon() {
    const W = 4, D = 10, H = 1;
    const g = new VoxelGrid(W, D, H);
    // Oval bowl at -y, handle toward +y
    g.box(1, 0, 0, 2, 3, 0, P.spoonLight);
    g.box(1, 4, 0, 2, 9, 0, P.spoonDark);
    g.set(1, 1, 0, '#FFFFFF');
    return g.bake({ skipShade: true });
  }

  // Build an oval white curry plate with configurable rice amount, curry fill, curry richness, veggies, and pickles!
  function buildPlateModel(opts = {}) {
    const W = 14, D = 11, H = 4;
    const g = new VoxelGrid(W, D, H);
    const cx = 6.5, cy = 5.0;
    const rx = 6.3, ry = 4.9;
    const eatFrac = opts.eatFrac || 0; // 0 = full, 1 = sparkling clean empty plate!
    const hasRice = opts.hasRice !== false && eatFrac < 0.92;
    const hasCurry = (opts.curryScoops || 0) > 0 && eatFrac < 0.85;
    const richness = opts.richness !== undefined ? opts.richness : 3;
    const veggieList = opts.veggies || [];
    const hasPickles = !!opts.hasPickles && eatFrac < 0.7;

    // White oval ceramic plate (z = 0..1)
    for (let y = 0; y < D; y++) {
      for (let x = 0; x < W; x++) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const d2 = nx * nx + ny * ny;
        if (d2 <= 0.72) g.set(x, y, 0, P.plateRim);
        if (d2 <= 1.0) {
          g.set(x, y, 1, d2 > 0.75 ? P.plateWhite : P.plateShade);
        }
      }
    }

    // Fluffy white snowy rice mound on left half (x = 2..6)
    if (hasRice) {
      const riceScale = 1 - eatFrac * 0.72;
      g.ellipsoid(4.2, 5.0, 2.0, 2.7 * riceScale, 3.0 * riceScale, 1.6 * riceScale, (x, y, z) => {
        if (z < 1) return undefined;
        return (x + y + z) % 3 === 0 ? P.riceShade : P.riceWhite;
      });
    }

    // Glossy thick curry puddle on right half (x = 6..11)
    if (hasCurry) {
      const cols = CU.curryColors(richness, 1);
      const scale = Math.min(1.08, (0.86 + (opts.curryScoops - 1) * 0.14)) * (1 - eatFrac * 0.78);
      g.ellipsoid(8.7, 5.0, 1.5, 3.4 * scale, 3.3 * scale, 1.25 * scale, (x, y, z) => {
        if (z < 1) return undefined;
        if (z >= 2 && x === 8 && y === 4) return cols.hi;
        return (x + y) % 4 === 0 ? cols.dark : cols.main;
      });

      // Chunky colorful veggies peeking out of the curry (matching what she actually cooked!)
      const spots = [
        { type: 'carrot', x: 8, y: 3, col: P.carrotMain },
        { type: 'broccoli', x: 10, y: 5, col: P.brocMid },
        { type: 'potato', x: 8, y: 7, col: P.potatoLight },
        { type: 'onion', x: 10, y: 3, col: P.onionLight },
      ];
      if (eatFrac < 0.55) {
        spots.forEach((s) => {
          if (veggieList.includes(s.type) || veggieList.length === 0) {
            g.set(s.x, s.y, 2, s.col);
            g.set(s.x + 1, s.y, 2, s.col);
          }
        });
      }
    }

    // Crimson fukujinzuke pickles tucked neatly on the rim edge!
    if (hasPickles) {
      g.set(2, 6, 2, P.pickleRed);
      g.set(3, 7, 2, P.pickleRed);
      g.set(2, 7, 2, P.pickleDark);
    }

    return g.bake({ ao: 0.06, topBoost: 0.03 });
  }

  // Build and cache all static models once at startup!
  function buildAll() {
    return {
      base: buildBase(),
      counter: buildCounter(),
      board: buildCuttingBoard(),
      veggie_carrot_whole: buildCarrotWhole(),
      veggie_carrot_chopped: buildCarrotChopped(),
      veggie_potato_whole: buildPotatoWhole(),
      veggie_potato_chopped: buildPotatoChopped(),
      veggie_onion_whole: buildOnionWhole(),
      veggie_onion_chopped: buildOnionChopped(),
      veggie_broccoli_whole: buildBroccoliWhole(),
      veggie_broccoli_chopped: buildBroccoliChopped(),
      knife: buildKnife(),
      stove_0: buildStove(0),
      stove_1: buildStove(1),
      stove_2: buildStove(2),
      pot: buildCurryPot(),
      ladle: buildLadle(),
      cookerBody: buildRiceCookerBody(),
      cookerLid: buildRiceCookerLid(),
      rouxTray: buildRouxTray(),
      rouxCube: buildRouxCube(),
      pickleJar: buildPickleJar(),
      table: buildDiningTable(),
      chairSeat: buildChairSeat(),
      chairBack: buildChairBack(),
      mama: buildPerson('mama', false),
      mamaHappy: buildPerson('mama', true),
      papa: buildPerson('papa', false),
      papaHappy: buildPerson('papa', true),
      girl: buildPerson('girl', false),
      girlHappy: buildPerson('girl', true),
      placemat: buildPlacemat(),
      spoon: buildSpoon(),
      plateRiceOnly: buildPlateModel({ hasRice: true, curryScoops: 0 }),
      plateEmpty: buildPlateModel({ hasRice: false, curryScoops: 0, eatFrac: 1 }),
      buildPlateModel,
    };
  }

  return { buildAll, buildPlateModel };
})();
