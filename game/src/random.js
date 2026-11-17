// Seeded randomness (mulberry32) plus the small picking helpers the city, traffic and
// pedestrians share. The same seed always builds the same Solmara, which is what makes
// the screenshot scenes repeatable from ?seed=N.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** One element of an array, uniformly. */
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

/** An integer in [min, max]. */
export function intIn(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** Fisher–Yates shuffle, in place, driven by the seeded random. */
export function shuffle(random, list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}
