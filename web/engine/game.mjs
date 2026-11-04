import {
  parseLan,
  parseRoom,
  parseScript,
  pngInfo,
  ROOM_OBJECT_GFX,
  ROOM_OBJECT_ZONE,
  ROOM_OBJECT_ZONE_BATTLE,
  ROOM_OBJECT_ZONE_COLOR,
  ROOM_OBJECT_ZONE_TEXT,
  ROOM_OBJECT_ZONE_TILES,
  TRANSFORMS,
  usesWideZones,
} from './format.mjs';
import { integerArgument, Script, ScriptThread, STATUS, toBoolean, toInt } from './vm.mjs';
import { adaptTutorialText, controlsText, gameplayText } from './help-text.mjs';
import { SILENT_HILL_TEXT } from './text-tables.mjs';
import { MainMenu, mouseLockChoice, parseIni, pixelFontChoice, soundChoice, transitionsChoice } from './main-menu.mjs';

export const EVENT = {
  GETNAME: 1,
  GETIMAGE: 3,
  GETINVENTORYIMAGE: 4,
  ISVISIBLE: 5,
  ISACTIVE: 6,
  ENTERROOM: 7,
  LOOKAT: 9,
  PICKUP: 10,
  OPEN: 11,
  CLOSE: 12,
  PULL: 13,
  USE: 15,
  USEITEM: 16,
  TALKTO: 17,
  GETIDLEANIMATION: 18,
  GETRUNANIMATION: 53,
  GETMOVEDIR: 30,
  CLICK: 32,
  GETCOLOR: 36,
  GETTEXT: 37,
  ISMETER: 38,
  ISMETERHORIZONTAL: 39,
  GETMETERFILLDATA: 41,
  GETMETERFILLDATA2: 42,
  ISEQUIPABLE: 43,
  ISEQUIPED: 44,
  EQUIP: 45,
  UNEQUIP: 46,
  GETTEXTALIGNMENT: 47,
  GETTILEDATABOOLEAN: 48,
  GETTILEDATAGFXID: 49,
  GETTILEDATAGFXTRANSFORMATION: 50,
  GETTILEDATAPOSX: 51,
  GETTILEDATAPOSY: 52,
  HOOVERIN: 54,
  HOOVEROUT: 55,
  TICK: 56,
  GETHEROATTACKANIM1: 22,
  ATTACK1: 27,
  ENEMYATTACK: 29,
  GETTIME: 33,
};

// Menu IDs from Ext and ExtBase.
export const MENU = { CHOICE: 2, INVENTORY: 3, SAY: 6, PAUSE: 17, RECEIVED: 7, TEXT_FADE: 28, VERBS: 50 };

export const VERB = { LOOK: 0, HAND: 1, MOUTH: 2, INVENTORY: 3 };
const VERB_EVENTS = {
  [VERB.LOOK]: [EVENT.LOOKAT],
  [VERB.HAND]: [EVENT.USE, EVENT.PICKUP, EVENT.PULL, EVENT.OPEN, EVENT.CLOSE],
  [VERB.MOUTH]: [EVENT.TALKTO],
};
const VERB_KEYS = { ArrowUp: VERB.LOOK, ArrowRight: VERB.HAND, ArrowDown: VERB.MOUTH, ArrowLeft: VERB.INVENTORY };
const ANIMATION_EVENTS = [EVENT.GETIDLEANIMATION, 19, 20, 21, 22, 23, EVENT.GETRUNANIMATION];
const ANIMATION_IDLE = 0;
const ANIMATION_ENEMY_ATTACK_1 = 1;
const ANIMATION_ENEMY_ATTACK_2 = 2;
const ANIMATION_HERO_ATTACK_1 = 4;
const ANIMATION_RUN = 6;
const VALUES_PER_PART = 4;
const TICK_MS = 60;
const TICK_EVENT_INTERVAL = 10;

// Battle constants from Ext.
const ENEMY_STATE = { WAIT: 0, ATTACK: 1, SHOCK: 2, MOVE_AWAY: 3, DIE: 4 };
const ENEMY_ATTACK_TIME = 40;
const ENEMY_SHOCK_TIME = 30;
const ATTACK_RANDOM_SPAN = 150;
const AIM_RADIUS = 8;
const RECOIL_VERTICAL = 15;
const RECOIL_HORIZONTAL = 3;
const AMMO_MAX = 10;
const HUD_MARGIN = 5;
const HUD_LIFE_WIDTH = 6;
const HUD_DIGITS = 11;
const INFO_BAR_TICKS = 40;
const BLOOD_SPLATS = 5;
const BLOOD_PHASES = 3;
const MAX_BLOOD_BLUR = 4;

// M.gotoDissolveFXCounter: the frames of a room change, counted down as in Ext.appPaint.
const TRANSITION_START = 3;
const TRANSITION_END = -3;
const TRANSITION_OLD_ROOM = 2;
const TRANSITION_NEW_ROOM = -2;
const FINAL_BOSS_ROOM = '2d';

// Dialogue colors, by speaker, from ExtBase.
const SPEAKER_COLORS = [
  [154, 0x1c0e70],
  [155, 0xa30c0c],
  [156, 0xa20b8a],
];

// The map's floors, in the order its script lists them.
const FLOOR_ROWS = ['floor2', 'floor1', 'floor_base'];

const SAVE_VERSION = 1;
const LANGUAGE_PREFERENCE = 'silent-hill-mobile:language';
const SOUND_RESUME_MS = 3000;
// The cursor's top speed in ExtBase.ingameMoveKeyHandling, in pixels per tick.
const CURSOR_TOP_SPEED = 5;
const POINTS_ACROSS = 8;
// Hotspots at about the same height count as one row when they're cycled through.
const HOTSPOT_ROW_HEIGHT = 40;
const CLICKABLE_EVENTS = [
  EVENT.CLICK,
  EVENT.LOOKAT,
  EVENT.USE,
  EVENT.PICKUP,
  EVENT.PULL,
  EVENT.OPEN,
  EVENT.CLOSE,
  EVENT.TALKTO,
  EVENT.USEITEM,
];
const NO_PAUSE_ROOMS = new Set(['karen_end', 'game_end', '2e']);
const LOADED_GAME_TIME = 1000000;
const TRANSITIONS_PREFERENCE = 'silent-hill-mobile:transitions';
const PIXEL_FONT_PREFERENCE = 'silent-hill-mobile:pixel-font';
const MOUSE_LOCK_PREFERENCE = 'silent-hill-mobile:mouse-lock';
const POPUP_LIMIT = 4;
const POPUP_NEXT_MS = 500;

export const CHOICE_BACK = -3;
export const CHOICE_USE = -2;

// Commands this prototype runs past: chunk downloads, which a JAR doesn't need, and vibration.
const NO_OP = new Set([47, 56]);
const LANGUAGE_ORDER = ['en', 'fr', 'de', 'it', 'es', 'pt'];

// The text files write a line break as a backslash and an n, and a space that lines
// mustn't break at as a plus, as in French punctuation. ExtBase.wrapString converts both.
const displayText = (text) => text.replaceAll('\\n', '\n').replaceAll('+', '\u00a0');

class RoomObject {
  constructor(source, game) {
    Object.assign(this, {
      type: source.type,
      x: source.x,
      y: source.y,
      width: source.width ?? 0,
      height: source.height ?? 0,
    });
    this.game = game;
    this.transform = source.transform ?? 0;
    this.gfxId = source.gfxId ?? null;
    this.scriptId = source.scriptId;
    this.script = null;
    this.visible = true;
    this.active = false;
    this.color = 0xffffff;
    this.text = null;
    this.textAlignment = 0;
    this.left = this.right = this.top = this.bottom = 0;
    this.animations = new Array(ANIMATION_EVENTS.length).fill(null);
    this.idleAnimationTime = 0;
    this.animationTime = 0;
    this.runAnimLoops = 0;
  }

  executeEvent(event, initial) {
    if (!this.script) {
      if (!this.scriptId) return initial;
      this.script = this.game.getScript(this.scriptId);
    }
    return this.game.executeEvent(this.script, event, initial, this);
  }

  // Port of RoomObject.update, without the repaint tracking: the browser redraws
  // every frame anyway.
  update() {
    const game = this.game;
    if (!this.scriptId) {
      this.getBounds();
      return;
    }

    this.active = toBoolean(this.executeEvent(EVENT.ISACTIVE, 1));
    const visible = toBoolean(this.executeEvent(EVENT.ISVISIBLE, 1));
    this.visible = this.type === ROOM_OBJECT_ZONE_BATTLE ? false : visible;

    if (this.type === ROOM_OBJECT_GFX) {
      const image = this.executeEvent(EVENT.GETIMAGE, null);
      if (image !== null && image !== this.gfxId) {
        this.gfxId = image;
        this.right = 0;
        this.getBounds();
      }
    } else if (this.type === ROOM_OBJECT_ZONE_COLOR || this.type === ROOM_OBJECT_ZONE_TEXT) {
      const color = this.executeEvent(EVENT.GETCOLOR, null);
      this.color = color === null ? 0xffffff : toInt(color);
      if (this.type === ROOM_OBJECT_ZONE_TEXT) {
        const text = this.executeEvent(EVENT.GETTEXT, null);
        this.text = text === null || Array.isArray(text) ? null : String(text);
        const alignment = this.executeEvent(EVENT.GETTEXTALIGNMENT, null);
        this.textAlignment = alignment === null ? 0 : toInt(alignment);
      }
    }

    ANIMATION_EVENTS.forEach((event, index) => {
      const parts = this.executeEvent(event, null);
      if (!parts) {
        this.animations[index] = null;
        return;
      }
      let duration = 0;
      for (let i = 1; i < parts.length; i += VALUES_PER_PART) duration += Math.abs(toInt(parts[i]));
      this.animations[index] = { parts, duration };
    });

    if (this.visible) this.getBounds();
    if (!game.roomEntered) this.executeEvent(EVENT.ENTERROOM, null);
    if (!game.tickObject && this.script?.hasEvent(EVENT.TICK)) game.tickObject = this;

    if (!game.setupDone) {
      if (this.scriptId !== 'setupScript') game.setupDone = true;
    } else if (this.scriptId === 'setupScript' && game.currentRoom.length > 0) {
      game.roomInit(game.currentRoom, false);
    }
  }

  getBounds() {
    if (this.right > 0) return;
    if (this.type === ROOM_OBJECT_GFX) {
      const info = this.game.imageInfo(this.gfxId);
      if (!info) return;
      this.game.imagePalette(this.gfxId);
      const transform = TRANSFORMS[this.transform];
      this.left = this.x - transform.left(info.width, info.height, info.regX, info.regY);
      this.top = this.y - transform.top(info.width, info.height, info.regX, info.regY);
      this.right = this.left + (transform.swap ? info.height : info.width);
      this.bottom = this.top + (transform.swap ? info.width : info.height);
    } else if (this.type === ROOM_OBJECT_ZONE_TILES) {
      [this.left, this.top, this.right, this.bottom] = [0, 0, 255, 255];
    } else {
      [this.left, this.top, this.right, this.bottom] = [this.x, this.y, this.x + this.width, this.y + this.height];
    }
  }

  isOver(x, y) {
    return this.visible && this.active && x >= this.left && x <= this.right && y >= this.top && y <= this.bottom;
  }

  hasPaintingAnimation() {
    return (
      this.scriptId &&
      this.animations.some((animation, index) => animation && (this.runAnimLoops > 0 || index === ANIMATION_IDLE))
    );
  }

  // Port of RoomObject.paint, producing draw commands.
  paint(list) {
    if (this.type === ROOM_OBJECT_ZONE || !this.visible || this.hasPaintingAnimation()) return;
    if (this.type === ROOM_OBJECT_ZONE_COLOR) {
      list.push({ kind: 'rect', x: this.x, y: this.y, width: this.width, height: this.height, color: this.color });
    } else if (this.type === ROOM_OBJECT_ZONE_TEXT) {
      if (this.text !== null)
        list.push({
          kind: 'text',
          text: this.text,
          x: this.x,
          y: this.y,
          height: this.height,
          color: this.color,
          alignment: this.textAlignment,
        });
    } else if (this.type === ROOM_OBJECT_ZONE_TILES) {
      const columns = [
        EVENT.GETTILEDATAGFXID,
        EVENT.GETTILEDATAGFXTRANSFORMATION,
        EVENT.GETTILEDATABOOLEAN,
        EVENT.GETTILEDATAPOSX,
        EVENT.GETTILEDATAPOSY,
      ].map((event) => this.executeEvent(event, null));
      if (columns.every(Boolean)) {
        const [ids, transforms, shown, xs, ys] = columns;
        const count = Math.min(...columns.map((column) => column.length));
        for (let i = 0; i < count; i++) {
          if (toBoolean(shown[i]))
            list.push({ kind: 'image', id: ids[i], x: toInt(xs[i]), y: toInt(ys[i]), transform: toInt(transforms[i]) });
        }
      }
    } else if (this.gfxId !== null) {
      list.push({ kind: 'image', id: this.gfxId, x: this.x, y: this.y, transform: this.transform });
      this.paintMeter(list);
    }
  }

