import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Vex } from 'vexflow';
import type { Note } from '@musicalflashcards/shared';
import {
  buildFullMeasure,
  drawMeasure,
  setupFakeDocument,
  createFakeContainer,
  teardownFakeDocument,
  toSVGString,
} from '@musicalflashcards/shared';

const SVG_WIDTH = 320;
const SVG_HEIGHT = 130;
const STAVE_WIDTH = 230;
const STAVE_X = 45;

type Props = {
  notes: Array<Note>;
  beatsPerBar: number;
};

export default function Bar({ notes, beatsPerBar }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const displayWidth = screenWidth - 40;

  const svgString = useMemo(() => {
    setupFakeDocument();
    try {
      const container = createFakeContainer();
      const { Renderer, Stave } = Vex.Flow;

      // VexFlow's .d.ts types declare that Renderer expects a full HTMLDivElement,
      // an interface with hundreds of fields and methods, but Renderer actually
      // only uses a few of them (appendChild, setAttribute, etc.). Our FakeSVGElement
      // implements that subset. The `as unknown as X` cast bypasses the type mismatch.
      const renderer = new Renderer(container as unknown as HTMLDivElement, Renderer.Backends.SVG);
      renderer.resize(SVG_WIDTH, SVG_HEIGHT);

      const context = renderer.getContext();
      const stave = new Stave(STAVE_X, 10, STAVE_WIDTH);
      stave.addClef('treble').addTimeSignature('4/4');
      stave.setContext(context).draw();

      const tickables = buildFullMeasure(notes, beatsPerBar);
      drawMeasure({ context, stave, tickables, beatsPerBar });

      return toSVGString(container);
    } finally {
      teardownFakeDocument();
    }
  }, [notes, beatsPerBar]);

  if (!svgString) return null;
  const cleanedSvg = svgString.replace(/ pointer-events="[^"]*"/g, '');
  const displayHeight = (displayWidth / SVG_WIDTH) * SVG_HEIGHT;
  return <SvgXml xml={cleanedSvg} width={displayWidth} height={displayHeight} />;
}
