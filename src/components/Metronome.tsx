import { useState, useEffect } from 'react';
import VisualBeats from './VisualBeats';

// function useBeatInterval({ serverUrl, roomId }) {
//   useEffect(() => {
//     const options = {
//       serverUrl: serverUrl,
//       roomId: roomId
//     };
//     const connection = createConnection(options);
//     connection.connect();
//     return () => connection.disconnect();
//   }, [roomId, serverUrl]);
// }

type Props = {
  beatsPerBar: number,
  beatInterval: number,
};

function Metronome({ beatsPerBar, beatInterval }: Props) {
  const [currentBeat, setCurrentBeat] = useState(4);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentBeat(currentBeat % beatsPerBar + 1);
    }, beatInterval);
    return () => window.clearTimeout(timeoutId);
  });

  return (
    <VisualBeats
      beatsPerBar={beatsPerBar}
      currentBeat={currentBeat}
    />
  );
}

export default Metronome;



