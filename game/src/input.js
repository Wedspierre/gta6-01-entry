// Keyboard + mouse input for Solmara Heat. Held keys are read every frame; one-shot
// presses (enter car, punch, pause, mute) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice. Mouse drag
// orbits the camera; a click fires the pistol.

export const ACTION_ENTER = 1;
export const ACTION_PUNCH = 2;
export const ACTION_PAUSE = 4;
export const ACTION_MUTE = 8;
export const ACTION_JUMP = 16;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let dragX = 0;
  let dragY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let click = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyE') actions |= ACTION_ENTER;
    else if (event.code === 'KeyF') actions |= ACTION_PUNCH;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'Space') actions |= ACTION_JUMP;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    if (event.button === 0) click = true;
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    dragX += event.clientX - lastX;
    dragY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('pointerup', () => { dragging = false; });

  return {
    held(code) { return keys.has(code); },
    forward() { return (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0); },
    strafe() { return (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0); },
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    /** Camera orbit delta since the last call, in pixels. */
    takeDrag() {
      const out = { x: dragX, y: dragY };
      dragX = 0;
      dragY = 0;
      return out;
    },
    /** True once when the left mouse button went down since the last call. */
    takeClick() {
      const out = click;
      click = false;
      return out;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
