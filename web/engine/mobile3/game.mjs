import { animationSize } from './data.mjs';
import { fireItemTrigger, fireTrigger, TRIGGER } from './rules.mjs';

// Rooms and corridors are drawn in a scene this size. A phone pans a 240-pixel view over it,
// and the port shows it all, as it does the other games' rooms.
const SCENE_WIDTH = 360;
const SCENE_HEIGHT = 320;
const MILLISECONDS_PER_TICK = 60;
const FADE_TICKS = 5;

const MODE = { ROOM: 0, CORRIDOR: 1 };
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
// Lifts open a menu of floors in the original, which comes with the other menus. Each floor
// has one, which arrives at this cell, also from GameMidlet.F().
export const LIFTS = new Set([210, 217, 224]);
export const LIFT_CELLS = [36, 49, 55];
const NO_DOOR = -1;
const BLOCKED = -2;
const NO_SPRITE = -1;

// Wall pieces, written directly into GameMidlet.u(int) rather than into a table, for the
// normal world and the dark one. Each sheet has a left and a right piece.
const WALL_PIECES = {
  1: {
    far: { sheet: 16777644, left: 16777347, right: 16777523 },
    middleSide: { sheet: 16777646, left: 16777349, right: 16777525 },
    middleEnd: { sheet: 16777665, left: 16777351, right: 16777527 },
    nearSide: { sheet: 16777667, left: 16777353, right: 16777529 },
    nearEnd: { sheet: 16777606, left: 16777341, right: 16777514 },
    closeOpening: { sheet: 16777608, left: 16777353, right: 16777529 },
    closeWall: { sheet: 16777789, left: 16777359, right: 16777537 },
  },
  2: {
    far: { sheet: 16777645, left: 16777348, right: 16777524 },
    middleSide: { sheet: 16777647, left: 16777350, right: 16777526 },
    middleEnd: { sheet: 16777666, left: 16777352, right: 16777528 },
    nearSide: { sheet: 16777668, left: 16777354, right: 16777530 },
    nearEnd: { sheet: 16777607, left: 16777342, right: 16777515 },
    closeOpening: { sheet: 16777609, left: 16777354, right: 16777530 },
    closeWall: { sheet: 16777790, left: 16777360, right: 16777538 },
  },
};

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
};

const SOUND = { whisper: 'whisper', fridge: 'fridge', door: 'door_opening' };

export const VERB = { LOOK: 0, USE: 1, INVENTORY: 2 };

export class Mobile3Game {
  static PANEL_ART = null;
  static PANEL_ART_IS_STRIP = true;
  static ITEM_ICONS = {};

  constructor(data, { audio = null, now = () => 0, onQuit = () => {} } = {}) {
    this.data = data;
    this.tables = data.tables;
    this.dataDir = data.dataDir;
    this.audio = audio;
    this.now = now;
    this.onQuit = onQuit;
    this.frameWidth = SCENE_WIDTH;
    this.frameHeight = SCENE_HEIGHT;
    this.viewOffsetX = 0;
    this.viewOffsetY = 0;
    this.cursorX = SCENE_WIDTH / 2;
    this.cursorY = SCENE_HEIGHT / 2;
    this.language = 'en';
    this.lines = data.text(data.languages[0]);

    // The page's other games have these, and it looks at them.
    this.mainMenu = null;
    this.popups = [];
    this.menus = [];
    this.pointerLocked = false;
    this.wantsMouseLock = false;
    this.stroke = null;

    this.startNewGame();
  }

  // State as GameMidlet.v() sets it up.
  startNewGame() {
    const { objectStates, chapterStates } = this.tables;
    this.time = 0;
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
    this.health = 100;
    this.bullets = [0, 0, 0];
    this.flagL = false;
    this.flagM = false;
    this.verbs = null;
    this.textQueue = [];
    this.fade = null;
    this.notPorted = null;
    this.placeInCorridor(30, FACING.NORTH);
    this.enterRoom(0);
    this.showDialogue(4);
  }

