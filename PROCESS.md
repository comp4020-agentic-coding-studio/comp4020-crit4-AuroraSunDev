# Process overview

## What I built

**高山流水 — High Mountains, Flowing Water.** An ink landscape that is also a
guqin. Boya sits at the instrument, Zhong Ziqi sits opposite him, and the
waterfall, the stream, the pine and the bird each answer a touch. Every sound in
it is synthesised in the browser at the moment you ask for it — there is not one
audio file in the repository, and nowhere in the build for one to hide. The
claim the thing makes is that the spec's hardest line, *there is no way to play
it wrong*, is not a fail state that was removed but two facts about the
material: the tuning is anhemitonic pentatonic, so no two strings can sound a
semitone against each other; and 钟子期, in the source text, never grades the
playing — he only says what he heard.

## The moments that mattered

### A check that could not see the code it was grepping

The first thing written this week was a spec test, before any of the instrument
existed, asserting that the shipped script builds a Web Audio graph. It globbed
`dist/**/*.js` — and Astro inlines a small entry script into the HTML and emits
no `.js` file at all. So the check was red, and its message said the page had no
synthesis in it, and both of those were true for entirely the wrong reason: it
was reading an empty string. Worse, it would have gone on failing after the
instrument worked, and then started passing on the unrelated day the bundle grew
past Astro's inlining threshold.

I fixed it by reading inline `<script>` content as well as emitted files, and
took the opportunity to state the contract more strongly than the original did:
`dist/` must ship no audio file and the script must name none, because
`fetch()` and an `AudioBufferSourceNode` can play a sample with no `<audio>`
element anywhere in sight
([`ef95e2b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-AuroraSunDev/commit/ef95e2b)).
The rule that came out of it is in `CLAUDE.md`: before trusting a new check,
make it fail for the right reason once, and read the message it prints
([`114e5d0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-AuroraSunDev/commit/114e5d0)).

### A string that was plucked and made no sound

The synthesiser is a pure function that takes its randomness as a parameter,
which is the only reason the rest of this was possible: pitch is verifiable by
autocorrelation with nothing on screen and no speaker attached, and all six test
frequencies land within 3%. What the tests actually caught was something I was
not looking for. A test asserting that *brightness should change the tone and
not the volume* failed with a ratio of `Infinity` — because at `brightness: 0`
the excitation filter's coefficient reaches exactly 1, a one-pole lowpass with a
coefficient of 1 has zero gain at every frequency, and the buffer came out
silent. A string that looked plucked, cost a note event, and produced nothing
([`2bc990a`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-AuroraSunDev/commit/2bc990a)).

Nothing downstream would have found that, because silence and *audio has not
started yet* are the same experience.

### The waterfall that was, twice, a stone obelisk

The painting was drawn by writing SVG and looking at screenshots, and the
waterfall took three attempts. Twice I painted a pale column onto pale paper,
and twice it read unmistakably as carved stone — because a stripe *brighter*
than the page is not something water can be. The fix was not a better shape but
a different idea: in ink painting the water is the paper, so the fall is now a
gap cut out of a dark cliff, fading into mist at its head rather than starting
at a ruled edge. The same idea then solved the stream, which is why the two read
as the same substance
([`c4aab5f...6567a10`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-AuroraSunDev/compare/c4aab5f...6567a10)).

In the same pass I added a row of distant trees as a stem plus a horizontal
crossbar, and rendered a row of crucifixes straight across the middle of the
painting — an accidental graveyard, which the build, the typechecker and 62
passing tests were all perfectly happy with
([`f041e0c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-AuroraSunDev/commit/f041e0c)).

The `sips` note I carried into this repo from assignment 1 said that an asset
pipeline can only be verified by rendering the page and sampling actual pixels.
It was written about image conversion and turned out to be about everything, so
it is now a general rule with the screenshot loop in it — including the two
traps that cost me time inside the loop itself: headless Chrome clamps its
layout viewport near 490px, so a 390px screenshot silently reports overflow that
does not exist, and virtual time will not chain `requestAnimationFrame`, so a
screenshot can confirm a CSS animation but never a JS-driven one
([`114e5d0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-AuroraSunDev/commit/114e5d0)).

### Taking the record button out

The brief I set myself had a record button: play something, press stop, and the
page loops your composition back. Building it that way would have meant a mode,
a state machine, and a stop condition. Then the story pointed at the answer —
in 《列子·汤问》 Ziqi is not asked to listen and does not begin when told. He was
already listening. So there is no record button: every pluck appends to a
rolling buffer as it happens, and clicking him asks what he made of it
([`7457119`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-AuroraSunDev/commit/7457119)).

It is a third of the code the other design needed, and it moved the spec line
about replay onto safe ground as a side effect: the loop under the painting is
re-synthesised from note events, so it is a sequencer and not a recording.

### Two checks that hold claims a person would otherwise have to take on trust

The two spec lines I could most easily have asserted in a reflection and never
tested are the ones now under checks. `src/lib/scale.test.ts` asserts that no
two strings sit a semitone apart, which is what turns *no way to play it wrong*
from a claim about intent into a property of the tuning. `src/lib/zhiyin.test.ts`
asserts that the five response bands cover the whole 山–水 axis with no gap, that
every line is reachable, and that none of them grades the player — so no
performance exists that Ziqi has nothing to say to, and there is no line waiting
for someone who played badly
([`7457119`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-AuroraSunDev/commit/7457119)).

### A waterfall that ran briefly upward

The animation loop publishes numbers and lets CSS draw, following the rule I set
in assignment 1. Its first frame came out at `-0.44`. `requestAnimationFrame`
reports the timestamp of the *start* of the frame, which can predate the
`performance.now()` the loop was seeded with, so the first delta is negative and
the water runs backwards for one frame. Capping the delta from above is the
familiar move — a backgrounded tab hands back an enormous first frame — and it
had not occurred to me that it needed capping from below as well
([`004c629`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-AuroraSunDev/commit/004c629)).

## Where to look

- `src/lib/` — the pure half, each module with its tests beside it:
  `karplus.ts` (the string), `scale.ts` (the tuning), `zhiyin.ts` (the
  listening), `performance.ts` (the buffer).
- `src/components/Landscape.astro` — the painting. The comments record what was
  drawn wrong first and why, which is most of what I learned this week.
- `spec/instrument.test.ts` — the week's contract, split into what a test can
  hold and what only the crit can judge.
- `CLAUDE.md` — the two rules this week paid for.
