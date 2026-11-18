import type { AudioTrackRecord } from '../types/media';

export const COVER_NEON_RAINDRIFT = '/src/assets/images/album_neon_raindrift_1794988084136.jpg';
export const COVER_SUBSTATION_PULSE = '/src/assets/images/album_substation_pulse_1794988083760.jpg';
export const COVER_MIDNIGHT_OVERPASS = '/src/assets/images/album_midnight_overpass_1794988084330.jpg';
export const COVER_CHROME_HORIZON = '/src/assets/images/album_chrome_horizon_1794988083793.jpg';
export const STREAM_FALLBACK_BACKDROP = '/src/assets/images/stream_backdrop_fallback_1794988084252.jpg';

interface SynthPreset {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  coverUrl: string;
  durationSec: number;
  bpm: number;
  rootFreq: number;
  chordIntervals: number[][];
  arpIntervals: number[];
  rainLevel: number;
  pulseDepth: number;
}

const STARTER_PRESETS: SynthPreset[] = [
  {
    id: 'starter_neon_raindrift',
    title: 'Neon Raindrift',
    artist: 'Kurodeck Synth',
    album: 'Nocturne Vault',
    genre: 'Cyber Ambient',
    coverUrl: COVER_NEON_RAINDRIFT,
    durationSec: 20,
    bpm: 92,
    rootFreq: 110, // A2
    chordIntervals: [
      [0, 3, 7, 10],
      [-4, 0, 3, 7],
      [-2, 2, 5, 10],
      [-5, -2, 2, 7],
    ],
    arpIntervals: [12, 15, 19, 22, 19, 15, 14, 12],
    rainLevel: 0.045,
    pulseDepth: 0.25,
  },
  {
    id: 'starter_substation_pulse',
    title: 'Substation Pulse',
    artist: 'Kurodeck Synth',
    album: 'Grid Harmonics',
    genre: 'Dark Synthwave',
    coverUrl: COVER_SUBSTATION_PULSE,
    durationSec: 18,
    bpm: 112,
    rootFreq: 98, // G2
    chordIntervals: [
      [0, 7, 10, 14],
      [-5, 2, 7, 10],
      [-4, 3, 7, 12],
      [-2, 5, 9, 14],
    ],
    arpIntervals: [0, 12, 7, 10, 14, 10, 7, 12],
    rainLevel: 0.015,
    pulseDepth: 0.48,
  },
  {
    id: 'starter_midnight_overpass',
    title: 'Midnight Overpass',
    artist: 'Kurodeck Synth',
    album: 'Nocturne Vault',
    genre: 'Darksynth',
    coverUrl: COVER_MIDNIGHT_OVERPASS,
    durationSec: 22,
    bpm: 104,
    rootFreq: 130.81, // C3
    chordIntervals: [
      [0, 3, 7, 14],
      [-2, 2, 7, 10],
      [-4, 0, 5, 12],
      [-5, -1, 2, 7],
    ],
    arpIntervals: [12, 19, 15, 24, 19, 15, 14, 19],
    rainLevel: 0.025,
    pulseDepth: 0.38,
  },
  {
    id: 'starter_chrome_horizon',
    title: 'Chrome Horizon',
    artist: 'Kurodeck Synth',
    album: 'Liquid Static',
    genre: 'Ambient Electronica',
    coverUrl: COVER_CHROME_HORIZON,
    durationSec: 24,
    bpm: 80,
    rootFreq: 146.83, // D3
    chordIntervals: [
      [0, 7, 12, 16],
      [-3, 4, 9, 14],
      [-5, 2, 7, 12],
      [-7, 0, 5, 9],
    ],
    arpIntervals: [12, 16, 19, 24, 21, 19, 16, 14],
    rainLevel: 0.03,
    pulseDepth: 0.18,
  },
];

