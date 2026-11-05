import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readInput } from '../src/inputs.mjs';
import { readJar } from '../web/engine/jar.mjs';
import { loadMobile3 } from '../web/engine/mobile3/data.mjs';
import {
  createGame,
  FACING,
  LIFT_CELLS,
  LIFTS,
  MODE,
  SCREEN_X,
  STAIRS,
  STEP,
  VERB,
} from '../web/engine/mobile3/game.mjs';

// Plays from a new game to the ending through the page's own methods, following the
// walkthrough at silenthillmemories.net/sh_mobile3/walkthrough_en.htm. The numbers are the
// game's own: rooms and things in them, and the items they give.
const FOLLOWED_PROGRAMS = [
  'sh3-en-v170',
  'sh3-en-v0011',
  'sh3-2010-v1.0.20-a',
  'sh3-2010-v1.0.24-a',
  'sh3-2010-v1.0.24-a1',
  'sh3-2010-v1.0.24-a12',
  'sh3-2010-v1.0.24-a5',
  'sh3-2010-v1.1.0-a1',
  'sh3-2010-v1.1.0-a12',
  'sh3-2010-v1.1.0-a4',
  'sh3-2010-v1.5.0-a',
  'sh3-2010-v1.5.0-a1',
];
const ITEM = {
  ICE: 105,
  GOLD_KEY: 106,
  CHAIN: 107,
  RED_PEARL: 68,
  YELLOW_PEARL: 69,
  BLACK_PEARL: 70,
  BLUE_PEARL: 71,
  OLD_KEY: 112,
  LIGHTER: 110,
  KNIFE: 115,
  RUSTY_KEY: 116,
  SHOTGUN: 120,
  PISTOL: 111,
  MELEE: 118,
};
const WEAPON_ITEM = [ITEM.MELEE, ITEM.PISTOL, ITEM.SHOTGUN];

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

class Player {
  constructor(data) {
    this.storage = new Map();
    const storage = {
      getItem: (key) => this.storage.get(key) ?? null,
      setItem: (key, value) => this.storage.set(key, value),
    };
    this.game = createGame(data, { startInGame: true, random: seededRandom(7), storage });
    this.steps = 0;
    this.clearText();
  }

  settle() {
    const { game } = this;
    let limit = 10000;
    while (game.fade && limit-- > 0) game.tick();
    assert.ok(limit > 0, 'a fade ended');
    game.tick();
  }

  // Reads through whatever's being said, and fights what's started by the end of it.
  clearText() {
    const { game } = this;
    this.settle();
    let limit = 500;
    while (game.box && limit-- > 0) {
      while (game.timedDialogue > 0) game.tick();
      game.moveCursor(180, 160);
      game.click();
      this.settle();
    }
    assert.ok(limit > 0, 'the text ended');
  }

  floorOf(cell) {
    const { firstFloor, secondFloor, thirdFloor } = this.game.tables;
    return [firstFloor, secondFloor, thirdFloor].findIndex((grid) => grid.flat().includes(cell)) + 1;
  }

  // A short way through the corridors, by foot, stairs and lift.
  path(toCell) {
    const { game } = this;
    const start = { floor: game.floor, cell: game.cell };
    const seen = new Set([start.cell]);
    const queue = [{ ...start, moves: [] }];
    const savedFloor = game.floor;
    const saved = { cell: game.cell, facing: game.facing };
    let found = null;
    while (queue.length && !found) {
      const { floor, cell, moves } = queue.shift();
      if (cell === toCell) {
        found = moves;
        break;
      }
      game.floor = floor;
      for (let facing = 0; facing < 4; facing++) {
        game.placeInCorridor(cell, facing);
        const door = game.doorsAt(cell)[facing];
        const next = [];
        if (door in STAIRS) next.push({ ...STAIRS[door], move: { kind: 'stairs', cell, facing } });
        if (LIFTS.has(door)) {
          LIFT_CELLS.forEach((liftCell, index) => {
            next.push({ floor: index + 1, cell: liftCell, move: { kind: 'lift', cell, facing, floor: index + 1 } });
          });
        }
        if (game.canWalkForward()) {
          const [row, column] = STEP[facing];
          next.push({ floor, cell: game.grid[game.row + row][game.column + column], move: { kind: 'walk', facing } });
        }
        for (const { floor: toFloor, cell: to, move } of next) {
          if (seen.has(to)) continue;
          seen.add(to);
          queue.push({ floor: toFloor, cell: to, moves: [...moves, move] });
        }
      }
    }
    game.floor = savedFloor;
    game.placeInCorridor(saved.cell, saved.facing);
    assert.ok(found, `a way to cell ${toCell}`);
    return found;
  }

