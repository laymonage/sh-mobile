import { ROOM_OBJECT_ZONE_BATTLE } from './format.mjs';
import { CHOICE_BACK, CHOICE_USE, EVENT, Game, MENU, SHOT_VIBRATION_MS, verbWheelCenter, VERB } from './game.mjs';
import { adaptMobile2Texts, mobile2ControlsText, mobile2GameplayText, mobile2HelpFor } from './mobile2-help.mjs';
import { MOBILE_2_TEXT } from './text-tables.mjs';
import { toBoolean, toInt } from './vm.mjs';

// Silent Hill Mobile 2 runs on the same INK engine as Silent Hill, and its scripts use the
// same commands, so this only holds what its engine does differently. It follows
// sh2-2015-base, the build made for a touch screen, whose classes keep no names: M is the
// midlet, e and h the game, g a room object, c a script thread and d a menu.

// The images that take a palette, from the a class.
const ROOM_PALETTE_IMAGES = new Set([
  'ceiling',
  'floor',
  'light',
  'walls',
  'corridor_ceiling',
  'corridor_floor',
  'corridor0_frontA',
  'corridor0_frontB',
  'corridor0_side',
  'corridor1_frontA',
  'corridor1_frontB',
  'corridor1_sideA',
  'corridor1_sideB',
  'corridor2_sideA',
  'corridor2_sideB',
]);
const OBJECT_PALETTE_IMAGES = new Set([
  'deadplant',
  'desk',
  'drawer',
  'paper1',
  'paper3',
  'plant',
  'shelf1',
  'shelf2',
  'shelf3',
  'windowlight',
  'lockerroom_locker_01',
  'dark_floor',
  'dark_chair',
  'dark_chair_blood',
  'dark_wall_front',
  'karensoffice_body',
  'corridor_doorblock_close',
  'corridor_doorblock_side',
  'corridor_doorFrame_close',
  'corridor_doorFrame_front',
  'corridor_doorFrame_side',
  'corridor_doorWindow_close',
  'corridor_doorWindow_front',
  'corridor_doorWindow_side',
  'corridor_door_close',
  'corridor_door_front',
  'corridor_door_side',
  'corridor_elevator_close',
  'corridor_elevator_side',
  'corridor_stairsDown_close',
  'corridor_painting_close',
  'corridor_painting_frame',
  'corridor_painting_side',
  'corridor_stairsDown_side',
  'corridor_stairsUp_close',
  'corridor_stairsUp_side',
  'corridor_window_close',
  'corridor_window_front',
]);

// Which way each exit in the room goes, for the walking keys. Left and right turn, as the
// phone's keys do in h.w, and forward goes only forward, though h.w's also takes the stairs
// and the elevator. The pointer takes the rest, which are all in rooms 3 and 9, mostly
// beside a forward exit or a turn that the key would otherwise sometimes miss.
const EXITS_BY_KEY = {
  forward: ['forward'],
  back: ['back', 'turnback'],
  left: ['turnleft'],
  right: ['turnright'],
};

// Rooms that only show something, which the original's back key leaves. h.y.
const LOOK_ROOMS = new Set(['lightpainting', 'lightwaitingroomdrawing', 'lightsurgeryroomxray']);
const NO_SOFT_KEY_ROOMS = new Set(['lightLastRoom', 'endGame']);
const SKIPPABLE_FADE_ROOM = 'startVincentPlot';

// The states of h.w.
const ENEMY = { IDLE: 0, MOVING: 1, DODGING: 2, GONE: 3, ATTACKING: 4, RECOVERING: 5 };
const ENEMY_ATTACK_CHANCE = 15;
const ENEMY_DODGE_CHANCE = 250;
const ENEMY_DODGE_TICKS = 20;
const ENEMY_ATTACK_TICKS = 20;
const ENEMY_RECOVER_TICKS = 60;
const ENEMY_MOVE_TICKS = 12;
const ENEMY_MOVE_MARGIN = 105;
const ROOMS_WITHOUT_ICONS = ['control', 'start', 'light', 'dark', 'puzzle'];
const ZONE_TICKS = 20;
const RECOIL_VERTICAL = 15;
const RECOIL_HORIZONTAL = 3;
const AMMO_MAX = 10;
const ANIMATION_ENEMY_ATTACK = 1;
const ANIMATION_ENEMY_DODGE = 2;
const ANIMATION_HERO_ATTACK = 4;

const MESSAGE_MS = 2000;

