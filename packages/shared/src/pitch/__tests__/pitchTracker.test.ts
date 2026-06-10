import { describe, it, expect } from 'vitest';
import { createPitchTracker, computeRms } from '../pitchTracker.ts';
import { FRAME_SIZE, RMS_FLOOR } from '../constants.ts';
import { SAMPLE_RATE, sineFrames, noiseFrames, silentFrames, centsToFreq } from './signals.ts';

const C4_HZ = 261.63;

describe('computeRms', () => {
  it('is amplitude / √2 for a sine', () => {
    const [frame] = sineFrames(C4_HZ, { frameSize: FRAME_SIZE, numFrames: 1, amplitude: 0.3 });
    expect(computeRms(frame)).toBeCloseTo(0.3 / Math.SQRT2, 2);
  });

  it('is zero for silence', () => {
    expect(computeRms(new Float32Array(FRAME_SIZE))).toBe(0);
  });
});

describe('createPitchTracker', () => {
  const spec = { frameSize: FRAME_SIZE, numFrames: 1, amplitude: 0.3 };

  it('reads a pure C4 sine as midi 60 with near-zero cents', () => {
    const tracker = createPitchTracker(SAMPLE_RATE, FRAME_SIZE);
    const [frame] = sineFrames(C4_HZ, spec);
    const reading = tracker.processFrame(frame, 0);
    expect(reading).not.toBeNull();
    expect(reading!.midi).toBe(60);
    expect(Math.abs(reading!.cents)).toBeLessThan(5);
    expect(reading!.clarity).toBeGreaterThan(0.9);
    expect(reading!.rms).toBeCloseTo(0.3 / Math.SQRT2, 2);
    expect(reading!.atMs).toBe(0);
  });

  it('reads a +40-cent-sharp sine as the same midi with cents ≈ +40', () => {
    const tracker = createPitchTracker(SAMPLE_RATE, FRAME_SIZE);
    const [frame] = sineFrames(centsToFreq(C4_HZ, 40), spec);
    const reading = tracker.processFrame(frame, 0);
    expect(reading).not.toBeNull();
    expect(reading!.midi).toBe(60);
    expect(reading!.cents).toBeGreaterThan(30);
    expect(reading!.cents).toBeLessThan(50);
  });

  it('rejects white noise via the clarity gate', () => {
    const tracker = createPitchTracker(SAMPLE_RATE, FRAME_SIZE);
    for (const frame of noiseFrames({ frameSize: FRAME_SIZE, numFrames: 10, amplitude: 0.3 })) {
      expect(tracker.processFrame(frame, 0)).toBeNull();
    }
  });

  it('rejects silence via the RMS floor', () => {
    const tracker = createPitchTracker(SAMPLE_RATE, FRAME_SIZE);
    const [silent] = silentFrames({ frameSize: FRAME_SIZE, numFrames: 1 });
    expect(tracker.processFrame(silent, 0)).toBeNull();

    // a sine quieter than the floor is also silence
    const quietAmplitude = RMS_FLOOR; // rms = amplitude / √2 < RMS_FLOOR
    const [quiet] = sineFrames(C4_HZ, { frameSize: FRAME_SIZE, numFrames: 1, amplitude: quietAmplitude });
    expect(tracker.processFrame(quiet, 0)).toBeNull();
  });
});
