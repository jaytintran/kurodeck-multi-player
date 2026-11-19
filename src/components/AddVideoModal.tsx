import { useMemo, useState } from 'react';
import { Link2, Plus, WifiOff, X } from 'lucide-react';
import {
  extractYouTubeVideoId,
  normalizeTopics,
  SUBLIMINAL_ROLES,
  SUGGESTED_TOPICS,
} from '../lib/youtube';
import type { SubliminalRole, YouTubeFolder } from '../types/media';

interface AddVideoModalProps {
  folders: YouTubeFolder[];
  existingTopics: string[];
  isOnline: boolean;
  onClose: () => void;
  onSubmitUrls: (payload: {
    rawInput: string;
    folderId: string;
    role: SubliminalRole;
    topics: string[];
    customTitle: string;
    benefits: string;
    launchToStage: boolean;
  }) => Promise<{ addedCount: number; error: string | null }>;
}

export function AddVideoModal({
  folders,
  existingTopics,
  isOnline,
  onClose,
  onSubmitUrls,
}: AddVideoModalProps) {
  const [rawInput, setRawInput] = useState('');
  const [folderId, setFolderId] = useState(folders[0]?.id ?? 'fld_focus');
  const [role, setRole] = useState<SubliminalRole>('subliminal');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopicsInput, setCustomTopicsInput] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [benefits, setBenefits] = useState('');
  const [launchToStage, setLaunchToStage] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectedCount = useMemo(() => {
    const lines = rawInput
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const ids = new Set<string>();
    for (const line of lines) {
      const id = extractYouTubeVideoId(line);
      if (id) ids.add(id);
    }
    return ids.size;
  }, [rawInput]);

  const topicChoices = useMemo(() => {
    return normalizeTopics([...existingTopics, ...SUGGESTED_TOPICS]).slice(0, 16);
  }, [existingTopics]);

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) =>
      prev.some((t) => t.toLowerCase() === topic.toLowerCase())
        ? prev.filter((t) => t.toLowerCase() !== topic.toLowerCase())
        : [...prev, topic]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawInput.trim()) return;
    setError(null);
    setIsSubmitting(true);

    const mergedTopics = normalizeTopics([
      ...selectedTopics,
      ...normalizeTopics(customTopicsInput),
    ]);

    const result = await onSubmitUrls({
      rawInput,
      folderId,
      role,
      topics: mergedTopics,
      customTitle,
      benefits,
      launchToStage,
    });
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#0E121B] border border-[#253047] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#06E5F5]" />
            <h2 className="text-base font-semibold text-slate-100">
              Add Subliminal &amp; Frequency URLs
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-slate-400 hover:text-slate-100 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isOnline && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-200 bg-[#18140B] border border-amber-500/40 rounded-md">
            <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              You are offline — URLs will be saved now and titles/creators will auto-fetch when you
              reconnect.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-300">
                YouTube URL(s) or Video IDs (paste multiple lines for batch import)
              </label>
              {detectedCount > 0 && (
                <span className="text-[11px] font-mono tabular-nums text-[#06E5F5]">
                  {detectedCount} {detectedCount === 1 ? 'URL' : 'URLs'} detected
                </span>
              )}
            </div>
            <textarea
              rows={3}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder={`https://www.youtube.com/watch?v=4xDzrJKXOOY\nhttps://youtu.be/Et7O5-CzJZg`}
              required
              autoFocus
              className="w-full px-3 py-2 text-xs font-mono bg-[#07090E] border border-[#253047] rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#06E5F5]"
            />
          </div>

          {/* Shared Folder + Role + Optional Title */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Shared Folder</label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-[#07090E] border border-[#253047] rounded-md text-slate-100 focus:outline-none focus:border-[#06E5F5]"
              >
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as SubliminalRole)}
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
              <label className="block text-xs text-slate-400">
                Title (optional, 1 URL)
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                disabled={detectedCount > 1}
                placeholder={detectedCount > 1 ? 'Auto-fetched per video' : 'Auto-fetched'}
                className="w-full px-2.5 py-2 text-xs bg-[#07090E] border border-[#253047] rounded-md text-slate-100 placeholder:text-slate-500 disabled:opacity-50 focus:outline-none focus:border-[#06E5F5]"
              />
            </div>
          </div>

          {/* Shared Topic Tags */}
          <div className="space-y-2">
            <label className="block text-xs text-slate-400">
              Topic Tags (applied to all pasted URLs)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {topicChoices.map((topic) => {
                const active = selectedTopics.some(
                  (t) => t.toLowerCase() === topic.toLowerCase()
                );
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors ${
                      active
                        ? 'bg-[#06E5F5]/15 text-[#06E5F5] border-[#06E5F5]/50'
                        : 'bg-[#07090E] text-slate-300 border-[#1E2638] hover:border-[#2C3752]'
                    }`}
                  >
                    {topic}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={customTopicsInput}
              onChange={(e) => setCustomTopicsInput(e.target.value)}
              placeholder="Add custom topics separated by commas (e.g., Memory, Calm, Delta)"
              className="w-full px-3 py-1.5 text-xs bg-[#07090E] border border-[#253047] rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#06E5F5]"
            />
          </div>

          {/* Benefits / Affirmations */}
          <div className="space-y-1">
            <label className="block text-xs text-slate-400">
              Benefits &amp; Affirmations Notes (optional)
            </label>
            <textarea
              rows={2}
              value={benefits}
              onChange={(e) => setBenefits(e.target.value)}
              placeholder="List key benefits, frequency Hz, or affirmation highlights..."
              className="w-full px-3 py-2 text-xs bg-[#07090E] border border-[#253047] rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#06E5F5]"
            />
          </div>

          <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={launchToStage}
              onChange={(e) => setLaunchToStage(e.target.checked)}
              className="accent-[#06E5F5] w-4 h-4 rounded"
            />
            <span>Add directly to Stack Mixer for simultaneous playback</span>
          </label>

          {error && <p className="text-xs text-[#F43F5E]">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 bg-[#141A29] hover:bg-[#1C2438] rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#07090E] bg-[#06E5F5] hover:bg-[#38EEFF] disabled:opacity-50 rounded-md"
            >
              <Plus className="w-3.5 h-3.5" />
              {isSubmitting
                ? 'Saving...'
                : detectedCount > 1
                  ? `Import ${detectedCount} URLs`
                  : 'Save & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