// The three puzzles drawn with a finger, from e.a, e.b and e.c. The original draws the
// line straight into the room's image, and only its position is ever checked.
const STROKE_DELAY_MS = 350;
const STROKE_PUZZLES = {
  puzzleDrawing: { color: 0xff0e0d, solved: 'varPuzzleDrawingIsSolved' },
  puzzleScalpel: { color: 0xbd645e, solved: 'varScalpelPuzzleIsSolved' },
  puzzleBodyIncision: { color: 0x7c0606, solved: 'varLightSurgeryRoomStomachIsCut' },
};

const WHEEL_ARM_REACH = 18;
const WHEEL_HIT_CENTERS = [
  [VERB.LOOK, 2, -15],
  [VERB.INVENTORY, -17, 13],
  [VERB.HAND, 20, 13],
];
const WHEEL_KEYS = { ArrowUp: VERB.LOOK, ArrowLeft: VERB.INVENTORY, ArrowRight: VERB.HAND };

const CONTROL_NAMES = [
  ['UP', 42],
  ['DOWN', 43],
  ['LEFT', 44],
  ['RIGHT', 45],
  ['NUM2', 49],
  ['NUM8', 55],
  ['NUM4', 51],
  ['NUM6', 53],
  ['FIRE', 46],
  ['NUM5', 52],
  ['SOFTKEY_B', 41],
  ['NUM1', 48],
  ['SOFTKEY_A', 40],
];

export class Mobile2Game extends Game {
  static TEXT = MOBILE_2_TEXT;
  static SPEAKER_TEXTS = [
    [MOBILE_2_TEXT.SPEAKER_LUCAS, 0x1c0e70],
    [MOBILE_2_TEXT.SPEAKER_VINCENT, 0xa30c0c],
    [MOBILE_2_TEXT.SPEAKER_KAREN, 0xa20b8a],
  ];
  static FLOOR_VARIABLE = 'varFloor';
  static FLOOR_ROWS = ['floor2', 'floor1', 'basement'];
  static MENU_MUSIC = 'sh_bgtheme';
  static FRAME_VIBRATION = false;
  static ITEM_ICONS = {
    1: ['iconEquipWeapon', 'iconEquipWeaponGrey', 'iconBattle1', 'iconBattle1Grey'],
    3: ['iconUseMedicine', 'iconUseMedicineGrey'],
    inventory: ['iconInv', 'iconInvGrey'],
  };
  static WHEEL_ARMS = { [VERB.LOOK]: [1, -16], [VERB.HAND]: [20, 12], [VERB.INVENTORY]: [-17, 12] };
  static WHEEL_SYMBOLS_X = 2;
  // e.b centers the splash art, and draws the logo over it.
  static SPLASH_CENTERED = true;
  static SPLASH_OVER_LOGO = false;
  // e.c draws this under the room, where the phone's screen is taller than it.
  static PANEL_ART = 'gfx/border_bottom.png';
  static PANEL_ART_IS_STRIP = true;

  constructor(data, options) {
    super(data, options);
    this.imagePalettes = new Map();
    this.activeChoiceRow = 0;
    this.message = null;
    this.strokes = [];
    this.stroke = null;
    this.strokeEnded = false;
  }

  // Text.
  // Only the touch build has this room, and its puzzles are drawn.
  get isTouchBuild() {
    return this.data.entries.has(`${this.dataDir}/rom/puzzleBodyIncision.bin`);
  }

  // The keypad builds have no vibration setting, and run past the command for it.
  get canVibrate() {
    return this.isTouchBuild && Boolean(this.vibrator);
  }

  scriptMayVibrate() {
    return true;
  }

  adaptGameTexts(texts) {
    this.help = mobile2HelpFor(texts);
    return adaptMobile2Texts(texts, this.isTouchBuild);
  }

  gameplayHelp() {
    const original = this.engineText(this.text.GAMEPLAY_TEXT);
    return this.help ? mobile2GameplayText(original, this.help) : original;
  }

  controlsHelp() {
    if (this.help) return mobile2ControlsText(this.help, this.isTouchBuild);
    // A fan translation keeps its own page. The touch build has one, and the keypad builds
    // keep a line per control.
    const touch = this.engineText(this.text.TOUCH_CONTROLS);
    let text =
      touch.trim().length > 1 ? touch : this.text.KEYPAD_CONTROLS.map((index) => this.engineText(index)).join('\n\n');
    for (const [name, index] of CONTROL_NAMES) text = text.replaceAll(`<JAVA_APP_INK_${name}>`, this.engineText(index));
    return text;
  }

  receivedText(item) {
    return this.engineText(this.text.RECEIVED).replace('<item name>', `\n${this.itemName(item)}`);
  }

  // Variables.
  settingVariableClosesMenus() {
    return !this.battleMode;
  }

