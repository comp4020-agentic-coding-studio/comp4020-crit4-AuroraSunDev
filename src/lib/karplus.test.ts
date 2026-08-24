import { describe, expect, it } from "vitest";
import { karplusStrong } from "./karplus";

const SAMPLE_RATE = 44_100;

/**
 * mulberry32. The point is only that it is deterministic: the synthesiser takes
 * its randomness as a parameter precisely so these tests can pin it.
 */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function rms(samples: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / Math.max(to - from, 1));
}

/**
 * Estimate the fundamental by autocorrelation, without being told the answer.
 *
 * A decaying string correlates strongly with itself at whole multiples of its
 * period as well as at the period itself, so the global maximum is as likely to
 * land an octave low as on the truth. Hence the walk back down: having found a
 * peak, keep halving while the half is nearly as strong, which is the standard
 * cure for the octave error.
 */
function detectFrequency(samples: Float32Array, sampleRate: number): number {
  const from = Math.floor(0.2 * sampleRate);
  const to = Math.floor(0.5 * sampleRate);
  const window = samples.subarray(from, to);

  const minLag = Math.floor(sampleRate / 2_000);
  const maxLag = Math.floor(sampleRate / 50);

  const correlationAt = (lag: number): number => {
    let sum = 0;
    let energyA = 0;
    let energyB = 0;
    for (let i = 0; i + lag < window.length; i++) {
      sum += window[i] * window[i + lag];
      energyA += window[i] * window[i];
      energyB += window[i + lag] * window[i + lag];
    }
    const norm = Math.sqrt(energyA * energyB);
    return norm > 0 ? sum / norm : 0;
  };

  let bestLag = minLag;
  let best = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const score = correlationAt(lag);
    if (score > best) {
      best = score;
      bestLag = lag;
    }
  }

  for (let half = Math.round(bestLag / 2); half >= minLag; half = Math.round(half / 2)) {
    if (correlationAt(half) < best * 0.85) break;
    bestLag = half;
  }

  return sampleRate / bestLag;
}

describe("the string is in tune", () => {
  // The reason this synthesiser is a pure function. A wrong delay line sounds
  // like a wrong note, and "sounds wrong" is not something the rest of the
  // check suite can see — but it is arithmetic, and arithmetic is testable.
  for (const frequency of [130.81, 174.61, 196, 261.63, 392, 587.33]) {
    it(`renders ${frequency} Hz within a few cents of ${frequency} Hz`, () => {
      const samples = karplusStrong(frequency, SAMPLE_RATE, { random: seededRandom(7) });
      const detected = detectFrequency(samples, SAMPLE_RATE);
      const errorPercent = (Math.abs(detected - frequency) / frequency) * 100;

      expect(
        errorPercent,
        `asked for ${frequency} Hz and got ${detected.toFixed(2)} Hz (${errorPercent.toFixed(2)}% out) — the delay line length sets the pitch, so this is the check that the instrument is tuned at all.`,
      ).toBeLessThan(3);
    });
  }
});

describe("the string behaves like a string", () => {
  it("decays instead of ringing forever", () => {
    const samples = karplusStrong(196, SAMPLE_RATE, { random: seededRandom(1) });
    const decile = Math.floor(samples.length / 10);
    const opening = rms(samples, 0, decile);
    const closing = rms(samples, samples.length - decile, samples.length);

    expect(
      closing,
      `the note is as loud at the end (${closing.toFixed(4)}) as at the start (${opening.toFixed(4)}) — a plucked string loses energy, and one that does not sounds like an oscillator left switched on.`,
    ).toBeLessThan(opening * 0.5);
  });

  it("rings longer when asked to", () => {
    const short = karplusStrong(196, SAMPLE_RATE, {
      decaySeconds: 0.4,
      random: seededRandom(2),
    });
    const long = karplusStrong(196, SAMPLE_RATE, {
      decaySeconds: 4,
      random: seededRandom(2),
    });
    const at = Math.floor(1.5 * SAMPLE_RATE);
    const window = Math.floor(0.1 * SAMPLE_RATE);

    expect(
      rms(long, at, at + window),
      "decaySeconds does not change how much is left of the note a second and a half in, so the guqin's long ring is not actually controllable.",
    ).toBeGreaterThan(rms(short, at, at + window));
  });

  it("keeps its volume when brightness changes its timbre", () => {
    // Smoothing the excitation costs amplitude. Without the normalisation step
    // a soft pluck would also be a quiet one, and velocity would stop being the
    // only thing that controls loudness.
    const dull = karplusStrong(196, SAMPLE_RATE, { brightness: 0, random: seededRandom(3) });
    const bright = karplusStrong(196, SAMPLE_RATE, { brightness: 1, random: seededRandom(3) });
    const decile = Math.floor(dull.length / 10);

    const ratio = rms(bright, 0, decile) / rms(dull, 0, decile);
    expect(
      ratio,
      `a bright pluck is ${ratio.toFixed(2)}x the level of a dull one — brightness is meant to change the tone, not the volume.`,
    ).toBeLessThan(2);
    expect(ratio).toBeGreaterThan(0.5);
  });
});

describe("the samples are safe to hand to Web Audio", () => {
  it("is the length it was asked for", () => {
    const samples = karplusStrong(196, SAMPLE_RATE, {
      duration: 2,
      random: seededRandom(4),
    });
    expect(samples).toHaveLength(2 * SAMPLE_RATE);
  });

  it("never clips", () => {
    let peak = 0;
    for (const frequency of [130.81, 261.63, 587.33]) {
      const samples = karplusStrong(frequency, SAMPLE_RATE, { random: seededRandom(5) });
      for (const sample of samples) {
        peak = Math.max(peak, Math.abs(sample));
      }
    }
    expect(
      peak,
      `peak sample is ${peak.toFixed(4)} — anything above 1 is clipped by the time it reaches the speaker, and clipping is the one audio fault that sounds like a bug rather than a choice.`,
    ).toBeLessThanOrEqual(1);
  });

  it("contains no NaN or infinity", () => {
    const samples = karplusStrong(130.81, SAMPLE_RATE, { random: seededRandom(6) });
    const bad = [...samples].findIndex((sample) => !Number.isFinite(sample));
    expect(
      bad,
      `sample ${bad} is not finite — a single NaN silences the whole AudioBuffer, which presents as "the instrument stopped working".`,
    ).toBe(-1);
  });

  it("renders the same note twice given the same random source", () => {
    const first = karplusStrong(196, SAMPLE_RATE, { random: seededRandom(8) });
    const second = karplusStrong(196, SAMPLE_RATE, { random: seededRandom(8) });
    expect(first).toEqual(second);
  });

  it("refuses nonsense rather than returning silence", () => {
    expect(() => karplusStrong(0, SAMPLE_RATE)).toThrow(RangeError);
    expect(() => karplusStrong(-100, SAMPLE_RATE)).toThrow(RangeError);
    expect(() => karplusStrong(Number.NaN, SAMPLE_RATE)).toThrow(RangeError);
    expect(() => karplusStrong(196, 0)).toThrow(RangeError);
  });
});
