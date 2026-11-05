import { animationBounds, animationSize, LOOP, ONCE, Playing } from './data.mjs';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './ui.mjs';

// The four monsters, as in GameMidlet.y(int) and the fourth mode of its update. All positions
// are on the phone's 240-pixel screen.
const CENTER_X = SCREEN_WIDTH >> 1;
const CENTER_Y = SCREEN_HEIGHT >> 1;
const NONE = -1;
const INTRO_FLASH = 500;
const WIN_PAUSE = 3000;
const TELEPORT_DARK = 2000;

const ANIMATION_COUNTS = [0, 4, 10, 6, 16];
const BY_STANCE = (values) => (fight) => values[fight.stance];

// Which animation each state of a monster is. Monsters 2 and 4 have different ones in each
// of their stances, the places they stand. From GameMidlet.v() to C().
const ATTACK = [0, () => 1, () => 7, () => 1, BY_STANCE([5, 1, 9, 13])];
const SECOND_ATTACK = [0, () => NONE, () => NONE, () => 2, BY_STANCE([5, 1, 9, 13])];
const CHARGE = [0, () => NONE, () => NONE, () => 5, () => NONE];
const TAUNT = [0, () => NONE, () => NONE, () => 3, () => NONE];
const HURT = [0, () => NONE, BY_STANCE([4, 5, 6, 4]), () => NONE, () => NONE];
const STRIKE = [0, () => 2, () => 8, () => 1, BY_STANCE([7, 3, 11, 15])];
const DEATH = [0, () => 3, () => 9, () => 4, BY_STANCE([6, 2, 10, 14])];
const IDLE = [0, () => 0, BY_STANCE([0, 1, 2, 3]), () => 0, BY_STANCE([4, 0, 8, 12])];

// The touch builds' targets, from the fights' part of GameMidlet.h(). Tapping the green one fires
// a sure hit, and the red one a critical hit, twice as hard.
const SURE_EVERY = 3000;
const SURE_SHOWS = 2500;
const CRITICAL_EVERY = 4500;
const CRITICAL_SHOWS = 2000;
const CRITICAL_SHAKE = 200;
const SPARK_SPREAD = 15;

// The targets' timers are the original's static fields, so they carry on from fight to fight.
export function newTargetClock() {
  return {
    sureWait: SURE_EVERY,
    sureLeft: SURE_SHOWS,
    sureShowing: false,
    sureRoll: 0,
    criticalWait: CRITICAL_EVERY,
    criticalLeft: CRITICAL_SHOWS,
    criticalShowing: false,
  };
}

const STRIKE_DAMAGE = [0, 5, 10, 10, 15];
const HEAVY_STRIKE_DAMAGE = [0, 5, 10, 20, 25];

export class Fight {
  constructor(game, monster, inRoom) {
    this.game = game;
    this.monster = monster;
    this.inRoom = inRoom;
    const { data } = game;
    const { tables, hardCoded } = data;
    this.tables = tables;
    this.sheet = tables.monsterSheets[monster];
    this.health = 100;
    this.dead = false;
    this.struck = false;
    this.hitShowing = false;
    this.hitPlace = { x: 0, y: 0 };
    this.spreading = false;
    this.pounce = false;
    this.heavy = false;
    this.extraShowing = false;
    this.direction = 1;
    this.lastFrame = 0;
    this.stance = -1;
    this.nextThink = 0;
    this.nextAttack = tables.monsterAttackGap[monster];
    this.deathWait = 0;
    this.attackCount = 0;
    this.intro = { time: INTRO_FLASH, dark: true, count: 0, showMonster: false };
    this.musicPlaying = false;

    const list = {
      1: tables.monster1Animations,
      2: tables.monster2Animations,
      3: tables.monster3Animations,
      4: tables.monster4Animations,
    }[monster];
    const loops = (index) => (monster === 1 ? index === 0 : monster === 2 && index < 4);
    this.playing = list
      .slice(0, ANIMATION_COUNTS[monster])
      .map((id, index) => (id === NONE ? null : new Playing(data.animation(id), loops(index) ? LOOP : ONCE)));
    this.hit = new Playing(data.animation(hardCoded.hit), ONCE);
    this.hit.running = false;
    this.extras = monster === 3 ? tables.monster3Extras.map((id) => new Playing(data.animation(id), ONCE)) : null;
    this.critical = false;
    this.sparks = null;
    this.setUpTargets();
    this.size = this.playing.map((playing) =>
      playing ? animationSize(data.sheet(this.sheet), playing.animation) : { width: 0, height: 0 },
    );
    this.setUp();
    this.state = this.idle;
  }

