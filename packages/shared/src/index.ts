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
  FakeSVGElement,
  createFakeDocument,
  createFakeContainer,
  setupFakeDocument,
  teardownFakeDocument,
  toSVGString,
} from './rendering/svgShim.ts';
