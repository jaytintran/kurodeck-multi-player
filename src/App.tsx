/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AddVideoModal } from './components/AddVideoModal';
import { AudioTransportBar } from './components/AudioTransportBar';
import { AudioVaultView } from './components/AudioVaultView';
import { HybridDeckView } from './components/HybridDeckView';
import { MultiStreamView } from './components/MultiStreamView';
import { SavedUrlsView } from './components/SavedUrlsView';
import { useAudioEngine } from './hooks/useAudioEngine';
import {
  createPlaylist,
  deletePlaylist,
  deleteTrack,
  getStorageSummary,
  getTrackBlob,
  importAudioFiles,
  initializeAudioVault,
  updateTrackMeta,
} from './lib/audioDb';
import { createId } from './lib/format';
import {
  extractYouTubeVideoId,
  fetchYouTubeOEmbed,
  getYouTubeCanonicalUrl,
  loadSavedCardSize,
  loadSavedYouTubeState,
  loadStreamCanvasMode,
  saveSavedCardSize,
  saveStreamCanvasMode,
  saveYouTubeFolders,
  saveYouTubePresets,
  saveYouTubeVideos,
} from './lib/youtube';
import type {
  AudioPlaylist,
  AudioTrackMeta,
  MultiStreamPreset,
  SavedUrlCardSize,
  StagePlayerHandle,
  StageSlot,
  StorageSummary,
  StreamCanvasMode,
  StreamGridLayout,
  WorkspaceView,
  YouTubeFolder,
  YouTubeVideoItem,
} from './types/media';

const NAV_ITEMS: Array<{ id: WorkspaceView; label: string }> = [
  { id: 'audio', label: 'Audio Vault' },
  { id: 'multistream', label: 'Multi-Stream' },
  { id: 'hybrid', label: 'Hybrid Deck' },
  { id: 'urls', label: 'Saved URLs' },
];

function createStageSlot(video: YouTubeVideoItem, mutedByDefault: boolean): StageSlot {
  return {
    slotId: createId('slot'),
    videoItemId: video.id,
    videoId: video.videoId,
    title: video.title,
    channel: video.channel,
    url: video.url,
    volume: mutedByDefault ? 45 : 65,
    isMuted: mutedByDefault,
    isPlaying: false,
  };
}

