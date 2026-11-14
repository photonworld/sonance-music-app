// Standalone Client-Side API Interceptor for Android APK / Static Builds
// Handles /api/geo, /api/radio/stations, /api/streaming/search, and /api/ai/mood-synth directly without a Node server.

const COUNTRY_PROFILES: Record<string, {
  country: string;
  countryCode: string;
  recommendedGenres: string[];
  radioTags: string[];
  audiusHighlightQuery: string;
}> = {
  GB: { country: 'United Kingdom', countryCode: 'GB', recommendedGenres: ['UK Drill', 'Grime', 'Drum & Bass', 'UK Garage', 'Indie'], radioTags: ['uk drill', 'grime', 'drum and bass', 'london', 'bbc'], audiusHighlightQuery: 'UK Drill Grime' },
  US: { country: 'United States', countryCode: 'US', recommendedGenres: ['Hip-Hop', 'Electronic', 'Indie', 'R&B', 'House'], radioTags: ['hip hop', 'electronic', 'indie', 'jazz', 'house'], audiusHighlightQuery: 'Electronic Hip-Hop' },
  BD: { country: 'Bangladesh', countryCode: 'BD', recommendedGenres: ['Bangla Indie', 'Folk Fusion', 'Acoustic', 'Lo-Fi', 'Rock'], radioTags: ['bangla', 'dhaka', 'folk', 'acoustic', 'chill'], audiusHighlightQuery: 'Acoustic Lo-Fi Indie' },
  IN: { country: 'India', countryCode: 'IN', recommendedGenres: ['Bollywood', 'Indie Pop', 'Classical', 'Desi Hip-Hop', 'Electronic'], radioTags: ['bollywood', 'hindi', 'indian', 'classical', 'lofi'], audiusHighlightQuery: 'Desi Electronic Indie' },
  JP: { country: 'Japan', countryCode: 'JP', recommendedGenres: ['City Pop', 'J-Pop', 'Synthwave', 'Anime OST', 'Jazz'], radioTags: ['j-pop', 'city pop', 'tokyo', 'synthwave', 'jazz'], audiusHighlightQuery: 'City Pop Synthwave' },
  KR: { country: 'South Korea', countryCode: 'KR', recommendedGenres: ['K-Pop', 'K-R&B', 'Chillhop', 'Electronic', 'Indie'], radioTags: ['kpop', 'seoul', 'rnb', 'chill', 'pop'], audiusHighlightQuery: 'K-Pop R&B' },
  NG: { country: 'Nigeria', countryCode: 'NG', recommendedGenres: ['Afrobeats', 'Amapiano', 'Alté', 'Afro-Fusion', 'Hip-Hop'], radioTags: ['afrobeats', 'amapiano', 'lagos', 'african', 'afro'], audiusHighlightQuery: 'Afrobeats Amapiano' },
  DE: { country: 'Germany', countryCode: 'DE', recommendedGenres: ['Techno', 'Minimal', 'Deep House', 'Electronica', 'Ambient'], radioTags: ['techno', 'berlin', 'deep house', 'minimal', 'electronic'], audiusHighlightQuery: 'Berlin Techno Deep House' },
  BR: { country: 'Brazil', countryCode: 'BR', recommendedGenres: ['Bossa Nova', 'Baile Funk', 'MPB', 'Samba', 'Electronic'], radioTags: ['bossa nova', 'samba', 'brazil', 'mpb', 'funk'], audiusHighlightQuery: 'Bossa Nova Baile Funk' },
  FR: { country: 'France', countryCode: 'FR', recommendedGenres: ['French House', 'Nu-Disco', 'Chanson', 'Electro', 'Jazz'], radioTags: ['french', 'paris', 'house', 'nu-disco', 'jazz'], audiusHighlightQuery: 'French House Nu-Disco' },
};

function buildGeoProfile(codeRaw?: string, fallbackCountry?: string, region = 'Global', city = 'International') {
  const code = (codeRaw || 'US').toUpperCase().slice(0, 2);
  const preset = COUNTRY_PROFILES[code];
  if (preset) return { ...preset, region, city };
  return {
    country: fallbackCountry || code || 'Global',
    countryCode: code,
    region,
    city,
    recommendedGenres: ['Electronic', 'Lo-Fi', 'Hip-Hop', 'Indie', 'Jazz'],
    radioTags: ['electronic', 'lofi', 'chill', 'jazz', 'hits'],
    audiusHighlightQuery: 'Trending Electronic Lo-Fi',
  };
}

const RADIO_HOSTS = [
  'https://de1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
];

async function fetchRadioBrowser(apiPath: string): Promise<any[]> {
  for (const host of RADIO_HOSTS) {
    try {
      const res = await nativeFetch(`${host}${apiPath}`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) return await res.json();
    } catch {
      // try next mirror
    }
  }
  return [];
}

const AUDIUS_FALLBACKS = [
  'https://discoveryprovider.audius.co',
  'https://discoveryprovider2.audius.co',
  'https://audius-discovery-1.cultur3stake.com',
];