  paintMeter(list) {
    const isMeter = this.executeEvent(EVENT.ISMETER, null);
    if (isMeter === null || !toBoolean(isMeter)) return;
    const horizontalValue = this.executeEvent(EVENT.ISMETERHORIZONTAL, null);
    const horizontal = horizontalValue === null ? true : toBoolean(horizontalValue);
    for (const event of [EVENT.GETMETERFILLDATA, EVENT.GETMETERFILLDATA2]) {
      const fill = this.executeEvent(event, null);
      if (!fill) continue;
      const [id, start, amount] = [fill[0], toInt(fill[1]), toInt(fill[2])];
      const info = this.game.imageInfo(id);
      if (!info || start <= 0 || amount < 0) continue;
      for (let i = 0; i < amount; i++) {
        const step = start - 1 + i;
        list.push({
          kind: 'image',
          id,
          x: this.x + (horizontal ? step * info.width : 0),
          y: this.y + (horizontal ? 0 : step * info.height),
          transform: 0,
          raw: true,
        });
      }
    }
  }

  // Port of RoomObject.fightAnimation. The frame goes in the game's fight list,
  // which replaces the room's usual animations until the fight animation ends.
  fightAnimation(list, index, now) {
    if (!this.scriptId) return;
    const animation = this.animations[index];
    if (!animation) return;
    let elapsed = 0;
    if (this.animationTime === 0) {
      this.game.attackAnim = true;
      this.animationTime = now;
    } else {
      elapsed = now - this.animationTime;
      if (elapsed >= animation.duration) {
        this.game.attackAnim = false;
        this.animationTime = 0;
        return;
      }
    }
    this.paintAnimationFrame(list, animation, elapsed);
  }

  // Port of RoomObject.animPaint and runAnimation.
  paintAnimation(list, time) {
    if (!this.scriptId) return;
    if (this.runAnimLoops > 0) {
      const animation = this.animations[ANIMATION_RUN];
      if (!animation) return;
      let elapsed = 0;
      if (this.animationTime === 0) {
        this.animationTime = time;
      } else {
        elapsed = time - this.animationTime;
        if (elapsed >= animation.duration) {
          this.runAnimLoops--;
          if (this.runAnimLoops <= 0) {
            this.animationTime = 0;
            if (this.visible && this.gfxId !== null)
              list.push({ kind: 'image', id: this.gfxId, x: this.x, y: this.y, transform: this.transform });
            return;
          }
          this.animationTime = time;
          elapsed = 0;
        }
      }
      this.paintAnimationFrame(list, animation, elapsed);
      return;
    }

    const idle = this.animations[ANIMATION_IDLE];
    if (!this.visible || !idle) return;
    let elapsed = 0;
    if (this.idleAnimationTime === 0) {
      this.idleAnimationTime = time;
    } else {
      elapsed = time - this.idleAnimationTime;
      if (elapsed >= idle.duration) {
        this.idleAnimationTime = time;
        elapsed = 0;
      }
    }
    this.paintAnimationFrame(list, idle, elapsed);
  }

  paintAnimationFrame(list, { parts }, elapsed) {
    let end = 0;
    for (let i = 0; i < parts.length; i += VALUES_PER_PART) {
      end += Math.abs(toInt(parts[i + 1]));
      if (elapsed < end) {
        if (parts[i] === '') return;
        list.push({
          kind: 'image',
          id: parts[i],
          x: this.x + toInt(parts[i + 2]),
          y: this.y + toInt(parts[i + 3]),
          transform: this.transform,
        });
        return;
      }
    }
    if (this.gfxId !== null)
      list.push({ kind: 'image', id: this.gfxId, x: this.x, y: this.y, transform: this.transform });
  }
}

// The game's state and rules, with no dependency on a canvas, so a test can play it.
export class Game {
  // What differs between the games. Mobile2Game replaces these.
  static TEXT = SILENT_HILL_TEXT;
  static SPEAKER_TEXTS = SPEAKER_COLORS;
  static FLOOR_VARIABLE = 'var_floor';
  static FLOOR_ROWS = FLOOR_ROWS;
  static MENU_MUSIC = 'sh_bgmusic';
  static WHEEL_ARMS = {
    [VERB.LOOK]: [1, -20],
    [VERB.HAND]: [21, -1],
    [VERB.MOUTH]: [0, 18],
    [VERB.INVENTORY]: [-20, -1],
  };
  static WHEEL_SYMBOLS_X = 1;
  // ExtBase.splashPaint draws the splash art against the screen's left edge, over the logo.
  static SPLASH_CENTERED = false;
  static SPLASH_OVER_LOGO = true;
  // The art behind the page's buttons, and whether it's a strip to repeat behind them.
  static PANEL_ART = 'gfx/bigScreenHUD_hor.png';
  static PANEL_ART_IS_STRIP = false;

  constructor(
    data,
    {
      language = null,
      roomSize = 256,
      roomHeight = null,
      now = () => Date.now(),
      random = Math.random,
      storage = null,
      audio = null,
    } = {},
  ) {
    this.data = data;
    this.dataDir = data.dataDir;
    this.now = now;
    this.random = random;
    this.storage = storage;
    this.audio = audio;
    this.text = this.constructor.TEXT;
    this.mainMenu = null;
    this.languages = this.findLanguages();
    const stored = language ?? this.storedLanguage();
    // The original asks on the first run.
    this.languageChosen = this.languages.length === 1 || this.languages.includes(stored);
    this.loadLanguage(this.languages.includes(stored) ? stored : this.languages[0]);
    this.scripts = new Map();
    this.images = new Map();
    this.vars = new Map();
    this.unsupportedCommands = new Set();

    // The size of the canvas, in the art's pixels. A room can be narrower than this.
    this.frameWidth = roomSize;
    this.frameHeight = roomHeight ?? roomSize;
    this.roomWidth = this.frameWidth;
    this.roomHeight = this.frameHeight;
    this.backgroundColor = 0;
    this.menuColor = 0xffffff;
    this.menuTextColor = 0;
    this.menuSelectedColor = 0x7c7462;
    this.menuMargin = 4;
    this.menuLineSpacing = 2;
    this.useItemText = '';
    this.firstInventoryItem = null;
    this.hideCursor = false;
    this.specialCursor = { idle: null, hover: null };
    this.actionKeys = new Map();

    this.objects = null;
    this.currentRoomId = null;
    this.setupDone = false;
    this.roomEntered = false;
    this.roomUpdateNeeded = false;
    this.nextRoomInit = false;
    this.pendingRoom = null;
    this.tickObject = null;
    this.tickInterval = 0;
    this.tickTime = 0;
    this.endGameRequested = false;
    this.ended = false;
    this.saveAllowedInRoom = false;
    this.popups = [];
    this.popupReadyAt = 0;

    this.pausedThread = null;
    this.waitStop = 0;
    this.choiceMenu = null;
    this.choiceId = null;
    this.itemId = null;

    this.resetBattle();
    this.transitionsEnabled = false;
    this.transitionColor = -1;
    this.transitionRequested = false;
    this.transitionCounter = null;
    this.aimingWithKeys = false;
    this.heldDirections = new Set();
    this.tappedDirections = new Set();
    this.cursorSpeedX = 0;
    this.cursorSpeedY = 0;
    this.lastHotspot = null;
    this.roomTransitions = this.storedRoomTransitions();
    this.requestedRoom = null;
    this.lastRequestedRoom = null;
    this.changedSinceSave = false;
    this.loopingSound = null;
    this.soundResumeAt = null;
    this.soundPaused = false;
    this.paintingTime = null;
    this.pixelFont = this.storedPixelFont();
    this.mouseLock = this.readPreference(MOUSE_LOCK_PREFERENCE) === 'on';
    this.pointerLocked = false;

    this.menus = [];
    this.pointerX = this.roomWidth >> 1;
    this.pointerY = this.roomHeight >> 1;
    this.cursorX = this.pointerX;
    this.cursorY = this.pointerY;
    this.overObject = null;
    this.hoverObject = null;
    this.pendingClick = false;
    this.pendingKeys = [];
  }

  // Where a room narrower than the frame sits in it.
  get viewOffsetX() {
    return (this.frameWidth - this.roomWidth) >> 1;
  }

  get viewOffsetY() {
    return (this.frameHeight - this.roomHeight) >> 1;
  }

  resetBattle() {
    this.battleMode = false;
    this.battleState = 0;
    this.enemyState = ENEMY_STATE.WAIT;
    this.enemyStateTime = 0;
    this.enemyForceAttack = false;
    this.attackAnim = false;
    this.attackAnimState = 0;
    this.fightDraws = [];
    this.shot = false;
    this.recoilVertical = 0;
    this.recoilHorizontal = 0;
    this.recoilOffsetX = 0;
    this.recoilOffsetY = 0;
    this.battleTimer = 0;
    this.aimShakeX = 0;
    this.aimShakeY = 0;
    this.ammo = 0;
    this.ammoInGun = 0;
    this.gunState = false;
    this.reloading = true;
    this.noMoreBullets = false;
    this.life = 0;
    this.hudReady = false;
    this.hudAmmoUpdateNeeded = true;
    this.hudAmmoOffset = 0;
    this.infoBarTicks = 0;
    this.cursorAnim = null;
    this.dissolve = null;
    this.specialCursor = { idle: null, hover: null };
  }

  // Port of MyCanvas.playSound. One sound plays at a time. The first "ls" after
  // loading a save is skipped, as the original skips it.
  playSound(name, loops = 1) {
    if (this.firstLoad && name === 'ls') {
      this.firstLoad = false;
      return;
    }
    // MyCanvas.resumeSound only brings back a sound that loops.
    this.loopingSound = loops === -1 ? name : null;
    this.soundResumeAt = null;
    this.audio?.play(name, loops);
  }

  stopSound() {
    this.loopingSound = null;
    this.soundResumeAt = null;
    this.audio?.stop();
  }

  // From Ext.appPaint and M.run: the pause menu silences the game, and a sound that
  // loops comes back 3 seconds after the menu closes.
  updatePauseSound() {
    const paused = this.menus.some((menu) => menu.id === MENU.PAUSE);
    if (paused && !this.soundPaused) {
      this.soundPaused = true;
      this.soundResumeAt = null;
      this.audio?.stop();
    } else if (!paused && this.soundPaused) {
      this.soundPaused = false;
      this.soundResumeAt = this.now() + SOUND_RESUME_MS;
    } else if (!paused && this.soundResumeAt !== null && this.now() >= this.soundResumeAt) {
      this.soundResumeAt = null;
      if (this.loopingSound) this.playSound(this.loopingSound, -1);
    }
  }

  get soundOn() {
    return this.audio?.enabled ?? true;
  }

  // Port of M.soundToggle.
  toggleSound() {
    this.audio?.setEnabled(!this.soundOn);
    if (this.soundOn) this.playSound('sh_shot', 1);
  }

