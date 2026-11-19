import type {
  KurodeckBackupPayload,
  MultiStreamPreset,
  PresetRoutine,
  SavedUrlCardSize,
  StackViewMode,
  StageSlot,
  StreamCanvasMode,
  StreamGridLayout,
  SubliminalRole,
  WorkspaceView,
  YouTubeFolder,
  YouTubeVideoItem,
} from '../types/media';

const STORAGE_VIDEOS_KEY = 'kurodeck_yt_videos_v1';
const STORAGE_FOLDERS_KEY = 'kurodeck_yt_folders_v1';
const STORAGE_PRESETS_KEY = 'kurodeck_yt_presets_v1';
const STORAGE_CANVAS_MODE_KEY = 'kurodeck_stream_canvas_mode_v1';
const STORAGE_CARD_SIZE_KEY = 'kurodeck_saved_card_size_v1';
const STORAGE_STACK_VIEW_MODE_KEY = 'kurodeck_stack_view_mode_v1';
const STORAGE_ACTIVE_VIEW_KEY = 'kurodeck_active_view_v1';
const STORAGE_STAGE_SLOTS_KEY = 'kurodeck_stage_slots_v1';
const STORAGE_GRID_LAYOUT_KEY = 'kurodeck_grid_layout_v1';
const STORAGE_MASTER_STACK_VOL_KEY = 'kurodeck_master_stack_vol_v1';
const STORAGE_HYBRID_CROSSFADE_KEY = 'kurodeck_hybrid_crossfade_v1';

export const SUBLIMINAL_ROLES: Array<{ value: SubliminalRole; label: string }> = [
  { value: 'subliminal', label: 'Subliminal' },
  { value: 'frequency', label: 'Frequency' },
  { value: 'booster', label: 'Booster' },
  { value: 'flush', label: 'Flush' },
  { value: 'ambience', label: 'Ambience' },
];

export const PRESET_ROUTINES: PresetRoutine[] = [
  'Morning',
  'Focus',
  'Sleep',
  'Overnight',
  'Custom',
];

export const SUGGESTED_TOPICS: string[] = [
  'Focus',
  'Sleep',
  'Confidence',
  'Calm',
  'Mindset',
  'Abundance',
  'Creativity',
  'Study',
  '432Hz',
  '528Hz',
  'Theta',
  'Rain',
];

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export function formatRoleLabel(role: SubliminalRole): string {
  return SUBLIMINAL_ROLES.find((r) => r.value === role)?.label ?? 'Subliminal';
}

export function normalizeTopics(input: string[] | string): string[] {
  const rawList = Array.isArray(input) ? input : input.split(/[,;]+/);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawList) {
    const clean = raw.trim().replace(/\s+/g, ' ');
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(clean);
    }
  }
  return result;
}

export const DEFAULT_FOLDERS: YouTubeFolder[] = [
  { id: 'fld_focus', name: 'Focus & Study', createdAt: 1700000001000 },
  { id: 'fld_sleep', name: 'Sleep & Overnight', createdAt: 1700000002000 },
  { id: 'fld_frequencies', name: 'Frequencies & Ambience', createdAt: 1700000003000 },
];

