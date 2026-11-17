import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import http from 'node:http';
import path from 'node:path';
import net from 'node:net';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

// Lazy server-side Gemini client (never expose API key to browser)
let cachedAiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!cachedAiClient) {
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedAiClient;
}

function estimateTrackAcousticProfile(
  seedText: string,
  title: string,
  genre: string,
  tagsStr: string,
  speedHint?: string,
  rawBpm?: unknown
): { bpm: number; harmonicIntensity: number } {
  const haystack = `${title} ${genre} ${tagsStr}`.toLowerCase();
  const explicitBpm = Number(rawBpm);
  let baseBpm = Number.isFinite(explicitBpm) && explicitBpm >= 45 && explicitBpm <= 210 ? explicitBpm : 0;
  let intensity = 0.52;

  if (!baseBpm && speedHint) {
    switch (speedHint.toLowerCase()) {
      case 'verylow':
        baseBpm = 66;
        intensity = 0.24;
        break;
      case 'low':
        baseBpm = 84;
        intensity = 0.38;
        break;
      case 'medium':
        baseBpm = 108;
        intensity = 0.58;
        break;
      case 'high':
        baseBpm = 128;
        intensity = 0.78;
        break;
      case 'veryhigh':
        baseBpm = 148;
        intensity = 0.9;
        break;
      default:
        break;
    }
  }

  if (/\b(drum\s*&?\s*bass|dnb|jungle|liquid)\b/.test(haystack)) {
    baseBpm ||= 168;
    intensity = Math.max(intensity, 0.86);
  } else if (/\b(dubstep|phonk|trap|hardstyle|drill)\b/.test(haystack)) {
    baseBpm ||= 140;
    intensity = Math.max(intensity, 0.84);
  } else if (/\b(techno|trance|psy|rave|industrial)\b/.test(haystack)) {
    baseBpm ||= 134;
    intensity = Math.max(intensity, 0.82);
  } else if (/\b(house|edm|dance|club|workout|electro|disco)\b/.test(haystack)) {
    baseBpm ||= 126;
    intensity = Math.max(intensity, 0.78);
  } else if (/\b(rock|metal|punk|grunge)\b/.test(haystack)) {
    baseBpm ||= 132;
    intensity = Math.max(intensity, 0.8);
  } else if (/\b(synthwave|retrowave|cyber|electronic)\b/.test(haystack)) {
    baseBpm ||= 112;
    intensity = 0.68;
  } else if (/\b(pop|afrobeats|funk|indie)\b/.test(haystack)) {
    baseBpm ||= 108;
    intensity = 0.62;
  } else if (/\b(hip[\s-]?hop|rap|boom\s*bap)\b/.test(haystack)) {
    baseBpm ||= 92;
    intensity = 0.58;
  } else if (/\b(r&b|rnb|soul|jazz|blues)\b/.test(haystack)) {
    baseBpm ||= 88;
    intensity = 0.52;
  } else if (/\b(lo-?fi|chillhop|beats|downtempo|chillout)\b/.test(haystack)) {
    baseBpm ||= 82;
    intensity = 0.36;
  } else if (/\b(acoustic|guitar|folk|melancholy|sad|ballad)\b/.test(haystack)) {
    baseBpm ||= 78;
    intensity = 0.38;
  } else if (/\b(piano|classical|instrumental|study|focus)\b/.test(haystack)) {
    baseBpm ||= 74;
    intensity = 0.34;
  } else if (/\b(ambient|meditation|zen|sleep|rain|calm|nature|new\s*age)\b/.test(haystack)) {
    baseBpm ||= 66;
    intensity = 0.22;
  } else {
    baseBpm ||= 104;
    intensity = 0.52;
  }

  let hash = 0;
  for (let i = 0; i < seedText.length; i++) {
    hash = (hash * 31 + seedText.charCodeAt(i)) | 0;
  }
  const absHash = Math.abs(hash);
  const bpmJitter = explicitBpm ? 0 : (absHash % 9) - 4;
  const harmonicJitter = ((absHash % 11) - 5) * 0.012;

  return {
    bpm: Math.max(54, Math.min(186, Math.round(baseBpm + bpmJitter))),
    harmonicIntensity: Number(Math.max(0.1, Math.min(0.98, intensity + harmonicJitter)).toFixed(2)),
  };
}

