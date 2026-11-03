// Reads a ZIP's central directory, which is all a JAR needs: no ZIP64 and no
// encryption. Decompression differs between Node and the browser, so it's left out.
const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const utf8 = new TextDecoder('utf-8');

export function parseZipDirectory(bytes) {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries = new Map();

  let eocd = bytes.length - 22;
  while (eocd >= 0 && data.getUint32(eocd, true) !== EOCD) eocd--;
  if (eocd < 0) throw new Error('Not a ZIP file');

  const total = data.getUint16(eocd + 10, true);
  let p = data.getUint32(eocd + 16, true);
  for (let i = 0; i < total; i++) {
    if (data.getUint32(p, true) !== CENTRAL) throw new Error('Bad central directory');
    const time = data.getUint16(p + 12, true);
    const date = data.getUint16(p + 14, true);
    const nameLength = data.getUint16(p + 28, true);
    const extraLength = data.getUint16(p + 30, true);
    const commentLength = data.getUint16(p + 32, true);
    const name = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    if (!name.endsWith('/')) {
      entries.set(name, {
        name,
        method: data.getUint16(p + 10, true),
        compressedSize: data.getUint32(p + 20, true),
        size: data.getUint32(p + 24, true),
        localOffset: data.getUint32(p + 42, true),
        date: dosDate(date, time),
      });
    }
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

// The entry's stored bytes, still compressed if entry.method says so.
export function storedBytes(bytes, entry) {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const p = entry.localOffset;
  const start = p + 30 + data.getUint16(p + 26, true) + data.getUint16(p + 28, true);
  return bytes.subarray(start, start + entry.compressedSize);
}

function dosDate(date, time) {
  const pad = (value) => String(value).padStart(2, '0');
  const year = (date >> 9) + 1980;
  const month = (date >> 5) & 15;
  const day = date & 31;
  return `${year}-${pad(month)}-${pad(day)} ${pad(time >> 11)}:${pad((time >> 5) & 63)}`;
}
