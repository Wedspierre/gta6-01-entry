// Keyboard + mouse input. Drag to orbit the camera; click to shoot when armed.
export const Input = {
  keys: new Set(),
  pressed: new Set(),
  mouseDX: 0,
  mouseDY: 0,
  mouseDown: false,
  mouseClicked: false,
  wheelDelta: 0,

  init(canvas) {
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true; this.mouseClicked = true;
      canvas.setPointerCapture?.(e.pointerId);
    });
    addEventListener('mouseup', () => { this.mouseDown = false; });
    addEventListener('mousemove', (e) => {
      if (this.mouseDown) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    canvas.addEventListener('wheel', (e) => { this.wheelDelta += e.deltaY; e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  down(code) { return this.keys.has(code); },
  wasPressed(code) { return this.pressed.has(code); },
  axis(neg, pos) { return (this.keys.has(pos) ? 1 : 0) - (this.keys.has(neg) ? 1 : 0); },
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseClicked = false;
    this.wheelDelta = 0;
  },
};
