import React, { useEffect, useRef } from 'react';
import { ThemePalette } from '../themes/themes';
import { AudioAnalysisFrame, Track } from '../types/audio';
import { MoodEnvironmentType } from './MoodEnvironmentBackdrop';

interface GlitchShiftWebGLCanvasProps {
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

const MESH_VERTEX_SHADER = `
  attribute vec3 aPosition;
  attribute vec3 aNormal;

  uniform mat4 uMvpMatrix;
  uniform mat3 uNormalMatrix;
  uniform float uTime;
  uniform float uTransient;
  uniform float uHigh;
  uniform float uBass;
  uniform float uGlitchSeed;
  uniform float uWireOffset;

  varying vec3 vNormal;
  varying float vGlitchEnergy;
  varying float vEdgeGlow;

  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec3 pos = aPosition;
    vec3 norm = normalize(aNormal);

    // 1. Horizontal quantized glitch slice shear driven by high-frequency transients
    float sliceCount = 7.0 + floor(uHigh * 8.0);
    float bandId = floor((pos.y + 1.2) * sliceCount);
    float bandNoise = hash13(vec3(bandId, uGlitchSeed, 4.7)) * 2.0 - 1.0;
    float sliceTrigger = step(0.45 - uTransient * 0.35, abs(bandNoise));
    float sliceShift = bandNoise * sliceTrigger * (uTransient * 0.44 + uHigh * 0.14);
    pos.x += sliceShift;
    pos.z += bandNoise * sliceTrigger * (uTransient * 0.18);

    // 2. Rapid spiky vertex normal displacement on sharp electronic hits
    float vNoise = hash13(floor(pos * 9.0) + vec3(uGlitchSeed * 1.7));
    float spikeWave = sin(pos.y * 11.0 + uTime * 16.0) * cos(pos.x * 9.0 - uTime * 13.0);
    float normalPush =
      (uBass * 0.12) +
      (spikeWave * (0.04 + uHigh * 0.18)) +
      ((vNoise - 0.5) * uTransient * 0.58);

    pos += norm * (normalPush + uWireOffset);

    gl_Position = uMvpMatrix * vec4(pos, 1.0);
    vNormal = normalize(uNormalMatrix * norm);
    vGlitchEnergy = clamp(abs(sliceShift) * 2.0 + uTransient * 0.85 + uHigh * 0.35, 0.0, 1.5);
    vEdgeGlow = clamp(abs(vNoise) * uTransient + uHigh * 0.4, 0.0, 1.0);
  }
`;

const MESH_FRAGMENT_SHADER = `
  precision mediump float;

  uniform vec3 uColorPrimary;
  uniform vec3 uColorSecondary;
  uniform vec3 uColorHot;
  uniform float uIsWireframe;
  uniform float uTransient;
  uniform float uHigh;

  varying vec3 vNormal;
  varying float vGlitchEnergy;
  varying float vEdgeGlow;

  void main() {
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    float fresnel = pow(1.0 - max(0.0, abs(dot(normalize(vNormal), viewDir))), 2.1);

    if (uIsWireframe > 0.5) {
      vec3 wireCol = mix(uColorPrimary, uColorHot, clamp(vGlitchEnergy * 0.75, 0.0, 1.0));
      float alpha = clamp(0.48 + fresnel * 0.45 + uTransient * 0.32 + uHigh * 0.18, 0.25, 1.0);
      gl_FragColor = vec4(wireCol, alpha);
      return;
    }

    vec3 lightDir = normalize(vec3(0.55, 0.72, 0.85));
    float diff = max(0.14, dot(normalize(vNormal), lightDir));
    vec3 baseCol = mix(uColorSecondary * 0.35, uColorPrimary, diff);
    vec3 rimCol = mix(baseCol, uColorHot, clamp(fresnel * 0.8 + vEdgeGlow * 0.45, 0.0, 1.0));
    float bodyAlpha = clamp(0.62 + fresnel * 0.35 + uTransient * 0.15, 0.0, 0.96);

    gl_FragColor = vec4(rimCol, bodyAlpha);
  }
`;

const POST_VERTEX_SHADER = `
  attribute vec2 aQuadPos;
  varying vec2 vUv;
  void main() {
    vUv = aQuadPos * 0.5 + 0.5;
    gl_Position = vec4(aQuadPos, 0.0, 1.0);
  }
`;

const POST_FRAGMENT_SHADER = `
  precision mediump float;

  uniform sampler2D uSceneTex;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uTransient;
  uniform float uHigh;
  uniform float uGlitchSeed;
  uniform float uIs3D;
  uniform vec3 uBgTop;
  uniform vec3 uBgBottom;

  varying vec2 vUv;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec2 uv = vUv;

    // Horizontal electronic scanline tear blocks during high-frequency transients
    float bandQuant = floor(uv.y * (18.0 + uHigh * 22.0));
    float bandRnd = hash12(vec2(bandQuant, floor(uGlitchSeed * 2.0)));
    float tearMask = step(0.76 - uTransient * 0.42, bandRnd);
    float tearOffset = (bandRnd - 0.5) * 0.095 * uTransient * tearMask;
    uv.x = clamp(uv.x + tearOffset, 0.002, 0.998);

    // Chromatic aberration offset scaled sharply by high-frequency transients
    vec2 dirFromCenter = uv - vec2(0.5);
    float radialDist = length(dirFromCenter);
    float aberrationAmt = (0.0035 + uHigh * 0.012 + uTransient * 0.036) * (0.45 + radialDist * 1.15);
    vec2 rShift = vec2(aberrationAmt, aberrationAmt * 0.22 * sin(uTime * 18.0));
    vec2 bShift = vec2(-aberrationAmt, -aberrationAmt * 0.22 * cos(uTime * 15.0));

    vec4 sR = texture2D(uSceneTex, clamp(uv + rShift, 0.001, 0.999));
    vec4 sG = texture2D(uSceneTex, uv);
    vec4 sB = texture2D(uSceneTex, clamp(uv + bShift, 0.001, 0.999));

    // Crisp RGB channel separation preserving clean alpha fringes
    vec3 meshRgb = vec3(sR.r * sR.a, sG.g * sG.a, sB.b * sB.a);
    float meshAlpha = clamp(max(sR.a, max(sG.a, sB.a)), 0.0, 1.0);

    // Fine electronic scanline modulation on transient spikes
    float scanline = 1.0 - (0.08 + uTransient * 0.14) * (0.5 + 0.5 * sin(uv.y * uResolution.y * 1.4));
    meshRgb *= scanline;

    if (uIs3D > 0.5) {
      vec3 bg = mix(uBgBottom, uBgTop, uv.y);
      // Subtle cyber grid horizon glow in 3D backdrop
      float vignette = smoothstep(1.05, 0.2, radialDist);
      vec3 bgLit = bg * (0.7 + vignette * 0.45);
      vec3 composed = bgLit * (1.0 - meshAlpha) + meshRgb;
      gl_FragColor = vec4(clamp(composed, 0.0, 1.0), 1.0);
    } else {
      vec3 unpremul = meshAlpha > 0.001 ? meshRgb / meshAlpha : vec3(0.0);
      gl_FragColor = vec4(clamp(unpremul, 0.0, 1.0), meshAlpha);
    }
  }
`;

function hexToRgbNorm(hex: string, fallback: [number, number, number]): [number, number, number] {
  const cleaned = hex.replace('#', '').trim();
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

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vSrc: string,
  fSrc: string
): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fSrc);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const prog = gl.createProgram();
  if (!prog) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

