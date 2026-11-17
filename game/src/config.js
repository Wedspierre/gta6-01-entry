// Solmara Heat — world constants, city layout and story data.
// Everything here is original: the city of Solmara, its streets, people and jobs
// were invented for this game and share nothing with any commercial title.

export const WORLD = {
  half: 240,            // playable ground extends -240..240 on x and z
  roadGap: 60,          // distance between parallel roads
  roadHalf: 7,          // half width of a road (asphalt)
  sidewalk: 4,          // sidewalk band beside each road
  block: 60 - 2 * (7 + 4), // buildable block size between roads
};

// Road centre lines (the city is a regular grid; roads run both ways).
export const ROADS = [-210, -150, -90, -30, 30, 90, 150, 210];

// Named districts, used by the HUD, missions and the minimap legend.
export const DISTRICTS = [
  { name: 'Old Docks', x: -180, z: 180, r: 70 },
  { name: 'Marina Bay', x: 180, z: 180, r: 70 },
  { name: 'Downtown', x: 30, z: -30, r: 90 },
  { name: 'Neon Row', x: -120, z: -60, r: 70 },
  { name: 'Palm Heights', x: 150, z: -150, r: 80 },
  { name: 'Safehouse', x: 180, z: -180, r: 40 },
];

// Landmark spots the missions and the camera use. All original places.
// Every landmark sits at a block centre (30 away from the nearest road) so no
// building ever blocks an avenue or an intersection.
export const PLACES = {
  garage: { x: -180, z: 150, label: "Lena's Garage" },
  docks: { x: -180, z: 180, label: 'Old Docks' },
  bank: { x: 60, z: 0, label: 'Solmara Reserve Bank' },
  marina: { x: 180, z: 180, label: 'Marina Bay' },
  neonRow: { x: -120, z: -60, label: 'Neon Row' },
  stadium: { x: 150, z: -60, label: 'Solmara Bowl' },
  safehouse: { x: 180, z: -180, label: 'Safehouse' },
  plaza: { x: 0, z: 0, label: 'Civic Plaza' },
  hospital: { x: 0, z: -180, label: 'St. Amara Hospital' },
  tower: { x: 60, z: -60, label: 'Solmara Tower' },
};

// Original vehicle roster. Stats are arcade values, not simulations.
export const CAR_MODELS = [
  { name: 'Bantam Coupe', top: 34, accel: 22, grip: 2.6, colors: [0xd83a2e, 0x2e6fd8, 0xf2c230] },
  { name: 'Vela Sedan', top: 30, accel: 18, grip: 2.4, colors: [0x3a3f4a, 0xe8e8e8, 0x274d8f] },
  { name: 'Cometa GT', top: 44, accel: 30, grip: 3.0, colors: [0xffb300, 0x111318, 0x8f1d2c] },
  { name: 'Tortuga Van', top: 24, accel: 14, grip: 2.0, colors: [0x6b7a5e, 0xc7b299, 0x4a6b8a] },
  { name: 'Duna Pickup', top: 32, accel: 20, grip: 2.5, colors: [0x2f6b4f, 0xb3541e, 0xdddddd] },
];

// The story: five jobs for fixer Lena Cruz. Each mission is one entry here;
// missions.js turns them into live objectives, waypoints and rewards.
export const MISSIONS = [
  {
    id: 'm1', title: 'MISSION 1 — FIRST WHEELS', pay: 400,
    brief: 'Lena needs a clean ride. Steal any car and deliver it to her garage.',
    steps: [
      { kind: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { kind: 'goto', place: 'garage', text: "Drive it to Lena's Garage" },
    ],
  },
  {
    id: 'm2', title: 'MISSION 2 — COURIER RUN', pay: 650,
    brief: 'A package for the Marina, 90 seconds, and the PD is already jumpy. No scratches, no sirens.',
    steps: [
      { kind: 'goto', place: 'docks', text: 'Pick up the package at the Old Docks', timed: 0 },
      { kind: 'goto', place: 'marina', text: 'Deliver to Marina Bay — fast!', timed: 90 },
    ],
  },
  {
    id: 'm3', title: 'MISSION 3 — TURF TROUBLE', pay: 900,
    brief: 'The Rust Vipers are muscling in on Neon Row. Lena wants them gone — all four of them.',
    steps: [
      { kind: 'goto', place: 'neonRow', text: 'Reach Neon Row' },
      { kind: 'fight', count: 4, text: 'Take down 4 Rust Vipers (click to shoot, F to punch)' },
    ],
  },
  {
    id: 'm4', title: 'MISSION 4 — THREE STASHES', pay: 1200,
    brief: 'Lena hid emergency cash around town before the heat came down. Collect all three stashes.',
    steps: [
      { kind: 'collect', place: 'stadium', text: 'Stash 1 — Solmara Bowl' },
      { kind: 'collect', place: 'plaza', text: 'Stash 2 — Civic Plaza' },
      { kind: 'collect', place: 'marina', text: 'Stash 3 — Marina Bay' },
    ],
  },
  {
    id: 'm5', title: 'MISSION 5 — THE BIG SCORE', pay: 2500,
    brief: 'The Solmara Reserve Bank. In, out, and gone before the PD locks the bridges. This is the one.',
    steps: [
      { kind: 'goto', place: 'bank', text: 'Reach the Solmara Reserve Bank' },
      { kind: 'fight', count: 3, text: 'Clear the bank guards' },
      { kind: 'goto', place: 'safehouse', text: 'Escape to the Safehouse — lose the cops!' },
    ],
  },
];

export const SAVE_KEY = 'solmara-heat-save-v1';

// Pedestrian first names and jacket colours — invented, shuffled by seed.
export const PED_NAMES = ['Ana', 'Beto', 'Celia', 'Dario', 'Elsa', 'Femi', 'Gus', 'Ines', 'Javi', 'Kira', 'Luz', 'Milo', 'Nadia', 'Omar', 'Pia', 'Rosa', 'Tomas', 'Vera', 'Yara', 'Zeke'];
export const PED_COLORS = [0xe8b04b, 0x4b7de8, 0xe84b6d, 0x4be88a, 0x9b4be8, 0xe8e84b, 0x4bd8e8, 0xd86a2e];

// Tuning.
export const TUNE = {
  playerWalk: 7,
  playerRun: 11,
  playerHealth: 100,
  pistolDamage: 34,
  punchDamage: 25,
  punchRange: 2.2,
  shootRange: 90,
  wantedDecaySeconds: 25,
  maxWanted: 5,
  copChaseSpeed: 9,
  pedSpeed: 1.6,
  trafficCount: 14,
  pedCount: 26,
};
