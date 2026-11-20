// Velamar — people. The player on foot, pedestrians who stroll the sidewalks
// and flee gunfire, and armed enemies for missions. Combat is hitscan with
// tracers, muzzle flash and per-weapon damage, range and fire rate.
import * as THREE from 'three';
import { makeRng } from './rng.js';
import { collideCircle, clampWorld } from './city.js';

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 0.45, range: 2.4, ammo: Infinity, auto: false, spread: 0 },
  pistol: { name: 'P9 Pistol', damage: 22, rate: 0.28, range: 55, ammo: 120, auto: false, spread: 0.02 },
  smg: { name: 'V9 SMG', damage: 13, rate: 0.085, range: 48, ammo: 240, auto: true, spread: 0.05 },
  shotgun: { name: 'M870 Scattergun', damage: 16, rate: 0.85, range: 26, ammo: 48, auto: false, spread: 0.09, pellets: 6 },
  rifle: { name: 'AR-77 Rifle', damage: 34, rate: 0.14, range: 95, ammo: 150, auto: true, spread: 0.012 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];
export const WEAPON_PRICES = { pistol: 800, smg: 2400, shotgun: 1800, rifle: 4200 };

const SHIRTS = [0xd84a6e, 0x3a7a8c, 0xe8b13a, 0x5a4a8c, 0x8c3a3a, 0x3a8c5a, 0xc2c2c2, 0x2a2a2a];
const SKINS = [0xc98a5e, 0x8a5a3a, 0xe8b88a, 0x6e4530, 0xd8a070];

export function makePersonMesh(shirt, skin) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.95, 0.36),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  body.position.y = 0.95;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.4, 0.4),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.position.y = 1.68;
  head.castShadow = true;
  g.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.62, 0.34),
    new THREE.MeshLambertMaterial({ color: 0x2a3242 }),
  );
  legs.position.y = 0.31;
  g.add(legs);
  const armL = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.8, 0.16),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  armL.position.set(-0.4, 1.0, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.4;
  g.add(armR);
  return g;
}

export class Player {
  constructor(scene) {
    this.mesh = makePersonMesh(0x1e5a8a, 0xc98a5e);
    this.mesh.name = 'DarioVoss';
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.pos.set(0, 0, 120);
    this.heading = 0;
    this.speed = 0;
    this.hp = 100;
    this.armor = 0;
    this.weapon = 'pistol';
    this.ammo = { pistol: 60, smg: 0, shotgun: 0, rifle: 0 };
    this.owned = new Set(['fists', 'pistol']);
    this.fireTimer = 0;
    this.walkPhase = 0;
  }

  move(dt, input, camYaw, colliders) {
    const sprint = input.sprint ? 1.6 : 1;
    const spd = 7.5 * sprint;
    let mx = 0;
    let mz = 0;
    if (input.forward) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
    if (input.back) { mx -= Math.sin(camYaw); mz -= Math.cos(camYaw); }
    if (input.left) { mx -= Math.cos(camYaw); mz += Math.sin(camYaw); }
    if (input.right) { mx += Math.cos(camYaw); mz -= Math.sin(camYaw); }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
      this.pos.x += mx * spd * dt;
      this.pos.z += mz * spd * dt;
      this.heading = Math.atan2(mx, mz);
      this.walkPhase += dt * spd * 1.4;
    }
    this.mesh.rotation.y = this.heading;
    this.mesh.position.y = len > 0 ? Math.abs(Math.sin(this.walkPhase)) * 0.06 : 0;
    collideCircle(this.pos, 0.5, colliders);
    clampWorld(this.pos);
    if (input.jump && this.pos.y < 0.01) this.vy = 7;
    if (this.vy) {
      this.pos.y += this.vy * dt;
      this.vy -= 22 * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; }
    }
    this.fireTimer -= dt;
  }

  damage(amount) {
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.6);
      this.armor -= absorbed;
      this.hp -= amount - absorbed;
    } else {
      this.hp -= amount;
    }
    return this.hp <= 0;
  }

  heal(amount) {
    this.hp = Math.min(100, this.hp + amount);
  }
}

// Pedestrians: stroll the sidewalks, panic and run from gunfire, get out of
// the way of cars. A few carry cash the player can... not rob. They just live here.
export class Pedestrians {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(999);
    this.list = [];
    this.targetCount = 42;
  }

  spawnOne(near) {
    const shirt = this.rng.pick(SHIRTS);
    const skin = this.rng.pick(SKINS);
    const mesh = makePersonMesh(shirt, skin);
    let x;
    let z;
    if (near) {
      x = near.x + this.rng.range(-60, 60);
      z = near.z + this.rng.range(-60, 60);
    } else {
      const p = this.city.randomRoadPoint(this.rng);
      x = p.x + this.rng.range(-30, 30);
      z = p.z + this.rng.range(-30, 30);
    }
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const ped = {
      mesh,
      pos: mesh.position,
      heading: this.rng.range(0, Math.PI * 2),
      speed: this.rng.range(1.2, 2.4),
      panic: 0,
      target: this.city.randomRoadPoint(this.rng),
      hp: 40,
    };
    this.list.push(ped);
    return ped;
  }

  ensure(playerPos) {
    while (this.list.length < this.targetCount) this.spawnOne(playerPos);
  }

  panicAt(x, z, radius) {
    for (const p of this.list) {
      if (Math.hypot(p.pos.x - x, p.pos.z - z) < radius) p.panic = 3;
    }
  }

  update(dt, playerPos, colliders) {
    this.ensure(playerPos);
    for (let i = this.list.length - 1; i >= 0; i -= 1) {
      const p = this.list[i];
      const dPlayer = Math.hypot(p.pos.x - playerPos.x, p.pos.z - playerPos.z);
      if (dPlayer > 260) {
        this.scene.remove(p.mesh);
        this.list.splice(i, 1);
        continue;
      }
      if (p.panic > 0) {
        p.panic -= dt;
        const dx = p.pos.x - playerPos.x;
        const dz = p.pos.z - playerPos.z;
        const d = Math.hypot(dx, dz) || 1;
        p.pos.x += (dx / d) * 5.5 * dt;
        p.pos.z += (dz / d) * 5.5 * dt;
        p.heading = Math.atan2(dx, dz);
      } else {
        const dx = p.target.x - p.pos.x;
        const dz = p.target.z - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 6) {
          p.target = this.city.randomRoadPoint(this.rng);
        } else {
          p.pos.x += (dx / d) * p.speed * dt;
          p.pos.z += (dz / d) * p.speed * dt;
          p.heading = Math.atan2(dx, dz);
        }
      }
      p.mesh.rotation.y = p.heading;
      p.mesh.position.y = Math.abs(Math.sin(performance.now() * 0.006 + i)) * 0.04;
      collideCircle(p.pos, 0.5, colliders);
      clampWorld(p.pos);
    }
  }
}

