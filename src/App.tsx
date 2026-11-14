import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Disc3,
  Heart,
  Menu,
  Music,
  Palette,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  Upload,
  User,
} from 'lucide-react';
import { AmbientBackdrop } from './components/AmbientBackdrop';
import { AudioVisualizer } from './components/AudioVisualizer';
import { DiscoverGlobal, radioToTrack } from './components/DiscoverGlobal';
import { DownloadButton } from './components/DownloadButton';
import { ForYouSection } from './components/ForYouSection';
import {
  MoodEnvironmentBackdrop,
  resolveMoodEnvironment,
} from './components/MoodEnvironmentBackdrop';
import { NowPlayingSheet } from './components/NowPlayingSheet';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PartyBackdrop } from './components/PartyBackdrop';
import { PlayerDock } from './components/PlayerDock';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { LibraryFilter, Sidebar } from './components/Sidebar';
import { StreamRowSkeleton } from './components/SkeletonLoaders';
import { ThemePicker } from './components/ThemePicker';
import { TrackList } from './components/TrackList';
import { WorldRadioMap } from './components/WorldRadioMap';
import { triggerHapticLight, triggerHapticMedium } from './utils/haptics';
import { useAndroidBannerAd } from './hooks/useAndroidBannerAd';
import { useAudioEngine } from './hooks/useAudioEngine';
import { applyThemePalette, THEMES } from './themes/themes';
import {
  AIMoodPlan,
  ConcreteVisualizerStyle,
  GeoRegionProfile,
  PartyIntensity,
  Playlist,
  RadioStation,
  StreamSeedContext,
  TasteProfile,
  ThemeId,
  Track,
  VisualizerMode,
} from './types/audio';
import { fetchContinuousStreamBatch } from './utils/aiRecommender';
import { extractTrackFromFile, isSupportedAudioFile } from './utils/audioMetadata';
import {
  deletePlaylistFromDB,
  deleteTrackFromDB,
  getAllPlaylists,
  getAllTracks,
  savePlaylist,
  saveTrackWithBlob,
  updateTrackMeta,
} from './utils/db';
import { downloadOnlineTrackOffline } from './utils/offlineDownloader';
import { generateStarterTracks } from './utils/sampleTracks';
import { scanDeviceMusicAuto } from './utils/deviceAudioScanner';
import {
  createEmptyTasteProfile,
  loadTasteProfile,
  recordDislikeReaction,
  recordLoveReaction,
  recordPlayEvent,
  recordSkipEvent,
  saveTasteProfile,
} from './utils/tasteProfile';
import {
  subscribeWidgetTransportActions,
  syncWidgetState,
} from './utils/widgetSync';

const VISUALIZER_MODES: Array<{ id: VisualizerMode; label: string }> = [
  { id: 'auto', label: 'Auto-Match' },
  { id: 'spectrum', label: 'Spectrum' },
  { id: 'waveform', label: 'Waveform' },
  { id: 'radial', label: 'Radial' },
  { id: 'analog', label: 'Analog VU' },
  { id: 'kinetic', label: 'Kinetic' },
];

const STYLE_LABELS: Record<ConcreteVisualizerStyle, string> = {
  spectrum: 'Spectrum Bars',
  waveform: 'Fluid Waveform',
  radial: 'Radial Pulse',
  analog: 'Analog VU',
  kinetic: 'Kinetic Field',
};

type TopTab = 'streaming' | 'offline' | 'radio';

const TOP_TABS: Array<{ id: TopTab; label: string; shortLabel: string }> = [
  { id: 'streaming', label: 'Online Streaming', shortLabel: 'Streaming' },
  { id: 'offline', label: 'Offline Music', shortLabel: 'Offline' },
  { id: 'radio', label: 'Radio', shortLabel: 'Radio' },
];

