import { Zip } from './zip.mjs';

// Parsers for Daydream's INK engine data. Formats follow Script, ScriptThread,
// RoomObject and M in the unobfuscated a7 build.

class Reader {
  constructor(buffer) {
    this.buffer = buffer;
    this.p = 0;
  }

  u8() {
    if (this.p >= this.buffer.length) throw new Error('Unexpected end of data');
    return this.buffer[this.p++];
  }

  u16() {
    this.p += 2;
    return this.buffer.readUInt16BE(this.p - 2);
  }

  s16() {
    this.p += 2;
    return this.buffer.readInt16BE(this.p - 2);
  }

  utf() {
    const length = this.u16();
    this.p += length;
    return this.buffer.toString('utf8', this.p - length, this.p);
  }

  get done() {
    return this.p === this.buffer.length;
  }

  get remaining() {
    return this.buffer.length - this.p;
  }
}

function readStrings(reader) {
  const count = reader.u8();
  return Array.from({ length: count }, () => reader.utf());
}

// chunks/*.bin: u8 count, then { u8 nameLength, name, u16 dataLength, data }.
export function parseChunkArchive(buffer) {
  const reader = new Reader(buffer);
  const entries = new Map();
  const count = reader.u8();
  for (let i = 0; i < count; i++) {
    const nameLength = reader.u8();
    const name = buffer.toString('latin1', reader.p, reader.p + nameLength);
    reader.p += nameLength;
    const dataLength = reader.u16();
    entries.set(name, buffer.subarray(reader.p, reader.p + dataLength));
    reader.p += dataLength;
    if (reader.p > buffer.length) throw new Error(`Chunk entry overruns archive: ${name}`);
  }
  if (!reader.done) throw new Error(`${reader.remaining} trailing bytes in chunk archive`);
  return entries;
}

export function isInk(zip) {
  return zip.names.some((name) => name.startsWith('chunks/'));
}

// All game data in a JAR, by logical name. Language files sit outside the chunks.
export function loadInkData(jarBuffer) {
  const zip = jarBuffer instanceof Zip ? jarBuffer : new Zip(jarBuffer);
  const entries = new Map();
  for (const name of zip.names) {
    if (name.startsWith('chunks/')) {
      for (const [key, value] of parseChunkArchive(zip.read(name))) entries.set(key, value);
    }
  }
  const dataDir = [...entries.keys()][0].split('/')[0];
  for (const name of zip.names) {
    // Silent Hill Mobile 2 keeps its language files in a top-level lan/ folder.
    if ((name.startsWith(`${dataDir}/`) || name.startsWith('lan/')) && !name.endsWith('.class'))
      entries.set(name, zip.read(name));
  }
  return { dataDir, entries };
}

export function parseLan(buffer) {
  const reader = new Reader(buffer);
  const count = reader.u16();
  const strings = Array.from({ length: count }, () => reader.utf());
  if (!reader.done) throw new Error(`${reader.remaining} trailing bytes in language file`);
  return strings;
}

export function parseScript(buffer) {
  const reader = new Reader(buffer);
  const strings = readStrings(reader);

  // Five resource lists, stored in this order, that M reads for preloading.
  for (const type of [5, 1, 2, 3, 4]) {
    const count = reader.u8();
    reader.p += count * (type === 3 ? 2 : 1);
  }

  const gfxType = reader.u8();
  if (gfxType === 1) reader.u8();
  else if (gfxType === 2) reader.u16();

  const events = [];
  const eventCount = reader.u8();
  for (let i = 0; i < eventCount; i++) events.push({ id: reader.u8(), offset: reader.u16() });

  const codeLength = reader.u16();
  const code = buffer.subarray(reader.p, reader.p + codeLength);
  reader.p += codeLength;
  if (!reader.done) throw new Error(`${reader.remaining} trailing bytes in script`);
  for (const event of events) {
    if (event.offset >= codeLength) throw new Error(`Event ${event.id} offset is outside the code`);
  }
  return { strings, events, code };
}

const OP_END = 2;
const OP_INTEGER = 5;
const OP_STRING = 6;

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

// The only known room format difference between the games: Silent Hill Mobile 2,
// whose data folder is "a", stores zone sizes in 16 bits rather than 8.
export function usesWideZones(dataDir) {
  return dataDir === 'a';
}

export function parseRoom(buffer, { wideZones = false } = {}) {
  const reader = new Reader(buffer);
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

function count(map, key, by = 1) {
  map[key] = (map[key] ?? 0) + by;
}

export function analyzeInkData({ dataDir, entries }) {
  const result = {
    dataDir,
    entryCount: entries.size,
    scripts: { total: 0, parsed: 0, codeBytes: 0, eventHandlers: 0, errors: [] },
    rooms: { total: 0, parsed: 0, objects: 0, errors: [], missingScripts: [], missingGfx: [] },
    opcodes: {},
    events: {},
    objectTypes: {},
    gfxTransforms: {},
    midi: { files: 0, bytes: 0 },
  };

  for (const [name, data] of entries) {
    if (name.startsWith(`${dataDir}/scr/`)) {
      result.scripts.total++;
      try {
        const script = parseScript(data);
        walkCode(script, (op) => count(result.opcodes, op));
        for (const event of script.events) count(result.events, event.id);
        result.scripts.codeBytes += script.code.length;
        result.scripts.eventHandlers += script.events.length;
        result.scripts.parsed++;
      } catch (error) {
        result.scripts.errors.push(`${name}: ${error.message}`);
      }
    } else if (name.startsWith(`${dataDir}/rom/`)) {
      result.rooms.total++;
      try {
        const room = parseRoom(data, { wideZones: usesWideZones(dataDir) });
        result.rooms.objects += room.objects.length;
        for (const object of room.objects) {
          count(result.objectTypes, object.type);
          if (object.type === ROOM_OBJECT_GFX) count(result.gfxTransforms, object.transform);
        }
        for (const script of room.scripts) {
          if (!entries.has(`${dataDir}/scr/${script}.bin`)) result.rooms.missingScripts.push(script);
        }
        for (const { id } of room.gfx) {
          if (!entries.has(`${dataDir}/gfx/transform0/${id}.png`)) result.rooms.missingGfx.push(id);
        }
        result.rooms.parsed++;
      } catch (error) {
        result.rooms.errors.push(`${name}: ${error.message}`);
      }
    } else if (name.startsWith(`${dataDir}/sfx/`)) {
      result.midi.files++;
      result.midi.bytes += data.length;
    }
  }
  return result;
}
