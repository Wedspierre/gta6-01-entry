// Save / load through localStorage. One slot, versioned key.
import { S } from './state.js';

const KEY = 'velamar-save-v3';

export function saveGame() {
  try {
    const data = {
      cash: S.cash, respect: S.respect, health: S.health, armor: S.armor,
      missionIndex: S.missionIndex, missionDone: S.missionDone,
      garage: S.garage, ownedWeapons: S.ownedWeapons, ammo: S.ammo,
      radioStation: S.radioStation,
      player: S.player ? { x: S.player.pos.x, z: S.player.pos.z } : null,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function hasSave() { return loadSave() !== null; }

export function applySave(data) {
  if (!data) return false;
  S.cash = data.cash ?? 150;
  S.respect = data.respect ?? 0;
  S.health = data.health ?? 100;
  S.armor = data.armor ?? 0;
  S.missionIndex = data.missionIndex ?? 0;
  S.missionDone = data.missionDone ?? [];
  S.garage = data.garage ?? [];
  S.ownedWeapons = data.ownedWeapons ?? ['fists', 'pistol'];
  S.ammo = data.ammo ?? { pistol: 120, smg: 0, shotgun: 0 };
  S.radioStation = data.radioStation ?? 0;
  return data.player ?? null;
}
