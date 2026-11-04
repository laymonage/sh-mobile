// Plays Silent Hill through the same inputs a player has: moving the pointer,
// clicking and pressing keys. `scripts/find-route.mjs` uses this to search for a way
// through the game, and `test/playthrough.test.mjs` to replay the route it found.
//
// A route is a list of steps, each a string:
//   click <object>            click something that acts straight away, such as an exit
//   click <object> <verb>     click it, then look, hand or mouth on the verb wheel
//   use <object> <item>       click it, then use an item from the wheel's inventory
//   item <item> <action>      open the inventory, then look, equip or unequip
//   key <key>                 press a key
//   choose <row>              pick a row of a choice menu
//   clicks <script>...        click these in turn, for a puzzle's buttons
//   fight                     aim and shoot until the enemy is dead
// An <object> is `script#index`, because a room can use one script twice.

import { EVENT, Game, MENU, VERB, verbWheelCenter } from '../web/engine/game.mjs';
import { toInt } from '../web/engine/vm.mjs';

const TICK_MS = 60;
const WAIT_TICK_MS = 200;
const FADE_TICK_MS = 300;
const POPUP_WAIT_MS = 600;
// How long nothing has to happen before the game is taken to be waiting for the player.
const CALM_TICKS = 25;
const SETTLE_LIMIT = 6000;
const FIGHT_LIMIT = 2500;
const LOW_HEALTH = 2;
const VERBS = { look: VERB.LOOK, hand: VERB.HAND, mouth: VERB.MOUTH };
const WHEEL_OFFSETS = {
  [VERB.LOOK]: [0, -20],
  [VERB.HAND]: [20, 0],
  [VERB.MOUTH]: [0, 20],
  [VERB.INVENTORY]: [-20, 0],
};
const CHOICE_USE = -2;
const ITEM_ACTIONS = { use: CHOICE_USE, look: EVENT.LOOKAT, equip: EVENT.EQUIP, unequip: EVENT.UNEQUIP };

// The clock and the dice live on the game, so that a copy of a game carries on from
// exactly where the original was.
export function newPlaythroughGame(data, { seed = 12345, storage = null } = {}) {
  const game = new Game(data, { language: 'en', storage });
  game.clock = 1000;
  game.seed = seed;
  game.now = function now() {
    return this.clock;
  };
  game.random = function random() {
    this.seed = (Math.imul(this.seed, 1103515245) + 12345) & 0x7fffffff;
    return this.seed / 0x80000000;
  };
  game.startNewGame();
  return game;
}

// A key press takes this many ticks, which is about as fast as a person can tap.
const TICKS_PER_KEY = 2;
const AIM_SLOWDOWN_DISTANCE = 3;
const HOTSPOT_PRESS_LIMIT = 60;
const AIM_DIRECTIONS = [
  ['left', 'right', 'x', 'cursorX'],
  ['up', 'down', 'y', 'cursorY'],
];
const VERB_ARROWS = {
  [VERB.LOOK]: 'ArrowUp',
  [VERB.HAND]: 'ArrowRight',
  [VERB.MOUTH]: 'ArrowDown',
  [VERB.INVENTORY]: 'ArrowLeft',
};

// `chooseRow` puts the pointer on a menu row. Rows are laid out by the renderer, so
// without one, the row is marked directly, as a pointer over it would. With `keyboard`,
// nothing uses the pointer at all.
export class Player {
  constructor(game, { step = null, chooseRow = null, keyboard = false } = {}) {
    this.game = game;
    this.keyboard = keyboard;
    this.tick =
      step ??
      ((ms = TICK_MS) => {
        game.clock += ms;
        game.tick();
      });
    this.chooseRow =
      chooseRow ??
      ((menu, row) => {
        menu.hovered = row;
      });
  }

  isIdle() {
    const game = this.game;
    return (
      !game.mainMenu &&
      !game.menus.length &&
      !game.popups.length &&
      !game.pausedThread &&
      game.waitStop <= 0 &&
      game.pendingRoom === null &&
      game.transitionCounter === null
    );
  }

