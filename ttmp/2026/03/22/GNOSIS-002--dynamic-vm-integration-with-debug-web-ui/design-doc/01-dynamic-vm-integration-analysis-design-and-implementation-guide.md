---
Title: Dynamic VM Integration — Analysis, Design and Implementation Guide
Ticket: GNOSIS-002
Status: active
Topics:
    - compiler
    - dynamic-vm
    - webui
    - step-debugging
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/bytecode.py
    - /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/compiler.py
    - /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/expr.py
    - /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/vm.py
    - /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/c_runtime/gnosis_vm.h
    - /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/c_runtime/gnosis_vm.c
    - /home/manuel/code/wesen/2026-03-22--gnosis-compiler/web_server.py
    - /home/manuel/code/wesen/2026-03-22--gnosis-compiler/web/index.html
ExternalSources: []
Summary: Comprehensive guide for integrating the dynamic VM with the debug web UI, including step debugging
LastUpdated: 2026-03-22T16:19:55.942237395-04:00
WhatFor: ""
WhenToUse: ""
---

# Dynamic VM Integration: Analysis, Design and Implementation Guide

*A textbook-style guide for new engineers. Covers the dynamic VM architecture, how it differs from the static compiler, and a concrete plan for integrating it with the existing debug web UI — including step-through debugging of the stack machine.*

---

## Table of Contents

1. Executive Summary
2. Problem Statement: Why Static Isn't Enough
3. The Dynamic VM — What It Is
4. Architecture Comparison: Static vs Dynamic
5. The Slot System — The Key Abstraction
6. The Expression System and Constant Folding
7. The Compilation Pipeline (9 Stages)
8. The Bytecode Instruction Set (17 Opcodes)
9. The Three Execution Phases
10. The Python Reference VM
11. The C Runtime for MCU
12. The Binary Format (GNDY)
13. Worked Example: dynamic_hbox
14. Integration Plan: Adding Dynamic VM to the Web UI
15. Step Debugger Design
16. API Extensions
17. Frontend Changes
18. Implementation Roadmap
19. File Reference

---

## 1. Executive Summary

The GNOSIS project has two compilers. The **static compiler** (GNOSIS-001, `gnosis_compiler/`) produces a flat draw list — bytecode that draws widgets at fixed pixel positions baked in at compile time. If a runtime string changes length, the layout does not reflow. The **dynamic compiler** (`gnosis_dynamic_vm/`) solves this by compiling a YAML layout into a **residual program** — bytecode that measures runtime text, evaluates symbolic layout expressions on a stack machine, and then draws. One compiled program handles any runtime data; the layout reflows automatically.

This document analyzes the dynamic VM in detail and designs the integration with the existing debug web UI (GNOSIS-001). The integration adds:

- A `/api/compile-dynamic` endpoint that calls the dynamic compiler
- A JavaScript stack machine interpreter that executes GNDY bytecode in the browser
- A **step debugger** that lets you pause at any instruction, inspect the slot buffer and stack, and step forward one instruction at a time
- Visualization of the symbolic IR (slot expressions), slot initialization, and the three execution phases (measure, compute, render)
- Side-by-side comparison of the same program evaluated with different runtime data

---

## 2. Problem Statement: Why Static Isn't Enough

Consider this layout: a title label followed by a colon and a sensor value, all in an hbox:

```yaml
type: hbox
gap: 2
children:
  - type: label
    bind: props.title      # runtime text, variable length
  - type: label
    text: ": "              # static text, fixed width
  - type: label
    bind: sensor.temp
    field_w: 4              # fixed display width
```

In the **static compiler**, the title label's width is determined at compile time by `field_w` or `len(text)`. If the runtime title is "T" (8 pixels) or "Temperature" (88 pixels), the static compiler doesn't know — it bakes in one fixed width. The colon and sensor labels are at fixed x positions.

In the **dynamic compiler**, the title label's width is **measured at runtime**. The colon's x position becomes a symbolic expression: `title.mw + 10` (title measured width + title.x + gap). The sensor's x position is `title.mw + 28`. These expressions are compiled into stack machine bytecode. When the program runs with title="T", the colon is at x=18; with title="Temperature", it's at x=98. **Same bytecode, different layout.**

This is the fundamental capability the web UI needs to visualize: one compiled program, multiple evaluations, automatic reflow.

---

## 3. The Dynamic VM — What It Is

The dynamic VM is a **partially-evaluated layout compiler**. It takes the same YAML DSL as the static compiler but produces a different kind of output:

