import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { INPUT_ROOT, readInput, recommended } from '../src/inputs.mjs';
import { loadGameData, readJar } from '../web/engine/jar.mjs';
import { parseMidi } from '../web/engine/midi.mjs';
import { envelopeSteps, SoundFont } from '../web/engine/soundfont.mjs';

const ascii = (text, length) => {
  const bytes = new Uint8Array(length);
  bytes.set(new TextEncoder().encode(text));
  return bytes;
};

function chunk(id, body) {
  const padded = body.length % 2 ? 1 : 0;
  const out = new Uint8Array(8 + body.length + padded);
  out.set(ascii(id, 4));
  new DataView(out.buffer).setUint32(4, body.length, true);
  out.set(body, 8);
  return out;
}

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let p = 0;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  return out;
};

const list = (type, ...chunks) => chunk('LIST', concat(ascii(type, 4), ...chunks));

const record = (size, write) => {
  const out = new Uint8Array(size);
  write(new DataView(out.buffer), out);
  return out;
};

const preset = (name, program, bank, bag) =>
  record(38, (view, out) => {
    out.set(ascii(name, 20));
    view.setUint16(20, program, true);
    view.setUint16(22, bank, true);
    view.setUint16(24, bag, true);
  });
const bag = (generator) => record(4, (view) => view.setUint16(0, generator, true));
const generator = (type, amount) =>
  record(4, (view) => {
    view.setUint16(0, type, true);
    view.setInt16(2, amount, true);
  });
const instrument = (name, firstBag) =>
  record(22, (view, out) => {
    out.set(ascii(name, 20));
    view.setUint16(20, firstBag, true);
  });
const sample = (name, start, end, loopStart, loopEnd, rate, pitch, correction) =>
  record(46, (view, out) => {
    out.set(ascii(name, 20));
    view.setUint32(20, start, true);
    view.setUint32(24, end, true);
    view.setUint32(28, loopStart, true);
    view.setUint32(32, loopEnd, true);
    view.setUint32(36, rate, true);
    view.setUint8(40, pitch);
    view.setInt8(41, correction);
  });

// A small font: program 5, with a global zone and two key ranges, and a drum kit.
function buildFont() {
  const samples = new Int16Array(100).map((_, i) => i * 100);
  return concat(
    ascii('RIFF', 4),
    new Uint8Array(4),
    ascii('sfbk', 4),
    list('INFO', chunk('INAM', ascii('Test Font', 10)), chunk('ICOP', ascii('Nobody', 8))),
    list('sdta', chunk('smpl', new Uint8Array(samples.buffer))),
    list(
      'pdta',
      chunk('phdr', concat(preset('Five', 5, 0, 0), preset('Kit', 0, 128, 1), preset('EOP', 0, 0, 2))),
      chunk('pbag', concat(bag(0), bag(2), bag(3))),
      chunk('pmod', new Uint8Array(10)),
      chunk('pgen', concat(generator(48, 100), generator(41, 0), generator(41, 1), generator(0, 0))),
      chunk('inst', concat(instrument('Tone', 0), instrument('Drum', 3), instrument('EOI', 4))),
      chunk('ibag', concat(bag(0), bag(2), bag(5), bag(7), bag(8))),
      chunk('imod', new Uint8Array(10)),
      chunk(
        'igen',
        concat(
          generator(34, -1200),
          generator(38, 0),
          generator(43, (59 << 8) | 0),
          generator(54, 1),
          generator(53, 0),
          generator(43, (127 << 8) | 60),
          generator(53, 1),
          generator(53, 0),
          generator(0, 0),
        ),
      ),
      chunk(
        'shdr',
        concat(
          sample('Low', 0, 40, 10, 30, 22050, 48, 5),
          sample('High', 40, 80, 50, 70, 44100, 72, -3),
          sample('EOS', 0, 0, 0, 0, 0, 0, 0),
        ),
      ),
    ),
  );
}

const font = new SoundFont(buildFont());

test('it reads names and finds presets by bank and program', () => {
  assert.deepEqual(font.info, { name: 'Test Font', copyright: 'Nobody' });
  assert.equal(font.hasPreset(0, 5), true);
  assert.equal(font.hasPreset(128, 0), true);
  assert.equal(font.hasPreset(0, 6), false);
  assert.deepEqual(font.voicesFor({ program: 6, note: 60, velocity: 1 }), []);
});

test('notes pick the zone for their key, and keep its loop and pitch', () => {
  const [low] = font.voicesFor({ program: 5, note: 50, velocity: 1 });
  assert.equal(low.start, 0);
  assert.equal(low.end, 40);
  assert.equal(low.loop, true);
  assert.deepEqual([low.loopStart, low.loopEnd], [10, 30]);
  assert.equal(low.sampleRate, 22050);
  assert.equal(low.cents, 205);

  const [high] = font.voicesFor({ program: 5, note: 60, velocity: 1 });
  assert.equal(high.start, 40);
  assert.equal(high.loop, false);
  assert.equal(high.cents, -1203);
});

test('generators layer: the global zone applies, and the preset adds to it', () => {
  const [voice] = font.voicesFor({ program: 5, note: 50, velocity: 1 });
  assert.ok(Math.abs(voice.attack - 0.5) < 1e-9);
  assert.equal(voice.release, 1);
  assert.ok(Math.abs(voice.gain - 10 ** (-(100 * 0.4) / 200)) < 1e-9);
});

