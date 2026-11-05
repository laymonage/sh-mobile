import { Fight, newTargetClock } from './battle.mjs';
import { animationSize, ONCE, Playing } from './data.mjs';
import { Inventory } from './inventory.mjs';
import { FrontEnd, MapScreen, PauseMenu } from './menus.mjs';
import { createPuzzle, PUZZLE } from './puzzles.mjs';
import { fireItemTrigger, fireTrigger, TRIGGER } from './rules.mjs';
import { BOX, BoxMaker, SCREEN_WIDTH } from './ui.mjs';

// Rooms and corridors are drawn in a scene this size. A phone pans a 240-pixel view over it,
// and the port shows it all, with what the phone draws on its screen in the middle.
const SCENE_WIDTH = 360;
const SCENE_HEIGHT = 320;
export const SCREEN_X = (SCENE_WIDTH - SCREEN_WIDTH) >> 1;
const MILLISECONDS_PER_TICK = 60;
// A fade's stages, as GameMidlet.eB, each lasting one update: stippled black from the JAR's art,
// then black, then stippled again, and one more update before anything else can happen.
const FADE = { DONE: 0, STIPPLED_IN: 1, BLACK: 2, STIPPLED_OUT: 3 };

export const MODE = { ROOM: 0, CORRIDOR: 1, PUZZLE: 3, FIGHT: 4 };
export const FACING = { WEST: 0, NORTH: 1, EAST: 2, SOUTH: 3 };
export const STEP = [
  [0, -1],
  [-1, 0],
  [0, 1],
  [1, 0],
];
const left = (facing) => (facing + 3) % 4;
const right = (facing) => (facing + 1) % 4;
const behind = (facing) => (facing + 2) % 4;

// Floor maps hold rooms below this number and corridor cells from it up.
const CORRIDOR_CELL_BASE = 26;
// Where stairs lead, from GameMidlet.F().
export const STAIRS = {
  98: { floor: 2, cell: 45, facing: FACING.EAST },
  154: { floor: 1, cell: 27, facing: FACING.WEST },
  161: { floor: 3, cell: 53, facing: FACING.WEST },
  203: { floor: 2, cell: 47, facing: FACING.WEST },
};
const STAIRS_GOING_UP = new Set([98, 161]);
// Each floor has a lift, which arrives at this cell, also from GameMidlet.F().
export const LIFTS = new Set([210, 217, 224]);
export const LIFT_CELLS = [36, 49, 55];
const NO_DOOR = -1;
const BLOCKED = -2;
const NO_SPRITE = -1;
const FIRST_PROP = 145;
const PROP_STEP = 7;
const PICKED_UP_PROP = 166;
const FLOOR_SIGNS = new Set([180, 182, 183]);
// Rooms where a monster fights you facing north, whichever way you came.
const NORTH_FIGHT_ROOMS = new Set([15, 22]);
const COLD_ROOM = 10;
const NOISY_DOOR_ROOM = 13;
const FINAL_MONSTER = 4;
const TIMED_DIALOGUE = 8;
const TIMED_DIALOGUE_LENGTH = 4000;

// Where each piece sits, as indexes into the table of positions, in the original's order.
const PLACE = {
  middleSideLeft: 0,
  middleSideRight: 1,
  farLeft: 2,
  farRight: 3,
  nearSideLeft: 4,
  nearSideRight: 5,
  middleEndLeft: 6,
  middleEndRight: 7,
  closeOpeningLeft: 8,
  closeOpeningRight: 9,
  closeWallLeft: 10,
  closeWallRight: 11,
  nearEndLeft: 12,
  nearEndRight: 13,
};

// Screen areas for walking in a corridor. The original's are measured from a 240-pixel
// screen's edges, and these are the port's own for showing the whole scene.
const TURN_ZONE = 72;
const TURN_BACK_ZONE = 28;
const LEAVE_ZONE = 28;

// Lines of the language files.
const TEXT = {
  TOOK: 410,
  DOOR_LOOK: 447,
  DOOR_LOCKED: 69,
  DOOR_BARRED: 489,
  BULLETS_PISTOL: 388,
  BULLETS_SHOTGUN: 389,
  RELOADING: 480,
  DEAD: 479,
  SAVED: 473,
  NO_SAVING: 481,
  FLOORS: [492, 491, 490],
};

// The cursor's frames, from GameMidlet.i(int) and m().
const CURSOR = {
  NORMAL: 0,
  INTERACT: 1,
  FORWARD: 2,
  LEAVE: 3,
  TURN_LEFT: 4,
  TURN_RIGHT: 5,
  TURN_BACK: 6,
  DOWNSTAIRS_RIGHT: 7,
  DOWNSTAIRS_LEFT: 8,
  UPSTAIRS_RIGHT: 9,
  UPSTAIRS_LEFT: 10,
  AIM_ON: 12,
  AIM_OFF: 13,
  LIFT: 14,
};
// Indexes into the table of soft key words.
export const KEY = {
  SELECT: 0,
  CONFIRM: 5,
  RETRY: 6,
  BACK: 9,
  CONTINUE: 10,
  PAUSE: 11,
  MAIN_MENU: 13,
  CLOSE: 15,
  MAP: 16,
  SKIP: 17,
};

const ITEM = {
  MAP: 121,
  MELEE: 118,
  PISTOL: 111,
  SHOTGUN: 120,
  PISTOL_BULLETS: 72,
  SHOTGUN_BULLETS: 73,
  HEALTH_PACK: 6,
  MEDIPACK: 114,
};
const USED_UP_BY_CHAPTER_THREE = [110, 113];
const CLIP_SIZE = [-1, 15, 5];
const SAVE_KEY = 'silent-hill-mobile3:save';
const SETTINGS_KEY = 'silent-hill-mobile3:settings';
// Shared with the other two games, which have the same setting.
const MOUSE_RECOIL_PREFERENCE = 'silent-hill-mobile:mouse-recoil';
const WEAK_HEALTH = 70;
const SAFE_DAMAGE = 25;
// The original draws its red flash once. The page can tick just before it draws, so this lasts
// long enough for one frame to show it.
const RED_FLASH_TIME = MILLISECONDS_PER_TICK * 2;
const SHAKE_TIME = 2000;
const HOLD_START = 2;
const HOLD_FASTEST = 10;
const HOLD_STEP_TIME = 300;
// How long each buzz and each gap lasts, from the end of the update. The last repeats for 3 seconds.
const VIBRATIONS = [
  [500],
  [100, 500, 100, 500, 100],
  [2000],
  [100, 100, 200, 500, 100, 100, 200, 500, 100, 100, 200, 500, 100, 100, 200],
];
const LANGUAGE_CODES = {
  English: 'en',
  Français: 'fr',
  Deutsch: 'de',
  Italiano: 'it',
  Español: 'es',
  Português: 'pt',
};

export const VERB = { LOOK: 0, USE: 1, INVENTORY: 2 };

export class Mobile3Game {
  static PANEL_ART = null;
  static PANEL_ART_IS_STRIP = true;
  static ITEM_ICONS = {};
  // The page sends this key as the left button under the screen, as Esc and a right click are
  // the right one. Puzzles need it to confirm.
  static LEFT_SOFT_KEY = 'c';

  constructor(
    data,
    {
      audio = null,
      now = () => 0,
      onQuit = () => {},
      storage = null,
      vibrate = null,
      random = Math.random,
      startInGame = false,
    } = {},
  ) {
    this.data = data;
    this.tables = data.tables;
    this.dataDir = data.dataDir;
    this.audio = audio;
    this.now = now;
    this.onQuit = onQuit;
    this.storage = storage;
    this.vibrator = vibrate;
    this.random = random;
    this.frameWidth = SCENE_WIDTH;
    this.frameHeight = SCENE_HEIGHT;
    this.viewOffsetX = 0;
    this.viewOffsetY = 0;
    // The cursor is where the mouse or the keys put it, the pointer, moved by recoil and the
    // aim's wandering, the kick.
    this.pointerX = SCENE_WIDTH / 2;
    this.pointerY = SCENE_HEIGHT / 2;
    this.kickX = 0;
    this.kickY = 0;
    this.cursorX = this.pointerX;
    this.cursorY = this.pointerY;
    this.aimingWithKeys = false;
    this.boxes = new BoxMaker(data);
    this.languageName = data.languages[0].name;
    this.language = LANGUAGE_CODES[this.languageName];
    this.lines = data.text(data.languages[0]);
    this.vibrationOn = Boolean(vibrate);
    this.chosenLanguage = false;
    this.loadSettings();

    // The page looks at these, as it does on the other games.
    this.popups = [];
    this.pointerLocked = false;
    this.mouseLock = this.readPreference(MOUSE_RECOIL_PREFERENCE) === 'on';
    this.stroke = null;
    this.frontEnd = null;
    this.time = 0;
    this.held = new Set();
    this.holdSpeed = HOLD_START;
    this.holdTimer = 0;
    this.savedExists = this.readSave() !== null;
    this.targetClock = data.hardCoded.targets ? newTargetClock() : null;
    this.inventory = new Inventory(this);
    this.resetRun();
    if (startInGame) this.startNewGame();
    else this.frontEnd = new FrontEnd(this);
  }

