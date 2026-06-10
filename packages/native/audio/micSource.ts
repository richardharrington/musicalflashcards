import { AudioManager, AudioRecorder } from 'react-native-audio-api';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  setIsAudioActiveAsync,
} from 'expo-audio';
import { FRAME_SIZE } from '@musicalflashcards/shared';
import type { MicFrameCallback } from '@musicalflashcards/shared';

// Recorder buffers are much smaller than FRAME_SIZE; a ring buffer accumulates
// them and emits a full overlapping window every EMIT_EVERY_N_BUFFERS
// callbacks (2 × 512 samples ≈ 21 ms at 48 kHz, comparable to web's 60 Hz
// polling). Raise it if pitch detection's CPU cost on the JS thread shows.
const BUFFER_LENGTH = 512;
const EMIT_EVERY_N_BUFFERS = 2;

// iOS audio-session handling lives with expo-audio, not the library. The
// library's own session manager defaults to a playback-only category (the
// recorder's input node then fails to materialize and delivers no buffers),
// and changing its category via AudioManager.setAudioSessionOptions flags an
// audio-engine rebuild whose teardown aborts on the iOS simulator (AURemoteIO
// RPC timeout in AVAudioEngine dealloc). So: tell the library to leave the
// session alone, and configure/activate it through expo-audio in start().
AudioManager.disableSessionManagement();

class MicPermissionDeniedError extends Error {
  constructor() {
    super('Microphone permission denied');
    this.name = 'MicPermissionDeniedError';
  }
}

export const micErrorToMessage = (err: unknown): string => {
  if (err instanceof MicPermissionDeniedError) {
    return 'Microphone access denied';
  }
  return 'Microphone unavailable';
};

// The only platform-specific audio code: AudioRecorder's data callback feeds a
// ring buffer that emits overlapping FRAME_SIZE windows. The same Float32Array
// is reused for every emitted window; consumers must process it synchronously,
// not retain it.
export const createMicSource = (onFrame: MicFrameCallback) => {
  let session = 0; // bumped by stop() so an in-flight start() knows to bail
  let recorder: AudioRecorder | null = null;

  const stop = () => {
    session += 1;
    if (recorder !== null) {
      recorder.clearOnAudioReady();
      recorder.stop();
      recorder = null;
      // release the mic at the session level too (fire-and-forget)
      void setIsAudioActiveAsync(false).catch(() => undefined);
    }
  };

  // Rejects on permission denial (asked explicitly here, never left to the
  // recorder) or recorder start failure.
  const start = async () => {
    if (recorder !== null) return;
    const mySession = ++session;

    const { granted } = await requestRecordingPermissionsAsync();
    if (session !== mySession) return; // stop() called while awaiting
    if (!granted) throw new MicPermissionDeniedError();

    // playAndRecord category + active session, via expo-audio (see module
    // comment). playsInSilentMode must accompany allowsRecording on iOS.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await setIsAudioActiveAsync(true);
    if (session !== mySession) return; // stop() called while awaiting

    const ring = new Float32Array(FRAME_SIZE);
    let writeIndex = 0;
    let samplesWritten = 0;
    let buffersSinceEmit = 0;
    const frame = new Float32Array(FRAME_SIZE);

    // atMs comes from a sample counter, not the event: the 0.12.2 typings
    // declare a `when` timestamp on audioReady events but the native payload
    // never includes it (only buffer + numFrames), so deriving time from it
    // yields NaN. The sample clock is monotonic, which is all the
    // trackers/judges require.

    const rec = new AudioRecorder();
    rec.onAudioReady(
      { sampleRate: 48000, bufferLength: BUFFER_LENGTH, channelCount: 1 },
      (event) => {
        if (session !== mySession) return;
        const data = event.buffer.getChannelData(0);
        const numFrames = Math.min(event.numFrames, data.length);
        for (let i = 0; i < numFrames; i++) {
          ring[writeIndex] = data[i];
          writeIndex = (writeIndex + 1) % FRAME_SIZE;
        }
        samplesWritten += numFrames;
        buffersSinceEmit += 1;
        if (samplesWritten < FRAME_SIZE || buffersSinceEmit < EMIT_EVERY_N_BUFFERS) {
          return;
        }
        buffersSinceEmit = 0;

        // unroll the ring so the emitted window is in chronological order
        frame.set(ring.subarray(writeIndex), 0);
        frame.set(ring.subarray(0, writeIndex), FRAME_SIZE - writeIndex);

        // the window ends at the most recently captured sample
        const sampleRate = event.buffer.sampleRate;
        const atMs = (samplesWritten / sampleRate) * 1000;
        onFrame(frame, sampleRate, atMs);
      },
    );

    const result = rec.start();
    if (result.status === 'error') {
      rec.clearOnAudioReady();
      throw new Error(result.message);
    }
    recorder = rec;
  };

  return { start, stop };
};
