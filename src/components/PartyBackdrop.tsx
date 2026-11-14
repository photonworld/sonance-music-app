import React, { useEffect, useRef } from 'react';
import { AudioAnalysisFrame, PartyIntensity } from '../types/audio';
import { ThemePalette } from '../themes/themes';

interface PartyBackdropProps {
  enabled: boolean;
  intensity: PartyIntensity;
  isPlaying: boolean;
  theme: ThemePalette;
  analysisFrameRef: React.MutableRefObject<AudioAnalysisFrame>;
}

export const PartyBackdrop: React.FC<PartyBackdropProps> = ({
  enabled,
  intensity,
  isPlaying,
  theme,
  analysisFrameRef,
}) => {
  const orbARef = useRef<HTMLDivElement | null>(null);
  const orbBRef = useRef<HTMLDivElement | null>(null);
  const orbCRef = useRef<HTMLDivElement | null>(null);
  const washRef = useRef<HTMLDivElement | null>(null);
  const hueStepRef = useRef(0);
  const prevBeatRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;
    let phase = 0;

    const intensityScale =
      intensity === 'subtle' ? 0.45 : intensity === 'club' ? 0.82 : 1.0;

    const animate = () => {
      const frame = analysisFrameRef.current;
      if (frame.isBeat && !prevBeatRef.current) {
        hueStepRef.current = (hueStepRef.current + 1) % 3;
      }
      prevBeatRef.current = frame.isBeat;

      phase += isPlaying ? 0.012 + frame.bass * 0.025 : 0.003;

      const beat = prefersReduced ? frame.bass * 0.35 : frame.beatEnvelope;
      const bass = frame.bass;
      const mid = frame.mid;
      const high = frame.high;

      const [c0, c1, c2] = theme.partyPalette;
      const activePrimary = hueStepRef.current === 0 ? c0 : hueStepRef.current === 1 ? c1 : c2;
      const activeSecondary = hueStepRef.current === 0 ? c1 : hueStepRef.current === 1 ? c2 : c0;

      if (orbARef.current) {
        const scaleA = 0.92 + bass * 0.48 + beat * 0.28 * intensityScale;
        const xA = Math.sin(phase * 0.7) * 8;
        const yA = Math.cos(phase * 0.5) * 6;
        orbARef.current.style.transform = `translate3d(${xA}%, ${yA}%, 0) scale(${scaleA})`;
        orbARef.current.style.opacity = String(
          Math.min(0.65, (0.14 + bass * 0.28 + beat * 0.24) * intensityScale)
        );
        orbARef.current.style.background = `radial-gradient(circle, ${activePrimary} 0%, transparent 68%)`;
      }

      if (orbBRef.current) {
        const scaleB = 0.9 + mid * 0.44 + beat * 0.18 * intensityScale;
        const xB = Math.cos(phase * 0.6) * 9;
        const yB = Math.sin(phase * 0.8) * 7;
        orbBRef.current.style.transform = `translate3d(${xB}%, ${yB}%, 0) scale(${scaleB})`;
        orbBRef.current.style.opacity = String(
          Math.min(0.58, (0.12 + mid * 0.26 + high * 0.18) * intensityScale)
        );
        orbBRef.current.style.background = `radial-gradient(circle, ${activeSecondary} 0%, transparent 70%)`;
      }

      if (orbCRef.current) {
        const scaleC = 0.85 + high * 0.5 + beat * 0.22 * intensityScale;
        orbCRef.current.style.transform = `translate3d(0, 0, 0) scale(${scaleC})`;
        orbCRef.current.style.opacity = String(
          Math.min(0.45, (0.08 + high * 0.28 + beat * 0.14) * intensityScale)
        );
        orbCRef.current.style.background = `radial-gradient(circle, ${c2} 0%, transparent 72%)`;
      }

      if (washRef.current) {
        const flashOpacity =
          intensity === 'dynamic'
            ? beat * 0.16
            : intensity === 'club'
              ? beat * 0.09
              : beat * 0.04;
        washRef.current.style.opacity = String(prefersReduced ? 0 : flashOpacity);
        washRef.current.style.background = `radial-gradient(circle at 50% 40%, ${activePrimary}, transparent 75%)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [analysisFrameRef, enabled, intensity, isPlaying, theme]);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div
        ref={orbARef}
        className="absolute -top-32 -left-24 h-[520px] w-[520px] rounded-full will-change-transform"
        style={{ filter: 'blur(90px)' }}
      />
      <div
        ref={orbBRef}
        className="absolute -bottom-36 -right-24 h-[560px] w-[560px] rounded-full will-change-transform"
        style={{ filter: 'blur(100px)' }}
      />
      <div
        ref={orbCRef}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full will-change-transform"
        style={{ filter: 'blur(110px)' }}
      />
      <div
        ref={washRef}
        className="absolute inset-0 will-change-opacity"
      />
    </div>
  );
};
