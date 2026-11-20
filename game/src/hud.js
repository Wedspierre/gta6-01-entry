// Velamar — the HUD. DOM overlays on top of the 3D canvas: wanted stars,
// cash, health and armor, the minimap, mission tracker, radio readout, the
// phone, the weapon wheel, garage and gun-shop menus, and the title screen.
import { WEAPONS, WEAPON_ORDER } from './people.js';
import { STORY, RACES, rankFor } from './missions.js';
import { CAR_KINDS } from './vehicles.js';

export class HUD {
  constructor(root, game) {
    this.game = game;
    this.root = root;
    this.build();
  }

  el(tag, cls, parent, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    (parent || this.root).appendChild(e);
    return e;
  }

  build() {
    const g = this.game;
    this.topLeft = this.el('div', 'hud-top-left');
    this.stars = this.el('div', 'stars', this.topLeft);
    this.rank = this.el('div', 'rank', this.topLeft);
    this.topRight = this.el('div', 'hud-top-right');
    this.cash = this.el('div', 'cash', this.topRight, '$0');
    this.clock = this.el('div', 'clock', this.topRight, '08:00');
    this.district = this.el('div', 'district', this.topRight, 'Velamar');
    this.objective = this.el('div', 'objective');
    this.objectiveText = this.el('div', 'objective-text', this.objective);
    this.objectiveDist = this.el('div', 'objective-dist', this.objective);
    this.bottomLeft = this.el('div', 'hud-bottom-left');
    this.mapCanvas = this.el('canvas', 'minimap', this.bottomLeft);
    this.mapCanvas.width = 210;
    this.mapCanvas.height = 210;
    this.bottomRight = this.el('div', 'hud-bottom-right');
    this.healthRow = this.el('div', 'bars', this.bottomRight);
    this.healthBar = this.el('div', 'bar health', this.healthRow);
    this.healthFill = this.el('div', 'fill', this.healthBar);
    this.armorBar = this.el('div', 'bar armor', this.healthRow);
    this.armorFill = this.el('div', 'fill', this.armorBar);
    this.weaponBox = this.el('div', 'weapon', this.bottomRight, 'P9 Pistol — 60');
    this.speedBox = this.el('div', 'speed', this.bottomRight, '');
    this.radioBox = this.el('div', 'radio', null, '');
    this.root.appendChild(this.radioBox);
    this.hint = this.el('div', 'hint', null,
      'WASD move / drive &nbsp;·&nbsp; SHIFT sprint / NOS &nbsp;·&nbsp; E enter car / interact &nbsp;·&nbsp; Q weapon wheel &nbsp;·&nbsp; R radio &nbsp;·&nbsp; T taxi &nbsp;·&nbsp; P phone &nbsp;·&nbsp; M mute &nbsp;·&nbsp; ESC pause');
    this.root.appendChild(this.hint);
    this.crosshair = this.el('div', 'crosshair', null, '+');
    this.root.appendChild(this.crosshair);
    this.centerMsg = this.el('div', 'center-msg');
    this.phone = this.el('div', 'phone');
    this.phoneName = this.el('div', 'phone-name', this.phone);
    this.phoneText = this.el('div', 'phone-text', this.phone);
    this.toastBox = this.el('div', 'toasts');
    this.bannerBox = this.el('div', 'banner');
    this.bannerTitle = this.el('div', 'banner-title', this.bannerBox);
    this.bannerSub = this.el('div', 'banner-sub', this.bannerBox);
    this.wheel = this.el('div', 'wheel');
    this.menus = this.el('div', 'menus');
    this.buildTitle();
    this.buildPause();
    this.buildGarage();
    this.buildGunshop();
    this.buildMissionList();
    this.bannerTimer = 0;
    this.phoneTimer = 0;
    this.toastTimer = 0;
  }

  buildTitle() {
    this.titleScreen = this.el('div', 'screen title-screen', this.menus);
    this.el('div', 'game-title', this.titleScreen, 'VELAMAR');
    this.el('div', 'game-sub', this.titleScreen, 'An open-world crime story — sun, salt and stolen cars');
    this.el('div', 'game-tag', this.titleScreen,
      '14 story missions · 5-star VCPD chases · Air One helicopter · roadblocks & spike strips · weapon wheel · garage upgrades · radio · taxi fares · street races · stunt jumps · 20 hidden packages');
    const btns = this.el('div', 'btn-row', this.titleScreen);
    this.startBtn = this.el('button', 'btn primary', btns, 'START GAME');
    this.continueBtn = this.el('button', 'btn', btns, 'CONTINUE');
    this.el('div', 'title-foot', this.titleScreen,
      'Velamar is an original city. No Rockstar names, characters or assets. Keyboard + mouse. Click START, then click the game to lock the mouse.');
    this.startBtn.onclick = () => { this.game.startGame(false); };
    this.continueBtn.onclick = () => { this.game.startGame(true); };
  }

