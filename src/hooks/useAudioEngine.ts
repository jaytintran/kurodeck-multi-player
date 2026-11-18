import { useCallback, useEffect, useRef, useState } from 'react';
import { getTrackBlob } from '../lib/audioDb';
import type { AudioTrackMeta, EqSettings, RepeatMode } from '../types/media';

interface UseAudioEngineOptions {
  tracks: AudioTrackMeta[];
  onTrackPlayCountIncrement?: (trackId: string) => void;
}

export function useAudioEngine({ tracks, onTrackPlayCountIncrement }: UseAudioEngineOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const midFilterRef = useRef<BiquadFilterNode | null>(null);
  const trebleFilterRef = useRef<BiquadFilterNode | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const currentTrackIdRef = useRef<string | null>(null);
  const tracksRef = useRef<AudioTrackMeta[]>(tracks);
  tracksRef.current = tracks;

  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.82);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [eq, setEq] = useState<EqSettings>({
    bass: 2,
    mid: 0,
    treble: 1.5,
    enabled: true,
  });

  const shuffleRef = useRef(shuffle);
  shuffleRef.current = shuffle;
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;
  const queueIdsRef = useRef(queueIds);
  queueIdsRef.current = queueIds;

  // Ensure single persistent audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    audio.volume = volume;
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      setIsPlaying(false);
      setIsLoadingTrack(false);
      setErrorMessage('Could not decode this audio file.');
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureWebAudioGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!audioCtxRef.current) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;

      const ctx = new AudioContextCtor();
      const source = ctx.createMediaElementSource(audio);

      const bass = ctx.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 120;
      bass.gain.value = eq.enabled ? eq.bass : 0;

      const mid = ctx.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = 1100;
      mid.Q.value = 1.0;
      mid.gain.value = eq.enabled ? eq.mid : 0;

      const treble = ctx.createBiquadFilter();
      treble.type = 'highshelf';
      treble.frequency.value = 7500;
      treble.gain.value = eq.enabled ? eq.treble : 0;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;

      source.connect(bass);
      bass.connect(mid);
      mid.connect(treble);
      treble.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      bassFilterRef.current = bass;
      midFilterRef.current = mid;
      trebleFilterRef.current = treble;
      analyserRef.current = analyser;
    }

    if (audioCtxRef.current?.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
  }, [eq.bass, eq.enabled, eq.mid, eq.treble]);

  // Apply EQ changes live
  useEffect(() => {
    if (bassFilterRef.current) {
      bassFilterRef.current.gain.value = eq.enabled ? eq.bass : 0;
    }
    if (midFilterRef.current) {
      midFilterRef.current.gain.value = eq.enabled ? eq.mid : 0;
    }
    if (trebleFilterRef.current) {
      trebleFilterRef.current.gain.value = eq.enabled ? eq.treble : 0;
    }
  }, [eq]);

  // Sync volume & mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Sync playback rate
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const playTrack = useCallback(
    async (trackId: string, customQueue?: string[]) => {
      const audio = audioRef.current;
      if (!audio) return;

      setErrorMessage(null);
      if (customQueue && customQueue.length > 0) {
        setQueueIds(customQueue);
      } else if (queueIdsRef.current.length === 0) {
        setQueueIds(tracksRef.current.map((t) => t.id));
      }

      // If same track is already loaded, simply resume
      if (currentTrackIdRef.current === trackId && objectUrlRef.current) {
        ensureWebAudioGraph();
        try {
          await audio.play();
        } catch {
          setErrorMessage('Click Play again to start audio output.');
        }
        return;
      }

      setIsLoadingTrack(true);
      try {
        const blob = await getTrackBlob(trackId);
        if (!blob) {
          setIsLoadingTrack(false);
          setErrorMessage('Offline audio file could not be found in local vault.');
          return;
        }

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        const nextUrl = URL.createObjectURL(blob);
        objectUrlRef.current = nextUrl;
        currentTrackIdRef.current = trackId;
        setCurrentTrackId(trackId);

        const trackMeta = tracksRef.current.find((t) => t.id === trackId);
        setDuration(trackMeta?.duration ?? 0);
        setCurrentTime(0);

        ensureWebAudioGraph();
        audio.src = nextUrl;
        audio.playbackRate = playbackRate;
        audio.load();
        await audio.play();
        setIsLoadingTrack(false);
        onTrackPlayCountIncrement?.(trackId);
      } catch {
        setIsLoadingTrack(false);
        setErrorMessage('Playback blocked or unsupported audio format.');
      }
    },
    [ensureWebAudioGraph, onTrackPlayCountIncrement, playbackRate]
  );

  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrackIdRef.current) {
      const firstTrack = tracksRef.current[0];
      if (firstTrack) {
        await playTrack(
          firstTrack.id,
          tracksRef.current.map((t) => t.id)
        );
      }
      return;
    }

    if (audio.paused) {
      ensureWebAudioGraph();
      try {
        await audio.play();
      } catch {
        setErrorMessage('Unable to resume audio playback.');
      }
    } else {
      audio.pause();
    }
  }, [ensureWebAudioGraph, playTrack]);

  const playNext = useCallback(
    async (triggeredByEnd = false) => {
      const activeQueue =
        queueIdsRef.current.length > 0
          ? queueIdsRef.current.filter((id) => tracksRef.current.some((t) => t.id === id))
          : tracksRef.current.map((t) => t.id);

      if (activeQueue.length === 0) return;

      const curId = currentTrackIdRef.current;
      if (triggeredByEnd && repeatRef.current === 'one' && curId && audioRef.current) {
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
        return;
      }

      if (shuffleRef.current && activeQueue.length > 1) {
        const candidates = activeQueue.filter((id) => id !== curId);
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        if (pick) {
          await playTrack(pick, activeQueue);
        }
        return;
      }

      const curIdx = curId ? activeQueue.indexOf(curId) : -1;
      const nextIdx = curIdx + 1;

      if (nextIdx < activeQueue.length) {
        await playTrack(activeQueue[nextIdx], activeQueue);
      } else if (repeatRef.current === 'all' || !triggeredByEnd) {
        await playTrack(activeQueue[0], activeQueue);
      } else {
        setIsPlaying(false);
      }
    },
    [playTrack]
  );

  const playPrevious = useCallback(async () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    const activeQueue =
      queueIdsRef.current.length > 0
        ? queueIdsRef.current.filter((id) => tracksRef.current.some((t) => t.id === id))
        : tracksRef.current.map((t) => t.id);

    if (activeQueue.length === 0) return;

    const curId = currentTrackIdRef.current;
    const curIdx = curId ? activeQueue.indexOf(curId) : 0;
    const prevIdx = (curIdx - 1 + activeQueue.length) % activeQueue.length;
    await playTrack(activeQueue[prevIdx], activeQueue);
  }, [playTrack]);

  // Attach ended handler dynamically
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => {
      void playNext(true);
    };
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [playNext]);

  const seek = useCallback((timeSec: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(timeSec, audio.duration || duration || 0));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, [duration]);

  const setVolume = useCallback((nextVolume: number) => {
    const clamped = Math.max(0, Math.min(1, nextVolume));
    setVolumeState(clamped);
    if (clamped > 0) setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  }, []);

  const cyclePlaybackRate = useCallback(() => {
    const rates = [0.75, 1, 1.25, 1.5];
    setPlaybackRateState((prev) => {
      const idx = rates.indexOf(prev);
      return rates[(idx + 1) % rates.length];
    });
  }, []);

  const addToQueue = useCallback((trackId: string) => {
    setQueueIds((prev) => (prev.includes(trackId) ? prev : [...prev, trackId]));
  }, []);

  const removeFromQueue = useCallback((trackId: string) => {
    setQueueIds((prev) => prev.filter((id) => id !== trackId));
  }, []);

  const stopIfDeleted = useCallback((deletedTrackId: string) => {
    setQueueIds((prev) => prev.filter((id) => id !== deletedTrackId));
    if (currentTrackIdRef.current === deletedTrackId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      currentTrackIdRef.current = null;
      setCurrentTrackId(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, []);

  const currentTrack = tracks.find((t) => t.id === currentTrackId) ?? null;

  return {
    analyserRef,
    currentTrack,
    currentTrackId,
    queueIds,
    isPlaying,
    isLoadingTrack,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackRate,
    shuffle,
    repeat,
    eq,
    errorMessage,
    playTrack,
    togglePlayPause,
    playNext,
    playPrevious,
    seek,
    setVolume,
    toggleMute,
    setShuffle,
    cycleRepeat,
    cyclePlaybackRate,
    setEq,
    addToQueue,
    removeFromQueue,
    stopIfDeleted,
  };
}
