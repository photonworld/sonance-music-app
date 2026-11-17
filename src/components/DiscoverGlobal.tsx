import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  CloudRain,
  Disc3,
  Flame,
  Flower2,
  Globe,
  Guitar,
  Headphones,
  Heart,
  Infinity as InfinityIcon,
  Loader2,
  MapPin,
  Moon,
  Music,
  Pause,
  Play,
  Radio,
  Search,
  Shuffle,
  Sparkles,
  Sun,
  Terminal,
  ThumbsDown,
  Trees,
  X,
} from 'lucide-react';
import {
  AIMoodPlan,
  AudiusStreamTrack,
  ConcreteVisualizerStyle,
  GeoRegionProfile,
  RadioStation,
  StreamSeedContext,
  Track,
} from '../types/audio';
import { formatDuration } from '../utils/audioMetadata';
import { triggerHapticLight, triggerHapticMedium } from '../utils/haptics';
import { DownloadButton } from './DownloadButton';
import { RadioCardSkeleton, StreamRowSkeleton } from './SkeletonLoaders';

import heroDeepFocusImg from '../assets/images/hero_deep_focus_1794594516088.jpg';
import cardDeepStudyImg from '../assets/images/card_deep_study_1794594517339.jpg';
import cardMeditationZenImg from '../assets/images/card_meditation_zen_1794594516386.jpg';
import cardSleepRainImg from '../assets/images/card_sleep_rain_1794594517060.jpg';
import cardLofiChillhopImg from '../assets/images/card_lofi_chillhop_1794594517852.jpg';
import cardCyberFlowImg from '../assets/images/card_cyber_flow_1794594517745.jpg';
import cardMorningYogaImg from '../assets/images/card_morning_yoga_1794594517644.jpg';
import cardWorkoutBassImg from '../assets/images/card_workout_bass_1794594517441.jpg';
import cardNatureOceanImg from '../assets/images/card_nature_ocean_1794594519026.jpg';
import cardRomanticAcousticImg from '../assets/images/card_romantic_acoustic_1794594519682.jpg';
import cardNightDriveImg from '../assets/images/card_night_drive_1794594519519.jpg';

interface DiscoverGlobalProps {
  geoProfile: GeoRegionProfile | null;
  onChangeRegionOverride: (countryCode: string) => void;
  currentTrackId: string | null;
  isPlaying: boolean;
  infiniteQueueEnabled: boolean;
  onToggleInfiniteQueue: () => void;
  lovedIds: Set<string>;
  dislikedIds: Set<string>;
  downloadedSourceIds: Set<string>;
  downloadProgressMap: Record<string, number>;
  onPlayExternalTrack: (
    track: Track,
    contextTracks?: Track[],
    seed?: StreamSeedContext
  ) => void;
  onPlayExternalQueue: (
    tracks: Track[],
    enableShuffle: boolean,
    seed?: StreamSeedContext,
    options?: { crossfade?: boolean; crossfadeMs?: number }
  ) => void;
  onTogglePlayPause?: () => void;
  onShowNotice?: (message: string) => void;
  onMoodHintChange?: (hint: string) => void;
  onSynthPlanChange?: (plan: AIMoodPlan | null) => void;
  isCrossfading?: boolean;
  onToggleLove: (track: Track) => void;
  onDislikeAndSkip: (track: Track) => void;
  onDownloadTrack: (track: Track) => void;
  onSuggestVisualizer?: (style: ConcreteVisualizerStyle) => void;
  onTracksLoaded?: (tracks: Track[], seed?: StreamSeedContext) => void;
}

const REGION_OPTIONS = [
  { code: 'AUTO', label: 'Auto-Detected' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'BD', label: 'Bangladesh' },
  { code: 'IN', label: 'India' },
  { code: 'JP', label: 'Japan' },
  { code: 'KR', label: 'South Korea' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'DE', label: 'Germany' },
  { code: 'BR', label: 'Brazil' },
  { code: 'FR', label: 'France' },
];

interface SynthEmotionalPreset {
  label: string;
  targetBpm: number;
  harmonicIntensity: number;
}

const SYNTH_EMOTIONAL_PRESETS: SynthEmotionalPreset[] = [
  { label: 'Energy Boost', targetBpm: 132, harmonicIntensity: 0.86 },
  { label: 'Deep Melancholy', targetBpm: 76, harmonicIntensity: 0.42 },
  { label: 'Creative Flow', targetBpm: 102, harmonicIntensity: 0.64 },
  { label: 'Midnight Euphoria', targetBpm: 122, harmonicIntensity: 0.8 },
  { label: 'Serene Recovery', targetBpm: 68, harmonicIntensity: 0.28 },
  { label: 'High-BPM Drive', targetBpm: 144, harmonicIntensity: 0.92 },
];

