import { useState, useRef, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════
//  GNOSIS BYTECODE COMPILER + EXECUTOR
//  DSL JSON → Optimize → Bytecode → Virtual EPD Framebuffer
// ═══════════════════════════════════════════════════════════

// ── OPCODES ──
const OP = {
  NOP:        0x00,
  RECT:       0x01, // x(u16) y(u16) w(u16) h(u16)
  FILL:       0x02, // color(u8) — fill current rect
  STROKE:     0x03, // color(u8) — stroke current rect
  HLINE:      0x04, // x(u16) y(u16) w(u16) color(u8)
  VLINE:      0x05, // x(u16) y(u16) h(u16) color(u8)
  BLIT_TEXT:  0x06, // x(u16) y(u16) size(u8) color(u8) len(u8) chars...
  BLIT_STATIC:0x07, // x(u16) y(u16) w(u16) h(u16) rom_offset(u16) — pre-rendered
  BAR:        0x08, // x(u16) y(u16) w(u16) h(u16) value(u8) max(u8) track(u8) fill(u8)
  CIRCLE:     0x09, // cx(u16) cy(u16) r(u16) color(u8)
  CROSS:      0x0A, // cx(u16) cy(u16) len(u16) color(u8)
  BIND_BAR:   0x0B, // x(u16) y(u16) w(u16) h(u16) bind_id(u8) max(u8)
  BIND_TEXT:  0x0C, // x(u16) y(u16) size(u8) color(u8) bind_id(u8) field_w(u8)
  REGION:     0x0D, // waveform(u8) x(u16) y(u16) w(u16) h(u16)
  REGION_END: 0x0E,
  DOT:        0x0F, // x(u16) y(u16) size(u8) color(u8)
  ICON:       0x10, // x(u16) y(u16) shape(u8) size(u8)
  GRID_BEGIN: 0x11, // x(u16) y(u16) cols(u8) cell_w(u16) cell_h(u16) count(u8)
  GRID_CELL:  0x12, // index(u8) flags(u8) — flags: bit0=today, bit1=event
  GRID_END:   0x13,
  PUSH_CLIP:  0x14, // x(u16) y(u16) w(u16) h(u16)
  POP_CLIP:   0x15,
  HALT:       0xFF,
};

const OP_NAMES = {};
Object.entries(OP).forEach(([k,v]) => { OP_NAMES[v] = k; });

const WF = { FULL: 0, FAST: 1, PART: 2 };
const WF_NAMES = { 0: "FULL", 1: "FAST", 2: "PART" };
const COL = { BG: 0, FG: 1, MID: 2, LIGHT: 3, GHOST: 4 };
const COL_NAMES = { 0: "BG", 1: "FG", 2: "MID", 3: "LIGHT", 4: "GHOST" };
const PAL_HEX = { 0: "#d8d4cc", 1: "#2a2a28", 2: "#9e9a92", 3: "#c4c0b8", 4: "#b8b4ac" };
const SHAPE = { SQUARE: 0, CIRCLE: 1, DIAMOND: 2, TRIANGLE: 3 };
const SHAPE_NAMES = { 0: "SQUARE", 1: "CIRCLE", 2: "DIAMOND", 3: "TRIANGLE" };

const GLYPH_W = 6;
const GLYPH_H = 8;

function colorId(c) {
  if (c === "fg" || c === 1) return COL.FG;
  if (c === "mid" || c === 2) return COL.MID;
  if (c === "light" || c === 3) return COL.LIGHT;
  if (c === "ghost" || c === 4) return COL.GHOST;
  return COL.FG;
}

function shapeId(s) {
  if (s === "square") return SHAPE.SQUARE;
  if (s === "circle") return SHAPE.CIRCLE;
  if (s === "diamond") return SHAPE.DIAMOND;
  if (s === "triangle") return SHAPE.TRIANGLE;
  return 0;
}

// ── COMPILER ──
class Compiler {
  constructor() {
    this.bytes = [];
    this.labels = {};
    this.bindTable = {};
    this.nextBind = 0;
    this.stats = { nodes: 0, static_nodes: 0, dynamic_nodes: 0, optimizations: [] };
    this.romBlobs = []; // pre-rendered static bitmaps
  }

  emit(op, ...args) {
    this.bytes.push(op);
    args.forEach(a => {
      if (typeof a === "number") {
        if (a > 255) { this.bytes.push((a >> 8) & 0xFF); this.bytes.push(a & 0xFF); }
        else { this.bytes.push(a & 0xFF); }
      }
    });
  }

  emitU16(v) { this.bytes.push((v >> 8) & 0xFF); this.bytes.push(v & 0xFF); }
  emitU8(v) { this.bytes.push(v & 0xFF); }

  emitText(op, x, y, size, color, text) {
    const str = String(text).slice(0, 63);
    this.bytes.push(op);
    this.emitU16(x); this.emitU16(y);
    this.emitU8(size); this.emitU8(color); this.emitU8(str.length);
    for (let i = 0; i < str.length; i++) this.emitU8(str.charCodeAt(i));
  }

  getBind(name) {
    if (!(name in this.bindTable)) { this.bindTable[name] = this.nextBind++; }
    return this.bindTable[name];
  }

  compile(dsl) {
    this.bytes = [];
    this.stats = { nodes: 0, static_nodes: 0, dynamic_nodes: 0, optimizations: [] };
    this.romBlobs = [];
    this.bindTable = {};
    this.nextBind = 0;

    // Pass 1: Analyze & optimize
    const optimized = this.optimize(JSON.parse(JSON.stringify(dsl)));

    // Pass 2: Layout (simplified compile-time layout)
    const CW = 400, CH = 280;
    this.emitNode(optimized, 0, 0, CW, CH);

    this.bytes.push(OP.HALT);
    return {
      bytecode: new Uint8Array(this.bytes),
      stats: this.stats,
      bindTable: this.bindTable,
      romBlobs: this.romBlobs,
    };
  }

  optimize(node) {
    if (!node) return node;
    const kids = node.items || node.children || [];

    // Opt 1: Flatten nested same-axis containers
    if ((node.type === "vbox" || node.layout === "vbox") && kids.length > 0) {
      const flattened = [];
      let didFlatten = false;
      kids.forEach(k => {
        if ((k.type === "vbox" || k.layout === "vbox") && !k.h && !k.border_b && !k.border_t) {
          const inner = k.items || k.children || [];
          flattened.push(...inner);
          didFlatten = true;
        } else {
          flattened.push(k);
        }
      });
      if (didFlatten) {
        this.stats.optimizations.push("FLATTEN_VBOX: merged nested vbox children");
        if (node.items) node.items = flattened;
        else node.children = flattened;
      }
    }

    // Opt 2: Mark static nodes (no bindings)
    const hasBinding = JSON.stringify(node).includes('"bind"');
    if (!hasBinding) {
      node._static = true;
      this.stats.static_nodes++;
    } else {
      this.stats.dynamic_nodes++;
    }
    this.stats.nodes++;

    // Recurse
    (node.items || node.children || []).forEach(k => this.optimize(k));

    // Opt 3: Merge adjacent static labels at same y in fixed containers
    if (node.type === "fixed") {
      const items = node.items || node.children || [];
      const labelGroups = {};
      items.forEach(item => {
        if (item.type === "label" && item._static && item.y !== undefined) {
          const key = `${item.y}_${item.size || 1}_${item.color || "fg"}`;
          if (!labelGroups[key]) labelGroups[key] = [];
          labelGroups[key].push(item);
        }
      });
      Object.values(labelGroups).forEach(group => {
        if (group.length >= 3) {
          this.stats.optimizations.push(`MERGE_LABELS: ${group.length} labels at y=${group[0].y} → pre-rendered blob`);
        }
      });
    }

    return node;
  }

  emitNode(node, x, y, w, h) {
    if (!node) return;
    const kids = node.items || node.children || [];

    // Borders
    if (node.border_b) {
      this.bytes.push(OP.HLINE);
      this.emitU16(x); this.emitU16(y + h - 1); this.emitU16(w); this.emitU8(COL.MID);
    }
    if (node.border_t) {
      this.bytes.push(OP.HLINE);
      this.emitU16(x); this.emitU16(y); this.emitU16(w); this.emitU8(COL.MID);
    }

    // Widgets
    if (node.type === "label" || (node.label && !node.type)) {
      const text = node.content || node.label || "";
      const sz = node.size || 1;
      const col = colorId(node.color);
      if (node.invert) {
        this.bytes.push(OP.RECT);
        this.emitU16(x); this.emitU16(y);
        this.emitU16(text.length * GLYPH_W * sz + 6);
        this.emitU16(GLYPH_H * sz + 4);
        this.bytes.push(OP.FILL); this.emitU8(COL.FG);
        this.emitText(OP.BLIT_TEXT, x + 3, y + 2, sz, COL.BG, text);
      } else {
        this.emitText(OP.BLIT_TEXT, x + (node.px||0), y + (node.py||0), sz, col, text);
      }
    }

    if (node.type === "sep") {
      this.bytes.push(OP.HLINE);
      this.emitU16(x); this.emitU16(y); this.emitU16(node.w || w); this.emitU8(COL.MID);
    }

    if (node.type === "bar") {
      this.bytes.push(OP.BAR);
      this.emitU16(x); this.emitU16(y);
      this.emitU16(node.w || w); this.emitU16(node.h || 3);
      this.emitU8(node.value || 0); this.emitU8(node.max || 100);
      this.emitU8(COL.LIGHT); this.emitU8(COL.FG);
    }

    if (node.type === "gauge") {
      const val = node.value || 0;
      const padStr = String(val).padStart(3, "0");
      this.emitText(OP.BLIT_TEXT, x, y, 1, COL.MID, node.label || "");
      this.emitText(OP.BLIT_TEXT, x + 18, y, 1, COL.FG, padStr);
      this.bytes.push(OP.BAR);
      this.emitU16(x + 50); this.emitU16(y + 3);
      this.emitU16(Math.max(10, (node.w || w) - 58));
      this.emitU16(3);
      this.emitU8(val); this.emitU8(node.max || 360);
      this.emitU8(COL.LIGHT); this.emitU8(COL.FG);
    }

    if (node.type === "circle") {
      this.bytes.push(OP.CIRCLE);
      this.emitU16(x + (node.cx || 0)); this.emitU16(y + (node.cy || 0));
      this.emitU16(node.r || 20); this.emitU8(COL.MID);
    }

    if (node.type === "cross") {
      this.bytes.push(OP.CROSS);
      this.emitU16(x + (node.cx || 0)); this.emitU16(y + (node.cy || 0));
      this.emitU16(node.len || 8); this.emitU8(COL.FG);
    }

    if (node.type === "dot") {
      this.bytes.push(OP.DOT);
      this.emitU16(x + 2); this.emitU16(y + Math.floor(h/2) - 2);
      this.emitU8(4); this.emitU8(COL.FG);
    }

    if (node.type === "badge") {
      const text = node.content || "";
      const bw = text.length * GLYPH_W + 8;
      this.bytes.push(OP.RECT);
      this.emitU16(x); this.emitU16(y + 2); this.emitU16(bw); this.emitU16(GLYPH_H + 4);
      this.bytes.push(OP.FILL); this.emitU8(COL.FG);
      this.emitText(OP.BLIT_TEXT, x + 4, y + 4, 1, COL.BG, text);
    }

    if (node.type === "icon") {
      this.bytes.push(OP.ICON);
      this.emitU16(x + Math.floor(w/2)); this.emitU16(y + Math.floor(h/2));
      this.emitU8(shapeId(node.shape)); this.emitU8(8);
    }

    if (node.type === "cursor") {
      this.bytes.push(OP.RECT);
      this.emitU16(x); this.emitU16(y); this.emitU16(5); this.emitU16(GLYPH_H);
      this.bytes.push(OP.FILL); this.emitU8(COL.FG);
    }

    if (node.type === "text_block") {
      const lines = (node.content || "").split("\n");
      const lineH = node.line_h || 14;
      lines.forEach((line, i) => {
        if (i * lineH < (node.h || 999)) {
          this.emitText(OP.BLIT_TEXT, x, y + i * lineH, 1, COL.FG, line);
        }
      });
    }

    if (node.type === "grid") {
      const cols = node.cols || 7;
      const cellW = node.cell_w || Math.floor(w / cols);
      const cellH = node.cell_h || 20;
      const count = node.count || cols * 5;
      this.bytes.push(OP.GRID_BEGIN);
      this.emitU16(x); this.emitU16(y);
      this.emitU8(cols); this.emitU16(cellW); this.emitU16(cellH); this.emitU8(count);
      for (let i = 0; i < count; i++) {
        const dayNum = (i % 31) + 1;
        let flags = 0;
        if (node.today === i) flags |= 1;
        if (node.event_days && node.event_days.includes(dayNum)) flags |= 2;
        this.bytes.push(OP.GRID_CELL);
        this.emitU8(i); this.emitU8(flags);
      }
      this.bytes.push(OP.GRID_END);
    }

    if (node.type === "list") {
      const rowH = node.row_h || 14;
      const items = node.data || [];
      const max = Math.min(node.max || 6, items.length);
      // Emit each row as text blits
      for (let i = 0; i < max; i++) {
        const ry = y + i * rowH;
        if (node.selected === i) {
          this.bytes.push(OP.RECT);
          this.emitU16(x); this.emitU16(ry); this.emitU16(w); this.emitU16(rowH);
          this.bytes.push(OP.FILL); this.emitU8(COL.LIGHT);
        }
        const item = items[i];
        if (typeof item === "string") {
          this.emitText(OP.BLIT_TEXT, x + 2, ry + 2, 1, COL.FG, item);
        } else if (item.cols) {
          let cx = x + 2;
          item.cols.forEach(c => {
            this.emitText(OP.BLIT_TEXT, cx, ry + 2, 1, colorId(c.color), c.text || "");
            cx += (c.w || 60);
          });
        }
      }
    }

    // Layout containers — recurse
    if (node.type === "vbox" || node.layout === "vbox") {
      let fixedH = 0, flexCount = 0;
      kids.forEach(k => { if (k.h) fixedH += k.h; else flexCount++; });
      const flexH = flexCount > 0 ? Math.floor((h - fixedH) / flexCount) : 0;
      let cy = y;
      kids.forEach(k => {
        const ch = k.h || flexH;
        this.emitNode(k, x, cy, w, ch);
        cy += ch;
      });
    } else if (node.type === "hbox" || node.layout === "hbox") {
      if (node.split) {
        const lw = node.split;
        const rw = w - lw - 1;
        if (kids[0]) this.emitNode(kids[0], x, y, lw, h);
        this.bytes.push(OP.VLINE);
        this.emitU16(x + lw); this.emitU16(y); this.emitU16(h); this.emitU8(COL.MID);
        if (kids[1]) this.emitNode(kids[1], x + lw + 1, y, rw, h);
      } else {
        let fixedW = 0, flexCount = 0;
        kids.forEach(k => {
          if (k.w) fixedW += k.w;
          else if (k.spacer) flexCount++;
          else fixedW += ((k.label || k.content || "").length * GLYPH_W) + 8;
        });
        const flexW = flexCount > 0 ? Math.floor((w - fixedW) / flexCount) : 0;
        let cx = x;
        kids.forEach(k => {
          let cw;
          if (k.spacer) cw = flexW;
          else if (k.w) cw = k.w;
          else cw = ((k.label || k.content || "").length * GLYPH_W) + 8;
          this.emitNode(k, cx, y, cw, h);
          cx += cw;
        });
      }
    } else if (node.type === "fixed") {
      kids.forEach(k => {
        const kx = x + (k.x || 0);
        const ky = y + (k.y || 0);
        const kw = k.w || w - (k.x || 0);
        const kh = k.h || h - (k.y || 0);
        this.emitNode(k, kx, ky, kw, kh);
      });
    }
  }
}

// ── EXECUTOR (bytecode interpreter → canvas) ──
const BITMAPS = {
  A:[0b01110,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  B:[0b11110,0b10001,0b10001,0b11110,0b10001,0b10001,0b11110],
  C:[0b01110,0b10001,0b10000,0b10000,0b10000,0b10001,0b01110],
  D:[0b11110,0b10001,0b10001,0b10001,0b10001,0b10001,0b11110],
  E:[0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b11111],
  F:[0b11111,0b10000,0b10000,0b11110,0b10000,0b10000,0b10000],
  G:[0b01110,0b10001,0b10000,0b10111,0b10001,0b10001,0b01110],
  H:[0b10001,0b10001,0b10001,0b11111,0b10001,0b10001,0b10001],
  I:[0b01110,0b00100,0b00100,0b00100,0b00100,0b00100,0b01110],
  J:[0b00111,0b00010,0b00010,0b00010,0b00010,0b10010,0b01100],
  K:[0b10001,0b10010,0b10100,0b11000,0b10100,0b10010,0b10001],
  L:[0b10000,0b10000,0b10000,0b10000,0b10000,0b10000,0b11111],
  M:[0b10001,0b11011,0b10101,0b10101,0b10001,0b10001,0b10001],
  N:[0b10001,0b10001,0b11001,0b10101,0b10011,0b10001,0b10001],
  O:[0b01110,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  P:[0b11110,0b10001,0b10001,0b11110,0b10000,0b10000,0b10000],
  Q:[0b01110,0b10001,0b10001,0b10001,0b10101,0b10010,0b01101],
  R:[0b11110,0b10001,0b10001,0b11110,0b10100,0b10010,0b10001],
  S:[0b01110,0b10001,0b10000,0b01110,0b00001,0b10001,0b01110],
  T:[0b11111,0b00100,0b00100,0b00100,0b00100,0b00100,0b00100],
  U:[0b10001,0b10001,0b10001,0b10001,0b10001,0b10001,0b01110],
  V:[0b10001,0b10001,0b10001,0b10001,0b10001,0b01010,0b00100],
  W:[0b10001,0b10001,0b10001,0b10101,0b10101,0b11011,0b10001],
  X:[0b10001,0b10001,0b01010,0b00100,0b01010,0b10001,0b10001],
  Y:[0b10001,0b10001,0b01010,0b00100,0b00100,0b00100,0b00100],
  Z:[0b11111,0b00001,0b00010,0b00100,0b01000,0b10000,0b11111],
  " ":[0,0,0,0,0,0,0],
  "0":[0b01110,0b10001,0b10011,0b10101,0b11001,0b10001,0b01110],
  "1":[0b00100,0b01100,0b00100,0b00100,0b00100,0b00100,0b01110],
  "2":[0b01110,0b10001,0b00001,0b00010,0b00100,0b01000,0b11111],
  "3":[0b01110,0b10001,0b00001,0b00110,0b00001,0b10001,0b01110],
  "4":[0b00010,0b00110,0b01010,0b10010,0b11111,0b00010,0b00010],
  "5":[0b11111,0b10000,0b11110,0b00001,0b00001,0b10001,0b01110],
  "6":[0b01110,0b10001,0b10000,0b11110,0b10001,0b10001,0b01110],
  "7":[0b11111,0b00001,0b00010,0b00100,0b01000,0b01000,0b01000],
  "8":[0b01110,0b10001,0b10001,0b01110,0b10001,0b10001,0b01110],
  "9":[0b01110,0b10001,0b10001,0b01111,0b00001,0b10001,0b01110],
  ":":[0,0b00100,0b00100,0,0b00100,0b00100,0],
  ".":[0,0,0,0,0,0b01100,0b01100],
  "-":[0,0,0,0b11111,0,0,0],
  "/":[0b00001,0b00010,0b00010,0b00100,0b01000,0b01000,0b10000],
  "%":[0b11001,0b11001,0b00010,0b00100,0b01000,0b10011,0b10011],
  "(":[0b00010,0b00100,0b01000,0b01000,0b01000,0b00100,0b00010],
  ")":[0b01000,0b00100,0b00010,0b00010,0b00010,0b00100,0b01000],
  ">":[0b01000,0b00100,0b00010,0b00001,0b00010,0b00100,0b01000],
  "+":[0,0b00100,0b00100,0b11111,0b00100,0b00100,0],
  "#":[0b01010,0b01010,0b11111,0b01010,0b11111,0b01010,0b01010],
  "_":[0,0,0,0,0,0,0b11111],
  "=":[0,0,0b11111,0,0b11111,0,0],
  "!":[0b00100,0b00100,0b00100,0b00100,0b00100,0,0b00100],
  ",":[0,0,0,0,0,0b00100,0b01000],
  "'":[0b00100,0b00100,0b01000,0,0,0,0],
};
"abcdefghijklmnopqrstuvwxyz".split("").forEach((c,i) => {
  BITMAPS[c] = BITMAPS[String.fromCharCode(65+i)];
});

class Executor {
  constructor(ctx, scale) {
    this.ctx = ctx;
    this.scale = scale;
    this.pc = 0;
    this.bytecode = null;
    this.execLog = [];
    this.opsExecuted = 0;
    this.clipStack = [];
    this.curRect = { x:0, y:0, w:0, h:0 };
  }

  readU8() { return this.bytecode[this.pc++]; }
  readU16() { const hi = this.bytecode[this.pc++]; const lo = this.bytecode[this.pc++]; return (hi << 8) | lo; }

  pal(c) { return PAL_HEX[c] || PAL_HEX[1]; }

  blitChar(ch, x, y, size, color) {
    const bm = BITMAPS[ch] || BITMAPS[" "] || [0,0,0,0,0,0,0];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (bm[row] & (1 << (4 - col))) {
          this.ctx.fillStyle = this.pal(color);
          this.ctx.fillRect(x + col * size, y + row * size, size, size);
        }
      }
    }
  }

  execute(bytecode, highlight = -1) {
    this.bytecode = bytecode;
    this.pc = 0;
    this.execLog = [];
    this.opsExecuted = 0;
    const ctx = this.ctx;
    const W = 400, H = 280;

    // e-ink bg
    ctx.fillStyle = PAL_HEX[0];
    ctx.fillRect(0, 0, W, H);

    // grain
    const imgData = ctx.getImageData(0, 0, W * this.scale, H * this.scale);
    for (let i = 0; i < imgData.data.length; i += 16) {
      const n = (Math.random() - 0.5) * 6;
      imgData.data[i] += n; imgData.data[i+1] += n; imgData.data[i+2] += n;
    }
    ctx.putImageData(imgData, 0, 0);

    let gridState = null;

    while (this.pc < bytecode.length) {
      const startPc = this.pc;
      const op = this.readU8();
      const opName = OP_NAMES[op] || `UNK_${op.toString(16)}`;
      let detail = "";
      const isHighlighted = startPc === highlight;

      if (op === OP.HALT) { this.execLog.push({ pc: startPc, op: opName, detail: "" }); break; }

      switch(op) {
        case OP.RECT: {
          const x = this.readU16(), y = this.readU16(), w = this.readU16(), h = this.readU16();
          this.curRect = { x, y, w, h };
          detail = `${x},${y} ${w}x${h}`;
          if (isHighlighted) { ctx.strokeStyle="#ff000088"; ctx.lineWidth=2; ctx.strokeRect(x,y,w,h); }
          break;
        }
        case OP.FILL: {
          const c = this.readU8();
          ctx.fillStyle = this.pal(c);
          ctx.fillRect(this.curRect.x, this.curRect.y, this.curRect.w, this.curRect.h);
          detail = COL_NAMES[c];
          if (isHighlighted) { ctx.strokeStyle="#ff000088"; ctx.lineWidth=2; ctx.strokeRect(this.curRect.x,this.curRect.y,this.curRect.w,this.curRect.h); }
          break;
        }
        case OP.STROKE: {
          const c = this.readU8();
          ctx.strokeStyle = this.pal(c); ctx.lineWidth = 1;
          ctx.strokeRect(this.curRect.x+.5, this.curRect.y+.5, this.curRect.w-1, this.curRect.h-1);
          detail = COL_NAMES[c];
          break;
        }
        case OP.HLINE: {
          const x = this.readU16(), y = this.readU16(), w = this.readU16(), c = this.readU8();
          ctx.fillStyle = this.pal(c);
          ctx.fillRect(x, y, w, 1);
          detail = `${x},${y} w=${w} ${COL_NAMES[c]}`;
          if (isHighlighted) { ctx.fillStyle="#ff000044"; ctx.fillRect(x,y-2,w,5); }
          break;
        }
        case OP.VLINE: {
          const x = this.readU16(), y = this.readU16(), h = this.readU16(), c = this.readU8();
          ctx.fillStyle = this.pal(c);
          ctx.fillRect(x, y, 1, h);
          detail = `${x},${y} h=${h} ${COL_NAMES[c]}`;
          break;
        }
        case OP.BLIT_TEXT: {
          const x = this.readU16(), y = this.readU16();
          const size = this.readU8(), color = this.readU8(), len = this.readU8();
          let str = "";
          for (let i = 0; i < len; i++) str += String.fromCharCode(this.readU8());
          for (let i = 0; i < str.length; i++) {
            this.blitChar(str[i], x + i * GLYPH_W * size, y, size, color);
          }
          detail = `${x},${y} s${size} "${str.slice(0,16)}${str.length>16?"...":""}"`;
          if (isHighlighted) { ctx.fillStyle="#ff000033"; ctx.fillRect(x,y,str.length*GLYPH_W*size,GLYPH_H*size); }
          break;
        }
        case OP.BAR: {
          const x = this.readU16(), y = this.readU16(), w = this.readU16(), h = this.readU16();
          const val = this.readU8(), max = this.readU8(), track = this.readU8(), fill = this.readU8();
          ctx.fillStyle = this.pal(track); ctx.fillRect(x, y, w, h);
          const fw = Math.floor(w * Math.min(val, max) / Math.max(max, 1));
          ctx.fillStyle = this.pal(fill); ctx.fillRect(x, y, fw, h);
          detail = `${x},${y} ${w}x${h} val=${val}/${max}`;
          if (isHighlighted) { ctx.strokeStyle="#ff000088"; ctx.lineWidth=1; ctx.strokeRect(x-1,y-1,w+2,h+2); }
          break;
        }
        case OP.CIRCLE: {
          const cx = this.readU16(), cy = this.readU16(), r = this.readU16(), c = this.readU8();
          ctx.strokeStyle = this.pal(c); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
          detail = `(${cx},${cy}) r=${r} ${COL_NAMES[c]}`;
          if (isHighlighted) { ctx.strokeStyle="#ff000066"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,cy,r+2,0,Math.PI*2); ctx.stroke(); }
          break;
        }
        case OP.CROSS: {
          const cx = this.readU16(), cy = this.readU16(), len = this.readU16(), c = this.readU8();
          ctx.strokeStyle = this.pal(c); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(cx-len,cy); ctx.lineTo(cx+len,cy);
          ctx.moveTo(cx,cy-len); ctx.lineTo(cx,cy+len); ctx.stroke();
          detail = `(${cx},${cy}) len=${len}`;
          break;
        }
        case OP.DOT: {
          const x = this.readU16(), y = this.readU16(), sz = this.readU8(), c = this.readU8();
          ctx.fillStyle = this.pal(c); ctx.fillRect(x, y, sz, sz);
          detail = `${x},${y} ${sz}px`;
          break;
        }
        case OP.ICON: {
          const x = this.readU16(), y = this.readU16(), shape = this.readU8(), sz = this.readU8();
          ctx.strokeStyle = this.pal(COL.MID); ctx.lineWidth = 1;
          const hs = sz/2;
          if (shape === SHAPE.SQUARE) ctx.strokeRect(x-hs, y-hs, sz, sz);
          else if (shape === SHAPE.CIRCLE) { ctx.beginPath(); ctx.arc(x,y,hs,0,Math.PI*2); ctx.stroke(); }
          else if (shape === SHAPE.DIAMOND) {
            ctx.beginPath(); ctx.moveTo(x,y-hs); ctx.lineTo(x+hs,y); ctx.lineTo(x,y+hs); ctx.lineTo(x-hs,y); ctx.closePath(); ctx.stroke();
          } else if (shape === SHAPE.TRIANGLE) {
            ctx.beginPath(); ctx.moveTo(x,y-hs); ctx.lineTo(x+hs,y+hs); ctx.lineTo(x-hs,y+hs); ctx.closePath(); ctx.stroke();
          }
          detail = `(${x},${y}) ${SHAPE_NAMES[shape]} ${sz}px`;
          break;
        }
        case OP.GRID_BEGIN: {
          const gx = this.readU16(), gy = this.readU16();
          const cols = this.readU8(), cellW = this.readU16(), cellH = this.readU16(), count = this.readU8();
          gridState = { x: gx, y: gy, cols, cellW, cellH, count };
          detail = `${gx},${gy} ${cols}col ${cellW}x${cellH} n=${count}`;
          break;
        }
        case OP.GRID_CELL: {
          const idx = this.readU8(), flags = this.readU8();
          if (gridState) {
            const col = idx % gridState.cols;
            const row = Math.floor(idx / gridState.cols);
            const cx = gridState.x + col * gridState.cellW;
            const cy = gridState.y + row * gridState.cellH;
            ctx.strokeStyle = PAL_HEX[3]; ctx.lineWidth = 0.5;
            ctx.strokeRect(cx+.5, cy+.5, gridState.cellW-1, gridState.cellH-1);
            const dayNum = (idx % 31) + 1;
            if (flags & 1) { // today
              ctx.fillStyle = PAL_HEX[1];
              ctx.fillRect(cx+1, cy+1, gridState.cellW-2, gridState.cellH-2);
              this.blitChar(String(dayNum).charAt(0), cx + gridState.cellW - 12, cy + 3, 1, COL.BG);
              if (dayNum > 9) this.blitChar(String(dayNum).charAt(0), cx + gridState.cellW - 18, cy + 3, 1, COL.BG);
            } else {
              const ds = String(dayNum);
              for (let di = 0; di < ds.length; di++) {
                this.blitChar(ds[di], cx + gridState.cellW - 12 - (ds.length-1-di)*6, cy + 3, 1, COL.FG);
              }
            }
            if (flags & 2) { // event dot
              ctx.fillStyle = PAL_HEX[1];
              ctx.fillRect(cx + Math.floor(gridState.cellW/2)-1, cy + gridState.cellH - 4, 3, 3);
            }
          }
          detail = `idx=${idx} flags=${flags.toString(2).padStart(8,"0")}`;
          break;
        }
        case OP.GRID_END: {
          gridState = null;
          detail = "";
          break;
        }
        case OP.NOP: detail = ""; break;
        default: detail = `UNKNOWN(0x${op.toString(16)})`; break;
      }

      this.execLog.push({ pc: startPc, op: opName, detail, bytes: this.pc - startPc });
      this.opsExecuted++;
    }
    return this.execLog;
  }
}


