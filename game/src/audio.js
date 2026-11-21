// All sound is synthesized with WebAudio — no audio files, no network.
import { S, RADIO_STATIONS } from './state.js';

let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let radioTimer = 0;
let radioStep = 0;
let radioNodes = [];

function ensureCtx() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700;
    engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start();
  } catch { ctx = null; }
  return ctx;
}

export function unlockAudio() { const c = ensureCtx(); if (c && c.state === 'suspended') c.resume(); }

function blip(freq, dur, type, vol, slideTo) {
  if (!ensureCtx()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol, filterFreq) {
  if (!ensureCtx()) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

export const AudioSys = {
  shoot() { noiseBurst(0.12, 0.5, 1800); blip(160, 0.08, 'square', 0.25, 60); },
  shotgun() { noiseBurst(0.25, 0.7, 900); },
  hit() { blip(220, 0.07, 'triangle', 0.3, 110); },
  pickup() { blip(660, 0.09, 'sine', 0.3); setTimeout(() => blip(990, 0.12, 'sine', 0.3), 90); },
  cash() { blip(880, 0.1, 'sine', 0.35); setTimeout(() => blip(1320, 0.18, 'sine', 0.35), 110); },
  missionComplete() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.35), i * 120));
  },
  missionFail() { blip(330, 0.4, 'sawtooth', 0.25, 110); },
  door() { noiseBurst(0.08, 0.25, 2500); },
  crash() { noiseBurst(0.3, 0.6, 500); },
  horn() { blip(370, 0.25, 'square', 0.2); setTimeout(() => blip(370, 0.25, 'square', 0.2), 280); },
  dispatchBeep() { blip(1180, 0.07, 'sine', 0.22); setTimeout(() => blip(1180, 0.07, 'sine', 0.22), 120); },
  wantedUp() { blip(440, 0.15, 'square', 0.2, 660); },
  busted() { [392, 311, 233].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.25), i * 180)); },

  // Called every frame: engine hum follows speed, siren wails while wanted.
  update(dt, speed, wanted) {
    if (!ctx) return;
    const target = S.phase === 'playing' && speed > 0.5 ? 0.05 + Math.min(0.16, speed * 0.003) : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(45 + speed * 2.2, ctx.currentTime, 0.08);
    if (wanted > 0 && S.phase === 'playing') {
      const t = ctx.currentTime;
      sirenGain.gain.setTargetAtTime(0.045, t, 0.2);
      const phase = (performance.now() / 700) % 2;
      sirenOsc.frequency.setTargetAtTime(phase < 1 ? 720 : 960, t, 0.05);
    } else {
      sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    }
    this.updateRadio(dt);
  },

  // Tiny step sequencer: one bass note + one lead note per step, station flavour.
  updateRadio(dt) {
    if (!ctx || !S.radioOn || S.phase !== 'playing') return;
    const st = RADIO_STATIONS[S.radioStation];
    const stepDur = 60 / st.bpm / 2;
    radioTimer += dt;
    if (radioTimer < stepDur) return;
    radioTimer -= stepDur;
    radioStep = (radioStep + 1) % 32;
    const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const bassNote = st.root + st.scale[radioStep % st.scale.length];
    const leadNote = st.root + 12 + st.scale[(radioStep * 3 + 1) % st.scale.length];
    const t = ctx.currentTime;
    const mk = (freq, type, vol, dur) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
      radioNodes.push(o);
    };
    if (radioStep % 2 === 0) mk(midi(bassNote), st.wave, 0.10, stepDur * 1.8);
    if (radioStep % 4 === 1) mk(midi(leadNote), 'sine', 0.07, stepDur * 2.2);
    if (radioStep % 8 === 4) noiseBurst(0.03, 0.05, 6000);
    if (radioNodes.length > 40) radioNodes.splice(0, radioNodes.length - 40);
  },

  nextStation() {
    S.radioStation = (S.radioStation + 1) % RADIO_STATIONS.length;
    radioStep = 0;
    return RADIO_STATIONS[S.radioStation].name;
  },
};
