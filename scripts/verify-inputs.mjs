import { allInputs, readInput, sha256 } from '../src/inputs.mjs';

let problems = 0;
for (const { id, path, member, sha256: expected } of allInputs) {
  const location = member ? `${path}::${member}` : path;
  try {
    if (sha256(readInput(id)) !== expected) {
      console.log(`DIFFERENT ${id}: ${location}`);
      problems++;
    }
  } catch {
    console.log(`MISSING   ${id}: ${location}`);
    problems++;
  }
}

if (problems) {
  console.error(`${problems} of ${allInputs.length} inputs are missing or different. See README.md.`);
  process.exit(1);
}
console.log(`All ${allInputs.length} inputs match inputs.json.`);
