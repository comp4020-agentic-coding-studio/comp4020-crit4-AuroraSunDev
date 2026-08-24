import { ensureAudio, masterBus } from "./audio";
import { getParams, levelScale } from "./ambience";
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

// The qin pad has no literal "faster" for a single pluck the way the ambient
// voices do — a note is a note. Its rate axis is read instead as how long the
// string keeps ringing: pulled toward "slow" it sustains, toward "fast" it is
// damped sooner, the single-note analogue of 快慢. Bucketed rather than
// continuous so the rendered buffers stay cacheable.
const DECAY_STEPS = 5;

const cache = new Map<string, AudioBuffer>();

function decayBucket(rate: number): number {
  return Math.min(DECAY_STEPS - 1, Math.max(0, Math.round(rate * (DECAY_STEPS - 1))));
}

function variantBuffer(context: AudioContext, stringIndex: number, variant: number, bucket: number): AudioBuffer {
  const key = `${stringIndex}:${variant}:${bucket}`;
  const cached = cache.get(key);
  if (cached) return cached;

  // Brightness spread across the variants: the lowest is a soft, fleshy pluck
  // and the highest is nail on silk. Real playing wanders across that range and
  // a fixed value sounds like a sample being retriggered, which is exactly what
  // this instrument must not sound like.
  const brightness = 0.35 + (variant / Math.max(VARIANTS - 1, 1)) * 0.5;
  const decayMultiplier = 0.55 + (bucket / (DECAY_STEPS - 1)) * 0.9;

  const samples = karplusStrong(stringFrequency(stringIndex), context.sampleRate, {
    brightness,
    duration: NOTE_SECONDS,
    // Lower strings ring longer, as they do on a real instrument — the extra
    // mass takes longer to give up its energy — scaled again by the pad's
    // slow/fast setting.
    decaySeconds: (2.2 + (1 - stringIndex / 7) * 1.4) * decayMultiplier,
  });

  const buffer = context.createBuffer(1, samples.length, context.sampleRate);
  buffer.copyToChannel(samples, 0);
  cache.set(key, buffer);
  return buffer;
}

/**
 * Sound one string.
 *
 * `velocity` is 0…1 and maps to loudness before the qin pad's own volume is
 * applied. There is deliberately no way for this to fail or to be refused:
 * every pluck makes a note.
 */
export function pluck(stringIndex: number, velocity = 0.8): void {
  const context = ensureAudio();
  const { rate, level } = getParams("qin");
  const variant = Math.floor(Math.random() * VARIANTS);
  const buffer = variantBuffer(context, stringIndex, variant, decayBucket(rate));

  const source = context.createBufferSource();
  source.buffer = buffer;
  // ±0.4% — under a tenth of a semitone. Not heard as tuning, heard as a
  // human hand.
  source.playbackRate.value = 1 + (Math.random() - 0.5) * 0.008;

  const gain = context.createGain();
  // Was a flat 0.6 — the scene is outdoors and open, so the qin should carry
  // like something heard across a hillside, not sit in the foreground. The
  // qin pad's own level sits on top, using the same centred curve every other
  // voice uses.
  gain.gain.value = Math.min(Math.max(velocity, 0), 1) * 0.34 * levelScale(level);

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
