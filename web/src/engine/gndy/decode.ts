/**
 * GNDY binary decoder.
 *
 * Mirrors gnosis_dynamic_vm/gnosis_dynamic/bytecode.py exactly.
 * All multi-byte values are big-endian.
 */

// ── Opcodes ──────────────────────────────────────────────────────────────────

export const Op = {
  MEASURE_TEXT_BIND: 0x01,
  PUSH_CONST:       0x02,
  PUSH_SLOT:        0x03,
  ADD:              0x04,
  SUB:              0x05,
  MUL:              0x06,
  DIV:              0x07,
  MAX:              0x08,
  MIN:              0x09,
  STORE_SLOT:       0x0a,
  DRAW_TEXT_CONST:  0x0b,
  DRAW_TEXT_BIND:   0x0c,
  DRAW_BAR_BIND:    0x0d,
  DRAW_BAR_CONST:   0x0e,
  DRAW_HLINE:       0x0f,
  DRAW_VLINE:       0x10,
  HALT:             0xff,
} as const;

export type OpCode = (typeof Op)[keyof typeof Op];

export const OP_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(Op).map(([name, code]) => [code, name]),
);

// ── Slot layout (6 fields per node) ──────────────────────────────────────────

export const FIELDS = ['mw', 'mh', 'x', 'y', 'w', 'h'] as const;
export type FieldName = (typeof FIELDS)[number];
const FIELD_INDEX: Record<string, number> = Object.fromEntries(
  FIELDS.map((f, i) => [f, i]),
);

export function slotId(node: number, field: FieldName): number {
  return node * FIELDS.length + FIELD_INDEX[field]!;
}

export function slotName(slot: number): string {
  const node = Math.floor(slot / FIELDS.length);
  const field = FIELDS[slot % FIELDS.length];
  return `n${node}.${field}`;
}

// ── Binary helpers ───────────────────────────────────────────────────────────

export function readU16(buf: Uint8Array, off: number): number {
  return (buf[off]! << 8) | buf[off + 1]!;
}

export function readU32(buf: Uint8Array, off: number): number {
  return ((buf[off]! << 24) | (buf[off + 1]! << 16) | (buf[off + 2]! << 8) | buf[off + 3]!) >>> 0;
}

// ── Decoded instruction types ────────────────────────────────────────────────

export interface InstrMeasureTextBind {
  op: typeof Op.MEASURE_TEXT_BIND;
  pc: number;
  size: number;
  node: number;
  bind: number;
  fontSize: number;
}

export interface InstrPushConst {
  op: typeof Op.PUSH_CONST;
  pc: number;
  size: number;
  value: number;
}

export interface InstrPushSlot {
  op: typeof Op.PUSH_SLOT;
  pc: number;
  size: number;
  slot: number;
}

export interface InstrStackOp {
  op: typeof Op.ADD | typeof Op.SUB | typeof Op.MUL | typeof Op.DIV | typeof Op.MAX | typeof Op.MIN;
  pc: number;
  size: number;
}

export interface InstrStoreSlot {
  op: typeof Op.STORE_SLOT;
  pc: number;
  size: number;
  slot: number;
}

export interface InstrDrawTextConst {
  op: typeof Op.DRAW_TEXT_CONST;
  pc: number;
  size: number;
  node: number;
  stringId: number;
  fontSize: number;
  color: number;
}

export interface InstrDrawTextBind {
  op: typeof Op.DRAW_TEXT_BIND;
  pc: number;
  size: number;
  node: number;
  bind: number;
  fontSize: number;
  color: number;
}

export interface InstrDrawBarBind {
  op: typeof Op.DRAW_BAR_BIND;
  pc: number;
  size: number;
  node: number;
  bind: number;
  maxValue: number;
  track: number;
  fill: number;
}

export interface InstrDrawBarConst {
  op: typeof Op.DRAW_BAR_CONST;
  pc: number;
  size: number;
  node: number;
  value: number;
  maxValue: number;
  track: number;
  fill: number;
}

export interface InstrDrawHLine {
  op: typeof Op.DRAW_HLINE;
  pc: number;
  size: number;
  node: number;
  color: number;
}

