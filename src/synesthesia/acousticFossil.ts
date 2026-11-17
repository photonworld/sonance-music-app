import {
  AcousticFossil,
  DeterministicVisualSeed,
  SynesthesiaDirectorPlan,
} from './types';

const STORAGE_KEY = 'sonance-acoustic-fossils';

export function loadAcousticFossils(): AcousticFossil[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AcousticFossil[]) : [];
  } catch {
    return [];
  }
}

export function saveAcousticFossil(fossil: AcousticFossil): AcousticFossil[] {
  const existing = loadAcousticFossils();
  const deduped = existing.filter(
    (f) => !(f.songTitle === fossil.songTitle && f.seedHex === fossil.seedHex)
  );
  const next = [fossil, ...deduped].slice(0, 24);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
  return next;
}

export function deleteAcousticFossil(id: string): AcousticFossil[] {
  const next = loadAcousticFossils().filter((f) => f.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function crystallizeAcousticFossil(
  plan: SynesthesiaDirectorPlan,
  seed: DeterministicVisualSeed,
  metrics: {
    peakRms: number;
    avgBass: number;
    avgTreble: number;
  }
): AcousticFossil {
  const finalPhase = plan.storyboard[plan.storyboard.length - 1] ?? plan.storyboard[0];
  const primaryPhase = plan.storyboard[Math.floor(plan.storyboard.length / 2)] ?? finalPhase;
  const palette: [string, string, string, string] = primaryPhase?.palette ?? [
    '#38BDF8',
    '#A855F7',
    '#FDE047',
    '#050818',
  ];

  const count = seed.petalSymmetry;
  const constellationAngles: number[] = [];
  for (let i = 0; i < count; i++) {
    const jitter = (seed.prng() - 0.5) * 0.25;
    constellationAngles.push((i / count) * Math.PI * 2 + jitter);
  }

  return {
    id: `fossil-${seed.hashHex}-${Date.now()}`,
    songTitle: plan.songTitle,
    artist: plan.artist,
    detectedLanguage: plan.detectedLanguage,
    visualStylePreset: plan.visualStylePreset,
    overallEmotion: plan.overallEmotion,
    seedHex: seed.hashHex,
    palette,
    chladniM: seed.chladniM,
    chladniN: seed.chladniN,
    petalSymmetry: seed.petalSymmetry,
    spectralPeak: Number(Math.max(0.25, Math.min(1, metrics.peakRms)).toFixed(2)),
    bassSignature: Number(Math.max(0.1, Math.min(1, metrics.avgBass)).toFixed(2)),
    trebleSignature: Number(Math.max(0.1, Math.min(1, metrics.avgTreble)).toFixed(2)),
    durationSeconds: plan.durationSeconds,
    createdAt: Date.now(),
    constellationAngles,
  };
}
