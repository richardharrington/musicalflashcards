import { useEffect, useState } from 'react';
import VisualBeats from './VisualBeats';
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

  const [currentBeat, setCurrentBeat] = useState(4);
  const [bpm, setBpm] = useState(initialBpm);
  const [notes, setNotes] = useState(genNotes());

  const handleBpmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseFloat(event.target.value.trim());
    newBpm && setBpm(newBpm);
  }

  const handleNumRestsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newNumRests = parseInt(event.target.value.trim(), 10);
    newNumRests && setNumRests(newNumRests);
  }

  const handleAllNotesShouldBeEqualChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newAllNotesShouldBeEqual = event.target.checked;
    setAllNotesShouldBeEqual(newAllNotesShouldBeEqual);
  }

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
      <VisualBeats
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
