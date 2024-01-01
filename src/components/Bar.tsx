import { useEffect } from 'react';
import { Vex } from 'vexflow';
import { makeNoteStr } from '../utils/noteUtils';
import type { Note } from '../utils/noteUtils';

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
    // TODO: Use refs for vf, score and system so we don't
    // have to recreate everything every time we rerender.
    const vf = new Vex.Flow.Factory({
      renderer: { elementId, width: 500, height: 200 },
    });
    const score = vf.EasyScore();
    const system = vf.System();

    const noteStr = makeNoteStr(notes, beatsPerBar);
    system
      .addStave({
        voices: [
          score.voice(score.notes(noteStr, { stem: 'auto' })),
        ],
      })
      .addClef('treble')
      .addTimeSignature('4/4');

    vf.draw();
    // TODO: May need to return a teardown function here that
    // sets the innerHTML of the 'output' element to the empty string
  }, [notes]);

  return <div id={elementId}></div>;
}

export default Bar;