| | Static Compiler (GNBC) | Dynamic Compiler (GNDY) |
|---|---|---|
| **Output** | Fixed draw list | Residual layout program |
| **Runtime data** | Patches bind values in fixed positions | Measures text, recomputes layout, then draws |
| **Layout reflow** | None — positions baked at compile time | Full — expressions recompute on every evaluation |
| **MCU interpreter** | Walk instructions, draw | Initialize slots, run stack machine, draw |
| **Binary format** | GNBC (header + strings + binds + regions + code) | GNDY (header + binds + strings + slot_init + code) |
| **Opcode count** | 12 (draw-only) | 17 (measure + stack math + store + draw) |

The key architectural difference is the **slot system**: every node has 6 numeric slots (mw, mh, x, y, w, h) that are either initialized with compile-time constants or computed at runtime by stack machine expressions. The compiler performs binding-time analysis to determine which slots are static (constant-folded into the slot_init table) and which are dynamic (compiled into bytecode expressions).

---

## 4. Architecture Comparison: Static vs Dynamic

### Static Pipeline (GNOSIS-001)

```
YAML + Props
    |
    v
[parse, normalize, optimize]  -->  Canonical AST
    |
    v
[layout_screen()]             -->  Laid-out AST (concrete pixel Rects)
    |
    v
[lower_screen()]              -->  HLINE, TEXT, BIND_TEXT, BAR, ... (draw list)
    |
    v
[serialize()]                 -->  GNBC binary
```

Every node gets a concrete `Rect(x, y, w, h)` at compile time. The bytecode is a flat sequence of draw instructions. The MCU walks it linearly and draws.

### Dynamic Pipeline (GNOSIS-002)

```
YAML
    |
    v
[parse, normalize, assign IDs]
    |
    v
[compute_measures() — bottom-up]     Symbolic mw/mh expressions per node
    |                                  (e.g., mw = len(title) * 8)
    v
[compile_layout() — top-down]        Symbolic x/y/w/h expressions per node
    |                                  (e.g., x = sibling.mw + 10)
    v
[constant fold + dead slot elim]      Simplify expressions, remove unused slots
    |
    v
[topological sort + emit bytecode]    Stack machine code + slot_init table
    |
    v
[compile_render()]                    DRAW_TEXT_BIND, DRAW_BAR_BIND, ...
    |
    v
[serialize()]                         GNDY binary
```

Nodes get **symbolic expressions** instead of concrete numbers. The compiler folds constants aggressively — `(0 + 0 + 8 + 2)` collapses to `10` — and eliminates slots that are not referenced by any render operation. What remains is a minimal bytecode program that computes only the truly dynamic layout values.

---

## 5. The Slot System — The Key Abstraction

Every node in the tree has **6 slots**, addressed by a global slot ID:

```
Slot index within node:
  0 = mw   (measured width — intrinsic content width)
  1 = mh   (measured height — intrinsic content height)
  2 = x    (final x coordinate)
  3 = y    (final y coordinate)
  4 = w    (final allocated width)
  5 = h    (final allocated height)

Global slot ID = node_id * 6 + field_index
```

For a 9-node program, there are 54 slots (9 * 6). The slot buffer is a flat `uint16_t[]` array.

**Slot initialization:** At the start of evaluation, slots are loaded from the `slot_init` table in the binary. This table contains the compile-time constant values. For example, a label at fixed position `(8, 28)` with constant width 24 and height 8 will have:

```
n7.x = 8, n7.y = 28, n7.w = 24, n7.h = 8   (from slot_init)
n7.mw = 0, n7.mh = 0                         (unused, default 0)
```

**Dynamic slots** are overwritten during execution by MEASURE_TEXT_BIND (for mw/mh) and STORE_SLOT (for x/y/w/h computed by stack expressions).

### Why slots instead of a tree walk?

The slot system flattens the tree into a linear array. This means:
- No pointer chasing on the MCU (cache-friendly)
- No tree traversal at runtime (O(1) slot access)
- No heap allocation (fixed-size buffer)
- Dead slot elimination removes unused parent nodes entirely

---

## 6. The Expression System and Constant Folding

**File:** `gnosis_dynamic_vm/gnosis_dynamic/expr.py`

The compiler builds symbolic expressions for each slot. Three expression types:

```python
Const(value: int)                              # Literal: 8, 16, 0
SlotRef(slot: int)                             # Reference: s18 (= n3.mw)
BinOp(op: str, left: Expr, right: Expr)        # Operation: (s18 + 10)
```

Operations: `+`, `-`, `*`, `/`, `max`, `min`

**Simplification rules (applied recursively):**

