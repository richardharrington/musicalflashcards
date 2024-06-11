export type Note = [octave: number, pos: number]; // octave, position in octave

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
  low: [lowOctave, lowPos],
  high: [highOctave, highPos],
}: NoteBoundaryPair
) => {
  const notes: Array<Note> = [];
  for (let octave = lowOctave; octave <= highOctave; octave++) {
    const startPos = octave === lowOctave ? lowPos : 1;
    const endPos = octave === highOctave ? highPos : 7;
    for (let pos = startPos; pos <= endPos; pos++) {
      notes.push([octave, pos]);
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

export const makeNoteStr = (notes: Array<Note>, beatsPerBar: number): string => {
  const restsPerBar = beatsPerBar - notes.length;
  let restStr = '';
  if (restsPerBar >= 2) {
    restStr += 'B4/h/r, ';
  }
  if (restsPerBar === 1 || restsPerBar === 3) {
    restStr += 'B4/q/r, ';
  }

  const letterAtPos = (pos: number) => 'CDEFGAB'[pos - 1];
  const noteStr = notes.map(([octave, pos]) => `${letterAtPos(pos)}${octave}/q`).join(', ');
  return restStr + noteStr;
};
