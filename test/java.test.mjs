import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countInstructions, decompile, hasJava } from '../src/java.mjs';
import { readInput, recommended } from '../src/inputs.mjs';
import { Zip } from '../src/zip.mjs';

const skip = hasJava() ? false : 'Java is not installed';

const METHOD = /(?:static|public|private|protected)[a-zA-Z ]* ([a-zA-Z_]+)\(/g;
const methodNames = (text) => new Set([...text.matchAll(METHOD)].map((match) => match[1]));

test('a7 decompiles with no reported failures', { skip }, () => {
  const { files, lines, failures, sources } = decompile(recommended.sh1.codeReference);
  assert.equal(files.length, 13);
  assert.equal(lines, 11440);
  assert.deepEqual(failures, []);

  const engine = ['Ext', 'ExtBase', 'M', 'MyCanvas'];
  const decompiled = methodNames(engine.map((name) => sources.get(`${name}.java`)).join('\n'));
  const zip = new Zip(readInput('sh1-2014-base'));
  const leftover = methodNames(
    engine.map((name) => zip.read(`daydream/ink/${name}.java~`).toString('latin1')).join('\n'),
  );

  const onlyDecompiled = [...decompiled].filter((name) => !leftover.has(name)).sort();
  assert.equal(decompiled.size, 213);
  assert.deepEqual(onlyDecompiled, ['tickBasedTime', 'tickBasedTimeReset', 'tickBasedTimeUpdate']);
});

test('a40 decompiles, with a smaller room size and vibration code', { skip }, () => {
  const { files, failures, sources } = decompile(recommended.sh1.secondCodeReference);
  assert.equal(files.length, 13);
  assert.deepEqual(failures, []);
  assert.match(sources.get('M.java'), /static int roomWidth = 176;/);
  assert.match(sources.get('M.java'), /public static void vibraToggle\(\)/);
  assert.match(sources.get('MyCanvas.java'), /static void setVibration\(int/);
});

test('v1.5.3 turns taps into key presses and shows a Tectoy logo', { skip }, () => {
  const { failures, sources } = decompile(recommended.sh1.touchReference);
  assert.deepEqual(failures, ['i.java']);
  assert.equal(sources.get('i.java').match(/\$VF: Couldn't be decompiled/g).length, 1);
  const all = [...sources.values()].join('\n');
  assert.match(all, /M\.lastTouchKey = M\.touch\.a\(var1, var2\);/);
  assert.match(all, /this\.keyPressed\(M\.lastTouchKey\);/);
  assert.match(all, /Image\.createImage\("\/gfx\/ttd\.png"\)/);
});

test('the Silent Hill Mobile 2 touch build drags to pan and to draw', { skip }, () => {
  const { failures, sources } = decompile(recommended.sh2.gameData);
  assert.deepEqual(failures, []);
  const all = [...sources.values()].join('\n');
  assert.match(all, /protected final void pointerDragged\(int var1, int var2\)/);
  assert.match(all, /var\d+\.equals\("puzzleBodyIncision"\)/);
  assert.match(all, /if \(var1 != 240\)/);
});

test('v1.7.0 decompiles with no reported failures', { skip }, () => {
  const { files, lines, failures } = decompile(recommended.sh3.gameData);
  assert.ok(files.includes('GameMidlet.java'));
  assert.equal(lines, 15575);
  assert.deepEqual(failures, []);
});

test('a7 has about 16% more bytecode than a6', { skip }, () => {
  assert.equal(countInstructions('sh1-2014-a6'), 24637);
  assert.equal(countInstructions('sh1-2014-a7'), 28542);
});
