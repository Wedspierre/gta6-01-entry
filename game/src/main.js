// VELAMAR — main game loop and glue.
// Third-person open world: on-foot movement, driving, carjacking, combat,
// weapon wheel, garage, helicopter, dispatch jobs and the 14-mission story.
import * as THREE from 'three';
import { S, CITY, HALF, MISSIONS, WEAPONS, RADIO_STATIONS } from './state.js';
import { makeRng, clamp, range, pick, angleDiff } from './rng.js';
import { Input } from './input.js';
import { AudioSys, unlockAudio } from './audio.js';
import { buildCity, collideCircle, clampToCity, isRoad } from './city.js';
import { CAR_MODELS, makeCar, driveCar, spawnTraffic, trafficThink, makeHeli, updateHeli } from './vehicles.js';
import { buildPlayerMesh, spawnPedestrians, updatePedestrian, fleeFrom, makePedestrian } from './people.js';
import { Police } from './police.js';
import { Dispatch } from './dispatch.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { saveGame, loadSave, hasSave, applySave } from './save.js';
import { parseShotMode, stageShot } from './shots.js';

const canvas = document.getElementById('gl');
const statusEl = document.getElementById('status');
const rng = makeRng(S.seed);
const shot = parseShotMode();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2200);

const city = buildCity(scene, S.seed);
const colliders = city.colliders;
window.__velamarColliders = colliders;

const heli = makeHeli(scene);
Police.init(scene, heli);
Dispatch.init();
Missions.init(scene, city.beacon);

// Player
const playerMesh = buildPlayerMesh();
scene.add(playerMesh);
const player = {
  mesh: playerMesh, pos: playerMesh.position,
  heading: 0, speed: 0, vy: 0, onGround: true,
  walkPhase: 0, inCar: false, inHeli: false, car: null,
};
player.pos.set(city.spawnPos.x, 0, city.spawnPos.z);
S.player = player;
window.__velamarPlayerPos = player.pos;

// Traffic + pedestrians
let traffic = spawnTraffic(scene, 26, rng);
let peds = spawnPedestrians(scene, 42, rng);

// Parked cars the player can steal
const parked = [];
function spawnParkedCar(modelName, x, z, heading) {
  const model = CAR_MODELS.find((m) => m.name === modelName);
  const car = makeCar(scene, model, x, z, heading, {});
  parked.push(car);
  return car;
}
spawnParkedCar('Harbor Sedan', -340, 372, 0.4);
spawnParkedCar('Sunset Coupe', -300, 300, Math.PI / 2);
spawnParkedCar('Marina Taxi', 380, 40, -Math.PI / 2);
spawnParkedCar('Dune Pickup', 60, -380, 0);
spawnParkedCar('Neon Sport', 440, -40, Math.PI);
spawnParkedCar('Bay Van', -60, -420, Math.PI / 2);

// Heli parked at the helipad for the Air One mission
const padHeli = makeHeli(scene);
padHeli.mesh.visible = true;
padHeli.mesh.position.set(city.helipadPos.x, 0, city.helipadPos.z);
padHeli.active = false;

// Shooting tracer
const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.9 });
let tracer = null;
let tracerTimer = 0;

function fireTracer(from, to) {
  if (tracer) scene.remove(tracer);
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  tracer = new THREE.Line(geo, tracerMat);
  scene.add(tracer);
  tracerTimer = 0.07;
}

// --- window hooks used by other systems ---
window.__velamarRoadblockSmashed = () => { S.missionState.smashed = (S.missionState.smashed ?? 0) + 1; };
window.__velamarJobFailed = () => { Hud.missionText(); };
window.__velamarJobDone = () => { Hud.missionText(); };

function playerPos() { return { x: player.pos.x, z: player.pos.z }; }
function currentCar() { return player.car; }

