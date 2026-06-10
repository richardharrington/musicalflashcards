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
*Update 2026-06-10*: Phase 4 is fully specced in
[`native-pitch-spec.md`](./native-pitch-spec.md); that document governs the
native port.

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

## 6. Phase 1 implementation addendum (2026-06-10)

Phase 1 is implemented as specified, with the following judgment calls and
findings that the spec did not anticipate. Later phases should treat these as
settled unless they cause real problems.

### 6.1 Plausible-frequency band (new constants)

The white-noise acceptance test exposed a real McLeod Pitch Method artifact:
pitchy reports **perfect clarity (1.0)** on white noise at very low
frequencies (~26 Hz, i.e. midi 18). At lags near the frame size, the
normalized square difference is computed over too few samples, so the clarity
gate alone cannot reject it. Fix: `pitchTracker` also rejects detections
outside a plausible band —

```ts
export const MIN_FREQ_HZ = 70;   // app's lowest note is G3 ≈ 196 Hz
export const MAX_FREQ_HZ = 2500; // app's highest is B6 ≈ 1976 Hz
```

The band is deliberately generous so future range expansion doesn't hit it.
The artifact lives at `sampleRate / frameSize` ≈ 23–50 Hz, comfortably below
`MIN_FREQ_HZ`. If `FRAME_SIZE` or the supported note range ever changes,
revisit both constants together.

### 6.2 The articulation envelope only sees *pitched* frames

`noteEventTracker.processFrame(reading: PitchReading | null, atMs)` takes the
tracker's reading, not raw RMS; a `null` reading counts as RMS 0 for the
hysteresis envelope. This is what makes "white noise → no events" actually
hold — otherwise a loud unpitched burst (noise, talking, a percussive attack
transient) would cross `RMS_HIGH` and emit an articulation.

Consequence to be aware of: a strike's unpitched attack transient does not
itself articulate; the pitched ring immediately after it does. In practice the
articulation lands one frame (~50 ms) after the physical attack. Since attack
*timing* is not graded (§1), this is harmless, but if onset-timing grading is
ever added, articulation detection must move to a raw-RMS or spectral-flux
basis at that point.

### 6.3 `getCurrentRun()` accessor

§3.1 says the practice judge "advances when the stable episode for the target
reaches `HOLD_MS`", which requires reading continued stability, not just the
one-shot `stableNote` event. The event tracker therefore exposes
`getCurrentRun(): { midi, startedAtMs } | null` — the active same-midi run,
surviving single-frame null gaps under the same rule as `stableNote`. Phase 2's
`practiceJudge` should consume this rather than inventing its own hold timer.

### 6.4 Stability timing is frame-granular

A stable run's duration is only confirmable when a reading arrives. With a
~50 ms cadence and a tolerated one-frame null gap, a `stableNote`'s `atMs` can
land later than `runStart + STABLE_MS` (e.g. at 150 ms for a run that began at
0 with a gap at 100). Judges must treat `atMs` as "when stability was
confirmed", not an exact 100 ms mark — window bucketing in `tempoJudge` should
already be tolerant of this.

### 6.5 `midiToNote` range rule

Besides returning `null` for accidentals, `midiToNote` returns `null` for
octaves outside 3–6, because the shared `Note` tuple type cannot represent
them (`Octave = 3 | 4 | 5 | 6`). Judges are unaffected (they compare MIDI
numbers), and `midiToDisplayName` still names out-of-range pitches truthfully
(e.g. `C2`) for the readout.

### 6.6 Loose ends for Phase 2/3

- `computeRms(frame)` is exported separately from the tracker. The tempo
  judge's mic-check hint needs mean RMS "below `RMS_FLOOR`" even on frames
  where the reading is `null` — the web pipeline should compute/forward raw
  RMS for that purpose rather than inferring it from readings.
