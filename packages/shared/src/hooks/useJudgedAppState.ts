import { useCallback, useEffect, useRef, useState } from 'react';
import useAppState from './useAppState.ts';
import usePitchPipeline from './usePitchPipeline.ts';
import type { CreateMicSource, PipelineFrame } from './usePitchPipeline.ts';
import { createPracticeJudge } from '../pitch/practiceJudge.ts';
import type { PracticeSnapshot } from '../pitch/practiceJudge.ts';
import { createTempoJudge } from '../pitch/tempoJudge.ts';
import type { TempoSnapshot } from '../pitch/tempoJudge.ts';
import { noteToMidi } from '../pitch/quantize.ts';
import { BAR_COMPLETE_DELAY_MS } from '../pitch/constants.ts';
import type { NoteBoundaryPair } from '../utils/noteUtils.tsx';

export type Mode = 'practice' | 'tempo';

type Params = {
  beatsPerBar: number;
  initialBpm: number;
  initialRests: number;
  noteBoundaryPairs: Record<string, NoteBoundaryPair>;
  // platform-specific pieces, passed through to usePitchPipeline
  createMicSource: CreateMicSource;
  micErrorToMessage: (err: unknown) => string;
};

// useAppState plus the whole judging layer: the pitch pipeline, judge
// lifecycles, snapshot state, and bar-complete regeneration. Platform App
// components are pure UI over this hook's return value.
export default function useJudgedAppState({
  beatsPerBar,
  initialBpm,
  initialRests,
  noteBoundaryPairs,
  createMicSource,
  micErrorToMessage,
}: Params) {
  const [mode, setMode] = useState<Mode>('tempo');

  const practiceJudgeRef = useRef<ReturnType<typeof createPracticeJudge> | null>(null);
  const tempoJudgeRef = useRef<ReturnType<typeof createTempoJudge> | null>(null);
  const [practice, setPractice] = useState<PracticeSnapshot | null>(null);
  const [tempo, setTempo] = useState<TempoSnapshot | null>(null);

  // judges consume frames directly (60 Hz); React state only changes when a
  // snapshot actually changes (the judges return a stable reference otherwise)
  const handlePipelineFrame = useCallback((frame: PipelineFrame) => {
    const practiceJudge = practiceJudgeRef.current;
    if (practiceJudge !== null) {
      const snapshot = practiceJudge.processFrame(frame);
      setPractice((prev) => (prev === snapshot ? prev : snapshot));
    }
    const tempoJudge = tempoJudgeRef.current;
    if (tempoJudge !== null) {
      const snapshot = tempoJudge.processFrame(frame);
      setTempo((prev) => (prev === snapshot ? prev : snapshot));
    }
  }, []);

  const { listening, error: micError, toggle: toggleListen, currentReading } =
    usePitchPipeline({ createMicSource, micErrorToMessage, onFrame: handlePipelineFrame });

  const practiceJudging = mode === 'practice' && listening;
  const tempoJudging = mode === 'tempo' && listening;

  const appState = useAppState({
    beatsPerBar,
    initialBpm,
    initialRests,
    noteBoundaryPairs,
    beatClockEnabled: mode === 'tempo',
    // hold the judged bar on screen past the wrap so the final window's
    // verdict (especially a gray "missed") is actually visible
    beatWrapRegenDelayMs: tempoJudging ? BAR_COMPLETE_DELAY_MS : 0,
  });
  const { notes, regenerateNotes, currentBeat } = appState;

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const currentBeatRef = useRef(currentBeat);
  currentBeatRef.current = currentBeat;

  // fresh practice judge whenever the bar changes or practice judging starts/stops
  useEffect(() => {
    practiceJudgeRef.current = practiceJudging
      ? createPracticeJudge(notes.map(noteToMidi))
      : null;
    setPractice(null);
  }, [notes, practiceJudging]);

  // one tempo judge for as long as tempo judging runs: the mic-check hint
  // counts consecutive bars, so the judge must survive bar regeneration
  useEffect(() => {
    tempoJudgeRef.current = tempoJudging
      ? createTempoJudge({
          targetMidis: notesRef.current.map(noteToMidi),
          beatsPerBar,
          initialBeat: currentBeatRef.current,
        })
      : null;
    setTempo(null);
  }, [tempoJudging, beatsPerBar]);

  useEffect(() => {
    const judge = tempoJudgeRef.current;
    if (judge === null) return;
    setTempo(judge.setTargets(notes.map(noteToMidi)));
  }, [notes]);

  useEffect(() => {
    const judge = tempoJudgeRef.current;
    if (judge === null) return;
    const snapshot = judge.onBeat(currentBeat);
    setTempo((prev) => (prev === snapshot ? prev : snapshot));
  }, [currentBeat]);

  const regenerateNotesRef = useRef(regenerateNotes);
  regenerateNotesRef.current = regenerateNotes;

  useEffect(() => {
    if (!practice?.barComplete) return;
    const timeoutId = setTimeout(() => regenerateNotesRef.current(), BAR_COMPLETE_DELAY_MS);
    return () => clearTimeout(timeoutId);
  }, [practice]);

  return {
    ...appState,

    mode,
    setMode,

    listening,
    micError,
    toggleListen,
    currentReading,

    practiceJudging,
    tempoJudging,
    micHintVisible: tempoJudging && (tempo?.micPossiblyDead ?? false),

    // measure decorations for Bar, already gated by the active judging mode
    noteVerdicts: practiceJudging
      ? practice?.verdicts
      : tempoJudging
        ? tempo?.noteVerdicts
        : undefined,
    restWindowVerdicts: tempoJudging ? tempo?.restWindowVerdicts : undefined,
    cursorIndex: practiceJudging ? practice?.cursorIndex ?? 0 : undefined,
  };
}
