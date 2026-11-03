// Reads SoundFont 2 files, and works out which samples play for a note. It has no
// audio code, so it can be tested in Node. Generator numbers are from the SF2 spec.

const GEN = {
  START_OFFSET: 0,
  END_OFFSET: 1,
  LOOP_START_OFFSET: 2,
  LOOP_END_OFFSET: 3,
  START_COARSE: 4,
  FILTER_FC: 8,
  FILTER_Q: 9,
  END_COARSE: 12,
  MOD_LFO_TO_VOLUME: 13,
  PAN: 17,
  MOD_LFO_DELAY: 21,
  MOD_LFO_FREQUENCY: 22,
  DELAY_VOL: 33,
  ATTACK_VOL: 34,
  HOLD_VOL: 35,
  DECAY_VOL: 36,
  SUSTAIN_VOL: 37,
  RELEASE_VOL: 38,
  KEY_TO_HOLD: 39,
  KEY_TO_DECAY: 40,
  INSTRUMENT: 41,
  KEY_RANGE: 43,
  VEL_RANGE: 44,
  LOOP_START_COARSE: 45,
  ATTENUATION: 48,
  LOOP_END_COARSE: 50,
  COARSE_TUNE: 51,
  FINE_TUNE: 52,
  SAMPLE_ID: 53,
  SAMPLE_MODES: 54,
  SCALE_TUNING: 56,
  ROOT_KEY: 58,
};

// Generators the spec defaults to something other than zero.
const DEFAULTS = {
  [GEN.FILTER_FC]: 13500,
  [GEN.MOD_LFO_DELAY]: -12000,
  [GEN.DELAY_VOL]: -12000,
  [GEN.ATTACK_VOL]: -12000,
  [GEN.HOLD_VOL]: -12000,
  [GEN.DECAY_VOL]: -12000,
  [GEN.RELEASE_VOL]: -12000,
  [GEN.SCALE_TUNING]: 100,
  [GEN.ROOT_KEY]: -1,
};
const RANGE_GENS = new Set([GEN.KEY_RANGE, GEN.VEL_RANGE]);
const DRUM_BANK = 128;
const MIDDLE_C_HOLD_KEY = 60;
const FILTER_OFF_CENTS = 13500;
// Most players scale the file's attenuation by this, to match E-mu's hardware.
const ATTENUATION_SCALE = 0.4;

const LOOP_MODES = new Set([1, 3]);
const seconds = (timecents) => 2 ** (timecents / 1200);
const decibelsToGain = (centibels) => 10 ** (-centibels / 200);
const absoluteCentsToHz = (cents) => 8.176 * 2 ** (cents / 1200);
const SILENCE_DB = 100;
const SILENT_GAIN = 10 ** (-SILENCE_DB / 20);

function readText(bytes, start, length) {
  let end = start;
  while (end < start + length && bytes[end] !== 0) end++;
  return new TextDecoder('latin1').decode(bytes.subarray(start, end));
}

function readRecords(chunk, size, read) {
  if (!chunk || chunk.length % size !== 0) throw new Error('Damaged SoundFont');
  const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  return Array.from({ length: chunk.length / size }, (_, i) => read(view, i * size, chunk));
}

function readChunks(bytes, start, end, into) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = start;
  while (p + 8 <= end) {
    const id = readText(bytes, p, 4);
    const size = view.getUint32(p + 4, true);
    if (p + 8 + size > bytes.length) throw new Error('Damaged SoundFont');
    if (id === 'LIST') readChunks(bytes, p + 12, p + 8 + size, into);
    else into.set(id, bytes.subarray(p + 8, p + 8 + size));
    p += 8 + size + (size % 2);
  }
}

// Splits bags into zones of generators, and takes the optional global zone off the front.
function buildZones(bagStart, bagEnd, bags, generators, terminal) {
  const zones = [];
  for (let b = bagStart; b < bagEnd; b++) {
    const gens = new Map();
    for (let g = bags[b]; g < bags[b + 1]; g++) gens.set(generators[g].type, generators[g].amount);
    zones.push(gens);
  }
  const global = zones.length && !zones[0].has(terminal) ? zones.shift() : new Map();
  return { global, zones: zones.filter((zone) => zone.has(terminal)) };
}

const inRange = (zone, gen, value) => {
  const range = zone.get(gen);
  if (range === undefined) return true;
  return value >= (range & 0xff) && value <= range >>> 8;
};

