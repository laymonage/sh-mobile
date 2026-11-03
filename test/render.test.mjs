import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadInkData } from '../src/ink.mjs';
import { readInput, recommended, sha256 } from '../src/inputs.mjs';
import { decodePng, encodeRgbaPng, pngInfo } from '../src/png.mjs';
import { renderRoom } from '../src/render.mjs';

const data = loadInkData(readInput(recommended.sh1.gameData));
const touch = loadInkData(readInput(recommended.sh2.gameData));

// These pin the output after it was checked by eye. They catch regressions and
// don't show that the engine would draw a room the same way.
const EXPECTED = {
  0: { width: 256, height: 256, sha256: '90e22521054645eba428f75fd03306b59ee99b9660b3bbfe7aeb7866ecb12d51' },
  '1a': { width: 256, height: 256, sha256: '1e2ab12d3f58c564314824d2c9c088e3267e4a731079d0b559effad309be79dd' },
  clockPuzzle: { width: 259, height: 256, sha256: 'edf5558f4281eff755359d97b9bd30e8a88ccd5b3eae4133972396eb0b73db2b' },
};

const EXPECTED_SH2 = {
  0: { width: 310, height: 270, sha256: 'bd21c002a73501c844fa443fc4100ad0cdca080c618c6ded86587cd34a9f4bef' },
  puzzleBodyIncision: {
    width: 310,
    height: 270,
    sha256: 'ceae38f0d6f268128bd120bd88b82ca2cfdeefd1c5a43d15d7c3a8466a4d6ada',
  },
};

for (const [room, expected] of Object.entries(EXPECTED)) {
  test(`room ${room} renders as recorded`, () => {
    const { width, height, rgba } = renderRoom(data, room);
    assert.deepEqual({ width, height, sha256: sha256(rgba) }, expected);
  });
}

for (const [room, expected] of Object.entries(EXPECTED_SH2)) {
  test(`Silent Hill Mobile 2 room ${room} renders as recorded`, () => {
    const { width, height, rgba } = renderRoom(touch, room);
    assert.deepEqual({ width, height, sha256: sha256(rgba) }, expected);
  });
}

test('every sprite image has a registration point', () => {
  for (const [name, value] of data.entries) {
    if (name.endsWith('.png')) assert.ok(pngInfo(value).hasRegPoint, name);
  }
});

test('every room renders without error', () => {
  for (const source of [data, touch]) {
    for (const name of source.entries.keys()) {
      const room = name.match(/\/rom\/(.+)\.bin$/)?.[1];
      if (room) renderRoom(source, room);
    }
  }
});

test('encoded renders are valid PNGs', () => {
  const { width, height, rgba } = renderRoom(data, '0');
  const info = pngInfo(encodeRgbaPng(width, height, rgba));
  assert.deepEqual([info.width, info.height, info.colorType], [256, 256, 6]);
});

test('images decode to the size in their header', () => {
  const image = decodePng(data.entries.get('sh/gfx/transform0/cursorIdle.png'));
  assert.deepEqual([image.width, image.height, image.rgba.length], [16, 21, 16 * 21 * 4]);
});

test('Silent Hill Mobile 2 also has RGB and RGBA images', () => {
  const rgb = decodePng(touch.entries.get('a/gfx/transform0/inv_arrowRight.png'));
  const rgba = decodePng(touch.entries.get('a/gfx/transform0/healthFill.png'));
  assert.equal(pngInfo(touch.entries.get('a/gfx/transform0/inv_arrowRight.png')).colorType, 2);
  assert.equal(pngInfo(touch.entries.get('a/gfx/transform0/healthFill.png')).colorType, 6);
  assert.equal(rgb.rgba.length, rgb.width * rgb.height * 4);
  assert.equal(rgb.rgba[3], 255);
  assert.equal(rgba.rgba.length, rgba.width * rgba.height * 4);
});