  // The system variables only this game has, from e.a's case 10.
  setSystemVar(args) {
    const [name, value] = args;
    switch (name) {
      case 's_screenWidth':
        this.setVariable(name, value);
        this.applyRoomSize();
        return;
      case 's_screenHeight':
        this.setVariable(name, value);
        this.applyRoomSize();
        return;
      case 's_txtMessage':
        this.message = { text: String(value), until: this.now() + MESSAGE_MS };
        return;
      case 's_tutorial':
        return;
      case 's_activeMenuItem':
        this.activeChoiceRow = toInt(value) - 1;
        return;
      default:
        super.setSystemVar(args);
    }
  }

  // A room can be narrower than the art's largest size, and the port shows it centered.
  // The original pans over rooms that are all wider than its screen.
  applyRoomSize() {
    const size = (name, frame) => {
      const value = this.variableAsInteger(name);
      return value > 0 ? Math.min(value, frame) : frame;
    };
    this.roomWidth = size('s_screenWidth', this.frameWidth);
    this.roomHeight = size('s_screenHeight', this.frameHeight);
    this.pointerX = Math.min(this.pointerX, this.roomWidth - 1);
    this.pointerY = Math.min(this.pointerY, this.roomHeight - 1);
    this.placeCursor();
  }

  initialChoiceRow() {
    const row = this.activeChoiceRow;
    this.activeChoiceRow = 0;
    return row;
  }

  // Palettes. An image takes its palette from the variables when it's first loaded after a
  // room change, because the a class caches it, whatever the variables are later.
  imagePalette(id) {
    if (typeof id !== 'string') return 0;
    if (!this.imagePalettes.has(id)) {
      let palette = 0;
      if (ROOM_PALETTE_IMAGES.has(id)) palette = this.variableAsInteger('sys_palette');
      else if (OBJECT_PALETTE_IMAGES.has(id)) palette = this.variableAsInteger('sys_paletteObj');
      this.imagePalettes.set(id, palette);
    }
    return this.imagePalettes.get(id);
  }

  roomLoading() {
    this.imagePalettes.clear();
    this.strokes = [];
    this.stroke = null;
    this.strokeEnded = false;
  }

  resetRun() {
    super.resetRun();
    this.roomWidth = this.frameWidth;
    this.roomHeight = this.frameHeight;
    this.activeChoiceRow = 0;
    this.message = null;
    this.imagePalettes?.clear();
    this.strokes = [];
    this.stroke = null;
    this.strokeEnded = false;
  }

  loadGame() {
    const loaded = super.loadGame();
    if (loaded) this.applyRoomSize();
    return loaded;
  }

  restoreGunState() {
    this.gunState = true;
  }

  // This game's ammo isn't held aside without a gun.
  syncGunState() {
    this.gunState = true;
  }

  isEndlessPainting() {
    return false;
  }

  finalBossDead() {
    return false;
  }

  // Inventory: h.a(d, String).
  openInventory() {
    if (this.inventoryItems().length) super.openInventory();
    else this.say(this.engineText(this.text.NOTHING_CARRIED), null);
  }

  itemChoices(item) {
    const choices = [];
    const script = this.getScript(item);
    if (script && (script.hasEvent(EVENT.EQUIP) || script.hasEvent(EVENT.UNEQUIP))) {
      const equipable = toBoolean(this.executeEvent(script, EVENT.ISEQUIPABLE, null));
      const equipped = toBoolean(this.executeEvent(script, EVENT.ISEQUIPED, null));
      if (script.hasEvent(EVENT.EQUIP) && equipable && !equipped) {
        const label =
          item === 'invAmmo' ? this.text.EQUIP_CLIPS : item === 'invGun' ? this.text.EQUIP_GUN : this.text.EQUIP;
        choices.push({ id: EVENT.EQUIP, text: this.engineText(label) });
      }
      if (script.hasEvent(EVENT.UNEQUIP) && equipable && equipped)
        choices.push({ id: EVENT.UNEQUIP, text: this.engineText(this.text.UNEQUIP) });
    } else if (this.overObject) {
      const direction = this.overObject.executeEvent(EVENT.GETMOVEDIR, null);
      if (direction === null || direction === '')
        choices.push({ id: CHOICE_USE, text: this.engineText(this.text.USE) });
    }
    choices.push({ id: EVENT.LOOKAT, text: this.engineText(this.text.LOOK_AT) });
    // The phone's soft key does this. A mouse needs a row for it, as in Silent Hill.
    choices.push({ id: CHOICE_BACK, text: this.engineText(this.text.BACK) });
    return choices;
  }

