import { ZHIYIN_LINES, ZHIYIN_WAITING, type ZhiyinLine } from "../data/zhiyin-lines";
import { STRING_COUNT } from "./scale";
import { phraseDuration, type NoteEvent } from "./performance";

// 知音 — "the one who knows the sound".
//
// Three things are measured in what you played, and each is projected onto the
// same axis running from 山 at −1 to 水 at +1, because that is the axis the
// story is told on. Ziqi does not report a score; he reports which of those two
// he heard.
//
// Deliberately no randomness anywhere below. The same phrase must always draw
// the same response — a listener who answers differently to the same playing is
// not listening, he is guessing, and the whole conceit collapses.

export interface Reading {
  /** −1 is entirely mountain, +1 is entirely water. */
  readonly axis: number;
  /** The three measurements, kept so the reply can be built from them. */
  readonly pitch: number;
  readonly density: number;
  readonly motion: number;
  readonly line: ZhiyinLine | typeof ZHIYIN_WAITING;
  /** False when there was not enough playing to have an opinion about. */
  readonly heard: boolean;
}

/** Below this, he has not heard a phrase — only a note or two. */
const ENOUGH = 3;

function clamp(value: number): number {
  return Math.min(Math.max(value, -1), 1);
}

/** Pick the line whose band contains the axis. Bands are contiguous by design. */
export function lineFor(axis: number): ZhiyinLine {
  let chosen = ZHIYIN_LINES[0];
  for (const line of ZHIYIN_LINES) {
    if (axis >= line.from) chosen = line;
  }
  return chosen;
}

export function analyse(events: readonly NoteEvent[]): Reading {
  if (events.length < ENOUGH) {
    return { axis: 0, pitch: 0, density: 0, motion: 0, line: ZHIYIN_WAITING, heard: false };
  }

  // Where the playing sits on the instrument. Low strings are the mountain end
  // for the obvious physical reason: a big slow thing sounds low.
  const meanString =
    events.reduce((sum, event) => sum + event.stringIndex, 0) / events.length;
  const pitch = clamp((meanString / (STRING_COUNT - 1)) * 2 - 1);

  // How crowded it is. A note every two seconds is a mountain; four a second is
  // a river. The midpoint sits near 1.6 notes per second.
  const seconds = phraseDuration(events);
  const rate = seconds > 0 ? (events.length - 1) / seconds : ENOUGH;
  const density = clamp(Math.log2(Math.max(rate, 0.08) / 1.6) / 2);

  // How it moves. Stepwise playing flows; big leaps between strings are
  // ridgelines. Averaged over consecutive pairs, then inverted, because a wide
  // interval belongs at the mountain end.
  let leaps = 0;
  for (let i = 1; i < events.length; i++) {
    leaps += Math.abs(events[i].stringIndex - events[i - 1].stringIndex);
  }
  const meanLeap = leaps / (events.length - 1);
  const motion = clamp(1 - meanLeap / 1.8);

  const axis = clamp((pitch + density + motion) / 3);

  return { axis, pitch, density, motion, line: lineFor(axis), heard: true };
}

export interface ReplyNote {
  readonly stringIndex: number;
  /** Seconds after the reply starts. */
  readonly at: number;
  readonly velocity: number;
}

/**
 * The few notes he plays back.
 *
 * He answers in kind rather than repeating you: a mountain reading comes back
 * low, spaced and leaping; a water reading comes back high, quick and
 * stepwise. Two people who play differently get different replies, which is
 * the same claim the spec makes about the instrument itself.
 */
export function replyMotif(reading: Reading): ReplyNote[] {
  if (!reading.heard) return [];

  const water = (reading.axis + 1) / 2; // 0 mountain … 1 water
  const root = Math.round(water * 3); // low strings for 山, higher for 水
  const step = water > 0.5 ? 1 : 2; // stepwise for water, leaping for mountain
  const gap = 0.62 - water * 0.34; // and quicker

  const shape = water > 0.5 ? [0, 1, 2, 1] : [0, 2, 1];

  return shape.map((offset, index) => ({
    stringIndex: Math.min(STRING_COUNT - 1, root + offset * step),
    at: index * gap,
    velocity: 0.5 + (index === 0 ? 0.12 : 0),
  }));
}
