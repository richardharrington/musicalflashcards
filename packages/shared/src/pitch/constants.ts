export const A4_HZ = 440;
export const CLARITY_THRESHOLD = 0.9;   // pitchy clarity gate
export const STABLE_MS = 100;           // stable-pitch requirement
export const HOLD_MS = 250;             // practice-mode hold-to-advance
export const RMS_FLOOR = 0.01;          // below this: silence
// Articulation hysteresis. Retuned after the first real-instrument smoke test
// (2026-06-10): raw mic RMS for normal playing can sit entirely below the
// original 0.02/0.06 band, so articulation never fired — readings flowed to
// the readout but the practice judge stayed unarmed forever. RMS_HIGH equal
// to RMS_FLOOR means any frame loud enough to register a pitch also
// articulates after quiet; quiet requires dropping below RMS_LOW or going
// unpitched (null readings count as RMS 0 for the envelope).
export const RMS_LOW = 0.005;           // articulation hysteresis: quiet below
export const RMS_HIGH = RMS_FLOOR;      // articulation hysteresis: strike above
export const FRAME_SIZE = 2048;         // analysis window (≈43ms @48kHz)
export const MIC_HINT_BARS = 2;
// let the player see the last note turn green before the bar regenerates
export const BAR_COMPLETE_DELAY_MS = 600;

// Plausible-pitch band. The app's notes span G3–B6 (196–1976 Hz); detections
// outside this band are artifacts (MPM reports spurious perfect clarity at
// lags near the frame size, i.e. ~23–50 Hz at 48kHz/2048), not music.
export const MIN_FREQ_HZ = 70;
export const MAX_FREQ_HZ = 2500;
