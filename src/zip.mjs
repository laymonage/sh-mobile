import { inflateRawSync } from 'node:zlib';
import { parseZipDirectory, storedBytes } from '../web/engine/zip-directory.mjs';

// Minimal synchronous ZIP reader for the analysis tools.
export class Zip {
  constructor(buffer) {
    this.buffer = buffer;
    this.entries = parseZipDirectory(buffer);
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
    const raw = storedBytes(this.buffer, entry);
    if (entry.method === 0) return raw;
    if (entry.method === 8) return inflateRawSync(raw);
    throw new Error(`Unsupported compression method ${entry.method} for ${name}`);
  }
}
