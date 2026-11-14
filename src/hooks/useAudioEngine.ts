import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ForegroundService, Importance } from '@capawesome-team/capacitor-android-foreground-service';
import {
  AudioAnalysisFrame,
  EQBand,
  EQPresetId,
  PlaybackSource,
  RepeatMode,
  SleepTimerMode,
  Track,
} from '../types/audio';
import { getTrackBlob } from '../utils/db';

export const EQ_PRESETS: Record<EQPresetId, { label: string; gains: number[] }> = {
  flat: { label: 'Flat Reference', gains: [0, 0, 0, 0, 0] },
  bass: { label: 'Sub Bass', gains: [5.5, 3.0, 0, 1.0, 1.5] },
  vocal: { label: 'Vocal Clarity', gains: [-2.0, -0.5, 3.5, 4.0, 1.5] },
  acoustic: { label: 'Acoustic Warmth', gains: [2.5, 1.5, 0.5, 2.5, 3.0] },
  club: { label: 'Club Energy', gains: [6.0, 3.5, -1.0, 2.5, 4.5] },
};

const EQ_FREQUENCIES = [
  { freq: 60, label: '60Hz', type: 'lowshelf' as BiquadFilterType },
  { freq: 230, label: '230Hz', type: 'peaking' as BiquadFilterType },
  { freq: 910, label: '910Hz', type: 'peaking' as BiquadFilterType },
  { freq: 3600, label: '3.6kHz', type: 'peaking' as BiquadFilterType },
  { freq: 14000, label: '14kHz', type: 'highshelf' as BiquadFilterType },
];

function fisherYatesShuffle(ids: string[], anchorFirstId?: string | null): string[] {
  const pool = [...ids];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  if (anchorFirstId) {
    const idx = pool.indexOf(anchorFirstId);
    if (idx > 0) {
      [pool[0], pool[idx]] = [pool[idx], pool[0]];
    }
  }
  return pool;
}

