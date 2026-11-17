import React, { useEffect, useRef } from 'react';
import { ThemePalette } from '../themes/themes';
import { AudioAnalysisFrame, Track } from '../types/audio';
import { MoodEnvironmentType } from './MoodEnvironmentBackdrop';

interface GeometricFlowWebGLCanvasProps {
  variant: 'stage' | '3d';
  currentTrack: Track | null;
  isPlaying: boolean;
  theme: ThemePalette;
  moodEnvironment?: MoodEnvironmentType;
  synthTargetBpm?: number | null;
  transitionBpm?: number | null;
  isCrossfading?: boolean;
  analysisFrameRef: React.MutableRefObject<AudioAnalysisFrame>;
}

const VERTEX_SHADER_SRC = `
  attribute vec3 aPosition;
  attribute float aSize;
  attribute float aIntensity;
  attribute float aTint;

  uniform vec2 uResolution;
  uniform float uPerspective;
  uniform float uDpr;
  uniform float uIs3D;

  varying float vIntensity;
  varying float vTint;
  varying float vDepthFade;

  void main() {
    float zCam = aPosition.z + uPerspective;
    float scale = uPerspective / max(0.25, zCam);
    float aspect = uResolution.x / max(1.0, uResolution.y);

    vec2 projected;
    if (uIs3D > 0.5) {
      projected = vec2((aPosition.x * scale) / aspect, aPosition.y * scale);
    } else {
      projected = vec2(aPosition.x * scale, aPosition.y * scale);
    }

    gl_Position = vec4(projected, 0.0, 1.0);
    gl_PointSize = clamp(aSize * scale * uDpr, 1.5, 28.0);

    vIntensity = aIntensity;
    vTint = aTint;
    vDepthFade = clamp(scale * 1.15, 0.2, 1.0);
  }
`;

const POINT_FRAGMENT_SHADER_SRC = `
  precision mediump float;

  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uAlphaScale;

  varying float vIntensity;
  varying float vTint;
  varying float vDepthFade;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord) * 2.0;
    if (dist > 1.0) discard;

    float core = smoothstep(1.0, 0.15, dist);
    float hotCenter = smoothstep(0.55, 0.0, dist);

    vec3 baseCol = mix(uColorA, uColorB, clamp(vTint, 0.0, 1.0));
    vec3 finalCol = mix(baseCol, uColorC, hotCenter * (0.35 + vIntensity * 0.55));
    float alpha = core * (0.38 + vIntensity * 0.62) * vDepthFade * uAlphaScale;

    gl_FragColor = vec4(finalCol, clamp(alpha, 0.0, 1.0));
  }
`;

const LINE_FRAGMENT_SHADER_SRC = `
  precision mediump float;

  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uAlphaScale;

  varying float vIntensity;
  varying float vTint;
  varying float vDepthFade;

  void main() {
    vec3 baseCol = mix(uColorA, uColorB, clamp(vTint, 0.0, 1.0));
    vec3 finalCol = mix(baseCol, uColorC, vIntensity * 0.38);
    float alpha = (0.14 + vIntensity * 0.72) * vDepthFade * uAlphaScale;

    gl_FragColor = vec4(finalCol, clamp(alpha, 0.0, 1.0));
  }
`;

function hexToRgbNorm(hex: string, fallback: [number, number, number]): [number, number, number] {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return [r / 255, g / 255, b / 255];
    }
  }
  if (cleaned.length >= 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return [r / 255, g / 255, b / 255];
    }
  }
  return fallback;
}

