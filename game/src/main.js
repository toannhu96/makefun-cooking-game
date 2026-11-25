// Boot and the shift loop: fits the 1280x720 view to the window, reads input, steps the round at a
// fixed rate, plays its sounds and paints. The title screen runs the demo chef behind the card.
// ?seed=N fixes the orders; ?shot=start|play|end (with &seed=N) stages that scene instead, paints it
// and sets window.__shotReady for a screenshot.
import { STEP, VIEW } from './config.js';
import { autoChefControls, createAutoChef } from './autochef.js';
import { createInput, readControls } from './input.js';
import { createRound, stepRound } from './round.js';
import { drawFrame, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, starsFor } from './render.js';
import { playEvents, unlockAudio } from './sfx.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const seedParam = Math.floor(Number(params.get('seed')));
let seed = seedParam > 0 ? seedParam : (Date.now() % 99991) + 1;
const view = { scale: 1, ox: 0, oy: 0 };

function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
  view.ox = (canvas.width - VIEW.width * view.scale) / 2;
  view.oy = (canvas.height - VIEW.height * view.scale) / 2;
}

function toView(clientX, clientY) {
  const dpr = window.devicePixelRatio || 1;
  return { x: (clientX * dpr - view.ox) / view.scale, y: (clientY * dpr - view.oy) / view.scale };
}

function paint(round, screen, time) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1e120d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  drawFrame(ctx, round, screen, time);
}

function stationAt(round, point) {
  return round.kitchen.stations.find((s) => point.x >= s.x && point.x <= s.x + s.w && point.y >= s.y - 10 && point.y <= s.y + s.h) ?? null;
}

const game = { screen: SCREEN_TITLE, round: createRound(seed), demo: createAutoChef({ pause: 0.2 }), time: 0, carry: 0, pendingUse: false };

function startShift() {
  seed += 1;
  game.round = createRound(seed);
  game.screen = SCREEN_PLAY;
  game.carry = 0;
  status.textContent = 'Shift started. Orders are coming in.';
}

function stepDemo(dt) {
  game.carry += dt;
  while (game.carry >= STEP) {
    stepRound(game.round, STEP, autoChefControls(game.round, game.demo, STEP));
    game.round.events.length = 0;
    game.carry -= STEP;
  }
  if (game.round.over) {
    game.round = createRound(seed);
    game.demo = createAutoChef({ pause: 0.2 });
  }
}

function stepShift(dt, controls) {
  const round = game.round;
  if (controls.click) {
    const station = stationAt(round, controls.click);
    if (station) round.chef.target = station;
  }
  game.pendingUse ||= controls.use;
  game.carry += dt;
  while (game.carry >= STEP && !round.over) {
    stepRound(round, STEP, { dx: controls.dx, dy: controls.dy, use: game.pendingUse });
    game.pendingUse = false;
    game.carry -= STEP;
  }
  playEvents(round.events);
  round.events.length = 0;
  if (round.over) {
    game.screen = SCREEN_OVER;
    status.textContent = `Shift over: ${round.served} burgers served, $${round.cash} taken, ${starsFor(round.cash)} stars.`;
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  game.time += dt;
  const controls = readControls(input);
  if (controls.start || controls.use || controls.click) unlockAudio();
  if (game.screen === SCREEN_TITLE) {
    if (controls.start || controls.click) startShift();
    else stepDemo(dt);
  } else if (game.screen === SCREEN_PLAY) stepShift(dt, controls);
  else if (controls.start) startShift();
  paint(game.round, game.screen, game.time);
  requestAnimationFrame(frame);
}

fitCanvas();
window.addEventListener('resize', fitCanvas);
const input = createInput(canvas, toView);
const shot = params.get('shot');
const staged = shot ? stageShot(shot, seedParam > 0 ? seedParam : 1) : null;
if (staged) {
  paint(staged.round, staged.screen, staged.time);
  requestAnimationFrame(() => {
    paint(staged.round, staged.screen, staged.time);
    window.__shotReady = true;
  });
} else {
  status.textContent = 'Between The Buns. Press Enter to open the diner.';
  requestAnimationFrame(frame);
}
