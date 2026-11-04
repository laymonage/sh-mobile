// Writes a way through Silent Hill Mobile 2 to src/sh2-route.json, for
// test/playthrough-sh2.test.mjs to replay. With --keypad, it does the same for the keypad
// builds, such as the Internet Archive's, in src/sh2-keypad-route.json. The order comes
// from this walkthrough:
// https://www.silenthillmemories.net/sh_mobile2/walkthrough_en.htm
//
// Each goal below is a step of it. From where the game stands, this walks outwards through
// exits, trying everything a player could at each place it reaches, until the goal is met,
// and then forgets the rest. A place is kept only once, so it holds a few hundred copies of
// the game at most, unlike scripts/find-route.mjs, which needs gigabytes for its search.
//
// Script and variable names differ between the builds, so goals go by what a player sees:
// the names of items and things in the room, and what's said.

import { writeFileSync } from 'node:fs';
import { readInput, recommended } from '../src/inputs.mjs';
import { Player, copyGame, newPlaythroughGame } from '../src/playthrough.mjs';
import { EVENT, MENU, VERB } from '../web/engine/game.mjs';
import { Mobile2Game } from '../web/engine/mobile2.mjs';
import { loadGameData, readJar } from '../web/engine/jar.mjs';
import { toInt } from '../web/engine/vm.mjs';

const KEYPAD = process.argv.includes('--keypad');
const OUTPUT_NAME = KEYPAD ? 'sh2-keypad-route.json' : 'sh2-route.json';
const OUTPUT = new URL(`../src/${OUTPUT_NAME}`, import.meta.url);
const BUILD = KEYPAD ? recommended.sh2.keypadReference : recommended.sh2.gameData;
const HEAL_AT = 2;
const RELOAD_AT = 4;
const FIRST_AID = 'g';
const AMMO = 'invAmmo';
const END_ROOM = 'endGame';
const LOOK_ROOM = /map|^lightPainting$|^lightWaitingRoomDrawing$|^lightSurgeryRoomXRay$/i;
const VERB_NAMES = { [VERB.LOOK]: 'look', [VERB.HAND]: 'hand' };

// What's where, from each build's scripts. The keypads' digits agree with the walkthrough.
// The touch build's strokes go through the checkpoints in e.b. Only dragging counts, so each
// starts just before its first checkpoint. The keypad build's painting joins the same dots,
// and its carving is steered with arrows along a staircase, found by trying every way.
const PUZZLES = KEYPAD
  ? {
      puzzleCorridor17KeyCode: 'clicks 4j 4m 4q 4i',
      puzzleCorridor13KeyCode: 'clicks bl bk bo bm bp',
      puzzleDrawing: 'clicks 6y 6z 70 75 6y',
      puzzleScalpel: 'clicks af ae af ae af ae af ae af ae',
    }
  : {
      puzzleCorridor17KeyCode: 'clicks 4k 4n 4r 4j',
      puzzleCorridor13KeyCode: 'clicks 9a 99 9d 9b 9e',
      puzzleDrawing: 'stroke 43,35 44,35 104,35 163,35 150,60 134,90 120,110 104,126',
      puzzleScalpel: 'stroke 45,160 46,160 96,140 156,100',
      puzzleBodyIncision: 'stroke 10,10 40,40 70,70',
    };
// Where the player is in a corridor, and which world they're in.
const PLACE_VARIABLES = KEYPAD ? ['ma', 'mb', 'lf'] : ['jp', 'jq', 'iu'];

// What's been said, on the game, so that each copy of it remembers its own.
const { say } = Mobile2Game.prototype;
Mobile2Game.prototype.say = function remember(text, ...rest) {
  this.spoken ??= [];
  this.spoken.push(text);
  return say.call(this, text, ...rest);
};

const nameIs = (game, script, name) => game.executeEventById(script, EVENT.GETNAME, '?') === name;
const has = (name) => (game) => game.inventoryItems().some((item) => nameIs(game, item, name));
const gone = (name) => (game) => !has(name)(game);
const said =
  (text, times = 1) =>
  (game) =>
    (game.spoken ?? []).filter((line) => line.includes(text)).length >= times;
const inRoom = (room) => (game) => game.currentRoomId === room;
const visibleThing = (game, name) =>
  (game.objects ?? []).some(
    (object) => object.visible && object.active && object.scriptId && object.executeEvent(EVENT.GETNAME, '?') === name,
  );
const netDown = (game) => game.currentRoomId === 'c' && !visibleThing(game, 'Net');
const solved = (room) => (_game, route) => route.includes(PUZZLES[room]);