  setUp() {
    const { monster, size } = this;
    this.originX = 0;
    this.originY = 0;
    if (monster === 1) {
      const width = Math.max(...size.map((s) => s.width));
      const height = Math.max(...size.map((s) => s.height));
      this.span = Math.trunc((width * 3) / 2);
      this.x = CENTER_X;
      this.originX = -18;
      this.originY = -50;
      this.y = CENTER_Y + 50 + (height >> 2) + 15;
      this.stance = NONE;
    } else if (monster === 2) {
      this.stance = 0;
      this.nextThink = 4000;
      const bottom = SCREEN_HEIGHT - this.game.boxes.softKeyHeight;
      this.placesX = [
        CENTER_X - (size[0].width >> 1),
        0,
        SCREEN_WIDTH - size[2].width,
        CENTER_X - (size[3].width >> 1),
      ];
      this.placesY = [
        CENTER_Y + (size[0].height >> 1),
        CENTER_Y - (size[1].height >> 1),
        CENTER_Y - (size[2].height >> 1),
        bottom - size[3].height,
      ];
      this.x = this.placesX[0];
      this.y = this.placesY[0];
    } else if (monster === 3) {
      this.stance = 0;
      this.placesX = size.map(({ width }) => CENTER_X - (width >> 1));
      this.placesY = size.map(() => CENTER_Y);
      this.extraPlaces = [
        { x: this.placesX[1] + 15, y: this.placesY[1] + 75 },
        { x: this.placesX[2] + 31, y: this.placesY[2] + 39 },
      ];
      this.x = this.placesX[0];
      this.y = this.placesY[0];
    } else {
      this.stance = 2;
      this.placesX = size.map(({ width }, index) => {
        if (index >= 12) return (CENTER_X + width) >> 1;
        return index >= 8 ? CENTER_X : CENTER_X - Math.trunc(width / 2);
      });
      this.placesY = size.map(({ height }, index) => {
        if (index >= 12) return (CENTER_Y + height) >> 1;
        return index >= 8 ? CENTER_Y : CENTER_Y - Math.trunc(height / 2);
      });
      this.x = this.placesX[8];
      this.y = this.placesY[8];
    }
  }

  setUpTargets() {
    const { data } = this.game;
    this.targetArt = data.hardCoded.targets ?? null;
    if (!this.targetArt) return;
    const { sheet, sure, critical } = this.targetArt;
    this.sureSize = animationSize(data.sheet(sheet), data.animation(sure));
    this.criticalSize = animationSize(data.sheet(sheet), data.animation(critical));
    // GameMidlet.o(): the lowest of the health pictures, which the top target sits under.
    const { hud } = data.hardCoded;
    this.belowHealth = Math.max(
      0,
      ...[hud.fine, hud.hurt, hud.dying, hud.damage, hud.healed].map(
        ({ sheet: onSheet, animation }) => animationBounds(data.sheet(onSheet), data.animation(animation)).bottom,
      ),
    );
  }

  get attack() {
    return ATTACK[this.monster](this);
  }
  get secondAttack() {
    return SECOND_ATTACK[this.monster](this);
  }
  get charge() {
    return CHARGE[this.monster](this);
  }
  get taunt() {
    return TAUNT[this.monster](this);
  }
  get hurt() {
    return HURT[this.monster](this);
  }
  get strike() {
    return STRIKE[this.monster](this);
  }
  get death() {
    return DEATH[this.monster](this);
  }
  get idle() {
    return IDLE[this.monster](this);
  }

  enter(state) {
    this.state = state;
    this.playing[state].restart();
  }

