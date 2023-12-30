import { useState, useEffect } from 'react';
import cx from 'classnames';

type Props = {
  beatsPerBar: number,
  beatInterval: number | null,
};

function VisualMetronome({ beatsPerBar, beatInterval }: Props) {
  if (beatInterval === null) {
    return null;
  }
  const [currentBeat, setCurrentBeat] = useState(4);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentBeat(currentBeat % beatsPerBar + 1);
    }, beatInterval);
    return () => window.clearTimeout(timeoutId);
  });

  const renderBeats = () => {
    const elems = [];
    for (let i = 1; i <= beatsPerBar; i++) {
      const className = cx({
        'visual-metronome-numeral': true,
        'show-beat': i === currentBeat,
      });
      elems.push(
        <span key={i} className={className}>
          {i}&nbsp;
        </span>
      );
    }
    return elems;
  }

  return (
    <>
      {renderBeats()}
    </>
  );
}

export default VisualMetronome;



