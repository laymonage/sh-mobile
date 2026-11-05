// The table of 78 rules, as in GameMidlet.a(int, int), a(int, int, int), d(int) and t(int).
// Each has a trigger, conditions that must all hold, and actions.
export const TRIGGER = {
  CHAPTER: 0,
  USE_OBJECT: 4,
  LOOK: 5,
  USE_ITEM: 6,
  ITEM_LOOKED_AT: 7,
  LEFT_ROOM: 10,
  ENTERED_ROOM: 11,
  WORLD: 12,
  FIGHT_WON: 13,
  DOOR: 14,
};

// Rules that can fire again and again. Using an item has a shorter list.
const REPEATABLE = new Set([4, 65, 66, 68, 69, 72, 77]);
const REPEATABLE_WITH_ITEM = new Set([4, 65, 66, 68, 69]);

const ACTION_HAS_NO_ARGUMENT = new Set([11, 19]);
const ACTION_HAS_TWO_ARGUMENTS = new Set([2, 3, 14]);

// The conditions and actions are flat lists, each with its own number of arguments.
export function conditionsHold(rule, count, state) {
  const list = rule[1];
  let p = 0;
  for (let remaining = count; remaining > 0; remaining--) {
    const kind = list[p];
    const value = list[p + 1];
    switch (kind) {
      case 0:
        if (state.objectValue[value] !== list[p + 2]) return false;
        p += 3;
        break;
      case 1:
        if (state.objectHidden[value] !== list[p + 2]) return false;
        p += 3;
        break;
      case 2:
        if (state.chapter !== value) return false;
        p += 2;
        break;
      case 3:
        if (!state.hasItem(value)) return false;
        p += 2;
        break;
      case 4:
        if (state.room !== value) return false;
        p += 2;
        break;
      case 5:
        if (state.world !== value) return false;
        p += 2;
        break;
      case 6:
        if (!state.ruleFired[value]) return false;
        p += 2;
        break;
      case 7:
        if (!state.flagL) return false;
        p += 2;
        break;
      case 8:
        if (state.hasItem(value)) return false;
        p += 2;
        break;
      case 9:
        if (state.monstersKilled() !== value) return false;
        p += 2;
        break;
      case 10:
        if (state.ruleFired[value]) return false;
        p += 2;
        break;
      case 11:
        if (state.roomCleared[value]) return false;
        p += 2;
        break;
      case 12:
        return false;
      default:
        throw new Error(`Unknown rule condition ${kind}`);
    }
  }
  return true;
}

// Each action as [kind, ...arguments], in the order the rule lists them.
export function actionsOf(rule, count) {
  const list = rule[2];
  const actions = [];
  let p = 0;
  for (let remaining = count; remaining > 0; remaining--) {
    const kind = list[p];
    if (kind === undefined) break;
    if (ACTION_HAS_NO_ARGUMENT.has(kind)) {
      actions.push([kind]);
      p += 1;
    } else if (ACTION_HAS_TWO_ARGUMENTS.has(kind)) {
      actions.push([kind, list[p + 1], list[p + 2]]);
      p += 3;
    } else {
      actions.push([kind, list[p + 1]]);
      p += 2;
    }
  }
  return actions;
}

// Fires the first rule that matches, as the original does, and says whether one did.
export function fireTrigger(tables, state, kind, id, run) {
  for (let i = 0; i < tables.rules.length; i++) {
    const rule = tables.rules[i];
    if (rule[0][0] !== kind) continue;
    if (state.ruleFired[i]) {
      if (rule[2][0] !== 4) continue;
      if (rule[2][1] === 6 && state.flagM) continue;
    }
    const matches = rule[0][1] === id || (kind === TRIGGER.FIGHT_WON && rule[0][1] === 0);
    if (!matches || !conditionsHold(rule, tables.ruleCounts[i][1], state)) continue;
    run(actionsOf(rule, tables.ruleCounts[i][2]));
    if (!REPEATABLE.has(i)) state.ruleFired[i] = true;
    return true;
  }
  return false;
}

// Using an item on something: the trigger names the thing, and the rule also names the item.
export function fireItemTrigger(tables, state, target, item, run) {
  for (let i = 0; i < tables.rules.length; i++) {
    const rule = tables.rules[i];
    if (rule[0][0] !== TRIGGER.USE_ITEM || state.ruleFired[i]) continue;
    if (rule[0][1] !== target || rule[0][2] !== item) continue;
    if (!conditionsHold(rule, tables.ruleCounts[i][1], state)) continue;
    run(actionsOf(rule, tables.ruleCounts[i][2]));
    if (!REPEATABLE_WITH_ITEM.has(i)) state.ruleFired[i] = true;
    return true;
  }
  return false;
}
