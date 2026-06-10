import cx from 'classnames';
import { midiToDisplayName } from '@musicalflashcards/shared';
import type { PitchReading } from '@musicalflashcards/shared';

type Props = {
  reading: PitchReading | null;
  prominent: boolean; // primary UI in practice mode, muted in tempo mode
};

const formatCents = (cents: number): string => {
  const rounded = Math.round(cents);
  return `${rounded < 0 ? '−' : '+'}${Math.abs(rounded)}¢`;
};

function LiveReadout({ reading, prominent }: Props) {
  const text =
    reading === null
      ? '—'
      : `${midiToDisplayName(reading.midi)} ${formatCents(reading.cents)}`;
  return (
    <div
      className={cx('live-readout', {
        'live-readout-prominent': prominent,
        'live-readout-muted': !prominent,
      })}
    >
      {text}
    </div>
  );
}

export default LiveReadout;
