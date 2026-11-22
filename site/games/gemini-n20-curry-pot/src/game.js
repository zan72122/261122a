// Wordless Curry Rice Sprite-Stacking Game — tactile physics, rich discovery loop, 360° rotatable diorama
(() => {
  const P = window.PAL;
  const CU = window.ColorUtil;
  const FX = window.SoundFX;
  const R = window.Renderer;

  const canvas = document.getElementById('stage');
  const replayBtn = document.getElementById('replay-btn');

  // Build all sprite-stacked voxel models once at startup!
  const models = window.VoxelLib.buildAll();

  const FLOOR_Z = 7;
  const COUNTER_Z = FLOOR_Z + 17;
  const TABLE_Z = FLOOR_Z + 14;
  const POT_POS = { x: 5, y: 24, z: FLOOR_Z + 25 };
  const SERVING_SPOT = { x: 13, y: -3.2 }; // Front serving edge of deeper dining table, clearly separated from placemats!

  let state = null;
  let lastTime = performance.now();
  let elapsed = 0;

  // Pointer gesture tracking (single-finger only; multi-touch safe!)
  let activePointerId = null;
  let dragMode = null; // 'spin' | 'veggie' | 'roux' | 'stir' | 'ladle' | 'plate'
  let dragTarget = null;
  let pointerStart = { x: 0, y: 0, time: 0 };
  let pointerLast = { x: 0, y: 0 };
  let totalDragDist = 0;
  let lastStirSound = 0;

  function makeInitialState(keepAngle) {
    const prevAngle = keepAngle && state ? state.camAngle : Math.PI * 0.25;
    replayBtn.classList.remove('visible');

    const s = {
      camAngle: prevAngle,
      camVel: 0,
      idleTime: 0,
      hintTarget: null,

      stoveHeat: 0, // 0 = off, 1 = simmer, 2 = high boil
      cookerOpen: 0, // 0..1 animated lid opening
      cookerTargetOpen: 0,
      cookerBounce: 0,
      jarBounce: 0,

      knife: { wx: -27, wy: 21, rot: -0.35, anim: 0 },

      // 4 distinct colorful vegetables on the wooden cutting board
      veggies: [
        { id: 0, type: 'carrot', homeX: -36, homeY: 18, wx: -36, wy: 18, wz: COUNTER_Z + 2.5, rot: 0.35, chops: 0, chopped: false, state: 'whole', chopAnim: 0, hop: 0 },
        { id: 1, type: 'potato', homeX: -30, homeY: 15, wx: -30, wy: 15, wz: COUNTER_Z + 2.5, rot: 0.1, chops: 0, chopped: false, state: 'whole', chopAnim: 0, hop: 0 },
        { id: 2, type: 'onion', homeX: -36, homeY: 8.5, wx: -36, wy: 8.5, wz: COUNTER_Z + 2.5, rot: 0, chops: 0, chopped: false, state: 'whole', chopAnim: 0, hop: 0 },
        { id: 3, type: 'broccoli', homeX: -29.5, homeY: 7.5, wx: -29.5, wy: 7.5, wz: COUNTER_Z + 2.5, rot: 0.2, chops: 0, chopped: false, state: 'whole', chopAnim: 0, hop: 0 },
      ],

      // 2x2 segmented chocolate-like curry roux bar on silver tray (wx=-27, wy=-16)
      rouxCubes: [
        { id: 0, homeX: -29.8, homeY: -18.8, wx: -29.8, wy: -18.8, wz: COUNTER_Z + 2, state: 'bar', rot: 0, hop: 0 },
        { id: 1, homeX: -24.2, homeY: -18.8, wx: -24.2, wy: -18.8, wz: COUNTER_Z + 2, state: 'bar', rot: 0, hop: 0 },
        { id: 2, homeX: -29.8, homeY: -13.2, wx: -29.8, wy: -13.2, wz: COUNTER_Z + 2, state: 'bar', rot: 0, hop: 0 },
        { id: 3, homeX: -24.2, homeY: -13.2, wx: -24.2, wy: -13.2, wz: COUNTER_Z + 2, state: 'bar', rot: 0, hop: 0 },
      ],

      // Curry Pot internal simulation
      pot: {
        veggieTypes: [],
        veggieStock: 0, // 0..1 warmth as veggies simmer
        rouxMelted: 0,  // 0..4 continuous richness
        rouxDropped: 0,
        floatingVeggies: [],
        meltingRoux: [],
        bubbles: [],
        stirAngle: 0,
        stirSpeed: 0,
        ladleAngle: -0.6,
        simmerTime: 0,
      },

      ladleLifted: false,
      ladleFly: { wx: POT_POS.x, wy: POT_POS.y, wz: POT_POS.z, rot: 0, hasCurry: false, autoAnim: null },

      // 3 Family Seats along the dining table (Mama, Papa, Little Girl)
      seats: [
        { id: 0, who: 'mama', wx: -2, matX: -2, matY: -16.5, plate: null, mood: 'waiting', eatTimer: 0, bites: 0, bounce: 0, spoonTap: 0 },
        { id: 1, who: 'papa', wx: 14, matX: 14, matY: -16.5, plate: null, mood: 'waiting', eatTimer: 0, bites: 0, bounce: 0, spoonTap: 0 },
        { id: 2, who: 'girl', wx: 30, matX: 30, matY: -16.5, plate: null, mood: 'waiting', eatTimer: 0, bites: 0, bounce: 0, spoonTap: 0 },
      ],

      plates: [],
      nextPlateId: 1,
      celebrating: false,
      celebratedOnce: false,
      particles: [],
    };

    state = s;
    spawnServingPlate(false);
    return s;
  }

  function spawnServingPlate(popCooker = true) {
    // Only keep one active serving plate at the serving spot at a time
    if (state.plates.some((p) => p.state === 'serving' || p.state === 'dragging')) return;
    const pl = {
      id: state.nextPlateId++,
      wx: SERVING_SPOT.x,
      wy: SERVING_SPOT.y,
      wz: TABLE_Z + 1,
      state: 'serving', // 'serving' | 'dragging' | 'flying' | 'seated'
      hasRice: true,
      curryScoops: 0,
      richness: 0,
      veggies: [],
      hasPickles: false,
      eatFrac: 0,
      hop: 1.0,
      seatId: -1,
      model: models.plateRiceOnly,
    };
    state.plates.push(pl);
    if (popCooker) {
      state.cookerTargetOpen = 1;
      state.cookerBounce = 1;
      FX.riceCooker(true);
      for (let i = 0; i < 6; i++) {
        spawnParticle('steam', -35 + (Math.random() - 0.5) * 6, -9 + (Math.random() - 0.5) * 6, COUNTER_Z + 10,
          (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 9 + Math.random() * 6, 2.2, '#FFFFFF', 1.1);
      }
      setTimeout(() => {
        if (state) state.cookerTargetOpen = 0;
      }, 950);
    }
  }

  function rebuildPlateModel(pl) {
    pl.model = models.buildPlateModel({
      hasRice: pl.hasRice,
      curryScoops: pl.curryScoops,
      richness: pl.richness,
      veggies: pl.veggies,
      hasPickles: pl.hasPickles,
      eatFrac: pl.eatFrac,
    });
  }

  function spawnParticle(kind, wx, wy, wz, vx, vy, vz, size, color, life) {
    if (state.particles.length > 140) state.particles.shift();
    state.particles.push({
      kind, wx, wy, wz, vx, vy, vz,
      size, color, life, maxLife: life, alpha: 1,
      gravity: kind === 'steam' || kind === 'heart' || kind === 'star' ? 0 : -42,
    });
  }

  function burstSparkles(wx, wy, wz, color, count = 6, kind = 'drop') {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const spd = 8 + Math.random() * 14;
      spawnParticle(
        kind, wx, wy, wz,
        Math.cos(a) * spd, Math.sin(a) * spd, 12 + Math.random() * 14,
        kind === 'drop' ? 1.4 : 2, color, 0.55 + Math.random() * 0.35
      );
    }
  }

  // Chop a whole vegetable on the cutting board!
  function chopVeggie(veg) {
    if (veg.state !== 'whole') return;
    veg.chops++;
    veg.chopAnim = 1.0;
    state.knife.wx = veg.wx + 3.2;
    state.knife.wy = veg.wy + 2.2;
    state.knife.anim = 1.0;
    FX.chop(veg.chops - 1);

    const pColor = veg.type === 'carrot' ? P.carrotLight
      : veg.type === 'potato' ? P.potatoInside
        : veg.type === 'onion' ? P.onionInside : P.brocLight;
    burstSparkles(veg.wx, veg.wy, COUNTER_Z + 4, pColor, 5, 'drop');

    if (veg.chops >= 3) {
      veg.chopped = true;
      veg.state = 'chopped';
      veg.hop = 1.0;
      burstSparkles(veg.wx, veg.wy, COUNTER_Z + 5, '#FFE875', 5, 'star');
    }
  }

  // Launch a chopped veggie into the simmering pot with a joyful parabolic arc!
  function tossVeggieToPot(veg) {
    veg.state = 'flying';
    veg.fly = {
      sx: veg.wx, sy: veg.wy, sz: veg.wz,
      tx: POT_POS.x + (Math.random() - 0.5) * 4,
      ty: POT_POS.y + (Math.random() - 0.5) * 4,
      tz: POT_POS.z,
      t: 0, dur: 0.42,
      onDone: () => landVeggieInPot(veg),
    };
  }

  function bounceVeggieBack(veg) {
    FX.boing();
    veg.state = 'flying';
    veg.fly = {
      sx: veg.wx, sy: veg.wy, sz: veg.wz,
      tx: veg.homeX, ty: veg.homeY, tz: COUNTER_Z + 2.5,
      t: 0, dur: 0.35,
      onDone: () => {
        veg.state = 'whole';
        veg.wx = veg.homeX;
        veg.wy = veg.homeY;
        veg.wz = COUNTER_Z + 2.5;
        veg.hop = 1.0;
        // Knife gives an eager little hop next to it!
        state.knife.wx = veg.homeX + 3.5;
        state.knife.wy = veg.homeY + 2.5;
        state.knife.anim = 0.6;
      },
    };
  }

  function landVeggieInPot(veg) {
    veg.state = 'inPot';
    const pot = state.pot;
    if (!pot.veggieTypes.includes(veg.type)) pot.veggieTypes.push(veg.type);

    // Spawn 4 chunky 3D floating bits inside the pot!
    for (let i = 0; i < 4; i++) {
      pot.floatingVeggies.push({
        type: veg.type,
        angle: Math.random() * Math.PI * 2,
        dist: 1.4 + Math.random() * 4.3,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Auto-ignite gentle simmer flame when first ingredient enters the pot!
    if (state.stoveHeat === 0) {
      state.stoveHeat = 1;
      FX.stoveClick(1);
    }
    FX.splash(pot.rouxMelted);
    const cols = CU.curryColors(pot.rouxMelted, pot.veggieStock);
    burstSparkles(POT_POS.x, POT_POS.y, POT_POS.z + 2, cols.hi, 8, 'drop');
  }

  // Crack a curry roux cube cleanly off the 2x2 chocolate-like bar!
  function crackRouxCube(rc) {
    if (rc.state !== 'bar') return;
    rc.state = 'broken';
    rc.hop = 1.0;
    rc.rot = (Math.random() - 0.5) * 0.45;
    rc.wx += (rc.id % 2 === 0 ? -0.9 : 0.9);
    rc.wy += (rc.id < 2 ? -0.9 : 0.9);
    FX.rouxSnap();
    burstSparkles(rc.wx, rc.wy, COUNTER_Z + 4, P.rouxLight, 5, 'drop');
  }

  function tossRouxToPot(rc) {
    rc.state = 'flying';
    rc.fly = {
      sx: rc.wx, sy: rc.wy, sz: rc.wz,
      tx: POT_POS.x + (Math.random() - 0.5) * 3.5,
      ty: POT_POS.y + (Math.random() - 0.5) * 3.5,
      tz: POT_POS.z,
      t: 0, dur: 0.44,
      onDone: () => landRouxInPot(rc),
    };
  }

  function landRouxInPot(rc) {
    rc.state = 'inPot';
    const pot = state.pot;
    pot.rouxDropped++;
    pot.meltingRoux.push({
      lx: (Math.random() - 0.5) * 5.2,
      ly: (Math.random() - 0.5) * 5.2,
      progress: 0,
      doneSound: false,
    });
    if (state.stoveHeat === 0) {
      state.stoveHeat = 1;
      FX.stoveClick(1);
    }
    FX.splash(pot.rouxMelted + 1);
    burstSparkles(POT_POS.x, POT_POS.y, POT_POS.z + 2, P.rouxLight, 8, 'drop');
  }

  function isCurryReadyToLadle() {
    const pot = state.pot;
    // Allow ladling as soon as roux is melted (>= 0.4) OR veggies have simmered into warm soup!
    return pot.rouxMelted >= 0.4 || (pot.floatingVeggies.length >= 4 && pot.veggieStock >= 0.45);
  }

  // Animated ladle scoop from pot -> rice plate!
  function pourCurryOntoPlate(plate) {
    if (!plate || state.ladleLifted) return;
    if (!isCurryReadyToLadle()) {
      // Gentle water splash if nothing cooked yet
      FX.splash(0);
      burstSparkles(POT_POS.x, POT_POS.y, POT_POS.z + 2, '#BDE8FC', 5, 'drop');
      return;
    }
    state.ladleLifted = true;
    state.ladleFly = {
      wx: POT_POS.x, wy: POT_POS.y, wz: POT_POS.z + 2,
      rot: -0.5, hasCurry: true,
      autoAnim: {
        t: 0, dur: 0.62,
        targetPlate: plate,
        poured: false,
      },
    };
    FX.stir(state.pot.rouxMelted);
  }

  function applyCurryToPlate(plate) {
    const pot = state.pot;
    plate.curryScoops = Math.min(2, plate.curryScoops + 1);
    plate.richness = Math.max(plate.richness, pot.rouxMelted);
    plate.veggies = pot.veggieTypes.slice();
    plate.hop = 0.8;
    rebuildPlateModel(plate);
    FX.pourCurry(plate.richness);
    const cols = CU.curryColors(plate.richness, 1);
    burstSparkles(plate.wx + 2, plate.wy, TABLE_Z + 4, cols.hi, 7, 'drop');
    burstSparkles(plate.wx, plate.wy, TABLE_Z + 6, '#FFE359', 4, 'star');

    // Family members notice the steaming plate and eagerly tap their spoons!
    state.seats.forEach((seat) => {
      if (!seat.plate) {
        seat.spoonTap = 1.0;
        seat.bounce = 0.7;
      }
    });
  }

  // Sprinkle crimson fukujinzuke pickles onto a filled curry plate!
  function sprinklePickles() {
    state.jarBounce = 1.0;
    FX.sprinkle();
    burstSparkles(-40.5, 23.5, COUNTER_Z + 7, P.pickleRed, 6, 'drop');
    // Garnish the active serving plate (or any seated curry plate!)
    const target = state.plates.find((p) => p.state === 'serving' && p.curryScoops > 0)
      || state.plates.find((p) => p.state === 'seated' && p.curryScoops > 0 && p.eatFrac < 0.6);
    if (target) {
      target.hasPickles = true;
      target.hop = 0.7;
      rebuildPlateModel(target);
      burstSparkles(target.wx - 2, target.wy, TABLE_Z + 5, P.pickleRed, 7, 'drop');
    }
  }

  // Deliver a filled curry plate to one of the 3 family seats!
  function deliverPlateToSeat(plate, seat) {
    if (seat.plate && seat.plate.eatFrac < 0.9) {
      // Already eating! Gently return plate to serving spot
      plate.state = 'flying';
      plate.fly = {
        sx: plate.wx, sy: plate.wy, sz: plate.wz,
        tx: SERVING_SPOT.x, ty: SERVING_SPOT.y, tz: TABLE_Z + 1,
        t: 0, dur: 0.3,
        onDone: () => {
          plate.state = 'serving';
          plate.wx = SERVING_SPOT.x;
          plate.wy = SERVING_SPOT.y;
          plate.wz = TABLE_Z + 1;
        },
      };
      FX.boing();
      return;
    }

    // Remove old empty plate if giving seconds!
    if (seat.plate) {
      state.plates = state.plates.filter((p) => p !== seat.plate);
    }

    plate.state = 'flying';
    plate.fly = {
      sx: plate.wx, sy: plate.wy, sz: plate.wz,
      tx: seat.matX + 1.2, ty: seat.matY, tz: TABLE_Z + 1,
      t: 0, dur: 0.28,
      onDone: () => {
        plate.state = 'seated';
        plate.wx = seat.matX + 1.2;
        plate.wy = seat.matY;
        plate.wz = TABLE_Z + 1;
        plate.seatId = seat.id;
        plate.hop = 0.8;
        seat.plate = plate;
        seat.mood = 'eating';
        seat.eatTimer = 0.85;
        seat.bites = 0;
        seat.bounce = 1.0;
        FX.platePlace();
        FX.happyChime(seat.id);

        // Joyful hearts & sparkles float from this family member!
        const heartCount = plate.richness >= 2.5 ? 4 : 2;
        for (let i = 0; i < heartCount; i++) {
          spawnParticle('heart', seat.wx + (Math.random() - 0.5) * 6, -30, FLOOR_Z + 26 + i * 2,
            (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 11 + Math.random() * 5, 2, '#EF4254', 1.4);
        }

        // If any family members are still waiting, pop the rice cooker and slide out a fresh rice plate!
        const anyWaiting = state.seats.some((s) => !s.plate);
        if (anyWaiting) {
          setTimeout(() => {
            if (state) spawnServingPlate(true);
          }, 420);
        } else {
          // All 3 family members have curry! Start warm celebration once they take a couple happy bites!
          setTimeout(() => {
            if (state && state.seats.every((s) => s.plate)) {
              triggerCelebration();
            }
          }, 900);
        }
      },
    };
  }

  function triggerCelebration() {
    if (state.celebrating) return;
    state.celebrating = true;
    state.celebratedOnce = true;
    FX.celebrate();
    replayBtn.classList.add('visible');
    // Spawn festive golden stars & red hearts across all 3 seats!
    for (const seat of state.seats) {
      seat.mood = 'happy';
      for (let i = 0; i < 6; i++) {
        spawnParticle(
          i % 2 === 0 ? 'heart' : 'star',
          seat.wx + (Math.random() - 0.5) * 10,
          -30 + (Math.random() - 0.5) * 6,
          FLOOR_Z + 24 + Math.random() * 8,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          14 + Math.random() * 10,
          2,
          i % 2 === 0 ? '#EF4254' : '#FFE359',
          1.9
        );
      }
    }
    // Also spawn a fresh seconds plate after a moment if she wants to keep ladling!
    setTimeout(() => {
      if (state) spawnServingPlate(false);
    }, 1800);
  }

  // Hit-testing interactive targets in CSS pixel space (generous touch radii for a 5-year-old!)
  function hitTest(cssX, cssY) {
    const scale = R.getMetrics().screenScale;
    const hitDist = (wx, wy, wz, radiusVoxels) => {
      const sp = R.worldToScreenCss(wx, wy, wz);
      const d = Math.hypot(cssX - sp.x, cssY - sp.y);
      const r = Math.max(26, radiusVoxels * scale);
      return d <= r ? d : Infinity;
    };

    const hits = [];
    const add = (kind, obj, dist, prio) => {
      if (dist < Infinity) hits.push({ kind, obj, dist, prio });
    };

    // 1. Serving plate (high priority when ready to deliver or ladle!)
    const servingPlate = state.plates.find((p) => p.state === 'serving');
    if (servingPlate) {
      add('plate', servingPlate, hitDist(servingPlate.wx, servingPlate.wy, TABLE_Z + 2, 10), servingPlate.curryScoops > 0 ? 10 : 6);
    }

    // 2. Chopped or whole veggies on cutting board
    for (const v of state.veggies) {
      if (v.state === 'whole' || v.state === 'chopped') {
        add('veggie', v, hitDist(v.wx, v.wy, COUNTER_Z + 4, 7.5), v.state === 'chopped' ? 9 : 8);
      }
    }

    // 3. Curry roux cubes on silver tray
    for (const rc of state.rouxCubes) {
      if (rc.state === 'bar' || rc.state === 'broken') {
        add('roux', rc, hitDist(rc.wx, rc.wy, COUNTER_Z + 3, 6.5), rc.state === 'broken' ? 9 : 8);
      }
    }

    // 4. Stove red knob (front-right of stove: wx=11, wy=36, wz=FLOOR_Z+10)
    add('knob', null, hitDist(11, 35.5, FLOOR_Z + 10, 6.5), 9);

    // 5. Cherry-red curry pot & ladle!
    add('pot', null, hitDist(POT_POS.x, POT_POS.y, POT_POS.z - 2, 13), 7);

    // 6. Rice cooker (wx=-35, wy=-9)
    add('cooker', null, hitDist(-35, -9, COUNTER_Z + 6, 9), 5);

    // 7. Red fukujinzuke pickle jar (wx=-40.5, wy=23.5)
    add('jar', null, hitDist(-40.5, 23.5, COUNTER_Z + 4, 6.0), 6);

    // 8. Family members & their placemats
    for (const seat of state.seats) {
      add('seat', seat, hitDist(seat.wx, -30, FLOOR_Z + 15, 10), 4);
      add('seat', seat, hitDist(seat.matX, seat.matY, TABLE_Z + 1, 9), 4);
    }

    if (hits.length === 0) return null;
    hits.sort((a, b) => (b.prio - a.prio) || (a.dist - b.dist));
    return hits[0];
  }

  // Pointer event handlers — seamless single-finger object interaction OR 360° diorama spin!
  canvas.addEventListener('pointerdown', (e) => {
    FX.unlock();
    if (activePointerId !== null) return; // Ignore second finger so multi-touch never breaks anything!
    activePointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);

    state.idleTime = 0;
    state.hintTarget = null;

    pointerStart = { x: e.clientX, y: e.clientY, time: performance.now() };
    pointerLast = { x: e.clientX, y: e.clientY };
    totalDragDist = 0;

    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) {
      // Touching empty backdrop, turntable rim, or non-interactive furniture -> spin the 3D scene smoothly!
      dragMode = 'spin';
      dragTarget = null;
      state.camVel = 0;
      canvas.classList.add('dragging-spin');
      return;
    }

    if (hit.kind === 'veggie') {
      dragMode = 'veggie';
      dragTarget = hit.obj;
    } else if (hit.kind === 'roux') {
      dragMode = 'roux';
      dragTarget = hit.obj;
    } else if (hit.kind === 'pot') {
      dragMode = 'pot';
      dragTarget = null;
    } else if (hit.kind === 'plate') {
      dragMode = 'plate';
      dragTarget = hit.obj;
    } else if (hit.kind === 'knob') {
      state.stoveHeat = (state.stoveHeat + 1) % 3;
      FX.stoveClick(state.stoveHeat);
      dragMode = null;
    } else if (hit.kind === 'cooker') {
      state.cookerTargetOpen = state.cookerTargetOpen > 0.5 ? 0 : 1;
      state.cookerBounce = 1.0;
      FX.riceCooker(state.cookerTargetOpen > 0.5);
      if (state.cookerTargetOpen > 0.5) {
        for (let i = 0; i < 6; i++) {
          spawnParticle('steam', -35 + (Math.random() - 0.5) * 6, -9 + (Math.random() - 0.5) * 6, COUNTER_Z + 10,
            (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 10 + Math.random() * 6, 2.2, '#FFFFFF', 1.2);
        }
        // If no serving plate exists yet, serve a fresh rice plate!
        spawnServingPlate(false);
      }
      dragMode = null;
    } else if (hit.kind === 'jar') {
      sprinklePickles();
      dragMode = null;
    } else if (hit.kind === 'seat') {
      const seat = hit.obj;
      // If a filled curry plate is sitting ready on the serving spot, tapping a family member delivers it straight to them!
      const readyPlate = state.plates.find((p) => p.state === 'serving' && p.curryScoops > 0);
      if (readyPlate && !seat.plate) {
        deliverPlateToSeat(readyPlate, seat);
      } else {
        // Playful bounce & spoon tap!
        seat.bounce = 1.0;
        seat.spoonTap = 1.0;
        FX.spoonTap();
        if (seat.plate && seat.plate.eatFrac < 0.9) {
          // Encouraging tap makes them take a happy bite right away!
          seat.eatTimer = 0.05;
        }
      }
      dragMode = null;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointerId) return;
    const dx = e.clientX - pointerLast.x;
    const dy = e.clientY - pointerLast.y;
    totalDragDist += Math.hypot(dx, dy);
    pointerLast = { x: e.clientX, y: e.clientY };

    if (dragMode === 'spin') {
      // Smooth 360° horizontal spin with momentum!
      const dAng = -dx * 0.009;
      state.camAngle += dAng;
      state.camVel = dAng * 0.65 + state.camVel * 0.35;
      return;
    }

    // Object dragging (once moved > 10px from touch start)
    if (totalDragDist > 10) {
      if (dragMode === 'veggie' && dragTarget) {
        const w = R.screenToWorld(e.clientX, e.clientY, COUNTER_Z + 10);
        dragTarget.state = 'dragging';
        dragTarget.wx = w.x;
        dragTarget.wy = w.y;
        dragTarget.wz = COUNTER_Z + 11;
      } else if (dragMode === 'roux' && dragTarget) {
        if (dragTarget.state === 'bar') crackRouxCube(dragTarget);
        const w = R.screenToWorld(e.clientX, e.clientY, COUNTER_Z + 10);
        dragTarget.state = 'dragging';
        dragTarget.wx = w.x;
        dragTarget.wy = w.y;
        dragTarget.wz = COUNTER_Z + 11;
      } else if (dragMode === 'plate' && dragTarget && dragTarget.curryScoops > 0) {
        const w = R.screenToWorld(e.clientX, e.clientY, TABLE_Z + 1);
        dragTarget.state = 'dragging';
        dragTarget.wx = w.x;
        dragTarget.wy = w.y;
        dragTarget.wz = TABLE_Z + 8;
      } else if (dragMode === 'pot') {
        const potScreen = R.worldToScreenCss(POT_POS.x, POT_POS.y, POT_POS.z);
        const distFromPot = Math.hypot(e.clientX - potScreen.x, e.clientY - potScreen.y);
        const scale = R.getMetrics().screenScale;

        // If curry is ready and she drags OUT of the pot toward the rice plate -> lift dripping ladle!
        const servingPlate = state.plates.find((p) => p.state === 'serving');
        if (servingPlate && isCurryReadyToLadle() && distFromPot > 15 * scale) {
          dragMode = 'ladle';
          state.ladleLifted = true;
          state.ladleFly = {
            wx: POT_POS.x, wy: POT_POS.y, wz: POT_POS.z + 6,
            rot: -0.4, hasCurry: true, autoAnim: null,
          };
          FX.stir(state.pot.rouxMelted);
        } else {
          // Stirring smoothly inside the pot!
          const ang = Math.atan2(e.clientY - potScreen.y, e.clientX - potScreen.x);
          state.pot.stirSpeed = Math.min(8, state.pot.stirSpeed + Math.hypot(dx, dy) * 0.12);
          state.pot.ladleAngle = ang - state.camAngle;
          if (performance.now() - lastStirSound > 180) {
            lastStirSound = performance.now();
            FX.stir(state.pot.rouxMelted);
          }
        }
      } else if (dragMode === 'ladle') {
        const w = R.screenToWorld(e.clientX, e.clientY, POT_POS.z + 4);
        state.ladleFly.wx = w.x;
        state.ladleFly.wy = w.y;
        state.ladleFly.wz = POT_POS.z + 6;
        // Occasional thick golden curry drip while carrying ladle!
        if (Math.random() < 0.28) {
          const cols = CU.curryColors(state.pot.rouxMelted, 1);
          spawnParticle('drop', w.x, w.y, POT_POS.z + 4, 0, 0, -4, 1.3, cols.main, 0.35);
        }
      }
    }
  });

  function finishPointer(e) {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    canvas.classList.remove('dragging-spin');

    const wasTap = totalDragDist <= 12;

    if (dragMode === 'veggie' && dragTarget) {
      const veg = dragTarget;
      if (wasTap) {
        if (veg.state === 'whole') {
          chopVeggie(veg);
        } else if (veg.state === 'chopped') {
          // Tapping a chopped veggie pile happily arcs it straight into the pot!
          tossVeggieToPot(veg);
        }
      } else if (veg.state === 'dragging') {
        // Check generous drop distance to pot!
        const dPot = Math.hypot(veg.wx - POT_POS.x, veg.wy - POT_POS.y);
        if (dPot < 26) {
          if (veg.chopped) {
            tossVeggieToPot(veg);
          } else {
            // Self-explanatory playful bounce back to board!
            bounceVeggieBack(veg);
          }
        } else {
          // Return neatly to board spot
          veg.state = veg.chopped ? 'chopped' : 'whole';
          veg.wx = veg.homeX;
          veg.wy = veg.homeY;
          veg.wz = COUNTER_Z + 2.5;
          FX.poke();
        }
      }
    } else if (dragMode === 'roux' && dragTarget) {
      const rc = dragTarget;
      if (wasTap) {
        if (rc.state === 'bar') {
          crackRouxCube(rc);
        } else if (rc.state === 'broken') {
          tossRouxToPot(rc);
        }
      } else if (rc.state === 'dragging') {
        const dPot = Math.hypot(rc.wx - POT_POS.x, rc.wy - POT_POS.y);
        if (dPot < 28) {
          tossRouxToPot(rc);
        } else {
          rc.state = 'broken';
          rc.wx = rc.homeX + (rc.id % 2 === 0 ? -0.9 : 0.9);
          rc.wy = rc.homeY + (rc.id < 2 ? -0.9 : 0.9);
          rc.wz = COUNTER_Z + 2;
          FX.poke();
        }
      }
    } else if (dragMode === 'pot') {
      if (wasTap) {
        // Tap on pot gives a joyful stir sweep + bubbles!
        state.pot.stirSpeed = Math.min(7, state.pot.stirSpeed + 4.5);
        FX.stir(state.pot.rouxMelted);
        const cols = CU.curryColors(state.pot.rouxMelted, state.pot.veggieStock);
        burstSparkles(POT_POS.x, POT_POS.y, POT_POS.z + 1, cols.hi, 4, 'drop');
      }
    } else if (dragMode === 'ladle') {
      // Check generous drop onto serving rice plate (or any seated plate for seconds!)
      const l = state.ladleFly;
      let target = state.plates.find((p) => p.state === 'serving' && Math.hypot(l.wx - p.wx, l.wy - p.wy) < 22);
      if (!target) {
        target = state.plates.find((p) => p.state === 'seated' && Math.hypot(l.wx - p.wx, l.wy - p.wy) < 16);
      }
      state.ladleLifted = false;
      if (target) {
        applyCurryToPlate(target);
      } else {
        FX.splash(state.pot.rouxMelted);
      }
    } else if (dragMode === 'plate' && dragTarget) {
      const pl = dragTarget;
      if (wasTap) {
        if (pl.curryScoops === 0) {
          // Tap empty-half rice plate -> ladle curry right onto it!
          pourCurryOntoPlate(pl);
        } else {
          // Tap filled curry plate -> deliver to the first waiting family member!
          const openSeat = state.seats.find((s) => !s.plate);
          if (openSeat) {
            deliverPlateToSeat(pl, openSeat);
          } else {
            // Everyone served -> add another generous scoop of curry!
            pourCurryOntoPlate(pl);
          }
        }
      } else if (pl.state === 'dragging') {
        // Magnetic snap to nearest family seat/placemat!
        let bestSeat = null;
        let bestD = 22;
        for (const s of state.seats) {
          const dMat = Math.hypot(pl.wx - s.matX, pl.wy - s.matY);
          const dPer = Math.hypot(pl.wx - s.wx, pl.wy - (-30));
          const d = Math.min(dMat, dPer);
          if (d < bestD) {
            bestD = d;
            bestSeat = s;
          }
        }
        if (bestSeat) {
          deliverPlateToSeat(pl, bestSeat);
        } else {
          pl.state = 'serving';
          pl.wx = SERVING_SPOT.x;
          pl.wy = SERVING_SPOT.y;
          pl.wz = TABLE_Z + 1;
          FX.platePlace();
        }
      }
    }

    dragMode = null;
    dragTarget = null;
  }

  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', finishPointer);

  // Mouse wheel / trackpad horizontal gesture gently spins the diorama on desktop too!
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    state.camVel += -d * 0.00045;
  }, { passive: false });

  replayBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    FX.unlock();
    FX.happyChime(2);
    makeInitialState(true);
  });

  // Update simulation physics, simmering, roux melting, family eating & ambient charm
  function update(dt) {
    elapsed += dt;
    state.idleTime += dt;

    // Gentle non-intrusive environmental hint ONLY after 9 seconds of inactivity (no arrows/text!)
    if (state.idleTime > 9 && !state.celebrating) {
      const pot = state.pot;
      const serving = state.plates.find((p) => p.state === 'serving');
      if (serving && serving.curryScoops > 0 && state.seats.some((s) => !s.plate)) {
        state.hintTarget = 'deliver';
      } else if (isCurryReadyToLadle() && serving && serving.curryScoops === 0) {
        state.hintTarget = 'ladle';
      } else if (pot.floatingVeggies.length > 0 && pot.rouxDropped === 0) {
        state.hintTarget = 'roux';
      } else if (state.veggies.some((v) => v.state === 'chopped')) {
        state.hintTarget = 'chopped';
      } else if (state.veggies.some((v) => v.state === 'whole')) {
        state.hintTarget = 'veggie';
      }
    }

    // Smooth inertial diorama rotation!
    if (dragMode !== 'spin') {
      state.camAngle += state.camVel;
      state.camVel *= Math.pow(0.06, dt);
      if (Math.abs(state.camVel) < 0.0002) state.camVel = 0;
    }

    // Smooth rice cooker lid & bounces
    state.cookerOpen += (state.cookerTargetOpen - state.cookerOpen) * Math.min(1, dt * 10);
    if (state.cookerBounce > 0) state.cookerBounce = Math.max(0, state.cookerBounce - dt * 3.5);
    if (state.jarBounce > 0) state.jarBounce = Math.max(0, state.jarBounce - dt * 3.5);
    if (state.knife.anim > 0) {
      state.knife.anim = Math.max(0, state.knife.anim - dt * 5.2);
      if (state.knife.anim === 0) {
        state.knife.wx += (-27 - state.knife.wx) * 0.25;
        state.knife.wy += (21 - state.knife.wy) * 0.25;
      }
    }

    // Veggie animations & parabolic flight into pot
    for (const v of state.veggies) {
      if (v.chopAnim > 0) v.chopAnim = Math.max(0, v.chopAnim - dt * 5.5);
      if (v.hop > 0) v.hop = Math.max(0, v.hop - dt * 3.5);
      if (v.state === 'flying' && v.fly) {
        v.fly.t += dt / v.fly.dur;
        const k = Math.min(1, v.fly.t);
        v.wx = v.fly.sx + (v.fly.tx - v.fly.sx) * k;
        v.wy = v.fly.sy + (v.fly.ty - v.fly.sy) * k;
        v.wz = v.fly.sz + (v.fly.tz - v.fly.sz) * k + Math.sin(k * Math.PI) * 18;
        if (k >= 1) {
          const cb = v.fly.onDone;
          v.fly = null;
          cb();
        }
      }
    }

    // Roux cube hop & flight
    for (const rc of state.rouxCubes) {
      if (rc.hop > 0) rc.hop = Math.max(0, rc.hop - dt * 3.5);
      if (rc.state === 'flying' && rc.fly) {
        rc.fly.t += dt / rc.fly.dur;
        const k = Math.min(1, rc.fly.t);
        rc.wx = rc.fly.sx + (rc.fly.tx - rc.fly.sx) * k;
        rc.wy = rc.fly.sy + (rc.fly.ty - rc.fly.sy) * k;
        rc.wz = rc.fly.sz + (rc.fly.tz - rc.fly.sz) * k + Math.sin(k * Math.PI) * 18;
        if (k >= 1) {
          const cb = rc.fly.onDone;
          rc.fly = null;
          cb();
        }
      }
    }

    // Plate hop & flight
    for (const pl of state.plates) {
      if (pl.hop > 0) pl.hop = Math.max(0, pl.hop - dt * 3.5);
      if (pl.state === 'flying' && pl.fly) {
        pl.fly.t += dt / pl.fly.dur;
        const k = Math.min(1, pl.fly.t);
        pl.wx = pl.fly.sx + (pl.fly.tx - pl.fly.sx) * k;
        pl.wy = pl.fly.sy + (pl.fly.ty - pl.fly.sy) * k;
        pl.wz = pl.fly.sz + (pl.fly.tz - pl.fly.sz) * k + Math.sin(k * Math.PI) * 12;
        if (k >= 1) {
          const cb = pl.fly.onDone;
          pl.fly = null;
          cb();
        }
      }
    }

    // Auto-ladle pouring animation
    if (state.ladleLifted && state.ladleFly.autoAnim) {
      const a = state.ladleFly.autoAnim;
      a.t += dt / a.dur;
      const pl = a.targetPlate;
      if (a.t < 0.5) {
        const k = a.t / 0.5;
        state.ladleFly.wx = POT_POS.x + (pl.wx + 1 - POT_POS.x) * k;
        state.ladleFly.wy = POT_POS.y + (pl.wy - POT_POS.y) * k;
        state.ladleFly.wz = POT_POS.z + 2 + Math.sin(k * Math.PI) * 10;
        state.ladleFly.rot = -0.5 + k * 0.8;
      } else {
        if (!a.poured) {
          a.poured = true;
          state.ladleFly.hasCurry = false;
          applyCurryToPlate(pl);
        }
        const k = Math.min(1, (a.t - 0.5) / 0.5);
        state.ladleFly.wx = (pl.wx + 1) + (POT_POS.x - (pl.wx + 1)) * k;
        state.ladleFly.wy = pl.wy + (POT_POS.y - pl.wy) * k;
        state.ladleFly.wz = POT_POS.z + 2 + Math.sin((1 - k) * Math.PI) * 8;
        state.ladleFly.rot = 0.3 - k * 0.8;
        if (k >= 1) {
          state.ladleLifted = false;
          state.ladleFly.autoAnim = null;
        }
      }
    }

    // Pot simmering, swirling, melting roux & bubbling simulation!
    const pot = state.pot;
    const heat = state.stoveHeat;
    const stirBoost = pot.stirSpeed > 0.2 ? 2.4 : 1.0;

    pot.stirAngle += (pot.stirSpeed + (heat > 0 ? 0.25 * heat : 0)) * dt;
    pot.stirSpeed *= Math.pow(0.08, dt);

    if (heat > 0 && pot.floatingVeggies.length > 0) {
      pot.veggieStock = Math.min(1, pot.veggieStock + dt * 0.08 * heat * stirBoost);
    }

    // Melt dropped roux cubes smoothly (faster when hot or stirred!)
    for (let i = pot.meltingRoux.length - 1; i >= 0; i--) {
      const m = pot.meltingRoux[i];
      const meltRate = (0.35 + heat * 0.38) * stirBoost;
      const prev = m.progress;
      m.progress = Math.min(1, m.progress + dt * meltRate);
      pot.rouxMelted = Math.min(4, pot.rouxMelted + (m.progress - prev));
      if (m.progress >= 1) {
        pot.meltingRoux.splice(i, 1);
        FX.rouxBloom(Math.round(pot.rouxMelted));
        // Delicious golden aroma puffs drift across the room toward the family!
        for (let k = 0; k < 5; k++) {
          spawnParticle('steam', POT_POS.x + (Math.random() - 0.5) * 8, POT_POS.y + (Math.random() - 0.5) * 8, POT_POS.z + 4,
            (Math.random() - 0.5) * 6, -10 - Math.random() * 6, 9 + Math.random() * 6,
            2.4, '#FCE4A6', 1.5);
        }
      }
    }

    // Simmering bubbles & rising steam clouds!
    if (heat > 0) {
      pot.simmerTime += dt;
      const bubbleRate = (heat === 2 ? 7.5 : 3.6) / (1 + pot.rouxMelted * 0.28);
      if (Math.random() < bubbleRate * dt) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 5.2;
        pot.bubbles.push({ lx: Math.cos(a) * r, ly: Math.sin(a) * r, age: 0, dur: 0.45 + pot.rouxMelted * 0.1 });
        if (Math.random() < 0.35) FX.bubble(pot.rouxMelted, heat);
      }

      const steamRate = heat === 2 ? 3.8 : 2.2;
      if (Math.random() < steamRate * dt) {
        const warmTint = pot.rouxMelted >= 2 ? '#FFF6DE' : '#FFFFFF';
        spawnParticle(
          'steam',
          POT_POS.x + (Math.random() - 0.5) * 8,
          POT_POS.y + (Math.random() - 0.5) * 8,
          POT_POS.z + 5,
          (Math.random() - 0.5) * 2.5,
          pot.rouxMelted >= 2 ? -3.5 : (Math.random() - 0.5) * 2.5,
          10 + heat * 3 + Math.random() * 3,
          1.2 + Math.random() * 0.8,
          warmTint,
          1.2 + Math.random() * 0.45
        );
      }
    } else if (Math.random() < 0.6 * dt) {
      // Gentle idle steam wisp from warm rice cooker!
      spawnParticle('steam', -35 + (Math.random() - 0.5) * 3, -9 + (Math.random() - 0.5) * 3, COUNTER_Z + 12,
        (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 6 + Math.random() * 3, 1.4, '#FFFFFF', 1.1);
    }

    for (let i = pot.bubbles.length - 1; i >= 0; i--) {
      pot.bubbles[i].age += dt / pot.bubbles[i].dur;
      if (pot.bubbles[i].age >= 1) pot.bubbles.splice(i, 1);
    }

    // Family member eating & delight animations!
    for (const seat of state.seats) {
      if (seat.bounce > 0) seat.bounce = Math.max(0, seat.bounce - dt * 2.8);
      if (seat.spoonTap > 0) seat.spoonTap = Math.max(0, seat.spoonTap - dt * 2.4);

      if (seat.mood === 'eating' && seat.plate) {
        seat.eatTimer -= dt;
        if (seat.eatTimer <= 0) {
          seat.bites++;
          seat.spoonTap = 1.0;
          seat.bounce = 0.85;
          FX.bite(seat.bites - 1);
          seat.plate.eatFrac = Math.min(1, seat.bites * 0.25);
          rebuildPlateModel(seat.plate);

          spawnParticle('heart', seat.wx + (Math.random() - 0.5) * 6, -30, FLOOR_Z + 25,
            (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 10, 2, '#EF4254', 1.15);

          if (seat.bites >= 4) {
            seat.mood = 'happy';
            FX.happyChime(seat.id);
            burstSparkles(seat.wx, -30, FLOOR_Z + 26, '#FFE359', 5, 'star');
          } else {
            seat.eatTimer = 1.15 + Math.random() * 0.35;
          }
        }
      }
    }

    // Update particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      pt.vz += pt.gravity * dt;
      pt.wx += pt.vx * dt;
      pt.wy += pt.vy * dt;
      pt.wz += pt.vz * dt;
      if (pt.kind === 'steam') {
        pt.size += dt * 0.85;
        pt.alpha = (pt.life / pt.maxLife) * 0.85;
      } else {
        pt.alpha = Math.min(1, (pt.life / pt.maxLife) * 1.6);
      }
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    R.render(canvas, models, state, elapsed);
    requestAnimationFrame(frame);
  }

  // Expose minimal debug hook strictly for automated screenshot verification (zero visual UI impact)
  window.__CURRY_DEBUG = {
    getState: () => state,
    setAngle: (a) => { state.camAngle = a; state.camVel = 0; },
    demoMidCook: () => {
      // Chop all 4 veggies into pot + drop 3 roux cubes + ignite stove + ladle 1 plate + serve 2 seats
      state.veggies.forEach((v) => { v.chops = 3; v.chopped = true; landVeggieInPot(v); });
      state.rouxCubes.forEach((rc, i) => {
        if (i < 3) { rc.state = 'inPot'; state.pot.rouxDropped++; }
      });
      state.pot.rouxMelted = 3.6;
      state.pot.veggieStock = 1;
      state.stoveHeat = 2;
      // Put rich curry on serving plate AND serve Mama & Papa
      const sp = state.plates.find((p) => p.state === 'serving');
      if (sp) {
        sp.curryScoops = 2;
        sp.richness = 3.8;
        sp.veggies = ['carrot', 'potato', 'onion', 'broccoli'];
        sp.hasPickles = true;
        rebuildPlateModel(sp);
      }
    },
    demoServedFeast: () => {
      // Keep 2 colorful veggies (carrot & broccoli) visible on cutting board + 1 chopped potato pile for rich storytelling!
      state.veggies.forEach((v, idx) => {
        if (idx === 1) { v.chops = 3; v.chopped = true; v.state = 'chopped'; }
        else if (idx === 2) { v.chops = 3; v.chopped = true; landVeggieInPot(v); }
      });
      // Add all 4 colors to floating veggies so the simmering pot looks mouth-watering!
      ['carrot', 'potato', 'onion', 'broccoli', 'carrot', 'broccoli'].forEach((t, i) => {
        if (!state.pot.veggieTypes.includes(t)) state.pot.veggieTypes.push(t);
        state.pot.floatingVeggies.push({
          type: t,
          angle: i * 1.05 + 0.3,
          dist: 2.2 + (i % 3) * 1.7,
          phase: i * 1.1,
        });
      });
      state.pot.rouxMelted = 3.9;
      state.pot.veggieStock = 1;
      state.stoveHeat = 2;
      // Leave 2 roux cubes neatly visible on the silver tray!
      state.rouxCubes[0].state = 'inPot';
      state.rouxCubes[1].state = 'inPot';
      state.plates = [];
      state.seats.forEach((seat) => {
        const pl = {
          id: state.nextPlateId++,
          wx: seat.matX + 1.2,
          wy: seat.matY,
          wz: TABLE_Z + 1,
          state: 'seated',
          hasRice: true,
          curryScoops: 2,
          richness: 3.9,
          veggies: ['carrot', 'potato', 'onion', 'broccoli'],
          hasPickles: true,
          eatFrac: 0,
          hop: 0,
          seatId: seat.id,
        };
        rebuildPlateModel(pl);
        state.plates.push(pl);
        seat.plate = pl;
        seat.mood = 'waiting'; // Warm smiling seated pose matching ref_front_iso.jpg!
      });
      // Delicate airy steam puffs floating WELL ABOVE the pot rim & rice cooker (never hiding the curry!)
      state.particles = [];
      spawnParticle('steam', POT_POS.x - 2, POT_POS.y, POT_POS.z + 9, 0, -1, 4, 1.8, '#FFFFFF', 2.0);
      spawnParticle('steam', POT_POS.x + 2, POT_POS.y - 1, POT_POS.z + 15, 0, -1, 4, 2.1, '#FFFDF5', 2.0);
      spawnParticle('steam', POT_POS.x - 1, POT_POS.y + 1, POT_POS.z + 21, 0, -1, 3, 1.4, '#FFFFFF', 2.0);
      spawnParticle('steam', -35, -9, COUNTER_Z + 15, 0, 0, 3, 1.5, '#FFFFFF', 2.0);
      spawnParticle('steam', -35, -10, COUNTER_Z + 20, 0, 0, 3, 1.1, '#FFFFFF', 2.0);
    },
  };

  window.addEventListener('resize', () => R.resize(canvas));
  makeInitialState(false);
  R.resize(canvas);
  requestAnimationFrame(frame);
})();