  // The fields a new game starts from. As GameMidlet.v() sets them up.
  resetRun() {
    const { objectStates, chapterStates } = this.tables;
    this.chapter = 1;
    this.world = 1;
    this.floor = 1;
    this.mode = MODE.ROOM;
    this.objectValue = objectStates.map((row) => row[0]);
    this.objectHidden = objectStates.map((row) => row[1]);
    this.objectTaken = objectStates.map(() => false);
    this.propTaken = new Array(6).fill(false);
    this.doorStates = chapterStates.map((row) => [...row]);
    this.roomCleared = new Array(26).fill(false);
    this.ruleFired = new Array(this.tables.rules.length).fill(false);
    this.items = [];
    this.vincentItems = [];
    this.health = 100;
    this.weakened = false;
    this.healthLevel = 0;
    this.weapon = 0;
    this.bullets = [0, 0, 0];
    this.loaded = [CLIP_SIZE[0], 0, 0];
    this.reloading = false;
    this.reloadWait = 0;
    this.phoneSolved = false;
    this.phoneEntered = [];
    this.flagL = false;
    this.flagM = false;
    this.verbs = null;
    this.box = null;
    this.boxClosed = null;
    this.dialogue = null;
    this.blackBehindDialogue = false;
    this.timedDialogue = 0;
    this.fade = null;
    this.roomSoundDue = false;
    this.fight = null;
    this.puzzle = null;
    this.pause = null;
    this.map = null;
    this.liftMenu = false;
    this.gameOver = false;
    this.shake = 0;
    this.redFlash = 0;
    this.drift = { x: 0, y: 0 };
    this.bloodOverlay = null;
    const { hud } = this.data.hardCoded;
    this.damageFlash = new Playing(this.data.animation(hud.damage.animation), ONCE);
    this.healFlash = new Playing(this.data.animation(hud.healed.animation), ONCE);
    this.damageFlash.running = false;
    this.healFlash.running = false;
    this.inventory.reset();
    this.room = 0;
  }

  // As GameMidlet.q().
  startNewGame() {
    this.frontEnd = null;
    this.stopSound();
    this.resetRun();
    this.addItem(ITEM.MELEE);
    this.placeInCorridor(30, FACING.NORTH);
    this.enterRoom(0);
    this.showDialogue(4, { black: true });
  }

  showStartup() {
    this.frontEnd?.start();
  }

  get mainMenu() {
    return this.frontEnd;
  }

  // The page sends arrow keys rather than walking keys while one of these is up.
  get menus() {
    const { frontEnd, box, pause, verbs, map, inventory } = this;
    return !frontEnd && (box || pause || verbs || map || inventory.isOpen) ? [{}] : [];
  }

  // What the rules ask about.
  hasItem(item) {
    return this.items.includes(item);
  }

  monstersKilled() {
    return this.roomCleared.filter(Boolean).length;
  }

  get grid() {
    return [this.tables.firstFloor, this.tables.secondFloor, this.tables.thirdFloor][this.floor - 1];
  }

  doorsAt(cell) {
    return this.tables.corridorDoors[cell - CORRIDOR_CELL_BASE];
  }

  propsAt(cell) {
    return this.tables.corridorProps[cell - CORRIDOR_CELL_BASE];
  }

  isOpen(row, column) {
    return (this.grid[row]?.[column] ?? -1) >= CORRIDOR_CELL_BASE;
  }

  placeInCorridor(cell, facing) {
    this.cell = cell;
    this.facing = facing;
    const { grid } = this;
    this.row = grid.findIndex((row) => row.includes(cell));
    this.column = grid[this.row].indexOf(cell);
  }

  // Facing west or east, a door ahead stops the view and the walk. Facing north or south,
  // the original only checks what's beside the view for its western doors.
  canSeeAhead(row, column, facing = this.facing) {
    const [stepRow, stepColumn] = STEP[facing];
    if (!this.isOpen(row + stepRow, column + stepColumn)) return false;
    if (facing % 2 === 1) return true;
    return this.doorsAt(this.grid[row][column])[facing] === NO_DOOR;
  }

  canSeeSide(row, column, side) {
    const [stepRow, stepColumn] = STEP[side];
    if (!this.isOpen(row + stepRow, column + stepColumn)) return false;
    if (side !== FACING.WEST) return true;
    return this.doorsAt(this.grid[row][column])[FACING.WEST] === NO_DOOR;
  }

  // GameMidlet.z() and A() together come to the same test as the view's, except that stairs
  // on the south of a cell also stop the walk.
  canWalkForward() {
    if (!this.canSeeAhead(this.row, this.column)) return false;
    return !(this.facing === FACING.SOUTH && this.doorsAt(this.cell)[FACING.SOUTH] in STAIRS);
  }

  // The wall pieces in view, in drawing order, as in GameMidlet.E().
  corridorPieces() {
    const { facing, row, column } = this;
    const pieces = this.data.hardCoded.walls[this.world];
    const positions = this.tables.corridorLayerPositions;
    const [stepRow, stepColumn] = STEP[facing];
    const toLeft = left(facing);
    const toRight = right(facing);
    const list = [];
    const add = (set, side, place) => {
      const [x, y] = positions[place];
      list.push({ sheet: set.sheet, animation: set[side], x, y });
    };

    const openings = [];
    const look = (distance, onLeft, onRight) => {
      const r = row + stepRow * distance;
      const c = column + stepColumn * distance;
      if (this.canSeeSide(r, c, toLeft)) openings.push(onLeft);
      if (this.canSeeSide(r, c, toRight)) openings.push(onRight);
    };

    look(0, 'closeLeft', 'closeRight');
    const ends = [];
    if (!this.canSeeAhead(row, column)) ends.push('near');
    else {
      look(1, 'nearLeft', 'nearRight');
      const r1 = row + stepRow;
      const c1 = column + stepColumn;
      if (!this.canSeeAhead(r1, c1)) ends.push('middle');
      else {
        look(2, 'middleLeft', 'middleRight');
        if (!this.isOpen(row + stepRow * 3, column + stepColumn * 3)) ends.push('far');
      }
    }

    // These two hold the floor and ceiling too, so E() starts with both flags set, always.
    add(pieces.closeWall, 'left', PLACE.closeWallLeft);
    add(pieces.closeWall, 'right', PLACE.closeWallRight);
    if (openings.includes('closeLeft')) add(pieces.closeOpening, 'left', PLACE.closeOpeningLeft);
    if (openings.includes('closeRight')) add(pieces.closeOpening, 'right', PLACE.closeOpeningRight);
    if (ends.includes('near')) {
      add(pieces.nearEnd, 'left', PLACE.nearEndLeft);
      add(pieces.nearEnd, 'right', PLACE.nearEndRight);
      return list;
    }
    if (openings.includes('nearLeft')) add(pieces.nearSide, 'left', PLACE.nearSideLeft);
    if (openings.includes('nearRight')) add(pieces.nearSide, 'right', PLACE.nearSideRight);
    if (ends.includes('middle')) {
      add(pieces.middleEnd, 'left', PLACE.middleEndLeft);
      add(pieces.middleEnd, 'right', PLACE.middleEndRight);
      return list;
    }
    if (openings.includes('middleLeft')) add(pieces.middleSide, 'left', PLACE.middleSideLeft);
    if (openings.includes('middleRight')) add(pieces.middleSide, 'right', PLACE.middleSideRight);
    if (ends.includes('far')) {
      add(pieces.far, 'left', PLACE.farLeft);
      add(pieces.far, 'right', PLACE.farRight);
    }
    return list;
  }

  // The doors and things on the walls, and what can be clicked, as in GameMidlet.a(int, int,
  // boolean), c(int, int) and d(int, int). Only what's next to the player can be clicked.
  corridorFixtures() {
    const { facing, row, column, cell } = this;
    const sprites = [];
    const hotspots = [];
    const door = this.doorsAt(cell)[facing];
    const prop = this.propsAt(cell)[facing];

    const addDoor = (id, place) => {
      const [sheet, animation] = this.tables.corridorDoorSprites[id];
      if (sheet === NO_SPRITE) return;
      const [x, y, x0, x1, y0, y1] = this.tables.doorPlaces[place];
      sprites.push({ sheet, animation, x, y });
      if (door !== NO_DOOR && door !== BLOCKED) hotspots.push({ kind: 'door', id: door, x0, x1, y0, y1 });
    };
    const addProp = (id, place) => {
      if (id >= 159 && id <= 165 && this.chapter !== 3) return;
      const index = Math.floor((id - FIRST_PROP) / PROP_STEP);
      if (this.propTaken[index]) return;
      const [sheet, animation] = this.tables.propSprites[id - FIRST_PROP];
      const [x, y, x0, x1, y0, y1] = this.tables.propPlaces[index][place];
      if (sheet !== NO_SPRITE) {
        const sprite = { sheet, animation, x, y };
        if (FLOOR_SIGNS.has(id)) sprite.frame = this.floor - 1;
        sprites.push(sprite);
      }
      if (prop !== NO_DOOR) hotspots.push({ kind: 'prop', id: prop, x0, x1, y0, y1 });
    };

    if (door > NO_DOOR) {
      addDoor(door, 0);
      if (prop !== NO_DOOR) addProp(prop, 0);
      return { sprites, hotspots };
    }
    if (prop !== NO_DOOR) addProp(prop, 0);

    if (facing === FACING.WEST && this.floor === 1) {
      const blockedHere = this.doorsAt(cell)[facing] === BLOCKED;
      const [, stepColumn] = STEP[facing];
      const next = this.grid[row]?.[column + stepColumn];
      if (blockedHere || (next >= CORRIDOR_CELL_BASE && this.doorsAt(next)[facing] === BLOCKED)) {
        return { sprites, hotspots };
      }
    }

    const [stepRow, stepColumn] = STEP[facing];
    for (let distance = 1; distance <= 2; distance++) {
      const r = row + stepRow * distance;
      const c = column + stepColumn * distance;
      if (!this.isOpen(r, c)) break;
      const there = this.grid[r][c];
      const base = (distance - 1) * 3;
      const spot = distance - 1;
      for (const [dir, offset, place] of [
        [facing, 1, 1],
        [left(facing), 2, 5],
        [right(facing), 3, 3],
      ]) {
        const doorThere = this.doorsAt(there)[dir];
        if (doorThere > NO_DOOR) addDoor(doorThere + offset + base, place + spot);
        const propThere = this.propsAt(there)[dir];
        if (propThere > NO_DOOR) addProp(propThere + offset + base, place + spot);
      }
    }
    return { sprites, hotspots };
  }

