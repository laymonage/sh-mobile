import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readInput, recommended } from '../src/inputs.mjs';
import { Player, newPlaythroughGame } from '../src/playthrough.mjs';
import { loadGameData, readJar } from '../web/engine/jar.mjs';

const touchData = loadGameData(await readJar(readInput(recommended.sh2.gameData)));
const touchRoute = JSON.parse(readFileSync(new URL('../src/sh2-route.json', import.meta.url), 'utf8'));
// The Internet Archive's copy, which is the keypad version of the game.
const keypadData = loadGameData(await readJar(readInput('sh2-2015-a1')));
const keypadRoute = JSON.parse(readFileSync(new URL('../src/sh2-keypad-route.json', import.meta.url), 'utf8'));

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  };
}

// Plays the whole route from a new game. Nothing here sets the game's state: every step
// is the pointer, a click, a key or a stroke, as web/main.mjs passes them on.
function play({
  seed,
  keyboard = false,
  storage = null,
  betweenSteps = () => {},
  data = touchData,
  route = touchRoute,
} = {}) {
  const game = newPlaythroughGame(data, { seed, storage });
  const player = new Player(game, { keyboard });
  if (keyboard) game.click = () => assert.fail("A keyboard player can't click");
  const seen = { rooms: new Set(), speakers: new Set(), lowestHealth: Infinity, roomOrder: [] };
  const tick = game.tick.bind(game);
  game.tick = () => {
    tick();
    const room = game.currentRoomId;
    if (room) seen.rooms.add(room);
    if (room && seen.roomOrder.at(-1) !== room) seen.roomOrder.push(room);
    const speaker = game.menus.at(-1)?.speaker;
    if (speaker) seen.speakers.add(speaker);
    const health = game.getRaw('sys_health');
    if (health !== null) seen.lowestHealth = Math.min(seen.lowestHealth, Number(health));
  };
  let status = player.settle();
  route.forEach((step, index) => {
    assert.notEqual(status, 'end', `The game ended before step ${index}, ${step}`);
    player.perform(step);
    status = player.settle();
    assert.notEqual(status, 'stuck', `Stuck after step ${index}, ${step}, in room ${game.currentRoomId}`);
    if (status === 'idle' && betweenSteps(game, index)) status = player.settle();
  });
  return { game, status, seen };
}

test('the route plays from a new game to the ending, and back to the main menu', () => {
  const { game, status, seen } = play();
  assert.equal(status, 'end');
  assert.ok(game.mainMenu);
  assert.deepEqual([...game.unsupportedCommands], []);
  assert.deepEqual(seen.roomOrder.slice(-2), ['lightLastRoom', 'endGame']);
  for (const speaker of ['Lucas', 'Karen', 'Vincent']) assert.ok(seen.speakers.has(speaker), speaker);
});

test('the route goes through the puzzles, the second character and the last fight', () => {
  const { seen } = play();
  for (const room of [
    'startLucasPlot',
    'puzzleCorridor17KeyCode',
    'puzzleDrawing',
    'puzzleNamePlate',
    'control2',
    'startVincentPlot',
    'puzzleScalpel',
    'puzzleBodyIncision',
    'puzzleCorridor13KeyCode',
    'combatBoss',
  ]) {
    assert.ok(seen.rooms.has(room), room);
  }
});

test('the fights do real damage, and the route survives it', () => {
  const { seen } = play();
  assert.ok(seen.lowestHealth < 5);
  assert.ok(seen.lowestHealth > 0);
});

test('the route does not depend on how the dice fall', () => {
  for (const seed of [1, 2, 3, 4]) assert.equal(play({ seed }).status, 'end', `seed ${seed}`);
});

test('apart from the drawing, the route can be played with only the keyboard', () => {
  assert.equal(play({ keyboard: true }).status, 'end');
});

// Outside puzzle rooms, because entering one starts it over, and a load enters the room.
test('saving and loading along the way does not stop the game being finished', () => {
  let loads = 0;
  const { status } = play({
    storage: memoryStorage(),
    betweenSteps: (game, index) => {
      if (index % 10 !== 0 || !game.canSave() || /puzzle/i.test(game.currentRoomId)) return false;
      assert.ok(game.saveGame(false));
      assert.ok(game.loadGame());
      loads++;
      return true;
    },
  });
  assert.equal(status, 'end');
  assert.ok(loads > 5, `Only ${loads} of the steps could save`);
});

const keypad = { data: keypadData, route: keypadRoute };

test('the keypad version plays from a new game to the ending too, with none of the drawing', () => {
  const { game, status, seen } = play(keypad);
  assert.equal(status, 'end');
  assert.ok(game.mainMenu);
  assert.deepEqual([...game.unsupportedCommands], []);
  assert.deepEqual(seen.roomOrder.slice(-2), ['lightLastRoom', 'endGame']);
  assert.ok(!keypadRoute.some((step) => step.startsWith('stroke')));
  for (const room of [
    'puzzleDrawing',
    'puzzleScalpel',
    'puzzleCorridor17KeyCode',
    'puzzleCorridor13KeyCode',
    'combatBoss',
  ]) {
    assert.ok(seen.rooms.has(room), room);
  }
});

test('the keypad version does not depend on the dice, and can be played on the keyboard alone', () => {
  for (const seed of [1, 2, 3, 4]) assert.equal(play({ ...keypad, seed }).status, 'end', `seed ${seed}`);
  assert.equal(play({ ...keypad, keyboard: true }).status, 'end');
});

test('saving and loading in the keypad version does not stop it being finished', () => {
  const { status } = play({
    ...keypad,
    storage: memoryStorage(),
    betweenSteps: (game, index) => {
      if (index % 10 !== 0 || !game.canSave() || /puzzle/i.test(game.currentRoomId)) return false;
      assert.ok(game.saveGame(false));
      assert.ok(game.loadGame());
      return true;
    },
  });
  assert.equal(status, 'end');
});