| Pattern | Result | Name |
|---------|--------|------|
| `Const(3) + Const(5)` | `Const(8)` | Constant evaluation |
| `x + Const(0)` | `x` | Identity elimination |
| `x - x` | `Const(0)` | Self-cancellation |
| `x * Const(1)` | `x` | Multiplicative identity |
| `x * Const(0)` | `Const(0)` | Zero multiplication |
| `max(x, x)` | `x` | Idempotent max/min |
| `(a + 5) + (b + 3)` | `(a + b) + 8` | Constant reassociation |

**Example:** Suppose the colon label's x position is symbolically:

```
x = screen.x + fixed.x + hbox.x + title.mw + gap
  = Const(0) + Const(0) + Const(8) + SlotRef(18) + Const(2)
```

After simplification:

```
x = BinOp("+", SlotRef(18), Const(10))
```

The constants `0 + 0 + 8 + 2` collapsed to `10`. At runtime, only one ADD instruction is needed.

---

## 7. The Compilation Pipeline (9 Stages)

**File:** `gnosis_dynamic_vm/gnosis_dynamic/compiler.py`

### Stage 1-3: Parse, Normalize, Assign IDs

Same as the static compiler: parse YAML, normalize aliases, give each node a sequential ID (0, 1, 2, ...). The node ID determines its slot range: node 3 owns slots 18-23.

### Stage 4: Compute Measures (bottom-up)

Walk the tree from leaves to root, building symbolic `mw` and `mh` expressions:

```
Pseudocode:

COMPUTE-MEASURES(node):
    if node.type == "label":
        if node has bind and no field_w:
            node.mw = SlotRef(node.slot("mw"))   # measured at runtime
            node.mh = Const(GLYPH_H * size)
            RECORD: emit MEASURE_TEXT_BIND for this node
        else:
            node.mw = Const(len(text) * GLYPH_W * size)  # known at compile time
            node.mh = Const(GLYPH_H * size)

    elif node.type == "hbox":
        for child in children: COMPUTE-MEASURES(child)
        node.mw = sum(child.mw for child in children) + (n-1) * gap
        node.mh = max(child.mh for child in children)

    elif node.type == "vbox":
        for child in children: COMPUTE-MEASURES(child)
        node.mw = max(child.mw for child in children)
        node.mh = sum(child.mh for child in children) + (n-1) * gap

    elif node.type == "fixed":
        for child in children: COMPUTE-MEASURES(child)
        node.mw = max(child.x + child.mw for child in children)
        node.mh = max(child.y + child.mh for child in children)
```

### Stage 5: Compile Layout (top-down)

Walk root to leaves, assigning symbolic x/y/w/h expressions. This propagates constraints from parent to children:

```
Pseudocode:

COMPILE-LAYOUT(node, x_expr, y_expr, w_expr, h_expr):
    node.x = x_expr
    node.y = y_expr
    node.w = w_expr  (or node.mw if no explicit width and type supports shrink-wrap)
    node.h = h_expr

    if node.type == "hbox":
        base_total = sum(child.mw) + (n-1) * gap
        extra = max(0, w - base_total)
        total_grow = sum(child.grow)
        cursor = x
        for child in children:
            child_w = child.mw
            if child.grow > 0 and total_grow > 0:
                child_w = child_w + extra * child.grow / total_grow
            COMPILE-LAYOUT(child, cursor, y, child_w, h)
            cursor = cursor + child_w + gap

    elif node.type == "vbox":
        # Mirror of hbox on y-axis
        ...

    elif node.type == "fixed":
        for child in children:
            child_x = x + child.offset_x
            child_y = y + child.offset_y
            COMPILE-LAYOUT(child, child_x, child_y, child.mw, child.mh)
```

All these operations produce symbolic expressions. If `child.mw` is `SlotRef(18)`, then `cursor` becomes `BinOp("+", SlotRef(18), Const(10))`, etc.

### Stage 6: Constant Fold

Simplify every slot expression. Expressions that reduce to `Const(n)` are written directly into the `slot_init` table and don't need bytecode.

### Stage 7: Dead Slot Elimination

Starting from the render operations (DRAW_TEXT_BIND needs slots x, y, w, h of its node), work backward through expression dependencies. Only slots reachable from render ops survive. Parent container slots that are only used as intermediates in child computations but are not themselves rendered get eliminated.

### Stage 8: Topological Sort and Emit

Sort dynamic slot expressions by dependency order (no slot is computed before its inputs). Emit stack machine bytecode:

```
For expression (SlotRef(18) + Const(10)):
    PUSH_SLOT   s18
    PUSH_CONST  10
    ADD
    STORE_SLOT  <target>
```

### Stage 9: Emit Render Operations

Walk the tree and emit DRAW_TEXT_CONST, DRAW_TEXT_BIND, DRAW_BAR_BIND, DRAW_HLINE, DRAW_VLINE for each leaf node.

