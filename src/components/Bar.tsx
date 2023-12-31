import React, { useRef, useEffect } from 'react';
import { Vex } from 'vexflow';
import type { EasyScore, System, Factory } from 'vexflow';
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
  const vfRef = useRef<Factory | null>(null);
  const scoreRef = useRef<EasyScore | null>(null);
  const systemRef = useRef<System | null>(null);

  useEffect(() => {
    vfRef.current = new Vex.Flow.Factory({
      renderer: { elementId, width: 500, height: 200 },
    });
    scoreRef.current = vfRef.current.EasyScore();
    systemRef.current = vfRef.current.System();

    const noteStr = makeNoteStr(notes, beatsPerBar);
    systemRef.current
      .addStave({
        voices: [
          scoreRef.current.voice(scoreRef.current.notes(noteStr, { stem: 'auto' })),
        ],
      })
      .addClef('treble')
      .addTimeSignature('4/4');

    vfRef.current.draw();
    // TODO: May need to return a teardown function here that
    // sets the innerHTML of the 'output' element to the empty string
  }, [notes]);

  return <div id={elementId}></div>;
}

export default Bar;