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
  // TODO: This should be beats-per-bar minus the user-inputted
  // number of rests
  const numNotes = 2;
  // TODO: This should also be user-inputted
  const allNotesShouldBeEqual = false;
  const genNotes = () => generateNotes(numNotes, lowNote, highNote, allNotesShouldBeEqual);

  const [currentBeat, setCurrentBeat] = useState(4);
  const [bpm, setBpm] = useState(initialBpm);
  const [notes, setNotes] = useState(genNotes());

  const handleBpmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseFloat(event.target.value.trim());
    newBpm && setBpm(newBpm);
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

  return (
    <>
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
        </div>
      </div>
    </>
  );
}

export default App;