export const STARTER_YOUTUBE_VIDEOS: YouTubeVideoItem[] = [
  {
    id: 'yt_lofi_synth',
    videoId: '4xDzrJKXOOY',
    url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY',
    title: 'Synthwave Radio — Deep Focus & Flow State',
    channel: 'Lofi Girl',
    folderId: 'fld_focus',
    notes: 'Steady synth pulse for deep focus and creative stacking.',
    role: 'ambience',
    topics: ['Focus', 'Creativity', 'Mindset'],
    benefits: 'Steady synth pulse for deep focus and creative stacking.',
    playCount: 0,
    loopCount: 0,
    listeningSeconds: 0,
    addedAt: 1700000010000,
    isFavorite: true,
    sortOrder: 0,
  },
  {
    id: 'yt_lofi_beats',
    videoId: 'jfKfPfyJRdk',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    title: 'Study Beats — Calm Concentration Layer',
    channel: 'Lofi Girl',
    folderId: 'fld_focus',
    notes: 'Warm low-distraction backing track to mask layered affirmations.',
    role: 'subliminal',
    topics: ['Study', 'Focus', 'Calm'],
    benefits: 'Warm low-distraction backing track to mask layered affirmations.',
    playCount: 0,
    loopCount: 0,
    listeningSeconds: 0,
    addedAt: 1700000011000,
    isFavorite: true,
    sortOrder: 1,
  },
  {
    id: 'yt_tokyo_rain',
    videoId: 'Et7O5-CzJZg',
    url: 'https://www.youtube.com/watch?v=Et7O5-CzJZg',
    title: 'Shinjuku Midnight Rain Walk — Calm Nervous System',
    channel: 'Rambalac',
    folderId: 'fld_sleep',
    notes: 'Gentle neon rain atmosphere ideal for evening wind-down and calm mindset.',
    role: 'ambience',
    topics: ['Calm', 'Sleep', 'Rain'],
    benefits: 'Gentle neon rain atmosphere ideal for evening wind-down and calm mindset.',
    playCount: 0,
    loopCount: 0,
    listeningSeconds: 0,
    addedAt: 1700000012000,
    isFavorite: true,
    sortOrder: 2,
  },
  {
    id: 'yt_cyber_rain',
    videoId: '8plwv25NYRo',
    url: 'https://www.youtube.com/watch?v=8plwv25NYRo',
    title: 'Heavy Rain & Distant Thunder — Overnight Masking Layer',
    channel: 'Relaxing White Noise',
    folderId: 'fld_frequencies',
    notes: 'Smooth brown-rain texture to blend smoothly under 6+ stacked subliminals.',
    role: 'frequency',
    topics: ['Sleep', 'Rain', 'Theta'],
    benefits: 'Smooth brown-rain texture to blend smoothly under 6+ stacked subliminals.',
    playCount: 0,
    loopCount: 0,
    listeningSeconds: 0,
    addedAt: 1700000013000,
    isFavorite: false,
    sortOrder: 3,
  },
  {
    id: 'yt_earth_live',
    videoId: 'xRPjKQtRXR8',
    url: 'https://www.youtube.com/watch?v=xRPjKQtRXR8',
    title: 'Orbital Horizon — Expansion & Clarity Mindset',
    channel: 'NASA / ISS Views',
    folderId: 'fld_frequencies',
    notes: 'Wide calm horizon visual and subtle tone for morning alignment.',
    role: 'booster',
    topics: ['Mindset', 'Confidence', '432Hz'],
    benefits: 'Wide calm horizon visual and subtle tone for morning alignment.',
    playCount: 0,
    loopCount: 0,
    listeningSeconds: 0,
    addedAt: 1700000014000,
    isFavorite: false,
    sortOrder: 4,
  },
  {
    id: 'yt_seoul_night',
    videoId: '4gW8z-xX3rA',
    url: 'https://www.youtube.com/watch?v=4gW8z-xX3rA',
    title: 'Midnight Urban Drive — Mental Reset & Detachment',
    channel: 'Night Drive Visuals',
    folderId: 'fld_sleep',
    notes: 'Clean mental reset and detachment layer before sleep.',
    role: 'flush',
    topics: ['Calm', 'Mindset', '528Hz'],
    benefits: 'Clean mental reset and detachment layer before sleep.',
    playCount: 0,
    loopCount: 0,
    listeningSeconds: 0,
    addedAt: 1700000015000,
    isFavorite: false,
    sortOrder: 5,
  },
];

export const STARTER_PRESETS: MultiStreamPreset[] = [
  {
    id: 'pre_focus_stack',
    name: 'Deep Focus Stack',
    routine: 'Focus',
    layout: '2',
    viewMode: 'mixer',
    videoItemIds: ['yt_lofi_synth', 'yt_lofi_beats', 'yt_cyber_rain'],
    slotConfigs: [
      { videoItemId: 'yt_lofi_synth', volume: 35, isMuted: false, playbackRate: 1, infiniteLoop: true, targetLoops: 10 },
      { videoItemId: 'yt_lofi_beats', volume: 22, isMuted: false, playbackRate: 1, infiniteLoop: true, targetLoops: 10 },
      { videoItemId: 'yt_cyber_rain', volume: 18, isMuted: false, playbackRate: 1, infiniteLoop: true, targetLoops: 10 },
    ],
    createdAt: 1700000020000,
  },
  {
    id: 'pre_overnight_rain',
    name: 'Overnight Calm Rain',
    routine: 'Overnight',
    layout: '2',
    viewMode: 'mixer',
    videoItemIds: ['yt_tokyo_rain', 'yt_cyber_rain'],
    slotConfigs: [
      { videoItemId: 'yt_tokyo_rain', volume: 18, isMuted: false, playbackRate: 1, infiniteLoop: true, targetLoops: 20 },
      { videoItemId: 'yt_cyber_rain', volume: 24, isMuted: false, playbackRate: 1, infiniteLoop: true, targetLoops: 20 },
    ],
    createdAt: 1700000021000,
  },
];

export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

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
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }
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
      title: data.title?.trim() || `YouTube Video (${videoId})`,
      channel: data.author_name?.trim() || 'YouTube',
    };
  } catch {
    window.clearTimeout(timeout);
    return null;
  }
}

