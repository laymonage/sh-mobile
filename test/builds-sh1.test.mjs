import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, test } from 'node:test';
import { analyzeGame, diffData, diffStrings, groupBy, setDifference, twinsOf } from '../src/builds.mjs';
import { parseClass } from '../src/classfile.mjs';
import { buildsOf, INPUT_ROOT, readInput } from '../src/inputs.mjs';
import { Zip } from '../src/zip.mjs';

let builds;
let list;
let ink;
let firstSet;

const get = (name) => builds.get(`sh1-${name}`);
const old = (name) => get(`2014-${name}`);
const short = (ids) => ids.map((id) => id.replace(/^sh1-/, '')).sort();

before(() => {
  builds = analyzeGame('sh1');
  list = [...builds.values()];
  ink = list.filter((build) => build.family === 'ink');
  const ids = new Set(
    buildsOf('sh1')
      .filter(({ path }) => path.endsWith('v010(7).zip'))
      .map(({ id }) => id),
  );
  firstSet = list.filter((build) => ids.has(build.id));
});

describe('third-party changes', () => {
  test('27 builds name dedomil, only in the manifest and only since 2014', () => {
    const marked = list.filter((build) => build.siteMarkers.dedomil);
    assert.equal(marked.length, 27);
    for (const build of marked) {
      assert.deepEqual(build.siteMarkers.dedomil, ['META-INF/MANIFEST.MF'], build.id);
      assert.match(build.manifestDate, /^2014-/, build.id);
      assert.doesNotMatch(build.packagedAt, /^2014-/, build.id);
    }
    assert.equal(firstSet.filter((build) => build.siteMarkers.dedomil).length, 25);
  });

  test('dedomil builds have byte-identical copies without its lines', () => {
    const marked = list.filter((build) => build.siteMarkers.dedomil);
    const unmarked = marked.filter((build) =>
      twinsOf(builds, build.id).some((id) => !builds.get(id).siteMarkers.dedomil),
    );
    const untouched = marked.filter((build) => twinsOf(builds, build.id).some((id) => builds.get(id).looksUntouched));
    assert.equal(unmarked.length, 16);
    assert.equal(untouched.length, 13);
  });

  test('30 builds look untouched, 13 of them full-resolution INK', () => {
    const untouched = list.filter((build) => build.looksUntouched);
    assert.equal(untouched.length, 30);
    assert.equal(untouched.filter((build) => build.family === 'ink').length, 18);
    assert.equal(untouched.filter((build) => build.family === 'ink' && build.gfx.maxWidth === 256).length, 13);
  });

  test('repacks replace the English text', () => {
    const slots = groupBy(ink, (build) => build.textScripts.en);
    assert.equal(slots.get('cyrillic').length, 34);
    assert.equal(slots.get('chinese').length, 8);
    const vietnamese = ink.filter((build) => build.englishNonAscii > 1000).map((build) => build.id);
    assert.deepEqual(short(vietnamese), ['en-v010-4', 'en-v010-5']);
    assert.ok(get('2007-glu-base').manifest['ProvisionX-Highscore-gameCode']);
  });

  test('some builds add code or payment text', () => {
    assert.ok(get('2008-base').foreignClasses.some((name) => name.startsWith('com/joybits/')));
    assert.ok(get('2008-base').manifest['Payment-Text']);
    assert.ok(get('2007-a17').foreignClasses.some((name) => name.startsWith('com/hellomoto/')));
    assert.ok(get('en-v10-1').foreignClasses.some((name) => name.startsWith('com/alcatelonetouchx/')));
  });

  test('the Polish string is compiled into builds that look untouched', () => {
    for (const name of ['2007-a31', '2007-a40', '2014-base', '2014-a7', '2014-a23'])
      assert.ok(get(name).strings.has('Drugi ekran'), name);
  });
});

