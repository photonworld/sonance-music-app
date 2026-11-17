import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Globe, Pause, Play, Radio, RefreshCw } from 'lucide-react';
import { RadioStation, Track } from '../types/audio';
import { triggerHapticLight } from '../utils/haptics';
import { radioToTrack } from './DiscoverGlobal';
import { RadioCardSkeleton } from './SkeletonLoaders';

interface WorldRadioMapProps {
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlayStation: (track: Track, contextStations?: Track[]) => void;
  onStationsLoaded?: (stations: Track[]) => void;
}

type RadioPresetId = 'world' | 'bengali' | 'bollywood' | 'lofi' | 'pop' | 'news' | 'hub';

const RADIO_QUICK_FILTERS: Array<{ id: Exclude<RadioPresetId, 'hub'>; label: string }> = [
  { id: 'bengali', label: 'Bengali Hits' },
  { id: 'bollywood', label: 'Bollywood / Hindi' },
  { id: 'lofi', label: 'Lo-Fi 24/7' },
  { id: 'pop', label: 'Global Pop' },
  { id: 'news', label: 'News & Talk' },
  { id: 'world', label: 'World Top' },
];

const WORLD_HUBS = [
  { code: '', label: 'All Regions' },
  { code: 'BD', label: 'Dhaka / BD' },
  { code: 'IN', label: 'Mumbai / IN' },
  { code: 'GB', label: 'London / UK' },
  { code: 'US', label: 'New York / US' },
  { code: 'JP', label: 'Tokyo / JP' },
  { code: 'DE', label: 'Berlin / DE' },
  { code: 'NG', label: 'Lagos / NG' },
  { code: 'BR', label: 'São Paulo / BR' },
  { code: 'KR', label: 'Seoul / KR' },
  { code: 'FR', label: 'Paris / FR' },
];

function projectLatLng(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return {
    x: Math.max(16, Math.min(984, x)),
    y: Math.max(16, Math.min(484, y)),
  };
}

