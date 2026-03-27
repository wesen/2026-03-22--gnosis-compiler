/**
 * GNDY interpreter.
 *
 * Mirrors gnosis_dynamic_vm/gnosis_dynamic/vm.py exactly.
 * Produces identical slot values and draw_ops given the same program + runtime.
 */

import type { DrawOp } from '../../types/api';
import type { GNDYProgram } from './decode';
import { Op, slotId, slotName } from './decode';

// ── Constants matching Python compiler ───────────────────────────────────────

export const GLYPH_W = 8;
export const GLYPH_H = 8;

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

// ── Read helpers for raw bytecode execution ──────────────────────────────────

function readU16(code: Uint8Array, off: number): number {
  return (code[off]! << 8) | code[off + 1]!;
}

/** Safe slot read. */
function sl(slots: number[], idx: number): number {
  return slots[idx] ?? 0;
}

// ── Evaluation result ────────────────────────────────────────────────────────

export interface EvalResult {
  slots: Record<string, number>;
  drawOps: DrawOp[];
}

// ── Evaluate (full run to completion) ────────────────────────────────────────

export function evaluate(
  program: GNDYProgram,
  runtime: Record<string, unknown>,
  glyphW: number = GLYPH_W,
  glyphH: number = GLYPH_H,
): EvalResult {
  const slots = [...program.slotInit];
  const stack: number[] = [];
  const drawOps: DrawOp[] = [];
  const code = program.code;
  let pc = 0;

  while (pc < code.length) {
    const op = code[pc]!;
    pc += 1;

    switch (op) {
      case Op.MEASURE_TEXT_BIND: {
        const node = readU16(code, pc); pc += 2;
        const bind = readU16(code, pc); pc += 2;
        const size = code[pc]!; pc += 1;
        const bindPath = program.binds[bind] ?? '';
        const value = resolveBind(runtime, bindPath);
        const text = value == null ? '' : String(value);
        slots[slotId(node, 'mw')] = clampU16(text.length * glyphW * size);
        slots[slotId(node, 'mh')] = clampU16(glyphH * size);
        break;
      }
      case Op.PUSH_CONST: {
        const value = readU16(code, pc); pc += 2;
        stack.push(value);
        break;
      }
      case Op.PUSH_SLOT: {
        const slot = readU16(code, pc); pc += 2;
        stack.push(sl(slots, slot));
        break;
      }
      case Op.ADD: {
        const rhs = stack.pop()!; const lhs = stack.pop()!;
        stack.push(lhs + rhs);
        break;
      }
      case Op.SUB: {
        const rhs = stack.pop()!; const lhs = stack.pop()!;
        stack.push(lhs - rhs);
        break;
      }
      case Op.MUL: {
        const rhs = stack.pop()!; const lhs = stack.pop()!;
        stack.push(lhs * rhs);
        break;
      }
      case Op.DIV: {
        const rhs = stack.pop()!; const lhs = stack.pop()!;
        stack.push(rhs === 0 ? 0 : Math.trunc(lhs / rhs));
        break;
      }
      case Op.MAX: {
        const rhs = stack.pop()!; const lhs = stack.pop()!;
        stack.push(Math.max(lhs, rhs));
        break;
      }
      case Op.MIN: {
        const rhs = stack.pop()!; const lhs = stack.pop()!;
        stack.push(Math.min(lhs, rhs));
        break;
      }
      case Op.STORE_SLOT: {
        const slot = readU16(code, pc); pc += 2;
        const value = stack.pop()!;
        slots[slot] = clampU16(value);
        break;
      }
      case Op.DRAW_TEXT_CONST: {
        const node = readU16(code, pc); pc += 2;
        const stringId = readU16(code, pc); pc += 2;
        const size = code[pc]!; pc += 1;
        const color = code[pc]!; pc += 1;
        const text = program.strings[stringId] ?? '';
        drawOps.push(makeDrawText(node, slots, text, size, color, 'const', null, glyphW));
        break;
      }
      case Op.DRAW_TEXT_BIND: {
        const node = readU16(code, pc); pc += 2;
        const bind = readU16(code, pc); pc += 2;
        const size = code[pc]!; pc += 1;
        const color = code[pc]!; pc += 1;
        const bindPath = program.binds[bind] ?? '';
        const value = resolveBind(runtime, bindPath);
        const text = value == null ? '' : String(value);
        drawOps.push(makeDrawText(node, slots, text, size, color, 'bind', bindPath, glyphW));
        break;
      }
      case Op.DRAW_BAR_BIND: {
        const node = readU16(code, pc); pc += 2;
        const bind = readU16(code, pc); pc += 2;
        const maxValue = readU16(code, pc); pc += 2;
        const track = code[pc]!; pc += 1;
        const fill = code[pc]!; pc += 1;
        const bindPath = program.binds[bind] ?? '';
        const value = resolveBind(runtime, bindPath);
        drawOps.push(makeDrawBar(node, slots, toInt(value), maxValue, track, fill, bindPath));
        break;
      }
      case Op.DRAW_BAR_CONST: {
        const node = readU16(code, pc); pc += 2;
        const value = readU16(code, pc); pc += 2;
        const maxValue = readU16(code, pc); pc += 2;
        const track = code[pc]!; pc += 1;
        const fill = code[pc]!; pc += 1;
        drawOps.push(makeDrawBar(node, slots, value, maxValue, track, fill, null));
        break;
      }
      case Op.DRAW_HLINE: {
        const node = readU16(code, pc); pc += 2;
        const color = code[pc]!; pc += 1;
        drawOps.push({
          type: 'hline', node,
          x: sl(slots, slotId(node, 'x')),
          y: sl(slots, slotId(node, 'y')),
          w: sl(slots, slotId(node, 'w')),
          h: 1,
          color,
        });
        break;
      }
      case Op.DRAW_VLINE: {
        const node = readU16(code, pc); pc += 2;
        const color = code[pc]!; pc += 1;
        drawOps.push({
          type: 'vline', node,
          x: sl(slots, slotId(node, 'x')),
          y: sl(slots, slotId(node, 'y')),
          w: 1,
          h: sl(slots, slotId(node, 'h')),
          color,
        });
        break;
      }
      case Op.HALT:
        pc = code.length; // exit loop
        break;
      default:
        throw new Error(`Unknown opcode 0x${op.toString(16).padStart(2, '0')} at pc ${pc - 1}`);
    }
  }

  const namedSlots: Record<string, number> = {};
  for (let i = 0; i < slots.length; i++) {
    namedSlots[slotName(i)] = slots[i]!;
  }
  return { slots: namedSlots, drawOps };
}

// ── Draw-op builders ─────────────────────────────────────────────────────────

function makeDrawText(
  node: number, slots: number[], text: string,
  size: number, color: number, source: string,
  bind: string | null, glyphW: number,
): DrawOp {
  return {
    type: 'text', node, source, bind, text,
    x: sl(slots, slotId(node, 'x')),
    y: sl(slots, slotId(node, 'y')),
    w: sl(slots, slotId(node, 'w')),
    h: sl(slots, slotId(node, 'h')),
    size, color,
    intrinsic_w: text.length * glyphW * size,
  };
}

function makeDrawBar(
  node: number, slots: number[], value: number, maxValue: number,
  track: number, fill: number, bind: string | null,
): DrawOp {
  const w = sl(slots, slotId(node, 'w'));
  const frac = maxValue <= 0 ? 0 : Math.max(0, Math.min(value / maxValue, 1));
  return {
    type: 'bar', node, bind, value, max: maxValue,
    x: sl(slots, slotId(node, 'x')),
    y: sl(slots, slotId(node, 'y')),
    w,
    h: sl(slots, slotId(node, 'h')),
    fill_w: Math.trunc(w * frac),
    track, fill,
  };
}
