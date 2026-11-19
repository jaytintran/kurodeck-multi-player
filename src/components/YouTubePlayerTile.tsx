import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  ExternalLink,
  GripVertical,
  Headphones,
  Infinity as InfinityIcon,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import { STREAM_FALLBACK_BACKDROP } from '../lib/synthAudio';
import {
  formatRoleLabel,
  getYouTubeCanonicalUrl,
  getYouTubeThumbnailUrl,
  loadYouTubeIframeApi,
  PLAYBACK_RATES,
  type YTPlayerInstance,
} from '../lib/youtube';
import type { StackViewMode, StagePlayerHandle, StageSlot } from '../types/media';

interface YouTubePlayerTileProps {
  slot: StageSlot;
  viewMode?: StackViewMode;
  isOnline?: boolean;
  volumeMultiplier?: number;
  isExpanded: boolean;
  isSoloed: boolean;
  onRegisterHandle: (slotId: string, handle: StagePlayerHandle | null) => void;
  onSlotStateChange: (slotId: string, patch: Partial<StageSlot>) => void;
  onLoopCompleted?: (videoItemId: string) => void;
  onVideoPlayed?: (videoItemId: string) => void;
  onSolo: (slotId: string) => void;
  onToggleExpand: (slotId: string) => void;
  onRemove: (slotId: string) => void;
  compact?: boolean;
  dense?: boolean;
  draggableEnabled?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStartTile?: (slotId: string, e: DragEvent<HTMLDivElement>) => void;
  onDragOverTile?: (slotId: string, e: DragEvent<HTMLDivElement>) => void;
  onDragLeaveTile?: (slotId: string) => void;
  onDropTile?: (targetSlotId: string, e: DragEvent<HTMLDivElement>) => void;
  onDragEndTile?: () => void;
}

