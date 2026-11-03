import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadInkData } from '../src/ink.mjs';
import { BUILD, readInput, recommended, ROOT } from '../src/inputs.mjs';
import { encodeRgbaPng } from '../src/png.mjs';
import { renderRoom } from '../src/render.mjs';

// Usage: node scripts/render-rooms.mjs [--game sh1|sh2] [--all] [roomId...]
const args = process.argv.slice(2);
const gameFlag = args.indexOf('--game');
const game = gameFlag === -1 ? null : args[gameFlag + 1];
const roomArgs = args.filter((arg, index) => !arg.startsWith('--') && index !== gameFlag + 1);
const SAMPLE_ROOMS = { sh1: ['0', '1a'], sh2: ['0', 'puzzleBodyIncision'] };

for (const current of game ? [game] : ['sh1', 'sh2']) {
  const data = loadInkData(readInput(recommended[current].gameData));
  const allRooms = [...data.entries.keys()].map((name) => name.match(/\/rom\/(.+)\.bin$/)?.[1]).filter(Boolean);
  const rooms = args.includes('--all') ? allRooms : roomArgs.length ? roomArgs : SAMPLE_ROOMS[current];

  const directory = join(BUILD, 'rooms', current);
  mkdirSync(directory, { recursive: true });
  for (const id of rooms) {
    const { width, height, rgba } = renderRoom(data, id);
    if (!width || !height) {
      console.log(`Skipped room ${id}: nothing to draw`);
      continue;
    }
    const path = join(directory, `${id}.png`);
    writeFileSync(path, encodeRgbaPng(width, height, rgba));
    console.log(`Wrote ${relative(ROOT, path)} (${width}x${height})`);
  }
}
