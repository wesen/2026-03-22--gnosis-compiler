import { PALETTE, blitText } from './bitmapFont';

/** Read a little-endian 16-bit unsigned int from a byte array */
export function readU16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

/** Opcode constants (static GNBC format, little-endian) */
export const OP = {
  NOP: 0x00,
  HLINE: 0x01,
  VLINE: 0x02,
  FILL_RECT: 0x03,
  STROKE_RECT: 0x04,
  TEXT: 0x10,
  BIND_TEXT: 0x11,
  BAR: 0x12,
  BIND_BAR: 0x13,
  CIRCLE: 0x14,
  CROSS: 0x15,
  HALT: 0xff,
} as const;

export interface ExecuteOptions {
  strings: string[];
  binds: string[];
  bindValues: Record<string, string>;
}

/**
 * Execute GNBC bytecode on a canvas context.
 * This is a direct port of the vanilla JS `executeBytecode()`.
 */
export function executeBytecode(
  ctx: CanvasRenderingContext2D,
  bytes: Uint8Array,
  options: ExecuteOptions,
): void {
  const { strings, binds, bindValues } = options;
  let pc = 0;

  while (pc < bytes.length) {
    const op = bytes[pc]!;
    pc++;

    if (op === OP.HALT) break;
    if (op === OP.NOP) continue;

    if (op === OP.HLINE) {
      const x = readU16LE(bytes, pc); pc += 2;
      const y = readU16LE(bytes, pc); pc += 2;
      const w = readU16LE(bytes, pc); pc += 2;
      const col = bytes[pc]!; pc++;
      ctx.fillStyle = PALETTE[col] ?? PALETTE[1]!;
      ctx.fillRect(x, y, w, 1);
    } else if (op === OP.VLINE) {
      const x = readU16LE(bytes, pc); pc += 2;
      const y = readU16LE(bytes, pc); pc += 2;
      const h = readU16LE(bytes, pc); pc += 2;
      const col = bytes[pc]!; pc++;
      ctx.fillStyle = PALETTE[col] ?? PALETTE[1]!;
      ctx.fillRect(x, y, 1, h);
    } else if (op === OP.FILL_RECT) {
      const x = readU16LE(bytes, pc); pc += 2;
      const y = readU16LE(bytes, pc); pc += 2;
      const w = readU16LE(bytes, pc); pc += 2;
      const h = readU16LE(bytes, pc); pc += 2;
      const col = bytes[pc]!; pc++;
      ctx.fillStyle = PALETTE[col] ?? PALETTE[1]!;
      ctx.fillRect(x, y, w, h);
    } else if (op === OP.STROKE_RECT) {
      const x = readU16LE(bytes, pc); pc += 2;
      const y = readU16LE(bytes, pc); pc += 2;
      const w = readU16LE(bytes, pc); pc += 2;
      const h = readU16LE(bytes, pc); pc += 2;
      const col = bytes[pc]!; pc++;
      ctx.strokeStyle = PALETTE[col] ?? PALETTE[1]!;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    } else if (op === OP.TEXT) {
      const x = readU16LE(bytes, pc); pc += 2;
      const y = readU16LE(bytes, pc); pc += 2;
      const size = bytes[pc]!; pc++;
      const col = bytes[pc]!; pc++;
      const max = bytes[pc]!; pc++;
      const sid = readU16LE(bytes, pc); pc += 2;
      blitText(ctx, x, y, strings[sid] ?? '', size, col, max);
    } else if (op === OP.BIND_TEXT) {
      const x = readU16LE(bytes, pc); pc += 2;
      const y = readU16LE(bytes, pc); pc += 2;
      const size = bytes[pc]!; pc++;
      const col = bytes[pc]!; pc++;
      const max = bytes[pc]!; pc++;
      const bid = bytes[pc]!; pc++;
      const bname = binds[bid] ?? '';
      const text = bindValues[bname] || bname.split('.').pop() || '---';
      blitText(ctx, x, y, text, size, col, max);
    } else if (op === OP.BAR) {
      const x = readU16LE(bytes, pc); pc += 2;
      const y = readU16LE(bytes, pc); pc += 2;
      const w = readU16LE(bytes, pc); pc += 2;
      const h = readU16LE(bytes, pc); pc += 2;
      const val = readU16LE(bytes, pc); pc += 2;
      const mx = readU16LE(bytes, pc); pc += 2;
      const track = bytes[pc]!; pc++;
      const fill = bytes[pc]!; pc++;
      ctx.fillStyle = PALETTE[track] ?? PALETTE[1]!;
      ctx.fillRect(x, y, w, h);
      const fw = Math.floor(w * Math.min(val, mx) / Math.max(mx, 1));
      ctx.fillStyle = PALETTE[fill] ?? PALETTE[1]!;
      ctx.fillRect(x, y, fw, h);
    } else if (op === OP.BIND_BAR) {
      const x = readU16LE(bytes, pc); pc += 2;
      const y = readU16LE(bytes, pc); pc += 2;
      const w = readU16LE(bytes, pc); pc += 2;
      const h = readU16LE(bytes, pc); pc += 2;
      const bid = bytes[pc]!; pc++;
      const mx = readU16LE(bytes, pc); pc += 2;
      const track = bytes[pc]!; pc++;
      const fill = bytes[pc]!; pc++;
      ctx.fillStyle = PALETTE[track] ?? PALETTE[1]!;
      ctx.fillRect(x, y, w, h);
      const bname = binds[bid] ?? '';
      const val = parseInt(bindValues[bname] ?? '') || Math.floor(mx / 2);
      const fw = Math.floor(w * Math.min(val, mx) / Math.max(mx, 1));
      ctx.fillStyle = PALETTE[fill] ?? PALETTE[1]!;
      ctx.fillRect(x, y, fw, h);
    } else if (op === OP.CIRCLE) {
      const cx = readU16LE(bytes, pc); pc += 2;
      const cy = readU16LE(bytes, pc); pc += 2;
      const r = readU16LE(bytes, pc); pc += 2;
      const col = bytes[pc]!; pc++;
      ctx.strokeStyle = PALETTE[col] ?? PALETTE[1]!;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (op === OP.CROSS) {
      const cx = readU16LE(bytes, pc); pc += 2;
      const cy = readU16LE(bytes, pc); pc += 2;
      const len = readU16LE(bytes, pc); pc += 2;
      const col = bytes[pc]!; pc++;
      ctx.strokeStyle = PALETTE[col] ?? PALETTE[1]!;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - len, cy);
      ctx.lineTo(cx + len, cy);
      ctx.moveTo(cx, cy - len);
      ctx.lineTo(cx, cy + len);
      ctx.stroke();
    } else {
      break; // unknown opcode
    }
  }
}
