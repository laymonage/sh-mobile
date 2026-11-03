import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { analyzeGame, groupBy, setDifference } from '../src/builds.mjs';
import { parseClass } from '../src/classfile.mjs';
import { readInput } from '../src/inputs.mjs';
import { pngSizes } from '../src/mbf.mjs';
import { Zip } from '../src/zip.mjs';

const TOUCH = { 'p.mbf': '65dca10d05', 'b.mbf': 'aac4e017fc' };
const KEYPAD = { 'p.mbf': '3b29ba3532', 'b.mbf': '0462b727c5' };

let builds;
let list;

const get = (name) => builds.get(`sh3-${name}`);
const short = (ids) => ids.map((id) => id.replace(/^sh3-/, '')).sort();
const tier = (name) => get(name).tier?.replace(/^silenthillmobile3_(en_fr_de_it_es_pt_|de_en_es_fr_it_pt_|en_)/, '');

before(() => {
  builds = analyzeGame('sh3');
  list = [...builds.values()];
});

describe('device tiers', () => {
  test('tiers are named in boxal.inf', () => {
    const counts = Object.fromEntries(
      [...groupBy(list, (build) => build.tier?.replace('silenthillmobile3_', '') ?? 'none')].map(([name, ids]) => [
        name,
        ids.length,
      ]),
    );
    assert.deepEqual(counts, {
      de_en_es_fr_it_pt_k750: 14,
      none: 1,
      en_fr_de_it_es_pt_qvga_u_h: 24,
      en_fr_de_it_es_pt_qcif_u_h: 3,
      en_fr_de_it_es_pt_qvga_touch_u_h: 21,
      en_fr_de_it_es_pt_subqcif_500_m: 7,
      en_fr_de_it_es_pt_qvga_500_m: 3,
      en_subqcif_92_l: 13,
    });
  });

  test('the top tiers have the largest art and six languages', () => {
    for (const name of ['en-v170', 'en-v180']) {
      assert.deepEqual(get(name).gfx, { count: 213, maxWidth: 1693, maxHeight: 561 }, name);
      assert.equal(get(name).languages.length, 6, name);
    }
    assert.deepEqual(get('2010-v1.0.17-base').gfx, { count: 211, maxWidth: 1152, maxHeight: 387 });
    assert.deepEqual(get('2010-v1.1.0-a10').gfx, { count: 208, maxWidth: 862, maxHeight: 281 });
  });

  test('the low tier is cut down and English-only', () => {
    const low = get('2010-v1.2.0-base');
    assert.equal(tier('2010-v1.2.0-base'), 'subqcif_92_l');
    assert.deepEqual(low.gfx, { count: 56, maxWidth: 180, maxHeight: 256 });
    assert.deepEqual(low.languages, ['english']);
    assert.deepEqual(low.gamePointerMethods, []);
  });

  test('no build has readable game class names', () => {
    for (const build of list) {
      const own = build.classNames.filter((name) => !build.foreignClasses.includes(name) && name !== 'GameMidlet');
      assert.ok(
        own.every((name) => name.length <= 2),
        build.id,
      );
    }
  });

  test('the longer member names in v1.0.17 are mechanical', () => {
    const renamed = list.filter((build) => {
      const zip = new Zip(readInput(build.id));
      return zip.names
        .filter((name) => /^[a-z]{1,2}\.class$/.test(name))
        .some((name) => parseClass(zip.read(name)).fields.some((field) => field.name.startsWith('m_')));
    });
    assert.equal(renamed.length, 13);
    for (const build of renamed) assert.equal(build.manifest['MIDlet-Version'], '1.0.17', build.id);
  });

  test('some builds at each top tier have other art', () => {
    const atTier = (suffix) => list.filter((build) => build.tier?.endsWith(suffix));
    assert.equal(atTier('qvga_touch_u_h').filter((build) => build.gfx.count === 211).length, 3);
    assert.deepEqual(
      short(
        atTier('_qvga_u_h')
          .filter((build) => build.gfx.count === 212)
          .map((build) => build.id),
      ),
      ['2010-v1.0.24-a12', '2010-v1.0.24-a6'],
    );
    assert.equal(get('en-v160').gfx.count, 0);
  });
});

describe('v1.7.0 as the base', () => {
  test('it has the top touch archives, labelled for touch', () => {
    assert.deepEqual(get('en-v170').archiveHashes, TOUCH);
    assert.equal(tier('en-v170'), 'qvga_touch_u_h');
    assert.deepEqual(get('en-v170').gamePointerMethods, ['pointerDragged', 'pointerPressed', 'pointerReleased']);
  });

  test('its archives match builds with no site marker', () => {
    assert.ok(get('2010-v1.1.0-a21').markerFree);
    assert.deepEqual(get('2010-v1.1.0-a21').archiveHashes, TOUCH);
    assert.deepEqual(get('2010-v1.5.0-base').archiveHashes, TOUCH);
  });

  test('its only visible addition is the kriker file', () => {
    assert.deepEqual(Object.keys(get('en-v170').siteMarkers).sort(), ['kriker', 'supplied by']);
    assert.deepEqual(get('en-v170').foreignClasses, []);
    assert.deepEqual(get('en-v170').extraManifest, []);
    assert.equal(get('en-v170').manifestDate.slice(0, 7), '2010-03');
    assert.equal(get('en-v170').packagedAt.slice(0, 7), '2010-02');
  });

  test('its code strings match v1.1.0 and v1.5.0', () => {
    const strings = (name) => get(name).strings;
    for (const [left, right] of [
      ['2010-v1.1.0-a21', '2010-v1.5.0-base'],
      ['2010-v1.5.0-base', 'en-v170'],
    ]) {
      assert.deepEqual(setDifference(strings(left), strings(right)), [], `${left} ${right}`);
      assert.deepEqual(setDifference(strings(right), strings(left)), [], `${left} ${right}`);
    }
  });
});

