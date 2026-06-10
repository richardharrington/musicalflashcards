import { useEffect } from 'react';
import { Vex } from 'vexflow';
import type { Note, VerdictState } from '@musicalflashcards/shared';
import { buildFullMeasure, drawMeasure } from '@musicalflashcards/shared';

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
  noteVerdicts?: Array<VerdictState>;
  restWindowVerdicts?: Array<VerdictState>;
  cursorIndex?: number | null;
};

function Bar({
  elementId,
  notes,
  beatsPerBar,
  noteVerdicts,
  restWindowVerdicts,
  cursorIndex,
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

    const tickables = buildFullMeasure(notes, beatsPerBar, {
      noteVerdicts,
      restWindowVerdicts,
      cursorIndex,
    });
    drawMeasure({ context, stave, tickables, beatsPerBar });
  }, [notes, beatsPerBar, elementId, noteVerdicts, restWindowVerdicts, cursorIndex]);

  return (
    <div id="output-container">
      <div id={elementId}></div>
    </div>
  );
}

export default Bar;
