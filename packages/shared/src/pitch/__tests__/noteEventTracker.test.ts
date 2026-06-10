import { describe, it, expect } from 'vitest';
import { createPitchTracker } from '../pitchTracker.ts';
import { createNoteEventTracker } from '../noteEventTracker.ts';
import type { NoteEvent } from '../noteEventTracker.ts';
import { FRAME_SIZE, STABLE_MS } from '../constants.ts';
import { SAMPLE_RATE, sineFrames, noiseFrames, silentFrames, centsToFreq } from './signals.ts';

const C4_HZ = 261.63;
const G4_HZ = 392.0;
const FRAME_INTERVAL_MS = 50;
const LOUD = 0.3; // rms ≈ 0.21, above RMS_HIGH

// Run synthesized frames through the full pitch pipeline at a 50 ms cadence.
const runPipeline = (frames: Array<Float32Array>): Array<NoteEvent> => {
  const pitchTracker = createPitchTracker(SAMPLE_RATE, FRAME_SIZE);
  const eventTracker = createNoteEventTracker();
  const events: Array<NoteEvent> = [];
  frames.forEach((frame, i) => {
    const atMs = i * FRAME_INTERVAL_MS;
    const reading = pitchTracker.processFrame(frame, atMs);
    events.push(...eventTracker.processFrame(reading, atMs));
  });
  return events;
};

const stableNotes = (events: Array<NoteEvent>) =>
  events.filter((e) => e.type === 'stableNote');
const articulations = (events: Array<NoteEvent>) =>
  events.filter((e) => e.type === 'articulation');

describe('noteEventTracker pipeline', () => {
  it('emits one stableNote for a sustained C4 sine, within STABLE_MS', () => {
    const frames = sineFrames(C4_HZ, { frameSize: FRAME_SIZE, numFrames: 8, amplitude: LOUD });
    const events = runPipeline(frames);
    const stable = stableNotes(events);
    expect(stable).toHaveLength(1);
    expect(stable[0].midi).toBe(60);
    expect(stable[0].atMs).toBeLessThanOrEqual(STABLE_MS);
  });

  it('emits an articulation at the onset of the sustained note', () => {
    const frames = [
      ...silentFrames({ frameSize: FRAME_SIZE, numFrames: 2 }),
      ...sineFrames(C4_HZ, { frameSize: FRAME_SIZE, numFrames: 4, amplitude: LOUD }),
    ];
    expect(articulations(runPipeline(frames))).toHaveLength(1);
  });

  it('reports cents ≈ +40 for a sharp C4', () => {
    const frames = sineFrames(centsToFreq(C4_HZ, 40), {
      frameSize: FRAME_SIZE,
      numFrames: 8,
      amplitude: LOUD,
    });
    const stable = stableNotes(runPipeline(frames));
    expect(stable).toHaveLength(1);
    expect(stable[0].midi).toBe(60);
    expect(stable[0].cents).toBeGreaterThan(30);
    expect(stable[0].cents).toBeLessThan(50);
  });

  it('emits exactly one articulation for an amplitude dip-and-rise', () => {
    const spec = { frameSize: FRAME_SIZE, amplitude: LOUD };
    const frames = [
      ...sineFrames(C4_HZ, { ...spec, numFrames: 4 }),
      ...silentFrames({ frameSize: FRAME_SIZE, numFrames: 2 }), // dip below RMS_LOW
      ...sineFrames(C4_HZ, { ...spec, numFrames: 4 }),
    ];
    const events = runPipeline(frames);
    const dipEndsAtMs = 6 * FRAME_INTERVAL_MS;
    expect(articulations(events)).toHaveLength(2); // initial strike + re-strike
    expect(
      articulations(events).filter((e) => e.atMs >= dipEndsAtMs),
    ).toHaveLength(1);
  });

  it('emits no events for white noise (clarity gate)', () => {
    const frames = noiseFrames({ frameSize: FRAME_SIZE, numFrames: 10, amplitude: 0.3 });
    expect(runPipeline(frames)).toHaveLength(0);
  });

  it('tolerates a single null-frame gap without restarting stability', () => {
    const frames = [
      ...sineFrames(C4_HZ, { frameSize: FRAME_SIZE, numFrames: 2, amplitude: LOUD }),
      ...silentFrames({ frameSize: FRAME_SIZE, numFrames: 1 }),
      ...sineFrames(C4_HZ, { frameSize: FRAME_SIZE, numFrames: 3, amplitude: LOUD }),
    ];
    const stable = stableNotes(runPipeline(frames));
    expect(stable).toHaveLength(1);
    // stability is measured from the first sine frame across the gap, and is
    // first confirmable at the frame after the gap (150ms)
    expect(stable[0].atMs).toBe(3 * FRAME_INTERVAL_MS);
  });

  it('starts a fresh stable episode when the pitch changes', () => {
    const frames = [
      ...sineFrames(C4_HZ, { frameSize: FRAME_SIZE, numFrames: 4, amplitude: LOUD }),
      ...sineFrames(G4_HZ, { frameSize: FRAME_SIZE, numFrames: 4, amplitude: LOUD }),
    ];
    const stable = stableNotes(runPipeline(frames));
    expect(stable.map((e) => e.midi)).toEqual([60, 67]);
  });

  it('exposes the current run for hold-to-advance judging', () => {
    const pitchTracker = createPitchTracker(SAMPLE_RATE, FRAME_SIZE);
    const eventTracker = createNoteEventTracker();
    expect(eventTracker.getCurrentRun()).toBeNull();
    sineFrames(C4_HZ, { frameSize: FRAME_SIZE, numFrames: 6, amplitude: LOUD }).forEach(
      (frame, i) => {
        const atMs = i * FRAME_INTERVAL_MS;
        eventTracker.processFrame(pitchTracker.processFrame(frame, atMs), atMs);
      },
    );
    expect(eventTracker.getCurrentRun()).toEqual({ midi: 60, startedAtMs: 0 });
  });
});