---

## 8. The Bytecode Instruction Set (17 Opcodes)

```
Category: MEASUREMENT
  0x01  MEASURE_TEXT_BIND  node(u16) bind(u16) size(u8)
        → Resolve bind text, store len*GLYPH_W*size in node.mw, GLYPH_H*size in node.mh

Category: STACK MACHINE
  0x02  PUSH_CONST         value(u16)
  0x03  PUSH_SLOT           slot(u16)
  0x04  ADD                 (no operands — pops 2, pushes sum)
  0x05  SUB                 (pops 2, pushes difference)
  0x06  MUL                 (pops 2, pushes product)
  0x07  DIV                 (pops 2, pushes quotient; div/0 → 0)
  0x08  MAX                 (pops 2, pushes max)
  0x09  MIN                 (pops 2, pushes min)
  0x0A  STORE_SLOT          slot(u16) — pops value, stores in slot buffer

Category: RENDERING
  0x0B  DRAW_TEXT_CONST    node(u16) string_id(u16) size(u8) color(u8)
  0x0C  DRAW_TEXT_BIND     node(u16) bind_id(u16) size(u8) color(u8)
  0x0D  DRAW_BAR_BIND      node(u16) bind_id(u16) max(u16) track(u8) fill(u8)
  0x0E  DRAW_BAR_CONST     node(u16) value(u16) max(u16) track(u8) fill(u8)
  0x0F  DRAW_HLINE         node(u16) color(u8)
  0x10  DRAW_VLINE         node(u16) color(u8)

Category: CONTROL
  0xFF  HALT

Note: All multi-byte values are BIG-ENDIAN (unlike the static GNBC which is little-endian).
```

DRAW_* instructions read their x/y/w/h from the slot buffer (using the node ID to compute slot indices). The draw coordinates are NOT operands — they are looked up from slots. This is the crucial difference from the static compiler, where x/y/w/h are inline operands.

---

## 9. The Three Execution Phases

A GNDY program executes in three sequential phases within a single linear bytecode walk:

```
Phase 1: MEASUREMENT
  MEASURE_TEXT_BIND instructions resolve runtime text and store
  intrinsic widths/heights in mw/mh slots.

Phase 2: COMPUTATION
  Stack machine instructions (PUSH_CONST, PUSH_SLOT, ADD, SUB, ...,
  STORE_SLOT) compute layout expressions and write results to x/y/w/h slots.

Phase 3: RENDERING
  DRAW_* instructions read final coordinates from slots and issue
  draw operations.

HALT terminates.
```

The compiler guarantees this ordering: all MEASURE ops come first, then all STORE_SLOT computations (in topological order), then all DRAW ops, then HALT.

**This three-phase structure is critical for the step debugger** — the debugger can annotate which phase the current instruction belongs to and show phase transitions.

---

## 10. The Python Reference VM

**File:** `gnosis_dynamic_vm/gnosis_dynamic/vm.py`

The `VM` class is a straightforward interpreter:

```python
class VM:
    def evaluate(self, program: Program, runtime: dict) -> EvalResult:
        slots = list(program.slot_init)    # copy init values
        stack = []                          # operand stack
        draw_ops = []                       # accumulated draw commands
        pc = 0

        while pc < len(code):
            op = code[pc]; pc += 1
            # ... decode and execute each opcode ...

        return EvalResult(slots=named_slots, draw_ops=draw_ops)
```

The `EvalResult` contains:
- `slots`: dict mapping `"n3.mw"` -> 8, `"n4.x"` -> 18, etc.
- `draw_ops`: list of dicts, each with `type`, `node`, `x`, `y`, `w`, `h`, `text`, `color`, etc.

**Bind resolution:** `resolve_bind(runtime, "sensor.temp")` splits on `.` and walks the nested dict.

---

## 11. The C Runtime for MCU

**Files:** `gnosis_dynamic_vm/c_runtime/gnosis_vm.h`, `gnosis_vm.c`

The C implementation is designed for zero-allocation embedded use:

```c
// Host provides these callbacks:
typedef struct {
    GnosisStringView (*resolve_text)(void *ctx, uint16_t bind_id);
    int32_t (*resolve_i32)(void *ctx, uint16_t bind_id);
    void (*draw_text)(void *ctx, uint16_t x, y, w, h, GnosisStringView text, uint8_t size, color);
    void (*draw_bar)(void *ctx, uint16_t x, y, w, h, int32_t value, max, uint8_t track, fill);
    void (*draw_hline)(void *ctx, uint16_t x, y, span, uint8_t color);
    void (*draw_vline)(void *ctx, uint16_t x, y, span, uint8_t color);
} GnosisHooks;

// Evaluate: load program from flash, use RAM slot buffer
bool gnosis_eval(const GnosisProgram *program,
                 const GnosisHooks *hooks,
                 void *ctx,
                 uint16_t *slot_buffer,      // caller-provided RAM
                 uint16_t slot_capacity);
```

