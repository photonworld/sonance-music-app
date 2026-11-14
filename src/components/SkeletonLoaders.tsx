import React from 'react';

export const StreamRowSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-2.5" aria-busy="true" aria-label="Loading streaming tracks">
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className="flex items-center gap-3 p-2.5 rounded-xl border"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 60%, transparent)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div className="w-8 h-8 rounded-lg sonance-shimmer shrink-0" />
        <div className="w-11 h-11 rounded-xl sonance-shimmer shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-3.5 w-2/5 rounded-md sonance-shimmer" />
          <div className="h-2.5 w-1/3 rounded-md sonance-shimmer" />
        </div>
        <div className="hidden sm:block h-3 w-10 rounded-md sonance-shimmer shrink-0" />
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-8 h-8 rounded-lg sonance-shimmer" />
          <div className="w-8 h-8 rounded-lg sonance-shimmer" />
        </div>
      </div>
    ))}
  </div>
);

export const MoodCardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div
    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
    aria-busy="true"
    aria-label="Loading recommendations"
  >
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className="rounded-2xl border p-3.5 space-y-3"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 60%, transparent)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl sonance-shimmer shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-3.5 w-3/4 rounded-md sonance-shimmer" />
            <div className="h-2.5 w-1/2 rounded-md sonance-shimmer" />
            <div className="h-2.5 w-2/3 rounded-md sonance-shimmer" />
          </div>
        </div>
        <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-hairline)' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-lg sonance-shimmer" />
            <div className="w-8 h-8 rounded-lg sonance-shimmer" />
          </div>
          <div className="w-16 h-8 rounded-lg sonance-shimmer" />
        </div>
      </div>
    ))}
  </div>
);

export const RadioCardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div
    className="grid grid-cols-1 md:grid-cols-2 gap-3"
    aria-busy="true"
    aria-label="Loading live radio stations"
  >
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className="flex items-center gap-3 p-3.5 rounded-2xl border"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-surface) 60%, transparent)',
          borderColor: 'var(--border-hairline)',
        }}
      >
        <div className="w-11 h-11 rounded-xl sonance-shimmer shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-3.5 w-3/5 rounded-md sonance-shimmer" />
          <div className="h-2.5 w-2/5 rounded-md sonance-shimmer" />
        </div>
        <div className="w-9 h-9 rounded-full sonance-shimmer shrink-0" />
      </div>
    ))}
  </div>
);
