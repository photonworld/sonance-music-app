import React, { useEffect, useRef } from 'react';
import { ThemePalette } from '../themes/themes';
import { AudioAnalysisFrame, QuantumVisualizerMode, Track } from '../types/audio';
import { GeometricFlowWebGLCanvas } from './GeometricFlowWebGLCanvas';
import { GlitchShiftWebGLCanvas } from './GlitchShiftWebGLCanvas';
import { MoodEnvironmentType } from './MoodEnvironmentBackdrop';

interface QuantumVisualizer3DProps {
  mode: QuantumVisualizerMode;
  currentTrack: Track | null;
  isPlaying: boolean;
  theme: ThemePalette;
  moodEnvironment?: MoodEnvironmentType;
  synthTargetBpm?: number | null;
  synthHarmonicIntensity?: number | null;
  transitionBpm?: number | null;
  isCrossfading?: boolean;
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

interface VortexParticle {
  angle: number;
  heightNorm: number;
  radialJitter: number;
  speed: number;
  size: number;
  tint: number;
}

interface LanternEntity {
  x: number;
  yNorm: number;
  z: number;
  swayPhase: number;
  size: number;
  speed: number;
  tint: number;
}

interface EmberSpark {
  x: number;
  yNorm: number;
  z: number;
  speed: number;
  phase: number;
  size: number;
}

interface MonsoonDrop3D {
  x: number;
  yNorm: number;
  z: number;
  len: number;
  speed: number;
}

interface MonsoonRipple3D {
  active: boolean;
  x: number;
  z: number;
  radius: number;
  maxRadius: number;
  alpha: number;
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
  transitionBpm = null,
  isCrossfading = false,
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
  const transitionBpmPropRef = useRef<number | null>(transitionBpm ?? null);
  transitionBpmPropRef.current = transitionBpm ?? null;
  const isCrossfadingRef = useRef<boolean>(Boolean(isCrossfading));
  isCrossfadingRef.current = Boolean(isCrossfading);
  const trackBpmRef = useRef<number | null>(currentTrack?.bpm ?? null);
  trackBpmRef.current = currentTrack?.bpm ?? null;

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
  const vortexParticlesRef = useRef<VortexParticle[]>(
    Array.from({ length: 190 }, (_, i) => ({
      angle: ((i * 137.5) % 360) * (Math.PI / 180),
      heightNorm: (i % 97) / 97,
      radialJitter: 0.72 + ((i * 29) % 56) / 100,
      speed: 0.018 + (i % 7) * 0.004,
      size: 1.5 + (i % 4) * 0.7,
      tint: i % 3,
    }))
  );
  const lanternsRef = useRef<LanternEntity[]>(
    Array.from({ length: 34 }, (_, i) => ({
      x: (((i * 73) % 100) / 100 - 0.5) * 920,
      yNorm: (i * 0.089) % 1,
      z: 140 + ((i * 113) % 1400),
      swayPhase: i * 0.85,
      size: 16 + (i % 5) * 4,
      speed: 0.0012 + (i % 4) * 0.00035,
      tint: i % 3,
    }))
  );
  const emberSparksRef = useRef<EmberSpark[]>(
    Array.from({ length: 85 }, (_, i) => ({
      x: (((i * 61) % 100) / 100 - 0.5) * 860,
      yNorm: ((i * 37) % 100) / 100,
      z: 90 + ((i * 83) % 1100),
      speed: 0.0028 + (i % 6) * 0.0006,
      phase: i * 0.7,
      size: 1.1 + (i % 3) * 0.65,
    }))
  );
  const monsoonDrops3DRef = useRef<MonsoonDrop3D[]>(
    Array.from({ length: 150 }, (_, i) => ({
      x: (((i * 89) % 200) / 200 - 0.5) * 1100,
      yNorm: ((i * 43) % 100) / 100,
      z: 80 + ((i * 107) % 1320),
      len: 18 + (i % 5) * 7,
      speed: 0.015 + (i % 6) * 0.0032,
    }))
  );
  const monsoonRipples3DRef = useRef<MonsoonRipple3D[]>(
    Array.from({ length: 20 }, (_, i) => ({
      active: i < 8,
      x: (((i * 67) % 100) / 100 - 0.5) * 580,
      z: 180 + ((i * 97) % 850),
      radius: 10 + i * 8,
      maxRadius: 95 + (i % 4) * 25,
      alpha: 0.7 - (i % 5) * 0.1,
      tint: i % 3,
    }))
  );
  const cyberScrollRef = useRef<number>(0);