  // The verb wheel has three arms here, with no mouth: h.a(g) and e.a(int, int).
  verbAtCursor(menu) {
    const { x, y } = verbWheelCenter(menu, this.roomWidth, this.roomHeight);
    for (const [verb, dx, dy] of WHEEL_HIT_CENTERS) {
      if (Math.abs(this.cursorX - x - dx) < WHEEL_ARM_REACH && Math.abs(this.cursorY - y - dy) < WHEEL_ARM_REACH)
        return verb;
    }
    return null;
  }

  verbForKey(key) {
    return WHEEL_KEYS[key];
  }

  // Walking.
  exitGoes(moveDirection, direction) {
    return EXITS_BY_KEY[direction]?.includes(moveDirection) ?? false;
  }

  // h.y also asks for the transition itself, whatever the room change's script said.
  useObject(object) {
    if (object.executeEvent(EVENT.CLICK, -1) === null) {
      if (object.executeEvent(EVENT.GETMOVEDIR, null) && this.pendingRoom !== null) this.transitionRequested = true;
      return;
    }
    this.openVerbMenu(object);
  }

  // Keys. The rules are in h.s, h.y and e.j.
  get roomIsLookOnly() {
    const room = this.currentRoom.toLowerCase();
    return LOOK_ROOMS.has(room) || room.includes('map');
  }

  escapeGoesBack(room) {
    return this.roomIsLookOnly || room.includes('puzzle');
  }

  leavesWithoutAsking() {
    return !this.changedSinceSave || this.currentRoom.startsWith('control') || Boolean(this.pausedThread);
  }

  canLeaveFromPause() {
    return this.currentRoom !== SKIPPABLE_FADE_ROOM;
  }

  isStoryRoom() {
    return toBoolean(this.getRaw('setSkip')) || this.currentRoom === SKIPPABLE_FADE_ROOM;
  }

  canSkipText(menu) {
    this.skippingFade = menu.id === MENU.TEXT_FADE;
    return this.skippingFade ? this.currentRoom === SKIPPABLE_FADE_ROOM : toBoolean(this.getRaw('setSkip'));
  }

  textSkipContinues() {
    return this.skippingFade || toBoolean(this.getRaw('setSkip'));
  }

  // Skipping stops at the first text after setSkip is turned off, which has to stay up.
  textSkipEnded() {
    this.menus = this.pausedThread ? this.menus.slice(-1) : [];
  }

  softKeys() {
    if (this.mainMenu) return this.mainMenu.softKeys();
    if (!this.objects || this.ended) return {};
    const key = (text, action) => ({ label: this.engineText(text), action });
    const { text } = this;
    if (this.popups.length) return { left: key(text.OK, 'click') };
    const menu = this.menus.at(-1);
    const paused = menu?.id === MENU.PAUSE || menu?.fullPage;
    if (!paused && this.isStoryRoom()) return { left: key(text.NEXT, 'click'), right: key(text.SKIP, 'Escape') };
    if (menu) {
      if (menu.id === MENU.SAY && menu.fullPage) return { right: key(text.BACK, 'Escape') };
      if (menu.id === MENU.SAY || menu.id === MENU.RECEIVED) return { left: key(text.OK, 'click') };
      if (menu.id === MENU.TEXT_FADE) return {};
      return { left: key(text.SELECT, 'Enter'), right: key(text.BACK, 'Escape') };
    }
    if (this.roomIsLookOnly) return { right: key(text.BACK, 'back') };
    if (NO_SOFT_KEY_ROOMS.has(this.currentRoom)) return {};
    const pause = this.canPause() ? key(text.MENU, 'pause') : undefined;
    if (this.currentRoom.toLowerCase().includes('puzzle')) return { left: key(text.BACK, 'back'), right: pause };
    if (!this.battleMode && this.inventorySize('invMap') > 0) return { left: key(text.MAP, 'map'), right: pause };
    return { right: pause };
  }

  // The cursor: the rest of h.s's choice. Arrows for turning are the phone's navigation
  // icons, whose registration points put them off to the side, so h.s moves them back.
  cursorForExit(moveDirection) {
    const { text } = this;
    switch (moveDirection) {
      case 'back':
        return ['cursorBack', this.currentRoom.toLowerCase().includes('puzzle') ? text.BACK : text.HINT_BACK];
      case 'turnback':
        return ['cursorTurnBack', text.HINT_TURN_BACK];
      case 'left':
        return ['cursorForwardLeft', text.HINT_LEFT];
      case 'turnleft': {
        const info = this.imageInfo('navArrow_Left');
        return ['navArrow_Left', text.HINT_TURN_LEFT, info?.regX ?? 0];
      }
      case 'right':
        return ['cursorForwardRight', text.HINT_RIGHT];
      case 'turnright': {
        const info = this.imageInfo('navArrow_Right');
        return ['navArrow_Right', text.HINT_TURN_RIGHT, (info?.regX ?? 0) - (info?.width ?? 0)];
      }
      case 'forward':
        return ['cursorForward', text.HINT_FORWARD];
      case 'upstairs_left':
        return ['cursorUpStairsLeft'];
      case 'upstairs_right':
        return ['cursorUpStairsRight'];
      case 'downstairs_left':
        return ['cursorDownStairsLeft'];
      case 'downstairs_right':
        return ['cursorDownStairsRight'];
      case 'elevator':
        return ['cursorElevator'];
      default:
        return ['cursorPoint'];
    }
  }

