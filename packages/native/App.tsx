import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PITCH_CLASS, useAppState } from '@musicalflashcards/shared';
import type { NoteBoundaryPair } from '@musicalflashcards/shared';

const NOTE_BOUNDARY_PAIRS: Record<string, NoteBoundaryPair> = {
  lowGToHighC: {
    low: [3, PITCH_CLASS.G],
    high: [5, PITCH_CLASS.C],
  },
};

const BEATS_PER_BAR = 4;
const INITIAL_BPM = 60;
const INITIAL_RESTS = 3;

export default function App() {
  const {
    bpmInput,
    setBpmInput,
    currentBeat,
    notes,
  } = useAppState({
    beatsPerBar: BEATS_PER_BAR,
    initialBpm: INITIAL_BPM,
    initialRests: INITIAL_RESTS,
    noteBoundaryPairs: NOTE_BOUNDARY_PAIRS,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Musical Flashcards</Text>
      <Text style={styles.beat}>Beat: {currentBeat}</Text>
      <Text style={styles.info}>Notes: {notes.length}</Text>
      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={bpmInput}
          onChangeText={setBpmInput}
          keyboardType="numeric"
          placeholder="BPM"
        />
        <Text style={styles.label}>Beats per minute</Text>
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  beat: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  info: {
    fontSize: 18,
    marginBottom: 30,
    color: '#666',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 4,
    padding: 8,
    fontSize: 18,
    width: 80,
    textAlign: 'center',
    marginRight: 10,
  },
  label: {
    fontSize: 18,
  },
});