  readPreference(key) {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  writePreference(key, on) {
    try {
      this.storage?.setItem(key, on ? 'on' : 'off');
    } catch {
      // It still applies until the page is closed.
    }
  }

  // The port's own settings. Room changes play the original's transition unless this
  // is turned off.
  storedRoomTransitions() {
    return this.readPreference(TRANSITIONS_PREFERENCE) !== 'off';
  }

  toggleRoomTransitions() {
    this.roomTransitions = !this.roomTransitions;
    this.writePreference(TRANSITIONS_PREFERENCE, this.roomTransitions);
  }

  // Whether text looks like an old phone's, which the renderer draws.
  storedPixelFont() {
    return this.readPreference(PIXEL_FONT_PREFERENCE) === 'on';
  }

  togglePixelFont() {
    this.pixelFont = !this.pixelFont;
    this.writePreference(PIXEL_FONT_PREFERENCE, this.pixelFont);
  }

  // Whether the page captures the mouse while aiming, so that recoil lasts.
  toggleMouseLock() {
    this.mouseLock = !this.mouseLock;
    this.writePreference(MOUSE_LOCK_PREFERENCE, this.mouseLock);
  }

  get wantsMouseLock() {
    return (
      this.mouseLock && !this.mainMenu && !this.ended && !this.menus.length && !this.popups.length && this.isAiming()
    );
  }

  // With the mouse captured, it reports how far it moved rather than where it is.
  movePointerBy(dx, dy) {
    this.moveCursor(
      Math.max(0, Math.min(this.roomWidth - 1, this.pointerX + dx)),
      Math.max(0, Math.min(this.roomHeight - 1, this.pointerY + dy)),
    );
  }

  pauseSettings() {
    return [soundChoice(this), transitionsChoice(this), pixelFontChoice(this), mouseLockChoice(this)];
  }

  // The logo and everything after it, for a page that has just loaded the game.
  showStartup() {
    this.mainMenu = new MainMenu(this);
    this.mainMenu.startLogo();
  }

  showMainMenu() {
    this.mainMenu = new MainMenu(this);
    this.mainMenu.showMainMenu();
  }

  // Variables: M's inkServer store, keeping the type hint beside each value.
  // Port of M.inkServerSetVariabel and inkServerUnsetVariabel.
  setRaw(name, value, hint) {
    this.vars.set(name, { value, hint });
    this.changedSinceSave = true;
  }

  unsetRaw(name) {
    this.vars.delete(name);
    this.changedSinceSave = true;
  }

  getRaw(name) {
    return this.vars.get(name)?.value ?? null;
  }

  setVariable(name, value) {
    if (typeof value === 'string') this.setRaw(name, value, 'S');
    else if (typeof value === 'number') {
      if (value === 0) this.unsetRaw(name);
      else this.setRaw(name, String(value), 'I');
    }
  }

  variableAsInteger(name) {
    const entry = this.vars.get(name);
    if (!entry) return 0;
    if (entry.hint === 'S') return integerArgument(entry.value);
    return entry.hint === 'I' ? Number.parseInt(entry.value, 10) : 0;
  }

  inventorySize(item) {
    const value = this.getRaw(`inv-${item}`);
    return value === null ? 0 : toInt(value);
  }

  setInventory(item, size) {
    this.setRaw(`inv-${item}`, String(size), 'V');
  }

  inventoryItems() {
    return [...this.vars].filter(([, { hint }]) => hint === 'V').map(([name]) => name.replace(/^inv-/, ''));
  }

  get currentRoom() {
    return this.getRaw('cur-curRoom') ?? '';
  }

  // Text.
  findLanguages() {
    const { entries, files } = this.data;
    const settings = files.get('settings.ini');
    const listed = settings ? (parseIni(settings).get('INK-Languages') ?? '').split(/[,_]/) : [];
    const present = listed.filter(
      (language) =>
        entries.has(`${this.dataDir}/lan/${language}.lan`) && files.has(`localization/${language}.properties`),
    );
    if (!present.length) return ['en'];
    // Mobile 2 lists them alphabetically, and its engine puts them in this order.
    const order = (language) => LANGUAGE_ORDER.indexOf(language) + 1 || LANGUAGE_ORDER.length + 1;
    return present.sort((one, two) => order(one) - order(two));
  }

  storedLanguage() {
    try {
      return this.storage?.getItem(LANGUAGE_PREFERENCE) ?? null;
    } catch {
      return null;
    }
  }

  loadLanguage(language) {
    this.language = language;
    this.gameTexts = this.adaptGameTexts(
      parseLan(this.data.entries.get(`${this.dataDir}/lan/${language}.lan`)).map(displayText),
    );
    this.engineTexts = this.readEngineTexts(language);
  }

  adaptGameTexts(texts) {
    return adaptTutorialText(texts);
  }

  gameplayHelp() {
    return gameplayText(this);
  }

  controlsHelp() {
    return controlsText(this);
  }

  readEngineTexts(language) {
    return new TextDecoder('utf-8')
      .decode(this.data.files.get(`localization/${language}.properties`))
      .split(/\r?\n/)
      .filter((line) => line.length > 0)
      .map(displayText);
  }

  setLanguage(language) {
    this.loadLanguage(language);
    this.languageChosen = true;
    this.scripts.clear();
    try {
      this.storage?.setItem(LANGUAGE_PREFERENCE, language);
    } catch {
      // The choice just won't last beyond this visit.
    }
  }

  get manifest() {
    const bytes = this.data.files.get('META-INF/MANIFEST.MF');
    const lines = bytes
      ? new TextDecoder('utf-8')
          .decode(bytes)
          .replace(/\r?\n /g, '')
          .split(/\r?\n/)
      : [];
    return Object.fromEntries(lines.map((line) => line.split(/:\s*/, 2)));
  }

  gameText(index) {
    const number = typeof index === 'string' ? Number.parseInt(index, 36) : index;
    return this.gameTexts[number] ?? '???';
  }

  engineText(index) {
    return this.engineTexts[index] ?? '???';
  }

  // Resources.
  getScript(id) {
    if (!this.scripts.has(id)) {
      const bytes = this.data.entries.get(`${this.dataDir}/scr/${id}.bin`);
      this.scripts.set(id, bytes ? new Script(id, parseScript(bytes), (key) => this.gameText(key)) : null);
    }
    return this.scripts.get(id);
  }

  imagePath(id) {
    return `${this.dataDir}/gfx/transform0/${id}.png`;
  }

  imageInfo(id) {
    if (!this.images.has(id)) {
      const bytes = this.data.entries.get(this.imagePath(id));
      this.images.set(id, bytes ? pngInfo(bytes) : null);
    }
    return this.images.get(id);
  }

  // Silent Hill draws every image with its own colors. Mobile2Game swaps some.
  imagePalette() {
    return 0;
  }

  // Scripts.
  executeEvent(script, event, initial, roomObject = null) {
    if (!script?.hasEvent(event)) return initial;
    return new ScriptThread(script, script.eventOffsets.get(event), roomObject, this).execute(initial);
  }

  executeEventById(scriptId, event, initial) {
    const script = this.getScript(scriptId);
    return script ? this.executeEvent(script, event, initial) : null;
  }

  itemName(item) {
    return this.executeEventById(item, EVENT.GETNAME, '?');
  }

  resume() {
    this.pausedThread?.resume();
  }

  isWaiting() {
    if (this.waitStop > 0 && this.now() < this.waitStop) return true;
    if (this.waitStop > 0) {
      this.waitStop = 0;
      this.resume();
    }
    return false;
  }

  // Port of ScriptThread.executeCommand's switch and ExtBase.executeCommand.
  command(thread, op, args) {
    const count = args.length;
    switch (op) {
      case 1:
        thread.status = STATUS.RETURNED;
        return args[0] ?? null;
      case 3:
        thread.offset += integerArgument(args[0]);
        return null;
      case 4:
        if (integerArgument(args[0]) === 0) thread.offset += integerArgument(args[1]);
        return null;
      case 7:
        return args;
      case 8:
        return integerArgument(args[0]) === 0 ? 1 : 0;
      case 9:
        return this.getRaw(args[0]) ?? '0';
      case 10:
        this.setVar(args);
        this.roomUpdateNeeded = true;
        return null;
      case 11:
      case 12: {
        const step = count < 2 ? 1 : integerArgument(args[1]);
        let value = this.variableAsInteger(args[0]) + (op === 11 ? step : -step);
        if (count === 3)
          value = op === 11 ? Math.min(value, integerArgument(args[2])) : Math.max(value, integerArgument(args[2]));
        this.setVariable(args[0], value);
        this.roomUpdateNeeded = true;
        return null;
      }
      case 13:
      case 37:
        this.say(args[0], count === 2 ? args[1] : null);
        if (!this.pausedThread || this.pausedThread.script === thread.script) thread.status = STATUS.PAUSED;
        return null;
      case 14:
        return args.reduce((sum, value) => sum + integerArgument(value), 0);
      case 15:
        return this.equalsCommand(args);
      case 16:
        return args.every((value) => integerArgument(value) !== 0) ? 1 : 0;
      case 17:
        return args.some((value) => integerArgument(value) !== 0) ? 1 : 0;
      case 18:
        return this.itemId;
      case 19:
        return this.inventorySize(args[0]) === 0 ? 0 : 1;
      case 20:
        return this.inventorySize(args[0]) === 0 ? 1 : 0;
      case 21: {
        const amount = count > 1 ? integerArgument(args[1]) : 1;
        this.inventoryAdd(thread, args[0], amount, count > 2 ? toBoolean(args[2]) : true);
        return null;
      }
      case 22:
        this.gotoCommand(thread, args);
        return null;
      case 23:
        this.playSound(args[0], count > 1 ? integerArgument(args[1]) : 1);
        return null;
      case 24:
        this.addChoice(args);
        return null;
      case 25:
        if (this.choiceMenu) {
          const row = this.initialChoiceRow();
          this.choiceMenu.selected = row >= 0 && row < this.choiceMenu.choices.length ? row : 0;
        }
        this.choiceMenu = null;
        thread.status = STATUS.PAUSED;
        return null;
      case 26:
        return this.choiceId;
      case 27:
        return this.choiceId === args[0] ? 1 : 0;
      case 28:
        return Math.floor(this.random() * (count === 0 ? 2 : integerArgument(args[0])));
      case 29:
        this.waitStop = this.now() + integerArgument(args[0]);
        thread.status = STATUS.WAITING;
        return null;
      case 30:
        this.battleStartInit();
        return null;
      case 31:
        return this.battleMode ? 1 : 0;
      case 38:
        this.menus = [];
        this.endGameRequested = true;
        return null;
      case 39:
        this.attackAnim = false;
        this.battleMode = false;
        this.menus = [];
        this.roomUpdateNeeded = true;
        return null;
      case 40:
        return integerArgument(args[0]) > integerArgument(args[1]) ? 1 : 0;
      case 41:
        return integerArgument(args[0]) < integerArgument(args[1]) ? 1 : 0;
      case 42: {
        const size = this.inventorySize(args[0]) - (count > 1 ? integerArgument(args[1]) : 1);
        if (size <= 0) this.unsetRaw(`inv-${args[0]}`);
        else this.setInventory(args[0], size);
        return null;
      }
      case 43:
        return this.inventorySize(args[0]);
      case 44:
        return args.slice(1).reduce((value, next) => value - integerArgument(next), integerArgument(args[0]));
      case 45:
        this.startDissolve(args);
        return null;
      case 48:
        this.saveGame(count === 1 ? toBoolean(args[0]) : true);
        return null;
      case 49:
        this.stopSound();
        return null;
      case 50:
        if (thread.roomObject && thread.roomObject.animationTime <= 0) {
          thread.roomObject.runAnimLoops = count > 0 ? integerArgument(args[0]) : 1;
        }
        return null;
      case 51:
        if (count > 0) this.specialCursor.idle = args[0];
        if (count > 1) this.specialCursor.hover = args[1];
        return null;
      case 52:
        this.specialCursor = { idle: null, hover: null };
        return null;
      case 53:
        this.actionKeys.set(args[0], args[1]);
        return null;
      case 54:
        this.actionKeys.delete(args[0]);
        return null;
      case 55:
        this.startTextFade(args[0], args.slice(1).map(integerArgument));
        thread.status = STATUS.PAUSED;
        return null;
      default:
        if (!NO_OP.has(op)) this.unsupportedCommands.add(op);
        return null;
    }
  }

  equalsCommand(args) {
    const [first, ...others] = args;
    if (typeof first === 'string') {
      return others.every((other) => first === (typeof other === 'number' ? String(other) : other)) ? 1 : 0;
    }
    return others.every((other) => (typeof other === 'number' ? first === other : String(first) === other)) ? 1 : 0;
  }

  setVar(args) {
    const [name, value] = args;
    if (name.startsWith('s_')) {
      this.setSystemVar(args);
      return;
    }
    this.setVariable(name, value);
    if (this.settingVariableClosesMenus() && (args.length !== 3 || toBoolean(args[2]))) this.menus = [];
  }

  settingVariableClosesMenus() {
    return true;
  }

  // Port of ExtBase.executeCommand_setSystemVar. Settings for the original's menu
  // borders and scroll arrows have no use here, and are kept as plain variables.
  setSystemVar(args) {
    const [name, value] = args;
    switch (name) {
      case 's_hideCursor':
        this.hideCursor = toBoolean(value);
        return;
      case 's_noScrollHor':
      case 's_noScrollVer':
        return;
      case 's_0':
        this.menuColor = toInt(value);
        return;
      case 's_1':
        this.menuSelectedColor = toInt(value);
        return;
      case 's_5':
        this.menuLineSpacing = toInt(value);
        return;
      case 's_6':
        this.menuMargin = toInt(value);
        return;
      case 's_7':
        this.menuTextColor = toInt(value);
        return;
      case 's_8':
        this.backgroundColor = toInt(value);
        return;
      case 's_use':
        this.useItemText = String(value);
        return;
      case 's_firstInventoryItem':
        this.firstInventoryItem = String(value);
        return;
      case 's_dissolveFX':
        this.transitionsEnabled = toBoolean(value);
        if (args.length > 2) this.transitionColor = toInt(args[2]);
        return;
      case 's_2':
      case 's_3':
      case 's_4':
      case 's_useAny':
      case 's_battleType':
      case 's_useImageBorders':
      case 's_dynamicSayHeight':
      case 's_useScrollArrows':
      case 's_delimiterMode':
      case 's_storyScreenRowByRow':
        return;
      case 's_animCursor':
        this.setVariable(name, value);
        this.cursorAnim = toBoolean(value)
          ? { interval: toInt(args[2]), frames: args.slice(3), frame: 0, counter: 0 }
          : null;
        return;
      case 's_cursorHintDisable':
        this.setVariable(name, value);
        return;
      case 's_popupMes':
        this.popupCreate(value);
        return;
      default:
        this.setVariable(name, value);
        if (args.length !== 3 || toBoolean(args[2])) this.menus = [];
    }
  }

  // Menus.
  // A full page is Ext.say's menu 27, for Help in the pause menu.
  say(text, speaker, fullPage = false) {
    // The toboggan note ends with a line break, which would scroll to a blank line.
    this.menus.push({
      id: MENU.SAY,
      text: text.trimEnd(),
      speaker: speaker ?? null,
      fullPage,
      scroll: 0,
      maxScroll: 0,
      pageLines: 1,
    });
  }

  addChoice(args) {
    const [text, id, title] = args;
    if (!this.choiceMenu) {
      this.choiceMenu = { id: MENU.CHOICE, title: null, choices: [] };
      this.menus.push(this.choiceMenu);
    }
    if (title) this.choiceMenu.title = title;
    this.choiceMenu.choices.push({ id: id ?? this.choiceMenu.choices.length + 1, text });
  }

  // Which row of a choice menu gets the person marker, from ExtBase.menuPaintIngame.
  // The map is the only thing in the game that offers choices.
  currentFloorRow() {
    return this.constructor.FLOOR_ROWS.indexOf(this.getRaw(this.constructor.FLOOR_VARIABLE));
  }

  initialChoiceRow() {
    return this.currentFloorRow();
  }

  // Port of Ext.executeCommand_inventoryAdd, with its special case for ammo clips.
  inventoryAdd(thread, item, amount, announce) {
    let added = amount;
    if (item === 'invBulletClips') {
      this.syncGunState();
      if (this.ammo === 0 && this.inventorySize(item) === 0 && this.inventorySize('invGun') > 0) {
        const loaded = Math.min(amount, AMMO_MAX);
        this.ammoSet(loaded, true, true);
        this.reloading = true;
        added -= loaded;
      }
      this.noMoreBullets = false;
    }
    const size = this.inventorySize(item) + added;
    if (size > 0) this.setInventory(item, size);
    this.menus = [];
    this.roomUpdateNeeded = true;
    if (!announce) return;
    const text = this.receivedText(item);
    this.menus.push({
      id: MENU.RECEIVED,
      text: amount > 1 ? `${text} (${amount})` : text,
      image: this.inventoryImage(item),
    });
    thread.status = STATUS.PAUSED;
  }

  receivedText(item) {
    return this.engineText(this.text.RECEIVED).replace('<item name>', this.itemName(item));
  }

  inventoryImage(item) {
    const script = this.getScript(item);
    return this.executeEventById(item, EVENT.GETINVENTORYIMAGE, null) ?? script?.gfxId ?? null;
  }

  startTextFade(text, list) {
    this.menus.push({ id: MENU.TEXT_FADE, text, list, start: this.now(), color: list[0] });
  }

  // Port of ExtBase.textFadeCenter: colour and duration pairs, then the menu closes.
  updateTextFade(menu) {
    let remaining = this.now() - menu.start;
    for (let i = 0; i < menu.list.length; i += 2) {
      remaining -= menu.list[i + 1];
      if (remaining < 0) {
        menu.color = menu.list[i];
        return;
      }
    }
    this.menus = this.menus.filter((other) => other !== menu);
    this.resume();
  }

  openVerbMenu(object) {
    const options = [VERB.LOOK, VERB.HAND, VERB.MOUTH].map(
      (verb) => VERB_EVENTS[verb].filter((event) => object.script?.hasEvent(event)).at(-1) ?? null,
    );
    options.push(this.inventoryItems().length ? VERB.INVENTORY : null);
    const menu = {
      id: MENU.VERBS,
      object,
      name: object.executeEvent(EVENT.GETNAME, '?'),
      options,
      x: this.cursorX,
      y: this.cursorY,
    };
    menu.selected = this.verbAtCursor(menu);
    this.menus.push(menu);
  }

  // Ext.ingameMenuKeyHandling for the verb wheel.
  chooseVerb(verb) {
    const menu = this.menus.at(-1);
    const object = menu.object;
    if (verb === VERB.INVENTORY) {
      if (menu.options[VERB.INVENTORY] === null) this.say(this.engineText(this.text.NOTHING_CARRIED), null);
      else this.openInventory();
      return;
    }
    const event = menu.options[verb];
    if (event === null) {
      this.say(this.useItemText, null);
      return;
    }
    this.menus.pop();
    object.executeEvent(event, null);
  }

  // Port of ExtBase.menuInvSetup and createInventory: one item at a time, starting
  // from the first, with the item the setup script names always first.
  openInventory() {
    const items = this.inventoryItems().sort(
      (left, right) => Number(right === this.firstInventoryItem) - Number(left === this.firstInventoryItem),
    );
    if (!items.length) return;
    this.menus.push(this.inventoryPage(items, 0));
  }

  inventoryPage(items, index) {
    const id = items[index];
    this.itemId = id;
    const size = this.inventorySize(id);
    const name = this.itemName(id);
    return {
      id: MENU.INVENTORY,
      items,
      index,
      title: size > 1 ? `${name} (${size})` : name,
      image: this.inventoryImage(id),
      choices: this.itemChoices(id),
      selected: 0,
      x: this.cursorX,
      y: this.cursorY,
    };
  }

  // Ext.addItemChoices.
  itemChoices(item) {
    const choices = [];
    const script = this.getScript(item);
    if (script && (script.hasEvent(EVENT.EQUIP) || script.hasEvent(EVENT.UNEQUIP))) {
      const equipable = toBoolean(this.executeEvent(script, EVENT.ISEQUIPABLE, null));
      const equipped = toBoolean(this.executeEvent(script, EVENT.ISEQUIPED, null));
      if (script.hasEvent(EVENT.EQUIP) && equipable && !equipped) {
        const label =
          item === 'invBulletClips' ? this.text.EQUIP_CLIPS : item === 'invGun' ? this.text.EQUIP_GUN : this.text.EQUIP;
        choices.push({ id: EVENT.EQUIP, text: this.engineText(label) });
      }
      if (script.hasEvent(EVENT.UNEQUIP) && equipable && equipped)
        choices.push({ id: EVENT.UNEQUIP, text: this.engineText(this.text.UNEQUIP) });
    }
    if (this.overObject) {
      const direction = this.overObject.executeEvent(EVENT.GETMOVEDIR, null);
      if (!['back', 'right', 'left', 'forward'].includes(direction))
        choices.push({ id: CHOICE_USE, text: this.engineText(this.text.USE) });
    }
    choices.push({ id: EVENT.LOOKAT, text: this.engineText(this.text.LOOK_AT) });
    choices.push({ id: CHOICE_BACK, text: this.engineText(this.text.BACK) });
    return choices;
  }

  // The left and right keys in ExtBase.inventoryUseItemMenuKeyHandling.
  cycleInventory(step) {
    const menu = this.menus.at(-1);
    if (menu.items.length < 2) return;
    const index = (menu.index + step + menu.items.length) % menu.items.length;
    // The original re-centers on the cursor here. A keypad's cursor stays still, but a
    // mouse's is on the arrow, so the page keeps its place instead of jumping away.
    this.menus[this.menus.length - 1] = { ...this.inventoryPage(menu.items, index), x: menu.x, y: menu.y };
  }

  handleInventoryInput(menu, clicked, keys) {
    for (const key of keys) {
      if (this.menus.at(-1) !== menu) return;
      if (key === 'ArrowLeft') this.cycleInventory(-1);
      else if (key === 'ArrowRight') this.cycleInventory(1);
      else if (key === 'ArrowUp') menu.selected = (menu.selected + menu.choices.length - 1) % menu.choices.length;
      else if (key === 'ArrowDown') menu.selected = (menu.selected + 1) % menu.choices.length;
      else if (key === 'Enter') this.chooseItemAction(menu.choices[menu.selected].id);
    }
    if (!clicked || this.menus.at(-1) !== menu) return;
    if (menu.hoveredArrow) this.cycleInventory(menu.hoveredArrow);
    else if (menu.hovered !== undefined && menu.hovered !== null) this.chooseItemAction(menu.choices[menu.hovered].id);
    else if (menu.overPage === false) this.menus.pop();
  }

  chooseItemAction(choiceId) {
    if (choiceId === CHOICE_BACK) {
      this.menus.pop();
    } else if (choiceId === CHOICE_USE) {
      if (this.overObject.executeEvent(EVENT.USEITEM, 0) === 0) this.say(this.useItemText, null);
    } else if (choiceId === EVENT.EQUIP || choiceId === EVENT.UNEQUIP) {
      // Port of Ext.inventoryEquipUnequipHandling.
      this.menus = [];
      const before = this.ammo;
      this.executeEventById(this.itemId, choiceId, null);
      this.infoBarTicks = INFO_BAR_TICKS;
      const after = toInt(this.getRaw('sys_ammo'));
      if (after !== before) this.ammoSet(after, false, false);
    } else {
      this.executeEventById(this.itemId, choiceId, null);
    }
  }

  // Rooms.
  startNewGame() {
    this.resetRun();
    this.tickTime = 0;
    this.paintingTime = null;
    this.setupDone = false;
    this.roomInit('setup', false);
  }

  resetRun() {
    this.mainMenu = null;
    this.vars.clear();
    this.actionKeys.clear();
    this.menus = [];
    this.choiceMenu = null;
    this.pausedThread = null;
    this.waitStop = 0;
    this.objects = null;
    this.ended = false;
    this.pendingClick = false;
    this.pendingKeys = [];
    this.pendingRoom = null;
    this.tickObject = null;
    this.hideCursor = false;
    this.requestedRoom = null;
    this.lastRequestedRoom = null;
    this.soundPaused = false;
    this.popups = [];
    this.transitionRequested = false;
    this.transitionCounter = null;
    this.bossDead = false;
    this.superBossDead = false;
    this.resetBattle();
    this.stopSound();
  }

  // Saving. A save is the variables and action keys, as in ExtBase.saveGameInRMS,
  // so it holds no running script. The key keeps saves from mixing between builds
  // whose scripts or text differ, because variables can hold game text. As in the
  // original, there's one save whichever language is chosen.
  get saveKey() {
    if (!this.cachedSaveKey) {
      let hash = 0x811c9dc5;
      const names = [...this.data.entries.keys()].filter((name) => /\/(scr|rom|lan)\//.test(name)).sort();
      for (const name of names) {
        for (const byte of this.data.entries.get(name)) hash = Math.imul(hash ^ byte, 0x01000193);
      }
      this.cachedSaveKey = `silent-hill-mobile:${this.dataDir}:${(hash >>> 0).toString(16)}`;
    }
    return this.cachedSaveKey;
  }

  readSave() {
    try {
      const save = JSON.parse(this.storage.getItem(this.saveKey) ?? this.storage.getItem(this.englishSaveKey));
      return save?.version === SAVE_VERSION && Array.isArray(save.vars) && Array.isArray(save.actionKeys) ? save : null;
    } catch {
      return null;
    }
  }

  // Where a save was kept when each language had its own.
  get englishSaveKey() {
    return this.saveKey.replace(/:(?=[^:]+$)/, ':en:');
  }

  // The original's new game removes the old save, after warning that it will.
  removeSave() {
    try {
      this.storage.removeItem(this.saveKey);
      this.storage.removeItem(this.englishSaveKey);
    } catch {
      return;
    }
    this.cachedHasSave = false;
  }

  hasSave() {
    if (this.cachedHasSave === undefined) this.cachedHasSave = this.readSave() !== null;
    return this.cachedHasSave;
  }

  // The rule from Ext.createEscapeMenu: the room must be a save point, with no
  // script mid-way and no battle running.
  canSave() {
    return (
      Boolean(this.objects) &&
      !this.ended &&
      this.saveAllowedInRoom &&
      !this.popups.length &&
      !this.menus.length &&
      !this.pausedThread &&
      !this.battleMode &&
      this.pendingRoom === null &&
      this.currentRoom.length > 0
    );
  }

  // Port of M.saveGame and ExtBase.saveGameInRMS. Someone without the gun has their
  // ammo held aside, so it's put back in the variables for the length of the save.
  saveGame(announce = true) {
    this.syncGunState();
    if (!this.gunState) this.ammoSet(this.ammoInGun, false, true);
    let saved = false;
    try {
      const vars = [...this.vars].map(([name, { value, hint }]) => [name, value, hint]);
      this.storage.setItem(
        this.saveKey,
        JSON.stringify({
          version: SAVE_VERSION,
          room: this.currentRoom,
          savedAt: this.now(),
          vars,
          actionKeys: [...this.actionKeys],
        }),
      );
      saved = true;
      this.cachedHasSave = true;
      this.changedSinceSave = false;
    } catch {
      saved = false;
    }
    if (!this.gunState) this.ammoSet(0, false, true);
    if (announce) this.popupCreate(this.engineText(saved ? this.text.SAVED : this.text.SAVE_FAILED));
    return saved;
  }

  // Port of ExtBase.loadGameFromRMS and M.startSavedGame: the setup room runs again,
  // and its script then returns to the saved room.
  loadGame() {
    const save = this.readSave();
    if (!save) return false;
    this.resetRun();
    for (const [name, value, hint] of save.vars) this.setRaw(name, value, hint);
    for (const [key, scriptId] of save.actionKeys) this.actionKeys.set(key, scriptId);
    this.restoreGunState();
    // Far enough on that the painting in room 0 has finished, as in M.startSavedGame.
    this.tickTime = LOADED_GAME_TIME;
    this.paintingTime = 1;
    this.setupDone = true;
    this.firstLoad = true;
    this.roomInit('setup', false);
    return true;
  }

  restoreGunState() {
    this.gunState = this.inventorySize('invGun') > 0;
    if (!this.gunState) {
      this.ammoInGun = toInt(this.getRaw('sys_ammo'));
      this.ammo = 1;
      this.ammoSet(0, true, true);
    }
  }

  // Port of ExtBase.popupCreate. A popup holds up all input until it's answered, and
  // later ones wait their turn, while the room's scripts carry on underneath.
  popupCreate(text) {
    if (this.popups.length < POPUP_LIMIT) this.popups.push(text);
  }

  // Port of ExtBase.popupKeyHandling. The original answers these with only its left
  // soft key, labeled OK, which a click also stands for here.
  handlePopupInput(clicked, keys) {
    if ((!clicked && !keys.includes('Enter')) || this.now() < this.popupReadyAt) return;
    this.popups.shift();
    if (this.popups.length) this.popupReadyAt = this.now() + POPUP_NEXT_MS;
  }

  roomAddToHistory(room) {
    if (room === this.roomLastInHistory()) return;
    const size = this.roomHistorySize() + 1;
    this.setRaw(`room-${size}`, room, 'R');
    this.setRaw('room-size', String(size), 'R');
  }

  roomLastInHistory() {
    return this.getRaw(`room-${this.roomHistorySize()}`);
  }

  roomHistorySize() {
    return toInt(this.getRaw('room-size'));
  }

  gotoCommand(thread, args) {
    let room = args[0];
    if (this.roomHistorySize() === 0 && room === 'back') room = null;
    const history = args.length > 2 ? toBoolean(args[2]) : false;
    if (this.transitionsEnabled && args.length > 1) this.transitionRequested = toBoolean(args[1]);
    this.menus = [];
    if (room === 'moon_intro' || room === 'karen_intro') this.popups = [];
    if (room) this.roomInit(room, history);
    thread.status = STATUS.STOPPED;
  }

  // Port of ExtBase.roomInit. The room itself loads on the next tick, as in the
  // original, where a thread did it.
  roomInit(requested, history) {
    let room = requested;
    this.bossDead = false;
    this.lastRequestedRoom = this.requestedRoom;
    this.requestedRoom = requested;
    this.changedSinceSave = false;
    if (room === 'setup') {
      this.transitionsEnabled = false;
      this.transitionColor = -1;
    }
    this.tickObject = null;
    this.hideCursor = false;
    this.overObject = null;
    this.hoverObject = null;
    if (room !== 'setup') {
      if (room === 'back') {
        room = this.roomLastInHistory();
        const size = this.roomHistorySize();
        if (size > 0) {
          this.unsetRaw(`room-${size}`);
          this.setRaw('room-size', String(size - 1), 'R');
        }
      } else if (history && room !== this.currentRoom) {
        this.roomAddToHistory(this.currentRoom);
      }
      this.setRaw('cur-curRoom', room, 'C');
    }
    this.nextRoomInit = true;
    this.pendingRoom = room;
    this.stopSound();
  }

  loadPendingRoom() {
    const room = this.pendingRoom;
    this.pendingRoom = null;
    const bytes = this.data.entries.get(`${this.dataDir}/rom/${room}.bin`);
    if (!bytes) throw new Error(`Missing room: ${room}`);
    const parsed = parseRoom(bytes, { wideZones: usesWideZones(this.dataDir) });
    this.currentRoomId = room;
    this.roomLoading();
    this.saveAllowedInRoom = parsed.strings.includes('savePoint');
    this.objects = parsed.objects.map((source) => new RoomObject(source, this));
    this.roomEntered = false;
    this.roomUpdateNeeded = true;
    this.enemySoundPlayed = false;
    if (this.transitionRequested && this.roomTransitions && this.transitionCounter === null)
      this.transitionCounter = TRANSITION_START;
    this.transitionRequested = false;
  }

  roomLoading() {}

  // Port of M.roomCheckUpdate.
  roomCheckUpdate() {
    if (!this.roomUpdateNeeded) return;
    this.roomUpdateNeeded = false;
    if (!this.objects) return;
    this.nextRoomInit = false;
    for (const object of this.objects) {
      object.update();
      if (this.nextRoomInit) return;
    }
    this.roomEntered = true;
  }

  // Input.
  moveCursor(x, y) {
    this.pointerX = x;
    this.pointerY = y;
    this.placeCursor();
    const menu = this.menus.at(-1);
    if (menu?.id === MENU.VERBS) menu.selected = this.verbAtCursor(menu);
  }

  placeCursor() {
    this.cursorX = Math.max(0, Math.min(this.roomWidth - 1, Math.round(this.pointerX + this.recoilOffsetX)));
    this.cursorY = Math.max(0, Math.min(this.roomHeight - 1, Math.round(this.pointerY + this.recoilOffsetY)));
  }

  // Port of the recoil in Ext.battleKeyHandling. As on the original's keypad, it moves
  // a cursor that's steered with keys or a captured mouse, and the player has to steer
  // it back. A free mouse's position is its own, so with one, the kick settles back.
  applyRecoil() {
    if (this.recoilVertical !== 0) {
      if (this.aimingWithKeys || this.pointerLocked) {
        this.pointerX = Math.max(0, Math.min(this.roomWidth - 1, this.pointerX + this.recoilHorizontal));
        this.pointerY = Math.max(0, Math.min(this.roomHeight - 1, this.pointerY - this.recoilVertical));
      } else {
        this.recoilOffsetX += this.recoilHorizontal;
        this.recoilOffsetY -= this.recoilVertical;
      }
      this.recoilVertical >>= 1;
      if (this.recoilVertical <= 1) this.recoilVertical = 0;
    } else {
      this.recoilOffsetX = Math.trunc(this.recoilOffsetX / 2);
      this.recoilOffsetY = Math.trunc(this.recoilOffsetY / 2);
    }
    this.placeCursor();
  }

  // A press that starts a stroke rather than a click. Only Mobile 2 has these.
  wantsStroke() {
    return false;
  }

  verbAtCursor(menu) {
    const { x, y } = verbWheelCenter(menu, this.roomWidth, this.roomHeight);
    const dx = this.cursorX - x;
    const dy = this.cursorY - y;
    const distance = Math.hypot(dx, dy);
    if (distance > VERB_WHEEL_RADIUS || distance < VERB_WHEEL_DEAD_ZONE) return null;
    if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? VERB.LOOK : VERB.MOUTH;
    return dx > 0 ? VERB.HAND : VERB.INVENTORY;
  }

  click() {
    this.pendingClick = true;
  }

  pressKey(key) {
    this.pendingKeys.push(key);
  }

  // Port of the original's ExtBase.appKeyHandling, once per tick.
  handleInput() {
    let menu = this.menus.at(-1);
    const clicked = this.pendingClick;
    const keys = this.pendingKeys;
    this.pendingClick = false;
    this.pendingKeys = [];
    if (this.popups.length) {
      this.handlePopupInput(clicked, keys);
      return;
    }
    // MyCanvas ignores keys during a transition, and ExtBase.appKeyHandling once the
    // final boss is dead.
    if ((this.transitionCounter !== null && this.transitionCounter > TRANSITION_END) || this.finalBossDead()) return;
    if (!menu) this.playEnemyCue();
    if (!menu && !this.isAiming()) this.updateHover();
    if (this.battleMode && !menu && this.battleInput(clicked, keys)) return;
    if (this.isWaiting()) return;
    // A wait that has just ended can have opened new text, and keys belong to what's on top.
    // Closing that text by mistake would leave its script waiting forever.
    menu = this.menus.at(-1);

    if (keys.includes('Escape')) this.handleEscape(menu);
    if (menu?.id === MENU.INVENTORY) {
      this.handleInventoryInput(menu, clicked, keys);
      return;
    }
    if (menu?.id === MENU.PAUSE) {
      if (this.menus.at(-1) === menu) this.handlePauseInput(menu, clicked, keys);
      return;
    }
    if (menu) {
      if (menu.id === MENU.SAY) this.scrollSay(menu, keys);
      if (menu.id === MENU.CHOICE) this.moveChoice(menu, keys);
      if (menu.id === MENU.VERBS) this.moveVerb(menu, keys);
      if (keys.includes('Enter')) this.confirmMenu(menu);
      else if (clicked) this.handleMenuClick(menu);
      return;
    }
    if (clicked || keys.includes('Enter')) this.handleRoomClick();
    if (keys.includes('hotspot-next')) this.cycleHotspot(1);
    if (keys.includes('hotspot-previous')) this.cycleHotspot(-1);
    if (keys.includes('back')) this.goBack();
    if (keys.includes('pause')) this.openPauseMenu();
    const move = keys.find((key) => key.startsWith('move-'));
    if (move) this.moveInDirection(move.slice('move-'.length));
    if (keys.includes('map')) this.showMap();
    if (keys.includes('inventory')) this.openInventory();
    this.runActionKeys(keys);
  }

  finalBossDead() {
    return this.bossDead && this.currentRoom === FINAL_BOSS_ROOM;
  }

  isStoryRoom() {
    const room = this.currentRoom.toLowerCase();
    return (
      room === 'control' ||
      room === 'karen_fall_sleep' ||
      room === 'ben_backtolight' ||
      room.includes('intro') ||
      room.includes('end')
    );
  }

  speakerColor(speaker) {
    const match = this.constructor.SPEAKER_TEXTS.find(([text]) => this.engineText(text) === speaker);
    return match ? match[1] : this.menuTextColor;
  }

  // What the phone's two soft keys do now, from Ext.appPaint and the key handling.
  // The page shows them as buttons.
  softKeys() {
    if (this.mainMenu) return this.mainMenu.softKeys();
    if (!this.objects || this.ended) return {};
    const key = (text, action) => ({ label: this.engineText(text), action });
    if (this.popups.length) return { left: key(this.text.OK, 'click') };
    const menu = this.menus.at(-1);
    if (menu) {
      if (menu.id === MENU.SAY || menu.id === MENU.TEXT_FADE) {
        if (this.isStoryRoom()) return { left: key(this.text.NEXT, 'click'), right: key(this.text.SKIP, 'escape') };
        return menu.id === MENU.SAY ? { left: key(this.text.OK, 'click') } : {};
      }
      if (menu.id === MENU.PAUSE) return { left: key(this.text.SELECT, 'Enter'), right: key(this.text.BACK, 'Escape') };
      if (menu.id === MENU.RECEIVED) return { left: key(this.text.OK, 'click') };
      return { left: key(this.text.SELECT, 'Enter'), right: key(this.text.BACK, 'escape') };
    }
    const room = this.currentRoom.toLowerCase();
    if (room.includes('intro')) return {};
    if (room.includes('floor') || room === 'children_drawing') return { right: key(this.text.BACK, 'back') };
    if (this.superBossDead) return {};
    // The rules in Ext.appPaint for which labels show.
    const afterClock = this.requestedRoom === '5' && this.lastRequestedRoom === 'clockPuzzle';
    const noPause = afterClock || NO_PAUSE_ROOMS.has(this.currentRoom);
    const pause = !noPause && this.canPause() ? key(this.text.MENU, 'pause') : undefined;
    if (room.includes('puzzle')) {
      const solved = room === 'safepuzzle' && toBoolean(this.getRaw('var_safePuzzleSolved'));
      return { left: solved ? undefined : key(this.text.BACK, 'back'), right: pause };
    }
    if (!this.battleMode && !afterClock && this.inventorySize('invMap') > 0)
      return { left: key(this.text.MAP, 'map'), right: pause };
    return { right: pause };
  }

  pressSoftKey(side) {
    const key = this.softKeys()[side];
    if (!key) return false;
    if (key.action === 'click') this.click();
    else if (key.action === 'escape') this.pressKey('Escape');
    else this.pressKey(key.action);
    return true;
  }

  // The rooms that are purely story hide the cursor, and have nothing to pause for.
  canPause() {
    return (
      Boolean(this.objects) &&
      !this.hideCursor &&
      !this.pausedThread &&
      !this.menus.length &&
      !this.currentRoom.toLowerCase().includes('intro')
    );
  }

  // Port of ExtBase.createEscapeMenu, without the Reload choice it offers when a room
  // fails to load.
  openPauseMenu() {
    if (!this.canPause()) return;
    // Ext.createEscapeMenu cuts off a monster's attack animation.
    this.attackAnim = false;
    const choices = [{ id: 'continue', text: this.engineText(this.text.CONTINUE) }];
    if (this.canSave()) choices.push({ id: 'save', text: this.engineText(this.text.SAVE) });
    choices.push(
      { id: 'settings', text: this.engineText(this.text.SETTINGS) },
      { id: 'help', text: this.engineText(this.text.HELP) },
    );
    if (this.canLeaveFromPause()) choices.push({ id: 'leave', text: this.engineText(this.text.MAIN_MENU) });
    this.openPausePage(choices);
  }

  canLeaveFromPause() {
    return true;
  }

  // The rule in ExtBase.ingameMenuKeyHandling.
  leavesWithoutAsking() {
    return !this.changedSinceSave || this.currentRoom.toLowerCase() === 'control' || Boolean(this.pausedThread);
  }

  openPausePage(choices, title = null) {
    this.menus.push({ id: MENU.PAUSE, title, choices, selected: 0, rows: [] });
  }

  handlePauseInput(menu, clicked, keys) {
    const count = menu.choices.length;
    if (keys.includes('ArrowUp')) menu.selected = (menu.selected + count - 1) % count;
    if (keys.includes('ArrowDown')) menu.selected = (menu.selected + 1) % count;
    if (clicked && menu.hovered !== null && menu.hovered !== undefined) menu.selected = menu.hovered;
    else if (!keys.includes('Enter')) return;
    this.choosePauseItem(menu, menu.choices[menu.selected].id);
  }

  choosePauseItem(menu, id) {
    switch (id) {
      case 'continue':
      case 'no':
        this.menus.pop();
        break;
      case 'save':
        this.menus.pop();
        if (this.canSave()) this.saveGame();
        break;
      case 'settings':
        this.openPausePage(this.pauseSettings());
        break;
      case 'sound':
        this.toggleSound();
        menu.choices = this.pauseSettings();
        break;
      case 'transitions':
        this.toggleRoomTransitions();
        menu.choices = this.pauseSettings();
        break;
      case 'pixelFont':
        this.togglePixelFont();
        menu.choices = this.pauseSettings();
        break;
      case 'mouseLock':
        this.toggleMouseLock();
        menu.choices = this.pauseSettings();
        break;
      case 'help':
        this.openPausePage([
          { id: 'gameplay', text: this.engineText(this.text.GAMEPLAY) },
          { id: 'controls', text: this.engineText(this.text.CONTROLS) },
        ]);
        break;
      case 'gameplay':
        this.say(this.gameplayHelp(), null, true);
        this.menus.at(-1).fromPause = true;
        break;
      case 'controls':
        this.say(this.controlsHelp(), null, true);
        this.menus.at(-1).fromPause = true;
        break;
      case 'leave':
        if (this.leavesWithoutAsking()) {
          this.endGameRequested = true;
          break;
        }
        this.openPausePage(
          [
            { id: 'yes', text: this.engineText(this.text.YES) },
            { id: 'no', text: this.engineText(this.text.NO) },
          ],
          this.engineText(this.text.LEAVE_GAME),
        );
        this.menus.at(-1).selected = 1;
        break;
      case 'yes':
        this.endGameRequested = true;
        break;
      default:
    }
  }

  // Ext.scrGoBack: does what the room's own "back" hotspot does.
  goBack() {
    for (const object of this.objects ?? []) {
      if (
        object.active &&
        object.executeEvent(EVENT.GETMOVEDIR, null) === 'back' &&
        object.executeEvent(EVENT.CLICK, -1) === null
      )
        return;
    }
  }

  // Ext.showMap: looks at the map item, whose script offers the floors.
  showMap() {
    if (this.inventorySize('invMap') === 0) return;
    this.itemId = 'invMap';
    this.executeEventById('invMap', EVENT.LOOKAT, null);
  }

  // From ExtBase.ingameMoveKeyHandling: a growl the first time the flashlight
  // finds a monster in a room.
  playEnemyCue() {
    if (this.enemySoundPlayed || !this.cursorAnim || !this.objects) return;
    const info = this.imageInfo(this.cursorAnim.frames[this.cursorAnim.frame]);
    if (!info) return;
    const halfWidth = info.width >> 1;
    const halfHeight = info.height >> 1;
    for (const object of this.objects) {
      if (!object.visible || !object.script?.hasEvent(EVENT.ENEMYATTACK)) continue;
      if (
        object.x - AIM_RADIUS > this.cursorX - halfWidth &&
        object.x + AIM_RADIUS < this.cursorX + halfWidth &&
        object.y - AIM_RADIUS > this.cursorY - halfHeight &&
        object.y + AIM_RADIUS < this.cursorY + halfHeight
      ) {
        this.enemySoundPlayed = true;
        this.playSound('sh_monster_hurt');
        return;
      }
    }
  }

  isAiming() {
    return this.battleMode && toInt(this.getRaw('sys_battleState')) !== 0;
  }

  // Port of Ext.battleKeyHandling. Returns whether it used the input.
  battleInput(clicked, keys) {
    this.battleState = toInt(this.getRaw('sys_battleState'));
    if (this.battleState === 0) return false;
    if (keys.includes('Escape') || keys.includes('pause')) {
      this.openPauseMenu();
      return true;
    }
    if (clicked) this.aimingWithKeys = false;
    else if (keys.includes('Enter')) this.aimingWithKeys = true;
    if ((clicked || keys.includes('Enter')) && this.canFire()) this.shot = true;
    this.applyRecoil();
    if (!this.attackAnim) this.runActionKeys(keys);
    return true;
  }

  canFire() {
    return this.ammo > 0 && !this.reloading;
  }

  runActionKeys(keys) {
    for (const key of keys) {
      const scriptId = this.actionKeys.get(`actionkey_num${key}`);
      if (scriptId) this.executeEventById(scriptId, EVENT.CLICK, -1);
    }
  }

  updateHover() {
    this.overObject = null;
    if (!this.objects) return;
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const object = this.objects[i];
      if (object.isOver(this.cursorX, this.cursorY)) {
        this.overObject = object;
        if (this.hoverObject !== object && !this.isWaiting()) {
          if (this.hoverObject) {
            this.hoverObject.executeEvent(EVENT.HOOVEROUT, null);
            this.hoverObject = null;
          } else if (object.script?.hasEvent(EVENT.HOOVERIN)) {
            object.executeEvent(EVENT.HOOVERIN, null);
            this.hoverObject = object;
          }
          return;
        }
        if (this.hoverObject) return;
      } else if (this.hoverObject === object) {
        this.hoverObject.executeEvent(EVENT.HOOVEROUT, null);
        this.hoverObject = null;
        return;
      }
    }
  }

  handleRoomClick() {
    const object = this.overObject;
    if (!object || this.hideCursor) return;
    this.useObject(object);
  }

  useObject(object) {
    if (object.executeEvent(EVENT.CLICK, -1) === null) return;
    this.openVerbMenu(object);
  }

  // A point on this object that no later object covers, as a click would find it.
  clickPointOn(object) {
    const covering = this.objects
      .slice(this.objects.indexOf(object) + 1)
      .filter(({ visible, active }) => visible && active);
    const { left, right, top, bottom } = object;
    const xs = [(left + right) >> 1];
    const ys = [(top + bottom) >> 1];
    for (let part = 1; part < POINTS_ACROSS; part++) {
      xs.push(Math.round(left + ((right - left) * part) / POINTS_ACROSS));
      ys.push(Math.round(top + ((bottom - top) * part) / POINTS_ACROSS));
    }
    for (const x of xs) {
      for (const y of ys) {
        const onScreen = x >= 0 && y >= 0 && x < this.roomWidth && y < this.roomHeight;
        if (onScreen && object.isOver(x, y) && !covering.some((other) => other.isOver(x, y))) return [x, y];
      }
    }
    return null;
  }

  // What can be clicked in the room, in reading order. A door can be made of two
  // zones with the same script, and those count as one.
  hotspots() {
    const seen = new Set();
    const row = ({ top, bottom }) => Math.round((top + bottom) / 2 / HOTSPOT_ROW_HEIGHT);
    const middle = ({ left, right }) => (left + right) / 2;
    return (this.objects ?? [])
      .filter(
        (object) =>
          object.visible &&
          object.active &&
          CLICKABLE_EVENTS.some((event) => object.script?.hasEvent(event)) &&
          this.clickPointOn(object),
      )
      .sort((one, two) => row(one) - row(two) || middle(one) - middle(two))
      .filter(({ scriptId }) => !seen.has(scriptId) && seen.add(scriptId));
  }

  // This port's own addition: Q and E put the cursor on each thing that can be clicked.
  cycleHotspot(step) {
    if (this.hideCursor) return;
    const hotspots = this.hotspots();
    if (!hotspots.length) return;
    const currentScript = (this.overObject ?? this.lastHotspot)?.scriptId;
    const current = hotspots.findIndex(({ scriptId }) => scriptId === currentScript);
    const index =
      current === -1 ? (step > 0 ? 0 : hotspots.length - 1) : (current + step + hotspots.length) % hotspots.length;
    this.lastHotspot = hotspots[index];
    this.moveCursor(...this.clickPointOn(this.lastHotspot));
  }

  // A tap shorter than a tick still counts, for small corrections to the aim.
  // The mouse takes over aiming as soon as it moves.
  aimWithMouse() {
    this.aimingWithKeys = false;
  }

  holdDirection(direction, held) {
    if (held) {
      this.heldDirections.add(direction);
      this.tappedDirections.add(direction);
    } else {
      this.heldDirections.delete(direction);
    }
  }

  releaseDirections() {
    this.heldDirections.clear();
    this.tappedDirections.clear();
  }

  // Port of ExtBase.ingameMoveKeyHandling, for aiming: the cursor gathers speed while a
  // key is held, and stops when it's let go. Both directions can be held, for diagonals.
  moveAimWithKeys() {
    if (!this.isAiming() || this.menus.length || this.popups.length) {
      this.cursorSpeedX = 0;
      this.cursorSpeedY = 0;
      this.tappedDirections.clear();
      return;
    }
    const pressed = (direction) => this.heldDirections.has(direction) || this.tappedDirections.has(direction);
    if (['left', 'right', 'up', 'down'].some(pressed)) this.aimingWithKeys = true;
    const change = (speed, minus, plus) => {
      const step = pressed(plus) ? 1 : pressed(minus) ? -1 : -speed;
      return Math.abs(speed + step) <= CURSOR_TOP_SPEED ? speed + step : speed;
    };
    this.cursorSpeedX = change(this.cursorSpeedX, 'left', 'right');
    this.cursorSpeedY = change(this.cursorSpeedY, 'up', 'down');
    this.tappedDirections.clear();
    if (!this.cursorSpeedX && !this.cursorSpeedY) return;
    const clamp = (value, size) => Math.max(0, Math.min(size - 1, value));
    this.moveCursor(
      clamp(this.pointerX + this.cursorSpeedX, this.roomWidth),
      clamp(this.pointerY + this.cursorSpeedY, this.roomHeight),
    );
  }

  // This port's own addition: the original's keys only moved the cursor. A key does
  // what clicking the room's exit in that direction would do. Two rooms have two
  // forward exits, and the one nearer the cursor is used.
  moveInDirection(direction) {
    if (this.hideCursor) return;
    const distance = ({ left, right, top, bottom }) =>
      ((left + right) / 2 - this.cursorX) ** 2 + ((top + bottom) / 2 - this.cursorY) ** 2;
    const exits = (this.objects ?? []).filter(
      (object) =>
        object.visible && object.active && this.exitGoes(object.executeEvent(EVENT.GETMOVEDIR, null), direction),
    );
    if (exits.length)
      this.useObject(exits.reduce((nearest, exit) => (distance(exit) < distance(nearest) ? exit : nearest)));
  }

  exitGoes(moveDirection, direction) {
    return moveDirection === direction;
  }

  moveChoice(menu, keys) {
    const count = menu.choices.length;
    if (keys.includes('ArrowUp')) menu.selected = ((menu.selected ?? 0) + count - 1) % count;
    if (keys.includes('ArrowDown')) menu.selected = ((menu.selected ?? 0) + 1) % count;
  }

  // Ext.ingameMenuKeyHandling: each direction goes to the verb on that arm of the wheel.
  moveVerb(menu, keys) {
    for (const key of keys) {
      const verb = this.verbForKey(key);
      if (verb !== undefined) menu.selected = verb;
    }
  }

  verbForKey(key) {
    return VERB_KEYS[key];
  }

  // Enter does what clicking the highlighted row or arm would do.
  confirmMenu(menu) {
    if (menu.id === MENU.CHOICE) {
      menu.hovered = menu.selected ?? 0;
      this.handleMenuClick(menu);
    } else if (menu.id === MENU.VERBS) {
      if (menu.selected !== null && menu.selected !== undefined) this.chooseVerb(menu.selected);
    } else if (menu.id === MENU.SAY || menu.id === MENU.RECEIVED) {
      this.handleMenuClick(menu);
    }
  }

  scrollSay(menu, keys) {
    for (const key of keys) {
      if (key === 'ArrowUp') menu.scroll = Math.max(menu.scroll - 1, 0);
      if (key === 'ArrowDown') menu.scroll = Math.min(menu.scroll + 1, menu.maxScroll);
    }
  }

  handleMenuClick(menu) {
    switch (menu.id) {
      case MENU.SAY:
        if (menu.scroll < menu.maxScroll) {
          menu.scroll = Math.min(menu.scroll + menu.pageLines, menu.maxScroll);
          return;
        }
        this.menus.pop();
        this.resume();
        return;
      case MENU.RECEIVED:
        this.menus.pop();
        this.resume();
        return;
      case MENU.CHOICE:
        if (menu.hovered === undefined || menu.hovered === null) return;
        this.choiceId = menu.choices[menu.hovered].id;
        this.menus.pop();
        this.resume();
        return;
      case MENU.VERBS:
        menu.selected = this.verbAtCursor(menu);
        if (menu.selected === null) this.menus.pop();
        else this.chooseVerb(menu.selected);
        return;
      default:
    }
  }

  // The back key skips text only in rooms that are purely story, per
  // ExtBase.ingameMenuKeyHandling. It closes other menus.
  handleEscape(menu) {
    const room = this.currentRoom.toLowerCase();
    if (!menu) {
      if (this.escapeGoesBack(room)) this.goBack();
      else this.openPauseMenu();
      return;
    }
    if (menu.fromPause) {
      this.menus.pop();
      return;
    }
    if (menu.id === MENU.SAY || menu.id === MENU.TEXT_FADE) {
      if (!this.canSkipText(menu)) return;
      this.menus.pop();
      for (
        let i = 0;
        i < 1000 &&
        !this.endGameRequested &&
        this.currentRoom.toLowerCase() === room &&
        this.pausedThread &&
        this.textSkipContinues();
        i++
      ) {
        this.waitStop = 0;
        this.resume();
      }
      this.textSkipEnded();
    } else if (menu.id === MENU.CHOICE) {
      this.pausedThread = null;
      this.menus.pop();
    } else {
      this.menus.pop();
    }
  }

  escapeGoesBack(room) {
    return room.includes('floor') || room === 'children_drawing' || room.includes('puzzle');
  }

  canSkipText() {
    return this.isStoryRoom();
  }

  textSkipContinues() {
    return true;
  }

  textSkipEnded() {
    this.menus = [];
  }

  // One 60 ms engine tick. M.tickBasedTimeUpdate advances the animation clock by
  // the same amount.
  tick() {
    if (this.mainMenu) {
      this.mainMenu.tick();
      return;
    }
    if (this.ended) return;
    // The original's animation clock only advances in the key handling a popup skips.
    if (!this.popups.length) this.tickTime += TICK_MS;
    const fading = this.menus.at(-1);
    if (fading?.id === MENU.TEXT_FADE) this.updateTextFade(fading);
    this.moveAimWithKeys();
    this.handleInput();
    this.updatePauseSound();
    if (this.pendingRoom !== null) this.loadPendingRoom();
    this.roomCheckUpdate();
    if (this.pendingRoom !== null) this.loadPendingRoom();
    if (!this.menus.length && !this.pausedThread && this.tickObject && --this.tickInterval <= 0) {
      this.tickInterval = TICK_EVENT_INTERVAL;
      this.tickObject.executeEvent(EVENT.TICK, null);
    }
    this.paintPhase();
    // M.endGame returns to the main menu.
    if (this.endGameRequested) {
      this.endGameRequested = false;
      this.resetRun();
      this.ended = true;
      this.showMainMenu();
    }
  }

  // The game logic that Ext.appPaint runs once per frame, before it draws.
  paintPhase() {
    this.battleState = toInt(this.getRaw('sys_battleState'));
    // Unlike the original, a paused battle stops. There, only a phone call stopped it.
    if (this.battleMode && !this.menus.some((menu) => menu.id === MENU.PAUSE)) this.battleUpdate();
    this.life = toInt(this.getRaw('sys_health'));
    this.isWaiting();
    this.syncGunState();
    if (this.hudAmmoUpdateNeeded) this.hudUpdate();
    if (this.infoBarTicks > 0) this.infoBarTicks--;
    this.battleState = toInt(this.getRaw('sys_battleState'));
    if (this.battleState > 0) {
      this.aimShakeX = this.randomInt(2) > 0 ? -1 : 1;
      this.aimShakeY = this.randomInt(2) > 0 ? -1 : 1;
    } else {
      this.aimShakeX = 0;
      this.aimShakeY = 0;
    }
    if (this.cursorAnim) this.advanceCursorAnim();
    if (this.dissolve) this.updateDissolve();
    if (this.transitionCounter !== null) {
      if (this.transitionCounter <= TRANSITION_END) this.transitionCounter = null;
      else this.transitionCounter--;
    }
  }

  // The first frame of a transition draws over the old room, which is still on screen.
  get transitionKeepsOldRoom() {
    return this.transitionCounter === TRANSITION_OLD_ROOM;
  }

  // Port of the transition in Ext.appPaint: the dissolve pattern, solid color, then the
  // pattern again over the new room.
  transitionItems() {
    const counter = this.transitionCounter;
    if (counter === null) return [];
    if (counter > TRANSITION_NEW_ROOM && counter < TRANSITION_OLD_ROOM) {
      const color = this.transitionColor === -1 ? this.backgroundColor : this.transitionColor;
      return [{ kind: 'rect', x: 0, y: 0, width: this.roomWidth, height: this.roomHeight, color }];
    }
    return [{ kind: 'dissolve-pattern' }];
  }

  randomInt(limit) {
    return Math.floor(this.random() * limit);
  }

  // Port of Ext.battleStartInit.
  battleStartInit() {
    this.ammoSet(toInt(this.getRaw('sys_ammo')), false, false);
    const hasEnemy = this.objects?.some(
      (object) => object.visible && object.script?.hasEvent(EVENT.GETHEROATTACKANIM1),
    );
    if (hasEnemy) {
      this.enemyForceAttack = false;
      this.enemyState = ENEMY_STATE.SHOCK;
      this.enemyStateTime = ENEMY_ATTACK_TIME;
      this.setRaw('moveAnim', '0', 'I');
      this.setRaw('sys_battleState', '2', 'I');
      this.battleState = 2;
    } else {
      this.enemyState = ENEMY_STATE.DIE;
    }
    this.battleMode = true;
    this.attackAnim = false;
    this.roomUpdateNeeded = true;
  }

  // Port of Ext.enemyAnimUpdate.
  enemyAnimUpdate() {
    this.setRaw('moveAnim', '0', 'I');
    for (const object of this.objects ?? []) {
      if (object.visible && object.script?.hasEvent(EVENT.GETHEROATTACKANIM1)) {
        object.update();
        object.idleAnimationTime = 0;
      }
    }
  }

  // Port of Ext.battleUpdate, which is one long pass over the room's objects.
  battleUpdate() {
    const now = this.now();
    this.fightDraws = [];
    if (this.battleState === 2 && !this.menus.length && this.inventorySize('invGun') > 0) {
      this.specialCursor = { idle: 'haircross', hover: 'jb' };
    }

    if (this.enemyState === ENEMY_STATE.ATTACK || this.enemyState === ENEMY_STATE.SHOCK) {
      this.enemyStateTime--;
      if (this.enemyStateTime < 0) {
        if (!this.cursorAnim && this.enemyState === ENEMY_STATE.SHOCK) {
          this.enemyForceAttack = true;
          this.enemyState = ENEMY_STATE.WAIT;
          if (this.battleState < 2) this.setBattleState(2);
        } else if (this.enemyState === ENEMY_STATE.ATTACK) {
          this.enemyState = ENEMY_STATE.MOVE_AWAY;
          this.enemyAnimUpdate();
        } else if (this.battleState < 2) {
          this.setBattleState(2);
          this.enemyForceAttack = true;
          this.enemyState = ENEMY_STATE.WAIT;
        } else {
          this.enemyState = ENEMY_STATE.MOVE_AWAY;
          this.enemyAnimUpdate();
        }
      }
    }

    this.overObject = null;
    let hoverHandled = false;
    let movedAway = false;
    const fightIndex = () =>
      this.attackAnimState === 0
        ? ANIMATION_HERO_ATTACK_1
        : this.attackAnimState === 1
          ? ANIMATION_ENEMY_ATTACK_1
          : ANIMATION_ENEMY_ATTACK_2;

    for (const object of this.objects ?? []) {
      if (this.attackAnim) {
        object.fightAnimation(this.fightDraws, fightIndex(), now);
      } else {
        this.attackAnimState = 0;
        object.animationTime = 0;
      }

      if (
        this.cursorAnim &&
        object.script?.hasEvent(EVENT.GETHEROATTACKANIM1) &&
        this.battleState > 0 &&
        this.enemyState === ENEMY_STATE.MOVE_AWAY
      )
        movedAway = true;

      if (object.visible && object.script) {
        const attackWindow =
          (this.enemyState === ENEMY_STATE.ATTACK && this.enemyStateTime > 0) ||
          (this.enemyState === ENEMY_STATE.WAIT && !this.cursorAnim);
        if (
          this.battleState !== 1 &&
          !this.attackAnim &&
          object.script.hasEvent(EVENT.ENEMYATTACK) &&
          (this.randomInt(ATTACK_RANDOM_SPAN) === 0 || this.enemyForceAttack) &&
          attackWindow
        ) {
          this.enemyForceAttack = false;
          this.attackAnimState = 1;
          object.animationTime = 0;
          object.fightAnimation(this.fightDraws, ANIMATION_ENEMY_ATTACK_1, now);
          object.executeEvent(EVENT.ENEMYATTACK, null);
        }

        if (!hoverHandled) hoverHandled = this.battleHover(object);

        if (this.shot && object.script.hasEvent(EVENT.ATTACK1) && this.hoverObject) this.shootHovered(now);
      } else if (this.hoverObject === object) {
        object.executeEvent(EVENT.HOOVEROUT, null);
        this.hoverObject = null;
      }
    }

    if (movedAway) {
      this.enemyState = ENEMY_STATE.WAIT;
      this.enemyAnimUpdate();
    }

    if (this.shot) {
      this.shot = false;
      this.playSound(this.getRaw('sys_gunShotSound') ?? 'sh_shot');
      this.ammoSet(this.ammo - 1, true, true);
      this.recoilVertical += RECOIL_VERTICAL;
      this.recoilHorizontal = this.randomInt(2) === 0 ? -RECOIL_HORIZONTAL : RECOIL_HORIZONTAL;
    }

    this.battleState = toInt(this.getRaw('sys_battleState'));
    if (this.battleState > 1 && this.hoverObject) {
      if (this.battleTimer > 0) {
        if (this.battleTimer - now <= 0) {
          this.battleTimer = 0;
          if (!this.attackAnim) this.attackAnimState = 2;
        }
      } else {
        this.battleTimer = toInt(this.hoverObject.executeEvent(EVENT.GETTIME, 0)) + now;
      }
      this.battleState = toInt(this.getRaw('sys_battleState'));
    }
  }

  setBattleState(state) {
    this.setRaw('sys_battleState', String(state), 'I');
    this.battleState = state;
  }

  // The hover part of Ext.battleUpdate. Returns whether the hover changed.
  battleHover(object) {
    if (this.battleState <= 0) {
      if (object.isOver(this.cursorX, this.cursorY)) {
        this.overObject = object;
        if (this.hoverObject !== object && !this.isWaiting()) {
          if (this.hoverObject) {
            this.hoverObject.executeEvent(EVENT.HOOVEROUT, null);
            this.hoverObject = null;
          } else if (object.script.hasEvent(EVENT.HOOVERIN)) {
            object.executeEvent(EVENT.HOOVERIN, null);
            this.hoverObject = object;
          }
          return true;
        }
        return Boolean(this.hoverObject);
      }
      if (this.hoverObject === object) {
        object.executeEvent(EVENT.HOOVEROUT, null);
        this.hoverObject = null;
        return true;
      }
      return false;
    }

    // While aiming, a target is a small box around the enemy's anchor point.
    const near = (halfWidth, halfHeight) =>
      object.x - AIM_RADIUS > this.cursorX - halfWidth &&
      object.x + AIM_RADIUS < this.cursorX + halfWidth &&
      object.y - AIM_RADIUS > this.cursorY - halfHeight &&
      object.y + AIM_RADIUS < this.cursorY + halfHeight;
    if (this.cursorAnim && object.script.hasEvent(EVENT.ENEMYATTACK)) {
      const info = this.imageInfo(this.cursorAnim.frames[this.cursorAnim.frame]);
      if (info && near(info.width >> 1, info.height >> 1)) {
        if (this.enemyState === ENEMY_STATE.WAIT) {
          this.enemyState = ENEMY_STATE.ATTACK;
          this.enemyStateTime = ENEMY_ATTACK_TIME;
        }
      } else if (
        (this.enemyState === ENEMY_STATE.ATTACK || this.enemyState === ENEMY_STATE.SHOCK) &&
        this.battleState === 2
      ) {
        this.enemyState = ENEMY_STATE.WAIT;
      }
    }

    if (!object.script.hasEvent(EVENT.ATTACK1)) return false;
    const onTarget =
      this.attackAnimState !== 2 &&
      Math.abs(object.x - this.cursorX) < AIM_RADIUS &&
      Math.abs(object.y - this.cursorY) < AIM_RADIUS;
    if (onTarget) {
      this.overObject = object;
      if (this.hoverObject !== object && !this.isWaiting()) {
        if (this.hoverObject) {
          this.hoverObject.executeEvent(EVENT.HOOVEROUT, null);
          this.hoverObject = null;
          this.battleTimer = 0;
        } else if (object.script.hasEvent(EVENT.HOOVERIN)) {
          object.executeEvent(EVENT.HOOVERIN, null);
          this.hoverObject = object;
        }
        return true;
      }
      return Boolean(this.hoverObject);
    }
    if (this.hoverObject === object) {
      object.executeEvent(EVENT.HOOVEROUT, null);
      this.hoverObject = null;
      this.battleTimer = 0;
      return true;
    }
    return false;
  }

  shootHovered(now) {
    const target = this.hoverObject;
    target.executeEvent(EVENT.ATTACK1, 0);
    if (toBoolean(this.getRaw('deathAnim'))) {
      this.enemyState = ENEMY_STATE.DIE;
      this.enemyAnimUpdate();
      this.bossDead = true;
      if (this.currentRoom === FINAL_BOSS_ROOM) this.superBossDead = true;
      return;
    }
    this.attackAnimState = 0;
    target.animationTime = 0;
    target.fightAnimation(this.fightDraws, ANIMATION_HERO_ATTACK_1, now);
    this.enemyState = ENEMY_STATE.SHOCK;
    this.enemyStateTime = ENEMY_SHOCK_TIME;
    const enemyDead = toBoolean(this.getRaw(this.getRaw('enemy_dead')));
    if (this.battleState < 2 && !enemyDead) this.setRaw('sys_battleState', '2', 'I');
  }

  // Ammo and the HUD: ports of Ext.HUD_ammoSet and Ext.HUD_update.
  ammoSet(value, animate, persist) {
    const ammo = Math.max(0, value);
    if (this.ammo === ammo) return;
    this.ammo = ammo;
    if (!animate) this.hudAmmoOffset = ammo * this.hudDigitHeight();
    if (persist) this.setRaw('sys_ammo', String(ammo), 'I');
    this.hudAmmoUpdateNeeded = true;
  }

  hudDigitHeight() {
    return Math.floor((this.imageInfo('HUD_numbers')?.height ?? 0) / HUD_DIGITS);
  }

  syncGunState() {
    const hasGun = this.inventorySize('invGun') > 0;
    if (this.gunState && !hasGun) {
      this.ammoInGun = this.ammo;
      this.ammoSet(0, true, true);
      this.gunState = false;
    } else if (!this.gunState && hasGun) {
      this.ammoSet(this.ammoInGun, true, true);
      this.gunState = true;
    }
  }

  hudUpdate() {
    if (!this.hudReady) {
      this.hudReady = true;
      this.ammoSet(toInt(this.getRaw('sys_ammo')), false, false);
    }
    const target = this.ammo * this.hudDigitHeight();
    if (this.hudAmmoOffset !== target) {
      this.hudAmmoOffset += this.hudAmmoOffset < target ? 1 : -1;
      this.hudAmmoUpdateNeeded = true;
      return;
    }
    this.syncGunState();
    if (this.ammo === 0 && this.inventorySize('invGun') > 0) {
      const clips = this.inventorySize('invBulletClips');
      if (clips > 0) {
        const loaded = Math.min(clips, AMMO_MAX);
        this.ammoSet(loaded, true, true);
        if (clips - loaded <= 0) this.unsetRaw('inv-invBulletClips');
        else this.setInventory('invBulletClips', clips - loaded);
        this.reloading = true;
      } else if (!this.noMoreBullets) {
        this.noMoreBullets = true;
        if (!this.finalBossDead()) this.say(this.engineText(this.text.OUT_OF_AMMO), null);
      }
    } else {
      this.hudAmmoUpdateNeeded = false;
      this.reloading = false;
    }
  }

  // Ext.appPaint shows the HUD while aiming, in the tutorial, after equipping
  // something and in the inventory.
  hudVisible() {
    return (
      this.battleState > 0 ||
      this.battleState === -1 ||
      this.infoBarTicks > 0 ||
      this.menus.at(-1)?.id === MENU.INVENTORY
    );
  }

  hudItems() {
    if (!this.hudVisible()) return [];
    const bullet = this.imageInfo('HUD_bullet');
    const numbers = this.imageInfo('HUD_numbers');
    const life = this.imageInfo('HUD_life');
    if (!bullet || !numbers || !life) return [];
    const items = [{ kind: 'image', id: 'HUD_bullet', x: HUD_MARGIN, y: HUD_MARGIN + 4, transform: 0, raw: true }];
    const digitHeight = this.hudDigitHeight();
    const x = HUD_MARGIN + bullet.width + 3;
    const y = HUD_MARGIN + 4 + ((bullet.height - digitHeight) >> 1);
    items.push({
      kind: 'image',
      id: this.reloading ? 'HUD_numbersRed' : 'HUD_numbers',
      x,
      y: y + digitHeight + this.hudAmmoOffset - numbers.height,
      transform: 0,
      raw: true,
      clip: { x, y, width: numbers.width, height: digitHeight },
    });
    const lifeWidth = this.life * HUD_LIFE_WIDTH;
    const right = this.roomWidth - HUD_MARGIN;
    items.push({
      kind: 'image',
      id: 'HUD_life',
      x: right - life.width,
      y: HUD_MARGIN,
      transform: 0,
      raw: true,
      clip: { x: right - lifeWidth, y: HUD_MARGIN, width: lifeWidth, height: life.height },
    });
    return items;
  }

  // The compass from Ext.appPaint, for rooms whose scripts set a direction.
  compassItems() {
    const direction = toInt(this.getRaw('s_compassDirection'));
    if (direction === 0 || this.battleMode || this.infoBarTicks > 0 || this.menus.at(-1)?.id === MENU.INVENTORY)
      return [];
    const x = this.roomWidth - 35;
    const y = 39;
    const pointer = {
      1: ['HUD_pointerUp', 0],
      2: ['HUD_pointerRight', 0],
      3: ['HUD_pointerUp', 5],
      4: ['HUD_pointerRight', 1],
    }[direction];
    const items = [{ kind: 'image', id: 'HUD_compass', x, y, transform: 0 }];
    if (pointer) items.push({ kind: 'image', id: pointer[0], x, y, transform: pointer[1] });
    items.push({ kind: 'compass-letters', x, y });
    return items;
  }

  // The flashlight: ports of ExtBase.paintAnimCursorMask's drawing and its frame counter.
  advanceCursorAnim() {
    const animation = this.cursorAnim;
    if (animation.counter === animation.interval) {
      animation.counter = 0;
      animation.frame = (animation.frame + 1) % animation.frames.length;
    } else {
      animation.counter++;
    }
  }

  cursorMaskItems() {
    if (!this.cursorAnim) return [];
    const id = this.cursorAnim.frames[this.cursorAnim.frame];
    const info = this.imageInfo(id);
    if (!info) return [];
    const left = this.cursorX - (info.width >> 1);
    const right = this.cursorX + (info.width >> 1);
    const top = this.cursorY - (info.height >> 1);
    const bottom = this.cursorY + (info.height >> 1);
    const { roomWidth: width, roomHeight: height, backgroundColor: color } = this;
    return [
      { kind: 'image', id, x: this.cursorX, y: this.cursorY, transform: 0 },
      { kind: 'rect', x: right, y: 0, width, height, color },
      { kind: 'rect', x: 0, y: 0, width: left, height, color },
      { kind: 'rect', x: 0, y: bottom, width, height, color },
      { kind: 'rect', x: 0, y: 0, width, height: top, color },
    ];
  }

  // Being hit: a port of ExtBase's case 45 and M.drawDissolve. Blood spreads in
  // phases, then the screen flashes a colour, then the blood shows again.
  startDissolve(args) {
    this.dissolve = {
      color: toInt(args[1]),
      imageTime: toInt(args[2]),
      colorTime: toInt(args[3]),
      loops: args.length > 4 ? toInt(args[4]) : 0,
      start: this.now(),
      phases: [this.bloodSplats()],
      phase: 0,
      blur: 1,
      shift: 0,
      sprays: [
        {
          x: (this.roomWidth >> 2) + this.randomInt(this.roomWidth >> 2),
          y: (this.roomWidth >> 1) + this.randomInt(this.roomWidth >> 2),
        },
        {
          x: (this.roomWidth >> 1) + this.randomInt(this.roomWidth >> 2),
          y: (this.roomWidth >> 2) + this.randomInt(this.roomWidth >> 2),
        },
      ],
    };
  }

  bloodSplats() {
    return Array.from({ length: BLOOD_SPLATS }, () => ({
      x: (this.roomWidth >> 2) + this.randomInt(this.roomWidth >> 1),
      y: (this.roomHeight >> 2) + this.randomInt(this.roomHeight >> 1),
    }));
  }

  updateDissolve() {
    const effect = this.dissolve;
    const elapsed = this.now() - effect.start;
    const { imageTime, colorTime } = effect;
    if (elapsed >= imageTime && elapsed < imageTime + colorTime) return;
    if (elapsed > imageTime * 2 + colorTime) {
      if (effect.loops === 0) {
        this.dissolve = null;
      } else {
        effect.loops--;
        effect.start = this.now();
      }
      return;
    }
    if (effect.phase === 2) {
      if (this.randomInt(5) === 0) effect.blur = Math.min(MAX_BLOOD_BLUR, effect.blur + 1);
      if (effect.blur === MAX_BLOOD_BLUR) effect.shift += this.randomInt(7);
    }
    if (effect.phase + 1 < BLOOD_PHASES) {
      effect.phase++;
      effect.phases[effect.phase] = this.bloodSplats();
    }
  }

  dissolveItems() {
    const effect = this.dissolve;
    if (!effect) return [];
    const elapsed = this.now() - effect.start;
    if (elapsed >= effect.imageTime && elapsed < effect.imageTime + effect.colorTime) {
      return [{ kind: 'rect', x: 0, y: 0, width: this.roomWidth, height: this.roomHeight, color: effect.color }];
    }
    const items = [];
    for (let blur = 0; blur < effect.blur; blur++) {
      for (let phase = 0; phase < effect.phase; phase++) {
        for (const { x, y } of effect.phases[phase])
          items.push({
            kind: 'image',
            id: 'new_monster_hurt1',
            x,
            y: y + (blur << 1) + effect.shift,
            transform: 0,
            raw: true,
          });
      }
    }
    if (effect.phase > 0) {
      for (const { x, y } of effect.sprays)
        items.push({ kind: 'image', id: 'new_monster_hurt2', x, y, transform: 0, raw: true });
    }
    return items;
  }

  // Everything to draw this frame, in order. Static objects go first, then
  // animations on top, as ExtBase.roomPaint draws them over the cached room image.
  drawList() {
    const list = [];
    if (!this.objects) return list;
    for (const object of this.objects) object.paint(list);
    if (this.attackAnim) {
      list.push(...this.fightDraws);
    } else {
      this.objects.forEach((object, index) => {
        // Hard-coded in ExtBase.roomPaint: the painting in the first room keeps running.
        // ExtBase.roomPaint keeps the painting in room 0 going while the player is away.
        const isPainting = this.isEndlessPainting(index);
        if (isPainting) {
          object.runAnimLoops = 1;
          if (this.paintingTime === null) this.paintingTime = object.animationTime;
          else object.animationTime = this.paintingTime;
        }
        object.paintAnimation(list, this.tickTime);
        if (isPainting) this.paintingTime = object.animationTime;
      });
    }
    list.push(
      ...this.cursorMaskItems(),
      ...this.hudItems(),
      ...this.dissolveItems(),
      ...this.transitionItems(),
      ...this.compassItems(),
    );
    return list;
  }

  isEndlessPainting(index) {
    return index === 6 && this.currentRoom.toLowerCase() === '0';
  }

  // A line of text over the room, for as long as this returns it. Only Mobile 2 has one.
  roomMessage() {
    return null;
  }

  // Port of the cursor choice in Ext.appPaint.
  cursorView() {
    if (this.hideCursor || !this.objects || this.popups.length) return null;
    const hintsOff = toBoolean(this.getRaw('s_cursorHintDisable'));
    const at = (id, hint = null, dx = 0) => ({
      id,
      hint: hintsOff ? null : hint,
      x: this.cursorX + this.aimShakeX + dx,
      y: this.cursorY + this.aimShakeY,
    });
    const object = this.overObject;
    if (!object) return at(this.specialCursor.idle ?? 'cursorIdle');
    if (this.specialCursor.hover) return at(this.specialCursor.hover);
    const [id, hint, dx] = this.cursorForExit(object.executeEvent(EVENT.GETMOVEDIR, null));
    return at(id, hint === undefined ? null : this.engineText(hint), dx);
  }

  cursorForExit(moveDirection) {
    switch (moveDirection) {
      case 'back':
        return ['cursorBack', this.text.HINT_BACK];
      case 'left':
        return ['cursorForwardLeft', this.text.HINT_LEFT];
      case 'right':
        return ['cursorForwardRight', this.text.HINT_RIGHT];
      case 'forward':
        return ['cursorForward', this.text.HINT_FORWARD];
      default:
        return ['cursorPoint'];
    }
  }
}

// The wheel's four arms sit at the offsets in Ext.menuPaintOMS.
export const VERB_WHEEL_RADIUS = 34;
const VERB_WHEEL_DEAD_ZONE = 6;

export function verbWheelCenter(menu, roomWidth, roomHeight) {
  const margin = VERB_WHEEL_RADIUS + 2;
  return {
    x: Math.max(margin, Math.min(roomWidth - margin, menu.x)),
    y: Math.max(margin + 14, Math.min(roomHeight - margin, menu.y)),
  };
}
