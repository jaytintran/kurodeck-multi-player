import { useState } from 'react';
import {
  Disc3,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { formatDuration } from '../lib/format';
import type { AudioTrackMeta, EqSettings, RepeatMode } from '../types/media';

interface AudioTransportBarProps {
  currentTrack: AudioTrackMeta | null;
  tracks: AudioTrackMeta[];
  queueIds: string[];
  isPlaying: boolean;
  isLoadingTrack: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  shuffle: boolean;
  repeat: RepeatMode;
  eq: EqSettings;
  errorMessage: string | null;
  onTogglePlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onCyclePlaybackRate: () => void;
  onEqChange: (eq: EqSettings) => void;
  onPlayTrack: (trackId: string) => void;
  onRemoveFromQueue: (trackId: string) => void;
}

const EQ_PRESETS: Array<{ label: string; bass: number; mid: number; treble: number }> = [
  { label: 'Flat', bass: 0, mid: 0, treble: 0 },
  { label: 'Deep Bass', bass: 6, mid: -1, treble: 2 },
  { label: 'Cyber Synth', bass: 3.5, mid: -1.5, treble: 4 },
  { label: 'Vocal Focus', bass: -2, mid: 4, treble: 1.5 },
];

export function AudioTransportBar({
  currentTrack,
  tracks,
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
  onTogglePlayPause,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onCyclePlaybackRate,
  onEqChange,
  onPlayTrack,
  onRemoveFromQueue,
}: AudioTransportBarProps) {
  const [openDrawer, setOpenDrawer] = useState<'none' | 'eq' | 'queue'>('none');

  const queueTracks = queueIds
    .map((id) => tracks.find((t) => t.id === id))
    .filter((t): t is AudioTrackMeta => Boolean(t));

  const safeDuration = duration || currentTrack?.duration || 0;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-[#0B0E17]/95 backdrop-blur-md border-t border-[#1E2638]">
      {/* Popover Drawers for EQ and Queue */}
      {openDrawer === 'eq' && (
        <div className="absolute bottom-full right-4 sm:right-6 mb-2 w-80 bg-[#0E121B] border border-[#253047] rounded-lg p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">3-Band Equalizer</h3>
              <button
                type="button"
                onClick={() => onEqChange({ ...eq, enabled: !eq.enabled })}
                className={`text-xs font-medium px-2 py-0.5 rounded border transition-colors ${
                  eq.enabled
                    ? 'text-[#06E5F5] border-[#06E5F5]/40 bg-[#06E5F5]/10'
                    : 'text-slate-400 border-[#253047] bg-[#141A29]'
                }`}
              >
                {eq.enabled ? 'On' : 'Bypassed'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setOpenDrawer('none')}
              className="p-1 text-slate-400 hover:text-slate-100 rounded"
              aria-label="Close equalizer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5 mb-4">
            {EQ_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  onEqChange({
                    bass: preset.bass,
                    mid: preset.mid,
                    treble: preset.treble,
                    enabled: true,
                  })
                }
                className="px-2 py-1.5 text-[11px] font-medium text-slate-300 bg-[#141A29] hover:bg-[#1C2438] hover:text-slate-100 border border-[#1E2638] rounded transition-colors whitespace-nowrap"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {(
              [
                { key: 'bass', label: 'Low (120 Hz)' },
                { key: 'mid', label: 'Mid (1.1 kHz)' },
                { key: 'treble', label: 'High (7.5 kHz)' },
              ] as const
            ).map((band) => (
              <div key={band.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{band.label}</span>
                  <span className="font-mono tabular-nums text-[#06E5F5]">
                    {eq[band.key] > 0 ? `+${eq[band.key].toFixed(1)}` : eq[band.key].toFixed(1)} dB
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
      )}

      {openDrawer === 'queue' && (
        <div className="absolute bottom-full right-4 sm:right-6 mb-2 w-80 sm:w-96 max-h-80 flex flex-col bg-[#0E121B] border border-[#253047] rounded-lg shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E2638]">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Playback Queue</h3>
              <p className="text-xs text-slate-400 font-mono tabular-nums">
                {queueTracks.length} {queueTracks.length === 1 ? 'track' : 'tracks'} queued
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpenDrawer('none')}
              className="p-1 text-slate-400 hover:text-slate-100 rounded"
              aria-label="Close queue"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto divide-y divide-[#182032]">
            {queueTracks.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Select any offline track to populate your playback queue.
              </div>
            ) : (
              queueTracks.map((track) => {
                const isActive = currentTrack?.id === track.id;
                return (
                  <div
                    key={track.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 text-xs transition-colors ${
                      isActive ? 'bg-[#06E5F5]/10 text-[#06E5F5]' : 'hover:bg-[#141A29] text-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onPlayTrack(track.id)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                    >
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded object-cover shrink-0 bg-[#141A29]"
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{track.title}</p>
                        <p className="text-[11px] text-slate-400 truncate">{track.artist}</p>
                      </div>
                    </button>
                    <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                      {formatDuration(track.duration)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveFromQueue(track.id)}
                      className="p-1 text-slate-500 hover:text-[#F43F5E]"
                      title="Remove from queue"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Main Transport Bar */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-[68px] sm:h-[76px] grid grid-cols-12 items-center gap-3">
        {/* Track Info (Left) */}
        <div className="col-span-5 sm:col-span-4 lg:col-span-3 flex items-center gap-3 min-w-0">
          {currentTrack ? (
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded object-cover border border-[#253047] shrink-0"
            />
          ) : (
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded bg-[#141A29] border border-[#1E2638] flex items-center justify-center shrink-0">
              <Disc3 className="w-5 h-5 text-slate-500" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-medium text-slate-100 truncate">
              {currentTrack ? currentTrack.title : 'No track selected'}
            </p>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate">
              {errorMessage ? (
                <span className="text-[#F43F5E]">{errorMessage}</span>
              ) : currentTrack ? (
                <>
                  {currentTrack.artist}
                  <span aria-hidden="true" className="mx-1.5 text-slate-600">
                    ·
                  </span>
                  <span className="font-mono text-slate-500">{currentTrack.format}</span>
                </>
              ) : (
                'Choose a file from Audio Vault'
              )}
            </p>
          </div>
        </div>

        {/* Transport & Scrubber (Center) */}
        <div className="col-span-7 sm:col-span-5 lg:col-span-6 flex flex-col items-center justify-center gap-1.5">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onToggleShuffle}
              title="Toggle shuffle"
              className={`hidden sm:inline-flex p-1.5 rounded transition-colors ${
                shuffle ? 'text-[#06E5F5]' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onPrevious}
              aria-label="Previous track"
              className="p-1.5 text-slate-300 hover:text-slate-100 rounded transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onTogglePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-9 h-9 rounded-md bg-[#06E5F5] hover:bg-[#38EEFF] text-[#07090E] flex items-center justify-center transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-white"
            >
              {isLoadingTrack ? (
                <div className="w-4 h-4 border-2 border-[#07090E]/30 border-t-[#07090E] rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              aria-label="Next track"
              className="p-1.5 text-slate-300 hover:text-slate-100 rounded transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onCycleRepeat}
              title={`Repeat: ${repeat}`}
              className={`hidden sm:inline-flex p-1.5 rounded transition-colors ${
                repeat !== 'off' ? 'text-[#06E5F5]' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {repeat === 'one' ? <Repeat1 className="w-3.5 h-3.5" /> : <Repeat className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="w-full max-w-xl flex items-center gap-2">
            <span className="text-[11px] font-mono tabular-nums text-slate-400 w-9 text-right shrink-0">
              {formatDuration(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={safeDuration || 1}
              step={0.1}
              value={Math.min(currentTime, safeDuration || 1)}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="Seek track position"
              className="cyber-range flex-1"
            />
            <span className="text-[11px] font-mono tabular-nums text-slate-400 w-9 shrink-0">
              {formatDuration(safeDuration)}
            </span>
          </div>
        </div>

        {/* Speed, EQ, Queue & Volume (Right) */}
        <div className="hidden sm:flex sm:col-span-3 items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCyclePlaybackRate}
            title="Cycle playback speed"
            className="px-2 py-1 text-[11px] font-mono tabular-nums text-slate-300 hover:text-[#06E5F5] bg-[#141A29] border border-[#1E2638] rounded transition-colors whitespace-nowrap shrink-0"
          >
            {playbackRate}x
          </button>

          <button
            type="button"
            onClick={() => setOpenDrawer((prev) => (prev === 'eq' ? 'none' : 'eq'))}
            title="Equalizer"
            className={`p-2 rounded border transition-colors ${
              openDrawer === 'eq'
                ? 'bg-[#06E5F5]/15 text-[#06E5F5] border-[#06E5F5]/40'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-100'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setOpenDrawer((prev) => (prev === 'queue' ? 'none' : 'queue'))}
            title="Playback queue"
            className={`p-2 rounded border transition-colors ${
              openDrawer === 'queue'
                ? 'bg-[#06E5F5]/15 text-[#06E5F5] border-[#06E5F5]/40'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-100'
            }`}
          >
            <ListMusic className="w-4 h-4" />
          </button>

          <div className="hidden md:flex items-center gap-1.5 pl-1">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              className="p-1.5 text-slate-300 hover:text-[#06E5F5] transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-amber-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              aria-label="Audio volume"
              className="cyber-range w-20"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
