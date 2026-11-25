// Between The Buns — every tuning constant in one place: the view, the warm diner palette, the
// ingredient and recipe tables, the kitchen layout, grill and chopping timings, the service rush
// stages and the pay rules. Other modules read from here and never hard-code a number of their own.

export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const ROUND_SECONDS = 120;

export const PALETTE = {
  ink: '#2a1a14',
  night: '#1e120d',
  wood: '#7a4a2e',
  woodDark: '#5a3320',
  counter: '#e6cfa8',
  counterEdge: '#b98d5c',
  steel: '#a9b3ba',
  steelDark: '#6d777e',
  tileA: '#f3e6cc',
  tileB: '#e2cca4',
  cream: '#fff6e6',
  paper: '#fffaf0',
  red: '#d8453b',
  mustard: '#f2b33d',
  teal: '#2f8079',
  green: '#4caf50',
  shadow: 'rgba(30,18,13,0.28)',
};

/** Burger layers. `h` is the layer's height as a fraction of the burger's width. */
export const INGREDIENTS = {
  bun: { label: 'Bun', color: '#e7a856', dark: '#b8732f', h: 0.2, topH: 0.36 },
  patty: { label: 'Patty', color: '#6e3b22', dark: '#4a2414', h: 0.16 },
  cheese: { label: 'Cheese', color: '#f7c531', dark: '#d99a12', h: 0.06 },
  lettuce: { label: 'Lettuce', color: '#6cc04a', dark: '#3f8f2c', h: 0.09 },
  tomato: { label: 'Tomato', color: '#e2483c', dark: '#a82a22', h: 0.09 },
  onion: { label: 'Onion', color: '#efe3f2', dark: '#9b5fa8', h: 0.07 },
};

/** Whole vegetables must be chopped before they can go on a burger. */
export const CHOPS_INTO = { wholeTomato: 'tomato', wholeOnion: 'onion' };
export const CHOP_TAPS = 3;
export const MAX_LAYERS = 9;

/** The menu. `tier` is the first rush stage the recipe can be ordered in. */
export const RECIPES = [
  { id: 'plain', name: 'Plain Jane', fillings: ['patty'], price: 5, tier: 0 },
  { id: 'cheesy', name: 'Cheesy', fillings: ['patty', 'cheese'], price: 6, tier: 0 },
  { id: 'garden', name: 'Garden', fillings: ['lettuce', 'tomato'], price: 5, tier: 0 },
  { id: 'classic', name: 'Classic', fillings: ['patty', 'lettuce', 'tomato'], price: 8, tier: 1 },
  { id: 'smash', name: 'Onion Smash', fillings: ['patty', 'onion', 'cheese'], price: 8, tier: 1 },
  { id: 'double', name: 'Double Down', fillings: ['patty', 'cheese', 'patty'], price: 10, tier: 2 },
  { id: 'works', name: 'The Works', fillings: ['patty', 'cheese', 'lettuce', 'tomato', 'onion'], price: 13, tier: 2 },
];

/** The rush: orders come faster, menus widen and patience shortens as the shift goes on. */
export const RUSH = [
  { at: 0, label: 'OPENING', every: 12, patience: 1.0, tier: 0 },
  { at: 30, label: 'LUNCH RUSH', every: 8.5, patience: 0.92, tier: 1 },
  { at: 70, label: 'FULL HOUSE', every: 6.5, patience: 0.85, tier: 2 },
];

export const TICKETS = { max: 5, basePatience: 26, perFilling: 7 };
export const PAY = { tipMax: 0.6, comboStep: 0.25, comboCap: 4, missPenalty: 2, neatBonus: 1 };
export const GRILL = { slots: 3, cookTime: 4.5, burnTime: 12 };
export const PASS_SLOTS = 3;
export const RUNNER_DELAY = 1.4;
export const CHEF = { speed: 340, reach: 58 };

/** Kitchen layout in view pixels: back counter, the pass on the right wall, front counter. */
export const KITCHEN = { x: 16, y: 228, w: 984, h: 476 };
export const FLOOR = { x: 44, y: 344, w: 828, h: 252 };
export const STATIONS = [
  { id: 'bun', kind: 'bin', item: 'bun', label: 'BUNS', x: 34, y: 236, w: 118, h: 86 },
  { id: 'grill', kind: 'grill', label: 'GRILL', x: 164, y: 236, w: 236, h: 86 },
  { id: 'cheese', kind: 'bin', item: 'cheese', label: 'CHEESE', x: 412, y: 236, w: 110, h: 86 },
  { id: 'lettuce', kind: 'bin', item: 'lettuce', label: 'LETTUCE', x: 534, y: 236, w: 110, h: 86 },
  { id: 'tomato', kind: 'bin', item: 'wholeTomato', label: 'TOMATO', x: 656, y: 236, w: 110, h: 86 },
  { id: 'onion', kind: 'bin', item: 'wholeOnion', label: 'ONION', x: 778, y: 236, w: 110, h: 86 },
  { id: 'pass', kind: 'pass', label: 'PASS', x: 900, y: 236, w: 100, h: 376 },
  { id: 'chop', kind: 'chop', label: 'CHOP', x: 56, y: 612, w: 176, h: 84 },
  { id: 'board', kind: 'board', label: 'BUILD', x: 300, y: 612, w: 280, h: 84 },
  { id: 'trash', kind: 'trash', label: 'TRASH', x: 650, y: 612, w: 96, h: 84 },
];
