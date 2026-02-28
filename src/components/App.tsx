import { useEffect, useRef, useState } from 'react';
import VisualMetronome from './VisualMetronome';
import useBeatInterval from '../hooks/useBeatInterval';
import Bar from '../components/Bar';
import { generateNotes, getNoteBoundaryDisplayString } from '../utils/noteUtils.tsx'
import type { NoteBoundaryPair } from '../utils/noteUtils';

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
  const [renderMode, setRenderMode] = useState<'easyScore' | 'lowLevel'>('lowLevel');
  const [noteBoundaryPairName, setNoteBoundaryPair] = useState(
    'lowGToHighC'
  );
  const { low, high } = noteBoundaryPairs[noteBoundaryPairName];

  const [numRests, setNumRests] = useState(initialRests);
  const numNotes = beatsPerBar - numRests;

  const [allNotesShouldBeEqual, setAllNotesShouldBeEqual] = useState(false);
  const genNotes = () => generateNotes(numNotes, low, high, allNotesShouldBeEqual);

  // The initial value here is overridden immediately
  // anyway and set to 1, by the useEffect hook that listens
  // for changes in bpm, numRests, and allNotesShouldBeEqual
  const [currentBeat, setCurrentBeat] = useState(1);

  const [bpmInput, setBpmInput] = useState(initialBpm.toString());
  const bpm = bpmInput === '' ? 0 : parseFloat(bpmInput);
  const [notes, setNotes] = useState(genNotes());
  const bpmInputRef = useRef<HTMLInputElement>(null);

  const handleBpmChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setBpmInput(event.target.value);
  }

  const focusBpmInputAndMoveCursorToEnd = () => {
    const input = bpmInputRef.current;
    if (input) {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }
  }

  const handleNumRestsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newNumRests = parseInt(event.target.value, 10);
    newNumRests && setNumRests(newNumRests);
  }

  const handleBoundaryPairChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNoteBoundaryPair(event.target.value);
  }

  const handleAllNotesShouldBeEqualChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newAllNotesShouldBeEqual = event.target.checked;
    setAllNotesShouldBeEqual(newAllNotesShouldBeEqual);
  }

  const handleRenderModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRenderMode(event.target.value as 'easyScore' | 'lowLevel');
  }

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
            onChange={handleBoundaryPairChange}
          />
          <label>{getNoteBoundaryDisplayString(name)}</label>
        </p>
      )
    }
    return elems;
  }

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
            onChange={handleNumRestsChange}
          />
          <label>{i} rest</label>
        </span>
      );
    }
    return elems;
  }

  return (
    <>
      <h1 id="header">Musical Flashcards</h1>
      <Bar
        elementId={vexFlowElementId}
        notes={notes}
        beatsPerBar={beatsPerBar}
        renderMode={renderMode}
      />
      <VisualMetronome
        beatsPerBar={beatsPerBar}
        currentBeat={currentBeat}
      />
      <div className="content-container">
        <div className="content">
          <p className="bpm-row">
            <span className="bpm-input-wrapper">
              <input
                ref={bpmInputRef}
                type="text"
                className="input-bpm"
                name="input-bpm"
                id="input-bpm"
                value={bpmInput}
                onChange={handleBpmChange}
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
          <p>
            <span className="radio-input-row">
              <input
                type="radio"
                name="input-render-mode"
                value="easyScore"
                checked={renderMode === 'easyScore'}
                onChange={handleRenderModeChange}
              />
              <label>EasyScore</label>
            </span>
            <span className="radio-input-row">
              <input
                type="radio"
                name="input-render-mode"
                value="lowLevel"
                checked={renderMode === 'lowLevel'}
                onChange={handleRenderModeChange}
              />
              <label>Low-level</label>
            </span>
          </p>
          <p>
            {renderNoteBoundaryInputs()}
          </p>
          <p>
            <input
              type="checkbox"
              name="input-all-notes-equal"
              checked={allNotesShouldBeEqual}
              onChange={handleAllNotesShouldBeEqualChange}
            />
            <label>Make all notes in each round the same note</label>
          </p>
          <p>
            Coming soon:
            <ul>
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
          </p>
        </div>
      </div>
    </>
  );
}

export default App;
