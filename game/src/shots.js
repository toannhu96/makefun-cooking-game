// The screenshot scenes behind ?shot=start|play|end. Each plays the real rules forward from the seed
// with the demo chef, so the frame is a real moment of a real shift and a seed always gives the same
// frame. The play scene looks for the brief's mid-rush moment (0:48 on the clock, two open tickets,
// a three-layer burger on the board, a plate waiting on the pass, a patty on the grill, about $37)
// across a few demo-chef paces, then replays the best one to that exact step.
import { RECIPES, ROUND_SECONDS, STEP } from './config.js';
import { autoChefControls, cookAhead, createAutoChef } from './autochef.js';
import { grillCounts } from './kitchen.js';
import { openTickets, rushStage } from './recipes.js';
import { createRound, stepRound } from './round.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const PACES = [0.1, 0.14, 0.18, 0.22, 0.26];
const PREP_AT = [76, 72, 68, 64, 60];
const TARGET = { clock: 48, cash: 37 };

/** A tier-appropriate recipe nobody has ordered yet, to cook ahead for the pass. */
function recipeToPrep(round) {
  const stage = rushStage(round.elapsed);
  const ordered = new Set(round.tickets.map((ticket) => ticket.recipe));
  return RECIPES.find((recipe) => recipe.tier <= stage.tier && !ordered.has(recipe)) ?? RECIPES[0];
}

/** How close a frame is to the brief's play scene; higher is better. */
function playScore(round) {
  const grill = grillCounts(round.kitchen.grill);
  const open = openTickets(round).length;
  let score = 0;
  if (round.board.length === 3) score += 4;
  if (round.pass.length >= 1) score += 4;
  score += open === 2 ? 3 : open >= 1 ? 1 : 0;
  if (grill.raw + grill.cooked > 0) score += 2;
  return score + 3 - Math.min(3, Math.abs(round.cash - TARGET.cash) / 3);
}

/** Plays one variant; stops at `stopAt` steps, or runs through the 0:48 window and reports its best step. */
function playVariant(seed, pace, prepAt, stopAt = Infinity) {
  const round = createRound(seed);
  const bot = createAutoChef({ pause: pace, holdAt: 3 });
  let queued = false;
  let best = { score: -Infinity, step: 0 };
  for (let step = 1; step <= stopAt; step += 1) {
    if (!queued && round.timeLeft <= prepAt) {
      cookAhead(bot, recipeToPrep(round));
      queued = true;
    }
    stepRound(round, STEP, autoChefControls(round, bot, STEP));
    round.events.length = 0;
    if (round.timeLeft <= TARGET.clock && round.timeLeft > TARGET.clock - 1) {
      const score = playScore(round);
      if (score > best.score) best = { score, step };
    } else if (round.timeLeft <= TARGET.clock - 1) break;
  }
  return { round, best };
}

function stagePlay(seed) {
  let pick = null;
  for (const pace of PACES) {
    for (const prepAt of PREP_AT) {
      const { best } = playVariant(seed, pace, prepAt);
      if (!pick || best.score > pick.score) pick = { ...best, pace, prepAt };
    }
  }
  return playVariant(seed, pick.pace, pick.prepAt, pick.step).round;
}

/** Plays the demo chef from the start for `seconds` (the whole shift when longer than it). */
function playFor(seed, seconds, pace = 0.12) {
  const round = createRound(seed);
  const bot = createAutoChef({ pause: pace });
  const steps = Math.round(Math.min(seconds, ROUND_SECONDS + 1) / STEP);
  for (let i = 0; i < steps && !round.over; i += 1) {
    stepRound(round, STEP, autoChefControls(round, bot, STEP));
    round.events.length = 0;
  }
  return round;
}

/** The round and screen for a named scene, or null for an unknown name. */
export function stageShot(name, seed) {
  if (name === 'start') return { round: playFor(seed, 6), screen: SCREEN_TITLE, time: 0.4 };
  if (name === 'play') return { round: stagePlay(seed), screen: SCREEN_PLAY, time: 0.7 };
  if (name === 'end') return { round: playFor(seed, ROUND_SECONDS + 1), screen: SCREEN_OVER, time: 0 };
  return null;
}
