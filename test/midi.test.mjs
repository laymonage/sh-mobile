import assert from 'node:assert/strict';
import { test } from 'node:test';
import { levelFor, SoundPlayer, soundLength } from '../web/audio.mjs';
import { instrumentFor, noiseFrequency } from '../web/engine/instruments.mjs';
import { loadGameData, readJar } from '../web/engine/jar.mjs';
import { parseMidi } from '../web/engine/midi.mjs';
import { readInput, recommended } from '../src/inputs.mjs';

const data = loadGameData(await readJar(readInput(recommended.sh1.gameData)));
const midi = (name) => parseMidi(data.entries.get(`sh/sfx/mid/${name}.mid`));
const round = (value) => Math.round(value * 100) / 100;

test('every MIDI file parses to its recorded notes and length', () => {
  const summary = Object.fromEntries(
    [...data.entries.keys()]
      .filter((name) => name.endsWith('.mid'))
      .map((name) => {
        const { notes, duration } = parseMidi(data.entries.get(name));
        return [name.split('/').pop().replace('.mid', ''), [notes.length, round(duration)]];
      }),
  );
  assert.deepEqual(summary, {
    sh_shot: [1, 0.45],
    lr: [18, 8],
    ls: [48, 0.91],
    lt: [1, 0.21],
    lu: [2, 0.21],
    lv: [9, 4],
    lw: [5, 2.73],
    sh_bgmusic: [4, 8],
    sh_monster_hurt: [23, 0.84],
    lx: [2, 0.3],
    ly: [2, 5.4],
    lz: [2, 0.6],
    m0: [3, 0.22],
  });
});

test("notes have a time, a length, a level and their channel's program", () => {
  const [shot] = midi('sh_shot').notes;
  assert.equal(shot.program, 127);
  assert.equal(shot.note, 58);
  assert.equal(shot.start, 0);
  assert.ok(shot.velocity > 0 && shot.velocity <= 1);
  for (const name of ['lr', 'ls', 'lv', 'sh_bgmusic', 'ly']) {
    for (const note of midi(name).notes) {
      assert.ok(note.start >= 0 && note.duration >= 0, name);
      assert.ok(note.start + note.duration <= midi(name).duration + 0.001, name);
      assert.ok(note.volume >= 0 && note.volume <= 1, name);
    }
  }
});

test('channels keep separate programs, and a program can change during a file', () => {
  const programs = (name) => new Set(midi(name).notes.map(({ program }) => program));
  assert.deepEqual(
    [...programs('lr')].sort((a, b) => a - b),
    [0, 94],
  );
  assert.deepEqual(
    [...programs('sh_monster_hurt')].sort((a, b) => a - b),
    [91, 121],
  );
  assert.ok(programs('ly').size >= 2);
});

test('running status and note-on with zero velocity are understood', () => {
  // Header, then a track: tempo, program, two notes using running status, and an end.
  const bytes = Uint8Array.of(
    0x4d,
    0x54,
    0x68,
    0x64,
    0,
    0,
    0,
    6,
    0,
    0,
    0,
    1,
    0,
    120,
    0x4d,
    0x54,
    0x72,
    0x6b,
    0,
    0,
    0,
    25,
    0,
    0xff,
    0x51,
    3,
    0x07,
    0xa1,
    0x20,
    0,
    0xc0,
    40,
    0,
    0x90,
    60,
    100,
    60,
    60,
    0,
    0,
    62,
    100,
    120,
    62,
    0,
    0,
    0xff,
    0x2f,
    0,
  );
  const { notes, duration } = parseMidi(bytes);
  assert.deepEqual(
    notes.map(({ note, program }) => [note, program]),
    [
      [60, 40],
      [62, 40],
    ],
  );
  assert.equal(notes[0].duration, 0.25);
  assert.equal(notes[1].start, 0.25);
  assert.equal(notes[1].duration, 0.5);
  assert.equal(duration, 0.75);
});

test('bad data is refused', () => {
  assert.throws(() => parseMidi(Uint8Array.of(1, 2, 3, 4, 0, 0, 0, 6, 0, 0, 0, 1, 0, 120)), /Not a MIDI file/);
});

