import React, { useEffect, useRef } from 'react';
import { ThemePalette } from '../themes/themes';
import { AudioAnalysisFrame, QuantumVisualizerMode, Track } from '../types/audio';
import { MoodEnvironmentType } from './MoodEnvironmentBackdrop';

interface QuantumVisualizer3DProps {
  mode: QuantumVisualizerMode;
  currentTrack: Track | null;
  isPlaying: boolean;
  theme: ThemePalette;
  moodEnvironment?: MoodEnvironmentType;
  synthTargetBpm?: number | null;
  synthHarmonicIntensity?: number | null;
  analysisFrameRef: React.MutableRefObject<AudioAnalysisFrame>;
}

interface TunnelParticle {
  x: number;
  y: number;
  z: number;
  prevZ: number;
  size: number;
  hueShift: number;
  speedMul: number;
}

interface OrbitNode {
  theta: number;
  phi: number;
  radius: number;
  speed: number;
  size: number;
  hueShift: number;
}

interface ShockwaveRing {
  z: number;
  alpha: number;
  hueOffset: number;
}

interface WarpStar {
  x: number;
  y: number;
  z: number;
  prevZ: number;
  size: number;
  tint: number;
}

interface AdaptivePalette {
  bgTop: string;
  bgBottom: string;
  c1: [number, number, number];
  c2: [number, number, number];
  c3: [number, number, number];
}

function getAdaptivePalette(
  mood: MoodEnvironmentType | undefined,
  track: Track | null
): AdaptivePalette {
  const hint = `${mood || ''} ${track?.genre || ''} ${track?.title || ''}`.toLowerCase();

  if (/\b(water|meditation|zen|tibetan)\b/.test(hint)) {
    return {
      bgTop: '#03151e',
      bgBottom: '#062c3a',
      c1: [45, 212, 191],
      c2: [56, 189, 248],
      c3: [165, 243, 252],
    };
  }
  if (/\b(rain|sleep|nocturnal|lullaby)\b/.test(hint)) {
    return {
      bgTop: '#06081a',
      bgBottom: '#171c47',
      c1: [129, 140, 248],
      c2: [96, 165, 250],
      c3: [224, 231, 255],
    };
  }
  if (/\b(warmth|lofi|acoustic|folk|jazz|soul|romantic|sunrise)\b/.test(hint)) {
    return {
      bgTop: '#160906',
      bgBottom: '#35140c',
      c1: [251, 146, 60],
      c2: [244, 114, 182],
      c3: [254, 240, 138],
    };
  }
  if (/\b(forest|nature|ocean)\b/.test(hint)) {
    return {
      bgTop: '#021a14',
      bgBottom: '#063d2e',
      c1: [52, 211, 153],
      c2: [163, 230, 53],
      c3: [167, 243, 208],
    };
  }
  if (/\b(energy|workout|phonk|edm|dance|techno|bass|rock|club)\b/.test(hint)) {
    return {
      bgTop: '#160417',
      bgBottom: '#380828',
      c1: [244, 63, 94],
      c2: [192, 38, 211],
      c3: [56, 189, 248],
    };
  }
  // Quantum Aurora default
  return {
    bgTop: '#050818',
    bgBottom: '#131138',
    c1: [56, 189, 248],
    c2: [168, 85, 247],
    c3: [45, 212, 191],
  };
}

