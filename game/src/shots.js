// Velamar — staged screenshot scenes. Each ?shot= value sets the real game
// into one readable frame: a police chase, a golden-hour drive, a dockside
// shootout, and a wide shot of the city. The scenes play the actual game
// forward from a fixed setup, so every frame is a real render of the code.
import { Car } from './vehicles.js';

function giveCar(game, kind, color, x, z, heading, speed) {
  const car = new Car(kind, color, x, z, heading);
  car.driver = 'player';
  car.speed = speed || 0;
  game.scene.add(car.mesh);
  game.cars.push(car);
  game.playerCar = car;
  game.player.mesh.visible = false;
  game.camYaw = heading;
  return car;
}

function stageChase(game) {
  game.clockMinutes = 17 * 60 + 40;
  giveCar(game, 'sports', 0xc23b2e, 0, 60, 0, 24);
  game.police.setWanted(3);
  for (let i = 0; i < 3; i += 1) game.police.spawnCruiser(game.playerCar.pos);
  game.police.makeHeli();
  game.missions.startMission(10, game); // "Air One" — survive the helicopter chase
  game.hud.banner('AIR ONE', 'Outrun the helicopter — 75s');
}

function stageDrive(game) {
  game.clockMinutes = 17 * 60 + 55;
  giveCar(game, 'coupe', 0x2e6fc2, 0, -120, 0, 22);
  game.police.setWanted(0);
  for (let i = 0; i < 6; i += 1) game.traffic.spawnOne(game.player.pos);
  game.hud.toast('Downtown — golden hour');
}

function stageMission(game) {
  game.clockMinutes = 18 * 60 + 10;
  game.player.pos.set(-400, 0, 230);
  game.player.heading = Math.PI;
  game.camYaw = Math.PI;
  game.player.weapon = 'rifle';
  game.player.owned.add('rifle');
  game.player.ammo.rifle = 150;
  game.player.owned.add('smg');
  game.player.ammo.smg = 240;
  game.player.owned.add('shotgun');
  game.player.ammo.shotgun = 48;
  game.missions.startMission(6, game); // "Harbor Lights" — clear the dock guards
  game.hud.showWheel();
}

function stageCity(game) {
  game.clockMinutes = 18 * 60 + 20;
  giveCar(game, 'sedan', 0xe8b13a, 150, 300, Math.PI / 2, 12);
  game.police.setWanted(0);
  game.shotCam = {
    pos: [-40, 130, 520],
    look: [150, 5, 300],
  };
  game.hud.banner('VELAMAR', 'A city of sun, salt and stolen cars');
}

export function stageShot(name, game) {
  game.state = 'play';
  game.hud.titleScreen.classList.add('hidden');
  if (name === 'cover') stageChase(game);
  else if (name === 'drive') stageDrive(game);
  else if (name === 'mission') stageMission(game);
  else if (name === 'city') stageCity(game);
  else stageDrive(game);
  // Screenshots are taken seconds later, but the in-game timers run on clamped
  // frame time, so banners and phone cards would still cover the frame.
  // Hide them now; the objective bar and HUD still tell the story.
  game.hud.bannerBox.classList.remove('show');
  game.hud.bannerTimer = 0;
  game.hud.phone.classList.remove('show');
  game.hud.phoneTimer = 0;
  window.__shotReady = true;
}
