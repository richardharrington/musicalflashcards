import { Vex } from 'vexflow';
import type { EasyScore, System, Factory } from 'vexflow';

type Note = [number, number]; // octave, position in octave

const LOW_NOTE: Note = [4, 1]; // middle C
const HIGH_NOTE: Note = [5, 1]; // high C

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

const makeNotes = (noteRange: Array<Note>): Array<Note> => {
    const notes: Array<Note> = [];
    if ((document.getElementById('input-all-notes-equal') as HTMLInputElement).checked) {
        const note = randomNote(noteRange);
        for (let i = 0; i < 4; i++) {
            notes.push(note);
        }
    } else {
        for (let i = 0; i < 4; i++) {
            notes.push(randomNote(noteRange));
        }
    }
    return notes;
}

const makeNoteStr = (notes: Array<Note>): string => {
    const letterAtPos = (pos) => 'CDEFGAB'[pos - 1];
    return notes.map(([octave, pos]) => `${letterAtPos(pos)}${octave}/q`).join(', ');
};

// TODO: Prevent the same note from being shown two rounds in a row if we
// are using the same note for all four notes.
const doRound = () => {
    const outputElem = document.getElementById('output');
    if (!outputElem) {
        throw new Error('No element found with id "output"');
    }
    outputElem.innerHTML = '';
    const noteStr = makeNoteStr(makeNotes(makeNoteRange(LOW_NOTE, HIGH_NOTE)));

    const { vf, score, system } = setup();
    system
        .addStave({
            voices: [
                score.voice(score.notes(noteStr, { stem: 'auto' })),
            ],
        })
        .addClef('treble')
        .addTimeSignature('4/4');

    vf.draw();
}

const getIntervalVal = (elem: HTMLInputElement) => {
    const intervalVal = parseInt(elem.value.trim(), 10);
    return intervalVal ? intervalVal * 1000 : null;
}

let interval;
let intervalVal = getIntervalVal(document.getElementById('input-interval') as HTMLInputElement);

const resetAndGo = () => {
    window.clearInterval(interval);
    doRound();
    if (!intervalVal) {
        throw new Error('Invariant: there should always be an interval value here');
    }
    interval = window.setInterval(
        doRound,
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
