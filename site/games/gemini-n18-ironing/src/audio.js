/**
 * Pure Web Audio API realistic household foley synthesizer (no external files).
 * Generates organic steam hiss, wet-cloth sizzle, spray-bottle mist, cloth gliding,
 * crisp fabric folding, silicone-pad thud, and wicker basket rustle.
 */
export function createAudioEngine() {
  let ctx = null;
  let noiseBuf = null;
  let steamGain = null;
  let steamFilter = null;
  let glideGain = null;
  let glideFilter = null;
  let unlocked = false;

  function ensureContext() {
    if (unlocked) return true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      // 3-second looping white/pink noise buffer
      const sr = ctx.sampleRate;
      const len = sr * 3;
      noiseBuf = ctx.createBuffer(1, len, sr);
      const data = noiseBuf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.950 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.18) * 1.45;
      }

      // Continuous steam hiss voice
      const steamSrc = ctx.createBufferSource();
      steamSrc.buffer = noiseBuf;
      steamSrc.loop = true;
      steamFilter = ctx.createBiquadFilter();
      steamFilter.type = 'bandpass';
      steamFilter.frequency.value = 3200;
      steamFilter.Q.value = 0.65;
      steamGain = ctx.createGain();
      steamGain.gain.value = 0.0001;
      steamSrc.connect(steamFilter).connect(steamGain).connect(ctx.destination);
      steamSrc.start();

      // Continuous fabric-glide brush voice
      const glideSrc = ctx.createBufferSource();
      glideSrc.buffer = noiseBuf;
      glideSrc.loop = true;
      glideFilter = ctx.createBiquadFilter();
      glideFilter.type = 'bandpass';
      glideFilter.frequency.value = 950;
      glideFilter.Q.value = 1.1;
      glideGain = ctx.createGain();
      glideGain.gain.value = 0.0001;
      glideSrc.connect(glideFilter).connect(glideGain).connect(ctx.destination);
      glideSrc.start();

      unlocked = true;
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  /**
   * Modulates continuous steam hiss + warm cloth press glide smoothly every frame.
   */
  function updateIronLoop(speed, onCloth, moistureBoost) {
    if (!unlocked || !ctx) return;
    const now = ctx.currentTime;
    const targetSteam = onCloth
      ? Math.min(0.28, 0.025 + speed * 0.14 + moistureBoost * 0.18)
      : 0.0001;
    const targetFreq = 2600 + Math.min(2800, speed * 1400 + moistureBoost * 1800);
    steamGain.gain.setTargetAtTime(targetSteam, now, 0.045);
    steamFilter.frequency.setTargetAtTime(targetFreq, now, 0.06);

    const targetGlide = onCloth ? Math.min(0.14, speed * 0.16) : 0.0001;
    glideGain.gain.setTargetAtTime(targetGlide, now, 0.04);
    glideFilter.frequency.setTargetAtTime(750 + Math.min(900, speed * 700), now, 0.05);
  }

  /**
   * Crisp steam burst ("シュッ！" or wet "ジュワァーッ！").
   */
  function playSteamPuff(intensity = 0.8) {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(1600, now);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(4200, now);
    bp.frequency.exponentialRampToValueAtTime(1900, now + 0.38 * intensity + 0.15);
    bp.Q.value = 0.55;

    const g = ctx.createGain();
    const dur = 0.26 + intensity * 0.34;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(Math.min(0.32, 0.12 + intensity * 0.16), now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(hp).connect(bp).connect(g).connect(ctx.destination);
    src.start(now, Math.random() * 1.5);
    src.stop(now + dur + 0.05);
  }

  /**
   * Glass mist spray bottle pump ("シュッ！") with tiny mechanical trigger click.
   */
  function playSprayMist() {
    if (!ensureContext()) return;
    const now = ctx.currentTime;

    // Trigger mechanical click
    const clickOsc = ctx.createOscillator();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(520, now);
    clickOsc.frequency.exponentialRampToValueAtTime(180, now + 0.035);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.07, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    clickOsc.connect(clickGain).connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.045);

    // Crisp high-frequency water mist spray
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(6400, now);
    bp.frequency.exponentialRampToValueAtTime(3600, now + 0.19);
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(now, Math.random() * 1.2);
    src.stop(now + 0.24);
  }

  /**
   * Soft crisp fabric fold / rustle sound ("パタッ / サラッ").
   */
  function playClothFold(pitchScale = 1.0) {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1250 * pitchScale, now);
    bp.frequency.exponentialRampToValueAtTime(520 * pitchScale, now + 0.26);
    bp.Q.value = 1.2;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(now, Math.random() * 1.5);
    src.stop(now + 0.31);
  }

  /**
   * Gentle soft thump when iron rests on silicone mat or folded cloth settles onto the stack.
   */
  function playSoftThud(low = true) {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(low ? 135 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(low ? 54 : 88, now + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /**
   * Tiny organic mother-of-pearl button click when iron glides gently near a shirt button.
   */
  function playButtonClick() {
    if (!ensureContext()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1850, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.022);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.035, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.032);
  }

  return {
    unlock,
    updateIronLoop,
    playSteamPuff,
    playSprayMist,
    playClothFold,
    playSoftThud,
    playButtonClick,
  };
}
