import { controlsText, MOUSE_RECOIL_LABELS, TRANSITIONS_LABELS } from './help.mjs';
import { measureText, wrapText } from './text.mjs';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './ui.mjs';

// The logos, the first questions, the main menu and the pause menu, as in GameMidlet.k(int),
// J(), K(), w(int), aq() and as(). All positions are on the phone's 240-pixel screen.
const CENTER_X = SCREEN_WIDTH >> 1;
const MENU_FONT = 1;
const LOGO_TIME = 2000;
const PRESS_TIME = 10000;
const MENU_TOP = 100;
const LANGUAGE_LINES = { ABOUT: 477, QUIT: 469, GAME_DESCRIPTION: 463, CONTROLS: 416, ERASE: 470 };
const PAUSE_LINES = { RESUME: 437, SAVE: 438, SETTINGS: 439, HELP: 440, QUIT: 441, QUIT_ASK: 471 };
const SOUND_LINES = { ON: 432, OFF: 433, VIBRATE_ON: 434, VIBRATE_OFF: 435 };
const NO_SAVING_LINE = 481;
const MAIN = { PLAY: 0, SETTINGS: 1, HELP: 2, ABOUT: 3, QUIT: 4 };

function portSettingRow(game, labels, on) {
  const label = labels[game.languageName] ?? labels.English;
  return `${label}${game.lines[game.tables.onOffLines[on ? 0 : 1]]}`;
}

function transitionsRow(game) {
  return portSettingRow(game, TRANSITIONS_LABELS, game.roomTransitions);
}

function mouseRecoilRow(game) {
  return portSettingRow(game, MOUSE_RECOIL_LABELS, game.mouseLock);
}

export class FrontEnd {
  constructor(game) {
    this.game = game;
    this.data = game.data;
    this.tables = game.tables;
    this.stage = 'logo';
    this.logo = 0;
    this.wait = LOGO_TIME;
    this.box = null;
    this.selected = 0;
    this.current = { kind: 'logo' };
    this.setUpArt();
  }

  setUpArt() {
    const { data, tables } = this;
    const [[titleSheet, title], [, select], [, press], [backSheet, back], [, bottom]] = tables.frontArt;
    const [pressSheet] = tables.frontArt[2];
    Object.assign(this, { titleSheet, title, select, press, backSheet, back, bottom, pressSheet });
    const titleSize = data.moduleSize(titleSheet, 0);
    this.titleX = CENTER_X - (titleSize.width >> 1);
    this.titleY = 4;
    this.backY = CENTER_X + 4 - titleSize.height;
    const selectSheet = titleSheet;
    this.rowsX = SCREEN_WIDTH - data.moduleSize(selectSheet, 2).width;
    const { lineHeight } = data.fonts[MENU_FONT];
    this.lineHeight = lineHeight;
    this.rowStep = Math.trunc((SCREEN_HEIGHT - 20 - MENU_TOP) / 6);
    const pressModule = data.moduleSize(pressSheet, 1);
    this.pressX = CENTER_X - (pressModule.width >> 1);
    this.pressY = SCREEN_HEIGHT - pressModule.height;
    this.bottomX = CENTER_X - data.moduleSize(backSheet, 0).width;
    for (const line of tables.mainMenuLines) {
      const width = measureText(data, MENU_FONT, this.game.lines[line]);
      this.rowsX = Math.min(this.rowsX, SCREEN_WIDTH - width);
    }
  }

  start() {
    this.stage = 'logo';
  }

  tick(milliseconds) {
    if (this.stage === 'logo') {
      this.wait -= milliseconds;
      if (this.wait <= 0) this.nextLogo();
    } else if (this.stage === 'press') {
      this.wait -= milliseconds;
      if (this.wait <= 0) this.showMainMenu();
    }
  }

  nextLogo() {
    this.logo++;
    this.wait = LOGO_TIME;
    if (this.logo < this.tables.logos.length) return;
    if (this.game.chosenLanguage) this.showFirstSettings();
    else this.showLanguages();
  }