function hydrateVideoItem(v: Partial<YouTubeVideoItem>, idx: number, fallbackFolderId: string): YouTubeVideoItem {
  const validRoles: SubliminalRole[] = ['subliminal', 'frequency', 'booster', 'flush', 'ambience'];
  const role: SubliminalRole =
    v.role && validRoles.includes(v.role) ? v.role : 'subliminal';
  const benefits = typeof v.benefits === 'string' && v.benefits.trim()
    ? v.benefits
    : typeof v.notes === 'string'
      ? v.notes
      : '';
  return {
    id: v.id ?? `yt_restored_${idx}`,
    videoId: v.videoId ?? '',
    url: v.url || (v.videoId ? getYouTubeCanonicalUrl(v.videoId) : ''),
    title: v.title ?? 'Untitled Subliminal',
    channel: v.channel ?? 'YouTube',
    folderId: v.folderId ?? fallbackFolderId,
    notes: benefits,
    role,
    topics: Array.isArray(v.topics) ? normalizeTopics(v.topics) : [],
    benefits,
    playCount: typeof v.playCount === 'number' && v.playCount >= 0 ? v.playCount : 0,
    loopCount: typeof v.loopCount === 'number' && v.loopCount >= 0 ? v.loopCount : 0,
    listeningSeconds:
      typeof v.listeningSeconds === 'number' && v.listeningSeconds >= 0 ? v.listeningSeconds : 0,
    lastListenedAt: typeof v.lastListenedAt === 'number' ? v.lastListenedAt : undefined,
    pendingMetadata: Boolean(v.pendingMetadata),
    addedAt: typeof v.addedAt === 'number' ? v.addedAt : Date.now(),
    isFavorite: Boolean(v.isFavorite),
    sortOrder: typeof v.sortOrder === 'number' ? v.sortOrder : idx,
  };
}

