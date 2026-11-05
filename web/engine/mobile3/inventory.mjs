import { animationSize } from './data.mjs';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './ui.mjs';

// The inventory's box, as in the class d. All positions are on the phone's 240-pixel screen.
const LEFT = (SCREEN_WIDTH - 176) >> 1;
const TOP = (SCREEN_HEIGHT - 144) >> 1;
const TEXT_FONT = 2;
const ITEM_X = LEFT + 92;
const LOOK_LINE = 414;
const USE_LINE = 413;
const EQUIP_LINE = 499;
const EMPTY_LINE = 412;
const CANT_USE_LINE = 415;
const HEALTH_FULL = 6;
const HEALTH_SOME = 114;
const KEEP_AFTER_USE = new Set([107, 110]);
const MULTI_USE = 113;
const ALWAYS_USABLE = new Set([6, 114, 115, 72, 121, 118, 117, 73, 120, 111]);
const EQUIPPABLE = new Set([118, 111, 120]);
const WEAPON_ITEMS = { 118: 0, 111: 1, 120: 2 };
const PISTOL_BULLETS = 72;
const SHOTGUN_BULLETS = 73;
const MAP = 121;
const ROW_STEP = 23;
// Pearls that a rule gives back in the last chapter, if they aren't in a door.
const PEARL_RETURNS = [
  { rule: 13, item: 68 },
  { rule: 16, item: 71 },
];

