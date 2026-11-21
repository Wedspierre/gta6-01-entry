// Velamar Bay: procedural sun-soaked city. Ground texture, buildings, props,
// beach and harbor — all generated at runtime, no image files.
import * as THREE from 'three';
import { CITY, HALF, ROAD_STEP, DISTRICTS } from './state.js';
import { makeRng, pick, range, rangeInt } from './rng.js';

const BUILDING_COLORS = [0x8a7f74, 0x6f7f8a, 0x9a8a6a, 0x7a6a8a, 0x5f6a7a, 0xb08a5a, 0x4a5a6a, 0x8a5a4a];
const ROOF_COLORS = [0x3a3f4a, 0x4a3a2e, 0x2e3a4a, 0x5a4a3a];

function facadeTexture(rng, baseColor) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#' + baseColor.toString(16).padStart(6, '0');
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 0, 128, 10);
  const lit = rng() > 0.4;
  for (let y = 22; y < 240; y += 26) {
    for (let x = 12; x < 116; x += 24) {
      const warm = rng();
      g.fillStyle = warm > 0.72 ? (lit ? '#ffd98a' : '#9fc4e8') : 'rgba(20,28,44,0.85)';
      g.fillRect(x, y, 14, 16);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function groundTexture() {
  const N = 1024;
  const c = document.createElement('canvas');
  c.width = N; c.height = N;
  const g = c.getContext('2d');
  const toPx = (v) => ((v + HALF) / CITY) * N;
  // Sidewalk base
  g.fillStyle = '#8d8f96';
  g.fillRect(0, 0, N, N);
  // District tint blocks
  for (const d of DISTRICTS) {
    g.fillStyle = 'rgba(0,0,0,0.05)';
    g.fillRect(toPx(d.cx - 180), toPx(d.cz - 180), toPx(360) - toPx(0), toPx(360) - toPx(0));
  }
  // Roads
  g.fillStyle = '#23262e';
  const roadW = (18 / CITY) * N;
  for (let v = -HALF + ROAD_STEP; v < HALF; v += ROAD_STEP) {
    g.fillRect(toPx(v) - roadW / 2, 0, roadW, N);
    g.fillRect(0, toPx(v) - roadW / 2, N, roadW);
  }
  // Lane dashes
  g.fillStyle = '#e8c84a';
  for (let v = -HALF + ROAD_STEP; v < HALF; v += ROAD_STEP) {
    for (let u = -HALF; u < HALF; u += 36) {
      g.fillRect(toPx(u), toPx(v) - 1.5, 14, 3);
      g.fillRect(toPx(v) - 1.5, toPx(u), 3, 14);
    }
  }
  // Crosswalks at intersections
  g.fillStyle = 'rgba(240,240,240,0.85)';
  for (let vx = -HALF + ROAD_STEP; vx < HALF; vx += ROAD_STEP) {
    for (let vz = -HALF + ROAD_STEP; vz < HALF; vz += ROAD_STEP) {
      for (let i = -2; i <= 2; i++) {
        g.fillRect(toPx(vx + i * 5) - 2, toPx(vz) - 13, 4, 6);
        g.fillRect(toPx(vx + i * 5) - 2, toPx(vz) + 7, 4, 6);
      }
    }
  }
  // Beach strip (south edge, z > 480)
  g.fillStyle = '#e8d5a0';
  g.fillRect(0, toPx(480), N, N - toPx(480));
  g.fillStyle = '#d9c184';
  for (let i = 0; i < 40; i++) {
    g.fillRect(Math.random() * N, toPx(490 + Math.random() * 90), 30, 4);
  }
  // Plaza
  g.fillStyle = '#a89a7a';
  g.fillRect(toPx(-60), toPx(-60), toPx(120) - toPx(0), toPx(120) - toPx(0));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function isRoad(x, z) {
  const near = (v) => {
    const m = ((v % ROAD_STEP) + ROAD_STEP) % ROAD_STEP;
    return Math.min(m, ROAD_STEP - m) < 11;
  };
  return near(x + HALF) || near(z + HALF);
}

export function buildCity(scene, seed) {
  const rng = makeRng(seed);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'VelamarCity';

  // Lighting: low sun, warm sky
  scene.background = new THREE.Color(0x87b5e0);
  scene.fog = new THREE.Fog(0x9db8d6, 350, 1500);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6a4a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
  sun.position.set(300, 420, -180);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -700; sun.shadow.camera.right = 700;
  sun.shadow.camera.top = 700; sun.shadow.camera.bottom = -700;
  sun.shadow.camera.far = 1400;
  scene.add(sun);
  scene.add(sun.target);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY + 400, CITY + 400),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Ocean south of the beach
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 700),
    new THREE.MeshStandardMaterial({ color: 0x1e6f9f, roughness: 0.25, metalness: 0.35 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, HALF + 500);
  group.add(ocean);

  // Buildings: one per block between roads, skipping special plots
  const special = [
    { x: 0, z: 0, r: 90 },        // Civic Plaza
    { x: -180, z: 180, r: 55 },  // garage
    { x: -420, z: 0, r: 55 },    // helipad
    { x: 420, z: 420, r: 60 },   // harbor
    { x: 0, z: 420, r: 60 },     // marina
  ];
  const inSpecial = (x, z) => special.some((s) => Math.abs(x - s.x) < s.r && Math.abs(z - s.z) < s.r);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = -HALF + ROAD_STEP / 2; bx < HALF; bx += ROAD_STEP) {
    for (let bz = -HALF + ROAD_STEP / 2; bz < HALF; bz += ROAD_STEP) {
      if (bz > 420) continue; // beach
      if (inSpecial(bx, bz)) continue;
      if (rng() < 0.08) continue; // empty lot / park
      const downtown = Math.abs(bx) < 200 && Math.abs(bz) < 200;
      const h = downtown ? range(rng, 35, 85) : range(rng, 10, 42);
      const w = range(rng, 55, 88);
      const d = range(rng, 55, 88);
      const color = pick(rng, BUILDING_COLORS);
      const mat = new THREE.MeshStandardMaterial({
        map: facadeTexture(rng, color), roughness: 0.85,
      });
      const b = new THREE.Mesh(boxGeo, mat);
      b.scale.set(w, h, d);
      b.position.set(bx + range(rng, -6, 6), h / 2, bz + range(rng, -6, 6));
      b.castShadow = true; b.receiveShadow = true;
      group.add(b);
      // Roof cap
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.92, 2, d * 0.92),
        new THREE.MeshStandardMaterial({ color: pick(rng, ROOF_COLORS), roughness: 0.9 }),
      );
      roof.position.set(b.position.x, h + 1, b.position.z);
      group.add(roof);
      // Rooftop box on tall towers
      if (h > 55 && rng() > 0.5) {
        const ac = new THREE.Mesh(
          new THREE.BoxGeometry(8, 5, 8),
          new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.9 }),
        );
        ac.position.set(b.position.x + range(rng, -14, 14), h + 4, b.position.z + range(rng, -14, 14));
        group.add(ac);
      }
      colliders.push({ x: b.position.x, z: b.position.z, hx: w / 2 + 1, hz: d / 2 + 1 });
    }
  }

  // Streetlights along roads
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.6, metalness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd23e, emissiveIntensity: 1.4 });
  const poleGeo = new THREE.CylinderGeometry(0.25, 0.35, 9, 6);
  const lampGeo = new THREE.SphereGeometry(0.9, 8, 6);
  for (let v = -HALF + ROAD_STEP; v < HALF; v += ROAD_STEP) {
    for (let u = -HALF + 60; u < HALF; u += ROAD_STEP) {
      for (const [x, z] of [[v + 14, u], [u, v + 14]]) {
        if (z > 480) continue;
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(x, 4.5, z);
        group.add(pole);
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(x, 9.2, z);
        group.add(lamp);
      }
    }
  }

  // Palm trees along the beach and marina
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2e, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7a3a, roughness: 0.9 });
  for (let i = 0; i < 46; i++) {
    const x = range(rng, -HALF + 30, HALF - 30);
    const z = rng() > 0.5 ? range(rng, 495, 580) : range(rng, 400, 460);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 11, 6), trunkMat);
    trunk.position.set(x, 5.5, z);
    trunk.rotation.z = range(rng, -0.12, 0.12);
    group.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(5, 4, 7), leafMat);
    leaves.position.set(x, 12, z);
    group.add(leaves);
  }

  // Harbor cranes (east edge)
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xd86a2a, roughness: 0.6, metalness: 0.4 });
  for (const cz of [360, 420, 480]) {
    const mast = new THREE.Mesh(new THREE.BoxGeometry(4, 42, 4), craneMat);
    mast.position.set(520, 21, cz);
    group.add(mast);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(34, 3, 3), craneMat);
    arm.position.set(505, 40, cz);
    group.add(arm);
    colliders.push({ x: 520, z: cz, hx: 4, hz: 4 });
  }
  // Shipping containers at the Docks
  const contColors = [0x2e6b8f, 0x8f2e2e, 0x3a7a3a, 0xd8a02a];
  for (let i = 0; i < 14; i++) {
    const cont = new THREE.Mesh(
      new THREE.BoxGeometry(12, 5, 5),
      new THREE.MeshStandardMaterial({ color: pick(rng, contColors), roughness: 0.8 }),
    );
    cont.position.set(range(rng, 380, 520), 2.5, range(rng, -480, -360));
    cont.rotation.y = pick(rng, [0, Math.PI / 2]);
    cont.castShadow = true;
    group.add(cont);
    colliders.push({ x: cont.position.x, z: cont.position.z, hx: 7, hz: 7 });
  }

  // Garage building (Civic Plaza edge)
  const garageMat = new THREE.MeshStandardMaterial({ color: 0x3a4a6b, roughness: 0.8 });
  const garage = new THREE.Mesh(new THREE.BoxGeometry(46, 14, 30), garageMat);
  garage.position.set(-180, 7, 180);
  garage.castShadow = true;
  group.add(garage);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.4, metalness: 0.5 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 1), doorMat);
  door.position.set(-180, 5, 164.5);
  group.add(door);
  colliders.push({ x: -180, z: 180, hx: 23, hz: 15 });

  // Helipad (Downtown west)
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(16, 16, 1.2, 24),
    new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.9 }),
  );
  pad.position.set(-420, 0.6, 0);
  group.add(pad);
  const hRing = new THREE.Mesh(
    new THREE.TorusGeometry(10, 0.8, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0xffb400, emissiveIntensity: 0.6 }),
  );
  hRing.rotation.x = Math.PI / 2;
  hRing.position.set(-420, 1.4, 0);
  group.add(hRing);

  // Mission marker beacon (reused, moved by missions)
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffb400, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  beacon.add(beam);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(5, 0.5, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffb400 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.6;
  beacon.add(ring);
  beacon.visible = false;
  group.add(beacon);

  scene.add(group);
  return {
    colliders,
    beacon,
    garagePos: { x: -180, z: 164 },
    helipadPos: { x: -420, z: 0 },
    spawnPos: { x: -360, z: 360 },
  };
}

// Resolve a circle (player/car) against building colliders. Returns corrected x,z.
export function collideCircle(colliders, x, z, r) {
  for (const c of colliders) {
    const dx = x - c.x, dz = z - c.z;
    if (Math.abs(dx) > c.hx + r || Math.abs(dz) > c.hz + r) continue;
    const px = c.hx + r - Math.abs(dx);
    const pz = c.hz + r - Math.abs(dz);
    if (px < pz) x = c.x + (dx > 0 ? c.hx + r : -(c.hx + r));
    else z = c.z + (dz > 0 ? c.hz + r : -(c.hz + r));
  }
  return { x, z };
}

export function clampToCity(x, z) {
  return { x: Math.max(-HALF - 100, Math.min(HALF + 100, x)), z: Math.max(-HALF - 100, Math.min(HALF + 120, z)) };
}
