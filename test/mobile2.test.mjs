import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readInput, recommended } from '../src/inputs.mjs';
import { pngInfo } from '../web/engine/format.mjs';
import { EVENT, Game, MENU, VERB, verbWheelCenter } from '../web/engine/game.mjs';
import { inspectJar, loadGameData, readJar } from '../web/engine/jar.mjs';
import { createGame, Mobile2Game } from '../web/engine/mobile2.mjs';
import { parsePaletteIndex, recolorPng } from '../web/engine/palettes.mjs';
import { engineMenuTop } from '../web/renderer.mjs';

const data = loadGameData(await readJar(readInput(recommended.sh2.gameData)));
const keypadData = loadGameData(await readJar(readInput(recommended.sh2.keypadReference)));
const firstGameData = loadGameData(await readJar(readInput(recommended.sh1.gameData)));
const FAN_TRANSLATED_BUILD = 'sh2-2008-a10';

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  };
}

function newGame({ build = data, random = () => 0.5, storage = null, language = 'en' } = {}) {
  let clock = 1000;
  const game = createGame(build, { language, roomSize: 310, roomHeight: 270, now: () => clock, random, storage });
  game.advance = (ms = 60) => {
    clock += ms;
    game.tick();
    for (let i = 0; game.transitionCounter !== null; i++) {
      assert.ok(i < 100, `A room transition never ends in room ${game.currentRoomId}`);
      clock += 60;
      game.tick();
    }
  };
  game.pass = (ms) => {
    clock += ms;
  };
  game.startNewGame();
  game.advance();
  return game;
}

// Comparing whole game objects would make a failing assert print the entire game, which
// takes minutes and a lot of memory, so these tests compare script names instead.

// Skips the story with the key that the original's Skip button stands for.
function skipTo(game, room) {
  for (let i = 0; i < 400 && (game.currentRoomId !== room || game.menus.length); i++) {
    if (game.menus.at(-1)) game.pressKey('Escape');
    game.advance(game.menus.at(-1)?.id === MENU.TEXT_FADE ? 500 : 60);
  }
  assert.equal(game.currentRoomId, room);
  assert.equal(game.menus.length, 0);
}

function enter(game, room, vars = {}) {
  for (const [name, value] of Object.entries(vars)) game.setVariable(name, value);
  game.roomInit(room, false);
  game.advance();
  game.advance();
}

function hover(game, object) {
  game.moveCursor(...game.clickPointOn(object));
  game.advance();
  game.advance();
}

test('a Mobile 2 JAR gets the Mobile 2 game, at the size of its rooms', async () => {
  const inspection = await inspectJar(readInput(recommended.sh2.gameData));
  assert.deepEqual([inspection.status, inspection.roomSize, inspection.roomHeight], ['ok', 310, 270]);
  assert.ok(createGame(inspection.data, {}) instanceof Mobile2Game);
  const first = await inspectJar(readInput(recommended.sh1.gameData));
  assert.deepEqual([first.status, first.roomSize, first.roomHeight], ['ok', 256, 256]);
  assert.ok(!(createGame(first.data, {}) instanceof Mobile2Game));
  assert.ok(createGame(first.data, {}) instanceof Game);
});

test('every engine text is the phrase it is named for', () => {
  const game = newGame();
  const expected = {
    SELECT: 'Select',
    YES: 'Yes',
    NO: 'No',
    OK: 'OK',
    CHANGE: 'Change',
    NEXT: 'Next',
    SKIP: 'Skip',
    MENU: 'Pause',
    BACK: 'Back',
    PLAY: 'Play',
    SAVED_GAME: 'Saved game',
    NEW_GAME: 'New game',
    SETTINGS: 'Settings',
    SOUND: 'Sound:',
    ON: 'On',
    OFF: 'Off',
    HELP: 'Help',
    GAMEPLAY: 'Gameplay',
    CONTROLS: 'Controls',
    ABOUT: 'About',
    VENDOR: 'Vendor: ',
    NAME: 'Name: ',
    VERSION: 'Version: ',
    MAP: 'Map',
    RECEIVED: 'Received: <item name>',
    LOOK_AT: 'Look at',
    USE: 'Use',
    EQUIP_GUN: 'Equip',
    UNEQUIP: 'Unequip',
    CONTINUE: 'Continue',
    SAVE: 'Save',
    SAVE_FAILED: 'Save failed',
    MAIN_MENU: 'Main menu',
    HINT_FORWARD: 'Move forward',
    HINT_TURN_BACK: 'Turn back',
    HINT_BACK: 'Exit room',
    HINT_LEFT: 'Move left',
    HINT_RIGHT: 'Move right',
    HINT_TURN_LEFT: 'Turn left',
    HINT_TURN_RIGHT: 'Turn right',
    OUT_OF_AMMO: 'No more bullets. Where did I get those?',
    NOTHING_CARRIED: "I'm not carrying anything.",
    EQUIP_CLIPS: 'Reload',
    EQUIP: 'Cure',
    SPEAKER_LUCAS: 'Lucas',
    SPEAKER_VINCENT: 'Vincent',
    SPEAKER_KAREN: 'Karen',
  };
  for (const [name, phrase] of Object.entries(expected)) assert.equal(game.engineText(game.text[name]), phrase, name);
});

