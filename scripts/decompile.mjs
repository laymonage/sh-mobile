import { relative } from 'node:path';
import { decompile, extractLeftoverSource } from '../src/java.mjs';
import { recommended, ROOT } from '../src/inputs.mjs';

// Vineflower can't rebuild one method of this reference build, and leaves its bytecode in a comment.
const KNOWN_FAILURES = { 'sh1-en-v153': ['i.java'] };

const { sh1, sh2, sh3 } = recommended;
const ids = process.argv.slice(2);
const targets = ids.length
  ? ids
  : [sh1.codeReference, sh1.secondCodeReference, sh1.touchReference, sh2.gameData, sh2.keypadReference, sh3.gameData];

let failed = false;
for (const id of targets) {
  const { output, files, lines, failures } = decompile(id);
  console.log(`Decompiled ${files.length} classes from ${id} into ${relative(ROOT, output)} (${lines} lines).`);
  const unexpected = failures.filter((name) => !KNOWN_FAILURES[id]?.includes(name));
  if (failures.length > unexpected.length) console.log(`Known Vineflower failure in: ${KNOWN_FAILURES[id].join(', ')}`);
  if (unexpected.length) {
    console.error(`Vineflower reported failures in: ${unexpected.join(', ')}`);
    failed = true;
  }
}

if (!ids.length) {
  const { output, files } = extractLeftoverSource(sh1.sourceBackup);
  console.log(
    `Extracted ${files.length} leftover source files from ${sh1.sourceBackup} into ${relative(ROOT, output)}.`,
  );
}
if (failed) process.exit(1);