function hydratePreset(p: Partial<MultiStreamPreset>, idx: number): MultiStreamPreset {
  const routine: PresetRoutine =
    p.routine && PRESET_ROUTINES.includes(p.routine) ? p.routine : 'Custom';
  const videoItemIds = Array.isArray(p.videoItemIds)
    ? p.videoItemIds.filter((id): id is string => typeof id === 'string')
    : [];
  return {
    id: p.id ?? `pre_restored_${idx}`,
    name: p.name ?? 'Saved Stack',
    routine,
    layout: p.layout ?? 'auto',
    viewMode:
      p.viewMode === 'grid' || p.viewMode === 'mixer' || p.viewMode === 'mini'
        ? p.viewMode
        : undefined,
    videoItemIds,
    slotConfigs: Array.isArray(p.slotConfigs) ? p.slotConfigs : undefined,
    createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
  };
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

    const folders: YouTubeFolder[] = rawFolders
      ? (JSON.parse(rawFolders) as YouTubeFolder[])
      : DEFAULT_FOLDERS;
    const fallbackFolderId = folders[0]?.id ?? DEFAULT_FOLDERS[0].id;

    const videos = rawVideos
      ? (JSON.parse(rawVideos) as Array<Partial<YouTubeVideoItem>>)
          .filter((v) => Boolean(v.videoId))
          .map((v, idx) => hydrateVideoItem(v, idx, fallbackFolderId))
      : STARTER_YOUTUBE_VIDEOS;

    const presets = rawPresets
      ? (JSON.parse(rawPresets) as Array<Partial<MultiStreamPreset>>).map(hydratePreset)
      : STARTER_PRESETS;

    return { videos, folders, presets };
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
    if (
      val === 'compact' ||
      val === 'small' ||
      val === 'medium' ||
      val === 'large' ||
      val === 'list'
    ) {
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

export function loadStackViewMode(): StackViewMode {
  try {
    const val = localStorage.getItem(STORAGE_STACK_VIEW_MODE_KEY);
    if (val === 'grid' || val === 'mixer' || val === 'mini') return val;
    return 'grid';
  } catch {
    return 'grid';
  }
}

export function saveStackViewMode(mode: StackViewMode): void {
  try {
    localStorage.setItem(STORAGE_STACK_VIEW_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

export function loadActiveView(): WorkspaceView {
  try {
    const val = localStorage.getItem(STORAGE_ACTIVE_VIEW_KEY);
    if (val === 'audio' || val === 'multistream' || val === 'hybrid' || val === 'urls') {
      return val;
    }
    return 'audio';
  } catch {
    return 'audio';
  }
}

export function saveActiveView(view: WorkspaceView): void {
  try {
    localStorage.setItem(STORAGE_ACTIVE_VIEW_KEY, view);
  } catch {
    // ignore
  }
}

export function loadGridLayout(): StreamGridLayout {
  try {
    const val = localStorage.getItem(STORAGE_GRID_LAYOUT_KEY) as StreamGridLayout | null;
    const valid: StreamGridLayout[] = [
      'auto',
      '1',
      '2',
      '4',
      '6',
      '9',
      '16',
      '25',
      '36',
      '49',
      '64',
    ];
    return val && valid.includes(val) ? val : 'auto';
  } catch {
    return 'auto';
  }
}

export function saveGridLayout(layout: StreamGridLayout): void {
  try {
    localStorage.setItem(STORAGE_GRID_LAYOUT_KEY, layout);
  } catch {
    // ignore
  }
}

export function loadMasterStackVolume(): number {
  try {
    const raw = localStorage.getItem(STORAGE_MASTER_STACK_VOL_KEY);
    const num = raw !== null ? Number(raw) : 100;
    return Number.isFinite(num) ? Math.max(0, Math.min(100, Math.round(num))) : 100;
  } catch {
    return 100;
  }
}

export function saveMasterStackVolume(vol: number): void {
  try {
    localStorage.setItem(STORAGE_MASTER_STACK_VOL_KEY, String(Math.round(vol)));
  } catch {
    // ignore
  }
}

export function loadHybridCrossfade(): number {
  try {
    const raw = localStorage.getItem(STORAGE_HYBRID_CROSSFADE_KEY);
    const num = raw !== null ? Number(raw) : 50;
    return Number.isFinite(num) ? Math.max(0, Math.min(100, Math.round(num))) : 50;
  } catch {
    return 50;
  }
}

export function saveHybridCrossfade(val: number): void {
  try {
    localStorage.setItem(STORAGE_HYBRID_CROSSFADE_KEY, String(Math.round(val)));
  } catch {
    // ignore
  }
}

export function loadPersistedStageSlots(): StageSlot[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_STAGE_SLOTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Array<Partial<StageSlot>>;
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((s) => Boolean(s.slotId && s.videoId))
      .map((s) => ({
        slotId: s.slotId!,
        videoItemId: s.videoItemId ?? s.slotId!,
        videoId: s.videoId!,
        title: s.title ?? 'Subliminal',
        channel: s.channel ?? 'YouTube',
        url: s.url ?? getYouTubeCanonicalUrl(s.videoId!),
        role: s.role ?? 'subliminal',
        volume: typeof s.volume === 'number' ? Math.max(0, Math.min(100, s.volume)) : 35,
        isMuted: Boolean(s.isMuted),
        isPlaying: false, // always starts paused on reload
        playbackRate:
          typeof s.playbackRate === 'number' && s.playbackRate >= 0.5 && s.playbackRate <= 2
            ? s.playbackRate
            : 1,
        infiniteLoop: s.infiniteLoop !== undefined ? Boolean(s.infiniteLoop) : true,
        targetLoops:
          typeof s.targetLoops === 'number' && s.targetLoops >= 1
            ? Math.round(s.targetLoops)
            : 10,
        completedLoops: 0,
      }));
  } catch {
    return null;
  }
}

export function savePersistedStageSlots(slots: StageSlot[]): void {
  try {
    localStorage.setItem(STORAGE_STAGE_SLOTS_KEY, JSON.stringify(slots));
  } catch {
    // ignore
  }
}

export function exportKurodeckBackupJson(data: {
  videos: YouTubeVideoItem[];
  folders: YouTubeFolder[];
  presets: MultiStreamPreset[];
}): string {
  const payload: KurodeckBackupPayload = {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    videos: data.videos,
    folders: data.folders,
    presets: data.presets,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseKurodeckBackupJson(rawText: string): {
  videos: YouTubeVideoItem[];
  folders: YouTubeFolder[];
  presets: MultiStreamPreset[];
} {
  const parsed = JSON.parse(rawText) as Partial<KurodeckBackupPayload>;
  if (!parsed || !Array.isArray(parsed.videos) || !Array.isArray(parsed.folders)) {
    throw new Error('Invalid Kurodeck backup file structure.');
  }

  const folders: YouTubeFolder[] = parsed.folders
    .filter((f): f is YouTubeFolder => Boolean(f && typeof f.id === 'string' && typeof f.name === 'string'))
    .map((f) => ({
      id: f.id,
      name: f.name.trim() || 'Folder',
      createdAt: typeof f.createdAt === 'number' ? f.createdAt : Date.now(),
    }));

  const safeFolders = folders.length > 0 ? folders : DEFAULT_FOLDERS;
  const fallbackFolderId = safeFolders[0].id;

  const videos = parsed.videos
    .filter((v) => Boolean(v && typeof v.videoId === 'string' && v.videoId.trim()))
    .map((v, idx) => hydrateVideoItem(v, idx, fallbackFolderId));

  const presets = Array.isArray(parsed.presets)
    ? parsed.presets.map(hydratePreset)
    : [];

  return { videos, folders: safeFolders, presets };
}

export function formatListeningTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0m';
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 1) return '<1m';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
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
  setPlaybackRate: (suggestedRate: number) => void;
  getPlaybackRate?: () => number;
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
