import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseClass } from '../src/classfile.mjs';
import { analyzeInkData, isInk, loadInkData, parseLan, parseRoom } from '../src/ink.mjs';
import { buildsOf, readInput, recommended } from '../src/inputs.mjs';
import { Zip } from '../src/zip.mjs';

const CORRUPT = 'sh2-2008-konno-a3';
const inkIds = (game) =>
  buildsOf(game)
    .map(({ id }) => id)
    .filter((id) => id !== CORRUPT && isInk(new Zip(readInput(id))));
const a31Data = loadInkData(readInput(recommended.sh1.gameData));
const a31 = analyzeInkData(a31Data);
const touch = analyzeInkData(loadInkData(readInput(recommended.sh2.gameData)));
const a7 = analyzeInkData(loadInkData(readInput(recommended.sh2.keypadReference)));

function assertDecodes(ids, scriptCounts, roomCounts) {
  for (const id of ids) {
    const { scripts, rooms } = analyzeInkData(loadInkData(readInput(id)));
    assert.deepEqual(scripts.errors, [], id);
    assert.deepEqual(rooms.errors, [], id);
    assert.ok(scriptCounts.includes(scripts.parsed), id);
    assert.ok(roomCounts.includes(rooms.parsed), id);
    assert.deepEqual(rooms.missingScripts, [], id);
    assert.deepEqual(rooms.missingGfx, [], id);
  }
}

test('every Silent Hill INK build decodes completely, with no broken references', () => {
  const ids = inkIds('sh1');
  assert.equal(ids.length, 105);
  assertDecodes(ids, [531, 533], [112]);
});

test('every undamaged Silent Hill Mobile 2 INK build decodes completely, with no broken references', () => {
  const ids = inkIds('sh2');
  assert.equal(ids.length, 61);
  assertDecodes(ids, [366, 446], [39, 41]);
});

test('Silent Hill data matches the recorded totals', () => {
  assert.equal(a31.entryCount, 924);
  assert.equal(a31.scripts.codeBytes, 29170);
  assert.equal(a31.scripts.eventHandlers, 1845);
  assert.equal(Object.keys(a31.opcodes).length, 45);
  assert.equal(Object.keys(a31.events).length, 34);
  assert.equal(a31.rooms.objects, 1053);
  assert.deepEqual(a31.midi, { files: 13, bytes: 1915 });
});

test('Silent Hill rooms use three object types and three sprite transforms', () => {
  assert.deepEqual(a31.objectTypes, { 1: 451, 2: 574, 4: 28 });
  assert.deepEqual(a31.gfxTransforms, { 0: 361, 1: 87, 7: 3 });
});

test('room 0 places its known door hotspot', () => {
  const room = parseRoom(a31Data.entries.get('sh/rom/0.bin'));
  assert.equal(room.objects.length, 16);
  assert.deepEqual(room.objects[3], { type: 2, x: 215, y: 70, width: 30, height: 129, scriptId: '2r' });
});

test('Silent Hill English text has 714 strings', () => {
  const strings = parseLan(a31Data.entries.get('sh/lan/en.lan'));
  assert.equal(strings.length, 714);
  assert.equal(strings[707], 'Game Over');
});

test('command and event names come from a7', () => {
  const fields = new Map(
    parseClass(new Zip(readInput(recommended.sh1.codeReference)).read('s.class')).fields.map((field) => [
      field.name,
      field.constantValue,
    ]),
  );
  assert.equal(fields.get('COMMAND_INTEGER'), 5);
  assert.equal(fields.get('COMMAND_STRING'), 6);
  assert.equal(fields.get('COMMAND_END'), 2);
  assert.equal(fields.get('COMMAND_SAY'), 13);
  assert.equal(fields.get('COMMAND_COUNT'), 56);
  assert.equal(fields.get('EVENT_LOOKAT'), 9);
  assert.equal(fields.get('EVENT_COUNT'), 56);
});

test('Silent Hill Mobile 2 shares the script format and a subset of opcodes', () => {
  assert.equal(a7.scripts.parsed, 446);
  assert.equal(a7.scripts.codeBytes, 84183);
  assert.equal(touch.scripts.parsed, 366);
  assert.equal(touch.scripts.codeBytes, 63197);
  assert.deepEqual(Object.keys(touch.opcodes), Object.keys(a7.opcodes));
  assert.equal(Object.keys(a7.opcodes).length, 42);
  for (const op of Object.keys(a7.opcodes)) assert.ok(op in a31.opcodes, `opcode ${op}`);
});

test('Silent Hill Mobile 2 rooms need 16-bit zone sizes', () => {
  assert.equal(a7.rooms.parsed, 39);
  assert.equal(a7.rooms.objects, 1083);
  assert.equal(touch.rooms.parsed, 41);
  assert.equal(touch.rooms.objects, 1025);
  const room = loadInkData(readInput(recommended.sh2.gameData)).entries.get('a/rom/0.bin');
  assert.throws(() => parseRoom(room));
  assert.ok(parseRoom(room, { wideZones: true }).objects.length);
});

test('Silent Hill Mobile 2 uses all eight sprite transforms', () => {
  assert.equal(Object.keys(a7.gfxTransforms).length, 8);
  assert.equal(Object.keys(touch.gfxTransforms).length, 8);
});
