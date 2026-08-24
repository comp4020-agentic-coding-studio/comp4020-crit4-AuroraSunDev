import { STRING_KEYS } from "../data/strings";
import { chirp, isAmbienceActive, toggleAmbience, voiceLevel } from "../lib/ambience";
import { ensureAudio, now, resumeAudio } from "../lib/audio";
import { pluck } from "../lib/guqin";
import { appendEvent, asLoop, type NoteEvent } from "../lib/performance";
import { analyse, replyMotif } from "../lib/zhiyin";

// Wiring only: this file connects gestures to the synthesiser and moves the
// page between its two scenes. Everything it knows about how things look, it
// says by setting a data attribute or a custom property and letting CSS decide
// what that means.

const stage = document.querySelector<HTMLElement>('[data-testid="stage"]');
const strings = [...document.querySelectorAll<HTMLButtonElement>("[data-string]")];
const sceneButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-scene-to]")];
// The regions are SVG groups rather than HTML buttons, so that the drawn thing
// is the control and stays welded to the artwork at any aspect ratio.
const regions = [...document.querySelectorAll<SVGGElement>("[data-region]")];

const SCENES = ["landscape", "guqin"] as const;
type Scene = (typeof SCENES)[number];

if (stage && strings.length > 0) {
  const scenes = new Map<Scene, HTMLElement | null>(
    SCENES.map((name) => [name, document.querySelector<HTMLElement>(`[data-testid="scene-${name}"]`)]),
  );

  // Everything played this session, oldest first, capped at a phrase.
  let played: NoteEvent[] = [];
  let loopTimers: number[] = [];

  const zhiyin = document.querySelector<HTMLElement>('[data-testid="zhiyin"]');
  const zhiyinHan = document.querySelector<HTMLElement>('[data-testid="zhiyin-han"]');
  const zhiyinGloss = document.querySelector<HTMLElement>('[data-testid="zhiyin-gloss"]');
  const art = document.querySelector<SVGSVGElement>(".landscape-art");
  const landscape = document.querySelector<HTMLElement>(".landscape");

  // Text pinned to places in the painting rather than to places on the screen.
  //
  // The artwork is scaled to cover the viewport and cropped to fit, so a given
  // viewBox coordinate lands at a different screen position for every window
  // shape. Anything positioned in percentages slides off the thing it is
  // labelling as soon as the window changes proportion — which is exactly what
  // happens between the two viewports this gets marked at. Asking the SVG for
  // its own transform is the only way to stay welded to the drawing.
  const ANCHORS: { element: HTMLElement | null; x: number; y: number }[] = [
    { element: zhiyinHan, x: 79, y: 18 }, // the empty sky above the two of them
    { element: zhiyinGloss, x: 79, y: 84 }, // the slope below them
  ];

  function placeAnchors(): void {
    if (!art || !landscape) return;
    const matrix = art.getScreenCTM();
    if (!matrix) return;

    const frame = landscape.getBoundingClientRect();
    for (const anchor of ANCHORS) {
      if (!anchor.element) continue;
      const point = new DOMPoint(anchor.x, anchor.y).matrixTransform(matrix);
      anchor.element.style.left = `${point.x - frame.left}px`;
      anchor.element.style.top = `${point.y - frame.top}px`;
    }
  }

  // A resize event only fires when the *window* changes. The painting can
  // change size without that happening — the portrait rule swaps the frame to
  // a fixed aspect ratio, a scrollbar appears, the device rotates — and each
  // time it does, text pinned to the old transform is left pointing at nothing.
  // Watching the element itself catches every case, including the ones a
  // resize listener silently misses.
  if (landscape && "ResizeObserver" in window) {
    new ResizeObserver(placeAnchors).observe(landscape);
  } else {
    window.addEventListener("resize", placeAnchors);
  }
  placeAnchors();

  const keyToString = new Map<string, number>();
  for (const [index, keys] of STRING_KEYS.entries()) {
    for (const key of keys) keyToString.set(key, index);
  }

  // --- waking up ------------------------------------------------------------

  // The context has to be built inside a real gesture or it arrives suspended.
  // Capture phase and no preventDefault, so the gesture that wakes the page is
  // also the gesture that plays the first note — the spec asks the opening
  // screen to invite the first sound, and swallowing that first touch to "start
  // the audio" would make a liar of it.
  function wake(): void {
    ensureAudio();
    resumeAudio();
    stage!.dataset.phase = "alive";
  }

  document.addEventListener("pointerdown", wake, { capture: true, once: true });
  document.addEventListener("keydown", wake, { capture: true, once: true });

  // Safari suspends the context again whenever the tab loses focus, and comes
  // back silent. Cheap to re-check on every gesture; a no-op when running.
  document.addEventListener("pointerdown", resumeAudio, { capture: true });

  // --- scenes ---------------------------------------------------------------

  // Your own phrase, running quietly under the painting when you come back to
  // it. This is re-synthesised from the note events, not replayed from a
  // recording — the same reason there is no record button.
  function stopPhraseLoop(): void {
    for (const timer of loopTimers) clearTimeout(timer);
    loopTimers = [];
  }

  function startPhraseLoop(): void {
    stopPhraseLoop();
    const loop = asLoop(played);
    if (loop.length < 3) return;

    const span = loop[loop.length - 1].time + 2.2;
    const run = (): void => {
      for (const note of loop) {
        loopTimers.push(
          window.setTimeout(() => pluck(note.stringIndex, note.velocity * 0.38), note.time * 1000),
        );
      }
      loopTimers.push(window.setTimeout(run, span * 1000));
    };
    run();
  }

  function showScene(name: Scene): void {
    stage!.dataset.scene = name;

    if (name === "guqin") {
      // Playing over your own loop would be confusing, and the buffer is about
      // to change anyway.
      stopPhraseLoop();
      if (zhiyin) zhiyin.dataset.shown = "false";
    } else {
      startPhraseLoop();
    }

    // Hiding a scene with CSS still leaves its buttons in the tab order, which
    // is how a keyboard ends up plucking strings that are not on screen.
    for (const [sceneName, element] of scenes) {
      if (element) element.inert = sceneName !== name;
    }

    for (const button of sceneButtons) {
      button.setAttribute("aria-current", String(button.dataset.sceneTo === name));
    }
  }

  for (const button of sceneButtons) {
    button.addEventListener("click", () => {
      const target = button.dataset.sceneTo;
      if (target === "landscape" || target === "guqin") showScene(target);
    });
  }

  // --- the strings ----------------------------------------------------------

  function ring(button: HTMLButtonElement): void {
    // Restarting a CSS animation needs the class to actually leave the element
    // between frames, hence the forced reflow. This one survives reduced
    // motion: a string that moves because it was just plucked is feedback for
    // something the visitor did, not decoration playing at them.
    button.classList.remove("is-ringing");
    void button.offsetWidth;
    button.classList.add("is-ringing");
  }

  function play(button: HTMLButtonElement, velocity: number): void {
    const index = Number(button.dataset.string);
    if (!Number.isInteger(index)) return;
    pluck(index, velocity);
    ring(button);
    // Ziqi is not switched on by a button and does not need to be told to start
    // — he has been listening the whole time. Every pluck goes into the buffer
    // as it happens; clicking him asks what he made of it.
    played = appendEvent(played, { time: now(), stringIndex: index, velocity });
  }

  for (const button of strings) {
    button.addEventListener("pointerdown", (event) => {
      // Touch implicitly captures the pointer to the element it started on,
      // which would make a drag across the strings sound one note and then go
      // quiet. Handing the pointer back lets pointerenter fire on the
      // neighbours, which is the whole glissando.
      if (button.hasPointerCapture(event.pointerId)) {
        button.releasePointerCapture(event.pointerId);
      }

      // Where along the string you pluck changes how hard it speaks, the way it
      // does on the real instrument. It is also the cheapest expressive control
      // on offer: no extra UI, and two people never quite do it the same way.
      const rect = button.getBoundingClientRect();
      const across = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;
      play(button, 0.5 + Math.min(Math.max(across, 0), 1) * 0.45);
    });

    button.addEventListener("pointerenter", (event) => {
      if (event.buttons === 0) return;
      play(button, 0.62);
    });

    // A focused button already answers Enter and Space with a click; without
    // this the keyboard could reach the strings but not sound them.
    button.addEventListener("click", (event) => {
      if (event.detail > 0) return; // a real mouse click; pointerdown has it
      play(button, 0.7);
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    if (stage!.dataset.scene !== "guqin") return;

    const index = keyToString.get(event.key.toLowerCase());
    if (index === undefined) return;

    const button = strings[index];
    if (!button) return;

    event.preventDefault();
    play(button, 0.72);
  });

  // --- what moves -----------------------------------------------------------

  // This loop publishes four numbers and draws nothing. Everything visual is
  // CSS: the fall and the stream are dash offsets, the needles are a rotation,
  // and none of that belongs in here.
  //
  // Only what is currently sounding moves. Switching a voice off leaves its
  // number where it stopped rather than snapping it home, so the water stills
  // instead of rewinding.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const flow = { waterfall: 0, stream: 0, sway: 0 };
  let lastFrame = 0;
  let rafId: number | null = null;

  function frame(stamp: number): void {
    // Capped at both ends. A tab left in the background hands back an enormous
    // first delta and the water jumps a whole cycle on return — that is the
    // upper bound. The lower bound is less obvious and cost a debugging pass:
    // requestAnimationFrame reports the timestamp of the *start* of the frame,
    // which can predate the performance.now() this was seeded with, so the
    // very first delta comes back negative and the fall runs briefly upward.
    const elapsed = Math.min(Math.max(stamp - lastFrame, 0), 100) / 1000;
    lastFrame = stamp;

    if (isAmbienceActive("waterfall")) flow.waterfall += elapsed * 34;
    if (isAmbienceActive("stream")) flow.stream += elapsed * 9;

    // The needles bend on the same gust that is making the noise, rather than
    // on a private loop that merely looks like wind.
    const gust = voiceLevel("tree");
    flow.sway += elapsed * (0.7 + gust * 2.4);

    stage!.style.setProperty("--fall-flow", flow.waterfall.toFixed(2));
    stage!.style.setProperty("--stream-flow", flow.stream.toFixed(2));
    stage!.style.setProperty("--leaf-sway", (Math.sin(flow.sway) * gust).toFixed(4));

    if (isAmbienceActive("waterfall") || isAmbienceActive("stream") || gust > 0.02) {
      rafId = requestAnimationFrame(frame);
    } else {
      rafId = null;
    }
  }

  function startFlow(): void {
    // Ambient movement is decoration — nobody asked the waterfall to run — so
    // it is the part that goes when reduced motion is on. The string that moves
    // because it was just plucked is feedback, and that one stays.
    if (rafId !== null || reduceMotion.matches) return;
    lastFrame = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  reduceMotion.addEventListener("change", () => {
    if (reduceMotion.matches && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    } else {
      startFlow();
    }
  });

  // --- the landscape --------------------------------------------------------

  function activateRegion(region: SVGGElement): void {
    const id = region.dataset.region;

    if (id === "boya") {
      showScene("guqin");
      return;
    }

    if (id === "ziqi") {
      const reading = analyse(played);

      if (zhiyin && zhiyinHan && zhiyinGloss) {
        zhiyinHan.textContent = reading.line.han;
        zhiyinGloss.textContent = reading.line.gloss;
        // Re-anchor before showing: the window may have changed shape while the
        // reply was hidden, and a stale position would put the line in the sky
        // above nobody.
        placeAnchors();
        zhiyin.dataset.shown = "true";
      }

      // He answers in kind rather than repeating you: low and spaced for a
      // mountain, high and quick for water. Scheduled from the main thread
      // because these are a second apart, not milliseconds.
      for (const note of replyMotif(reading)) {
        window.setTimeout(() => pluck(note.stringIndex, note.velocity), note.at * 1000);
      }

      region.dataset.sounding = "true";
      window.setTimeout(() => delete region.dataset.sounding, 1800);
      return;
    }

    if (id === "bird") {
      chirp();
      // No latched state: the bird answers once and stops. Marking it as
      // sounding for the length of the call is the only way to see that the
      // click did anything.
      region.dataset.sounding = "true";
      window.setTimeout(() => delete region.dataset.sounding, 900);
      return;
    }

    if (id === "waterfall" || id === "stream" || id === "tree") {
      const on = toggleAmbience(id);
      // The ink deepens while a voice is running. There is no switch drawn
      // anywhere, so this is the only thing telling you what is currently
      // making noise.
      if (on) {
        region.dataset.sounding = "true";
        startFlow();
      } else {
        delete region.dataset.sounding;
      }
    }
  }

  for (const region of regions) {
    region.addEventListener("click", () => activateRegion(region));

    // role="button" makes a group announce correctly and tabindex makes it
    // focusable, but neither makes it answer the keyboard — that part is only
    // free on a real <button>, and this had to be an SVG group to stay pinned
    // to the drawing. So Enter and Space are wired by hand.
    region.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activateRegion(region);
    });
  }

  showScene("landscape");
}
