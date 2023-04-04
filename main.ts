import { Vex } from 'vexflow';
import type { EasyScore, System, Factory } from 'vexflow';

type Note = [number, number]; // octave, position in octave

const LOW_NOTE: Note = [4, 1]; // middle C
const HIGH_NOTE: Note = [5, 1]; // high C
const NUMBER_OF_NOTES = 4; // TODO: Figure out how to make this work with a different number of notes

// const SHOW_LETTERS = true; // not used yet
// const SHOW_FINGER_POSITIONS = true; // not used yet


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
    for (let i = 0; i < NUMBER_OF_NOTES; i++) {
        notes.push(randomNote(noteRange));
    }
    return notes;
}

const makeRepeatedNotes = (note: Note): Array<Note> => {
    const notes: Array<Note> = [];
    for (let i = 0; i < NUMBER_OF_NOTES; i++) {
        notes.push(note);
    }
    return notes;
};

const makeNoteStr = (notes: Array<Note>): string => {
    const letterAtPos = (pos) => 'CDEFGAB'[pos - 1];
    return notes.map(([octave, pos]) => `${letterAtPos(pos)}${octave}/q`).join(', ');
};

const areTwoNotesEqual = (note1: Note | undefined, note2: Note): boolean => {
    if (!note1 && note2) {
        return false;
    }
    const [octave1, pos1] = note1;
    const [octave2, pos2] = note2;
    return octave1 === octave2 && pos1 === pos2;
};

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
        console.log(prevNote, notes[0]);
        console.log(areTwoNotesEqual(prevNote, notes[0]));
    } else {
        notes = makeRandomNotes(noteRange);
    }
    const noteStr = makeNoteStr(notes);

    const { vf, score, system } = setup();
    system
        .addStave({
            voices: [
                // TODO: To make this actually playable on a metronomic beat
                // when the user is just seeing the notes for the first
                // time every few seconds,
                // put a couple of rests at the beginning of the bar.
                // Or maybe just one.
                score.voice(score.notes(noteStr, { stem: 'auto' })),
            ],
        })
        .addClef('treble')
        .addTimeSignature('4/4');

    vf.draw();
    return notes[0];
}

const getIntervalVal = (elem: HTMLInputElement) => {
    const intervalVal = parseFloat(elem.value.trim());
    return intervalVal ? Math.floor(intervalVal * 1000) : null;
}

let interval;
let intervalVal = getIntervalVal(document.getElementById('input-interval') as HTMLInputElement);

const resetAndGo = () => {
    window.clearInterval(interval);
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
};

resetAndGo();

document.body.addEventListener('keypress', (e) => {
    if (e.key === ' ') {
        resetAndGo();
    }
});

document.getElementById('input-interval').addEventListener('input', (e) => {
    const newIntervalVal = getIntervalVal(e.target as HTMLInputElement);
    if (newIntervalVal) {
        intervalVal = newIntervalVal;
        resetAndGo();
    }
});

document.getElementById('input-all-notes-equal').addEventListener('change', resetAndGo);
