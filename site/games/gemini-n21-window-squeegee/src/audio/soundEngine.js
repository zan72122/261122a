/**
 * Procedural Web Audio Foley Engine for realistic household window-cleaning acoustics.
 * Zero external files; unlocks gracefully on first user gesture.
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.squeegeeNodes = null;
    this.ambientGain = null;
    this.unlocked = false;
    this._squeegeeGainVal = 0;
    this._squeegeeTargetGain = 0;
    this._squeegeeTargetFreq = 1150;
    this._lastChirpTime = 0;
  }

  unlock() {
    if (this.unlocked && this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.unlocked = true;

    // Generate 2-second white noise buffer for mist, water glide, steam & rustle
    const sampleRate = this.ctx.sampleRate;
    const len = sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, len, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this._initContinuousSqueegee();
    this._initGardenAmbience();
  }

  _initContinuousSqueegee() {
    const ctx = this.ctx;
    // Layer 1: Wet rubber glide hiss (bandpass-filtered noise)
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;
    noiseSrc.loop = true;

    const glideFilter = ctx.createBiquadFilter();
    glideFilter.type = 'bandpass';
    glideFilter.frequency.value = 1850;
    glideFilter.Q.value = 1.8;

    const glideGain = ctx.createGain();
    glideGain.gain.value = 0.0;

    noiseSrc.connect(glideFilter).connect(glideGain).connect(ctx.destination);
    noiseSrc.start();

    // Layer 2: Authentic subtle rubber-on-glass resonant squeak harmonic
    const squeakOsc = ctx.createOscillator();
    squeakOsc.type = 'triangle';
    squeakOsc.frequency.value = 1180;

    const squeakFilter = ctx.createBiquadFilter();
    squeakFilter.type = 'bandpass';
    squeakFilter.frequency.value = 1280;
    squeakFilter.Q.value = 9.0;

    const squeakGain = ctx.createGain();
    squeakGain.gain.value = 0.0;

    squeakOsc.connect(squeakFilter).connect(squeakGain).connect(ctx.destination);
    squeakOsc.start();

    this.squeegeeNodes = { glideFilter, glideGain, squeakOsc, squeakFilter, squeakGain };
  }

  _initGardenAmbience() {
    const ctx = this.ctx;
    // Soft quiet sunlit breeze rustle that opens up subtly as the window becomes crystal clear
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 480;

    const gain = ctx.createGain();
    gain.gain.value = 0.004;

    src.connect(filt).connect(gain).connect(ctx.destination);
    src.start();
    this.ambientGain = gain;
  }

  /** Trigger bottle mechanical click + pressurized foamy spray 'pshht!' */
  playSprayBurst() {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // 1. Crisp plastic trigger click
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(520, now);
    clickOsc.frequency.exponentialRampToValueAtTime(160, now + 0.025);
    clickGain.gain.setValueAtTime(0.08, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    clickOsc.connect(clickGain).connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.035);

    // 2. Pressurized foam nozzle spray hiss
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(4200, now);
    bp.frequency.exponentialRampToValueAtTime(2200, now + 0.19);
    bp.Q.value = 1.1;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1350;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.13);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    src.connect(bp).connect(hp).connect(gain).connect(ctx.destination);
    src.start(now, Math.random() * 0.8, 0.26);

    // 3. Soft bubbly fizzle settle
    const fizz = ctx.createBufferSource();
    fizz.buffer = this.noiseBuffer;
    const fbp = ctx.createBiquadFilter();
    fbp.type = 'highpass';
    fbp.frequency.value = 5400;
    const fgain = ctx.createGain();
    fgain.gain.setValueAtTime(0.001, now + 0.08);
    fgain.gain.linearRampToValueAtTime(0.028, now + 0.15);
    fgain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    fizz.connect(fbp).connect(fgain).connect(ctx.destination);
    fizz.start(now + 0.08, Math.random() * 0.6, 0.38);
  }

  /** Modulate live squeegee rubber glide & squeak from blade speed and wetness */
  setSqueegeeMotion(speed, isWet, hasFoam) {
    if (!this.squeegeeNodes || !this.ctx) return;
    const normSpeed = Math.min(1, speed * 2.2);
    if (normSpeed < 0.04) {
      this._squeegeeTargetGain = 0;
      return;
    }
    this._squeegeeTargetGain = normSpeed;
    // Wet soapy glide is lower & silkier; cleaner damp rubber sings slightly higher!
    const baseFreq = hasFoam ? 880 : (isWet ? 1240 : 1580);
    this._squeegeeTargetFreq = baseFreq + normSpeed * 520;
    this._squeegeeHasFoam = hasFoam;
  }

  /** Soft natural pick-up / put-down wooden sill thud */
  playWoodTap(pitch = 1.0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(195 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(82 * pitch, now + 0.065);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /** Delicate bare-finger squeak on foggy glass */
  playFingerSqueak(speed) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this._lastChirpTime < 0.11 || speed < 0.05) return;
    this._lastChirpTime = now;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const f = 1400 + Math.min(1, speed) * 700 + Math.random() * 180;
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.18, now + 0.065);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.028, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /** Crisp solid glass knock 'tink' when tapping clean pane */
  playGlassTap() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    for (const [freq, amp, dur] of [[1180, 0.06, 0.06], [2340, 0.035, 0.04]]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(amp, now);
      g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.01);
    }
  }

  /** Delicate crystalline suncatcher chime when prism is tapped or sparkles */
  playCrystalChime(intensity = 1.0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const notes = [1760, 2217.46, 2637.02, 3520];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      const t0 = now + idx * 0.045;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.042 * intensity / (1 + idx * 0.35), t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.85 - idx * 0.08);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.9);
    });
  }

  /** Warm ceramic clink + cozy rising steam hiss from teacup */
  playTeacupSteam() {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Gentle porcelain saucer clink
    const osc = ctx.createOscillator();
    const cg = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1640, now);
    cg.gain.setValueAtTime(0.045, now);
    cg.gain.exponentialRampToValueAtTime(0.0008, now + 0.14);
    osc.connect(cg).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);

    // Warm soft steam whoosh
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1600, now);
    bp.frequency.linearRampToValueAtTime(950, now + 1.1);
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.09, now + 0.18);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.25);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(now, 0, 1.3);
  }

  /** Soft organic plant leaf rustle */
  playPlantRustle() {
    if (!this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3100;
    bp.Q.value = 2.0;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.055, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(now, Math.random() * 0.5, 0.26);
  }

  update(dt, cleanRatio) {
    if (!this.ctx || !this.squeegeeNodes) return;
    const now = this.ctx.currentTime;
    const s = this.squeegeeNodes;

    this._squeegeeGainVal += (this._squeegeeTargetGain - this._squeegeeGainVal) * Math.min(1, dt * 16);
    this._squeegeeTargetGain *= Math.exp(-dt * 12);

    const gGlide = this._squeegeeGainVal * (this._squeegeeHasFoam ? 0.11 : 0.085);
    const gSqueak = this._squeegeeGainVal > 0.12
      ? Math.pow(this._squeegeeGainVal, 1.35) * (this._squeegeeHasFoam ? 0.016 : 0.036)
      : 0;

    s.glideGain.gain.setTargetAtTime(gGlide, now, 0.025);
    s.glideFilter.frequency.setTargetAtTime(1400 + this._squeegeeGainVal * 1200, now, 0.04);
    s.squeakGain.gain.setTargetAtTime(gSqueak, now, 0.03);
    s.squeakOsc.frequency.setTargetAtTime(this._squeegeeTargetFreq, now, 0.045);
    s.squeakFilter.frequency.setTargetAtTime(this._squeegeeTargetFreq * 1.06, now, 0.045);

    if (this.ambientGain) {
      // Quiet sunlit garden breeze softly opens up as the window clears
      this.ambientGain.gain.setTargetAtTime(0.003 + cleanRatio * 0.009, now, 0.25);
    }
  }
}
