import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allInputs, buildsOf, input, readInput, recommended, sha256 } from '../src/inputs.mjs';

const copies = (game) => buildsOf(game).reduce((sum, build) => sum + 1 + (build.alsoAt?.length ?? 0), 0);

test('the manifest pins every distinct build, plus the decompiler', () => {
  assert.deepEqual(
    ['sh1', 'sh2', 'sh3'].map((game) => buildsOf(game).length),
    [130, 70, 86],
  );
  assert.deepEqual(['sh1', 'sh2', 'sh3'].map(copies), [133, 73, 90]);
  assert.equal(allInputs.length, 287);
});

test('every input matches its recorded hash and size', () => {
  for (const { id, sha256: expected, size } of allInputs) {
    const buffer = readInput(id);
    assert.equal(buffer.length, size, id);
    assert.equal(sha256(buffer), expected, id);
  }
});

test('every recommended build is pinned', () => {
  for (const picks of Object.values(recommended)) {
    for (const id of Object.values(picks)) assert.ok(input(id), id);
  }
});

test('the first SH1 and SH2 sets arrived as single zips', () => {
  const inZip = (game, name) => buildsOf(game).filter(({ path }) => path.endsWith(name)).length;
  assert.equal(inZip('sh1', 'v010(7).zip'), 25);
  assert.equal(inZip('sh2', 'EN_v100.zip'), 45);
});
