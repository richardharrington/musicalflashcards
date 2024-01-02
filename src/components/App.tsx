import { useEffect, useState } from 'react';
import VisualMetronome from './VisualMetronome';
import useBeatInterval from '../hooks/useBeatInterval';
import Bar from '../components/Bar';
import type { Note } from '../utils/noteUtils';

import { generateNotes } from '../utils/noteUtils.tsx'

type Props = {
  beatsPerBar: number;
  initialBpm: number;
  vexFlowElementId: string;
  lowNote: Note;
  highNote: Note;
};

function App({
  beatsPerBar,
  initialBpm,
  vexFlowElementId,
  lowNote,
  highNote,
}: Props) {
  const [numRests, setNumRests] = useState(1);
  const numNotes = beatsPerBar - numRests;
  const [allNotesShouldBeEqual, setAllNotesShouldBeEqual] = useState(false);
  const genNotes = () => generateNotes(numNotes, lowNote, highNote, allNotesShouldBeEqual);

  // The initial value here is overridden immediately
  // anyway and set to 1, by the useEffect hook that listens
  // for changes in bpm, numRests, and allNotesShouldBeEqual
  const [currentBeat, setCurrentBeat] = useState(1);

  const [bpmInput, setBpmInput] = useState(initialBpm.toString());
  const bpm = parseFloat(bpmInput);
  const [notes, setNotes] = useState(genNotes());

  const handleBpmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newBpmInput = event.target.value;
    newBpmInput && setBpmInput(newBpmInput);
  }

  const handleNumRestsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newNumRests = parseInt(event.target.value, 10);
    newNumRests && setNumRests(newNumRests);
  }

  const handleAllNotesShouldBeEqualChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newAllNotesShouldBeEqual = event.target.checked;
    setAllNotesShouldBeEqual(newAllNotesShouldBeEqual);
  }

  useEffect(() => {
    setCurrentBeat(1);
    setNotes(genNotes());
  }, [bpm, numRests, allNotesShouldBeEqual]);

  useEffect(() => {
    if (currentBeat === 1) {
      setNotes(genNotes());
    }
  }, [currentBeat]);

  const beatInterval = Math.floor((1000 * 60) / bpm);

  useBeatInterval({
    beatsPerBar,
    currentBeat,
    beatInterval,
    setCurrentBeat,
  });

  const renderRestInputs = () => {
    const elems = [];
    for (let i = 1; i <= 3; i++) {
      elems.push(
        <span className="rests-input" key={i}>
          <input
            type="radio"
            name="input-rests"
            value={i}
            checked={numRests === i}
            onChange={handleNumRestsChange}
          />
          <label>{i} rest</label>
        </span>
      );
    }
    return elems;
  }

  return (
    <>
      <h1 id="header">Musical Flashcards</h1>
      <Bar
        elementId={vexFlowElementId}
        notes={notes}
        beatsPerBar={beatsPerBar}
      />
      <VisualMetronome
        beatsPerBar={beatsPerBar}
        currentBeat={currentBeat}
      />
      <div className="content-container">
        <div className="content">
          <p>
            <input
              type="text"
              className="input-bpm"
              name="input-bpm"
              value={bpm}
              onChange={handleBpmChange}
            />
            <label>Beats per minute</label>
          </p>
          <p>
            {renderRestInputs()}
          </p>
          <p>
            <input
              type="checkbox"
              name="input-all-notes-equal"
              checked={allNotesShouldBeEqual}
              onChange={handleAllNotesShouldBeEqualChange}
            />
            <label>Make all notes in each round the same note</label>
          </p>
          <p>
            Coming soon:
            <ul>
              <li>
                Option to have metronomic audio cues for the notes.
              </li>
              <li>
                Option to annotate each note with its letter
              </li>
              <li>
                Option to annotate each note with its finger number
              </li>
            </ul>
          </p>
        </div>
      </div>
    </>
  );
}

export default App;
