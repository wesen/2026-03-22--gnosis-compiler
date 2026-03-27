import type { DebugSnapshot } from '../engine/gndy';
import type { GNDYProgram, Instruction } from '../engine/gndy/decode';
import { Op } from '../engine/gndy/decode';

// Helper to cast mock instruction data without fighting discriminated union types
function instr(data: Record<string, unknown>): Instruction {
  return data as unknown as Instruction;
}

/** Mock program with 6 instructions for stories. */
export const mockProgram: GNDYProgram = {
  nodeCount: 4,
  slotInit: new Array(24).fill(0),
  binds: ['props.title', 'sensor.temp'],
  strings: ['TEMP:'],
  code: new Uint8Array(32),
  instructions: [
    instr({ op: Op.MEASURE_TEXT_BIND, pc: 0x0000, size: 6, node: 2, bind: 0, fontSize: 2 }),
    instr({ op: Op.PUSH_SLOT, pc: 0x0006, size: 3, slot: 12 }),
    instr({ op: Op.STORE_SLOT, pc: 0x0009, size: 3, slot: 14 }),
    instr({ op: Op.DRAW_TEXT_BIND, pc: 0x000c, size: 7, node: 2, bind: 0, fontSize: 2, color: 1 }),
    instr({ op: Op.DRAW_HLINE, pc: 0x0013, size: 4, node: 3, color: 1 }),
    instr({ op: Op.HALT, pc: 0x0016, size: 1 }),
  ],
};

/** Mock snapshot at step 2 (after PUSH_SLOT, before STORE_SLOT). */
export const mockSnapshotStep2: DebugSnapshot = {
  pc: 0x0009,
  instrIndex: 2,
  phase: 'compute',
  halted: false,
  stack: [96],
  slots: [
    0, 0, 0, 0, 0, 0,     // n0
    0, 0, 0, 0, 0, 0,     // n1
    96, 16, 8, 8, 0, 16,  // n2 (mw=96, mh=16, x=8, y=8, w=0, h=16)
    0, 0, 8, 28, 260, 1,  // n3 (x=8, y=28, w=260, h=1)
  ],
  drawOps: [],
  changedSlots: [],
};

/** Snapshot with changed slots (after STORE_SLOT). */
export const mockSnapshotWithChanges: DebugSnapshot = {
  ...mockSnapshotStep2,
  pc: 0x000c,
  instrIndex: 3,
  phase: 'render',
  stack: [],
  changedSlots: [
    { slot: 14, name: 'n2.w', before: 0, after: 96 },
  ],
  slots: [
    0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0,
    96, 16, 8, 8, 96, 16,  // n2 w changed to 96
    0, 0, 8, 28, 260, 1,
  ],
};

/** Halted snapshot. */
export const mockSnapshotHalted: DebugSnapshot = {
  pc: 0x0016,
  instrIndex: 5,
  phase: 'halted',
  halted: true,
  stack: [],
  slots: [
    0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0,
    96, 16, 8, 8, 96, 16,
    0, 0, 8, 28, 260, 1,
  ],
  drawOps: [
    { type: 'text', node: 2, source: 'bind', bind: 'props.title', text: 'LAB-01', x: 8, y: 8, w: 96, h: 16, size: 2, color: 1, intrinsic_w: 96 },
    { type: 'hline', node: 3, x: 8, y: 28, w: 260, h: 1, color: 1 },
  ],
  changedSlots: [],
};

/** Snapshot with a bigger stack for display. */
export const mockSnapshotWithStack: DebugSnapshot = {
  ...mockSnapshotStep2,
  stack: [96, 16, 8, 260],
};