test('languages load from the top-level folder, in the order the original offers them', () => {
  const game = newGame({ language: 'de' });
  assert.deepEqual(game.languages, ['en', 'fr', 'de', 'it', 'es', 'pt']);
  assert.equal(game.engineText(game.text.PLAY), 'Spielen');
});

test('the main menu offers what the original does, with its music and about text', () => {
  const played = [];
  let clock = 1000;
  const game = createGame(data, {
    language: 'en',
    roomSize: 310,
    roomHeight: 270,
    now: () => clock,
    audio: { enabled: true, play: (name) => played.push(name), stop() {}, setEnabled() {} },
  });
  game.showStartup();
  game.mainMenu.startSplash();
  assert.deepEqual(played, ['sh_bgtheme']);
  assert.equal(game.mainMenu.screen.image, 'gfx/splash.png');
  clock += 5000;
  game.tick();
  assert.deepEqual(
    game.mainMenu.current.choices.map(({ text }) => text),
    ['Play', 'Settings', 'Help', 'About', 'Quit'],
  );
  game.mainMenu.activate(game.mainMenu.current, 'about');
  const about = game.mainMenu.current.text;
  assert.match(about, /^© 2008 Konami/);
  assert.match(about, /Name: Silent Hill Mobile 2\nVersion: 1\.0\.0\nVendor: Konami/);
  assert.match(about, /Made with INK Technology\.$/);
});

const LANGUAGES = ['en', 'fr', 'de', 'it', 'es', 'pt'];
// Words for a phone's keys and the touch build's icons, in each language.
const PHONE_WORDS =
  /JAVA_APP|touchpad|soft ?key|touches de sélection|Auswahltaste|tasti funzione|teclas de selección|^Use as teclas|\b(Num|Key|Touche|Taste|Tasto|Tecla) ?\d|chiffre 0|ic[oô]ne?\b|ícone|icona|icono|symbol|navigation mode/im;

for (const [name, build] of [
  ['touch', data],
  ['keypad', keypadData],
]) {
  test(`the ${name} build's Help and tutorial describe the mouse and keyboard, in all six languages`, () => {
    for (const language of LANGUAGES) {
      const game = newGame({ build, language });
      const label = `${name} ${language}`;
      assert.doesNotMatch(game.gameplayHelp(), PHONE_WORDS, `${label} gameplay`);
      assert.doesNotMatch(game.controlsHelp(), PHONE_WORDS, `${label} controls`);
      assert.match(game.controlsHelp(), /\nM\b/, `${label} map key`);
      // The tutorial's lines, apart from the one about the crosshair's icon turning red.
      const lines = [1, 6, 7, 8, 9, 11].map((index) => game.gameTexts[index]);
      for (const line of lines) assert.doesNotMatch(line, PHONE_WORDS, `${label}: ${line}`);
      // Nothing that fights say mentions them either.
      for (const line of game.gameTexts) {
        if (/1/.test(line) && /Gun/.test(line)) assert.doesNotMatch(line, PHONE_WORDS, `${label}: ${line}`);
      }
    }
  });
}

test('no line in the touch build mentions a phone’s keys or an icon the page lacks', () => {
  for (const language of LANGUAGES) {
    const game = newGame({ language });
    // The crosshair's icon turning red is about the crosshair, so it stays.
    const others = game.gameTexts.filter((_, index) => index !== 10);
    for (const line of others)
      assert.doesNotMatch(
        line,
        /weapon icon|icone de combat|Kampfsymbol|icona di combattimento|icono de combate|ícone de combate|Navigation icon/i,
        `${language}: ${line}`,
      );
  }
});

test('each weapon hint is rewritten once, and the names of items are left alone', () => {
  for (const build of [data, keypadData]) {
    for (const language of LANGUAGES) {
      const game = newGame({ build, language });
      const counts = (text) => game.gameTexts.filter((line) => line === text).length;
      assert.equal(counts(game.help.equipPipe), 1, `${language} pipe`);
      assert.equal(counts(game.help.equipGun), 1, `${language} gun`);
      assert.ok(game.itemName('i').length < 20, `${language}: ${game.itemName('i')}`);
      assert.ok(game.itemName('invGun').length < 20, `${language}: ${game.itemName('invGun')}`);
    }
  }
  assert.equal(newGame({ language: 'it' }).itemName('i').toLowerCase(), "tubo d'acciaio");
});

