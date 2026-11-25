// The kitchen floor: station records, the chef's movement inside the floor, which station is in
// reach, walking to a station's spot, and the grill's patty slots cooking (then burning) over time.
import { CHEF, FLOOR, GRILL, STATIONS } from './config.js';

export function createKitchen() {
  return {
    stations: STATIONS.map((station) => ({ ...station, bump: 0 })),
    grill: { slots: new Array(GRILL.slots).fill(null) },
  };
}

export function createChef() {
  return { x: 450, y: 470, facing: 1, holding: null, bump: 0, walk: 0, focus: null, target: null };
}

/** Moves the chef by a direction (each axis -1..1) for `dt` seconds, kept inside the floor. */
export function moveChef(chef, dx, dy, dt) {
  const length = Math.hypot(dx, dy);
  if (length === 0) return;
  chef.x = Math.min(FLOOR.x + FLOOR.w, Math.max(FLOOR.x, chef.x + (dx / length) * CHEF.speed * dt));
  chef.y = Math.min(FLOOR.y + FLOOR.h, Math.max(FLOOR.y, chef.y + (dy / length) * CHEF.speed * dt));
  if (dx !== 0) chef.facing = dx > 0 ? 1 : -1;
  chef.walk += dt * 10;
}

/** Distance from the chef's hands to a station's footprint. */
export function reachTo(chef, station) {
  const hx = chef.x;
  const hy = chef.y - 30;
  const nx = Math.max(station.x, Math.min(hx, station.x + station.w));
  const ny = Math.max(station.y, Math.min(hy, station.y + station.h));
  return Math.hypot(hx - nx, hy - ny);
}

/** The station the chef would use now: the closest one in reach, or null. */
export function nearestStation(chef, stations) {
  let best = null;
  let bestScore = Infinity;
  for (const station of stations) {
    const distance = reachTo(chef, station);
    if (distance > CHEF.reach) continue;
    const score = distance + 0.05 * Math.abs(chef.x - (station.x + station.w / 2));
    if (score < bestScore) {
      bestScore = score;
      best = station;
    }
  }
  return best;
}

/** Where the chef stands to use a station. */
export function stationSpot(station) {
  if (station.kind === 'pass') return { x: FLOOR.x + FLOOR.w, y: 470 };
  const x = Math.min(FLOOR.x + FLOOR.w, Math.max(FLOOR.x, station.x + station.w / 2));
  return { x, y: station.y < FLOOR.y ? FLOOR.y : FLOOR.y + FLOOR.h };
}

/** The direction to walk toward a station's spot, and whether the chef is already there. */
export function steerToward(chef, station) {
  const spot = stationSpot(station);
  const dx = spot.x - chef.x;
  const dy = spot.y - chef.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 6) return { dx: 0, dy: 0, arrived: true };
  return { dx: dx / distance, dy: dy / distance, arrived: false };
}

/** 'raw', 'cooked' or 'burnt' for a patty that has been on the grill `slot.t` seconds. */
export function pattyState(slot) {
  if (slot.t < GRILL.cookTime) return 'raw';
  return slot.t < GRILL.burnTime ? 'cooked' : 'burnt';
}

/** Cooks every patty; returns the patties that just turned cooked or burnt. */
export function updateGrill(grill, dt) {
  const changes = [];
  grill.slots.forEach((slot, index) => {
    if (!slot) return;
    const before = pattyState(slot);
    slot.t += dt;
    const after = pattyState(slot);
    if (after !== before) changes.push({ index, state: after });
  });
  return changes;
}

export function grillCounts(grill) {
  const counts = { raw: 0, cooked: 0, burnt: 0, free: 0 };
  for (const slot of grill.slots) counts[slot ? pattyState(slot) : 'free'] += 1;
  return counts;
}

/** Takes a burnt patty first (to clear it), else the most-cooked patty; null when none is ready. */
export function grillTake(grill) {
  let pick = -1;
  for (let i = 0; i < grill.slots.length; i += 1) {
    const slot = grill.slots[i];
    if (!slot || pattyState(slot) === 'raw') continue;
    if (pick < 0 || slot.t > grill.slots[pick].t) pick = i;
  }
  if (pick < 0) return null;
  const state = pattyState(grill.slots[pick]);
  grill.slots[pick] = null;
  return state === 'burnt' ? 'burnt' : 'patty';
}

/** Lays a fresh raw patty in a free slot; false when the grill is full. */
export function grillDrop(grill) {
  const free = grill.slots.indexOf(null);
  if (free < 0) return false;
  grill.slots[free] = { t: 0 };
  return true;
}
