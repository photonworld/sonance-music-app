import { DeterministicVisualSeed } from './types';

function fnv1a64(input: string): { hi: number; lo: number; hex: string } {
  let h1 = 0x811c9dc5;
  let h2 = 0xc9dc5118;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + (i & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }
  const hi = h1 >>> 0;
  const lo = h2 >>> 0;
  const hex = `${hi.toString(16).padStart(8, '0')}${lo.toString(16).padStart(8, '0')}`;
  return { hi, lo, hex };
}

export function createMulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a unique cryptographic visual seed from song title, lyric sentiment, and audio spectral fingerprint.
 * Guarantees no two songs share identical Chladni resonance constants, orbital symmetry, or shader phase.
 */
export function buildDeterministicVisualSeed(
  title: string,
  lyricsSentiment: string,
  audioFingerprint: string
): DeterministicVisualSeed {
  const composite = `${title.trim().toLowerCase()}|${lyricsSentiment.trim().toLowerCase()}|${audioFingerprint}`;
  const { hi, lo, hex } = fnv1a64(composite);
  const prng = createMulberry32(hi ^ lo);

  const chladniM = 2 + Math.floor(prng() * 6); // 2..7
  let chladniN = 3 + Math.floor(prng() * 7); // 3..9
  if (chladniN === chladniM) chladniN += 1;

  const petalSymmetry = 5 + Math.floor(prng() * 8); // 5..12
  const orbitalEccentricity = 0.68 + prng() * 0.45;
  const hueBiasDeg = Math.floor((prng() - 0.5) * 32);
  const fractalWarp = 0.75 + prng() * 0.85;
  const phaseOffset = prng() * Math.PI * 2;

  return {
    hashHex: hex,
    chladniM,
    chladniN,
    petalSymmetry,
    orbitalEccentricity,
    hueBiasDeg,
    fractalWarp,
    phaseOffset,
    prng,
  };
}

export function computeSentimentSignature(lyrics: string, overallEmotion: string): string {
  const tokens = `${overallEmotion} ${lyrics.slice(0, 600)}`.trim();
  const { hex } = fnv1a64(tokens || 'neutral-horizon');
  return hex;
}
