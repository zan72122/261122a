// Tactile Web Audio synthesizer for Papercraft Cookie Making (zero external audio files)

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.lastRollTime = 0;
    this.lastIcingTime = 0;
    this.lastClickTime = 0;
    this.noteIdx = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this._buildNoiseBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _buildNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 1.5;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.08 * white) / 1.08;
      data[i] = white * 0.55 + last * 1.6;
    }
    this.noiseBuffer = buffer;
  }

  _now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  playPaperRustle(intensity = 0.5, pitch = 1.0) {
    if (!this.ctx || !this.noiseBuffer) return;
    const t = this._now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400 * pitch, t);
    filter.frequency.exponentialRampToValueAtTime(2400 * pitch, t + 0.09);
    filter.Q.value = 1.8;

    const gain = this.ctx.createGain();
    const vol = Math.min(0.22, 0.07 + intensity * 0.14);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t, Math.random() * 0.8, 0.16);
  }

  playRollTick(speed = 0.5) {
    if (!this.ctx || !this.noiseBuffer) return;
    const t = this._now();
    if (t - this.lastRollTime < 0.075) return;
    this.lastRollTime = t;

    // Soft wooden rolling thud
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const baseFreq = 115 + Math.min(speed, 1.5) * 65 + (Math.random() - 0.5) * 18;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, t + 0.07);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.08 + Math.min(speed, 1) * 0.06, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.09);

    // Subtle paper-flour whisper
    this.playPaperRustle(0.35 + speed * 0.25, 0.9 + speed * 0.3);
  }

  playShake(flavorIdx = 0) {
    if (!this.ctx) return;
    const t = this._now();
    for (let i = 0; i < 4; i++) {
      const delay = i * 0.045;
      if (this.noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 2600 + i * 350;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.001, t + delay);
        g.gain.linearRampToValueAtTime(0.11, t + delay + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.055);
        src.connect(f);
        f.connect(g);
        g.connect(this.ctx.destination);
        src.start(t + delay, Math.random() * 0.6, 0.06);
      }
    }
    const base = PENTATONIC[(flavorIdx * 2) % PENTATONIC.length];
    this._playPluck(base, t + 0.03, 0.14, 0.18);
    this._playPluck(base * 1.25, t + 0.1, 0.12, 0.18);
  }

  playCutStamp() {
    if (!this.ctx) return;
    const t = this._now();
    // Crisp paper snip + dough press thump
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(88, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.24, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.11);

    this.playPaperRustle(0.9, 1.35);

    // Cheerful pop as cookie lifts out
    const note = PENTATONIC[this.noteIdx % 5];
    this.noteIdx++;
    this._playPluck(note, t + 0.065, 0.17, 0.24);
  }

  playPop(index = null) {
    if (!this.ctx) return;
    const t = this._now();
    const idx = index !== null ? index : this.noteIdx++;
    const freq = PENTATONIC[Math.abs(idx) % PENTATONIC.length];
    this._playPluck(freq, t, 0.17, 0.22);
  }

  playBouncingCrumb() {
    if (!this.ctx) return;
    const t = this._now();
    const freq = 340 + Math.random() * 140;
    this._playPluck(freq, t, 0.09, 0.1);
    this.playPaperRustle(0.22, 1.5);
  }

  playDialClick(step = 0) {
    if (!this.ctx) return;
    const t = this._now();
    if (t - this.lastClickTime < 0.04) return;
    this.lastClickTime = t;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const freq = 520 + (step % 8) * 55;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.035);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.045);
  }

  playOvenWarmPulse() {
    if (!this.ctx) return;
    const t = this._now();
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(293.66, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.21);
  }

  playOvenDing() {
    if (!this.ctx) return;
    const t = this._now();
    const partials = [
      { f: 1174.66, vol: 0.22, dec: 1.1 },
      { f: 2349.32, vol: 0.11, dec: 0.7 },
      { f: 3520.0, vol: 0.055, dec: 0.45 },
      { f: 1760.0, vol: 0.08, dec: 0.85 },
    ];
    for (const p of partials) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.f, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(p.vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0008, t + p.dec);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + p.dec + 0.02);
    }
  }

  playIcingSquish(speed = 0.5) {
    if (!this.ctx) return;
    const t = this._now();
    if (t - this.lastIcingTime < 0.055) return;
    this.lastIcingTime = t;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const f0 = 320 + Math.min(speed, 1.5) * 240 + Math.random() * 45;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.18, t + 0.045);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.065, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.065);
  }

  playBoxFold() {
    if (!this.ctx) return;
    const t = this._now();
    this.playPaperRustle(0.95, 0.82);
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(165, t + 0.02);
    osc.frequency.exponentialRampToValueAtTime(74, t + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t + 0.02);
    osc.stop(t + 0.16);
  }

  playRibbonBloom() {
    if (!this.ctx) return;
    const t = this._now();
    this.playPaperRustle(0.7, 1.4);
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((f, i) => {
      this._playPluck(f, t + i * 0.065, 0.15, 0.42);
    });
  }

  playCelebration() {
    if (!this.ctx) return;
    const t = this._now();
    const melody = [
      { f: 523.25, dt: 0.0 },
      { f: 659.25, dt: 0.09 },
      { f: 783.99, dt: 0.18 },
      { f: 1046.5, dt: 0.28 },
      { f: 880.0, dt: 0.40 },
      { f: 1046.5, dt: 0.50 },
      { f: 1318.51, dt: 0.62 },
    ];
    for (const m of melody) {
      this._playPluck(m.f, t + m.dt, 0.16, 0.48);
    }
    this.playPaperRustle(0.8, 1.2);
  }

  _playPluck(freq, startTime, volume, duration) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    const overtone = this.ctx.createOscillator();
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(freq * 2, startTime);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, startTime);
    g.gain.linearRampToValueAtTime(volume, startTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(volume * 0.28, startTime);
    g2.gain.exponentialRampToValueAtTime(0.0008, startTime + duration * 0.5);

    osc.connect(g);
    overtone.connect(g2);
    g2.connect(g);
    g.connect(this.ctx.destination);

    osc.start(startTime);
    overtone.start(startTime);
    osc.stop(startTime + duration + 0.02);
    overtone.stop(startTime + duration + 0.02);
  }
}
