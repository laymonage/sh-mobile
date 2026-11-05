import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readInput, recommended } from '../src/inputs.mjs';
import { Player, newPlaythroughGame } from '../src/playthrough.mjs';
import { loadGameData, readJar } from '../web/engine/jar.mjs';

const data = loadGameData(await readJar(readInput(recommended.sh1.gameData)));
const route = JSON.parse(readFileSync(new URL('../src/sh1-route.json', import.meta.url), 'utf8'));
const allRooms = [...data.entries.keys()]
  .filter((name) => name.startsWith('sh/rom/'))
  .map((name) => name.slice('sh/rom/'.length, -'.bin'.length));

// `setup` is over within the first tick, and no script leads to `ben_backToLight`.
const ROOMS_NOT_PLAYED = ['setup', 'ben_backToLight'];

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  };
}

// Plays the whole route from a new game, noting what happens along the way. Nothing
// here sets the game's state: every step is the pointer, a click or a key.
function play({ seed, betweenSteps = () => {}, storage = null, build = data, keyboard = false, vibrate = null } = {}) {
  const game = newPlaythroughGame(build, { seed, storage });
  game.vibrator = vibrate;
  const player = new Player(game, { keyboard });
  if (keyboard) game.click = () => assert.fail("A keyboard player can't click");
  const seen = {
    rooms: new Set(),
    characters: [],
    roomOrder: [],
    bossKilled: false,
    hintsOff: false,
    solved: new Set(),
  };
  const tick = game.tick.bind(game);
  game.tick = () => {
    tick();
    if (game.currentRoomId && seen.roomOrder.at(-1) !== game.currentRoomId) seen.roomOrder.push(game.currentRoomId);
    if (game.currentRoomId) seen.rooms.add(game.currentRoomId);
    const character = game.getRaw('m5');
    if (character && seen.characters.at(-1) !== character) seen.characters.push(character);
    if (game.finalBossDead()) seen.bossKilled = true;
    if (game.getRaw('s_cursorHintDisable') === '1') seen.hintsOff = true;
    if (game.getRaw('var_safePuzzleSolved') === '1') seen.solved.add('safe');
  };
  let status = player.settle();
  route.forEach((step, index) => {
    assert.notEqual(status, 'end', `The game ended before step ${index}, ${step}`);
    player.perform(step);
    status = player.settle();
    assert.notEqual(status, 'stuck', `Stuck after step ${index}, ${step}, in room ${game.currentRoomId}`);
    if (status === 'idle') {
      const after = betweenSteps(game);
      if (after) status = player.settle();
    }
  });
  return { game, status, seen };
}

test('the whole game can be played from a new game to the ending and back to the main menu', () => {
  const { game, status, seen } = play();
  assert.equal(status, 'end');
  assert.equal(game.currentRoomId, 'game_end');
  assert.ok(game.mainMenu);
  assert.deepEqual([...game.unsupportedCommands], []);
  assert.deepEqual(seen.characters, ['Ben', 'Moon', 'Karen']);
  assert.ok(seen.bossKilled);
  assert.ok(seen.hintsOff);
  assert.ok(seen.solved.has('safe'));
  const inOrder = [
    'control',
    'intro',
    'ben_evil_intro',
    'safePuzzle',
    'ben_end',
    'moon_intro',
    'moon_evil_intro',
    'blackboardPuzzle',
    'moon_end',
    'karen_intro',
    'karen_evil_intro',
    '2d',
    'karen_end',
    'game_end',
  ];
  const positions = inOrder.map((room) => seen.roomOrder.indexOf(room));
  assert.deepEqual(
    positions.filter((position) => position === -1),
    [],
    `Missed ${inOrder.filter((_, index) => positions[index] === -1)}`,
  );
  assert.deepEqual(
    positions,
    [...positions].sort((left, right) => left - right),
  );
});

test('the whole game can also be played with only the keyboard', () => {
  const { game, status, seen } = play({ keyboard: true });
  assert.equal(status, 'end');
  assert.equal(game.currentRoomId, 'game_end');
  assert.ok(game.mainMenu);
  assert.deepEqual(seen.characters, ['Ben', 'Moon', 'Karen']);
  assert.ok(seen.bossKilled);
});

test('each shot along the route vibrates', () => {
  const buzzes = [];
  play({ vibrate: (ms) => buzzes.push(ms) });
  assert.ok(buzzes.filter((ms) => ms === 150).length > 20, `${buzzes.length} vibrations`);
});

test('the playthrough sees every room that a player can reach', () => {
  const { seen } = play();
  assert.deepEqual(
    allRooms.filter((room) => !seen.rooms.has(room)),
    ROOMS_NOT_PLAYED,
  );
});

test('the route does not depend on how the dice fall', () => {
  for (const seed of [1, 2, 3]) {
    const { game, status } = play({ seed });
    assert.equal(status, 'end');
    assert.equal(game.currentRoomId, 'game_end');
  }
});

test('the route also finishes the 2014 builds', async () => {
  for (const id of ['sh1-2014-base', 'sh1-2014-a7']) {
    const build = loadGameData(await readJar(readInput(id)));
    const { game, status } = play({ build });
    assert.equal(status, 'end', id);
    assert.equal(game.currentRoomId, 'game_end', id);
  }
});

// A puzzle resets when its room is entered, so saving partway through one would undo
// the route's clicks. That's the game's own script, and the original's too.
test('saving and loading at every save point along the way does not stop the game being finished', () => {
  let saves = 0;
  const { game, status } = play({
    storage: memoryStorage(),
    betweenSteps: (current) => {
      if (!current.canSave() || /puzzle/i.test(current.currentRoomId)) return false;
      const room = current.currentRoomId;
      const items = current.inventoryItems().map((item) => [item, current.inventorySize(item)]);
      assert.ok(current.saveGame(false));
      assert.ok(current.loadGame());
      assert.equal(current.getRaw('cur-curRoom'), room);
      assert.deepEqual(
        current.inventoryItems().map((item) => [item, current.inventorySize(item)]),
        items,
      );
      saves++;
      return true;
    },
  });
  assert.equal(status, 'end');
  assert.equal(game.currentRoomId, 'game_end');
  assert.ok(saves > 100, `Only ${saves} saves`);
});
