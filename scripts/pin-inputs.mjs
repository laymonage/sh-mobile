import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GAMES, INPUT_ROOT, input, manifest, MANIFEST_PATH, sha256 } from '../src/inputs.mjs';
import { Zip } from '../src/zip.mjs';

// Rewrites the input list in inputs.json from the sh1, sh2 and sh3 folders.
// Run this only after adding downloads: `npm run verify` checks existing pins.
const DEFAULT_VERSION = { sh1: '0.1.0', sh2: '1.0.0' };
const NOT_A_TAG = /^(Konami|Connect2Media)$/;

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-|-$/g, '');

// "Silent Hill (2007)(Konami_BiNPDA)(v0.1.0)(a2).jar" becomes sh1-2007-binpda-a2.
// "Silent-Hill-Orphan_J2ME_EN_v153.jar" becomes sh1-en-v153.
function idFor(game, name) {
  const catalogued = name.match(/^(.+?) \((\d{4})\)\(([^)]+)\)\(v([\d.]+)\)(?:\(([^)]+)\))?\.jar$/);
  if (catalogued) {
    const [, title, year, publisher, version, suffix] = catalogued;
    const parts = [game, year];
    const renamed = title.match(/_(.+)$/)?.[1];
    if (renamed) parts.push(renamed);
    if (!NOT_A_TAG.test(publisher)) parts.push(publisher.replace(/^Konami[ _](n )?/, ''));
    if (version !== DEFAULT_VERSION[game]) parts.push(`v${version}`);
    parts.push(suffix ?? 'base');
    return parts.map(slug).join('-');
  }
  const download = name.match(/_J2ME_(.+)\.jar$/);
  if (!download) throw new Error(`Can't name a build from "${name}"`);
  return `${game}-${slug(download[1])}`;
}

const inZipsFirst = (left, right) =>
  Number(!left.member) - Number(!right.member) ||
  (left.path < right.path ? -1 : left.path > right.path ? 1 : 0) ||
  (left.member < right.member ? -1 : 1);

const pinned = [];
for (const game of GAMES) {
  const copies = [];
  for (const file of readdirSync(join(INPUT_ROOT, game)).sort()) {
    const path = `${game}/${file}`;
    const buffer = readFileSync(join(INPUT_ROOT, path));
    if (file.endsWith('.jar')) {
      copies.push({ path, name: file, buffer });
    } else if (file.endsWith('.zip')) {
      const zip = new Zip(buffer);
      for (const member of zip.names) {
        if (member.endsWith('.jar')) copies.push({ path, member, name: member, buffer: zip.read(member) });
      }
    }
  }

  const byHash = new Map();
  for (const copy of copies.sort(inZipsFirst)) {
    const hash = sha256(copy.buffer);
    if (!byHash.has(hash)) byHash.set(hash, []);
    byHash.get(hash).push(copy);
  }

  const ids = new Set();
  const builds = [...byHash].map(([hash, [first, ...others]]) => {
    let id = idFor(game, first.name);
    for (let n = 2; ids.has(id); n++) id = `${idFor(game, first.name)}-${n}`;
    ids.add(id);
    return {
      id,
      game,
      path: first.path,
      ...(first.member ? { member: first.member } : {}),
      size: first.buffer.length,
      sha256: hash,
      ...(others.length ? { alsoAt: others.map(({ path, member }) => (member ? `${path}::${member}` : path)) } : {}),
    };
  });
  pinned.push(...builds.sort((left, right) => (left.id < right.id ? -1 : 1)));
  console.log(`${game}: ${copies.length} JARs, ${builds.length} distinct.`);
}

const { id, role, path, size, sha256: hash } = input('vineflower');
writeFileSync(
  MANIFEST_PATH,
  `${JSON.stringify({ ...manifest, inputs: [...pinned, { id, role, path, size, sha256: hash }] }, null, 2)}\n`,
);
