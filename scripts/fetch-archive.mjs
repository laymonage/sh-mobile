import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ARCHIVE_ROOT, allInputs, archivePath, sha256 } from '../src/inputs.mjs';
import { ARCHIVE_JARS } from '../web/engine/jar.mjs';

// Downloads the copies the page offers from the Internet Archive, for the tests in
// test/archive.test.mjs. Each must match the page's hash and a pinned build, and is
// saved as archive/<build ID>.jar. Copies already saved are kept.
mkdirSync(ARCHIVE_ROOT, { recursive: true });
for (const [game, { url, integrity }] of Object.entries(ARCHIVE_JARS)) {
  const hash = Buffer.from(integrity.replace(/^sha256-/, ''), 'base64').toString('hex');
  const build = allInputs.find((candidate) => candidate.sha256 === hash);
  if (!build) throw new Error(`The ${game} copy's hash isn't a pinned build: ${hash}`);
  const file = archivePath(build.id);
  if (existsSync(file) && sha256(readFileSync(file)) === hash) {
    console.log(`KEPT       ${build.id}`);
    continue;
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha256(bytes) !== hash) throw new Error(`${url} doesn't match ${build.id}'s hash`);
  writeFileSync(file, bytes);
  console.log(`DOWNLOADED ${build.id} (${bytes.length} bytes)`);
}