  // A room's layers and the objects showing in it, as in GameMidlet.q(int) and u().
  roomObjects() {
    const list = this.tables.roomObjects[this.room] ?? [];
    return list.filter(
      (row) =>
        (row[7] === 0 || row[7] === this.chapter) &&
        (row[8] === 0 || row[8] === this.world) &&
        !this.objectTaken[row[0]],
    );
  }

  roomSprites() {
    const dark = this.world === 2;
    const layers = (dark ? this.tables.roomLayersDark : this.tables.roomLayers)[this.room] ?? [];
    const positions = (dark ? this.tables.roomLayerPositionsDark : this.tables.roomLayerPositions)[this.room] ?? [];
    const sprites = [];
    for (let i = 0; i + 1 < layers.length; i += 2) {
      sprites.push({ sheet: layers[i], animation: layers[i + 1], x: positions[i], y: positions[i + 1] });
    }
    for (const row of this.roomObjects()) {
      const [sheet, animation] = this.tables.objectSprites[row[0]];
      if (sheet !== NO_SPRITE && this.objectHidden[row[0]] === 0)
        sprites.push({ sheet, animation, x: row[1], y: row[2] });
    }
    return sprites;
  }

  roomHotspots() {
    return this.roomObjects()
      .filter((row) => row[3] !== -1 && this.objectHidden[row[0]] === 0)
      .map((row) => ({ kind: 'object', id: row[0], x0: row[3], x1: row[4], y0: row[5], y1: row[6] }));
  }

  // What to draw this frame, behind any puzzle or monster.
  scene() {
    if (this.mode === MODE.ROOM) return this.roomSprites();
    if (this.mode === MODE.FIGHT && this.fight?.inRoom) return this.roomSprites();
    return [...this.corridorPieces(), ...this.corridorFixtures().sprites];
  }

  hotspots() {
    if (this.mode === MODE.ROOM) return this.roomHotspots();
    return this.mode === MODE.CORRIDOR ? this.corridorFixtures().hotspots : [];
  }

  // The last one listed wins, as the original searches from the end.
  hotspotAt(x, y) {
    return this.hotspots().findLast((spot) => x >= spot.x0 && x <= spot.x1 && y >= spot.y0 && y <= spot.y1) ?? null;
  }

  // Where the cursor is on the phone's screen, which is what puzzles and fights use.
  get screenX() {
    return this.cursorX - SCREEN_X;
  }

  // What a click at the cursor would do, which also picks the cursor's shape.
  action(x = this.cursorX, y = this.cursorY) {
    const hotspot = this.hotspotAt(x, y);
    if (this.mode === MODE.ROOM) {
      if (hotspot) return { kind: 'verbs', hotspot };
      if (y >= SCENE_HEIGHT - LEAVE_ZONE) return { kind: 'leave' };
      return null;
    }
    if (this.mode !== MODE.CORRIDOR) return null;
    if (hotspot) {
      if (hotspot.kind === 'door' && (hotspot.id in STAIRS || LIFTS.has(hotspot.id))) {
        return { kind: 'stairs', hotspot };
      }
      return { kind: 'verbs', hotspot };
    }
    if (y >= SCENE_HEIGHT - TURN_BACK_ZONE) return { kind: 'turn-back' };
    if (x < TURN_ZONE) return { kind: 'turn-left' };
    if (x > SCENE_WIDTH - TURN_ZONE) return { kind: 'turn-right' };
    return this.canWalkForward() ? { kind: 'forward' } : null;
  }

  // Which of the cursor's pictures shows, from GameMidlet.m().
  cursorFrame() {
    if (this.fight) return this.fight.isAimedAt(this.screenX, this.cursorY) ? CURSOR.AIM_ON : CURSOR.AIM_OFF;
    if (this.puzzle) return this.puzzle.isHot(this.screenX, this.cursorY) ? CURSOR.INTERACT : CURSOR.NORMAL;
    const action = this.action();
    if (!action) return CURSOR.NORMAL;
    if (action.kind === 'stairs') {
      const { id } = action.hotspot;
      if (LIFTS.has(id)) return CURSOR.LIFT;
      const onLeft = this.cursorX < SCENE_WIDTH / 2;
      if (STAIRS_GOING_UP.has(id)) return onLeft ? CURSOR.UPSTAIRS_LEFT : CURSOR.UPSTAIRS_RIGHT;
      return onLeft ? CURSOR.DOWNSTAIRS_LEFT : CURSOR.DOWNSTAIRS_RIGHT;
    }
    return {
      verbs: CURSOR.INTERACT,
      leave: CURSOR.LEAVE,
      forward: CURSOR.FORWARD,
      'turn-left': CURSOR.TURN_LEFT,
      'turn-right': CURSOR.TURN_RIGHT,
      'turn-back': CURSOR.TURN_BACK,
    }[action.kind];
  }

  // After the screen has gone black, as GameMidlet's aB() and d() arrange. It can stay black
  // for a while, as a monster's moves do.
  startFade(atBlack, holdMilliseconds = 0) {
    if (!this.fade) this.fade = { stage: FADE.STIPPLED_IN, atBlack, hold: holdMilliseconds };
  }

  // aB() on its own, which sends a fade back to its start. What's waiting for black still happens.
  restartFade() {
    this.fade = { stage: FADE.STIPPLED_IN, atBlack: this.fade?.atBlack ?? null, hold: 0 };
  }

  fadeThen(atBlack) {
    this.startFade(atBlack);
  }

  get fadeIsBlack() {
    return this.fade?.stage === FADE.BLACK;
  }

  walkForward() {
    const [stepRow, stepColumn] = STEP[this.facing];
    const cell = this.grid[this.row + stepRow]?.[this.column + stepColumn];
    this.fadeThen(() => {
      this.placeInCorridor(cell, this.facing);
      this.restartFade();
    });
  }

  turnTo(facing) {
    this.fadeThen(() => {
      this.facing = facing;
      this.restartFade();
    });
  }

  takeStairs(door) {
    const { floor, cell, facing } = STAIRS[door];
    this.fadeThen(() => {
      this.floor = floor;
      this.placeInCorridor(cell, facing);
    });
  }

  // The lift's list of floors, as in GameMidlet.f(int) and F().
  openLift() {
    this.liftMenu = true;
    const rows = TEXT.FLOORS.map((line) => this.lines[line]);
    this.showBox(this.boxes.rows(rows, { width: Math.trunc((SCREEN_WIDTH * 75) / 100), selected: 3 - this.floor }));
  }

  chooseLiftFloor(row) {
    this.liftMenu = false;
    this.closeBox();
    const floor = 3 - row;
    if (floor === this.floor) return;
    this.fadeThen(() => {
      this.floor = floor;
      this.placeInCorridor(LIFT_CELLS[floor - 1], FACING.WEST);
    });
  }

  enterRoom(room) {
    this.room = room;
    this.mode = MODE.ROOM;
    this.drift = { x: 0, y: 0 };
    this.restartFade();
    if (!this.roomCleared[room] && this.tables.roomEncounters[room][0] === FINAL_MONSTER) {
      const [, chapter] = this.tables.roomEncounters[room];
      if (chapter === this.chapter) {
        this.startFight(FINAL_MONSTER, true);
        return;
      }
    }
    if (room === COLD_ROOM) this.playSound('fridge', -1);
    this.roomSoundDue = true;
  }

  // GameMidlet.q(int) again, on the room that's showing, when a rule has changed it.
  reloadRoom() {
    if (this.mode === MODE.ROOM) this.enterRoom(this.room);
  }

  // The update's p flag, so this comes after the sounds of the rule that's just entered a room.
  tickRoomSound() {
    if (!this.roomSoundDue || this.mode !== MODE.ROOM) return;
    this.roomSoundDue = false;
    if (this.hasMonster(this.room) && !this.flagM && !this.timedDialogue) this.playSound('whisper', -1);
  }

  hasMonster(room) {
    const [monster, chapter, world] = this.tables.roomEncounters[room];
    return (
      !this.roomCleared[room] &&
      monster !== 0 &&
      (chapter === 0 || chapter === this.chapter) &&
      (world === 0 || world === this.world)
    );
  }

  // Leaving a room, as in GameMidlet.t() and the update's handling of what it starts.
  leaveRoom() {
    const { room } = this;
    const fight = this.hasMonster(room);
    if (room === COLD_ROOM) this.stopSound();
    if (fight) this.stopSound();
    if ((this.randomBit() === 1 && !fight && room !== COLD_ROOM) || room === NOISY_DOOR_ROOM) {
      this.playSound('door_opening');
    }
    this.fadeThen(() => {
      if (fight) {
        if (NORTH_FIGHT_ROOMS.has(room)) this.facing = FACING.NORTH;
        this.facing = behind(this.facing);
        const [monster] = this.tables.roomEncounters[room];
        this.startFight(monster, false);
      } else {
        this.mode = MODE.CORRIDOR;
        this.facing = behind(this.facing);
      }
      this.fire(TRIGGER.LEFT_ROOM, room);
    });
  }

  startFight(monster, inRoom) {
    this.mode = MODE.FIGHT;
    this.verbs = null;
    this.fight = new Fight(this, monster, inRoom);
    this.centerCursor();
    this.shake = 500;
    const weapon = this.weapon;
    if (this.loaded[weapon] === 0) {
      if (this.bullets[weapon] > 0) this.startReload();
      else this.changeWeaponIfEmpty();
    } else {
      this.reloading = false;
      this.reloadWait = 0;
    }
    this.fire(TRIGGER.FIGHT_STARTED, 0);
  }

