export type AudioFormat =
  | 'MP3'
  | 'FLAC'
  | 'WAV'
  | 'AAC'
  | 'M4A'
  | 'OGG'
  | 'OPUS'
  | 'AIFF'
  | 'WEBM';

export type VisualizerMode =
  | 'auto'
  | 'spectrum'
  | 'waveform'
  | 'radial'
  | 'analog'
  | 'kinetic'
  | 'aurora'
  | 'cymatics'
  | 'orbit'
  | 'liquid'
  | 'monsoon'
  | 'dna'
  | 'geometric'
  | 'glitch';

export type ConcreteVisualizerStyle = Exclude<VisualizerMode, 'auto'>;

export type QuantumVisualizerMode =
  | 'quantum'
  | 'neural'
  | 'nebula'
  | 'bars'
  | 'cybergrid'
  | 'vortex'
  | 'sacred'
  | 'lantern'
  | 'monsoon3d'
  | 'geometricflow'
  | 'glitchshift';

export type ThemeId =
  | 'alabaster'
  | 'obsidian'
  | 'matcha'
  | 'cobalt'
  | 'rosewood';

export type PartyIntensity = 'subtle' | 'club' | 'dynamic';

export type RepeatMode = 'off' | 'all' | 'one';

export type EQPresetId = 'flat' | 'bass' | 'vocal' | 'acoustic' | 'club';

export type SleepTimerMode = 'off' | 15 | 30 | 45 | 60 | 'track';

export type TrackSourceType = 'local' | 'audius' | 'jamendo' | 'radio';

export type PlaybackSource = 'radio' | 'online' | 'offline';

export type MoodCategory =
  | 'Chill'
  | 'Energetic'
  | 'Focus'
  | 'Late Night'
  | 'Sad/Melancholic'
  | 'Workout'
  | 'Party';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number; // seconds (0 for live radio)
  format: AudioFormat;
  mimeType: string;
  sampleRate?: number; // Hz, e.g. 44100, 48000, 96000
  bitDepth?: number; // e.g. 16, 24
  bitrate?: number; // kbps, e.g. 320
  fileSize: number; // bytes
  artworkDataUrl?: string;
  liked: boolean;
  addedAt: number;
  isDemo?: boolean;
  sourceType?: TrackSourceType;
  streamUrl?: string;
  isLive?: boolean;
  country?: string;
  bpm?: number;
  harmonicIntensity?: number;
  isDownloaded?: boolean;
  downloadedAt?: number;
  sourceTrackId?: string;
}

export interface TasteHistoryEvent {
  trackId: string;
  title: string;
  artist: string;
  genre: string;
  bpm?: number;
  action: 'love' | 'play' | 'skip' | 'dislike';
  timestamp: number;
}

export interface TasteProfile {
  lovedTracks: Record<string, Track>;
  dislikedTrackIds: string[];
  playCounts: Record<string, number>;
  skipCounts: Record<string, number>;
  genreWeights: Record<string, number>;
  artistWeights: Record<string, number>;
  recentBpms: number[];
  recentHistory: TasteHistoryEvent[];
  updatedAt: number;
}

export interface RadioStation {
  stationuuid: string;
  name: string;
  url: string;
  country: string;
  countrycode: string;
  state: string;
  tags: string[];
  favicon: string;
  bitrate: number;
  codec: string;
  geoLat: number | null;
  geoLong: number | null;
  votes: number;
}

export interface AudiusStreamTrack {
  id: string;
  audiusId: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  artworkUrl: string;
  streamUrl: string;
  playCount: number;
  tags: string;
  provider?: 'audius' | 'jamendo';
  bpm?: number;
  harmonicIntensity?: number;
}

export interface StreamSeedContext {
  query?: string;
  genre?: string;
  mood?: string;
  tags?: string;
  sort?: 'popular' | 'relevance';
  mode?: 'search' | 'trending';
  offset: number;
  exhausted?: boolean;
  targetBpmMin?: number;
  targetBpmMax?: number;
  harmonicTarget?: number;
}

export interface GeoRegionProfile {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  recommendedGenres: string[];
  radioTags: string[];
  audiusHighlightQuery: string;
}

export interface AIMoodPlan {
  moodTitle: string;
  rationale: string;
  emotionalState?: string;
  targetBpmMin: number;
  targetBpmMax: number;
  harmonicIntensity: number; // 0..1
  recommendedGenres: string[];
  radioTags: string[];
  audiusQueries: string[];
  visualizerStyle: ConcreteVisualizerStyle;
  quantumMode?: QuantumVisualizerMode;
  moodEnvironment?: 'water' | 'rain' | 'warmth' | 'aurora' | 'forest' | 'energy';
  curationSource?: 'gemini' | 'acoustic-engine';
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface AudioAnalysisFrame {
  frequencyData: Uint8Array<ArrayBuffer>;
  timeDomainData: Uint8Array<ArrayBuffer>;
  bass: number; // 0..1
  mid: number; // 0..1
  high: number; // 0..1
  rms: number; // 0..1
  beatEnvelope: number; // 0..1 decaying peak on beat
  isBeat: boolean;
  spectralCentroid: number; // 0..1 normalized brightness
  estimatedBpm: number | null;
  transitionTempoBpm?: number | null;
  crossfadeProgress?: number | null;
}

export interface EQBand {
  frequency: number;
  label: string;
  gain: number; // -12 to +12 dB
}
