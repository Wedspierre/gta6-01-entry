// The HUD: the DOM panels (cash, health, wanted stars, objective, speed) and the
// circular minimap, drawn on a 2D canvas — roads, blocks, the player arrow, police
// dots, rivals, the mission marker and the north indicator.

import { DISTRICTS, MISSIONS, PLACES, ROADS, WORLD } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = el('hud');
  const cash = el('cash');
  const healthFill = el('healthfill');
  const ammo = el('ammo');
  const rep = el('rep');
  const stars = el('stars');
  const objTitle = el('objtitle');
  const objText = el('objtext');
  const objDist = el('objdist');
  const speedEl = el('speed');
  const carName = el('carname');
  const toast = el('toast');
  const flash = el('flash');
  const crosshair = el('crosshair');
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');
  let toastTimer = 0;

  function showToast(title, sub, seconds) {
    toast.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), (seconds || 2.6) * 1000);
  }

  function setVisible(on) {
    hud.classList.toggle('on', on);
  }

  function update(state) {
    cash.innerHTML = `$${Math.floor(state.cash).toLocaleString('en-US')} <small>SOLMARA HEAT</small>`;
    healthFill.style.width = `${Math.max(0, Math.min(100, state.health))}%`;
    healthFill.style.background = state.health > 50
      ? 'linear-gradient(90deg,#37d67a,#7dff9a)'
      : state.health > 25 ? 'linear-gradient(90deg,#ff5a4e,#ffb347)' : 'linear-gradient(90deg,#d21f3c,#ff5a4e)';
    ammo.textContent = state.ammo === Infinity ? 'PISTOL ∞' : `PISTOL ${state.ammo}`;
    rep.textContent = `REP ${state.rep}`;
    const filled = '★'.repeat(state.wanted);
    const empty = '☆'.repeat(Math.max(0, 5 - state.wanted));
    stars.textContent = filled + empty;
    stars.classList.toggle('dim', state.wanted === 0);
    objTitle.textContent = state.objective.title;
    objText.textContent = state.objective.text;
    objDist.textContent = state.objectiveDist != null ? `${Math.round(state.objectiveDist)}m — ${state.objectivePlace || ''}` : '';
    if (state.inCar) {
      speedEl.style.display = 'block';
      speedEl.innerHTML = `${Math.round(Math.abs(state.speed) * 2.2)} <small>MPH</small>`;
      carName.textContent = state.carName || '';
    } else {
      speedEl.style.display = 'none';
      carName.textContent = '';
    }
    crosshair.style.display = state.showCrosshair ? 'block' : 'none';
    flash.style.opacity = state.flash > 0 ? String(Math.min(1, state.flash)) : '0';
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const size = 220;
    const scale = size / (WORLD.half * 2 + 40);
    const toMap = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];
    mctx.clearRect(0, 0, size, size);
    // Sea at the south edge.
    mctx.fillStyle = '#14324a';
    mctx.fillRect(0, 0, size, size);
    mctx.fillStyle = '#1e6f8f';
    const [, wy] = toMap(0, WORLD.half);
    mctx.fillRect(0, wy, size, size - wy);
    // Blocks.
    mctx.fillStyle = '#3a4152';
    for (let i = 0; i < ROADS.length - 1; i += 1) {
      for (let j = 0; j < ROADS.length - 1; j += 1) {
        const [x, z] = toMap((ROADS[i] + ROADS[i + 1]) / 2 - 17, (ROADS[j] + ROADS[j + 1]) / 2 - 17);
        mctx.fillRect(x, z, 34 * scale, 34 * scale);
      }
    }
    // Roads.
    mctx.strokeStyle = '#8d8578';
    mctx.lineWidth = 5;
    for (const r of ROADS) {
      const [x1, y1] = toMap(-WORLD.half, r);
      const [x2, y2] = toMap(WORLD.half, r);
      mctx.beginPath(); mctx.moveTo(x1, y1); mctx.lineTo(x2, y2); mctx.stroke();
      const [x3, y3] = toMap(r, -WORLD.half);
      const [x4, y4] = toMap(r, WORLD.half);
      mctx.beginPath(); mctx.moveTo(x3, y3); mctx.lineTo(x4, y4); mctx.stroke();
    }
    // District dots.
    mctx.fillStyle = 'rgba(255,255,255,0.5)';
    mctx.font = '9px Arial';
    for (const d of DISTRICTS) {
      const [x, y] = toMap(d.x, d.z);
      mctx.beginPath(); mctx.arc(x, y, 2, 0, Math.PI * 2); mctx.fill();
    }
    // Mission marker (pulsing gold diamond).
    if (state.target) {
      const [x, y] = toMap(state.target.x, state.target.z);
      const pulse = 5 + Math.sin(performance.now() / 240) * 2;
      mctx.fillStyle = '#ffd23f';
      mctx.beginPath();
      mctx.moveTo(x, y - pulse); mctx.lineTo(x + pulse, y); mctx.lineTo(x, y + pulse); mctx.lineTo(x - pulse, y);
      mctx.closePath(); mctx.fill();
      mctx.strokeStyle = '#fff';
      mctx.lineWidth = 1.5;
      mctx.stroke();
    }
    // Police (blue/red) and rivals (red) dots.
    for (const p of state.policeDots || []) {
      const [x, y] = toMap(p.x, p.z);
      mctx.fillStyle = p.kind === 'cop' ? '#ff4040' : '#4080ff';
      mctx.beginPath(); mctx.arc(x, y, 3, 0, Math.PI * 2); mctx.fill();
    }
    for (const r of state.rivalDots || []) {
      const [x, y] = toMap(r.x, r.z);
      mctx.fillStyle = '#ff2020';
      mctx.beginPath(); mctx.arc(x, y, 3, 0, Math.PI * 2); mctx.fill();
    }
    // Player arrow, rotated to the heading.
    const [px, py] = toMap(state.playerX, state.playerZ);
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(Math.atan2(state.playerHeadingX, state.playerHeadingZ) + Math.PI);
    mctx.fillStyle = '#fff';
    mctx.beginPath();
    mctx.moveTo(0, -8); mctx.lineTo(5.5, 6); mctx.lineTo(0, 3); mctx.lineTo(-5.5, 6);
    mctx.closePath(); mctx.fill();
    mctx.strokeStyle = '#111';
    mctx.lineWidth = 1;
    mctx.stroke();
    mctx.restore();
    // North marker.
    mctx.fillStyle = '#fff';
    mctx.font = 'bold 11px Arial';
    mctx.fillText('N', size / 2 - 3, 13);
  }

  /** Fill the start screen's mission list from the save. */
  function renderMissionList(completed) {
    const list = document.getElementById('missionList');
    if (!list) return;
    list.innerHTML = MISSIONS.map((m) => {
      const done = completed.includes(m.id);
      return `<div class="${done ? 'done' : ''}">✓ ${m.title} — $${m.pay}</div>`;
    }).join('') + '<div style="color:#8fa8d8">Free roam, car theft, police chases and street pickups pay too.</div>';
  }

  return { setVisible, update, showToast, renderMissionList };
}

export { PLACES };