  // In e.a's touch handling, the inventory icon also closes the inventory.
  handleInventoryInput(menu, clicked, keys) {
    if (this.isTouchBuild && keys.includes('inventory')) this.handleEscape(menu);
    else super.handleInventoryInput(menu, clicked, keys);
  }

  // h.s draws these over the room, and hides them in some rooms. The page puts them on its
  // buttons, which stay, so they go grey there instead. An open inventory keeps its icon lit,
  // because that icon closes it.
  itemIcons() {
    if (!this.isTouchBuild) return null;
    const room = this.currentRoomId ?? '';
    const absent = !this.objects || ROOMS_WITHOUT_ICONS.some((word) => room.includes(word));
    const menu = this.menus.at(-1);
    const blocked = absent || Boolean(menu) || this.popups.length > 0;
    const named = (icon, grey) => (grey ? `${icon}Grey` : icon);
    return {
      1: named(toInt(this.getRaw('sys_battleState')) > 0 ? 'iconBattle1' : 'iconEquipWeapon', blocked),
      3: named('iconUseMedicine', blocked),
      inventory: named('iconInv', absent || (blocked && menu?.id !== MENU.INVENTORY)),
    };
  }

  roomMessage() {
    if (!this.message) return null;
    if (this.menus.length || this.now() > this.message.until) {
      this.message = null;
      return null;
    }
    return this.message.text;
  }

  // Battles. Enemies here aren't aimed at through a small box around their anchor as in
  // Silent Hill: a shot hits anywhere on them, and the scripts move vulnerable zones around.
  resetBattle() {
    super.resetBattle();
    this.enemyState = ENEMY.GONE;
    this.enemyStateTicks = 0;
    this.enemyMoveStep = 1;
    this.enemyCenter = 0;
    this.enemyAttackRequested = false;
    this.attackZones = 0;
    this.zoneTicks = 0;
  }

  // h.r
  battleStartInit() {
    this.attackZones = toInt(this.getRaw('sys_maxAttackZones'));
    if (this.attackZones > 0) {
      this.enemyAttackRequested = false;
      this.enemyState = ENEMY.IDLE;
      this.setRaw('sys_enemy_anim', '0', 'I');
      const zone = this.attackZones === 1 ? 1 : 1 + this.randomInt(this.attackZones);
      this.setRaw('sys_enemy_zone', String(zone), 'I');
      this.zoneTicks = ZONE_TICKS;
    } else {
      this.enemyState = ENEMY.GONE;
    }
    this.battleMode = true;
    this.attackAnim = false;
    this.roomUpdateNeeded = true;
  }

  // h.c
  canFire() {
    return this.ammo > 0 && !this.reloading && this.enemyState !== ENEMY.ATTACKING;
  }

  // The touch build's inventory icon also works with the gun out.
  battleInput(clicked, keys) {
    const used = super.battleInput(clicked, keys);
    if (used && keys.includes('inventory') && !this.menus.length) this.openInventory();
    return used;
  }

  // h.c(int)
  setEnemyAnimation(state) {
    this.enemyState = state;
    this.setRaw('sys_enemy_anim', String(state), 'I');
    for (const object of this.objects ?? []) {
      if (object.script?.hasEvent(EVENT.GETHEROATTACKANIM1)) object.idleAnimationTime = 0;
    }
    this.roomUpdateNeeded = true;
  }

