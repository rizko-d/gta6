// Seeded randomness for SOLMAR: a tiny mulberry32 generator plus a
// coordinate hash so the same (x, y) always yields the same value,
// which keeps the city identical for a given seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic 0..1 hash of a pair of integer coordinates.
export function hash2(x, y, salt = 0) {
  let h = (x * 374761393 + y * 668265263 + salt * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class RNG {
  constructor(seed = 1) {
    this.next = mulberry32(seed);
  }
  // Float in [0, 1).
  f() {
    return this.next();
  }
  // Float in [a, b).
  range(a, b) {
    return a + (b - a) * this.next();
  }
  // Integer in [a, b] inclusive.
  int(a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
  // True with probability p.
  chance(p) {
    return this.next() < p;
  }
}
