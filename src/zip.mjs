import { inflateRawSync } from 'node:zlib';

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;

// Minimal ZIP reader, enough for JARs: no ZIP64 and no encryption.
export class Zip {
  constructor(buffer) {
    this.buffer = buffer;
    this.entries = new Map();

    let eocd = buffer.length - 22;
    while (eocd >= 0 && buffer.readUInt32LE(eocd) !== EOCD) eocd--;
    if (eocd < 0) throw new Error('Not a ZIP file');

    const total = buffer.readUInt16LE(eocd + 10);
    let p = buffer.readUInt32LE(eocd + 16);
    for (let i = 0; i < total; i++) {
      if (buffer.readUInt32LE(p) !== CENTRAL) throw new Error('Bad central directory');
      const time = buffer.readUInt16LE(p + 12);
      const date = buffer.readUInt16LE(p + 14);
      const nameLength = buffer.readUInt16LE(p + 28);
      const extraLength = buffer.readUInt16LE(p + 30);
      const commentLength = buffer.readUInt16LE(p + 32);
      const name = buffer.toString('utf8', p + 46, p + 46 + nameLength);
      if (!name.endsWith('/')) {
        this.entries.set(name, {
          name,
          method: buffer.readUInt16LE(p + 10),
          compressedSize: buffer.readUInt32LE(p + 20),
          size: buffer.readUInt32LE(p + 24),
          localOffset: buffer.readUInt32LE(p + 42),
          date: dosDate(date, time),
        });
      }
      p += 46 + nameLength + extraLength + commentLength;
    }
  }

  get names() {
    return [...this.entries.keys()];
  }

  has(name) {
    return this.entries.has(name);
  }

  read(name) {
    const entry = this.entries.get(name);
    if (!entry) throw new Error(`No such entry: ${name}`);
    const p = entry.localOffset;
    const start = p + 30 + this.buffer.readUInt16LE(p + 26) + this.buffer.readUInt16LE(p + 28);
    const raw = this.buffer.subarray(start, start + entry.compressedSize);
    if (entry.method === 0) return raw;
    if (entry.method === 8) return inflateRawSync(raw);
    throw new Error(`Unsupported compression method ${entry.method} for ${name}`);
  }
}

function dosDate(date, time) {
  const pad = (value) => String(value).padStart(2, '0');
  const year = (date >> 9) + 1980;
  const month = (date >> 5) & 15;
  const day = date & 31;
  return `${year}-${pad(month)}-${pad(day)} ${pad(time >> 11)}:${pad((time >> 5) & 63)}`;
}