test('drums use the drum bank', () => {
  const [drum] = font.voicesFor({ program: 0, note: 40, velocity: 1, drum: true });
  assert.equal(drum.start, 0);
});

test('samples convert to floating point', () => {
  const data = font.sampleData(1, 3);
  assert.ok(Math.abs(data[0] - 100 / 32768) < 1e-6);
  assert.ok(Math.abs(data[1] - 200 / 32768) < 1e-6);
});

test('other files are refused', () => {
  assert.throws(() => new SoundFont(ascii('not a soundfont at all', 22)), /Not a SoundFont/);
  assert.throws(() => new SoundFont(new Uint8Array(4)), /Not a SoundFont/);
  const truncated = buildFont().subarray(0, 60);
  assert.throws(() => new SoundFont(truncated));
});

const VOICE = { delay: 0, attack: 2.5, hold: 0, decay: 1, sustain: 0.5, release: 2 };

test('a note that ends during its attack releases from where it reached', () => {
  const { steps, stopAt } = envelopeSteps(VOICE, 0.5);
  assert.deepEqual(steps[1], { time: 0.5, gain: 0.2, ramp: 'linear' });
  const db = -20 * Math.log10(0.2);
  assert.ok(Math.abs(stopAt - (0.5 + 2 * ((100 - db) / 100))) < 1e-9);
  assert.equal(steps.at(-1).ramp, 'exponential');
  assert.equal(steps.at(-1).time, stopAt);
});

test('a long note reaches its sustain level and holds it', () => {
  const { steps } = envelopeSteps(VOICE, 5);
  assert.deepEqual(steps[1], { time: 2.5, gain: 1, ramp: 'linear' });
  const sustainDb = -20 * Math.log10(0.5);
  assert.ok(Math.abs(steps[2].time - (2.5 + sustainDb / 100)) < 1e-9);
  assert.equal(steps[2].gain, 0.5);
  assert.deepEqual(steps[3], { time: 5, gain: 0.5, ramp: 'set' });
});

test('envelope times always run forward', () => {
  for (const length of [0, 0.01, 0.2, 1, 3, 10]) {
    for (const voice of [
      VOICE,
      { ...VOICE, delay: 0.1, hold: 0.3, sustain: 0 },
      { delay: 0, attack: 0.001, hold: 0, decay: 0.3, sustain: 0, release: 0.05 },
    ]) {
      const { steps, stopAt } = envelopeSteps(voice, length);
      for (let i = 1; i < steps.length; i++) assert.ok(steps[i].time >= steps[i - 1].time, `length ${length}`);
      assert.ok(stopAt >= length);
    }
  }
});

// Runs only if the player has this soundfont in the ignored soundfonts folder.
const series40 = join(INPUT_ROOT, 'soundfonts', 'Series_40_5th_edition_FP1__GM_.sf2');
test('the Series 40 soundfont has the slow door instrument', {
  skip: existsSync(series40) ? false : 'soundfont not present',
}, () => {
  const real = new SoundFont(new Uint8Array(readFileSync(series40)));
  assert.equal(real.presets.size, 129);
  for (const program of [0, 8, 19, 44, 91, 94, 112, 115, 116, 117, 121, 122, 126, 127]) {
    assert.ok(real.voicesFor({ program, note: 60, velocity: 0.8 }).length > 0, `program ${program}`);
  }
  const [applause] = real.voicesFor({ program: 126, note: 60, velocity: 0.6 });
  assert.ok(applause.attack > 2);
  assert.ok(applause.release > 1);
  assert.equal(applause.loop, true);
});

const shippedFonts = ['DroidSymbioteBank-BV.sf2', 'DroidSymbioteBank-BSD.sf2'].map(
  (name) => new URL(`../web/soundfonts/${name}`, import.meta.url),
);

test('the shipped soundfonts are the files their notice describes', () => {
  const notice = readFileSync(new URL('../web/soundfonts/NOTICE.md', import.meta.url), 'utf8');
  for (const font of shippedFonts) {
    assert.ok(notice.includes(createHash('sha256').update(readFileSync(font)).digest('hex')), font.pathname);
  }
  assert.match(notice, /Creative Commons Attribution 4\.0/);
  assert.match(notice, /Copyright \(c\) 2009 Beatnik, Inc All rights reserved\./);
});

test('the shipped soundfonts have an instrument for every note both games play', async () => {
  const games = [recommended.sh1.gameData, recommended.sh2.gameData, recommended.sh2.keypadReference].map((id) => ({
    id,
    entries: null,
  }));
  for (const game of games) game.entries = loadGameData(await readJar(readInput(game.id))).entries;
  for (const font of shippedFonts) {
    const real = new SoundFont(new Uint8Array(readFileSync(font)));
    assert.equal(real.presets.size, 130);
    for (const { id, entries } of games) {
      let notes = 0;
      for (const [name, bytes] of entries) {
        if (!name.endsWith('.mid')) continue;
        for (const note of parseMidi(bytes).notes) {
          notes++;
          assert.ok(real.voicesFor(note).length > 0, `${font.pathname} ${id} ${name} program ${note.program}`);
        }
      }
      assert.ok(notes > 100, id);
    }
  }
});
