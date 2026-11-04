// The original's screens outside the game: ExtBase.logoStart and logoHandling,
// splashStart and splashHandling, createMainMenu, and engineMenuKeyHandling.
// The layout lives in the renderer, which reports back through `rows` and `arrows`.

const LOGO_STEP_MS = 167;
const LOGO_ALPHAS = [0, 63, 127, 191, 255];
const LOGO_HOLD_MS = 1000;

const LANGUAGE_NAMES = { en: 1, fr: 2, de: 3, it: 4, es: 5, pt: 6 };

export function languageName(game, language) {
  return LANGUAGE_NAMES[language] === undefined ? language : game.engineText(LANGUAGE_NAMES[language]);
}

export function soundLabel(game, on = game.soundOn) {
  return `${game.engineText(game.text.SOUND)} ${game.engineText(on ? game.text.ON : game.text.OFF)}`;
}

// The port's own setting, so its label isn't in the JAR's text.
const TRANSITIONS_LABELS = {
  en: 'Transitions:',
  fr: 'Transitions\u00a0:',
  de: 'Übergänge:',
  it: 'Transizioni:',
  es: 'Transiciones:',
  pt: 'Transições:',
};

function transitionsLabel(game, on = game.roomTransitions) {
  return `${TRANSITIONS_LABELS[game.language] ?? TRANSITIONS_LABELS.en} ${game.engineText(on ? game.text.ON : game.text.OFF)}`;
}

const PIXEL_FONT_LABELS = {
  en: 'Pixel font:',
  fr: 'Police pixel\u00a0:',
  de: 'Pixelschrift:',
  it: 'Font pixel:',
  es: 'Fuente píxel:',
  pt: 'Fonte píxel:',
};

function pixelFontLabel(game, on = game.pixelFont) {
  return `${PIXEL_FONT_LABELS[game.language] ?? PIXEL_FONT_LABELS.en} ${game.engineText(on ? game.text.ON : game.text.OFF)}`;
}

const MOUSE_LOCK_LABELS = {
  en: 'Mouse lock:',
  fr: 'Capture souris\u00a0:',
  de: 'Maus sperren:',
  it: 'Blocco mouse:',
  es: 'Bloqueo ratón:',
  pt: 'Bloqueio rato:',
};

function mouseLockLabel(game, on = game.mouseLock) {
  return `${MOUSE_LOCK_LABELS[game.language] ?? MOUSE_LOCK_LABELS.en} ${game.engineText(on ? game.text.ON : game.text.OFF)}`;
}

// A setting's row. The menu is as wide as the row's longest value, so that it keeps
// its size as the value changes.
export function soundChoice(game) {
  return {
    id: 'sound',
    text: soundLabel(game),
    softKey: game.text.CHANGE,
    values: [soundLabel(game, true), soundLabel(game, false)],
  };
}

export function transitionsChoice(game) {
  return {
    id: 'transitions',
    text: transitionsLabel(game),
    softKey: game.text.CHANGE,
    values: [transitionsLabel(game, true), transitionsLabel(game, false)],
  };
}

// Choosing a language translates the row's label too, so each value is in its own language.
export function pixelFontChoice(game) {
  return {
    id: 'pixelFont',
    text: pixelFontLabel(game),
    softKey: game.text.CHANGE,
    values: [pixelFontLabel(game, true), pixelFontLabel(game, false)],
  };
}

export function mouseLockChoice(game) {
  return {
    id: 'mouseLock',
    text: mouseLockLabel(game),
    softKey: game.text.CHANGE,
    values: [mouseLockLabel(game, true), mouseLockLabel(game, false)],
  };
}

function languageChoice(game) {
  const label = (language) => {
    const texts = game.readEngineTexts(language);
    return `${texts[game.text.LANGUAGE]} ${texts[LANGUAGE_NAMES[language]] ?? language}`;
  };
  return { id: 'language', text: label(game.language), softKey: game.text.CHANGE, values: game.languages.map(label) };
}

function aboutText(game) {
  const { 'MIDlet-Name': name, 'MIDlet-Version': version, 'MIDlet-Vendor': vendor } = game.manifest;
  const details = `${game.engineText(game.text.NAME)}${name}\n${game.engineText(game.text.VERSION)}${version}\n${game.engineText(game.text.VENDOR)}${vendor}`;
  const [rights, ...sections] = game.text.ABOUT_SECTIONS.map((index) => game.engineText(index));
  return [rights, details, ...sections].join('\n\n');
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
    this.game.playSound(this.game.constructor.MENU_MUSIC, 1);
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
      [...this.settingChoices(), { id: 'continue', text: this.game.engineText(this.game.text.CONTINUE) }],
      { noBack: true },
    );
  }

  mainMenu() {
    const { game } = this;
    const text = (index) => game.engineText(index);
    return this.list(
      'main',
      null,
      [
        { id: 'play', text: text(game.text.PLAY) },
        { id: 'settings', text: text(game.text.SETTINGS) },
        { id: 'help', text: text(game.text.HELP) },
        { id: 'about', text: text(game.text.ABOUT) },
      ],
      { noBack: true },
    );
  }

  playMenu() {
    return this.list('play', null, [
      { id: 'saved', text: this.game.engineText(this.game.text.SAVED_GAME) },
      { id: 'new', text: this.game.engineText(this.game.text.NEW_GAME) },
    ]);
  }

  newGameWarning() {
    // No is highlighted, so that pressing Enter twice can't delete a save.
    return this.list(
      'warning',
      this.game.engineText(this.game.text.NEW_GAME_WARNING),
      [
        { id: 'yes', text: this.game.engineText(this.game.text.YES) },
        { id: 'no', text: this.game.engineText(this.game.text.NO) },
      ],
      { selected: 1 },
    );
  }

  settingChoices() {
    const { game } = this;
    const choices = [soundChoice(game), transitionsChoice(game), pixelFontChoice(game), mouseLockChoice(game)];
    if (game.languages.length > 1) choices.push(languageChoice(game));
    return choices;
  }

  settingsMenu() {
    return this.list('settings', null, this.settingChoices());
  }

  helpMenu() {
    return this.list('help', null, [
      { id: 'gameplay', text: this.game.engineText(this.game.text.GAMEPLAY) },
      { id: 'controls', text: this.game.engineText(this.game.text.CONTROLS) },
    ]);
  }

  textPage(text) {
    return { kind: 'text', text, scroll: 0, maxScroll: Infinity, pageLines: 1, rows: [], arrows: [] };
  }

  softKeys() {
    const menu = this.current;
    if (!menu) return {};
    const key = (text, action) => ({ label: this.game.engineText(text), action });
    const back = menu.noBack ? null : key(this.game.text.BACK, 'Escape');
    if (menu.kind === 'text') return { right: back };
    return { left: key(menu.choices[menu.selected].softKey ?? this.game.text.SELECT, 'Enter'), right: back };
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
    if (choice.softKey === this.game.text.CHANGE) {
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
    } else if (id === 'transitions') {
      game.toggleRoomTransitions();
    } else if (id === 'pixelFont') {
      game.togglePixelFont();
    } else if (id === 'mouseLock') {
      game.toggleMouseLock();
    } else {
      const { languages } = game;
      const position = languages.indexOf(game.language);
      game.setLanguage(languages[(position + direction + languages.length) % languages.length]);
      this.menus = menu.kind === 'sound' ? [this.soundMenu()] : [this.mainMenu(), this.settingsMenu()];
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
        this.menus.push(this.textPage(id === 'gameplay' ? game.gameplayHelp() : game.controlsHelp()));
        return;
      default:
    }
  }
}