export const WorldRadioMap: React.FC<WorldRadioMapProps> = ({
  currentTrackId,
  isPlaying,
  onPlayStation,
  onStationsLoaded,
}) => {
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [activePreset, setActivePreset] = useState<RadioPresetId>('world');
  const [selectedHub, setSelectedHub] = useState('');
  const [selectedStation, setSelectedStation] = useState<RadioStation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onStationsLoadedRef = React.useRef(onStationsLoaded);
  onStationsLoadedRef.current = onStationsLoaded;

  const loadStations = useCallback(async (preset: RadioPresetId, countryCode: string) => {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/radio/stations?mode=worldmap&limit=36`;
      if (preset !== 'world' && preset !== 'hub') {
        url = `/api/radio/stations?preset=${encodeURIComponent(preset)}&limit=36`;
      } else if (countryCode) {
        url = `/api/radio/stations?countrycode=${encodeURIComponent(countryCode)}&limit=36`;
      }

      const res = await fetch(url);
      const data = (await res.json()) as { stations?: RadioStation[]; error?: string };
      const list = data.stations ?? [];
      setStations(list);
      if (list.length > 0) {
        setSelectedStation(list[0]);
        onStationsLoadedRef.current?.(list.map(radioToTrack));
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load global radio map.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStations(activePreset, selectedHub);
  }, [activePreset, loadStations, selectedHub]);

  const stationTracks = useMemo(() => stations.map(radioToTrack), [stations]);

  const mappedPins = useMemo(() => {
    return stations
      .filter((s) => typeof s.geoLat === 'number' && typeof s.geoLong === 'number')
      .map((s) => ({
        station: s,
        ...projectLatLng(s.geoLat as number, s.geoLong as number),
      }));
  }, [stations]);

  return (
    <div className="space-y-6">
      {/* Header + Hub Switcher */}
      <section
        className="sonance-glass rounded-3xl border p-5 sm:p-6 space-y-4 shadow-xs"
        style={{
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">World Radio Map</h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Click any station pin across the globe to stream live international broadcasts with
              real-time audio analysis.
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => void loadStations(activePreset, selectedHub)}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 self-start sm:self-auto"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-hairline)',
              color: 'var(--text-primary)',
            }}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              style={{ color: 'var(--accent-primary)' }}
            />
            <span>{loading ? 'Refreshing...' : 'Refresh Stations'}</span>
          </button>
        </div>

        {/* Highlight Live Regional & Hit Radio Quick-Filter Pills */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {RADIO_QUICK_FILTERS.map((filter) => {
              const active = activePreset === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => {
                    void triggerHapticLight();
                    setSelectedHub('');
                    setActivePreset(filter.id);
                  }}
                  aria-pressed={active}
                  className="sonance-press min-h-[38px] px-4 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-all"
                  style={{
                    backgroundColor: active
                      ? 'var(--accent-primary)'
                      : 'color-mix(in srgb, var(--bg-elevated) 78%, transparent)',
                    borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                    color: active ? 'var(--accent-contrast)' : 'var(--text-primary)',
                  }}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          {/* Regional City Chips */}
          <div className="flex flex-wrap gap-1.5">
            {WORLD_HUBS.map((hub) => {
              const active =
                (hub.code === '' && activePreset === 'world' && selectedHub === '') ||
                (hub.code !== '' && selectedHub === hub.code && activePreset === 'hub');
              return (
                <button
                  key={hub.code || 'all'}
                  type="button"
                  onClick={() => {
                    void triggerHapticLight();
                    if (hub.code === '') {
                      setSelectedHub('');
                      setActivePreset('world');
                    } else {
                      setSelectedHub(hub.code);
                      setActivePreset('hub');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                    borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                    color: active ? 'var(--accent-contrast)' : 'var(--text-primary)',
                  }}
                >
                  {hub.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Equirectangular World Map */}
        <div
          className="relative w-full overflow-hidden rounded-xl border"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            borderColor: 'var(--border-hairline)',
          }}
        >
          <svg
            viewBox="0 0 1000 500"
            className="w-full h-auto block"
            role="img"
            aria-label="Interactive global radio station map"
          >
            {/* Latitude / Longitude Hairline Grid */}
            <g stroke="var(--border-hairline)" strokeWidth="0.6" strokeDasharray="3 4">
              <line x1="0" y1="125" x2="1000" y2="125" />
              <line x1="0" y1="250" x2="1000" y2="250" />
              <line x1="0" y1="375" x2="1000" y2="375" />
              <line x1="250" y1="0" x2="250" y2="500" />
              <line x1="500" y1="0" x2="500" y2="500" />
              <line x1="750" y1="0" x2="750" y2="500" />
            </g>

            {/* Minimalist Stylized Continents */}
            <g fill="var(--bg-elevated)" stroke="var(--border-hairline)" strokeWidth="1.2">
              {/* North America */}
              <path d="M90,72 L248,58 L330,96 L310,156 L265,186 L245,232 L212,248 L195,220 L152,195 L122,140 L72,110 Z" />
              {/* Greenland */}
              <path d="M335,34 L412,32 L396,86 L342,84 Z" />
              {/* South America */}
              <path d="M248,262 L322,268 L372,315 L344,390 L300,456 L276,450 L270,382 L240,318 Z" />
              {/* Europe */}
              <path d="M446,84 L548,74 L582,116 L548,162 L496,172 L456,158 L442,126 Z" />
              {/* Africa */}
              <path d="M454,186 L544,180 L602,232 L584,320 L542,402 L498,396 L484,322 L438,256 Z" />
              {/* Asia */}
              <path d="M565,78 L785,68 L882,108 L852,188 L792,238 L735,248 L688,266 L645,226 L595,212 L566,158 Z" />
              {/* Japan */}
              <path d="M862,140 L884,126 L888,164 L864,174 Z" />
              {/* Southeast Asia Islands */}
              <path d="M748,268 L802,268 L818,296 L762,300 Z" />
              {/* Australia */}
              <path d="M768,336 L868,334 L886,396 L836,426 L772,404 Z" />
            </g>

            {/* Live Radio Station Pins */}
            {mappedPins.map(({ station, x, y }) => {
              const trackId = `radio-${station.stationuuid}`;
              const isCurrent = currentTrackId === trackId;
              const isSelected = selectedStation?.stationuuid === station.stationuuid;
              return (
                <g
                  key={station.stationuuid}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedStation(station);
                    onPlayStation(radioToTrack(station), stationTracks);
                  }}
                >
                  {(isCurrent || isSelected) && (
                    <circle
                      cx={x}
                      cy={y}
                      r={isCurrent ? 14 : 11}
                      fill="var(--accent-primary)"
                      opacity={0.24}
                    />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={isCurrent || isSelected ? 6 : 4.2}
                    fill={isCurrent || isSelected ? 'var(--accent-primary)' : 'var(--vis-secondary)'}
                    stroke="var(--bg-surface)"
                    strokeWidth="1.5"
                  />
                  <title>{`${station.name} — ${station.country} (${station.bitrate} kbps)`}</title>
                </g>
              );
            })}
          </svg>

          {/* Selected Station Inspection Bar */}
          {selectedStation && (
            <div
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Radio className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{selectedStation.name}</p>
                  <p
                    className="text-xs font-mono-tabular truncate"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {selectedStation.country} · {selectedStation.codec} ·{' '}
                    {selectedStation.bitrate} kbps
                    {selectedStation.tags.length > 0
                      ? ` · ${selectedStation.tags.slice(0, 2).join(', ')}`
                      : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onPlayStation(radioToTrack(selectedStation), stationTracks)}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                {currentTrackId === `radio-${selectedStation.stationuuid}` && isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Playing Live</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Tune In Live</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs" style={{ color: 'var(--accent-primary)' }}>
            {error}
          </p>
        )}
      </section>

      {/* Station Directory Grid */}
      {loading && stations.length === 0 ? (
        <RadioCardSkeleton count={6} />
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stations.map((station) => {
            const track = radioToTrack(station);
            const isCurrent = track.id === currentTrackId;
            return (
              <button
                key={station.stationuuid}
                type="button"
                onClick={() => {
                  void triggerHapticLight();
                  setSelectedStation(station);
                  onPlayStation(track, stationTracks);
                }}
                className="sonance-press sonance-glass flex items-center justify-between gap-3 p-3.5 rounded-2xl border text-left hover:opacity-90"
                style={{
                  borderColor: isCurrent ? 'var(--accent-primary)' : 'var(--border-hairline)',
                }}
              >
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{
                      color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                    }}
                  >
                    {station.name}
                  </p>
                  <p
                    className="text-xs font-mono-tabular truncate mt-0.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {station.country} · {station.codec} · {station.bitrate} kbps
                  </p>
                </div>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: isCurrent ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                    color: isCurrent ? 'var(--accent-contrast)' : 'var(--text-primary)',
                  }}
                >
                  {isCurrent && isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </div>
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
};
