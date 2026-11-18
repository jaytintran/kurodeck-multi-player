import type {
  MultiStreamPreset,
  SavedUrlCardSize,
  StreamCanvasMode,
  YouTubeFolder,
  YouTubeVideoItem,
} from '../types/media';

const STORAGE_VIDEOS_KEY = 'kurodeck_yt_videos_v1';
const STORAGE_FOLDERS_KEY = 'kurodeck_yt_folders_v1';
const STORAGE_PRESETS_KEY = 'kurodeck_yt_presets_v1';
const STORAGE_CANVAS_MODE_KEY = 'kurodeck_stream_canvas_mode_v1';
const STORAGE_CARD_SIZE_KEY = 'kurodeck_saved_card_size_v1';

export const DEFAULT_FOLDERS: YouTubeFolder[] = [
  { id: 'fld_ambience', name: 'Ambience & Visuals', createdAt: 1700000001000 },
  { id: 'fld_music', name: 'Live Sets & Synth', createdAt: 1700000002000 },
  { id: 'fld_scenic', name: 'Night Drives & Cities', createdAt: 1700000003000 },
];

export const STARTER_YOUTUBE_VIDEOS: YouTubeVideoItem[] = [
  {
    id: 'yt_lofi_synth',
    videoId: '4xDzrJKXOOY',
    url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY',
    title: 'Synthwave Radio — Beats to Chill / Game To',
    channel: 'Lofi Girl',
    folderId: 'fld_music',
    notes: '24/7 retro synthwave stream ideal for background mixing',
    addedAt: 1700000010000,
    isFavorite: true,
    sortOrder: 0,
  },
  {
    id: 'yt_lofi_beats',
    videoId: 'jfKfPfyJRdk',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    title: 'Lofi Hip Hop Radio — Beats to Relax / Study To',
    channel: 'Lofi Girl',
    folderId: 'fld_music',
    notes: 'Classic continuous lofi stream',
    addedAt: 1700000011000,
    isFavorite: true,
    sortOrder: 1,
  },
  {
    id: 'yt_tokyo_rain',
    videoId: 'Et7O5-CzJZg',
    url: 'https://www.youtube.com/watch?v=Et7O5-CzJZg',
    title: 'Shinjuku Rain Walk at Night — Tokyo 4K',
    channel: 'Rambalac',
    folderId: 'fld_scenic',
    notes: 'Rain-soaked neon streets in Shinjuku, great muted backdrop',
    addedAt: 1700000012000,
    isFavorite: true,
    sortOrder: 2,
  },
  {
    id: 'yt_cyber_rain',
    videoId: '8plwv25NYRo',
    url: 'https://www.youtube.com/watch?v=8plwv25NYRo',
    title: 'Heavy Rain & Distant Thunder Ambience',
    channel: 'Relaxing White Noise',
    folderId: 'fld_ambience',
    notes: 'Rain soundscape to layer underneath offline audio tracks',
    addedAt: 1700000013000,
    isFavorite: false,
    sortOrder: 3,
  },
  {
    id: 'yt_earth_live',
    videoId: 'xRPjKQtRXR8',
    url: 'https://www.youtube.com/watch?v=xRPjKQtRXR8',
    title: 'Earth From Space — Orbital View',
    channel: 'NASA / ISS Views',
    folderId: 'fld_ambience',
    notes: 'Slow orbital horizon feed for multi-monitor backdrops',
    addedAt: 1700000014000,
    isFavorite: false,
    sortOrder: 4,
  },
  {
    id: 'yt_seoul_night',
    videoId: '4gW8z-xX3rA',
    url: 'https://www.youtube.com/watch?v=4gW8z-xX3rA',
    title: 'Cyberpunk Night Drive — 4K Urban Lights',
    channel: 'Night Drive Visuals',
    folderId: 'fld_scenic',
    notes: 'High-contrast neon city drive',
    addedAt: 1700000015000,
    isFavorite: false,
    sortOrder: 5,
  },
];

export const STARTER_PRESETS: MultiStreamPreset[] = [
  {
    id: 'pre_quad_cyber',
    name: 'Quad Night Desk',
    layout: '4',
    videoItemIds: ['yt_lofi_synth', 'yt_tokyo_rain', 'yt_cyber_rain', 'yt_earth_live'],
    createdAt: 1700000020000,
  },
  {
    id: 'pre_dual_focus',
    name: 'Dual Synth & City',
    layout: '2',
    videoItemIds: ['yt_lofi_synth', 'yt_tokyo_rain'],
    createdAt: 1700000021000,
  },
];

