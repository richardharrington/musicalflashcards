type ValueOf<T> = T[keyof T];

type Octave = 3 | 4 | 5 | 6;

export const PITCH_CLASS = {
  C: 1,
  D: 2,
  E: 3,
  F: 4,
  G: 5,
  A: 6,
  B: 7,
} as const;

type PitchClass = ValueOf<typeof PITCH_CLASS>;

export type Note = [octave: Octave, pitchClass: PitchClass]; // octave, position in octave

export type NoteBoundaryPair = {
  low: Note;
  high: Note;
};

export const getNoteBoundaryDisplayString = (str: String) => {
  const words = str.match(/[A-Z]?[a-z]*/g);
  if (words === null) {
    throw new Error('Not gonna happen');
  }
  // Capitalize first word
  words[0] = words[0][0].toUpperCase() + words[0].slice(1);
  return words.join(' ');
};

export const makeNoteRange = ({
  low: [lowOctave, lowPitchClass],
  high: [highOctave, highPitchClass],
}: NoteBoundaryPair
) => {
  const notes: Array<Note> = [];
  for (let octave = lowOctave; octave <= highOctave; octave++) {
    const startPitchClass = octave === lowOctave ? lowPitchClass : 1;
    const endPitchClass = octave === highOctave ? highPitchClass : 7;
    for (let pitchClass = startPitchClass; pitchClass <= endPitchClass; pitchClass++) {
      notes.push([octave, pitchClass]);
    }
  }
  return notes;
}

export const makeRandomNote = (noteRange: Array<Note>): Note => {
  return noteRange[Math.floor(Math.random() * noteRange.length)];
};

export const makeRandomNotes = (noteRange: Array<Note>, numNotes: number): Array<Note> => {
  const notes: Array<Note> = [];
  for (let i = 0; i < numNotes; i++) {
    notes.push(makeRandomNote(noteRange));
  }
  return notes;
}

export const makeRepeatedNotes = (note: Note, numNotes: number): Array<Note> => {
  const notes: Array<Note> = [];
  for (let i = 0; i < numNotes; i++) {
    notes.push(note);
  }
  return notes;
};

export const generateNotes = (
  numNotes: number,
  low: Note,
  high: Note,
  allNotesShouldBeEqual: boolean,
) => {
  const noteRange = makeNoteRange({ low, high });
  return allNotesShouldBeEqual
    ? makeRepeatedNotes(makeRandomNote(noteRange), numNotes)
    : makeRandomNotes(noteRange, numNotes);
}
