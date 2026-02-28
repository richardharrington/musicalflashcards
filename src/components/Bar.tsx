import { useEffect } from 'react';
import { Vex } from 'vexflow';
import { makeNoteStr } from '../utils/noteUtils';
import type { Note } from '../utils/noteUtils';
import { buildFullMeasure, drawMeasure } from '../rendering/vexflowLowLevel';

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
  renderMode?: 'easyScore' | 'lowLevel';
};

function Bar({
  elementId,
  notes,
  beatsPerBar,
  renderMode = 'easyScore',
}: Props) {
  useEffect(() => {
    // For now we recreate VexFlow objects per draw. It’s not the most efficient,
    // but it avoids subtle statefulness bugs while we migrate APIs.
    clearElementChildren(elementId);

    if (renderMode === 'lowLevel') {
      const { Renderer, Stave } = Vex.Flow;
      const vexFlowElement = document.getElementById(elementId) as HTMLDivElement | null;
      if (!vexFlowElement) return;

      const renderer = new Renderer(vexFlowElement, Renderer.Backends.SVG);
      renderer.resize(500, 200);

      const context = renderer.getContext();
      const stave = new Stave(10, 0, 190);
      stave.addClef('treble').addTimeSignature('4/4');
      stave.setContext(context).draw();

      const tickables = buildFullMeasure(notes, beatsPerBar);
      drawMeasure({ context, stave, tickables, beatsPerBar });
    } else {
      // renderMode === 'easyScore'
      const vf = new Vex.Flow.Factory({
        renderer: { elementId, width: 500, height: 200 },
      });
      const score = vf.EasyScore();
      const system = vf.System();

      const noteStr = makeNoteStr(notes, beatsPerBar);
      system
        .addStave({
          voices: [score.voice(score.notes(noteStr, { stem: 'auto' }))],
        })
        .addClef('treble')
        .addTimeSignature('4/4');

      vf.draw();
    }
  }, [notes, beatsPerBar, elementId, renderMode]);

  return (
    <div id="output-container">
      <div id={elementId}></div>
    </div>
  );
}

export default Bar;