// Orders: which rush stage the shift is in, drawing a recipe for a new ticket, ticking ticket
// patience down, finding the ticket a plated burger answers, and what that burger pays.
import { PAY, RECIPES, RUSH, TICKETS } from './config.js';
import { matchRecipe } from './burger.js';

/** The rush stage for `elapsed` seconds into the shift, with its index. */
export function rushStage(elapsed) {
  let index = 0;
  for (let i = 0; i < RUSH.length; i += 1) if (elapsed >= RUSH[i].at) index = i;
  return { ...RUSH[index], index };
}

/** The full stack a recipe asks for, buns included. */
export function recipeSequence(recipe) {
  return ['bun', ...recipe.fillings, 'bun'];
}

/** A recipe from the stage's menu; the newest dishes are ordered most. */
export function pickRecipe(rng, stage) {
  const menu = RECIPES.filter((recipe) => recipe.tier <= stage.tier);
  const weights = menu.map((recipe) => 1 + (recipe.tier === stage.tier ? 1.5 : 0));
  let roll = rng() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < menu.length; i += 1) {
    roll -= weights[i];
    if (roll < 0) return menu[i];
  }
  return menu[menu.length - 1];
}

/** Adds a new ticket to the rail and returns it. */
export function spawnTicket(round) {
  const stage = rushStage(round.elapsed);
  const recipe = pickRecipe(round.rng, stage);
  const patience = (TICKETS.basePatience + TICKETS.perFilling * recipe.fillings.length) * stage.patience;
  round.ticketSeq += 1;
  const ticket = { id: round.ticketSeq, recipe, patience, left: patience, state: 'open', age: 0 };
  round.tickets.push(ticket);
  return ticket;
}

export function openTickets(round) {
  return round.tickets.filter((ticket) => ticket.state === 'open');
}

/** Ticks every open ticket down; removes and returns the ones whose customer walked out. */
export function updateTickets(round, dt) {
  const expired = [];
  for (const ticket of round.tickets) {
    ticket.age += dt;
    if (ticket.state !== 'open') continue;
    ticket.left -= dt;
    if (ticket.left <= 0) expired.push(ticket);
  }
  if (expired.length) round.tickets = round.tickets.filter((ticket) => !expired.includes(ticket));
  return expired;
}

/** The oldest open ticket this burger answers, and whether it is stacked neatly. */
export function findTicketFor(tickets, layers) {
  for (const ticket of tickets) {
    if (ticket.state !== 'open') continue;
    const match = matchRecipe(layers, ticket.recipe);
    if (match) return { ticket, neat: match.neat };
  }
  return null;
}

/** Price, plus a tip that shrinks as the ticket waits and grows with the combo streak. */
export function payoutFor(ticket, neat, combo) {
  const speed = Math.max(0, ticket.left / ticket.patience);
  const streak = 1 + PAY.comboStep * Math.min(combo, PAY.comboCap);
  const tip = Math.round(ticket.recipe.price * PAY.tipMax * speed * streak) + (neat ? PAY.neatBonus : 0);
  return { price: ticket.recipe.price, tip, total: ticket.recipe.price + tip };
}
