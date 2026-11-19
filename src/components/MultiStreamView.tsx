import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import {
  BookmarkPlus,
  Clock,
  Grid2x2,
  Layers,
  LayoutGrid,
  Maximize,
  Move,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sliders,
  Trash2,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { STREAM_FALLBACK_BACKDROP } from '../lib/synthAudio';
import {
  formatRoleLabel,
  getYouTubeThumbnailUrl,
  PRESET_ROUTINES,
} from '../lib/youtube';
import type {
  MultiStreamPreset,
  PresetRoutine,
  StackViewMode,
  StagePlayerHandle,
  StageSlot,
  StreamCanvasMode,
  StreamGridLayout,
  YouTubeFolder,
  YouTubeVideoItem,
} from '../types/media';
import { YouTubePlayerTile } from './YouTubePlayerTile';

interface MultiStreamViewProps {
  stageSlots: StageSlot[];
  viewMode: StackViewMode;
  gridLayout: StreamGridLayout;
  canvasMode: StreamCanvasMode;
  masterStackVolume: number;
  effectiveYtMultiplier: number;
  sleepSecondsLeft: number | null;
  isSleepFading: boolean;
  isOnline: boolean;
  soloSlotId: string | null;
  savedVideos: YouTubeVideoItem[];
  folders: YouTubeFolder[];
  presets: MultiStreamPreset[];
  onViewModeChange: (mode: StackViewMode) => void;
  onGridLayoutChange: (layout: StreamGridLayout) => void;
  onCanvasModeChange: (mode: StreamCanvasMode) => void;
  onMasterStackVolumeChange: (vol: number) => void;
  onApplyQuietLayer: () => void;
  onApplyBalanceAll: () => void;
  onStartSleepTimer: (minutes: number) => void;
  onCancelSleepTimer: () => void;
  onQuickAddUrl: (rawUrl: string) => Promise<string | null>;
  onAddSavedToStage: (video: YouTubeVideoItem) => void;
  onRemoveFromStage: (slotId: string) => void;
  onReorderSlots: (sourceSlotId: string, targetSlotId: string) => void;
  onClearStage: () => void;
  onSlotStateChange: (slotId: string, patch: Partial<StageSlot>) => void;
  onLoopCompleted: (videoItemId: string) => void;
  onVideoPlayed: (videoItemId: string) => void;
  onRegisterHandle: (slotId: string, handle: StagePlayerHandle | null) => void;
  onPlayAll: () => void;
  onPauseAll: () => void;
  onMuteAll: () => void;
  onUnmuteAll: () => void;
  onSyncAll: () => void;
  onSoloSlot: (slotId: string) => void;
  onSavePreset: (name: string, routine: PresetRoutine) => void;
  onLoadPreset: (preset: MultiStreamPreset) => void;
  onOpenBatchModal: () => void;
}

const LAYOUT_OPTIONS: Array<{ value: StreamGridLayout; label: string; cols: number }> = [
  { value: 'auto', label: 'Auto', cols: 0 },
  { value: '1', label: '1', cols: 1 },
  { value: '2', label: '2', cols: 2 },
  { value: '4', label: '2×2', cols: 2 },
  { value: '6', label: '3×2', cols: 3 },
  { value: '9', label: '3×3', cols: 3 },
  { value: '16', label: '4×4', cols: 4 },
  { value: '25', label: '5×5', cols: 5 },
  { value: '36', label: '6×6', cols: 6 },
  { value: '49', label: '7×7', cols: 7 },
  { value: '64', label: '8×8', cols: 8 },
];

const SLEEP_PRESET_MINUTES = [15, 30, 45, 60, 90];

function formatCountdown(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

export function MultiStreamView({
  stageSlots,
  viewMode,
  gridLayout,
  canvasMode,
  masterStackVolume,
  effectiveYtMultiplier,
  sleepSecondsLeft,
  isSleepFading,
  isOnline,
  soloSlotId,
  savedVideos,
  folders,
  presets,
  onViewModeChange,
  onGridLayoutChange,
  onCanvasModeChange,
  onMasterStackVolumeChange,
  onApplyQuietLayer,
  onApplyBalanceAll,
  onStartSleepTimer,
  onCancelSleepTimer,
  onQuickAddUrl,
  onAddSavedToStage,
  onRemoveFromStage,
  onReorderSlots,
  onClearStage,
  onSlotStateChange,
  onLoopCompleted,
  onVideoPlayed,
  onRegisterHandle,
  onPlayAll,
  onPauseAll,
  onMuteAll,
  onUnmuteAll,
  onSyncAll,
  onSoloSlot,
  onSavePreset,
  onLoadPreset,
  onOpenBatchModal,
}: MultiStreamViewProps) {
  const [quickUrl, setQuickUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null);
  const [showShelf, setShowShelf] = useState(true);
  const [shelfFolder, setShelfFolder] = useState<string>('all');
  const [routineFilter, setRoutineFilter] = useState<string>('all');

  // Save Routine Stack Preset form
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetRoutine, setPresetRoutine] = useState<PresetRoutine>('Focus');

  // Sleep Timer Popover
  const [showSleepPopover, setShowSleepPopover] = useState(false);
  const [customSleepMin, setCustomSleepMin] = useState('45');

  // Drag-and-drop state
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrl.trim()) return;
    setUrlError(null);
    setIsAddingUrl(true);
    const err = await onQuickAddUrl(quickUrl);
    setIsAddingUrl(false);
    if (err) {
      setUrlError(err);
    } else {
      setQuickUrl('');
    }
  };

  const handleSavePresetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim() || stageSlots.length === 0) return;
    onSavePreset(presetName.trim(), presetRoutine);
    setPresetName('');
    setShowPresetForm(false);
  };

  const handleCustomSleepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseInt(customSleepMin, 10);
    if (Number.isFinite(mins) && mins >= 1 && mins <= 720) {
      onStartSleepTimer(mins);
      setShowSleepPopover(false);
    }
  };

  const resolvedColumns = useMemo(() => {
    if (expandedSlotId) return 1;
    const found = LAYOUT_OPTIONS.find((opt) => opt.value === gridLayout);
    if (found && found.cols > 0) return found.cols;
    const count = stageSlots.length;
    if (count <= 1) return 1;
    if (count <= 4) return 2;
    if (count <= 9) return 3;
    if (count <= 16) return 4;
    if (count <= 25) return 5;
    if (count <= 36) return 6;
    if (count <= 49) return 7;
    return 8;
  }, [expandedSlotId, gridLayout, stageSlots.length]);

  const isDenseGrid = viewMode === 'grid' && resolvedColumns >= 4 && !expandedSlotId;
  const isCompactGrid = viewMode === 'grid' && resolvedColumns >= 3 && !expandedSlotId;

  const gridStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (expandedSlotId) {
      return { gridTemplateColumns: 'minmax(0, 1fr)' };
    }
    if (viewMode === 'mixer') {
      return undefined;
    }
    if (viewMode === 'mini') {
      return {
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      };
    }
    if (resolvedColumns === 1) {
      return { gridTemplateColumns: 'minmax(0, 1fr)' };
    }
    if (canvasMode === 'canvas') {
      const minTilePx = resolvedColumns >= 6 ? 260 : 300;
      return {
        gridTemplateColumns: `repeat(${resolvedColumns}, minmax(${minTilePx}px, 1fr))`,
        minWidth: `${resolvedColumns * minTilePx + (resolvedColumns - 1) * 12}px`,
      };
    }
    return {
      gridTemplateColumns: `repeat(${resolvedColumns}, minmax(0, 1fr))`,
    };
  }, [canvasMode, expandedSlotId, resolvedColumns, viewMode]);

  const shelfVideos = useMemo(() => {
    if (shelfFolder === 'all') return savedVideos;
    return savedVideos.filter((v) => v.folderId === shelfFolder);
  }, [savedVideos, shelfFolder]);

  const filteredPresets = useMemo(() => {
    if (routineFilter === 'all') return presets;
    return presets.filter((p) => p.routine === routineFilter);
  }, [presets, routineFilter]);

  const activeVideoIdsOnStage = useMemo(
    () => new Set(stageSlots.map((s) => s.videoId)),
    [stageSlots]
  );

  const visibleSlots = expandedSlotId
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

  const handleDragLeaveTile = (targetSlotId: string) => {
    setDragOverSlotId((prev) => (prev === targetSlotId ? null : prev));
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

  const handleDragEndTile = () => {
    setDraggedSlotId(null);
    setDragOverSlotId(null);
  };

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-56px-76px)] lg:overflow-hidden">
      {/* Main Stack Mixer Column (Pinned Toolbar + Independent Scrollable Canvas) */}
      <div className="flex-1 min-w-0 flex flex-col lg:h-full lg:overflow-hidden">
        {/* Pinned Stack Command Toolbar */}
        <div className="shrink-0 bg-[#0B0E17] border-b border-[#1E2638] px-4 sm:px-5 py-3 space-y-2.5">
          {/* Row 1: Quick URL Input + View Mode Switcher + Grid Options + Sidebar Toggle */}
          <div className="flex flex-col xl:flex-row xl:items-center gap-2.5">
            <form onSubmit={handleQuickSubmit} className="flex-1 flex items-center gap-2 min-w-0">
              <input
                type="text"
                value={quickUrl}
                onChange={(e) => {
                  setQuickUrl(e.target.value);
                  if (urlError) setUrlError(null);
                }}
                placeholder="Paste YouTube subliminal URL or 11-char ID to layer onto stack..."
                className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-[#07090E] border border-[#253047] rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#06E5F5]"
              />
              <button
                type="submit"
                disabled={isAddingUrl}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAddingUrl ? 'Adding...' : 'Add to Stack'}
              </button>
            </form>

            {/* View Mode Switcher (Video Grid | Compact Mixer | Mini Tiles) + Grid Scale */}
            <div className="flex items-center gap-2 flex-wrap xl:flex-nowrap justify-between xl:justify-end">
              <div
                className="flex items-center gap-0.5 p-0.5 bg-[#07090E] border border-[#1E2638] rounded-md shrink-0"
                role="group"
                aria-label="Stack view mode"
              >
                <button
                  type="button"
                  onClick={() => {
                    setExpandedSlotId(null);
                    onViewModeChange('grid');
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                    viewMode === 'grid'
                      ? 'bg-[#172033] text-[#06E5F5]'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <Grid2x2 className="w-3 h-3" />
                  Video Grid
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedSlotId(null);
                    onViewModeChange('mixer');
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                    viewMode === 'mixer'
                      ? 'bg-[#172033] text-[#06E5F5]'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <Sliders className="w-3 h-3" />
                  Compact Mixer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedSlotId(null);
                    onViewModeChange('mini');
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                    viewMode === 'mini'
                      ? 'bg-[#172033] text-[#06E5F5]'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" />
                  Mini Tiles
                </button>
              </div>

              {viewMode === 'grid' && (
                <>
                  <div
                    className="flex items-center gap-0.5 p-0.5 bg-[#07090E] border border-[#1E2638] rounded-md overflow-x-auto max-w-full"
                    role="group"
                    aria-label="Grid scale presets"
                  >
                    {LAYOUT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setExpandedSlotId(null);
                          onGridLayoutChange(opt.value);
                        }}
                        className={`px-1.5 py-1 text-[11px] font-mono tabular-nums font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                          gridLayout === opt.value
                            ? 'bg-[#172033] text-[#06E5F5]'
                            : 'text-slate-400 hover:text-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div
                    className="flex items-center gap-0.5 p-0.5 bg-[#07090E] border border-[#1E2638] rounded-md shrink-0"
                    role="group"
                    aria-label="Viewport scaling mode"
                  >
                    <button
                      type="button"
                      onClick={() => onCanvasModeChange('fit')}
                      title="Fit all columns within viewport"
                      className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                        canvasMode === 'fit'
                          ? 'bg-[#172033] text-[#06E5F5]'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      <Maximize className="w-3 h-3" />
                      Fit
                    </button>
                    <button
                      type="button"
                      onClick={() => onCanvasModeChange('canvas')}
                      title="Scrollable canvas with minimum tile width"
                      className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                        canvasMode === 'canvas'
                          ? 'bg-[#172033] text-[#06E5F5]'
                          : 'text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      <Move className="w-3 h-3" />
                      Canvas
                    </button>
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => setShowShelf((prev) => !prev)}
                title={showShelf ? 'Collapse library sidebar' : 'Expand library sidebar'}
                className="p-1.5 text-slate-400 hover:text-slate-100 bg-[#141A29] border border-[#1E2638] rounded-md transition-colors shrink-0"
              >
                {showShelf ? (
                  <PanelRightClose className="w-4 h-4" />
                ) : (
                  <PanelRightOpen className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {urlError && <p className="text-xs text-[#F43F5E]">{urlError}</p>}

          {/* Row 2: Global Transport + Master Stack Fader + Quiet/Balance + Sleep Timer + Save Stack */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#182032]">
            {/* Left: Simultaneous Transport & Master Fader */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onPlayAll}
                disabled={stageSlots.length === 0 || !isOnline}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] disabled:opacity-40 rounded transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Play All
              </button>
              <button
                type="button"
                onClick={onPauseAll}
                disabled={stageSlots.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#141A29] hover:bg-[#1C2438] disabled:opacity-40 border border-[#253047] rounded transition-colors whitespace-nowrap shrink-0"
              >
                <Pause className="w-3.5 h-3.5" />
                Pause
              </button>
              <button
                type="button"
                onClick={onMuteAll}
                disabled={stageSlots.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#141A29] hover:bg-[#1C2438] disabled:opacity-40 border border-[#253047] rounded transition-colors whitespace-nowrap shrink-0"
              >
                <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                Mute
              </button>
              <button
                type="button"
                onClick={onUnmuteAll}
                disabled={stageSlots.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#141A29] hover:bg-[#1C2438] disabled:opacity-40 border border-[#253047] rounded transition-colors whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#06E5F5]" />
                Unmute
              </button>
              <button
                type="button"
                onClick={onSyncAll}
                disabled={stageSlots.length === 0 || !isOnline}
                title="Seek all channels to 0:00 and play"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#141A29] hover:bg-[#1C2438] disabled:opacity-40 border border-[#253047] rounded transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Sync
              </button>

              <span aria-hidden="true" className="hidden sm:inline-block h-4 w-px bg-[#1E2638] mx-1" />

              {/* Master Stack Fader + Quiet Layer + Balance */}
              <div className="flex items-center gap-2 px-2.5 py-1 bg-[#07090E] border border-[#1E2638] rounded">
                <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                  Master
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={masterStackVolume}
                  onChange={(e) => onMasterStackVolumeChange(Number(e.target.value))}
                  aria-label="Master stack volume"
                  className="cyber-range w-20 sm:w-24"
                />
                <span className="text-[11px] font-mono tabular-nums text-[#06E5F5] w-8 text-right">
                  {masterStackVolume}%
                </span>
              </div>

              <button
                type="button"
                onClick={onApplyQuietLayer}
                disabled={stageSlots.length === 0}
                title="Set all stacked subliminals to a gentle 18% background layer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-[#06E5F5] disabled:opacity-40 bg-[#141A29] border border-[#253047] rounded transition-colors whitespace-nowrap shrink-0"
              >
                <Volume1 className="w-3.5 h-3.5" />
                Quiet Layer
              </button>
              <button
                type="button"
                onClick={onApplyBalanceAll}
                disabled={stageSlots.length === 0}
                title="Evenly balance all stacked channels to 45% unmuted"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-[#06E5F5] disabled:opacity-40 bg-[#141A29] border border-[#253047] rounded transition-colors whitespace-nowrap shrink-0"
              >
                Balance All
              </button>
            </div>

            {/* Right: Sleep Timer + Stack Count + Save Routine Stack + Clear */}
            <div className="flex items-center gap-2 relative">
              {/* Sleep Timer Trigger & Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSleepPopover((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
                    sleepSecondsLeft !== null
                      ? isSleepFading
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/45'
                        : 'bg-[#06E5F5]/15 text-[#06E5F5] border-[#06E5F5]/45'
                      : 'bg-[#141A29] text-slate-300 border-[#253047] hover:text-slate-100'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {sleepSecondsLeft !== null ? (
                    <span className="font-mono tabular-nums">
                      {isSleepFading ? 'Fading ' : ''}
                      {formatCountdown(sleepSecondsLeft)}
                    </span>
                  ) : (
                    <span>Sleep Timer</span>
                  )}
                </button>

                {showSleepPopover && (
                  <div className="absolute right-0 top-full mt-2 z-40 w-64 bg-[#0E121B] border border-[#253047] rounded-lg p-3.5 shadow-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-100">Sleep Timer</p>
                        <p className="text-[11px] text-slate-400">
                          30s gentle fade-out then Stop All
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSleepPopover(false)}
                        className="p-1 text-slate-400 hover:text-slate-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5">
                      {SLEEP_PRESET_MINUTES.map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => {
                            onStartSleepTimer(mins);
                            setShowSleepPopover(false);
                          }}
                          className="py-1.5 text-xs font-mono tabular-nums text-slate-200 bg-[#141A29] hover:bg-[#1C2438] hover:text-[#06E5F5] border border-[#253047] rounded transition-colors"
                        >
                          {mins}m
                        </button>
                      ))}
                    </div>

                    <form onSubmit={handleCustomSleepSubmit} className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={720}
                        value={customSleepMin}
                        onChange={(e) => setCustomSleepMin(e.target.value)}
                        aria-label="Custom sleep timer minutes"
                        className="flex-1 px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#07090E] border border-[#253047] rounded text-slate-100 focus:outline-none focus:border-[#06E5F5]"
                      />
                      <span className="text-[11px] text-slate-400">min</span>
                      <button
                        type="submit"
                        className="px-2.5 py-1.5 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] rounded"
                      >
                        Start
                      </button>
                    </form>

                    {sleepSecondsLeft !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          onCancelSleepTimer();
                          setShowSleepPopover(false);
                        }}
                        className="w-full py-1.5 text-xs font-medium text-[#F43F5E] bg-[#F43F5E]/10 hover:bg-[#F43F5E]/20 border border-[#F43F5E]/30 rounded"
                      >
                        Cancel Timer
                      </button>
                    )}
                  </div>
                )}
              </div>

              <span className="hidden md:inline text-xs font-mono tabular-nums text-slate-400 whitespace-nowrap">
                {stageSlots.length} stacked
              </span>

              {showPresetForm ? (
                <form onSubmit={handleSavePresetSubmit} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Stack name"
                    autoFocus
                    className="w-32 px-2 py-1 text-xs bg-[#07090E] border border-[#253047] rounded text-slate-100 focus:outline-none focus:border-[#06E5F5]"
                  />
                  <select
                    value={presetRoutine}
                    onChange={(e) => setPresetRoutine(e.target.value as PresetRoutine)}
                    aria-label="Routine category"
                    className="px-2 py-1 text-xs bg-[#07090E] border border-[#253047] rounded text-slate-200 focus:outline-none focus:border-[#06E5F5]"
                  >
                    {PRESET_ROUTINES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="px-2.5 py-1 text-xs font-semibold text-[#07090E] bg-[#06E5F5] rounded"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPresetForm(false)}
                    className="p-1 text-slate-400 hover:text-slate-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPresetForm(true)}
                  disabled={stageSlots.length === 0}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-slate-100 disabled:opacity-40 bg-[#141A29] border border-[#253047] rounded transition-colors whitespace-nowrap shrink-0"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  Save Stack
                </button>
              )}

              <button
                type="button"
                onClick={onClearStage}
                disabled={stageSlots.length === 0}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-400 hover:text-[#F43F5E] disabled:opacity-40 rounded transition-colors whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Independent Scrollable Stack Canvas */}
        <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-5">
          {visibleSlots.length === 0 ? (
            <div className="relative rounded-lg overflow-hidden border border-[#1E2638] min-h-[420px] flex items-end">
              <img
                src={STREAM_FALLBACK_BACKDROP}
                alt="Subliminal stack mixer backdrop"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover opacity-55"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#07090E] via-[#07090E]/75 to-[#07090E]/30" />
              <div className="relative z-10 p-6 sm:p-8 max-w-2xl space-y-4">
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-semibold text-slate-100">
                    Subliminal &amp; Frequency Stack Mixer
                  </h2>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Layer multiple YouTube subliminals and frequencies simultaneously with independent
                    volume, playback speed, infinite or custom loop counts, sleep fade-out, and
                    switchable Video Grid, Compact Mixer, and Mini Tile views.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  {presets[0] && (
                    <button
                      type="button"
                      onClick={() => onLoadPreset(presets[0])}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] rounded-md transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Load {presets[0].name}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onOpenBatchModal}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-100 bg-[#141A29] hover:bg-[#1C2438] border border-[#253047] rounded-md transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#06E5F5]" />
                    Batch Import Subliminals
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={gridStyle}
              className={
                viewMode === 'mixer' && !expandedSlotId
                  ? 'flex flex-col gap-2.5 max-w-6xl mx-auto'
                  : `grid ${isDenseGrid || viewMode === 'mini' ? 'gap-2.5' : 'gap-4'} ${
                      viewMode === 'grid' && resolvedColumns === 1 && !expandedSlotId
                        ? 'max-w-5xl mx-auto'
                        : ''
                    }`
              }
            >
              {visibleSlots.map((slot) => (
                <YouTubePlayerTile
                  key={slot.slotId}
                  slot={slot}
                  viewMode={viewMode}
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
                  compact={isCompactGrid}
                  dense={isDenseGrid}
                  draggableEnabled={visibleSlots.length > 1 && !expandedSlotId}
                  isDragging={draggedSlotId === slot.slotId}
                  isDragOver={dragOverSlotId === slot.slotId}
                  onDragStartTile={handleDragStartTile}
                  onDragOverTile={handleDragOverTile}
                  onDragLeaveTile={handleDragLeaveTile}
                  onDropTile={handleDropTile}
                  onDragEndTile={handleDragEndTile}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pinned Independent-Scroll Right Sidebar: Routine Stacks & Quick Library */}
      {showShelf && (
        <aside className="w-full lg:w-80 lg:h-full lg:overflow-y-auto shrink-0 border-t lg:border-t-0 lg:border-l border-[#1E2638] bg-[#0B0E17] p-4 flex flex-col gap-5">
          {/* Routine Stack Presets */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-slate-400">Routine Stack Presets</h3>
              <select
                value={routineFilter}
                onChange={(e) => setRoutineFilter(e.target.value)}
                aria-label="Filter presets by routine"
                className="px-2 py-1 text-[11px] bg-[#111624] border border-[#1E2638] rounded text-slate-300 focus:outline-none focus:border-[#06E5F5]"
              >
                <option value="all">All Routines</option>
                {PRESET_ROUTINES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              {filteredPresets.length === 0 ? (
                <p className="text-xs text-slate-500 py-1">No stacks in this routine yet.</p>
              ) : (
                filteredPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onLoadPreset(preset)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left bg-[#111624] hover:bg-[#172033] border border-[#1E2638] hover:border-[#2C3752] rounded-md transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-100 truncate">{preset.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                        {preset.routine} · {preset.videoItemIds.length} tracks
                        {preset.slotConfigs ? ' · mix saved' : ''}
                      </p>
                    </div>
                    <Layers className="w-3.5 h-3.5 text-[#06E5F5] shrink-0 ml-2" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Saved Subliminal Library Quick-Add */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-slate-400">Quick-Add from Library</h3>
              <select
                value={shelfFolder}
                onChange={(e) => setShelfFolder(e.target.value)}
                aria-label="Filter library by folder"
                className="px-2 py-1 text-[11px] bg-[#111624] border border-[#1E2638] rounded text-slate-300 focus:outline-none focus:border-[#06E5F5]"
              >
                <option value="all">All Folders</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {shelfVideos.map((video) => {
                const onStage = activeVideoIdsOnStage.has(video.videoId);
                return (
                  <div
                    key={video.id}
                    className="flex items-center gap-2.5 p-2 bg-[#111624] border border-[#1E2638] rounded-md hover:border-[#2C3752] transition-colors"
                  >
                    <img
                      src={getYouTubeThumbnailUrl(video.videoId)}
                      alt={video.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = STREAM_FALLBACK_BACKDROP;
                      }}
                      className="w-16 h-10 rounded object-cover shrink-0 bg-[#07090E]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-100 truncate">{video.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {video.channel} · {formatRoleLabel(video.role)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddSavedToStage(video)}
                      className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
                        onStage
                          ? 'text-[#06E5F5] border-[#06E5F5]/40 bg-[#06E5F5]/10'
                          : 'text-slate-200 border-[#253047] bg-[#172033] hover:text-[#06E5F5]'
                      }`}
                    >
                      {onStage ? '+ Layer' : '+ Stack'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
