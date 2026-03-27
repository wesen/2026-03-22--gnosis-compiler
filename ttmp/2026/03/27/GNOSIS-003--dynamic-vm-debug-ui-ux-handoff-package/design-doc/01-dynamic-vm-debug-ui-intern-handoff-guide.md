---
Title: Dynamic VM Debug UI Intern Handoff Guide
Ticket: GNOSIS-003
Status: active
Topics:
    - compiler
    - dynamic-vm
    - webui
    - ux
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: gnosis_compiler/compiler.py
      Note: Static compiler pipeline and compile_with_stages contract used by the current UI
    - Path: gnosis_dynamic_vm/README.md
      Note: Compact explanation of the dynamic VM model
    - Path: gnosis_dynamic_vm/gnosis_dynamic/bytecode.py
      Note: Authoritative GNDY opcode and endianness reference
    - Path: gnosis_dynamic_vm/gnosis_dynamic/vm.py
      Note: Reference evaluator to mirror in the browser debugger
    - Path: ttmp/2026/03/22/GNOSIS-002--dynamic-vm-integration-with-debug-web-ui/design-doc/01-dynamic-vm-integration-analysis-design-and-implementation-guide.md
      Note: Prior dynamic VM integration design that this intern handoff refines and repackages
    - Path: web/index.html
      Note: Current single-file workbench shell
    - Path: web_server.py
      Note: Existing static server contract and the natural home for /api/compile-dynamic
ExternalSources: []
Summary: Intern-facing analysis, design, and implementation guide for adding a dynamic VM debug UI to the existing GNOSIS workbench
LastUpdated: 2026-03-27T15:05:00-04:00
WhatFor: Hand off the dynamic VM debug UI project to an intern who needs both system orientation and concrete implementation guidance
WhenToUse: Use when planning, designing, or implementing the dynamic VM mode and debugger inside the GNOSIS web workbench
---


# Dynamic VM Debug UI Intern Handoff Guide

## 1. Executive Summary

This document is a handoff package for the intern who will design and implement the **dynamic VM mode** of the GNOSIS web workbench. The goal is not only to describe a feature request, but to explain the surrounding system deeply enough that a new engineer can understand why the feature exists, what parts of the repository matter, which contracts are already stable, and where the open design choices still are.

Today the repository already has a usable browser workbench for the **static compiler**. That workbench accepts YAML and props, compiles them on the server, receives a compiled GNBC program plus intermediate AST stages, and renders the resulting bytecode on a canvas. The static workbench is useful because the compiler emits a fixed draw list: the frontend can interpret the draw instructions directly, highlight disassembly, inspect the AST, and simulate bind values without re-running layout.

The **dynamic VM** is different. It does not compile to a fixed draw list. Instead, it compiles to a residual program in the `GNDY` format that must be evaluated in three runtime phases: **measure**, **compute**, and **render**. The same compiled program can produce different layouts for different runtime inputs. That is why the existing static workbench is not enough. A dynamic VM workbench needs a slot table, a stack machine view, a phase indicator, and ideally a step debugger that can pause after each instruction.

The recommended product direction is to extend the existing workbench rather than build a second standalone UI. The current server, current single-file frontend, and current inspector-panel model already provide a strong shell. The dynamic mode should reuse the editor, preset loader pattern, canvas, and inspector area, while adding a mode switch and a new set of dynamic-specific panels.

## 2. Audience, Goal, and Scope

The primary audience is a new intern who is comfortable with web development but is new to GNOSIS. The intern should be able to read this once, inspect the referenced files, and then begin implementation without needing to reconstruct the architecture from scratch.

The concrete product goal is:

1. Add a **dynamic compiler mode** to the existing web workbench.
2. Let a user compile a YAML program into **GNDY**.
3. Let a user evaluate the same program with one or more runtime payloads.
4. Let a user inspect the VM state in terms of slots, stack, draw operations, and phase.
5. Let a user step forward instruction by instruction to understand how layout is produced.

This guide covers:

- the existing GNOSIS static compiler and web UI,
- the dynamic VM architecture,
- the mismatch between the current UI and the dynamic VM,
- the proposed API surface,
- the proposed frontend architecture,
- the proposed debugger model,
- a phased implementation plan,
- testing and review guidance.

This guide does not attempt to redesign the entire GNOSIS DSL, replace the dynamic compiler architecture, or add missing dynamic widgets such as grids or lists. Those can happen later.

## 3. What GNOSIS Is

GNOSIS is a system for producing e-ink user interfaces for constrained microcontrollers. The core context is important because it explains why the compiler architecture looks more like a small systems compiler than like a browser layout engine.

The project-level architecture guide explains that GNOSIS targets an MCU with tight RAM constraints and a 400x300 e-ink display, and that the compiler exists to precompute as much work as possible before anything reaches the device. See `docs/architecture-guide.md:30-36` and `docs/architecture-guide.md:40-113`.

The important mental model is:

