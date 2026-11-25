// All drawing, in view pixels (1280x720): burger layers and loose ingredients, the kitchen (counters,
// stations, grill, pass, floor), the chef, the order rail, the HUD panels, popups, and the title and
// end-of-shift overlays. Reads the round; never changes it.
import { CHOP_TAPS, GRILL, INGREDIENTS, KITCHEN, PALETTE as P, ROUND_SECONDS, VIEW } from './config.js';
import { grillCounts, pattyState } from './kitchen.js';
import { isClosed } from './burger.js';
import { rushStage } from './recipes.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';
const FONT = '"Trebuchet MS", "Segoe UI", Verdana, sans-serif';

function box(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function text(ctx, str, x, y, size, color, align = 'center', weight = 800) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function mix(a, b, t) {
  const pa = a.match(/\w\w/g).map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g).map((h) => parseInt(h, 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
}

const PATTY_RAW = '#d9787a';
const PATTY_BURNT = '#231510';
function pattyColor(t) {
  if (t < GRILL.cookTime) return mix(PATTY_RAW, INGREDIENTS.patty.color, t / GRILL.cookTime);
  if (t < GRILL.burnTime) return INGREDIENTS.patty.color;
  return mix(INGREDIENTS.patty.color, PATTY_BURNT, Math.min(1, (t - GRILL.burnTime) / 1.5));
}

/** One burger layer, centred on cx with its bottom at `bottom`; returns its height. */
export function drawLayer(ctx, kind, cx, bottom, w, isTop = false, color = null) {
  const ing = INGREDIENTS[kind];
  const h = (isTop ? ing.topH : ing.h) * w;
  const x = cx - w / 2;
  const y = bottom - h;
  if (kind === 'bun' && isTop) {
    ctx.beginPath();
    ctx.moveTo(x, bottom);
    ctx.bezierCurveTo(x - w * 0.02, y - h * 0.25, x + w * 1.02, y - h * 0.25, x + w, bottom);
    ctx.closePath();
    ctx.fillStyle = ing.color;
    ctx.fill();
    box(ctx, x, bottom - h * 0.18, w, h * 0.18, h * 0.08, ing.dark);
    ellipse(ctx, cx - w * 0.2, y + h * 0.32, w * 0.14, h * 0.12, 'rgba(255,255,255,0.3)');
    for (let i = 0; i < 7; i += 1) {
      const sx = cx + Math.cos(i * 2.3) * w * 0.3;
      const sy = y + h * (0.28 + 0.22 * Math.abs(Math.sin(i * 1.7)));
      ellipse(ctx, sx, sy, w * 0.025, w * 0.014, '#fff3d6');
    }
  } else if (kind === 'bun') {
    box(ctx, x, y, w, h, h * 0.45, ing.dark);
    box(ctx, x + 2, y, w - 4, h * 0.45, h * 0.2, '#f6d39a');
  } else if (kind === 'patty') {
    const pw = w * 1.04;
    box(ctx, cx - pw / 2, y, pw, h, h * 0.5, color ?? ing.color);
    box(ctx, cx - pw / 2, y + h * 0.62, pw, h * 0.38, h * 0.3, 'rgba(0,0,0,0.22)');
    ctx.strokeStyle = 'rgba(255,220,180,0.25)';
    ctx.lineWidth = Math.max(1, w * 0.02);
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(cx + i * w * 0.25 - w * 0.06, y + h * 0.2);
      ctx.lineTo(cx + i * w * 0.25 + w * 0.06, y + h * 0.6);
      ctx.stroke();
    }
  } else if (kind === 'cheese') {
    const cw = w * 1.08;
    ctx.fillStyle = ing.color;
    ctx.fillRect(cx - cw / 2, y, cw, h);
    ctx.beginPath();
    ctx.moveTo(cx - cw * 0.42, bottom);
    ctx.lineTo(cx - cw * 0.3, bottom + h * 1.8);
    ctx.lineTo(cx - cw * 0.2, bottom);
    ctx.moveTo(cx + cw * 0.18, bottom);
    ctx.lineTo(cx + cw * 0.3, bottom + h * 2.2);
    ctx.lineTo(cx + cw * 0.44, bottom);
    ctx.fill();
  } else if (kind === 'lettuce') {
    const lw = w * 1.12;
    ctx.beginPath();
    ctx.moveTo(cx - lw / 2, y + h / 2);
    for (let i = 0; i <= 8; i += 1) ctx.quadraticCurveTo(cx - lw / 2 + (i - 0.5) * lw / 8, y - h * 0.4, cx - lw / 2 + i * lw / 8, y + h * 0.3);
    for (let i = 8; i >= 0; i -= 1) ctx.quadraticCurveTo(cx - lw / 2 + (i + 0.5) * lw / 8, bottom + h * 0.5, cx - lw / 2 + i * lw / 8, bottom);
    ctx.fillStyle = ing.color;
    ctx.fill();
    ctx.strokeStyle = ing.dark;
    ctx.lineWidth = Math.max(1, w * 0.012);
    ctx.stroke();
  } else if (kind === 'tomato') {
    for (const side of [-1, 1]) {
      const sx = cx + side * w * 0.235;
      box(ctx, sx - w * 0.23, y, w * 0.46, h, h * 0.5, ing.color);
      box(ctx, sx - w * 0.17, y + h * 0.25, w * 0.34, h * 0.45, h * 0.2, '#f07a6a');
      ellipse(ctx, sx - w * 0.06, y + h * 0.5, w * 0.02, h * 0.13, '#ffd9a8');
      ellipse(ctx, sx + w * 0.06, y + h * 0.5, w * 0.02, h * 0.13, '#ffd9a8');
    }
  } else if (kind === 'onion') {
    box(ctx, x + w * 0.04, y, w * 0.92, h, h * 0.5, ing.dark);
    box(ctx, x + w * 0.1, y + h * 0.22, w * 0.8, h * 0.56, h * 0.3, ing.color);
  }
  return h;
}

/** A burger stack from the bottom bun up; the bun after the first is drawn as the top dome. */
export function drawBurger(ctx, layers, cx, base, w) {
  if (!layers.length) return;
  ellipse(ctx, cx, base + w * 0.03, w * 0.6, w * 0.07, P.shadow);
  let y = base;
  layers.forEach((kind, index) => {
    y -= drawLayer(ctx, kind, cx, y, w, kind === 'bun' && index > 0) * 0.94;
  });
}

function drawPlate(ctx, cx, y, w) {
  ellipse(ctx, cx, y + 4, w * 0.62, w * 0.13, P.shadow);
  ellipse(ctx, cx, y, w * 0.6, w * 0.12, '#f4f1ea');
  ellipse(ctx, cx, y - 1, w * 0.42, w * 0.075, '#ffffff');
}

/** A loose ingredient or held item, centred on (cx, cy) about `s` pixels across. */
export function drawItem(ctx, item, cx, cy, s) {
  const kind = item.kind ?? item;
  if (kind === 'plate') {
    drawPlate(ctx, cx, cy + s * 0.35, s);
    drawBurger(ctx, item.layers, cx, cy + s * 0.3, s * 0.78);
  } else if (kind === 'bun') {
    drawLayer(ctx, 'bun', cx, cy + s * 0.35, s * 0.9);
    drawLayer(ctx, 'bun', cx, cy + s * 0.18, s * 0.9, true);
  } else if (kind === 'patty' || kind === 'burnt') {
    drawLayer(ctx, 'patty', cx, cy + s * 0.1, s * 0.9, false, kind === 'burnt' ? PATTY_BURNT : null);
  } else if (kind === 'cheese') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.2);
    box(ctx, -s * 0.38, -s * 0.38, s * 0.76, s * 0.76, s * 0.06, INGREDIENTS.cheese.color, INGREDIENTS.cheese.dark);
    ellipse(ctx, -s * 0.12, -s * 0.1, s * 0.07, s * 0.07, '#e8ae1c');
    ellipse(ctx, s * 0.16, s * 0.14, s * 0.05, s * 0.05, '#e8ae1c');
    ctx.restore();
  } else if (kind === 'lettuce') {
    ellipse(ctx, cx, cy, s * 0.42, s * 0.36, INGREDIENTS.lettuce.dark);
    ellipse(ctx, cx - s * 0.06, cy - s * 0.04, s * 0.32, s * 0.27, INGREDIENTS.lettuce.color);
    ellipse(ctx, cx + s * 0.08, cy + s * 0.02, s * 0.16, s * 0.13, '#a6e07f');
  } else if (kind === 'wholeTomato') {
    ellipse(ctx, cx, cy, s * 0.4, s * 0.36, INGREDIENTS.tomato.color);
    ellipse(ctx, cx - s * 0.13, cy - s * 0.12, s * 0.09, s * 0.06, 'rgba(255,255,255,0.45)');
    ellipse(ctx, cx, cy - s * 0.32, s * 0.14, s * 0.06, '#3f8f2c');
  } else if (kind === 'tomato') {
    for (const dx of [-0.17, 0.17]) {
      ellipse(ctx, cx + dx * s, cy, s * 0.24, s * 0.24, INGREDIENTS.tomato.color);
      ellipse(ctx, cx + dx * s, cy, s * 0.17, s * 0.17, '#f07a6a');
      ellipse(ctx, cx + dx * s, cy, s * 0.05, s * 0.05, '#ffd9a8');
    }
  } else if (kind === 'wholeOnion') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.46);
    ctx.quadraticCurveTo(cx + s * 0.5, cy - s * 0.05, cx, cy + s * 0.38);
    ctx.quadraticCurveTo(cx - s * 0.5, cy - s * 0.05, cx, cy - s * 0.46);
    ctx.fillStyle = '#a868b5';
    ctx.fill();
    ellipse(ctx, cx - s * 0.1, cy - s * 0.02, s * 0.07, s * 0.14, 'rgba(255,255,255,0.35)');
  } else if (kind === 'onion') {
    for (const r of [0.36, 0.27, 0.18]) {
      ctx.beginPath();
      ctx.arc(cx, cy, s * r, 0, Math.PI * 2);
      ctx.strokeStyle = INGREDIENTS.onion.dark;
      ctx.lineWidth = s * 0.06;
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------- the kitchen

function drawCounters(ctx) {
  box(ctx, KITCHEN.x, KITCHEN.y, KITCHEN.w, KITCHEN.h, 10, P.night);
  for (let y = 334; y < 604; y += 45) {
    for (let x = 16; x < 900; x += 45) {
      ctx.fillStyle = ((x - 16) / 45 + (y - 334) / 45) % 2 ? P.tileB : P.tileA;
      ctx.fillRect(x, y, 45, Math.min(45, 604 - y));
    }
  }
  ctx.fillStyle = P.counter;
  ctx.fillRect(16, 228, 884, 78);
  ctx.fillStyle = P.wood;
  ctx.fillRect(16, 306, 884, 28);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(16, 334, 884, 8);
  ctx.fillStyle = P.counter;
  ctx.fillRect(16, 604, 884, 60);
  ctx.fillStyle = P.wood;
  ctx.fillRect(16, 664, 884, 40);
  ctx.fillStyle = P.counterEdge;
  ctx.fillRect(16, 604, 884, 4);
}

function stationSign(ctx, station, y) {
  const cx = station.x + station.w / 2;
  box(ctx, cx - 44, y - 11, 88, 22, 6, P.woodDark);
  text(ctx, station.label, cx, y + 1, 14, P.cream);
}

function squash(ctx, station, draw) {
  const s = station.bump;
  const cx = station.x + station.w / 2;
  const base = station.y + station.h;
  ctx.save();
  ctx.translate(cx, base);
  ctx.scale(1 + 0.08 * s, 1 - 0.12 * s);
  ctx.translate(-cx, -base);
  draw();
  ctx.restore();
}

function drawBin(ctx, station) {
  squash(ctx, station, () => {
    box(ctx, station.x + 6, station.y + 6, station.w - 12, 62, 8, P.steelDark);
    box(ctx, station.x + 10, station.y + 10, station.w - 20, 54, 6, P.steel);
    const s = station.w * 0.3;
    for (let i = 0; i < 3; i += 1) drawItem(ctx, station.item, station.x + station.w * (0.27 + i * 0.23), station.y + 38 - (i % 2) * 6, s);
  });
  stationSign(ctx, station, 320);
}

function drawGrill(ctx, station, grill, time) {
  squash(ctx, station, () => {
    box(ctx, station.x + 4, station.y + 2, station.w - 8, 70, 8, '#2c2624');
    box(ctx, station.x + 10, station.y + 8, station.w - 20, 58, 5, '#47403c');
    const glow = ctx.createLinearGradient(0, station.y + 30, 0, station.y + 70);
    glow.addColorStop(0, 'rgba(255,120,40,0)');
    glow.addColorStop(1, `rgba(255,120,40,${0.35 + 0.1 * Math.sin(time * 6)})`);
    ctx.fillStyle = glow;
    ctx.fillRect(station.x + 10, station.y + 8, station.w - 20, 58);
    ctx.strokeStyle = '#1c1816';
    ctx.lineWidth = 3;
    for (let x = station.x + 18; x < station.x + station.w - 12; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, station.y + 12);
      ctx.lineTo(x, station.y + 62);
      ctx.stroke();
    }
    grill.slots.forEach((slot, i) => {
      const cx = station.x + 42 + i * 76;
      if (!slot) return;
      drawLayer(ctx, 'patty', cx, station.y + 50, 58, false, pattyColor(slot.t));
      const state = pattyState(slot);
      const progress = state === 'raw' ? slot.t / GRILL.cookTime : state === 'cooked' ? 1 : 1;
      ctx.beginPath();
      ctx.arc(cx, station.y + 20, 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.strokeStyle = state === 'raw' ? P.mustard : state === 'cooked' ? '#7fdc5a' : P.red;
      ctx.lineWidth = 4;
      ctx.stroke();
      for (let k = 0; k < 3; k += 1) {
        const phase = (time * 0.9 + k / 3 + i * 0.17) % 1;
        const alpha = (state === 'burnt' ? 0.55 : 0.35) * (1 - phase);
        ellipse(ctx, cx - 14 + k * 14 + Math.sin(time * 3 + k) * 4, station.y + 36 - phase * 46, 6 + phase * 8, 5 + phase * 6, state === 'burnt' ? `rgba(40,30,30,${alpha})` : `rgba(255,255,255,${alpha})`);
      }
    });
  });
  stationSign(ctx, station, 320);
}

function drawPass(ctx, station, round, time) {
  box(ctx, station.x, 228, 100, 376, 8, '#5c3a26');
  const light = ctx.createLinearGradient(0, 240, 0, 600);
  light.addColorStop(0, '#ffd27a');
  light.addColorStop(1, '#e8894a');
  box(ctx, station.x + 10, 262, 80, 330, 6, light);
  for (let i = 0; i < 4; i += 1) ellipse(ctx, station.x + 24 + i * 18, 300 + (i % 2) * 22, 6, 6, 'rgba(120,60,30,0.25)');
  box(ctx, station.x + 4, 236, 92, 22, 6, P.red);
  text(ctx, 'PASS', station.x + 50, 248, 15, P.cream);
  ellipse(ctx, station.x + 50, 274, 30, 8, `rgba(255,190,90,${0.35 + 0.15 * Math.sin(time * 4)})`);
  round.pass.forEach((plate, i) => {
    const y = 360 + i * 92;
    box(ctx, station.x + 2, y + 8, 96, 8, 3, P.steel);
    drawItem(ctx, { kind: 'plate', layers: plate.layers }, station.x + 50, y - 22, 64);
    if (plate.ticket) {
      box(ctx, station.x + 6, y - 74, 88, 20, 6, P.green);
      text(ctx, 'ORDER UP!', station.x + 50, y - 63, 12, '#fff');
    } else {
      box(ctx, station.x + 10, y - 74, 80, 20, 6, P.mustard);
      text(ctx, 'READY', station.x + 50, y - 63, 12, P.ink);
    }
  });
  ellipse(ctx, station.x + 50, 594, 16, 5, P.steelDark);
  ctx.beginPath();
  ctx.arc(station.x + 50, 592, 12, Math.PI, 0);
  ctx.fillStyle = P.mustard;
  ctx.fill();
}

function drawChopBlock(ctx, station, chef) {
  squash(ctx, station, () => {
    box(ctx, station.x + 8, station.y + 2, station.w - 16, 46, 10, '#c48a56', '#8d5c33');
    ctx.save();
    ctx.translate(station.x + station.w - 44, station.y + 22);
    ctx.rotate(-0.5 + station.bump * 0.6);
    box(ctx, -4, -6, 44, 12, 3, '#dfe6ea');
    box(ctx, -26, -5, 24, 10, 3, '#3b2a20');
    ctx.restore();
    const held = chef.holding;
    if (chef.focus === station && held && held.chops !== undefined && held.kind.startsWith('whole')) {
      for (let i = 0; i < CHOP_TAPS; i += 1) ellipse(ctx, station.x + 40 + i * 22, station.y + 26, 7, 7, i < held.chops ? P.mustard : 'rgba(0,0,0,0.25)');
    }
  });
  stationSign(ctx, station, 684);
}

function drawBoardStation(ctx, station, round) {
  squash(ctx, station, () => {
    box(ctx, station.x + 10, station.y + 4, station.w - 80, 44, 12, '#dcae74', '#a87843');
    drawBurger(ctx, round.board, station.x + 10 + (station.w - 80) / 2, station.y + 38, 70);
    for (let i = 0; i < 4; i += 1) ellipse(ctx, station.x + station.w - 36, station.y + 40 - i * 6, 28, 7, i === 3 ? '#ffffff' : '#e8e3d8');
  });
  stationSign(ctx, station, 684);
}

function drawTrash(ctx, station) {
  squash(ctx, station, () => {
    box(ctx, station.x + 18, station.y - 4, station.w - 36, 54, 6, '#596168');
    box(ctx, station.x + 12, station.y - 10, station.w - 24, 10, 4, '#3f464c');
  });
  stationSign(ctx, station, 684);
}

function drawChef(ctx, chef, time) {
  const { x, y } = chef;
  const s = chef.bump;
  const step = Math.sin(chef.walk) * 5;
  ellipse(ctx, x, y + 2, 26, 7, P.shadow);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1 + 0.1 * s, 1 - 0.1 * s);
  box(ctx, -14, -24 + Math.max(0, step), 11, 24, 4, '#3a2a24');
  box(ctx, 3, -24 + Math.max(0, -step), 11, 24, 4, '#3a2a24');
  box(ctx, -22, -66, 44, 46, 14, '#ffffff', '#d8d0c4');
  box(ctx, -14, -46, 28, 26, 6, P.red);
  ellipse(ctx, 0, -82, 16, 16, '#f1c08a');
  ellipse(ctx, chef.facing * 5 - 5, -84, 2.2, 2.6, P.ink);
  ellipse(ctx, chef.facing * 5 + 5, -84, 2.2, 2.6, P.ink);
  box(ctx, -9 + chef.facing * 3, -77, 18, 5, 3, '#5a3320');
  box(ctx, -15, -100, 30, 10, 3, '#ffffff', '#d8d0c4');
  ellipse(ctx, -10, -108, 10, 10, '#ffffff');
  ellipse(ctx, 10, -108, 10, 10, '#ffffff');
  ellipse(ctx, 0, -114, 12, 12, '#ffffff');
  ctx.restore();
  if (chef.holding) {
    const bob = Math.sin(time * 6) * 1.5;
    drawItem(ctx, chef.holding, x + chef.facing * 4, y - 52 + bob, 40);
  }
}

function drawFocus(ctx, chef, time) {
  const station = chef.focus;
  if (!station) return;
  const cx = station.kind === 'pass' ? station.x + 50 : station.x + station.w / 2;
  const cy = station.kind === 'pass' ? 340 : station.y + station.h / 2;
  ctx.strokeStyle = `rgba(255,236,160,${0.6 + 0.3 * Math.sin(time * 8)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(station.x + 2, station.y - 2, station.w - 4, station.h - 4, 10);
  ctx.stroke();
  box(ctx, cx - 13, cy - 64, 26, 26, 6, P.cream, P.ink);
  text(ctx, 'E', cx, cy - 50, 16, P.ink);
}

function drawKitchen(ctx, round, time) {
  drawCounters(ctx);
  for (const station of round.kitchen.stations) {
    if (station.kind === 'bin') drawBin(ctx, station);
    else if (station.kind === 'grill') drawGrill(ctx, station, round.kitchen.grill, time);
    else if (station.kind === 'pass') drawPass(ctx, station, round, time);
  }
  drawChef(ctx, round.chef, time);
  for (const station of round.kitchen.stations) {
    if (station.kind === 'chop') drawChopBlock(ctx, station, round.chef);
    else if (station.kind === 'board') drawBoardStation(ctx, station, round);
    else if (station.kind === 'trash') drawTrash(ctx, station);
  }
  drawFocus(ctx, round.chef, time);
}

// ---------------------------------------------------------------- orders and HUD

function drawTicket(ctx, ticket, x, y, time) {
  const urgent = ticket.state === 'open' && ticket.left / ticket.patience < 0.25;
  const shake = urgent ? Math.sin(time * 40) * 1.5 : 0;
  const drop = Math.max(0, 1 - ticket.age * 4) * -30;
  ctx.save();
  ctx.translate(x + shake, y + drop);
  box(ctx, 0, 0, 140, 146, 6, P.paper, '#d8cbb0');
  box(ctx, 52, -6, 36, 12, 3, P.steelDark);
  text(ctx, ticket.recipe.name, 8, 20, 14, P.ink, 'left');
  text(ctx, `$${ticket.recipe.price}`, 132, 20, 15, P.teal, 'right');
  const layers = ['bun', ...ticket.recipe.fillings, 'bun'];
  drawBurger(ctx, layers, 48, 120, 62);
  ticket.recipe.fillings.forEach((kind, i) => {
    box(ctx, 96, 38 + i * 16, 36, 13, 4, INGREDIENTS[kind].color);
    text(ctx, INGREDIENTS[kind].label.slice(0, 3).toUpperCase(), 114, 45 + i * 16, 9, kind === 'onion' ? '#6b3a78' : '#ffffff');
  });
  const fraction = ticket.state === 'open' ? Math.max(0, ticket.left / ticket.patience) : 1;
  box(ctx, 8, 130, 124, 9, 4, '#e7dcc6');
  box(ctx, 8, 130, Math.max(8, 124 * fraction), 9, 4, fraction > 0.5 ? P.green : fraction > 0.25 ? P.mustard : P.red);
  if (ticket.state === 'up') {
    ctx.rotate(-0.25);
    box(ctx, 6, 70, 116, 30, 6, 'rgba(76,175,80,0.9)');
    text(ctx, 'ORDER UP!', 64, 86, 17, '#ffffff');
  }
  ctx.restore();
}

function drawOrderRail(ctx, round, time) {
  box(ctx, 16, 60, 756, 160, 10, '#b4875a');
  box(ctx, 16, 60, 756, 14, 6, P.steel);
  text(ctx, 'ORDERS', 30, 67, 11, P.ink, 'left');
  round.tickets.slice(0, 5).forEach((ticket, i) => drawTicket(ctx, ticket, 24 + i * 150, 72, time));
  if (!round.tickets.length) text(ctx, 'Waiting for customers…', 394, 140, 20, 'rgba(255,246,230,0.8)');
}

function drawClockPanel(ctx, round, time) {
  box(ctx, 782, 60, 218, 160, 10, P.ink);
  const left = Math.ceil(round.timeLeft);
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const hurry = round.timeLeft <= 15;
  const pulse = hurry ? 1 + 0.08 * Math.max(0, Math.sin(time * 10)) : 1;
  text(ctx, 'SHIFT CLOCK', 891, 78, 12, P.mustard);
  ctx.save();
  ctx.translate(891, 116);
  ctx.scale(pulse, pulse);
  text(ctx, clock, 0, 0, 50, hurry ? '#ff6b5e' : P.cream, 'center', 900);
  ctx.restore();
  box(ctx, 798, 146, 186, 10, 5, '#4a3328');
  box(ctx, 798, 146, Math.max(10, 186 * (round.timeLeft / ROUND_SECONDS)), 10, 5, hurry ? P.red : P.mustard);
  const stage = rushStage(round.elapsed);
  text(ctx, stage.label, 891, 178, 17, stage.index === 2 ? '#ff8a5e' : P.cream);
  for (let i = 0; i < 3; i += 1) box(ctx, 852 + i * 28, 196, 22, 10, 4, i <= stage.index ? P.red : '#4a3328');
}

function drawTopBar(ctx, round) {
  ctx.fillStyle = P.night;
  ctx.fillRect(0, 0, VIEW.width, 52);
  drawBurger(ctx, ['bun', 'patty', 'cheese', 'lettuce', 'bun'], 38, 40, 36);
  text(ctx, 'BETWEEN THE BUNS', 66, 27, 24, P.mustard, 'left', 900);
  text(ctx, 'CASH', 470, 27, 14, '#c9b79a', 'right');
  text(ctx, `$${round.cash}`, 480, 27, 32, '#9be37a', 'left', 900);
  text(ctx, `tips $${round.tips}`, 600, 28, 15, '#c9b79a', 'left');
  text(ctx, `served ${round.served}`, 720, 28, 15, '#c9b79a', 'left');
  const comboColor = round.combo >= 3 ? P.red : round.combo >= 1 ? P.mustard : '#4a3328';
  box(ctx, 860, 10, 140, 32, 16, comboColor);
  text(ctx, round.combo ? `COMBO x${round.combo}` : 'NO COMBO', 930, 27, 16, round.combo ? P.ink : '#9c8a74');
  text(ctx, 'WASD/arrows move · E/Space use · click a station', 1264, 27, 13, '#9c8a74', 'right', 600);
}

function drawBuildPanel(ctx, round) {
  box(ctx, 1012, 60, 252, 414, 12, P.ink);
  text(ctx, 'ON THE BOARD', 1138, 82, 16, P.mustard);
  box(ctx, 1026, 404, 224, 34, 14, '#dcae74', '#a87843');
  const bump = round.boardBump;
  ctx.save();
  ctx.translate(1138, 420);
  ctx.scale(1 + 0.08 * bump, 1 - 0.1 * bump);
  ctx.translate(-1138, -420);
  drawBurger(ctx, round.board, 1138, 420, 170);
  ctx.restore();
  const count = round.board.length;
  let hint = 'Start with a bun';
  if (isClosed(round.board)) hint = 'Closed! Plate it at BUILD';
  else if (count === 1) hint = 'Add fillings';
  else if (count > 1) hint = 'Add more, or a bun to close';
  if (!count) text(ctx, 'empty board', 1138, 250, 18, '#7d6a58');
  text(ctx, `${count} layer${count === 1 ? '' : 's'}`, 1138, 108, 22, P.cream);
  text(ctx, hint, 1138, 456, 14, '#c9b79a', 'center', 700);
}

function drawHandsPanel(ctx, round, time) {
  box(ctx, 1012, 486, 252, 218, 12, P.ink);
  text(ctx, 'IN HAND', 1076, 506, 14, P.mustard);
  box(ctx, 1026, 520, 100, 100, 10, '#3a2620');
  if (round.chef.holding) drawItem(ctx, round.chef.holding, 1076, 570, 64);
  else text(ctx, 'empty', 1076, 570, 15, '#7d6a58');
  const ready = round.pass.length;
  const lit = ready > 0;
  text(ctx, 'PLATE READY', 1196, 506, 14, P.mustard);
  ellipse(ctx, 1196, 560, 34, 34, lit ? `rgba(155,227,122,${0.75 + 0.25 * Math.sin(time * 6)})` : '#3a2620');
  text(ctx, String(ready), 1196, 561, 30, lit ? P.ink : '#7d6a58', 'center', 900);
  text(ctx, lit ? 'on the pass' : 'none yet', 1196, 608, 13, '#c9b79a', 'center', 700);
  const counts = grillCounts(round.kitchen.grill);
  const grillLine = counts.burnt ? `${counts.burnt} burning on grill!` : counts.cooked ? `${counts.cooked} patty ready on grill` : counts.raw ? `${counts.raw} patty sizzling` : 'grill is empty';
  text(ctx, grillLine, 1138, 646, 15, counts.burnt ? '#ff8a7a' : P.cream, 'center', 700);
  text(ctx, `walk-outs ${round.missed} · best combo x${round.bestCombo}`, 1138, 676, 13, '#9c8a74', 'center', 600);
}

function drawPopups(ctx, round) {
  for (const popup of round.popups) {
    ctx.globalAlpha = Math.max(0, 1 - popup.age / 1.4);
    const y = popup.y - popup.age * 40;
    ctx.font = `900 18px ${FONT}`;
    const w = ctx.measureText(popup.text).width + 16;
    box(ctx, popup.x - w / 2, y - 13, w, 26, 8, 'rgba(30,18,13,0.8)');
    text(ctx, popup.text, popup.x, y, 18, popup.color, 'center', 900);
  }
  ctx.globalAlpha = 1;
}

function drawRushBanner(ctx, round) {
  const stage = rushStage(round.elapsed);
  const since = round.elapsed - stage.at;
  if (stage.index === 0 || since > 2.5) return;
  ctx.globalAlpha = Math.min(1, (2.5 - since) * 2);
  box(ctx, 250, 420, 420, 70, 14, 'rgba(216,69,59,0.92)');
  text(ctx, `${stage.label}!`, 460, 448, 36, P.cream, 'center', 900);
  text(ctx, 'orders are coming faster', 460, 476, 15, P.cream, 'center', 700);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- overlays

function drawTitle(ctx, time) {
  ctx.fillStyle = 'rgba(30,18,13,0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  box(ctx, 300, 120, 680, 480, 24, P.cream, P.wood);
  const bob = Math.sin(time * 2) * 4;
  drawBurger(ctx, ['bun', 'patty', 'cheese', 'lettuce', 'tomato', 'onion', 'bun'], 640, 330 + bob, 190);
  text(ctx, 'BETWEEN THE BUNS', 640, 380, 52, P.red, 'center', 900);
  text(ctx, 'a short-order diner rush', 640, 422, 20, P.wood, 'center', 700);
  text(ctx, 'Grill patties · chop veg · stack the ticket · plate it · slide it to the pass', 640, 466, 16, P.ink, 'center', 600);
  text(ctx, 'Move WASD / arrows  ·  Use E or Space  ·  or click a station', 640, 494, 16, P.ink, 'center', 600);
  const blink = 0.6 + 0.4 * Math.sin(time * 4);
  box(ctx, 470, 528, 340, 48, 24, `rgba(216,69,59,${blink})`);
  text(ctx, 'Press ENTER to open the diner', 640, 553, 20, P.cream, 'center', 900);
}

/** 0 to 3 stars for a shift's takings. */
export function starsFor(cash) {
  return cash >= 120 ? 3 : cash >= 70 ? 2 : cash >= 30 ? 1 : 0;
}

function drawSummary(ctx, round) {
  ctx.fillStyle = 'rgba(30,18,13,0.66)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  box(ctx, 340, 90, 600, 540, 24, P.cream, P.wood);
  text(ctx, 'SHIFT OVER', 640, 140, 46, P.red, 'center', 900);
  const stars = starsFor(round.cash);
  const titles = ['Dish Pit Rookie', 'Line Cook', 'Grill Master', 'Burger Legend'];
  for (let i = 0; i < 3; i += 1) {
    ctx.save();
    ctx.translate(570 + i * 70, 205);
    ctx.beginPath();
    for (let k = 0; k < 10; k += 1) {
      const r = k % 2 ? 12 : 28;
      ctx.lineTo(Math.cos(-Math.PI / 2 + (k * Math.PI) / 5) * r, Math.sin(-Math.PI / 2 + (k * Math.PI) / 5) * r);
    }
    ctx.closePath();
    ctx.fillStyle = i < stars ? P.mustard : '#d9ccb4';
    ctx.fill();
    ctx.restore();
  }
  text(ctx, titles[stars], 640, 256, 24, P.wood, 'center', 900);
  const rows = [
    ['Burgers served', String(round.served)],
    ['Tips earned', `$${round.tips}`],
    ['Neat stacks', String(round.neat)],
    ['Best combo', `x${round.bestCombo}`],
    ['Walk-outs', String(round.missed)],
  ];
  rows.forEach(([name, value], i) => {
    const y = 300 + i * 40;
    box(ctx, 400, y - 16, 480, 32, 8, i % 2 ? '#f6ead2' : '#efe0c2');
    text(ctx, name, 420, y, 19, P.ink, 'left', 700);
    text(ctx, value, 860, y, 21, P.ink, 'right', 900);
  });
  text(ctx, 'TAKINGS', 640, 518, 16, P.wood);
  text(ctx, `$${round.cash}`, 640, 552, 44, P.teal, 'center', 900);
  text(ctx, 'Press ENTER for another shift', 640, 600, 17, P.red, 'center', 800);
}

/** Paints one whole frame for the given screen. `time` drives idle animation only. */
export function drawFrame(ctx, round, screen, time) {
  ctx.fillStyle = '#3b2418';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  drawTopBar(ctx, round);
  drawOrderRail(ctx, round, time);
  drawClockPanel(ctx, round, time);
  drawKitchen(ctx, round, time);
  drawBuildPanel(ctx, round);
  drawHandsPanel(ctx, round, time);
  drawPopups(ctx, round);
  drawRushBanner(ctx, round);
  if (screen === SCREEN_TITLE) drawTitle(ctx, time);
  if (screen === SCREEN_OVER) drawSummary(ctx, round);
}