describe('build families', () => {
  test('105 builds use INK and 25 are a separate low-end version', () => {
    assert.equal(ink.length, 105);
    const lowEnd = list.filter((build) => build.family === 'low-end');
    assert.equal(lowEnd.length, 25);
    for (const build of lowEnd) assert.ok(build.classNames.includes('sh/M'), build.id);
    assert.equal(firstSet.filter((build) => build.family === 'low-end').length, 8);
  });

  test('art comes in three sizes', () => {
    const sizes = groupBy(ink, (build) => `${build.gfx.maxWidth}x${build.gfx.maxHeight}`);
    assert.deepEqual(Object.fromEntries([...sizes].map(([size, ids]) => [size, ids.length])), {
      '176x176': 16,
      '190x190': 1,
      '256x256': 88,
    });
  });

  test('two small-screen builds have 531 scripts rather than 533', () => {
    const fewer = ink.filter((build) => build.scripts === 531);
    assert.deepEqual(short(fewer.map((build) => build.id)), ['2007-a2', '2010-a9']);
    for (const build of fewer) assert.equal(build.gfx.maxWidth, 176, build.id);
  });

  test('every full-resolution build has the same scripts', () => {
    assert.equal(new Set(ink.filter((build) => build.gfx.maxWidth === 256).map((build) => build.scriptGroup)).size, 1);
  });

  test('builds in the first set with identical game data', () => {
    const groups = groupBy(
      firstSet.filter((build) => build.family === 'ink'),
      (build) => build.dataGroup,
    );
    assert.equal(groups.size, 11);
    const groupOf = (name) => short([...groups.values()].find((ids) => ids.includes(`sh1-2014-${name}`)));
    assert.deepEqual(groupOf('base'), ['2014-a1', '2014-a14', '2014-a3', '2014-base']);
    assert.deepEqual(groupOf('a6'), ['2014-a6', '2014-a7']);
    assert.deepEqual(groupOf('a23'), ['2014-a23']);
  });

  test('small-screen builds have smaller art, and some are English-only', () => {
    for (const name of ['a', 'a5', 'a8']) assert.equal(old(name).gfx.maxWidth, 176, name);
    for (const name of ['a', 'a8']) assert.deepEqual(old(name).languages, ['en'], name);
    assert.deepEqual(old('a23').languages, ['de', 'en', 'es', 'fr', 'it', 'pt']);
  });

  test('a4, a10 and a11 shrink only the puzzle assets', () => {
    for (const name of ['a4', 'a10', 'a11']) {
      const { changedNames } = diffData(old('base').data, old(name).data);
      assert.equal(changedNames.filter((entry) => entry.includes('/gfx/')).length, 11, name);
      assert.equal(changedNames.filter((entry) => entry.includes('/rom/')).length, 4, name);
      assert.equal(changedNames.filter((entry) => entry.includes('/scr/')).length, 0, name);
    }
  });

  test('two sets of MIDI files exist among full-resolution builds', () => {
    const groups = groupBy(
      ink.filter((build) => build.gfx.maxWidth === 256),
      (build) => build.midiGroup,
    );
    assert.equal(groups.size, 2);
  });
});

describe('a31 as the data base', () => {
  test('it looks untouched and has full-resolution art', () => {
    const build = get('2007-a31');
    assert.ok(build.looksUntouched);
    assert.equal(build.gfx.maxWidth, 256);
    assert.deepEqual(build.leftoverDevFiles, []);
    assert.deepEqual(build.manifest['MIDlet-Vendor'], 'Konami');
    assert.equal(build.packagedAt, '2007-09-12 08:25');
  });

  test('its data differs from a23 by one French string', () => {
    const a31 = get('2007-a31').data;
    const a23 = old('a23').data;
    const diff = diffData(a31, a23);
    assert.deepEqual(diff, { changedNames: ['sh/lan/fr.lan'], addedNames: [], removedNames: [] });
    const changes = diffStrings(a31.entries.get('sh/lan/fr.lan'), a23.entries.get('sh/lan/fr.lan'));
    assert.equal(changes.length, 1);
    assert.equal(changes[0].index, 399);
    assert.ok(changes[0].left.includes('tout petit'));
    assert.ok(changes[0].right.includes('toute petite'));
  });

  test("a23's language files also appear in a build that looks untouched", () => {
    assert.ok(get('2007-a26').looksUntouched);
    assert.equal(get('2007-a26').languageGroup, old('a23').languageGroup);
  });

  test('its data is corroborated by other untouched-looking builds', () => {
    const matches = list.filter((build) => build.looksUntouched && build.dataGroup === get('2007-a31').dataGroup);
    assert.deepEqual(short(matches.map((build) => build.id)), [
      '2007-a22',
      '2007-a25',
      '2007-a31',
      '2007-a34',
      '2007-a37',
    ]);
  });
});

