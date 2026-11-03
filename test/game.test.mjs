import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLan } from '../web/engine/format.mjs';
import { EVENT, Game, MENU, VERB, verbWheelCenter } from '../web/engine/game.mjs';
import { inspectJar, loadGameData, readJar } from '../web/engine/jar.mjs';
import { ScriptThread, Script, STATUS, toBoolean } from '../web/engine/vm.mjs';
import { allInputs, buildsOf, readInput, recommended } from '../src/inputs.mjs';

const data = loadGameData(await readJar(readInput(recommended.sh1.gameData)));
const english = parseLan(data.entries.get('sh/lan/en.lan'));
const text = (key) => english[Number.parseInt(key, 36)];

function newGame() {
  let clock = 1000;
  const game = new Game(data, { now: () => clock, random: () => 0 });
  game.advance = (ms = 60) => {
    clock += ms;
    game.tick();
  };
  game.startNewGame();
  game.advance();
  return game;
}

// Clicks through text until the game reaches `room`, without using the skip key.
function playTo(game, room) {
  for (let i = 0; i < 5000 && game.currentRoomId !== room; i++) {
    const menu = game.menus.at(-1);
    if (menu?.id === MENU.SAY) game.click();
    game.advance(menu?.id === MENU.TEXT_FADE ? 500 : 60);
  }
  assert.equal(game.currentRoomId, room);
  game.advance();
}

function hover(game, x, y) {
  game.moveCursor(x, y);
  game.advance();
}

test('the browser reader unpacks a JAR the same as the Node one', () => {
  assert.equal(data.dataDir, 'sh');
  assert.equal(data.entries.size, 924);
  assert.equal(english.length, 714);
});

test('a new game runs setup and then opens the tutorial text', () => {
  const game = newGame();
  game.advance();
  assert.equal(game.currentRoomId, 'control');
  assert.equal(game.getRaw('sys_health'), '5');
  assert.equal(game.inventorySize('invGun'), 1);
  assert.equal(game.menus.at(-1).id, MENU.SAY);
  assert.equal(game.menus.at(-1).text, text('j4'));
  assert.equal(game.hideCursor, true);
});

test('text pauses the script until it is clicked', () => {
  const game = newGame();
  game.advance();
  assert.equal(game.getRaw('ql'), null);
  game.click();
  game.advance();
  assert.equal(game.getRaw('ql'), '1');
  assert.equal(game.menus.at(-1).text, text('j5'));
});

test('long text pages before the script resumes', () => {
  const game = newGame();
  game.advance();
  game.menus.at(-1).pageCount = 2;
  game.click();
  game.advance();
  assert.equal(game.menus.at(-1).page, 1);
  assert.equal(game.getRaw('ql'), null);
});

test('the opening plays through to the first room by clicking alone', () => {
  const game = newGame();
  playTo(game, 'intro');
  game.advance(200);
  game.advance();
  assert.equal(game.menus.at(-1).id, MENU.TEXT_FADE);
  assert.equal(game.menus.at(-1).text, game.gameText('2'));
  playTo(game, '0');
  assert.equal(game.menus.length, 0);
  assert.equal(game.hideCursor, false);
  assert.ok(game.objects.length > 10);
  assert.deepEqual([...game.unsupportedCommands], []);
});

test('the back key skips the story rooms', () => {
  const game = newGame();
  game.advance();
  game.pressKey('Escape');
  game.advance();
  game.advance();
  assert.equal(game.currentRoomId, 'intro');
  game.advance(200);
  game.advance();
  game.pressKey('Escape');
  game.advance();
  game.advance();
  assert.equal(game.currentRoomId, '0');
});

