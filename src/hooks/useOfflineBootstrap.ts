import { useEffect, useRef } from 'react';
import { getYouTubeThumbnailUrl } from '../lib/youtube';
import type { YouTubeVideoItem } from '../types/media';

const OFFLINE_READY_FLAG = 'kurodeck_offline_cache_notified_v1';

interface UseOfflineBootstrapOptions {
  videos: YouTubeVideoItem[];
  isOnline: boolean;
  onOfflineReady?: (message: string) => void;
}

export function useOfflineBootstrap({
  videos,
  isOnline,
  onOfflineReady,
}: UseOfflineBootstrapOptions): void {
  const bootstrappedRef = useRef(false);
  const warmedThumbIdsRef = useRef<Set<string>>(new Set());

  // 1. Request persistent storage & warm Google Fonts + notify once SW is active
  useEffect(() => {
    if (!isOnline || bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const runBootstrap = async () => {
      // Request persistent browser storage so IndexedDB audio files are protected from eviction
      if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
        try {
          const alreadyPersisted = await navigator.storage.persisted?.();
          if (!alreadyPersisted) {
            await navigator.storage.persist();
          }
        } catch {
          // ignore permission errors in restricted contexts
        }
      }

      if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
        return;
      }

      try {
        await navigator.serviceWorker.ready;

        // Warm Google Fonts stylesheets and woff2 files so Visit 1 caches them through SW
        const fontLinks = Array.from(
          document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="fonts.googleapis.com"]')
        );
        for (const link of fontLinks) {
          try {
            const resp = await fetch(link.href, { mode: 'cors' });
            if (resp.ok) {
              const cssText = await resp.text();
              const woffMatches = cssText.match(/https:\/\/fonts\.gstatic\.com\/[^)'"\s]+/g) ?? [];
              const uniqueWoffs = Array.from(new Set(woffMatches)).slice(0, 12);
              await Promise.allSettled(
                uniqueWoffs.map((url) => fetch(url, { mode: 'cors' }))
              );
            }
          } catch {
            // ignore font warmup errors
          }
        }

        const alreadyNotified = localStorage.getItem(OFFLINE_READY_FLAG) === 'true';
        if (!alreadyNotified) {
          localStorage.setItem(OFFLINE_READY_FLAG, 'true');
          onOfflineReady?.('Ready for offline use — Kurodeck cached locally');
        }
      } catch {
        // SW not ready yet
      }
    };

    void runBootstrap();
  }, [isOnline, onOfflineReady]);

  // 2. Warm YouTube thumbnail cache whenever new videos appear while online
  useEffect(() => {
    if (!isOnline || videos.length === 0) return;

    const uncached = videos
      .map((v) => v.videoId)
      .filter((id) => Boolean(id) && !warmedThumbIdsRef.current.has(id));

    if (uncached.length === 0) return;

    const warmThumbnails = async () => {
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.ready;
        } catch {
          // proceed anyway
        }
      }
      for (const id of uncached) {
        warmedThumbIdsRef.current.add(id);
        fetch(getYouTubeThumbnailUrl(id), { mode: 'no-cors' }).catch(() => {
          // ignore network hiccups
        });
      }
    };

    void warmThumbnails();
  }, [videos, isOnline]);
}
