// Procedural Web Audio API sound effects for Pixel Bakery (zero external audio files)
// Unlocks cleanly on first touch/pointerdown for iOS/iPadOS Safari.

(function () {
  class BakeryAudio {
    constructor() {
      this.ctx = null;
      this.unlocked = false;
      this.noiseBuf = null;
    }

    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this._makeNoiseBuffer();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      this.unlocked = true;
    }

    _makeNoiseBuffer() {
      const sr = this.ctx.sampleRate;
      const len = Math.floor(sr * 0.5);
      const buf = this.ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + w * 0.029;
        b1 = 0.985 * b1 + w * 0.032;
        b2 = 0.950 * b2 + w * 0.048;
        d[i] = (b0 + b1 + b2 + w * 0.18) * 1.4;
      }
      this.noiseBuf = buf;
    }

    _tone(freq, freqEnd, dur, type = "sine", vol = 0.16, delay = 0) {
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (freqEnd && freqEnd !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
      }
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.015, dur * 0.2));
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    _noise(dur, filterFreq = 1200, vol = 0.08, delay = 0) {
      if (!this.ctx || !this.noiseBuf) return;
      const t0 = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const flt = this.ctx.createBiquadFilter();
      flt.type = "bandpass";
      flt.frequency.setValueAtTime(filterFreq, t0);
      flt.Q.value = 1.2;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(flt);
      flt.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    }

    // Soft squishy dough kneading
    playKnead(progress = 0) {
      const base = 170 + progress * 90 + (Math.random() - 0.5) * 18;
      this._tone(base, base * 1.45, 0.11, "sine", 0.18);
      this._tone(base * 0.65, base * 0.45, 0.09, "triangle", 0.10, 0.02);
      this._noise(0.08, 1600, 0.05);
    }

    // Dough glossy & kneaded ready sparkle
    playKneadDone() {
      this._tone(523.25, 523.25, 0.14, "triangle", 0.14, 0.0);
      this._tone(659.25, 659.25, 0.16, "triangle", 0.14, 0.07);
      this._tone(783.99, 783.99, 0.22, "sine", 0.16, 0.14);
    }

    // Flour puff / new dough pop
    playFlourPop(jumbo = false) {
      this._noise(0.14, 2100, 0.08);
      if (jumbo) {
        this._tone(220, 440, 0.18, "sine", 0.18, 0.0);
        this._tone(330, 660, 0.22, "triangle", 0.14, 0.08);
      } else {
        this._tone(260, 520, 0.12, "sine", 0.16);
      }
    }

    // Shape wooden stamp press (pentatonic notes per shape)
    playShapeStamp(idx = 0) {
      const notes = [392.0, 440.0, 523.25, 587.33, 659.25];
      const f = notes[idx % notes.length];
      this._tone(160, 110, 0.07, "triangle", 0.14, 0.0);
      this._tone(f, f * 1.03, 0.16, "sine", 0.15, 0.02);
      this._tone(f * 2, f * 2, 0.10, "triangle", 0.06, 0.03);
    }

    // Topping drop (strawberry / choco / butter)
    playTopping(kind) {
      if (kind === "strawberry") {
        this._tone(480, 740, 0.11, "sine", 0.15);
        this._tone(740, 960, 0.12, "triangle", 0.10, 0.05);
      } else if (kind === "choco") {
        this._tone(340, 420, 0.06, "triangle", 0.12, 0.0);
        this._tone(440, 520, 0.06, "triangle", 0.11, 0.04);
        this._tone(540, 640, 0.08, "triangle", 0.10, 0.08);
      } else {
        this._tone(360, 540, 0.16, "sine", 0.14);
        this._tone(540, 680, 0.14, "sine", 0.08, 0.06);
      }
    }

    // Put dough into brick oven (warm whoosh)
    playOvenIn() {
      this._noise(0.28, 650, 0.12);
      this._tone(200, 140, 0.15, "triangle", 0.12);
      this._tone(320, 460, 0.18, "sine", 0.10, 0.07);
    }

    // Subtle rising puff tick while baking
    playBakePuff(progress) {
      const f = 260 + progress * 240;
      this._tone(f, f * 1.15, 0.09, "sine", 0.05);
    }

    // Cheerful oven ding!
    playOvenDing() {
      this._tone(1046.5, 1046.5, 0.55, "sine", 0.16, 0.0);
      this._tone(2093.0, 2093.0, 0.38, "sine", 0.07, 0.0);
      this._tone(1318.5, 1318.5, 0.45, "triangle", 0.11, 0.08);
    }

    // Comical cute burnt puff (playful, never scary)
    playBurnt() {
      this._noise(0.22, 900, 0.09);
      this._tone(360, 220, 0.18, "triangle", 0.14, 0.0);
      this._tone(250, 170, 0.22, "sine", 0.12, 0.11);
    }

    // Place bread on wooden shelf
    playShelfPlace() {
      this._tone(280, 380, 0.09, "triangle", 0.15, 0.0);
      this._tone(560, 620, 0.11, "sine", 0.10, 0.04);
    }

    // Cozy shop door bell when customer arrives
    playDoorBell() {
      this._tone(880, 880, 0.26, "sine", 0.10, 0.0);
      this._tone(1174.66, 1174.66, 0.34, "sine", 0.11, 0.11);
    }

    // Customer happy buy + coin clink!
    playBuy(coins = 1) {
      // Happy chime
      this._tone(523.25, 523.25, 0.12, "sine", 0.12, 0.0);
      this._tone(659.25, 659.25, 0.12, "sine", 0.12, 0.07);
      this._tone(783.99, 783.99, 0.18, "sine", 0.14, 0.14);
      // Coin clinks
      for (let i = 0; i < Math.min(coins, 3); i++) {
        const d = 0.20 + i * 0.09;
        this._tone(1567.98, 1760, 0.18, "sine", 0.11, d);
        this._tone(2349.32, 2637, 0.12, "triangle", 0.06, d + 0.02);
      }
    }

    // Coin tap / shop upgrade fanfare!
    playUpgrade() {
      const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      seq.forEach((f, i) => {
        this._tone(f, f * 1.01, 0.22, "triangle", 0.13, i * 0.065);
      });
    }

    // Trash bin poof
    playTrash() {
      this._tone(420, 150, 0.15, "sine", 0.14, 0.0);
      this._noise(0.10, 1400, 0.06, 0.03);
    }

    // Rear flowerbox / door / sack playful secret sounds
    playFlower() {
      [587.33, 783.99, 987.77, 1174.66].forEach((f, i) => {
        this._tone(f, f, 0.18, "sine", 0.09, i * 0.05);
      });
    }

    playKnock() {
      this._tone(180, 120, 0.07, "triangle", 0.15, 0.0);
      this._tone(175, 115, 0.07, "triangle", 0.15, 0.13);
    }

    // Soft tactile click when grabbing bread
    playPickup() {
      this._tone(320, 480, 0.08, "sine", 0.11);
    }
  }

  window.BakeryAudio = BakeryAudio;
})();
