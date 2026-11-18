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

export interface YouTubeVideoItem {
  id: string; // unique library entry id
  videoId: string; // 11-char YouTube video ID
  url: string;
  title: string;
  channel: string;
  folderId: string;
  notes: string;
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

export type SavedUrlGroupBy = 'none' | 'folder' | 'channel' | 'favorite' | 'preset' | 'date';

export type SavedUrlSortBy = 'custom' | 'title' | 'channel' | 'addedAt';

export type SavedUrlCardSize = 'compact' | 'small' | 'medium' | 'large' | 'list';

export interface StageSlot {
  slotId: string;
  videoItemId: string;
  videoId: string;
  title: string;
  channel: string;
  url: string;
  volume: number; // 0-100
  isMuted: boolean;
  isPlaying: boolean;
}

export interface MultiStreamPreset {
  id: string;
  name: string;
  layout: StreamGridLayout;
  videoItemIds: string[];
  createdAt: number;
}

export interface StagePlayerHandle {
  play: () => void;
  pause: () => void;
  mute: () => void;
  unmute: () => void;
  setVolume: (vol: number) => void;
  seekTo: (seconds: number) => void;
}