  // A monster has finished dying, as in the update.
  fightWon(fight) {
    this.roomCleared[this.room] = true;
    if (fight.inRoom) {
      this.fight = null;
      this.mode = MODE.ROOM;
      this.fire(TRIGGER.FIGHT_WON, FINAL_MONSTER);
      return;
    }
    this.fadeThen(() => {
      this.fight = null;
      this.mode = MODE.CORRIDOR;
      this.fire(TRIGGER.FIGHT_WON, -1);
    });
  }

  changeWeaponIfEmpty() {
    const { weapon, loaded, bullets } = this;
    if (loaded[weapon] !== 0 || bullets[weapon] !== 0) return;
    const usable = (item, index) => this.hasItem(item) && (bullets[index] > 0 || loaded[index] > 0);
    if (usable(ITEM.SHOTGUN, 2)) this.weapon = 2;
    else if (usable(ITEM.PISTOL, 1)) this.weapon = 1;
    else this.weapon = 0;
  }

  startReload() {
    this.reloading = true;
    this.reloadWait = this.tables.reloadTime[this.weapon];
  }

  // Filling the weapon's clip from what's left, as in GameMidlet.c(int).
  reload(weapon) {
    const { bullets, loaded } = this;
    const amount = Math.min(CLIP_SIZE[weapon] - loaded[weapon], bullets[weapon] - loaded[weapon]);
    loaded[weapon] += amount;
    if (bullets[weapon] <= 0) {
      if (weapon === 1) this.removeItem(ITEM.PISTOL_BULLETS);
      if (weapon === 2) this.removeItem(ITEM.SHOTGUN_BULLETS);
    }
  }

  equip(weapon) {
    this.weapon = weapon;
  }

  // Health, and the level its picture shows, as in GameMidlet.r(int). It reports when a level
  // is crossed, which is when a monster's blow makes the phone shake.
  setHealth(value) {
    this.health = this.weakened ? Math.min(value, WEAK_HEALTH) : value;
    const { health, healthLevel } = this;
    let crossed = false;
    if (health >= WEAK_HEALTH) this.healthLevel = 0;
    else if (health >= 35) {
      crossed = healthLevel === 0;
      this.healthLevel = 1;
    } else if (health >= 1) {
      crossed = healthLevel <= 1;
      this.healthLevel = 2;
    } else {
      crossed = healthLevel !== 3;
      this.healthLevel = 3;
    }
    return crossed;
  }

  // Emilie is weaker than Vincent, until a rule has decided otherwise.
  setWeakened(weakened) {
    this.weakened = this.ruleFired[46] ? false : weakened;
    if (this.weakened && this.health > WEAK_HEALTH) this.health = WEAK_HEALTH;
  }

  healFully() {
    this.health = this.weakened ? WEAK_HEALTH : 100;
    this.healFlash.restart();
  }

  healSome() {
    this.health = Math.min(this.health + (this.weakened ? 30 : 50), this.weakened ? WEAK_HEALTH : 100);
    this.healFlash.restart();
  }

  damagePlayer(amount) {
    if (this.setHealth(this.health - amount)) {
      this.shake = SHAKE_TIME;
      this.vibrateFor(2);
    }
    this.damageFlash.restart();
    if (this.health <= 0) this.die();
  }

  showBloodOverlay() {
    const { animation, sheet } = this.data.hardCoded.bloodOverlay;
    this.bloodOverlay = { sheet, playing: new Playing(this.data.animation(animation), ONCE) };
  }

  die() {
    this.fight = null;
    this.puzzle = null;
    this.gameOver = true;
    this.verbs = null;
    this.inventory.close();
    this.reloading = false;
    this.shake = 0;
    this.dialogue = null;
    this.showMessage(this.lines[TEXT.DEAD], { wide: false });
    this.vibrateFor(2);
  }

  // After "Retry" a saved game comes back, and without one the game starts again.
  retry() {
    this.gameOver = false;
    this.closeBox();
    if (!this.loadGame()) this.startNewGame();
  }

  quitToFrontEnd() {
    this.gameOver = false;
    this.pause = null;
    this.box = null;
    this.stopSound();
    this.frontEnd = new FrontEnd(this);
    this.frontEnd.showMainMenu();
    this.playSound('music');
  }

  // Opening a door, as i.c(int, int).
  useDoor(door) {
    if (door in STAIRS) {
      this.takeStairs(door);
      return;
    }
    if (LIFTS.has(door)) {
      this.openLift();
      return;
    }
    const [stepRow, stepColumn] = STEP[this.facing];
    const room = this.grid[this.row + stepRow]?.[this.column + stepColumn];
    if (room === undefined || room < 0) return;
    const state = this.doorStates[room]?.[this.chapter - 1];
    if (state === 1) {
      this.fadeThen(() => {
        this.enterRoom(room);
        if (this.mode === MODE.ROOM || this.fight) this.fire(TRIGGER.ENTERED_ROOM, room);
      });
      return;
    }
    if (state === 3) this.showText(TEXT.DOOR_BARRED);
    else if (!this.fire(TRIGGER.DOOR, door)) this.showText(TEXT.DOOR_LOCKED);
  }

  lookAt(hotspot) {
    if (hotspot.kind === 'door') {
      this.showText(TEXT.DOOR_LOOK);
      return;
    }
    if (hotspot.kind === 'prop') {
      const index = Math.floor((hotspot.id - FIRST_PROP) / PROP_STEP);
      this.showText((this.world === 1 ? this.tables.propLooks : this.tables.propLooksDark)[index]);
      return;
    }
    const { id } = hotspot;
    if (this.fire(TRIGGER.LOOK, id)) return;
    const dark = this.world === 2;
    const conditional = (dark ? this.tables.objectLookConditionsDark : this.tables.objectLookConditions)[id];
    if (conditional[0] !== -1 && this.ruleFired[conditional[1]]) {
      this.showText(conditional[0]);
      return;
    }
    const looks = (dark ? this.tables.objectLooksDark : this.tables.objectLooks)[id];
    this.showText(looks.length > 1 ? looks[this.chapter - 1] : looks[0]);
  }

  useOn(hotspot) {
    if (hotspot.kind === 'door') {
      this.useDoor(hotspot.id);
      return;
    }
    if (hotspot.kind === 'prop') {
      if (this.fire(TRIGGER.USE_OBJECT, hotspot.id)) {
        if (hotspot.id === PICKED_UP_PROP) {
          this.propTaken[Math.floor((hotspot.id - FIRST_PROP) / PROP_STEP)] = true;
        }
      } else {
        this.showText(this.tables.propRefusals[Math.floor((hotspot.id - FIRST_PROP) / PROP_STEP)]);
      }
      return;
    }
    const { id } = hotspot;
    if (this.tables.objectStates[id][2] === 0) {
      this.addItem(id);
      this.objectTaken[id] = true;
      this.showMessage(`${this.lines[TEXT.TOOK]}${this.lines[this.tables.objectNames[id]]}`, { icon: id });
      return;
    }
    if (!this.fire(TRIGGER.USE_OBJECT, id)) this.showText(this.tables.objectTakeRefusals[id]);
  }

  // Kept sorted, as d.a(int) keeps it. Vincent's list is kept aside for his return.
  addItem(item) {
    if (this.items.includes(item) && (item === ITEM.PISTOL_BULLETS || item === ITEM.SHOTGUN_BULLETS)) return;
    this.items.push(item);
    this.items.sort((a, b) => a - b);
    if (this.chapter === 1) this.vincentItems.push(item);
    this.inventory.itemsChanged();
  }

  removeItem(item) {
    const at = this.items.indexOf(item);
    if (at > -1) this.items.splice(at, 1);
    if (this.chapter === 1) {
      const kept = this.vincentItems.indexOf(item);
      if (kept > -1) this.vincentItems.splice(kept, 1);
    }
    this.inventory.itemsChanged();
  }

  fire(kind, id) {
    return fireTrigger(this.tables, this, kind, id, (actions) => this.runActions(actions));
  }

  fireWithItem(target, item) {
    return fireItemTrigger(this.tables, this, target, item, (actions) => this.runActions(actions));
  }

  // As GameMidlet.t(int).
  runActions(actions) {
    for (const [kind, first, second] of actions) {
      switch (kind) {
        case 0:
          this.showText(first);
          break;
        case 1:
          if (first === TIMED_DIALOGUE) this.timedDialogue = TIMED_DIALOGUE_LENGTH;
          this.showDialogue(first);
          break;
        case 13:
          this.showDialogue(first, { black: true });
          break;
        case 2:
          this.objectValue[first] = second;
          this.reloadRoom();
          break;
        case 3:
          this.objectHidden[first] = second;
          this.reloadRoom();
          break;
        case 4:
          this.startPuzzle(first);
          break;
        case 5:
          this.fight = null;
          this.enterRoom(first);
          break;
        case 7:
          this.addItem(first);
          this.objectTaken[first] = true;
          // Any box that's up stays, so a rule giving several things names the first.
          if (!this.box) {
            this.showMessage(`${this.lines[TEXT.TOOK]}${this.lines[this.tables.objectNames[first]]}`, {
              icon: first,
            });
          }
          break;
        case 8:
          this.removeItem(first);
          break;
        case 10:
          this.startChapter(first + 1);
          break;
        case 11:
          this.setWorld(this.world === 1 ? 2 : 1);
          this.reloadRoom();
          this.vibrateFor(0);
          this.playSound('alarm');
          break;
        case 14:
          this.gainBullets(first, second);
          break;
        case 15: {
          // The higher numbers are the same doors' views from further away.
          let door = first;
          if (Math.floor(door / PROP_STEP) > 20) door -= 21;
          else if (Math.floor(door / PROP_STEP) > 13) door -= PROP_STEP;
          this.doorStates[Math.floor(door / PROP_STEP)][this.chapter - 1] = 1;
          break;
        }
        case 16:
          this.setWeakened(first !== 0);
          break;
        case 17:
          this.setHealth(first);
          break;
        case 18:
          this.vibrateFor(first);
          break;
        case 19:
          this.quitToFrontEnd();
          break;
        case 20:
          this.shake = first;
          break;
        case 21:
          this.playSoundNumber(first);
          break;
        default:
      }
    }
  }

