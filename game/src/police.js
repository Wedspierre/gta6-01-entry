// Police: wanted level, pursuit cars, roadblocks, helicopter escalation,
// busted/wasted handling. Dispatch feeds the radio chatter.
import * as THREE from 'three';
import { S } from './state.js';
import { CAR_MODELS, makeCar, driveCar } from './vehicles.js';
import { clamp, angleDiff, range } from './rng.js';
import { AudioSys } from './audio.js';

export const Police = {
  cars: [],
  roadblocks: [],
  heli: null,
  spawnTimer: 0,
  roadblockTimer: 0,
  lastSeen: 0,
  bustedTimer: 0,

  init(scene, heli) {
    this.heli = heli;
    this.cars = [];
    this.roadblocks = [];
  },

  addWanted(n, reason) {
    const before = S.wanted;
    S.wanted = clamp(S.wanted + n, 0, 5);
    S.wantedHeat = 100;
    if (S.wanted > before) {
      AudioSys.wantedUp();
      this.radio(`Dispatch: all units, suspect ${reason || 'in Velamar Bay'} — wanted level ${S.wanted}.`);
    }
  },

  radio(text) {
    if (window.__velamarFeed) window.__velamarFeed('DISPATCH', text);
  },

  wantedCount() {
    return S.wanted;
  },

  maxCops() {
    return [0, 2, 3, 4, 5, 6][S.wanted];
  },

  spawnCop(scene, rng, px, pz) {
    const model = CAR_MODELS.find((m) => m.name === 'Interceptor');
    const angle = range(rng, 0, Math.PI * 2);
    const x = px + Math.sin(angle) * 90;
    const z = pz + Math.cos(angle) * 90;
    const car = makeCar(scene, model, x, z, angle, { police: true });
    car.targetSpeed = 30;
    this.cars.push(car);
    return car;
  },

  // A roadblock: two police cars + barrier across the road ahead of the player.
  spawnRoadblock(scene, rng, px, pz, heading) {
    const ahead = 55;
    const bx = px + Math.sin(heading) * ahead;
    const bz = pz + Math.cos(heading) * ahead;
    const group = new THREE.Group();
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd81a1a, roughness: 0.5 });
    for (let i = -1; i <= 1; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(7, 1.1, 0.6), i % 2 ? stripeMat : barrierMat);
      bar.position.set(i * 7.4, 1.1, 0);
      bar.castShadow = true;
      group.add(bar);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.5), barrierMat);
      leg.position.set(i * 7.4, 0.55, 0);
      group.add(leg);
    }
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.7 });
    for (const cx of [-12, -6, 6, 12]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 8), coneMat);
      cone.position.set(cx, 0.7, 6);
      group.add(cone);
    }
    group.position.set(bx, 0, bz);
    group.rotation.y = heading + Math.PI / 2;
    scene.add(group);
    const model = CAR_MODELS.find((m) => m.name === 'Interceptor');
    const c1 = makeCar(scene, model, bx - 10, bz, heading + Math.PI / 2, { police: true });
    const c2 = makeCar(scene, model, bx + 10, bz, heading - Math.PI / 2, { police: true });
    const block = { group, x: bx, z: bz, heading, cars: [c1, c2], hit: false, smashed: 0 };
    this.roadblocks.push(block);
    this.radio('Dispatch: roadblock up ahead — all units converge.');
    return block;
  },

  clearRoadblocks(scene) {
    for (const b of this.roadblocks) {
      scene.remove(b.group);
      for (const c of b.cars) { scene.remove(c.mesh); c.dead = true; }
    }
    this.roadblocks = [];
  },

  update(dt, scene, rng, playerPos, playerInCar, playerCar, colliders, onBusted, onWasted) {
    // Wanted decay: hide from police and heat falls.
    if (S.wanted > 0) {
      const nearestCop = this.cars.reduce((m, c) => Math.min(m, Math.hypot(c.pos.x - playerPos.x, c.pos.z - playerPos.z)), 9999);
      const seen = nearestCop < 70 || (this.heli && this.heli.active);
      if (!seen) {
        S.wantedHeat -= dt * 7;
        if (S.wantedHeat <= 0) {
          S.wanted--;
          S.wantedHeat = 100;
          if (S.wanted === 0) {
            this.radio('Dispatch: suspect lost. All units stand down.');
            this.clearRoadblocks(scene);
            if (this.heli) this.heli.active = false;
          } else {
            this.radio(`Dispatch: heat cooling — wanted level ${S.wanted}.`);
          }
        }
      } else {
        S.wantedHeat = Math.min(100, S.wantedHeat + dt * 3);
      }
    }

    // Spawn pursuit cars up to the wanted cap.
    this.spawnTimer -= dt;
    if (S.wanted > 0 && this.cars.filter((c) => !c.dead).length < this.maxCops() && this.spawnTimer <= 0) {
      this.spawnCop(scene, rng, playerPos.x, playerPos.z);
      this.spawnTimer = 2.5;
    }

    // Helicopter at 4+ stars.
    if (this.heli) this.heli.active = S.wanted >= 4;

    // Roadblocks at 3+ stars, one every ~25s, max 2.
    this.roadblockTimer -= dt;
    if (S.wanted >= 3 && this.roadblocks.length < 2 && this.roadblockTimer <= 0) {
      const heading = playerInCar && playerCar ? playerCar.heading : Math.atan2(playerPos.x, playerPos.z);
      this.spawnRoadblock(scene, rng, playerPos.x, playerPos.z, heading);
      this.roadblockTimer = 25;
    }

    // Pursuit driving: ram the player.
    for (const cop of this.cars) {
      if (cop.dead) continue;
      const dx = playerPos.x - cop.pos.x, dz = playerPos.z - cop.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 260) { cop.dead = true; scene.remove(cop.mesh); continue; }
      const want = Math.atan2(dx, dz);
      const diff = angleDiff(cop.heading, want);
      const steer = clamp(diff * 1.6, -1, 1);
      const throttle = d > 6 ? 1 : 0.4;
      driveCar(cop, throttle, steer, dt, colliders);
      // Siren flash
      const red = cop.mesh.getObjectByName('sirenRed');
      const blue = cop.mesh.getObjectByName('sirenBlue');
      const on = Math.floor(performance.now() / 220) % 2 === 0;
      if (red) red.material.emissiveIntensity = on ? 3 : 0.3;
      if (blue) blue.material.emissiveIntensity = on ? 0.3 : 3;
      // Ram damage
      if (d < 3.4) {
        if (playerInCar && playerCar) {
          playerCar.speed *= 0.6;
          AudioSys.crash();
        } else {
          this.damagePlayer(12 * dt * 10, onWasted);
        }
      }
    }
    this.cars = this.cars.filter((c) => !c.dead);

    // Roadblock smash detection.
    for (const b of this.roadblocks) {
      const d = Math.hypot(playerPos.x - b.x, playerPos.z - b.z);
      if (!b.hit && d < 12 && playerInCar && playerCar && Math.abs(playerCar.speed) > 14) {
        b.hit = true;
        b.smashed++;
        AudioSys.crash();
        this.radio('Dispatch: suspect smashed through the roadblock!');
        if (window.__velamarRoadblockSmashed) window.__velamarRoadblockSmashed(b);
        scene.remove(b.group);
        for (const c of b.cars) { scene.remove(c.mesh); c.dead = true; }
        b.group = null;
      }
    }
    this.roadblocks = this.roadblocks.filter((b) => b.group !== null);

    // Busted: on foot, a cop touches you while wanted and slow.
    if (S.wanted > 0 && !playerInCar) {
      const near = this.cars.some((c) => Math.hypot(c.pos.x - playerPos.x, c.pos.z - playerPos.z) < 3.2);
      if (near) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 1.2) { this.bustedTimer = 0; onBusted?.(); }
      } else this.bustedTimer = 0;
    }
  },

  damagePlayer(amount, onWasted) {
    if (S.armor > 0) {
      const absorbed = Math.min(S.armor, amount);
      S.armor -= absorbed;
      amount -= absorbed;
    }
    S.health -= amount;
    if (S.health <= 0) {
      S.health = 0;
      onWasted?.();
    }
  },

  clearAll(scene) {
    for (const c of this.cars) scene.remove(c.mesh);
    this.cars = [];
    this.clearRoadblocks(scene);
    if (this.heli) this.heli.active = false;
    S.wanted = 0; S.wantedHeat = 0;
  },
};
