/**
 * 5x7 bitmap font glyph data.
 * Each glyph is an array of 7 row bitmasks (5 bits each, MSB = leftmost pixel).
 */
export const GLYPHS: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 14],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 17, 25, 21, 19, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [14, 17, 16, 14, 1, 17, 14],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 2, 4, 8, 31],
  '3': [14, 17, 1, 6, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [14, 17, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 17, 14],
  ':': [0, 4, 4, 0, 4, 4, 0],
  '.': [0, 0, 0, 0, 0, 12, 12],
  '-': [0, 0, 0, 31, 0, 0, 0],
  '/': [1, 2, 2, 4, 8, 8, 16],
  '%': [25, 25, 2, 4, 8, 19, 19],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '>': [8, 4, 2, 1, 2, 4, 8],
  '+': [0, 4, 4, 31, 4, 4, 0],
  '#': [10, 10, 31, 10, 31, 10, 10],
  '_': [0, 0, 0, 0, 0, 0, 31],
  '=': [0, 0, 31, 0, 31, 0, 0],
  '!': [4, 4, 4, 4, 4, 0, 4],
  ',': [0, 0, 0, 0, 0, 4, 8],
  "'": [4, 4, 8, 0, 0, 0, 0],
  '[': [14, 8, 8, 8, 8, 8, 14],
  ']': [14, 2, 2, 2, 2, 2, 14],
  '<': [1, 2, 4, 8, 4, 2, 1],
  '@': [14, 17, 23, 21, 23, 16, 14],
  ';': [0, 4, 4, 0, 4, 4, 8],
  '*': [0, 10, 4, 31, 4, 10, 0],
};

// Add lowercase as aliases of uppercase
'abcdefghijklmnopqrstuvwxyz'.split('').forEach((c, i) => {
  GLYPHS[c] = GLYPHS[String.fromCharCode(65 + i)]!;
});

/** E-ink palette colors indexed by ID */
export const PALETTE: Record<number, string> = {
  0: '#d8d4cc',
  1: '#2a2a28',
  2: '#9e9a92',
  3: '#c4c0b8',
  4: '#b8b4ac',
};

export const COLOR_NAMES: Record<number, string> = {
  0: 'bg',
  1: 'fg',
  2: 'mid',
  3: 'light',
  4: 'ghost',
};

/** Glyph width in pixels (includes 3px inter-character spacing) */
export const GLYPH_W = 8;

const EMPTY_GLYPH = [0, 0, 0, 0, 0, 0, 0];

/** Draw a single character at (x, y) on the canvas context */
export function blitChar(
  ctx: CanvasRenderingContext2D,
  ch: string,
  x: number,
  y: number,
  size: number,
  col: number,
): void {
  const bm = GLYPHS[ch] ?? EMPTY_GLYPH;
  ctx.fillStyle = PALETTE[col] ?? PALETTE[1]!;
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 5; c++) {
      if (bm[r]! & (1 << (4 - c))) {
        ctx.fillRect(x + c * size, y + r * size, size, size);
      }
    }
  }
}

/** Draw a text string at (x, y) using the bitmap font */
export function blitText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  size: number,
  col: number,
  max?: number,
): void {
  const t = (text || '').slice(0, max ?? 999);
  for (let i = 0; i < t.length; i++) {
    blitChar(ctx, t[i]!, x + i * GLYPH_W * size, y, size, col);
  }
}