describe('packaging dates do not order content', () => {
  test("a23's bytes also exist with an earlier date", () => {
    assert.deepEqual(short(twinsOf(builds, 'sh1-2014-a23')), ['2007-binpda-a2']);
    assert.equal(old('a23').packagedAt, '2007-09-21 12:07');
    assert.equal(get('2007-binpda-a2').packagedAt, '2007-08-31 17:29');
  });

  test('v1.0.0(a) is dated later than a23 but keeps typos a23 fixed', () => {
    const later = get('2014-v1.0.0-a');
    assert.equal(later.packagedAt, '2008-02-25 10:33');
    const changes = diffStrings(old('a23').data.entries.get('sh/lan/en.lan'), later.data.entries.get('sh/lan/en.lan'));
    assert.equal(changes.length, 11);
    assert.equal(changes.find(({ index }) => index === 707).right, 'game over');
    assert.equal(changes.find(({ index }) => index === 707).left, 'Game Over');
  });

  test("v1.0.0 has a23's data with slightly different code", () => {
    const v100 = get('2014-v1.0.0-base');
    assert.equal(v100.dataGroup, old('a23').dataGroup);
    assert.deepEqual(setDifference(old('a23').strings, v100.strings), ['VolumeControl', 'ly']);
    assert.deepEqual(setDifference(v100.strings, old('a23').strings), []);
  });
});

describe('code references', () => {
  test('a7 and a40 are the only builds with the real class names', () => {
    const named = list.filter((build) => build.classNames.includes('RoomObject')).map((build) => build.id);
    assert.deepEqual(short(named), ['2007-a40', '2014-a7']);
    for (const name of ['Script', 'ScriptThread', 'RoomObject', 'Menu', 'Resource', 'Ext', 'ExtBase']) {
      assert.ok(old('a7').classNames.includes(name), name);
    }
  });

  test('neither has debug info', () => {
    assert.equal(old('a7').debugInfo, false);
    assert.equal(get('2007-a40').debugInfo, false);
  });

  test('a40 looks untouched and shares 7 of 13 classes byte for byte with a7', () => {
    assert.ok(get('2007-a40').looksUntouched);
    const a7 = new Zip(readInput('sh1-2014-a7'));
    const a40 = new Zip(readInput('sh1-2007-a40'));
    const classes = a7.names.filter((name) => name.endsWith('.class'));
    const same = classes.filter((name) => a7.read(name).equals(a40.read(name))).sort();
    assert.equal(classes.length, 13);
    assert.deepEqual(same, [
      'Cheat.class',
      'LoadRequest.class',
      'Menu.class',
      'Script.class',
      'ScriptThread.class',
      's.class',
      'txt_consts.class',
    ]);
  });

  test('a40 has strings a7 lacks, and is built for 176-pixel art', () => {
    assert.equal(get('2007-a40').gfx.maxWidth, 176);
    for (const value of ['vibraRecordStore', 'gfx/header_logo.png', 'DemoMode:']) {
      assert.ok(get('2007-a40').strings.has(value), value);
      assert.ok(!old('a7').strings.has(value), value);
    }
  });

  test("a7's data differs from a23 by four MIDI files", () => {
    assert.deepEqual(diffData(old('a7').data, old('a23').data).changedNames.sort(), [
      'sh/sfx/mid/ls.mid',
      'sh/sfx/mid/lx.mid',
      'sh/sfx/mid/ly.mid',
      'sh/sfx/mid/lz.mid',
    ]);
  });

  test("a7's code differs from a6 and a23, so it is a reference rather than the shipped code", () => {
    assert.deepEqual(setDifference(old('a7').strings, old('a6').strings), ['   ', ' | ', ': ', 'ink.resourceinfo']);
    assert.deepEqual(setDifference(old('a6').strings, old('a7').strings), ['gfx/header_logo.png', 'vibraRecordStore']);
    assert.deepEqual(setDifference(old('a23').strings, old('a7').strings), [
      'VolumeControl',
      'gfx/bigScreenHUD_vert.png',
      'gfx/header_logo.png',
      'ly',
      'vibraRecordStore',
    ]);
  });

  test("nothing calls a7's Cheat class", () => {
    const zip = new Zip(readInput('sh1-2014-a7'));
    const callers = zip.names.filter(
      (name) => name.endsWith('.class') && name !== 'Cheat.class' && parseClass(zip.read(name)).utf8.has('Cheat'),
    );
    assert.deepEqual(callers, []);
  });
});

