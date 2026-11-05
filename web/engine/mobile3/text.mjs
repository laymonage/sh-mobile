// Measuring and wrapping text in a bitmap font, as in GameMidlet.a(char[], int, int) and
// a(String, int). A "|" marks where a long word may break, and shows as a hyphen if it does.
export function glyphOf(font, character) {
  return font.glyphs.get(character.charCodeAt(0)) ?? { module: 0, offset: 0 };
}

export function measureText(data, fontIndex, text) {
  const font = data.fonts[fontIndex];
  let width = 0;
  for (const character of text) {
    width += data.moduleSize(font.sheet, glyphOf(font, character).module).width + font.spacing;
  }
  return width;
}

const WORD = 0;
const NEWLINE = 1;
const SPACE = 2;
const HYPHEN = 3;
const SOFT_BREAK = 4;

function classify(text, i) {
  const character = text[i];
  if (character === ' ' && '!?:'.includes(text[i + 1] ?? '.')) return -1;
  if (character === '\n') return NEWLINE;
  if (character <= ' ') return SPACE;
  if (character === '-') return HYPHEN;
  if (character === '|') return SOFT_BREAK;
  return WORD;
}

export function wrapText(data, fontIndex, text, width) {
  const lines = [];
  let line = '';
  let last = { at: 0, keep: 0, kind: WORD };
  let before = last;
  let canBreak = false;
  for (let i = 0; i < text.length; i++) {
    const kind = classify(text, i);
    if (kind > WORD) {
      before = last;
      last = { at: i, keep: line.length, kind };
      canBreak = true;
      if (kind === NEWLINE) {
        lines.push(line);
        line = '';
        canBreak = false;
        continue;
      }
    }
    if (kind !== SOFT_BREAK) line += text[i];
    if (canBreak && measureText(data, fontIndex, line) >= width) {
      if (kind === HYPHEN || (last.kind === SOFT_BREAK && i - last.at === 1)) last = before;
      if (last.kind === HYPHEN) last = { ...last, keep: last.keep + 1 };
      line = line.slice(0, last.keep);
      if (last.kind === SOFT_BREAK) line += '-';
      lines.push(line);
      line = '';
      i = last.at;
      canBreak = false;
    }
  }
  lines.push(line);
  return lines;
}
