import { OP_END, OP_INTEGER, OP_STRING } from './format.mjs';

export const STATUS = { CREATED: 0, RUNNING: 1, STOPPED: 2, RETURNED: 3, PAUSED: 4, WAITING: 5 };

export function integerArgument(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (/^[+-]?\d+$/.test(value)) return Number.parseInt(value, 10);
  }
  return 1;
}

export function toBoolean(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return value >= 1;
  if (typeof value === 'string' && /^[+-]?\d+$/.test(value)) return Number.parseInt(value, 10) >= 1;
  return true;
}

export const toInt = integerArgument;

// One parsed script, with its $-prefixed strings resolved to game text as
// M.readStringList does. Event offsets index into `code`.
export class Script {
  constructor(id, parsed, gameText) {
    this.id = id;
    this.code = parsed.code;
    this.gfxId = parsed.gfxId;
    this.strings = parsed.strings.map((text) => (text.startsWith('$') ? gameText(text.slice(1)) : text));
    this.eventOffsets = new Map(parsed.events.map(({ id: event, offset }) => [event, offset]));
  }

  hasEvent(event) {
    return this.eventOffsets.has(event);
  }
}

// Port of ScriptThread: commands are a tree, evaluated depth-first, and only the
// top of the tree can stop or pause the thread. Everything that touches the rest
// of the game goes through `host.command`.
export class ScriptThread {
  constructor(script, offset, roomObject, host) {
    this.script = script;
    this.offset = offset;
    this.roomObject = roomObject;
    this.host = host;
    this.status = STATUS.CREATED;
  }

  execute(initial) {
    this.status = STATUS.RUNNING;
    let result = initial;
    while (this.status === STATUS.RUNNING) result = this.executeCommand();
    if (this.status === STATUS.PAUSED || this.status === STATUS.WAITING) this.host.pausedThread = this;
    return result;
  }

  resume() {
    this.host.pausedThread = null;
    return this.execute(null);
  }

  read() {
    return this.script.code[this.offset++];
  }

  readSigned(bytes) {
    let value = 0;
    for (let i = 0; i < bytes; i++) value = value * 256 + this.read();
    const sign = 2 ** (bytes * 8 - 1);
    return value >= sign ? value - 2 * sign : value;
  }

  executeCommand() {
    const byte = this.read();
    const op = byte & 63;
    let count = byte >> 6;
    if (count === 3) count = this.read();

    if (op === OP_INTEGER) return this.readSigned(count === 0 ? 1 : count === 1 ? 2 : 4);
    if (op === OP_STRING) return this.script.strings[this.read() - 1];
    if (op === OP_END) {
      this.status = STATUS.STOPPED;
      return null;
    }

    const args = [];
    for (let i = 0; i < count; i++) args.push(this.executeCommand());
    return this.host.command(this, op, args);
  }
}
