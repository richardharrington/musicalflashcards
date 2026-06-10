import { PITCH_CLASS } from '../utils/noteUtils.tsx';
import type { Note } from '../utils/noteUtils.tsx';
import { A4_HZ } from './constants.ts';

type Octave = Note[0];
type PitchClass = Note[1];

const A4_MIDI = 69;
const SEMITONES_PER_OCTAVE = 12;

// MIDI octaves run C..B; octave number = floor(midi / 12) - 1 (C4 = 60).
const SEMITONE_BY_PITCH_CLASS: Record<PitchClass, number> = {
  [PITCH_CLASS.C]: 0,
  [PITCH_CLASS.D]: 2,
  [PITCH_CLASS.E]: 4,
  [PITCH_CLASS.F]: 5,
  [PITCH_CLASS.G]: 7,
  [PITCH_CLASS.A]: 9,
  [PITCH_CLASS.B]: 11,
};

const PITCH_CLASS_BY_SEMITONE = new Map<number, PitchClass>(
  (Object.entries(SEMITONE_BY_PITCH_CLASS) as Array<[string, number]>).map(
    ([pitchClass, semitone]) => [semitone, Number(pitchClass) as PitchClass],
  ),
);

// Sharps-only spelling for the live readout (C♯4, never D♭4).
const DISPLAY_NAME_BY_SEMITONE = [
  'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B',
];

const LOWEST_OCTAVE = 3;
const HIGHEST_OCTAVE = 6;

export const freqToMidi = (freq: number): { midi: number; cents: number } => {
  const midiFloat = A4_MIDI + SEMITONES_PER_OCTAVE * Math.log2(freq / A4_HZ);
  const midi = Math.round(midiFloat);
  const cents = (midiFloat - midi) * 100;
  return { midi, cents };
};

// Natural notes within the app's octave range only; null for accidentals
// (an accidental can never match a target) and for octaves the Note type
// can't represent. Judges compare MIDI numbers; this is for display targets.
export const midiToNote = (midi: number): Note | null => {
  const semitone = ((midi % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
  const pitchClass = PITCH_CLASS_BY_SEMITONE.get(semitone);
  if (pitchClass === undefined) {
    return null;
  }
  const octave = Math.floor(midi / SEMITONES_PER_OCTAVE) - 1;
  if (octave < LOWEST_OCTAVE || octave > HIGHEST_OCTAVE) {
    return null;
  }
  return [octave as Octave, pitchClass];
};

export const midiToDisplayName = (midi: number): string => {
  const semitone = ((midi % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
  const octave = Math.floor(midi / SEMITONES_PER_OCTAVE) - 1;
  return `${DISPLAY_NAME_BY_SEMITONE[semitone]}${octave}`;
};

export const noteToMidi = ([octave, pitchClass]: Note): number =>
  (octave + 1) * SEMITONES_PER_OCTAVE + SEMITONE_BY_PITCH_CLASS[pitchClass];
