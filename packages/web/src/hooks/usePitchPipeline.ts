import { useCallback, useEffect, useRef, useState } from 'react';
import { createPitchTracker, createNoteEventTracker } from '@musicalflashcards/shared';
import type { PitchReading, NoteEvent, StableRun } from '@musicalflashcards/shared';
import { createMicSource } from '../audio/micSource.ts';

export type PipelineFrame = {
  reading: PitchReading | null;
  events: Array<NoteEvent>;
  currentRun: StableRun | null;
  atMs: number;
};

const READOUT_INTERVAL_MS = 100; // throttle currentReading state updates to ~10 Hz

const toErrorMessage = (err: unknown): string => {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
      return 'Microphone access denied';
    }
    if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
      return 'No microphone found';
    }
  }
  return 'Microphone unavailable';
};

// Owns the mic source and the shared trackers. Judges consume frames through
// the onFrame callback (called at frame rate, outside React state); the
// throttled currentReading is only for the live readout.
export default function usePitchPipeline(onFrame?: (frame: PipelineFrame) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentReading, setCurrentReading] = useState<PitchReading | null>(null);

  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const micRef = useRef<ReturnType<typeof createMicSource> | null>(null);
  const pitchTrackerRef = useRef<ReturnType<typeof createPitchTracker> | null>(null);
  const eventTrackerRef = useRef<ReturnType<typeof createNoteEventTracker> | null>(null);
  const sampleRateRef = useRef(0);
  const lastReadoutMsRef = useRef(-Infinity);

  const handleFrame = useCallback((frame: Float32Array, sampleRate: number, atMs: number) => {
    if (pitchTrackerRef.current === null || sampleRateRef.current !== sampleRate) {
      pitchTrackerRef.current = createPitchTracker(sampleRate, frame.length);
      sampleRateRef.current = sampleRate;
    }
    const eventTracker = eventTrackerRef.current;
    if (eventTracker === null) return;

    const reading = pitchTrackerRef.current.processFrame(frame, atMs);
    const events = eventTracker.processFrame(reading, atMs);
    onFrameRef.current?.({ reading, events, currentRun: eventTracker.getCurrentRun(), atMs });

    if (atMs - lastReadoutMsRef.current >= READOUT_INTERVAL_MS) {
      lastReadoutMsRef.current = atMs;
      setCurrentReading(reading);
    }
  }, []);

  const toggle = useCallback(async () => {
    if (micRef.current !== null) {
      micRef.current.stop();
      micRef.current = null;
      eventTrackerRef.current = null;
      setListening(false);
      setCurrentReading(null);
      return;
    }

    setError(null);
    pitchTrackerRef.current = null;
    eventTrackerRef.current = createNoteEventTracker();
    lastReadoutMsRef.current = -Infinity;

    const mic = createMicSource(handleFrame);
    micRef.current = mic;
    try {
      await mic.start();
      setListening(true);
    } catch (err) {
      mic.stop();
      micRef.current = null;
      eventTrackerRef.current = null;
      setError(toErrorMessage(err));
    }
  }, [handleFrame]);

  useEffect(() => {
    return () => micRef.current?.stop();
  }, []);

  return { listening, error, toggle, currentReading };
}
