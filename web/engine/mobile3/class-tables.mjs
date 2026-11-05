// Mobile 3 keeps its rooms, rules and items in Java arrays rather than in data files, so
// the port reads them from the player's own JAR: this evaluates a class's static
// initializer far enough to get the arrays it builds, without running anything else.
const decoder = new TextDecoder();

function parseConstantPool(view, bytes) {
  const count = view.getUint16(8);
  const pool = new Array(count);
  let p = 10;
  for (let i = 1; i < count; i++) {
    const tag = bytes[p++];
    if (tag === 1) {
      const length = view.getUint16(p);
      pool[i] = { tag, value: decoder.decode(bytes.subarray(p + 2, p + 2 + length)) };
      p += 2 + length;
    } else if (tag === 3) {
      pool[i] = { tag, value: view.getInt32(p) };
      p += 4;
    } else if (tag === 4) {
      pool[i] = { tag, value: view.getFloat32(p) };
      p += 4;
    } else if (tag === 5) {
      pool[i] = { tag, value: view.getBigInt64(p) };
      p += 8;
      i++;
    } else if (tag === 6) {
      pool[i] = { tag, value: view.getFloat64(p) };
      p += 8;
      i++;
    } else if (tag === 7 || tag === 8) {
      pool[i] = { tag, index: view.getUint16(p) };
      p += 2;
    } else if (tag >= 9 && tag <= 12) {
      pool[i] = { tag, first: view.getUint16(p), second: view.getUint16(p + 2) };
      p += 4;
    } else {
      throw new Error(`Unknown constant pool tag ${tag}`);
    }
  }
  return { pool, end: p };
}

// The class's name, and the bytecode of its static initializer, if it has one.
function parseClass(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== 0xcafebabe) throw new Error('Not a class file');
  const { pool, end } = parseConstantPool(view, bytes);
  let p = end;
  const name = pool[pool[view.getUint16(p + 2)].index].value;
  p += 6;
  p += 2 + 2 * view.getUint16(p);
  const skipAttributes = () => {
    const count = view.getUint16(p);
    p += 2;
    for (let i = 0; i < count; i++) p += 6 + view.getUint32(p + 2);
  };
  const fieldCount = view.getUint16(p);
  p += 2;
  for (let i = 0; i < fieldCount; i++) {
    p += 6;
    skipAttributes();
  }
  const methodCount = view.getUint16(p);
  p += 2;
  let code = null;
  for (let i = 0; i < methodCount; i++) {
    const isInitializer = pool[view.getUint16(p + 2)].value === '<clinit>';
    p += 6;
    const attributeCount = view.getUint16(p);
    p += 2;
    for (let j = 0; j < attributeCount; j++) {
      const attributeName = pool[view.getUint16(p)].value;
      const length = view.getUint32(p + 2);
      if (isInitializer && attributeName === 'Code') {
        const codeLength = view.getUint32(p + 10);
        code = bytes.subarray(p + 14, p + 14 + codeLength);
      }
      p += 6 + length;
    }
  }
  return { name, pool, code };
}

// Argument and return types in a method descriptor, as far as a stack needs to know.
function describeMethod(descriptor) {
  let count = 0;
  let i = 1;
  while (descriptor[i] !== ')') {
    while (descriptor[i] === '[') i++;
    if (descriptor[i] === 'L') i = descriptor.indexOf(';', i);
    i++;
    count++;
  }
  return { count, returns: descriptor[i + 1] !== 'V' };
}

const OPAQUE = Symbol('opaque');

// Returns each static field the initializer sets, keyed by "name:descriptor", since the
// obfuscator gives fields of different types the same name. It stops at the first branch or
// instruction it doesn't follow, which comes after the tables in the classes that matter.
export function readStaticTables(classBytes) {
  const { name, pool, code } = parseClass(classBytes);
  const fields = new Map();
  if (!code) return { name, fields };
  const view = new DataView(code.buffer, code.byteOffset, code.byteLength);
  const member = (index) => {
    const nameAndType = pool[pool[index].second];
    return {
      owner: pool[pool[pool[index].first].index].value,
      name: pool[nameAndType.first].value,
      descriptor: pool[nameAndType.second].value,
    };
  };
  const stack = [];
  const locals = [];
  const constant = (entry) => (entry.tag === 8 ? pool[entry.index].value : entry.value);
  let p = 0;
  while (p < code.length) {
    const op = code[p];
    if (op === 0) p++;
    else if (op === 1) {
      stack.push(null);
      p++;
    } else if (op >= 2 && op <= 8) {
      stack.push(op - 3);
      p++;
    } else if (op === 9 || op === 10) {
      stack.push(BigInt(op - 9));
      p++;
    } else if (op === 16) {
      stack.push(view.getInt8(p + 1));
      p += 2;
    } else if (op === 17) {
      stack.push(view.getInt16(p + 1));
      p += 3;
    } else if (op === 18) {
      stack.push(constant(pool[code[p + 1]]));
      p += 2;
    } else if (op === 19 || op === 20) {
      stack.push(constant(pool[view.getUint16(p + 1)]));
      p += 3;
    } else if (op >= 26 && op <= 29) {
      stack.push(locals[op - 26]);
      p++;
    } else if (op >= 42 && op <= 45) {
      stack.push(locals[op - 42]);
      p++;
    } else if (op >= 59 && op <= 62) {
      locals[op - 59] = stack.pop();
      p++;
    } else if (op >= 75 && op <= 78) {
      locals[op - 75] = stack.pop();
      p++;
    } else if (op >= 79 && op <= 86) {
      const value = stack.pop();
      const index = stack.pop();
      stack.pop()[index] = value;
      p++;
    } else if (op === 87) {
      stack.pop();
      p++;
    } else if (op === 89) {
      stack.push(stack.at(-1));
      p++;
    } else if (op === 178) {
      const field = member(view.getUint16(p + 1));
      stack.push(field.owner === name ? fields.get(`${field.name}:${field.descriptor}`) : OPAQUE);
      p += 3;
    } else if (op === 179) {
      const field = member(view.getUint16(p + 1));
      fields.set(`${field.name}:${field.descriptor}`, stack.pop());
      p += 3;
    } else if (op === 182 || op === 183 || op === 184) {
      const { count, returns } = describeMethod(member(view.getUint16(p + 1)).descriptor);
      stack.length -= count + (op === 184 ? 0 : 1);
      if (returns) stack.push(OPAQUE);
      p += 3;
    } else if (op === 187) {
      stack.push(OPAQUE);
      p += 3;
    } else if (op === 188) {
      stack.push(new Array(stack.pop()).fill(code[p + 1] === 11 ? 0n : 0));
      p += 2;
    } else if (op === 189) {
      stack.push(new Array(stack.pop()).fill(null));
      p += 3;
    } else if (op === 190) {
      stack.push(stack.pop().length);
      p++;
    } else if (op === 197) {
      const dimensions = stack.splice(-code[p + 3]);
      const build = (depth) =>
        Array.from({ length: dimensions[depth] }, () => (depth + 1 < dimensions.length ? build(depth + 1) : 0));
      stack.push(build(0));
      p += 4;
    } else break;
  }
  return { name, fields };
}
