import { AudiusStreamTrack, MoodCategory, TasteProfile, Track } from '../types/audio';
import { audiusToTrack } from '../components/DiscoverGlobal';

export const MOOD_CATEGORIES: MoodCategory[] = [
  'Chill',
  'Energetic',
  'Focus',
  'Late Night',
  'Sad/Melancholic',
  'Workout',
  'Party',
];

interface MoodConfig {
  queries: string[];
  keywords: string[];
  bpmRange: [number, number];
  description: string;
}

export const MOOD_CONFIGS: Record<MoodCategory, MoodConfig> = {
  Chill: {
    queries: ['chill lo-fi beats', 'downtempo ambient chill', 'mellow indie soul'],
    keywords: ['chill', 'lofi', 'lo-fi', 'ambient', 'downtempo', 'acoustic', 'soul', 'bossa'],
    bpmRange: [65, 102],
    description: 'Warm, unhurried grooves tuned for relaxed listening',
  },
  Energetic: {
    queries: ['electronic upbeat hits', 'uk drill drum and bass', 'high energy pop'],
    keywords: ['electronic', 'drum', 'bass', 'drill', 'grime', 'rock', 'electro', 'upbeat'],
    bpmRange: [118, 150],
    description: 'High-momentum rhythms with crisp transients and drive',
  },
  Focus: {
    queries: ['instrumental study focus', 'minimal classical piano', 'deep ambient focus'],
    keywords: ['classical', 'piano', 'instrumental', 'ambient', 'minimal', 'jazz', 'study', 'soundtrack'],
    bpmRange: [60, 112],
    description: 'Clean instrumental textures for uninterrupted concentration',
  },
  'Late Night': {
    queries: ['midnight synthwave rnb', 'late night deep house', 'nocturnal lo-fi'],
    keywords: ['night', 'synthwave', 'r&b', 'rnb', 'deep house', 'dub', 'noir', 'trip hop'],
    bpmRange: [78, 122],
    description: 'Atmospheric nocturnal basslines and velvet synth pads',
  },
  'Sad/Melancholic': {
    queries: ['melancholic indie acoustic', 'emotional piano ballad', 'sad lo-fi rnb'],
    keywords: ['sad', 'melancholy', 'acoustic', 'ballad', 'indie', 'folk', 'blues', 'emo'],
    bpmRange: [55, 95],
    description: 'Reflective melodies and intimate vocal acoustics',
  },
  Workout: {
    queries: ['workout gym bass phonk', 'hiit trap electronic', 'high tempo techno'],
    keywords: ['workout', 'trap', 'phonk', 'techno', 'hip-hop', 'hip hop', 'gym', 'hard'],
    bpmRange: [126, 175],
    description: 'Relentless tempo and sub-bass punch built for movement',
  },
  Party: {
    queries: ['club dance house hits', 'afrobeats party mix', 'edm festival dance'],
    keywords: ['party', 'club', 'dance', 'house', 'edm', 'afrobeats', 'funk', 'disco'],
    bpmRange: [116, 136],
    description: 'Floor-ready dance energy calibrated for Party Lighting',
  },
};

export interface MoodDetectionResult {
  detectedMood: MoodCategory;
  confidence: number;
  reason: string;
  seedTrack: Track | null;
  topGenres: string[];
  topArtists: string[];
}

function getTimeOfDayBucket(date: Date): { label: string; moodBias: Partial<Record<MoodCategory, number>> } {
  const hour = date.getHours();
  if (hour >= 0 && hour < 5) {
    return { label: 'late-night hours', moodBias: { 'Late Night': 3.2, Chill: 2.0, 'Sad/Melancholic': 1.2 } };
  }
  if (hour >= 5 && hour < 11) {
    return { label: 'morning hours', moodBias: { Focus: 2.4, Chill: 2.0, Energetic: 1.0 } };
  }
  if (hour >= 11 && hour < 17) {
    return { label: 'daytime session', moodBias: { Focus: 2.0, Energetic: 1.8, Workout: 1.2 } };
  }
  if (hour >= 17 && hour < 21) {
    return { label: 'evening wind-down', moodBias: { Chill: 2.2, Party: 1.6, Energetic: 1.5 } };
  }
  return { label: 'night session', moodBias: { 'Late Night': 2.5, Party: 2.0, Chill: 1.4 } };
}

