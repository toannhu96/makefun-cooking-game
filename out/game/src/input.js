// Keyboard and mouse state: keys held for walking, key presses as one-shot edges for using a
// station or starting a shift, and the last click in view coordinates (click a station to walk there
// and use it).

const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'Enter']);

/** Starts listening; `toView(clientX, clientY)` maps a pointer position into view pixels. */
export function createInput(canvas, toView) {
  const input = { held: new Set(), pressed: new Set(), click: null };
  window.addEventListener('keydown', (event) => {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    if (!event.repeat) input.pressed.add(event.code);
    input.held.add(event.code);
  });
  window.addEventListener('keyup', (event) => input.held.delete(event.code));
  window.addEventListener('blur', () => input.held.clear());
  canvas.addEventListener('pointerdown', (event) => {
    input.click = toView(event.clientX, event.clientY);
  });
  return input;
}

function axis(held, minus, plus) {
  return (plus.some((code) => held.has(code)) ? 1 : 0) - (minus.some((code) => held.has(code)) ? 1 : 0);
}

/** This frame's controls; clears the one-shot presses and click. */
export function readControls(input) {
  const { held, pressed } = input;
  const controls = {
    dx: axis(held, ['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']),
    dy: axis(held, ['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']),
    use: pressed.has('KeyE') || pressed.has('Space'),
    start: pressed.has('Enter') || pressed.has('NumpadEnter'),
    click: input.click,
  };
  pressed.clear();
  input.click = null;
  return controls;
}
