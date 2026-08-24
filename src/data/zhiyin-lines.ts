// What Zhong Ziqi says.
//
// From 《列子·汤问》: 伯牙鼓琴，志在高山，钟子期曰：「善哉，峨峨兮若泰山！」
// 志在流水，钟子期曰：「善哉，洋洋兮若江河！」 — Boya played with his mind on
// high mountains, and Ziqi said "towering, like Mount Tai"; with his mind on
// flowing water, and Ziqi said "vast, like the great rivers".
//
// Every line here describes what he heard. None of them grades it. That is the
// whole of the spec's "there is no way to play it wrong" on this side of the
// prototype: not a fail state that has been removed, but a listener who was
// never keeping score. There is deliberately no line for playing badly, and
// zhiyin.test.ts holds that property by checking the bands cover the axis with
// no gap — every possible performance has something waiting for it.
//
// 「善哉」 does translate as "excellent", and it is kept because it is the
// canonical exclamation in the source. It is recognition rather than a mark:
// what carries the meaning is the clause after it, which is a description of a
// landscape, not a verdict on a player.

export interface ZhiyinLine {
  readonly id: string;
  /** Lowest axis value this line answers, inclusive. −1 is 山, +1 is 水. */
  readonly from: number;
  readonly han: string;
  readonly gloss: string;
}

/** Ordered low to high; each line runs until the next one begins. */
export const ZHIYIN_LINES: readonly ZhiyinLine[] = [
  {
    id: "taishan",
    from: -1,
    han: "善哉，峨峨兮若泰山",
    gloss: "Towering — like Mount Tai.",
  },
  {
    id: "gaoshan",
    from: -0.5,
    han: "巍巍乎，志在高山",
    gloss: "Lofty. Your mind is on high mountains.",
  },
  {
    id: "between",
    from: -0.15,
    han: "山既在，水亦在",
    gloss: "The mountain is there, and the water is there too.",
  },
  {
    id: "liushui",
    from: 0.15,
    han: "汤汤乎，志在流水",
    gloss: "Surging. Your mind is on flowing water.",
  },
  {
    id: "jianghe",
    from: 0.5,
    han: "善哉，洋洋兮若江河",
    gloss: "Vast — like the great rivers.",
  },
];

/**
 * What he says before you have played anything.
 *
 * Not a refusal and not a complaint — an invitation, which is also the only
 * instruction this prototype gives anyone. A stranger who clicks the listening
 * figure first is told, in character, where to go.
 */
export const ZHIYIN_WAITING = {
  id: "waiting",
  han: "子期在此，先生请抚弦",
  gloss: "Ziqi is here. Play, and he will listen.",
} as const;
