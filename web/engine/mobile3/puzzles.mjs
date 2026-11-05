import { animationSize } from './data.mjs';
import { puzzleText } from './help.mjs';
import { wrapText } from './text.mjs';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './ui.mjs';

// The six puzzles, as in GameMidlet.p(int), e(int, int) and the drawing and updating that
// the original does for each. All positions are on the phone's 240-pixel screen.
const CENTER_X = SCREEN_WIDTH >> 1;
const CENTER_Y = SCREEN_HEIGHT >> 1;
const NUMBER_FONT = 3;
const TEXT_FONT = 2;
export const PUZZLE = { PHONE: 1, PAPERS: 2, CLOCK: 3, SAFE: 4, BOTTLES: 5, PEARLS: 6 };

class Puzzle {
  constructor(game, number) {
    this.game = game;
    this.data = game.data;
    this.tables = game.tables;
    this.number = number;
    this.sheets = game.tables.puzzleSheets;
    this.lines = game.tables.puzzleLines;
    this.ready = true;
  }

  // The instructions come first, in a box.
  showIntro(line = this.lines[this.number]) {
    const { game } = this;
    this.ready = false;
    game.showSpeech(game.lines[this.lines[0]], puzzleText(game, line, this.number), () => {
      this.ready = true;
    });
  }

  moduleSize(sheet, index) {
    return this.data.moduleSize(sheet, index);
  }

  size(sheet, animation) {
    return animationSize(this.data.sheet(sheet), this.data.animation(animation));
  }

  tick() {}
  isHot() {
    return false;
  }
  click() {}
  pressDigit() {}
  // Each returns whether it did something, or else the left does nothing and the right leaves.
  softLeft() {
    return false;
  }
  softRight() {
    return false;
  }
  softKeyLabels() {
    return { left: null, right: 9 };
  }
  wantsHold() {
    return false;
  }
  startHold() {}
  endHold() {}
  holdDirection() {}
  background() {
    return null;
  }
  draw() {
    return [];
  }
}

// The phone: six numbers, which then show as right or wrong for a second.
class Phone extends Puzzle {
  constructor(game) {
    super(game, PUZZLE.PHONE);
    const [keys, right, wrong, display] = this.sheets;
    Object.assign(this, { keys, right, wrong, display });
    const { width, height } = this.moduleSize(keys, 0);
    this.x = (SCREEN_WIDTH - width) >> 1;
    this.y = (SCREEN_HEIGHT - height) >> 1;
    const size = this.moduleSize(display, 0);
    this.displayX = this.x + ((width - size.width) >> 1);
    this.displayY = this.y - size.height;
    this.textX = this.displayX + 14;
    this.textY = this.displayY + 9;
    this.textStep = Math.trunc((size.width - 14) / this.tables.phoneCode.length);
    this.verdictTime = 0;
    this.correct = false;
    if (game.phoneSolved) {
      this.entered = [...this.tables.phoneCode];
      this.correct = true;
      this.verdictTime = 1000;
    } else {
      // The numbers typed so far are the original's static fields, so they're still there.
      this.entered = [...game.phoneEntered];
      this.showIntro();
      if (this.entered.length === this.tables.phoneCode.length) this.judge();
    }
  }

  // As in GameMidlet.d(int, int). 10 and 11 are * and #.
  keyAt(x, y) {
    const left = x - this.x - 31;
    const top = y - this.y - 24;
    const column = [0, 31, 62].findIndex((start) => left > start && left < start + 24);
    const row = [0, 31, 62, 93].findIndex((start) => top > start && top < start + 24);
    if (row === 3) return [10, 0, 11][column] ?? -1;
    return row > -1 && column > -1 ? row * 3 + column + 1 : -1;
  }

  isHot(x, y) {
    return this.keyAt(x, y) > -1;
  }

  press(key) {
    const { phoneCode } = this.tables;
    if (this.verdictTime > 0 || this.entered.length >= phoneCode.length) return;
    this.entered.push(key);
    this.game.phoneEntered = [...this.entered];
    if (this.entered.length === phoneCode.length) this.judge();
  }

  judge() {
    const { phoneCode } = this.tables;
    this.correct = this.entered.every((value, index) => value === phoneCode[index]);
    this.verdictTime = 1000;
  }

  click(x, y) {
    const key = this.keyAt(x, y);
    if (key > -1) this.press(key);
  }

