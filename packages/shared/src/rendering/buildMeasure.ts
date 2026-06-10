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

// Verdict/cursor styling: noteVerdicts/cursorIndex are indexed by note
// position; restWindowVerdicts is beat-indexed across the bar's leading rest
// windows (a multi-beat rest glyph is marked if any of its windows was violated)
export type MeasureDecorations = {
  noteVerdicts?: Array<VerdictState>;
  restWindowVerdicts?: Array<VerdictState>;
  cursorIndex?: number | null;
};

export const buildFullMeasure = (
  notes: Array<Note>,
  beatsPerBar: number,
  { noteVerdicts, restWindowVerdicts, cursorIndex }: MeasureDecorations = {},
): Array<StaveNote> => {
  const restsPerBar = Math.max(0, beatsPerBar - notes.length);
  const tickables: Array<StaveNote> = [];

  let restWindow = 0;
  const pushRest = (duration: 'qr' | 'hr', beatSpan: number) => {
    const rest = makeRest(duration);
    const windows = restWindowVerdicts?.slice(restWindow, restWindow + beatSpan);
    restWindow += beatSpan;
    if (windows?.includes('restViolated')) {
      const color = verdictColor('restViolated');
      if (color !== null) {
        rest.setStyle({ fillStyle: color, strokeStyle: color });
      }
    }
    tickables.push(rest);
  };

  if (restsPerBar >= 2) pushRest('hr', 2);
  if (restsPerBar === 1 || restsPerBar === 3) pushRest('qr', 1);

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