  showLanguages() {
    this.stage = 'languages';
    this.current = { kind: 'menu' };
    this.box = this.game.boxes.rows(this.tables.languageNames);
  }

  // The first question asks about sound, with the same rows as Settings.
  showFirstSettings() {
    this.stage = 'first-settings';
    this.box = this.settingsBox();
  }

  showPress() {
    this.stage = 'press';
    this.wait = PRESS_TIME;
    this.box = null;
    this.pressLines = wrapText(this.data, MENU_FONT, this.game.lines[this.data.hardCoded.lines.press], SCREEN_WIDTH);
    this.game.playSound('music');
  }

  showMainMenu() {
    this.stage = 'main';
    this.box = null;
    this.selected = 0;
    this.current = { kind: 'menu' };
    this.setUpArt();
  }

  settingIds() {
    return ['sound', ...(this.game.vibrator ? ['vibration'] : []), 'transitions', 'mouseRecoil', 'language'];
  }

  settingRows() {
    const { game, tables } = this;
    const { lines } = game;
    const onOff = (on) => lines[tables.onOffLines[on ? 0 : 1]];
    return this.settingIds().map((id) => {
      if (id === 'sound') return `${lines[tables.settingLabels[0]]}${onOff(game.audio?.enabled ?? true)}`;
      if (id === 'vibration') return `${lines[tables.settingLabels[1]]}${onOff(game.vibrationOn)}`;
      if (id === 'transitions') return transitionsRow(game);
      if (id === 'mouseRecoil') return mouseRecoilRow(game);
      return `${lines[tables.settingLabels[2]]}${game.languageName}`;
    });
  }

  settingsBox(selected = 0) {
    const rows = this.settingRows();
    const width = Math.max(...rows.map((row) => measureText(this.data, 2, row)));
    return this.game.boxes.rows(rows, { width, centered: false, selected });
  }

  changeSetting(row, direction = 1) {
    const { game, tables } = this;
    const id = this.settingIds()[row];
    if (id === 'sound') {
      game.audio?.setEnabled?.(!game.audio.enabled);
      if (game.audio?.enabled) game.playSound('music');
    } else if (id === 'transitions') {
      game.toggleRoomTransitions();
    } else if (id === 'mouseRecoil') {
      game.toggleMouseLock();
    } else if (id === 'language') {
      const names = tables.languageNames;
      const next = (names.indexOf(game.languageName) + direction + names.length) % names.length;
      game.setLanguage(names[next]);
      game.saveSettings();
    } else {
      game.vibrationOn = !game.vibrationOn;
      game.saveSettings();
      game.vibrateFor(0);
    }
    this.box = this.settingsBox(row);
  }

  showPages(line, back) {
    this.stage = 'pages';
    this.pagesBack = back;
    this.box = this.game.boxes.pages(line);
    this.current = { kind: 'text' };
  }

  chooseMain(row) {
    const { game, tables } = this;
    const { lines } = game;
    switch (row) {
      case MAIN.PLAY:
        if (game.hasSave()) {
          this.stage = 'play';
          this.box = game.boxes.rows(tables.playLines.map((line) => lines[line]));
        } else {
          game.stopSound();
          game.startNewGame();
        }
        break;
      case MAIN.SETTINGS:
        this.stage = 'settings';
        this.box = this.settingsBox();
        break;
      case MAIN.HELP:
        this.stage = 'help';
        this.box = game.boxes.rows(tables.helpLines.map((line) => lines[line]));
        break;
      case MAIN.ABOUT:
        this.showPages(`Version: ${this.version()}\n\n${lines[LANGUAGE_LINES.ABOUT]}`, () => this.showMainMenu());
        break;
      case MAIN.QUIT:
        this.stage = 'quit';
        this.box = game.boxes.confirm(
          lines[LANGUAGE_LINES.QUIT],
          tables.yesNoLines.map((line) => lines[line]),
        );
        break;
    }
  }

