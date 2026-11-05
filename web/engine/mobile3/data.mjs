import { readStaticTables } from './class-tables.mjs';

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
};

// The first room's first layer. Other families of builds number their resources differently,
// which the numbers written directly into the code can't follow.
const FIRST_ROOM_LAYER = 16777791;

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

// Which frame a looping animation shows at a time in milliseconds. The class k also has
// animations that stop or bounce, which only fights and puzzles use.
export function frameAt(animation, time) {
  const { frames, duration } = animation;
  if (duration <= 0 || frames.length < 2) return frames[0];
  const moment = time % duration;
  return frames.findLast((frame) => frame.start <= moment) ?? frames[0];
}

// The size of an animation's first frame, as in k.a(int, c, int, int[], int).
export function animationSize(sheet, animation) {
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  for (const part of animation.frames[0].parts) {
    const module = sheet.modules[part.module];
    const rectangle = sheet.rectangles[module.rectangle];
    // These transforms turn a rectangle on its side.
    const sideways = (TRANSFORMS_ON_SIDE[module.transform] ?? 0) !== 0;
    const width = sideways ? rectangle.height : rectangle.width;
    const height = sideways ? rectangle.width : rectangle.height;
    left = Math.min(left, -part.x);
    top = Math.min(top, -part.y);
    right = Math.max(right, width - part.x);
    bottom = Math.max(bottom, height - part.y);
  }
  return { width: right - left, height: bottom - top };
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

// All of a build's data, or null if the build isn't one the port follows yet.
export function loadMobile3(files) {
  const all = readAllTables(files);
  const tables = {};
  for (const [name, key] of Object.entries(TABLES)) {
    const table = all.get(key);
    if (!table) return null;
    tables[name] = table;
  }
  if (tables.rules.length !== 78 || tables.roomLayers[0]?.[0] !== FIRST_ROOM_LAYER) return null;

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

  const sheets = new Map();
  const animations = new Map();
  return {
    dataDir: 'sh3',
    files,
    entries,
    tables,
    languages,
    resource,
    resourceCount: (archive) => archives[archive].length,
    sheet(id) {
      if (!sheets.has(id)) sheets.set(id, parseSheet(resource(id)));
      return sheets.get(id);
    },
    animation(id) {
      if (!animations.has(id)) animations.set(id, parseAnimation(resource(id)));
      return animations.get(id);
    },
    text(language) {
      return parseLanguage(resource(language.resource));
    },
  };
}
