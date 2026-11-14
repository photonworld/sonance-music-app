import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-md"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-hairline)',
        color: 'var(--text-primary)',
      }}
    >
      <WifiOff className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
      <span>Offline Mode — Local library active</span>
    </div>
  );
};