export function detectCurrentMood(
  profile: TasteProfile,
  libraryTracks: Track[],
  now = new Date()
): MoodDetectionResult {
  const scores: Record<MoodCategory, number> = {
    Chill: 1,
    Energetic: 1,
    Focus: 1,
    'Late Night': 1,
    'Sad/Melancholic': 0.8,
    Workout: 0.8,
    Party: 0.9,
  };

  const timeBucket = getTimeOfDayBucket(now);
  for (const [mood, boost] of Object.entries(timeBucket.moodBias)) {
    scores[mood as MoodCategory] += boost ?? 0;
  }

  // Score from genre weights
  for (const [genreRaw, weight] of Object.entries(profile.genreWeights)) {
    if (weight <= 0) continue;
    const g = genreRaw.toLowerCase();
    for (const mood of MOOD_CATEGORIES) {
      if (MOOD_CONFIGS[mood].keywords.some((kw) => g.includes(kw))) {
        scores[mood] += weight * 0.9;
      }
    }
  }

  // Recent love & play history carries strong recency signal
  const recentPositive = profile.recentHistory
    .filter((ev) => ev.action === 'love' || ev.action === 'play')
    .slice(0, 10);

  recentPositive.forEach((ev, idx) => {
    const recencyFactor = Math.max(0.4, 1.4 - idx * 0.1) * (ev.action === 'love' ? 2.2 : 1.0);
    const haystack = `${ev.genre} ${ev.title} ${ev.artist}`.toLowerCase();
    for (const mood of MOOD_CATEGORIES) {
      if (MOOD_CONFIGS[mood].keywords.some((kw) => haystack.includes(kw))) {
        scores[mood] += recencyFactor * 1.8;
      }
    }
  });

  // Average recent BPM signal
  const avgBpm =
    profile.recentBpms.length > 0
      ? profile.recentBpms.reduce((a, b) => a + b, 0) / profile.recentBpms.length
      : null;

  if (avgBpm !== null) {
    for (const mood of MOOD_CATEGORIES) {
      const [minB, maxB] = MOOD_CONFIGS[mood].bpmRange;
      if (avgBpm >= minB && avgBpm <= maxB) {
        scores[mood] += 2.4;
      }
    }
  }

  // Pick highest scoring mood
  let bestMood: MoodCategory = 'Chill';
  let bestScore = -Infinity;
  let totalScore = 0;
  for (const mood of MOOD_CATEGORIES) {
    totalScore += scores[mood];
    if (scores[mood] > bestScore) {
      bestScore = scores[mood];
      bestMood = mood;
    }
  }

  // Pick seed track from loved tracks (prioritize most recently loved online/local track)
  const lovedList = [
    ...Object.values(profile.lovedTracks),
    ...libraryTracks.filter((t) => t.liked && !profile.lovedTracks[t.id]),
  ].sort((a, b) => b.addedAt - a.addedAt);

  const seedTrack = lovedList[0] ?? null;

  const topGenres = Object.entries(profile.genreWeights)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g);

  const topArtists = Object.entries(profile.artistWeights)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([a]) => a);

  const reasonParts: string[] = [];
  if (seedTrack) {
    reasonParts.push(`inspired by loving "${seedTrack.title}"`);
  } else if (topGenres.length > 0) {
    reasonParts.push(`tuned to ${topGenres[0]}`);
  }
  if (avgBpm) {
    reasonParts.push(`~${Math.round(avgBpm)} BPM tempo`);
  }
  reasonParts.push(timeBucket.label);

  return {
    detectedMood: bestMood,
    confidence: Math.min(0.98, Math.max(0.55, bestScore / Math.max(1, totalScore) * 3.2)),
    reason: reasonParts.join(' · '),
    seedTrack,
    topGenres,
    topArtists,
  };
}

