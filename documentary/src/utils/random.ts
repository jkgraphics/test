/**
 * Deterministic pseudo-random numbers. Never use Math.random() in a Remotion
 * component — every frame may be rendered in a different browser tab, so the
 * values must be identical for the same seed.
 */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const seededArray = <T,>(seed: number, count: number, make: (rand: () => number, i: number) => T): T[] => {
  const rand = mulberry32(seed);
  return Array.from({length: count}, (_, i) => make(rand, i));
};
