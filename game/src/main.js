// Velamar — the game itself. Boots the renderer, wires input, runs the loop,
// owns the player, the camera, crime and saves. Everything is original:
// the city, the crew, the story and the music.
import * as THREE from 'three';
import { buildCity, districtAt, collideCircle, clampWorld } from './city.js';
import { Car, Traffic, separateCars, CAR_KINDS } from './vehicles.js';
import { Police } from './police.js';
import { Player, Pedestrians, Enemies, WEAPONS, WEAPON_ORDER } from './people.js';
import { MissionRunner, STORY, RACES } from './missions.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { makeRng } from './rng.js';
import { stageShot } from './shots.js';

const SAVE_KEY = 'velamar-save-v2';
const INTERACTS = [
  { x: 300, z: 0, r: 9, label: 'Vela Motors garage', action: 'garage' },
  { x: 100, z: 200, r: 9, label: 'Ironworks Arms', action: 'gunshop' },
  { x: 40, z: 250, r: 9, label: 'Safehouse — save game', action: 'safehouse' },
  { x: -420, z: -100, r: 9, label: 'Rampage — start chaos', action: 'rampage' },
  ...RACES.map((r, i) => ({ x: r.start[0], z: r.start[1], r: 10, label: `${r.name} — start race`, action: 'race', index: i })),
];

