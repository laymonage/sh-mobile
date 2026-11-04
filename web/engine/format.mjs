// Parsers for the games' binary formats, shared by the browser port and the Node
// analysis tools, so nothing here can use Node APIs. Formats follow Script,
// ScriptThread, RoomObject and M in the unobfuscated sh1-2014-a7 build.

const utf8 = new TextDecoder('utf-8');
const ascii = (bytes, start, end) => String.fromCharCode(...bytes.subarray(start, end));
const view = (bytes) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

class Reader {
  constructor(bytes) {
    this.bytes = bytes;
    this.view = view(bytes);
    this.p = 0;
  }

  u8() {
    if (this.p >= this.bytes.length) throw new Error('Unexpected end of data');
    return this.bytes[this.p++];
  }

  u16() {
    this.p += 2;
    return this.view.getUint16(this.p - 2);
  }

  s16() {
    this.p += 2;
    return this.view.getInt16(this.p - 2);
  }

  utf() {
    const length = this.u16();
    this.p += length;
    return utf8.decode(this.bytes.subarray(this.p - length, this.p));
  }

  get done() {
    return this.p === this.bytes.length;
  }

  get remaining() {
    return this.bytes.length - this.p;
  }
}

function readStrings(reader) {
  const count = reader.u8();
  return Array.from({ length: count }, () => reader.utf());
}

// chunks/*.bin: u8 count, then { u8 nameLength, name, u16 dataLength, data }.
export function parseChunkArchive(bytes) {
  const reader = new Reader(bytes);
  const entries = new Map();
  const count = reader.u8();
  for (let i = 0; i < count; i++) {
    const nameLength = reader.u8();
    const name = ascii(bytes, reader.p, reader.p + nameLength);
    reader.p += nameLength;
    const dataLength = reader.u16();
    entries.set(name, bytes.subarray(reader.p, reader.p + dataLength));
    reader.p += dataLength;
    if (reader.p > bytes.length) throw new Error(`Chunk entry overruns archive: ${name}`);
  }
  if (!reader.done) throw new Error(`${reader.remaining} trailing bytes in chunk archive`);
  return entries;
}

// M.loadGameLanguage stops reading after the last string, and some files have bytes
// there: a line feed in es.lan of sh1-2007-a4 and a19, stray text in pt.lan of
// sh2-2011-base. Only tools looking for such oddities ask for `strict`.
export function parseLan(bytes, { strict = false } = {}) {
  const reader = new Reader(bytes);
  const count = reader.u16();
  const strings = Array.from({ length: count }, () => reader.utf());
  if (reader.remaining < 0) throw new Error('Language file ends inside a string');
  if (strict && !reader.done) throw new Error(`${reader.remaining} trailing bytes in language file`);
  return strings;
}

export function parseScript(bytes) {
  const reader = new Reader(bytes);
  const strings = readStrings(reader);

  // Five resource lists, stored in this order, that M reads for preloading.
  for (const type of [5, 1, 2, 3, 4]) {
    const count = reader.u8();
    reader.p += count * (type === 3 ? 2 : 1);
  }

  const gfxType = reader.u8();
  let gfxId = null;
  if (gfxType === 1) gfxId = strings[reader.u8() - 1];
  else if (gfxType === 2) gfxId = reader.u16();

  const events = [];
  const eventCount = reader.u8();
  for (let i = 0; i < eventCount; i++) events.push({ id: reader.u8(), offset: reader.u16() });

  const codeLength = reader.u16();
  const code = bytes.subarray(reader.p, reader.p + codeLength);
  reader.p += codeLength;
  if (!reader.done) throw new Error(`${reader.remaining} trailing bytes in script`);
  for (const event of events) {
    if (event.offset >= codeLength) throw new Error(`Event ${event.id} offset is outside the code`);
  }
  return { strings, gfxId, events, code };
}

export const OP_END = 2;
export const OP_INTEGER = 5;
export const OP_STRING = 6;

// Walks the bytecode tree from ScriptThread.executeCommand without running it:
// low 6 bits are the opcode, high 2 bits the argument count (3 = next byte).
export function walkCode(script, visit = () => {}) {
  const { code, strings } = script;
  let p = 0;
  const node = () => {
    if (p >= code.length) throw new Error('Script code ended inside a command');
    const byte = code[p++];
    const op = byte & 63;
    let args = byte >> 6;
    if (args === 3) args = code[p++];
    visit(op, args);
    if (op === OP_INTEGER) {
      p += args === 0 ? 1 : args === 1 ? 2 : 4;
    } else if (op === OP_STRING) {
      const index = code[p++];
      if (index < 1 || index > strings.length) throw new Error(`Bad string index ${index}`);
    } else if (op !== OP_END) {
      for (let i = 0; i < args; i++) node();
    }
  };
  while (p < code.length) node();
  if (p !== code.length) throw new Error('Script code overran its length');
}

export const ROOM_OBJECT_GFX = 1;
export const ROOM_OBJECT_ZONE = 2;
export const ROOM_OBJECT_ZONE_BATTLE = 3;
export const ROOM_OBJECT_ZONE_COLOR = 4;
export const ROOM_OBJECT_ZONE_TEXT = 5;
export const ROOM_OBJECT_ZONE_TILES = 6;

