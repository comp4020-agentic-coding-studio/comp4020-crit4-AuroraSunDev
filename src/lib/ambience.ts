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

  // Barely there. The first version of this voice was broadband noise through a
  // bandpass, which is the *same object* as the waterfall with the filter moved
  // — and it sounded like it: a small waterfall, not a brook. A stream is
  // mostly not broadband. It is a great many separate little events, and the
  // wash between them should be almost inaudible.
  const bed = noiseSource(context);
  const bedBand = context.createBiquadFilter();
  bedBand.type = "bandpass";
  bedBand.frequency.value = 2400;
  bedBand.Q.value = 0.9;
  const bedLevel = context.createGain();
  bedLevel.gain.value = 0.13;
  bed.connect(bedBand);
  bedBand.connect(bedLevel);
  bedLevel.connect(gain);
  bed.start();

  const timers: number[] = [];

  // 潺潺 is this: bubbles, and a lot of them.
  //
  // A bubble in water is very nearly a sine tone that rises in pitch as it
  // collapses — the Minnaert resonance, where the frequency goes up as the
  // cavity shrinks. Filtered noise was the wrong model and sounded like it;
  // an oscillator is both simpler and correct, and it is what gives the voice
  // the tonal, trickling quality that broadband hiss cannot have. Small
  // bubbles ring high and briefly, big ones low and longer.
  const bubble = (): void => {
    const burst = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < burst; i++) {
      const at = context.currentTime + i * (0.012 + Math.random() * 0.05);
      const size = Math.random();
      const from = 360 + (1 - size) * 1500 + Math.random() * 260;
      const span = 0.03 + size * 0.07;

      const voice = context.createOscillator();
      voice.type = "sine";
      voice.frequency.setValueAtTime(from, at);
      voice.frequency.exponentialRampToValueAtTime(from * (1.35 + Math.random() * 1.15), at + span);

      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.1, at + 0.004);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + span);

      voice.connect(envelope);
      envelope.connect(gain);
      voice.start(at);
      voice.stop(at + span + 0.02);
    }
    timers.push(window.setTimeout(bubble, 55 + Math.random() * 250));
  };
  timers.push(window.setTimeout(bubble, 120));

  return { gain, level: 0.22, sources: [bed], timers };
}

function startPine(context: AudioContext): Running {
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(masterBus());

  // A thread of moving air under the leaves, so the grains below are not
  // isolated ticks in silence.
  const bed = noiseSource(context);
  const bedBand = context.createBiquadFilter();
  bedBand.type = "bandpass";
  bedBand.frequency.value = 2600;
  bedBand.Q.value = 0.7;
  const bedLevel = context.createGain();
  bedLevel.gain.value = 0.03;
  bed.connect(bedBand);
  bedBand.connect(bedLevel);
  bedLevel.connect(gain);
  bed.start();

  const timers: number[] = [];

  // A gust is not a volume envelope over a steady rustle. That was the first
  // version and it was too even — turning one continuous hiss up and down.
  //
  // What actually changes when the wind drops is the *rate*: a hard gust is
  // many needle-strikes crowding together, and as it dies they thin out and
  // slow down as well as getting quieter. So the rustle is granular — short
  // filtered bursts — and `strength` drives both how loud each grain is and
  // how long until the next one. The slowing is the part you hear.
  let strength = 0;

  const grain = (): void => {
    const at = context.currentTime;

    if (strength > 0.02) {
      const span = 0.03 + Math.random() * 0.06;
      const rustle = noiseSource(context);
      const band = context.createBiquadFilter();
      band.type = "bandpass";
      // Higher and thinner at the peak of a gust; duller as it settles.
      band.frequency.value = 2400 + strength * 2600 + Math.random() * 1800;
      band.Q.value = 1.3 + Math.random() * 2.2;

      const envelope = context.createGain();
      const peak = strength * (0.05 + Math.random() * 0.1);
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(peak, at + 0.006);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + span);

      rustle.connect(band);
      band.connect(envelope);
      envelope.connect(gain);
      rustle.start(at);
      rustle.stop(at + span + 0.02);
    }

    bedLevel.gain.setTargetAtTime(0.02 + strength * 0.08, at, 0.2);
    strength *= 0.988;

    // The interval grows as the gust dies. At full strength the grains crowd
    // to about thirty milliseconds apart; by the tail they are five or six a
    // second. Same texture, slowing down.
    const interval = 20 + (1 - strength) * 200 + Math.random() * 45;
    timers.push(window.setTimeout(grain, interval));
  };

  const gustArrives = (): void => {
    strength = Math.min(1, strength + 0.55 + Math.random() * 0.45);
    timers.push(window.setTimeout(gustArrives, 3400 + Math.random() * 5600));
  };

  timers.push(window.setTimeout(gustArrives, 250));
  grain();

  return { gain, level: 0.24, sources: [bed], timers };
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