test('the keypad build’s tutorial leaves the lines that are its story alone', () => {
  const game = newGame({ build: keypadData });
  assert.equal(game.gameTexts[13], "Don't touch that locker!");
});

test('help keeps the JAR’s own words for what isn’t about controls', () => {
  const page = newGame().gameplayHelp();
  assert.match(page, /The eye is used to look at\/examine objects\./);
  assert.match(page, /A highlighted crosshair indicates that your aim is correct\.$/);
  assert.match(page, /^Click, or use the buttons under the screen/);
  // The Spanish page has a paragraph more, so its end is still in the right place.
  assert.match(
    newGame({ language: 'es' }).gameplayHelp(),
    /La mira resaltada indica que se está apuntando correctamente\.$/,
  );
});

test('only the touch build’s controls mention drawing', () => {
  assert.match(newGame().controlsHelp(), /Draw on a puzzle/);
  assert.doesNotMatch(newGame({ build: keypadData }).controlsHelp(), /Draw on a puzzle/);
});

test('a fan translation keeps its own text', async () => {
  // This build has Russian in the English slot.
  const inspection = await inspectJar(readInput(FAN_TRANSLATED_BUILD));
  const game = createGame(inspection.data, {
    language: 'en',
    roomSize: inspection.roomSize,
    roomHeight: inspection.roomHeight,
  });
  assert.equal(game.help, null);
  assert.match(game.gameTexts[1], /[А-я]/);
  assert.match(game.gameplayHelp(), /[А-я]/);
});

test('a menu’s border clears the logo, and short menus stay centered', () => {
  const top = (roomHeight, height, logoHeight) =>
    engineMenuTop({ roomHeight, height, logoHeight, borderTop: 7, borderBottom: 6 });
  // The six rows of the settings shown before Mobile 2's title screen, under its logo.
  const settings = top(270, 102, 80);
  assert.ok(settings - 7 >= 2 + 80, `The border starts at ${settings - 7}`);
  assert.ok(settings + 102 + 6 <= 270);
  // A short one, and every menu in the first game, whose logo is short, stay centered.
  assert.equal(top(270, 70, 80), 100);
  assert.equal(top(256, 102, 39), 77);
  // One too tall for what's left stays on screen, over the logo.
  assert.equal(top(143, 120, 28), 17);
});

for (const [name, build, size] of [
  ['the first game', firstGameData, {}],
  ['Mobile 2', data, { roomSize: 310, roomHeight: 270 }],
]) {
  test(`${name}'s main menu quits, after asking, with No highlighted`, () => {
    let quits = 0;
    const stopped = [];
    const game = createGame(build, {
      language: 'en',
      ...size,
      onQuit: () => quits++,
      audio: { enabled: true, play() {}, setEnabled() {}, stop: () => stopped.push(true) },
    });
    game.showMainMenu();
    const menu = game.mainMenu;
    const choose = (id) => menu.activate(menu.current, id);
    assert.equal(menu.current.choices.at(-1).text, 'Quit');
    choose('quit');
    assert.equal(menu.current.title, 'Are you sure?');
    assert.equal(menu.current.choices[menu.current.selected].id, 'no');
    choose('no');
    assert.equal(menu.current.kind, 'main');
    assert.equal(quits, 0);

    choose('quit');
    const before = stopped.length;
    choose('yes');
    assert.equal(quits, 1);
    assert.ok(stopped.length > before);
  });
}

test('a menu with the extra row still clears the logo', () => {
  const top = engineMenuTop({ roomHeight: 270, height: 86, logoHeight: 80, borderTop: 7, borderBottom: 6 });
  assert.ok(top - 7 >= 82);
});

test('the About page credits what the page passes in', () => {
  const game = createGame(data, { language: 'en', roomSize: 310, roomHeight: 270, credits: ['Credit line'] });
  game.showMainMenu();
  game.mainMenu.activate(game.mainMenu.current, 'about');
  assert.match(game.mainMenu.current.text, /Made with INK Technology\.\n\nCredit line$/);
});

test('each game draws its splash art where its original does', () => {
  assert.deepEqual([Game.SPLASH_CENTERED, Game.SPLASH_OVER_LOGO], [false, true]);
  assert.deepEqual([Mobile2Game.SPLASH_CENTERED, Mobile2Game.SPLASH_OVER_LOGO], [true, false]);
});