export class SoundFont {
  constructor(bytes) {
    if (bytes.length < 12 || readText(bytes, 0, 4) !== 'RIFF' || readText(bytes, 8, 4) !== 'sfbk')
      throw new Error('Not a SoundFont');
    const chunks = new Map();
    readChunks(bytes, 12, bytes.length, chunks);

    this.info = {
      name: chunks.has('INAM') ? readText(chunks.get('INAM'), 0, chunks.get('INAM').length) : '',
      copyright: chunks.has('ICOP') ? readText(chunks.get('ICOP'), 0, chunks.get('ICOP').length) : '',
    };
    const smpl = chunks.get('smpl');
    if (!smpl) throw new Error('This SoundFont has no samples');
    this.samples = new Int16Array(smpl.length >> 1);
    new Uint8Array(this.samples.buffer).set(smpl.subarray(0, this.samples.length * 2));

    const u16 = (view, p) => view.getUint16(p, true);
    const generator = (view, p) => ({ type: view.getUint16(p, true), amount: view.getInt16(p + 2, true) & 0xffff });
    const presets = readRecords(chunks.get('phdr'), 38, (view, p, chunk) => ({
      name: readText(chunk, p, 20),
      program: view.getUint16(p + 20, true),
      bank: view.getUint16(p + 22, true),
      bag: view.getUint16(p + 24, true),
    }));
    const presetBags = readRecords(chunks.get('pbag'), 4, u16);
    const presetGens = readRecords(chunks.get('pgen'), 4, generator);
    const instruments = readRecords(chunks.get('inst'), 22, (view, p, chunk) => ({
      name: readText(chunk, p, 20),
      bag: view.getUint16(p + 20, true),
    }));
    const instrumentBags = readRecords(chunks.get('ibag'), 4, u16);
    const instrumentGens = readRecords(chunks.get('igen'), 4, generator);
    this.sampleHeaders = readRecords(chunks.get('shdr'), 46, (view, p, chunk) => ({
      name: readText(chunk, p, 20),
      start: view.getUint32(p + 20, true),
      end: view.getUint32(p + 24, true),
      loopStart: view.getUint32(p + 28, true),
      loopEnd: view.getUint32(p + 32, true),
      sampleRate: view.getUint32(p + 36, true),
      originalPitch: view.getUint8(p + 40),
      pitchCorrection: view.getInt8(p + 41),
    }));

    this.instruments = instruments.slice(0, -1).map((instrument, i) => ({
      name: instrument.name,
      ...buildZones(instrument.bag, instruments[i + 1].bag, instrumentBags, instrumentGens, GEN.SAMPLE_ID),
    }));
    this.presets = new Map();
    presets.slice(0, -1).forEach((preset, i) => {
      this.presets.set(`${preset.bank}:${preset.program}`, {
        name: preset.name,
        ...buildZones(preset.bag, presets[i + 1].bag, presetBags, presetGens, GEN.INSTRUMENT),
      });
    });
  }

  hasPreset(bank, program) {
    return this.presets.has(`${bank}:${program}`);
  }

  // The samples a note triggers, with everything needed to play them. Generators
  // layer as the spec says: an instrument's zone overrides its global zone, and the
  // preset's values then add on top.
  voicesFor({ program, note, velocity, drum = false }) {
    const preset = this.presets.get(drum ? `${DRUM_BANK}:0` : `0:${program}`);
    if (!preset) return [];
    const midiVelocity = Math.round(velocity * 127);
    const voices = [];
    for (const presetZone of preset.zones) {
      if (!inRange(presetZone, GEN.KEY_RANGE, note) || !inRange(presetZone, GEN.VEL_RANGE, midiVelocity)) continue;
      const instrument = this.instruments[presetZone.get(GEN.INSTRUMENT)];
      if (!instrument) continue;
      for (const zone of instrument.zones) {
        if (!inRange(zone, GEN.KEY_RANGE, note) || !inRange(zone, GEN.VEL_RANGE, midiVelocity)) continue;
        const voice = this.buildVoice(note, instrument.global, zone, preset.global, presetZone);
        if (voice) voices.push(voice);
      }
    }
    return voices;
  }

