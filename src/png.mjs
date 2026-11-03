import { deflateSync, inflateSync } from 'node:zlib';
import { pngChunks as chunks, pngInfo } from '../web/engine/format.mjs';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export { pngInfo };

const CHANNELS = { 2: 3, 3: 1, 6: 4 };

// The games use non-interlaced indexed PNGs, and Silent Hill Mobile 2 also has
// some 8-bit RGB and RGBA ones, so that's all this handles.
export function decodePng(buffer) {
  const info = pngInfo(buffer);
  const channels = CHANNELS[info.colorType];
  if (!channels) throw new Error(`Unsupported colour type ${info.colorType}`);
  if (info.colorType !== 3 && info.depth !== 8) throw new Error(`Unsupported bit depth ${info.depth}`);
  if (buffer[28] !== 0) throw new Error('Interlaced PNGs are not supported');

  let palette;
  let alpha;
  const compressed = [];
  for (const chunk of chunks(buffer)) {
    if (chunk.type === 'PLTE') palette = chunk.data;
    if (chunk.type === 'tRNS') alpha = chunk.data;
    if (chunk.type === 'IDAT') compressed.push(chunk.data);
  }

  const { width, height, depth } = info;
  const raw = inflateSync(Buffer.concat(compressed));
  const bytesPerPixel = Math.ceil((channels * depth) / 8);
  const stride = Math.ceil((width * channels * depth) / 8);
  const rgba = Buffer.alloc(width * height * 4);
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1);
    const filter = raw[start];
    const line = Buffer.from(raw.subarray(start + 1, start + 1 + stride));
    for (let i = 0; i < stride; i++) {
      const a = i >= bytesPerPixel ? line[i - bytesPerPixel] : 0;
      const b = previous[i];
      const c = i >= bytesPerPixel ? previous[i - bytesPerPixel] : 0;
      if (filter === 1) line[i] = (line[i] + a) & 255;
      else if (filter === 2) line[i] = (line[i] + b) & 255;
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (filter === 4) line[i] = (line[i] + paeth(a, b, c)) & 255;
    }
    for (let x = 0; x < width; x++) {
      const out = (y * width + x) * 4;
      if (info.colorType !== 3) {
        line.copy(rgba, out, x * channels, x * channels + channels);
        if (channels === 3) rgba[out + 3] = 255;
        continue;
      }
      const bit = x * depth;
      const index = depth === 8 ? line[x] : (line[bit >> 3] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
      rgba[out] = palette[index * 3];
      rgba[out + 1] = palette[index * 3 + 1];
      rgba[out + 2] = palette[index * 3 + 2];
      rgba[out + 3] = alpha && index < alpha.length ? alpha[index] : 255;
    }
    previous = line;
  }
  return { ...info, rgba };
}

function paeth(a, b, c) {
  const estimate = a + b - c;
  const pa = Math.abs(estimate - a);
  const pb = Math.abs(estimate - b);
  const pc = Math.abs(estimate - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = ~0;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function encodeRgbaPng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
