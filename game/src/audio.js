// All sound in Solmara Heat is synthesised live with WebAudio — no audio files, no
// network. Engine hum follows the driven car's speed, the police siren is a two-tone
// wail, gunshots and punches are filtered noise bursts, and a low bassline loops under
// the city so the streets never feel silent.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch { /* audio is decoration, never fatal */ }
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    try {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1200;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch { /* ignore */ }
  }

  // A slow, moody bassline in A minor — the city's own theme, written for this game.
  const BASSLINE = [55, 0, 55, 65.41, 0, 49, 0, 55, 55, 0, 82.41, 0, 73.42, 0, 65.41, 49];

  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const freq = BASSLINE[musicStep % BASSLINE.length];
      musicStep += 1;
      if (freq > 0) blip(freq, 0.42, 'triangle', 0.16, freq * 0.99);
    }, 260);
  }

  function setEngine(running, speedNorm) {
    if (!ensure()) return;
    try {
      if (running && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      if (!engineOsc) return;
      const target = running && !muted ? 0.05 + speedNorm * 0.06 : 0.0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(60 + speedNorm * 160, ctx.currentTime, 0.1);
    } catch { /* ignore */ }
  }

  function setSiren(on) {
    if (!ensure()) return;
    try {
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'square';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let high = false;
        sirenTimer = window.setInterval(() => {
          if (!sirenOsc) return;
          high = !high;
          sirenOsc.frequency.setValueAtTime(high ? 880 : 660, ctx.currentTime);
          sirenGain.gain.setTargetAtTime(muted ? 0 : 0.028, ctx.currentTime, 0.05);
        }, 420);
      } else if (!on && sirenOsc) {
        window.clearInterval(sirenTimer);
        sirenTimer = null;
        sirenOsc.stop();
        sirenOsc = null;
        sirenGain = null;
      }
    } catch { /* ignore */ }
  }

  return {
    unlock() { ensure(); startMusic(); },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() { return muted; },
    shot() { noise(0.14, 0.5, 2400); blip(190, 0.09, 'square', 0.22, 60); },
    punch() { noise(0.09, 0.4, 700); },
    pickup() { blip(660, 0.1, 'sine', 0.25); blip(990, 0.16, 'sine', 0.25); },
    cash() { blip(880, 0.08, 'sine', 0.22); window.setTimeout(() => blip(1320, 0.14, 'sine', 0.22), 80); },
    crash() { noise(0.3, 0.55, 500); },
    busted() { blip(440, 0.5, 'sawtooth', 0.2, 110); },
    mission() { blip(523, 0.12, 'sine', 0.25); window.setTimeout(() => blip(784, 0.2, 'sine', 0.25), 120); },
    setEngine,
    setSiren,
  };
}