// Armed enemies for missions: take cover positions, shoot at the player with
// visible tracers, and drop cash when they go down.
export class Enemies {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.list = [];
    this.tracers = [];
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffd23a });
    this.tracerGeo = new THREE.BoxGeometry(0.06, 0.06, 1);
  }

  spawn(x, z, count, hp = 60) {
    const made = [];
    for (let i = 0; i < count; i += 1) {
      const mesh = makePersonMesh(0x8c1f28, 0x8a5a3a);
      mesh.position.set(x + (Math.random() - 0.5) * 14, 0, z + (Math.random() - 0.5) * 14);
      this.scene.add(mesh);
      const e = { mesh, pos: mesh.position, hp, fireTimer: 1 + Math.random() * 2, alive: true };
      this.list.push(e);
      made.push(e);
    }
    return made;
  }

  clear() {
    for (const e of this.list) this.scene.remove(e.mesh);
    this.list = [];
  }

  countAlive() {
    return this.list.filter((e) => e.alive).length;
  }

  // Hitscan shot from `from` toward `targetPos`. Returns the enemy hit, if any.
  shootAt(from, targetPos, weapon, onHit) {
    const dir = new THREE.Vector3().subVectors(targetPos, from).normalize();
    dir.x += (Math.random() - 0.5) * weapon.spread * 2;
    dir.y += (Math.random() - 0.5) * weapon.spread * 2;
    dir.z += (Math.random() - 0.5) * weapon.spread * 2;
    dir.normalize();
    let best = null;
    let bestT = weapon.range;
    for (const e of this.list) {
      if (!e.alive) continue;
      const to = new THREE.Vector3().subVectors(
        new THREE.Vector3(e.pos.x, e.pos.y + 1.2, e.pos.z), from,
      );
      const t = to.dot(dir);
      if (t < 0 || t > weapon.range) continue;
      const closest = new THREE.Vector3().copy(from).addScaledVector(dir, t);
      const miss = closest.distanceTo(new THREE.Vector3(e.pos.x, e.pos.y + 1.2, e.pos.z));
      if (miss < 1.1 && t < bestT) { best = e; bestT = t; }
    }
    const end = new THREE.Vector3().copy(from).addScaledVector(dir, best ? bestT : weapon.range);
    this.addTracer(from, end);
    if (best) {
      best.hp -= weapon.damage;
      if (best.hp <= 0) {
        best.alive = false;
        best.mesh.rotation.z = Math.PI / 2;
        best.mesh.position.y = 0.3;
        if (onHit) onHit(best, true);
      } else if (onHit) onHit(best, false);
    }
    return best;
  }

  addTracer(from, to) {
    const len = from.distanceTo(to);
    const m = new THREE.Mesh(this.tracerGeo, this.tracerMat);
    m.scale.set(1, 1, len);
    m.position.copy(from).lerp(to, 0.5);
    m.lookAt(to);
    m.userData.life = 0.09;
    this.scene.add(m);
    this.tracers.push(m);
  }

  update(dt, playerPos, player, onPlayerHit) {
    for (const t of this.tracers) t.userData.life -= dt;
    for (let i = this.tracers.length - 1; i >= 0; i -= 1) {
      if (this.tracers[i].userData.life <= 0) {
        this.scene.remove(this.tracers[i]);
        this.tracers.splice(i, 1);
      }
    }
    for (const e of this.list) {
      if (!e.alive) continue;
      const dx = playerPos.x - e.pos.x;
      const dz = playerPos.z - e.pos.z;
      const dist = Math.hypot(dx, dz);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      if (dist > 34) {
        e.pos.x += (dx / dist) * 3.2 * dt;
        e.pos.z += (dz / dist) * 3.2 * dt;
      } else if (dist < 8) {
        e.pos.x -= (dx / dist) * 1.5 * dt;
        e.pos.z -= (dz / dist) * 1.5 * dt;
      }
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && dist < 46) {
        e.fireTimer = 1.1 + Math.random() * 0.9;
        this.audio.shoot('smg');
        const from = new THREE.Vector3(e.pos.x, e.pos.y + 1.4, e.pos.z);
        const target = new THREE.Vector3(playerPos.x, playerPos.y + 1.2, playerPos.z);
        const hit = Math.random() < Math.max(0.08, 0.42 - dist * 0.007);
        const end = hit ? target : target.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4,
        ));
        this.addTracer(from, end);
        if (hit && onPlayerHit) onPlayerHit(6 + Math.random() * 5);
      }
    }
  }
}