- Author a UI in YAML.
- Compile the YAML into a binary program.
- Run the binary on an embedded runtime.
- Use the web workbench as a developer tool to inspect what the compiler produced.

The static compiler follows a classic front-end / middle-end / back-end pipeline. The architecture guide shows the full flow from YAML and props, to canonical AST, to optimized AST, to laid-out AST, to draw-list bytecode, to the final GNBC binary in `docs/architecture-guide.md:42-110`.

## 4. Current System Inventory

Before touching the dynamic UI, the intern needs to know which parts of the repository already matter.

### 4.1 Static compiler

The static compiler lives under `gnosis_compiler/`.

The most relevant files are:

- `gnosis_compiler/compiler.py`
- `gnosis_compiler/dsl.py`
- `gnosis_compiler/passes.py`
- `gnosis_compiler/layout.py`
- `gnosis_compiler/lower.py`
- `gnosis_compiler/disasm.py`
- `gnosis_compiler/serialize.py`

The compile pipeline with stage snapshots is visible in `gnosis_compiler/compiler.py:19-101`.

Key observed behavior:

- `compile_with_stages()` captures `parsed`, `resolved`, `canonical`, `after_dead_elimination`, `after_flatten`, `after_classify`, and `laid_out`.
- `compile()` is the simpler path that only returns the final `Program`.
- Layout happens before lowering.
- The final `Program` includes code, strings, binds, regions, stats, AST, and serialized binary.

### 4.2 Existing web workbench

The current web tool is a Flask server plus one single-file frontend.

Backend:

- `web_server.py`

Frontend:

- `web/index.html`

Observed backend contract in `web_server.py:73-153`:

- `POST /api/compile`
- `GET /api/presets`
- `GET /api/presets/<name>`
- `GET /api/options`

Observed frontend contract in `web/index.html:126-205` and `web/index.html:214-253`:

- the bottom inspector area already has tabs for `DISASSEMBLY`, `AST`, `HEX`, `STATS`, `MANIFEST`, `REGIONS`, and `BIND SIM`
- `doCompile()` posts `source` and `props` to `/api/compile`
- `renderCanvas()` decodes the compiled GNBC bytecode and renders it immediately on a canvas
- overlays are drawn from `laid_out` AST and dirty regions

The architecture guide summarizes the current static UI and its bytecode interpreter in `docs/architecture-guide.md:1145-1164`.

### 4.3 Dynamic VM

The dynamic VM lives under `gnosis_dynamic_vm/`.

The most relevant files are:

- `gnosis_dynamic_vm/gnosis_dynamic/compiler.py`
- `gnosis_dynamic_vm/gnosis_dynamic/expr.py`
- `gnosis_dynamic_vm/gnosis_dynamic/bytecode.py`
- `gnosis_dynamic_vm/gnosis_dynamic/vm.py`
- `gnosis_dynamic_vm/tests/test_dynamic_program.py`
- `gnosis_dynamic_vm/README.md`

The dynamic README explains the architecture in compact form:

- it is a dynamic layout compiler, not a static draw-list compiler,
- it emits `GNDY`,
- evaluation is split into `measure`, `compute`, and `render`,
- every node owns six slots: `mw`, `mh`, `x`, `y`, `w`, `h`.

See `gnosis_dynamic_vm/README.md:3-13`, `gnosis_dynamic_vm/README.md:36-60`, and `gnosis_dynamic_vm/README.md:136-165`.

## 5. Static Compiler vs Dynamic VM

This distinction is the single most important concept for the intern to understand. If it is misunderstood, the UI will be designed incorrectly.

### 5.1 Static compiler mental model

The static compiler does layout **at compile time**. The compiler computes concrete rectangles for each node and lowers the result into a flat draw program. The runtime only has to draw the precomputed shapes and patch runtime values into fixed places.

The architecture guide explicitly says the static pipeline computes pixel rectangles during layout and that the MCU never runs a layout algorithm. See `docs/architecture-guide.md:76-80` and `docs/architecture-guide.md:563-686`.

In product terms, the static workbench answers questions like:

- What AST did the compiler produce?
- What draw instructions did the compiler emit?
- What dirty regions exist?
- If I change a bind value, how would the same draw list look?

### 5.2 Dynamic VM mental model

The dynamic VM does **not** fully resolve layout at compile time. Instead it computes symbolic expressions for geometry, folds what it can, and emits the remaining work into a small VM program.

The dynamic README says:

1. measure dynamic intrinsic leaves at runtime,
2. evaluate residual geometry expressions into slot storage,
3. emit render commands from the final slots.

See `gnosis_dynamic_vm/README.md:7-13`.

In product terms, the dynamic workbench must answer questions like:

- Which slots are static and which are dynamic?
- What did text measurement change?
- Which arithmetic instructions produced the final geometry?
- Why did node `n4.x` become `98` instead of `18`?
- How did the runtime payload affect layout?

### 5.3 Why this matters to UX

