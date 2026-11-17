import { DemoJourney } from './types';

export const DEMO_JOURNEYS: DemoJourney[] = [
  {
    id: 'bengali-monsoon',
    title: 'শ্রাবণ মেঘের গান (Meghla Diner Gaan)',
    artist: 'Shrabon Ensemble',
    tagline: 'Bengali Monsoon Watercolor, Floating Petals & Ink Dispersion',
    durationSeconds: 76,
    preset: 'bengali-monsoon',
    lrcLyrics: `[00:02.00] আকাশ জুড়ে কালো মেঘের ছায়া নেমে আসে
[00:09.50] প্রথম ফোঁটা বৃষ্টি ছুঁয়ে যায় শিউলি পাতার গায়
[00:17.50] শ্রাবণের নীরব নদীর তীরে ভেসে ওঠে সুর
[00:26.00] গভীর জলের ঢেউয়ে ডুবে যায় পুরনো অভিমান
[00:35.00] আলোর রেখা ছিঁড়ে নামে সোনালি বজ্রের ক্ষণ
[00:44.00] ভেজা বাতাসে উড়ে যায় অজস্র জুঁই ফুলের পাপড়ি
[00:54.00] মনে পড়ে ফেলে আসা বর্ষার সেই অচেনা গান
[01:04.00] রাতের আঁধারে মিশে যায় শান্ত জলের কণা`,
    directorPlan: {
      songTitle: 'শ্রাবণ মেঘের গান (Meghla Diner Gaan)',
      artist: 'Shrabon Ensemble',
      durationSeconds: 76,
      detectedLanguage: 'bengali',
      script: 'bengali',
      visualStylePreset: 'bengali-monsoon',
      overallEmotion: 'Monsoon Melancholy & Nostalgia',
      poeticSummary:
        'Unfolds from misty monsoon indigo clouds into a luminous rain-washed longing, dissolving softly into tranquil ink-in-water stillness.',
      culturalMotifs: [
        'Monsoon Rain Streaks',
        'Shiuliphul Floating Petals',
        'Alpona Water Ripples',
        'Indigo Ink Dispersion',
      ],
      storyboard: [
        {
          startRatio: 0,
          endRatio: 0.25,
          phaseName: 'Gathering Monsoon Mist',
          emotionLabel: 'Quiet Longing',
          visualMetaphor: 'Translucent slate-teal watercolor washes drifting across calm river mist',
          palette: ['#38BDF8', '#0D9488', '#BAE6FD', '#04131E'],
          gravityX: 0.14,
          gravityY: 0.28,
          turbulence: 0.36,
          particleDensity: 0.68,
          kineticStyle: 'drift',
        },
        {
          startRatio: 0.25,
          endRatio: 0.52,
          phaseName: 'First Rain & Ink Memory',
          emotionLabel: 'Deep Melancholy',
          visualMetaphor: 'Deep cobalt rain trails and indigo ink blooming slowly in rain-kissed water',
          palette: ['#60A5FA', '#6366F1', '#E0F2FE', '#070E26'],
          gravityX: -0.18,
          gravityY: 0.64,
          turbulence: 0.58,
          particleDensity: 0.85,
          kineticStyle: 'smoke',
        },
        {
          startRatio: 0.52,
          endRatio: 0.78,
          phaseName: 'Golden Lightning & Petals',
          emotionLabel: 'Cathartic Ache',
          visualMetaphor: 'Warm monsoon lightning silver-gold sparks lifting swirling flower petals',
          palette: ['#2DD4BF', '#FBBF24', '#F8FAFC', '#081C24'],
          gravityX: 0.25,
          gravityY: -0.22,
          turbulence: 0.82,
          particleDensity: 0.96,
          kineticStyle: 'spark',
        },
        {
          startRatio: 0.78,
          endRatio: 1.0,
          phaseName: 'Post-Rain Serenity',
          emotionLabel: 'Peaceful Solitude',
          visualMetaphor: 'Slow sunlit river caustics settling beneath the night rain sky',
          palette: ['#34D399', '#38BDF8', '#CCFBF1', '#031218'],
          gravityX: 0.04,
          gravityY: 0.12,
          turbulence: 0.3,
          particleDensity: 0.6,
          kineticStyle: 'glow',
        },
      ],
      source: 'demo-curated',
    },
  },
  {
    id: 'sufi-mysticism',
    title: 'नूर-ए-इश्क़ (Noor-e-Ishq)',
    artist: 'Dargah Acoustic Collective',
    tagline: 'Sufi Golden Calligraphy, Desert Sand-Waves & Rising Lantern Embers',
    durationSeconds: 78,
    preset: 'sufi-lantern',
    lrcLyrics: `[00:02.00] रात के सन्नाटे में एक दीया सा जलता है
[00:10.00] रूह के आईने में तेरा ही नूर चमकता है
[00:18.50] रेत की लहरों पर हवा ने लिखा तेरा नाम
[00:27.50] इश्क़ के सजदे में झुक गया सारा आसमान
[00:36.50] चराग़ों की लौ से उठे सुनहरे ज़र्ऱे
[00:46.00] हर धड़कन में गूँजे सूफ़ियाना कलाम
[00:56.00] वक़्त की सरहद से परे एक असीम सुकून
[01:06.00] चाँदनी में घुल गया रूह का हर जुनून`,
    directorPlan: {
      songTitle: 'नूर-ए-इश्क़ (Noor-e-Ishq)',
      artist: 'Dargah Acoustic Collective',
      durationSeconds: 78,
      detectedLanguage: 'hindi',
      script: 'devanagari',
      visualStylePreset: 'sufi-lantern',
      overallEmotion: 'Mystic Devotion & Warm Ecstasy',
      poeticSummary:
        'Awakens like a solitary amber lantern in desert twilight, building into ecstatic whirling golden calligraphy before resting in luminous spiritual peace.',
      culturalMotifs: [
        'Golden Calligraphic Arcs',
        'Desert Wind Sand-Waves',
        'Ascending Lantern Embers',
        'Sufi Whirling Orbits',
      ],
      storyboard: [
        {
          startRatio: 0,
          endRatio: 0.28,
          phaseName: 'Twilight Desert Whisper',
          emotionLabel: 'Sacred Stillness',
          visualMetaphor: 'Warm bronze dusk sand-waves undulating around a solitary glowing ember',
          palette: ['#F59E0B', '#D97706', '#FEF3C7', '#170A04'],
          gravityX: 0.3,
          gravityY: -0.25,
          turbulence: 0.4,
          particleDensity: 0.65,
          kineticStyle: 'glow',
        },
        {
          startRatio: 0.28,
          endRatio: 0.56,
          phaseName: 'Awakening Qawwali Pulse',
          emotionLabel: 'Yearning Devotion',
          visualMetaphor: 'Swirling golden calligraphy ribbons spiraling upward in desert wind',
          palette: ['#FB923C', '#F43F5E', '#FDE68A', '#22090C'],
          gravityX: 0.42,
          gravityY: -0.45,
          turbulence: 0.66,
          particleDensity: 0.86,
          kineticStyle: 'drift',
        },
        {
          startRatio: 0.56,
          endRatio: 0.82,
          phaseName: 'Whirling Ecstasy (Wajd)',
          emotionLabel: 'Transcendent Joy',
          visualMetaphor: 'Radiant lantern embers erupting into sacred rose-gold Chladni stars',
          palette: ['#FBBF24', '#EC4899', '#FFFBEB', '#290B14'],
          gravityX: 0,
          gravityY: -0.78,
          turbulence: 0.9,
          particleDensity: 0.98,
          kineticStyle: 'spark',
        },
        {
          startRatio: 0.82,
          endRatio: 1.0,
          phaseName: 'Moonlit Courtyard Peace',
          emotionLabel: 'Luminous Peace',
          visualMetaphor: 'Slow saffron-ivory embers floating gently into an amber night sky',
          palette: ['#FCD34D', '#B45309', '#FEF9C3', '#140805'],
          gravityX: -0.06,
          gravityY: -0.32,
          turbulence: 0.32,
          particleDensity: 0.58,
          kineticStyle: 'glow',
        },
      ],
      source: 'demo-curated',
    },
  },
  {
    id: 'cyberpunk-cosmic',
    title: 'Orbital Neon Drift (2099)',
    artist: 'Vespera Circuit',
    tagline: 'Surrealist Neon Sacred Geometry, Liquid Chrome & Cosmic Stardust',
    durationSeconds: 74,
    preset: 'cosmic-neon',
    lrcLyrics: `[00:02.00] Zero-gravity horizons fracture into violet light
[00:10.00] Satellites hum beneath the liquid chrome sky
[00:18.00] Every heartbeat bends the cosmic geometry
[00:27.00] Ignite the warp core — burn through the neon static
[00:36.00] Stardust spirals in synchronized cybernetic pulse
[00:45.00] Through electric thunder we trace the infinite orbit
[00:54.50] Fading echoes shimmer across crystal vacuum
[01:04.00] Silence returns as silver dawn touches the void`,
    directorPlan: {
      songTitle: 'Orbital Neon Drift (2099)',
      artist: 'Vespera Circuit',
      durationSeconds: 74,
      detectedLanguage: 'english',
      script: 'latin',
      visualStylePreset: 'cosmic-neon',
      overallEmotion: 'Futuristic Wonder & Kinetic Surge',
      poeticSummary:
        'Launches from cool liquid-chrome orbital stillness into hyper-resonant neon geometry and stardust warp bursts.',
      culturalMotifs: [
        'Liquid Chrome Horizons',
        'Chladni Sacred Geometry',
        'Hyper-Velocity Stardust',
        'Cybernetic Neon Prism',
      ],
      storyboard: [
        {
          startRatio: 0,
          endRatio: 0.25,
          phaseName: 'Orbital Horizon Wake',
          emotionLabel: 'Cosmic Awe',
          visualMetaphor: 'Cool cyan-silver liquid chrome reflections undulating across deep space',
          palette: ['#22D3EE', '#6366F1', '#E2E8F0', '#040615'],
          gravityX: 0.1,
          gravityY: -0.1,
          turbulence: 0.44,
          particleDensity: 0.72,
          kineticStyle: 'drift',
        },
        {
          startRatio: 0.25,
          endRatio: 0.55,
          phaseName: 'Hyper-Pulse Ignition',
          emotionLabel: 'Electric Surge',
          visualMetaphor: 'Magenta and electric-cyan neon wireframe lattices snapping to bass shockwaves',
          palette: ['#E879F9', '#06B6D4', '#FFFFFF', '#0B041D'],
          gravityX: -0.22,
          gravityY: -0.35,
          turbulence: 0.85,
          particleDensity: 0.94,
          kineticStyle: 'spark',
        },
        {
          startRatio: 0.55,
          endRatio: 0.82,
          phaseName: 'Quantum Stardust Singularity',
          emotionLabel: 'Euphoric Drive',
          visualMetaphor: 'High-frequency Chladni starbursts and prismatic orbital light trails',
          palette: ['#F43F5E', '#38BDF8', '#FDE047', '#090314'],
          gravityX: 0.2,
          gravityY: 0.05,
          turbulence: 0.92,
          particleDensity: 1.0,
          kineticStyle: 'spark',
        },
        {
          startRatio: 0.82,
          endRatio: 1.0,
          phaseName: 'Crystal Vacuum Dawn',
          emotionLabel: 'Weightless Calm',
          visualMetaphor: 'Silver stardust dispersing gently through serene indigo orbit',
          palette: ['#818CF8', '#2DD4BF', '#F1F5F9', '#030510'],
          gravityX: 0.02,
          gravityY: -0.16,
          turbulence: 0.35,
          particleDensity: 0.62,
          kineticStyle: 'smoke',
        },
      ],
      source: 'demo-curated',
    },
  },
];

