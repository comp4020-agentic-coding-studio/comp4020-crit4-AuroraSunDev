import { describe, expect, it } from "vitest";
import { appendEvent, asLoop, phraseDuration, PHRASE_LIMIT, type NoteEvent } from "./performance";

function note(time: number, stringIndex = 3): NoteEvent {
  return { time, stringIndex, velocity: 0.7 };
}

describe("he keeps the last phrase, not the whole session", () => {
  it("appends without mutating what it was given", () => {
    const before: NoteEvent[] = [note(0)];
    const after = appendEvent(before, note(1));
    expect(before).toHaveLength(1);
    expect(after).toHaveLength(2);
  });

  it("drops the oldest note once it is full", () => {
    let events: NoteEvent[] = [];
    for (let i = 0; i < PHRASE_LIMIT + 12; i++) events = appendEvent(events, note(i));

    expect(events).toHaveLength(PHRASE_LIMIT);
    expect(
      events[0].time,
      "the buffer kept the beginning of the session instead of the most recent phrase — he would be answering something you played ten minutes ago.",
    ).toBe(12);
  });
});

describe("phrase timing", () => {
  it("measures first note to last", () => {
    expect(phraseDuration([note(2), note(3.5), note(6)])).toBeCloseTo(4);
  });

  it("is zero when there is nothing to measure", () => {
    expect(phraseDuration([])).toBe(0);
    expect(phraseDuration([note(9)])).toBe(0);
  });
});

describe("looping the phrase back under the scene", () => {
  it("re-times it to start at zero", () => {
    const loop = asLoop([note(10), note(10.5), note(11)]);
    expect(loop[0].time).toBe(0);
    expect(loop[1].time).toBeCloseTo(0.5);
  });

  it("closes up a gap left by wandering off mid-phrase", () => {
    // Someone plucks a string, goes to switch the waterfall on, comes back.
    // Looping that faithfully means looping thirty seconds of silence.
    const loop = asLoop([note(0), note(0.4), note(31), note(31.3)], 1.6);
    expect(
      loop[loop.length - 1].time,
      "a long rest was replayed at full length — the loop would be mostly silence.",
    ).toBeLessThan(3);
  });

  it("keeps which string and how hard", () => {
    const loop = asLoop([{ time: 4, stringIndex: 6, velocity: 0.42 }]);
    expect(loop[0].stringIndex).toBe(6);
    expect(loop[0].velocity).toBe(0.42);
  });

  it("has nothing to loop when nothing was played", () => {
    expect(asLoop([])).toEqual([]);
  });
});
