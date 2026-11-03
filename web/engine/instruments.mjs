// Rough stand-ins for General MIDI's instruments, for when the player hasn't chosen
// a soundfont. The original played these files on each phone's own synthesizer, so
// no single sound is the authentic one.
//
// A voice is an oscillator or filtered noise with an envelope. `hold: false` means
// the sound decays by itself, however long the note lasts. A noise voice's frequency
// is for middle C: real synthesizers play noise samples slower for low notes, so
// its filter follows the note. Silent Hill's door sound relies on this, with a
// cluster of noise notes across five octaves.
const tone = (wave, attack, decay, sustain, release, extra = {}) => ({
  source: 'tone',
  wave,
  attack,
  decay,
  sustain,
  release,
  hold: true,
  ...extra,
});
const hit = (wave, decay, extra = {}) => ({
  source: 'tone',
  wave,
  attack: 0.002,
  decay,
  sustain: 0,
  release: 0.01,
  hold: false,
  ...extra,
});
const noise = (filter, frequency, attack, decay, sustain, release, extra = {}) => ({
  source: 'noise',
  filter,
  frequency,
  attack,
  decay,
  sustain,
  release,
  hold: true,
  ...extra,
});
const drum = (frequency, decay, body) => ({
  source: 'noise',
  filter: 'lowpass',
  frequency,
  attack: 0.002,
  decay,
  sustain: 0,
  release: 0.01,
  hold: false,
  body,
});

// One voice for each of General MIDI's 16 families of eight programs.
const FAMILIES = [
  hit('triangle', 1.2), // Piano
  hit('sine', 1.4), // Chromatic percussion
  tone('square', 0.01, 0.05, 0.8, 0.05, { lowpass: 2500 }), // Organ
  hit('triangle', 0.7), // Guitar
  hit('sawtooth', 0.6, { lowpass: 900 }), // Bass
  tone('sawtooth', 0.08, 0.1, 0.8, 0.2, { lowpass: 3000, vibrato: { rate: 5, cents: 8 } }), // Strings
  tone('sawtooth', 0.15, 0.1, 0.8, 0.3, { lowpass: 2500 }), // Ensemble
  tone('sawtooth', 0.04, 0.1, 0.7, 0.1, { lowpass: 3500 }), // Brass
  tone('square', 0.03, 0.1, 0.7, 0.08, { lowpass: 2500 }), // Reed
  tone('sine', 0.05, 0.05, 0.8, 0.1), // Pipe
  tone('sawtooth', 0.01, 0.05, 0.7, 0.08, { lowpass: 4000 }), // Synth lead
  tone('sawtooth', 0.4, 0.3, 0.7, 0.6, { lowpass: 1800 }), // Synth pad
  tone('triangle', 0.2, 0.3, 0.6, 0.5, { lowpass: 3000, vibrato: { rate: 3, cents: 15 } }), // Synth effects
  hit('sawtooth', 0.8, { lowpass: 2500 }), // Ethnic
  hit('triangle', 0.3), // Percussive
  noise('lowpass', 2000, 0.05, 0.1, 0.6, 0.2), // Sound effects
];

// The programs Silent Hill actually uses, where its family's voice wouldn't do.
const PROGRAMS = {
  8: hit('sine', 0.9, { harmonic: 4, gain: 0.5 }), // Celesta
  19: tone('square', 0.02, 0.05, 0.85, 0.1, { lowpass: 1800 }), // Church organ
  44: tone('sawtooth', 0.1, 0.1, 0.8, 0.3, { lowpass: 2600, tremolo: { rate: 8, depth: 0.4 } }), // Tremolo strings
  91: tone('sawtooth', 0.2, 0.2, 0.6, 0.4, { lowpass: 2200 }), // Polysynth pad
  94: tone('sine', 0.5, 0.3, 0.7, 0.8, { vibrato: { rate: 4, cents: 10 } }), // Halo pad
  112: hit('sine', 1.0, { harmonic: 2.76 }), // Tinkle bell
  115: hit('triangle', 0.12, { harmonic: 2.5, gain: 1.5 }), // Woodblock
  116: drum(300, 0.5, { wave: 'sine', decay: 0.45, ratio: 0.35, drop: 0.6 }), // Taiko drum
  117: drum(900, 0.35, { wave: 'sine', decay: 0.35, ratio: 0.5, drop: 0.6 }), // Melodic tom
  121: noise('bandpass', 1400, 0.08, 0.1, 0.5, 0.15), // Breath noise
  122: noise('lowpass', 1200, 0.8, 0.5, 0.7, 1.0, { swell: { rate: 0.15, depth: 0.5 } }), // Seashore
  126: noise('lowpass', 900, 1.2, 0.5, 1, 1.5, { gain: 0.6 }), // Applause: slow, as in Nokia's soundfont, for the door sound
  127: {
    source: 'noise',
    filter: 'lowpass',
    frequency: 6000,
    attack: 0.001,
    decay: 0.45,
    sustain: 0,
    release: 0.01,
    hold: false,
    sweepTo: 300,
    gain: 4,
  }, // Gunshot
};

export function instrumentFor(program) {
  return PROGRAMS[program] ?? FAMILIES[program >> 3];
}

const MIDDLE_C = 60;

// Where a noise voice's filter sits for a note, kept below the sample rate's limit.
export function noiseFrequency(frequency, note, sampleRate) {
  return Math.min(frequency * 2 ** ((note - MIDDLE_C) / 12), sampleRate * 0.45);
}
