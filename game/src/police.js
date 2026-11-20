// Velamar — the wanted system. Stars rise with crime, VCPD cruisers chase,
// roadblocks and spike strips appear at 3+, and the Air One helicopter joins
// at 3+. Hide, ditch the car, or outrun the search to cool off.
import * as THREE from 'three';
import { Car } from './vehicles.js';
import { makeRng } from './rng.js';
import { collideCircle, clampWorld } from './city.js';

const STAR_HEAT = [0, 1, 2.4, 4.2, 6.4, 9];

export class Police {
  constructor(scene, city, audio) {
    this.scene = scene;
    this.city = city;
    this.audio = audio;
    this.rng = makeRng(4242);
    this.wanted = 0;
    this.heat = 0;
    this.cars = [];
    this.footCops = [];
    this.heli = null;
    this.heliLight = null;
    this.roadblocks = [];
    this.blockCars = [];
    this.spikes = [];
    this.coolTimer = 0;
    this.bustTimer = 0;
    this.blockTimer = 0;
    this.maxCars = 0;
  }

  addHeat(amount) {
    this.heat = Math.min(10, this.heat + amount);
    this.recompute();
  }

  setWanted(n) {
    this.wanted = n;
    this.heat = STAR_HEAT[n];
    this.recompute();
  }

  recompute() {
    let w = 0;
    for (let i = 0; i < STAR_HEAT.length; i += 1) {
      if (this.heat >= STAR_HEAT[i]) w = i;
    }
    this.wanted = w;
    this.maxCars = [0, 2, 3, 4, 6, 8][w];
  }

  clear() {
    this.wanted = 0;
    this.heat = 0;
    for (const c of this.cars) this.scene.remove(c.mesh);
    this.cars = [];
    for (const c of this.footCops) this.scene.remove(c.mesh);
    this.footCops = [];
    this.clearRoadblocks();
    if (this.heli) { this.scene.remove(this.heli); this.heli = null; }
    if (this.heliLight) { this.scene.remove(this.heliLight); this.heliLight = null; }
  }

  clearRoadblocks() {
    for (const b of this.roadblocks) this.scene.remove(b);
    this.roadblocks = [];
    if (this.blockCars) {
      this.cars = this.cars.filter((c) => !this.blockCars.includes(c));
      this.blockCars = [];
    }
    for (const s of this.spikes) this.scene.remove(s);
    this.spikes = [];
  }

  spawnCruiser(playerPos) {
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = this.rng.range(70, 110);
    const p = this.city.nearestRoad(
      playerPos.x + Math.cos(angle) * dist,
      playerPos.z + Math.sin(angle) * dist,
    );
    const car = new Car('police', 0x1c2a44, p.x, p.z, 0);
    car.driver = 'police';
    car.speed = 20;
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  }