const GOALS = [
  // Lucas
  ["Bill's nameplate", has("Bill's nameplate")],
  ['the map', has('Map')],
  ['the wax crayon', has('Wax crayon')],
  ['the doll', has('Doll')],
  ['the patient room keypad, 2591', solved('puzzleCorridor17KeyCode')],
  ['the notepad', has('Notepad')],
  ['the painting', solved('puzzleDrawing')],
  ['the paper in the Otherworld', has('Paper')],
  ["Lucas' nameplate", has("Lucas' nameplate")],
  ["Lucas' nameplate on the plate", gone("Lucas' nameplate")],
  ["Bill's nameplate on the plate", gone("Bill's nameplate")],
  ['the plate: Bill, Marie, Lucas', said('I think I heard a click coming from the door')],
  ['the doll in the birdcage', gone('Doll')],
  ['the small key from the birdcage', has('Small key')],
  ["Karen's padlock", said('Ah, it opened')],
  ["opening Karen's locker", said("It's empty")],
  ['the fetuses', said('They... They are all dead')],
  ['talking to Karen', said("Your lies, they're everywhere")],
  ['Vincent, after Karen', has('Handgun')],
  // Vincent
  ['the map', has('Map')],
  ['the surgery key', has('Surgery key')],
  ['the prescription', has('Prescription')],
  ['the surgery door, with its key', said("It's open now")],
  ['the scalpel', has('Scalpel')],
  ['the first quarter, from the mattress', said('A coin fell from the mattress')],
  ['the chair leg', has('Chair leg')],
  ['the second quarter, from the chair', said("There... It's loose")],
  ['the sticky chair leg', has('Sticky chair leg')],
  ['the carving', solved('puzzleScalpel')],
  ['the net, with a shot', netDown],
  ['the filing cabinet key, from the meat', has('Filing cabinet key')],
  ['the third quarter, from the desk', said("There's a coin in here")],
  ['the filing cabinet', said("It's now unlocked")],
  ['the x-ray plate', has('X-ray plate')],
  ['the last quarter, from the drain', said('It passed the grate')],
  ['the quarters in the vending machine', said('There, that should do it')],
  ['the wallet', has('Wallet')],
  ['the piece of paper', has('Piece of paper')],
  ['the x-ray on the lightbox', gone('X-ray plate')],
  // Only the touch build cuts the body on a screen of its own.
  ...(KEYPAD ? [] : [['the incision', solved('puzzleBodyIncision')]]),
  ['the bronze key', has('Bronze key')],
  ['the bronze lock', said("It's unlocked")],
  ['the three-lock door, 21536', solved('puzzleCorridor13KeyCode')],
  ['the iron key, after Lucas', has('Iron key')],
  ['the iron lock', said("It's unlocked", 2)],
  ['the ending', inRoom(END_ROOM)],
];

// Where the player is: the room, in a corridor which way along it, which world, and what
// can be clicked there, because opening a washing machine puts a doll within reach.
const place = (game) =>
  [
    game.currentRoomId,
    ...PLACE_VARIABLES.map((name) => game.getRaw(name)),
    game.battleMode,
    (game.objects ?? [])
      .filter(({ visible, active, scriptId }) => visible && active && scriptId)
      .map(({ scriptId }) => scriptId)
      .join(),
  ].join(' ');

function candidateSteps(game) {
  const room = game.currentRoomId;
  if (LOOK_ROOM.test(room)) return ['key back'];
  if (PUZZLES[room]) return [PUZZLES[room], 'key back'];
  const player = new Player(game);
  const steps = [];
  game.objects.forEach((object, index) => {
    const { left, right, top, bottom } = object;
    if (!object.scriptId || !object.isOver((left + right) >> 1, (top + bottom) >> 1) || !player.pointOn(object)) return;
    const name = `${object.scriptId}#${index}`;
    const trial = copyGame(game);
    try {
      new Player(trial).clickObject(trial.objects[index]);
    } catch {
      return;
    }
    const menu = trial.menus.at(-1);
    if (menu?.id !== MENU.VERBS) {
      steps.push(`click ${name}`);
      return;
    }
    for (const verb of [VERB.LOOK, VERB.HAND]) {
      if (menu.options[verb] !== null) steps.push(`click ${name} ${VERB_NAMES[verb]}`);
    }
    if (object.script?.hasEvent(EVENT.USEITEM)) {
      for (const item of game.inventoryItems()) steps.push(`use ${name} ${item}`);
    }
  });
  for (const item of game.inventoryItems()) {
    for (const action of ['look', 'equip']) steps.push(`item ${item} ${action}`);
  }
  if (game.battleMode) steps.push('fight');
  // The net over the meat is shot like an enemy, out of a fight.
  else if (
    game.inventorySize('invGun') > 0 &&
    game.objects.some(
      ({ visible, active, type, script }) => (visible || (type === 3 && active)) && script?.hasEvent(EVENT.ATTACK1),
    )
  )
    steps.push('aim');
  return steps;
}

