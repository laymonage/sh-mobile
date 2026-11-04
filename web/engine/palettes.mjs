// Silent Hill Mobile 2 recolors its corridors by swapping an image's PNG palette, per
// the f class in sh2-2015-base. plts/palettes.pdt lists, for each image name, where its
// palettes sit in plts/palettes.bin. Each palette there is a complete PLTE chunk.

export function parsePaletteIndex(bytes) {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const index = new Map();
  let p = 0;
  const count = data.getInt16(p);
  p += 2;
  for (let i = 0; i < count; i++) {
    const nameLength = data.getUint16(p);
    p += 2;
    const name = decoder.decode(bytes.subarray(p, p + nameLength));
    p += nameLength;
    const offsets = Array.from({ length: data.getInt8(p++) }, () => {
      p += 4;
      return data.getInt32(p - 4);
    });
    index.set(name, offsets);
  }
  return index;
}

const CHUNK_OVERHEAD = 12;

function chunkLength(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset) + CHUNK_OVERHEAD;
}

function findPlte(png) {
  for (let p = 8; p < png.length; p += chunkLength(png, p)) {
    if (String.fromCharCode(...png.subarray(p + 4, p + 8)) === 'PLTE') return p;
  }
  return -1;
}

// The same PNG with the palette at `offset` in the bank, or null if it has none to replace.
export function recolorPng(png, bank, offset) {
  const start = findPlte(png);
  if (start === -1) return null;
  const end = start + chunkLength(png, start);
  const chunk = bank.subarray(offset, offset + chunkLength(bank, offset));
  const result = new Uint8Array(start + chunk.length + png.length - end);
  result.set(png.subarray(0, start));
  result.set(chunk, start);
  result.set(png.subarray(end), start + chunk.length);
  return result;
}
