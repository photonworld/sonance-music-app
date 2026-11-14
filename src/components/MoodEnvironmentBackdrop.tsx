import React, { useEffect, useRef, useState } from 'react';
import { ThemePalette } from '../themes/themes';
import { AudioAnalysisFrame, Track } from '../types/audio';

export type MoodEnvironmentType =
  | 'water'
  | 'rain'
  | 'warmth'
  | 'aurora'
  | 'forest'
  | 'energy';

export function resolveMoodEnvironment(
  hint?: string | null,
  track?: Track | null
): MoodEnvironmentType {
  const combined = `${hint || ''} ${track?.genre || ''} ${track?.title || ''} ${track?.album || ''}`
    .toLowerCase()
    .trim();

  if (!combined) return 'aurora';

  // Rain & Deep Sleep
  if (
    /\b(sleep-rain|sleep|rain|rainy|lullaby|delta|drizzle|storm|thunder|nocturnal)\b/.test(
      combined
    )
  ) {
    return 'rain';
  }

  // Meditation & Zen Water/River
  if (
    /\b(meditation-zen|meditation|zen|tibetan|river|water|mindful|chakra|bowl|spa)\b/.test(
      combined
    )
  ) {
    return 'water';
  }

  // Nature & Forest
  if (
    /\b(nature-ocean|nature|forest|trees|woodland|waterfall|emerald|breeze|jungle|ocean waves)\b/.test(
      combined
    )
  ) {
    return 'forest';
  }

  // High-Intensity Workout & Energy
  if (
    /\b(workout-bass|workout|energy|gym|phonk|bass|trap|edm|club|party|cardio|fitness|dubstep|drum|metal|techno|rave|dance)\b/.test(
      combined
    )
  ) {
    return 'energy';
  }

  // Warmth, Cozy, Campfire, Fireworks & Acoustic/Lofi
  if (
    /\b(lofi-chillhop|morning-yoga|romantic-acoustic|warmth|cozy|campfire|firework|fire|ember|candle|sunrise|sunset|romantic|acoustic|lofi|chillhop|folk|soul|jazz|chill)\b/.test(
      combined
    )
  ) {
    return 'warmth';
  }

  // Focus, Study & Coding Aurora
  return 'aurora';
}

interface CanvasLayerItem {
  id: number;
  env: MoodEnvironmentType;
  visible: boolean;
}

interface MoodEnvironmentBackdropProps {
  environment: MoodEnvironmentType;
  theme: ThemePalette;
  isPlaying: boolean;
  partyMode?: boolean;
  analysisFrameRef: React.MutableRefObject<AudioAnalysisFrame>;
  showGlassScrim?: boolean;
}

interface EnvironmentCanvasProps {
  environment: MoodEnvironmentType;
  isPlaying: boolean;
  isDark: boolean;
  visible: boolean;
  analysisFrameRef: React.MutableRefObject<AudioAnalysisFrame>;
}