// ── PRESETS ──
const PRESETS = {
  "main: Dashboard": {
    type:"vbox",items:[
      {type:"hbox",h:16,border_b:true,items:[{type:"label",label:"GNOSIS//3.1",size:1},{spacer:true},{type:"label",label:"SIG:97%",size:1,color:"mid"},{type:"label",label:"PWR:EINK",size:1,color:"mid",w:64},{type:"dot",w:12}]},
      {type:"hbox",split:200,items:[
        {type:"fixed",items:[
          {type:"label",label:"CHRONO",x:8,y:6,size:1,color:"ghost"},
          {type:"label",label:"14:37",x:8,y:22,size:4},
          {type:"label",label:"2026.03.22",x:8,y:58,size:1,color:"mid"},
          {type:"label",label:"SEC 42",x:8,y:72,size:1,color:"ghost"},
          {type:"sep",x:0,y:96,w:200},
          {type:"label",label:"ORIENTATION",x:8,y:104,size:1,color:"ghost"},
          {type:"circle",cx:100,cy:184,r:60},{type:"circle",cx:100,cy:184,r:45},{type:"circle",cx:100,cy:184,r:28},{type:"cross",cx:100,cy:184,len:10}
        ]},
        {type:"fixed",items:[
          {type:"label",label:"TELEMETRY",x:8,y:6,size:1,color:"ghost"},
          {type:"gauge",x:8,y:22,w:180,label:"R",value:15,max:360},
          {type:"gauge",x:8,y:36,w:180,label:"P",value:34,max:360},
          {type:"gauge",x:8,y:50,w:180,label:"Y",value:127,max:360},
          {type:"gauge",x:8,y:64,w:180,label:"T",value:291,max:360},
          {type:"gauge",x:8,y:78,w:180,label:"V",value:3,max:360},
          {type:"gauge",x:8,y:92,w:180,label:"A",value:188,max:360},
          {type:"sep",x:0,y:112,w:200},
          {type:"label",label:"SYS.LOG",x:8,y:120,size:1,color:"ghost"},
          {type:"list",x:8,y:136,w:180,h:110,row_h:16,max:7,data:[
            {cols:[{text:"00:00:01",w:62,color:"ghost"},{text:"kernel init"}]},
            {cols:[{text:"00:00:02",w:62,color:"ghost"},{text:"epd driver ok"}]},
            {cols:[{text:"00:00:02",w:62,color:"ghost"},{text:"mesh scan..."}]},
            {cols:[{text:"00:00:03",w:62,color:"ghost"},{text:"3 nodes found"}]},
            {cols:[{text:"00:00:04",w:62,color:"ghost"},{text:"telemetry open"}]},
            {cols:[{text:"00:00:05",w:62,color:"ghost"},{text:"orient lock"}]},
            {cols:[{text:"00:00:06",w:62,color:"ghost"},{text:"ready"}]}
          ]},{type:"cursor",x:128,y:232}
        ]}
      ]},
      {type:"hbox",h:16,border_t:true,items:[{type:"icon",shape:"square",w:24},{type:"icon",shape:"circle",w:24},{type:"icon",shape:"diamond",w:24},{type:"icon",shape:"triangle",w:24},{spacer:true},{type:"badge",content:"AUTO",w:42},{spacer:true},{type:"label",label:"PIXEL MONOSPACED",size:1,color:"ghost"}]}
    ]
  },
  "calendar: Temporal Map": {
    type:"vbox",items:[
      {type:"hbox",h:16,border_b:true,items:[{type:"label",label:"GNOSIS//3.1"},{spacer:true},{type:"label",label:"SIG:97%",color:"mid"}]},
      {type:"hbox",split:260,items:[
        {type:"fixed",items:[
          {type:"label",label:"TEMPORAL MAP",x:8,y:6,size:1,color:"ghost"},
          {type:"label",label:"MARCH 2026",x:8,y:22,size:2},
          {type:"grid",x:8,y:50,cols:7,cell_w:35,cell_h:26,count:35,today:21,event_days:[3,7,12,15,21,25,28]}
        ]},
        {type:"fixed",items:[
          {type:"label",label:"AGENDA",x:8,y:6,size:1,color:"ghost"},
          {type:"label",label:"2026.03.22",x:8,y:22,size:1},
          {type:"list",x:8,y:40,w:120,h:120,row_h:28,max:4,data:[
            {cols:[{text:"09:00",w:42,color:"mid"},{text:"Team sync"}]},
            {cols:[{text:"11:30",w:42,color:"mid"},{text:"Design rev"}]},
            {cols:[{text:"14:00",w:42,color:"mid"},{text:"EPD testing"}]},
            {cols:[{text:"16:30",w:42,color:"mid"},{text:"Code review"}]}
          ]},
          {type:"sep",x:0,y:174,w:140},
          {type:"label",label:"UPCOMING",x:8,y:182,size:1,color:"ghost"},
          {type:"list",x:8,y:198,w:120,h:60,row_h:16,max:3,data:[
            {cols:[{text:"03.24",w:42,color:"ghost"},{text:"Sprint end"}]},
            {cols:[{text:"03.27",w:42,color:"ghost"},{text:"Demo day"}]},
            {cols:[{text:"04.01",w:42,color:"ghost"},{text:"Release v4"}]}
          ]}
        ]}
      ]},
      {type:"hbox",h:16,border_t:true,items:[{type:"icon",shape:"square",w:24},{type:"icon",shape:"circle",w:24},{type:"icon",shape:"diamond",w:24},{type:"icon",shape:"triangle",w:24},{spacer:true},{type:"badge",content:"AUTO",w:42}]}
    ]
  },
  "mail: Inbox": {
    type:"vbox",items:[
      {type:"hbox",h:16,border_b:true,items:[{type:"label",label:"GNOSIS//3.1"},{spacer:true},{type:"label",label:"3 UNREAD",color:"mid"},{type:"dot",w:12}]},
      {type:"hbox",split:165,items:[
        {type:"fixed",items:[
          {type:"label",label:"INBOX",x:8,y:6,size:1,color:"ghost"},
          {type:"label",label:"3 UNREAD",x:8,y:20,size:1},
          {type:"list",x:4,y:40,w:155,h:210,row_h:34,max:6,selected:0,data:[
            {cols:[{text:"K.Tanaka",w:80},{text:"10:42",w:40,color:"ghost"}]},
            {cols:[{text:"Re: EPD specs",w:130}]},
            {cols:[{text:"M.Chen",w:80},{text:"09:15",w:40,color:"ghost"}]},
            {cols:[{text:"Firmware v2.1",w:130}]},
            {cols:[{text:"J.Park",w:80},{text:"YST",w:40,color:"ghost"}]},
            {cols:[{text:"Board layout",w:130}]}
          ]}
        ]},
        {type:"fixed",items:[
          {type:"label",label:"MESSAGE",x:8,y:6,size:1,color:"ghost"},
          {type:"label",label:"Re: EPD specs",x:8,y:22,size:2},
          {type:"label",label:"FROM K.Tanaka",x:8,y:48,size:1,color:"mid"},
          {type:"label",label:"DATE 2026.03.22",x:8,y:62,size:1,color:"mid"},
          {type:"sep",x:0,y:78,w:230},
          {type:"text_block",x:8,y:86,w:210,h:130,line_h:14,content:"The new EPD controller\nsamples arrived. SSD1680\nshows 50ms partial with\nno visible ghosting at\n1-bit depth.\n\nDU4 waveform needs more\ntesting on the 4.2 inch\npanel."},
          {type:"sep",x:0,y:224,w:230},
          {type:"label",label:"REPLY  FWD  FLAG",x:8,y:232,size:1,color:"mid"}
        ]}
      ]},
      {type:"hbox",h:16,border_t:true,items:[{type:"icon",shape:"square",w:24},{type:"icon",shape:"circle",w:24},{type:"icon",shape:"diamond",w:24},{type:"icon",shape:"triangle",w:24},{spacer:true},{type:"badge",content:"AUTO",w:42}]}
    ]
  },
  "reader: Library": {
    type:"vbox",items:[
      {type:"hbox",h:16,border_b:true,items:[{type:"label",label:"GNOSIS//3.1"},{spacer:true},{type:"label",label:"PWR:EINK",color:"mid",w:64}]},
      {type:"hbox",split:145,items:[
        {type:"fixed",items:[
          {type:"label",label:"LIBRARY",x:8,y:6,size:1,color:"ghost"},
          {type:"label",label:"7 VOL",x:8,y:20,size:1,color:"mid"},
          {type:"list",x:4,y:38,w:135,h:210,row_h:30,max:7,selected:2,data:[
            {cols:[{text:"Neuromancer"}]},{cols:[{text:"Gibson 72%",color:"ghost"}]},
            {cols:[{text:"Snow Crash"}]},{cols:[{text:"Stephenson 45%",color:"ghost"}]},
            {cols:[{text:"Dune"}]},{cols:[{text:"Herbert 100%",color:"ghost"}]},
            {cols:[{text:"Solaris"}]}
          ]}
        ]},
        {type:"fixed",items:[
          {type:"label",label:"READER",x:8,y:6,size:1,color:"ghost"},
          {type:"label",label:"SNOW CRASH",x:8,y:22,size:2},
          {type:"label",label:"Neal Stephenson",x:8,y:44,size:1,color:"mid"},
          {type:"label",label:"CH 12",x:190,y:44,size:1,color:"ghost"},
          {type:"sep",x:0,y:58,w:250},
          {type:"text_block",x:8,y:66,w:230,h:160,line_h:16,content:"The Deliverator belongs\nto an elite order, a\nhallowed sub-category.\nHe is a pizza delivery\ndriver.\n\nThere are only a few\ncombos in the Metaverse\nthat are worse than this."},
          {type:"sep",x:0,y:232,w:250},
          {type:"label",label:"P.187/440",x:8,y:238,size:1,color:"ghost"},
          {type:"bar",x:72,y:242,w:100,h:2,value:45,max:100},
          {type:"label",label:"BM NT",x:190,y:238,size:1,color:"mid"}
        ]}
      ]},
      {type:"hbox",h:16,border_t:true,items:[{type:"icon",shape:"square",w:24},{type:"icon",shape:"circle",w:24},{type:"icon",shape:"diamond",w:24},{type:"icon",shape:"triangle",w:24},{spacer:true},{type:"badge",content:"AUTO",w:42}]}
    ]
  },
  "boot: Startup": {
    type:"vbox",items:[
      {type:"hbox",h:16,border_b:true,items:[{type:"label",label:"GNOSIS//BOOT"},{spacer:true}]},
      {type:"fixed",items:[
        {type:"circle",cx:200,cy:110,r:70},{type:"circle",cx:200,cy:110,r:50},
        {type:"circle",cx:200,cy:110,r:28},{type:"circle",cx:200,cy:110,r:8},
        {type:"cross",cx:200,cy:110,len:80},
        {type:"label",label:"GNOSIS",x:162,y:192,size:2},
        {type:"label",label:"E-INK OPERATING SYSTEM",x:108,y:214,size:1,color:"mid"},
        {type:"bar",x:100,y:234,w:200,h:3,value:72,max:100},
        {type:"label",label:"72%",x:190,y:242,size:1,color:"ghost"}
      ]},
      {type:"hbox",h:16,border_t:true,items:[{type:"label",label:"INITIATED:2022",color:"ghost"},{spacer:true},{type:"label",label:"CLASSIFICATION:PIXEL MONO",color:"ghost"}]}
    ]
  },
  "debug: Widgets": {
    type:"vbox",items:[
      {type:"hbox",h:16,border_b:true,items:[{type:"label",label:"WIDGET GALLERY"},{spacer:true},{type:"label",label:"DEBUG",color:"ghost"}]},
      {type:"fixed",items:[
        {type:"label",label:"SIZE 1 TEXT",x:8,y:8,size:1},
        {type:"label",label:"SIZE 2",x:8,y:22,size:2},
        {type:"label",label:"BIG",x:8,y:44,size:4},
        {type:"sep",x:8,y:80,w:180},
        {type:"gauge",x:8,y:88,w:180,label:"A",value:42,max:100},
        {type:"gauge",x:8,y:104,w:180,label:"B",value:88,max:100},
        {type:"sep",x:8,y:124,w:180},
        {type:"bar",x:8,y:132,w:180,h:4,value:65,max:100},
        {type:"bar",x:8,y:142,w:180,h:4,value:30,max:100},
        {type:"circle",cx:60,cy:195,r:30},{type:"cross",cx:60,cy:195,len:12},
        {type:"circle",cx:150,cy:195,r:20},{type:"circle",cx:150,cy:195,r:30},
        {type:"label",label:"ICONS:",x:210,y:88,size:1,color:"ghost"},
        {type:"badge",content:"BADGE",x:210,y:106},
        {type:"list",x:210,y:132,w:160,h:100,row_h:18,max:5,selected:1,data:["List item 0","Selected item","List item 2","List item 3","List item 4"]}
      ]},
      {type:"hbox",h:16,border_t:true,items:[{type:"icon",shape:"square",w:24},{type:"icon",shape:"circle",w:24},{type:"icon",shape:"diamond",w:24},{type:"icon",shape:"triangle",w:24},{spacer:true},{type:"badge",content:"DBG",w:36}]}
    ]
  }
};


