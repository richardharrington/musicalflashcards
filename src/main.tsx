import React from 'react'
import ReactDOM from 'react-dom/client'
import Metronome from './components/Metronome.tsx'
import './index.css'

// Start of code from original site:

import { Vex } from 'vexflow';
import type { EasyScore, System, Factory } from 'vexflow';

type Note = [number, number]; // octave, position in octave

const LOW_NOTE: Note = [3, 5]; // low G
const HIGH_NOTE: Note = [5, 2]; // high D
const BEATS_PER_BAR = 4; // TODO: Figure out how to make this work with a different number of notes
const INITIAL_BPM=100;

// const SHOW_LETTERS = true; // not used yet
// const SHOW_FINGER_POSITIONS = true; // not used yet

const getRestsPerBar = () => {
  const radio1 = document.getElementById('input-rests-1') as HTMLInputElement;
  const radio2 = document.getElementById('input-rests-2') as HTMLInputElement;
  const radio3 = document.getElementById('input-rests-3') as HTMLInputElement;
  if (radio1.checked) {
    return 1;
  } else if (radio2.checked) {
    return 2;
  } else if (radio3.checked) {
    return 3;
  } else {
    throw new Error('No radio button checked');
  }
}

let restsPerBar = getRestsPerBar();

// TODO: Tie this into user input for resetting things.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Metronome
      beatsPerBar={BEATS_PER_BAR}
      initialBpm={INITIAL_BPM}
    />
  </React.StrictMode>,
)

const setup = (elementId: string): { vf: Factory, score: EasyScore, system: System } => {
  const vf = new Vex.Flow.Factory({
    renderer: { elementId, width: 500, height: 200 },
  });
  const score = vf.EasyScore();
  const system = vf.System();

  return { vf, score, system };
}

const makeNoteRange = (
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

const makeRandomNote = (noteRange: Array<Note>): Note => {
  return noteRange[Math.floor(Math.random() * noteRange.length)];
};

const makeRandomNotes = (noteRange: Array<Note>): Array<Note> => {
  const notes: Array<Note> = [];
  for (let i = 0; i < BEATS_PER_BAR - restsPerBar; i++) {
    notes.push(makeRandomNote(noteRange));
  }
  return notes;
}

const makeRepeatedNotes = (note: Note): Array<Note> => {
  const notes: Array<Note> = [];
  for (let i = 0; i < BEATS_PER_BAR - restsPerBar; i++) {
    notes.push(note);
  }
  return notes;
};

const makeNoteStr = (notes: Array<Note>): string => {
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

const clearBar = (elementId: string) => {
  const outputElem = document.getElementById(elementId);
  if (!outputElem) {
    throw new Error(`No element found with id "${elementId}"`);
  }
  outputElem.innerHTML = '';
}

const renderBar = (elementId: string) => {
  clearBar(elementId);
  const noteRange = makeNoteRange(LOW_NOTE, HIGH_NOTE);
  let notes;
  const allNotesShouldBeEqual = (document.getElementById('input-all-notes-equal') as HTMLInputElement).checked;
  if (allNotesShouldBeEqual) {
    notes = makeRepeatedNotes(makeRandomNote(noteRange));
  } else {
    notes = makeRandomNotes(noteRange);
  }

  const { vf, score, system } = setup(elementId);
  const noteStr = makeNoteStr(notes);
  system
    .addStave({
      voices: [
        // TODO: To make this actually playable on a metronomic beat
        // with visual cues or auditory cues.
        score.voice(score.notes(noteStr, { stem: 'auto' })),
      ],
    })
    .addClef('treble')
    .addTimeSignature('4/4');

  vf.draw();
}

renderBar('output');

document.body.addEventListener('keypress', (e) => {
  if (e.key === ' ') {
    renderBar('output');
  }
});

for (let i = 1; i <= 3; i++) {
  const radioButton = document.getElementById(`input-rests-${i}`) as HTMLInputElement;
  radioButton.addEventListener('click', (_e) => {
    restsPerBar = getRestsPerBar();
    renderBar('output');
  });
}

document.getElementById('input-all-notes-equal')!
  .addEventListener('change', () => renderBar('output'));