  version() {
    const manifest = this.data.files.get('META-INF/MANIFEST.MF');
    if (!manifest) return '';
    const match = /MIDlet-Version:\s*(\S+)/.exec(new TextDecoder().decode(manifest));
    return match?.[1] ?? '';
  }

  // A row chosen by mouse or key.
  chooseRow(row) {
    const { game, tables } = this;
    const { lines } = game;
    switch (this.stage) {
      case 'languages':
        game.setLanguage(tables.languageNames[row]);
        game.saveSettings();
        this.showFirstSettings();
        break;
      case 'first-settings':
        this.changeSetting(row);
        break;
      case 'settings':
        this.changeSetting(row);
        break;
      case 'play':
        if (row === 0) {
          game.stopSound();
          if (!game.loadGame()) game.startNewGame();
        } else {
          this.stage = 'erase';
          this.box = game.boxes.confirm(
            lines[LANGUAGE_LINES.ERASE],
            tables.yesNoLines.map((line) => lines[line]),
          );
        }
        break;
      case 'erase':
        if (row === 0) {
          game.stopSound();
          game.eraseSave();
          game.startNewGame();
        } else {
          this.showMainMenu();
        }
        break;
      case 'help':
        this.showPages(
          tables.helpLines[row] === LANGUAGE_LINES.CONTROLS
            ? controlsText(game, lines[this.data.hardCoded.lines.controls])
            : lines[LANGUAGE_LINES.GAME_DESCRIPTION],
          () => {
            this.stage = 'help';
            this.current = { kind: 'menu' };
            this.box = game.boxes.rows(tables.helpLines.map((line) => lines[line]));
          },
        );
        break;
      case 'quit':
        if (row === 0) game.onQuit();
        else this.showMainMenu();
        break;
    }
  }

  goBack() {
    switch (this.stage) {
      case 'first-settings':
        this.showPress();
        break;
      case 'press':
        this.showMainMenu();
        break;
      case 'pages':
        this.pagesBack();
        break;
      case 'settings':
      case 'play':
      case 'help':
      case 'erase':
      case 'quit':
        this.showMainMenu();
        break;
      case 'main':
        this.selected = MAIN.QUIT;
        this.chooseMain(MAIN.QUIT);
        break;
    }
  }

  mainRowAt(x, y) {
    if (x < this.rowsX) return -1;
    const count = this.tables.mainMenuLines.length;
    for (let row = 0; row < count; row++) {
      const top = MENU_TOP + this.rowStep * row;
      if (y >= top - 5 && y < top + this.lineHeight) return row;
    }
    return -1;
  }

  hover(x, y) {
    if (this.stage === 'main') {
      const row = this.mainRowAt(x, y);
      if (row > -1) this.selected = row;
    } else if (this.box?.rows) {
      const row = this.game.boxes.rowAt(this.box, x, y);
      if (row > -1) this.box.selected = row;
    }
  }

  click(x, y) {
    if (this.stage === 'logo') {
      this.nextLogo();
    } else if (this.stage === 'press') {
      this.showMainMenu();
    } else if (this.stage === 'main') {
      const row = this.mainRowAt(x, y);
      if (row > -1) this.chooseMain(row);
    } else if (this.box?.rows) {
      const row = this.game.boxes.rowAt(this.box, x, y);
      if (row > -1) this.chooseRow(row);
    } else if (this.stage === 'pages') {
      this.pageOrBack();
    }
  }

  pageOrBack() {
    const { box } = this;
    if (box.scroll + box.pageLines < box.lines.length) box.scroll += box.pageLines;
    else this.pagesBack();
  }

