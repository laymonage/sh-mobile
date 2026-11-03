import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { analyzeGame, diffData, groupBy, setDifference, twinsOf } from '../src/builds.mjs';
import { parseLan, parseRoom } from '../src/ink.mjs';
import { readInput } from '../src/inputs.mjs';
import { Zip } from '../src/zip.mjs';

let builds;
let list;
let touch;
let a7;

const get = (name) => builds.get(`sh2-${name}`);
const short = (ids) => ids.map((id) => id.replace(/^sh2-/, '')).sort();
const entriesIn = (build, folder) => [...build.data.entries].filter(([name]) => name.includes(`/${folder}/`));
const rooms = (build) =>
  new Map(
    entriesIn(build, 'rom').map(([name, value]) => [
      name.match(/([^/]+)\.bin$/)[1],
      parseRoom(value, { wideZones: true }),
    ]),
  );

before(() => {
  builds = analyzeGame('sh2');
  list = [...builds.values()];
  touch = get('2015-base');
  a7 = get('2008-a7');
});

describe('build families', () => {
  test('62 builds use INK and 8 are a separate low-end version', () => {
    assert.equal(list.filter((build) => build.family === 'ink').length, 62);
    assert.equal(list.filter((build) => build.family === 'low-end').length, 8);
  });

  test('no build has readable game class names', () => {
    for (const build of list) {
      const own = build.classNames
        .filter((name) => !build.foreignClasses.includes(name))
        .map((name) => name.replace(/^sh\//, ''));
      assert.ok(
        own.every((name) => name.length === 1),
        build.id,
      );
    }
  });

  test('art comes in three sizes', () => {
    const sizes = groupBy(
      list.filter((build) => build.gfx),
      (build) => `${build.gfx.maxWidth}x${build.gfx.maxHeight}`,
    );
    assert.deepEqual(Object.fromEntries([...sizes].map(([size, ids]) => [size, ids.length])), {
      '180x143': 8,
      '262x220': 17,
      '310x270': 36,
    });
  });
});

describe('third-party changes', () => {
  test('32 builds look untouched, 15 of them full-resolution INK', () => {
    const untouched = list.filter((build) => build.looksUntouched);
    assert.equal(untouched.length, 32);
    assert.equal(untouched.filter((build) => build.family === 'ink').length, 27);
    assert.equal(untouched.filter((build) => build.family === 'ink' && build.gfx.maxWidth === 310).length, 15);
  });

  test('dedomil changed only the manifest of the three builds that can be checked', () => {
    const marked = list.filter((build) => build.siteMarkers.dedomil);
    assert.deepEqual(short(marked.map((build) => build.id)), ['2015-a', '2015-a1', '2015-base', 'en-v100']);
    for (const build of marked) assert.deepEqual(build.siteMarkers.dedomil, ['META-INF/MANIFEST.MF'], build.id);
    assert.ok(twinsOf(builds, 'sh2-2015-a').includes('sh2-2008-a26'));
    assert.ok(twinsOf(builds, 'sh2-2015-a1').includes('sh2-2008-a13'));
    assert.ok(twinsOf(builds, 'sh2-en-v100').includes('sh2-2008-a4'));
    assert.deepEqual(twinsOf(builds, 'sh2-2015-base'), []);
  });

  test("repacks put translations in other languages' slots", () => {
    const russian = list.filter((build) => build.textScripts?.en === 'cyrillic').map((build) => build.id);
    assert.deepEqual(short(russian), [
      '2008-a10',
      '2008-a11',
      '2008-a2',
      '2008-a35',
      '2008-base',
      '2008-konno-a2',
      '2008-konno-a6',
    ]);
    const chinese = list.filter((build) => build.textScripts?.fr === 'chinese').map((build) => build.id);
    assert.deepEqual(short(chinese), ['2008-a28', '2008-a5', '2008-a6', '2008-a8']);
  });

  test('one build is damaged', () => {
    assert.deepEqual(
      list.filter((build) => build.corruptEntries.length).map((build) => build.id),
      ['sh2-2008-konno-a3'],
    );
    assert.equal(get('2008-konno-a3').corruptEntries.length, 8);
  });

  test('other builds add third-party classes', () => {
    assert.ok(get('2008-a8').foreignClasses.some((name) => name.startsWith('com/kimjunco/')));
    assert.ok(get('2008-konno-base').foreignClasses.some((name) => name.startsWith('com/hellomoto/')));
  });
});

describe('a7 as the keypad reference', () => {
  test('it looks untouched, and 24 other builds share its data', () => {
    assert.ok(a7.looksUntouched);
    assert.equal(a7.gfx.maxWidth, 310);
    const same = list.filter((build) => build.dataGroup === a7.dataGroup);
    assert.equal(same.length, 25);
    assert.equal(same.filter((build) => build.looksUntouched).length, 12);
  });

  test('a8 changes only the French file', () => {
    assert.deepEqual(diffData(a7.data, get('2008-a8').data).changedNames, ['lan/fr.lan']);
  });
});

describe('the touch build', () => {
  test('it is the only copy, and only its manifest names dedomil', () => {
    assert.equal(touch.packagedAt, '2008-10-17 17:36');
    assert.match(touch.manifestDate, /^2015-/);
    assert.equal(touch.dateCount, 2);
  });

  test("it handles pointer input in the game's own classes", () => {
    assert.deepEqual(touch.gamePointerMethods, ['pointerDragged', 'pointerPressed', 'pointerReleased']);
    assert.deepEqual(
      list.filter((build) => build.gamePointerMethods.length).map((build) => build.id),
      ['sh2-2015-base'],
    );
    assert.ok(touch.strings.has('PLEASE SWITCH TO PORTRAIT MODE'));
    assert.ok(touch.strings.has('iconNavigation'));
  });

  test('it has the same rooms plus two, and 36 of the shared rooms keep their object counts', () => {
    const before = rooms(a7);
    const after = rooms(touch);
    assert.deepEqual([...after.keys()].filter((name) => !before.has(name)).sort(), [
      'lightSurgeryRoomXRay',
      'puzzleBodyIncision',
    ]);
    assert.deepEqual(
      [...before.keys()].filter((name) => !after.has(name)),
      [],
    );
    const changed = [...before.keys()]
      .filter((name) => before.get(name).objects.length !== after.get(name).objects.length)
      .sort();
    assert.deepEqual(changed, ['control', 'puzzleDrawing', 'puzzleScalpel']);
  });

  test('two rebuilt puzzles explain the 80 fewer scripts', () => {
    assert.equal(entriesIn(a7, 'scr').length, 446);
    assert.equal(entriesIn(touch, 'scr').length, 366);
    const before = rooms(a7);
    const after = rooms(touch);
    const delta = (name) => (after.get(name)?.scripts.length ?? 0) - (before.get(name)?.scripts.length ?? 0);
    assert.equal(delta('puzzleDrawing'), -45);
    assert.equal(delta('puzzleScalpel'), -39);
    assert.equal(delta('control') + delta('lightSurgeryRoomXRay') + delta('puzzleBodyIncision'), 4);
  });

  test('its help text describes icons rather than keys', () => {
    const english = (build) => new Set(parseLan(build.data.entries.get('lan/en.lan')));
    const onlyTouch = setDifference(english(touch), english(a7));
    const onlyA7 = setDifference(english(a7), english(touch));
    assert.ok(onlyTouch.includes('Press weapon icon to enter/exit weapon mode.'));
    assert.ok(onlyTouch.includes('Click on it to enter inventory.'));
    assert.ok(onlyA7.includes('Press Key 1 to enter/exit weapon mode.'));
    assert.equal(onlyTouch.length, 11);
    assert.equal(onlyA7.length, 9);
  });

  test('most art is shared, and every MIDI file differs', () => {
    const blobs = (build, folder) => new Set(entriesIn(build, folder).map(([, value]) => value.toString('latin1')));
    const shared = (folder) => [...blobs(a7, folder)].filter((value) => blobs(touch, folder).has(value)).length;
    assert.equal(blobs(a7, 'gfx').size, 381);
    assert.equal(shared('gfx'), 360);
    assert.equal(blobs(touch, 'gfx').size, 388);
    assert.equal(shared('sfx'), 0);
  });

  test('it stops reading the bitmap fonts', () => {
    assert.ok(a7.strings.has('.fdt'));
    assert.ok(!touch.strings.has('.fdt'));
    assert.ok(new Zip(readInput('sh2-2015-base')).has('font/e0.fdt'));
  });
});