  // Runs until the game wants something: 'idle', 'choice', 'end' or 'stuck'.
  settle() {
    const game = this.game;
    let calm = 0;
    for (let i = 0; i < SETTLE_LIMIT; i++) {
      if (game.mainMenu) return 'end';
      const menu = game.menus.at(-1);
      if (game.popups.length) {
        game.clock += POPUP_WAIT_MS;
        this.confirm();
        this.tick();
      } else if (menu?.id === MENU.SAY || menu?.id === MENU.RECEIVED) {
        this.confirm();
        this.tick();
      } else if (menu?.id === MENU.TEXT_FADE) {
        this.tick(FADE_TICK_MS);
      } else if (menu?.id === MENU.CHOICE) {
        return 'choice';
      } else if (menu) {
        // Using an item leaves its page and the wheel open behind the text.
        game.pressKey('Escape');
        this.tick();
      } else {
        this.tick(game.isWaiting() ? WAIT_TICK_MS : TICK_MS);
        calm = this.isIdle() ? calm + 1 : 0;
        if (calm > CALM_TICKS) return 'idle';
        continue;
      }
      calm = 0;
    }
    return 'stuck';
  }

  pointOn(object) {
    return this.game.clickPointOn(object);
  }

  // Moves on from text, or fires.
  confirm() {
    if (this.keyboard) this.game.pressKey('Enter');
    else this.game.click();
  }

  pressKey(key) {
    this.game.pressKey(key);
    for (let i = 0; i < TICKS_PER_KEY; i++) this.tick();
  }

  // Taps E until the cursor reaches the object, and then Enter.
  pressObject(object) {
    const game = this.game;
    for (let i = 0; game.overObject?.scriptId !== object.scriptId; i++) {
      if (i >= HOTSPOT_PRESS_LIMIT) throw new Error(`E never reaches ${object.scriptId} in room ${game.currentRoomId}`);
      this.pressKey('hotspot-next');
    }
    this.pressKey('Enter');
  }

  clickObject(object) {
    if (this.keyboard) {
      this.pressObject(object);
      return;
    }
    const game = this.game;
    const point = this.pointOn(object);
    if (!point) throw new Error(`${object.scriptId} can't be clicked in room ${game.currentRoomId}`);
    game.moveCursor(...point);
    this.tick();
    this.tick();
    if (game.overObject !== object)
      throw new Error(`The pointer isn't over ${object.scriptId} in room ${game.currentRoomId}`);
    game.click();
    this.tick();
  }

  clickVerb(verb) {
    const game = this.game;
    if (this.keyboard) {
      this.pressKey(VERB_ARROWS[verb]);
      this.pressKey('Enter');
      return;
    }
    const center = verbWheelCenter(game.menus.at(-1), game.roomWidth, game.roomHeight);
    const [dx, dy] = WHEEL_OFFSETS[verb];
    game.moveCursor(center.x + dx, center.y + dy);
    game.click();
    this.tick();
  }

  // With the inventory open, turns to the item and picks an action from its page.
  chooseItemAction(item, action) {
    const game = this.game;
    for (let i = 0; i < game.menus.at(-1).items.length && game.itemId !== item; i++) {
      game.pressKey('ArrowRight');
      this.tick();
    }
    const page = game.menus.at(-1);
    if (game.itemId !== item) throw new Error(`There's no ${item} in the inventory`);
    const row = page.choices.findIndex(({ id }) => id === ITEM_ACTIONS[action]);
    if (row === -1) throw new Error(`${item} can't ${action} in room ${game.currentRoomId}`);
    if (this.keyboard) {
      for (let i = 0; i < row; i++) this.pressKey('ArrowDown');
      this.pressKey('Enter');
      return;
    }
    this.chooseRow(page, row);
    game.click();
    this.tick();
  }

  object(name) {
    const [script, index] = name.split('#');
    const object = this.game.objects[Number(index)];
    if (object?.scriptId !== script) throw new Error(`There's no ${name} in room ${this.game.currentRoomId}`);
    return object;
  }

