// What Zhong Ziqi has been listening to.
//
// There is no record button anywhere in this prototype, and that is a design
// decision rather than a saving: in the story he is not asked to listen and he
// does not start when told to. He was already listening. So every pluck goes
// into a rolling buffer as it happens, and clicking him asks what he made of
// whatever is in it.
//
// The buffer holds note *events*, never audio. Replaying a phrase re-runs the
// synthesiser over these timings, which makes it a sequencer rather than a
// recording — and keeps the whole prototype on the right side of the spec's
// line about sound being made live rather than played back.

export interface NoteEvent {
  /** Seconds on the audio clock when the string was plucked. */
  readonly time: number;
  readonly stringIndex: number;
  /** 0…1, how hard. */
  readonly velocity: number;
}

/**
 * How many notes he keeps.
 *
 * Bounded because this runs for the length of a session, but the number is
 * musical rather than technical: a phrase is what he responds to, and the last
 * sixty-odd notes is about the length of one.
 */
export const PHRASE_LIMIT = 64;

/** Append a note, dropping the oldest once the buffer is full. */
export function appendEvent(
  events: readonly NoteEvent[],
  event: NoteEvent,
  limit: number = PHRASE_LIMIT,
): NoteEvent[] {
  const next = [...events, event];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/** Seconds from the first note to the last. Zero for none or one. */
export function phraseDuration(events: readonly NoteEvent[]): number {
  if (events.length < 2) return 0;
  return Math.max(0, events[events.length - 1].time - events[0].time);
}

/**
 * The phrase re-timed to start at zero, for looping it back under the scene.
 *
 * Gaps longer than `maxRest` are closed up to it. Someone who plucks a string,
 * wanders off to switch the waterfall on and comes back has left a thirty
 * second hole in the middle of their phrase, and looping that faithfully would
 * be looping mostly silence.
 */
export function asLoop(events: readonly NoteEvent[], maxRest = 1.6): NoteEvent[] {
  if (events.length === 0) return [];

  const loop: NoteEvent[] = [];
  let clock = 0;
  let previous = events[0].time;

  for (const event of events) {
    clock += Math.min(Math.max(event.time - previous, 0), maxRest);
    previous = event.time;
    loop.push({ time: clock, stringIndex: event.stringIndex, velocity: event.velocity });
  }
  return loop;
}
