export type LanguagePhysicsPreset = 'bengali-monsoon' | 'sufi-lantern' | 'cosmic-neon';

export type KineticLyricStyle = 'smoke' | 'spark' | 'glow' | 'drift';

export type DetectedLanguage = 'bengali' | 'hindi' | 'english' | 'other';

export type DetectedScript = 'bengali' | 'devanagari' | 'arabic' | 'latin' | 'mixed';

export interface SynesthesiaStoryboardPhase {
  startRatio: number; // 0.0..1.0
  endRatio: number; // 0.0..1.0
  phaseName: string;
  emotionLabel: string;
  visualMetaphor: string;
  palette: [string, string, string, string]; // [primary, secondary, accent, deepBackground]
  gravityX: number; // -1..1
  gravityY: number; // -1..1
  turbulence: number; // 0.1..1.0
  particleDensity: number; // 0.3..1.0
  kineticStyle: KineticLyricStyle;
}

export interface SynesthesiaDirectorPlan {
  songTitle: string;
  artist: string;
  durationSeconds: number;
  detectedLanguage: DetectedLanguage;
  script: DetectedScript;
  visualStylePreset: LanguagePhysicsPreset;
  overallEmotion: string;
  poeticSummary: string;
  culturalMotifs: string[];
  storyboard: SynesthesiaStoryboardPhase[];
  source: 'gemini' | 'demo-curated';
}

export interface SyncedLyricLine {
  id: string;
  timeSec: number;
  endTimeSec: number;
  text: string;
  script: DetectedScript;
  kineticHint: KineticLyricStyle;
}

export interface AudioBandMetrics {
  subBass: number; // 20 - 140 Hz (0..1)
  midVocals: number; // 300 - 3000 Hz (0..1)
  trebleInstruments: number; // 3500 - 16000 Hz (0..1)
  rms: number; // 0..1
  beatEnvelope: number; // 0..1
  isBeat: boolean;
  spectralCentroid: number; // 0..1
  frequencyBins: Uint8Array;
  timeDomain: Uint8Array;
}

export interface DeterministicVisualSeed {
  hashHex: string;
  chladniM: number;
  chladniN: number;
  petalSymmetry: number;
  orbitalEccentricity: number;
  hueBiasDeg: number;
  fractalWarp: number;
  phaseOffset: number;
  prng: () => number;
}

export interface AcousticFossil {
  id: string;
  songTitle: string;
  artist: string;
  detectedLanguage: DetectedLanguage;
  visualStylePreset: LanguagePhysicsPreset;
  overallEmotion: string;
  seedHex: string;
  palette: [string, string, string, string];
  chladniM: number;
  chladniN: number;
  petalSymmetry: number;
  spectralPeak: number;
  bassSignature: number;
  trebleSignature: number;
  durationSeconds: number;
  createdAt: number;
  constellationAngles: number[];
}

export interface DemoJourney {
  id: string;
  title: string;
  artist: string;
  tagline: string;
  durationSeconds: number;
  preset: LanguagePhysicsPreset;
  lrcLyrics: string;
  directorPlan: SynesthesiaDirectorPlan;
}
