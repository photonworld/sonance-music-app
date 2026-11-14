import { ThemeId } from '../types/audio';

export interface ThemePalette {
  id: ThemeId;
  name: string;
  mode: 'light' | 'dark';
  description: string;
  canvas: string;
  surface: string;
  elevated: string;
  hairline: string;
  textPrimary: string;
  textMuted: string;
  accent: string;
  accentContrast: string;
  visSecondary: string;
  partyPalette: [string, string, string];
}

export const THEMES: Record<ThemeId, ThemePalette> = {
  alabaster: {
    id: 'alabaster',
    name: 'Alabaster Studio',
    mode: 'light',
    description: 'Warm archival paper with vermilion hardware accents',
    canvas: '#F8F7F4',
    surface: '#FFFFFF',
    elevated: '#EFECE6',
    hairline: 'rgba(20, 20, 19, 0.11)',
    textPrimary: '#141413',
    textMuted: '#62605B',
    accent: '#D94E28',
    accentContrast: '#FFFFFF',
    visSecondary: '#2B5B84',
    partyPalette: ['#D94E28', '#2B5B84', '#E59F3C'],
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Reference',
    mode: 'dark',
    description: 'Deep mastering slate with warm amber illumination',
    canvas: '#0E0F11',
    surface: '#16181D',
    elevated: '#20232B',
    hairline: 'rgba(243, 244, 246, 0.11)',
    textPrimary: '#F3F4F6',
    textMuted: '#989EA8',
    accent: '#E5A93C',
    accentContrast: '#111214',
    visSecondary: '#64A8E0',
    partyPalette: ['#E5A93C', '#569CD6', '#E06C75'],
  },
  matcha: {
    id: 'matcha',
    name: 'Matcha Paper',
    mode: 'light',
    description: 'Quiet botanical stone with deep moss contrast',
    canvas: '#EFF3EE',
    surface: '#F9FBF8',
    elevated: '#E3EAE1',
    hairline: 'rgba(22, 34, 25, 0.11)',
    textPrimary: '#162219',
    textMuted: '#546658',
    accent: '#237A4B',
    accentContrast: '#FFFFFF',
    visSecondary: '#3E6B89',
    partyPalette: ['#237A4B', '#3E6B89', '#C88D32'],
  },
  cobalt: {
    id: 'cobalt',
    name: 'Cobalt Midnight',
    mode: 'dark',
    description: 'Nocturnal navy stage with crisp ice-blue highlights',
    canvas: '#0A101D',
    surface: '#111A2D',
    elevated: '#18243D',
    hairline: 'rgba(226, 236, 255, 0.12)',
    textPrimary: '#EDF2FA',
    textMuted: '#8FA2C2',
    accent: '#38BDF8',
    accentContrast: '#07101C',
    visSecondary: '#818CF8',
    partyPalette: ['#38BDF8', '#818CF8', '#2DD4BF'],
  },
  rosewood: {
    id: 'rosewood',
    name: 'Rosewood Analog',
    mode: 'dark',
    description: 'Warm espresso walnut with terracotta analog glow',
    canvas: '#161110',
    surface: '#211917',
    elevated: '#2C211E',
    hairline: 'rgba(247, 239, 234, 0.11)',
    textPrimary: '#F7EFEA',
    textMuted: '#A89790',
    accent: '#E06D53',
    accentContrast: '#161110',
    visSecondary: '#D9A86C',
    partyPalette: ['#E06D53', '#D9A86C', '#B85D8E'],
  },
};

export const THEME_LIST: ThemePalette[] = Object.values(THEMES);

export function applyThemePalette(themeId: ThemeId): ThemePalette {
  const palette = THEMES[themeId] ?? THEMES.alabaster;
  const root = document.documentElement;
  root.style.setProperty('--bg-canvas', palette.canvas);
  root.style.setProperty('--bg-surface', palette.surface);
  root.style.setProperty('--bg-elevated', palette.elevated);
  root.style.setProperty('--border-hairline', palette.hairline);
  root.style.setProperty('--text-primary', palette.textPrimary);
  root.style.setProperty('--text-muted', palette.textMuted);
  root.style.setProperty('--accent-primary', palette.accent);
  root.style.setProperty('--accent-contrast', palette.accentContrast);
  root.style.setProperty('--vis-secondary', palette.visSecondary);
  root.style.colorScheme = palette.mode;
  root.classList.toggle('dark', palette.mode === 'dark');

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', palette.canvas);
  }
  return palette;
}
