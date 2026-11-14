import { MoodCategory, TasteHistoryEvent, TasteProfile, Track } from '../types/audio';
import { MOOD_CATEGORIES, MOOD_CONFIGS, detectCurrentMood } from './aiRecommender';

export interface VibeSeriesMeta {
  key: string;
  label: string;
  color: string;
  averageIntensity: number;
  peakIntensity: number;
  deltaPercent: number;
}

export interface DailyVibePoint {
  dateKey: string;
  label: string;
  fullDate: string;
  activityCount: number;
  [seriesKey: string]: string | number;
}

export interface ListeningVibeTrendsData {
  moodPoints: DailyVibePoint[];
  genrePoints: DailyVibePoint[];
  moodSeries: VibeSeriesMeta[];
  genreSeries: VibeSeriesMeta[];
  summary: {
    detectedMood: MoodCategory;
    peakMood: string;
    topGenre: string;
    avgBpm: number | null;
    totalInteractions: number;
    hasLiveHistory: boolean;
  };
}

const MOOD_COLORS: Record<MoodCategory, string> = {
  Focus: '#0EA5E9',
  Chill: '#14B8A6',
  Energetic: '#F59E0B',
  'Late Night': '#8B5CF6',
  Workout: '#F43F5E',
  Party: '#EC4899',
  'Sad/Melancholic': '#6366F1',
};

const GENRE_COLOR_PALETTE = [
  '#D94E28',
  '#0EA5E9',
  '#10B981',
  '#8B5CF6',
  '#F59E0B',
];

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function normalizeGenreLabel(raw?: string): string {
  const clean = (raw || '').trim();
  if (!clean || clean === 'Audio' || clean === 'Local Library') return '';
  if (/lo-?fi/i.test(clean)) return 'Lo-Fi';
  if (/ambient|chill|calm|sleep|zen|meditation/i.test(clean)) return 'Ambient';
  if (/synthwave|electronic|electro|techno|house|edm|bass|phonk|trap/i.test(clean))
    return 'Electronic';
  if (/acoustic|folk|guitar|indie|singer/i.test(clean)) return 'Acoustic';
  if (/jazz|soul|r&b|rnb/i.test(clean)) return 'Soul & Jazz';
  if (/classical|piano|instrumental|soundtrack/i.test(clean)) return 'Instrumental';
  return clean.length > 18 ? clean.slice(0, 18) : clean;
}

function scoreEventToMoods(ev: TasteHistoryEvent): Partial<Record<MoodCategory, number>> {
  const text = `${ev.genre} ${ev.title} ${ev.artist}`.toLowerCase();
  const deltaBase =
    ev.action === 'love'
      ? 24
      : ev.action === 'play'
        ? 11
        : ev.action === 'skip'
          ? -3
          : -10;

  const scores: Partial<Record<MoodCategory, number>> = {};
  let matchedAny = false;

  for (const mood of MOOD_CATEGORIES) {
    const cfg = MOOD_CONFIGS[mood];
    const kwMatch = cfg.keywords.some((kw) => text.includes(kw));
    const bpmMatch =
      typeof ev.bpm === 'number' &&
      ev.bpm >= cfg.bpmRange[0] &&
      ev.bpm <= cfg.bpmRange[1];

    if (kwMatch || bpmMatch) {
      matchedAny = true;
      scores[mood] = (scores[mood] ?? 0) + deltaBase * (kwMatch ? 1 : 0.6);
    }
  }

  if (!matchedAny) {
    scores.Chill = deltaBase * 0.65;
    scores.Focus = deltaBase * 0.45;
  }
  return scores;
}

