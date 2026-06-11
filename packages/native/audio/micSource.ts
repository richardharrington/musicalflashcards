import { AudioManager, AudioRecorder } from 'react-native-audio-api';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  setIsAudioActiveAsync,
} from 'expo-audio';
import type { MicFrameCallback } from '@musicalflashcards/shared';

// Recorder buffers are much smaller than the analysis window; a ring buffer
// accumulates them and emits a window every EMIT_EVERY_N_BUFFERS callbacks
// (the most recent WINDOW_SIZE samples of each span — windows are sparse,
// not overlapping). 8 × 512 samples ≈ 85 ms at 48 kHz (~12 detections/s): on a
// physical budget phone (Moto G Play 2023), emitting every 2 buffers ran the
// O(n²) MPM detector often enough to saturate the JS thread — audio events
// starved React's commits and touch handling, freezing the UI while the
// pipeline kept processing. ~85 ms still gives the judges several frames
// inside their STABLE_MS/HOLD_MS windows.
const BUFFER_LENGTH = 512;
const EMIT_EVERY_N_BUFFERS = 8;

// Analysis window for native, deliberately smaller than shared FRAME_SIZE
// (2048): MPM is O(n²) per window, and on a budget phone CPU running the
// dev-mode bundle, 2048-sample windows kept the JS thread busy enough that
// React commits lagged seconds behind the audio. 1024 samples ≈ 21 ms still
// holds 4+ periods of the app's lowest displayed note (G3, 196 Hz); the
// pitch detector sizes itself from the emitted window, so shared code needs
// no change.
const WINDOW_SIZE = 1024;

// Android device recorders deliver far lower amplitudes than the desktop mics
// the shared RMS thresholds were tuned on (measured on a Moto G Play 2023:
// at 8x gain a ukulele's ringing sustain plateaued at 0.006–0.0096 RMS —
// just under the 0.01 silence floor, so only the unpitched attack transient
// ever reached the pitch detector; room noise floor was ~0.004). 16x puts
// the sustain at ~0.012–0.019 (above RMS_FLOOR, where measured clarity runs
// 0.92–0.98) while noise stays under the floor. Unpitched frames read as
// silence to the articulation envelope, so amplified noise doesn't
// false-articulate.
const INPUT_GAIN = 16;

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
// ring buffer that emits WINDOW_SIZE analysis windows. The same Float32Array
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

    const ring = new Float32Array(WINDOW_SIZE);
    let writeIndex = 0;
    let samplesWritten = 0;
    let buffersSinceEmit = 0;
    const frame = new Float32Array(WINDOW_SIZE);

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
          ring[writeIndex] = data[i] * INPUT_GAIN;
          writeIndex = (writeIndex + 1) % WINDOW_SIZE;
        }
        samplesWritten += numFrames;
        buffersSinceEmit += 1;
        if (samplesWritten < WINDOW_SIZE || buffersSinceEmit < EMIT_EVERY_N_BUFFERS) {
          return;
        }
        buffersSinceEmit = 0;

        // unroll the ring so the emitted window is in chronological order
        frame.set(ring.subarray(writeIndex), 0);
        frame.set(ring.subarray(0, writeIndex), WINDOW_SIZE - writeIndex);

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
