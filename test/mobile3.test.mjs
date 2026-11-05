import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildsOf, readInput, recommended } from '../src/inputs.mjs';
import { inspectJar, readJar } from '../web/engine/jar.mjs';
import { readStaticTables } from '../web/engine/mobile3/class-tables.mjs';
import { animationSize, loadMobile3, parseLanguage } from '../web/engine/mobile3/data.mjs';
import { createGame, FACING, LIFT_CELLS, LIFTS, STAIRS, STEP, VERB, VERB_WHEEL } from '../web/engine/mobile3/game.mjs';
import { actionsOf, conditionsHold, TRIGGER } from '../web/engine/mobile3/rules.mjs';

const files = await readJar(readInput(recommended.sh3.gameData));
const data = loadMobile3(files);
const newGame = () => {
  const game = createGame(data);
  game.textQueue.length = 0;
  return game;
};
const EXPECTED_UNUSED = [35];
const settle = (game) => {
  while (game.fade) game.tick();
};

test('reads the arrays a class builds, without running anything else', () => {
  const { name, fields } = readStaticTables(files.get('GameMidlet.class'));
  assert.equal(name, 'GameMidlet');
  assert.equal(fields.get('a:[[[S').length, 78);
  assert.equal(fields.get('a:[[[I').length, 27);
  assert.deepEqual(fields.get('a:[[[S')[0], [
    [4, 145],
    [2, 1],
    [4, 1],
  ]);
});

test('finds every table in the build it follows, with the expected sizes', () => {
  const { tables } = data;
  assert.equal(tables.rules.length, 78);
  assert.equal(tables.ruleCounts.length, 78);
  assert.equal(tables.objectNames.length, 145);
  assert.equal(tables.roomObjects.length, 26);
  assert.equal(tables.roomLayers.length, 26);
  assert.equal(tables.corridorDoors.length, 31);
  assert.equal(tables.chapterStates.length, 33);
  assert.equal(tables.dialogues.length, 27);
});

test('reads all six languages, with every line each game uses', () => {
  assert.deepEqual(
    data.languages.map(({ name }) => name),
    ['English', 'Français', 'Deutsch', 'Italiano', 'Español', 'Português'],
  );
  for (const language of data.languages) assert.equal(data.text(language).length, 620);
  assert.equal(data.text(data.languages[0])[69], 'The door is locked.');
  assert.equal(parseLanguage(files.get('TRAD_english.loc')).length, 620);
});

test('offers its sound under the names the sound player looks up', () => {
  assert.equal(data.entries.size, 10);
  assert.ok(data.entries.has('sh3/sfx/mid/music.mid'));
});

test('every rule uses exactly the arguments its counts say', () => {
  const { rules, ruleCounts } = data.tables;
  const state = {
    objectValue: new Array(145).fill(0),
    objectHidden: new Array(145).fill(0),
    chapter: 0,
    world: 0,
    room: -1,
    hasItem: () => false,
    ruleFired: new Array(78).fill(false),
    roomCleared: new Array(26).fill(false),
    monstersKilled: () => 0,
  };
  const unused = [];
  rules.forEach((rule, i) => {
    assert.equal(actionsOf(rule, ruleCounts[i][2]).length, ruleCounts[i][2], `rule ${i}'s actions`);
    assert.equal(typeof conditionsHold(rule, ruleCounts[i][1], state), 'boolean');
    const used = actionsOf(rule, ruleCounts[i][2]).reduce((sum, action) => sum + action.length, 0);
    if (used !== rule[2].length) unused.push(i);
  });
  // These list more actions than their counts run, so the original skips the last ones.
  assert.deepEqual(unused, EXPECTED_UNUSED);
});

function assertDrawable({ sheet, animation }, label) {
  const bytes = data.resource(data.sheet(sheet).image);
  assert.equal(bytes[0], 0x89, `${label}'s image`);
  const { modules, rectangles } = data.sheet(sheet);
  for (const frame of data.animation(animation).frames) {
    for (const part of frame.parts) {
      const module = modules[part.module];
      assert.ok(module, `${label}'s module ${part.module}`);
      assert.ok(rectangles[module.rectangle], `${label}'s rectangle`);
    }
  }
}