test('hovering a hotspot picks it, and clicking opens the verb wheel', () => {
  const game = newGame();
  playTo(game, '0');
  hover(game, 230, 120);
  assert.equal(game.overObject.scriptId, '2r');
  assert.equal(game.cursorView().id, 'cursorPoint');
  game.click();
  game.advance();
  const menu = game.menus.at(-1);
  assert.equal(menu.id, MENU.VERBS);
  assert.equal(menu.name, game.gameText('2o'));
  assert.equal(menu.options[VERB.LOOK], EVENT.LOOKAT);
  assert.equal(menu.options[VERB.HAND], EVENT.OPEN);
  assert.equal(menu.options[VERB.MOUTH], EVENT.TALKTO);
});

function chooseVerb(game, verb) {
  const menu = game.menus.at(-1);
  const center = verbWheelCenter(menu, 256, 256);
  const [dx, dy] = { [VERB.LOOK]: [0, -20], [VERB.HAND]: [20, 0], [VERB.MOUTH]: [0, 20], [VERB.INVENTORY]: [-20, 0] }[
    verb
  ];
  game.moveCursor(center.x + dx, center.y + dy);
  game.click();
  game.advance();
}

test('looking at the door shows its text with the speaker, and opening it changes room', () => {
  const game = newGame();
  playTo(game, '0');
  hover(game, 230, 120);
  game.click();
  game.advance();
  chooseVerb(game, VERB.LOOK);
  const say = game.menus.at(-1);
  assert.equal(say.id, MENU.SAY);
  assert.equal(say.text, game.gameText('2p'));
  assert.equal(say.speaker, game.gameText('1'));
  game.click();
  game.advance();
  assert.equal(game.menus.length, 0);

  hover(game, 230, 120);
  game.click();
  game.advance();
  chooseVerb(game, VERB.HAND);
  game.advance();
  assert.equal(game.currentRoomId, '2');
  assert.equal(game.currentRoom, '2');
  assert.deepEqual([...game.unsupportedCommands], []);
});

test('the room draws sprites at their recorded places', () => {
  const game = newGame();
  playTo(game, '0');
  const images = game.drawList().filter((item) => item.kind === 'image');
  assert.ok(images.some((item) => item.id === 'h6' && item.x === 192 && item.y === 34 && item.transform === 0));
  assert.ok(images.some((item) => item.id === 'h6' && item.x === 64 && item.transform === 1));
});

test('the wheel opens the inventory, and items can be looked at', () => {
  const game = newGame();
  playTo(game, '0');
  hover(game, 230, 120);
  game.click();
  game.advance();
  chooseVerb(game, VERB.INVENTORY);
  const inventory = game.menus.at(-1);
  assert.equal(inventory.id, MENU.INVENTORY);
  assert.deepEqual(inventory.items.map(({ id }) => id).sort(), ['2j', 'invGun']);

  inventory.hovered = inventory.items.findIndex(({ id }) => id === '2j');
  game.click();
  game.advance();
  const actions = game.menus.at(-1);
  assert.equal(actions.id, MENU.ITEM_ACTIONS);
  actions.hovered = actions.choices.findIndex(({ id }) => id === EVENT.LOOKAT);
  game.click();
  game.advance();
  assert.equal(game.menus.at(-1).id, MENU.SAY);
  assert.deepEqual([...game.unsupportedCommands], []);
});

test('the verb wheel closes when clicking outside it', () => {
  const game = newGame();
  playTo(game, '0');
  hover(game, 230, 120);
  game.click();
  game.advance();
  game.moveCursor(5, 250);
  game.click();
  game.advance();
  assert.equal(game.menus.length, 0);
});

test('every room loads and updates without an error', () => {
  const rooms = [...data.entries.keys()].map((name) => name.match(/^sh\/rom\/(.+)\.bin$/)?.[1]).filter(Boolean);
  assert.equal(rooms.length, 112);
  const unsupported = new Set();
  for (const room of rooms) {
    const game = newGame();
    game.advance();
    game.menus = [];
    game.pausedThread = null;
    game.setupDone = true;
    game.roomInit(room, false);
    game.advance();
    game.advance();
    game.drawList();
    for (const op of game.unsupportedCommands) unsupported.add(op);
  }
  assert.deepEqual([...unsupported], []);
});

