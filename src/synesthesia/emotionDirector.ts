import {
  SynesthesiaDirectorPlan,
  SynesthesiaStoryboardPhase,
} from './types';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r || 0, g || 0, b || 0];
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [
      Number.isFinite(r) ? r : 56,
      Number.isFinite(g) ? g : 189,
      Number.isFinite(b) ? b : 248,
    ];
  }
  return [56, 189, 248];
}

function lerpHex(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl
    .toString(16)
    .padStart(2, '0')}`;
}

export async function requestSemanticDirectorPlan(params: {
  title: string;
  artist: string;
  lyrics: string;
  durationSeconds: number;
  audioFingerprint: string;
}): Promise<SynesthesiaDirectorPlan> {
  const res = await fetch('/api/ai/synesthesia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const payload = (await res.json().catch(() => ({}))) as Partial<SynesthesiaDirectorPlan> & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      payload.error || `Semantic analysis failed (HTTP ${res.status})`
    );
  }

  const phases = Array.isArray(payload.storyboard) && payload.storyboard.length > 0
    ? payload.storyboard
    : [
        {
          startRatio: 0,
          endRatio: 1,
          phaseName: 'Harmonic Resonance',
          emotionLabel: payload.overallEmotion || 'Transcendent',
          visualMetaphor: 'Luminous waves drifting across shifting emotional tides',
          palette: ['#38BDF8', '#A855F7', '#FDE047', '#050818'] as [
            string,
            string,
            string,
            string,
          ],
          gravityX: 0.08,
          gravityY: -0.15,
          turbulence: 0.55,
          particleDensity: 0.78,
          kineticStyle: 'drift' as const,
        },
      ];

  return {
    songTitle: payload.songTitle || params.title || 'Untitled Piece',
    artist: payload.artist || params.artist || 'Independent Artist',
    durationSeconds: payload.durationSeconds || params.durationSeconds || 180,
    detectedLanguage: payload.detectedLanguage || 'english',
    script: payload.script || 'latin',
    visualStylePreset: payload.visualStylePreset || 'cosmic-neon',
    overallEmotion: payload.overallEmotion || 'Emotional Immersion',
    poeticSummary:
      payload.poeticSummary ||
      'Living frequencies sculpted from lyric narrative and harmonic tension.',
    culturalMotifs: Array.isArray(payload.culturalMotifs)
      ? payload.culturalMotifs
      : ['Cymatic Harmonics', 'Kinetic Light'],
    storyboard: phases.map((p, idx) => ({
      startRatio: typeof p.startRatio === 'number' ? p.startRatio : idx / phases.length,
      endRatio: typeof p.endRatio === 'number' ? p.endRatio : (idx + 1) / phases.length,
      phaseName: p.phaseName || `Movement ${idx + 1}`,
      emotionLabel: p.emotionLabel || 'Resonance',
      visualMetaphor: p.visualMetaphor || 'Fluid harmonic motion',
      palette:
        Array.isArray(p.palette) && p.palette.length >= 4
          ? [p.palette[0], p.palette[1], p.palette[2], p.palette[3]]
          : ['#38BDF8', '#A855F7', '#FDE047', '#050818'],
      gravityX: typeof p.gravityX === 'number' ? p.gravityX : 0,
      gravityY: typeof p.gravityY === 'number' ? p.gravityY : -0.15,
      turbulence: typeof p.turbulence === 'number' ? p.turbulence : 0.55,
      particleDensity: typeof p.particleDensity === 'number' ? p.particleDensity : 0.75,
      kineticStyle: p.kineticStyle || 'drift',
    })),
    source: 'gemini',
  };
}

/**
 * Smoothly resolves and blends consecutive emotional storyboard phases across normalized song progress (0..1).
 */
export function resolveInterpolatedPhase(
  plan: SynesthesiaDirectorPlan,
  progressRatio: number
): SynesthesiaStoryboardPhase {
  const clamped = Math.max(0, Math.min(1, progressRatio));
  const phases = plan.storyboard;
  if (phases.length === 0) {
    return {
      startRatio: 0,
      endRatio: 1,
      phaseName: 'Harmonic Field',
      emotionLabel: 'Serene',
      visualMetaphor: 'Quiet atmospheric drift',
      palette: ['#38BDF8', '#A855F7', '#FDE047', '#050818'],
      gravityX: 0,
      gravityY: -0.1,
      turbulence: 0.45,
      particleDensity: 0.72,
      kineticStyle: 'drift',
    };
  }

  let idx = phases.findIndex((p) => clamped >= p.startRatio && clamped <= p.endRatio);
  if (idx === -1) {
    idx = clamped >= phases[phases.length - 1].endRatio ? phases.length - 1 : 0;
  }

  const current = phases[idx];
  const next = phases[idx + 1];
  if (!next) return current;

  const span = Math.max(0.05, current.endRatio - current.startRatio);
  const blendWindow = Math.min(0.12, span * 0.35);
  const distToEnd = current.endRatio - clamped;
  if (distToEnd > blendWindow || distToEnd < 0) {
    return current;
  }

  const blendT = 1 - distToEnd / blendWindow;
  return {
    ...current,
    palette: [
      lerpHex(current.palette[0], next.palette[0], blendT),
      lerpHex(current.palette[1], next.palette[1], blendT),
      lerpHex(current.palette[2], next.palette[2], blendT),
      lerpHex(current.palette[3], next.palette[3], blendT),
    ],
    gravityX: current.gravityX + (next.gravityX - current.gravityX) * blendT,
    gravityY: current.gravityY + (next.gravityY - current.gravityY) * blendT,
    turbulence: current.turbulence + (next.turbulence - current.turbulence) * blendT,
    particleDensity:
      current.particleDensity + (next.particleDensity - current.particleDensity) * blendT,
  };
}