  // The rectangle a shot has to land in, from GameMidlet.q() to t().
  hitBox() {
    const { tables, monster, state, stance } = this;
    if (monster === 1) return { left: -30, top: -94, width: 27, height: 62 };
    if (monster === 2) {
      if (state === this.attack || state === this.strike || state === this.death) {
        return { left: 42, top: -13, width: 41, height: 48 };
      }
      return {
        left: tables.monster2HitLeft[stance],
        top: tables.monster2HitTop[stance],
        width: tables.monster2HitWidth[stance],
        height: tables.monster2HitHeight[stance],
      };
    }
    if (monster === 3) {
      return {
        left: tables.monster3HitLeft[state],
        top: tables.monster3HitTop[state],
        width: tables.monster3HitWidth[state],
        height: tables.monster3HitHeight[state],
      };
    }
    return {
      left: tables.monster4HitLeft[state],
      top: tables.monster4HitTop[state],
      width: tables.monster4HitWidth[state],
      height: tables.monster4HitHeight[state],
    };
  }

  isOnTarget(x, y) {
    if (this.health <= 0) return false;
    const box = this.hitBox();
    const left = this.x + box.left;
    const top = this.y + box.top;
    return x >= left && y >= top && x <= left + box.width && y <= top + box.height;
  }

  // Where the targets are, as the original places them and their tap areas. The red one's spot
  // is meant to be random, but the drawing cancels it out, so it stays at the hit box's corner.
  targets() {
    const clock = this.game.targetClock;
    if (!this.targetArt || !clock || this.health <= 0) return [];
    const list = [];
    if (clock.sureShowing) {
      const { width, height } = this.sureSize;
      const roll = clock.sureRoll;
      let place = null;
      if (roll > 0 && roll < 33) place = this.monster === 2 ? null : { x: SCREEN_WIDTH - 8 - width, y: CENTER_Y };
      else if (roll > 0 && roll < 66) place = this.monster === 2 ? null : { x: 8, y: CENTER_Y };
      else if (roll > 0 && roll < 100) place = { x: CENTER_X - (width >> 1), y: 16 + this.belowHealth };
      if (place) list.push({ kind: 'sure', x: place.x, y: place.y, left: place.x, width, height });
    }
    if (clock.criticalShowing) {
      const { width, height } = this.criticalSize;
      const box = this.hitBox();
      const x = this.x + box.left;
      const y = this.y + box.top;
      list.push({ kind: 'critical', x, y, left: x - (width >> 1), width, height });
    }
    return list;
  }

  // The red one is drawn last, so it's the one a click finds where they meet.
  targetAt(x, y) {
    return (
      this.targets().findLast(
        (target) => x >= target.left && x < target.left + target.width && y >= target.y && y < target.y + target.height,
      ) ?? null
    );
  }

  isAimedAt(x, y) {
    return this.isOnTarget(x, y) || this.targetAt(x, y) !== null;
  }

  // A click on a target is a tap on it, which lands somewhere in the hit box.
  click(x, y) {
    const target = this.targetAt(x, y);
    if (!target) {
      this.fire(this.isOnTarget(x, y));
      return;
    }
    const spot = () => {
      const box = this.hitBox();
      const left = this.x + box.left;
      const top = this.y + box.top;
      const { game } = this;
      return { x: game.randomBetween(left, left + box.width), y: game.randomBetween(top, top + box.height) };
    };
    if (target.kind === 'critical') {
      this.critical = true;
      this.criticalSpot = spot();
    }
    this.fire(true, spot());
  }