// A game in the first battle room, with no random enemy attacks unless asked for.
function battleGame() {
  let clock = 1000;
  const state = { roll: 0.5 };
  const game = new Game(data, { now: () => clock, random: () => state.roll });
  game.state = state;
  game.advance = (ms = 60) => {
    clock += ms;
    game.tick();
  };
  game.startNewGame();
  game.advance();
  game.advance();
  game.pressKey('Escape');
  game.advance();
  game.advance();
  game.advance(200);
  game.advance();
  game.pressKey('Escape');
  game.advance();
  game.advance();
  assert.equal(game.currentRoomId, '0');
  game.roomInit('r', false);
  game.advance();
  game.advance();
  assert.equal(game.currentRoomId, 'r');

  // The room starts dark, until the flashlight is used on it.
  game.itemId = '4u';
  game.objects.find((object) => object.scriptId === '78').executeEvent(EVENT.USEITEM, 0);
  game.advance();
  if (game.menus.length) {
    game.click();
    game.advance();
  }
  game.advance();
  assert.ok(game.cursorAnim);
  return game;
}

function enemy(game) {
  return game.objects.find((object) => object.script?.hasEvent(EVENT.ATTACK1));
}

// Holds the crosshair on the enemy until recoil settles.
function aimAtEnemy(game) {
  const target = enemy(game);
  game.moveCursor(target.x, target.y);
  for (let i = 0; i < 8; i++) game.advance();
  assert.deepEqual([game.cursorX, game.cursorY], [target.x, target.y]);
}

// With the flashlight on, the enemy only attacks once it has settled and the light is on it.
function waitForAttackWindow(game) {
  aimAtEnemy(game);
  for (let i = 0; i < 80 && game.enemyState !== 1; i++) game.advance();
  assert.equal(game.enemyState, 1);
}

test('the gun key starts a battle, with a crosshair and the HUD', () => {
  const game = battleGame();
  const target = enemy(game);
  assert.ok(target.visible);
  assert.equal(game.battleMode, false);
  game.pressKey('1');
  game.advance();
  game.advance();
  assert.equal(game.battleMode, true);
  assert.equal(game.getRaw('sys_battleState'), '2');
  assert.equal(game.ammo, 10);
  assert.equal(game.cursorView().id, 'haircross');
  assert.ok(game.drawList().some((item) => item.id === 'HUD_numbers'));
  assert.ok(game.drawList().some((item) => item.id === 'HUD_life'));
});

test('a shot on target hurts the enemy and uses ammo, and a miss only uses ammo', () => {
  const game = battleGame();
  game.pressKey('1');
  game.advance();
  game.advance();
  const healthVar = game.getRaw('ny');
  const health = game.variableAsInteger(healthVar);
  assert.ok(health > 1);

  hover(game, 10, 10);
  game.click();
  game.advance();
  assert.equal(game.ammo, 9);
  assert.equal(game.variableAsInteger(healthVar), health);

  aimAtEnemy(game);
  assert.equal(game.cursorView().id, 'jb');
  game.click();
  game.advance();
  assert.equal(game.ammo, 8);
  assert.equal(game.variableAsInteger(healthVar), health - 1);
  assert.equal(game.attackAnim, true);
});

test('enough shots kill the enemy, and the room carries on', () => {
  const game = battleGame();
  game.pressKey('1');
  game.advance();
  game.advance();
  const healthVar = game.getRaw('ny');
  for (let i = 0; i < 20 && game.variableAsInteger(healthVar) > 0; i++) {
    aimAtEnemy(game);
    game.click();
    game.advance();
    game.advance(700);
  }
  assert.equal(game.variableAsInteger(healthVar), 0);
  assert.equal(game.getRaw('deathAnim'), '1');
  game.advance(5000);
  game.advance();
  assert.equal(game.getRaw('deathAnim'), null);
  assert.equal(toBoolean(game.getRaw(game.getRaw('enemy_dead'))), true);
  game.advance();
  assert.equal(enemy(game).visible, false);
  assert.deepEqual([...game.unsupportedCommands], []);
});