test('each game’s panel art is in its JAR, and only Mobile 2’s is a strip', () => {
  const first = createGame(firstGameData, {});
  assert.ok(first.data.files.has(Game.PANEL_ART));
  assert.equal(Game.PANEL_ART_IS_STRIP, false);
  assert.ok(data.files.has(Mobile2Game.PANEL_ART));
  assert.ok(keypadData.files.has(Mobile2Game.PANEL_ART));
  assert.equal(Mobile2Game.PANEL_ART_IS_STRIP, true);
  for (const name of ['gfx/border_top.png', 'gfx/border_bottom.png']) assert.ok(data.files.has(name), name);
});

test('a new game reaches the first room, by skipping or by reading', () => {
  const skipped = newGame();
  skipTo(skipped, '0');
  assert.deepEqual([...skipped.unsupportedCommands], []);
  assert.equal(skipped.getRaw('s_screenWidth'), '310');

  const read = newGame();
  for (let i = 0; i < 400 && read.currentRoomId !== '0'; i++) {
    if (read.menus.at(-1)?.id === MENU.SAY) read.click();
    read.advance();
  }
  assert.equal(read.currentRoomId, '0');
  assert.deepEqual([...read.unsupportedCommands], []);
});

for (const [name, build] of [
  ['the keypad build', recommended.sh2.keypadReference],
  ['a build with smaller art', 'sh2-2008-a10'],
  ['a build with medium art', 'sh2-2008-a'],
]) {
  test(`${name} also reaches the first room`, async () => {
    const inspection = await inspectJar(readInput(build));
    let clock = 1000;
    const game = createGame(inspection.data, {
      language: 'en',
      roomSize: inspection.roomSize,
      roomHeight: inspection.roomHeight,
      now: () => clock,
      random: () => 0.5,
    });
    game.startNewGame();
    for (let i = 0; i < 800 && (game.currentRoomId !== '0' || game.menus.length); i++) {
      if (game.menus.at(-1)) game.pressKey('Escape');
      clock += 500;
      game.tick();
    }
    assert.equal(game.currentRoomId, '0');
    assert.deepEqual([...game.unsupportedCommands], []);
    assert.ok(game.roomWidth <= inspection.roomSize && game.roomHeight <= inspection.roomHeight);
  });
}

test('talk in a scene comes in each speaker’s color', () => {
  const game = newGame();
  assert.equal(game.speakerColor('Lucas'), 0x1c0e70);
  assert.equal(game.speakerColor('Vincent'), 0xa30c0c);
  assert.equal(game.speakerColor('Karen'), 0xa20b8a);
  assert.equal(game.speakerColor('Voice'), game.menuTextColor);
});

test('a room narrower than the art sits in the middle of the frame, and the cursor stays in it', () => {
  const game = newGame();
  skipTo(game, '0');
  assert.deepEqual([game.roomWidth, game.viewOffsetX], [310, 0]);
  game.moveCursor(305, 100);
  game.setVar(['s_screenWidth', 290]);
  assert.deepEqual([game.roomWidth, game.frameWidth, game.viewOffsetX], [290, 310, 10]);
  assert.equal(game.cursorX, 289);
  game.setVar(['s_screenWidth', 310]);
  assert.equal(game.viewOffsetX, 0);
});

test('palette files give each named image complete recolored PNGs', () => {
  const index = parsePaletteIndex(data.files.get('plts/palettes.pdt'));
  const bank = data.files.get('plts/palettes.bin');
  assert.equal(index.size, 56);
  let recolored = 0;
  for (const [name, offsets] of index) {
    const png = data.entries.get(`a/gfx/transform0/${name}.png`);
    if (!png) continue;
    for (const offset of offsets) {
      const swapped = recolorPng(png, bank, offset);
      assert.ok(swapped, name);
      const before = pngInfo(png);
      const after = pngInfo(swapped);
      assert.deepEqual(
        [after.width, after.height, after.regX, after.regY],
        [before.width, before.height, before.regX, before.regY],
      );
      recolored++;
    }
  }
  assert.ok(recolored > 90);
});

test('images keep the palette they were first loaded with until the next room', () => {
  const game = newGame();
  skipTo(game, '0');
  game.setVariable('sys_palette', 3);
  game.roomInit('1', false);
  game.advance();
  assert.equal(game.imagePalette('walls'), 3);
  game.setVariable('sys_palette', 5);
  assert.equal(game.imagePalette('walls'), 3);
  assert.equal(game.imagePalette('someOtherImage'), 0);
  game.setVariable('sys_paletteObj', 2);
  assert.equal(game.imagePalette('desk'), 2);
  game.roomInit('1', false);
  game.advance();
  assert.equal(game.imagePalette('walls'), 5);
});