  // The combat part of h.s, once per frame.
  battleUpdate() {
    const now = this.now();
    this.fightDraws = [];
    if (this.shot) {
      this.playSound(this.getRaw('soundShot'));
      this.vibrate(SHOT_VIBRATION_MS);
      this.recoilVertical += RECOIL_VERTICAL;
      this.recoilHorizontal = this.randomInt(2) === 0 ? -RECOIL_HORIZONTAL : RECOIL_HORIZONTAL;
      if (!toBoolean(this.getRaw('sys_ammoUnlimited'))) this.ammoSet(this.ammo - 1, true, true);
    }
    this.moveAttackZone();
    this.advanceEnemy();

    this.overObject = null;
    let hoverHandled = false;
    for (const object of this.objects ?? []) {
      if (object.script && this.enemyState === ENEMY.MOVING && object.executeEvent(EVENT.GETNAME, '?') === 'Enemy') {
        object.x += this.enemyMoveStep;
        object.left += this.enemyMoveStep;
        object.right += this.enemyMoveStep;
        if (object.script.hasEvent(EVENT.ENEMYATTACK))
          this.enemyCenter = object.x + ((object.right - object.left) >> 1);
      }

      if (!object.visible || !object.script) {
        if (this.hoverObject === object) {
          object.executeEvent(EVENT.HOOVEROUT, null);
          this.hoverObject = null;
        }
        if (object.type !== ROOM_OBJECT_ZONE_BATTLE || !object.script) continue;
      }

      if (this.attackAnim) object.fightAnimation(this.fightDraws, this.fightAnimationIndex(), now);
      else {
        this.attackAnimState = 0;
        object.animationTime = 0;
      }

      if (
        this.battleState !== 1 &&
        this.enemyAttackRequested &&
        object.script.hasEvent(EVENT.ENEMYATTACK) &&
        !this.attackAnim
      ) {
        this.enemyAttackRequested = false;
        this.enemyState = ENEMY.ATTACKING;
        this.enemyStateTicks = ENEMY_ATTACK_TICKS;
        this.attackAnimState = 1;
        this.attackAnim = true;
        object.animationTime = 0;
        object.fightAnimation(this.fightDraws, ANIMATION_ENEMY_ATTACK, now);
        object.executeEvent(EVENT.ENEMYATTACK, null);
      }

      if (!hoverHandled) hoverHandled = this.battleHover(object);

      if (
        this.shot &&
        this.enemyState !== ENEMY.ATTACKING &&
        this.hoverObject &&
        object.script.hasEvent(EVENT.ATTACK1)
      ) {
        this.shootHovered(object, now);
      }
    }

    if (
      this.enemyState === ENEMY.MOVING &&
      ((this.enemyMoveStep < 0 && this.enemyCenter < ENEMY_MOVE_MARGIN) ||
        (this.enemyMoveStep > 0 && this.enemyCenter > this.roomWidth - ENEMY_MOVE_MARGIN))
    ) {
      this.enemyMoveStep = -this.enemyMoveStep;
    }
    this.shot = false;
    this.battleState = toInt(this.getRaw('sys_battleState'));
  }

  fightAnimationIndex() {
    if (this.attackAnimState === 0) return ANIMATION_HERO_ATTACK;
    return this.attackAnimState === 1 ? ANIMATION_ENEMY_ATTACK : ANIMATION_ENEMY_DODGE;
  }

  moveAttackZone() {
    if (this.enemyState === ENEMY.GONE || this.attackZones <= 1) return;
    if (this.zoneTicks > 0) {
      this.zoneTicks--;
      return;
    }
    let zone = 1 + this.randomInt(this.attackZones);
    if (zone === toInt(this.getRaw('sys_enemy_zone')) && ++zone > this.attackZones) zone = 1;
    this.setRaw('sys_enemy_zone', String(zone), 'I');
    this.zoneTicks = ZONE_TICKS;
    this.roomUpdateNeeded = true;
  }

  advanceEnemy() {
    switch (this.enemyState) {
      case ENEMY.IDLE:
        if (this.randomInt(ENEMY_ATTACK_CHANCE) === 0) {
          this.enemyAttackRequested = true;
        } else if (this.randomInt(ENEMY_DODGE_CHANCE) === 0) {
          this.setEnemyAnimation(ENEMY.DODGING);
          this.enemyStateTicks = ENEMY_DODGE_TICKS;
        }
        break;
      case ENEMY.MOVING:
      case ENEMY.DODGING:
        if (--this.enemyStateTicks < 0) this.setEnemyAnimation(ENEMY.IDLE);
        break;
      case ENEMY.ATTACKING:
        if (--this.enemyStateTicks < 0) {
          this.setEnemyAnimation(ENEMY.MOVING);
          this.enemyStateTicks = ENEMY_MOVE_TICKS * (1 + this.randomInt(3));
          this.enemyMoveStep = this.randomInt(2) === 0 ? 1 : -1;
        }
        break;
      case ENEMY.RECOVERING:
        if (--this.enemyStateTicks < 0) this.enemyAttackRequested = true;
        break;
      default:
    }
  }

