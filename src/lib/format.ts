export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }
  return `${value >= 100 || unitIdx === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIdx]}`;
}

export function parseAudioFilename(filename: string): {
  title: string;
  artist: string;
  format: string;
} {
  const dotIdx = filename.lastIndexOf('.');
  const ext = dotIdx > 0 ? filename.slice(dotIdx + 1).toUpperCase() : 'AUDIO';
  const base = (dotIdx > 0 ? filename.slice(0, dotIdx) : filename)
    .replace(/_/g, ' ')
    .replace(/^\d{1,3}\s*[-.]\s*/, '')
    .trim();

  const dashParts = base.split(/\s+[-–—]\s+/);
  if (dashParts.length >= 2) {
    return {
      artist: dashParts[0].trim() || 'Unknown Artist',
      title: dashParts.slice(1).join(' - ').trim() || base,
      format: ext.slice(0, 6),
    };
  }

  return {
    artist: 'Local Import',
    title: base || 'Untitled Audio',
    format: ext.slice(0, 6),
  };
}

export function formatRelativeDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
