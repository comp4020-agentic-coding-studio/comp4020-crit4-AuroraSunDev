import type { NoteEvent } from "../lib/performance";

// What Boya is playing when you arrive.
//
// This is a phrase *in the manner of* 《流水》 — its shape, not a transcription:
// the low rolled entry, the rising figure that opens out, and the long
// descending cascade the piece is named for. I can read the gesture of that
// music; I cannot claim to have set down its notes, and saying so is cheaper
// than being caught claiming otherwise at a crit.
//
// It is note events, not audio. The same seven strings and the same
// Karplus-Strong string render it that render everything you play, which is
// the point: his opening and your improvising come out of one throat. An
// earlier plan for this was an .ogg of a real performance, which would have
// failed the spec's central line, failed `pnpm check`, and — because deploy
// needs check — never have reached the live URL at all.
//
// Times are seconds from the start of the phrase; the loop restarts a beat
// after the last note.

export const OPENING_PHRASE: readonly NoteEvent[] = [
  // 起: a low roll, three strings brushed in turn
  { time: 0.0, stringIndex: 0, velocity: 0.62 },
  { time: 0.16, stringIndex: 1, velocity: 0.5 },
  { time: 0.3, stringIndex: 2, velocity: 0.56 },
  { time: 1.15, stringIndex: 0, velocity: 0.45 },

  // 承: the figure opens upward, stepwise, gathering
  { time: 1.9, stringIndex: 2, velocity: 0.58 },
  { time: 2.32, stringIndex: 3, velocity: 0.54 },
  { time: 2.7, stringIndex: 4, velocity: 0.6 },
  { time: 3.22, stringIndex: 3, velocity: 0.46 },
  { time: 3.6, stringIndex: 4, velocity: 0.55 },
  { time: 4.0, stringIndex: 5, velocity: 0.62 },

  // 转: the high turn, quick and light
  { time: 4.62, stringIndex: 6, velocity: 0.58 },
  { time: 4.86, stringIndex: 5, velocity: 0.44 },
  { time: 5.08, stringIndex: 6, velocity: 0.5 },
  { time: 5.34, stringIndex: 5, velocity: 0.42 },

  // 合: the water comes down — the cascade the piece is named for
  { time: 5.9, stringIndex: 6, velocity: 0.6 },
  { time: 6.1, stringIndex: 5, velocity: 0.54 },
  { time: 6.28, stringIndex: 4, velocity: 0.5 },
  { time: 6.46, stringIndex: 3, velocity: 0.48 },
  { time: 6.66, stringIndex: 2, velocity: 0.5 },
  { time: 6.9, stringIndex: 1, velocity: 0.46 },
  { time: 7.2, stringIndex: 0, velocity: 0.56 },
  { time: 8.3, stringIndex: 2, velocity: 0.38 },
];
