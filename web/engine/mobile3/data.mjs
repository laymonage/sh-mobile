import { readStaticTables } from './class-tables.mjs';
import { BUILD_RESOURCES } from './resources.mjs';

// audio.mjs finds a game's sounds in data.entries, under this path.
export const SOUND_PATH = 'sh3/sfx/mid';
const TEXT_LIST = 'TRAD.lang';

// Each by class and field, with its type. The obfuscator gives fields of different types the
// same name, so the type is part of what tells them apart.
const TABLES = {
  objectNames: 'a.a:[S',
  objectLooks: 'a.b:[[S',
  objectLooksDark: 'a.d:[[S',
  objectLookConditions: 'a.a:[[S',
  objectLookConditionsDark: 'a.c:[[S',
  objectTakeRefusals: 'a.b:[S',
  propLooks: 'a.d:[S',
  propLooksDark: 'a.e:[S',
  propRefusals: 'a.c:[S',
  objectStates: 'a.a:[[B',
  chapterStates: 'a.b:[[B',
  propSprites: 'a.a:[[I',
  objectSprites: 'a.b:[[I',
  corridorDoorSprites: 'a.c:[[I',
  roomLayers: 'b.a:[[I',
  roomLayersDark: 'b.b:[[I',
  roomLayerPositions: 'b.a:[[S',
  roomLayerPositionsDark: 'b.b:[[S',
  roomObjects: 'b.a:[[[S',
  roomEncounters: 'b.a:[[B',
  ruleCounts: 'GameMidlet.b:[[B',
  rules: 'GameMidlet.a:[[[S',
  firstFloor: 'GameMidlet.c:[[B',
  secondFloor: 'GameMidlet.d:[[B',
  thirdFloor: 'GameMidlet.e:[[B',
  corridorLayerPositions: 'GameMidlet.b:[[S',
  corridorDoors: 'GameMidlet.a:[[S',
  corridorProps: 'GameMidlet.c:[[S',
  doorPlaces: 'GameMidlet.d:[[S',
  propPlaces: 'GameMidlet.b:[[[S',
  dialogues: 'GameMidlet.a:[[[I',
  cursorSprites: 'GameMidlet.c:[[I',
  archiveNames: 'e.a:[Ljava/lang/String;',
  looseFiles: 'e.b:[Ljava/lang/String;',
  languageNames: 'GameMidlet.a:[Ljava/lang/String;',
  logos: 'GameMidlet.b:[[I',
  frontArt: 'GameMidlet.a:[[I',
  mainMenuLines: 'GameMidlet.e:[I',
  settingLabels: 'GameMidlet.i:[I',
  helpLines: 'GameMidlet.j:[I',
  playLines: 'GameMidlet.k:[I',
  onOffLines: 'GameMidlet.l:[I',
  cursorLabels: 'GameMidlet.c:[S',
  softKeyLines: 'GameMidlet.h:[I',
  inventoryIcons: 'GameMidlet.a:[I',
  phoneCode: 'GameMidlet.aa:[I',
  weaponDamage: 'GameMidlet.o:[I',
  reloadTime: 'GameMidlet.p:[I',
  monsterAttackGap: 'GameMidlet.q:[I',
  monsterSheets: 'GameMidlet.r:[I',
  aimDrift: 'GameMidlet.s:[I',
  monster1HitX: 'GameMidlet.t:[I',
  monster1HitY: 'GameMidlet.u:[I',
  monster1Animations: 'GameMidlet.v:[I',
  monster2Odds: 'GameMidlet.w:[I',
  monster2HitLeft: 'GameMidlet.x:[I',
  monster2HitTop: 'GameMidlet.y:[I',
  monster2HitWidth: 'GameMidlet.z:[I',
  monster2HitHeight: 'GameMidlet.A:[I',
  monster2Animations: 'GameMidlet.D:[I',
  monster3Extras: 'GameMidlet.E:[I',
  monster3Animations: 'GameMidlet.F:[I',
  monster3HitLeft: 'GameMidlet.G:[I',
  monster3HitTop: 'GameMidlet.H:[I',
  monster3HitWidth: 'GameMidlet.I:[I',
  monster3HitHeight: 'GameMidlet.J:[I',
  monster4Animations: 'GameMidlet.K:[I',
  monster4HitLeft: 'GameMidlet.L:[I',
  monster4HitTop: 'GameMidlet.M:[I',
  monster4HitWidth: 'GameMidlet.N:[I',
  monster4HitHeight: 'GameMidlet.O:[I',
  firstFloorMap: 'GameMidlet.g:[[B',
  secondFloorMap: 'GameMidlet.h:[[B',
  thirdFloorMap: 'GameMidlet.i:[[B',
};

