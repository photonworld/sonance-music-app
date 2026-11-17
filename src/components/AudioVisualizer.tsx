import React, { useEffect, useRef, useState } from 'react';
import { AudioAnalysisFrame, ConcreteVisualizerStyle, Track, VisualizerMode } from '../types/audio';
import { ThemePalette } from '../themes/themes';
import { GeometricFlowWebGLCanvas } from './GeometricFlowWebGLCanvas';
import { GlitchShiftWebGLCanvas } from './GlitchShiftWebGLCanvas';

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
  if (
    g.includes('glitch') ||
    g.includes('dubstep') ||
    g.includes('drum') ||
    g.includes('breakbeat') ||
    g.includes('industrial')
  ) {
    return 'glitch';
  }
  if (g.includes('trance') || g.includes('future') || g.includes('synthwave')) {
    return 'geometric';
  }
  if (g.includes('edm') || g.includes('dance') || g.includes('club') || g.includes('techno') || g.includes('house')) {
    return 'kinetic';
  }
  if (g.includes('synth') || g.includes('cyber') || g.includes('electro')) {
    return 'aurora';
  }
  if (g.includes('electronic') || g.includes('pop') || g.includes('hip')) {
    return 'spectrum';
  }
  if (g.includes('meditation') || g.includes('zen') || g.includes('new age')) {
    return 'cymatics';
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
  if (centroid > 0.62) return 'dna';
  if (centroid > 0.48) return 'spectrum';
  if (centroid < 0.25) return 'monsoon';
  return 'liquid';
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
  const lastResolvedRef = useRef<ConcreteVisualizerStyle>(
    resolveMusicStyleVisualizer(mode, currentTrack, 0.5)
  );
  const [resolvedStyle, setResolvedStyle] = useState<ConcreteVisualizerStyle>(() =>
    resolveMusicStyleVisualizer(mode, currentTrack, 0.5)
  );
  const isGeometricMode = mode === 'geometric' || resolvedStyle === 'geometric';
  const isGlitchMode = mode === 'glitch' || resolvedStyle === 'glitch';
  const isWebGLMode = isGeometricMode || isGlitchMode;

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
    const next = resolveMusicStyleVisualizer(mode, currentTrack, analysisFrameRef.current.spectralCentroid);
    lastResolvedRef.current = next;
    setResolvedStyle(next);
    onResolvedStyleChange?.(next);
  }, [analysisFrameRef, currentTrack, mode, onResolvedStyleChange]);

  useEffect(() => {
    if (isWebGLMode) return;
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
        setResolvedStyle(activeStyle);
        onResolvedStyleChange?.(activeStyle);
      }

      if (activeStyle === 'geometric' || activeStyle === 'glitch') {
        return;
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
      } else if (activeStyle === 'aurora') {
        // 1. Aurora Silk: layered bioluminescent curtains undulating to mid & bass
        const ribbons = 4;
        const slices = 72;
        for (let r = 0; r < ribbons; r++) {
          const baseY = height * (0.38 + r * 0.12);
          const amp = (14 + frame.bass * 36 + frame.mid * 28) * (1 - r * 0.14);
          const col = r % 2 === 0 ? accent : secondary;
          const grad = ctx.createLinearGradient(0, baseY - amp * 2, 0, height);
          grad.addColorStop(0, col);
          grad.addColorStop(1, 'transparent');

          ctx.beginPath();
          ctx.moveTo(0, height);
          for (let i = 0; i <= slices; i++) {
            const u = i / slices;
            const bin = Math.min(frame.frequencyData.length - 1, Math.floor(u * 140) + r * 8);
            const fMag = (frame.frequencyData[bin] || 0) / 255;
            const y =
              baseY +
              Math.sin(u * Math.PI * (2.6 + r * 0.6) + phase * (1.1 + r * 0.25)) * amp +
              Math.cos(u * Math.PI * 5 - phase * 0.8) * (fMag * 24);
            ctx.lineTo(u * width, y);
          }
          ctx.lineTo(width, height);
          ctx.closePath();

          ctx.globalAlpha = 0.22 + frame.beatEnvelope * 0.16;
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.strokeStyle = col;
          ctx.globalAlpha = 0.68 + frame.high * 0.28;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          for (let i = 0; i <= slices; i++) {
            const u = i / slices;
            const bin = Math.min(frame.frequencyData.length - 1, Math.floor(u * 140) + r * 8);
            const fMag = (frame.frequencyData[bin] || 0) / 255;
            const y =
              baseY +
              Math.sin(u * Math.PI * (2.6 + r * 0.6) + phase * (1.1 + r * 0.25)) * amp +
              Math.cos(u * Math.PI * 5 - phase * 0.8) * (fMag * 24);
            if (i === 0) ctx.moveTo(u * width, y);
            else ctx.lineTo(u * width, y);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (activeStyle === 'cymatics') {
        // 2. Cymatics Mandala: Chladni standing-wave star geometry vibrating to bass & treble
        const cx = width * 0.5;
        const cy = height * 0.5;
        const maxR = Math.min(width, height) * 0.44;
        const petals = 6 + Math.round(frame.spectralCentroid * 6);
        const rings = 5;

        for (let r = 1; r <= rings; r++) {
          const baseR = (r / rings) * maxR * (0.85 + frame.beatEnvelope * 0.2);
          ctx.beginPath();
          const steps = 96;
          for (let i = 0; i <= steps; i++) {
            const a = (i / steps) * Math.PI * 2;
            const harmonic =
              Math.sin(a * petals + phase * (r % 2 === 0 ? 1.3 : -1.1)) *
                (4 + frame.bass * 16 + frame.high * 12) +
              Math.cos(a * (petals / 2) - phase * 0.9) * (frame.mid * 10);
            const rad = Math.max(4, baseR + harmonic);
            const x = cx + Math.cos(a) * rad;
            const y = cy + Math.sin(a) * rad;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.strokeStyle = r % 2 === 0 ? accent : secondary;
          ctx.globalAlpha = 0.35 + (r / rings) * 0.55;
          ctx.lineWidth = r === rings ? 2.2 : 1.3;
          ctx.stroke();
        }

        // Nodal bright intersections
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.75 + frame.beatEnvelope * 0.25;
        ctx.beginPath();
        ctx.arc(cx, cy, 3 + frame.bass * 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (activeStyle === 'orbit') {
        // 3. Solar Orbit: planetary frequency rings with audio-driven orbiting moons
        const cx = width * 0.5;
        const cy = height * 0.5;
        const minDim = Math.min(width, height);
        const orbits = 5;

        // Luminous core sun
        const sunR = minDim * (0.07 + frame.bass * 0.055 + frame.beatEnvelope * 0.03);
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
        ctx.fill();

        for (let o = 1; o <= orbits; o++) {
          const rx = (width * 0.11 + o * width * 0.068) * (0.94 + frame.mid * 0.08);
          const ry = (minDim * 0.09 + o * minDim * 0.078) * (0.94 + frame.bass * 0.08);

          ctx.strokeStyle = theme.hairline;
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, (o - 3) * 0.14, 0, Math.PI * 2);
          ctx.stroke();

          const planetsOnRing = o % 2 === 0 ? 2 : 1;
          for (let p = 0; p < planetsOnRing; p++) {
            const ang = phase * (0.7 + (orbits - o) * 0.25) * (o % 2 === 0 ? 1 : -1) + p * Math.PI + o;
            const tilt = (o - 3) * 0.14;
            const ex = Math.cos(ang) * rx;
            const ey = Math.sin(ang) * ry;
            const px = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt);
            const py = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);

            const bin = (o * 19 + p * 7) % 128;
            const mag = (frame.frequencyData[bin] || 0) / 255;
            const planetR = 3 + mag * 6 + frame.beatEnvelope * 2.5;

            ctx.fillStyle = (o + p) % 2 === 0 ? accent : secondary;
            ctx.globalAlpha = 0.88;
            ctx.beginPath();
            ctx.arc(px, py, planetR, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      } else if (activeStyle === 'liquid') {
        // 4. Liquid Mirror: symmetrical chrome horizon waves above and below center line
        const barCount = Math.min(48, Math.max(22, Math.floor(width / 14)));
        const midY = height * 0.5;
        const maxAmp = height * 0.42;

        ctx.strokeStyle = theme.hairline;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();

        // Draw smooth mirrored upper + lower mountain silhouettes
        const drawMirrorCurve = (sign: number, col: string, alpha: number, phaseOffset: number) => {
          ctx.beginPath();
          ctx.moveTo(0, midY);
          for (let i = 0; i <= barCount; i++) {
            const u = i / barCount;
            const bin = Math.min(
              frame.frequencyData.length - 1,
              Math.floor(Math.pow(u, 1.35) * (frame.frequencyData.length * 0.45))
            );
            const mag = (frame.frequencyData[bin] || 0) / 255;
            const wave =
              (isPlaying ? mag * maxAmp : (0.08 + 0.05 * Math.sin(phase + i * 0.4)) * maxAmp) *
              (0.85 + 0.2 * Math.sin(phase * 1.4 + u * 6 + phaseOffset));
            const x = u * width;
            const y = midY + sign * Math.max(2, wave);
            if (i === 0) ctx.lineTo(x, y);
            else {
              const prevX = ((i - 1) / barCount) * width;
              ctx.quadraticCurveTo(prevX, y, x, y);
            }
          }
          ctx.lineTo(width, midY);
          ctx.closePath();
          ctx.fillStyle = col;
          ctx.globalAlpha = alpha;
          ctx.fill();
        };

        drawMirrorCurve(-1, accent, 0.72, 0);
        drawMirrorCurve(1, secondary, 0.46, 0.6);
        drawMirrorCurve(-0.62, primary, 0.28, 1.4);
        ctx.globalAlpha = 1;
      } else if (activeStyle === 'monsoon') {
        // 5. Monsoon Ink: drifting rain droplets & expanding water ripple rings
        const particles = particlesRef.current;
        const speed = isPlaying ? 1 + frame.bass * 2.5 + frame.beatEnvelope * 2.2 : 0.35;

        // Expanding water ripple rings in center
        for (let r = 0; r < 3; r++) {
          const prog = ((phase * 0.35 + r / 3) % 1);
          const rx = prog * width * 0.45;
          const ry = prog * height * 0.38;
          ctx.strokeStyle = r % 2 === 0 ? accent : secondary;
          ctx.globalAlpha = (1 - prog) * (0.28 + frame.mid * 0.55);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.ellipse(width * 0.5, height * 0.58, Math.max(4, rx), Math.max(2, ry), 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Diagonal rain streaks reacting to treble
        ctx.lineCap = 'round';
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (!prefersReduced) {
            p.x -= 0.0025 * speed;
            p.y += 0.014 * speed;
            if (p.y > 1.05) {
              p.y = -0.05;
              p.x = (i * 0.137 + phase * 0.07) % 1;
            }
            if (p.x < -0.05) p.x = 1.04;
          }
          const sx = p.x * width;
          const sy = p.y * height;
          const len = 10 + frame.high * 18 + (i % 3) * 4;
          ctx.strokeStyle = i % 2 === 0 ? accent : secondary;
          ctx.globalAlpha = 0.28 + frame.rms * 0.55;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - 4, sy + len);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (activeStyle === 'dna') {
        // 6. Helix DNA: 3D double-helix spectrum strands rotating at audio tempo
        const pairs = 28;
        const marginX = 20;
        const spanW = Math.max(40, width - marginX * 2);
        const cy = height * 0.5;
        const amp = height * (0.24 + frame.bass * 0.14 + frame.beatEnvelope * 0.08);
        const rotSpeed = phase * (1.35 + frame.mid * 0.9);

        for (let i = 0; i < pairs; i++) {
          const u = i / (pairs - 1);
          const x = marginX + u * spanW;
          const angle = u * Math.PI * 3.4 + rotSpeed;
          const bin = Math.min(frame.frequencyData.length - 1, Math.floor(u * 128));
          const mag = (frame.frequencyData[bin] || 0) / 255;

          const yA = cy + Math.sin(angle) * (amp * (0.75 + mag * 0.45));
          const yB = cy - Math.sin(angle) * (amp * (0.75 + mag * 0.45));
          const depth = Math.cos(angle); // -1..1 for 3D depth shading

          // Cross-rung connecting strand A and B
          ctx.strokeStyle = i % 2 === 0 ? accent : secondary;
          ctx.globalAlpha = 0.25 + mag * 0.55;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(x, yA);
          ctx.lineTo(x, yB);
          ctx.stroke();

          // Strand A nucleotide bead
          ctx.fillStyle = accent;
          ctx.globalAlpha = Math.max(0.25, 0.55 + depth * 0.4);
          ctx.beginPath();
          ctx.arc(x, yA, Math.max(2, 3.2 + depth * 1.4 + mag * 2), 0, Math.PI * 2);
          ctx.fill();

          // Strand B nucleotide bead
          ctx.fillStyle = secondary;
          ctx.globalAlpha = Math.max(0.25, 0.55 - depth * 0.4);
          ctx.beginPath();
          ctx.arc(x, yB, Math.max(2, 3.2 - depth * 1.4 + mag * 2), 0, Math.PI * 2);
          ctx.fill();
        }
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
  }, [analysisFrameRef, currentTrack, isPlaying, isWebGLMode, mode, onResolvedStyleChange, theme]);

  if (isGlitchMode) {
    return (
      <GlitchShiftWebGLCanvas
        variant="stage"
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        theme={theme}
        analysisFrameRef={analysisFrameRef}
      />
    );
  }

  if (isGeometricMode) {
    return (
      <GeometricFlowWebGLCanvas
        variant="stage"
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        theme={theme}
        analysisFrameRef={analysisFrameRef}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      aria-label="Real-time music visualization"
    />
  );
};