test('recoil kicks the crosshair and settles back to the pointer', () => {
  const game = battleGame();
  game.pressKey('1');
  game.advance();
  game.advance();
  hover(game, 60, 100);
  game.click();
  game.advance();
  game.advance();
  assert.ok(game.cursorY < 100);
  for (let i = 0; i < 12; i++) game.advance();
  assert.deepEqual([game.cursorX, game.cursorY], [60, 100]);
});

test('an enemy attack costs health and shows blood', () => {
  const game = battleGame();
  game.pressKey('1');
  game.advance();
  game.advance();
  const before = game.variableAsInteger('sys_health');
  waitForAttackWindow(game);
  game.state.roll = 0;
  game.advance();
  game.state.roll = 0.5;
  assert.equal(game.attackAnim, true);
  assert.ok(game.waitStop > 0);
  game.advance(800);
  game.advance();
  assert.equal(game.variableAsInteger('sys_health'), before - 1);
  game.advance();
  assert.ok(game.drawList().some((item) => item.id === 'new_monster_hurt1'));
  game.advance(5000);
  assert.equal(game.dissolve, null);
});

test('dying shows a message and ends the run', () => {
  const game = battleGame();
  game.pressKey('1');
  game.advance();
  game.advance();
  game.setVariable('sys_health', 1);
  waitForAttackWindow(game);
  game.state.roll = 0;
  game.advance();
  game.state.roll = 0.5;
  game.advance(800);
  game.advance();
  assert.equal(game.menus.at(-1)?.text, game.gameText('jn'));
  assert.equal(game.battleMode, false);
  game.click();
  game.advance();
  game.advance(300);
  game.advance();
  game.advance();
  assert.equal(game.ended, true);
  game.startNewGame();
  game.advance();
  game.advance();
  assert.equal(game.ended, false);
  assert.equal(game.currentRoomId, 'control');
  assert.equal(game.getRaw('sys_health'), '5');
});

function memoryStorage() {
  const items = new Map();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), items };
}

// A new game on `storage`, skipped to the first room.
function savableGame(storage, options = {}) {
  let clock = 1000;
  const game = new Game(data, { now: () => clock, random: () => 0.5, storage, ...options });
  game.advance = (ms = 60) => {
    clock += ms;
    game.tick();
  };
  game.startNewGame();
  game.advance();
  game.advance();
  game.pressKey('Escape');
  game.advance();
  game.advance();
  game.advance(200);
  game.advance();
  game.pressKey('Escape');
  game.advance();
  game.advance();
  assert.equal(game.currentRoomId, '0');
  return game;
}

function settle(game) {
  for (let i = 0; i < 5; i++) game.advance();
}

function recordingAudio() {
  const calls = [];
  return { calls, play: (name, loops) => calls.push(['play', name, loops]), stop: () => calls.push(['stop']) };
}

test('scripts play sounds, and only the last one requested keeps playing', () => {
  const audio = recordingAudio();
  const game = savableGame(memoryStorage(), { audio });
  audio.calls.length = 0;
  game.command({ status: 1 }, 23, ['lt']);
  game.command({ status: 1 }, 23, ['sh_bgmusic', -1]);
  game.command({ status: 1 }, 49, []);
  assert.deepEqual(audio.calls, [['play', 'lt', 1], ['play', 'sh_bgmusic', -1], ['stop']]);
  assert.deepEqual([...game.unsupportedCommands], []);
});