  const isWebGLGeometric = mode === 'geometricflow';
  const isWebGLGlitch = mode === 'glitchshift';
  const isWebGLMode = isWebGLGeometric || isWebGLGlitch;

  useEffect(() => {
    if (isWebGLMode) return;
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

      const activeBpm =
        frame.transitionTempoBpm ??
        transitionBpmPropRef.current ??
        synthBpmRef.current ??
        frame.estimatedBpm ??
        trackBpmRef.current ??
        108;
      const tempoScale = Math.max(0.55, Math.min(1.85, activeBpm / 108));
      const harmonicDrive = synthHarmonicRef.current ?? 0.55;
      const xfProgress = frame.crossfadeProgress ?? 0;
      const xfSurge = isCrossfadingRef.current || frame.crossfadeProgress != null
        ? Math.sin(Math.max(0, Math.min(1, xfProgress)) * Math.PI)
        : 0;
      // Exact beat-locked oscillation pulse at active/transition tempo
      const beatRad = t * (activeBpm / 60) * Math.PI * 2;
      const tempoPulse = 0.5 + 0.5 * Math.sin(beatRad);

      // Tunnel speed & rotation lock smoothly onto active/transition tempo + crossfade harmonic surge
      const tunnelSpeed = prefersReduced
        ? 4
        : (isPlayingRef.current
            ? (14 + smoothBass * 38 + smoothBeat * 32 + xfSurge * 14 + tempoPulse * 6) * tempoScale
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

      // Render 3D cosmic dust & warp velocity streaks (particle frequency scales smoothly with transition BPM)
      const dust = tunnelDustRef.current;
      const activeParticleRatio = Math.min(
        1,
        0.52 + tempoScale * 0.24 + xfSurge * 0.24 + smoothBeat * 0.14
      );
      const visibleDustCount = Math.max(48, Math.floor(dust.length * activeParticleRatio));
      ctx.lineCap = 'round';
      for (let i = 0; i < visibleDustCount; i++) {
        const p = dust[i];
        p.prevZ = p.z;
        p.z -= tunnelSpeed * p.speedMul * (1.2 + xfSurge * 0.32);
        if (p.z < 30) {
          p.z = maxDepth;
          p.prevZ = maxDepth;
        }

        const scaleNow = fov / (fov + p.z);
        const scalePrev =
          fov / (fov + Math.min(maxDepth, p.prevZ + 22 * tempoScale + smoothBeat * 48 + xfSurge * 28));
        const sx = cx + p.x * scaleNow;
        const sy = cy + p.y * scaleNow;
        const px = cx + p.x * scalePrev;
        const py = cy + p.y * scalePrev;

        if (sx < -40 || sx > width + 40 || sy < -40 || sy > height + 40) continue;

        const depthAlpha = Math.min(1, (1 - p.z / maxDepth) * 1.25);
        const col = p.hueShift === 0 ? pal.c1 : p.hueShift === 1 ? pal.c2 : pal.c3;
        ctx.strokeStyle = rgba(col, depthAlpha * (0.55 + smoothHigh * 0.45 + xfSurge * 0.18));
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

      // 3D Morphing Bioluminescent Energy Ribbons synced to timeDomain + frequency bins + transition BPM
      const activeBpm =
        frame.transitionTempoBpm ??
        transitionBpmPropRef.current ??
        synthBpmRef.current ??
        frame.estimatedBpm ??
        trackBpmRef.current ??
        108;
      const tempoScale = Math.max(0.55, Math.min(1.85, activeBpm / 108));
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
      pal: AdaptivePalette,
      frame: AudioAnalysisFrame
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

      // 3D Starfield Warp streaks modulated by active/transition BPM & harmonic intensity
      const activeBpm =
        frame.transitionTempoBpm ??
        transitionBpmPropRef.current ??
        synthBpmRef.current ??
        frame.estimatedBpm ??
        trackBpmRef.current ??
        108;
      const tempoScale = Math.max(0.55, Math.min(1.85, activeBpm / 108));
      const harmonicDrive = synthHarmonicRef.current ?? 0.55;
      const xfProgress = frame.crossfadeProgress ?? 0;
      const xfSurge = isCrossfadingRef.current || frame.crossfadeProgress != null
        ? Math.sin(Math.max(0, Math.min(1, xfProgress)) * Math.PI)
        : 0;
      const stars = warpStarsRef.current;
      const visibleStars = Math.max(
        60,
        Math.floor(stars.length * Math.min(1, 0.55 + tempoScale * 0.25 + xfSurge * 0.22))
      );
      const warpSpeed = prefersReduced
        ? 3
        : (isPlayingRef.current
            ? (11 + smoothBass * 36 + smoothBeat * 28 + harmonicDrive * 10 + xfSurge * 14) * tempoScale
            : 4) * dt;

      ctx.lineCap = 'round';
      for (let i = 0; i < visibleStars; i++) {
        const st = stars[i];
        st.prevZ = st.z;
        st.z -= warpSpeed;
        if (st.z < 35) {
          st.z = maxDepth;
          st.prevZ = maxDepth;
        }

        const sNow = fov / (fov + st.z);
        const sPrev =
          fov / (fov + Math.min(maxDepth, st.prevZ + 28 * tempoScale + smoothHigh * 55 + xfSurge * 24));
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

    const getTempoState = (frame: AudioAnalysisFrame) => {
      const activeBpm =
        frame.transitionTempoBpm ??
        transitionBpmPropRef.current ??
        synthBpmRef.current ??
        frame.estimatedBpm ??
        trackBpmRef.current ??
        108;
      const tempoScale = Math.max(0.55, Math.min(1.85, activeBpm / 108));
      const harmonicDrive = synthHarmonicRef.current ?? 0.55;
      const xfProgress = frame.crossfadeProgress ?? 0;
      const xfSurge =
        isCrossfadingRef.current || frame.crossfadeProgress != null
          ? Math.sin(Math.max(0, Math.min(1, xfProgress)) * Math.PI)
          : 0;
      const beatRad = t * (activeBpm / 60) * Math.PI * 2;
      const tempoPulse = 0.5 + 0.5 * Math.sin(beatRad);
      return { activeBpm, tempoScale, harmonicDrive, xfSurge, tempoPulse };
    };

    const drawCyberHorizon = (
      width: number,
      height: number,
      dt: number,
      pal: AdaptivePalette,
      frame: AudioAnalysisFrame
    ) => {
      const { tempoScale, harmonicDrive, xfSurge, tempoPulse } = getTempoState(frame);
      const horizonY = height * 0.48 + Math.sin(t * 0.5) * 6 * smoothBass;
      const cx = width * 0.5;

      // Retro synthwave sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
      sky.addColorStop(0, pal.bgTop);
      sky.addColorStop(0.65, pal.bgBottom);
      sky.addColorStop(1, rgba(pal.c2, 0.38 + smoothBeat * 0.25));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      // Glowing Horizon Sun with audio scanlines
      const sunR = Math.min(width, height) * (0.21 + smoothBass * 0.045 + smoothBeat * 0.03);
      const sunY = horizonY - sunR * 0.22;
      const sunHalo = ctx.createRadialGradient(cx, sunY, sunR * 0.3, cx, sunY, sunR * 2.2);
      sunHalo.addColorStop(0, rgba(pal.c3, 0.5 + smoothBeat * 0.28));
      sunHalo.addColorStop(0.45, rgba(pal.c2, 0.24));
      sunHalo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sunHalo;
      ctx.beginPath();
      ctx.arc(cx, sunY, sunR * 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, sunY, sunR, 0, Math.PI * 2);
      ctx.clip();
      const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
      sunGrad.addColorStop(0, rgba(pal.c3, 0.96));
      sunGrad.addColorStop(0.55, rgba(pal.c1, 0.92));
      sunGrad.addColorStop(1, rgba(pal.c2, 0.94));
      ctx.fillStyle = sunGrad;
      ctx.fillRect(cx - sunR, sunY - sunR, sunR * 2, sunR * 2);

      // Horizontal synthwave sun cutout bands
      ctx.fillStyle = pal.bgBottom;
      for (let s = 0; s < 6; s++) {
        const bandY = sunY + sunR * (0.12 + s * 0.14);
        const bandH = Math.max(1.5, (s + 1) * (1.2 + smoothHigh * 0.8));
        ctx.fillRect(cx - sunR - 2, bandY, sunR * 2 + 4, bandH);
      }
      ctx.restore();

      // Floor dark plane below horizon
      const floorGrad = ctx.createLinearGradient(0, horizonY, 0, height);
      floorGrad.addColorStop(0, pal.bgBottom);
      floorGrad.addColorStop(1, pal.bgTop);
      ctx.fillStyle = floorGrad;
      ctx.fillRect(0, horizonY, width, height - horizonY);

      // Horizon glowing laser seam
      ctx.strokeStyle = rgba(pal.c3, 0.85);
      ctx.lineWidth = 2 + smoothBeat * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(width, horizonY);
      ctx.stroke();

      // 3D Scrolling Perspective Grid + Audio Mountain Wireframe Ridges
      const speed = prefersReduced
        ? 0.004
        : (isPlayingRef.current ? (0.016 + smoothBass * 0.032 + xfSurge * 0.015) * tempoScale : 0.005) * dt;
      cyberScrollRef.current = (cyberScrollRef.current + speed) % 1;

      const cols = 18;
      const rows = 14;
      const floorH = height - horizonY;

      // Longitudinal perspective rays
      for (let c = -cols / 2; c <= cols / 2; c++) {
        const normX = c / (cols / 2);
        const topX = cx + normX * (width * 0.09);
        const botX = cx + normX * (width * 1.32);
        ctx.strokeStyle = rgba(pal.c1, 0.34 + smoothMid * 0.25);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(topX, horizonY);
        ctx.lineTo(botX, height);
        ctx.stroke();
      }

      // Horizontal perspective terrain rows with side mountain displacement
      for (let r = 0; r < rows; r++) {
        const rawZ = (r + cyberScrollRef.current) / rows;
        const depth = Math.pow(rawZ, 2.2);
        const yBase = horizonY + depth * floorH;
        const spanHalf = width * (0.09 + depth * 1.23);

        ctx.beginPath();
        const segs = 28;
        for (let s = 0; s <= segs; s++) {
          const u = s / segs;
          const x = cx + (u - 0.5) * 2 * spanHalf;
          const edgeFactor = Math.pow(Math.abs(u - 0.5) * 2, 1.85);
          const bin = Math.floor(Math.abs(u - 0.5) * 90) + r * 3;
          const freq = (frame.frequencyData[bin % 256] ?? 0) / 255;
          const ridge =
            edgeFactor *
            (22 + freq * 75 + smoothBass * 42 + harmonicDrive * 16 + tempoPulse * 8) *
            (0.25 + depth * 0.9);
          const py = yBase - ridge;
          if (s === 0) ctx.moveTo(x, py);
          else ctx.lineTo(x, py);
        }
        const rowAlpha = Math.min(0.95, 0.16 + depth * 0.72 + smoothBeat * 0.15);
        ctx.strokeStyle = rgba(r % 2 === 0 ? pal.c1 : pal.c2, rowAlpha);
        ctx.lineWidth = 0.9 + depth * 1.6;
        ctx.stroke();
      }
    };

    const drawTornadoVortex = (
      width: number,
      height: number,
      dt: number,
      pal: AdaptivePalette,
      frame: AudioAnalysisFrame
    ) => {
      const { tempoScale, harmonicDrive, xfSurge, tempoPulse } = getTempoState(frame);
      const cx = width * 0.5;
      const cy = height * 0.52;
      const fov = Math.min(width, height) * 0.95;

      const bg = ctx.createRadialGradient(cx, cy, 8, cx, cy, Math.max(width, height) * 0.85);
      bg.addColorStop(0, rgba(pal.c2, 0.28 + smoothBeat * 0.25));
      bg.addColorStop(0.55, pal.bgBottom);
      bg.addColorStop(1, pal.bgTop);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Vertical glowing plasma spine
      const spineGrad = ctx.createLinearGradient(cx, height * 0.1, cx, height * 0.92);
      spineGrad.addColorStop(0, rgba(pal.c3, 0.05));
      spineGrad.addColorStop(0.5, rgba(pal.c1, 0.28 + smoothBass * 0.26));
      spineGrad.addColorStop(1, rgba(pal.c2, 0.08));
      ctx.strokeStyle = spineGrad;
      ctx.lineWidth = 4 + smoothBeat * 6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(t * 1.4) * 18, height * 0.12);
      ctx.quadraticCurveTo(cx - Math.cos(t * 1.1) * 16, cy, cx, height * 0.9);
      ctx.stroke();

      // 3D Funnel Contour Rings
      const funnelH = height * 0.76;
      for (let r = 0; r < 14; r++) {
        const u = r / 13;
        const bin = (frame.frequencyData[r * 10] ?? 0) / 255;
        const yPos = height * 0.88 - u * funnelH;
        const rx =
          (24 + Math.pow(u, 1.28) * Math.min(width, height) * 0.36) *
          (0.88 + smoothBass * 0.28 + bin * 0.24 + tempoPulse * 0.06);
        const ry = rx * 0.28;
        const swayX = cx + Math.sin(t * 1.5 * tempoScale + u * 3.2) * (10 + smoothMid * 16);

        ctx.strokeStyle = rgba(r % 2 === 0 ? pal.c1 : pal.c3, 0.24 + bin * 0.45 + smoothBeat * 0.18);
        ctx.lineWidth = 1.2 + u * 1.4;
        ctx.beginPath();
        ctx.ellipse(swayX, yPos, rx, ry, Math.sin(t + u) * 0.08, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 190 3D Helical Vortex Particles
      const particles = vortexParticlesRef.current;
      const spinDrive = prefersReduced
        ? 0.4
        : (isPlayingRef.current ? (1.1 + smoothMid * 1.8 + xfSurge * 0.9 + harmonicDrive * 0.4) * tempoScale : 0.45) * dt;
      const riseDrive = prefersReduced ? 0.001 : (0.0038 + smoothBass * 0.0055) * tempoScale * dt;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.angle += p.speed * (1.8 - p.heightNorm * 0.65) * spinDrive * 2.2;
        p.heightNorm += riseDrive;
        if (p.heightNorm > 1) p.heightNorm -= 1;

        const funnelRadius =
          (20 + Math.pow(p.heightNorm, 1.25) * Math.min(width, height) * 0.37) *
          p.radialJitter *
          (0.9 + smoothBass * 0.28 + smoothBeat * 0.16);
        const x3d = Math.cos(p.angle) * funnelRadius;
        const z3d = Math.sin(p.angle) * funnelRadius + 380;
        const y3d = (0.5 - p.heightNorm) * funnelH * 0.96;

        const scale = fov / (fov + z3d);
        const swayX = Math.sin(t * 1.5 * tempoScale + p.heightNorm * 3.2) * (10 + smoothMid * 16);
        const sx = cx + swayX + x3d * scale;
        const sy = cy + y3d * scale;

        const depthAlpha = Math.max(0.18, Math.min(0.95, 1 - (z3d - 120) / 760));
        const col = p.tint === 0 ? pal.c1 : p.tint === 1 ? pal.c2 : pal.c3;
        ctx.fillStyle = rgba(col, depthAlpha);
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1, p.size * scale * (1 + smoothBeat * 0.45)), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawSacredMandala = (
      width: number,
      height: number,
      pal: AdaptivePalette,
      frame: AudioAnalysisFrame
    ) => {
      const { tempoScale, harmonicDrive, tempoPulse } = getTempoState(frame);
      const cx = width * 0.5;
      const cy = height * 0.5;
      const baseR = Math.min(width, height) * 0.37;
      const fov = Math.min(width, height) * 1.1;

      const bg = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(width, height) * 0.8);
      bg.addColorStop(0, rgba(pal.c3, 0.2 + smoothBeat * 0.26));
      bg.addColorStop(0.45, pal.bgBottom);
      bg.addColorStop(1, pal.bgTop);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const tiltX = Math.sin(t * 0.45 * tempoScale) * 0.42;
      const tiltY = Math.cos(t * 0.38 * tempoScale) * 0.42;
      const cosX = Math.cos(tiltX);
      const sinX = Math.sin(tiltX);
      const cosY = Math.cos(tiltY);
      const sinY = Math.sin(tiltY);

      const project3D = (x: number, y: number, z: number) => {
        const x1 = x * cosY - z * sinY;
        const z1 = z * cosY + x * sinY;
        const y2 = y * cosX - z1 * sinX;
        const z2 = z1 * cosX + y * sinX + 420;
        const s = fov / (fov + z2);
        return { x: cx + x1 * s, y: cy + y2 * s, s };
      };

      // Nested 3D Rotating Sacred Polygons
      const layers = 5;
      for (let l = 0; l < layers; l++) {
        const sides = l % 2 === 0 ? 6 : 8;
        const layerR = baseR * (0.28 + l * 0.18) * (0.92 + smoothBass * 0.18 + tempoPulse * 0.05);
        const rot = t * (0.26 + l * 0.08) * tempoScale * (l % 2 === 0 ? 1 : -1);
        const zDepth = Math.sin(t * 0.8 + l) * 35;
        const col = l % 3 === 0 ? pal.c1 : l % 3 === 1 ? pal.c2 : pal.c3;

        ctx.beginPath();
        for (let i = 0; i <= sides; i++) {
          const ang = rot + (i / sides) * Math.PI * 2;
          const pt = project3D(Math.cos(ang) * layerR, Math.sin(ang) * layerR, zDepth);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = rgba(col, 0.5 + smoothMid * 0.35);
        ctx.lineWidth = 1.6 + smoothBeat * 1.2;
        ctx.stroke();

        // Vertex nodes
        for (let i = 0; i < sides; i++) {
          const ang = rot + (i / sides) * Math.PI * 2;
          const pt = project3D(Math.cos(ang) * layerR, Math.sin(ang) * layerR, zDepth);
          ctx.fillStyle = rgba(pal.c3, 0.85);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.2 + smoothBeat * 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Audio-reactive 3D Chladni Lotus Harmonic Curves
      const petals = 12;
      const steps = 120;
      for (let ring = 0; ring < 2; ring++) {
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const theta = (i / steps) * Math.PI * 2;
          const bin = (frame.frequencyData[Math.floor((i / steps) * 96)] ?? 0) / 255;
          const harmonic =
            Math.sin(theta * (petals / 2) + t * 1.6 * tempoScale * (ring === 0 ? 1 : -1)) *
            (18 + smoothMid * 34 + bin * 28 + harmonicDrive * 12);
          const r = baseR * (ring === 0 ? 0.68 : 0.95) + harmonic;
          const z = Math.cos(theta * 3 + t * 1.2) * 45;
          const pt = project3D(Math.cos(theta) * r, Math.sin(theta) * r, z);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = rgba(ring === 0 ? pal.c3 : pal.c1, 0.72 + smoothHigh * 0.25);
        ctx.lineWidth = 1.8 + smoothBeat * 0.9;
        ctx.stroke();
      }

      // Glowing Bindu Core
      const coreR = 12 + smoothBeat * 22 + smoothBass * 10;
      const bindu = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.2);
      bindu.addColorStop(0, 'rgba(255,255,255,0.92)');
      bindu.addColorStop(0.4, rgba(pal.c3, 0.6));
      bindu.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bindu;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 2.2, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawSufiLanterns = (
      width: number,
      height: number,
      dt: number,
      pal: AdaptivePalette,
      frame: AudioAnalysisFrame
    ) => {
      const { tempoScale, xfSurge } = getTempoState(frame);
      const cx = width * 0.5;
      const cy = height * 0.5;
      const fov = Math.min(width, height) * 0.95;

      // Warm twilight / golden nocturnal sky
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, '#09040a');
      sky.addColorStop(0.55, '#1e0b0a');
      sky.addColorStop(1, '#36150a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      // Soft twilight crescent glow near upper third
      const horizonGlow = ctx.createRadialGradient(cx, height * 0.75, 10, cx, height * 0.75, width * 0.75);
      horizonGlow.addColorStop(0, rgba([251, 146, 60], 0.24 + smoothBass * 0.18));
      horizonGlow.addColorStop(0.5, rgba(pal.c1, 0.1));
      horizonGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = horizonGlow;
      ctx.fillRect(0, 0, width, height);

      // Rising Golden Ember Sparks
      const sparks = emberSparksRef.current;
      const sparkSpeed = prefersReduced ? 0.25 : (0.85 + smoothMid * 1.4 + xfSurge * 0.6) * tempoScale * dt;
      for (let i = 0; i < sparks.length; i++) {
        const sp = sparks[i];
        sp.yNorm -= sp.speed * sparkSpeed;
        if (sp.yNorm < -0.1) sp.yNorm = 1.1;
        const s = fov / (fov + sp.z);
        const sx = cx + (sp.x + Math.sin(t * 1.8 + sp.phase) * 28) * s;
        const sy = height * sp.yNorm;
        const alpha = Math.max(0.15, Math.min(0.95, 0.45 + Math.sin(t * 4 + sp.phase) * 0.35 + smoothHigh * 0.3));
        ctx.fillStyle = rgba([254, 215, 130], alpha);
        ctx.beginPath();
        ctx.arc(sx, sy, sp.size * s * (1 + smoothBeat * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }

      // Update and depth-sort floating 3D sky lanterns
      const lanterns = lanternsRef.current;
      const liftDrive = prefersReduced
        ? 0.25
        : (isPlayingRef.current ? (0.9 + smoothBass * 1.1 + xfSurge * 0.5) * tempoScale : 0.35) * dt;
      for (let i = 0; i < lanterns.length; i++) {
        const l = lanterns[i];
        l.yNorm -= l.speed * liftDrive;
        if (l.yNorm < -0.18) {
          l.yNorm = 1.18;
        }
      }
      lanterns.sort((a, b) => b.z - a.z);

      for (let i = 0; i < lanterns.length; i++) {
        const l = lanterns[i];
        const s = fov / (fov + l.z);
        const sway = Math.sin(t * 1.1 + l.swayPhase) * (24 + smoothMid * 18);
        const lx = cx + (l.x + sway) * s;
        const ly = cy + (l.yNorm - 0.5) * height * 1.25;
        const w = l.size * s * (1 + smoothBeat * 0.14);
        const h = w * 1.38;

        const depthFade = Math.max(0.25, Math.min(0.98, 1 - l.z / 1700));
        const glowR = w * (2.6 + smoothBass * 1.2);

        // Warm bokeh aura
        const halo = ctx.createRadialGradient(lx, ly, 0, lx, ly, glowR);
        halo.addColorStop(0, rgba([254, 240, 138], (0.55 + smoothBeat * 0.3) * depthFade));
        halo.addColorStop(0.42, rgba([251, 146, 60], 0.28 * depthFade));
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(lx, ly, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Lantern paper body
        const bodyGrad = ctx.createLinearGradient(lx, ly - h * 0.5, lx, ly + h * 0.5);
        bodyGrad.addColorStop(0, rgba([249, 115, 22], 0.9 * depthFade));
        bodyGrad.addColorStop(0.6, rgba([251, 191, 36], 0.95 * depthFade));
        bodyGrad.addColorStop(1, rgba([254, 249, 195], 0.98 * depthFade));
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.roundRect(lx - w * 0.5, ly - h * 0.5, w, h, Math.max(2, w * 0.26));
        ctx.fill();

        // Inner flame core
        ctx.fillStyle = rgba([255, 255, 255], 0.92 * depthFade);
        ctx.beginPath();
        ctx.arc(lx, ly + h * 0.22, Math.max(1.2, w * 0.18), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawMonsoonStorm3D = (
      width: number,
      height: number,
      dt: number,
      pal: AdaptivePalette,
      frame: AudioAnalysisFrame
    ) => {
      const { tempoScale, xfSurge } = getTempoState(frame);
      const cx = width * 0.5;
      const horizonY = height * 0.58;
      const fov = Math.min(width, height) * 0.92;

      // Stormy monsoon night backdrop
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, '#040814');
      sky.addColorStop(0.56, '#0c1733');
      sky.addColorStop(1, '#071324');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      // Subtle lightning atmospheric veil on heavy beat
      if (smoothBeat > 0.52) {
        ctx.fillStyle = rgba(pal.c3, (smoothBeat - 0.5) * 0.26);
        ctx.fillRect(0, 0, width, horizonY);
      }

      // Reflective monsoon water surface gradient
      const waterGrad = ctx.createLinearGradient(0, horizonY, 0, height);
      waterGrad.addColorStop(0, rgba(pal.c1, 0.22 + smoothBass * 0.14));
      waterGrad.addColorStop(0.5, '#071426');
      waterGrad.addColorStop(1, '#030812');
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, horizonY, width, height - horizonY);

      // Horizon mist seam
      ctx.strokeStyle = rgba(pal.c3, 0.35 + smoothHigh * 0.25);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(width, horizonY);
      ctx.stroke();

      // Update & draw 3D water ripples on the flooded surface
      const ripples = monsoonRipples3DRef.current;
      for (let i = 0; i < ripples.length; i++) {
        const rp = ripples[i];
        if (!rp.active) continue;
        rp.radius += (1.6 + smoothBass * 1.8) * tempoScale * dt;
        rp.alpha -= 0.014 * dt;
        if (rp.alpha <= 0 || rp.radius >= rp.maxRadius) {
          rp.active = false;
          continue;
        }
        const s = fov / (fov + rp.z);
        const rx = rp.radius * s;
        const ry = rx * 0.28;
        const px = cx + rp.x * s;
        const py = horizonY + ((1 - rp.z / 1350) * (height - horizonY)) * 0.86;
        const col = rp.tint === 0 ? pal.c3 : rp.tint === 1 ? pal.c1 : pal.c2;

        ctx.strokeStyle = rgba(col, rp.alpha * 0.82);
        ctx.lineWidth = Math.max(0.8, 1.8 * s);
        ctx.beginPath();
        ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 3D Slanted Monsoon Rain Streaks
      const drops = monsoonDrops3DRef.current;
      const rainSpeed = prefersReduced
        ? 0.35
        : (isPlayingRef.current ? (1.1 + smoothHigh * 1.45 + xfSurge * 0.5) * tempoScale : 0.45) * dt;
      const windTilt = -0.18 - smoothMid * 0.14;
      ctx.lineCap = 'round';

      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        d.yNorm += d.speed * rainSpeed;
        if (d.yNorm > 0.96) {
          // Recycle drop and spawn a ripple in a pooled slot
          for (let r = 0; r < ripples.length; r++) {
            if (!ripples[r].active) {
              ripples[r].active = true;
              ripples[r].x = d.x * 0.65;
              ripples[r].z = d.z;
              ripples[r].radius = 6;
              ripples[r].maxRadius = 65 + (i % 5) * 18 + smoothBass * 28;
              ripples[r].alpha = 0.78;
              ripples[r].tint = i % 3;
              break;
            }
          }
          d.yNorm = -0.15;
        }

        const s = fov / (fov + d.z);
        const sx = cx + d.x * s;
        const sy = d.yNorm * (horizonY + (1 - d.z / 1400) * (height - horizonY) * 0.88);
        const streakLen = d.len * s * (0.9 + smoothHigh * 0.8);
        const alpha = Math.max(0.18, Math.min(0.88, (1 - d.z / 1500) * (0.65 + smoothHigh * 0.35)));

        ctx.strokeStyle = rgba(i % 2 === 0 ? pal.c3 : pal.c1, alpha);
        ctx.lineWidth = Math.max(0.8, 1.5 * s);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + streakLen * windTilt, sy - streakLen);
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
        drawNebulaWarp(width, height, dt, pal, frame);
      } else if (activeMode === 'bars') {
        drawClassicProBars(width, height, pal, frame);
      } else if (activeMode === 'cybergrid') {
        drawCyberHorizon(width, height, dt, pal, frame);
      } else if (activeMode === 'vortex') {
        drawTornadoVortex(width, height, dt, pal, frame);
      } else if (activeMode === 'sacred') {
        drawSacredMandala(width, height, pal, frame);
      } else if (activeMode === 'lantern') {
        drawSufiLanterns(width, height, dt, pal, frame);
      } else if (activeMode === 'monsoon3d') {
        drawMonsoonStorm3D(width, height, dt, pal, frame);
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
  }, [analysisFrameRef, isWebGLMode]);

  if (isWebGLGlitch) {
    return (
      <GlitchShiftWebGLCanvas
        variant="3d"
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        theme={theme}
        moodEnvironment={moodEnvironment}
        synthTargetBpm={synthTargetBpm}
        transitionBpm={transitionBpm}
        isCrossfading={isCrossfading}
        analysisFrameRef={analysisFrameRef}
      />
    );
  }

  if (isWebGLGeometric) {
    return (
      <GeometricFlowWebGLCanvas
        variant="3d"
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        theme={theme}
        moodEnvironment={moodEnvironment}
        synthTargetBpm={synthTargetBpm}
        transitionBpm={transitionBpm}
        isCrossfading={isCrossfading}
        analysisFrameRef={analysisFrameRef}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block rounded-2xl"
      aria-label="3D Quantum Journey audio-reactive visualizer"
    />
  );
};
