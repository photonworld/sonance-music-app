import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Track } from '../types/audio';
import { saveTrackWithBlob } from './db';

function buildFetchStreamUrl(rawUrl: string): string {
  const canUseProxy =
    !Capacitor.isNativePlatform() &&
    typeof window !== 'undefined' &&
    window.location.protocol.startsWith('http');
  if (canUseProxy) {
    return `/api/stream-proxy?url=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
}

function sanitizeFilename(input: string): string {
  return input
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 72);
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || '');
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function tryCacheArtworkAsDataUrl(artworkUrl?: string): Promise<string | undefined> {
  if (!artworkUrl) return undefined;
  if (artworkUrl.startsWith('data:')) return artworkUrl;
  try {
    const res = await fetch(artworkUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return artworkUrl;
    const imgBlob = await res.blob();
    const base64 = await blobToBase64(imgBlob);
    const mime = imgBlob.type || 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  } catch {
    return artworkUrl;
  }
}

export async function downloadOnlineTrackOffline(
  track: Track,
  onProgress?: (percent: number) => void
): Promise<Track> {
  if (!track.streamUrl) {
    throw new Error('Track has no remote stream URL to download.');
  }

  onProgress?.(4);
  const fetchUrl = buildFetchStreamUrl(track.streamUrl);
  const response = await fetch(fetchUrl);
  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  const contentType = response.headers.get('content-type') || track.mimeType || 'audio/mpeg';

  let audioBlob: Blob;
  if (response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        if (contentLength > 0) {
          onProgress?.(Math.min(95, Math.max(8, Math.round((received / contentLength) * 95))));
        } else {
          // Smooth indeterminate progress climb up to 90%
          onProgress?.(Math.min(90, 15 + Math.floor(received / 65536) * 4));
        }
      }
    }

    const totalLen = chunks.reduce((acc, c) => acc + c.byteLength, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    audioBlob = new Blob([combined], { type: contentType });
  } else {
    audioBlob = await response.blob();
  }

  if (audioBlob.size === 0) {
    throw new Error('Downloaded audio stream was empty.');
  }

  onProgress?.(96);
  const cachedArtwork = await tryCacheArtworkAsDataUrl(track.artworkDataUrl);

  const ext = track.format === 'FLAC' ? 'flac' : track.format === 'OGG' ? 'ogg' : 'mp3';
  const offlineTrackId = `offline-${track.id}`;

  const offlineTrack: Track = {
    id: offlineTrackId,
    title: track.title,
    artist: track.artist,
    album: track.album || 'Offline Downloads',
    genre: track.genre || 'Music',
    duration: track.duration,
    format: track.format || 'MP3',
    mimeType: contentType,
    bitrate: track.bitrate || 320,
    fileSize: audioBlob.size,
    artworkDataUrl: cachedArtwork,
    liked: track.liked,
    addedAt: Date.now(),
    sourceType: 'local',
    isLive: false,
    bpm: track.bpm,
    isDownloaded: true,
    downloadedAt: Date.now(),
    sourceTrackId: track.id,
  };

  await saveTrackWithBlob(offlineTrack, audioBlob);

  // Also persist into Documents/Music/Sonance on native Android devices
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    try {
      const base64Data = await blobToBase64(audioBlob);
      const safeName = sanitizeFilename(`${track.artist} - ${track.title}`) || offlineTrackId;
      await Filesystem.writeFile({
        path: `Music/Sonance/${safeName}.${ext}`,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true,
      });
    } catch (err) {
      console.warn('Native Android Documents save skipped (IndexedDB saved):', err);
    }
  }

  onProgress?.(100);
  return offlineTrack;
}