test('changing room stops the sound, and the new room can start its own', () => {
  const audio = recordingAudio();
  const game = savableGame(memoryStorage(), { audio });
  audio.calls.length = 0;
  game.roomInit('r', false);
  assert.deepEqual(audio.calls[0], ['stop']);
  game.advance();
  game.advance();
  assert.ok(audio.calls.some(([kind, name]) => kind === 'play' && name === 'sh_bgmusic'));
});

test('firing plays the gun, even over the sound of a hit', () => {
  const audio = recordingAudio();
  const game = new Game(data, { now: Date.now, random: () => 0.5, audio });
  game.startNewGame();
  for (let i = 0; i < 3; i++) game.tick();
  game.pressKey('Escape');
  for (let i = 0; i < 3; i++) game.tick();
  game.setRaw('sys_gunShotSound', 'sh_shot', 'S');
  game.roomInit('r', false);
  for (let i = 0; i < 3; i++) game.tick();
  game.menus = [];
  game.pausedThread = null;
  game.waitStop = 0;
  game.itemId = '4u';
  game.objects.find((object) => object.scriptId === '78').executeEvent(EVENT.USEITEM, 0);
  game.menus = [];
  game.pausedThread = null;
  game.tick();
  game.pressKey('1');
  game.tick();
  game.tick();
  const target = enemy(game);
  game.moveCursor(target.x, target.y);
  game.tick();
  game.tick();
  audio.calls.length = 0;
  game.click();
  game.tick();
  assert.deepEqual(
    audio.calls.map(([, name]) => name),
    ['sh_monster_hurt', 'sh_shot'],
  );
});

test('the flashlight finding a monster growls once per room', () => {
  const audio = recordingAudio();
  const game = battleGame();
  game.audio = audio;
  game.enemySoundPlayed = false;
  game.moveCursor(0, 0);
  game.tick();
  game.moveCursor(enemy(game).x, enemy(game).y);
  game.tick();
  game.tick();
  game.tick();
  assert.equal(audio.calls.filter(([, name]) => name === 'sh_monster_hurt').length, 1);
});

test('the first "ls" after loading is skipped, as in the original', () => {
  const audio = recordingAudio();
  const storage = memoryStorage();
  const game = savableGame(storage, { audio });
  game.saveGame(false);
  game.loadGame();
  audio.calls.length = 0;
  game.playSound('ls');
  game.playSound('ls');
  assert.deepEqual(audio.calls, [['play', 'ls', 1]]);
});

test('the game runs with no audio at all', () => {
  const game = savableGame(memoryStorage(), { audio: null });
  game.playSound('lt');
  game.stopSound();
  game.advance();
});

test('there is no cursor before a game starts or after it ends', () => {
  const game = new Game(data, { storage: memoryStorage() });
  assert.equal(game.cursorView(), null);
  game.startNewGame();
  game.tick();
  game.endGameRequested = true;
  game.tick();
  assert.equal(game.cursorView(), null);
});

test('a save restores the room, variables, inventory and action keys', () => {
  const storage = memoryStorage();
  const game = savableGame(storage);
  assert.equal(game.hasSave(), false);
  game.roomInit('2', false);
  settle(game);
  game.setVariable('test_flag', 7);
  game.setInventory('2g', 3);
  assert.equal(game.canSave(), true);
  assert.equal(game.saveGame(), true);
  assert.equal(game.notice.text, game.engineText(80));
  assert.equal(game.hasSave(), true);

  const restored = new Game(data, { now: () => 5000, random: () => 0.5, storage });
  assert.equal(restored.saveKey, game.saveKey);
  assert.equal(restored.hasSave(), true);
  assert.equal(restored.loadGame(), true);
  for (let i = 0; i < 5; i++) restored.tick();
  assert.equal(restored.currentRoomId, '2');
  assert.equal(restored.getRaw('test_flag'), '7');
  assert.equal(restored.inventorySize('2g'), 3);
  assert.equal(restored.inventorySize('invGun'), 1);
  assert.equal(restored.actionKeys.get('actionkey_num1'), '2h');
  assert.equal(restored.ammo, 10);
  assert.deepEqual(restored.menus, []);
  assert.ok(restored.objects.length > 0);
});

