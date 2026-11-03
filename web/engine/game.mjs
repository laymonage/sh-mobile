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
};

// Menu IDs from Ext and ExtBase. Inventory lists and popups are this port's own
// simplified forms of the original's menus.
export const MENU = {
  CHOICE: 2,
  INVENTORY: 3,
  SAY: 6,
  RECEIVED: 7,
  TEXT_FADE: 28,
  VERBS: 50,
  ITEM_ACTIONS: 51,
  POPUP: 52,
};

export const VERB = { LOOK: 0, HAND: 1, MOUTH: 2, INVENTORY: 3 };
const VERB_EVENTS = {
  [VERB.LOOK]: [EVENT.LOOKAT],
  [VERB.HAND]: [EVENT.USE, EVENT.PICKUP, EVENT.PULL, EVENT.OPEN, EVENT.CLOSE],
  [VERB.MOUTH]: [EVENT.TALKTO],
};
const ANIMATION_EVENTS = [EVENT.GETIDLEANIMATION, 19, 20, 21, 22, 23, EVENT.GETRUNANIMATION];
const ANIMATION_IDLE = 0;
const ANIMATION_RUN = 6;
const VALUES_PER_PART = 4;
const TICK_MS = 60;
const TICK_EVENT_INTERVAL = 10;

// Engine text indexes in localization/*.properties.
const TEXT = {
  RECEIVED: 47,
  LOOK_AT: 48,
  USE: 49,
  NOTHING_CARRIED: 134,
  EQUIP: 136,
  EQUIP_GUN: 90,
  UNEQUIP: 91,
  EQUIP_CLIPS: 135,
  HINT_FORWARD: 150,
  HINT_BACK: 151,
  HINT_LEFT: 152,
  HINT_RIGHT: 153,
};

