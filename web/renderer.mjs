import { pngInfo, TRANSFORMS } from './engine/format.mjs';
import { MENU, VERB_WHEEL_RADIUS, verbWheelCenter } from './engine/game.mjs';
import { parsePaletteIndex, recolorPng } from './engine/palettes.mjs';
import { PIXEL_FONT_CAP_HEIGHT, pixelFontGlyph } from './pixel-font.mjs';

const SCALE = 3;
const FONT_SIZE = 10;
const LINE_HEIGHT = 12;
const FONT = `${FONT_SIZE}px system-ui, sans-serif`;
const BOLD_FONT = `600 ${FONT}`;
const SAY_LINES = 4;
const ARROW_BLINK_MS = 600;
const ITEM_SIZE = 32;
const IMAGE_SECTION = 35;
const ARROW_REACH = 6;
const FLOOR_MARKER_GAP = 10;
// Text the bitmap font has no letters for, such as Chinese in a fan translation, is
// drawn in this, and any pixel of it that's solid enough stays.
const PIXEL_FONT = '12px Arial, Helvetica, sans-serif';
const PIXEL_FONT_ASCENT = 10;
const PIXEL_GLYPH_THRESHOLD = 90;
const PIXEL_GLYPH_CACHE_SIZE = 2000;
const PIXEL_GLYPH_HEIGHT = 24;
const PIXEL_GLYPH_DESCENT = 7;
const PIXEL_GLYPH_MARGIN = 2;

// From ExtBase.menuPaintEngine and Ext's constants.
const ENGINE_PAPER = 0xeae2b2;
const ENGINE_SELECTED = 0x7c7462;
const ENGINE_PADDING = 4;
const ENGINE_ROW = 14;
const ENGINE_ROW_GAP = 2;
const ENGINE_TEXT_STEP = 14;
const ENGINE_TOP_GAP = 10;
// The original's screen is taller than this port's, so its logo and splash art sit
// closer together here, and in a wider gap. These fit them exactly.
const LOGO_TOP = 2;
const SPLASH_DROP = 7;
const RIGHTS_FROM_BOTTOM = 28;

