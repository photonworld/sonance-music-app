import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Heart,
  Music,
  Pause,
  Play,
  RefreshCw,
  Shuffle,
  Sparkles,
  ThumbsDown,
} from 'lucide-react';
import { MoodCategory, StreamSeedContext, TasteProfile, Track } from '../types/audio';
import {
  detectCurrentMood,
  fetchBecauseYouLoved,
  fetchMoodRecommendations,
  MOOD_CATEGORIES,
  MOOD_CONFIGS,
} from '../utils/aiRecommender';
import { formatDuration } from '../utils/audioMetadata';
import { triggerHapticLight, triggerHapticMedium } from '../utils/haptics';
import { DownloadButton } from './DownloadButton';
import { MoodCardSkeleton } from './SkeletonLoaders';

interface ForYouSectionProps {
  tasteProfile: TasteProfile;
  libraryTracks: Track[];
  regionCountry?: string;
  currentTrackId: string | null;
  isPlaying: boolean;
  lovedIds: Set<string>;
  dislikedIds: Set<string>;
  downloadedSourceIds: Set<string>;
  downloadProgressMap: Record<string, number>;
  onPlayTrack: (
    track: Track,
    contextTracks?: Track[],
    seed?: StreamSeedContext
  ) => void;
  onPlayQueue: (
    tracks: Track[],
    enableShuffle: boolean,
    seed?: StreamSeedContext
  ) => void;
  onToggleLove: (track: Track) => void;
  onDislikeAndSkip: (track: Track) => void;
  onDownloadTrack: (track: Track) => void;
}