  gainBullets(weapon, amount) {
    this.bullets[weapon] += amount;
    if (!this.box) {
      const [line, icon] =
        weapon === 1 ? [TEXT.BULLETS_PISTOL, ITEM.PISTOL_BULLETS] : [TEXT.BULLETS_SHOTGUN, ITEM.SHOTGUN_BULLETS];
      this.showMessage(`${this.lines[TEXT.TOOK]}${this.lines[line]}`, { icon });
    }
    if (weapon === 1 && this.hasItem(ITEM.PISTOL)) {
      this.weapon = 1;
      this.reload(1);
    }
    if (weapon === 2 && this.hasItem(ITEM.SHOTGUN)) {
      this.weapon = 2;
      this.reload(2);
    }
  }

  setWorld(world) {
    this.world = world;
    this.fire(TRIGGER.WORLD, world);
  }

  // A new chapter changes who's being played, as in GameMidlet.a(int, boolean) and the rule
  // action that calls it.
  startChapter(chapter) {
    this.chapter = chapter;
    this.fire(TRIGGER.CHAPTER, chapter);
    this.setHealth(100);
    if (chapter === 2) {
      this.setWeakened(false);
      this.items = [];
      for (const item of [ITEM.MAP, ITEM.MELEE, ITEM.PISTOL, ITEM.PISTOL_BULLETS]) this.addItem(item);
      this.bullets[1] = 5;
      this.weapon = 1;
      this.loaded[1] = 0;
      this.reload(1);
    } else if (chapter === 3) {
      this.setWeakened(true);
      this.items = [...this.vincentItems].sort((a, b) => a - b);
      for (const item of USED_UP_BY_CHAPTER_THREE) this.removeItem(item);
      if (this.hasItem(ITEM.SHOTGUN)) {
        this.weapon = 2;
        this.reload(2);
      } else if (this.hasItem(ITEM.PISTOL)) {
        this.weapon = 1;
        this.reload(1);
      } else {
        this.weapon = 0;
      }
    }
    this.inventory.itemsChanged();
    this.roomCleared.fill(false);
    this.doorStates = this.tables.chapterStates.map((row) => [...row]);
    if (chapter === 2) {
      this.setWorld(2);
      this.floor = 1;
      this.placeInCorridor(40, 3);
      this.objectHidden[144] = 1;
      this.fight = null;
      this.enterRoom(COLD_ROOM);
    } else if (chapter === 3) {
      this.floor = 1;
      this.placeInCorridor(37, 2);
      this.objectHidden[144] = 0;
      this.fight = null;
      this.enterRoom(7);
    }
    this.saveGame({ quietly: true });
  }

  startPuzzle(number) {
    this.puzzleFrom = this.mode;
    this.mode = MODE.PUZZLE;
    this.verbs = null;
    this.puzzle = createPuzzle(this, number);
    this.centerCursor();
  }

  // Where a finished puzzle returns to, from GameMidlet.af() and ag().
  finishPuzzle(puzzle, solved) {
    const { number } = puzzle;
    this.puzzle = null;
    const toRoom = number === 2 || number === 4;
    if (solved) {
      if (number === 1) this.phoneSolved = true;
      if (number === 2) this.flagL = true;
      if (number === 6) this.flagM = true;
    }
    this.mode = toRoom ? MODE.ROOM : MODE.CORRIDOR;
    if (number === PUZZLE.SAFE) this.resumeLoopingSound();
    // A number that kills goes straight to dying, with no rule, as GameMidlet.ag() does.
    if (number !== PUZZLE.SAFE || this.health > 0) {
      this.fire(solved ? TRIGGER.PUZZLE_SOLVED : TRIGGER.PUZZLE_FAILED, number);
    }
    if (this.health <= 0 && !this.gameOver) this.die();
    this.centerCursor();
  }

  // Backing out of the safe isn't a wrong number, so no rule fires, as the right soft key's
  // case for this puzzle.
  leaveSafe() {
    this.puzzle = null;
    this.mode = MODE.ROOM;
    this.resumeLoopingSound();
    this.centerCursor();
  }

  safeWasWrong() {
    this.setHealth(this.health - SAFE_DAMAGE);
    this.redFlash = RED_FLASH_TIME;
    this.shake = SHAKE_TIME;
    this.damageFlash.restart();
    this.showBloodOverlay();
  }

  // Sound. The original plays one thing at a time, as the port's player does.
  playSound(name, loops = 1) {
    this.loopingSound = loops === -1 ? name : null;
    this.audio?.play(name, loops);
  }

  stopSound() {
    this.loopingSound = null;
    this.audio?.stop?.();
  }

  // The numbers in the rules, from GameMidlet.f(int, int).
  playSoundNumber(number) {
    const names = [
      'alarm',
      'firing_pistol',
      'firing_shotgun',
      'fridge',
      'hit_claw',
      'interference',
      'monster_movement',
      'whisper',
      'music',
      'door_opening',
    ];
    if (names[number]) this.playSound(names[number]);
  }

  resumeLoopingSound() {
    if (this.loopingSound) this.audio?.play(this.loopingSound, -1);
  }

  vibrateFor(pattern) {
    if (!this.vibrationOn || !this.vibrator || !VIBRATIONS[pattern]) return;
    this.vibrator(VIBRATIONS[pattern]);
  }

  randomBit() {
    return this.random() < 0.5 ? 1 : 0;
  }

  randomBetween(low, high) {
    return low + Math.floor(this.random() * (high - low + 1));
  }

  // Text in a box. As in the original there's one at a time, and a new one replaces it.
  showBox(box, onClosed = null) {
    this.box = box;
    this.boxClosed = onClosed;
  }

  showText(line) {
    this.showMessage(this.lines[line]);
  }

  showLine(text) {
    this.showMessage(text);
  }

  showMessage(text, { wide = false, icon = null } = {}) {
    this.showBox(this.boxes.message(text, { wide: wide || icon !== null, icon: this.iconFor(icon) }));
  }

  // An item's picture and its size, as in GameMidlet.a(String, int, int, boolean, int).
  iconFor(item) {
    if (item === null) return null;
    const frame = this.tables.inventoryIcons.indexOf(item);
    if (frame < 0) return null;
    const { sheet, animation } = this.data.hardCoded.inventory;
    const parsed = this.data.animation(animation);
    const parts = { ...parsed, frames: [parsed.frames[frame]] };
    const { height } = animationSize(this.data.sheet(sheet), parts);
    return { item, frame, height };
  }

  showSpeech(speaker, text, onClosed = null) {
    this.showBox(this.boxes.dialogue(speaker, text), onClosed);
  }

  showDialogue(number, { black = false } = {}) {
    this.dialogue = { number, index: 0 };
    this.blackBehindDialogue = black;
    this.showDialogueLine();
  }

  showDialogueLine() {
    const { number, index } = this.dialogue;
    const [speaker, line] = this.tables.dialogues[number][index];
    this.showBox(this.boxes.dialogue(this.lines[speaker], this.lines[line]));
  }

  // When the last line ends, a rule may be waiting for it.
  advanceDialogue() {
    const { number } = this.dialogue;
    this.dialogue.index++;
    if (this.dialogue.index < this.tables.dialogues[number].length) {
      this.showDialogueLine();
      return;
    }
    this.endDialogue();
  }

  endDialogue() {
    const { number } = this.dialogue;
    this.dialogue = null;
    this.blackBehindDialogue = false;
    this.box = null;
    this.fire(TRIGGER.DIALOGUE_ENDED, number);
  }

  closeBox() {
    const closed = this.boxClosed;
    this.box = null;
    this.boxClosed = null;
    closed?.();
    if (!this.box) this.inventory.reopenIfWaiting();
  }

  get currentText() {
    if (!this.box) return null;
    const { kind, speaker, text } = this.box;
    return kind === BOX.DIALOGUE || kind === BOX.MESSAGE ? { speaker, text } : null;
  }

  // Clicking a box, or pressing its button. Long words scroll before they end.
  confirmBox() {
    const { box } = this;
    if (this.gameOver) {
      this.retry();
      return;
    }
    if (box.rows) {
      if (this.liftMenu) this.chooseLiftFloor(box.selected);
      return;
    }
    if (box.lines && box.pageLines && box.scroll + box.pageLines < box.lines.length) {
      box.scroll += box.pageLines;
      return;
    }
    if (this.dialogue) this.advanceDialogue();
    else this.closeBox();
  }

  skipBox() {
    if (this.gameOver) {
      this.quitToFrontEnd();
      return;
    }
    if (this.liftMenu) {
      this.liftMenu = false;
      this.closeBox();
      return;
    }
    if (this.dialogue) this.endDialogue();
    else this.closeBox();
  }

  scrollBox(direction) {
    const { box } = this;
    if (box.rows) {
      box.selected = (box.selected + direction + box.rows.length) % box.rows.length;
    } else if (box.pageLines) {
      const last = Math.max(0, box.lines.length - box.pageLines);
      box.scroll = Math.max(0, Math.min(last, box.scroll + direction * box.pageLines));
    }
  }

  // The wheel of verbs is centered on the cursor and kept on the screen, as in GameMidlet.h(int).
  verbArt() {
    const [sheet, animation] = this.tables.cursorSprites[1];
    return { sheet, animation, ...animationSize(this.data.sheet(sheet), this.data.animation(animation)) };
  }

  openVerbs(hotspot) {
    const { width, height } = this.verbArt();
    const x = Math.max(0, Math.min(SCENE_WIDTH - width, Math.round(this.cursorX - width / 2)));
    const y = Math.max(0, Math.min(SCENE_HEIGHT - height, Math.round(this.cursorY - height / 2)));
    this.verbs = { hotspot, x, y, selected: VERB.LOOK };
  }

