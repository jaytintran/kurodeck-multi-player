import { useState } from 'react';
import { Link2, Plus, X } from 'lucide-react';
import type { YouTubeFolder } from '../types/media';

interface AddVideoModalProps {
  folders: YouTubeFolder[];
  onClose: () => void;
  onSubmitUrls: (payload: {
    rawInput: string;
    folderId: string;
    customTitle: string;
    notes: string;
    launchToStage: boolean;
  }) => Promise<{ addedCount: number; error: string | null }>;
}

export function AddVideoModal({ folders, onClose, onSubmitUrls }: AddVideoModalProps) {
  const [rawInput, setRawInput] = useState('');
  const [folderId, setFolderId] = useState(folders[0]?.id ?? 'fld_ambience');
  const [customTitle, setCustomTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [launchToStage, setLaunchToStage] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawInput.trim()) return;
    setError(null);
    setIsSubmitting(true);
    const result = await onSubmitUrls({
      rawInput,
      folderId,
      customTitle,
      notes,
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
      <div className="w-full max-w-lg bg-[#0E121B] border border-[#253047] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[#06E5F5]" />
            <h2 className="text-base font-semibold text-slate-100">Add YouTube Stream URLs</h2>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              YouTube URL(s) or Video IDs (one per line for batch multi-stream)
            </label>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs text-slate-400">Folder</label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#07090E] border border-[#253047] rounded-md text-slate-100 focus:outline-none focus:border-[#06E5F5]"
              >
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-slate-400">
                Custom Title (optional, single URL)
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Auto-fetched from YouTube"
                className="w-full px-3 py-2 text-xs bg-[#07090E] border border-[#253047] rounded-md text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#06E5F5]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs text-slate-400">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Ambient rain visual feed for late night sessions"
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
            <span>Add directly to Multi-Stream stage for simultaneous playback</span>
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
              {isSubmitting ? 'Resolving URLs...' : 'Save & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
