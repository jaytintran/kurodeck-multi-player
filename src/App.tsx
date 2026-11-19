/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddVideoModal } from './components/AddVideoModal';
import { AudioTransportBar } from './components/AudioTransportBar';
import { AudioVaultView } from './components/AudioVaultView';
import { HybridDeckView } from './components/HybridDeckView';
import { KurodeckLogo } from './components/KurodeckLogo';
import { MultiStreamView } from './components/MultiStreamView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SavedUrlsView } from './components/SavedUrlsView';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useOfflineBootstrap } from './hooks/useOfflineBootstrap';
import { useOnlineStatus } from './hooks/useOnlineStatus';
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
  exportKurodeckBackupJson,
  extractYouTubeVideoId,
  fetchYouTubeOEmbed,
  getYouTubeCanonicalUrl,
  loadActiveView,
  loadGridLayout,
  loadHybridCrossfade,
  loadMasterStackVolume,
  loadPersistedStageSlots,
  loadSavedCardSize,
  loadSavedYouTubeState,
  loadStackViewMode,
  loadStreamCanvasMode,
  normalizeTopics,
  parseKurodeckBackupJson,
  saveActiveView,
  saveGridLayout,
  saveHybridCrossfade,
  saveMasterStackVolume,
  savePersistedStageSlots,
  saveSavedCardSize,
  saveStackViewMode,
  saveStreamCanvasMode,
  saveYouTubeFolders,
  saveYouTubePresets,
  saveYouTubeVideos,
} from './lib/youtube';
import type {
  AudioPlaylist,
  AudioTrackMeta,
  MultiStreamPreset,
  PresetRoutine,
  PresetSlotConfig,
  SavedUrlCardSize,
  StackViewMode,
  StagePlayerHandle,
  StageSlot,
  StorageSummary,
  StreamCanvasMode,
  StreamGridLayout,
  SubliminalRole,
  WorkspaceView,
  YouTubeFolder,
  YouTubeVideoItem,
} from './types/media';

const NAV_ITEMS: Array<{ id: WorkspaceView; label: string }> = [
  { id: 'audio', label: 'Audio Vault' },
  { id: 'multistream', label: 'Stack Mixer' },
  { id: 'hybrid', label: 'Hybrid Deck' },
  { id: 'urls', label: 'Library' },
];

function createStageSlot(
  video: YouTubeVideoItem,
  mutedByDefault: boolean,
  override?: Partial<PresetSlotConfig>
): StageSlot {
  return {
    slotId: createId('slot'),
    videoItemId: video.id,
    videoId: video.videoId,
    title: video.title,
    channel: video.channel,
    url: video.url,
    role: video.role ?? 'subliminal',
    volume: override?.volume ?? (mutedByDefault ? 30 : 45),
    isMuted: override?.isMuted ?? mutedByDefault,
    isPlaying: false,
    playbackRate: override?.playbackRate ?? 1,
    infiniteLoop: override?.infiniteLoop ?? true,
    targetLoops: override?.targetLoops ?? 10,
    completedLoops: 0,
  };
}

