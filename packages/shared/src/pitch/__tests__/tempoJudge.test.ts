import { describe, it, expect } from 'vitest';
import { createTempoJudge } from '../tempoJudge.ts';
import type { StableRun } from '../practiceJudge.ts';
import type { NoteEvent } from '../noteEventTracker.ts';
import { STABLE_MS, RMS_FLOOR, MIC_HINT_BARS } from '../constants.ts';

const C4 = 60;
const C5 = 72;
const D4 = 62;
const G4 = 67;
const LOUD = RMS_FLOOR * 5;

// Drives the judge the way the app does: processFrame per audio frame,
// onBeat per currentBeat transition, setTargets when the bar regenerates.
const makeDriver = (judge: ReturnType<typeof createTempoJudge>) => {
  let last: ReturnType<typeof judge.processFrame> | null = null;
  const frame = (
    atMs: number,
    currentRun: StableRun | null,
    events: Array<NoteEvent> = [],
    rms: number = currentRun !== null ? LOUD : 0,
  ) => {
    last = judge.processFrame({ events, currentRun, rms, atMs });
    return last;
  };
  // a strike: articulation now, then the pitch rings as a stable run
  const strike = (atMs: number, midi: number) =>
    frame(atMs, { midi, startedAtMs: atMs }, [{ type: 'articulation', atMs }]);
  const ring = (atMs: number, midi: number, startedAtMs: number) =>
    frame(atMs, { midi, startedAtMs });
  const beat = (b: number) => {
    last = judge.onBeat(b);
    return last;
  };
  return { frame, strike, ring, beat, last: () => last! };
};

// default app settings: 4 beats, 3 rests (windows 0-2), one note (beat 4)
const makeDefaultJudge = () =>
  createTempoJudge({ targetMidis: [C4], beatsPerBar: 4, initialBeat: 1 });