  pressKey(key) {
    if (this.stage === 'logo') {
      if (key === 'Enter' || key === 'Escape') this.nextLogo();
      return;
    }
    if (this.stage === 'press') {
      if (key === 'Enter' || key === 'Escape') this.showMainMenu();
      return;
    }
    const down = key === 'ArrowDown';
    const up = key === 'ArrowUp';
    if (this.stage === 'main') {
      const count = this.tables.mainMenuLines.length;
      if (up || down) this.selected = (this.selected + (down ? 1 : count - 1)) % count;
      else if (key === 'Enter') this.chooseMain(this.selected);
      else if (key === 'Escape') this.goBack();
      return;
    }
    if (this.stage === 'pages') {
      const { box } = this;
      const last = Math.max(0, box.lines.length - box.pageLines);
      if (up || down) box.scroll = Math.max(0, Math.min(last, box.scroll + (down ? box.pageLines : -box.pageLines)));
      else if (key === 'Enter') this.pageOrBack();
      else if (key === 'Escape') this.pagesBack();
      return;
    }
    if (!this.box) return;
    const count = this.box.rows.length;
    if (up || down) this.box.selected = (this.box.selected + (down ? 1 : count - 1)) % count;
    else if (key === 'Enter') this.chooseRow(this.box.selected);
    else if (key === 'Escape') this.goBack();
    else if ((key === 'ArrowLeft' || key === 'ArrowRight') && this.box && this.stage.endsWith('settings')) {
      this.changeSetting(this.box.selected, key === 'ArrowLeft' ? -1 : 1);
    }
  }

  softKeys(label) {
    if (this.stage === 'logo') return { left: null, right: null };
    if (this.stage === 'press') return { left: label(0), right: null };
    if (this.stage === 'first-settings') return { left: label(1), right: label(10) };
    if (this.stage === 'main') return { left: label(0), right: null };
    if (this.stage === 'languages') return { left: label(0), right: null };
    if (this.stage === 'pages') return { left: null, right: label(9) };
    return { left: label(0), right: label(9) };
  }

  draw() {
    const { tables } = this;
    if (this.stage === 'logo') {
      const [sheet, animation] = tables.logos[Math.min(this.logo, tables.logos.length - 1)];
      const { width, height } = this.data.moduleSize(sheet, 0);
      return [
        { fill: '#000000', x: -60, y: 0, width: 360, height: SCREEN_HEIGHT },
        { sheet, animation, x: (SCREEN_WIDTH - width) >> 1, y: (SCREEN_HEIGHT - height) >> 1 },
      ];
    }
    const list = [{ fill: '#000000', x: -60, y: 0, width: 360, height: SCREEN_HEIGHT }];
    if (this.stage === 'press') {
      list.push(
        { sheet: this.backSheet, animation: this.bottom, x: this.bottomX, y: this.backY },
        { sheet: this.titleSheet, animation: this.title, x: this.titleX, y: this.titleY },
        { sheet: this.pressSheet, animation: this.press, x: this.pressX, y: this.pressY },
      );
      const top = this.pressY - this.lineHeight * this.pressLines.length;
      this.pressLines.forEach((text, index) => {
        list.push({ text, font: MENU_FONT, x: CENTER_X, y: top + index * this.lineHeight, align: 'center' });
      });
      return list;
    }
    list.push(
      { sheet: this.backSheet, animation: this.back, x: 0, y: this.backY },
      { sheet: this.titleSheet, animation: this.title, x: this.titleX, y: this.titleY },
    );
    if (this.stage === 'main') {
      list.push({
        sheet: this.titleSheet,
        animation: this.select,
        x: this.rowsX,
        y: MENU_TOP + this.rowStep * this.selected + this.lineHeight,
      });
      tables.mainMenuLines.forEach((line, row) => {
        list.push({ text: this.game.lines[line], font: MENU_FONT, x: this.rowsX, y: MENU_TOP + this.rowStep * row });
      });
    } else if (this.box) {
      list.push({ box: this.box });
    }
    return list;
  }
}

// Stops the game with a list over it. Its rows are the original's, with settings and help.
export class PauseMenu {
  constructor(game) {
    this.game = game;
    this.showMain();
  }

