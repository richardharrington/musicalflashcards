import { describe, it, expect } from 'vitest';
import { createPracticeJudge } from '../practiceJudge.ts';
import type { StableRun } from '../practiceJudge.ts';
import type { NoteEvent } from '../noteEventTracker.ts';
import { HOLD_MS } from '../constants.ts';

const C4 = 60;
const C5 = 72;
const D4 = 62;
const G4 = 67;

// Drives the judge the way the pipeline does: a frame every 50ms carrying any
// events plus the tracker's current stable run.
const makeDriver = (judge: ReturnType<typeof createPracticeJudge>) => {
  let last: ReturnType<typeof judge.processFrame> | null = null;
  const frame = (atMs: number, currentRun: StableRun | null, events: Array<NoteEvent> = []) => {
    last = judge.processFrame({ events, currentRun, atMs });
    return last;
  };
  // a strike: articulation now, then the pitch rings as a stable run
  const strike = (atMs: number, midi: number) =>
    frame(atMs, { midi, startedAtMs: atMs }, [{ type: 'articulation', atMs }]);
  const ring = (atMs: number, midi: number, startedAtMs: number) =>
    frame(atMs, { midi, startedAtMs });
  return { frame, strike, ring, last: () => last! };
};

describe('practiceJudge', () => {
  it('advances after a struck target is held for HOLD_MS', () => {
    const judge = createPracticeJudge([C4, G4]);
    const d = makeDriver(judge);
    d.strike(0, C4);
    let snap = d.ring(HOLD_MS - 50, C4, 0);
    expect(snap.cursorIndex).toBe(0); // not held long enough yet
    snap = d.ring(HOLD_MS, C4, 0);
    expect(snap.cursorIndex).toBe(1);
    expect(snap.verdicts).toEqual(['correct', 'pending']);
    expect(snap.barComplete).toBe(false);
  });

  it('does not let one sustained note satisfy consecutive identical targets', () => {
    const judge = createPracticeJudge([C4, C4]);
    const d = makeDriver(judge);
    d.strike(0, C4);
    let snap = d.ring(HOLD_MS, C4, 0);
    expect(snap.cursorIndex).toBe(1);
    // keep holding the same note for a long time: no advance
    snap = d.ring(2000, C4, 0);
    expect(snap.cursorIndex).toBe(1);
    // re-strike: advances after another HOLD_MS
    d.strike(2100, C4);
    snap = d.ring(2100 + HOLD_MS, C4, 2100);
    expect(snap.cursorIndex).toBe(2);
    expect(snap.barComplete).toBe(true);
  });

  it('requires an articulation even for the first target', () => {
    const judge = createPracticeJudge([C4]);
    const d = makeDriver(judge);
    // a stable run with no articulation ever (e.g. judging started mid-note)
    const snap = d.ring(1000, C4, 0);
    expect(snap.cursorIndex).toBe(0);
    expect(snap.verdicts).toEqual(['pending']);
  });

  it('marks wrong octave as transient wrongOctave without advancing', () => {
    const judge = createPracticeJudge([C4]);
    const d = makeDriver(judge);
    d.strike(0, C5);
    const snap = d.ring(HOLD_MS, C5, 0);
    expect(snap.cursorIndex).toBe(0);
    expect(snap.verdicts).toEqual(['wrongOctave']);
  });

  it('marks a different pitch class as transient wrong, cleared by silence', () => {
    const judge = createPracticeJudge([C4]);
    const d = makeDriver(judge);
    d.strike(0, D4);
    let snap = d.ring(HOLD_MS, D4, 0);
    expect(snap.verdicts).toEqual(['wrong']);
    snap = d.frame(HOLD_MS + 50, null); // silence
    expect(snap.verdicts).toEqual(['pending']);
  });

  it('clears transient feedback on the next articulation', () => {
    const judge = createPracticeJudge([C4]);
    const d = makeDriver(judge);
    d.strike(0, D4);
    let snap = d.ring(HOLD_MS, D4, 0);
    expect(snap.verdicts).toEqual(['wrong']);
    snap = d.strike(500, C4);
    expect(snap.verdicts).toEqual(['pending']);
    snap = d.ring(500 + HOLD_MS, C4, 500);
    expect(snap.verdicts).toEqual(['correct']);
    expect(snap.barComplete).toBe(true);
  });

  it('advances when sliding from a wrong note onto the target without re-striking', () => {
    const judge = createPracticeJudge([C4]);
    const d = makeDriver(judge);
    d.strike(0, D4);
    let snap = d.ring(HOLD_MS, D4, 0);
    expect(snap.verdicts).toEqual(['wrong']);
    // pitch changes: a new stable run begins, same articulation
    snap = d.ring(400, C4, 400);
    snap = d.ring(400 + HOLD_MS, C4, 400);
    expect(snap.verdicts).toEqual(['correct']);
    expect(snap.barComplete).toBe(true);
  });

  it('measures the hold from the articulation when the run predates it', () => {
    const judge = createPracticeJudge([C4, C4]);
    const d = makeDriver(judge);
    d.strike(0, C4);
    d.ring(HOLD_MS, C4, 0); // first target done
    // re-strike where pitch tracking persisted through the dip: run keeps its
    // old startedAtMs, articulation arrives mid-run
    d.frame(1000, { midi: C4, startedAtMs: 0 }, [{ type: 'articulation', atMs: 1000 }]);
    let snap = d.ring(1000 + HOLD_MS - 50, C4, 0);
    expect(snap.cursorIndex).toBe(1); // held since articulation, not since run start
    snap = d.ring(1000 + HOLD_MS, C4, 0);
    expect(snap.cursorIndex).toBe(2);
    expect(snap.barComplete).toBe(true);
  });

  it('returns the same snapshot reference while nothing changes', () => {
    const judge = createPracticeJudge([C4]);
    const d = makeDriver(judge);
    const a = d.frame(0, null);
    const b = d.frame(50, null);
    expect(b).toBe(a);
    const c = d.strike(100, C4); // articulation arms, but nothing visible changed
    expect(c).toBe(a);
  });
});
