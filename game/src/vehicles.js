// Vehicles: the cars themselves (body, cabin, wheels, lights, built from boxes),
// the traffic system that drives them around the road grid, the player's arcade
// driving model, and the police cars that chase a wanted player.

import * as THREE from 'three';
import { CAR_MODELS, ROADS, WORLD } from './config.js';
import { pick, range } from './random.js';

const WHEEL_GEO = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12);
const WHEEL_MAT = new THREE.MeshLambertMaterial({ color: 0x14161a });

/** Build one car mesh from a model entry and a paint colour. Returns { group, wheels }. */
export function buildCarMesh(model, color, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x18242e });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.58, 2.2), isPolice ? paint : glass);
  cabin.position.set(0, 1.18, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.22, 0.3), new THREE.MeshLambertMaterial({ color: 0x22242a }));
  bumper.position.set(0, 0.42, 2.2);
  group.add(bumper);
  // Headlights (warm) and taillights (red) so cars read at dusk.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const x of [-0.72, 0.72]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), headMat);
    h.position.set(x, 0.66, 2.22);
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), tailMat);
    t.position.set(x, 0.66, -2.22);
    group.add(t);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.4), new THREE.MeshLambertMaterial({ color: 0x111318 }));
    bar.position.set(0, 1.55, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.38, 1.66, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.42), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.38, 1.66, -0.2);
    group.add(blue);
    group.userData.lightRed = red;
    group.userData.lightBlue = blue;
  }
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.42, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData.model = model;
  return { group, wheels };
}

function nearestRoad(value) {
  let best = ROADS[0];
  for (const r of ROADS) if (Math.abs(r - value) < Math.abs(best - value)) best = r;
  return best;
}

/** A traffic car: drives along one road, turns at intersections, yields to nothing. */
export function createTrafficCar(scene, random, id) {
  const model = pick(random, CAR_MODELS);
  const color = pick(random, model.colors);
  const { group, wheels } = buildCarMesh(model, color, false);
  scene.add(group);
  const horizontal = random() < 0.5;
  const road = pick(random, ROADS);
  const along = range(random, -220, 220);
  const lane = range(random, -3.2, 3.2);
  const car = {
    id, kind: 'traffic', group, wheels, model, color,
    x: horizontal ? along : road + lane,
    z: horizontal ? road + lane : along,
    heading: horizontal ? (lane > 0 ? 0 : Math.PI) : (lane > 0 ? Math.PI / 2 : -Math.PI / 2),
    speed: range(random, 9, 15),
    targetSpeed: 12,
    horizontal,
    alive: true,
    driver: true,
  };
  group.position.set(car.x, 0, car.z);
  group.rotation.y = car.heading;
  return car;
}

export function createTraffic(scene, random, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) cars.push(createTrafficCar(scene, random, i));
  return cars;
}

/** Advance every traffic car one step: follow its road, turn at random intersections. */
export function stepTraffic(cars, dt, random) {
  for (const car of cars) {
    if (!car.alive) continue;
    const step = car.speed * dt;
    if (car.horizontal) car.x += Math.cos(car.heading) * step;
    else car.z += Math.sin(car.heading) * step * (car.heading > 0 ? 1 : 1);
    // At an intersection, sometimes turn onto the crossing road.
    const nearRoad = nearestRoad(car.horizontal ? car.x : car.z);
    const onRoad = Math.abs((car.horizontal ? car.x : car.z) - nearRoad) < 1.2;
    if (onRoad && random() < dt * 0.35) {
      car.horizontal = !car.horizontal;
      if (car.horizontal) {
        car.z = nearRoad + (random() < 0.5 ? 3.2 : -3.2);
        car.heading = car.z > nearRoad ? Math.PI : 0;
      } else {
        car.x = nearRoad + (random() < 0.5 ? 3.2 : -3.2);
        car.heading = car.x > nearRoad ? -Math.PI / 2 : Math.PI / 2;
      }
    }
    // Wrap around the city edge so traffic never runs out.
    if (car.x > 235) car.x = -235;
    if (car.x < -235) car.x = 235;
    if (car.z > 235) car.z = -235;
    if (car.z < -235) car.z = 235;
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    for (const wheel of car.wheels) wheel.rotation.x += car.speed * dt * 2.2;
  }
}

/** Arcade driving for the player's car: accelerate, steer, handbrake drift. */
export function createPlayerCar(scene, model, color) {
  const { group, wheels } = buildCarMesh(model, color, false);
  scene.add(group);
  return {
    kind: 'player', group, wheels, model, color,
    x: 0, z: 0, heading: 0, speed: 0, alive: true, driver: true,
  };
}

export function stepPlayerCar(car, input, dt, colliders, onCrash) {
  const fwd = input.forward();
  const steer = input.strafe();
  const handbrake = input.held('Space');
  const accel = fwd > 0 ? car.model.accel : fwd < 0 ? -car.model.accel * 0.7 : 0;
  car.speed += accel * dt;
  if (fwd === 0) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 10 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  car.speed = Math.max(-car.model.top * 0.45, Math.min(car.model.top, car.speed));
  const turnRate = car.model.grip * (0.55 + 0.45 * Math.min(1, Math.abs(car.speed) / 12));
  car.heading += steer * turnRate * dt * Math.sign(car.speed || 1) * (handbrake ? 1.6 : 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const hit = resolveCarCollision(nx, nz, colliders);
  if (hit) {
    if (Math.abs(car.speed) > 14) onCrash(Math.abs(car.speed));
    car.speed *= -0.25;
  } else {
    car.x = nx;
    car.z = nz;
  }
  car.x = Math.max(-WORLD.half, Math.min(WORLD.half, car.x));
  car.z = Math.max(-WORLD.half, Math.min(WORLD.half, car.z));
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  car.group.rotation.z = -steer * 0.04 * Math.min(1, Math.abs(car.speed) / 20);
  for (const wheel of car.wheels) wheel.rotation.x += car.speed * dt * 2.2;
}

/** Circle (radius 1.6) vs building AABBs: push out, report a hit. */
export function resolveCarCollision(x, z, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < 1.7 * 1.7) return true;
  }
  return false;
}

/** A police interceptor: chases the player's position and rams. */
export function createPoliceCar(scene, x, z) {
  const { group, wheels } = buildCarMesh(CAR_MODELS[1], 0xf2f2f2, true);
  scene.add(group);
  return {
    kind: 'police', group, wheels, model: CAR_MODELS[1], color: 0xf2f2f2,
    x, z, heading: 0, speed: 0, alive: true, flash: 0,
  };
}

export function stepPoliceCar(car, targetX, targetZ, dt, colliders) {
  const dx = targetX - car.x;
  const dz = targetZ - car.z;
  const dist = Math.hypot(dx, dz) || 1;
  const want = Math.atan2(dx, dz);
  let diff = want - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  const top = 30 + Math.min(10, dist * 0.1);
  car.speed = Math.min(top, car.speed + 16 * dt);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  if (!resolveCarCollision(nx, nz, colliders)) {
    car.x = nx;
    car.z = nz;
  } else {
    car.speed *= 0.4;
  }
  car.group.position.set(car.x, 0, car.z);
  car.group.rotation.y = car.heading;
  car.flash += dt;
  const on = Math.floor(car.flash * 4) % 2 === 0;
  if (car.group.userData.lightRed) {
    car.group.userData.lightRed.material.color.setHex(on ? 0xff2020 : 0x550000);
    car.group.userData.lightBlue.material.color.setHex(on ? 0x101050 : 0x2040ff);
  }
  for (const wheel of car.wheels) wheel.rotation.x += car.speed * dt * 2.2;
  return dist;
}

