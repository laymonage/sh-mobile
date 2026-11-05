import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildsOf, readInput, recommended } from '../src/inputs.mjs';
import { inspectJar, readJar } from '../web/engine/jar.mjs';
import { readStaticTables } from '../web/engine/mobile3/class-tables.mjs';
import { animationSize, loadMobile3, parseLanguage } from '../web/engine/mobile3/data.mjs';
import {
  createGame,
  FACING,
  Mobile3Game,
  LIFT_CELLS,
  LIFTS,
  MODE,
  SCREEN_X,
  STAIRS,
  STEP,
  VERB,
} from '../web/engine/mobile3/game.mjs';
import { controlsText, puzzleText } from '../web/engine/mobile3/help.mjs';
import { BUILD_RESOURCES } from '../web/engine/mobile3/resources.mjs';
import { actionsOf, conditionsHold, TRIGGER } from '../web/engine/mobile3/rules.mjs';

const files = await readJar(readInput(recommended.sh3.gameData));
const data = loadMobile3(files);
const keypadFiles = await readJar(readInput('sh3-2010-v1.0.20-a'));
const keypadData = loadMobile3(keypadFiles);
const clear = (game) => {
  while (game.box) game.pressKey('Escape');
};
const newGame = (options = {}, build = data) => {
  const game = createGame(build, { startInGame: true, ...options });
  clear(game);
  settle(game);
  return game;
};
const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};
const EXPECTED_UNUSED = [35];
const EXPECTED_FOLLOWED = 41;
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
  for (const language of keypadData.languages) assert.equal(keypadData.text(language).length, 618);
});

test('offers its sound under the names the sound player looks up, wherever a build keeps it', () => {
  assert.equal(data.entries.size, 10);
  assert.ok(data.entries.has('sh3/sfx/mid/music.mid'));
  assert.equal(keypadData.entries.size, 10);
  for (const [name, bytes] of data.entries) assert.deepEqual(keypadData.entries.get(name), bytes, name);
});

test('every number written into the code is the right kind of resource, in both kinds of build', () => {
  for (const build of [data, keypadData]) {
    const { hardCoded } = build;
    const sprites = [
      ...Object.values(hardCoded.walls).flatMap((world) =>
        Object.values(world).flatMap(({ sheet, left, right }) => [
          { sheet, animation: left },
          { sheet, animation: right },
        ]),
      ),
      ...Object.values(hardCoded.hud).filter((value) => typeof value === 'object'),
      hardCoded.fade,
      hardCoded.bloodOverlay,
      hardCoded.inventory,
    ];
    for (const { sheet, animation } of sprites) {
      assert.equal(build.resource(build.sheet(sheet).image)[0], 0x89, `sheet ${sheet}`);
      for (const { parts } of build.animation(animation).frames) {
        for (const part of parts) assert.ok(build.sheet(sheet).modules[part.module], `animation ${animation}`);
      }
    }
  }
  assert.equal(data.kind, 'touch');
  assert.equal(keypadData.kind, 'keypad');
  assert.notEqual(BUILD_RESOURCES.touch.mapSheet, BUILD_RESOURCES.keypad.mapSheet);
});

test('the fonts have the letters the text uses', () => {
  for (const build of [data, keypadData]) {
    assert.equal(build.fonts.length, 4);
    const missing = new Set();
    for (const language of build.languages) {
      for (const line of build.text(language)) {
        for (const character of line) {
          if (character > ' ' && character !== '|' && !build.fonts[2].glyphs.has(character.charCodeAt(0))) {
            missing.add(character);
          }
        }
      }
    }
    assert.ok(missing.size < 20, `only a few rare characters are missing: ${[...missing].join('')}`);
  }
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
  const game = createGame(data, { startInGame: true });
  assert.equal(game.room, 0);
  assert.equal(game.chapter, 1);
  assert.equal(game.box.speaker, 'Gary');
  assert.equal(game.box.text, "C'mon Chicken-hearted! Show me that you're a man.");
  assert.ok(game.hasItem(118), 'Vincent starts with his metal stick');
  game.pressKey('Escape');
  assert.equal(game.box.kind, 'dialogue', 'the next dialogue follows from the first');
});

for (const build of [data, keypadData]) {
  test(`looking at the curtains describes them, through the verb wheel, on the ${build.kind} art`, () => {
    const game = newGame({}, build);
    game.moveCursor(220, 180);
    game.click();
    assert.deepEqual([game.verbs.hotspot.kind, game.verbs.hotspot.id], ['object', 14]);
    const size = animationSize(
      build.sheet(build.tables.cursorSprites[1][0]),
      build.animation(build.tables.cursorSprites[1][1]),
    );
    assert.equal(game.verbs.x, Math.round(220 - size.width / 2));
    const arm = game.verbArms().find(({ verb }) => verb === VERB.LOOK);
    game.moveCursor(game.verbs.x + arm.dx + 1, game.verbs.y + arm.dy + 1);
    game.click();
    assert.equal(game.verbs, null);
    assert.equal(game.currentText.text, 'The curtains are closed... we cannot see the light of the sun.');
  });
}

