// Solmara Heat — boot, the game loop, and the rules that tie the city together:
// the player on foot and behind the wheel, stealing cars, the wanted level and the
// Solmara PD, shooting and punching, Lena's five missions, pickups, saving, and the
// deterministic screenshot scenes behind ?shot=.

import * as THREE from 'three';
import { CAR_MODELS, MISSIONS, PLACES, ROADS, SAVE_KEY, TUNE, WORLD } from './config.js';
import { createRandom, intIn, pick, range } from './random.js';
import { createInput, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH } from './input.js';
import { buildCity } from './city.js';
import { buildCarMesh, createPoliceCar, createTraffic, resolveCarCollision, stepPlayerCar, stepPoliceCar, stepTraffic } from './vehicles.js';
import { animateWalk, buildPersonMesh, createFootCop, createPedestrians, createRival, stepFootCop, stepPedestrians, stepRival } from './people.js';
import { advanceStep, createMissions, currentMission, currentStep, missionTarget, objectiveText, restoreMissions, serializeMissions, startMission } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { SHOT_NAMES, shotSetup } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (Math.floor(Math.random() * 4294967296) | 0);
const random = createRandom(seed);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const loadingEl = document.getElementById('loading');

function announce(message) {
  statusEl.textContent = message;
}

// ---------------------------------------------------------------------------
// World build
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const { colliders, beacon } = buildCity(scene, random);

// The player: Marco Solis, tan jacket, dark jeans.
const playerMesh = buildPersonMesh(0xc98f3a, 0x2a2f3a, 0xd8a06a);
scene.add(playerMesh);
const gunMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x111318 }));
gunMesh.position.set(0.4, 1.05, 0.3);
playerMesh.add(gunMesh);

const traffic = createTraffic(scene, random, TUNE.trafficCount);
const parkedCars = [];   // cars the player owns but is not driving right now
const pedestrians = createPedestrians(scene, random, TUNE.pedCount);
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);
const missions = createMissions();

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
const state = {
  screen: 'title', // title | play | paused
  cash: 150,
  rep: 0,
  health: TUNE.playerHealth,
  wanted: 0,
  wantedTimer: 0,       // seconds since the last crime
  lastDamageAt: -99,
  elapsed: 0,
  player: { x: -178, z: 138, heading: Math.PI / 2, vy: 0, y: 0, onGround: true, speed: 0 },
  inCar: null,          // the car object the player is driving, or null
  camYaw: 2.4,
  camYawOffset: 0,   // driver look-around offset, eases back to 0 behind the car
  camPitch: 0.32,
  camDist: 8,
  flash: 0,
  shotCooldown: 0,
  punchCooldown: 0,
  crimeCooldown: 0,
  bustedTimer: 0,
  missionMarker: null,  // place the beacon marks while free-roaming
  pickups: [],
  policeCars: [],
  footCops: [],
  rivals: [],
  stolenForMission: false,
  shotMode: false,
  shotReady: false,
};

const MISSION_STARTS = { m1: PLACES.garage, m2: PLACES.docks, m3: PLACES.neonRow, m4: PLACES.stadium, m5: PLACES.bank };

function playerPos() {
  if (state.inCar) return { x: state.inCar.x, z: state.inCar.z };
  return { x: state.player.x, z: state.player.z };
}

function addWanted(n, why) {
  if (state.wanted >= TUNE.maxWanted) return;
  state.wanted = Math.min(TUNE.maxWanted, state.wanted + n);
  state.wantedTimer = 0;
  if (state.wanted >= 1) audio.setSiren(true);
  if (why) hud.showToast(`★ WANTED LEVEL ${state.wanted}`, why, 2.2);
}

function commitCrime(n, why) {
  if (state.crimeCooldown > 0) return;
  state.crimeCooldown = 1.2;
  addWanted(n, why);
}

// ---------------------------------------------------------------------------
// Pickups: street cash and health packs, respawning around the sidewalks.
// ---------------------------------------------------------------------------
function spawnPickup(kind) {
  const road = pick(random, ROADS);
  const along = range(random, -220, 220);
  const x = random() < 0.5 ? along : road + 9;
  const z = random() < 0.5 ? along : road + 9;
  const isCash = kind === 'cash';
  const mesh = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.35, 0.6),
    new THREE.MeshLambertMaterial({ color: isCash ? 0x2e9e4f : 0xe8e8e8, emissive: isCash ? 0x0a3a16 : 0x5a1010 }),
  );
  box.position.y = 0.5;
  mesh.add(box);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 10, 8),
    new THREE.MeshBasicMaterial({ color: isCash ? 0x7dff9a : 0xff8a8a, transparent: true, opacity: 0.22 }),
  );
  glow.position.y = 0.6;
  mesh.add(glow);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  state.pickups.push({ kind, x, z, mesh, value: isCash ? intIn(random, 60, 160) : 40, bob: random() * 6 });
}

