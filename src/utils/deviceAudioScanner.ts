import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { extractTrackFromFile } from './audioMetadata';
import { getAllTracks, saveTrackWithBlob } from './db';

const SCAN_ROOT_FOLDERS = [
  'Music',
  'Download',
  'Downloads',
  'Audio',
  'Songs',
  'My Music',
];

const ALLOWED_EXTENSIONS = new Set([
  'mp3',
  'flac',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'opus',
]);

const EXCLUDED_KEYWORDS = [
  'call',
  'recording',
  'record',
  'voice',
  'whatsapp',
  'telegram',
  'ringtone',
  'notification',
  'alarm',
  'sound_recorder',
  'audio_record',
  'ptt',
];

const MIN_FILE_SIZE_BYTES = 300 * 1024; // 300 KB
const MIN_DURATION_SECONDS = 30;
const MAX_SCAN_DEPTH = 4;

const EXT_TO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  flac: 'audio/flac',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
};

export interface DeviceScanResult {
  addedCount: number;
  scannedCount: number;
  skippedCount: number;
  source: 'android' | 'web-directory' | 'unsupported';
}

function getExtension(name: string): string {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() ?? '' : '';
}

function isExcludedPathOrName(pathOrName: string): boolean {
  const normalized = pathOrName.toLowerCase();
  return EXCLUDED_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function makeDuplicateKey(title: string, fileSize: number): string {
  return `${title.trim().toLowerCase()}::${fileSize}`;
}

async function ensureStoragePermission(): Promise<boolean> {
  try {
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage === 'granted') return true;
    const requested = await Filesystem.requestPermissions();
    return requested.publicStorage === 'granted';
  } catch {
    return false;
  }
}

async function scanAndroidDirectoryRecursive(
  relativePath: string,
  depth: number,
  collected: Array<{ path: string; name: string; size: number }>
): Promise<void> {
  if (depth > MAX_SCAN_DEPTH) return;
  if (isExcludedPathOrName(relativePath)) return;

  try {
    const listing = await Filesystem.readdir({
      path: relativePath,
      directory: Directory.ExternalStorage,
    });

    for (const entry of listing.files) {
      const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      if (isExcludedPathOrName(entryPath) || isExcludedPathOrName(entry.name)) {
        continue;
      }

      if (entry.type === 'directory') {
        await scanAndroidDirectoryRecursive(entryPath, depth + 1, collected);
      } else if (entry.type === 'file') {
        const ext = getExtension(entry.name);
        if (!ALLOWED_EXTENSIONS.has(ext)) continue;
        if (entry.size > 0 && entry.size < MIN_FILE_SIZE_BYTES) continue;

        collected.push({
          path: entryPath,
          name: entry.name,
          size: entry.size,
        });
      }
    }
  } catch {
    // Directory may not exist or may not be accessible; skip gracefully
  }
}

async function scanWebDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  depth: number,
  parentPath: string,
  collected: File[]
): Promise<void> {
  if (depth > MAX_SCAN_DEPTH) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const [, handle] of (dirHandle as any).entries()) {
    const currentPath = parentPath ? `${parentPath}/${handle.name}` : handle.name;
    if (isExcludedPathOrName(currentPath)) continue;

    if (handle.kind === 'directory') {
      await scanWebDirectoryHandle(handle, depth + 1, currentPath, collected);
    } else if (handle.kind === 'file') {
      const ext = getExtension(handle.name);
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;
      const file = await (handle as FileSystemFileHandle).getFile();
      if (file.size < MIN_FILE_SIZE_BYTES) continue;
      collected.push(file);
    }
  }
}

export async function scanDeviceMusicAuto(options?: {
  allowWebDirectoryPicker?: boolean;
}): Promise<DeviceScanResult> {
  const existingTracks = await getAllTracks();
  const seenKeys = new Set<string>(
    existingTracks.map((t) => makeDuplicateKey(t.title, t.fileSize))
  );

  // Native Android ExternalStorage scan
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    const permitted = await ensureStoragePermission();
    if (!permitted) {
      return {
        addedCount: 0,
        scannedCount: 0,
        skippedCount: 0,
        source: 'android',
      };
    }

    const candidates: Array<{ path: string; name: string; size: number }> = [];
    for (const rootFolder of SCAN_ROOT_FOLDERS) {
      await scanAndroidDirectoryRecursive(rootFolder, 1, candidates);
    }

    let addedCount = 0;
    let skippedCount = 0;

    for (const item of candidates) {
      try {
        const readRes = await Filesystem.readFile({
          path: item.path,
          directory: Directory.ExternalStorage,
        });

        const bytes =
          typeof readRes.data === 'string'
            ? base64ToUint8Array(readRes.data)
            : new Uint8Array(await readRes.data.arrayBuffer());

        if (bytes.byteLength < MIN_FILE_SIZE_BYTES) {
          skippedCount++;
          continue;
        }

        const ext = getExtension(item.name);
        const mimeType = EXT_TO_MIME[ext] ?? 'audio/mpeg';
        const arrayBuffer = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer;
        const file = new File([arrayBuffer], item.name, { type: mimeType });

        const { track, blob } = await extractTrackFromFile(file);

        if (track.duration > 0 && track.duration < MIN_DURATION_SECONDS) {
          skippedCount++;
          continue;
        }

        const dupKey = makeDuplicateKey(track.title, track.fileSize);
        if (seenKeys.has(dupKey)) {
          skippedCount++;
          continue;
        }

        seenKeys.add(dupKey);
        await saveTrackWithBlob(track, blob);
        addedCount++;
      } catch (err) {
        console.warn('Skipped unreadable audio file:', item.path, err);
        skippedCount++;
      }
    }

    localStorage.setItem('sonance-initial-scan-done', '1');
    return {
      addedCount,
      scannedCount: candidates.length,
      skippedCount,
      source: 'android',
    };
  }

  // Web manual scan fallback via File System Access API (when user triggers manual scan)
  if (
    options?.allowWebDirectoryPicker &&
    typeof window !== 'undefined' &&
    'showDirectoryPicker' in window
  ) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
      const files: File[] = [];
      await scanWebDirectoryHandle(dirHandle, 1, dirHandle.name || '', files);

      let addedCount = 0;
      let skippedCount = 0;

      for (const file of files) {
        try {
          const { track, blob } = await extractTrackFromFile(file);
          if (track.duration > 0 && track.duration < MIN_DURATION_SECONDS) {
            skippedCount++;
            continue;
          }
          const dupKey = makeDuplicateKey(track.title, track.fileSize);
          if (seenKeys.has(dupKey)) {
            skippedCount++;
            continue;
          }
          seenKeys.add(dupKey);
          await saveTrackWithBlob(track, blob);
          addedCount++;
        } catch {
          skippedCount++;
        }
      }

      return {
        addedCount,
        scannedCount: files.length,
        skippedCount,
        source: 'web-directory',
      };
    } catch {
      return {
        addedCount: 0,
        scannedCount: 0,
        skippedCount: 0,
        source: 'web-directory',
      };
    }
  }

  return {
    addedCount: 0,
    scannedCount: 0,
    skippedCount: 0,
    source: 'unsupported',
  };
}
