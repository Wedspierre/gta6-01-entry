// Velamar shared game state: one mutable object every system reads and writes.
// The city is a 1200x1200 grid centred on (0,0). Roads run every 120 units.
export const CITY = 1200;
export const ROAD_STEP = 120;
export const HALF = CITY / 2;

export const DISTRICTS = [
  { name: 'Old Port', cx: -420, cz: 420, color: 0x2e4a6b },
  { name: 'Marina Row', cx: 0, cz: 420, color: 0x3a6b8f },
  { name: 'Harbor Lights', cx: 420, cz: 420, color: 0x6b4a2e },
  { name: 'Downtown', cx: -420, cz: 0, color: 0x4a3a6b },
  { name: 'Civic Plaza', cx: 0, cz: 0, color: 0x6b6b3a },
  { name: 'Neon Mile', cx: 420, cz: 0, color: 0x8f2e5a },
  { name: 'North Hills', cx: -420, cz: -420, color: 0x2e6b3a },
  { name: 'Airport Rd', cx: 0, cz: -420, color: 0x555f6b },
  { name: 'The Docks', cx: 420, cz: -420, color: 0x6b2e2e },
];

// 14 story missions. Each step: {kind, x, z, text, ...}
export const MISSIONS = [
  { id: 1, name: 'Welcome Back', giver: 'Mara Voss', reward: 250, respect: 10,
    intro: 'Mara Voss is waiting at the Old Port. After five years away, Velamar Bay still owes you.',
    steps: [
      { kind: 'goto', x: -420, z: 420, text: 'Drive or walk to Mara at the Old Port pier' },
      { kind: 'talk', x: -420, z: 420, text: 'Talk to Mara (press E)' },
      { kind: 'goto', x: -300, z: 300, text: 'Pick up the package at the Marina Row lockup' },
      { kind: 'goto', x: -420, z: 420, text: 'Bring the package back to Mara' },
    ] },
  { id: 2, name: 'Wheels', giver: 'Mara Voss', reward: 400, respect: 12,
    intro: 'You need wheels of your own. Steal a decent car and bring it to the garage.',
    steps: [
      { kind: 'steal', text: 'Steal any car on the street (press F near a car)' },
      { kind: 'goto', x: -180, z: 180, text: 'Drive it to the garage on Civic Plaza', inCar: true },
      { kind: 'park', x: -180, z: 180, text: 'Park inside the garage marker and press G to store it' },
    ] },
  { id: 3, name: 'First Fare', giver: 'Velamar Dispatch', reward: 350, respect: 10,
    intro: 'Dispatch has a fare: a nervous tourist at Neon Mile needs a ride to the airport road.',
    steps: [
      { kind: 'goto', x: 420, z: 0, text: 'Pick up the fare at Neon Mile', inCar: true },
      { kind: 'goto', x: 0, z: -420, text: 'Drop the fare at Airport Road before the timer ends', inCar: true, timer: 75 },
    ] },
  { id: 4, name: 'The Drop', giver: 'Mara Voss', reward: 600, respect: 15,
    intro: 'A quiet drop at the Docks. No cops, no questions. The crate is already waiting.',
    steps: [
      { kind: 'goto', x: 420, z: -420, text: 'Reach the Docks drop point' },
      { kind: 'wait', seconds: 6, text: 'Wait for the contact — stay in the marker' },
      { kind: 'escape', text: 'The deal was a setup — lose the police (drop to 0 stars)' },
    ] },
  { id: 5, name: 'Mara', giver: 'Mara Voss', reward: 700, respect: 18,
    intro: 'Mara needs a driver she can trust for a meeting at Harbor Lights. Bring a fast car.',
    steps: [
      { kind: 'goto', x: 420, z: 420, text: 'Drive Mara to Harbor Lights', inCar: true },
      { kind: 'defend', count: 4, text: 'Rival crew ambush — take down 4 attackers' },
      { kind: 'goto', x: -420, z: 420, text: 'Get Mara home to the Old Port safe', inCar: true },
    ] },
  { id: 6, name: 'Street Kings', giver: 'Dario Kaine', reward: 900, respect: 20,
    intro: 'Dario Kaine runs the street races on Neon Mile. Beat his three drivers and the Mile is yours.',
    steps: [
      { kind: 'race', x: 420, z: 0, text: 'Race checkpoint 1 — beat the pack through Neon Mile', inCar: true, laps: 3 },
      { kind: 'race', x: 0, z: 0, text: 'Race checkpoint 2 — Civic Plaza straight', inCar: true, laps: 2 },
      { kind: 'race', x: -420, z: 0, text: 'Race checkpoint 3 — finish at Downtown', inCar: true, laps: 1 },
    ] },
  { id: 7, name: 'Harbor Lights', giver: 'Mara Voss', reward: 1000, respect: 22,
    intro: 'A shipment lands at Harbor Lights tonight. Escort the truck through the Docks.',
    steps: [
      { kind: 'goto', x: 420, z: 420, text: 'Meet the truck at Harbor Lights', inCar: true },
      { kind: 'escort', x: 420, z: -420, text: 'Escort the truck to the Docks — stay close, watch for ambush' },
      { kind: 'defend', count: 3, text: 'Ambush at the Docks — take down 3 attackers' },
    ] },
  { id: 8, name: 'Heat Wave', giver: 'Velamar Dispatch', reward: 1100, respect: 25,
    intro: 'The whole city is hot. Dispatch says a crew is pinned down on Airport Road. Get them out.',
    steps: [
      { kind: 'goto', x: 0, z: -420, text: 'Reach the pinned crew on Airport Road' },
      { kind: 'defend', count: 5, text: 'Hold the line — take down 5 attackers' },
      { kind: 'escape', text: 'Break out and lose the police (drop to 0 stars)' },
    ] },
  { id: 9, name: 'Protect the Fixer', giver: 'Dario Kaine', reward: 1300, respect: 25,
    intro: 'The Fixer is the only man who can wash the crew’s money. Someone put a price on him.',
    steps: [
      { kind: 'goto', x: 0, z: 0, text: 'Reach the Fixer at Civic Plaza' },
      { kind: 'defend', count: 6, text: 'Protect the Fixer — take down 6 hitmen' },
      { kind: 'goto', x: -420, z: -420, text: 'Drive the Fixer to the North Hills safehouse', inCar: true },
    ] },
  { id: 10, name: 'The Setup', giver: 'Mara Voss', reward: 1500, respect: 28,
    intro: 'A rival boss wants to meet at the Marina. It is a trap. Walk in anyway — armed.',
    steps: [
      { kind: 'goto', x: 0, z: 420, text: 'Go to the Marina Row meeting' },
      { kind: 'defend', count: 6, text: 'The trap springs — take down 6 gunmen' },
      { kind: 'goto', x: 420, z: 420, text: 'Chase the rival boss to Harbor Lights', inCar: true },
    ] },
  { id: 11, name: 'Air One', giver: 'Velamar Dispatch', reward: 1800, respect: 30,
    intro: 'Police helicopter over Downtown. Steal it from the helipad and fly the crew out.',
    steps: [
      { kind: 'goto', x: -420, z: 0, text: 'Reach the Downtown helipad' },
      { kind: 'fly', text: 'Take the helicopter (press E) and fly to the North Hills', inHeli: true },
      { kind: 'goto', x: -420, z: -420, text: 'Land at the North Hills clearing' },
    ] },
  { id: 12, name: 'Roadblock Run', giver: 'Dario Kaine', reward: 2000, respect: 32,
    intro: 'The city put up roadblocks on every bridge. Smash through three of them with the package.',
    steps: [
      { kind: 'smash', count: 3, text: 'Smash through 3 police roadblocks (drive through them)' },
      { kind: 'goto', x: 420, z: -420, text: 'Deliver the package to the Docks', inCar: true },
      { kind: 'escape', text: 'Lose the police (drop to 0 stars)' },
    ] },
  { id: 13, name: 'The Vault', giver: 'Mara Voss', reward: 2500, respect: 35,
    intro: 'One last job: the vault under Civic Plaza. In, out, and nobody sees your face.',
    steps: [
      { kind: 'goto', x: 0, z: 0, text: 'Reach the vault under Civic Plaza' },
      { kind: 'wait', seconds: 10, text: 'Hold the vault door — crack the safe (stay in the marker)' },
      { kind: 'defend', count: 6, text: 'Vault alarms tripped — take down 6 guards' },
      { kind: 'goto', x: -420, z: 420, text: 'Escape to the Old Port with the loot', inCar: true },
    ] },
  { id: 14, name: 'King of Velamar', giver: 'Mara Voss', reward: 5000, respect: 50,
    intro: 'The whole city is watching. One final run: every crew, every cop, one crown.',
    steps: [
      { kind: 'goto', x: 420, z: 0, text: 'Show up at Neon Mile — the final run starts here', inCar: true },
      { kind: 'defend', count: 8, text: 'The city comes for you — take down 8 attackers' },
      { kind: 'smash', count: 2, text: 'Smash through 2 roadblocks on the run north' },
      { kind: 'goto', x: -420, z: -420, text: 'Finish at the North Hills overlook — King of Velamar' },
    ] },
];

