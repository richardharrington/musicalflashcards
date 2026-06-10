import { StaveNote } from 'vexflow';
import type { Note } from '../utils/noteUtils';
import { verdictColor } from '../pitch/verdicts.ts';
import type { VerdictState } from '../pitch/verdicts.ts';

const toVexKey = (note: Note): string => {
  const [octave, pitchClass] = note;
  const letters = 'CDEFGAB';
  const letter = letters[pitchClass - 1];
  return `${letter}/${octave}`;
};

const makeRest = (duration: 'qr' | 'hr'): StaveNote =>
  new StaveNote({
    keys: ['b/4'],
    duration,
  });

// Verdict/cursor styling indexed by note position (rests are unstyled for now)
export type MeasureDecorations = {
  noteVerdicts?: Array<VerdictState>;
  cursorIndex?: number | null;
};

export const buildFullMeasure = (
  notes: Array<Note>,
  beatsPerBar: number,
  { noteVerdicts, cursorIndex }: MeasureDecorations = {},
): Array<StaveNote> => {
  const restsPerBar = Math.max(0, beatsPerBar - notes.length);
  const tickables: Array<StaveNote> = [];

  if (restsPerBar >= 2) tickables.push(makeRest('hr'));
  if (restsPerBar === 1 || restsPerBar === 3) tickables.push(makeRest('qr'));

  notes.forEach((note, i) => {
    const staveNote = new StaveNote({
      keys: [toVexKey(note)],
      duration: 'q',
    });
    const color = verdictColor(noteVerdicts?.[i] ?? 'pending', i === cursorIndex);
    if (color !== null) {
      staveNote.setStyle({ fillStyle: color, strokeStyle: color });
    }
    tickables.push(staveNote);
  });

  return tickables;
};
