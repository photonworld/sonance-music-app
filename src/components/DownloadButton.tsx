import React from 'react';
import { Check, Download } from 'lucide-react';

interface DownloadButtonProps {
  isDownloaded: boolean;
  progress: number | undefined; // undefined = idle, 0..100 = downloading
  onDownload: (e: React.MouseEvent) => void;
  compact?: boolean;
  trackTitle?: string;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  isDownloaded,
  progress,
  onDownload,
  compact = false,
  trackTitle,
}) => {
  const isDownloading = typeof progress === 'number' && progress < 100;
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = isDownloading
    ? circumference - ((progress ?? 0) / 100) * circumference
    : 0;

  if (isDownloaded) {
    return (
      <span
        title="Saved for offline playback"
        aria-label={trackTitle ? `${trackTitle} saved offline` : 'Downloaded offline'}
        className={`inline-flex items-center justify-center gap-1 rounded-lg border shrink-0 ${
          compact ? 'min-w-[34px] min-h-[34px] px-1.5' : 'min-h-[34px] px-2.5'
        } text-[11px] font-medium`}
        style={{
          borderColor: 'var(--border-hairline)',
          backgroundColor: 'var(--bg-elevated)',
          color: 'var(--accent-primary)',
        }}
      >
        <Check className="w-3.5 h-3.5 shrink-0" />
        {!compact && <span>Offline</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={isDownloading}
      onClick={onDownload}
      aria-label={trackTitle ? `Download ${trackTitle} for offline playback` : 'Download offline'}
      title={isDownloading ? `Downloading ${progress}%` : 'Save for offline playback'}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border shrink-0 transition-all duration-150 hover:opacity-85 active:scale-95 disabled:cursor-wait ${
        compact ? 'min-w-[34px] min-h-[34px] px-1.5' : 'min-h-[34px] px-2.5'
      } text-[11px] font-medium`}
      style={{
        borderColor: isDownloading ? 'var(--accent-primary)' : 'var(--border-hairline)',
        backgroundColor: 'var(--bg-surface)',
        color: isDownloading ? 'var(--accent-primary)' : 'var(--text-primary)',
      }}
    >
      {isDownloading ? (
        <>
          <svg className="w-4 h-4 -rotate-90 shrink-0" viewBox="0 0 20 20">
            <circle
              cx="10"
              cy="10"
              r={radius}
              fill="none"
              stroke="var(--border-hairline)"
              strokeWidth="2.2"
            />
            <circle
              cx="10"
              cy="10"
              r={radius}
              fill="none"
              stroke="var(--accent-primary)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          {!compact && (
            <span className="font-mono-tabular text-[11px]">{progress}%</span>
          )}
        </>
      ) : (
        <>
          <Download className="w-3.5 h-3.5 shrink-0" />
          {!compact && <span>Save</span>}
        </>
      )}
    </button>
  );
};
