import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  makeNoteRange,
  makeRandomNote,
  makeRandomNotes,
  makeRepeatedNotes,
  makeNoteStr,
} from './utils/noteUtils.tsx'
import type { Note } from './utils/noteUtils.tsx'
import App from './components/App.tsx'
import './index.css'

// Start of code from original site:

import { Vex } from 'vexflow';
import type { EasyScore, System, Factory } from 'vexflow';

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
    <App
      beatsPerBar={BEATS_PER_BAR}
      initialBpm={INITIAL_BPM}
      vexFlowElementId="output"
      lowNote={LOW_NOTE}
      highNote={HIGH_NOTE}
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

// TODO: Can we do this within the VexFlow library functions?
const clearBar = (elementId: string) => {
  const outputElem = document.getElementById(elementId);
  if (!outputElem) {
    throw new Error(`No element found with id "${elementId}"`);
  }
  outputElem.innerHTML = '';
}

const renderBar = (elementId: string) => {
  clearBar(elementId);
  const numNotes = BEATS_PER_BAR - restsPerBar;
  const noteRange = makeNoteRange(LOW_NOTE, HIGH_NOTE);
  let notes;
  const allNotesShouldBeEqual = (document.getElementById('input-all-notes-equal') as HTMLInputElement).checked;
  if (allNotesShouldBeEqual) {
    notes = makeRepeatedNotes(makeRandomNote(noteRange), numNotes);
  } else {
    notes = makeRandomNotes(noteRange, numNotes);
  }

  const { vf, score, system } = setup(elementId);
  const noteStr = makeNoteStr(notes, BEATS_PER_BAR);
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

// renderBar('output');

document.body.addEventListener('keypress', (e) => {
  if (e.key === ' ') {
    // renderBar('output');
  }
});

for (let i = 1; i <= 3; i++) {
  const radioButton = document.getElementById(`input-rests-${i}`) as HTMLInputElement;
  radioButton.addEventListener('click', (_e) => {
    restsPerBar = getRestsPerBar();
    // renderBar('output');
  });
}

document.getElementById('input-all-notes-equal')!
  .addEventListener('change', () => /* renderBar('output') */{});

