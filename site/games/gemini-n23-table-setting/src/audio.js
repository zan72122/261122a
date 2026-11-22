// Tactile Web Audio procedural synthesizer — zero external files, instant response

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.lastStirTime = 0;
    this.lastPourTime = 0;
    this.lastShakeTime = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this._buildNoiseBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _buildNoiseBuffer() {
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
  }

  _tone(freqStart, freqEnd, dur, type = 'sine', vol = 0.25, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise(dur, filterFreq, Q = 2, vol = 0.16, delay = 0, filterType = 'bandpass') {
    if (!this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(filterFreq, t);
    f.Q.value = Q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  playPickup(kind = 'plate') {
    this.unlock();
    if (kind === 'plate') {
      this._tone(580, 920, 0.08, 'triangle', 0.22);
      this._tone(1320, 1480, 0.06, 'sine', 0.12);
    } else if (kind === 'chopsticks') {
      this._tone(960, 740, 0.04, 'triangle', 0.2);
      this._tone(1180, 920, 0.04, 'triangle', 0.16, 0.032);
    } else if (kind === 'cup') {
      this._tone(480, 780, 0.09, 'sine', 0.22);
    } else if (kind === 'ladle') {
      this._tone(340, 520, 0.09, 'triangle', 0.2);
    } else if (kind === 'pitcher') {
      this._tone(260, 420, 0.11, 'sine', 0.22);
      this._noise(0.08, 700, 3, 0.08);
    } else {
      this._tone(520, 820, 0.07, 'sine', 0.18);
    }
  }

  playPlace(kind = 'plate', bonusMatch = false) {
    this.unlock();
    if (kind === 'plate') {
      // Ceramic koton + crisp ring
      this._tone(220, 110, 0.09, 'sine', 0.28);
      this._tone(1120, 1080, 0.12, 'sine', 0.15);
      this._tone(1680, 1620, 0.09, 'triangle', 0.09);
    } else if (kind === 'chopsticks') {
      // Wooden kotsu-kotsu
      this._tone(740, 520, 0.045, 'triangle', 0.24);
      this._tone(880, 640, 0.045, 'triangle', 0.2, 0.035);
    } else if (kind === 'cup') {
      // Hollow ceramic cup pop
      this._tone(310, 180, 0.1, 'sine', 0.28);
      this._tone(640, 610, 0.11, 'triangle', 0.14);
    }
    if (bonusMatch) {
      // Extra sparkly chime when color matches favorite seat
      this._tone(659.25, 659.25, 0.14, 'sine', 0.14, 0.04);
      this._tone(880, 880, 0.18, 'sine', 0.16, 0.1);
      this._tone(1174.66, 1174.66, 0.22, 'triangle', 0.14, 0.16);
    }
  }

  playLidPop(opening = true) {
    this.unlock();
    if (opening) {
      this._tone(180, 440, 0.13, 'sine', 0.3);
      this._tone(620, 880, 0.11, 'triangle', 0.14, 0.03);
      this._noise(0.28, 2200, 1.4, 0.12, 0.04, 'highpass');
    } else {
      this._tone(360, 160, 0.11, 'sine', 0.28);
      this._tone(720, 420, 0.07, 'triangle', 0.12);
    }
  }

  playPotRattle() {
    this.unlock();
    this._tone(420, 360, 0.05, 'triangle', 0.16);
    this._tone(510, 440, 0.05, 'triangle', 0.14, 0.055);
    this._noise(0.14, 2400, 1.8, 0.07, 0.02, 'highpass');
  }

  playStir(speed = 1) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStirTime < 0.085) return;
    this.lastStirTime = now;
    const base = 190 + Math.random() * 140 + Math.min(speed, 2) * 55;
    this._tone(base, base * 1.65, 0.09, 'sine', 0.16);
    this._noise(0.07, 900, 3.5, 0.07);
  }

  playScoop() {
    this.unlock();
    this._tone(210, 480, 0.12, 'sine', 0.24);
    this._tone(380, 620, 0.1, 'triangle', 0.13, 0.04);
  }

  playServePlop(level = 1) {
    this.unlock();
    // Juicy bouncy food plop + warm sparkle
    const pitchBoost = (level - 1) * 90;
    this._tone(240 + pitchBoost, 130, 0.1, 'sine', 0.26);
    this._tone(160 + pitchBoost, 380 + pitchBoost, 0.12, 'sine', 0.22, 0.045);
    this._tone(523.25 + pitchBoost, 659.25 + pitchBoost, 0.16, 'triangle', 0.13, 0.09);
  }

  playPourTick(fillRatio = 0.5, overflowing = false) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPourTime < 0.075) return;
    this.lastPourTime = now;
    if (overflowing) {
      // Splashy bubbly giggle fizz!
      this._tone(780 + Math.random() * 340, 1180, 0.07, 'sine', 0.14);
      this._noise(0.09, 1800, 1.8, 0.14, 0, 'bandpass');
    } else {
      // Rising pitch glug-glug!
      const f = 260 + fillRatio * 460 + (Math.random() - 0.5) * 35;
      this._tone(f, f * 1.38, 0.08, 'sine', 0.18);
      this._noise(0.05, 1400 + fillRatio * 800, 2.5, 0.05);
    }
  }

  playShakeSprinkle() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastShakeTime < 0.09) return;
    this.lastShakeTime = now;
    this._noise(0.055, 4200, 1.5, 0.16, 0, 'highpass');
    const chime = [1046.5, 1174.66, 1318.5, 1567.98][Math.floor(Math.random() * 4)];
    this._tone(chime, chime * 1.05, 0.12, 'sine', 0.09, 0.02);
  }

  playCharacterVoice(role, mood = 'happy') {
    this.unlock();
    // Expressive musical pitch-glide chirps (zero words!)
    const base = role === 'papa' ? 235 : role === 'mama' ? 420 : 590;
    if (mood === 'amazed') {
      this._tone(base, base * 1.55, 0.16, 'triangle', 0.18);
      this._tone(base * 1.4, base * 1.85, 0.18, 'sine', 0.16, 0.11);
    } else if (mood === 'sit') {
      this._tone(base * 0.9, base * 1.25, 0.12, 'triangle', 0.16);
      this._tone(base * 1.25, base * 1.5, 0.15, 'sine', 0.15, 0.09);
    } else if (mood === 'bliss') {
      this._tone(base, base * 1.25, 0.12, 'sine', 0.16);
      this._tone(base * 1.25, base * 1.5, 0.14, 'sine', 0.16, 0.09);
      this._tone(base * 1.5, base * 1.8, 0.2, 'triangle', 0.14, 0.18);
    } else {
      // Gentle cheerful chirp
      this._tone(base, base * 1.32, 0.13, 'triangle', 0.15);
    }
  }

  playMunch(role) {
    this.unlock();
    const base = role === 'papa' ? 190 : role === 'mama' ? 280 : 350;
    this._tone(base, base * 0.72, 0.055, 'triangle', 0.12);
    this._noise(0.035, 1200, 2, 0.05);
  }

  playGulp(role) {
    this.unlock();
    const base = role === 'papa' ? 180 : role === 'mama' ? 260 : 330;
    this._tone(base, base * 1.6, 0.08, 'sine', 0.14);
    this._tone(base * 1.15, base * 1.8, 0.09, 'sine', 0.12, 0.11);
  }

  playFeastFanfare() {
    this.unlock();
    // Joyful cel-anime dinner pentatonic chime fanfare!
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51];
    const times = [0, 0.09, 0.18, 0.28, 0.42, 0.52, 0.65];
    notes.forEach((n, idx) => {
      this._tone(n, n, 0.28, 'triangle', 0.18, times[idx]);
      this._tone(n * 2, n * 2, 0.18, 'sine', 0.08, times[idx]);
    });
  }

  playBell() {
    this.unlock();
    // Crisp metallic kitchen service bell CHIN!
    this._tone(1567.98, 1560, 0.65, 'sine', 0.24);
    this._tone(3135.96, 3120, 0.45, 'sine', 0.14);
    this._tone(4720, 4700, 0.22, 'triangle', 0.08);
  }
}

export const sound = new SoundEngine();
