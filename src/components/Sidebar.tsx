import React, { useState } from 'react';
import {
  Compass,
  Disc3,
  Download,
  Globe,
  Heart,
  ListMusic,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  User,
  Wand2,
  X,
} from 'lucide-react';
import { Playlist } from '../types/audio';
import { formatBytes } from '../utils/audioMetadata';
import { triggerHapticLight } from '../utils/haptics';

export type LibraryFilter =
  | { type: 'all' }
  | { type: 'favorites' }
  | { type: 'downloads' }
  | { type: 'playlist'; playlistId: string }
  | { type: 'discover' }
  | { type: 'radiomap' }
  | { type: 'synesthesia' };

interface SidebarProps {
  activeFilter: LibraryFilter;
  onSelectFilter: (filter: LibraryFilter) => void;
  tracksCount: number;
  favoritesCount: number;
  downloadsCount: number;
  totalStorageBytes: number;
  playlists: Playlist[];
  onCreatePlaylist: (name: string) => void;
  onRenamePlaylist: (playlistId: string, name: string) => void;
  onDeletePlaylist: (playlistId: string) => void;
  onTriggerImport: () => void;
  onScanDevice: () => void;
  isScanning: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenProfileSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeFilter,
  onSelectFilter,
  tracksCount,
  favoritesCount,
  downloadsCount,
  totalStorageBytes,
  playlists,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onTriggerImport,
  onScanDevice,
  isScanning,
  mobileOpen,
  onCloseMobile,
  onOpenProfileSettings,
}) => {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreatePlaylist(trimmed);
    setNewName('');
    setCreating(false);
  };

  const handleRenameSubmit = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const trimmed = editName.trim();
    if (trimmed) {
      onRenamePlaylist(id, trimmed);
    }
    setEditingId(null);
  };

  const content = (
    <div
      className="sonance-glass flex h-full flex-col justify-between p-5 border-r"
      style={{
        borderColor: 'var(--border-hairline)',
      }}
    >
      <div className="space-y-6 overflow-y-auto pr-1">
        {/* Mobile drawer close header */}
        <div className="flex items-center justify-between lg:hidden">
          <span className="text-base font-semibold tracking-tight">Library</span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close library menu"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:opacity-75"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Import & Scan primary actions */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              void triggerHapticLight();
              onTriggerImport();
              onCloseMobile();
            }}
            className="sonance-press w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium hover:opacity-90 whitespace-nowrap"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span>Import Audio Files</span>
          </button>

          <button
            type="button"
            disabled={isScanning}
            onClick={() => {
              void triggerHapticLight();
              onScanDevice();
              onCloseMobile();
            }}
            className="sonance-press w-full min-h-[42px] flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold hover:opacity-85 disabled:opacity-60 whitespace-nowrap"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bg-canvas) 80%, transparent)',
              borderColor: 'var(--border-hairline)',
              color: 'var(--text-primary)',
            }}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 shrink-0 ${isScanning ? 'animate-spin' : ''}`}
              style={{ color: 'var(--accent-primary)' }}
            />
            <span>{isScanning ? 'Scanning Device...' : 'Scan Music'}</span>
          </button>

          <p
            className="pt-0.5 text-[11px] leading-relaxed text-center"
            style={{ color: 'var(--text-muted)' }}
          >
            MP3 · FLAC · WAV · AAC · M4A · OGG
          </p>
        </div>

        {/* Global Streaming & AI Mood */}
        <div className="space-y-1">
          <p
            className="px-2.5 pb-1.5 text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            Explore Global
          </p>

          <button
            type="button"
            onClick={() => {
              onSelectFilter({ type: 'discover' });
              onCloseMobile();
            }}
            className="w-full min-h-[40px] flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor:
                activeFilter.type === 'discover' ? 'var(--bg-elevated)' : 'transparent',
              color: 'var(--text-primary)',
            }}
          >
            <Compass
              className="w-4 h-4 shrink-0"
              style={{
                color:
                  activeFilter.type === 'discover'
                    ? 'var(--accent-primary)'
                    : 'var(--text-muted)',
              }}
            />
            <span className="truncate">Global &amp; AI Mood</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectFilter({ type: 'radiomap' });
              onCloseMobile();
            }}
            className="w-full min-h-[40px] flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor:
                activeFilter.type === 'radiomap' ? 'var(--bg-elevated)' : 'transparent',
              color: 'var(--text-primary)',
            }}
          >
            <Globe
              className="w-4 h-4 shrink-0"
              style={{
                color:
                  activeFilter.type === 'radiomap'
                    ? 'var(--accent-primary)'
                    : 'var(--text-muted)',
              }}
            />
            <span className="truncate">World Radio Map</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectFilter({ type: 'synesthesia' });
              onCloseMobile();
            }}
            className="w-full min-h-[40px] flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor:
                activeFilter.type === 'synesthesia' ? 'var(--bg-elevated)' : 'transparent',
              color: 'var(--text-primary)',
            }}
          >
            <Wand2
              className="w-4 h-4 shrink-0"
              style={{
                color:
                  activeFilter.type === 'synesthesia'
                    ? 'var(--accent-primary)'
                    : 'var(--text-muted)',
              }}
            />
            <span className="truncate">Semantic Synesthesia</span>
          </button>
        </div>

        {/* Collection section */}
        <div className="space-y-1">
          <p
            className="px-2.5 pb-1.5 text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            Offline Library
          </p>

          <button
            type="button"
            onClick={() => {
              onSelectFilter({ type: 'all' });
              onCloseMobile();
            }}
            className="w-full min-h-[40px] flex items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor:
                activeFilter.type === 'all' ? 'var(--bg-elevated)' : 'transparent',
              color: 'var(--text-primary)',
            }}
          >
            <span className="flex items-center gap-2.5 truncate">
              <Disc3
                className="w-4 h-4 shrink-0"
                style={{
                  color:
                    activeFilter.type === 'all'
                      ? 'var(--accent-primary)'
                      : 'var(--text-muted)',
                }}
              />
              <span className="truncate">All Tracks</span>
            </span>
            <span
              className="font-mono-tabular text-xs shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              {tracksCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectFilter({ type: 'favorites' });
              onCloseMobile();
            }}
            className="w-full min-h-[40px] flex items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor:
                activeFilter.type === 'favorites' ? 'var(--bg-elevated)' : 'transparent',
              color: 'var(--text-primary)',
            }}
          >
            <span className="flex items-center gap-2.5 truncate">
              <Heart
                className="w-4 h-4 shrink-0"
                style={{
                  color:
                    activeFilter.type === 'favorites'
                      ? 'var(--accent-primary)'
                      : 'var(--text-muted)',
                }}
              />
              <span className="truncate">Liked Songs</span>
            </span>
            <span
              className="font-mono-tabular text-xs shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              {favoritesCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectFilter({ type: 'downloads' });
              onCloseMobile();
            }}
            className="w-full min-h-[40px] flex items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor:
                activeFilter.type === 'downloads' ? 'var(--bg-elevated)' : 'transparent',
              color: 'var(--text-primary)',
            }}
          >
            <span className="flex items-center gap-2.5 truncate">
              <Download
                className="w-4 h-4 shrink-0"
                style={{
                  color:
                    activeFilter.type === 'downloads'
                      ? 'var(--accent-primary)'
                      : 'var(--text-muted)',
                }}
              />
              <span className="truncate">Offline Downloads</span>
            </span>
            <span
              className="font-mono-tabular text-xs shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              {downloadsCount}
            </span>
          </button>
        </div>

        {/* Custom Playlists */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-2.5 pb-1">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Playlists
            </span>
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              aria-label="Create new playlist"
              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md hover:opacity-75 transition-opacity"
              style={{ color: 'var(--text-primary)' }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {creating && (
            <form onSubmit={handleCreateSubmit} className="px-1 pb-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Playlist name..."
                  autoFocus
                  maxLength={40}
                  className="w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                  style={{
                    backgroundColor: 'var(--bg-canvas)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {playlists.length === 0 && !creating ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full rounded-lg border border-dashed px-3 py-3 text-left text-xs transition-colors hover:opacity-80"
              style={{
                borderColor: 'var(--border-hairline)',
                color: 'var(--text-muted)',
              }}
            >
              Create your first custom playlist
            </button>
          ) : (
            <div className="space-y-0.5">
              {playlists.map((pl) => {
                const isActive =
                  activeFilter.type === 'playlist' && activeFilter.playlistId === pl.id;

                if (editingId === pl.id) {
                  return (
                    <form
                      key={pl.id}
                      onSubmit={(e) => handleRenameSubmit(e, pl.id)}
                      className="px-1 py-1"
                    >
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={(e) => handleRenameSubmit(e, pl.id)}
                        autoFocus
                        maxLength={40}
                        className="w-full rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none"
                        style={{
                          backgroundColor: 'var(--bg-canvas)',
                          borderColor: 'var(--accent-primary)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    </form>
                  );
                }

                return (
                  <div
                    key={pl.id}
                    className="group flex items-center justify-between rounded-lg px-2.5 min-h-[40px] transition-colors"
                    style={{
                      backgroundColor: isActive ? 'var(--bg-elevated)' : 'transparent',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectFilter({ type: 'playlist', playlistId: pl.id });
                        onCloseMobile();
                      }}
                      className="flex-1 min-w-0 flex items-center gap-2.5 py-2 text-left text-sm font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <ListMusic
                        className="w-4 h-4 shrink-0"
                        style={{
                          color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                        }}
                      />
                      <span className="truncate">{pl.name}</span>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className="font-mono-tabular text-xs group-hover:hidden"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {pl.trackIds.length}
                      </span>
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(pl.id);
                            setEditName(pl.name);
                          }}
                          aria-label={`Rename ${pl.name}`}
                          className="p-1.5 rounded hover:opacity-75"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePlaylist(pl.id)}
                          aria-label={`Delete ${pl.name}`}
                          className="p-1.5 rounded hover:opacity-75"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Profile & Settings + Real offline storage summary */}
      <div
        className="pt-3 mt-4 border-t space-y-3"
        style={{
          borderColor: 'var(--border-hairline)',
        }}
      >
        <button
          type="button"
          onClick={() => {
            void triggerHapticLight();
            onOpenProfileSettings();
            onCloseMobile();
          }}
          className="sonance-press w-full min-h-[40px] flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold hover:opacity-85"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bg-canvas) 78%, transparent)',
            borderColor: 'var(--border-hairline)',
            color: 'var(--text-primary)',
          }}
        >
          <span className="flex items-center gap-2 truncate">
            <User className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent-primary)' }} />
            <span className="truncate">Profile &amp; Settings</span>
          </span>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Vibe Trends
          </span>
        </button>

        <div
          className="text-xs flex items-center justify-between"
          style={{ color: 'var(--text-muted)' }}
        >
          <span>Offline Cache</span>
          <span className="font-mono-tabular">
            {tracksCount} {tracksCount === 1 ? 'file' : 'files'} · {formatBytes(totalStorageBytes)}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 h-full">{content}</aside>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-[280px] max-w-[85vw] h-full shadow-2xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
};