  pressDigit(digit) {
    this.press(digit);
  }

  tick(milliseconds) {
    if (this.verdictTime <= 0) return;
    this.verdictTime -= milliseconds;
    if (this.verdictTime > 0) return;
    if (this.correct) this.game.finishPuzzle(this, true);
    else {
      this.entered = [];
      this.game.phoneEntered = [];
    }
  }

  // The right number counts as soon as it's typed, so leaving while it shows still solves it.
  softRight() {
    this.game.finishPuzzle(this, this.correct);
    return true;
  }

  draw() {
    const list = [{ sheet: this.keys, module: 0, x: this.x, y: this.y }];
    if (this.verdictTime > 0) {
      list.push(
        this.correct
          ? { sheet: this.right, module: 0, x: this.x + 46, y: this.y + 156 }
          : { sheet: this.wrong, module: 0, x: this.x + 82, y: this.y + 156 },
      );
    }
    list.push({ sheet: this.display, module: 0, x: this.displayX, y: this.displayY });
    let x = this.textX;
    for (let i = 0; i < this.tables.phoneCode.length; i++) {
      const key = this.entered[i];
      const text = key === undefined ? '_' : key < 10 ? String(key) : key === 10 ? '*' : '#';
      list.push({ text, font: NUMBER_FONT, x, y: this.textY });
      x += this.textStep;
    }
    return list;
  }
}

// Three pieces of paper, which join into a circle of figures holding hands.
class Papers extends Puzzle {
  constructor(game) {
    super(game, PUZZLE.PAPERS);
    const [first, second] = [this.sheets[6], this.sheets[7]];
    this.pieceSheets = [first, first, second];
    const bottom = SCREEN_HEIGHT - game.boxes.softKeyHeight;
    const square = this.moduleSize(first, 0).width;
    const last = this.moduleSize(second, 3);
    const firstTop = (bottom >> 2) - (square >> 1);
    this.pieces = [
      { x: (CENTER_X - square) >> 1, y: firstTop, width: square, height: square, turn: 3, layer: 0 },
      { x: (CENTER_X - square) >> 1, y: (bottom >> 1) + firstTop, width: square, height: square, turn: 2, layer: 1 },
    ];
    this.pieces.push({
      x: CENTER_X + this.pieces[0].x,
      y: (bottom >> 1) - last.width,
      width: last.width,
      height: last.height,
      turn: 3,
      layer: 2,
    });
    this.carried = -1;
    this.showIntro();
  }

  // Where a piece's two hands are, as in GameMidlet.z(int).
  ends(index) {
    const { x, y, width, height, turn } = this.pieces[index];
    if (index === 2) {
      return [
        [
          [x + (width >> 2), y + 10],
          [x + (width >> 1) + (width >> 2), y + 10],
        ],
        [
          [x + 10, y + (height >> 2)],
          [x + 10, y + (height >> 1) + (height >> 2)],
        ],
        [
          [x + (width >> 2), y + height - 10],
          [x + (width >> 1) + (width >> 2), y + height - 10],
        ],
        [
          [x + width - 10, y + (height >> 2)],
          [x + width - 10, y + (height >> 1) + (height >> 2)],
        ],
      ][turn];
    }
    return [
      [
        [x + 10, y + (height >> 1)],
        [x + (width >> 1), y + height - 10],
      ],
      [
        [x + (width >> 1), y + height - 10],
        [x + width - 10, y + (height >> 1)],
      ],
      [
        [x + width - 10, y + (height >> 1)],
        [x + (width >> 1), y + 10],
      ],
      [
        [x + (width >> 1), y + 10],
        [x + 10, y + (height >> 1)],
      ],
    ][turn];
  }

  // The piece on top at a point, as in GameMidlet.c(int, int).
  pieceAt(px, py) {
    let found = -1;
    for (let layer = 0; layer <= 2; layer++) {
      this.pieces.forEach(({ x, y, width, height, layer: its }, index) => {
        if (its === layer && px >= x && px <= x + width && py >= y && py <= y + height) found = index;
      });
    }
    return found;
  }

  // Every hand has to be near another, and none hidden under a piece, as in the update.
  isSolved() {
    const hands = this.pieces.flatMap((_, index) => this.ends(index).map(([x, y]) => ({ index, x, y })));
    const joined = hands.every((hand) =>
      hands.some((other) => other !== hand && Math.abs(hand.x - other.x) < 30 && Math.abs(hand.y - other.y) < 30),
    );
    return joined && hands.every(({ index, x, y }) => this.pieceAt(x, y) === index);
  }

