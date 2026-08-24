import { STRING_KEYS } from "../data/strings";
import { chirp, toggleAmbience } from "../lib/ambience";
import { ensureAudio, resumeAudio } from "../lib/audio";
import { pluck } from "../lib/guqin";

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

  function showScene(name: Scene): void {
    stage!.dataset.scene = name;

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

  // --- the landscape --------------------------------------------------------

  function activateRegion(region: SVGGElement): void {
    const id = region.dataset.region;

    if (id === "boya") {
      showScene("guqin");
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
      if (on) region.dataset.sounding = "true";
      else delete region.dataset.sounding;
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
