import { frameAt } from './engine/mobile3/data.mjs';
import { glyphOf, measureText } from './engine/mobile3/text.mjs';
import { BOX } from './engine/mobile3/ui.mjs';

const SCALE = 3;
const TEXT_FONT = 2;
const HIGHLIGHT = '#bbbbbb';
const BOX_BACKGROUND = 8;

// The class c turns a sheet's numbers into MIDP's transforms, which each of these draws: a
// canvas matrix for a rectangle whose top left stays where it's drawn.
const RAW_TO_MIDP = [0, 6, 3, 5, 2, 4, 1, 7];
const MIDP_MATRICES = [
  () => [1, 0, 0, 1, 0, 0],
  (_, h) => [1, 0, 0, -1, 0, h],
  (w) => [-1, 0, 0, 1, w, 0],
  (w, h) => [-1, 0, 0, -1, w, h],
  () => [0, 1, 1, 0, 0, 0],
  (_, h) => [0, 1, -1, 0, h, 0],
  (w) => [0, -1, 1, 0, 0, w],
  (w, h) => [0, -1, -1, 0, h, w],
];

export class Mobile3Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.context = canvas.getContext('2d');
    canvas.width = game.frameWidth * SCALE;
    canvas.height = game.frameHeight * SCALE;
    this.bitmaps = new Map();
  }

  // Every sheet's image is decoded up front, as with the other games, so drawing never waits.
  async loadImages(data) {
    const ids = new Set();
    for (let index = 0; index < data.resourceCount(2); index++) ids.add((2 << 24) | index);
    await Promise.all(
      [...ids].map(async (id) => {
        const bytes = data.resource(id);
        if (bytes?.length > 8 && bytes[0] === 0x89) {
          this.bitmaps.set(id, await createImageBitmap(new Blob([bytes], { type: 'image/png' })));
        }
      }),
    );
  }

  animationOf(animation) {
    return typeof animation === 'number' ? this.game.data.animation(animation) : animation;
  }

  drawModule(sheetId, index, x, y) {
    const c = this.context;
    const sheet = this.game.data.sheet(sheetId);
    const bitmap = this.bitmaps.get(sheet.image);
    if (!bitmap) return;
    const module = sheet.modules[index];
    if (!module) return;
    const r = sheet.rectangles[module.rectangle];
    const matrix = MIDP_MATRICES[RAW_TO_MIDP[module.transform]](r.width, r.height);
    c.save();
    c.translate(x, y);
    c.transform(...matrix);
    c.drawImage(bitmap, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
    c.restore();
  }

  // The parts of an animation's frame. An offset is subtracted, as in k.a(int, c, ...).
  drawSprite({ sheet, animation: animationId, frame: frameIndex, x, y }) {
    const animation = this.animationOf(animationId);
    const frame = frameIndex === undefined ? frameAt(animation, this.game.time) : animation.frames[frameIndex];
    for (const part of frame?.parts ?? []) this.drawModule(sheet, part.module, x - part.x, y - part.y);
  }

  textWidth(fontIndex, text) {
    return measureText(this.game.data, fontIndex, text);
  }

  // As in GameMidlet.a(char[], int, int, int, int, int).
  drawText({ text, font: fontIndex, x, y, align }) {
    const { data } = this.game;
    const font = data.fonts[fontIndex];
    let left = x;
    if (align === 'right') left -= this.textWidth(fontIndex, text);
    else if (align === 'center') left -= this.textWidth(fontIndex, text) >> 1;
    const baseline = y + font.baseline + 1;
    for (const character of text) {
      const glyph = glyphOf(font, character);
      const size = data.moduleSize(font.sheet, glyph.module);
      this.drawModule(font.sheet, glyph.module, left, baseline - glyph.offset - size.height);
      left += size.width + font.spacing;
    }
  }

  // A box made of tiles, as in GameMidlet.a(int, int, int, int).
  drawFrame(x, y, width, height) {
    const { game } = this;
    const [sheet] = game.tables.boxSprites[0];
    const { tile } = game.boxes;
    const columns = Math.trunc(width / tile);
    const rows = Math.trunc(height / tile);
    this.drawModule(sheet, 2, x - tile, y - tile);
    this.drawModule(sheet, 4, x + width, y - tile);
    this.drawModule(sheet, 0, x - tile, y + height);
    this.drawModule(sheet, 6, x + width, y + height);
    for (let column = 0; column < columns; column++) {
      this.drawModule(sheet, 3, x + tile * column, y - tile);
      this.drawModule(sheet, 7, x + tile * column, y + height);
    }
    for (let row = 0; row < rows; row++) {
      this.drawModule(sheet, 1, x - tile, y + tile * row);
      this.drawModule(sheet, 5, x + width, y + tile * row);
    }
    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < rows; row++) this.drawModule(sheet, BOX_BACKGROUND, x + tile * column, y + tile * row);
    }
  }

  drawArrow(which, x, y) {
    const { game } = this;
    const [sheet, animation] = game.tables.boxSprites[1];
    this.drawSprite({ sheet, animation, frame: which, x, y });
  }

  drawLines(lines, x, y) {
    const { lineHeight } = this.game.boxes;
    lines.forEach((text, index) => {
      this.drawText({ text, font: TEXT_FONT, x, y: y + index * lineHeight });
    });
  }

  // The box kinds, as in GameMidlet.am().
  drawBox(box, offsetX) {
    const { game, context: c } = this;
    const { boxes } = game;
    const { lineHeight, rowHeight } = boxes;
    c.save();
    c.translate(offsetX, 0);
    this.drawFrame(box.frameX, box.frameY, box.frameWidth, box.frameHeight);
    if (box.rows) {
      c.fillStyle = HIGHLIGHT;
      const top = boxes.rowTop(box, box.selected);
      c.fillRect(box.frameX, top - 5, box.frameWidth, rowHeight);
      if (box.kind === BOX.CONFIRM) {
        const single = box.lines.length === 1;
        const textX = single ? box.x + ((box.width - this.textWidth(TEXT_FONT, box.lines[0])) >> 1) : box.x;
        this.drawLines(box.lines, textX, box.y + lineHeight * 2);
      }
      box.rows.forEach((text, index) => {
        const x = box.centered === false ? box.x : box.x + (box.width >> 1) - (this.textWidth(TEXT_FONT, text) >> 1);
        this.drawText({ text, font: TEXT_FONT, x, y: boxes.rowTop(box, index) });
      });
    } else if (box.kind === BOX.PAGES) {
      this.drawLines(box.lines.slice(box.scroll, box.scroll + box.pageLines), box.x, box.y);
      this.drawScrollArrows(box);
    } else if (box.kind === BOX.DIALOGUE) {
      const speaker = `${box.speaker}:`;
      this.drawText({ text: speaker, font: TEXT_FONT, x: box.x, y: box.y });
      c.fillStyle = '#000';
      c.fillRect(box.frameX, box.y + lineHeight - 1, this.textWidth(TEXT_FONT, speaker), 1);
      this.drawLines(box.lines.slice(box.scroll, box.scroll + box.pageLines), box.x, box.y + lineHeight + 3);
      this.drawScrollArrows(box);
    } else {
      this.drawLines(box.lines, box.x, box.y + lineHeight);
      if (box.icon) {
        const { sheet, animation } = game.data.hardCoded.inventory;
        this.drawSprite({ sheet, animation, frame: box.icon.frame, x: box.iconX, y: box.iconY });
      }
    }
    c.restore();
  }

  drawScrollArrows(box) {
    const { arrow, lineHeight } = this.game.boxes;
    const x = box.frameX + box.frameWidth - (arrow.width >> 1);
    if (box.scroll > 0) this.drawArrow(2, x, box.frameY - (arrow.height >> 1) + lineHeight);
    if (box.scroll + box.pageLines < box.lines.length) {
      this.drawArrow(3, x, box.frameY + box.frameHeight - (arrow.height >> 1));
    }
  }

  drawItem(item) {
    const { context: c } = this;
    if (item.box) this.drawBox(item.box, item.offsetX ?? 0);
    else if (item.panel) {
      this.drawFrame(item.x, item.y, item.width, item.height);
    } else if (item.arrow !== undefined) this.drawArrow(item.arrow, item.x, item.y);
    else if (item.text !== undefined) this.drawText(item);
    else if (item.fill) {
      c.globalAlpha = item.opacity ?? 1;
      c.fillStyle = item.fill;
      c.fillRect(item.x, item.y, item.width, item.height);
      c.globalAlpha = 1;
    } else if (item.module !== undefined) this.drawModule(item.sheet, item.module, item.x, item.y);
    else this.drawSprite(item);
  }

  draw() {
    const { context: c, game } = this;
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#000';
    c.fillRect(0, 0, game.frameWidth, game.frameHeight);
    for (const item of game.drawList()) this.drawItem(item);
  }

  updateHoveredRow() {}
}