  face(facing) {
    const { game } = this;
    if (game.facing === facing) return;
    if ((game.facing + 1) % 4 === facing) game.pressKey('move-right');
    else if ((game.facing + 3) % 4 === facing) game.pressKey('move-left');
    else game.pressKey('move-back');
    this.settle();
    assert.equal(game.facing, facing);
  }

  walkTo(cell) {
    const { game } = this;
    if (game.mode === MODE.ROOM) this.leave();
    assert.equal(game.mode, MODE.CORRIDOR);
    for (const move of this.path(cell)) {
      this.face(move.facing);
      if (move.kind === 'walk') {
        game.pressKey('move-forward');
        this.settle();
      } else {
        this.clickSpot(game.hotspots().find(({ kind }) => kind === 'door'));
        if (move.kind === 'lift') {
          game.moveCursor(180, game.boxes.rowTop(game.box, 3 - move.floor) + 2);
          game.click();
        }
        this.settle();
      }
    }
    assert.equal(game.cell, cell);
  }

  clickSpot({ x0, x1, y0, y1 }) {
    this.game.moveCursor((x0 + x1) >> 1, (y0 + y1) >> 1);
    this.game.click();
  }

  chooseVerb(verb) {
    const { game } = this;
    const arm = game.verbArms().find((candidate) => candidate.verb === verb);
    game.moveCursor(game.verbs.x + arm.dx + 1, game.verbs.y + arm.dy + 1);
    game.click();
  }

  // Uses the door to a room, from the corridor beside it.
  enter(room) {
    const { game } = this;
    const { firstFloor, secondFloor, thirdFloor } = game.tables;
    let place = null;
    [firstFloor, secondFloor, thirdFloor].forEach((grid) => {
      grid.forEach((row, rowIndex) => {
        row.forEach((cell, columnIndex) => {
          if (cell < 26) return;
          STEP.forEach(([stepRow, stepColumn], facing) => {
            if (grid[rowIndex + stepRow]?.[columnIndex + stepColumn] === room && game.doorsAt(cell)[facing] >= 0) {
              place = { cell, facing };
            }
          });
        });
      });
    });
    assert.ok(place, `a door to room ${room}`);
    this.walkTo(place.cell);
    this.face(place.facing);
    return game.hotspots().find(({ kind }) => kind === 'door');
  }

  goInto(room) {
    const { game } = this;
    this.clickSpot(this.enter(room));
    this.chooseVerb(VERB.USE);
    this.settle();
    assert.equal(game.room, room);
    this.clearText();
  }

  leave() {
    const { game } = this;
    game.moveCursor(180, 310);
    assert.equal(game.action().kind, 'leave');
    game.click();
    this.settle();
    this.clearText();
    if (game.fight) this.fightIt();
    this.clearText();
  }

  // Using a thing in the room or corridor.
  use(id) {
    const { game } = this;
    const spot = game.hotspots().find((candidate) => candidate.id === id);
    assert.ok(spot, `${id} can be clicked in room ${game.room}`);
    this.clickSpot(spot);
    this.chooseVerb(VERB.USE);
  }

  useItemOn(id, item) {
    const { game } = this;
    const spot = game.hotspots().find((candidate) => candidate.id === id);
    assert.ok(spot, `${id} can be clicked`);
    this.clickSpot(spot);
    this.chooseVerb(VERB.INVENTORY);
    this.chooseInventoryItem(item);
  }

  // Brings up an item with the arrow key, and uses it.
  chooseInventoryItem(item) {
    const { game } = this;
    assert.ok(game.inventory.isOpen, 'the inventory is open');
    assert.ok(game.hasItem(item), `the player has item ${item}`);
    while (game.inventory.item !== item) game.pressKey('ArrowRight');
    game.pressKey('Enter');
  }

  useItem(item) {
    this.game.pressKey('inventory');
    this.chooseInventoryItem(item);
  }

  equipBest() {
    const { game } = this;
    const weapon = [2, 1].find(
      (index) => game.hasItem(WEAPON_ITEM[index]) && (game.bullets[index] > 0 || game.loaded[index] > 0),
    );
    if (weapon !== undefined && game.weapon !== weapon) game.equip(weapon);
  }