export interface InstrDrawVLine {
  op: typeof Op.DRAW_VLINE;
  pc: number;
  size: number;
  node: number;
  color: number;
}

export interface InstrHalt {
  op: typeof Op.HALT;
  pc: number;
  size: number;
}

export type Instruction =
  | InstrMeasureTextBind
  | InstrPushConst
  | InstrPushSlot
  | InstrStackOp
  | InstrStoreSlot
  | InstrDrawTextConst
  | InstrDrawTextBind
  | InstrDrawBarBind
  | InstrDrawBarConst
  | InstrDrawHLine
  | InstrDrawVLine
  | InstrHalt;

// ── Decoded program ──────────────────────────────────────────────────────────

export interface GNDYProgram {
  nodeCount: number;
  slotInit: number[];
  binds: string[];
  strings: string[];
  code: Uint8Array;
  instructions: Instruction[];
}

// ── Instruction decoder ──────────────────────────────────────────────────────

function decodeInstruction(code: Uint8Array, pc: number): Instruction {
  const opByte = code[pc]!;
  switch (opByte) {
    case Op.MEASURE_TEXT_BIND:
      return { op: Op.MEASURE_TEXT_BIND, pc, size: 6, node: readU16(code, pc + 1), bind: readU16(code, pc + 3), fontSize: code[pc + 5]! };
    case Op.PUSH_CONST:
      return { op: Op.PUSH_CONST, pc, size: 3, value: readU16(code, pc + 1) };
    case Op.PUSH_SLOT:
      return { op: Op.PUSH_SLOT, pc, size: 3, slot: readU16(code, pc + 1) };
    case Op.ADD:
      return { op: Op.ADD, pc, size: 1 };
    case Op.SUB:
      return { op: Op.SUB, pc, size: 1 };
    case Op.MUL:
      return { op: Op.MUL, pc, size: 1 };
    case Op.DIV:
      return { op: Op.DIV, pc, size: 1 };
    case Op.MAX:
      return { op: Op.MAX, pc, size: 1 };
    case Op.MIN:
      return { op: Op.MIN, pc, size: 1 };
    case Op.STORE_SLOT:
      return { op: Op.STORE_SLOT, pc, size: 3, slot: readU16(code, pc + 1) };
    case Op.DRAW_TEXT_CONST:
      return { op: Op.DRAW_TEXT_CONST, pc, size: 7, node: readU16(code, pc + 1), stringId: readU16(code, pc + 3), fontSize: code[pc + 5]!, color: code[pc + 6]! };
    case Op.DRAW_TEXT_BIND:
      return { op: Op.DRAW_TEXT_BIND, pc, size: 7, node: readU16(code, pc + 1), bind: readU16(code, pc + 3), fontSize: code[pc + 5]!, color: code[pc + 6]! };
    case Op.DRAW_BAR_BIND:
      return { op: Op.DRAW_BAR_BIND, pc, size: 9, node: readU16(code, pc + 1), bind: readU16(code, pc + 3), maxValue: readU16(code, pc + 5), track: code[pc + 7]!, fill: code[pc + 8]! };
    case Op.DRAW_BAR_CONST:
      return { op: Op.DRAW_BAR_CONST, pc, size: 9, node: readU16(code, pc + 1), value: readU16(code, pc + 3), maxValue: readU16(code, pc + 5), track: code[pc + 7]!, fill: code[pc + 8]! };
    case Op.DRAW_HLINE:
      return { op: Op.DRAW_HLINE, pc, size: 4, node: readU16(code, pc + 1), color: code[pc + 3]! };
    case Op.DRAW_VLINE:
      return { op: Op.DRAW_VLINE, pc, size: 4, node: readU16(code, pc + 1), color: code[pc + 3]! };
    case Op.HALT:
      return { op: Op.HALT, pc, size: 1 };
    default:
      throw new Error(`Unknown opcode 0x${opByte.toString(16).padStart(2, '0')} at pc ${pc}`);
  }
}

export function decodeAllInstructions(code: Uint8Array): Instruction[] {
  const instructions: Instruction[] = [];
  let pc = 0;
  while (pc < code.length) {
    const instr = decodeInstruction(code, pc);
    instructions.push(instr);
    pc += instr.size;
    if (instr.op === Op.HALT) break;
  }
  return instructions;
}

