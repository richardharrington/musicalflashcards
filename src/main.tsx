import React from 'react'
import ReactDOM from 'react-dom/client'
import type {
  NoteBoundaryPair,
} from './utils/noteUtils.tsx'
import {
  PITCH_CLASS,
} from './utils/noteUtils.tsx'
import App from './components/App.tsx'
import './index.css'

const NOTE_BOUNDARY_PAIRS: Record<string, NoteBoundaryPair> = {
  lowGToHighC: {
    low: [3, PITCH_CLASS.G],
    high: [5, PITCH_CLASS.C],
  },
  gStringOctave: {
    low: [3, PITCH_CLASS.G],
    high: [4, PITCH_CLASS.G],
  },
  cStringOctave: {
    low: [4, PITCH_CLASS.C],
    high: [5, PITCH_CLASS.C],
  },
  eStringOctave: {
    low: [4, PITCH_CLASS.E],
    high: [5, PITCH_CLASS.E],
  },
  aStringOctave: {
    low: [4, PITCH_CLASS.A],
    high: [5, PITCH_CLASS.A],
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
