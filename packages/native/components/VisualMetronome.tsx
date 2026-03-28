import { StyleSheet, Text, View } from 'react-native';

type Props = {
  beatsPerBar: number;
  currentBeat: number;
};

export default function VisualMetronome({ beatsPerBar, currentBeat }: Props) {
  const elems = [];
  for (let i = 1; i <= beatsPerBar; i++) {
    elems.push(
      <View key={i} style={[styles.beat, i === currentBeat && styles.activeBeat]}>
        <Text style={[styles.beatText, i === currentBeat && styles.activeBeatText]}>
          {i}
        </Text>
      </View>
    );
  }
  return <View style={styles.container}>{elems}</View>;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 16,
  },
  beat: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBeat: {
    backgroundColor: '#4a90d9',
  },
  beatText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
  },
  activeBeatText: {
    color: '#fff',
  },
});
