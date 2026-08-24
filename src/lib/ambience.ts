import { ensureAudio, masterBus } from "./audio";

// Everything the landscape says, made out of filtered noise and one oscillator.
//
// Water, wind in needles and birdsong are all reachable from the same two
// ingredients, which is lucky, because the spec rules out the obvious way of
// getting them: not one sample is loaded here, and there is nothing in the
// build for a sample to hide in. Noise shaped by a filter is what a waterfall
// is, physically — a very large number of small uncorrelated impacts — so the
// synthesis is not an imitation of the sound so much as the same arithmetic.
//
// The difference between each of these and "radio static" is entirely in the
// movement. A fixed filter over fixed noise is a hiss. What makes it a river is
// that something about it is always slowly changing, and none of the changes
// line up with each other.

const FADE = 0.18;
const NOISE_SECONDS = 2;

let noise: AudioBuffer | null = null;

/** One white-noise buffer, shared by every voice that needs one. */
function noiseBuffer(context: AudioContext): AudioBuffer {
  if (noise) return noise;
  const length = Math.floor(NOISE_SECONDS * context.sampleRate);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1;
  noise = buffer;
  return buffer;
}

function noiseSource(context: AudioContext): AudioBufferSourceNode {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context);
  source.loop = true;
  return source;
}

export type AmbienceId = "waterfall" | "stream" | "tree";

interface Running {
  readonly gain: GainNode;
  readonly level: number;
  readonly sources: AudioScheduledSourceNode[];
  readonly timers: number[];
}

const running = new Map<AmbienceId, Running>();

function startWaterfall(context: AudioContext): Running {
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(masterBus());

  const source = noiseSource(context);
  const body = context.createBiquadFilter();
  body.type = "lowpass";
  body.frequency.value = 820;
  body.Q.value = 0.7;

  // The mass of water going past a point is never quite constant, and what you
  // hear of that is the brightness wandering rather than the volume. One very
  // slow sweep of the cutoff is the whole difference between a fall and a hiss.
  const drift = context.createOscillator();
  drift.frequency.value = 0.08;
  const drifted = context.createGain();
  drifted.gain.value = 140;
  drift.connect(drifted);
  drifted.connect(body.frequency);

  // A little spray off the top, so it is not all bottom end.
  const spray = noiseSource(context);
  const sprayBand = context.createBiquadFilter();
  sprayBand.type = "highpass";
  sprayBand.frequency.value = 3200;
  const sprayLevel = context.createGain();
  sprayLevel.gain.value = 0.1;

  source.connect(body);
  body.connect(gain);
  spray.connect(sprayBand);
  sprayBand.connect(sprayLevel);
  sprayLevel.connect(gain);

  source.start();
  spray.start();
  drift.start();

  return { gain, level: 0.26, sources: [source, spray, drift], timers: [] };
}

function startStream(context: AudioContext): Running {
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(masterBus());

  const source = noiseSource(context);
  const band = context.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1500;
  band.Q.value = 1.2;
  source.connect(band);
  band.connect(gain);
  source.start();

  const timers: number[] = [];

  // The bubbles are what stop this being a smaller waterfall. Each one is a
  // narrow resonance sweeping upward over about seventy milliseconds — which
  // is, more or less, literally what a bubble is: a cavity whose pitch rises as
  // it collapses.
  const bubble = (): void => {
    const at = context.currentTime;
    const source_ = noiseSource(context);
    const resonance = context.createBiquadFilter();
    resonance.type = "bandpass";
    resonance.Q.value = 9;
    const from = 480 + Math.random() * 320;
    resonance.frequency.setValueAtTime(from, at);
    resonance.frequency.exponentialRampToValueAtTime(from * 2.2, at + 0.07);

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(0.1 + Math.random() * 0.1, at + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);

    source_.connect(resonance);
    resonance.connect(envelope);
    envelope.connect(gain);
    source_.start(at);
    source_.stop(at + 0.1);

    timers.push(window.setTimeout(bubble, 240 + Math.random() * 620));
  };
  timers.push(window.setTimeout(bubble, 220));

  return { gain, level: 0.2, sources: [source], timers };
}

function startPine(context: AudioContext): Running {
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(masterBus());

  const source = noiseSource(context);
  const band = context.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 3800;
  band.Q.value = 0.8;

  // Needles do not rustle steadily; wind arrives in gusts and the sound is the
  // envelope, not the noise. This node is the gust.
  const gust = context.createGain();
  gust.gain.value = 0.12;

  source.connect(band);
  band.connect(gust);
  gust.connect(gain);
  source.start();

  const timers: number[] = [];
  const breathe = (): void => {
    const at = context.currentTime;
    const peak = 0.35 + Math.random() * 0.6;
    const rise = 0.7 + Math.random() * 1.3;
    const fall = 1.3 + Math.random() * 2;
    gust.gain.cancelScheduledValues(at);
    gust.gain.setValueAtTime(gust.gain.value, at);
    gust.gain.linearRampToValueAtTime(peak, at + rise);
    gust.gain.linearRampToValueAtTime(0.1, at + rise + fall);
    timers.push(window.setTimeout(breathe, (rise + fall) * 1000 + Math.random() * 800));
  };
  breathe();

  return { gain, level: 0.18, sources: [source], timers };
}

const BUILDERS: Record<AmbienceId, (context: AudioContext) => Running> = {
  waterfall: startWaterfall,
  stream: startStream,
  tree: startPine,
};

/** Switch one of the continuous voices on or off. Returns its new state. */
export function toggleAmbience(id: AmbienceId): boolean {
  const context = ensureAudio();
  const current = running.get(id);
  const at = context.currentTime;

  if (current) {
    // Ramp rather than cut. Gating noise hard produces a click, and on an
    // instrument this quiet the click is louder than the voice.
    current.gain.gain.cancelScheduledValues(at);
    current.gain.gain.setValueAtTime(current.gain.gain.value, at);
    current.gain.gain.linearRampToValueAtTime(0, at + FADE);
    for (const timer of current.timers) clearTimeout(timer);
    for (const source of current.sources) source.stop(at + FADE + 0.05);
    running.delete(id);
    return false;
  }

  const started = BUILDERS[id](context);
  started.gain.gain.setValueAtTime(0, at);
  started.gain.gain.linearRampToValueAtTime(started.level, at + FADE);
  running.set(id, started);
  return true;
}

export function isAmbienceActive(id: AmbienceId): boolean {
  return running.has(id);
}

/**
 * One burst of birdsong.
 *
 * A bird is a pitch moving fast — the note it lands on matters much less than
 * the sweep getting there — so this is an oscillator whose frequency is ramped
 * twice per syllable, with the number of syllables and every interval
 * randomised. It is a one-shot: the bird answers and stops, rather than
 * latching on like the water does.
 */
export function chirp(): void {
  const context = ensureAudio();
  const syllables = 2 + Math.floor(Math.random() * 3);
  let at = context.currentTime + 0.02;

  for (let i = 0; i < syllables; i++) {
    const span = 0.085 + Math.random() * 0.07;
    const base = 2050 + Math.random() * 750;

    const voice = context.createOscillator();
    voice.type = "sine";
    voice.frequency.setValueAtTime(base, at);
    voice.frequency.exponentialRampToValueAtTime(base * 1.55, at + span * 0.35);
    voice.frequency.exponentialRampToValueAtTime(base * 0.82, at + span);

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(0.15, at + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + span);

    voice.connect(envelope);
    envelope.connect(masterBus());
    voice.start(at);
    voice.stop(at + span + 0.02);

    at += span + 0.045 + Math.random() * 0.1;
  }
}
