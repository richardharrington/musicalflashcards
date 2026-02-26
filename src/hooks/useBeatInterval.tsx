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
    if (beatInterval <= 0 || !Number.isFinite(beatInterval)) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setCurrentBeat(currentBeat % beatsPerBar + 1);
    }, beatInterval);
    return () => window.clearTimeout(timeoutId);
  }, [currentBeat, beatInterval, beatsPerBar, setCurrentBeat]);
}

export default useBeatInterval;