test('every room can be drawn in both worlds and all three chapters', () => {
  const game = newGame();
  for (let room = 0; room < 26; room++) {
    for (const world of [1, 2]) {
      for (const chapter of [1, 2, 3]) {
        Object.assign(game, { room, world, chapter, mode: 0 });
        for (const sprite of game.scene()) assertDrawable(sprite, `room ${room}`);
      }
    }
  }
});

test('every corridor cell and direction can be drawn on every floor', () => {
  const game = newGame();
  game.mode = 1;
  let views = 0;
  for (const floor of [1, 2, 3]) {
    game.floor = floor;
    for (const row of game.grid) {
      for (const cell of row) {
        if (cell < 26) continue;
        for (let facing = 0; facing < 4; facing++) {
          for (const chapter of [1, 2, 3]) {
            game.chapter = chapter;
            game.placeInCorridor(cell, facing);
            for (const sprite of game.scene()) assertDrawable(sprite, `cell ${cell}`);
            views++;
          }
        }
      }
    }
  }
  assert.equal(views, 31 * 4 * 3);
});

test('a new game opens in the first room with Gary and Vincent talking', () => {
  const game = createGame(data);
  assert.equal(game.room, 0);
  assert.equal(game.chapter, 1);
  assert.equal(game.currentText.speaker, 'Gary');
  assert.equal(game.currentText.text, "C'mon Chicken-hearted! Show me that you're a man.");
  const lines = [];
  while (game.currentText) {
    lines.push(game.currentText.speaker);
    game.click();
  }
  assert.equal(lines.length, 3);
});

test('looking at the curtains describes them, through the verb wheel', () => {
  const game = newGame();
  game.moveCursor(220, 180);
  game.click();
  assert.deepEqual([game.verbs.hotspot.kind, game.verbs.hotspot.id], ['object', 14]);
  const size = animationSize(
    data.sheet(data.tables.cursorSprites[1][0]),
    data.animation(data.tables.cursorSprites[1][1]),
  );
  assert.equal(game.verbs.x, Math.round(220 - size.width / 2));
  const arm = VERB_WHEEL.arms.find(({ verb }) => verb === VERB.LOOK);
  game.moveCursor(game.verbs.x + arm.dx + 1, game.verbs.y + arm.dy + 1);
  game.click();
  assert.equal(game.verbs, null);
  assert.equal(game.currentText.text, 'The curtains are closed... we cannot see the light of the sun.');
});

test('using something that can be carried picks it up, and it leaves the room', () => {
  const game = newGame();
  const { roomObjects, objectStates } = data.tables;
  const room = roomObjects.findIndex((objects, index) =>
    objects.some(([id, , , x0, , , , chapter, world]) => {
      game.room = index;
      return x0 !== -1 && objectStates[id][2] === 0 && chapter !== 2 && chapter !== 3 && world !== 2;
    }),
  );
  game.enterRoom(room);
  const spot = game.hotspots().find(({ id }) => objectStates[id][2] === 0);
  assert.ok(spot, `an object to carry in room ${room}`);
  game.useOn(spot);
  assert.ok(game.hasItem(spot.id));
  assert.match(game.currentText.text, /^You have received /);
  assert.equal(
    game.hotspots().some(({ id }) => id === spot.id),
    false,
  );
});

test('clicking away from the verb wheel closes it', () => {
  const game = newGame();
  game.moveCursor(220, 180);
  game.click();
  game.moveCursor(2, 2);
  game.click();
  assert.equal(game.verbs, null);
  assert.equal(game.currentText, null);
});

test('text blocks everything else until it is dismissed', () => {
  const game = createGame(data);
  game.pressKey('move-back');
  settle(game);
  assert.equal(game.mode, 0);
});

test('leaving the first room puts you in the corridor, facing away from its door', () => {
  const game = newGame();
  game.moveCursor(180, 310);
  assert.equal(game.action().kind, 'leave');
  game.click();
  settle(game);
  assert.equal(game.mode, 1);
  assert.equal(game.cell, 30);
  assert.equal(game.facing, FACING.SOUTH);
});

