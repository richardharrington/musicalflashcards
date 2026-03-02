import { Formatter, Stave, StaveNote, Voice } from 'vexflow';

export const drawMeasure = ({
  context,
  stave,
  tickables,
  beatsPerBar,
}: {
  context: any;
  stave: Stave;
  tickables: Array<StaveNote>;
  beatsPerBar: number;
}) => {
  const voice = new Voice({ num_beats: beatsPerBar, beat_value: 4 });
  voice.addTickables(tickables);

  voice.setStrict(false);

  const RIGHT_PADDING = 15;
  const noteAreaWidth = stave.getX() + stave.getWidth() - stave.getNoteStartX() - RIGHT_PADDING;
  new Formatter().joinVoices([voice]).format([voice], noteAreaWidth);
  voice.draw(context, stave);
};
