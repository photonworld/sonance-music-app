import { Track } from '../types/audio';

function encodeAudioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataByteLength = numSamples * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(wavBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataByteLength, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function createProceduralArtwork(
  title: string,
  primary: string,
  secondary: string,
  bg: string
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 480, 480);

  const grad = ctx.createRadialGradient(180, 160, 20, 240, 240, 280);
  grad.addColorStop(0, primary);
  grad.addColorStop(0.6, secondary);
  grad.addColorStop(1, bg);
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 480, 480);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  for (let r = 60; r <= 190; r += 26) {
    ctx.beginPath();
    ctx.arc(240, 240, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(title, 36, 428);

  return canvas.toDataURL('image/png');
}

async function synthesizeElectronicTrack(): Promise<Blob> {
  const sampleRate = 44100;
  const bpm = 122;
  const beatDur = 60 / bpm;
  const duration = beatDur * 32; // 8 bars (~15.7s)
  const ctx = new OfflineAudioContext(2, Math.floor(sampleRate * duration), sampleRate);

  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);

  const chords = [
    [130.81, 196.0, 233.08, 293.66], // Cm9
    [116.54, 174.61, 207.65, 261.63], // Bbmaj7
    [103.83, 155.56, 196.0, 233.08], // Abmaj7
    [98.0, 146.83, 174.61, 220.0], // Gm7
  ];

  // Kick drum + bass pulse every beat
  for (let beat = 0; beat < 32; beat++) {
    const t = beat * beatDur;
    const kickOsc = ctx.createOscillator();
    const kickGain = ctx.createGain();
    kickOsc.type = 'sine';
    kickOsc.frequency.setValueAtTime(135, t);
    kickOsc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    kickGain.gain.setValueAtTime(0.85, t);
    kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    kickOsc.connect(kickGain).connect(master);
    kickOsc.start(t);
    kickOsc.stop(t + 0.25);

    // Offbeat crisp hat
    const hatTime = t + beatDur * 0.5;
    const noiseLen = Math.floor(sampleRate * 0.05);
    const noiseBuf = ctx.createBuffer(1, noiseLen, sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1;
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;
    const hatGain = ctx.createGain();
    hatGain.gain.setValueAtTime(0.18, hatTime);
    hatGain.gain.exponentialRampToValueAtTime(0.001, hatTime + 0.05);
    noiseSrc.connect(hp).connect(hatGain).connect(master);
    noiseSrc.start(hatTime);

    // Warm pluck arpeggio on 8th notes
    const chord = chords[Math.floor(beat / 8) % chords.length];
    for (let sub = 0; sub < 2; sub++) {
      const noteTime = t + sub * (beatDur * 0.5);
      const freq = chord[(beat * 2 + sub) % chord.length] * 2;
      const arpOsc = ctx.createOscillator();
      const arpFilter = ctx.createBiquadFilter();
      const arpGain = ctx.createGain();
      arpOsc.type = 'triangle';
      arpOsc.frequency.setValueAtTime(freq, noteTime);
      arpFilter.type = 'lowpass';
      arpFilter.frequency.setValueAtTime(2200, noteTime);
      arpFilter.frequency.exponentialRampToValueAtTime(480, noteTime + 0.2);
      arpGain.gain.setValueAtTime(0.18, noteTime);
      arpGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.22);
      arpOsc.connect(arpFilter).connect(arpGain).connect(master);
      arpOsc.start(noteTime);
      arpOsc.stop(noteTime + 0.23);
    }
  }

  // Lush pad per 2 bars
  for (let bar = 0; bar < 4; bar++) {
    const start = bar * beatDur * 8;
    const len = beatDur * 8;
    const chord = chords[bar % chords.length];
    for (const freq of chord) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      filter.type = 'lowpass';
      filter.frequency.value = 720;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.055, start + 0.35);
      gain.gain.setValueAtTime(0.055, start + len - 0.4);
      gain.gain.linearRampToValueAtTime(0.001, start + len);
      osc.connect(filter).connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + len);
    }
  }

  const rendered = await ctx.startRendering();
  return encodeAudioBufferToWav(rendered);
}

async function synthesizeAmbientTrack(): Promise<Blob> {
  const sampleRate = 44100;
  const duration = 18;
  const ctx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

  const master = ctx.createGain();
  master.gain.value = 0.65;
  master.connect(ctx.destination);

  const progressions = [
    [174.61, 220.0, 261.63, 329.63], // Fmaj7
    [146.83, 220.0, 261.63, 349.23], // Dm9
    [196.0, 246.94, 293.66, 392.0], // G6
  ];

  progressions.forEach((chord, idx) => {
    const start = idx * 6;
    const len = 6.2;
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const panner = ctx.createStereoPanner();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      panner.pan.value = (i - 1.5) * 0.35;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.11, start + 1.4);
      gain.gain.linearRampToValueAtTime(0.001, start + len);
      osc.connect(panner).connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + len);
    });
  });

  // Gentle glassy bell chimes
  const bellNotes = [523.25, 659.25, 783.99, 880, 659.25, 587.33, 523.25, 440, 523.25];
  bellNotes.forEach((freq, i) => {
    const t = 0.8 + i * 1.85;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 1.65);
  });

  const rendered = await ctx.startRendering();
  return encodeAudioBufferToWav(rendered);
}

