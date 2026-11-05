import { frameAt } from './engine/mobile3/data.mjs';

const SCALE = 3;
const FONT = '11px Arial, sans-serif';
const LINE_HEIGHT = 14;
const TEXT_BOX_MARGIN = 28;
const TEXT_PADDING = 8;

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

  // The parts of an animation's current frame. An offset is subtracted, as in k.a(int, c, ...).
  drawSprite({ sheet: sheetId, animation: animationId, x, y }) {
    const { data, time } = this.game;
    const c = this.context;
    const sheet = data.sheet(sheetId);
    const bitmap = this.bitmaps.get(sheet.image);
    if (!bitmap) return;
    const frame = frameAt(data.animation(animationId), time);
    for (const part of frame?.parts ?? []) {
      const module = sheet.modules[part.module];
      const r = sheet.rectangles[module.rectangle];
      const matrix = MIDP_MATRICES[RAW_TO_MIDP[module.transform]](r.width, r.height);
      c.save();
      c.translate(x - part.x, y - part.y);
      c.transform(...matrix);
      c.drawImage(bitmap, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
      c.restore();
    }
  }

  draw() {
    const { context: c, game } = this;
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#000';
    c.fillRect(0, 0, game.frameWidth, game.frameHeight);
    for (const sprite of game.scene()) this.drawSprite(sprite);
    if (game.fadeLevel) {
      c.fillStyle = `rgba(0, 0, 0, ${game.fadeLevel})`;
      c.fillRect(0, 0, game.frameWidth, game.frameHeight);
    }
    if (game.verbs) this.drawVerbs(game.verbs);
    if (game.currentText) this.drawTextBox(game.currentText);
    else if (!game.verbs) this.drawCursorHint();
    if (game.notPorted) this.drawNotice(game.notPorted);
  }

  drawVerbs({ x, y }) {
    const { game } = this;
    const [sheet, animation] = game.tables.cursorSprites[1];
    this.drawSprite({ sheet, animation, x, y });
  }

  wrap(text, width) {
    const c = this.context;
    c.font = FONT;
    const lines = [];
    for (const paragraph of text.split('|')) {
      let line = '';
      for (const word of paragraph.split(' ')) {
        const longer = line ? `${line} ${word}` : word;
        if (c.measureText(longer).width > width && line) {
          lines.push(line);
          line = word;
        } else line = longer;
      }
      lines.push(line);
    }
    return lines;
  }

  drawTextBox({ speaker, text }) {
    const { context: c, game } = this;
    const width = game.frameWidth - TEXT_BOX_MARGIN * 2;
    const lines = this.wrap(text, width - TEXT_PADDING * 2);
    if (speaker) lines.unshift(speaker);
    const height = lines.length * LINE_HEIGHT + TEXT_PADDING * 2;
    const y = game.frameHeight - height - TEXT_BOX_MARGIN;
    c.fillStyle = 'rgba(0, 0, 0, 0.8)';
    c.fillRect(TEXT_BOX_MARGIN, y, width, height);
    c.strokeStyle = '#888';
    c.strokeRect(TEXT_BOX_MARGIN, y, width, height);
    c.fillStyle = '#ddd';
    c.textBaseline = 'top';
    lines.forEach((line, i) => {
      c.fillText(line, TEXT_BOX_MARGIN + TEXT_PADDING, y + TEXT_PADDING + i * LINE_HEIGHT);
    });
  }

  // Words for now, in place of the cursor art, which comes with the menus and text.
  drawCursorHint() {
    const { context: c, game } = this;
    const action = game.action();
    if (!action) return;
    const label = {
      verbs: 'Interact',
      leave: 'Leave',
      stairs: 'Stairs',
      forward: 'Forward',
      'turn-left': 'Turn left',
      'turn-right': 'Turn right',
      'turn-back': 'Turn back',
    }[action.kind];
    c.font = FONT;
    c.textBaseline = 'top';
    const width = c.measureText(label).width;
    const x = Math.min(game.frameWidth - width - 2, game.cursorX + 8);
    const y = Math.max(2, game.cursorY - 16);
    c.fillStyle = 'rgba(0, 0, 0, 0.7)';
    c.fillRect(x - 2, y - 1, width + 4, LINE_HEIGHT);
    c.fillStyle = '#fff';
    c.fillText(label, x, y);
  }

  drawNotice(text) {
    const { context: c, game } = this;
    c.font = FONT;
    c.textBaseline = 'top';
    c.fillStyle = '#a00';
    c.fillRect(0, 0, game.frameWidth, LINE_HEIGHT);
    c.fillStyle = '#fff';
    c.fillText(text, 4, 1);
  }

  updateHoveredRow() {}
}
