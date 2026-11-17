// The city of Solmara, built from a seed: golden-hour light, a grid of asphalt roads
// with sidewalks, blocks of towers with lit windows, palms, lamps, the bay water to
// the south, and the landmarks the missions use. Returns the colliders (building AABBs)
// the player and cars resolve against, plus the road list traffic drives on.

import * as THREE from 'three';
import { DISTRICTS, PLACES, ROADS, WORLD } from './config.js';
import { pick, range } from './random.js';

function windowTexture(random, base, litRatio) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const lit = random() < litRatio;
      g.fillStyle = lit ? (random() < 0.6 ? '#ffd98a' : '#9fd8ff') : 'rgba(12,18,32,0.85)';
      g.fillRect(8 + col * 20, 10 + row * 20, 13, 14);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm(random) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 4.6, 6), trunkMat);
  trunk.position.y = 2.3;
  trunk.rotation.z = range(random, -0.08, 0.08);
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3d, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1, 4.7, Math.sin(a) * 1.1);
    leaf.rotation.set(Math.sin(a) * 0.7, a, Math.cos(a) * 0.7);
    group.add(leaf);
  }
  return group;
}

export function buildCity(scene, random) {
  const colliders = [];
  const half = WORLD.half;

  // Sky, fog and golden-hour sun. The sun sits low in the west so long shadows
  // rake across the avenues — the look the screenshots are taken in.
  scene.background = new THREE.Color(0xffb36b);
  scene.fog = new THREE.Fog(0xf7a55e, 180, 520);
  const hemi = new THREE.HemisphereLight(0xffe0b8, 0x3a4a6b, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.9);
  sun.position.set(-160, 140, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // Ground: warm sand-coloured base, then the bay water at the south edge.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 400, half * 2 + 400),
    new THREE.MeshLambertMaterial({ color: 0x9a8a6a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 400, 160),
    new THREE.MeshLambertMaterial({ color: 0x1e6f8f }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.4, half + 80);
  scene.add(water);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 400, 26),
    new THREE.MeshLambertMaterial({ color: 0xe8d49a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, half + 13);
  sand.receiveShadow = true;
  scene.add(sand);

  // Roads: dark asphalt strips with a pale centre line, plus sidewalk bands.
  const asphalt = new THREE.MeshLambertMaterial({ color: 0x2b2e36 });
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x8d8578 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c86a });
  for (const c of ROADS) {
    for (const [w, d, x, z] of [[half * 2, WORLD.roadHalf * 2, 0, c], [WORLD.roadHalf * 2, half * 2, c, 0]]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), asphalt);
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0.05, z);
      road.receiveShadow = true;
      scene.add(road);
    }
    // Centre dashes along both directions of this road.
    for (let t = -half + 10; t < half; t += 12) {
      for (const [x, z, ry] of [[t, c, 0], [c, t, Math.PI / 2]]) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = ry;
        dash.position.set(x, 0.08, z);
        scene.add(dash);
      }
    }
    // Sidewalk bands flanking the road.
    const sw = WORLD.sidewalk;
    for (const [w, d, x, z] of [
      [half * 2, sw, 0, c - WORLD.roadHalf - sw / 2], [half * 2, sw, 0, c + WORLD.roadHalf + sw / 2],
      [sw, half * 2, c - WORLD.roadHalf - sw / 2, 0], [sw, half * 2, c + WORLD.roadHalf + sw / 2],
    ]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(w, d), sidewalkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(x, 0.06, z);
      walk.receiveShadow = true;
      scene.add(walk);
    }
  }

  // Buildings: one or two towers per block, window textures in a few palettes,
  // taller toward Downtown so the skyline reads at a glance.
  const palettes = [
    ['#c98f5f', '#b5774d'], ['#7d8aa0', '#6b7a90'], ['#a89a7a', '#96876a'],
    ['#8a6f9e', '#775d8a'], ['#5f8a7d', '#527a6e'], ['#c9b18a', '#b39d77'],
  ];
  const textures = palettes.map(([base]) => windowTexture(random, base, 0.42));
  // Blocks sit between roads: centres offset by half a gap from each road line.
  const centres = [];
  for (let i = 0; i < ROADS.length - 1; i += 1) {
    for (let j = 0; j < ROADS.length - 1; j += 1) {
      centres.push([(ROADS[i] + ROADS[i + 1]) / 2, (ROADS[j] + ROADS[j + 1]) / 2]);
    }
  }
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const [cx, cz] of centres) {
    const downtown = Math.hypot(cx, cz + 30) < 100;
    const count = random() < 0.35 ? 2 : 1;
    for (let k = 0; k < count; k += 1) {
      const w = range(random, 12, 20);
      const d = range(random, 12, 20);
      const h = downtown ? range(random, 34, 68) : range(random, 10, 30);
      const ox = count === 2 ? (k === 0 ? -9 : 9) : 0;
      const oz = count === 2 ? (k === 0 ? 8 : -8) : 0;
      const mat = new THREE.MeshLambertMaterial({ map: pick(random, textures) });
      const mesh = new THREE.Mesh(buildingGeo, mat);
      mesh.scale.set(w, h, d);
      mesh.position.set(cx + ox, h / 2, cz + oz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      // Rooftop box so towers do not end in a flat slab.
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(Math.min(w, d) * 0.3, 2.2, Math.min(w, d) * 0.3),
        new THREE.MeshLambertMaterial({ color: 0x4a4640 }),
      );
      roof.position.set(cx + ox, h + 1.1, cz + oz);
      scene.add(roof);
      colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
    }
  }

  // Landmarks: Solmara Tower (the tall glass spike), the Bowl stadium ring,
  // the bank's pillared front, and the garage. Each is a few boxes, all original.
  function landmarkBox(x, z, w, h, d, color, y0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, (y0 || 0) + h / 2, z);
    m.castShadow = true;
    scene.add(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  }
  const tower = landmarkBox(PLACES.tower.x, PLACES.tower.z, 22, 92, 22, 0x3f6d8f);
  tower.material = new THREE.MeshLambertMaterial({ color: 0x3f6d8f, emissive: 0x1a3a55 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff4e6d }));
  beacon.position.set(PLACES.tower.x, 95, PLACES.tower.z);
  scene.add(beacon);
  // Stadium: a low ring of stands around a green pitch.
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(44, 30), new THREE.MeshLambertMaterial({ color: 0x3f8f4f }));
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(PLACES.stadium.x, 0.07, PLACES.stadium.z);
  scene.add(pitch);
  for (let s = 0; s < 4; s += 1) {
    const a = (s / 4) * Math.PI * 2;
    const stand = new THREE.Mesh(new THREE.BoxGeometry(46, 7, 6), new THREE.MeshLambertMaterial({ color: 0xd8d2c4 }));
    stand.position.set(PLACES.stadium.x + Math.cos(a) * 24, 3.5, PLACES.stadium.z + Math.sin(a) * 18);
    stand.rotation.y = -a;
    stand.castShadow = true;
    scene.add(stand);
  }
  landmarkBox(PLACES.bank.x, PLACES.bank.z, 26, 16, 18, 0xe8e0cc);
  landmarkBox(PLACES.garage.x, PLACES.garage.z, 20, 8, 14, 0x7a3a2e);
  landmarkBox(PLACES.safehouse.x, PLACES.safehouse.z, 12, 9, 12, 0x4a6b8a);
  landmarkBox(PLACES.hospital.x, PLACES.hospital.z, 24, 14, 16, 0xe8e8e8);

  // Palms along the marina front and the plaza, lamps along every avenue.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x22242a });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < 26; i += 1) {
    const palm = makePalm(random);
    palm.position.set(range(random, -200, 200), 0, 226 + range(random, -6, 6));
    scene.add(palm);
  }
  for (let i = 0; i < 10; i += 1) {
    const palm = makePalm(random);
    const a = (i / 10) * Math.PI * 2;
    palm.position.set(PLACES.plaza.x + Math.cos(a) * 16, 0, PLACES.plaza.z + Math.sin(a) * 16);
    scene.add(palm);
  }
  for (const c of ROADS) {
    for (let t = -210; t <= 210; t += 60) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), lampMat);
      pole.position.set(t, 3, c + WORLD.roadHalf + 1);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampGlow);
      bulb.position.set(t, 6.1, c + WORLD.roadHalf + 1);
      scene.add(bulb);
    }
  }

  // District name sprites, drawn on canvas and floated high so the city reads.
  function districtLabel(text, x, z) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const g = canvas.getContext('2d');
    g.font = 'bold 64px Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.shadowColor = 'rgba(0,0,0,0.8)';
    g.shadowBlur = 12;
    g.fillText(text.toUpperCase(), 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.scale.set(60, 15, 1);
    sprite.position.set(x, 42, z);
    scene.add(sprite);
  }
  for (const d of DISTRICTS) districtLabel(d.name, d.x, d.z);

  // Waypoint beacon: a golden light pillar the missions move around.
  const beaconGroup = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 30;
  beaconGroup.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4, 0.35, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23f }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  beaconGroup.add(ring);
  beaconGroup.visible = false;
  scene.add(beaconGroup);

  return { colliders, beacon: beaconGroup, sun };
}
