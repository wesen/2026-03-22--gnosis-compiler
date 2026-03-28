---
Title: 'Inside the GNOSIS Dynamic VM: A Visual Tour of a Stack Machine for E-Ink Displays'
Ticket: GNOSIS-005
Status: active
Topics:
    - compiler
    - dynamic-vm
    - bytecode
    - debugger
    - interactive-article
DocType: reference
Intent: long-term
Summary: Long-form technical article explaining the GNOSIS Dynamic VM architecture with embedded interactive widget placeholders
LastUpdated: 2026-03-28
---

# Inside the GNOSIS Dynamic VM

## A Visual Tour of a Stack Machine for E-Ink Displays

---

Somewhere between a spreadsheet formula evaluator and a GPU shader, there is a class of programs that are too complex for a lookup table but too simple for a general-purpose language. Layout engines for constrained displays live here. You have a screen — small, monochrome, refreshing every thirty seconds — and you need to turn structured data into pixel-precise rectangles and text. The conventional answer is a retained-mode UI tree with a layout algorithm. The GNOSIS answer is a compiler that turns your layout description into a flat bytecode program, and a stack machine that evaluates it in a single pass.

This article walks through every layer of that system. Each section builds on the last, and along the way you will encounter interactive widgets — small embedded programs that let you poke at the thing being described and watch it respond.

---

## 1. The Machine

The GNOSIS Dynamic VM is a **stack machine**. If you have used a Forth system, an HP calculator, or read about the JVM's operand stack, the model will be familiar. If not, here is the entire idea:

There is a stack. Instructions push values onto it and pop values off it. That is the only way to do arithmetic. There are no registers, no variables in the conventional sense — just the stack for temporary values and a flat array of **slots** for persistent storage.

The instruction set has 17 opcodes. Six of them are arithmetic (`ADD`, `SUB`, `MUL`, `DIV`, `MAX`, `MIN`), two move data between the stack and slots (`PUSH_SLOT`, `STORE_SLOT`), one pushes a constant (`PUSH_CONST`), one measures text (`MEASURE_TEXT_BIND`), six draw things to the screen (`DRAW_TEXT_CONST`, `DRAW_TEXT_BIND`, `DRAW_BAR_CONST`, `DRAW_BAR_BIND`, `DRAW_HLINE`, `DRAW_VLINE`), and one stops the program (`HALT`).

That is the whole computer.

Consider computing the expression `(42 + 10) * 3` and storing the result in slot `n0.x`. In a register machine you would write something like `r0 = 42 + 10; r1 = r0 * 3; store r1`. In our stack machine:

```
PUSH_CONST  42      stack: [42]
PUSH_CONST  10      stack: [42, 10]
ADD                  stack: [52]
PUSH_CONST  3       stack: [52, 3]
MUL                  stack: [156]
STORE_SLOT  n0.x    stack: []   slots: {n0.x = 156}
```

Each `PUSH_CONST` grows the stack by one. `ADD` pops two, pushes one. `STORE_SLOT` pops one and writes it to the named slot. After `STORE_SLOT`, the stack is empty again and the computed value lives in persistent storage.

> **[WIDGET: StackCalculator]**
> An interactive stack machine. Six instructions are listed on the left with editable numeric constants. Press STEP to advance one instruction — the stack column shows values being pushed and popped, and the explanation column narrates what happened. Edit the `42` to `100` and the final result updates instantly. Press RUN ALL to execute the entire program in one shot.

The stack is a **last-in, first-out** structure. The most recently pushed value is always on top. This matters for non-commutative operations: `PUSH 10; PUSH 3; SUB` computes `10 - 3 = 7`, not `3 - 10`. The left operand is always pushed first, the right operand second.

The arithmetic is integer-only. All values are unsigned 16-bit integers (0–65535), clamped after each operation. Division truncates toward zero. Division by zero returns zero. There is no floating-point, no negative numbers, no overflow traps. This matches the target hardware: an e-ink display module with no FPU and 16-bit addressing.

