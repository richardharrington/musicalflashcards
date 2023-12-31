import cx from 'classnames';

type Props = {
  beatsPerBar: number,
  currentBeat: number,
};

function VisualBeats({ beatsPerBar, currentBeat }: Props) {
  const elems = [];
  for (let i = 1; i <= beatsPerBar; i++) {
    const className = cx({
      'visual-metronome-numeral': true,
      'show-beat': i === currentBeat,
    });
    elems.push(
      <span key={i} className={className}>
        {i}&nbsp;
      </span>
    );
  }
  return (
    <div id="visual-metronome">
      {elems}
    </div>
  );
}

export default VisualBeats;
