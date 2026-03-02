import { useEffect, useState } from 'react';
import { generateNotes } from '../utils/noteUtils';
import type { Note, NoteBoundaryPair } from '../utils/noteUtils';
import useBeatInterval from './useBeatInterval';

type Params = {
  beatsPerBar: number;
  initialBpm: number;
  initialRests: number;
  noteBoundaryPairs: Record<string, NoteBoundaryPair>;
};

export default function useAppState({
  beatsPerBar,
  initialBpm,
  initialRests,
  noteBoundaryPairs,
}: Params) {
  const [noteBoundaryPairName, setNoteBoundaryPairName] = useState('lowGToHighC');
  const { low, high } = noteBoundaryPairs[noteBoundaryPairName];

  const [numRests, setNumRests] = useState(initialRests);
  const numNotes = beatsPerBar - numRests;

  const [allNotesShouldBeEqual, setAllNotesShouldBeEqual] = useState(false);
  const genNotes = () => generateNotes(numNotes, low, high, allNotesShouldBeEqual);

  const [currentBeat, setCurrentBeat] = useState(1);

  const [bpmInput, setBpmInput] = useState(initialBpm.toString());
  const bpm = bpmInput === '' ? 0 : parseFloat(bpmInput);
  const [notes, setNotes] = useState<Array<Note>>(genNotes());

  useEffect(() => {
    setCurrentBeat(1);
    setNotes(genNotes());
  }, [bpm, numRests, allNotesShouldBeEqual]);

  useEffect(() => {
    if (currentBeat === 1) {
      setNotes(genNotes());
    }
  }, [currentBeat]);

  const beatInterval =
    bpm > 0 && Number.isFinite(bpm) ? Math.floor((1000 * 60) / bpm) : 0;

  useBeatInterval({
    beatsPerBar,
    currentBeat,
    beatInterval,
    setCurrentBeat,
  });

  return {
    notes,
    currentBeat,
    beatsPerBar,

    bpmInput,
    setBpmInput,

    numRests,
    setNumRests,

    allNotesShouldBeEqual,
    setAllNotesShouldBeEqual,

    noteBoundaryPairName,
    setNoteBoundaryPairName,
    noteBoundaryPairs,
  };
}