The simplicity is the point. A real layout engine must compute things like "the x-position of the third child is the x-position of the parent plus the sum of the widths of the first two children plus two units of gap." That computation is expressible as a sequence of push, add, and store operations. The compiler does the thinking; the VM does the arithmetic.

---

## 2. Slots: The Layout Memory

Every node in the layout tree has six slots:

| Slot | Name | Meaning |
|------|------|---------|
| 0 | `mw` | **Measured width** — intrinsic content width |
| 1 | `mh` | **Measured height** — intrinsic content height |
| 2 | `x` | **X position** — left edge, in pixels |
| 3 | `y` | **Y position** — top edge, in pixels |
| 4 | `w` | **Width** — final rendered width |
| 5 | `h` | **Height** — final rendered height |

The addressing is flat: slot index = `node_index × 6 + field_offset`. Node 0's measured width is slot 0. Node 0's height is slot 5. Node 1's measured width is slot 6. Node 7's y-position is slot 45. The entire layout state of a 16-node screen fits in 96 16-bit integers — 192 bytes.

The distinction between **measured** and **final** dimensions is important. `mw` and `mh` are computed from content — the pixel width of a text string, the intrinsic height of a font. `w` and `h` are the dimensions used for rendering, which may differ after the layout algorithm runs. A label that says "OK" has `mw = 16` (2 characters × 8px), but the layout might assign `w = 100` because the label is inside an hbox with `grow` enabled and there is leftover space to distribute.

The `x` and `y` slots are set by the compiler during the compute phase. For a `fixed` layout, these come directly from the YAML source. For `hbox` and `vbox` containers, the compiler emits stack arithmetic to accumulate offsets: "child 2's x = child 1's x + child 1's w + gap."

> **[WIDGET: SlotGrid]**
> A single node's slot grid, showing all six fields. The runtime data panel lets you edit the title text and font size. Press STEP to watch MEASURE_TEXT_BIND write to `mw` and `mh`, then PUSH_SLOT and STORE_SLOT copy the measured width to the final `w` slot. The formula bar at the bottom shows the calculation: `mw = len("LAB-01") × 8 × 2 = 96`. Change the title to "HELLO" and the measured width drops to 80.

The slot array is initialized to zero before execution begins (with optional non-zero init values baked into the binary). The compiler knows at compile time which slots need non-zero initial values — typically `x`, `y`, `w`, `h` for nodes with explicit coordinates in the YAML.

One consequence of flat addressing is that the VM has no concept of a "tree." It does not know that node 4 is a child of node 3, or that node 7 is inside an hbox. The tree structure was used by the compiler to generate the instruction sequence, but by the time the bytecode runs, it is just a flat program operating on a flat array. This is a deliberate design choice: it makes the VM trivially portable to microcontrollers and FPGAs where tree traversal is expensive.

---

## 3. From Slots to Pixels

The render phase reads slot values and emits **draw operations**. A draw operation is a structured command: "draw text 'TEMP:' at (8, 33) with width 40 and height 8, using color 1." The VM does not render directly to a framebuffer — it produces a list of draw ops, and a separate renderer turns them into pixels.

This indirection exists because the same draw ops can be rendered to different targets: a `<canvas>` element in the browser, a framebuffer on the e-ink module, a PNG file for testing, or a terminal for debugging. The VM's job ends when the draw op list is complete.

There are six draw instructions:

**DRAW_TEXT_CONST** and **DRAW_TEXT_BIND** render text. The "const" variant reads from the string pool (strings baked into the bytecode), while the "bind" variant reads from the runtime data (values resolved at execution time). Both read the node's `x`, `y`, `w`, `h` slots for positioning.

**DRAW_BAR_CONST** and **DRAW_BAR_BIND** render progress bars. The bar's fill width is computed as `trunc(w × value / max)` — a linear interpolation clamped to the bar's width. The "track" and "fill" color indices are baked into the instruction.