describe('tempoJudge', () => {
  it('marks the target correct during its own beat when struck and held', () => {
    const d = makeDriver(makeDefaultJudge());
    d.beat(2);
    d.beat(3);
    d.beat(4);
    d.strike(3000, C4);
    let snap = d.ring(3000 + STABLE_MS - 50, C4, 3000);
    expect(snap.noteVerdicts).toEqual(['pending']); // not stable long enough yet
    snap = d.ring(3000 + STABLE_MS, C4, 3000);
    expect(snap.noteVerdicts).toEqual(['correct']);
    expect(snap.restWindowVerdicts).toEqual(['pending', 'pending', 'pending']);
  });

  it('marks a silent note window missed at close and keeps it until the next bar', () => {
    const judge = makeDefaultJudge();
    const d = makeDriver(judge);
    d.beat(2);
    d.beat(3);
    d.beat(4);
    let snap = d.frame(3500, null);
    expect(snap.noteVerdicts).toEqual(['pending']); // window still open
    snap = d.beat(1); // wrap closes the note window
    expect(snap.noteVerdicts).toEqual(['missed']);
    snap = judge.setTargets([G4]); // the regenerated bar arrives
    expect(snap.noteVerdicts).toEqual(['pending']);
  });

  it('marks right pitch class in the wrong octave as wrongOctave', () => {
    const d = makeDriver(makeDefaultJudge());
    d.beat(2);
    d.beat(3);
    d.beat(4);
    d.strike(3000, C5);
    const snap = d.ring(3000 + STABLE_MS, C5, 3000);
    expect(snap.noteVerdicts).toEqual(['wrongOctave']);
  });

  it('marks a different pitch class as wrong', () => {
    const d = makeDriver(makeDefaultJudge());
    d.beat(2);
    d.beat(3);
    d.beat(4);
    d.strike(3000, D4);
    const snap = d.ring(3000 + STABLE_MS, D4, 3000);
    expect(snap.noteVerdicts).toEqual(['wrong']);
  });

  it('upgrades but never downgrades the verdict within a window', () => {
    const d = makeDriver(makeDefaultJudge());
    d.beat(2);
    d.beat(3);
    d.beat(4);
    d.strike(3000, D4);
    let snap = d.ring(3000 + STABLE_MS, D4, 3000);
    expect(snap.noteVerdicts).toEqual(['wrong']);
    // slide onto the target (new stable run, same articulation)
    snap = d.ring(3200 + STABLE_MS, C4, 3200);
    expect(snap.noteVerdicts).toEqual(['correct']);
    // sliding away again does not downgrade
    snap = d.ring(3400 + STABLE_MS, D4, 3400);
    expect(snap.noteVerdicts).toEqual(['correct']);
  });

  it('marks a rest window restViolated on a genuine strike', () => {
    const d = makeDriver(makeDefaultJudge());
    d.beat(2);
    d.strike(1000, C4);
    const snap = d.ring(1000 + STABLE_MS, C4, 1000);
    expect(snap.restWindowVerdicts).toEqual(['pending', 'restViolated', 'pending']);
    expect(snap.noteVerdicts).toEqual(['pending']);
  });

  it('does not violate a rest for sustained sound without a fresh articulation', () => {
    const d = makeDriver(makeDefaultJudge());
    d.beat(2);
    // a stable pitch that was already ringing when judging started
    d.ring(1000, C4, 0);
    const snap = d.ring(2000, C4, 0);
    expect(snap.restWindowVerdicts).toEqual(['pending', 'pending', 'pending']);
  });

  it('does not let one sustained strike satisfy two consecutive note windows', () => {
    // 2 rests, 2 notes: note windows are beats 3 and 4
    const judge = createTempoJudge({ targetMidis: [C4, C4], beatsPerBar: 4, initialBeat: 1 });
    const d = makeDriver(judge);
    d.beat(2);
    d.beat(3);
    d.strike(2000, C4);
    let snap = d.ring(2000 + STABLE_MS, C4, 2000);
    expect(snap.noteVerdicts).toEqual(['correct', 'pending']);
    d.beat(4);
    d.ring(3500, C4, 2000); // same run keeps ringing
    snap = d.beat(1);
    expect(snap.noteVerdicts).toEqual(['correct', 'missed']);
  });

  it('counts a re-strike even when pitch tracking persists through the dip', () => {
    const judge = createTempoJudge({ targetMidis: [C4, C4], beatsPerBar: 4, initialBeat: 1 });
    const d = makeDriver(judge);
    d.beat(2);
    d.beat(3);
    d.strike(2000, C4);
    d.ring(2000 + STABLE_MS, C4, 2000);
    d.beat(4);
    // articulation arrives mid-run: the run keeps its old startedAtMs
    d.frame(3100, { midi: C4, startedAtMs: 2000 }, [{ type: 'articulation', atMs: 3100 }]);
    let snap = d.ring(3100 + STABLE_MS - 50, C4, 2000);
    expect(snap.noteVerdicts).toEqual(['correct', 'pending']); // held since the re-strike, not the run start
    snap = d.ring(3100 + STABLE_MS, C4, 2000);
    expect(snap.noteVerdicts).toEqual(['correct', 'correct']);
  });

  it('attributes a strike to the window where stability is confirmed', () => {
    const d = makeDriver(makeDefaultJudge());
    d.beat(2);
    d.beat(3);
    // struck just before the note's beat; stability confirmed inside it
    d.strike(2950, C4);
    d.beat(4);
    const snap = d.ring(2950 + STABLE_MS, C4, 2950);
    expect(snap.noteVerdicts).toEqual(['correct']);
    expect(snap.restWindowVerdicts).toEqual(['pending', 'pending', 'pending']);
  });

  it('does not let a note held across the wrap qualify in the new bar', () => {
    const judge = makeDefaultJudge();
    const d = makeDriver(judge);
    d.beat(2);
    d.beat(3);
    d.beat(4);
    d.strike(3000, C4);
    d.ring(3000 + STABLE_MS, C4, 3000);
    d.beat(1);
    judge.setTargets([C4]);
    // the same run is still ringing in the new bar's first rest window
    const snap = d.ring(5000, C4, 3000);
    expect(snap.restWindowVerdicts).toEqual(['pending', 'pending', 'pending']);
  });

  describe('mic-check hint', () => {
    const runSilentBar = (d: ReturnType<typeof makeDriver>, startMs: number) => {
      d.frame(startMs, null, [], 0);
      d.beat(2);
      d.beat(3);
      d.beat(4);
      d.frame(startMs + 3500, null, [], 0);
      return d.beat(1);
    };

    it('raises the hint only after MIC_HINT_BARS consecutive silent bars', () => {
      const judge = makeDefaultJudge();
      const d = makeDriver(judge);
      for (let bar = 0; bar < MIC_HINT_BARS; bar++) {
        if (bar > 0) judge.setTargets([C4]);
        const snap = runSilentBar(d, bar * 4000);
        expect(snap.micPossiblyDead).toBe(bar === MIC_HINT_BARS - 1);
      }
    });

    it('clears the hint on the next judged note', () => {
      const judge = makeDefaultJudge();
      const d = makeDriver(judge);
      for (let bar = 0; bar < MIC_HINT_BARS; bar++) {
        if (bar > 0) judge.setTargets([C4]);
        runSilentBar(d, bar * 4000);
      }
      judge.setTargets([C4]);
      d.beat(2);
      d.beat(3);
      d.beat(4);
      const t = MIC_HINT_BARS * 4000 + 3000;
      d.strike(t, C4);
      const snap = d.ring(t + STABLE_MS, C4, t);
      expect(snap.micPossiblyDead).toBe(false);
      expect(snap.noteVerdicts).toEqual(['correct']);
    });

    it('never raises the hint while ambient noise keeps mean RMS above the floor', () => {
      const judge = makeDefaultJudge();
      const d = makeDriver(judge);
      for (let bar = 0; bar <= MIC_HINT_BARS; bar++) {
        if (bar > 0) judge.setTargets([C4]);
        d.frame(bar * 4000, null, [], LOUD); // unpitched noise: no run, no events
        d.beat(2);
        d.beat(3);
        d.beat(4);
        d.frame(bar * 4000 + 3500, null, [], LOUD);
        const snap = d.beat(1);
        expect(snap.noteVerdicts).toEqual(['missed']);
        expect(snap.micPossiblyDead).toBe(false);
      }
    });

    it('does not count a bar the judge only observed partway through', () => {
      const judge = createTempoJudge({ targetMidis: [C4], beatsPerBar: 4, initialBeat: 3 });
      const d = makeDriver(judge);
      d.frame(2500, null, [], 0);
      d.beat(4);
      d.frame(3500, null, [], 0);
      d.beat(1); // partial bar: must not count
      for (let bar = 0; bar < MIC_HINT_BARS; bar++) {
        judge.setTargets([C4]);
        const snap = runSilentBar(d, 4000 + bar * 4000);
        expect(snap.micPossiblyDead).toBe(bar === MIC_HINT_BARS - 1);
      }
    });
  });

  it('returns the same snapshot reference while nothing changes', () => {
    const d = makeDriver(makeDefaultJudge());
    const a = d.frame(0, null);
    const b = d.frame(50, null);
    expect(b).toBe(a);
    const c = d.beat(2); // closes a rest window: nothing visible changed
    expect(c).toBe(a);
  });
});
