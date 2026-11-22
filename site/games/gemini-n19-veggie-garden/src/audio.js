/**
 * Tactile Web Audio synthesizer for wooden building blocks, water,
 * harvesting pops, chopping, tossing salad, and joyful marimba notes.
 * Zero external audio files. Safe for iOS Safari unlock on first touch.
 */
const PENTATONIC = [
  261.63, 293.66, 329.63, 392.00, 440.00,
  523.25, 587.33, 659.25, 783.99, 880.00,
  1046.50,
];

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.streamNode = null;
    this.streamGain = null;
    this.streamFilter = null;
    this.unlocked = false;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this._createNoiseBuffer();
      this._setupWaterStream();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
  }

  _createNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 1.5;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.18) * 0.65;
    }
    this.noiseBuffer = buf;
  }

  _setupWaterStream() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 950;
    filter.Q.value = 1.4;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();

    this.streamNode = src;
    this.streamFilter = filter;
    this.streamGain = gain;
  }

  setWaterStream(active, intensity = 1.0, pitchHz = 950) {
    if (!this.ctx || !this.streamGain) return;
    const now = this.ctx.currentTime;
    const target = active ? Math.min(0.24, 0.14 * intensity) : 0.0001;
    this.streamGain.gain.setTargetAtTime(target, now, 0.06);
    this.streamFilter.frequency.setTargetAtTime(pitchHz, now, 0.08);
  }

  playMarimba(index = 0, volume = 0.34, duration = 0.28) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freq = PENTATONIC[((index % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length];

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    // Subtle wooden overtone click
    const over = this.ctx.createOscillator();
    over.type = 'sine';
    over.frequency.setValueAtTime(freq * 4, now);

    const g1 = this.ctx.createGain();
    g1.gain.setValueAtTime(0.001, now);
    g1.gain.linearRampToValueAtTime(volume, now + 0.008);
    g1.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(volume * 0.22, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(g1);
    over.connect(g2);
    g1.connect(this.master);
    g2.connect(this.master);

    osc.start(now);
    over.start(now);
    osc.stop(now + duration + 0.02);
    over.stop(now + 0.06);
  }

  playWaterDrop(pitch = 1.0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const base = (480 + Math.random() * 240) * pitch;
    osc.frequency.setValueAtTime(base * 0.72, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.48, now + 0.075);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playGrowthPop(stage = 0) {
    if (!this.ctx) return;
    this.playMarimba(stage + 2, 0.36, 0.3);
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220 + stage * 80, now);
    osc.frequency.exponentialRampToValueAtTime(560 + stage * 110, now + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playPop(pitch = 1.0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(860 * pitch, now + 0.065);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playSnap() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Crisp vegetable snap (short filtered noise burst + woody knock)
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 1900;
    filt.Q.value = 2.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(now);
    src.stop(now + 0.075);

    this.playMarimba(4, 0.25, 0.16);
  }

  playUproot() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Juicy carrot boing-pop!
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.22);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.38, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.26);

    // Little soil rustle
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 700;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.28, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    src.connect(filt);
    filt.connect(ng);
    ng.connect(this.master);
    src.start(now);
    src.stop(now + 0.14);
  }

  playBasketThud(count = 1) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.1);

    this.playMarimba((count - 1) % 8, 0.3, 0.25);
  }

  playSplash(intensity = 1.0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(1400, now);
    filt.frequency.exponentialRampToValueAtTime(600, now + 0.18);
    filt.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28 * Math.min(1.4, intensity), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(now);
    src.stop(now + 0.22);
    this.playWaterDrop(1.1);
  }

  playBubblePop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const f = 700 + Math.random() * 500;
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.9, now + 0.045);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playSparkleClean() {
    if (!this.ctx) return;
    [5, 7, 9].forEach((note, idx) => {
      setTimeout(() => this.playMarimba(note, 0.28, 0.32), idx * 65);
    });
  }

  playChop(step = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Wooden cutting board *TON!*
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320 + step * 30, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.06);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.42, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.08);

    // Crisp veggie slice crunch
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 1800;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.24, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    src.connect(filt);
    filt.connect(ng);
    ng.connect(this.master);
    src.start(now);
    src.stop(now + 0.065);
  }

  playSqueeze() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playShaker() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.07;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 3200 + i * 400;
      filt.Q.value = 2.0;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.26, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(filt);
      filt.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + 0.06);
    }
  }

  playToss() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 2400;
    filt.Q.value = 1.4;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(now);
    src.stop(now + 0.12);

    this.playMarimba(Math.floor(Math.random() * 6) + 2, 0.18, 0.14);
  }

  playBell() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [1046.5, 2093.0, 3135.96, 4186.0];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      const g = this.ctx.createGain();
      const vol = 0.24 / (idx + 1);
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 0.9 - idx * 0.15);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.95);
    });
  }

  playCrunchBite() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.075;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 2200 + i * 350;
      filt.Q.value = 1.6;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.36, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
      src.connect(filt);
      filt.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + 0.065);
    }
    this.playMarimba(5 + Math.floor(Math.random() * 4), 0.25, 0.2);
  }

  playPinwheelClick(pitchStep = 0) {
    this.playMarimba(4 + (pitchStep % 6), 0.2, 0.12);
  }

  playSlideDoor() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(420, now);
    filt.frequency.linearRampToValueAtTime(680, now + 0.35);
    filt.Q.value = 1.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(now);
    src.stop(now + 0.42);
  }

  playFanfare() {
    if (!this.ctx) return;
    const notes = [0, 2, 4, 5, 7, 10];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playMarimba(n, 0.32, 0.42), idx * 85);
    });
  }
}
