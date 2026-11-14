import React, { useState } from 'react';
import {
  Check,
  Heart,
  ListPlus,
  Music,
  Pause,
  Play,
  RefreshCw,
  Search,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { Playlist, Track } from '../types/audio';
import { formatDuration } from '../utils/audioMetadata';
import { triggerHapticLight, triggerHapticMedium } from '../utils/haptics';
import { DownloadButton } from './DownloadButton';

export type FormatFilter = 'all' | 'lossless' | 'compressed';

interface TrackListProps {
  heading: string;
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  playlists: Playlist[];
  isPlaylistView: boolean;
  activePlaylistId?: string;
  downloadedSourceIds?: Set<string>;
  downloadProgressMap?: Record<string, number>;
  onPlayTrack: (trackId: string) => void;
  onPlayAll: (trackIds: string[]) => void;
  onShuffleAll: (trackIds: string[]) => void;
  onToggleLike: (trackId: string) => void;
  onToggleTrackInPlaylist: (playlistId: string, trackId: string) => void;
  onDeleteTrack: (trackId: string) => void;
  onRemoveFromPlaylist: (playlistId: string, trackId: string) => void;
  onDownloadTrack?: (track: Track) => void;
  onTriggerImport: () => void;
  onScanDevice: () => void;
  isScanning: boolean;
}

const LOSSLESS_FORMATS = new Set(['FLAC', 'WAV', 'AIFF']);

export const TrackList: React.FC<TrackListProps> = ({
  heading,
  tracks,
  currentTrackId,
  isPlaying,
  playlists,
  isPlaylistView,
  activePlaylistId,
  downloadedSourceIds,
  downloadProgressMap,
  onPlayTrack,
  onPlayAll,
  onShuffleAll,
  onToggleLike,
  onToggleTrackInPlaylist,
  onDeleteTrack,
  onRemoveFromPlaylist,
  onDownloadTrack,
  onTriggerImport,
  onScanDevice,
  isScanning,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [openMenuTrackId, setOpenMenuTrackId] = useState<string | null>(null);

  const filtered = tracks.filter((t) => {
    if (formatFilter === 'lossless' && !LOSSLESS_FORMATS.has(t.format)) return false;
    if (formatFilter === 'compressed' && LOSSLESS_FORMATS.has(t.format)) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q) ||
      t.genre.toLowerCase().includes(q) ||
      t.format.toLowerCase().includes(q)
    );
  });

  const filteredIds = filtered.map((t) => t.id);

  const formatMetaString = (track: Track) => {
    const parts: string[] = [track.format];
    if (track.sampleRate) {
      parts.push(`${(track.sampleRate / 1000).toFixed(1).replace(/\.0$/, '')} kHz`);
    } else if (track.bitrate) {
      parts.push(`${track.bitrate} kbps`);
    }
    if (track.bitDepth) {
      parts.push(`${track.bitDepth}-bit`);
    }
    if (track.isDownloaded) {
      parts.push('Offline');
    } else if (track.streamUrl) {
      parts.push('Online');
    }
    return parts.join(' · ');
  };

  return (
    <section className="flex flex-col min-w-0">
      {/* Section controls header */}
      <div
        className="flex flex-col gap-3 pb-4 border-b"
        style={{ borderColor: 'var(--border-hairline)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3 min-w-0">
            <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight truncate">{heading}</h2>
            <span
              className="font-mono-tabular text-xs shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              {filtered.length} {filtered.length === 1 ? 'track' : 'tracks'}
            </span>
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  void triggerHapticMedium();
                  onPlayAll(filteredIds);
                }}
                className="sonance-press inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 hover:opacity-90"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-contrast)',
                }}
              >
                <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                <span>Play All</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void triggerHapticLight();
                  onShuffleAll(filteredIds);
                }}
                className="sonance-press inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap shrink-0 hover:opacity-85"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-hairline)',
                  color: 'var(--text-primary)',
                }}
              >
                <Shuffle className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
                <span>Shuffle</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Format filter segmented control */}
          <div
            className="inline-flex items-center p-0.5 rounded-lg border"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-hairline)',
            }}
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'lossless', label: 'Lossless' },
                { id: 'compressed', label: 'MP3 / AAC' },
              ] as const
            ).map((tab) => {
              const active = formatFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFormatFilter(tab.id)}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors"
                  style={{
                    backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial justify-end">
            {/* Search input */}
            <div className="relative flex-1 sm:w-52 min-w-[160px]">
              <Search
                className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter tracks..."
                aria-label="Filter tracks"
                className="w-full min-h-[38px] rounded-lg border pl-8 pr-3 text-xs focus:outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-hairline)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Manual Device Scan Trigger */}
            <button
              type="button"
              disabled={isScanning}
              onClick={onScanDevice}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-150 hover:opacity-85 active:scale-[0.97] disabled:opacity-60"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-primary)',
              }}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${isScanning ? 'animate-spin' : ''}`}
                style={{ color: 'var(--accent-primary)' }}
              />
              <span>{isScanning ? 'Scanning...' : 'Scan Music'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="py-12 px-4 text-center">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {tracks.length === 0
              ? 'No audio tracks in this view yet'
              : 'No tracks match your current filter'}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {tracks.length === 0
              ? 'Drop MP3, FLAC, WAV, or AAC files anywhere or import them for offline playback.'
              : 'Try clearing your search query or switching audio format filters.'}
          </p>
          {tracks.length === 0 && !isPlaylistView && (
            <button
              type="button"
              onClick={onTriggerImport}
              className="mt-4 px-4 py-2 rounded-lg text-xs font-medium"
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: 'var(--accent-contrast)',
              }}
            >
              Import Audio
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border-hairline)' }}>
          {filtered.map((track, idx) => {
            const isCurrent = track.id === currentTrackId;
            const menuOpen = openMenuTrackId === track.id;

            return (
              <div
                key={track.id}
                className="group relative flex items-center gap-3 py-2.5 px-2.5 rounded-xl transition-colors"
                style={{
                  backgroundColor: isCurrent
                    ? 'color-mix(in srgb, var(--bg-elevated) 78%, transparent)'
                    : 'transparent',
                  borderColor: 'var(--border-hairline)',
                }}
              >
                {/* Index / Play toggle */}
                <button
                  type="button"
                  onClick={() => {
                    void triggerHapticLight();
                    onPlayTrack(track.id);
                  }}
                  aria-label={
                    isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`
                  }
                  className="sonance-press min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl shrink-0"
                  style={{
                    color: isCurrent ? 'var(--accent-primary)' : 'var(--text-muted)',
                  }}
                >
                  {isCurrent && isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : isCurrent ? (
                    <Play className="w-4 h-4 fill-current" />
                  ) : (
                    <>
                      <span className="font-mono-tabular text-xs group-hover:hidden">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <Play className="w-4 h-4 hidden group-hover:block fill-current" />
                    </>
                  )}
                </button>

                {/* Artwork miniature */}
                <button
                  type="button"
                  onClick={() => onPlayTrack(track.id)}
                  className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-hairline)',
                  }}
                >
                  {track.artworkDataUrl ? (
                    <img
                      src={track.artworkDataUrl}
                      alt={`${track.title} cover art`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Music className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  )}
                </button>

                {/* Title & Artist */}
                <button
                  type="button"
                  onClick={() => onPlayTrack(track.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p
                    className="text-sm font-medium truncate"
                    style={{
                      color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                    }}
                  >
                    {track.title}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {track.artist} · {track.album}
                  </p>
                </button>

                {/* Format & Sample Rate (clean unboxed metadata) */}
                <div
                  className="hidden md:block text-right font-mono-tabular text-[11px] shrink-0 pr-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {formatMetaString(track)}
                </div>

                {/* Duration */}
                <div
                  className="font-mono-tabular text-xs shrink-0 w-12 text-right"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {formatDuration(track.duration)}
                </div>

                {/* Row Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {track.streamUrl && !track.isLive && onDownloadTrack && (
                    <DownloadButton
                      compact
                      isDownloaded={Boolean(downloadedSourceIds?.has(track.id))}
                      progress={downloadProgressMap?.[track.id]}
                      trackTitle={track.title}
                      onDownload={(e) => {
                        e.stopPropagation();
                        onDownloadTrack(track);
                      }}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      void triggerHapticMedium();
                      onToggleLike(track.id);
                    }}
                    aria-label={track.liked ? 'Remove from Liked Songs' : 'Love track'}
                    className="sonance-press min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl hover:opacity-80"
                    style={{
                      color: track.liked ? 'var(--accent-primary)' : 'var(--text-muted)',
                    }}
                  >
                    <Heart
                      className={`w-4 h-4 transition-transform ${
                        track.liked ? 'fill-current sonance-heart-liked' : ''
                      }`}
                    />
                  </button>

                  {/* Add to playlist popover trigger */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenMenuTrackId(menuOpen ? null : track.id)}
                      aria-label="Add to playlist"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg transition-opacity hover:opacity-75"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <ListPlus className="w-4 h-4" />
                    </button>

                    {menuOpen && (
                      <div
                        className="absolute right-0 top-10 z-30 w-52 rounded-xl border p-1.5 shadow-xl"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-hairline)',
                        }}
                      >
                        <p
                          className="px-2.5 py-1 text-[11px] font-medium"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          Add to Playlist
                        </p>
                        {playlists.length === 0 ? (
                          <p
                            className="px-2.5 py-2 text-xs"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            No playlists created yet.
                          </p>
                        ) : (
                          playlists.map((pl) => {
                            const inList = pl.trackIds.includes(track.id);
                            return (
                              <button
                                key={pl.id}
                                type="button"
                                onClick={() => {
                                  onToggleTrackInPlaylist(pl.id, track.id);
                                  setOpenMenuTrackId(null);
                                }}
                                className="w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left hover:opacity-80"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                <span className="truncate">{pl.name}</span>
                                {inList && (
                                  <Check
                                    className="w-3.5 h-3.5 shrink-0"
                                    style={{ color: 'var(--accent-primary)' }}
                                  />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {isPlaylistView && activePlaylistId ? (
                    <button
                      type="button"
                      onClick={() => onRemoveFromPlaylist(activePlaylistId, track.id)}
                      aria-label={`Remove ${track.title} from playlist`}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg transition-opacity hover:opacity-75"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDeleteTrack(track.id)}
                      aria-label={`Delete ${track.title}`}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg transition-opacity hover:opacity-75"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
