// Synthesized PCM frames for pitch-pipeline tests.

export const SAMPLE_RATE = 48000;

type FrameSpec = {
  frameSize: number;
  numFrames: number;
  amplitude: number;
};

const sliceFrames = (samples: Float32Array, frameSize: number): Array<Float32Array> => {
  const frames: Array<Float32Array> = [];
  for (let start = 0; start + frameSize <= samples.length; start += frameSize) {
    frames.push(samples.slice(start, start + frameSize));
  }
  return frames;
};

// Phase-continuous across frames, like a real stream.
export const sineFrames = (
  freq: number,
  { frameSize, numFrames, amplitude }: FrameSpec,
): Array<Float32Array> => {
  const samples = new Float32Array(frameSize * numFrames);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
  }
  return sliceFrames(samples, frameSize);
};

// Deterministic white noise (LCG) so the clarity-gate tests can't flake.
export const noiseFrames = (
  { frameSize, numFrames, amplitude }: FrameSpec,
  seed = 1,
): Array<Float32Array> => {
  let state = seed >>> 0;
  const nextUnit = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const samples = new Float32Array(frameSize * numFrames);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = amplitude * (nextUnit() * 2 - 1);
  }
  return sliceFrames(samples, frameSize);
};

export const silentFrames = ({ frameSize, numFrames }: Omit<FrameSpec, 'amplitude'>): Array<Float32Array> => {
  const frames: Array<Float32Array> = [];
  for (let i = 0; i < numFrames; i++) {
    frames.push(new Float32Array(frameSize));
  }
  return frames;
};

export const centsToFreq = (baseFreq: number, cents: number): number =>
  baseFreq * 2 ** (cents / 1200);
