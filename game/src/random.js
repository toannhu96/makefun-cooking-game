// Seeded random numbers (mulberry32), so a seed always deals the same orders in the same order.

/** A function returning floats in [0, 1) from a 32-bit integer seed. */
export function createRng(seed) {
  let state = (Number(seed) >>> 0) || 1;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
