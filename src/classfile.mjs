// Reads just enough of a Java class file to compare builds without a JVM.
export function parseClass(buffer) {
  if (buffer.readUInt32BE(0) !== 0xcafebabe) throw new Error('Not a class file');
  const minor = buffer.readUInt16BE(4);
  const major = buffer.readUInt16BE(6);

  const count = buffer.readUInt16BE(8);
  const pool = new Array(count);
  let p = 10;
  for (let i = 1; i < count; i++) {
    const tag = buffer[p++];
    switch (tag) {
      case 1: {
        const length = buffer.readUInt16BE(p);
        pool[i] = { tag, value: buffer.toString('utf8', p + 2, p + 2 + length) };
        p += 2 + length;
        break;
      }
      case 3:
        pool[i] = { tag, value: buffer.readInt32BE(p) };
        p += 4;
        break;
      case 4:
        pool[i] = { tag, value: buffer.readFloatBE(p) };
        p += 4;
        break;
      case 5:
        pool[i] = { tag, value: buffer.readBigInt64BE(p) };
        p += 8;
        i++;
        break;
      case 6:
        pool[i] = { tag, value: buffer.readDoubleBE(p) };
        p += 8;
        i++;
        break;
      case 7:
      case 8:
        pool[i] = { tag, index: buffer.readUInt16BE(p) };
        p += 2;
        break;
      case 9:
      case 10:
      case 11:
      case 12:
        pool[i] = { tag };
        p += 4;
        break;
      default:
        throw new Error(`Unknown constant pool tag ${tag}`);
    }
  }

  const utf8 = (index) => pool[index]?.value;
  const readAttributes = () => {
    const attributes = [];
    const n = buffer.readUInt16BE(p);
    p += 2;
    for (let i = 0; i < n; i++) {
      const name = utf8(buffer.readUInt16BE(p));
      const length = buffer.readUInt32BE(p + 2);
      attributes.push({ name, start: p + 6, length });
      p += 6 + length;
    }
    return attributes;
  };

  const thisClass = utf8(pool[buffer.readUInt16BE(p + 2)].index);
  p += 6;
  p += 2 + 2 * buffer.readUInt16BE(p);

  const fields = [];
  const fieldCount = buffer.readUInt16BE(p);
  p += 2;
  for (let i = 0; i < fieldCount; i++) {
    const name = utf8(buffer.readUInt16BE(p + 2));
    p += 6;
    const constant = readAttributes().find((attribute) => attribute.name === 'ConstantValue');
    const entry = constant ? pool[buffer.readUInt16BE(constant.start)] : undefined;
    fields.push({ name, constantValue: entry?.tag === 8 ? utf8(entry.index) : entry?.value });
  }

  const methods = [];
  const attributeNames = new Set();
  const methodCount = buffer.readUInt16BE(p);
  p += 2;
  for (let i = 0; i < methodCount; i++) {
    const name = utf8(buffer.readUInt16BE(p + 2));
    p += 6;
    for (const attribute of readAttributes()) {
      attributeNames.add(attribute.name);
      if (attribute.name === 'Code') {
        const saved = p;
        p = attribute.start + 4;
        p += 4 + buffer.readUInt32BE(p);
        p += 2 + 8 * buffer.readUInt16BE(p);
        for (const nested of readAttributes()) attributeNames.add(nested.name);
        p = saved;
      }
    }
    methods.push(name);
  }

  return {
    name: thisClass,
    major,
    minor,
    fields,
    methods,
    attributeNames,
    utf8: new Set(pool.filter((entry) => entry?.tag === 1).map((entry) => entry.value)),
    strings: new Set(pool.filter((entry) => entry?.tag === 8).map((entry) => utf8(entry.index))),
  };
}