/**
 * Generates a subdivided 3D icosphere mesh (positions, smooth vertex normals,
 * triangle indices, and deduplicated wireframe edge indices).
 */
function buildSubdividedIcosphere(subdivisions: number) {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts: number[] = [
    -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, 0,
    0, -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t,
    t, 0, -1, t, 0, 1, -t, 0, -1, -t, 0, 1,
  ];

  const normalizeVert = (idx: number) => {
    const o = idx * 3;
    const len = Math.hypot(verts[o], verts[o + 1], verts[o + 2]) || 1;
    verts[o] /= len;
    verts[o + 1] /= len;
    verts[o + 2] /= len;
  };
  for (let i = 0; i < verts.length / 3; i++) normalizeVert(i);

  let faces: number[] = [
    0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11,
    1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
    3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9,
    4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
  ];

  const midCache = new Map<string, number>();
  const getMidpoint = (a: number, b: number) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    const existing = midCache.get(key);
    if (existing !== undefined) return existing;
    const oa = a * 3;
    const ob = b * 3;
    const mx = (verts[oa] + verts[ob]) * 0.5;
    const my = (verts[oa + 1] + verts[ob + 1]) * 0.5;
    const mz = (verts[oa + 2] + verts[ob + 2]) * 0.5;
    const len = Math.hypot(mx, my, mz) || 1;
    const idx = verts.length / 3;
    verts.push(mx / len, my / len, mz / len);
    midCache.set(key, idx);
    return idx;
  };

  for (let s = 0; s < subdivisions; s++) {
    const nextFaces: number[] = [];
    for (let i = 0; i < faces.length; i += 3) {
      const a = faces[i];
      const b = faces[i + 1];
      const c = faces[i + 2];
      const ab = getMidpoint(a, b);
      const bc = getMidpoint(b, c);
      const ca = getMidpoint(c, a);
      nextFaces.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
    }
    faces = nextFaces;
  }

  // Deduplicate wireframe edges
  const edgeSet = new Set<string>();
  const wireIndices: number[] = [];
  const addEdge = (u: number, v: number) => {
    const key = u < v ? `${u}_${v}` : `${v}_${u}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      wireIndices.push(u, v);
    }
  };
  for (let i = 0; i < faces.length; i += 3) {
    addEdge(faces[i], faces[i + 1]);
    addEdge(faces[i + 1], faces[i + 2]);
    addEdge(faces[i + 2], faces[i]);
  }

  const posArray = new Float32Array(verts);
  return {
    positions: posArray,
    normals: new Float32Array(verts), // unit sphere -> normal equals position
    triIndices: new Uint16Array(faces),
    wireIndices: new Uint16Array(wireIndices),
  };
}

function buildMvpAndNormal(
  aspect: number,
  rotX: number,
  rotY: number,
  rotZ: number,
  scale: number,
  camDist: number,
  outMvp: Float32Array,
  outNorm: Float32Array
) {
  const cx = Math.cos(rotX);
  const sx = Math.sin(rotX);
  const cy = Math.cos(rotY);
  const sy = Math.sin(rotY);
  const cz = Math.cos(rotZ);
  const sz = Math.sin(rotZ);

  // Rotation matrix R = Rz * Ry * Rx
  const r00 = cy * cz;
  const r01 = cz * sy * sx - sz * cx;
  const r02 = cz * sy * cx + sz * sx;

  const r10 = cy * sz;
  const r11 = sz * sy * sx + cz * cx;
  const r12 = sz * sy * cx - cz * sx;

  const r20 = -sy;
  const r21 = cy * sx;
  const r22 = cy * cx;

  outNorm[0] = r00;
  outNorm[1] = r10;
  outNorm[2] = r20;
  outNorm[3] = r01;
  outNorm[4] = r11;
  outNorm[5] = r21;
  outNorm[6] = r02;
  outNorm[7] = r12;
  outNorm[8] = r22;

  // Perspective matrix (fovY ~ 48 deg)
  const f = 1 / Math.tan((48 * Math.PI) / 360);
  const near = 0.2;
  const far = 20.0;
  const nf = 1 / (near - far);
  const p00 = f / Math.max(0.25, aspect);
  const p11 = f;
  const p22 = (far + near) * nf;
  const p32 = 2 * far * near * nf;

  // Model-view = Translate(0, 0, -camDist) * R * Scale(scale)
  const m00 = r00 * scale;
  const m01 = r01 * scale;
  const m02 = r02 * scale;
  const m10 = r10 * scale;
  const m11 = r11 * scale;
  const m12 = r12 * scale;
  const m20 = r20 * scale;
  const m21 = r21 * scale;
  const m22 = r22 * scale;

  // Column-major MVP = P * MV
  outMvp[0] = p00 * m00;
  outMvp[1] = p11 * m10;
  outMvp[2] = p22 * m20;
  outMvp[3] = -m20;

  outMvp[4] = p00 * m01;
  outMvp[5] = p11 * m11;
  outMvp[6] = p22 * m21;
  outMvp[7] = -m21;

  outMvp[8] = p00 * m02;
  outMvp[9] = p11 * m12;
  outMvp[10] = p22 * m22;
  outMvp[11] = -m22;

  outMvp[12] = 0;
  outMvp[13] = 0;
  outMvp[14] = p22 * -camDist + p32;
  outMvp[15] = camDist;
}

export const GlitchShiftWebGLCanvas: React.FC<GlitchShiftWebGLCanvasProps> = ({
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
    if (!gl) return;

    const meshProg = createProgram(gl, MESH_VERTEX_SHADER, MESH_FRAGMENT_SHADER);
    const postProg = createProgram(gl, POST_VERTEX_SHADER, POST_FRAGMENT_SHADER);
    if (!meshProg || !postProg) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mesh = buildSubdividedIcosphere(is3D ? 3 : 2);

    const posBuf = gl.createBuffer();
    const normBuf = gl.createBuffer();
    const triIdxBuf = gl.createBuffer();
    const wireIdxBuf = gl.createBuffer();
    const quadBuf = gl.createBuffer();
    const fbo = gl.createFramebuffer();
    const sceneTex = gl.createTexture();
    const depthRb = gl.createRenderbuffer();

    if (!posBuf || !normBuf || !triIdxBuf || !wireIdxBuf || !quadBuf || !fbo || !sceneTex || !depthRb) {
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triIdxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.triIndices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wireIdxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.wireIndices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const meshLoc = {
      aPosition: gl.getAttribLocation(meshProg, 'aPosition'),
      aNormal: gl.getAttribLocation(meshProg, 'aNormal'),
      uMvpMatrix: gl.getUniformLocation(meshProg, 'uMvpMatrix'),
      uNormalMatrix: gl.getUniformLocation(meshProg, 'uNormalMatrix'),
      uTime: gl.getUniformLocation(meshProg, 'uTime'),
      uTransient: gl.getUniformLocation(meshProg, 'uTransient'),
      uHigh: gl.getUniformLocation(meshProg, 'uHigh'),
      uBass: gl.getUniformLocation(meshProg, 'uBass'),
      uGlitchSeed: gl.getUniformLocation(meshProg, 'uGlitchSeed'),
      uWireOffset: gl.getUniformLocation(meshProg, 'uWireOffset'),
      uColorPrimary: gl.getUniformLocation(meshProg, 'uColorPrimary'),
      uColorSecondary: gl.getUniformLocation(meshProg, 'uColorSecondary'),
      uColorHot: gl.getUniformLocation(meshProg, 'uColorHot'),
      uIsWireframe: gl.getUniformLocation(meshProg, 'uIsWireframe'),
    };

    const postLoc = {
      aQuadPos: gl.getAttribLocation(postProg, 'aQuadPos'),
      uSceneTex: gl.getUniformLocation(postProg, 'uSceneTex'),
      uResolution: gl.getUniformLocation(postProg, 'uResolution'),
      uTime: gl.getUniformLocation(postProg, 'uTime'),
      uTransient: gl.getUniformLocation(postProg, 'uTransient'),
      uHigh: gl.getUniformLocation(postProg, 'uHigh'),
      uGlitchSeed: gl.getUniformLocation(postProg, 'uGlitchSeed'),
      uIs3D: gl.getUniformLocation(postProg, 'uIs3D'),
      uBgTop: gl.getUniformLocation(postProg, 'uBgTop'),
      uBgBottom: gl.getUniformLocation(postProg, 'uBgBottom'),
    };

    let fboW = 0;
    let fboH = 0;
    const ensureFboSize = (w: number, h: number) => {
      if (fboW === w && fboH === h) return;
      fboW = w;
      fboH = h;
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRb);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };

    const mvpMatrix = new Float32Array(16);
    const normMatrix = new Float32Array(9);

    let rafId = 0;
    let disposed = false;
    let time = 0;
    let prevHighFlux = 0;
    let transientEnvelope = 0.05;
    let smoothHigh = 0.08;
    let smoothBass = 0.08;
    let glitchSeed = 1.0;
    let lastTimestamp = performance.now();

    const onContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(rafId);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

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
      ensureFboSize(targetW, targetH);

      const frame = analysisFrameRef.current;
      const playing = isPlayingRef.current;
      const activeBpm =
        frame.transitionTempoBpm ??
        transitionBpmRef.current ??
        synthBpmRef.current ??
        frame.estimatedBpm ??
        trackRef.current?.bpm ??
        118;
      const tempoScale = Math.max(0.55, Math.min(1.9, activeBpm / 118));
      const xfProgress = frame.crossfadeProgress ?? 0;
      const xfSurge =
        isCrossfadingRef.current || frame.crossfadeProgress != null
          ? Math.sin(Math.max(0, Math.min(1, xfProgress)) * Math.PI)
          : 0;

      time += (playing ? 0.021 * tempoScale : 0.007) * (prefersReduced ? 0.22 : 1) * dt;

      // High-frequency transient detector (spectral flux across upper bins + frame.high)
      const freq = frame.frequencyData;
      const hStart = Math.floor(freq.length * 0.38);
      const hEnd = Math.floor(freq.length * 0.9);
      let hSum = 0;
      for (let i = hStart; i < hEnd; i++) {
        hSum += freq[i] / 255;
      }
      const hAvg = hSum / Math.max(1, hEnd - hStart);
      const highEnergy = playing ? Math.min(1, frame.high * 0.65 + hAvg * 0.72) : 0.05;
      const positiveFlux = Math.max(0, highEnergy - prevHighFlux);
      prevHighFlux = highEnergy * 0.75 + prevHighFlux * 0.25;

      const transientHit = playing
        ? Math.min(1, positiveFlux * 5.8 + (frame.isBeat ? 0.42 : 0) + xfSurge * 0.28)
        : 0.04 + 0.03 * Math.sin(time * 2.0);

      if (transientHit > transientEnvelope) {
        transientEnvelope = transientHit;
        if (transientHit > 0.28 && !prefersReduced) {
          glitchSeed = (glitchSeed + 1.37) % 100.0;
        }
      } else {
        transientEnvelope = Math.max(0.03, transientEnvelope - 0.045 * dt);
      }

      smoothHigh += (highEnergy - smoothHigh) * 0.34;
      smoothBass += ((playing ? frame.bass : 0.06) - smoothBass) * 0.24;

      const curTheme = themeRef.current;
      const cPrimary = is3D
        ? [0.16, 0.88, 0.98]
        : hexToRgbNorm(curTheme.accent, [0.85, 0.31, 0.16]);
      const cSecondary = is3D
        ? [0.76, 0.24, 0.98]
        : hexToRgbNorm(curTheme.visSecondary, [0.17, 0.36, 0.52]);
      const cHot = is3D
        ? [1.0, 0.24, 0.56]
        : curTheme.mode === 'dark'
          ? [1.0, 0.94, 0.85]
          : hexToRgbNorm(curTheme.accent, [0.95, 0.25, 0.2]);

      const effectiveTransient = prefersReduced ? transientEnvelope * 0.15 : transientEnvelope;

      // 1. Render 3D displaced mesh + wireframe into Offscreen Framebuffer (FBO)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, targetW, targetH);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const rotX = time * 0.62 + effectiveTransient * 0.18;
      const rotY = time * 0.95 + smoothHigh * 0.35;
      const rotZ = Math.sin(time * 0.45) * 0.35;
      const camDist = is3D ? 3.25 : 3.45;
      const meshScale = (is3D ? 1.05 : 1.18) + smoothBass * 0.14 + effectiveTransient * 0.08;

      buildMvpAndNormal(
        width / Math.max(1, height),
        rotX,
        rotY,
        rotZ,
        meshScale,
        camDist,
        mvpMatrix,
        normMatrix
      );

      gl.useProgram(meshProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      if (meshLoc.aPosition >= 0) {
        gl.enableVertexAttribArray(meshLoc.aPosition);
        gl.vertexAttribPointer(meshLoc.aPosition, 3, gl.FLOAT, false, 0, 0);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
      if (meshLoc.aNormal >= 0) {
        gl.enableVertexAttribArray(meshLoc.aNormal);
        gl.vertexAttribPointer(meshLoc.aNormal, 3, gl.FLOAT, false, 0, 0);
      }

      gl.uniformMatrix4fv(meshLoc.uMvpMatrix, false, mvpMatrix);
      gl.uniformMatrix3fv(meshLoc.uNormalMatrix, false, normMatrix);
      gl.uniform1f(meshLoc.uTime, time);
      gl.uniform1f(meshLoc.uTransient, effectiveTransient);
      gl.uniform1f(meshLoc.uHigh, smoothHigh);
      gl.uniform1f(meshLoc.uBass, smoothBass);
      gl.uniform1f(meshLoc.uGlitchSeed, glitchSeed);
      gl.uniform3fv(meshLoc.uColorPrimary, cPrimary);
      gl.uniform3fv(meshLoc.uColorSecondary, cSecondary);
      gl.uniform3fv(meshLoc.uColorHot, cHot);

      // Shaded 3D core faces
      gl.uniform1f(meshLoc.uWireOffset, 0.0);
      gl.uniform1f(meshLoc.uIsWireframe, 0.0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triIdxBuf);
      gl.drawElements(gl.TRIANGLES, mesh.triIndices.length, gl.UNSIGNED_SHORT, 0);

      // Sharp electronic wireframe overlay
      gl.uniform1f(meshLoc.uWireOffset, 0.008);
      gl.uniform1f(meshLoc.uIsWireframe, 1.0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wireIdxBuf);
      gl.drawElements(gl.LINES, mesh.wireIndices.length, gl.UNSIGNED_SHORT, 0);

      // 2. Render Chromatic Aberration & Scanline Glitch Post-Process to Canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, targetW, targetH);
      gl.disable(gl.DEPTH_TEST);
      gl.clearColor(0, 0, 0, is3D ? 1 : 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(postProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      if (postLoc.aQuadPos >= 0) {
        gl.enableVertexAttribArray(postLoc.aQuadPos);
        gl.vertexAttribPointer(postLoc.aQuadPos, 2, gl.FLOAT, false, 0, 0);
      }

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.uniform1i(postLoc.uSceneTex, 0);
      gl.uniform2f(postLoc.uResolution, width, height);
      gl.uniform1f(postLoc.uTime, time);
      gl.uniform1f(postLoc.uTransient, effectiveTransient);
      gl.uniform1f(postLoc.uHigh, smoothHigh);
      gl.uniform1f(postLoc.uGlitchSeed, glitchSeed);
      gl.uniform1f(postLoc.uIs3D, is3D ? 1.0 : 0.0);
      gl.uniform3f(postLoc.uBgTop, 0.02, 0.025, 0.08);
      gl.uniform3f(postLoc.uBgBottom, 0.07, 0.03, 0.14);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (!prefersReduced) {
        rafId = requestAnimationFrame(render);
      }
    };

    rafId = requestAnimationFrame(render);
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      gl.deleteBuffer(posBuf);
      gl.deleteBuffer(normBuf);
      gl.deleteBuffer(triIdxBuf);
      gl.deleteBuffer(wireIdxBuf);
      gl.deleteBuffer(quadBuf);
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(sceneTex);
      gl.deleteRenderbuffer(depthRb);
      gl.deleteProgram(meshProg);
      gl.deleteProgram(postProg);
    };
  }, [analysisFrameRef, variant]);

  return (
    <canvas
      ref={canvasRef}
      className={variant === '3d' ? 'w-full h-full block rounded-2xl' : 'w-full h-full block'}
      aria-label="Glitch Shift 3D WebGL chromatic aberration visualizer"
    />
  );
};
