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
