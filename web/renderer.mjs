import { pngInfo, TRANSFORMS } from './engine/format.mjs';
import { MENU, VERB, VERB_WHEEL_RADIUS, verbWheelCenter } from './engine/game.mjs';

const SCALE = 3;
const FONT_SIZE = 10;
const LINE_HEIGHT = 12;
const MARGIN = 6;
const FONT = `${FONT_SIZE}px system-ui, sans-serif`;
const BOLD_FONT = `600 ${FONT}`;
const SAY_LINES = 5;
const ROW_HEIGHT = 18;

// Where the highlight goes on each arm of the verb wheel, from Ext.menuPaintOMS.
const WHEEL_ARMS = { [VERB.LOOK]: [1, -20], [VERB.HAND]: [21, -1], [VERB.MOUTH]: [0, 18], [VERB.INVENTORY]: [-20, -1] };

const css = (color) => `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.context = canvas.getContext('2d');
    this.scale = (SCALE * 256) / game.roomWidth;
    this.images = new Map();
  }

  async loadImages({ dataDir, entries, files }) {
    const letters = files.get(`gfx/HUD_NESW_${this.game.language}.png`);
    if (letters) this.compassLetters = await createImageBitmap(new Blob([letters], { type: 'image/png' }));
    const prefix = `${dataDir}/gfx/transform0/`;
    await Promise.all(
      [...entries]
        .filter(([name]) => name.startsWith(prefix) && name.endsWith('.png'))
        .map(async ([name, bytes]) => {
          const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          this.images.set(name.slice(prefix.length, -4), { bitmap, info: pngInfo(bytes) });
        }),
    );
  }

  draw() {
    const { context: c, game } = this;
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    c.imageSmoothingEnabled = false;
    c.fillStyle = css(game.backgroundColor);
    c.fillRect(0, 0, game.roomWidth, game.roomHeight);

    for (const item of game.drawList()) this.drawItem(item);

    const menu = game.menus.at(-1);
    if (menu) this.drawMenu(menu);
    else this.drawCursor(game.cursorView());
    if (game.notice) this.drawNotice(game.notice.text);
  }

  drawItem(item) {
    const c = this.context;
    if (item.kind === 'compass-letters') {
      if (this.compassLetters)
        c.drawImage(
          this.compassLetters,
          item.x - (this.compassLetters.width >> 1),
          item.y - (this.compassLetters.height >> 1),
        );
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
      c.font = FONT;
      c.fillStyle = css(item.color);
      c.textBaseline = 'middle';
      c.textAlign = ['left', 'center', 'right'][item.alignment] ?? 'left';
      c.fillText(item.text, item.x + [0, 15, 30][item.alignment], item.y + item.height / 2);
    } else if (item.raw) {
      const image = this.images.get(String(item.id));
      if (image) c.drawImage(image.bitmap, item.x, item.y);
    } else {
      this.drawImage(item.id, item.x, item.y, item.transform);
    }
  }

  // Places a sprite by its registration point and transform, per M.getLeft and M.getTop.
  drawImage(id, x, y, transformIndex = 0) {
    const image = this.images.get(String(id));
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
    this.drawImage(view.id, view.x, view.y);
    if (view.hint) {
      const c = this.context;
      c.font = FONT;
      c.textBaseline = 'top';
      const width = c.measureText(view.hint).width;
      const x = Math.max(2, Math.min(game.roomWidth - width - 2, game.cursorX - width / 2));
      const y = game.cursorY + 14 > game.roomHeight - LINE_HEIGHT ? game.cursorY - 26 : game.cursorY + 14;
      this.outlinedText(view.hint, x, y, 'left');
    }
  }

  drawNotice(text) {
    this.context.font = BOLD_FONT;
    this.outlinedText(text, this.game.roomWidth / 2, 24, 'center');
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
      c.fillText(text, x + dx, y + dy);
    c.fillStyle = '#fff';
    c.fillText(text, x, y);
  }

  wrap(text, width) {
    const c = this.context;
    const lines = [];
    for (const paragraph of String(text).split('\n')) {
      let line = '';
      for (const word of paragraph.split(' ')) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && c.measureText(candidate).width > width) {
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

  panel(x, y, width, height) {
    const c = this.context;
    c.fillStyle = css(this.game.menuColor);
    c.fillRect(x, y, width, height);
    c.strokeStyle = '#000';
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  }

  drawMenu(menu) {
    switch (menu.id) {
      case MENU.SAY:
      case MENU.POPUP:
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
        this.drawList(
          menu,
          null,
          menu.items.map(({ name, size }) => (size > 1 ? `${name} (${size})` : name)),
        );
        break;
      case MENU.ITEM_ACTIONS:
        this.drawList(
          menu,
          menu.title,
          menu.choices.map(({ text }) => text),
        );
        break;
      default:
    }
  }

  // Long text pages, where the original scrolled it with the keypad.
  drawSay(menu) {
    const c = this.context;
    const { roomWidth, roomHeight } = this.game;
    const width = roomWidth - MARGIN * 2;
    c.font = FONT;
    const lines = this.wrap(menu.text, width - MARGIN * 2);
    const headerLines = menu.speaker ? 1 : 0;
    const perPage = SAY_LINES - headerLines;
    menu.pageCount = Math.max(1, Math.ceil(lines.length / perPage));
    const page = lines.slice((menu.page ?? 0) * perPage, ((menu.page ?? 0) + 1) * perPage);
    const height = (page.length + headerLines) * LINE_HEIGHT + MARGIN * 2;
    const x = MARGIN;
    const y = roomHeight - height - MARGIN;
    this.panel(x, y, width, height);

    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillStyle = css(this.game.menuTextColor);
    let lineY = y + MARGIN;
    if (menu.speaker) {
      c.font = BOLD_FONT;
      c.fillText(menu.speaker, x + MARGIN, lineY);
      c.font = FONT;
      lineY += LINE_HEIGHT;
    }
    for (const line of page) {
      c.fillText(line, x + MARGIN, lineY);
      lineY += LINE_HEIGHT;
    }
    if ((menu.page ?? 0) + 1 < menu.pageCount) {
      c.textAlign = 'right';
      c.fillText('▼', x + width - MARGIN, y + height - MARGIN - LINE_HEIGHT);
    }
  }

  drawReceived(menu) {
    const c = this.context;
    const { roomWidth, roomHeight } = this.game;
    const width = Math.min(180, roomWidth - MARGIN * 2);
    c.font = FONT;
    const lines = this.wrap(menu.text, width - MARGIN * 2);
    const image = this.images.get(String(menu.image));
    const imageHeight = image ? image.info.height + MARGIN : 0;
    const height = imageHeight + lines.length * LINE_HEIGHT + MARGIN * 2;
    const x = (roomWidth - width) >> 1;
    const y = (roomHeight - height) >> 1;
    this.panel(x, y, width, height);
    if (image) c.drawImage(image.bitmap, (roomWidth - image.info.width) >> 1, y + MARGIN);
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillStyle = css(this.game.menuTextColor);
    lines.forEach((line, index) => c.fillText(line, roomWidth / 2, y + MARGIN + imageHeight + index * LINE_HEIGHT));
  }

  drawTextFade(menu) {
    const c = this.context;
    const { roomWidth, roomHeight } = this.game;
    c.font = FONT;
    const lines = this.wrap(menu.text, (roomWidth * 3) >> 2);
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillStyle = css(menu.color);
    const top = (roomHeight - lines.length * LINE_HEIGHT) / 2;
    lines.forEach((line, index) => c.fillText(line, roomWidth / 2, top + index * LINE_HEIGHT));
  }

  drawVerbs(menu) {
    const { game } = this;
    const c = this.context;
    const center = verbWheelCenter(menu, game.roomWidth, game.roomHeight);
    c.font = BOLD_FONT;
    const nameWidth = c.measureText(menu.name).width;
    const nameX = Math.max(nameWidth / 2 + 2, Math.min(game.roomWidth - nameWidth / 2 - 2, center.x));
    this.outlinedText(menu.name, nameX, center.y - VERB_WHEEL_RADIUS - 14, 'center');
    this.drawCentered('OMS_menu', center.x, center.y);
    if (menu.selected !== null && menu.selected !== undefined) {
      const [dx, dy] = WHEEL_ARMS[menu.selected];
      this.drawCentered('OMS_selected', center.x + dx, center.y + dy);
    }
    this.drawCentered('OMS_symbols', center.x + 1, center.y);
    this.drawImage('cursorIdle', game.cursorX, game.cursorY);
  }

  drawList(menu, title, rows) {
    const c = this.context;
    const { game } = this;
    const width = game.roomWidth - MARGIN * 4;
    const headerHeight = title ? ROW_HEIGHT : 0;
    const height = headerHeight + rows.length * ROW_HEIGHT + MARGIN * 2;
    const x = MARGIN * 2;
    const y = (game.roomHeight - height) >> 1;
    this.panel(x, y, width, height);
    menu.rows = rows.map((_, index) => ({
      x,
      y: y + MARGIN + headerHeight + index * ROW_HEIGHT,
      width,
      height: ROW_HEIGHT,
    }));
    this.updateHoveredRow();

    c.textBaseline = 'middle';
    c.textAlign = 'left';
    if (title) {
      c.font = BOLD_FONT;
      c.fillStyle = css(game.menuTextColor);
      c.fillText(title, x + MARGIN, y + MARGIN + ROW_HEIGHT / 2);
    }
    c.font = FONT;
    rows.forEach((row, index) => {
      const rect = menu.rows[index];
      if (menu.hovered === index) {
        c.fillStyle = css(game.menuTextColor);
        c.fillRect(rect.x + 1, rect.y, rect.width - 2, rect.height);
        c.fillStyle = css(game.menuColor);
      } else {
        c.fillStyle = css(game.menuTextColor);
      }
      c.fillText(row, rect.x + MARGIN, rect.y + rect.height / 2);
    });
    this.drawImage('cursorIdle', game.cursorX, game.cursorY);
  }

  // Tells list menus which row is under the cursor, because their layout lives here.
  updateHoveredRow() {
    const { game } = this;
    const menu = game.menus.at(-1);
    if (!menu?.rows) return;
    const index = menu.rows.findIndex(
      (row) =>
        game.cursorX >= row.x &&
        game.cursorX < row.x + row.width &&
        game.cursorY >= row.y &&
        game.cursorY < row.y + row.height,
    );
    menu.hovered = index === -1 ? null : index;
  }
}
