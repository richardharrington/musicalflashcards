import { useState } from 'react';
import VisualBeats from './VisualBeats';
import useBeatInterval from '../hooks/useBeatInterval';

type Props = {
  beatsPerBar: number,
  initialBpm: number,
};

function Metronome({ beatsPerBar, initialBpm }: Props) {
  const [currentBeat, setCurrentBeat] = useState(4);
  const [bpm, setBpm] = useState(initialBpm);

  const beatInterval = Math.floor((1000 * 60) / bpm);

  useBeatInterval({
    beatsPerBar,
    currentBeat,
    beatInterval,
    setCurrentBeat,
  });

  const handleBpmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newBpm = parseFloat(event.target.value.trim());
    newBpm && setBpm(newBpm);
  }

  return (
    <>
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

export default Metronome;