  // Aims at the monster until one of them is dead.
  fightIt() {
    const { game } = this;
    this.equipBest();
    let limit = 200000;
    while (game.fight && !game.gameOver && limit-- > 0) {
      game.tick();
      if (game.box) {
        if (game.timedDialogue <= 0) game.click();
        continue;
      }
      if (!game.fight || game.fight.intro || game.fade) continue;
      if (game.health < 40) {
        if (game.hasItem(6)) this.useItem(6);
        else if (game.hasItem(114)) this.useItem(114);
      }
      const { fight } = game;
      const box = fight.hitBox();
      game.moveCursor(SCREEN_X + fight.x + box.left + (box.width >> 1), fight.y + box.top + (box.height >> 1));
      if (fight.health > 0 && limit % 3 === 0) game.click();
    }
    assert.ok(limit > 0, 'the fight ended');
    assert.equal(game.gameOver, false, `the player survived in chapter ${game.chapter}`);
    this.settle();
    this.clearText();
  }

  // Types a number on the phone.
  solvePhone() {
    const { game } = this;
    const { puzzle } = game;
    this.clearText();
    for (const digit of game.tables.phoneCode) game.pressKey(String(digit));
    while (game.puzzle === puzzle) game.tick();
    this.clearText();
  }

  // Puts the three papers where their hands meet.
  solvePapers() {
    const { game } = this;
    const { puzzle } = game;
    this.clearText();
    const placing = findPaperPlaces(puzzle);
    assert.ok(placing, 'the papers can be placed');
    placing.forEach(({ index, turn, x, y }) => {
      const piece = puzzle.pieces[index];
      game.moveCursor(SCREEN_X + piece.x + (piece.width >> 1), piece.y + (piece.height >> 1));
      game.click();
      while (piece.turn !== turn) game.pressKey('hotspot-next');
      game.moveCursor(SCREEN_X + x, y);
      game.tick();
      game.click();
    });
    assert.notEqual(game.puzzle, puzzle, 'the papers joined up');
    this.clearText();
  }

  solveClock() {
    const { game } = this;
    const { puzzle } = game;
    this.clearText();
    const size = puzzle.buttonSize;
    game.moveCursor(SCREEN_X + puzzle.forwardX + (size.width >> 1), puzzle.buttonY + 2);
    while (!puzzle.isSolved()) game.click();
    game.pressSoftKey('left');
    this.clearText();
  }

  solveSafe() {
    const { game } = this;
    const { puzzle } = game;
    this.clearText();
    if (puzzle.art.kind === 'dial') {
      const clickOn = ({ x, y, width, height }) => {
        game.moveCursor(SCREEN_X + x + (width >> 1), y + (height >> 1));
        game.click();
      };
      clickOn(puzzle.dialPlace);
      clickOn(puzzle.dialPlace);
      clickOn(puzzle.buttonPlaces[2]);
    } else {
      for (const digit of '001') game.pressKey(digit);
    }
    assert.equal(puzzle.digits.join(''), '001');
    game.pressSoftKey('left');
    this.clearText();
  }

  // The walkthrough's pours.
  solveBottles() {
    const { game } = this;
    const { puzzle } = game;
    this.clearText();
    const clickOn = (name) => {
      const { x, y, width, height } = puzzle.places[name];
      game.moveCursor(SCREEN_X + x + (width >> 1), y + (height >> 1));
      game.click();
    };
    const pours = [
      ['eight', 'three'],
      ['three', 'five'],
      ['eight', 'three'],
      ['three', 'five'],
      ['five', 'eight'],
      ['three', 'five'],
      ['eight', 'three'],
    ];
    for (const [from, to] of pours) {
      clickOn(from);
      clickOn(to);
    }
    assert.equal(puzzle.sand.eight, 4);
    clickOn('eight');
    clickOn('button');
    assert.notEqual(game.puzzle, puzzle);
    this.clearText();
  }

  solvePearls() {
    const { game } = this;
    const { puzzle } = game;
    this.clearText();
    const places = { 68: [186, 209], 69: [120, 141], 70: [120, 272], 71: [47, 209] };
    for (const [item, [x, y]] of Object.entries(places)) {
      game.moveCursor(SCREEN_X + x, y);
      game.click();
      this.chooseInventoryItem(Number(item));
    }
    game.pressSoftKey('left');
    assert.notEqual(game.puzzle, puzzle);
    this.clearText();
  }
}

