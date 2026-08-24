// The tuning, and the reason the instrument cannot be played wrong.
//
// The guqin's seven open strings in 正调 (zhengdiao, the standard tuning) are
// 徵 羽 宫 商 角 徵 羽 — in absolute intervals, C D F G A C D. Reduced to one
// octave that is the set {0, 2, 5, 7, 9}: the anhemitonic pentatonic scale,
// "anhemitonic" meaning it contains no semitone anywhere. Every interval
// available on the instrument is a tone or larger, so no two strings can beat
// against each other and no combination of them lands on a dissonance.
//
// This is what carries the spec's "there is no way to play it wrong". Not a
// missing fail state — a tuning in which failure has no note to land on. It is
// also simply how the instrument is tuned, which is the part worth liking: the
// authentic answer and the accessible one are the same answer.

/** Semitones above the root for each open string, low to high. */
export const OPEN_STRING_SEMITONES: readonly number[] = [0, 2, 5, 7, 9, 12, 14];

export const STRING_COUNT = OPEN_STRING_SEMITONES.length;

// A real guqin's first string sits around C2 (65 Hz). Two octaves of that is
// mostly below what a laptop speaker can move, and this gets marked on a
// laptop in a room with people in it — so the whole instrument is transposed up
// an octave to C3, which keeps the low, resonant character while putting the
// fundamentals somewhere a built-in speaker can actually reproduce. Tunable,
// because the right answer to this is decided by ear, not by argument.
export const DEFAULT_ROOT_HZ = 130.81;

/**
 * The sounding frequency of an open string, in hertz.
 *
 * `index` is zero-based and low to high, so 0 is the first string (宫 in the
 * player's hand, the thick one nearest the body).
 */
export function stringFrequency(index: number, rootHz: number = DEFAULT_ROOT_HZ): number {
  const semitones = OPEN_STRING_SEMITONES[index];
  if (semitones === undefined) {
    throw new RangeError(
      `string ${index} does not exist — the guqin has ${STRING_COUNT} strings, indexed 0 to ${STRING_COUNT - 1}.`,
    );
  }
  return rootHz * 2 ** (semitones / 12);
}

/** Every open string's frequency, low to high. */
export function stringFrequencies(rootHz: number = DEFAULT_ROOT_HZ): number[] {
  return OPEN_STRING_SEMITONES.map((semitones) => rootHz * 2 ** (semitones / 12));
}