function api() {
  return {
    playerPos,
    inCar: () => player.inCar,
    inHeli: () => player.inHeli,
    speed: () => player.inCar && player.car ? Math.abs(player.car.speed)
      : player.inHeli ? Math.abs(heliSpeed) : Math.abs(player.speed),
    pressedE: () => Input.wasPressed('KeyE'),
    driveCar,
    colliders: () => colliders,
    scene: () => scene,
    rng: () => rng,
    missionTarget: () => Missions.stepTarget(),
    policeCars: () => Police.cars,
    trafficCars: () => traffic,
    playerHeading: () => player.heading,
    enemyShot: (e, d) => enemyShoot(e, d),
  };
}

let heliSpeed = 0;
let heliAlt = 0;

// --- Shot-mode API (used by shots.js staging) ---
const shotApi = {
  playerPos,
  teleportPlayer(x, z, heading) {
    player.pos.set(x, 0, z);
    player.heading = heading;
    playerMesh.position.set(x, 0, z);
  },
  giveCar(modelName, x, z, heading) {
    const car = spawnParkedCar(modelName, x, z, heading);
    return car;
  },
  spawnCarNear(modelName, x, z) { return spawnParkedCar(modelName, x, z, range(rng, 0, 6)); },
  enterCar() {
    const car = nearestCar(30);
    if (car) enterCar(car);
  },
  spawnTrafficNear(x, z, n) {
    for (let i = 0; i < n; i++) {
      const model = pick(rng, CAR_MODELS.filter((m) => m.name !== 'Interceptor'));
      const rx = x + range(rng, -70, 70);
      const rz = z + range(rng, -70, 70);
      const car = makeCar(scene, model, rx, rz, range(rng, 0, 6), { traffic: true });
      car.speed = range(rng, 6, 12);
      traffic.push(car);
    }
  },
  spawnPedsNear(x, z, n) {
    for (let i = 0; i < n; i++) {
      peds.push(makePedestrian(scene, rng, x + range(rng, -50, 50), z + range(rng, -50, 50)));
    }
  },
  startMission(i) { Missions.startMission(i); },
  scene: () => scene,
  rng: () => rng,
};

