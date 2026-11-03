import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Zip } from './zip.mjs';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const BUILD = join(ROOT, 'build');
export const REPORTS = join(BUILD, 'reports');
export const GAMES = ['sh1', 'sh2', 'sh3'];

// Set SHM_INPUTS to keep the downloads somewhere other than the repo root.
export const INPUT_ROOT = process.env.SHM_INPUTS ? resolve(process.env.SHM_INPUTS) : ROOT;

export const MANIFEST_PATH = join(ROOT, 'inputs.json');
export const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

export const allInputs = manifest.inputs;
export const recommended = manifest.recommended;

export function buildsOf(game) {
  return allInputs.filter((candidate) => candidate.game === game);
}

export function input(id) {
  const found = allInputs.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Unknown input: ${id}`);
  return found;
}

const containers = new Map();

function readContainer(path) {
  if (!containers.has(path)) containers.set(path, new Zip(readFileSync(path)));
  return containers.get(path);
}

// A build is either a file of its own or a member of a downloaded ZIP.
export function readInput(id) {
  const { path, member } = input(id);
  const fullPath = join(INPUT_ROOT, path);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing input "${id}": expected ${fullPath}. See README.md.`);
  }
  return member ? readContainer(fullPath).read(member) : readFileSync(fullPath);
}

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function sha1Short(buffer) {
  return createHash('sha1').update(buffer).digest('hex').slice(0, 10);
}
