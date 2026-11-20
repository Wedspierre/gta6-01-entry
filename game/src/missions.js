// Velamar — the story. Fourteen story jobs across three acts, plus side work:
// taxi fares, three street-race circuits, five stunt jumps, twenty hidden
// packages and a rampage. Dario Voss comes home to Velamar; Selma Reyes,
// Mara Quinn and Tico Alvarez help him take the city back from Viktor Kross,
// the Harbormaster who owns the docks. All names, places and lines are original.
import * as THREE from 'three';
import { makeRng } from './rng.js';

export const STORY = [
  { id: 1, act: 'ACT 1 — HOMECOMING', title: 'Welcome Back', giver: 'Selma Reyes',
    briefing: 'Dario. Three years gone and the city forgot you. Get to the Marina safehouse. Keys are under the mat. Do not get cute on the way.',
    steps: [{ type: 'goto', x: 40, z: 250, r: 10, label: 'Reach the Marina safehouse' }],
    reward: 300, respect: 10 },
  { id: 2, act: 'ACT 1 — HOMECOMING', title: 'Wheels', giver: 'Selma Reyes',
    briefing: 'You need wheels that are not a bus. Jack a coupe anywhere in the city and bring it to the garage on The Strip. Try not to scratch it.',
    steps: [
      { type: 'steal', kind: 'coupe', label: 'Steal a coupe' },
      { type: 'goto', x: 300, z: 0, r: 12, label: 'Deliver the coupe to the garage', inCar: true },
    ],
    reward: 900, respect: 15 },
  { id: 3, act: 'ACT 1 — HOMECOMING', title: 'First Fare', giver: 'Tico Alvarez',
    briefing: 'Cab work pays the rent and nobody looks twice at a cab. Two fares, both in a hurry. Keep the meter running and the doors shut.',
    steps: [
      { type: 'deliver', x: -200, z: -100, r: 10, timer: 75, label: 'Drop fare 1 at Old Port' },
      { type: 'deliver', x: 200, z: -200, r: 10, timer: 75, label: 'Drop fare 2 at North Hills' },
    ],
    reward: 700, respect: 12 },
  { id: 4, act: 'ACT 1 — HOMECOMING', title: 'The Drop', giver: 'Selma Reyes',
    briefing: 'A package for the Old Port crew. The VCPD sniffed the route, so expect a tail. Lose them, make the drop, walk away clean.',
    steps: [{ type: 'deliver', x: -300, z: 100, r: 10, timer: 90, label: 'Deliver the package to Old Port', heat: 1 }],
    reward: 1200, respect: 18 },
  { id: 5, act: 'ACT 2 — THE CREW', title: "Mara's Signal", giver: 'Mara Quinn',
    briefing: 'I planted three data drops around Downtown. Grab them all before Kross sweeps the grid. Ninety seconds. Move.',
    steps: [{ type: 'collect', spots: [[-100, -100], [100, 100], [0, -200]], r: 8, timer: 90, label: 'Collect the 3 data drops' }],
    reward: 1600, respect: 20 },
  { id: 6, act: 'ACT 2 — THE CREW', title: 'Street Kings', giver: 'Tico Alvarez',
    briefing: 'The Strip runs a midnight circuit and the Sharks think they own it. Beat their best time through all eight gates and the street is ours.',
    steps: [{ type: 'race', points: [[200, 100], [300, 100], [300, 200], [200, 200], [200, 300], [300, 300], [350, 200], [300, 0]], timer: 110, label: 'Race the Strip circuit' }],
    reward: 2200, respect: 25 },
  { id: 7, act: 'ACT 2 — THE CREW', title: 'Harbor Lights', giver: 'Selma Reyes',
    briefing: 'Kross stores his ledger in a dockside crate. His guards are not paid to be brave. Clear the pier, take the crate, get out.',
    steps: [
      { type: 'kill', x: -350, z: 250, count: 5, label: 'Clear the dock guards' },
      { type: 'collect', spots: [[-350, 250]], r: 8, label: 'Take the ledger crate' },
    ],
    reward: 3000, respect: 30 },
  { id: 8, act: 'ACT 2 — THE CREW', title: 'Heat Wave', giver: 'Mara Quinn',
    briefing: 'I tripped a citywide alarm by accident. On purpose, maybe. The VCPD is coming in hot — survive ninety seconds at three stars.',
    steps: [{ type: 'survive', seconds: 90, heat: 3, label: 'Survive the VCPD response' }],
    reward: 2600, respect: 28 },
  { id: 9, act: 'ACT 2 — THE CREW', title: 'Protect the Fixer', giver: 'Selma Reyes',
    briefing: 'The Sharks found my office. Six of them, outside, right now. Dario — do what you do.',
    steps: [{ type: 'kill', x: -40, z: 60, count: 6, label: 'Defend Selma\'s office' }],
    reward: 3400, respect: 32 },
  { id: 10, act: 'ACT 3 — KING TIDE', title: 'The Setup', giver: 'Tico Alvarez',
    briefing: 'The big one needs a van, a quiet warehouse and no questions. Jack a van, park it at the warehouse on the docks.',
    steps: [
      { type: 'steal', kind: 'van', label: 'Steal a van' },
      { type: 'goto', x: -300, z: 300, r: 12, label: 'Park the van at the warehouse', inCar: true },
    ],
    reward: 2400, respect: 22 },
  { id: 11, act: 'ACT 3 — KING TIDE', title: 'Air One', giver: 'Mara Quinn',
    briefing: 'Air One is over Downtown and every cruiser in the city is rolling. Seventy-five seconds of pure getaway. Show them what a Voss can drive.',
    steps: [{ type: 'survive', seconds: 75, heat: 3, label: 'Outrun Air One' }],
    reward: 4200, respect: 35 },
  { id: 12, act: 'ACT 3 — KING TIDE', title: 'Roadblock Run', giver: 'Selma Reyes',
    briefing: 'Four gates across the city, four stars on your head, roadblocks on every avenue. Thread them all. Kross is watching.',
    steps: [{ type: 'race', points: [[-200, -200], [0, -300], [200, -100], [0, 200]], timer: 120, heat: 4, label: 'Run the four roadblock gates' }],
    reward: 5600, respect: 40 },
  { id: 13, act: 'ACT 3 — KING TIDE', title: 'The Vault', giver: 'Selma Reyes',
    briefing: 'Bank of Velamar. Eight guards, four vault bags, one very loud alarm. Take it all and meet Tico at the Marina.',
    steps: [
      { type: 'kill', x: 0, z: -100, count: 8, label: 'Clear the bank floor' },
      { type: 'collect', spots: [[-20, -120], [20, -120], [-20, -80], [20, -80]], r: 8, label: 'Grab the 4 vault bags' },
      { type: 'goto', x: 40, z: 250, r: 10, label: 'Escape to the Marina safehouse' },
    ],
    reward: 12000, respect: 60 },
  { id: 14, act: 'ACT 3 — KING TIDE', title: 'King of Velamar', giver: 'Mara Quinn',
    briefing: 'Five stars. The whole city. Kross on the pier with his crew. Race to the pier, stand your ground, and take Velamar back.',
    steps: [
      { type: 'race', points: [[100, 300], [-50, 350], [-150, 420]], timer: 90, heat: 5, label: 'Race to the pier' },
      { type: 'kill', x: -150, z: 430, count: 6, label: 'Take the pier from Kross\'s crew' },
      { type: 'survive', seconds: 45, heat: 5, label: 'Hold the pier' },
    ],
    reward: 15000, respect: 100 },
];