**DRAW_HLINE** and **DRAW_VLINE** render separator lines. They read position and size from slots like the other draw instructions.

The color palette has five entries, indexed 0–4:

| Index | Name | Hex | Use |
|-------|------|-----|-----|
| 0 | background | `#d8d4cc` | Screen background (warm paper) |
| 1 | foreground | `#2a2826` | Text, borders (near-black) |
| 2 | mid | `#7a7668` | Bar fills, secondary text |
| 3 | light | `#b0aa9e` | Bar tracks, disabled state |
| 4 | ghost | `#e0dcd4` | Faint guides, placeholders |

This five-level palette maps well to 4-bit grayscale e-ink displays. The color index is stored as a single byte in the instruction — no RGB values, no alpha, no gradients.

> **[WIDGET: CanvasPreview]**
> A live 280×120 canvas with draggable sliders for x, y, w, and h. The text "LAB-01" renders at the slider positions with a dashed bounding box showing the slot-derived rectangle. Change the text or font size and the bounding box resizes. Pick a different color from the palette swatches. The formula bar shows the glyph calculation: each character is 8px wide at size 1, 16px at size 2.

The text rendering uses a **bitmap font**. Each glyph is a hardcoded pixel pattern — there is no font file, no TrueType rasterizer, no anti-aliasing. The base glyph size is 8×8 pixels. The `size` parameter is an integer multiplier: size 2 means each glyph is 16×16, size 3 means 24×24. This keeps the rendering deterministic and identical across all targets.

The measured width of a text string is `len(text) × GLYPH_W × size`. The measured height is `GLYPH_H × size`. These formulas are evaluated by `MEASURE_TEXT_BIND` during the measure phase and stored in the `mw` and `mh` slots. The draw instructions then read `x`, `y`, `w`, `h` to position the text within its assigned rectangle.

---

## 4. The Full Pipeline

Execution has three phases. They are not enforced by the VM — it just runs instructions sequentially — but the compiler always emits them in this order:

### Phase 1: MEASURE

`MEASURE_TEXT_BIND` instructions read runtime data (text strings, sensor values) and compute intrinsic content dimensions. Only `mw` and `mh` slots change during this phase.

For example, measuring the title "LAB-01" at size 2:
- Read `props.title` from the runtime data → "LAB-01"
- Compute `mw = 6 × 8 × 2 = 96` (6 characters, 8px each, doubled)
- Compute `mh = 8 × 2 = 16`
- Store into `n4.mw = 96`, `n4.mh = 16`

### Phase 2: COMPUTE

Stack arithmetic instructions (`PUSH_CONST`, `PUSH_SLOT`, `ADD`, `SUB`, `STORE_SLOT`, etc.) calculate final positions and sizes. This is where the layout algorithm's output lives — the compiler has already solved the constraint system and emitted the arithmetic as a flat instruction sequence.

A simple copy: `PUSH_SLOT n4.mw; STORE_SLOT n4.w` — the final width equals the measured width. A more complex computation: `PUSH_SLOT n3.x; PUSH_SLOT n3.w; ADD; PUSH_CONST 4; ADD; STORE_SLOT n4.x` — child 4's x = parent 3's x + parent 3's width + 4px gap.

### Phase 3: RENDER

`DRAW_*` instructions read the now-computed slots and emit draw operations. No slot values change during this phase (the slots are read-only inputs to the draw commands).

The program ends with `HALT`.

> **[WIDGET: Pipeline]**
> A phase timeline with four clickable buttons: MEASURE, COMPUTE, RENDER, DONE. Click each phase to see its instructions (left column), slot changes (middle column), and canvas state (right column). The canvas is blank during MEASURE and COMPUTE, then populates during RENDER. An editable temperature slider shows how changing runtime data affects only the RENDER output — the bar fill changes but the slot layout doesn't.