function buildStreamPlaybackUrl(rawUrl: string): string {
  const canUseProxy =
    !Capacitor.isNativePlatform() &&
    typeof window !== 'undefined' &&
    window.location.protocol.startsWith('http');
  if (canUseProxy) {
    return `/api/stream-proxy?url=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
}

interface UseAudioEngineOptions {
  tracks: Track[];
  activeQueueIds: string[];
  synthTargetBpm?: number | null;
  synthHarmonicIntensity?: number | null;
  onTrackError?: (message: string) => void;
  onNeedMoreTracks?: (currentTrack: Track | null, currentQueueIds: string[]) => Promise<Track[]>;
}

export function useAudioEngine({
  tracks,
  activeQueueIds,
  synthTargetBpm = null,
  synthHarmonicIntensity = null,
  onTrackError,
  onNeedMoreTracks,
}: UseAudioEngineOptions) {
  // Dual persistent HTMLAudioElements (Deck A + Deck B) for seamless equal-power crossfading
  const deckARef = useRef<HTMLAudioElement | null>(null);
  const deckBRef = useRef<HTMLAudioElement | null>(null);
  const activeDeckRef = useRef<'A' | 'B'>('A');

  const getDeckAudio = useCallback((deck: 'A' | 'B') => {
    const targetRef = deck === 'A' ? deckARef : deckBRef;
    if (!targetRef.current) {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      audio.setAttribute('playsinline', 'true');
      targetRef.current = audio;
    }
    return targetRef.current;
  }, []);

  const getPersistentAudio = useCallback(() => {
    return getDeckAudio(activeDeckRef.current);
  }, [getDeckAudio]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const eqFiltersRef = useRef<BiquadFilterNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);
  const mixerGainRef = useRef<GainNode | null>(null);
  const deckGainARef = useRef<GainNode | null>(null);
  const deckGainBRef = useRef<GainNode | null>(null);
  const objectUrlARef = useRef<string | null>(null);
  const objectUrlBRef = useRef<string | null>(null);
  const crossfadeRafRef = useRef<number>(0);
  const crossfadeTokenRef = useRef<number>(0);
  const crossfadingRef = useRef<boolean>(false);

  const synthBpmRef = useRef<number | null>(synthTargetBpm ?? null);
  synthBpmRef.current = synthTargetBpm ?? null;
  const synthHarmonicRef = useRef<number | null>(synthHarmonicIntensity ?? null);
  synthHarmonicRef.current = synthHarmonicIntensity ?? null;

  const ephemeralTracksRef = useRef<Map<string, Track>>(new Map());
  const activePlaybackSourceRef = useRef<PlaybackSource>('offline');
  const activeQueueRef = useRef<string[]>([]);
  const shuffledQueueRef = useRef<string[]>([]);
  const fetchingMoreRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);

  const [activePlaybackSource, setActivePlaybackSourceState] =
    useState<PlaybackSource>('offline');
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [externalActiveTrack, setExternalActiveTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [shuffle, setShuffleState] = useState(false);
  const shuffleRef = useRef(shuffle);
  shuffleRef.current = shuffle;
  const [repeat, setRepeat] = useState<RepeatMode>('all');
  const [infiniteQueueEnabled, setInfiniteQueueEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem('sonance-infinite-queue');
    return saved === null ? true : saved === 'true';
  });
  const [isFetchingNextBatch, setIsFetchingNextBatch] = useState(false);
  const [queueVersion, setQueueVersion] = useState(0);
  const [eqPreset, setEqPreset] = useState<EQPresetId>('flat');
  const [eqBands, setEqBands] = useState<EQBand[]>(
    EQ_FREQUENCIES.map((f) => ({ frequency: f.freq, label: f.label, gain: 0 }))
  );

  // Sleep Timer state
  const [sleepTimerMode, setSleepTimerModeState] = useState<SleepTimerMode>('off');
  const [sleepRemainingSeconds, setSleepRemainingSeconds] = useState<number | null>(null);
  const sleepTimerModeRef = useRef<SleepTimerMode>('off');
  sleepTimerModeRef.current = sleepTimerMode;
  const infiniteQueueRef = useRef(infiniteQueueEnabled);
  infiniteQueueRef.current = infiniteQueueEnabled;
  const onNeedMoreTracksRef = useRef(onNeedMoreTracks);
  onNeedMoreTracksRef.current = onNeedMoreTracks;

  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  // Beat & analysis state stored in mutable ref for 60fps subscribers
  const analysisFrameRef = useRef<AudioAnalysisFrame>({
    frequencyData: new Uint8Array(new ArrayBuffer(1024)),
    timeDomainData: new Uint8Array(new ArrayBuffer(1024)),
    bass: 0,
    mid: 0,
    high: 0,
    rms: 0,
    beatEnvelope: 0,
    isBeat: false,
    spectralCentroid: 0.4,
    estimatedBpm: null,
  });

  const beatStateRef = useRef({
    avgBassEnergy: 0.05,
    lastBeatAt: 0,
    beatEnvelope: 0,
    beatIntervals: [] as number[],
    silentFrames: 0,
  });

  const currentTrack =
    tracks.find((t) => t.id === currentTrackId) ??
    (externalActiveTrack?.id === currentTrackId ? externalActiveTrack : null) ??
    (currentTrackId ? ephemeralTracksRef.current.get(currentTrackId) ?? null : null);

  // Keep offline queue initialized and prune deleted offline tracks without clobbering active playlists
  useEffect(() => {
    if (activePlaybackSourceRef.current !== 'offline') return;
    if (activeQueueRef.current.length === 0 && activeQueueIds.length > 0) {
      activeQueueRef.current = [...activeQueueIds];
      setQueueVersion((v) => v + 1);
      return;
    }
    const validSet = new Set(tracks.map((t) => t.id));
    const pruned = activeQueueRef.current.filter((id) => validSet.has(id));
    if (pruned.length !== activeQueueRef.current.length) {
      activeQueueRef.current = pruned.length > 0 ? pruned : [...activeQueueIds];
      setQueueVersion((v) => v + 1);
    }
  }, [activeQueueIds, tracks]);

  // Keep shuffled queue synchronized whenever the active queue changes while shuffle is enabled
  useEffect(() => {
    if (!shuffle || activePlaybackSource === 'radio') return;
    const baseQueue =
      activeQueueRef.current.length > 0
        ? activeQueueRef.current
        : activePlaybackSource === 'offline'
          ? activeQueueIds
          : [];
    const baseSet = new Set(baseQueue);
    const existing = shuffledQueueRef.current.filter((id) => baseSet.has(id));
    const missing = baseQueue.filter((id) => !existing.includes(id));
    if (existing.length === 0 || missing.length > 0) {
      shuffledQueueRef.current = fisherYatesShuffle(baseQueue, currentTrackId);
    } else {
      shuffledQueueRef.current = existing;
    }
  }, [activePlaybackSource, activeQueueIds, currentTrackId, queueVersion, shuffle]);

  const setInfiniteQueueEnabled = useCallback(
    (updater: boolean | ((prev: boolean) => boolean)) => {
      setInfiniteQueueEnabledState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        localStorage.setItem('sonance-infinite-queue', String(next));
        return next;
      });
    },
    []
  );

  const setShuffle = useCallback(
    (updater: boolean | ((prev: boolean) => boolean)) => {
      setShuffleState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        const sourceQueue =
          activeQueueRef.current.length > 0
            ? activeQueueRef.current
            : activePlaybackSourceRef.current === 'offline'
              ? activeQueueIds
              : [];
        if (next && activePlaybackSourceRef.current !== 'radio') {
          shuffledQueueRef.current = fisherYatesShuffle(sourceQueue, currentTrackId);
        }
        return next;
      });
    },
    [activeQueueIds, currentTrackId]
  );

  const getEffectiveQueue = useCallback(() => {
    const source = activePlaybackSourceRef.current;
    const baseQueue =
      activeQueueRef.current.length > 0
        ? activeQueueRef.current
        : source === 'offline'
          ? activeQueueIds
          : [];
    if (source !== 'radio' && shuffleRef.current && shuffledQueueRef.current.length > 0) {
      return shuffledQueueRef.current;
    }
    return baseQueue;
  }, [activeQueueIds]);

  const appendTracksToQueue = useCallback(
    (newTracks: Track[], expectedSource?: PlaybackSource): string[] => {
      if (newTracks.length === 0) return [];
      if (expectedSource && activePlaybackSourceRef.current !== expectedSource) {
        return [];
      }

      const base =
        activeQueueRef.current.length > 0
          ? activeQueueRef.current
          : activePlaybackSourceRef.current === 'offline'
            ? [...activeQueueIds]
            : [];
      const existingSet = new Set(base);
      const addedIds: string[] = [];

      for (const t of newTracks) {
        ephemeralTracksRef.current.set(t.id, t);
        if (!existingSet.has(t.id)) {
          existingSet.add(t.id);
          addedIds.push(t.id);
        }
      }

      if (addedIds.length > 0) {
        activeQueueRef.current = [...base, ...addedIds];
        if (shuffleRef.current && activePlaybackSourceRef.current !== 'radio') {
          shuffledQueueRef.current = [
            ...shuffledQueueRef.current,
            ...fisherYatesShuffle(addedIds),
          ];
        }
        setQueueVersion((v) => v + 1);
      }

      return addedIds;
    },
    [activeQueueIds]
  );

  const currentTrackRef = useRef<Track | null>(null);
  currentTrackRef.current = currentTrack;

  const prefetchMoreIntoQueue = useCallback(async (): Promise<string[]> => {
    if (activePlaybackSourceRef.current !== 'online') return [];
    if (fetchingMoreRef.current || !onNeedMoreTracksRef.current) return [];
    fetchingMoreRef.current = true;
    setIsFetchingNextBatch(true);
    try {
      const currentQueue = [...activeQueueRef.current];
      const newTracks = await onNeedMoreTracksRef.current(
        currentTrackRef.current,
        currentQueue
      );
      return appendTracksToQueue(newTracks, 'online');
    } catch {
      return [];
    } finally {
      fetchingMoreRef.current = false;
      setIsFetchingNextBatch(false);
    }
  }, [appendTracksToQueue]);

  const ensureAudioGraph = useCallback(() => {
    const audioA = getDeckAudio('A');
    const audioB = getDeckAudio('B');

    if (!audioCtxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const sourceA = ctx.createMediaElementSource(audioA);
      const sourceB = ctx.createMediaElementSource(audioB);

      const deckGainA = ctx.createGain();
      const deckGainB = ctx.createGain();
      deckGainA.gain.value = activeDeckRef.current === 'A' ? 1 : 0;
      deckGainB.gain.value = activeDeckRef.current === 'B' ? 1 : 0;

      const mixerGain = ctx.createGain();
      mixerGain.gain.value = 1;

      const filters = EQ_FREQUENCIES.map((def, i) => {
        const filter = ctx.createBiquadFilter();
        filter.type = def.type;
        filter.frequency.value = def.freq;
        filter.Q.value = 1.0;
        filter.gain.value = eqBands[i]?.gain ?? 0;
        return filter;
      });

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.76;

      const masterGain = ctx.createGain();
      masterGain.gain.value = isMutedRef.current ? 0 : volumeRef.current;

      sourceA.connect(deckGainA);
      sourceB.connect(deckGainB);
      deckGainA.connect(mixerGain);
      deckGainB.connect(mixerGain);

      mixerGain.connect(filters[0]);
      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
      }
      filters[filters.length - 1].connect(analyser);
      analyser.connect(masterGain);
      masterGain.connect(ctx.destination);

      audioCtxRef.current = ctx;
      deckGainARef.current = deckGainA;
      deckGainBRef.current = deckGainB;
      mixerGainRef.current = mixerGain;
      eqFiltersRef.current = filters;
      analyserRef.current = analyser;
      gainNodeRef.current = masterGain;

      analysisFrameRef.current.frequencyData = new Uint8Array(analyser.frequencyBinCount);
      analysisFrameRef.current.timeDomainData = new Uint8Array(analyser.frequencyBinCount);
    }

    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
  }, [eqBands, getDeckAudio]);

  const stopInactiveDeck = useCallback(
    (deckToStop: 'A' | 'B') => {
      const audio = getDeckAudio(deckToStop);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      const objRef = deckToStop === 'A' ? objectUrlARef : objectUrlBRef;
      if (objRef.current) {
        URL.revokeObjectURL(objRef.current);
        objRef.current = null;
      }
      const gainNode = deckToStop === 'A' ? deckGainARef.current : deckGainBRef.current;
      if (gainNode && audioCtxRef.current) {
        gainNode.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
      }
    },
    [getDeckAudio]
  );

  const loadAndPlayTrack = useCallback(
    async (
      trackId: string,
      autoPlay = true,
      overrideTrack?: Track,
      sourceOverride?: PlaybackSource,
      contextTracksOrIds?: Track[] | string[],
      options?: { crossfade?: boolean; crossfadeMs?: number }
    ) => {
      if (contextTracksOrIds && contextTracksOrIds.length > 0) {
        const ids: string[] = [];
        for (const item of contextTracksOrIds) {
          if (typeof item === 'string') {
            ids.push(item);
          } else {
            ephemeralTracksRef.current.set(item.id, item);
            ids.push(item.id);
          }
        }
        if (!ids.includes(trackId)) {
          ids.unshift(trackId);
        }
        activeQueueRef.current = ids;
        setQueueVersion((v) => v + 1);
      }

      const track =
        overrideTrack ??
        tracks.find((t) => t.id === trackId) ??
        ephemeralTracksRef.current.get(trackId);
      if (!track) return;

      const resolvedSource: PlaybackSource =
        sourceOverride ??
        (track.isLive || track.sourceType === 'radio'
          ? 'radio'
          : track.streamUrl && !track.isDownloaded
            ? 'online'
            : 'offline');

      const sourceChanged = activePlaybackSourceRef.current !== resolvedSource;
      activePlaybackSourceRef.current = resolvedSource;
      setActivePlaybackSourceState(resolvedSource);

      if (!contextTracksOrIds) {
        if (resolvedSource === 'offline') {
          if (sourceChanged || activeQueueRef.current.length === 0 || !activeQueueRef.current.includes(trackId)) {
            activeQueueRef.current = activeQueueIds.includes(trackId)
              ? [...activeQueueIds]
              : [trackId, ...activeQueueIds];
            setQueueVersion((v) => v + 1);
          }
        } else if (sourceChanged || activeQueueRef.current.length === 0) {
          activeQueueRef.current = [trackId];
          setQueueVersion((v) => v + 1);
        } else if (!activeQueueRef.current.includes(trackId)) {
          activeQueueRef.current = [...activeQueueRef.current, trackId];
          setQueueVersion((v) => v + 1);
        }
      }

      ensureAudioGraph();
      const outgoingDeck = activeDeckRef.current;
      const outgoingAudio = getDeckAudio(outgoingDeck);
      const canCrossfade =
        Boolean(options?.crossfade) &&
        autoPlay &&
        !outgoingAudio.paused &&
        !outgoingAudio.ended &&
        Boolean(outgoingAudio.currentSrc || outgoingAudio.getAttribute('src'));

      const targetDeck: 'A' | 'B' = canCrossfade
        ? outgoingDeck === 'A'
          ? 'B'
          : 'A'
        : outgoingDeck;
      const targetAudio = getDeckAudio(targetDeck);
      const targetObjRef = targetDeck === 'A' ? objectUrlARef : objectUrlBRef;
      const targetDeckGain = targetDeck === 'A' ? deckGainARef.current : deckGainBRef.current;
      const outgoingDeckGain = outgoingDeck === 'A' ? deckGainARef.current : deckGainBRef.current;

      // Restore normal master target gain if a previous sleep fade lowered it
      if (gainNodeRef.current && audioCtxRef.current) {
        gainNodeRef.current.gain.setValueAtTime(
          isMutedRef.current ? 0 : volumeRef.current,
          audioCtxRef.current.currentTime
        );
      }

      try {
        let nextSrc = '';

        if (track.streamUrl) {
          nextSrc = buildStreamPlaybackUrl(track.streamUrl);
        } else {
          const rawBlob = await getTrackBlob(trackId);
          if (!rawBlob || rawBlob.size === 0) {
            onTrackError?.(`Audio file for "${track.title}" is missing from offline storage.`);
            return;
          }
          const playableBlob = rawBlob.type
            ? rawBlob
            : new Blob([rawBlob], { type: track.mimeType || 'audio/mpeg' });
          if (targetObjRef.current) {
            URL.revokeObjectURL(targetObjRef.current);
          }
          const objectUrl = URL.createObjectURL(playableBlob);
          targetObjRef.current = objectUrl;
          nextSrc = objectUrl;
        }

        if (!canCrossfade) {
          // Cancel any active crossfade & silence the other deck
          crossfadeTokenRef.current += 1;
          if (crossfadeRafRef.current) {
            cancelAnimationFrame(crossfadeRafRef.current);
            crossfadeRafRef.current = 0;
          }
          crossfadingRef.current = false;
          setIsCrossfading(false);
          stopInactiveDeck(targetDeck === 'A' ? 'B' : 'A');

          if (targetDeckGain && audioCtxRef.current) {
            targetDeckGain.gain.setValueAtTime(1, audioCtxRef.current.currentTime);
          }

          if (overrideTrack) {
            ephemeralTracksRef.current.set(trackId, overrideTrack);
            setExternalActiveTrack(overrideTrack);
          } else if (tracks.some((t) => t.id === trackId)) {
            setExternalActiveTrack(null);
          } else {
            setExternalActiveTrack(track);
          }

          targetAudio.pause();
          targetAudio.src = nextSrc;
          targetAudio.load();
          targetAudio.playbackRate = track.isLive ? 1 : playbackRate;
          setCurrentTrackId(trackId);
          setCurrentTime(0);
          setDuration(track.isLive ? 0 : track.duration || 0);

          if (autoPlay) {
            await targetAudio.play();
            consecutiveErrorsRef.current = 0;
            setIsPlaying(true);
          } else {
            setIsPlaying(false);
          }
          return;
        }

        // Dual-Audio Equal-Power Crossfade: keep outgoing deck uninterrupted while incoming starts
        if (targetDeckGain && audioCtxRef.current) {
          targetDeckGain.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
        }

        targetAudio.pause();
        targetAudio.src = nextSrc;
        targetAudio.load();
        targetAudio.playbackRate = track.isLive ? 1 : playbackRate;

        await targetAudio.play();

        // Incoming stream started cleanly — hand over active deck & execute equal-power ramp
        const myToken = ++crossfadeTokenRef.current;
        if (crossfadeRafRef.current) {
          cancelAnimationFrame(crossfadeRafRef.current);
          crossfadeRafRef.current = 0;
        }

        activeDeckRef.current = targetDeck;
        crossfadingRef.current = true;
        setIsCrossfading(true);
        consecutiveErrorsRef.current = 0;

        if (overrideTrack) {
          ephemeralTracksRef.current.set(trackId, overrideTrack);
          setExternalActiveTrack(overrideTrack);
        } else if (tracks.some((t) => t.id === trackId)) {
          setExternalActiveTrack(null);
        } else {
          setExternalActiveTrack(track);
        }

        setCurrentTrackId(trackId);
        setCurrentTime(0);
        setDuration(track.isLive ? 0 : track.duration || 0);
        setIsPlaying(true);

        const fadeMs = Math.max(800, Math.min(4000, options?.crossfadeMs ?? 2200));
        const fadeStart = performance.now();

        const stepCrossfade = (now: number) => {
          if (crossfadeTokenRef.current !== myToken) return;
          const progress = Math.min(1, (now - fadeStart) / fadeMs);
          const inGain = Math.sin(progress * Math.PI * 0.5);
          const outGain = Math.cos(progress * Math.PI * 0.5);
          const ctx = audioCtxRef.current;
          if (ctx) {
            if (targetDeckGain) {
              targetDeckGain.gain.setTargetAtTime(inGain, ctx.currentTime, 0.015);
            }
            if (outgoingDeckGain) {
              outgoingDeckGain.gain.setTargetAtTime(outGain, ctx.currentTime, 0.015);
            }
          }

          if (progress < 1) {
            crossfadeRafRef.current = requestAnimationFrame(stepCrossfade);
          } else {
            crossfadeRafRef.current = 0;
            crossfadingRef.current = false;
            setIsCrossfading(false);
            if (ctx && targetDeckGain) {
              targetDeckGain.gain.setValueAtTime(1, ctx.currentTime);
            }
            stopInactiveDeck(outgoingDeck);
          }
        };

        crossfadeRafRef.current = requestAnimationFrame(stepCrossfade);
      } catch (err) {
        console.warn('Audio source load skipped:', err);
        targetAudio.removeAttribute('src');
        targetAudio.load();
        if (!canCrossfade) {
          setIsPlaying(false);
        }
        onTrackError?.(
          track.streamUrl
            ? `Skipped unavailable ${track.isLive ? 'station' : 'stream'} "${track.title}" — advancing queue`
            : `Could not play "${track.title}". Your browser may not support ${track.format} decoding.`
        );
        if (
          autoPlay &&
          track.streamUrl &&
          consecutiveErrorsRef.current < 3
        ) {
          consecutiveErrorsRef.current += 1;
          window.setTimeout(() => {
            void playNextRef.current(true, canCrossfade);
          }, 180);
        } else {
          consecutiveErrorsRef.current = 0;
        }
      }
    },
    [
      activeQueueIds,
      ensureAudioGraph,
      getDeckAudio,
      onTrackError,
      playbackRate,
      stopInactiveDeck,
      tracks,
    ]
  );

  const togglePlayPause = useCallback(async () => {
    if (!currentTrackId) {
      const queue = getEffectiveQueue();
      if (queue.length > 0) {
        await loadAndPlayTrack(queue[0], true);
      }
      return;
    }
    ensureAudioGraph();
    const audio = getPersistentAudio();

    if (!audio.currentSrc && !audio.getAttribute('src')) {
      await loadAndPlayTrack(currentTrackId, true);
      return;
    }

    if (audio.paused) {
      if (gainNodeRef.current && audioCtxRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(
          isMutedRef.current ? 0 : volumeRef.current,
          audioCtxRef.current.currentTime,
          0.03
        );
      }
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn('Resume playback failed, reloading source:', err);
        await loadAndPlayTrack(currentTrackId, true);
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [currentTrackId, ensureAudioGraph, getEffectiveQueue, getPersistentAudio, loadAndPlayTrack]);

  const playNext = useCallback(
    async (forceNext = true, crossfadeOverride?: boolean) => {
      const audio = getPersistentAudio();
      const shouldAutoCrossfade =
        crossfadeOverride ??
        Boolean(synthBpmRef.current && activePlaybackSourceRef.current === 'online');

      // Handle End-of-Track Sleep Timer cleanly
      if (!forceNext && sleepTimerModeRef.current === 'track') {
        audio.pause();
        setIsPlaying(false);
        setSleepTimerModeState('off');
        setSleepRemainingSeconds(null);
        if (gainNodeRef.current && audioCtxRef.current) {
          gainNodeRef.current.gain.setTargetAtTime(
            isMutedRef.current ? 0 : volumeRef.current,
            audioCtxRef.current.currentTime,
            0.05
          );
        }
        return;
      }

      const source = activePlaybackSourceRef.current;
      const queue = getEffectiveQueue();

      // Mode 1: Radio — strictly cycle through live radio stations in activeQueueRef
      if (source === 'radio') {
        if (queue.length === 0) return;
        const idx = currentTrackId ? queue.indexOf(currentTrackId) : -1;
        const nextIdx = (idx + 1) % queue.length;
        void loadAndPlayTrack(queue[nextIdx], true, undefined, 'radio');
        return;
      }

      // Mode 2: Online Streaming — advance online queue & trigger infinite prefetch when needed
      if (source === 'online') {
        const xfOpts = shouldAutoCrossfade ? { crossfade: true, crossfadeMs: 2200 } : undefined;
        if (queue.length === 0) {
          if (infiniteQueueRef.current && onNeedMoreTracksRef.current) {
            const added = await prefetchMoreIntoQueue();
            if (added.length > 0) {
              void loadAndPlayTrack(added[0], true, undefined, 'online', undefined, xfOpts);
            }
          }
          return;
        }

        if (repeat === 'one' && !forceNext && currentTrackId) {
          audio.currentTime = 0;
          void audio.play();
          setIsPlaying(true);
          return;
        }

        const idx = currentTrackId ? queue.indexOf(currentTrackId) : -1;
        const nextIdx = idx + 1;

        if (nextIdx < queue.length) {
          void loadAndPlayTrack(queue[nextIdx], true, undefined, 'online', undefined, xfOpts);
          return;
        }

        if (infiniteQueueRef.current && onNeedMoreTracksRef.current) {
          const added = await prefetchMoreIntoQueue();
          if (added.length > 0) {
            void loadAndPlayTrack(added[0], true, undefined, 'online', undefined, xfOpts);
            return;
          }
        }

        if (repeat === 'all' || forceNext) {
          if (shuffle) {
            shuffledQueueRef.current = fisherYatesShuffle(queue);
            void loadAndPlayTrack(shuffledQueueRef.current[0], true, undefined, 'online', undefined, xfOpts);
          } else {
            void loadAndPlayTrack(queue[0], true, undefined, 'online', undefined, xfOpts);
          }
        } else {
          setIsPlaying(false);
        }
        return;
      }

      // Mode 3: Offline Music — strictly play offline tracks matching Shuffle & Repeat
      if (queue.length === 0) return;

      if (repeat === 'one' && !forceNext && currentTrackId) {
        audio.currentTime = 0;
        void audio.play();
        setIsPlaying(true);
        return;
      }

      const idx = currentTrackId ? queue.indexOf(currentTrackId) : -1;
      const nextIdx = idx + 1;

      if (nextIdx < queue.length) {
        void loadAndPlayTrack(queue[nextIdx], true, undefined, 'offline');
        return;
      }

      if (repeat === 'all' || forceNext) {
        if (shuffle) {
          shuffledQueueRef.current = fisherYatesShuffle(queue);
          void loadAndPlayTrack(shuffledQueueRef.current[0], true, undefined, 'offline');
        } else {
          void loadAndPlayTrack(queue[0], true, undefined, 'offline');
        }
      } else {
        setIsPlaying(false);
      }
    },
    [
      currentTrackId,
      getEffectiveQueue,
      getPersistentAudio,
      loadAndPlayTrack,
      prefetchMoreIntoQueue,
      repeat,
      shuffle,
    ]
  );

  // Proactive Infinite Queue prefetch ONLY in Online Streaming mode when <= 2 tracks remain
  useEffect(() => {
    if (activePlaybackSource !== 'online') return;
    if (!infiniteQueueEnabled || !currentTrackId || !isPlaying) return;
    if (currentTrack?.isLive) return;
    if (!onNeedMoreTracksRef.current) return;

    const queue = getEffectiveQueue();
    const idx = queue.indexOf(currentTrackId);
    if (idx !== -1 && queue.length - 1 - idx <= 2) {
      void prefetchMoreIntoQueue();
    }
  }, [
    activePlaybackSource,
    currentTrack?.isLive,
    currentTrackId,
    getEffectiveQueue,
    infiniteQueueEnabled,
    isPlaying,
    prefetchMoreIntoQueue,
    queueVersion,
  ]);

  const playPrevious = useCallback(() => {
    const source = activePlaybackSourceRef.current;
    const queue = getEffectiveQueue();
    if (queue.length === 0) return;

    // In Radio mode (or live streams), Previous immediately tunes to the previous station
    if (source === 'radio' || currentTrackRef.current?.isLive) {
      const idx = currentTrackId ? queue.indexOf(currentTrackId) : -1;
      const prevIdx = idx <= 0 ? queue.length - 1 : idx - 1;
      void loadAndPlayTrack(queue[prevIdx], true, undefined, source);
      return;
    }

    const audio = getPersistentAudio();
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    const idx = currentTrackId ? queue.indexOf(currentTrackId) : 0;
    const prevIdx = (idx - 1 + queue.length) % queue.length;
    void loadAndPlayTrack(queue[prevIdx], true, undefined, source);
  }, [currentTrackId, getEffectiveQueue, getPersistentAudio, loadAndPlayTrack]);

  const playQueue = useCallback(
    async (
      queueIds: string[],
      startTrackId?: string,
      enableShuffle: boolean | 'preserve' = false,
      overrideTracks?: Track[],
      sourceOverride?: PlaybackSource,
      options?: { crossfade?: boolean; crossfadeMs?: number }
    ) => {
      if (queueIds.length === 0) return;

      if (overrideTracks) {
        for (const t of overrideTracks) {
          ephemeralTracksRef.current.set(t.id, t);
        }
      }

      const sampleTrack =
        overrideTracks?.find((t) => t.id === (startTrackId ?? queueIds[0])) ??
        overrideTracks?.[0] ??
        tracks.find((t) => t.id === (startTrackId ?? queueIds[0])) ??
        ephemeralTracksRef.current.get(startTrackId ?? queueIds[0]);

      const resolvedSource: PlaybackSource =
        sourceOverride ??
        (sampleTrack?.isLive || sampleTrack?.sourceType === 'radio'
          ? 'radio'
          : sampleTrack?.streamUrl && !sampleTrack?.isDownloaded
            ? 'online'
            : 'offline');

      activePlaybackSourceRef.current = resolvedSource;
      setActivePlaybackSourceState(resolvedSource);
      activeQueueRef.current = [...queueIds];
      setQueueVersion((v) => v + 1);

      const shouldShuffle =
        resolvedSource === 'radio'
          ? false
          : enableShuffle === 'preserve'
            ? shuffleRef.current
            : enableShuffle;

      if (enableShuffle !== 'preserve' && resolvedSource !== 'radio') {
        setShuffleState(enableShuffle);
      }

      if (shouldShuffle) {
        const shuffled = fisherYatesShuffle(queueIds, startTrackId);
        shuffledQueueRef.current = shuffled;
        const firstId = startTrackId ?? shuffled[0];
        await loadAndPlayTrack(firstId, true, undefined, resolvedSource, queueIds, options);
      } else {
        const firstId = startTrackId ?? queueIds[0];
        await loadAndPlayTrack(firstId, true, undefined, resolvedSource, queueIds, options);
      }
    },
    [loadAndPlayTrack, tracks]
  );

  const setSleepTimer = useCallback(
    (mode: SleepTimerMode) => {
      setSleepTimerModeState(mode);
      if (mode === 'off' || mode === 'track') {
        setSleepRemainingSeconds(null);
      } else {
        setSleepRemainingSeconds(mode * 60);
      }
      if (gainNodeRef.current && audioCtxRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(
          isMutedRef.current ? 0 : volumeRef.current,
          audioCtxRef.current.currentTime,
          0.04
        );
      }
    },
    []
  );

  const seekTo = useCallback(
    (seconds: number) => {
      const audio = getPersistentAudio();
      if (!Number.isFinite(seconds)) return;
      if (currentTrack?.isLive) return;
      const maxDur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : seconds;
      audio.currentTime = Math.max(0, Math.min(seconds, maxDur));
      setCurrentTime(audio.currentTime);
    },
    [currentTrack?.isLive, getPersistentAudio]
  );

  const setVolume = useCallback(
    (val: number) => {
      const clamped = Math.max(0, Math.min(1, val));
      setVolumeState(clamped);
      if (clamped > 0 && isMutedRef.current) setIsMuted(false);
      if (gainNodeRef.current && audioCtxRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(clamped, audioCtxRef.current.currentTime, 0.02);
      }
    },
    []
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (gainNodeRef.current && audioCtxRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(
          next ? 0 : volumeRef.current,
          audioCtxRef.current.currentTime,
          0.02
        );
      }
      return next;
    });
  }, []);

  const setPlaybackRate = useCallback(
    (rate: number) => {
      setPlaybackRateState(rate);
      const audio = getPersistentAudio();
      if (!currentTrack?.isLive) {
        audio.playbackRate = rate;
      }
    },
    [currentTrack?.isLive, getPersistentAudio]
  );

  const applyEQPreset = useCallback((presetId: EQPresetId) => {
    setEqPreset(presetId);
    const gains = EQ_PRESETS[presetId].gains;
    setEqBands((prev) => prev.map((band, i) => ({ ...band, gain: gains[i] ?? 0 })));
    eqFiltersRef.current.forEach((filter, i) => {
      filter.gain.setTargetAtTime(gains[i] ?? 0, audioCtxRef.current?.currentTime ?? 0, 0.03);
    });
  }, []);

  const setEQBandGain = useCallback((index: number, gain: number) => {
    const clamped = Math.max(-12, Math.min(12, gain));
    setEqBands((prev) => prev.map((band, i) => (i === index ? { ...band, gain: clamped } : band)));
    const filter = eqFiltersRef.current[index];
    if (filter) {
      filter.gain.setTargetAtTime(clamped, audioCtxRef.current?.currentTime ?? 0, 0.03);
    }
  }, []);

  // Stable refs so HTMLAudioElement & MediaSession always invoke mode-locked handlers
  const playNextRef = useRef(playNext);
  playNextRef.current = playNext;
  const playPreviousRef = useRef(playPrevious);
  playPreviousRef.current = playPrevious;

  useEffect(() => {
    const audioA = getDeckAudio('A');
    const audioB = getDeckAudio('B');

    const attachDeckListeners = (deck: 'A' | 'B', audio: HTMLAudioElement) => {
      const onTimeUpdate = () => {
        if (activeDeckRef.current !== deck) return;
        setCurrentTime(audio.currentTime);
        // Gentle fade out in final 3 seconds for 'track' sleep timer mode
        if (
          sleepTimerModeRef.current === 'track' &&
          Number.isFinite(audio.duration) &&
          audio.duration > 6 &&
          gainNodeRef.current &&
          audioCtxRef.current
        ) {
          const left = audio.duration - audio.currentTime;
          if (left <= 3 && left > 0) {
            const factor = Math.max(0.02, left / 3);
            const base = isMutedRef.current ? 0 : volumeRef.current;
            gainNodeRef.current.gain.setTargetAtTime(
              base * factor,
              audioCtxRef.current.currentTime,
              0.08
            );
          }
        }
      };
      const onLoadedMeta = () => {
        if (activeDeckRef.current !== deck) return;
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        }
      };
      const onEnded = () => {
        if (activeDeckRef.current !== deck) return;
        void playNextRef.current(false);
      };
      const onPause = () => {
        if (activeDeckRef.current !== deck || crossfadingRef.current) return;
        setIsPlaying(false);
      };
      const onPlay = () => {
        if (activeDeckRef.current !== deck) return;
        setIsPlaying(true);
      };
      const onError = () => {
        if (activeDeckRef.current !== deck) return;
        if (!audio.getAttribute('src')) return;
        setIsPlaying(false);
      };

      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('loadedmetadata', onLoadedMeta);
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('pause', onPause);
      audio.addEventListener('play', onPlay);
      audio.addEventListener('error', onError);

      return () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('loadedmetadata', onLoadedMeta);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('pause', onPause);
        audio.removeEventListener('play', onPlay);
        audio.removeEventListener('error', onError);
      };
    };

    const detachA = attachDeckListeners('A', audioA);
    const detachB = attachDeckListeners('B', audioB);
    return () => {
      detachA();
      detachB();
    };
  }, [getDeckAudio]);

  // Minute-based Sleep Timer live countdown & smooth fade-out
  useEffect(() => {
    if (typeof sleepTimerMode !== 'number') return;

    const interval = window.setInterval(() => {
      setSleepRemainingSeconds((prev) => {
        if (prev === null) return null;
        const next = prev - 1;

        if (next <= 3 && next > 0 && gainNodeRef.current && audioCtxRef.current) {
          const base = isMutedRef.current ? 0 : volumeRef.current;
          const fadeRatio = Math.max(0.02, next / 3);
          gainNodeRef.current.gain.setTargetAtTime(
            base * fadeRatio,
            audioCtxRef.current.currentTime,
            0.25
          );
        }

        if (next <= 0) {
          const audio = getPersistentAudio();
          audio.pause();
          setIsPlaying(false);
          setSleepTimerModeState('off');
          if (gainNodeRef.current && audioCtxRef.current) {
            window.setTimeout(() => {
              if (gainNodeRef.current && audioCtxRef.current) {
                gainNodeRef.current.gain.setValueAtTime(
                  isMutedRef.current ? 0 : volumeRef.current,
                  audioCtxRef.current.currentTime
                );
              }
            }, 150);
          }
          return null;
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [getPersistentAudio, sleepTimerMode]);

  // Real-time 60fps spectral + beat detector loop
  useEffect(() => {
    let rafId = 0;

    const tick = () => {
      const analyser = analyserRef.current;
      const frame = analysisFrameRef.current;
      const bState = beatStateRef.current;

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(frame.frequencyData);
        analyser.getByteTimeDomainData(frame.timeDomainData);

        const len = frame.frequencyData.length;
        const sampleRate = audioCtxRef.current?.sampleRate ?? 44100;
        const hzPerBin = sampleRate / 2 / len;

        let bassSum = 0;
        let bassCount = 0;
        let midSum = 0;
        let midCount = 0;
        let highSum = 0;
        let highCount = 0;
        let weightedFreqSum = 0;
        let magSum = 0;

        for (let i = 0; i < len; i++) {
          const val = frame.frequencyData[i] / 255;
          const freq = i * hzPerBin;
          weightedFreqSum += freq * val;
          magSum += val;

          if (freq >= 30 && freq <= 180) {
            bassSum += val;
            bassCount++;
          } else if (freq > 180 && freq <= 2400) {
            midSum += val;
            midCount++;
          } else if (freq > 2400 && freq <= 12000) {
            highSum += val;
            highCount++;
          }
        }

        const now = performance.now();
        const audioEl = activeDeckRef.current === 'A' ? deckARef.current : deckBRef.current;
        const audioActivelyPlaying = Boolean(audioEl && !audioEl.paused && !audioEl.ended);

        if (magSum > 0.015) {
          bState.silentFrames = 0;

          const bass = bassCount > 0 ? bassSum / bassCount : 0;
          const mid = midCount > 0 ? midSum / midCount : 0;
          const high = highCount > 0 ? highSum / highCount : 0;

          let sqSum = 0;
          for (let i = 0; i < frame.timeDomainData.length; i++) {
            const norm = (frame.timeDomainData[i] - 128) / 128;
            sqSum += norm * norm;
          }
          const rms = Math.min(1, Math.sqrt(sqSum / frame.timeDomainData.length) * 2.2);

          const centroidHz = magSum > 0.01 ? weightedFreqSum / magSum : 1200;
          frame.spectralCentroid = Math.min(1, Math.max(0, centroidHz / 5000));

          bState.avgBassEnergy = bState.avgBassEnergy * 0.92 + bass * 0.08;
          const threshold = Math.max(0.16, bState.avgBassEnergy * 1.28);
          const cooldownPassed = now - bState.lastBeatAt > 210;

          let isBeat = false;
          if (bass > threshold && cooldownPassed) {
            isBeat = true;
            if (bState.lastBeatAt > 0) {
              const interval = now - bState.lastBeatAt;
              if (interval >= 300 && interval <= 1100) {
                bState.beatIntervals.push(interval);
                if (bState.beatIntervals.length > 8) bState.beatIntervals.shift();
                const avgInt =
                  bState.beatIntervals.reduce((a, b) => a + b, 0) / bState.beatIntervals.length;
                frame.estimatedBpm = Math.round(60000 / avgInt);
              }
            }
            bState.lastBeatAt = now;
            bState.beatEnvelope = 1.0;
          } else {
            bState.beatEnvelope = Math.max(0, bState.beatEnvelope * 0.88);
          }

          frame.bass = bass;
          frame.mid = mid;
          frame.high = high;
          frame.rms = rms;
          frame.isBeat = isBeat;
          frame.beatEnvelope = bState.beatEnvelope;
        } else if (audioActivelyPlaying) {
          bState.silentFrames += 1;
          if (bState.silentFrames > 10) {
            // Smooth beat-reactive fallback for CORS-restricted cross-origin streams
            const activeTrack = currentTrackRef.current;
            const genreStr = `${activeTrack?.genre ?? ''} ${activeTrack?.title ?? ''}`.toLowerCase();
            const inferredBpm =
              activeTrack?.bpm ||
              synthBpmRef.current ||
              (/workout|phonk|edm|dance|techno|house|bass|club/.test(genreStr)
                ? 128
                : /lofi|chill|study|piano|acoustic/.test(genreStr)
                  ? 84
                  : /sleep|meditation|ambient|zen/.test(genreStr)
                    ? 68
                    : 108);
            const harmonicDrive =
              activeTrack?.harmonicIntensity ?? synthHarmonicRef.current ?? 0.56;
            const beatMs = 60000 / inferredBpm;
            const tSec = now / 1000;
            const phaseInBeat = (now % beatMs) / beatMs;
            const pulse = Math.pow(Math.max(0, 1 - phaseInBeat * 2.1), 2.2);
            const isBeat = now - bState.lastBeatAt >= beatMs * 0.92;
            if (isBeat) {
              bState.lastBeatAt = now;
              bState.beatEnvelope = Math.min(1, 0.72 + harmonicDrive * 0.28);
            } else {
              bState.beatEnvelope = Math.max(pulse * 0.85, bState.beatEnvelope * 0.89);
            }

            const driveScale = 0.72 + harmonicDrive * 0.45;
            const bass = Math.min(1, (0.22 + pulse * 0.56 + 0.08 * Math.sin(tSec * 2.4)) * driveScale);
            const mid = Math.min(
              1,
              (0.2 + 0.26 * (0.5 + 0.5 * Math.sin(tSec * 3.7 + 0.8)) + pulse * 0.18) * driveScale
            );
            const high = Math.min(
              1,
              (0.14 + 0.24 * (0.5 + 0.5 * Math.cos(tSec * 5.9 + 1.4)) + pulse * 0.14) * driveScale
            );
            const rms = Math.min(1, bass * 0.45 + mid * 0.35 + high * 0.2);

            const fLen = frame.frequencyData.length;
            for (let i = 0; i < fLen; i++) {
              const norm = i / fLen;
              const bandBase =
                norm < 0.14
                  ? bass * 235
                  : norm < 0.48
                    ? mid * 210
                    : high * 175;
              const ripple =
                0.72 +
                0.28 * Math.sin(norm * 26 - tSec * 5.2) * Math.cos(norm * 13 + tSec * 3.1);
              frame.frequencyData[i] = Math.min(
                255,
                Math.max(8, Math.floor(bandBase * ripple * (1 - norm * 0.42)))
              );
            }

            const tdLen = frame.timeDomainData.length;
            for (let i = 0; i < tdLen; i++) {
              const u = (i / tdLen) * Math.PI * 4;
              const wave =
                Math.sin(u + tSec * 7.5) * (0.28 + bass * 0.36) +
                Math.sin(u * 2.5 - tSec * 11.2) * (0.14 + mid * 0.22) +
                Math.cos(u * 5.0 + tSec * 15.4) * (high * 0.12);
              frame.timeDomainData[i] = Math.min(255, Math.max(0, Math.floor(128 + wave * 96)));
            }

            frame.bass = bass;
            frame.mid = mid;
            frame.high = high;
            frame.rms = rms;
            frame.isBeat = isBeat;
            frame.beatEnvelope = bState.beatEnvelope;
            frame.spectralCentroid = Math.min(1, 0.25 + mid * 0.35 + high * 0.4);
            frame.estimatedBpm = inferredBpm;
          }
        } else {
          frame.bass *= 0.85;
          frame.mid *= 0.85;
          frame.high *= 0.85;
          frame.rms *= 0.85;
          frame.beatEnvelope *= 0.85;
          frame.isBeat = false;
        }
      } else {
        bState.silentFrames = 0;
        frame.bass *= 0.85;
        frame.mid *= 0.85;
        frame.high *= 0.85;
        frame.rms *= 0.85;
        frame.beatEnvelope *= 0.85;
        frame.isBeat = false;
        for (let i = 0; i < frame.frequencyData.length; i++) {
          frame.frequencyData[i] = Math.floor(frame.frequencyData[i] * 0.84);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying]);

  // Media Session API for Android Notification Bar Mini Player & Lock-Screen Controls
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    let artworkType = 'image/png';
    if (currentTrack.artworkDataUrl?.startsWith('data:')) {
      const mimeMatch = currentTrack.artworkDataUrl.match(/^data:([^;]+);/);
      if (mimeMatch?.[1]) {
        artworkType = mimeMatch[1];
      }
    } else if (currentTrack.artworkDataUrl?.startsWith('http')) {
      artworkType = 'image/jpeg';
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album || 'Sonance',
      artwork: currentTrack.artworkDataUrl
        ? [
            { src: currentTrack.artworkDataUrl, sizes: '512x512', type: artworkType },
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          ]
        : [
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          ],
    });

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    navigator.mediaSession.setActionHandler('play', () => {
      const audio = getPersistentAudio();
      if (audio.paused) {
        void togglePlayPause();
      }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      const audio = getPersistentAudio();
      if (!audio.paused) {
        void togglePlayPause();
      }
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => playPreviousRef.current());
    navigator.mediaSession.setActionHandler('nexttrack', () => void playNextRef.current(true));
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) seekTo(details.seekTime);
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const offset = details.seekOffset ?? 10;
      seekTo(getPersistentAudio().currentTime - offset);
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const offset = details.seekOffset ?? 10;
      seekTo(getPersistentAudio().currentTime + offset);
    });
  }, [currentTrack, getPersistentAudio, isPlaying, seekTo, togglePlayPause]);

  // Sync MediaSession position state for lock-screen progress bar
  useEffect(() => {
    if (!('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;
    if (!currentTrack || currentTrack.isLive || !Number.isFinite(duration) || duration <= 0) return;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate,
        position: Math.min(Math.max(0, currentTime), duration),
      });
    } catch {
      // Ignore transient duration mismatches during track switching
    }
  }, [currentTime, currentTrack, duration, playbackRate]);

  // Native Android Foreground Service to keep background audio alive when minimized / screen locked
  const fgChannelReadyRef = useRef(false);
  const fgActiveRef = useRef(false);

  useEffect(() => {
    if (!(Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android')) return;

    let cancelled = false;

    async function syncForegroundService() {
      if (!currentTrack || !isPlaying) {
        if (fgActiveRef.current) {
          fgActiveRef.current = false;
          await ForegroundService.stopForegroundService().catch(() => {});
        }
        return;
      }

      try {
        const perm = await ForegroundService.checkPermissions();
        if (perm.display !== 'granted') {
          const req = await ForegroundService.requestPermissions();
          if (req.display !== 'granted') return;
        }

        if (cancelled) return;

        if (!fgChannelReadyRef.current) {
          await ForegroundService.createNotificationChannel({
            id: 'sonance-media-playback',
            name: 'Sonance Audio Playback',
            description: 'Keeps music playing cleanly in the background',
            importance: Importance.Low,
          });
          fgChannelReadyRef.current = true;
        }

        const options = {
          id: 90210,
          title: currentTrack.title,
          body: `${currentTrack.artist} · ${currentTrack.album || 'Sonance'}`,
          smallIcon: 'ic_stat_music',
          silent: true,
          notificationChannelId: 'sonance-media-playback',
        };

        if (!fgActiveRef.current) {
          await ForegroundService.startForegroundService(options);
          fgActiveRef.current = true;
        } else {
          await ForegroundService.updateForegroundService(options);
        }
      } catch (err) {
        console.warn('ForegroundService sync skipped:', err);
      }
    }

    void syncForegroundService();

    return () => {
      cancelled = true;
    };
  }, [currentTrack, isPlaying]);

  // Cleanup object URLs, crossfade animation, and foreground service on unmount
  useEffect(() => {
    return () => {
      if (crossfadeRafRef.current) {
        cancelAnimationFrame(crossfadeRafRef.current);
      }
      if (objectUrlARef.current) {
        URL.revokeObjectURL(objectUrlARef.current);
      }
      if (objectUrlBRef.current) {
        URL.revokeObjectURL(objectUrlBRef.current);
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close();
      }
      if (fgActiveRef.current) {
        void ForegroundService.stopForegroundService().catch(() => {});
      }
    };
  }, []);

  return {
    activePlaybackSource,
    currentTrack,
    currentTrackId,
    isPlaying,
    isCrossfading,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackRate,
    shuffle,
    repeat,
    infiniteQueueEnabled,
    isFetchingNextBatch,
    queueLength:
      activeQueueRef.current.length > 0
        ? activeQueueRef.current.length
        : activeQueueIds.length,
    eqPreset,
    eqBands,
    sleepTimerMode,
    sleepRemainingSeconds,
    analysisFrameRef,
    loadAndPlayTrack,
    togglePlayPause,
    playNext,
    playPrevious,
    playQueue,
    appendTracksToQueue,
    seekTo,
    setVolume,
    toggleMute,
    setPlaybackRate,
    setShuffle,
    setRepeat,
    setInfiniteQueueEnabled,
    setSleepTimer,
    applyEQPreset,
    setEQBandGain,
  };
}
