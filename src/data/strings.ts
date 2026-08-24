// The seven strings of a guqin in 正调, low to high.
//
// The degree names are the pentatonic ones, 宫商角徵羽, and they do not start
// at 宫: the third string is 宫, so the first two strings are the 徵 and 羽 of
// the octave below. That is genuinely how the instrument is tuned, and it is
// why the interval pattern in scale.ts starts 0, 2, 5 rather than 0, 2, 4.

export interface GuqinString {
  /** The string's traditional number, 一 through 七. */
  readonly ordinal: string;
  /** Its degree in the pentatonic scale. */
  readonly degree: string;
}

export const STRINGS: readonly GuqinString[] = [
  { ordinal: "一", degree: "徵" },
  { ordinal: "二", degree: "羽" },
  { ordinal: "三", degree: "宫" },
  { ordinal: "四", degree: "商" },
  { ordinal: "五", degree: "角" },
  { ordinal: "六", degree: "徵" },
  { ordinal: "七", degree: "羽" },
];

/**
 * Keys that pluck each string, in order.
 *
 * Two rows, because there is no single obvious mapping and both guesses are
 * cheap to support: the number row reads as "string one to string seven", and
 * the home row is what a hand already resting on the keyboard will find.
 */
export const STRING_KEYS: readonly string[][] = [
  ["1", "a"],
  ["2", "s"],
  ["3", "d"],
  ["4", "f"],
  ["5", "g"],
  ["6", "h"],
  ["7", "j"],
];