// The same tables, under the names each kind of build gives them.
const BUILD_TABLES = {
  touch: {
    monsterArmor: 'GameMidlet.e:[[I',
    boxSprites: 'GameMidlet.n:[[I',
    puzzleSheets: 'GameMidlet.ac:[I',
    puzzleLines: 'GameMidlet.ad:[I',
    mapAnimations: 'GameMidlet.aw:[I',
    fonts: 'GameMidlet.aC:[I',
    yesNoLines: 'GameMidlet.aq:[I',
  },
  keypad: {
    monsterArmor: 'GameMidlet.f:[[I',
    boxSprites: 'GameMidlet.o:[[I',
    puzzleSheets: 'GameMidlet.ab:[I',
    puzzleLines: 'GameMidlet.ac:[I',
    mapAnimations: 'GameMidlet.ar:[I',
    fonts: 'GameMidlet.av:[I',
    yesNoLines: 'GameMidlet.al:[I',
  },
};

// A build is one of the two kinds this port follows if its first room's first layer and its
// cursor's art are numbered as that kind's are. Others can't use the numbers in resources.mjs.
const BUILD_CURSORS = { touch: 16777614, keypad: 16777597 };

function parseArchive(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const indexLength = view.getUint32(4);
  const count = view.getUint32(8);
  const base = 12 + indexLength;
  return Array.from({ length: count }, (_, i) => {
    const length = view.getUint32(12 + i * 8);
    const offset = view.getUint32(16 + i * 8);
    return bytes.subarray(base + offset, base + offset + length);
  });
}

class Reader {
  constructor(bytes) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.p = 0;
  }
  u8() {
    return this.bytes[this.p++];
  }
  i8() {
    return (this.bytes[this.p++] << 24) >> 24;
  }
  u16() {
    this.p += 2;
    return this.view.getUint16(this.p - 2);
  }
  i16() {
    this.p += 2;
    return this.view.getInt16(this.p - 2);
  }
  i32() {
    this.p += 4;
    return this.view.getInt32(this.p - 4);
  }
  utf() {
    const length = this.u16();
    this.p += length;
    return new TextDecoder().decode(this.bytes.subarray(this.p - length, this.p));
  }
  // A resource number, stored in as few bytes as it can be. As in l.a(DataInputStream).
  resource() {
    const size = this.u8();
    if (size === 1) {
      const value = this.u8();
      return ((value & 192) << 18) | (value & 63);
    }
    if (size === 2) {
      const value = this.u16();
      return ((value & 61440) << 12) | (value & 4095);
    }
    if (size === 4) return this.i32();
    return -1;
  }
}

// As the class c's table, which a sheet's transform numbers index.
const TRANSFORMS_ON_SIDE = [0, 1, 0, 1, 0, 1, 0, 1];

// A sprite sheet: an image, its rectangles, and modules that each draw one rectangle with one
// of the eight transforms. As in l.a(int, boolean) and the class c.
export function parseSheet(bytes) {
  const reader = new Reader(bytes);
  const image = reader.resource();
  const rectangles = Array.from({ length: reader.u8() }, () => {
    const x = reader.u16();
    const y = reader.u16();
    const width = reader.u16();
    const height = reader.u16();
    return { x, y, width, height };
  });
  const modules = Array.from({ length: reader.u8() }, () => {
    const rectangle = reader.u8();
    return { rectangle, transform: reader.u8() };
  });
  return { image, rectangles, modules };
}

// An animation: frames that each last a time and draw some modules. As in k.a(int, int).
export function parseAnimation(bytes) {
  const reader = new Reader(bytes);
  const flags = reader.u8();
  const frameCount = reader.u8();
  reader.u8();
  let total = 0;
  const frames = Array.from({ length: frameCount }, () => {
    const duration = reader.i16();
    const parts = Array.from({ length: reader.u8() }, () => {
      const module = reader.u8();
      const x = reader.i16();
      return { module, x, y: reader.i16() };
    });
    const frame = { start: total, duration, parts };
    total += duration;
    return frame;
  });
  return { flags, frames, duration: total };
}

// Which frame a looping animation shows at a time in milliseconds.
export function frameAt(animation, time) {
  const { frames, duration } = animation;
  if (duration <= 0 || frames.length < 2) return frames[0];
  const moment = time % duration;
  return frames.findLast((frame) => frame.start <= moment) ?? frames[0];
}

// An animation being played, as the class k's packed numbers track one. It either loops,
// or plays once and stops.
export const LOOP = 1;
export const ONCE = 0;
export class Playing {
  constructor(animation, mode) {
    this.animation = animation;
    this.mode = mode;
    this.restart();
  }

  restart(frame = 0) {
    this.frame = frame;
    this.time = frame === 0 ? 0 : this.animation.frames[frame - 1].start + this.animation.frames[frame - 1].duration;
    this.running = true;
  }

  advance(milliseconds) {
    const { frames, duration } = this.animation;
    if (this.running) this.time += milliseconds;
    if (this.mode === ONCE) {
      if (this.time >= duration || this.time <= 0) this.running = false;
    } else if (this.time >= duration) {
      this.time -= duration;
      this.frame = 0;
    }
    if (this.running) {
      while (this.frame < frames.length - 1 && this.time >= frames[this.frame].start + frames[this.frame].duration) {
        this.frame++;
      }
    }
  }
}