  clickScript(script) {
    const object = this.game.objects.find(
      (candidate) => candidate.scriptId === script && candidate.visible && candidate.active,
    );
    if (!object) throw new Error(`There's no ${script} to click in room ${this.game.currentRoomId}`);
    this.clickObject(object);
    for (let i = 0; i < 12 && (this.game.menus.length || this.game.isWaiting()); i++) {
      if (this.game.menus.at(-1)?.id === MENU.SAY) this.confirm();
      this.tick(WAIT_TICK_MS);
    }
  }

  // Aims at whatever can be shot, and heals when it's getting close.
  fight() {
    const game = this.game;
    let quiet = 0;
    for (let i = 0; i < FIGHT_LIMIT && !game.mainMenu && game.battleMode; i++) {
      if (game.menus.length || game.popups.length) {
        if (game.menus.at(-1)?.id === MENU.CHOICE) return;
        this.confirm();
        this.tick();
        continue;
      }
      const enemy = game.objects.find(({ visible, script }) => visible && script?.hasEvent(EVENT.ATTACK1));
      if (!enemy) {
        if (++quiet > CALM_TICKS) return;
        this.tick();
        continue;
      }
      quiet = 0;
      if (toInt(game.getRaw('sys_health')) <= LOW_HEALTH && game.inventorySize('2g') > 0) {
        game.pressKey('3');
        this.tick();
      }
      if (this.keyboard) this.holdTowards(enemy);
      else game.moveCursor(enemy.x, enemy.y);
      this.tick();
      if (game.hoverObject === enemy && !game.attackAnim && game.ammo > 0 && !game.reloading) {
        this.confirm();
        this.tick();
        this.tick(WAIT_TICK_MS + 100);
      } else {
        this.tick();
      }
    }
  }

  // What a keyboard player presses for the soft key's Back.
  backKey() {
    return /floor|children_drawing|puzzle/i.test(this.game.currentRoomId) ? 'Escape' : 'move-back';
  }

  // Holds the keys that steer the crosshair to the target, as far as it needs them.
  holdTowards(target) {
    const game = this.game;
    for (const [minus, plus, axis, cursor] of AIM_DIRECTIONS) {
      const distance = target[axis] - game[cursor];
      game.holdDirection(minus, distance < -AIM_SLOWDOWN_DISTANCE);
      game.holdDirection(plus, distance > AIM_SLOWDOWN_DISTANCE);
    }
  }

  // Plays one step of a route, and doesn't wait for what it starts.
  perform(step) {
    const game = this.game;
    const [command, ...args] = step.split(' ');
    if (command === 'click') {
      this.clickObject(this.object(args[0]));
      if (args[1]) this.clickVerb(VERBS[args[1]]);
    } else if (command === 'use') {
      this.clickObject(this.object(args[0]));
      this.clickVerb(VERB.INVENTORY);
      this.chooseItemAction(args[1], 'use');
    } else if (command === 'item') {
      game.pressKey('inventory');
      this.tick();
      this.chooseItemAction(args[0], args[1]);
    } else if (command === 'key') {
      game.pressKey(this.keyboard && args[0] === 'back' ? this.backKey() : args[0]);
      this.tick();
    } else if (command === 'choose') {
      if (this.keyboard) {
        const menu = game.menus.at(-1);
        for (let i = 0; i < menu.choices.length && menu.selected !== Number(args[0]); i++) this.pressKey('ArrowDown');
        this.pressKey('Enter');
        return;
      }
      this.chooseRow(game.menus.at(-1), Number(args[0]));
      game.click();
      this.tick();
    } else if (command === 'clicks') {
      for (const script of args) this.clickScript(script);
    } else if (command === 'fight') {
      this.fight();
      for (const [minus, plus] of AIM_DIRECTIONS) {
        game.holdDirection(minus, false);
        game.holdDirection(plus, false);
      }
    } else {
      throw new Error(`Unknown step: ${step}`);
    }
  }
}
