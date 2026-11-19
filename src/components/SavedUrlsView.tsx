import { useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Download,
  Edit3,
  ExternalLink,
  FolderPlus,
  GripVertical,
  Heart,
  Layers,
  LayoutGrid,
  List,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  RotateCcw,
  Search,
  Square,
  StickyNote,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { STREAM_FALLBACK_BACKDROP } from '../lib/synthAudio';
import {
  formatListeningTime,
  formatRoleLabel,
  getYouTubeThumbnailUrl,
  normalizeTopics,
  SUBLIMINAL_ROLES,
  SUGGESTED_TOPICS,
} from '../lib/youtube';
import type {
  MultiStreamPreset,
  SavedUrlCardSize,
  SavedUrlGroupBy,
  SavedUrlSortBy,
  SubliminalRole,
  YouTubeFolder,
  YouTubeVideoItem,
} from '../types/media';

interface SavedUrlsViewProps {
  videos: YouTubeVideoItem[];
  folders: YouTubeFolder[];
  presets: MultiStreamPreset[];
  cardSize: SavedUrlCardSize;
  onCardSizeChange: (size: SavedUrlCardSize) => void;
  onOpenAddModal: () => void;
  onAddToStageAndSwitch: (video: YouTubeVideoItem) => void;
  onLaunchMultiple: (videos: YouTubeVideoItem[]) => void;
  onToggleFavorite: (videoId: string) => void;
  onUpdateVideo: (id: string, patch: Partial<YouTubeVideoItem>) => void;
  onMoveVideosToFolder: (videoIds: string[], folderId: string) => void;
  onAppendVideosToPreset: (videoIds: string[], presetId: string) => void;
  onReorderVideos: (draggedIds: string[], targetVideoId: string) => void;
  onDeleteVideo: (id: string) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onLoadPresetAndSwitch: (preset: MultiStreamPreset) => void;
  onDeletePreset: (presetId: string) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
}

const DRAG_MIME = 'application/x-kurodeck-videos';

const CARD_SIZE_OPTIONS: Array<{ value: SavedUrlCardSize; label: string }> = [
  { value: 'compact', label: 'Compact' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'list', label: 'List' },
];

function getDateBucket(timestamp: number): string {
  const now = Date.now();
  const diffDays = (now - timestamp) / (1000 * 60 * 60 * 24);
  if (diffDays < 1) return 'Today';
  if (diffDays < 7) return 'Last 7 Days';
  if (diffDays < 30) return 'Last 30 Days';
  return 'Earlier';
}

export function SavedUrlsView({
  videos,
  folders,
  presets,
  cardSize,
  onCardSizeChange,
  onOpenAddModal,
  onAddToStageAndSwitch,
  onLaunchMultiple,
  onToggleFavorite,
  onUpdateVideo,
  onMoveVideosToFolder,
  onAppendVideosToPreset,
  onReorderVideos,
  onDeleteVideo,
  onCreateFolder,
  onDeleteFolder,
  onLoadPresetAndSwitch,
  onDeletePreset,
  onExportBackup,
  onImportBackup,
}: SavedUrlsViewProps) {
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicMatchMode, setTopicMatchMode] = useState<'all' | 'any'>('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyWithNotes, setOnlyWithNotes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<SavedUrlGroupBy>('none');
  const [sortBy, setSortBy] = useState<SavedUrlSortBy>('custom');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Drag-and-drop state
  const [draggingVideoIds, setDraggingVideoIds] = useState<string[]>([]);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverPresetId, setDragOverPresetId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

  // Edit modal state
  const [editingVideo, setEditingVideo] = useState<YouTubeVideoItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editChannel, setEditChannel] = useState('');
  const [editFolderId, setEditFolderId] = useState('');
  const [editRole, setEditRole] = useState<SubliminalRole>('subliminal');
  const [editTopicsInput, setEditTopicsInput] = useState('');
  const [editBenefits, setEditBenefits] = useState('');

  const uniqueChannels = useMemo(() => {
    const set = new Set<string>();
    for (const v of videos) {
      if (v.channel.trim()) set.add(v.channel.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [videos]);

  const uniqueTopics = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const v of videos) {
      for (const topic of v.topics) {
        const key = topic.toLowerCase();
        const existing = counts.get(key);
        if (existing) existing.count += 1;
        else counts.set(key, { label: topic, count: 1 });
      }
    }
    return Array.from(counts.values()).sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label)
    );
  }, [videos]);

  const toggleTopicFilter = (topicLabel: string) => {
    setSelectedTopics((prev) => {
      const exists = prev.some((t) => t.toLowerCase() === topicLabel.toLowerCase());
      if (exists) {
        return prev.filter((t) => t.toLowerCase() !== topicLabel.toLowerCase());
      }
      return [...prev, topicLabel];
    });
  };

  const hasActiveFilters =
    selectedFolder !== 'all' ||
    selectedChannel !== 'all' ||
    selectedRole !== 'all' ||
    selectedTopics.length > 0 ||
    onlyFavorites ||
    onlyWithNotes ||
    searchQuery.trim().length > 0;

  const resetFilters = () => {
    setSelectedFolder('all');
    setSelectedChannel('all');
    setSelectedRole('all');
    setSelectedTopics([]);
    setOnlyFavorites(false);
    setOnlyWithNotes(false);
    setSearchQuery('');
  };

  const filteredAndSortedVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = videos.filter((v) => {
      if (selectedFolder === 'favorites' && !v.isFavorite) return false;
      if (
        selectedFolder !== 'all' &&
        selectedFolder !== 'favorites' &&
        v.folderId !== selectedFolder
      ) {
        return false;
      }
      if (selectedChannel !== 'all' && v.channel.trim() !== selectedChannel) return false;
      if (selectedRole !== 'all' && v.role !== selectedRole) return false;
      if (onlyFavorites && !v.isFavorite) return false;
      if (onlyWithNotes && !(v.benefits || v.notes).trim()) return false;

      if (selectedTopics.length > 0) {
        const lowerVideoTopics = new Set(v.topics.map((t) => t.toLowerCase()));
        if (topicMatchMode === 'all') {
          const matchesAll = selectedTopics.every((t) => lowerVideoTopics.has(t.toLowerCase()));
          if (!matchesAll) return false;
        } else {
          const matchesAny = selectedTopics.some((t) => lowerVideoTopics.has(t.toLowerCase()));
          if (!matchesAny) return false;
        }
      }

      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        v.channel.toLowerCase().includes(q) ||
        (v.benefits || v.notes).toLowerCase().includes(q) ||
        v.topics.some((t) => t.toLowerCase().includes(q)) ||
        formatRoleLabel(v.role).toLowerCase().includes(q) ||
        v.videoId.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'channel':
          return a.channel.localeCompare(b.channel) || a.title.localeCompare(b.title);
        case 'addedAt':
          return b.addedAt - a.addedAt;
        case 'loops':
          return (b.loopCount ?? 0) - (a.loopCount ?? 0) || a.title.localeCompare(b.title);
        case 'listening':
          return (
            (b.listeningSeconds ?? 0) - (a.listeningSeconds ?? 0) ||
            a.title.localeCompare(b.title)
          );
        case 'custom':
        default:
          return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      }
    });
  }, [
    videos,
    selectedFolder,
    selectedChannel,
    selectedRole,
    selectedTopics,
    topicMatchMode,
    onlyFavorites,
    onlyWithNotes,
    searchQuery,
    sortBy,
  ]);

  // Partition into groups when Group By != 'none'
  const groupedSections = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: '__all__', label: '', items: filteredAndSortedVideos }];
    }

    const buckets = new Map<string, YouTubeVideoItem[]>();
    const addToBucket = (label: string, item: YouTubeVideoItem) => {
      const existing = buckets.get(label);
      if (existing) existing.push(item);
      else buckets.set(label, [item]);
    };

    for (const video of filteredAndSortedVideos) {
      if (groupBy === 'topic') {
        if (video.topics.length === 0) {
          addToBucket('Untagged Topics', video);
        } else {
          for (const topic of video.topics) {
            addToBucket(topic, video);
          }
        }
      } else if (groupBy === 'creator') {
        addToBucket(video.channel.trim() || 'Unknown Creator', video);
      } else if (groupBy === 'role') {
        addToBucket(formatRoleLabel(video.role), video);
      } else if (groupBy === 'folder') {
        const folderName =
          folders.find((f) => f.id === video.folderId)?.name ?? 'Uncategorized';
        addToBucket(folderName, video);
      } else if (groupBy === 'favorite') {
        addToBucket(video.isFavorite ? 'Favorites' : 'Standard', video);
      } else if (groupBy === 'preset') {
        const memberPresets = presets.filter((p) => p.videoItemIds.includes(video.id));
        if (memberPresets.length === 0) {
          addToBucket('Not in Any Stack Preset', video);
        } else {
          for (const preset of memberPresets) {
            addToBucket(`${preset.name} (${preset.routine})`, video);
          }
        }
      } else if (groupBy === 'date') {
        addToBucket(getDateBucket(video.addedAt), video);
      }
    }

    const entries = Array.from(buckets.entries());
    if (groupBy === 'favorite') {
      entries.sort(([a], [b]) => (a === 'Favorites' ? -1 : b === 'Favorites' ? 1 : 0));
    } else if (groupBy === 'date') {
      const order = ['Today', 'Last 7 Days', 'Last 30 Days', 'Earlier'];
      entries.sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
    } else if (groupBy === 'role') {
      const order = SUBLIMINAL_ROLES.map((r) => r.label);
      entries.sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
    } else if (groupBy === 'topic') {
      entries.sort(([a], [b]) => {
        if (a === 'Untagged Topics') return 1;
        if (b === 'Untagged Topics') return -1;
        return a.localeCompare(b);
      });
    } else if (groupBy === 'preset') {
      entries.sort(([a], [b]) => {
        if (a === 'Not in Any Stack Preset') return 1;
        if (b === 'Not in Any Stack Preset') return -1;
        return a.localeCompare(b);
      });
    } else {
      entries.sort(([a], [b]) => a.localeCompare(b));
    }

    return entries.map(([label, items]) => ({ key: label, label, items }));
  }, [filteredAndSortedVideos, groupBy, folders, presets]);

  const canReorderCards = sortBy === 'custom' && groupBy === 'none';

  const toggleGroupCollapsed = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLaunchSelected = () => {
    const chosen = videos.filter((v) => selectedIds.has(v.id));
    if (chosen.length > 0) {
      onLaunchMultiple(chosen);
      setSelectedIds(new Set());
    }
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onCreateFolder(newFolderName.trim());
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const openEdit = (video: YouTubeVideoItem) => {
    setEditingVideo(video);
    setEditTitle(video.title);
    setEditChannel(video.channel);
    setEditFolderId(video.folderId);
    setEditRole(video.role);
    setEditTopicsInput(video.topics.join(', '));
    setEditBenefits(video.benefits || video.notes);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideo || !editTitle.trim()) return;
    const cleanBenefits = editBenefits.trim();
    onUpdateVideo(editingVideo.id, {
      title: editTitle.trim(),
      channel: editChannel.trim() || 'YouTube',
      folderId: editFolderId || folders[0]?.id || 'fld_focus',
      role: editRole,
      topics: normalizeTopics(editTopicsInput),
      benefits: cleanBenefits,
      notes: cleanBenefits,
    });
    setEditingVideo(null);
  };

  const extractDraggedIds = (e: DragEvent): string[] => {
    if (draggingVideoIds.length > 0) return draggingVideoIds;
    try {
      const raw = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  };

  const handleCardDragStart = (videoId: string, e: DragEvent<HTMLElement>) => {
    const ids =
      selectedIds.has(videoId) && selectedIds.size > 1
        ? Array.from(selectedIds)
        : [videoId];
    setDraggingVideoIds(ids);
    e.dataTransfer.effectAllowed = 'copyMove';
    const serialized = JSON.stringify(ids);
    e.dataTransfer.setData(DRAG_MIME, serialized);
    e.dataTransfer.setData('text/plain', serialized);
  };

  const handleCardDragEnd = () => {
    setDraggingVideoIds([]);
    setDragOverFolderId(null);
    setDragOverPresetId(null);
    setDragOverCardId(null);
  };

  const handleFolderDrop = (folderId: string, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const ids = extractDraggedIds(e);
    if (ids.length > 0) {
      onMoveVideosToFolder(ids, folderId);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    }
    handleCardDragEnd();
  };

  const handlePresetDrop = (presetId: string, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const ids = extractDraggedIds(e);
    if (ids.length > 0) {
      onAppendVideosToPreset(ids, presetId);
    }
    handleCardDragEnd();
  };

  const handleCardDrop = (targetVideoId: string, e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    if (!canReorderCards) {
      handleCardDragEnd();
      return;
    }
    const ids = extractDraggedIds(e);
    if (ids.length > 0 && !ids.includes(targetVideoId)) {
      onReorderVideos(ids, targetVideoId);
    }
    handleCardDragEnd();
  };

  const gridClassForCardSize = useMemo(() => {
    switch (cardSize) {
      case 'compact':
        return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5';
      case 'small':
        return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3';
      case 'large':
        return 'grid grid-cols-1 lg:grid-cols-2 gap-5';
      case 'list':
        return 'flex flex-col gap-2';
      case 'medium':
      default:
        return 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4';
    }
  }, [cardSize]);

  const activeFolderLabel =
    selectedFolder === 'all'
      ? 'Subliminal & Frequency Library'
      : selectedFolder === 'favorites'
        ? 'Favorites'
        : folders.find((f) => f.id === selectedFolder)?.name ?? 'Folder';

  const totalLibraryLoops = useMemo(
    () => videos.reduce((sum, v) => sum + (v.loopCount || 0), 0),
    [videos]
  );
  const totalLibrarySeconds = useMemo(
    () => videos.reduce((sum, v) => sum + (v.listeningSeconds || 0), 0),
    [videos]
  );

  const renderVideoItem = (video: YouTubeVideoItem) => {
    const isSelected = selectedIds.has(video.id);
    const isDragging = draggingVideoIds.includes(video.id);
    const isDragOver = dragOverCardId === video.id && canReorderCards && !isDragging;
    const folderName =
      folders.find((f) => f.id === video.folderId)?.name ?? 'Uncategorized';
    const roleLabel = formatRoleLabel(video.role);
    const benefitsText = video.benefits || video.notes;
    const statsText = `${video.playCount} plays · ${video.loopCount} loops · ${formatListeningTime(
      video.listeningSeconds
    )}`;

    if (cardSize === 'list') {
      return (
        <article
          key={video.id}
          draggable
          onDragStart={(e) => handleCardDragStart(video.id, e)}
          onDragOver={(e) => {
            if (!canReorderCards) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!draggingVideoIds.includes(video.id)) {
              setDragOverCardId(video.id);
            }
          }}
          onDragLeave={() =>
            setDragOverCardId((prev) => (prev === video.id ? null : prev))
          }
          onDrop={(e) => handleCardDrop(video.id, e)}
          onDragEnd={handleCardDragEnd}
          className={`flex items-center gap-3 p-2.5 bg-[#0E121B] border rounded-lg transition-all ${
            isDragOver
              ? 'border-[#06E5F5] ring-1 ring-[#06E5F5]'
              : isSelected
                ? 'border-[#06E5F5]/70'
                : 'border-[#1E2638] hover:border-[#2C3752]'
          } ${isDragging ? 'opacity-45' : ''}`}
        >
          <span
            title="Drag to reorder or drop onto a folder or stack preset"
            className="text-slate-500 hover:text-[#06E5F5] cursor-grab active:cursor-grabbing shrink-0"
          >
            <GripVertical className="w-4 h-4" />
          </span>

          <button
            type="button"
            onClick={() => toggleSelect(video.id)}
            aria-label={isSelected ? `Deselect ${video.title}` : `Select ${video.title}`}
            className="text-slate-400 hover:text-[#06E5F5] shrink-0"
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-[#06E5F5]" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>

          <img
            src={getYouTubeThumbnailUrl(video.videoId)}
            alt={video.title}
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.src = STREAM_FALLBACK_BACKDROP;
            }}
            className="w-24 h-14 rounded object-cover shrink-0 bg-[#07090E] border border-[#1E2638]"
          />

          <div className="min-w-0 flex-1 space-y-0.5">
            <h3 className="text-sm font-semibold text-slate-100 truncate">{video.title}</h3>
            <p className="text-xs text-slate-400 truncate">
              {video.channel}
              <span aria-hidden="true" className="mx-1.5 text-slate-600">
                ·
              </span>
              <span className="text-slate-200">{roleLabel}</span>
              <span aria-hidden="true" className="mx-1.5 text-slate-600">
                ·
              </span>
              {folderName}
              {video.topics.length > 0 && (
                <>
                  <span aria-hidden="true" className="mx-1.5 text-slate-600">
                    ·
                  </span>
                  <span className="text-[#06E5F5]/90">{video.topics.join(', ')}</span>
                </>
              )}
            </p>
            <p className="text-[11px] font-mono tabular-nums text-slate-500 truncate">
              {statsText}
              {benefitsText && (
                <>
                  <span aria-hidden="true" className="mx-1.5 text-slate-600">
                    ·
                  </span>
                  <span className="font-sans text-slate-400/90">{benefitsText}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onToggleFavorite(video.id)}
              title={video.isFavorite ? 'Remove favorite' : 'Favorite'}
              className="p-1.5 text-slate-400 hover:text-[#F43F5E] rounded"
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  video.isFavorite ? 'fill-[#F43F5E] text-[#F43F5E]' : ''
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => onAddToStageAndSwitch(video)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] rounded transition-colors whitespace-nowrap"
            >
              <Play className="w-3 h-3 fill-current" />
              Stack
            </button>
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open YouTube URL"
              className="p-1.5 text-slate-400 hover:text-slate-100 rounded hidden sm:inline-flex"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={() => openEdit(video)}
              title="Edit details, topics & benefits"
              className="p-1.5 text-slate-400 hover:text-slate-100 rounded"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteVideo(video.id)}
              title="Delete entry"
              className="p-1.5 text-slate-400 hover:text-[#F43F5E] rounded"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </article>
      );
    }

    const isCompact = cardSize === 'compact';
    const isSmall = cardSize === 'small';
    const isLarge = cardSize === 'large';

    return (
      <article
        key={video.id}
        draggable
        onDragStart={(e) => handleCardDragStart(video.id, e)}
        onDragOver={(e) => {
          if (!canReorderCards) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (!draggingVideoIds.includes(video.id)) {
            setDragOverCardId(video.id);
          }
        }}
        onDragLeave={() =>
          setDragOverCardId((prev) => (prev === video.id ? null : prev))
        }
        onDrop={(e) => handleCardDrop(video.id, e)}
        onDragEnd={handleCardDragEnd}
        className={`flex flex-col bg-[#0E121B] border rounded-lg overflow-hidden transition-all cursor-grab active:cursor-grabbing ${
          isDragOver
            ? 'border-[#06E5F5] ring-2 ring-[#06E5F5]/45'
            : isSelected
              ? 'border-[#06E5F5]/70'
              : 'border-[#1E2638] hover:border-[#2C3752]'
        } ${isDragging ? 'opacity-45 scale-[0.98]' : ''}`}
      >
        <div className="relative aspect-video bg-[#07090E] overflow-hidden group">
          <img
            src={getYouTubeThumbnailUrl(video.videoId)}
            alt={video.title}
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.src = STREAM_FALLBACK_BACKDROP;
            }}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07090E]/90 via-transparent to-[#07090E]/40" />

          <div className="absolute top-2 left-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => toggleSelect(video.id)}
              aria-label={isSelected ? `Deselect ${video.title}` : `Select ${video.title}`}
              className="p-1 rounded bg-[#07090E]/80 text-slate-200 hover:text-[#06E5F5] transition-colors"
            >
              {isSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-[#06E5F5]" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
            </button>
            <span
              title="Drag to reorder or drop onto a folder or stack preset"
              className="p-1 rounded bg-[#07090E]/80 text-slate-400 group-hover:text-[#06E5F5] transition-colors"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </span>
          </div>

          <button
            type="button"
            onClick={() => onToggleFavorite(video.id)}
            aria-label={video.isFavorite ? 'Remove favorite' : 'Mark favorite'}
            className="absolute top-2 right-2 p-1 rounded bg-[#07090E]/80 text-slate-200 hover:text-[#F43F5E] transition-colors"
          >
            <Heart
              className={`w-3.5 h-3.5 ${
                video.isFavorite ? 'fill-[#F43F5E] text-[#F43F5E]' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => onAddToStageAndSwitch(video)}
            className={`absolute bottom-2 right-2 inline-flex items-center gap-1 font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] rounded transition-colors ${
              isCompact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            {isCompact ? 'Stack' : 'Add to Stack'}
          </button>
        </div>

        <div
          className={`flex-1 flex flex-col justify-between ${
            isCompact ? 'p-2.5 gap-1.5' : isSmall ? 'p-3 gap-2' : isLarge ? 'p-5 gap-3' : 'p-3.5 gap-2.5'
          }`}
        >
          <div className="space-y-1">
            <h3
              className={`font-semibold text-slate-100 ${
                isCompact
                  ? 'text-xs line-clamp-1'
                  : isSmall
                    ? 'text-xs line-clamp-2'
                    : isLarge
                      ? 'text-base line-clamp-2'
                      : 'text-sm line-clamp-2'
              }`}
            >
              {video.title}
            </h3>

            {/* Unboxed Clean Metadata Line (Zero Pill Enclosures) */}
            <p className={`${isCompact ? 'text-[11px]' : 'text-xs'} text-slate-400 truncate`}>
              {video.channel}
              <span aria-hidden="true" className="mx-1.5 text-slate-600">
                ·
              </span>
              <span className="text-slate-200">{roleLabel}</span>
              {!isCompact && (
                <>
                  <span aria-hidden="true" className="mx-1.5 text-slate-600">
                    ·
                  </span>
                  <span>{folderName}</span>
                </>
              )}
            </p>

            {/* Unboxed Topics List */}
            {video.topics.length > 0 && (
              <p className="text-[11px] text-[#06E5F5]/85 truncate">
                {video.topics.join(' · ')}
              </p>
            )}

            {/* Benefits / Affirmations Preview */}
            {!isCompact && benefitsText && (
              <p
                className={`text-xs text-slate-400/90 pt-0.5 ${
                  isLarge ? 'line-clamp-3' : 'line-clamp-2'
                }`}
              >
                {benefitsText}
              </p>
            )}
          </div>

          <div
            className={`flex items-center justify-between border-t border-[#182032] ${
              isCompact ? 'pt-1.5' : 'pt-2'
            }`}
          >
            <span className="text-[11px] font-mono tabular-nums text-slate-500 truncate">
              {isCompact
                ? `${video.loopCount}L · ${formatListeningTime(video.listeningSeconds)}`
                : statsText}
            </span>
            <div className="flex items-center gap-0.5 shrink-0">
              {!isCompact && (
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open YouTube URL"
                  className="p-1 text-slate-400 hover:text-slate-100 rounded"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => openEdit(video)}
                title="Edit metadata, topics & benefits"
                className="p-1 text-slate-400 hover:text-slate-100 rounded"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteVideo(video.id)}
                title="Delete entry"
                className="p-1 text-slate-400 hover:text-[#F43F5E] rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  };

  const isAnyDragActive = draggingVideoIds.length > 0;

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-56px-76px)] lg:overflow-hidden">
      {/* Hidden JSON Backup Import Input */}
      <input
        ref={backupInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportBackup(file);
          e.target.value = '';
        }}
      />

      {/* Pinned Independent-Scroll Left Sidebar */}
      {showSidebar && (
        <aside className="w-full lg:w-68 lg:h-full lg:overflow-y-auto shrink-0 border-b lg:border-b-0 lg:border-r border-[#1E2638] bg-[#0B0E17] p-4 space-y-5">
          <div className="space-y-1">
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
            <button
              type="button"
              onClick={() => setSelectedFolder('all')}
              className={`w-full flex items-center justify-between px-2.5 py-2 text-sm rounded-md transition-colors ${
                selectedFolder === 'all'
                  ? 'bg-[#141A29] text-[#06E5F5] font-medium'
                  : 'text-slate-300 hover:bg-[#111624] hover:text-slate-100'
              }`}
            >
              <span>All Subliminals</span>
              <span className="text-xs font-mono tabular-nums text-slate-400">{videos.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedFolder('favorites')}
              className={`w-full flex items-center justify-between px-2.5 py-2 text-sm rounded-md transition-colors ${
                selectedFolder === 'favorites'
                  ? 'bg-[#141A29] text-[#06E5F5] font-medium'
                  : 'text-slate-300 hover:bg-[#111624] hover:text-slate-100'
              }`}
            >
              <span>Favorites</span>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {videos.filter((v) => v.isFavorite).length}
              </span>
            </button>
          </div>

          {isAnyDragActive && (
            <div className="px-2.5 py-2 text-[11px] text-[#06E5F5] bg-[#06E5F5]/10 border border-[#06E5F5]/35 rounded-md">
              Drop {draggingVideoIds.length}{' '}
              {draggingVideoIds.length === 1 ? 'card' : 'cards'} onto any Folder to move, or onto a
              Stack Preset to append.
            </div>
          )}

          {/* Folders (Drop Targets) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2.5 mb-2">
              <p className="text-xs font-medium text-slate-400">Folders</p>
              <button
                type="button"
                onClick={() => setShowNewFolder((prev) => !prev)}
                title="New folder"
                className="p-1 text-slate-400 hover:text-[#06E5F5] rounded transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>

            {showNewFolder && (
              <form onSubmit={handleCreateFolderSubmit} className="px-1 mb-2 flex gap-1.5">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  autoFocus
                  className="w-full px-2.5 py-1.5 text-xs bg-[#07090E] border border-[#253047] rounded text-slate-100 focus:outline-none focus:border-[#06E5F5]"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 text-xs font-semibold bg-[#06E5F5] text-[#07090E] rounded shrink-0"
                >
                  Add
                </button>
              </form>
            )}

            {folders.map((folder) => {
              const count = videos.filter((v) => v.folderId === folder.id).length;
              const active = selectedFolder === folder.id;
              const isDropTarget = dragOverFolderId === folder.id;

              return (
                <div
                  key={folder.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverFolderId(folder.id);
                  }}
                  onDragLeave={() =>
                    setDragOverFolderId((prev) => (prev === folder.id ? null : prev))
                  }
                  onDrop={(e) => handleFolderDrop(folder.id, e)}
                  className={`group flex items-center justify-between rounded-md border transition-colors ${
                    isDropTarget
                      ? 'bg-[#06E5F5]/15 border-[#06E5F5] text-[#06E5F5]'
                      : active
                        ? 'bg-[#141A29] border-transparent text-[#06E5F5]'
                        : isAnyDragActive
                          ? 'border-dashed border-[#253047] text-slate-200 hover:border-[#06E5F5]'
                          : 'border-transparent text-slate-300 hover:bg-[#111624] hover:text-slate-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedFolder(folder.id)}
                    className="flex-1 flex items-center justify-between px-2.5 py-2 text-sm text-left min-w-0"
                  >
                    <span className="truncate font-medium">{folder.name}</span>
                    <span className="text-xs font-mono tabular-nums text-slate-400 ml-2">
                      {count}
                    </span>
                  </button>
                  {folders.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedFolder === folder.id) setSelectedFolder('all');
                        onDeleteFolder(folder.id);
                      }}
                      title="Delete folder"
                      className="opacity-0 group-hover:opacity-100 p-1.5 mr-1 text-slate-500 hover:text-[#F43F5E]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Saved Routine Stack Presets (Drop Targets) */}
          <div className="pt-4 border-t border-[#1E2638] space-y-2">
            <p className="text-xs font-medium text-slate-400 px-2.5">Routine Stack Presets</p>
            {presets.length === 0 ? (
              <p className="px-2.5 text-xs text-slate-500">No saved stacks yet.</p>
            ) : (
              <div className="space-y-1.5">
                {presets.map((preset) => {
                  const isDropTarget = dragOverPresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                        setDragOverPresetId(preset.id);
                      }}
                      onDragLeave={() =>
                        setDragOverPresetId((prev) => (prev === preset.id ? null : prev))
                      }
                      onDrop={(e) => handlePresetDrop(preset.id, e)}
                      className={`group flex items-center justify-between px-2.5 py-2 rounded-md border transition-colors ${
                        isDropTarget
                          ? 'bg-[#06E5F5]/15 border-[#06E5F5]'
                          : isAnyDragActive
                            ? 'bg-[#111624] border-dashed border-[#2C3752] hover:border-[#06E5F5]'
                            : 'bg-[#111624] border-[#1E2638] hover:border-[#2C3752]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onLoadPresetAndSwitch(preset)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="text-xs font-medium text-slate-100 truncate">
                          {preset.name}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-slate-400">
                          {preset.routine} · {preset.videoItemIds.length} tracks
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePreset(preset.id)}
                        title="Delete preset"
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-[#F43F5E]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Local JSON Backup & Restore */}
          <div className="pt-4 border-t border-[#1E2638] space-y-2">
            <p className="text-xs font-medium text-slate-400 px-2.5">Library Backup</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={onExportBackup}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#111624] hover:bg-[#172033] border border-[#1E2638] hover:border-[#2C3752] rounded-md transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#06E5F5]" />
                Export
              </button>
              <button
                type="button"
                onClick={() => backupInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#111624] hover:bg-[#172033] border border-[#1E2638] hover:border-[#2C3752] rounded-md transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-[#06E5F5]" />
                Import
              </button>
            </div>
            <p className="px-1 text-[11px] text-slate-500 leading-relaxed">
              Saves your URLs, topics, roles, benefits, stats, folders, and routine stacks as JSON.
            </p>
          </div>
        </aside>
      )}

      {/* Independently Scrollable Main Library Canvas */}
      <div className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Top Row: Title + Totals + Search + Batch Import */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {!showSidebar && (
              <button
                type="button"
                onClick={() => setShowSidebar(true)}
                title="Expand folders & stacks sidebar"
                className="p-2 text-slate-300 hover:text-[#06E5F5] bg-[#0E121B] border border-[#1E2638] rounded-md shrink-0"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-100 truncate">
                {activeFolderLabel}
              </h1>
              <p className="text-xs text-slate-400">
                <span className="font-mono tabular-nums">{filteredAndSortedVideos.length}</span>{' '}
                {filteredAndSortedVideos.length === 1 ? 'item' : 'items'}
                <span aria-hidden="true" className="mx-1.5 text-slate-600">
                  ·
                </span>
                <span className="font-mono tabular-nums">{totalLibraryLoops}</span> total loops
                <span aria-hidden="true" className="mx-1.5 text-slate-600">
                  ·
                </span>
                <span className="font-mono tabular-nums">
                  {formatListeningTime(totalLibrarySeconds)}
                </span>{' '}
                listened
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, creator, topic, benefits..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-[#0E121B] border border-[#1E2638] rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#06E5F5]"
              />
            </div>

            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Batch Import
            </button>
          </div>
        </div>

        {/* Control Toolbar: Creator, Role, Favorites, Benefits, Group By, Sort, Card Size */}
        <div className="bg-[#0E121B] border border-[#1E2638] rounded-lg p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                aria-label="Filter by creator"
                className="px-2.5 py-1.5 text-xs bg-[#07090E] border border-[#253047] rounded text-slate-200 focus:outline-none focus:border-[#06E5F5]"
              >
                <option value="all">Creator: All</option>
                {uniqueChannels.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>

              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                aria-label="Filter by role"
                className="px-2.5 py-1.5 text-xs bg-[#07090E] border border-[#253047] rounded text-slate-200 focus:outline-none focus:border-[#06E5F5]"
              >
                <option value="all">Role: All</option>
                {SUBLIMINAL_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setOnlyFavorites((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
                  onlyFavorites
                    ? 'bg-[#F43F5E]/15 text-[#F43F5E] border-[#F43F5E]/45'
                    : 'bg-[#07090E] text-slate-300 border-[#253047] hover:text-slate-100'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-current' : ''}`} />
                Favorites
              </button>

              <button
                type="button"
                onClick={() => setOnlyWithNotes((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap ${
                  onlyWithNotes
                    ? 'bg-[#06E5F5]/15 text-[#06E5F5] border-[#06E5F5]/45'
                    : 'bg-[#07090E] text-slate-300 border-[#253047] hover:text-slate-100'
                }`}
              >
                <StickyNote className="w-3.5 h-3.5" />
                Benefits
              </button>

              <span aria-hidden="true" className="hidden sm:inline-block h-4 w-px bg-[#1E2638] mx-0.5" />

              <select
                value={groupBy}
                onChange={(e) => {
                  setGroupBy(e.target.value as SavedUrlGroupBy);
                  setCollapsedGroups(new Set());
                }}
                aria-label="Group library items"
                className="px-2.5 py-1.5 text-xs bg-[#07090E] border border-[#253047] rounded text-slate-200 focus:outline-none focus:border-[#06E5F5]"
              >
                <option value="none">Group By: None</option>
                <option value="topic">Group By: Topic</option>
                <option value="creator">Group By: Creator</option>
                <option value="role">Group By: Role</option>
                <option value="folder">Group By: Folder</option>
                <option value="preset">Group By: Stack Preset</option>
                <option value="favorite">Group By: Favorite</option>
                <option value="date">Group By: Date Added</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SavedUrlSortBy)}
                aria-label="Sort library items"
                className="px-2.5 py-1.5 text-xs bg-[#07090E] border border-[#253047] rounded text-slate-200 focus:outline-none focus:border-[#06E5F5]"
              >
                <option value="custom">Sort: Custom Order</option>
                <option value="title">Sort: Title</option>
                <option value="channel">Sort: Creator</option>
                <option value="addedAt">Sort: Date Added</option>
                <option value="loops">Sort: Most Loops</option>
                <option value="listening">Sort: Listening Time</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs text-slate-400 hover:text-[#06E5F5] transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              )}
            </div>

            <div
              className="flex items-center gap-0.5 p-0.5 bg-[#07090E] border border-[#1E2638] rounded-md"
              role="group"
              aria-label="Card size options"
            >
              {CARD_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onCardSizeChange(opt.value)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    cardSize === opt.value
                      ? 'bg-[#172033] text-[#06E5F5]'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {opt.value === 'list' ? (
                    <List className="w-3 h-3" />
                  ) : opt.value === 'compact' ? (
                    <LayoutGrid className="w-3 h-3" />
                  ) : null}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Multi-Topic Filter Bar */}
          {uniqueTopics.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#182032]">
              <span className="text-[11px] font-medium text-slate-500 mr-1">Topics:</span>
              {uniqueTopics.map(({ label, count }) => {
                const active = selectedTopics.some(
                  (t) => t.toLowerCase() === label.toLowerCase()
                );
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleTopicFilter(label)}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded border transition-colors ${
                      active
                        ? 'bg-[#06E5F5]/15 text-[#06E5F5] border-[#06E5F5]/50'
                        : 'bg-[#07090E] text-slate-300 border-[#1E2638] hover:border-[#2C3752]'
                    }`}
                  >
                    {label}{' '}
                    <span className="font-mono tabular-nums text-slate-500">{count}</span>
                  </button>
                );
              })}

              {selectedTopics.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setTopicMatchMode((m) => (m === 'all' ? 'any' : 'all'))}
                  className="ml-auto px-2 py-0.5 text-[11px] font-mono text-[#06E5F5] bg-[#141A29] border border-[#253047] rounded"
                  title="Switch between matching ALL selected topics vs ANY selected topic"
                >
                  Match: {topicMatchMode === 'all' ? 'ALL' : 'ANY'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Multi-Select Launch Bar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#0E1522] border border-[#06E5F5]/40 rounded-lg">
            <p className="text-xs font-medium text-slate-100">
              <span className="font-mono tabular-nums text-[#06E5F5]">{selectedIds.size}</span>{' '}
              {selectedIds.size === 1 ? 'subliminal' : 'subliminals'} selected — load into Stack
              Mixer or drag to any sidebar folder or routine preset
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLaunchSelected}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] rounded transition-colors whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5" />
                Load in Stack Mixer
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 text-xs text-slate-300 hover:text-slate-100 bg-[#141A29] rounded"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Cards (Flat or Grouped) */}
        {filteredAndSortedVideos.length === 0 ? (
          <div className="bg-[#0E121B] border border-[#1E2638] rounded-lg p-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-200">
              {hasActiveFilters
                ? 'No subliminals match these filters'
                : 'Your subliminal library is empty'}
            </p>
            <p className="text-xs text-slate-400">
              {hasActiveFilters
                ? 'Try clearing a topic tag, role filter, or search query.'
                : 'Batch paste YouTube links with shared roles, topic tags, and benefits notes.'}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] rounded-md"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] rounded-md"
              >
                <Plus className="w-3.5 h-3.5" />
                Batch Import Subliminals
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {groupedSections.map((section) => {
              const isCollapsed = collapsedGroups.has(section.key);
              return (
                <section key={section.key} className="space-y-3">
                  {section.label && (
                    <div className="flex items-center justify-between border-b border-[#1E2638] pb-2">
                      <button
                        type="button"
                        onClick={() => toggleGroupCollapsed(section.key)}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100 hover:text-[#06E5F5] transition-colors"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                        <span>{section.label}</span>
                        <span className="text-xs font-mono tabular-nums text-slate-500">
                          {section.items.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onLaunchMultiple(section.items)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#06E5F5] bg-[#141A29] hover:bg-[#1C2438] border border-[#253047] rounded transition-colors"
                      >
                        <Layers className="w-3 h-3" />
                        Stack Group
                      </button>
                    </div>
                  )}

                  {!isCollapsed && (
                    <div className={gridClassForCardSize}>
                      {section.items.map((video) => renderVideoItem(video))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Subliminal Metadata Modal */}
      {editingVideo && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0E121B] border border-[#253047] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-100">Edit Subliminal Details</h2>
              <button
                type="button"
                onClick={() => setEditingVideo(null)}
                className="p-1 text-slate-400 hover:text-slate-100"
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
                  className="w-full px-3 py-2 text-xs bg-[#07090E] border border-[#253047] rounded-md text-slate-100 focus:outline-none focus:border-[#06E5F5]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs text-slate-400">Creator</label>
                  <input
                    type="text"
                    value={editChannel}
                    onChange={(e) => setEditChannel(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-[#07090E] border border-[#253047] rounded-md text-slate-100 focus:outline-none focus:border-[#06E5F5]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-slate-400">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as SubliminalRole)}
                    className="w-full px-2.5 py-2 text-xs bg-[#07090E] border border-[#253047] rounded-md text-slate-100 focus:outline-none focus:border-[#06E5F5]"
                  >
                    {SUBLIMINAL_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-slate-400">Folder</label>
                  <select
                    value={editFolderId}
                    onChange={(e) => setEditFolderId(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-[#07090E] border border-[#253047] rounded-md text-slate-100 focus:outline-none focus:border-[#06E5F5]"
                  >
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-slate-400">
                  Topic Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={editTopicsInput}
                  onChange={(e) => setEditTopicsInput(e.target.value)}
                  placeholder="Focus, Sleep, Confidence, 432Hz"
                  className="w-full px-3 py-2 text-xs bg-[#07090E] border border-[#253047] rounded-md text-slate-100 focus:outline-none focus:border-[#06E5F5]"
                />
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {SUGGESTED_TOPICS.slice(0, 8).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        const existing = normalizeTopics(editTopicsInput);
                        if (!existing.some((x) => x.toLowerCase() === t.toLowerCase())) {
                          setEditTopicsInput([...existing, t].join(', '));
                        }
                      }}
                      className="px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-[#06E5F5] bg-[#141A29] rounded"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-slate-400">
                  Benefits &amp; Affirmations
                </label>
                <textarea
                  rows={3}
                  value={editBenefits}
                  onChange={(e) => setEditBenefits(e.target.value)}
                  placeholder="Write benefits, affirmation list, or listening notes..."
                  className="w-full px-3 py-2 text-xs bg-[#07090E] border border-[#253047] rounded-md text-slate-100 focus:outline-none focus:border-[#06E5F5]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingVideo(null)}
                  className="px-3.5 py-2 text-xs text-slate-300 bg-[#141A29] rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] rounded-md"
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
