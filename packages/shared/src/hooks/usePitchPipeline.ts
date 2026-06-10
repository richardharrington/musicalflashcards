import { useCallback, useEffect, useRef, useState } from 'react';
import { createPitchTracker, computeRms } from '../pitch/pitchTracker.ts';
import type { PitchReading } from '../pitch/pitchTracker.ts';
import { createNoteEventTracker } from '../pitch/noteEventTracker.ts';
import type { NoteEvent } from '../pitch/noteEventTracker.ts';
import type { StableRun } from '../pitch/practiceJudge.ts';

// The platform mic-source contract. The same Float32Array may be reused for
// every frame: consumers must process it synchronously, never retain it.
export type MicFrameCallback = (
  frame: Float32Array,
  sampleRate: number,
  atMs: number,
) => void;

export type MicSource = {
  // rejects on permission/device errors; stop() must be safe to call
  // repeatedly and must abort an in-flight start()
  start: () => Promise<void>;
  stop: () => void;
};

export type CreateMicSource = (onFrame: MicFrameCallback) => MicSource;

export type PipelineFrame = {
  reading: PitchReading | null;
  events: Array<NoteEvent>;
  currentRun: StableRun | null;
  // raw frame RMS: the tempo judge's mic-check hint needs true loudness even
  // on frames where the reading is null (spec §6.6)
  rms: number;
  atMs: number;
};

type Params = {
  // platform-specific pieces; both must be stable (module-level) functions
  createMicSource: CreateMicSource;
  micErrorToMessage: (err: unknown) => string;
  onFrame?: (frame: PipelineFrame) => void;
};

const READOUT_INTERVAL_MS = 100; // throttle currentReading state updates to ~10 Hz

// Owns the mic source and the shared trackers. Judges consume frames through
// the onFrame callback (called at frame rate, outside React state); the
// throttled currentReading is only for the live readout.
export default function usePitchPipeline({ createMicSource, micErrorToMessage, onFrame }: Params) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentReading, setCurrentReading] = useState<PitchReading | null>(null);

  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const micErrorToMessageRef = useRef(micErrorToMessage);
  micErrorToMessageRef.current = micErrorToMessage;
  const createMicSourceRef = useRef(createMicSource);
  createMicSourceRef.current = createMicSource;

  const micRef = useRef<MicSource | null>(null);
  const pitchTrackerRef = useRef<ReturnType<typeof createPitchTracker> | null>(null);
  const eventTrackerRef = useRef<ReturnType<typeof createNoteEventTracker> | null>(null);
  const sampleRateRef = useRef(0);
  const lastReadoutMsRef = useRef(-Infinity);

  const handleFrame = useCallback<MicFrameCallback>((frame, sampleRate, atMs) => {
    if (pitchTrackerRef.current === null || sampleRateRef.current !== sampleRate) {
      pitchTrackerRef.current = createPitchTracker(sampleRate, frame.length);
      sampleRateRef.current = sampleRate;
    }
    const eventTracker = eventTrackerRef.current;
    if (eventTracker === null) return;

    const reading = pitchTrackerRef.current.processFrame(frame, atMs);
    const events = eventTracker.processFrame(reading, atMs);
    onFrameRef.current?.({
      reading,
      events,
      currentRun: eventTracker.getCurrentRun(),
      rms: reading?.rms ?? computeRms(frame),
      atMs,
    });

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

    const mic = createMicSourceRef.current(handleFrame);
    micRef.current = mic;
    try {
      await mic.start();
      setListening(true);
    } catch (err) {
      mic.stop();
      micRef.current = null;
      eventTrackerRef.current = null;
      setError(micErrorToMessageRef.current(err));
    }
  }, [handleFrame]);

  useEffect(() => {
    return () => micRef.current?.stop();
  }, []);

  return { listening, error, toggle, currentReading };
}