  buildVoice(note, instrumentGlobal, zone, presetGlobal, presetZone) {
    const signed = (value) => (value > 32767 ? value - 65536 : value);
    const get = (gen) => {
      const base = zone.get(gen) ?? instrumentGlobal.get(gen);
      const own = base === undefined ? (DEFAULTS[gen] ?? 0) : signed(base);
      if (RANGE_GENS.has(gen) || gen === GEN.SAMPLE_ID) return own;
      const added = presetZone.get(gen) ?? presetGlobal.get(gen);
      return own + (added === undefined ? 0 : signed(added));
    };
    const instrumentOnly = (gen) => {
      const value = zone.get(gen) ?? instrumentGlobal.get(gen);
      return value === undefined ? (DEFAULTS[gen] ?? 0) : signed(value);
    };

    const sample = this.sampleHeaders[zone.get(GEN.SAMPLE_ID)];
    if (!sample || sample.sampleRate <= 0) return null;
    const start = sample.start + get(GEN.START_OFFSET) + get(GEN.START_COARSE) * 32768;
    const end = sample.end + get(GEN.END_OFFSET) + get(GEN.END_COARSE) * 32768;
    if (end <= start || end > this.samples.length) return null;
    const loopStart = sample.loopStart + get(GEN.LOOP_START_OFFSET) + get(GEN.LOOP_START_COARSE) * 32768;
    const loopEnd = sample.loopEnd + get(GEN.LOOP_END_OFFSET) + get(GEN.LOOP_END_COARSE) * 32768;

    const rootSetting = instrumentOnly(GEN.ROOT_KEY);
    const root = rootSetting >= 0 ? rootSetting : sample.originalPitch;
    const keyOffset = MIDDLE_C_HOLD_KEY - note;
    const filterCents = get(GEN.FILTER_FC);

    return {
      start,
      end,
      sampleRate: sample.sampleRate,
      loop: LOOP_MODES.has(instrumentOnly(GEN.SAMPLE_MODES)) && loopEnd > loopStart,
      loopStart: Math.max(0, loopStart - start),
      loopEnd: Math.max(0, loopEnd - start),
      cents:
        (note - root) * get(GEN.SCALE_TUNING) +
        get(GEN.COARSE_TUNE) * 100 +
        get(GEN.FINE_TUNE) +
        sample.pitchCorrection,
      gain: decibelsToGain(get(GEN.ATTENUATION) * ATTENUATION_SCALE),
      pan: Math.max(-1, Math.min(1, get(GEN.PAN) / 500)),
      filterHz: filterCents >= FILTER_OFF_CENTS ? null : absoluteCentsToHz(filterCents),
      filterQ: get(GEN.FILTER_Q) / 10,
      delay: seconds(get(GEN.DELAY_VOL)),
      attack: seconds(get(GEN.ATTACK_VOL)),
      hold: seconds(get(GEN.HOLD_VOL) + get(GEN.KEY_TO_HOLD) * keyOffset),
      decay: seconds(get(GEN.DECAY_VOL) + get(GEN.KEY_TO_DECAY) * keyOffset),
      sustain: decibelsToGain(Math.max(0, get(GEN.SUSTAIN_VOL))),
      release: seconds(get(GEN.RELEASE_VOL)),
      tremolo:
        get(GEN.MOD_LFO_TO_VOLUME) === 0
          ? null
          : {
              hz: absoluteCentsToHz(get(GEN.MOD_LFO_FREQUENCY)),
              depth: 1 - decibelsToGain(Math.abs(get(GEN.MOD_LFO_TO_VOLUME))),
              delay: seconds(get(GEN.MOD_LFO_DELAY)),
            },
    };
  }

  // A sample range as floating point audio.
  sampleData(start, end) {
    const data = new Float32Array(end - start);
    for (let i = 0; i < data.length; i++) data[i] = this.samples[start + i] / 32768;
    return data;
  }
}

// The volume envelope for a note of a given length, as gain steps relative to the
// note's start. Decay and release fall at a steady rate in decibels, reaching 100 dB
// down after their full time. A note can end during its attack: some of this
// soundfont's instruments take seconds to swell, so short notes never reach full
// volume, and Silent Hill's door sound depends on that.
export function envelopeSteps(voice, noteLength) {
  const { delay, attack, hold, decay, sustain, release } = voice;
  const attackEnd = delay + attack;
  const decayStart = attackEnd + hold;
  const sustainDb = sustain > SILENT_GAIN ? -20 * Math.log10(sustain) : SILENCE_DB;
  const sustainAt = decayStart + decay * (sustainDb / SILENCE_DB);
  const steps = [{ time: 0, gain: 0, ramp: 'set' }];
  if (delay > 0) steps.push({ time: delay, gain: 0, ramp: 'set' });

  let level;
  if (noteLength <= delay) {
    return { steps, stopAt: noteLength };
  } else if (noteLength < attackEnd) {
    level = (noteLength - delay) / attack;
    steps.push({ time: noteLength, gain: level, ramp: 'linear' });
  } else {
    steps.push({ time: attackEnd, gain: 1, ramp: 'linear' });
    if (hold > 0) steps.push({ time: Math.min(decayStart, Math.max(noteLength, attackEnd)), gain: 1, ramp: 'set' });
    if (noteLength <= decayStart) {
      level = 1;
    } else if (noteLength < sustainAt) {
      level = 10 ** (-(((noteLength - decayStart) / decay) * SILENCE_DB) / 20);
      steps.push({ time: noteLength, gain: Math.max(level, SILENT_GAIN), ramp: 'exponential' });
    } else {
      level = Math.max(sustain, SILENT_GAIN);
      steps.push({ time: sustainAt, gain: level, ramp: 'exponential' });
      if (level > SILENT_GAIN) steps.push({ time: noteLength, gain: level, ramp: 'set' });
    }
  }

  const levelDb = -20 * Math.log10(Math.max(level, SILENT_GAIN));
  const stopAt = noteLength + release * Math.max(0, (SILENCE_DB - levelDb) / SILENCE_DB);
  steps.push({ time: stopAt, gain: SILENT_GAIN, ramp: 'exponential' });
  return { steps, stopAt };
}
