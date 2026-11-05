import { parseChunkArchive, pngInfo } from './format.mjs';
import { isMobile3, loadMobile3 } from './mobile3/data.mjs';
import { parseZipDirectory, storedBytes } from './zip-directory.mjs';

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Copies on the Internet Archive, for players who don't have a JAR. The hash means that
// only this exact file is accepted, and each is kept under its own key in the browser.
export const ARCHIVE_JARS = {
  // The first game's 2014 build.
  sh1: {
    url: 'https://archive.org/download/j2me-game-glu-silenthill/glu-silenthill.zip/app.jar',
    integrity: 'sha256-P9YSB/lTDWbDEAcY3411XLHZ1Z2zevIQh8aMUQ+ooa0=',
    storageKey: 'archive',
  },
  // Mobile 2's keypad version, sh2-2015-a1, with the same data as sh2-2008-a7.
  sh2: {
    url: 'https://archive.org/download/j2me-game-glu-silenthillmobile2/glu-silenthillmobile2.zip/app.jar',
    integrity: 'sha256-pIeFM8jy8L2iDmLM/heRKVNwYj++OFfK/4Sb7saqXxw=',
    storageKey: 'archive-sh2',
  },
  // Mobile 3's keypad version, sh3-2010-v1.0.20-a, unlike the demos elsewhere on the Archive.
  sh3: {
    url: 'https://archive.org/download/j2me-game-connect2media-silenthillmobile3/connect2media-silenthillmobile3.zip/app.jar',
    integrity: 'sha256-Hie/V7Tt50Ihx5hTgTU9vWc1wwpW1Nj5W1QWgibW8sg=',
    storageKey: 'archive-sh3',
  },
};

// The width of a full-resolution build's art, by the folder its data is in.
const FULL_ART_WIDTHS = { sh: 256, a: 310 };

// Unpacks a whole JAR into memory. A JAR is a ZIP file.
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
// sits in chunk archives, and language files sit beside them. Silent Hill Mobile 2
// keeps those in a top-level lan/ folder, which M.loadGameLanguage opens directly.
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
    if (name.startsWith('lan/')) entries.set(`${dataDir}/${name}`, value);
  }
  return { dataDir, entries, files };
}

// Mobile 3 has builds the port doesn't follow, whose numbers its code can't read.
function inspectMobile3(files) {
  let data = null;
  try {
    data = loadMobile3(files);
  } catch {
    return { status: 'rejected', reason: 'damaged', message: "This JAR's game data is damaged." };
  }
  if (!data) {
    return {
      status: 'rejected',
      reason: 'mobile3-other-build',
      message:
        "The port doesn't follow this build of Silent Hill: Mobile 3 yet. It follows the v1.7.0 and v1.0.20 families.",
    };
  }
  return { status: 'ok', reason: 'ok', family: 'mobile3', data, message: '' };
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
  if (isMobile3(files)) return inspectMobile3(files);
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
  const fullWidth = FULL_ART_WIDTHS[data.dataDir];
  if (!fullWidth) {
    return { status: 'rejected', reason: 'other-game', message: "This isn't a Silent Hill: Mobile game the port knows." };
  }

  const art = [...data.entries].filter(([name]) => name.endsWith('.png')).map(([, value]) => pngInfo(value));
  const roomSize = Math.max(...art.map(({ width }) => width));
  // Silent Hill's rooms are square. Mobile 2's largest art is exactly a room's size.
  const roomHeight = data.dataDir === 'sh' ? roomSize : Math.max(...art.map(({ height }) => height));
  if (roomSize !== fullWidth) {
    return {
      status: 'warning',
      reason: 'small-art',
      roomSize,
      roomHeight,
      data,
      message: `This build has smaller art, ${roomSize} pixels wide. It should run, but its layout hasn't been tuned.`,
    };
  }
  return { status: 'ok', reason: 'ok', roomSize, roomHeight, data, message: '' };
}
