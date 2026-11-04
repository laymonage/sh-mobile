import { controlsText, gameplayText } from './help-text.mjs';

// The original's screens outside the game: ExtBase.logoStart and logoHandling,
// splashStart and splashHandling, createMainMenu, and engineMenuKeyHandling.
// The layout lives in the renderer, which reports back through `rows` and `arrows`.

const LOGO_STEP_MS = 167;
const LOGO_ALPHAS = [0, 63, 127, 191, 255];
const LOGO_HOLD_MS = 1000;

const TEXT = {
  LANGUAGE: 0,
  SELECT: 7,
  BACK: 9,
  YES: 10,
  NO: 11,
  PLAY: 14,
  SETTINGS: 16,
  HELP: 17,
  SOUND: 19,
  ON: 21,
  OFF: 22,
  GAMEPLAY: 23,
  CONTROLS: 24,
  CONTINUE: 59,
  SAVED_GAME: 116,
  NEW_GAME: 117,
  NEW_GAME_WARNING: 119,
  ABOUT: 130,
  VENDOR: 131,
  NAME: 132,
  VERSION: 133,
  CHANGE: 157,
};
const LANGUAGE_NAMES = { en: 1, fr: 2, de: 3, it: 4, es: 5, pt: 6 };
const ABOUT_SECTIONS = [160, 161, 162, 163, 164, 165, 166, 167, 168, 169];

export function languageName(game, language) {
  return LANGUAGE_NAMES[language] === undefined ? language : game.engineText(LANGUAGE_NAMES[language]);
}

export function soundLabel(game, on = game.soundOn) {
  return `${game.engineText(TEXT.SOUND)} ${game.engineText(on ? TEXT.ON : TEXT.OFF)}`;
}

// A setting's row. The menu is as wide as the row's longest value, so that it keeps
// its size as the value changes.
function soundChoice(game) {
  return {
    id: 'sound',
    text: soundLabel(game),
    softKey: TEXT.CHANGE,
    values: [soundLabel(game, true), soundLabel(game, false)],
  };
}

// Choosing a language translates the row's label too, so each value is in its own language.
function languageChoice(game) {
  const label = (language) => {
    const texts = game.readEngineTexts(language);
    return `${texts[TEXT.LANGUAGE]} ${texts[LANGUAGE_NAMES[language]] ?? language}`;
  };
  return { id: 'language', text: label(game.language), softKey: TEXT.CHANGE, values: game.languages.map(label) };
}

function aboutText(game) {
  const { 'MIDlet-Name': name, 'MIDlet-Version': version, 'MIDlet-Vendor': vendor } = game.manifest;
  const details = `${game.engineText(TEXT.NAME)}${name}\n${game.engineText(TEXT.VERSION)}${version}\n${game.engineText(TEXT.VENDOR)}${vendor}`;
  return [game.engineText(159), details, ...ABOUT_SECTIONS.map((index) => game.engineText(index))].join('\n\n');
}