The static workbench can treat bytecode as a mostly visual artifact. The dynamic workbench cannot. The dynamic UI must reveal **causality**:

- runtime input changes measured slots,
- measured slots feed stack computation,
- stack computation stores new slot values,
- render instructions consume the slots.

That means the dynamic mode is closer to a debugger or spreadsheet inspector than to a simple renderer.

## 6. Current Static Workbench Architecture

This section is here because the intern should build on what exists, not start from zero.

### 6.1 Backend flow today

The current backend flow is:

```text
Browser source + props
        |
        v
POST /api/compile
        |
        v
Flask parses YAML
        |
        v
Compiler.compile_with_stages()
        |
        v
Program + stages + disassembly + binary
        |
        v
JSON response
```

This is visible in `web_server.py:73-114`.

### 6.2 Frontend flow today

The current frontend flow is:

```text
User edits YAML/props
        |
        v
doCompile()
        |
        v
fetch('/api/compile')
        |
        v
compileResult = response
        |
        +--> renderCanvas()
        +--> updatePanels()
        +--> initialize bind simulator
```

This is visible in `web/index.html:171-205`.

### 6.3 Why the existing shell is worth reusing

The current workbench already has:

- a layout with editor, canvas, and inspector panel,
- a preset-loading mechanism,
- a status bar and auto-compile loop,
- a place to host multiple inspector tabs,
- an internal state object (`compileResult`, `bindValues`, `currentTab`, overlays),
- a style vocabulary that already fits GNOSIS.

Reusing this shell reduces risk because:

- the user already has one mental model for the tool,
- code paths for editor management and canvas rendering already exist,
- the static and dynamic modes share many controls,
- the intern can focus on dynamic-specific behavior instead of rebuilding the app shell.

## 7. Dynamic VM Architecture the Intern Must Understand

### 7.1 Program format

The dynamic program format is defined in `gnosis_dynamic_vm/gnosis_dynamic/bytecode.py:8-118`.

Observed facts:

- the opcode enum is declared in `Op`,
- `MAGIC = b"GNDY"` in `bytecode.py:30`,
- programs serialize `node_count`, `slot_init`, `binds`, `strings`, and `code`,
- `u16()` and `read_u16()` are **big-endian** in `bytecode.py:121-146`.

This is a critical contrast with the static workbench, whose JS interpreter uses little-endian decoding according to `docs/architecture-guide.md:1147`.

### 7.2 Execution model

The reference runtime is `gnosis_dynamic_vm/gnosis_dynamic/vm.py`.

Observed execution loop in `vm.py:21-118`:

- start with a copy of `program.slot_init`,
- maintain a mutable `stack`,
- maintain a mutable `draw_ops` list,
- walk the bytecode linearly with `pc`,
- interpret operations until `HALT`.

The opcode categories are:

- measurement: `MEASURE_TEXT_BIND`
- computation: `PUSH_CONST`, `PUSH_SLOT`, `ADD`, `SUB`, `MUL`, `DIV`, `MAX`, `MIN`, `STORE_SLOT`
- rendering: `DRAW_TEXT_CONST`, `DRAW_TEXT_BIND`, `DRAW_BAR_BIND`, `DRAW_BAR_CONST`, `DRAW_HLINE`, `DRAW_VLINE`
- control termination: `HALT`

This is the exact basis for the debugger UI.

### 7.3 Slot model

The slot helper functions are in `vm.py:179-186`.

Each node gets six slots:

- `mw`
- `mh`
- `x`
- `y`
- `w`
- `h`

The slot ID formula is:

```text
slot_id = node_id * 6 + field_index
```

This matters for the UI because the slot table should present both:

- the numeric slot array order,
- the human-readable names such as `n3.mw` and `n4.x`.

### 7.4 Runtime reflow example

The tests in `gnosis_dynamic_vm/tests/test_dynamic_program.py:17-34` show the core product story:

- the same compiled program is reused,
- the title text changes from `"T"` to `"Temperature"`,
- downstream `x` positions shift,
- a fixed-width field still keeps width `32`.

This is the simplest demo scenario the UI should optimize around.

## 8. Existing GNOSIS-002 Proposal and How to Use It

There is already a design ticket for dynamic VM integration: `GNOSIS-002`.

That ticket is valuable and should not be ignored. It already proposes:

- a new `POST /api/compile-dynamic` endpoint,
- a JS `evaluateGNDY()` interpreter,
- a `GNDYDebugger` class,
- a static/dynamic mode switch,
- a runtime-data editor,
- side-by-side comparison.

The most relevant sections are:

- API contract in `GNOSIS-002 design doc:613-652`
- interpreter pseudocode in `GNOSIS-002 design doc:655-709`
- debugger pseudocode in `GNOSIS-002 design doc:713-760`
- mode switch and roadmap in `GNOSIS-002 design doc:904-949`

This new ticket is intentionally different from GNOSIS-002:

- `GNOSIS-002` is the architecture and integration analysis ticket,
- `GNOSIS-003` is the **intern handoff package** that combines system orientation, UX framing, implementation guidance, and concrete build sequencing.

## 9. Gap Analysis

This section compares what the repository has today against what the dynamic debug UI needs.

### 9.1 What already exists

- A static compiler server endpoint: `web_server.py:73-114`
- A preset loader pattern: `web_server.py:124-138`
- A static compile options endpoint: `web_server.py:141-153`
- A single-file web app shell: `web/index.html`
- A working disassembly/AST/hex/stats/manifest/regions/bind-sim panel model: `web/index.html:126-145`
- A static compile loop and render loop: `web/index.html:179-253`
- A dynamic compiler and dynamic reference VM in `gnosis_dynamic_vm/`
- Dynamic VM regression tests demonstrating expected behavior: `gnosis_dynamic_vm/tests/test_dynamic_program.py:17-61`

### 9.2 What is missing

- No `/api/compile-dynamic` route in `web_server.py`
- No frontend mode switch between static and dynamic compilers
- No GNDY interpreter in the browser
- No slot table panel
- No stack panel
- No phase indicator
- No instruction stepping controls
- No dynamic runtime-data presets integrated into the current preset dropdown
- No side-by-side dynamic comparison view

### 9.3 Product consequence of the gap

Without these pieces, the user can inspect the static compiler but cannot inspect the dynamic VM. The most important dynamic behaviors, namely runtime measurement and layout reflow, remain invisible unless the user reads Python tests or runs the Python VM manually. That is a poor experience for design iteration and debugging.

## 10. Product Requirements for the New UI

The dynamic UI should be designed around user questions, not just around internal data structures.

### 10.1 Primary user questions

The UI should help a user answer:

1. What compiled program did the dynamic compiler emit?
2. What runtime payload am I evaluating?
3. Which instructions are measurement, computation, or rendering?
4. Which slots changed after this instruction?
5. Why did a widget move?
6. How do two runtime payloads differ?

### 10.2 Primary user workflows

The UI should support these workflows:

1. Compile one YAML file and inspect one runtime payload.
2. Compare two runtime payloads using the same compiled program.
3. Step through execution to understand a layout bug.
4. Pause on a suspect instruction and inspect stack plus slot changes.
5. Switch back to static mode without leaving the page.

### 10.3 Success criteria

The dynamic mode is successful if a new engineer can:

- explain why a node has its final `x`, `y`, `w`, and `h`,
- point to the instruction that changed a slot,
- compare two evaluations and see exactly which slots diverged,
- inspect final draw operations without needing to read Python source.

## 11. Proposed UX Architecture

### 11.1 One app, two modes

The recommended direction is a single application with a top-level mode switch:

```text
+-------------------------------------------------------------+
| GNOSIS WORKBENCH                                            |
| [ STATIC ] [ DYNAMIC ]                     preset  status   |
+----------------------+--------------------------------------+
| source / props       | canvas / compare canvas              |
| runtime editor       | debugger overlays / hover info       |
+----------------------+--------------------------------------+
| inspector tabs                                              |
| disasm | ast/ir | hex | stats | manifest | regions/slots... |
+-------------------------------------------------------------+
```

This follows the earlier GNOSIS-002 recommendation at `line 904`.

Why one app is better than two:

- the editor and preset workflows remain consistent,
- the static mode already provides the shell,
- engineers can compare static and dynamic compiler behavior in one place,
- the user does not need to learn two URLs or two interaction models.

### 11.2 Mode-specific panel set

The static mode can keep its current tabs.

The dynamic mode should use these tabs:

- `DISASM`
- `SLOTS`
- `STACK`
- `IR`
- `MANIFEST`
- `EVAL`
- `COMPARE`
- `DEBUGGER`

Recommended behavior:

- some tabs are common across modes, such as `DISASM` and `MANIFEST`
- some tabs switch meaning, for example `AST` in static mode becomes `IR` in dynamic mode
- some tabs are dynamic-only, such as `SLOTS`, `STACK`, `COMPARE`, and `DEBUGGER`

### 11.3 Canvas behavior

The canvas should remain central. However, in dynamic mode it becomes a **consumer of evaluated draw ops**, not a direct bytecode interpreter in the static sense.

Recommended canvas modes:

1. Final render of the currently selected runtime.
2. Final render comparison for runtime A vs runtime B.
3. Optional instruction-highlight mode where the currently stepped instruction highlights affected nodes or slots.

### 11.4 Runtime editor

In static mode, the right mental model is compile-time props.

In dynamic mode, the right mental model is runtime data.

Recommended editor label in dynamic mode:

- `RUNTIME A`
- `RUNTIME B` when compare mode is enabled

Example:

```yaml
props:
  title: Temperature
sensor:
  temp: "72"
  rpm: 3500
```

The earlier GNOSIS-002 ticket already suggested this model in `lines 906-918`.

## 12. Proposed Backend Contract