Memory budget:
- Program blob: in flash (const, zero RAM cost)
- Slot buffer: `node_count * 6 * 2` bytes (e.g., 9 nodes = 108 bytes)
- Stack: 64 * 4 = 256 bytes (fixed, on C stack)
- Total RAM for a typical program: ~400 bytes

---

## 12. The Binary Format (GNDY)

```
Offset  Size   Field                    Encoding
───────────────────────────────────────────────────
0x00    4      Magic                    "GNDY" (ASCII)
0x04    1      Version                  1
0x05    2      node_count               u16 BE
0x07    2      slot_count               u16 BE (= node_count * 6)
0x09    2      bind_count               u16 BE
0x0B    2      string_count             u16 BE
0x0D    4      code_len                 u32 BE
───────────────────────────────────────────────────
0x11    var    Bind section             [bind_count] length-prefixed UTF-8
        var    String section           [string_count] length-prefixed UTF-8
        var    Slot init section        [slot_count] u16 BE values
        var    Code section             [code_len] raw bytecode
```

**Important: GNDY uses big-endian**, unlike GNBC which uses little-endian. The JavaScript interpreter must use `(bytes[offset] << 8) | bytes[offset+1]` for u16 reads.

---

## 13. Worked Example: dynamic_hbox

**Source** (`examples/dynamic_hbox.yaml`):

```yaml
type: screen
width: 220
height: 72
body:
  type: fixed
  children:
    - type: hbox
      x: 8
      y: 8
      gap: 2
      children:
        - type: label
          bind: props.title       # INTRINSIC — measured at runtime
        - type: label
          text: ": "              # STATIC — width = 16
        - type: label
          bind: sensor.temp
          field_w: 4              # FIXED FIELD — width = 32 (constant)
    - type: hbox
      x: 8
      y: 28
      gap: 4
      children:
        - type: label
          text: "RPM"             # STATIC — width = 24
        - type: bar
          bind: sensor.rpm
          w: 100
          h: 4
          max: 7000
```

**Compiler output — symbolic IR:**

```
node n3 (title label, INTRINSIC):
  mw = s18            # measured at runtime
  x  = 8              # constant (folded into slot_init)
  y  = 8              # constant
  w  = s18            # same as mw
  h  = 8              # constant

node n4 (": " label, STATIC):
  mw = 16             # constant: len(": ") * 8
  x  = (s18 + 10)     # title.x + title.mw + gap = 8 + s18 + 2
  y  = 8              # constant
  w  = 16             # constant
  h  = 8              # constant

node n5 (sensor.temp, FIXED FIELD):
  mw = 32             # constant: field_w(4) * 8
  x  = (s18 + 28)     # title.x + title.mw + gap + colon.w + gap = 8 + s18 + 2 + 16 + 2
  y  = 8              # constant
  w  = 32             # constant
  h  = 8              # constant
```

**Bytecode (70 bytes):**

```
MEASURE_TEXT_BIND  n3 bind[0] size=1     # Measure title, store in n3.mw
PUSH_SLOT          n3.mw                 # Stack: [s18]
STORE_SLOT         n3.w                  # n3.w = n3.mw
PUSH_SLOT          n3.mw                 # Stack: [s18]
PUSH_CONST         10                    # Stack: [s18, 10]
ADD                                       # Stack: [s18+10]
STORE_SLOT         n4.x                  # n4.x = s18 + 10
PUSH_SLOT          n3.mw                 # Stack: [s18]
PUSH_CONST         28                    # Stack: [s18, 28]
ADD                                       # Stack: [s18+28]
STORE_SLOT         n5.x                  # n5.x = s18 + 28
DRAW_TEXT_BIND     n3 bind[0] size=1 color=1
DRAW_TEXT_CONST    n4 string[0] size=1 color=1
DRAW_TEXT_BIND     n5 bind[1] size=1 color=1
DRAW_TEXT_CONST    n7 string[1] size=1 color=1
DRAW_BAR_BIND      n8 bind[2] max=7000 track=3 fill=1
HALT
```

**Evaluation with title="T":**
- n3.mw = 8 (1 char * 8px)
- n3.w = 8, n4.x = 18, n5.x = 36

**Evaluation with title="Temperature":**
- n3.mw = 88 (11 chars * 8px)
- n3.w = 88, n4.x = 98, n5.x = 116

**Same bytecode, different layout. This is the whole point.**

