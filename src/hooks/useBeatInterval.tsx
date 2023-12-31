import React, { useEffect } from 'react';

function useBeatInterval({
  beatsPerBar,
  currentBeat,
  beatInterval,
  setCurrentBeat,
}: {
  beatsPerBar: number;
  currentBeat: number;
  beatInterval: number;
  setCurrentBeat: React.Dispatch<React.SetStateAction<number>>;
}) {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentBeat(currentBeat % beatsPerBar + 1);
    }, beatInterval);
    return () => window.clearTimeout(timeoutId);
  }, [currentBeat]);
}

export default useBeatInterval;



