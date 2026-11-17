import {
  AudioBandMetrics,
  DeterministicVisualSeed,
  KineticLyricStyle,
  LanguagePhysicsPreset,
  SyncedLyricLine,
  SynesthesiaStoryboardPhase,
} from './types';

function hexToNormRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length >= 6) {
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return [r, g, b];
    }
  }
  return [0.22, 0.74, 0.97];
}

function hexToRgb255(hex: string): [number, number, number] {
  const [r, g, b] = hexToNormRgb(hex);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbaStr(rgb: [number, number, number], alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.max(0, Math.min(1, alpha))})`;
}

const VERTEX_SHADER = `
  attribute vec2 aPosition;
  varying vec2 vUv;
  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uPointerActive;

  uniform float uSubBass;
  uniform float uMidVocals;
  uniform float uTreble;
  uniform float uBeat;

  uniform float uChladniM;
  uniform float uChladniN;
  uniform float uSeedWarp;
  uniform float uPhaseOffset;
  uniform float uTurbulence;
  uniform float uStyleMode; // 0 = bengali-monsoon, 1 = sufi-lantern, 2 = cosmic-neon

  uniform vec3 uColPrimary;
  uniform vec3 uColSecondary;
  uniform vec3 uColAccent;
  uniform vec3 uColBg;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      v += amp * noise(p);
      p = p * 2.04 + vec2(1.7, 9.2);
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 aspect = vec2(uResolution.x / max(1.0, uResolution.y), 1.0);
    vec2 uv = (vUv - 0.5) * aspect;

    // Interactive Cursor / Touch Gravitational Lensing warp
    vec2 ptr = (uPointer - 0.5) * aspect;
    vec2 toPtr = uv - ptr;
    float ptrDist = length(toPtr) + 0.001;
    float lensStrength = uPointerActive * 0.12 / (ptrDist * ptrDist + 0.065);
    vec2 warpedUv = uv - normalize(toPtr) * min(0.28, lensStrength);

    // Sub-Bass gravitational radial breathing
    float r = length(warpedUv);
    float bassPull = uSubBass * 0.16 * exp(-r * 2.1);
    warpedUv *= (1.0 - bassPull);

    float t = uTime * (0.28 + uTurbulence * 0.28);

    // Cultural physics fluid flow
    vec2 q = vec2(
      fbm(warpedUv * (1.5 * uSeedWarp) + vec2(t * 0.45, uPhaseOffset)),
      fbm(warpedUv * (1.5 * uSeedWarp) + vec2(-t * 0.35, uPhaseOffset + 4.2))
    );

    float fluid = fbm(warpedUv * (2.2 + uTurbulence) + q * (1.2 + uMidVocals * 0.9) + t * 0.2);

    // Chladni / Cymatic standing wave pattern seeded uniquely per song
    float pi = 3.14159265;
    vec2 cUv = warpedUv * (1.35 + uBeat * 0.18);
    float chladni = cos(uChladniM * pi * cUv.x) * cos(uChladniN * pi * cUv.y)
                  - cos(uChladniN * pi * cUv.x) * cos(uChladniM * pi * cUv.y);
    float cymaticLine = smoothstep(0.24, 0.02, abs(chladni)) * (0.18 + uTreble * 0.65);

    vec3 col = uColBg;

    if (uStyleMode < 0.5) {
      // Bengali Monsoon: soft watercolor ink-in-water dispersion blooms
      float wash1 = smoothstep(0.25, 0.85, fluid);
      float wash2 = smoothstep(0.45, 0.92, q.x);
      col = mix(col, uColSecondary * 0.72, wash1 * 0.75);
      col = mix(col, uColPrimary * 0.88, wash2 * (0.45 + uMidVocals * 0.45));
      col += uColAccent * cymaticLine * 0.35;
    } else if (uStyleMode < 1.5) {
      // Sufi Lantern: sweeping golden desert sand-waves & warm ember aura
      float sandWave = sin(warpedUv.x * 5.0 + q.y * 4.2 - t * 1.4) * 0.5 + 0.5;
      float emberGlow = exp(-r * (2.6 - uMidVocals * 0.9));
      col = mix(col, uColSecondary * 0.75, sandWave * 0.52 * fluid);
      col += uColPrimary * emberGlow * (0.42 + uBeat * 0.36);
      col += uColAccent * cymaticLine * 0.48;
    } else {
      // Cosmic Neon: liquid chrome horizon & iridescent Cymatic lattice
      float chrome = sin((warpedUv.x * q.x - warpedUv.y * q.y) * 9.0 + t * 1.8) * 0.5 + 0.5;
      float nebula = smoothstep(0.3, 0.85, fluid);
      col = mix(col, uColSecondary * 0.7, nebula * 0.65);
      col += uColPrimary * pow(chrome, 2.2) * (0.35 + uMidVocals * 0.55);
      col += uColAccent * cymaticLine * 0.68;
    }

    // Gravitational pointer lens halo
    float lensGlow = uPointerActive * exp(-ptrDist * 4.5) * 0.28;
    col += uColAccent * lensGlow;

    // Subtle deep radial vignette so Kinetic Typography stays readable
    float vignette = smoothstep(1.35, 0.25, r);
    col *= mix(0.58, 1.08, vignette);

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