  // A shot, as in GameMidlet.c(boolean). A critical waits for the next shot that lands, if this
  // one doesn't, as the original's flag does.
  fire(onTarget, place = { x: this.game.screenX, y: this.game.cursorY }) {
    const { game, tables } = this;
    const weapon = game.weapon;
    if (game.loaded[weapon] === 0) return;
    game.loaded[weapon]--;
    if (game.bullets[weapon] > 0) game.bullets[weapon]--;
    game.playSound(['hit_claw', 'firing_pistol', 'firing_shotgun'][weapon]);

    let lands = onTarget;
    if (this.monster === 2 && weapon === 2 && (this.stance === 1 || this.stance === 2)) lands = false;
    if (lands) {
      let damage = tables.weaponDamage[weapon];
      if (this.monster === 3 && this.state === 3) damage = Math.trunc(damage / 2);
      this.sparks = null;
      if (this.critical) {
        this.critical = false;
        damage *= 2;
        game.shake = CRITICAL_SHAKE;
        this.sparks = this.criticalSpot ?? place;
        if (game.targetClock) game.targetClock.criticalShowing = false;
      }
      damage = Math.trunc((damage * (100 - tables.monsterArmor[this.monster][weapon])) / 100);
      this.health -= damage;
      this.hitPlace = place;
      this.hit.restart();
      this.hitShowing = true;
      if (this.health <= 0) {
        this.enter(this.death);
        this.deathWait = WIN_PAUSE;
        if (this.monster === 2) {
          this.stance = 0;
          this.enter(this.death);
          game.startFade(() => {});
        }
      } else if (this.hurt !== NONE && this.state !== this.attack && this.state !== this.secondAttack) {
        if (this.state !== this.death) this.enter(this.hurt);
      }
    }
    if (weapon !== 0) {
      const sideways = game.randomBetween(5, 10);
      game.moveCursor(
        game.cursorX + (game.randomBit() === 1 ? -sideways : sideways),
        game.cursorY - game.randomBetween(15, 25),
      );
    }
    game.changeWeaponIfEmpty();
    if (!game.reloading && game.loaded[game.weapon] === 0) game.startReload();
  }

  tick(milliseconds) {
    const { game } = this;
    if (this.monster === 3) this.extraShowing = false;
    if (this.intro) {
      this.tickIntro(milliseconds);
      return;
    }
    if (!this.dead && game.fadeIsBlack && this.monster === 2) {
      this.x = this.placesX[this.stance];
      this.y = this.placesY[this.stance];
      if (this.state !== this.death) {
        this.state = this.idle;
        return;
      }
    }
    if (game.dialogue) {
      if (this.monster === 4 && !this.musicPlaying) {
        this.musicPlaying = true;
        game.playSound('music');
      }
      return;
    }
    if (this.musicPlaying) {
      game.stopSound();
      this.musicPlaying = false;
    }
    if (this.dead) return;
    this.tickTargets(milliseconds);
    if (this.hitShowing) {
      this.hit.advance(milliseconds);
      if (!this.hit.running) {
        this.hitShowing = false;
        this.sparks = null;
      }
    }
    const playing = this.playing[this.state];
    playing.advance(milliseconds);
    this.nextThink -= milliseconds;
    this.nextAttack -= milliseconds;
    this.deathWait -= milliseconds;
    if (this.tickState(playing, milliseconds)) return;
    if (this.health > 0) this.think();
  }

  // While the monster lives and nothing covers the fight.
  tickTargets(milliseconds) {
    const clock = this.game.targetClock;
    if (!this.targetArt || !clock || this.health <= 0 || this.game.box) return;
    clock.sureWait -= milliseconds;
    if (clock.sureWait < 0) {
      clock.sureShowing = true;
      clock.sureWait = SURE_EVERY;
      clock.sureRoll = this.game.randomBetween(0, 100);
    }
    if (clock.sureShowing) {
      clock.sureLeft -= milliseconds;
      if (clock.sureLeft < 0) {
        clock.sureShowing = false;
        clock.sureLeft = SURE_SHOWS;
      }
    }
    clock.criticalWait -= milliseconds;
    if (clock.criticalWait < 0) {
      clock.criticalShowing = true;
      clock.criticalWait = CRITICAL_EVERY;
    }
    if (clock.criticalShowing) {
      clock.criticalLeft -= milliseconds;
      if (clock.criticalLeft < 0) {
        clock.criticalShowing = false;
        clock.criticalLeft = CRITICAL_SHOWS;
      }
    }
  }

  tickIntro(milliseconds) {
    const { intro } = this;
    intro.time -= milliseconds;
    if (intro.time < 0) {
      this.intro = null;
      return;
    }
    intro.dark = !intro.dark;
    if (!intro.dark) {
      intro.count++;
      intro.showMonster = intro.count % 2 === 0 && this.game.randomBit() === 1;
    }
  }

