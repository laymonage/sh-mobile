import { instrumentFor, noiseFrequency } from './engine/instruments.mjs';
import { parseMidi } from './engine/midi.mjs';
import { envelopeSteps } from './engine/soundfont.mjs';

const START_DELAY = 0.02;
const FADE_OUT = 0.015;
const NOISE_SECONDS = 2;
const LONGEST_RELEASE = 4;
const TARGET_PEAK = 0.25;
const TARGET_LOUDNESS = 0.06;
const MAX_LEVEL_BOOST = 30;
const MEASURE_RATE = 44100;
const AUDIBLE = 0.001;
const END_FADE = 0.25;
const NOTE_OFF_FADE = 0.1;
const VOLUME_PREFERENCE = 'silent-hill-mobile:volume';
const SOUND_PREFERENCE = 'silent-hill-mobile:sound';

const frequencyOf = (note) => 440 * 2 ** ((note - 69) / 12);

function noiseBuffer(context) {
  const buffer = context.createBuffer(1, context.sampleRate * NOISE_SECONDS, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  return buffer;
}

// The output chain, shared with offline renders so that they measure what's played.
// Sounds are measured and scaled well below full scale, so they can't clip.
export function createOutput(context) {
  const master = context.createGain();
  master.connect(context.destination);
  return master;
}

// These files weren't mixed for these instruments, and a slow instrument can stay
// almost silent during a short note. Only one sound plays at a time, so each can be
// scaled by itself, which keeps its shape. A sound's peak and its sustained loudness
// both have limits, because a long sound feels louder than a short one at equal peak.
export function levelFor({ peak, loudness }) {
  if (peak <= 0 || loudness <= 0) return 1;
  return Math.min(MAX_LEVEL_BOOST, TARGET_PEAK / peak, TARGET_LOUDNESS / loudness);
}

// The original gives each file to the phone's media player, which stops at the end
// of the file. So does this, with a short fade rather than letting notes ring on.
export function soundLength(midi) {
  return midi.duration + END_FADE;
}

export async function measureLoudness(midi, soundFont, buffers = new Map()) {
  const context = new OfflineAudioContext(1, Math.ceil(MEASURE_RATE * soundLength(midi)), MEASURE_RATE);
  scheduleMidi(context, context.destination, midi, 0, { soundFont, buffers });
  const samples = (await context.startRendering()).getChannelData(0);
  let peak = 0;
  let energy = 0;
  let audible = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = Math.abs(samples[i]);
    peak = Math.max(peak, value);
    if (value > AUDIBLE) {
      energy += value * value;
      audible++;
    }
  }
  return { peak, loudness: audible ? Math.sqrt(energy / audible) : 0 };
}

function sampleBuffer(context, soundFont, buffers, voice) {
  const key = `${voice.start}:${voice.end}:${voice.sampleRate}`;
  if (!buffers.has(key)) {
    const buffer = context.createBuffer(1, voice.end - voice.start, voice.sampleRate);
    buffer.copyToChannel(soundFont.sampleData(voice.start, voice.end), 0);
    buffers.set(key, buffer);
  }
  return buffers.get(key);
}