  showMain() {
    const { game } = this;
    const { lines } = game;
    this.stage = 'main';
    this.rowActions = ['resume', 'save', 'settings', 'help', 'quit'];
    const words = [PAUSE_LINES.RESUME, PAUSE_LINES.SAVE, PAUSE_LINES.SETTINGS, PAUSE_LINES.HELP, PAUSE_LINES.QUIT];
    this.box = game.boxes.rows(
      words.map((line) => lines[line]),
      { width: 120 },
    );
  }

  settingIds() {
    return ['sound', ...(this.game.vibrator ? ['vibration'] : []), 'transitions', 'mouseRecoil'];
  }

  settingRows() {
    const { game } = this;
    const { lines } = game;
    return this.settingIds().map((id) => {
      if (id === 'sound') return lines[game.audio?.enabled === false ? SOUND_LINES.OFF : SOUND_LINES.ON];
      if (id === 'vibration') return lines[game.vibrationOn ? SOUND_LINES.VIBRATE_ON : SOUND_LINES.VIBRATE_OFF];
      if (id === 'transitions') return transitionsRow(game);
      return mouseRecoilRow(game);
    });
  }

  showSettings(selected = 0) {
    this.stage = 'settings';
    this.box = this.game.boxes.rows(this.settingRows(), { width: 128, selected });
  }

  showHelp() {
    const { game } = this;
    this.stage = 'help';
    this.box = game.boxes.rows(
      game.tables.helpLines.map((line) => game.lines[line]),
      { width: 128 },
    );
  }

  choose(row) {
    const { game } = this;
    const { lines } = game;
    if (this.stage === 'main') {
      const action = this.rowActions[row];
      if (action === 'resume') game.closePause();
      else if (action === 'save') {
        if (game.fight) {
          this.stage = 'said';
          this.box = game.boxes.message(lines[NO_SAVING_LINE]);
        } else {
          game.saveGame({ quietly: true });
          this.stage = 'said';
          this.box = game.boxes.message(lines[473]);
        }
      } else if (action === 'settings') this.showSettings();
      else if (action === 'help') this.showHelp();
      else {
        this.stage = 'quit';
        this.box = game.boxes.confirm(
          lines[PAUSE_LINES.QUIT_ASK],
          game.tables.yesNoLines.map((line) => lines[line]),
        );
      }
    } else if (this.stage === 'settings') {
      const id = this.settingIds()[row];
      if (id === 'sound') game.audio?.setEnabled?.(!game.audio.enabled);
      else if (id === 'transitions') game.toggleRoomTransitions();
      else if (id === 'mouseRecoil') game.toggleMouseLock();
      else {
        game.vibrationOn = !game.vibrationOn;
        game.saveSettings();
      }
      this.showSettings(row);
    } else if (this.stage === 'help') {
      const text =
        game.tables.helpLines[row] === LANGUAGE_LINES.CONTROLS
          ? controlsText(game, lines[game.data.hardCoded.lines.controls])
          : lines[LANGUAGE_LINES.GAME_DESCRIPTION];
      this.stage = 'pages';
      this.box = game.boxes.pages(text);
    } else if (this.stage === 'quit') {
      if (row === 0) game.quitToFrontEnd();
      else this.showMain();
    }
  }

  // After saying it's saved, or that it can't save, the original goes back to the game.
  goBack() {
    if (this.stage === 'main' || this.stage === 'said') this.game.closePause();
    else if (this.stage === 'pages') this.showHelp();
    else this.showMain();
  }

  hover(x, y) {
    if (!this.box.rows) return;
    const row = this.game.boxes.rowAt(this.box, x, y);
    if (row > -1) this.box.selected = row;
  }

  click(x, y) {
    if (this.box.rows) {
      const row = this.game.boxes.rowAt(this.box, x, y);
      if (row > -1) this.choose(row);
    } else if (this.stage === 'pages') {
      this.nextPageOrBack();
    } else {
      this.goBack();
    }
  }