  // Follows the current animation on, and says whether the fight has just ended.
  tickState(playing, milliseconds) {
    const { game, state } = this;
    if (state === this.idle) return false;
    if (state === this.strike && !this.pounce) {
      game.showBloodOverlay();
      this.state = this.idle;
      const damage = (this.heavy ? HEAVY_STRIKE_DAMAGE : STRIKE_DAMAGE)[this.monster];
      this.heavy = false;
      game.damagePlayer(damage);
      this.nextAttack = this.tables.monsterAttackGap[this.monster];
      return game.health <= 0;
    }
    if (state === this.death) {
      if (this.deathWait < 0) {
        this.dead = true;
        game.fightWon(this);
        return true;
      }
      return false;
    }
    if (state === this.attack || state === this.secondAttack) {
      if (this.monster === 3) {
        this.extraShowing = true;
        const extra = this.extras[state === this.secondAttack ? 0 : 1];
        extra.advance(milliseconds);
        if (!extra.running) {
          this.extraShowing = false;
          this.pounce = false;
          this.state = this.strike;
          extra.restart();
        }
      } else if (!playing.running) {
        this.enter(this.strike);
        game.vibrateFor(0);
      }
      return false;
    }
    if (state === this.hurt && !playing.running) this.enter(this.idle);
    return false;
  }

  think() {
    [null, this.thinkFirst, this.thinkSecond, this.thinkThird, this.thinkFourth][this.monster].call(this);
  }

  // Sways from side to side, and sometimes lunges.
  thinkFirst() {
    const { game } = this;
    if (this.nextThink < 0) {
      if (game.randomBit() === 1) {
        this.direction = -this.direction;
        game.playSound('monster_movement');
      }
      this.nextThink = 3000;
    }
    let step = 0;
    const playing = this.playing[this.state];
    if (this.state === this.idle && playing.frame !== this.lastFrame) {
      if (playing.frame === 1) step = 6;
      else if (playing.frame === 2) step = 4;
      this.lastFrame = playing.frame;
    }
    this.x += step * this.direction;
    if (this.nextAttack < 0 && !this.critical) {
      if (game.randomBit() === 1) this.enter(this.attack);
      this.nextAttack = this.tables.monsterAttackGap[1];
    }
    if (this.x + this.originX - (this.span >> 1) < 0) this.x = -this.originX + (this.span >> 1);
    if (this.x + this.originX + (this.span >> 1) > SCREEN_WIDTH) {
      this.x = SCREEN_WIDTH - this.originX - (this.span >> 1);
    }
  }

  isBusy() {
    return (
      this.state === this.attack ||
      this.state === this.secondAttack ||
      this.state === this.strike ||
      this.state === this.hurt ||
      this.hitShowing
    );
  }

  // Disappears, and comes back somewhere else. Only attacks from the front, from below.
  thinkSecond() {
    const { game, tables } = this;
    if (this.isBusy() && this.nextThink < 0) this.nextThink = 0;
    if (this.stance === 3 && this.nextThink < 0 && this.attackCount < 3) this.nextThink = 0;
    if (this.nextThink < 0) {
      game.playSound('monster_movement');
      const previous = this.stance;
      while (this.stance === previous) {
        const roll = game.randomBetween(0, 100);
        if (roll > 0 && roll < tables.monster2Odds[1]) this.stance = 1;
        if (roll > tables.monster2Odds[1] && roll < tables.monster2Odds[2]) this.stance = 2;
        if (roll > tables.monster2Odds[2] && roll < tables.monster2Odds[3]) this.stance = 3;
        if (this.stance === 3 && previous === 0) this.stance = previous;
      }
      if (this.stance === 3) {
        this.nextAttack = 0;
        this.attackCount = 0;
      }
      this.nextThink = 4000;
      game.startFade(() => {}, TELEPORT_DARK);
      this.hitShowing = false;
    }
    if (this.nextAttack < 0 && this.stance === 3 && !this.critical) {
      this.attackCount++;
      this.enter(this.attack);
      this.nextAttack = tables.monsterAttackGap[2];
    }
  }