  buildPause() {
    this.pauseScreen = this.el('div', 'screen pause-screen hidden', this.menus);
    this.el('div', 'screen-title', this.pauseScreen, 'PAUSED');
    const btns = this.el('div', 'btn-row', this.pauseScreen);
    const resume = this.el('button', 'btn primary', btns, 'RESUME');
    const missions = this.el('button', 'btn', btns, 'MISSIONS');
    const quit = this.el('button', 'btn', btns, 'SAVE & TITLE');
    resume.onclick = () => this.game.togglePause(false);
    missions.onclick = () => this.showMissions();
    quit.onclick = () => { this.game.saveGame(); this.game.toTitle(); };
  }

  buildGarage() {
    this.garageScreen = this.el('div', 'screen garage-screen hidden', this.menus);
    this.el('div', 'screen-title', this.garageScreen, 'VELA MOTORS — GARAGE');
    this.garageList = this.el('div', 'shop-list', this.garageScreen);
    const btns = this.el('div', 'btn-row', this.garageScreen);
    const close = this.el('button', 'btn primary', btns, 'CLOSE');
    close.onclick = () => { this.garageScreen.classList.add('hidden'); this.game.closeMenu(); };
  }

  buildGunshop() {
    this.gunScreen = this.el('div', 'screen gun-screen hidden', this.menus);
    this.el('div', 'screen-title', this.gunScreen, 'IRONWORKS ARMS');
    this.gunList = this.el('div', 'shop-list', this.gunScreen);
    const btns = this.el('div', 'btn-row', this.gunScreen);
    const close = this.el('button', 'btn primary', btns, 'CLOSE');
    close.onclick = () => { this.gunScreen.classList.add('hidden'); this.game.closeMenu(); };
  }

  buildMissionList() {
    this.missionScreen = this.el('div', 'screen mission-screen hidden', this.menus);
    this.el('div', 'screen-title', this.missionScreen, 'MISSION BOARD');
    this.missionList = this.el('div', 'shop-list', this.missionScreen);
    const btns = this.el('div', 'btn-row', this.missionScreen);
    const close = this.el('button', 'btn primary', btns, 'CLOSE');
    close.onclick = () => { this.missionScreen.classList.add('hidden'); this.game.closeMenu(); };
  }

  showMissions() {
    const g = this.game;
    this.missionList.innerHTML = '';
    STORY.forEach((m, i) => {
      const done = g.missions.completed.has(m.id);
      const row = this.el('div', 'shop-row', this.missionList);
      this.el('span', '', row, `<b>${m.id}. ${m.title}</b> <i>${m.act}</i> — ${done ? 'DONE' : `$${m.reward.toLocaleString()}`}`);
      const b = this.el('button', 'btn small', row, done ? 'REPLAY' : 'START');
      b.onclick = () => {
        this.missionScreen.classList.add('hidden');
        g.closeMenu();
        g.missions.startMission(i, g);
      };
    });
    this.missionScreen.classList.remove('hidden');
    g.openMenu();
  }

  showGarage() {
    const g = this.game;
    this.garageList.innerHTML = '';
    for (const [kind, spec] of Object.entries(CAR_KINDS)) {
      if (kind === 'police' || kind === 'taxi') continue;
      const owned = g.garage.owned.includes(kind);
      const row = this.el('div', 'shop-row', this.garageList);
      this.el('span', '', row, `<b>${spec.name}</b> — top ${Math.round(spec.top * 2.2)} km/h · accel ${spec.accel} · ${owned ? 'OWNED' : '$' + spec.price.toLocaleString()}`);
      const b = this.el('button', 'btn small', row, owned ? 'SPAWN' : 'BUY');
      b.onclick = () => {
        if (owned) {
          g.spawnGarageCar(kind);
          this.garageScreen.classList.add('hidden');
          g.closeMenu();
        } else if (g.cash >= spec.price) {
          g.cash -= spec.price;
          g.garage.owned.push(kind);
          g.saveGame();
          this.showGarage();
        } else {
          this.toast('Not enough cash');
        }
      };
    }
    const up = this.el('div', 'shop-row', this.garageList);
    this.el('span', '', up, `<b>NOS Boost</b> — hold SHIFT for a speed burst · $1,500`);
    const ub = this.el('button', 'btn small', up, g.garage.nos ? 'OWNED' : 'BUY');
    ub.onclick = () => {
      if (!g.garage.nos && g.cash >= 1500) { g.cash -= 1500; g.garage.nos = true; g.saveGame(); this.showGarage(); }
    };
    const up2 = this.el('div', 'shop-row', this.garageList);
    this.el('span', '', up2, `<b>Armor Plating</b> — cars take half damage · $2,000`);
    const ub2 = this.el('button', 'btn small', up2, g.garage.armor ? 'OWNED' : 'BUY');
    ub2.onclick = () => {
      if (!g.garage.armor && g.cash >= 2000) { g.cash -= 2000; g.garage.armor = true; g.saveGame(); this.showGarage(); }
    };
    this.garageScreen.classList.remove('hidden');
    g.openMenu();
  }

