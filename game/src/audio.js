// All sound is synthesised with WebAudio: no audio files, no network.
// An engine drone follows the car's speed, a two-tone siren wails when
// the heat is on, and a tiny step sequencer plays a bassline under it.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.musicOn = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: a sawtooth through a lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: a sine that swings between two notes.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 660;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.musicOn = true;
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  setEngine(speedNorm) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(speedNorm > 0.02 ? 0.05 + speedNorm * 0.05 : 0, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speedNorm * 130, t, 0.08);
  }

  setSiren(on, time) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, t, 0.2);
    if (on) this.sirenOsc.frequency.setTargetAtTime(time % 1 < 0.5 ? 660 : 520, t, 0.05);
  }

  blip(freq, dur, type = 'square', vol = 0.12) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  noise(dur, vol = 0.25, filterFreq = 1800) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  shot() {
    this.noise(0.12, 0.3, 2400);
    this.blip(160, 0.08, 'square', 0.1);
  }

  reload() {
    this.blip(520, 0.05, 'square', 0.08);
    setTimeout(() => this.blip(760, 0.05, 'square', 0.08), 90);
  }

  pickup() {
    this.blip(880, 0.07, 'sine', 0.1);
    setTimeout(() => this.blip(1318, 0.09, 'sine', 0.1), 70);
  }

  jingle() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.14, 'triangle', 0.12), i * 110));
  }

  bust() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.2, 'sawtooth', 0.1), i * 150));
  }

  // A sparse bassline: A minor, one note per eighth at 112 bpm.
  music(dt) {
    if (!this.ctx || !this.musicOn || this.muted) return;
    this.musicTimer += dt;
    const stepDur = 60 / 112 / 2;
    const notes = [55, 0, 55, 65.41, 0, 55, 49, 0, 55, 0, 55, 65.41, 82.41, 0, 73.42, 0];
    while (this.musicTimer >= stepDur) {
      this.musicTimer -= stepDur;
      const f = notes[this.musicStep % notes.length];
      this.musicStep += 1;
      if (f > 0) this.blip(f, stepDur * 0.9, 'triangle', 0.05);
      if (this.musicStep % 8 === 0) this.noise(0.03, 0.03, 6000);
    }
  }
}