---

## 14. Integration Plan: Adding Dynamic VM to the Web UI

### 14.1 What Needs to Change

The existing web UI (GNOSIS-001) compiles and renders static GNBC bytecode. To support the dynamic VM, we need:

1. **A new compilation endpoint** (`/api/compile-dynamic`) that calls the dynamic compiler
2. **A JavaScript GNDY interpreter** (stack machine + slot buffer + draw ops)
3. **New inspector panels** for slots, symbolic IR, and the stack machine
4. **A step debugger** that pauses at each instruction
5. **Multiple evaluation contexts** to show the same program with different runtime data

### 14.2 Server Changes

Add the `gnosis_dynamic_vm` package to the repo and create a new endpoint:

```
POST /api/compile-dynamic
Content-Type: application/json

Request:
{
    "source": "type: screen\n...",
    "runtimes": [
        {"name": "short", "data": {"props": {"title": "T"}, "sensor": {"temp": "72"}}},
        {"name": "long", "data": {"props": {"title": "Temperature"}, "sensor": {"temp": "72"}}}
    ]
}

Response:
{
    "success": true,
    "program": {
        "node_count": 9,
        "slot_count": 54,
        "binds": ["props.title", "sensor.temp", "sensor.rpm"],
        "strings": [": ", "RPM"],
        "slot_init": [0, 0, 0, 0, 0, 0, ...],  // 54 values
        "code_base64": "AQADAAIBBQMAEQIA..."
    },
    "ir": "node n0: type=screen ...\n  mw = 220\n...",   // symbolic IR text
    "disassembly": "0000: MEASURE_TEXT_BIND  n3 bind[0] size=1\n...",
    "evaluations": [
        {
            "name": "short",
            "runtime": {"props": {"title": "T"}, ...},
            "slots": {"n3.mw": 8, "n3.w": 8, "n4.x": 18, ...},
            "draw_ops": [{"type": "text", "x": 8, "y": 8, ...}, ...]
        },
        {
            "name": "long",
            "runtime": {"props": {"title": "Temperature"}, ...},
            "slots": {"n3.mw": 88, "n3.w": 88, "n4.x": 98, ...},
            "draw_ops": [...]
        }
    ]
}
```

### 14.3 JavaScript GNDY Interpreter

The frontend needs a JS interpreter matching `vm.py`. The key difference from the static interpreter: coordinates come from slots, not from instruction operands.

```
Pseudocode:

function evaluateGNDY(code, slotInit, binds, strings, runtime):
    slots = [...slotInit]            // copy initial values
    stack = []
    drawOps = []
    pc = 0

    while pc < code.length:
        op = code[pc]; pc++

        if op == 0x01:  // MEASURE_TEXT_BIND
            nodeId = readU16BE(code, pc); pc += 2
            bindId = readU16BE(code, pc); pc += 2
            size = code[pc]; pc++
            text = resolveBind(runtime, binds[bindId])
            slots[nodeId * 6 + 0] = text.length * GLYPH_W * size  // mw
            slots[nodeId * 6 + 1] = GLYPH_H * size                // mh

        elif op == 0x02:  // PUSH_CONST
            stack.push(readU16BE(code, pc)); pc += 2

        elif op == 0x03:  // PUSH_SLOT
            slotId = readU16BE(code, pc); pc += 2
            stack.push(slots[slotId])

        elif op in [0x04..0x09]:  // ADD, SUB, MUL, DIV, MAX, MIN
            rhs = stack.pop(); lhs = stack.pop()
            stack.push(compute(op, lhs, rhs))

        elif op == 0x0A:  // STORE_SLOT
            slotId = readU16BE(code, pc); pc += 2
            slots[slotId] = stack.pop()

        elif op == 0x0B:  // DRAW_TEXT_CONST
            nodeId = readU16BE(code, pc); pc += 2
            stringId = readU16BE(code, pc); pc += 2
            size = code[pc]; pc++
            color = code[pc]; pc++
            x = slots[nodeId*6+2]; y = slots[nodeId*6+3]
            w = slots[nodeId*6+4]; h = slots[nodeId*6+5]
            drawOps.push({type:"text", x, y, w, h, text: strings[stringId], size, color})

        // ... DRAW_TEXT_BIND, DRAW_BAR_*, DRAW_HLINE, DRAW_VLINE similarly

        elif op == 0xFF:  // HALT
            break

    return { slots, drawOps, stack }
```

---

## 15. Step Debugger Design

The step debugger is the most valuable new feature. It lets an engineer pause execution at any bytecode instruction and inspect the complete VM state.

### 15.1 Debugger State

