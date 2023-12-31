import { useState } from 'react';
import VisualBeats from './VisualBeats';
import useBeatInterval from '../hooks/useBeatInterval';

type Props = {
  beatsPerBar: number,
  beatInterval: number,
};

function Metronome({ beatsPerBar, beatInterval }: Props) {
  const [currentBeat, setCurrentBeat] = useState(4);
  useBeatInterval({
    beatsPerBar,
    currentBeat,
    beatInterval,
    setCurrentBeat,
  });

  return (
    <VisualBeats
      beatsPerBar={beatsPerBar}
      currentBeat={currentBeat}
    />
  );
}

export default Metronome;