test('loading returns to the saved state after progress and after death', () => {
  const storage = memoryStorage();
  const game = savableGame(storage);
  game.saveGame(false);
  assert.equal(game.notice, null);
  game.roomInit('2', false);
  settle(game);
  game.setVariable('later_flag', 1);
  assert.equal(game.loadGame(), true);
  settle(game);
  assert.equal(game.currentRoomId, '0');
  assert.equal(game.getRaw('later_flag'), null);

  game.endGameRequested = true;
  game.advance();
  assert.equal(game.ended, true);
  assert.equal(game.loadGame(), true);
  settle(game);
  assert.equal(game.ended, false);
  assert.equal(game.currentRoomId, '0');
});

test('saving is refused during text, scripts and battles', () => {
  const storage = memoryStorage();
  const game = savableGame(storage);
  assert.equal(game.canSave(), true);
  game.say('Hello', null);
  assert.equal(game.canSave(), false);
  game.menus = [];
  game.pressKey('1');
  game.advance();
  game.advance();
  assert.equal(game.battleMode, true);
  assert.equal(game.canSave(), false);
});

test('rooms that are not save points refuse saving', () => {
  const game = savableGame(memoryStorage());
  game.roomInit('intro', false);
  settle(game);
  game.menus = [];
  game.pausedThread = null;
  game.waitStop = 0;
  assert.equal(game.saveAllowedInRoom, false);
  assert.equal(game.canSave(), false);
});

test('ammo held aside without the gun survives a save', () => {
  const storage = memoryStorage();
  const game = savableGame(storage);
  game.vars.delete('inv-invGun');
  game.advance();
  assert.equal(game.gunState, false);
  assert.equal(game.ammo, 0);
  assert.equal(game.ammoInGun, 10);
  game.saveGame(false);
  const saved = JSON.parse([...storage.items.values()][0]);
  assert.deepEqual(saved.vars.find(([name]) => name === 'sys_ammo').slice(0, 2), ['sys_ammo', '10']);
  assert.equal(game.getRaw('sys_ammo'), '0');

  game.loadGame();
  settle(game);
  assert.equal(game.ammo, 0);
  assert.equal(game.ammoInGun, 10);
  game.setInventory('invGun', 1);
  settle(game);
  assert.equal(game.ammo, 10);
});

test('the story saves by itself at its save command', () => {
  const storage = memoryStorage();
  const game = savableGame(storage);
  game.roomInit('2e', false);
  game.advance();
  game.advance();
  assert.equal(game.hasSave(), true);
  assert.equal(game.notice.text, game.engineText(80));
  assert.equal(game.getRaw('o9'), '1');
});

test('a broken or missing store fails safely', () => {
  const broken = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('full');
    },
  };
  const game = savableGame(broken);
  assert.equal(game.hasSave(), false);
  assert.equal(game.saveGame(), false);
  assert.equal(game.notice.text, game.engineText(118));
  assert.equal(game.loadGame(), false);

  const none = savableGame(null);
  assert.equal(none.hasSave(), false);
  assert.equal(none.saveGame(), false);

  const corrupt = memoryStorage();
  const reader = savableGame(corrupt);
  corrupt.setItem(reader.saveKey, 'not json');
  reader.cachedHasSave = undefined;
  assert.equal(reader.hasSave(), false);
  assert.equal(reader.loadGame(), false);
});

