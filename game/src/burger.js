// The burger on the build board: a list of layers from the bottom bun up, the rule for what may be
// stacked next, and the check of a finished burger against a ticket's recipe.
import { INGREDIENTS, MAX_LAYERS } from './config.js';

/** True once a second bun has closed the burger over at least one filling. */
export function isClosed(layers) {
  return layers.length >= 3 && layers[0] === 'bun' && layers[layers.length - 1] === 'bun';
}

/** Whether `item` may go on top of `layers`: a bun starts it, fillings follow, a bun closes it. */
export function canStack(layers, item) {
  if (!INGREDIENTS[item] || isClosed(layers) || layers.length >= MAX_LAYERS) return false;
  if (layers.length === 0) return item === 'bun';
  if (item === 'bun') return layers.length >= 2;
  return true;
}

/** The layers between the buns. */
export function fillingsOf(layers) {
  return layers.slice(1, -1);
}

function tally(list) {
  const counts = {};
  for (const kind of list) counts[kind] = (counts[kind] ?? 0) + 1;
  return counts;
}

/**
 * Null when the burger is not the recipe; otherwise `{ neat }`, true when the fillings are stacked
 * in exactly the ticket's order (worth a small bonus).
 */
export function matchRecipe(layers, recipe) {
  if (!isClosed(layers)) return null;
  const have = tally(fillingsOf(layers));
  const want = tally(recipe.fillings);
  const kinds = new Set([...Object.keys(have), ...Object.keys(want)]);
  for (const kind of kinds) if (have[kind] !== want[kind]) return null;
  const fillings = fillingsOf(layers);
  return { neat: fillings.every((kind, index) => kind === recipe.fillings[index]) };
}
