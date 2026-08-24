import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Crit 4 ("An instrument") published spec, split into what a test can hold:
// https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/04-instrument/
//
// Mechanically checkable, asserted here:
// - "the browser is the instrument — sound is made live in the page by the
//   player, not played back"
// - "playable with whatever is at hand — mouse, keyboard or touch"
//
// Only a person can judge at the crit, not tested here:
// - "it is expressive: the player's choices shape what they hear, and two
//   players sound different"
// - "a stranger can play it uninstructed — the opening screen invites the
//   first sound"
// - "there is no way to play it wrong — no score, no fail state". Not
//   untestable so much as tested somewhere better: the claim rests on the
//   tuning being anhemitonic pentatonic, and src/lib/scale.test.ts asserts
//   that no two strings sit a semitone apart. A DOM test here could only
//   assert the absence of a score, which is not the same promise.
//
// Already covered elsewhere, not duplicated here:
// - "the starter's invariant checks pass" — spec/invariants.test.ts.
// - "deployed and live at its public GitHub Pages URL" — CI's deploy job.

const DIST = resolve("dist");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const shipped = files(DIST);

const html = shipped
  .filter((path) => path.endsWith(".html"))
  .map((path) => readFileSync(path, "utf8"));

// Every line of script that actually ships, wherever Astro decided to put it.
//
// This used to read only `dist/**/*.js`, and was wrong in a way that no failure
// message would have explained: Astro inlines a small entry script into the
// HTML as <script type="module"> and emits no .js file at all, so the glob
// matched nothing, `scriptText` was the empty string, and the AudioContext
// assertion below failed while reporting that the page had no synthesis in it.
// It would have gone on failing after the instrument was finished, and — worse
// — would have silently started passing the day the bundle grew past Astro's
// inlining threshold. A check that cannot see the code it is grepping is not a
// weak check, it is a misleading one. Read both places.
const scriptText = [
  ...shipped.filter((path) => path.endsWith(".js")).map((path) => readFileSync(path, "utf8")),
  ...html.flatMap((source) =>
    [...new JSDOM(source).window.document.querySelectorAll("script")].map(
      (tag) => tag.textContent ?? "",
    ),
  ),
].join("\n");

const home = new JSDOM(readFileSync(join(DIST, "index.html"), "utf8")).window.document;

describe("the sound is synthesised in the page, not played back", () => {
  it("builds a Web Audio graph", () => {
    expect(
      scriptText,
      "no AudioContext anywhere in the shipped script — the spec wants sound made live in the page by the player, and nothing here can make any.",
    ).toContain("AudioContext");
  });

  it("ships no <audio> element to play a recording through", () => {
    expect(
      home.querySelectorAll("audio").length,
      "an <audio> element plays a fixed recording — the instrument has to be synthesised live, not played back.",
    ).toBe(0);
  });

  it("ships no audio files for anything to play", () => {
    // Stronger than the <audio> check above, and the one that would actually
    // catch a regression: fetch() and AudioBufferSourceNode can play a sample
    // with no <audio> element in sight. If nothing in dist/ so much as names an
    // audio file, there is nothing to play back.
    const offenders = shipped.filter((path) => /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(path));
    expect(
      offenders,
      `dist/ ships audio files (${offenders.join(", ")}) — every sound must be synthesised at runtime.`,
    ).toEqual([]);

    expect(
      scriptText,
      "the shipped script references an audio file — every sound must be synthesised at runtime, not fetched.",
    ).not.toMatch(/\.(mp3|wav|ogg|m4a|flac|aac)\b/i);
  });
});

describe("playable with whatever is at hand", () => {
  const strings = [...home.querySelectorAll('[data-testid^="string-"]')];

  it("gives every string its own real button, so a keyboard can reach it", () => {
    expect(
      strings.length,
      "no string controls found — the guqin's strings must each be a focusable control, or the instrument is mouse-only.",
    ).toBeGreaterThan(0);

    for (const string of strings) {
      expect(
        string.tagName,
        `${string.getAttribute("data-testid")} is a <${string.tagName.toLowerCase()}> — a string has to be a <button> to be reachable by Tab and operable by Enter.`,
      ).toBe("BUTTON");

      expect(
        string.getAttribute("aria-label")?.trim(),
        `${string.getAttribute("data-testid")} has no aria-label — a screen reader would announce seven identical buttons.`,
      ).toBeTruthy();
    }
  });

  it("listens for the keyboard as well as the pointer", () => {
    expect(
      scriptText,
      "nothing in the shipped script listens for keydown — the spec asks for mouse, keyboard or touch, and this would be pointer-only.",
    ).toContain("keydown");

    expect(
      scriptText,
      "nothing listens for pointerdown — pointer events are what make one code path serve both mouse and touch.",
    ).toContain("pointerdown");
  });
});