  isHot(x, y) {
    return this.carried > -1 || this.pieceAt(x, y) > -1;
  }

  moveCarried(x, y) {
    if (this.carried < 0) return;
    const piece = this.pieces[this.carried];
    const size = this.pieces[1].height;
    const bottom = SCREEN_HEIGHT - this.game.boxes.softKeyHeight;
    piece.x = Math.min(SCREEN_WIDTH - piece.width - 2, Math.max(2, x - (size >> 1)));
    piece.y = Math.min(bottom - piece.height - 2, Math.max(4, y - (size >> 1)));
  }

  tick() {
    this.moveCarried(this.game.screenX, this.game.cursorY);
  }

  click(x, y) {
    if (this.carried > -1) {
      this.drop();
      return;
    }
    const index = this.pieceAt(x, y);
    if (index < 0) return;
    this.carried = index;
    const { layer } = this.pieces[index];
    if (layer < 2) {
      for (const piece of this.pieces) if (piece.layer > layer) piece.layer--;
    }
    this.pieces[index].layer = 2;
  }

  drop() {
    this.carried = -1;
    if (this.isSolved()) this.game.finishPuzzle(this, true);
  }

  rotate() {
    if (this.carried < 0) return;
    const piece = this.pieces[this.carried];
    piece.turn = (piece.turn + 1) % 4;
    [piece.width, piece.height] = [piece.height, piece.width];
  }

  softLeft() {
    this.rotate();
    return true;
  }

  softRight() {
    if (this.carried > -1) this.drop();
    else this.game.finishPuzzle(this, false);
    return true;
  }

  softKeyLabels() {
    return this.carried > -1 ? { left: 3, right: 7 } : { left: null, right: 9 };
  }

  draw() {
    const list = [];
    for (let layer = 0; layer <= 2; layer++) {
      this.pieces.forEach((piece, index) => {
        if (piece.layer !== layer) return;
        if (this.carried === index) {
          list.push({
            fill: '#ff0000',
            x: piece.x - 2,
            y: piece.y - 2,
            width: piece.width + 4,
            height: piece.height + 4,
          });
        }
        list.push({ sheet: this.pieceSheets[index], module: piece.turn, x: piece.x, y: piece.y });
      });
    }
    return list;
  }
}

// The dining room's clock. Its hands have to show a quarter to four.
class Clock extends Puzzle {
  constructor(game) {
    super(game, PUZZLE.CLOCK);
    const face = this.sheets[4];
    const buttons = this.sheets[5];
    const { clock } = this.data.hardCoded;
    this.face = face;
    this.buttons = buttons;
    this.handSheet = clock.handSheet;
    this.faceAnimation = clock.face;
    this.hours = clock.hours;
    this.minutes = clock.minutes;
    const faceSize = this.moduleSize(face, 0);
    this.buttonSize = this.moduleSize(buttons, 0);
    const buttonHeight = this.moduleSize(buttons, 1).height;
    const faceTop = CENTER_Y - faceSize.height;
    const bottom = SCREEN_HEIGHT - game.boxes.softKeyHeight;
    this.faceX = CENTER_X - faceSize.width;
    this.faceY = faceTop;
    this.buttonY =
      faceTop + (faceSize.height << 1) + ((bottom - faceTop - (faceSize.height << 1)) >> 1) - (buttonHeight >> 1);
    this.backX = CENTER_X - faceSize.width;
    this.forwardX = CENTER_X + faceSize.width - this.moduleSize(buttons, 1).width;
    this.minute = 0;
    this.hourBase = 0;
    this.hour = 0;
    this.held = 0;
    this.repeat = 300;
    this.wait = 0;
    this.showIntro();
  }

  buttonAt(x, y) {
    if (y < this.buttonY || y > this.buttonY + this.moduleSize(this.buttons, 1).height) return 0;
    if (x >= this.backX && x <= this.backX + this.buttonSize.width) return -1;
    if (x >= this.forwardX && x <= this.forwardX + this.buttonSize.width) return 1;
    return 0;
  }

  isHot(x, y) {
    return this.buttonAt(x, y) !== 0;
  }