export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Raw 11-character YouTube video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      const segments = url.pathname.split('/').filter(Boolean);
      const markerIndex = segments.findIndex((seg) =>
        ['embed', 'shorts', 'live', 'v'].includes(seg)
      );
      if (markerIndex !== -1 && segments[markerIndex + 1]) {
        const candidate = segments[markerIndex + 1];
        if (/^[a-zA-Z0-9_-]{11}$/.test(candidate)) return candidate;
      }
    }
  } catch {
    // Fallback regex extraction for messy pasted strings
    const match = trimmed.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function getYouTubeCanonicalUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export async function fetchYouTubeOEmbed(
  videoId: string
): Promise<{ title: string; channel: string } | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3500);
  try {
    const targetUrl = encodeURIComponent(getYouTubeCanonicalUrl(videoId));
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${targetUrl}&format=json`,
      { signal: controller.signal }
    );
    window.clearTimeout(timeout);
    if (!response.ok) return null;
    const data = (await response.json()) as { title?: string; author_name?: string };
    return {
      title: data.title?.trim() || `YouTube Stream (${videoId})`,
      channel: data.author_name?.trim() || 'YouTube',
    };
  } catch {
    window.clearTimeout(timeout);
    return null;
  }
}

export function loadSavedYouTubeState(): {
  videos: YouTubeVideoItem[];
  folders: YouTubeFolder[];
  presets: MultiStreamPreset[];
} {
  try {
    const rawVideos = localStorage.getItem(STORAGE_VIDEOS_KEY);
    const rawFolders = localStorage.getItem(STORAGE_FOLDERS_KEY);
    const rawPresets = localStorage.getItem(STORAGE_PRESETS_KEY);

    const parsedVideos = rawVideos
      ? (JSON.parse(rawVideos) as Array<Partial<YouTubeVideoItem>>).map((v, idx) => ({
          id: v.id ?? `yt_restored_${idx}`,
          videoId: v.videoId ?? '',
          url: v.url ?? '',
          title: v.title ?? 'Untitled Video',
          channel: v.channel ?? 'YouTube',
          folderId: v.folderId ?? 'fld_ambience',
          notes: v.notes ?? '',
          addedAt: typeof v.addedAt === 'number' ? v.addedAt : Date.now(),
          isFavorite: Boolean(v.isFavorite),
          sortOrder: typeof v.sortOrder === 'number' ? v.sortOrder : idx,
        }))
      : STARTER_YOUTUBE_VIDEOS;

    return {
      videos: parsedVideos,
      folders: rawFolders ? (JSON.parse(rawFolders) as YouTubeFolder[]) : DEFAULT_FOLDERS,
      presets: rawPresets ? (JSON.parse(rawPresets) as MultiStreamPreset[]) : STARTER_PRESETS,
    };
  } catch {
    return {
      videos: STARTER_YOUTUBE_VIDEOS,
      folders: DEFAULT_FOLDERS,
      presets: STARTER_PRESETS,
    };
  }
}

export function saveYouTubeVideos(videos: YouTubeVideoItem[]): void {
  try {
    localStorage.setItem(STORAGE_VIDEOS_KEY, JSON.stringify(videos));
  } catch {
    // ignore storage quota errors
  }
}

export function saveYouTubeFolders(folders: YouTubeFolder[]): void {
  try {
    localStorage.setItem(STORAGE_FOLDERS_KEY, JSON.stringify(folders));
  } catch {
    // ignore
  }
}

export function saveYouTubePresets(presets: MultiStreamPreset[]): void {
  try {
    localStorage.setItem(STORAGE_PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // ignore
  }
}

export function loadStreamCanvasMode(): StreamCanvasMode {
  try {
    const val = localStorage.getItem(STORAGE_CANVAS_MODE_KEY);
    return val === 'canvas' ? 'canvas' : 'fit';
  } catch {
    return 'fit';
  }
}

export function saveStreamCanvasMode(mode: StreamCanvasMode): void {
  try {
    localStorage.setItem(STORAGE_CANVAS_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

export function loadSavedCardSize(): SavedUrlCardSize {
  try {
    const val = localStorage.getItem(STORAGE_CARD_SIZE_KEY);
    if (val === 'compact' || val === 'small' || val === 'medium' || val === 'large' || val === 'list') {
      return val;
    }
    return 'medium';
  } catch {
    return 'medium';
  }
}

export function saveSavedCardSize(size: SavedUrlCardSize): void {
  try {
    localStorage.setItem(STORAGE_CARD_SIZE_KEY, size);
  } catch {
    // ignore
  }
}

// YouTube IFrame API singleton loader
declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
            onError?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getPlayerState: () => number;
  destroy: () => void;
}

let ytApiPromise: Promise<NonNullable<Window['YT']>> | null = null;

export function loadYouTubeIframeApi(): Promise<NonNullable<Window['YT']>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window unavailable'));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) prevReady();
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        reject(new Error('YouTube IFrame API failed to initialize'));
      }
    };

    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        ytApiPromise = null;
        reject(new Error('Unable to load YouTube IFrame API'));
      };
      document.head.appendChild(script);
    }

    // Fallback poll in case API became ready before callback bound
    const poll = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(poll);
        resolve(window.YT);
      }
    }, 150);

    window.setTimeout(() => {
      window.clearInterval(poll);
    }, 12000);
  });

  return ytApiPromise;
}
