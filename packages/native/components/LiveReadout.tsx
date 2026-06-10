import { StyleSheet, Text } from 'react-native';
import { midiToDisplayName } from '@musicalflashcards/shared';
import type { PitchReading } from '@musicalflashcards/shared';

type Props = {
  reading: PitchReading | null;
  prominent: boolean; // primary UI in practice mode, muted in tempo mode
};

export default function LiveReadout({ reading, prominent }: Props) {
  const text = reading === null ? '—' : midiToDisplayName(reading.midi);
  return (
    <Text style={[styles.readout, prominent ? styles.prominent : styles.muted]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  readout: {
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  prominent: {
    fontSize: 40,
    fontWeight: 'bold',
    minHeight: 56,
    marginBottom: 30,
  },
  muted: {
    fontSize: 29,
    minHeight: 40,
    marginBottom: 10,
  },
});
