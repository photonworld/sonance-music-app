import { AudioFormat, Track } from '../types/audio';

const EXTENSION_FORMAT_MAP: Record<string, AudioFormat> = {
  mp3: 'MP3',
  flac: 'FLAC',
  wav: 'WAV',
  aac: 'AAC',
  m4a: 'M4A',
  ogg: 'OGG',
  opus: 'OPUS',
  aiff: 'AIFF',
  aif: 'AIFF',
  webm: 'WEBM',
};

export function detectAudioFormat(file: File): AudioFormat {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext in EXTENSION_FORMAT_MAP) {
    return EXTENSION_FORMAT_MAP[ext];
  }
  const mime = file.type.toLowerCase();
  if (mime.includes('flac')) return 'FLAC';
  if (mime.includes('wav')) return 'WAV';
  if (mime.includes('ogg')) return 'OGG';
  if (mime.includes('opus')) return 'OPUS';
  if (mime.includes('aac')) return 'AAC';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'M4A';
  if (mime.includes('aiff')) return 'AIFF';
  if (mime.includes('webm')) return 'WEBM';
  return 'MP3';
}

export function isSupportedAudioFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext in EXTENSION_FORMAT_MAP) return true;
  return file.type.startsWith('audio/');
}

function decodeText(bytes: Uint8Array, encoding: number): string {
  try {
    if (encoding === 1 || encoding === 2) {
      const decoder = new TextDecoder(encoding === 1 ? 'utf-16' : 'utf-16be');
      return decoder.decode(bytes).replace(/\0/g, '').trim();
    }
    if (encoding === 3) {
      return new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '').trim();
    }
    return new TextDecoder('latin1').decode(bytes).replace(/\0/g, '').trim();
  } catch {
    return '';
  }
}

function parseID3v2(buffer: ArrayBuffer): {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  artworkDataUrl?: string;
} {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 10) return {};
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return {};
  }

  const version = bytes[3];
  const tagSize =
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f);

  const end = Math.min(bytes.length, 10 + tagSize);
  let offset = 10;
  // Extended header skip for ID3v2.3/2.4
  if ((bytes[5] & 0x40) !== 0 && offset + 4 <= end) {
    const extSize = view.getUint32(offset, false);
    offset += extSize + (version === 3 ? 4 : 0);
  }

  const result: {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    artworkDataUrl?: string;
  } = {};

  while (offset + 10 <= end) {
    if (bytes[offset] === 0) break;
    const frameId = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    let frameSize = 0;
    if (version >= 4) {
      frameSize =
        ((bytes[offset + 4] & 0x7f) << 21) |
        ((bytes[offset + 5] & 0x7f) << 14) |
        ((bytes[offset + 6] & 0x7f) << 7) |
        (bytes[offset + 7] & 0x7f);
    } else {
      frameSize = view.getUint32(offset + 4, false);
    }

    offset += 10;
    if (frameSize <= 0 || offset + frameSize > end) break;

    const payload = bytes.subarray(offset, offset + frameSize);
    offset += frameSize;

    if (frameId === 'TIT2') {
      result.title = decodeText(payload.subarray(1), payload[0]);
    } else if (frameId === 'TPE1') {
      result.artist = decodeText(payload.subarray(1), payload[0]);
    } else if (frameId === 'TALB') {
      result.album = decodeText(payload.subarray(1), payload[0]);
    } else if (frameId === 'TCON') {
      const rawGenre = decodeText(payload.subarray(1), payload[0]);
      result.genre = rawGenre.replace(/^\(\d+\)/, '').trim() || rawGenre;
    } else if (frameId === 'APIC' && !result.artworkDataUrl && payload.length > 4) {
      const encoding = payload[0];
      let p = 1;
      while (p < payload.length && payload[p] !== 0) p++;
      const mime = new TextDecoder('latin1').decode(payload.subarray(1, p)) || 'image/jpeg';
      p += 2; // skip null + picture type
      if (encoding === 1 || encoding === 2) {
        while (p + 1 < payload.length && !(payload[p] === 0 && payload[p + 1] === 0)) {
          p += 2;
        }
        p += 2;
      } else {
        while (p < payload.length && payload[p] !== 0) p++;
        p += 1;
      }
      if (p < payload.length) {
        const imgBytes = payload.subarray(p);
        let binary = '';
        const chunk = 0x8000;
        for (let i = 0; i < imgBytes.length; i += chunk) {
          binary += String.fromCharCode(...imgBytes.subarray(i, i + chunk));
        }
        result.artworkDataUrl = `data:${mime};base64,${btoa(binary)}`;
      }
    }
  }

  return result;
}

function parseWavHeader(buffer: ArrayBuffer): { sampleRate?: number; bitDepth?: number } {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (bytes.length < 44) return {};
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const wave = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff !== 'RIFF' || wave !== 'WAVE') return {};

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    const size = view.getUint32(offset + 4, true);
    if (id === 'fmt ' && offset + 8 + 16 <= bytes.length) {
      const sampleRate = view.getUint32(offset + 12, true);
      const bitDepth = view.getUint16(offset + 22, true);
      return { sampleRate, bitDepth };
    }
    offset += 8 + size + (size % 2);
  }
  return {};
}