This three-phase structure has practical consequences. If the runtime data changes but the layout doesn't (e.g., a sensor reading updates but the dashboard structure is the same), only the MEASURE and RENDER phases produce different results. The COMPUTE phase is deterministic given the same measured values. A hypothetical optimization could cache the computed slots and skip phase 2 when only bound values change, but the current VM runs all three phases every time — at 14–100 instructions per evaluation, the cost is negligible.

---

## 5. The Binary Format

The compiled program is serialized as a **GNDY binary blob**. The format is designed for compactness and zero-allocation decoding on microcontrollers.

### Header

```
Offset  Size  Field
──────  ────  ─────
0x00    4     Magic: "GNDY" (0x47 0x4e 0x44 0x59)
0x04    1     Version: 1
0x05    2     node_count (U16 big-endian)
0x07    2     slot_count (U16 big-endian)
0x09    2     bind_count (U16 big-endian)
0x0b    2     string_count (U16 big-endian)
0x0d    4     code_length (U32 big-endian)
```

The header is 17 bytes. Everything after it is variable-length.

### Bind Table

For each bind (0..bind_count):
```
2 bytes: string length (U16)
N bytes: UTF-8 string
```

Binds are dot-notation paths into the runtime data object: `"sensor.temp"`, `"props.title"`, `"data.stats.health"`. The instruction `DRAW_TEXT_BIND` references binds by index, not by string — the string is only needed for runtime resolution.

### String Pool

Same encoding as the bind table. Strings are constant text baked into the bytecode: `"TEMP:"`, `"HUM:"`, `"%"`. Referenced by index in `DRAW_TEXT_CONST`.

### Slot Initializers

```
slot_count × 2 bytes: initial U16 values
```

Most slots initialize to zero. Non-zero init values come from explicit coordinates in the YAML source (e.g., `x: 8, y: 8`).

### Code Section

A flat byte sequence of opcodes and their operands. Each opcode has a fixed size:

| Opcode | Hex | Size | Operands |
|--------|-----|------|----------|
| MEASURE_TEXT_BIND | 0x01 | 6 | node(2), bind(2), fontSize(1) |
| PUSH_CONST | 0x02 | 3 | value(2) |
| PUSH_SLOT | 0x03 | 3 | slot(2) |
| ADD | 0x04 | 1 | — |
| SUB | 0x05 | 1 | — |
| MUL | 0x06 | 1 | — |
| DIV | 0x07 | 1 | — |
| MAX | 0x08 | 1 | — |
| MIN | 0x09 | 1 | — |
| STORE_SLOT | 0x0a | 3 | slot(2) |
| DRAW_TEXT_CONST | 0x0b | 7 | node(2), stringId(2), fontSize(1), color(1) |
| DRAW_TEXT_BIND | 0x0c | 7 | node(2), bind(2), fontSize(1), color(1) |
| DRAW_BAR_BIND | 0x0d | 9 | node(2), bind(2), maxValue(2), track(1), fill(1) |
| DRAW_BAR_CONST | 0x0e | 9 | node(2), value(2), maxValue(2), track(1), fill(1) |
| DRAW_HLINE | 0x0f | 4 | node(2), color(1) |
| DRAW_VLINE | 0x10 | 4 | node(2), color(1) |
| HALT | 0xff | 1 | — |

All multi-byte values are big-endian. The decoder can step through without ambiguity because each opcode implies its operand count and sizes.

> **[WIDGET: HexViewer]**
> A hex dump of a sample GNDY program. Hover over any byte to see a tooltip explaining what it represents — "Magic byte 2: 'D' (0x44)", "node_count high byte: 0x00", "PUSH_SLOT opcode (0x03)". Click a byte to pin the annotation. The legend at the bottom lists all regions (MAGIC, VERSION, HEADER, BIND TABLE, STRING POOL, SLOT INIT, CODE) with colored highlights. Click a legend entry to highlight that region in the hex dump.

A typical sensor dashboard compiles to about 84 bytes of code, plus ~50 bytes of header, bind table, and string pool, plus ~192 bytes of slot initializers — around **326 bytes total**. This fits in a single 512-byte flash sector on a microcontroller, with room for runtime data.

