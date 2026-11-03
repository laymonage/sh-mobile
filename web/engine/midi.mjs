// Parses a standard MIDI file into timed notes, for the port's synthesizer.

const MICROSECONDS_PER_QUARTER = 500000;
const DRUM_CHANNEL = 9;
const CONTROLLER_VOLUME = 7;
const CONTROLLER_EXPRESSION = 11;
const BEND_CENTER = 8192;
const BEND_RANGE_SEMITONES = 2;

class TrackReader {
  constructor(bytes, start, end) {
    this.bytes = bytes;
    this.p = start;
    this.end = end;
  }

  get done() {
    return this.p >= this.end;
  }

  u8() {
    return this.bytes[this.p++];
  }

  variable() {
    let value = 0;
    let byte;
    do {
      byte = this.u8();
      value = value * 128 + (byte & 127);
    } while (byte & 128 && !this.done);
    return value;
  }
}

function readEvents(bytes) {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (p) => String.fromCharCode(...bytes.subarray(p, p + 4));
  if (tag(0) !== 'MThd') throw new Error('Not a MIDI file');
  const division = data.getUint16(12);
  if (division & 0x8000) throw new Error('SMPTE timing is not supported');

  const events = [];
  let p = 8 + data.getUint32(4);
  while (p + 8 <= bytes.length) {
    const length = data.getUint32(p + 4);
    if (tag(p) === 'MTrk') {
      const reader = new TrackReader(bytes, p + 8, p + 8 + length);
      let tick = 0;
      let running = 0;
      while (!reader.done) {
        tick += reader.variable();
        let status = reader.bytes[reader.p];
        if (status & 0x80) reader.p++;
        else status = running;

        if (status === 0xff) {
          const type = reader.u8();
          const size = reader.variable();
          if (type === 0x51)
            events.push({
              tick,
              type: 'tempo',
              value: (bytes[reader.p] << 16) | (bytes[reader.p + 1] << 8) | bytes[reader.p + 2],
            });
          reader.p += size;
        } else if (status === 0xf0 || status === 0xf7) {
          reader.p += reader.variable();
        } else {
          running = status;
          const channel = status & 15;
          const kind = status & 0xf0;
          const first = reader.u8();
          const second = kind === 0xc0 || kind === 0xd0 ? 0 : reader.u8();
          events.push({ tick, type: 'channel', kind, channel, first, second });
        }
      }
      events.push({ tick, type: 'end' });
    }
    p += 8 + length;
  }
  return { division, events };
}

// Times are in seconds. A note takes the program and volume its channel had when
// the note started, and `bends` lists pitch changes in semitones.
export function parseMidi(bytes) {
  const { division, events } = readEvents(bytes);
  const order = (event) => (event.type === 'tempo' ? 0 : event.type === 'channel' && event.kind !== 0x90 ? 1 : 2);
  const sorted = events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.tick - b.event.tick || order(a.event) - order(b.event) || a.index - b.index)
    .map(({ event }) => event);

  const channels = Array.from({ length: 16 }, () => ({ program: 0, volume: 1, expression: 1 }));
  const notes = [];
  const bends = [];
  const active = new Map();
  let tempo = MICROSECONDS_PER_QUARTER;
  let lastTick = 0;
  let time = 0;

  const release = (key) => {
    const note = active.get(key);
    if (!note) return;
    note.duration = time - note.start;
    active.delete(key);
  };

  for (const event of sorted) {
    time += (((event.tick - lastTick) / division) * tempo) / 1e6;
    lastTick = event.tick;
    if (event.type === 'tempo') {
      tempo = event.value;
    } else if (event.type === 'channel') {
      const { kind, channel, first, second } = event;
      const state = channels[channel];
      const key = `${channel}:${first}`;
      if (kind === 0x90 && second > 0) {
        release(key);
        const note = {
          channel,
          note: first,
          velocity: second / 127,
          volume: state.volume * state.expression,
          program: state.program,
          drum: channel === DRUM_CHANNEL,
          start: time,
          duration: 0,
        };
        notes.push(note);
        active.set(key, note);
      } else if (kind === 0x80 || kind === 0x90) {
        release(key);
      } else if (kind === 0xb0) {
        if (first === CONTROLLER_VOLUME) state.volume = second / 127;
        if (first === CONTROLLER_EXPRESSION) state.expression = second / 127;
      } else if (kind === 0xc0) {
        state.program = first;
      } else if (kind === 0xe0) {
        bends.push({
          channel,
          time,
          semitones: ((((second << 7) | first) - BEND_CENTER) / BEND_CENTER) * BEND_RANGE_SEMITONES,
        });
      }
    }
  }
  for (const key of [...active.keys()]) release(key);
  return { notes, bends, duration: time };
}
