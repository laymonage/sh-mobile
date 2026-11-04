// Searches for a way through Silent Hill from a new game to its ending, and writes it
// to src/sh1-route.json for test/playthrough.test.mjs to replay.
//
// From where it stands, the search tries everything a player could: each object with
// each verb and item, each exit, and each thing in the inventory. It takes the nearest
// state holding something it has never seen, such as a new room or a new item, and
// starts again from there. Puzzles have too many states to search, so their answers
// are given below, read from their scripts.

import { writeFileSync } from 'node:fs';
import { readInput, recommended } from '../src/inputs.mjs';
import { Player, newPlaythroughGame } from '../src/playthrough.mjs';
import { EVENT, MENU, VERB } from '../web/engine/game.mjs';
import { loadGameData, readJar } from '../web/engine/jar.mjs';
import { Script, toInt } from '../web/engine/vm.mjs';

const OUTPUT = new URL('../src/sh1-route.json', import.meta.url);
const COMMIT_LIMIT = 1500;
const HEAL_AT = 3;
const RELOAD_AT = 4;
const FIRST_AID = '2g';
const BULLETS = 'invBulletClips';
const VERB_NAMES = { [VERB.LOOK]: 'look', [VERB.HAND]: 'hand', [VERB.MOUTH]: 'mouth' };

// Each clock's numerals in the order its scripts count them, the gate's sliders swapped
// and its dials turned to match the drawing, and the blackboard's missing word.
const PUZZLE_ANSWERS = {
  clockPuzzle: 'clicks 49 4a 48 47 4b',
  clockPuzzle2: 'clicks gl gk gm gj gn',
  clockPuzzle3: 'clicks gt gu gr gs gv',
  gatePuzzle: 'clicks g4 g6 g5 g6 fx fy fy fy fy',
  blackboardPuzzle: 'clicks an ao an ap av',
};

// Variables that don't show progress: positions, counters and what's spent in fights.
const NOT_PROGRESS =
  /^(room-|sys_battleState|moveAnim|cur-|sys_health|sys_ammo|mm$|nn$|np$|q[0-9a-gm]$|p[d-m]$|n[0-4]$|md$|me$|mc$|mr$|var_floor$|s_compassDirection$|mk$)/;
const SHARED_FIELDS = new Set(['data', 'gameTexts', 'engineTexts', 'scripts', 'images', 'languages']);

function copyGame(root) {
  const copies = new Map();
  const copy = (value) => {
    if (value === null || typeof value !== 'object' || ArrayBuffer.isView(value) || value instanceof Script)
      return value;
    if (copies.has(value)) return copies.get(value);
    if (value instanceof Map) {
      const map = new Map();
      copies.set(value, map);
      for (const [key, item] of value) map.set(copy(key), copy(item));
      return map;
    }
    if (value instanceof Set) {
      const set = new Set();
      copies.set(value, set);
      for (const item of value) set.add(copy(item));
      return set;
    }
    if (Array.isArray(value)) {
      const list = [];
      copies.set(value, list);
      for (const item of value) list.push(copy(item));
      return list;
    }
    const object = Object.create(Object.getPrototypeOf(value));
    copies.set(value, object);
    for (const key of Object.keys(value)) object[key] = SHARED_FIELDS.has(key) ? value[key] : copy(value[key]);
    return object;
  };
  return copy(root);
}

const facts = (game) => {
  const list = [`@room=${game.currentRoomId}`, ...(game.gains ?? [])];
  for (const [name, { value }] of game.vars) if (!NOT_PROGRESS.test(name)) list.push(`${name}=${value}`);
  return list;
};
const stateKey = (game) => `${game.battleMode} ${game.roomLastInHistory()} ${facts(game).sort().join(' ')}`;

