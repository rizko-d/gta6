// Keyboard and pointer input. Held keys give movement and driving;
// one-shot presses (interact, reload, pause, mute, start, continue,
// retry) are queued as flags and taken exactly once per frame by the
// loop, so a press between two frames is never lost or counted twice.

export const ACT_INTERACT = 1;
export const ACT_RELOAD = 2;
export const ACT_PAUSE = 4;
export const ACT_MUTE = 8;
export const ACT_START = 16;
export const ACT_CONTINUE = 32;
export const ACT_RETRY = 64;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const BRAKE = new Set(['Space']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  // World-space aim point, filled in by the loop each frame.
  const aim = { x: 0, y: 0 };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyE') actions |= ACT_INTERACT;
    else if (event.code === 'KeyR') actions |= ACT_RELOAD;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACT_PAUSE;
    else if (event.code === 'KeyM') actions |= ACT_MUTE;
    else if (event.code === 'Space') actions |= ACT_START;
    else if (event.code === 'KeyC') actions |= ACT_CONTINUE;
    else if (event.code === 'Enter') actions |= ACT_RETRY;
    if (
      UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) ||
      RIGHT.has(event.code) || event.code === 'Space' || event.code.startsWith('Arrow')
    ) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    if (event.button !== 0) return;
    onMouseMove(event);
    mouse.down = true;
    mouse.clicked = true;
  }

  function onMouseUp(event) {
    if (event.button !== 0) return;
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    aim,
    up() {
      for (const k of keys) if (UP.has(k)) return true;
      return false;
    },
    held(code) { return keys.has(code); },
    axis() {
      let x = 0;
      let y = 0;
      for (const k of keys) {
        if (LEFT.has(k)) x -= 1;
        else if (RIGHT.has(k)) x += 1;
        else if (UP.has(k)) y -= 1;
        else if (DOWN.has(k)) y += 1;
      }
      return { x, y };
    },
    run() {
      for (const k of keys) if (RUN.has(k)) return true;
      return false;
    },
    brake() {
      for (const k of keys) if (BRAKE.has(k)) return true;
      return false;
    },
    // One-shot presses since the last call; clears them.
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeClick() {
      const c = mouse.clicked;
      mouse.clicked = false;
      return c;
    },
  };
}