function getTabForFilter(filter: LibraryFilter): TopTab {
  if (filter.type === 'discover') return 'streaming';
  if (filter.type === 'radiomap') return 'radio';
  return 'offline';
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [activeFilter, setActiveFilter] = useState<LibraryFilter>({ type: 'all' });
  const [tabDirection, setTabDirection] = useState<'left' | 'right'>('right');
  const lastOfflineFilterRef = useRef<LibraryFilter>({ type: 'all' });

  const [themeId, setThemeId] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('sonance-theme') as ThemeId | null;
    return saved && saved in THEMES ? saved : 'alabaster';
  });
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>(() => {
    return (localStorage.getItem('sonance-vis-mode') as VisualizerMode) || 'auto';
  });
  const [resolvedVisStyle, setResolvedVisStyle] = useState<ConcreteVisualizerStyle>('spectrum');
  const [partyMode, setPartyMode] = useState<boolean>(() => {
    return localStorage.getItem('sonance-party') === 'true';
  });
  const [partyIntensity, setPartyIntensity] = useState<PartyIntensity>(() => {
    return (localStorage.getItem('sonance-party-intensity') as PartyIntensity) || 'club';
  });

  const [showThemePicker, setShowThemePicker] = useState(false);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [importingCount, setImportingCount] = useState(0);
  const [isScanningDevice, setIsScanningDevice] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [liveBpm, setLiveBpm] = useState<number | null>(null);
  const [geoProfile, setGeoProfile] = useState<GeoRegionProfile | null>(null);
  const [regionOverride, setRegionOverride] = useState<string>('AUTO');
  const [moodHint, setMoodHint] = useState<string>('deep-study');
  const [activeSynthPlan, setActiveSynthPlan] = useState<AIMoodPlan | null>(null);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile>(() => createEmptyTasteProfile());
  const [downloadProgressMap, setDownloadProgressMap] = useState<Record<string, number>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const artworkFrameRef = useRef<HTMLDivElement | null>(null);
  const mainSwipeRef = useRef<{ x: number; y: number; ignore: boolean } | null>(null);
  const lastRecordedPlayTrackIdRef = useRef<string | null>(null);
  const radioFetchTokenRef = useRef(0);
  const streamSeedRef = useRef<StreamSeedContext>({ offset: 0 });
  const tasteProfileRef = useRef<TasteProfile>(tasteProfile);
  tasteProfileRef.current = tasteProfile;
  const geoProfileRef = useRef<GeoRegionProfile | null>(geoProfile);
  geoProfileRef.current = geoProfile;

  const { bannerHeight } = useAndroidBannerAd();

  const activeTheme = useMemo(() => applyThemePalette(themeId), [themeId]);

  useEffect(() => {
    localStorage.setItem('sonance-theme', themeId);
  }, [themeId]);

  useEffect(() => {
    localStorage.setItem('sonance-vis-mode', visualizerMode);
  }, [visualizerMode]);

  useEffect(() => {
    localStorage.setItem('sonance-party', String(partyMode));
  }, [partyMode]);

  useEffect(() => {
    localStorage.setItem('sonance-party-intensity', partyIntensity);
  }, [partyIntensity]);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Geo-location / IP auto-localization on launch (and on manual region override)
  useEffect(() => {
    let cancelled = false;
    async function detectGeo() {
      try {
        const query =
          regionOverride && regionOverride !== 'AUTO'
            ? `?country=${encodeURIComponent(regionOverride)}`
            : '';
        const res = await fetch(`/api/geo${query}`);
        if (!res.ok) return;
        const profile = (await res.json()) as GeoRegionProfile;
        if (!cancelled) {
          setGeoProfile(profile);
        }
      } catch {
        if (!cancelled) {
          setGeoProfile({
            country: 'Global',
            countryCode: 'US',
            region: 'International',
            city: 'Worldwide',
            recommendedGenres: ['Electronic', 'Lo-Fi', 'Hip-Hop', 'Indie', 'Jazz'],
            radioTags: ['electronic', 'lofi', 'chill', 'jazz', 'hits'],
            audiusHighlightQuery: 'Trending Electronic Lo-Fi',
          });
        }
      }
    }
    void detectGeo();
    return () => {
      cancelled = true;
    };
  }, [regionOverride]);

  // Initial load from IndexedDB + starter offline tracks
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        let [loadedTracks, loadedPlaylists, loadedTaste] = await Promise.all([
          getAllTracks(),
          getAllPlaylists(),
          loadTasteProfile(),
        ]);

        if (loadedTracks.length === 0 && !localStorage.getItem('sonance-seeded')) {
          const starters = await generateStarterTracks();
          for (const item of starters) {
            await saveTrackWithBlob(item.track, item.blob);
          }
          const starterPlaylist: Playlist = {
            id: 'playlist-reference-mix',
            name: 'Reference Mix',
            description: 'Offline lossless starter collection',
            trackIds: starters.map((s) => s.track.id),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await savePlaylist(starterPlaylist);
          localStorage.setItem('sonance-seeded', '1');
          loadedTracks = await getAllTracks();
          loadedPlaylists = await getAllPlaylists();
        }

        if (!cancelled) {
          setTracks(loadedTracks);
          setPlaylists(loadedPlaylists);
          setTasteProfile(loadedTaste);
        }

        // First-launch automatic Android device scan (runs once)
        if (
          Capacitor.isNativePlatform() &&
          Capacitor.getPlatform() === 'android' &&
          !localStorage.getItem('sonance-initial-scan-done')
        ) {
          if (!cancelled) setIsScanningDevice(true);
          const scanResult = await scanDeviceMusicAuto();
          if (!cancelled) {
            setIsScanningDevice(false);
            if (scanResult.addedCount > 0) {
              setTracks(await getAllTracks());
              showNotice(
                `Added ${scanResult.addedCount} new ${scanResult.addedCount === 1 ? 'song' : 'songs'} from device storage`
              );
            }
          }
        }
      } catch (err) {
        console.error('Library hydration error:', err);
        if (!cancelled) {
          showNotice('Could not initialize local offline audio database.');
        }
      } finally {
        if (!cancelled) setLoadingLibrary(false);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [showNotice]);

  // Offline downloads & taste profile lookup sets
  const downloadedTracks = useMemo(
    () => tracks.filter((t) => Boolean(t.isDownloaded)),
    [tracks]
  );

  const downloadedSourceIds = useMemo(() => {
    const set = new Set<string>();
    for (const t of downloadedTracks) {
      set.add(t.id);
      if (t.sourceTrackId) set.add(t.sourceTrackId);
    }
    return set;
  }, [downloadedTracks]);

  const lovedIds = useMemo(() => {
    const set = new Set<string>(Object.keys(tasteProfile.lovedTracks));
    for (const t of tracks) {
      if (t.liked) {
        set.add(t.id);
        if (t.sourceTrackId) set.add(t.sourceTrackId);
      }
    }
    return set;
  }, [tasteProfile.lovedTracks, tracks]);

  const dislikedIds = useMemo(
    () => new Set<string>(tasteProfile.dislikedTrackIds),
    [tasteProfile.dislikedTrackIds]
  );

  // Merge local liked tracks with online loved tracks (deduplicated if downloaded offline)
  const mergedFavorites = useMemo(() => {
    const localLiked = tracks.filter((t) => t.liked);
    const localIds = new Set(tracks.map((t) => t.id));
    const onlineLoved = Object.values(tasteProfile.lovedTracks)
      .filter((t) => !localIds.has(t.id) && !downloadedSourceIds.has(t.id))
      .map((t) => ({ ...t, liked: true }));
    return [...localLiked, ...onlineLoved].sort((a, b) => b.addedAt - a.addedAt);
  }, [downloadedSourceIds, tasteProfile.lovedTracks, tracks]);

  const engineTracks = useMemo(() => {
    const existingIds = new Set(tracks.map((t) => t.id));
    const extraLoved = mergedFavorites.filter((t) => !existingIds.has(t.id));
    return extraLoved.length > 0 ? [...tracks, ...extraLoved] : tracks;
  }, [mergedFavorites, tracks]);

  // Compute visible tracks based on active filter
  const visibleTracks = useMemo(() => {
    if (activeFilter.type === 'favorites') {
      return mergedFavorites;
    }
    if (activeFilter.type === 'downloads') {
      return downloadedTracks;
    }
    if (activeFilter.type === 'playlist') {
      const pl = playlists.find((p) => p.id === activeFilter.playlistId);
      if (!pl) return [];
      const trackMap = new Map(engineTracks.map((t) => [t.id, t]));
      return pl.trackIds.map((id) => trackMap.get(id)).filter((t): t is Track => Boolean(t));
    }
    return tracks;
  }, [activeFilter, downloadedTracks, engineTracks, mergedFavorites, playlists, tracks]);

  const activeQueueIds = useMemo(() => visibleTracks.map((t) => t.id), [visibleTracks]);

  const handleNeedMoreTracks = useCallback(
    async (currentTrack: Track | null, currentQueueIds: string[]): Promise<Track[]> => {
      const seed = streamSeedRef.current;
      const derivedQuery =
        seed.query ||
        (currentTrack && currentTrack.genre && currentTrack.genre !== 'Audio'
          ? currentTrack.genre
          : undefined) ||
        geoProfileRef.current?.audiusHighlightQuery;

      const batch = await fetchContinuousStreamBatch({
        query: derivedQuery,
        genre: seed.genre,
        mood: seed.mood,
        tags: seed.tags,
        sort: seed.sort,
        mode: seed.mode || (derivedQuery ? 'search' : 'trending'),
        offset: seed.offset,
        excludeIds: new Set(currentQueueIds),
        profile: tasteProfileRef.current,
        regionCountry: geoProfileRef.current?.country,
        targetBpmMin: seed.targetBpmMin,
        targetBpmMax: seed.targetBpmMax,
        harmonicTarget: seed.harmonicTarget,
      });

      streamSeedRef.current = {
        ...seed,
        query: batch.pivotedQuery ?? derivedQuery,
        offset: batch.nextOffset,
      };

      return batch.tracks;
    },
    []
  );

  const engine = useAudioEngine({
    tracks: engineTracks,
    activeQueueIds: activeQueueIds.length > 0 ? activeQueueIds : tracks.map((t) => t.id),
    synthTargetBpm: activeSynthPlan
      ? Math.round((activeSynthPlan.targetBpmMin + activeSynthPlan.targetBpmMax) / 2)
      : null,
    synthHarmonicIntensity: activeSynthPlan?.harmonicIntensity ?? null,
    onTrackError: showNotice,
    onNeedMoreTracks: handleNeedMoreTracks,
  });

  // Select first track cleanly once loaded without autoplaying
  const initialTrackSelectedRef = useRef(false);
  useEffect(() => {
    if (!initialTrackSelectedRef.current && tracks.length > 0 && !engine.currentTrackId) {
      initialTrackSelectedRef.current = true;
      void engine.loadAndPlayTrack(tracks[0].id, false, undefined, 'offline', tracks);
    }
  }, [engine, tracks]);

  // Record listening history events whenever a new track begins playing
  useEffect(() => {
    if (!engine.isPlaying || !engine.currentTrack) {
      if (!engine.currentTrackId) {
        lastRecordedPlayTrackIdRef.current = null;
      }
      return;
    }
    if (lastRecordedPlayTrackIdRef.current === engine.currentTrack.id) return;
    lastRecordedPlayTrackIdRef.current = engine.currentTrack.id;

    const playedTrack = engine.currentTrack;
    setTasteProfile((prev) => {
      const next = recordPlayEvent(prev, playedTrack, liveBpm);
      void saveTasteProfile(next);
      return next;
    });
  }, [engine.currentTrack, engine.currentTrackId, engine.isPlaying, liveBpm]);

  // Sync Home Screen Widget state whenever playback or theme changes
  useEffect(() => {
    void syncWidgetState({
      track: engine.currentTrack,
      isPlaying: engine.isPlaying,
      theme: activeTheme,
    });
  }, [activeTheme, engine.currentTrack, engine.isPlaying]);

  // Listen for native Android AppWidget transport button intents
  useEffect(() => {
    return subscribeWidgetTransportActions((action) => {
      if (action === 'play_pause') {
        void engine.togglePlayPause();
      } else if (action === 'next') {
        engine.playNext(true);
      } else if (action === 'prev') {
        engine.playPrevious();
      }
    });
  }, [engine]);

  // Manual Device Scan handler (used by Sidebar, Header & Library bar)
  const handleScanDevice = useCallback(async () => {
    if (isScanningDevice) return;
    setIsScanningDevice(true);
    showNotice('Scanning device...');
    try {
      const res = await scanDeviceMusicAuto({ allowWebDirectoryPicker: true });
      const refreshed = await getAllTracks();
      setTracks(refreshed);

      if (res.source === 'unsupported') {
        showNotice('Folder scanning is available on Android or Chrome desktop; use Import Audio here.');
      } else if (res.addedCount > 0) {
        showNotice(`Added ${res.addedCount} new ${res.addedCount === 1 ? 'song' : 'songs'}`);
      } else {
        showNotice('Scan complete — no new songs found');
      }
    } catch (err) {
      console.error('Device scan failed:', err);
      showNotice('Device music scan could not be completed.');
    } finally {
      setIsScanningDevice(false);
    }
  }, [isScanningDevice, showNotice]);

  // Animate artwork gently with beat envelope in Party Mode + read BPM periodically
  useEffect(() => {
    let rafId = 0;
    let lastBpmCheck = 0;

    const tick = (now: number) => {
      const frame = engine.analysisFrameRef.current;
      if (artworkFrameRef.current) {
        const baseScale = engine.isPlaying ? 1 : 0.96;
        const boost =
          partyMode && engine.isPlaying
            ? baseScale + frame.beatEnvelope * (partyIntensity === 'dynamic' ? 0.055 : 0.032)
            : baseScale;
        artworkFrameRef.current.style.transform = `scale(${boost.toFixed(4)})`;
      }

      if (now - lastBpmCheck > 650) {
        lastBpmCheck = now;
        const bpm = engine.isPlaying ? frame.estimatedBpm : null;
        setLiveBpm((prev) => (prev === bpm ? prev : bpm));
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [engine.analysisFrameRef, engine.isPlaying, partyIntensity, partyMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        void engine.togglePlayPause();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        engine.seekTo(engine.currentTime + 5);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        engine.seekTo(engine.currentTime - 5);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        engine.setVolume(engine.volume + 0.08);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        engine.setVolume(engine.volume - 0.08);
      } else if (e.key.toLowerCase() === 'm') {
        engine.toggleMute();
      } else if (e.key.toLowerCase() === 'p') {
        setPartyMode((v) => !v);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [engine]);

  // Import local files
  const handleImportFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter(isSupportedAudioFile);
      if (files.length === 0) {
        showNotice('No supported audio files found. Please select MP3, FLAC, WAV, AAC, M4A, or OGG files.');
        return;
      }

      setImportingCount(files.length);
      const imported: Track[] = [];

      for (const file of files) {
        try {
          const { track, blob } = await extractTrackFromFile(file);
          await saveTrackWithBlob(track, blob);
          imported.push(track);
        } catch (err) {
          console.error('Import error:', file.name, err);
        }
      }

      setImportingCount(0);

      if (imported.length > 0) {
        const refreshed = await getAllTracks();
        setTracks(refreshed);

        // If user is currently viewing a custom playlist, also add imported tracks to it
        if (activeFilter.type === 'playlist') {
          const targetPl = playlists.find((p) => p.id === activeFilter.playlistId);
          if (targetPl) {
            const updated: Playlist = {
              ...targetPl,
              trackIds: [...targetPl.trackIds, ...imported.map((t) => t.id)],
              updatedAt: Date.now(),
            };
            await savePlaylist(updated);
            setPlaylists(await getAllPlaylists());
          }
        }

        showNotice(
          `Saved ${imported.length} ${imported.length === 1 ? 'track' : 'tracks'} for offline playback.`
        );
      }
    },
    [activeFilter, playlists, showNotice]
  );

  // Drag & Drop handlers on window
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDraggingFiles) setIsDraggingFiles(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setIsDraggingFiles(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFiles(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleImportFiles(e.dataTransfer.files);
    }
  };

  // Library & Playlist Actions (Mode-Locked Active Queues)
  const handlePlayTrack = (trackId: string) => {
    if (trackId === engine.currentTrackId && engine.activePlaybackSource === 'offline') {
      void engine.togglePlayPause();
      return;
    }

    const queueSource =
      visibleTracks.some((t) => t.id === trackId)
        ? visibleTracks
        : tracks.some((t) => t.id === trackId)
          ? tracks
          : engineTracks;
    const ext = queueSource.filter((t) => Boolean(t.streamUrl));
    void engine.playQueue(
      queueSource.map((t) => t.id),
      trackId,
      'preserve',
      ext.length > 0 ? ext : undefined,
      'offline'
    );
  };

  const handlePlayExternalTrack = (
    track: Track,
    contextTracks?: Track[],
    seed?: StreamSeedContext
  ) => {
    if (seed) {
      streamSeedRef.current = { ...seed };
    }
    const isRadio = Boolean(track.isLive || track.sourceType === 'radio');
    const targetSource = isRadio ? 'radio' : 'online';

    if (
      track.id === engine.currentTrackId &&
      engine.activePlaybackSource === targetSource
    ) {
      void engine.togglePlayPause();
      return;
    }

    const baseList =
      contextTracks && contextTracks.length > 0
        ? contextTracks.filter((t) =>
            isRadio ? Boolean(t.isLive || t.sourceType === 'radio') : !t.isLive
          )
        : [track];

    const queueList = baseList.some((t) => t.id === track.id)
      ? baseList
      : [track, ...baseList];

    void engine.playQueue(
      queueList.map((t) => t.id),
      track.id,
      'preserve',
      queueList,
      targetSource
    );

    // Ensure Radio queue always has at least 10 live stations for Next/Previous hopping
    if (isRadio && queueList.length < 10) {
      const token = ++radioFetchTokenRef.current;
      const existingIds = new Set(queueList.map((t) => t.id));
      void fetch('/api/radio/stations?mode=worldmap')
        .then((res) => (res.ok ? (res.json() as Promise<{ stations?: RadioStation[] }>) : null))
        .then((data) => {
          if (!data?.stations || radioFetchTokenRef.current !== token) return;
          const extraTracks = data.stations
            .map(radioToTrack)
            .filter((t) => !existingIds.has(t.id));
          if (extraTracks.length > 0) {
            engine.appendTracksToQueue(extraTracks, 'radio');
          }
        })
        .catch(() => {});
    }
  };

  const handlePlayExternalQueue = useCallback(
    (
      extTracks: Track[],
      enableShuffle: boolean,
      seed?: StreamSeedContext,
      options?: { crossfade?: boolean; crossfadeMs?: number }
    ) => {
      if (extTracks.length === 0) return;
      if (seed) {
        streamSeedRef.current = { ...seed };
      }
      const isRadio = extTracks.every((t) => Boolean(t.isLive || t.sourceType === 'radio'));
      void engine.playQueue(
        extTracks.map((t) => t.id),
        enableShuffle ? undefined : extTracks[0].id,
        enableShuffle,
        extTracks,
        isRadio ? 'radio' : 'online',
        options
      );
    },
    [engine.playQueue]
  );

  const handleToggleLoveTrack = useCallback(
    async (track: Track) => {
      const isCurrentlyLoved = lovedIds.has(track.id);
      const nextLiked = !isCurrentlyLoved;

      // Sync any matching local/offline track in IndexedDB
      const matchingLocals = tracks.filter(
        (t) =>
          t.id === track.id ||
          t.sourceTrackId === track.id ||
          (track.sourceTrackId && t.id === track.sourceTrackId)
      );
      if (matchingLocals.length > 0) {
        const updatedIds = new Map<string, Track>();
        for (const local of matchingLocals) {
          const updated = { ...local, liked: nextLiked };
          await updateTrackMeta(updated);
          updatedIds.set(local.id, updated);
        }
        setTracks((prev) => prev.map((t) => updatedIds.get(t.id) ?? t));
      }

      setTasteProfile((prev) => {
        let next = recordLoveReaction(prev, track, nextLiked, liveBpm);
        if (!nextLiked && track.sourceTrackId && next.lovedTracks[track.sourceTrackId]) {
          const nextLoved = { ...next.lovedTracks };
          delete nextLoved[track.sourceTrackId];
          next = { ...next, lovedTracks: nextLoved };
        }
        void saveTasteProfile(next);
        return next;
      });
    },
    [liveBpm, lovedIds, tracks]
  );

  const handleToggleLike = useCallback(
    async (trackId: string) => {
      const target =
        tracks.find((t) => t.id === trackId) ??
        visibleTracks.find((t) => t.id === trackId) ??
        tasteProfile.lovedTracks[trackId];
      if (!target) return;
      await handleToggleLoveTrack(target);
    },
    [handleToggleLoveTrack, tasteProfile.lovedTracks, tracks, visibleTracks]
  );

  const handleDislikeAndSkip = useCallback(
    async (track: Track) => {
      const matchingLocals = tracks.filter(
        (t) =>
          (t.id === track.id || t.sourceTrackId === track.id) && t.liked
      );
      if (matchingLocals.length > 0) {
        for (const local of matchingLocals) {
          await updateTrackMeta({ ...local, liked: false });
        }
        setTracks((prev) =>
          prev.map((t) =>
            t.id === track.id || t.sourceTrackId === track.id ? { ...t, liked: false } : t
          )
        );
      }

      setTasteProfile((prev) => {
        const next = recordDislikeReaction(prev, track);
        void saveTasteProfile(next);
        return next;
      });

      if (track.id === engine.currentTrackId) {
        engine.playNext(true);
      }
      showNotice(`Skipped "${track.title}" & tuned recommendations`);
    },
    [engine, showNotice, tracks]
  );

  const handleDownloadTrack = useCallback(
    async (track: Track) => {
      if (!track.streamUrl || track.isLive) return;
      if (downloadedSourceIds.has(track.id)) {
        showNotice(`"${track.title}" is already saved offline.`);
        return;
      }
      if (downloadProgressMap[track.id] !== undefined) return;

      setDownloadProgressMap((prev) => ({ ...prev, [track.id]: 2 }));
      try {
        await downloadOnlineTrackOffline(
          { ...track, liked: lovedIds.has(track.id) },
          (pct) => {
            setDownloadProgressMap((prev) => ({ ...prev, [track.id]: pct }));
          }
        );
        const refreshed = await getAllTracks();
        setTracks(refreshed);
        showNotice(`Saved "${track.title}" for offline playback`);
      } catch (err) {
        console.error('Offline download error:', err);
        showNotice(`Could not download "${track.title}". Check your connection and try again.`);
      } finally {
        setDownloadProgressMap((prev) => {
          const next = { ...prev };
          delete next[track.id];
          return next;
        });
      }
    },
    [downloadProgressMap, downloadedSourceIds, lovedIds, showNotice]
  );

  const handleNextWithTasteTrack = useCallback(() => {
    if (
      engine.currentTrack &&
      engine.duration > 10 &&
      engine.currentTime < engine.duration * 0.45
    ) {
      const skipped = engine.currentTrack;
      setTasteProfile((prev) => {
        const next = recordSkipEvent(prev, skipped);
        void saveTasteProfile(next);
        return next;
      });
    }
    engine.playNext(true);
  }, [engine]);

  const handleDeleteTrack = async (trackId: string) => {
    await deleteTrackFromDB(trackId);
    setTracks((prev) => prev.filter((t) => t.id !== trackId));

    // Clean up playlist references
    const affected = playlists.filter((p) => p.trackIds.includes(trackId));
    for (const pl of affected) {
      const updated = {
        ...pl,
        trackIds: pl.trackIds.filter((id) => id !== trackId),
        updatedAt: Date.now(),
      };
      await savePlaylist(updated);
    }
    if (affected.length > 0) {
      setPlaylists(await getAllPlaylists());
    }
  };

  const handleCreatePlaylist = async (name: string) => {
    const newPl: Playlist = {
      id: crypto.randomUUID(),
      name,
      description: '',
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await savePlaylist(newPl);
    setPlaylists((prev) => [...prev, newPl]);
    setActiveFilter({ type: 'playlist', playlistId: newPl.id });
  };

  const handleRenamePlaylist = async (playlistId: string, name: string) => {
    const target = playlists.find((p) => p.id === playlistId);
    if (!target) return;
    const updated = { ...target, name, updatedAt: Date.now() };
    await savePlaylist(updated);
    setPlaylists((prev) => prev.map((p) => (p.id === playlistId ? updated : p)));
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    await deletePlaylistFromDB(playlistId);
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
    if (activeFilter.type === 'playlist' && activeFilter.playlistId === playlistId) {
      setActiveFilter({ type: 'all' });
    }
  };

  const handleToggleTrackInPlaylist = async (playlistId: string, trackId: string) => {
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    const exists = pl.trackIds.includes(trackId);
    const updated: Playlist = {
      ...pl,
      trackIds: exists
        ? pl.trackIds.filter((id) => id !== trackId)
        : [...pl.trackIds, trackId],
      updatedAt: Date.now(),
    };
    await savePlaylist(updated);
    setPlaylists((prev) => prev.map((p) => (p.id === playlistId ? updated : p)));
  };

  const handleRemoveFromPlaylist = async (playlistId: string, trackId: string) => {
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    const updated: Playlist = {
      ...pl,
      trackIds: pl.trackIds.filter((id) => id !== trackId),
      updatedAt: Date.now(),
    };
    await savePlaylist(updated);
    setPlaylists((prev) => prev.map((p) => (p.id === playlistId ? updated : p)));
  };

  const totalStorageBytes = useMemo(
    () => tracks.reduce((sum, t) => sum + (t.fileSize || 0), 0),
    [tracks]
  );

  const favoritesCount = mergedFavorites.length;

  const activeHeading = useMemo(() => {
    if (activeFilter.type === 'favorites') return 'Liked Songs';
    if (activeFilter.type === 'downloads') return 'Offline Downloads';
    if (activeFilter.type === 'playlist') {
      return playlists.find((p) => p.id === activeFilter.playlistId)?.name ?? 'Playlist';
    }
    return 'All Tracks';
  }, [activeFilter, playlists]);

  const currentTrack = engine.currentTrack;
  const activeTopTab = getTabForFilter(activeFilter);
  const activeTabIndex = TOP_TABS.findIndex((t) => t.id === activeTopTab);

  const effectiveMoodHint =
    activeTopTab === 'streaming' || engine.activePlaybackSource === 'online'
      ? activeSynthPlan?.moodEnvironment || moodHint
      : undefined;
  const activeMoodEnvironment = useMemo(
    () => resolveMoodEnvironment(effectiveMoodHint, currentTrack),
    [effectiveMoodHint, currentTrack]
  );

  const selectFilterWithDirection = useCallback(
    (nextFilter: LibraryFilter) => {
      const prevTab = getTabForFilter(activeFilter);
      const nextTab = getTabForFilter(nextFilter);
      if (nextTab === 'offline') {
        lastOfflineFilterRef.current = nextFilter;
      }
      const prevIdx = TOP_TABS.findIndex((t) => t.id === prevTab);
      const nextIdx = TOP_TABS.findIndex((t) => t.id === nextTab);
      if (nextIdx !== prevIdx) {
        setTabDirection(nextIdx > prevIdx ? 'right' : 'left');
      }
      setActiveFilter(nextFilter);
    },
    [activeFilter]
  );

  const selectTopTab = useCallback(
    (tab: TopTab) => {
      if (tab === activeTopTab) return;
      void triggerHapticLight();
      if (tab === 'streaming') {
        selectFilterWithDirection({ type: 'discover' });
      } else if (tab === 'radio') {
        selectFilterWithDirection({ type: 'radiomap' });
      } else {
        selectFilterWithDirection(lastOfflineFilterRef.current);
      }
    },
    [activeTopTab, selectFilterWithDirection]
  );

  const handleMainTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    const ignore = Boolean(
      target?.closest('input, svg, button, select, textarea, [data-no-tab-swipe]')
    );
    mainSwipeRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      ignore,
    };
  };

  const handleMainTouchEnd = (e: React.TouchEvent) => {
    const start = mainSwipeRef.current;
    mainSwipeRef.current = null;
    if (!start || start.ignore) return;
    const endX = e.changedTouches[0]?.clientX ?? start.x;
    const endY = e.changedTouches[0]?.clientY ?? start.y;
    const dx = endX - start.x;
    const dy = endY - start.y;
    if (Math.abs(dx) < 68 || Math.abs(dx) < Math.abs(dy) * 1.55) return;

    if (dx < 0 && activeTabIndex < TOP_TABS.length - 1) {
      selectTopTab(TOP_TABS[activeTabIndex + 1].id);
    } else if (dx > 0 && activeTabIndex > 0) {
      selectTopTab(TOP_TABS[activeTabIndex - 1].id);
    }
  };

  return (
    <div
      className="relative flex flex-col h-screen overflow-hidden select-none"
      style={{ backgroundColor: 'transparent' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Mood-Synchronized Live Animated Background Environment */}
      <MoodEnvironmentBackdrop
        environment={activeMoodEnvironment}
        theme={activeTheme}
        isPlaying={engine.isPlaying}
        partyMode={partyMode}
        analysisFrameRef={engine.analysisFrameRef}
        showGlassScrim={false}
      />

      {/* Dynamic Apple Music-style Ambient Album-Art Mesh Backdrop */}
      <AmbientBackdrop
        currentTrack={currentTrack}
        theme={activeTheme}
        partyMode={partyMode}
        isPlaying={engine.isPlaying}
      />

      {/* Beat-Synced Party Mode Background Lighting */}
      <PartyBackdrop
        enabled={partyMode}
        intensity={partyIntensity}
        isPlaying={engine.isPlaying}
        theme={activeTheme}
        analysisFrameRef={engine.analysisFrameRef}
      />

      {/* Translucent Frosted UI Overlay so vivid mood canvases shine behind cards */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1] bg-white/55 dark:bg-zinc-950/60 backdrop-blur-md transition-colors duration-700"
      />

      <OfflineIndicator />

      {/* Hidden Multi-Format File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.flac,.wav,.aac,.m4a,.ogg,.opus,.aiff,.webm"
        onChange={(e) => {
          if (e.target.files) {
            void handleImportFiles(e.target.files);
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* Frosted Top Navigation Header + 3-Tab Sliding Segmented Switcher */}
      <header
        className="relative z-20 border-b shrink-0 bg-white/55 dark:bg-zinc-950/60 backdrop-blur-md transition-colors"
        style={{
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div className="flex items-center justify-between gap-3 sm:gap-6 px-3.5 sm:px-6 h-14">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                setMobileSidebarOpen(true);
              }}
              aria-label="Open library navigation"
              className="sonance-press lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Disc3 className="w-5 h-5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
              <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
                Sonance
              </span>
            </div>
          </div>

          {/* Zone 2 (Desktop/Tablet): Frosted 3-Tab Segmented Switcher */}
          <div className="hidden md:flex flex-1 justify-center min-w-0">
            <div
              role="tablist"
              aria-label="Audio source sections"
              className="relative grid grid-cols-3 p-1 rounded-full border backdrop-blur-xl w-full max-w-[420px]"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 72%, transparent)',
                borderColor: 'var(--border-hairline)',
              }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-full shadow-sm"
                style={{
                  width: 'calc((100% - 8px) / 3)',
                  backgroundColor: 'var(--bg-surface)',
                  transform: `translate3d(${activeTabIndex * 100}%, 0, 0)`,
                  transition: 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
              {TOP_TABS.map((tab) => {
                const active = activeTopTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectTopTab(tab.id)}
                    className="sonance-press relative z-10 min-h-[34px] px-3 rounded-full text-xs font-semibold whitespace-nowrap truncate transition-colors"
                    style={{
                      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Zone 3: Scan Music, Theme Selector & PWA Install */}
          <div className="relative flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isScanningDevice}
              onClick={() => {
                void triggerHapticLight();
                void handleScanDevice();
              }}
              className="sonance-press inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-xl border whitespace-nowrap shrink-0 hover:opacity-85 disabled:opacity-60"
              style={{
                borderColor: 'var(--border-hairline)',
                backgroundColor: 'color-mix(in srgb, var(--bg-canvas) 78%, transparent)',
                color: 'var(--text-primary)',
              }}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${isScanningDevice ? 'animate-spin' : ''}`}
                style={{ color: 'var(--accent-primary)' }}
              />
              <span className="hidden sm:inline">
                {isScanningDevice ? 'Scanning...' : 'Scan Music'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                setShowThemePicker((v) => !v);
              }}
              className="sonance-press inline-flex items-center gap-2 min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-xl border whitespace-nowrap shrink-0"
              style={{
                borderColor: showThemePicker
                  ? 'var(--accent-primary)'
                  : 'var(--border-hairline)',
                backgroundColor: 'color-mix(in srgb, var(--bg-canvas) 78%, transparent)',
                color: 'var(--text-primary)',
              }}
            >
              <Palette className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
              <span className="hidden sm:inline">{activeTheme.name}</span>
              <span className="sm:hidden">Theme</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                setProfileSettingsOpen(true);
              }}
              aria-label="Open Profile and Settings"
              className="sonance-press inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-xl border whitespace-nowrap shrink-0 hover:opacity-85"
              style={{
                borderColor: profileSettingsOpen
                  ? 'var(--accent-primary)'
                  : 'var(--border-hairline)',
                backgroundColor: 'color-mix(in srgb, var(--bg-canvas) 78%, transparent)',
                color: 'var(--text-primary)',
              }}
            >
              <User className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
              <span className="hidden sm:inline">Profile</span>
            </button>

            <PWAInstallButton />

            {showThemePicker && (
              <div className="absolute right-0 top-12 z-50">
                <ThemePicker
                  activeTheme={themeId}
                  onSelectTheme={(id) => {
                    void triggerHapticLight();
                    setThemeId(id);
                    setShowThemePicker(false);
                  }}
                  onClose={() => setShowThemePicker(false)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Mobile Frosted 3-Tab Segmented Switcher Bar */}
        <div className="md:hidden px-3.5 pb-2.5">
          <div
            role="tablist"
            aria-label="Audio source sections"
            className="relative grid grid-cols-3 p-1 rounded-full border backdrop-blur-xl w-full"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 72%, transparent)',
              borderColor: 'var(--border-hairline)',
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-full shadow-sm"
              style={{
                width: 'calc((100% - 8px) / 3)',
                backgroundColor: 'var(--bg-surface)',
                transform: `translate3d(${activeTabIndex * 100}%, 0, 0)`,
                transition: 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
            {TOP_TABS.map((tab) => {
              const active = activeTopTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectTopTab(tab.id)}
                  className="sonance-press relative z-10 min-h-[34px] px-2 rounded-full text-xs font-semibold whitespace-nowrap truncate transition-colors"
                  style={{
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Studio Workspace */}
      <div className="relative z-10 flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          activeFilter={activeFilter}
          onSelectFilter={selectFilterWithDirection}
          tracksCount={tracks.length}
          favoritesCount={favoritesCount}
          downloadsCount={downloadedTracks.length}
          totalStorageBytes={totalStorageBytes}
          playlists={playlists}
          onCreatePlaylist={(name) => void handleCreatePlaylist(name)}
          onRenamePlaylist={(id, name) => void handleRenamePlaylist(id, name)}
          onDeletePlaylist={(id) => void handleDeletePlaylist(id)}
          onTriggerImport={() => fileInputRef.current?.click()}
          onScanDevice={() => void handleScanDevice()}
          isScanning={isScanningDevice}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onOpenProfileSettings={() => setProfileSettingsOpen(true)}
        />

        {/* Scrollable Stage + Library Content */}
        <main
          onTouchStart={handleMainTouchStart}
          onTouchEnd={handleMainTouchEnd}
          className="flex-1 min-w-0 overflow-y-auto px-4 sm:px-8 py-5 sm:py-7"
        >
          <div className="mx-auto max-w-5xl space-y-7 pb-6">
            {/* Now Playing Focal Stage */}
            <section
              className="sonance-glass rounded-3xl border p-5 sm:p-6 shadow-xs transition-colors"
              style={{
                borderColor: 'var(--border-hairline)',
              }}
            >
              <div className="flex flex-col md:flex-row md:items-stretch gap-6">
                {/* Album Artwork (tappable to expand Full-Screen Now Playing Sheet) */}
                <button
                  type="button"
                  onClick={() => {
                    void triggerHapticLight();
                    setNowPlayingOpen(true);
                  }}
                  aria-label="Open full-screen Now Playing view"
                  className="sonance-press self-center md:self-auto shrink-0 rounded-2xl focus-visible:outline-2"
                >
                  <div
                    ref={artworkFrameRef}
                    className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl border overflow-hidden flex items-center justify-center shadow-lg will-change-transform"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-hairline)',
                      transition: 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    {currentTrack?.artworkDataUrl ? (
                      <img
                        src={currentTrack.artworkDataUrl}
                        alt={`${currentTrack.title} album artwork`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music className="w-12 h-12" style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>
                </button>

                {/* Track Identity + Music-Style Visualizer */}
                <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div
                        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-mono-tabular"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <span>
                          {currentTrack
                            ? currentTrack.isLive
                              ? 'LIVE RADIO'
                              : currentTrack.genre
                            : 'Audio Engine'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{currentTrack ? currentTrack.format : 'Ready'}</span>
                        {currentTrack?.sampleRate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {(currentTrack.sampleRate / 1000).toFixed(1).replace(/\.0$/, '')} kHz
                            </span>
                          </>
                        )}
                        {currentTrack?.bitrate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{currentTrack.bitrate} kbps</span>
                          </>
                        )}
                        {liveBpm && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{liveBpm} BPM</span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          void triggerHapticLight();
                          setNowPlayingOpen(true);
                        }}
                        className="text-left block w-full"
                      >
                        <h1 className="font-display mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight truncate text-balance">
                          {currentTrack ? currentTrack.title : 'Drop audio files to begin'}
                        </h1>
                        <p className="text-sm truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {currentTrack
                            ? `${currentTrack.artist} — ${currentTrack.album}`
                            : 'Supports MP3, FLAC, WAV, AAC, M4A, OGG with full offline playback'}
                        </p>
                      </button>
                    </div>

                    {currentTrack && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            void triggerHapticMedium();
                            void handleToggleLoveTrack(currentTrack);
                          }}
                          aria-label={
                            lovedIds.has(currentTrack.id)
                              ? 'Remove from Liked Songs'
                              : 'Love track'
                          }
                          className="sonance-press min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border shrink-0"
                          style={{
                            borderColor: lovedIds.has(currentTrack.id)
                              ? 'var(--accent-primary)'
                              : 'var(--border-hairline)',
                            color: lovedIds.has(currentTrack.id)
                              ? 'var(--accent-primary)'
                              : 'var(--text-muted)',
                            backgroundColor: lovedIds.has(currentTrack.id)
                              ? 'var(--bg-elevated)'
                              : 'transparent',
                          }}
                        >
                          <Heart
                            className={`w-4 h-4 transition-transform ${
                              lovedIds.has(currentTrack.id)
                                ? 'fill-current sonance-heart-liked'
                                : ''
                            }`}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            void triggerHapticLight();
                            void handleDislikeAndSkip(currentTrack);
                          }}
                          aria-label="Dislike and skip track"
                          title="Dislike & skip"
                          className="sonance-press min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border shrink-0 hover:opacity-80"
                          style={{
                            borderColor: 'var(--border-hairline)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>

                        {currentTrack.streamUrl && !currentTrack.isLive && (
                          <DownloadButton
                            isDownloaded={downloadedSourceIds.has(currentTrack.id)}
                            progress={downloadProgressMap[currentTrack.id]}
                            trackTitle={currentTrack.title}
                            onDownload={(e) => {
                              e.stopPropagation();
                              void triggerHapticLight();
                              void handleDownloadTrack(currentTrack);
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Visualizer Canvas */}
                  <div className="h-32 sm:h-36 w-full">
                    <AudioVisualizer
                      mode={visualizerMode}
                      currentTrack={currentTrack}
                      isPlaying={engine.isPlaying}
                      theme={activeTheme}
                      analysisFrameRef={engine.analysisFrameRef}
                      onResolvedStyleChange={setResolvedVisStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Visualizer Style & Party Mode Bar */}
              <div
                className="mt-5 pt-4 border-t flex flex-wrap items-center justify-between gap-3"
                style={{ borderColor: 'var(--border-hairline)' }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="inline-flex flex-wrap items-center p-0.5 rounded-lg border"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      borderColor: 'var(--border-hairline)',
                    }}
                  >
                    {VISUALIZER_MODES.map((m) => {
                      const active = visualizerMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setVisualizerMode(m.id)}
                          className="px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors"
                          style={{
                            backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                            color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                          }}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>

                  {visualizerMode === 'auto' && (
                    <span
                      className="text-xs font-mono-tabular whitespace-nowrap"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Matched: {STYLE_LABELS[resolvedVisStyle]}
                    </span>
                  )}
                </div>

                {/* Party Mode Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void triggerHapticLight();
                      setPartyMode((v) => !v);
                    }}
                    className="sonance-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0"
                    style={{
                      backgroundColor: partyMode ? 'var(--accent-primary)' : 'transparent',
                      borderColor: partyMode
                        ? 'var(--accent-primary)'
                        : 'var(--border-hairline)',
                      color: partyMode ? 'var(--accent-contrast)' : 'var(--text-primary)',
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Party Lighting</span>
                  </button>

                  {partyMode && (
                    <div
                      className="inline-flex items-center p-0.5 rounded-lg border"
                      style={{
                        backgroundColor: 'var(--bg-elevated)',
                        borderColor: 'var(--border-hairline)',
                      }}
                    >
                      {(
                        [
                          { id: 'subtle', label: 'Subtle' },
                          { id: 'club', label: 'Club' },
                          { id: 'dynamic', label: 'Dynamic' },
                        ] as const
                      ).map((lvl) => {
                        const active = partyIntensity === lvl.id;
                        return (
                          <button
                            key={lvl.id}
                            type="button"
                            onClick={() => setPartyIntensity(lvl.id)}
                            className="px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors"
                            style={{
                              backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                              color: active
                                ? 'var(--accent-primary)'
                                : 'var(--text-muted)',
                            }}
                          >
                            {lvl.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Main Animated Tab Stage: Online Streaming, Offline Music, or Radio */}
            <div
              key={activeTopTab}
              className={tabDirection === 'right' ? 'sonance-stage-right' : 'sonance-stage-left'}
            >
              {activeFilter.type === 'discover' ? (
                <DiscoverGlobal
                  geoProfile={geoProfile}
                  onChangeRegionOverride={setRegionOverride}
                  currentTrackId={engine.currentTrackId}
                  isPlaying={engine.isPlaying}
                  infiniteQueueEnabled={engine.infiniteQueueEnabled}
                  onToggleInfiniteQueue={() => engine.setInfiniteQueueEnabled((v) => !v)}
                  lovedIds={lovedIds}
                  dislikedIds={dislikedIds}
                  downloadedSourceIds={downloadedSourceIds}
                  downloadProgressMap={downloadProgressMap}
                  onPlayExternalTrack={handlePlayExternalTrack}
                  onPlayExternalQueue={handlePlayExternalQueue}
                  onTogglePlayPause={() => void engine.togglePlayPause()}
                  onShowNotice={showNotice}
                  onMoodHintChange={setMoodHint}
                  onSynthPlanChange={setActiveSynthPlan}
                  isCrossfading={engine.isCrossfading}
                  onToggleLove={(t) => void handleToggleLoveTrack(t)}
                  onDislikeAndSkip={(t) => void handleDislikeAndSkip(t)}
                  onDownloadTrack={(t) => void handleDownloadTrack(t)}
                  onSuggestVisualizer={(style) => setVisualizerMode(style)}
                />
              ) : activeFilter.type === 'radiomap' ? (
                <WorldRadioMap
                  currentTrackId={engine.currentTrackId}
                  isPlaying={engine.isPlaying}
                  onPlayStation={handlePlayExternalTrack}
                />
              ) : loadingLibrary ? (
                <StreamRowSkeleton count={4} />
              ) : (
                <div className="space-y-8">
                  {/* Compact Offline Sub-Collection Bar for seamless one-handed mobile switching */}
                  <div className="flex flex-wrap items-center gap-2">
                    {(
                      [
                        { filter: { type: 'all' } as LibraryFilter, label: `All Tracks (${tracks.length})` },
                        { filter: { type: 'favorites' } as LibraryFilter, label: `Liked Songs (${favoritesCount})` },
                        { filter: { type: 'downloads' } as LibraryFilter, label: `Offline Downloads (${downloadedTracks.length})` },
                      ]
                    ).map((sub) => {
                      const active = activeFilter.type === sub.filter.type;
                      return (
                        <button
                          key={sub.filter.type}
                          type="button"
                          onClick={() => {
                            void triggerHapticLight();
                            selectFilterWithDirection(sub.filter);
                          }}
                          className="sonance-press min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs font-medium whitespace-nowrap"
                          style={{
                            backgroundColor: active
                              ? 'var(--accent-primary)'
                              : 'color-mix(in srgb, var(--bg-surface) 74%, transparent)',
                            borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                            color: active ? 'var(--accent-contrast)' : 'var(--text-primary)',
                          }}
                        >
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>

                  {activeFilter.type === 'all' && (
                    <ForYouSection
                      tasteProfile={tasteProfile}
                      libraryTracks={tracks}
                      regionCountry={geoProfile?.country}
                      currentTrackId={engine.currentTrackId}
                      isPlaying={engine.isPlaying}
                      lovedIds={lovedIds}
                      dislikedIds={dislikedIds}
                      downloadedSourceIds={downloadedSourceIds}
                      downloadProgressMap={downloadProgressMap}
                      onPlayTrack={handlePlayExternalTrack}
                      onPlayQueue={handlePlayExternalQueue}
                      onToggleLove={(t) => void handleToggleLoveTrack(t)}
                      onDislikeAndSkip={(t) => void handleDislikeAndSkip(t)}
                      onDownloadTrack={(t) => void handleDownloadTrack(t)}
                    />
                  )}

                  <TrackList
                    heading={activeHeading}
                    tracks={visibleTracks}
                    currentTrackId={engine.currentTrackId}
                    isPlaying={engine.isPlaying}
                    playlists={playlists}
                    isPlaylistView={activeFilter.type === 'playlist'}
                    activePlaylistId={
                      activeFilter.type === 'playlist' ? activeFilter.playlistId : undefined
                    }
                    downloadedSourceIds={downloadedSourceIds}
                    downloadProgressMap={downloadProgressMap}
                    onPlayTrack={handlePlayTrack}
                    onPlayAll={(ids) => {
                      const ext = visibleTracks.filter((t) => Boolean(t.streamUrl));
                      void engine.playQueue(
                        ids,
                        ids[0],
                        false,
                        ext.length > 0 ? ext : undefined,
                        'offline'
                      );
                    }}
                    onShuffleAll={(ids) => {
                      const ext = visibleTracks.filter((t) => Boolean(t.streamUrl));
                      void engine.playQueue(
                        ids,
                        undefined,
                        true,
                        ext.length > 0 ? ext : undefined,
                        'offline'
                      );
                    }}
                    onToggleLike={(id) => void handleToggleLike(id)}
                    onToggleTrackInPlaylist={(plId, tId) =>
                      void handleToggleTrackInPlaylist(plId, tId)
                    }
                    onDeleteTrack={(id) => void handleDeleteTrack(id)}
                    onRemoveFromPlaylist={(plId, tId) =>
                      void handleRemoveFromPlaylist(plId, tId)
                    }
                    onDownloadTrack={(t) => void handleDownloadTrack(t)}
                    onTriggerImport={() => fileInputRef.current?.click()}
                    onScanDevice={() => void handleScanDevice()}
                    isScanning={isScanningDevice}
                  />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Floating Frosted-Glass Mini-Player Capsule */}
      <PlayerDock
        currentTrack={currentTrack}
        isPlaying={engine.isPlaying}
        currentTime={engine.currentTime}
        duration={engine.duration}
        volume={engine.volume}
        isMuted={engine.isMuted}
        shuffle={engine.shuffle}
        repeat={engine.repeat}
        infiniteQueueEnabled={engine.infiniteQueueEnabled}
        isFetchingNextBatch={engine.isFetchingNextBatch}
        partyMode={partyMode}
        eqPreset={engine.eqPreset}
        eqBands={engine.eqBands}
        playbackRate={engine.playbackRate}
        sleepTimerMode={engine.sleepTimerMode}
        sleepRemainingSeconds={engine.sleepRemainingSeconds}
        isCurrentLoved={Boolean(currentTrack && lovedIds.has(currentTrack.id))}
        isCurrentDownloaded={Boolean(currentTrack && downloadedSourceIds.has(currentTrack.id))}
        currentDownloadProgress={
          currentTrack ? downloadProgressMap[currentTrack.id] : undefined
        }
        onExpandNowPlaying={() => setNowPlayingOpen(true)}
        onTogglePlayPause={() => void engine.togglePlayPause()}
        onPrevious={engine.playPrevious}
        onNext={handleNextWithTasteTrack}
        onSeek={engine.seekTo}
        onVolumeChange={engine.setVolume}
        onToggleMute={engine.toggleMute}
        onToggleShuffle={() => engine.setShuffle((s) => !s)}
        onCycleRepeat={() =>
          engine.setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))
        }
        onToggleInfiniteQueue={() => engine.setInfiniteQueueEnabled((v) => !v)}
        onTogglePartyMode={() => setPartyMode((p) => !p)}
        onApplyEQPreset={engine.applyEQPreset}
        onChangeEQBand={engine.setEQBandGain}
        onChangePlaybackRate={engine.setPlaybackRate}
        onSelectSleepTimer={engine.setSleepTimer}
        onToggleLoveCurrent={() => {
          if (currentTrack) void handleToggleLoveTrack(currentTrack);
        }}
        onDislikeSkipCurrent={() => {
          if (currentTrack) void handleDislikeAndSkip(currentTrack);
        }}
        onDownloadCurrent={() => {
          if (currentTrack) void handleDownloadTrack(currentTrack);
        }}
      />

      {/* Full-Screen Now Playing Sheet */}
      <NowPlayingSheet
        open={nowPlayingOpen}
        onClose={() => setNowPlayingOpen(false)}
        currentTrack={currentTrack}
        isPlaying={engine.isPlaying}
        currentTime={engine.currentTime}
        duration={engine.duration}
        volume={engine.volume}
        isMuted={engine.isMuted}
        shuffle={engine.shuffle}
        repeat={engine.repeat}
        infiniteQueueEnabled={engine.infiniteQueueEnabled}
        partyMode={partyMode}
        partyIntensity={partyIntensity}
        visualizerMode={visualizerMode}
        eqPreset={engine.eqPreset}
        eqBands={engine.eqBands}
        playbackRate={engine.playbackRate}
        sleepTimerMode={engine.sleepTimerMode}
        sleepRemainingSeconds={engine.sleepRemainingSeconds}
        isCurrentLoved={Boolean(currentTrack && lovedIds.has(currentTrack.id))}
        isCurrentDownloaded={Boolean(currentTrack && downloadedSourceIds.has(currentTrack.id))}
        currentDownloadProgress={
          currentTrack ? downloadProgressMap[currentTrack.id] : undefined
        }
        liveBpm={liveBpm}
        theme={activeTheme}
        moodEnvironment={activeMoodEnvironment}
        synthPlan={activeSynthPlan}
        isCrossfading={engine.isCrossfading}
        analysisFrameRef={engine.analysisFrameRef}
        onTogglePlayPause={() => void engine.togglePlayPause()}
        onPrevious={engine.playPrevious}
        onNext={handleNextWithTasteTrack}
        onSeek={engine.seekTo}
        onVolumeChange={engine.setVolume}
        onToggleMute={engine.toggleMute}
        onToggleShuffle={() => engine.setShuffle((s) => !s)}
        onCycleRepeat={() =>
          engine.setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'))
        }
        onToggleInfiniteQueue={() => engine.setInfiniteQueueEnabled((v) => !v)}
        onTogglePartyMode={() => setPartyMode((p) => !p)}
        onChangePartyIntensity={setPartyIntensity}
        onChangeVisualizerMode={setVisualizerMode}
        onApplyEQPreset={engine.applyEQPreset}
        onChangeEQBand={engine.setEQBandGain}
        onChangePlaybackRate={engine.setPlaybackRate}
        onSelectSleepTimer={engine.setSleepTimer}
        onToggleLoveCurrent={() => {
          if (currentTrack) void handleToggleLoveTrack(currentTrack);
        }}
        onDislikeSkipCurrent={() => {
          if (currentTrack) void handleDislikeAndSkip(currentTrack);
        }}
        onDownloadCurrent={() => {
          if (currentTrack) void handleDownloadTrack(currentTrack);
        }}
      />

      {/* Profile & Settings Modal with 30-Day Recharts Listening Vibe Trends */}
      <ProfileSettingsModal
        open={profileSettingsOpen}
        onClose={() => setProfileSettingsOpen(false)}
        tasteProfile={tasteProfile}
        libraryTracks={tracks}
        favoritesCount={favoritesCount}
        downloadedCount={downloadedTracks.length}
        totalStorageBytes={totalStorageBytes}
        geoProfile={geoProfile}
        themeId={themeId}
        onSelectTheme={setThemeId}
        visualizerMode={visualizerMode}
        onChangeVisualizerMode={setVisualizerMode}
        partyMode={partyMode}
        onTogglePartyMode={() => setPartyMode((p) => !p)}
        partyIntensity={partyIntensity}
        onChangePartyIntensity={setPartyIntensity}
        eqPreset={engine.eqPreset}
        onApplyEQPreset={engine.applyEQPreset}
        infiniteQueueEnabled={engine.infiniteQueueEnabled}
        onToggleInfiniteQueue={() => engine.setInfiniteQueueEnabled((v) => !v)}
        onResetTasteProfile={() => {
          const fresh = createEmptyTasteProfile();
          setTasteProfile(fresh);
          void saveTasteProfile(fresh);
          showNotice('Listening taste profile & vibe history reset');
        }}
      />

      {/* Reserved bottom space for Android AdMob banner so PlayerDock is never covered */}
      {bannerHeight > 0 && (
        <div
          aria-hidden="true"
          className="relative z-20 w-full shrink-0"
          style={{
            height: `calc(${bannerHeight}px + env(safe-area-inset-bottom, 0px))`,
            backgroundColor: 'var(--bg-canvas)',
          }}
        />
      )}

      {/* Drag & Drop File Overlay */}
      {isDraggingFiles && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-6"
          style={{ backgroundColor: 'rgba(14, 15, 17, 0.72)' }}
        >
          <div
            className="w-full max-w-md rounded-2xl border-2 border-dashed p-10 text-center"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--accent-primary)',
              color: 'var(--text-primary)',
            }}
          >
            <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--accent-primary)' }} />
            <p className="text-base font-semibold">Drop audio files to save offline</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              MP3, FLAC, WAV, AAC, M4A, OGG, and OPUS supported
            </p>
          </div>
        </div>
      )}

      {/* Subtle status / import toast */}
      {(notice || importingCount > 0) && (
        <div
          role="status"
          className="fixed right-4 z-50 rounded-xl border px-4 py-2.5 text-xs font-medium shadow-lg"
          style={{
            bottom: `calc(${96 + bannerHeight}px + env(safe-area-inset-bottom, 0px))`,
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-hairline)',
            color: 'var(--text-primary)',
          }}
        >
          {importingCount > 0
            ? `Importing ${importingCount} audio ${importingCount === 1 ? 'file' : 'files'} into offline storage...`
            : notice}
        </div>
      )}
    </div>
  );
}
