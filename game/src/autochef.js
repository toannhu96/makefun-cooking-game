// The demo chef: a small planner that plays the real rules through the same { dx, dy, use } controls
// a player sends. It cooks for the oldest open ticket, keeps a patty on the grill ahead of need,
// chops veg, fixes wrong layers, plates and walks to the pass. It can also be told to cook one burger
// ahead for the pass and then hold mid-build. Drives the title attract mode and the screenshot scenes.
import { CHOPS_INTO } from './config.js';
import { isClosed } from './burger.js';
import { grillCounts, nearestStation, steerToward } from './kitchen.js';
import { recipeSequence } from './recipes.js';

const BIN_FOR = { bun: 'bun', cheese: 'cheese', lettuce: 'lettuce', tomato: 'tomato', onion: 'onion' };

/** `pause`: seconds between station uses. `holdAt`: once a cooked-ahead plate is out, stop building at this many layers. */
export function createAutoChef(options = {}) {
  return { recipe: null, pause: options.pause ?? 0.12, cooldown: 0, prepRecipe: null, prepped: false, holdAt: options.holdAt ?? 0 };
}

/** Asks the demo chef to cook `recipe` next, for the pass, whatever the tickets say. */
export function cookAhead(bot, recipe) {
  bot.prepRecipe = recipe;
}

function station(round, id) {
  return round.kitchen.stations.find((candidate) => candidate.id === id);
}

/** The recipe being cooked: kept while anything is in hand or on the board, else the next job. */
function chooseRecipe(round, bot) {
  const busy = round.board.length > 0 || round.chef.holding;
  if (bot.recipe && busy) return bot.recipe;
  if (bot.prepRecipe) bot.recipe = bot.prepRecipe;
  else bot.recipe = round.tickets.find((ticket) => ticket.state === 'open')?.recipe ?? null;
  return bot.recipe;
}

/** The station id the demo chef wants next, 'wait-grill' to stand by the grill, or null to idle. */
export function chooseGoal(round, bot) {
  const held = round.chef.holding?.kind;
  const recipe = chooseRecipe(round, bot);
  const board = round.board;
  const grill = grillCounts(round.kitchen.grill);
  const sequence = recipe ? recipeSequence(recipe) : null;
  const onTrack = sequence !== null && board.every((kind, i) => kind === sequence[i]);
  const need = onTrack ? sequence[board.length] : null;

  if (held === 'plate') return 'pass';
  if (held === 'burnt') return 'trash';
  if (held && CHOPS_INTO[held]) return 'chop';
  if (held) return held === need ? 'board' : 'trash';
  if (isClosed(board) || (board.length && !onTrack)) return 'board';
  if (grill.burnt) return 'grill';
  if (bot.holdAt && bot.prepped && board.length >= bot.holdAt) return grill.raw + grill.cooked === 0 ? 'grill' : null;
  if (!need) return null;
  const pattiesAhead = sequence.slice(board.length).filter((kind) => kind === 'patty').length;
  if (pattiesAhead > grill.raw + grill.cooked && grill.free) return 'grill';
  if (need === 'patty') return grill.cooked ? 'grill' : 'wait-grill';
  return BIN_FOR[need];
}

/** This step's controls for the demo chef. */
export function autoChefControls(round, bot, dt) {
  const idle = { dx: 0, dy: 0, use: false };
  if (bot.cooldown > 0) {
    bot.cooldown -= dt;
    return idle;
  }
  const goal = chooseGoal(round, bot);
  if (!goal) return idle;
  const target = station(round, goal === 'wait-grill' ? 'grill' : goal);
  const steer = steerToward(round.chef, target);
  if (!steer.arrived) return { dx: steer.dx, dy: steer.dy, use: false };
  if (goal === 'wait-grill' || nearestStation(round.chef, round.kitchen.stations) !== target) return idle;
  if (goal === 'pass' && bot.prepRecipe && bot.recipe === bot.prepRecipe) {
    bot.prepRecipe = null;
    bot.prepped = true;
  }
  bot.cooldown = bot.pause;
  return { dx: 0, dy: 0, use: true };
}