const css = (color) => `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;

// Where a menu's paper starts. It's centered, or under the logo if that's lower, which
// Mobile 2's tall logo on its short screen here needs. The notepad's border sits outside
// the paper, so it has to clear the logo too. A menu too tall to fit under it stays on screen.
export function engineMenuTop({ roomHeight, height, logoHeight, borderTop, borderBottom }) {
  const belowLogo = LOGO_TOP + logoHeight + borderTop;
  const lowest = roomHeight - height - borderBottom;
  return Math.max((roomHeight - height) >> 1, Math.min(belowLogo, lowest));
}

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.context = canvas.getContext('2d');
    // Silent Hill's smaller art is scaled to fill its canvas, and larger art isn't scaled down.
    this.scale = game.frameWidth > 256 ? SCALE : (SCALE * 256) / game.frameWidth;
    canvas.width = Math.round(game.frameWidth * this.scale);
    canvas.height = Math.round(game.frameHeight * this.scale);
    this.images = new Map();
    this.art = new Map();
    this.pixelGlyphs = new Map();
  }

  // With the Pixel font setting, text is drawn at the room's own resolution from the
  // bitmap font in pixel-font.mjs, and then scaled up with the art.
  get font() {
    return this.game.pixelFont ? PIXEL_FONT : FONT;
  }

  get boldFont() {
    return this.game.pixelFont ? `600 ${PIXEL_FONT}` : BOLD_FONT;
  }

  capHeight() {
    return this.game.pixelFont ? PIXEL_FONT_CAP_HEIGHT : this.context.measureText('H').actualBoundingBoxAscent;
  }

  fillText(text, x, y) {
    const c = this.context;
    if (!this.game.pixelFont) {
      c.fillText(text, x, y);
      return;
    }
    const width = this.textWidth(text);
    let left = Math.round(c.textAlign === 'center' ? x - width / 2 : c.textAlign === 'right' ? x - width : x);
    const baseline = Math.round(
      c.textBaseline === 'top'
        ? y + PIXEL_FONT_ASCENT
        : c.textBaseline === 'middle'
          ? y + PIXEL_FONT_CAP_HEIGHT / 2
          : y,
    );
    for (const character of text) {
      const glyph = this.pixelGlyph(character);
      if (glyph.canvas) c.drawImage(glyph.canvas, left + glyph.left, baseline - glyph.baseline);
      left += glyph.advance;
    }
  }

  textWidth(text) {
    if (!this.game.pixelFont) return this.context.measureText(text).width;
    let width = 0;
    for (const character of text) width += this.pixelGlyph(character).advance;
    return width;
  }

  pixelGlyph(character) {
    const c = this.context;
    const key = `${c.font}|${c.fillStyle}|${character}`;
    let glyph = this.pixelGlyphs.get(key);
    if (!glyph) {
      if (this.pixelGlyphs.size >= PIXEL_GLYPH_CACHE_SIZE) this.pixelGlyphs.clear();
      glyph = this.bitmapGlyph(character) ?? this.thresholdGlyph(character);
      this.pixelGlyphs.set(key, glyph);
    }
    return glyph;
  }

  bitmapGlyph(character) {
    const c = this.context;
    const found = pixelFontGlyph(character);
    if (!found) return null;
    const bold = c.font.startsWith('600') ? 1 : 0;
    const advance = found.left + found.width + bold + found.right;
    if (!found.rows.length) return { canvas: null, left: 0, baseline: 0, advance };

    const canvas = document.createElement('canvas');
    canvas.width = found.width + bold;
    canvas.height = found.rows.length;
    const pixels = canvas.getContext('2d');
    pixels.fillStyle = c.fillStyle;
    found.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === '#') pixels.fillRect(x, y, 1 + bold, 1);
    });
    return { canvas, left: found.left, baseline: found.rows.length - found.descent, advance };
  }

  thresholdGlyph(character) {
    const c = this.context;
    const width = c.measureText(character).width;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width) + PIXEL_GLYPH_MARGIN * 2;
    canvas.height = PIXEL_GLYPH_HEIGHT;
    const baseline = PIXEL_GLYPH_HEIGHT - PIXEL_GLYPH_DESCENT;
    const pixels = canvas.getContext('2d', { willReadFrequently: true });
    pixels.font = c.font;
    pixels.fillText(character, PIXEL_GLYPH_MARGIN, baseline);
    const image = pixels.getImageData(0, 0, canvas.width, canvas.height);
    for (let alpha = 3; alpha < image.data.length; alpha += 4)
      image.data[alpha] = image.data[alpha] >= PIXEL_GLYPH_THRESHOLD ? 255 : 0;
    pixels.putImageData(image, 0, 0);
    pixels.globalCompositeOperation = 'source-in';
    pixels.fillStyle = c.fillStyle;
    pixels.fillRect(0, 0, canvas.width, canvas.height);
    return { canvas, left: -PIXEL_GLYPH_MARGIN, baseline, advance: Math.max(1, Math.round(width)) };
  }

  async loadImages({ dataDir, entries, files }) {
    const bitmap = (bytes) => createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    await Promise.all(
      [...files]
        .filter(([name]) => name.startsWith('gfx/') && name.endsWith('.png'))
        .map(async ([name, bytes]) => {
          this.art.set(name, await bitmap(bytes));
        }),
    );

    const prefix = `${dataDir}/gfx/transform0/`;
    await Promise.all(
      [...entries]
        .filter(([name]) => name.startsWith(prefix) && name.endsWith('.png'))
        .map(async ([name, bytes]) => {
          this.images.set(name.slice(prefix.length, -4), { bitmap: await bitmap(bytes), info: pngInfo(bytes) });
        }),
    );

    await this.loadPalettes({ entries, files, prefix });

    // Border thicknesses come from the art's registration points, per
    // ExtBase.updateSystemResourceValues.
    const info = (id) => this.images.get(id)?.info;
    if (info('corner_top_left')) {
      this.borderLeft = info('corner_top_left').regX;
      this.borderRight = info('corner_top_right').width - info('corner_top_right').regX;
      this.borderTop = Math.max(info('border_top').regY, info('corner_top_left').regY, info('corner_top_right').regY);
      this.borderBottom = Math.max(
        info('border_bottom').height,
        info('corner_bottom_left').height - info('corner_bottom_left').regY,
        info('corner_bottom_right').height - info('corner_bottom_right').regY,
      );
    }
  }

  // Mobile 2's recolored images, keyed by name and palette. They're made ahead of time
  // because a browser decodes images asynchronously, and a frame has to draw now.
  async loadPalettes({ entries, files, prefix }) {
    const index = files.get('plts/palettes.pdt');
    const bank = files.get('plts/palettes.bin');
    if (!index || !bank) return;
    const jobs = [];
    for (const [name, offsets] of parsePaletteIndex(index)) {
      const png = entries.get(`${prefix}${name}.png`);
      if (!png) continue;
      offsets.forEach((offset, position) => {
        const recolored = recolorPng(png, bank, offset);
        if (!recolored) return;
        jobs.push(
          createImageBitmap(new Blob([recolored], { type: 'image/png' })).then((bitmap) => {
            this.images.set(`${name}#${position + 1}`, { bitmap, info: pngInfo(png) });
          }),
        );
      });
    }
    await Promise.all(jobs);
  }

  // An image, in the colors the game gives it right now.
  image(id) {
    const palette = this.game.imagePalette(id);
    return (palette && this.images.get(`${id}#${palette}`)) || this.images.get(String(id));
  }

  draw() {
    const { context: c, game } = this;
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    c.imageSmoothingEnabled = false;
    if (game.mainMenu) {
      this.drawMainMenu(game.mainMenu);
      return;
    }
    // A room narrower than the frame sits in the middle of it.
    if (game.viewOffsetX || game.viewOffsetY) {
      c.fillStyle = '#000';
      c.fillRect(0, 0, game.frameWidth, game.frameHeight);
      c.translate(game.viewOffsetX, game.viewOffsetY);
    }
    if (game.transitionKeepsOldRoom) {
      this.drawDissolvePattern();
      return;
    }
    c.fillStyle = css(game.backgroundColor);
    c.fillRect(0, 0, game.roomWidth, game.roomHeight);

    // The original's room is an image of the room's size, so art can't show outside it.
    c.save();
    c.beginPath();
    c.rect(0, 0, game.roomWidth, game.roomHeight);
    c.clip();
    for (const item of game.drawList()) this.drawItem(item);
    c.restore();

    const menu = game.menus.at(-1);
    if (menu) this.drawMenu(menu);
    else {
      this.drawRoomMessage(game.roomMessage());
      this.drawCursor(game.cursorView());
    }
    if (game.popups.length) this.drawPopup(game.popups[0]);
  }

  // Mobile 2 names the floor in the middle of the room as stairs and elevators arrive there.
  drawRoomMessage(text) {
    if (!text) return;
    const { context: c, game } = this;
    c.font = this.boldFont;
    this.outlinedText(text, game.roomWidth >> 1, game.roomHeight >> 1, 'center');
  }

  drawItem(item) {
    const { context: c, game } = this;
    if (item.kind === 'dissolve-pattern') {
      this.drawDissolvePattern();
    } else if (item.kind === 'tiled-image') {
      this.tile(item.id);
    } else if (item.kind === 'line') {
      c.strokeStyle = css(item.color);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(item.x1, item.y1);
      c.lineTo(item.x2, item.y2);
      c.stroke();
    } else if (item.kind === 'compass-letters') {
      const letters = this.art.get(`gfx/HUD_NESW_${game.language}.png`);
      if (letters) c.drawImage(letters, item.x - (letters.width >> 1), item.y - (letters.height >> 1));
    } else if (item.clip) {
      c.save();
      c.beginPath();
      c.rect(item.clip.x, item.clip.y, item.clip.width, item.clip.height);
      c.clip();
      const image = this.images.get(String(item.id));
      if (image) c.drawImage(image.bitmap, item.x, item.y);
      c.restore();
    } else if (item.kind === 'rect') {
      c.fillStyle = css(item.color);
      c.fillRect(item.x, item.y, item.width, item.height);
    } else if (item.kind === 'text') {
      c.font = this.font;
      c.fillStyle = css(item.color);
      c.textBaseline = 'middle';
      c.textAlign = ['left', 'center', 'right'][item.alignment] ?? 'left';
      this.fillText(item.text, item.x + [0, 15, 30][item.alignment], item.y + item.height / 2);
    } else if (item.raw) {
      const image = this.image(item.id);
      if (image) c.drawImage(image.bitmap, item.x, item.y);
    } else {
      this.drawImage(item.id, item.x, item.y, item.transform);
    }
  }

  drawDissolvePattern() {
    this.tile('dissolveEffectImg');
  }

  tile(id) {
    const { game } = this;
    const image = this.images.get(String(id));
    if (!image) return;
    for (let x = 0; x < game.roomWidth; x += image.info.width) {
      for (let y = 0; y < game.roomHeight; y += image.info.height) this.context.drawImage(image.bitmap, x, y);
    }
  }

  // Places a sprite by its registration point and transform, per M.getLeft and M.getTop.
  drawImage(id, x, y, transformIndex = 0) {
    const image = this.image(id);
    if (!image) return;
    const c = this.context;
    const { width, height, regX, regY } = image.info;
    const transform = TRANSFORMS[transformIndex];
    const left = x - transform.left(width, height, regX, regY);
    const top = y - transform.top(width, height, regX, regY);
    c.save();
    c.translate(left, top);
    c.transform(...transform.matrix(width, height));
    c.drawImage(image.bitmap, 0, 0);
    c.restore();
  }

  drawCentered(id, x, y) {
    const image = this.images.get(String(id));
    if (image) this.context.drawImage(image.bitmap, x - (image.info.width >> 1), y - (image.info.height >> 1));
  }

  drawCursor(view) {
    if (!view) return;
    const { game } = this;
    const { x } = view;
    this.drawImage(view.id, x, view.y);
    if (view.hint) {
      const c = this.context;
      c.font = this.font;
      c.textBaseline = 'top';
      const width = this.textWidth(view.hint);
      const hintX = Math.max(2, Math.min(game.roomWidth - width - 2, x - width / 2));
      const hintY = view.y + 14 > game.roomHeight - LINE_HEIGHT ? view.y - 26 : view.y + 14;
      this.outlinedText(view.hint, hintX, hintY, 'left');
    }
  }

  // Port of Ext.popupPaint: a notepad page sized to its text, in the middle of the screen.
  drawPopup(text) {
    const c = this.context;
    const { game } = this;
    c.font = this.font;
    const lines = this.wrap(text, game.roomWidth - this.borderLeft - this.borderRight - ENGINE_PADDING * 2);
    const step = ENGINE_ROW + ENGINE_ROW_GAP;
    const width = Math.ceil(Math.max(...lines.map((line) => this.textWidth(line)))) + ENGINE_PADDING * 2;
    const height = lines.length * step - ENGINE_ROW_GAP + ENGINE_PADDING * 2;
    const x = (game.roomWidth - width) >> 1;
    const y = (game.roomHeight - height) >> 1;
    this.notepad(x, y, width, height);
    c.textAlign = 'left';
    c.fillStyle = css(game.menuTextColor);
    lines.forEach((line, index) => {
      this.rowText(line, x + ENGINE_PADDING, y + ENGINE_PADDING + index * step, ENGINE_ROW);
    });
  }

  outlinedText(text, x, y, align) {
    const c = this.context;
    c.textAlign = align;
    c.textBaseline = 'top';
    c.fillStyle = '#000';
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      this.fillText(text, x + dx, y + dy);
    c.fillStyle = '#fff';
    this.fillText(text, x, y);
  }

  wrap(text, width) {
    const lines = [];
    for (const paragraph of String(text).split('\n')) {
      let line = '';
      for (const word of paragraph.split(' ')) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && this.textWidth(candidate) > width) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  // Port of ExtBase.menuPaintIngameImageBorders: the notepad page's edges, tiled
  // around a paper-colored box, with its punched holes down the left.
  notepad(x, y, width, height, color = this.game.menuColor) {
    const c = this.context;
    c.fillStyle = css(color);
    c.fillRect(x, y, width, height);
    const tile = (id, step, count, place) => {
      const image = this.images.get(id);
      if (!image) return;
      for (let i = 0; i < count; i += image.info[step]) place(id, i);
    };
    c.save();
    c.beginPath();
    c.rect(x, 0, width, this.game.roomHeight);
    c.clip();
    tile('border_top', 'width', width, (id, i) => this.drawImage(id, x + i, y));
    tile('border_bottom', 'width', width, (id, i) => this.drawImage(id, x + i, y + height));
    c.restore();
    c.save();
    c.beginPath();
    c.rect(0, y, this.game.roomWidth, height);
    c.clip();
    tile('border_left', 'height', height, (id, i) => this.drawImage(id, x, y + i));
    tile('border_right', 'height', height, (id, i) => this.drawImage(id, x + width, y + i));
    c.restore();
    this.drawImage('corner_top_left', x, y);
    this.drawImage('corner_top_right', x + width, y);
    this.drawImage('corner_bottom_left', x, y + height);
    this.drawImage('corner_bottom_right', x + width, y + height);
  }

  delimiter(x, y, width) {
    const c = this.context;
    c.save();
    c.beginPath();
    c.rect(x, 0, width, this.game.roomHeight);
    c.clip();
    const image = this.images.get('delimiter');
    if (image) for (let i = 0; i < width; i += image.info.width) c.drawImage(image.bitmap, x + i, y);
    c.restore();
  }

  get delimiterHeight() {
    return this.images.get('delimiter')?.info.height ?? 1;
  }

  // Centers a line in a row by its capital letters, whose height is measured because
  // a font's own metrics place text differently from browser to browser.
  rowText(text, x, rowY, rowHeight) {
    const c = this.context;
    c.textBaseline = 'alphabetic';
    const capHeight = this.capHeight();
    this.fillText(text, x, rowY + (rowHeight + capHeight) / 2);
    c.textBaseline = 'top';
  }

  // A page across the bottom of the room, sized to what it holds.
  bottomPage(contentHeight) {
    const { game } = this;
    const width = game.roomWidth - this.borderLeft - this.borderRight;
    const height = contentHeight + game.menuMargin * 2;
    return {
      x: this.borderLeft,
      y: Math.max(this.borderTop, game.roomHeight - this.borderBottom - height),
      width,
      height,
    };
  }

  // The layout follows ExtBase.menuPaintIngame: the speaker's name, a ruled line, and
  // the text, all in the speaker's color. Long text scrolls by line, as in the original,
  // and a click also moves on by a whole box before it closes the text.
  drawSay(menu) {
    const c = this.context;
    const { game } = this;
    const { menuMargin: margin, menuLineSpacing: spacing } = game;
    const step = LINE_HEIGHT + spacing;
    const arrow = this.images.get('arrow_down');
    const textWidth = game.roomWidth - this.borderLeft - this.borderRight - margin * 3 - (arrow?.info.width ?? 0);
    c.font = this.font;
    const lines = this.wrap(menu.text, textWidth);
    const fullLines = Math.floor((game.roomHeight - this.borderTop - this.borderBottom - margin * 2 + spacing) / step);
    const pageLines = menu.fullPage ? fullLines : SAY_LINES;
    menu.pageLines = pageLines;
    menu.maxScroll = Math.max(0, lines.length - pageLines);
    const shown = lines.slice(menu.scroll, menu.scroll + pageLines);
    const headerHeight = menu.speaker ? LINE_HEIGHT + margin + this.delimiterHeight + margin : 0;
    const page = this.bottomPage(
      headerHeight + (menu.fullPage ? pageLines : Math.min(lines.length, pageLines)) * step - spacing,
    );
    this.notepad(page.x, page.y, page.width, page.height);

    const textX = page.x + margin;
    let y = page.y + margin;
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = css(game.speakerColor(menu.speaker));
    if (menu.speaker) {
      this.fillText(menu.speaker, textX, y);
      y += LINE_HEIGHT + margin;
      this.delimiter(page.x, y, page.width);
      y += this.delimiterHeight + margin;
    }
    const up = this.images.get('arrow_up');
    if (up && menu.scroll > 0) c.drawImage(up.bitmap, page.x + page.width - margin - up.info.width, y);
    for (const line of shown) {
      this.fillText(line, textX, y);
      y += step;
    }
    if (arrow && menu.scroll < menu.maxScroll && Math.floor(performance.now() / ARROW_BLINK_MS) % 2 === 0) {
      c.drawImage(
        arrow.bitmap,
        page.x + page.width - margin - arrow.info.width,
        page.y + page.height - margin - arrow.info.height,
      );
    }
  }

  drawReceived(menu) {
    const c = this.context;
    const { game } = this;
    const margin = game.menuMargin;
    const image = this.images.get(String(menu.image));
    const imageSpace = image ? 32 + margin : 0;
    c.font = this.font;
    const lines = this.wrap(menu.text, 150);
    const textWidth = Math.max(...lines.map((line) => this.textWidth(line)));
    const width = Math.round(textWidth + imageSpace + margin * 2);
    const height = Math.max(lines.length * (LINE_HEIGHT + game.menuLineSpacing), imageSpace ? 32 : 0) + margin * 2;
    const x = (game.roomWidth - width) >> 1;
    const y = (game.roomHeight - height) >> 1;
    this.notepad(x, y, width, height);
    if (image)
      c.drawImage(image.bitmap, x + margin + ((32 - image.info.width) >> 1), y + ((height - image.info.height) >> 1));
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = css(game.menuTextColor);
    lines.forEach((line, index) => {
      this.fillText(line, x + margin + imageSpace, y + margin + index * (LINE_HEIGHT + game.menuLineSpacing));
    });
  }

  drawTextFade(menu) {
    const c = this.context;
    const { game } = this;
    c.font = this.font;
    const lines = this.wrap(menu.text, (game.roomWidth * 3) >> 2);
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillStyle = css(menu.color);
    const top = (game.roomHeight - lines.length * LINE_HEIGHT) / 2;
    lines.forEach((line, index) => {
      this.fillText(line, game.roomWidth / 2, top + index * LINE_HEIGHT);
    });
  }

  drawVerbs(menu) {
    const { game } = this;
    const c = this.context;
    const center = verbWheelCenter(menu, game.roomWidth, game.roomHeight);
    c.font = this.boldFont;
    const nameWidth = this.textWidth(menu.name);
    const nameX = Math.max(nameWidth / 2 + 2, Math.min(game.roomWidth - nameWidth / 2 - 2, center.x));
    this.outlinedText(menu.name, nameX, center.y - VERB_WHEEL_RADIUS - 14, 'center');
    this.drawCentered('OMS_menu', center.x, center.y);
    if (menu.selected !== null && menu.selected !== undefined) {
      const [dx, dy] = game.constructor.WHEEL_ARMS[menu.selected];
      this.drawCentered('OMS_selected', center.x + dx, center.y + dy);
    }
    this.drawCentered('OMS_symbols', center.x + game.constructor.WHEEL_SYMBOLS_X, center.y);
    this.drawImage('cursorIdle', game.cursorX, game.cursorY);
  }

  // Choices sit on a page at the bottom of the room, with their title above a ruled
  // line, and the current row highlighted.
  drawList(menu, title, rows) {
    const c = this.context;
    const { game } = this;
    const { menuMargin: margin, menuLineSpacing: spacing } = game;
    const step = LINE_HEIGHT + spacing + 2;
    const titleHeight = title ? LINE_HEIGHT + margin + this.delimiterHeight : 0;
    const page = this.bottomPage(titleHeight + rows.length * step);
    this.notepad(page.x, page.y, page.width, page.height);
    const color = css(game.speakerColor(title));
    const rowsTop = page.y + margin + titleHeight;
    menu.rows = rows.map((_, index) => ({ x: page.x, y: rowsTop + index * step, width: page.width, height: step }));
    this.updateHoveredRow();

    c.textBaseline = 'top';
    c.textAlign = 'left';
    c.font = this.font;
    if (title) {
      c.fillStyle = color;
      this.fillText(title, page.x + margin, page.y + margin);
      this.delimiter(page.x, page.y + margin + LINE_HEIGHT + (margin >> 1), page.width);
    }
    rows.forEach((row, index) => {
      const rect = menu.rows[index];
      if (menu.selected === index) {
        c.fillStyle = css(game.menuSelectedColor);
        c.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
      c.fillStyle = color;
      this.rowText(row, rect.x + margin, rect.y, rect.height);
      const marker = this.art.get('gfx/map_cursor.png');
      if (marker && index === game.currentFloorRow()) {
        c.drawImage(
          marker,
          Math.round(rect.x + margin + this.textWidth(row) + FLOOR_MARKER_GAP),
          rect.y + ((rect.height - marker.height) >> 1),
        );
      }
    });
    this.drawImage('cursorIdle', game.cursorX, game.cursorY);
  }

  // The original's pause menu sits in the bottom right corner of the screen.
  drawPause(menu) {
    const c = this.context;
    const { game } = this;
    const { menuMargin: margin, menuLineSpacing: spacing } = game;
    const step = LINE_HEIGHT + spacing;
    const width = menu.title ? (game.roomWidth * 3) >> 2 : game.roomWidth >> 1;
    c.font = this.font;
    const titleLines = menu.title ? this.wrap(menu.title, width - margin * 2) : [];
    const titleHeight = titleLines.length ? titleLines.length * step + margin + this.delimiterHeight + margin : 0;
    const height = titleHeight + menu.choices.length * step - spacing + margin * 2;
    const x = game.roomWidth - width - this.borderRight;
    const y = game.roomHeight - height - this.borderBottom;
    this.notepad(x, y, width, height);

    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = css(game.menuTextColor);
    titleLines.forEach((line, index) => {
      this.fillText(line, x + margin, y + margin + index * step);
    });
    if (titleLines.length) this.delimiter(x, y + margin + titleLines.length * step + (margin >> 1), width);
    const rowsTop = y + margin + titleHeight;
    menu.rows = menu.choices.map((_, index) => ({
      x,
      y: rowsTop + index * step - (spacing >> 1),
      width,
      height: step,
    }));
    this.updateHoveredRow();
    menu.choices.forEach(({ text }, index) => {
      const rowY = rowsTop + index * step;
      if (menu.selected === index) {
        c.fillStyle = css(game.menuSelectedColor);
        c.fillRect(x, rowY, width, LINE_HEIGHT);
      }
      c.fillStyle = css(game.menuTextColor);
      this.rowText(text, x + margin, rowY, LINE_HEIGHT);
    });
    this.drawImage('cursorIdle', game.cursorX, game.cursorY);
  }

  // Port of ExtBase.inventoryMenuPaint and menuUpdateIngame's layout for this menu:
  // the item's name, its picture between arrows, then what can be done with it.
  drawInventory(menu) {
    const c = this.context;
    const { game } = this;
    const { menuMargin: margin, menuLineSpacing: spacing } = game;
    const step = LINE_HEIGHT + spacing;
    const delimiter = this.delimiterHeight;
    const width = game.roomWidth >> 1;
    c.font = this.font;
    const titleLines = this.wrap(menu.title, width - margin * 2);
    const textHeight = titleLines.length * step - spacing;
    const choicesHeight = menu.choices.length * step - spacing;

    const delimiter1 = margin + textHeight + margin;
    const imageTop = delimiter1 + delimiter;
    const delimiter2 = margin + textHeight + IMAGE_SECTION + delimiter + margin + 3;
    const choicesTop = margin + textHeight + IMAGE_SECTION + delimiter + margin * 2 + delimiter + 3;
    const height = choicesTop + choicesHeight + margin;

    // Centered on the cursor, kept on screen and clear of the health display.
    const life = this.images.get('HUD_life')?.info.height ?? 0;
    const x = Math.max(this.borderLeft, Math.min(game.roomWidth - width - this.borderRight, menu.x - (width >> 1)));
    const lowest = game.roomHeight - height - this.borderBottom;
    const y = Math.max(10 + life + this.borderTop, Math.min(lowest, menu.y - (height >> 1)));
    this.notepad(x, y, width, height);

    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = css(game.menuTextColor);
    titleLines.forEach((line, index) => {
      this.fillText(line, x + margin, y + margin + index * step);
    });
    this.delimiter(x, y + delimiter1, width);
    this.delimiter(x, y + delimiter2, width);

    const centerX = x + (width >> 1);
    const imageY = y + imageTop + 3;
    this.drawCentered(menu.image, centerX, imageY + (ITEM_SIZE >> 1));
    menu.arrows = [];
    if (menu.items.length > 1) {
      const place = (id, left, step_) => {
        const image = this.images.get(id);
        if (!image) return;
        const arrowY = imageY + ((ITEM_SIZE - image.info.height) >> 1);
        const arrowX = left ? centerX - (ITEM_SIZE >> 1) - 3 - image.info.width : centerX + (ITEM_SIZE >> 1) + 3;
        c.drawImage(image.bitmap, arrowX, arrowY);
        menu.arrows.push({
          x: arrowX - ARROW_REACH,
          y: imageY,
          width: image.info.width + ARROW_REACH * 2,
          height: ITEM_SIZE,
          step: step_,
        });
      };
      place('inv_arrowLeft', true, -1);
      place('inv_arrowRight', false, 1);
    }

    menu.page = {
      x: x - this.borderLeft,
      y: y - this.borderTop,
      width: width + this.borderLeft + this.borderRight,
      height: height + this.borderTop + this.borderBottom,
    };
    menu.rows = menu.choices.map((_, index) => ({
      x,
      y: y + choicesTop + index * step - (spacing >> 1),
      width,
      height: step,
    }));
    this.updateHoveredRow();
    menu.choices.forEach(({ text }, index) => {
      const rowY = y + choicesTop + index * step;
      if (menu.selected === index) {
        c.fillStyle = css(game.menuSelectedColor);
        c.fillRect(x, rowY, width, LINE_HEIGHT);
      }
      c.fillStyle = css(game.menuTextColor);
      this.rowText(text, x + margin, rowY, LINE_HEIGHT);
    });
    this.drawImage('cursorIdle', game.cursorX, game.cursorY);
  }

  drawMenu(menu) {
    switch (menu.id) {
      case MENU.SAY:
        this.drawSay(menu);
        break;
      case MENU.RECEIVED:
        this.drawReceived(menu);
        break;
      case MENU.TEXT_FADE:
        this.drawTextFade(menu);
        break;
      case MENU.VERBS:
        this.drawVerbs(menu);
        break;
      case MENU.CHOICE:
        this.drawList(
          menu,
          menu.title,
          menu.choices.map(({ text }) => text),
        );
        break;
      case MENU.INVENTORY:
        this.drawInventory(menu);
        break;
      case MENU.PAUSE:
        this.drawPause(menu);
        break;
      default:
    }
  }

  // The logo, splash and menu screens, from ExtBase.logoPaint, splashPaint and menuPaintEngine.
  drawMainMenu(mainMenu) {
    const c = this.context;
    const { game } = this;
    const { screen } = mainMenu;
    if (screen?.kind === 'logo') {
      c.fillStyle = '#fff';
      c.fillRect(0, 0, game.roomWidth, game.roomHeight);
      const logo = this.art.get('gfx/konami_logo.png');
      c.globalAlpha = screen.alpha / 255;
      c.drawImage(logo, (game.roomWidth >> 1) + 5 - (logo.width >> 1), (game.roomHeight - logo.height) >> 1);
      c.globalAlpha = 1;
      return;
    }
    c.fillStyle = css(screen?.kind === 'splash' ? screen.color : 0);
    c.fillRect(0, 0, game.roomWidth, game.roomHeight);
    const { SPLASH_CENTERED, SPLASH_OVER_LOGO } = game.constructor;
    const logo = () => this.drawArtCentered('gfx/menu_logo.png', LOGO_TOP);
    if (screen?.kind !== 'splash' || SPLASH_OVER_LOGO) logo();
    if (screen?.kind === 'splash') {
      this.drawArtCentered('gfx/konami_right.png', game.roomHeight - RIGHTS_FROM_BOTTOM);
      const image = this.art.get(screen.image);
      if (image) {
        const x = SPLASH_CENTERED ? (game.roomWidth - image.width) >> 1 : 0;
        c.drawImage(image, x, ((game.roomHeight - image.height) >> 1) + SPLASH_DROP);
      }
      if (!SPLASH_OVER_LOGO) logo();
      return;
    }
    const menu = mainMenu.current;
    if (menu.kind === 'text') this.drawTextPage(menu);
    else this.drawEngineMenu(menu);
    this.drawImage('cursorIdle', game.cursorX, game.cursorY);
  }

  drawArtCentered(name, y) {
    const image = this.art.get(name);
    if (image) this.context.drawImage(image, (this.game.roomWidth - image.width) >> 1, y);
  }

  drawEngineMenu(menu) {
    const c = this.context;
    const { game } = this;
    c.font = this.font;
    const maxWidth = (game.roomWidth * 4) / 5 - ENGINE_PADDING * 2;
    const titleLines = menu.title ? this.wrap(menu.title, maxWidth) : [];
    const widest = Math.max(
      ...[...titleLines, ...menu.choices.flatMap(({ text, values }) => values ?? [text])].map((text) =>
        this.textWidth(text),
      ),
    );
    const titleHeight = titleLines.length * ENGINE_TEXT_STEP;
    const rowsHeight = menu.choices.length * (ENGINE_ROW + ENGINE_ROW_GAP) - ENGINE_ROW_GAP;
    const width = Math.ceil(widest) + ENGINE_PADDING * 2;
    const height = rowsHeight + ENGINE_PADDING * 2 + (titleHeight ? titleHeight + ENGINE_TOP_GAP : 0);
    const x = (game.roomWidth - width) >> 1;
    const y = engineMenuTop({
      roomHeight: game.roomHeight,
      height,
      logoHeight: this.art.get('gfx/menu_logo.png')?.height ?? 0,
      borderTop: this.borderTop,
      borderBottom: this.borderBottom,
    });
    this.notepad(x, y, width, height, ENGINE_PAPER);

    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = '#000';
    titleLines.forEach((line, index) => {
      this.fillText(line, x + ENGINE_PADDING, y + ENGINE_PADDING + index * ENGINE_TEXT_STEP);
    });
    const rowsTop = y + ENGINE_PADDING + (titleHeight ? titleHeight + ENGINE_TOP_GAP : 0);
    menu.rows = menu.choices.map((_, index) => ({
      x,
      y: rowsTop + index * (ENGINE_ROW + ENGINE_ROW_GAP),
      width,
      height: ENGINE_ROW,
    }));
    this.updateHoveredRow();
    menu.choices.forEach(({ text }, index) => {
      const rect = menu.rows[index];
      if (menu.selected === index) {
        c.fillStyle = css(ENGINE_SELECTED);
        c.fillRect(rect.x, rect.y, rect.width, rect.height);
      }
      c.fillStyle = '#000';
      this.rowText(text, rect.x + ENGINE_PADDING, rect.y, rect.height);
    });
  }

  // A page that fills the screen, with arrows when there's more to scroll to.
  drawTextPage(menu) {
    const c = this.context;
    const { game } = this;
    const x = this.borderLeft;
    const y = this.borderTop;
    const width = game.roomWidth - this.borderLeft - this.borderRight;
    const height = game.roomHeight - this.borderTop - this.borderBottom;
    this.notepad(x, y, width, height, ENGINE_PAPER);
    const up = this.images.get('arrow_up');
    const down = this.images.get('arrow_down');
    c.font = this.font;
    const lines = this.wrap(menu.text, width - ENGINE_PADDING * 3 - (down?.info.width ?? 0));
    menu.pageLines = Math.max(1, Math.floor((height - ENGINE_PADDING * 2) / ENGINE_TEXT_STEP));
    menu.maxScroll = Math.max(0, lines.length - menu.pageLines);
    menu.scroll = Math.min(menu.scroll, menu.maxScroll);
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = '#000';
    lines.slice(menu.scroll, menu.scroll + menu.pageLines).forEach((line, index) => {
      this.fillText(line, x + ENGINE_PADDING, y + ENGINE_PADDING + index * ENGINE_TEXT_STEP);
    });

    menu.arrows = [];
    const place = (arrow, arrowY, step) => {
      if (!arrow) return;
      const arrowX = x + width - ENGINE_PADDING - arrow.info.width;
      c.drawImage(arrow.bitmap, arrowX, arrowY);
      menu.arrows.push({
        x: arrowX - ARROW_REACH,
        y: arrowY - ARROW_REACH,
        width: arrow.info.width + ARROW_REACH * 2,
        height: arrow.info.height + ARROW_REACH * 2,
        step,
      });
    };
    if (menu.scroll > 0) place(up, y + ENGINE_PADDING, -1);
    if (menu.scroll < menu.maxScroll) place(down, y + height - ENGINE_PADDING - (down?.info.height ?? 0), 1);
    this.updateHoveredRow();
  }

  // Tells list menus which row is under the cursor, because their layout lives here.
  updateHoveredRow() {
    const { game } = this;
    const menu = game.mainMenu ? game.mainMenu.current : game.menus.at(-1);
    if (!menu?.rows) return;
    const inside = (rect) =>
      game.cursorX >= rect.x &&
      game.cursorX < rect.x + rect.width &&
      game.cursorY >= rect.y &&
      game.cursorY < rect.y + rect.height;
    const index = menu.rows.findIndex(inside);
    menu.hovered = index === -1 ? null : index;
    if (menu.arrows) menu.hoveredArrow = menu.arrows.find(inside)?.step ?? null;
    // A resting mouse doesn't take the highlight back from the keyboard.
    const moved = game.cursorX !== this.hoverX || game.cursorY !== this.hoverY;
    this.hoverX = game.cursorX;
    this.hoverY = game.cursorY;
    if (
      (game.mainMenu || menu.id === MENU.PAUSE || menu.id === MENU.INVENTORY || menu.id === MENU.CHOICE) &&
      moved &&
      index !== -1
    )
      menu.selected = index;
    if (menu.id === MENU.INVENTORY) {
      menu.hoveredArrow = menu.arrows.find(inside)?.step ?? null;
      menu.overPage = inside(menu.page);
    }
  }
}