test('the verb wheel has three arms, and no mouth', () => {
  const game = newGame();
  skipTo(game, '0');
  const bench = game.objects.find(({ scriptId }) => scriptId === '1n');
  hover(game, bench);
  game.click();
  game.advance();
  const wheel = game.menus.at(-1);
  assert.equal(wheel.id, MENU.VERBS);
  assert.equal(wheel.name, 'Bench');
  const { x, y } = verbWheelCenter(wheel, game.roomWidth, game.roomHeight);
  const at = (dx, dy) => {
    game.moveCursor(x + dx, y + dy);
    return wheel.selected;
  };
  assert.equal(at(2, -15), VERB.LOOK);
  assert.equal(at(-17, 13), VERB.INVENTORY);
  assert.equal(at(20, 13), VERB.HAND);
  assert.equal(at(100, 100), null);
  game.pressKey('ArrowDown');
  game.pressKey('ArrowUp');
  game.advance();
  assert.equal(wheel.selected, VERB.LOOK);
  game.pressKey('Enter');
  game.advance();
  assert.equal(game.menus.at(-1).id, MENU.SAY);
});

test('the walking keys take every kind of exit', () => {
  const game = newGame();
  for (const [key, exits] of Object.entries({
    forward: ['forward', 'upstairs_left', 'upstairs_right', 'downstairs_left', 'downstairs_right', 'elevator'],
    back: ['back', 'turnback'],
    left: ['left', 'turnleft'],
    right: ['right', 'turnright'],
  })) {
    for (const exit of exits) assert.ok(game.exitGoes(exit, key), `${key} ${exit}`);
  }
  assert.ok(!game.exitGoes('left', 'right'));
});

test('each exit has its own cursor, and most name where they go', () => {
  const game = newGame();
  const { text } = game;
  assert.deepEqual(game.cursorForExit('turnback'), ['cursorTurnBack', text.HINT_TURN_BACK]);
  assert.deepEqual(game.cursorForExit('upstairs_left'), ['cursorUpStairsLeft']);
  assert.deepEqual(game.cursorForExit('elevator'), ['cursorElevator']);
  assert.deepEqual(game.cursorForExit(null), ['cursorPoint']);
  const [id, hint, dx] = game.cursorForExit('turnleft');
  assert.deepEqual([id, hint], ['navArrow_Left', text.HINT_TURN_LEFT]);
  assert.equal(dx, game.imageInfo('navArrow_Left').regX);
  for (const exit of ['back', 'turnback', 'left', 'turnleft', 'right', 'turnright', 'forward']) {
    const [cursor] = game.cursorForExit(exit);
    assert.ok(game.imageInfo(cursor), cursor);
  }
});

test('the soft keys follow the room and what’s open', () => {
  const game = newGame();
  assert.deepEqual(
    [game.softKeys().left.label, game.softKeys().right.label],
    ['Next', 'Skip'],
    'in a scene that can be skipped',
  );
  skipTo(game, '0');
  assert.deepEqual(game.softKeys().left, undefined);
  assert.equal(game.softKeys().right.label, 'Pause');
  game.setInventory('invMap', 1);
  assert.equal(game.softKeys().left.label, 'Map');
  enter(game, 'lightPainting');
  assert.deepEqual([game.softKeys().left, game.softKeys().right.label], [undefined, 'Back']);
  enter(game, 'puzzleCorridor17KeyCode');
  assert.deepEqual([game.softKeys().left.label, game.softKeys().right.label], ['Back', 'Pause']);
  game.say('A line', null);
  assert.deepEqual([game.softKeys().left.label, game.softKeys().right], ['OK', undefined]);
});

test('escape skips only while the scene allows it, and stops at the next line after that', () => {
  const game = newGame();
  const room = game.currentRoomId;
  assert.equal(room, 'control');
  assert.equal(game.menus.at(-1).id, MENU.SAY);
  game.pressKey('Escape');
  game.advance();
  assert.notEqual(game.currentRoomId, 'control');
  skipTo(game, '0');

  game.say('Not part of a scene', null);
  game.pressKey('Escape');
  game.advance();
  assert.equal(game.menus.at(-1).text, 'Not part of a scene');
});

test('a key goes to text that a finished wait has just opened, not to what was under it', () => {
  const game = newGame();
  skipTo(game, '0');
  game.setInventory('invMap', 1);
  game.pressKey('inventory');
  game.advance();
  assert.equal(game.menus.at(-1).id, MENU.INVENTORY);
  // A script that's waiting, as a monster's attack does, and then speaks.
  const thread = { script: { id: 'test' }, resume() {} };
  game.pausedThread = thread;
  game.waitStop = 1;
  thread.resume = () => {
    game.pausedThread = thread;
    game.say('Game over', null);
  };
  game.resume = () => thread.resume();
  game.pressKey('Escape');
  game.advance();
  assert.equal(game.menus.at(-1).text, 'Game over');
  assert.equal(game.menus.length, 2);
});

