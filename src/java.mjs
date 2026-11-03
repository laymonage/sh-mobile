import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUILD, INPUT_ROOT, input, readInput, sha256 } from './inputs.mjs';
import { Zip } from './zip.mjs';

const FAILURE_MARKER = /\$VF: (Couldn|Unable)|couldn't be decompiled|Exception decompiling/;

export function hasJava() {
  return spawnSync('java', ['-version'], { encoding: 'utf8' }).status === 0;
}

function extractClasses(id) {
  const directory = join(BUILD, 'classes', id);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const zip = new Zip(readInput(id));
  const names = [];
  for (const name of zip.names) {
    if (!name.endsWith('.class')) continue;
    const path = join(directory, name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, zip.read(name));
    names.push(name.replace(/\.class$/, '').replaceAll('/', '.'));
  }
  return { directory, names };
}

// Counts real instructions in javap output; switch case lines are "  48: 94".
export function countInstructions(id) {
  const { directory, names } = extractClasses(id);
  let instructions = 0;
  for (const name of names) {
    const { stdout, status, stderr } = spawnSync('javap', ['-p', '-c', '-classpath', directory, name], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
    if (status !== 0) throw new Error(`javap failed for ${name}: ${stderr}`);
    instructions += stdout.match(/^ +\d+: [a-z_]/gm)?.length ?? 0;
  }
  return instructions;
}

// Saves the editor backups some builds shipped by accident, such as M.java~.
export function extractLeftoverSource(id) {
  const output = join(BUILD, 'source', id);
  rmSync(output, { recursive: true, force: true });
  const zip = new Zip(readInput(id));
  const files = zip.names.filter((name) => /\.(java|ini)~$/.test(name));
  for (const name of files) {
    const path = join(output, name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, zip.read(name));
  }
  return { output, files };
}

export function decompile(id) {
  const vineflower = input('vineflower');
  if (sha256(readInput('vineflower')) !== vineflower.sha256) {
    throw new Error('Vineflower JAR does not match inputs.json');
  }
  const { directory } = extractClasses(id);
  const output = join(BUILD, 'decompiled', id);
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });

  const { status, stderr } = spawnSync(
    'java',
    ['-jar', join(INPUT_ROOT, vineflower.path), '-log=WARN', directory, output],
    {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  if (status !== 0) throw new Error(`Vineflower failed: ${stderr}`);

  const files = readdirSync(output)
    .filter((name) => name.endsWith('.java'))
    .sort();
  const sources = new Map(files.map((name) => [name, readFileSync(join(output, name), 'utf8')]));
  return {
    output,
    files,
    lines: [...sources.values()].reduce((sum, text) => sum + text.split('\n').length - 1, 0),
    failures: files.filter((name) => FAILURE_MARKER.test(sources.get(name))),
    sources,
  };
}
