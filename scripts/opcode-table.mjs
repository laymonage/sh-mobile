import { parseClass } from '../src/classfile.mjs';
import { analyzeInkData, loadInkData } from '../src/ink.mjs';
import { readInput, recommended } from '../src/inputs.mjs';
import { table, writeReport } from '../src/report.mjs';
import { Zip } from '../src/zip.mjs';

const { codeReference, gameData } = recommended.sh1;
const columns = [gameData, recommended.sh2.gameData, recommended.sh2.keypadReference];
const constants = parseClass(new Zip(readInput(codeReference)).read('s.class')).fields;
const usage = columns.map((id) => analyzeInkData(loadInkData(readInput(id))));

function rows(prefix, kind) {
  return constants
    .filter((field) => field.name.startsWith(prefix) && field.name !== `${prefix}COUNT`)
    .sort((a, b) => a.constantValue - b.constantValue)
    .map((field) => [
      field.constantValue,
      field.name.slice(prefix.length),
      ...usage.map((counts) => counts[kind][field.constantValue] ?? 0),
    ]);
}

const commands = rows('COMMAND_', 'opcodes');
const events = rows('EVENT_', 'events');

writeReport(
  'opcodes.md',
  `# INK script commands and events\n\nNames come from \`s.class\` in \`${codeReference}\`. No Silent Hill Mobile 2 build keeps its names, so applying them to that game assumes the IDs mean the same thing.\n\n` +
    `## Commands\n\n${table(['ID', 'Name', ...columns], commands)}\n\n## Events\n\n${table(['ID', 'Name', ...columns], events)}\n`,
);

columns.forEach((id, column) => {
  const used = (list) => list.filter((row) => row[column + 2]).length;
  console.log(
    `${id}: ${used(commands)} of ${commands.length} commands and ${used(events)} of ${events.length} events are used.`,
  );
});