  battleHover(object) {
    const aiming = this.battleState > 0;
    if (aiming ? !object.script.hasEvent(EVENT.ATTACK1) : !object.active) return false;
    // A battle zone is never visible, so it has no bounds worked out, and h.s goes by its
    // position and size.
    const left = object.type === ROOM_OBJECT_ZONE_BATTLE ? object.x : object.left;
    const top = object.type === ROOM_OBJECT_ZONE_BATTLE ? object.y : object.top;
    const right = object.type === ROOM_OBJECT_ZONE_BATTLE ? object.x + object.width : object.right;
    const bottom = object.type === ROOM_OBJECT_ZONE_BATTLE ? object.y + object.height : object.bottom;
    const inside = this.cursorX > left && this.cursorX < right && this.cursorY > top && this.cursorY < bottom;
    if (inside) {
      this.overObject = object;
      if (this.hoverObject !== object && !this.isWaiting()) {
        if (this.hoverObject) {
          this.hoverObject.executeEvent(EVENT.HOOVEROUT, null);
          this.hoverObject = null;
        } else if (object.script.hasEvent(EVENT.HOOVERIN)) {
          object.executeEvent(EVENT.HOOVERIN, null);
          this.hoverObject = object;
        }
        return true;
      }
      return Boolean(this.hoverObject);
    }
    if (this.hoverObject === object) {
      object.executeEvent(EVENT.HOOVEROUT, null);
      this.hoverObject = null;
      return true;
    }
    return false;
  }

  shootHovered(object, now) {
    const target = this.hoverObject;
    target.executeEvent(EVENT.ATTACK1, 0);
    if (toInt(this.getRaw('sys_enemy_anim')) === ENEMY.GONE || object.type === ROOM_OBJECT_ZONE_BATTLE) {
      this.setEnemyAnimation(ENEMY.GONE);
      return;
    }
    this.setEnemyAnimation(ENEMY.IDLE);
    this.enemyState = ENEMY.RECOVERING;
    this.enemyStateTicks = ENEMY_RECOVER_TICKS;
    this.attackAnimState = 0;
    this.attackAnim = true;
    target.animationTime = 0;
    target.fightAnimation(this.fightDraws, ANIMATION_HERO_ATTACK, now);
    const deadVariable = this.getRaw('enemy_dead');
    if (deadVariable && !toBoolean(this.getRaw(deadVariable)) && this.battleState < 2) this.setBattleState(2);
  }

  // The ammo count in h.s. Unlike Silent Hill, this says so even without a gun.
  hudUpdate() {
    if (!this.hudReady) {
      this.hudReady = true;
      this.ammoSet(toInt(this.getRaw('sys_ammo')), false, false);
    }
    const target = this.ammo * this.hudDigitHeight();
    if (this.hudAmmoOffset !== target) {
      this.hudAmmoOffset += this.hudAmmoOffset < target ? 1 : -1;
      this.hudAmmoUpdateNeeded = true;
    } else if (this.ammo === 0) {
      const clips = this.inventorySize('invBulletClips');
      if (clips > 0) {
        const loaded = Math.min(clips, AMMO_MAX);
        this.ammoSet(loaded, true, true);
        if (clips - loaded <= 0) this.unsetRaw('inv-invBulletClips');
        else this.setInventory('invBulletClips', clips - loaded);
        this.reloading = true;
      } else if (!this.noMoreBullets) {
        this.noMoreBullets = true;
        this.say(this.engineText(this.text.OUT_OF_AMMO), null);
      }
    } else {
      this.hudAmmoUpdateNeeded = false;
      this.reloading = false;
    }
  }

  // h.A leaves out the ammo count in the first fight, whose gun never runs out.
  hudItems() {
    const items = super.hudItems();
    return toBoolean(this.getRaw('sys_ammoUnlimited')) ? items.filter(({ id }) => id === 'HUD_life') : items;
  }

  // Being hit: M.i tiles an image over the screen, flashes a color, and tiles it again.
  startDissolve(args) {
    this.dissolve = {
      image: args[0],
      color: toInt(args[1]),
      imageTime: toInt(args[2]),
      colorTime: toInt(args[3]),
      loops: args.length > 4 ? toInt(args[4]) : 0,
      start: this.now(),
    };
  }

  updateDissolve() {
    const effect = this.dissolve;
    const now = this.now();
    if (now <= effect.start + effect.imageTime * 2 + effect.colorTime) return;
    if (effect.loops === 0) this.dissolve = null;
    else {
      effect.loops--;
      effect.start = now;
    }
  }

  dissolveItems() {
    const effect = this.dissolve;
    if (!effect) return [];
    const elapsed = this.now() - effect.start;
    if (elapsed >= effect.imageTime && elapsed < effect.imageTime + effect.colorTime)
      return [{ kind: 'rect', x: 0, y: 0, width: this.roomWidth, height: this.roomHeight, color: effect.color }];
    return [{ kind: 'tiled-image', id: effect.image }];
  }