// ── Binary program decoder ───────────────────────────────────────────────────

const MAGIC = [0x47, 0x4e, 0x44, 0x59]; // "GNDY"
const VERSION = 1;

export function decodeProgram(data: Uint8Array): GNDYProgram {
  let cursor = 0;

  // Magic
  for (let i = 0; i < 4; i++) {
    if (data[cursor + i] !== MAGIC[i]) throw new Error('Bad magic: not a GNDY binary');
  }
  cursor += 4;

  // Version
  if (data[cursor] !== VERSION) throw new Error(`Unsupported GNDY version ${data[cursor]}`);
  cursor += 1;

  // Header fields
  const nodeCount = readU16(data, cursor); cursor += 2;
  const slotCount = readU16(data, cursor); cursor += 2;
  const bindCount = readU16(data, cursor); cursor += 2;
  const stringCount = readU16(data, cursor); cursor += 2;
  const codeLen = readU32(data, cursor); cursor += 4;

  // Bind table
  const binds: string[] = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < bindCount; i++) {
    const len = readU16(data, cursor); cursor += 2;
    binds.push(decoder.decode(data.subarray(cursor, cursor + len)));
    cursor += len;
  }

  // String pool
  const strings: string[] = [];
  for (let i = 0; i < stringCount; i++) {
    const len = readU16(data, cursor); cursor += 2;
    strings.push(decoder.decode(data.subarray(cursor, cursor + len)));
    cursor += len;
  }

  // Slot init
  const slotInit: number[] = [];
  for (let i = 0; i < slotCount; i++) {
    slotInit.push(readU16(data, cursor));
    cursor += 2;
  }

  // Code
  const code = data.slice(cursor, cursor + codeLen);
  cursor += codeLen;

  // Decode instructions
  const instructions = decodeAllInstructions(code);

  return { nodeCount, slotInit, binds, strings, code, instructions };
}

/**
 * Convenience: decode a program from a base64-encoded binary string.
 */
export function decodeProgramFromBase64(b64: string): GNDYProgram {
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return decodeProgram(buf);
}

/**
 * Format a single instruction for disassembly display.
 */
export function formatInstruction(instr: Instruction, program: GNDYProgram): string {
  const name = OP_NAMES[instr.op] ?? `0x${instr.op.toString(16)}`;
  const pcHex = instr.pc.toString(16).padStart(4, '0');
  switch (instr.op) {
    case Op.MEASURE_TEXT_BIND:
      return `${pcHex}: ${name}  node=${instr.node} bind=${instr.bind}(${program.binds[instr.bind] ?? '?'}) size=${instr.fontSize}`;
    case Op.PUSH_CONST:
      return `${pcHex}: ${name}  ${instr.value}`;
    case Op.PUSH_SLOT:
      return `${pcHex}: ${name}  ${slotName(instr.slot)}`;
    case Op.STORE_SLOT:
      return `${pcHex}: ${name}  ${slotName(instr.slot)}`;
    case Op.DRAW_TEXT_CONST:
      return `${pcHex}: ${name}  node=${instr.node} str=${instr.stringId}("${program.strings[instr.stringId] ?? '?'}") size=${instr.fontSize} color=${instr.color}`;
    case Op.DRAW_TEXT_BIND:
      return `${pcHex}: ${name}  node=${instr.node} bind=${instr.bind}(${program.binds[instr.bind] ?? '?'}) size=${instr.fontSize} color=${instr.color}`;
    case Op.DRAW_BAR_BIND:
      return `${pcHex}: ${name}  node=${instr.node} bind=${instr.bind}(${program.binds[instr.bind] ?? '?'}) max=${instr.maxValue}`;
    case Op.DRAW_BAR_CONST:
      return `${pcHex}: ${name}  node=${instr.node} value=${instr.value} max=${instr.maxValue}`;
    case Op.DRAW_HLINE:
    case Op.DRAW_VLINE:
      return `${pcHex}: ${name}  node=${instr.node} color=${instr.color}`;
    default:
      return `${pcHex}: ${name}`;
  }
}
