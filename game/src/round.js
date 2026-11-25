// One service shift: the round state, what using each station does with the chef's hands, the pass
// where plates wait for a runner, ticket spawning and expiry, pay, combos and the shift clock.
// Pure rules with no drawing or DOM, so the screenshot scenes and the demo chef play the same game.
import { CHOPS_INTO, CHOP_TAPS, PASS_SLOTS, PAY, ROUND_SECONDS, RUNNER_DELAY, TICKETS } from './config.js';
import { createRng } from './random.js';
import { createChef, createKitchen, grillDrop, grillTake, moveChef, nearestStation, steerToward, updateGrill } from './kitchen.js';
import { canStack, isClosed } from './burger.js';
import { findTicketFor, openTickets, payoutFor, rushStage, spawnTicket, updateTickets } from './recipes.js';

export function createRound(seed) {
  return {
    seed,
    rng: createRng(seed),
    elapsed: 0,
    timeLeft: ROUND_SECONDS,
    cash: 0,
    tips: 0,
    served: 0,
    missed: 0,
    combo: 0,
    bestCombo: 0,
    neat: 0,
    kitchen: createKitchen(),
    chef: createChef(),
    board: [],
    tickets: [],
    ticketSeq: 0,
    nextTicketIn: 1,
    pass: [],
    events: [],
    popups: [],
    boardBump: 0,
    over: false,
  };
}

function emit(round, type, text, x, y, color) {
  round.events.push({ type });
  if (text) round.popups.push({ text, x, y, color: color ?? '#fff6e6', age: 0 });
}

/** One fixed step of the shift. `controls` is { dx, dy, use } from the keyboard, mouse or demo chef. */
export function stepRound(round, dt, controls) {
  if (round.over) return;
  const chef = round.chef;
  round.elapsed += dt;
  round.timeLeft = Math.max(0, ROUND_SECONDS - round.elapsed);

  let { dx, dy, use } = controls;
  if (dx || dy) chef.target = null;
  else if (chef.target) {
    const steer = steerToward(chef, chef.target);
    ({ dx, dy } = steer);
    if (steer.arrived) {
      use = true;
      chef.target = null;
    }
  }
  moveChef(chef, dx, dy, dt);
  chef.focus = nearestStation(chef, round.kitchen.stations);
  if (use) useStation(round);

  for (const change of updateGrill(round.kitchen.grill, dt)) {
    const x = 164 + 40 + change.index * 78;
    if (change.state === 'cooked') emit(round, 'ready', 'DONE!', x, 250, '#f2b33d');
    if (change.state === 'burnt') emit(round, 'burn', 'BURNT!', x, 250, '#d8453b');
  }

  round.nextTicketIn -= dt;
  if (round.nextTicketIn <= 0) {
    const stage = rushStage(round.elapsed);
    if (openTickets(round).length < TICKETS.max) {
      spawnTicket(round);
      round.events.push({ type: 'order' });
    }
    round.nextTicketIn = stage.every * (0.8 + round.rng() * 0.4);
  }
  for (const ticket of updateTickets(round, dt)) {
    round.missed += 1;
    round.combo = 0;
    round.cash = Math.max(0, round.cash - PAY.missPenalty);
    emit(round, 'miss', `${ticket.recipe.name} walked out  -$${PAY.missPenalty}`, 380, 222, '#ff8a7a');
  }
  updatePass(round, dt);

  for (const station of round.kitchen.stations) station.bump = Math.max(0, station.bump - dt * 5);
  chef.bump = Math.max(0, chef.bump - dt * 5);
  round.boardBump = Math.max(0, round.boardBump - dt * 4);
  for (const popup of round.popups) popup.age += dt;
  round.popups = round.popups.filter((popup) => popup.age < 1.4);

  if (round.timeLeft <= 0) {
    round.over = true;
    round.events.push({ type: 'whistle' });
  }
}

/** Plates on the pass: a matching ticket claims one, and the runner takes it out after a beat. */
function updatePass(round, dt) {
  for (const plate of round.pass) {
    if (!plate.ticket) {
      const found = findTicketFor(round.tickets, plate.layers);
      if (found) {
        plate.ticket = found.ticket;
        plate.neat = found.neat;
        plate.wait = RUNNER_DELAY;
        found.ticket.state = 'up';
        round.events.push({ type: 'bell' });
      }
    } else {
      plate.wait -= dt;
      if (plate.wait <= 0) servePlate(round, plate);
    }
  }
  round.pass = round.pass.filter((plate) => !plate.done);
}

