import type {
  AudioPlaylist,
  AudioTrackMeta,
  AudioTrackRecord,
  StorageSummary,
} from '../types/media';
import { createId, parseAudioFilename } from './format';
import {
  buildStarterOfflineTracks,
  COVER_CHROME_HORIZON,
  COVER_MIDNIGHT_OVERPASS,
  COVER_NEON_RAINDRIFT,
  COVER_SUBSTATION_PULSE,
} from './synthAudio';

const DB_NAME = 'kurodeck_audio_vault_v1';
const DB_VERSION = 1;
const STORE_TRACKS = 'tracks';
const STORE_PLAYLISTS = 'playlists';
const SEED_FLAG_KEY = 'kurodeck_audio_seeded_v1';

const FALLBACK_COVERS = [
  COVER_NEON_RAINDRIFT,
  COVER_SUBSTATION_PULSE,
  COVER_MIDNIGHT_OVERPASS,
  COVER_CHROME_HORIZON,
];

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
        db.createObjectStore(STORE_PLAYLISTS, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB vault'));
  });
}

function stripBlob(record: AudioTrackRecord): AudioTrackMeta {
  const { blob: _blob, ...meta } = record;
  return meta;
}

export async function initializeAudioVault(): Promise<{
  tracks: AudioTrackMeta[];
  playlists: AudioPlaylist[];
}> {
  const db = await openVaultDb();
  const alreadySeeded = localStorage.getItem(SEED_FLAG_KEY) === 'true';

  const existingTracks = await getAllTrackRecords(db);
  const existingPlaylists = await getAllPlaylistsRaw(db);

  if (!alreadySeeded && existingTracks.length === 0) {
    const defaultPlaylist: AudioPlaylist = {
      id: 'pl_night_drive',
      name: 'Night Drive',
      createdAt: Date.now(),
    };
    const starterTracks = buildStarterOfflineTracks(defaultPlaylist.id);

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_PLAYLISTS, STORE_TRACKS], 'readwrite');
      tx.objectStore(STORE_PLAYLISTS).put(defaultPlaylist);
      for (const track of starterTracks) {
        tx.objectStore(STORE_TRACKS).put(track);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    localStorage.setItem(SEED_FLAG_KEY, 'true');
    return {
      tracks: starterTracks.map(stripBlob),
      playlists: [defaultPlaylist],
    };
  }

  // Migrate legacy /src/assets/images/ cover URLs to precached /assets/images/
  const migratedTracks: AudioTrackRecord[] = [];
  let needsMigration = false;
  for (const track of existingTracks) {
    if (track.coverUrl.startsWith('/src/assets/images/')) {
      needsMigration = true;
      migratedTracks.push({
        ...track,
        coverUrl: track.coverUrl.replace('/src/assets/images/', '/assets/images/'),
      });
    } else {
      migratedTracks.push(track);
    }
  }

  if (needsMigration) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readwrite');
      const store = tx.objectStore(STORE_TRACKS);
      for (const track of migratedTracks) {
        store.put(track);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  localStorage.setItem(SEED_FLAG_KEY, 'true');
  return {
    tracks: migratedTracks.map(stripBlob),
    playlists: existingPlaylists,
  };
}

function getAllTrackRecords(db: IDBDatabase): Promise<AudioTrackRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readonly');
    const req = tx.objectStore(STORE_TRACKS).getAll();
    req.onsuccess = () => resolve((req.result as AudioTrackRecord[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

function getAllPlaylistsRaw(db: IDBDatabase): Promise<AudioPlaylist[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PLAYLISTS, 'readonly');
    const req = tx.objectStore(STORE_PLAYLISTS).getAll();
    req.onsuccess = () => resolve((req.result as AudioPlaylist[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

function probeAudioDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;

    const finish = (dur: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(dur) && dur > 0 ? dur : 0);
    };

    const timer = window.setTimeout(() => finish(0), 4000);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      finish(audio.duration);
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      finish(0);
    };
    audio.src = url;
  });
}

export async function importAudioFiles(
  files: File[],
  playlistId: string | null = null
): Promise<AudioTrackMeta[]> {
  const db = await openVaultDb();
  const imported: AudioTrackMeta[] = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const parsed = parseAudioFilename(file.name);
    const duration = await probeAudioDuration(file);
    const coverUrl = FALLBACK_COVERS[(Date.now() + i) % FALLBACK_COVERS.length];

    const record: AudioTrackRecord = {
      id: createId('trk'),
      title: parsed.title,
      artist: parsed.artist,
      album: 'Offline Vault',
      genre: 'Digital Audio',
      duration,
      fileSize: file.size,
      mimeType: file.type || 'audio/mpeg',
      format: parsed.format,
      playlistId,
      coverUrl,
      addedAt: Date.now() + i,
      playCount: 0,
      isFavorite: false,
      blob: file,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readwrite');
      tx.objectStore(STORE_TRACKS).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    imported.push(stripBlob(record));
  }

  return imported;
}

export async function getTrackBlob(trackId: string): Promise<Blob | null> {
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readonly');
    const req = tx.objectStore(STORE_TRACKS).get(trackId);
    req.onsuccess = () => {
      const rec = req.result as AudioTrackRecord | undefined;
      resolve(rec?.blob ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function updateTrackMeta(
  trackId: string,
  updates: Partial<Omit<AudioTrackMeta, 'id'>>
): Promise<AudioTrackMeta | null> {
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readwrite');
    const store = tx.objectStore(STORE_TRACKS);
    const req = store.get(trackId);

    req.onsuccess = () => {
      const existing = req.result as AudioTrackRecord | undefined;
      if (!existing) {
        resolve(null);
        return;
      }
      const next: AudioTrackRecord = { ...existing, ...updates };
      store.put(next);
      tx.oncomplete = () => resolve(stripBlob(next));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTrack(trackId: string): Promise<void> {
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TRACKS, 'readwrite');
    tx.objectStore(STORE_TRACKS).delete(trackId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function createPlaylist(name: string): Promise<AudioPlaylist> {
  const db = await openVaultDb();
  const playlist: AudioPlaylist = {
    id: createId('pl'),
    name: name.trim(),
    createdAt: Date.now(),
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PLAYLISTS, 'readwrite');
    tx.objectStore(STORE_PLAYLISTS).put(playlist);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return playlist;
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  const db = await openVaultDb();
  const tracks = await getAllTrackRecords(db);

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_PLAYLISTS, STORE_TRACKS], 'readwrite');
    tx.objectStore(STORE_PLAYLISTS).delete(playlistId);
    const trackStore = tx.objectStore(STORE_TRACKS);
    for (const track of tracks) {
      if (track.playlistId === playlistId) {
        trackStore.put({ ...track, playlistId: null });
      }
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStorageSummary(tracks: AudioTrackMeta[]): Promise<StorageSummary> {
  const vaultBytes = tracks.reduce((sum, t) => sum + (t.fileSize || 0), 0);
  let usedBytes = vaultBytes;
  let quotaBytes = 512 * 1024 * 1024;

  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      if (typeof est.usage === 'number') usedBytes = est.usage;
      if (typeof est.quota === 'number' && est.quota > 0) quotaBytes = est.quota;
    } catch {
      // ignore storage estimate errors in restricted contexts
    }
  }

  return {
    usedBytes,
    quotaBytes,
    vaultBytes,
    trackCount: tracks.length,
  };
}