// Everything worth trying from a game that's waiting for the player.
function candidateSteps(game) {
  const room = game.currentRoomId;
  if (/floor|children_drawing/i.test(room)) return ['key back'];
  if (PUZZLE_ANSWERS[room]) return [PUZZLE_ANSWERS[room], 'key back'];
  const player = new Player(game);
  const steps = [];
  game.objects.forEach((object, index) => {
    const { left, right, top, bottom } = object;
    if (!object.scriptId || !object.isOver((left + right) >> 1, (top + bottom) >> 1) || !player.pointOn(object)) return;
    const name = `${object.scriptId}#${index}`;
    const trial = copyGame(game);
    const trialPlayer = new Player(trial);
    try {
      trialPlayer.clickObject(trial.objects[index]);
    } catch {
      return;
    }
    const menu = trial.menus.at(-1);
    if (menu?.id !== MENU.VERBS) {
      steps.push(`click ${name}`);
      return;
    }
    for (const verb of [VERB.LOOK, VERB.HAND, VERB.MOUTH])
      if (menu.options[verb] !== null) steps.push(`click ${name} ${VERB_NAMES[verb]}`);
    if (object.script?.hasEvent(EVENT.USEITEM))
      for (const item of game.inventoryItems()) steps.push(`use ${name} ${item}`);
  });
  for (const item of game.inventoryItems())
    for (const action of ['look', 'equip', 'unequip']) steps.push(`item ${item} ${action}`);
  if (game.inventorySize('invGun') > 0) steps.push('key 1');
  if (game.battleMode) steps.push('fight');
  if (
    game.objects.some(
      (object) => object.visible && object.active && object.executeEvent(EVENT.GETMOVEDIR, null) === 'back',
    )
  )
    steps.push('key back');
  return steps;
}

let endRoute = null;

// Plays a step on a copy of the game, and collects the states it can lead to.
function outcomes(base, route, step, found = []) {
  const game = copyGame(base);
  const player = new Player(game);
  try {
    player.perform(step);
  } catch {
    return found;
  }
  arrive(base, game, player, [...route, step], found);
  return found;
}

function arrive(base, game, player, route, found) {
  const status = player.settle();
  if (status === 'end') {
    // Dying also ends in the main menu.
    if (game.currentRoomId === 'game_end') endRoute = route;
    return;
  }
  if (status === 'stuck') throw new Error(`Stuck in room ${game.currentRoomId} after ${route.at(-1)}`);
  if (status === 'choice') {
    game.menus.at(-1).choices.forEach((_, row) => {
      const copy = copyGame(game);
      const copyPlayer = new Player(copy);
      const step = `choose ${row}`;
      copyPlayer.perform(step);
      arrive(base, copy, copyPlayer, [...route, step], found);
    });
    return;
  }
  // Keep healthy and loaded, as a player would, and never pass up supplies.
  if (!game.battleMode && !/floor|drawing|puzzle/i.test(game.currentRoomId)) {
    const health = toInt(game.getRaw('sys_health'));
    const ammo = toInt(game.getRaw('sys_ammo'));
    const upkeep =
      health <= HEAL_AT && game.inventorySize(FIRST_AID) > 0
        ? `item ${FIRST_AID} equip`
        : ammo <= RELOAD_AT && game.inventorySize('invGun') > 0 && game.inventorySize(BULLETS) > 0
          ? `item ${BULLETS} equip`
          : null;
    if (upkeep) {
      player.perform(upkeep);
      arrive(base, game, player, [...route, upkeep], found);
      return;
    }
  }
  for (const item of [BULLETS, FIRST_AID]) {
    if (game.inventorySize(item) > base.inventorySize(item))
      game.gains = [
        ...(game.gains ?? []),
        `gain:${game.getRaw('m5')}:${game.currentRoomId}:${item}:${game.gains?.length ?? 0}`,
      ];
  }
  found.push({ game, route });
}

const data = loadGameData(await readJar(readInput(recommended.sh1.gameData)));
const start = newPlaythroughGame(data);
const found = [];
arrive(start, start, new Player(start), [], found);
let current = found[0];
const seen = new Set(facts(current.game));
const unseen = (game) => facts(game).filter((fact) => !seen.has(fact));

for (let commits = 0; commits < COMMIT_LIMIT && !endRoute; commits++) {
  const visited = new Set([stateKey(current.game)]);
  let layer = [current];
  let next = null;
  while (layer.length && !next && !endRoute) {
    const following = [];
    for (const { game, route } of layer) {
      for (const step of candidateSteps(game)) {
        for (const outcome of outcomes(game, route, step)) {
          const key = stateKey(outcome.game);
          if (visited.has(key)) continue;
          visited.add(key);
          if (!next && unseen(outcome.game).length) next = outcome;
          following.push(outcome);
        }
      }
      if (next || endRoute) break;
    }
    layer = following;
  }
  if (!next && !endRoute) throw new Error(`Nothing new can be reached from room ${current.game.currentRoomId}`);
  if (next) {
    for (const fact of unseen(next.game)) seen.add(fact);
    current = next;
    console.log(`${current.route.length} steps: room ${current.game.currentRoomId}`);
  }
}

if (!endRoute) throw new Error('No way to the ending was found');
writeFileSync(OUTPUT, `${JSON.stringify(endRoute, null, 0).replaceAll('","', '",\n"')}\n`);
console.log(`Reached the ending in ${endRoute.length} steps. Wrote src/sh1-route.json.`);