test('walking and turning follow the floor map', () => {
  const game = newGame();
  game.pressKey('move-back');
  settle(game);
  game.pressKey('move-forward');
  settle(game);
  assert.equal(game.cell, 33);
  game.pressKey('move-left');
  settle(game);
  assert.equal(game.facing, FACING.EAST);
  game.pressKey('move-forward');
  settle(game);
  assert.equal(game.cell, 34);
  game.pressKey('move-back');
  settle(game);
  assert.equal(game.facing, FACING.WEST);
  assert.equal(game.cell, 34);
});

test('a door opens onto its room if the chapter allows it, and comes back to the same place', () => {
  const game = newGame();
  game.pressKey('move-back');
  settle(game);
  game.pressKey('move-back');
  settle(game);
  assert.equal(game.facing, FACING.NORTH);
  const [door] = game.hotspots();
  assert.equal(door.kind, 'door');
  game.useDoor(door.id);
  settle(game);
  assert.equal(game.mode, 0);
  assert.equal(game.room, 0);
  game.leaveRoom();
  settle(game);
  assert.equal(game.cell, 30);
  assert.equal(game.facing, FACING.SOUTH);
});

test('a locked door says so', () => {
  const game = newGame();
  game.doorStates[0][0] = 2;
  game.mode = 1;
  game.useDoor(game.hotspots()[0].id);
  assert.equal(game.currentText.text, 'The door is locked.');
});

test('stairs lead where GameMidlet.F() says', () => {
  const game = newGame();
  game.mode = 1;
  game.takeStairs(98);
  settle(game);
  assert.deepEqual([game.floor, game.cell, game.facing], [2, 45, FACING.EAST]);
  game.takeStairs(154);
  settle(game);
  assert.deepEqual([game.floor, game.cell, game.facing], [1, 27, FACING.WEST]);
});

test('every corridor cell can be reached, on foot and by stairs and lifts', () => {
  const game = newGame();
  game.mode = 1;
  const floorOf = (cell) =>
    [1, 2, 3].find((floor) => {
      game.floor = floor;
      return game.grid.flat().includes(cell);
    });
  const seen = new Set([30]);
  const queue = [30];
  const visit = (cell) => {
    if (!seen.has(cell)) {
      seen.add(cell);
      queue.push(cell);
    }
  };
  while (queue.length) {
    const cell = queue.pop();
    game.floor = floorOf(cell);
    for (let facing = 0; facing < 4; facing++) {
      game.placeInCorridor(cell, facing);
      const door = game.doorsAt(cell)[facing];
      if (door in STAIRS) visit(STAIRS[door].cell);
      if (LIFTS.has(door)) for (const destination of LIFT_CELLS) visit(destination);
      if (game.canWalkForward()) {
        const [stepRow, stepColumn] = STEP[facing];
        visit(game.grid[game.row + stepRow][game.column + stepColumn]);
      }
    }
  }
  assert.equal(seen.size, 31);
});

test('what is not ported yet says so, rather than doing nothing', () => {
  const game = newGame();
  game.runActions([[4, 1]]);
  assert.equal(game.notPorted, 'Not ported yet: Puzzle 1');
  game.click();
  assert.equal(game.notPorted, null);
});

test('a rule fires once, and only when its conditions hold', () => {
  const game = newGame();
  // The rule for object 41 needs room 8 in the second chapter.
  assert.equal(game.fire(TRIGGER.USE_OBJECT, 41), false);
  game.room = 8;
  game.chapter = 2;
  assert.equal(game.fire(TRIGGER.USE_OBJECT, 41), true);
  assert.equal(game.fire(TRIGGER.USE_OBJECT, 41), false);
  assert.ok(game.hasItem(73) || game.bullets[2] > 0);
});

test('the port follows v1.7.0 and its twins, and explains what it does with the rest', async () => {
  const results = {};
  for (const { id } of buildsOf('sh3')) {
    const { status, reason } = await inspectJar(readInput(id));
    const key = `${status} ${reason}`;
    results[key] = [...(results[key] ?? []), id];
  }
  const counts = Object.fromEntries(Object.entries(results).map(([key, ids]) => [key, ids.length]));
  assert.deepEqual(counts, {
    'warning mobile3-partial': 17,
    'rejected mobile3-other-build': 69,
  });
  assert.ok(results['warning mobile3-partial'].includes('sh3-en-v170'));
  assert.ok(results['rejected mobile3-other-build'].includes('sh3-en-v180'));
});