export const WEAPONS = [
  { id: 'fists', name: 'Fists', damage: 15, range: 2.2, rate: 0.45, auto: false },
  { id: 'pistol', name: 'Pistol', damage: 34, range: 55, rate: 0.28, auto: false },
  { id: 'smg', name: 'SMG', damage: 18, range: 45, rate: 0.09, auto: true },
  { id: 'shotgun', name: 'Shotgun', damage: 70, range: 22, rate: 0.9, auto: false },
];

export const RADIO_STATIONS = [
  { name: 'VELAMAR FM 88.1 — Sunset Drive', bpm: 96, root: 55, scale: [0, 3, 5, 7, 10], wave: 'sawtooth' },
  { name: 'NEON 104.5 — Night Circuit', bpm: 122, root: 49, scale: [0, 2, 3, 7, 8], wave: 'square' },
  { name: 'BAY 97.3 — Harbor Soul', bpm: 78, root: 57, scale: [0, 2, 4, 7, 9], wave: 'triangle' },
];

// The single mutable game state. Systems import and mutate it.
export const S = {
  phase: 'menu', // menu | playing | paused | busted | wasted
  time: 0,
  cash: 150,
  respect: 0,
  health: 100,
  armor: 0,
  wanted: 0,
  wantedHeat: 0,
  missionIndex: 0,
  missionStep: 0,
  missionDone: [],
  missionTimer: 0,
  missionState: {},
  dispatchJob: null,
  garage: [],
  weaponIndex: 0,
  ownedWeapons: ['fists', 'pistol'],
  ammo: { pistol: 120, smg: 0, shotgun: 0 },
  radioStation: 0,
  radioOn: true,
  player: null,
  car: null,
  heli: null,
  cameraYaw: 0,
  cameraPitch: 0.32,
  cameraDist: 9,
  seed: 20261122,
  shotMode: null,
  debug: { fps: 0, errors: [] },
};

export function resetProgress() {
  S.cash = 150; S.respect = 0; S.health = 100; S.armor = 0; S.wanted = 0; S.wantedHeat = 0;
  S.missionIndex = 0; S.missionStep = 0; S.missionDone = []; S.missionTimer = 0;
  S.missionState = {}; S.dispatchJob = null; S.garage = [];
  S.weaponIndex = 0; S.ownedWeapons = ['fists', 'pistol'];
  S.ammo = { pistol: 120, smg: 0, shotgun: 0 };
}