// Commands this prototype runs past: audio, saving, vibration and visual effects.
const NO_OP = new Set([23, 45, 47, 48, 49, 56]);

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
  constructor(data, { language = 'en', roomSize = 256, now = () => Date.now(), random = Math.random } = {}) {
    this.data = data;
    this.dataDir = data.dataDir;
    this.now = now;
    this.random = random;
    this.language = language;
    this.gameTexts = parseLan(data.entries.get(`${data.dataDir}/lan/${language}.lan`));
    this.engineTexts = new TextDecoder('utf-8')
      .decode(data.files.get(`localization/${language}.properties`))
      .split(/\r?\n/)
      .filter((line) => line.length > 0);
    this.scripts = new Map();
    this.images = new Map();
    this.vars = new Map();
    this.unsupportedCommands = new Set();

    this.roomWidth = roomSize;
    this.roomHeight = roomSize;
    this.backgroundColor = 0;
    this.menuColor = 0xffffff;
    this.menuTextColor = 0;
    this.useItemText = '';
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

    this.pausedThread = null;
    this.waitStop = 0;
    this.choiceMenu = null;
    this.choiceId = null;
    this.itemId = null;

    this.menus = [];
    this.cursorX = roomSize >> 1;
    this.cursorY = roomSize >> 1;
    this.overObject = null;
    this.hoverObject = null;
    this.pendingClick = false;
    this.pendingKeys = [];
  }

  // Variables: M's inkServer store, keeping the type hint beside each value.
  setRaw(name, value, hint) {
    this.vars.set(name, { value, hint });
  }

  getRaw(name) {
    return this.vars.get(name)?.value ?? null;
  }

  setVariable(name, value) {
    if (typeof value === 'string') this.setRaw(name, value, 'S');
    else if (typeof value === 'number') {
      if (value === 0) this.vars.delete(name);
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

  // Scripts.
  executeEvent(script, event, initial, roomObject = null) {
    if (!script || !script.hasEvent(event)) return initial;
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
      case 24:
        this.addChoice(args);
        return null;
      case 25:
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
      case 31:
        return 0;
      case 38:
        this.menus = [];
        this.endGameRequested = true;
        return null;
      case 39:
        this.menus = [];
        this.roomUpdateNeeded = true;
        return null;
      case 40:
        return integerArgument(args[0]) > integerArgument(args[1]) ? 1 : 0;
      case 41:
        return integerArgument(args[0]) < integerArgument(args[1]) ? 1 : 0;
      case 42: {
        const size = this.inventorySize(args[0]) - (count > 1 ? integerArgument(args[1]) : 1);
        if (size <= 0) this.vars.delete(`inv-${args[0]}`);
        else this.setInventory(args[0], size);
        return null;
      }
      case 43:
        return this.inventorySize(args[0]);
      case 44:
        return args.slice(1).reduce((value, next) => value - integerArgument(next), integerArgument(args[0]));
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
    if (args.length !== 3 || toBoolean(args[2])) this.menus = [];
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
      case 's_7':
        this.menuTextColor = toInt(value);
        return;
      case 's_8':
        this.backgroundColor = toInt(value);
        return;
      case 's_use':
        this.useItemText = String(value);
        return;
      case 's_1':
      case 's_2':
      case 's_3':
      case 's_4':
      case 's_5':
      case 's_6':
      case 's_useAny':
      case 's_dissolveFX':
      case 's_battleType':
      case 's_useImageBorders':
      case 's_dynamicSayHeight':
      case 's_useScrollArrows':
      case 's_delimiterMode':
      case 's_firstInventoryItem':
      case 's_storyScreenRowByRow':
        return;
      case 's_animCursor':
      case 's_cursorHintDisable':
        this.setVariable(name, value);
        return;
      case 's_popupMes':
        this.menus.push({ id: MENU.POPUP, text: value });
        return;
      default:
        this.setVariable(name, value);
        if (args.length !== 3 || toBoolean(args[2])) this.menus = [];
    }
  }

  // Menus.
  say(text, speaker) {
    this.menus.push({ id: MENU.SAY, text, speaker: speaker ?? null, page: 0, pageCount: 1 });
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

  inventoryAdd(thread, item, amount, announce) {
    const size = this.inventorySize(item) + amount;
    if (size > 0) this.setInventory(item, size);
    this.menus = [];
    this.roomUpdateNeeded = true;
    if (!announce) return;
    const text = this.engineText(TEXT.RECEIVED).replace('<item name>', this.itemName(item));
    this.menus.push({
      id: MENU.RECEIVED,
      text: amount > 1 ? `${text} (${amount})` : text,
      image: this.inventoryImage(item),
    });
    thread.status = STATUS.PAUSED;
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
      if (menu.options[VERB.INVENTORY] === null) this.say(this.engineText(TEXT.NOTHING_CARRIED), null);
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

  openInventory() {
    this.menus.push({
      id: MENU.INVENTORY,
      items: this.inventoryItems().map((item) => ({
        id: item,
        name: this.itemName(item),
        image: this.inventoryImage(item),
        size: this.inventorySize(item),
      })),
    });
  }

  // Ext.addItemChoices, as a menu of its own.
  openItemActions(item) {
    this.itemId = item.id;
    const choices = [];
    const script = this.getScript(item.id);
    if (script && (script.hasEvent(EVENT.EQUIP) || script.hasEvent(EVENT.UNEQUIP))) {
      const equipable = toBoolean(this.executeEvent(script, EVENT.ISEQUIPABLE, null));
      const equipped = toBoolean(this.executeEvent(script, EVENT.ISEQUIPED, null));
      if (script.hasEvent(EVENT.EQUIP) && equipable && !equipped) {
        const label =
          item.id === 'invBulletClips' ? TEXT.EQUIP_CLIPS : item.id === 'invGun' ? TEXT.EQUIP_GUN : TEXT.EQUIP;
        choices.push({ id: EVENT.EQUIP, text: this.engineText(label) });
      }
      if (script.hasEvent(EVENT.UNEQUIP) && equipable && equipped)
        choices.push({ id: EVENT.UNEQUIP, text: this.engineText(TEXT.UNEQUIP) });
    }
    if (this.overObject) {
      const direction = this.overObject.executeEvent(EVENT.GETMOVEDIR, null);
      if (!['back', 'right', 'left', 'forward'].includes(direction))
        choices.push({ id: -2, text: this.engineText(TEXT.USE) });
    }
    choices.push({ id: EVENT.LOOKAT, text: this.engineText(TEXT.LOOK_AT) });
    this.menus.push({ id: MENU.ITEM_ACTIONS, title: item.name, choices });
  }

  chooseItemAction(choiceId) {
    if (choiceId === -2) {
      if (this.overObject.executeEvent(EVENT.USEITEM, 0) === 0) this.say(this.useItemText, null);
    } else {
      this.executeEventById(this.itemId, choiceId, null);
    }
  }

  // Rooms.
  startNewGame() {
    this.setupDone = false;
    this.menus = [];
    this.roomInit('setup', false);
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
    this.menus = [];
    if (room) this.roomInit(room, history);
    thread.status = STATUS.STOPPED;
  }

  // Port of ExtBase.roomInit. The room itself loads on the next tick, as in the
  // original, where a thread did it.
  roomInit(requested, history) {
    let room = requested;
    this.tickObject = null;
    this.hideCursor = false;
    this.overObject = null;
    this.hoverObject = null;
    if (room !== 'setup') {
      if (room === 'back') {
        room = this.roomLastInHistory();
        const size = this.roomHistorySize();
        if (size > 0) {
          this.vars.delete(`room-${size}`);
          this.setRaw('room-size', String(size - 1), 'R');
        }
      } else if (history && room !== this.currentRoom) {
        this.roomAddToHistory(this.currentRoom);
      }
      this.setRaw('cur-curRoom', room, 'C');
    }
    this.nextRoomInit = true;
    this.pendingRoom = room;
  }

  loadPendingRoom() {
    const room = this.pendingRoom;
    this.pendingRoom = null;
    const bytes = this.data.entries.get(`${this.dataDir}/rom/${room}.bin`);
    if (!bytes) throw new Error(`Missing room: ${room}`);
    const parsed = parseRoom(bytes, { wideZones: usesWideZones(this.dataDir) });
    this.currentRoomId = room;
    this.objects = parsed.objects.map((source) => new RoomObject(source, this));
    this.roomEntered = false;
    this.roomUpdateNeeded = true;
  }

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
    this.cursorX = Math.max(0, Math.min(this.roomWidth - 1, Math.round(x)));
    this.cursorY = Math.max(0, Math.min(this.roomHeight - 1, Math.round(y)));
    const menu = this.menus.at(-1);
    if (menu?.id === MENU.VERBS) menu.selected = this.verbAtCursor(menu);
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
    const menu = this.menus.at(-1);
    if (!menu) this.updateHover();
    const clicked = this.pendingClick;
    const keys = this.pendingKeys;
    this.pendingClick = false;
    this.pendingKeys = [];
    if (this.isWaiting()) return;

    if (keys.includes('Escape')) this.handleEscape(menu);
    if (menu) {
      if (clicked) this.handleMenuClick(menu);
      return;
    }
    if (clicked) this.handleRoomClick();
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
    if (object.executeEvent(EVENT.CLICK, -1) === null) return;
    this.openVerbMenu(object);
  }

  handleMenuClick(menu) {
    switch (menu.id) {
      case MENU.SAY:
        if (menu.page + 1 < menu.pageCount) {
          menu.page++;
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
      case MENU.INVENTORY:
        if (menu.hovered === undefined || menu.hovered === null) this.menus.pop();
        else this.openItemActions(menu.items[menu.hovered]);
        return;
      case MENU.ITEM_ACTIONS:
        if (menu.hovered === undefined || menu.hovered === null) this.menus.pop();
        else this.chooseItemAction(menu.choices[menu.hovered].id);
        return;
      case MENU.POPUP:
        this.menus.pop();
        return;
      default:
    }
  }

  // The back key skips text only in rooms that are purely story, per
  // ExtBase.ingameMenuKeyHandling. It closes other menus.
  handleEscape(menu) {
    if (!menu) return;
    const room = this.currentRoom.toLowerCase();
    const isStory =
      room === 'control' ||
      room === 'karen_fall_sleep' ||
      room === 'ben_backtolight' ||
      room.includes('intro') ||
      room.includes('end');
    if (menu.id === MENU.SAY || menu.id === MENU.TEXT_FADE) {
      if (!isStory) return;
      this.menus.pop();
      for (
        let i = 0;
        i < 1000 && !this.endGameRequested && this.currentRoom.toLowerCase() === room && this.pausedThread;
        i++
      ) {
        this.waitStop = 0;
        this.resume();
      }
      this.menus = [];
    } else if (menu.id === MENU.CHOICE) {
      this.pausedThread = null;
      this.menus.pop();
    } else {
      this.menus.pop();
    }
  }

  // One 60 ms engine tick. M.tickBasedTimeUpdate advances the animation clock by
  // the same amount.
  tick() {
    this.tickTime += TICK_MS;
    const fading = this.menus.at(-1);
    if (fading?.id === MENU.TEXT_FADE) this.updateTextFade(fading);
    this.handleInput();
    if (this.pendingRoom !== null) this.loadPendingRoom();
    this.roomCheckUpdate();
    if (this.pendingRoom !== null) this.loadPendingRoom();
    if (!this.menus.length && !this.pausedThread && this.tickObject && --this.tickInterval <= 0) {
      this.tickInterval = TICK_EVENT_INTERVAL;
      this.tickObject.executeEvent(EVENT.TICK, null);
    }
    if (this.endGameRequested) {
      this.endGameRequested = false;
      this.vars.clear();
      this.startNewGame();
    }
  }

  // Everything to draw this frame, in order. Static objects go first, then
  // animations on top, as ExtBase.roomPaint draws them over the cached room image.
  drawList() {
    const list = [];
    if (!this.objects) return list;
    for (const object of this.objects) object.paint(list);
    this.objects.forEach((object, index) => {
      // Hard-coded in ExtBase.roomPaint: the painting in the first room keeps running.
      if (index === 6 && this.currentRoom.toLowerCase() === '0') object.runAnimLoops = 1;
      object.paintAnimation(list, this.tickTime);
    });
    return list;
  }

  // Port of the cursor choice in Ext.appPaint.
  cursorView() {
    if (this.hideCursor) return null;
    const object = this.overObject;
    if (!object) return { id: this.specialCursor.idle ?? 'cursorIdle', hint: null };
    if (this.specialCursor.hover) return { id: this.specialCursor.hover, hint: null };
    switch (object.executeEvent(EVENT.GETMOVEDIR, null)) {
      case 'back':
        return { id: 'cursorBack', hint: this.engineText(TEXT.HINT_BACK) };
      case 'left':
        return { id: 'cursorForwardLeft', hint: this.engineText(TEXT.HINT_LEFT) };
      case 'right':
        return { id: 'cursorForwardRight', hint: this.engineText(TEXT.HINT_RIGHT) };
      case 'forward':
        return { id: 'cursorForward', hint: this.engineText(TEXT.HINT_FORWARD) };
      default:
        return { id: 'cursorPoint', hint: null };
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