The binary format makes no alignment guarantees. Fields are packed tightly. This saves space but means the decoder must read byte-by-byte on architectures without unaligned access support. In practice, the decoder runs once per program load, so the performance impact is negligible.

---

## 6. Runtime Binding

The same compiled program produces different output when evaluated with different runtime data. This is the "dynamic" in GNOSIS Dynamic VM.

The runtime data is a nested key-value object:

```json
{
  "props": { "title": "LAB-01" },
  "sensor": { "temp": 22, "humidity": 45 }
}
```

Bind paths use dot notation to navigate the tree: `"sensor.temp"` resolves to `22`, `"props.title"` resolves to `"LAB-01"`. If a path doesn't resolve (missing key, null intermediate), the bind returns `null`, which coerces to `0` for numeric operations and `""` for text.

The `MEASURE_TEXT_BIND` instruction reads a text value through a bind and computes its pixel dimensions. The `DRAW_TEXT_BIND` instruction reads the same bind at render time to get the actual text to display. The `DRAW_BAR_BIND` instruction reads a numeric bind and computes the fill ratio.

This design means the bytecode is a **template**. It encodes the structure of the layout — where nodes go, how they relate, what gets drawn — but the actual data is injected at evaluation time. Compile once, evaluate thousands of times with different sensor readings.

> **[WIDGET: DualRuntime]**
> Two runtime panels side by side, both running the same bytecode. The left panel has title "LAB-01", temp 22, humidity 45 ("Normal readings"). The right panel has title "REACTOR-7", temp 95, humidity 88 ("Emergency readings"). Each has its own canvas. Drag the temperature slider on one side and watch only that canvas update. Click "show diff" to see which slots differ between the two evaluations — the title node's `mw` and `w` differ because the strings have different lengths. Click SWAP to exchange the two datasets.

The implications for embedded systems are significant. The microcontroller stores the compiled bytecode in flash (read-only, stable) and the runtime data in RAM (updated from sensors, BLE, MQTT). On each display refresh cycle:

1. Read sensor data into the runtime object
2. Evaluate the bytecode (50–200 microseconds)
3. Convert draw ops to framebuffer commands
4. Push to the e-ink controller

No parsing, no tree traversal, no garbage collection. The VM's memory footprint is the slot array (192 bytes for 16 nodes), the stack (rarely exceeds 4 entries = 8 bytes), and the draw op list (bounded by instruction count).

---

## 7. The Compiler

The compiler transforms a YAML layout description into GNDY bytecode. It runs on the host machine (Python), not on the target device. The compilation is a one-time cost paid during development or OTA update.

### Input: YAML Layout

```yaml
type: screen
width: 280
height: 120
body:
  type: fixed
  children:
    - type: vbox
      x: 8
      y: 8
      gap: 4
      children:
        - type: hbox
          gap: 2
          children:
            - type: label
              bind: props.title
              size: 2
        - type: sep
          w: 260
        - type: hbox
          gap: 2
          children:
            - type: label
              text: "TEMP:"
            - type: label
              bind: sensor.temp
              field_w: 5
            - type: label
              text: "C"
        - type: bar
          bind: sensor.temp
          w: 260
          h: 6
          max: 100
          track: light
          fill: fg
```

### Compilation Phases

**Phase 1: Parse.** The YAML is parsed into a tree of `Node` objects. Each node gets an integer ID based on tree traversal order (DFS). The screen node is always node 0.

**Phase 2: Measure expressions.** The compiler walks the tree bottom-up and generates **expressions** for each node's `mw` and `mh`. A label's `mw` is a `MEASURE_TEXT_BIND` pseudo-expression. A vbox's `mh` is the sum of its children's `mh` values plus gaps. An hbox's `mw` is the sum of its children's `mw` values plus gaps. These expressions reference each other, forming a dependency graph.