function rgba(rgb: [number, number, number], alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.max(0, Math.min(1, alpha))})`;
}

export const QuantumVisualizer3D: React.FC<QuantumVisualizer3DProps> = ({
  mode,
  currentTrack,
  isPlaying,
  theme,
  moodEnvironment,
  synthTargetBpm = null,
  synthHarmonicIntensity = null,
  analysisFrameRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const paletteRef = useRef<AdaptivePalette>(getAdaptivePalette(moodEnvironment, currentTrack));
  paletteRef.current = getAdaptivePalette(moodEnvironment, currentTrack);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const synthBpmRef = useRef<number | null>(synthTargetBpm ?? null);
  synthBpmRef.current = synthTargetBpm ?? null;
  const synthHarmonicRef = useRef<number | null>(synthHarmonicIntensity ?? null);
  synthHarmonicRef.current = synthHarmonicIntensity ?? null;

  // Persistent particle/geometry buffers (zero allocation per frame)
  const tunnelRingsRef = useRef<Array<{ z: number; rot: number; sides: number }>>(
    Array.from({ length: 28 }, (_, i) => ({
      z: 90 + i * 84,
      rot: i * 0.14,
      sides: i % 3 === 0 ? 6 : 8,
    }))
  );
  const tunnelDustRef = useRef<TunnelParticle[]>(
    Array.from({ length: 180 }, (_, i) => {
      const ang = ((i * 137.5) % 360) * (Math.PI / 180);
      const rad = 120 + ((i * 53) % 440);
      const z = 80 + ((i * 97) % 2320);
      return {
        x: Math.cos(ang) * rad,
        y: Math.sin(ang) * rad,
        z,
        prevZ: z,
        size: 1.1 + (i % 4) * 0.55,
        hueShift: i % 3,
        speedMul: 0.75 + (i % 5) * 0.14,
      };
    })
  );
  const orbitNodesRef = useRef<OrbitNode[]>(
    Array.from({ length: 95 }, (_, i) => ({
      theta: ((i * 137.5) % 360) * (Math.PI / 180),
      phi: Math.acos(1 - (2 * (i + 0.5)) / 95),
      radius: 130 + (i % 7) * 28,
      speed: (i % 2 === 0 ? 1 : -1) * (0.008 + (i % 5) * 0.0025),
      size: 1.8 + (i % 4) * 0.85,
      hueShift: i % 3,
    }))
  );
  const shockwavesRef = useRef<ShockwaveRing[]>([]);
  const warpStarsRef = useRef<WarpStar[]>(
    Array.from({ length: 230 }, (_, i) => {
      const ang = ((i * 137.508) % 360) * (Math.PI / 180);
      const rad = 75 + ((i * 71) % 520);
      const z = 60 + ((i * 89) % 2100);
      return {
        x: Math.cos(ang) * rad,
        y: Math.sin(ang) * rad,
        z,
        prevZ: z,
        size: 1.1 + (i % 3) * 0.65,
        tint: i % 3,
      };
    })
  );
  const barPeaksRef = useRef<Float32Array>(new Float32Array(52));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = 0;
    let disposed = false;
    let t = 0;
    let smoothBass = 0;
    let smoothMid = 0;
    let smoothHigh = 0;
    let smoothBeat = 0;
    let lastTimestamp = performance.now();

    const drawQuantumTunnel = (
      width: number,
      height: number,
      dt: number,
      pal: AdaptivePalette,
      frame: AudioAnalysisFrame
    ) => {
      const cx = width * 0.5 + Math.sin(t * 0.65) * (width * 0.038 * (0.5 + smoothMid));
      const cy = height * 0.5 + Math.cos(t * 0.52) * (height * 0.032 * (0.5 + smoothBass));
      const fov = Math.min(width, height) * 0.92;
      const maxDepth = 2380;

      // Deep space gradient backdrop
      const bg = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(width, height) * 0.85);
      bg.addColorStop(0, rgba(pal.c1, 0.24 + smoothBeat * 0.34));
      bg.addColorStop(0.28, pal.bgBottom);
      bg.addColorStop(1, pal.bgTop);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const tempoScale = synthBpmRef.current
        ? Math.max(0.65, Math.min(1.65, synthBpmRef.current / 108))
        : 1.0;
      const harmonicDrive = synthHarmonicRef.current ?? 0.55;

      // Speed surges with bass, beat envelope, and synthesized BPM
      const tunnelSpeed = prefersReduced
        ? 4
        : (isPlayingRef.current
            ? (14 + smoothBass * 38 + smoothBeat * 32) * tempoScale
            : 5.5) * dt;

      // Vanishing-point Quantum Core portal flare
      const coreR =
        Math.min(width, height) *
        (0.08 + smoothBeat * 0.1 + smoothBass * 0.06 + harmonicDrive * 0.025);
      const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.4);
      coreGlow.addColorStop(0, `rgba(255, 255, 255, ${0.72 + smoothBeat * 0.26})`);
      coreGlow.addColorStop(0.32, rgba(pal.c3, 0.55 + smoothHigh * 0.25));
      coreGlow.addColorStop(0.7, rgba(pal.c2, 0.22));
      coreGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Update & sort tunnel rings far-to-near
      const rings = tunnelRingsRef.current;
      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        ring.z -= tunnelSpeed;
        ring.rot +=
          (0.008 + smoothHigh * 0.024 + harmonicDrive * 0.01) *
          tempoScale *
          (i % 2 === 0 ? 1 : -0.8) *
          dt;
        if (ring.z < 45) {
          ring.z += maxDepth;
        }
      }
      rings.sort((a, b) => b.z - a.z);

      // Longitudinal energy rails connecting deepest ring to camera rim
      const rails = 8;
      for (let r = 0; r < rails; r++) {
        const angle = (r / rails) * Math.PI * 2 + t * 0.32;
        const bin = frame.frequencyData[(r * 11) % 128] / 255;
        const radNear = (195 + smoothBass * 65 + bin * 35) * (fov / (fov + 90));
        const radFar = 195 * (fov / (fov + maxDepth));
        const x1 = cx + Math.cos(angle) * radFar;
        const y1 = cy + Math.sin(angle) * radFar;
        const x2 = cx + Math.cos(angle + 0.35) * radNear * 1.45;
        const y2 = cy + Math.sin(angle + 0.35) * radNear * 1.45;

        const railGrad = ctx.createLinearGradient(x1, y1, x2, y2);
        railGrad.addColorStop(0, rgba(pal.c2, 0.04));
        railGrad.addColorStop(1, rgba(r % 2 === 0 ? pal.c1 : pal.c3, 0.35 + bin * 0.35));
        ctx.strokeStyle = railGrad;
        ctx.lineWidth = 1.2 + smoothBeat * 1.1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Render 3D geometric quantum rings
      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        const depthNorm = 1 - ring.z / maxDepth;
        const scale = fov / (fov + ring.z);
        const freqIdx = Math.min(200, Math.floor(depthNorm * 80));
        const freqMag = (frame.frequencyData[freqIdx] ?? 0) / 255;
        const radius = (180 + smoothBass * 75 + freqMag * 58 + smoothBeat * 40) * scale;
        const alpha = Math.pow(depthNorm, 1.35) * (0.45 + freqMag * 0.5 + smoothBeat * 0.2);

        const col = i % 3 === 0 ? pal.c1 : i % 3 === 1 ? pal.c2 : pal.c3;
        const sides = ring.sides;

        // Soft outer luminous halo stroke
        ctx.beginPath();
        for (let s = 0; s <= sides; s++) {
          const ang = ring.rot + (s / sides) * Math.PI * 2;
          const wobble = 1 + Math.sin(ang * 3 + t * 2.2) * (0.04 + smoothHigh * 0.08);
          const px = cx + Math.cos(ang) * radius * wobble;
          const py = cy + Math.sin(ang) * radius * wobble;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = rgba(col, alpha * 0.38);
        ctx.lineWidth = Math.max(2, 7.5 * scale);
        ctx.stroke();

        // Crisp core geometric neon edge
        ctx.strokeStyle = rgba(col, Math.min(0.98, alpha * 1.15));
        ctx.lineWidth = Math.max(0.8, 2.2 * scale);
        ctx.stroke();
      }

      // Render 3D cosmic dust & warp velocity streaks
      const dust = tunnelDustRef.current;
      ctx.lineCap = 'round';
      for (let i = 0; i < dust.length; i++) {
        const p = dust[i];
        p.prevZ = p.z;
        p.z -= tunnelSpeed * p.speedMul * 1.25;
        if (p.z < 30) {
          p.z = maxDepth;
          p.prevZ = maxDepth;
        }

        const scaleNow = fov / (fov + p.z);
        const scalePrev = fov / (fov + Math.min(maxDepth, p.prevZ + 22 + smoothBeat * 48));
        const sx = cx + p.x * scaleNow;
        const sy = cy + p.y * scaleNow;
        const px = cx + p.x * scalePrev;
        const py = cy + p.y * scalePrev;

        if (sx < -40 || sx > width + 40 || sy < -40 || sy > height + 40) continue;

        const depthAlpha = Math.min(1, (1 - p.z / maxDepth) * 1.25);
        const col = p.hueShift === 0 ? pal.c1 : p.hueShift === 1 ? pal.c2 : pal.c3;
        ctx.strokeStyle = rgba(col, depthAlpha * (0.55 + smoothHigh * 0.45));
        ctx.lineWidth = Math.max(0.8, p.size * scaleNow * 2.1);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
    };

    const drawNeuralSymphony = (
      width: number,
      height: number,
      dt: number,
      pal: AdaptivePalette,
      frame: AudioAnalysisFrame
    ) => {
      const cx = width * 0.5;
      const cy = height * 0.5;
      const fov = Math.min(width, height) * 0.95;

      const bg = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(width, height) * 0.85);
      bg.addColorStop(0, rgba(pal.c2, 0.25 + smoothBeat * 0.25));
      bg.addColorStop(0.55, pal.bgBottom);
      bg.addColorStop(1, pal.bgTop);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Spawn harmonic shockwaves on beat
      if (frame.isBeat && isPlayingRef.current && shockwavesRef.current.length < 8) {
        shockwavesRef.current.push({ z: 620, alpha: 0.95, hueOffset: Math.floor(t * 10) % 3 });
      }

      // 3D tilted harmonic shockwaves
      const waves = shockwavesRef.current;
      for (let i = waves.length - 1; i >= 0; i--) {
        const sw = waves[i];
        sw.z -= 11 * dt;
        sw.alpha -= 0.018 * dt;
        if (sw.alpha <= 0 || sw.z < 40) {
          waves.splice(i, 1);
          continue;
        }
        const scale = fov / (fov + sw.z);
        const rx = (280 + (620 - sw.z) * 0.65) * scale;
        const ry = rx * 0.42;
        const col = sw.hueOffset === 0 ? pal.c1 : sw.hueOffset === 1 ? pal.c2 : pal.c3;
        ctx.strokeStyle = rgba(col, sw.alpha * 0.78);
        ctx.lineWidth = 2.4 * scale;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, Math.sin(t * 0.4) * 0.25, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 3D Morphing Bioluminescent Energy Ribbons synced to timeDomain + frequency bins + harmonic drive
      const tempoScale = synthBpmRef.current
        ? Math.max(0.65, Math.min(1.65, synthBpmRef.current / 108))
        : 1.0;
      const harmonicDrive = synthHarmonicRef.current ?? 0.55;
      const ribbonCount = harmonicDrive >= 0.72 ? 6 : 5;
      const td = frame.timeDomainData;
      const slices = 72;

      for (let r = 0; r < ribbonCount; r++) {
        const depthZ = 180 + r * 145;
        const perspective = fov / (fov + depthZ);
        const col = r % 3 === 0 ? pal.c1 : r % 3 === 1 ? pal.c2 : pal.c3;
        const baseSpan = width * (0.95 + r * 0.14);

        ctx.beginPath();
        for (let i = 0; i <= slices; i++) {
          const u = i / slices;
          const tdIdx = Math.floor(u * (td.length - 1));
          const waveSample = isPlayingRef.current ? (td[tdIdx] - 128) / 128 : 0;
          const freqSample = (frame.frequencyData[(i * 2 + r * 9) % 256] ?? 0) / 255;

          const x3d = (u - 0.5) * baseSpan;
          const y3d =
            Math.sin(u * Math.PI * (2.8 + harmonicDrive * 1.1) + t * (1.2 + r * 0.22) * tempoScale + r) *
              (30 + smoothBass * 60 + harmonicDrive * 18) +
            waveSample * (height * (0.26 + smoothBeat * 0.18 + harmonicDrive * 0.06)) +
            Math.cos(u * Math.PI * 5 - t * 1.4 * tempoScale) * (freqSample * 34);
          const zShift = Math.cos(u * Math.PI * 2 + t + r) * 85;
          const s = fov / (fov + depthZ + zShift);

          const px = cx + x3d * s;
          const py = cy + y3d * s + (r - 2) * 16 * perspective;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }

        // Luminous outer aura pass
        ctx.strokeStyle = rgba(col, 0.28 + smoothBeat * 0.24);
        ctx.lineWidth = (7.5 - r * 0.85) * perspective;
        ctx.stroke();

        // Crisp bioluminescent core filament
        ctx.strokeStyle = rgba(col, 0.85);
        ctx.lineWidth = (2.4 - r * 0.22) * perspective;
        ctx.stroke();
      }

      // 3D Orbiting Holographic Stardust Nodes
      const rotY = t * 0.42 * tempoScale;
      const rotX = Math.sin(t * 0.28) * 0.45;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const nodes = orbitNodesRef.current;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.theta += n.speed * tempoScale * (1 + smoothMid * 2.2) * dt;
        const r = n.radius * (0.85 + smoothBass * 0.32 + smoothBeat * 0.2);

        const x0 = r * Math.sin(n.phi) * Math.cos(n.theta);
        const y0 = r * Math.cos(n.phi) * 0.65;
        const z0 = r * Math.sin(n.phi) * Math.sin(n.theta);

        // Rotate Y then X
        const x1 = x0 * cosY - z0 * sinY;
        const z1 = z0 * cosY + x0 * sinY;
        const y2 = y0 * cosX - z1 * sinX;
        const z2 = z1 * cosX + y0 * sinX + 380;

        if (z2 <= 20) continue;
        const s = fov / (fov + z2);
        const sx = cx + x1 * s;
        const sy = cy + y2 * s;
        const col = n.hueShift === 0 ? pal.c1 : n.hueShift === 1 ? pal.c2 : pal.c3;
        const alpha = Math.min(0.95, Math.max(0.18, (1 - z2 / 860) * (0.65 + smoothHigh * 0.4)));

        ctx.fillStyle = rgba(col, alpha);
        ctx.beginPath();
        ctx.arc(sx, sy, n.size * s * (1 + smoothBeat * 0.55), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawNebulaWarp = (
      width: number,
      height: number,
      dt: number,
      pal: AdaptivePalette
    ) => {
      const cx = width * 0.5 + Math.cos(t * 0.45) * (width * 0.04);
      const cy = height * 0.5 + Math.sin(t * 0.38) * (height * 0.035);
      const fov = Math.min(width, height) * 0.9;
      const maxDepth = 2160;

      // Deep cosmos fill
      ctx.fillStyle = pal.bgTop;
      ctx.fillRect(0, 0, width, height);

      // Warping stereo-reactive plasma clouds
      for (let c = 0; c < 4; c++) {
        const ang = t * (0.28 + c * 0.09) + c * 1.6;
        const dist = Math.min(width, height) * (0.16 + smoothMid * 0.12);
        const nx = cx + Math.cos(ang) * dist;
        const ny = cy + Math.sin(ang * 1.2) * dist * 0.72;
        const radius = Math.max(width, height) * (0.36 + smoothBass * 0.22 + (c % 2) * 0.1);
        const col = c % 3 === 0 ? pal.c1 : c % 3 === 1 ? pal.c2 : pal.c3;

        const neb = ctx.createRadialGradient(nx, ny, 0, nx, ny, radius);
        neb.addColorStop(0, rgba(col, 0.34 + smoothBeat * 0.24));
        neb.addColorStop(0.45, rgba(col, 0.14 + smoothHigh * 0.12));
        neb.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = neb;
        ctx.fillRect(0, 0, width, height);
      }

      // 3D Starfield Warp streaks modulated by synthesized BPM & harmonic intensity
      const tempoScale = synthBpmRef.current
        ? Math.max(0.65, Math.min(1.65, synthBpmRef.current / 108))
        : 1.0;
      const harmonicDrive = synthHarmonicRef.current ?? 0.55;
      const stars = warpStarsRef.current;
      const warpSpeed = prefersReduced
        ? 3
        : (isPlayingRef.current
            ? (11 + smoothBass * 36 + smoothBeat * 28 + harmonicDrive * 10) * tempoScale
            : 4) * dt;

      ctx.lineCap = 'round';
      for (let i = 0; i < stars.length; i++) {
        const st = stars[i];
        st.prevZ = st.z;
        st.z -= warpSpeed;
        if (st.z < 35) {
          st.z = maxDepth;
          st.prevZ = maxDepth;
        }

        const sNow = fov / (fov + st.z);
        const sPrev = fov / (fov + Math.min(maxDepth, st.prevZ + 28 + smoothHigh * 55));
        const sx = cx + st.x * sNow;
        const sy = cy + st.y * sNow;
        const px = cx + st.x * sPrev;
        const py = cy + st.y * sPrev;

        if (sx < -30 || sx > width + 30 || sy < -30 || sy > height + 30) continue;

        const alpha = Math.min(1, (1 - st.z / maxDepth) * 1.3);
        const col = st.tint === 0 ? pal.c3 : st.tint === 1 ? pal.c1 : pal.c2;
        ctx.strokeStyle = rgba(col, alpha);
        ctx.lineWidth = Math.max(0.9, st.size * sNow * 2.1);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
    };

    const drawClassicProBars = (
      width: number,
      height: number,
      pal: AdaptivePalette,
      frame: AudioAnalysisFrame
    ) => {
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, pal.bgTop);
      bg.addColorStop(1, pal.bgBottom);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const barCount = Math.min(52, Math.max(28, Math.floor(width / 10)));
      const padX = 16;
      const usableW = Math.max(40, width - padX * 2);
      const gap = 4;
      const barW = Math.max(2, (usableW - gap * (barCount - 1)) / barCount);
      const baselineY = height * 0.72;
      const maxBarH = height * 0.56;
      const peaks = barPeaksRef.current;

      // Subtle horizon line
      ctx.strokeStyle = rgba(pal.c3, 0.22);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX, baselineY);
      ctx.lineTo(width - padX, baselineY);
      ctx.stroke();

      for (let i = 0; i < barCount; i++) {
        const logNorm = Math.pow(i / barCount, 1.5);
        const bin = Math.min(
          frame.frequencyData.length - 1,
          Math.floor(logNorm * (frame.frequencyData.length * 0.55))
        );
        const raw = frame.frequencyData[bin] / 255;
        const idle = !isPlayingRef.current ? 0.06 + 0.03 * Math.sin(t * 2.2 + i * 0.28) : 0.04;
        const mag = Math.max(idle, raw);

        if (mag > peaks[i]) peaks[i] = mag;
        else peaks[i] = Math.max(mag, peaks[i] - 0.012);

        const barH = Math.max(4, mag * maxBarH);
        const x = padX + i * (barW + gap);
        const y = baselineY - barH;

        const barGrad = ctx.createLinearGradient(0, y, 0, baselineY);
        barGrad.addColorStop(0, rgba(pal.c3, 0.96));
        barGrad.addColorStop(0.55, rgba(pal.c1, 0.9));
        barGrad.addColorStop(1, rgba(pal.c2, 0.82));

        ctx.fillStyle = barGrad;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, Math.min(4, barW / 2));
        ctx.fill();

        // Crisp floating peak cap
        const peakY = baselineY - Math.max(6, peaks[i] * maxBarH) - 5;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(x, peakY, barW, 2);

        // Soft studio mirror reflection below baseline
        ctx.fillStyle = rgba(pal.c1, 0.24);
        ctx.beginPath();
        ctx.roundRect(x, baselineY + 3, barW, barH * 0.3, Math.min(3, barW / 2));
        ctx.fill();
      }
    };

    const render = (now: number) => {
      if (disposed) return;
      const elapsed = Math.min(48, Math.max(8, now - lastTimestamp));
      lastTimestamp = now;
      const dt = elapsed / 16.667;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const frame = analysisFrameRef.current;
      const playing = isPlayingRef.current;
      t += 0.016 * (playing ? 1 : 0.45) * dt;

      // Smooth audio envelopes for ultra-fluid 60fps camera & geometry response
      const targetBass = playing ? frame.bass : 0.08 + 0.04 * Math.sin(t * 1.4);
      const targetMid = playing ? frame.mid : 0.08;
      const targetHigh = playing ? frame.high : 0.06;
      const targetBeat = playing ? frame.beatEnvelope : 0.05;

      smoothBass += (targetBass - smoothBass) * 0.24;
      smoothMid += (targetMid - smoothMid) * 0.22;
      smoothHigh += (targetHigh - smoothHigh) * 0.24;
      smoothBeat += (targetBeat - smoothBeat) * 0.3;

      const pal = paletteRef.current;
      const activeMode = modeRef.current;

      if (activeMode === 'neural') {
        drawNeuralSymphony(width, height, dt, pal, frame);
      } else if (activeMode === 'nebula') {
        drawNebulaWarp(width, height, dt, pal);
      } else if (activeMode === 'bars') {
        drawClassicProBars(width, height, pal, frame);
      } else {
        drawQuantumTunnel(width, height, dt, pal, frame);
      }

      if (!prefersReduced) {
        rafId = requestAnimationFrame(render);
      }
    };

    rafId = requestAnimationFrame(render);
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
    };
  }, [analysisFrameRef]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block rounded-2xl"
      aria-label="3D Quantum Journey audio-reactive visualizer"
    />
  );
};
