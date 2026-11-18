import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import {
  BookmarkPlus,
  Layers,
  Maximize,
  Move,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Tv,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { STREAM_FALLBACK_BACKDROP } from '../lib/synthAudio';
import { getYouTubeThumbnailUrl } from '../lib/youtube';
import type {
  MultiStreamPreset,
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
  gridLayout: StreamGridLayout;
  canvasMode: StreamCanvasMode;
  soloSlotId: string | null;
  savedVideos: YouTubeVideoItem[];
  folders: YouTubeFolder[];
  presets: MultiStreamPreset[];
  onGridLayoutChange: (layout: StreamGridLayout) => void;
  onCanvasModeChange: (mode: StreamCanvasMode) => void;
  onQuickAddUrl: (rawUrl: string) => Promise<string | null>;
  onAddSavedToStage: (video: YouTubeVideoItem) => void;
  onRemoveFromStage: (slotId: string) => void;
  onReorderSlots: (sourceSlotId: string, targetSlotId: string) => void;
  onClearStage: () => void;
  onSlotStateChange: (slotId: string, patch: Partial<StageSlot>) => void;
  onRegisterHandle: (slotId: string, handle: StagePlayerHandle | null) => void;
  onPlayAll: () => void;
  onPauseAll: () => void;
  onMuteAll: () => void;
  onUnmuteAll: () => void;
  onSyncAll: () => void;
  onSoloSlot: (slotId: string) => void;
  onSavePreset: (name: string) => void;
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

export function MultiStreamView({
  stageSlots,
  gridLayout,
  canvasMode,
  soloSlotId,
  savedVideos,
  folders,
  presets,
  onGridLayoutChange,
  onCanvasModeChange,
  onQuickAddUrl,
  onAddSavedToStage,
  onRemoveFromStage,
  onReorderSlots,
  onClearStage,
  onSlotStateChange,
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
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [presetName, setPresetName] = useState('');

  // Drag-and-drop state for grid reordering
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
    onSavePreset(presetName.trim());
    setPresetName('');
    setShowPresetForm(false);
  };

  const resolvedColumns = useMemo(() => {
    if (expandedSlotId) return 1;
    const found = LAYOUT_OPTIONS.find((opt) => opt.value === gridLayout);
    if (found && found.cols > 0) return found.cols;
    // Auto column count scales smoothly all the way up to 8 columns
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

  const isDenseGrid = resolvedColumns >= 4 && !expandedSlotId;
  const isCompactGrid = resolvedColumns >= 3 && !expandedSlotId;

  const gridStyle = useMemo<React.CSSProperties>(() => {
    if (expandedSlotId || resolvedColumns === 1) {
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
  }, [canvasMode, expandedSlotId, resolvedColumns]);

  const shelfVideos = useMemo(() => {
    if (shelfFolder === 'all') return savedVideos;
    return savedVideos.filter((v) => v.folderId === shelfFolder);
  }, [savedVideos, shelfFolder]);

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
      {/* Main Multi-Stream Column (Pinned Toolbar + Independent 2D Scrollable Canvas) */}
      <div className="flex-1 min-w-0 flex flex-col lg:h-full lg:overflow-hidden">
        {/* Pinned Stream Command Toolbar */}
        <div className="shrink-0 bg-[#0B0E17] border-b border-[#1E2638] px-4 sm:px-5 py-3 space-y-2.5">
          {/* Row 1: Quick URL Input + Grid Layout + Fit/Canvas Toggle + Shelf Toggle */}
          <div className="flex flex-col xl:flex-row xl:items-center gap-2.5">
            <form onSubmit={handleQuickSubmit} className="flex-1 flex items-center gap-2 min-w-0">
              <input
                type="text"
                value={quickUrl}
                onChange={(e) => {
                  setQuickUrl(e.target.value);
                  if (urlError) setUrlError(null);
                }}
                placeholder="Paste YouTube URL or 11-char video ID to stream simultaneously..."
                className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-[#07090E] border border-[#253047] rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#06E5F5]"
              />
              <button
                type="submit"
                disabled={isAddingUrl}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAddingUrl ? 'Adding...' : 'Stream URL'}
              </button>
            </form>

            {/* Grid Scale Selector (Up to 8x8) + Fit/Canvas Mode + Sidebar Toggle */}
            <div className="flex items-center gap-2 flex-wrap xl:flex-nowrap justify-between xl:justify-end">
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
                    className={`px-2 py-1 text-[11px] font-mono tabular-nums font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      gridLayout === opt.value
                        ? 'bg-[#172033] text-[#06E5F5]'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Fit-to-Screen vs Scrollable Canvas Mode Toggle */}
              <div
                className="flex items-center gap-0.5 p-0.5 bg-[#07090E] border border-[#1E2638] rounded-md shrink-0"
                role="group"
                aria-label="Viewport scaling mode"
              >
                <button
                  type="button"
                  onClick={() => onCanvasModeChange('fit')}
                  title="Fit all columns within the viewport width"
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
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
                  title="Keep minimum readable tile width and pan horizontally/vertically"
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    canvasMode === 'canvas'
                      ? 'bg-[#172033] text-[#06E5F5]'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <Move className="w-3 h-3" />
                  Canvas
                </button>
              </div>

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

          {/* Row 2: Global Simultaneous Master Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#182032]">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onPlayAll}
                disabled={stageSlots.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] disabled:opacity-40 rounded transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Play All
              </button>
              <button
                type="button"
                onClick={onPauseAll}
                disabled={stageSlots.length === 0}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#141A29] hover:bg-[#1C2438] disabled:opacity-40 border border-[#253047] rounded transition-colors whitespace-nowrap shrink-0"
              >
                <Pause className="w-3.5 h-3.5" />
                Pause All
              </button>
              <button
                type="button"
                onClick={onMuteAll}
                disabled={stageSlots.length === 0}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#141A29] hover:bg-[#1C2438] disabled:opacity-40 border border-[#253047] rounded transition-colors whitespace-nowrap shrink-0"
              >
                <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                Mute All
              </button>
              <button
                type="button"
                onClick={onUnmuteAll}
                disabled={stageSlots.length === 0}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#141A29] hover:bg-[#1C2438] disabled:opacity-40 border border-[#253047] rounded transition-colors whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#06E5F5]" />
                Unmute All
              </button>
              <button
                type="button"
                onClick={onSyncAll}
                disabled={stageSlots.length === 0}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#141A29] hover:bg-[#1C2438] disabled:opacity-40 border border-[#253047] rounded transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Sync Start
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono tabular-nums text-slate-400 whitespace-nowrap">
                {stageSlots.length} active
                <span aria-hidden="true" className="mx-1.5 text-slate-600">
                  ·
                </span>
                {resolvedColumns} cols
                {stageSlots.length > 1 && (
                  <span className="hidden sm:inline text-slate-500">
                    {' '}
                    · drag handle to reorder
                  </span>
                )}
              </span>

              {showPresetForm ? (
                <form onSubmit={handleSavePresetSubmit} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="Preset name"
                    autoFocus
                    className="w-36 px-2.5 py-1 text-xs bg-[#07090E] border border-[#253047] rounded text-slate-100 focus:outline-none focus:border-[#06E5F5]"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 text-xs font-semibold text-[#07090E] bg-[#06E5F5] rounded"
                  >
                    Save
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
                  Save Layout
                </button>
              )}

              <button
                type="button"
                onClick={onClearStage}
                disabled={stageSlots.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-[#F43F5E] disabled:opacity-40 rounded transition-colors whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Independent 2D Scrollable Grid Canvas */}
        <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-5">
          {visibleSlots.length === 0 ? (
            <div className="relative rounded-lg overflow-hidden border border-[#1E2638] min-h-[420px] flex items-end">
              <img
                src={STREAM_FALLBACK_BACKDROP}
                alt="Multi-stream desk backdrop"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover opacity-55"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#07090E] via-[#07090E]/75 to-[#07090E]/30" />
              <div className="relative z-10 p-6 sm:p-8 max-w-2xl space-y-4">
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-semibold text-slate-100">
                    Simultaneous YouTube Multi-Stream Stage
                  </h2>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Load up to 64 simultaneous YouTube streams in grids from 1×1 to 8×8, drag
                    header handles to reorder feeds live, and switch between Fit and Scrollable
                    Canvas modes.
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
                    Add Multiple URLs
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={gridStyle}
              className={`grid ${isDenseGrid ? 'gap-2.5' : 'gap-4'} ${
                resolvedColumns === 1 && !expandedSlotId ? 'max-w-5xl mx-auto' : ''
              }`}
            >
              {visibleSlots.map((slot) => (
                <YouTubePlayerTile
                  key={slot.slotId}
                  slot={slot}
                  isExpanded={expandedSlotId === slot.slotId}
                  isSoloed={soloSlotId === slot.slotId}
                  onRegisterHandle={onRegisterHandle}
                  onSlotStateChange={onSlotStateChange}
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

      {/* Pinned Independent-Scroll Right Sidebar: Saved URLs & Presets */}
      {showShelf && (
        <aside className="w-full lg:w-80 lg:h-full lg:overflow-y-auto shrink-0 border-t lg:border-t-0 lg:border-l border-[#1E2638] bg-[#0B0E17] p-4 flex flex-col gap-5">
          {/* Saved Multi-Stream Presets */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-slate-400">Saved Multi-Stream Layouts</h3>
              <span className="text-[11px] font-mono tabular-nums text-slate-500">
                {presets.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onLoadPreset(preset)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left bg-[#111624] hover:bg-[#172033] border border-[#1E2638] hover:border-[#2C3752] rounded-md transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-100 truncate">{preset.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                      {preset.videoItemIds.length} streams ·{' '}
                      {LAYOUT_OPTIONS.find((o) => o.value === preset.layout)?.label ?? preset.layout}
                    </p>
                  </div>
                  <Tv className="w-3.5 h-3.5 text-[#06E5F5] shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>

          {/* Saved YouTube URLs */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-medium text-slate-400">Saved Stream URLs</h3>
              <select
                value={shelfFolder}
                onChange={(e) => setShelfFolder(e.target.value)}
                aria-label="Filter saved videos by folder"
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
                      <p className="text-[11px] text-slate-400 truncate">{video.channel}</p>
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
                      {onStage ? '+ Clone' : '+ Stage'}
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