  // Strokes.
  get strokePuzzle() {
    return STROKE_PUZZLES[this.currentRoom] ?? null;
  }

  // The keypad builds have ordinary puzzles in rooms of the same names, without the mask.
  strokeMask() {
    const mask = (this.objects ?? []).find(({ gfxId }) => String(gfxId).toLowerCase().includes('puzzlemask')) ?? null;
    // It's invisible, so nothing else works out where it is. e.b asks for this too.
    mask?.getBounds();
    return mask;
  }

  wantsStroke() {
    return Boolean(
      this.strokePuzzle &&
        this.strokeMask() &&
        !this.menus.length &&
        !this.popups.length &&
        this.transitionCounter === null,
    );
  }

  startStroke(x, y) {
    this.stroke = { startedAt: this.now(), startX: x, startY: y, lastX: x, lastY: y, touched: null, strayed: false };
  }

  continueStroke(x, y) {
    const { stroke } = this;
    if (!stroke || this.now() <= stroke.startedAt + STROKE_DELAY_MS) return;
    this.strokes.push({
      kind: 'line',
      x1: stroke.lastX,
      y1: stroke.lastY,
      x2: x,
      y2: y,
      color: this.strokePuzzle.color,
    });
    stroke.lastX = x;
    stroke.lastY = y;
    this.checkStroke(x, y);
  }

  // The regions from e.b, measured from the mask's corner. Each of the three checkpoints
  // must be passed, without leaving the region.
  checkStroke(roomX, roomY) {
    const { stroke } = this;
    const mask = this.strokeMask();
    stroke.touched ??= [false, false, false];
    const { touched } = stroke;
    const x = roomX - mask.left;
    const y = roomY - mask.top;
    switch (this.currentRoom) {
      case 'puzzleDrawing':
        if (x >= 30 && x <= 70 && y >= 20 && y <= 80) touched[0] = true;
        else if (x >= 150 && x <= 190 && y >= 20 && y <= 80) touched[1] = true;
        else if (x >= 80 && x <= 140 && y >= 110 && y <= 150) touched[2] = true;
        else if (x > 70 && x < 150 && y >= 20 && y <= 80) break;
        else if (y <= 1.4 * x + 38 && y > 80 && y >= 0.77 * x + 26 && y <= 150) break;
        else if (y >= -0.85 * x + 203 && y > 80 && y <= -1.45 * x + 348 && y <= 150) break;
        else stroke.strayed = true;
        break;
      case 'puzzleScalpel': {
        const left = x - 16;
        const top = y - 10;
        const within = (x1, x2, y1, y2) => left >= x1 && left <= x2 && top >= y1 && top <= y2;
        if (within(-5, 55, 135, 200) || within(55, 79, 135, 164)) touched[0] = true;
        else if (within(59, 97, 99, 164) || within(97, 121, 99, 127)) touched[1] = true;
        else if (within(121, 159, 60, 127) || within(159, 220, 60, 91)) touched[2] = true;
        else stroke.strayed = true;
        break;
      }
      default:
        if (x >= 0 && x <= 75 && y >= 0 && y <= 75) {
          if (Math.abs(stroke.startX - roomX) + Math.abs(stroke.startY - roomY) > 50) touched.fill(true);
        } else {
          stroke.strayed = true;
        }
    }
  }

  endStroke() {
    if (this.stroke) this.strokeEnded = true;
  }

  // From e.c: lifting the finger either solves the puzzle or wipes the drawing.
  finishStroke() {
    const { stroke } = this;
    this.stroke = null;
    this.strokeEnded = false;
    if (stroke?.touched?.every(Boolean) && !stroke.strayed) {
      this.setRaw(this.strokePuzzle.solved, '1', 'I');
      this.goBack();
    } else {
      this.strokes = [];
    }
  }

  handleInput() {
    if (this.strokeEnded) this.finishStroke();
    this.runActionKeysWhileWaiting();
    super.handleInput();
  }

  // The icons in e.c call their scripts directly, so getting the gun out works even during
  // the pause in a monster's attack, when the engine ignores other input.
  runActionKeysWhileWaiting() {
    const waiting = this.waitStop > 0 && this.now() < this.waitStop;
    if (!waiting || this.isAiming() || this.menus.length || this.popups.length || this.transitionCounter !== null)
      return;
    this.runActionKeys(this.pendingKeys);
    this.pendingKeys = [];
  }

  drawList() {
    const list = super.drawList();
    if (this.strokes.length) list.push(...this.strokes);
    return list;
  }
}

export function createGame(data, options) {
  return data.dataDir === 'a' ? new Mobile2Game(data, options) : new Game(data, options);
}