interface PhysicsParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
  kind: 'main' | 'petal' | 'rain' | 'sand' | 'ember' | 'star' | 'lyricBurst';
  colorIdx: 0 | 1 | 2;
  life: number;
  maxLife: number;
}

export class SynesthesiaRenderer {
  private glCanvas: HTMLCanvasElement;
  private fxCanvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private fxCtx: CanvasRenderingContext2D | null = null;

  private program: WebGLProgram | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private contextLost = false;

  private particles: PhysicsParticle[] = [];
  private maxParticles = 240;

  private pointerX = 0.5;
  private pointerY = 0.5;
  private pointerActive = 0;

  private timeAcc = 0;
  private lastNow = performance.now();
  private smoothSubBass = 0.08;
  private smoothMid = 0.08;
  private smoothTreble = 0.08;
  private smoothBeat = 0.05;

  private activeLyricId: string | null = null;
  private lyricAppearTime = 0;
  private prefersReducedMotion = false;

  private onContextLostBound = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
  };
  private onContextRestoredBound = () => {
    this.contextLost = false;
    this.initWebGL();
  };

  constructor(glCanvas: HTMLCanvasElement, fxCanvas: HTMLCanvasElement) {
    this.glCanvas = glCanvas;
    this.fxCanvas = fxCanvas;
    this.fxCtx = fxCanvas.getContext('2d');
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.glCanvas.addEventListener('webglcontextlost', this.onContextLostBound);
    this.glCanvas.addEventListener('webglcontextrestored', this.onContextRestoredBound);

    this.initWebGL();
    this.seedParticles();
  }

  public setPointer(normX: number, normY: number, active: boolean): void {
    this.pointerX = Math.max(0, Math.min(1, normX));
    this.pointerY = Math.max(0, Math.min(1, normY));
    this.pointerActive = active ? 1 : 0;
  }

  private initWebGL(): void {
    const gl =
      this.glCanvas.getContext('webgl', { alpha: false, antialias: false }) ||
      (this.glCanvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) {
      this.gl = null;
      return;
    }

    const vs = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) {
      this.gl = null;
      return;
    }

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      this.gl = null;
      return;
    }

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(prog, 'aPosition');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.uniforms = {
      uTime: gl.getUniformLocation(prog, 'uTime'),
      uResolution: gl.getUniformLocation(prog, 'uResolution'),
      uPointer: gl.getUniformLocation(prog, 'uPointer'),
      uPointerActive: gl.getUniformLocation(prog, 'uPointerActive'),
      uSubBass: gl.getUniformLocation(prog, 'uSubBass'),
      uMidVocals: gl.getUniformLocation(prog, 'uMidVocals'),
      uTreble: gl.getUniformLocation(prog, 'uTreble'),
      uBeat: gl.getUniformLocation(prog, 'uBeat'),
      uChladniM: gl.getUniformLocation(prog, 'uChladniM'),
      uChladniN: gl.getUniformLocation(prog, 'uChladniN'),
      uSeedWarp: gl.getUniformLocation(prog, 'uSeedWarp'),
      uPhaseOffset: gl.getUniformLocation(prog, 'uPhaseOffset'),
      uTurbulence: gl.getUniformLocation(prog, 'uTurbulence'),
      uStyleMode: gl.getUniformLocation(prog, 'uStyleMode'),
      uColPrimary: gl.getUniformLocation(prog, 'uColPrimary'),
      uColSecondary: gl.getUniformLocation(prog, 'uColSecondary'),
      uColAccent: gl.getUniformLocation(prog, 'uColAccent'),
      uColBg: gl.getUniformLocation(prog, 'uColBg'),
    };

    this.gl = gl;
    this.program = prog;
  }

  private compileShader(
    gl: WebGLRenderingContext,
    type: number,
    src: string
  ): WebGLShader | null {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  private seedParticles(): void {
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.002,
        vy: (Math.random() - 0.5) * 0.002,
        size: 1.5 + Math.random() * 4.5,
        alpha: 0.25 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        kind: i % 3 === 0 ? 'petal' : i % 3 === 1 ? 'rain' : 'main',
        colorIdx: (i % 3) as 0 | 1 | 2,
        life: 0,
        maxLife: 1,
      });
    }
  }

  private spawnLyricDissolveBurst(
    kineticStyle: KineticLyricStyle,
    cx: number,
    cy: number,
    width: number,
    height: number
  ): void {
    const count = kineticStyle === 'spark' ? 28 : 20;
    for (let i = 0; i < count; i++) {
      if (this.particles.length > this.maxParticles + 80) {
        this.particles.shift();
      }
      const spreadX = ((Math.random() - 0.5) * Math.min(460, width * 0.6)) / width;
      const spreadY = ((Math.random() - 0.5) * 32) / height;
      const isSpark = kineticStyle === 'spark';
      this.particles.push({
        x: cx / width + spreadX,
        y: cy / height + spreadY,
        vx: (Math.random() - 0.5) * (isSpark ? 0.007 : 0.0018),
        vy: isSpark ? -0.004 - Math.random() * 0.006 : -0.0015 - Math.random() * 0.0022,
        size: isSpark ? 1.8 + Math.random() * 2.8 : 4 + Math.random() * 8,
        alpha: isSpark ? 0.95 : 0.45,
        phase: Math.random() * Math.PI * 2,
        kind: 'lyricBurst',
        colorIdx: isSpark ? 2 : 0,
        life: 0,
        maxLife: isSpark ? 0.85 : 1.5,
      });
    }
  }

  public renderFrame(params: {
    metrics: AudioBandMetrics;
    preset: LanguagePhysicsPreset;
    phase: SynesthesiaStoryboardPhase;
    seed: DeterministicVisualSeed;
    activeLyric: SyncedLyricLine | null;
    isPlaying: boolean;
  }): void {
    const now = performance.now();
    const dtSec = Math.min(0.05, Math.max(0.004, (now - this.lastNow) / 1000));
    this.lastNow = now;
    const dtFrame = dtSec * 60;

    const { metrics, preset, phase, seed, activeLyric, isPlaying } = params;

    this.smoothSubBass += (metrics.subBass - this.smoothSubBass) * 0.22;
    this.smoothMid += (metrics.midVocals - this.smoothMid) * 0.2;
    this.smoothTreble += (metrics.trebleInstruments - this.smoothTreble) * 0.24;
    this.smoothBeat += (metrics.beatEnvelope - this.smoothBeat) * 0.28;

    this.timeAcc += dtSec * (isPlaying ? 1 + this.smoothBeat * 0.4 : 0.35);

    const rect = this.fxCanvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const glW = Math.max(1, Math.floor(width * Math.min(dpr, 1.5)));
    const glH = Math.max(1, Math.floor(height * Math.min(dpr, 1.5)));
    if (this.glCanvas.width !== glW || this.glCanvas.height !== glH) {
      this.glCanvas.width = glW;
      this.glCanvas.height = glH;
    }

    const fxW = Math.max(1, Math.floor(width * dpr));
    const fxH = Math.max(1, Math.floor(height * dpr));
    if (this.fxCanvas.width !== fxW || this.fxCanvas.height !== fxH) {
      this.fxCanvas.width = fxW;
      this.fxCanvas.height = fxH;
    }

    const cPrimary = hexToRgb255(phase.palette[0]);
    const cSecondary = hexToRgb255(phase.palette[1]);
    const cAccent = hexToRgb255(phase.palette[2]);
    const cBg = hexToRgb255(phase.palette[3]);

    // 1. WebGL Shader Render Pass (with clean Canvas2D gradient fallback if WebGL unavailable)
    const styleIndex = preset === 'bengali-monsoon' ? 0 : preset === 'sufi-lantern' ? 1 : 2;
    if (this.gl && this.program && !this.contextLost) {
      const gl = this.gl;
      gl.viewport(0, 0, glW, glH);
      gl.useProgram(this.program);

      const nPrimary = hexToNormRgb(phase.palette[0]);
      const nSecondary = hexToNormRgb(phase.palette[1]);
      const nAccent = hexToNormRgb(phase.palette[2]);
      const nBg = hexToNormRgb(phase.palette[3]);

      gl.uniform1f(this.uniforms.uTime, this.timeAcc);
      gl.uniform2f(this.uniforms.uResolution, glW, glH);
      gl.uniform2f(this.uniforms.uPointer, this.pointerX, 1.0 - this.pointerY);
      gl.uniform1f(this.uniforms.uPointerActive, this.pointerActive);

      gl.uniform1f(this.uniforms.uSubBass, this.smoothSubBass);
      gl.uniform1f(this.uniforms.uMidVocals, this.smoothMid);
      gl.uniform1f(this.uniforms.uTreble, this.smoothTreble);
      gl.uniform1f(this.uniforms.uBeat, this.smoothBeat);

      gl.uniform1f(this.uniforms.uChladniM, seed.chladniM);
      gl.uniform1f(this.uniforms.uChladniN, seed.chladniN);
      gl.uniform1f(this.uniforms.uSeedWarp, seed.fractalWarp);
      gl.uniform1f(this.uniforms.uPhaseOffset, seed.phaseOffset);
      gl.uniform1f(this.uniforms.uTurbulence, phase.turbulence);
      gl.uniform1f(this.uniforms.uStyleMode, styleIndex);

      gl.uniform3f(this.uniforms.uColPrimary, nPrimary[0], nPrimary[1], nPrimary[2]);
      gl.uniform3f(this.uniforms.uColSecondary, nSecondary[0], nSecondary[1], nSecondary[2]);
      gl.uniform3f(this.uniforms.uColAccent, nAccent[0], nAccent[1], nAccent[2]);
      gl.uniform3f(this.uniforms.uColBg, nBg[0], nBg[1], nBg[2]);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // 2. Canvas2D Physics, Soul Core, Orbital Cymatics, Gravitational Lensing & Kinetic Typography
    const ctx = this.fxCtx;
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!this.gl || this.contextLost) {
      const grad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        10,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.85
      );
      grad.addColorStop(0, rgbaStr(cPrimary, 0.35));
      grad.addColorStop(1, rgbaStr(cBg, 1));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    const cx = width * 0.5;
    const cy = height * 0.46;
    const minDim = Math.min(width, height);

    // A. Central Organic "Soul Core" responding to Mid/Vocals + Sub-Bass expansion
    this.drawSoulCore(ctx, cx, cy, minDim, seed, preset, cPrimary, cSecondary, cAccent);

    // B. Treble / Instruments -> Orbital Harmonic Rings & Chladni Light Nodes
    this.drawTrebleOrbitalHarmonics(ctx, cx, cy, minDim, seed, metrics, cPrimary, cAccent);

    // C. Language-Specific Generative Particles + Cursor/Touch Gravitational Lensing
    if (!this.prefersReducedMotion) {
      this.updateAndDrawParticles(
        ctx,
        width,
        height,
        dtFrame,
        dtSec,
        preset,
        phase,
        cPrimary,
        cSecondary,
        cAccent
      );
    }

    // D. Kinetic Poetic Typography in Native Script
    const lyricY = height * 0.77;
    if (activeLyric && activeLyric.id !== this.activeLyricId) {
      if (this.activeLyricId) {
        this.spawnLyricDissolveBurst(
          activeLyric.kineticHint || phase.kineticStyle,
          cx,
          lyricY,
          width,
          height
        );
      }
      this.activeLyricId = activeLyric.id;
      this.lyricAppearTime = now;
    } else if (!activeLyric && this.activeLyricId) {
      this.activeLyricId = null;
    }

    if (activeLyric) {
      this.drawKineticLyric(
        ctx,
        activeLyric,
        phase.kineticStyle,
        cx,
        lyricY,
        width,
        now,
        cAccent,
        cPrimary
      );
    }
  }

  private drawSoulCore(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    minDim: number,
    seed: DeterministicVisualSeed,
    preset: LanguagePhysicsPreset,
    cPrimary: [number, number, number],
    cSecondary: [number, number, number],
    cAccent: [number, number, number]
  ): void {
    const baseRadius = minDim * (0.13 + this.smoothSubBass * 0.08 + this.smoothBeat * 0.045);

    // Soft ambient core aura
    const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 2.7);
    aura.addColorStop(0, rgbaStr(cAccent, 0.34 + this.smoothMid * 0.35));
    aura.addColorStop(0.45, rgbaStr(cPrimary, 0.22 + this.smoothSubBass * 0.2));
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 2.7, 0, Math.PI * 2);
    ctx.fill();

    // Multi-layered organic spline membrane driven by Mid/Vocals
    const layers = 3;
    const pts = 64;
    for (let l = 0; l < layers; l++) {
      const layerScale = 0.72 + l * 0.22;
      const col = l === 0 ? cAccent : l === 1 ? cPrimary : cSecondary;
      ctx.beginPath();
      for (let i = 0; i <= pts; i++) {
        const ang = (i / pts) * Math.PI * 2;
        const harmonicA = Math.sin(ang * seed.petalSymmetry + this.timeAcc * (1.2 + l * 0.4));
        const harmonicB = Math.cos(ang * seed.chladniM - this.timeAcc * 0.9);
        const deform =
          1 +
          (harmonicA * 0.12 + harmonicB * 0.09) *
            (0.4 + this.smoothMid * 1.4 + (preset === 'sufi-lantern' ? 0.18 : 0));
        const rx = baseRadius * layerScale * deform;
        const ry = baseRadius * layerScale * deform * (preset === 'bengali-monsoon' ? 0.94 : 1);
        const px = cx + Math.cos(ang) * rx;
        const py = cy + Math.sin(ang) * ry;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = rgbaStr(col, 0.55 - l * 0.12);
      ctx.lineWidth = l === 0 ? 2.4 : 1.4;
      ctx.stroke();

      if (l === 0) {
        ctx.fillStyle = rgbaStr(col, 0.12 + this.smoothMid * 0.2);
        ctx.fill();
      }
    }
  }

  private drawTrebleOrbitalHarmonics(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    minDim: number,
    seed: DeterministicVisualSeed,
    metrics: AudioBandMetrics,
    cPrimary: [number, number, number],
    cAccent: [number, number, number]
  ): void {
    const orbitCount = seed.petalSymmetry;
    const orbitR = minDim * (0.25 + this.smoothTreble * 0.08 + this.smoothBeat * 0.03);

    ctx.save();
    ctx.translate(cx, cy);

    // Cymatic harmonic ring traced directly from FFT treble + mid bins
    ctx.beginPath();
    const segments = 72;
    for (let i = 0; i <= segments; i++) {
      const ang = (i / segments) * Math.PI * 2;
      const binIdx = Math.min(metrics.frequencyBins.length - 1, Math.floor((i / segments) * 180));
      const fftMag = (metrics.frequencyBins[binIdx] || 0) / 255;
      const chladniRipple =
        Math.cos(ang * seed.chladniN + this.timeAcc * 1.6) * (6 + this.smoothTreble * 22);
      const r = orbitR + fftMag * 46 + chladniRipple;
      const x = Math.cos(ang) * r * seed.orbitalEccentricity;
      const y = Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = rgbaStr(cAccent, 0.28 + this.smoothTreble * 0.5);
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Orbiting light-trail harmonic nodes
    for (let k = 0; k < orbitCount; k++) {
      const baseAng =
        (k / orbitCount) * Math.PI * 2 + this.timeAcc * (0.45 + this.smoothTreble * 0.7);
      const trailLen = 0.24 + this.smoothTreble * 0.35;
      const r = orbitR * (0.9 + 0.14 * Math.sin(this.timeAcc * 1.4 + k));

      const x = Math.cos(baseAng) * r * seed.orbitalEccentricity;
      const y = Math.sin(baseAng) * r;
      const px = Math.cos(baseAng - trailLen) * r * seed.orbitalEccentricity;
      const py = Math.sin(baseAng - trailLen) * r;

      ctx.strokeStyle = rgbaStr(k % 2 === 0 ? cAccent : cPrimary, 0.42 + this.smoothTreble * 0.45);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();

      ctx.fillStyle = rgbaStr(cAccent, 0.85);
      ctx.beginPath();
      ctx.arc(x, y, 2.1 + this.smoothBeat * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private updateAndDrawParticles(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dtFrame: number,
    dtSec: number,
    preset: LanguagePhysicsPreset,
    phase: SynesthesiaStoryboardPhase,
    cPrimary: [number, number, number],
    cSecondary: [number, number, number],
    cAccent: [number, number, number]
  ): void {
    const activeCount = Math.min(
      this.particles.length,
      Math.floor(this.maxParticles * Math.max(0.35, phase.particleDensity))
    );

    const gravX = phase.gravityX * 0.00018;
    const gravY = phase.gravityY * 0.00018;
    const turb = phase.turbulence;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.kind !== 'lyricBurst' && i >= activeCount) continue;

      if (p.kind === 'lyricBurst') {
        p.life += dtSec;
        if (p.life >= p.maxLife) {
          this.particles.splice(i, 1);
          continue;
        }
      }

      // Curl-like harmonic flow + cultural directional motion
      const curl =
        Math.sin(p.y * 8.5 + this.timeAcc * 1.4 + p.phase) * 0.00028 * turb;
      const curlY =
        Math.cos(p.x * 8.5 - this.timeAcc * 1.1 + p.phase) * 0.00024 * turb;

      if (preset === 'bengali-monsoon' && p.kind === 'rain') {
        p.vx = (-0.0012 + phase.gravityX * 0.001) * (1 + this.smoothSubBass * 0.5);
        p.vy = (0.009 + this.smoothTreble * 0.006);
      } else if (preset === 'sufi-lantern' && p.kind === 'petal') {
        // Ascending glowing lantern embers
        p.vx += curl * 0.7 + gravX * 0.5;
        p.vy = Math.min(-0.0008, p.vy - 0.00012 - this.smoothMid * 0.0002);
      } else {
        p.vx += gravX + curl;
        p.vy += gravY + curlY;
      }

      // Interactive Cursor / Touch Gravitational Lensing
      if (this.pointerActive > 0.05) {
        const dx = this.pointerX - p.x;
        const dy = this.pointerY - p.y;
        const distSq = dx * dx + dy * dy + 0.0025;
        if (distSq < 0.09) {
          const pull = (0.00035 / distSq) * dtFrame * 0.15;
          // Tangential swirl + subtle gravitational pull
          p.vx += (dx * 0.45 - dy * 0.85) * Math.min(0.003, pull);
          p.vy += (dy * 0.45 + dx * 0.85) * Math.min(0.003, pull);
        }
      }

      // Sub-Bass radial pulse away from core
      if (this.smoothBeat > 0.55) {
        const cxDx = p.x - 0.5;
        const cyDy = p.y - 0.46;
        const d = Math.hypot(cxDx, cyDy) + 0.05;
        if (d < 0.35) {
          p.vx += (cxDx / d) * 0.0004 * this.smoothBeat;
          p.vy += (cyDy / d) * 0.0004 * this.smoothBeat;
        }
      }

      p.vx *= 0.965;
      p.vy *= 0.965;
      p.x += p.vx * dtFrame;
      p.y += p.vy * dtFrame;

      if (p.kind !== 'lyricBurst') {
        if (p.x < -0.05) p.x = 1.05;
        if (p.x > 1.05) p.x = -0.05;
        if (p.y < -0.05) p.y = 1.05;
        if (p.y > 1.05) p.y = -0.05;
      }

      const sx = p.x * width;
      const sy = p.y * height;
      const col = p.colorIdx === 0 ? cPrimary : p.colorIdx === 1 ? cSecondary : cAccent;
      const fadeLife = p.kind === 'lyricBurst' ? 1 - p.life / p.maxLife : 1;
      const alpha = p.alpha * fadeLife * (0.55 + this.smoothBeat * 0.35);

      if (preset === 'bengali-monsoon' && p.kind === 'rain') {
        ctx.strokeStyle = rgbaStr(cAccent, alpha * 0.55);
        ctx.lineWidth = 1.05;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 6, sy + 18 + this.smoothTreble * 14);
        ctx.stroke();
      } else if (preset === 'bengali-monsoon' && p.kind === 'petal') {
        // Floating organic petal shape
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(this.timeAcc * 0.7 + p.phase);
        ctx.fillStyle = rgbaStr(cPrimary, alpha * 0.72);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 1.4, p.size * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (preset === 'sufi-lantern') {
        // Warm golden lantern ember halo / calligraphic arc
        const glowR = p.size * (2.6 + this.smoothMid * 2.2);
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
        g.addColorStop(0, rgbaStr(cAccent, alpha));
        g.addColorStop(0.4, rgbaStr(col, alpha * 0.45));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Cosmic neon stardust / smoke lyric puffs
        ctx.fillStyle = rgbaStr(col, alpha);
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * (0.7 + this.smoothBeat * 0.45), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawKineticLyric(
    ctx: CanvasRenderingContext2D,
    lyric: SyncedLyricLine,
    phaseStyle: KineticLyricStyle,
    cx: number,
    y: number,
    width: number,
    now: number,
    cAccent: [number, number, number],
    cPrimary: [number, number, number]
  ): void {
    const style = lyric.kineticHint || phaseStyle;
    const elapsedAppear = Math.min(1, (now - this.lyricAppearTime) / 550);
    const fadeOutMargin = Math.max(0, Math.min(1, (lyric.endTimeSec - (lyric.timeSec + elapsedAppear)) * 0.5));
    void fadeOutMargin;

    const alpha = Math.min(1, elapsedAppear * 1.25);
    const fontSize = Math.max(18, Math.min(34, width * 0.032));

    let fontFamily = "'Outfit', 'Plus Jakarta Sans', sans-serif";
    if (lyric.script === 'bengali') {
      fontFamily = "'Noto Sans Bengali', 'Outfit', sans-serif";
    } else if (lyric.script === 'devanagari') {
      fontFamily = "'Noto Sans Devanagari', 'Outfit', sans-serif";
    }

    const driftOffsetY =
      style === 'smoke'
        ? (1 - elapsedAppear) * 14 - Math.sin(this.timeAcc * 1.5) * 4
        : style === 'spark'
          ? (1 - elapsedAppear) * -10
          : (1 - elapsedAppear) * 10;

    ctx.save();
    ctx.font = `600 ${Math.round(fontSize)}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Luminous backdrop shadow for crisp legibility across bright shaders
    ctx.shadowColor =
      style === 'spark'
        ? rgbaStr(cAccent, 0.85)
        : style === 'glow'
          ? rgbaStr(cPrimary, 0.8)
          : 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = style === 'smoke' ? 22 : 16;

    const maxTextWidth = Math.min(780, width * 0.84);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * alpha})`;
    ctx.fillText(lyric.text, cx, y + driftOffsetY, maxTextWidth);
    ctx.restore();
  }

  public dispose(): void {
    this.glCanvas.removeEventListener('webglcontextlost', this.onContextLostBound);
    this.glCanvas.removeEventListener('webglcontextrestored', this.onContextRestoredBound);
    if (this.gl && this.program) {
      this.gl.deleteProgram(this.program);
    }
    this.gl = null;
    this.program = null;
  }
}
