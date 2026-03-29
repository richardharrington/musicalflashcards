import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Switch, Text, TextInput, Pressable, View } from 'react-native';
import {
  PITCH_CLASS,
  useAppState,
  getNoteBoundaryDisplayString,
} from '@musicalflashcards/shared';
import type { NoteBoundaryPair } from '@musicalflashcards/shared';
import Bar from './components/Bar';
import VisualMetronome from './components/VisualMetronome';

const NOTE_BOUNDARY_PAIRS: Record<string, NoteBoundaryPair> = {
  lowGToHighC: {
    low: [3, PITCH_CLASS.G],
    high: [5, PITCH_CLASS.C],
  },
  gStringOctave: {
    low: [3, PITCH_CLASS.G],
    high: [4, PITCH_CLASS.G],
  },
  cStringOctave: {
    low: [4, PITCH_CLASS.C],
    high: [5, PITCH_CLASS.C],
  },
  eStringOctave: {
    low: [4, PITCH_CLASS.E],
    high: [5, PITCH_CLASS.E],
  },
  aStringOctave: {
    low: [4, PITCH_CLASS.A],
    high: [5, PITCH_CLASS.A],
  },
};

const BEATS_PER_BAR = 4;
const INITIAL_BPM = 60;
const INITIAL_RESTS = 3;

export default function App() {
  const {
    notes,
    currentBeat,
    beatsPerBar,
    bpmInput,
    setBpmInput,
    numRests,
    setNumRests,
    allNotesShouldBeEqual,
    setAllNotesShouldBeEqual,
    noteBoundaryPairName,
    setNoteBoundaryPairName,
    noteBoundaryPairs,
  } = useAppState({
    beatsPerBar: BEATS_PER_BAR,
    initialBpm: INITIAL_BPM,
    initialRests: INITIAL_RESTS,
    noteBoundaryPairs: NOTE_BOUNDARY_PAIRS,
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Musical Flashcards</Text>

      <Bar notes={notes} beatsPerBar={beatsPerBar} />

      <VisualMetronome beatsPerBar={beatsPerBar} currentBeat={currentBeat} />

      <View style={styles.settings}>
        <View style={styles.row}>
          <TextInput
            style={styles.bpmInput}
            value={bpmInput}
            onChangeText={setBpmInput}
            keyboardType="numeric"
            placeholder="BPM"
          />
          <Text style={styles.label}>Beats per minute</Text>
        </View>

        <Text style={styles.sectionLabel}>Rests</Text>
        <View style={styles.radioRow}>
          {[1, 2, 3].map((i) => (
            <Pressable
              key={i}
              style={[styles.radioButton, numRests === i && styles.radioButtonActive]}
              onPress={() => setNumRests(i)}
            >
              <Text style={[styles.radioText, numRests === i && styles.radioTextActive]}>
                {i} rest
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Note range</Text>
        {Object.keys(noteBoundaryPairs).map((name) => (
          <Pressable
            key={name}
            style={[styles.optionRow, noteBoundaryPairName === name && styles.optionRowActive]}
            onPress={() => setNoteBoundaryPairName(name)}
          >
            <View style={[styles.radioCircle, noteBoundaryPairName === name && styles.radioCircleActive]}>
              {noteBoundaryPairName === name && <View style={styles.radioCircleFill} />}
            </View>
            <Text style={styles.optionText}>{getNoteBoundaryDisplayString(name)}</Text>
          </Pressable>
        ))}

        <View style={styles.switchRow}>
          <Switch
            value={allNotesShouldBeEqual}
            onValueChange={setAllNotesShouldBeEqual}
            trackColor={{ false: '#ccc', true: '#4a90d9' }}
            thumbColor={allNotesShouldBeEqual ? '#fff' : '#f4f3f4'}
          />
          <Text style={styles.switchLabel}>Make all notes in each round the same note</Text>
        </View>

        <Text style={styles.sectionLabel}>Coming soon:</Text>
        <Text style={styles.comingSoonItem}>- Option to have metronomic audio cues for the notes</Text>
        <Text style={styles.comingSoonItem}>- Option to annotate each note with its letter</Text>
        <Text style={styles.comingSoonItem}>- Option to annotate each note with its finger number</Text>
      </View>

      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settings: {
    width: '100%',
    maxWidth: 400,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  bpmInput: {
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
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 4,
  },
  radioRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  radioButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#f5f5f5',
  },
  radioButtonActive: {
    borderColor: '#4a90d9',
    backgroundColor: '#e8f0fe',
  },
  radioText: {
    fontSize: 15,
    color: '#666',
  },
  radioTextActive: {
    color: '#4a90d9',
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  optionRowActive: {
    backgroundColor: '#e8f0fe',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#999',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioCircleActive: {
    borderColor: '#4a90d9',
  },
  radioCircleFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4a90d9',
  },
  optionText: {
    fontSize: 15,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  switchLabel: {
    fontSize: 15,
    marginLeft: 10,
    flex: 1,
  },
  comingSoonItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    paddingLeft: 8,
  },
});
