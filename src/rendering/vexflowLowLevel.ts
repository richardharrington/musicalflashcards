import { Formatter, Stave, StaveNote, Voice } from 'vexflow';
import type { Note } from '../utils/noteUtils';

const toVexKey = (note: Note): string => {
  const [octave, pitchClass] = note;
  const letters = 'CDEFGAB';
  const letter = letters[pitchClass - 1];
  return `${letter}/${octave}`;
};

const makeRest = (duration: 'qr' | 'hr'): StaveNote =>
  new StaveNote({
    // VexFlow convention: rest notes still need a pitch.
    keys: ['b/4'],
    duration,
  });

export const buildFullMeasure = (notes: Array<Note>, beatsPerBar: number): Array<StaveNote> => {
  const restsPerBar = Math.max(0, beatsPerBar - notes.length);
  const tickables: Array<StaveNote> = [];

  if (restsPerBar >= 2) tickables.push(makeRest('hr'));
  if (restsPerBar === 1 || restsPerBar === 3) tickables.push(makeRest('qr'));

  // Important: create a fresh StaveNote for every tickable.
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

export const drawMeasure = ({
  context,
  stave,
  tickables,
  beatsPerBar,
}: {
  context: any;
  stave: Stave;
  tickables: Array<StaveNote>;
  beatsPerBar: number;
}) => {
  const voice = new Voice({ num_beats: beatsPerBar, beat_value: 4 });
  voice.addTickables(tickables);

  // Reasonable default; can be made configurable later.
  voice.setStrict(false);

  // getNoteStartX() is the x-position after clef, key, and time signature.
  // The available width for notes is from there to the right edge of the stave.
  const noteAreaWidth = stave.getX() + stave.getWidth() - stave.getNoteStartX();
  new Formatter().joinVoices([voice]).format([voice], noteAreaWidth);
  voice.draw(context, stave);
};

