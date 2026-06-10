import type { NoteEvent } from './noteEventTracker.ts';
import type { StableRun } from './practiceJudge.ts';
import type { VerdictState } from './verdicts.ts';
import { STABLE_MS, RMS_FLOOR, MIC_HINT_BARS } from './constants.ts';

export type TempoFrameInput = {
  events: Array<NoteEvent>;
  currentRun: StableRun | null;
  // raw frame RMS, not a reading's: the mic-check hint must see true silence
  // even on frames where the pitch reading is null
  rms: number;
  atMs: number;
};

export type TempoSnapshot = {
  noteVerdicts: Array<VerdictState>;
  // beat-indexed over the bar's leading rest windows; 'pending' | 'restViolated'
  restWindowVerdicts: Array<VerdictState>;
  micPossiblyDead: boolean;
};

const SEMITONES_PER_OCTAVE = 12;

// within an open window a later, better-matching strike upgrades the verdict;
// it is never downgraded
const VERDICT_RANK: Record<VerdictState, number> = {
  pending: 0,
  missed: 0,
  restViolated: 0,
  wrong: 1,
  wrongOctave: 2,
  correct: 3,
};

const makeRestVerdicts = (restsPerBar: number): Array<VerdictState> =>
  Array.from({ length: Math.max(0, restsPerBar) }, () => 'pending');

type Params = {
  targetMidis: Array<number>;
  beatsPerBar: number;
  // the judge may start mid-bar; that partial bar never counts toward the mic hint
  initialBeat: number;
};

