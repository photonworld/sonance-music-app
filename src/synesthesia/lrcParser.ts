import { DetectedScript, KineticLyricStyle, SyncedLyricLine } from './types';

export function detectLineScript(text: string): DetectedScript {
  const hasBengali = /[\u0980-\u09FF]/.test(text);
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  const hasLatin = /[A-Za-z]/.test(text);

  const count =
    Number(hasBengali) + Number(hasDevanagari) + Number(hasArabic) + Number(hasLatin);
  if (count > 1 && (hasBengali || hasDevanagari || hasArabic)) {
    if (hasBengali && !hasDevanagari && !hasArabic) return 'bengali';
    if (hasDevanagari && !hasBengali && !hasArabic) return 'devanagari';
    if (hasArabic && !hasBengali && !hasDevanagari) return 'arabic';
    return 'mixed';
  }
  if (hasBengali) return 'bengali';
  if (hasDevanagari) return 'devanagari';
  if (hasArabic) return 'arabic';
  return 'latin';
}

export function inferKineticHint(text: string): KineticLyricStyle {
  const lower = text.toLowerCase();
  if (
    /(rain|tears|lonely|sad|dark|fade|shadow|mist|cold|গভীর|মেঘ|বৃষ্টি|অশ্রু|বিরহ|তन्हा|याद|गम|आँसू|रात)/.test(
      lower
    )
  ) {
    return 'smoke';
  }
  if (
    /(fire|ignite|burn|electric|neon|pulse|rush|fly|thunder|sky|আগুন|ঝড়|आग|जूनून|रोशनी|सफ़र)/.test(
      lower
    )
  ) {
    return 'spark';
  }
  if (
    /(love|soul|light|gold|star|moon|peace|noor|ishq|আলো|চাঁদ|মন|नूर|इश्क़|चाँद|रूह)/.test(
      lower
    )
  ) {
    return 'glow';
  }
  return 'drift';
}

/**
 * Parses `.lrc` timestamped lines (`[mm:ss.xx] text`) OR distributes plain-text lines evenly over track duration.
 */
export function parseLyrics(rawText: string, durationSeconds: number): SyncedLyricLine[] {
  const cleaned = rawText.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return [];

  const safeDur = Math.max(30, durationSeconds || 180);
  const lines = cleaned.split('\n');
  const lrcRegex = /^((?:\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\])+)\s*(.*)$/;
  const singleTagRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  const timedEntries: Array<{ timeSec: number; text: string }> = [];
  const plainLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    // Skip LRC metadata headers like [ar:...], [ti:...], [al:...]
    if (/^\[(?:ar|ti|al|by|offset|length):[^\]]*\]$/i.test(line)) continue;

    const match = line.match(lrcRegex);
    if (match) {
      const tagsBlock = match[1];
      const lyricText = match[2].trim();
      if (!lyricText) continue;

      let tagMatch: RegExpExecArray | null;
      singleTagRegex.lastIndex = 0;
      while ((tagMatch = singleTagRegex.exec(tagsBlock)) !== null) {
        const min = Number(tagMatch[1]);
        const sec = Number(tagMatch[2]);
        const fracRaw = tagMatch[3] || '0';
        const frac =
          fracRaw.length === 3 ? Number(fracRaw) / 1000 : Number(fracRaw) / 100;
        const timeSec = min * 60 + sec + frac;
        timedEntries.push({ timeSec, text: lyricText });
      }
    } else {
      plainLines.push(line);
    }
  }

  if (timedEntries.length > 0) {
    timedEntries.sort((a, b) => a.timeSec - b.timeSec);
    return timedEntries.map((entry, idx) => {
      const nextTime = timedEntries[idx + 1]?.timeSec ?? Math.min(safeDur, entry.timeSec + 7.5);
      return {
        id: `lrc-${idx}`,
        timeSec: entry.timeSec,
        endTimeSec: Math.max(entry.timeSec + 2.5, nextTime),
        text: entry.text,
        script: detectLineScript(entry.text),
        kineticHint: inferKineticHint(entry.text),
      };
    });
  }

  // Distribute plain text lines across the emotional span (leaving small intro/outro breathers)
  const introOffset = Math.min(6, safeDur * 0.04);
  const usableSpan = Math.max(20, safeDur - introOffset * 2);
  const step = usableSpan / Math.max(1, plainLines.length);

  return plainLines.map((text, idx) => {
    const timeSec = introOffset + idx * step;
    const endTimeSec = timeSec + Math.max(3, step);
    return {
      id: `txt-${idx}`,
      timeSec,
      endTimeSec,
      text,
      script: detectLineScript(text),
      kineticHint: inferKineticHint(text),
    };
  });
}

export function getActiveLyricLine(
  lines: SyncedLyricLine[],
  currentTimeSec: number
): SyncedLyricLine | null {
  if (lines.length === 0) return null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (currentTimeSec >= l.timeSec && currentTimeSec <= l.endTimeSec + 0.6) {
      return l;
    }
  }
  return null;
}
