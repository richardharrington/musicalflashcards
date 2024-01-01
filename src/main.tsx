import React from 'react'
import ReactDOM from 'react-dom/client'
import type { Note } from './utils/noteUtils.tsx'
import App from './components/App.tsx'
import './index.css'

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

