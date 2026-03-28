import { useMemo } from 'react';
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

type Props = {
  notes: Array<Note>;
  beatsPerBar: number;
  width?: number;
  height?: number;
};

export default function Bar({ notes, beatsPerBar, width = 500, height = 200 }: Props) {
  const svgString = useMemo(() => {
    setupFakeDocument();
    try {
      const container = createFakeContainer();
      const { Renderer, Stave } = Vex.Flow;

      const renderer = new Renderer(container as any, Renderer.Backends.SVG);
      renderer.resize(width, height);

      const context = renderer.getContext();
      const stave = new Stave(0, 0, 160);
      stave.addClef('treble').addTimeSignature('4/4');
      stave.setContext(context).draw();

      const tickables = buildFullMeasure(notes, beatsPerBar);
      drawMeasure({ context, stave, tickables, beatsPerBar });

      return toSVGString(container as any);
    } finally {
      teardownFakeDocument();
    }
  }, [notes, beatsPerBar, width, height]);

  if (!svgString) return null;
  const cleanedSvg = svgString.replace(/ pointer-events="[^"]*"/g, '');
  return <SvgXml xml={cleanedSvg} width={width} height={height} />;
}