export function parseIni(bytes) {
  const values = new Map();
  for (const line of new TextDecoder('latin1').decode(bytes).split(/\r?\n/)) {
    const match = /^\s*([^;=\s][^=]*?)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

export class MainMenu {
  constructor(game) {
    this.game = game;
    this.screen = null;
    this.menus = [];
  }

  get current() {
    return this.menus.at(-1);
  }

  // The logo, then the choices the original asks for at every start. That first
  // click also lets the browser play the splash screen's music.
  startLogo() {
    if (!this.game.data.files.has('gfx/konami_logo.png')) {
      this.askBeforeSplash();
      return;
    }
    this.screen = { kind: 'logo', step: 0, alpha: LOGO_ALPHAS[0], changedAt: this.game.now() };
  }

  askBeforeSplash() {
    this.screen = null;
    this.menus = [this.game.languageChosen ? this.soundMenu() : this.languageMenu()];
  }

  startSplash() {
    this.menus = [];
    const ini = this.game.data.files.get('splash.ini');
    this.splashes = ini ? parseIni(ini) : new Map();
    this.splashCount = Number(this.splashes.get('splashes') ?? 0);
    this.splashNumber = 0;
    this.game.playSound('sh_bgmusic', 1);
    this.nextSplash();
  }

  nextSplash() {
    this.splashNumber++;
    if (this.splashNumber > this.splashCount) {
      this.screen = null;
      this.menus = [this.mainMenu()];
      return;
    }
    const value = (name) => this.splashes.get(`${this.splashNumber}.${name}`);
    const now = this.game.now();
    this.screen = {
      kind: 'splash',
      image: value('image').replace(/^\//, ''),
      color: Number.parseInt(value('bgColor'), 16),
      unlockedAt: now + Number(value('timeMin')),
      endsAt: now + Number(value('timeMax')),
    };
  }

  // Returning from a game: no music, straight to the choices.
  showMainMenu() {
    this.game.stopSound();
    this.screen = null;
    this.menus = [this.mainMenu()];
  }

  list(kind, title, choices, softKeys = {}) {
    return { kind, title, choices, selected: 0, rows: [], ...softKeys };
  }

  languageMenu() {
    const choices = this.game.languages.map((language) => ({ id: language, text: languageName(this.game, language) }));
    return this.list('language', null, choices, { noBack: true });
  }

  soundMenu() {
    return this.list(
      'sound',
      null,
      [soundChoice(this.game), { id: 'continue', text: this.game.engineText(TEXT.CONTINUE) }],
      { noBack: true },
    );
  }

  mainMenu() {
    const text = (index) => this.game.engineText(index);
    return this.list(
      'main',
      null,
      [
        { id: 'play', text: text(TEXT.PLAY) },
        { id: 'settings', text: text(TEXT.SETTINGS) },
        { id: 'help', text: text(TEXT.HELP) },
        { id: 'about', text: text(TEXT.ABOUT) },
      ],
      { noBack: true },
    );
  }

  playMenu() {
    return this.list('play', null, [
      { id: 'saved', text: this.game.engineText(TEXT.SAVED_GAME) },
      { id: 'new', text: this.game.engineText(TEXT.NEW_GAME) },
    ]);
  }

  newGameWarning() {
    // No is highlighted, so that pressing Enter twice can't delete a save.
    return this.list(
      'warning',
      this.game.engineText(TEXT.NEW_GAME_WARNING),
      [
        { id: 'yes', text: this.game.engineText(TEXT.YES) },
        { id: 'no', text: this.game.engineText(TEXT.NO) },
      ],
      { selected: 1 },
    );
  }

  settingsMenu() {
    const { game } = this;
    const choices = [soundChoice(game)];
    if (game.languages.length > 1) choices.push(languageChoice(game));
    return this.list('settings', null, choices);
  }

  helpMenu() {
    return this.list('help', null, [
      { id: 'gameplay', text: this.game.engineText(TEXT.GAMEPLAY) },
      { id: 'controls', text: this.game.engineText(TEXT.CONTROLS) },
    ]);
  }

  textPage(text) {
    return { kind: 'text', text, scroll: 0, maxScroll: Infinity, pageLines: 1, rows: [], arrows: [] };
  }

  softKeys() {
    const menu = this.current;
    if (!menu) return {};
    const key = (text, action) => ({ label: this.game.engineText(text), action });
    const back = menu.noBack ? null : key(TEXT.BACK, 'Escape');
    if (menu.kind === 'text') return { right: back };
    return { left: key(menu.choices[menu.selected].softKey ?? TEXT.SELECT, 'Enter'), right: back };
  }

  tick() {
    const { game } = this;
    const clicked = game.pendingClick;
    const keys = game.pendingKeys;
    game.pendingClick = false;
    game.pendingKeys = [];
    if (this.screen?.kind === 'logo') this.updateLogo();
    else if (this.screen?.kind === 'splash') this.updateSplash(clicked || keys.length > 0);
    else if (this.current) this.handleInput(clicked, keys);
  }

  updateLogo() {
    const logo = this.screen;
    const now = this.game.now();
    const atFullStrength = logo.step === LOGO_ALPHAS.length - 1;
    if (now - logo.changedAt < (atFullStrength ? LOGO_HOLD_MS : LOGO_STEP_MS)) return;
    if (atFullStrength) {
      this.askBeforeSplash();
      return;
    }
    logo.step++;
    logo.alpha = LOGO_ALPHAS[logo.step];
    logo.changedAt = now;
  }

  updateSplash(pressed) {
    const now = this.game.now();
    if ((pressed && now > this.screen.unlockedAt) || now > this.screen.endsAt) this.nextSplash();
  }

  handleInput(clicked, keys) {
    const menu = this.current;
    if (keys.includes('Escape')) {
      this.back(menu);
      return;
    }
    if (menu.kind === 'text') {
      if (clicked && menu.hoveredArrow) this.scroll(menu, menu.hoveredArrow * menu.pageLines);
      for (const key of keys) {
        if (key === 'ArrowUp') this.scroll(menu, -1);
        if (key === 'ArrowDown') this.scroll(menu, 1);
      }
      return;
    }
    if (keys.includes('ArrowUp')) menu.selected = (menu.selected + menu.choices.length - 1) % menu.choices.length;
    if (keys.includes('ArrowDown')) menu.selected = (menu.selected + 1) % menu.choices.length;
    const choice = menu.choices[menu.selected];
    // Left and right also change a setting, in either direction.
    if (choice.softKey === TEXT.CHANGE) {
      if (keys.includes('ArrowLeft')) this.change(menu, choice.id, -1);
      if (keys.includes('ArrowRight')) this.change(menu, choice.id, 1);
    }
    if (keys.includes('Enter')) {
      this.activate(menu, choice.id);
    } else if (clicked && menu.hovered !== null && menu.hovered !== undefined) {
      menu.selected = menu.hovered;
      this.activate(menu, menu.choices[menu.hovered].id);
    }
  }

  scroll(menu, lines) {
    menu.scroll = Math.max(0, Math.min(menu.maxScroll, menu.scroll + lines));
  }

  // The original's back key is its Continue key on the sound question. Here that
  // question has a Continue row instead, because a mouse can't reach a soft key.
  back(menu) {
    if (menu.kind === 'sound') this.startSplash();
    else if (!menu.noBack) this.menus.pop();
  }

  change(menu, id, direction) {
    const { game } = this;
    if (id === 'sound') {
      game.toggleSound();
    } else {
      const { languages } = game;
      const position = languages.indexOf(game.language);
      game.setLanguage(languages[(position + direction + languages.length) % languages.length]);
      this.menus = [this.mainMenu(), this.settingsMenu()];
      this.current.selected = menu.selected;
      return;
    }
    const selected = menu.selected;
    const rebuilt = menu.kind === 'sound' ? this.soundMenu() : this.settingsMenu();
    menu.choices = rebuilt.choices;
    menu.selected = selected;
  }

  activate(menu, id) {
    const { game } = this;
    switch (menu.kind) {
      case 'language':
        game.setLanguage(id);
        this.menus = [this.soundMenu()];
        return;
      case 'sound':
        if (id === 'continue') this.startSplash();
        else this.change(menu, id, 1);
        return;
      case 'settings':
        this.change(menu, id, 1);
        return;
      case 'main':
        if (id === 'play') {
          if (game.hasSave()) this.menus.push(this.playMenu());
          else game.startNewGame();
        } else if (id === 'settings') {
          this.menus.push(this.settingsMenu());
        } else if (id === 'help') {
          this.menus.push(this.helpMenu());
        } else {
          this.menus.push(this.textPage(aboutText(game)));
        }
        return;
      case 'play':
        if (id === 'saved') game.loadGame();
        else this.menus.push(this.newGameWarning());
        return;
      case 'warning':
        if (id === 'yes') {
          game.removeSave();
          game.startNewGame();
        } else {
          this.menus.pop();
        }
        return;
      case 'help':
        this.menus.push(this.textPage(id === 'gameplay' ? gameplayText(game) : controlsText(game)));
        return;
      default:
    }
  }
}
