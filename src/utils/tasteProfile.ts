import { TasteProfile, Track } from '../types/audio';

const STORAGE_KEY = 'sonance-taste-profile';
const IDB_NAME = 'sonance-taste-profile';
const IDB_VERSION = 1;
const STORE_NAME = 'profile';
const PROFILE_KEY = 'primary';

export function createEmptyTasteProfile(): TasteProfile {
  return {
    lovedTracks: {},
    dislikedTrackIds: [],
    playCounts: {},
    skipCounts: {},
    genreWeights: {},
    artistWeights: {},
    recentBpms: [],
    recentHistory: [],
    updatedAt: Date.now(),
  };
}

function openTasteDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readLocalMirror(): TasteProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TasteProfile>;
    return {
      ...createEmptyTasteProfile(),
      ...parsed,
      lovedTracks: parsed.lovedTracks ?? {},
      dislikedTrackIds: Array.isArray(parsed.dislikedTrackIds) ? parsed.dislikedTrackIds : [],
      playCounts: parsed.playCounts ?? {},
      skipCounts: parsed.skipCounts ?? {},
      genreWeights: parsed.genreWeights ?? {},
      artistWeights: parsed.artistWeights ?? {},
      recentBpms: Array.isArray(parsed.recentBpms) ? parsed.recentBpms : [],
      recentHistory: Array.isArray(parsed.recentHistory) ? parsed.recentHistory : [],
    };
  } catch {
    return null;
  }
}

export async function loadTasteProfile(): Promise<TasteProfile> {
  const local = readLocalMirror();
  try {
    const db = await openTasteDB();
    const fromIdb = await new Promise<TasteProfile | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(PROFILE_KEY);
      req.onsuccess = () => resolve(req.result as TasteProfile | undefined);
      req.onerror = () => reject(req.error);
    });
    if (fromIdb && (!local || fromIdb.updatedAt >= local.updatedAt)) {
      return {
        ...createEmptyTasteProfile(),
        ...fromIdb,
      };
    }
  } catch {
    // Fall back to localStorage mirror
  }
  return local ?? createEmptyTasteProfile();
}

export async function saveTasteProfile(profile: TasteProfile): Promise<void> {
  const stamped: TasteProfile = { ...profile, updatedAt: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
  } catch {
    // Ignore quota limits on localStorage mirror
  }

  try {
    const db = await openTasteDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(stamped, PROFILE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IndexedDB unavailable; localStorage already saved
  }
}

function adjustWeight(
  map: Record<string, number>,
  key: string | undefined,
  delta: number
): Record<string, number> {
  const clean = (key || '').trim();
  if (!clean || clean === 'Audio' || clean === 'Local Library') return map;
  const nextVal = Math.max(-10, Math.min(50, (map[clean] ?? 0) + delta));
  return { ...map, [clean]: nextVal };
}

function appendHistory(
  history: TasteProfile['recentHistory'],
  track: Track,
  action: 'love' | 'play' | 'skip' | 'dislike',
  bpm?: number
): TasteProfile['recentHistory'] {
  const cutoff = Date.now() - 45 * 24 * 60 * 60 * 1000;
  const entry = {
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    genre: track.genre,
    bpm: bpm ?? track.bpm,
    action,
    timestamp: Date.now(),
  };
  return [entry, ...history.filter((ev) => ev.timestamp >= cutoff)].slice(0, 400);
}

export function recordLoveReaction(
  profile: TasteProfile,
  track: Track,
  liked: boolean,
  estimatedBpm?: number | null
): TasteProfile {
  const nextLoved = { ...profile.lovedTracks };
  let nextDisliked = profile.dislikedTrackIds;
  let nextGenreWeights = profile.genreWeights;
  let nextArtistWeights = profile.artistWeights;
  let nextBpms = profile.recentBpms;

  if (liked) {
    nextLoved[track.id] = {
      ...track,
      liked: true,
      bpm: estimatedBpm ?? track.bpm,
    };
    nextDisliked = profile.dislikedTrackIds.filter((id) => id !== track.id);
    nextGenreWeights = adjustWeight(nextGenreWeights, track.genre, 3.5);
    nextArtistWeights = adjustWeight(nextArtistWeights, track.artist, 3.0);
    const bpmVal = estimatedBpm ?? track.bpm;
    if (bpmVal && bpmVal > 40 && bpmVal < 220) {
      nextBpms = [bpmVal, ...profile.recentBpms].slice(0, 20);
    }
  } else {
    delete nextLoved[track.id];
    nextGenreWeights = adjustWeight(nextGenreWeights, track.genre, -1.5);
    nextArtistWeights = adjustWeight(nextArtistWeights, track.artist, -1.5);
  }

  return {
    ...profile,
    lovedTracks: nextLoved,
    dislikedTrackIds: nextDisliked,
    genreWeights: nextGenreWeights,
    artistWeights: nextArtistWeights,
    recentBpms: nextBpms,
    recentHistory: liked
      ? appendHistory(profile.recentHistory, track, 'love', estimatedBpm ?? undefined)
      : profile.recentHistory,
    updatedAt: Date.now(),
  };
}

export function recordDislikeReaction(
  profile: TasteProfile,
  track: Track
): TasteProfile {
  const nextLoved = { ...profile.lovedTracks };
  delete nextLoved[track.id];

  const nextDisliked = profile.dislikedTrackIds.includes(track.id)
    ? profile.dislikedTrackIds
    : [track.id, ...profile.dislikedTrackIds].slice(0, 200);

  return {
    ...profile,
    lovedTracks: nextLoved,
    dislikedTrackIds: nextDisliked,
    skipCounts: {
      ...profile.skipCounts,
      [track.id]: (profile.skipCounts[track.id] ?? 0) + 1,
    },
    genreWeights: adjustWeight(profile.genreWeights, track.genre, -3.0),
    artistWeights: adjustWeight(profile.artistWeights, track.artist, -4.0),
    recentHistory: appendHistory(profile.recentHistory, track, 'dislike'),
    updatedAt: Date.now(),
  };
}

export function recordPlayEvent(
  profile: TasteProfile,
  track: Track,
  estimatedBpm?: number | null
): TasteProfile {
  const bpmVal = estimatedBpm ?? track.bpm;
  return {
    ...profile,
    playCounts: {
      ...profile.playCounts,
      [track.id]: (profile.playCounts[track.id] ?? 0) + 1,
    },
    genreWeights: adjustWeight(profile.genreWeights, track.genre, 1.0),
    artistWeights: adjustWeight(profile.artistWeights, track.artist, 0.8),
    recentBpms:
      bpmVal && bpmVal > 40 && bpmVal < 220
        ? [bpmVal, ...profile.recentBpms].slice(0, 20)
        : profile.recentBpms,
    recentHistory: appendHistory(profile.recentHistory, track, 'play', bpmVal ?? undefined),
    updatedAt: Date.now(),
  };
}

export function recordSkipEvent(profile: TasteProfile, track: Track): TasteProfile {
  return {
    ...profile,
    skipCounts: {
      ...profile.skipCounts,
      [track.id]: (profile.skipCounts[track.id] ?? 0) + 1,
    },
    genreWeights: adjustWeight(profile.genreWeights, track.genre, -0.5),
    recentHistory: appendHistory(profile.recentHistory, track, 'skip'),
    updatedAt: Date.now(),
  };
}