const EnvironmentCanvas: React.FC<EnvironmentCanvasProps> = ({
  environment,
  isPlaying,
  isDark,
  visible,
  analysisFrameRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;
    let disposed = false;
    let isPageHidden = document.hidden;

    let width = 1;
    let height = 1;

    const resize = () => {
      const vw = window.innerWidth || 1024;
      const vh = window.innerHeight || 768;
      // Full crisp resolution up to 1.5x DPR so ripples, raindrops & embers look razor-sharp
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(360, Math.floor(vw * scale));
      height = Math.max(260, Math.floor(vh * scale));
      canvas.width = width;
      canvas.height = height;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Seed deterministic particles per scene
    const orbs = Array.from({ length: 28 }, (_, i) => ({
      x: ((i * 73) % 100) / 100,
      y: ((i * 41) % 100) / 100,
      r: 28 + (i % 5) * 18,
      speedX: (i % 2 === 0 ? 1 : -1) * (0.00028 + (i % 4) * 0.0001),
      speedY: -0.0003 - (i % 3) * 0.00012,
      phase: i * 0.85,
    }));

    const raindrops = Array.from({ length: 145 }, (_, i) => ({
      x: ((i * 37) % 100) / 100,
      y: ((i * 59) % 100) / 100,
      len: 26 + (i % 6) * 12,
      speed: 0.013 + (i % 6) * 0.0032,
      alpha: 0.42 + (i % 4) * 0.14,
      width: i % 4 === 0 ? 2.4 : 1.5,
      drift: -0.0018,
    }));

    const ripples = Array.from({ length: 13 }, (_, i) => ({
      x: ((i * 29 + 11) % 88 + 6) / 100,
      y: ((i * 47 + 19) % 76 + 12) / 100,
      progress: (i * 0.077) % 1,
      speed: 0.0052 + (i % 3) * 0.0016,
      maxR: 72 + (i % 4) * 28,
    }));

    const embers = Array.from({ length: 84 }, (_, i) => ({
      x: ((i * 31 + 7) % 100) / 100,
      y: ((i * 53) % 100) / 100,
      size: 2.4 + (i % 4) * 1.35,
      speedY: -0.0022 - (i % 5) * 0.00075,
      swayAmp: 0.012 + (i % 3) * 0.006,
      phase: i * 0.7,
      isGold: i % 3 !== 0,
    }));

    const dust = Array.from({ length: 56 }, (_, i) => ({
      x: ((i * 43 + 9) % 100) / 100,
      y: ((i * 67 + 3) % 100) / 100,
      size: 2.2 + (i % 3) * 1.4,
      speedX: (i % 2 === 0 ? 1 : -1) * (0.00036 + (i % 4) * 0.00012),
      speedY: -0.00028 - (i % 3) * 0.0001,
      phase: i * 1.1,
      diamond: i % 3 === 0,
    }));

    const fireflies = Array.from({ length: 50 }, (_, i) => ({
      x: ((i * 39 + 13) % 100) / 100,
      y: ((i * 61 + 7) % 100) / 100,
      r: 3.0 + (i % 3) * 1.5,
      vx: (i % 2 === 0 ? 1 : -1) * (0.00046 + (i % 4) * 0.00015),
      vy: (i % 3 === 0 ? 1 : -1) * (0.00032 + (i % 5) * 0.00012),
      phase: i * 0.9,
    }));

    const shockwaves = Array.from({ length: 6 }, (_, i) => ({
      progress: i / 6,
    }));

    let t = 0;

    const drawWater = (dt: number) => {
      const dark = isDarkRef.current;
      const bg = ctx.createLinearGradient(0, 0, width, height);
      if (dark) {
        bg.addColorStop(0, '#022c2e');
        bg.addColorStop(0.48, '#0369a1');
        bg.addColorStop(1, '#082f49');
      } else {
        bg.addColorStop(0, '#2dd4bf');
        bg.addColorStop(0.5, '#0ea5e9');
        bg.addColorStop(1, '#38bdf8');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Sunlit underwater caustic waves with crisp luminous crest lines
      for (let band = 0; band < 5; band++) {
        ctx.beginPath();
        const baseY = height * (0.14 + band * 0.17);
        ctx.moveTo(0, baseY);
        for (let x = 0; x <= width; x += 20) {
          const nx = x / width;
          const wave =
            Math.sin(nx * 5.4 + t * 1.15 + band * 1.3) * 30 +
            Math.cos(nx * 8.6 - t * 0.8 + band) * 16;
          ctx.lineTo(x, baseY + wave);
        }
        ctx.strokeStyle = dark
          ? 'rgba(153, 246, 228, 0.38)'
          : 'rgba(255, 255, 255, 0.62)';
        ctx.lineWidth = 2.0;
        ctx.stroke();

        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, baseY - 30, 0, baseY + 150);
        grad.addColorStop(
          0,
          dark ? 'rgba(45, 212, 191, 0.34)' : 'rgba(255, 255, 255, 0.44)'
        );
        grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Shimmering concentric river ripples
      for (const rip of ripples) {
        rip.progress += rip.speed * dt;
        if (rip.progress >= 1) {
          rip.progress = 0;
          rip.x = (rip.x + 0.37) % 0.84 + 0.08;
          rip.y = (rip.y + 0.29) % 0.72 + 0.14;
        }
        const alpha = Math.sin(rip.progress * Math.PI) * (dark ? 0.72 : 0.86);
        const radius = rip.maxR * (0.22 + rip.progress * 1.55);

        ctx.beginPath();
        ctx.ellipse(
          rip.x * width,
          rip.y * height,
          radius * 1.4,
          radius * 0.62,
          0,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = dark
          ? `rgba(165, 243, 252, ${alpha})`
          : `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 2.6;
        ctx.stroke();

        // Inner echo ripple
        if (rip.progress > 0.18) {
          ctx.beginPath();
          ctx.ellipse(
            rip.x * width,
            rip.y * height,
            radius * 0.92,
            radius * 0.41,
            0,
            0,
            Math.PI * 2
          );
          ctx.strokeStyle = dark
            ? `rgba(94, 234, 212, ${alpha * 0.7})`
            : `rgba(224, 242, 254, ${alpha * 0.82})`;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }

      // Luminous floating sunlit orbs
      for (const orb of orbs) {
        orb.x = (orb.x + orb.speedX * dt + 1) % 1;
        orb.y = (orb.y + orb.speedY * dt + 1) % 1;
        const px = orb.x * width;
        const py = orb.y * height;
        const pulse = 0.8 + 0.24 * Math.sin(t * 1.6 + orb.phase);
        const grad = ctx.createRadialGradient(px, py, 0, px, py, orb.r * pulse);
        grad.addColorStop(
          0,
          dark ? 'rgba(254, 249, 195, 0.56)' : 'rgba(255, 255, 255, 0.88)'
        );
        grad.addColorStop(0.5, 'rgba(45, 212, 191, 0.32)');
        grad.addColorStop(1, 'rgba(45, 212, 191, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, orb.r * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawRain = (dt: number) => {
      const dark = isDarkRef.current;
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      if (dark) {
        bg.addColorStop(0, '#05081a');
        bg.addColorStop(0.5, '#172554');
        bg.addColorStop(1, '#312e81');
      } else {
        bg.addColorStop(0, '#475569');
        bg.addColorStop(0.45, '#4f46e5');
        bg.addColorStop(1, '#2563eb');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Luminous atmospheric mist pools
      for (let i = 0; i < 3; i++) {
        const mx = width * (0.2 + i * 0.3 + Math.sin(t * 0.28 + i) * 0.08);
        const my = height * (0.34 + (i % 2) * 0.3);
        const mr = Math.max(width, height) * 0.48;
        const mist = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
        mist.addColorStop(
          0,
          dark ? 'rgba(129, 140, 248, 0.38)' : 'rgba(199, 210, 254, 0.56)'
        );
        mist.addColorStop(1, 'rgba(79, 70, 229, 0)');
        ctx.fillStyle = mist;
        ctx.fillRect(0, 0, width, height);
      }

      // Crisp falling atmospheric rain streaks + bright droplet heads
      ctx.lineCap = 'round';
      for (const drop of raindrops) {
        drop.x = (drop.x + drop.drift * dt + 1) % 1;
        drop.y = (drop.y + drop.speed * dt) % 1;
        const x1 = drop.x * width;
        const y1 = drop.y * height;
        const x2 = x1 - drop.len * 0.17;
        const y2 = y1 + drop.len;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = dark
          ? `rgba(224, 231, 255, ${Math.min(0.92, drop.alpha * 1.15)})`
          : `rgba(255, 255, 255, ${Math.min(0.95, drop.alpha * 1.45)})`;
        ctx.lineWidth = drop.width;
        ctx.stroke();

        // Droplet tip highlight
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.95, drop.alpha * 1.3)})`;
        ctx.beginPath();
        ctx.arc(x2, y2, drop.width * 0.72, 0, Math.PI * 2);
        ctx.fill();
      }

      // Expanding puddle ripple rings
      for (const rip of ripples) {
        rip.progress += rip.speed * 1.2 * dt;
        if (rip.progress >= 1) {
          rip.progress = 0;
          rip.x = (rip.x + 0.41) % 0.84 + 0.08;
          rip.y = (rip.y + 0.31) % 0.48 + 0.45;
        }
        const alpha = (1 - rip.progress) * (dark ? 0.68 : 0.8);
        const radius = 12 + rip.progress * rip.maxR;
        ctx.beginPath();
        ctx.ellipse(
          rip.x * width,
          rip.y * height,
          radius * 1.6,
          radius * 0.46,
          0,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = dark
          ? `rgba(199, 210, 254, ${alpha})`
          : `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 2.0;
        ctx.stroke();
      }
    };

    const drawWarmth = (dt: number) => {
      const dark = isDarkRef.current;
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      if (dark) {
        bg.addColorStop(0, '#2a0a04');
        bg.addColorStop(0.5, '#6b1d08');
        bg.addColorStop(1, '#b45309');
      } else {
        bg.addColorStop(0, '#fdba74');
        bg.addColorStop(0.48, '#fb923c');
        bg.addColorStop(1, '#dc2626');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Flickering amber campfire hearth glow
      const flicker = 0.88 + 0.14 * Math.sin(t * 4.2) * Math.cos(t * 2.5);
      const glowA = ctx.createRadialGradient(
        width * 0.5,
        height * 0.96,
        0,
        width * 0.5,
        height * 0.82,
        Math.max(width, height) * 0.86 * flicker
      );
      glowA.addColorStop(
        0,
        dark ? 'rgba(254, 240, 138, 0.72)' : 'rgba(254, 249, 195, 0.82)'
      );
      glowA.addColorStop(
        0.42,
        dark ? 'rgba(249, 115, 22, 0.46)' : 'rgba(249, 115, 22, 0.52)'
      );
      glowA.addColorStop(1, 'rgba(234, 88, 12, 0)');
      ctx.fillStyle = glowA;
      ctx.fillRect(0, 0, width, height);

      // Rising glowing golden embers + fiery spark trails
      for (const emb of embers) {
        emb.y = (emb.y + emb.speedY * dt + 1) % 1;
        const px = ((emb.x + Math.sin(t * 1.5 + emb.phase) * emb.swayAmp + 1) % 1) * width;
        const py = emb.y * height;
        const glow = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 4.2 + emb.phase));
        const r = emb.size * (3.4 + glow * 2.8);

        // Soft vertical spark wake
        ctx.strokeStyle = `rgba(253, 186, 116, ${0.42 * glow})`;
        ctx.lineWidth = emb.size * 0.75;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(t * 2 + emb.phase) * 3, py + emb.size * 6.5);
        ctx.stroke();

        const rad = ctx.createRadialGradient(px, py, 0, px, py, r);
        rad.addColorStop(
          0,
          emb.isGold
            ? `rgba(255, 255, 220, ${Math.min(1, glow)})`
            : `rgba(253, 186, 116, ${0.95 * glow})`
        );
        rad.addColorStop(0.45, `rgba(249, 115, 22, ${0.6 * glow})`);
        rad.addColorStop(1, 'rgba(249, 115, 22, 0)');
        ctx.fillStyle = rad;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawAurora = (dt: number) => {
      const dark = isDarkRef.current;
      const bg = ctx.createLinearGradient(0, 0, width, height);
      if (dark) {
        bg.addColorStop(0, '#020617');
        bg.addColorStop(0.48, '#0f172a');
        bg.addColorStop(1, '#2e1065');
      } else {
        bg.addColorStop(0, '#38bdf8');
        bg.addColorStop(0.5, '#8b5cf6');
        bg.addColorStop(1, '#14b8a6');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Flowing vivid aurora wave curtains with bright crest strokes
      const ribbons = [
        {
          y: 0.22,
          amp: 64,
          freq: 2.3,
          speed: 0.62,
          color: dark ? 'rgba(56, 189, 248, 0.48)' : 'rgba(255, 255, 255, 0.48)',
          edge: dark ? 'rgba(125, 211, 252, 0.65)' : 'rgba(255, 255, 255, 0.72)',
        },
        {
          y: 0.44,
          amp: 74,
          freq: 1.9,
          speed: -0.48,
          color: dark ? 'rgba(168, 85, 247, 0.44)' : 'rgba(221, 214, 254, 0.5)',
          edge: dark ? 'rgba(216, 180, 254, 0.6)' : 'rgba(245, 243, 255, 0.72)',
        },
        {
          y: 0.66,
          amp: 54,
          freq: 2.7,
          speed: 0.42,
          color: dark ? 'rgba(45, 212, 191, 0.38)' : 'rgba(153, 246, 228, 0.44)',
          edge: dark ? 'rgba(94, 234, 212, 0.55)' : 'rgba(240, 253, 250, 0.68)',
        },
      ];

      for (const rib of ribbons) {
        ctx.beginPath();
        ctx.moveTo(0, height * rib.y);
        for (let x = 0; x <= width; x += 20) {
          const nx = x / width;
          const yOff =
            Math.sin(nx * rib.freq * Math.PI + t * rib.speed) * rib.amp +
            Math.cos(nx * 4.1 - t * rib.speed * 0.7) * (rib.amp * 0.36);
          ctx.lineTo(x, height * rib.y + yOff);
        }
        ctx.strokeStyle = rib.edge;
        ctx.lineWidth = 2.0;
        ctx.stroke();

        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, height * rib.y - 90, 0, height * rib.y + 200);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.32, rib.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Floating geometric dust particles
      for (const p of dust) {
        p.x = (p.x + p.speedX * dt + 1) % 1;
        p.y = (p.y + p.speedY * dt + 1) % 1;
        const px = p.x * width;
        const py = p.y * height;
        const alpha = 0.5 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.7 + p.phase));
        ctx.fillStyle = dark
          ? `rgba(224, 242, 254, ${alpha})`
          : `rgba(255, 255, 255, ${Math.min(0.95, alpha * 1.15)})`;

        if (p.diamond) {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(Math.PI / 4 + t * 0.28);
          ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(px, py, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const drawForest = (dt: number) => {
      const dark = isDarkRef.current;
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      if (dark) {
        bg.addColorStop(0, '#022c22');
        bg.addColorStop(0.5, '#047857');
        bg.addColorStop(1, '#022c22');
      } else {
        bg.addColorStop(0, '#34d399');
        bg.addColorStop(0.52, '#10b981');
        bg.addColorStop(1, '#059669');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Vivid swaying sunlit emerald rays
      for (let i = 0; i < 4; i++) {
        const sway = Math.sin(t * 0.48 + i * 1.4) * (width * 0.06);
        const topX = width * (0.14 + i * 0.24) + sway;
        const botX = topX + width * 0.18;
        const beamGrad = ctx.createLinearGradient(topX, 0, botX, height);
        beamGrad.addColorStop(
          0,
          dark ? 'rgba(110, 231, 183, 0.44)' : 'rgba(255, 255, 255, 0.56)'
        );
        beamGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(topX - 34, 0);
        ctx.lineTo(topX + 54, 0);
        ctx.lineTo(botX + 112, height);
        ctx.lineTo(botX - 62, height);
        ctx.closePath();
        ctx.fill();
      }

      // Bright drifting forest fireflies
      for (const ff of fireflies) {
        ff.x = (ff.x + ff.vx * dt + Math.sin(t * 0.7 + ff.phase) * 0.00022 + 1) % 1;
        ff.y = (ff.y + ff.vy * dt + Math.cos(t * 0.6 + ff.phase) * 0.00022 + 1) % 1;
        const px = ff.x * width;
        const py = ff.y * height;
        const glow = 0.42 + 0.58 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.5 + ff.phase), 2);
        const r = ff.r * 6.2;
        const rad = ctx.createRadialGradient(px, py, 0, px, py, r);
        rad.addColorStop(0, `rgba(255, 255, 240, ${Math.min(1, glow * 1.05)})`);
        rad.addColorStop(0.45, `rgba(163, 230, 53, ${0.65 * glow})`);
        rad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        ctx.fillStyle = rad;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawEnergy = (dt: number) => {
      const dark = isDarkRef.current;
      const frame = analysisFrameRef.current;
      const playing = isPlayingRef.current;
      const bass = playing ? Math.max(0.22, frame.bass) : 0.2 + 0.07 * Math.sin(t * 1.8);
      const mid = playing ? Math.max(0.18, frame.mid) : 0.18;
      const beat = playing ? frame.beatEnvelope : 0.16;

      const bg = ctx.createLinearGradient(0, 0, width, height);
      if (dark) {
        bg.addColorStop(0, '#3b0764');
        bg.addColorStop(0.5, '#881337');
        bg.addColorStop(1, '#311042');
      } else {
        bg.addColorStop(0, '#fb7185');
        bg.addColorStop(0.5, '#d946ef');
        bg.addColorStop(1, '#7c3aed');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Bass-reactive central crimson/violet aura wash
      const centerGlow = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        0,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * (0.52 + bass * 0.36)
      );
      centerGlow.addColorStop(
        0,
        `rgba(244, 63, 94, ${0.46 + beat * 0.34})`
      );
      centerGlow.addColorStop(
        0.5,
        `rgba(168, 85, 247, ${0.32 + mid * 0.26})`
      );
      centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, width, height);

      // Expanding pulse shockwave rings
      for (const sw of shockwaves) {
        sw.progress = (sw.progress + (0.0052 + bass * 0.015) * dt) % 1;
        const maxRad = Math.hypot(width, height) * 0.6;
        const r = 24 + sw.progress * maxRad;
        const alpha = (1 - sw.progress) * (0.52 + beat * 0.42);
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.5, r, 0, Math.PI * 2);
        ctx.strokeStyle =
          sw.progress % 0.4 < 0.2
            ? `rgba(255, 228, 230, ${alpha})`
            : `rgba(233, 213, 255, ${alpha})`;
        ctx.lineWidth = 2.6 + beat * 2.8;
        ctx.stroke();
      }

      // Dual harmonic neon pulse waves
      for (let w = 0; w < 2; w++) {
        ctx.beginPath();
        const baseY = height * (w === 0 ? 0.44 : 0.58);
        for (let x = 0; x <= width; x += 16) {
          const nx = x / width;
          const amp = (38 + bass * 78) * (w === 0 ? 1 : -0.85);
          const y =
            baseY +
            Math.sin(nx * 6.5 + t * (1.8 + w * 0.6)) * amp +
            Math.cos(nx * 11 - t * 2.1) * (14 + mid * 28);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle =
          w === 0
            ? `rgba(255, 241, 242, ${0.62 + beat * 0.34})`
            : `rgba(243, 232, 255, ${0.56 + mid * 0.34})`;
        ctx.lineWidth = 3.2;
        ctx.stroke();
      }
    };

    let lastTimestamp = performance.now();

    const renderFrame = (now: number) => {
      if (disposed || isPageHidden) return;
      const elapsed = Math.min(48, Math.max(8, now - lastTimestamp));
      lastTimestamp = now;
      const dt = (elapsed / 16.667) * (isPlayingRef.current ? 1 : 0.5);
      t += 0.016 * dt;

      if (environment === 'water') drawWater(dt);
      else if (environment === 'rain') drawRain(dt);
      else if (environment === 'warmth') drawWarmth(dt);
      else if (environment === 'forest') drawForest(dt);
      else if (environment === 'energy') drawEnergy(dt);
      else drawAurora(dt);

      if (!prefersReducedMotion) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    const startLoop = () => {
      if (disposed || isPageHidden) return;
      cancelAnimationFrame(rafId);
      lastTimestamp = performance.now();
      rafId = requestAnimationFrame(renderFrame);
    };

    const handleVisibilityChange = () => {
      isPageHidden = document.hidden;
      if (isPageHidden) {
        cancelAnimationFrame(rafId);
      } else {
        startLoop();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startLoop();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [analysisFrameRef, environment]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 w-full h-full will-change-opacity"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 1.2s ease',
      }}
    />
  );
};

export const MoodEnvironmentBackdrop: React.FC<MoodEnvironmentBackdropProps> = ({
  environment,
  theme,
  isPlaying,
  partyMode = false,
  analysisFrameRef,
  showGlassScrim = true,
}) => {
  const nextIdRef = useRef(1);
  const [layers, setLayers] = useState<CanvasLayerItem[]>([
    { id: 0, env: environment, visible: true },
  ]);

  useEffect(() => {
    setLayers((prev) => {
      const currentTop = prev[prev.length - 1];
      if (currentTop && currentTop.env === environment) {
        return prev;
      }
      const newId = nextIdRef.current++;
      return [
        ...prev.map((l) => ({ ...l, visible: false })),
        { id: newId, env: environment, visible: false },
      ];
    });
  }, [environment]);

  useEffect(() => {
    const top = layers[layers.length - 1];
    if (!top || top.visible) return;
    const raf = requestAnimationFrame(() => {
      setLayers((prev) =>
        prev.map((item, idx) =>
          idx === prev.length - 1 ? { ...item, visible: true } : item
        )
      );
    });
    return () => cancelAnimationFrame(raf);
  }, [layers]);

  useEffect(() => {
    if (layers.length <= 1) return;
    const timer = window.setTimeout(() => {
      setLayers((prev) => (prev.length > 1 ? [prev[prev.length - 1]] : prev));
    }, 1260);
    return () => window.clearTimeout(timer);
  }, [layers]);

  const isDark = theme.mode === 'dark';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        opacity: partyMode ? 0.72 : 1,
        transition: 'opacity 1.2s ease',
      }}
    >
      {layers.map((layer) => (
        <EnvironmentCanvas
          key={layer.id}
          environment={layer.env}
          isPlaying={isPlaying}
          isDark={isDark}
          visible={layer.visible}
          analysisFrameRef={analysisFrameRef}
        />
      ))}

      {showGlassScrim && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: isDark
              ? 'rgba(9, 9, 11, 0.14)'
              : 'rgba(255, 255, 255, 0.12)',
            transition: 'background-color 1.2s ease',
          }}
        />
      )}
    </div>
  );
};