  step(direction) {
    if (direction < 0) {
      if (--this.minute < 0) {
        this.minute = 11;
        this.hourBase -= 3;
        if (this.hourBase < 0) this.hourBase = 33;
      }
    } else if (++this.minute > 11) {
      this.minute = 0;
      this.hourBase += 3;
      if (this.hourBase > 35) this.hourBase = 0;
    }
    this.hour = this.hourBase + Math.trunc(this.minute / 3);
    if (this.hour > 35) this.hour = 0;
  }

  // Quarter to four, in five-minute steps of the minute hand.
  isSolved() {
    return this.hour === 12 && this.minute === 9;
  }

  click(x, y) {
    const direction = this.buttonAt(x, y);
    if (direction) this.step(direction);
  }

  wantsHold(x, y) {
    return this.ready && this.buttonAt(x, y) !== 0;
  }

  startHold(x, y) {
    this.held = this.buttonAt(x, y);
    this.repeat = 300;
    this.wait = 0;
  }

  endHold() {
    this.held = 0;
  }

  holdDirection(direction, down) {
    if (direction !== 'left' && direction !== 'right') return;
    if (down) {
      this.held = direction === 'left' ? -1 : 1;
      this.repeat = 300;
      this.wait = 0;
    } else {
      this.held = 0;
    }
  }

  // Holding a button speeds the hands up.
  tick(milliseconds) {
    if (!this.held) return;
    this.wait -= milliseconds;
    if (this.wait > 0) return;
    this.step(this.held);
    this.repeat = Math.max(50, this.repeat - 50);
    this.wait = this.repeat;
  }

  softLeft() {
    this.game.finishPuzzle(this, this.isSolved());
    return true;
  }

  softRight() {
    this.game.finishPuzzle(this, false);
    return true;
  }

  softKeyLabels() {
    return { left: 5, right: 9 };
  }

  draw() {
    return [
      { sheet: this.face, animation: this.faceAnimation, frame: 0, x: this.faceX, y: this.faceY },
      { sheet: this.buttons, module: 0, x: this.backX, y: this.buttonY },
      { sheet: this.buttons, module: 1, x: this.forwardX, y: this.buttonY },
      {
        sheet: this.handSheet,
        animation: this.minutes,
        frame: this.minute,
        x: CENTER_X - 7,
        y: CENTER_Y - 45,
      },
      {
        sheet: this.handSheet,
        animation: this.hours,
        frame: this.hour,
        x: CENTER_X - 5,
        y: CENTER_Y - 33,
      },
    ];
  }
}

// The safe, with a riddle on it. A wrong number hurts.
class Safe extends Puzzle {
  constructor(game) {
    super(game, PUZZLE.SAFE);
    this.art = this.data.hardCoded.safe;
    this.digits = ['_', '_', '_'];
    this.slot = 0;
    this.dial = 0;
    this.layOut();
    // Only until the puzzle ends: a room's looping sound comes back, as GameMidlet.ax() has it.
    game.audio?.stop?.();
  }

  layOut() {
    const { art, sheets } = this;
    if (art.kind === 'dial') {
      [this.buttonSheet, this.paperSheet, this.dialSheet] = [sheets[8], sheets[9], sheets[10]];
      const paper = this.size(this.paperSheet, art.paper);
      this.paperWidth = paper.width;
      this.paperX = CENTER_X - (paper.width >> 1);
      const sizes = art.buttons.map((id) => this.size(this.buttonSheet, id));
      this.buttonPlaces = [];
      this.buttonPlaces[2] = { x: SCREEN_WIDTH - sizes[2].width, y: paper.height + 10, ...sizes[2] };
      this.buttonPlaces[0] = {
        x: SCREEN_WIDTH - sizes[0].width,
        y: this.buttonPlaces[2].y + sizes[2].height + 5,
        ...sizes[0],
      };
      this.buttonPlaces[1] = {
        x: SCREEN_WIDTH - sizes[1].width,
        y: this.buttonPlaces[0].y + sizes[0].height + 5,
        ...sizes[1],
      };
      const dial = this.size(this.dialSheet, art.dial);
      this.dialPlace = { x: 5, y: paper.height + 10, ...dial };
      this.numbersX = this.buttonPlaces[0].x + 40;
      this.numbersY = this.buttonPlaces[0].y + 5;
      this.digits[0] = '0';
    } else {
      [this.panelSheet, this.paperSheet, this.keysSheet] = [sheets[8], sheets[9], sheets[10]];
      const paper = this.size(this.paperSheet, art.paper);
      this.paperWidth = paper.width;
      this.paperX = CENTER_X - (paper.width >> 1);
      const panel = this.size(this.panelSheet, art.panel);
      this.panelX = Math.trunc(CENTER_X / 3);
      this.panelY = SCREEN_HEIGHT - panel.height - 80;
      this.panelSize = panel;
      const keys = this.size(this.keysSheet, art.keys);
      this.keysSize = keys;
      this.keysX = CENTER_X >> 1;
      this.keysY = SCREEN_HEIGHT - keys.height;
      this.numbersX = this.panelX + 65;
      this.numbersY = this.panelY + 13;
    }
  }

