import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROOT_HZ,
  OPEN_STRING_SEMITONES,
  STRING_COUNT,
  stringFrequencies,
  stringFrequency,
} from "./scale";

describe("the tuning is what makes the instrument unfailable", () => {
  // This is the load-bearing test of the whole prototype. The crit spec asks
  // for "no way to play it wrong", and the answer given is the tuning rather
  // than the absence of a score. If a semitone ever appears in here, that
  // answer quietly stops being true while everything still looks fine.
  it("puts no two strings a semitone apart", () => {
    const pitches = [...OPEN_STRING_SEMITONES].sort((a, b) => a - b);

    for (let i = 1; i < pitches.length; i++) {
      const gap = pitches[i] - pitches[i - 1];
      expect(
        gap,
        `strings at ${pitches[i - 1]} and ${pitches[i]} semitones are ${gap} apart — a semitone is the one interval that can sound like a mistake, and the "no way to play it wrong" claim rests on there being none.`,
      ).toBeGreaterThan(1);
    }
  });

  it("is pentatonic once folded into a single octave", () => {
    const classes = new Set(OPEN_STRING_SEMITONES.map((s) => s % 12));
    expect(
      [...classes].sort((a, b) => a - b),
      "the seven strings should span five distinct pitch classes — 宫商角徵羽, the pentatonic scale.",
    ).toEqual([0, 2, 5, 7, 9]);
  });
});

describe("open strings sound where the instrument says they do", () => {
  it("has seven of them", () => {
    expect(STRING_COUNT).toBe(7);
    expect(stringFrequencies()).toHaveLength(7);
  });

  it("rises from the first string to the seventh", () => {
    const pitches = stringFrequencies();
    for (let i = 1; i < pitches.length; i++) {
      expect(
        pitches[i],
        `string ${i} is not above string ${i - 1} — the strings are laid out low to high, and the drag-to-glissando gesture reads as a rise because of it.`,
      ).toBeGreaterThan(pitches[i - 1]);
    }
  });

  it("puts the sixth string exactly an octave above the first", () => {
    // 宫 recurs at string 6 in 正调; an octave is a doubling, so this is a
    // clean arithmetic check that the semitone table and the 2^(n/12) maths
    // agree with each other.
    expect(stringFrequency(5)).toBeCloseTo(stringFrequency(0) * 2, 6);
  });

  it("starts where the root says it starts", () => {
    expect(stringFrequency(0)).toBeCloseTo(DEFAULT_ROOT_HZ, 6);
  });

  it("transposes as a whole when the root moves", () => {
    const normal = stringFrequencies();
    const octaveUp = stringFrequencies(DEFAULT_ROOT_HZ * 2);
    for (let i = 0; i < normal.length; i++) {
      expect(octaveUp[i]).toBeCloseTo(normal[i] * 2, 6);
    }
  });

  it("refuses a string that does not exist rather than returning NaN", () => {
    // Silence is the worst possible failure here: a pluck that produces
    // nothing is indistinguishable from a broken audio context.
    expect(() => stringFrequency(STRING_COUNT)).toThrow(RangeError);
    expect(() => stringFrequency(-1)).toThrow(RangeError);
  });
});