function parseFlacHeader(buffer: ArrayBuffer): {
  sampleRate?: number;
  bitDepth?: number;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
} {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 42) return {};
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'fLaC') return {};

  const out: {
    sampleRate?: number;
    bitDepth?: number;
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
  } = {};

  let offset = 4;
  while (offset + 4 <= bytes.length) {
    const header = bytes[offset];
    const isLast = (header & 0x80) !== 0;
    const blockType = header & 0x7f;
    const length = (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 4;
    if (offset + length > bytes.length) break;

    if (blockType === 0 && length >= 18) {
      // STREAMINFO
      const b10 = bytes[offset + 10];
      const b11 = bytes[offset + 11];
      const b12 = bytes[offset + 12];
      const b13 = bytes[offset + 13];
      out.sampleRate = (b10 << 12) | (b11 << 4) | (b12 >> 4);
      out.bitDepth = (((b12 & 0x01) << 4) | (b13 >> 4)) + 1;
    } else if (blockType === 4 && length > 8) {
      // VORBIS_COMMENT
      const view = new DataView(buffer, offset, length);
      let p = 0;
      const vendorLen = view.getUint32(p, true);
      p += 4 + vendorLen;
      if (p + 4 <= length) {
        const count = view.getUint32(p, true);
        p += 4;
        const decoder = new TextDecoder('utf-8');
        for (let i = 0; i < count && p + 4 <= length; i++) {
          const itemLen = view.getUint32(p, true);
          p += 4;
          if (p + itemLen > length) break;
          const entry = decoder.decode(bytes.subarray(offset + p, offset + p + itemLen));
          p += itemLen;
          const eq = entry.indexOf('=');
          if (eq !== -1) {
            const key = entry.slice(0, eq).toUpperCase();
            const val = entry.slice(eq + 1).trim();
            if (key === 'TITLE') out.title = val;
            else if (key === 'ARTIST') out.artist = val;
            else if (key === 'ALBUM') out.album = val;
            else if (key === 'GENRE') out.genre = val;
          }
        }
      }
    }

    offset += length;
    if (isLast) break;
  }

  return out;
}

function parseFilenameParts(filename: string): { title: string; artist: string } {
  const withoutExt = filename.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
  const dashSplit = withoutExt.split(' - ');
  if (dashSplit.length >= 2) {
    return {
      artist: dashSplit[0].trim() || 'Unknown Artist',
      title: dashSplit.slice(1).join(' - ').trim() || withoutExt,
    };
  }
  return {
    artist: 'Local Library',
    title: withoutExt || 'Untitled Track',
  };
}

function probeDurationWithAudioElement(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.preload = 'metadata';

    const finish = (dur: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(dur) && dur > 0 ? dur : 0);
    };

    audio.onloadedmetadata = () => finish(audio.duration);
    audio.onerror = () => finish(0);
    audio.src = url;
  });
}

export async function extractTrackFromFile(file: File): Promise<{ track: Track; blob: Blob }> {
  const format = detectAudioFormat(file);
  const headerSlice = await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer();

  const fallbackName = parseFilenameParts(file.name);
  let title = fallbackName.title;
  let artist = fallbackName.artist;
  let album = 'Local Collection';
  let genre = 'Audio';
  let artworkDataUrl: string | undefined;
  let sampleRate: number | undefined;
  let bitDepth: number | undefined;

  if (format === 'MP3' || format === 'AIFF') {
    const id3 = parseID3v2(headerSlice);
    if (id3.title) title = id3.title;
    if (id3.artist) artist = id3.artist;
    if (id3.album) album = id3.album;
    if (id3.genre) genre = id3.genre;
    artworkDataUrl = id3.artworkDataUrl;
  } else if (format === 'FLAC') {
    const flac = parseFlacHeader(headerSlice);
    if (flac.title) title = flac.title;
    if (flac.artist) artist = flac.artist;
    if (flac.album) album = flac.album;
    if (flac.genre) genre = flac.genre;
    sampleRate = flac.sampleRate;
    bitDepth = flac.bitDepth;
  } else if (format === 'WAV') {
    const wav = parseWavHeader(headerSlice);
    sampleRate = wav.sampleRate;
    bitDepth = wav.bitDepth;
  }

  const duration = await probeDurationWithAudioElement(file);
  const bitrate =
    duration > 0 && (format === 'MP3' || format === 'AAC' || format === 'M4A' || format === 'OGG' || format === 'OPUS')
      ? Math.round((file.size * 8) / duration / 1000)
      : undefined;

  const track: Track = {
    id: crypto.randomUUID(),
    title,
    artist,
    album,
    genre,
    duration,
    format,
    mimeType: file.type || 'audio/mpeg',
    sampleRate,
    bitDepth,
    bitrate,
    fileSize: file.size,
    artworkDataUrl,
    liked: false,
    addedAt: Date.now(),
  };

  return { track, blob: file };
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
