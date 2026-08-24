// Karplus-Strong: a plucked string, from noise and an average.
//
// Fill a buffer one wavelength long with noise, then keep reading it back a
// wavelength behind yourself, averaging each sample with its neighbour as you
// go. The wavelength sets the pitch. The averaging is a one-pole lowpass, and
// running it once per period is what makes the high partials die away first
// while the fundamental rings on — which is what a real string does, and why
// twenty lines of this sounds like an instrument rather than like a beep.
//
// Everything here is deliberately pure and synchronous: given the same inputs,
// including the same random source, it returns the same samples. That is what
// lets the whole synthesiser be verified — pitch included — by unit tests
// before any of it is wired to a speaker or to the DOM.

export interface PluckOptions {
  /**
   * 0 is a soft, muted pluck near the bridge; 1 is bright and nail-struck.
   * Shapes the excitation noise, not the decay.
   */
  brightness?: number;
  /** Length of the rendered sample, in seconds. */
  duration?: number;
  /** Seconds for the string to fall by 60 dB — a guqin rings a long time. */
  decaySeconds?: number;
  /**
   * Injected so the function stays pure and its tests stay deterministic.
   * Production callers leave it alone and get `Math.random`.
   */
  random?: () => number;
}

/** Peak of the excitation, leaving headroom so a stack of plucks has room. */
const EXCITATION_PEAK = 0.9;

// How far the excitation filter is allowed to close. Not 1: a one-pole lowpass
// with a coefficient of exactly 1 has zero gain at every frequency, so
// `brightness: 0` rendered a buffer of silence — a string that looked plucked,
// cost a note event, and made no sound. The unit test for brightness found it;
// nothing downstream would have, because silence and "audio not started yet"
// are the same experience.
const MAX_SMOOTHING = 0.92;

/** Fade applied to the tail, so a sample running out does not click. */
const TAIL_FADE_SECONDS = 0.05;

/**
 * Render one plucked note.
 *
 * Returns mono samples in −1…1, ready to be copied into an `AudioBuffer`.
 */
export function karplusStrong(
  frequency: number,
  sampleRate: number,
  options: PluckOptions = {},
): Float32Array {
  const {
    brightness = 0.5,
    duration = 3.5,
    decaySeconds = 2.4,
    random = Math.random,
  } = options;

  if (!(frequency > 0) || !Number.isFinite(frequency)) {
    throw new RangeError(`frequency must be a positive number, got ${frequency}`);
  }
  if (!(sampleRate > 0) || !Number.isFinite(sampleRate)) {
    throw new RangeError(`sampleRate must be a positive number, got ${sampleRate}`);
  }

  // The delay line's length *is* the pitch. Rounding it to whole samples
  // detunes high notes slightly — the error is a fraction of one sample out of
  // a few hundred down here, well under a cent, and fixing it properly needs a
  // fractional-delay allpass that this instrument does not need.
  const period = Math.max(2, Math.round(sampleRate / frequency));
  const length = Math.max(period + 1, Math.floor(duration * sampleRate));
  const buffer = new Float32Array(length);

  // Excitation. A one-pole lowpass over white noise, where `brightness` sets
  // how much of the previous sample bleeds into this one: at 1 the noise passes
  // through untouched, at 0 it is heavily smoothed and the pluck sounds dull.
  const smoothing = MAX_SMOOTHING * (1 - Math.min(Math.max(brightness, 0), 1));
  let previous = 0;
  let peak = 0;
  for (let i = 0; i < period; i++) {
    const white = random() * 2 - 1;
    previous = white * (1 - smoothing) + previous * smoothing;
    buffer[i] = previous;
    peak = Math.max(peak, Math.abs(previous));
  }

  // Normalise the excitation so brightness changes the timbre and not the
  // volume. Smoothing costs amplitude, and without this a soft pluck would also
  // be a quiet one, which is not how a string behaves.
  if (peak > 0) {
    const gain = EXCITATION_PEAK / peak;
    for (let i = 0; i < period; i++) {
      buffer[i] *= gain;
    }
  }

  // 60 dB is a factor of 1000, so this is the per-sample multiplier that gets
  // there in `decaySeconds`. Expressing decay as a time rather than as a raw
  // coefficient means it stays the same musical length at any sample rate.
  const damping = 0.001 ** (1 / Math.max(decaySeconds * sampleRate, 1));

  for (let i = period; i < length; i++) {
    buffer[i] = damping * 0.5 * (buffer[i - period] + buffer[i - period + 1]);
  }

  // The string is still ringing when the buffer ends; cutting it dead there is
  // a click, which on a quiet instrument is louder than the note.
  const fade = Math.min(Math.floor(TAIL_FADE_SECONDS * sampleRate), length);
  for (let i = 0; i < fade; i++) {
    buffer[length - fade + i] *= 1 - i / fade;
  }

  return buffer;
}
