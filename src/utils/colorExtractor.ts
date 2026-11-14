import { ThemePalette } from '../themes/themes';

export interface AmbientColorPalette {
  primary: string;
  secondary: string;
  tertiary: string;
}

const COLOR_CACHE = new Map<string, AmbientColorPalette>();

function clampChannel(val: number): number {
  return Math.max(0, Math.min(255, Math.round(val)));
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clampChannel(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = clampChannel(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    clampChannel(hue2rgb(p, q, h + 1 / 3) * 255),
    clampChannel(hue2rgb(p, q, h) * 255),
    clampChannel(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function tuneColorForTheme(r: number, g: number, b: number, mode: 'light' | 'dark'): string {
  const [h, s, l] = rgbToHsl(r, g, b);
  const tunedS = Math.min(0.82, Math.max(0.36, s * 1.15));
  const tunedL = mode === 'dark' ? Math.min(0.56, Math.max(0.34, l)) : Math.min(0.68, Math.max(0.44, l));
  const [nr, ng, nb] = hslToRgb(h, tunedS, tunedL);
  return rgbToHex(nr, ng, nb);
}

function deriveSeededPalette(seedKey: string, theme: ThemePalette): AmbientColorPalette {
  if (!seedKey) {
    return {
      primary: theme.partyPalette[0],
      secondary: theme.partyPalette[1],
      tertiary: theme.partyPalette[2],
    };
  }
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) {
    hash = (hash * 31 + seedKey.charCodeAt(i)) >>> 0;
  }
  const baseHue = (hash % 360) / 360;
  const hue2 = (baseHue + 0.14) % 1;
  const hue3 = (baseHue + 0.58) % 1;
  const sat = theme.mode === 'dark' ? 0.65 : 0.58;
  const lum = theme.mode === 'dark' ? 0.45 : 0.56;

  const [r1, g1, b1] = hslToRgb(baseHue, sat, lum);
  const [r2, g2, b2] = hslToRgb(hue2, sat * 0.9, lum * 0.95);
  const [r3, g3, b3] = hslToRgb(hue3, sat * 0.85, lum);

  return {
    primary: rgbToHex(r1, g1, b1),
    secondary: rgbToHex(r2, g2, b2),
    tertiary: rgbToHex(r3, g3, b3),
  };
}

export async function extractDominantColors(
  artworkUrl: string | undefined,
  seedKey: string,
  theme: ThemePalette
): Promise<AmbientColorPalette> {
  const cacheKey = `${theme.mode}:${artworkUrl || seedKey}`;
  const cached = COLOR_CACHE.get(cacheKey);
  if (cached) return cached;

  if (!artworkUrl) {
    const fallback = deriveSeededPalette(seedKey, theme);
    COLOR_CACHE.set(cacheKey, fallback);
    return fallback;
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      if (!artworkUrl.startsWith('data:') && !artworkUrl.startsWith('blob:')) {
        el.crossOrigin = 'anonymous';
      }
      const timer = window.setTimeout(() => reject(new Error('timeout')), 3500);
      el.onload = () => {
        window.clearTimeout(timer);
        resolve(el);
      };
      el.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('load error'));
      };
      el.src = artworkUrl;
    });

    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no ctx');

    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    interface Bucket {
      r: number;
      g: number;
      b: number;
      weight: number;
    }

    const buckets = new Map<string, Bucket>();
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 140) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      // Favor saturated mid-tone pixels over near-black or near-white background pixels
      const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (luma < 0.08 || luma > 0.94) continue;

      const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
      const score = 1 + sat * 3.5;
      const existing = buckets.get(key);
      if (existing) {
        existing.r += r * score;
        existing.g += g * score;
        existing.b += b * score;
        existing.weight += score;
      } else {
        buckets.set(key, { r: r * score, g: g * score, b: b * score, weight: score });
      }
    }

    const ranked = Array.from(buckets.values()).sort((a, b) => b.weight - a.weight);
    if (ranked.length === 0) {
      const fallback = deriveSeededPalette(seedKey, theme);
      COLOR_CACHE.set(cacheKey, fallback);
      return fallback;
    }

    const pick = (idx: number) => {
      const b = ranked[Math.min(idx, ranked.length - 1)];
      return tuneColorForTheme(b.r / b.weight, b.g / b.weight, b.b / b.weight, theme.mode);
    };

    const result: AmbientColorPalette = {
      primary: pick(0),
      secondary: pick(1),
      tertiary: ranked.length > 2 ? pick(2) : theme.visSecondary,
    };
    COLOR_CACHE.set(cacheKey, result);
    return result;
  } catch {
    // Graceful harmonic fallback when remote artwork CDN omits CORS headers
    const fallback = deriveSeededPalette(seedKey || artworkUrl, theme);
    COLOR_CACHE.set(cacheKey, fallback);
    return fallback;
  }
}
