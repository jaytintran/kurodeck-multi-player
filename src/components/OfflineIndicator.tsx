import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-4 sm:left-6 z-50 flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-amber-200 bg-[#18140B] border border-amber-500/45 rounded-md shadow-xl"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>Offline Mode — Local Audio Vault & cached assets active</span>
    </div>
  );
}