describe('leftover source', () => {
  const source = (id, name) => new Zip(readInput(id)).read(`daydream/ink/${name}.java~`).toString('latin1');

  test('a33 has newer backups than base, with more device flags', () => {
    assert.equal(get('2007-a33').packagedAt, '2007-09-10 17:28');
    assert.equal(old('base').packagedAt, '2007-08-30 15:36');
    for (const flag of ['K700_INTERUPTION', 'P990_SOFT_KEYS']) {
      assert.ok(source('sh1-2007-a33', 'MyCanvas').includes(flag), flag);
      assert.ok(!source('sh1-2014-base', 'MyCanvas').includes(flag), flag);
    }
    assert.ok(source('sh1-2007-a33', 'M').includes('SOUND_OTT'));
    assert.equal(source('sh1-2007-a33', 'Ext'), source('sh1-2014-base', 'Ext'));
  });

  test('the touch code in the backups sits behind a device flag', () => {
    for (const id of ['sh1-2007-a33', 'sh1-2014-base'])
      assert.ok(source(id, 'MyCanvas').includes('//#if TOUCHPAD'), id);
  });

  test("base's backups also ship in a build without dedomil's lines", () => {
    assert.deepEqual(short(twinsOf(builds, 'sh1-2014-base')), ['2007-binpda-a']);
  });

  test('a33 is a Russian repack at an unusual art size', () => {
    assert.equal(get('2007-a33').textScripts.en, 'cyrillic');
    assert.equal(get('2007-a33').gfx.maxWidth, 190);
  });
});

describe('pointer support', () => {
  test("only two builds compile it into the game's own classes", () => {
    assert.deepEqual(short(list.filter((build) => build.gamePointerMethods.length).map((build) => build.id)), [
      '2007-a33',
      'en-v153',
    ]);
    assert.deepEqual(get('en-v153').gamePointerMethods, ['pointerPressed', 'pointerReleased']);
  });

  test('other pointer code comes from third-party wrappers', () => {
    const wrapped = list.filter((build) => build.anyPointerMethods.length && !build.gamePointerMethods.length);
    assert.deepEqual(short(wrapped.map((build) => build.id)), ['2007-a17', '2010-a']);
    for (const build of wrapped)
      assert.ok(
        build.foreignClasses.some((name) => name.startsWith('com/hellomoto/')),
        build.id,
      );
  });

  test('v1.5.3 changes only language files, and rewords four English strings', () => {
    const a31 = get('2007-a31').data;
    const touch = get('en-v153');
    const { changedNames, addedNames, removedNames } = diffData(a31, touch.data);
    assert.ok([...changedNames, ...addedNames, ...removedNames].every((name) => name.includes('/lan/')));
    assert.deepEqual(touch.languages, ['en', 'es', 'pt']);
    const changes = diffStrings(a31.entries.get('sh/lan/en.lan'), touch.data.entries.get('sh/lan/en.lan'));
    assert.deepEqual(
      changes.map(({ index }) => index),
      [298, 378, 697, 699],
    );
    assert.equal(changes[0].right, 'Touch the gun image to equip/unequip gun');
  });

  test('v1.5.3 ships on-screen controls and a Tectoy logo, and no site marker', () => {
    const zip = new Zip(readInput('sh1-en-v153'));
    for (const name of ['gfx/up_arrow.png', 'gfx/ok_pressed.png', 'gfx/weapon.png', 'gfx/ttd.png'])
      assert.ok(zip.has(name), name);
    const build = get('en-v153');
    assert.deepEqual(build.siteMarkers, {});
    assert.equal(build.manifest['MIDlet-Version'], '1.5.3');
    assert.equal(build.dateCount, 1);
  });
});

test('a JAD in one zip describes a different game', () => {
  const { path, alsoAt } = buildsOf('sh1').find(({ id }) => id === 'sh1-2007-polick11-a3');
  assert.ok(path.endsWith('.zip'));
  const location = alsoAt.find((copy) => copy.includes('v010(8).zip'));
  const zip = new Zip(readFileSync(join(INPUT_ROOT, location.split('::')[0])));
  const jad = zip.names.find((name) => name.endsWith('.jad'));
  assert.match(zip.read(jad).toString('latin1'), /MIDlet-Name: Spin the XXX Bottle/);
});