describe('v1.8.0', () => {
  test('it is labelled touch but has the keypad archives', () => {
    assert.equal(tier('en-v180'), 'qvga_touch_u_h');
    assert.deepEqual(get('en-v180').archiveHashes, KEYPAD);
    assert.deepEqual(get('en-v1023').archiveHashes, KEYPAD);
    assert.equal(tier('en-v1023'), 'qvga_u_h');
    assert.ok(get('en-v1023').markerFree);
  });

  test('touch and keypad archives share 190 of 213 images', () => {
    const images = (name) => get(name).archives['p.mbf'].filter((entry) => pngSizes([entry]).length);
    const touch = images('en-v170');
    const keypad = images('en-v180');
    const inTouch = new Set(touch.map((entry) => entry.toString('latin1')));
    assert.deepEqual([touch.length, keypad.length], [213, 213]);
    assert.equal(keypad.filter((entry) => inTouch.has(entry.toString('latin1'))).length, 190);
    assert.deepEqual([get('en-v170').archives['b.mbf'].length, get('en-v180').archives['b.mbf'].length], [583, 577]);
  });

  test('it moves the MIDI files into its archives, and has smaller classes', () => {
    const zip = (name) => new Zip(readInput(`sh3-${name}`));
    const midis = (name) => zip(name).names.filter((entry) => entry.endsWith('.mid')).length;
    const classBytes = (name) =>
      zip(name)
        .names.filter((entry) => entry.endsWith('.class'))
        .reduce((sum, entry) => sum + zip(name).entries.get(entry).size, 0);
    assert.equal(midis('en-v170'), 10);
    assert.equal(midis('en-v180'), 0);
    const hasMidi = (name) =>
      Object.values(get(name).archives)
        .flat()
        .some((entry) => entry.toString('latin1', 0, 4) === 'MThd');
    assert.ok(hasMidi('en-v180'));
    assert.ok(!hasMidi('en-v170'));
    assert.equal(classBytes('en-v170'), 194487);
    assert.equal(classBytes('en-v180'), 188787);
  });
});

describe('third-party changes', () => {
  test('12 builds carry no site marker, and only one has a single timestamp', () => {
    assert.equal(list.filter((build) => build.markerFree).length, 12);
    assert.deepEqual(
      list.filter((build) => build.looksUntouched).map((build) => build.id),
      ['sh3-2010-v1.0.17-a7'],
    );
  });

  test('every v1.5 to v1.8 copy has the kriker file', () => {
    const late = list.filter((build) => /^1\.[5-8]/.test(build.manifest['MIDlet-Version']));
    assert.equal(late.length, 8);
    for (const build of late) assert.ok(build.siteMarkers.kriker, build.id);
  });

  test('the v0.0.x numbers are not pre-releases', () => {
    assert.ok(get('en-v0011').foreignClasses.includes('VservManager'));
    assert.match(get('en-v0011').packagedAt, /^2012-/);
    assert.match(get('en-v0011').manifest['MIDlet-Permissions'], /Connector\.socket/);
    assert.equal(get('en-v005').manifest['MIDlet-Version'], '0.0.5');
    assert.deepEqual(get('en-v005').archiveHashes, get('2010-v1.1.0-a14').archiveHashes);
    assert.match(get('en-v005').packagedAt, /^2010-01-18/);
  });

  test('some builds inject other code', () => {
    assert.ok(get('2010-v1.0.17-a4').foreignClasses.includes('ExtendTorpedoMidlet'));
    assert.ok(get('2010-v1.1.0-a7').foreignClasses.some((name) => name.startsWith('com/bsg/')));
    const chinese = list.filter((build) => build.foreignClasses.includes('PointFont'));
    assert.equal(chinese.length, 9);
    for (const build of chinese) {
      const text = new Zip(readInput(build.id)).read('TRAD_english.loc').toString('utf8');
      assert.ok(text.match(/[\u3400-\u9fff]/g).length > 1000, build.id);
    }
  });
});

describe('demo builds', () => {
  test('20 builds lack a valid key', () => {
    const groups = groupBy(list, (build) => build.demo);
    assert.equal(groups.get('demo').length, 20);
    assert.equal(groups.get('full').length, 66);
    assert.equal(get('en-v1017').demo, 'demo');
    assert.equal(get('en-v170').demo, 'full');
  });

  test('they share archives with builds that have the key', () => {
    assert.equal(get('2010-v1.0.17-a').demo, 'demo');
    assert.equal(get('2010-v1.1.0-a14').demo, 'full');
    assert.equal(get('2010-v1.0.17-a').archiveHashes['p.mbf'], get('2010-v1.1.0-a14').archiveHashes['p.mbf']);
    assert.equal(get('2012-v0.0.13-base').demo, 'demo');
    const lowTierFull = list.find((build) => build.demo === 'full' && build.tier === get('2012-v0.0.13-base').tier);
    assert.deepEqual(get('2012-v0.0.13-base').archiveHashes, lowTierFull.archiveHashes);
  });
});

describe('v1.6.0 asset names', () => {
  test('it stores assets as loose, named files', () => {
    const { looseImages } = get('en-v160');
    assert.equal(looseImages.length, 215);
    assert.ok(looseImages.includes('b_enigma1_telephone.png'));
    assert.equal(looseImages.filter((name) => /^[a-z]_obj/.test(name)).length, 97);
    assert.equal(looseImages.filter((name) => /^[a-z]_enigma/.test(name)).length, 22);
    assert.equal(tier('en-v160'), 'qvga_500_m');
  });
});