interface CuratedChannel {
  id: string;
  label: string;
  subtitle: string;
  badge: string;
  query: string;
  fallbackQueries: string[];
  tags: string[];
  genre: string;
  radioTag: string;
  visualizerStyle: ConcreteVisualizerStyle;
  artwork: string;
  auroraGradient: string;
  glowColor: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

const CURATED_CHANNELS: CuratedChannel[] = [
  {
    id: 'deep-study',
    label: 'Deep Study & Focus',
    subtitle: 'Binaural beats, minimal piano & instrumental focus',
    badge: 'FLOW STATE',
    query: 'instrumental',
    fallbackQueries: ['instrumental', 'piano', 'ambient', 'classical'],
    tags: ['instrumental', 'piano', 'ambient', 'classical'],
    genre: 'Ambient',
    radioTag: 'chill',
    visualizerStyle: 'kinetic',
    artwork: cardDeepStudyImg,
    auroraGradient: 'radial-gradient(circle at 22% 20%, #0ea5e9 0%, #1e1b4b 58%, #020617 100%)',
    glowColor: 'rgba(56, 189, 248, 0.42)',
    icon: Brain,
  },
  {
    id: 'meditation-zen',
    label: 'Meditation & Zen',
    subtitle: 'Tibetan bowls, peaceful ambient & mindfulness',
    badge: 'MINDFUL',
    query: 'ambient',
    fallbackQueries: ['ambient', 'meditation', 'chill', 'new age'],
    tags: ['ambient', 'meditation', 'chill'],
    genre: 'Ambient',
    radioTag: 'meditation',
    visualizerStyle: 'radial',
    artwork: cardMeditationZenImg,
    auroraGradient: 'radial-gradient(circle at 75% 25%, #14b8a6 0%, #0f172a 60%, #042f2e 100%)',
    glowColor: 'rgba(20, 184, 166, 0.42)',
    icon: Flower2,
  },
  {
    id: 'sleep-rain',
    label: 'Deep Sleep & Rain',
    subtitle: 'Night rain, soft delta waves & soothing lullabies',
    badge: 'NOCTURNAL',
    query: 'ambient',
    fallbackQueries: ['ambient', 'sleep', 'downtempo', 'calm'],
    tags: ['ambient', 'sleep', 'downtempo', 'calm'],
    genre: 'Ambient',
    radioTag: 'ambient',
    visualizerStyle: 'radial',
    artwork: cardSleepRainImg,
    auroraGradient: 'radial-gradient(circle at 30% 25%, #6366f1 0%, #1e1b4b 55%, #020617 100%)',
    glowColor: 'rgba(129, 140, 248, 0.42)',
    icon: CloudRain,
  },
  {
    id: 'lofi-chillhop',
    label: 'Lo-Fi & Chillhop',
    subtitle: 'Cozy late-night beats for relaxing',
    badge: 'LIVE MIX',
    query: 'lofi',
    fallbackQueries: ['lofi', 'chillhop', 'beats', 'hiphop'],
    tags: ['lofi', 'chillhop', 'beats', 'hiphop'],
    genre: 'Lo-Fi',
    radioTag: 'lofi',
    visualizerStyle: 'waveform',
    artwork: cardLofiChillhopImg,
    auroraGradient: 'radial-gradient(circle at 28% 22%, #f59e0b 0%, #4c1d95 55%, #090d16 100%)',
    glowColor: 'rgba(245, 158, 11, 0.42)',
    icon: Headphones,
  },
  {
    id: 'cyber-flow',
    label: 'Coding & Cyber Flow',
    subtitle: 'Futuristic synthwave & electronic concentration',
    badge: 'SYNTH FLOW',
    query: 'electronic',
    fallbackQueries: ['electronic', 'synthwave', 'chillout'],
    tags: ['electronic', 'synthwave', 'chillout'],
    genre: 'Electronic',
    radioTag: 'synthwave',
    visualizerStyle: 'spectrum',
    artwork: cardCyberFlowImg,
    auroraGradient: 'radial-gradient(circle at 78% 18%, #06b6d4 0%, #3b0764 58%, #020617 100%)',
    glowColor: 'rgba(34, 211, 238, 0.44)',
    icon: Terminal,
  },
  {
    id: 'morning-yoga',
    label: 'Morning Energy & Yoga',
    subtitle: 'Uplifting acoustic sunrise & positive vibes',
    badge: 'SUNRISE',
    query: 'acoustic',
    fallbackQueries: ['acoustic', 'folk', 'indie', 'chill'],
    tags: ['acoustic', 'folk', 'indie', 'chill'],
    genre: 'Acoustic',
    radioTag: 'chill',
    visualizerStyle: 'analog',
    artwork: cardMorningYogaImg,
    auroraGradient: 'radial-gradient(circle at 30% 20%, #fb923c 0%, #7c2d12 55%, #1c1917 100%)',
    glowColor: 'rgba(251, 146, 60, 0.44)',
    icon: Sun,
  },
  {
    id: 'workout-bass',
    label: 'High-Intensity Workout',
    subtitle: 'Heavy bass, phonk & high-BPM gym motivation',
    badge: 'HIGH BPM',
    query: 'electronic',
    fallbackQueries: ['electronic', 'rock', 'house', 'bass'],
    tags: ['electronic', 'rock', 'house', 'bass'],
    genre: 'Electronic',
    radioTag: 'workout',
    visualizerStyle: 'spectrum',
    artwork: cardWorkoutBassImg,
    auroraGradient: 'radial-gradient(circle at 72% 24%, #f43f5e 0%, #4c0519 58%, #09090b 100%)',
    glowColor: 'rgba(244, 63, 94, 0.46)',
    icon: Flame,
  },
  {
    id: 'nature-ocean',
    label: 'Nature & Ocean Waves',
    subtitle: 'Forest breeze, rainfall & waterfall soundscapes',
    badge: 'ORGANIC',
    query: 'ambient',
    fallbackQueries: ['ambient', 'soundtrack', 'instrumental'],
    tags: ['ambient', 'soundtrack', 'instrumental'],
    genre: 'Ambient',
    radioTag: 'nature',
    visualizerStyle: 'waveform',
    artwork: cardNatureOceanImg,
    auroraGradient: 'radial-gradient(circle at 25% 24%, #10b981 0%, #064e3b 58%, #022c22 100%)',
    glowColor: 'rgba(16, 185, 129, 0.42)',
    icon: Trees,
  },
  {
    id: 'romantic-acoustic',
    label: 'Romantic & Acoustic',
    subtitle: 'Warm guitar melodies & soulful instrumentals',
    badge: 'INTIMATE',
    query: 'acoustic',
    fallbackQueries: ['acoustic', 'guitar', 'pop', 'soul'],
    tags: ['acoustic', 'guitar', 'pop', 'soul'],
    genre: 'Acoustic',
    radioTag: 'acoustic',
    visualizerStyle: 'analog',
    artwork: cardRomanticAcousticImg,
    auroraGradient: 'radial-gradient(circle at 75% 22%, #ec4899 0%, #500724 58%, #09090b 100%)',
    glowColor: 'rgba(236, 72, 153, 0.42)',
    icon: Guitar,
  },
  {
    id: 'night-drive',
    label: 'Late Night Drive',
    subtitle: 'Dreamy retrowave & atmospheric night tracks',
    badge: 'AFTER HOURS',
    query: 'synthwave',
    fallbackQueries: ['synthwave', 'electronic', 'rnb'],
    tags: ['synthwave', 'electronic', 'rnb'],
    genre: 'Electronic',
    radioTag: 'retrowave',
    visualizerStyle: 'kinetic',
    artwork: cardNightDriveImg,
    auroraGradient: 'radial-gradient(circle at 30% 20%, #a855f7 0%, #1e1b4b 58%, #020617 100%)',
    glowColor: 'rgba(168, 85, 247, 0.44)',
    icon: Moon,
  },
];

function formatPlayCount(count?: number): string | null {
  if (!count || count <= 0) return null;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M plays`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k plays`;
  return `${count} plays`;
}

export function audiusToTrack(item: AudiusStreamTrack): Track {
  const isJamendo = item.provider === 'jamendo' || item.id.startsWith('jamendo-');
  return {
    id: item.id,
    title: item.title,
    artist: item.artist,
    album: item.album || (isJamendo ? 'Jamendo Free Music' : 'Audius Global'),
    genre: item.genre || 'Electronic',
    duration: item.duration || 180,
    format: 'MP3',
    mimeType: 'audio/mpeg',
    bitrate: 320,
    fileSize: 0,
    artworkDataUrl: item.artworkUrl || undefined,
    liked: false,
    addedAt: Date.now(),
    sourceType: isJamendo ? 'jamendo' : 'audius',
    streamUrl: item.streamUrl,
    isLive: false,
    bpm: item.bpm,
    harmonicIntensity: item.harmonicIntensity,
  };
}

export function radioToTrack(station: RadioStation): Track {
  const codecUpper = station.codec?.toUpperCase() || 'MP3';
  const format =
    codecUpper === 'AAC' || codecUpper === 'OGG' || codecUpper === 'FLAC' || codecUpper === 'OPUS'
      ? codecUpper
      : 'MP3';
  return {
    id: `radio-${station.stationuuid}`,
    title: station.name,
    artist: `${station.country}${station.state ? ` · ${station.state}` : ''}`,
    album: station.tags.slice(0, 2).join(' · ') || 'Live FM Stream',
    genre: station.tags[0] || 'Radio',
    duration: 0,
    format,
    mimeType: 'audio/mpeg',
    bitrate: station.bitrate || 128,
    fileSize: 0,
    artworkDataUrl: station.favicon || undefined,
    liked: false,
    addedAt: Date.now(),
    sourceType: 'radio',
    streamUrl: station.url,
    isLive: true,
    country: station.country,
  };
}

export const DiscoverGlobal: React.FC<DiscoverGlobalProps> = ({
  geoProfile,
  onChangeRegionOverride,
  currentTrackId,
  isPlaying,
  infiniteQueueEnabled,
  onToggleInfiniteQueue,
  lovedIds,
  dislikedIds,
  downloadedSourceIds,
  downloadProgressMap,
  onPlayExternalTrack,
  onPlayExternalQueue,
  onTogglePlayPause,
  onShowNotice,
  onMoodHintChange,
  onSynthPlanChange,
  isCrossfading = false,
  onToggleLove,
  onDislikeAndSkip,
  onDownloadTrack,
  onSuggestVisualizer,
  onTracksLoaded,
}) => {
  const [selectedCountry, setSelectedCountry] = useState('AUTO');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGenreChip, setActiveGenreChip] = useState<string>('');
  const [activeChannelId, setActiveChannelId] = useState<string>(CURATED_CHANNELS[0].id);
  const [loadingChannelId, setLoadingChannelId] = useState<string | null>(null);
  const [playingChannelId, setPlayingChannelId] = useState<string | null>(null);
  const [detailChannel, setDetailChannel] = useState<CuratedChannel | null>(null);
  const [detailSheetVisible, setDetailSheetVisible] = useState(false);

  const [audiusTracks, setAudiusTracks] = useState<AudiusStreamTrack[]>([]);
  const [radioStations, setRadioStations] = useState<RadioStation[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreStreams, setHasMoreStreams] = useState(true);
  const [streamOffset, setStreamOffset] = useState(0);
  const [providersLabel, setProvidersLabel] = useState('Audius & Jamendo');
  const [streamError, setStreamError] = useState<string | null>(null);

  const [moodInput, setMoodInput] = useState('');
  const [activeEmotionalState, setActiveEmotionalState] = useState<string>('');
  const [targetBpm, setTargetBpm] = useState<number>(102);
  const [targetHarmonic, setTargetHarmonic] = useState<number>(0.64);
  const [aiPlan, setAiPlan] = useState<AIMoodPlan | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const fetchTokenRef = useRef(0);
  const initializedCountryRef = useRef<string | null>(null);
  const onPlayExternalQueueRef = useRef(onPlayExternalQueue);
  onPlayExternalQueueRef.current = onPlayExternalQueue;
  const onShowNoticeRef = useRef(onShowNotice);
  onShowNoticeRef.current = onShowNotice;
  const onMoodHintChangeRef = useRef(onMoodHintChange);
  onMoodHintChangeRef.current = onMoodHintChange;
  const onSynthPlanChangeRef = useRef(onSynthPlanChange);
  onSynthPlanChangeRef.current = onSynthPlanChange;
  const onTracksLoadedRef = useRef(onTracksLoaded);
  onTracksLoadedRef.current = onTracksLoaded;
  const aiPlanRef = useRef(aiPlan);
  aiPlanRef.current = aiPlan;
  const dislikedIdsRef = useRef(dislikedIds);
  dislikedIdsRef.current = dislikedIds;

