import { useState, type DragEvent, type RefObject } from 'react';
import {
  Clock,
  Grid2x2,
  Layers,
  Pause,
  Play,
  Plus,
  Sliders,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatDuration } from '../lib/format';
import type {
  AudioTrackMeta,
  EqSettings,
  MultiStreamPreset,
  StagePlayerHandle,
  StageSlot,
} from '../types/media';
import { AudioSpectrumCanvas } from './AudioSpectrumCanvas';
import { YouTubePlayerTile } from './YouTubePlayerTile';

interface HybridDeckViewProps {
  tracks: AudioTrackMeta[];
  currentTrack: AudioTrackMeta | null;
  isPlaying: boolean;
  analyserRef: RefObject<AnalyserNode | null>;
  eq: EqSettings;
  stageSlots: StageSlot[];
  soloSlotId: string | null;
  presets: MultiStreamPreset[];
  hybridCrossfade: number; // 0 = Offline Audio only, 50 = Balanced, 100 = YouTube Stack only
  audioCrossfadePct: number;
  stackCrossfadePct: number;
  effectiveYtMultiplier: number;
  sleepSecondsLeft: number | null;
  isSleepFading: boolean;
  isOnline: boolean;
  onHybridCrossfadeChange: (val: number) => void;
  onPlayTrack: (trackId: string, queueIds: string[]) => void;
  onTogglePlayPause: () => void;
  onEqChange: (eq: EqSettings) => void;
  onRegisterHandle: (slotId: string, handle: StagePlayerHandle | null) => void;
  onSlotStateChange: (slotId: string, patch: Partial<StageSlot>) => void;
  onLoopCompleted: (videoItemId: string) => void;
  onVideoPlayed: (videoItemId: string) => void;
  onSoloSlot: (slotId: string) => void;
  onRemoveFromStage: (slotId: string) => void;
  onReorderSlots: (sourceSlotId: string, targetSlotId: string) => void;
  onPlayAllStreams: () => void;
  onPauseAllStreams: () => void;
  onMuteAllStreams: () => void;
  onUnmuteAllStreams: () => void;
  onLoadPreset: (preset: MultiStreamPreset) => void;
  onOpenAddVideoModal: () => void;
}

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function HybridDeckView({
  tracks,
  currentTrack,
  isPlaying,
  analyserRef,
  eq,
  stageSlots,
  soloSlotId,
  presets,
  hybridCrossfade,
  audioCrossfadePct,
  stackCrossfadePct,
  effectiveYtMultiplier,
  sleepSecondsLeft,
  isSleepFading,
  isOnline,
  onHybridCrossfadeChange,
  onPlayTrack,
  onTogglePlayPause,
  onEqChange,
  onRegisterHandle,
  onSlotStateChange,
  onLoopCompleted,
  onVideoPlayed,
  onSoloSlot,
  onRemoveFromStage,
  onReorderSlots,
  onPlayAllStreams,
  onPauseAllStreams,
  onMuteAllStreams,
  onUnmuteAllStreams,
  onLoadPreset,
  onOpenAddVideoModal,
}: HybridDeckViewProps) {
  const [stackLayout, setStackLayout] = useState<'mixer' | 'grid'>('mixer');
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null);
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);
  const trackIds = tracks.map((t) => t.id);

  const displayedSlots = expandedSlotId
    ? stageSlots.filter((s) => s.slotId === expandedSlotId)
    : stageSlots;

  const handleDragStartTile = (slotId: string, e: DragEvent<HTMLDivElement>) => {
    setDraggedSlotId(slotId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', slotId);
  };

  const handleDragOverTile = (targetSlotId: string, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedSlotId && draggedSlotId !== targetSlotId) {
      setDragOverSlotId(targetSlotId);
    }
  };

  const handleDropTile = (targetSlotId: string, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const sourceId = draggedSlotId || e.dataTransfer.getData('text/plain');
    if (sourceId && sourceId !== targetSlotId) {
      onReorderSlots(sourceId, targetSlotId);
    }
    setDraggedSlotId(null);
    setDragOverSlotId(null);
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">
      {/* Master Crossfader Deck Strip */}
      <section className="bg-[#0E121B] border border-[#1E2638] rounded-lg px-4 sm:px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-0.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-semibold text-slate-100">Master Crossfader</h1>
            {sleepSecondsLeft !== null && (
              <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-[#06E5F5]">
                <Clock className="w-3.5 h-3.5" />
                {isSleepFading ? 'Fading ' : ''}
                {formatCountdown(sleepSecondsLeft)}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Balance local offline masking audio against your active YouTube subliminal stack
          </p>
        </div>

        <div className="flex-1 max-w-xl flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-2 text-xs shrink-0">
            <span className="font-medium text-slate-200">Offline Audio</span>
            <span className="font-mono tabular-nums text-[#06E5F5] w-9 text-right">
              {audioCrossfadePct}%
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            value={hybridCrossfade}
            onChange={(e) => onHybridCrossfadeChange(Number(e.target.value))}
            aria-label="Crossfade between Offline Audio and YouTube Stack"
            className="cyber-range flex-1"
          />

          <div className="flex items-center justify-between sm:justify-end gap-2 text-xs shrink-0">
            <span className="font-mono tabular-nums text-[#06E5F5] w-9">
              {stackCrossfadePct}%
            </span>
            <span className="font-medium text-slate-200">YouTube Stack</span>
          </div>
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-[#07090E] border border-[#1E2638] rounded-md shrink-0 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => onHybridCrossfadeChange(20)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
              hybridCrossfade <= 30
                ? 'bg-[#172033] text-[#06E5F5]'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Audio Lead
          </button>
          <button
            type="button"
            onClick={() => onHybridCrossfadeChange(50)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
              hybridCrossfade > 30 && hybridCrossfade < 70
                ? 'bg-[#172033] text-[#06E5F5]'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Balanced
          </button>
          <button
            type="button"
            onClick={() => onHybridCrossfadeChange(80)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
              hybridCrossfade >= 70
                ? 'bg-[#172033] text-[#06E5F5]'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Stack Lead
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Column: Offline Audio Deck + EQ + Track Selector */}
        <section className="xl:col-span-5 bg-[#0E121B] border border-[#1E2638] rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#1E2638] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Offline Audio Console</h2>
              <p className="text-xs text-slate-400">
                Local IndexedDB ambient / rain / music masking layer
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {tracks.length} tracks
            </span>
          </div>

          <div className="p-4 space-y-4 border-b border-[#1E2638]">
            <div className="flex items-center gap-3">
              {currentTrack ? (
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded object-cover border border-[#253047] shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-[#141A29] border border-[#1E2638] shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-100 truncate">
                  {currentTrack ? currentTrack.title : 'Select an offline track'}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {currentTrack
                    ? `${currentTrack.artist} · ${currentTrack.format}`
                    : 'Audio Vault ready'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (currentTrack) onTogglePlayPause();
                  else if (tracks[0]) onPlayTrack(tracks[0].id, trackIds);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] rounded transition-colors shrink-0"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
            </div>

            <div className="bg-[#090C12] border border-[#182032] rounded p-3">
              <AudioSpectrumCanvas
                analyserRef={analyserRef}
                isPlaying={isPlaying}
                barCount={36}
                height={68}
              />
            </div>

            {/* Inline 3-Band EQ */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              {(
                [
                  { key: 'bass', label: 'Bass' },
                  { key: 'mid', label: 'Mid' },
                  { key: 'treble', label: 'Treble' },
                ] as const
              ).map((band) => (
                <div key={band.key} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{band.label}</span>
                    <span className="font-mono tabular-nums text-[#06E5F5]">
                      {eq[band.key] > 0 ? `+${eq[band.key]}` : eq[band.key]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={eq[band.key]}
                    onChange={(e) =>
                      onEqChange({ ...eq, [band.key]: Number(e.target.value), enabled: true })
                    }
                    className="cyber-range w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Compact Offline Track Picker */}
          <div className="divide-y divide-[#182032] max-h-[380px] overflow-y-auto">
            {tracks.map((track) => {
              const active = currentTrack?.id === track.id;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() =>
                    active ? onTogglePlayPause() : onPlayTrack(track.id, trackIds)
                  }
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                    active ? 'bg-[#06E5F5]/10' : 'hover:bg-[#141A29]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={active ? 'text-[#06E5F5]' : 'text-slate-500'}>
                      {active && isPlaying ? (
                        <Pause className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-medium truncate ${
                          active ? 'text-[#06E5F5]' : 'text-slate-100'
                        }`}
                      >
                        {track.title}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">{track.artist}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                    {formatDuration(track.duration)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right Column: Live YouTube Subliminal Stack */}
        <section className="xl:col-span-7 space-y-4">
          <div className="bg-[#0E121B] border border-[#1E2638] rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Active Subliminal Stack</h2>
              <p className="text-xs text-slate-400">
                <span className="font-mono tabular-nums">{stageSlots.length}</span> layered
                {stageSlots.length === 1 ? ' channel' : ' channels'} balanced through crossfader
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-0.5 p-0.5 bg-[#07090E] border border-[#1E2638] rounded-md mr-1">
                <button
                  type="button"
                  onClick={() => {
                    setExpandedSlotId(null);
                    setStackLayout('mixer');
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded ${
                    stackLayout === 'mixer'
                      ? 'bg-[#172033] text-[#06E5F5]'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <Sliders className="w-3 h-3" />
                  Mixer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedSlotId(null);
                    setStackLayout('grid');
                  }}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded ${
                    stackLayout === 'grid'
                      ? 'bg-[#172033] text-[#06E5F5]'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <Grid2x2 className="w-3 h-3" />
                  Grid
                </button>
              </div>

              <button
                type="button"
                onClick={onPlayAllStreams}
                disabled={stageSlots.length === 0 || !isOnline}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] disabled:opacity-40 rounded whitespace-nowrap"
              >
                <Play className="w-3 h-3 fill-current" />
                Play All
              </button>
              <button
                type="button"
                onClick={onPauseAllStreams}
                disabled={stageSlots.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#141A29] border border-[#253047] rounded whitespace-nowrap"
              >
                <Pause className="w-3 h-3" />
                Pause
              </button>
              <button
                type="button"
                onClick={onMuteAllStreams}
                disabled={stageSlots.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#141A29] border border-[#253047] rounded whitespace-nowrap"
              >
                <VolumeX className="w-3 h-3 text-amber-400" />
                Mute
              </button>
              <button
                type="button"
                onClick={onUnmuteAllStreams}
                disabled={stageSlots.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#141A29] border border-[#253047] rounded whitespace-nowrap"
              >
                <Volume2 className="w-3 h-3 text-[#06E5F5]" />
                Unmute
              </button>
              <button
                type="button"
                onClick={onOpenAddVideoModal}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#06E5F5] bg-[#141A29] border border-[#06E5F5]/30 rounded whitespace-nowrap"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
          </div>

          {displayedSlots.length === 0 ? (
            <div className="bg-[#0E121B] border border-[#1E2638] rounded-lg p-10 text-center space-y-4">
              <p className="text-sm font-medium text-slate-200">
                No active subliminals in your stack
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onLoadPreset(preset)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-100 bg-[#141A29] hover:bg-[#1C2438] border border-[#253047] rounded-md"
                  >
                    <Layers className="w-3.5 h-3.5 text-[#06E5F5]" />
                    Load {preset.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div
              className={
                stackLayout === 'mixer' && !expandedSlotId
                  ? 'flex flex-col gap-2.5'
                  : `grid gap-4 ${expandedSlotId ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`
              }
            >
              {displayedSlots.map((slot) => (
                <YouTubePlayerTile
                  key={slot.slotId}
                  slot={slot}
                  viewMode={stackLayout}
                  isOnline={isOnline}
                  volumeMultiplier={effectiveYtMultiplier}
                  isExpanded={expandedSlotId === slot.slotId}
                  isSoloed={soloSlotId === slot.slotId}
                  onRegisterHandle={onRegisterHandle}
                  onSlotStateChange={onSlotStateChange}
                  onLoopCompleted={onLoopCompleted}
                  onVideoPlayed={onVideoPlayed}
                  onSolo={onSoloSlot}
                  onToggleExpand={(id) =>
                    setExpandedSlotId((prev) => (prev === id ? null : id))
                  }
                  onRemove={(id) => {
                    if (expandedSlotId === id) setExpandedSlotId(null);
                    onRemoveFromStage(id);
                  }}
                  compact={!expandedSlotId}
                  draggableEnabled={displayedSlots.length > 1 && !expandedSlotId}
                  isDragging={draggedSlotId === slot.slotId}
                  isDragOver={dragOverSlotId === slot.slotId}
                  onDragStartTile={handleDragStartTile}
                  onDragOverTile={handleDragOverTile}
                  onDragLeaveTile={(id) =>
                    setDragOverSlotId((prev) => (prev === id ? null : prev))
                  }
                  onDropTile={handleDropTile}
                  onDragEndTile={() => {
                    setDraggedSlotId(null);
                    setDragOverSlotId(null);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
