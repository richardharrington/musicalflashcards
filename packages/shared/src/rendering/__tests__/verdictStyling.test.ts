import { describe, expect, it } from 'vitest';
import { Vex } from 'vexflow';
import { buildFullMeasure } from '../buildMeasure.ts';
import type { MeasureDecorations } from '../buildMeasure.ts';
import { drawMeasure } from '../drawMeasure.ts';
import {
  createFakeContainer,
  setupFakeDocument,
  teardownFakeDocument,
  toSVGString,
} from '../svgShim.ts';
import { VERDICT_COLORS, CURSOR_COLOR } from '../../pitch/verdicts.ts';
import { PITCH_CLASS } from '../../utils/noteUtils.tsx';
import type { Note } from '../../utils/noteUtils.tsx';

const BEATS_PER_BAR = 4;

// one leading quarter rest, then three notes
const NOTES: Array<Note> = [
  [4, PITCH_CLASS.C],
  [4, PITCH_CLASS.E],
  [4, PITCH_CLASS.G],
];

// Render through the fake document exactly as the native Bar component does.
const renderToSVG = (decorations?: MeasureDecorations): string => {
  setupFakeDocument();
  try {
    const container = createFakeContainer();
    const { Renderer, Stave } = Vex.Flow;
    const renderer = new Renderer(
      container as unknown as HTMLDivElement,
      Renderer.Backends.SVG,
    );
    renderer.resize(320, 130);

    const context = renderer.getContext();
    const stave = new Stave(45, 10, 230);
    stave.addClef('treble').addTimeSignature('4/4');
    stave.setContext(context).draw();

    const tickables = buildFullMeasure(NOTES, BEATS_PER_BAR, decorations);
    drawMeasure({ context, stave, tickables, beatsPerBar: BEATS_PER_BAR });

    return toSVGString(container);
  } finally {
    teardownFakeDocument();
  }
};

// The native port's one rendering assumption: VexFlow setStyle fill/stroke
// colors survive the SVG shim's serialization (toSVGString), so verdict and
// cursor coloring works without a DOM.
describe('verdict styling through the SVG shim', () => {
  it('serializes verdict and cursor colors set via setStyle', () => {
    const svg = renderToSVG({
      noteVerdicts: ['correct', 'wrong', 'pending'],
      cursorIndex: 2,
    });

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain(VERDICT_COLORS.correct); // green note
    expect(svg).toContain(VERDICT_COLORS.wrong); // red note
    expect(svg).toContain(CURSOR_COLOR); // cursor highlight on the pending note
  });

  it('colors a violated rest glyph', () => {
    const svg = renderToSVG({ restWindowVerdicts: ['restViolated'] });

    expect(svg).toContain(VERDICT_COLORS.restViolated);
  });

  it('serializes wrongOctave and missed colors', () => {
    const svg = renderToSVG({
      noteVerdicts: ['wrongOctave', 'missed', 'pending'],
    });

    expect(svg).toContain(VERDICT_COLORS.wrongOctave); // amber
    expect(svg).toContain(VERDICT_COLORS.missed); // gray
  });

  it('leaves an undecorated measure free of verdict colors', () => {
    const svg = renderToSVG();

    expect(svg.startsWith('<svg')).toBe(true);
    for (const color of [
      ...Object.values(VERDICT_COLORS).filter((c) => c !== null),
      CURSOR_COLOR,
    ]) {
      expect(svg).not.toContain(color as string);
    }
  });
});
