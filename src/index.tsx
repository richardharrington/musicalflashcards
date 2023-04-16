import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Start of code from original site:

import { Vex } from 'vexflow';
import type { EasyScore, System, Factory } from 'vexflow';

type Note = [number, number]; // octave, position in octave

const LOW_NOTE: Note = [4, 1]; // middle C
const HIGH_NOTE: Note = [5, 1]; // high C
const NUMBER_OF_COUNTS = 4; // TODO: Figure out how to make this work with a different number of notes

// const SHOW_LETTERS = true; // not used yet
// const SHOW_FINGER_POSITIONS = true; // not used yet

// Takes bpm (notes per minute) and returns interval in
// milliseconds (interval between rounds, not between notes).
const getIntervalVal = (elem: HTMLInputElement) => {
    const bpm = parseFloat(elem.value.trim());
    if (!bpm) {
        return null;
    }
    return Math.floor(60 / bpm * NUMBER_OF_COUNTS * 1000);
}

const getNumberOfRests = () => {
    const radio1 = document.getElementById('input-rests-1') as HTMLInputElement;
    const radio2 = document.getElementById('input-rests-2') as HTMLInputElement;
    const radio3 = document.getElementById('input-rests-3') as HTMLInputElement;
    if (radio1.checked) {
        return 1;
    } else if (radio2.checked) {
        return 2;
    } else if (radio3.checked) {
        return 3;
    } else {
        throw new Error('No radio button checked');
    }
}


let interval;
let intervalVal = getIntervalVal(document.getElementById('input-bpm') as HTMLInputElement);
let countInterval;
let count = NUMBER_OF_COUNTS;
let numberOfRests = getNumberOfRests();


const setup = (): { vf: Factory, score: EasyScore, system: System } => {
    const vf = new Vex.Flow.Factory({
        renderer: { elementId: 'output', width: 500, height: 200 },
    });
    const score = vf.EasyScore();
    const system = vf.System();

    return { vf, score, system };
}

const makeNoteRange = (
    [lowOctave, lowPos]: Note,
    [highOctave, highPos]: Note,
) => {
    const notes: Array<Note> = [];
    for (let octave = lowOctave; octave <= highOctave; octave++) {
        const startPos = octave === lowOctave ? lowPos : 1;
        const endPos = octave === highOctave ? highPos : 7;
        for (let pos = startPos; pos <= endPos; pos++) {
            notes.push([octave, pos]);
        }
    }
    return notes;
}

const randomNote = (noteRange: Array<Note>): Note => {
    return noteRange[Math.floor(Math.random() * noteRange.length)];
};

const makeRandomNotes = (noteRange: Array<Note>): Array<Note> => {
    const notes: Array<Note> = [];
    for (let i = 0; i < NUMBER_OF_COUNTS - numberOfRests; i++) {
        notes.push(randomNote(noteRange));
    }
    return notes;
}

const makeRepeatedNotes = (note: Note): Array<Note> => {
    const notes: Array<Note> = [];
    for (let i = 0; i < NUMBER_OF_COUNTS - numberOfRests; i++) {
        notes.push(note);
    }
    return notes;
};

const makeNoteStr = (notes: Array<Note>): string => {
    console.log(numberOfRests)
    let restStr = '';
    if (numberOfRests >= 2) {
        restStr += 'B4/h/r, ';
    }
    if (numberOfRests === 1 || numberOfRests === 3) {
        restStr += 'B4/q/r, ';
    }

    const letterAtPos = (pos) => 'CDEFGAB'[pos - 1];
    const noteStr = notes.map(([octave, pos]) => `${letterAtPos(pos)}${octave}/q`).join(', ');
    return restStr + noteStr;
};

const areTwoNotesEqual = (note1: Note | undefined, note2: Note): boolean => {
    if (!note1 && note2) {
        return false;
    }
    const [octave1, pos1] = note1;
    const [octave2, pos2] = note2;
    return octave1 === octave2 && pos1 === pos2;
};

const advanceCount = () => {
    // Count is indexed from 1
    const nextCount = count % NUMBER_OF_COUNTS + 1;
    const prevElem = document.getElementById(`count-${count}`);
    const nextElem = document.getElementById(`count-${nextCount}`);
    prevElem.style.opacity = '0';
    nextElem.style.opacity = '1';
    count = nextCount;
}

const clearCount = () => {
    for (let i = 1; i <= NUMBER_OF_COUNTS; i++) {
        const elem = document.getElementById(`count-${i}`);
        elem.style.opacity = '0';
    }
}

const doRound = (prevNote?: Note): Note => {
    const outputElem = document.getElementById('output');
    if (!outputElem) {
        throw new Error('No element found with id "output"');
    }
    outputElem.innerHTML = '';

    const noteRange = makeNoteRange(LOW_NOTE, HIGH_NOTE);
    let notes;
    const allNotesShouldBeEqual = (document.getElementById('input-all-notes-equal') as HTMLInputElement).checked;
    if (allNotesShouldBeEqual) {
        notes = makeRepeatedNotes(randomNote(noteRange.filter((note) => !areTwoNotesEqual(prevNote, note))));
    } else {
        notes = makeRandomNotes(noteRange);
    }
    const noteStr = makeNoteStr(notes);

    const { vf, score, system } = setup();
    system
        .addStave({
            voices: [
                // TODO: To make this actually playable on a metronomic beat
                // with visual cues or auditory cues.
                score.voice(score.notes(noteStr, { stem: 'auto' })),
            ],
        })
        .addClef('treble')
        .addTimeSignature('4/4');

    vf.draw();
    return notes[0];
}

const resetAndGo = () => {
    window.clearInterval(interval);
    window.clearInterval(countInterval);
    clearCount();
    count = NUMBER_OF_COUNTS;
    // We keep track of the prevNote state so that we
    // can make sure that the next note is different,
    // if the user has selected the "all notes should
    // be the same" option.
    let prevNote = doRound();
    if (!intervalVal) {
        throw new Error('Invariant: there should always be an interval value here');
    }
    interval = window.setInterval(
        () => {
            prevNote = doRound(prevNote);
        },
        intervalVal,
    );
    advanceCount();
    countInterval = window.setInterval(advanceCount, intervalVal / NUMBER_OF_COUNTS);
};

resetAndGo();

document.body.addEventListener('keypress', (e) => {
    if (e.key === ' ') {
        resetAndGo();
    }
});

document.getElementById('input-bpm').addEventListener('input', (e) => {
    const newIntervalVal = getIntervalVal(e.target as HTMLInputElement);
    if (newIntervalVal) {
        intervalVal = newIntervalVal;
        resetAndGo();
    }
});

for (let i = 1; i <= 3; i++) {
    const radioButton = document.getElementById(`input-rests-${i}`) as HTMLInputElement;
    radioButton.addEventListener('click', (e) => {
        numberOfRests = getNumberOfRests();
        resetAndGo();
    });
}


document.getElementById('input-all-notes-equal').addEventListener('change', resetAndGo);
