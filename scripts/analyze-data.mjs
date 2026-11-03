import { isInk, analyzeInkData, loadInkData } from '../src/ink.mjs';
import { buildsOf, readInput, recommended } from '../src/inputs.mjs';
import { writeReport } from '../src/report.mjs';
import { Zip } from '../src/zip.mjs';

const CORRUPT = 'sh2-2008-konno-a3';
const summary = {};
for (const { id } of [...buildsOf('sh1'), ...buildsOf('sh2')]) {
  if (id === CORRUPT) continue;
  const zip = new Zip(readInput(id));
  if (isInk(zip)) summary[id] = analyzeInkData(loadInkData(zip));
}

const ids = Object.keys(summary);
const clean = ids.filter((id) => !summary[id].scripts.errors.length && !summary[id].rooms.errors.length);
console.log(`Decoded ${clean.length} of ${ids.length} INK builds with no errors.`);
for (const id of [recommended.sh1.gameData, recommended.sh2.gameData, recommended.sh2.keypadReference]) {
  const { scripts, rooms, opcodes } = summary[id];
  console.log(
    `${id}: scripts ${scripts.parsed}/${scripts.total}, rooms ${rooms.parsed}/${rooms.total}, ${Object.keys(opcodes).length} opcodes, ${scripts.codeBytes} code bytes`,
  );
}
writeReport('data.json', summary);
