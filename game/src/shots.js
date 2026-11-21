// Screenshot staging: ?shot=cover|drive|mission|chase (and ?seed=).
// The game reads the query at boot, hides the menu, stages a busy scene and
// sets window.__shotReady once the frame is composed. Real renders of the
// game's own code — no compositing, no borrowed images.
import { S } from './state.js';
import { Police } from './police.js';
import { Dispatch } from './dispatch.js';

export function parseShotMode() {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  const seed = Number(q.get('seed') || '20261122');
  return { shot, seed };
}

export function stageShot(api, mode) {
  if (!mode) return;
  S.shotMode = mode;
  const p = api.playerPos;
  const set = (x, z, heading) => {
    api.teleportPlayer(x, z, heading);
  };
  if (mode === 'cover') {
    // Sunset avenue, player in a sports car, traffic, police behind, mission live.
    set(0, 300, 0);
    api.giveCar('Neon Sport', 0, 300, 0);
    api.enterCar();
    api.spawnTrafficNear(0, 300, 8);
    api.spawnPedsNear(0, 300, 10);
    Police.addWanted(2, 'speeding through Neon Mile');
    api.startMission(0);
    S.cameraYaw = Math.PI;
    S.cameraPitch = 0.24;
    S.cameraDist = 11;
  } else if (mode === 'drive') {
    // On foot beside a stolen coupe on a downtown street, city behind.
    set(40, 60, Math.PI * 0.8);
    api.spawnCarNear('Sunset Coupe', 46, 64);
    api.spawnTrafficNear(40, 60, 6);
    api.spawnPedsNear(40, 60, 12);
    api.startMission(1);
    S.cameraYaw = Math.PI * 0.9;
    S.cameraPitch = 0.3;
    S.cameraDist = 10;
  } else if (mode === 'mission') {
    // Mission in progress: Harbor Lights escort with police closing in.
    set(400, 380, Math.PI);
    api.giveCar('Sunset Coupe', 400, 400, Math.PI);
    api.enterCar();
    api.startMission(6);
    api.spawnTrafficNear(400, 380, 6);
    Police.addWanted(3, 'fleeing the Harbor Lights ambush');
    Police.spawnRoadblock(api.scene(), api.rng(), 400, 320, Math.PI);
    S.cameraYaw = Math.PI;
    S.cameraPitch = 0.26;
    S.cameraDist = 12;
  } else if (mode === 'chase') {
    // Full heat: 5 stars, helicopter overhead, roadblock ahead, sirens.
    set(0, -100, 0);
    api.giveCar('Neon Sport', 0, -80, 0);
    api.enterCar();
    api.spawnTrafficNear(0, -100, 8);
    api.spawnPedsNear(0, -100, 8);
    Police.addWanted(5, 'smashing through the Civic Plaza roadblock');
    Police.spawnRoadblock(api.scene(), api.rng(), 0, -160, 0);
    api.startMission(11);
    S.cameraYaw = Math.PI * 1.05;
    S.cameraPitch = 0.3;
    S.cameraDist = 13;
  }
  Dispatch.say('Dispatch: Velamar Bay is live — drive safe, drive fast.');
  setTimeout(() => { window.__shotReady = true; }, 1200);
}