  // Each arm of the wheel is a module of its art: the second to fourth in all builds' art,
  // as look, use and inventory. Keypad builds show one per frame, and touch builds all three.
  verbArms() {
    const { sheet, animation } = this.verbArt();
    const parts = this.data.animation(animation).frames.flatMap((frame) => frame.parts);
    return [
      { verb: VERB.LOOK, module: 1 },
      { verb: VERB.USE, module: 2 },
      { verb: VERB.INVENTORY, module: 3 },
    ].map(({ verb, module }) => {
      const part = parts.find((candidate) => candidate.module === module);
      return { verb, dx: -part.x, dy: -part.y, ...this.data.moduleSize(sheet, module) };
    });
  }

  verbAt(px, py) {
    if (!this.verbs) return null;
    const { x, y } = this.verbs;
    return (
      this.verbArms().find(
        ({ dx, dy, width, height }) => px >= x + dx && px < x + dx + width && py >= y + dy && py < y + dy + height,
      )?.verb ?? null
    );
  }

  chooseVerb(verb) {
    const { hotspot } = this.verbs;
    this.verbs = null;
    if (verb === VERB.LOOK) this.lookAt(hotspot);
    else if (verb === VERB.USE) this.useOn(hotspot);
    else this.inventory.open(hotspot);
  }

  isBusy() {
    return Boolean(this.fade);
  }

  // The page's methods.
  tick() {
    this.time += MILLISECONDS_PER_TICK;
    if (this.frontEnd) {
      this.frontEnd.tick(MILLISECONDS_PER_TICK);
      return;
    }
    if (this.pause) return;
    this.runFadeAction();
    this.tickRoomSound();
    this.tickHeld();
    this.tickHud();
    this.settleKick();
    if (this.timedDialogue > 0) {
      this.timedDialogue -= MILLISECONDS_PER_TICK;
      if (this.timedDialogue <= 0) this.playSound('whisper', -1);
    }
    if (this.reloading) {
      this.reloadWait -= MILLISECONDS_PER_TICK;
      if (this.reloadWait < 0) {
        this.reloading = false;
        if (this.bullets[this.weapon] >= 0) this.reload(this.weapon);
      }
    }
    if (!this.fade || this.fight) {
      if (this.puzzle && !this.box) this.puzzle.tick(MILLISECONDS_PER_TICK);
      if (this.fight) {
        this.tickAimDrift();
        this.fight?.tick(MILLISECONDS_PER_TICK);
      }
    }
    this.advanceFade();
  }

  runFadeAction() {
    const { fade } = this;
    if (fade?.stage !== FADE.BLACK || !fade.atBlack) return;
    const { atBlack } = fade;
    fade.atBlack = null;
    atBlack();
  }

  // Comes last in an update, as in the original, so what starts a fade in an update sees it
  // black in the next.
  advanceFade() {
    const { fade } = this;
    if (!fade) return;
    if (fade.stage === FADE.STIPPLED_IN) fade.stage = FADE.BLACK;
    else if (fade.stage === FADE.BLACK) {
      if (fade.hold > 0) fade.hold -= MILLISECONDS_PER_TICK;
      else fade.stage = FADE.STIPPLED_OUT;
    } else if (fade.stage === FADE.STIPPLED_OUT) fade.stage = FADE.DONE;
    else this.fade = null;
  }

  tickHud() {
    this.damageFlash.advance(MILLISECONDS_PER_TICK);
    this.healFlash.advance(MILLISECONDS_PER_TICK);
    if (this.shake > 0) this.shake -= MILLISECONDS_PER_TICK;
    if (this.redFlash > 0) this.redFlash -= MILLISECONDS_PER_TICK;
    if (this.bloodOverlay) {
      this.bloodOverlay.playing.advance(MILLISECONDS_PER_TICK);
      if (!this.bloodOverlay.playing.running) this.bloodOverlay = null;
    }
  }

  // A weapon's aim wanders, as in GameMidlet.U().
  tickAimDrift() {
    if (this.box || this.inventory.isOpen) return;
    if (this.randomBit() !== 1 && this.weapon !== 0) return;
    const limit = this.tables.aimDrift[this.weapon];
    const wander = (value) => Math.max(-limit, Math.min(limit, value + (this.randomBit() === 1 ? 1 : -1)));
    this.drift.x = wander(this.drift.x);
    this.drift.y = wander(this.drift.y);
    this.kick(this.drift.x, this.drift.y);
  }

  // Recoil and the aim's wandering move a cursor that's steered with keys, as on the original's
  // keypad, and the player steers it back. So they do with a captured mouse. A free mouse's
  // position is its own, so with one, the kick settles back to it.
  kick(dx, dy) {
    if (this.aimingWithKeys || this.pointerLocked) {
      this.pointerX += dx;
      this.pointerY += dy;
    } else {
      this.kickX += dx;
      this.kickY += dy;
    }
    this.moveCursor(this.pointerX, this.pointerY);
  }

  settleKick() {
    if (!this.kickX && !this.kickY) return;
    this.kickX = Math.trunc(this.kickX / 2);
    this.kickY = Math.trunc(this.kickY / 2);
    this.moveCursor(this.pointerX, this.pointerY);
  }

  centerCursor() {
    this.kickX = 0;
    this.kickY = 0;
    this.moveCursor(SCENE_WIDTH / 2, SCENE_HEIGHT / 2);
  }

  // Keys take over from the mouse where the cursor is, kick and all.
  aimWithKeys() {
    if (this.aimingWithKeys) return;
    this.aimingWithKeys = true;
    this.pointerX = this.cursorX;
    this.pointerY = this.cursorY;
    this.kickX = 0;
    this.kickY = 0;
  }

  // Keys held in a fight or puzzle move the cursor, faster the longer they're down.
  tickHeld() {
    if (!this.held.size || !(this.fight || this.puzzle) || this.box || this.inventory.isOpen) {
      this.holdSpeed = HOLD_START;
      this.holdTimer = 0;
      return;
    }
    this.aimWithKeys();
    this.holdTimer += MILLISECONDS_PER_TICK;
    if (this.holdTimer >= HOLD_STEP_TIME) {
      this.holdTimer = 0;
      this.holdSpeed = Math.min(HOLD_FASTEST, this.holdSpeed + 1);
    }
    let { cursorX: x, cursorY: y } = this;
    if (this.held.has('up')) y -= this.holdSpeed;
    if (this.held.has('down')) y += this.holdSpeed;
    if (this.held.has('left')) x -= this.holdSpeed;
    if (this.held.has('right')) x += this.holdSpeed;
    this.moveCursor(x, y);
  }

  moveCursor(x, y) {
    this.pointerX = Math.max(0, Math.min(SCENE_WIDTH - 1, x));
    this.pointerY = Math.max(0, Math.min(SCENE_HEIGHT - 1, y));
    this.cursorX = Math.max(0, Math.min(SCENE_WIDTH - 1, this.pointerX + this.kickX));
    this.cursorY = Math.max(0, Math.min(SCENE_HEIGHT - 1, this.pointerY + this.kickY));
    if (this.frontEnd) {
      this.frontEnd.hover(this.screenX, this.cursorY);
      return;
    }
    if (this.pause) {
      this.pause.hover(this.screenX, this.cursorY);
      return;
    }
    if (this.inventory.isOpen) {
      this.inventory.hover(this.screenX, this.cursorY);
      return;
    }
    if (this.box?.rows) {
      const row = this.boxes.rowAt(this.box, this.screenX, this.cursorY);
      if (row > -1) this.box.selected = row;
    }
    if (this.verbs) {
      const verb = this.verbAt(this.cursorX, this.cursorY);
      if (verb !== null) this.verbs.selected = verb;
    }
  }

  // A click at the cursor, on whatever's on top.
  click() {
    if (this.frontEnd) {
      this.frontEnd.click(this.screenX, this.cursorY);
      return;
    }
    if (this.pause) {
      this.pause.click(this.screenX, this.cursorY);
      return;
    }
    if (this.map) {
      this.map.click(this.screenX);
      return;
    }
    if (this.box) {
      if (this.timedDialogue > 0) return;
      if (this.box.rows && this.boxes.rowAt(this.box, this.screenX, this.cursorY) < 0) return;
      this.confirmBox();
      return;
    }
    if (this.isBusy() && !this.fight) return;
    if (this.inventory.isOpen) {
      this.inventory.click(this.screenX, this.cursorY);
      return;
    }
    if (this.puzzle) {
      this.puzzle.click(this.screenX, this.cursorY);
      return;
    }
    if (this.fight) {
      this.fight.click(this.screenX, this.cursorY);
      return;
    }
    if (this.verbs) {
      const verb = this.verbAt(this.cursorX, this.cursorY);
      if (verb === null) this.verbs = null;
      else this.chooseVerb(verb);
      return;
    }
    const action = this.action();
    if (action) this.doAction(action);
  }

  doAction(action) {
    switch (action.kind) {
      case 'verbs':
        this.openVerbs(action.hotspot);
        break;
      case 'leave':
        this.leaveRoom();
        break;
      case 'stairs':
        this.useDoor(action.hotspot.id);
        break;
      case 'forward':
        this.walkForward();
        break;
      case 'turn-left':
        this.turnTo(left(this.facing));
        break;
      case 'turn-right':
        this.turnTo(right(this.facing));
        break;
      case 'turn-back':
        this.turnTo(behind(this.facing));
        break;
    }
  }