  nextPageOrBack() {
    const { box } = this;
    if (box.scroll + box.pageLines < box.lines.length) box.scroll += box.pageLines;
    else this.goBack();
  }

  pressKey(key) {
    const { box } = this;
    if (key === 'Escape') {
      this.goBack();
    } else if (box.rows) {
      const count = box.rows.length;
      if (key === 'ArrowUp') box.selected = (box.selected + count - 1) % count;
      else if (key === 'ArrowDown') box.selected = (box.selected + 1) % count;
      else if (key === 'Enter') this.choose(box.selected);
    } else if (key === 'Enter') {
      if (this.stage === 'pages') this.nextPageOrBack();
      else this.goBack();
    }
  }

  draw() {
    return [{ box: this.box }];
  }
}

// The map of a floor, as in GameMidlet.j(int) and aH(). The map's own animations draw its walls,
// and three entries mark the places the original's cursor pictures show.
const FLOOR_LINE = [0, 490, 491, 492];
const CURSOR_MARKS = { 12: 10, 13: 7, 14: 8 };

export class MapScreen {
  constructor(game, floor) {
    this.game = game;
    this.floor = floor;
    this.sheet = game.data.hardCoded.mapSheet;
    this.tile = game.data.moduleSize(this.sheet, 9);
    this.arrowWidth = game.data.moduleSize(this.sheet, 13).width;
    this.rightX = SCREEN_WIDTH - 5 - this.arrowWidth * 2;
  }

  get layout() {
    const { tables } = this.game;
    return [tables.firstFloorMap, tables.secondFloorMap, tables.thirdFloorMap][this.floor - 1];
  }

  step(direction) {
    this.floor = ((this.floor - 1 + direction + 3) % 3) + 1;
  }

  click(x) {
    if (x < this.arrowWidth + 30) this.step(-1);
    else if (x > this.rightX - 15) this.step(1);
  }

  pressKey(key) {
    if (key === 'Escape' || key === 'map' || key === 'Enter') this.game.map = null;
    else if (key === 'ArrowLeft') this.step(-1);
    else if (key === 'ArrowRight') this.step(1);
  }

  draw() {
    const { game, sheet, tile, layout, floor } = this;
    const { tables, lines } = game;
    const list = [{ fill: '#e7e0bf', x: 0, y: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT }];
    const startX = (SCREEN_WIDTH - layout[0].length * tile.width) >> 1;
    const startY = (SCREEN_HEIGHT - layout.length * tile.height) >> 1;
    const [cursorSheet, cursorAnimation] = tables.cursorSprites[0];
    layout.forEach((row, rowIndex) => {
      row.forEach((entry, columnIndex) => {
        if (entry === -1) return;
        const x = startX + columnIndex * tile.width;
        const y = startY + rowIndex * tile.height;
        const mark = CURSOR_MARKS[entry];
        if (mark !== undefined) {
          list.push({ sheet: cursorSheet, animation: cursorAnimation, frame: mark, x: x + 6, y: y + 8 });
        }
        const index = mark === undefined ? entry : entry === 13 ? 23 : 22;
        list.push({ sheet, animation: tables.mapAnimations[index], x, y });
      });
    });
    list.push(
      { sheet, animation: tables.mapAnimations[26], x: 5, y: 15 },
      { sheet, animation: tables.mapAnimations[27], x: this.rightX, y: 15 },
    );
    const font = 2;
    const here = lines[FLOOR_LINE[floor]];
    const previous = lines[FLOOR_LINE[floor === 1 ? 3 : floor - 1]];
    const next = lines[FLOOR_LINE[floor === 3 ? 1 : floor + 1]];
    list.push(
      { text: here, font, x: CENTER_X, y: SCREEN_HEIGHT - 30, align: 'center' },
      { text: previous, font, x: 5 + this.arrowWidth * 2, y: 15 },
      { text: next, font, x: this.rightX - 5, y: 15, align: 'right' },
    );
    return list;
  }
}