  showStartup() {
    // Menus aren't ported yet, so this goes straight to a new game.
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

  // GameMidlet.z() and A() together come to the same test as the view's.
  canWalkForward() {
    return this.canSeeAhead(this.row, this.column);
  }

  // The wall pieces in view, in drawing order, as in GameMidlet.E().
  corridorPieces() {
    const { facing, row, column } = this;
    const pieces = WALL_PIECES[this.world];
    const positions = this.tables.corridorLayerPositions;
    const [stepRow, stepColumn] = STEP[facing];
    const toLeft = left(facing);
    const toRight = right(facing);
    const list = [];
    const add = (set, side, place) => {
      const [x, y] = positions[place];
      list.push({ sheet: set.sheet, animation: set[side], x, y });
    };

    let wallLeft = false;
    let wallRight = false;
    const openings = [];
    const look = (distance, onLeft, onRight) => {
      const r = row + stepRow * distance;
      const c = column + stepColumn * distance;
      if (this.canSeeSide(r, c, toLeft)) openings.push(onLeft);
      else wallLeft = true;
      if (this.canSeeSide(r, c, toRight)) openings.push(onRight);
      else wallRight = true;
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

    if (wallLeft) add(pieces.closeWall, 'left', PLACE.closeWallLeft);
    if (wallRight) add(pieces.closeWall, 'right', PLACE.closeWallRight);
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
      const [x, y, x0, x1, y0, y1] = this.tables.doorPlaces[place];
      if (sheet !== NO_SPRITE) sprites.push({ sheet, animation, x, y });
      if (door !== NO_DOOR && door !== BLOCKED) hotspots.push({ kind: 'door', id: door, x0, x1, y0, y1 });
    };
    const addProp = (id, place) => {
      if (id >= 159 && id <= 165 && this.chapter !== 3) return;
      const index = Math.floor((id - 145) / 7);
      if (this.propTaken[index]) return;
      const [sheet, animation] = this.tables.propSprites[id - 145];
      const [x, y, x0, x1, y0, y1] = this.tables.propPlaces[index][place];
      if (sheet !== NO_SPRITE) sprites.push({ sheet, animation, x, y });
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

  // What to draw this frame.
  scene() {
    if (this.mode === MODE.ROOM) return this.roomSprites();
    return [...this.corridorPieces(), ...this.corridorFixtures().sprites];
  }

  hotspots() {
    return this.mode === MODE.ROOM ? this.roomHotspots() : this.corridorFixtures().hotspots;
  }

  // The last one listed wins, as the original searches from the end.
  hotspotAt(x, y) {
    return this.hotspots().findLast((spot) => x >= spot.x0 && x <= spot.x1 && y >= spot.y0 && y <= spot.y1) ?? null;
  }

  // What a click at the cursor would do, which also picks the cursor's shape.
  action(x = this.cursorX, y = this.cursorY) {
    const hotspot = this.hotspotAt(x, y);
    if (this.mode === MODE.ROOM) {
      if (hotspot) return { kind: 'verbs', hotspot };
      if (y >= SCENE_HEIGHT - LEAVE_ZONE) return { kind: 'leave' };
      return null;
    }
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

  // After the screen has gone black, as GameMidlet's aB() and d() arrange.
  fadeThen(atBlack) {
    if (!this.fade) this.fade = { ticks: 0, atBlack };
  }

  walkForward() {
    const [stepRow, stepColumn] = STEP[this.facing];
    const cell = this.grid[this.row + stepRow]?.[this.column + stepColumn];
    this.fadeThen(() => this.placeInCorridor(cell, this.facing));
  }

  turnTo(facing) {
    this.fadeThen(() => {
      this.facing = facing;
    });
  }

  takeStairs(door) {
    const { floor, cell, facing } = STAIRS[door];
    this.fadeThen(() => {
      this.floor = floor;
      this.placeInCorridor(cell, facing);
    });
  }

  enterRoom(room) {
    this.room = room;
    this.mode = MODE.ROOM;
    if (room === 10) this.audio?.play(SOUND.fridge, -1);
    if (this.hasMonster(room)) this.audio?.play(SOUND.whisper, -1);
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

  leaveRoom() {
    const { room } = this;
    const fight = this.hasMonster(room);
    if (Math.random() < 0.5 && !fight && room !== 10) this.audio?.play(SOUND.door, 1);
    this.fadeThen(() => {
      if (fight) this.markNotPorted('A fight would start here');
      this.mode = MODE.CORRIDOR;
      this.facing = behind(this.facing);
      this.fire(TRIGGER.LEFT_ROOM, room);
    });
  }

  // Opening a door, as i.c(int, int).
  useDoor(door) {
    if (door in STAIRS) {
      this.takeStairs(door);
      return;
    }
    if (LIFTS.has(door)) {
      this.markNotPorted('The lift');
      return;
    }
    const [stepRow, stepColumn] = STEP[this.facing];
    const room = this.grid[this.row + stepRow]?.[this.column + stepColumn];
    if (room === undefined || room < 0) return;
    const state = this.doorStates[room]?.[this.chapter - 1];
    if (state === 1) {
      this.fadeThen(() => {
        this.enterRoom(room);
        this.fire(TRIGGER.ENTERED_ROOM, room);
      });
      return;
    }
    if (state === 3) this.showText(TEXT.DOOR_BARRED);
    if (!this.fire(TRIGGER.DOOR, door)) this.showText(TEXT.DOOR_LOCKED);
  }

  lookAt(hotspot) {
    if (hotspot.kind === 'door') {
      this.showText(TEXT.DOOR_LOOK);
      return;
    }
    if (hotspot.kind === 'prop') {
      const index = Math.floor((hotspot.id - 145) / 7);
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
      if (!this.fire(TRIGGER.USE_OBJECT, hotspot.id)) {
        this.showText(this.tables.propRefusals[Math.floor((hotspot.id - 145) / 7)]);
      }
      return;
    }
    const { id } = hotspot;
    if (this.tables.objectStates[id][2] === 0) {
      this.addItem(id);
      this.objectTaken[id] = true;
      this.showLine(`${this.lines[TEXT.TOOK]}${this.lines[this.tables.objectNames[id]]}`);
      return;
    }
    if (!this.fire(TRIGGER.USE_OBJECT, id)) this.showText(this.tables.objectTakeRefusals[id]);
  }

  // Kept sorted, as d.a(int) keeps it.
  addItem(item) {
    if (this.items.includes(item) && (item === 72 || item === 73)) return;
    this.items.push(item);
    this.items.sort((a, b) => a - b);
  }

  fire(kind, id) {
    return fireTrigger(this.tables, this, kind, id, (actions) => this.runActions(actions));
  }

  fireWithItem(target, item) {
    return fireItemTrigger(this.tables, this, target, item, (actions) => this.runActions(actions));
  }

  // As GameMidlet.t(int). What isn't ported yet says so, rather than doing nothing.
  runActions(actions) {
    for (const [kind, first, second] of actions) {
      switch (kind) {
        case 0:
          this.showText(first);
          break;
        case 1:
        case 13:
          this.showDialogue(first);
          break;
        case 2:
          this.objectValue[first] = second;
          break;
        case 3:
          this.objectHidden[first] = second;
          break;
        case 5:
          this.enterRoom(first);
          break;
        case 7:
          this.addItem(first);
          this.objectTaken[first] = true;
          this.showLine(`${this.lines[TEXT.TOOK]}${this.lines[this.tables.objectNames[first]]}`);
          break;
        case 8:
          this.items = this.items.filter((item) => item !== first);
          break;
        case 14:
          this.bullets[first] += second;
          break;
        case 15: {
          // The higher numbers are the same doors' views from further away.
          let door = first;
          if (Math.floor(door / 7) > 20) door -= 21;
          else if (Math.floor(door / 7) > 13) door -= 7;
          this.doorStates[Math.floor(door / 7)][this.chapter - 1] = 1;
          break;
        }
        case 17:
          this.health = first;
          break;
        case 6:
        case 9:
        case 12:
        case 16:
        case 18:
        case 20:
        case 21:
          break;
        case 4:
          this.markNotPorted(`Puzzle ${first}`);
          break;
        case 10:
          this.markNotPorted(`Chapter ${first + 1}`);
          break;
        case 11:
          this.world = this.world === 1 ? 2 : 1;
          break;
        case 19:
          this.markNotPorted('The ending');
          break;
        default:
          this.markNotPorted(`Rule action ${kind}`);
      }
    }
  }

  markNotPorted(what) {
    this.notPorted = `Not ported yet: ${what}`;
  }

  // Text in a box, one page at a time.
  showText(line) {
    this.showLine(this.lines[line]);
  }

  showLine(text) {
    this.textQueue.push({ text });
  }

  showDialogue(number) {
    for (const [speaker, line] of this.tables.dialogues[number] ?? []) {
      this.textQueue.push({ speaker: this.lines[speaker], text: this.lines[line] });
    }
  }

  get currentText() {
    return this.textQueue[0] ?? null;
  }

  // Centered on the cursor and kept on the screen, as in GameMidlet.h(int).
  openVerbs(hotspot) {
    const [sheet, animation] = this.tables.cursorSprites[1];
    const { width, height } = animationSize(this.data.sheet(sheet), this.data.animation(animation));
    const x = Math.max(0, Math.min(SCENE_WIDTH - width, Math.round(this.cursorX - width / 2)));
    const y = Math.max(0, Math.min(SCENE_HEIGHT - height, Math.round(this.cursorY - height / 2)));
    this.verbs = { hotspot, x, y };
  }

  verbAt(px, py) {
    if (!this.verbs) return null;
    const { x, y } = this.verbs;
    return (
      VERB_WHEEL.arms.find(
        ({ dx, dy }) => px >= x + dx && px < x + dx + VERB_WHEEL.size && py >= y + dy && py < y + dy + VERB_WHEEL.size,
      )?.verb ?? null
    );
  }

  chooseVerb(verb) {
    const { hotspot } = this.verbs;
    this.verbs = null;
    if (verb === VERB.LOOK) this.lookAt(hotspot);
    else if (verb === VERB.USE) this.useOn(hotspot);
    else this.markNotPorted('The inventory');
  }

  isBusy() {
    return Boolean(this.fade);
  }

  // The page's methods.
  tick() {
    this.time += MILLISECONDS_PER_TICK;
    if (this.fade && ++this.fade.ticks === FADE_TICKS) {
      this.fade.atBlack();
      this.fade.atBlack = null;
    } else if (this.fade && this.fade.ticks >= FADE_TICKS * 2) {
      this.fade = null;
    }
  }

  // How dark the fade makes the screen, from 0 to 1.
  get fadeLevel() {
    if (!this.fade) return 0;
    const { ticks } = this.fade;
    return ticks <= FADE_TICKS ? ticks / FADE_TICKS : 2 - ticks / FADE_TICKS;
  }

  moveCursor(x, y) {
    this.cursorX = Math.max(0, Math.min(SCENE_WIDTH - 1, x));
    this.cursorY = Math.max(0, Math.min(SCENE_HEIGHT - 1, y));
  }

  click() {
    this.notPorted = null;
    if (this.isBusy()) return;
    if (this.currentText) {
      this.textQueue.shift();
      return;
    }
    if (this.verbs) {
      const verb = this.verbAt(this.cursorX, this.cursorY);
      if (verb === null) this.verbs = null;
      else this.chooseVerb(verb);
      return;
    }
    const action = this.action();
    if (!action) return;
    this.doAction(action);
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

  pressKey(key) {
    this.notPorted = null;
    if (this.isBusy()) return;
    if (key === 'Enter') {
      this.click();
      return;
    }
    if (key === 'Escape') {
      if (this.currentText) this.textQueue.shift();
      else this.verbs = null;
      return;
    }
    if (this.currentText || this.verbs) return;
    if (key === 'inventory') this.markNotPorted('The inventory');
    else if (key === 'move-forward') {
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

  pressSoftKey(side) {
    if (side === 'right') this.pressKey('Escape');
  }

  softKeys() {
    return { left: null, right: this.currentText || this.verbs ? { label: 'Back' } : null };
  }

  holdDirection() {}
  releaseDirections() {}
  isAiming() {
    return false;
  }
  aimWithMouse() {}
  movePointerBy() {}
  wantsStroke() {
    return false;
  }
  startStroke() {}
  continueStroke() {}
  endStroke() {}
  itemIcons() {
    return null;
  }
  canSave() {
    return false;
  }
  hasSave() {
    return false;
  }
  saveGame() {}
  loadGame() {}
}

// Where the verb wheel's arms can be clicked, from GameMidlet.R() and the touch handling in
// a(int, int, int, int, int), relative to its top left.
export const VERB_WHEEL = {
  size: 30,
  arms: [
    { verb: VERB.USE, dx: 5, dy: 10 },
    { verb: VERB.LOOK, dx: 37, dy: 20 },
    { verb: VERB.INVENTORY, dx: 74, dy: 36 },
  ],
};

export function createGame(data, options) {
  return new Mobile3Game(data, options);
}
