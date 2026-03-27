/**
 * GNDY step debugger.
 *
 * Wraps the interpreter with single-step execution, snapshot capture,
 * history for step-back, breakpoints, and run-to-completion.
 */

import type { DrawOp } from '../../types/api';
import type { GNDYProgram, Instruction } from './decode';
import { Op, slotId, slotName } from './decode';

// ── Constants ────────────────────────────────────────────────────────────────

const GLYPH_W = 8;
const GLYPH_H = 8;

// ── Types ────────────────────────────────────────────────────────────────────

export type DebugPhase = 'init' | 'measure' | 'compute' | 'render' | 'halted';

export interface SlotChange {
  slot: number;
  name: string;
  before: number;
  after: number;
}

export interface DebugSnapshot {
  pc: number;
  instrIndex: number;
  phase: DebugPhase;
  halted: boolean;
  stack: number[];
  slots: number[];
  drawOps: DrawOp[];
  changedSlots: SlotChange[];
}

function classifyPhase(op: number): DebugPhase {
  if (op === Op.MEASURE_TEXT_BIND) return 'measure';
  if (op >= Op.DRAW_TEXT_CONST && op <= Op.DRAW_VLINE) return 'render';
  if (op === Op.HALT) return 'halted';
  return 'compute';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function clampU16(v: number): number {
  return Math.max(0, Math.min(Math.trunc(v), 65535));
}

function resolveBind(runtime: Record<string, unknown>, path: string): unknown {
  let current: unknown = runtime;
  for (const part of path.split('.')) {
    if (current !== null && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return current;
}

function toInt(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return Math.trunc(value);
  const s = String(value).trim();
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

/** Safe slot read (returns 0 for out-of-bounds). */
function sl(slots: number[], idx: number): number {
  return slots[idx] ?? 0;
}

// ── Debugger ─────────────────────────────────────────────────────────────────

export class GNDYDebugger {
  readonly program: GNDYProgram;
  readonly runtime: Record<string, unknown>;

  // VM state
  private slots: number[];
  private stack: number[];
  private drawOps: DrawOp[];
  private pc: number;
  private halted: boolean;
  private instrIndex: number;

  // History for step-back
  private history: DebugSnapshot[];
  private maxHistory: number;

  // Breakpoints (set of PC offsets)
  readonly breakpoints: Set<number>;

  constructor(program: GNDYProgram, runtime: Record<string, unknown>, maxHistory = 1000) {
    this.program = program;
    this.runtime = runtime;
    this.slots = [...program.slotInit];
    this.stack = [];
    this.drawOps = [];
    this.pc = 0;
    this.halted = false;
    this.instrIndex = 0;
    this.history = [];
    this.maxHistory = maxHistory;
    this.breakpoints = new Set();
  }

  /** Take a snapshot of the current state (before executing the next instruction). */
  snapshot(): DebugSnapshot {
    const instr = this.program.instructions[this.instrIndex];
    return {
      pc: this.pc,
      instrIndex: this.instrIndex,
      phase: this.halted ? 'halted' : (instr ? classifyPhase(instr.op) : 'halted'),
      halted: this.halted,
      stack: [...this.stack],
      slots: [...this.slots],
      drawOps: [...this.drawOps],
      changedSlots: [],
    };
  }

  /** Execute one instruction and return the resulting snapshot. */
  step(): DebugSnapshot {
    if (this.halted || this.instrIndex >= this.program.instructions.length) {
      return { ...this.snapshot(), halted: true, phase: 'halted' };
    }

    // Save pre-step state for history
    const preSnapshot = this.snapshot();
    this.history.push(preSnapshot);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    const slotsBefore = [...this.slots];
    const instr = this.program.instructions[this.instrIndex]!;
    this.executeInstruction(instr);
    this.instrIndex++;

    // Compute changed slots
    const changedSlots: SlotChange[] = [];
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i] !== slotsBefore[i]) {
        changedSlots.push({
          slot: i,
          name: slotName(i),
          before: slotsBefore[i]!,
          after: this.slots[i]!,
        });
      }
    }

    const snap = this.snapshot();
    snap.changedSlots = changedSlots;
    return snap;
  }

  /** Step back one instruction using history. Returns null if no history. */
  stepBack(): DebugSnapshot | null {
    const prev = this.history.pop();
    if (!prev) return null;

    this.pc = prev.pc;
    this.instrIndex = prev.instrIndex;
    this.halted = prev.halted;
    this.stack = [...prev.stack];
    this.slots = [...prev.slots];
    this.drawOps = [...prev.drawOps];

    return this.snapshot();
  }

  /** Run to completion or until a breakpoint is hit. */
  run(): DebugSnapshot {
    let snap = this.snapshot();
    let first = true;
    while (!this.halted && this.instrIndex < this.program.instructions.length) {
      if (!first && this.breakpoints.has(this.pc)) {
        return this.snapshot();
      }
      first = false;
      snap = this.step();
    }
    return snap;
  }

  /** Run until a breakpoint is hit (skips the current PC if it is a breakpoint). */
  runToBreakpoint(): DebugSnapshot {
    if (this.halted) return this.snapshot();
    // Execute at least one instruction to move past current position
    let snap = this.step();
    while (!this.halted && this.instrIndex < this.program.instructions.length) {
      if (this.breakpoints.has(this.pc)) {
        return this.snapshot();
      }
      snap = this.step();
    }
    return snap;
  }

  /** Reset to initial state, clearing history. */
  reset(): DebugSnapshot {
    this.slots = [...this.program.slotInit];
    this.stack = [];
    this.drawOps = [];
    this.pc = 0;
    this.halted = false;
    this.instrIndex = 0;
    this.history = [];
    return this.snapshot();
  }

  /** Toggle a breakpoint at the given PC offset. Returns true if now set. */
  toggleBreakpoint(pc: number): boolean {
    if (this.breakpoints.has(pc)) {
      this.breakpoints.delete(pc);
      return false;
    }
    this.breakpoints.add(pc);
    return true;
  }

  /** How many steps are in the history (for UI display). */
  get historyDepth(): number {
    return this.history.length;
  }

  // ── Instruction execution ────────────────────────────────────────────────

  private executeInstruction(instr: Instruction): void {
    switch (instr.op) {
      case Op.MEASURE_TEXT_BIND: {
        const bindPath = this.program.binds[instr.bind] ?? '';
        const value = resolveBind(this.runtime, bindPath);
        const text = value == null ? '' : String(value);
        this.slots[slotId(instr.node, 'mw')] = clampU16(text.length * GLYPH_W * instr.fontSize);
        this.slots[slotId(instr.node, 'mh')] = clampU16(GLYPH_H * instr.fontSize);
        this.pc = instr.pc + instr.size;
        break;
      }
      case Op.PUSH_CONST:
        this.stack.push(instr.value);
        this.pc = instr.pc + instr.size;
        break;
      case Op.PUSH_SLOT:
        this.stack.push(sl(this.slots, instr.slot));
        this.pc = instr.pc + instr.size;
        break;
      case Op.ADD: {
        const rhs = this.stack.pop()!; const lhs = this.stack.pop()!;
        this.stack.push(lhs + rhs);
        this.pc = instr.pc + instr.size;
        break;
      }
      case Op.SUB: {
        const rhs = this.stack.pop()!; const lhs = this.stack.pop()!;
        this.stack.push(lhs - rhs);
        this.pc = instr.pc + instr.size;
        break;
      }
      case Op.MUL: {
        const rhs = this.stack.pop()!; const lhs = this.stack.pop()!;
        this.stack.push(lhs * rhs);
        this.pc = instr.pc + instr.size;
        break;
      }
      case Op.DIV: {
        const rhs = this.stack.pop()!; const lhs = this.stack.pop()!;
        this.stack.push(rhs === 0 ? 0 : Math.trunc(lhs / rhs));
        this.pc = instr.pc + instr.size;
        break;
      }
      case Op.MAX: {
        const rhs = this.stack.pop()!; const lhs = this.stack.pop()!;
        this.stack.push(Math.max(lhs, rhs));
        this.pc = instr.pc + instr.size;
        break;
      }
      case Op.MIN: {
        const rhs = this.stack.pop()!; const lhs = this.stack.pop()!;
        this.stack.push(Math.min(lhs, rhs));
        this.pc = instr.pc + instr.size;
        break;
      }
      case Op.STORE_SLOT: {
        const value = this.stack.pop()!;
        this.slots[instr.slot] = clampU16(value);
        this.pc = instr.pc + instr.size;
        break;
      }
      case Op.DRAW_TEXT_CONST: {
        const text = this.program.strings[instr.stringId] ?? '';
        const node = instr.node;
        const x = sl(this.slots, slotId(node, 'x'));
        const y = sl(this.slots, slotId(node, 'y'));
        const w = sl(this.slots, slotId(node, 'w'));
        const h = sl(this.slots, slotId(node, 'h'));
        this.drawOps.push({
          type: 'text', node, source: 'const', bind: null, text,
          x, y, w, h,
          size: instr.fontSize, color: instr.color,
          intrinsic_w: text.length * GLYPH_W * instr.fontSize,
        });
        this.pc = instr.pc + instr.size;
        break;
      }
      case Op.DRAW_TEXT_BIND: {
        const bindPath = this.program.binds[instr.bind] ?? '';
        const value = resolveBind(this.runtime, bindPath);
        const text = value == null ? '' : String(value);
        const node = instr.node;
        const x = sl(this.slots, slotId(node, 'x'));
        const y = sl(this.slots, slotId(node, 'y'));
        const w = sl(this.slots, slotId(node, 'w'));
        const h = sl(this.slots, slotId(node, 'h'));
        this.drawOps.push({
          type: 'text', node, source: 'bind', bind: bindPath, text,
          x, y, w, h,
          size: instr.fontSize, color: instr.color,
          intrinsic_w: text.length * GLYPH_W * instr.fontSize,
        });
        this.pc = instr.pc + instr.size;
        break;
      }
      case Op.DRAW_BAR_BIND: {
        const bindPath = this.program.binds[instr.bind] ?? '';
        const value = resolveBind(this.runtime, bindPath);
        const valueI = toInt(value);
        const node = instr.node;
        const x = sl(this.slots, slotId(node, 'x'));
        const y = sl(this.slots, slotId(node, 'y'));
        const w = sl(this.slots, slotId(node, 'w'));
        const h = sl(this.slots, slotId(node, 'h'));
        const frac = instr.maxValue <= 0 ? 0 : Math.max(0, Math.min(valueI / instr.maxValue, 1));
        this.drawOps.push({
          type: 'bar', node, bind: bindPath,
          value: valueI, max: instr.maxValue,
          x, y, w, h,
          fill_w: Math.trunc(w * frac), track: instr.track, fill: instr.fill,
        });
        this.pc = instr.pc + instr.size;
        break;
      }
      case Op.DRAW_BAR_CONST: {
        const node = instr.node;
        const x = sl(this.slots, slotId(node, 'x'));
        const y = sl(this.slots, slotId(node, 'y'));
        const w = sl(this.slots, slotId(node, 'w'));
        const h = sl(this.slots, slotId(node, 'h'));
        const frac = instr.maxValue <= 0 ? 0 : Math.max(0, Math.min(instr.value / instr.maxValue, 1));
        this.drawOps.push({
          type: 'bar', node, bind: null,
          value: instr.value, max: instr.maxValue,
          x, y, w, h,
          fill_w: Math.trunc(w * frac), track: instr.track, fill: instr.fill,
        });
        this.pc = instr.pc + instr.size;
        break;
      }
      case Op.DRAW_HLINE: {
        const node = instr.node;
        this.drawOps.push({
          type: 'hline', node,
          x: sl(this.slots, slotId(node, 'x')),
          y: sl(this.slots, slotId(node, 'y')),
          w: sl(this.slots, slotId(node, 'w')),
          h: 1,
          color: instr.color,
        });
        this.pc = instr.pc + instr.size;
        break;
      }
      case Op.DRAW_VLINE: {
        const node = instr.node;
        this.drawOps.push({
          type: 'vline', node,
          x: sl(this.slots, slotId(node, 'x')),
          y: sl(this.slots, slotId(node, 'y')),
          w: 1,
          h: sl(this.slots, slotId(node, 'h')),
          color: instr.color,
        });
        this.pc = instr.pc + instr.size;
        break;
      }
      case Op.HALT:
        this.halted = true;
        this.pc = instr.pc + instr.size;
        break;
    }
  }
}
