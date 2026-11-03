// Silent Hill Mobile 3 archives (p.mbf, b.mbf), read by its "AAL" file manager:
// u32 file length, u32 index length, u32 count, count x { u32 length, u32 offset }.
// Offsets count from the end of the index.
export function parseMbf(buffer) {
  const indexLength = buffer.readUInt32BE(4);
  const count = buffer.readUInt32BE(8);
  const base = 12 + indexLength;
  return Array.from({ length: count }, (_, i) => {
    const length = buffer.readUInt32BE(12 + i * 8);
    const offset = buffer.readUInt32BE(16 + i * 8);
    return buffer.subarray(base + offset, base + offset + length);
  });
}

const isPng = (entry) => entry.length > 24 && entry[0] === 0x89 && entry[1] === 0x50;

export function pngSizes(entries) {
  return entries.filter(isPng).map((entry) => ({ width: entry.readUInt32BE(16), height: entry.readUInt32BE(20) }));
}

// boxal.inf has lines of "-1,<device tier>" and "-2,<version>"; key codes use the same prefixes.
export function parseBoxal(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  return {
    tier: lines.find((line) => line.startsWith('-1,') && !line.includes(',-'))?.slice(3) ?? null,
    version: lines.find((line) => /^-2,\d/.test(line))?.slice(3) ?? null,
  };
}
