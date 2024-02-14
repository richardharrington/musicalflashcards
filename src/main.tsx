import React from 'react'
import ReactDOM from 'react-dom/client'
import type { Note } from './utils/noteUtils.tsx'
import App from './components/App.tsx'
import './index.css'

const LOW_NOTE: Note = [3, 5]; // low G
const HIGH_NOTE: Note = [5, 1]; // high C
const BEATS_PER_BAR = 4; // TODO: Figure out how to make this work with a different number of notes
const INITIAL_BPM = 100;

// const SHOW_LETTERS = true; // not used yet
// const SHOW_FINGER_POSITIONS = true; // not used yet

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