function semitoneRatio(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

function encodeStereoWav(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
  const numFrames = left.length;
  const numChannels = 2;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i += 1) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    offset += 2;
    view.setInt16(offset, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function renderSynthTrackBlob(preset: SynthPreset): Blob {
  const sampleRate = 22050;
  const numFrames = Math.floor(preset.durationSec * sampleRate);
  const left = new Float32Array(numFrames);
  const right = new Float32Array(numFrames);

  const beatDuration = 60 / preset.bpm;
  const barDuration = beatDuration * 4;
  const stepDuration = beatDuration / 2;

  let lpNoiseL = 0;
  let lpNoiseR = 0;
  let seed = preset.rootFreq * 1000;
  const nextNoise = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return (seed / 4294967296) * 2 - 1;
  };

  for (let i = 0; i < numFrames; i += 1) {
    const t = i / sampleRate;
    const fadeIn = Math.min(1, t / 0.8);
    const fadeOut = Math.min(1, (preset.durationSec - t) / 1.4);
    const masterEnv = fadeIn * fadeOut;

    const chordIdx = Math.floor(t / barDuration) % preset.chordIntervals.length;
    const chord = preset.chordIntervals[chordIdx];
    const barPos = (t % barDuration) / barDuration;
    const padEnv = Math.sin(Math.min(1, barPos * 5) * Math.PI * 0.5) * (0.78 + 0.22 * Math.sin(t * 0.9));

    // Warm detuned stereo pad
    let padL = 0;
    let padR = 0;
    for (let n = 0; n < chord.length; n += 1) {
      const freq = preset.rootFreq * semitoneRatio(chord[n]);
      const lWave =
        Math.sin(2 * Math.PI * (freq * 0.997) * t) * 0.65 +
        Math.sin(2 * Math.PI * (freq * 1.997) * t) * 0.18;
      const rWave =
        Math.sin(2 * Math.PI * (freq * 1.003) * t) * 0.65 +
        Math.sin(2 * Math.PI * (freq * 2.003) * t) * 0.18;
      padL += lWave;
      padR += rWave;
    }
    padL = (padL / chord.length) * 0.26 * padEnv;
    padR = (padR / chord.length) * 0.26 * padEnv;

    // Deep analog sub-bass with sidechain pulse
    const bassFreq = (preset.rootFreq / 2) * semitoneRatio(chord[0]);
    const beatPos = (t % beatDuration) / beatDuration;
    const duck = 1 - preset.pulseDepth * Math.exp(-beatPos * 6);
    const sub =
      (Math.sin(2 * Math.PI * bassFreq * t) * 0.8 +
        Math.sin(2 * Math.PI * bassFreq * 2 * t) * 0.2) *
      0.24 *
      duck;

    // Soft cyberpunk kick pulse on downbeats
    const kickEnv = Math.exp(-beatPos * 16);
    const kickPitch = 46 + 75 * Math.exp(-beatPos * 26);
    const kick = Math.sin(2 * Math.PI * kickPitch * beatPos * beatDuration) * kickEnv * preset.pulseDepth * 0.45;

    // Glassy crystalline arpeggio
    const stepIdx = Math.floor(t / stepDuration) % preset.arpIntervals.length;
    const stepPos = (t % stepDuration) / stepDuration;
    const arpFreq = preset.rootFreq * semitoneRatio(preset.arpIntervals[stepIdx]);
    const arpEnv = Math.exp(-stepPos * 5.2) * Math.min(1, stepPos * 40);
    const arpWave =
      Math.sin(2 * Math.PI * arpFreq * t) * 0.72 +
      Math.sin(2 * Math.PI * arpFreq * 2 * t) * 0.22 +
      Math.sin(2 * Math.PI * arpFreq * 3 * t) * 0.06;
    const pan = 0.5 + 0.35 * Math.sin(stepIdx * 1.3);
    const arpL = arpWave * arpEnv * 0.16 * (1 - pan * 0.4);
    const arpR = arpWave * arpEnv * 0.16 * (0.6 + pan * 0.4);

    // Filtered atmospheric rain / vinyl air
    lpNoiseL = lpNoiseL * 0.92 + nextNoise() * 0.08;
    lpNoiseR = lpNoiseR * 0.92 + nextNoise() * 0.08;
    const rainL = lpNoiseL * preset.rainLevel;
    const rainR = lpNoiseR * preset.rainLevel;

    left[i] = Math.tanh((padL + sub + kick + arpL + rainL) * masterEnv * 1.15);
    right[i] = Math.tanh((padR + sub + kick + arpR + rainR) * masterEnv * 1.15);
  }

  return encodeStereoWav(left, right, sampleRate);
}

export function buildStarterOfflineTracks(defaultPlaylistId: string): AudioTrackRecord[] {
  const baseTime = Date.now() - 1000 * 60 * 12;
  return STARTER_PRESETS.map((preset, idx) => {
    const blob = renderSynthTrackBlob(preset);
    return {
      id: preset.id,
      title: preset.title,
      artist: preset.artist,
      album: preset.album,
      genre: preset.genre,
      duration: preset.durationSec,
      fileSize: blob.size,
      mimeType: 'audio/wav',
      format: 'WAV',
      playlistId: idx < 3 ? defaultPlaylistId : null,
      coverUrl: preset.coverUrl,
      addedAt: baseTime + idx * 1000 * 60,
      playCount: 0,
      isFavorite: idx === 0,
      isStarter: true,
      blob,
    };
  });
}
