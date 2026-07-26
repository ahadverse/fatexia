/**
 * Deterministic PRNG for the dev seed.
 *
 * Traffic (clicks/conversions) has to look varied — spread across days, geos, devices
 * and quality bands — but re-running `npm run seed` must produce byte-identical rows,
 * or the seed stops being idempotent and every run doubles the dataset. `Math.random`
 * cannot give both; this mulberry32 generator seeded from a fixed constant can.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

// Inclusive on both ends — reads the way the call sites mean it (`intBetween(1, 6)`
// is a die roll, not 1..5).
export function intBetween(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function chance(random: () => number, probability: number): boolean {
  return random() < probability;
}

export function daysAgo(days: number, random?: () => number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  if (random) {
    // Spread within the day so an hourly view isn't a stack of identical timestamps.
    date.setHours(intBetween(random, 0, 23), intBetween(random, 0, 59), intBetween(random, 0, 59), 0);
  }
  return date;
}