test('every General MIDI program has a usable voice', () => {
  for (let program = 0; program < 128; program++) {
    const voice = instrumentFor(program);
    assert.ok(['tone', 'noise'].includes(voice.source), `program ${program}`);
    assert.ok(voice.attack > 0 && voice.decay > 0 && voice.release > 0, `program ${program}`);
    if (voice.source === 'tone') assert.ok(voice.wave, `program ${program}`);
    else assert.ok(voice.filter && voice.frequency, `program ${program}`);
  }
});

test('the door sound is a cluster of noise notes, swelling and fading', () => {
  const { notes, duration } = midi('ls');
  assert.equal(notes.length, 48);
  assert.ok(notes.every(({ program }) => program === 126));
  assert.equal(instrumentFor(126).source, 'noise');
  const pitches = notes.map(({ note }) => note);
  assert.deepEqual([Math.min(...pitches), Math.max(...pitches)], [29, 95]);
  const startingIn = (from, to) => notes.filter(({ start }) => start >= from && start < to).length;
  assert.ok(startingIn(0.25, 0.5) > startingIn(0, 0.25));
  assert.ok(startingIn(0.25, 0.5) > startingIn(0.5, duration));
});

test("noise voices follow the note, within the sample rate's limit", () => {
  assert.equal(noiseFrequency(1200, 60, 44100), 1200);
  assert.equal(noiseFrequency(1200, 72, 44100), 2400);
  assert.equal(noiseFrequency(1200, 48, 44100), 600);
  assert.ok(noiseFrequency(1200, 29, 44100) < 300);
  assert.equal(noiseFrequency(6000, 127, 44100), 44100 * 0.45);
});

test('drum voices have a low body beneath their noise', () => {
  for (const program of [116, 117]) {
    const { source, hold, body } = instrumentFor(program);
    assert.equal(source, 'noise');
    assert.equal(hold, false);
    assert.ok(body.ratio < 1 && body.drop < 1, `program ${program}`);
  }
});

test('sounds are scaled by their peak and their sustained loudness, within a limit', () => {
  // A short, sharp sound is limited by its peak.
  assert.ok(Math.abs(levelFor({ peak: 1, loudness: 0.1 }) - 0.25) < 1e-9);
  // A long, steady sound of the same peak comes out quieter.
  assert.ok(Math.abs(levelFor({ peak: 1, loudness: 0.6 }) - 0.1) < 1e-9);
  // A nearly silent sound is raised, but only so far.
  assert.equal(levelFor({ peak: 0.0001, loudness: 0.00005 }), 30);
  assert.equal(levelFor({ peak: 0, loudness: 0 }), 1);
});

test('a sound ends soon after its file does', () => {
  assert.equal(soundLength(midi('ls')), midi('ls').duration + 0.25);
  assert.equal(soundLength({ duration: 8 }), 8.25);
});

test('stopping fades the sound out rather than cutting it', () => {
  const player = new SoundPlayer({ dataDir: 'sh', entries: new Map() });
  const calls = [];
  const gain = {
    value: 0.8,
    cancelScheduledValues: (time) => calls.push(['cancel', time]),
    setValueAtTime: (value, time) => calls.push(['set', value, time]),
    linearRampToValueAtTime: (value, time) => calls.push(['ramp', value, time]),
  };
  const stopped = [];
  player.context = { currentTime: 2 };
  player.outputs = [{ gain }];
  player.playing = [
    { stop: (time) => stopped.push(time), onended: () => {} },
    {
      stop: () => {
        throw new Error('finished');
      },
    },
  ];
  player.stop();
  assert.deepEqual(calls, [
    ['cancel', 2],
    ['set', 0.8, 2],
    ['ramp', 0, 2.015],
  ]);
  assert.deepEqual(stopped, [2.015]);
  assert.deepEqual(player.playing, []);
  assert.deepEqual(player.outputs, []);
});

test('stopping before audio has started does nothing', () => {
  const player = new SoundPlayer({ dataDir: 'sh', entries: new Map() });
  player.stop();
  assert.deepEqual(player.playing, []);
});
