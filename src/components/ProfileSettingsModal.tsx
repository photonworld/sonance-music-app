import React, { useEffect, useState } from 'react';
import {
  Activity,
  Check,
  Disc3,
  Globe,
  Heart,
  Infinity as InfinityIcon,
  Palette,
  RotateCcw,
  Sliders,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { EQ_PRESETS } from '../hooks/useAudioEngine';
import { THEMES } from '../themes/themes';
import {
  EQPresetId,
  GeoRegionProfile,
  PartyIntensity,
  TasteProfile,
  ThemeId,
  Track,
  VisualizerMode,
} from '../types/audio';
import { formatBytes } from '../utils/audioMetadata';
import { triggerHapticLight, triggerHapticMedium } from '../utils/haptics';
import { ListeningVibeTrends } from './ListeningVibeTrends';

interface ProfileSettingsModalProps {
  open: boolean;
  onClose: () => void;
  tasteProfile: TasteProfile;
  libraryTracks: Track[];
  favoritesCount: number;
  downloadedCount: number;
  totalStorageBytes: number;
  geoProfile: GeoRegionProfile | null;
  themeId: ThemeId;
  onSelectTheme: (id: ThemeId) => void;
  visualizerMode: VisualizerMode;
  onChangeVisualizerMode: (mode: VisualizerMode) => void;
  partyMode: boolean;
  onTogglePartyMode: () => void;
  partyIntensity: PartyIntensity;
  onChangePartyIntensity: (lvl: PartyIntensity) => void;
  eqPreset: EQPresetId;
  onApplyEQPreset: (preset: EQPresetId) => void;
  infiniteQueueEnabled: boolean;
  onToggleInfiniteQueue: () => void;
  onResetTasteProfile: () => void;
}

const VIS_MODES: Array<{ id: VisualizerMode; label: string }> = [
  { id: 'auto', label: 'Auto' },
  { id: 'spectrum', label: 'Spectrum' },
  { id: 'waveform', label: 'Waveform' },
  { id: 'radial', label: 'Radial' },
  { id: 'analog', label: 'Analog' },
  { id: 'kinetic', label: 'Kinetic' },
];

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  open,
  onClose,
  tasteProfile,
  libraryTracks,
  favoritesCount,
  downloadedCount,
  totalStorageBytes,
  geoProfile,
  themeId,
  onSelectTheme,
  visualizerMode,
  onChangeVisualizerMode,
  partyMode,
  onTogglePartyMode,
  partyIntensity,
  onChangePartyIntensity,
  eqPreset,
  onApplyEQPreset,
  infiniteQueueEnabled,
  onToggleInfiniteQueue,
  onResetTasteProfile,
}) => {
  const [isRendered, setIsRendered] = useState(open);
  const [isVisible, setIsVisible] = useState(open);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (open) {
      setIsRendered(true);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    setIsVisible(false);
    setConfirmReset(false);
    const timer = window.setTimeout(() => {
      setIsRendered(false);
    }, 340);
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

  const totalPlays = Object.values(tasteProfile.playCounts).reduce((a, b) => a + b, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Profile and Settings"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-md p-0 sm:p-6"
      style={{
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 300ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-4xl max-h-[90vh] rounded-t-3xl sm:rounded-3xl overflow-hidden border flex flex-col shadow-2xl will-change-transform"
        style={{
          backgroundColor: 'var(--bg-canvas)',
          borderColor: 'var(--border-hairline)',
          color: 'var(--text-primary)',
          opacity: isVisible ? 1 : 0,
          transform: isVisible
            ? 'translate3d(0, 0, 0) scale(1)'
            : 'translate3d(0, 32px, 0) scale(0.97)',
          transition:
            'transform 340ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div
          className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b shrink-0"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-surface) 84%, transparent)',
            borderColor: 'var(--border-hairline)',
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--accent-primary)',
              }}
            >
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight truncate">
                Profile &amp; Settings
              </h2>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                Listening taste analytics, audio DSP preferences &amp; visual appearance
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              void triggerHapticLight();
              onClose();
            }}
            aria-label="Close Profile and Settings"
            className="sonance-press min-w-[44px] min-h-[44px] w-11 h-11 rounded-full border flex items-center justify-center shrink-0"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-hairline)',
              color: 'var(--text-primary)',
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* 1. Profile Metrics Summary */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              className="rounded-2xl border p-4 space-y-1"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
              }}
            >
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Heart className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                <span>Liked Songs</span>
              </div>
              <p className="font-display font-mono-tabular text-2xl font-bold">{favoritesCount}</p>
            </div>

            <div
              className="rounded-2xl border p-4 space-y-1"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
              }}
            >
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Disc3 className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                <span>Total Plays</span>
              </div>
              <p className="font-display font-mono-tabular text-2xl font-bold">{totalPlays}</p>
            </div>

            <div
              className="rounded-2xl border p-4 space-y-1"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
              }}
            >
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Activity className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                <span>Offline Library</span>
              </div>
              <p className="font-display font-mono-tabular text-2xl font-bold">
                {libraryTracks.length}
              </p>
              <p className="text-[11px] font-mono-tabular" style={{ color: 'var(--text-muted)' }}>
                {downloadedCount} saved · {formatBytes(totalStorageBytes)}
              </p>
            </div>

            <div
              className="rounded-2xl border p-4 space-y-1"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
              }}
            >
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                <span>Region Profile</span>
              </div>
              <p className="font-display text-lg font-bold truncate pt-0.5">
                {geoProfile ? geoProfile.country : 'Global'}
              </p>
              <p className="text-[11px] font-mono-tabular truncate" style={{ color: 'var(--text-muted)' }}>
                {geoProfile ? `${geoProfile.city || geoProfile.region} · ${geoProfile.countryCode}` : 'Auto-detect'}
              </p>
            </div>
          </section>

          {/* 2. Listening Vibe Trends (Recharts 30-Day Mood & Genre Preference Intensity) */}
          <ListeningVibeTrends
            tasteProfile={tasteProfile}
            libraryTracks={libraryTracks}
          />

          {/* 3. Audio, Theme & Playback Settings */}
          <section
            className="rounded-3xl border p-5 sm:p-6 space-y-6"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-surface) 78%, transparent)',
              borderColor: 'var(--border-hairline)',
            }}
          >
            <div className="space-y-1">
              <h3 className="font-display text-base font-bold tracking-tight">
                Audio &amp; Visual Preferences
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Customize color atmosphere, audio visualizer, equalizer preset, and continuous streaming.
              </p>
            </div>

            {/* Theme Selector */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Palette className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                <span>Surface Theme</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {Object.values(THEMES).map((th) => {
                  const active = themeId === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => {
                        void triggerHapticLight();
                        onSelectTheme(th.id);
                      }}
                      className="sonance-press flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-medium"
                      style={{
                        backgroundColor: active ? 'var(--bg-elevated)' : 'var(--bg-canvas)',
                        borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full border shrink-0"
                          style={{
                            backgroundColor: th.accent,
                            borderColor: 'rgba(255,255,255,0.25)',
                          }}
                        />
                        <span className="truncate">{th.name}</span>
                      </span>
                      {active && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visualizer & EQ Presets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Activity className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                  <span>Visualizer Style</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {VIS_MODES.map((m) => {
                    const active = visualizerMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          void triggerHapticLight();
                          onChangeVisualizerMode(m.id);
                        }}
                        className="sonance-press min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-medium whitespace-nowrap"
                        style={{
                          backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                          borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                          color: active ? 'var(--accent-contrast)' : 'var(--text-primary)',
                        }}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <Sliders className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                  <span>Equalizer Preset</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(EQ_PRESETS) as EQPresetId[]).map((key) => {
                    const active = eqPreset === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          void triggerHapticLight();
                          onApplyEQPreset(key);
                        }}
                        className="sonance-press min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-medium whitespace-nowrap"
                        style={{
                          backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                          borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                          color: active ? 'var(--accent-contrast)' : 'var(--text-primary)',
                        }}
                      >
                        {EQ_PRESETS[key].label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Behavior Toggles & Taste Reset */}
            <div
              className="pt-4 border-t flex flex-wrap items-center justify-between gap-3"
              style={{ borderColor: 'var(--border-hairline)' }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void triggerHapticLight();
                    onToggleInfiniteQueue();
                  }}
                  aria-pressed={infiniteQueueEnabled}
                  className="sonance-press inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl border text-xs font-medium whitespace-nowrap"
                  style={{
                    backgroundColor: infiniteQueueEnabled ? 'var(--bg-elevated)' : 'var(--bg-canvas)',
                    borderColor: infiniteQueueEnabled
                      ? 'var(--accent-primary)'
                      : 'var(--border-hairline)',
                    color: infiniteQueueEnabled ? 'var(--accent-primary)' : 'var(--text-primary)',
                  }}
                >
                  <InfinityIcon className="w-3.5 h-3.5" />
                  <span>Infinite Queue: {infiniteQueueEnabled ? 'On' : 'Off'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void triggerHapticLight();
                    onTogglePartyMode();
                  }}
                  aria-pressed={partyMode}
                  className="sonance-press inline-flex items-center gap-2 min-h-[40px] px-3.5 rounded-xl border text-xs font-medium whitespace-nowrap"
                  style={{
                    backgroundColor: partyMode ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                    borderColor: partyMode ? 'var(--accent-primary)' : 'var(--border-hairline)',
                    color: partyMode ? 'var(--accent-contrast)' : 'var(--text-primary)',
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Party Lighting: {partyMode ? 'On' : 'Off'}</span>
                </button>

                {partyMode && (
                  <div
                    className="inline-flex items-center p-1 rounded-xl border"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      borderColor: 'var(--border-hairline)',
                    }}
                  >
                    {(['subtle', 'club', 'dynamic'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => onChangePartyIntensity(lvl)}
                        className="px-2.5 py-1 rounded-lg text-xs capitalize font-medium"
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
                )}
              </div>

              {confirmReset ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      void triggerHapticMedium();
                      onResetTasteProfile();
                      setConfirmReset(false);
                    }}
                    className="sonance-press min-h-[40px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap"
                    style={{
                      backgroundColor: '#EF4444',
                      color: '#FFFFFF',
                    }}
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="sonance-press min-h-[40px] px-3 rounded-xl border text-xs font-medium whitespace-nowrap"
                    style={{
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    void triggerHapticLight();
                    setConfirmReset(true);
                  }}
                  className="sonance-press inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border text-xs font-medium whitespace-nowrap hover:opacity-80"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Taste History</span>
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
