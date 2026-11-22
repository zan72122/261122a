// Pure WebAudio tactile foley & miniature kitchen sound synthesizer

class KitchenAudio {
  constructor() {
    this.ctx = null;
    this.noiseBuf = null;
    this.lastSwirlTime = 0;
    this.lastRollTime = 0;
    this.lastCutTime = 0;
    this.muted = false;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._buildNoiseBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _buildNoiseBuffer() {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate;
    const len = sr * 1.5;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuf = buf;
  }

  _ready() {
    if (this.muted) return false;
    if (!this.ctx) this.unlock();
    return this.ctx && this.ctx.state === 'running';
  }

  playFlourPoof(vol = 0.22) {
    if (!this._ready() || !this.noiseBuf) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(480, now + 0.18);
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.24);
  }

  playDoughSquish(progress = 0.5) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const base = 105 + progress * 75;
    osc.frequency.setValueAtTime(base * 1.35, now);
    osc.frequency.exponentialRampToValueAtTime(base * 0.65, now + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    this.playFlourPoof(0.11);
  }

  playRollingWood(speed = 0.5) {
    if (!this._ready() || !this.noiseBuf) return;
    const now = this.ctx.currentTime;
    if (now - this.lastRollTime < 0.085) return;
    this.lastRollTime = now;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320 + Math.min(speed, 1.5) * 260, now);

    const gain = this.ctx.createGain();
    const amp = Math.min(0.22, 0.07 + speed * 0.12);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(now, Math.random() * 0.5);
    src.stop(now + 0.12);
  }

  playSauceScoop() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.17);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    osc.connect(filter).connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playSauceSwirl(speed = 0.5) {
    if (!this._ready() || !this.noiseBuf) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSwirlTime < 0.075) return;
    this.lastSwirlTime = now;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const f = 520 + Math.min(speed, 2) * 320 + Math.random() * 140;
    filter.frequency.setValueAtTime(f, now);
    filter.frequency.exponentialRampToValueAtTime(f * 0.7, now + 0.09);
    filter.Q.value = 3.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(Math.min(0.18, 0.07 + speed * 0.07), now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(now, Math.random() * 0.5);
    src.stop(now + 0.11);
  }

  playCeramicClink(pitchOffset = 0) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const freqs = [1580, 2940];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * (1 + pitchOffset * 0.08), now);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(idx === 0 ? 0.11 : 0.05, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + (idx === 0 ? 0.14 : 0.08));
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    });
  }

  playToppingDrop(type) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    if (type === 'cheese') {
      // Soft snowy sprinkle
      for (let i = 0; i < 3; i++) {
        this._tinyPop(now + i * 0.032, 650 + Math.random() * 260, 0.07);
      }
      this.playFlourPoof(0.08);
    } else if (type === 'corn') {
      // Cheerful corn kernel scatter
      for (let i = 0; i < 4; i++) {
        this._tinyPop(now + i * 0.028, 920 + Math.random() * 440, 0.09);
      }
    } else if (type === 'pepperoni') {
      this._tinyPop(now, 240, 0.2, 0.11);
    } else if (type === 'tomato') {
      this._tinyPop(now, 410, 0.17, 0.09);
    } else if (type === 'mushroom') {
      this._tinyPop(now, 310, 0.15, 0.08);
    } else if (type === 'basil') {
      this.playFlourPoof(0.1);
      this._tinyPop(now, 740, 0.08, 0.06);
    } else {
      this._tinyPop(now, 360, 0.15, 0.08);
    }
  }

  _tinyPop(startTime, freq, vol = 0.12, dur = 0.075) {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.4, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.65, startTime + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.01);
  }

  playPeelSlide() {
    if (!this._ready() || !this.noiseBuf) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.linearRampToValueAtTime(680, now + 0.18);
    filter.frequency.linearRampToValueAtTime(340, now + 0.36);
    filter.Q.value = 1.6;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.4);
  }

  playOvenFireWhoosh() {
    if (!this._ready() || !this.noiseBuf) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);
    filter.frequency.exponentialRampToValueAtTime(1100, now + 0.12);
    filter.frequency.exponentialRampToValueAtTime(260, now + 0.38);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.26, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.44);

    // Crackle snaps
    for (let i = 0; i < 3; i++) {
      this._tinyPop(now + 0.05 + i * 0.07 + Math.random() * 0.04, 1800 + Math.random() * 1400, 0.05, 0.02);
    }
  }

  playCheeseBubble() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const f = 520 + Math.random() * 480;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * 0.7, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.65, now + 0.055);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.065, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  playBrassBell() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const partials = [
      { f: 1174.66, g: 0.18, d: 1.3 },
      { f: 2349.32, g: 0.11, d: 0.9 },
      { f: 3530.0, g: 0.06, d: 0.55 },
      { f: 4720.0, g: 0.03, d: 0.3 }
    ];
    for (const p of partials) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(p.f, now);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(p.g, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + p.d);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + p.d + 0.02);
    }
  }

  playPizzaCut() {
    if (!this._ready() || !this.noiseBuf) return;
    const now = this.ctx.currentTime;
    if (now - this.lastCutTime < 0.09) return;
    this.lastCutTime = now;

    // Crunchy baked crust crackle!
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.038;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1600 + i * 320 + Math.random() * 400, t);
      filter.Q.value = 1.8;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

      src.connect(filter).connect(gain).connect(this.ctx.destination);
      src.start(t, Math.random() * 0.5);
      src.stop(t + 0.075);
    }
  }

  playCheeseSnap() {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.07);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  playMunch(pitch = 1.0) {
    if (!this._ready() || !this.noiseBuf) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1150 * pitch, now);
    filter.Q.value = 2.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start(now, Math.random() * 0.5);
    src.stop(now + 0.09);

    this._tinyPop(now + 0.01, 280 * pitch, 0.12, 0.06);
  }

  playFamilyHappy(memberIdx = 0, extra = false) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    // Warm wooden marimba chords per family member
    const chords = [
      [261.63, 329.63, 392.0],         // Papa
      [329.63, 392.0, 493.88],         // Mama
      [392.0, 493.88, 587.33],         // Sister
      [523.25, 659.25, 783.99]         // Little Brother
    ];
    const notes = chords[memberIdx % chords.length];
    const seq = extra ? [...notes, notes[0] * 2] : notes;
    seq.forEach((f, i) => {
      const t = now + i * 0.075;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  playStageChime(step = 0) {
    if (!this._ready()) return;
    const now = this.ctx.currentTime;
    const base = [392.0, 440.0, 493.88, 523.25, 587.33][step % 5];
    [base, base * 1.25, base * 1.5].forEach((f, i) => {
      const t = now + i * 0.07;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }
}

export const audio = new KitchenAudio();