  showGunshop() {
    const g = this.game;
    this.gunList.innerHTML = '';
    for (const key of WEAPON_ORDER) {
      if (key === 'fists') continue;
      const w = WEAPONS[key];
      const owned = g.player.owned.has(key);
      const row = this.el('div', 'shop-row', this.gunList);
      this.el('span', '', row, `<b>${w.name}</b> — dmg ${w.damage} · ${owned ? `ammo ${g.player.ammo[key]}` : '$' + WEAPON_PRICES[key].toLocaleString()}`);
      const b = this.el('button', 'btn small', row, owned ? 'BUY AMMO $150' : 'BUY');
      b.onclick = () => {
        if (owned) {
          if (g.cash >= 150) { g.cash -= 150; g.player.ammo[key] += w.ammo; g.saveGame(); this.showGunshop(); }
          else this.toast('Not enough cash');
        } else if (g.cash >= WEAPON_PRICES[key]) {
          g.cash -= WEAPON_PRICES[key];
          g.player.owned.add(key);
          g.player.ammo[key] = w.ammo;
          g.saveGame();
          this.showGunshop();
        } else this.toast('Not enough cash');
      };
    }
    const armorRow = this.el('div', 'shop-row', this.gunList);
    this.el('span', '', armorRow, '<b>Body Armor</b> — absorbs 60% of damage · $500');
    const ab = this.el('button', 'btn small', armorRow, 'BUY');
    ab.onclick = () => {
      if (g.cash >= 500) { g.cash -= 500; g.player.armor = 100; g.saveGame(); this.showGunshop(); }
      else this.toast('Not enough cash');
    };
    this.gunScreen.classList.remove('hidden');
    g.openMenu();
  }

  showPhone(name, text) {
    this.phoneName.textContent = name;
    this.phoneText.textContent = text;
    this.phone.classList.add('show');
    this.phoneTimer = 6;
  }

  showWheel() {
    this.wheel.innerHTML = '';
    const g = this.game;
    WEAPON_ORDER.forEach((key, i) => {
      const w = WEAPONS[key];
      const owned = g.player.owned.has(key);
      const cur = g.player.weapon === key;
      const slot = this.el('div', `wheel-slot${cur ? ' current' : ''}${owned ? '' : ' locked'}`, this.wheel,
        `<b>${i + 1}</b> ${w.name}<br><small>${owned ? (key === 'fists' ? 'always ready' : `ammo ${g.player.ammo[key]}`) : 'locked — buy at Ironworks Arms'}</small>`);
      slot.style.transform = `rotate(${i * 72}deg) translateY(-86px) rotate(${-i * 72}deg)`;
    });
    this.wheel.classList.add('show');
  }

  hideWheel() {
    this.wheel.classList.remove('show');
  }

  toast(text) {
    const t = this.el('div', 'toast', this.toastBox, text);
    setTimeout(() => t.remove(), 3200);
  }

  banner(title, sub) {
    this.bannerTitle.textContent = title;
    this.bannerSub.textContent = sub || '';
    this.bannerBox.classList.add('show');
    this.bannerTimer = 3.2;
  }

  center(text, ms = 2.4) {
    this.centerMsg.textContent = text;
    this.centerMsg.classList.add('show');
    setTimeout(() => this.centerMsg.classList.remove('show'), ms * 1000);
  }

