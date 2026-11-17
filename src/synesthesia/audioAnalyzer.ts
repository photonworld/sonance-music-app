import { AudioBandMetrics } from './types';

/**
 * Decoupled Audio Analyzer powered by Web Audio API AnalyserNode (FFT 2048).
 * Extracts Sub-Bass (20-140Hz), Mid/Vocals (300-3000Hz), Treble/Instruments (3500-16000Hz),
 * plus dynamic beat envelopes and spectral fingerprints for generative physics.
 */
export class SynesthesiaAudioAnalyzer {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private attachedEl: HTMLAudioElement | null = null;

  private frequencyBins: Uint8Array = new Uint8Array(1024);
  private timeDomain: Uint8Array = new Uint8Array(1024);

  private avgBassEnergy = 0.08;
  private beatEnvelope = 0;
  private lastBeatAt = 0;

  public ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.78;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.88;

      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.frequencyBins = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeDomain = new Uint8Array(this.analyser.frequencyBinCount);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public getInputNode(): AnalyserNode {
    this.ensureContext();
    return this.analyser!;
  }

  public attachMediaElement(audioEl: HTMLAudioElement): void {
    const ctx = this.ensureContext();
    if (this.attachedEl === audioEl && this.mediaSource) return;

    if (this.mediaSource) {
      try {
        this.mediaSource.disconnect();
      } catch {
        // ignore
      }
    }
    this.mediaSource = ctx.createMediaElementSource(audioEl);
    this.mediaSource.connect(this.analyser!);
    this.attachedEl = audioEl;
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.025);
    }
  }

  public sample(isPlaying: boolean): AudioBandMetrics {
    if (!this.analyser || !this.ctx || !isPlaying) {
      this.beatEnvelope *= 0.88;
      return {
        subBass: 0.04,
        midVocals: 0.05,
        trebleInstruments: 0.04,
        rms: 0.04,
        beatEnvelope: this.beatEnvelope,
        isBeat: false,
        spectralCentroid: 0.35,
        frequencyBins: this.frequencyBins,
        timeDomain: this.timeDomain,
      };
    }

    this.analyser.getByteFrequencyData(this.frequencyBins as Uint8Array<ArrayBuffer>);
    this.analyser.getByteTimeDomainData(this.timeDomain as Uint8Array<ArrayBuffer>);

    const len = this.frequencyBins.length;
    const hzPerBin = this.ctx.sampleRate / 2 / len;

    let subBassSum = 0;
    let subBassCount = 0;
    let midSum = 0;
    let midCount = 0;
    let trebleSum = 0;
    let trebleCount = 0;
    let weightedFreqSum = 0;
    let magSum = 0;

    for (let i = 0; i < len; i++) {
      const val = this.frequencyBins[i] / 255;
      const freq = i * hzPerBin;
      weightedFreqSum += freq * val;
      magSum += val;

      if (freq >= 20 && freq <= 140) {
        subBassSum += val;
        subBassCount++;
      } else if (freq >= 300 && freq <= 3000) {
        midSum += val;
        midCount++;
      } else if (freq >= 3500 && freq <= 16000) {
        trebleSum += val;
        trebleCount++;
      }
    }

    const subBass = subBassCount > 0 ? Math.min(1, (subBassSum / subBassCount) * 1.15) : 0;
    const midVocals = midCount > 0 ? Math.min(1, (midSum / midCount) * 1.25) : 0;
    const trebleInstruments =
      trebleCount > 0 ? Math.min(1, (trebleSum / trebleCount) * 1.45) : 0;

    let sqSum = 0;
    for (let i = 0; i < this.timeDomain.length; i++) {
      const norm = (this.timeDomain[i] - 128) / 128;
      sqSum += norm * norm;
    }
    const rms = Math.min(1, Math.sqrt(sqSum / this.timeDomain.length) * 2.2);
    const centroidHz = magSum > 0.01 ? weightedFreqSum / magSum : 1200;
    const spectralCentroid = Math.min(1, Math.max(0, centroidHz / 5500));

    const now = performance.now();
    this.avgBassEnergy = this.avgBassEnergy * 0.92 + subBass * 0.08;
    const threshold = Math.max(0.14, this.avgBassEnergy * 1.25);
    let isBeat = false;
    if (subBass > threshold && now - this.lastBeatAt > 210) {
      isBeat = true;
      this.lastBeatAt = now;
      this.beatEnvelope = 1.0;
    } else {
      this.beatEnvelope = Math.max(0, this.beatEnvelope * 0.88);
    }

    return {
      subBass,
      midVocals,
      trebleInstruments,
      rms,
      beatEnvelope: this.beatEnvelope,
      isBeat,
      spectralCentroid,
      frequencyBins: this.frequencyBins,
      timeDomain: this.timeDomain,
    };
  }

  public async extractFileFingerprint(file: File): Promise<{
    durationSeconds: number;
    fingerprint: string;
  }> {
    try {
      const arrayBuf = await file.slice(0, Math.min(file.size, 3 * 1024 * 1024)).arrayBuffer();
      const ctx = this.ensureContext();
      const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
      const ch = decoded.getChannelData(0);
      const stride = Math.max(1, Math.floor(ch.length / 256));
      let energy = 0;
      let zeroCrossings = 0;
      let prev = ch[0] || 0;
      for (let i = 0; i < ch.length; i += stride) {
        const s = ch[i];
        energy += Math.abs(s);
        if ((s >= 0 && prev < 0) || (s < 0 && prev >= 0)) zeroCrossings++;
        prev = s;
      }
      const avgAmp = (energy / Math.max(1, ch.length / stride)).toFixed(4);
      const zcr = ((zeroCrossings / Math.max(1, ch.length / stride)) * 100).toFixed(2);
      return {
        durationSeconds: Math.round(decoded.duration || 180),
        fingerprint: `sr${decoded.sampleRate}-ch${decoded.numberOfChannels}-amp${avgAmp}-zcr${zcr}-sz${file.size}`,
      };
    } catch {
      return {
        durationSeconds: 180,
        fingerprint: `file-${file.name.length}-${file.size}-${file.lastModified}`,
      };
    }
  }

  public dispose(): void {
    if (this.mediaSource) {
      try {
        this.mediaSource.disconnect();
      } catch {
        // ignore
      }
      this.mediaSource = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
