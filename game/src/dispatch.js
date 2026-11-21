// VELAMAR DISPATCH — the explicit dispatch system.
// Central dispatch issues paid jobs (taxi fare, courier, getaway, vigilante),
// tracks them in the HUD, and runs the police radio feed. This is the city's
// job board: press T anywhere to open it, accept a job, follow the marker.
import { S, DISTRICTS } from './state.js';
import { makeRng, pick, rangeInt } from './rng.js';
import { AudioSys } from './audio.js';

const JOB_KINDS = [
  { kind: 'fare', title: 'Taxi Fare', pay: [120, 300],
    desc: (d) => `Pick up a fare in ${d} and drop them across town. Clean driving, no cops.` },
  { kind: 'courier', title: 'Courier Run', pay: [180, 420],
    desc: (d) => `A sealed package waits in ${d}. Deliver it fast — the client pays for speed.` },
  { kind: 'getaway', title: 'Getaway Driver', pay: [400, 800],
    desc: (d) => `A crew is hot in ${d}. Get them out of the district before the cops close in.` },
  { kind: 'vigilante', title: 'Vigilante Call', pay: [300, 600],
    desc: (d) => `Dispatch flagged armed thugs in ${d}. Put them down, the city pays.` },
  { kind: 'tow', title: 'Tow Job', pay: [150, 350],
    desc: (d) => `A broken-down ride in ${d} needs a push to the garage. Any car will do.` },
];

const RADIO_LINES = [
  'Dispatch: Unit 12, respond to a disturbance on Neon Mile.',
  'Dispatch: 10-20 at Harbor Lights, keep it quiet.',
  'Dispatch: taxi fare waiting at Marina Row, any driver free?',
  'Dispatch: report of a stolen coupe near Civic Plaza.',
  'Dispatch: all units, watch for a purple sports car, last seen Downtown.',
  'Dispatch: courier pickup at the Docks, code 2.',
  'Dispatch: beach patrol, nothing to report on the south shore.',
  'Dispatch: a driver just made the leaderboard on Neon Mile. Again.',
];

export const Dispatch = {
  jobs: [],
  feed: [],
  radioTimer: 18,
  rng: makeRng(99),

  init() {
    this.jobs = [];
    this.feed = [];
    this.refreshJobs();
  },

  districtName(x, z) {
    let best = DISTRICTS[0], bd = 1e18;
    for (const d of DISTRICTS) {
      const dd = (d.cx - x) ** 2 + (d.cz - z) ** 2;
      if (dd < bd) { bd = dd; best = d; }
    }
    return best.name;
  },

  refreshJobs() {
    this.jobs = [];
    const used = new Set();
    for (let i = 0; i < 4; i++) {
      const kind = pick(this.rng, JOB_KINDS);
      const d = pick(this.rng, DISTRICTS);
      if (used.has(d.name + kind.kind)) { i--; continue; }
      used.add(d.name + kind.kind);
      const pay = rangeInt(this.rng, kind.pay[0], kind.pay[1]);
      const tx = d.cx + rangeInt(this.rng, -60, 60);
      const tz = d.cz + rangeInt(this.rng, -60, 60);
      this.jobs.push({
        id: `job-${Date.now()}-${i}`,
        kind: kind.kind, title: kind.title, pay,
        desc: kind.desc(d.name),
        x: tx, z: tz,
        targetX: d.cx + rangeInt(this.rng, -200, 200),
        targetZ: d.cz + rangeInt(this.rng, -200, 200),
        district: d.name,
      });
    }
  },

  acceptJob(job) {
    S.dispatchJob = {
      ...job, step: 0, timer: job.kind === 'fare' || job.kind === 'courier' ? 120 : 0,
      kills: 0,
    };
    this.jobs = this.jobs.filter((j) => j.id !== job.id);
    this.say(`Dispatch: job accepted — ${job.title}. Marker set, good luck out there.`);
    AudioSys.dispatchBeep();
    return S.dispatchJob;
  },

  say(text) {
    this.feed.unshift({ tag: 'DISPATCH', text, t: S.time });
    if (this.feed.length > 5) this.feed.pop();
    if (window.__velamarFeedRender) window.__velamarFeedRender();
  },

  policeSay(text) {
    this.feed.unshift({ tag: 'POLICE', text, t: S.time });
    if (this.feed.length > 5) this.feed.pop();
    if (window.__velamarFeedRender) window.__velamarFeedRender();
  },

  // Per-frame: ambient radio chatter + job timer.
  update(dt) {
    this.radioTimer -= dt;
    if (this.radioTimer <= 0) {
      this.radioTimer = 16 + Math.random() * 14;
      this.policeSay(pick(this.rng, RADIO_LINES));
    }
    const job = S.dispatchJob;
    if (job && job.timer > 0) {
      job.timer -= dt;
      if (job.timer <= 0) {
        this.say('Dispatch: job timed out. The client went with someone else.');
        S.dispatchJob = null;
        if (window.__velamarJobFailed) window.__velamarJobFailed();
      }
    }
  },

  completeJob() {
    const job = S.dispatchJob;
    if (!job) return;
    S.cash += job.pay;
    S.respect += 5;
    this.say(`Dispatch: ${job.title} complete. $${job.pay} wired to you. Nice driving.`);
    AudioSys.cash();
    S.dispatchJob = null;
    if (this.jobs.length < 3) this.refreshJobs();
    if (window.__velamarJobDone) window.__velamarJobDone(job);
  },

  abandonJob() {
    if (!S.dispatchJob) return;
    this.say('Dispatch: job dropped. No pay for a no-show.');
    S.dispatchJob = null;
  },
};