// One sample from a soundfont: pitched by playback rate, shaped by its envelope.
function scheduleSampleVoice(context, destination, soundFont, buffers, voice, note, bends, when, fileEnd, started) {
  const start = when + note.start;
  const source = context.createBufferSource();
  source.buffer = sampleBuffer(context, soundFont, buffers, voice);
  const rate = 2 ** (voice.cents / 1200);
  source.playbackRate.value = rate;
  if (voice.loop) {
    source.loop = true;
    source.loopStart = voice.loopStart / voice.sampleRate;
    source.loopEnd = voice.loopEnd / voice.sampleRate;
  }

  const { steps, stopAt: envelopeEnd } = envelopeSteps(
    { ...voice, release: Math.min(voice.release, LONGEST_RELEASE) },
    note.duration,
  );
  const level = voice.gain * note.velocity * note.velocity * note.volume;
  const gain = context.createGain();
  for (const { time, gain: value, ramp } of steps) {
    const at = start + time;
    if (ramp === 'set') gain.gain.setValueAtTime(value * level, at);
    else if (ramp === 'linear') gain.gain.linearRampToValueAtTime(value * level, at);
    else gain.gain.exponentialRampToValueAtTime(Math.max(value * level, 1e-6), at);
  }

  let input = gain;
  if (voice.filterHz) {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = Math.min(voice.filterHz, context.sampleRate * 0.45);
    filter.Q.value = voice.filterQ;
    filter.connect(input);
    input = filter;
  }
  source.connect(input);

  let output = gain;
  if (voice.pan && context.createStereoPanner) {
    const panner = context.createStereoPanner();
    panner.pan.value = voice.pan;
    gain.connect(panner);
    output = panner;
  }
  output.connect(destination);

  const naturalEnd = voice.loop ? Infinity : (voice.end - voice.start) / voice.sampleRate / rate;
  const stopAt = Math.max(start, Math.min(start + Math.min(envelopeEnd, naturalEnd), fileEnd));
  if (voice.tremolo) {
    const lfo = context.createOscillator();
    const depth = context.createGain();
    lfo.frequency.value = voice.tremolo.hz;
    depth.gain.value = (level * voice.tremolo.depth) / 2;
    lfo.connect(depth).connect(gain.gain);
    lfo.start(start + voice.tremolo.delay);
    lfo.stop(stopAt);
    started.push(lfo);
  }
  for (const bend of bends) {
    if (bend.channel === note.channel && bend.time >= note.start && bend.time <= note.start + note.duration) {
      source.detune.setValueAtTime(bend.semitones * 100, when + bend.time);
    }
  }
  source.start(start);
  source.stop(stopAt);
  started.push(source);
}

