// Velamar — vehicles. Arcade car physics, traffic that follows the road grid,
// carjacking, and the player's garage fleet. All cars are built from boxes:
// body, cabin, wheels, lights — no model files, no network.
import * as THREE from 'three';
import { makeRng } from './rng.js';
import { collideCircle, clampWorld } from './city.js';

export const CAR_KINDS = {
  sedan: { name: 'Vela Sedan', top: 34, accel: 16, grip: 2.6, price: 0 },
  coupe: { name: 'Solano Coupe', top: 40, accel: 19, grip: 2.9, price: 2400 },
  sports: { name: 'Corsa GT', top: 52, accel: 26, grip: 3.4, price: 12000 },
  suv: { name: 'Toro SUV', top: 32, accel: 14, grip: 2.4, price: 5200 },
  truck: { name: 'Hauler Pickup', top: 30, accel: 13, grip: 2.2, price: 3800 },
  van: { name: 'Mercado Van', top: 28, accel: 11, grip: 2.1, price: 2900 },
  taxi: { name: 'Vela Cab', top: 34, accel: 15, grip: 2.6, price: 0 },
  police: { name: 'VCPD Interceptor', top: 46, accel: 24, grip: 3.2, price: 0 },
};

const PAINTS = [
  0xc23b2e, 0x2e6fc2, 0xe8b13a, 0x3aa655, 0xe8e4da, 0x22242a,
  0x7a3ac2, 0xc25a8e, 0x3ab8c2, 0xd86a2a, 0x8a94a6, 0x4a2a1a,
];

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14151a });
const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
const lightGeo = new THREE.BoxGeometry(0.34, 0.22, 0.08);

export function paintColor(rng) {
  return rng.pick(PAINTS);
}

export function makeCarMesh(kind, color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2a38 });
  const body = new THREE.Mesh(bodyGeo, paint);
  const tall = kind === 'suv' || kind === 'van' || kind === 'truck';
  body.scale.set(2, tall ? 0.95 : 0.62, 4.4);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(bodyGeo, glass);
  cabin.scale.set(1.7, 0.55, kind === 'van' ? 3.2 : 2.1);
  cabin.position.set(0, 1.12, kind === 'truck' ? 0.7 : -0.15);
  cabin.castShadow = true;
  g.add(cabin);
  if (kind === 'truck') {
    const bed = new THREE.Mesh(bodyGeo, paint);
    bed.scale.set(1.9, 0.5, 1.6);
    bed.position.set(0, 0.95, -1.2);
    g.add(bed);
  }
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const sx of [-0.62, 0.62]) {
    const lamp = new THREE.Mesh(lightGeo, lampMat);
    lamp.position.set(sx, 0.66, 2.22);
    g.add(lamp);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xc22a2a });
  for (const sx of [-0.62, 0.62]) {
    const tail = new THREE.Mesh(lightGeo, tailMat);
    tail.position.set(sx, 0.66, -2.22);
    g.add(tail);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0xffd23a }));
    sign.scale.set(0.9, 0.22, 0.5);
    sign.position.set(0, 1.55, -0.15);
    g.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0x2233ff }));
    bar.scale.set(1.1, 0.18, 0.4);
    bar.position.set(0, 1.52, -0.15);
    bar.name = 'lightbar';
    g.add(bar);
    const bar2 = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar2.scale.set(0.5, 0.18, 0.4);
    bar2.position.set(0.55, 1.52, -0.15);
    bar2.name = 'lightbar2';
    g.add(bar2);
  }
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  constructor(kind, color, x, z, heading) {
    this.kind = kind;
    this.spec = CAR_KINDS[kind];
    this.mesh = makeCarMesh(kind, color);
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading || 0;
    this.speed = 0;
    this.steer = 0;
    this.nos = 0;
    this.hp = 100;
    this.driver = null; // 'player' | 'traffic' | 'police' | null
    this.alive = true;
    this.tirePopped = false;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.12;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin * 0.016;
    this.mesh.userData.wheels[0].rotation.y = this.steer * 0.4;
    this.mesh.userData.wheels[1].rotation.y = this.steer * 0.4;
  }

  drive(dt, throttle, steerInput, handbrake) {
    const top = this.spec.top * (this.tirePopped ? 0.45 : 1) * (this.nos > 0 ? 1.35 : 1);
    if (this.nos > 0) this.nos = Math.max(0, this.nos - dt);
    this.speed += throttle * this.spec.accel * dt;
    if (throttle === 0) this.speed *= Math.max(0, 1 - 0.5 * dt);
    if (handbrake) this.speed *= Math.max(0, 1 - 3.2 * dt);
    this.speed = Math.max(-top * 0.45, Math.min(top, this.speed));
    const targetSteer = steerInput * (this.speed >= 0 ? 1 : -1);
    this.steer += (targetSteer - this.steer) * Math.min(1, 8 * dt);
    const turnRate = this.steer * this.spec.grip * Math.min(1, Math.abs(this.speed) / 9)
      * (handbrake ? 1.7 : 1);
    this.heading += turnRate * dt * Math.sign(this.speed || 1);
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;
    if (handbrake && Math.abs(this.speed) > 12) {
      // Drift: slide sideways a little.
      this.pos.x += Math.cos(this.heading) * this.steer * this.speed * 0.12 * dt;
      this.pos.z -= Math.sin(this.heading) * this.steer * this.speed * 0.12 * dt;
    }
  }
}

