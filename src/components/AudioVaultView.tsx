import { useMemo, useRef, useState } from 'react';
import type { DragEvent, RefObject } from 'react';
import {
  Download,
  Edit3,
  FolderPlus,
  HardDrive,
  Heart,
  ListPlus,
  Music2,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { formatBytes, formatDuration } from '../lib/format';
import type {
  AudioPlaylist,
  AudioSortKey,
  AudioTrackMeta,
  StorageSummary,
} from '../types/media';
import { AudioSpectrumCanvas } from './AudioSpectrumCanvas';
import { PWAInstallButton } from './PWAInstallButton';

interface AudioVaultViewProps {
  tracks: AudioTrackMeta[];
  playlists: AudioPlaylist[];
  storageSummary: StorageSummary;
  currentTrack: AudioTrackMeta | null;
  isPlaying: boolean;
  analyserRef: RefObject<AnalyserNode | null>;
  isImporting: boolean;
  onImportFiles: (files: File[], playlistId: string | null) => Promise<void>;
  onPlayTrack: (trackId: string, queueIds: string[]) => void;
  onTogglePlayPause: () => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToQueue: (trackId: string) => void;
  onUpdateTrack: (trackId: string, patch: Partial<AudioTrackMeta>) => Promise<void>;
  onDeleteTrack: (trackId: string) => Promise<void>;
  onDownloadTrack: (track: AudioTrackMeta) => Promise<void>;
  onCreatePlaylist: (name: string) => Promise<void>;
  onDeletePlaylist: (playlistId: string) => Promise<void>;
}

type LibraryFilter = 'all' | 'favorites' | string; // string = playlistId

export function AudioVaultView({
  tracks,
  playlists,
  storageSummary,
  currentTrack,
  isPlaying,
  analyserRef,
  isImporting,
  onImportFiles,
  onPlayTrack,
  onTogglePlayPause,
  onToggleFavorite,
  onAddToQueue,
  onUpdateTrack,
  onDeleteTrack,
  onDownloadTrack,
  onCreatePlaylist,
  onDeletePlaylist,
}: AudioVaultViewProps) {
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<AudioSortKey>('addedAt');
  const [isDragging, setIsDragging] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [editingTrack, setEditingTrack] = useState<AudioTrackMeta | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [editPlaylistId, setEditPlaylistId] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activePlaylistId =
    filter !== 'all' && filter !== 'favorites' ? filter : null;

  const filteredTracks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = tracks.filter((t) => {
      if (filter === 'favorites' && !t.isFavorite) return false;
      if (activePlaylistId && t.playlistId !== activePlaylistId) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        t.format.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'artist':
          return a.artist.localeCompare(b.artist);
        case 'duration':
          return b.duration - a.duration;
        case 'fileSize':
          return b.fileSize - a.fileSize;
        case 'addedAt':
        default:
          return b.addedAt - a.addedAt;
      }
    });
  }, [tracks, filter, activePlaylistId, searchQuery, sortBy]);

  const filteredIds = useMemo(() => filteredTracks.map((t) => t.id), [filteredTracks]);

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a|aac|webm|opus)$/i.test(f.name)
    );
    if (files.length > 0) {
      await onImportFiles(files, activePlaylistId);
    }
  };

  const handleCreatePlaylistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    await onCreatePlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setShowNewPlaylist(false);
  };

  const openEditModal = (track: AudioTrackMeta) => {
    setEditingTrack(track);
    setEditTitle(track.title);
    setEditArtist(track.artist);
    setEditAlbum(track.album);
    setEditPlaylistId(track.playlistId ?? '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrack || !editTitle.trim()) return;
    await onUpdateTrack(editingTrack.id, {
      title: editTitle.trim(),
      artist: editArtist.trim() || 'Unknown Artist',
      album: editAlbum.trim() || 'Offline Vault',
      playlistId: editPlaylistId || null,
    });
    setEditingTrack(null);
  };

  const storagePercent = Math.min(
    100,
    Math.max(1, (storageSummary.vaultBytes / Math.max(1, storageSummary.quotaBytes)) * 100)
  );

  const activeSectionTitle =
    filter === 'all'
      ? 'All Offline Audio'
      : filter === 'favorites'
        ? 'Favorites'
        : playlists.find((p) => p.id === filter)?.name ?? 'Playlist';

  return (
    <div
      className="flex flex-col lg:flex-row lg:h-[calc(100vh-56px-76px)] lg:overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      {/* Hidden file picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus"
        className="hidden"
        onChange={async (e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (files.length > 0) {
            await onImportFiles(files, activePlaylistId);
          }
          e.target.value = '';
        }}
      />

      {/* Pinned Independent-Scroll Left Sidebar Rail */}
      {showSidebar && (
        <aside className="w-full lg:w-64 lg:h-full lg:overflow-y-auto shrink-0 border-b lg:border-b-0 lg:border-r border-[#1E2638] bg-[#0B0E17] p-4 flex flex-col justify-between gap-6">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between px-2.5 mb-2">
                <p className="text-xs font-medium text-slate-400">Library</p>
                <button
                  type="button"
                  onClick={() => setShowSidebar(false)}
                  title="Collapse sidebar"
                  className="p-1 text-slate-400 hover:text-slate-100 rounded transition-colors"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`w-full flex items-center justify-between px-2.5 py-2 text-sm rounded-md transition-colors ${
                  filter === 'all'
                    ? 'bg-[#141A29] text-[#06E5F5] font-medium'
                    : 'text-slate-300 hover:bg-[#111624] hover:text-slate-100'
                }`}
              >
                <span className="truncate">All Tracks</span>
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  {tracks.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilter('favorites')}
                className={`w-full flex items-center justify-between px-2.5 py-2 text-sm rounded-md transition-colors ${
                  filter === 'favorites'
                    ? 'bg-[#141A29] text-[#06E5F5] font-medium'
                    : 'text-slate-300 hover:bg-[#111624] hover:text-slate-100'
                }`}
              >
                <span className="truncate">Favorites</span>
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  {tracks.filter((t) => t.isFavorite).length}
                </span>
              </button>
            </div>
          </div>

          {/* Playlists */}
          <div>
            <div className="flex items-center justify-between px-2.5 mb-2">
              <p className="text-xs font-medium text-slate-400">Playlists</p>
              <button
                type="button"
                onClick={() => setShowNewPlaylist((prev) => !prev)}
                className="p-1 text-slate-400 hover:text-[#06E5F5] rounded transition-colors"
                title="Create playlist"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>

            {showNewPlaylist && (
              <form onSubmit={handleCreatePlaylistSubmit} className="px-1 mb-2 flex gap-1.5">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Playlist name"
                  autoFocus
                  className="w-full px-2.5 py-1.5 text-xs bg-[#07090E] border border-[#253047] rounded text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#06E5F5]"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 text-xs font-medium bg-[#06E5F5] text-[#07090E] rounded hover:bg-[#38EEFF] shrink-0"
                >
                  Add
                </button>
              </form>
            )}

            <div className="space-y-1">
              {playlists.length === 0 ? (
                <p className="px-2.5 py-1.5 text-xs text-slate-500">
                  No playlists created yet.
                </p>
              ) : (
                playlists.map((pl) => {
                  const count = tracks.filter((t) => t.playlistId === pl.id).length;
                  const active = filter === pl.id;
                  return (
                    <div
                      key={pl.id}
                      className={`group flex items-center justify-between rounded-md transition-colors ${
                        active
                          ? 'bg-[#141A29] text-[#06E5F5]'
                          : 'text-slate-300 hover:bg-[#111624] hover:text-slate-100'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setFilter(pl.id)}
                        className="flex-1 flex items-center justify-between px-2.5 py-2 text-sm text-left min-w-0"
                      >
                        <span className="truncate font-medium">{pl.name}</span>
                        <span className="text-xs font-mono tabular-nums text-slate-400 ml-2">
                          {count}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (filter === pl.id) setFilter('all');
                          void onDeletePlaylist(pl.id);
                        }}
                        title="Delete playlist"
                        className="opacity-0 group-hover:opacity-100 p-1.5 mr-1 text-slate-500 hover:text-[#F43F5E] transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Offline IndexedDB Vault Meter */}
        <div className="pt-4 border-t border-[#1E2638] space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-slate-300 font-medium">
              <HardDrive className="w-3.5 h-3.5 text-[#06E5F5]" />
              Offline Storage
            </span>
            <span className="font-mono tabular-nums text-slate-400">
              {formatBytes(storageSummary.vaultBytes)}
            </span>
          </div>
          <div className="h-1.5 w-full bg-[#141A29] rounded-sm overflow-hidden">
            <div
              className="h-full bg-[#06E5F5] transition-all duration-300"
              style={{ width: `${Math.max(4, storagePercent)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Audio files are persisted locally in browser IndexedDB for offline playback.
          </p>
          <PWAInstallButton />
        </div>
        </aside>
      )}

      {/* Independently Scrollable Main Content Area */}
      <div className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto p-4 sm:p-6 space-y-6">
        {!showSidebar && (
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setShowSidebar(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 bg-[#0E121B] border border-[#1E2638] rounded-md transition-colors"
            >
              <PanelLeftOpen className="w-3.5 h-3.5 text-[#06E5F5]" />
              Show Library Sidebar
            </button>
          </div>
        )}
        {/* Drop Overlay Banner */}
        {isDragging && (
          <div className="border border-dashed border-[#06E5F5] bg-[#06E5F5]/10 rounded-lg p-6 text-center">
            <p className="text-sm font-medium text-[#06E5F5]">
              Drop digital audio files here to store them offline in Kurodeck
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports MP3, WAV, FLAC, OGG, M4A, AAC, and WebM audio
            </p>
          </div>
        )}

        {/* Focal Anchor: Now Playing & Live Spectrum Deck */}
        <section className="bg-[#0E121B] border border-[#1E2638] rounded-lg p-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            <div className="md:col-span-5 flex items-center gap-4 min-w-0">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-md overflow-hidden border border-[#253047] bg-[#141A29] shrink-0">
                {currentTrack ? (
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music2 className="w-8 h-8 text-slate-500" />
                  </div>
                )}
              </div>

              <div className="min-w-0 space-y-1">
                <p className="text-xs text-[#06E5F5] font-medium">
                  {currentTrack ? (isPlaying ? 'Now Playing' : 'Paused') : 'Audio Deck Ready'}
                </p>
                <h1 className="text-lg sm:text-xl font-semibold text-slate-100 truncate">
                  {currentTrack ? currentTrack.title : 'Select a Track'}
                </h1>
                <p className="text-xs text-slate-400 truncate">
                  {currentTrack ? (
                    <>
                      {currentTrack.artist}
                      <span aria-hidden="true" className="mx-1.5 text-slate-600">
                        ·
                      </span>
                      {currentTrack.album}
                      <span aria-hidden="true" className="mx-1.5 text-slate-600">
                        ·
                      </span>
                      <span className="font-mono tabular-nums">
                        {currentTrack.format} / {formatBytes(currentTrack.fileSize)}
                      </span>
                    </>
                  ) : (
                    'Play starter offline audio or import your own files'
                  )}
                </p>
                <div className="pt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (currentTrack) {
                        onTogglePlayPause();
                      } else if (filteredTracks[0]) {
                        onPlayTrack(filteredTracks[0].id, filteredIds);
                      }
                    }}
                    disabled={!currentTrack && filteredTracks.length === 0}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] disabled:opacity-40 rounded transition-colors whitespace-nowrap shrink-0"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current" />
                        Pause Deck
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        {currentTrack ? 'Resume Deck' : 'Play All'}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#141A29] hover:bg-[#1C2438] border border-[#253047] rounded transition-colors whitespace-nowrap shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#06E5F5]" />
                    {isImporting ? 'Storing...' : 'Add Files'}
                  </button>
                </div>
              </div>
            </div>

            <div className="md:col-span-7 bg-[#090C12] border border-[#1B2234] rounded-md px-4 py-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span>Real-Time Frequency Analyzer</span>
                <span className="font-mono tabular-nums text-slate-500">
                  {currentTrack ? `${formatDuration(currentTrack.duration)} · Offline Blob` : 'Idle'}
                </span>
              </div>
              <AudioSpectrumCanvas
                analyserRef={analyserRef}
                isPlaying={isPlaying}
                barCount={48}
                height={76}
              />
            </div>
          </div>
        </section>

        {/* Toolbar: Section Title, Search, Sort */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">{activeSectionTitle}</h2>
            <p className="text-xs text-slate-400 font-mono tabular-nums">
              {filteredTracks.length} {filteredTracks.length === 1 ? 'file' : 'files'}
              <span aria-hidden="true" className="mx-1.5 text-slate-600">
                ·
              </span>
              {formatBytes(filteredTracks.reduce((sum, t) => sum + t.fileSize, 0))} total
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, artist, format..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-[#0E121B] border border-[#1E2638] rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#06E5F5]"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as AudioSortKey)}
              aria-label="Sort audio tracks"
              className="px-3 py-2 text-xs bg-[#0E121B] border border-[#1E2638] rounded-md text-slate-200 focus:outline-none focus:border-[#06E5F5]"
            >
              <option value="addedAt">Sort: Recently Added</option>
              <option value="title">Sort: Title</option>
              <option value="artist">Sort: Artist</option>
              <option value="duration">Sort: Duration</option>
              <option value="fileSize">Sort: File Size</option>
            </select>
          </div>
        </div>

        {/* High-Density Offline Track Data Table */}
        <div className="bg-[#0E121B] border border-[#1E2638] rounded-lg overflow-hidden">
          {filteredTracks.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Music2 className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-200">
                  {searchQuery ? 'No matching audio files' : 'Your offline vault is empty'}
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchQuery
                    ? 'Try clearing your search query or switching playlists.'
                    : 'Drag and drop MP3, WAV, FLAC, or OGG files anywhere here to store and play them offline.'}
                </p>
              </div>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] rounded-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Import Offline Audio
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1E2638] text-[11px] font-medium text-slate-400 bg-[#0B0F17]">
                    <th className="py-2.5 pl-4 pr-2 w-10">#</th>
                    <th className="py-2.5 px-2">Track</th>
                    <th className="py-2.5 px-2 hidden md:table-cell">Collection</th>
                    <th className="py-2.5 px-2 hidden sm:table-cell w-20">Format</th>
                    <th className="py-2.5 px-2 text-right w-20">Time</th>
                    <th className="py-2.5 px-2 text-right hidden lg:table-cell w-24">Size</th>
                    <th className="py-2.5 pl-2 pr-4 text-right w-36">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#182032] text-sm">
                  {filteredTracks.map((track, idx) => {
                    const isCurrent = currentTrack?.id === track.id;
                    const playlistName =
                      playlists.find((p) => p.id === track.playlistId)?.name ?? track.album;

                    return (
                      <tr
                        key={track.id}
                        className={`group transition-colors ${
                          isCurrent
                            ? 'bg-[#06E5F5]/[0.07]'
                            : 'hover:bg-[#141A29]/80'
                        }`}
                      >
                        <td className="py-2 pl-4 pr-2">
                          <button
                            type="button"
                            onClick={() =>
                              isCurrent ? onTogglePlayPause() : onPlayTrack(track.id, filteredIds)
                            }
                            aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                              isCurrent
                                ? 'text-[#06E5F5] bg-[#06E5F5]/15'
                                : 'text-slate-400 hover:text-[#06E5F5] hover:bg-[#1C2438]'
                            }`}
                          >
                            {isCurrent && isPlaying ? (
                              <Pause className="w-3.5 h-3.5 fill-current" />
                            ) : isCurrent ? (
                              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                            ) : (
                              <>
                                <span className="font-mono tabular-nums text-xs group-hover:hidden">
                                  {idx + 1}
                                </span>
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5 hidden group-hover:block" />
                              </>
                            )}
                          </button>
                        </td>

                        <td className="py-2 px-2">
                          <button
                            type="button"
                            onClick={() =>
                              isCurrent ? onTogglePlayPause() : onPlayTrack(track.id, filteredIds)
                            }
                            className="flex items-center gap-3 text-left min-w-0 max-w-xs sm:max-w-md"
                          >
                            <img
                              src={track.coverUrl}
                              alt={track.title}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded object-cover border border-[#253047] shrink-0 bg-[#141A29]"
                            />
                            <div className="min-w-0">
                              <p
                                className={`text-sm font-medium truncate ${
                                  isCurrent ? 'text-[#06E5F5]' : 'text-slate-100'
                                }`}
                              >
                                {track.title}
                              </p>
                              <p className="text-xs text-slate-400 truncate">{track.artist}</p>
                            </div>
                          </button>
                        </td>

                        <td className="py-2 px-2 hidden md:table-cell text-xs text-slate-400 truncate max-w-[180px]">
                          {playlistName}
                        </td>

                        <td className="py-2 px-2 hidden sm:table-cell text-xs font-mono text-slate-400">
                          {track.format}
                        </td>

                        <td className="py-2 px-2 text-right text-xs font-mono tabular-nums text-slate-300">
                          {formatDuration(track.duration)}
                        </td>

                        <td className="py-2 px-2 text-right hidden lg:table-cell text-xs font-mono tabular-nums text-slate-400">
                          {formatBytes(track.fileSize)}
                        </td>

                        <td className="py-2 pl-2 pr-4">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              onClick={() => onToggleFavorite(track.id)}
                              title={track.isFavorite ? 'Remove favorite' : 'Favorite'}
                              className={`p-1.5 rounded transition-colors ${
                                track.isFavorite
                                  ? 'text-[#F43F5E]'
                                  : 'text-slate-500 hover:text-slate-200'
                              }`}
                            >
                              <Heart
                                className={`w-3.5 h-3.5 ${track.isFavorite ? 'fill-current' : ''}`}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => onAddToQueue(track.id)}
                              title="Add to queue"
                              className="p-1.5 text-slate-500 hover:text-[#06E5F5] rounded transition-colors"
                            >
                              <ListPlus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(track)}
                              title="Edit track details"
                              className="p-1.5 text-slate-500 hover:text-slate-100 rounded transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDownloadTrack(track)}
                              title="Export audio file"
                              className="p-1.5 text-slate-500 hover:text-slate-100 rounded transition-colors hidden sm:inline-flex"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDeleteTrack(track.id)}
                              title="Delete from offline vault"
                              className="p-1.5 text-slate-500 hover:text-[#F43F5E] rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Track Metadata Modal */}
      {editingTrack && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0E121B] border border-[#253047] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-100">Edit Audio Metadata</h3>
              <button
                type="button"
                onClick={() => setEditingTrack(null)}
                className="p-1 text-slate-400 hover:text-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm bg-[#07090E] border border-[#253047] rounded text-slate-100 focus:outline-none focus:border-[#06E5F5]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Artist</label>
                <input
                  type="text"
                  value={editArtist}
                  onChange={(e) => setEditArtist(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#07090E] border border-[#253047] rounded text-slate-100 focus:outline-none focus:border-[#06E5F5]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Album</label>
                <input
                  type="text"
                  value={editAlbum}
                  onChange={(e) => setEditAlbum(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#07090E] border border-[#253047] rounded text-slate-100 focus:outline-none focus:border-[#06E5F5]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Playlist</label>
                <select
                  value={editPlaylistId}
                  onChange={(e) => setEditPlaylistId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#07090E] border border-[#253047] rounded text-slate-100 focus:outline-none focus:border-[#06E5F5]"
                >
                  <option value="">None (Unassigned)</option>
                  {playlists.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTrack(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 bg-[#141A29] hover:bg-[#1C2438] rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] rounded"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