/**
 * Procedural Web Audio API synthesizer powering the 3 Demo Mode journeys cleanly
 * with real time tracking, seeking, play/pause, and genuine spectral output into AnalyserNode.
 */
export class DemoMusicSynthesizer {
  private ctx: AudioContext | null = null;
  private destinationNode: AudioNode | null = null;
  private synthBus: GainNode | null = null;
  private timerId: number | null = null;
  private currentJourney: DemoJourney | null = null;
  private playing = false;
  private elapsedSeconds = 0;
  private lastTickMs = 0;
  private stepCount = 0;
  private noiseBuffer: AudioBuffer | null = null;

  public connect(ctx: AudioContext, target: AudioNode): void {
    this.ctx = ctx;
    this.destinationNode = target;
    if (!this.synthBus) {
      this.synthBus = ctx.createGain();
      this.synthBus.gain.value = 0.82;
      this.synthBus.connect(target);
    }
    if (!this.noiseBuffer) {
      const length = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.07;
      }
      this.noiseBuffer = buf;
    }
  }

  public loadJourney(journey: DemoJourney): void {
    this.stop();
    this.currentJourney = journey;
    this.elapsedSeconds = 0;
    this.stepCount = 0;
  }

  public getCurrentTime(): number {
    return this.elapsedSeconds;
  }

  public seek(seconds: number): void {
    if (!this.currentJourney) return;
    this.elapsedSeconds = Math.max(0, Math.min(this.currentJourney.durationSeconds, seconds));
  }

  public start(
    onProgress: (sec: number) => void,
    onEnded: () => void
  ): void {
    if (!this.ctx || !this.synthBus || !this.currentJourney) return;
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.playing = true;
    this.lastTickMs = performance.now();

    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
    }

    const stepIntervalMs = this.currentJourney.preset === 'cosmic-neon' ? 240 : 420;
    let nextNoteAt = performance.now();

    this.timerId = window.setInterval(() => {
      if (!this.playing || !this.currentJourney || !this.ctx || !this.synthBus) return;
      const now = performance.now();
      const dtSec = (now - this.lastTickMs) / 1000;
      this.lastTickMs = now;
      this.elapsedSeconds += dtSec;

      if (this.elapsedSeconds >= this.currentJourney.durationSeconds) {
        this.elapsedSeconds = this.currentJourney.durationSeconds;
        onProgress(this.elapsedSeconds);
        this.pause();
        onEnded();
        return;
      }

      onProgress(this.elapsedSeconds);

      if (now >= nextNoteAt) {
        nextNoteAt = now + stepIntervalMs;
        this.triggerMusicalStep(this.currentJourney, this.elapsedSeconds / this.currentJourney.durationSeconds);
      }
    }, 60);
  }

  public pause(): void {
    this.playing = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public stop(): void {
    this.pause();
    this.elapsedSeconds = 0;
  }

  private triggerMusicalStep(journey: DemoJourney, progressRatio: number): void {
    if (!this.ctx || !this.synthBus) return;
    const t = this.ctx.currentTime;
    const step = this.stepCount++;
    const intensityBoost = progressRatio > 0.28 && progressRatio < 0.82 ? 1.25 : 0.85;

    if (journey.preset === 'bengali-monsoon') {
      // Raga Desh / Megh pentatonic bansuri-like sine + soft rain wash + tanpura root
      const scaleHz = [196, 220, 261.63, 293.66, 329.63, 392, 440, 349.23];
      const note = scaleHz[(step * 3 + Math.floor(Math.sin(step) * 2 + 8)) % scaleHz.length];

      // Deep warm sub-bass tanpura pulse every 4 steps
      if (step % 4 === 0) {
        this.playTone(65.4, 'sine', t, 1.5, 0.24 * intensityBoost, 160);
        this.playTone(98.0, 'triangle', t, 1.4, 0.1 * intensityBoost, 320);
        this.playNoiseBurst(t, 0.75, 0.08, 1200);
      }
      // Expressive vocal/bansuri melody on every 2 steps
      if (step % 2 === 0) {
        this.playTone(note, 'sine', t, 0.78, 0.18 * intensityBoost, 2200, 5.2);
      }
      // Delicate high treble raindrop chimes
      if (step % 3 === 1) {
        this.playTone(note * 3, 'sine', t + 0.05, 0.24, 0.06, 6500);
      }
    } else if (journey.preset === 'sufi-lantern') {
      // Sufi Hijaz / Bhairav modal palette + tabla sub-bass bayen + shimmering sitar plucks
      const scaleHz = [146.83, 155.56, 196, 220, 233.08, 293.66, 311.13, 392];
      const note = scaleHz[(step * 2 + (step % 5)) % scaleHz.length];

      // Deep Bayen sub-bass drum
      if (step % 2 === 0) {
        this.playKickDrum(t, 92, 44, 0.28, 0.28 * intensityBoost);
      }
      // Warm devotional drone + vocal harmonium sweep
      if (step % 4 === 0) {
        this.playTone(73.42, 'sawtooth', t, 1.5, 0.12 * intensityBoost, 480);
        this.playTone(220, 'triangle', t, 1.1, 0.11, 1400);
      }
      // Golden sitar harmonic pluck
      this.playTone(note * 1.5, 'triangle', t, 0.52, 0.16 * intensityBoost, 3600);
      if (step % 3 === 0) {
        this.playTone(note * 4, 'sine', t + 0.08, 0.18, 0.07, 8200);
      }
    } else {
      // Cosmic Neon Synthwave arpeggio + tight sub-bass kick + crisp hi-hat sparkles
      const arpHz = [110, 164.81, 220, 261.63, 329.63, 392, 440, 523.25];
      const bassNotes = [55, 55, 65.41, 73.42];
      const bassHz = bassNotes[Math.floor(step / 4) % bassNotes.length];

      if (step % 2 === 0) {
        this.playKickDrum(t, 128, 42, 0.22, 0.34 * intensityBoost);
      }
      if (step % 2 === 1) {
        this.playNoiseBurst(t, 0.08, 0.11 * intensityBoost, 7200, true);
      }
      // Analog synth bass + arpeggiated cosmic lead
      this.playTone(bassHz, 'sawtooth', t, 0.24, 0.19 * intensityBoost, 520);
      const lead = arpHz[(step * 3) % arpHz.length];
      this.playTone(lead * 1.5, 'sawtooth', t, 0.22, 0.13 * intensityBoost, 3800);
      if (step % 4 === 2) {
        this.playTone(lead * 3, 'sine', t + 0.04, 0.35, 0.09, 9000);
      }
    }

    // Keep unused reference guard clean
    void this.destinationNode;
  }

  private playTone(
    freq: number,
    type: OscillatorType,
    startTime: number,
    dur: number,
    amp: number,
    filterHz: number,
    vibratoHz = 0
  ): void {
    if (!this.ctx || !this.synthBus) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    if (vibratoHz > 0) {
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(vibratoHz, startTime);
      lfoGain.gain.setValueAtTime(freq * 0.014, startTime);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(startTime);
      lfo.stop(startTime + dur);
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterHz, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(amp, startTime + Math.min(0.06, dur * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.synthBus);

    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
  }

  private playKickDrum(
    startTime: number,
    startHz: number,
    endHz: number,
    dur: number,
    amp: number
  ): void {
    if (!this.ctx || !this.synthBus) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startHz, startTime);
    osc.frequency.exponentialRampToValueAtTime(endHz, startTime + dur * 0.75);

    gain.gain.setValueAtTime(amp, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    osc.connect(gain);
    gain.connect(this.synthBus);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.02);
  }

  private playNoiseBurst(
    startTime: number,
    dur: number,
    amp: number,
    cutoffHz: number,
    highpass = false
  ): void {
    if (!this.ctx || !this.synthBus || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = highpass ? 'highpass' : 'lowpass';
    filter.frequency.setValueAtTime(cutoffHz, startTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(amp, startTime + Math.min(0.03, dur * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.synthBus);

    src.start(startTime);
    src.stop(startTime + dur + 0.02);
  }

  public dispose(): void {
    this.stop();
    if (this.synthBus) {
      try {
        this.synthBus.disconnect();
      } catch {
        // ignore
      }
      this.synthBus = null;
    }
  }
}
