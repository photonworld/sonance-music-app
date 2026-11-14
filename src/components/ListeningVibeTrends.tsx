import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
import { TasteProfile, Track } from '../types/audio';
import { triggerHapticLight } from '../utils/haptics';
import { buildListeningVibeTrends, VibeSeriesMeta } from '../utils/vibeTrends';

interface ListeningVibeTrendsProps {
  tasteProfile: TasteProfile;
  libraryTracks: Track[];
}

type TrendDimension = 'moods' | 'genres';

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  payload?: {
    fullDate?: string;
    activityCount?: number;
  };
}

const VibeTooltip: React.FC<{
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;

  const first = payload[0]?.payload;
  const sorted = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div
      className="rounded-2xl border px-3.5 py-2.5 shadow-xl backdrop-blur-xl text-xs space-y-1.5 min-w-[175px]"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-surface) 92%, transparent)',
        borderColor: 'var(--border-hairline)',
        color: 'var(--text-primary)',
      }}
    >
      <div
        className="flex items-center justify-between gap-3 pb-1 border-b"
        style={{ borderColor: 'var(--border-hairline)' }}
      >
        <span className="font-semibold">{first?.fullDate}</span>
        {typeof first?.activityCount === 'number' && first.activityCount > 0 && (
          <span className="font-mono-tabular text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {first.activityCount} {first.activityCount === 1 ? 'event' : 'events'}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {sorted.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 truncate">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="font-mono-tabular font-semibold">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ListeningVibeTrends: React.FC<ListeningVibeTrendsProps> = ({
  tasteProfile,
  libraryTracks,
}) => {
  const [dimension, setDimension] = useState<TrendDimension>('moods');
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});

  const trends = useMemo(
    () => buildListeningVibeTrends(tasteProfile, libraryTracks),
    [tasteProfile, libraryTracks]
  );

  const activeData = dimension === 'moods' ? trends.moodPoints : trends.genrePoints;
  const activeSeries: VibeSeriesMeta[] =
    dimension === 'moods' ? trends.moodSeries : trends.genreSeries;

  const visibleSeries = useMemo(() => {
    const filtered = activeSeries.filter((s) => !hiddenSeries[`${dimension}:${s.key}`]);
    return filtered.length > 0 ? filtered : activeSeries;
  }, [activeSeries, dimension, hiddenSeries]);

  const toggleSeries = (key: string) => {
    void triggerHapticLight();
    const composite = `${dimension}:${key}`;
    setHiddenSeries((prev) => {
      const next = { ...prev, [composite]: !prev[composite] };
      // Prevent hiding every single line at once
      const remaining = activeSeries.filter((s) => !next[`${dimension}:${s.key}`]);
      if (remaining.length === 0) return prev;
      return next;
    });
  };

  return (
    <section
      className="rounded-3xl border p-5 sm:p-6 space-y-5"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg-surface) 78%, transparent)',
        borderColor: 'var(--border-hairline)',
      }}
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
            <h3 className="font-display text-lg font-bold tracking-tight">
              Listening Vibe Trends
            </h3>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            30-day mood &amp; genre preference intensity ·{' '}
            {trends.summary.hasLiveHistory
              ? 'Synced with your live plays, loves & skips'
              : 'Baseline seeded from your saved library & likes'}
          </p>
        </div>

        {/* Dimension Segmented Switcher */}
        <div
          role="tablist"
          aria-label="Vibe trends dimension"
          className="inline-flex items-center p-1 rounded-xl border self-start sm:self-auto shrink-0"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: 'var(--border-hairline)',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={dimension === 'moods'}
            onClick={() => {
              void triggerHapticLight();
              setDimension('moods');
            }}
            className="sonance-press min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
            style={{
              backgroundColor: dimension === 'moods' ? 'var(--bg-surface)' : 'transparent',
              color: dimension === 'moods' ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            Mood Intensity
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dimension === 'genres'}
            onClick={() => {
              void triggerHapticLight();
              setDimension('genres');
            }}
            className="sonance-press min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
            style={{
              backgroundColor: dimension === 'genres' ? 'var(--bg-surface)' : 'transparent',
              color: dimension === 'genres' ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            Genre Intensity
          </button>
        </div>
      </div>

      {/* Interactive Series Filter & Intensity Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {activeSeries.map((s) => {
          const isHidden = Boolean(hiddenSeries[`${dimension}:${s.key}`]);
          const isPositive = s.deltaPercent >= 0;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleSeries(s.key)}
              aria-pressed={!isHidden}
              className="sonance-press rounded-2xl border px-3.5 py-2.5 text-left transition-opacity"
              style={{
                backgroundColor: isHidden
                  ? 'transparent'
                  : 'color-mix(in srgb, var(--bg-canvas) 75%, transparent)',
                borderColor: isHidden ? 'var(--border-hairline)' : s.color,
                opacity: isHidden ? 0.45 : 1,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-xs font-semibold truncate">{s.label}</span>
                </span>
                <span
                  className="inline-flex items-center gap-0.5 font-mono-tabular text-[11px] shrink-0"
                  style={{ color: isPositive ? '#10B981' : 'var(--text-muted)' }}
                >
                  {isPositive ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>
                    {isPositive ? `+${s.deltaPercent}%` : `${s.deltaPercent}%`}
                  </span>
                </span>
              </div>
              <div
                className="mt-1 flex items-baseline justify-between font-mono-tabular text-[11px]"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>Avg {s.averageIntensity}%</span>
                <span>Peak {s.peakIntensity}%</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Recharts 30-Day Area Visualization */}
      <div className="w-full h-[270px] sm:h-[300px] pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={activeData}
            margin={{ top: 10, right: 10, left: -20, bottom: 2 }}
          >
            <defs>
              {activeSeries.map((s) => {
                const safeId = `vibe-grad-${dimension}-${s.key.replace(/[^a-zA-Z0-9]/g, '')}`;
                return (
                  <linearGradient key={safeId} id={safeId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.34} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                  </linearGradient>
                );
              })}
            </defs>

            <CartesianGrid
              strokeDasharray="3 4"
              vertical={false}
              stroke="var(--border-hairline)"
            />

            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={26}
              tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            />

            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            />

            <Tooltip
              content={<VibeTooltip />}
              cursor={{
                stroke: 'var(--accent-primary)',
                strokeWidth: 1,
                strokeDasharray: '4 4',
              }}
            />

            {visibleSeries.map((s) => {
              const safeId = `vibe-grad-${dimension}-${s.key.replace(/[^a-zA-Z0-9]/g, '')}`;
              return (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2.2}
                  fillOpacity={1}
                  fill={`url(#${safeId})`}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--bg-surface)' }}
                  animationDuration={550}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Quantitative Summary Strip */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t text-xs"
        style={{ borderColor: 'var(--border-hairline)' }}
      >
        <div>
          <p style={{ color: 'var(--text-muted)' }}>Peak 30-Day Mood</p>
          <p className="font-semibold mt-0.5 truncate">{trends.summary.peakMood}</p>
        </div>
        <div>
          <p style={{ color: 'var(--text-muted)' }}>Top Affinity Genre</p>
          <p className="font-semibold mt-0.5 truncate">{trends.summary.topGenre}</p>
        </div>
        <div>
          <p style={{ color: 'var(--text-muted)' }}>Average Tempo</p>
          <p className="font-mono-tabular font-semibold mt-0.5">
            {trends.summary.avgBpm ? `${trends.summary.avgBpm} BPM` : 'Adaptive'}
          </p>
        </div>
        <div>
          <p style={{ color: 'var(--text-muted)' }}>Logged Signals</p>
          <p className="font-mono-tabular font-semibold mt-0.5">
            {trends.summary.totalInteractions}
          </p>
        </div>
      </div>
    </section>
  );
};