// Tries each piece's turn in a grid of places, until the puzzle's own test passes.
function findPaperPlaces(puzzle) {
  const saved = puzzle.pieces.map((piece) => ({ ...piece }));
  const restore = () => {
    saved.forEach((piece, index) => {
      Object.assign(puzzle.pieces[index], piece);
    });
  };
  const put = (index, turn, x, y) => {
    const piece = puzzle.pieces[index];
    const { width, height, turn: from } = saved[index];
    const swapped = (turn - from) % 2 !== 0;
    Object.assign(piece, { turn, x, y, width: swapped ? height : width, height: swapped ? width : height });
  };
  const size = saved[1].height;
  for (let turnA = 0; turnA < 4; turnA++) {
    for (let turnB = 0; turnB < 4; turnB++) {
      for (let turnC = 0; turnC < 4; turnC++) {
        put(0, turnA, 60, 60);
        const handsA = puzzle.ends(0);
        for (let bx = 2; bx < 200; bx += 10) {
          for (let by = 4; by < 240; by += 10) {
            put(1, turnB, bx, by);
            const handsB = puzzle.ends(1);
            const close = handsA.some(([ax, ay]) =>
              handsB.some(([ox, oy]) => Math.abs(ax - ox) < 30 && Math.abs(ay - oy) < 30),
            );
            if (!close) continue;
            for (let cx = 2; cx < 200; cx += 10) {
              for (let cy = 4; cy < 240; cy += 10) {
                put(2, turnC, cx, cy);
                puzzle.pieces[0].layer = 0;
                puzzle.pieces[1].layer = 1;
                puzzle.pieces[2].layer = 2;
                if (puzzle.isSolved()) {
                  const answer = [
                    [0, turnA, 60, 60],
                    [1, turnB, bx, by],
                    [2, turnC, cx, cy],
                  ].map(([index, turn, x, y]) => ({
                    index,
                    turn,
                    x: x + (size >> 1),
                    y: y + (size >> 1),
                  }));
                  restore();
                  return answer;
                }
              }
            }
          }
        }
      }
    }
  }
  restore();
  return null;
}