function scoreCandidateTrack(
  track: Track,
  mood: MoodCategory,
  profile: TasteProfile
): number {
  let score = 1;
  const gLower = (track.genre || '').toLowerCase();
  const text = `${track.title} ${track.genre} ${track.album}`.toLowerCase();

  if (MOOD_CONFIGS[mood].keywords.some((kw) => text.includes(kw))) {
    score += 4;
  }

  for (const [prefGenre, weight] of Object.entries(profile.genreWeights)) {
    if (gLower.includes(prefGenre.toLowerCase())) {
      score += weight * 0.8;
    }
  }

  const artistBoost = profile.artistWeights[track.artist] ?? 0;
  score += artistBoost * 1.1;

  if (profile.lovedTracks[track.id]) score += 1.5;
  return score;
}

export async function fetchMoodRecommendations(
  mood: MoodCategory,
  profile: TasteProfile,
  regionCountry?: string,
  offset = 0
): Promise<Track[]> {
  const cfg = MOOD_CONFIGS[mood];
  const topGenre = Object.entries(profile.genreWeights)
    .filter(([, w]) => w > 1)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const primaryQuery = topGenre ? `${topGenre} ${cfg.keywords[0]}` : cfg.queries[0];
  const secondaryQuery = cfg.queries[(offset > 0 ? 2 : 1) % cfg.queries.length] || cfg.queries[0];
  const moodTags = cfg.keywords.slice(0, 3).join(',');

  const dislikedSet = new Set(profile.dislikedTrackIds);

  const [res1, res2] = await Promise.all([
    fetch(
      `/api/streaming/search?q=${encodeURIComponent(primaryQuery)}&mood=${encodeURIComponent(
        mood
      )}&tags=${encodeURIComponent(moodTags)}&sort=popular&limit=12&offset=${offset}`
    ).then((r) =>
      r.ok ? (r.json() as Promise<{ tracks?: AudiusStreamTrack[] }>) : { tracks: [] }
    ),
    fetch(
      `/api/streaming/search?q=${encodeURIComponent(
        regionCountry && regionCountry !== 'Global'
          ? `${secondaryQuery}`
          : secondaryQuery
      )}&mood=${encodeURIComponent(mood)}&tags=${encodeURIComponent(
        moodTags
      )}&sort=popular&limit=10&offset=${offset}`
    ).then((r) =>
      r.ok ? (r.json() as Promise<{ tracks?: AudiusStreamTrack[] }>) : { tracks: [] }
    ),
  ]);

  const seenIds = new Set<string>();
  const merged: Track[] = [];
  for (const raw of [...(res1.tracks ?? []), ...(res2.tracks ?? [])]) {
    if (dislikedSet.has(raw.id) || seenIds.has(raw.id)) continue;
    seenIds.add(raw.id);
    merged.push(audiusToTrack(raw));
  }

  return merged
    .sort((a, b) => scoreCandidateTrack(b, mood, profile) - scoreCandidateTrack(a, mood, profile))
    .slice(0, 14);
}