test('the map offers the floors from the player’s own floor, and marks it', () => {
  const game = newGame();
  skipTo(game, '0');
  game.setInventory('invMap', 1);
  game.setVariable('varFloor', 'basement');
  game.pressKey('map');
  game.advance();
  const menu = game.menus.at(-1);
  assert.equal(menu.id, MENU.CHOICE);
  assert.deepEqual(
    menu.choices.map(({ text }) => text),
    ['Floor 2', 'Floor 1', 'Basement'],
  );
  assert.equal(menu.selected, 2);
  assert.equal(game.currentFloorRow(), 2);
});

test('the inventory offers to reload ammo and says so when there’s nothing to carry', () => {
  const game = newGame();
  skipTo(game, '0');
  game.setVariable('iv', 'Vincent');
  game.unsetRaw('inv-i');
  game.pressKey('inventory');
  game.advance();
  assert.equal(game.menus.at(-1).text, "I'm not carrying anything.");
  game.click();
  game.advance();
  game.setInventory('invAmmo', 5);
  game.setVariable('iv', 'Vincent');
  game.pressKey('inventory');
  game.advance();
  const page = game.menus.at(-1);
  assert.equal(page.id, MENU.INVENTORY);
  assert.deepEqual(
    page.choices.map(({ text }) => text),
    ['Reload', 'Look at', 'Back'],
  );
});

test('reloading tops the gun up, and the count follows', () => {
  const game = newGame();
  skipTo(game, '0');
  game.setVariable('iv', 'Vincent');
  game.unsetRaw('inv-i');
  game.setInventory('invAmmo', 5);
  game.setRaw('sys_ammo', '7', 'I');
  game.ammoSet(7, false, false);
  game.pressKey('inventory');
  game.advance();
  game.pressKey('Enter');
  game.advance();
  assert.equal(game.getRaw('sys_ammo'), '10');
  assert.equal(game.ammo, 10);
  assert.equal(game.inventorySize('invAmmo'), 2);
});

// A fight in the first enemy's room, as Vincent with the gun, against an enemy that won't
// act unless the dice say so: `roll` decides each random number. `mt` is how many times
// the room has said how to get the weapon out, which it stops after two.
function fightGame(roll = () => 0.99) {
  const game = newGame({ random: () => roll() });
  skipTo(game, '0');
  game.unsetRaw('inv-i');
  game.setInventory('invGun', 1);
  game.setRaw('sys_ammoUnlimited', '0', 'I');
  game.setVariable('iv', 'Vincent');
  enter(game, 'combatEnemy1', { mt: 2 });
  assert.ok(game.battleMode);
  return game;
}

const shootable = (game) => game.objects.find(({ visible, script }) => visible && script?.hasEvent(EVENT.ATTACK1));

test('the gun comes out with its key, and aims at a vulnerable zone', () => {
  const game = fightGame();
  assert.equal(game.getRaw('sys_battleState'), null);
  game.pressKey('1');
  game.advance();
  assert.equal(game.getRaw('sys_battleState'), '2');
  assert.ok(game.isAiming());
  assert.equal(game.cursorView().id, 'haircross');

  const zone = shootable(game);
  game.moveCursor((zone.left + zone.right) >> 1, (zone.top + zone.bottom) >> 1);
  game.advance();
  assert.equal(game.hoverObject?.scriptId, zone.scriptId);
  assert.equal(game.cursorView().id, 'am');
  game.moveCursor(5, 5);
  game.advance();
  assert.equal(game.hoverObject?.scriptId, undefined);
});

test('a shot costs a bullet whether it hits or not, and a hit costs the enemy health', () => {
  const game = fightGame();
  game.pressKey('1');
  game.advance();
  game.ammoSet(10, false, true);
  game.hudUpdate();
  game.moveCursor(5, 5);
  game.advance();
  game.click();
  game.advance();
  assert.equal(game.ammo, 9);
  assert.equal(game.getRaw('sys_ammo'), '9');

  const health = () => game.variableAsInteger(game.getRaw('mq'));
  assert.equal(health(), 4);
  game.hudAmmoOffset = game.ammo * game.hudDigitHeight();
  // The miss kicked the crosshair off to one side, and a free mouse's recoil settles.
  const zone = shootable(game);
  game.moveCursor((zone.left + zone.right) >> 1, (zone.top + zone.bottom) >> 1);
  for (let i = 0; i < 12; i++) game.advance();
  assert.equal(game.hoverObject?.scriptId, zone.scriptId);
  game.click();
  game.advance();
  assert.equal(health(), 3);
  assert.equal(game.ammo, 8);
  assert.equal(game.attackAnim, true);
});