function nearestCar(maxD) {
  let best = null, bd = maxD;
  const all = [...parked, ...traffic];
  for (const c of all) {
    if (c.dead) continue;
    const d = Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function enterCar(car) {
  player.inCar = true;
  player.car = car;
  car.driver = 'player';
  car.traffic = false;
  playerMesh.visible = false;
  AudioSys.door();
  if (car.police) Police.addWanted(1, 'stealing a police car');
}

function exitCar() {
  if (!player.car) return;
  const car = player.car;
  player.inCar = false;
  player.car = null;
  car.driver = null;
  player.pos.set(car.pos.x - Math.sin(car.heading) * 3, 0, car.pos.z - Math.cos(car.heading) * 3);
  playerMesh.visible = true;
  AudioSys.door();
}

function carjack() {
  const car = nearestCar(6);
  if (!car) return;
  // Driver flees, player takes the car, wanted level rises.
  if (car.traffic) {
    const driver = makePedestrian(scene, rng, car.pos.x + 2, car.pos.z + 2);
    driver.state = 'flee';
    driver.timer = 4;
    peds.push(driver);
    car.traffic = false;
    Police.addWanted(1, 'carjacking on the street');
    Hud.toast('CARJACKED', `${car.name} is yours — the cops saw that.`);
    fleeFrom(peds, car.pos.x, car.pos.z, 25);
  }
  enterCar(car);
}

function enterHeli() {
  player.inHeli = true;
  heliSpeed = 0;
  heliAlt = 0;
  heli.active = true;
  heli.pos.set(padHeli.mesh.position.x, 40, padHeli.mesh.position.z);
  padHeli.mesh.visible = false;
  playerMesh.visible = false;
  Hud.toast('AIR ONE', 'Helicopter yours. W/S speed, A/D turn, Space up, C down.');
  AudioSys.pickup();
}

function exitHeli() {
  player.inHeli = false;
  heli.active = false;
  heliSpeed = 0;
  player.pos.set(heli.pos.x, 0, heli.pos.z + 6);
  playerMesh.visible = true;
  padHeli.mesh.visible = true;
  padHeli.mesh.position.set(heli.pos.x, 0, heli.pos.z + 6);
}

function nearestEnemy(maxD) {
  let best = null, bd = maxD;
  for (const e of Missions.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function shoot() {
  const w = WEAPONS.find((x) => x.id === S.ownedWeapons[S.weaponIndex]);
  if (!w) return;
  if (w.id !== 'fists') {
    if ((S.ammo[w.id] ?? 0) <= 0) { Hud.toast('NO AMMO', 'Find ammo — finish missions or dispatch jobs.'); return; }
    S.ammo[w.id]--;
  }
  const now = performance.now();
  if (now - (shoot.last ?? 0) < w.rate * 1000) return;
  shoot.last = now;
  const from = new THREE.Vector3(player.pos.x, 1.5, player.pos.z);
  const dir = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  const to = from.clone().add(dir.multiplyScalar(w.range));
  if (w.id === 'fists') AudioSys.hit(); else if (w.id === 'shotgun') AudioSys.shotgun(); else AudioSys.shoot();
  const target = nearestEnemy(w.range);
  if (target) {
    const d = Math.hypot(target.pos.x - player.pos.x, target.pos.z - player.pos.z);
    const aim = Math.atan2(target.pos.x - player.pos.x, target.pos.z - player.pos.z);
    if (Math.abs(angleDiff(player.heading, aim)) < 0.5) {
      target.health -= w.damage;
      AudioSys.hit();
      fleeFrom(peds, target.pos.x, target.pos.z, 20);
      if (target.health <= 0) {
        target.dead = true;
        scene.remove(target.mesh);
        S.missionState.kills = (S.missionState.kills ?? 0) + 1;
        S.respect += 2;
        S.cash += 25;
        if (Math.random() < 0.5) {
          const wId = pick(rng, ['pistol', 'smg', 'shotgun']);
          S.ammo[wId] = (S.ammo[wId] ?? 0) + 12;
          Hud.toast('AMMO PICKED UP', `+12 ${wId} rounds`);
        }
        if (!S.ownedWeapons.includes('smg') && S.missionIndex >= 4) {
          S.ownedWeapons.push('smg');
          S.ammo.smg = 90;
          Hud.toast('NEW WEAPON', 'SMG added to your weapon wheel (Q)');
        }
        if (!S.ownedWeapons.includes('shotgun') && S.missionIndex >= 8) {
          S.ownedWeapons.push('shotgun');
          S.ammo.shotgun = 24;
          Hud.toast('NEW WEAPON', 'Shotgun added to your weapon wheel (Q)');
        }
      }
    }
  }
  // Hitting peds is a crime — wanted rises, peds flee.
  for (const p of peds) {
    if (p.dead) continue;
    const d = Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z);
    if (d < w.range && d > 2) {
      const aim = Math.atan2(p.pos.x - player.pos.x, p.pos.z - player.pos.z);
      if (Math.abs(angleDiff(player.heading, aim)) < 0.35) {
        p.health -= w.damage;
        if (p.health <= 0) {
          p.dead = true;
          scene.remove(p.mesh);
          Police.addWanted(1, 'shooting a civilian in Velamar Bay');
        }
        fleeFrom(peds, p.pos.x, p.pos.z, 30);
        break;
      }
    }
  }
  fireTracer(from, to);
}

function enemyShoot(e, d) {
  // Enemy fires at the player; accuracy falls with distance.
  const hitChance = clamp(0.45 - d * 0.008, 0.08, 0.45);
  const from = new THREE.Vector3(e.pos.x, 1.4, e.pos.z);
  const to = new THREE.Vector3(player.pos.x, 1.3, player.pos.z);
  fireTracer(from, to);
  AudioSys.shoot();
  if (Math.random() < hitChance) {
    Police.damagePlayer(7, onWasted);
    Hud.toast('UNDER FIRE', 'You are taking hits — find cover!');
  }
}

function onBusted() {
  if (S.phase !== 'playing') return;
  S.phase = 'busted';
  AudioSys.busted();
  Hud.center('BUSTED', 2.5);
  Hud.toast('BUSTED', 'The VPD hauled you in. You lost some cash — and your heat.');
  setTimeout(() => {
    const fine = Math.floor(S.cash * 0.1);
    S.cash -= fine;
    S.health = 100;
    Police.clearAll(scene);
    player.pos.set(city.spawnPos.x, 0, city.spawnPos.z);
    player.heading = 0;
    playerMesh.visible = true;
    S.phase = 'playing';
  }, 2600);
}

function onWasted() {
  if (S.phase !== 'playing') return;
  S.phase = 'wasted';
  Hud.center('WASTED', 2.5);
  Hud.toast('WASTED', 'You got dropped. The city keeps moving without you.');
  setTimeout(() => {
    S.cash = Math.floor(S.cash * 0.85);
    S.health = 100;
    S.armor = 0;
    Police.clearAll(scene);
    Missions.failMission('You were wasted — the mission resets.');
    player.pos.set(city.spawnPos.x, 0, city.spawnPos.z);
    playerMesh.visible = true;
    S.phase = 'playing';
  }, 2600);
}

// --- Player on-foot update ---
function updatePlayer(dt) {
  const camFwd = new THREE.Vector3(Math.sin(S.cameraYaw), 0, Math.cos(S.cameraYaw));
  const camRight = new THREE.Vector3(camFwd.z, 0, -camFwd.x);
  const f = Input.axis('KeyS', 'KeyW');
  const r = Input.axis('KeyA', 'KeyD');
  const sprint = Input.down('ShiftLeft') || Input.down('ShiftRight');
  const speed = sprint ? 10 : 6;
  let mx = 0, mz = 0;
  if (f || r) {
    const len = Math.hypot(f, r) || 1;
    mx = (camFwd.x * f + camRight.x * r) / len;
    mz = (camFwd.z * f + camRight.z * r) / len;
    player.heading = Math.atan2(mx, mz);
  }
  player.speed = (f || r) ? speed : 0;
  const nx = player.pos.x + mx * speed * dt;
  const nz = player.pos.z + mz * speed * dt;
  const fixed = collideCircle(colliders, nx, nz, 0.7);
  player.pos.x = fixed.x;
  player.pos.z = fixed.z;
  // Jump + gravity
  if (Input.wasPressed('Space') && player.onGround) { player.vy = 8; player.onGround = false; }
  player.vy -= 24 * dt;
  player.pos.y += player.vy * dt;
  if (player.pos.y <= 0) { player.pos.y = 0; player.vy = 0; player.onGround = true; }
  // Walk animation
  if (player.speed > 0) {
    player.walkPhase += dt * player.speed * 1.6;
    const s = Math.sin(player.walkPhase);
    playerMesh.userData.legL.rotation.x = s * 0.7;
    playerMesh.userData.legR.rotation.x = -s * 0.7;
    playerMesh.userData.armL.rotation.x = -s * 0.5;
    playerMesh.userData.armR.rotation.x = s * 0.5;
  } else {
    playerMesh.userData.legL.rotation.x *= 0.8;
    playerMesh.userData.legR.rotation.x *= 0.8;
    playerMesh.userData.armL.rotation.x *= 0.8;
    playerMesh.userData.armR.rotation.x *= 0.8;
  }
  playerMesh.position.set(player.pos.x, player.pos.y, player.pos.z);
  playerMesh.rotation.y = player.heading;
}

// --- Camera ---
function updateCamera(dt) {
  S.cameraYaw -= Input.mouseDX * 0.004;
  S.cameraPitch = clamp(S.cameraPitch + Input.mouseDY * 0.003, 0.08, 1.1);
  S.cameraDist = clamp(S.cameraDist + Input.wheelDelta * 0.01, 5, 18);
  const target = player.inHeli
    ? new THREE.Vector3(heli.pos.x, heli.pos.y, heli.pos.z)
    : player.inCar && player.car
      ? new THREE.Vector3(player.car.pos.x, 2, player.car.pos.z)
      : new THREE.Vector3(player.pos.x, 1.6, player.pos.z);
  const yaw = player.inCar && player.car && Math.abs(player.car.speed) > 4
    ? player.car.heading + Math.PI
    : S.cameraYaw;
  const cx = target.x + Math.sin(yaw) * Math.cos(S.cameraPitch) * S.cameraDist;
  const cz = target.z + Math.cos(yaw) * Math.cos(S.cameraPitch) * S.cameraDist;
  const cy = target.y + Math.sin(S.cameraPitch) * S.cameraDist + 1.5;
  camera.position.set(cx, cy, cz);
  camera.lookAt(target.x, target.y + 1, target.z);
}

// --- Interaction prompts ---
function updateInteract() {
  let prompt = '';
  if (!player.inCar && !player.inHeli) {
    const car = nearestCar(6);
    if (car) prompt = car.traffic ? '[F] Carjack  •  [E] Enter' : '[E] Enter car';
    const dh = Math.hypot(player.pos.x - city.helipadPos.x, player.pos.z - city.helipadPos.z);
    if (dh < 12 && S.missionIndex >= 10) prompt = '[E] Fly the helicopter';
    const step = Missions.currentStep();
    if (step?.kind === 'talk') {
      const d = Math.hypot(player.pos.x - step.x, player.pos.z - step.z);
      if (d < 5) prompt = '[E] Talk';
    }
  } else if (player.inCar) {
    prompt = '[E] Exit car  •  [Q] Weapon wheel (on foot)';
    const gd = Math.hypot(player.car.pos.x - city.garagePos.x, player.car.pos.z - city.garagePos.z);
    if (gd < 16) prompt = '[G] Store car in garage  •  [E] Exit car';
  } else if (player.inHeli) {
    prompt = '[E] Land and exit helicopter';
  }
  Hud.interact(prompt);
}

function updateDriving(dt) {
  const car = player.car;
  if (!car) return;
  const throttle = Input.axis('KeyS', 'KeyW');
  const steer = Input.axis('KeyA', 'KeyD');
  const crashed = driveCar(car, throttle, steer, dt, colliders);
  if (crashed) AudioSys.crash();
  if (Input.down('KeyH')) AudioSys.horn();
  // Traffic collision: bump traffic cars
  for (const t of traffic) {
    if (t.dead || t === car) continue;
    const d = Math.hypot(t.pos.x - car.pos.x, t.pos.z - car.pos.z);
    if (d < 4 && Math.abs(car.speed) > 8) {
      t.speed = car.speed * 0.6;
      t.heading = car.heading + 0.3;
      car.speed *= 0.7;
      AudioSys.crash();
      if (S.wanted === 0 && Math.abs(car.speed) > 15) Police.addWanted(1, 'reckless driving');
    }
  }
  // Hitting a pedestrian while driving
  for (const p of peds) {
    if (p.dead) continue;
    const d = Math.hypot(p.pos.x - car.pos.x, p.pos.z - car.pos.z);
    if (d < 2.4 && Math.abs(car.speed) > 4) {
      p.dead = true;
      scene.remove(p.mesh);
      car.speed *= 0.6;
      Police.addWanted(1, 'running over a pedestrian');
      fleeFrom(peds, car.pos.x, car.pos.z, 30);
    }
  }
}

function updateHeliFlight(dt) {
  const throttle = Input.axis('KeyS', 'KeyW');
  const yawIn = Input.axis('KeyA', 'KeyD');
  const up = Input.down('Space') ? 1 : 0;
  const down = Input.down('KeyC') ? 1 : 0;
  heliSpeed += throttle * 22 * dt;
  heliSpeed = clamp(heliSpeed, -12, 42);
  heliSpeed *= (1 - dt * 0.4);
  heliAlt = clamp(heliAlt + (up - down) * 14 * dt, 0, 120);
  const heading = S.cameraYaw + Math.PI;
  heli.pos.x += Math.sin(heading) * heliSpeed * dt;
  heli.pos.z += Math.cos(heading) * heliSpeed * dt;
  heli.pos.y = 30 + heliAlt;
  heli.mesh.position.copy(heli.pos);
  heli.mesh.rotation.y = heading;
  heli.rotor.rotation.y += dt * 22;
  heli.spot.target.position.set(heli.pos.x, -30 - heliAlt, heli.pos.z);
  player.pos.set(heli.pos.x, heli.pos.y, heli.pos.z);
  if (heliAlt < 2 && Math.abs(heliSpeed) < 3) {
    // Landed — allow exit via E
  }
}

// --- Dispatch job progress ---
function updateDispatchJob(dt) {
  const job = S.dispatchJob;
  if (!job) return;
  const p = playerPos();
  const tx = job.step === 0 ? job.x : job.targetX;
  const tz = job.step === 0 ? job.z : job.targetZ;
  const d = Math.hypot(p.x - tx, p.z - tz);
  if (job.kind === 'vigilante') {
    if (job.step === 0) {
      if (d < 14) {
        job.step = 1;
        job.kills = 0;
        Missions.spawnDefenders(3, job.x, job.z);
        Dispatch.say('Dispatch: hostiles on site — take them down.');
      }
    } else if (job.kills >= 3) {
      Dispatch.completeJob();
    }
    return;
  }
  if (d < 10) {
    if (job.step === 0) {
      job.step = 1;
      Dispatch.say(`Dispatch: got it — now head to ${Dispatch.districtName(job.targetX, job.targetZ)}.`);
      AudioSys.pickup();
    } else {
      Dispatch.completeJob();
    }
  }
}

// --- Weapon wheel ---
let wheelOpen = false;
let wheelSelection = 0;
function updateWheel() {
  const qHeld = Input.down('KeyQ');
  if (qHeld && !player.inCar && !player.inHeli) {
    if (!wheelOpen) { wheelOpen = true; wheelSelection = S.weaponIndex; }
    if (Input.wasPressed('Digit1')) wheelSelection = 0;
    if (Input.wasPressed('Digit2')) wheelSelection = Math.min(1, S.ownedWeapons.length - 1);
    if (Input.wasPressed('Digit3')) wheelSelection = Math.min(2, S.ownedWeapons.length - 1);
    if (Input.wasPressed('Digit4')) wheelSelection = Math.min(3, S.ownedWeapons.length - 1);
    Hud.drawWheel(wheelSelection);
  } else if (wheelOpen) {
    wheelOpen = false;
    S.weaponIndex = wheelSelection;
    Hud.hideWheel();
  }
  if (Input.wasPressed('Digit1')) S.weaponIndex = 0;
  if (Input.wasPressed('Digit2') && S.ownedWeapons.length > 1) S.weaponIndex = 1;
  if (Input.wasPressed('Digit3') && S.ownedWeapons.length > 2) S.weaponIndex = 2;
  if (Input.wasPressed('Digit4') && S.ownedWeapons.length > 3) S.weaponIndex = 3;
}

// --- Key actions ---
function updateActions() {
  if (Input.wasPressed('KeyE')) {
    if (player.inHeli) { exitHeli(); return; }
    if (player.inCar) { exitCar(); return; }
    const dh = Math.hypot(player.pos.x - city.helipadPos.x, player.pos.z - city.helipadPos.z);
    if (dh < 12 && S.missionIndex >= 10 && padHeli.mesh.visible) { enterHeli(); return; }
    const car = nearestCar(6);
    if (car) { enterCar(car); return; }
  }
  if (Input.wasPressed('KeyF') && !player.inCar && !player.inHeli) carjack();
  if (Input.wasPressed('KeyG') && player.inCar) {
    const gd = Math.hypot(player.car.pos.x - city.garagePos.x, player.car.pos.z - city.garagePos.z);
    if (gd < 16) {
      S.garage.push(player.car.name);
      Hud.toast('GARAGE', `${player.car.name} stored in your garage.`);
      AudioSys.cash();
      scene.remove(player.car.mesh);
      player.car.dead = true;
      player.car = null;
      player.inCar = false;
      playerMesh.visible = true;
      player.pos.set(city.garagePos.x, 0, city.garagePos.z + 8);
    }
  }
  if (Input.wasPressed('KeyR')) {
    const name = AudioSys.nextStation();
    Hud.toast('RADIO', name);
  }
  if (Input.wasPressed('KeyT')) {
    const open = document.getElementById('dispatchPanel').classList.contains('hidden');
    if (open && !S.dispatchJob) {
      Hud.toggleDispatch(true, (job) => {
        Dispatch.acceptJob(job);
        Hud.toggleDispatch(false);
      });
    } else if (open && S.dispatchJob) {
      Hud.toast('DISPATCH', 'Finish or abandon your current job first (hold T to drop it).');
    } else {
      Hud.toggleDispatch(false);
    }
  }
  if (Input.down('KeyT') && S.dispatchJob && Input.wasPressed('KeyX')) {
    Dispatch.abandonJob();
  }
  if (Input.wasPressed('F5')) {
    saveGame();
    Hud.toast('SAVED', 'Progress saved to this browser.');
  }
  if (Input.mouseClicked && !player.inCar && !player.inHeli && !wheelOpen) shoot();
  else if (Input.mouseDown && !player.inCar && !player.inHeli && !wheelOpen) {
    const w = WEAPONS.find((x) => x.id === S.ownedWeapons[S.weaponIndex]);
    if (w?.auto) shoot();
  }
  if (Input.wasPressed('Escape')) {
    if (!document.getElementById('dispatchPanel').classList.contains('hidden')) {
      Hud.toggleDispatch(false);
    } else if (S.phase === 'playing') {
      S.phase = 'paused';
      Hud.showPause(true);
    } else if (S.phase === 'paused') {
      S.phase = 'playing';
      Hud.showPause(false);
    }
  }
}

// --- Game start ---
function startGame(fromSave) {
  unlockAudio();
  if (fromSave) {
    const data = loadSave();
    const pos = applySave(data);
    if (pos) {
      player.pos.set(pos.x, 0, pos.z);
      playerMesh.position.copy(player.pos);
    }
  } else {
    resetProgress();
  }
  S.phase = 'playing';
  Hud.showGame();
  Missions.startMission(S.missionIndex);
  statusEl.textContent = 'playing';
}

function resetProgress() {
  S.cash = 150; S.respect = 0; S.health = 100; S.armor = 0; S.wanted = 0; S.wantedHeat = 0;
  S.missionIndex = 0; S.missionStep = 0; S.missionDone = [];
  S.dispatchJob = null; S.garage = [];
  S.weaponIndex = 0; S.ownedWeapons = ['fists', 'pistol'];
  S.ammo = { pistol: 120, smg: 0, shotgun: 0 };
}

document.getElementById('btnNew').addEventListener('click', () => startGame(false));
document.getElementById('btnContinue').addEventListener('click', () => startGame(true));
document.getElementById('btnResume').addEventListener('click', () => {
  S.phase = 'playing';
  Hud.showPause(false);
});
document.getElementById('btnSave').addEventListener('click', () => {
  saveGame();
  Hud.toast('SAVED', 'Progress saved to this browser.');
});
document.getElementById('btnQuit').addEventListener('click', () => {
  saveGame();
  S.phase = 'menu';
  Hud.showPause(false);
  Hud.showMenu();
});
if (hasSave()) document.getElementById('btnContinue').classList.remove('hidden');

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

window.addEventListener('error', (e) => {
  S.debug.errors.push(String(e.message));
  statusEl.textContent = `error: ${e.message}`;
});

Input.init(canvas);
Hud.init();

// Shot mode: skip the menu, stage the scene, play.
if (shot.shot) {
  S.phase = 'playing';
  Hud.showGame();
  stageShot(shotApi, shot.shot);
  statusEl.textContent = `shot:${shot.shot}`;
} else {
  statusEl.textContent = 'menu ready';
}

// --- Main loop ---
const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0, fpsTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  S.time += dt;
  fpsAcc += dt; fpsN++; fpsTimer += dt;
  if (fpsTimer > 1) {
    S.debug.fps = Math.round(fpsN / fpsAcc);
    fpsAcc = 0; fpsN = 0; fpsTimer = 0;
    if (S.phase === 'playing' && !shot.shot) statusEl.textContent = `playing fps=${S.debug.fps}`;
  }

  if (S.phase === 'playing') {
    const a = api();
    if (player.inCar) updateDriving(dt);
    else if (player.inHeli) updateHeliFlight(dt);
    else updatePlayer(dt);
    updateCamera(dt);
    updateActions();
    updateWheel();
    updateInteract();
    updateDispatchJob(dt);
    Missions.update(dt, a);
    Missions.updateEnemies(dt, a, colliders);
    Police.update(dt, scene, rng, playerPos(), player.inCar, player.car, colliders, onBusted, onWasted);
    Dispatch.update(dt);
    // Traffic + pedestrians
    for (const t of traffic) {
      if (t.dead) continue;
      if (t === player.car) continue;
      const d = Math.hypot(t.pos.x - player.pos.x, t.pos.z - player.pos.z);
      if (d > 320) {
        // Recycle far traffic near the player.
        const road = Math.round(range(rng, -HALF + 120, HALF - 120) / 120) * 120;
        t.pos.x = player.pos.x + range(rng, -160, 160);
        t.pos.z = player.pos.z + range(rng, -160, 160);
        t.route = null;
        continue;
      }
      trafficThink(t, dt, rng, traffic);
    }
    traffic = traffic.filter((t) => !t.dead);
    const danger = S.wanted > 0 ? playerPos() : null;
    for (const p of peds) {
      if (!p.dead) updatePedestrian(p, dt, rng, colliders, danger);
    }
    peds = peds.filter((p) => !p.dead);
    if (peds.length < 30) {
      peds.push(...spawnPedestrians(scene, 8, rng));
    }
    // Heli follows the player at high wanted (not while the player flies it)
    if (!player.inHeli) updateHeli(heli, player.pos.x, player.pos.z, dt, S.time);
    // Mission beacon pulse
    if (city.beacon.visible) {
      city.beacon.rotation.y += dt * 1.5;
      city.beacon.children[0].material.opacity = 0.25 + Math.sin(S.time * 3) * 0.12;
    }
    // Escort truck marker follows the truck
    if (tracer) {
      tracerTimer -= dt;
      if (tracerTimer <= 0) { scene.remove(tracer); tracer = null; }
    }
    // Autosave on mission complete is handled in Missions via cash; save here on step change
    AudioSys.update(dt, player.inCar && player.car ? Math.abs(player.car.speed) : player.speed, S.wanted);
    Hud.update(dt, a);
  } else if (S.phase === 'menu') {
    // Slow cinematic orbit behind the menu.
    const t = S.time * 0.05;
    camera.position.set(Math.sin(t) * 260, 90, Math.cos(t) * 260);
    camera.lookAt(0, 10, 0);
    for (const tCar of traffic) trafficThink(tCar, dt, rng, traffic);
    for (const p of peds) updatePedestrian(p, dt, rng, colliders, null);
  }

  renderer.render(scene, camera);
  Input.endFrame();
}
animate();
