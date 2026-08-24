// The one AudioContext, and the bus everything runs through.
//
// A browser will not let a page make a sound until the visitor has done
// something, so the context cannot be built at import time — it has to be
// constructed from inside a real gesture handler. That constraint is not in the
// way of this prototype's design, it *is* the design: the spec asks that the
// opening screen invite the first sound, and the platform enforces the same
// thing. Nothing sounds until someone touches the painting.

let context: AudioContext | null = null;
let bus: GainNode | null = null;

/**
 * Get the AudioContext, building it on first call.
 *
 * Must first be called from inside a user-gesture handler (pointerdown,
 * keydown, click) or the context arrives suspended and stays that way.
 */
export function ensureAudio(): AudioContext {
  if (context && bus) return context;

  const created = new AudioContext();

  const master = created.createGain();
  master.gain.value = 0.75;

  // A limiter, not a compressor doing musical work. Four ambient voices and a
  // handful of overlapping plucks add up past full scale easily, and clipping
  // is the one audio fault that reads as a broken page rather than as a choice.
  // Slow release so it does not audibly pump on the waterfall.
  const limiter = created.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;

  master.connect(limiter);
  limiter.connect(created.destination);

  context = created;
  bus = master;
  return created;
}

/**
 * The node every voice connects to. Never connect to `destination` directly, or
 * that voice bypasses the limiter and is the one that clips.
 */
export function masterBus(): GainNode {
  ensureAudio();
  if (!bus) throw new Error("master bus missing after ensureAudio()");
  return bus;
}

/**
 * Nudge a suspended context back to life.
 *
 * Chrome suspends on first construction and Safari suspends again whenever the
 * tab loses focus, so this is worth calling on every gesture rather than only
 * on the first one. It is a no-op when already running.
 */
export function resumeAudio(): void {
  if (context && context.state !== "running") {
    void context.resume();
  }
}

/** Whether sound can currently be made. Used by the tests and the opening state. */
export function isAudioRunning(): boolean {
  return context?.state === "running";
}

/** Seconds on the audio clock, for scheduling. Zero before the context exists. */
export function now(): number {
  return context?.currentTime ?? 0;
}
