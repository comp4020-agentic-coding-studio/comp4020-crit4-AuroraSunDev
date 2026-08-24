import { ensureAudio, masterBus } from "./audio";
import { karplusStrong } from "./karplus";
import { stringFrequency } from "./scale";

// Playing the strings: rendered buffers in, scheduled sources out.
//
// Rendering a three-second note is around a hundred thousand float operations,
// which is fast, but fast enough to do thirty times a second during a drag is a
// different question — and each one allocates half a megabyte that the garbage
// collector then has to take back, on the same thread that is drawing. So notes
// are rendered once and reused.
//
// Reuse alone would make every pluck of a string bit-identical, which is
// audible and dull. Two things break that up cheaply: a handful of brightness
// variants per string, chosen at random, and a small detune applied by nudging
// playbackRate, which costs nothing because resampling is the sound card's job.

const VARIANTS = 4;
const NOTE_SECONDS = 3;

const cache = new Map<string, AudioBuffer>();

function variantBuffer(context: AudioContext, stringIndex: number, variant: number): AudioBuffer {
  const key = `${stringIndex}:${variant}`;
  const cached = cache.get(key);
  if (cached) return cached;

  // Brightness spread across the variants: the lowest is a soft, fleshy pluck
  // and the highest is nail on silk. Real playing wanders across that range and
  // a fixed value sounds like a sample being retriggered, which is exactly what
  // this instrument must not sound like.
  const brightness = 0.35 + (variant / Math.max(VARIANTS - 1, 1)) * 0.5;

  const samples = karplusStrong(stringFrequency(stringIndex), context.sampleRate, {
    brightness,
    duration: NOTE_SECONDS,
    // Lower strings ring longer, as they do on a real instrument — the extra
    // mass takes longer to give up its energy.
    decaySeconds: 2.2 + (1 - stringIndex / 7) * 1.4,
  });

  const buffer = context.createBuffer(1, samples.length, context.sampleRate);
  buffer.copyToChannel(samples, 0);
  cache.set(key, buffer);
  return buffer;
}

/**
 * Sound one string.
 *
 * `velocity` is 0…1 and maps to loudness only. There is deliberately no way for
 * this to fail or to be refused: every pluck makes a note.
 */
export function pluck(stringIndex: number, velocity = 0.8): void {
  const context = ensureAudio();
  const variant = Math.floor(Math.random() * VARIANTS);
  const buffer = variantBuffer(context, stringIndex, variant);

  const source = context.createBufferSource();
  source.buffer = buffer;
  // ±0.4% — under a tenth of a semitone. Not heard as tuning, heard as a
  // human hand.
  source.playbackRate.value = 1 + (Math.random() - 0.5) * 0.008;

  const gain = context.createGain();
  gain.gain.value = Math.min(Math.max(velocity, 0), 1) * 0.6;

  source.connect(gain);
  gain.connect(masterBus());
  source.start();

  // Buffer sources are single-use; letting them pile up leaks nodes over a long
  // session of enthusiastic playing.
  source.addEventListener("ended", () => {
    source.disconnect();
    gain.disconnect();
  });
}

/** Drop the rendered notes. Only needed if the tuning changes at runtime. */
export function clearPluckCache(): void {
  cache.clear();
}
