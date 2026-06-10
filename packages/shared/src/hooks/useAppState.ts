import { useEffect, useRef, useState } from 'react';
import { generateNotes } from '../utils/noteUtils';
import type { Note, NoteBoundaryPair } from '../utils/noteUtils';
import useBeatInterval from './useBeatInterval';

type Params = {
  beatsPerBar: number;
  initialBpm: number;
  initialRests: number;
  noteBoundaryPairs: Record<string, NoteBoundaryPair>;
  beatClockEnabled?: boolean; // false in practice mode: no metronome, bar advances on completion
  // defer the on-wrap regeneration by this long (capped to one beat) so
  // tempo-mode verdict colors on the judged bar stay visible past the wrap
  beatWrapRegenDelayMs?: number;
};

export default function useAppState({
  beatsPerBar,
  initialBpm,
  initialRests,
  noteBoundaryPairs,
  beatClockEnabled = true,
  beatWrapRegenDelayMs = 0,
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

  const beatInterval =
    beatClockEnabled && bpm > 0 && Number.isFinite(bpm)
      ? Math.floor((1000 * 60) / bpm)
      : 0;

  const wrapRegenTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(wrapRegenTimer.current); // a deferred regen must not fire with stale settings
    setCurrentBeat(1);
    setNotes(genNotes());
  }, [bpm, numRests, allNotesShouldBeEqual]);

  useEffect(() => {
    if (currentBeat !== 1) return;
    clearTimeout(wrapRegenTimer.current);
    // capped to one beat so the regenerated bar still lands inside beat 1
    const delay = Math.min(beatWrapRegenDelayMs, beatInterval);
    if (delay > 0) {
      wrapRegenTimer.current = setTimeout(() => setNotes(genNotes()), delay);
    } else {
      setNotes(genNotes());
    }
  }, [currentBeat]);

  useEffect(() => () => clearTimeout(wrapRegenTimer.current), []);

  useEffect(() => {
    if (!beatClockEnabled) {
      setCurrentBeat(1);
    }
  }, [beatClockEnabled]);

  const regenerateNotes = () => setNotes(genNotes());

  useBeatInterval({
    beatsPerBar,
    currentBeat,
    beatInterval,
    setCurrentBeat,
  });

  return {
    notes,
    regenerateNotes,
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
