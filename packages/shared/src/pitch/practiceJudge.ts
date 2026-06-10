import type { NoteEvent } from './noteEventTracker.ts';
import type { VerdictState } from './verdicts.ts';
import { HOLD_MS } from './constants.ts';

export type StableRun = { midi: number; startedAtMs: number };

export type PracticeFrameInput = {
  events: Array<NoteEvent>;
  currentRun: StableRun | null;
  atMs: number;
};

export type PracticeSnapshot = {
  cursorIndex: number;
  verdicts: Array<VerdictState>;
  barComplete: boolean;
};

const SEMITONES_PER_OCTAVE = 12;

// "Hold + clear gap": a target is satisfied by holding its pitch for HOLD_MS,
// but only after a fresh articulation — one sustained note can't satisfy
// consecutive identical targets. Wrong/wrongOctave verdicts are transient
// feedback on the current target, cleared by the next articulation or silence.
export const createPracticeJudge = (targetMidis: Array<number>) => {
  let targetIndex = 0;
  let awaitingArticulation = true;
  let armedAtMs = 0;
  // each distinct stable run is judged at most once per articulation, but a
  // pitch change starts a new run, so sliding from a wrong note onto the
  // target (without re-striking) still advances
  let judgedRunKey: string | null = null;
  let transient: Extract<VerdictState, 'wrong' | 'wrongOctave'> | null = null;
  const verdicts: Array<VerdictState> = targetMidis.map(() => 'pending');
  let barComplete = targetMidis.length === 0;
  let snapshot: PracticeSnapshot | null = null;

  const buildSnapshot = (): PracticeSnapshot => {
    const merged = verdicts.slice();
    if (transient !== null && targetIndex < merged.length) {
      merged[targetIndex] = transient;
    }
    return { cursorIndex: targetIndex, verdicts: merged, barComplete };
  };

  // Returns the same snapshot reference until something changes, so React
  // callers can use it directly as state without re-render churn.
  const processFrame = ({ events, currentRun, atMs }: PracticeFrameInput): PracticeSnapshot => {
    let changed = false;

    for (const event of events) {
      if (event.type === 'articulation') {
        awaitingArticulation = false;
        armedAtMs = event.atMs;
        judgedRunKey = null;
        if (transient !== null) {
          transient = null;
          changed = true;
        }
      }
    }

    if (currentRun === null && transient !== null) {
      transient = null;
      changed = true;
    }

    if (!barComplete && !awaitingArticulation && currentRun !== null) {
      const runKey = `${currentRun.midi}:${currentRun.startedAtMs}`;
      const heldSinceMs = Math.max(currentRun.startedAtMs, armedAtMs);
      if (runKey !== judgedRunKey && atMs - heldSinceMs >= HOLD_MS) {
        judgedRunKey = runKey;
        const target = targetMidis[targetIndex];
        if (currentRun.midi === target) {
          verdicts[targetIndex] = 'correct';
          transient = null;
          targetIndex += 1;
          awaitingArticulation = true;
          barComplete = targetIndex === targetMidis.length;
        } else if (currentRun.midi % SEMITONES_PER_OCTAVE === target % SEMITONES_PER_OCTAVE) {
          transient = 'wrongOctave';
        } else {
          transient = 'wrong';
        }
        changed = true;
      }
    }

    if (changed || snapshot === null) {
      snapshot = buildSnapshot();
    }
    return snapshot;
  };

  return { processFrame };
};
