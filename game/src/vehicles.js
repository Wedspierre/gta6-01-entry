// Vehicles: player cars, traffic, and the police helicopter.
// Arcade physics — fast, forgiving, fun — with simple traffic AI on the road grid.
import * as THREE from 'three';
import { HALF, ROAD_STEP } from './state.js';
import { makeRng, pick, range, clamp, angleDiff } from './rng.js';
import { isRoad, collideCircle } from './city.js';

export const CAR_MODELS = [
  { name: 'Sunset Coupe', color: 0xd8342a, topSpeed: 46, accel: 26, grip: 2.6 },
  { name: 'Harbor Sedan', color: 0x2a6fd8, topSpeed: 40, accel: 22, grip: 2.2 },
  { name: 'Marina Taxi', color: 0xe8b400, topSpeed: 38, accel: 21, grip: 2.2 },
  { name: 'Dune Pickup', color: 0x5a7a3a, topSpeed: 42, accel: 24, grip: 2.4 },
  { name: 'Neon Sport', color: 0x8f2ad8, topSpeed: 52, accel: 30, grip: 3.0 },
  { name: 'Bay Van', color: 0xd8d8d8, topSpeed: 34, accel: 18, grip: 1.9 },
  { name: 'Interceptor', color: 0x11131a, topSpeed: 50, accel: 32, grip: 3.1 },
];

function buildCarMesh(model, isPolice = false) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: isPolice ? 0x14161c : model.color, roughness: 0.35, metalness: 0.55,
  });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0e2233, roughness: 0.1, metalness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.6), paint);
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2), glass);
  cabin.position.set(0, 1.3, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  for (const [x, z] of [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    g.add(w);
  }
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xfff2b0, emissive: 0xffedb0, emissiveIntensity: 0.9,
  });
  for (const x of [-0.7, 0.7]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), lightMat);
    hl.position.set(x, 0.7, 2.32);
    g.add(hl);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xd81a1a, emissive: 0x7a0a0a, emissiveIntensity: 0.6 });
  for (const x of [-0.7, 0.7]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), tailMat);
    tl.position.set(x, 0.7, -2.32);
    g.add(tl);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.4 }));
    bar.position.set(0, 1.72, 0.4);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 }));
    red.position.set(-0.35, 1.72, 0.4);
    red.name = 'sirenRed';
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.25, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x2040ff, emissive: 0x2040ff, emissiveIntensity: 2 }));
    blue.position.set(0.35, 1.72, 0.4);
    blue.name = 'sirenBlue';
    g.add(blue);
  }
  return g;
}

export function makeCar(scene, model, x, z, heading, opts = {}) {
  const mesh = buildCarMesh(model, opts.police);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh, model, pos: mesh.position, heading,
    speed: 0, steer: 0, police: !!opts.police, traffic: !!opts.traffic,
    driver: opts.driver ?? null, // pedestrian driving it, or 'player'
    targetSpeed: opts.traffic ? 8 + Math.random() * 6 : 0,
    route: null, routeIdx: 0, stuck: 0, dead: false,
    color: model.color, name: model.name,
  };
}

export function driveCar(car, throttle, steerInput, dt, colliders) {
  const m = car.model;
  const target = throttle * m.topSpeed;
  const accelRate = throttle !== 0 ? m.accel : 18;
  car.speed += clamp(target - car.speed, -accelRate * dt, accelRate * dt);
  if (Math.abs(car.speed) < 0.2 && throttle === 0) car.speed = 0;
  const steerTarget = steerInput * 0.55 * (car.speed >= 0 ? 1 : -1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const turn = car.steer * clamp(Math.abs(car.speed) / 8, 0, 1) * m.grip;
  car.heading += turn * dt * (car.speed >= 0 ? 1 : -1) * Math.sign(car.speed || 1);
  const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
  const fixed = collideCircle(colliders, nx, nz, 2.4);
  if (fixed.x !== nx || fixed.z !== nz) {
    car.speed *= 0.45;
    car.crashed = true;
  } else car.crashed = false;
  car.pos.x = Math.max(-HALF - 90, Math.min(HALF + 90, fixed.x));
  car.pos.z = Math.max(-HALF - 90, Math.min(HALF + 110, fixed.z));
  car.mesh.position.set(car.pos.x, 0, car.pos.z);
  car.mesh.rotation.y = car.heading;
  car.mesh.rotation.z = -car.steer * 0.06 * Math.min(1, Math.abs(car.speed) / 20);
  return car.crashed;
}

// Traffic: cars follow the road grid, turning at intersections.
export function trafficThink(car, dt, rng, allCars) {
  if (!car.route || car.routeIdx >= car.route.length) {
    // New route: pick a random road-aligned destination and walk the grid.
    const dest = {
      x: Math.round(range(rng, -HALF + 120, HALF - 120) / ROAD_STEP) * ROAD_STEP,
      z: Math.round(range(rng, -HALF + 120, HALF - 120) / ROAD_STEP) * ROAD_STEP,
    };
    const pts = [];
    let cx = Math.round(car.pos.x / ROAD_STEP) * ROAD_STEP;
    let cz = Math.round(car.pos.z / ROAD_STEP) * ROAD_STEP;
    pts.push({ x: cx, z: cz });
    while (cx !== dest.x) { cx += Math.sign(dest.x - cx) * ROAD_STEP; pts.push({ x: cx, z: cz }); }
    while (cz !== dest.z) { cz += Math.sign(dest.z - cz) * ROAD_STEP; pts.push({ x: cx, z: cz }); }
    car.route = pts; car.routeIdx = 0;
  }
  const wp = car.route[car.routeIdx];
  const dx = wp.x - car.pos.x, dz = wp.z - car.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 6) { car.routeIdx++; return; }
  const want = Math.atan2(dx, dz);
  const diff = angleDiff(car.heading, want);
  const steer = clamp(diff * 1.4, -1, 1);
  // Slow for cars ahead
  let slow = false;
  for (const o of allCars) {
    if (o === car || o.dead) continue;
    const ox = o.pos.x - car.pos.x, oz = o.pos.z - car.pos.z;
    const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
    const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
    if (ahead > 0 && ahead < 14 && side < 3.5) { slow = true; break; }
  }
  const throttle = slow ? 0 : 1;
  driveCar(car, throttle, steer, dt, window.__velamarColliders);
}