export default function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>('audio');

  // Offline Audio Vault state
  const [tracks, setTracks] = useState<AudioTrackMeta[]>([]);
  const [playlists, setPlaylists] = useState<AudioPlaylist[]>([]);
  const [isVaultLoading, setIsVaultLoading] = useState(true);
  const [isImportingAudio, setIsImportingAudio] = useState(false);
  const [storageSummary, setStorageSummary] = useState<StorageSummary>({
    usedBytes: 0,
    quotaBytes: 512 * 1024 * 1024,
    vaultBytes: 0,
    trackCount: 0,
  });

  // YouTube Multi-Stream & URL Organizer state
  const [ytVideos, setYtVideos] = useState<YouTubeVideoItem[]>([]);
  const [ytFolders, setYtFolders] = useState<YouTubeFolder[]>([]);
  const [ytPresets, setYtPresets] = useState<MultiStreamPreset[]>([]);
  const [stageSlots, setStageSlots] = useState<StageSlot[]>([]);
  const [gridLayout, setGridLayout] = useState<StreamGridLayout>('auto');
  const [streamCanvasMode, setStreamCanvasMode] = useState<StreamCanvasMode>(() =>
    loadStreamCanvasMode()
  );
  const [savedCardSize, setSavedCardSize] = useState<SavedUrlCardSize>(() =>
    loadSavedCardSize()
  );
  const [soloSlotId, setSoloSlotId] = useState<string | null>(null);
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const globalAudioInputRef = useRef<HTMLInputElement | null>(null);
  const playerHandlesRef = useRef<Map<string, StagePlayerHandle>>(new Map());

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

  // Load IndexedDB Offline Audio Vault + Saved YouTube Library on mount
  useEffect(() => {
    let active = true;

    const ytState = loadSavedYouTubeState();
    setYtVideos(ytState.videos);
    setYtFolders(ytState.folders);
    setYtPresets(ytState.presets);

    // Pre-populate 2 starter streams on the Multi-Stream stage (second muted to avoid clash)
    const initialStreams = ytState.videos.slice(0, 2);
    setStageSlots(
      initialStreams.map((video, idx) => createStageSlot(video, idx > 0))
    );

    initializeAudioVault()
      .then(async ({ tracks: loadedTracks, playlists: loadedPlaylists }) => {
        if (!active) return;
        setTracks(loadedTracks);
        setPlaylists(loadedPlaylists);
        const summary = await getStorageSummary(loadedTracks);
        if (active) setStorageSummary(summary);
        setIsVaultLoading(false);
      })
      .catch(() => {
        if (active) setIsVaultLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Refresh storage metrics when track list changes
  useEffect(() => {
    if (isVaultLoading) return;
    void getStorageSummary(tracks).then(setStorageSummary);
  }, [tracks, isVaultLoading]);

  // Increment play count callback
  const handlePlayCountIncrement = useCallback((trackId: string) => {
    setTracks((prev) => {
      const target = prev.find((t) => t.id === trackId);
      if (!target) return prev;
      const nextCount = target.playCount + 1;
      void updateTrackMeta(trackId, { playCount: nextCount });
      return prev.map((t) => (t.id === trackId ? { ...t, playCount: nextCount } : t));
    });
  }, []);

  const audio = useAudioEngine({
    tracks,
    onTrackPlayCountIncrement: handlePlayCountIncrement,
  });

  // Offline Audio Vault Handlers
  const handleImportAudioFiles = useCallback(
    async (files: File[], playlistId: string | null = null) => {
      if (files.length === 0) return;
      setIsImportingAudio(true);
      try {
        const added = await importAudioFiles(files, playlistId);
        setTracks((prev) => [...added, ...prev]);
        showToast(
          `Stored ${added.length} audio ${added.length === 1 ? 'file' : 'files'} offline`
        );
      } catch {
        showToast('Unable to store one or more audio files in IndexedDB.');
      } finally {
        setIsImportingAudio(false);
      }
    },
    [showToast]
  );

  const handleToggleTrackFavorite = useCallback(async (trackId: string) => {
    setTracks((prev) => {
      const target = prev.find((t) => t.id === trackId);
      if (!target) return prev;
      const nextFav = !target.isFavorite;
      void updateTrackMeta(trackId, { isFavorite: nextFav });
      return prev.map((t) => (t.id === trackId ? { ...t, isFavorite: nextFav } : t));
    });
  }, []);

  const handleUpdateTrack = useCallback(
    async (trackId: string, patch: Partial<AudioTrackMeta>) => {
      const updated = await updateTrackMeta(trackId, patch);
      if (updated) {
        setTracks((prev) => prev.map((t) => (t.id === trackId ? updated : t)));
        showToast('Track metadata updated');
      }
    },
    [showToast]
  );

  const handleDeleteTrack = useCallback(
    async (trackId: string) => {
      audio.stopIfDeleted(trackId);
      await deleteTrack(trackId);
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
      showToast('Removed track from offline vault');
    },
    [audio, showToast]
  );

  const handleDownloadTrack = useCallback(
    async (track: AudioTrackMeta) => {
      const blob = await getTrackBlob(track.id);
      if (!blob) {
        showToast('Audio file not found in local vault.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const ext = track.format.toLowerCase() || 'wav';
      anchor.href = url;
      anchor.download = `${track.artist} - ${track.title}.${ext}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    [showToast]
  );

  const handleCreatePlaylist = useCallback(
    async (name: string) => {
      const pl = await createPlaylist(name);
      setPlaylists((prev) => [...prev, pl]);
      showToast(`Created playlist "${pl.name}"`);
    },
    [showToast]
  );

  const handleDeletePlaylist = useCallback(
    async (playlistId: string) => {
      await deletePlaylist(playlistId);
      setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
      setTracks((prev) =>
        prev.map((t) => (t.playlistId === playlistId ? { ...t, playlistId: null } : t))
      );
      showToast('Playlist deleted');
    },
    [showToast]
  );

  // YouTube Multi-Stream Controller Handlers
  const handleCanvasModeChange = useCallback((mode: StreamCanvasMode) => {
    setStreamCanvasMode(mode);
    saveStreamCanvasMode(mode);
  }, []);

  const handleSavedCardSizeChange = useCallback((size: SavedUrlCardSize) => {
    setSavedCardSize(size);
    saveSavedCardSize(size);
  }, []);

  const handleRegisterPlayer = useCallback(
    (slotId: string, handle: StagePlayerHandle | null) => {
      if (handle) {
        playerHandlesRef.current.set(slotId, handle);
      } else {
        playerHandlesRef.current.delete(slotId);
      }
    },
    []
  );

  const handleSlotStateChange = useCallback((slotId: string, patch: Partial<StageSlot>) => {
    setStageSlots((prev) =>
      prev.map((slot) => (slot.slotId === slotId ? { ...slot, ...patch } : slot))
    );
  }, []);

  const handleReorderStageSlots = useCallback(
    (sourceSlotId: string, targetSlotId: string) => {
      setStageSlots((prev) => {
        const fromIdx = prev.findIndex((s) => s.slotId === sourceSlotId);
        const toIdx = prev.findIndex((s) => s.slotId === targetSlotId);
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        return next;
      });
    },
    []
  );

  const handlePlayAllStreams = useCallback(() => {
    playerHandlesRef.current.forEach((handle) => handle.play());
    setStageSlots((prev) => prev.map((s) => ({ ...s, isPlaying: true })));
  }, []);

  const handlePauseAllStreams = useCallback(() => {
    playerHandlesRef.current.forEach((handle) => handle.pause());
    setStageSlots((prev) => prev.map((s) => ({ ...s, isPlaying: false })));
  }, []);

  const handleMuteAllStreams = useCallback(() => {
    setSoloSlotId(null);
    playerHandlesRef.current.forEach((handle) => handle.mute());
    setStageSlots((prev) => prev.map((s) => ({ ...s, isMuted: true })));
  }, []);

  const handleUnmuteAllStreams = useCallback(() => {
    setSoloSlotId(null);
    playerHandlesRef.current.forEach((handle) => handle.unmute());
    setStageSlots((prev) =>
      prev.map((s) => ({ ...s, isMuted: false, volume: s.volume === 0 ? 50 : s.volume }))
    );
  }, []);

  const handleSyncAllStreams = useCallback(() => {
    playerHandlesRef.current.forEach((handle) => {
      handle.seekTo(0);
      handle.play();
    });
    setStageSlots((prev) => prev.map((s) => ({ ...s, isPlaying: true })));
    showToast('Synchronized all active streams to 0:00');
  }, [showToast]);

  const handleSoloSlot = useCallback((slotId: string) => {
    setSoloSlotId((prevSolo) => {
      if (prevSolo === slotId) {
        return null;
      }
      playerHandlesRef.current.forEach((handle, id) => {
        if (id === slotId) {
          handle.unmute();
        } else {
          handle.mute();
        }
      });
      setStageSlots((prev) =>
        prev.map((s) => ({
          ...s,
          isMuted: s.slotId !== slotId,
          volume: s.slotId === slotId && s.volume === 0 ? 70 : s.volume,
        }))
      );
      return slotId;
    });
  }, []);

  const handleAddSavedToStage = useCallback(
    (video: YouTubeVideoItem) => {
      setStageSlots((prev) => {
        const shouldMute = prev.length > 0;
        return [...prev, createStageSlot(video, shouldMute)];
      });
      showToast(`Added "${video.title}" to Multi-Stream stage`);
    },
    [showToast]
  );

  const handleRemoveFromStage = useCallback((slotId: string) => {
    setSoloSlotId((prev) => (prev === slotId ? null : prev));
    setStageSlots((prev) => prev.filter((s) => s.slotId !== slotId));
  }, []);

  const handleClearStage = useCallback(() => {
    setSoloSlotId(null);
    setStageSlots([]);
  }, []);

  // Resolve and save one or many YouTube URLs
  const resolveAndSaveVideos = useCallback(
    async ({
      rawInput,
      folderId,
      customTitle,
      notes,
      launchToStage,
    }: {
      rawInput: string;
      folderId: string;
      customTitle?: string;
      notes?: string;
      launchToStage: boolean;
    }): Promise<{ addedCount: number; error: string | null }> => {
      const lines = rawInput
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      const extractedIds: string[] = [];
      for (const line of lines) {
        const vid = extractYouTubeVideoId(line);
        if (vid && !extractedIds.includes(vid)) {
          extractedIds.push(vid);
        }
      }

      if (extractedIds.length === 0) {
        return {
          addedCount: 0,
          error:
            'Enter a valid YouTube link (youtube.com/watch?v=..., youtu.be/..., shorts, live) or 11-character video ID.',
        };
      }

      const resolvedItems: YouTubeVideoItem[] = [];
      for (let i = 0; i < extractedIds.length; i += 1) {
        const videoId = extractedIds[i];
        const existing = ytVideos.find((v) => v.videoId === videoId);
        if (existing) {
          resolvedItems.push(existing);
          continue;
        }

        const meta = await fetchYouTubeOEmbed(videoId);
        const item: YouTubeVideoItem = {
          id: createId('yt'),
          videoId,
          url: getYouTubeCanonicalUrl(videoId),
          title:
            extractedIds.length === 1 && customTitle?.trim()
              ? customTitle.trim()
              : meta?.title ?? `YouTube Stream (${videoId})`,
          channel: meta?.channel ?? 'YouTube',
          folderId: folderId || ytFolders[0]?.id || 'fld_ambience',
          notes: notes?.trim() || '',
          addedAt: Date.now() + i,
          isFavorite: false,
          sortOrder: 0,
        };
        resolvedItems.push(item);
      }

      // Persist newly created entries at top of custom order
      const newOnes = resolvedItems.filter(
        (item) => !ytVideos.some((existing) => existing.id === item.id)
      );
      if (newOnes.length > 0) {
        const combined = [...newOnes, ...ytVideos].map((v, idx) => ({
          ...v,
          sortOrder: idx,
        }));
        setYtVideos(combined);
        saveYouTubeVideos(combined);
      }

      if (launchToStage) {
        setStageSlots((prev) => [
          ...prev,
          ...resolvedItems.map((video, idx) =>
            createStageSlot(video, prev.length + idx > 0)
          ),
        ]);
      }

      showToast(
        launchToStage
          ? `Added ${resolvedItems.length} ${resolvedItems.length === 1 ? 'stream' : 'streams'} to stage`
          : `Saved ${newOnes.length || resolvedItems.length} YouTube URL(s)`
      );
      return { addedCount: resolvedItems.length, error: null };
    },
    [ytVideos, ytFolders, showToast]
  );

  const handleQuickAddUrl = useCallback(
    async (rawUrl: string): Promise<string | null> => {
      const res = await resolveAndSaveVideos({
        rawInput: rawUrl,
        folderId: ytFolders[0]?.id ?? 'fld_ambience',
        launchToStage: true,
      });
      return res.error;
    },
    [resolveAndSaveVideos, ytFolders]
  );

  const handleSavePreset = useCallback(
    (name: string) => {
      const preset: MultiStreamPreset = {
        id: createId('pre'),
        name,
        layout: gridLayout,
        videoItemIds: stageSlots.map((s) => s.videoItemId),
        createdAt: Date.now(),
      };
      const next = [preset, ...ytPresets];
      setYtPresets(next);
      saveYouTubePresets(next);
      showToast(`Saved multi-stream layout "${name}"`);
    },
    [gridLayout, stageSlots, ytPresets, showToast]
  );

  const handleLoadPreset = useCallback(
    (preset: MultiStreamPreset) => {
      const videosToMount = preset.videoItemIds
        .map((id) => ytVideos.find((v) => v.id === id))
        .filter((v): v is YouTubeVideoItem => Boolean(v));

      if (videosToMount.length === 0) {
        showToast('No saved videos remain in this preset.');
        return;
      }

      setSoloSlotId(null);
      setGridLayout(preset.layout);
      setStageSlots(videosToMount.map((v, idx) => createStageSlot(v, idx > 0)));
      showToast(`Loaded "${preset.name}" (${videosToMount.length} streams)`);
    },
    [ytVideos, showToast]
  );

  const handleDeletePreset = useCallback(
    (presetId: string) => {
      const next = ytPresets.filter((p) => p.id !== presetId);
      setYtPresets(next);
      saveYouTubePresets(next);
      showToast('Deleted preset');
    },
    [ytPresets, showToast]
  );

  const handleToggleVideoFavorite = useCallback(
    (id: string) => {
      const next = ytVideos.map((v) =>
        v.id === id ? { ...v, isFavorite: !v.isFavorite } : v
      );
      setYtVideos(next);
      saveYouTubeVideos(next);
    },
    [ytVideos]
  );

  const handleUpdateVideo = useCallback(
    (id: string, patch: Partial<YouTubeVideoItem>) => {
      const next = ytVideos.map((v) => (v.id === id ? { ...v, ...patch } : v));
      setYtVideos(next);
      saveYouTubeVideos(next);
      setStageSlots((prev) =>
        prev.map((slot) =>
          slot.videoItemId === id
            ? {
                ...slot,
                title: patch.title ?? slot.title,
                channel: patch.channel ?? slot.channel,
              }
            : slot
        )
      );
      showToast('Updated video details');
    },
    [ytVideos, showToast]
  );

  const handleMoveVideosToFolder = useCallback(
    (videoIds: string[], folderId: string) => {
      const idSet = new Set(videoIds);
      const folderName = ytFolders.find((f) => f.id === folderId)?.name ?? 'Folder';
      const next = ytVideos.map((v) => (idSet.has(v.id) ? { ...v, folderId } : v));
      setYtVideos(next);
      saveYouTubeVideos(next);
      showToast(
        `Moved ${videoIds.length} ${videoIds.length === 1 ? 'video' : 'videos'} to "${folderName}"`
      );
    },
    [ytFolders, ytVideos, showToast]
  );

  const handleAppendVideosToPreset = useCallback(
    (videoIds: string[], presetId: string) => {
      const targetPreset = ytPresets.find((p) => p.id === presetId);
      if (!targetPreset) return;

      const existingSet = new Set(targetPreset.videoItemIds);
      const toAdd = videoIds.filter((id) => !existingSet.has(id));
      if (toAdd.length === 0) {
        showToast(`Already in "${targetPreset.name}"`);
        return;
      }

      const next = ytPresets.map((p) =>
        p.id === presetId
          ? { ...p, videoItemIds: [...p.videoItemIds, ...toAdd] }
          : p
      );
      setYtPresets(next);
      saveYouTubePresets(next);
      showToast(
        `Added ${toAdd.length} ${toAdd.length === 1 ? 'video' : 'videos'} to "${targetPreset.name}"`
      );
    },
    [ytPresets, showToast]
  );

  const handleReorderVideos = useCallback(
    (draggedIds: string[], targetVideoId: string) => {
      const draggedSet = new Set(draggedIds);
      if (draggedSet.has(targetVideoId)) return;

      const sorted = [...ytVideos].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const movingItems = sorted.filter((v) => draggedSet.has(v.id));
      const remaining = sorted.filter((v) => !draggedSet.has(v.id));
      const targetIdx = remaining.findIndex((v) => v.id === targetVideoId);
      if (targetIdx === -1 || movingItems.length === 0) return;

      remaining.splice(targetIdx, 0, ...movingItems);
      const reindexed = remaining.map((v, idx) => ({ ...v, sortOrder: idx }));
      setYtVideos(reindexed);
      saveYouTubeVideos(reindexed);
    },
    [ytVideos]
  );

  const handleDeleteVideo = useCallback(
    (id: string) => {
      const next = ytVideos
        .filter((v) => v.id !== id)
        .map((v, idx) => ({ ...v, sortOrder: idx }));
      setYtVideos(next);
      saveYouTubeVideos(next);
      showToast('Removed YouTube URL from library');
    },
    [ytVideos, showToast]
  );

  const handleCreateFolder = useCallback(
    (name: string) => {
      const folder: YouTubeFolder = {
        id: createId('fld'),
        name,
        createdAt: Date.now(),
      };
      const next = [...ytFolders, folder];
      setYtFolders(next);
      saveYouTubeFolders(next);
      showToast(`Created folder "${name}"`);
    },
    [ytFolders, showToast]
  );

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      const remaining = ytFolders.filter((f) => f.id !== folderId);
      const fallbackId = remaining[0]?.id ?? 'fld_ambience';
      setYtFolders(remaining);
      saveYouTubeFolders(remaining);
      const reassigned = ytVideos.map((v) =>
        v.folderId === folderId ? { ...v, folderId: fallbackId } : v
      );
      setYtVideos(reassigned);
      saveYouTubeVideos(reassigned);
      showToast('Deleted folder');
    },
    [ytFolders, ytVideos, showToast]
  );

  const isVideoContext = activeView === 'multistream' || activeView === 'urls';

  return (
    <div className="min-h-screen bg-[#07090E] text-[#F1F5F9] flex flex-col pb-[76px]">
      {/* Global hidden audio file importer for header primary action */}
      <input
        ref={globalAudioInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.flac,.ogg,.m4a,.aac,.opus"
        className="hidden"
        onChange={async (e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (files.length > 0) {
            await handleImportAudioFiles(files, null);
          }
          e.target.value = '';
        }}
      />

      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#07090E]/92 backdrop-blur-md border-b border-[#1E2638]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element brand wordmark */}
          <button
            type="button"
            onClick={() => setActiveView('audio')}
            className="font-display text-lg font-bold tracking-tight text-slate-100 hover:text-[#06E5F5] transition-colors whitespace-nowrap shrink-0"
          >
            Kurodeck
          </button>

          {/* Zone 2: Clean single-line navigation links */}
          <nav className="flex items-center gap-5 sm:gap-7 overflow-x-auto no-scrollbar">
            {NAV_ITEMS.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`relative py-4 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-[#06E5F5]'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 inset-x-0 h-[2px] bg-[#06E5F5]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single primary action */}
          <div className="flex items-center shrink-0">
            {isVideoContext ? (
              <button
                type="button"
                onClick={() => setShowAddVideoModal(true)}
                className="px-4 py-2 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Add Video URL
              </button>
            ) : (
              <button
                type="button"
                onClick={() => globalAudioInputRef.current?.click()}
                disabled={isImportingAudio}
                className="px-4 py-2 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                {isImportingAudio ? 'Importing...' : 'Import Audio'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Viewport */}
      <main className="flex-1 min-w-0">
        {isVaultLoading && activeView === 'audio' ? (
          <div className="max-w-[1600px] mx-auto p-6 space-y-4">
            <div className="h-36 bg-[#0E121B] border border-[#1E2638] rounded-lg animate-pulse" />
            <div className="h-64 bg-[#0E121B] border border-[#1E2638] rounded-lg animate-pulse" />
          </div>
        ) : activeView === 'audio' ? (
          <AudioVaultView
            tracks={tracks}
            playlists={playlists}
            storageSummary={storageSummary}
            currentTrack={audio.currentTrack}
            isPlaying={audio.isPlaying}
            analyserRef={audio.analyserRef}
            isImporting={isImportingAudio}
            onImportFiles={handleImportAudioFiles}
            onPlayTrack={(id, q) => void audio.playTrack(id, q)}
            onTogglePlayPause={() => void audio.togglePlayPause()}
            onToggleFavorite={(id) => void handleToggleTrackFavorite(id)}
            onAddToQueue={(id) => {
              audio.addToQueue(id);
              showToast('Added track to queue');
            }}
            onUpdateTrack={handleUpdateTrack}
            onDeleteTrack={handleDeleteTrack}
            onDownloadTrack={handleDownloadTrack}
            onCreatePlaylist={handleCreatePlaylist}
            onDeletePlaylist={handleDeletePlaylist}
          />
        ) : activeView === 'multistream' ? (
          <MultiStreamView
            stageSlots={stageSlots}
            gridLayout={gridLayout}
            canvasMode={streamCanvasMode}
            soloSlotId={soloSlotId}
            savedVideos={ytVideos}
            folders={ytFolders}
            presets={ytPresets}
            onGridLayoutChange={setGridLayout}
            onCanvasModeChange={handleCanvasModeChange}
            onQuickAddUrl={handleQuickAddUrl}
            onAddSavedToStage={handleAddSavedToStage}
            onRemoveFromStage={handleRemoveFromStage}
            onReorderSlots={handleReorderStageSlots}
            onClearStage={handleClearStage}
            onSlotStateChange={handleSlotStateChange}
            onRegisterHandle={handleRegisterPlayer}
            onPlayAll={handlePlayAllStreams}
            onPauseAll={handlePauseAllStreams}
            onMuteAll={handleMuteAllStreams}
            onUnmuteAll={handleUnmuteAllStreams}
            onSyncAll={handleSyncAllStreams}
            onSoloSlot={handleSoloSlot}
            onSavePreset={handleSavePreset}
            onLoadPreset={handleLoadPreset}
            onOpenBatchModal={() => setShowAddVideoModal(true)}
          />
        ) : activeView === 'hybrid' ? (
          <HybridDeckView
            tracks={tracks}
            currentTrack={audio.currentTrack}
            isPlaying={audio.isPlaying}
            analyserRef={audio.analyserRef}
            eq={audio.eq}
            stageSlots={stageSlots}
            soloSlotId={soloSlotId}
            presets={ytPresets}
            onPlayTrack={(id, q) => void audio.playTrack(id, q)}
            onTogglePlayPause={() => void audio.togglePlayPause()}
            onEqChange={audio.setEq}
            onRegisterHandle={handleRegisterPlayer}
            onSlotStateChange={handleSlotStateChange}
            onSoloSlot={handleSoloSlot}
            onRemoveFromStage={handleRemoveFromStage}
            onReorderSlots={handleReorderStageSlots}
            onPlayAllStreams={handlePlayAllStreams}
            onPauseAllStreams={handlePauseAllStreams}
            onMuteAllStreams={handleMuteAllStreams}
            onUnmuteAllStreams={handleUnmuteAllStreams}
            onLoadPreset={handleLoadPreset}
            onOpenAddVideoModal={() => setShowAddVideoModal(true)}
          />
        ) : (
          <SavedUrlsView
            videos={ytVideos}
            folders={ytFolders}
            presets={ytPresets}
            cardSize={savedCardSize}
            onCardSizeChange={handleSavedCardSizeChange}
            onOpenAddModal={() => setShowAddVideoModal(true)}
            onAddToStageAndSwitch={(video) => {
              handleAddSavedToStage(video);
              setActiveView('multistream');
            }}
            onLaunchMultiple={(chosen) => {
              setSoloSlotId(null);
              setStageSlots(chosen.map((v, idx) => createStageSlot(v, idx > 0)));
              setActiveView('multistream');
              showToast(`Mounted ${chosen.length} YouTube streams simultaneously`);
            }}
            onToggleFavorite={handleToggleVideoFavorite}
            onUpdateVideo={handleUpdateVideo}
            onMoveVideosToFolder={handleMoveVideosToFolder}
            onAppendVideosToPreset={handleAppendVideosToPreset}
            onReorderVideos={handleReorderVideos}
            onDeleteVideo={handleDeleteVideo}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
            onLoadPresetAndSwitch={(preset) => {
              handleLoadPreset(preset);
              setActiveView('multistream');
            }}
            onDeletePreset={handleDeletePreset}
          />
        )}
      </main>

      {/* Persistent Offline Audio Transport Bar */}
      <AudioTransportBar
        currentTrack={audio.currentTrack}
        tracks={tracks}
        queueIds={audio.queueIds}
        isPlaying={audio.isPlaying}
        isLoadingTrack={audio.isLoadingTrack}
        currentTime={audio.currentTime}
        duration={audio.duration}
        volume={audio.volume}
        isMuted={audio.isMuted}
        playbackRate={audio.playbackRate}
        shuffle={audio.shuffle}
        repeat={audio.repeat}
        eq={audio.eq}
        errorMessage={audio.errorMessage}
        onTogglePlayPause={() => void audio.togglePlayPause()}
        onNext={() => void audio.playNext(false)}
        onPrevious={() => void audio.playPrevious()}
        onSeek={audio.seek}
        onVolumeChange={audio.setVolume}
        onToggleMute={audio.toggleMute}
        onToggleShuffle={() => audio.setShuffle((prev) => !prev)}
        onCycleRepeat={audio.cycleRepeat}
        onCyclePlaybackRate={audio.cyclePlaybackRate}
        onEqChange={audio.setEq}
        onPlayTrack={(id) => void audio.playTrack(id)}
        onRemoveFromQueue={audio.removeFromQueue}
      />

      {/* Add YouTube URL Modal */}
      {showAddVideoModal && (
        <AddVideoModal
          folders={ytFolders}
          onClose={() => setShowAddVideoModal(false)}
          onSubmitUrls={async (payload) => {
            const res = await resolveAndSaveVideos(payload);
            if (!res.error && payload.launchToStage && activeView === 'urls') {
              setActiveView('multistream');
            }
            return res;
          }}
        />
      )}

      {/* Subtle Action Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 right-4 sm:right-6 z-50 px-4 py-2.5 text-xs font-medium text-slate-100 bg-[#131926] border border-[#06E5F5]/45 rounded-md shadow-xl"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