for (let i = 0; i < 8; i += 1) spawnPickup(i % 3 === 0 ? 'health' : 'cash');

// ---------------------------------------------------------------------------
// Police response: cars and foot cops scale with the wanted level.
// ---------------------------------------------------------------------------
function syncPolice() {
  const wantCars = state.wanted === 0 ? 0 : Math.min(3, state.wanted);
  const wantCops = state.inCar || state.wanted < 2 ? 0 : Math.min(2, state.wanted - 1);
  const p = playerPos();
  while (state.policeCars.length < wantCars) {
    const a = random() * Math.PI * 2;
    const car = createPoliceCar(scene, p.x + Math.cos(a) * 70, p.z + Math.sin(a) * 70);
    state.policeCars.push(car);
  }
  while (state.policeCars.length > wantCars) {
    const car = state.policeCars.pop();
    scene.remove(car.group);
  }
  while (state.footCops.length < wantCops) {
    const a = random() * Math.PI * 2;
    state.footCops.push(createFootCop(scene, p.x + Math.cos(a) * 40, p.z + Math.sin(a) * 40));
  }
  while (state.footCops.length > wantCops) {
    const cop = state.footCops.pop();
    scene.remove(cop.mesh);
  }
  // Drop police that fell far behind.
  for (let i = state.policeCars.length - 1; i >= 0; i -= 1) {
    const c = state.policeCars[i];
    if (Math.hypot(c.x - p.x, c.z - p.z) > 220) {
      scene.remove(c.group);
      state.policeCars.splice(i, 1);
    }
  }
  audio.setSiren(state.wanted > 0);
}

// ---------------------------------------------------------------------------
// Rivals for fight steps.
// ---------------------------------------------------------------------------
/** Push a point out of every building footprint (with a 1.5 m margin). */
function outsideBuildings(x, z) {
  for (const c of colliders) {
    if (x > c.minX - 1.5 && x < c.maxX + 1.5 && z > c.minZ - 1.5 && z < c.maxZ + 1.5) {
      const dxl = x - (c.minX - 1.5);
      const dxr = (c.maxX + 1.5) - x;
      const dzl = z - (c.minZ - 1.5);
      const dzr = (c.maxZ + 1.5) - z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) x = c.minX - 1.5;
      else if (m === dxr) x = c.maxX + 1.5;
      else if (m === dzl) z = c.minZ - 1.5;
      else z = c.maxZ + 1.5;
    }
  }
  return { x, z };
}

function spawnRivals(place, count, hostile) {
  clearRivals();
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + range(random, -0.4, 0.4);
    const r = 7 + random() * 6;
    const at = outsideBuildings(place.x + Math.cos(a) * r, place.z + Math.sin(a) * r);
    const rival = createRival(scene, at.x, at.z, hostile !== false);
    rival.mesh.userData.ref = rival;
    state.rivals.push(rival);
  }
}

