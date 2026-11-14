import React from 'react';
import { Sliders, X } from 'lucide-react';
import { EQ_PRESETS } from '../hooks/useAudioEngine';
import { EQBand, EQPresetId } from '../types/audio';

interface EqualizerPopoverProps {
  eqPreset: EQPresetId;
  eqBands: EQBand[];
  playbackRate: number;
  onApplyPreset: (preset: EQPresetId) => void;
  onChangeBand: (index: number, gain: number) => void;
  onChangePlaybackRate: (rate: number) => void;
  onClose: () => void;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5];

export const EqualizerPopover: React.FC<EqualizerPopoverProps> = ({
  eqPreset,
  eqBands,
  playbackRate,
  onApplyPreset,
  onChangeBand,
  onChangePlaybackRate,
  onClose,
}) => {
  return (
    <div
      className="w-80 sm:w-96 rounded-2xl border p-4 shadow-2xl"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-hairline)',
        color: 'var(--text-primary)',
      }}
    >
      <div
        className="flex items-center justify-between pb-3 border-b"
        style={{ borderColor: 'var(--border-hairline)' }}
      >
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          <h3 className="text-sm font-semibold">5-Band Equalizer & Speed</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close equalizer"
          className="p-1.5 rounded-lg hover:opacity-75"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Presets */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(Object.keys(EQ_PRESETS) as EQPresetId[]).map((presetKey) => {
          const active = eqPreset === presetKey;
          return (
            <button
              key={presetKey}
              type="button"
              onClick={() => onApplyPreset(presetKey)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border whitespace-nowrap shrink-0 transition-colors"
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

      {/* 5-band sliders */}
      <div className="mt-4 grid grid-cols-5 gap-2 pt-2">
        {eqBands.map((band, index) => (
          <div key={band.frequency} className="flex flex-col items-center gap-2">
            <span className="font-mono-tabular text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {band.gain > 0 ? `+${band.gain.toFixed(1)}` : band.gain.toFixed(1)}
            </span>
            <input
              type="range"
              min={-12}
              max={12}
              step={0.5}
              value={band.gain}
              onChange={(e) => onChangeBand(index, parseFloat(e.target.value))}
              aria-label={`${band.label} EQ gain`}
              className="sonance-slider h-24 w-4 [writing-mode:vertical-lr] [direction:rtl]"
              style={{ accentColor: 'var(--accent-primary)' }}
            />
            <span className="font-mono-tabular text-[11px] font-medium">{band.label}</span>
          </div>
        ))}
      </div>

      {/* Playback Speed */}
      <div
        className="mt-4 pt-3 border-t flex items-center justify-between gap-2"
        style={{ borderColor: 'var(--border-hairline)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Playback Speed
        </span>
        <div className="flex items-center gap-1">
          {SPEED_OPTIONS.map((rate) => {
            const active = playbackRate === rate;
            return (
              <button
                key={rate}
                type="button"
                onClick={() => onChangePlaybackRate(rate)}
                className="px-2 py-1 rounded-md text-xs font-mono-tabular font-medium transition-colors"
                style={{
                  backgroundColor: active ? 'var(--bg-elevated)' : 'transparent',
                  color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
                }}
              >
                {rate}x
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