export class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1600);
    this.clock = new THREE.Clock();
    this.audio = new AudioEngine();
    this.city = buildCity(this.scene);
    this.police = new Police(this.scene, this.city, this.audio);
    this.player = new Player(this.scene);
    this.peds = new Pedestrians(this.scene, this.city);
    this.enemies = new Enemies(this.scene, this.audio);
    this.traffic = new Traffic(this.scene, this.city);
    this.missions = new MissionRunner(this.scene);
    this.missions.buildWorld();
    this.hud = new HUD(document.getElementById('hud'), this);
    this.rng = makeRng(20261120);

    this.state = 'title'; // title | play | dead | busted
    this.menuOpen = false;
    this.paused = false;
    this.cash = 500;
    this.respect = 0;
    this.missionIndex = 0;
    this.garage = { owned: ['sedan'], nos: false, armor: false };
    this.playerCar = null;
    this.cars = [];
    this.camYaw = 0;
    this.camPitch = 0.32;
    this.camDist = 11;
    this.keys = new Set();
    this.mouseDown = false;
    this.pointerLocked = false;
    this.clockMinutes = 17 * 60 + 30;
    this.district = 'Velamar';
    this.shake = 0;
    this.saveTimer = 0;
    this.interactTarget = null;
    this.deadTimer = 0;
    this.shotMode = new URLSearchParams(location.search).get('shot');

    this.setupInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.spawnStarterCar();
    this.traffic.ensure(this.player.pos);
    this.peds.ensure(this.player.pos);
    if (this.shotMode) {
      this.startGame(false);
      stageShot(this.shotMode, this);
      window.__shotReady = true;
    }
    this.renderer.setAnimationLoop(() => this.frame());
  }

  spawnStarterCar() {
    const car = new Car('sedan', 0x2e6fc2, 8, 128, Math.PI);
    car.driver = null;
    this.scene.add(car.mesh);
    this.cars.push(car);
  }

  setupInput() {
    const canvas = this.canvas;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.audio.init();
      this.audio.resume();
      if (e.code === 'Escape') {
        if (this.state === 'play') this.togglePause();
        return;
      }
      if (this.state !== 'play' || this.menuOpen) return;
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'KeyR') {
        this.audio.setStation(this.audio.station + 1);
        this.hud.toast(`Radio: ${this.audio.stationName()} — ${this.audio.trackName()}`);
      }
      if (e.code === 'KeyM') {
        this.audio.setMuted(!this.audio.muted);
        this.audio.radioOn = !this.audio.muted;
        this.hud.toast(this.audio.muted ? 'Sound muted' : 'Sound on');
      }
      if (e.code === 'KeyT') this.missions.startTaxi(this);
      if (e.code === 'KeyP') this.hud.showMissions();
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3'
        || e.code === 'Digit4' || e.code === 'Digit5') {
        const idx = Number(e.code.slice(-1)) - 1;
        const key = WEAPON_ORDER[idx];
        if (key && this.player.owned.has(key)) {
          this.player.weapon = key;
          this.audio.click();
        }
      }
      if (e.code === 'KeyQ') this.hud.showWheel();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyQ') this.hud.hideWheel();
    });
    canvas.addEventListener('mousedown', (e) => {
      this.audio.init();
      this.audio.resume();
      if (this.state !== 'play' || this.menuOpen) return;
      if (e.button === 0) {
        this.mouseDown = true;
        if (!this.pointerLocked && !this.playerCar) canvas.requestPointerLock();
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
    });
    window.addEventListener('mousemove', (e) => {
      if (this.state !== 'play' || this.menuOpen) return;
      if (this.pointerLocked) {
        this.camYaw -= e.movementX * 0.0028;
        this.camPitch = Math.max(-0.15, Math.min(0.9, this.camPitch + e.movementY * 0.002));
      } else if (e.buttons === 1) {
        this.camYaw -= e.movementX * 0.005;
        this.camPitch = Math.max(-0.15, Math.min(0.9, this.camPitch + e.movementY * 0.004));
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  startGame(continueSave) {
    this.audio.init();
    this.audio.resume();
    if (continueSave) this.loadGame();
    this.state = 'play';
    this.hud.titleScreen.classList.add('hidden');
    this.hud.continueBtn.style.display = this.hasSave() ? '' : 'none';
    if (!continueSave && !this.hasSave() && !this.shotMode) {
      this.hud.showPhone('Selma Reyes', 'Dario. Three years gone and the city forgot you. Get to the Marina safehouse. Mission 1 is on the board — press P.');
      setTimeout(() => {
        if (this.state === 'play' && !this.missions.active) this.missions.startMission(0, this);
      }, 2500);
    }
  }

  toTitle() {
    this.state = 'title';
    this.paused = false;
    this.menuOpen = false;
    this.hud.pauseScreen.classList.add('hidden');
    this.hud.titleScreen.classList.remove('hidden');
    this.hud.continueBtn.style.display = this.hasSave() ? '' : 'none';
    if (document.pointerLockElement) document.exitPointerLock();
  }

  togglePause(force) {
    this.paused = force !== undefined ? force : !this.paused;
    this.hud.pauseScreen.classList.toggle('hidden', !this.paused);
    if (!this.paused && document.pointerLockElement) document.exitPointerLock();
  }

  openMenu() {
    this.menuOpen = true;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  closeMenu() {
    this.menuOpen = false;
  }

  hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }

  saveGame() {
    try {
      const data = {
        cash: this.cash,
        respect: this.respect,
        missionIndex: this.missionIndex,
        completed: [...this.missions.completed],
        garage: this.garage,
        weapons: [...this.player.owned],
        ammo: this.player.ammo,
        packages: this.missions.packageSpots.map((p) => p.taken),
        clock: this.clockMinutes,
        pos: [this.player.pos.x, this.player.pos.z],
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable — the game still plays */ }
  }

  loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      this.cash = d.cash ?? 500;
      this.respect = d.respect ?? 0;
      this.missionIndex = d.missionIndex ?? 0;
      this.missions.completed = new Set(d.completed || []);
      this.garage = d.garage || this.garage;
      this.player.owned = new Set(d.weapons || ['fists', 'pistol']);
      this.player.ammo = d.ammo || this.player.ammo;
      (d.packages || []).forEach((taken, i) => {
        const p = this.missions.packageSpots[i];
        if (taken && p && !p.taken) {
          p.taken = true;
          this.scene.remove(p.mesh);
        }
      });
      this.clockMinutes = d.clock ?? 17 * 60 + 30;
      if (d.pos) this.player.pos.set(d.pos[0], 0, d.pos[1]);
    } catch (e) { /* corrupt save — start fresh */ }
  }

  addCash(n) {
    this.cash += n;
  }

  addRespect(n) {
    this.respect += n;
  }

  spawnGarageCar(kind) {
    const spec = CAR_KINDS[kind];
    const car = new Car(kind, 0xc23b2e, this.player.pos.x + 6, this.player.pos.z + 4, 0);
    car.driver = null;
    this.scene.add(car.mesh);
    this.cars.push(car);
    this.hud.toast(`${spec.name} delivered to the street`);
    this.audio.pickup();
  }

  nearestCar(maxDist) {
    let best = null;
    let bd = maxDist;
    for (const c of [...this.cars, ...this.traffic.cars, ...this.police.cars]) {
      if (!c.alive) continue;
      const d = Math.hypot(c.pos.x - this.player.pos.x, c.pos.z - this.player.pos.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  enterCar(car) {
    if (car.driver === 'traffic') {
      // Carjacking: the driver bails and runs.
      this.police.addHeat(0.6);
      this.peds.spawnOne(car.pos);
      const ped = this.peds.list[this.peds.list.length - 1];
      if (ped) ped.panic = 5;
      this.hud.toast('Carjacked — the VCPD noticed');
    }
    if (car.driver === 'police') {
      this.police.addHeat(1.5);
      this.hud.toast('Stole a VCPD cruiser!');
    }
    car.driver = 'player';
    this.playerCar = car;
    this.player.mesh.visible = false;
    this.camYaw = car.heading;
    this.audio.setEngine(0, true);
  }

  exitCar() {
    const car = this.playerCar;
    if (!car) return;
    car.driver = null;
    car.speed = 0;
    this.playerCar = null;
    const side = Math.cos(car.heading);
    const sideZ = -Math.sin(car.heading);
    this.player.pos.set(car.pos.x + side * 3, 0, car.pos.z + sideZ * 3);
    this.player.mesh.visible = true;
    this.player.heading = car.heading;
    this.camYaw = car.heading;
    this.audio.setEngine(0, false);
  }

  interact() {
    if (this.playerCar) { this.exitCar(); return; }
    if (this.interactTarget) {
      const t = this.interactTarget;
      if (t.action === 'garage') this.hud.showGarage();
      else if (t.action === 'gunshop') this.hud.showGunshop();
      else if (t.action === 'safehouse') {
        this.saveGame();
        this.player.heal(100);
        this.police.setWanted(0);
        this.hud.banner('SAFEHOUSE', 'Game saved — health restored, heat cleared');
        this.audio.missionDone();
      } else if (t.action === 'rampage') this.missions.startRampage(this);
      else if (t.action === 'race') this.missions.startRace(this, t.index);
      return;
    }
    const car = this.nearestCar(6);
    if (car) this.enterCar(car);
  }

  shoot() {
    const w = WEAPONS[this.player.weapon];
    if (this.player.fireTimer > 0) return;
    if (this.player.weapon !== 'fists' && this.player.ammo[this.player.weapon] <= 0) {
      this.hud.toast('Out of ammo — buy more at Ironworks Arms');
      this.player.fireTimer = 0.4;
      return;
    }
    this.player.fireTimer = w.rate;
    if (this.player.weapon !== 'fists') this.player.ammo[this.player.weapon] -= 1;
    this.audio.shoot(this.player.weapon);
    this.police.addHeat(0.35);
    this.peds.panicAt(this.player.pos.x, this.player.pos.z, 40);
    const from = new THREE.Vector3(
      this.player.pos.x, this.player.pos.y + 1.5, this.player.pos.z,
    );
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const aim = new THREE.Vector3().copy(from).addScaledVector(dir, 60);
    const pellets = w.pellets || 1;
    for (let i = 0; i < pellets; i += 1) {
      this.enemies.shootAt(from, aim, w, (e, killed) => {
        if (killed) {
          this.addCash(120);
          this.police.addHeat(0.2);
          this.hud.toast('Target down — $120');
        }
      });
    }
    // Hitting a pedestrian is a crime.
    for (const p of this.peds.list) {
      const to = new THREE.Vector3(p.pos.x, p.pos.y + 1, p.pos.z).sub(from);
      const t = to.dot(dir);
      if (t < 0 || t > w.range) continue;
      const closest = new THREE.Vector3().copy(from).addScaledVector(dir, t);
      if (closest.distanceTo(new THREE.Vector3(p.pos.x, p.pos.y + 1, p.pos.z)) < 1) {
        p.hp -= w.damage;
        if (p.hp <= 0) {
          this.scene.remove(p.mesh);
          this.peds.list.splice(this.peds.list.indexOf(p), 1);
          this.police.addHeat(1);
          this.hud.toast('Pedestrian down — the VCPD is coming');
        }
        break;
      }
    }
    this.shake = Math.max(this.shake, 0.12);
  }

  explodeCar(car) {
    const boom = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.9 }),
    );
    boom.position.copy(car.pos);
    boom.position.y = 1.5;
    this.scene.add(boom);
    const start = performance.now();
    const grow = () => {
      const t = (performance.now() - start) / 600;
      if (t >= 1) { this.scene.remove(boom); return; }
      boom.scale.setScalar(1 + t * 9);
      boom.material.opacity = 0.9 * (1 - t);
      requestAnimationFrame(grow);
    };
    grow();
    this.audio.explosion();
    this.shake = 0.7;
    this.missions.onVehicleWrecked();
    this.police.addHeat(0.8);
    if (car === this.playerCar) {
      this.exitCar();
      this.player.damage(35);
    }
    car.alive = false;
    this.scene.remove(car.mesh);
    this.cars = this.cars.filter((c) => c !== car);
    this.traffic.cars = this.traffic.cars.filter((c) => c !== car);
    this.police.cars = this.police.cars.filter((c) => c !== car);
  }

  updatePlayer(dt) {
    const input = {
      forward: this.keys.has('KeyW') || this.keys.has('ArrowUp'),
      back: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
      left: this.keys.has('KeyA') || this.keys.has('ArrowLeft'),
      right: this.keys.has('KeyD') || this.keys.has('ArrowRight'),
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      jump: this.keys.has('Space'),
    };
    if (this.playerCar) {
      const car = this.playerCar;
      const throttle = input.forward ? 1 : input.back ? -0.7 : 0;
      const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      const handbrake = input.jump;
      if (input.sprint && this.garage.nos) car.nos = Math.max(car.nos, 0.4);
      const prevSpeed = car.speed;
      car.drive(dt, throttle, steer, handbrake);
      if (Math.abs(prevSpeed - car.speed) > 18 && Math.abs(car.speed) < 4) this.audio.crash(0.6);
      if (handbrake && Math.abs(car.speed) > 14 && Math.random() < dt * 6) this.audio.skid();
      collideCircle(car.pos, 2.4, this.city.colliders);
      clampWorld(car.pos);
      car.syncMesh();
      this.audio.setEngine(Math.abs(car.speed) / car.spec.top, true);
      if (car.hp <= 0) this.explodeCar(car);
      // Wrecked traffic cars explode too.
      for (const c of [...this.traffic.cars]) {
        if (c.hp <= 0) this.explodeCar(c);
      }
    } else {
      this.player.move(dt, input, this.camYaw, this.city.colliders);
      this.audio.setEngine(0, false);
      if (this.mouseDown) this.shoot();
      // Interaction prompt.
      let found = null;
      for (const t of INTERACTS) {
        const d = Math.hypot(t.x - this.player.pos.x, t.z - this.player.pos.z);
        if (d < t.r) { found = t; break; }
      }
      this.interactTarget = found;
      const label = found ? found.label : '';
      if (label !== this.lastInteractLabel) {
        this.lastInteractLabel = label;
        if (found) this.hud.center(`Press E — ${found.label}`, 0.2);
        else this.hud.center('', 0.01);
      }
    }
    this.district = districtAt(this.player.pos.x, this.player.pos.z);
  }

  updateCamera(dt) {
    if (this.shotCam) {
      this.camera.position.set(this.shotCam.pos[0], this.shotCam.pos[1], this.shotCam.pos[2]);
      this.camera.lookAt(this.shotCam.look[0], this.shotCam.look[1], this.shotCam.look[2]);
      return;
    }
    const target = this.playerCar ? this.playerCar.pos : this.player.pos;
    const heading = this.playerCar ? this.playerCar.heading : this.camYaw;
    const dist = this.playerCar ? 12.5 : 7.5;
    const height = this.playerCar ? 4.6 : 3.1;
    const backX = target.x - Math.sin(heading) * dist * Math.cos(this.camPitch);
    const backZ = target.z - Math.cos(heading) * dist * Math.cos(this.camPitch);
    const backY = (this.playerCar ? 1.2 : 1.6) + height * Math.sin(this.camPitch) + height * 0.4;
    const desired = new THREE.Vector3(backX, backY, target.z * 0 + backZ);
    this.camera.position.lerp(desired, Math.min(1, 10 * dt));
    const look = new THREE.Vector3(
      target.x + Math.sin(heading) * 6,
      (this.playerCar ? 1.4 : 1.6),
      target.z + Math.cos(heading) * 6,
    );
    if (this.shake > 0) {
      this.shake -= dt;
      look.x += (Math.random() - 0.5) * this.shake;
      look.y += (Math.random() - 0.5) * this.shake;
    }
    this.camera.lookAt(look);
  }

  updateWorld(dt) {
    // Clock: one game hour per 150 seconds; sun follows it.
    this.clockMinutes += (dt * 60) / 150;
    const dayFrac = (this.clockMinutes / 1440) % 1;
    const sunAngle = dayFrac * Math.PI * 2;
    const sunH = Math.sin(sunAngle);
    const sun = this.city.sun;
    sun.intensity = Math.max(0.25, 1.4 + sunH * 1.4);
    sun.position.set(Math.cos(sunAngle) * 300, 120 + sunH * 180, 140);
    const warm = sunH > 0 ? 0xffe0b0 : 0x9ab8e8;
    sun.color.setHex(warm);
    this.city.wheel.rotation.z += dt * 0.12;
    this.city.beacon.material.color.setHex(
      Math.floor(performance.now() / 500) % 2 ? 0xffd27a : 0xff9a5a,
    );
    this.city.ocean.position.z = WORLD_OCEAN_Z + Math.sin(performance.now() * 0.0004) * 3;
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.state === 'play' && !this.paused && !this.menuOpen) {
      this.updatePlayer(dt);
      this.traffic.update(dt, this.player.pos, [...this.cars, ...this.traffic.cars, ...this.police.cars]);
      separateCars([...this.cars, ...this.traffic.cars, ...this.police.cars]);
      this.peds.update(dt, this.player.pos, this.city.colliders);
      this.enemies.update(dt, this.player.pos, this.player, (dmg) => {
        if (this.player.damage(dmg)) this.die();
      });
      this.police.update(dt, this.player, this.playerCar,
        () => this.busted(),
        (dmg) => { if (this.player.damage(dmg)) this.die(); });
      this.missions.update(dt, this);
      this.updateWorld(dt);
      this.audio.updateRadio(dt);
      this.saveTimer += dt;
      if (this.saveTimer > 60) { this.saveTimer = 0; this.saveGame(); }
    }
    if (this.state === 'dead' || this.state === 'busted') {
      this.deadTimer -= dt;
      if (this.deadTimer <= 0) this.respawn();
    }
    this.updateCamera(dt);
    this.hud.update(dt, this);
    this.renderer.render(this.scene, this.camera);
  }

  die() {
    if (this.state !== 'play') return;
    this.state = 'dead';
    this.deadTimer = 3;
    this.audio.missionFail();
    this.hud.banner('WASTED', 'You died — the city keeps moving');
    if (this.playerCar) this.exitCar();
    this.player.hp = 100;
    this.cash = Math.max(0, this.cash - 200);
  }

  busted() {
    if (this.state !== 'play') return;
    this.state = 'busted';
    this.deadTimer = 3;
    this.audio.missionFail();
    this.hud.banner('BUSTED', 'The VCPD took you in — $300 bail');
    if (this.playerCar) this.exitCar();
    this.player.hp = 100;
    this.cash = Math.max(0, this.cash - 300);
    this.police.clear();
  }

  respawn() {
    this.player.pos.set(40, 0, 250);
    this.player.heading = 0;
    this.player.hp = 100;
    this.state = 'play';
    this.missions.active = null;
    this.missions.beacon.visible = false;
    this.enemies.clear();
    this.hud.banner('VELAMAR GENERAL', 'Patched up. Back on the street.');
  }
}

const WORLD_OCEAN_Z = 890;

new Game();