### 12.1 Design principles

The backend should do three things:

1. compile the dynamic program,
2. return a representation rich enough for the UI to render and debug it,
3. optionally evaluate one or more runtimes using the Python reference VM so the frontend has a correctness oracle.

The backend should **not** own step-by-step debugging after the first version. The debugger should be client-side so that stepping is immediate and does not require a network roundtrip.

### 12.2 Proposed endpoint

Recommended endpoint:

```http
POST /api/compile-dynamic
Content-Type: application/json
```

Recommended request:

```json
{
  "source": "type: screen\n...",
  "runtimes": [
    {
      "name": "runtimeA",
      "data": {
        "props": {"title": "T"},
        "sensor": {"temp": "72", "rpm": 3500}
      }
    },
    {
      "name": "runtimeB",
      "data": {
        "props": {"title": "Temperature"},
        "sensor": {"temp": "72", "rpm": 3500}
      }
    }
  ]
}
```

This is aligned with the earlier design in `GNOSIS-002 design doc:613-652`.

Recommended response:

```json
{
  "success": true,
  "program": {
    "node_count": 9,
    "slot_count": 54,
    "binds": ["props.title", "sensor.temp", "sensor.rpm"],
    "strings": [": ", "RPM"],
    "slot_init": [0, 0, 8, 8, 16, 8],
    "code_base64": "AQADAAIBBQMAEQIA...",
    "manifest": {
      "node_count": 9,
      "slot_count": 54
    }
  },
  "disassembly": "0000: MEASURE_TEXT_BIND ...",
  "ir": "node n0 ...",
  "evaluations": [
    {
      "name": "runtimeA",
      "runtime": {...},
      "slots": {"n3.mw": 8, "n4.x": 18},
      "draw_ops": [...]
    },
    {
      "name": "runtimeB",
      "runtime": {...},
      "slots": {"n3.mw": 88, "n4.x": 98},
      "draw_ops": [...]
    }
  ]
}
```

### 12.3 Additional helpful backend endpoints

These are optional, not required for phase 1:

- `GET /api/presets-dynamic`
- `GET /api/presets-dynamic/<name>`
- `GET /api/options-dynamic`

If speed matters, dynamic presets can also be folded into the current preset endpoint with a `kind` field:

```json
{
  "name": "dynamic_hbox",
  "kind": "dynamic",
  "description": "Dynamic HBox"
}
```

## 13. Proposed Frontend Data Model

The frontend needs a clearer state model than the current mostly-global state variables.

Recommended top-level state shape:

```javascript
state = {
  mode: "static" | "dynamic",
  sourceText: "",
  propsText: "",
  runtimeA: "",
  runtimeB: "",
  compareEnabled: false,
  compileResult: null,
  selectedRuntime: "runtimeA",
  selectedTab: "disasm",
  debugger: null,
  overlays: {
    bounds: false,
    dirty: false,
    depth: false
  }
}
```

The current frontend already has pieces of this in `web/index.html:162-169`, but they should be normalized into a mode-aware state object for the new work.

## 14. Proposed Browser Interpreter

### 14.1 Why the browser needs its own interpreter

The browser needs a JS interpreter because:

- stepping on every instruction via server round-trip would feel slow,
- breakpoint behavior would be harder to manage,
- the UI needs direct access to intermediate VM state after each instruction,
- the Python VM already provides a correctness model that can be mirrored.

### 14.2 Required implementation rules

The browser interpreter must match the Python VM in `gnosis_dynamic_vm/gnosis_dynamic/vm.py:21-118`.

Rules:

1. Use **big-endian** reads for `u16`.
2. Initialize `slots` from `slot_init`.
3. Maintain a `stack` array.
4. Maintain a `drawOps` array.
5. Maintain `pc`.
6. Stop at `HALT`.
7. Preserve enough per-step state to support debugger snapshots.

### 14.3 Pseudocode

```javascript
function evaluateDynamic(program, runtime) {
  const code = base64ToBytes(program.code_base64);
  const slots = [...program.slot_init];
  const stack = [];
  const drawOps = [];
  let pc = 0;

  while (pc < code.length) {
    const op = code[pc++];

    switch (op) {
      case 0x01: {
        const node = readU16BE(code, pc); pc += 2;
        const bind = readU16BE(code, pc); pc += 2;
        const size = code[pc++];
        const text = String(resolveBind(runtime, program.binds[bind]) ?? "");
        slots[node * 6 + 0] = text.length * GLYPH_W * size;
        slots[node * 6 + 1] = GLYPH_H * size;
        break;
      }
      case 0x02: {
        stack.push(readU16BE(code, pc)); pc += 2;
        break;
      }
      case 0x03: {
        const slot = readU16BE(code, pc); pc += 2;
        stack.push(slots[slot]);
        break;
      }
      case 0x04:
      case 0x05:
      case 0x06:
      case 0x07:
      case 0x08:
      case 0x09: {
        const rhs = stack.pop();
        const lhs = stack.pop();
        stack.push(applyBinaryOp(op, lhs, rhs));
        break;
      }
      case 0x0A: {
        const slot = readU16BE(code, pc); pc += 2;
        slots[slot] = clampU16(stack.pop());
        break;
      }
      case 0x0B:
      case 0x0C:
      case 0x0D:
      case 0x0E:
      case 0x0F:
      case 0x10: {
        drawOps.push(decodeDrawOp(op, code, pc, slots, runtime, program));
        pc += drawOpOperandLength(op);
        break;
      }
      case 0xFF:
        return { slots, stack, drawOps };
      default:
        throw new Error(`unknown opcode ${op.toString(16)}`);
    }
  }

  return { slots, stack, drawOps };
}
```