**Phase 3: Layout expressions.** The compiler walks the tree top-down and generates expressions for `x`, `y`, `w`, `h`. A fixed layout sets children's `x` and `y` from their YAML coordinates. An hbox accumulates children's `x` positions: `child[i].x = child[i-1].x + child[i-1].w + gap`. A vbox accumulates `y`. The `grow` property distributes leftover space among children.

**Phase 4: Topological sort.** The expressions form a DAG. The compiler performs a topological sort to determine evaluation order: a slot that depends on another slot must be computed after its dependency. This sort produces the instruction sequence for the COMPUTE phase.

**Phase 5: Code generation.** The compiler emits bytecode using a `CodeBuilder`:
1. `MEASURE_TEXT_BIND` instructions for all text nodes (MEASURE phase)
2. `PUSH_CONST`, `PUSH_SLOT`, arithmetic, `STORE_SLOT` for computed slots (COMPUTE phase)
3. `DRAW_*` instructions for all visible nodes (RENDER phase)
4. `HALT`

**Phase 6: Serialization.** The instruction stream, bind table, string pool, and slot initializers are packed into the GNDY binary format.

### Expression Optimization

The compiler performs constant folding: `Const(8) + Const(4)` becomes `Const(12)`. Expressions that reduce to a single constant are stored as slot initializers rather than emitting computation instructions. A label with `x: 8` doesn't generate `PUSH_CONST 8; STORE_SLOT n4.x` — instead, slot `n4.x` is initialized to 8 in the binary header.

Expressions that reference only one slot are also simplified: `SlotRef(n3.mw)` doesn't generate `PUSH_SLOT n3.mw; STORE_SLOT n3.w` if there is no arithmetic — the copy is folded into the initialization.

The typical sensor dashboard (16 nodes, 3 binds, 4 strings) compiles to 14 instructions and 84 bytes of code. Larger dashboards with 40+ nodes might reach 60–80 instructions and 300–400 bytes.

---

## 8. The Debugger

The debugger wraps the interpreter with single-step execution, snapshot capture, undo history, and breakpoints. It exists to make the opaque bytecode **visible**.

### Architecture

The `GNDYDebugger` class maintains the full VM state:

- **pc**: program counter (byte offset into the code section)
- **instrIndex**: logical instruction index (0-based)
- **stack**: array of U16 values
- **slots**: flat array of U16 values (6 per node)
- **drawOps**: accumulated draw operations
- **halted**: boolean flag
- **history**: bounded array of pre-step snapshots (max 1000)
- **breakpoints**: set of PC offsets

### Snapshots

A **snapshot** captures the complete VM state at one point in time:

```typescript
interface DebugSnapshot {
  pc: number;
  instrIndex: number;
  phase: 'init' | 'measure' | 'compute' | 'render' | 'halted';
  halted: boolean;
  stack: number[];
  slots: number[];
  drawOps: DrawOp[];
  changedSlots: SlotChange[];
}
```

The `changedSlots` array records which slots were modified by the most recent instruction: `{ slot: 14, name: "n2.w", before: 0, after: 96 }`. This is computed by diffing the slot array before and after each step — cheap because most instructions touch at most two slots.

The `phase` field is inferred from the instruction type. `MEASURE_TEXT_BIND` instructions are in the `measure` phase. Stack and store instructions are in the `compute` phase. `DRAW_*` instructions are in the `render` phase. This is a heuristic — the VM doesn't enforce phases — but it matches the compiler's output and is useful for the UI.

### Stepping

`step()` saves the current state to history, executes one instruction, and returns a new snapshot. `stepBack()` pops the most recent history entry and restores it. `run()` calls `step()` in a loop until `HALT` or a breakpoint is hit.

The history is bounded to prevent memory exhaustion. At 1000 entries with ~200 bytes per snapshot (for a 16-node layout), the history consumes about 200KB — acceptable for a browser debugger.

### Breakpoints

Breakpoints are stored as a `Set<number>` of PC offsets. When the VM reaches a PC that is in the breakpoint set, `run()` and `runToBreakpoint()` stop execution and return the current snapshot. The UI renders breakpoints as red dots in the disassembly listing; clicking a line toggles its breakpoint.