function get3DMoodColors(
  mood: MoodEnvironmentType | undefined,
  track: Track | null,
  theme: ThemePalette
): {
  bg: [number, number, number];
  c1: [number, number, number];
  c2: [number, number, number];
  c3: [number, number, number];
} {
  const hint = `${mood || ''} ${track?.genre || ''} ${track?.title || ''}`.toLowerCase();
  if (/\b(water|meditation|zen|tibetan)\b/.test(hint)) {
    return {
      bg: [0.015, 0.09, 0.13],
      c1: [0.18, 0.83, 0.75],
      c2: [0.22, 0.74, 0.97],
      c3: [0.85, 0.98, 1.0],
    };
  }
  if (/\b(rain|sleep|nocturnal|lullaby)\b/.test(hint)) {
    return {
      bg: [0.03, 0.04, 0.12],
      c1: [0.51, 0.55, 0.97],
      c2: [0.38, 0.65, 0.98],
      c3: [0.92, 0.95, 1.0],
    };
  }
  if (/\b(warmth|lofi|acoustic|folk|jazz|soul|romantic)\b/.test(hint)) {
    return {
      bg: [0.09, 0.035, 0.025],
      c1: [0.98, 0.57, 0.24],
      c2: [0.96, 0.45, 0.71],
      c3: [1.0, 0.94, 0.62],
    };
  }
  if (/\b(forest|nature|ocean)\b/.test(hint)) {
    return {
      bg: [0.015, 0.1, 0.075],
      c1: [0.2, 0.83, 0.6],
      c2: [0.64, 0.9, 0.21],
      c3: [0.85, 1.0, 0.92],
    };
  }
  if (/\b(energy|workout|phonk|edm|dance|techno|bass|rock|club)\b/.test(hint)) {
    return {
      bg: [0.09, 0.02, 0.1],
      c1: [0.96, 0.25, 0.37],
      c2: [0.75, 0.15, 0.83],
      c3: [0.45, 0.85, 1.0],
    };
  }
  return {
    bg: [0.025, 0.035, 0.11],
    c1: hexToRgbNorm(theme.accent, [0.22, 0.74, 0.97]),
    c2: hexToRgbNorm(theme.visSecondary, [0.66, 0.33, 0.97]),
    c3: [0.88, 0.96, 1.0],
  };
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexSrc: string,
  fragmentSrc: string
): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export const GeometricFlowWebGLCanvas: React.FC<GeometricFlowWebGLCanvasProps> = ({
  variant,
  currentTrack,
  isPlaying,
  theme,
  moodEnvironment,
  synthTargetBpm = null,
  transitionBpm = null,
  isCrossfading = false,
  analysisFrameRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const moodRef = useRef(moodEnvironment);
  moodRef.current = moodEnvironment;
  const trackRef = useRef(currentTrack);
  trackRef.current = currentTrack;
  const synthBpmRef = useRef<number | null>(synthTargetBpm ?? null);
  synthBpmRef.current = synthTargetBpm ?? null;
  const transitionBpmRef = useRef<number | null>(transitionBpm ?? null);
  transitionBpmRef.current = transitionBpm ?? null;
  const isCrossfadingRef = useRef<boolean>(Boolean(isCrossfading));
  isCrossfadingRef.current = Boolean(isCrossfading);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const is3D = variant === '3d';
    const gl = canvas.getContext('webgl', {
      alpha: !is3D,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!gl) return;

    const pointProgram = createProgram(gl, VERTEX_SHADER_SRC, POINT_FRAGMENT_SHADER_SRC);
    const lineProgram = createProgram(gl, VERTEX_SHADER_SRC, LINE_FRAGMENT_SHADER_SRC);
    if (!pointProgram || !lineProgram) return;

    // Grid topology dimensions
    const cols = is3D ? 22 : 20;
    const rows = is3D ? 15 : 10;
    const nodeCount = cols * rows;

    // Build deterministic edge index pairs (horizontal, vertical, alternating crystalline diagonal)
    const edgePairs: number[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (c + 1 < cols) {
          edgePairs.push(idx, idx + 1);
        }
        if (r + 1 < rows) {
          edgePairs.push(idx, idx + cols);
        }
        if (c + 1 < cols && r + 1 < rows && (r + c) % 2 === 0) {
          edgePairs.push(idx, idx + cols + 1);
        } else if (c - 1 >= 0 && r + 1 < rows && (r + c) % 2 === 1) {
          edgePairs.push(idx, idx + cols - 1);
        }
      }
    }
    const edgeVertexCount = edgePairs.length;

    // Pre-allocated typed buffers (zero per-frame allocations)
    // Stride = 6 floats: x, y, z, size, intensity, tint
    const STRIDE = 6;
    const STRIDE_BYTES = STRIDE * 4;
    const pointData = new Float32Array(nodeCount * STRIDE);
    const lineData = new Float32Array(edgeVertexCount * STRIDE);

    const pointVbo = gl.createBuffer();
    const lineVbo = gl.createBuffer();
    if (!pointVbo || !lineVbo) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, pointVbo);
    gl.bufferData(gl.ARRAY_BUFFER, pointData.byteLength, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, lineVbo);
    gl.bufferData(gl.ARRAY_BUFFER, lineData.byteLength, gl.DYNAMIC_DRAW);

    const getLocations = (program: WebGLProgram) => ({
      aPosition: gl.getAttribLocation(program, 'aPosition'),
      aSize: gl.getAttribLocation(program, 'aSize'),
      aIntensity: gl.getAttribLocation(program, 'aIntensity'),
      aTint: gl.getAttribLocation(program, 'aTint'),
      uResolution: gl.getUniformLocation(program, 'uResolution'),
      uPerspective: gl.getUniformLocation(program, 'uPerspective'),
      uDpr: gl.getUniformLocation(program, 'uDpr'),
      uIs3D: gl.getUniformLocation(program, 'uIs3D'),
      uColorA: gl.getUniformLocation(program, 'uColorA'),
      uColorB: gl.getUniformLocation(program, 'uColorB'),
      uColorC: gl.getUniformLocation(program, 'uColorC'),
      uAlphaScale: gl.getUniformLocation(program, 'uAlphaScale'),
    });

    const pLoc = getLocations(pointProgram);
    const lLoc = getLocations(lineProgram);

    const bindAttributes = (loc: ReturnType<typeof getLocations>) => {
      if (loc.aPosition >= 0) {
        gl.enableVertexAttribArray(loc.aPosition);
        gl.vertexAttribPointer(loc.aPosition, 3, gl.FLOAT, false, STRIDE_BYTES, 0);
      }
      if (loc.aSize >= 0) {
        gl.enableVertexAttribArray(loc.aSize);
        gl.vertexAttribPointer(loc.aSize, 1, gl.FLOAT, false, STRIDE_BYTES, 12);
      }
      if (loc.aIntensity >= 0) {
        gl.enableVertexAttribArray(loc.aIntensity);
        gl.vertexAttribPointer(loc.aIntensity, 1, gl.FLOAT, false, STRIDE_BYTES, 16);
      }
      if (loc.aTint >= 0) {
        gl.enableVertexAttribArray(loc.aTint);
        gl.vertexAttribPointer(loc.aTint, 1, gl.FLOAT, false, STRIDE_BYTES, 20);
      }
    };

    gl.enable(gl.BLEND);

    let rafId = 0;
    let disposed = false;
    let time = 0;
    let smoothTreble = 0.08;
    let smoothBass = 0.08;
    let smoothMid = 0.08;
    let treblePeakHold = 0.08;
    let lastTimestamp = performance.now();

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(rafId);
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);

    const render = (now: number) => {
      if (disposed) return;

      const elapsed = Math.min(48, Math.max(8, now - lastTimestamp));
      lastTimestamp = now;
      const dt = elapsed / 16.667;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      const targetW = Math.floor(width * dpr);
      const targetH = Math.floor(height * dpr);

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      gl.viewport(0, 0, targetW, targetH);

      const frame = analysisFrameRef.current;
      const playing = isPlayingRef.current;

      const activeBpm =
        frame.transitionTempoBpm ??
        transitionBpmRef.current ??
        synthBpmRef.current ??
        frame.estimatedBpm ??
        trackRef.current?.bpm ??
        108;
      const tempoScale = Math.max(0.55, Math.min(1.85, activeBpm / 108));
      const xfProgress = frame.crossfadeProgress ?? 0;
      const xfSurge =
        isCrossfadingRef.current || frame.crossfadeProgress != null
          ? Math.sin(Math.max(0, Math.min(1, xfProgress)) * Math.PI)
          : 0;

      time += (playing ? 0.022 * tempoScale : 0.007) * (prefersReduced ? 0.25 : 1) * dt;

      // Extract upper-band treble energy directly from FFT bins + frame.high
      const freq = frame.frequencyData;
      const highStart = Math.floor(freq.length * 0.42);
      const highEnd = Math.floor(freq.length * 0.88);
      let highBinSum = 0;
      const highSpan = Math.max(1, highEnd - highStart);
      for (let b = highStart; b < highEnd; b++) {
        highBinSum += freq[b] / 255;
      }
      const rawTreble = playing
        ? Math.min(1, frame.high * 0.68 + (highBinSum / highSpan) * 0.65)
        : 0.06 + 0.05 * Math.sin(time * 1.4);

      const targetBass = playing ? frame.bass : 0.06;
      const targetMid = playing ? frame.mid : 0.08;

      // Fast attack on treble sparkles, elastic contraction on decay
      const attackRate = rawTreble > smoothTreble ? 0.36 : 0.14;
      smoothTreble += (rawTreble - smoothTreble) * attackRate;
      smoothBass += (targetBass - smoothBass) * 0.2;
      smoothMid += (targetMid - smoothMid) * 0.2;
      if (smoothTreble > treblePeakHold) {
        treblePeakHold = smoothTreble;
      } else {
        treblePeakHold = Math.max(smoothTreble, treblePeakHold - 0.012 * dt);
      }

      // Expansion / Contraction factor strictly governed by Treble energy:
      // Quiet / low treble contracts inward (0.72x); bright treble expands outward (up to 1.44x)
      const expansionScale =
        0.72 + smoothTreble * 0.66 + treblePeakHold * 0.14 + xfSurge * 0.12;

      const curTheme = themeRef.current;
      let bgR = 0;
      let bgG = 0;
      let bgB = 0;
      let bgA = 0;
      let c1: [number, number, number];
      let c2: [number, number, number];
      let c3: [number, number, number];

      if (is3D) {
        const moodCols = get3DMoodColors(moodRef.current, trackRef.current, curTheme);
        bgR = moodCols.bg[0];
        bgG = moodCols.bg[1];
        bgB = moodCols.bg[2];
        bgA = 1;
        c1 = moodCols.c1;
        c2 = moodCols.c2;
        c3 = moodCols.c3;
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      } else {
        c1 = hexToRgbNorm(curTheme.accent, [0.85, 0.31, 0.16]);
        c2 = hexToRgbNorm(curTheme.visSecondary, [0.17, 0.36, 0.52]);
        c3 = curTheme.mode === 'dark' ? [1.0, 0.96, 0.88] : c1;
        if (curTheme.mode === 'dark') {
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        } else {
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        }
      }

      gl.clearColor(bgR, bgG, bgB, bgA);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // 3D rotation angles (subtle parallax in stage mode, deeper perspective tilt in 3D mode)
      const rotX = is3D
        ? -0.52 + Math.sin(time * 0.45) * 0.16
        : -0.14 + Math.sin(time * 0.4) * 0.05;
      const rotY = is3D
        ? Math.sin(time * 0.32) * 0.36
        : Math.sin(time * 0.28) * 0.08;
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      const spanX = is3D ? 1.52 : 1.56;
      const spanY = is3D ? 1.18 : 1.24;

      // 1. Update point VBO data in-place (zero allocations)
      for (let r = 0; r < rows; r++) {
        const vNorm = (r / (rows - 1)) * 2 - 1; // -1..1
        for (let c = 0; c < cols; c++) {
          const uNorm = (c / (cols - 1)) * 2 - 1; // -1..1
          const idx = r * cols + c;
          const baseOffset = idx * STRIDE;

          const radialDist = Math.hypot(uNorm, vNorm);
          // Map each node to upper-spectrum treble frequency bin
          const fftIdx = Math.min(
            freq.length - 1,
            highStart + Math.floor(((idx * 13) % highSpan))
          );
          const binTreble = playing ? freq[fftIdx] / 255 : 0.08;

          // Radial breathing expansion/contraction + curl flow displacement
          const radialPulse =
            expansionScale +
            Math.sin(radialDist * 5.2 - time * 2.6) * (0.04 + smoothTreble * 0.14);

          const flowCurlX =
            Math.sin(vNorm * 3.1 + time * 1.45) * (0.025 + smoothMid * 0.055 + smoothTreble * 0.04);
          const flowCurlY =
            Math.cos(uNorm * 3.1 - time * 1.35) * (0.025 + smoothMid * 0.055 + smoothTreble * 0.04);

          const x0 = (uNorm * spanX * 0.5 + flowCurlX) * radialPulse;
          const y0 = (vNorm * spanY * 0.5 + flowCurlY) * radialPulse;
          const z0 =
            Math.sin(uNorm * 4.0 + time * 1.9) *
              Math.cos(vNorm * 3.5 - time * 1.6) *
              (0.14 + smoothTreble * 0.42 + smoothBass * 0.16) +
            binTreble * (0.24 + smoothTreble * 0.25);

          // Rotate Y then X
          const x1 = x0 * cosY - z0 * sinY;
          const z1 = z0 * cosY + x0 * sinY;
          const y2 = y0 * cosX - z1 * sinX;
          const z2 = z1 * cosX + y0 * sinX;

          const energy = Math.min(1, 0.18 + smoothTreble * 0.55 + binTreble * 0.52);
          const size = (is3D ? 5.6 : 4.6) + energy * (is3D ? 8.4 : 6.2);
          const tint = 0.5 + 0.5 * Math.sin(radialDist * 2.4 - time * 1.2 + uNorm * 1.1);

          pointData[baseOffset] = x1;
          pointData[baseOffset + 1] = y2;
          pointData[baseOffset + 2] = z2;
          pointData[baseOffset + 3] = size;
          pointData[baseOffset + 4] = energy;
          pointData[baseOffset + 5] = tint;
        }
      }

      // 2. Populate interconnected lattice edge VBO directly from computed node positions
      for (let e = 0; e < edgeVertexCount; e++) {
        const nodeIdx = edgePairs[e];
        const src = nodeIdx * STRIDE;
        const dst = e * STRIDE;
        lineData[dst] = pointData[src];
        lineData[dst + 1] = pointData[src + 1];
        lineData[dst + 2] = pointData[src + 2];
        lineData[dst + 3] = 1.0;
        lineData[dst + 4] = pointData[src + 4];
        lineData[dst + 5] = pointData[src + 5];
      }

      const perspective = is3D ? 2.35 : 2.9;
      const alphaScale = is3D ? 1.0 : curTheme.mode === 'dark' ? 0.95 : 0.88;

      // 3. Upload & draw interconnected geometric mesh lines
      gl.useProgram(lineProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, lineVbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, lineData);
      bindAttributes(lLoc);

      gl.uniform2f(lLoc.uResolution, width, height);
      gl.uniform1f(lLoc.uPerspective, perspective);
      gl.uniform1f(lLoc.uDpr, dpr);
      gl.uniform1f(lLoc.uIs3D, is3D ? 1.0 : 0.0);
      gl.uniform3fv(lLoc.uColorA, c1);
      gl.uniform3fv(lLoc.uColorB, c2);
      gl.uniform3fv(lLoc.uColorC, c3);
      gl.uniform1f(lLoc.uAlphaScale, alphaScale);
      gl.drawArrays(gl.LINES, 0, edgeVertexCount);

      // 4. Upload & draw glowing WebGL particle nodes
      gl.useProgram(pointProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, pointVbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, pointData);
      bindAttributes(pLoc);

      gl.uniform2f(pLoc.uResolution, width, height);
      gl.uniform1f(pLoc.uPerspective, perspective);
      gl.uniform1f(pLoc.uDpr, dpr);
      gl.uniform1f(pLoc.uIs3D, is3D ? 1.0 : 0.0);
      gl.uniform3fv(pLoc.uColorA, c1);
      gl.uniform3fv(pLoc.uColorB, c2);
      gl.uniform3fv(pLoc.uColorC, c3);
      gl.uniform1f(pLoc.uAlphaScale, alphaScale);
      gl.drawArrays(gl.POINTS, 0, nodeCount);

      if (!prefersReduced) {
        rafId = requestAnimationFrame(render);
      }
    };

    rafId = requestAnimationFrame(render);
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      gl.deleteBuffer(pointVbo);
      gl.deleteBuffer(lineVbo);
      gl.deleteProgram(pointProgram);
      gl.deleteProgram(lineProgram);
    };
  }, [analysisFrameRef, variant]);

  return (
    <canvas
      ref={canvasRef}
      className={variant === '3d' ? 'w-full h-full block rounded-2xl' : 'w-full h-full block'}
      aria-label="Geometric Flow WebGL treble-reactive particle grid visualizer"
    />
  );
};
