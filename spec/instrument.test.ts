import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Turns the checkable half of crit 4's spec ("An instrument") into tests.
// Everything else — is it expressive, can a stranger play it uninstructed,
// is there really no way to play it wrong — only a person can judge, and
// that happens live at the crit, not here.
const DIST = resolve("dist");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const scriptText = files(DIST)
  .filter((path) => path.endsWith(".js"))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

const home = new JSDOM(readFileSync(join(DIST, "index.html"), "utf8")).window.document;

describe("crit 4 spec: an instrument", () => {
  it("makes sound with the Web Audio API, live in the page", () => {
    expect(
      scriptText.includes("AudioContext"),
      "the spec asks for sound made live in the page by the player, not played back — construct an AudioContext",
    ).toBe(true);
  });

  it("doesn't fall back to a static <audio> element as the instrument", () => {
    expect(
      home.querySelectorAll("audio").length,
      "an <audio> element plays a fixed recording — the instrument has to be synthesised live, not played back",
    ).toBe(0);
  });
});
