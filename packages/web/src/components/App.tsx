import { useCallback, useEffect, useRef, useState } from 'react';
import cx from 'classnames';
import VisualMetronome from './VisualMetronome';
import Bar from './Bar';
import LiveReadout from './LiveReadout';
import usePitchPipeline from '../hooks/usePitchPipeline.ts';
import type { PipelineFrame } from '../hooks/usePitchPipeline.ts';
import {
  getNoteBoundaryDisplayString,
  useAppState,
  createPracticeJudge,
  createTempoJudge,
  noteToMidi,
} from '@musicalflashcards/shared';
import type {
  NoteBoundaryPair,
  PracticeSnapshot,
  TempoSnapshot,
} from '@musicalflashcards/shared';

type Props = {
  beatsPerBar: number;
  initialBpm: number;
  initialRests: number;
  vexFlowElementId: string;
  noteBoundaryPairs: Record<string, NoteBoundaryPair>;
};

type Mode = 'practice' | 'tempo';

// let the player see the last note turn green before the bar regenerates
const BAR_COMPLETE_DELAY_MS = 600;

function App({
  beatsPerBar,
  initialBpm,
  initialRests,
  vexFlowElementId,
  noteBoundaryPairs,
}: Props) {
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
    usePitchPipeline(handlePipelineFrame);

  const practiceJudging = mode === 'practice' && listening;
  const tempoJudging = mode === 'tempo' && listening;

  const {
    notes,
    regenerateNotes,
    currentBeat,
    bpmInput,
    setBpmInput,
    numRests,
    setNumRests,
    allNotesShouldBeEqual,
    setAllNotesShouldBeEqual,
    noteBoundaryPairName,
    setNoteBoundaryPairName,
  } = useAppState({
    beatsPerBar,
    initialBpm,
    initialRests,
    noteBoundaryPairs,
    beatClockEnabled: mode === 'tempo',
    // hold the judged bar on screen past the wrap so the final window's
    // verdict (especially a gray "missed") is actually visible
    beatWrapRegenDelayMs: tempoJudging ? BAR_COMPLETE_DELAY_MS : 0,
  });

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
    const timeoutId = window.setTimeout(() => regenerateNotesRef.current(), BAR_COMPLETE_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [practice]);

  const bpmInputRef = useRef<HTMLInputElement>(null);

  const focusBpmInputAndMoveCursorToEnd = () => {
    const input = bpmInputRef.current;
    if (input) {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  };

  const renderNoteBoundaryInputs = () => {
    const elems = [];
    for (const name of Object.keys(noteBoundaryPairs)) {
      elems.push(
        <p key={name} className="radio-input-column">
          <input
            type="radio"
            name="input-note-boundary-pairs"
            value={name}
            checked={noteBoundaryPairName === name}
            onChange={(e) => setNoteBoundaryPairName(e.target.value)}
          />
          <label>{getNoteBoundaryDisplayString(name)}</label>
        </p>
      );
    }
    return elems;
  };

  const renderRestInputs = () => {
    const elems = [];
    for (let i = 1; i <= 3; i++) {
      elems.push(
        <span className="radio-input-row" key={i}>
          <input
            type="radio"
            name="input-rests"
            value={i}
            checked={numRests === i}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (val) setNumRests(val);
            }}
          />
          <label>{i} rest</label>
        </span>
      );
    }
    return elems;
  };

  const renderModeInputs = () => {
    const modes: Array<[Mode, string]> = [['practice', 'Practice'], ['tempo', 'Tempo']];
    return modes.map(([value, label]) => (
      <span className="radio-input-row" key={value}>
        <input
          type="radio"
          name="input-mode"
          value={value}
          checked={mode === value}
          onChange={() => setMode(value)}
        />
        <label>{label}</label>
      </span>
    ));
  };

  return (
    <>
      <h1 id="header">Musical Flashcards</h1>
      <Bar
        elementId={vexFlowElementId}
        notes={notes}
        beatsPerBar={beatsPerBar}
        noteVerdicts={
          practiceJudging ? practice?.verdicts : tempoJudging ? tempo?.noteVerdicts : undefined
        }
        restWindowVerdicts={tempoJudging ? tempo?.restWindowVerdicts : undefined}
        cursorIndex={practiceJudging ? practice?.cursorIndex ?? 0 : undefined}
      />
      <div id="pitch-controls">
        <button
          id="listen-toggle"
          className={cx({ listening, 'listen-error-state': micError !== null })}
          onClick={() => void toggleListen()}
        >
          {listening ? 'Stop listening' : 'Listen'}
        </button>
        {micError !== null && <span className="listen-error">{micError}</span>}
        {tempoJudging && tempo?.micPossiblyDead && (
          <span className="mic-hint">Check your microphone?</span>
        )}
      </div>
      {listening && (
        <LiveReadout reading={currentReading} prominent={mode === 'practice'} />
      )}
      {mode === 'practice' && !listening && (
        <p className="practice-prompt">
          Turn on Listen, then play each highlighted note to advance.
        </p>
      )}
      {mode === 'tempo' && (
        <VisualMetronome
          beatsPerBar={beatsPerBar}
          currentBeat={currentBeat}
        />
      )}
      <div className="content-container">
        <div className="content">
          <p>
            {renderModeInputs()}
          </p>
          <p className="bpm-row">
            <span className="bpm-input-wrapper">
              <input
                ref={bpmInputRef}
                type="text"
                className="input-bpm"
                name="input-bpm"
                id="input-bpm"
                value={bpmInput}
                onChange={(e) => setBpmInput(e.target.value)}
              />
              <span
                className="bpm-input-overlay"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  focusBpmInputAndMoveCursorToEnd();
                }}
                onMouseDown={(e) => e.preventDefault()}
                role="presentation"
                aria-hidden
              />
            </span>
            <label htmlFor="input-bpm">Beats per minute</label>
          </p>
          <p>
            {renderRestInputs()}
          </p>
          <div>
            {renderNoteBoundaryInputs()}
          </div>
          <p>
            <input
              type="checkbox"
              name="input-all-notes-equal"
              checked={allNotesShouldBeEqual}
              onChange={(e) => setAllNotesShouldBeEqual(e.target.checked)}
            />
            <label>Make all notes in each round the same note</label>
          </p>
          <p>
            Coming soon:
          </p>
          <ul className="coming-soon-list">
            <li>
              Option to have metronomic audio cues for the notes.
            </li>
            <li>
              Option to annotate each note with its letter
            </li>
            <li>
              Option to annotate each note with its finger number
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}

export default App;
