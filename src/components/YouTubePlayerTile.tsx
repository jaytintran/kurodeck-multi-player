import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  ExternalLink,
  GripVertical,
  Headphones,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { STREAM_FALLBACK_BACKDROP } from '../lib/synthAudio';
import {
  getYouTubeCanonicalUrl,
  loadYouTubeIframeApi,
  type YTPlayerInstance,
} from '../lib/youtube';
import type { StagePlayerHandle, StageSlot } from '../types/media';

interface YouTubePlayerTileProps {
  slot: StageSlot;
  isExpanded: boolean;
  isSoloed: boolean;
  onRegisterHandle: (slotId: string, handle: StagePlayerHandle | null) => void;
  onSlotStateChange: (slotId: string, patch: Partial<StageSlot>) => void;
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
  isExpanded,
  isSoloed,
  onRegisterHandle,
  onSlotStateChange,
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

  const initialMutedRef = useRef(slot.isMuted);
  const initialVolumeRef = useRef(slot.volume);
  const onSlotStateChangeRef = useRef(onSlotStateChange);
  onSlotStateChangeRef.current = onSlotStateChange;

  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    if (!host) return;

    // Create dedicated child node so YouTube's iframe replacement stays outside React's diff tree
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
              event.target.setVolume(initialVolumeRef.current);
              if (initialMutedRef.current) {
                event.target.mute();
              } else {
                event.target.unMute();
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
                    event.target.setVolume(vol);
                    if (vol > 0 && event.target.isMuted()) {
                      event.target.unMute();
                    }
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
              const playing = event.data === YT.PlayerState.PLAYING;
              onSlotStateChangeRef.current(slot.slotId, { isPlaying: playing });
            },
            onError: (event) => {
              if (disposed) return;
              const code = event.data;
              if (code === 101 || code === 150) {
                setEmbedError('The video owner disabled embedded playback for this URL.');
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
  }, [slot.slotId, slot.videoId, onRegisterHandle]);