// Traffic: cars cruise the road graph, stop for the car ahead, despawn far away.
export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(777);
    this.cars = [];
    this.targetCount = 26;
  }

  spawnOne(near) {
    const kinds = ['sedan', 'sedan', 'coupe', 'suv', 'truck', 'van', 'taxi'];
    const kind = this.rng.pick(kinds);
    let p;
    if (near) {
      const base = this.city.randomRoadPoint(this.rng);
      p = { x: base.x, z: base.z };
    } else {
      p = this.city.randomRoadPoint(this.rng);
    }
    const car = new Car(kind, paintColor(this.rng), p.x, p.z, this.rng.range(0, Math.PI * 2));
    car.driver = 'traffic';
    car.speed = this.rng.range(8, 14);
    car.target = this.city.randomRoadPoint(this.rng);
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  }

  ensure(playerPos) {
    while (this.cars.length < this.targetCount) this.spawnOne(playerPos);
  }

  update(dt, playerPos, allCars) {
    this.ensure(playerPos);
    for (let i = this.cars.length - 1; i >= 0; i -= 1) {
      const car = this.cars[i];
      const distP = Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z);
      if (distP > 420) {
        this.scene.remove(car.mesh);
        this.cars.splice(i, 1);
        continue;
      }
      // Steer toward the current target intersection; pick a new one on arrival.
      const dx = car.target.x - car.pos.x;
      const dz = car.target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 12) {
        const next = this.city.randomRoadPoint(this.rng);
        // Keep the route on the grid: snap target to a nearby intersection.
        const near = this.city.nearestRoad(next.x, next.z);
        car.target = { x: near.x, z: near.z };
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.6));
      // Slow down for a car directly ahead.
      let ahead = false;
      for (const other of allCars) {
        if (other === car) continue;
        const ox = other.pos.x - car.pos.x;
        const oz = other.pos.z - car.pos.z;
        const od = Math.hypot(ox, oz);
        if (od < 11 && Math.abs(Math.atan2(ox, oz) - car.heading) < 0.6) { ahead = true; break; }
      }
      const throttle = ahead ? -0.4 : 0.55;
      car.drive(dt, throttle, steer, false);
      car.speed = Math.max(0, Math.min(15, car.speed));
      collideCircle(car.pos, 2.4, this.city.colliders);
      clampWorld(car.pos);
      car.syncMesh();
    }
  }
}

// Simple circle-vs-circle push-apart for cars so chases and traffic collide.
export function separateCars(cars) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 4.6) {
        const push = (4.6 - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.pos.x -= nx * push;
        a.pos.z -= nz * push;
        b.pos.x += nx * push;
        b.pos.z += nz * push;
        const hit = Math.abs(a.speed) + Math.abs(b.speed);
        if (hit > 14) {
          a.hp -= hit * 0.35;
          b.hp -= hit * 0.35;
        }
        a.speed *= 0.86;
        b.speed *= 0.86;
      }
    }
  }
}