```javascript
class GNDYDebugger {
    constructor(program, runtime) {
        this.code = base64ToBytes(program.code_base64)
        this.slots = [...program.slot_init]
        this.stack = []
        this.drawOps = []
        this.pc = 0
        this.runtime = runtime
        this.binds = program.binds
        this.strings = program.strings
        this.history = []     // for step-back
        this.halted = false
        this.phase = "init"   // "measure" | "compute" | "render" | "halted"
    }

    // Execute one instruction, return state snapshot
    step() {
        if (this.halted) return null
        this.history.push(this.snapshot())

        const op = this.code[this.pc]
        // ... execute one instruction, advance pc ...

        // Determine current phase
        if (op == 0x01) this.phase = "measure"
        else if (op >= 0x02 && op <= 0x0A) this.phase = "compute"
        else if (op >= 0x0B && op <= 0x10) this.phase = "render"
        else if (op == 0xFF) { this.phase = "halted"; this.halted = true }

        return this.snapshot()
    }

    // Run all instructions
    runToEnd() {
        while (!this.halted) this.step()
        return this.snapshot()
    }

    // Step backward (undo last instruction)
    stepBack() {
        if (this.history.length == 0) return null
        const prev = this.history.pop()
        this.restoreSnapshot(prev)
        return this.snapshot()
    }

    // Current state
    snapshot() {
        return {
            pc: this.pc,
            phase: this.phase,
            slots: [...this.slots],
            stack: [...this.stack],
            drawOps: [...this.drawOps],
            halted: this.halted,
            currentOp: this.pc < this.code.length ? this.code[this.pc] : null,
        }
    }
}
```

### 15.2 Debugger UI

The step debugger panel shows:

```
+----------------------------------------------------------------+
| STEP DEBUGGER                    [Step] [Run] [Reset] [Back]   |
+----------------------------------------------------------------+
| Phase: COMPUTE                   PC: 0x000C                    |
+----------------------------------------------------------------+
| DISASSEMBLY (with PC arrow)     | SLOTS (changed highlighted)  |
|                                 |                               |
| 0000: MEASURE_TEXT_BIND n3 ...  | n3.mw = 8    <-- measured    |
| 0006: PUSH_SLOT n3.mw          | n3.x  = 8    (init)          |
| 0009: STORE_SLOT n3.w          | n3.y  = 8    (init)          |
| → 000C: PUSH_SLOT n3.mw        | n3.w  = 8    <-- computed    |
| 000F: PUSH_CONST 10            | n3.h  = 8    (init)          |
| 0012: ADD                       | n4.x  = ?    (pending)       |
| 0013: STORE_SLOT n4.x          | n4.y  = 8    (init)          |
| ...                             | n4.w  = 16   (init)          |
|                                 | ...                           |
+---------------------------------+-------------------------------+
| STACK                           | CANVAS (partial render)       |
|                                 |                               |
| [8]  ← top                     | (shows draw ops so far)       |
|                                 |                               |
+---------------------------------+-------------------------------+
```

**Key interactions:**
- **Step**: Execute one instruction, update all panels
- **Run**: Execute to HALT, show final state
- **Reset**: Reload slot_init, clear stack and draw_ops
- **Back**: Undo last instruction (restore from history)
- Clicking a disassembly line sets a **breakpoint** — Run stops at that instruction
- Changed slots since last step are highlighted in yellow
- The canvas shows accumulated draw operations (blank until Phase 3 begins)

### 15.3 Side-by-Side Comparison

For the "same program, different data" use case, the UI should support showing two evaluations side by side:

```
+----------------------------+----------------------------+
| Runtime: "short"           | Runtime: "long"            |
| props.title = "T"          | props.title = "Temperature"|
+----------------------------+----------------------------+
| Canvas A                   | Canvas B                   |
| [T]: 72     RPM [====]    | [Temperature]: 72 RPM [==] |
+----------------------------+----------------------------+
| n3.mw = 8                 | n3.mw = 88                 |
| n4.x  = 18                | n4.x  = 98                 |
| n5.x  = 36                | n5.x  = 116                |
+----------------------------+----------------------------+
```

This makes the reflow visible. Same bytecode, different slot values, different layout.

---

## 16. API Extensions

### 16.1 Step-Debug Endpoint (Optional Server-Side)

For debugging that doesn't need a full JS interpreter:

```
POST /api/debug-step
{
    "source": "...",
    "runtime": {"props": {"title": "T"}, ...},
    "steps": 5    // execute first 5 instructions
}

Response:
{
    "pc": 15,
    "phase": "compute",
    "slots": {"n3.mw": 8, "n3.w": 8, ...},
    "stack": [8],
    "draw_ops": [],
    "instructions_executed": [
        {"pc": 0, "op": "MEASURE_TEXT_BIND", "args": "n3 bind[0] size=1"},
        {"pc": 6, "op": "PUSH_SLOT", "args": "n3.mw", "stack_after": [8]},
        ...
    ]
}
```