test('the gun can be put away, and runs out of ammo with a message', () => {
  const game = battleGame();
  game.pressKey('1');
  game.advance();
  game.advance();
  for (let i = 0; i < 12; i++) {
    hover(game, 10, 10);
    game.click();
    game.advance();
    for (let tick = 0; tick < 25; tick++) game.advance();
    if (game.menus.length) break;
  }
  assert.equal(game.ammo, 0);
  assert.equal(game.getRaw('sys_ammo'), '0');
  assert.equal(game.menus.at(-1).text, game.engineText(172));
  game.click();
  game.advance();
  game.pressKey('1');
  game.advance();
  game.advance();
  assert.equal(game.getRaw('sys_battleState'), null);
  assert.ok(!['haircross', 'jb'].includes(game.cursorView().id));
});

test('the gun key starts a battle in every room with enemies', () => {
  for (const room of ['r', 'y', '17', '1d', '2a', '2d']) {
    const game = battleGame();
    game.roomInit(room, false);
    game.advance();
    game.advance();
    game.menus = [];
    game.pausedThread = null;
    game.pressKey('1');
    game.advance();
    game.advance();
    assert.equal(game.battleMode, true, room);
    for (let i = 0; i < 100; i++) {
      game.moveCursor(i * 2, i * 2);
      game.click();
      game.advance(100);
      game.menus = [];
      game.pausedThread = null;
      game.drawList();
    }
    assert.deepEqual([...game.unsupportedCommands], [], room);
  }
});

test('the flashlight masks everything outside its circle', () => {
  const game = battleGame();
  hover(game, 100, 100);
  const list = game.drawList();
  const start = list.findIndex((item) => game.cursorAnim.frames.includes(item.id));
  assert.equal(list[start].x, 100);
  assert.deepEqual(
    list.slice(start + 1, start + 5).map((item) => item.kind),
    ['rect', 'rect', 'rect', 'rect'],
  );
  const frame = game.cursorAnim.frame;
  for (let i = 0; i < 5; i++) game.advance();
  assert.notEqual(game.cursorAnim.frame, frame);
});

test('script values convert as the Java engine does', () => {
  assert.equal(toBoolean(null), false);
  assert.equal(toBoolean(0), false);
  assert.equal(toBoolean('0'), false);
  assert.equal(toBoolean('1'), true);
  assert.equal(toBoolean('Ben'), true);
  const game = newGame();
  assert.equal(game.equalsCommand(['1', 1]), 1);
  assert.equal(game.equalsCommand(['abc', 'abd']), 0);
  assert.equal(game.equalsCommand([2, '2']), 1);
  game.setVariable('v', 3);
  assert.equal(game.getRaw('v'), '3');
  game.setVariable('v', 0);
  assert.equal(game.getRaw('v'), null);
});

test('negative integers read as signed, in every width', () => {
  const host = { pausedThread: null, command: () => null };
  const script = new Script(
    't',
    {
      code: Uint8Array.of(0x05, 0xff, 0x45, 0xff, 0xfe, 0x85, 0xff, 0xff, 0xff, 0xfd),
      strings: [],
      gfxId: null,
      events: [],
    },
    () => '',
  );
  const thread = new ScriptThread(script, 0, null, host);
  thread.status = STATUS.RUNNING;
  assert.equal(thread.executeCommand(), -1);
  assert.equal(thread.executeCommand(), -2);
  assert.equal(thread.executeCommand(), -3);
});

test('the port accepts or explains every JAR, from its data alone', async () => {
  const counts = {};
  for (const { id } of allInputs.filter(({ game }) => game === 'sh1' || game === 'sh2')) {
    const { status, reason } = await inspectJar(readInput(id));
    const key = `${id.slice(0, 3)} ${status} ${reason}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  assert.deepEqual(counts, {
    'sh1 ok ok': 88,
    'sh1 warning small-art': 17,
    'sh1 rejected no-ink': 25,
    'sh2 rejected other-game': 61,
    'sh2 rejected no-ink': 8,
    'sh2 rejected damaged': 1,
  });
  assert.equal(buildsOf('sh1').length + buildsOf('sh2').length, 200);
});
