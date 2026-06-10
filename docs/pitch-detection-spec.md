# Pitch Detection Feature — Implementation Spec

Status: agreed design, not yet implemented. Produced from a design interview on 2026-06-09.

The feature: the app listens to the microphone and tells the user whether they
played the notes shown on the staff. Web first; native later. This document is
written to be followed by an implementing agent without further design input.

## 1. Decisions (settled — do not relitigate)

| Topic | Decision |
|---|---|
| Modes | Two user-selectable modes: **Practice** (untimed, cursor-driven) and **Tempo** (metronome-judged). Practice mode is built first. |
| Instrument | One monophonic instrument at a time. No polyphony, no voice-specific handling. |
| Tuning reference | A4 = 440 Hz, equal temperament, no calibration step. |
| Tolerance | Nearest-semitone quantization: detected frequency snaps to the closest note name (effectively ±50 cents). Cents offset is computed and retained for a future intonation feature, but does not affect correctness in v1. |
| Octave rule | Exact octave required. Right letter / wrong octave is its own verdict state (not plain "wrong"). This state also absorbs detector octave errors. |
| Tempo-mode correctness | A note is correct if a **fresh articulation** occurred and the **target pitch was stable (~100 ms)** within the note's beat window. Attack *timing* is not graded. |
| Silence in tempo mode | A window with no qualifying event is **missed** — a distinct verdict, not "wrong". |
| Rests in tempo mode | Graded: a rest window **fails only if a genuine struck note** (fresh articulation + stable pitch) lands in it. Ambient noise must not fail a rest. Keep rest grading an independently removable rule. |
| Practice-mode advance | Hold target pitch ~250 ms **plus** a new articulation per target ("hold + clear gap"). Prevents one sustained note from satisfying consecutive identical targets. Practice mode skips rests. |
| Feedback | Verdicts colored on the noteheads in place + a live tuner-style readout. Readout is the primary UI in practice mode, visually subordinate in tempo mode. No audio feedback cues. |
| Mic lifecycle | Explicit **Listen** toggle. Permission requested on first enable; permission/device errors surface on the toggle itself. |
| Scoring | None. No tallies, no persistence. (A session tally is an acceptable future add; nothing here may block it.) |
| Algorithm | [`pitchy`](https://www.npmjs.com/package/pitchy) (McLeod Pitch Method, with clarity scores). Lives in the shared package. |
| Platform order | Web only in this effort. The shared pipeline must be platform-agnostic (PCM frames in, events out) so a native adapter (likely `react-native-audio-api` + Expo dev build) can be added without touching shared code. |
| Bar lifecycle (confirmed assumption) | Tempo mode keeps current behavior: a fresh bar is generated each cycle; verdict colors live only until the bar regenerates. |
| Beat clock (confirmed assumption) | Beat windows stay on the existing `setTimeout`-driven clock (`useBeatInterval`). Acceptable because attack timing isn't graded. If onset-timing grading is ever added, the clock must first move to `AudioContext` time. |

## 2. Verdict states

Per displayed note (and rest) in tempo mode; per target in practice mode:

| State | Meaning | Notehead style |
|---|---|---|
| `pending` | Not yet judged | default black |
| `correct` | Target pitch, right octave | green |
| `wrongOctave` | Right pitch class, wrong octave | amber |
| `wrong` | Different pitch class | red |
| `missed` | No qualifying event in the window (tempo mode only) | gray |
| `restViolated` | Struck note during a rest window (tempo mode only) | red (on the rest glyph) |

Practice mode additionally styles the **current target** distinctly (e.g., blue)
as the cursor.

## 3. Architecture

All detection/judging logic is platform-independent TypeScript in
`packages/shared/src/pitch/`. The web package owns only microphone capture and
UI. Data flows one direction:

```
[web] getUserMedia → AnalyserNode → Float32Array frames (~50ms cadence)
        │
        ▼
[shared] PitchTracker (pitchy + clarity gate + quantization)
        → per-frame readings: { noteName, octave, cents, clarity, rms } | null
        │
        ▼
[shared] NoteEventTracker (stability + articulation detection)
        → events: { type: 'stableNote', note, at } | { type: 'articulation', at }
        │
        ├──▶ [shared] PracticeJudge (state machine)  → cursor position + verdicts
        └──▶ [shared] TempoJudge   (state machine)   → per-window verdicts
        │
        ▼
[web] React components: colored noteheads (VexFlow setStyle) + live readout
```

### 3.1 `packages/shared/src/pitch/` modules

**`quantize.ts`** — pure functions.
- `freqToMidi(freq: number): { midi: number; cents: number }` —
  `midi = round(69 + 12 * log2(freq / 440))`, `cents` = signed offset from that
  midi note.
- `midiToNote(midi: number): Note | null` — maps to the app's
  `[octave, pitchClass]` tuple (natural notes only; return `null` for
  accidentals — an accidental can never match a target and should read as
  `wrong` pitch class, see judge rules). Used by the judges only.
- `midiToDisplayName(midi: number): string` — names all twelve pitch classes
  for the live readout, sharps-only spelling (`C♯4`, never `D♭4`). The readout
  must use this, not `midiToNote`, so accidentals display truthfully instead
  of vanishing or rounding to a natural.
- `noteToMidi(note: Note): number`.

**`pitchTracker.ts`** — wraps pitchy.
- `createPitchTracker(sampleRate: number, frameSize: number)` returning
  `processFrame(frame: Float32Array, atMs: number): PitchReading | null`.
- Uses `PitchDetector.forFloat32Array(frameSize)` from pitchy.
- Returns `null` when `clarity < CLARITY_THRESHOLD` or `rms < RMS_FLOOR`
  (no pitch present). Otherwise `{ midi, cents, clarity, rms, atMs }`.

**`noteEventTracker.ts`** — turns frame readings into events.
- *Stable note*: the same `midi` value reported for ≥ `STABLE_MS` of
  consecutive frames (gaps of one null frame tolerated) → emit
  `{ type: 'stableNote', midi, cents, atMs }` once per stable episode
  (`atMs` = time stability was achieved; verdicts are attributed to the window
  containing this timestamp).
- *Articulation*: RMS envelope with hysteresis. Track per-frame RMS; state is
  `ringing` or `quiet`. `ringing → quiet` when RMS < `RMS_LOW` for a frame;
  `quiet → ringing` when RMS > `RMS_HIGH` → emit
  `{ type: 'articulation', atMs }`. (`RMS_HIGH > RMS_LOW`; both tunable.)
- A `stableNote` event "consumes" the most recent articulation: judges require
  the pair (articulation followed by stability) to count a played note.

**`practiceJudge.ts`** — state machine.
- Input: ordered list of targets (the bar's non-rest `Note`s), event stream.
- State: `targetIndex`, `awaitingArticulation: boolean` (true at start and
  after each advance).
- On `articulation`: set `awaitingArticulation = false`.
- On `stableNote` while not awaiting articulation, sustained for `HOLD_MS`
  (the tracker reports continued stability; judge advances when the stable
  episode for the target reaches `HOLD_MS`):
  - matches target midi → verdict `correct`, advance cursor, set
    `awaitingArticulation = true`;
  - same pitch class, wrong octave → transient `wrongOctave` feedback on the
    target (do not advance);
  - otherwise → transient `wrong` feedback (do not advance).
  Transient = cleared when the next articulation or silence is seen.
- After the last target: report bar complete (caller regenerates the bar and
  resets the judge).

**`tempoJudge.ts`** — state machine.
- Input: the bar layout as windows. With current bar construction
  (`buildFullMeasure`: rests first, then quarter notes), beats
  `1..restsPerBar` are rest windows and beat `restsPerBar + i` is note `i`'s
  window. (A half rest spans two beat windows; both are rest windows.)
- The caller reports beat transitions (from existing `currentBeat` state —
  the `setTimeout` clock, per the confirmed assumption). The judge buckets
  events by the window containing their `atMs`/arrival.
- At each window close:
  - *Note window*: if an articulation+stableNote pair matching the target →
    `correct`; pair with right pitch class / wrong octave → `wrongOctave`;
    pair with other pitch → `wrong`; no qualifying pair → `missed`.
  - *Rest window*: qualifying pair present → `restViolated`; else stays
    `pending`/unmarked.
- On bar wrap (beat returns to 1): emit bar summary, reset verdicts (the bar
  regenerates anyway).
- *Mic-check hint*: if `MIC_HINT_BARS` (default 2) consecutive bars judge
  **every** note window `missed` while mean RMS stayed below `RMS_FLOOR`,
  raise a `micPossiblyDead` flag for the UI ("Check your microphone?").
  Clear it on any non-missed verdict.

**`constants.ts`** — single home for tunables, exported so the UI/spec tests
can reference them:

```ts
export const A4_HZ = 440;
export const CLARITY_THRESHOLD = 0.9;   // pitchy clarity gate
export const STABLE_MS = 100;           // stable-pitch requirement
export const HOLD_MS = 250;             // practice-mode hold-to-advance
export const RMS_FLOOR = 0.01;          // below this: silence
export const RMS_LOW = 0.02;            // articulation hysteresis: quiet below
export const RMS_HIGH = 0.06;           // articulation hysteresis: strike above
export const FRAME_SIZE = 2048;         // analysis window (≈43ms @48kHz)
export const MIC_HINT_BARS = 2;
```

These are starting values; tune empirically. `FRAME_SIZE` 2048 supports the
app's lowest note (G3 ≈ 196 Hz, ~8 cycles per frame).

Export everything new through `packages/shared/src/index.ts`, following the
existing explicit-extension import style (`./pitch/quantize.ts`).

Add `pitchy` (^4) to `packages/shared/package.json` `dependencies`. The shared
package ships raw TS compiled by the consumer's bundler; pitchy is pure TS/ESM
with no DOM dependency, so this is safe for the future native consumer too.

### 3.2 Web package

**`src/audio/micSource.ts`** — the only platform-specific audio code.
- `createMicSource(onFrame: (frame: Float32Array, sampleRate: number, atMs: number) => void)`
  with `start()` / `stop()`.
- `start()`: `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`,
  create/resume `AudioContext` (the Listen toggle click is the required user
  gesture), `MediaStreamAudioSourceNode` → `AnalyserNode`
  (`fftSize = FRAME_SIZE`), poll `getFloatTimeDomainData` on a
  `requestAnimationFrame` loop (~60 Hz; consecutive identical frames are fine —
  the tracker is idempotent per timestamp). Use `AudioContext.currentTime`-derived
  ms for `atMs`.
- `stop()`: cancel loop, stop tracks, suspend/close context. Must be safe to
  call repeatedly.
- Surfaces errors (permission denied, no device) via a callback/state, not
  exceptions in the rAF loop.

**Hook `src/hooks/usePitchPipeline.ts`** (web): owns micSource + shared
trackers; exposes `{ listening, error, toggle, currentReading, events }`.
React state updates for `currentReading` should be throttled (~10 Hz) to avoid
re-render churn; judges consume events directly, not via React state.

**UI changes** (`App.tsx` and components):
- **Mode selector**: `Practice | Tempo` control. Tempo mode = current
  metronome behavior + judging when listening. Practice mode disables the
  beat clock (`useBeatInterval` not running / metronome hidden) and shows the
  cursor flow. With Listen off, tempo mode behaves exactly as the app does
  today; practice mode without Listen shows a prompt to enable it.
- **Listen toggle**: prominent button near the staff. States: off / on /
  error (with message, e.g., "Microphone access denied").
- **Live readout**: detected note name + signed cents (e.g., `A4 −12¢`), an
  em-dash when silent. Prominent in practice mode, small/muted in tempo mode.
  Shows whatever is detected regardless of correctness, including accidentals
  via `midiToDisplayName` (a player who fingers C♯4 must see `C♯4`, not a
  dash or a rounded natural — that's how they self-correct).
- **Notehead coloring**: extend `Bar` to accept
  `verdicts: Array<VerdictState>` (and `cursorIndex` in practice mode) and
  apply `staveNote.setStyle({ fillStyle, strokeStyle })` per the table in §2
  before drawing. The existing redraw-on-prop-change effect handles updates.
  Style application belongs in shared `buildMeasure.ts`/`drawMeasure.ts` so
  native reuses it.

## 4. Build order & acceptance criteria

**Phase 1 — shared pitch core.**
`quantize`, `pitchTracker`, `noteEventTracker`, `constants`, exported from the
shared index. Add `vitest` to the shared package (first test infra in the
repo) and unit-test with synthesized frames: pure sine at 261.63 Hz →
stableNote C4 within `STABLE_MS`; sine at +40¢ → still C4 with cents ≈ +40;
amplitude dip-and-rise → exactly one articulation event; white noise → no
events (clarity gate).
*Done when*: tests pass; no DOM globals referenced anywhere in
`shared/src/pitch/`.

**Phase 2 — web practice mode.**
`micSource`, `usePitchPipeline`, Listen toggle, mode selector, live readout,
`practiceJudge`, cursor + notehead coloring.
*Done when*: with a real instrument (or tone generator), enabling Listen and
playing the displayed notes in order walks the cursor through the bar, a new
bar appears at the end; consecutive identical targets each require a re-strike;
wrong octave shows amber, wrong note red, neither advances; denying mic
permission shows the error state on the toggle.

**Phase 3 — web tempo mode.**
`tempoJudge` wired to `currentBeat` transitions, verdict coloring during the
bar, rest violation marking, missed state, mic-check hint.
*Done when*: at 60 BPM with default settings (3 rests + 1 note), playing the
note during its beat marks it green and silence marks it gray; striking a note
during a rest marks the rest red; talking/ambient noise during rests does
*not* mark them; two fully-silent bars raise the mic hint and it clears on the
next correct note.

**Phase 4 — native (explicitly out of scope now).**
When undertaken: adopt `react-native-audio-api` (requires leaving Expo Go for
a dev build), implement a native `micSource` with the same frame-callback
contract, reuse everything in shared. The notehead styling must already work
through the SVG shim path (VexFlow `setStyle` emits `fill`/`stroke` attributes,
which `svgShim.ts` already serializes).

## 5. Out of scope (decided against for v1)

- Tighter intonation tolerance / "out of tune" feedback (cents data is already
  captured; add later without rework).
- Onset-timing (rhythm) grading — requires onset subsystem and an
  `AudioContext`-anchored beat clock; see assumptions in §1.
- Calibration / non-A440 tunings, polyphony, voice, scoring/persistence,
  audio feedback cues.
- Accidentals in *targets*: planned future work will add scales/keys (C minor
  first, then others), key signatures on the bar, and customary enharmonic
  spelling (flats where conventional). Out of scope here, but don't foreclose
  it: the natural-only `Note` type, `midiToNote`'s null-for-accidentals rule,
  and the sharps-only readout spelling are the three places that will change.
  Keep the judges comparing MIDI numbers (not note names) so correctness
  logic survives that extension unchanged.
