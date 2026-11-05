import { measureText, wrapText } from './text.mjs';

// The boxes of text and rows the original draws, as in GameMidlet.a(String, ...), c(String)
// and a(String[], ...). They're laid out on the phone's 240-pixel screen.
export const SCREEN_WIDTH = 240;
export const SCREEN_HEIGHT = 320;
const TEXT_FONT = 2;
const SOFT_KEY_FONT = 1;
const WIDE = (SCREEN_WIDTH * 75) / 100;

export const BOX = { ROWS: 'rows', PAGES: 'pages', DIALOGUE: 'dialogue', MESSAGE: 'message', CONFIRM: 'confirm' };

export class BoxMaker {
  constructor(data) {
    this.data = data;
    const [frameSheet] = data.tables.boxSprites[0];
    const [arrowSheet] = data.tables.boxSprites[1];
    this.tile = data.moduleSize(frameSheet, 8).width;
    this.lineHeight = data.fonts[TEXT_FONT].lineHeight;
    this.rowHeight = this.lineHeight + 10;
    this.softKeyHeight = data.fonts[SOFT_KEY_FONT].lineHeight;
    this.arrow = data.moduleSize(arrowSheet, 2);
  }

  // The frame goes around the text in whole tiles, as in GameMidlet.al().
  withFrame(box) {
    const { tile } = this;
    const fit = (start, length) => {
      if (length % tile === 0) return [start, length];
      const whole = (Math.trunc(length / tile) + 1) * tile;
      return [start - ((whole - length) >> 1), whole];
    };
    [box.frameX, box.frameWidth] = fit(box.x, box.width);
    [box.frameY, box.frameHeight] = fit(box.y, box.height);
    return box;
  }

  measure(text) {
    return measureText(this.data, TEXT_FONT, text);
  }

  wrap(text, width) {
    return wrapText(this.data, TEXT_FONT, text, width);
  }

  // A menu sized to its rows.
  rows(rows, { width = null, centered = true, selected = 0 } = {}) {
    const boxWidth = width ?? Math.max(...rows.map((row) => this.measure(row)));
    const height = this.rowHeight * rows.length;
    return this.withFrame({
      kind: BOX.ROWS,
      rows,
      centered,
      selected,
      x: (SCREEN_WIDTH - boxWidth) >> 1,
      y: (SCREEN_HEIGHT - height) >> 1,
      width: boxWidth,
      height,
    });
  }

  // A long text that scrolls a page at a time, as help does.
  pages(text) {
    const width = SCREEN_WIDTH - 60;
    const height = SCREEN_HEIGHT - 100;
    return this.withFrame({
      kind: BOX.PAGES,
      lines: this.wrap(text, width),
      scroll: 0,
      pageLines: Math.trunc(height / this.lineHeight),
      x: 30,
      y: 50,
      width,
      height,
    });
  }

  // A speaker's words in a box near the bottom.
  dialogue(speaker, text) {
    const { tile, lineHeight, softKeyHeight } = this;
    let width = SCREEN_WIDTH - 2 - (tile << 1);
    if (width % tile !== 0) width = (Math.trunc(width / tile) - 1) * tile;
    let height = lineHeight * 5;
    if (height % tile !== 0) height = (Math.trunc(height / tile) - 1) * tile;
    return this.withFrame({
      kind: BOX.DIALOGUE,
      speaker,
      text,
      lines: this.wrap(text, width),
      scroll: 0,
      pageLines: Math.trunc(height / lineHeight) - 1,
      x: (SCREEN_WIDTH - width) >> 1,
      y: SCREEN_HEIGHT - softKeyHeight - height - tile - 15,
      width,
      height,
    });
  }

  // A few words in the middle of the screen, sometimes under an item's picture.
  message(text, { wide = false, icon = null } = {}) {
    const { tile, lineHeight, softKeyHeight } = this;
    let width = WIDE;
    if (!wide && this.measure(text) < width) width = this.measure(text) + tile;
    const lines = this.wrap(text, width);
    if (width % tile !== 0) width = Math.trunc(width / tile) * tile;
    let height = (lines.length + 1) * lineHeight;
    if (height % tile !== 0) height = Math.trunc(height / tile) * tile;
    let y = ((SCREEN_HEIGHT - softKeyHeight) >> 1) - (height >> 1);
    const box = { kind: BOX.MESSAGE, text, lines, icon, x: (SCREEN_WIDTH - width) >> 1, width, height };
    if (icon) {
      box.height += icon.height - tile;
      y -= icon.height >> 1;
      box.iconX = box.x + (width >> 1);
      box.iconY = y + icon.height - (icon.item === 107 ? 10 : 0);
    }
    box.y = y;
    this.withFrame(box);
    if (icon) box.y += icon.height;
    box.y -= 10;
    if (lines.length === 1) box.y += 4 - (lineHeight >> 1);
    return box;
  }

  // A question with two answers. As in the original, it starts on the second.
  confirm(text, rows) {
    const { tile, lineHeight, rowHeight, softKeyHeight } = this;
    let width = WIDE;
    for (const row of rows) width = Math.max(width, this.measure(row));
    if (this.measure(text) < width) width = this.measure(text) + tile;
    const lines = this.wrap(text, width);
    if (width % tile !== 0) width = Math.trunc(width / tile) * tile;
    let height = (lines.length + 1) * lineHeight + rowHeight * (rows.length + 1);
    if (height % tile !== 0) height = (Math.trunc(height / tile) - 1) * tile;
    const box = this.withFrame({
      kind: BOX.CONFIRM,
      lines,
      rows,
      selected: 1,
      x: (SCREEN_WIDTH - width) >> 1,
      y: ((SCREEN_HEIGHT - softKeyHeight) >> 1) - (height >> 1),
      width,
      height,
    });
    box.y -= 10;
    return box;
  }

  // Where a box's rows are, for drawing them and for the mouse.
  rowTop(box, index) {
    const { lineHeight, rowHeight } = this;
    if (box.kind === BOX.CONFIRM)
      return box.y + (lineHeight >> 1) + lineHeight * (box.lines.length + 2) + rowHeight * index;
    return box.y + rowHeight * index;
  }

  rowAt(box, x, y) {
    if (!box.rows || x < box.frameX || x >= box.frameX + box.frameWidth) return -1;
    return box.rows.findIndex((_, index) => {
      const top = this.rowTop(box, index) - (this.rowHeight >> 2);
      return y >= top && y < top + this.rowHeight;
    });
  }
}
