import { parseChunkArchive, pngInfo } from './format.mjs';
import { parseZipDirectory, storedBytes } from './zip-directory.mjs';

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Unpacks a whole JAR into memory. A JAR is a ZIP file.
// A copy of the 2014 build on the Internet Archive, for players who don't have a JAR.
// The hash means that only this exact file is accepted.
export const ARCHIVE_JAR = {
  url: 'https://archive.org/download/j2me-game-glu-silenthill/glu-silenthill.zip/app.jar',
  integrity: 'sha256-P9YSB/lTDWbDEAcY3411XLHZ1Z2zevIQh8aMUQ+ooa0=',
};

export async function readJar(bytes) {
  const files = new Map();
  for (const [name, entry] of parseZipDirectory(bytes)) {
    const raw = storedBytes(bytes, entry);
    if (entry.method === 0) files.set(name, raw);
    else if (entry.method === 8) files.set(name, await inflate(raw));
    else throw new Error(`Unsupported compression method ${entry.method} for ${name}`);
  }
  return files;
}

// All game data by logical name, the same way the engine resolves it: most of it
// sits in chunk archives, and language files sit beside them.
export function loadGameData(files) {
  const entries = new Map();
  for (const [name, value] of files) {
    if (name.startsWith('chunks/')) {
      for (const [key, entry] of parseChunkArchive(value)) entries.set(key, entry);
    }
  }
  const dataDir = [...entries.keys()][0].split('/')[0];
  for (const [name, value] of files) {
    if (name.startsWith(`${dataDir}/`) && !name.endsWith('.class')) entries.set(name, value);
  }
  return { dataDir, entries, files };
}

// What the port can do with a JAR, judged only from its data.
export async function inspectJar(bytes) {
  let files;
  try {
    files = await readJar(bytes);
  } catch {
    return {
      status: 'rejected',
      reason: 'damaged',
      message: "This file can't be read. It may be damaged, or may not be a JAR.",
    };
  }
  if (![...files.keys()].some((name) => name.startsWith('chunks/'))) {
    return {
      status: 'rejected',
      reason: 'no-ink',
      message: "This JAR has no INK game data. It's probably a low-end build, or a different game.",
    };
  }

  let data;
  try {
    data = loadGameData(files);
  } catch {
    return { status: 'rejected', reason: 'damaged', message: "This JAR's game data is damaged." };
  }
  if (data.dataDir !== 'sh') {
    return {
      status: 'rejected',
      reason: 'other-game',
      message: "This looks like Silent Hill Mobile 2, which isn't supported yet.",
    };
  }

  const widths = [...data.entries].filter(([name]) => name.endsWith('.png')).map(([, value]) => pngInfo(value).width);
  const roomSize = Math.max(...widths);
  if (roomSize !== 256) {
    return {
      status: 'warning',
      reason: 'small-art',
      roomSize,
      data,
      message: `This build has smaller art, ${roomSize} pixels wide. It should run, but its layout hasn't been tuned.`,
    };
  }
  return { status: 'ok', reason: 'ok', roomSize, data, message: '' };
}
