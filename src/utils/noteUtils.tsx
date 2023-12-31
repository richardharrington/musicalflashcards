export type Note = [number, number]; // octave, position in octave

export const makeNoteRange = (
  [lowOctave, lowPos]: Note,
  [highOctave, highPos]: Note,
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