// People: the player character, pedestrians who stroll the sidewalks and flee from
// gunfire, foot cops who chase a wanted player, and the rival gang members and bank
// guards the missions ask you to take down. Everyone is built from boxes and spheres
// with a walk-cycle leg swing — no borrowed models, no borrowed faces.

import * as THREE from 'three';
import { PED_COLORS, PED_NAMES, ROADS, TUNE, WORLD } from './config.js';
import { pick, range } from './random.js';

/** A simple stylised person: torso, head, arms and legs that swing while walking. */
export function buildPersonMesh(shirt, pants, skin) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x1c1410 }));
  hair.position.y = 1.76;
  group.add(hair);
  const legs = [];
  for (const x of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pantsMat);
    leg.position.set(x, 0.36, 0);
    leg.geometry.translate(0, 0, 0);
    group.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const x of [-0.4, 0.4]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), shirtMat);
    arm.position.set(x, 1.14, 0);
    group.add(arm);
    arms.push(arm);
  }
  group.userData.legs = legs;
  group.userData.arms = arms;
  group.userData.walkPhase = 0;
  return group;
}

export function animateWalk(group, dt, speed) {
  group.userData.walkPhase += dt * speed * 1.6;
  const swing = Math.sin(group.userData.walkPhase) * 0.55 * Math.min(1, speed / 6);
  group.userData.legs[0].rotation.x = swing;
  group.userData.legs[1].rotation.x = -swing;
  group.userData.arms[0].rotation.x = -swing * 0.7;
  group.userData.arms[1].rotation.x = swing * 0.7;
}

function sidewalkPoint(random) {
  // A point on a sidewalk band beside a random road.
  const road = pick(random, ROADS);
  const along = range(random, -225, 225);
  const side = random() < 0.5 ? -1 : 1;
  const off = WORLD.roadHalf + WORLD.sidewalk / 2 + side * 0;
  if (random() < 0.5) return { x: along, z: road + side * (WORLD.roadHalf + 2), horizontal: true };
  return { x: road + side * (WORLD.roadHalf + 2), z: along, horizontal: false };
}

export function createPedestrians(scene, random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const p = sidewalkPoint(random);
    const mesh = buildPersonMesh(pick(random, PED_COLORS), pick(random, [0x2a2f3a, 0x4a3a2a, 0x2e4a3a]), pick(random, [0xd8a06a, 0x8a5a3a, 0xe8c49a]));
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    const ped = {
      kind: 'ped', name: PED_NAMES[i % PED_NAMES.length], mesh,
      x: p.x, z: p.z, heading: p.horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      speed: range(random, 1.1, 2.1), horizontal: p.horizontal, flee: 0, alive: true,
    };
    mesh.userData.pedRef = ped;
    peds.push(ped);
  }
  return peds;
}

/** Pedestrians stroll along sidewalks, turn at intersections, and run from danger. */
export function stepPedestrians(peds, dt, random, dangerX, dangerZ, dangerOn) {
  for (const ped of peds) {
    if (!ped.alive) continue;
    if (dangerOn) {
      const d = Math.hypot(ped.x - dangerX, ped.z - dangerZ);
      if (d < 26) ped.flee = 2.5;
    }
    let speed = ped.speed;
    if (ped.flee > 0) {
      ped.flee -= dt;
      speed = 6.5;
      const away = Math.atan2(ped.x - dangerX, ped.z - dangerZ);
      ped.heading = away;
    }
    ped.x += Math.sin(ped.heading) * speed * dt;
    ped.z += Math.cos(ped.heading) * speed * dt;
    if (ped.flee <= 0) {
      // Keep to the sidewalk grid: snap back onto a road line when drifting off.
      const axis = ped.horizontal ? ped.z : ped.x;
      let nearest = ROADS[0];
      for (const r of ROADS) if (Math.abs(r - axis) < Math.abs(nearest - axis)) nearest = r;
      const lane = nearest + (ped.horizontal ? (ped.heading === 0 ? 9 : -9) : (ped.heading === Math.PI / 2 ? 9 : -9));
      if (ped.horizontal) ped.z += (lane - ped.z) * Math.min(1, dt * 2);
      else ped.x += (lane - ped.x) * Math.min(1, dt * 2);
      if (Math.abs(ped.x) > 232 || Math.abs(ped.z) > 232) {
        ped.heading += Math.PI;
        ped.x = Math.max(-232, Math.min(232, ped.x));
        ped.z = Math.max(-232, Math.min(232, ped.z));
      }
      if (random() < dt * 0.08) ped.heading += Math.PI; // turn back sometimes
    }
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    animateWalk(ped.mesh, dt, speed);
  }
}

/** A Solmara PD officer on foot: dark uniform, badge glint, chases and cuffs. */
export function createFootCop(scene, x, z) {
  const mesh = buildPersonMesh(0x1c2a4a, 0x141c30, 0xd8a06a);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.02), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  badge.position.set(0.14, 1.32, 0.19);
  mesh.add(badge);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.1, 10), new THREE.MeshLambertMaterial({ color: 0x101828 }));
  cap.position.y = 1.92;
  mesh.add(cap);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return { kind: 'cop', mesh, x, z, heading: 0, speed: TUNE.copChaseSpeed, alive: true, holdTimer: 0 };
}

export function stepFootCop(cop, targetX, targetZ, dt) {
  const dx = targetX - cop.x;
  const dz = targetZ - cop.z;
  const dist = Math.hypot(dx, dz) || 1;
  cop.heading = Math.atan2(dx, dz);
  cop.x += Math.sin(cop.heading) * cop.speed * dt;
  cop.z += Math.cos(cop.heading) * cop.speed * dt;
  cop.mesh.position.set(cop.x, 0, cop.z);
  cop.mesh.rotation.y = cop.heading;
  animateWalk(cop.mesh, dt, cop.speed);
  return dist;
}

/** A rival gang member (Rust Vipers) or a bank guard: red jacket, armed, hostile. */
export function createRival(scene, x, z, hostile) {
  const mesh = buildPersonMesh(hostile ? 0x8f1d2c : 0x2e4a3a, 0x22242a, 0xd8a06a);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x111318 }));
  gun.position.set(0.4, 1.05, 0.3);
  mesh.add(gun);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    kind: hostile ? 'rival' : 'guard', mesh, x, z, heading: Math.random() * Math.PI * 2,
    health: 100, alive: true, shootTimer: 1 + Math.random(), speed: 3.2,
  };
}

export function stepRival(rival, targetX, targetZ, dt, random) {
  if (!rival.alive) return 0;
  const dx = targetX - rival.x;
  const dz = targetZ - rival.z;
  const dist = Math.hypot(dx, dz) || 1;
  rival.heading = Math.atan2(dx, dz);
  // Close in to a fighting distance, then hold and shoot.
  if (dist > 14) {
    rival.x += Math.sin(rival.heading) * rival.speed * dt;
    rival.z += Math.cos(rival.heading) * rival.speed * dt;
    animateWalk(rival.mesh, dt, rival.speed);
  }
  rival.mesh.position.set(rival.x, 0, rival.z);
  rival.mesh.rotation.y = rival.heading;
  rival.shootTimer -= dt;
  if (rival.shootTimer <= 0 && dist < 42) {
    rival.shootTimer = range(random, 1.1, 2.2);
    return 1; // fired a shot at the player
  }
  return 0;
}

