// Pedestrians: walk the sidewalks, flee from gunfire and police chases,
// some drive traffic cars. A few named NPCs stand at mission spots.
import * as THREE from 'three';
import { HALF, ROAD_STEP } from './state.js';
import { makeRng, pick, range, clamp, angleDiff } from './rng.js';
import { isRoad, collideCircle } from './city.js';

const SHIRTS = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8b44a, 0x9a4ad8, 0xd8d8d8, 0x4ad8d0, 0xe08a3a];
const PANTS = [0x2a2f3a, 0x3a2f2a, 0x2a3a4a, 0x4a4a4a];
const SKINS = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0];

export function buildPersonMesh(rng, opts = {}) {
  const g = new THREE.Group();
  const shirt = opts.shirt ?? pick(rng, SHIRTS);
  const skin = opts.skin ?? pick(rng, SKINS);
  const pants = opts.pants ?? pick(rng, PANTS);
  const bodyMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34), bodyMat);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 0.26), pantsMat);
  legL.position.set(-0.16, 0.32, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), bodyMat);
  armL.position.set(-0.42, 1.05, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

// The player character: distinct jacket, cap, walk/run animation.
export function buildPlayerMesh() {
  const rng = makeRng(7);
  const g = buildPersonMesh(rng, { shirt: 0xe85d04, skin: 0xe8b88a, pants: 0x1a2233 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.29, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 }));
  cap.position.y = 1.94;
  g.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 }));
  brim.position.set(0, 1.9, 0.3);
  g.add(brim);
  return g;
}

export function makePedestrian(scene, rng, x, z, opts = {}) {
  const mesh = buildPersonMesh(rng, opts);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh, pos: mesh.position, heading: range(rng, 0, Math.PI * 2),
    speed: range(rng, 1.2, 2.2), state: 'walk', // walk | flee | idle | drive | dead
    target: null, timer: range(rng, 2, 8), health: 100,
    name: opts.name ?? null, role: opts.role ?? 'ped', dead: false,
    car: null, walkPhase: rng() * 10,
  };
}

export function spawnPedestrians(scene, count, rng) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    let x, z, tries = 0;
    do {
      x = range(rng, -HALF + 40, HALF - 40);
      z = range(rng, -HALF + 40, HALF - 60);
      tries++;
    } while (isRoad(x, z) && tries < 12);
    peds.push(makePedestrian(scene, rng, x, z));
  }
  return peds;
}

function pickSidewalkTarget(ped, rng) {
  // Walk along a road line, offset onto the sidewalk.
  const onX = rng() > 0.5;
  const road = Math.round(range(rng, -HALF + 120, HALF - 120) / ROAD_STEP) * ROAD_STEP;
  const along = range(rng, -HALF + 60, HALF - 60);
  const off = (rng() > 0.5 ? 1 : -1) * 15;
  return onX ? { x: road + off, z: along } : { x: along, z: road + off };
}

export function updatePedestrian(ped, dt, rng, colliders, danger) {
  if (ped.dead) return;
  ped.timer -= dt;
  if (ped.state === 'flee') {
    if (ped.timer <= 0) { ped.state = 'walk'; ped.target = null; }
  } else if (ped.timer <= 0) {
    ped.target = pickSidewalkTarget(ped, rng);
    ped.timer = range(rng, 6, 16);
    if (rng() < 0.25) ped.state = 'idle';
    else ped.state = 'walk';
  }
  let speed = 0;
  if (ped.state === 'walk' && ped.target) {
    const dx = ped.target.x - ped.pos.x, dz = ped.target.z - ped.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 3) { ped.target = null; ped.timer = 0; }
    else {
      const want = Math.atan2(dx, dz);
      ped.heading += clamp(angleDiff(ped.heading, want), -dt * 4, dt * 4);
      speed = ped.speed;
    }
  } else if (ped.state === 'flee' && danger) {
    const dx = ped.pos.x - danger.x, dz = ped.pos.z - danger.z;
    const d = Math.hypot(dx, dz) || 1;
    const want = Math.atan2(dx / d, dz / d);
    ped.heading += clamp(angleDiff(ped.heading, want), -dt * 6, dt * 6);
    speed = 5.5;
  }
  if (speed > 0) {
    const nx = ped.pos.x + Math.sin(ped.heading) * speed * dt;
    const nz = ped.pos.z + Math.cos(ped.heading) * speed * dt;
    const fixed = collideCircle(colliders, nx, nz, 0.6);
    ped.pos.x = fixed.x; ped.pos.z = fixed.z;
    ped.walkPhase += dt * speed * 3.2;
    const swing = Math.sin(ped.walkPhase) * 0.55;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
    ped.mesh.userData.armL.rotation.x = -swing * 0.7;
    ped.mesh.userData.armR.rotation.x = swing * 0.7;
  } else {
    ped.mesh.userData.legL.rotation.x *= 0.8;
    ped.mesh.userData.legR.rotation.x *= 0.8;
    ped.mesh.userData.armL.rotation.x *= 0.8;
    ped.mesh.userData.armR.rotation.x *= 0.8;
  }
  ped.mesh.position.set(ped.pos.x, 0, ped.pos.z);
  ped.mesh.rotation.y = ped.heading;
}

export function fleeFrom(peds, x, z, radius) {
  for (const p of peds) {
    if (p.dead || p.role === 'enemy') continue;
    const d = Math.hypot(p.pos.x - x, p.pos.z - z);
    if (d < radius) { p.state = 'flee'; p.timer = 3 + Math.random() * 3; }
  }
}