### Oracle Validation

The browser interpreter must produce **identical results** to the Python backend. To verify this, the debugger includes an oracle validation mode:

1. Run a fresh debugger instance to completion
2. Compare the final slot values against the backend's `evaluation.slots`
3. Compare the draw op count against the backend's `evaluation.draw_ops`
4. Report the number of mismatches

A mismatch count of zero means the browser interpreter perfectly mirrors the Python VM. This is tested on every preset load.

---

## 9. The Multi-Pane Debugger

The original debugger used a tabbed interface: click the DEBUGGER tab to see controls, click SLOTS to see the slot grid, click STACK to see the stack, switch back to DEBUGGER to step. This forced constant context-switching.

The multi-pane debugger shows **everything simultaneously**:

```
+========================+==================================================+
| Header: STEP  BACK  RUN  RUN>BP  RESET  VALIDATE  CLOSE                 |
+========================+==================================================+
|                        | CANVAS (live, compact, ~40% height)              |
|                        |   draw_ops: 4/10 | STORE_SLOT | step 5/14       |
|  SOURCE                +----+----------------------------+----------------+
|  (YAML editor)         |    | DISASSEMBLY                | SLOTS          |
|                        |    |  ● 0000 MEASURE_TEXT_BIND  |  n0 [mw mh ..] |
|                        |    |    0006 PUSH_SLOT          |  n1 [.. .. ..] |
|                        |    | ▶  0009 STORE_SLOT   ← PC |  n2 [96 16 ..] |
|                        |    |    000c DRAW_TEXT_BIND      +----------------+
|                        |    |    ...                      | STACK          |
|                        |    |  Phase: COMPUTE  PC: 0x0009|  ▶ [0] 96     |
+========================+====+============================+================+
```

The layout is a CSS grid with three resizable splitters:
- **Horizontal**: between the canvas and the lower panes (drag to allocate more space to code vs. output)
- **Vertical**: between the disassembly and the slots/stack column
- **Horizontal**: between the slots and stack panes within the right column

The step controls live in the header bar, always visible. When the debugger is closed, the layout reverts to the normal tabbed inspector.

### Connected Highlighting

When you step to a `STORE_SLOT n2.w` instruction:
- The **disassembly pane** highlights the current instruction row in yellow
- The **slots pane** highlights `n2.w` and shows the change banner: `n2.w: 0 → 96`
- The **stack pane** shows the value that was popped and notes "after STORE_SLOT"
- The **canvas pane** shows the draw ops accumulated so far (none yet, since we are still in COMPUTE phase)

This cross-pane highlighting makes causality visible. You see the instruction, the data it changed, the stack effect, and the visual result — all at once, no tab switching.

---

## 10. Building a Layout

Let's trace the full journey from a visual goal to running bytecode.

You want to build a sensor dashboard that shows a title, a temperature reading with a bar, and a humidity reading with a bar. The screen is 280×120 pixels. You write:

```yaml
type: screen
width: 280
height: 120
body:
  type: fixed
  children:
    - type: vbox
      x: 8
      y: 8
      gap: 4
      children:
        - type: label
          bind: props.title
          size: 2
        - type: sep
          w: 260
        - type: label
          text: "TEMP:"
        - type: label
          bind: sensor.temp
          field_w: 5
        - type: bar
          bind: sensor.temp
          w: 260
          h: 6
          max: 100
```

The compiler:

1. **Parses** this into 10 nodes (screen, fixed, vbox, label, sep, label, label, bar, ...)
2. **Measures** text nodes: title label's `mw` depends on the bind value at runtime, so it emits `MEASURE_TEXT_BIND`. The "TEMP:" label has a known width: 5 chars × 8px × 1 = 40px, stored as a slot initializer.
3. **Computes** layout: the vbox accumulates y-positions for its children, adding gaps. The sep gets x and w from the YAML. Each child's y = previous child's y + previous child's h + gap.
4. **Generates** draw instructions: `DRAW_TEXT_BIND` for the title, `DRAW_HLINE` for the separator, `DRAW_TEXT_CONST` for "TEMP:", `DRAW_TEXT_BIND` for the temperature value, `DRAW_BAR_BIND` for the bar.
5. **Serializes** to 84 bytes of code, 3 binds, 4 strings, 96 slot initializers.