let cachedAudiusHost: { url: string; exp: number } | null = null;
async function getAudiusHost(): Promise<string> {
  if (cachedAudiusHost && cachedAudiusHost.exp > Date.now()) return cachedAudiusHost.url;
  try {
    const res = await nativeFetch('https://api.audius.co');
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.data) && json.data.length > 0) {
        cachedAudiusHost = { url: json.data[0], exp: Date.now() + 600000 };
        return json.data[0];
      }
    }
  } catch {
    // fallback
  }
  return AUDIUS_FALLBACKS[0];
}

function estimateAcoustic(seed: string, title: string, genre: string) {
  const h = `${title} ${genre}`.toLowerCase();
  let bpm = 104;
  let intensity = 0.55;
  if (/drum|dnb|jungle/.test(h)) { bpm = 168; intensity = 0.86; }
  else if (/dubstep|phonk|trap/.test(h)) { bpm = 140; intensity = 0.84; }
  else if (/techno|trance/.test(h)) { bpm = 134; intensity = 0.82; }
  else if (/house|edm|dance|workout/.test(h)) { bpm = 126; intensity = 0.78; }
  else if (/rock|metal/.test(h)) { bpm = 132; intensity = 0.8; }
  else if (/synthwave|electronic/.test(h)) { bpm = 112; intensity = 0.68; }
  else if (/hip|rap/.test(h)) { bpm = 92; intensity = 0.58; }
  else if (/lo-?fi|chill/.test(h)) { bpm = 82; intensity = 0.36; }
  else if (/ambient|meditation|sleep|piano|classical/.test(h)) { bpm = 68; intensity = 0.26; }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return {
    bpm: Math.max(54, Math.min(186, bpm + ((Math.abs(hash) % 9) - 4))),
    harmonicIntensity: Number(Math.max(0.1, Math.min(0.98, intensity)).toFixed(2)),
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGeo(url: URL): Promise<Response> {
  const override = (url.searchParams.get('country') || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(override)) {
    return jsonResponse(buildGeoProfile(override));
  }
  try {
    const res = await nativeFetch('https://ipwho.is/');
    if (res.ok) {
      const geo = await res.json();
      if (geo?.success !== false && geo?.country_code) {
        return jsonResponse(buildGeoProfile(geo.country_code, geo.country, geo.region || 'Global', geo.city || 'Detected City'));
      }
    }
  } catch {
    // fallback
  }
  return jsonResponse(buildGeoProfile('IN', 'India', 'Asia', 'Kolkata'));
}

async function handleRadio(url: URL): Promise<Response> {
  const countrycode = (url.searchParams.get('countrycode') || '').trim().toUpperCase();
  const tag = (url.searchParams.get('tag') || '').trim();
  const search = (url.searchParams.get('search') || '').trim();
  const preset = (url.searchParams.get('preset') || '').trim().toLowerCase();
  const limit = Math.min(60, Math.max(6, Number(url.searchParams.get('limit')) || 24));

  const PRESET_PATHS: Record<string, string> = {
    bengali: `/json/stations/search?language=bengali&limit=${limit * 2}&order=clickcount&reverse=true&hidebroken=true`,
    bollywood: `/json/stations/search?tag=bollywood&limit=${limit * 2}&order=clickcount&reverse=true&hidebroken=true`,
    lofi: `/json/stations/bytag/lofi?limit=${limit * 2}&order=clickcount&reverse=true&hidebroken=true`,
    pop: `/json/stations/bytag/pop?limit=${limit * 2}&order=clickcount&reverse=true&hidebroken=true`,
    news: `/json/stations/bytag/news?limit=${limit * 2}&order=clickcount&reverse=true&hidebroken=true`,
  };

  let apiPath = `/json/stations/topclick/${limit * 2}`;
  if (preset && PRESET_PATHS[preset]) {
    apiPath = PRESET_PATHS[preset];
  } else if (countrycode) {
    apiPath = `/json/stations/bycountrycodeexact/${encodeURIComponent(countrycode)}?limit=${limit * 2}&order=clickcount&reverse=true&hidebroken=true`;
  } else if (tag) {
    apiPath = `/json/stations/bytag/${encodeURIComponent(tag)}?limit=${limit * 2}&order=clickcount&reverse=true&hidebroken=true`;
  } else if (search) {
    apiPath = `/json/stations/search?name=${encodeURIComponent(search)}&limit=${limit * 2}&order=clickcount&reverse=true&hidebroken=true`;
  }

  const raw = await fetchRadioBrowser(apiPath);
  const stations = (Array.isArray(raw) ? raw : [])
    .filter((s: any) => s && (s.url_resolved || s.url))
    .slice(0, limit)
    .map((s: any) => ({
      stationuuid: String(s.stationuuid || Math.random()),
      name: String(s.name || 'Live Radio').trim(),
      url: String(s.url_resolved || s.url).trim(),
      favicon: s.favicon || '',
      country: s.country || 'International',
      countrycode: s.countrycode || '',
      state: s.state || '',
      tags: typeof s.tags === 'string' ? s.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      codec: (s.codec || 'MP3').toUpperCase(),
      bitrate: Number(s.bitrate) || 128,
      geoLat: typeof s.geo_lat === 'number' ? s.geo_lat : undefined,
      geoLong: typeof s.geo_long === 'number' ? s.geo_long : undefined,
    }));

  return jsonResponse({ stations });
}

async function handleStreaming(url: URL): Promise<Response> {
  const q = (url.searchParams.get('q') || '').trim();
  const genre = (url.searchParams.get('genre') || '').trim();
  const mood = (url.searchParams.get('mood') || '').trim();
  const mode = (url.searchParams.get('mode') || '').trim();
  const limit = Math.min(40, Math.max(6, Number(url.searchParams.get('limit')) || 18));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

  const host = await getAudiusHost();
  const searchTerm = q || mood || genre;

  let endpoint = `${host}/v1/tracks/trending?app_name=Sonance&limit=${limit}&offset=${offset}`;
  if (genre && !q && !mood) {
    endpoint += `&genre=${encodeURIComponent(genre)}`;
  } else if (searchTerm && mode !== 'trending') {
    endpoint = `${host}/v1/tracks/search?query=${encodeURIComponent(searchTerm)}&app_name=Sonance&limit=${limit}&offset=${offset}`;
  }

  try {
    let res = await nativeFetch(endpoint);
    let json = res.ok ? await res.json() : { data: [] };
    let items: any[] = Array.isArray(json?.data) ? json.data : [];

    // Fallback to trending if search returned empty
    if (items.length === 0) {
      res = await nativeFetch(`${host}/v1/tracks/trending?app_name=Sonance&limit=${limit}&offset=${offset}`);
      json = res.ok ? await res.json() : { data: [] };
      items = Array.isArray(json?.data) ? json.data : [];
    }

    const tracks = items
      .filter((t: any) => t && t.id && t.is_streamable !== false)
      .map((t: any) => {
        const title = String(t.title || 'Untitled');
        const trackGenre = String(t.genre || genre || 'Electronic');
        const acoustic = estimateAcoustic(String(t.id), title, trackGenre);
        const artwork = t.artwork?.['480x480'] || t.artwork?.['150x150'] || '';
        return {
          id: `audius-${t.id}`,
          title,
          artist: String(t.user?.name || 'Audius Artist'),
          album: String(t.mood || trackGenre || 'Audius Global'),
          genre: trackGenre,
          duration: Number(t.duration) || 180,
          artworkUrl: artwork,
          streamUrl: `${host}/v1/tracks/${encodeURIComponent(t.id)}/stream?app_name=Sonance`,
          playCount: Number(t.play_count) || 0,
          provider: 'audius',
          bpm: acoustic.bpm,
          harmonicIntensity: acoustic.harmonicIntensity,
        };
      });

    return jsonResponse({
      tracks,
      hasMore: tracks.length >= Math.min(6, limit),
      nextOffset: offset + tracks.length,
      provider: 'Audius Global',
    });
  } catch {
    return jsonResponse({ tracks: [], hasMore: false, nextOffset: offset, provider: 'Audius' });
  }
}

async function handleAiMoodSynth(init?: RequestInit): Promise<Response> {
  let body: any = {};
  try {
    if (typeof init?.body === 'string') body = JSON.parse(init.body);
  } catch {
    // ignore
  }
  const mood = String(body.mood || 'Creative Flow');
  const country = String(body.country || 'Global');
  const targetBpm = Number(body.targetBpm) || 108;
  const harmonicIntensity = Number(body.harmonicIntensity) || 0.62;

  return jsonResponse({
    moodTitle: `${mood} Synthesis`,
    emotionalState: mood,
    rationale: `Calibrated real-time tempo (~${targetBpm} BPM) and harmonic contour for "${mood}" across ${country}.`,
    targetBpmMin: Math.max(55, targetBpm - 12),
    targetBpmMax: Math.min(185, targetBpm + 12),
    harmonicIntensity,
    recommendedGenres: ['Electronic', 'Synthwave', 'Ambient', 'Lo-Fi'],
    radioTags: ['electronic', 'lofi', 'chillout', 'ambient'],
    audiusQueries: [mood, 'electronic chillout', 'instrumental flow'],
    visualizerStyle: 'kinetic',
    quantumMode: 'quantum',
    moodEnvironment: 'aurora',
    curationSource: 'acoustic-engine',
  });
}

const nativeFetch = window.fetch.bind(window);

export function installStandaloneApiInterceptor() {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (rawUrl.startsWith('/api/')) {
      const parsed = new URL(rawUrl, window.location.origin);
      if (parsed.pathname === '/api/geo') return handleGeo(parsed);
      if (parsed.pathname === '/api/radio/stations') return handleRadio(parsed);
      if (parsed.pathname === '/api/streaming/search') return handleStreaming(parsed);
      if (parsed.pathname === '/api/ai/mood-synth') return handleAiMoodSynth(init);
    }
    return nativeFetch(input, init);
  };
           }
