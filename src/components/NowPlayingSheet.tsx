import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Check,
  ChevronDown,
  Heart,
  Infinity as InfinityIcon,
  Moon,
  Music,
  Pause,
  Play,
  Radio,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sliders,
  Sparkles,
  ThumbsDown,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { EQ_PRESETS } from '../hooks/useAudioEngine';
import { ThemePalette } from '../themes/themes';
import {
  AIMoodPlan,
  AudioAnalysisFrame,
  EQBand,
  EQPresetId,
  PartyIntensity,
  QuantumVisualizerMode,
  RepeatMode,
  SleepTimerMode,
  Track,
  VisualizerMode,
} from '../types/audio';
import { formatDuration } from '../utils/audioMetadata';
import { triggerHapticLight, triggerHapticMedium } from '../utils/haptics';
import { AmbientBackdrop } from './AmbientBackdrop';
import { DownloadButton } from './DownloadButton';
import {
  MoodEnvironmentBackdrop,
  MoodEnvironmentType,
} from './MoodEnvironmentBackdrop';
import { QuantumVisualizer3D } from './QuantumVisualizer3D';

interface NowPlayingSheetProps {
  open: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  infiniteQueueEnabled: boolean;
  partyMode: boolean;
  partyIntensity: PartyIntensity;
  visualizerMode: VisualizerMode;
  eqPreset: EQPresetId;
  eqBands: EQBand[];
  playbackRate: number;
  sleepTimerMode: SleepTimerMode;
  sleepRemainingSeconds: number | null;
  isCurrentLoved: boolean;
  isCurrentDownloaded: boolean;
  currentDownloadProgress?: number;
  liveBpm: number | null;
  theme: ThemePalette;
  moodEnvironment?: MoodEnvironmentType;
  synthPlan?: AIMoodPlan | null;
  isCrossfading?: boolean;
  analysisFrameRef: React.MutableRefObject<AudioAnalysisFrame>;
  onTogglePlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleInfiniteQueue: () => void;
  onTogglePartyMode: () => void;
  onChangePartyIntensity: (lvl: PartyIntensity) => void;
  onChangeVisualizerMode: (mode: VisualizerMode) => void;
  onApplyEQPreset: (preset: EQPresetId) => void;
  onChangeEQBand: (index: number, gain: number) => void;
  onChangePlaybackRate: (rate: number) => void;
  onSelectSleepTimer: (mode: SleepTimerMode) => void;
  onToggleLoveCurrent: () => void;
  onDislikeSkipCurrent: () => void;
  onDownloadCurrent: () => void;
}

const SLEEP_OPTIONS: Array<{ mode: SleepTimerMode; label: string }> = [
  { mode: 'off', label: 'Off' },
  { mode: 15, label: '15m' },
  { mode: 30, label: '30m' },
  { mode: 45, label: '45m' },
  { mode: 60, label: '60m' },
  { mode: 'track', label: 'Track End' },
];

const QUANTUM_VIS_MODES: Array<{ id: QuantumVisualizerMode; label: string }> = [
  { id: 'quantum', label: 'Quantum Tunnel' },
  { id: 'neural', label: 'AI Neural Symphony' },
  { id: 'nebula', label: 'Nebula Warp' },
  { id: 'bars', label: 'Classic Pro Bars' },
];

type SheetDrawer = 'none' | 'eq' | 'sleep';