The resulting bytecode is then evaluated twice — once with `{ sensor: { temp: 22 }, props: { title: "LAB-01" } }` and once with `{ sensor: { temp: 95 }, props: { title: "LAB-01" } }` — producing two different canvases from the same program.

> **[WIDGET: LayoutBuilder]**
> A visual layout builder. Click [Label], [Bar], or [HLine] in the palette to add elements to the canvas. Select an element to edit its properties (x, y, text, font size, bar value/max). The bottom half shows the generated YAML on the left and the compiled instruction listing on the right, both updating live. Add three labels and a bar, then read the bytecode — each element corresponds to exactly one DRAW instruction.

---

## 11. The Hardware Target

This system was designed for a specific class of hardware: e-ink display modules with limited compute, no operating system, and infrequent refresh cycles. The constraints shaped every decision.

**No floating-point.** E-ink controllers and low-end MCUs often lack an FPU. All VM arithmetic is 16-bit integer.

**No dynamic memory.** The slot array is fixed-size, allocated at program load. The stack is bounded (typically 4–8 entries for layout computation). The draw op list is bounded by instruction count. There are no allocations during execution.

**No tree traversal.** The compiled bytecode is a flat instruction sequence. The VM's inner loop is a switch statement over 17 opcodes. No recursion, no virtual dispatch, no pointer chasing.

**Deterministic execution.** The same bytecode with the same runtime data always produces the same draw ops. There is no randomness, no timing dependency, no undefined behavior. This makes testing trivial: compare the output of the browser interpreter against the Python oracle byte-by-byte.

**Compact encoding.** A complete dashboard fits in 300–500 bytes. The binary can be transmitted over BLE in a single MTU packet or stored in a 512-byte flash sector.

The tradeoff is expressiveness. You cannot write arbitrary programs in this bytecode. There are no conditionals, no loops, no function calls, no user-defined types. The instruction set covers exactly the operations needed for layout computation and rendering — nothing more. If you need a conditional layout (show widget A if temp > 90, else show widget B), you compile two programs and select between them on the host.

This is a feature. The VM's simplicity means it can be formally verified, its worst-case execution time is bounded, and it cannot hang or crash. For a display module that runs unattended in an industrial environment, these properties matter more than expressiveness.

---

## 12. What Comes Next

The system as described is complete for static layouts with dynamic data. Three directions are being explored:

**Connected highlighting in the multi-pane debugger.** When you click a drawn element on the canvas, the debugger should highlight the instruction that drew it and the slots it read from. This requires maintaining a mapping from draw ops back to instructions, which the VM currently discards.

**Conditional compilation.** Emitting multiple bytecode variants for different screen states (e.g., alert mode vs. normal mode) and selecting between them based on runtime predicates. This keeps the VM simple while adding layout-level branching.

**Direct hardware execution.** Translating the bytecode into FPGA microcode or ARM Thumb instructions for cycle-deterministic execution on bare-metal targets. The flat instruction format and bounded execution make this feasible — each opcode maps to 2–5 machine instructions.

The interactive widgets in this article are built as self-contained React components with no backend dependency. They run their own mini-interpreters that mirror the real VM's semantics. If you found them useful for understanding the system, that is the Bret Victor thesis in action: **people understand what they can see and manipulate**. A bytecode VM is an opaque box until you can step through it, poke the inputs, and watch the outputs change.

---

*The GNOSIS Dynamic VM is part of the GNOSIS compiler project. The source code, including the Python compiler, TypeScript browser interpreter, step debugger, and all interactive widgets shown in this article, is available in the project repository.*
