import { useRef } from 'react';
import cx from 'classnames';
import VisualMetronome from './VisualMetronome';
import Bar from './Bar';
import LiveReadout from './LiveReadout';
import { createMicSource, micErrorToMessage } from '../audio/micSource.ts';
import {
  getNoteBoundaryDisplayString,
  useJudgedAppState,
} from '@musicalflashcards/shared';
import type { Mode, NoteBoundaryPair } from '@musicalflashcards/shared';

type Props = {
  beatsPerBar: number;
  initialBpm: number;
  initialRests: number;
  vexFlowElementId: string;
  noteBoundaryPairs: Record<string, NoteBoundaryPair>;
};

function App({
  beatsPerBar,
  initialBpm,
  initialRests,
  vexFlowElementId,
  noteBoundaryPairs,
}: Props) {
  const {
    mode,
    setMode,
    listening,
    micError,
    toggleListen,
    currentReading,
    micHintVisible,
    noteVerdicts,
    restWindowVerdicts,
    cursorIndex,
    notes,
    currentBeat,
    bpmInput,
    setBpmInput,
    numRests,
    setNumRests,
    allNotesShouldBeEqual,
    setAllNotesShouldBeEqual,
    noteBoundaryPairName,
    setNoteBoundaryPairName,
  } = useJudgedAppState({
    beatsPerBar,
    initialBpm,
    initialRests,
    noteBoundaryPairs,
    createMicSource,
    micErrorToMessage,
  });

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
        noteVerdicts={noteVerdicts}
        restWindowVerdicts={restWindowVerdicts}
        cursorIndex={cursorIndex}
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
        {micHintVisible && (
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