export function YouTubePlayerTile({
  slot,
  viewMode = 'grid',
  isOnline = true,
  volumeMultiplier = 1,
  isExpanded,
  isSoloed,
  onRegisterHandle,
  onSlotStateChange,
  onLoopCompleted,
  onVideoPlayed,
  onSolo,
  onToggleExpand,
  onRemove,
  compact = false,
  dense = false,
  draggableEnabled = false,
  isDragging = false,
  isDragOver = false,
  onDragStartTile,
  onDragOverTile,
  onDragLeaveTile,
  onDropTile,
  onDragEndTile,
}: YouTubePlayerTileProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [handleArmed, setHandleArmed] = useState(false);
  const hasCountedPlayRef = useRef(false);

  // Refs keeping latest slot state accessible inside YT.Player callbacks without remounting
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const volumeMultiplierRef = useRef(volumeMultiplier);
  volumeMultiplierRef.current = volumeMultiplier;
  const onSlotStateChangeRef = useRef(onSlotStateChange);
  onSlotStateChangeRef.current = onSlotStateChange;
  const onLoopCompletedRef = useRef(onLoopCompleted);
  onLoopCompletedRef.current = onLoopCompleted;
  const onVideoPlayedRef = useRef(onVideoPlayed);
  onVideoPlayedRef.current = onVideoPlayed;

  // Mount YouTube IFrame player only when online; unmount cleanly when offline
  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    if (!host) return;

    if (!isOnline) {
      host.innerHTML = '';
      setIsReady(false);
      setEmbedError(null);
      onRegisterHandle(slot.slotId, null);
      return;
    }

    host.innerHTML = '';
    const targetEl = document.createElement('div');
    targetEl.className = 'w-full h-full';
    host.appendChild(targetEl);

    setIsReady(false);
    setEmbedError(null);

    loadYouTubeIframeApi()
      .then((YT) => {
        if (disposed || !targetEl.isConnected) return;

        const player = new YT.Player(targetEl, {
          videoId: slot.videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 0,
            controls: 1,
            enablejsapi: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (disposed) return;
              playerRef.current = event.target;
              const cur = slotRef.current;
              const effVol = Math.max(
                0,
                Math.min(100, Math.round(cur.volume * volumeMultiplierRef.current))
              );
              try {
                event.target.setVolume(effVol);
                event.target.setPlaybackRate(cur.playbackRate || 1);
                if (cur.isMuted || effVol === 0) {
                  event.target.mute();
                } else {
                  event.target.unMute();
                }
              } catch {
                // ignore YT ready quirks
              }
              setIsReady(true);

              onRegisterHandle(slot.slotId, {
                play: () => {
                  try {
                    event.target.playVideo();
                  } catch {
                    // ignore
                  }
                },
                pause: () => {
                  try {
                    event.target.pauseVideo();
                  } catch {
                    // ignore
                  }
                },
                mute: () => {
                  try {
                    event.target.mute();
                  } catch {
                    // ignore
                  }
                },
                unmute: () => {
                  try {
                    event.target.unMute();
                  } catch {
                    // ignore
                  }
                },
                setVolume: (vol: number) => {
                  try {
                    const scaled = Math.max(
                      0,
                      Math.min(100, Math.round(vol * volumeMultiplierRef.current))
                    );
                    event.target.setVolume(scaled);
                    if (scaled > 0 && !slotRef.current.isMuted && event.target.isMuted()) {
                      event.target.unMute();
                    }
                  } catch {
                    // ignore
                  }
                },
                setPlaybackRate: (rate: number) => {
                  try {
                    event.target.setPlaybackRate(rate);
                  } catch {
                    // ignore
                  }
                },
                seekTo: (seconds: number) => {
                  try {
                    event.target.seekTo(seconds, true);
                  } catch {
                    // ignore
                  }
                },
              });
            },
            onStateChange: (event) => {
              if (disposed) return;
              const state = event.data;
              if (state === YT.PlayerState.PLAYING) {
                if (!hasCountedPlayRef.current) {
                  hasCountedPlayRef.current = true;
                  onVideoPlayedRef.current?.(slotRef.current.videoItemId);
                }
                // Re-apply playback rate after buffering/start
                try {
                  event.target.setPlaybackRate(slotRef.current.playbackRate || 1);
                } catch {
                  // ignore
                }
                onSlotStateChangeRef.current(slot.slotId, { isPlaying: true });
              } else if (state === YT.PlayerState.ENDED) {
                const cur = slotRef.current;
                const nextCompleted = cur.completedLoops + 1;
                onLoopCompletedRef.current?.(cur.videoItemId);

                const shouldLoopAgain = cur.infiniteLoop || nextCompleted < cur.targetLoops;
                if (shouldLoopAgain) {
                  onSlotStateChangeRef.current(slot.slotId, {
                    completedLoops: nextCompleted,
                    isPlaying: true,
                  });
                  try {
                    event.target.seekTo(0, true);
                    event.target.playVideo();
                  } catch {
                    // ignore
                  }
                } else {
                  onSlotStateChangeRef.current(slot.slotId, {
                    completedLoops: nextCompleted,
                    isPlaying: false,
                  });
                }
              } else if (state === YT.PlayerState.PAUSED) {
                onSlotStateChangeRef.current(slot.slotId, { isPlaying: false });
              }
            },
            onError: (event) => {
              if (disposed) return;
              const code = event.data;
              if (code === 101 || code === 150) {
                setEmbedError('The creator disabled embedded playback for this video.');
              } else {
                setEmbedError('Stream unavailable or offline. Verify network connection.');
              }
            },
          },
        });

        playerRef.current = player;
      })
      .catch(() => {
        if (!disposed) {
          setEmbedError('YouTube player script could not load. Check internet connectivity.');
        }
      });

    return () => {
      disposed = true;
      onRegisterHandle(slot.slotId, null);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
      if (host) {
        host.innerHTML = '';
      }
    };
  }, [slot.slotId, slot.videoId, isOnline, onRegisterHandle]);

  // Smoothly sync effective volume (personal slider × master fader × crossfade × sleep fade)
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !isReady) return;
    const effectiveVol = Math.max(0, Math.min(100, Math.round(slot.volume * volumeMultiplier)));
    try {
      p.setVolume(effectiveVol);
      if (slot.isMuted || effectiveVol === 0) {
        p.mute();
      } else {
        p.unMute();
      }
    } catch {
      // ignore
    }
  }, [slot.volume, slot.isMuted, volumeMultiplier, isReady]);

  // Sync playback rate live whenever updated
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !isReady) return;
    try {
      p.setPlaybackRate(slot.playbackRate || 1);
    } catch {
      // ignore
    }
  }, [slot.playbackRate, isReady]);

  const handleTogglePlay = () => {
    if (!isOnline) return;
    const p = playerRef.current;
    if (!p) return;
    if (slot.isPlaying) {
      p.pauseVideo();
      onSlotStateChange(slot.slotId, { isPlaying: false });
    } else {
      // If a finite loop count finished, reset completedLoops when user hits Play again
      const shouldResetCompleted = !slot.infiniteLoop && slot.completedLoops >= slot.targetLoops;
      if (shouldResetCompleted) {
        p.seekTo(0, true);
      }
      p.playVideo();
      onSlotStateChange(slot.slotId, {
        isPlaying: true,
        ...(shouldResetCompleted ? { completedLoops: 0 } : {}),
      });
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !slot.isMuted;
    onSlotStateChange(slot.slotId, { isMuted: nextMuted });
  };

  const handleVolumeChange = (nextVol: number) => {
    onSlotStateChange(slot.slotId, { volume: nextVol, isMuted: nextVol === 0 });
  };

  const handlePlaybackRateChange = (rate: number) => {
    onSlotStateChange(slot.slotId, { playbackRate: rate });
  };

  const handleToggleInfiniteLoop = () => {
    onSlotStateChange(slot.slotId, { infiniteLoop: !slot.infiniteLoop });
  };

  const handleTargetLoopsChange = (rawVal: string) => {
    const parsed = parseInt(rawVal, 10);
    const clamped = Number.isFinite(parsed) ? Math.max(1, Math.min(999, parsed)) : 1;
    onSlotStateChange(slot.slotId, { targetLoops: clamped, infiniteLoop: false });
  };

  const effectiveMode: StackViewMode = isExpanded ? 'grid' : viewMode;
  const isMixerStrip = effectiveMode === 'mixer';
  const isMiniTile = effectiveMode === 'mini';
  const useDenseChrome = (dense || isMiniTile) && !isExpanded && !isMixerStrip;
  const roleLabel = formatRoleLabel(slot.role);

  return (
    <div
      draggable={draggableEnabled && handleArmed}
      onDragStart={(e) => {
        if (!draggableEnabled || !handleArmed) {
          e.preventDefault();
          return;
        }
        onDragStartTile?.(slot.slotId, e);
      }}
      onDragOver={(e) => {
        if (!draggableEnabled) return;
        onDragOverTile?.(slot.slotId, e);
      }}
      onDragLeave={() => {
        if (!draggableEnabled) return;
        onDragLeaveTile?.(slot.slotId);
      }}
      onDrop={(e) => {
        if (!draggableEnabled) return;
        setHandleArmed(false);
        onDropTile?.(slot.slotId, e);
      }}
      onDragEnd={() => {
        setHandleArmed(false);
        onDragEndTile?.();
      }}
      className={`group/tile relative bg-[#0E121B] border rounded-lg overflow-hidden transition-all duration-150 ${
        isMixerStrip ? 'flex flex-col sm:flex-row sm:items-center' : 'flex flex-col'
      } ${
        isDragOver
          ? 'border-[#06E5F5] ring-2 ring-[#06E5F5]/50'
          : isSoloed
            ? 'border-[#06E5F5]/70'
            : 'border-[#1E2638] hover:border-[#2C3752]'
      } ${isDragging ? 'opacity-45 scale-[0.99]' : ''} ${isExpanded ? 'col-span-full' : ''}`}
    >
      {/* Top Bar (Hidden in Compact Mixer strip mode since strip has unified inline layout) */}
      {!isMixerStrip && (
        useDenseChrome ? (
          <div className="flex items-center justify-between gap-1.5 px-2 py-1 bg-[#0B0F17] border-b border-[#1E2638]">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {draggableEnabled && (
                <button
                  type="button"
                  title="Drag to reorder"
                  aria-label={`Drag to reorder ${slot.title}`}
                  onMouseEnter={() => setHandleArmed(true)}
                  onMouseLeave={() => {
                    if (!isDragging) setHandleArmed(false);
                  }}
                  onPointerDown={() => setHandleArmed(true)}
                  className="p-0.5 text-slate-500 hover:text-[#06E5F5] cursor-grab active:cursor-grabbing shrink-0 rounded"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleTogglePlay}
                disabled={!isOnline}
                title={slot.isPlaying ? 'Pause' : 'Play'}
                className="p-0.5 text-[#06E5F5] hover:text-[#38EEFF] disabled:opacity-40 shrink-0 rounded"
              >
                {slot.isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={handleToggleMute}
                title={slot.isMuted ? 'Unmute' : 'Mute'}
                className={`p-0.5 shrink-0 rounded ${
                  slot.isMuted ? 'text-amber-400' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {slot.isMuted || slot.volume === 0 ? (
                  <VolumeX className="w-3 h-3" />
                ) : (
                  <Volume2 className="w-3 h-3" />
                )}
              </button>
              <h3 className="text-[11px] font-medium text-slate-200 truncate">{slot.title}</h3>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] font-mono tabular-nums text-slate-500">
                {slot.completedLoops}/{slot.infiniteLoop ? '∞' : slot.targetLoops}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 transition-opacity duration-150">
                <button
                  type="button"
                  onClick={() => onToggleExpand(slot.slotId)}
                  title="Expand video"
                  className="p-1 text-slate-400 hover:text-[#06E5F5] rounded"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(slot.slotId)}
                  title="Remove from stack"
                  className="p-1 text-slate-400 hover:text-[#F43F5E] rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2.5 px-2.5 py-2 bg-[#0B0F17] border-b border-[#1E2638]">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {draggableEnabled && (
                <button
                  type="button"
                  title="Drag to reorder"
                  aria-label={`Drag to reorder ${slot.title}`}
                  onMouseEnter={() => setHandleArmed(true)}
                  onMouseLeave={() => {
                    if (!isDragging) setHandleArmed(false);
                  }}
                  onPointerDown={() => setHandleArmed(true)}
                  className="p-1 text-slate-500 hover:text-[#06E5F5] hover:bg-[#141A29] cursor-grab active:cursor-grabbing rounded transition-colors shrink-0"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-medium text-slate-100 truncate">{slot.title}</h3>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {slot.channel}
                  <span aria-hidden="true" className="mx-1.5 text-slate-600">
                    ·
                  </span>
                  <span className="text-slate-300">{roleLabel}</span>
                  <span aria-hidden="true" className="mx-1.5 text-slate-600">
                    ·
                  </span>
                  <span className="font-mono tabular-nums text-slate-500">
                    {slot.completedLoops}/{slot.infiniteLoop ? '∞' : slot.targetLoops} loops
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <a
                href={getYouTubeCanonicalUrl(slot.videoId)}
                target="_blank"
                rel="noopener noreferrer"
                title="Open on YouTube"
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => onToggleExpand(slot.slotId)}
                title={isExpanded ? 'Exit focus view' : 'Expand video'}
                className="p-1.5 text-slate-400 hover:text-[#06E5F5] rounded transition-colors"
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => onRemove(slot.slotId)}
                title="Remove from stack"
                className="p-1.5 text-slate-400 hover:text-[#F43F5E] rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )
      )}

      {/* Drag Handle on Left for Compact Mixer Strip */}
      {isMixerStrip && draggableEnabled && (
        <button
          type="button"
          title="Drag to reorder"
          aria-label={`Drag to reorder ${slot.title}`}
          onMouseEnter={() => setHandleArmed(true)}
          onMouseLeave={() => {
            if (!isDragging) setHandleArmed(false);
          }}
          onPointerDown={() => setHandleArmed(true)}
          className="hidden sm:flex items-center justify-center self-stretch px-1.5 text-slate-500 hover:text-[#06E5F5] bg-[#0B0F17] border-r border-[#1E2638] cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}

      {/* Persistent 16:9 YouTube Player Stage (never unmounts when switching views!) */}
      <div
        className={`relative bg-[#07090E] overflow-hidden shrink-0 ${
          isMixerStrip
            ? 'w-full sm:w-36 aspect-video sm:border-r border-[#1E2638]'
            : 'w-full aspect-video'
        }`}
      >
        {/* Dedicated detached DOM mount target */}
        <div ref={hostRef} className={isOnline ? 'w-full h-full' : 'hidden'} />

        {/* Offline Cached Thumbnail Card */}
        {!isOnline && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <img
              src={getYouTubeThumbnailUrl(slot.videoId)}
              alt={slot.title}
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.src = STREAM_FALLBACK_BACKDROP;
              }}
              className="w-full h-full object-cover opacity-55"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07090E]/90 via-[#07090E]/45 to-[#07090E]/30" />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
              <WifiOff className={`${isMixerStrip || useDenseChrome ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-amber-400 mb-1`} />
              {!isMixerStrip && !useDenseChrome && (
                <p className="text-[11px] font-medium text-amber-200">
                  Offline — Reconnect to stream
                </p>
              )}
              {(isMixerStrip || useDenseChrome) && (
                <span className="text-[10px] font-medium text-amber-200">Offline</span>
              )}
            </div>
          </div>
        )}

        {/* Drop Overlay Indicator */}
        {isDragOver && (
          <div className="absolute inset-0 bg-[#06E5F5]/15 border-2 border-dashed border-[#06E5F5] pointer-events-none flex items-center justify-center z-20">
            <span className="px-2 py-0.5 text-[11px] font-semibold text-[#07090E] bg-[#06E5F5] rounded">
              Drop here
            </span>
          </div>
        )}

        {isOnline && !isReady && !embedError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07090E]/90 pointer-events-none">
            <div className="w-4 h-4 border-2 border-[#1E2638] border-t-[#06E5F5] rounded-full animate-spin mb-1" />
            {!isMixerStrip && <span className="text-[11px] text-slate-400">Loading...</span>}
          </div>
        )}

        {isOnline && embedError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
            <img
              src={STREAM_FALLBACK_BACKDROP}
              alt="Stream unavailable backdrop"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-25"
            />
            <div className="relative z-10 max-w-xs space-y-1.5">
              <p className="text-[11px] font-medium text-slate-100">{embedError}</p>
              {!isMixerStrip && (
                <a
                  href={getYouTubeCanonicalUrl(slot.videoId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#07090E] bg-[#06E5F5] rounded hover:bg-[#38EEFF]"
                >
                  Open YouTube
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Dense / Mini Hover Mixer Overlay */}
        {useDenseChrome && (
          <div className="absolute inset-x-0 bottom-0 z-10 px-2 py-1.5 bg-[#07090E]/94 border-t border-[#1E2638] flex flex-wrap items-center justify-between gap-1.5 opacity-0 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 transition-opacity duration-150">
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleTogglePlay}
                disabled={!isOnline}
                className="p-1 text-[#06E5F5] bg-[#141A29] hover:bg-[#1C2438] disabled:opacity-40 rounded"
                title={slot.isPlaying ? 'Pause' : 'Play'}
              >
                {slot.isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => onSolo(slot.slotId)}
                title="Solo audio"
                className={`px-1.5 py-0.5 text-[10px] font-medium rounded border transition-colors ${
                  isSoloed
                    ? 'bg-[#06E5F5]/20 text-[#06E5F5] border-[#06E5F5]/50'
                    : 'bg-[#141A29] text-slate-300 border-[#253047] hover:text-slate-100'
                }`}
              >
                Solo
              </button>
              <button
                type="button"
                onClick={handleToggleInfiniteLoop}
                title={slot.infiniteLoop ? 'Infinite loop enabled' : 'Switch to infinite loop'}
                className={`p-1 rounded border ${
                  slot.infiniteLoop
                    ? 'bg-[#06E5F5]/20 text-[#06E5F5] border-[#06E5F5]/50'
                    : 'bg-[#141A29] text-slate-400 border-[#253047]'
                }`}
              >
                <InfinityIcon className="w-3 h-3" />
              </button>
              <input
                type="number"
                min={1}
                max={999}
                value={slot.targetLoops}
                onChange={(e) => handleTargetLoopsChange(e.target.value)}
                title="Custom loop count"
                aria-label={`Loop count for ${slot.title}`}
                className="w-10 px-1 py-0.5 text-[10px] font-mono tabular-nums bg-[#0E121B] border border-[#253047] rounded text-slate-200 focus:outline-none focus:border-[#06E5F5]"
              />
              <select
                value={slot.playbackRate}
                onChange={(e) => handlePlaybackRateChange(Number(e.target.value))}
                aria-label={`Speed for ${slot.title}`}
                className="px-1 py-0.5 text-[10px] font-mono bg-[#0E121B] border border-[#253047] rounded text-slate-200 focus:outline-none focus:border-[#06E5F5]"
              >
                {PLAYBACK_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}×
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
              <button
                type="button"
                onClick={handleToggleMute}
                className={slot.isMuted ? 'text-amber-400' : 'text-slate-300 hover:text-[#06E5F5]'}
                aria-label={slot.isMuted ? 'Unmute' : 'Mute'}
              >
                {slot.isMuted || slot.volume === 0 ? (
                  <VolumeX className="w-3 h-3" />
                ) : (
                  <Volume2 className="w-3 h-3" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={slot.isMuted ? 0 : slot.volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                aria-label={`Volume for ${slot.title}`}
                className="cyber-range w-14"
              />
            </div>
          </div>
        )}
      </div>

      {/* Compact Mixer Horizontal Strip Controls */}
      {isMixerStrip && (
        <div className="flex-1 min-w-0 px-3 py-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-xs font-semibold text-slate-100 truncate">{slot.title}</h3>
            </div>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {slot.channel}
              <span aria-hidden="true" className="mx-1.5 text-slate-600">
                ·
              </span>
              <span className="text-slate-300">{roleLabel}</span>
              <span aria-hidden="true" className="mx-1.5 text-slate-600">
                ·
              </span>
              <span className="font-mono tabular-nums text-[#06E5F5]/90">
                {slot.completedLoops}/{slot.infiniteLoop ? '∞' : slot.targetLoops} loops
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Play / Pause & Solo */}
            <button
              type="button"
              onClick={handleTogglePlay}
              disabled={!isOnline}
              title={slot.isPlaying ? 'Pause' : 'Play'}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-100 bg-[#141A29] hover:bg-[#1C2438] disabled:opacity-40 border border-[#253047] rounded transition-colors"
            >
              {slot.isPlaying ? (
                <Pause className="w-3 h-3 text-[#06E5F5]" />
              ) : (
                <Play className="w-3 h-3 text-[#06E5F5]" />
              )}
              <span>{slot.isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button
              type="button"
              onClick={() => onSolo(slot.slotId)}
              title="Solo this channel"
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors ${
                isSoloed
                  ? 'bg-[#06E5F5]/15 text-[#06E5F5] border-[#06E5F5]/50'
                  : 'bg-[#141A29] text-slate-300 border-[#253047] hover:text-slate-100'
              }`}
            >
              <Headphones className="w-3 h-3" />
              Solo
            </button>

            {/* Loop Controls: Infinite Toggle + Custom Loop Count Box */}
            <div className="flex items-center gap-1 bg-[#07090E] border border-[#1E2638] rounded px-1.5 py-0.5">
              <button
                type="button"
                onClick={handleToggleInfiniteLoop}
                title={slot.infiniteLoop ? 'Infinite loop ON (click for custom count)' : 'Switch to infinite loop'}
                className={`p-1 rounded transition-colors ${
                  slot.infiniteLoop
                    ? 'bg-[#06E5F5]/20 text-[#06E5F5]'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <InfinityIcon className="w-3.5 h-3.5" />
              </button>
              <Repeat className="w-3 h-3 text-slate-500 ml-0.5" />
              <input
                type="number"
                min={1}
                max={999}
                value={slot.targetLoops}
                onChange={(e) => handleTargetLoopsChange(e.target.value)}
                title="Custom loop count (disables infinite loop when edited)"
                aria-label={`Custom loop count for ${slot.title}`}
                className={`w-11 px-1 py-0.5 text-[11px] font-mono tabular-nums bg-transparent text-right focus:outline-none ${
                  slot.infiniteLoop ? 'text-slate-500' : 'text-[#06E5F5] font-medium'
                }`}
              />
            </div>

            {/* Playback Speed */}
            <select
              value={slot.playbackRate}
              onChange={(e) => handlePlaybackRateChange(Number(e.target.value))}
              aria-label={`Playback speed for ${slot.title}`}
              title="Playback speed"
              className="px-2 py-1 text-xs font-mono tabular-nums bg-[#07090E] border border-[#253047] rounded text-slate-200 focus:outline-none focus:border-[#06E5F5]"
            >
              {PLAYBACK_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}×
                </option>
              ))}
            </select>

            {/* Volume + Mute */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={slot.isMuted ? 'Unmute' : 'Mute'}
                className={`p-1 rounded transition-colors ${
                  slot.isMuted ? 'text-amber-400 hover:text-amber-300' : 'text-slate-300 hover:text-[#06E5F5]'
                }`}
              >
                {slot.isMuted || slot.volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={slot.isMuted ? 0 : slot.volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                aria-label={`Volume for ${slot.title}`}
                className="cyber-range w-24"
              />
              <span className="text-[11px] font-mono tabular-nums text-slate-400 w-8 text-right">
                {slot.isMuted ? '0%' : `${slot.volume}%`}
              </span>
            </div>

            {/* Expand / YouTube / Remove */}
            <div className="flex items-center gap-0.5 pl-1 border-l border-[#1E2638]">
              <button
                type="button"
                onClick={() => onToggleExpand(slot.slotId)}
                title="Expand video"
                className="p-1 text-slate-400 hover:text-[#06E5F5] rounded"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <a
                href={getYouTubeCanonicalUrl(slot.videoId)}
                target="_blank"
                rel="noopener noreferrer"
                title="Open on YouTube"
                className="p-1 text-slate-400 hover:text-slate-100 rounded"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => onRemove(slot.slotId)}
                title="Remove from stack"
                className="p-1 text-slate-400 hover:text-[#F43F5E] rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standard Grid Independent Mixer Footer */}
      {!isMixerStrip && !useDenseChrome && (
        <div className="px-2.5 py-2 bg-[#0B0F17] border-t border-[#1E2638] space-y-2">
          {/* Row 1: Play, Solo, Volume */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleTogglePlay}
                disabled={!isOnline}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-100 bg-[#141A29] hover:bg-[#1C2438] disabled:opacity-40 border border-[#253047] rounded transition-colors whitespace-nowrap shrink-0"
              >
                {slot.isPlaying ? (
                  <Pause className="w-3 h-3 text-[#06E5F5]" />
                ) : (
                  <Play className="w-3 h-3 text-[#06E5F5]" />
                )}
                {!compact && <span>{slot.isPlaying ? 'Pause' : 'Play'}</span>}
              </button>

              <button
                type="button"
                onClick={() => onSolo(slot.slotId)}
                title="Solo this channel (mutes others)"
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
                  isSoloed
                    ? 'bg-[#06E5F5]/15 text-[#06E5F5] border-[#06E5F5]/50'
                    : 'bg-[#141A29] text-slate-300 border-[#253047] hover:text-slate-100'
                }`}
              >
                <Headphones className="w-3 h-3" />
                <span>Solo</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={slot.isMuted ? 'Unmute' : 'Mute'}
                className={`p-1 rounded transition-colors ${
                  slot.isMuted ? 'text-amber-400 hover:text-amber-300' : 'text-slate-300 hover:text-[#06E5F5]'
                }`}
              >
                {slot.isMuted || slot.volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={slot.isMuted ? 0 : slot.volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                aria-label={`Volume for ${slot.title}`}
                className="cyber-range w-20 sm:w-24"
              />
              <span className="text-[11px] font-mono tabular-nums text-slate-400 w-8 text-right">
                {slot.isMuted ? '0%' : `${slot.volume}%`}
              </span>
            </div>
          </div>

          {/* Row 2: Loop Infinite Toggle + Custom Loop Count + Speed */}
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#161D2E]">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleInfiniteLoop}
                title={slot.infiniteLoop ? 'Infinite loop enabled' : 'Enable infinite loop'}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border transition-colors ${
                  slot.infiniteLoop
                    ? 'bg-[#06E5F5]/15 text-[#06E5F5] border-[#06E5F5]/50'
                    : 'bg-[#141A29] text-slate-400 border-[#253047] hover:text-slate-100'
                }`}
              >
                <InfinityIcon className="w-3 h-3" />
                <span>Loop</span>
              </button>

              <div className="flex items-center gap-1 bg-[#07090E] border border-[#1E2638] rounded px-1.5 py-0.5">
                <span className="text-[10px] text-slate-500">Count</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={slot.targetLoops}
                  onChange={(e) => handleTargetLoopsChange(e.target.value)}
                  aria-label={`Custom loop count for ${slot.title}`}
                  className={`w-10 text-[11px] font-mono tabular-nums bg-transparent text-right focus:outline-none ${
                    slot.infiniteLoop ? 'text-slate-500' : 'text-[#06E5F5] font-semibold'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500">Speed</span>
              <select
                value={slot.playbackRate}
                onChange={(e) => handlePlaybackRateChange(Number(e.target.value))}
                aria-label={`Playback speed for ${slot.title}`}
                className="px-1.5 py-0.5 text-[11px] font-mono tabular-nums bg-[#07090E] border border-[#253047] rounded text-slate-200 focus:outline-none focus:border-[#06E5F5]"
              >
                {PLAYBACK_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}×
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
