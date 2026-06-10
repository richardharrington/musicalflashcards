import { FRAME_SIZE } from '@musicalflashcards/shared';

export type MicFrameCallback = (
  frame: Float32Array,
  sampleRate: number,
  atMs: number,
) => void;

// The only platform-specific audio code: getUserMedia → AnalyserNode →
// Float32Array frames polled on a rAF loop. The same Float32Array is reused
// every frame; consumers must process it synchronously, not retain it.
export const createMicSource = (onFrame: MicFrameCallback) => {
  let session = 0; // bumped by stop() so an in-flight start() knows to bail
  let audioContext: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let rafId: number | null = null;

  const stop = () => {
    session += 1;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (stream !== null) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    if (audioContext !== null) {
      void audioContext.close().catch(() => undefined);
      audioContext = null;
    }
  };

  // Rejects on permission/device errors; call from a user gesture (the
  // Listen toggle) so the AudioContext is allowed to start.
  const start = async () => {
    if (audioContext !== null) return;
    const mySession = ++session;
    try {
      const myStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      if (session !== mySession) {
        myStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = myStream;
      const context = new AudioContext();
      audioContext = context;
      await context.resume();
      if (session !== mySession) return; // stop() already cleaned up

      const source = context.createMediaStreamSource(myStream);
      const analyser = context.createAnalyser();
      analyser.fftSize = FRAME_SIZE;
      source.connect(analyser);

      const frame = new Float32Array(FRAME_SIZE);
      const loop = () => {
        analyser.getFloatTimeDomainData(frame);
        onFrame(frame, context.sampleRate, context.currentTime * 1000);
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    } catch (err) {
      if (session === mySession) stop();
      throw err;
    }
  };

  return { start, stop };
};
