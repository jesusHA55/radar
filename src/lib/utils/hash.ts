/**
 * Deterministic, dependency-free hashing helpers.
 *
 * The mock flight provider derives every price from a hash of its inputs, so a
 * given search always returns the same (believable) result within a session and
 * across restarts. Nothing here is cryptographic.
 */

/** FNV-1a 32-bit hash of a string. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Hash mapped to a float in the half-open interval [0, 1). */
export function hashUnit(input: string): number {
  return hashString(input) / 0x100000000;
}

/**
 * Hash mapped to a float in [min, max). Used for price jitter so the same
 * route/date combination produces a stable pseudo-random multiplier.
 */
export function hashRange(input: string, min: number, max: number): number {
  return min + hashUnit(input) * (max - min);
}

/** Small, fast, seedable PRNG (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}
