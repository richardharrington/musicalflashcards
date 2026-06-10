import { PitchDetector } from 'pitchy';
import { freqToMidi } from './quantize.ts';
import { CLARITY_THRESHOLD, RMS_FLOOR, MIN_FREQ_HZ, MAX_FREQ_HZ } from './constants.ts';

export type PitchReading = {
  midi: number;
  cents: number;
  clarity: number;
  rms: number;
  atMs: number;
};

export const computeRms = (frame: Float32Array): number => {
  let sumOfSquares = 0;
  for (let i = 0; i < frame.length; i++) {
    sumOfSquares += frame[i] * frame[i];
  }
  return Math.sqrt(sumOfSquares / frame.length);
};

export const createPitchTracker = (sampleRate: number, frameSize: number) => {
  const detector = PitchDetector.forFloat32Array(frameSize);

  const processFrame = (frame: Float32Array, atMs: number): PitchReading | null => {
    const rms = computeRms(frame);
    if (rms < RMS_FLOOR) {
      return null;
    }
    const [freq, clarity] = detector.findPitch(frame, sampleRate);
    if (clarity < CLARITY_THRESHOLD || !Number.isFinite(freq)) {
      return null;
    }
    if (freq < MIN_FREQ_HZ || freq > MAX_FREQ_HZ) {
      return null;
    }
    const { midi, cents } = freqToMidi(freq);
    return { midi, cents, clarity, rms, atMs };
  };

  return { processFrame };
};
