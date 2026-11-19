export type WorkspaceView = 'audio' | 'multistream' | 'hybrid' | 'urls';

export type RepeatMode = 'off' | 'all' | 'one';

export type AudioSortKey = 'addedAt' | 'title' | 'artist' | 'duration' | 'fileSize';

export interface EqSettings {
  bass: number; // -12 to +12 dB
  mid: number; // -12 to +12 dB
  treble: number; // -12 to +12 dB
  enabled: boolean;
}

export interface AudioTrackMeta {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number; // seconds
  fileSize: number; // bytes
  mimeType: string;
  format: string; // e.g., MP3, WAV, FLAC
  playlistId: string | null;
  coverUrl: string;
  addedAt: number;
  playCount: number;
  isFavorite: boolean;
  isStarter?: boolean;
}

export interface AudioTrackRecord extends AudioTrackMeta {
  blob: Blob;
}

export interface AudioPlaylist {
  id: string;
  name: string;
  createdAt: number;
}

export interface StorageSummary {
  usedBytes: number;
  quotaBytes: number;
  vaultBytes: number;
  trackCount: number;
}

export type SubliminalRole = 'subliminal' | 'frequency' | 'booster' | 'flush' | 'ambience';

export type StackViewMode = 'grid' | 'mixer' | 'mini';

export type PresetRoutine = 'Morning' | 'Focus' | 'Sleep' | 'Overnight' | 'Custom';

export interface YouTubeVideoItem {
  id: string; // unique library entry id
  videoId: string; // 11-char YouTube video ID
  url: string;
  title: string;
  channel: string;
  folderId: string;
  notes: string; // Legacy alias kept in sync with benefits
  role: SubliminalRole;
  topics: string[];
  benefits: string;
  playCount: number;
  loopCount: number;
  listeningSeconds: number;
  lastListenedAt?: number;
  pendingMetadata?: boolean;
  addedAt: number;
  isFavorite: boolean;
  sortOrder: number;
}

export interface YouTubeFolder {
  id: string;
  name: string;
  createdAt: number;
}

export type StreamGridLayout =
  | 'auto'
  | '1'
  | '2'
  | '4'
  | '6'
  | '9'
  | '16'
  | '25'
  | '36'
  | '49'
  | '64';

export type StreamCanvasMode = 'fit' | 'canvas';

export type SavedUrlGroupBy =
  | 'none'
  | 'topic'
  | 'creator'
  | 'role'
  | 'folder'
  | 'preset'
  | 'favorite'
  | 'date';

export type SavedUrlSortBy = 'custom' | 'title' | 'channel' | 'addedAt' | 'loops' | 'listening';

export type SavedUrlCardSize = 'compact' | 'small' | 'medium' | 'large' | 'list';

export interface StageSlot {
  slotId: string;
  videoItemId: string;
  videoId: string;
  title: string;
  channel: string;
  url: string;
  role: SubliminalRole;
  volume: number; // 0-100 personal mix volume
  isMuted: boolean;
  isPlaying: boolean;
  playbackRate: number; // 0.5 - 2.0
  infiniteLoop: boolean;
  targetLoops: number; // >= 1 when infiniteLoop is false
  completedLoops: number;
}

export interface PresetSlotConfig {
  videoItemId: string;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  infiniteLoop: boolean;
  targetLoops: number;
}

export interface MultiStreamPreset {
  id: string;
  name: string;
  routine: PresetRoutine;
  layout: StreamGridLayout;
  viewMode?: StackViewMode;
  videoItemIds: string[];
  slotConfigs?: PresetSlotConfig[];
  createdAt: number;
}

export interface StagePlayerHandle {
  play: () => void;
  pause: () => void;
  mute: () => void;
  unmute: () => void;
  setVolume: (vol: number) => void;
  setPlaybackRate: (rate: number) => void;
  seekTo: (seconds: number) => void;
}

export interface KurodeckBackupPayload {
  schemaVersion: 2;
  exportedAt: string;
  videos: YouTubeVideoItem[];
  folders: YouTubeFolder[];
  presets: MultiStreamPreset[];
}
