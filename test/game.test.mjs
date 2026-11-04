import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLan, parseScript, walkCode } from '../web/engine/format.mjs';
import { EVENT, Game, MENU, VERB, verbWheelCenter } from '../web/engine/game.mjs';
import { controlsText, gameplayText } from '../web/engine/help-text.mjs';
import { ARCHIVE_JAR, inspectJar, loadGameData, readJar } from '../web/engine/jar.mjs';
import { ScriptThread, Script, STATUS, toBoolean } from '../web/engine/vm.mjs';
import { allInputs, buildsOf, input, readInput, recommended } from '../src/inputs.mjs';

const data = loadGameData(await readJar(readInput(recommended.sh1.gameData)));
const english = parseLan(data.entries.get('sh/lan/en.lan'));
const text = (key) => english[Number.parseInt(key, 36)];

const TUTORIAL_FIRST_LINE = 'Click, or use the buttons under the screen, to interact with menus or message window.';

function newGame() {
  let clock = 1000;
  const game = new Game(data, { now: () => clock, random: () => 0 });
  game.advance = (ms = 60) => {
    clock += ms;
    game.tick();
    // Input waits for a room transition, so these helpers let it finish.
    while (game.transitionCounter !== null) {
      clock += 60;
      game.tick();
    }
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

test('the Internet Archive download is pinned to a build the port accepts', async () => {
  const build = input('sh1-2014-base');
  assert.equal(ARCHIVE_JAR.integrity, `sha256-${Buffer.from(build.sha256, 'hex').toString('base64')}`);
  assert.equal((await inspectJar(readInput(build.id))).status, 'ok');
});

test("help describes the mouse and keyboard in every language, in the JAR's own headings", () => {
  for (const language of ['en', 'fr', 'de', 'it', 'es', 'pt']) {
    const game = new Game(data, { language });
    const controls = controlsText(game);
    assert.doesNotMatch(controls, /JAVA_APP|Num\u00a0|\*|#/, language);
    assert.ok(controls.startsWith(game.engineText(63).split('\n')[0]), language);
    assert.doesNotMatch(
      gameplayText(game).split('\n\n')[0],
      /softkey|Auswahltasten|touches de sélection|tasti funzione|teclas de/i,
      language,
    );
    assert.equal(gameplayText(game).split('\n\n')[1], game.engineText(61).split('\n\n')[1], language);
    assert.equal(game.gameTexts[Number.parseInt('j4', 36)], gameplayText(game).split('\n\n')[0], language);
  }
});

test('a fan translation keeps its own help text rather than mixing in another language', async () => {
  const game = new Game(loadGameData(await readJar(readInput('sh1-2007-a'))), { language: 'en' });
  assert.match(game.engineText(61), /Нажмите/);
  assert.equal(gameplayText(game), game.engineText(61));
  assert.match(controlsText(game), /Num\u00a02/);
  assert.doesNotMatch(controlsText(game), /<JAVA/);
});

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
  assert.equal(game.menus.at(-1).text, TUTORIAL_FIRST_LINE);
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

test('long text moves on by a box per click, and only then does the script resume', () => {
  const game = newGame();
  game.advance();
  const menu = game.menus.at(-1);
  Object.assign(menu, { maxScroll: 6, pageLines: 4 });
  for (const scroll of [4, 6]) {
    game.click();
    game.advance();
    assert.equal(menu.scroll, scroll);
    assert.equal(game.getRaw('ql'), null);
  }
  game.click();
  game.advance();
  assert.equal(game.getRaw('ql'), '1');
});

test('long text scrolls by line within its limits, and Enter continues it', () => {
  const game = newGame();
  game.advance();
  const menu = game.menus.at(-1);
  Object.assign(menu, { maxScroll: 2, pageLines: 4 });
  game.pressKey('ArrowUp');
  game.advance();
  assert.equal(menu.scroll, 0);
  game.pressKey('ArrowDown');
  game.pressKey('ArrowDown');
  game.pressKey('ArrowDown');
  game.advance();
  assert.equal(menu.scroll, 2);
  game.pressKey('ArrowUp');
  game.advance();
  assert.equal(menu.scroll, 1);
  assert.equal(game.menus.at(-1), menu);
  game.pressKey('Enter');
  game.advance();
  assert.equal(menu.scroll, 2);
  game.pressKey('Enter');
  game.advance();
  assert.equal(game.getRaw('ql'), '1');
});

test('the toboggan note leaves off the line break at its end', () => {
  const game = newGame();
  assert.ok(game.gameText('56').endsWith('the fee.\n'));
  game.say(game.gameText('56'), null);
  assert.ok(game.menus.at(-1).text.endsWith('the fee.'));
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

// Opens the inventory from the wheel on a hotspot, as a player would.
function openBackpack(game) {
  hover(game, 230, 120);
  game.click();
  game.advance();
  chooseVerb(game, VERB.INVENTORY);
  const inventory = game.menus.at(-1);
  assert.equal(inventory.id, MENU.INVENTORY);
  return inventory;
}

test('the inventory shows one item, with what can be done with it', () => {
  const game = newGame();
  playTo(game, '0');
  game.setInventory('invMap', 1);
  const page = openBackpack(game);
  assert.equal(page.items[0], 'invMap');
  assert.deepEqual(page.items.slice().sort(), ['2j', 'invGun', 'invMap']);
  assert.equal(page.index, 0);
  assert.equal(page.title, 'Map');
  assert.equal(page.image, 'gz');
  assert.deepEqual(
    page.choices.map(({ text }) => text),
    ['Use', 'Look at', 'Back'],
  );
  assert.equal(page.selected, 0);
});

test('the arrows move between items, and wrap around', () => {
  const game = newGame();
  playTo(game, '0');
  game.setInventory('invMap', 1);
  const page = openBackpack(game);
  const shown = () => game.menus.at(-1).items[game.menus.at(-1).index];
  const first = shown();
  game.pressKey('ArrowRight');
  game.advance();
  assert.notEqual(shown(), first);
  assert.equal(game.itemId, shown());
  game.pressKey('ArrowLeft');
  game.advance();
  assert.equal(shown(), first);
  game.pressKey('ArrowLeft');
  game.advance();
  assert.equal(game.menus.at(-1).index, page.items.length - 1);
  game.menus.at(-1).hoveredArrow = 1;
  game.click();
  game.advance();
  assert.equal(game.menus.at(-1).index, 0);
});

test('the page stays in place while moving between items', () => {
  const game = newGame();
  playTo(game, '0');
  const page = openBackpack(game);
  const { x, y } = page;
  game.moveCursor(10, 10);
  game.pressKey('ArrowRight');
  game.advance();
  assert.notEqual(game.menus.at(-1), page);
  assert.deepEqual([game.menus.at(-1).x, game.menus.at(-1).y], [x, y]);
});

test('a single item has nowhere to move to', () => {
  const game = newGame();
  playTo(game, '0');
  game.vars.delete('inv-2j');
  const page = openBackpack(game);
  assert.equal(page.items.length, 1);
  game.pressKey('ArrowRight');
  game.advance();
  assert.equal(game.menus.at(-1), page);
});

test('the up and down keys choose an action, and Enter does it', () => {
  const game = newGame();
  playTo(game, '0');
  game.setInventory('invMap', 1);
  game.setVariable('m6', 1);
  const page = openBackpack(game);
  game.pressKey('ArrowUp');
  game.advance();
  assert.equal(page.choices[page.selected].text, 'Back');
  game.pressKey('ArrowDown');
  game.pressKey('ArrowDown');
  game.advance();
  assert.equal(page.choices[page.selected].text, 'Look at');
  game.pressKey('Enter');
  game.advance();
  assert.equal(game.menus.at(-1).id, MENU.SAY);
  game.click();
  game.advance();
  assert.equal(game.menus.at(-1), page);
});

test('Use tries the item on the hotspot, and Back returns to the wheel', () => {
  const game = newGame();
  playTo(game, '0');
  game.setInventory('invMap', 1);
  const page = openBackpack(game);
  page.hovered = page.choices.findIndex(({ text }) => text === 'Use');
  game.click();
  game.advance();
  assert.equal(game.menus.at(-1).id, MENU.SAY);
  assert.equal(game.menus.at(-1).text, game.useItemText);
  game.click();
  game.advance();
  assert.equal(game.menus.at(-1), page);
  page.hovered = page.choices.findIndex(({ text }) => text === 'Back');
  game.click();
  game.advance();
  assert.equal(game.menus.at(-1).id, MENU.VERBS);
});

test('clicking off the page closes it, but clicking blank parts of it does not', () => {
  const game = newGame();
  playTo(game, '0');
  const page = openBackpack(game);
  page.hovered = null;
  page.overPage = true;
  game.click();
  game.advance();
  assert.equal(game.menus.at(-1), page);
  page.overPage = false;
  game.click();
  game.advance();
  assert.equal(game.menus.at(-1).id, MENU.VERBS);
});

test('the inventory key opens it away from any hotspot, where nothing can be used', () => {
  const game = newGame();
  playTo(game, '0');
  hover(game, 128, 20);
  assert.equal(game.overObject, null);
  game.pressKey('inventory');
  game.advance();
  const page = game.menus.at(-1);
  assert.equal(page.id, MENU.INVENTORY);
  assert.ok(!page.choices.some(({ text }) => text === 'Use'));
  assert.ok(page.choices.some(({ text }) => text === 'Back'));
});

test('items can be equipped from the inventory', () => {
  const game = newGame();
  playTo(game, '0');
  game.setVariable('m6', 1);
  const page = openBackpack(game);
  const gun = page.items.indexOf('invGun');
  game.menus[game.menus.length - 1] = game.inventoryPage(page.items, gun);
  assert.ok(game.menus.at(-1).choices.some(({ text }) => text === 'Look at'));
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
    // Input waits for a room transition, so these helpers let it finish.
    while (game.transitionCounter !== null) {
      clock += 60;
      game.tick();
    }
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
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
    items,
  };
}

// A new game on `storage`, skipped to the first room.
function savableGame(storage, options = {}) {
  let clock = 1000;
  const game = new Game(data, { now: () => clock, random: () => 0.5, storage, ...options });
  game.advance = (ms = 60) => {
    clock += ms;
    game.tick();
    // Input waits for a room transition, so these helpers let it finish.
    while (game.transitionCounter !== null) {
      clock += 60;
      game.tick();
    }
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
  return {
    calls,
    enabled: true,
    play: (name, loops) => calls.push(['play', name, loops]),
    stop: () => calls.push(['stop']),
    setEnabled(enabled) {
      this.enabled = enabled;
    },
  };
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

test('each speaker has their color, and others use the normal text color', () => {
  const game = savableGame(memoryStorage());
  assert.equal(game.speakerColor(game.engineText(154)), 0x1c0e70);
  assert.equal(game.speakerColor('Ben'), 0x1c0e70);
  assert.equal(game.speakerColor(game.engineText(155)), 0xa30c0c);
  assert.equal(game.speakerColor(game.engineText(156)), 0xa20b8a);
  assert.equal(game.speakerColor('Someone else'), game.menuTextColor);
  assert.equal(game.speakerColor(null), game.menuTextColor);
});

test("the setup script sets the text box's spacing and colors", () => {
  const game = savableGame(memoryStorage());
  assert.equal(game.menuColor, 15393458);
  assert.equal(game.menuSelectedColor, 8156258);
  assert.equal(game.menuMargin, 6);
  assert.equal(game.menuLineSpacing, 2);
});

test('soft keys show what they do in each situation', () => {
  const game = savableGame(memoryStorage());
  const labels = () => {
    const { left, right } = game.softKeys();
    return [left?.label ?? null, right?.label ?? null];
  };
  assert.deepEqual(labels(), [null, 'Menu']);
  game.setInventory('invMap', 1);
  assert.deepEqual(labels(), ['Map', 'Menu']);
  game.say('Hello', null);
  assert.deepEqual(labels(), ['OK', null]);
  game.menus = [{ id: MENU.VERBS, options: [], x: 0, y: 0 }];
  assert.deepEqual(labels(), ['Select', 'Back']);
  game.menus = [];
  game.roomInit('clockPuzzle', false);
  settle(game);
  assert.deepEqual(labels(), ['Back', 'Menu']);
  game.roomInit('control', false);
  settle(game);
  assert.deepEqual(labels(), ['Next', 'Skip']);
  game.endGameRequested = true;
  game.advance();
  assert.deepEqual(labels(), ['Select', null]);
});

test('the map key offers the floors, and Back leaves them', () => {
  const game = savableGame(memoryStorage());
  game.setInventory('invMap', 1);
  game.setVariable('m6', 0);
  assert.equal(game.pressSoftKey('left'), true);
  game.advance();
  const choices = game.menus.at(-1);
  assert.equal(choices.id, MENU.CHOICE);
  assert.equal(choices.choices.length, 3);
  choices.hovered = choices.choices.findIndex(({ id }) => id === 1);
  game.click();
  game.advance();
  settle(game);
  assert.equal(game.currentRoomId, 'floor1');
  assert.equal(game.softKeys().right.label, 'Back');
  assert.equal(game.pressSoftKey('right'), true);
  settle(game);
  assert.equal(game.currentRoomId, '0');
});

test("Esc goes back from a puzzle, using the room's own back hotspot", () => {
  const game = savableGame(memoryStorage());
  game.roomInit('2', false);
  settle(game);
  game.roomInit('clockPuzzle', true);
  settle(game);
  assert.equal(game.currentRoomId, 'clockPuzzle');
  game.pressKey('Escape');
  settle(game);
  assert.notEqual(game.currentRoomId, 'clockPuzzle');
});

test('a soft key with no action does nothing', () => {
  const game = savableGame(memoryStorage());
  assert.equal(game.pressSoftKey('left'), false);
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
  assert.deepEqual(game.popups, [game.engineText(80)]);
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
  assert.deepEqual(game.popups, []);
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
  assert.deepEqual(game.popups, [game.engineText(80)]);
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
  assert.deepEqual(game.popups, [game.engineText(118)]);
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

// A game on the startup screens, with a clock the test moves.
function startupGame(options = {}) {
  let clock = 1000;
  const game = new Game(data, {
    now: () => clock,
    random: () => 0.5,
    storage: memoryStorage(),
    audio: recordingAudio(),
    ...options,
  });
  game.advance = (ms = 60) => {
    clock += ms;
    game.tick();
    // Input waits for a room transition, so these helpers let it finish.
    while (game.transitionCounter !== null) {
      clock += 60;
      game.tick();
    }
  };
  game.showStartup();
  return game;
}

const menuTexts = (game) => game.mainMenu.current.choices.map(({ text }) => text);

function choose(game, text) {
  const menu = game.mainMenu.current;
  menu.hovered = menu.choices.findIndex((choice) => choice.text === text);
  assert.notEqual(menu.hovered, -1, text);
  game.click();
  game.advance();
}

// Past the logo, the questions and the splash screen, to the main menu.
function toMainMenu(game) {
  for (let i = 0; i < 6; i++) game.advance(1000);
  if (game.mainMenu.current.kind === 'language') choose(game, 'English');
  choose(game, 'Continue');
  game.advance(3001);
  assert.equal(game.mainMenu.current.kind, 'main');
}

function savedStorage() {
  const storage = memoryStorage();
  assert.equal(savableGame(storage).saveGame(), true);
  return storage;
}

test('the logo fades in over four steps, then holds for a second', () => {
  const game = startupGame();
  const { screen } = game.mainMenu;
  assert.equal(screen.kind, 'logo');
  assert.equal(screen.alpha, 0);
  for (const alpha of [63, 127, 191, 255]) {
    game.advance(166);
    assert.notEqual(screen.alpha, alpha);
    game.advance(1);
    assert.equal(screen.alpha, alpha);
  }
  game.advance(999);
  assert.equal(game.mainMenu.screen.kind, 'logo');
  game.advance(1);
  assert.equal(game.mainMenu.screen, null);
});

test('the first run asks for a language, from the ones in the JAR', () => {
  const game = startupGame();
  for (let i = 0; i < 6; i++) game.advance(1000);
  assert.deepEqual(game.languages, ['en', 'fr', 'de', 'it', 'es', 'pt']);
  assert.deepEqual(menuTexts(game), ['English', 'Français', 'Deutsch', 'Italiano', 'Español', 'Português']);
  assert.equal(game.softKeys().right, null);
  choose(game, 'Français');
  assert.equal(game.language, 'fr');
  assert.equal(game.storage.getItem('silent-hill-mobile:language'), 'fr');
  assert.equal(game.mainMenu.current.kind, 'sound');
  assert.equal(game.gameText(0), parseLan(data.entries.get('sh/lan/fr.lan'))[0]);
});

test('a chosen language is remembered, and goes straight to the sound question', () => {
  const storage = memoryStorage();
  storage.setItem('silent-hill-mobile:language', 'de');
  const game = startupGame({ storage });
  for (let i = 0; i < 6; i++) game.advance(1000);
  assert.equal(game.language, 'de');
  assert.equal(game.mainMenu.current.kind, 'sound');
  assert.equal(game.engineText(14), 'Spielen');
});

test('the sound question plays the shot when sound goes on, and the splash plays the music', () => {
  const audio = recordingAudio();
  const storage = memoryStorage();
  storage.setItem('silent-hill-mobile:language', 'en');
  const game = startupGame({ audio, storage });
  for (let i = 0; i < 6; i++) game.advance(1000);
  assert.deepEqual(menuTexts(game), ['Sound: On', 'Continue']);
  assert.deepEqual(game.mainMenu.current.choices[0].values, ['Sound: On', 'Sound: Off']);
  assert.equal(game.softKeys().left.label, 'Change');
  choose(game, 'Sound: On');
  assert.equal(audio.enabled, false);
  assert.deepEqual(menuTexts(game), ['Sound: Off', 'Continue']);
  choose(game, 'Sound: Off');
  assert.equal(audio.enabled, true);
  assert.deepEqual(audio.calls.at(-1), ['play', 'sh_shot', 1]);

  choose(game, 'Continue');
  assert.deepEqual(audio.calls.at(-1), ['play', 'sh_bgmusic', 1]);
  const { screen } = game.mainMenu;
  assert.deepEqual([screen.kind, screen.image, screen.color], ['splash', 'gfx/splash.png', 0]);
  game.click();
  game.advance(1000);
  assert.equal(game.mainMenu.screen.kind, 'splash');
  game.advance(2001);
  assert.equal(game.mainMenu.current.kind, 'main');
  assert.notDeepEqual(audio.calls.at(-1), ['stop']);
});

test('Play starts a new game when there is no save', () => {
  const game = startupGame();
  toMainMenu(game);
  assert.deepEqual(menuTexts(game), ['Play', 'Settings', 'Help', 'About']);
  choose(game, 'Play');
  assert.equal(game.mainMenu, null);
  game.advance();
  game.advance();
  assert.equal(game.currentRoomId, 'control');
});

test('Play offers the saved game, and a new game removes it only after a warning', () => {
  const storage = savedStorage();
  const game = startupGame({ storage });
  toMainMenu(game);
  choose(game, 'Play');
  assert.deepEqual(menuTexts(game), ['Saved game', 'New game']);
  choose(game, 'New game');
  assert.equal(game.mainMenu.current.title, game.engineText(119));
  assert.equal(game.mainMenu.current.choices[game.mainMenu.current.selected].text, 'No');
  choose(game, 'No');
  assert.deepEqual(menuTexts(game), ['Saved game', 'New game']);
  assert.equal(game.hasSave(), true);
  choose(game, 'New game');
  choose(game, 'Yes');
  assert.equal(game.mainMenu, null);
  assert.equal(game.hasSave(), false);
  assert.equal(game.readSave(), null);
});

test('Saved game loads the save', () => {
  const game = startupGame({ storage: savedStorage() });
  toMainMenu(game);
  choose(game, 'Play');
  choose(game, 'Saved game');
  assert.equal(game.mainMenu, null);
  settle(game);
  assert.equal(game.currentRoomId, '0');
});

test('a save from when each language had its own is still found, and in any language', () => {
  const storage = savedStorage();
  const game = new Game(data, { storage, language: 'fr' });
  const [[, save]] = storage.items.entries().filter(([key]) => key === game.saveKey);
  storage.items.delete(game.saveKey);
  storage.setItem(game.saveKey.replace('sh:', 'sh:en:'), save);
  assert.equal(game.hasSave(), true);
  game.removeSave();
  assert.equal(game.hasSave(), false);
  assert.equal(game.readSave(), null);
});

test('Settings changes sound and language, in place, and arrow keys move the highlight', () => {
  const game = startupGame();
  toMainMenu(game);
  game.pressKey('ArrowDown');
  game.advance();
  assert.equal(game.mainMenu.current.selected, 1);
  for (const expected of [0, 3, 2, 1]) {
    game.pressKey('ArrowUp');
    game.advance();
    assert.equal(game.mainMenu.current.selected, expected);
  }
  game.pressKey('Enter');
  game.advance();
  assert.deepEqual(menuTexts(game), ['Sound: On', 'Language: English']);
  assert.deepEqual(game.mainMenu.current.choices[1].values, [
    'Language: English',
    'Langue : Français',
    'Sprache: Deutsch',
    'Lingua: Italiano',
    'Idioma: Español',
    'Idioma: Português',
  ]);

  game.pressKey('ArrowDown');
  game.advance();
  choose(game, 'Language: English');
  assert.equal(game.language, 'fr');
  assert.deepEqual(menuTexts(game), [
    `${game.engineText(19)} ${game.engineText(21)}`,
    `${game.engineText(0)} Français`,
  ]);
  assert.equal(game.mainMenu.current.selected, 1);
  game.pressKey('ArrowLeft');
  game.advance();
  assert.equal(game.language, 'en');
  game.pressKey('ArrowLeft');
  game.advance();
  assert.equal(game.language, 'pt');
  game.pressKey('Escape');
  game.advance();
  assert.equal(game.mainMenu.current.kind, 'main');
  assert.equal(menuTexts(game)[0], game.engineText(14));
  game.pressKey('Escape');
  game.advance();
  assert.equal(game.mainMenu.current.kind, 'main');
});

test('Help describes the web controls with the original headings, and About shows the original text', () => {
  const game = startupGame();
  toMainMenu(game);
  choose(game, 'Help');
  assert.deepEqual(menuTexts(game), ['Gameplay', 'Controls']);
  choose(game, 'Gameplay');
  const gameplay = game.mainMenu.current;
  assert.match(
    gameplay.text,
    /^Click, or use the buttons under the screen, to interact with menus or message window\.\n\nThe eye/,
  );
  assert.match(gameplay.text, /equip and unequip pressing key\s1\./);
  assert.equal(game.softKeys().right.label, 'Back');
  game.pressKey('Escape');
  game.advance();
  choose(game, 'Controls');
  const controls = game.mainMenu.current.text;
  assert.doesNotMatch(controls, /<JAVA|\\n/);
  assert.match(controls, /^Move cursor \(or crosshair\):\nMouse\n/);
  assert.match(controls, /Close context menu:\nRight click \/ Esc\n/);
  assert.match(controls, /Walk:\nW \/ A \/ S \/ D \/ Arrow keys/);
  assert.match(controls, /Equip \/ Unequip weapon:\n1\n/);
  assert.match(controls, /Open Map:\nM \(only after you acquire the map\)/);
  assert.match(controls, /Open Inventory:\nI \(only if no other menus are open\)/);
  assert.match(controls, /Use first aid kit by pressing key\s3\.$/);
  game.pressKey('Escape');
  game.advance();
  game.pressKey('Escape');
  game.advance();
  choose(game, 'About');
  const about = game.mainMenu.current.text;
  assert.match(about, /Name: Silent Hill\nVersion: 0\.1\.0\nVendor: Konami/);
  assert.match(about, /Made with INK Technology\.$/);
});

test('a text page scrolls by line and by page, within its limits', () => {
  const game = startupGame();
  toMainMenu(game);
  choose(game, 'About');
  const page = game.mainMenu.current;
  page.maxScroll = 30;
  page.pageLines = 16;
  game.pressKey('ArrowUp');
  game.advance();
  assert.equal(page.scroll, 0);
  game.pressKey('ArrowDown');
  game.advance();
  assert.equal(page.scroll, 1);
  page.hoveredArrow = 1;
  game.click();
  game.advance();
  assert.equal(page.scroll, 17);
  game.click();
  game.advance();
  assert.equal(page.scroll, 30);
  page.hoveredArrow = -1;
  game.click();
  game.advance();
  assert.equal(page.scroll, 14);
});

test('Esc opens the pause menu in a room, and pauses nothing else', () => {
  const game = savableGame(memoryStorage());
  assert.equal(game.softKeys().right.action, 'pause');
  game.pressKey('Escape');
  game.advance();
  const menu = game.menus.at(-1);
  assert.equal(menu.id, MENU.PAUSE);
  assert.deepEqual(
    menu.choices.map(({ text }) => text),
    ['Continue', 'Save', 'Settings', 'Help', 'Main menu'],
  );
  assert.deepEqual([game.softKeys().left.label, game.softKeys().right.label], ['Select', 'Back']);
  game.pressKey('Escape');
  game.advance();
  assert.equal(game.menus.length, 0);

  game.roomInit('control', false);
  settle(game);
  game.menus = [];
  game.pausedThread = null;
  game.hideCursor = true;
  game.pressKey('Escape');
  game.advance();
  assert.equal(game.menus.at(-1)?.id, undefined);
});

function pauseChoice(game, text) {
  const menu = game.menus.at(-1);
  menu.hovered = menu.choices.findIndex((choice) => choice.text === text);
  assert.notEqual(menu.hovered, -1, text);
  game.click();
  game.advance();
}

test('the pause menu continues, saves, and changes sound', () => {
  const audio = recordingAudio();
  const game = savableGame(memoryStorage(), { audio });
  const open = () => {
    game.pressSoftKey('right');
    game.advance();
  };
  open();
  pauseChoice(game, 'Continue');
  assert.equal(game.menus.length, 0);
  open();
  pauseChoice(game, 'Save');
  assert.equal(game.menus.length, 0);
  assert.equal(game.hasSave(), true);
  assert.deepEqual(game.popups, [game.engineText(80)]);
  game.click();
  game.advance();
  open();
  pauseChoice(game, 'Settings');
  pauseChoice(game, 'Sound: On');
  assert.equal(audio.enabled, false);
  assert.deepEqual(
    game.menus.at(-1).choices.map(({ text }) => text),
    ['Sound: Off'],
  );
});

test('the pause menu shows help, and Esc returns from it', () => {
  const game = savableGame(memoryStorage());
  game.pressKey('Escape');
  game.advance();
  pauseChoice(game, 'Help');
  pauseChoice(game, 'Controls');
  const help = game.menus.at(-1);
  assert.equal(help.id, MENU.SAY);
  assert.match(help.text, /^Move cursor/);
  game.pressKey('Escape');
  game.advance();
  assert.equal(game.menus.at(-1).id, MENU.PAUSE);
  assert.deepEqual(
    game.menus.at(-1).choices.map(({ text }) => text),
    ['Gameplay', 'Controls'],
  );
});

test('leaving for the main menu asks first, and a new game afterwards starts clean', () => {
  const game = savableGame(memoryStorage());
  game.roomInit('2', false);
  settle(game);
  game.pressKey('Escape');
  game.advance();
  pauseChoice(game, 'Main menu');
  assert.equal(game.menus.at(-1).title, game.engineText(81));
  assert.equal(game.menus.at(-1).choices[game.menus.at(-1).selected].text, 'No');
  pauseChoice(game, 'No');
  assert.equal(game.menus.at(-1).choices.at(-1).text, 'Main menu');
  pauseChoice(game, 'Main menu');
  pauseChoice(game, 'Yes');
  assert.equal(game.mainMenu.current.kind, 'main');
  assert.equal(game.objects, null);
  assert.deepEqual(game.audio, null);
  choose(game, 'Play');
  game.advance();
  game.advance();
  assert.equal(game.currentRoomId, 'control');
  assert.equal(game.menus.at(-1).text, TUTORIAL_FIRST_LINE);
});

test('a battle stops while paused, and offers no save', () => {
  const game = battleGame();
  game.pressKey('1');
  game.advance();
  game.advance();
  assert.equal(game.battleMode, true);
  game.pressKey('Escape');
  game.advance();
  assert.equal(game.menus.at(-1).id, MENU.PAUSE);
  assert.ok(!game.menus.at(-1).choices.some(({ id }) => id === 'save'));
  const paused = game.enemyStateTime;
  for (let i = 0; i < 20; i++) game.advance();
  assert.equal(game.enemyStateTime, paused);
  game.pressKey('Escape');
  game.advance();
  game.advance();
  assert.notEqual(game.enemyStateTime, paused);
});

test('a plus in the text files is a space that lines do not break at', () => {
  const game = new Game(data, { language: 'fr' });
  assert.equal(
    game.engineText(81),
    'Voulez-vous quitter cette partie\u00a0? Les données non sauvegardées seront perdues.',
  );
  assert.ok(!game.gameTexts.some((line) => line.includes('+')));
  assert.ok(game.gameTexts.some((line) => line.includes('\u00a0!')));
});

test('the builds the port accepts offer the languages they have files for', async () => {
  const counts = new Map();
  for (const { id } of buildsOf('sh1')) {
    const inspection = await inspectJar(readInput(id));
    if (inspection.status === 'rejected') continue;
    const { languages } = new Game(inspection.data, { roomSize: inspection.roomSize });
    counts.set(languages.join(), (counts.get(languages.join()) ?? 0) + 1);
  }
  assert.deepEqual(Object.fromEntries(counts), { 'en,fr,de,it,es,pt': 94, 'en,fr': 4, en: 7 });
});

// A game standing in `room`, with the room's opening text and scripts out of the way.
function standIn(game, room) {
  game.menus = [];
  game.pausedThread = null;
  game.waitStop = 0;
  game.pendingRoom = null;
  game.roomInit(room, false);
  for (let i = 0; i < 3; i++) {
    game.advance();
    game.menus = [];
    game.pausedThread = null;
    game.waitStop = 0;
  }
  assert.equal(game.currentRoomId, room);
}

test('a movement key takes the exit in that direction, nearest the cursor if there are two', () => {
  const game = savableGame(memoryStorage());
  for (const [x, room] of [
    [100, 'c'],
    [160, 'd'],
  ]) {
    standIn(game, 'a');
    game.moveCursor(x, 20);
    game.pressKey('move-forward');
    game.advance();
    assert.equal(game.currentRoomId, room);
  }
  standIn(game, 'a');
  game.pressKey('move-back');
  game.advance();
  assert.equal(game.currentRoomId, '9');
});

test('a movement key does nothing without an exit, over a menu or with the cursor hidden', () => {
  const game = savableGame(memoryStorage());
  standIn(game, 'a');
  game.pressKey('move-left');
  game.advance();
  assert.equal(game.currentRoomId, 'a');
  game.say('Hello', null);
  game.pressKey('move-back');
  game.advance();
  assert.equal(game.currentRoomId, 'a');
  game.menus = [];
  game.hideCursor = true;
  game.pressKey('move-back');
  game.advance();
  assert.equal(game.currentRoomId, 'a');
});

test('a movement key does nothing during a battle', () => {
  const game = battleGame();
  game.pressKey('1');
  game.advance();
  game.advance();
  assert.equal(game.battleMode, true);
  game.pressKey('move-back');
  game.advance();
  game.advance();
  assert.equal(game.currentRoomId, 'r');
});

test('rooms have at most two directions, and only two have two exits in one direction', () => {
  const game = savableGame(memoryStorage());
  const rooms = [...data.entries.keys()]
    .filter((name) => name.startsWith('sh/rom/'))
    .map((name) => name.slice('sh/rom/'.length).replace(/\.[^.]*$/, ''));
  assert.equal(rooms.length, 112);
  let loaded = 0;
  let withExits = 0;
  const repeated = [];
  for (const room of rooms) {
    try {
      standIn(game, room);
    } catch {
      continue;
    }
    loaded++;
    const directions = (game.objects ?? [])
      .map((object) => object.executeEvent(EVENT.GETMOVEDIR, null))
      .filter((direction) => typeof direction === 'string');
    const distinct = new Set(directions);
    assert.ok(distinct.size <= 2, room);
    if (directions.length) withExits++;
    if (distinct.size < directions.length) repeated.push(room);
  }
  assert.equal(loaded, 110);
  assert.equal(withExits, 92);
  assert.deepEqual(repeated.sort(), ['10', 'a']);
});

test('the floor list marks the current floor, which stairs change', () => {
  const game = savableGame(memoryStorage());
  game.setInventory('invMap', 1);
  game.setVariable('m6', 0);
  game.showMap();
  assert.deepEqual(
    game.menus.at(-1).choices.map((choice) => choice.text),
    ['Floor 2', 'Floor 1', 'Basement'],
  );
  assert.equal(game.currentFloorRow(), 1);
  for (const [x, row] of [
    [100, 2],
    [160, 0],
  ]) {
    standIn(game, 'a');
    game.moveCursor(x, 20);
    game.pressKey('move-forward');
    game.advance();
    assert.equal(game.currentFloorRow(), row);
  }
});

test('the map is the only script that offers choices', () => {
  const offering = [...data.entries]
    .filter(([name]) => name.startsWith('sh/scr/'))
    .filter(([, bytes]) => {
      let found = false;
      walkCode(parseScript(bytes), (op) => {
        if (op === 24) found = true;
      });
      return found;
    });
  assert.deepEqual(
    offering.map(([name]) => name),
    ['sh/scr/invMap.bin'],
  );
});

test('a save popup holds up all input until it is answered', () => {
  const game = savableGame(memoryStorage());
  game.setInventory('2g', 1);
  game.moveCursor(100, 100);
  game.advance();
  const cursor = game.cursorView();
  assert.ok(cursor);
  assert.equal(game.saveGame(), true);

  assert.equal(game.cursorView(), null);
  assert.equal(game.canSave(), false);
  assert.deepEqual([game.softKeys().left.label, game.softKeys().right], ['OK', undefined]);
  const time = game.tickTime;
  for (const key of ['Escape', 'pause', 'inventory', 'map', 'move-back', 'ArrowUp', '1']) {
    game.pressKey(key);
    game.advance();
    assert.deepEqual(
      [game.menus.length, game.popups.length, game.pendingRoom, game.currentRoomId],
      [0, 1, null, '0'],
      key,
    );
  }
  assert.notEqual(game.getRaw('sys_battleState'), '2');
  assert.equal(game.tickTime, time);

  game.pressSoftKey('left');
  game.advance();
  assert.deepEqual(game.popups, []);
  assert.ok(game.cursorView());
  assert.equal(game.canSave(), true);
  game.advance();
  assert.equal(game.tickTime, time + 60);
  game.pressKey('Escape');
  game.advance();
  assert.equal(game.menus.at(-1).id, MENU.PAUSE);
});

test('a click or Enter answers a popup, and that click does nothing else', () => {
  const game = savableGame(memoryStorage());
  game.roomInit('a', false);
  settle(game);
  game.moveCursor(100, 150);
  game.advance();
  game.popupCreate('Hello');
  game.click();
  game.advance();
  assert.deepEqual([game.popups, game.currentRoomId, game.pendingRoom], [[], 'a', null]);
  game.popupCreate('Hello');
  game.pressKey('Enter');
  game.advance();
  assert.deepEqual(game.popups, []);
});

test('popups queue, up to four, and the next waits half a second', () => {
  const game = savableGame(memoryStorage());
  for (const text of ['1', '2', '3', '4', '5']) game.popupCreate(text);
  assert.deepEqual(game.popups, ['1', '2', '3', '4']);
  game.click();
  game.advance();
  assert.deepEqual(game.popups, ['2', '3', '4']);
  game.click();
  game.advance();
  assert.deepEqual(game.popups, ['2', '3', '4']);
  game.advance(500);
  game.click();
  game.advance();
  assert.deepEqual(game.popups, ['3', '4']);
});

test('scripts show their popup messages the same way, and keep running', () => {
  const game = savableGame(memoryStorage());
  game.setSystemVar(['s_popupMes', 'Hello']);
  assert.deepEqual(game.popups, ['Hello']);
  assert.equal(game.menus.length, 0);
  game.setVariable('flag', 1);
  assert.equal(game.getRaw('flag'), '1');
});

test('a popup does not outlive the game it came from', () => {
  const game = savableGame(memoryStorage());
  game.popupCreate('Hello');
  game.endGameRequested = true;
  game.advance();
  assert.deepEqual(game.popups, []);
  assert.equal(game.mainMenu.current.kind, 'main');
});

// A game in `room` whose clock and ticks the test moves itself, to see a transition's frames.
function transitionGame(room) {
  const game = savableGame(memoryStorage());
  standIn(game, room);
  let clock = 2000000;
  game.now = () => clock;
  game.step = () => {
    clock += 60;
    game.tick();
  };
  return game;
}

const transitionKinds = (game) => game.transitionItems().map((item) => (item.kind === 'rect' ? item.color : item.kind));

test('the setup script turns on room transitions, in black', () => {
  const game = savableGame(memoryStorage());
  assert.deepEqual([game.transitionsEnabled, game.transitionColor], [true, 0]);
});

test('a room change shows the pattern over the old room, black, then the pattern over the new room', () => {
  const game = transitionGame('a');
  game.moveCursor(100, 20);
  game.pressKey('move-forward');
  game.step();
  assert.equal(game.currentRoomId, 'c');
  assert.equal(game.transitionKeepsOldRoom, true);

  const frames = [];
  for (let i = 0; i < 5; i++) {
    game.step();
    assert.equal(game.transitionKeepsOldRoom, false);
    frames.push(transitionKinds(game));
  }
  assert.deepEqual(frames, [[0], [0], [0], ['dissolve-pattern'], ['dissolve-pattern']]);
  game.step();
  assert.equal(game.transitionCounter, null);
  assert.deepEqual(transitionKinds(game), []);
  assert.ok(!game.drawList().some((item) => item.kind === 'dissolve-pattern'));
});

test('input waits for a room transition to finish', () => {
  const game = transitionGame('a');
  game.moveCursor(100, 20);
  game.pressKey('move-forward');
  game.step();
  for (let i = 0; i < 5; i++) {
    game.pressKey('Escape');
    game.step();
    assert.equal(game.menus.at(-1)?.id === MENU.PAUSE, false);
  }
  game.step();
  game.pressKey('Escape');
  game.step();
  assert.equal(game.menus.at(-1).id, MENU.PAUSE);
});

test('only a room change that asks for it gets a transition', () => {
  const game = transitionGame('a');
  game.roomInit('c', false);
  game.step();
  assert.equal(game.currentRoomId, 'c');
  assert.equal(game.transitionCounter, null);
});

test('hints show until a script turns them off, and stay off after loading', () => {
  const storage = memoryStorage();
  const game = savableGame(storage);
  standIn(game, 'a');
  const hint = () => {
    game.moveCursor(100, 150);
    game.advance();
    return game.cursorView();
  };
  assert.deepEqual([hint().id, hint().hint], ['cursorForward', game.engineText(150)]);
  game.setSystemVar(['s_cursorHintDisable', 1]);
  assert.deepEqual([hint().id, hint().hint], ['cursorForward', null]);

  game.roomInit('0', false);
  settle(game);
  assert.equal(game.saveGame(false), true);
  const loaded = new Game(data, { now: () => 5000, random: () => 0.5, storage });
  assert.equal(loaded.loadGame(), true);
  assert.equal(toBoolean(loaded.getRaw('s_cursorHintDisable')), true);
  game.startNewGame();
  assert.equal(game.getRaw('s_cursorHintDisable'), null);
});

test('the final boss locks input once dead, and the ending runs by itself to the main menu', () => {
  let clock = 1000;
  const game = new Game(data, { now: () => clock, random: () => 0.5 });
  const step = (ms = 60) => {
    clock += ms;
    game.tick();
  };
  game.startNewGame();
  step();
  step();
  game.menus = [];
  game.pausedThread = null;
  game.waitStop = 0;
  game.setInventory('invGun', 1);
  game.setVariable('m5', 'Karen');
  game.setVariable('mm', 5);
  game.roomInit('2d', false);
  for (let i = 0; i < 6; i++) step();
  for (let i = 0; i < 40 && game.menus.length; i++) {
    game.click();
    step(100);
  }
  assert.equal(game.menus.length, 0);
  assert.deepEqual(Object.keys(game.softKeys()), ['right']);
  game.pressKey('1');
  step();
  step();
  assert.equal(game.battleMode, true);
  // Exactly enough for the six shots it takes, so that the last bullet kills it.
  game.ammoSet(6, false, true);

  const boss = () => game.objects.find((object) => object.script?.hasEvent(EVENT.ATTACK1) && object.visible);
  for (let shot = 0; shot < 30 && !game.bossDead; shot++) {
    game.setRaw('sys_health', '5', 'I');
    game.moveCursor(boss().x, boss().y);
    for (let i = 0; i < 8; i++) step();
    game.click();
    step();
    step(700);
  }
  assert.deepEqual([game.bossDead, game.superBossDead, game.currentRoomId], [true, true, '2d']);
  assert.deepEqual(game.softKeys(), {});

  assert.equal(game.ammo, 0);
  game.pressKey('Escape');
  game.click();
  // The ammo counter rolls down first, and only then does the game notice it's empty.
  for (let i = 0; i < 40; i++) step();
  assert.equal(game.currentRoomId, '2d');
  assert.equal(game.noMoreBullets, true);
  assert.equal(game.menus.length, 0);

  const rooms = new Set();
  for (let i = 0; i < 2000 && !game.mainMenu; i++) {
    rooms.add(game.currentRoomId);
    step(200);
  }
  assert.deepEqual([...rooms], ['2d', 'karen_end', 'game_end']);
  assert.equal(game.mainMenu.current.kind, 'main');
  assert.deepEqual([game.bossDead, game.superBossDead], [false, false]);
  assert.deepEqual([...game.unsupportedCommands], []);
});