test('using something that can be carried picks it up, and it leaves the room', () => {
  const game = newGame();
  game.enterRoom(20);
  game.world = 1;
  const spot = game.hotspots().find(({ id }) => id === 110);
  assert.ok(spot, 'the lighter on the table');
  game.useOn(spot);
  assert.ok(game.hasItem(110));
  assert.match(game.currentText.text, /^You have received /);
  assert.equal(
    game.hotspots().some(({ id }) => id === 110),
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
  const game = createGame(data, { startInGame: true });
  game.pressKey('move-back');
  settle(game);
  assert.equal(game.mode, 0);
});

test('long text scrolls to its end before a click moves on', () => {
  const game = newGame();
  game.showSpeech('Someone', 'word '.repeat(80));
  const { pageLines, lines } = game.box;
  assert.ok(lines.length > pageLines);
  game.click();
  assert.equal(game.box.scroll, pageLines);
  while (game.box) game.click();
  assert.equal(game.box, null);
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
  game.placeInCorridor(30, FACING.NORTH);
  game.doorStates[0][0] = 2;
  game.mode = 1;
  game.useDoor(game.hotspots()[0].id);
  assert.equal(game.currentText.text, 'The door is locked.');
});

test('the lift goes to the floor chosen from its list', () => {
  const game = newGame();
  game.mode = 1;
  game.floor = 1;
  game.placeInCorridor(36, FACING.EAST);
  const door = game.hotspots().find(({ kind }) => kind === 'door');
  assert.ok(LIFTS.has(door.id));
  assert.equal(game.action((door.x0 + door.x1) >> 1, (door.y0 + door.y1) >> 1).kind, 'stairs');
  game.useDoor(door.id);
  assert.equal(game.box.selected, 2, 'it starts on the floor you are on');
  game.pressKey('ArrowUp');
  game.pressKey('ArrowUp');
  game.pressKey('Enter');
  settle(game);
  assert.deepEqual([game.floor, game.cell], [3, 55]);
});

test('the forward key takes the stairs or lift ahead, but not a door', () => {
  const game = newGame();
  game.mode = MODE.CORRIDOR;
  game.floor = 1;
  game.placeInCorridor(36, FACING.EAST);
  game.pressKey('move-forward');
  assert.ok(game.liftMenu, 'the lift offers its floors');
  game.pressKey('Escape');

  game.placeInCorridor(27, FACING.EAST);
  game.pressKey('move-forward');
  settle(game);
  assert.deepEqual([game.floor, game.cell, game.facing], [2, 45, FACING.EAST], 'up the stairs');
  game.placeInCorridor(45, FACING.WEST);
  game.pressKey('move-forward');
  settle(game);
  assert.deepEqual([game.floor, game.cell, game.facing], [1, 27, FACING.WEST], 'and back down');

  game.placeInCorridor(30, FACING.NORTH);
  game.pressKey('move-forward');
  settle(game);
  assert.deepEqual([game.mode, game.cell], [MODE.CORRIDOR, 30], 'a room door still needs a click');
});

test('1 changes to the next weapon carried, melee included, so its button says Weapon', () => {
  assert.equal(Mobile3Game.ITEM_LABELS[1], 'Weapon');
  const game = newGame();
  game.items = game.items.filter((item) => ![118, 111, 120].includes(item));
  game.addItem(118);
  game.addItem(120);
  game.weapon = 0;
  game.pressKey('1');
  assert.equal(game.weapon, 2, 'the shotgun, skipping the pistol that is not carried');
  game.pressKey('1');
  assert.equal(game.weapon, 0, 'and back to melee');
});

test('the map shows each floor, once the player has it', () => {
  const game = newGame();
  game.mode = 1;
  game.pressKey('map');
  assert.equal(game.map, null);
  game.addItem(121);
  assert.equal(game.softKeys().left.action, 'map');
  game.pressKey('map');
  assert.equal(game.map.floor, 1);
  game.pressKey('ArrowRight');
  assert.equal(game.map.floor, 2);
  assert.ok(game.drawList().length > 10);
  game.pressKey('Escape');
  assert.equal(game.map, null);
});

test('the inventory uses items on what the verb wheel was opened on', () => {
  const game = newGame();
  game.enterRoom(10);
  settle(game);
  game.addItem(105);
  game.moveCursor(
    ...(({ x0, x1, y0, y1 }) => [(x0 + x1) >> 1, (y0 + y1) >> 1])(game.hotspots().find(({ id }) => id === 37)),
  );
  game.click();
  game.chooseVerb(VERB.INVENTORY);
  assert.ok(game.inventory.isOpen);
  while (game.inventory.item !== 105) game.pressKey('ArrowRight');
  game.pressKey('Enter');
  assert.ok(game.hasItem(106), 'the ice melted into the gold key');
  assert.equal(game.hasItem(105), false);
  assert.equal(game.inventory.isOpen, false);
});

test('looking at an item comes back to the inventory', () => {
  const game = newGame();
  game.pressKey('inventory');
  assert.equal(game.inventory.item, 118);
  game.pressKey('ArrowDown');
  game.pressKey('Enter');
  assert.ok(game.currentText);
  assert.equal(game.inventory.isOpen, false);
  game.click();
  assert.equal(game.inventory.isOpen, true);
});

test('saving and loading bring the same game back', () => {
  const storage = memoryStorage();
  const game = newGame({ storage });
  game.addItem(106);
  game.setHealth(55);
  game.mode = 1;
  game.floor = 2;
  game.placeInCorridor(50, FACING.WEST);
  assert.ok(game.canSave());
  game.saveGame();
  assert.ok(game.hasSave());
  assert.equal(game.currentText.text, 'Game saved!');

  const later = newGame({ storage });
  assert.ok(later.hasSave());
  assert.ok(later.loadGame());
  assert.ok(later.hasItem(106));
  assert.deepEqual([later.health, later.floor, later.cell, later.facing, later.mode], [55, 2, 50, FACING.WEST, 1]);
});

test('settings and the chosen language last', () => {
  const storage = memoryStorage();
  const game = createGame(data, { storage });
  for (let i = 0; i < 200 && game.frontEnd.stage === 'logo'; i++) game.tick();
  assert.equal(game.frontEnd.stage, 'languages');
  game.pressKey('ArrowDown');
  game.pressKey('Enter');
  assert.equal(game.language, 'fr');
  const again = createGame(data, { storage });
  assert.equal(again.language, 'fr');
  for (let i = 0; i < 200 && again.frontEnd.stage === 'logo'; i++) again.tick();
  assert.equal(again.frontEnd.stage, 'first-settings', 'the question comes once');
});

test('the main menu starts a game, and continues one if there is a save', () => {
  const storage = memoryStorage();
  const game = createGame(data, { storage });
  game.frontEnd.showMainMenu();
  game.pressKey('Enter');
  assert.equal(game.frontEnd, null);
  assert.equal(game.room, 0);
  clear(game);
  game.saveGame({ quietly: true });
  game.quitToFrontEnd();
  assert.equal(game.frontEnd.stage, 'main');
  game.pressKey('Enter');
  assert.equal(game.frontEnd.stage, 'play');
  game.pressKey('Enter');
  assert.equal(game.frontEnd, null);
});

test('pausing stops the world, and its rows work', () => {
  const game = newGame({ storage: memoryStorage() });
  game.pressSoftKey('right');
  assert.ok(game.pause);
  const { time } = game;
  game.tick();
  assert.equal(game.time, time + 60);
  game.pressKey('ArrowDown');
  game.pressKey('Enter');
  assert.ok(game.hasSave());
  // The message after saving goes back to the game, as the original's does.
  game.pressKey('Escape');
  assert.equal(game.pause === null, true);
});

function solveClockButtons(game) {
  const { puzzle } = game;
  game.moveCursor(SCREEN_X + puzzle.forwardX + 2, puzzle.buttonY + 2);
}

test('the clock has to show a quarter to four', () => {
  const game = newGame();
  game.mode = 1;
  game.ruleFired[35] = true;
  game.startPuzzle(3);
  clear(game);
  solveClockButtons(game);
  assert.equal(game.puzzle.isSolved(), false);
  for (let i = 0; i < 45; i++) game.click();
  assert.equal(game.puzzle.isSolved(), true);
  game.pressSoftKey('left');
  assert.ok(game.ruleFired[53], 'the rule for solving it ran');
});

test('holding the clock button keeps its hands turning', () => {
  const game = newGame();
  game.mode = 1;
  game.startPuzzle(3);
  clear(game);
  solveClockButtons(game);
  assert.ok(game.wantsStroke());
  game.startStroke(game.cursorX, game.cursorY);
  for (let i = 0; i < 50; i++) game.tick();
  game.endStroke();
  const reached = game.puzzle.minute + game.puzzle.hourBase * 4;
  assert.ok(reached > 10, `it reached ${reached}`);
  game.tick();
  assert.equal(game.puzzle.minute + game.puzzle.hourBase * 4, reached);
});

test('a wrong number on the phone clears, and the right one opens the door', () => {
  const game = newGame();
  game.mode = 1;
  game.startPuzzle(1);
  clear(game);
  for (const digit of '111111') game.pressKey(digit);
  for (let i = 0; i < 20; i++) game.tick();
  assert.deepEqual(game.puzzle.entered, []);
  const { keyAt } = game.puzzle;
  assert.equal(typeof keyAt, 'function');
  for (const digit of '426463') game.pressKey(digit);
  for (let i = 0; i < 20; i++) game.tick();
  assert.equal(game.puzzle === null, true);
  assert.equal(game.room, 13);
  assert.equal(game.phoneSolved, true);
});

for (const build of [data, keypadData]) {
  test(`a wrong number on the ${build.kind} build's safe costs health and returns to the room`, () => {
    const game = newGame({}, build);
    game.chapter = 3;
    game.enterRoom(15);
    settle(game);
    game.startPuzzle(4);
    game.pressKey('9');
    game.pressSoftKey('left');
    assert.equal(game.health, 75);
    assert.equal(game.puzzle === null, true);
    assert.equal(game.mode, MODE.ROOM);
  });

  test(`the ${build.kind} build's safe opens to 001, with the mouse alone`, () => {
    const game = newGame({}, build);
    game.chapter = 3;
    game.enterRoom(15);
    settle(game);
    game.startPuzzle(4);
    const { puzzle } = game;
    const click = (x, y) => {
      game.moveCursor(SCREEN_X + x, y);
      game.click();
    };
    if (puzzle.art.kind === 'dial') {
      const center = ({ x, y, width, height }) => [x + (width >> 1), y + (height >> 1)];
      click(...center(puzzle.dialPlace));
      click(...center(puzzle.dialPlace));
      click(...center(puzzle.buttonPlaces[2]));
    } else {
      const right = puzzle.keysX + puzzle.keysSize.width - 3;
      const knobY = puzzle.keysY + 3;
      const panel = [puzzle.panelX + 3, puzzle.panelY + 3];
      click(right, knobY);
      click(...panel);
      click(right, knobY);
      click(...panel);
      click(right, knobY);
      click(right, knobY);
    }
    assert.equal(puzzle.digits.join(''), '001');
    game.pressSoftKey('left');
    assert.equal(game.objectHidden[54], 0, 'the opened safe shows');
  });
}

test('a pearl in the wrong cavity goes back into the inventory', () => {
  const game = newGame();
  game.chapter = 3;
  game.mode = 1;
  for (const pearl of [68, 69, 70, 71]) game.addItem(pearl);
  game.startPuzzle(6);
  clear(game);
  game.moveCursor(SCREEN_X + 120, 141);
  game.click();
  while (game.inventory.item !== 68) game.pressKey('ArrowRight');
  game.pressKey('Enter');
  assert.equal(game.hasItem(68), false);
  assert.ok(game.puzzle.holdsPearl(68));
  game.pressSoftKey('left');
  assert.equal(game.puzzle === null, true);
  assert.ok(game.hasItem(68));
});

test('a fight hurts the player, and dying offers to go back', () => {
  const game = newGame({ storage: memoryStorage(), random: () => 0.2 });
  game.mode = 1;
  game.room = 20;
  game.world = 2;
  game.floor = 2;
  game.placeInCorridor(50, FACING.SOUTH);
  game.startFight(1, false);
  clear(game);
  let limit = 5000;
  while (!game.gameOver && limit-- > 0) {
    game.tick();
    if (!game.gameOver) clear(game);
  }
  assert.ok(limit > 0, 'the monster got through');
  assert.equal(game.health <= 0, true);
  assert.equal(game.softKeys().left.label, 'Retry');
  assert.equal(game.currentText.text, 'You are dead...');
  game.pressKey('Enter');
  assert.equal(game.gameOver, false);
  assert.equal(game.room, 0, 'without a save, the game starts again');
});

test('a shot lands only on the monster, and using the pistol spends a bullet', () => {
  const game = newGame();
  game.mode = 1;
  game.bullets[1] = 15;
  game.addItem(111);
  game.reload(1);
  game.equip(1);
  game.startFight(1, false);
  clear(game);
  while (game.fight.intro) game.tick();
  game.moveCursor(0, 0);
  game.click();
  assert.equal(game.fight.health, 100);
  assert.equal(game.loaded[1], 14);
  // The miss's recoil settles back to the mouse first.
  while (game.kickX || game.kickY) game.tick();
  const { fight } = game;
  const box = fight.hitBox();
  game.moveCursor(SCREEN_X + fight.x + box.left + 2, fight.y + box.top + 2);
  assert.ok(fight.isOnTarget(game.screenX, game.cursorY));
  game.click();
  assert.equal(fight.health, 82, 'the pistol, less a tenth for the armor');
});

test('everything that can be drawn in a fight or puzzle can be, in both kinds of build', () => {
  for (const build of [data, keypadData]) {
    const game = newGame({}, build);
    game.mode = 1;
    for (const number of [1, 2, 3, 4, 5, 6]) {
      game.startPuzzle(number);
      assert.ok(game.drawList().length > 0);
      clear(game);
      assert.ok(game.drawList().length > 0);
      game.puzzle = null;
      game.mode = 1;
    }
    for (const monster of [1, 2, 3, 4]) {
      game.startFight(monster, monster === 4);
      for (let i = 0; i < 300 && game.fight; i++) {
        game.tick();
        clear(game);
        game.drawList();
      }
      game.fight = null;
      game.fade = null;
      game.mode = 1;
      game.setHealth(100);
      game.gameOver = false;
    }
  }
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

const soundSpy = () => {
  const plays = [];
  return { plays, audio: { play: (name, loops) => plays.push([name, loops]), stop() {} } };
};
const WHISPER = ['whisper', -1];

for (const build of [data, keypadData]) {
  test(`the ${build.kind} build draws both close walls in every corridor view, which hold the floor and ceiling`, () => {
    const game = newGame({}, build);
    game.mode = MODE.CORRIDOR;
    for (const world of [1, 2]) {
      game.world = world;
      const { closeWall } = build.hardCoded.walls[world];
      for (const floor of [1, 2, 3]) {
        game.floor = floor;
        for (const cell of game.grid.flat().filter((cell) => cell >= 26)) {
          for (const facing of Object.values(FACING)) {
            game.placeInCorridor(cell, facing);
            const [first, second] = game.corridorPieces();
            assert.equal(first.animation, closeWall.left, `floor ${floor}, cell ${cell}, facing ${facing}`);
            assert.equal(second.animation, closeWall.right, `floor ${floor}, cell ${cell}, facing ${facing}`);
          }
        }
      }
    }
  });

  test(`backing out of the ${build.kind} build's safe opens nothing, and the whisper comes back`, () => {
    const { plays, audio } = soundSpy();
    const game = newGame({ audio }, build);
    game.chapter = 3;
    game.enterRoom(15);
    settle(game);
    assert.deepEqual(plays.at(-1), WHISPER, 'the room has a monster');
    const hidden = game.objectHidden[54];
    game.startPuzzle(4);
    plays.length = 0;
    game.pressSoftKey('right');
    assert.equal(game.puzzle === null, true);
    assert.equal(game.mode, MODE.ROOM);
    assert.equal(game.objectHidden[54], hidden);
    assert.equal(game.health, 100);
    assert.deepEqual(plays, [WHISPER]);
  });
}

test('a wrong number flashes red for a moment, over the room it returns to', () => {
  const game = newGame();
  game.chapter = 3;
  game.enterRoom(15);
  settle(game);
  game.startPuzzle(4);
  const red = () => game.drawList().some(({ fill }) => fill === '#aa0000');
  game.pressKey('9');
  game.pressSoftKey('left');
  assert.equal(game.puzzle === null, true);
  assert.ok(red());
  game.tick();
  game.tick();
  assert.equal(red(), false);
});

test('a wrong number that kills goes to dying without its rule', () => {
  const game = newGame();
  game.chapter = 3;
  game.enterRoom(15);
  settle(game);
  game.setHealth(25);
  const hidden = game.objectHidden[54];
  game.startPuzzle(4);
  game.pressKey('9');
  game.pressSoftKey('left');
  assert.ok(game.gameOver);
  assert.equal(game.objectHidden[54], hidden);
});

test('erasing the save takes Continue away, and dying then starts again', () => {
  const storage = memoryStorage();
  const saved = newGame({ storage });
  saved.setHealth(33);
  saved.saveGame({ quietly: true });
  const game = createGame(data, { storage });
  assert.ok(game.hasSave());
  game.eraseSave();
  game.startNewGame();
  clear(game);
  assert.equal(game.hasSave(), false);
  assert.equal(game.readSave(), null);
  game.setHealth(50);
  game.retry();
  assert.equal(game.health, 100);
});

test('a rule that gives several things names the first', () => {
  const name = (game, item) => `${game.lines[410]}${game.lines[game.tables.objectNames[item]]}`;
  const cases = [
    { object: 62, room: 9, chapter: 1, item: 111 },
    { object: 141, room: 11, chapter: 2, item: 120 },
    { object: 140, room: 7, chapter: 3, item: 120 },
    { object: 139, room: 22, chapter: 1, item: 73 },
  ];
  for (const { object, room, chapter, item } of cases) {
    const game = newGame();
    Object.assign(game, { room, chapter, world: 2 });
    assert.ok(game.fire(TRIGGER.USE_OBJECT, object), `the rule for object ${object}`);
    assert.equal(game.currentText.text ?? game.box.text, name(game, item));
    assert.equal(game.box.icon.item, item);
  }
});

test("loading a save in a monster's room brings its whisper back", () => {
  const { plays, audio } = soundSpy();
  const game = newGame({ audio, storage: memoryStorage() });
  game.chapter = 3;
  game.enterRoom(15);
  settle(game);
  game.saveGame({ quietly: true });
  plays.length = 0;
  game.loadGame();
  game.tick();
  assert.deepEqual(plays, [WHISPER]);
});

test('turning the world over in a room with a monster starts its whisper after the alarm', () => {
  const { plays, audio } = soundSpy();
  const game = newGame({ audio });
  game.enterRoom(20);
  settle(game);
  game.flagL = true;
  assert.equal(game.hasMonster(20), false);
  plays.length = 0;
  assert.ok(game.fire(TRIGGER.USE_OBJECT, 144));
  assert.deepEqual(plays, [['alarm', 1]]);
  assert.ok(game.fade, 'the room fades as it changes');
  game.tick();
  assert.deepEqual(plays, [['alarm', 1], WHISPER]);
});

test('saving while the paper puzzle is paused comes back to its room', () => {
  const game = newGame({ storage: memoryStorage() });
  game.enterRoom(20);
  settle(game);
  game.startPuzzle(2);
  game.saveGame({ quietly: true });
  game.loadGame();
  assert.equal(game.mode, MODE.ROOM);
  assert.equal(game.room, 20);
});

test("fades take the original's few updates, in the JAR's art", () => {
  const game = newGame();
  game.mode = MODE.CORRIDOR;
  game.placeInCorridor(30, FACING.NORTH);
  const { sheet } = data.hardCoded.fade;
  const stippled = () => game.drawList().filter((item) => item.sheet === sheet).length;
  const black = () => game.drawList().at(-1).fill === '#000000';
  game.turnTo(FACING.EAST);
  assert.ok(stippled() > 400, 'stippled before an update has passed');
  const seen = [];
  while (game.fade) {
    game.tick();
    seen.push(stippled() > 0 ? 'stippled' : black() ? 'black' : 'clear');
  }
  assert.equal(game.facing, FACING.EAST);
  assert.deepEqual(seen, ['black', 'black', 'stippled', 'clear', 'clear']);
});

test('with Transitions off, steps and turns happen as soon as they would, with nothing drawn', () => {
  const storage = memoryStorage();
  storage.setItem('silent-hill-mobile:transitions', 'off');
  const game = newGame({ storage });
  assert.equal(game.roomTransitions, false);
  game.mode = MODE.CORRIDOR;
  game.placeInCorridor(30, FACING.NORTH);
  const { sheet } = data.hardCoded.fade;
  const covered = () => game.drawList().some((item) => item.sheet === sheet || item.fill === '#000000');
  game.turnTo(FACING.EAST);
  assert.equal(covered(), false);
  game.tick();
  assert.equal(game.facing, FACING.NORTH, 'not before the update the original turns in');
  game.tick();
  assert.equal(game.facing, FACING.EAST);
  assert.equal(game.fade, null, 'and nothing holds the game up after');
  assert.equal(covered(), false);
});

test('Transitions is in both settings menus, and shared with the other games', () => {
  const storage = memoryStorage();
  const front = createGame(data, { storage });
  const row = front.frontEnd.settingIds().indexOf('transitions');
  assert.match(front.frontEnd.settingRows()[row], /^Transitions: /);
  front.frontEnd.changeSetting(row);
  assert.equal(storage.getItem('silent-hill-mobile:transitions'), 'off');
  const later = createGame(data, { storage, startInGame: true });
  clear(later);
  assert.equal(later.roomTransitions, false);
  later.openPause();
  later.pause.choose(later.pause.rowActions.indexOf('settings'));
  later.pause.choose(later.pause.settingIds().indexOf('transitions'));
  assert.equal(later.roomTransitions, true);
  assert.equal(storage.getItem('silent-hill-mobile:transitions'), 'on');
});

test('a rule changing the room it is in fades, and a box still answers meanwhile', () => {
  const game = newGame();
  game.room = 9;
  game.chapter = 1;
  game.world = 2;
  game.objectHidden[62] = 0;
  game.runActions([
    [0, 410],
    [3, 62, 1],
  ]);
  assert.ok(game.fade);
  assert.ok(game.box);
  game.pressKey('Enter');
  assert.equal(game.box, null);
  settle(game);
});

test("vibrations keep the original's patterns", () => {
  const patterns = [];
  const game = newGame({ vibrate: (pattern) => patterns.push(pattern) });
  patterns.length = 0;
  for (const pattern of [0, 1, 2]) game.vibrateFor(pattern);
  assert.deepEqual(patterns, [[500], [100, 500, 100, 500, 100], [2000]]);
  // It repeats for 3 seconds, and the last buzz starts just before they're up.
  game.vibrateFor(3);
  assert.equal(
    patterns[3].reduce((total, length) => total + length),
    3100,
  );
});

for (const [build, prompt, controls, pearlIntro] of [
  [data, 'Touch the screen', 557, 563],
  [keypadData, 'Press any key', 464, 553],
]) {
  test(`the ${build.kind} build's own prompt, controls help and pearl instructions show`, () => {
    const front = createGame(build, {});
    front.frontEnd.showPress();
    assert.equal(front.frontEnd.pressLines.join(' '), prompt);
    // The port rewrites the controls and the pearls' instructions, from each build's own line.
    assert.equal(build.hardCoded.lines.controls, controls);
    assert.equal(build.hardCoded.lines.pearlIntro, pearlIntro);

    const game = newGame({}, build);
    game.chapter = 3;
    game.mode = MODE.CORRIDOR;
    game.startPuzzle(6);
    assert.equal(game.box.text, puzzleText(game, pearlIntro, 6));
  });
}

// A fight on its own, past its flashing start, with a pistol and a full clip.
const fightOf = (build, monster, random = () => 0.5) => {
  const game = newGame({ random }, build);
  game.mode = MODE.CORRIDOR;
  game.addItem(111);
  game.weapon = 1;
  game.bullets[1] = 15;
  game.loaded[1] = 15;
  game.startFight(monster, false);
  game.fight.intro = null;
  return game;
};
const waitFor = (game, condition, limit = 200) => {
  while (!condition() && limit-- > 0) game.tick();
  assert.ok(limit > 0, 'it happened');
};
const clickAt = (game, x, y) => {
  game.moveCursor(SCREEN_X + x, y);
  game.click();
};
const middleOf = ({ left, y, width, height }) => [left + (width >> 1), y + (height >> 1)];
const pistolDamage = (build, monster) =>
  Math.trunc((build.tables.weaponDamage[1] * (100 - build.tables.monsterArmor[monster][1])) / 100);

test('the touch build shows a green target every 3 seconds, and clicking it is a sure hit', () => {
  const game = fightOf(data, 1, () => 0.5);
  const { fight } = game;
  assert.deepEqual(fight.targets(), []);
  waitFor(game, () => fight.targets().some(({ kind }) => kind === 'sure'));
  assert.ok(game.time >= 3000);
  const sure = fight.targets().find(({ kind }) => kind === 'sure');
  assert.equal(sure.x, 8, 'a middle roll puts it at the left edge');
  assert.ok(game.drawList().some(({ animation }) => animation === data.hardCoded.targets.sure));
  assert.equal(fight.isOnTarget(...middleOf(sure)), false, 'it is away from the monster');
  clickAt(game, ...middleOf(sure));
  assert.equal(fight.health, 100 - pistolDamage(data, 1));
  assert.equal(game.loaded[1], 14);
});

test("the touch build's red target sits on the monster, and clicking it hits twice as hard", () => {
  const game = fightOf(data, 1);
  const { fight } = game;
  waitFor(game, () => fight.targets().some(({ kind }) => kind === 'critical'));
  assert.ok(game.time >= 4500);
  const critical = fight.targets().find(({ kind }) => kind === 'critical');
  const box = fight.hitBox();
  assert.deepEqual([critical.x, critical.y], [fight.x + box.left, fight.y + box.top]);
  clickAt(game, ...middleOf(critical));
  assert.equal(
    fight.health,
    100 - Math.trunc((data.tables.weaponDamage[1] * 2 * (100 - data.tables.monsterArmor[1][1])) / 100),
  );
  assert.equal(game.shake, 200);
  assert.ok(fight.sparks, 'four more sparks show');
  assert.equal(
    fight.targets().some(({ kind }) => kind === 'critical'),
    false,
    'it goes once it has landed',
  );
});

test('a red target clicked with an empty clip makes the next shot that lands a critical, and holds attacks off', () => {
  const game = fightOf(data, 1);
  const { fight } = game;
  waitFor(game, () => fight.targets().some(({ kind }) => kind === 'critical'));
  const critical = fight.targets().find(({ kind }) => kind === 'critical');
  game.loaded[1] = 0;
  clickAt(game, ...middleOf(critical));
  assert.equal(fight.health, 100);
  assert.ok(fight.critical);
  fight.nextAttack = -1;
  fight.think();
  assert.equal(fight.state, fight.idle, 'no attack while it waits');
  game.loaded[1] = 1;
  const box = fight.hitBox();
  clickAt(game, fight.x + box.left + (box.width >> 1), fight.y + box.top + (box.height >> 1) + 3);
  assert.equal(fight.critical, false);
  assert.equal(game.shake, 200);
});

test('the second monster only gets the green target at the top', () => {
  const game = fightOf(data, 2, () => 0.2);
  const { fight } = game;
  game.tick();
  game.targetClock.sureWait = 0;
  game.fight.tickTargets(60);
  assert.deepEqual(fight.targets(), [], 'a roll for a side shows nothing');
  game.targetClock.sureRoll = 80;
  const [top] = fight.targets();
  assert.equal(top.kind, 'sure');
  assert.equal(top.x, 120 - (top.width >> 1));
  assert.ok(top.y > 16, 'under the health picture');
});

test('keypad builds have no targets', () => {
  const game = fightOf(keypadData, 1);
  for (let i = 0; i < 150; i++) game.tick();
  assert.equal(game.targetClock, null);
  assert.deepEqual(game.fight.targets(), []);
});

const PHONE_WORDS =
  /\bLSK\b|\bRSK\b|fire\/5|2\/4\/6\/8|\bTouch\b|Berühr|Tocca|Toca |funz|Auswahltaste|Soft-Taste|Steuerkreuz|cruceta|dpad/;

for (const build of [data, keypadData]) {
  test(`the ${build.kind} build's Controls page and puzzle instructions describe a mouse and keyboard, in every language`, () => {
    const game = newGame({}, build);
    for (const { name } of build.languages) {
      game.setLanguage(name);
      const original = game.lines[build.hardCoded.lines.controls];
      const text = controlsText(game, original);
      assert.notEqual(text, original, name);
      assert.doesNotMatch(text, PHONE_WORDS, name);
      assert.match(text, /\nC\n/, `${name} names the C key`);
      assert.ok(text.endsWith(original.slice(-40).trim()), `${name} keeps the JAR's list of the menu's rows`);
      assert.equal(
        text.includes('\n\n') && /ring|cercle|Ring|cerchio|círculo/.test(text),
        build.kind === 'touch',
        name,
      );
      const { puzzleLines } = build.tables;
      for (const number of [1, 2, 3, 4, 5, 6]) {
        const line = number === 6 ? build.hardCoded.lines.pearlIntro : puzzleLines[number];
        const rewritten = puzzleText(game, line, number);
        if (number === 4 && build.kind === 'keypad') {
          assert.equal(rewritten, game.lines[line], 'the keypad safe has its riddle alone');
          continue;
        }
        assert.doesNotMatch(rewritten, PHONE_WORDS, `${name}, puzzle ${number}`);
        assert.match(rewritten, /Esc|Échap/, `${name}, puzzle ${number}`);
        if (number === 4 || number === 5) {
          assert.ok(rewritten.startsWith(game.lines[line].slice(0, 20)), `${name} keeps puzzle ${number}'s riddle`);
        }
      }
    }
  });
}

test('a line that does not read as expected keeps its original text', () => {
  const game = newGame();
  game.lines = [...game.lines];
  game.lines[417] = 'A fan translation.';
  game.lines[data.hardCoded.lines.controls] = 'Some other controls.';
  assert.equal(puzzleText(game, 417, 1), 'A fan translation.');
  assert.equal(controlsText(game, 'Some other controls.'), 'Some other controls.');
});

test('the puzzles show the new instructions, and C confirms them', () => {
  const game = newGame();
  game.chapter = 3;
  game.mode = MODE.CORRIDOR;
  game.startPuzzle(3);
  assert.equal(game.box.text, puzzleText(game, data.tables.puzzleLines[3], 3));
  clear(game);
  assert.equal(Mobile3Game.LEFT_SOFT_KEY, 'c');
  game.pressSoftKey('left');
  assert.equal(game.puzzle === null, true, 'the clock was confirmed');
});

test('the Controls page shows from the main menu and the pause menu', () => {
  const front = createGame(data, {});
  front.frontEnd.showMainMenu();
  front.frontEnd.chooseMain(2);
  front.frontEnd.chooseRow(data.tables.helpLines.indexOf(416));
  assert.match(front.frontEnd.box.lines.join(' '), /Right click \/ Esc/);
  const game = newGame();
  game.openPause();
  game.pause.choose(game.pause.rowActions.indexOf('help'));
  game.pause.choose(data.tables.helpLines.indexOf(416));
  assert.match(game.pause.box.lines.join(' '), /Right click \/ Esc/);
});

const shotOf = (options = {}) => {
  const game = fightOf(keypadData, 1, () => 0.9);
  Object.assign(game, options);
  game.moveCursor(SCREEN_X + 20, 200);
  game.click();
  return game;
};

test('with a free mouse, recoil kicks the aim up and settles back to the mouse', () => {
  const game = shotOf();
  assert.equal(game.pointerY, 200);
  assert.ok(game.cursorY <= 200 - 15 && game.cursorY >= 200 - 25, `kicked up to ${game.cursorY}`);
  assert.ok(Math.abs(game.cursorX - game.pointerX) >= 5 && Math.abs(game.cursorX - game.pointerX) <= 10);
  game.fight = null;
  for (let i = 0; i < 6; i++) game.tick();
  assert.deepEqual([game.cursorX, game.cursorY], [game.pointerX, game.pointerY]);
});

test('aiming with the keys, or with the mouse captured, recoil stays until the player steers back', () => {
  for (const options of [{ aimingWithKeys: true }, { pointerLocked: true }]) {
    const game = shotOf(options);
    const kicked = game.cursorY;
    assert.ok(kicked <= 185);
    assert.equal(game.pointerY, kicked, 'the pointer itself moved');
    game.fight = null;
    for (let i = 0; i < 6; i++) game.tick();
    assert.equal(game.cursorY, kicked);
  }
});

test('the aim wanders around a free mouse, and with the keys it drifts away', () => {
  // A pistol's aim only wanders on the updates a coin toss allows, which this always does.
  const free = fightOf(keypadData, 1, () => 0.1);
  free.moveCursor(SCREEN_X + 120, 160);
  const limit = keypadData.tables.aimDrift[free.weapon];
  for (let i = 0; i < 30; i++) {
    free.settleKick();
    free.tickAimDrift();
    assert.notEqual(free.cursorX, free.pointerX, 'it wanders off the mouse');
    assert.ok(Math.abs(free.cursorX - free.pointerX) <= limit * 2, 'and stays near it');
  }
  assert.deepEqual([free.pointerX, free.pointerY], [SCREEN_X + 120, 160]);

  const keys = fightOf(keypadData, 1, () => 0.1);
  keys.moveCursor(SCREEN_X + 120, 160);
  keys.aimWithKeys();
  for (let i = 0; i < 30; i++) {
    keys.settleKick();
    keys.tickAimDrift();
  }
  assert.ok(Math.abs(keys.cursorX - (SCREEN_X + 120)) > limit * 2, 'it keeps drifting');
  assert.equal(keys.cursorX, keys.pointerX);
});

test('the Mouse recoil setting is shared with the other games, and captures the mouse only in fights', () => {
  const storage = memoryStorage();
  const game = newGame({ storage });
  const front = createGame(data, { storage });
  const row = front.frontEnd.settingIds().indexOf('mouseRecoil');
  assert.match(front.frontEnd.settingRows()[row], /^Mouse recoil: /);
  front.frontEnd.changeSetting(row);
  assert.equal(storage.getItem('silent-hill-mobile:mouse-recoil'), 'on');
  const later = createGame(data, { storage, startInGame: true });
  clear(later);
  assert.equal(later.mouseLock, true);
  assert.equal(later.wantsMouseLock, false, 'not outside a fight');
  later.mode = MODE.CORRIDOR;
  later.startFight(1, false);
  assert.equal(later.wantsMouseLock, true);
  later.openPause();
  assert.equal(later.wantsMouseLock, false, 'not in the pause menu');
  const settings = later.pause.rowActions.indexOf('settings');
  later.pause.choose(settings);
  later.pause.choose(later.pause.settingRows().length - 1);
  assert.equal(later.mouseLock, false);
  assert.equal(storage.getItem('silent-hill-mobile:mouse-recoil'), 'off');
  assert.equal(game.mouseLock, false);
});

test('the phone keeps the numbers typed so far, and the right number counts even if you leave', () => {
  const game = newGame();
  game.mode = MODE.CORRIDOR;
  const code = game.tables.phoneCode;
  game.startPuzzle(1);
  clear(game);
  game.pressKey(String(code[0]));
  game.pressKey(String(code[1]));
  game.pressSoftKey('right');
  game.startPuzzle(1);
  clear(game);
  assert.deepEqual(game.puzzle.entered, code.slice(0, 2));
  for (const digit of code.slice(2)) game.pressKey(String(digit));
  game.pressSoftKey('right');
  assert.equal(game.phoneSolved, true);
});

test('after saving from the pause menu, its message goes back to the game', () => {
  const game = newGame({ storage: memoryStorage() });
  game.openPause();
  game.pause.choose(game.pause.rowActions.indexOf('save'));
  assert.equal(game.pause.stage, 'said');
  game.pressKey('Enter');
  assert.equal(game.pause === null, true);
});

test('the inventory key on something offers Use, and uses the item on it', () => {
  const game = newGame();
  game.enterRoom(10);
  settle(game);
  game.addItem(105);
  const ice = game.hotspots().find(({ id }) => id === 37);
  game.moveCursor((ice.x0 + ice.x1) >> 1, (ice.y0 + ice.y1) >> 1);
  game.pressKey('inventory');
  assert.equal(game.inventory.hotspot.id, 37);
  while (game.inventory.item !== 105) game.pressKey('ArrowRight');
  assert.ok(game.inventory.canUse());
  game.pressKey('Enter');
  assert.ok(game.hasItem(106), 'the ice melted into the gold key');
});

test('every item offers Use in the pearl puzzle, and one that is not a pearl cannot be used there', () => {
  const game = newGame();
  game.chapter = 3;
  game.mode = MODE.CORRIDOR;
  game.startPuzzle(6);
  clear(game);
  game.addItem(106);
  game.moveCursor(SCREEN_X + 120, 141);
  game.click();
  assert.ok(game.inventory.isOpen);
  while (game.inventory.item !== 106) game.pressKey('ArrowRight');
  assert.ok(game.inventory.canUse());
  game.pressKey('Enter');
  assert.equal(game.currentText.text, game.lines[415]);
  assert.ok(game.hasItem(106));
});

test('the port follows the v1.7.0 and v1.0.20 families, and explains what it does with the rest', async () => {
  const results = {};
  for (const { id } of buildsOf('sh3')) {
    const { status, reason } = await inspectJar(readInput(id));
    const key = `${status} ${reason}`;
    results[key] = [...(results[key] ?? []), id];
  }
  const counts = Object.fromEntries(Object.entries(results).map(([key, ids]) => [key, ids.length]));
  assert.deepEqual(counts, { 'ok ok': EXPECTED_FOLLOWED, 'rejected mobile3-other-build': 86 - EXPECTED_FOLLOWED });
  assert.ok(results['ok ok'].includes('sh3-en-v170'));
  assert.ok(results['ok ok'].includes('sh3-2010-v1.0.20-a'));
  assert.ok(results['rejected mobile3-other-build'].includes('sh3-2010-v1.0.17-a10'), 'a demo');
});
