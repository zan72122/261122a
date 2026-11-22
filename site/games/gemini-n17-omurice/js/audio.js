// Procedural tactile Web Audio synthesizer for stop-motion clay cooking

class ClayAudio {
  constructor() {
    this.ctx = null;
    this.unlocked = false;
    this.sizzleGain = null;
    this.sizzleFilter = null;
    this.noiseBuffer = null;
    this.lastDrawSoundTime = 0;
    this.lastStirSoundTime = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this._createNoiseBuffer();
      this._initSizzleLoop();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.unlocked = true;
  }

  _createNoiseBuffer() {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate;
    const len = sr * 2;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    // Warm pink-ish noise
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.16) * 0.9;
    }
    this.noiseBuffer = buf;
  }

  _initSizzleLoop() {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3400;
    filter.Q.value = 0.9;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();

    this.sizzleFilter = filter;
    this.sizzleGain = gain;
  }

  setSizzle(intensity = 0) {
    if (!this.ctx || !this.sizzleGain || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, intensity));
    const targetGain = clamped * 0.085;
    this.sizzleGain.gain.setTargetAtTime(Math.max(0.0001, targetGain), now, 0.08);
    this.sizzleFilter.frequency.setTargetAtTime(2400 + clamped * 2600, now, 0.1);
  }

  playClaySquish(pitch = 1.0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(115 * pitch, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(160 * pitch, now + 0.16);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playPop(pitch = 1.0, vol = 0.2) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(640 * pitch, now + 0.075);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playKetchupSquirt(pitch = 1.0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Funny bubbly bottle squeeze tone
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(135 * pitch, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(290 * pitch, now + 0.16);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.setValueAtTime(650 * pitch, now);
    lp.Q.value = 3.2;

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.26, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    osc.connect(lp);
    lp.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);

    // Soft air puff
    if (this.noiseBuffer) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1100 * pitch;
      f.Q.value = 2.0;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.14, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      n.connect(f);
      f.connect(ng);
      ng.connect(this.ctx.destination);
      n.start(now);
      n.stop(now + 0.15);
    }
  }

  playKetchupDrawTick(speed = 1.0, isMayo = false) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastDrawSoundTime < 0.075) return;
    this.lastDrawSoundTime = now;

    const base = isMayo ? 360 : 270;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const jitter = 0.9 + Math.random() * 0.22;
    const freq = (base + Math.min(180, speed * 90)) * jitter;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.72, now + 0.06);

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.11, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  playSpatulaStir() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStirSoundTime < 0.11) return;
    this.lastStirSoundTime = now;

    // Warm woody clack
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    const base = 240 + Math.random() * 90;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 0.55, now + 0.055);

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playStoveClick(level) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Chunky clay dial click
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220 + level * 80, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.04);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);

    // Warm flame puff
    if (this.noiseBuffer && level > 0) {
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(500 + level * 350, now);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.001, now);
      ng.gain.linearRampToValueAtTime(0.14 * level * 0.6, now + 0.04);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      n.connect(f);
      f.connect(ng);
      ng.connect(this.ctx.destination);
      n.start(now);
      n.stop(now + 0.27);
    }
  }

  playEggCrack() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Tap-crack
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.045);
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);

    // Wet plop into pan shortly after
    const plop = this.ctx.createOscillator();
    const pg = this.ctx.createGain();
    plop.type = 'sine';
    plop.frequency.setValueAtTime(160, now + 0.14);
    plop.frequency.exponentialRampToValueAtTime(340, now + 0.23);
    pg.gain.setValueAtTime(0.001, now + 0.14);
    pg.gain.linearRampToValueAtTime(0.22, now + 0.16);
    pg.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    plop.connect(pg);
    pg.connect(this.ctx.destination);
    plop.start(now + 0.14);
    plop.stop(now + 0.29);
  }

  playButterMelt() {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(2800, now);
    f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    n.connect(f);
    f.connect(g);
    g.connect(this.ctx.destination);
    n.start(now);
    n.stop(now + 0.46);
  }

  playFlipWhoosh() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.26);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.44);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.2, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  playBell() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [1174.66, 2349.32, 3520];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      const amp = 0.22 / (idx + 1);
      g.gain.setValueAtTime(amp, now);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 1.1 / (idx * 0.5 + 1));
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.15);
    });
  }

  playWipe() {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(900, now);
    f.frequency.linearRampToValueAtTime(1800, now + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    n.connect(f);
    f.connect(g);
    g.connect(this.ctx.destination);
    n.start(now);
    n.stop(now + 0.22);
  }

  playChew(memberIdx = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const base = [180, 260, 380][memberIdx % 3];
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.14;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * 1.45, t + 0.05);
      osc.frequency.exponentialRampToValueAtTime(base * 0.8, t + 0.1);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);
    }
  }

  playFamilyHappy(memberIdx = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Distinct warm marimba melodies per family member
    const chords = [
      [261.6, 329.6, 392.0, 523.2], // Papa: warm resonant C major
      [523.2, 659.3, 784.0, 1046.5], // Mama: cozy bright chime
      [587.3, 784.0, 880.0, 1174.7], // Little sibling: playful bouncy sparkle
    ];
    const notes = chords[memberIdx % 3];
    notes.forEach((freq, i) => {
      const t = now + i * 0.085;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = memberIdx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  playStageDone() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const t = now + i * 0.095;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.15, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }
}

export const audio = new ClayAudio();
