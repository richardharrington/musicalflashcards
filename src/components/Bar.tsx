import { useEffect } from 'react';
import { Vex } from 'vexflow';
import type { Note } from '../utils/noteUtils';
import { buildFullMeasure } from '../rendering/buildMeasure';
import { drawMeasure } from '../rendering/drawMeasure';

const clearElementChildren = (elementId: string) => {
  const element = document.getElementById(elementId);
  if (element !== null) {
    while(element.lastElementChild){
      element.removeChild(element.lastElementChild);
    }
  }
}

type Props = {
  elementId: string;
  notes: Array<Note>;
  beatsPerBar: number;
};

function Bar({
  elementId,
  notes,
  beatsPerBar,
}: Props) {
  useEffect(() => {
    clearElementChildren(elementId);

    const { Renderer, Stave } = Vex.Flow;
    const vexFlowElement = document.getElementById(elementId) as HTMLDivElement | null;
    if (!vexFlowElement) return;

    const renderer = new Renderer(vexFlowElement, Renderer.Backends.SVG);
    renderer.resize(500, 200);

    const context = renderer.getContext();
    const stave = new Stave(0, 0, 160);
    stave.addClef('treble').addTimeSignature('4/4');
    stave.setContext(context).draw();

    const tickables = buildFullMeasure(notes, beatsPerBar);
    drawMeasure({ context, stave, tickables, beatsPerBar });
  }, [notes, beatsPerBar, elementId]);

  return (
    <div id="output-container">
      <div id={elementId}></div>
    </div>
  );
}

export default Bar;