test('an invisible battle zone can be shot, as the net over the meat is', () => {
  const game = newGame({ random: () => 0.99 });
  skipTo(game, '0');
  game.unsetRaw('inv-i');
  game.setInventory('invGun', 1);
  game.setVariable('iv', 'Vincent');
  enter(game, 'c');
  // The room says what the net is on the way in.
  game.click();
  game.advance();
  game.pressKey('1');
  game.advance();
  assert.ok(game.isAiming());
  const net = game.objects.find(({ scriptId }) => scriptId === '8f');
  assert.equal(net.visible, false);
  game.moveCursor(net.x + (net.width >> 1), net.y + (net.height >> 1));
  game.advance();
  assert.equal(game.hoverObject?.scriptId, '8f');
  game.click();
  game.advance();
  assert.equal(game.getRaw('varMeatIsFellDown'), '1');
});

test('the gun still comes out during the pause in a monster’s attack', () => {
  const game = fightGame();
  game.waitStop = game.now() + 800;
  game.pressKey('1');
  game.advance();
  assert.equal(game.getRaw('sys_battleState'), '2');
});

test('an enemy attacks when the dice say, and being hit flashes and hurts', () => {
  let value = 0.99;
  const game = fightGame(() => value);
  game.pressKey('1');
  game.advance();
  game.setVariable('sys_health', 5);
  value = 0;
  game.advance();
  assert.equal(game.enemyState, 4);
  value = 0.99;
  for (let i = 0; i < 20; i++) game.advance(100);
  assert.equal(game.getRaw('sys_health'), '4');
  assert.ok(game.objects.length);
});

test('being hit tiles the script’s image, flashes its color, then tiles it again', () => {
  const game = newGame();
  skipTo(game, '0');
  game.startDissolve(['i7', 0xff0000, 200, 100]);
  assert.deepEqual(game.dissolveItems(), [{ kind: 'tiled-image', id: 'i7' }]);
  game.pass(250);
  assert.equal(game.dissolveItems()[0].kind, 'rect');
  assert.equal(game.dissolveItems()[0].color, 0xff0000);
  game.pass(100);
  assert.deepEqual(game.dissolveItems(), [{ kind: 'tiled-image', id: 'i7' }]);
  game.pass(200);
  game.updateDissolve();
  assert.equal(game.dissolve, null);
});

test('running out of bullets says so once', () => {
  const game = fightGame();
  game.pressKey('1');
  game.advance();
  game.hudReady = true;
  game.ammo = 0;
  game.hudAmmoOffset = 0;
  game.hudAmmoUpdateNeeded = true;
  game.advance();
  assert.equal(game.menus.at(-1).text, 'No more bullets. Where did I get those?');
  game.click();
  game.advance();
  game.hudAmmoUpdateNeeded = true;
  game.advance();
  assert.equal(game.menus.length, 0);
});

test('the first fight’s gun has no ammo count', () => {
  const game = fightGame();
  game.battleState = 2;
  const ids = () => game.hudItems().map(({ id }) => id);
  assert.ok(ids().includes('HUD_bullet'));
  game.setRaw('sys_ammoUnlimited', '1', 'I');
  assert.deepEqual(ids(), ['HUD_life']);
});

function drawingGame(room) {
  const game = newGame();
  skipTo(game, '0');
  enter(game, room);
  assert.ok(game.wantsStroke());
  return game;
}

function draw(game, points) {
  const mask = game.strokeMask();
  // Only dragging counts, so the press itself is a little way before the first point.
  game.startStroke(mask.left + points[0][0] - 1, mask.top + points[0][1]);
  game.pass(400);
  for (const [x, y] of points) game.continueStroke(mask.left + x, mask.top + y);
  game.endStroke();
  game.advance();
}