export async function fetchContinuousStreamBatch(params: {
  query?: string;
  genre?: string;
  mood?: string;
  tags?: string;
  sort?: 'popular' | 'relevance';
  mode?: 'search' | 'trending';
  offset: number;
  excludeIds: Set<string>;
  profile: TasteProfile;
  regionCountry?: string;
  targetBpmMin?: number;
  targetBpmMax?: number;
  harmonicTarget?: number;
}): Promise<{ tracks: Track[]; nextOffset: number; hasMore: boolean; pivotedQuery?: string }> {
  const {
    query,
    genre,
    mood,
    tags,
    sort,
    mode,
    offset,
    excludeIds,
    profile,
    targetBpmMin,
    targetBpmMax,
    harmonicTarget,
  } = params;
  const dislikedSet = new Set(profile.dislikedTrackIds);
  const limit = 14;

  const requestPage = async (opts: {
    q?: string;
    g?: string;
    m?: string;
    tg?: string;
    sr?: 'popular' | 'relevance';
    md?: 'search' | 'trending';
    off: number;
  }) => {
    const sp = new URLSearchParams();
    if (opts.q) sp.set('q', opts.q);
    if (opts.g) sp.set('genre', opts.g);
    if (opts.m) sp.set('mood', opts.m);
    if (opts.tg) sp.set('tags', opts.tg);
    if (targetBpmMin) sp.set('bpmMin', String(Math.round(targetBpmMin)));
    if (targetBpmMax) sp.set('bpmMax', String(Math.round(targetBpmMax)));
    if (harmonicTarget !== undefined) sp.set('harmonicTarget', String(harmonicTarget));
    sp.set('sort', opts.sr || 'popular');
    if (opts.md) sp.set('mode', opts.md);
    sp.set('limit', String(limit));
    sp.set('offset', String(opts.off));

    const res = await fetch(`/api/streaming/search?${sp.toString()}`);
    if (!res.ok) return { tracks: [] as Track[], hasMore: false, nextOffset: opts.off + limit };
    const data = (await res.json()) as {
      tracks?: AudiusStreamTrack[];
      hasMore?: boolean;
      nextOffset?: number;
    };

    const mapped = (data.tracks ?? [])
      .filter((raw) => !dislikedSet.has(raw.id) && !excludeIds.has(raw.id))
      .map(audiusToTrack);

    return {
      tracks: mapped,
      hasMore: Boolean(data.hasMore),
      nextOffset: data.nextOffset ?? opts.off + limit,
    };
  };

  try {
    const primary = await requestPage({
      q: query,
      g: genre,
      m: mood,
      tg: tags,
      sr: sort,
      md: mode,
      off: offset,
    });
    if (primary.tracks.length > 0) {
      return primary;
    }

    // Widen query cleanly if current search/mood offset is exhausted so infinite streaming never stops
    const detected = detectCurrentMood(profile, []);
    const fallbackMood =
      mood && mood in MOOD_CONFIGS
        ? (mood as MoodCategory)
        : detected.detectedMood;
    const cfg = MOOD_CONFIGS[fallbackMood];
    const fallbackQuery =
      detected.topGenres[0] || cfg.queries[Math.floor(Math.random() * cfg.queries.length)];

    const widened = await requestPage({
      q: fallbackQuery,
      m: fallbackMood,
      tg: cfg.keywords.slice(0, 3).join(','),
      sr: 'popular',
      off: 0,
    });
    if (widened.tracks.length > 0) {
      return { ...widened, pivotedQuery: fallbackQuery };
    }

    // Ultimate fallback: global trending stream page
    const trending = await requestPage({ md: 'trending', sr: 'popular', off: offset % 40 });
    return { ...trending, pivotedQuery: 'Trending Global' };
  } catch {
    return { tracks: [], nextOffset: offset, hasMore: false };
  }
}

export async function fetchBecauseYouLoved(
  seedTrack: Track,
  profile: TasteProfile
): Promise<Track[]> {
  const dislikedSet = new Set(profile.dislikedTrackIds);
  const artistClean =
    seedTrack.artist && seedTrack.artist !== 'Sonance Studio' && seedTrack.artist !== 'Local Library'
      ? seedTrack.artist
      : '';
  const genreClean = seedTrack.genre && seedTrack.genre !== 'Audio' ? seedTrack.genre : 'Electronic';

  const query = artistClean ? `${artistClean} ${genreClean}` : `${genreClean} ${seedTrack.title}`;
  try {
    const res = await fetch(`/api/streaming/search?q=${encodeURIComponent(query)}&limit=14`);
    if (!res.ok) return [];
    const data = (await res.json()) as { tracks?: AudiusStreamTrack[] };
    const candidates = (data.tracks ?? [])
      .filter((t) => t.id !== seedTrack.id && !dislikedSet.has(t.id))
      .map(audiusToTrack);

    if (candidates.length >= 4) {
      return candidates.slice(0, 10);
    }

    // Fallback broader genre search if artist query was very specific
    const fallbackRes = await fetch(
      `/api/streaming/search?q=${encodeURIComponent(genreClean)}&limit=12`
    );
    if (!fallbackRes.ok) return candidates;
    const fbData = (await fallbackRes.json()) as { tracks?: AudiusStreamTrack[] };
    const existingIds = new Set(candidates.map((c) => c.id));
    for (const raw of fbData.tracks ?? []) {
      if (raw.id === seedTrack.id || dislikedSet.has(raw.id) || existingIds.has(raw.id)) continue;
      candidates.push(audiusToTrack(raw));
    }
    return candidates.slice(0, 10);
  } catch {
    return [];
  }
}
