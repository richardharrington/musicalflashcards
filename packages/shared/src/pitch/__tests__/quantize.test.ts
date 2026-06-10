import { describe, it, expect } from 'vitest';
import { freqToMidi, midiToNote, midiToDisplayName, noteToMidi } from '../quantize.ts';
import { PITCH_CLASS } from '../../utils/noteUtils.tsx';
import type { Note } from '../../utils/noteUtils.tsx';

const C4_HZ = 261.63;

describe('freqToMidi', () => {
  it('maps A4 = 440 Hz to midi 69 with ~0 cents', () => {
    const { midi, cents } = freqToMidi(440);
    expect(midi).toBe(69);
    expect(cents).toBeCloseTo(0, 5);
  });

  it('maps middle C to midi 60', () => {
    const { midi, cents } = freqToMidi(C4_HZ);
    expect(midi).toBe(60);
    expect(Math.abs(cents)).toBeLessThan(1);
  });

  it('snaps a +40-cent-sharp C4 to midi 60 with cents ≈ +40', () => {
    const { midi, cents } = freqToMidi(C4_HZ * 2 ** (40 / 1200));
    expect(midi).toBe(60);
    expect(cents).toBeCloseTo(40, 0);
  });

  it('snaps a 60-cent-sharp C4 to the next semitone with negative cents', () => {
    const { midi, cents } = freqToMidi(C4_HZ * 2 ** (60 / 1200));
    expect(midi).toBe(61);
    expect(cents).toBeCloseTo(-40, 0);
  });
});

describe('midiToNote', () => {
  it('maps naturals to [octave, pitchClass] tuples', () => {
    expect(midiToNote(60)).toEqual([4, PITCH_CLASS.C]);
    expect(midiToNote(55)).toEqual([3, PITCH_CLASS.G]);
    expect(midiToNote(95)).toEqual([6, PITCH_CLASS.B]);
  });

  it('returns null for accidentals', () => {
    expect(midiToNote(61)).toBeNull(); // C♯4
    expect(midiToNote(66)).toBeNull(); // F♯4
  });

  it('returns null for octaves the Note type cannot represent', () => {
    expect(midiToNote(36)).toBeNull(); // C2
    expect(midiToNote(96)).toBeNull(); // C7
  });
});

describe('noteToMidi', () => {
  it('maps middle C', () => {
    expect(noteToMidi([4, PITCH_CLASS.C])).toBe(60);
  });

  it('round-trips every natural in the representable range', () => {
    for (let midi = 48; midi <= 95; midi++) {
      const note = midiToNote(midi);
      if (note !== null) {
        expect(noteToMidi(note)).toBe(midi);
      }
    }
  });

  it('agrees with freqToMidi for A4', () => {
    const a4: Note = [4, PITCH_CLASS.A];
    expect(noteToMidi(a4)).toBe(69);
  });
});

describe('midiToDisplayName', () => {
  it('names naturals', () => {
    expect(midiToDisplayName(60)).toBe('C4');
    expect(midiToDisplayName(69)).toBe('A4');
  });

  it('names accidentals with sharps-only spelling', () => {
    expect(midiToDisplayName(61)).toBe('C♯4');
    expect(midiToDisplayName(70)).toBe('A♯4');
  });

  it('names notes outside the staff range truthfully', () => {
    expect(midiToDisplayName(36)).toBe('C2');
  });
});