  drawMinimap(g) {
    const c = this.mapCanvas.getContext('2d');
    const S = 210;
    const scale = S / 1080;
    const px = (x) => S / 2 + (x - g.player.pos.x) * scale;
    const pz = (z) => S / 2 + (z - g.player.pos.z) * scale;
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(12,20,28,0.82)';
    c.fillRect(0, 0, S, S);
    // Ocean.
    c.fillStyle = '#2a7fa8';
    c.fillRect(0, pz(470), S, S - pz(470));
    // Roads.
    c.strokeStyle = '#5a6068';
    c.lineWidth = 3;
    for (let i = -4; i <= 4; i += 1) {
      c.beginPath(); c.moveTo(px(i * 100), 0); c.lineTo(px(i * 100), S); c.stroke();
      c.beginPath(); c.moveTo(0, pz(i * 100)); c.lineTo(S, pz(i * 100)); c.stroke();
    }
    // Mission beacon.
    const tgt = g.missions.stepTarget()
      || (g.missions.taxi ? [g.missions.taxi.x, g.missions.taxi.z] : null)
      || (g.missions.race ? g.missions.race.def.points[g.missions.race.index] : null);
    if (tgt) {
      c.fillStyle = '#ffd23a';
      c.beginPath(); c.arc(px(tgt[0]), pz(tgt[1]), 6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffd23a';
      c.beginPath(); c.arc(px(tgt[0]), pz(tgt[1]), 10, 0, Math.PI * 2); c.stroke();
    }
    // Hidden packages.
    c.fillStyle = '#39d0c2';
    for (const p of g.missions.packageSpots) {
      if (!p.taken) c.fillRect(px(p.x) - 1.5, pz(p.z) - 1.5, 3, 3);
    }
    // Police.
    c.fillStyle = '#4a8cff';
    for (const car of g.police.cars) {
      c.beginPath(); c.arc(px(car.pos.x), pz(car.pos.z), 3, 0, Math.PI * 2); c.fill();
    }
    if (g.police.heli) {
      c.fillStyle = '#9fd0ff';
      c.beginPath(); c.arc(px(g.police.heli.position.x), pz(g.police.heli.position.z), 4, 0, Math.PI * 2); c.fill();
    }
    // Player arrow.
    const yaw = g.playerCar ? g.playerCar.heading : g.player.heading;
    c.save();
    c.translate(S / 2, S / 2);
    c.rotate(Math.PI - yaw);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, -8); c.lineTo(5.5, 6); c.lineTo(0, 3); c.lineTo(-5.5, 6); c.closePath();
    c.fill();
    c.restore();
    // North tick.
    c.fillStyle = '#ffffff';
    c.font = 'bold 11px sans-serif';
    c.fillText('N', S - 14, 14);
  }

  update(dt, g) {
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < g.police.wanted ? '★' : '☆';
    this.stars.textContent = stars;
    this.stars.className = `stars w${g.police.wanted}`;
    this.rank.textContent = `${rankFor(g.respect)} · ${g.respect} respect`;
    this.cash.textContent = `$${Math.floor(g.cash).toLocaleString()}`;
    const h = Math.floor(g.clockMinutes / 60) % 24;
    const m = Math.floor(g.clockMinutes % 60);
    this.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    this.district.textContent = g.district;
    const obj = g.missions.objectiveText(g);
    if (obj) {
      this.objective.style.display = 'block';
      this.objectiveText.textContent = obj;
      const tgt = g.missions.stepTarget()
        || (g.missions.taxi ? [g.missions.taxi.x, g.missions.taxi.z] : null)
        || (g.missions.race ? g.missions.race.def.points[g.missions.race.index] : null);
      if (tgt) {
        const d = Math.hypot(tgt[0] - g.player.pos.x, tgt[1] - g.player.pos.z);
        this.objectiveDist.textContent = `${Math.round(d)}m`;
      } else this.objectiveDist.textContent = '';
    } else {
      this.objective.style.display = 'none';
    }
    this.healthFill.style.width = `${Math.max(0, g.player.hp)}%`;
    this.armorFill.style.width = `${Math.max(0, g.player.armor)}%`;
    const w = WEAPONS[g.player.weapon];
    const ammo = g.player.weapon === 'fists' ? '∞' : g.player.ammo[g.player.weapon];
    this.weaponBox.textContent = `${w.name} — ${ammo}`;
    if (g.playerCar) {
      this.speedBox.textContent = `${Math.round(Math.abs(g.playerCar.speed) * 2.4)} km/h${g.playerCar.nos > 0 ? ' · NOS!' : ''}`;
      this.speedBox.style.display = 'block';
    } else {
      this.speedBox.style.display = 'none';
    }
    this.radioBox.textContent = g.audio.radioOn
      ? `♪ ${g.audio.stationName()} — ${g.audio.trackName()}`
      : '♪ radio off';
    this.crosshair.style.display = (!g.playerCar && g.state === 'play' && !g.menuOpen) ? 'block' : 'none';
    this.drawMinimap(g);
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerBox.classList.remove('show');
    }
    if (this.phoneTimer > 0) {
      this.phoneTimer -= dt;
      if (this.phoneTimer <= 0) this.phone.classList.remove('show');
    }
  }
}