- Versions installed: `pitchy@4.1.0` (dependency), `vitest@4.1.8`
  (devDependency, first test infra in the repo). `npm test -w
  @musicalflashcards/shared` runs the suite.
- Tests live in `packages/shared/src/pitch/__tests__/`, with synthesis helpers
  in `signals.ts`: phase-continuous sine generation (frames sliced from one
  long buffer, like a real stream) and LCG-seeded deterministic white noise so
  the clarity-gate tests cannot flake. Reuse these helpers when testing the
  judges.

## 7. Phase 2 implementation addendum (2026-06-10)

Phase 2 (web practice mode) is implemented as specified, with the judgment
calls and findings below. Verified end-to-end in headless Chrome with a fake
microphone (mode switching, Listen lifecycle, readout, cursor coloring); the
real-instrument acceptance pass in §4 is still pending.

### 7.1 Practice-judge semantics (resolving §3.1 ambiguities)

- **All outcomes are judged at `HOLD_MS`, not `STABLE_MS`.** §3.1's bullet
  list ("matches target → correct; wrong octave → transient; otherwise →
  transient wrong") hangs off the "sustained for `HOLD_MS`" condition, so
  wrong-note feedback also waits the full 250 ms hold. Uniform and simple; if
  faster wrong-note feedback is ever wanted, judge non-matching runs at
  `STABLE_MS` instead.
- **The hold is measured from `max(run start, last articulation)`.** Covers
  the re-strike case where pitch tracking persists through the dip (the run's
  `startedAtMs` predates the articulation): the player must hold for
  `HOLD_MS` *after* the re-strike, not get instant credit.
- **Each stable run is judged at most once per articulation, but a pitch
  change starts a new run and is judged again.** Consequence: striking a
  wrong note and *sliding* onto the target (violin-style, no re-strike)
  advances the cursor. One strike can yield several transient wrongs and then
  a correct. This was judged desirable (it's how players tune into a note);
  if it ever isn't, key the once-per-articulation guard on the articulation
  alone instead of the run.
- **`processFrame` returns the same snapshot object reference until something
  changes.** Callers use the snapshot directly as React state; identity
  equality makes the 60 Hz frame loop free of render churn. Keep this
  invariant when extending the judge.

### 7.2 API deviations from §3.2

- `usePitchPipeline` exposes `{ listening, error, toggle, currentReading }`
  plus an `onFrame` callback parameter — there is no `events` field in the
  returned state. The spec itself says judges consume events "directly, not
  via React state"; the callback (called per frame with
  `{ reading, events, currentRun, atMs }`) is that direct path. The judge
  lives in `App.tsx` behind a ref; only snapshot changes touch state.
- `Bar`'s decoration props are **note-indexed**, not tickable-indexed:
  `noteVerdicts: Array<VerdictState>` aligns with the `notes` array and
  `cursorIndex` is an index into it. Rests are unstyled for now. Phase 3 will
  need to add rest styling to `buildFullMeasure`'s `MeasureDecorations`
  (remember: a half rest is one tickable spanning two beat windows — mark it
  `restViolated` if *either* window is violated).
- `useAppState` gained `beatClockEnabled?: boolean` (default `true`; `false`
  zeroes the beat interval and pins `currentBeat` to 1) and a returned
  `regenerateNotes()`. Both optional/additive, so the native app is untouched.

### 7.3 UI decisions the spec left open

- **Default mode is Tempo**, so the app loads behaving exactly as it did
  before this feature. Practice is one click away.
- **Bar completion pauses 600 ms** (`BAR_COMPLETE_DELAY_MS` in `App.tsx`)
  before regenerating, so the player sees the last note turn green.
- The judge is recreated whenever the bar, mode, or listening state changes;
  a note held across a bar regeneration cannot satisfy the new bar's first
  target (a fresh articulation is required — consistent with "hold + clear
  gap").
- Verdict colors: correct `#15803d`, wrongOctave `#d97706`, wrong/restViolated
  `#dc2626`, missed `#9ca3af`, cursor `#2563eb` (in `pitch/verdicts.ts`).

### 7.4 Findings

- **Real bug found by the browser smoke test**: the VexFlow SVG canvas is
  500 px wide inside a 160 px scaled container; the invisible overflow sat on
  top of the Listen button and swallowed its clicks. Fixed with
  `pointer-events: none` on `#output`. Anything interactive placed near the
  staff needs this to stay.
- The mic source guards stop-during-start with a session counter
  (`getUserMedia` resolving after the user already toggled off must not leak
  a live mic). It reuses one `Float32Array` per frame; consumers must process
  frames synchronously, never retain them.
- Headless-Chrome testing works with
  `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`
  (auto-granted fake mic); useful for Phase 3 verification too.
- Pre-existing console noise, not from this feature: `validateDOMNesting`
  warnings (`<p>` inside `<p>`, `<ul>` inside `<p>` in `App.tsx`) and a
  favicon 404. Also pre-existing: the repo's `npm run lint` has no ESLint
  config file anywhere, so it errors before linting.

### 7.5 Real-instrument smoke-test fixes (2026-06-10)

The §4 real-instrument pass surfaced one real bug and two readout changes:

- **Articulation thresholds retuned** (`RMS_LOW` 0.02 → 0.005, `RMS_HIGH`
  0.06 → `RMS_FLOOR`). Real mics deliver raw RMS far below the synthetic
  levels Phase 1 tested with: pitch readings flowed (the readout tracked
  every note) but RMS never crossed 0.06, so no articulation ever fired and
  the practice judge never judged anything — noteheads stayed black at any
  playing volume. With `RMS_HIGH = RMS_FLOOR`, any frame loud enough to
  register a pitch articulates after quiet; the envelope's noise immunity now
  rests entirely on the clarity gate (null readings count as RMS 0, §6.2).
  Phase 3's "ambient noise must not fail a rest" criterion leans on that same
  rule and should be re-verified with a real mic.
- **Readout shows only the note name** (`G♯4`, no cents). Overrides §3.2's
  "note name + signed cents"; cents are still computed and retained per §1.
- **Readout de-muted in tempo mode**: larger (1.8rem) and no longer grey.
  Practice mode's 2.5rem bold variant is unchanged; "visually subordinate"
  (§1) now means size/weight only, not color.

The DOM-nesting warnings noted in §7.4 as pre-existing were also fixed
(`App.tsx`: the note-boundary radio group is a `<div>`, the coming-soon list
sits beside its `<p>` rather than inside it).

## 8. Phase 3 implementation addendum (2026-06-10)

Phase 3 (web tempo mode) is implemented as specified, with the judgment calls
and findings below. Verified end-to-end in headless Chrome with an injected
oscillator microphone (see §8.5). The real-instrument acceptance pass in §4
was subsequently completed and confirmed by the developer (2026-06-10).

### 8.1 Qualification model (resolving §3.1's "articulation+stableNote pair")

The tempo judge does not consume `stableNote` events. It uses the same
run-based model the practice judge settled on in §7.1: an articulation *arms*
the judge, and each distinct stable run thereafter qualifies at most once,
when it has been held `STABLE_MS` past `max(run start, articulation)`. The
event-pair model would have broken a real case the run model handles: a
re-strike of the same pitch where tracking persists through the dip emits
**no** new `stableNote` (the run never resets), so consecutive identical
targets in tempo mode would have been unjudgeable. Consequences, accepted
deliberately for consistency with §7.1:

- A sustained pitch cannot satisfy two windows (the run key blocks it).
- A slurred pitch *change* starts a new run and is judged without a fresh
  articulation — legato across note windows works, and within one window a
  slide from a wrong note onto the target upgrades the verdict.
- Verdicts upgrade but never downgrade within a window
  (`wrong < wrongOctave < correct`).

A qualifying strike is attributed to the window open at the moment stability
is *confirmed* (per §3.1/§6.4). A strike more than `STABLE_MS` before its beat
therefore lands in the preceding rest window (`restViolated`) and the note
window goes `missed`; within `STABLE_MS` of the beat it lands correctly.

### 8.2 Verdict timing and the deferred bar regeneration

Note windows are judged eagerly: a qualifying strike colors its window the
moment it qualifies (so a correct note turns green *during* its beat); a
still-pending note window becomes `missed` when the window closes. This
exposed a structural conflict in the spec: with default settings the only
note window closes exactly at the bar wrap, where current behavior (§1)
regenerates the bar instantly — gray would never be visible, contradicting
§4's "silence marks it gray". The acceptance criterion won:

- `useAppState` gained `beatWrapRegenDelayMs?: number` (default 0 = today's
  behavior). While tempo-judging, the web app passes `BAR_COMPLETE_DELAY_MS`
  (600 ms), capped internally to one beat so the regenerated bar still lands
  inside beat 1 (always a rest window at 1–3 rests).
- The judge does **not** reset verdicts at the wrap; they persist until
  `setTargets` delivers the regenerated bar. During the holdover, strikes
  bucket into the new bar's first rest window but draw on the old bar's rest
  glyph — musically correct, visually marginal, accepted.
- Known quirk: changing settings while tempo-judging mid-bar resets the beat
  to 1, which schedules a second (deferred) regeneration ~600 ms after the
  settings-driven one — the notes visibly change twice. Rare and harmless;
  the instant-path equivalent already existed invisibly.

### 8.3 Judge lifecycle (differs from the practice judge)

One `createTempoJudge` instance spans bars — the mic hint counts
*consecutive* bars, so the judge must survive regeneration. The app creates
it when tempo judging starts (`initialBeat` = the beat at creation; a bar
observed only partway never counts toward the mic hint), feeds bars via
`setTargets(targetMidis)` (resets verdicts, keeps mic-hint state), and
reports every `currentBeat` transition via `onBeat(beat)`. The armed
articulation and judged-run key are cleared at each wrap, so a note held
across the wrap can neither violate the new bar's first rest nor satisfy its
windows without a fresh strike (symmetric with §7.3's practice rule).

### 8.4 Mic-check hint semantics

- `PipelineFrame` gained `rms: number` (raw frame RMS, `reading?.rms ??
  computeRms(frame)`), per §6.6 — the hint must see true loudness on
  null-reading frames.
- A bar counts as silent only if **every** note window is `missed` *and* the
  bar's mean raw RMS < `RMS_FLOOR`. An all-missed bar with ambient noise
  breaks the consecutive-silence chain (counter resets) but does not clear an
  already-raised flag; only a qualifying strike (any verdict, including
  `restViolated`) clears it, immediately.
- The hint renders as "Check your microphone?" next to the Listen toggle
  (`.mic-hint`, amber).

### 8.5 Rendering and verification notes

- `MeasureDecorations` gained `restWindowVerdicts` (beat-indexed across the
  bar's leading rest windows). `buildFullMeasure` maps windows onto rest
  glyphs: the half rest spans two windows and is marked red if *either* was
  violated, per §7.2's note.
- Headless-Chrome findings for future verification: the fake media device
  (`--use-fake-device-for-media-stream`) delivered *unpitched noise* in this
  environment (no readings, RMS above the floor — usefully, it proved noisy
  bars don't raise the mic hint), and `--use-file-for-fake-audio-capture`
  silently delivered zeros (which proved the hint raises after two silent
  bars). To exercise the pitched paths, override `getUserMedia` via CDP
  `Page.addScriptToEvaluateOnNewDocument` to return an
  `OscillatorNode → GainNode → MediaStreamDestination` stream and drive
  frequency/gain from the test — this verified correct/green during the
  note's own beat, the live readout, restViolated/red on a rest strike,
  missed/gray persisting through the wrap holdover, and wrongOctave.