  // Sometimes waits, then lands a heavier blow.
  thinkThird() {
    const { game, tables } = this;
    if ((this.state === this.idle || this.state === this.taunt) && this.nextAttack < 0 && !this.critical) {
      if (game.randomBetween(0, 100) < 45) {
        this.pounce = true;
        this.enter(this.attack);
        this.nextAttack = tables.monsterAttackGap[3];
      } else if (game.randomBetween(0, 100) < 80) {
        this.state = this.charge;
        this.nextAttack = 2500;
      } else {
        this.state = this.taunt;
        this.nextAttack = tables.monsterAttackGap[3];
      }
    }
    if (this.state === this.charge && this.nextAttack < 0 && !this.critical) {
      this.heavy = true;
      this.enter(this.secondAttack);
      this.nextAttack = tables.monsterAttackGap[3];
    }
    if (this.state === this.taunt && this.nextAttack < 0 && game.randomBetween(0, 30) === 0 && !this.critical) {
      this.state = this.idle;
      this.nextAttack = tables.monsterAttackGap[3];
    }
    this.x = this.placesX[this.state];
    this.y = this.placesY[this.state];
  }

  // Moves between four places. It only shows the move once it next attacks.
  thinkFourth() {
    const { game, tables } = this;
    if (this.isBusy() && this.nextThink < 0) this.nextThink = 0;
    if (this.nextThink < 0) {
      const previous = this.stance;
      while (this.stance === previous) {
        this.heavy = false;
        const roll = game.randomBetween(0, 100);
        if (roll > 0 && roll < 20) this.stance = 0;
        else if (roll > 0 && roll < 50) {
          this.heavy = true;
          this.stance = 2;
        } else if (roll > 0 && roll < 80) this.stance = 3;
        else if (roll > 0) this.stance = 1;
      }
      this.nextThink = tables.monsterAttackGap[4];
      this.hitShowing = false;
    }
    if (this.nextAttack < 0 && !this.critical) {
      this.enter(this.attack);
      this.nextAttack = tables.monsterAttackGap[4];
    }
    // The original reads these two tables crosswise, and its fights are arranged around that.
    this.x = this.placesY[this.state];
    this.y = this.placesX[this.state];
  }

  // What to draw, on the phone's screen. The caller draws the background behind it.
  sprites() {
    const { game, state, sheet } = this;
    const sprite = (playing, onSheet, x, y) => ({
      sheet: onSheet,
      animation: playing.animation,
      frame: playing.frame,
      x,
      y,
    });
    if (state === this.strike && !this.pounce && this.playing[this.attack]) {
      const attack = this.playing[this.attack];
      return [
        sprite(attack, sheet, this.x, this.y),
        sprite(this.playing[state], game.data.hardCoded.hitSheet, CENTER_X, CENTER_Y + 20),
        ...this.targetSprites(),
      ];
    }
    const list = [sprite(this.playing[state], sheet, this.x, this.y)];
    if (this.hitShowing) {
      const { hitSheet } = game.data.hardCoded;
      const { x, y } = this.hitPlace;
      list.push(sprite(this.hit, hitSheet, x, y));
      if (this.sparks) {
        const { x: sx, y: sy } = this.sparks;
        for (const [dx, dy] of [
          [-SPARK_SPREAD, 0],
          [SPARK_SPREAD, 0],
          [0, SPARK_SPREAD],
          [0, -SPARK_SPREAD],
        ]) {
          list.push(sprite(this.hit, hitSheet, sx + dx, sy + dy));
        }
      }
    }
    if (this.extraShowing) {
      const which = state === this.secondAttack ? 0 : 1;
      const { x, y } = this.extraPlaces[which];
      list.push(sprite(this.extras[which], game.data.hardCoded.monster3ExtraSheet, x, y));
    }
    list.push(...this.targetSprites());
    return list;
  }

  targetSprites() {
    if (!this.targetArt) return [];
    const { sheet, sure, critical } = this.targetArt;
    return this.targets().map(({ kind, x, y }) => ({
      sheet,
      animation: kind === 'sure' ? sure : critical,
      frame: 0,
      x,
      y,
    }));
  }

  monsterSprite() {
    const playing = this.playing[this.state];
    return { sheet: this.sheet, animation: playing.animation, frame: playing.frame, x: this.x, y: this.y };
  }
}
