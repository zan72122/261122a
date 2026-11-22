/**
 * Realistic procedural Web Audio synthesizer for cordless cyclonic vacuum & living-room foley.
 * Unlocks cleanly on first pointer/touch event for iOS Safari / iPadOS.
 */
export class VacuumAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.motorGain = null;
    this.airFilter = null;
    this.humOsc = null;
    this.whineOsc = null;
    this.whineGain = null;
    this.noiseBuffer = null;
    this.isReady = false;
    this.targetMotor = 0;
    this.currentMotor = 0;
    this.lastSandTime = 0;
    this.lastCrumbTime = 0;
    this.lastPaperTime = 0;
  }

  unlock() {
    if (this.isReady) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(this.ctx.destination);

      // Generate 2-second smooth pink-ish noise buffer for realistic airflow & debris foley
      const sampleRate = this.ctx.sampleRate;
      const len = sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, len, sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
        b6 = white * 0.115926;
      }

      // Continuous motor bus
      this.motorGain = this.ctx.createGain();
      this.motorGain.gain.value = 0.0001;
      this.motorGain.connect(this.master);

      // Layer 1: Airflow rushing through nozzle & cyclone chamber
      const airSrc = this.ctx.createBufferSource();
      airSrc.buffer = this.noiseBuffer;
      airSrc.loop = true;

      this.airFilter = this.ctx.createBiquadFilter();
      this.airFilter.type = 'bandpass';
      this.airFilter.frequency.value = 540;
      this.airFilter.Q.value = 0.75;

      const airGain = this.ctx.createGain();
      airGain.gain.value = 0.65;
      airSrc.connect(this.airFilter);
      this.airFilter.connect(airGain);
      airGain.connect(this.motorGain);
      airSrc.start();

      // Layer 2: Warm low-mid cordless motor body hum
      this.humOsc = this.ctx.createOscillator();
      this.humOsc.type = 'sawtooth';
      this.humOsc.frequency.value = 118;
      const humFilter = this.ctx.createBiquadFilter();
      humFilter.type = 'lowpass';
      humFilter.frequency.value = 340;
      const humGain = this.ctx.createGain();
      humGain.gain.value = 0.16;
      this.humOsc.connect(humFilter);
      humFilter.connect(humGain);
      humGain.connect(this.motorGain);
      this.humOsc.start();

      // Layer 3: Gentle modern brushless turbine harmonic (soft & pleasant, never shrill)
      this.whineOsc = this.ctx.createOscillator();
      this.whineOsc.type = 'sine';
      this.whineOsc.frequency.value = 580;
      this.whineGain = this.ctx.createGain();
      this.whineGain.gain.value = 0.045;
      this.whineOsc.connect(this.whineGain);
      this.whineGain.connect(this.motorGain);
      this.whineOsc.start();

      this.isReady = true;
    } catch {
      this.isReady = false;
    }
  }

  /**
   * Smoothly modulates vacuum motor tone based on active suction, surface (wood vs rug),
   * dust-cup fullness, and movement speed!
   */
  updateMotor(dt, { active = false, onRug = false, fillRatio = 0, speed = 0 } = {}) {
    if (!this.isReady || !this.ctx) return;

    this.targetMotor = active ? 0.52 + Math.min(0.18, speed * 0.12) : 0.0;
    const rate = active ? 8.5 : 5.0;
    this.currentMotor += (this.targetMotor - this.currentMotor) * Math.min(1, dt * rate);

    const now = this.ctx.currentTime;
    this.motorGain.gain.setTargetAtTime(Math.max(0.0001, this.currentMotor), now, 0.035);

    // Real acoustic cue: muffled lower tone on plush rug or as dust cup fills up!
    const fillDrop = fillRatio * 130;
    const rugDrop = onRug ? 110 : 0;
    const targetAirFreq = Math.max(240, 620 - rugDrop - fillDrop + Math.min(140, speed * 90));
    const targetHumFreq = Math.max(88, 124 - fillRatio * 20 - (onRug ? 8 : 0) + Math.min(14, speed * 9));
    const targetWhineFreq = Math.max(410, 595 - fillRatio * 95 - (onRug ? 35 : 0) + Math.min(60, speed * 40));

    this.airFilter.frequency.setTargetAtTime(targetAirFreq, now, 0.06);
    this.humOsc.frequency.setTargetAtTime(targetHumFreq, now, 0.06);
    this.whineOsc.frequency.setTargetAtTime(targetWhineFreq, now, 0.06);
  }

  /**
   * Plays tactile real-world suction sounds when breadcrumbs, sand, or paper enter the wand & dust cup!
   */
  playDebrisSuck(type) {
    if (!this.isReady || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (type === 'sand') {
      // Crisp micro-grit crackle (rate-limited for natural granular stream)
      if (now - this.lastSandTime < 0.028) return;
      this.lastSandTime = now;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2600 + Math.random() * 1900;
      bp.Q.value = 3.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.28 + Math.random() * 0.14, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(now, Math.random() * 1.4, 0.05);
      return;
    }

    if (type === 'crumb') {
      // Hollow resonant tube *tik-pok* as dry breadcrumb rattles up the aluminum wand into the acrylic cup!
      if (now - this.lastCrumbTime < 0.042) return;
      this.lastCrumbTime = now;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      const f0 = 760 + Math.random() * 480;
      osc.frequency.setValueAtTime(f0, now);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.52, now + 0.045);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.22, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.052);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.055);
      return;
    }

    if (type === 'coin') {
      // Crisp metallic *plink-clink!* rattling up the aluminum wand into the clear polycarbonate cup!
      const freqs = [2450, 3180];
      freqs.forEach((f, i) => {
        const d = i * 0.048;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f + Math.random() * 140, now + d);
        osc.frequency.exponentialRampToValueAtTime(f * 0.92, now + d + 0.14);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.001, now + d);
        g.gain.linearRampToValueAtTime(0.16, now + d + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0008, now + d + 0.16);
        osc.connect(g);
        g.connect(this.master);
        osc.start(now + d);
        osc.stop(now + d + 0.17);
      });
      return;
    }

    if (type === 'paper') {
      // Crisp papery *fwoop-flp* flutter into the nozzle!
      if (now - this.lastPaperTime < 0.065) return;
      this.lastPaperTime = now;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1400 + Math.random() * 500, now);
      bp.frequency.exponentialRampToValueAtTime(480, now + 0.095);
      bp.Q.value = 1.6;

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.36, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(now, Math.random() * 1.2, 0.12);
    }
  }

  /**
   * Mechanical red latch *clack* when opening the transparent dust cup!
   */
  playLatchClick() {
    if (!this.isReady || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.032);
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  /**
   * Cascading rustle & patter of debris pouring from the cup into the rattan wastebasket!
   */
  playDumpCascade(count = 20) {
    if (!this.isReady || !this.ctx) return;
    const now = this.ctx.currentTime;
    const taps = Math.min(18, Math.max(5, Math.floor(count * 0.45)));
    for (let i = 0; i < taps; i++) {
      const delay = 0.06 + i * 0.034 + Math.random() * 0.025;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 950 + Math.random() * 1600;
      bp.Q.value = 2.0;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now + delay);
      g.gain.linearRampToValueAtTime(0.18 + Math.random() * 0.1, now + delay + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.065);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(now + delay, Math.random() * 1.4, 0.08);
    }
  }

  /**
   * Crisp *snap* when closing the emptied dust cup lid!
   */
  playLidSnap() {
    if (!this.isReady || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.045);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Flaky pastry crunch when tapping the croissant on the coffee table to drop fresh crumbs!
   */
  playCroissantCrunch() {
    if (!this.isReady || !this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const d = i * 0.038;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800 + Math.random() * 1400;
      bp.Q.value = 2.4;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now + d);
      g.gain.linearRampToValueAtTime(0.22, now + d + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, now + d + 0.055);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(now + d, Math.random() * 1.3, 0.07);
    }
  }

  /**
   * Gentle rustling leaves when tapping the potted living-room plant!
   */
  playPlantRustle() {
    if (!this.isReady || !this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2200, now);
    bp.frequency.exponentialRampToValueAtTime(1100, now + 0.22);
    bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now, Math.random() * 1.1, 0.28);
  }

  /**
   * Hollow woven rattan knock when tapping the empty wicker wastebasket!
   */
  playBasketKnock() {
    if (!this.isReady || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(290, now);
    osc.frequency.exponentialRampToValueAtTime(145, now + 0.065);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  /**
   * Soft muffled leather-cushion thump when tapping the sofa!
   */
  playSofaThump() {
    if (!this.isReady || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.11);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /**
   * Gentle warm acoustic marimba/chime chord celebrating a spotless sunlit living room!
   */
  playCleanChime() {
    if (!this.isReady || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // Warm C major sunlit arpeggio
    notes.forEach((freq, idx) => {
      const d = idx * 0.11;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now + d);
      g.gain.linearRampToValueAtTime(0.11, now + d + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0001, now + d + 1.15);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + d);
      osc.stop(now + d + 1.2);
    });
  }
}