function moduleSize(sheet, index) {
  const module = sheet.modules[index];
  const rectangle = sheet.rectangles[module.rectangle];
  // These transforms turn a rectangle on its side.
  const sideways = (TRANSFORMS_ON_SIDE[module.transform] ?? 0) !== 0;
  return sideways
    ? { width: rectangle.height, height: rectangle.width }
    : { width: rectangle.width, height: rectangle.height };
}

// An animation's bounds over all of its frames, as in k.a(c, int, int[], int).
export function animationSize(sheet, animation) {
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  for (const frame of animation.frames) {
    for (const part of frame.parts) {
      const { width, height } = moduleSize(sheet, part.module);
      left = Math.min(left, -part.x);
      top = Math.min(top, -part.y);
      right = Math.max(right, width - part.x);
      bottom = Math.max(bottom, height - part.y);
    }
  }
  return { width: right - left, height: bottom - top };
}

// A bitmap font: glyphs that are a sheet's modules, as in GameMidlet.D(int).
export function parseFont(bytes) {
  const reader = new Reader(bytes);
  const sheet = reader.resource();
  const lineHeight = reader.u8();
  const baseline = reader.u8();
  const spacing = reader.u8();
  const glyphs = new Map();
  for (let remaining = reader.u8(); remaining > 0; remaining--) {
    const character = reader.u16();
    const module = reader.u8();
    glyphs.set(character, { module, offset: reader.i8() });
  }
  return { sheet, lineHeight, baseline, spacing, glyphs };
}

// A language file: offsets the game doesn't use, then every line.
export function parseLanguage(bytes) {
  const reader = new Reader(bytes);
  const skip = reader.i32();
  const count = reader.i32();
  reader.p += skip;
  return Array.from({ length: count }, () => reader.utf());
}

function readAllTables(files) {
  const tables = new Map();
  for (const [name, bytes] of files) {
    if (!name.endsWith('.class') || name.includes('/')) continue;
    const { name: className, fields } = readStaticTables(bytes);
    for (const [field, value] of fields) {
      if (Array.isArray(value)) tables.set(`${className}.${field}`, value);
    }
  }
  return tables;
}

// Whether these files look like Mobile 3, whatever the build.
export function isMobile3(files) {
  return files.has('b.mbf');
}

// Which kind of build these tables are from, or null if it's neither that the port follows.
function buildKind(all) {
  for (const [kind, cursor] of Object.entries(BUILD_CURSORS)) {
    if (
      all.get('b.a:[[I')?.[0]?.[0] === BUILD_RESOURCES[kind].firstRoomLayer &&
      all.get('GameMidlet.c:[[I')?.[0]?.[0] === cursor &&
      all.get(BUILD_TABLES[kind].fonts)
    ) {
      return kind;
    }
  }
  return null;
}

// All of a build's data, or null if the build isn't one the port follows.
export function loadMobile3(files) {
  const all = readAllTables(files);
  const kind = buildKind(all);
  if (!kind) return null;
  const tables = {};
  for (const [name, key] of Object.entries({ ...TABLES, ...BUILD_TABLES[kind] })) {
    const table = all.get(key);
    if (!table) return null;
    tables[name] = table;
  }
  if (tables.rules.length !== 78) return null;
  const hardCoded = BUILD_RESOURCES[kind];

  // Resource numbers name an archive in the top byte and an entry below it. The first
  // archive is the JAR's own files, listed by number in the class e.
  const archives = tables.archiveNames.map((name) => (name === '/' ? null : parseArchive(files.get(name))));
  const resource = (id) => {
    const archive = archives[id >>> 24];
    const entry = id & 0xffffff;
    return archive ? archive[entry] : files.get(tables.looseFiles[entry]);
  };

  const list = new Reader(resource(tables.looseFiles.indexOf(TEXT_LIST)));
  const languages = [];
  for (let remaining = list.u8(); remaining > 0; remaining--) {
    const name = list.utf();
    languages.push({ name, resource: list.resource() });
  }

  const entries = new Map();
  for (const name of tables.looseFiles) {
    if (name?.endsWith('.mid')) entries.set(`${SOUND_PATH}/${name}`, files.get(name));
  }
  for (const [name, id] of Object.entries(hardCoded.sounds ?? {})) {
    entries.set(`${SOUND_PATH}/${name}.mid`, resource(id));
  }

  const fontIds = [];
  for (let i = 3; i < tables.fonts.length; i += 4) fontIds.push(tables.fonts[i]);
  const fonts = fontIds.map((id) => parseFont(resource(id)));

  const sheets = new Map();
  const animations = new Map();
  const loadSheet = (id) => {
    if (!sheets.has(id)) sheets.set(id, parseSheet(resource(id)));
    return sheets.get(id);
  };
  return {
    dataDir: 'sh3',
    kind,
    files,
    entries,
    tables,
    hardCoded,
    languages,
    fonts,
    resource,
    resourceCount: (archive) => archives[archive].length,
    sheet: loadSheet,
    animation(id) {
      if (!animations.has(id)) animations.set(id, parseAnimation(resource(id)));
      return animations.get(id);
    },
    moduleSize: (sheet, index) => moduleSize(loadSheet(sheet), index),
    text(language) {
      return parseLanguage(resource(language.resource));
    },
  };
}