However, the recommended approach is to do stepping entirely in JavaScript (client-side) for instant responsiveness.

### 16.2 IR Endpoint

```
GET /api/dynamic-ir?source=...

Response:
{
    "nodes": [
        {"id": 0, "type": "screen", "path": "root",
         "slots": {"mw": "220", "mh": "72", "x": "0", "y": "0", "w": "220", "h": "72"}},
        {"id": 3, "type": "label", "path": "root/body:fixed/hbox[0]/label[0]",
         "slots": {"mw": "s18", "mh": "8", "x": "8", "y": "8", "w": "s18", "h": "8"}},
        ...
    ]
}
```

---

## 17. Frontend Changes

### 17.1 New Panels for Dynamic VM

Add to the bottom tab bar:

- **SLOTS**: Table of all slots with node name, field name, init value, current value, and source (init/measured/computed)
- **IR**: Symbolic expression view showing each node's slot expressions
- **DEBUGGER**: The step debugger panel described in section 15
- **COMPARE**: Side-by-side evaluation comparison

### 17.2 Mode Switch

The header should have a toggle: **STATIC** / **DYNAMIC** that switches between the GNBC and GNDY compilers. The editor, canvas, and inspector panels adapt accordingly.

### 17.3 Runtime Data Editor

For the dynamic compiler, the props editor becomes a **runtime data editor** where you define the runtime dict that gets passed to the VM:

```yaml
props:
  title: Temperature
sensor:
  temp: "72"
  rpm: 3500
```

A "Compare" button could fork this into two runtime contexts for side-by-side viewing.

---

## 18. Implementation Roadmap

### Phase 1: Server Integration

1. Copy `gnosis_dynamic_vm/` into the repo
2. Add `/api/compile-dynamic` endpoint to `web_server.py`
3. Serve IR text, disassembly, manifest, and evaluation results
4. Add a "dynamic" preset selector loading from `gnosis_dynamic_vm/examples/`

### Phase 2: JavaScript GNDY Interpreter

5. Implement `evaluateGNDY()` in the frontend
6. Add canvas renderer that draws from GNDY draw_ops (text, bar, hline, vline)
7. Wire up the runtime data editor
8. Show slot table panel

### Phase 3: Step Debugger

9. Implement `GNDYDebugger` class with step/run/reset/back
10. Build the debugger panel UI (disassembly with PC arrow, slot table, stack view)
11. Add breakpoints (click disassembly line to set)
12. Add phase indicator and transition highlighting

### Phase 4: Comparison and Polish

13. Implement side-by-side comparison view
14. Add IR panel showing symbolic expressions
15. Dark theme styling matching the existing GNOSIS aesthetic
16. Upload documentation and commit

---

## 19. File Reference

### Dynamic VM (new)

```
gnosis_dynamic_vm/
  gnosis_dynamic/
    __init__.py              # Public API: Compiler, VM, Program
    bytecode.py              # 17 opcodes, Program dataclass, GNDY format, CodeBuilder
    compiler.py              # 9-stage pipeline: parse → measures → layout → fold → emit
    expr.py                  # Symbolic expressions: Const, SlotRef, BinOp with simplification
    vm.py                    # Python reference VM: stack machine interpreter
  c_runtime/
    gnosis_vm.h              # C header: types, hooks, opcodes, gnosis_eval()
    gnosis_vm.c              # C implementation: loader + interpreter (~320 lines)
  examples/
    dynamic_hbox.yaml        # Layout reflow example (intrinsic title + fixed field)
    vbox_shrink_wrap.yaml    # Width bubbling example (vbox adapts to widest child)
  out/
    *.gndy                   # Compiled binaries
    *.disasm.txt             # Disassembly listings
    *.ir.txt                 # Symbolic IR dumps
    *.manifest.json          # Metadata
    *.short.eval.json        # Evaluation with short runtime data
    *.long.eval.json         # Evaluation with long runtime data
  tests/
    test_dynamic_program.py  # Regression tests: reflow, folding, roundtrip
  tools/
    build_examples.py        # Generates all output artifacts
  README.md
  COMPILER_GUIDE.md          # 13-section architecture documentation
  MIGRATION_NOTES.md         # Moving from static to dynamic model
```

### Existing Web UI (to be extended)

```
web_server.py                # Add /api/compile-dynamic endpoint
web/index.html               # Add GNDY interpreter, step debugger, slot panel, comparison view
```
