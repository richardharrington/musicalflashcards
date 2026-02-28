import { StaveNote } from 'vexflow';
import type { Note } from '../utils/noteUtils';

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

export const buildFullMeasure = (notes: Array<Note>, beatsPerBar: number): Array<StaveNote> => {
  const restsPerBar = Math.max(0, beatsPerBar - notes.length);
  const tickables: Array<StaveNote> = [];

  if (restsPerBar >= 2) tickables.push(makeRest('hr'));
  if (restsPerBar === 1 || restsPerBar === 3) tickables.push(makeRest('qr'));

  for (const note of notes) {
    tickables.push(
      new StaveNote({
        keys: [toVexKey(note)],
        duration: 'q',
      })
    );
  }

  return tickables;
};
