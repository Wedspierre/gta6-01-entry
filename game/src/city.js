// Velamar — a sun-soaked coastal city, built once from a fixed seed.
// Grid streets, pastel towers downtown, hotels on the beachfront, a pier,
// a ferris wheel, a marina and an industrial dockyard. Everything the game
// drives on, walks on or shoots at comes from this module.
import * as THREE from 'three';
import { makeRng } from './rng.js';

export const WORLD = {
  half: 460,
  roadGap: 100,
  roadWidth: 15,
  beachZ: 400,
  oceanZ: 470,
};

export const DISTRICTS = [
  { name: 'Old Port', x0: -460, z0: -460, x1: -160, z1: -60 },
  { name: 'Downtown', x0: -160, z0: -260, x1: 160, z1: 140 },
  { name: 'The Strip', x0: 160, z0: -260, x1: 460, z1: 140 },
  { name: 'Harbor Docks', x0: -460, z0: -60, x1: -160, z1: 400 },
  { name: 'Marina', x0: -160, z0: 140, x1: 160, z1: 400 },
  { name: 'Beachfront', x0: 160, z0: 140, x1: 460, z1: 400 },
  { name: 'North Hills', x0: -460, z0: -460, x1: 460, z1: -260 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  return 'Velamar';
}

const PALETTE = [
  0xf2d8a7, 0xe8b48c, 0xd99a6c, 0xf5e6c8, 0xc9d6d2, 0x9fb8c8,
  0xe6a8a0, 0xf0c46c, 0xb7c9a8, 0xd8c2e0, 0x8fb8a8, 0xe0a458,
];
const GLASS = [0x9cc8e0, 0x7fb2d8, 0xaed8e8, 0x8fb8d0];

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#aab0b8';
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 14) {
    for (let x = 6; x < 58; x += 12) {
      const lit = Math.random() < 0.28;
      g.fillStyle = lit ? '#ffd98a' : '#2c3a4a';
      g.fillRect(x, y, 7, 9);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildCity(scene) {
  const rng = makeRng(1337);
  const group = new THREE.Group();
  group.name = 'VelamarCity';
  const colliders = [];
  const winTex = windowTexture();

  // Lighting: low warm sun, bright sky bounce, soft distance haze.
  const sun = new THREE.DirectionalLight(0xffe0b0, 2.6);
  sun.position.set(-180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -520;
  sun.shadow.camera.right = 520;
  sun.shadow.camera.top = 520;
  sun.shadow.camera.bottom = -520;
  sun.shadow.camera.far = 900;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd9ee, 0x8a6f52, 1.55);
  scene.add(hemi);
  // Fill light from the far side so shaded facades still read.
  const fill = new THREE.DirectionalLight(0xffe8cc, 0.9);
  fill.position.set(220, 180, -180);
  scene.add(fill);
  scene.background = new THREE.Color(0x8ec3e8);
  scene.fog = new THREE.Fog(0x9fc8e8, 420, 1150);

  // Ground: sand base everywhere, grass park patches, ocean to the south.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshLambertMaterial({ color: 0xcbb58a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.1, 200);
  ground.receiveShadow = true;
  group.add(ground);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 900),
    new THREE.MeshLambertMaterial({ color: 0x2a7fa8 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.05, WORLD.oceanZ + 420);
  group.add(ocean);
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 8),
    new THREE.MeshBasicMaterial({ color: 0xeaf6ff }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.08, WORLD.oceanZ + 2);
  group.add(foam);

  // Roads: asphalt strips on the grid, with pale centre dashes.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3c3f45 });
  const dashGeo = new THREE.BoxGeometry(1.2, 0.06, 5);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d2a8 });
  const dashMeshes = [];
  const roadLines = [];
  for (let i = -4; i <= 4; i += 1) {
    const c = i * WORLD.roadGap;
    roadLines.push(c);
    for (const [w, l, x, z] of [
      [WORLD.roadWidth, 940, c, -20],
      [940, WORLD.roadWidth, 0, c],
    ]) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, l), roadMat);
      r.rotation.x = -Math.PI / 2;
      r.position.set(x, 0.02, z);
      r.receiveShadow = true;
      group.add(r);
    }
  }
  for (const c of roadLines) {
    for (let d = -440; d <= 400; d += 22) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.set(c, 0.05, d);
      dashMeshes.push(dash);
      const dash2 = new THREE.Mesh(dashGeo, dashMat);
      dash2.position.set(d, 0.05, c);
      dash2.rotation.y = Math.PI / 2;
      dashMeshes.push(dash2);
    }
  }
  dashMeshes.forEach((m) => group.add(m));

  // Sidewalk slabs under every block.
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9d968a });
  const blockGeo = new THREE.BoxGeometry(86, 0.5, 86);
  for (let ix = -4; ix < 4; ix += 1) {
    for (let iz = -4; iz < 4; iz += 1) {
      const cx = ix * 100 + 50;
      const cz = iz * 100 + 50;
      if (cz > 380) continue;
      const slab = new THREE.Mesh(blockGeo, walkMat);
      slab.position.set(cx, 0.15, cz);
      slab.receiveShadow = true;
      group.add(slab);
    }
  }

  // Buildings: one shared box, tinted materials by palette, window texture
  // repeated by height bucket. Downtown and beachfront go tall.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const mats = new Map();
  function buildingMat(color, tall) {
    const key = `${color}-${tall ? 'g' : 'w'}`;
    if (!mats.has(key)) {
      const tex = winTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(tall ? 3 : 2, tall ? 6 : 3);
      mats.set(key, new THREE.MeshLambertMaterial({
        color, map: tall ? null : tex,
      }));
    }
    return mats.get(key);
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5148 });
  const roofGeo = new THREE.BoxGeometry(1, 0.6, 1);

  function addBuilding(x, z, w, d, h, color, tall) {
    const m = new THREE.Mesh(boxGeo, buildingMat(color, tall));
    m.scale.set(w, h, d);
    m.position.set(x, h / 2 + 0.4, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.scale.set(w * 0.92, 1, d * 0.92);
    roof.position.set(x, h + 0.7, z);
    group.add(roof);
    colliders.push({ x, z, hx: w / 2 + 0.5, hz: d / 2 + 0.5 });
  }

  for (let ix = -4; ix < 4; ix += 1) {
    for (let iz = -4; iz < 4; iz += 1) {
      const cx = ix * 100 + 50;
      const cz = iz * 100 + 50;
      if (cz > 380) continue;
      const downtown = Math.abs(cx) < 170 && cz > -260 && cz < 140;
      const beach = cz > 140;
      if (rng.chance(0.12)) continue; // park / empty lot
      const n = downtown || beach ? 1 : rng.int(1, 3);
      for (let b = 0; b < n; b += 1) {
        const w = rng.range(16, 30);
        const d = rng.range(16, 30);
        const ox = n === 1 ? 0 : rng.range(-22, 22);
        const oz = n === 1 ? 0 : rng.range(-22, 22);
        let h = rng.range(8, 22);
        if (downtown) h = rng.range(24, 68);
        if (beach) h = rng.range(26, 54);
        const tall = h > 30;
        addBuilding(cx + ox, cz + oz, w, d, h, rng.pick(tall ? GLASS : PALETTE), tall);
      }
    }
  }

  // Palms along the beachfront and the Strip, lamps along every road.
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 9, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const crownGeo = new THREE.IcosahedronGeometry(3.4, 0);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const palmSpots = [];
  for (let x = -440; x <= 440; x += 28) {
    palmSpots.push([x, 392]);
    if (rng.chance(0.5)) palmSpots.push([x + 14, 168]);
  }
  for (let z = -440; z <= 360; z += 34) {
    if (rng.chance(0.4)) palmSpots.push([-448, z]);
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, palmSpots.length);
  const m4 = new THREE.Matrix4();
  palmSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 4.8, z);
    trunks.setMatrixAt(i, m4);
    m4.makeTranslation(x, 10.2, z);
    m4.scale(new THREE.Vector3(1, 0.55, 1));
    crowns.setMatrixAt(i, m4);
    m4.identity();
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  group.add(trunks);
  group.add(crowns);

  const lampGeo = new THREE.CylinderGeometry(0.12, 0.12, 7, 5);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const bulbGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const lampSpots = [];
  for (const c of roadLines) {
    for (let d = -400; d <= 380; d += 100) {
      lampSpots.push([c + 9, d + 40]);
    }
  }
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampSpots.length);
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 3.5, z);
    lamps.setMatrixAt(i, m4);
    m4.makeTranslation(x, 7.1, z);
    bulbs.setMatrixAt(i, m4);
    m4.identity();
  });
  group.add(lamps);
  group.add(bulbs);

  // Landmarks: the pier, the Vela Wheel, the marina, the stadium, the lighthouse.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 150), pierMat);
  pier.position.set(-150, 1.2, 470);
  pier.castShadow = true;
  group.add(pier);
  colliders.push({ x: -150, z: 470, hx: 8, hz: 75 });
  const lightHouse = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4.5, 26, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2ede2 }),
  );
  lightHouse.position.set(-150, 14, 540);
  lightHouse.castShadow = true;
  group.add(lightHouse);
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd27a }),
  );
  beacon.position.set(-150, 28, 540);
  group.add(beacon);

  const wheel = new THREE.Group();
  wheel.position.set(240, 0, 392);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(22, 1.1, 8, 40),
    new THREE.MeshLambertMaterial({ color: 0xd84a6e }),
  );
  rim.position.y = 26;
  wheel.add(rim);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 2, 3, 10),
    new THREE.MeshLambertMaterial({ color: 0x333333 }),
  );
  hub.rotation.x = Math.PI / 2;
  hub.position.y = 26;
  wheel.add(hub);
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(3, 3, 3),
      new THREE.MeshLambertMaterial({ color: PALETTE[i % PALETTE.length] }),
    );
    cab.position.set(Math.cos(a) * 22, 26 + Math.sin(a) * 22, 0);
    wheel.add(cab);
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 22, 5),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }),
    );
    spoke.position.set(Math.cos(a) * 11, 26 + Math.sin(a) * 11, 0);
    spoke.rotation.z = a + Math.PI / 2;
    wheel.add(spoke);
  }
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 28, 6), lampMat);
  legL.position.set(-8, 13, 0);
  legL.rotation.z = 0.3;
  wheel.add(legL);
  const legR = legL.clone();
  legR.position.x = 8;
  legR.rotation.z = -0.3;
  wheel.add(legR);
  group.add(wheel);
  colliders.push({ x: 240, z: 392, hx: 12, hz: 4 });

  const boatMat = new THREE.MeshLambertMaterial({ color: 0xe8e4da });
  const boatMat2 = new THREE.MeshLambertMaterial({ color: 0x4a7a9e });
  for (let i = 0; i < 7; i += 1) {
    const bx = -420 + i * 26;
    const boat = new THREE.Mesh(new THREE.BoxGeometry(7, 2.4, 16), i % 2 ? boatMat : boatMat2);
    boat.position.set(bx, 0.8, 430 + (i % 3) * 14);
    boat.rotation.y = rng.range(-0.15, 0.15);
    group.add(boat);
  }
  const stadium = new THREE.Mesh(
    new THREE.CylinderGeometry(46, 50, 16, 24),
    new THREE.MeshLambertMaterial({ color: 0xb8b0a0 }),
  );
  stadium.position.set(-330, 8, -330);
  stadium.castShadow = true;
  group.add(stadium);
  colliders.push({ x: -330, z: -330, hx: 48, hz: 48 });

  // Road graph: intersections every 100 units, edges along the grid.
  const intersections = [];
  for (let ix = -4; ix <= 4; ix += 1) {
    for (let iz = -4; iz <= 4; iz += 1) {
      intersections.push({ x: ix * 100, z: iz * 100 });
    }
  }

  scene.add(group);
  return {
    group,
    colliders,
    intersections,
    wheel,
    beacon,
    ocean,
    foam,
    sun,
    nearestRoad(x, z) {
      let best = intersections[0];
      let bd = Infinity;
      for (const p of intersections) {
        const d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    },
    randomRoadPoint(rng2) {
      const p = rng2.pick(intersections);
      return { x: p.x + rng2.range(-6, 6), z: p.z + rng2.range(-6, 6) };
    },
  };
}

// Circle (car / person) against building boxes: push the circle out.
export function collideCircle(pos, radius, colliders) {
  for (const c of colliders) {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const px = c.hx + radius - Math.abs(dx);
    const pz = c.hz + radius - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) pos.x = c.x + Math.sign(dx || 1) * (c.hx + radius);
      else pos.z = c.z + Math.sign(dz || 1) * (c.hz + radius);
      return true;
    }
  }
  return false;
}

export function clampWorld(pos, margin = 12) {
  pos.x = Math.max(-WORLD.half - margin, Math.min(WORLD.half + margin, pos.x));
  pos.z = Math.max(-WORLD.half - margin, Math.min(560, pos.z));
}
