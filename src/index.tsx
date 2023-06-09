import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Start of code from original site:

import { Vex } from 'vexflow';
import type { EasyScore, System, Factory } from 'vexflow';

type Note = [number, number]; // octave, position in octave

const LOW_NOTE: Note = [4, 1]; // middle C
const HIGH_NOTE: Note = [5, 1]; // high C
const BEATS_PER_BAR = 4; // TODO: Figure out how to make this work with a different number of notes

// const SHOW_LETTERS = true; // not used yet
// const SHOW_FINGER_POSITIONS = true; // not used yet

// Takes beatsPerMinute and returns interval between beats in milliseconds
const getBeatInterval = (elem: HTMLInputElement) => {
  const beatsPerMinute = parseFloat(elem.value.trim());
  if (!beatsPerMinute) {
    return null;
  }
  return Math.floor((1000 * 60) / beatsPerMinute);
}

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

let beatInterval = getBeatInterval(document.getElementById('input-bpm') as HTMLInputElement);
let beatIntervalId: number | undefined;
let beatIdx = BEATS_PER_BAR;

let restsPerBar = getRestsPerBar();

const setup = (): { vf: Factory, score: EasyScore, system: System } => {
  const vf = new Vex.Flow.Factory({
    renderer: { elementId: 'output', width: 500, height: 200 },
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

const areTwoNotesEqual = (note1: Note | undefined, note2: Note | undefined): boolean => {
  if (!note1 && !note2) {
    return true;
  }
  if (!note1 || !note2) {
    return false;
  }
  const [octave1, pos1] = note1;
  const [octave2, pos2] = note2;
  return octave1 === octave2 && pos1 === pos2;
};

const renderBeat = () => {
  // Beat is indexed from 1
  const nextBeatIdx = beatIdx % BEATS_PER_BAR + 1;
  const prevElem = document.getElementById(`beat-${beatIdx}`);
  const nextElem = document.getElementById(`beat-${nextBeatIdx}`);
  // TODO (here and everywhere we use .getElementById): Come up
  // with a system for giving better errors here than whatever
  // these exclamation points will give us.
  prevElem!.style.opacity = '0';
  nextElem!.style.opacity = '1';
  beatIdx = nextBeatIdx;
  if (beatIdx === 1) {
    renderBar();
  }
}

const clearBeatsDisplay = () => {
  for (let i = 1; i <= BEATS_PER_BAR; i++) {
    const elem = document.getElementById(`beat-${i}`);
    elem!.style.opacity = '0';
  }
}

const clearBar = () => {
  const outputElem = document.getElementById('output');
  if (!outputElem) {
    throw new Error('No element found with id "output"');
  }
  outputElem.innerHTML = '';
}

const renderBar = () => {
  clearBar();
  const noteRange = makeNoteRange(LOW_NOTE, HIGH_NOTE);
  let notes;
  const allNotesShouldBeEqual = (document.getElementById('input-all-notes-equal') as HTMLInputElement).checked;
  if (allNotesShouldBeEqual) {
    notes = makeRepeatedNotes(makeRandomNote(noteRange));
  } else {
    notes = makeRandomNotes(noteRange);
  }

  const { vf, score, system } = setup();
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

const resetAndGo = () => {
  window.clearInterval(beatIntervalId);
  clearBeatsDisplay();
  beatIdx = BEATS_PER_BAR;
  renderBeat();
  if (!beatInterval) {
    throw new Error('Invariant: there should always be a value at this point');
  }
  beatIntervalId = window.setInterval(renderBeat, beatInterval);
};

resetAndGo();

document.body.addEventListener('keypress', (e) => {
  if (e.key === ' ') {
    resetAndGo();
  }
});

document.getElementById('input-bpm')!.addEventListener('input', (e) => {
  const newBeatInterval = getBeatInterval(e.target as HTMLInputElement);
  if (newBeatInterval) {
    beatInterval = newBeatInterval;
    resetAndGo();
  }
});

for (let i = 1; i <= 3; i++) {
  const radioButton = document.getElementById(`input-rests-${i}`) as HTMLInputElement;
  radioButton.addEventListener('click', (e) => {
    restsPerBar = getRestsPerBar();
    resetAndGo();
  });
}

document.getElementById('input-all-notes-equal')!.addEventListener('change', resetAndGo);
