import React, { useRef, useState } from 'react';
import {
  Check,
  ChevronUp,
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
import { EQBand, EQPresetId, RepeatMode, SleepTimerMode, Track } from '../types/audio';
import { formatDuration } from '../utils/audioMetadata';
import {
  triggerHapticLight,
  triggerHapticMedium,
  triggerHapticSelectionChanged,
  triggerHapticSelectionEnd,
  triggerHapticSelectionStart,
} from '../utils/haptics';
import { DownloadButton } from './DownloadButton';
import { EqualizerPopover } from './EqualizerPopover';

interface PlayerDockProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  infiniteQueueEnabled: boolean;
  isFetchingNextBatch: boolean;
  partyMode: boolean;
  eqPreset: EQPresetId;
  eqBands: EQBand[];
  playbackRate: number;
  sleepTimerMode: SleepTimerMode;
  sleepRemainingSeconds: number | null;
  isCurrentLoved: boolean;
  isCurrentDownloaded: boolean;
  currentDownloadProgress?: number;
  onExpandNowPlaying: () => void;
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
  { mode: 15, label: '15 minutes' },
  { mode: 30, label: '30 minutes' },
  { mode: 45, label: '45 minutes' },
  { mode: 60, label: '60 minutes' },
  { mode: 'track', label: 'End of track' },
];

