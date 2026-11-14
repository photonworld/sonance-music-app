import React, { useEffect, useState } from 'react';
import { ThemePalette } from '../themes/themes';
import { Track } from '../types/audio';
import { AmbientColorPalette, extractDominantColors } from '../utils/colorExtractor';

interface AmbientBackdropProps {
  currentTrack: Track | null;
  theme: ThemePalette;
  partyMode: boolean;
  isPlaying: boolean;
}

export const AmbientBackdrop: React.FC<AmbientBackdropProps> = ({
  currentTrack,
  theme,
  partyMode,
  isPlaying,
}) => {
  const [palette, setPalette] = useState<AmbientColorPalette>({
    primary: theme.partyPalette[0],
    secondary: theme.partyPalette[1],
    tertiary: theme.partyPalette[2],
  });

  useEffect(() => {
    let cancelled = false;
    const seedKey = currentTrack
      ? `${currentTrack.title}-${currentTrack.artist}-${currentTrack.genre}`
      : theme.id;

    void extractDominantColors(currentTrack?.artworkDataUrl, seedKey, theme).then((colors) => {
      if (!cancelled) {
        setPalette(colors);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentTrack, theme]);

  const primaryAlpha = theme.mode === 'dark' ? (isPlaying ? '34%' : '24%') : isPlaying ? '18%' : '12%';
  const secondaryAlpha = theme.mode === 'dark' ? (isPlaying ? '28%' : '18%') : isPlaying ? '14%' : '9%';
  const tertiaryAlpha = theme.mode === 'dark' ? '18%' : '10%';

  const meshBackground = `
    radial-gradient(65% 55% at 14% 10%, color-mix(in srgb, ${palette.primary} ${primaryAlpha}, transparent) 0%, transparent 72%),
    radial-gradient(60% 55% at 86% 22%, color-mix(in srgb, ${palette.secondary} ${secondaryAlpha}, transparent) 0%, transparent 74%),
    radial-gradient(70% 60% at 50% 92%, color-mix(in srgb, ${palette.tertiary} ${tertiaryAlpha}, transparent) 0%, transparent 76%)
  `;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        opacity: partyMode ? 0.35 : 1,
        transition: 'opacity 1.2s ease',
      }}
    >
      <div
        className="absolute -inset-[8%] will-change-transform"
        style={{
          background: meshBackground,
          transition: 'background 1.2s ease',
          animation: isPlaying ? 'sonance-ambient-drift 22s ease-in-out infinite alternate' : 'none',
        }}
      />
    </div>
  );
};