// Judges each beat window: beats 1..restsPerBar are rest windows, the rest are
// note windows in order. A qualifying strike (fresh articulation + STABLE_MS
// of one pitch) colors its window the moment it qualifies, so a correct note
// turns green during its own beat; a note window still pending when it closes
// becomes 'missed'. Verdicts are NOT reset at the bar wrap — they persist
// until setTargets supplies the regenerated bar, so the final window's verdict
// stays visible through the caller's deferred regeneration.
//
// One judge instance spans many bars because the mic-check hint counts
// consecutive bars.
export const createTempoJudge = ({ targetMidis, beatsPerBar, initialBeat }: Params) => {
  let targets = targetMidis;
  let restsPerBar = beatsPerBar - targets.length;
  let noteVerdicts: Array<VerdictState> = targets.map(() => 'pending');
  let restWindowVerdicts = makeRestVerdicts(restsPerBar);
  let lastBeat = initialBeat;
  let observedFromBeatOne = initialBeat === 1;
  // "fresh articulation": an articulation arms the judge; each distinct stable
  // run after it qualifies at most once (same model as practiceJudge: one
  // sustained pitch can't satisfy two windows, but a slurred pitch change
  // starts a new run and is judged again)
  let armedAtMs: number | null = null;
  let judgedRunKey: string | null = null;
  let rmsSum = 0;
  let rmsCount = 0;
  let silentBars = 0;
  let micPossiblyDead = false;
  let snapshot: TempoSnapshot | null = null;

  const buildSnapshot = (): TempoSnapshot => ({
    noteVerdicts: noteVerdicts.slice(),
    restWindowVerdicts: restWindowVerdicts.slice(),
    micPossiblyDead,
  });

  const clearMicHint = (): boolean => {
    silentBars = 0;
    if (!micPossiblyDead) return false;
    micPossiblyDead = false;
    return true;
  };

  const recordPlayedNote = (midi: number): boolean => {
    // a genuine strike proves the mic is alive, whatever the verdict
    let changed = clearMicHint();
    const windowIndex = lastBeat - 1;
    if (windowIndex < restsPerBar) {
      if (restWindowVerdicts[windowIndex] === 'pending') {
        restWindowVerdicts[windowIndex] = 'restViolated';
        changed = true;
      }
      return changed;
    }
    const noteIndex = windowIndex - restsPerBar;
    const target = targets[noteIndex];
    if (target === undefined) return changed;
    const verdict: VerdictState =
      midi === target
        ? 'correct'
        : midi % SEMITONES_PER_OCTAVE === target % SEMITONES_PER_OCTAVE
          ? 'wrongOctave'
          : 'wrong';
    if (VERDICT_RANK[verdict] > VERDICT_RANK[noteVerdicts[noteIndex]]) {
      noteVerdicts[noteIndex] = verdict;
      changed = true;
    }
    return changed;
  };

  // Bar wrap: tally the mic-check hint and reset per-bar accumulation.
  // Verdicts deliberately survive (see the factory comment).
  const finalizeBar = (): boolean => {
    let changed = false;
    if (observedFromBeatOne && targets.length > 0) {
      const meanRms = rmsCount > 0 ? rmsSum / rmsCount : 0;
      if (noteVerdicts.every((verdict) => verdict === 'missed') && meanRms < RMS_FLOOR) {
        silentBars += 1;
        if (silentBars >= MIC_HINT_BARS && !micPossiblyDead) {
          micPossiblyDead = true;
          changed = true;
        }
      } else {
        // a noisy or partially-judged bar breaks the consecutive-silence
        // chain, but only a real verdict (recordPlayedNote) clears the flag
        silentBars = 0;
      }
    }
    observedFromBeatOne = true;
    rmsSum = 0;
    rmsCount = 0;
    // a note held across the wrap must be freshly struck to count in the new bar
    armedAtMs = null;
    judgedRunKey = null;
    return changed;
  };

  // Returns the same snapshot reference until something changes, so React
  // callers can use it directly as state without re-render churn.
  const processFrame = ({ events, currentRun, rms, atMs }: TempoFrameInput): TempoSnapshot => {
    let changed = false;
    rmsSum += rms;
    rmsCount += 1;

    for (const event of events) {
      if (event.type === 'articulation') {
        armedAtMs = event.atMs;
        judgedRunKey = null;
      }
    }

    if (armedAtMs !== null && currentRun !== null) {
      const runKey = `${currentRun.midi}:${currentRun.startedAtMs}`;
      // when pitch tracking persists through a re-strike's dip, the run
      // predates the articulation: measure stability from the re-strike
      const heldSinceMs = Math.max(currentRun.startedAtMs, armedAtMs);
      if (runKey !== judgedRunKey && atMs - heldSinceMs >= STABLE_MS) {
        judgedRunKey = runKey;
        changed = recordPlayedNote(currentRun.midi) || changed;
      }
    }

    if (changed || snapshot === null) snapshot = buildSnapshot();
    return snapshot;
  };

  // Caller reports every currentBeat transition, including the wrap to 1.
  const onBeat = (beat: number): TempoSnapshot => {
    let changed = false;
    if (beat !== lastBeat) {
      // the window that just closed: a silent note window is now missed
      const closedNoteIndex = lastBeat - 1 - restsPerBar;
      if (closedNoteIndex >= 0 && noteVerdicts[closedNoteIndex] === 'pending') {
        noteVerdicts[closedNoteIndex] = 'missed';
        changed = true;
      }
      if (beat === 1) {
        changed = finalizeBar() || changed;
      }
      lastBeat = beat;
    }
    if (changed || snapshot === null) snapshot = buildSnapshot();
    return snapshot;
  };

  // New bar (regeneration or settings change). Mic-hint state survives: it
  // spans bars by design.
  const setTargets = (newTargetMidis: Array<number>): TempoSnapshot => {
    targets = newTargetMidis;
    restsPerBar = beatsPerBar - targets.length;
    noteVerdicts = targets.map(() => 'pending');
    restWindowVerdicts = makeRestVerdicts(restsPerBar);
    armedAtMs = null;
    judgedRunKey = null;
    snapshot = buildSnapshot();
    return snapshot;
  };

  return { processFrame, onBeat, setTargets };
};
