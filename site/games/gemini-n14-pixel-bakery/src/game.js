// Pixel Bakery — Wordless Sprite-Stacking Tactile Game for Young Kids
// Knead -> Shape -> Top -> Bake & Puff -> Shelf -> Customers Buy -> Upgrade Shop!
// Drag empty space / base to spin the entire 3D bakery 360 degrees.

(function () {
  const SHAPES = ["melon", "croissant", "heart", "cinnamon", "baguette"];

  // 9 display shelf slots (3 tiers x 3 columns, matching build_slices.py shelf geometry)
  const SHELF_SLOTS = [
    // Middle tier first (most prominent & inviting!)
    { x: -17, y: -27, z: 28 },
    { x: -8,  y: -27, z: 28 },
    { x: 1,   y: -27, z: 28 },
    // Top tier
    { x: -17, y: -27, z: 38 },
    { x: -8,  y: -27, z: 38 },
    { x: 1,   y: -27, z: 38 },
    // Bottom tier
    { x: -17, y: -27, z: 18 },
    { x: -8,  y: -27, z: 18 },
    { x: 1,   y: -27, z: 18 },
  ];

  // Key 3D world anchor points (synced to build_slices.py voxel coordinates)
  const POS = {
    board:      { x: 7,    y: 10,  z: 22 },
    flourBowl:  { x: -4,   y: 11,  z: 25 },
    dishBerry:  { x: -1,   y: 19,  z: 24 },
    dishChoco:  { x: 6,    y: 19,  z: 24 },
    dishButter: { x: 13,   y: 19,  z: 24 },
    ovenFire:   { x: -28,  y: -4,  z: 21 },
    ovenInside: { x: -23,  y: -4,  z: 22 },
    ovenReady:  { x: -17,  y: -4,  z: 22 },
    chimneyTop: { x: -36,  y: -4,  z: 67 },
    coinTray:   { x: 32,   y: -6,  z: 23 },
    register:   { x: 32,   y: -14, z: 26 },
    trash:      { x: 28.5, y: 7.5, z: 15 },
    rearFlower: { x: 20,   y: -41, z: 23 },
    rearSacks:  { x: 18,   y: -46, z: 14 },
    rearDoor:   { x: -14,  y: -40, z: 17 },
  };

  const CUSTOMER_KINDS = ["girl", "boy", "grandma"];
  const CUSTOMER_SPOTS = [0.68, 1.06, 1.44]; // angles (rad) along front cobblestone arc

  let nextBreadId = 1;

  function makeBread(opts = {}) {
    return {
      id: nextBreadId++,
      shape: opts.shape || "dough", // 'dough', 'melon', 'croissant', 'heart', 'cinnamon', 'baguette', 'jumbo'
      state: opts.state || "raw",   // 'raw', 'baked', 'burnt'
      topping: opts.topping || null, // null, 'strawberry', 'choco', 'butter'
      knead: opts.knead || 0,       // 0..1
      jumbo: !!opts.jumbo,
      x: opts.x ?? POS.board.x,
      y: opts.y ?? POS.board.y,
      z: opts.z ?? POS.board.z,
      rot: opts.rot || 0,
      // Elastic spring scales for juicy squash & stretch
      sx: 1, sy: 1, sz: 1,
      vsx: 0, vsy: 0, vsz: 0,
      targetScale: opts.targetScale || 1.0,
      bakeProgress: 0,     // 0..1 while baking
      burnProgress: 0,     // 0..1 while over-baking
      blendKey: null,
      blendAlpha: 0,
      steamTimer: 0,
      slotIdx: -1,
      fly: null,           // { x0,y0,z0, x1,y1,z1, t, dur, arc, onDone }
    };
  }

  class BakeryGame {
    constructor(canvas) {
      this.canvas = canvas;
      this.renderer = new window.BakeryRenderer(canvas);
      this.audio = new window.BakeryAudio();

      // Turntable rotation state (initial 45 deg = iconic ref_bakery_front.jpg angle!)
      this.angle = Math.PI * 0.25;
      this.angVel = 0;
      this.lastRotMoveTs = 0;

      // Core bakery entities
      this.boardBread = makeBread({ shape: "dough", state: "raw", x: POS.board.x, y: POS.board.y, z: POS.board.z });
      this.ovenBread = null;
      this.ovenTimer = 0;
      this.ovenMode = "idle"; // 'idle', 'baking', 'ready', 'burning', 'burnt'
      this.ovenPuffCount = 0;
      this.shelfBreads = new Array(SHELF_SLOTS.length).fill(null);

      // Flying visual props (coins & bread transfers)
      this.flyingCoins = [];

      // Customers & Economy / Shop transformation
      this.customers = [];
      this.customerSpawnTimer = 1.6;
      this.coinCount = 0;
      this.shopLevel = 0; // 0..4 unlocks sign, flowers, lantern, festive garland!
      this.decoBounces = [0, 0, 0, 0];

      // Particles & timers
      this.particles = [];
      this.time = 0;
      this.idleTimer = 0;
      this.shapeTrayAlpha = 1;
      this.hasRotatedYet = false;

      // Pointer / Gesture state (strict single active pointer for iPad multi-touch safety)
      this.activePtr = null;
      this.dragMode = null; // 'rotate', 'knead_or_drag', 'drag_bread'
      this.dragBread = null;
      this.dragOrigin = null; // 'board', 'oven', 'shelf'
      this.dragOriginSlot = -1;
      this.ptrStart = { x: 0, y: 0 };
      this.ptrLast = { x: 0, y: 0 };
      this.kneadAccum = 0;
      this.ovenHover = false;

      // Animation loop
      this.lastTs = 0;
      this._bindEvents();
      this.renderer.resize();
      this.renderer.load(() => {
        this._spawnFlourPuff(POS.board.x, POS.board.y, POS.board.z + 3, 6);
        this.lastTs = performance.now();
        requestAnimationFrame((ts) => this._loop(ts));
      });
    }

    // -----------------------------------------------------------------
    // Input Handling (Touch + Mouse, Safari friendly, generous hitboxes)
    // -----------------------------------------------------------------
    _bindEvents() {
      window.addEventListener("resize", () => this.renderer.resize());
      window.addEventListener("orientationchange", () => setTimeout(() => this.renderer.resize(), 120));

      const opts = { passive: false };
      this.canvas.addEventListener("pointerdown", (e) => this._onDown(e), opts);
      this.canvas.addEventListener("pointermove", (e) => this._onMove(e), opts);
      this.canvas.addEventListener("pointerup", (e) => this._onUp(e), opts);
      this.canvas.addEventListener("pointercancel", (e) => this._onUp(e), opts);

      // Prevent Safari bounce / context menu
      document.addEventListener("touchmove", (e) => e.preventDefault(), opts);
      this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    }

    _getCSSSize() {
      return {
        w: this.canvas.width / this.renderer.dpr,
        h: this.canvas.height / this.renderer.dpr,
      };
    }

    _distToWorld(sx, sy, wp) {
      const p = this.renderer.worldToScreen(wp.x, wp.y, wp.z, this.angle);
      return Math.hypot(sx - p.x, sy - p.y);
    }

    _onDown(e) {
      e.preventDefault();
      this.audio.unlock();
      if (this.activePtr !== null) return; // Multi-touch guard: ignore extra fingers cleanly
      this.activePtr = e.pointerId;
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}

      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      this.ptrStart = { x: sx, y: sy };
      this.ptrLast = { x: sx, y: sy };
      this.idleTimer = 0;

      const { w, h } = this._getCSSSize();
      const hitUnit = Math.max(22, this.renderer.displayScaleX * 11);

      // 1. Check bottom wooden shape tray first (when dough is on board!)
      if (this.shapeTrayAlpha > 0.5 && this.boardBread && !this.boardBread.fly) {
        const rects = this.renderer.getShapeTrayRects(w, h);
        for (const r of rects) {
          if (sx >= r.x - 4 && sx <= r.x + r.w + 4 && sy >= r.y - 4 && sy <= r.y + r.h + 4) {
            this._applyShape(r.shape, r.idx);
            this.dragMode = "ui_tap";
            return;
          }
        }
      }

      // 2. Check board dough/bread (knead by rubbing/tapping, or drag to oven/trash!)
      if (this.boardBread && !this.boardBread.fly) {
        const d = this._distToWorld(sx, sy, { x: this.boardBread.x, y: this.boardBread.y, z: this.boardBread.z + 3 });
        if (d < hitUnit * 1.45) {
          this.dragMode = "knead_or_drag";
          this.kneadAccum = 0;
          this._doKneadPulse(this.boardBread);
          return;
        }
      }

      // 3. Check oven bread (ready or burnt -> drag to shelf / trash / customer, or tap to shelf!)
      if (this.ovenBread && !this.ovenBread.fly && (this.ovenMode === "ready" || this.ovenMode === "burnt")) {
        const d = this._distToWorld(sx, sy, { x: this.ovenBread.x, y: this.ovenBread.y, z: this.ovenBread.z + 3 });
        if (d < hitUnit * 1.65) {
          this._startDragBread(this.ovenBread, "oven", -1, sx, sy);
          return;
        }
      }

      // 4. Check topping bowls on table (strawberry / choco / butter)
      const dishes = [
        { kind: "strawberry", pos: POS.dishBerry },
        { kind: "choco",      pos: POS.dishChoco },
        { kind: "butter",     pos: POS.dishButter },
      ];
      for (const dish of dishes) {
        if (this._distToWorld(sx, sy, dish.pos) < hitUnit * 0.92) {
          this._applyTopping(dish.kind, dish.pos);
          this.dragMode = "ui_tap";
          return;
        }
      }

      // 5. Check flour bowl (spawn new dough, or merge into JUMBO bread!)
      if (this._distToWorld(sx, sy, POS.flourBowl) < hitUnit * 1.05) {
        this._tapFlourBowl();
        this.dragMode = "ui_tap";
        return;
      }

      // 6. Check shelf breads (grab to hand to customer or move to trash/slot!)
      let bestSlot = -1;
      let bestSlotDist = hitUnit * 1.05;
      for (let i = 0; i < this.shelfBreads.length; i++) {
        const b = this.shelfBreads[i];
        if (!b || b.fly) continue;
        const d = this._distToWorld(sx, sy, { x: b.x, y: b.y, z: b.z + 3 });
        if (d < bestSlotDist) {
          bestSlotDist = d;
          bestSlot = i;
        }
      }
      if (bestSlot >= 0) {
        this._startDragBread(this.shelfBreads[bestSlot], "shelf", bestSlot, sx, sy);
        return;
      }

      // 7. Check oven mouth tap (shortcut: sends board dough straight into oven!)
      if (this._distToWorld(sx, sy, { x: -21, y: -4, z: 27 }) < hitUnit * 1.45) {
        if (this.boardBread && !this.boardBread.fly && !this.ovenBread) {
          this._sendBoardToOven();
          this.dragMode = "ui_tap";
          return;
        } else if (this.ovenBread && this.ovenMode === "ready") {
          // Tap already-ready oven again -> comical second bake (overbake to burnt bread discovery!)
          this._startOverbake();
          this.dragMode = "ui_tap";
          return;
        }
      }

      // 8. Check waiting customers (tap customer to serve them a shelf bread right away!)
      for (const c of this.customers) {
        if (c.state === "browse") {
          const d = this._distToWorld(sx, sy, { x: c.x, y: c.y, z: 12 });
          if (d < hitUnit * 1.35) {
            this._serveCustomerFromShelf(c);
            this.dragMode = "ui_tap";
            return;
          }
        }
      }

      // 9. Check coin tray & brass register (tap coins to shower sparkles & upgrade the shop!)
      if (
        this._distToWorld(sx, sy, POS.coinTray) < hitUnit * 1.15 ||
        this._distToWorld(sx, sy, POS.register) < hitUnit * 1.15
      ) {
        this._tapCoins();
        this.dragMode = "ui_tap";
        return;
      }

      // 10. Check shelf area tap when oven bread is ready (shortcut: moves ready bread to shelf!)
      if (this.ovenBread && !this.ovenBread.fly && (this.ovenMode === "ready" || this.ovenMode === "burnt")) {
        if (this._distToWorld(sx, sy, { x: -8, y: -27, z: 28 }) < hitUnit * 2.1) {
          this._sendOvenToShelf();
          this.dragMode = "ui_tap";
          return;
        }
      }

      // 11. Secret rear-side & playful shop interactions (when looking at the back!)
      const lookingBack = Math.cos(this.angle) < 0.25 || Math.sin(this.angle) < 0.25;
      if (lookingBack) {
        if (this._distToWorld(sx, sy, POS.rearFlower) < hitUnit * 1.2) {
          this.audio.playFlower();
          this._spawnPetals(POS.rearFlower.x, POS.rearFlower.y, POS.rearFlower.z + 2, 12);
          this.dragMode = "ui_tap";
          return;
        }
        if (this._distToWorld(sx, sy, POS.rearSacks) < hitUnit * 1.2) {
          this.audio.playFlourPop(false);
          this._spawnFlourPuff(POS.rearSacks.x, POS.rearSacks.y, POS.rearSacks.z + 5, 10);
          this.dragMode = "ui_tap";
          return;
        }
        if (this._distToWorld(sx, sy, POS.rearDoor) < hitUnit * 1.15) {
          this.audio.playKnock();
          this._spawnSparkles(POS.rearDoor.x, POS.rearDoor.y - 2, POS.rearDoor.z + 2, 5, "#FFE245");
          this.dragMode = "ui_tap";
          return;
        }
      }

      // 12. Empty space / shop body / wooden turntable -> 360-degree smooth rotation!
      this.dragMode = "rotate";
      this.angVel = 0;
    }

    _startDragBread(bread, origin, slotIdx, sx, sy) {
      this.dragMode = "drag_bread";
      this.dragBread = bread;
      this.dragOrigin = origin;
      this.dragOriginSlot = slotIdx;
      this.audio.playPickup();
      this._squash(bread, 0.86, 0.86, 1.24);
      if (origin === "board") this.boardBread = null;
      else if (origin === "oven") {
        this.ovenBread = null;
        this.ovenMode = "idle";
      } else if (origin === "shelf") {
        this.shelfBreads[slotIdx] = null;
      }
      this._moveDraggedBreadToScreen(sx, sy);
    }

    _moveDraggedBreadToScreen(sx, sy) {
      if (!this.dragBread) return;
      const wp = this.renderer.screenToWorldPlane(sx, sy, 30, this.angle);
      this.dragBread.x = Math.max(-52, Math.min(52, wp.x));
      this.dragBread.y = Math.max(-52, Math.min(52, wp.y));
      this.dragBread.z = 31;

      const hitUnit = Math.max(22, this.renderer.displayScaleX * 11);
      this.ovenHover = (
        this.dragBread.state !== "burnt" &&
        !this.ovenBread &&
        this._distToWorld(sx, sy, { x: -22, y: -4, z: 27 }) < hitUnit * 1.9
      );
    }

    _onMove(e) {
      if (e.pointerId !== this.activePtr) return;
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const dx = sx - this.ptrLast.x;
      const dy = sy - this.ptrLast.y;
      const stepDist = Math.hypot(dx, dy);
      this.ptrLast = { x: sx, y: sy };
      this.idleTimer = 0;

      if (this.dragMode === "rotate") {
        const now = performance.now();
        const deltaAng = dx * 0.0095;
        this.angle += deltaAng;
        const dtMove = Math.max(0.012, (now - (this.lastRotMoveTs || now - 16)) / 1000);
        const instVel = Math.max(-4.2, Math.min(4.2, deltaAng / dtMove));
        this.angVel = this.angVel * 0.65 + instVel * 0.35;
        this.lastRotMoveTs = now;
        if (Math.abs(sx - this.ptrStart.x) > 10) this.hasRotatedYet = true;
      } else if (this.dragMode === "knead_or_drag" && this.boardBread) {
        const totalDist = Math.hypot(sx - this.ptrStart.x, sy - this.ptrStart.y);
        // Check if player pulled dough clearly toward oven, shelf, or trash
        const boardScreen = this.renderer.worldToScreen(POS.board.x, POS.board.y, POS.board.z + 3, this.angle);
        const distFromBoard = Math.hypot(sx - boardScreen.x, sy - boardScreen.y);
        const pullThresh = Math.max(36, this.renderer.displayScaleX * 16);

        if (distFromBoard > pullThresh && totalDist > pullThresh * 0.85) {
          // Transition seamlessly from kneading into picking up & carrying the dough!
          this._startDragBread(this.boardBread, "board", -1, sx, sy);
        } else {
          // Rubbing on dough -> tactile kneading!
          this.kneadAccum += stepDist;
          if (this.kneadAccum > 18) {
            this.kneadAccum = 0;
            this._doKneadPulse(this.boardBread);
          }
        }
      } else if (this.dragMode === "drag_bread" && this.dragBread) {
        this._moveDraggedBreadToScreen(sx, sy);
      }
    }

    _onUp(e) {
      if (e.pointerId !== this.activePtr) return;
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const totalMove = Math.hypot(sx - this.ptrStart.x, sy - this.ptrStart.y);

      if (this.dragMode === "rotate") {
        // If finger paused briefly before releasing, stop cleanly right at the chosen angle!
        if (performance.now() - this.lastRotMoveTs > 65 || Math.abs(this.angVel) < 0.35) {
          this.angVel = 0;
        }
      } else if (this.dragMode === "drag_bread" && this.dragBread) {
        this._dropDraggedBread(sx, sy, totalMove < 14);
      }

      this.activePtr = null;
      this.dragMode = null;
      this.dragBread = null;
      this.ovenHover = false;
    }

    // -----------------------------------------------------------------
    // Core Bakery Gameplay Actions
    // -----------------------------------------------------------------
    _squash(bread, sx, sy, sz) {
      bread.sx = sx;
      bread.sy = sy;
      bread.sz = sz;
    }

    _doKneadPulse(bread) {
      const prev = bread.knead;
      bread.knead = Math.min(1, bread.knead + 0.24);
      this._squash(bread, 1.32, 1.26, 0.58);
      this.audio.playKnead(bread.knead);
      this._spawnFlourPuff(bread.x, bread.y, bread.z + 3, 5);

      if (prev < 1 && bread.knead >= 1) {
        this.audio.playKneadDone();
        this._spawnSparkles(bread.x, bread.y, bread.z + 7, 8, "#FFE591");
      }
    }

    _applyShape(shape, idx) {
      if (!this.boardBread) return;
      const b = this.boardBread;
      b.shape = shape;
      b.jumbo = false;
      b.targetScale = 1.0;
      b.knead = Math.max(b.knead, 0.65);
      this._squash(b, 1.38, 1.38, 0.52);
      this.audio.playShapeStamp(idx);
      this._spawnFlourPuff(b.x, b.y, b.z + 3, 8);
      this._spawnSparkles(b.x, b.y, b.z + 7, 5, "#FFF585");
    }

    _applyTopping(kind, dishPos) {
      // Allow topping dough on board, OR even freshly baked bread on board/oven!
      const target = this.boardBread || (this.ovenMode === "ready" ? this.ovenBread : null);
      if (!target || target.fly) {
        // Still give a playful bounce & particle from the dish so every touch feels alive!
        this.audio.playTopping(kind);
        this._spawnToppingBurst(dishPos.x, dishPos.y, dishPos.z + 3, kind, 6);
        return;
      }
      target.topping = kind;
      this._squash(target, 1.24, 1.24, 0.72);
      this.audio.playTopping(kind);
      this._spawnToppingBurst(target.x, target.y, target.z + 8, kind, 9);
    }

    _tapFlourBowl() {
      this._spawnFlourPuff(POS.flourBowl.x, POS.flourBowl.y, POS.flourBowl.z + 3, 10);
      if (!this.boardBread) {
        const b = makeBread({ shape: "dough", state: "raw", x: POS.flourBowl.x, y: POS.flourBowl.y, z: POS.flourBowl.z + 2 });
        this.boardBread = b;
        this.audio.playFlourPop(false);
        this._flyBread(b, POS.board.x, POS.board.y, POS.board.z, 0.34, 14, () => {
          this._squash(b, 1.35, 1.35, 0.62);
          this._spawnFlourPuff(b.x, b.y, b.z + 2, 6);
        });
      } else if (!this.boardBread.fly && !this.boardBread.jumbo) {
        // Discovery: tapping flour bowl while dough is already on board merges into a JUMBO loaf!
        const b = this.boardBread;
        b.shape = "jumbo";
        b.jumbo = true;
        b.knead = 1.0;
        b.targetScale = 1.08;
        this.audio.playFlourPop(true);
        this._squash(b, 1.45, 1.45, 0.55);
        this._spawnFlourPuff(b.x, b.y, b.z + 4, 14);
        this._spawnSparkles(b.x, b.y, b.z + 10, 8, "#FFE591");
      } else {
        // Already jumbo -> joyful flour puff!
        this.audio.playFlourPop(false);
        if (this.boardBread) this._squash(this.boardBread, 1.2, 1.2, 0.8);
      }
    }

    _sendBoardToOven() {
      if (!this.boardBread || this.ovenBread) return;
      const b = this.boardBread;
      this.boardBread = null;
      this._putBreadIntoOven(b);
    }

    _putBreadIntoOven(b) {
      // If plain dough wasn't shaped yet, it bakes into a cute golden melonpan!
      if (b.shape === "dough") b.shape = "melon";
      const isSecondBake = (b.state === "baked");
      this.ovenBread = b;
      this.ovenTimer = 0;
      this.ovenPuffCount = 0;
      this.audio.playOvenIn();

      this._flyBread(b, POS.ovenInside.x, POS.ovenInside.y, POS.ovenInside.z, 0.36, 15, () => {
        if (isSecondBake) {
          this.ovenMode = "burning";
          b.burnProgress = 0;
        } else {
          this.ovenMode = "baking";
          b.bakeProgress = 0;
        }
        this._squash(b, 1.2, 1.2, 0.78);
      });
    }

    _startOverbake() {
      if (!this.ovenBread || this.ovenMode !== "ready") return;
      const b = this.ovenBread;
      this.ovenMode = "burning";
      this.ovenTimer = 0;
      b.burnProgress = 0;
      this.audio.playOvenIn();
      this._flyBread(b, POS.ovenInside.x, POS.ovenInside.y, POS.ovenInside.z, 0.25, 6);
    }

    _findFreeShelfSlot(nearScreenX, nearScreenY) {
      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < SHELF_SLOTS.length; i++) {
        if (this.shelfBreads[i]) continue;
        if (nearScreenX == null) return i;
        const d = this._distToWorld(nearScreenX, nearScreenY, SHELF_SLOTS[i]);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    }

    _sendOvenToShelf() {
      if (!this.ovenBread) return;
      const slot = this._findFreeShelfSlot();
      if (slot < 0) return;
      const b = this.ovenBread;
      this.ovenBread = null;
      this.ovenMode = "idle";
      this._placeBreadOnShelf(b, slot);
    }

    _placeBreadOnShelf(b, slotIdx) {
      const slot = SHELF_SLOTS[slotIdx];
      this.shelfBreads[slotIdx] = b;
      b.slotIdx = slotIdx;
      b.targetScale = b.jumbo ? 0.88 : 0.88;
      this.audio.playShelfPlace();
      this._flyBread(b, slot.x, slot.y, slot.z, 0.34, 16, () => {
        this._squash(b, 1.06, 1.06, 0.72);
        this._spawnSparkles(slot.x, slot.y, slot.z + 6, 5, "#FFF585");
      });
      // Automatically pop fresh dough onto the kneading board soon so play never stalls!
      if (!this.boardBread) {
        setTimeout(() => {
          if (!this.boardBread) this._tapFlourBowl();
        }, 650);
      }
      // Invite a customer promptly if none are waiting
      if (this.customers.length === 0) {
        this.customerSpawnTimer = Math.min(this.customerSpawnTimer, 0.7);
      }
    }

    _dropDraggedBread(sx, sy, wasQuickTap) {
      const b = this.dragBread;
      const hitUnit = Math.max(24, this.renderer.displayScaleX * 12);

      // Quick tap on ready/burnt oven bread -> whisk directly to an empty shelf slot!
      if (wasQuickTap && this.dragOrigin === "oven") {
        const slot = this._findFreeShelfSlot();
        if (slot >= 0) {
          this._placeBreadOnShelf(b, slot);
          return;
        }
      }

      // Quick tap on shelf bread when a customer is browsing -> hand straight to customer!
      if (wasQuickTap && this.dragOrigin === "shelf") {
        const waiting = this.customers.find((c) => c.state === "browse");
        if (waiting) {
          this._giveBreadToCustomer(waiting, b);
          return;
        }
      }

      // A. Drop into Trash Bin -> satisfying poof & vanish!
      if (this._distToWorld(sx, sy, POS.trash) < hitUnit * 1.35) {
        this.audio.playTrash();
        this._spawnSmoke(POS.trash.x, POS.trash.y, POS.trash.z + 4, 8, "#D4C6B2");
        if (!this.boardBread && this.dragOrigin === "board") {
          setTimeout(() => { if (!this.boardBread) this._tapFlourBowl(); }, 500);
        }
        return;
      }

      // B. Drop directly onto a waiting Customer -> instant joyful sale!
      for (const c of this.customers) {
        if (c.state === "browse" && this._distToWorld(sx, sy, { x: c.x, y: c.y, z: 12 }) < hitUnit * 1.6) {
          if (b.state !== "raw") {
            this._giveBreadToCustomer(c, b);
            return;
          }
        }
      }

      // C. Drop into Brick Oven -> bake (or overbake if already baked!)
      if (
        !this.ovenBread &&
        b.state !== "burnt" &&
        this._distToWorld(sx, sy, { x: -22, y: -4, z: 27 }) < hitUnit * 1.95
      ) {
        this._putBreadIntoOven(b);
        return;
      }

      // D. Drop onto Wooden Display Shelf (only baked or burnt breads!)
      if (
        b.state !== "raw" &&
        this._distToWorld(sx, sy, { x: -8, y: -27, z: 28 }) < hitUnit * 2.5
      ) {
        const slot = this._findFreeShelfSlot(sx, sy);
        if (slot >= 0) {
          this._placeBreadOnShelf(b, slot);
          return;
        }
      }

      // E. Drop onto Kneading Board (if empty)
      if (!this.boardBread && b.state === "raw" && this._distToWorld(sx, sy, POS.board) < hitUnit * 1.7) {
        this.boardBread = b;
        this._flyBread(b, POS.board.x, POS.board.y, POS.board.z, 0.2, 8, () => this._squash(b, 1.25, 1.25, 0.72));
        return;
      }

      // Otherwise snap smoothly back to where it came from (zero accidental loss!)
      if (this.dragOrigin === "board" && !this.boardBread) {
        this.boardBread = b;
        this._flyBread(b, POS.board.x, POS.board.y, POS.board.z, 0.22, 8, () => this._squash(b, 1.22, 1.22, 0.75));
      } else if (this.dragOrigin === "oven" && !this.ovenBread) {
        this.ovenBread = b;
        this.ovenMode = b.state === "burnt" ? "burnt" : "ready";
        this._flyBread(b, POS.ovenReady.x, POS.ovenReady.y, POS.ovenReady.z, 0.22, 8);
      } else if (this.dragOrigin === "shelf" && this.dragOriginSlot >= 0 && !this.shelfBreads[this.dragOriginSlot]) {
        const slot = SHELF_SLOTS[this.dragOriginSlot];
        this.shelfBreads[this.dragOriginSlot] = b;
        this._flyBread(b, slot.x, slot.y, slot.z, 0.22, 8);
      } else {
        // Fallback: empty shelf slot or board
        const slot = this._findFreeShelfSlot();
        if (b.state !== "raw" && slot >= 0) this._placeBreadOnShelf(b, slot);
        else {
          this.boardBread = b;
          this._flyBread(b, POS.board.x, POS.board.y, POS.board.z, 0.22, 8);
        }
      }
    }

    _flyBread(bread, tx, ty, tz, dur, arc, onDone) {
      bread.fly = {
        x0: bread.x, y0: bread.y, z0: bread.z,
        x1: tx, y1: ty, z1: tz,
        t: 0, dur, arc, onDone,
      };
    }

    // -----------------------------------------------------------------
    // Customers & Shop Upgrade Loop
    // -----------------------------------------------------------------
    _countShelfBreads() {
      let n = 0;
      for (const b of this.shelfBreads) if (b && !b.fly) n++;
      return n;
    }

    _spawnCustomer() {
      // Pick an unoccupied standing spot along the front cobblestone path
      const usedSpots = new Set(this.customers.map((c) => c.spotIdx));
      const freeSpots = [0, 1, 2].filter((idx) => !usedSpots.has(idx));
      if (freeSpots.length === 0) return;

      const spotIdx = freeSpots[Math.floor(Math.random() * freeSpots.length)];
      const kind = CUSTOMER_KINDS[Math.floor(Math.random() * CUSTOMER_KINDS.length)];
      const fromRight = Math.random() < 0.5;
      const startTheta = fromRight ? -0.15 : 2.15;
      const targetTheta = CUSTOMER_SPOTS[spotIdx];

      // Pick a favorite bread shape currently on the shelf (so desires always match!)
      const avail = this.shelfBreads.filter((b) => b && !b.fly);
      const fav = avail.length > 0 ? avail[Math.floor(Math.random() * avail.length)].shape : "melon";

      const R = 48.5;
      this.customers.push({
        kind,
        spotIdx,
        theta: startTheta,
        targetTheta,
        exitTheta: fromRight ? 2.18 : -0.18,
        x: Math.cos(startTheta) * R,
        y: Math.sin(startTheta) * R,
        rot: 0,
        state: "walk_in", // 'walk_in', 'browse', 'happy', 'walk_out'
        timer: 0,
        walkCycle: 0,
        wantShape: SHAPES.includes(fav) ? fav : "melon",
        heldBread: null,
        jumpZ: 0,
      });
      this.audio.playDoorBell();
    }

    _serveCustomerFromShelf(customer) {
      // Prefer matching shape, otherwise any available bread on shelf!
      let idx = this.shelfBreads.findIndex((b) => b && !b.fly && b.shape === customer.wantShape);
      if (idx < 0) idx = this.shelfBreads.findIndex((b) => b && !b.fly);
      if (idx < 0) return;
      const bread = this.shelfBreads[idx];
      this.shelfBreads[idx] = null;
      this._giveBreadToCustomer(customer, bread);
    }

    _giveBreadToCustomer(customer, bread) {
      customer.state = "happy";
      customer.timer = 0;
      customer.heldBread = bread;

      // Coin payout! Extra coins for topped / jumbo breads!
      const coins = 1 + (bread.topping ? 1 : 0) + (bread.jumbo ? 1 : 0);
      this.audio.playBuy(coins);

      // Fly bread into customer's hands
      this._flyBread(bread, customer.x, customer.y, 13, 0.28, 12, () => {
        this._squash(bread, 1.25, 1.25, 0.75);
      });

      // Heart & sparkle celebration!
      const heartCount = bread.state === "burnt" ? 3 : (4 + coins * 2);
      for (let i = 0; i < heartCount; i++) {
        this.particles.push({
          kind: i % 2 === 0 ? "heart" : "star",
          x: customer.x + (Math.random() - 0.5) * 12,
          y: customer.y + (Math.random() - 0.5) * 12,
          z: 24 + Math.random() * 6,
          vx: (Math.random() - 0.5) * 14,
          vy: (Math.random() - 0.5) * 14,
          vz: 18 + Math.random() * 14,
          size: 3.5,
          life: 1.0 + Math.random() * 0.4,
          maxLife: 1.4,
          color: bread.state === "burnt" ? "#FF9D26" : (i % 2 === 0 ? "#F0464E" : "#FFE245"),
        });
      }

      // Toss gleaming gold coins from customer -> register coin tray!
      for (let i = 0; i < coins; i++) {
        this.flyingCoins.push({
          x0: customer.x, y0: customer.y, z0: 15,
          x1: POS.coinTray.x + (Math.random() - 0.5) * 3,
          y1: POS.coinTray.y + (Math.random() - 0.5) * 3,
          z1: POS.coinTray.z + Math.min(10, (this.coinCount % 5) * 1.6),
          t: -i * 0.12,
          dur: 0.52,
          arc: 22 + i * 4,
        });
      }
    }

    _tapCoins() {
      if (this.coinCount <= 0) {
        // Gentle playful clink even when empty
        this.audio.playPickup();
        this._spawnSparkles(POS.coinTray.x, POS.coinTray.y, POS.coinTray.z + 4, 4, "#FFF380");
        return;
      }

      // Burst sparkles from register!
      this.audio.playUpgrade();
      this._spawnSparkles(POS.coinTray.x, POS.coinTray.y, POS.coinTray.z + 6, 14, "#FFE245");

      if (this.shopLevel < 4) {
        // World transformation! Unlock a permanent charming shop decoration!
        this.decoBounces[this.shopLevel] = 1.0;
        this.shopLevel++;
        this.coinCount = Math.max(0, this.coinCount - 2);
        // Celebration burst around the whole bakery!
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          this.particles.push({
            kind: i % 3 === 0 ? "heart" : "star",
            x: Math.cos(a) * 35,
            y: Math.sin(a) * 35,
            z: 28 + Math.random() * 20,
            vx: Math.cos(a) * 12,
            vy: Math.sin(a) * 12,
            vz: 16 + Math.random() * 14,
            size: 3.5,
            life: 1.2,
            maxLife: 1.2,
            color: ["#F0464E", "#FFE245", "#69C795", "#FF85B0"][i % 4],
          });
        }
      } else {
        // Already fully decorated -> joyful coin confetti fountain!
        this.coinCount = Math.max(0, this.coinCount - 1);
        this._spawnPetals(POS.register.x, POS.register.y, POS.register.z + 10, 14);
      }
    }

    // -----------------------------------------------------------------
    // Particle Helpers
    // -----------------------------------------------------------------
    _spawnFlourPuff(x, y, z, count) {
      for (let i = 0; i < count; i++) {
        this.particles.push({
          kind: "dot",
          x: x + (Math.random() - 0.5) * 9,
          y: y + (Math.random() - 0.5) * 9,
          z: z + Math.random() * 3,
          vx: (Math.random() - 0.5) * 18,
          vy: (Math.random() - 0.5) * 18,
          vz: 10 + Math.random() * 14,
          gravity: 22,
          size: 2.2 + Math.random() * 1.4,
          life: 0.45 + Math.random() * 0.3,
          maxLife: 0.75,
          color: i % 2 === 0 ? "#FFFFFF" : "#F5ECD8",
        });
      }
    }

    _spawnSparkles(x, y, z, count, color = "#FFE245") {
      for (let i = 0; i < count; i++) {
        this.particles.push({
          kind: "star",
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 10,
          z: z + Math.random() * 5,
          vx: (Math.random() - 0.5) * 16,
          vy: (Math.random() - 0.5) * 16,
          vz: 14 + Math.random() * 16,
          size: 3,
          life: 0.65 + Math.random() * 0.35,
          maxLife: 1.0,
          color,
        });
      }
    }

    _spawnSmoke(x, y, z, count, color = "#FFF8EB") {
      for (let i = 0; i < count; i++) {
        this.particles.push({
          kind: "steam",
          x: x + (Math.random() - 0.5) * 5,
          y: y + (Math.random() - 0.5) * 5,
          z: z + Math.random() * 2,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          vz: 11 + Math.random() * 8,
          size: 3.0 + Math.random() * 2.2,
          life: 0.8 + Math.random() * 0.5,
          maxLife: 1.3,
          alpha: 0.78,
          color,
        });
      }
    }

    _spawnToppingBurst(x, y, z, kind, count) {
      const palette =
        kind === "strawberry" ? ["#F03A43", "#FF6E77", "#59BF53", "#FFFDF7"] :
        kind === "choco"      ? ["#5C2D17", "#8A4A2A", "#3D1C0D"] :
                                ["#FFF285", "#FCD644", "#FFFFFF"];
      for (let i = 0; i < count; i++) {
        this.particles.push({
          kind: "dot",
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          z,
          vx: (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 20,
          vz: 14 + Math.random() * 14,
          gravity: 34,
          size: 2.5,
          life: 0.45 + Math.random() * 0.25,
          maxLife: 0.7,
          color: palette[i % palette.length],
        });
      }
    }

    _spawnPetals(x, y, z, count) {
      const cols = ["#F03A43", "#FFE245", "#FF85B0", "#59BF53", "#5EABF7"];
      for (let i = 0; i < count; i++) {
        this.particles.push({
          kind: "dot",
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 6,
          z: z + Math.random() * 4,
          vx: (Math.random() - 0.5) * 22,
          vy: (Math.random() - 0.5) * 22,
          vz: 16 + Math.random() * 16,
          gravity: 16,
          size: 2.8,
          life: 0.9 + Math.random() * 0.5,
          maxLife: 1.4,
          color: cols[i % cols.length],
        });
      }
    }

    // -----------------------------------------------------------------
    // Simulation Update (60fps fixed-feel dt clamped)
    // -----------------------------------------------------------------
    _updateBreadPhysics(b, dt) {
      if (!b) return;
      // Elastic spring back to targetScale
      const k = 150;
      const damp = 12;
      const ts = b.targetScale || 1.0;
      b.vsx += ((ts - b.sx) * k - b.vsx * damp) * dt;
      b.vsy += ((ts - b.sy) * k - b.vsy * damp) * dt;
      b.vsz += ((ts - b.sz) * k - b.vsz * damp) * dt;
      b.sx += b.vsx * dt;
      b.sy += b.vsy * dt;
      b.sz += b.vsz * dt;

      // Parabolic flight
      if (b.fly) {
        const f = b.fly;
        f.t += dt;
        const u = Math.min(1, f.t / f.dur);
        const ease = 1 - Math.pow(1 - u, 2.2);
        b.x = f.x0 + (f.x1 - f.x0) * ease;
        b.y = f.y0 + (f.y1 - f.y0) * ease;
        b.z = f.z0 + (f.z1 - f.z0) * ease + Math.sin(u * Math.PI) * f.arc;
        if (u >= 1) {
          const cb = f.onDone;
          b.fly = null;
          if (cb) cb();
        }
      }

      // Gentle warm steam from fresh baked/burnt bread
      if (b.state === "baked" || b.state === "burnt") {
        b.steamTimer -= dt;
        if (b.steamTimer <= 0) {
          b.steamTimer = b.state === "burnt" ? 0.25 : 0.65 + Math.random() * 0.5;
          this._spawnSmoke(
            b.x, b.y, b.z + (b.jumbo ? 11 : 7), 1,
            b.state === "burnt" ? "#5E5A58" : "#FFFDF6"
          );
        }
      }
    }

    _update(dt) {
      this.time += dt;
      this.idleTimer += dt;

      // Smooth turntable inertia
      if (this.dragMode !== "rotate") {
        this.angle += this.angVel * dt;
        this.angVel *= Math.pow(0.06, dt);
        if (Math.abs(this.angVel) < 0.002) this.angVel = 0;
      }

      // Smooth show/hide of bottom wooden shape tray (visible when raw dough sits on kneading board!)
      const wantTray = (this.boardBread && !this.boardBread.fly && this.boardBread.state === "raw") ? 1 : 0;
      this.shapeTrayAlpha += (wantTray - this.shapeTrayAlpha) * Math.min(1, dt * 10);

      // Gentle breathing cue on the current primary focus (wordless affordance!)
      if (this.boardBread && !this.boardBread.fly) {
        const pulse = this.idleTimer > 8 ? 0.09 : 0.035;
        const wave = Math.sin(this.time * 4.2) * pulse;
        this.boardBread.targetScale = (this.boardBread.jumbo ? 1.08 : 1.0) + wave;
      }
      this._updateBreadPhysics(this.boardBread, dt);
      this._updateBreadPhysics(this.dragBread, dt);
      for (const sb of this.shelfBreads) this._updateBreadPhysics(sb, dt);

      // --- Oven Baking & Puffing Simulation ---
      if (this.ovenBread) {
        const b = this.ovenBread;
        this._updateBreadPhysics(b, dt);

        if (this.ovenMode === "baking" && !b.fly) {
          this.ovenTimer += dt;
          const dur = 3.1;
          const p = Math.min(1, this.ovenTimer / dur);
          b.bakeProgress = p;
          // Watch it PUFF UP plumply while browning to golden perfection!
          const puffBase = b.jumbo ? 0.86 : 0.84;
          const puffGain = (b.knead >= 0.8 ? 0.34 : 0.26) * (1 - Math.pow(1 - p, 2));
          b.targetScale = puffBase + puffGain;
          b.blendKey = `${b.shape}_baked`;
          b.blendAlpha = p;

          // Rising chimney steam & subtle warm puff sound
          if (Math.random() < dt * 7) {
            this._spawnSmoke(POS.chimneyTop.x, POS.chimneyTop.y, POS.chimneyTop.z, 1, "#FFFDF5");
          }
          const puffStep = Math.floor(p * 4);
          if (puffStep > this.ovenPuffCount && puffStep < 4) {
            this.ovenPuffCount = puffStep;
            this._squash(b, b.targetScale * 1.12, b.targetScale * 1.12, b.targetScale * 0.88);
            this.audio.playBakePuff(p);
          }

          if (p >= 1) {
            b.state = "baked";
            b.blendKey = null;
            b.blendAlpha = 0;
            b.targetScale = b.jumbo ? 1.12 : 1.14;
            this.ovenMode = "ready";
            this.audio.playOvenDing();
            this._spawnSparkles(POS.ovenReady.x, POS.ovenReady.y, POS.ovenReady.z + 8, 10, "#FFE245");
            // Slide gently forward to oven hearth lip to invite pickup!
            this._flyBread(b, POS.ovenReady.x, POS.ovenReady.y, POS.ovenReady.z, 0.35, 5, () => {
              this._squash(b, 1.24, 1.24, 0.90);
            });
          }
        } else if (this.ovenMode === "burning" && !b.fly) {
          this.ovenTimer += dt;
          const p = Math.min(1, this.ovenTimer / 2.2);
          b.burnProgress = p;
          b.blendKey = `${b.shape}_burnt`;
          b.blendAlpha = p;
          if (Math.random() < dt * 11) {
            this._spawnSmoke(POS.chimneyTop.x, POS.chimneyTop.y, POS.chimneyTop.z, 1, "#6E6A67");
          }
          if (p >= 1) {
            b.state = "burnt";
            b.blendKey = null;
            b.blendAlpha = 0;
            this.ovenMode = "burnt";
            this.audio.playBurnt();
            this._spawnSmoke(POS.ovenReady.x, POS.ovenReady.y, POS.ovenReady.z + 6, 8, "#5E5A58");
            this._flyBread(b, POS.ovenReady.x, POS.ovenReady.y, POS.ovenReady.z, 0.3, 4);
          }
        } else if (this.ovenMode === "ready" && !b.fly && this.idleTimer > 7) {
          // Gentle bounce cue when baked bread is waiting to be placed on shelf
          b.targetScale = (b.jumbo ? 1.12 : 1.14) + Math.sin(this.time * 5) * 0.05;
        }
      } else if (Math.random() < dt * 1.4) {
        // Cozy idle wisp from brick chimney
        this._spawnSmoke(POS.chimneyTop.x, POS.chimneyTop.y, POS.chimneyTop.z, 1, "#FFF8EB");
      }

      // --- Customer Arrival & Autonomous Shopping Loop ---
      const shelfCount = this._countShelfBreads();
      const maxCust = shelfCount >= 4 ? 3 : (shelfCount >= 2 ? 2 : (shelfCount >= 1 ? 1 : 0));
      if (this.customers.length < maxCust) {
        this.customerSpawnTimer -= dt;
        if (this.customerSpawnTimer <= 0) {
          this._spawnCustomer();
          this.customerSpawnTimer = 2.6 + Math.random() * 2.0;
        }
      }

      const R = 48.5;
      for (let i = this.customers.length - 1; i >= 0; i--) {
        const c = this.customers[i];
        c.timer += dt;

        if (c.state === "walk_in") {
          const diff = c.targetTheta - c.theta;
          const speed = 0.72;
          if (Math.abs(diff) <= speed * dt) {
            c.theta = c.targetTheta;
            c.state = "browse";
            c.timer = 0;
          } else {
            c.theta += Math.sign(diff) * speed * dt;
            c.walkCycle += dt * 7;
          }
          c.x = Math.cos(c.theta) * R;
          c.y = Math.sin(c.theta) * R;
          // Face along walk direction
          const dir = Math.sign(diff);
          c.rot = c.theta + (dir > 0 ? 0 : Math.PI);
        } else if (c.state === "browse") {
          // Face warmly toward the bakery interior!
          const toShop = Math.atan2(-c.y, -c.x) - Math.PI * 0.5;
          c.rot = toShop;
          c.jumpZ = Math.abs(Math.sin(this.time * 4.5 + i)) * 1.2;

          // After browsing happily for a few seconds, pick a bread from the shelf automatically!
          if (c.timer > 4.2) {
            if (this._countShelfBreads() > 0) {
              this._serveCustomerFromShelf(c);
            } else {
              // Shelf emptied -> wave & stroll on
              c.state = "walk_out";
              c.timer = 0;
            }
          }
        } else if (c.state === "happy") {
          c.jumpZ = Math.abs(Math.sin(c.timer * 12)) * 4.5;
          if (c.heldBread) {
            this._updateBreadPhysics(c.heldBread, dt);
            if (!c.heldBread.fly) {
              const fx = Math.cos(c.rot + Math.PI * 0.5);
              const fy = Math.sin(c.rot + Math.PI * 0.5);
              c.heldBread.x = c.x + fx * 4.5;
              c.heldBread.y = c.y + fy * 4.5;
              c.heldBread.z = 11 + c.jumpZ;
              c.heldBread.targetScale = 0.85;
            }
          }
          if (c.timer > 1.35) {
            c.state = "walk_out";
            c.timer = 0;
          }
        } else if (c.state === "walk_out") {
          const diff = c.exitTheta - c.theta;
          const speed = 0.82;
          c.theta += Math.sign(diff) * speed * dt;
          c.walkCycle += dt * 8;
          c.x = Math.cos(c.theta) * R;
          c.y = Math.sin(c.theta) * R;
          c.rot = c.theta + (Math.sign(diff) > 0 ? 0 : Math.PI);
          c.jumpZ = Math.abs(Math.sin(c.walkCycle)) * 1.8;

          if (c.heldBread) {
            this._updateBreadPhysics(c.heldBread, dt);
            const fx = Math.cos(c.rot + Math.PI * 0.5);
            const fy = Math.sin(c.rot + Math.PI * 0.5);
            c.heldBread.x = c.x + fx * 4.5;
            c.heldBread.y = c.y + fy * 4.5;
            c.heldBread.z = 11 + c.jumpZ;
          }

          if (Math.abs(diff) < 0.08) {
            this.customers.splice(i, 1);
          }
        }
      }

      // --- Flying Coins ---
      for (let i = this.flyingCoins.length - 1; i >= 0; i--) {
        const fc = this.flyingCoins[i];
        fc.t += dt;
        if (fc.t >= fc.dur) {
          this.coinCount = Math.min(18, this.coinCount + 1);
          this._spawnSparkles(POS.coinTray.x, POS.coinTray.y, POS.coinTray.z + 4, 4, "#FFF380");
          this.flyingCoins.splice(i, 1);
        }
      }

      // --- Shop Upgrade Deco Bounce ---
      for (let i = 0; i < this.decoBounces.length; i++) {
        if (this.decoBounces[i] > 0) {
          this.decoBounces[i] = Math.max(0, this.decoBounces[i] - dt * 2.2);
        }
      }

      // --- Particles ---
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        p.x += (p.vx || 0) * dt;
        p.y += (p.vy || 0) * dt;
        p.z += (p.vz || 0) * dt;
        if (p.gravity) p.vz -= p.gravity * dt;
      }
    }

    // -----------------------------------------------------------------
    // Assemble Render Objects List for Interleaved Sprite Stacking
    // -----------------------------------------------------------------
    _pushBreadRender(list, b, layer) {
      if (!b) return;
      const baseKey = b.shape === "dough" ? "dough_raw" : `${b.shape}_${b.state}`;
      list.push({
        key: baseKey,
        blendKey: b.blendKey,
        blendAlpha: b.blendAlpha,
        x: b.x,
        y: b.y,
        z: b.z,
        rot: b.rot || 0,
        scaleX: b.sx,
        scaleY: b.sy,
        scaleZ: b.sz,
        layer,
      });
      if (b.topping) {
        const topH = (b.jumbo ? 10.5 : 5.6) * b.sz;
        list.push({
          key: `top_${b.topping}`,
          x: b.x,
          y: b.y,
          z: b.z + topH,
          rot: b.rot || 0,
          scaleX: b.sx * (b.jumbo ? 1.25 : 0.95),
          scaleY: b.sy * (b.jumbo ? 1.25 : 0.95),
          scaleZ: b.sz * 0.95,
          layer,
        });
      }
    }

    _buildRenderList() {
      const list = [];

      // 1. Animated flickering oven fire
      const firePhase = Math.floor(this.time * 7.5) % 3;
      const fireBoost = (this.ovenMode === "baking" || this.ovenMode === "burning") ? 1.22 : (this.ovenHover ? 1.15 : 0.92);
      list.push({
        key: `fire_${firePhase}`,
        x: POS.ovenFire.x,
        y: POS.ovenFire.y,
        z: POS.ovenFire.z,
        scaleX: fireBoost,
        scaleY: fireBoost,
        scaleZ: fireBoost,
        layer: "oven",
      });

      // 2. Kneading board dough / bread
      this._pushBreadRender(list, this.boardBread, "interior");

      // 3. Oven baking / ready bread
      this._pushBreadRender(list, this.ovenBread, "oven");

      // 4. Shelf displayed breads
      for (const sb of this.shelfBreads) {
        this._pushBreadRender(list, sb, "interior");
      }

      // 5. Currently dragged floating bread
      this._pushBreadRender(list, this.dragBread, "drag");

      // 6. Stacked gold coins on register coin tray (up to 3 gleaming stacks!)
      const coinOffsets = [
        [0, 0], [-2.5, 1.5], [2.4, 1.3],
      ];
      for (let i = 0; i < this.coinCount; i++) {
        const stackIdx = i % 3;
        const heightIdx = (i / 3) | 0;
        list.push({
          key: "coin",
          x: POS.coinTray.x + coinOffsets[stackIdx][0],
          y: POS.coinTray.y + coinOffsets[stackIdx][1],
          z: POS.coinTray.z + heightIdx * 1.9,
          layer: "interior",
        });
      }

      // Flying coins in transit
      for (const fc of this.flyingCoins) {
        if (fc.t < 0) continue;
        const u = Math.min(1, fc.t / fc.dur);
        list.push({
          key: "coin",
          x: fc.x0 + (fc.x1 - fc.x0) * u,
          y: fc.y0 + (fc.y1 - fc.y0) * u,
          z: fc.z0 + (fc.z1 - fc.z0) * u + Math.sin(u * Math.PI) * fc.arc,
          layer: "drag",
        });
      }

      // 7. Unlocked Shop Decorations (permanent joyful world upgrades!)
      const decos = [
        { lvl: 1, key: "deco_sign",    x: 42,  y: -14, z: 8, layer: "outside" },
        { lvl: 2, key: "deco_flowers", x: -24, y: 31,  z: 8, layer: "outside" },
        { lvl: 3, key: "deco_lantern", x: 39,  y: 12,  z: 8, layer: "outside" },
        { lvl: 4, key: "deco_flowers", x: 33,  y: -29, z: 8, layer: "outside" },
      ];
      for (let i = 0; i < decos.length; i++) {
        const d = decos[i];
        if (this.shopLevel >= d.lvl) {
          const b = this.decoBounces[i];
          const sc = 1 + Math.sin(b * Math.PI) * 0.35;
          list.push({
            key: d.key,
            x: d.x,
            y: d.y,
            z: d.z,
            scaleX: sc,
            scaleY: sc,
            scaleZ: sc,
            layer: d.layer,
          });
        }
      }

      // 8. Walking & browsing cute human customers (+ their purchased bread!)
      for (const c of this.customers) {
        const step = (c.state === "walk_in" || c.state === "walk_out") ? (Math.floor(c.walkCycle) % 2) : 0;
        list.push({
          key: `cust_${c.kind}_${step}`,
          x: c.x,
          y: c.y,
          z: 9 + c.jumpZ,
          rot: c.rot,
          layer: "outside",
        });
        if (c.heldBread) {
          this._pushBreadRender(list, c.heldBread, "outside");
        }
      }

      return list;
    }

    _loop(ts) {
      const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
      this.lastTs = ts;

      this._update(dt);

      // Gentle subtle circular rim hint only if user hasn't rotated after 12s
      const idleTurntablePulse = (!this.hasRotatedYet && this.time > 12)
        ? 0.5 + 0.5 * Math.sin(this.time * 2.5)
        : 0;

      this.renderer.render({
        angle: this.angle,
        time: this.time,
        renderObjects: this._buildRenderList(),
        particles: this.particles,
        customers: this.customers,
        ovenActive: this.ovenMode === "baking" || this.ovenMode === "burning",
        ovenHover: this.ovenHover,
        shopLevel: this.shopLevel,
        shapeTrayAlpha: this.shapeTrayAlpha,
        doughShape: this.boardBread ? this.boardBread.shape : null,
        doughKneadReady: this.boardBread ? this.boardBread.knead >= 0.95 : false,
        idleTurntablePulse,
      });

      requestAnimationFrame((t) => this._loop(t));
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("game");
    window.bakeryGame = new BakeryGame(canvas);
  });
})();
