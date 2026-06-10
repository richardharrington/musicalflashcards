export {
  PITCH_CLASS,
  getNoteBoundaryDisplayString,
  makeNoteRange,
  makeRandomNote,
  makeRandomNotes,
  makeRepeatedNotes,
  generateNotes,
} from './utils/noteUtils.tsx';
export type { Note, NoteBoundaryPair } from './utils/noteUtils.tsx';

export { default as useAppState } from './hooks/useAppState.ts';
export { default as useBeatInterval } from './hooks/useBeatInterval.tsx';

export { buildFullMeasure } from './rendering/buildMeasure.ts';
export { drawMeasure } from './rendering/drawMeasure.ts';

export {
  A4_HZ,
  CLARITY_THRESHOLD,
  STABLE_MS,
  HOLD_MS,
  RMS_FLOOR,
  RMS_LOW,
  RMS_HIGH,
  FRAME_SIZE,
  MIC_HINT_BARS,
  MIN_FREQ_HZ,
  MAX_FREQ_HZ,
} from './pitch/constants.ts';
export {
  freqToMidi,
  midiToNote,
  midiToDisplayName,
  noteToMidi,
} from './pitch/quantize.ts';
export { createPitchTracker, computeRms } from './pitch/pitchTracker.ts';
export type { PitchReading } from './pitch/pitchTracker.ts';
export { createNoteEventTracker } from './pitch/noteEventTracker.ts';
export type { NoteEvent } from './pitch/noteEventTracker.ts';

export {
  FakeSVGElement,
  createFakeDocument,
  createFakeContainer,
  setupFakeDocument,
  teardownFakeDocument,
  toSVGString,
} from './rendering/svgShim.ts';
