import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { readInput } from '../src/inputs.mjs';
import { Player, newPlaythroughGame } from '../src/playthrough.mjs';
import { loadGameData, readJar } from '../web/engine/jar.mjs';

// The first two games' copies on the Internet Archive, which the page offers to players
// without a JAR. They need nothing else, so CI downloads them with `npm run fetch-archive`
// and runs these along with Mobile 3's copy, sh3-2010-v1.0.20-a, in mobile3-route.test.mjs.
const route = (name) => JSON.parse(readFileSync(new URL(`../src/${name}.json`, import.meta.url), 'utf8'));
const COPIES = [
  { id: 'sh1-2014-base', route: route('sh1-route'), lastRoom: 'game_end' },
  { id: 'sh2-2015-a1', route: route('sh2-keypad-route'), lastRoom: 'endGame' },
];

function play(data, steps, { keyboard = false, seed } = {}) {
  const game = newPlaythroughGame(data, { seed });
  const player = new Player(game, { keyboard });
  if (keyboard) game.click = () => assert.fail("A keyboard player can't click");
  let lastRoom = null;
  const tick = game.tick.bind(game);
  game.tick = () => {
    tick();
    lastRoom = game.currentRoomId ?? lastRoom;
  };
  let status = player.settle();
  steps.forEach((step, index) => {
    assert.notEqual(status, 'end', `The game ended before step ${index}, ${step}`);
    player.perform(step);
    status = player.settle();
    assert.notEqual(status, 'stuck', `Stuck after step ${index}, ${step}, in room ${game.currentRoomId}`);
  });
  return { game, status, lastRoom };
}

for (const copy of COPIES) {
  const data = loadGameData(await readJar(readInput(copy.id)));

  test(`${copy.id} plays from a new game to the ending, and back to the main menu`, () => {
    const { game, status, lastRoom } = play(data, copy.route);
    assert.equal(status, 'end');
    assert.equal(lastRoom, copy.lastRoom);
    assert.ok(game.mainMenu);
    assert.deepEqual([...game.unsupportedCommands], []);
  });

  test(`${copy.id} can be finished with only the keyboard, however the dice fall`, () => {
    assert.equal(play(data, copy.route, { keyboard: true }).status, 'end');
    for (const seed of [1, 2, 3]) assert.equal(play(data, copy.route, { seed }).status, 'end', `seed ${seed}`);
  });
}
