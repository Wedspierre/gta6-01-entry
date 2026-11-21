// The 14-mission story campaign. Each mission is a list of steps; the engine
// below advances steps as the player reaches markers, talks, defends, races,
// escapes or smashes roadblocks. Mission state lives in S.missionState.
import * as THREE from 'three';
import { S, MISSIONS } from './state.js';
import { Dispatch } from './dispatch.js';
import { Police } from './police.js';
import { AudioSys } from './audio.js';
import { makePedestrian, buildPersonMesh } from './people.js';
import { makeRng, range } from './rng.js';
import { CAR_MODELS, makeCar } from './vehicles.js';

export const Missions = {
  scene: null,
  beacon: null,
  npcs: [],
  enemies: [],
  raceCheckpoints: [],
  escortTruck: null,
  stepTimer: 0,
  waitTimer: 0,

  init(scene, beacon) {
    this.scene = scene;
    this.beacon = beacon;
    this.npcs = [];
    this.enemies = [];
  },

  current() { return MISSIONS[S.missionIndex] ?? null; },
  currentStep() {
    const m = this.current();
    return m ? m.steps[S.missionStep] : null;
  },

  startMission(index) {
    const m = MISSIONS[index];
    if (!m) return;
    S.missionIndex = index;
    S.missionStep = 0;
    S.missionState = { kills: 0, smashed: 0, checkpoints: 0, escorted: 0 };
    this.clearActors();
    this.say(m.name, m.intro);
    Dispatch.say(`Dispatch: new job on the board — "${m.name}", from ${m.giver}.`);
    this.showMarker();
    AudioSys.dispatchBeep();
  },

  say(title, text) {
    if (window.__velamarToast) window.__velamarToast(title, text);
  },

  // Where the current step points.
  stepTarget() {
    const step = this.currentStep();
    if (!step) return null;
    if (step.kind === 'race' || step.kind === 'escort') {
      const cp = this.raceCheckpoints[S.missionState.checkpoints];
      if (cp) return { x: cp.x, z: cp.z };
    }
    if (step.x !== undefined) return { x: step.x, z: step.z };
    if (this.escortTruck) return { x: this.escortTruck.pos.x, z: this.escortTruck.pos.z };
    return null;
  },

  showMarker() {
    const t = this.stepTarget();
    if (t && this.beacon) {
      this.beacon.position.set(t.x, 0, t.z);
      this.beacon.visible = true;
    } else if (this.beacon) {
      this.beacon.visible = false;
    }
  },

  hideMarker() { if (this.beacon) this.beacon.visible = false; },

  clearActors() {
    for (const n of this.npcs) this.scene.remove(n.mesh);
    for (const e of this.enemies) this.scene.remove(e.mesh);
    if (this.escortTruck) { this.scene.remove(this.escortTruck.mesh); this.escortTruck = null; }
    this.npcs = [];
    this.enemies = [];
    this.raceCheckpoints = [];
  },

  spawnEnemy(x, z) {
    const rng = makeRng((Math.random() * 1e9) | 0);
    const e = makePedestrian(this.scene, rng, x, z, { shirt: 0x1a1a1a, role: 'enemy' });
    e.state = 'chase';
    e.speed = 4.2;
    e.health = 60;
    // Give them a visible weapon: a dark box in the hand.
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }));
    gun.position.set(0.42, 1.05, 0.25);
    e.mesh.add(gun);
    this.enemies.push(e);
    return e;
  },

  spawnDefenders(count, cx, cz) {
    const rng = makeRng((Math.random() * 1e9) | 0);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.spawnEnemy(cx + Math.sin(a) * 22, cz + Math.cos(a) * 22);
    }
  },

  spawnRaceCheckpoints(step) {
    this.raceCheckpoints = [];
    const n = step.laps || 3;
    const cx = step.x, cz = step.z;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.raceCheckpoints.push({ x: cx + Math.sin(a) * 110, z: cz + Math.cos(a) * 110, done: false });
    }
    S.missionState.checkpoints = 0;
  },

  spawnEscortTruck(x, z) {
    const model = CAR_MODELS.find((m) => m.name === 'Bay Van');
    const truck = makeCar(this.scene, model, x, z, 0, { traffic: false });
    truck.targetSpeed = 12;
    this.escortTruck = truck;
    return truck;
  },

  // Step entry hooks.
  enterStep() {
    const step = this.currentStep();
    if (!step) return;
    if (step.kind === 'race') this.spawnRaceCheckpoints(step);
    if (step.kind === 'defend') this.spawnDefenders(step.count, window.__velamarPlayerPos?.x ?? 0, window.__velamarPlayerPos?.z ?? 0);
    if (step.kind === 'escort') this.spawnEscortTruck(step.x, step.z);
    if (step.kind === 'wait') this.waitTimer = step.seconds;
    if (step.kind === 'talk') this.spawnTalkNpc(step.x, step.z);
    if (step.kind === 'fly') this.say('Air One', 'The helicopter is on the pad. Get in and fly north.');
    this.showMarker();
  },

  spawnTalkNpc(x, z) {
    const rng = makeRng(42);
    const npc = makePedestrian(this.scene, rng, x + 3, z + 2, { name: 'Mara Voss', role: 'npc', shirt: 0x8f2ad8 });
    npc.state = 'idle';
    this.npcs.push(npc);
    return npc;
  },

  advanceStep() {
    const m = this.current();
    if (!m) return;
    S.missionStep++;
    AudioSys.pickup();
    if (S.missionStep >= m.steps.length) {
      this.completeMission();
    } else {
      this.enterStep();
    }
  },

  completeMission() {
    const m = this.current();
    S.cash += m.reward;
    S.respect += m.respect;
    S.missionDone.push(m.id);
    this.say('MISSION COMPLETE', `${m.name} — $${m.reward}  •  +${m.respect} respect`);
    AudioSys.missionComplete();
    Dispatch.say(`Dispatch: "${m.name}" closed out. ${m.giver} sends thanks — and $${m.reward}.`);
    this.clearActors();
    this.hideMarker();
    if (S.missionIndex + 1 < MISSIONS.length) {
      S.missionIndex++;
      S.missionStep = 0;
      S.missionState = {};
      setTimeout(() => this.startMission(S.missionIndex), 2500);
    } else {
      this.say('KING OF VELAMAR', 'You own this city now. Free roam — the bay is yours.');
      S.missionIndex = MISSIONS.length;
    }
  },

  failMission(reason) {
    this.say('MISSION FAILED', reason);
    AudioSys.missionFail();
    this.clearActors();
    S.missionStep = 0;
    S.missionState = {};
    setTimeout(() => this.startMission(S.missionIndex), 2000);
  },

  // Per-frame mission logic. Returns nothing; uses window hooks set by main.js.
  update(dt, api) {
    const m = this.current();
    if (!m || S.phase !== 'playing') return;
    const step = this.currentStep();
    if (!step) return;
    const p = api.playerPos();
    const inCar = api.inCar();
    const speed = api.speed();

    if (step.kind === 'goto' || step.kind === 'talk' || step.kind === 'park') {
      const d = Math.hypot(p.x - step.x, p.z - step.z);
      if (step.kind === 'talk') {
        if (d < 4 && api.pressedE()) { this.advanceStep(); }
      } else if (step.kind === 'park') {
        if (d < 10 && inCar && Math.abs(speed) < 2) this.advanceStep();
      } else if (d < 9) {
        if (step.inCar && !inCar) {
          if (window.__velamarToast) window.__velamarToast('NEED A CAR', 'This step needs a car — steal one (F).');
        } else this.advanceStep();
      }
    } else if (step.kind === 'steal') {
      if (inCar) this.advanceStep();
    } else if (step.kind === 'wait') {
      const t = this.stepTarget();
      const d = t ? Math.hypot(p.x - t.x, p.z - t.z) : 999;
      if (d < 10) {
        this.waitTimer -= dt;
        if (this.waitTimer <= 0) this.advanceStep();
      }
    } else if (step.kind === 'defend') {
      if (S.missionState.kills >= step.count) this.advanceStep();
    } else if (step.kind === 'escape') {
      if (S.wanted === 0) this.advanceStep();
    } else if (step.kind === 'race') {
      const cp = this.raceCheckpoints[S.missionState.checkpoints];
      if (cp && Math.hypot(p.x - cp.x, p.z - cp.z) < 14) {
        S.missionState.checkpoints++;
        AudioSys.pickup();
        if (S.missionState.checkpoints >= this.raceCheckpoints.length) this.advanceStep();
        else this.showMarker();
      }
    } else if (step.kind === 'escort') {
      const truck = this.escortTruck;
      if (truck) {
        const td = Math.hypot(truck.pos.x - step.x, truck.pos.z - step.z);
        if (td < 20) { this.advanceStep(); return; }
        // Truck drives toward the destination on the grid.
        const dx = step.x - truck.pos.x, dz = step.z - truck.pos.z;
        const want = Math.atan2(dx, dz);
        const diff = ((want - truck.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const steer = Math.max(-1, Math.min(1, diff * 1.4));
        const near = Math.hypot(p.x - truck.pos.x, p.z - truck.pos.z);
        const throttle = near < 45 ? 0.7 : 0.25;
        const { driveCar } = { driveCar: api.driveCar };
        driveCar(truck, throttle, steer, dt, api.colliders());
      }
    } else if (step.kind === 'fly') {
      if (api.inHeli()) this.advanceStep();
    } else if (step.kind === 'smash') {
      if (S.missionState.smashed >= step.count) this.advanceStep();
    }
  },

  // Enemies chase and shoot the player.
  updateEnemies(dt, api, colliders) {
    const p = api.playerPos();
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = p.x - e.pos.x, dz = p.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 160) { e.dead = true; this.scene.remove(e.mesh); continue; }
      const want = Math.atan2(dx, dz);
      e.heading += Math.max(-dt * 5, Math.min(dt * 5, ((want - e.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI));
      const speed = d > 14 ? 4.4 : 0;
      e.pos.x += Math.sin(e.heading) * speed * dt;
      e.pos.z += Math.cos(e.heading) * speed * dt;
      e.walkPhase += dt * 10;
      e.mesh.userData.legL.rotation.x = Math.sin(e.walkPhase) * 0.5;
      e.mesh.userData.legR.rotation.x = -Math.sin(e.walkPhase) * 0.5;
      e.mesh.position.set(e.pos.x, 0, e.pos.z);
      e.mesh.rotation.y = e.heading;
      // Shoot when close enough.
      e.shootTimer = (e.shootTimer ?? 1) - dt;
      if (d < 34 && d > 6 && e.shootTimer <= 0) {
        e.shootTimer = 0.9 + Math.random() * 0.8;
        api.enemyShot(e, d);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  },
};
