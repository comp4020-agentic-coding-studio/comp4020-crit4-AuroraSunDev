import { describe, expect, it } from "vitest";
import { ZHIYIN_LINES } from "../data/zhiyin-lines";
import type { NoteEvent } from "./performance";
import { analyse, lineFor, replyMotif } from "./zhiyin";

/** A phrase, from (string, gap-before-it) pairs. */
function phrase(steps: [stringIndex: number, gap: number][]): NoteEvent[] {
  let time = 0;
  return steps.map(([stringIndex, gap]) => {
    time += gap;
    return { time, stringIndex, velocity: 0.7 };
  });
}

const MOUNTAIN = phrase([
  [0, 0],
  [3, 1.5],
  [0, 1.6],
  [2, 1.4],
  [0, 1.7],
]);

const WATER = phrase([
  [5, 0],
  [6, 0.2],
  [5, 0.18],
  [4, 0.22],
  [5, 0.2],
  [6, 0.19],
  [6, 0.21],
]);

describe("Zhong Ziqi hears a mountain or a river", () => {
  it("hears a mountain in low, slow, leaping playing", () => {
    const reading = analyse(MOUNTAIN);
    expect(
      reading.axis,
      `low strings, wide leaps and long rests read as ${reading.axis.toFixed(2)} — that should sit on the 山 side of the axis, or the response has nothing to do with the playing.`,
    ).toBeLessThan(-0.15);
    expect(reading.line.han).toContain("山");
  });

  it("hears water in high, quick, stepwise playing", () => {
    const reading = analyse(WATER);
    expect(
      reading.axis,
      `high strings, small intervals and a fast rate read as ${reading.axis.toFixed(2)} — that should sit on the 水 side.`,
    ).toBeGreaterThan(0.15);
    expect(reading.line.gloss.toLowerCase()).toMatch(/water|river/);
  });

  it("answers the same phrase the same way every time", () => {
    // A listener who says something different about identical playing is not
    // listening, he is guessing — so there is no randomness in analyse().
    const first = analyse(WATER);
    const second = analyse(WATER);
    expect(first.axis).toBe(second.axis);
    expect(first.line.id).toBe(second.line.id);
  });

  it("invites you to play rather than judging silence", () => {
    const reading = analyse(phrase([[3, 0]]));
    expect(
      reading.heard,
      "one note is not a phrase, and he should say so by inviting you to play rather than by reporting on it.",
    ).toBe(false);
    expect(reading.line.id).toBe("waiting");
  });
});

describe("there is no performance he has nothing to say to", () => {
  // This is the spec's "no way to play it wrong" on the listening side. Not a
  // fail state that was removed — a set of bands that covers the whole axis, so
  // every possible phrase lands on a line, and none of the lines is a bad mark.
  it("covers the axis with no gap", () => {
    for (let axis = -1; axis <= 1.0001; axis += 0.05) {
      const line = lineFor(Math.min(axis, 1));
      expect(line, `no line answers an axis of ${axis.toFixed(2)}`).toBeTruthy();
    }
  });

  it("can reach every line it defines, so none of them is dead text", () => {
    const reachable = new Set<string>();
    for (let axis = -1; axis <= 1.0001; axis += 0.01) {
      reachable.add(lineFor(Math.min(axis, 1)).id);
    }
    for (const line of ZHIYIN_LINES) {
      expect(
        reachable.has(line.id),
        `"${line.han}" can never be said — its band is unreachable, so it is text pretending to be a response.`,
      ).toBe(true);
    }
  });

  it("says only what it heard, never how good it was", () => {
    // The rule that keeps the no-fail-state promise honest. Ziqi describes a
    // landscape; he does not grade a performance.
    const GRADING = /\b(better|worse|wrong|poor|bad|mistake|good job|well played|score)\b/i;
    for (const line of ZHIYIN_LINES) {
      expect(
        GRADING.test(line.gloss),
        `"${line.gloss}" reads as a verdict on the player — every line has to describe what was heard instead.`,
      ).toBe(false);
    }
  });
});

describe("he answers in kind", () => {
  it("replies low and spaced to a mountain, high and quick to water", () => {
    const mountain = replyMotif(analyse(MOUNTAIN));
    const water = replyMotif(analyse(WATER));

    const meanString = (notes: { stringIndex: number }[]): number =>
      notes.reduce((sum, n) => sum + n.stringIndex, 0) / notes.length;

    expect(
      meanString(water),
      "his reply to water should sit higher on the instrument than his reply to a mountain — two players who sound different should be answered differently.",
    ).toBeGreaterThan(meanString(mountain));

    const span = (notes: { at: number }[]): number => notes[notes.length - 1].at;
    expect(span(water) / water.length).toBeLessThan(span(mountain) / mountain.length);
  });

  it("stays on the instrument", () => {
    for (const events of [MOUNTAIN, WATER]) {
      for (const note of replyMotif(analyse(events))) {
        expect(note.stringIndex).toBeGreaterThanOrEqual(0);
        expect(note.stringIndex).toBeLessThan(7);
      }
    }
  });

  it("says nothing back when it has not heard a phrase", () => {
    expect(replyMotif(analyse(phrase([[2, 0]])))).toEqual([]);
  });
});