// Plays what the game asks for after a step, and returns the states it can lead to.
function arrive(game, player, route, found) {
  const status = player.settle();
  if (status === 'end') {
    if (game.currentRoomId === END_ROOM) found.push({ game, route, ended: true });
    return;
  }
  if (status === 'stuck') {
    const state = {
      health: game.getRaw('sys_health'),
      battleState: game.getRaw('sys_battleState'),
      battleMode: game.battleMode,
      enemy: game.enemyState,
      attack: game.attackAnim,
      menus: game.menus.map((menu) => menu.text ?? menu.id),
      paused: game.pausedThread?.script.id,
      offset: game.pausedThread?.offset,
      status: game.pausedThread?.status,
      wait: game.waitStop - game.clock,
      popups: game.popups.length,
      transition: game.transitionCounter,
      pending: game.pendingRoom,
    };
    throw new Error(`Stuck in room ${game.currentRoomId} after ${route.at(-1)}: ${JSON.stringify(state)}`);
  }
  if (status === 'choice') {
    game.menus.at(-1).choices.forEach((_, row) => {
      const copy = copyGame(game);
      const copyPlayer = new Player(copy);
      copyPlayer.perform(`choose ${row}`);
      arrive(copy, copyPlayer, [...route, `choose ${row}`], found);
    });
    return;
  }
  // Stay healthy and loaded, as a player would.
  const quiet = !game.battleMode && !LOOK_ROOM.test(game.currentRoomId) && !/puzzle/i.test(game.currentRoomId);
  if (quiet) {
    const upkeep =
      toInt(game.getRaw('sys_health')) <= HEAL_AT && game.inventorySize(FIRST_AID) > 0
        ? 'key 3'
        : toInt(game.getRaw('sys_ammo')) <= RELOAD_AT &&
            game.inventorySize(AMMO) > 0 &&
            game.inventorySize('invGun') > 0
          ? `item ${AMMO} equip`
          : null;
    if (upkeep) {
      player.perform(upkeep);
      arrive(game, player, [...route, upkeep], found);
      return;
    }
  }
  found.push({ game, route });
}

function outcomes(base, route, step) {
  const found = [];
  const game = copyGame(base);
  const player = new Player(game);
  const steps = step === 'aim' ? ['key 1', 'fight', 'key 1'] : [step];
  try {
    for (const part of steps) {
      player.perform(part);
      if (part !== 'key 1') player.settle();
    }
    arrive(game, player, [...route, ...steps], found);
  } catch (error) {
    if (error.message.startsWith('Stuck')) throw error;
  }
  return found;
}

function walkTo(start, goal) {
  const visited = new Set([place(start.game)]);
  let layer = [start];
  while (layer.length) {
    const following = [];
    for (const { game, route } of layer) {
      for (const step of candidateSteps(game)) {
        for (const outcome of outcomes(game, route, step)) {
          if (goal(outcome.game, outcome.route)) return outcome;
          const key = place(outcome.game);
          if (!outcome.ended && !visited.has(key)) {
            visited.add(key);
            following.push(outcome);
          }
        }
      }
    }
    layer = following;
  }
  return null;
}

const data = loadGameData(await readJar(readInput(BUILD)));
const game = newPlaythroughGame(data);
const found = [];
arrive(game, new Player(game), [], found);
let current = found[0];
for (const [name, goal] of GOALS) {
  if (goal(current.game, current.route)) {
    console.log(`Already there: ${name}`);
    continue;
  }
  const next = walkTo(current, goal);
  if (!next) {
    const { currentRoomId, vars } = current.game;
    const story = [...vars]
      .filter(([key]) => !/^(s_|sys_|room-|cur-)/.test(key))
      .map(([key, { value }]) => `${key}=${value}`);
    throw new Error(
      `Couldn't reach ${name} from room ${currentRoomId}, after ${current.route.length} steps.\n${story.join(' ')}`,
    );
  }
  console.log(`${next.route.length} steps: ${name}, in room ${next.game.currentRoomId}`);
  current = next;
  writeFileSync(OUTPUT, `${JSON.stringify(current.route, null, 0).replaceAll('","', '",\n"')}\n`);
}
console.log(`Reached the ending in ${current.route.length} steps. Wrote src/${OUTPUT_NAME}.`);