// The only known room format difference between the games: Silent Hill Mobile 2,
// whose data folder is "a", stores zone sizes in 16 bits rather than 8.
export function usesWideZones(dataDir) {
  return dataDir === 'a';
}

export function parseRoom(bytes, { wideZones = false } = {}) {
  const reader = new Reader(bytes);
  const strings = readStrings(reader);
  const string = (index) => (index ? strings[index - 1] : null);

  const scripts = Array.from({ length: reader.u8() }, () => string(reader.u8()));
  const gfx = Array.from({ length: reader.u8() }, () => {
    const id = string(reader.u8());
    return { id, transform: reader.u8() };
  });
  const integerGfx = Array.from({ length: reader.u8() }, () => {
    const id = reader.u16();
    return { id, transform: reader.u8() };
  });

  const objects = Array.from({ length: reader.u8() }, () => {
    const object = { type: reader.u8(), x: 0, y: 0 };
    if (object.type === ROOM_OBJECT_GFX) {
      object.x = reader.s16();
      object.y = reader.s16();
      object.transform = reader.u8();
      const gfxIdType = reader.u8();
      if (gfxIdType === 1) object.gfxId = string(reader.u8());
      else if (gfxIdType === 2) object.gfxId = reader.u16();
    } else if (object.type >= 2 && object.type <= 6) {
      object.x = reader.s16();
      object.y = reader.s16();
      object.width = wideZones ? reader.u16() : reader.u8();
      object.height = wideZones ? reader.u16() : reader.u8();
    }
    object.scriptId = string(reader.u8());
    return object;
  });

  if (!reader.done) throw new Error(`${reader.remaining} trailing bytes in room`);
  return { strings, scripts, gfx, integerGfx, objects };
}

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export function* pngChunks(bytes) {
  const data = view(bytes);
  let p = 8;
  while (p < bytes.length) {
    const length = data.getUint32(p);
    yield { type: ascii(bytes, p + 4, p + 8), data: bytes.subarray(p + 8, p + 8 + length) };
    p += 12 + length;
  }
}

export function pngInfo(bytes) {
  if (!PNG_SIGNATURE.every((byte, i) => bytes[i] === byte)) throw new Error('Not a PNG');
  const data = view(bytes);
  const info = {
    width: data.getUint32(16),
    height: data.getUint32(20),
    depth: bytes[24],
    colorType: bytes[25],
    regX: 0,
    regY: 0,
    hasRegPoint: false,
  };
  for (const chunk of pngChunks(bytes)) {
    if (chunk.type === 'oFFs') {
      const offsets = view(chunk.data);
      info.regX = offsets.getInt32(0);
      info.regY = offsets.getInt32(4);
      info.hasRegPoint = true;
    }
  }
  return info;
}

// The eight sprite transforms from MyCanvas.transformTable. `pixel` maps a source
// pixel, `matrix` is the same mapping for a canvas, and placement follows M.getLeft
// and M.getTop.
export const TRANSFORMS = [
  {
    swap: false,
    pixel: (x, y) => [x, y],
    matrix: () => [1, 0, 0, 1, 0, 0],
    left: (w, h, rx) => rx,
    top: (w, h, rx, ry) => ry,
  },
  {
    swap: false,
    pixel: (x, y, w) => [w - 1 - x, y],
    matrix: (w) => [-1, 0, 0, 1, w, 0],
    left: (w, h, rx) => w - rx,
    top: (w, h, rx, ry) => ry,
  },
  {
    swap: true,
    pixel: (x, y, w, h) => [h - 1 - y, x],
    matrix: (w, h) => [0, 1, -1, 0, h, 0],
    left: (w, h, rx, ry) => h - ry,
    top: (w, h, rx) => rx,
  },
  {
    swap: true,
    pixel: (x, y, w, h) => [h - 1 - y, w - 1 - x],
    matrix: (w, h) => [0, -1, -1, 0, h, w],
    left: (w, h, rx, ry) => h - ry,
    top: (w, h, rx) => w - rx,
  },
  {
    swap: false,
    pixel: (x, y, w, h) => [w - 1 - x, h - 1 - y],
    matrix: (w, h) => [-1, 0, 0, -1, w, h],
    left: (w, h, rx) => w - rx,
    top: (w, h, rx, ry) => h - ry,
  },
  {
    swap: false,
    pixel: (x, y, w, h) => [x, h - 1 - y],
    matrix: (w, h) => [1, 0, 0, -1, 0, h],
    left: (w, h, rx) => rx,
    top: (w, h, rx, ry) => h - ry,
  },
  {
    swap: true,
    pixel: (x, y, w) => [y, w - 1 - x],
    matrix: (w) => [0, -1, 1, 0, 0, w],
    left: (w, h, rx, ry) => ry,
    top: (w, h, rx) => w - rx,
  },
  {
    swap: true,
    pixel: (x, y) => [y, x],
    matrix: () => [0, 1, 1, 0, 0, 0],
    left: (w, h, rx, ry) => ry,
    top: (w, h, rx) => rx,
  },
];