## 15. Proposed Debugger Architecture

### 15.1 Core debugger object

Recommended object:

```javascript
class DynamicDebugger {
  constructor(program, runtime) {
    this.program = program;
    this.runtime = runtime;
    this.code = base64ToBytes(program.code_base64);
    this.reset();
  }

  reset() {
    this.pc = 0;
    this.phase = "init";
    this.halted = false;
    this.slots = [...this.program.slot_init];
    this.stack = [];
    this.drawOps = [];
    this.history = [];
  }

  snapshot() {
    return {
      pc: this.pc,
      phase: this.phase,
      halted: this.halted,
      slots: [...this.slots],
      stack: [...this.stack],
      drawOps: structuredClone(this.drawOps)
    };
  }

  step() {
    if (this.halted) return this.snapshot();
    this.history.push(this.snapshot());
    const op = this.code[this.pc];
    executeOneInstruction(this);
    this.phase = classifyPhase(op);
    if (op === 0xFF) this.halted = true;
    return this.snapshot();
  }

  stepBack() {
    const prev = this.history.pop();
    if (!prev) return null;
    Object.assign(this, structuredClone(prev));
    return this.snapshot();
  }

  runToEnd() {
    while (!this.halted) this.step();
    return this.snapshot();
  }
}
```

This closely mirrors the earlier `GNDYDebugger` proposal in `GNOSIS-002 design doc:719-760`.

### 15.2 Phase model

The phase model should be explicit, because it is pedagogically useful and technically accurate.

Classification:

- `measure`: `MEASURE_TEXT_BIND`
- `compute`: `PUSH_CONST`, `PUSH_SLOT`, `ADD`, `SUB`, `MUL`, `DIV`, `MAX`, `MIN`, `STORE_SLOT`
- `render`: `DRAW_*`
- `halted`: `HALT`

The UI should show the current phase prominently. This is more useful to a new engineer than a raw opcode number.

### 15.3 What to show after each step

Every step should surface:

- current `pc`
- current opcode
- current phase
- current stack
- slot diff since previous step
- current draw-op count
- canvas state after the step

Recommended slot diff display:

```text
Changed this step:
- n3.mw: 8 -> 88
- n4.x: 18 -> 98
- n5.x: 36 -> 116
```

This is much easier for an intern to reason about than re-reading the full slot table after every instruction.

## 16. UI Panel-by-Panel Specification

### 16.1 Disassembly panel

Required features:

- byte offset
- opcode name
- decoded operands
- current `pc` arrow
- click to jump/highlight
- optional breakpoint toggle

Nice to have:

- instruction categories colored by phase
- hover tooltip describing operand semantics

### 16.2 Slots panel

Required columns:

- slot name, for example `n4.x`
- value
- source class: `init`, `measured`, `computed`
- last changed step

Nice to have:

- node grouping
- search/filter by node
- highlight changed rows after each step

### 16.3 Stack panel

Required:

- top of stack visible
- each frame displayed as integer
- empty-state message when stack is empty

This panel is not visually glamorous, but it is critical for debugging arithmetic bugs.

### 16.4 IR panel

The IR panel should show symbolic expressions from the compiler, ideally as text returned by the backend.

Why it matters:

- it bridges the gap between authored YAML and emitted bytecode,
- it explains the meaning of later arithmetic instructions,
- it is the best place to teach the slot-expression model.

### 16.5 Evaluation panel

The evaluation panel should show final results for the selected runtime:

- final slot table summary
- final draw ops
- runtime payload used
- quick stats such as `changed slots`, `draw op count`, `node count`

### 16.6 Compare panel

The compare panel should be optimized for the simplest persuasive demo: one program, two runtime payloads, different final layout.

Recommended compare layout:

```text
+----------------------+----------------------+
| Runtime A            | Runtime B            |
| canvas               | canvas               |
| title = "T"          | title = "Temperature"|
| changed slots list   | changed slots list   |
+----------------------+----------------------+
| unified slot diff table                           |
+---------------------------------------------------+
```

## 17. API Reference

### 17.1 Existing static API

Observed from `web_server.py:73-153`:

```http
POST /api/compile
GET  /api/presets
GET  /api/presets/<name>
GET  /api/options
```

