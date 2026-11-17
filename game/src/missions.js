// Missions: Lena Cruz's five jobs, run as a small state machine. Each mission has
// steps (steal a car, reach a place, fight a number of enemies, collect a stash);
// the machine moves the waypoint beacon, reports the objective text and distance,
// and pays out when the last step completes.

import { MISSIONS, PLACES } from './config.js';

export function createMissions() {
  return {
    index: 0,           // which mission is current (0..MISSIONS.length-1)
    step: 0,            // which step of that mission
    completed: [],      // ids of finished missions
    active: false,      // true while a mission is running
    timer: 0,           // countdown for timed steps (0 = untimed)
    fightLeft: 0,       // enemies still to beat in a fight step
    done: false,        // all five missions finished
  };
}

export function currentMission(missions) {
  if (missions.index >= MISSIONS.length) return null;
  return MISSIONS[missions.index];
}

export function currentStep(missions) {
  const mission = currentMission(missions);
  if (!mission) return null;
  return mission.steps[missions.step] || null;
}

export function startMission(missions) {
  const mission = currentMission(missions);
  if (!mission) return;
  missions.active = true;
  missions.step = 0;
  missions.timer = 0;
  missions.fightLeft = 0;
  const step = mission.steps[0];
  if (step && step.kind === 'fight') missions.fightLeft = step.count;
  if (step && step.timed) missions.timer = step.timed;
}

export function stopMission(missions) {
  missions.active = false;
}

/** Advance one step. Returns 'complete' when the mission paid out, 'step' on a step advance, else null. */
export function advanceStep(missions) {
  const mission = currentMission(missions);
  if (!mission) return null;
  missions.step += 1;
  if (missions.step >= mission.steps.length) {
    missions.completed.push(mission.id);
    missions.index += 1;
    missions.active = false;
    missions.step = 0;
    missions.timer = 0;
    if (missions.index >= MISSIONS.length) missions.done = true;
    return 'complete';
  }
  const step = mission.steps[missions.step];
  if (step.kind === 'fight') missions.fightLeft = step.count;
  if (step.timed) missions.timer = step.timed;
  else missions.timer = 0;
  return 'step';
}

/** Where the waypoint beacon should sit for the current step, or null for free roam. */
export function missionTarget(missions) {
  const step = currentStep(missions);
  if (!step || !missions.active) return null;
  if (step.kind === 'goto' || step.kind === 'collect') return PLACES[step.place];
  return null;
}

/** The objective line the HUD shows right now. */
export function objectiveText(missions) {
  const mission = currentMission(missions);
  if (!mission) return { title: 'SOLMARA IS YOURS', text: 'All five jobs done. Free roam — the city is yours, Marco.' };
  if (!missions.active) {
    return { title: 'FREE ROAM', text: `Next job: ${mission.title} — reach the yellow marker to start.` };
  }
  const step = currentStep(missions);
  let text = step ? step.text : mission.brief;
  if (step && step.kind === 'fight') text += ` — ${missions.fightLeft} left`;
  if (missions.timer > 0) text += ` — ${Math.ceil(missions.timer)}s`;
  return { title: mission.title, text };
}

/** Serialise for the save file. */
export function serializeMissions(missions) {
  return { index: missions.index, completed: missions.completed, done: missions.done };
}

export function restoreMissions(missions, data) {
  if (!data) return;
  missions.index = Math.min(data.index || 0, MISSIONS.length);
  missions.completed = Array.isArray(data.completed) ? data.completed : [];
  missions.done = !!data.done;
  missions.active = false;
  missions.step = 0;
}