  isEmpty() {
    return this.digits.every((digit) => digit === '_');
  }

  // These builds take their numbers from a phone's keys, and draw a safe's knob below them.
  // So that a mouse can enter them too, the knob's sides turn the number, and clicking the
  // panel moves on to the next.
  keysSpotAt(x, y) {
    const { keysX, keysY, keysSize, panelX, panelY, panelSize } = this;
    if (x >= panelX && x < panelX + panelSize.width && y >= panelY && y < panelY + panelSize.height) return 'next';
    if (x < keysX || y < keysY || x >= keysX + keysSize.width || y >= keysY + keysSize.height) return null;
    return x < keysX + (keysSize.width >> 1) ? 'down' : 'up';
  }

  spotAt(x, y) {
    if (this.art.kind !== 'dial') return this.keysSpotAt(x, y);
    const inside = ({ x: left, y: top, width, height }, margin) =>
      x > left - margin && x < left - margin + width + margin && y > top - margin && y < top - margin + height + margin;
    if (inside(this.buttonPlaces[2], 10)) return 'up';
    if (inside(this.buttonPlaces[1], 10)) return 'down';
    const { dialPlace: dial } = this;
    const middleX = dial.x + (dial.width >> 1);
    const middleY = dial.y + (dial.height >> 1);
    if (Math.abs(x - middleX) < 25 && Math.abs(y - middleY) < 25) return 'next';
    return null;
  }

  isHot(x, y) {
    return this.spotAt(x, y) !== null;
  }

  // The number being entered shows as it changes.
  enter(digit) {
    this.digits[this.slot] = String(digit);
    this.dial = digit;
  }

  nextSlot() {
    this.slot = (this.slot + 1) % 3;
    this.dial = 0;
  }

  pressDigit(digit) {
    this.enter(digit);
    if (this.art.kind === 'keys') this.nextSlot();
  }

  click(x, y) {
    const spot = this.spotAt(x, y);
    if (spot === 'up') this.enter(Math.min(9, this.digits[this.slot] === '_' ? 0 : this.dial + 1));
    else if (spot === 'down') this.enter(Math.max(0, this.dial - 1));
    else if (spot === 'next') {
      this.nextSlot();
      if (this.art.kind === 'dial') this.digits[this.slot] = '0';
    }
  }

  // The riddle's answer is one, entered with its leading zeros.
  softLeft() {
    if (this.art.kind === 'keys' && this.isEmpty()) return true;
    if (this.digits.join('') === '001') {
      this.game.finishPuzzle(this, true);
    } else {
      this.game.safeWasWrong();
      this.game.finishPuzzle(this, false);
    }
    return true;
  }

  softRight() {
    if (this.art.kind === 'keys' && !this.isEmpty()) {
      this.digits = ['_', '_', '_'];
      this.slot = 0;
      this.dial = 0;
    } else {
      this.game.leaveSafe();
    }
    return true;
  }

  softKeyLabels() {
    const empty = this.art.kind === 'keys' && this.isEmpty();
    return { left: empty ? null : 5, right: empty || this.art.kind === 'dial' ? 9 : 14 };
  }

