import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPORTS, ROOT } from './inputs.mjs';

export function writeReport(name, content) {
  mkdirSync(REPORTS, { recursive: true });
  const path = join(REPORTS, name);
  const text = typeof content === 'string' ? content : `${JSON.stringify(content, jsonValue, 2)}\n`;
  writeFileSync(path, text);
  console.log(`Wrote ${relative(ROOT, path)}`);
}

function jsonValue(_key, value) {
  if (value instanceof Set) return [...value].sort();
  if (value instanceof Map) return Object.fromEntries(value);
  return value;
}

export function table(headers, rows) {
  const line = (cells) => `| ${cells.map((cell) => String(cell).replaceAll('|', '\\|')).join(' | ')} |`;
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n');
}