  spawnFootCop(playerPos) {
    const angle = this.rng.range(0, Math.PI * 2);
    const x = playerPos.x + Math.cos(angle) * 14;
    const z = playerPos.z + Math.sin(angle) * 14;
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.1, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x1c2a44 }),
    );
    body.position.y = 1.05;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xc98a5e }),
    );
    head.position.y = 1.85;
    g.add(head);
    const hat = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.14, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x11131a }),
    );
    hat.position.y = 2.1;
    g.add(hat);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.7, 0.38),
      new THREE.MeshLambertMaterial({ color: 0x14161c }),
    );
    legs.position.y = 0.35;
    g.add(legs);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const cop = { mesh: g, pos: g.position, hp: 60, speed: 6.5, attackTimer: 0 };
    this.footCops.push(cop);
    return cop;
  }

  makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.6, 6.4),
      new THREE.MeshLambertMaterial({ color: 0x22303e }),
    );
    body.castShadow = true;
    g.add(body);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1, 1.6),
      new THREE.MeshLambertMaterial({ color: 0x9fd0e8 }),
    );
    glass.position.set(0, 0.1, 2.6);
    g.add(glass);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 6),
      new THREE.MeshLambertMaterial({ color: 0x22303e }),
    );
    tail.position.set(0, 0.3, -5.4);
    g.add(tail);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(13, 0.12, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    rotor.position.y = 1.2;
    rotor.name = 'rotor';
    g.add(rotor);
    const skid = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.18, 4.4),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    skid.position.y = -1.1;
    g.add(skid);
    this.heliLight = new THREE.SpotLight(0xfff2c0, 900, 90, 0.32, 0.5, 1.2);
    this.scene.add(this.heliLight);
    this.scene.add(this.heliLight.target);
    g.userData.rotor = rotor;
    this.heli = g;
    this.scene.add(g);
  }

  placeRoadblock(playerPos, heading) {
    const aheadX = playerPos.x + Math.sin(heading) * 55;
    const aheadZ = playerPos.z + Math.cos(heading) * 55;
    const p = this.city.nearestRoad(aheadX, aheadZ);
    const grp = new THREE.Group();
    for (const off of [-5, 5]) {
      const car = new Car('police', 0x1c2a44, p.x + off, p.z, heading + Math.PI / 2);
      car.driver = 'police';
      car.speed = 0;
      car.roadblock = true;
      this.scene.add(car.mesh);
      grp.add(car.mesh);
      this.cars.push(car);
      this.blockCars.push(car);
    }
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xe8a13a }),
    );
    barrier.position.set(p.x, 0.6, p.z);
    barrier.rotation.y = heading;
    grp.add(barrier);
    this.scene.add(grp);
    this.roadblocks.push(grp);
  }

  placeSpikes(playerPos, heading) {
    const aheadX = playerPos.x + Math.sin(heading) * 40;
    const aheadZ = playerPos.z + Math.cos(heading) * 40;
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.25, 1.4),
      new THREE.MeshLambertMaterial({ color: 0x333333 }),
    );
    strip.position.set(aheadX, 0.15, aheadZ);
    strip.rotation.y = heading;
    this.scene.add(strip);
    this.spikes.push(strip);
  }

  update(dt, player, playerCar, onBusted, onDamage) {
    const playerPos = playerCar ? playerCar.pos : player.pos;
    const speed = playerCar ? Math.abs(playerCar.speed) : 0;
    // Cool off when no police can see the player.
    if (this.wanted > 0) {
      const nearest = this.cars.length
        ? Math.min(...this.cars.map((c) => Math.hypot(c.pos.x - playerPos.x, c.pos.z - playerPos.z)))
        : 999;
      if (nearest > 130 && speed < 4) this.coolTimer += dt;
      else this.coolTimer = 0;
      if (this.coolTimer > 6) {
        this.heat = Math.max(0, this.heat - dt * 0.55);
        this.recompute();
        if (this.wanted === 0) this.clear();
      }
    }

    // Spawn cruisers up to the wanted cap.
    while (this.cars.length < this.maxCars && this.wanted > 0) this.spawnCruiser(playerPos);
    // Foot cops when the player is on foot and wanted.
    if (!playerCar && this.wanted >= 1 && this.footCops.length < Math.min(3, this.wanted)) {
      this.spawnFootCop(playerPos);
    }
    if (playerCar && this.footCops.length > 0) {
      for (const c of this.footCops) this.scene.remove(c.mesh);
      this.footCops = [];
    }

    // Chase steering for every cruiser.
    for (const car of this.cars) {
      if (car.roadblock) { car.syncMesh(); continue; }
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 260) {
        // Teleport a lost cruiser back near the player.
        const p = this.city.nearestRoad(
          playerPos.x + (this.rng.next() - 0.5) * 140,
          playerPos.z + (this.rng.next() - 0.5) * 140,
        );
        car.pos.set(p.x, 0, p.z);
        car.speed = 18;
        continue;
      }
      const want = Math.atan2(dx, dz);
      let dh = want - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 2.2));
      const targetSpeed = this.wanted >= 4 ? 42 : 34;
      const throttle = car.speed < targetSpeed ? 1 : 0.2;
      car.drive(dt, throttle, steer, false);
      collideCircle(car.pos, 2.4, this.city.colliders);
      clampWorld(car.pos);
      car.syncMesh();
      // Ram damage to the player's car.
      if (playerCar && dist < 5.2) {
        playerCar.hp -= 14 * dt;
        if (onDamage) onDamage(4 * dt);
      }
      // Busted: a cruiser sits on the player on foot.
      if (!playerCar && dist < 3.4) {
        this.bustTimer += dt;
        if (this.bustTimer > 1.6 && onBusted) onBusted();
      } else {
        this.bustTimer = Math.max(0, this.bustTimer - dt);
      }
    }

    // Foot cops chase and punch.
    for (const cop of this.footCops) {
      const dx = playerPos.x - cop.pos.x;
      const dz = playerPos.z - cop.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1.2) {
        cop.pos.x += (dx / dist) * cop.speed * dt;
        cop.pos.z += (dz / dist) * cop.speed * dt;
        cop.mesh.rotation.y = Math.atan2(dx, dz);
      } else {
        cop.attackTimer -= dt;
        if (cop.attackTimer <= 0) {
          cop.attackTimer = 0.9;
          if (onDamage) onDamage(7);
        }
      }
      collideCircle(cop.pos, 0.5, this.city.colliders);
    }

    // Helicopter at 3+ stars.
    if (this.wanted >= 3 && !this.heli) this.makeHeli();
    if (this.wanted < 3 && this.heli) {
      this.scene.remove(this.heli);
      this.heli = null;
      this.scene.remove(this.heliLight);
      this.heliLight = null;
    }
    if (this.heli) {
      const t = performance.now() * 0.001;
      // Orbit biased ahead of the player's direction of travel so the
      // helicopter stays in view during a chase.
      const heading = playerCar ? playerCar.heading : player.heading;
      const fx = Math.sin(heading) * 30;
      const fz = Math.cos(heading) * 30;
      const hx = playerPos.x + fx + Math.cos(t * 0.45) * 42;
      const hz = playerPos.z + fz + Math.sin(t * 0.45) * 42;
      this.heli.position.set(hx, 30, hz);
      this.heli.rotation.y = Math.atan2(playerPos.x - hx, playerPos.z - hz);
      this.heli.userData.rotor.rotation.y += dt * 22;
      this.heliLight.position.copy(this.heli.position);
      this.heliLight.target.position.set(playerPos.x, 0, playerPos.z);
    }

    // Roadblocks and spikes on a timer at higher wanted levels.
    this.blockTimer -= dt;
    if (this.wanted >= 3 && this.blockTimer <= 0 && playerCar) {
      this.blockTimer = 17;
      this.placeRoadblock(playerPos, playerCar.heading);
      if (this.wanted >= 4) this.placeSpikes(playerPos, playerCar.heading);
    }
    if (playerCar) {
      for (const s of this.spikes) {
        if (Math.hypot(s.position.x - playerCar.pos.x, s.position.z - playerCar.pos.z) < 5) {
          if (!playerCar.tirePopped) {
            playerCar.tirePopped = true;
            if (this.audio) this.audio.noise(0.4, 3000, 0.4);
          }
        }
      }
    }

    this.audio.setSiren(this.wanted > 0, this.wanted);
  }
}