Static response characteristics:

- includes intermediate AST stages,
- includes disassembly,
- includes base64 bytecode and binary,
- includes manifest-style program data.

### 17.2 Proposed dynamic API

Recommended additions:

```http
POST /api/compile-dynamic
GET  /api/presets-dynamic
GET  /api/presets-dynamic/<name>
```

The dynamic endpoint should return:

- compiled program metadata,
- `slot_init`,
- `binds`,
- `strings`,
- base64 code,
- disassembly,
- symbolic IR text,
- zero or more evaluation payloads.

### 17.3 Suggested JSON types

```typescript
type DynamicCompileRequest = {
  source: string;
  runtimes?: Array<{
    name: string;
    data: Record<string, unknown>;
  }>;
};

type DynamicProgramPayload = {
  node_count: number;
  slot_count: number;
  binds: string[];
  strings: string[];
  slot_init: number[];
  code_base64: string;
  manifest: Record<string, unknown>;
};

type DynamicEvaluation = {
  name: string;
  runtime: Record<string, unknown>;
  slots: Record<string, number>;
  draw_ops: Array<Record<string, unknown>>;
};

type DynamicCompileResponse = {
  success: boolean;
  program: DynamicProgramPayload;
  disassembly: string;
  ir: string;
  evaluations: DynamicEvaluation[];
};
```

## 18. File-Level Implementation Plan

### Phase 1. Backend integration

Goal: get dynamic compilation into the browser with no debugger yet.

Files:

- `web_server.py`
- `gnosis_dynamic_vm/gnosis_dynamic/compiler.py`
- `gnosis_dynamic_vm/gnosis_dynamic/vm.py`

Tasks:

1. Import the dynamic compiler and VM into `web_server.py`.
2. Add `POST /api/compile-dynamic`.
3. Parse YAML source exactly as the static route already does.
4. Compile the program.
5. If runtimes are provided, evaluate them with the Python VM and return the result.
6. Add dynamic preset endpoints or enrich the existing preset response.

Definition of done:

- browser can request a dynamic compile response,
- response includes program, disassembly, and at least one evaluation,
- the endpoint handles invalid YAML and runtime payloads cleanly.

### Phase 2. Frontend dynamic render path

Goal: render final dynamic evaluation results in the browser.

Files:

- `web/index.html`

Tasks:

1. Add a mode switch: `STATIC` / `DYNAMIC`.
2. Add mode-aware editor labels and state.
3. Add a second compile path that posts to `/api/compile-dynamic`.
4. Add a dynamic canvas renderer that draws from `drawOps`.
5. Add `SLOTS`, `STACK`, and `EVAL` panels.
6. Keep static mode working unchanged.

Definition of done:

- user can switch to dynamic mode,
- compile a dynamic example,
- see the final evaluated canvas for one runtime,
- inspect final slots and draw ops.

### Phase 3. Browser VM interpreter

Goal: compute dynamic evaluations client-side and match the Python VM.

Files:

- `web/index.html`
- optionally split helpers into separate local JS files later if the single-file constraint is relaxed

Tasks:

1. Implement `readU16BE()`.
2. Implement `resolveBind()`.
3. Implement `evaluateDynamic()`.
4. Compare browser output against backend evaluation output.
5. Add user-visible mismatch warnings if outputs diverge during development.

Definition of done:

- JS and Python evaluation agree on the checked-in examples,
- dynamic canvas can render from the JS interpreter alone.

### Phase 4. Step debugger

Goal: make VM execution inspectable.

Files:

- `web/index.html`

Tasks:

1. Implement `DynamicDebugger`.
2. Add controls: `STEP`, `RUN`, `RESET`, `BACK`.
3. Add the `DEBUGGER` panel.
4. Highlight the current disassembly line.
5. Show current phase.
6. Show slot diff and current stack.

Definition of done:

- user can step through the example program from start to halt,
- the currently stepped state is visible and understandable,
- step-back works reliably.

### Phase 5. Compare and polish

Goal: make the tool persuasive and intern-friendly.

Files:

- `web/index.html`
- `web_server.py`

Tasks:

1. Add dual-runtime compare mode.
2. Add a compact diff view for slots.
3. Add better copy for empty states and help text.
4. Add a few curated dynamic presets.
5. Add documentation links from the UI to this ticket if useful.

Definition of done:

- the user can compare short title vs long title visually,
- changed slots are obvious,
- the tool is usable by someone who did not write the compiler.

## 19. Testing and Validation Strategy

### 19.1 Backend validation

Use the existing dynamic tests as the first correctness oracle.

Command:

```bash
PYTHONPATH=.:gnosis_dynamic_vm python -m unittest discover -s gnosis_dynamic_vm/tests -v
```

These tests validate:

- same program reflow with different runtime titles,
- constant folding behavior,
- width bubbling,
- program serialization roundtrip.