export const RACES = [
  { name: 'Strip Circuit', points: [[200, 100], [300, 100], [300, 200], [200, 200], [200, 300], [300, 300], [350, 200], [300, 0]], start: [200, 100], par: 110 },
  { name: 'Downtown Loop', points: [[-100, -100], [100, -100], [100, 100], [-100, 100], [-100, -200], [0, -200]], start: [-100, -100], par: 95 },
  { name: 'Beachfront Sprint', points: [[-300, 350], [0, 350], [300, 350], [350, 200], [350, 0]], start: [-300, 350], par: 85 },
];

export const JUMP_SPOTS = [
  { x: -150, z: 300, dir: 0 }, { x: 250, z: -100, dir: 1 },
  { x: 0, z: 350, dir: 0 }, { x: -300, z: -200, dir: 1 }, { x: 350, z: 250, dir: 0 },
];

export const PACKAGE_SPOTS = [
  [-420, -420], [-320, -120], [-220, 220], [-120, -320], [-20, 20], [80, -220],
  [180, 120], [280, -320], [380, 220], [420, -20], [-380, 320], [-180, 380],
  [120, 380], [220, -20], [-60, -420], [320, 320], [-420, 20], [40, -380],
  [420, 380], [-280, -380],
];

export const RANKS = [
  { at: 0, name: 'Street Punk' }, { at: 60, name: 'Hustler' },
  { at: 150, name: 'Wheelman' }, { at: 280, name: 'Shot Caller' },
  { at: 450, name: 'King of Velamar' },
];

