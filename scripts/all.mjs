import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from '../src/inputs.mjs';

const steps = [
  'verify-inputs',
  'compare-builds',
  'analyze-data',
  'opcode-table',
  'render-rooms',
  'code-volume',
  'decompile',
];

for (const step of steps) {
  console.log(`\n== ${step} ==`);
  const { status } = spawnSync(process.execPath, [join(ROOT, 'scripts', `${step}.mjs`)], { stdio: 'inherit' });
  if (status !== 0) process.exit(status ?? 1);
}
