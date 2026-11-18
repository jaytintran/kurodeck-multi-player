import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { KurodeckLogo } from './KurodeckLogo';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        title="Install Kurodeck as an offline desktop/mobile app"
        className={`inline-flex items-center gap-1.5 font-medium text-[#06E5F5] bg-[#141A29] hover:bg-[#1C2438] border border-[#06E5F5]/40 rounded transition-colors whitespace-nowrap shrink-0 ${
          compact ? 'px-2.5 py-1.5 text-[11px]' : 'w-full justify-center px-3 py-2 text-xs'
        }`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 font-medium text-[#06E5F5] bg-[#141A29] hover:bg-[#1C2438] border border-[#06E5F5]/40 rounded transition-colors whitespace-nowrap shrink-0 ${
            compact ? 'px-2.5 py-1.5 text-[11px]' : 'w-full justify-center px-3 py-2 text-xs'
          }`}
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>Install App</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm bg-[#0E121B] border border-[#253047] rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <KurodeckLogo className="w-7 h-7" />
                  <h3 className="text-sm font-semibold text-slate-100">
                    Install Kurodeck on iOS
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install guide"
                  className="p-1 text-slate-400 hover:text-slate-100 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                <li>
                  Tap the <Share className="w-3.5 h-3.5 inline mx-0.5 text-[#06E5F5]" />{' '}
                  <strong className="text-slate-100">Share</strong> button in Safari.
                </li>
                <li>
                  Scroll down and tap <strong className="text-slate-100">Add to Home Screen</strong>.
                </li>
                <li>
                  Confirm <strong className="text-slate-100">Add</strong> to launch Kurodeck standalone.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] rounded-md transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