export function rankFor(respect) {
  let r = RANKS[0];
  for (const rank of RANKS) if (respect >= rank.at) r = rank;
  return r.name;
}

function makeBeacon() {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.4, 60, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  g.add(beam);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 0.28, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  g.add(ring);
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }),
  );
  dot.position.y = 1;
  g.add(dot);
  g.visible = false;
  return g;
}

function makePickup(color) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.1, 1.1),
    new THREE.MeshBasicMaterial({ color }),
  );
  m.rotation.y = Math.PI / 4;
  return m;
}

export class MissionRunner {
  constructor(scene) {
    this.scene = scene;
    this.beacon = makeBeacon();
    scene.add(this.beacon);
    this.active = null; // { def, stepIndex, timer, kills, collected, raceIndex }
    this.completed = new Set();
    this.taxi = null;
    this.race = null;
    this.rampage = null;
    this.packages = [];
    this.packageSpots = PACKAGE_SPOTS.map(([x, z]) => ({ x, z, taken: false, mesh: null }));
    this.jumps = [];
    this.jumpCooldown = 0;
    this.pickups = [];
    this.rng = makeRng(31337);
  }

  buildWorld() {
    // Hidden packages glow around the city.
    for (const p of this.packageSpots) {
      const m = makePickup(0x39d0c2);
      m.position.set(p.x, 1.2, p.z);
      this.scene.add(m);
      p.mesh = m;
    }
    // Stunt ramps: wedges the player can launch off.
    for (const j of JUMP_SPOTS) {
      const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(7, 1, 12),
        new THREE.MeshLambertMaterial({ color: 0xe8a13a }),
      );
      ramp.position.set(j.x, 1.1, j.z);
      ramp.rotation.z = j.dir ? 0 : 0.35;
      ramp.rotation.x = j.dir ? -0.35 : 0;
      ramp.castShadow = true;
      this.scene.add(ramp);
      this.jumps.push({ ...j, mesh: ramp });
    }
  }

  startMission(index, ctx) {
    const def = STORY[index];
    if (!def) return false;
    this.active = { def, stepIndex: 0, timer: 0, kills: 0, collected: 0, raceIndex: 0, spawned: false };
    ctx.hud.showPhone(def.giver, def.briefing);
    ctx.hud.banner(`${def.act} — ${def.title}`, 'New mission');
    ctx.audio.phone();
    this.enterStep(ctx);
    return true;
  }

  enterStep(ctx) {
    const st = this.currentStep();
    if (!st) return;
    const a = this.active;
    a.timer = st.timer || 0;
    a.raceIndex = 0;
    a.collected = 0;
    a.spawned = false;
    if (st.heat !== undefined) ctx.police.setWanted(st.heat);
    if (st.type === 'kill') {
      // Spawn the crew on the nearest road so they are visible and reachable,
      // never inside a building.
      const road = ctx.city.nearestRoad(st.x, st.z);
      ctx.enemies.spawn(road.x, road.z, st.count, st.count >= 8 ? 80 : 60);
      a.spawned = true;
    }
    if (st.type === 'collect') {
      this.clearPickups();
      for (const [x, z] of st.spots) {
        const m = makePickup(0xffd23a);
        m.position.set(x, 1.2, z);
        this.scene.add(m);
        this.pickups.push(m);
      }
    }
    if (st.type === 'race') {
      a.raceIndex = 0;
    }
    this.updateBeacon(ctx);
  }

  clearPickups() {
    for (const m of this.pickups) this.scene.remove(m);
    this.pickups = [];
  }

  currentStep() {
    if (!this.active) return null;
    return this.active.def.steps[this.active.stepIndex] || null;
  }

  stepTarget() {
    const st = this.currentStep();
    if (!st) return null;
    const a = this.active;
    if (st.type === 'race') return st.points[a.raceIndex];
    if (st.type === 'collect' && st.spots[a.collected]) return st.spots[a.collected];
    if (st.type === 'goto' || st.type === 'deliver' || st.type === 'kill') return [st.x, st.z];
    return null;
  }

  updateBeacon(ctx) {
    const t = this.stepTarget();
    if (!t) { this.beacon.visible = false; return; }
    this.beacon.visible = true;
    this.beacon.position.set(t[0], 0, t[1]);
  }

  objectiveText(ctx) {
    if (this.race) return `${this.race.def.name} — gate ${this.race.index + 1}/${this.race.def.points.length} — ${Math.ceil(this.race.timer)}s`;
    if (this.taxi) return `Taxi fare — drop the passenger (${Math.ceil(this.taxi.timer)}s)`;
    if (this.rampage) return `RAMPAGE — wreck ${this.rampage.left} more vehicles (${Math.ceil(this.rampage.timer)}s)`;
    if (!this.active) return null;
    const st = this.currentStep();
    if (!st) return null;
    let label = st.label;
    if (st.type === 'kill') label += ` — ${this.active.kills}/${st.count}`;
    if (st.type === 'collect') label += ` — ${this.active.collected}/${st.spots.length}`;
    if (st.type === 'race') label += ` — gate ${this.active.raceIndex + 1}/${st.points.length}`;
    if (st.type === 'survive') label += ` — ${Math.ceil(this.active.timer)}s`;
    if (st.timer) label += ` — ${Math.ceil(this.active.timer)}s`;
    return label;
  }

  fail(ctx, reason) {
    ctx.audio.missionFail();
    ctx.hud.banner('MISSION FAILED', reason);
    ctx.enemies.clear();
    this.clearPickups();
    this.active = null;
    this.beacon.visible = false;
    ctx.police.setWanted(0);
  }

  completeStep(ctx) {
    const a = this.active;
    a.stepIndex += 1;
    if (a.stepIndex >= a.def.steps.length) {
      this.completeMission(ctx);
    } else {
      ctx.audio.pickup();
      this.enterStep(ctx);
    }
  }

  completeMission(ctx) {
    const def = this.active.def;
    ctx.addCash(def.reward);
    ctx.addRespect(def.respect);
    ctx.audio.missionDone();
    ctx.hud.banner('MISSION PASSED', `${def.title} — $${def.reward.toLocaleString()} + ${def.respect} respect`);
    ctx.hud.showPhone(def.giver, 'Clean work. Next job is on the board when you are ready.');
    this.completed.add(def.id);
    ctx.saveGame();
    this.active = null;
    this.beacon.visible = false;
    ctx.enemies.clear();
    this.clearPickups();
  }

  update(dt, ctx) {
    const pos = ctx.playerCar ? ctx.playerCar.pos : ctx.player.pos;
    // Hidden packages: spin, bob, collect on touch.
    for (const p of this.packageSpots) {
      if (p.taken) continue;
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = 1.2 + Math.sin(performance.now() * 0.002 + p.x) * 0.25;
      const d = Math.hypot(p.mesh.position.x - pos.x, p.mesh.position.z - pos.z);
      if (d < 2.2) {
        p.taken = true;
        this.scene.remove(p.mesh);
        ctx.addCash(250);
        ctx.audio.pickup();
        ctx.hud.toast('Hidden package — $250');
      }
    }
    for (const m of this.pickups) {
      m.rotation.y += dt * 3;
      m.position.y = 1.2 + Math.sin(performance.now() * 0.003) * 0.2;
    }
    // Stunt jumps: launching a car off a ramp scores.
    this.jumpCooldown -= dt;
    if (ctx.playerCar && this.jumpCooldown <= 0) {
      for (const j of this.jumps) {
        const d = Math.hypot(j.x - ctx.playerCar.pos.x, j.z - ctx.playerCar.pos.z);
        if (d < 6 && Math.abs(ctx.playerCar.speed) > 26) {
          this.jumpCooldown = 4;
          ctx.addCash(400);
          ctx.addRespect(3);
          ctx.audio.pickup();
          ctx.hud.toast('STUNT JUMP — $400');
          break;
        }
      }
    }

    // Taxi fares.
    if (this.taxi) {
      this.taxi.timer -= dt;
      const d = Math.hypot(this.taxi.x - pos.x, this.taxi.z - pos.z);
      if (d < 10) {
        const fare = this.taxi.fare;
        ctx.addCash(fare);
        ctx.addRespect(2);
        ctx.audio.pickup();
        ctx.hud.toast(`Fare complete — $${fare}`);
        this.taxi = null;
        this.beacon.visible = false;
      } else if (this.taxi.timer <= 0) {
        ctx.hud.toast('Fare missed — passenger walked off');
        this.taxi = null;
        this.beacon.visible = false;
      }
    }

    // Street races.
    if (this.race) {
      this.race.timer -= dt;
      const pt = this.race.def.points[this.race.index];
      const d = Math.hypot(pt[0] - pos.x, pt[1] - pos.z);
      if (d < 12) {
        this.race.index += 1;
        ctx.audio.pickup();
        if (this.race.index >= this.race.def.points.length) {
          const bonus = Math.max(300, Math.round(1200 - (this.race.def.par - this.race.timer) * 8));
          ctx.addCash(bonus);
          ctx.addRespect(10);
          ctx.hud.banner('RACE WON', `${this.race.def.name} — $${bonus}`);
          ctx.audio.missionDone();
          this.race = null;
          this.beacon.visible = false;
        } else {
          this.updateBeacon(ctx);
        }
      } else if (this.race.timer <= 0) {
        ctx.hud.toast('Race lost — out of time');
        this.race = null;
        this.beacon.visible = false;
      }
    }

    // Rampage.
    if (this.rampage) {
      this.rampage.timer -= dt;
      if (this.rampage.left <= 0) {
        ctx.addCash(1500);
        ctx.addRespect(12);
        ctx.hud.banner('RAMPAGE COMPLETE', '$1,500');
        ctx.audio.missionDone();
        this.rampage = null;
      } else if (this.rampage.timer <= 0) {
        ctx.hud.toast('Rampage over');
        this.rampage = null;
      }
    }

    // Story mission steps.
    if (!this.active) return;
    const a = this.active;
    const st = this.currentStep();
    if (!st) return;
    if (st.timer) {
      a.timer -= dt;
      if (a.timer <= 0) { this.fail(ctx, 'Out of time'); return; }
    }
    if (st.type === 'goto' || st.type === 'deliver') {
      if (st.inCar && !ctx.playerCar) return;
      const d = Math.hypot(st.x - pos.x, st.z - pos.z);
      if (d < st.r) this.completeStep(ctx);
    } else if (st.type === 'steal') {
      if (ctx.playerCar && ctx.playerCar.kind === st.kind) this.completeStep(ctx);
    } else if (st.type === 'kill') {
      a.kills = st.count - ctx.enemies.countAlive();
      if (ctx.enemies.countAlive() === 0 && a.spawned) this.completeStep(ctx);
    } else if (st.type === 'collect') {
      for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
        const m = this.pickups[i];
        if (Math.hypot(m.position.x - pos.x, m.position.z - pos.z) < 3) {
          this.scene.remove(m);
          this.pickups.splice(i, 1);
          a.collected += 1;
          ctx.audio.pickup();
        }
      }
      if (a.collected >= st.spots.length) this.completeStep(ctx);
    } else if (st.type === 'race') {
      const pt = st.points[a.raceIndex];
      const d = Math.hypot(pt[0] - pos.x, pt[1] - pos.z);
      if (d < 12) {
        a.raceIndex += 1;
        ctx.audio.pickup();
        if (a.raceIndex >= st.points.length) this.completeStep(ctx);
        else this.updateBeacon(ctx);
      }
    } else if (st.type === 'survive') {
      if (!a.timer) a.timer = st.seconds;
      a.timer -= dt;
      if (a.timer <= 0) {
        ctx.police.setWanted(0);
        this.completeStep(ctx);
      }
    }
    // Beacon pulse.
    if (this.beacon.visible) {
      const s = 1 + Math.sin(performance.now() * 0.004) * 0.12;
      this.beacon.scale.set(s, 1, s);
    }
  }

  startTaxi(ctx) {
    if (this.taxi || !ctx.playerCar) return false;
    const spots = [[-200, -100], [200, -200], [0, 300], [-350, 50], [350, -250], [100, 0]];
    const [x, z] = spots[Math.floor(Math.random() * spots.length)];
    this.taxi = { x, z, timer: 80, fare: 80 + Math.floor(Math.random() * 140) };
    this.beacon.visible = true;
    this.beacon.position.set(x, 0, z);
    ctx.hud.toast('Taxi fare — passenger is waiting');
    ctx.audio.phone();
    return true;
  }

  startRace(ctx, index) {
    const def = RACES[index % RACES.length];
    this.race = { def, index: 0, timer: def.par };
    this.beacon.visible = true;
    this.beacon.position.set(def.points[0][0], 0, def.points[0][1]);
    ctx.hud.banner(def.name, 'Reach every gate before time runs out');
    return true;
  }

  startRampage(ctx) {
    this.rampage = { timer: 90, left: 8 };
    ctx.police.setWanted(2);
    ctx.hud.banner('RAMPAGE', 'Wreck 8 vehicles in 90 seconds');
    return true;
  }

  onVehicleWrecked() {
    if (this.rampage) this.rampage.left -= 1;
  }
}