  // Keys. The arrow keys arrive as these while a menu is up, and as moves otherwise.
  pressKey(key) {
    if (this.frontEnd) {
      this.frontEnd.pressKey(key);
      return;
    }
    if (this.pause) {
      this.pause.pressKey(key);
      return;
    }
    if (this.map) {
      this.map.pressKey(key);
      return;
    }
    if (this.box) {
      if (this.timedDialogue > 0) return;
      if (key === 'Enter') this.confirmBox();
      else if (key === 'Escape') this.skipBox();
      else if (key === 'ArrowUp' || key === 'ArrowLeft') this.scrollBox(-1);
      else if (key === 'ArrowDown' || key === 'ArrowRight') this.scrollBox(1);
      return;
    }
    if (this.isBusy() && !this.fight) return;
    if (this.inventory.isOpen) {
      this.inventory.pressKey(key);
      return;
    }
    if (this.verbs) {
      if (key === 'Enter') this.chooseVerb(this.verbs.selected);
      else if (key === 'Escape') this.verbs = null;
      else if (key === 'ArrowRight' || key === 'ArrowDown') this.verbs.selected = (this.verbs.selected + 1) % 3;
      else if (key === 'ArrowLeft' || key === 'ArrowUp') this.verbs.selected = (this.verbs.selected + 2) % 3;
      return;
    }
    if (key === 'Enter') {
      this.click();
      return;
    }
    if (key === 'Escape') {
      this.pressSoftKey('right');
      return;
    }
    if (key === 'inventory') {
      // As the class d does, an item is used on whatever the cursor is on.
      if (!this.puzzle) this.inventory.open(this.action()?.kind === 'verbs' ? this.action().hotspot : null);
      return;
    }
    if (key === 'map') {
      if (this.hasItem(ITEM.MAP) && !this.fight && !this.puzzle) this.map = new MapScreen(this, this.floor);
      return;
    }
    if (this.puzzle) {
      if (/^[0-9]$/.test(key)) this.puzzle.pressDigit(Number(key));
      else if (key === 'hotspot-next' || key === 'hotspot-previous') this.puzzle.softLeft();
      return;
    }
    if (key === '1') {
      this.nextWeapon();
      return;
    }
    if (key === '3') {
      this.quickHeal();
      return;
    }
    if (key === 'hotspot-next' || key === 'hotspot-previous') {
      this.jumpToHotspot(key === 'hotspot-next' ? 1 : -1);
      return;
    }
    if (this.fight) return;
    if (key === 'move-forward') {
      if (this.mode === MODE.CORRIDOR && this.canWalkForward()) this.walkForward();
    } else if (key === 'move-back') {
      if (this.mode === MODE.ROOM) this.leaveRoom();
      else this.turnTo(behind(this.facing));
    } else if (this.mode === MODE.CORRIDOR && key === 'move-left') {
      this.turnTo(left(this.facing));
    } else if (this.mode === MODE.CORRIDOR && key === 'move-right') {
      this.turnTo(right(this.facing));
    }
  }

  // The page's Gun button: the original only changes weapons from the inventory.
  nextWeapon() {
    const carried = [ITEM.MELEE, ITEM.PISTOL, ITEM.SHOTGUN];
    for (let step = 1; step <= 3; step++) {
      const weapon = (this.weapon + step) % 3;
      if (this.hasItem(carried[weapon])) {
        this.equip(weapon);
        return;
      }
    }
  }

  // The original's key for using a health pack, from its update.
  quickHeal() {
    if (this.hasItem(ITEM.HEALTH_PACK)) {
      this.healFully();
      this.removeItem(ITEM.HEALTH_PACK);
    } else if (this.hasItem(ITEM.MEDIPACK)) {
      this.healSome();
      this.removeItem(ITEM.MEDIPACK);
    }
  }

  // For players without a mouse, E and Q move between what can be clicked.
  jumpToHotspot(direction) {
    const spots = this.hotspots();
    if (!spots.length) return;
    const middle = ({ x0, x1, y0, y1 }) => [(x0 + x1) >> 1, (y0 + y1) >> 1];
    const here = spots.findIndex(({ x0, x1, y0, y1 }) => {
      return this.cursorX >= x0 && this.cursorX <= x1 && this.cursorY >= y0 && this.cursorY <= y1;
    });
    const next = (here + direction + spots.length) % spots.length;
    this.moveCursor(...middle(spots[here === -1 ? 0 : next]));
  }

  pressSoftKey(side) {
    if (this.frontEnd) {
      this.frontEnd.pressKey(side === 'left' ? 'Enter' : 'Escape');
      return;
    }
    if (this.pause) {
      this.pause.pressKey(side === 'left' ? 'Enter' : 'Escape');
      return;
    }
    if (this.map) {
      this.map = null;
      return;
    }
    if (this.box) {
      if (this.timedDialogue > 0) return;
      if (side === 'left') this.confirmBox();
      else this.skipBox();
      return;
    }
    if (this.isBusy() && !this.fight) return;
    if (this.inventory.isOpen) {
      this.inventory.pressKey(side === 'left' ? 'Enter' : 'Escape');
      return;
    }
    if (this.verbs) {
      if (side === 'left') this.chooseVerb(this.verbs.selected);
      else this.verbs = null;
      return;
    }
    if (this.puzzle) {
      if (side === 'left') this.puzzle.softLeft();
      else this.puzzle.softRight();
      return;
    }
    if (side === 'left') this.pressKey('map');
    else if (!this.fight || this.health > 0) this.openPause();
  }

  openPause() {
    if (this.puzzle?.number === 4) return;
    this.pause = new PauseMenu(this);
    this.audio?.stop?.();
  }

  closePause() {
    this.pause = null;
    this.resumeLoopingSound();
  }

  softKeys() {
    const { softKeyLines } = this.tables;
    const label = (index) => (index === null ? null : { label: this.lines[softKeyLines[index]] });
    if (this.frontEnd) return this.frontEnd.softKeys(label);
    if (this.pause) return { left: label(KEY.SELECT), right: label(KEY.BACK) };
    if (this.map) return { left: null, right: label(KEY.BACK) };
    if (this.gameOver) return { left: label(KEY.RETRY), right: label(KEY.MAIN_MENU) };
    if (this.box) {
      if (this.timedDialogue > 0) return { left: null, right: null };
      if (this.dialogue || this.box.kind === BOX.DIALOGUE) return { left: label(KEY.CONTINUE), right: label(KEY.SKIP) };
      if (this.box.rows) return { left: label(KEY.SELECT), right: label(KEY.BACK) };
      return { left: null, right: label(KEY.BACK) };
    }
    if (this.inventory.isOpen) return { left: label(KEY.SELECT), right: label(KEY.BACK) };
    if (this.verbs) return { left: label(KEY.SELECT), right: label(KEY.BACK) };
    if (this.puzzle) {
      const { left: leftKey, right: rightKey } = this.puzzle.softKeyLabels();
      return { left: label(leftKey), right: label(rightKey) };
    }
    const map = !this.fight && this.hasItem(ITEM.MAP);
    return {
      left: map ? { ...label(KEY.MAP), action: 'map' } : null,
      right: label(KEY.PAUSE),
    };
  }

  holdDirection(direction, down) {
    if (down) this.held.add(direction);
    else this.held.delete(direction);
    this.puzzle?.holdDirection(direction, down);
  }

  releaseDirections() {
    this.held.clear();
    this.puzzle?.holdDirection('left', false);
  }

  // In a fight or puzzle, the direction keys move the cursor rather than walk.
  isAiming() {
    return Boolean(this.fight || this.puzzle);
  }

  aimWithMouse() {
    this.aimingWithKeys = false;
  }

  // With the mouse captured, it reports how far it moved rather than where it is.
  movePointerBy(dx, dy) {
    this.moveCursor(this.pointerX + dx, this.pointerY + dy);
  }

  // The Mouse recoil setting captures the mouse in fights, so that recoil lasts with it too.
  get wantsMouseLock() {
    return (
      this.mouseLock &&
      Boolean(this.fight) &&
      !this.frontEnd &&
      !this.pause &&
      !this.box &&
      !this.inventory.isOpen &&
      !this.gameOver
    );
  }

  toggleMouseLock() {
    this.mouseLock = !this.mouseLock;
    try {
      this.storage?.setItem(MOUSE_RECOIL_PREFERENCE, this.mouseLock ? 'on' : 'off');
    } catch {
      // It still applies until the page is closed.
    }
  }