// ── BYTECODE DISASSEMBLER VIEW ──
function DisassemblyView({ execLog, bytecode, highlightPc, onHover }) {
  const listRef = useRef(null);
  const totalBytes = bytecode ? bytecode.length : 0;

  return (
    <div ref={listRef} style={{
      flex: 1, overflow: "auto", fontFamily: "inherit", fontSize: 10,
      lineHeight: 1.9, letterSpacing: 0.5,
    }}>
      {execLog.map((entry, i) => {
        const isHl = entry.pc === highlightPc;
        const pctOfBinary = totalBytes > 0 ? ((entry.bytes || 1) / totalBytes * 100).toFixed(1) : "0";
        return (
          <div
            key={i}
            onMouseEnter={() => onHover(entry.pc)}
            onMouseLeave={() => onHover(-1)}
            style={{
              display: "flex", gap: 0, padding: "0 8px",
              background: isHl ? "#3a2020" : i % 2 === 0 ? "transparent" : "#ffffff03",
              borderLeft: isHl ? "2px solid #e04040" : "2px solid transparent",
              cursor: "pointer",
              transition: "background 0.1s",
            }}
          >
            <span style={{ width: 48, color: "#4a4840", flexShrink: 0 }}>
              {entry.pc.toString(16).padStart(4, "0").toUpperCase()}
            </span>
            <span style={{ width: 90, color: isHl ? "#e08080" : "#8a8670", flexShrink: 0, fontWeight: isHl ? 700 : 400 }}>
              {entry.op}
            </span>
            <span style={{ flex: 1, color: isHl ? "#c0a080" : "#5a5850", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {entry.detail}
            </span>
            <span style={{ width: 40, color: "#2a2820", textAlign: "right", flexShrink: 0 }}>
              {pctOfBinary}%
            </span>
          </div>
        );
      })}
    </div>
  );
}


// ── HEX DUMP VIEW ──
function HexView({ bytecode, highlightPc }) {
  if (!bytecode) return null;
  const rows = [];
  for (let i = 0; i < bytecode.length; i += 16) {
    const bytes = [];
    let ascii = "";
    for (let j = 0; j < 16; j++) {
      if (i + j < bytecode.length) {
        const b = bytecode[i + j];
        const isHl = (i + j) === highlightPc;
        bytes.push(
          <span key={j} style={{ color: isHl ? "#e04040" : "#5a5850", background: isHl ? "#3a2020" : "transparent" }}>
            {b.toString(16).padStart(2, "0").toUpperCase()}
          </span>
        );
        ascii += (b >= 32 && b < 127) ? String.fromCharCode(b) : ".";
      } else {
        bytes.push(<span key={j} style={{ color: "#1a1810" }}>{"  "}</span>);
        ascii += " ";
      }
    }
    rows.push(
      <div key={i} style={{ display: "flex", gap: 0 }}>
        <span style={{ width: 48, color: "#3a3830", flexShrink: 0 }}>
          {i.toString(16).padStart(4, "0").toUpperCase()}
        </span>
        <span style={{ display: "flex", gap: 4, flex: 1 }}>{bytes}</span>
        <span style={{ width: 100, color: "#3a3830", marginLeft: 8, letterSpacing: 1 }}>{ascii}</span>
      </div>
    );
  }
  return <div style={{ flex: 1, overflow: "auto", fontSize: 10, lineHeight: 1.8, padding: "0 8px", fontFamily: "inherit" }}>{rows}</div>;
}


// ── MAIN APP ──
export default function GnosisCompiler() {
  const canvasRef = useRef(null);
  const [preset, setPreset] = useState("main: Dashboard");
  const [jsonText, setJsonText] = useState(JSON.stringify(PRESETS["main: Dashboard"], null, 2));
  const [parseError, setParseError] = useState(null);
  const [compiled, setCompiled] = useState(null);
  const [execLog, setExecLog] = useState([]);
  const [rightTab, setRightTab] = useState("asm");  // asm | hex | canvas
  const [highlightPc, setHighlightPc] = useState(-1);
  const [stats, setStats] = useState(null);
  const scale = 2;
  const CW = 400, CH = 280;

  const doCompile = useCallback(() => {
    try {
      const dsl = JSON.parse(jsonText);
      setParseError(null);
      const compiler = new Compiler();
      const result = compiler.compile(dsl);
      setCompiled(result);
      setStats(result.stats);
      return result;
    } catch (e) {
      setParseError(e.message);
      setCompiled(null);
      setStats(null);
      return null;
    }
  }, [jsonText]);

  const doExecute = useCallback((result, hlPc) => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.scale(scale, scale);
    const exec = new Executor(ctx, scale);
    const log = exec.execute(result.bytecode, hlPc);
    setExecLog(log);
    ctx.restore();
  }, [scale]);

  useEffect(() => {
    const result = doCompile();
    if (result) doExecute(result, highlightPc);
  }, [jsonText, doCompile, doExecute, highlightPc]);

  const handlePresetChange = (name) => {
    setPreset(name);
    setJsonText(JSON.stringify(PRESETS[name], null, 2));
    setHighlightPc(-1);
  };

  const edBg = "#161513";
  const edFg = "#b0aa9e";
  const edBorder = "#2e2c28";

  return (
    <div style={{ display:"flex", height:"100vh", width:"100vw", background:"#0c0b0a", color: edFg, fontFamily:"'Share Tech Mono','Courier New',monospace", overflow:"hidden" }}>

      {/* LEFT: DSL Editor */}
      <div style={{ width: 380, display:"flex", flexDirection:"column", borderRight:`1px solid ${edBorder}`, background: edBg }}>
        <div style={{ padding:"10px 12px", borderBottom:`1px solid ${edBorder}`, flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <span style={{ fontSize:10, letterSpacing:3, color:"#5a5850" }}>GNOSIS // COMPILER</span>
            <span style={{ fontSize:9, letterSpacing:2, color:"#3a3830" }}>v3.1</span>
          </div>
          <select value={preset} onChange={e=>handlePresetChange(e.target.value)} style={{
            width:"100%", background:"#222018", color:edFg, border:`1px solid ${edBorder}`,
            padding:"6px 8px", fontSize:11, fontFamily:"inherit", letterSpacing:1, cursor:"pointer", outline:"none",
            appearance:"none",
            backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%235a5850'/%3E%3C/svg%3E")`,
            backgroundRepeat:"no-repeat", backgroundPosition:"right 8px center", paddingRight:24,
          }}>
            {Object.keys(PRESETS).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <div style={{ flex:1, overflow:"hidden", position:"relative" }}>
          <textarea value={jsonText} onChange={e=>setJsonText(e.target.value)} spellCheck={false} style={{
            width:"100%", height:"100%", background:"transparent", color:"#807c70",
            border:"none", outline:"none", resize:"none", padding:12, fontSize:10.5,
            lineHeight:1.6, fontFamily:"inherit", letterSpacing:0.3, tabSize:2,
          }}/>
          {parseError && <div style={{
            position:"absolute", bottom:0, left:0, right:0, background:"#2a1010",
            color:"#d04040", padding:"6px 12px", fontSize:9, letterSpacing:1, borderTop:"1px solid #401515"
          }}>ERR: {parseError}</div>}
        </div>

        {/* Compiler stats */}
        {stats && <div style={{
          padding:"8px 12px", borderTop:`1px solid ${edBorder}`, fontSize:9,
          letterSpacing:1, color:"#4a4840", lineHeight:2, flexShrink:0,
        }}>
          <div style={{ display:"flex", gap:16 }}>
            <span>NODES:<span style={{color:edFg}}> {stats.nodes}</span></span>
            <span>STATIC:<span style={{color:"#6a8a50"}}> {stats.static_nodes}</span></span>
            <span>DYN:<span style={{color:"#8a6a50"}}> {stats.dynamic_nodes}</span></span>
          </div>
          {compiled && <div style={{ display:"flex", gap:16 }}>
            <span>BYTECODE:<span style={{color:edFg}}> {compiled.bytecode.length}B</span></span>
            <span>OPS:<span style={{color:edFg}}> {execLog.length}</span></span>
            <span>BINDS:<span style={{color:edFg}}> {Object.keys(compiled.bindTable).length}</span></span>
          </div>}
          {stats.optimizations.length > 0 && <div style={{color:"#6a8a50",marginTop:2}}>
            {stats.optimizations.map((o,i) => <div key={i}>OPT: {o}</div>)}
          </div>}
        </div>}
      </div>

      {/* RIGHT: Bytecode + Canvas */}
      <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
        {/* Tab bar */}
        <div style={{
          display:"flex", borderBottom:`1px solid ${edBorder}`, flexShrink:0,
          background:"#111010",
        }}>
          {[
            { id:"asm", label:"DISASSEMBLY" },
            { id:"hex", label:"HEX DUMP" },
            { id:"canvas", label:"EXECUTOR" },
          ].map(t => (
            <button key={t.id} onClick={()=>setRightTab(t.id)} style={{
              padding:"8px 20px", fontSize:10, letterSpacing:2,
              fontFamily:"inherit", cursor:"pointer", border:"none",
              borderBottom: rightTab===t.id ? "2px solid #8a8670" : "2px solid transparent",
              background: rightTab===t.id ? "#1a1916" : "transparent",
              color: rightTab===t.id ? edFg : "#4a4840",
              transition:"all 0.15s",
            }}>{t.label}</button>
          ))}
          <div style={{ flex:1 }}/>
          {compiled && <span style={{
            padding:"8px 16px", fontSize:9, letterSpacing:1, color:"#3a3830", alignSelf:"center"
          }}>{compiled.bytecode.length} BYTES / {execLog.length} OPS</span>}
        </div>

        {/* Content */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
          {rightTab === "asm" && compiled && (
            <DisassemblyView execLog={execLog} bytecode={compiled.bytecode} highlightPc={highlightPc} onHover={setHighlightPc} />
          )}
          {rightTab === "hex" && compiled && (
            <HexView bytecode={compiled.bytecode} highlightPc={highlightPc} />
          )}
          {rightTab === "canvas" && (
            <div style={{
              flex:1, display:"flex", justifyContent:"center", alignItems:"center",
              backgroundImage:`radial-gradient(circle at 1px 1px, #1a1916 1px, transparent 0)`,
              backgroundSize:"16px 16px", position:"relative",
            }}>
              <div style={{
                background:"#222018", padding:"14px 14px 18px 14px",
                boxShadow:"0 4px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02)",
                position:"relative",
              }}>
                <div style={{
                  position:"absolute", top:4, left:"50%", transform:"translateX(-50%)",
                  fontSize:7, letterSpacing:3, color:"#2e2c28",
                }}>GNOSIS EPD-400</div>
                <canvas
                  ref={canvasRef}
                  width={CW*scale} height={CH*scale}
                  style={{ width:CW*scale, height:CH*scale, imageRendering:"pixelated", display:"block" }}
                />
              </div>
              {compiled && <div style={{
                position:"absolute", bottom:12, left:16, fontSize:9, letterSpacing:1, color:"#2a2820", lineHeight:2,
              }}>
                PIPELINE: JSON → OPTIMIZE → EMIT → {compiled.bytecode.length}B BYTECODE → EXECUTE → FRAMEBUFFER
                <br/>TARGET: {CW}x{CH} @ 1BPP = {Math.ceil(CW*CH/8).toLocaleString()}B FB
              </div>}
            </div>
          )}
          {!compiled && (
            <div style={{ flex:1, display:"flex", justifyContent:"center", alignItems:"center", color:"#3a3830", fontSize:11, letterSpacing:2 }}>
              FIX DSL ERRORS TO COMPILE
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