function servePlate(round, plate) {
  const pay = payoutFor(plate.ticket, plate.neat, round.combo);
  plate.done = true;
  round.tickets = round.tickets.filter((ticket) => ticket !== plate.ticket);
  round.cash += pay.total;
  round.tips += pay.tip;
  round.served += 1;
  round.combo += 1;
  round.bestCombo = Math.max(round.bestCombo, round.combo);
  if (plate.neat) round.neat += 1;
  emit(round, 'serve', `+$${pay.total}${round.combo > 1 ? `  x${round.combo} COMBO` : ''}`, 860, 300, '#9be37a');
}

/** Uses the station in reach with whatever the chef is holding. */
export function useStation(round) {
  const chef = round.chef;
  const station = chef.focus;
  if (!station) return;
  const held = chef.holding;
  const kind = held?.kind;
  const at = { x: station.x + station.w / 2, y: station.y - 6 };
  const deny = (why) => emit(round, 'deny', why, at.x, at.y, '#ffb3a8');
  station.bump = 1;
  chef.bump = 1;

  if (station.kind === 'bin') {
    if (!held) {
      chef.holding = { kind: station.item, chops: 0 };
      emit(round, 'pick');
    } else if (kind === station.item) {
      chef.holding = null;
      emit(round, 'place');
    } else deny('Hands full');
  } else if (station.kind === 'grill') {
    const grill = round.kitchen.grill;
    if (held) return deny(kind === 'burnt' ? 'Trash it!' : 'Hands full');
    const taken = grillTake(grill);
    if (taken) {
      chef.holding = { kind: taken };
      emit(round, 'pick');
    } else if (grillDrop(grill)) emit(round, 'sizzle', 'Sizzle!', at.x, at.y + 20, '#f2b33d');
    else deny('Still cooking');
  } else if (station.kind === 'chop') {
    if (!held || !CHOPS_INTO[kind]) return deny(held ? 'Nothing to chop' : 'Bring a tomato or onion');
    held.chops += 1;
    emit(round, 'chop');
    if (held.chops >= CHOP_TAPS) {
      chef.holding = { kind: CHOPS_INTO[kind] };
      emit(round, 'place', 'Chopped!', at.x, at.y, '#fff6e6');
    }
  } else if (station.kind === 'board') {
    if (held && kind !== 'plate') {
      if (!canStack(round.board, kind)) {
        if (CHOPS_INTO[kind]) return deny('Chop it first');
        if (kind === 'burnt') return deny('Burnt! Trash it');
        return deny(round.board.length === 0 ? 'Start with a bun' : 'Can\'t stack that');
      }
      round.board.push(kind);
      chef.holding = null;
      round.boardBump = 1;
      emit(round, isClosed(round.board) ? 'close' : 'place');
    } else if (!held && isClosed(round.board)) {
      chef.holding = { kind: 'plate', layers: round.board };
      round.board = [];
      emit(round, 'plate', 'Plated!', at.x, at.y, '#fff6e6');
    } else if (!held && round.board.length) {
      chef.holding = { kind: round.board.pop() };
      round.boardBump = 1;
      emit(round, 'pick');
    } else deny(held ? 'Hands full' : 'Bring a bun');
  } else if (station.kind === 'trash') {
    if (!held) return deny('Nothing to toss');
    chef.holding = null;
    emit(round, 'trash', 'Tossed', at.x, at.y, '#d9c3a5');
  } else if (station.kind === 'pass') {
    if (kind === 'plate') {
      if (round.pass.length >= PASS_SLOTS) return deny('Pass is full');
      round.pass.push({ layers: held.layers, ticket: null, wait: 0, neat: false });
      chef.holding = null;
      emit(round, 'place');
    } else if (!held) {
      const waiting = round.pass.filter((plate) => !plate.ticket);
      if (!waiting.length) return deny('Bring a plate');
      const plate = waiting[waiting.length - 1];
      round.pass = round.pass.filter((other) => other !== plate);
      chef.holding = { kind: 'plate', layers: plate.layers };
      emit(round, 'pick');
    } else deny('Plate it first');
  }
}