  draw() {
    const { art } = this;
    const list = [{ fill: '#222222', x: 0, y: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT }];
    if (art.kind === 'dial') {
      art.buttons.forEach((id, index) => {
        const { x, y } = this.buttonPlaces[index];
        list.push({ sheet: this.buttonSheet, animation: id, frame: 0, x, y });
      });
      list.push({ sheet: this.paperSheet, animation: art.paper, frame: 0, x: this.paperX, y: 0 });
      list.push({
        sheet: this.dialSheet,
        animation: art.dial,
        frame: this.dial,
        x: this.dialPlace.x,
        y: this.dialPlace.y,
      });
    } else {
      list.push({ sheet: this.panelSheet, animation: art.panel, frame: 0, x: this.panelX, y: this.panelY });
      list.push({ sheet: this.paperSheet, animation: art.paper, frame: 0, x: this.paperX, y: 0 });
      list.push({ sheet: this.keysSheet, animation: art.keys, frame: 0, x: this.keysX, y: this.keysY });
    }
    list.push({ text: this.digits.join(' '), font: NUMBER_FONT, x: this.numbersX, y: this.numbersY });
    const riddle = wrapText(this.data, TEXT_FONT, this.game.lines[this.lines[4]], this.paperWidth - 40);
    // The touch builds leave less room above their German, which is longer.
    const top = art.kind === 'keys' ? 35 : this.game.languageName === 'Deutsch' ? 7 : 17;
    riddle.forEach((text, index) => {
      list.push({
        text,
        font: TEXT_FONT,
        x: this.paperX + 19,
        y: top + index * this.data.fonts[TEXT_FONT].lineHeight,
      });
    });
    return list;
  }
}

// Sand to pour between three bottles, and a button to weigh it on.
class Bottles extends Puzzle {
  constructor(game) {
    super(game, PUZZLE.BOTTLES);
    const { bottles } = this.data.hardCoded;
    this.art = bottles;
    this.sheet = this.sheets[14];
    this.sand = { eight: 8, five: 0, three: 0 };
    this.held = null;
    const offsets = bottles.bottomOffsets;
    const place = (name, x, offset) => {
      const { width, height } = this.size(this.sheet, bottles[name]);
      return { x, y: SCREEN_HEIGHT - offset - height, width, height };
    };
    this.places = {
      three: place('three', 180, offsets.three),
      five: place('five', 131, offsets.five),
      eight: place('eight', 26, offsets.eight),
      button: { ...this.size(this.sheet, bottles.button), x: 72, y: SCREEN_HEIGHT - offsets.buttonTop },
    };
    this.showIntro();
  }

  spotAt(x, y) {
    for (const name of ['eight', 'five', 'three', 'button']) {
      const place = this.places[name];
      if (x > place.x && x < place.x + place.width && y > place.y && y < place.y + place.height) return name;
    }
    return null;
  }

  isHot(x, y) {
    return this.spotAt(x, y) !== null;
  }

  // As in the original's drawing code, which pours when a second bottle is chosen. Its
  // arithmetic isn't always that of pouring, so sand can vanish or the smallest can overfill.
  pour(from, to) {
    const { sand } = this;
    if (to === 'eight') {
      if (sand.eight !== 8) {
        sand.eight += sand[from];
        sand[from] = 0;
      }
    } else if (to === 'five') {
      if (sand.five !== 5) {
        const total = sand.five + sand[from];
        sand.five = Math.min(total, 5);
        sand[from] = Math.max(total - 5, 0);
      }
    } else if (from === 'eight') {
      if (sand.three < 3) {
        sand.three -= sand.eight;
        if (sand.three < 0) {
          sand.three = 3;
          sand.eight -= 3;
        }
      }
    } else if (sand.three !== 3) {
      if (sand.five > 3) {
        sand.five -= 3 - sand.three;
        sand.three = 3;
      } else {
        sand.three += sand.five;
        sand.five = 0;
      }
    }
  }

  click(x, y) {
    const spot = this.spotAt(x, y);
    if (!spot) return;
    const { held } = this;
    if (spot === 'button') {
      if (held && this.sand[held] === 4) this.game.finishPuzzle(this, true);
      this.held = null;
      return;
    }
    if (held && held !== spot) {
      this.pour(held, spot);
      this.held = null;
      return;
    }
    this.held = held ? null : spot;
  }

  softRight() {
    this.game.finishPuzzle(this, false);
    return true;
  }

  background() {
    return 'corridor';
  }

  draw() {
    const { art, places, sheet, sand } = this;
    const bottle = (name, frame) => ({
      sheet,
      animation: art[name],
      frame: Math.min(frame, this.data.animation(art[name]).frames.length - 1),
      x: places[name].x,
      y: places[name].y,
    });
    const list = [
      bottle('three', sand.three),
      bottle('five', sand.five),
      { sheet, animation: art.button, frame: 0, x: places.button.x, y: places.button.y },
      bottle('eight', sand.eight),
    ];
    const overlays = { eight: 'eightSelected', five: 'fiveSelected', three: 'threeSelected' };
    if (this.held) {
      const { x, y } = places[this.held];
      list.push({ sheet, animation: art[overlays[this.held]], frame: 0, x, y });
    }
    return list;
  }
}