function buildSemanticMoodPlan(opts: {
  mood: string;
  country: string;
  targetBpm?: number;
  harmonicIntensity?: number;
}) {
  const lower = opts.mood.toLowerCase();
  const hasExplicitBpm = Number.isFinite(opts.targetBpm) && Number(opts.targetBpm) >= 50;
  const hasExplicitHarm =
    opts.harmonicIntensity !== undefined && Number.isFinite(opts.harmonicIntensity);

  let preset: {
    moodTitle: string;
    emotionalState: string;
    rationale: string;
    targetBpmMin: number;
    targetBpmMax: number;
    harmonicIntensity: number;
    recommendedGenres: string[];
    radioTags: string[];
    audiusQueries: string[];
    visualizerStyle: 'spectrum' | 'waveform' | 'radial' | 'analog' | 'kinetic';
    quantumMode: 'quantum' | 'neural' | 'nebula' | 'bars';
    moodEnvironment: 'water' | 'rain' | 'warmth' | 'aurora' | 'forest' | 'energy';
  } = {
    moodTitle: 'Adaptive Sonic Synthesis',
    emotionalState: opts.mood,
    rationale: `Calibrated real-time tempo and harmonic contour for "${opts.mood}" across ${opts.country}.`,
    targetBpmMin: 94,
    targetBpmMax: 118,
    harmonicIntensity: 0.58,
    recommendedGenres: ['Electronic', 'Synthwave', 'Chillout', 'Indie'],
    radioTags: ['electronic', 'chillout', 'indie'],
    audiusQueries: ['electronic chillout', 'synthwave flow', 'indie electronic'],
    visualizerStyle: 'kinetic',
    quantumMode: 'quantum',
    moodEnvironment: 'aurora',
  };

  if (/\b(energy|boost|workout|gym|hype|pump|high-bpm|run|cardio|party|club|phonk)\b/.test(lower)) {
    preset = {
      moodTitle: 'Kinetic Energy Surge',
      emotionalState: 'Energy Boost',
      rationale: 'High-momentum percussion and bright harmonic saturation locked to an uplifting drive.',
      targetBpmMin: 124,
      targetBpmMax: 148,
      harmonicIntensity: 0.86,
      recommendedGenres: ['Electronic', 'House', 'Drum & Bass', 'Phonk'],
      radioTags: ['dance', 'electronic', 'workout'],
      audiusQueries: ['electronic bass', 'house workout', 'upbeat electronic'],
      visualizerStyle: 'spectrum',
      quantumMode: 'nebula',
      moodEnvironment: 'energy',
    };
  } else if (/\b(melanchol|sad|blue|lonely|heartbreak|grief|rain|nocturnal|moody)\b/.test(lower)) {
    preset = {
      moodTitle: 'Velvet Rain Melancholy',
      emotionalState: 'Deep Melancholy',
      rationale: 'Reflective minor-key acoustics and unhurried downtempo phrasing for quiet introspection.',
      targetBpmMin: 64,
      targetBpmMax: 84,
      harmonicIntensity: 0.42,
      recommendedGenres: ['Acoustic', 'Ambient', 'Lo-Fi', 'Indie Folk'],
      radioTags: ['ambient', 'acoustic', 'chillout'],
      audiusQueries: ['melancholy piano', 'sad acoustic', 'ambient rain'],
      visualizerStyle: 'waveform',
      quantumMode: 'neural',
      moodEnvironment: 'rain',
    };
  } else if (/\b(creative|flow|code|study|focus|deep|work|synth|cyber)\b/.test(lower)) {
    preset = {
      moodTitle: 'Luminous Creative Flow',
      emotionalState: 'Creative Flow',
      rationale: 'Balanced polyrhythmic textures and steady mid-tempo pulse engineered for sustained immersion.',
      targetBpmMin: 92,
      targetBpmMax: 114,
      harmonicIntensity: 0.64,
      recommendedGenres: ['Synthwave', 'Instrumental', 'Ambient', 'Chillhop'],
      radioTags: ['lofi', 'synthwave', 'instrumental'],
      audiusQueries: ['instrumental electronic', 'lofi chillhop', 'minimal piano'],
      visualizerStyle: 'kinetic',
      quantumMode: 'quantum',
      moodEnvironment: 'aurora',
    };
  } else if (/\b(sleep|calm|zen|meditat|peace|recover|serene|yoga|mindful|relax|water)\b/.test(lower)) {
    preset = {
      moodTitle: 'Serene Delta Drift',
      emotionalState: 'Serene Recovery',
      rationale: 'Warm low-density harmonics and weightless ambient pads tuned to restorative stillness.',
      targetBpmMin: 58,
      targetBpmMax: 76,
      harmonicIntensity: 0.26,
      recommendedGenres: ['Ambient', 'Meditation', 'Classical', 'Acoustic'],
      radioTags: ['ambient', 'meditation', 'chill'],
      audiusQueries: ['peaceful ambient', 'meditation calm', 'soft piano'],
      visualizerStyle: 'radial',
      quantumMode: 'neural',
      moodEnvironment: 'water',
    };
  } else if (/\b(euphori|midnight|night|drive|retrowave|neon|warm|cozy|romantic)\b/.test(lower)) {
    preset = {
      moodTitle: 'Midnight Horizon Glow',
      emotionalState: 'Midnight Euphoria',
      rationale: 'Lush analog synth harmonies and hypnotic nocturnal groove built for late-hour resonance.',
      targetBpmMin: 110,
      targetBpmMax: 132,
      harmonicIntensity: 0.8,
      recommendedGenres: ['Synthwave', 'Deep House', 'R&B', 'Electronic'],
      radioTags: ['synthwave', 'deep house', 'retrowave'],
      audiusQueries: ['midnight synthwave', 'deep house', 'retrowave chill'],
      visualizerStyle: 'kinetic',
      quantumMode: 'nebula',
      moodEnvironment: 'warmth',
    };
  }

  const centerBpm = hasExplicitBpm
    ? Math.max(55, Math.min(180, Math.round(Number(opts.targetBpm))))
    : Math.round((preset.targetBpmMin + preset.targetBpmMax) / 2);

  return {
    ...preset,
    targetBpmMin: hasExplicitBpm ? Math.max(50, centerBpm - 12) : preset.targetBpmMin,
    targetBpmMax: hasExplicitBpm ? Math.min(190, centerBpm + 12) : preset.targetBpmMax,
    harmonicIntensity: hasExplicitHarm
      ? Number(Math.max(0.1, Math.min(1, Number(opts.harmonicIntensity))).toFixed(2))
      : preset.harmonicIntensity,
    curationSource: 'acoustic-engine' as const,
  };
}

interface RegionProfile {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  recommendedGenres: string[];
  radioTags: string[];
  audiusHighlightQuery: string;
}

const COUNTRY_PROFILES: Record<string, Omit<RegionProfile, 'region' | 'city'>> = {
  GB: {
    country: 'United Kingdom',
    countryCode: 'GB',
    recommendedGenres: ['UK Drill', 'Grime', 'Drum & Bass', 'UK Garage', 'Indie'],
    radioTags: ['uk drill', 'grime', 'drum and bass', 'london', 'bbc'],
    audiusHighlightQuery: 'UK Drill Grime',
  },
  US: {
    country: 'United States',
    countryCode: 'US',
    recommendedGenres: ['Hip-Hop', 'Electronic', 'Indie', 'R&B', 'House'],
    radioTags: ['hip hop', 'electronic', 'indie', 'jazz', 'house'],
    audiusHighlightQuery: 'Electronic Hip-Hop',
  },
  BD: {
    country: 'Bangladesh',
    countryCode: 'BD',
    recommendedGenres: ['Bangla Indie', 'Folk Fusion', 'Acoustic', 'Lo-Fi', 'Rock'],
    radioTags: ['bangla', 'dhaka', 'folk', 'acoustic', 'chill'],
    audiusHighlightQuery: 'Acoustic Lo-Fi Indie',
  },
  IN: {
    country: 'India',
    countryCode: 'IN',
    recommendedGenres: ['Bollywood', 'Indie Pop', 'Classical', 'Desi Hip-Hop', 'Electronic'],
    radioTags: ['bollywood', 'hindi', 'indian', 'classical', 'lofi'],
    audiusHighlightQuery: 'Desi Electronic Indie',
  },
  JP: {
    country: 'Japan',
    countryCode: 'JP',
    recommendedGenres: ['City Pop', 'J-Pop', 'Synthwave', 'Anime OST', 'Jazz'],
    radioTags: ['j-pop', 'city pop', 'tokyo', 'synthwave', 'jazz'],
    audiusHighlightQuery: 'City Pop Synthwave',
  },
  KR: {
    country: 'South Korea',
    countryCode: 'KR',
    recommendedGenres: ['K-Pop', 'K-R&B', 'Chillhop', 'Electronic', 'Indie'],
    radioTags: ['kpop', 'seoul', 'rnb', 'chill', 'pop'],
    audiusHighlightQuery: 'K-Pop R&B',
  },
  NG: {
    country: 'Nigeria',
    countryCode: 'NG',
    recommendedGenres: ['Afrobeats', 'Amapiano', 'Alté', 'Afro-Fusion', 'Hip-Hop'],
    radioTags: ['afrobeats', 'amapiano', 'lagos', 'african', 'afro'],
    audiusHighlightQuery: 'Afrobeats Amapiano',
  },
  DE: {
    country: 'Germany',
    countryCode: 'DE',
    recommendedGenres: ['Techno', 'Minimal', 'Deep House', 'Electronica', 'Ambient'],
    radioTags: ['techno', 'berlin', 'deep house', 'minimal', 'electronic'],
    audiusHighlightQuery: 'Berlin Techno Deep House',
  },
  BR: {
    country: 'Brazil',
    countryCode: 'BR',
    recommendedGenres: ['Bossa Nova', 'Baile Funk', 'MPB', 'Samba', 'Electronic'],
    radioTags: ['bossa nova', 'samba', 'brazil', 'mpb', 'funk'],
    audiusHighlightQuery: 'Bossa Nova Baile Funk',
  },
  FR: {
    country: 'France',
    countryCode: 'FR',
    recommendedGenres: ['French House', 'Nu-Disco', 'Chanson', 'Electro', 'Jazz'],
    radioTags: ['french', 'paris', 'house', 'nu-disco', 'jazz'],
    audiusHighlightQuery: 'French House Nu-Disco',
  },
  CA: {
    country: 'Canada',
    countryCode: 'CA',
    recommendedGenres: ['R&B', 'Indie Rock', 'Electronic', 'Hip-Hop', 'Ambient'],
    radioTags: ['toronto', 'indie', 'rnb', 'electronic', 'chill'],
    audiusHighlightQuery: 'Toronto R&B Electronic',
  },
  AU: {
    country: 'Australia',
    countryCode: 'AU',
    recommendedGenres: ['Indie Dance', 'House', 'Psychedelic', 'Electronic', 'Alternative'],
    radioTags: ['australia', 'melbourne', 'indie', 'house', 'electronic'],
    audiusHighlightQuery: 'Indie Dance House',
  },
};