async function synthesizeJazzAcousticTrack(): Promise<Blob> {
  const sampleRate = 44100;
  const bpm = 96;
  const beatDur = 60 / bpm;
  const totalBeats = 24;
  const duration = totalBeats * beatDur;
  const ctx = new OfflineAudioContext(2, Math.floor(sampleRate * duration), sampleRate);

  const master = ctx.createGain();
  master.gain.value = 0.68;
  master.connect(ctx.destination);

  const walkingBass = [
    110.0, 130.81, 146.83, 164.81, // A2 C3 D3 E3
    98.0, 123.47, 146.83, 164.81,  // G2 B2 D3 E3
    87.31, 110.0, 130.81, 146.83,  // F2 A2 C3 D3
    82.41, 98.0, 123.47, 146.83,   // E2 G2 B2 D3
  ];

  for (let beat = 0; beat < totalBeats; beat++) {
    const t = beat * beatDur;
    const bassFreq = walkingBass[beat % walkingBass.length];
    const bassOsc = ctx.createOscillator();
    const bassFilter = ctx.createBiquadFilter();
    const bassGain = ctx.createGain();
    bassOsc.type = 'triangle';
    bassOsc.frequency.value = bassFreq;
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 420;
    bassGain.gain.setValueAtTime(0.32, t);
    bassGain.gain.exponentialRampToValueAtTime(0.002, t + beatDur * 0.9);
    bassOsc.connect(bassFilter).connect(bassGain).connect(master);
    bassOsc.start(t);
    bassOsc.stop(t + beatDur);

    // Warm Rhodes stab on beats 0, 1.5, 3
    if (beat % 4 === 0 || beat % 4 === 2) {
      const chord = beat % 8 < 4 ? [220, 261.63, 329.63, 392] : [196, 246.94, 293.66, 349.23];
      const offset = beat % 4 === 2 ? beatDur * 0.5 : 0;
      chord.forEach((f) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.09, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.9);
        osc.connect(gain).connect(master);
        osc.start(t + offset);
        osc.stop(t + offset + 0.95);
      });
    }
  }

  const rendered = await ctx.startRendering();
  return encodeAudioBufferToWav(rendered);
}

export async function generateStarterTracks(): Promise<Array<{ track: Track; blob: Blob }>> {
  const [elecBlob, ambBlob, jazzBlob] = await Promise.all([
    synthesizeElectronicTrack(),
    synthesizeAmbientTrack(),
    synthesizeJazzAcousticTrack(),
  ]);

  const now = Date.now();
  return [
    {
      track: {
        id: 'demo-midnight-pulse',
        title: 'Midnight Pulse',
        artist: 'Sonance Studio',
        album: 'Reference Sessions',
        genre: 'Electronic',
        duration: 15.74,
        format: 'WAV',
        mimeType: 'audio/wav',
        sampleRate: 44100,
        bitDepth: 16,
        fileSize: elecBlob.size,
        artworkDataUrl: createProceduralArtwork('Midnight Pulse', '#D94E28', '#2B5B84', '#141413'),
        liked: true,
        addedAt: now - 3000,
        isDemo: true,
      },
      blob: elecBlob,
    },
    {
      track: {
        id: 'demo-morning-glass',
        title: 'Morning Glass',
        artist: 'Sonance Studio',
        album: 'Reference Sessions',
        genre: 'Ambient',
        duration: 18,
        format: 'WAV',
        mimeType: 'audio/wav',
        sampleRate: 44100,
        bitDepth: 16,
        fileSize: ambBlob.size,
        artworkDataUrl: createProceduralArtwork('Morning Glass', '#237A4B', '#3E6B89', '#162219'),
        liked: false,
        addedAt: now - 2000,
        isDemo: true,
      },
      blob: ambBlob,
    },
    {
      track: {
        id: 'demo-cedar-brass',
        title: 'Cedar & Brass',
        artist: 'Sonance Studio',
        album: 'Reference Sessions',
        genre: 'Jazz',
        duration: 15,
        format: 'WAV',
        mimeType: 'audio/wav',
        sampleRate: 44100,
        bitDepth: 16,
        fileSize: jazzBlob.size,
        artworkDataUrl: createProceduralArtwork('Cedar & Brass', '#E5A93C', '#8F4D2C', '#161110'),
        liked: false,
        addedAt: now - 1000,
        isDemo: true,
      },
      blob: jazzBlob,
    },
  ];
}
