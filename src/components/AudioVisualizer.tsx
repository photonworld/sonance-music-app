import React, { useEffect, useRef } from 'react';
import { AudioAnalysisFrame, ConcreteVisualizerStyle, Track, VisualizerMode } from '../types/audio';
import { ThemePalette } from '../themes/themes';

interface AudioVisualizerProps {
  mode: VisualizerMode;
  currentTrack: Track | null;
  isPlaying: boolean;
  theme: ThemePalette;
  analysisFrameRef: React.MutableRefObject<AudioAnalysisFrame>;
  onResolvedStyleChange?: (style: ConcreteVisualizerStyle) => void;
}

export function resolveMusicStyleVisualizer(
  mode: VisualizerMode,
  track: Track | null,
  centroid: number
): ConcreteVisualizerStyle {
  if (mode !== 'auto') return mode;
  const g = (track?.genre ?? '').toLowerCase();
  if (g.includes('edm') || g.includes('dance') || g.includes('club') || g.includes('techno') || g.includes('house')) {
    return 'kinetic';
  }
  if (g.includes('electronic') || g.includes('synth') || g.includes('pop') || g.includes('hip')) {
    return 'spectrum';
  }
  if (g.includes('ambient') || g.includes('chill') || g.includes('lo-fi') || g.includes('lofi')) {
    return 'radial';
  }
  if (g.includes('jazz') || g.includes('classical') || g.includes('rock') || g.includes('blues')) {
    return 'analog';
  }
  if (g.includes('acoustic') || g.includes('folk') || g.includes('indie') || g.includes('vocal')) {
    return 'waveform';
  }
  // Fallback using live spectral centroid
  if (centroid > 0.55) return 'spectrum';
  if (centroid < 0.25) return 'radial';
  return 'waveform';
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  mode,
  currentTrack,
  isPlaying,
  theme,
  analysisFrameRef,
  onResolvedStyleChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const peaksRef = useRef<Float32Array>(new Float32Array(64));
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; r: number }>>([]);
  const lastResolvedRef = useRef<ConcreteVisualizerStyle>('spectrum');

  useEffect(() => {
    // Seed deterministic initial particles for Kinetic mode
    if (particlesRef.current.length === 0) {
      const arr = [];
      for (let i = 0; i < 42; i++) {
        const angle = (i / 42) * Math.PI * 2;
        const dist = 0.18 + ((i * 37) % 100) / 140;
        arr.push({
          x: 0.5 + Math.cos(angle) * dist * 0.42,
          y: 0.5 + Math.sin(angle) * dist * 0.38,
          vx: Math.cos(angle + 1.2) * 0.0012,
          vy: Math.sin(angle + 1.2) * 0.0012,
          r: 2 + (i % 4),
        });
      }
      particlesRef.current = arr;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;
    let phase = 0;

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const frame = analysisFrameRef.current;
      const activeStyle = resolveMusicStyleVisualizer(mode, currentTrack, frame.spectralCentroid);
      if (activeStyle !== lastResolvedRef.current) {
        lastResolvedRef.current = activeStyle;
        onResolvedStyleChange?.(activeStyle);
      }

      phase += isPlaying ? (prefersReduced ? 0.005 : 0.025) : 0.004;

      const accent = theme.accent;
      const secondary = theme.visSecondary;
      const muted = theme.textMuted;
      const primary = theme.textPrimary;

      if (activeStyle === 'spectrum') {
        const barCount = Math.min(56, Math.max(24, Math.floor(width / 12)));
        const gap = 4;
        const barWidth = Math.max(2, (width - gap * (barCount - 1)) / barCount);
        const peaks = peaksRef.current;

        for (let i = 0; i < barCount; i++) {
          // Logarithmic frequency bin mapping
          const logNorm = Math.pow(i / barCount, 1.55);
          const binIdx = Math.min(
            frame.frequencyData.length - 1,
            Math.floor(logNorm * (frame.frequencyData.length * 0.55))
          );
          const rawVal = frame.frequencyData[binIdx] / 255;
          const idleRipple = !isPlaying ? 0.04 + 0.02 * Math.sin(phase + i * 0.25) : 0;
          const mag = Math.max(idleRipple, rawVal);

          if (mag > peaks[i]) {
            peaks[i] = mag;
          } else {
            peaks[i] = Math.max(mag, peaks[i] - 0.012);
          }

          const barH = Math.max(3, mag * (height * 0.82));
          const x = i * (barWidth + gap);
          const y = height - barH - 8;

          ctx.fillStyle = i < barCount * 0.35 ? accent : secondary;
          ctx.globalAlpha = 0.25 + mag * 0.75;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barH, Math.min(3, barWidth / 2));
          ctx.fill();

          // Peak cap
          const peakY = height - Math.max(3, peaks[i] * (height * 0.82)) - 12;
          ctx.fillStyle = primary;
          ctx.globalAlpha = 0.45;
          ctx.fillRect(x, peakY, barWidth, 2);
        }
        ctx.globalAlpha = 1;
      } else if (activeStyle === 'waveform') {
        const td = frame.timeDomainData;
        const slices = 96;
        const midY = height / 2;

        // Subtle baseline
        ctx.strokeStyle = theme.hairline;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();

        // Secondary harmonic shadow ribbon
        ctx.strokeStyle = secondary;
        ctx.globalAlpha = 0.42;
        ctx.lineWidth = 1.75;
        ctx.beginPath();
        for (let i = 0; i <= slices; i++) {
          const idx = Math.floor((i / slices) * (td.length - 1));
          const sample = isPlaying ? (td[idx] - 128) / 128 : Math.sin(phase + i * 0.14) * 0.05;
          const x = (i / slices) * width;
          const y = midY + sample * (height * 0.34) + Math.cos(phase + i * 0.1) * 4;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Primary crisp waveform
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let i = 0; i <= slices; i++) {
          const idx = Math.floor((i / slices) * (td.length - 1));
          const sample = isPlaying ? (td[idx] - 128) / 128 : Math.sin(phase + i * 0.14) * 0.03;
          const x = (i / slices) * width;
          const y = midY + sample * (height * 0.42);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (activeStyle === 'radial') {
        const cx = width / 2;
        const cy = height / 2;
        const maxR = Math.min(width, height) * 0.42;
        const rings = 4;

        for (let r = 0; r < rings; r++) {
          const energy = r === 0 ? frame.bass : r === 1 ? frame.mid : r === 2 ? frame.high : frame.rms;
          const baseRadius = maxR * (0.28 + r * 0.21) + (isPlaying ? energy * 18 : Math.sin(phase + r) * 3);

          ctx.strokeStyle = r % 2 === 0 ? accent : secondary;
          ctx.globalAlpha = 0.28 + energy * 0.65;
          ctx.lineWidth = r === 0 ? 2.5 : 1.5;
          ctx.beginPath();

          const points = 64;
          for (let p = 0; p <= points; p++) {
            const angle = (p / points) * Math.PI * 2;
            const bin = Math.floor(((p % 32) / 32) * (frame.frequencyData.length * 0.25));
            const freqBoost = isPlaying ? (frame.frequencyData[bin] / 255) * 14 : 0;
            const rad = baseRadius + freqBoost * (1 - r * 0.15);
            const x = cx + Math.cos(angle + phase * (r % 2 === 0 ? 0.4 : -0.3)) * rad;
            const y = cy + Math.sin(angle + phase * (r % 2 === 0 ? 0.4 : -0.3)) * rad;
            if (p === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (activeStyle === 'analog') {
        // Dual studio VU arcs + stereo phase vector
        const leftCx = width * 0.27;
        const rightCx = width * 0.73;
        const cy = height * 0.78;
        const radius = Math.min(width * 0.22, height * 0.62);

        const drawVu = (cx: number, level: number, label: string) => {
          ctx.strokeStyle = theme.hairline;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, Math.PI * 1.18, Math.PI * 1.82);
          ctx.stroke();

          // Redline zone
          ctx.strokeStyle = accent;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, Math.PI * 1.66, Math.PI * 1.82);
          ctx.stroke();

          // Needle
          const clamped = Math.min(1, Math.max(0, level));
          const angle = Math.PI * (1.18 + clamped * 0.64);
          ctx.strokeStyle = primary;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(angle) * (radius - 6), cy + Math.sin(angle) * (radius - 6));
          ctx.stroke();

          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = muted;
          ctx.font = '500 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(label, cx, cy - radius * 0.38);
        };

        const leftLevel = isPlaying ? Math.min(1, frame.bass * 0.7 + frame.rms * 0.5) : 0.05;
        const rightLevel = isPlaying ? Math.min(1, frame.mid * 0.65 + frame.high * 0.55) : 0.05;
        drawVu(leftCx, leftLevel, 'CH L');
        drawVu(rightCx, rightLevel, 'CH R');

        // Center Lissajous phase trace
        const midX = width * 0.5;
        const midY = height * 0.48;
        const scopeR = Math.min(width * 0.12, height * 0.34);
        ctx.strokeStyle = secondary;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const td = frame.timeDomainData;
        for (let i = 0; i < 96; i++) {
          const a = (td[i * 4] - 128) / 128;
          const b = (td[(i * 4 + 16) % td.length] - 128) / 128;
          const x = midX + (isPlaying ? a * scopeR * 1.6 : Math.cos(phase + i * 0.1) * scopeR * 0.25);
          const y = midY + (isPlaying ? b * scopeR * 1.6 : Math.sin(phase * 1.2 + i * 0.1) * scopeR * 0.25);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        // Kinetic frequency lattice
        const particles = particlesRef.current;
        const speedBoost = isPlaying ? 1 + frame.bass * 3.2 + frame.beatEnvelope * 2.8 : 0.35;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (!prefersReduced) {
            p.x += p.vx * speedBoost;
            p.y += p.vy * speedBoost;
            if (p.x < 0.05 || p.x > 0.95) p.vx *= -1;
            if (p.y < 0.08 || p.y > 0.92) p.vy *= -1;
          }
          const px = p.x * width;
          const py = p.y * height;

          // Connect nearby nodes
          for (let j = i + 1; j < particles.length; j++) {
            const q = particles[j];
            const qx = q.x * width;
            const qy = q.y * height;
            const dist = Math.hypot(px - qx, py - qy);
            if (dist < 110) {
              ctx.strokeStyle = i % 2 === 0 ? accent : secondary;
              ctx.globalAlpha = (1 - dist / 110) * (0.16 + frame.beatEnvelope * 0.45);
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(qx, qy);
              ctx.stroke();
            }
          }

          const radius = p.r * (1 + frame.beatEnvelope * 0.85);
          ctx.fillStyle = i % 3 === 0 ? accent : primary;
          ctx.globalAlpha = 0.45 + frame.rms * 0.55;
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [analysisFrameRef, currentTrack, isPlaying, mode, onResolvedStyleChange, theme]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      aria-label="Real-time music visualization"
    />
  );
};