export const ForYouSection: React.FC<ForYouSectionProps> = ({
  tasteProfile,
  libraryTracks,
  regionCountry,
  currentTrackId,
  isPlaying,
  lovedIds,
  dislikedIds,
  downloadedSourceIds,
  downloadProgressMap,
  onPlayTrack,
  onPlayQueue,
  onToggleLove,
  onDislikeAndSkip,
  onDownloadTrack,
}) => {
  const [selectedMood, setSelectedMood] = useState<MoodCategory | 'Auto'>('Auto');
  const [moodTracks, setMoodTracks] = useState<Track[]>([]);
  const [seedTracks, setSeedTracks] = useState<Track[]>([]);
  const [moodOffset, setMoodOffset] = useState(0);
  const [loadingMood, setLoadingMood] = useState(false);
  const [loadingMoreMood, setLoadingMoreMood] = useState(false);
  const [loadingSeed, setLoadingSeed] = useState(false);

  const detection = useMemo(
    () => detectCurrentMood(tasteProfile, libraryTracks),
    [libraryTracks, tasteProfile]
  );

  const activeMood: MoodCategory =
    selectedMood === 'Auto' ? detection.detectedMood : selectedMood;

  const lovedCount = Object.keys(tasteProfile.lovedTracks).length + libraryTracks.filter((t) => t.liked).length;
  const seedKey = detection.seedTrack?.id ?? 'none';

  const loadMoodMix = useCallback(async () => {
    setLoadingMood(true);
    setMoodOffset(0);
    try {
      const items = await fetchMoodRecommendations(activeMood, tasteProfile, regionCountry, 0);
      setMoodTracks(items);
      setMoodOffset(12);
    } finally {
      setLoadingMood(false);
    }
  }, [activeMood, regionCountry, tasteProfile]);

  const handleLoadMoreMood = useCallback(async () => {
    if (loadingMood || loadingMoreMood) return;
    setLoadingMoreMood(true);
    try {
      const items = await fetchMoodRecommendations(
        activeMood,
        tasteProfile,
        regionCountry,
        moodOffset
      );
      setMoodTracks((prev) => {
        const seen = new Set(prev.map((t) => t.id));
        return [...prev, ...items.filter((t) => !seen.has(t.id))];
      });
      setMoodOffset((o) => o + 12);
    } finally {
      setLoadingMoreMood(false);
    }
  }, [activeMood, loadingMood, loadingMoreMood, moodOffset, regionCountry, tasteProfile]);

  const loadSeedMix = useCallback(async () => {
    if (!detection.seedTrack) {
      setSeedTracks([]);
      return;
    }
    setLoadingSeed(true);
    try {
      const items = await fetchBecauseYouLoved(detection.seedTrack, tasteProfile);
      setSeedTracks(items);
    } finally {
      setLoadingSeed(false);
    }
  }, [detection.seedTrack, tasteProfile]);

  // Auto-refresh whenever mood changes or user loves more songs
  useEffect(() => {
    void loadMoodMix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMood, lovedCount]);

  useEffect(() => {
    void loadSeedMix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey, lovedCount]);

  const visibleMoodTracks = moodTracks.filter((t) => !dislikedIds.has(t.id));
  const visibleSeedTracks = seedTracks.filter((t) => !dislikedIds.has(t.id));

  const activeMoodSeed: StreamSeedContext = {
    query: MOOD_CONFIGS[activeMood].queries[0],
    mood: activeMood,
    mode: 'search',
    offset: moodOffset,
  };

  const renderTrackCard = (track: Track, listContext: Track[], seedCtx: StreamSeedContext) => {
    const isCurrent = track.id === currentTrackId;
    const isLoved = lovedIds.has(track.id);
    const isSavedOffline =
      downloadedSourceIds.has(track.id) || Boolean(track.isDownloaded);
    const progress = downloadProgressMap[track.id];
    const sourceLabel = track.sourceType === 'jamendo' ? 'Jamendo' : 'Audius';

    return (
      <div
        key={track.id}
        className="group flex flex-col justify-between gap-3 rounded-2xl border p-3.5 transition-all duration-150"
        style={{
          backgroundColor: isCurrent
            ? 'color-mix(in srgb, var(--bg-elevated) 82%, transparent)'
            : 'color-mix(in srgb, var(--bg-surface) 74%, transparent)',
          borderColor: isCurrent ? 'var(--accent-primary)' : 'var(--border-hairline)',
        }}
      >
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              void triggerHapticLight();
              onPlayTrack(track, listContext, seedCtx);
            }}
            aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
            className="sonance-press relative w-12 h-12 rounded-xl overflow-hidden border shrink-0 flex items-center justify-center"
            style={{
              backgroundColor: 'var(--bg-canvas)',
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
            <span
              className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
              style={{
                backgroundColor: isCurrent ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.32)',
              }}
            >
              {isCurrent && isPlaying ? (
                <Pause className="w-4 h-4 text-white fill-current" />
              ) : (
                <Play className="w-4 h-4 text-white fill-current ml-0.5" />
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onPlayTrack(track, listContext, seedCtx)}
            className="flex-1 min-w-0 text-left"
          >
            <p
              className="text-sm font-semibold truncate"
              style={{ color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)' }}
            >
              {track.title}
            </p>
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {track.artist}
            </p>
            <p
              className="text-[11px] font-mono-tabular truncate mt-1"
              style={{ color: 'var(--text-muted)' }}
            >
              {track.genre} · {formatDuration(track.duration)} · {sourceLabel}
            </p>
          </button>
        </div>

        {/* Reaction & Offline Download Bar */}
        <div
          className="flex items-center justify-between gap-2 pt-2 border-t"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                void triggerHapticMedium();
                onToggleLove(track);
              }}
              aria-label={isLoved ? `Remove ${track.title} from Liked Songs` : `Love ${track.title}`}
              className="sonance-press min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl border"
              style={{
                borderColor: isLoved ? 'var(--accent-primary)' : 'var(--border-hairline)',
                color: isLoved ? 'var(--accent-primary)' : 'var(--text-muted)',
                backgroundColor: isLoved ? 'var(--bg-elevated)' : 'transparent',
              }}
            >
              <Heart
                className={`w-3.5 h-3.5 transition-transform ${
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
              aria-label={`Dislike and skip ${track.title}`}
              title="Not for me"
              className="sonance-press min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl border hover:opacity-80"
              style={{
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-muted)',
              }}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <DownloadButton
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
  };

  return (
    <section
      className="sonance-glass rounded-3xl border p-5 sm:p-6 space-y-6 shadow-xs"
      style={{
        borderColor: 'var(--border-hairline)',
      }}
    >
      {/* Header + Detected Mood Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div
            className="flex items-center gap-2 text-xs font-mono-tabular"
            style={{ color: 'var(--accent-primary)' }}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>
              Detected Mood: {detection.detectedMood} · {detection.reason}
            </span>
          </div>
          <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight">
            For You · AI Picks
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {MOOD_CONFIGS[activeMood].description}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {visibleMoodTracks.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => onPlayQueue(visibleMoodTracks, false, activeMoodSeed)}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap"
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
                onClick={() => onPlayQueue(visibleMoodTracks, true, activeMoodSeed)}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border text-xs font-semibold whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--bg-canvas)',
                  borderColor: 'var(--border-hairline)',
                  color: 'var(--text-primary)',
                }}
              >
                <Shuffle className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                <span>Shuffle</span>
              </button>
            </>
          )}
          <button
            type="button"
            disabled={loadingMood}
            onClick={() => void loadMoodMix()}
            aria-label="Refresh AI Picks"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--bg-canvas)',
              borderColor: 'var(--border-hairline)',
              color: 'var(--text-primary)',
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingMood ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick Mood Selector Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSelectedMood('Auto')}
          className="px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors"
          style={{
            backgroundColor: selectedMood === 'Auto' ? 'var(--accent-primary)' : 'var(--bg-canvas)',
            borderColor: selectedMood === 'Auto' ? 'var(--accent-primary)' : 'var(--border-hairline)',
            color: selectedMood === 'Auto' ? 'var(--accent-contrast)' : 'var(--text-primary)',
          }}
        >
          Auto ({detection.detectedMood})
        </button>

        {MOOD_CATEGORIES.map((mood) => {
          const active = selectedMood === mood;
          return (
            <button
              key={mood}
              type="button"
              onClick={() => setSelectedMood(mood)}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors"
              style={{
                backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-canvas)',
                borderColor: active ? 'var(--accent-primary)' : 'var(--border-hairline)',
                color: active ? 'var(--accent-contrast)' : 'var(--text-primary)',
              }}
            >
              {mood}
            </button>
          );
        })}
      </div>

      {/* Auto-Curated Mood Mix Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight">
            {selectedMood === 'Auto'
              ? `Detected Mood: ${detection.detectedMood}`
              : `${selectedMood} Mix`}
          </h3>
          <div className="flex items-center gap-3">
            <span className="font-mono-tabular text-xs" style={{ color: 'var(--text-muted)' }}>
              {visibleMoodTracks.length} tracks
            </span>
            {visibleMoodTracks.length > 0 && (
              <button
                type="button"
                disabled={loadingMoreMood}
                onClick={() => void handleLoadMoreMood()}
                className="text-xs font-medium hover:underline disabled:opacity-50 whitespace-nowrap"
                style={{ color: 'var(--accent-primary)' }}
              >
                {loadingMoreMood ? 'Loading...' : 'Load more'}
              </button>
            )}
          </div>
        </div>

        {loadingMood && visibleMoodTracks.length === 0 ? (
          <MoodCardSkeleton count={3} />
        ) : visibleMoodTracks.length === 0 ? (
          <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
            Connect to the internet to fetch fresh AI mood recommendations, or play your offline tracks below.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleMoodTracks.slice(0, 6).map((t) =>
              renderTrackCard(t, visibleMoodTracks, activeMoodSeed)
            )}
          </div>
        )}
      </div>

      {/* Because You Loved [Track / Artist] Personalized Carousel */}
      {detection.seedTrack && (
        <div
          className="pt-5 border-t space-y-3"
          style={{ borderColor: 'var(--border-hairline)' }}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold tracking-tight truncate">
              Because You Loved{' '}
              <span style={{ color: 'var(--accent-primary)' }}>
                {detection.seedTrack.artist !== 'Sonance Studio' &&
                detection.seedTrack.artist !== 'Local Library'
                  ? detection.seedTrack.artist
                  : detection.seedTrack.title}
              </span>
            </h3>
            {visibleSeedTracks.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onPlayQueue(visibleSeedTracks, false, {
                    query: detection.seedTrack?.genre || detection.seedTrack?.artist,
                    mood: activeMood,
                    offset: 12,
                  })
                }
                className="text-xs font-medium hover:underline shrink-0"
                style={{ color: 'var(--accent-primary)' }}
              >
                Play all
              </button>
            )}
          </div>

          {loadingSeed && visibleSeedTracks.length === 0 ? (
            <MoodCardSkeleton count={3} />
          ) : visibleSeedTracks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleSeedTracks.slice(0, 3).map((t) =>
                renderTrackCard(t, visibleSeedTracks, {
                  query: detection.seedTrack?.genre || detection.seedTrack?.artist,
                  mood: activeMood,
                  offset: 12,
                })
              )}
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Love more songs to sharpen personalized artist and genre matches.
            </p>
          )}
        </div>
      )}
    </section>
  );
};