  const handleTogglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (slot.isPlaying) {
      p.pauseVideo();
      onSlotStateChange(slot.slotId, { isPlaying: false });
    } else {
      p.playVideo();
      onSlotStateChange(slot.slotId, { isPlaying: true });
    }
  };

  const handleToggleMute = () => {
    const p = playerRef.current;
    const nextMuted = !slot.isMuted;
    if (p) {
      if (nextMuted) p.mute();
      else p.unMute();
    }
    onSlotStateChange(slot.slotId, { isMuted: nextMuted });
  };

  const handleVolumeChange = (nextVol: number) => {
    const p = playerRef.current;
    if (p) {
      p.setVolume(nextVol);
      if (nextVol === 0) {
        p.mute();
      } else if (slot.isMuted) {
        p.unMute();
      }
    }
    onSlotStateChange(slot.slotId, { volume: nextVol, isMuted: nextVol === 0 });
  };

  const useDenseChrome = dense && !isExpanded;

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
      className={`group/tile relative flex flex-col bg-[#0E121B] border rounded-lg overflow-hidden transition-all duration-150 ${
        isDragOver
          ? 'border-[#06E5F5] ring-2 ring-[#06E5F5]/50'
          : isSoloed
            ? 'border-[#06E5F5]/70'
            : 'border-[#1E2638] hover:border-[#2C3752]'
      } ${isDragging ? 'opacity-45 scale-[0.99]' : ''} ${isExpanded ? 'col-span-full' : ''}`}
    >
      {/* Top Bar — Standard vs Dense Micro-Bar */}
      {useDenseChrome ? (
        <div className="flex items-center justify-between gap-1.5 px-2 py-1 bg-[#0B0F17] border-b border-[#1E2638]">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {draggableEnabled && (
              <button
                type="button"
                title="Drag to reorder stream"
                aria-label={`Drag to reorder ${slot.title}`}
                onMouseEnter={() => setHandleArmed(true)}
                onMouseLeave={() => {
                  if (!isDragging) setHandleArmed(false);
                }}
                onPointerDown={() => setHandleArmed(true)}
                className="p-0.5 text-slate-500 hover:text-[#06E5F5] cursor-grab active:cursor-grabbing shrink-0 rounded focus-visible:outline-2 focus-visible:outline-[#06E5F5]"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleTogglePlay}
              title={slot.isPlaying ? 'Pause' : 'Play'}
              className="p-0.5 text-[#06E5F5] hover:text-[#38EEFF] shrink-0 rounded"
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

          <div className="flex items-center gap-0.5 opacity-0 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 transition-opacity duration-150 shrink-0">
            <button
              type="button"
              onClick={() => onToggleExpand(slot.slotId)}
              title="Expand stream"
              className="p-1 text-slate-400 hover:text-[#06E5F5] rounded"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(slot.slotId)}
              title="Remove from stage"
              className="p-1 text-slate-400 hover:text-[#F43F5E] rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2.5 px-2.5 py-2 bg-[#0B0F17] border-b border-[#1E2638]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {draggableEnabled && (
              <button
                type="button"
                title="Drag to reorder stream"
                aria-label={`Drag to reorder ${slot.title}`}
                onMouseEnter={() => setHandleArmed(true)}
                onMouseLeave={() => {
                  if (!isDragging) setHandleArmed(false);
                }}
                onPointerDown={() => setHandleArmed(true)}
                className="p-1 text-slate-500 hover:text-[#06E5F5] hover:bg-[#141A29] cursor-grab active:cursor-grabbing rounded transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-[#06E5F5]"
              >
                <GripVertical className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-xs font-medium text-slate-100 truncate">{slot.title}</h3>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {slot.channel}
                <span aria-hidden="true" className="mx-1.5 text-slate-600">
                  ·
                </span>
                <span className="font-mono tabular-nums text-slate-500">{slot.videoId}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <a
              href={getYouTubeCanonicalUrl(slot.videoId)}
              target="_blank"
              rel="noopener noreferrer"
              title="Open on YouTube"
              className="p-1.5 text-slate-400 hover:text-slate-100 rounded transition-colors focus-visible:outline-2 focus-visible:outline-[#06E5F5]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={() => onToggleExpand(slot.slotId)}
              title={isExpanded ? 'Exit focus view' : 'Expand stream'}
              className="p-1.5 text-slate-400 hover:text-[#06E5F5] rounded transition-colors focus-visible:outline-2 focus-visible:outline-[#06E5F5]"
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onRemove(slot.slotId)}
              title="Remove from stage"
              className="p-1.5 text-slate-400 hover:text-[#F43F5E] rounded transition-colors focus-visible:outline-2 focus-visible:outline-[#06E5F5]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 16:9 YouTube Player Stage */}
      <div className="relative w-full aspect-video bg-[#07090E] overflow-hidden">
        <div ref={hostRef} className="w-full h-full" />

        {/* Drop Overlay Indicator */}
        {isDragOver && (
          <div className="absolute inset-0 bg-[#06E5F5]/15 border-2 border-dashed border-[#06E5F5] pointer-events-none flex items-center justify-center z-20">
            <span className="px-2.5 py-1 text-xs font-semibold text-[#07090E] bg-[#06E5F5] rounded">
              Drop to reorder here
            </span>
          </div>
        )}

        {!isReady && !embedError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07090E]/90 pointer-events-none">
            <div className="w-5 h-5 border-2 border-[#1E2638] border-t-[#06E5F5] rounded-full animate-spin mb-1.5" />
            <span className="text-[11px] text-slate-400">Initializing...</span>
          </div>
        )}

        {embedError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
            <img
              src={STREAM_FALLBACK_BACKDROP}
              alt="Stream unavailable backdrop"
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-25"
            />
            <div className="relative z-10 max-w-xs space-y-2">
              <p className="text-xs font-medium text-slate-100">{embedError}</p>
              <a
                href={getYouTubeCanonicalUrl(slot.videoId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#07090E] bg-[#06E5F5] rounded hover:bg-[#38EEFF] transition-colors"
              >
                Watch on YouTube
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Dense Mode Hover Mixer Overlay */}
        {useDenseChrome && (
          <div className="absolute inset-x-0 bottom-0 z-10 px-2 py-1.5 bg-[#07090E]/92 border-t border-[#1E2638] flex items-center justify-between gap-1.5 opacity-0 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 transition-opacity duration-150">
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleTogglePlay}
                className="p-1 text-[#06E5F5] bg-[#141A29] hover:bg-[#1C2438] rounded"
                title={slot.isPlaying ? 'Pause' : 'Play'}
              >
                {slot.isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => onSolo(slot.slotId)}
                title="Solo stream audio"
                className={`px-1.5 py-0.5 text-[10px] font-medium rounded border transition-colors ${
                  isSoloed
                    ? 'bg-[#06E5F5]/20 text-[#06E5F5] border-[#06E5F5]/50'
                    : 'bg-[#141A29] text-slate-300 border-[#253047] hover:text-slate-100'
                }`}
              >
                Solo
              </button>
            </div>

            <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
              <button
                type="button"
                onClick={handleToggleMute}
                className={slot.isMuted ? 'text-amber-400' : 'text-slate-300 hover:text-[#06E5F5]'}
                aria-label={slot.isMuted ? 'Unmute stream' : 'Mute stream'}
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
                className="cyber-range w-16"
              />
              <a
                href={getYouTubeCanonicalUrl(slot.videoId)}
                target="_blank"
                rel="noopener noreferrer"
                title="Open on YouTube"
                className="p-0.5 text-slate-400 hover:text-slate-100"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Standard Independent Mixer Footer */}
      {!useDenseChrome && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0B0F17] border-t border-[#1E2638]">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-100 bg-[#141A29] hover:bg-[#1C2438] border border-[#253047] rounded transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#06E5F5]"
            >
              {slot.isPlaying ? <Pause className="w-3 h-3 text-[#06E5F5]" /> : <Play className="w-3 h-3 text-[#06E5F5]" />}
              {!compact && <span>{slot.isPlaying ? 'Pause' : 'Play'}</span>}
            </button>

            <button
              type="button"
              onClick={() => onSolo(slot.slotId)}
              title="Solo this stream audio (mutes all other streams)"
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#06E5F5] ${
                isSoloed
                  ? 'bg-[#06E5F5]/15 text-[#06E5F5] border-[#06E5F5]/50'
                  : 'bg-[#141A29] text-slate-300 border-[#253047] hover:text-slate-100'
              }`}
            >
              <Headphones className="w-3 h-3" />
              <span>Solo</span>
            </button>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={slot.isMuted ? 'Unmute stream' : 'Mute stream'}
              className={`p-1 rounded transition-colors focus-visible:outline-2 focus-visible:outline-[#06E5F5] ${
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
            <span className="text-[11px] font-mono tabular-nums text-slate-400 w-7 text-right">
              {slot.isMuted ? '0%' : `${slot.volume}%`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