function clearRivals() {
  for (const r of state.rivals) scene.remove(r.mesh);
  state.rivals = [];
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const shootDir = new THREE.Vector3();

function shoot() {
  if (state.shotCooldown > 0 || state.inCar) return;
  state.shotCooldown = 0.28;
  audio.shot();
  camera.getWorldDirection(shootDir);
  raycaster.set(camera.position, shootDir);
  raycaster.far = TUNE.shootRange;
  const meshes = [];
  for (const r of state.rivals) if (r.alive) meshes.push(r.mesh);
  for (const c of state.footCops) meshes.push(c.mesh);
  for (const p of pedestrians) if (p.alive) meshes.push(p.mesh);
  const hits = raycaster.intersectObjects(meshes, true);
  if (hits.length === 0) return;
  let obj = hits[0].object;
  while (obj && !obj.userData.ref && obj.parent) obj = obj.parent;
  const ref = obj ? obj.userData.ref : null;
  // Pedestrians carry no ref: walk up the chain to the ped mesh itself.
  let ped = null;
  if (!ref) {
    let node = hits[0].object;
    while (node && !node.userData.pedRef) node = node.parent;
    ped = node ? node.userData.pedRef : null;
  }
  if (ref && ref.kind === 'rival' || ref && ref.kind === 'guard') {
    ref.health -= TUNE.pistolDamage;
    if (ref.health <= 0 && ref.alive) {
      ref.alive = false;
      ref.mesh.rotation.x = -Math.PI / 2;
      ref.mesh.position.y = 0.3;
      state.cash += 25;
      state.rep += 10;
      if (missions.active && currentStep(missions) && currentStep(missions).kind === 'fight') {
        missions.fightLeft -= 1;
        if (missions.fightLeft <= 0) onStepDone();
      }
      hud.showToast('TARGET DOWN', '+$25 · +10 REP', 1.6);
    }
    commitCrime(0, null);
  } else if (ref && ref.kind === 'cop') {
    commitCrime(1, 'You shot a cop!');
  } else if (ped) {
    ped.alive = false;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.3;
    commitCrime(1, 'You shot a pedestrian!');
  }
}

function punch() {
  if (state.punchCooldown > 0 || state.inCar) return;
  state.punchCooldown = 0.45;
  audio.punch();
  const p = playerPos();
  const fx = Math.sin(state.player.heading);
  const fz = Math.cos(state.player.heading);
  for (const r of state.rivals) {
    if (!r.alive) continue;
    const dx = r.x - p.x;
    const dz = r.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < TUNE.punchRange && dx * fx + dz * fz > 0) {
      r.health -= TUNE.punchDamage;
      if (r.health <= 0) {
        r.alive = false;
        r.mesh.rotation.x = -Math.PI / 2;
        r.mesh.position.y = 0.3;
        state.cash += 25;
        state.rep += 10;
        if (missions.active && currentStep(missions) && currentStep(missions).kind === 'fight') {
          missions.fightLeft -= 1;
          if (missions.fightLeft <= 0) onStepDone();
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Missions: markers, step checks, payout.
// ---------------------------------------------------------------------------
function missionStartPlace() {
  const mission = currentMission(missions);
  if (!mission) return null;
  return MISSION_STARTS[mission.id] || null;
}

function onStepDone() {
  const result = advanceStep(missions);
  if (result === 'complete') {
    const mission = MISSIONS[missions.index - 1];
    state.cash += mission.pay;
    state.rep += 50;
    audio.cash();
    audio.mission();
    hud.showToast(`${mission.title} — COMPLETE`, `+$${mission.pay} · +50 REP`, 3.5);
    announce(`${mission.title} complete. Paid $${mission.pay}.`);
    saveGame();
  } else if (result === 'step') {
    audio.mission();
    enterStep();
  }
}

function enterStep() {
  const step = currentStep(missions);
  if (!step) return;
  if (step.kind === 'fight') {
    const place = step.place ? PLACES[step.place] : missionTarget(missions);
    const at = PLACES[step.place] || PLACES.neonRow;
    spawnRivals(at, step.count, true);
  }
}

function checkMission(dt) {
  const mission = currentMission(missions);
  if (!mission) {
    beacon.visible = false;
    return;
  }
  if (!missions.active) {
    const start = missionStartPlace();
    beacon.visible = true;
    beacon.position.set(start.x, 0, start.z);
    const p = playerPos();
    if (Math.hypot(p.x - start.x, p.z - start.z) < 12) {
      startMission(missions);
      hud.showToast(mission.title, mission.brief, 4);
      audio.mission();
      enterStep();
    }
    return;
  }
  const step = currentStep(missions);
  if (!step) return;
  if (missions.timer > 0) {
    missions.timer -= dt;
    if (missions.timer <= 0) {
      missions.active = false;
      missions.step = 0;
      clearRivals();
      hud.showToast('MISSION FAILED', 'Too slow — talk to Lena and try again.', 3);
      return;
    }
  }
  const p = playerPos();
  if (step.kind === 'steal') {
    if (state.stolenForMission) {
      state.stolenForMission = false;
      onStepDone();
    }
    beacon.visible = true;
    const target = PLACES[mission.steps[1].place];
    beacon.position.set(target.x, 0, target.z);
  } else if (step.kind === 'goto' || step.kind === 'collect') {
    const target = PLACES[step.place];
    beacon.visible = true;
    beacon.position.set(target.x, 0, target.z);
    if (Math.hypot(p.x - target.x, p.z - target.z) < 10) {
      if (step.kind === 'collect') {
        state.cash += 200;
        hud.showToast('STASH FOUND', '+$200', 1.8);
        audio.pickup();
      }
      onStepDone();
    }
  } else if (step.kind === 'fight') {
    beacon.visible = false;
  }
}

// ---------------------------------------------------------------------------
// Entering and stealing cars.
// ---------------------------------------------------------------------------
function nearestCar(maxDist) {
  const p = playerPos();
  let best = null;
  let bestDist = maxDist;
  // Traffic cars and the player's own parked cars are both enterable.
  for (const car of [...traffic, ...parkedCars]) {
    if (!car.alive) continue;
    const d = Math.hypot(car.x - p.x, car.z - p.z);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

function enterCar() {
  if (state.inCar) {
    // Step out beside the car; it stays parked where it is.
    const car = state.inCar;
    state.inCar = null;
    parkedCars.push(car);
    state.player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 3;
    state.player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 3;
    state.player.heading = car.heading;
    playerMesh.visible = true;
    return;
  }
  const car = nearestCar(4.5);
  if (!car) return;
  const wasTraffic = car.driver;
  car.driver = false;
  // A stolen car leaves the traffic flow: the player drives it now, so the
  // traffic stepper must never move it again.
  const inTraffic = traffic.indexOf(car);
  if (inTraffic !== -1) traffic.splice(inTraffic, 1);
  const parked = parkedCars.indexOf(car);
  if (parked !== -1) parkedCars.splice(parked, 1);
  state.inCar = car;
  state.camYawOffset = 0;
  playerMesh.visible = false;
  audio.unlock();
  if (wasTraffic) {
    // The driver bails and runs; stealing in the open draws the law.
    addWanted(1, 'Grand theft auto!');
    if (missions.active && currentStep(missions) && currentStep(missions).kind === 'steal') {
      state.stolenForMission = true;
    }
    hud.showToast('CAR STOLEN', car.model.name, 2);
  }
}

// ---------------------------------------------------------------------------
// Damage, busted, wasted.
// ---------------------------------------------------------------------------
function damagePlayer(amount) {
  state.health -= amount;
  state.flash = Math.min(1, state.flash + 0.5);
  state.lastDamageAt = state.elapsed;
  if (state.health <= 0) wasted();
}

function wasted() {
  state.health = TUNE.playerHealth;
  state.wanted = 0;
  state.cash = Math.floor(state.cash * 0.9);
  audio.busted();
  respawnAtHospital();
  hud.showToast('WASTED', 'The city chews you up — $ lost, back on your feet.', 3.5);
}

function busted() {
  state.health = TUNE.playerHealth;
  state.wanted = 0;
  state.cash = Math.floor(state.cash * 0.85);
  state.bustedTimer = 0;
  audio.busted();
  respawnAtHospital();
  hud.showToast('BUSTED', 'Solmara PD took their cut. $ lost.', 3.5);
}

function respawnAtHospital() {
  if (state.inCar) {
    state.inCar = null;
    playerMesh.visible = true;
  }
  state.player.x = PLACES.hospital.x + 16;
  state.player.z = PLACES.hospital.z + 8;
  state.player.heading = 0;
  state.player.y = 0;
  state.player.vy = 0;
  clearRivals();
  for (const c of state.policeCars) scene.remove(c.group);
  state.policeCars = [];
  for (const c of state.footCops) scene.remove(c.mesh);
  state.footCops = [];
  saveGame();
}

// ---------------------------------------------------------------------------
// Save / load (localStorage, this browser only).
// ---------------------------------------------------------------------------
function saveGame() {
  try {
    const data = {
      cash: state.cash,
      rep: state.rep,
      health: state.health,
      missions: serializeMissions(missions),
      x: state.player.x,
      z: state.player.z,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* storage off: progress lasts this visit only */ }
}

function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function applySave(data) {
  if (!data) return;
  state.cash = data.cash || 0;
  state.rep = data.rep || 0;
  state.health = data.health || TUNE.playerHealth;
  restoreMissions(missions, data.missions);
  if (typeof data.x === 'number') state.player.x = data.x;
  if (typeof data.z === 'number') state.player.z = data.z;
}

// ---------------------------------------------------------------------------
// Player on foot.
// ---------------------------------------------------------------------------
function stepPlayer(dt) {
  const p = state.player;
  const drag = input.takeDrag();
  state.camYaw -= drag.x * 0.005;
  state.camPitch = Math.max(-0.15, Math.min(0.9, state.camPitch + drag.y * 0.003));
  const fwd = input.forward();
  const strafe = input.strafe();
  const speed = input.sprint() ? TUNE.playerRun : TUNE.playerWalk;
  const mx = Math.sin(state.camYaw) * -fwd + Math.cos(state.camYaw) * strafe;
  const mz = Math.cos(state.camYaw) * -fwd - Math.sin(state.camYaw) * strafe;
  const moving = fwd !== 0 || strafe !== 0;
  if (moving) {
    const len = Math.hypot(mx, mz) || 1;
    const nx = p.x + (mx / len) * speed * dt;
    const nz = p.z + (mz / len) * speed * dt;
    p.heading = Math.atan2(mx / len, mz / len);
    // Circle vs building AABBs, radius 0.6.
    let blocked = false;
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(nx, c.maxX));
      const cz = Math.max(c.minZ, Math.min(nz, c.maxZ));
      if ((nx - cx) ** 2 + (nz - cz) ** 2 < 0.6 * 0.6) { blocked = true; break; }
    }
    if (!blocked) {
      p.x = Math.max(-WORLD.half, Math.min(WORLD.half, nx));
      p.z = Math.max(-WORLD.half, Math.min(WORLD.half, nz));
    }
    p.speed = speed;
    animateWalk(playerMesh, dt, speed);
  } else {
    p.speed = 0;
    animateWalk(playerMesh, dt, 0);
  }
  // Jump + gravity.
  if (p.onGround && (input.held('Space'))) {
    p.vy = 6.5;
    p.onGround = false;
  }
  if (!p.onGround) {
    p.vy -= 18 * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.onGround = true;
    }
  }
  playerMesh.position.set(p.x, p.y, p.z);
  playerMesh.rotation.y = p.heading;
}

// ---------------------------------------------------------------------------
// Camera: third-person follow, smoothed, orbit by mouse drag.
// ---------------------------------------------------------------------------
const camTarget = new THREE.Vector3();
const camWanted = new THREE.Vector3();
function updateCamera(dt) {
  const p = playerPos();
  const inCar = !!state.inCar;
  const dist = inCar ? 11 : state.camDist;
  const height = inCar ? 4.2 : 3.4;
  let yaw;
  let pitch;
  if (inCar) {
    pitch = 0.22;
    // Mouse drag lets the driver look around; the offset eases back behind the car.
    const drag = input.takeDrag();
    state.camYawOffset -= drag.x * 0.004;
    state.camYawOffset *= Math.max(0, 1 - dt * 0.4);
    yaw = state.inCar.heading + Math.PI + state.camYawOffset;
  } else {
    yaw = state.camYaw;
    pitch = state.camPitch;
  }
  camTarget.set(p.x, 1.6, p.z);
  camWanted.set(
    p.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    1.6 + Math.sin(pitch) * dist + height - 1.6,
    p.z + Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  camera.position.lerp(camWanted, Math.min(1, dt * 6));
  camera.lookAt(camTarget);
}

// ---------------------------------------------------------------------------
// One fixed step of the whole game.
// ---------------------------------------------------------------------------
function step(dt) {
  state.elapsed += dt;
  if (state.crimeCooldown > 0) state.crimeCooldown -= dt;
  if (state.shotCooldown > 0) state.shotCooldown -= dt;
  if (state.punchCooldown > 0) state.punchCooldown -= dt;
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.4);

  // Wanted decays after a quiet spell.
  if (state.wanted > 0) {
    state.wantedTimer += dt;
    if (state.wantedTimer > TUNE.wantedDecaySeconds) {
      state.wanted -= 1;
      state.wantedTimer = 0;
      if (state.wanted === 0) audio.setSiren(false);
    }
  }
  // Slow health regen out of trouble.
  if (state.health < TUNE.playerHealth && state.elapsed - state.lastDamageAt > 6 && state.wanted === 0) {
    state.health = Math.min(TUNE.playerHealth, state.health + 1.5 * dt);
  }

  const actions = input.takeActions();
  if (actions & ACTION_PAUSE) {
    pauseGame();
    return;
  }
  if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
  if (actions & ACTION_ENTER) enterCar();
  if (actions & ACTION_PUNCH) punch();
  if (input.takeClick()) shoot();

  if (state.inCar) {
    stepPlayerCar(state.inCar, input, dt, colliders, (speed) => {
      audio.crash();
      damagePlayer(speed * 0.25);
      state.flash = 0.8;
    });
    // Running over a pedestrian is a crime, and the car takes a knock.
    for (const ped of pedestrians) {
      if (!ped.alive) continue;
      if (Math.hypot(ped.x - state.inCar.x, ped.z - state.inCar.z) < 2.2) {
        ped.alive = false;
        ped.mesh.rotation.x = -Math.PI / 2;
        ped.mesh.position.y = 0.3;
        state.inCar.speed *= 0.55;
        commitCrime(1, 'You hit a pedestrian!');
        audio.crash();
      }
    }
    // Bumping traffic.
    for (const car of traffic) {
      if (!car.alive || car === state.inCar) continue;
      const d = Math.hypot(car.x - state.inCar.x, car.z - state.inCar.z);
      if (d < 3.4) {
        state.inCar.speed *= 0.55;
        car.x += (car.x - state.inCar.x) * 0.4;
        car.z += (car.z - state.inCar.z) * 0.4;
        if (Math.abs(state.inCar.speed) > 10) audio.crash();
      }
    }
    audio.setEngine(true, Math.abs(state.inCar.speed) / state.inCar.model.top);
  } else {
    stepPlayer(dt);
    audio.setEngine(false, 0);
    // Traffic can clip a careless pedestrian (the player).
    for (const car of traffic) {
      if (!car.alive) continue;
      if (Math.hypot(car.x - state.player.x, car.z - state.player.z) < 1.8) {
        damagePlayer(12);
        state.player.x += (state.player.x - car.x) * 0.6;
        state.player.z += (state.player.z - car.z) * 0.6;
        audio.crash();
      }
    }
  }

  stepTraffic(traffic, dt, random);
  // Pedestrians respawn after a while so the streets stay alive.
  for (const ped of pedestrians) {
    if (!ped.alive && random() < dt * 0.05) {
      ped.alive = true;
      ped.mesh.rotation.x = 0;
      ped.mesh.position.y = 0;
      const road = pick(random, ROADS);
      ped.x = range(random, -220, 220);
      ped.z = road + 9;
    }
  }
  const p = playerPos();
  const shooting = state.shotCooldown > 0.2;
  stepPedestrians(pedestrians, dt, random, p.x, p.z, shooting || state.wanted > 0);

  // Police behaviour.
  syncPolice();
  let nearestCopDist = Infinity;
  for (const car of state.policeCars) {
    const d = stepPoliceCar(car, p.x, p.z, dt, colliders);
    nearestCopDist = Math.min(nearestCopDist, d);
    if (d < 4 && state.inCar && Math.abs(state.inCar.speed) < 3) {
      state.bustedTimer += dt;
      if (state.bustedTimer > 3) busted();
    } else if (d < 4 && !state.inCar) {
      state.bustedTimer += dt;
      if (state.bustedTimer > 2) busted();
    }
  }
  for (const cop of state.footCops) {
    const d = stepFootCop(cop, p.x, p.z, dt);
    nearestCopDist = Math.min(nearestCopDist, d);
    if (d < 1.7 && !state.inCar) {
      state.bustedTimer += dt;
      if (state.bustedTimer > 1.5) busted();
    }
  }
  if (nearestCopDist > 6) state.bustedTimer = 0;

  // Rivals shoot back.
  for (const rival of state.rivals) {
    if (!rival.alive) continue;
    if (stepRival(rival, p.x, p.z, dt, random) === 1) {
      audio.shot();
      if (random() < 0.55) damagePlayer(range(random, 5, 10));
    }
  }

  // Pickups.
  for (const pk of state.pickups) {
    pk.bob += dt;
    pk.mesh.children[0].position.y = 0.5 + Math.sin(pk.bob * 3) * 0.12;
    pk.mesh.rotation.y += dt;
    if (Math.hypot(pk.x - p.x, pk.z - p.z) < 2.4) {
      if (pk.kind === 'cash') {
        state.cash += pk.value;
        hud.showToast(`+$${pk.value}`, 'Street cash', 1.4);
        audio.pickup();
      } else {
        state.health = Math.min(TUNE.playerHealth, state.health + pk.value);
        hud.showToast('+HEALTH', 'First-aid kit', 1.4);
        audio.pickup();
      }
      scene.remove(pk.mesh);
      state.pickups.splice(state.pickups.indexOf(pk), 1);
      window.setTimeout(() => spawnPickup(pk.kind), 4000);
    }
  }

  checkMission(dt);
  updateCamera(dt);
  updateHudState();
}

function updateHudState() {
  const p = playerPos();
  const target = missionTarget(missions) || (missions.active ? null : missionStartPlace());
  const objective = objectiveText(missions);
  hud.update({
    cash: state.cash,
    health: state.health,
    ammo: Infinity,
    rep: state.rep,
    wanted: state.wanted,
    objective,
    objectiveDist: target ? Math.hypot(p.x - target.x, p.z - target.z) : null,
    objectivePlace: target ? target.label : null,
    inCar: !!state.inCar,
    speed: state.inCar ? state.inCar.speed : 0,
    carName: state.inCar ? state.inCar.model.name : '',
    showCrosshair: !state.inCar && state.screen === 'play',
    flash: state.flash,
    target,
    policeDots: [...state.policeCars.map((c) => ({ x: c.x, z: c.z, kind: 'car' })), ...state.footCops.map((c) => ({ x: c.x, z: c.z, kind: 'cop' }))],
    rivalDots: state.rivals.filter((r) => r.alive).map((r) => ({ x: r.x, z: r.z })),
    playerX: p.x,
    playerZ: p.z,
    playerHeadingX: state.inCar ? Math.sin(state.inCar.heading) : Math.sin(state.player.heading),
    playerHeadingZ: state.inCar ? Math.cos(state.inCar.heading) : Math.cos(state.player.heading),
  });
}

// ---------------------------------------------------------------------------
// Screens: title, pause, and the deterministic screenshot scenes.
// ---------------------------------------------------------------------------
function startGame(fromSave) {
  if (fromSave) {
    const data = loadGame();
    if (data) applySave(data);
  }
  state.screen = 'play';
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('pauseScreen').classList.add('hidden');
  hud.setVisible(true);
  audio.unlock();
  announce('Playing Solmara Heat. Reach the yellow marker to start your first job.');
}

function pauseGame() {
  if (state.screen !== 'play') return;
  state.screen = 'paused';
  document.getElementById('pauseStats').textContent =
    `Cash $${Math.floor(state.cash)} · REP ${state.rep} · Missions done: ${missions.completed.length}/5 · Wanted ★${state.wanted}`;
  document.getElementById('pauseScreen').classList.remove('hidden');
  saveGame();
}

function resumeGame() {
  state.screen = 'play';
  document.getElementById('pauseScreen').classList.add('hidden');
}

document.getElementById('btnStart').addEventListener('click', () => startGame(false));
document.getElementById('btnContinue').addEventListener('click', () => startGame(true));
document.getElementById('btnResume').addEventListener('click', resumeGame);
document.getElementById('btnSave').addEventListener('click', () => {
  saveGame();
  hud.showToast('SAVED', 'Progress stored in this browser.', 2);
});
document.getElementById('btnRestart').addEventListener('click', () => {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  window.location.search = '';
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.screen === 'play') pauseGame();
});

const saved = loadGame();
if (saved) document.getElementById('btnContinue').style.display = 'inline-block';
hud.renderMissionList(saved && saved.missions ? saved.missions.completed : []);

// ---------------------------------------------------------------------------
// Screenshot scenes (?shot=...): stage a real game state, run it forward a
// couple of seconds so traffic, police and the camera settle, then signal ready.
// ---------------------------------------------------------------------------
function stageShot(name) {
  state.shotMode = true;
  const setup = shotSetup(name);
  state.screen = 'play';
  document.getElementById('startScreen').classList.add('hidden');
  hud.setVisible(true);
  audio.setMuted(true);

  if (setup.place === 'start') {
    // Title screen over a slow orbit of Downtown — as a new player sees it.
    state.screen = 'title';
    document.getElementById('startScreen').classList.remove('hidden');
    document.getElementById('btnContinue').style.display = 'none';
    hud.setVisible(false);
    state.player.x = 0;
    state.player.z = 60;
    state.camYaw = 0.6;
    state.camPitch = 0.5;
    state.camDist = 60;
    camera.position.set(90, 55, 150);
    camera.lookAt(0, 10, -30);
    renderer.render(scene, camera);
    window.__shotReady = true;
    return;
  }

  if (setup.place === 'mission') {
    missions.index = 2;
    startMission(missions);
    missions.step = 1;
    missions.fightLeft = 4;
    // Stage the fight on the Neon Row avenue, rivals ahead in the open street.
    spawnRivals({ x: -95, z: -90 }, 4, true);
    state.player.x = -122;
    state.player.z = -90;
    state.player.heading = Math.PI / 2;
    state.camYaw = state.player.heading + Math.PI;
    state.camPitch = 0.28;
    state.wanted = 1;
    state.cash = 1250;
  } else {
    // Driving shots: put Marco in a car on the main avenue, police behind.
    const model = CAR_MODELS[setup.carModel || 2];
    const { group } = buildCarMesh(model, model.colors[setup.carColor || 0], false);
    scene.add(group);
    const car = {
      kind: 'player', group, wheels: [], model, color: model.colors[setup.carColor || 0],
      x: 30, z: setup.startZ || 120, heading: Math.PI, speed: setup.speed || 26, alive: true, driver: false,
    };
    // Rebuild wheels list from the group for the spin animation.
    car.wheels = group.children.filter((c) => c.geometry && c.geometry.type === 'CylinderGeometry');
    group.position.set(car.x, 0, car.z);
    group.rotation.y = car.heading;
    state.inCar = car;
    state.player.x = car.x;
    state.player.z = car.z;
    state.wanted = setup.wanted || 3;
    state.cash = 2450;
    state.camYawOffset = 0;
    for (let i = 0; i < (setup.police || 2); i += 1) {
      const pc = createPoliceCar(scene, 30 + (i - 1) * 6, car.z + 26 + i * 12);
      pc.heading = Math.PI;
      state.policeCars.push(pc);
    }
    // One interceptor pulling alongside ahead-left, so the chase reads in the frame.
    const showCar = createPoliceCar(scene, car.x - 7, car.z - 34);
    showCar.heading = Math.PI;
    showCar.showcase = true;
    state.policeCars.push(showCar);
    // Two traffic cars ahead on the same avenue.
    const ahead = [traffic[0], traffic[1]].filter(Boolean);
    ahead.forEach((t, i) => {
      t.horizontal = false;
      t.heading = Math.PI;
      t.x = 30 + (i === 0 ? 3.2 : -3.2);
      t.z = car.z - 42 - i * 30;
      t.group.position.set(t.x, 0, t.z);
      t.group.rotation.y = t.heading;
    });
    audio.setSiren(true);
  }

  // Let the world settle: traffic moves, police close in, the camera finds its place.
  for (let i = 0; i < 90; i += 1) {
    stepTraffic(traffic, 1 / 60, random);
    stepPedestrians(pedestrians, 1 / 60, random, 0, 0, false);
    const p = playerPos();
    for (const pc of state.policeCars) {
      if (pc.showcase) continue; // the showcase interceptor holds its mark ahead-left
      stepPoliceCar(pc, p.x, p.z, 1 / 60, colliders);
    }
    updateCamera(1 / 60);
  }
  updateHudState();
  renderer.render(scene, camera);
  window.__shotReady = true;
}

// ---------------------------------------------------------------------------
// Main loop: fixed 1/60 s steps, several per slow frame, none per fast one.
// ---------------------------------------------------------------------------
const STEP = 1 / 60;
const MAX_FRAME = 0.25;
let accumulator = 0;
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  if (state.screen === 'play') {
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP && state.screen === 'play') {
      step(STEP);
      accumulator -= STEP;
    }
  } else {
    last = now;
    accumulator = 0;
    if (state.screen === 'title') {
      // Slow cinematic orbit behind the title screen.
      const t = performance.now() / 1000;
      camera.position.set(Math.sin(t * 0.05) * 150, 60 + Math.sin(t * 0.03) * 12, Math.cos(t * 0.05) * 150);
      camera.lookAt(0, 12, -30);
    }
  }
  renderer.render(scene, camera);
}

// Debug handle for automated play-testing (never shown to the player).
window.__solmara = {
  state,
  missions,
  traffic,
  pedestrians,
  step,
  startGame,
  enterCar,
  shoot,
  saveGame,
  version: 'solmara-heat-1',
};

loadingEl.remove();
if (shotParam && SHOT_NAMES.includes(shotParam)) {
  stageShot(shotParam);
} else {
  announce('Solmara Heat. Press Start Engine to play.');
}
requestAnimationFrame(frame);