  const activeFetchOptsRef = useRef<{
    q?: string;
    genre?: string;
    mood?: string;
    tags?: string;
    fallbacks?: string[];
    sort?: 'popular' | 'relevance';
    mode?: 'search' | 'trending';
    bpmMin?: number;
    bpmMax?: number;
    harmonicTarget?: number;
  }>({});
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  const playCountById = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of audiusTracks) {
      if (item.playCount > 0) map.set(item.id, item.playCount);
    }
    return map;
  }, [audiusTracks]);

  const normalizedAudiusTracks = useMemo(
    () => audiusTracks.map(audiusToTrack).filter((t) => !dislikedIds.has(t.id)),
    [audiusTracks, dislikedIds]
  );

  const normalizedRadioTracks = useMemo(
    () => radioStations.map(radioToTrack),
    [radioStations]
  );

  const activeChannelTrackSet = useMemo(
    () => new Set(normalizedAudiusTracks.map((t) => t.id)),
    [normalizedAudiusTracks]
  );

  const isPlayingCurrentChannel = Boolean(
    currentTrackId && isPlaying && activeChannelTrackSet.has(currentTrackId)
  );

  const rankRawTracksByAcousticTarget = useCallback(
    (items: AudiusStreamTrack[], centerBpm: number, harmonicTarget: number) => {
      return [...items].sort((a, b) => {
        const score = (tr: AudiusStreamTrack) => {
          const bpmDiff = Math.abs((tr.bpm ?? 104) - centerBpm);
          const harmDiff = Math.abs((tr.harmonicIntensity ?? 0.5) - harmonicTarget);
          const bpmScore = Math.max(0, 100 - bpmDiff * 1.9);
          const harmScore = Math.max(0, 90 * (1 - harmDiff));
          return bpmScore + harmScore;
        };
        return score(b) - score(a);
      });
    },
    []
  );

  const runGlobalFetch = useCallback(
    async (opts: {
      q?: string;
      genre?: string;
      mood?: string;
      tags?: string;
      fallbacks?: string[];
      sort?: 'popular' | 'relevance';
      radioTag?: string;
      countryCode?: string;
      append?: boolean;
      offset?: number;
      autoPlayOnLoad?: boolean;
      crossfadeOnLoad?: boolean;
      shuffleOnLoad?: boolean;
      channelIdForLoad?: string;
      channelLabel?: string;
      bpmMin?: number;
      bpmMax?: number;
      harmonicTarget?: number;
    }) => {
      const isAppend = Boolean(opts.append);
      const nextOffset = opts.offset ?? 0;
      const myToken = isAppend ? fetchTokenRef.current : ++fetchTokenRef.current;

      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoadingStreams(true);
        if (opts.channelIdForLoad) {
          setLoadingChannelId(opts.channelIdForLoad);
        } else {
          setLoadingChannelId(null);
        }
        setStreamError(null);
        activeFetchOptsRef.current = {
          q: opts.q,
          genre: opts.genre,
          mood: opts.mood,
          tags: opts.tags,
          fallbacks: opts.fallbacks,
          sort: opts.sort || 'popular',
          mode: opts.q || opts.mood || opts.tags ? 'search' : 'trending',
          bpmMin: opts.bpmMin,
          bpmMax: opts.bpmMax,
          harmonicTarget: opts.harmonicTarget,
        };
      }

      try {
        const audiusParams = new URLSearchParams();
        if (opts.q) {
          audiusParams.set('q', opts.q);
        } else if (opts.mood) {
          audiusParams.set('mood', opts.mood);
        } else if (opts.genre) {
          audiusParams.set('mode', 'trending');
          audiusParams.set('genre', opts.genre);
        } else {
          audiusParams.set('mode', 'trending');
        }
        if (opts.genre) audiusParams.set('genre', opts.genre);
        if (opts.tags) audiusParams.set('tags', opts.tags);
        if (opts.fallbacks?.length) {
          audiusParams.set('fallbacks', opts.fallbacks.join(','));
        }
        if (opts.bpmMin) audiusParams.set('bpmMin', String(Math.round(opts.bpmMin)));
        if (opts.bpmMax) audiusParams.set('bpmMax', String(Math.round(opts.bpmMax)));
        if (opts.harmonicTarget !== undefined) {
          audiusParams.set('harmonicTarget', String(opts.harmonicTarget));
        }
        audiusParams.set('sort', opts.sort || 'popular');
        audiusParams.set('limit', '18');
        audiusParams.set('offset', String(nextOffset));

        if (isAppend) {
          const audRes = await fetch(`/api/streaming/search?${audiusParams.toString()}`, {
            signal: AbortSignal.timeout(9000),
          });
          const audJson = (await audRes.json()) as {
            tracks?: AudiusStreamTrack[];
            hasMore?: boolean;
            nextOffset?: number;
            provider?: string;
          };
          if (myToken !== fetchTokenRef.current) return;
          const incoming = audJson.tracks ?? [];
          setAudiusTracks((prev) => {
            const seen = new Set(prev.map((t) => t.id));
            return [...prev, ...incoming.filter((t) => !seen.has(t.id))];
          });
          setStreamOffset(audJson.nextOffset ?? nextOffset + 18);
          setHasMoreStreams(Boolean(audJson.hasMore && incoming.length > 0));
          if (audJson.provider) setProvidersLabel(audJson.provider);
          return;
        }

        // Start radio lookup concurrently in background so radio latency NEVER stalls music playback
        const radioParams = new URLSearchParams();
        if (opts.radioTag) {
          radioParams.set('tag', opts.radioTag);
        } else if (opts.q) {
          radioParams.set('search', opts.q);
        } else if (opts.countryCode) {
          radioParams.set('countrycode', opts.countryCode);
        }
        radioParams.set('limit', '12');

        void fetch(`/api/radio/stations?${radioParams.toString()}`, {
          signal: AbortSignal.timeout(8000),
        })
          .then((r) => (r.ok ? (r.json() as Promise<{ stations?: RadioStation[] }>) : null))
          .then((radJson) => {
            if (myToken !== fetchTokenRef.current || !radJson?.stations) return;
            setRadioStations(radJson.stations);
          })
          .catch(() => {});

        const audRes = await fetch(`/api/streaming/search?${audiusParams.toString()}`, {
          signal: AbortSignal.timeout(9500),
        });

        if (myToken !== fetchTokenRef.current) return;

        let audJson = (await audRes.json()) as {
          tracks?: AudiusStreamTrack[];
          hasMore?: boolean;
          nextOffset?: number;
          provider?: string;
          error?: string;
        };

        let incoming = audJson.tracks ?? [];

        // Client-side emergency fallback to trending if primary category returned < 5 streams
        if (incoming.length < 5) {
          try {
            const trendRes = await fetch('/api/streaming/search?mode=trending&sort=popular&limit=18', {
              signal: AbortSignal.timeout(7000),
            });
            if (trendRes.ok && myToken === fetchTokenRef.current) {
              const trendJson = (await trendRes.json()) as {
                tracks?: AudiusStreamTrack[];
                provider?: string;
              };
              const seen = new Set(incoming.map((t) => t.id));
              for (const tr of trendJson.tracks ?? []) {
                if (!seen.has(tr.id)) {
                  seen.add(tr.id);
                  incoming.push(tr);
                }
              }
              if (trendJson.provider && !audJson.provider) {
                audJson.provider = trendJson.provider;
              }
            }
          } catch {
            // Keep existing incoming
          }
        }

        if (myToken !== fetchTokenRef.current) return;

        if (opts.bpmMin || opts.bpmMax || opts.harmonicTarget !== undefined) {
          const centerBpm =
            opts.bpmMin && opts.bpmMax
              ? (opts.bpmMin + opts.bpmMax) / 2
              : opts.bpmMin || opts.bpmMax || 104;
          incoming = rankRawTracksByAcousticTarget(
            incoming,
            centerBpm,
            opts.harmonicTarget ?? 0.56
          );
        }

        const resolvedOffset = audJson.nextOffset ?? incoming.length;
        setAudiusTracks(incoming);
        setStreamOffset(resolvedOffset);
        setHasMoreStreams(Boolean(audJson.hasMore ?? incoming.length >= 10));
        if (audJson.provider) setProvidersLabel(audJson.provider);

        if (incoming.length === 0) {
          setStreamError(audJson.error || 'No matching streams returned.');
        }

        const playableBatch = incoming
          .map(audiusToTrack)
          .filter((t) => !dislikedIdsRef.current.has(t.id) && Boolean(t.streamUrl));
        const batchSeed: StreamSeedContext = {
          query: opts.q,
          genre: opts.genre,
          mood: opts.mood,
          tags: opts.tags,
          sort: opts.sort || 'popular',
          mode: opts.q || opts.mood || opts.tags ? 'search' : 'trending',
          offset: resolvedOffset,
          targetBpmMin: opts.bpmMin,
          targetBpmMax: opts.bpmMax,
          harmonicTarget: opts.harmonicTarget,
        };

        if (playableBatch.length > 0 && !isAppend) {
          onTracksLoadedRef.current?.(playableBatch, batchSeed);
        }

        if (opts.autoPlayOnLoad) {
          if (playableBatch.length > 0) {
            onPlayExternalQueueRef.current(
              playableBatch,
              Boolean(opts.shuffleOnLoad),
              batchSeed,
              opts.crossfadeOnLoad ? { crossfade: true, crossfadeMs: 2200 } : undefined
            );
            if (opts.channelIdForLoad) {
              setPlayingChannelId(opts.channelIdForLoad);
            }
            if (opts.channelLabel) {
              onShowNoticeRef.current?.(
                opts.crossfadeOnLoad
                  ? `Cross-fading into ${opts.channelLabel}`
                  : `Now streaming ${opts.channelLabel} · Infinite Mix`
              );
            }
          } else {
            onShowNoticeRef.current?.('No matching playable tracks found for this channel.');
          }
        }
      } catch (err) {
        if (myToken !== fetchTokenRef.current) return;
        if (!isAppend) {
          const message =
            err instanceof Error ? err.message : 'Unable to reach streaming services.';
          setStreamError(message);
          if (opts.autoPlayOnLoad) {
            onShowNoticeRef.current?.('Could not start stream right now. Please try again.');
          }
        }
      } finally {
        if (isAppend) {
          if (myToken === fetchTokenRef.current) {
            setLoadingMore(false);
          }
        } else {
          if (myToken === fetchTokenRef.current) {
            setLoadingStreams(false);
            setLoadingChannelId(null);
          } else if (opts.channelIdForLoad) {
            setLoadingChannelId((curr) => (curr === opts.channelIdForLoad ? null : curr));
          }
        }
      }
    },
    [rankRawTracksByAcousticTarget]
  );

  // Initial load: run once per geoProfile countryCode (never reset selected channel when playback state ticks)
  useEffect(() => {
    if (!geoProfile) return;
    if (initializedCountryRef.current === geoProfile.countryCode) return;
    initializedCountryRef.current = geoProfile.countryCode;

    setActiveGenreChip('');
    const defaultChannel = CURATED_CHANNELS[0];
    setActiveChannelId(defaultChannel.id);
    onMoodHintChangeRef.current?.(defaultChannel.id);
    void runGlobalFetch({
      q: defaultChannel.query,
      genre: defaultChannel.genre,
      mood: defaultChannel.label,
      tags: defaultChannel.tags.join(','),
      fallbacks: defaultChannel.fallbackQueries,
      sort: 'popular',
      countryCode: geoProfile.countryCode,
    });
  }, [geoProfile, runGlobalFetch]);

  const closeDetailSheet = useCallback(() => {
    setDetailSheetVisible(false);
    window.setTimeout(() => {
      setDetailChannel(null);
    }, 320);
  }, []);

  // Escape key dismisses detail sheet cleanly
  useEffect(() => {
    if (!detailChannel) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDetailSheet();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeDetailSheet, detailChannel]);

  const handleLoadMore = useCallback(() => {
    if (loadingStreams || loadingMore || !hasMoreStreams) return;
    void runGlobalFetch({
      ...activeFetchOptsRef.current,
      append: true,
      offset: streamOffset,
    });
  }, [hasMoreStreams, loadingMore, loadingStreams, runGlobalFetch, streamOffset]);

  // Continuous scroll pagination for Audius + Jamendo streaming list
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMoreStreams || loadingStreams) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: '240px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMore, hasMoreStreams, loadingStreams]);

  const currentSeed: StreamSeedContext = useMemo(
    () => ({
      query: activeFetchOptsRef.current.q,
      genre: activeFetchOptsRef.current.genre,
      mood: activeFetchOptsRef.current.mood,
      tags: activeFetchOptsRef.current.tags,
      sort: activeFetchOptsRef.current.sort || 'popular',
      mode: activeFetchOptsRef.current.mode,
      offset: streamOffset,
      targetBpmMin: activeFetchOptsRef.current.bpmMin,
      targetBpmMax: activeFetchOptsRef.current.bpmMax,
      harmonicTarget: activeFetchOptsRef.current.harmonicTarget,
    }),
    [streamOffset]
  );

  const handleChannelTrigger = (
    channel: CuratedChannel,
    opts: { openSheet?: boolean; autoPlay?: boolean; shuffle?: boolean } = {}
  ) => {
    const { openSheet = false, autoPlay = true, shuffle = false } = opts;

    const isSameActiveChannel = activeChannelId === channel.id && !loadingStreams;
    const isCurrentlyStreamingThis =
      isSameActiveChannel &&
      (playingChannelId === channel.id || isPlayingCurrentChannel) &&
      activeChannelTrackSet.has(currentTrackId || '');

    if (openSheet) {
      setDetailChannel(channel);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setDetailSheetVisible(true));
      });
    }

    onMoodHintChange?.(`${channel.id} ${channel.label} ${channel.tags.join(' ')}`);

    // If user tapped the floating play/pause button on a card that is already active in queue, toggle cleanly
    if (
      !openSheet &&
      autoPlay &&
      isSameActiveChannel &&
      normalizedAudiusTracks.length > 0 &&
      isCurrentlyStreamingThis &&
      onTogglePlayPause
    ) {
      onTogglePlayPause();
      return;
    }

    setActiveChannelId(channel.id);
    setActiveGenreChip('');
    setSearchQuery('');

    if (onSuggestVisualizer) {
      onSuggestVisualizer(channel.visualizerStyle);
    }

    // If tracks for this exact channel are already loaded in memory, immediately start Infinite Mix!
    if (isSameActiveChannel && normalizedAudiusTracks.length > 0 && autoPlay) {
      onPlayExternalQueue(normalizedAudiusTracks, shuffle, currentSeed);
      setPlayingChannelId(channel.id);
      onShowNotice?.(`Now streaming ${channel.label} · Infinite Mix`);
      return;
    }

    if (autoPlay) {
      onShowNotice?.(`Loading ${channel.label} mix...`);
    }

    void runGlobalFetch({
      q: channel.query,
      genre: channel.genre,
      mood: channel.label,
      tags: channel.tags.join(','),
      fallbacks: channel.fallbackQueries,
      sort: 'popular',
      radioTag: channel.radioTag,
      autoPlayOnLoad: autoPlay,
      shuffleOnLoad: shuffle,
      channelIdForLoad: channel.id,
      channelLabel: channel.label,
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setActiveChannelId('');
    setPlayingChannelId(null);
    setActiveGenreChip('');
    onMoodHintChange?.(q);
    void runGlobalFetch({ q, sort: 'popular', radioTag: q.toLowerCase() });
  };

  const handleGenreClick = (genre: string) => {
    setActiveChannelId('');
    setPlayingChannelId(null);
    setActiveGenreChip(genre);
    setSearchQuery(genre);
    onMoodHintChange?.(genre);
    void runGlobalFetch({ q: genre, genre, sort: 'popular', radioTag: genre.toLowerCase() });
  };

  const handleAskAiMood = async (
    moodText: string,
    explicitAcoustic?: { targetBpm?: number; harmonicIntensity?: number }
  ) => {
    const clean = moodText.trim();
    if (!clean) return;
    setActiveChannelId('');
    setPlayingChannelId(null);
    setActiveEmotionalState(clean);
    setMoodInput(clean);
    setLoadingAi(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: clean,
          country: geoProfile?.country || 'Global',
          countryCode: geoProfile?.countryCode || '',
          ...(explicitAcoustic?.targetBpm ? { targetBpm: explicitAcoustic.targetBpm } : {}),
          ...(explicitAcoustic?.harmonicIntensity !== undefined
            ? { harmonicIntensity: explicitAcoustic.harmonicIntensity }
            : {}),
        }),
      });
      const data = (await res.json()) as AIMoodPlan & { error?: string };
      if (!res.ok) {
        setAiError(data.error || 'AI mood synthesis failed.');
        return;
      }

      const synthMidBpm = Math.round((data.targetBpmMin + data.targetBpmMax) / 2);
      setTargetBpm(synthMidBpm);
      setTargetHarmonic(data.harmonicIntensity);
      setAiPlan(data);
      onSynthPlanChangeRef.current?.(data);

      onMoodHintChangeRef.current?.(data.moodEnvironment || clean);
      if (data.visualizerStyle && onSuggestVisualizer) {
        onSuggestVisualizer(data.visualizerStyle);
      }

      const firstQuery = data.audiusQueries?.[0] || data.recommendedGenres?.[0] || clean;
      const firstTag = data.radioTags?.[0] || firstQuery.toLowerCase();
      await runGlobalFetch({
        q: firstQuery,
        mood: clean,
        tags: data.recommendedGenres?.slice(0, 3).map((g) => g.toLowerCase()).join(','),
        fallbacks: data.audiusQueries,
        sort: 'popular',
        radioTag: firstTag,
        bpmMin: data.targetBpmMin,
        bpmMax: data.targetBpmMax,
        harmonicTarget: data.harmonicIntensity,
        autoPlayOnLoad: true,
        crossfadeOnLoad: true,
        channelLabel: `${data.moodTitle} (${synthMidBpm} BPM)`,
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not reach AI mood synthesizer.');
    } finally {
      setLoadingAi(false);
    }
  };

  const applyManualTempoHarmonicSynthesis = useCallback(
    async (nextBpm: number, nextHarmonic: number, forcePlay = false) => {
      const bpmMin = Math.max(54, nextBpm - 12);
      const bpmMax = Math.min(186, nextBpm + 12);

      // Update live synthesizer plan & downstream 3D Quantum Visualizer + Audio Engine immediately
      const prevPlan = aiPlanRef.current;
      const updatedPlan: AIMoodPlan = prevPlan
        ? {
            ...prevPlan,
            targetBpmMin: bpmMin,
            targetBpmMax: bpmMax,
            harmonicIntensity: nextHarmonic,
          }
        : {
            moodTitle: `${nextBpm} BPM Harmonic Synthesis`,
            emotionalState: activeEmotionalState || 'Custom Tempo',
            rationale: `Real-time acoustic lock at ${nextBpm} BPM and ${Math.round(
              nextHarmonic * 100
            )}% harmonic intensity.`,
            targetBpmMin: bpmMin,
            targetBpmMax: bpmMax,
            harmonicIntensity: nextHarmonic,
            recommendedGenres:
              nextBpm >= 124
                ? ['Electronic', 'House', 'Techno']
                : nextBpm <= 82
                  ? ['Ambient', 'Acoustic', 'Lo-Fi']
                  : ['Synthwave', 'Chillhop', 'Indie'],
            radioTags: [nextBpm >= 124 ? 'electronic' : nextBpm <= 82 ? 'ambient' : 'lofi'],
            audiusQueries: [
              nextBpm >= 124
                ? 'electronic house bass'
                : nextBpm <= 82
                  ? 'ambient piano lofi'
                  : 'synthwave chillhop',
            ],
            visualizerStyle:
              nextBpm >= 124 ? 'spectrum' : nextBpm <= 82 ? 'radial' : 'kinetic',
            quantumMode: nextHarmonic >= 0.72 ? 'nebula' : nextBpm <= 82 ? 'neural' : 'quantum',
            moodEnvironment:
              nextBpm >= 126 ? 'energy' : nextBpm <= 80 ? 'rain' : 'aurora',
            curationSource: 'acoustic-engine',
          };
      setAiPlan(updatedPlan);
      onSynthPlanChangeRef.current?.(updatedPlan);

      // Check how many loaded tracks already fit inside the target BPM window
      const inWindow = audiusTracks.filter(
        (t) => (t.bpm ?? 104) >= bpmMin - 4 && (t.bpm ?? 104) <= bpmMax + 4
      );

      if (inWindow.length >= 4 && !forcePlay) {
        const reranked = rankRawTracksByAcousticTarget(audiusTracks, nextBpm, nextHarmonic);
        setAudiusTracks(reranked);
        const playable = reranked
          .map(audiusToTrack)
          .filter((t) => !dislikedIdsRef.current.has(t.id) && Boolean(t.streamUrl));
        if (playable.length > 0 && (isPlaying || forcePlay) && playable[0].id !== currentTrackId) {
          onPlayExternalQueueRef.current(
            playable,
            false,
            {
              ...currentSeed,
              targetBpmMin: bpmMin,
              targetBpmMax: bpmMax,
              harmonicTarget: nextHarmonic,
            },
            { crossfade: true, crossfadeMs: 2200 }
          );
          onShowNoticeRef.current?.(
            `Cross-fading to ${nextBpm} BPM · ${Math.round(nextHarmonic * 100)}% intensity`
          );
        }
        return;
      }

      const fallbackQuery =
        nextBpm >= 126
          ? 'electronic house dance'
          : nextBpm <= 80
            ? 'ambient piano acoustic'
            : 'synthwave lofi chill';
      await runGlobalFetch({
        q: aiPlan?.audiusQueries?.[0] || fallbackQuery,
        mood: activeEmotionalState || moodInput || fallbackQuery,
        sort: 'popular',
        bpmMin,
        bpmMax,
        harmonicTarget: nextHarmonic,
        autoPlayOnLoad: isPlaying || forcePlay,
        crossfadeOnLoad: true,
        channelLabel: `${nextBpm} BPM Synthesis`,
      });
    },
    [
      activeEmotionalState,
      aiPlan?.audiusQueries,
      audiusTracks,
      currentSeed,
      currentTrackId,
      isPlaying,
      moodInput,
      rankRawTracksByAcousticTarget,
      runGlobalFetch,
    ]
  );

  const activeChannel = CURATED_CHANNELS.find((c) => c.id === activeChannelId) ?? null;
  const heroChannel = CURATED_CHANNELS[0];
  const isHeroChannelPlaying =
    (playingChannelId === heroChannel.id || activeChannelId === heroChannel.id) &&
    isPlayingCurrentChannel;
  const isHeroChannelLoading = loadingChannelId === heroChannel.id && loadingStreams;

  return (
    <div className="space-y-8">
      {/* 1. Luxury Full-Bleed Featured Hero Banner: Deep Focus & Flow State */}
      <section
        className="relative overflow-hidden rounded-3xl border shadow-2xl"
        style={{
          borderColor: 'color-mix(in srgb, var(--accent-primary) 35%, var(--border-hairline))',
          minHeight: '300px',
        }}
      >
        {/* Atmospheric Fallback & Aurora Mesh Underlay */}
        <div
          className="absolute inset-0"
          style={{
            background: heroChannel.auroraGradient,
          }}
        />

        {/* Editorial Hero Artwork */}
        <img
          src={heroDeepFocusImg}
          alt="Deep Focus & Flow State atmospheric architectural light"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover scale-[1.02] transition-transform duration-700"
        />

        {/* Moving Aurora Light Sheen */}
        <div
          className="sonance-aurora-sheen absolute inset-0 pointer-events-none opacity-65 mix-blend-screen"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 25%, rgba(56, 189, 248, 0.35), transparent 48%), radial-gradient(circle at 80% 75%, rgba(168, 85, 247, 0.32), transparent 52%)',
          }}
        />

        {/* Measured Contrast Scrim for Guaranteed Legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/30" />

        {/* Foreground Content */}
        <div className="relative z-10 flex flex-col justify-between gap-8 p-6 sm:p-8 min-h-[300px] sm:min-h-[340px]">
          {/* Top Bar: Featured Pill + Region Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/12 backdrop-blur-md border border-white/20 px-3.5 py-1.5 text-[11px] font-semibold tracking-wider uppercase text-white">
              <Sparkles className="w-3.5 h-3.5 text-sky-300" />
              <span>Featured Editorial Mix</span>
              {geoProfile && (
                <span className="hidden sm:inline text-white/75 font-mono-tabular">
                  · {geoProfile.countryCode}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-full bg-black/45 backdrop-blur-md border border-white/15 px-3 py-1.5">
              <Globe className="w-3.5 h-3.5 text-white/80 shrink-0" />
              <select
                aria-label="Select region for charts"
                value={selectedCountry}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCountry(val);
                  onChangeRegionOverride(val);
                }}
                className="bg-transparent text-xs font-medium text-white focus:outline-none cursor-pointer pr-1"
              >
                {REGION_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code} className="bg-zinc-900 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bottom Editorial Title + Glassmorphic Play Mix Action */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div className="max-w-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono-tabular text-sky-300">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {providersLabel} · Popularity-Ranked Infinite Stream
                </span>
              </div>
              <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white leading-[1.08]">
                Deep Focus &amp; Flow State
              </h2>
              <p className="text-sm text-white/80 leading-relaxed max-w-lg">
                Immerse yourself in studio-mastered binaural soundscapes, minimal acoustic piano,
                and uninterrupted infinite mixes built for deep concentration.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  void triggerHapticMedium();
                  handleChannelTrigger(heroChannel, { openSheet: false, autoPlay: true });
                }}
                className="sonance-press inline-flex items-center justify-center gap-2.5 min-h-[48px] px-6 rounded-full bg-white/18 hover:bg-white/25 backdrop-blur-xl border border-white/30 text-sm font-semibold text-white shadow-xl transition-all"
              >
                {isHeroChannelLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isHeroChannelPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
                <span>
                  {isHeroChannelLoading
                    ? 'Loading Mix...'
                    : isHeroChannelPlaying
                      ? 'Pause Mix'
                      : 'Play Mix'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  void triggerHapticLight();
                  handleChannelTrigger(heroChannel, { openSheet: true, autoPlay: false });
                }}
                className="sonance-press inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-full bg-black/40 hover:bg-black/55 backdrop-blur-md border border-white/20 text-xs font-semibold text-white/90 transition-all"
              >
                <span>View Mix</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Responsive 2-Column Editorial Mood & Utility Showcase (10 Curated Channels) */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3 px-0.5">
          <div>
            <p
              className="text-[11px] font-mono-tabular uppercase tracking-widest"
              style={{ color: 'var(--accent-primary)' }}
            >
              Curated Soundscapes &amp; Channels
            </p>
            <h3 className="font-display text-lg sm:text-xl font-bold tracking-tight mt-0.5">
              Soundtrack Every State of Mind
            </h3>
          </div>
          <span
            className="text-xs font-mono-tabular whitespace-nowrap"
            style={{ color: 'var(--text-muted)' }}
          >
            10 Editorial Mixes
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3.5 sm:gap-5">
          {CURATED_CHANNELS.map((channel) => {
            const Icon = channel.icon;
            const isSelected = activeChannelId === channel.id;
            const isChannelLoading = loadingChannelId === channel.id && loadingStreams;
            const isChannelActivelyPlaying =
              (playingChannelId === channel.id || isSelected) && isPlayingCurrentChannel;

            return (
              <div
                key={channel.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Open and play ${channel.label}`}
                onClick={() => {
                  void triggerHapticLight();
                  handleChannelTrigger(channel, { openSheet: true, autoPlay: true });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void triggerHapticLight();
                    handleChannelTrigger(channel, { openSheet: true, autoPlay: true });
                  }
                }}
                className="group relative aspect-[4/5] min-h-[228px] sm:min-h-[300px] rounded-3xl overflow-hidden cursor-pointer select-none transition-all duration-300 active:scale-95 focus:outline-none focus-visible:ring-2"
                style={{
                  border: isSelected
                    ? '1.5px solid var(--accent-primary)'
                    : '1px solid rgba(255, 255, 255, 0.14)',
                  boxShadow: isSelected
                    ? `0 18px 42px -12px ${channel.glowColor}, 0 0 0 1px rgba(255,255,255,0.12)`
                    : '0 14px 32px -16px rgba(0, 0, 0, 0.55)',
                }}
              >
                {/* Atmospheric Aurora Gradient Fallback */}
                <div
                  className="absolute inset-0"
                  style={{ background: channel.auroraGradient }}
                />

                {/* Editorial Channel Artwork */}
                <img
                  src={channel.artwork}
                  alt={channel.label}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />

                {/* Subtle Animated Aurora Glow Overlay */}
                <div
                  className="sonance-aurora-sheen absolute inset-0 pointer-events-none opacity-45 group-hover:opacity-65 transition-opacity"
                  style={{ background: channel.auroraGradient, mixBlendMode: 'soft-light' }}
                />

                {/* Delicate Acoustic Wave Contour */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 400 220"
                  className="absolute inset-x-0 bottom-14 w-full opacity-20 pointer-events-none text-white"
                  fill="none"
                >
                  <path
                    d="M0 140 Q 85 95, 180 138 T 400 120"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <path
                    d="M0 165 Q 115 125, 220 162 T 400 148"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="4 6"
                  />
                </svg>

                {/* Measured Dark Gradient Scrim (>= 4.5:1 Contrast) */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/20" />

                {/* Card Foreground Layout */}
                <div className="relative z-10 h-full flex flex-col justify-between p-3.5 sm:p-5">
                  {/* Top Row: Glassmorphic LIVE MIX Badge + Channel Icon */}
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full backdrop-blur-md px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase text-white border"
                      style={{
                        backgroundColor: isChannelActivelyPlaying
                          ? 'rgba(16, 185, 129, 0.28)'
                          : 'rgba(0, 0, 0, 0.36)',
                        borderColor: isChannelActivelyPlaying
                          ? 'rgba(52, 211, 153, 0.55)'
                          : 'rgba(255, 255, 255, 0.2)',
                      }}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isChannelActivelyPlaying
                            ? 'bg-emerald-400 animate-pulse'
                            : 'bg-white/80'
                        }`}
                      />
                      <span>
                        {isChannelLoading
                          ? 'SYNCING'
                          : isChannelActivelyPlaying
                            ? 'PLAYING'
                            : channel.badge}
                      </span>
                    </span>

                    <div className="w-8 h-8 rounded-full bg-black/35 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/90 shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Bottom Row: Title/Description + Floating Glowing Play Button */}
                  <div className="flex items-end justify-between gap-2.5">
                    <div className="min-w-0 flex-1 space-y-1">
                      <h4 className="font-display text-sm sm:text-lg font-bold tracking-tight text-white leading-snug line-clamp-2 drop-shadow-sm">
                        {channel.label}
                      </h4>
                      <p className="text-[11px] sm:text-xs text-white/80 leading-snug line-clamp-2">
                        {channel.subtitle}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void triggerHapticMedium();
                        handleChannelTrigger(channel, { openSheet: false, autoPlay: true });
                      }}
                      aria-label={
                        isChannelActivelyPlaying
                          ? `Pause ${channel.label}`
                          : `Play ${channel.label} mix`
                      }
                      className="sonance-press min-w-[44px] min-h-[44px] w-11 h-11 rounded-full flex items-center justify-center shrink-0 border border-white/30 backdrop-blur-xl transition-transform hover:scale-105"
                      style={{
                        backgroundColor: isChannelActivelyPlaying
                          ? 'var(--accent-primary)'
                          : 'rgba(255, 255, 255, 0.2)',
                        color: isChannelActivelyPlaying ? 'var(--accent-contrast)' : '#ffffff',
                        boxShadow: `0 8px 24px -4px ${channel.glowColor}`,
                      }}
                    >
                      {isChannelLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isChannelActivelyPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Global Search & Regional Quick-Filters */}
      <section
        className="sonance-glass rounded-3xl border p-4 sm:p-5 space-y-4 shadow-xs"
        style={{
          borderColor: 'var(--border-hairline)',
        }}
      >
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search custom vibe, Lo-Fi, Chillhop, Ambient, Acoustic, or Instrumental..."
              className="w-full min-h-[42px] rounded-xl border pl-10 pr-4 text-sm focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loadingStreams}
            onClick={() => void triggerHapticLight()}
            className="sonance-press min-h-[44px] px-5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 hover:opacity-90 disabled:opacity-60"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
          >
            {loadingStreams ? 'Searching...' : 'Search Global'}
          </button>
        </form>

        {geoProfile && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium pr-1" style={{ color: 'var(--text-muted)' }}>
              Regional highlights ({geoProfile.country}):
            </span>
            {geoProfile.recommendedGenres.map((genre) => {
              const active = activeGenreChip === genre;
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => {
                    void triggerHapticLight();
                    handleGenreClick(genre);
                  }}
                  className="sonance-press min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-medium whitespace-nowrap"
                  style={{
                    backgroundColor: active
                      ? 'var(--accent-primary)'
                      : 'color-mix(in srgb, var(--bg-canvas) 80%, transparent)',
                    borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                    color: active ? 'var(--accent-contrast)' : 'var(--text-primary)',
                  }}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. AI-Driven Dynamic Mood & Tempo Synthesizer */}
      <section
        className="sonance-glass rounded-3xl border p-5 sm:p-6 space-y-4 shadow-xs"
        style={{
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
            <h3 className="font-display text-base font-semibold tracking-tight">
              AI Dynamic Mood &amp; Tempo Synthesizer
            </h3>
          </div>
          <span className="text-xs font-mono-tabular" style={{ color: 'var(--text-muted)' }}>
            {isCrossfading
              ? 'Dual-Deck Crossfading...'
              : `${targetBpm} BPM · ${Math.round(targetHarmonic * 100)}% Harmonic`}
          </span>
        </div>

        {/* Emotional State Presets */}
        <div className="flex flex-wrap gap-2">
          {SYNTH_EMOTIONAL_PRESETS.map((preset) => {
            const active =
              activeEmotionalState.toLowerCase() === preset.label.toLowerCase();
            return (
              <button
                key={preset.label}
                type="button"
                disabled={loadingAi}
                onClick={() => {
                  void triggerHapticLight();
                  setTargetBpm(preset.targetBpm);
                  setTargetHarmonic(preset.harmonicIntensity);
                  void handleAskAiMood(preset.label, {
                    targetBpm: preset.targetBpm,
                    harmonicIntensity: preset.harmonicIntensity,
                  });
                }}
                className="sonance-press min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0 hover:opacity-90 disabled:opacity-60"
                style={{
                  backgroundColor: active
                    ? 'var(--accent-primary)'
                    : 'color-mix(in srgb, var(--bg-elevated) 72%, transparent)',
                  borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                  color: active ? 'var(--accent-contrast)' : 'var(--text-primary)',
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Live Target BPM & Harmonic Intensity Sliders */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border p-3.5"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-canvas) 75%, transparent)',
            borderColor: 'var(--border-hairline)',
          }}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="synth-bpm-slider" className="font-medium">
                Target Tempo
              </label>
              <span
                className="font-mono-tabular font-semibold"
                style={{ color: 'var(--accent-primary)' }}
              >
                {targetBpm} BPM
              </span>
            </div>
            <input
              id="synth-bpm-slider"
              type="range"
              min={60}
              max={170}
              step={2}
              value={targetBpm}
              onChange={(e) => setTargetBpm(parseInt(e.target.value, 10))}
              onMouseUp={() => void applyManualTempoHarmonicSynthesis(targetBpm, targetHarmonic)}
              onTouchEnd={() => void applyManualTempoHarmonicSynthesis(targetBpm, targetHarmonic)}
              onKeyUp={() => void applyManualTempoHarmonicSynthesis(targetBpm, targetHarmonic)}
              className="sonance-slider w-full"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="synth-harmonic-slider" className="font-medium">
                Harmonic Intensity
              </label>
              <span
                className="font-mono-tabular font-semibold"
                style={{ color: 'var(--accent-primary)' }}
              >
                {Math.round(targetHarmonic * 100)}%
              </span>
            </div>
            <input
              id="synth-harmonic-slider"
              type="range"
              min={0.1}
              max={1}
              step={0.02}
              value={targetHarmonic}
              onChange={(e) => setTargetHarmonic(parseFloat(e.target.value))}
              onMouseUp={() => void applyManualTempoHarmonicSynthesis(targetBpm, targetHarmonic)}
              onTouchEnd={() => void applyManualTempoHarmonicSynthesis(targetBpm, targetHarmonic)}
              onKeyUp={() => void applyManualTempoHarmonicSynthesis(targetBpm, targetHarmonic)}
              className="sonance-slider w-full"
            />
          </div>
        </div>

        {/* Natural-Language Mood Prompt + Cross-Fade Synthesize Action */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (moodInput.trim()) {
              void handleAskAiMood(moodInput);
            } else {
              void applyManualTempoHarmonicSynthesis(targetBpm, targetHarmonic, true);
            }
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <input
            type="text"
            value={moodInput}
            onChange={(e) => setMoodInput(e.target.value)}
            placeholder="Describe an emotional state, tempo, or scene (e.g. euphoric Tokyo night drive, melancholic rain)..."
            className="flex-1 min-h-[40px] rounded-xl border px-3.5 text-sm focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-hairline)',
              color: 'var(--text-primary)',
            }}
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              disabled={loadingAi}
              className="sonance-press min-h-[40px] px-4 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
              }}
            >
              {loadingAi
                ? 'Synthesizing...'
                : moodInput.trim()
                  ? 'Synthesize & Cross-Fade'
                  : 'Cross-Fade Mix'}
            </button>
          </div>
        </form>

        {aiError && (
          <p className="text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>
            {aiError}
          </p>
        )}

        {aiPlan && (
          <div
            className="rounded-xl border p-4 space-y-3"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-hairline)',
            }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-bold">{aiPlan.moodTitle}</h4>
              <span className="text-xs font-mono-tabular" style={{ color: 'var(--text-muted)' }}>
                {aiPlan.targetBpmMin}–{aiPlan.targetBpmMax} BPM ·{' '}
                {Math.round(aiPlan.harmonicIntensity * 100)}% intensity · 3D{' '}
                {aiPlan.quantumMode || aiPlan.visualizerStyle}
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {aiPlan.rationale}
            </p>
            <div className="flex flex-wrap gap-2">
              {aiPlan.audiusQueries?.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() =>
                    void runGlobalFetch({
                      q,
                      sort: 'popular',
                      bpmMin: aiPlan.targetBpmMin,
                      bpmMax: aiPlan.targetBpmMax,
                      harmonicTarget: aiPlan.harmonicIntensity,
                      autoPlayOnLoad: true,
                      crossfadeOnLoad: true,
                      channelLabel: q,
                    })
                  }
                  className="px-2.5 py-1 rounded-md border text-xs font-medium hover:opacity-80"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                >
                  Tracks: {q}
                </button>
              ))}
              {aiPlan.radioTags?.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => void runGlobalFetch({ q: searchQuery || tag, radioTag: tag })}
                  className="px-2.5 py-1 rounded-md border text-xs font-medium hover:opacity-80"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  Radio: #{tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {streamError && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {streamError}
        </p>
      )}

      {/* 5. Active Stream Queue (Audius + Jamendo Infinite Queue) */}
      <section className="space-y-3">
        <div
          className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Disc3 className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
            <h3 className="text-base font-semibold tracking-tight truncate">
              {activeChannel ? activeChannel.label : 'Curated Stream Queue'}
            </h3>
            <span className="font-mono-tabular text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
              {normalizedAudiusTracks.length} · {providersLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                onToggleInfiniteQueue();
              }}
              aria-pressed={infiniteQueueEnabled}
              className="sonance-press inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0"
              style={{
                backgroundColor: infiniteQueueEnabled ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                borderColor: infiniteQueueEnabled
                  ? 'var(--accent-primary)'
                  : 'var(--border-hairline)',
                color: infiniteQueueEnabled ? 'var(--accent-primary)' : 'var(--text-muted)',
              }}
            >
              <InfinityIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{infiniteQueueEnabled ? 'Infinite Queue On' : 'Infinite Queue Off'}</span>
            </button>

            {normalizedAudiusTracks.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    void triggerHapticMedium();
                    onPlayExternalQueue(normalizedAudiusTracks, false, currentSeed);
                    if (activeChannel) setPlayingChannelId(activeChannel.id);
                  }}
                  className="sonance-press inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play All</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void triggerHapticLight();
                    onPlayExternalQueue(normalizedAudiusTracks, true, currentSeed);
                    if (activeChannel) setPlayingChannelId(activeChannel.id);
                  }}
                  className="sonance-press inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Shuffle className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                  <span>Shuffle</span>
                </button>
              </>
            )}
          </div>
        </div>

        {loadingStreams ? (
          <StreamRowSkeleton count={6} />
        ) : normalizedAudiusTracks.length === 0 ? (
          <p className="text-xs py-4" style={{ color: 'var(--text-muted)' }}>
            No streaming tracks loaded for this query yet. Try another channel or search term.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="divide-y" style={{ borderColor: 'var(--border-hairline)' }}>
              {normalizedAudiusTracks.map((track) => {
                const isCurrent = track.id === currentTrackId;
                const isLoved = lovedIds.has(track.id);
                const isSavedOffline = downloadedSourceIds.has(track.id);
                const progress = downloadProgressMap[track.id];
                const sourceLabel = track.sourceType === 'jamendo' ? 'Jamendo' : 'Audius';

                return (
                  <div
                    key={track.id}
                    className="w-full flex items-center gap-3 py-2.5 px-2.5 rounded-xl transition-colors"
                    style={{
                      backgroundColor: isCurrent
                        ? 'color-mix(in srgb, var(--bg-elevated) 78%, transparent)'
                        : 'transparent',
                      borderColor: 'var(--border-hairline)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void triggerHapticLight();
                        onPlayExternalTrack(track, normalizedAudiusTracks, currentSeed);
                      }}
                      aria-label={
                        isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`
                      }
                      className="sonance-press min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0 rounded-xl"
                      style={{ color: isCurrent ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                    >
                      {isCurrent && isPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void triggerHapticLight();
                        onPlayExternalTrack(track, normalizedAudiusTracks, currentSeed);
                      }}
                      className="sonance-press w-11 h-11 rounded-xl overflow-hidden border shrink-0 flex items-center justify-center"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-hairline)',
                      }}
                    >
                      {track.artworkDataUrl ? (
                        <img
                          src={track.artworkDataUrl}
                          alt={track.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void triggerHapticLight();
                        onPlayExternalTrack(track, normalizedAudiusTracks, currentSeed);
                      }}
                      className="sonance-press flex-1 min-w-0 text-left rounded-lg py-1"
                    >
                      <p
                        className="text-sm font-medium truncate"
                        style={{
                          color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                        }}
                      >
                        {track.title}
                      </p>
                      <p className="text-xs truncate font-mono-tabular" style={{ color: 'var(--text-muted)' }}>
                        {track.artist} · {track.genre}
                        {track.bpm ? ` · ${track.bpm} BPM` : ''}
                        {track.harmonicIntensity !== undefined
                          ? ` · ${Math.round(track.harmonicIntensity * 100)}% harm`
                          : ''}
                        {formatPlayCount(playCountById.get(track.id))
                          ? ` · ${formatPlayCount(playCountById.get(track.id))}`
                          : ''}{' '}
                        · {sourceLabel}
                      </p>
                    </button>
                    <span
                      className="hidden sm:inline font-mono-tabular text-xs shrink-0 pr-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {formatDuration(track.duration)}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          void triggerHapticMedium();
                          onToggleLove(track);
                        }}
                        aria-label={
                          isLoved
                            ? `Remove ${track.title} from Liked Songs`
                            : `Love ${track.title}`
                        }
                        className="sonance-press min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl border"
                        style={{
                          borderColor: isLoved ? 'var(--accent-primary)' : 'var(--border-hairline)',
                          color: isLoved ? 'var(--accent-primary)' : 'var(--text-muted)',
                        }}
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            isLoved ? 'fill-current sonance-heart-liked' : ''
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void triggerHapticLight();
                          onDislikeAndSkip(track);
                        }}
                        aria-label={`Dislike ${track.title}`}
                        className="sonance-press min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl border hover:opacity-80"
                        style={{
                          borderColor: 'var(--border-hairline)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                      <DownloadButton
                        compact
                        isDownloaded={isSavedOffline}
                        progress={progress}
                        trackTitle={track.title}
                        onDownload={(e) => {
                          e.stopPropagation();
                          void triggerHapticLight();
                          onDownloadTrack(track);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMoreStreams && (
              <div ref={loadMoreSentinelRef} className="pt-2 flex justify-center">
                {loadingMore ? (
                  <div className="w-full">
                    <StreamRowSkeleton count={2} />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      void triggerHapticLight();
                      handleLoadMore();
                    }}
                    className="sonance-press min-h-[40px] px-4 rounded-xl border text-xs font-medium whitespace-nowrap hover:opacity-85"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    Load More Tracks
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 6. Regional & Mood Live Radio Stations */}
      <section className="space-y-3">
        <div
          className="flex items-center justify-between pb-3 border-b"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
            <h3 className="text-base font-semibold tracking-tight">Live Radio Stations</h3>
            <span className="font-mono-tabular text-xs" style={{ color: 'var(--text-muted)' }}>
              {radioStations.length}
            </span>
          </div>
        </div>

        {loadingStreams && radioStations.length === 0 ? (
          <RadioCardSkeleton count={4} />
        ) : radioStations.length === 0 ? (
          <p className="text-xs py-4" style={{ color: 'var(--text-muted)' }}>
            No matching radio stations found. Try switching regions or exploring the Radio tab.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {radioStations.map((station) => {
              const track = radioToTrack(station);
              const isCurrent = track.id === currentTrackId;
              return (
                <button
                  key={station.stationuuid}
                  type="button"
                  onClick={() => {
                    void triggerHapticLight();
                    onPlayExternalTrack(track, normalizedRadioTracks);
                  }}
                  className="sonance-press sonance-glass flex items-center gap-3 p-3.5 rounded-2xl border text-left hover:opacity-90"
                  style={{
                    borderColor: isCurrent ? 'var(--accent-primary)' : 'var(--border-hairline)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 overflow-hidden"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                    }}
                  >
                    {station.favicon ? (
                      <img
                        src={station.favicon}
                        alt={station.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Radio
                        className="w-4 h-4"
                        style={{
                          color: isCurrent ? 'var(--accent-primary)' : 'var(--text-muted)',
                        }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{
                        color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                      }}
                    >
                      {station.name}
                    </p>
                    <p
                      className="text-xs font-mono-tabular truncate"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {station.country} · {station.codec} · {station.bitrate} kbps
                    </p>
                  </div>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: isCurrent ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                      color: isCurrent ? 'var(--accent-contrast)' : 'var(--text-primary)',
                    }}
                  >
                    {isCurrent && isPlaying ? (
                      <Pause className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 7. Glassmorphic Category Detail Sheet Modal */}
      {detailChannel && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-6"
          style={{
            opacity: detailSheetVisible ? 1 : 0,
            transition: 'opacity 300ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
          onClick={closeDetailSheet}
          role="dialog"
          aria-modal="true"
          aria-label={`${detailChannel.label} mix details`}
        >
          <div
            className="w-full sm:max-w-2xl max-h-[88vh] rounded-t-3xl sm:rounded-3xl overflow-hidden border flex flex-col shadow-2xl will-change-transform"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-hairline)',
              opacity: detailSheetVisible ? 1 : 0,
              transform: detailSheetVisible
                ? 'translate3d(0, 0, 0) scale(1)'
                : 'translate3d(0, 32px, 0) scale(0.97)',
              transition:
                'transform 340ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Editorial Artwork Banner */}
            <div className="relative h-48 sm:h-56 shrink-0 overflow-hidden">
              <div
                className="absolute inset-0"
                style={{ background: detailChannel.auroraGradient }}
              />
              <img
                src={detailChannel.artwork}
                alt={detailChannel.label}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/25" />

              <div className="relative z-10 h-full flex flex-col justify-between p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-3 py-1 text-[10px] font-semibold tracking-wider uppercase text-white">
                    <span>{detailChannel.badge}</span>
                    <span>· {detailChannel.genre}</span>
                  </span>

                  <button
                    type="button"
                    onClick={closeDetailSheet}
                    aria-label="Close channel mix details"
                    className="sonance-press min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-black/45 hover:bg-black/65 backdrop-blur-md border border-white/20 flex items-center justify-center text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1">
                  <h3 className="font-display text-2xl font-bold text-white tracking-tight">
                    {detailChannel.label}
                  </h3>
                  <p className="text-xs text-white/80 line-clamp-2">{detailChannel.subtitle}</p>
                </div>
              </div>
            </div>

            {/* Action Toolbar inside Modal */}
            <div
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b shrink-0"
              style={{ borderColor: 'var(--border-hairline)', backgroundColor: 'var(--bg-surface)' }}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loadingStreams || normalizedAudiusTracks.length === 0}
                  onClick={() => {
                    void triggerHapticMedium();
                    handleChannelTrigger(detailChannel, {
                      openSheet: false,
                      autoPlay: true,
                      shuffle: false,
                    });
                  }}
                  className="sonance-press inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-full text-xs font-semibold disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play Mix</span>
                </button>

                <button
                  type="button"
                  disabled={loadingStreams || normalizedAudiusTracks.length === 0}
                  onClick={() => {
                    void triggerHapticLight();
                    handleChannelTrigger(detailChannel, {
                      openSheet: false,
                      autoPlay: true,
                      shuffle: true,
                    });
                  }}
                  className="sonance-press inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-full border text-xs font-semibold disabled:opacity-50"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Shuffle className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                  <span>Shuffle</span>
                </button>
              </div>

              <span className="text-xs font-mono-tabular" style={{ color: 'var(--text-muted)' }}>
                {loadingStreams
                  ? 'Fetching streams...'
                  : `${normalizedAudiusTracks.length} tracks · Infinite Queue`}
              </span>
            </div>

            {/* Scrollable Tracklist inside Modal */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loadingStreams ? (
                <StreamRowSkeleton count={5} />
              ) : normalizedAudiusTracks.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  No tracks available for this channel right now.
                </p>
              ) : (
                <>
                  {normalizedAudiusTracks.map((track) => {
                    const isCurrent = track.id === currentTrackId;
                    const isLoved = lovedIds.has(track.id);
                    const isSavedOffline = downloadedSourceIds.has(track.id);
                    const progress = downloadProgressMap[track.id];

                    return (
                      <div
                        key={`sheet-${track.id}`}
                        className="flex items-center gap-3 p-2.5 rounded-2xl border transition-colors"
                        style={{
                          backgroundColor: isCurrent
                            ? 'color-mix(in srgb, var(--accent-primary) 10%, var(--bg-surface))'
                            : 'var(--bg-surface)',
                          borderColor: isCurrent
                            ? 'var(--accent-primary)'
                            : 'var(--border-hairline)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            void triggerHapticLight();
                            onPlayExternalTrack(track, normalizedAudiusTracks, currentSeed);
                            setPlayingChannelId(detailChannel.id);
                          }}
                          className="sonance-press flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-white/10 relative flex items-center justify-center bg-black/30">
                            {track.artworkDataUrl ? (
                              <img
                                src={track.artworkDataUrl}
                                alt={track.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Music className="w-4 h-4 text-white/60" />
                            )}
                            <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                              {isCurrent && isPlaying ? (
                                <Pause className="w-4 h-4 text-white fill-current" />
                              ) : (
                                <Play className="w-4 h-4 text-white fill-current ml-0.5 opacity-90" />
                              )}
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p
                              className="text-sm font-semibold truncate"
                              style={{
                                color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                              }}
                            >
                              {track.title}
                            </p>
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                              {track.artist}
                              {formatPlayCount(playCountById.get(track.id))
                                ? ` · ${formatPlayCount(playCountById.get(track.id))}`
                                : ''}
                            </p>
                          </div>
                        </button>

                        <span
                          className="hidden sm:inline font-mono-tabular text-xs shrink-0"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {formatDuration(track.duration)}
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              void triggerHapticMedium();
                              onToggleLove(track);
                            }}
                            aria-label={isLoved ? `Unlike ${track.title}` : `Love ${track.title}`}
                            className="sonance-press min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl border"
                            style={{
                              borderColor: isLoved
                                ? 'var(--accent-primary)'
                                : 'var(--border-hairline)',
                              color: isLoved ? 'var(--accent-primary)' : 'var(--text-muted)',
                            }}
                          >
                            <Heart
                              className={`w-3.5 h-3.5 ${
                                isLoved ? 'fill-current sonance-heart-liked' : ''
                              }`}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              void triggerHapticLight();
                              onDislikeAndSkip(track);
                            }}
                            aria-label={`Dislike ${track.title}`}
                            className="sonance-press min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl border"
                            style={{
                              borderColor: 'var(--border-hairline)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>

                          <DownloadButton
                            compact
                            isDownloaded={isSavedOffline}
                            progress={progress}
                            trackTitle={track.title}
                            onDownload={(e) => {
                              e.stopPropagation();
                              void triggerHapticLight();
                              onDownloadTrack(track);
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {hasMoreStreams && (
                    <div className="pt-2 flex justify-center">
                      <button
                        type="button"
                        disabled={loadingMore}
                        onClick={() => {
                          void triggerHapticLight();
                          handleLoadMore();
                        }}
                        className="sonance-press min-h-[40px] px-4 rounded-xl border text-xs font-medium disabled:opacity-50"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-hairline)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        {loadingMore ? 'Loading more...' : 'Load More Tracks'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