async function playThrough(id) {
  const data = loadMobile3(await readJar(readInput(id)));
  const player = new Player(data);
  const { game } = player;
  const say = () => `${id}, chapter ${game.chapter}, room ${game.room}, cell ${game.cell}`;

  // Vincent, in the real world.
  assert.equal(game.chapter, 1);
  player.walkTo(35);
  player.face(FACING.EAST);
  player.use(166);
  player.clearText();
  assert.ok(game.hasItem(121), 'the map');

  player.goInto(10);
  player.use(31);
  player.clearText();
  assert.ok(game.hasItem(ITEM.ICE), `the ice block, ${say()}`);
  player.useItemOn(37, ITEM.ICE);
  player.clearText();
  assert.ok(game.hasItem(ITEM.GOLD_KEY), 'the gold key');

  // The phone by the locked bedroom.
  player.walkTo(42);
  player.face(FACING.SOUTH);
  player.use(145);
  player.solvePhone();
  assert.equal(game.room, 13);
  player.use(47);
  player.clearText();
  assert.ok(game.hasItem(108), 'the first fragment');
  player.leave();

  player.goInto(1);
  player.use(18);
  player.clearText();
  assert.ok(game.hasItem(ITEM.CHAIN), 'the chain');

  // Upstairs, with the gold key.
  player.walkTo(50);
  player.face(FACING.WEST);
  player.useItemOn(game.hotspots().find(({ kind }) => kind === 'door').id, ITEM.GOLD_KEY);
  player.settle();
  player.clearText();
  assert.equal(game.room, 18);
  player.use(84);
  player.clearText();
  player.use(85);
  player.clearText();
  assert.ok(game.hasItem(109), 'the second fragment');

  player.goInto(20);
  player.use(110);
  player.clearText();
  assert.ok(game.hasItem(ITEM.LIGHTER), 'the lighter');
  player.use(95);
  player.clearText();
  assert.ok(game.bullets[1] >= 10, 'bullets');
  player.use(98);
  player.solvePapers();
  assert.equal(game.world, 2, 'the papers lead to the dark world');

  // The dark world, and the first fight.
  player.leave();
  assert.equal(game.fight, null);
  assert.ok(game.roomCleared[20], 'the first monster is dead');
  player.goInto(5);
  player.use(139);
  player.clearText();
  assert.ok(game.hasItem(ITEM.OLD_KEY), 'the old key');
  player.leave();
  assert.ok(game.roomCleared[5]);
  player.goInto(4);
  player.useItemOn(136, ITEM.CHAIN);
  player.clearText();
  assert.ok(game.hasItem(ITEM.RED_PEARL), 'the red pearl');
  player.goInto(9);
  player.use(62);
  player.clearText();
  assert.ok(game.hasItem(ITEM.PISTOL), 'the Beretta');

  player.goInto(20);
  player.use(144);
  player.clearText();
  assert.equal(game.world, 1, 'the seal leads back');

  player.walkTo(56);
  player.face(FACING.WEST);
  player.useItemOn(game.hotspots().find(({ kind }) => kind === 'door').id, ITEM.OLD_KEY);
  player.settle();
  player.clearText();
  assert.equal(game.room, 24);
  player.use(89);
  player.clearText();
  assert.ok(game.hasItem(113), 'the lighter fuel');
  player.use(90);
  player.clearText();
  assert.ok(game.hasItem(ITEM.BLUE_PEARL), 'the blue pearl');

  player.goInto(25);
  player.useItemOn(80, ITEM.LIGHTER);
  player.clearText();
  assert.ok(game.ruleFired[35], 'the candles are lit');

  // The dining room's clock, which ends Vincent's part.
  player.walkTo(37);
  player.face(FACING.EAST);
  player.use(152);
  player.solveClock();
  assert.equal(game.chapter, 2, say());

  // Emilie kills five monsters and comes back to the real world.
  assert.equal(game.room, 10);
  assert.equal(game.world, 2);
  player.leave();
  assert.ok(game.roomCleared[10]);
  for (const room of [14, 22, 11, 5]) {
    player.goInto(room);
    if (room === 11) {
      player.use(141);
      player.clearText();
      assert.ok(game.hasItem(ITEM.SHOTGUN), 'the shotgun');
    }
    if (room === 22) {
      player.use(139);
      player.clearText();
    }
    player.leave();
    assert.ok(game.roomCleared[room], `room ${room} is clear, ${say()}`);
  }
  assert.equal(game.monstersKilled(), 5);
  player.goInto(20);
  player.use(144);
  player.clearText();
  assert.equal(game.world, 1);
  player.goInto(19);
  player.use(56);
  player.clearText();
  assert.ok(game.hasItem(ITEM.KNIFE), 'the holy knife');
  player.goInto(7);
  player.useItem(ITEM.KNIFE);
  player.clearText();
  assert.equal(game.chapter, 3, say());

  // Vincent again, for the last two pearls.
  assert.equal(game.room, 7);
  player.use(140);
  player.clearText();
  assert.ok(game.hasItem(ITEM.SHOTGUN));
  player.use(30);
  player.clearText();
  player.goInto(2);
  player.useItemOn(23, ITEM.CHAIN);
  player.clearText();
  assert.ok(game.hasItem(ITEM.RUSTY_KEY), 'the rusty key');
  player.leave();
  assert.ok(game.roomCleared[2]);
  player.walkTo(48);
  player.face(FACING.EAST);
  player.useItemOn(game.hotspots().find(({ kind }) => kind === 'door').id, ITEM.RUSTY_KEY);
  player.settle();
  player.clearText();
  assert.equal(game.room, 15);
  player.use(53);
  player.solveSafe();
  player.use(54);
  player.clearText();
  assert.ok(game.hasItem(ITEM.BLACK_PEARL), 'the black pearl');
  player.leave();
  assert.ok(game.roomCleared[15]);
  player.goInto(20);
  player.use(144);
  player.clearText();
  assert.equal(game.world, 2);
  player.walkTo(39);
  player.face(FACING.SOUTH);
  player.use(159);
  player.solveBottles();
  assert.equal(game.room, 11);
  player.use(141);
  player.clearText();
  assert.ok(game.hasItem(ITEM.YELLOW_PEARL), 'the yellow pearl');

  // The door to the last room, and Karen.
  player.walkTo(56);
  player.face(FACING.SOUTH);
  player.clickSpot(game.hotspots().find(({ kind }) => kind === 'door'));
  player.chooseVerb(VERB.USE);
  player.solvePearls();
  assert.equal(game.fight?.monster, 4, say());
  player.fightIt();
  assert.ok(game.frontEnd, 'the game ends back at the main menu');
  assert.equal(game.frontEnd.stage, 'main');
  return player;
}

// The builds the port follows come down to these different programs. Their other copies only
// have different icons or manifests.
for (const id of FOLLOWED_PROGRAMS) {
  test(`${id} can be played from a new game to the ending`, async () => {
    const player = await playThrough(id);
    assert.ok(player.game.hasSave(), 'chapters save the game as they start');
  });
}