export default function App() {
  const isOnline = useOnlineStatus();

  const [activeView, setActiveView] = useState<WorkspaceView>(() => loadActiveView());

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

  // Subliminal Stack Mixer & Library state
  const [ytVideos, setYtVideos] = useState<YouTubeVideoItem[]>([]);
  const [ytFolders, setYtFolders] = useState<YouTubeFolder[]>([]);
  const [ytPresets, setYtPresets] = useState<MultiStreamPreset[]>([]);
  const [stageSlots, setStageSlots] = useState<StageSlot[]>([]);
  const [stageHydrated, setStageHydrated] = useState(false);
  const [stackViewMode, setStackViewMode] = useState<StackViewMode>(() => loadStackViewMode());
  const [gridLayout, setGridLayout] = useState<StreamGridLayout>(() => loadGridLayout());
  const [streamCanvasMode, setStreamCanvasMode] = useState<StreamCanvasMode>(() =>
    loadStreamCanvasMode()
  );
  const [savedCardSize, setSavedCardSize] = useState<SavedUrlCardSize>(() =>
    loadSavedCardSize()
  );
  const [masterStackVolume, setMasterStackVolume] = useState<number>(() =>
    loadMasterStackVolume()
  );
  const [hybridCrossfade, setHybridCrossfade] = useState<number>(() => loadHybridCrossfade());
  const [soloSlotId, setSoloSlotId] = useState<string | null>(null);
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);

  // Sleep Timer state (countdown seconds; final 30s gently fade to 0 -> Stop All)
  const [sleepSecondsLeft, setSleepSecondsLeft] = useState<number | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const globalAudioInputRef = useRef<HTMLInputElement | null>(null);
  const playerHandlesRef = useRef<Map<string, StagePlayerHandle>>(new Map());
  const stageSlotsRef = useRef<StageSlot[]>(stageSlots);
  stageSlotsRef.current = stageSlots;

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3400);
  }, []);

  // Remember active tab across desktop PWA launches
  const handleSelectView = useCallback((view: WorkspaceView) => {
    setActiveView(view);
    saveActiveView(view);
  }, []);

  // Single-visit offline PWA bootstrap (persistent storage + font & thumbnail warmup)
  useOfflineBootstrap({
    videos: ytVideos,
    isOnline,
    onOfflineReady: showToast,
  });

  // Compute Hybrid Crossfade gains (equal-headroom DJ crossfade: 50 = 100%/100%)
  const audioCrossfadeGain = useMemo(
    () => (hybridCrossfade <= 50 ? 1 : Math.max(0, (100 - hybridCrossfade) / 50)),
    [hybridCrossfade]
  );
  const stackCrossfadeGain = useMemo(
    () => (hybridCrossfade >= 50 ? 1 : Math.max(0, hybridCrossfade / 50)),
    [hybridCrossfade]
  );

  // Sleep fade multiplier: gentle linear ramp down over the final 30 seconds
  const sleepFadeMultiplier = useMemo(() => {
    if (sleepSecondsLeft === null) return 1;
    if (sleepSecondsLeft <= 30) return Math.max(0, sleepSecondsLeft / 30);
    return 1;
  }, [sleepSecondsLeft]);

  const isSleepFading = sleepSecondsLeft !== null && sleepSecondsLeft <= 30;

  const effectiveAudioMultiplier = audioCrossfadeGain * sleepFadeMultiplier;
  const effectiveYtMultiplier =
    (masterStackVolume / 100) * stackCrossfadeGain * sleepFadeMultiplier;

  // Load IndexedDB Offline Audio Vault + Saved Subliminal Library on mount
  useEffect(() => {
    let active = true;

    const ytState = loadSavedYouTubeState();
    setYtVideos(ytState.videos);
    setYtFolders(ytState.folders);
    setYtPresets(ytState.presets);

    const persistedSlots = loadPersistedStageSlots();
    if (persistedSlots !== null) {
      setStageSlots(persistedSlots);
    } else {
      const initialStreams = ytState.videos.slice(0, 2);
      setStageSlots(initialStreams.map((video, idx) => createStageSlot(video, idx > 0)));
    }
    setStageHydrated(true);

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

  // Persist active stage slots so offline relaunches restore exact stack layout & mix
  useEffect(() => {
    if (!stageHydrated) return;
    savePersistedStageSlots(stageSlots);
  }, [stageSlots, stageHydrated]);

  // Refresh storage metrics when track list changes
  useEffect(() => {
    if (isVaultLoading) return;
    void getStorageSummary(tracks).then(setStorageSummary);
  }, [tracks, isVaultLoading]);

  // Auto-resolve any URLs saved while offline once connectivity returns
  useEffect(() => {
    if (!isOnline || ytVideos.length === 0) return;
    const pending = ytVideos.filter((v) => v.pendingMetadata);
    if (pending.length === 0) return;

    let cancelled = false;
    const syncPending = async () => {
      const updates = new Map<string, { title: string; channel: string }>();
      for (const item of pending) {
        const meta = await fetchYouTubeOEmbed(item.videoId);
        if (cancelled) return;
        if (meta) {
          updates.set(item.id, meta);
        }
      }
      if (updates.size === 0 || cancelled) return;

      setYtVideos((prev) => {
        const next = prev.map((v) => {
          const hit = updates.get(v.id);
          if (!hit) return v;
          return {
            ...v,
            title: v.title.startsWith('YouTube Video (') ? hit.title : v.title,
            channel: hit.channel,
            pendingMetadata: false,
          };
        });
        saveYouTubeVideos(next);
        return next;
      });
      setStageSlots((prev) =>
        prev.map((slot) => {
          const hit = updates.get(slot.videoItemId);
          if (!hit) return slot;
          return {
            ...slot,
            title: slot.title.startsWith('YouTube Video (') ? hit.title : slot.title,
            channel: hit.channel,
          };
        })
      );
      showToast(`Synced metadata for ${updates.size} offline-saved URL(s)`);
    };

    void syncPending();
    return () => {
      cancelled = true;
    };
  }, [isOnline, ytVideos, showToast]);

  // Increment offline audio track play count
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
    externalGainMultiplier: effectiveAudioMultiplier,
  });

  // Sleep Timer countdown interval -> Stop All when reaching 0
  useEffect(() => {
    if (sleepSecondsLeft === null) return;
    if (sleepSecondsLeft <= 0) {
      audio.pause();
      playerHandlesRef.current.forEach((handle) => handle.pause());
      setStageSlots((prev) => prev.map((s) => ({ ...s, isPlaying: false })));
      setSleepSecondsLeft(null);
      showToast('Sleep timer finished — all playback stopped');
      return;
    }

    const timer = window.setTimeout(() => {
      setSleepSecondsLeft((prev) => (prev !== null ? Math.max(0, prev - 1) : null));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [sleepSecondsLeft, audio, showToast]);

  // Track listening minutes (every 5 seconds for all currently playing YouTube subliminals)
  useEffect(() => {
    const interval = window.setInterval(() => {
      const playingIds = Array.from(
        new Set(stageSlotsRef.current.filter((s) => s.isPlaying).map((s) => s.videoItemId))
      );
      if (playingIds.length === 0) return;

      const playingSet = new Set(playingIds);
      const now = Date.now();
      setYtVideos((prev) => {
        const next = prev.map((v) =>
          playingSet.has(v.id)
            ? {
                ...v,
                listeningSeconds: (v.listeningSeconds || 0) + 5,
                lastListenedAt: now,
              }
            : v
        );
        saveYouTubeVideos(next);
        return next;
      });
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  // Listening stats callbacks for YouTubePlayerTile
  const handleVideoLoopCompleted = useCallback((videoItemId: string) => {
    const now = Date.now();
    setYtVideos((prev) => {
      const next = prev.map((v) =>
        v.id === videoItemId
          ? { ...v, loopCount: (v.loopCount || 0) + 1, lastListenedAt: now }
          : v
      );
      saveYouTubeVideos(next);
      return next;
    });
  }, []);

  const handleVideoPlayed = useCallback((videoItemId: string) => {
    const now = Date.now();
    setYtVideos((prev) => {
      const next = prev.map((v) =>
        v.id === videoItemId
          ? { ...v, playCount: (v.playCount || 0) + 1, lastListenedAt: now }
          : v
      );
      saveYouTubeVideos(next);
      return next;
    });
  }, []);

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

  // Stack Mixer Controller Handlers
  const handleViewModeChange = useCallback((mode: StackViewMode) => {
    setStackViewMode(mode);
    saveStackViewMode(mode);
  }, []);

  const handleGridLayoutChange = useCallback((layout: StreamGridLayout) => {
    setGridLayout(layout);
    saveGridLayout(layout);
  }, []);

  const handleCanvasModeChange = useCallback((mode: StreamCanvasMode) => {
    setStreamCanvasMode(mode);
    saveStreamCanvasMode(mode);
  }, []);

  const handleSavedCardSizeChange = useCallback((size: SavedUrlCardSize) => {
    setSavedCardSize(size);
    saveSavedCardSize(size);
  }, []);

  const handleMasterStackVolumeChange = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(vol)));
    setMasterStackVolume(clamped);
    saveMasterStackVolume(clamped);
  }, []);

  const handleHybridCrossfadeChange = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(val)));
    setHybridCrossfade(clamped);
    saveHybridCrossfade(clamped);
  }, []);

  const handleApplyQuietLayer = useCallback(() => {
    setSoloSlotId(null);
    setStageSlots((prev) => prev.map((s) => ({ ...s, volume: 18, isMuted: false })));
    showToast('Set all stacked channels to Quiet Layer (18%)');
  }, [showToast]);

  const handleApplyBalanceAll = useCallback(() => {
    setSoloSlotId(null);
    setStageSlots((prev) => prev.map((s) => ({ ...s, volume: 45, isMuted: false })));
    showToast('Balanced all stacked channels to 45%');
  }, [showToast]);

  const handleStartSleepTimer = useCallback(
    (minutes: number) => {
      setSleepSecondsLeft(minutes * 60);
      showToast(`Sleep timer set for ${minutes} min (30s gentle fade-out)`);
    },
    [showToast]
  );

  const handleCancelSleepTimer = useCallback(() => {
    setSleepSecondsLeft(null);
    showToast('Sleep timer cancelled');
  }, [showToast]);

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
    setStageSlots((prev) =>
      prev.map((s) => ({
        ...s,
        isPlaying: true,
        completedLoops: !s.infiniteLoop && s.completedLoops >= s.targetLoops ? 0 : s.completedLoops,
      }))
    );
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
      prev.map((s) => ({ ...s, isMuted: false, volume: s.volume === 0 ? 40 : s.volume }))
    );
  }, []);

  const handleSyncAllStreams = useCallback(() => {
    playerHandlesRef.current.forEach((handle) => {
      handle.seekTo(0);
      handle.play();
    });
    setStageSlots((prev) => prev.map((s) => ({ ...s, isPlaying: true, completedLoops: 0 })));
    showToast('Synchronized all stacked channels to 0:00');
  }, [showToast]);

  const handleSoloSlot = useCallback((slotId: string) => {
    setSoloSlotId((prevSolo) => {
      if (prevSolo === slotId) {
        setStageSlots((prev) => prev.map((s) => ({ ...s, isMuted: false })));
        return null;
      }
      setStageSlots((prev) =>
        prev.map((s) => ({
          ...s,
          isMuted: s.slotId !== slotId,
          volume: s.slotId === slotId && s.volume === 0 ? 60 : s.volume,
        }))
      );
      return slotId;
    });
  }, []);

  const handleAddSavedToStage = useCallback(
    (video: YouTubeVideoItem) => {
      setStageSlots((prev) => [...prev, createStageSlot(video, false)]);
      showToast(`Added "${video.title}" to Stack Mixer`);
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

  // Resolve and save one or many YouTube subliminal URLs (works online & offline)
  const resolveAndSaveVideos = useCallback(
    async ({
      rawInput,
      folderId,
      role = 'subliminal',
      topics = [],
      customTitle,
      benefits,
      launchToStage,
    }: {
      rawInput: string;
      folderId: string;
      role?: SubliminalRole;
      topics?: string[];
      customTitle?: string;
      benefits?: string;
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
            'Enter a valid YouTube link (youtube.com/watch?v=..., youtu.be/..., shorts) or 11-character video ID.',
        };
      }

      const cleanTopics = normalizeTopics(topics);
      const cleanBenefits = benefits?.trim() || '';

      const resolvedItems: YouTubeVideoItem[] = [];
      for (let i = 0; i < extractedIds.length; i += 1) {
        const videoId = extractedIds[i];
        const existing = ytVideos.find((v) => v.videoId === videoId);
        if (existing) {
          resolvedItems.push(existing);
          continue;
        }

        const meta = isOnline ? await fetchYouTubeOEmbed(videoId) : null;
        const item: YouTubeVideoItem = {
          id: createId('yt'),
          videoId,
          url: getYouTubeCanonicalUrl(videoId),
          title:
            extractedIds.length === 1 && customTitle?.trim()
              ? customTitle.trim()
              : meta?.title ?? `YouTube Video (${videoId})`,
          channel: meta?.channel ?? (isOnline ? 'YouTube' : 'Offline — Pending Sync'),
          folderId: folderId || ytFolders[0]?.id || 'fld_focus',
          notes: cleanBenefits,
          role,
          topics: cleanTopics,
          benefits: cleanBenefits,
          playCount: 0,
          loopCount: 0,
          listeningSeconds: 0,
          pendingMetadata: !meta,
          addedAt: Date.now() + i,
          isFavorite: false,
          sortOrder: 0,
        };
        resolvedItems.push(item);
      }

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
          ...resolvedItems.map((video) => createStageSlot(video, false)),
        ]);
      }

      showToast(
        launchToStage
          ? `Added ${resolvedItems.length} ${resolvedItems.length === 1 ? 'track' : 'tracks'} to Stack Mixer`
          : `Saved ${newOnes.length || resolvedItems.length} subliminal URL(s)`
      );
      return { addedCount: resolvedItems.length, error: null };
    },
    [ytVideos, ytFolders, isOnline, showToast]
  );

  const handleQuickAddUrl = useCallback(
    async (rawUrl: string): Promise<string | null> => {
      const res = await resolveAndSaveVideos({
        rawInput: rawUrl,
        folderId: ytFolders[0]?.id ?? 'fld_focus',
        launchToStage: true,
      });
      return res.error;
    },
    [resolveAndSaveVideos, ytFolders]
  );

  const handleSavePreset = useCallback(
    (name: string, routine: PresetRoutine) => {
      const slotConfigs: PresetSlotConfig[] = stageSlots.map((s) => ({
        videoItemId: s.videoItemId,
        volume: s.volume,
        isMuted: s.isMuted,
        playbackRate: s.playbackRate,
        infiniteLoop: s.infiniteLoop,
        targetLoops: s.targetLoops,
      }));
      const preset: MultiStreamPreset = {
        id: createId('pre'),
        name,
        routine,
        layout: gridLayout,
        viewMode: stackViewMode,
        videoItemIds: stageSlots.map((s) => s.videoItemId),
        slotConfigs,
        createdAt: Date.now(),
      };
      const next = [preset, ...ytPresets];
      setYtPresets(next);
      saveYouTubePresets(next);
      showToast(`Saved ${routine} stack "${name}"`);
    },
    [gridLayout, stackViewMode, stageSlots, ytPresets, showToast]
  );

  const handleLoadPreset = useCallback(
    (preset: MultiStreamPreset) => {
      const nextSlots: StageSlot[] = [];

      if (preset.slotConfigs && preset.slotConfigs.length > 0) {
        for (const cfg of preset.slotConfigs) {
          const video = ytVideos.find((v) => v.id === cfg.videoItemId);
          if (video) {
            nextSlots.push(createStageSlot(video, cfg.isMuted, cfg));
          }
        }
      } else {
        preset.videoItemIds.forEach((id) => {
          const video = ytVideos.find((v) => v.id === id);
          if (video) {
            nextSlots.push(createStageSlot(video, false));
          }
        });
      }

      if (nextSlots.length === 0) {
        showToast('No saved tracks remain in this stack preset.');
        return;
      }

      setSoloSlotId(null);
      handleGridLayoutChange(preset.layout);
      if (preset.viewMode) {
        handleViewModeChange(preset.viewMode);
      }
      setStageSlots(nextSlots);
      showToast(`Loaded "${preset.name}" (${nextSlots.length} tracks)`);
    },
    [ytVideos, handleGridLayoutChange, handleViewModeChange, showToast]
  );

  const handleDeletePreset = useCallback(
    (presetId: string) => {
      const next = ytPresets.filter((p) => p.id !== presetId);
      setYtPresets(next);
      saveYouTubePresets(next);
      showToast('Deleted stack preset');
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
                role: patch.role ?? slot.role,
              }
            : slot
        )
      );
      showToast('Updated library details');
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
        `Moved ${videoIds.length} ${videoIds.length === 1 ? 'item' : 'items'} to "${folderName}"`
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

      const addedConfigs: PresetSlotConfig[] = toAdd.map((videoItemId) => ({
        videoItemId,
        volume: 35,
        isMuted: false,
        playbackRate: 1,
        infiniteLoop: true,
        targetLoops: 10,
      }));

      const next = ytPresets.map((p) =>
        p.id === presetId
          ? {
              ...p,
              videoItemIds: [...p.videoItemIds, ...toAdd],
              slotConfigs: p.slotConfigs ? [...p.slotConfigs, ...addedConfigs] : undefined,
            }
          : p
      );
      setYtPresets(next);
      saveYouTubePresets(next);
      showToast(
        `Added ${toAdd.length} ${toAdd.length === 1 ? 'item' : 'items'} to "${targetPreset.name}"`
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
      showToast('Removed entry from library');
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
      const fallbackId = remaining[0]?.id ?? 'fld_focus';
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

  // JSON Export & Import Backup
  const handleExportBackup = useCallback(() => {
    const json = exportKurodeckBackupJson({
      videos: ytVideos,
      folders: ytFolders,
      presets: ytPresets,
    });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `kurodeck-backup-${dateStamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Exported backup (${ytVideos.length} items, ${ytPresets.length} stacks)`);
  }, [ytVideos, ytFolders, ytPresets, showToast]);

  const handleImportBackup = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const restored = parseKurodeckBackupJson(text);
        setYtFolders(restored.folders);
        setYtVideos(restored.videos);
        setYtPresets(restored.presets);
        saveYouTubeFolders(restored.folders);
        saveYouTubeVideos(restored.videos);
        saveYouTubePresets(restored.presets);
        showToast(
          `Restored ${restored.videos.length} items & ${restored.presets.length} routine stacks`
        );
      } catch {
        showToast('Invalid JSON backup file. Please select a valid Kurodeck backup.');
      }
    },
    [showToast]
  );

  const existingTopics = useMemo(() => {
    const all: string[] = [];
    for (const v of ytVideos) {
      all.push(...v.topics);
    }
    return normalizeTopics(all);
  }, [ytVideos]);

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
          {/* Zone 1: Brand mark + wordmark */}
          <button
            type="button"
            onClick={() => handleSelectView('audio')}
            className="inline-flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-slate-100 hover:text-[#06E5F5] transition-colors whitespace-nowrap shrink-0"
          >
            <KurodeckLogo className="w-7 h-7 shrink-0" />
            <span>Kurodeck</span>
          </button>

          {/* Zone 2: Clean single-line navigation links */}
          <nav className="flex items-center gap-5 sm:gap-7 overflow-x-auto no-scrollbar">
            {NAV_ITEMS.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectView(item.id)}
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
                Add Subliminal
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
            viewMode={stackViewMode}
            gridLayout={gridLayout}
            canvasMode={streamCanvasMode}
            masterStackVolume={masterStackVolume}
            effectiveYtMultiplier={effectiveYtMultiplier}
            sleepSecondsLeft={sleepSecondsLeft}
            isSleepFading={isSleepFading}
            isOnline={isOnline}
            soloSlotId={soloSlotId}
            savedVideos={ytVideos}
            folders={ytFolders}
            presets={ytPresets}
            onViewModeChange={handleViewModeChange}
            onGridLayoutChange={handleGridLayoutChange}
            onCanvasModeChange={handleCanvasModeChange}
            onMasterStackVolumeChange={handleMasterStackVolumeChange}
            onApplyQuietLayer={handleApplyQuietLayer}
            onApplyBalanceAll={handleApplyBalanceAll}
            onStartSleepTimer={handleStartSleepTimer}
            onCancelSleepTimer={handleCancelSleepTimer}
            onQuickAddUrl={handleQuickAddUrl}
            onAddSavedToStage={handleAddSavedToStage}
            onRemoveFromStage={handleRemoveFromStage}
            onReorderSlots={handleReorderStageSlots}
            onClearStage={handleClearStage}
            onSlotStateChange={handleSlotStateChange}
            onLoopCompleted={handleVideoLoopCompleted}
            onVideoPlayed={handleVideoPlayed}
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
            hybridCrossfade={hybridCrossfade}
            audioCrossfadePct={Math.round(audioCrossfadeGain * 100)}
            stackCrossfadePct={Math.round(stackCrossfadeGain * 100)}
            effectiveYtMultiplier={effectiveYtMultiplier}
            sleepSecondsLeft={sleepSecondsLeft}
            isSleepFading={isSleepFading}
            isOnline={isOnline}
            onHybridCrossfadeChange={handleHybridCrossfadeChange}
            onPlayTrack={(id, q) => void audio.playTrack(id, q)}
            onTogglePlayPause={() => void audio.togglePlayPause()}
            onEqChange={audio.setEq}
            onRegisterHandle={handleRegisterPlayer}
            onSlotStateChange={handleSlotStateChange}
            onLoopCompleted={handleVideoLoopCompleted}
            onVideoPlayed={handleVideoPlayed}
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
              handleSelectView('multistream');
            }}
            onLaunchMultiple={(chosen) => {
              setSoloSlotId(null);
              setStageSlots(chosen.map((v) => createStageSlot(v, false)));
              handleSelectView('multistream');
              showToast(`Loaded ${chosen.length} subliminals into Stack Mixer`);
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
              handleSelectView('multistream');
            }}
            onDeletePreset={handleDeletePreset}
            onExportBackup={handleExportBackup}
            onImportBackup={(file) => void handleImportBackup(file)}
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

      {/* Batch Add Subliminal URL Modal */}
      {showAddVideoModal && (
        <AddVideoModal
          folders={ytFolders}
          existingTopics={existingTopics}
          isOnline={isOnline}
          onClose={() => setShowAddVideoModal(false)}
          onSubmitUrls={async (payload) => {
            const res = await resolveAndSaveVideos(payload);
            if (!res.error && payload.launchToStage && activeView === 'urls') {
              handleSelectView('multistream');
            }
            return res;
          }}
        />
      )}

      {/* Live Offline Mode Indicator */}
      <OfflineIndicator />

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