See `gnosis_dynamic_vm/tests/test_dynamic_program.py:17-61`.

### 19.2 Frontend validation

Recommended validation loop:

1. Compile `dynamic_hbox.yaml`.
2. Evaluate two runtimes: short title and long title.
3. Confirm the browser draw ops match backend draw ops.
4. Step through until `HALT`.
5. Confirm changed slots and final canvas match the backend result.

Recommended test matrix:

| Area | Validation |
|---|---|
| endian decoding | compare against Python VM on one known program |
| slot writes | confirm `STORE_SLOT` changes expected human-readable slot names |
| measurement | confirm `MEASURE_TEXT_BIND` changes only the expected `mw` and `mh` |
| rendering | confirm final draw ops are identical to backend evaluation |
| debugger history | step, back, step again and confirm deterministic state |

### 19.3 UX validation

Ask a reviewer who is new to the dynamic VM to answer these without code access:

1. Why did the second label move when the title changed?
2. Which instruction first changed the layout?
3. Which slots differ between the two runtimes?
4. Which phase is the program currently in?

If the reviewer cannot answer these quickly, the UI is still too opaque.

## 20. Risks, Alternatives, and Open Questions

### 20.1 Major risks

1. **Endian mismatch**
   The current static frontend assumes little-endian bytecode. The dynamic VM is big-endian in `gnosis_dynamic_vm/gnosis_dynamic/bytecode.py:121-146`.

2. **Single-file frontend complexity**
   `web/index.html` already contains layout, state, rendering, and panel code. Adding a second interpreter and a debugger may push the file past a comfortable maintenance threshold.

3. **Debugger state drift**
   If the step debugger and the “evaluate to end” path use different code paths, they can diverge subtly.

4. **UX overload**
   Slots, stack, and disassembly are useful, but only if the interface guides the user clearly. Too much raw data without curation will scare off new users.

### 20.2 Alternatives considered

#### Alternative A: Server-side stepping only

Rejected for the first version.

Why:

- high interaction latency,
- harder breakpoint UX,
- more backend statefulness,
- browser cannot easily scrub backwards through history.

#### Alternative B: Separate dynamic-only app

Rejected for now.

Why:

- duplicates the shell,
- fragments the user experience,
- increases maintenance,
- makes static vs dynamic comparison harder.

#### Alternative C: Show only final render, no debugger

Rejected as the end state, though acceptable as an intermediate milestone.

Why:

- removes the main educational value of the dynamic VM,
- does not explain layout causality,
- turns the dynamic workbench into a less powerful demo than it could be.

### 20.3 Open questions

1. Should breakpoints ship in the first debugger version or after step/run/reset/back is stable?
2. Should IR be returned as plain text first, or as structured JSON for richer UI rendering?
3. Should dynamic presets live beside static presets in one selector or in separate selectors?
4. Should the single-file frontend constraint remain, or should the dynamic work justify splitting JS helpers out?

## 21. Recommended Build Order for the Intern

If the intern needs one simple sequence to follow, use this:

1. Read `web_server.py`, `web/index.html`, `gnosis_dynamic_vm/README.md`, and `gnosis_dynamic_vm/gnosis_dynamic/vm.py`.
2. Add `/api/compile-dynamic`.
3. Add mode-aware state in the frontend.
4. Render backend-generated dynamic evaluations on canvas.
5. Implement the JS interpreter and verify it against the backend.
6. Add slot and stack panels.
7. Add step controls and the debugger panel.
8. Add comparison mode and polish.

This order keeps the highest-risk technical work in the middle, after a visible but simple first milestone.

## 22. References

Primary files:

- `docs/architecture-guide.md`
- `web_server.py`
- `web/index.html`
- `gnosis_compiler/compiler.py`
- `gnosis_dynamic_vm/README.md`
- `gnosis_dynamic_vm/gnosis_dynamic/bytecode.py`
- `gnosis_dynamic_vm/gnosis_dynamic/vm.py`
- `gnosis_dynamic_vm/tests/test_dynamic_program.py`
- `ttmp/2026/03/22/GNOSIS-002--dynamic-vm-integration-with-debug-web-ui/design-doc/01-dynamic-vm-integration-analysis-design-and-implementation-guide.md`

Most important evidence anchors cited in this document:

- `gnosis_compiler/compiler.py:19-101`
- `web_server.py:73-153`
- `web/index.html:126-253`
- `docs/architecture-guide.md:42-110`
- `docs/architecture-guide.md:1145-1164`
- `gnosis_dynamic_vm/README.md:7-13`
- `gnosis_dynamic_vm/README.md:36-60`
- `gnosis_dynamic_vm/gnosis_dynamic/bytecode.py:8-146`
- `gnosis_dynamic_vm/gnosis_dynamic/vm.py:21-118`
- `gnosis_dynamic_vm/tests/test_dynamic_program.py:17-61`
- `GNOSIS-002 design doc:613-760`
- `GNOSIS-002 design doc:904-949`
