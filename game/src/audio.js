// Sound, all synthesised with WebAudio: no sound files, no network. A low
// engine hum that follows the car's speed, a two-tone police siren, gunshots,
// a pickup blip, a mission jingle, and a slow sun-soaked bassline with hats
// that keeps time while you drive. Mute with M; everything is created lazily
// on the first user gesture, so the page never needs autoplay permission.

const MUSIC_BASS = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 0, 73.42, 65.41, 58.27, 49];
const MUSIC_CHORD = [220, 261.63, 329.63];

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: a quiet sawtooth whose pitch follows the car's speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a square wave wobbling between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenLfo = ctx.createOscillator();
      sirenLfo.frequency.value = 1.6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      startMusic();
    } catch {
      return false;
    }
    return true;
  }

  function startMusic() {
    if (musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (!ctx || muted) return;
      const now = ctx.currentTime;
      const bass = MUSIC_BASS[musicStep % MUSIC_BASS.length];
      if (bass > 0) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = bass;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.11, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        osc.stop(now + 0.45);
      }
      // A soft chord stab on the first beat of each bar.
      if (musicStep % 16 === 0) {
        for (const freq of MUSIC_CHORD) {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.045, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
          osc.connect(g);
          g.connect(master);
          osc.start(now);
          osc.stop(now + 1.7);
        }
      }
      // Hat tick on the off-beats.
      if (musicStep % 2 === 1) {
        const len = 0.03;
        const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const g = ctx.createGain();
        g.gain.value = 0.05;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 6000;
        src.connect(filter);
        filter.connect(g);
        g.connect(master);
        src.start(now);
      }
      musicStep += 1;
    }, 230);
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(now);
  }

  return {
    /** Call on the first gesture; safe to call any time. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      noiseBurst(0.09, 0.5, 2400);
      blip(190, 0.08, 'square', 0.16, 60);
    },
    copShoot() {
      noiseBurst(0.07, 0.22, 1800);
    },
    crash() {
      noiseBurst(0.25, 0.55, 700);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.22);
      window.setTimeout(() => blip(990, 0.14, 'sine', 0.22), 80);
    },
    jingle() {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        window.setTimeout(() => blip(freq, 0.22, 'triangle', 0.25), i * 110);
      });
    },
    fail() {
      [392, 311, 233].forEach((freq, i) => {
        window.setTimeout(() => blip(freq, 0.25, 'triangle', 0.2), i * 140);
      });
    },
    siren(on) {
      if (!ctx || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(on && !muted ? 0.045 : 0, ctx.currentTime, 0.2);
    },
    /** speed01 is 0..1 of the car's top speed; 0 silences the engine. */
    engine(speed01) {
      if (!ctx || !engineGain || !engineOsc) return;
      const target = muted ? 0 : speed01 * 0.075;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(48 + speed01 * 130, ctx.currentTime, 0.08);
    },
    click() {
      blip(880, 0.05, 'sine', 0.15);
    },
  };
}
