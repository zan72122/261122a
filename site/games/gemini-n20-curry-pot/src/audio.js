// Tactile procedural Web Audio synthesizer — zero external assets, instant iOS Safari unlock
window.SoundFX = (() => {
  let ctx = null;
  let noiseBuf = null;
  let lastBubbleAt = 0;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      // 1-second white noise buffer for splashes, steam, sizzling, crunch
      const len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function unlock() {
    const c = ensure();
    if (!c) return;
    try {
      const osc = c.createOscillator();
      const g = c.createGain();
      g.gain.value = 0.0001;
      osc.connect(g);
      g.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.01);
    } catch (_) {}
  }

  function playNoise(duration, filterFreq, q, gainPeak, type = 'bandpass', startOffset = 0) {
    const c = ensure();
    if (!c || !noiseBuf) return;
    const t = c.currentTime + startOffset;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const filt = c.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(filterFreq, t);
    filt.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gainPeak, t + Math.min(0.015, duration * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filt);
    filt.connect(g);
    g.connect(c.destination);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  function playTone(freqStart, freqEnd, duration, type = 'sine', gainPeak = 0.14, startOffset = 0) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + startOffset;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t + duration);
    }
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gainPeak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  return {
    unlock,

    // Crisp wooden cutting board TON! + crisp veggie snap
    chop(step = 0) {
      const pitch = 210 + step * 35 + Math.random() * 20;
      playTone(pitch, pitch * 0.55, 0.075, 'triangle', 0.24);
      playNoise(0.055, 1900 + step * 200, 1.5, 0.14, 'bandpass');
      if (step >= 2) {
        // Cheerful tiny completion sparkle
        playTone(660, 880, 0.12, 'sine', 0.1, 0.04);
      }
    },

    // Playful boing when trying to put an uncut veggie in the pot
    boing() {
      playTone(220, 440, 0.14, 'sine', 0.14);
      playTone(440, 290, 0.12, 'sine', 0.1, 0.11);
    },

    // Splash when veggie or roux drops into pot (richer = deeper thicker plop!)
    splash(richness = 0) {
      const depth = Math.max(0, Math.min(4, richness));
      const baseF = 340 - depth * 45;
      playTone(baseF, baseF * 2.1, 0.14, 'sine', 0.18);
      playTone(baseF * 0.8, baseF * 1.4, 0.1, 'triangle', 0.12, 0.06);
      playNoise(0.16, 1300 - depth * 180, 1.2, 0.14, 'bandpass');
    },

    // Crisp chocolate/curry roux bar snap: PAKI!
    rouxSnap() {
      playNoise(0.045, 2600, 1.4, 0.24, 'bandpass');
      playTone(460, 190, 0.065, 'square', 0.12);
      playTone(740, 520, 0.05, 'triangle', 0.12, 0.015);
    },

    // Roux melting bloom shimmer
    rouxBloom(level = 1) {
      const notes = [392, 440, 523.25, 659.25];
      const f = notes[Math.min(notes.length - 1, Math.max(0, level - 1))];
      playTone(f, f * 1.12, 0.26, 'sine', 0.11);
      playTone(f * 1.5, f * 1.5, 0.22, 'triangle', 0.07, 0.07);
    },

    // Stove knob click + gas ignition whoosh
    stoveClick(heatLevel) {
      playTone(540, 260, 0.04, 'square', 0.14);
      playNoise(0.03, 3200, 2.0, 0.1, 'highpass');
      if (heatLevel > 0) {
        playNoise(0.22, 420 + heatLevel * 140, 0.8, 0.11 + heatLevel * 0.03, 'lowpass', 0.03);
      }
    },

    // Gentle simmering bubble (throttled, pitch depends on curry thickness!)
    bubble(richness = 0, heatLevel = 1) {
      const now = performance.now();
      const minGap = 240 + richness * 95 - heatLevel * 60;
      if (now - lastBubbleAt < minGap) return;
      lastBubbleAt = now;
      const base = 420 - richness * 62 + (Math.random() * 55 - 25);
      playTone(base * 0.72, base * 1.38, 0.075 + richness * 0.015, 'sine', 0.055);
    },

    // Stirring swirl sound
    stir(richness = 0) {
      const freq = 950 - richness * 150 + Math.random() * 140;
      playNoise(0.11, freq, 1.8, 0.075, 'bandpass');
      playTone(260 - richness * 30, 320 - richness * 30, 0.09, 'sine', 0.05);
    },

    // Rice cooker lid pop! POFF! + happy steam chime
    riceCooker(open) {
      if (open) {
        playTone(320, 620, 0.1, 'triangle', 0.15);
        playNoise(0.24, 1500, 0.9, 0.12, 'bandpass', 0.04);
        playTone(784, 1046, 0.16, 'sine', 0.09, 0.06);
      } else {
        playTone(280, 180, 0.08, 'triangle', 0.14);
      }
    },

    // Pouring thick velvety curry onto rice: TOROOO!
    pourCurry(richness = 3) {
      playNoise(0.32, 620 - richness * 60, 1.5, 0.12, 'lowpass');
      playTone(300, 460, 0.16, 'sine', 0.1);
      playTone(380, 560, 0.18, 'sine', 0.09, 0.1);
      playTone(523.25, 659.25, 0.18, 'triangle', 0.08, 0.2);
    },

    // Sprinkling crimson fukujinzuke pickles
    sprinkle() {
      for (let i = 0; i < 4; i++) {
        playTone(1100 + i * 160 + Math.random() * 80, 900, 0.045, 'sine', 0.07, i * 0.045);
      }
    },

    // Ceramic plate landing on placemat: KOTON!
    platePlace() {
      playTone(620, 420, 0.06, 'triangle', 0.16);
      playTone(980, 740, 0.05, 'sine', 0.1, 0.02);
    },

    // Cute family spoon tap / wiggle
    spoonTap() {
      playTone(1320, 1180, 0.06, 'sine', 0.09);
      playTone(1580, 1400, 0.05, 'sine', 0.07, 0.08);
    },

    // Happy munching bite
    bite(idx = 0) {
      const notes = [440, 523.25, 587.33, 659.25];
      const f = notes[idx % notes.length];
      playTone(f, f * 1.18, 0.09, 'triangle', 0.11);
      playNoise(0.04, 1600, 1.4, 0.06, 'bandpass');
    },

    // Family member happy chime when served or finished eating
    happyChime(whoIdx = 0) {
      const bases = [523.25, 440, 659.25]; // Mama, Papa, Girl distinct voices!
      const b = bases[whoIdx % 3];
      playTone(b, b, 0.13, 'sine', 0.13, 0);
      playTone(b * 1.25, b * 1.25, 0.15, 'sine', 0.13, 0.09);
      playTone(b * 1.5, b * 1.5, 0.22, 'triangle', 0.12, 0.18);
    },

    // Full family feast celebration fanfare!
    celebrate() {
      const seq = [523.25, 659.25, 783.99, 1046.5, 880, 1046.5];
      seq.forEach((f, i) => {
        playTone(f, f, 0.22, i === seq.length - 1 ? 'triangle' : 'sine', 0.14, i * 0.095);
      });
    },

    // Soft playful pop on generic poke/wiggle
    poke() {
      playTone(360 + Math.random() * 80, 480 + Math.random() * 60, 0.07, 'sine', 0.08);
    },
  };
})();