  readPreference(key) {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  // Holding the mouse on the clock's buttons keeps its hands turning.
  wantsStroke() {
    return (
      !this.frontEnd &&
      !this.pause &&
      !this.box &&
      !this.inventory.isOpen &&
      Boolean(this.puzzle?.wantsHold(this.screenX, this.cursorY))
    );
  }

  startStroke() {
    this.stroke = {};
    this.puzzle?.startHold(this.screenX, this.cursorY);
  }

  continueStroke() {}

  endStroke() {
    this.stroke = null;
    this.puzzle?.endHold();
  }

  itemIcons() {
    return null;
  }

  // Saving, as in GameMidlet.az() and p(). The original's are one slot, which this also is.
  canSave() {
    return !this.frontEnd && !this.fight && !this.gameOver && !this.puzzle && !this.dialogue && !this.isBusy();
  }

  hasSave() {
    return this.savedExists;
  }

  // The original's r flag says whether a room is showing, or is behind the puzzle that's up.
  // Pausing the paper puzzle is the one way to save with a puzzle up.
  saveGame({ quietly = false } = {}) {
    const inRoom = this.mode === MODE.ROOM || (this.puzzle && this.puzzleFrom === MODE.ROOM);
    const state = {
      chapter: this.chapter,
      world: this.world,
      floor: this.floor,
      mode: inRoom ? MODE.ROOM : MODE.CORRIDOR,
      room: this.room,
      cell: this.cell,
      facing: this.facing,
      objectValue: this.objectValue,
      objectHidden: this.objectHidden,
      objectTaken: this.objectTaken,
      propTaken: this.propTaken,
      doorStates: this.doorStates,
      roomCleared: this.roomCleared,
      ruleFired: this.ruleFired,
      items: this.items,
      vincentItems: this.vincentItems,
      health: this.health,
      weakened: this.weakened,
      weapon: this.weapon,
      bullets: this.bullets,
      loaded: this.loaded,
      phoneSolved: this.phoneSolved,
      flagL: this.flagL,
      flagM: this.flagM,
    };
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(state));
      this.savedExists = Boolean(this.storage);
      if (!quietly) this.showText(TEXT.SAVED);
    } catch {
      if (!quietly) this.showText(474);
    }
  }

  // As GameMidlet.r(), so that Continue goes, and dying with no later save starts again.
  eraseSave() {
    try {
      this.storage?.removeItem(SAVE_KEY);
    } catch {
      // There's nothing more to do, and this visit still won't offer it.
    }
    this.savedExists = false;
  }

  readSave() {
    try {
      return JSON.parse(this.storage?.getItem(SAVE_KEY) ?? 'null');
    } catch {
      return null;
    }
  }

  loadGame() {
    const state = this.readSave();
    if (!state) return false;
    this.frontEnd = null;
    this.stopSound();
    this.resetRun();
    const { mode, room, cell, facing, ...fields } = state;
    Object.assign(this, fields);
    this.setHealth(state.health);
    this.placeInCorridor(cell, facing);
    this.room = room;
    if (mode === MODE.ROOM) this.enterRoom(room);
    else this.mode = MODE.CORRIDOR;
    return true;
  }

  // Settings, which last between games.
  loadSettings() {
    try {
      const settings = JSON.parse(this.storage?.getItem(SETTINGS_KEY) ?? 'null');
      if (!settings) return;
      this.vibrationOn = settings.vibration && Boolean(this.vibrator);
      if (settings.language) this.setLanguage(settings.language);
    } catch {
      // The defaults will do.
    }
  }

  saveSettings() {
    try {
      this.storage?.setItem(
        SETTINGS_KEY,
        JSON.stringify({ vibration: this.vibrationOn, language: this.chosenLanguage ? this.languageName : null }),
      );
    } catch {
      // They just won't last beyond this visit.
    }
  }

  setLanguage(name) {
    const language = this.data.languages.find((candidate) => candidate.name === name);
    if (!language) return;
    this.languageName = name;
    this.language = LANGUAGE_CODES[name];
    this.lines = this.data.text(language);
    this.chosenLanguage = true;
  }

  // Everything to draw, in order, for the renderer: sprites and modules from sheets, text
  // in the JAR's fonts, and plain rectangles. All are in the scene's coordinates.
  drawList() {
    const screen = this.drawScreen();
    const cursor = this.drawCursor();
    const fade = this.pause ? [] : this.drawFade();
    // A fade covers everything, as aD() comes last in h(). A monster's long dark redraws these
    // over itself.
    if (this.fade?.hold > 0) return [...screen, ...fade, ...this.drawHud(), ...cursor];
    return [...screen, ...cursor, ...fade];
  }

  // As GameMidlet.aD(): the JAR's stipple, tiled over the screen, or black.
  drawFade() {
    const { fade, frontEnd, map, blackBehindDialogue } = this;
    if (!fade || fade.stage === FADE.DONE || frontEnd || map || blackBehindDialogue) return [];
    if (fade.stage === FADE.BLACK) return [{ fill: '#000000', x: 0, y: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT }];
    const { sheet, animation } = this.data.hardCoded.fade;
    const { width: tile } = this.data.moduleSize(sheet, 0);
    const list = [];
    for (let x = 0; x < SCENE_WIDTH; x += tile) {
      for (let y = 0; y < SCENE_HEIGHT; y += tile) list.push({ sheet, animation, frame: 0, x, y });
    }
    return list;
  }

  drawScreen() {
    if (this.frontEnd) return onPhone(this.frontEnd.draw());
    const list = [];
    const shaking = this.shake > 0 && !this.pause;
    const shakeX = shaking ? this.randomBetween(-2, 2) : 0;
    const shakeY = shaking ? this.randomBetween(-2, 2) : 0;
    const shifted = (items) => items.map((item) => ({ ...item, x: item.x + shakeX, y: item.y + shakeY }));
    if (this.map) return onPhone(this.map.draw());
    if (this.blackBehindDialogue) {
      list.push(...onPhone(this.drawBox()));
      return list;
    }
    list.push(...this.drawWorld(shifted));
    if (this.redFlash > 0) list.push({ fill: '#aa0000', x: 0, y: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT });
    if (this.pause) {
      list.push(...this.drawFade(), ...onPhone(this.pause.draw()));
      return list;
    }
    list.push(...this.drawHud());
    if (this.verbs) {
      const { sheet, animation } = this.verbArt();
      list.push({
        sheet,
        animation,
        frame: this.data.kind === 'keypad' ? this.verbs.selected : 0,
        x: this.verbs.x,
        y: this.verbs.y,
      });
    }
    if (this.inventory.isOpen) list.push(...onPhone(this.inventory.draw()));
    list.push(...onPhone(this.drawBox()));
    return list;
  }

  drawWorld(shifted) {
    const list = [];
    const { fight, puzzle } = this;
    if (puzzle) {
      if (puzzle.background() === 'corridor') list.push(...shifted(this.scene()));
      else list.push({ fill: '#000000', x: 0, y: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT });
      list.push(...shifted(onPhone(puzzle.draw())));
      return list;
    }
    if (fight?.intro) {
      if (fight.intro.dark) return [{ fill: '#000000', x: 0, y: 0, width: SCENE_WIDTH, height: SCENE_HEIGHT }];
      if (fight.intro.showMonster) return onPhone([fight.monsterSprite()]);
      return shifted(this.scene());
    }
    list.push(...shifted(this.scene()));
    if (fight) list.push(...shifted(onPhone(fight.sprites())));
    if (this.bloodOverlay) {
      const { sheet, playing } = this.bloodOverlay;
      list.push({ sheet, animation: playing.animation, frame: playing.frame, x: SCREEN_X, y: 0 });
    }
    return list;
  }

  // Health and weapon, as in GameMidlet.S(). They stay at the corners of the whole scene.
  drawHud() {
    if (this.mode === MODE.PUZZLE || this.gameOver) return [];
    const { hud } = this.data.hardCoded;
    const list = [];
    const level = [hud.fine, hud.hurt, hud.dying][this.healthLevel];
    if (level) list.push({ sheet: level.sheet, animation: level.animation, x: 5, y: 1 });
    if (this.damageFlash.frame !== 0) {
      list.push({
        sheet: hud.damage.sheet,
        animation: hud.damage.animation,
        frame: this.damageFlash.frame,
        x: 5,
        y: 1,
      });
    }
    if (this.healFlash.frame !== 0) {
      list.push({ sheet: hud.healed.sheet, animation: hud.healed.animation, frame: this.healFlash.frame, x: 5, y: 1 });
    }
    const font = 1;
    const fineWidth = this.data.moduleSize(hud.fine.sheet, 0).width;
    const weaponHeight = this.data.moduleSize(hud.weaponSheet, 0).height;
    const textY = 9 + (weaponHeight >> 1) - (this.data.fonts[font].lineHeight >> 1);
    list.push({ text: `${this.health}%`, font, x: 5 + fineWidth + 10, y: textY });
    const { weapon, loaded } = this;
    if (loaded[weapon] >= 0 || weapon === 0) {
      if (this.reloading) {
        list.push({ text: this.lines[TEXT.RELOADING], font, x: SCENE_WIDTH - 2, y: textY, align: 'right' });
        return list;
      }
      const animations = [hud.melee, hud.pistol, hud.shotgun];
      const animation = animations[weapon];
      const { width } = animationSize(this.data.sheet(hud.weaponSheet), this.data.animation(animation));
      const x = SCENE_WIDTH - width - 5;
      list.push({ sheet: hud.weaponSheet, animation, x, y: weapon === 0 ? 9 : 11 });
      if (weapon !== 0) list.push({ text: String(loaded[weapon]), font, x, y: textY, align: 'right' });
    }
    return list;
  }

  drawBox() {
    return this.box ? [{ box: this.box }] : [];
  }

  // The cursor and its words, as the keypad builds draw them in GameMidlet.R().
  drawCursor() {
    if (this.frontEnd?.stage === 'logo') return [];
    const [sheet, animation] = this.tables.cursorSprites[0];
    const covered = this.frontEnd || this.pause || this.map || this.box || this.verbs || this.inventory.isOpen;
    const frame = covered ? CURSOR.NORMAL : this.cursorFrame();
    const { width, height } = this.cursorSize(sheet, animation, frame);
    const centered = frame === CURSOR.AIM_ON || frame === CURSOR.AIM_OFF;
    const x = centered ? this.cursorX - (width >> 1) : this.cursorX;
    const y = centered ? this.cursorY - (height >> 1) : this.cursorY;
    const list = [{ sheet, animation, frame, x, y }];
    if (frame > 1 && !centered) {
      const text = this.lines[this.tables.cursorLabels[frame]];
      if (text?.trim()) {
        const textY = y >= 20 ? y - 16 : y + height;
        const textX = Math.max(30, Math.min(SCENE_WIDTH - 30, this.cursorX + (width >> 1)));
        list.push({ text, font: 0, x: textX, y: textY, align: 'center' });
      }
    }
    return list;
  }

  cursorSize(sheet, animation, frame) {
    const parsed = this.data.animation(animation);
    return animationSize(this.data.sheet(sheet), { ...parsed, frames: [parsed.frames[frame]] });
  }
}

// What's laid out for the phone's screen, placed in the middle of the scene.
function onPhone(list) {
  return list.map((item) => {
    if (item.box) return { ...item, offsetX: SCREEN_X };
    return { ...item, x: item.x + SCREEN_X };
  });
}

export function createGame(data, options) {
  return new Mobile3Game(data, options);
}
