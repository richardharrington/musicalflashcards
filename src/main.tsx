import React from 'react'
import ReactDOM from 'react-dom/client'
import type { NoteBoundaryPair } from './utils/noteUtils.tsx'
import App from './components/App.tsx'
import './index.css'

const NOTE_BOUNDARY_PAIRS: Record<string, NoteBoundaryPair> = {
  lowGToHighC: {
    low: [3, 5],
    high: [5, 1],
  },
  gStringOctave: {
    low: [3, 5],
    high: [4, 5],
  },
  cStringOctave: {
    low: [4, 1],
    high: [5, 1],
  },
  eStringOctave: {
    low: [4, 3],
    high: [5, 3],
  },
  aStringOctave: {
    low: [4, 6],
    high: [5, 6],
  },
};

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
      noteBoundaryPairs={NOTE_BOUNDARY_PAIRS}
    />
  </React.StrictMode>,
)