const PEARLS = [68, 69, 70, 71];
const SLOT_CENTERS = { 69: [120, 141], 71: [47, 209], 70: [120, 272], 68: [186, 209] };

// The door with four cavities, for the pearls, in the order its words give.
class Pearls extends Puzzle {
  constructor(game) {
    super(game, PUZZLE.PEARLS);
    this.art = this.data.hardCoded.pearls;
    this.paperSheet = this.sheets[12];
    this.doorSheet = this.sheets[11];
    this.pearlSheet = this.sheets[13];
    const paper = this.size(this.paperSheet, this.art.paper);
    this.paperX = CENTER_X - Math.trunc(paper.width / 2);
    // The original's own width runs off the paper, and hides the end of each line.
    this.textWidth = paper.width - 40;
    this.chosenSlot = -1;
    // Which cavity holds which pearl.
    this.placed = new Map();
    this.showIntro(this.data.hardCoded.lines.pearlIntro);
    this.wording = wrapText(this.data, TEXT_FONT, game.lines[this.lines[6]], this.textWidth);
  }

  slotAt(x, y) {
    for (const slot of PEARLS) {
      if (this.placed.has(slot)) continue;
      const [centerX, centerY] = SLOT_CENTERS[slot];
      if ((centerX - x) ** 2 + (centerY - y) ** 2 < 196) return slot;
    }
    return -1;
  }

  isHot(x, y) {
    return this.slotAt(x, y) > -1;
  }

  // Choosing a cavity opens the inventory, and a pearl chosen there goes into the cavity.
  click(x, y) {
    const slot = this.slotAt(x, y);
    if (slot < 0) return;
    this.chosenSlot = slot;
    this.game.inventory.open();
  }

  acceptsItem(item) {
    return PEARLS.includes(item);
  }

  // A cavity was under the cursor when the inventory opened, so every item offers Use.
  takesAnyItem() {
    return this.chosenSlot > -1;
  }

  place(item) {
    this.placed.set(this.chosenSlot, item);
    this.chosenSlot = -1;
    this.game.removeItem(item);
  }

  holdsPearl(item) {
    return [...this.placed.values()].includes(item);
  }

  isSolved() {
    return PEARLS.every((slot) => this.placed.get(slot) === slot);
  }

  // Giving up, or getting it wrong, hands the pearls back.
  returnPearls() {
    for (const item of this.placed.values()) this.game.addItem(item);
    this.placed.clear();
  }

  softLeft() {
    if (this.isSolved()) {
      this.game.pearlsSolved = true;
      this.game.finishPuzzle(this, true);
    } else {
      this.returnPearls();
      this.game.finishPuzzle(this, false);
    }
    return true;
  }

  softRight() {
    this.returnPearls();
    this.game.finishPuzzle(this, false);
    return true;
  }

  softKeyLabels() {
    return { left: 5, right: 9 };
  }

  draw() {
    const { art, doorSheet, paperSheet, pearlSheet } = this;
    const list = [
      { sheet: doorSheet, animation: art.door, frame: 0, x: 0, y: 0 },
      { sheet: paperSheet, animation: art.paper, frame: 0, x: this.paperX, y: 0 },
    ];
    this.wording.forEach((text, index) => {
      list.push({
        text,
        font: TEXT_FONT,
        x: this.paperX + 19,
        y: 35 + index * this.data.fonts[TEXT_FONT].lineHeight,
      });
    });
    const places = { 68: [189, 210], 69: [123, 142], 70: [123, 273], 71: [50, 210] };
    const animations = { 68: art.pearl68, 69: art.pearl69, 70: art.pearl70, 71: art.pearl71 };
    for (const [slot, item] of this.placed) {
      const [x, y] = places[slot];
      // Two of the pearls' pictures sit two pixels further left.
      const shift = item === 68 || item === 70 ? -2 : 0;
      list.push({ sheet: pearlSheet, animation: animations[item], frame: 0, x: x + shift, y });
    }
    return list;
  }
}

const CLASSES = { 1: Phone, 2: Papers, 3: Clock, 4: Safe, 5: Bottles, 6: Pearls };

export function createPuzzle(game, number) {
  return new CLASSES[number](game);
}