for (const [room, solved, points] of [
  [
    'puzzleDrawing',
    'varPuzzleDrawingIsSolved',
    [
      [44, 35],
      [104, 35],
      [163, 35],
      [150, 60],
      [134, 90],
      [120, 110],
      [104, 126],
    ],
  ],
  [
    'puzzleScalpel',
    'varScalpelPuzzleIsSolved',
    [
      [46, 160],
      [96, 140],
      [156, 100],
    ],
  ],
  [
    'puzzleBodyIncision',
    'varLightSurgeryRoomStomachIsCut',
    [
      [10, 10],
      [40, 40],
      [70, 70],
    ],
  ],
]) {
  test(`${room} is solved by drawing through its checkpoints, and goes back`, () => {
    const game = drawingGame(room);
    draw(game, points);
    assert.equal(game.getRaw(solved), '1');
    game.advance();
    assert.notEqual(game.currentRoomId, room);
  });

  test(`${room} wipes a stroke that strays, or stops short`, () => {
    const game = drawingGame(room);
    draw(game, [...points, [-200, -200]]);
    assert.equal(game.getRaw(solved), null);
    assert.equal(game.strokes.length, 0);
    assert.equal(game.currentRoomId, room);
    draw(game, points.slice(0, 1));
    assert.equal(game.getRaw(solved), null);
  });
}

test('the painting’s three checkpoints are three of its red dots, making a triangle', () => {
  const game = drawingGame('puzzleDrawing');
  const mask = game.strokeMask();
  const dots = game.objects.filter(({ gfxId }) => gfxId === 'ee').map(({ x, y }) => [x, y]);
  assert.equal(dots.length, 9);
  const dotsWithin = (x1, x2, y1, y2) =>
    dots.filter(([x, y]) => x - mask.left >= x1 && x - mask.left <= x2 && y - mask.top >= y1 && y - mask.top <= y2);
  assert.deepEqual(dotsWithin(30, 70, 20, 80), [[99, 82]]);
  assert.deepEqual(dotsWithin(150, 190, 20, 80), [[218, 82]]);
  assert.deepEqual(dotsWithin(80, 140, 110, 150), [[159, 173]]);
});

test('a stroke draws lines over the room, in the puzzle’s color, after a moment', () => {
  const game = drawingGame('puzzleDrawing');
  const mask = game.strokeMask();
  game.startStroke(mask.left + 50, mask.top + 50);
  game.continueStroke(mask.left + 60, mask.top + 50);
  assert.equal(game.strokes.length, 0);
  game.pass(400);
  game.continueStroke(mask.left + 70, mask.top + 50);
  assert.equal(game.strokes.length, 1);
  assert.equal(game.strokes[0].color, 0xff0e0d);
  assert.deepEqual(game.drawList().at(-1), game.strokes[0]);
});

test('the keypad build’s puzzles in those rooms are ordinary clicks', () => {
  const game = newGame({ build: keypadData });
  skipTo(game, '0');
  enter(game, 'puzzleDrawing');
  assert.equal(game.wantsStroke(), false);
});

test('the keypads’ digits open their doors', () => {
  const game = newGame();
  skipTo(game, '0');
  enter(game, 'puzzleCorridor17KeyCode');
  const press = (script) => {
    hover(
      game,
      game.objects.find(({ scriptId }) => scriptId === script),
    );
    game.click();
    game.advance();
  };
  for (const key of ['4k', '4n', '4r', '4j']) press(key);
  for (let i = 0; i < 30 && game.currentRoomId !== '3'; i++) game.advance(200);
  assert.equal(game.currentRoomId, '3');
  assert.equal(game.roomWidth, 290);
});

test('a save brings back the room, its size and the action keys', () => {
  const storage = memoryStorage();
  const game = newGame({ storage });
  skipTo(game, '0');
  enter(game, '3', { s_screenWidth: 290 });
  game.setVar(['s_screenWidth', 290]);
  assert.equal(game.roomWidth, 290);
  assert.equal(game.canSave(), game.saveAllowedInRoom);
  assert.ok(game.saveGame(false));

  const fresh = newGame({ storage });
  assert.equal(fresh.roomWidth, 310);
  assert.ok(fresh.loadGame());
  for (let i = 0; i < 8; i++) fresh.advance();
  assert.equal(fresh.currentRoomId, '3');
  assert.equal(fresh.roomWidth, 290);
  assert.equal(fresh.actionKeys.get('actionkey_num3'), 'f');
});

test('returning to the main menu puts the frame back', () => {
  const game = newGame();
  skipTo(game, '0');
  game.setVar(['s_screenWidth', 290]);
  game.endGameRequested = true;
  game.advance();
  assert.ok(game.mainMenu);
  assert.equal(game.roomWidth, 310);
});

test('a floor’s name shows for two seconds, until a menu opens', () => {
  const game = newGame();
  skipTo(game, '0');
  game.setVar(['s_txtMessage', 'Floor 1']);
  assert.equal(game.roomMessage(), 'Floor 1');
  game.pass(1900);
  assert.equal(game.roomMessage(), 'Floor 1');
  game.pass(200);
  assert.equal(game.roomMessage(), null);
  game.setVar(['s_txtMessage', 'Floor 2']);
  game.say('Text', null);
  assert.equal(game.roomMessage(), null);
});