export const PlayerDock: React.FC<PlayerDockProps> = ({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  shuffle,
  repeat,
  infiniteQueueEnabled,
  isFetchingNextBatch,
  partyMode,
  eqPreset,
  eqBands,
  playbackRate,
  sleepTimerMode,
  sleepRemainingSeconds,
  isCurrentLoved,
  isCurrentDownloaded,
  currentDownloadProgress,
  onExpandNowPlaying,
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
  onApplyEQPreset,
  onChangeEQBand,
  onChangePlaybackRate,
  onSelectSleepTimer,
  onToggleLoveCurrent,
  onDislikeSkipCurrent,
  onDownloadCurrent,
}) => {
  const [showEQ, setShowEQ] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number; ignored: boolean } | null>(null);

  const isLive = Boolean(currentTrack?.isLive);
  const safeDuration = isLive ? 0 : duration > 0 ? duration : currentTrack?.duration ?? 0;
  const progressPct = isLive
    ? isPlaying
      ? 100
      : 0
    : safeDuration > 0
      ? Math.min(100, (currentTime / safeDuration) * 100)
      : 0;

  const sleepBadgeText =
    sleepTimerMode === 'track'
      ? 'Track End'
      : typeof sleepRemainingSeconds === 'number'
        ? formatDuration(sleepRemainingSeconds)
        : null;

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    const isRange = target?.tagName === 'INPUT';
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      ignored: Boolean(isRange),
    };
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start || start.ignored) return;
    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.15) {
      if (!isSwiping) {
        void triggerHapticSelectionStart();
      }
      setIsSwiping(true);
      setSwipeOffsetX(Math.max(-56, Math.min(56, dx * 0.65)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || start.ignored) {
      setSwipeOffsetX(0);
      setIsSwiping(false);
      return;
    }

    const endX = e.changedTouches[0]?.clientX ?? start.x;
    const endY = e.changedTouches[0]?.clientY ?? start.y;
    const dx = endX - start.x;
    const dy = endY - start.y;

    setSwipeOffsetX(0);
    setIsSwiping(false);

    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      void triggerHapticLight();
      if (dx < 0) {
        onNext();
      } else {
        onPrevious();
      }
      return;
    }

    if (dy < -36 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      void triggerHapticLight();
      onExpandNowPlaying();
    }
  };

  return (
    <footer className="relative z-30 shrink-0 px-2.5 sm:px-5 pb-2 pt-0.5 pointer-events-none">
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="pointer-events-auto relative mx-auto max-w-6xl rounded-2xl border shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 76%, transparent)',
          borderColor: 'color-mix(in srgb, var(--border-hairline) 120%, rgba(255,255,255,0.14))',
          backdropFilter: 'blur(20px) saturate(165%)',
          WebkitBackdropFilter: 'blur(20px) saturate(165%)',
          transform: `translate3d(${swipeOffsetX}px, 0, 0)`,
          transition: isSwiping ? 'none' : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Top Interactive Scrub Bar inside floating capsule */}
        <div
          className="relative h-1 w-full rounded-t-2xl overflow-hidden group"
          style={{ backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 70%, transparent)' }}
        >
          <div
            className="h-full transition-[width] duration-100"
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
            value={Math.min(currentTime, safeDuration || 1)}
            onMouseDown={() => void triggerHapticSelectionStart()}
            onTouchStart={() => void triggerHapticSelectionStart()}
            onChange={(e) => {
              void triggerHapticSelectionChanged(75);
              onSeek(parseFloat(e.target.value));
            }}
            onMouseUp={() => void triggerHapticSelectionEnd()}
            onTouchEnd={() => void triggerHapticSelectionEnd()}
            aria-label="Seek audio position"
            className="hidden sm:block absolute left-2 right-2 -top-1.5 h-4 opacity-0 cursor-pointer z-10"
          />
        )}

        <div className="flex items-center justify-between gap-2.5 sm:gap-4 px-3 sm:px-4 py-2">
          {/* Left: Tappable Track Summary (opens full-screen Now Playing Sheet) */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 lg:max-w-[320px]">
            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                onExpandNowPlaying();
              }}
              aria-label="Open full-screen Now Playing view"
              className="sonance-press flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 text-left rounded-xl p-0.5 focus-visible:outline-2"
            >
              <div
                className="w-11 h-11 rounded-xl border overflow-hidden shrink-0 flex items-center justify-center shadow-xs"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-hairline)',
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
                  <Radio className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                ) : (
                  <Music className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold tracking-tight truncate">
                  {currentTrack ? currentTrack.title : 'Select a track'}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {currentTrack
                    ? `${currentTrack.artist} · ${currentTrack.isLive ? 'LIVE STREAM' : currentTrack.format}`
                    : 'Offline library ready'}
                </p>
              </div>
            </button>

            {currentTrack && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    void triggerHapticMedium();
                    onToggleLoveCurrent();
                  }}
                  aria-label={isCurrentLoved ? 'Remove from Liked Songs' : 'Love track'}
                  className="sonance-press min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl"
                  style={{
                    color: isCurrentLoved ? 'var(--accent-primary)' : 'var(--text-muted)',
                  }}
                >
                  <Heart
                    className={`w-4 h-4 transition-transform ${
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
                  aria-label="Dislike and skip track"
                  title="Dislike & skip"
                  className="hidden md:flex sonance-press min-w-[36px] min-h-[36px] items-center justify-center rounded-xl hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
                {currentTrack.streamUrl && !currentTrack.isLive && (
                  <div className="hidden md:block">
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
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center: Primary Transport + Timecode */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                onToggleShuffle();
              }}
              aria-label="Toggle shuffle"
              className="hidden sm:flex sonance-press min-w-[40px] min-h-[40px] items-center justify-center rounded-xl"
              style={{
                color: shuffle ? 'var(--accent-primary)' : 'var(--text-muted)',
              }}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                onPrevious();
              }}
              aria-label="Previous track"
              className="hidden sm:flex sonance-press min-w-[42px] min-h-[42px] items-center justify-center rounded-xl hover:opacity-80"
              style={{ color: 'var(--text-primary)' }}
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={() => {
                void triggerHapticMedium();
                onTogglePlayPause();
              }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="sonance-press w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-md"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
              }}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                onNext();
              }}
              aria-label="Next track"
              className="sonance-press min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl hover:opacity-80"
              style={{ color: 'var(--text-primary)' }}
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                onCycleRepeat();
              }}
              aria-label={`Repeat mode: ${repeat}`}
              className="hidden sm:flex sonance-press min-w-[40px] min-h-[40px] items-center justify-center rounded-xl"
              style={{
                color: repeat !== 'off' ? 'var(--accent-primary)' : 'var(--text-muted)',
              }}
            >
              {repeat === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                onToggleInfiniteQueue();
              }}
              aria-label={infiniteQueueEnabled ? 'Disable Infinite Queue' : 'Enable Infinite Queue'}
              aria-pressed={infiniteQueueEnabled}
              title={
                isFetchingNextBatch
                  ? 'Loading next infinite stream batch...'
                  : infiniteQueueEnabled
                    ? 'Infinite Queue: Auto-streaming enabled'
                    : 'Infinite Queue: Off'
              }
              className="hidden md:flex sonance-press min-w-[40px] min-h-[40px] items-center justify-center rounded-xl"
              style={{
                color: infiniteQueueEnabled ? 'var(--accent-primary)' : 'var(--text-muted)',
                opacity: isFetchingNextBatch ? 0.65 : 1,
              }}
            >
              <InfinityIcon className="w-4 h-4" />
            </button>

            <div
              className="hidden lg:flex items-center gap-1.5 pl-2 font-mono-tabular text-xs whitespace-nowrap"
              style={{ color: 'var(--text-muted)' }}
            >
              {isLive ? (
                <span style={{ color: 'var(--accent-primary)' }}>
                  LIVE · {formatDuration(currentTime)}
                </span>
              ) : (
                <>
                  <span style={{ color: 'var(--text-primary)' }}>{formatDuration(currentTime)}</span>
                  <span>/</span>
                  <span>{formatDuration(safeDuration)}</span>
                </>
              )}
            </div>
          </div>

          {/* Right: Sleep Timer, Party Mode, EQ, Volume & Expand Now Playing */}
          <div className="hidden sm:flex items-center justify-end gap-1.5 sm:flex-1 lg:max-w-[340px]">
            {/* Sleep Timer */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  void triggerHapticLight();
                  setShowSleepMenu((v) => !v);
                  setShowEQ(false);
                }}
                aria-label="Sleep Timer"
                className="sonance-press inline-flex items-center gap-1.5 min-w-[40px] min-h-[40px] px-2.5 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0"
                style={{
                  borderColor:
                    sleepTimerMode !== 'off' || showSleepMenu
                      ? 'var(--accent-primary)'
                      : 'var(--border-hairline)',
                  color: sleepTimerMode !== 'off' ? 'var(--accent-primary)' : 'var(--text-primary)',
                }}
              >
                <Moon className="w-4 h-4 shrink-0" />
                {sleepBadgeText && (
                  <span className="font-mono-tabular text-[11px]">{sleepBadgeText}</span>
                )}
              </button>

              {showSleepMenu && (
                <div
                  className="absolute right-0 bottom-14 z-50 w-48 rounded-2xl border p-1.5 shadow-2xl sonance-glass"
                  style={{
                    borderColor: 'var(--border-hairline)',
                  }}
                >
                  <p
                    className="px-2.5 py-1 text-[11px] font-medium"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Sleep Timer
                  </p>
                  {SLEEP_OPTIONS.map((opt) => {
                    const active = sleepTimerMode === opt.mode;
                    return (
                      <button
                        key={String(opt.mode)}
                        type="button"
                        onClick={() => {
                          void triggerHapticLight();
                          onSelectSleepTimer(opt.mode);
                          setShowSleepMenu(false);
                        }}
                        className="sonance-press w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-xs text-left hover:opacity-80"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <span>{opt.label}</span>
                        {active && (
                          <Check
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: 'var(--accent-primary)' }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                onTogglePartyMode();
              }}
              aria-label="Toggle Party Lighting"
              className="hidden xl:inline-flex sonance-press items-center gap-1.5 min-h-[40px] px-3 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0"
              style={{
                backgroundColor: partyMode ? 'var(--accent-primary)' : 'transparent',
                borderColor: partyMode ? 'var(--accent-primary)' : 'var(--border-hairline)',
                color: partyMode ? 'var(--accent-contrast)' : 'var(--text-primary)',
              }}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Party</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  void triggerHapticLight();
                  setShowEQ((v) => !v);
                  setShowSleepMenu(false);
                }}
                aria-label="Open 5-band equalizer"
                className="sonance-press min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border"
                style={{
                  borderColor: showEQ ? 'var(--accent-primary)' : 'var(--border-hairline)',
                  color: showEQ ? 'var(--accent-primary)' : 'var(--text-primary)',
                }}
              >
                <Sliders className="w-4 h-4" />
              </button>

              {showEQ && (
                <div className="absolute right-0 bottom-14 z-50">
                  <EqualizerPopover
                    eqPreset={eqPreset}
                    eqBands={eqBands}
                    playbackRate={playbackRate}
                    onApplyPreset={onApplyEQPreset}
                    onChangeBand={onChangeEQBand}
                    onChangePlaybackRate={onChangePlaybackRate}
                    onClose={() => setShowEQ(false)}
                  />
                </div>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-2 pl-1">
              <button
                type="button"
                onClick={() => {
                  void triggerHapticLight();
                  onToggleMute();
                }}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className="sonance-press min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:opacity-75"
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
                onMouseDown={() => void triggerHapticSelectionStart()}
                onTouchStart={() => void triggerHapticSelectionStart()}
                onChange={(e) => {
                  void triggerHapticSelectionChanged(60);
                  onVolumeChange(parseFloat(e.target.value));
                }}
                onMouseUp={() => void triggerHapticSelectionEnd()}
                onTouchEnd={() => void triggerHapticSelectionEnd()}
                aria-label="Volume"
                className="sonance-slider w-20"
                style={{
                  background: `linear-gradient(to right, var(--accent-primary) ${
                    (isMuted ? 0 : volume) * 100
                  }%, var(--bg-elevated) ${(isMuted ? 0 : volume) * 100}%)`,
                  height: '4px',
                  borderRadius: '9999px',
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                void triggerHapticLight();
                onExpandNowPlaying();
              }}
              aria-label="Expand Now Playing view"
              title="Full-screen Now Playing"
              className="sonance-press min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border"
              style={{
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-primary)',
              }}
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
