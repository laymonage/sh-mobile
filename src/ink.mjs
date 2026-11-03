import {
  parseChunkArchive,
  parseLan,
  parseRoom,
  parseScript,
  ROOM_OBJECT_GFX,
  usesWideZones,
  walkCode,
} from '../web/engine/format.mjs';
import { Zip } from './zip.mjs';

// Node helpers around the INK engine's data formats, which live in web/engine/format.mjs.

export { parseChunkArchive, parseLan, parseRoom, parseScript, ROOM_OBJECT_GFX, usesWideZones, walkCode };

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