const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  US: { lat: 39.8, lng: -98.5 },
  GB: { lat: 51.5, lng: -0.12 },
  CA: { lat: 43.65, lng: -79.38 },
  DE: { lat: 52.52, lng: 13.4 },
  FR: { lat: 48.85, lng: 2.35 },
  JP: { lat: 35.67, lng: 139.65 },
  KR: { lat: 37.56, lng: 126.97 },
  IN: { lat: 19.07, lng: 72.87 },
  BD: { lat: 23.81, lng: 90.41 },
  NG: { lat: 6.52, lng: 3.37 },
  BR: { lat: -23.55, lng: -46.63 },
  AU: { lat: -33.86, lng: 151.2 },
  NL: { lat: 52.36, lng: 4.9 },
  ES: { lat: 40.41, lng: -3.7 },
  IT: { lat: 41.9, lng: 12.49 },
  SE: { lat: 59.32, lng: 18.06 },
  MX: { lat: 19.43, lng: -99.13 },
  ZA: { lat: -26.2, lng: 28.04 },
  AE: { lat: 25.2, lng: 55.27 },
  SG: { lat: 1.35, lng: 103.81 },
};

function buildProfileForCountry(
  codeRaw: string | undefined,
  fallbackCountry?: string,
  region = 'Global',
  city = 'International'
): RegionProfile {
  const code = (codeRaw || 'US').toUpperCase().slice(0, 2);
  const preset = COUNTRY_PROFILES[code];
  if (preset) {
    return {
      ...preset,
      region,
      city,
    };
  }
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

const RADIO_BROWSER_HOSTS = [
  'https://de1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
];

async function fetchFromRadioBrowser(apiPath: string): Promise<unknown> {
  let lastError: unknown = null;
  for (const host of RADIO_BROWSER_HOSTS) {
    try {
      const res = await fetch(`${host}${apiPath}`, {
        headers: {
          'User-Agent': 'SonanceAudioPlayer/1.0',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(7000),
      });
      if (res.ok) {
        return await res.json();
      }
      lastError = new Error(`Radio Browser HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('Radio Browser mirrors unreachable');
}

const AUDIUS_DISCOVERY_FALLBACKS = [
  'https://discoveryprovider.audius.co',
  'https://discoveryprovider2.audius.co',
  'https://audius-discovery-1.cultur3stake.com',
];

let cachedAudiusHost: { url: string; expiresAt: number } | null = null;
async function getAudiusHost(): Promise<string> {
  if (cachedAudiusHost && cachedAudiusHost.expiresAt > Date.now()) {
    return cachedAudiusHost.url;
  }
  try {
    const res = await fetch('https://api.audius.co', {
      signal: AbortSignal.timeout(4500),
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: string[] };
      if (Array.isArray(json.data) && json.data.length > 0) {
        const picked = json.data[0];
        cachedAudiusHost = { url: picked, expiresAt: Date.now() + 10 * 60 * 1000 };
        return picked;
      }
    }
  } catch {
    // fallback below
  }
  return AUDIUS_DISCOVERY_FALLBACKS[0];
}

function isPrivateOrBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  const ipType = net.isIP(lower);
  if (ipType === 4) {
    const parts = lower.split('.').map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  }
  if (ipType === 6) {
    if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80') || lower === '::1') {
      return true;
    }
  }
  return false;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || '';
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // 1. Geo-location & Auto-Localization API
  app.get('/api/geo', async (req: Request, res: Response) => {
    const override = typeof req.query.country === 'string' ? req.query.country.trim().toUpperCase() : '';
    if (override && /^[A-Z]{2}$/.test(override)) {
      res.json(buildProfileForCountry(override));
      return;
    }

    const headerCountry =
      (req.headers['cf-ipcountry'] as string | undefined) ||
      (req.headers['x-appengine-country'] as string | undefined) ||
      (req.headers['x-vercel-ip-country'] as string | undefined) ||
      (req.headers['x-country-code'] as string | undefined);

    if (headerCountry && headerCountry !== 'XX' && headerCountry !== 'ZZ' && /^[A-Za-z]{2}$/.test(headerCountry)) {
      res.json(buildProfileForCountry(headerCountry));
      return;
    }

    const clientIp = getClientIp(req);
    const lookupIp =
      clientIp && !isPrivateOrBlockedHost(clientIp.replace(/^::ffff:/, ''))
        ? clientIp.replace(/^::ffff:/, '')
        : '';

    try {
      const targetUrl = lookupIp ? `https://ipwho.is/${encodeURIComponent(lookupIp)}` : 'https://ipwho.is/';
      const geoRes = await fetch(targetUrl, { signal: AbortSignal.timeout(3500) });
      if (geoRes.ok) {
        const geo = (await geoRes.json()) as {
          success?: boolean;
          country?: string;
          country_code?: string;
          region?: string;
          city?: string;
        };
        if (geo.success !== false && geo.country_code) {
          res.json(
            buildProfileForCountry(
              geo.country_code,
              geo.country,
              geo.region || 'Global',
              geo.city || 'Detected City'
            )
          );
          return;
        }
      }
    } catch {
      // Fallback below
    }

    res.json(buildProfileForCountry('US', 'Global', 'International', 'Worldwide'));
  });

  // 2. Radio Browser API proxy & normalizer (supports World Map & Quick-Filter Presets)
  app.get('/api/radio/stations', async (req: Request, res: Response) => {
    const countrycode =
      typeof req.query.countrycode === 'string' ? req.query.countrycode.trim().toUpperCase() : '';
    const tag = typeof req.query.tag === 'string' ? req.query.tag.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const mode = typeof req.query.mode === 'string' ? req.query.mode.trim() : '';
    const preset =
      typeof req.query.preset === 'string' ? req.query.preset.trim().toLowerCase() : '';
    const limit = Math.min(60, Math.max(6, Number(req.query.limit) || 24));

    const BROWSER_SAFE_CODECS = new Set(['MP3', 'OGG', 'OPUS', 'FLAC', 'WAV']);

    const PRESET_PATHS: Record<string, string[]> = {
      bengali: [
        '/json/stations/search?limit=60&hidebroken=true&tag=bangla&order=votes&reverse=true',
        '/json/stations/search?limit=60&hidebroken=true&name=bangla&order=votes&reverse=true',
        '/json/stations/search?limit=60&hidebroken=true&name=bengali&order=votes&reverse=true',
        '/json/stations/search?limit=60&hidebroken=true&countrycode=BD&order=votes&reverse=true',
      ],
      bollywood: [
        '/json/stations/search?limit=60&hidebroken=true&tag=bollywood&order=votes&reverse=true',
        '/json/stations/search?limit=60&hidebroken=true&tag=hindi&order=votes&reverse=true',
        '/json/stations/search?limit=60&hidebroken=true&language=hindi&order=clickcount&reverse=true',
      ],
      lofi: [
        '/json/stations/search?limit=60&hidebroken=true&tag=lofi&order=votes&reverse=true',
        '/json/stations/search?limit=60&hidebroken=true&name=lofi&order=votes&reverse=true',
        '/json/stations/search?limit=60&hidebroken=true&tag=chillhop&order=votes&reverse=true',
      ],
      pop: [
        '/json/stations/search?limit=60&hidebroken=true&tag=pop&order=clickcount&reverse=true',
        '/json/stations/search?limit=60&hidebroken=true&tag=top%2040&order=votes&reverse=true',
      ],
      news: [
        '/json/stations/search?limit=60&hidebroken=true&tag=news&order=clickcount&reverse=true',
        '/json/stations/search?limit=60&hidebroken=true&tag=talk&order=clickcount&reverse=true',
      ],
    };

    try {
      let rawCandidates: Array<Record<string, unknown>> = [];

      if (preset && PRESET_PATHS[preset]) {
        const batches = await Promise.all(
          PRESET_PATHS[preset].map((p) =>
            fetchFromRadioBrowser(p).catch(() => [] as Array<Record<string, unknown>>)
          )
        );
        for (const batch of batches) {
          if (Array.isArray(batch)) {
            rawCandidates.push(...(batch as Array<Record<string, unknown>>));
          }
        }
      } else {
        const fetchLimit = Math.min(120, limit * 3);
        let apiPath = `/json/stations/search?limit=${fetchLimit}&hidebroken=true&order=votes&reverse=true`;
        if (mode === 'worldmap') {
          apiPath = `/json/stations/search?limit=120&hidebroken=true&has_geo_info=true&codec=MP3&order=clickcount&reverse=true`;
        } else {
          if (countrycode) apiPath += `&countrycode=${encodeURIComponent(countrycode)}`;
          if (tag) apiPath += `&tag=${encodeURIComponent(tag)}`;
          if (search) apiPath += `&name=${encodeURIComponent(search)}`;
          if (!countrycode && !tag && !search) {
            apiPath = `/json/stations/topvote/${fetchLimit}`;
          }
        }
        const raw = await fetchFromRadioBrowser(apiPath);
        rawCandidates = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
      }

      const seenNames = new Set<string>();
      const seenUrls = new Set<string>();
      const normalized: Array<{
        station: {
          stationuuid: string;
          name: string;
          url: string;
          country: string;
          countrycode: string;
          state: string;
          tags: string[];
          favicon: string;
          bitrate: number;
          codec: string;
          geoLat: number | null;
          geoLong: number | null;
          votes: number;
        };
        score: number;
      }> = [];

      for (const s of rawCandidates) {
        if (Number(s.hls) === 1) continue;
        const codec = String(s.codec || 'MP3').toUpperCase();
        if (!BROWSER_SAFE_CODECS.has(codec)) continue;

        const streamUrl = String(s.url_resolved || s.url || '').trim();
        if (!streamUrl.startsWith('http://') && !streamUrl.startsWith('https://')) continue;
        const lowerUrl = streamUrl.toLowerCase();
        if (
          lowerUrl.endsWith('.pls') ||
          lowerUrl.endsWith('.m3u') ||
          lowerUrl.endsWith('.m3u8') ||
          lowerUrl.endsWith('.asx') ||
          lowerUrl.endsWith('.aac') ||
          lowerUrl.endsWith('.aacp')
        ) {
          continue;
        }
        if (seenUrls.has(lowerUrl)) continue;

        const name = String(s.name || 'Live Radio').trim();
        const dedupKey = name.toLowerCase();
        if (seenNames.has(dedupKey)) continue;

        const tagsRaw = String(s.tags || '').toLowerCase();
        const haystack = `${dedupKey} ${tagsRaw}`;

        // Preset quality filters so Bengali Hits, Bollywood, and Lo-Fi 24/7 stay strictly on-topic
        if (preset === 'bengali') {
          if (/(quran|qur'an|hadith|waz|islamic lecture|naat|nasheed|bible)/.test(haystack)) {
            continue;
          }
        } else if (preset === 'bollywood') {
          if (/(quran|hadith|bhajan only|kirtan)/.test(haystack) && !/bollywood|hits|fm|hindi/.test(haystack)) {
            continue;
          }
        } else if (preset === 'lofi') {
          if (/(france info|news|talk|sport|podcast)/.test(dedupKey)) {
            continue;
          }
        }

        seenNames.add(dedupKey);
        seenUrls.add(lowerUrl);

        const uuid = String(s.stationuuid || crypto.randomUUID());
        const cc = String(s.countrycode || '').toUpperCase();
        const fallbackCoord = COUNTRY_COORDS[cc];
        // Slight deterministic spread when using country centroid so pins remain clickable
        let jitterLat = 0;
        let jitterLng = 0;
        if (typeof s.geo_lat !== 'number' && fallbackCoord) {
          let hash = 0;
          for (let i = 0; i < uuid.length; i++) {
            hash = (hash * 31 + uuid.charCodeAt(i)) | 0;
          }
          jitterLat = (((hash & 0xff) / 255) - 0.5) * 4.5;
          jitterLng = ((((hash >> 8) & 0xff) / 255) - 0.5) * 4.5;
        }
        const lat =
          typeof s.geo_lat === 'number'
            ? s.geo_lat
            : fallbackCoord
              ? fallbackCoord.lat + jitterLat
              : null;
        const lng =
          typeof s.geo_long === 'number'
            ? s.geo_long
            : fallbackCoord
              ? fallbackCoord.lng + jitterLng
              : null;

        const bitrate = Number(s.bitrate) || 128;
        const votes = Number(s.votes) || 0;
        const clickCount = Number(s.clickcount) || 0;
        const isOk = Number(s.lastcheckok) === 1;

        let score = (isOk ? 100000 : 0) + Math.min(votes, 25000) + Math.min(clickCount, 25000) * 0.4;
        if (bitrate >= 96) score += 800;
        if (preset === 'bengali' && /(fm|hits|bhumi|foorti|dhaka|ullash|shadhin|mirchi|bangla|bengali)/.test(haystack)) {
          score += 5000;
        } else if (preset === 'bollywood' && /(bollywood|hits|mirchi|bolly|hindi|fm|big fm|radio city)/.test(haystack)) {
          score += 5000;
        } else if (preset === 'lofi' && /(lofi|lo-fi|chillhop|nightwave|24\/7|beats)/.test(haystack)) {
          score += 5000;
        }

        normalized.push({
          score,
          station: {
            stationuuid: uuid,
            name,
            url: streamUrl,
            country: String(s.country || 'International'),
            countrycode: cc || 'GL',
            state: String(s.state || ''),
            tags: String(s.tags || '')
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 4),
            favicon: String(s.favicon || '').startsWith('https://') ? String(s.favicon) : '',
            bitrate,
            codec,
            geoLat: lat,
            geoLong: lng,
            votes,
          },
        });
      }

      if (preset) {
        normalized.sort((a, b) => b.score - a.score);
      }

      const stations = normalized.slice(0, limit).map((item) => item.station);
      res.json({ stations });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reach Radio Browser network';
      res.status(502).json({ error: message, stations: [] });
    }
  });

  // 3. Unified Audius + Jamendo Streaming Search & Curated Popularity-Sorted Feed
  app.get('/api/streaming/search', async (req: Request, res: Response) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const genre = typeof req.query.genre === 'string' ? req.query.genre.trim() : '';
    const mood = typeof req.query.mood === 'string' ? req.query.mood.trim() : '';
    const tagsRaw = typeof req.query.tags === 'string' ? req.query.tags.trim() : '';
    const fallbacksRaw =
      typeof req.query.fallbacks === 'string' ? req.query.fallbacks.trim() : '';
    const sort =
      typeof req.query.sort === 'string' && req.query.sort.trim() === 'relevance'
        ? 'relevance'
        : 'popular';
    const mode = typeof req.query.mode === 'string' ? req.query.mode.trim() : 'search';
    const limit = Math.min(40, Math.max(5, Number(req.query.limit) || 18));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const bpmMin =
      Number.isFinite(Number(req.query.bpmMin)) && Number(req.query.bpmMin) > 0
        ? Number(req.query.bpmMin)
        : null;
    const bpmMax =
      Number.isFinite(Number(req.query.bpmMax)) && Number(req.query.bpmMax) > 0
        ? Number(req.query.bpmMax)
        : null;
    const harmonicRaw = Number(req.query.harmonicTarget);
    const harmonicTarget =
      req.query.harmonicTarget !== undefined && Number.isFinite(harmonicRaw)
        ? Math.max(0, Math.min(1, harmonicRaw))
        : null;
    const hasAcousticTargets = bpmMin !== null || bpmMax !== null || harmonicTarget !== null;
    const jamendoClientId = process.env.JAMENDO_CLIENT_ID?.trim() || '';

    const parsedTags = tagsRaw
      .split(/[,\s]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const parsedFallbacks = fallbacksRaw
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);

    const fetchAudiusBatch = async () => {
      const candidateHosts = Array.from(
        new Set([await getAudiusHost(), ...AUDIUS_DISCOVERY_FALLBACKS])
      );
      const searchTerm = query || parsedFallbacks[0] || parsedTags.slice(0, 2).join(' ') || mood || genre;
      const fetchWindow = sort === 'popular' ? Math.min(40, Math.max(limit * 2, 28)) : limit;

      const isValidAudiusItem = (item: Record<string, unknown>) => {
        if (!item?.id || item.is_streamable === false) return false;
        const dur = Number(item.duration) || 0;
        if (dur > 0 && (dur < 35 || dur > 5400)) return false;
        return true;
      };

      for (const host of candidateHosts) {
        try {
          let primaryEndpoint = `${host}/v1/tracks/trending?app_name=Sonance&limit=${fetchWindow}&offset=${offset}`;
          if (searchTerm && mode !== 'trending') {
            primaryEndpoint = `${host}/v1/tracks/search?query=${encodeURIComponent(
              searchTerm
            )}&app_name=Sonance&limit=${fetchWindow}&offset=${offset}`;
          } else if (genre && genre.toLowerCase() !== 'all') {
            primaryEndpoint = `${host}/v1/tracks/trending?genre=${encodeURIComponent(
              genre
            )}&app_name=Sonance&limit=${fetchWindow}&offset=${offset}`;
          }

          const requests: Array<Promise<globalThis.Response>> = [
            fetch(primaryEndpoint, {
              headers: { Accept: 'application/json' },
              signal: AbortSignal.timeout(5000),
            }),
          ];

          // Stage 1b: Blend distinct category fallback query in parallel on initial page load
          const distinctFallbacks = Array.from(
            new Set([...parsedFallbacks, ...parsedTags])
          ).filter((f) => f.toLowerCase() !== searchTerm.toLowerCase());
          const firstFallback = distinctFallbacks[0];
          if (offset === 0 && firstFallback) {
            requests.push(
              fetch(
                `${host}/v1/tracks/search?query=${encodeURIComponent(
                  firstFallback
                )}&app_name=Sonance&limit=18`,
                {
                  headers: { Accept: 'application/json' },
                  signal: AbortSignal.timeout(4500),
                }
              )
            );
          }

          const responses = await Promise.allSettled(requests);
          const primaryRes =
            responses[0].status === 'fulfilled' ? responses[0].value : null;

          let primaryRaw: Array<Record<string, unknown>> = [];
          if (primaryRes?.ok) {
            const primaryJson = (await primaryRes.json()) as {
              data?: Array<Record<string, unknown>>;
            };
            primaryRaw = (primaryJson.data ?? []).filter(isValidAudiusItem);
          }

          let fallbackRaw: Array<Record<string, unknown>> = [];
          if (responses[1]?.status === 'fulfilled' && responses[1].value.ok) {
            const fbJson = (await responses[1].value.json()) as {
              data?: Array<Record<string, unknown>>;
            };
            fallbackRaw = (fbJson.data ?? []).filter(isValidAudiusItem);
          }

          // Stage 2: If fewer than 8 valid streams returned, query remaining broad category fallbacks in parallel
          const stageQueries = Array.from(
            new Set([
              ...parsedFallbacks.slice(1),
              ...parsedTags,
            ])
          ).filter((q) => q.toLowerCase() !== searchTerm.toLowerCase() && q.toLowerCase() !== (firstFallback || '').toLowerCase());

          if (primaryRaw.length + fallbackRaw.length < 8 && stageQueries.length > 0) {
            const extraResponses = await Promise.allSettled(
              stageQueries.slice(0, 3).map((qTerm) =>
                fetch(
                  `${host}/v1/tracks/search?query=${encodeURIComponent(
                    qTerm
                  )}&app_name=Sonance&limit=16&offset=${Math.floor(offset / 2)}`,
                  {
                    headers: { Accept: 'application/json' },
                    signal: AbortSignal.timeout(4200),
                  }
                )
              )
            );
            for (const r of extraResponses) {
              if (r.status === 'fulfilled' && r.value.ok) {
                try {
                  const j = (await r.value.json()) as { data?: Array<Record<string, unknown>> };
                  fallbackRaw.push(...(j.data ?? []).filter(isValidAudiusItem));
                } catch {
                  // ignore malformed JSON
                }
              }
            }
          }

          // Stage 3: Guaranteed Top Trending fallback so NO category ever gets stuck or returns < 5 valid streams
          if (primaryRaw.length + fallbackRaw.length < 5) {
            try {
              const trendUrl =
                genre && genre.toLowerCase() !== 'all'
                  ? `${host}/v1/tracks/trending?genre=${encodeURIComponent(genre)}&time=week&app_name=Sonance&limit=25`
                  : `${host}/v1/tracks/trending?time=week&app_name=Sonance&limit=25`;
              const trendRes = await fetch(trendUrl, {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(4500),
              });
              if (trendRes.ok) {
                const trendJson = (await trendRes.json()) as {
                  data?: Array<Record<string, unknown>>;
                };
                const trendItems = (trendJson.data ?? []).filter(isValidAudiusItem);
                fallbackRaw.push(...trendItems);
              }
              if (primaryRaw.length + fallbackRaw.length < 5) {
                const globalTrendRes = await fetch(
                  `${host}/v1/tracks/trending?app_name=Sonance&limit=25`,
                  {
                    headers: { Accept: 'application/json' },
                    signal: AbortSignal.timeout(4500),
                  }
                );
                if (globalTrendRes.ok) {
                  const globalJson = (await globalTrendRes.json()) as {
                    data?: Array<Record<string, unknown>>;
                  };
                  fallbackRaw.push(...(globalJson.data ?? []).filter(isValidAudiusItem));
                }
              }
            } catch {
              // continue to next candidate host if needed
            }
          }

          if (primaryRaw.length + fallbackRaw.length === 0) {
            continue;
          }

          const seenRawIds = new Set<string>();
          const combinedRaw: Array<Record<string, unknown>> = [];
          for (const item of [...primaryRaw, ...fallbackRaw]) {
            const id = item.id ? String(item.id) : '';
            if (!id || seenRawIds.has(id)) continue;
            seenRawIds.add(id);
            combinedRaw.push(item);
          }

          const mapped = combinedRaw.map((t) => {
            const user = (t.user ?? {}) as Record<string, unknown>;
            const artwork = (t.artwork ?? {}) as Record<string, string>;
            const id = String(t.id);
            const title = String(t.title || 'Untitled Track');
            const playCount = Number(t.play_count) || 0;
            const tagsStr = String(t.tags || '');
            const trackGenre = String(t.genre || genre || 'Electronic');
            const haystack = `${title} ${trackGenre} ${tagsStr}`.toLowerCase();

            // Penalize keyword-stuffed spam titles when ranking studio tracks
            const isSpamTitle = title.length > 88 && (title.match(/,/g)?.length ?? 0) >= 3;
            let tagScore = 0;
            for (const tagToken of parsedTags) {
              if (haystack.includes(tagToken)) tagScore += 1;
            }

            const acoustic = estimateTrackAcousticProfile(
              `${id}-${title}`,
              title,
              trackGenre,
              tagsStr,
              undefined,
              t.bpm
            );

            return {
              track: {
                id: `audius-${id}`,
                audiusId: id,
                title,
                artist: String(user.name || user.handle || 'Independent Artist'),
                album: String(t.mood || t.genre || 'Audius Global'),
                genre: trackGenre,
                duration: Number(t.duration) || 180,
                artworkUrl:
                  artwork['480x480'] || artwork['150x150'] || artwork['1000x1000'] || '',
                streamUrl: `${host}/v1/tracks/${encodeURIComponent(id)}/stream?app_name=Sonance`,
                playCount,
                tags: tagsStr,
                provider: 'audius' as const,
                bpm: acoustic.bpm,
                harmonicIntensity: acoustic.harmonicIntensity,
              },
              rankScore:
                (isSpamTitle ? -500000 : 0) +
                playCount +
                tagScore * 18000 +
                (artwork['480x480'] || artwork['1000x1000'] ? 200 : 0),
            };
          });

          if (sort === 'popular') {
            mapped.sort((a, b) => b.rankScore - a.rankScore);
          }

          // Cap consecutive tracks from a single spam uploader when plenty of candidates exist
          const artistCounts = new Map<string, number>();
          const curated: Array<(typeof mapped)[number]['track']> = [];
          const overflow: Array<(typeof mapped)[number]['track']> = [];
          for (const entry of mapped) {
            const artistKey = entry.track.artist.toLowerCase();
            const count = artistCounts.get(artistKey) ?? 0;
            if (count < 2) {
              artistCounts.set(artistKey, count + 1);
              curated.push(entry.track);
            } else {
              overflow.push(entry.track);
            }
          }

          return {
            items: [...curated, ...overflow].slice(0, limit),
            rawCount: primaryRaw.length,
          };
        } catch {
          // Try next discovery node
        }
      }
      return { items: [], rawCount: 0 };
    };

    const fetchJamendoBatch = async () => {
      if (!jamendoClientId) return { items: [], rawCount: 0 };
      try {
        const fuzzyTokens = Array.from(
          new Set(
            [...parsedTags, mood.toLowerCase(), genre.toLowerCase()]
              .map((v) => v.trim())
              .filter(Boolean)
          )
        );

        const params = new URLSearchParams({
          client_id: jamendoClientId,
          format: 'json',
          limit: String(Math.min(20, limit)),
          offset: String(offset),
          audioformat: 'mp32',
          include: 'musicinfo+stats',
          imagesize: '500',
          order: sort === 'popular' || fuzzyTokens.length > 0 ? 'popularity_total' : 'relevance',
        });

        if (fuzzyTokens.length > 0) {
          params.set('fuzzytags', fuzzyTokens.slice(0, 4).join('+'));
        }
        if (query && fuzzyTokens.length === 0) {
          params.set('search', query);
        }

        const jRes = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params.toString()}`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(7000),
        });
        if (!jRes.ok) return { items: [], rawCount: 0 };

        const jPayload = (await jRes.json()) as {
          headers?: { status?: string; code?: number };
          results?: Array<Record<string, unknown>>;
        };
        if (jPayload.headers?.status === 'failed' || !Array.isArray(jPayload.results)) {
          return { items: [], rawCount: 0 };
        }

        const items = jPayload.results
          .filter((item) => Boolean(item.audio) && Boolean(item.id))
          .map((item) => {
            const musicInfo = (item.musicinfo ?? {}) as {
              tags?: { genres?: string[]; vartags?: string[] };
              speed?: string;
            };
            const stats = (item.stats ?? {}) as {
              rate_listened_total?: number;
              rate_downloads_total?: number;
            };
            const genresList = musicInfo.tags?.genres ?? [];
            const varTags = musicInfo.tags?.vartags ?? [];
            const id = String(item.id);
            const title = String(item.name || 'Untitled Track');
            const trackGenre = String(genresList[0] || genre || mood || 'Indie');
            const tagsJoined = [...genresList, ...varTags].join(', ');
            const acoustic = estimateTrackAcousticProfile(
              `${id}-${title}`,
              title,
              trackGenre,
              tagsJoined,
              musicInfo.speed
            );
            return {
              id: `jamendo-${id}`,
              audiusId: id,
              title,
              artist: String(item.artist_name || 'Jamendo Artist'),
              album: String(item.album_name || 'Jamendo Free Music'),
              genre: trackGenre,
              duration: Number(item.duration) || 180,
              artworkUrl: String(item.album_image || item.image || ''),
              streamUrl: String(item.audio),
              playCount: Number(stats.rate_listened_total) || 0,
              tags: tagsJoined,
              provider: 'jamendo' as const,
              bpm: acoustic.bpm,
              harmonicIntensity: acoustic.harmonicIntensity,
            };
          });
        return { items, rawCount: jPayload.results.length };
      } catch {
        return { items: [], rawCount: 0 };
      }
    };

    try {
      const [audiusBatch, jamendoBatch] = await Promise.all([
        fetchAudiusBatch(),
        fetchJamendoBatch(),
      ]);
      const audiusItems = audiusBatch.items;
      const jamendoItems = jamendoBatch.items;

      // Interleave Audius and Jamendo results cleanly when both providers return tracks
      const combined: Array<(typeof audiusItems)[number] | (typeof jamendoItems)[number]> = [];
      const maxLen = Math.max(audiusItems.length, jamendoItems.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < audiusItems.length) combined.push(audiusItems[i]);
        if (i < jamendoItems.length) combined.push(jamendoItems[i]);
      }

      if (hasAcousticTargets && combined.length > 0) {
        const targetBpmCenter =
          bpmMin !== null && bpmMax !== null
            ? (bpmMin + bpmMax) / 2
            : bpmMin ?? bpmMax ?? 108;
        const halfSpan =
          bpmMin !== null && bpmMax !== null ? Math.max(10, (bpmMax - bpmMin) / 2) : 16;

        combined.sort((a, b) => {
          const scoreAcoustic = (tr: (typeof combined)[number]) => {
            const trBpm = tr.bpm ?? 104;
            const trHarm = tr.harmonicIntensity ?? 0.5;
            const bpmDiff = Math.abs(trBpm - targetBpmCenter);
            const inWindow =
              (bpmMin === null || trBpm >= bpmMin - 4) &&
              (bpmMax === null || trBpm <= bpmMax + 4);
            const bpmScore =
              (inWindow ? 120 : 0) + Math.max(0, 100 - (bpmDiff / Math.max(12, halfSpan)) * 55);
            const harmScore =
              harmonicTarget !== null
                ? Math.max(0, 90 * (1 - Math.abs(trHarm - harmonicTarget)))
                : 0;
            const popTieBreaker = Math.min(25, Math.log10(Math.max(1, tr.playCount || 1)) * 4);
            return bpmScore + harmScore + popTieBreaker;
          };
          return scoreAcoustic(b) - scoreAcoustic(a);
        });
      }

      const providers: string[] = [];
      if (audiusItems.length > 0) providers.push('Audius');
      if (jamendoItems.length > 0) providers.push('Jamendo');

      const hasMore =
        audiusBatch.rawCount >= Math.min(limit, 5) ||
        jamendoBatch.rawCount >= Math.min(limit, 5);

      res.json({
        tracks: combined,
        provider: providers.join(' + ') || 'Audius',
        providers,
        jamendoConfigured: Boolean(jamendoClientId),
        offset,
        nextOffset: offset + limit,
        hasMore,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Streaming search unavailable';
      res.status(502).json({ error: message, tracks: [], hasMore: false });
    }
  });

  // 4. Same-origin Audio Stream Proxy (enables Web Audio EQ + Visualizer + Party Mode on CORS-restricted streams)
  app.get('/api/stream-proxy', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl) {
      res.status(400).json({ error: 'Missing stream url parameter' });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'Invalid stream URL' });
      return;
    }

    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || isPrivateOrBlockedHost(parsed.hostname)) {
      res.status(403).json({ error: 'Stream host not permitted' });
      return;
    }

    const controller = new AbortController();
    const connectTimer = setTimeout(() => controller.abort(), 8000);
    req.on('close', () => {
      clearTimeout(connectTimer);
      controller.abort();
    });

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'SonanceAudioPlayer/1.0',
        Accept: 'audio/*,*/*;q=0.8',
      };
      if (typeof req.headers.range === 'string') {
        headers.Range = req.headers.range;
      }

      const upstream = await fetch(parsed.toString(), {
        headers,
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(connectTimer);

      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).end();
        return;
      }

      const rawCt = (upstream.headers.get('content-type') || '').toLowerCase();
      if (
        rawCt.includes('text/html') ||
        rawCt.includes('application/json') ||
        rawCt.includes('mpegurl') ||
        rawCt.includes('scpls') ||
        rawCt.includes('audio/aac')
      ) {
        controller.abort();
        res.status(415).json({ error: `Unsupported stream media type: ${rawCt}` });
        return;
      }

      const contentType =
        !rawCt || rawCt.includes('application/octet-stream')
          ? 'audio/mpeg'
          : upstream.headers.get('content-type') || 'audio/mpeg';

      res.status(upstream.status);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-store');
      const acceptRanges = upstream.headers.get('accept-ranges');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      if (req.method === 'HEAD' || !upstream.body) {
        controller.abort();
        res.end();
        return;
      }

      const nodeStream = Readable.fromWeb(upstream.body as unknown as import('node:stream/web').ReadableStream);
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(502);
        res.end();
      });
      nodeStream.pipe(res);
    } catch (err) {
      clearTimeout(connectTimer);
      if ((err as { name?: string })?.name === 'AbortError') return;
      if (!res.headersSent) {
        res.status(502).json({ error: 'Could not connect to audio stream' });
      }
    }
  });

  // 5. Gemini AI Dynamic Mood, Tempo & Global Radio Synthesizer
  app.post('/api/ai/mood', async (req: Request, res: Response) => {
    const mood = typeof req.body?.mood === 'string' ? req.body.mood.trim() : '';
    const country = typeof req.body?.country === 'string' ? req.body.country.trim() : 'Global';
    const countryCode = typeof req.body?.countryCode === 'string' ? req.body.countryCode.trim() : '';
    const requestedBpm =
      req.body?.targetBpm !== undefined && Number.isFinite(Number(req.body.targetBpm))
        ? Number(req.body.targetBpm)
        : undefined;
    const requestedHarmonic =
      req.body?.harmonicIntensity !== undefined &&
      Number.isFinite(Number(req.body.harmonicIntensity))
        ? Number(req.body.harmonicIntensity)
        : undefined;

    if (!mood) {
      res.status(400).json({ error: 'Please choose or enter an emotional state or vibe.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.json(
        buildSemanticMoodPlan({
          mood,
          country,
          targetBpm: requestedBpm,
          harmonicIntensity: requestedHarmonic,
        })
      );
      return;
    }

    try {
      const targetHint = [
        requestedBpm ? `Requested target BPM around ${Math.round(requestedBpm)} BPM.` : '',
        requestedHarmonic !== undefined
          ? `Requested harmonic intensity ${(requestedHarmonic * 100).toFixed(0)}%.`
          : '',
      ]
        .filter(Boolean)
        .join(' ');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `User emotional state / mood prompt: "${mood}". User detected location: ${country} (${countryCode || 'Global'}). ${targetHint}
Synthesize a cohesive dynamic tempo & harmonic music profile for Sonance (a lossless & global streaming music player).
Return target BPM window (targetBpmMin & targetBpmMax), harmonicIntensity (0.1 to 1.0), concise radio tags compatible with Radio Browser (lowercase, 1-2 words each like "lo-fi", "synthwave", "deep house", "ambient", "jazz"), Audius search queries (short 2-3 word queries), recommended genres, 2D visualizerStyle (spectrum, waveform, radial, analog, kinetic), 3D quantumMode (quantum, neural, nebula, bars), and ambient moodEnvironment (water, rain, warmth, aurora, forest, energy).`,
        config: {
          systemInstruction:
            'You are an expert acoustic music curator and tempo synthesizer. Output accurate BPM ranges and harmonic intensity calibrated to the requested emotional state.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              moodTitle: { type: Type.STRING, description: 'Short evocative 2-4 word mix title.' },
              emotionalState: {
                type: Type.STRING,
                description: 'Concise 1-3 word emotional state label.',
              },
              rationale: { type: Type.STRING, description: 'One concise sentence explaining the sonic & tempo direction.' },
              targetBpmMin: { type: Type.NUMBER, description: 'Minimum target tempo in BPM (55 to 170).' },
              targetBpmMax: { type: Type.NUMBER, description: 'Maximum target tempo in BPM (65 to 185).' },
              harmonicIntensity: {
                type: Type.NUMBER,
                description: 'Harmonic density & energy from 0.1 (sparse ambient) to 1.0 (dense driving).',
              },
              recommendedGenres: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 to 5 musical genres matching the emotional state and tempo.',
              },
              radioTags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 lowercase Radio Browser tags to query live stations.',
              },
              audiusQueries: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 short search queries for Audius streaming tracks.',
              },
              visualizerStyle: {
                type: Type.STRING,
                description: 'One of: spectrum, waveform, radial, analog, kinetic.',
              },
              quantumMode: {
                type: Type.STRING,
                description: 'One of: quantum, neural, nebula, bars.',
              },
              moodEnvironment: {
                type: Type.STRING,
                description: 'One of: water, rain, warmth, aurora, forest, energy.',
              },
            },
            required: [
              'moodTitle',
              'emotionalState',
              'rationale',
              'targetBpmMin',
              'targetBpmMax',
              'harmonicIntensity',
              'recommendedGenres',
              'radioTags',
              'audiusQueries',
              'visualizerStyle',
              'quantumMode',
              'moodEnvironment',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
      const minBpm = Math.max(52, Math.min(175, Number(parsed.targetBpmMin) || requestedBpm || 96));
      const maxBpm = Math.max(minBpm + 8, Math.min(188, Number(parsed.targetBpmMax) || minBpm + 20));
      const rawHarm = Number(parsed.harmonicIntensity);
      const harm = Number.isFinite(rawHarm)
        ? Math.max(0.1, Math.min(1, rawHarm))
        : requestedHarmonic ?? 0.58;

      res.json({
        ...parsed,
        targetBpmMin: Math.round(minBpm),
        targetBpmMax: Math.round(maxBpm),
        harmonicIntensity: Number(harm.toFixed(2)),
        curationSource: 'gemini',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gemini AI curation failed';
      console.error('Gemini mood error:', err);
      res.status(500).json({ error: msg });
    }
  });

  // 6. Gemini AI Semantic Synesthesia & Language Visual Director
  app.post('/api/ai/synesthesia', async (req: Request, res: Response) => {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const artist = typeof req.body?.artist === 'string' ? req.body.artist.trim() : '';
    const lyrics = typeof req.body?.lyrics === 'string' ? req.body.lyrics.trim() : '';
    const durationSeconds =
      Number.isFinite(Number(req.body?.durationSeconds)) && Number(req.body?.durationSeconds) > 0
        ? Math.round(Number(req.body.durationSeconds))
        : 210;
    const audioFingerprint =
      typeof req.body?.audioFingerprint === 'string' ? req.body.audioFingerprint.trim() : '';

    if (!title && !lyrics) {
      res.status(400).json({ error: 'Provide at least a song title or lyrics for semantic analysis.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured on the server. Set GEMINI_API_KEY or explore the built-in Demo Mode journeys.',
      });
      return;
    }

    try {
      const prompt = `Analyze this musical piece as an elite Synesthetic Visual Director:
Title: "${title || 'Untitled Piece'}"
Artist: "${artist || 'Unknown Artist'}"
Duration: ${durationSeconds} seconds
Spectral Fingerprint Hint: ${audioFingerprint || 'balanced-harmonic'}
Lyrics / Poetic Narrative:
"""
${lyrics ? lyrics.slice(0, 6000) : '(Instrumental or minimal lyrics — infer cultural & emotional atmosphere from title/artist.)'}
"""

Direct a living generative artwork evolving from intro (startRatio 0.0) to outro (endRatio 1.0):
1. Detect the primary language ("bengali", "hindi", "english", or "other") and script ("bengali", "devanagari", "arabic", "latin", "mixed").
2. Choose visualStylePreset tailored to its cultural & emotional universe:
   - "bengali-monsoon": fluid watercolor washes, monsoon mist, floating organic petals, soft ink-in-water dispersion (ideal for Bengali / Rabindrasangeet / Adhunik / Folk / rain melancholy).
   - "sufi-lantern": warm golden calligraphy particles, desert wind sand-waves, glowing lantern embers (ideal for Hindi / Urdu / Sufi / Ghazal / mystic devotion).
   - "cosmic-neon": surrealist neon geometry, cosmic stardust, liquid chrome, Cymatic resonances (ideal for English / Western / Electronic / Indie / Cyberpunk).
3. Produce 4 to 6 contiguous emotional storyboard phases covering 0.0 to 1.0 of the song narrative, each with distinct 4-hex palette [primaryHex, secondaryHex, accentHex, deepBgHex], visualMetaphor, gravityX (-1..1), gravityY (-1..1), turbulence (0.1..1.0), particleDensity (0.3..1.0), and kineticStyle ("smoke" for sad/soft, "spark" for energetic/chorus, "glow" for devotional/serene, "drift" for introspective).`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a world-leading synesthesia artist and cultural musicologist. Respond strictly with valid JSON matching the requested schema, preserving authentic cultural motifs and precise hex colors.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedLanguage: {
                type: Type.STRING,
                description: 'One of: bengali, hindi, english, other',
              },
              script: {
                type: Type.STRING,
                description: 'One of: bengali, devanagari, arabic, latin, mixed',
              },
              visualStylePreset: {
                type: Type.STRING,
                description: 'One of: bengali-monsoon, sufi-lantern, cosmic-neon',
              },
              overallEmotion: {
                type: Type.STRING,
                description: 'Concise 2-4 word overarching emotional tone.',
              },
              poeticSummary: {
                type: Type.STRING,
                description: 'One evocative sentence summarizing the emotional arc.',
              },
              culturalMotifs: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 to 5 visual/cultural motifs inspired by the language and lyrics.',
              },
              storyboard: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    startRatio: { type: Type.NUMBER, description: 'Phase start ratio 0.0 to 1.0' },
                    endRatio: { type: Type.NUMBER, description: 'Phase end ratio 0.0 to 1.0' },
                    phaseName: { type: Type.STRING, description: 'e.g. Intro Mist, Rising Longing, Catharsis' },
                    emotionLabel: { type: Type.STRING, description: '1-3 word emotion name' },
                    visualMetaphor: {
                      type: Type.STRING,
                      description: 'Short poetic visual directive for particles and shaders.',
                    },
                    palette: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: 'Exactly 4 CSS hex colors: [primary, secondary, accent, deepBackground]',
                    },
                    gravityX: { type: Type.NUMBER, description: 'Horizontal particle drift -1.0 to 1.0' },
                    gravityY: { type: Type.NUMBER, description: 'Vertical gravity force -1.0 (rise) to 1.0 (fall)' },
                    turbulence: { type: Type.NUMBER, description: 'Curl noise turbulence intensity 0.1 to 1.0' },
                    particleDensity: { type: Type.NUMBER, description: 'Normalized particle density 0.3 to 1.0' },
                    kineticStyle: {
                      type: Type.STRING,
                      description: 'One of: smoke, spark, glow, drift',
                    },
                  },
                  required: [
                    'startRatio',
                    'endRatio',
                    'phaseName',
                    'emotionLabel',
                    'visualMetaphor',
                    'palette',
                    'gravityX',
                    'gravityY',
                    'turbulence',
                    'particleDensity',
                    'kineticStyle',
                  ],
                },
              },
            },
            required: [
              'detectedLanguage',
              'script',
              'visualStylePreset',
              'overallEmotion',
              'poeticSummary',
              'culturalMotifs',
              'storyboard',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
      res.json({
        ...parsed,
        songTitle: title || 'Untitled Piece',
        artist: artist || 'Independent Artist',
        durationSeconds,
        source: 'gemini',
      });
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Semantic synesthesia analysis failed';
      let status = 502;
      try {
        const maybeJson = JSON.parse(msg) as { error?: { code?: number; message?: string } };
        if (maybeJson?.error?.message) {
          msg = maybeJson.error.message;
        }
        if (typeof maybeJson?.error?.code === 'number' && maybeJson.error.code >= 400) {
          status = maybeJson.error.code;
        }
      } catch {
        // use raw Error.message
      }
      console.error('Gemini synesthesia error:', err);
      res.status(status).json({ error: msg });
    }
  });

  const httpServer = http.createServer(app);

  // Mount Vite middlewares in dev or serve built SPA in production
  if (!IS_PROD) {
    const enableHmr =
      process.env.ENABLE_HMR === 'true' && process.env.DISABLE_HMR !== 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: enableHmr ? { server: httpServer } : false,
        ws: enableHmr ? { server: httpServer } : false,
        watch: enableHmr ? {} : null,
      },
      appType: 'spa',
    });

    if (!enableHmr) {
      app.get('/@vite/client', async (_req: Request, res: Response, next) => {
        try {
          const transformed = await vite.transformRequest('/@vite/client');
          if (!transformed) {
            next();
            return;
          }
          const patched = transformed.code
            .replace(
              'transport.connect(createHMRHandler(handleMessage));',
              '/* HMR WebSocket disabled */'
            )
            .replace(
              'else throw new SendBeforeConnectError("send was called before connect");',
              'else return;'
            )
            .replace(
              'else throw new SendBeforeConnectError("invoke was called before connect");',
              'else return void 0;'
            );
          res.status(200);
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.send(patched);
        } catch (err) {
          next(err);
        }
      });
    }

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Sonance server listening on http://0.0.0.0:${PORT}`);
  });
}

void createApp();
