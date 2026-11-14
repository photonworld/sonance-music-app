import React from 'react';
import { Check, Palette, X } from 'lucide-react';
import { THEME_LIST } from '../themes/themes';
import { ThemeId } from '../types/audio';

interface ThemePickerProps {
  activeTheme: ThemeId;
  onSelectTheme: (id: ThemeId) => void;
  onClose: () => void;
}

export const ThemePicker: React.FC<ThemePickerProps> = ({
  activeTheme,
  onSelectTheme,
  onClose,
}) => {
  return (
    <div
      className="w-80 rounded-2xl border p-4 shadow-2xl"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-hairline)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-hairline)' }}>
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
          <h3 className="text-sm font-semibold">Visual Themes</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close theme selector"
          className="p-1.5 rounded-lg hover:opacity-75"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 space-y-1.5">
        {THEME_LIST.map((theme) => {
          const isSelected = theme.id === activeTheme;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => onSelectTheme(theme.id)}
              className="w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors"
              style={{
                backgroundColor: isSelected ? 'var(--bg-elevated)' : 'transparent',
                borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-hairline)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg border shrink-0 flex items-center justify-center"
                  style={{
                    backgroundColor: theme.canvas,
                    borderColor: theme.hairline,
                  }}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: theme.accent }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{theme.name}</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {theme.description}
                  </p>
                </div>
              </div>
              {isSelected && (
                <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-primary)' }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