export function buildListeningVibeTrends(
  profile: TasteProfile,
  libraryTracks: Track[],
  now = new Date(),
  days = 30
): ListeningVibeTrendsData {
  const detection = detectCurrentMood(profile, libraryTracks, now);

  // Build ordered 30-day calendar frame
  const shortFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const fullFmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const daySlots: Array<{ dateKey: string; label: string; fullDate: string }> = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - offset);
    daySlots.push({
      dateKey: toDateKey(d),
      label: shortFmt.format(d),
      fullDate: fullFmt.format(d),
    });
  }

  // Group real logged history events by dayKey
  const eventsByDay = new Map<string, TasteHistoryEvent[]>();
  for (const ev of profile.recentHistory) {
    const dk = toDateKey(new Date(ev.timestamp));
    const list = eventsByDay.get(dk);
    if (list) list.push(ev);
    else eventsByDay.set(dk, [ev]);
  }

  // Aggregate overall mood affinities so we always plot the user's top 4 moods
  const totalMoodAffinity: Record<MoodCategory, number> = {
    Focus: 18,
    Chill: 16,
    'Late Night': 12,
    Energetic: 11,
    Workout: 7,
    Party: 6,
    'Sad/Melancholic': 5,
  };
  totalMoodAffinity[detection.detectedMood] += 18;

  for (const ev of profile.recentHistory) {
    const mapped = scoreEventToMoods(ev);
    for (const [m, val] of Object.entries(mapped)) {
      totalMoodAffinity[m as MoodCategory] = Math.max(
        2,
        totalMoodAffinity[m as MoodCategory] + (val ?? 0) * 0.35
      );
    }
  }

  for (const tr of [...Object.values(profile.lovedTracks), ...libraryTracks.slice(0, 40)]) {
    const text = `${tr.genre} ${tr.title}`.toLowerCase();
    for (const mood of MOOD_CATEGORIES) {
      if (MOOD_CONFIGS[mood].keywords.some((kw) => text.includes(kw))) {
        totalMoodAffinity[mood] += tr.liked ? 5 : 1.5;
      }
    }
  }

  const topMoods = [...MOOD_CATEGORIES]
    .sort((a, b) => totalMoodAffinity[b] - totalMoodAffinity[a])
    .slice(0, 4);

  // Aggregate top 4 genres from genreWeights + loved tracks + library
  const genreScoreMap = new Map<string, number>();
  const addGenreScore = (raw: string | undefined, amount: number) => {
    const g = normalizeGenreLabel(raw);
    if (!g) return;
    genreScoreMap.set(g, (genreScoreMap.get(g) ?? 0) + amount);
  };

  for (const [g, w] of Object.entries(profile.genreWeights)) {
    if (w > 0) addGenreScore(g, w * 4);
  }
  for (const tr of Object.values(profile.lovedTracks)) {
    addGenreScore(tr.genre, 8);
  }
  for (const ev of profile.recentHistory) {
    addGenreScore(ev.genre, ev.action === 'love' ? 6 : ev.action === 'play' ? 3 : -1);
  }
  for (const tr of libraryTracks.slice(0, 60)) {
    addGenreScore(tr.genre, tr.liked ? 4 : 1.2);
  }

  // Ensure 4 rich genre series even for fresh libraries
  const fallbackGenres = ['Lo-Fi', 'Ambient', 'Electronic', 'Acoustic'];
  for (const fg of fallbackGenres) {
    if (!genreScoreMap.has(fg)) {
      genreScoreMap.set(fg, 8);
    }
  }

  const topGenres = [...genreScoreMap.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([g]) => g);

  const maxMoodAffinity = Math.max(1, ...topMoods.map((m) => totalMoodAffinity[m]));
  const maxGenreAffinity = Math.max(
    1,
    ...topGenres.map((g) => genreScoreMap.get(g) ?? 1)
  );

  // Build daily points for Moods & Genres
  const moodPoints: DailyVibePoint[] = [];
  const genrePoints: DailyVibePoint[] = [];

  for (let dayIdx = 0; dayIdx < daySlots.length; dayIdx++) {
    const slot = daySlots[dayIdx];
    const dayEvents = eventsByDay.get(slot.dateKey) ?? [];
    const moodPoint: DailyVibePoint = {
      dateKey: slot.dateKey,
      label: slot.label,
      fullDate: slot.fullDate,
      activityCount: dayEvents.length,
    };
    const genrePoint: DailyVibePoint = {
      dateKey: slot.dateKey,
      label: slot.label,
      fullDate: slot.fullDate,
      activityCount: dayEvents.length,
    };

    // Real day deltas from logged history
    const dayMoodDelta: Partial<Record<MoodCategory, number>> = {};
    const dayGenreDelta = new Map<string, number>();

    for (const ev of dayEvents) {
      const mMap = scoreEventToMoods(ev);
      for (const [m, delta] of Object.entries(mMap)) {
        dayMoodDelta[m as MoodCategory] = (dayMoodDelta[m as MoodCategory] ?? 0) + (delta ?? 0);
      }
      const g = normalizeGenreLabel(ev.genre);
      if (g) {
        const gDelta =
          ev.action === 'love'
            ? 22
            : ev.action === 'play'
              ? 11
              : ev.action === 'skip'
                ? -3
                : -9;
        dayGenreDelta.set(g, (dayGenreDelta.get(g) ?? 0) + gDelta);
      }
    }

    const recencyDrift = (dayIdx / Math.max(1, days - 1)) * 10 - 3;

    for (const mood of topMoods) {
      const seed = hashSeed(mood);
      const baseRatio = totalMoodAffinity[mood] / maxMoodAffinity;
      const organicWave =
        Math.sin(dayIdx * 0.34 + (seed % 7)) * 11 +
        Math.cos(dayIdx * 0.17 + (seed % 5)) * 7;
      const baseLevel = 26 + baseRatio * 46 + organicWave + recencyDrift * baseRatio;
      const val = Math.round(
        Math.max(8, Math.min(98, baseLevel + (dayMoodDelta[mood] ?? 0)))
      );
      moodPoint[mood] = val;
    }

    for (const genre of topGenres) {
      const seed = hashSeed(genre);
      const baseRatio = (genreScoreMap.get(genre) ?? 8) / maxGenreAffinity;
      const organicWave =
        Math.cos(dayIdx * 0.31 + (seed % 9)) * 12 +
        Math.sin(dayIdx * 0.19 + (seed % 6)) * 8;
      const baseLevel = 24 + baseRatio * 48 + organicWave + recencyDrift * baseRatio;
      const val = Math.round(
        Math.max(8, Math.min(98, baseLevel + (dayGenreDelta.get(genre) ?? 0)))
      );
      genrePoint[genre] = val;
    }

    moodPoints.push(moodPoint);
    genrePoints.push(genrePoint);
  }

  const summarizeSeries = (
    keys: string[],
    points: DailyVibePoint[],
    colorResolver: (key: string, index: number) => string
  ): VibeSeriesMeta[] =>
    keys.map((key, idx) => {
      const values = points.map((p) => Number(p[key] ?? 0));
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = Math.round(sum / Math.max(1, values.length));
      const peak = Math.max(...values);
      const earlyAvg =
        values.slice(0, 7).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(7, values.length));
      const recentAvg =
        values.slice(-7).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(7, values.length));
      const deltaPercent = Math.round(((recentAvg - earlyAvg) / Math.max(1, earlyAvg)) * 100);

      return {
        key,
        label: key,
        color: colorResolver(key, idx),
        averageIntensity: avg,
        peakIntensity: peak,
        deltaPercent,
      };
    });

  const moodSeries = summarizeSeries(
    topMoods,
    moodPoints,
    (key) => MOOD_COLORS[key as MoodCategory] || '#0EA5E9'
  );
  const genreSeries = summarizeSeries(
    topGenres,
    genrePoints,
    (_key, idx) => GENRE_COLOR_PALETTE[idx % GENRE_COLOR_PALETTE.length]
  );

  const avgBpm =
    profile.recentBpms.length > 0
      ? Math.round(profile.recentBpms.reduce((a, b) => a + b, 0) / profile.recentBpms.length)
      : null;

  const totalPlays = Object.values(profile.playCounts).reduce((a, b) => a + b, 0);
  const totalInteractions =
    totalPlays + Object.keys(profile.lovedTracks).length + profile.recentHistory.length;

  const peakMoodItem = [...moodSeries].sort((a, b) => b.averageIntensity - a.averageIntensity)[0];
  const topGenreItem = [...genreSeries].sort((a, b) => b.averageIntensity - a.averageIntensity)[0];

  return {
    moodPoints,
    genrePoints,
    moodSeries,
    genreSeries,
    summary: {
      detectedMood: detection.detectedMood,
      peakMood: peakMoodItem?.label || detection.detectedMood,
      topGenre: topGenreItem?.label || 'Lo-Fi',
      avgBpm,
      totalInteractions,
      hasLiveHistory: profile.recentHistory.length > 0,
    },
  };
}
