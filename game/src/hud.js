// HUD: DOM panels, the circular minimap, weapon wheel, dispatch panel,
// toasts and the center message. All DOM, drawn over the WebGL canvas.
import { S, MISSIONS, WEAPONS, RADIO_STATIONS, CITY, HALF } from './state.js';
import { Dispatch } from './dispatch.js';

const $ = (id) => document.getElementById(id);

export const Hud = {
  toastTimer: 0,
  centerTimer: 0,

  init() {
    $('btnHow').addEventListener('click', () => {
      const b = $('howBox');
      b.style.display = b.style.display === 'none' ? 'block' : 'none';
    });
    window.__velamarToast = (title, sub) => this.toast(title, sub);
    window.__velamarFeed = (tag, text) => {
      if (tag === 'POLICE') Dispatch.policeSay(text);
      else Dispatch.say(text);
    };
    window.__velamarFeedRender = () => this.renderFeed();
  },

  showGame() {
    $('menu').classList.add('hidden');
    $('pauseMenu').classList.add('hidden');
    $('hud').classList.remove('hidden');
  },

  showMenu() {
    $('menu').classList.remove('hidden');
    $('hud').classList.add('hidden');
    $('pauseMenu').classList.add('hidden');
  },

  showPause(on) {
    $('pauseMenu').classList.toggle('hidden', !on);
  },

  toast(title, sub) {
    const el = $('toast');
    el.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
    el.classList.remove('hidden');
    this.toastTimer = 3.2;
  },

  center(text, seconds = 2) {
    const el = $('centerMsg');
    el.textContent = text;
    el.classList.remove('hidden');
    this.centerTimer = seconds;
  },

  interact(text) {
    const el = $('interact');
    if (text) { el.textContent = text; el.classList.remove('hidden'); }
    else el.classList.add('hidden');
  },

  renderFeed() {
    const el = $('dispatchFeed');
    el.innerHTML = Dispatch.feed.map((f) =>
      `<div class="line"><b>${f.tag}:</b> ${f.text}</div>`).join('');
  },

  missionText() {
    const m = MISSIONS[S.missionIndex];
    const job = S.dispatchJob;
    if (m && S.missionIndex < MISSIONS.length) {
      const step = m.steps[S.missionStep];
      $('mTitle').textContent = `${m.id}. ${m.name.toUpperCase()} — ${m.giver.toUpperCase()}`;
      $('mObj').textContent = step ? step.text : '';
      let hint = `Reward $${m.reward} • +${m.respect} respect`;
      if (job) hint += `  |  DISPATCH: ${job.title} — $${job.pay}`;
      if (step?.kind === 'wait') hint += `  |  Hold the marker…`;
      $('mHint').textContent = hint;
    } else if (job) {
      $('mTitle').textContent = 'VELAMAR DISPATCH';
      $('mObj').textContent = `${job.title} — ${job.desc}`;
      $('mHint').textContent = `Pay $${job.pay} • Respect +5`;
    } else {
      $('mTitle').textContent = 'FREE ROAM — VELAMAR BAY';
      $('mObj').textContent = 'Press T for Velamar Dispatch jobs, or follow the story marker.';
      $('mHint').textContent = 'All 14 missions complete. The city is yours.';
    }
  },

  update(dt, api) {
    // Timers
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) $('toast').classList.add('hidden');
    }
    if (this.centerTimer > 0) {
      this.centerTimer -= dt;
      if (this.centerTimer <= 0) $('centerMsg').classList.add('hidden');
    }
    // Wanted stars
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < S.wanted ? '★' : '<span class="dim">★</span>';
    $('wanted').innerHTML = stars;
    $('cash').textContent = `$${S.cash.toLocaleString()}`;
    $('respect').textContent = `RESPECT ${S.respect}`;
    $('healthFill').style.width = `${Math.max(0, S.health)}%`;
    $('armorFill').style.width = `${Math.max(0, S.armor)}%`;
    const w = WEAPONS.find((x) => x.id === S.ownedWeapons[S.weaponIndex]) ?? WEAPONS[0];
    const ammo = S.ammo[w.id];
    $('weaponSlot').textContent = ammo !== undefined ? `${w.name}  •  ${ammo} rounds` : w.name;
    const inCar = api.inCar();
    $('speedo').classList.toggle('hidden', !inCar && !api.inHeli());
    if (inCar || api.inHeli()) {
      $('spd').textContent = String(Math.round(Math.abs(api.speed()) * 1.6));
      $('radioName').textContent = S.radioOn ? `♪ ${RADIO_STATIONS[S.radioStation].name}` : '♪ Radio off';
    }
    $('crosshair').classList.toggle('hidden', !(S.ownedWeapons[S.weaponIndex] !== 'fists' && !inCar));
    this.missionText();
    this.drawMinimap(api);
  },

  drawMinimap(api) {
    const cv = $('minimap');
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const cx = W / 2, cy = H / 2;
    const scale = W / 520; // show ~520 world units across
    const px = api.playerPos().x, pz = api.playerPos().z;
    g.clearRect(0, 0, W, H);
    // Sea + land
    g.fillStyle = '#0d2a4a';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#233246';
    const toMap = (wx, wz) => [cx + (wx - px) * scale, cy + (wz - pz) * scale];
    const [lx, lz] = toMap(-HALF - 100, -HALF - 100);
    const [rx, rz] = toMap(HALF + 100, HALF + 120);
    g.fillRect(lx, lz, rx - lx, rz - lz);
    // Beach
    g.fillStyle = '#c9b078';
    const [bx, bz] = toMap(-HALF, 480);
    g.fillRect(bx, bz, W, H);
    // Roads
    g.strokeStyle = '#5a6274';
    g.lineWidth = 4;
    for (let v = -HALF + 120; v < HALF; v += 120) {
      const [x1, z1] = toMap(v, -HALF);
      const [x2, z2] = toMap(v, HALF);
      g.beginPath(); g.moveTo(x1, z1); g.lineTo(x2, z2); g.stroke();
      const [x3, z3] = toMap(-HALF, v);
      const [x4, z4] = toMap(HALF, v);
      g.beginPath(); g.moveTo(x3, z3); g.lineTo(x4, z4); g.stroke();
    }
    const dot = (wx, wz, r, color) => {
      const [x, y] = toMap(wx, wz);
      g.fillStyle = color;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    };
    // Mission marker
    const mt = api.missionTarget();
    if (mt) {
      const [x, y] = toMap(mt.x, mt.z);
      const pulse = 6 + Math.sin(performance.now() / 200) * 2;
      g.fillStyle = '#ffb400';
      g.beginPath(); g.arc(x, y, pulse, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, pulse + 3, 0, Math.PI * 2); g.stroke();
    }
    // Dispatch job marker
    if (S.dispatchJob) dot(S.dispatchJob.x, S.dispatchJob.z, 5, '#6fd3ff');
    // Garage
    dot(-180, 164, 4, '#7dff9a');
    // Police
    for (const c of api.policeCars()) dot(c.pos.x, c.pos.z, 4, '#3a7bff');
    // Traffic (nearby only)
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (const c of api.trafficCars()) {
      const [x, y] = toMap(c.pos.x, c.pos.z);
      if (x > -10 && x < W + 10 && y > -10 && y < H + 10) g.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // Player arrow
    g.save();
    g.translate(cx, cy);
    g.rotate(-api.playerHeading());
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(-6, 7); g.closePath();
    g.fill();
    g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke();
    g.restore();
    // North indicator
    g.fillStyle = '#fff';
    g.font = 'bold 13px sans-serif';
    g.fillText('N', cx - 4, 16);
  },

  drawWheel(selectedIndex) {
    const cv = $('wheel');
    cv.classList.remove('hidden');
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    const n = S.ownedWeapons.length;
    S.ownedWeapons.forEach((id, i) => {
      const w = WEAPONS.find((x) => x.id === id);
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * 110;
      const y = cy + Math.sin(a) * 110;
      g.beginPath();
      g.arc(x, y, 42, 0, Math.PI * 2);
      g.fillStyle = i === selectedIndex ? 'rgba(255,180,0,0.9)' : 'rgba(10,14,32,0.85)';
      g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = '#fff';
      g.font = 'bold 12px sans-serif';
      g.textAlign = 'center';
      g.fillText(w.name, x, y + 4);
    });
  },

  hideWheel() { $('wheel').classList.add('hidden'); },

  renderJobs(onAccept) {
    const list = $('jobList');
    list.innerHTML = '';
    for (const job of Dispatch.jobs) {
      const div = document.createElement('div');
      div.className = 'job';
      div.innerHTML = `<span class="jt">${job.title}</span><span class="jp">$${job.pay}</span>
        <div class="jd">${job.desc} — ${job.district}.</div>`;
      div.addEventListener('click', () => onAccept(job));
      list.appendChild(div);
    }
    if (Dispatch.jobs.length === 0) {
      list.innerHTML = '<div class="sub">No jobs right now — dispatch refreshes the board shortly.</div>';
    }
  },

  toggleDispatch(show, onAccept) {
    $('dispatchPanel').classList.toggle('hidden', !show);
    if (show) this.renderJobs(onAccept);
  },
};