// Builds the audio nodes for one parsed MIDI file. It also works with an
// OfflineAudioContext, which lets a test render a file without playing it. A
// program the soundfont lacks falls back to the built-in voices.
export function scheduleMidi(
  context,
  destination,
  midi,
  when,
  { noise = noiseBuffer(context), soundFont = null, buffers = new Map() } = {},
) {
  const { notes, bends } = midi;
  const started = [];
  const fileEnd = when + soundLength(midi);
  const fileOutput = context.createGain();
  fileOutput.gain.setValueAtTime(1, when + midi.duration);
  fileOutput.gain.linearRampToValueAtTime(0, fileEnd);
  fileOutput.connect(destination);

  const envelope = (voice, start, end, level) => {
    const gain = context.createGain();
    const { attack, decay, sustain, release, hold } = voice;
    const peakAt = start + attack;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(level, peakAt);
    if (!hold) {
      // A struck sound decays by itself, and fades early if its note ends first,
      // so that fast notes don't ring on and pile up.
      const naturalEnd = peakAt + decay;
      const fadeFrom = Math.max(end, peakAt);
      if (fadeFrom + NOTE_OFF_FADE >= naturalEnd) {
        gain.gain.exponentialRampToValueAtTime(0.0001, naturalEnd);
        return { gain, stopAt: naturalEnd + release };
      }
      const reached = Math.max(level, 0.0001) * (0.0001 / Math.max(level, 0.0001)) ** ((fadeFrom - peakAt) / decay);
      gain.gain.exponentialRampToValueAtTime(Math.max(reached, 0.0001), fadeFrom);
      gain.gain.exponentialRampToValueAtTime(0.0001, fadeFrom + NOTE_OFF_FADE);
      return { gain, stopAt: fadeFrom + NOTE_OFF_FADE };
    }
    const sustained = Math.max(level * sustain, 0.0001);
    gain.gain.exponentialRampToValueAtTime(sustained, peakAt + decay);
    const releaseAt = Math.max(end, peakAt + decay);
    gain.gain.setValueAtTime(sustained, releaseAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, releaseAt + release);
    return { gain, stopAt: releaseAt + release };
  };

  const startNode = (node, start, stopAt) => {
    node.start(start);
    node.stop(Math.max(start, Math.min(stopAt, fileEnd)));
    started.push(node);
  };

  const addLfo = (rate, amount, target, start, stopAt) => {
    const lfo = context.createOscillator();
    const depth = context.createGain();
    lfo.frequency.value = rate;
    depth.gain.value = amount;
    lfo.connect(depth).connect(target);
    startNode(lfo, start, stopAt);
  };

  const addOscillator = (wave, frequency, start, stopAt, output) => {
    const oscillator = context.createOscillator();
    oscillator.type = wave;
    oscillator.frequency.value = frequency;
    oscillator.connect(output);
    startNode(oscillator, start, stopAt);
    return oscillator;
  };

  for (const note of notes) {
    const sampled = soundFont?.voicesFor(note) ?? [];
    if (sampled.length) {
      for (const voice of sampled)
        scheduleSampleVoice(context, fileOutput, soundFont, buffers, voice, note, bends, when, fileEnd, started);
      continue;
    }
    const voice = instrumentFor(note.program);
    const start = when + note.start;
    const { gain, stopAt } = envelope(
      voice,
      start,
      start + note.duration,
      note.velocity * note.volume * (voice.gain ?? 1),
    );
    let input = gain;

    if (voice.lowpass) {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = voice.lowpass;
      filter.connect(gain);
      input = filter;
    }
    gain.connect(fileOutput);

    if (voice.tremolo) addLfo(voice.tremolo.rate, voice.tremolo.depth, gain.gain, start, stopAt);
    if (voice.swell) addLfo(voice.swell.rate, voice.swell.depth, gain.gain, start, stopAt);

    if (voice.source === 'noise') {
      const source = context.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = voice.filter;
      if (voice.q) filter.Q.value = voice.q;
      filter.frequency.setValueAtTime(noiseFrequency(voice.frequency, note.note, context.sampleRate), start);
      if (voice.sweepTo)
        filter.frequency.exponentialRampToValueAtTime(
          noiseFrequency(voice.sweepTo, note.note, context.sampleRate),
          start + voice.decay,
        );
      source.connect(filter).connect(input);
      startNode(source, start, stopAt);
      if (voice.body) {
        const bodyGain = context.createGain();
        bodyGain.gain.setValueAtTime(1, start);
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, start + voice.body.decay);
        bodyGain.connect(gain);
        const pitch = frequencyOf(note.note) * voice.body.ratio;
        const body = addOscillator(voice.body.wave, pitch, start, stopAt, bodyGain);
        body.frequency.exponentialRampToValueAtTime(pitch * voice.body.drop, start + voice.body.decay);
      }
    } else {
      const oscillator = addOscillator(voice.wave, frequencyOf(note.note), start, stopAt, input);
      if (voice.vibrato) addLfo(voice.vibrato.rate, voice.vibrato.cents, oscillator.detune, start, stopAt);
      if (voice.harmonic) addOscillator('sine', frequencyOf(note.note) * voice.harmonic, start, stopAt, input);
      for (const bend of bends) {
        if (bend.channel === note.channel && bend.time >= note.start && bend.time <= note.start + note.duration) {
          oscillator.detune.setValueAtTime(bend.semitones * 100, when + bend.time);
        }
      }
    }
  }
  return started;
}

// Plays one sound at a time, as the original's single Player did. Browsers only
// allow audio after the player does something, so it starts on the first input.
export class SoundPlayer {
  constructor(data) {
    this.data = data;
    this.parsed = new Map();
    this.context = null;
    this.playing = [];
    this.generation = 0;
    this.pendingLoop = null;
    this.soundFont = null;
    this.buffers = new Map();
    this.levels = new Map();
    this.outputs = [];
    this.volume = 1;
    try {
      this.enabled = window.localStorage.getItem(SOUND_PREFERENCE) !== 'off';
      const saved = Number.parseFloat(window.localStorage.getItem(VOLUME_PREFERENCE));
      if (saved >= 0 && saved <= 1) this.volume = saved;
    } catch {
      this.enabled = true;
    }
  }

  unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = createOutput(this.context);
      this.master.gain.value = this.volume ** 2;
      this.noise = noiseBuffer(this.context);
    }
    if (this.context.state === 'suspended' && !document.hidden) this.context.resume();
    if (this.pendingLoop) {
      const { name, loops } = this.pendingLoop;
      this.pendingLoop = null;
      this.play(name, loops);
    }
  }

  // Sound stops with the game when the tab is hidden, and picks up where it left off.
  setHidden(hidden) {
    if (!this.context) return;
    if (hidden) this.context.suspend();
    else this.context.resume();
  }

  midi(name) {
    if (!this.parsed.has(name)) {
      const bytes = this.data.entries.get(`${this.data.dataDir}/sfx/mid/${name}.mid`);
      this.parsed.set(name, bytes ? parseMidi(bytes) : null);
    }
    return this.parsed.get(name);
  }

  play(name, loops = 1) {
    this.stop();
    if (!this.enabled) return;
    const midi = this.midi(name);
    if (!midi) return;
    if (!this.context) {
      if (loops !== 1) this.pendingLoop = { name, loops };
      return;
    }
    this.scheduleLoop(midi, loops, this.context.currentTime + START_DELAY, ++this.generation);
  }

  // A silent timer runs on the audio clock, so a suspended tab doesn't throw loops off.
  scheduleLoop(midi, loops, when, generation) {
    const output = this.context.createGain();
    output.gain.value = this.levels.get(midi) ?? 1;
    output.connect(this.master);
    this.outputs.push(output);
    this.playing.push(
      ...scheduleMidi(this.context, output, midi, when, {
        noise: this.noise,
        soundFont: this.soundFont,
        buffers: this.buffers,
      }),
    );
    if (loops === 1) return;
    const timer = this.context.createConstantSource();
    const silent = this.context.createGain();
    silent.gain.value = 0;
    timer.connect(silent).connect(this.master);
    timer.onended = () => {
      if (generation !== this.generation) return;
      this.playing = this.playing.filter((node) => node !== timer);
      this.scheduleLoop(midi, loops === -1 ? -1 : loops - 1, when + midi.duration, generation);
    };
    timer.start(when);
    timer.stop(when + midi.duration);
    this.playing.push(timer);
  }

  // A short fade, because cutting a sound off mid-wave makes an audible click.
  stop() {
    this.generation++;
    this.pendingLoop = null;
    const end = (this.context?.currentTime ?? 0) + FADE_OUT;
    for (const { gain } of this.outputs) {
      gain.cancelScheduledValues(this.context.currentTime);
      gain.setValueAtTime(gain.value, this.context.currentTime);
      gain.linearRampToValueAtTime(0, end);
    }
    for (const node of this.playing) {
      node.onended = null;
      try {
        node.stop(end);
      } catch {
        // It had already finished.
      }
    }
    this.playing = [];
    this.outputs = [];
  }

  async setSoundFont(soundFont) {
    this.stop();
    this.soundFont = soundFont;
    this.buffers = new Map();
    this.levels = new Map();

    const prefix = `${this.data.dataDir}/sfx/mid/`;
    const measureBuffers = new Map();
    for (const name of this.data.entries.keys()) {
      if (!name.startsWith(prefix) || !name.endsWith('.mid')) continue;
      const midi = this.midi(name.slice(prefix.length, -4));
      if (midi) this.levels.set(midi, levelFor(await measureLoudness(midi, soundFont, measureBuffers)));
    }
  }

  setVolume(volume) {
    this.volume = volume;
    if (this.master) this.master.gain.value = volume ** 2;
    try {
      window.localStorage.setItem(VOLUME_PREFERENCE, String(volume));
    } catch {
      // The choice just won't last beyond this visit.
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    try {
      window.localStorage.setItem(SOUND_PREFERENCE, enabled ? 'on' : 'off');
    } catch {
      // The choice just won't last beyond this visit.
    }
    if (!enabled) this.stop();
  }
}