export const NowPlayingSheet: React.FC<NowPlayingSheetProps> = ({
  open,
  onClose,
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  shuffle,
  repeat,
  infiniteQueueEnabled,
  partyMode,
  partyIntensity,
  visualizerMode,
  eqPreset,
  eqBands,
  playbackRate,
  sleepTimerMode,
  sleepRemainingSeconds,
  isCurrentLoved,
  isCurrentDownloaded,
  currentDownloadProgress,
  liveBpm,
  theme,
  moodEnvironment = 'aurora',
  synthPlan = null,
  isCrossfading = false,
  analysisFrameRef,
  onTogglePlayPause,
  onPrevious,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onToggleInfiniteQueue,
  onTogglePartyMode,
  onChangePartyIntensity,
  onChangeVisualizerMode,
  onApplyEQPreset,
  onChangeEQBand,
  onChangePlaybackRate,
  onSelectSleepTimer,
  onToggleLoveCurrent,
  onDislikeSkipCurrent,
  onDownloadCurrent,
}) => {
  const [stageMode, setStageMode] = useState<'artwork' | 'visualizer'>('artwork');
  const [quantumMode, setQuantumMode] = useState<QuantumVisualizerMode>(() => {
    const saved = localStorage.getItem('sonance-quantum-vis');
    if (saved === 'quantum' || saved === 'neural' || saved === 'nebula' || saved === 'bars') {
      return saved;
    }
    return 'quantum';
  });
  const [activeDrawer, setActiveDrawer] = useState<SheetDrawer>('none');
  const [dragY, setDragY] = useState(0);
  const [scrubPreview, setScrubPreview] = useState<number | null>(null);
  const [isRendered, setIsRendered] = useState(open);
  const [isVisible, setIsVisible] = useState(open);
  const swipeStartY = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem('sonance-quantum-vis', quantumMode);
  }, [quantumMode]);

  useEffect(() => {
    if (
      synthPlan?.quantumMode === 'quantum' ||
      synthPlan?.quantumMode === 'neural' ||
      synthPlan?.quantumMode === 'nebula' ||
      synthPlan?.quantumMode === 'bars'
    ) {
      setQuantumMode(synthPlan.quantumMode);
    }
  }, [synthPlan?.quantumMode]);

  useEffect(() => {
    if (open) {
      setIsRendered(true);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    setIsVisible(false);
    const timer = window.setTimeout(() => {
      setIsRendered(false);
      setDragY(0);
    }, 420);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  if (!isRendered) return null;

  const isLive = Boolean(currentTrack?.isLive);
  const safeDuration = isLive ? 0 : duration > 0 ? duration : currentTrack?.duration ?? 0;
  const effectiveTime = scrubPreview ?? currentTime;
  const progressPct = isLive
    ? isPlaying
      ? 100
      : 0
    : safeDuration > 0
      ? Math.min(100, (effectiveTime / safeDuration) * 100)
      : 0;

  const sourceLabel = currentTrack?.isLive
    ? 'Live Radio'
    : currentTrack?.sourceType === 'jamendo'
      ? 'Jamendo Stream'
      : currentTrack?.sourceType === 'audius'
        ? 'Audius Stream'
        : currentTrack?.isDownloaded
          ? 'Offline Download'
          : 'Offline Studio';

  const sleepLabel =
    sleepTimerMode === 'track'
      ? 'Track End'
      : typeof sleepRemainingSeconds === 'number'
        ? formatDuration(sleepRemainingSeconds)
        : 'Sleep';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full-screen Now Playing"
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto will-change-transform"
      style={{
        backgroundColor: 'transparent',
        color: 'var(--text-primary)',
        opacity: isVisible ? 1 : 0,
        transform: !isVisible
          ? 'translate3d(0, 100%, 0) scale(0.97)'
          : dragY > 0
            ? `translate3d(0, ${dragY}px, 0)`
            : 'translate3d(0, 0, 0) scale(1)',
        transition:
          dragY > 0
            ? 'none'
            : 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 340ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {/* Mood-Synchronized Live Animated Environment */}
      <MoodEnvironmentBackdrop
        environment={moodEnvironment}
        theme={theme}
        isPlaying={isPlaying}
        partyMode={partyMode}
        analysisFrameRef={analysisFrameRef}
        showGlassScrim={false}
      />

      {/* Dynamic Ambient Album Art Mesh Backdrop */}
      <AmbientBackdrop
        currentTrack={currentTrack}
        theme={theme}
        partyMode={partyMode}
        isPlaying={isPlaying}
      />

      {/* Translucent Frosted Glass Scrim so live mood animation glows vividly behind album art */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-white/55 dark:bg-zinc-950/60 backdrop-blur-md transition-colors duration-700"
      />

      <div className="relative z-10 flex flex-col justify-between min-h-full mx-auto w-full max-w-2xl px-5 sm:px-8 pt-3 pb-7">
        {/* Grab Handle + Sheet Top Bar */}
        <div
          onTouchStart={(e) => {
            swipeStartY.current = e.touches[0].clientY;
          }}
          onTouchMove={(e) => {
            if (swipeStartY.current === null) return;
            const dy = e.touches[0].clientY - swipeStartY.current;
            if (dy > 0) setDragY(Math.min(180, dy * 0.75));
          }}
          onTouchEnd={(e) => {
            if (swipeStartY.current === null) return;
            const dy = (e.changedTouches[0]?.clientY ?? swipeStartY.current) - swipeStartY.current;
            swipeStartY.current = null;
            setDragY(0);
            if (dy > 70) {
              void triggerHapticLight();
              onClose();
            }
          }}
          className="space-y-2 pb-2"
        >
          <div className="w-10 h-1.5 rounded-full mx-auto opacity-40" style={{ backgroundColor: 'var(--text-muted)' }} />

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                onClose();
              }}
              aria-label="Minimize Now Playing"
              className="sonance-press min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--bg-surface) 65%, transparent)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-primary)',
              }}
            >
              <ChevronDown className="w-5 h-5" />
            </button>

            <div className="text-center min-w-0">
              <p className="text-[11px] font-mono-tabular uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {sourceLabel}
              </p>
              {currentTrack?.album && (
                <p className="text-xs font-medium truncate max-w-[200px] sm:max-w-[300px]">
                  {currentTrack.album}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                onTogglePartyMode();
              }}
              aria-label="Toggle Party Lighting"
              className="sonance-press min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border"
              style={{
                backgroundColor: partyMode
                  ? 'var(--accent-primary)'
                  : 'color-mix(in srgb, var(--bg-surface) 65%, transparent)',
                borderColor: partyMode ? 'var(--accent-primary)' : 'var(--border-hairline)',
                color: partyMode ? 'var(--accent-contrast)' : 'var(--text-primary)',
              }}
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Hero: Large Rounded Artwork OR Next-Gen 3D Quantum Journey Visualizer */}
        <div className="my-4 flex flex-col items-center justify-center gap-3.5">
          {stageMode === 'artwork' ? (
            <div
              className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-3xl overflow-hidden border flex items-center justify-center shadow-[0_28px_60px_-14px_rgba(0,0,0,0.45)]"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'color-mix(in srgb, var(--border-hairline) 120%, rgba(255,255,255,0.16))',
                transform: isPlaying ? 'scale(1)' : 'scale(0.91)',
                transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {currentTrack?.artworkDataUrl ? (
                <img
                  src={currentTrack.artworkDataUrl}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : currentTrack?.isLive ? (
                <Radio className="w-16 h-16" style={{ color: 'var(--accent-primary)' }} />
              ) : (
                <Music className="w-16 h-16" style={{ color: 'var(--text-muted)' }} />
              )}
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-2.5">
              {/* Futuristic 3D Visualizer Viewport */}
              <div
                className="relative w-full h-64 sm:h-80 rounded-3xl overflow-hidden border shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55)]"
                style={{
                  borderColor: 'rgba(255, 255, 255, 0.16)',
                  backgroundColor: '#050818',
                }}
              >
                <QuantumVisualizer3D
                  mode={quantumMode}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  theme={theme}
                  moodEnvironment={moodEnvironment}
                  synthTargetBpm={
                    synthPlan
                      ? Math.round((synthPlan.targetBpmMin + synthPlan.targetBpmMax) / 2)
                      : null
                  }
                  synthHarmonicIntensity={synthPlan?.harmonicIntensity ?? null}
                  analysisFrameRef={analysisFrameRef}
                />
              </div>

              {/* Sleek 4-Mode Selector Pill below the 3D Visualizer */}
              <div
                role="tablist"
                aria-label="3D Visualizer modes"
                className="inline-flex flex-wrap items-center justify-center gap-1 p-1 rounded-full border bg-white/55 dark:bg-zinc-950/60 backdrop-blur-md"
                style={{ borderColor: 'var(--border-hairline)' }}
              >
                {QUANTUM_VIS_MODES.map((m) => {
                  const active = quantumMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        void triggerHapticLight();
                        setQuantumMode(m.id);
                      }}
                      className="sonance-press px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap shrink-0"
                      style={{
                        backgroundColor: active ? 'var(--accent-primary)' : 'transparent',
                        color: active ? 'var(--accent-contrast)' : 'var(--text-primary)',
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Seamless Stage View Toggle (Album Artwork vs Live 3D Visualizer) */}
          <div
            className="inline-flex items-center p-1 rounded-full border bg-white/55 dark:bg-zinc-950/60 backdrop-blur-md"
            style={{ borderColor: 'var(--border-hairline)' }}
          >
            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                setStageMode('artwork');
              }}
              className="sonance-press px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0"
              style={{
                backgroundColor: stageMode === 'artwork' ? 'var(--bg-surface)' : 'transparent',
                color: stageMode === 'artwork' ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              Artwork
            </button>
            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                setStageMode('visualizer');
              }}
              className="sonance-press inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0"
              style={{
                backgroundColor: stageMode === 'visualizer' ? 'var(--bg-surface)' : 'transparent',
                color: stageMode === 'visualizer' ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              <Activity className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
              <span>3D Visualizer</span>
            </button>
          </div>
        </div>

        {/* Track Title, Reactions & Offline Progress Ring */}
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight truncate">
                {currentTrack ? currentTrack.title : 'No Track Selected'}
              </h2>
              <p className="text-sm sm:text-base truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {currentTrack ? currentTrack.artist : 'Choose a song or radio station'}
              </p>
              {currentTrack && (
                <p
                  className="mt-1 text-[11px] font-mono-tabular truncate"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {currentTrack.genre} · {currentTrack.format}
                  {currentTrack.bitrate ? ` · ${currentTrack.bitrate} kbps` : ''}
                  {liveBpm ? ` · ${liveBpm} BPM` : currentTrack.bpm ? ` · ${currentTrack.bpm} BPM` : ''}
                  {isCrossfading
                    ? ' · Crossfading'
                    : synthPlan
                      ? ` · ${synthPlan.emotionalState || synthPlan.moodTitle}`
                      : ''}
                </p>
              )}
            </div>

            {currentTrack && (
              <div className="flex items-center gap-1.5 shrink-0 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    void triggerHapticMedium();
                    onToggleLoveCurrent();
                  }}
                  aria-label={isCurrentLoved ? 'Remove from Liked Songs' : 'Love track'}
                  className="sonance-press min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border"
                  style={{
                    borderColor: isCurrentLoved ? 'var(--accent-primary)' : 'var(--border-hairline)',
                    backgroundColor: isCurrentLoved
                      ? 'color-mix(in srgb, var(--accent-primary) 14%, var(--bg-surface))'
                      : 'color-mix(in srgb, var(--bg-surface) 65%, transparent)',
                    color: isCurrentLoved ? 'var(--accent-primary)' : 'var(--text-muted)',
                  }}
                >
                  <Heart
                    className={`w-5 h-5 transition-transform ${
                      isCurrentLoved ? 'fill-current sonance-heart-liked' : ''
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void triggerHapticLight();
                    onDislikeSkipCurrent();
                  }}
                  aria-label="Dislike and skip"
                  className="sonance-press min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border"
                  style={{
                    borderColor: 'var(--border-hairline)',
                    backgroundColor: 'color-mix(in srgb, var(--bg-surface) 65%, transparent)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <ThumbsDown className="w-4 h-4" />
                </button>

                {currentTrack.streamUrl && !currentTrack.isLive && (
                  <DownloadButton
                    compact
                    isDownloaded={isCurrentDownloaded}
                    progress={currentDownloadProgress}
                    trackTitle={currentTrack.title}
                    onDownload={(e) => {
                      e.stopPropagation();
                      void triggerHapticLight();
                      onDownloadCurrent();
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Precision Scrubbable Progress Bar */}
          <div className="space-y-1.5">
            <div className="relative h-7 flex items-center">
              <div
                className="w-full h-1.5 rounded-full overflow-hidden"
                style={{ backgroundColor: 'color-mix(in srgb, var(--text-muted) 22%, transparent)' }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-75"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: 'var(--accent-primary)',
                  }}
                />
              </div>
              {!isLive && (
                <input
                  type="range"
                  min={0}
                  max={safeDuration || 1}
                  step={0.1}
                  value={Math.min(effectiveTime, safeDuration || 1)}
                  onChange={(e) => setScrubPreview(parseFloat(e.target.value))}
                  onMouseUp={() => {
                    if (scrubPreview !== null) {
                      onSeek(scrubPreview);
                      setScrubPreview(null);
                    }
                  }}
                  onTouchEnd={() => {
                    if (scrubPreview !== null) {
                      onSeek(scrubPreview);
                      setScrubPreview(null);
                    }
                  }}
                  onKeyUp={() => {
                    if (scrubPreview !== null) {
                      onSeek(scrubPreview);
                      setScrubPreview(null);
                    }
                  }}
                  aria-label="Scrub track progress"
                  className="sonance-slider absolute inset-0 w-full h-full"
                />
              )}
            </div>

            <div
              className="flex items-center justify-between font-mono-tabular text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              <span>{formatDuration(effectiveTime)}</span>
              <span>
                {isLive
                  ? 'LIVE STREAM'
                  : safeDuration > 0
                    ? `-${formatDuration(Math.max(0, safeDuration - effectiveTime))}`
                    : '0:00'}
              </span>
            </div>
          </div>

          {/* Full Transport Controls */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                onToggleShuffle();
              }}
              aria-label="Toggle shuffle"
              className="sonance-press min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full"
              style={{ color: shuffle ? 'var(--accent-primary)' : 'var(--text-muted)' }}
            >
              <Shuffle className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                onPrevious();
              }}
              aria-label="Previous track"
              className="sonance-press min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full"
              style={{ color: 'var(--text-primary)' }}
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </button>

            <button
              type="button"
              onClick={() => {
                void triggerHapticMedium();
                onTogglePlayPause();
              }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="sonance-press w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
              }}
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 fill-current" />
              ) : (
                <Play className="w-7 h-7 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                onNext();
              }}
              aria-label="Next track"
              className="sonance-press min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full"
              style={{ color: 'var(--text-primary)' }}
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>

            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                onCycleRepeat();
              }}
              aria-label={`Repeat mode: ${repeat}`}
              className="sonance-press min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full"
              style={{ color: repeat !== 'off' ? 'var(--accent-primary)' : 'var(--text-muted)' }}
            >
              {repeat === 'one' ? (
                <Repeat1 className="w-5 h-5" />
              ) : (
                <Repeat className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Volume + Utility Quick Dock (EQ, Visualizer, Sleep Timer, Infinite Queue) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-3 px-1">
              <button
                type="button"
                onClick={() => {
                  void triggerHapticLight();
                  onToggleMute();
                }}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className="sonance-press min-w-[36px] min-h-[36px] flex items-center justify-center"
                style={{ color: 'var(--text-muted)' }}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                aria-label="Volume"
                className="sonance-slider flex-1"
                style={{
                  background: `linear-gradient(to right, var(--accent-primary) ${
                    (isMuted ? 0 : volume) * 100
                  }%, color-mix(in srgb, var(--text-muted) 24%, transparent) ${
                    (isMuted ? 0 : volume) * 100
                  }%)`,
                  height: '4px',
                  borderRadius: '9999px',
                }}
              />
            </div>

            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  void triggerHapticLight();
                  setActiveDrawer((d) => (d === 'eq' ? 'none' : 'eq'));
                }}
                className="sonance-press min-h-[44px] flex items-center justify-center gap-1.5 rounded-2xl border text-xs font-medium px-2"
                style={{
                  backgroundColor:
                    activeDrawer === 'eq'
                      ? 'var(--accent-primary)'
                      : 'color-mix(in srgb, var(--bg-surface) 68%, transparent)',
                  borderColor:
                    activeDrawer === 'eq' ? 'var(--accent-primary)' : 'var(--border-hairline)',
                  color: activeDrawer === 'eq' ? 'var(--accent-contrast)' : 'var(--text-primary)',
                }}
              >
                <Sliders className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Equalizer</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  void triggerHapticLight();
                  setStageMode((m) => (m === 'artwork' ? 'visualizer' : 'artwork'));
                }}
                className="sonance-press min-h-[44px] flex items-center justify-center gap-1.5 rounded-2xl border text-xs font-medium px-2"
                style={{
                  backgroundColor:
                    stageMode === 'visualizer'
                      ? 'var(--accent-primary)'
                      : 'color-mix(in srgb, var(--bg-surface) 68%, transparent)',
                  borderColor:
                    stageMode === 'visualizer'
                      ? 'var(--accent-primary)'
                      : 'var(--border-hairline)',
                  color:
                    stageMode === 'visualizer' ? 'var(--accent-contrast)' : 'var(--text-primary)',
                }}
              >
                <Activity className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Visualizer</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  void triggerHapticLight();
                  setActiveDrawer((d) => (d === 'sleep' ? 'none' : 'sleep'));
                }}
                className="sonance-press min-h-[44px] flex items-center justify-center gap-1.5 rounded-2xl border text-xs font-medium px-2"
                style={{
                  backgroundColor:
                    sleepTimerMode !== 'off' || activeDrawer === 'sleep'
                      ? 'color-mix(in srgb, var(--accent-primary) 16%, var(--bg-surface))'
                      : 'color-mix(in srgb, var(--bg-surface) 68%, transparent)',
                  borderColor:
                    sleepTimerMode !== 'off' || activeDrawer === 'sleep'
                      ? 'var(--accent-primary)'
                      : 'var(--border-hairline)',
                  color:
                    sleepTimerMode !== 'off' ? 'var(--accent-primary)' : 'var(--text-primary)',
                }}
              >
                <Moon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate font-mono-tabular">{sleepLabel}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  void triggerHapticLight();
                  onToggleInfiniteQueue();
                }}
                className="sonance-press min-h-[44px] flex items-center justify-center gap-1.5 rounded-2xl border text-xs font-medium px-2"
                style={{
                  backgroundColor: infiniteQueueEnabled
                    ? 'color-mix(in srgb, var(--accent-primary) 16%, var(--bg-surface))'
                    : 'color-mix(in srgb, var(--bg-surface) 68%, transparent)',
                  borderColor: infiniteQueueEnabled
                    ? 'var(--accent-primary)'
                    : 'var(--border-hairline)',
                  color: infiniteQueueEnabled ? 'var(--accent-primary)' : 'var(--text-muted)',
                }}
              >
                <InfinityIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Infinite</span>
              </button>
            </div>

            {/* Inline Equalizer Drawer */}
            {activeDrawer === 'eq' && (
              <div
                className="rounded-2xl border p-4 space-y-3 sonance-glass"
                style={{ borderColor: 'var(--border-hairline)' }}
              >
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(EQ_PRESETS) as EQPresetId[]).map((presetKey) => {
                    const active = eqPreset === presetKey;
                    return (
                      <button
                        key={presetKey}
                        type="button"
                        onClick={() => {
                          void triggerHapticLight();
                          onApplyEQPreset(presetKey);
                        }}
                        className="sonance-press px-2.5 py-1 text-xs font-medium rounded-lg border whitespace-nowrap"
                        style={{
                          backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                          borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                          color: active ? 'var(--accent-contrast)' : 'var(--text-primary)',
                        }}
                      >
                        {EQ_PRESETS[presetKey].label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-5 gap-2 pt-1">
                  {eqBands.map((band, index) => (
                    <div key={band.frequency} className="flex flex-col items-center gap-1.5">
                      <span className="font-mono-tabular text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {band.gain > 0 ? `+${band.gain.toFixed(1)}` : band.gain.toFixed(1)}
                      </span>
                      <input
                        type="range"
                        min={-12}
                        max={12}
                        step={0.5}
                        value={band.gain}
                        onChange={(e) => onChangeEQBand(index, parseFloat(e.target.value))}
                        aria-label={`${band.label} EQ gain`}
                        className="sonance-slider h-20 w-4 [writing-mode:vertical-lr] [direction:rtl]"
                      />
                      <span className="font-mono-tabular text-[11px] font-medium">{band.label}</span>
                    </div>
                  ))}
                </div>

                <div
                  className="pt-2 border-t flex items-center justify-between gap-2"
                  style={{ borderColor: 'var(--border-hairline)' }}
                >
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    Speed &amp; Party Intensity
                  </span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {[0.75, 1, 1.25, 1.5].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => {
                          void triggerHapticLight();
                          onChangePlaybackRate(rate);
                        }}
                        className="sonance-press px-2 py-1 rounded-md text-xs font-mono-tabular font-medium"
                        style={{
                          backgroundColor: playbackRate === rate ? 'var(--bg-elevated)' : 'transparent',
                          color: playbackRate === rate ? 'var(--accent-primary)' : 'var(--text-muted)',
                        }}
                      >
                        {rate}x
                      </button>
                    ))}
                    {partyMode &&
                      (['subtle', 'club', 'dynamic'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => {
                            void triggerHapticLight();
                            onChangePartyIntensity(lvl);
                          }}
                          className="sonance-press px-2 py-1 rounded-md text-xs capitalize font-medium"
                          style={{
                            backgroundColor:
                              partyIntensity === lvl ? 'var(--bg-elevated)' : 'transparent',
                            color:
                              partyIntensity === lvl ? 'var(--accent-primary)' : 'var(--text-muted)',
                          }}
                        >
                          {lvl}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Inline Sleep Timer Drawer */}
            {activeDrawer === 'sleep' && (
              <div
                className="rounded-2xl border p-3.5 flex flex-wrap gap-2 sonance-glass"
                style={{ borderColor: 'var(--border-hairline)' }}
              >
                {SLEEP_OPTIONS.map((opt) => {
                  const active = sleepTimerMode === opt.mode;
                  return (
                    <button
                      key={String(opt.mode)}
                      type="button"
                      onClick={() => {
                        void triggerHapticLight();
                        onSelectSleepTimer(opt.mode);
                        setActiveDrawer('none');
                      }}
                      className="sonance-press inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium"
                      style={{
                        backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                        borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                        color: active ? 'var(--accent-contrast)' : 'var(--text-primary)',
                      }}
                    >
                      {active && <Check className="w-3.5 h-3.5" />}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