export function spawnTraffic(scene, count, rng) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const onXRoad = rng() > 0.5;
    const road = Math.round(range(rng, -HALF + 120, HALF - 120) / ROAD_STEP) * ROAD_STEP;
    const along = range(rng, -HALF + 60, HALF - 60);
    const x = onXRoad ? road : along;
    const z = onXRoad ? along : road;
    const heading = onXRoad ? (rng() > 0.5 ? 0 : Math.PI) : (rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const model = pick(rng, CAR_MODELS.filter((m) => m.name !== 'Interceptor'));
    const car = makeCar(scene, model, x, z, heading, { traffic: true });
    car.speed = range(rng, 6, 12);
    cars.push(car);
  }
  return cars;
}

// Police helicopter: hovers above the player, spotlight cone, rotor spin.
export function makeHeli(scene) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a2333, roughness: 0.4, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 7), bodyMat);
  body.castShadow = true;
  g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 2.4),
    new THREE.MeshStandardMaterial({ color: 0x0e2233, roughness: 0.1, metalness: 0.8 }));
  glass.position.set(0, 0.2, 2.4);
  g.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 6), bodyMat);
  tail.position.set(0, 0.4, -6);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, 1.6), bodyMat);
  fin.position.set(0, 1.2, -8.6);
  g.add(fin);
  const rotor = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(11, 0.12, 0.7);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
  const b1 = new THREE.Mesh(bladeGeo, bladeMat);
  const b2 = new THREE.Mesh(bladeGeo, bladeMat);
  b2.rotation.y = Math.PI / 2;
  rotor.add(b1); rotor.add(b2);
  rotor.position.y = 1.6;
  g.add(rotor);
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.5 });
  for (const x of [-1.4, 1.4]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 6), skidMat);
    skid.position.set(x, -1.4, 0);
    g.add(skid);
  }
  const spot = new THREE.SpotLight(0xfff2b0, 900, 160, 0.35, 0.4, 1.2);
  spot.position.set(0, -1, 0);
  g.add(spot);
  g.add(spot.target);
  spot.target.position.set(0, -60, 0);
  g.visible = false;
  scene.add(g);
  return { mesh: g, rotor, spot, pos: g.position, active: false, angle: 0 };
}

export function updateHeli(heli, targetX, targetZ, dt, time) {
  if (!heli.active) { heli.mesh.visible = false; return; }
  heli.mesh.visible = true;
  heli.angle += dt * 0.7;
  const hx = targetX + Math.sin(heli.angle) * 26;
  const hz = targetZ + Math.cos(heli.angle * 0.8) * 26;
  heli.pos.x += (hx - heli.pos.x) * Math.min(1, dt * 1.2);
  heli.pos.z += (hz - heli.pos.z) * Math.min(1, dt * 1.2);
  heli.pos.y = 55 + Math.sin(time * 0.8) * 3;
  heli.mesh.rotation.y = Math.atan2(targetX - heli.pos.x, targetZ - heli.pos.z);
  heli.rotor.rotation.y += dt * 22;
  heli.spot.target.position.set(targetX - heli.pos.x, -55, targetZ - heli.pos.z);
}