export class Inventory {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.isOpen = false;
    this.selected = 0;
    this.row = 0;
    this.hotspot = null;
    this.waiting = false;
  }

  get items() {
    return this.game.items;
  }

  get item() {
    return this.items[this.selected];
  }

  // Using an item needs something to use it on, or it has to be one that works on its own.
  canUse() {
    return this.hotspot !== null || this.game.puzzle?.acceptsItem?.(this.item) || ALWAYS_USABLE.has(this.item);
  }

  open(hotspot = null) {
    const { game } = this;
    this.isOpen = true;
    this.row = 0;
    this.hotspot = hotspot;
    if (game.chapter === 3) {
      for (const { rule, item } of PEARL_RETURNS) {
        if (game.ruleFired[rule] && !this.items.includes(item) && !game.puzzle?.holdsPearl?.(item)) game.addItem(item);
      }
    }
    this.selected = Math.min(this.selected, Math.max(0, this.items.length - 1));
  }

  close() {
    this.isOpen = false;
    this.waiting = false;
  }

  itemsChanged() {
    this.selected = Math.min(this.selected, Math.max(0, this.items.length - 1));
  }

  reopenIfWaiting() {
    if (this.waiting) {
      this.waiting = false;
      this.isOpen = true;
    }
  }

  // Which of the choices the mouse is on.
  rowAt(x, y) {
    if (!this.items.length || x < LEFT + 33 || x >= LEFT + 150) return -1;
    const { lineHeight } = this.game.boxes;
    const top = (this.canUse() ? TOP + 74 : TOP + 85) - (lineHeight >> 1) + 3;
    const count = this.canUse() ? 2 : 1;
    for (let row = 0; row < count; row++) {
      const rowTop = top + row * ROW_STEP;
      if (y >= rowTop && y < rowTop + lineHeight) return row;
    }
    return -1;
  }

  arrowAt(x, y) {
    if (this.items.length < 2) return 0;
    const near = (arrowX) => Math.abs(x - arrowX) < 25;
    const top = TOP + 58 - (this.iconSize().height >> 1);
    if (y < top - 20 || y > top + 40) return 0;
    if (near(LEFT + 19)) return -1;
    return near(LEFT + 144) ? 1 : 0;
  }

  iconFrame() {
    return this.game.tables.inventoryIcons.indexOf(this.item);
  }

  iconSize() {
    const { data } = this.game;
    const { sheet, animation } = data.hardCoded.inventory;
    const parsed = data.animation(animation);
    const frame = parsed.frames[this.iconFrame()] ?? parsed.frames[0];
    return animationSize(data.sheet(sheet), { ...parsed, frames: [frame] });
  }

  hover(x, y) {
    const row = this.rowAt(x, y);
    if (row > -1) this.row = row;
  }

  step(direction) {
    if (this.items.length > 1) {
      this.selected = (this.selected + direction + this.items.length) % this.items.length;
      this.row = 0;
    }
  }

  click(x, y) {
    const arrow = this.arrowAt(x, y);
    if (arrow) {
      this.step(arrow);
      return;
    }
    const row = this.rowAt(x, y);
    if (row < 0) return;
    this.row = row;
    this.choose();
  }

  pressKey(key) {
    if (key === 'Escape' || key === 'inventory') {
      this.close();
    } else if (key === 'ArrowLeft') {
      this.step(-1);
    } else if (key === 'ArrowRight') {
      this.step(1);
    } else if (key === 'ArrowUp' || key === 'ArrowDown') {
      const rows = this.canUse() ? 2 : 1;
      this.row = (this.row + (key === 'ArrowUp' ? rows - 1 : 1)) % rows;
    } else if (key === 'Enter') {
      if (this.items.length) this.choose();
      else this.close();
    }
  }

  lookAtItem() {
    const { game, item } = this;
    const { tables, world, chapter } = game;
    game.fire(7, item);
    const looks = (world === 1 ? tables.objectLooks : tables.objectLooksDark)[item];
    game.showMessage(game.lines[looks.length > 1 ? looks[chapter - 1] : looks[0]]);
    this.isOpen = false;
    this.waiting = true;
  }

  choose() {
    if (!this.items.length) return;
    if (this.canUse() && this.row === 0) this.use();
    else this.lookAtItem();
  }

  // As the class d's f().
  use() {
    const { game, item } = this;
    const target = this.hotspot?.id ?? -1;
    if (game.fireWithItem(target, item)) {
      if (!KEEP_AFTER_USE.has(item) && !game.hasItem(MULTI_USE)) game.removeItem(item);
      this.close();
      return;
    }
    if (game.fire(4, item)) {
      game.removeItem(item);
      this.close();
      return;
    }
    if (item in WEAPON_ITEMS) {
      game.equip(WEAPON_ITEMS[item]);
      this.close();
    } else if (item === HEALTH_FULL) {
      game.healFully();
      game.removeItem(item);
      this.close();
    } else if (item === HEALTH_SOME) {
      game.healSome();
      game.removeItem(item);
      this.close();
    } else if (item === PISTOL_BULLETS) {
      game.reload(1);
    } else if (item === SHOTGUN_BULLETS) {
      game.reload(2);
    } else if (game.fight) {
      // Nothing else can be used in a fight, and the original leaves the box open.
    } else if (item === MAP) {
      this.close();
      game.pressKey('map');
    } else if (game.puzzle?.acceptsItem?.(item)) {
      game.puzzle.place(item);
      this.close();
    } else {
      game.showMessage(game.lines[CANT_USE_LINE]);
      this.isOpen = false;
      this.waiting = true;
    }
  }

  draw() {
    const { game, item } = this;
    const { lines, boxes, data } = game;
    const { lineHeight } = boxes;
    const list = [{ panel: true, x: LEFT + 16, y: TOP + 16, width: 144, height: 96 }];
    if (!this.items.length) {
      list.push({
        text: lines[EMPTY_LINE],
        font: TEXT_FONT,
        x: ITEM_X,
        y: TOP + 72 - (lineHeight >> 1),
        align: 'center',
      });
      return list;
    }
    const { sheet, animation } = data.hardCoded.inventory;
    const icon = this.iconSize();
    const iconY = TOP + 48 + (icon.height >> 1) - (item === 107 ? icon.height >> 2 : 0) - 8;
    const separatorY = TOP + 48 + (data.moduleSize(sheet, 0).height >> 1) + 6;
    list.push(
      { text: lines[game.tables.objectNames[item]], font: TEXT_FONT, x: ITEM_X, y: TOP + 3, align: 'center' },
      { fill: '#bbbbbb', x: LEFT + 6, y: TOP + lineHeight + 4, width: 168, height: 1 },
      { sheet, animation, frame: this.iconFrame(), x: ITEM_X, y: iconY },
      { fill: '#bbbbbb', x: LEFT + 6, y: separatorY, width: 168, height: 1 },
    );
    if (item === PISTOL_BULLETS || item === SHOTGUN_BULLETS) {
      const count = game.bullets[item === PISTOL_BULLETS ? 1 : 2];
      list.push({
        text: String(count),
        font: TEXT_FONT,
        x: LEFT + 144,
        y: separatorY - lineHeight,
        align: 'right',
      });
    }
    if (this.items.length > 1) {
      const arrowY = TOP + 58 - (icon.height >> 1);
      list.push({ arrow: 1, x: LEFT + 19, y: arrowY }, { arrow: 0, x: LEFT + 144, y: arrowY });
    }
    const usable = this.canUse();
    const top = usable ? TOP + 74 : TOP + 85;
    list.push({
      fill: '#bbbbbb',
      x: LEFT + 33,
      y: top - (lineHeight >> 1) + 3 + this.row * ROW_STEP,
      width: 117,
      height: lineHeight,
    });
    if (usable) {
      const useLine = EQUIPPABLE.has(item) ? EQUIP_LINE : USE_LINE;
      list.push(
        { text: lines[useLine], font: TEXT_FONT, x: ITEM_X, y: TOP + 74, align: 'center' },
        { text: lines[LOOK_LINE], font: TEXT_FONT, x: ITEM_X, y: TOP + 97, align: 'center' },
      );
    } else {
      list.push({ text: lines[LOOK_LINE], font: TEXT_FONT, x: ITEM_X, y: TOP + 85, align: 'center' });
    }
    return list;
  }
}
