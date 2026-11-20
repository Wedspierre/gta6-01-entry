// Velamar — every sound is synthesized live with WebAudio. No audio files:
// gunshots, sirens, engine hum, crashes and four procedural radio stations.
export const STATIONS = [
  { name: 'VELA FM', genre: 'Sunset Pop', tempo: 112, root: 57, wave: 'triangle', minor: false },
  { name: 'BASSLINE 88', genre: 'Coastal Electro', tempo: 126, root: 45, wave: 'sawtooth', minor: true },
  { name: 'CORAZON 102', genre: 'Cumbia Nights', tempo: 96, root: 55, wave: 'square', minor: false },
  { name: 'STATIC TALK', genre: 'Night Talk Radio', tempo: 0, root: 0, wave: 'sine', minor: false },
];

const TRACKS = [
  ['Golden Hour Drive', 'Neon Palms', 'Salt Air', 'Boardwalk Lights'],
  ['Midnight Tide', 'Chrome Sunset', 'Harbor Lights', 'Vela Nights'],
  ['Cumbia del Mar', 'Baila Sol', 'Puerto Alegre', 'La Marea'],
  ['The Night Desk', 'Coast to Coast', 'Velamar After Dark', 'Callers Line'],
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.station = 0;
    this.muted = false;
    this.radioOn = true;
    this.step = 0;
    this.nextStepTime = 0;
    this.trackIndex = 0;
    this.trackTimer = 0;
    this.noiseBuffer = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.nextStepTime = this.ctx.currentTime + 0.1;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  setStation(i) {
    this.station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
    this.step = 0;
    this.trackIndex = (this.trackIndex + 1) % 4;
    this.trackTimer = 0;
  }

  stationName() {
    return STATIONS[this.station].name;
  }

  trackName() {
    return TRACKS[this.station][this.trackIndex];
  }

  blip(freq, dur, type, vol, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, filterFreq, vol, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  shoot(kind) {
    if (kind === 'shotgun') { this.noise(0.28, 900, 0.7); this.blip(90, 0.2, 'square', 0.4); }
    else if (kind === 'rifle') { this.noise(0.16, 1800, 0.55); this.blip(160, 0.1, 'square', 0.3); }
    else if (kind === 'smg') { this.noise(0.09, 2200, 0.4); this.blip(220, 0.06, 'square', 0.22); }
    else { this.noise(0.12, 1400, 0.5); this.blip(140, 0.09, 'square', 0.28); }
  }

  explosion() {
    this.noise(0.9, 300, 0.9);
    this.blip(48, 0.7, 'sine', 0.6);
    this.noise(0.5, 1200, 0.4, 0.05);
  }

  crash(strength) {
    this.noise(0.25, 500, 0.25 + strength * 0.5);
    this.blip(70, 0.18, 'triangle', 0.3);
  }

  skid() {
    this.noise(0.35, 2600, 0.12);
  }

  pickup() {
    this.blip(660, 0.09, 'sine', 0.3);
    this.blip(880, 0.09, 'sine', 0.3, 0.08);
    this.blip(1320, 0.16, 'sine', 0.3, 0.16);
  }

  phone() {
    this.blip(1180, 0.12, 'sine', 0.22);
    this.blip(1180, 0.12, 'sine', 0.22, 0.2);
  }

  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => this.blip(f, 0.22, 'triangle', 0.3, i * 0.11));
  }

  missionFail() {
    [392, 330, 262, 196].forEach((f, i) => this.blip(f, 0.25, 'sawtooth', 0.2, i * 0.13));
  }

  click() {
    this.blip(900, 0.05, 'square', 0.15);
  }

  setEngine(rpm, on) {
    if (!this.ctx) return;
    const target = on ? 0.05 + rpm * 0.09 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + rpm * 165, this.ctx.currentTime, 0.06);
  }

  setSiren(on, wanted) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.028 + wanted * 0.006 : 0, this.ctx.currentTime, 0.2);
    if (on) {
      const t = this.ctx.currentTime;
      this.sirenOsc.frequency.cancelScheduledValues(t);
      this.sirenOsc.frequency.setValueAtTime(660, t);
      this.sirenOsc.frequency.linearRampToValueAtTime(920, t + 0.45);
      this.sirenOsc.frequency.linearRampToValueAtTime(660, t + 0.9);
    }
  }

  // Tiny step sequencer: one bass note + one lead note per 16th step.
  updateRadio(dt) {
    if (!this.ctx || !this.radioOn || this.muted) return;
    const st = STATIONS[this.station];
    if (st.tempo === 0) {
      // Talk station: soft static bed + occasional blip, no melody.
      if (Math.random() < dt * 0.25) this.blip(300 + Math.random() * 200, 0.08, 'sine', 0.03);
      return;
    }
    this.trackTimer += dt;
    if (this.trackTimer > 42) { this.trackTimer = 0; this.trackIndex = (this.trackIndex + 1) % 4; }
    const stepDur = 60 / st.tempo / 4;
    while (this.nextStepTime < this.ctx.currentTime + 0.12) {
      const t = this.nextStepTime;
      const s = this.step;
      const scale = st.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
      const bassDeg = [0, 0, 5, 3][Math.floor(s / 16) % 4];
      if (s % 4 === 0) this.noteAt(st.root - 12 + scale[bassDeg % 7], stepDur * 3.5, 'sine', 0.5, t);
      if (s % 8 === 6) this.noteAt(st.root + scale[(s * 7 + 3) % 7] + 12, stepDur * 1.5, st.wave, 0.12, t);
      if (s % 2 === 0) this.hatAt(t);
      if (s % 16 === 4 || s % 16 === 12) this.noteAt(st.root + scale[4] + 12, stepDur, st.wave, 0.08, t);
      this.step += 1;
      this.nextStepTime += stepDur;
    }
  }

  noteAt(midi, dur, wave, vol, t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave;
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hatAt(t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicGain);
    src.start(t, Math.random());
    src.stop(t + 0.06);
  }
}
