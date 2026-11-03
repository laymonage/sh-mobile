import { parseRoom, ROOM_OBJECT_GFX, usesWideZones } from './ink.mjs';
import { decodePng } from './png.mjs';

const ZONE_COLOR = [255, 64, 64];

// Maps a source pixel to its transformed position, for the indices used by
// MyCanvas.transformTable. Placement follows M.getLeft and M.getTop.
const TRANSFORMS = [
  { swap: false, pixel: (x, y) => [x, y], left: (w, h, rx) => rx, top: (w, h, rx, ry) => ry },
  { swap: false, pixel: (x, y, w) => [w - 1 - x, y], left: (w, h, rx) => w - rx, top: (w, h, rx, ry) => ry },
  { swap: true, pixel: (x, y, w, h) => [h - 1 - y, x], left: (w, h, rx, ry) => h - ry, top: (w, h, rx) => rx },
  {
    swap: true,
    pixel: (x, y, w, h) => [h - 1 - y, w - 1 - x],
    left: (w, h, rx, ry) => h - ry,
    top: (w, h, rx) => w - rx,
  },
  {
    swap: false,
    pixel: (x, y, w, h) => [w - 1 - x, h - 1 - y],
    left: (w, h, rx) => w - rx,
    top: (w, h, rx, ry) => h - ry,
  },
  { swap: false, pixel: (x, y, w, h) => [x, h - 1 - y], left: (w, h, rx) => rx, top: (w, h, rx, ry) => h - ry },
  { swap: true, pixel: (x, y, w) => [y, w - 1 - x], left: (w, h, rx, ry) => ry, top: (w, h, rx) => w - rx },
  { swap: true, pixel: (x, y) => [y, x], left: (w, h, rx, ry) => ry, top: (w, h, rx) => rx },
];

const ALPHA_THRESHOLD = 128;

// Draws every sprite object in file order, ignoring the isVisible script events,
// so this shows what a room contains rather than a moment in the game.
export function renderRoom({ dataDir, entries }, roomId, { zones = true } = {}) {
  const room = parseRoom(entries.get(`${dataDir}/rom/${roomId}.bin`), { wideZones: usesWideZones(dataDir) });
  const sprites = [];
  let width = 0;
  let height = 0;

  for (const object of room.objects) {
    if (object.type === ROOM_OBJECT_GFX) {
      const png = entries.get(`${dataDir}/gfx/transform0/${object.gfxId}.png`);
      if (!png) continue;
      const image = decodePng(png);
      const transform = TRANSFORMS[object.transform];
      const left = object.x - transform.left(image.width, image.height, image.regX, image.regY);
      const top = object.y - transform.top(image.width, image.height, image.regX, image.regY);
      const drawnWidth = transform.swap ? image.height : image.width;
      const drawnHeight = transform.swap ? image.width : image.height;
      sprites.push({ image, transform, left, top });
      width = Math.max(width, left + drawnWidth);
      height = Math.max(height, top + drawnHeight);
    } else {
      width = Math.max(width, object.x + object.width);
      height = Math.max(height, object.y + object.height);
    }
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  const put = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const out = (y * width + x) * 4;
    rgba[out] = r;
    rgba[out + 1] = g;
    rgba[out + 2] = b;
  };

  for (const { image, transform, left, top } of sprites) {
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const source = (y * image.width + x) * 4;
        if (image.rgba[source + 3] < ALPHA_THRESHOLD) continue;
        const [dx, dy] = transform.pixel(x, y, image.width, image.height);
        put(left + dx, top + dy, image.rgba[source], image.rgba[source + 1], image.rgba[source + 2]);
      }
    }
  }

  if (zones) {
    for (const object of room.objects) {
      if (object.type === ROOM_OBJECT_GFX) continue;
      for (let x = object.x; x < object.x + object.width; x++) {
        put(x, object.y, ...ZONE_COLOR);
        put(x, object.y + object.height - 1, ...ZONE_COLOR);
      }
      for (let y = object.y; y < object.y + object.height; y++) {
        put(object.x, y, ...ZONE_COLOR);
        put(object.x + object.width - 1, y, ...ZONE_COLOR);
      }
    }
  }

  return { width, height, rgba, room };
}
