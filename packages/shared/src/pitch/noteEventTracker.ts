import type { PitchReading } from './pitchTracker.ts';
import { STABLE_MS, RMS_LOW, RMS_HIGH } from './constants.ts';

export type NoteEvent =
  | { type: 'stableNote'; midi: number; cents: number; atMs: number }
  | { type: 'articulation'; atMs: number };

// A null reading (silence, or unpitched sound rejected by the clarity gate)
// counts as zero RMS, so ambient noise can neither articulate nor stabilize.
const MAX_NULL_GAP_FRAMES = 1;

export const createNoteEventTracker = () => {
  let envelope: 'quiet' | 'ringing' = 'quiet';
  let runMidi: number | null = null;
  let runStartMs = 0;
  let runEmitted = false;
  let nullGap = 0;

  const processFrame = (reading: PitchReading | null, atMs: number): Array<NoteEvent> => {
    const events: Array<NoteEvent> = [];

    const rms = reading?.rms ?? 0;
    if (envelope === 'ringing' && rms < RMS_LOW) {
      envelope = 'quiet';
    } else if (envelope === 'quiet' && rms > RMS_HIGH) {
      envelope = 'ringing';
      events.push({ type: 'articulation', atMs });
    }

    if (reading === null) {
      nullGap += 1;
      if (nullGap > MAX_NULL_GAP_FRAMES) {
        runMidi = null;
        runEmitted = false;
      }
    } else {
      nullGap = 0;
      if (reading.midi !== runMidi) {
        runMidi = reading.midi;
        runStartMs = atMs;
        runEmitted = false;
      }
      if (!runEmitted && atMs - runStartMs >= STABLE_MS) {
        runEmitted = true;
        events.push({ type: 'stableNote', midi: reading.midi, cents: reading.cents, atMs });
      }
    }

    return events;
  };

  // The current same-midi run, for judges that need continued stability
  // (practice mode's HOLD_MS). Survives single-frame null gaps, like the
  // stableNote rule.
  const getCurrentRun = (): { midi: number; startedAtMs: number } | null =>
    runMidi === null ? null : { midi: runMidi, startedAtMs: runStartMs };

  return { processFrame, getCurrentRun };
};
