---
Title: 'Experiment: Verilog GNOSIS VM for Vector Graphics Control'
Ticket: GNOSIS-005
Status: active
Topics:
    - compiler
    - dynamic-vm
    - webui
    - react
    - redux
    - debugger
    - virtual-machines
    - microcode
    - fpga
    - verilog
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: README.md
      Note: High-level dynamic-only product orientation
    - Path: gnosis_dynamic_vm/README.md
      Note: Current dynamic VM execution model and stated limitations
    - Path: gnosis_dynamic_vm/gnosis_dynamic/compiler.py
      Note: Host compiler that emits the GNDY residual program
    - Path: gnosis_dynamic_vm/gnosis_dynamic/bytecode.py
      Note: Opcode definitions and binary layout that hardware would execute
    - Path: gnosis_dynamic_vm/gnosis_dynamic/vm.py
      Note: Reference interpreter semantics for the proposed RTL implementation
    - Path: web_server.py
      Note: Current compile surface that could feed future hardware experiments
    - Path: ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/02-vm-microcode-and-fpga-reading-guide.md
      Note: Background reading for an intern before attempting this experiment
ExternalSources: []
Summary: Experimental architecture note for implementing the current GNOSIS VM as a Verilog control core that emits vector graphics commands
LastUpdated: 2026-03-27T18:05:00-04:00
WhatFor: Capture a detailed hardware-oriented thought experiment while the current VM shape is still fresh
WhenToUse: Use when exploring how the current GNOSIS bytecode VM could be realized in Verilog or mapped onto a vector graphics control pipeline
---

# Experiment: Verilog GNOSIS VM for Vector Graphics Control

## Goal

This document records a concrete experiment idea: implement the current GNOSIS dynamic VM in Verilog as a small control core that reads a compiled GNDY program, evaluates slot geometry, and emits vector drawing commands to a separate graphics engine.

The purpose is not to commit the project to FPGA work now. The purpose is to preserve a serious design direction while the current VM architecture is still simple and legible. If an intern or future engineer wants to prototype the runtime in hardware, this note should make the first design pass much easier.

## Context

The current GNOSIS system already has the right shape for a hardware experiment.

At a high level:

- the host compiler lowers YAML into a compact bytecode program in [compiler.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/compiler.py)
- the binary format and opcode set are defined in [bytecode.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/bytecode.py)
- the runtime semantics are defined by the Python interpreter in [vm.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/vm.py)
- the execution model is deliberately split into measure, evaluate residual geometry, and emit draw operations in [gnosis_dynamic_vm/README.md](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/README.md#L7)

That means the hardware experiment does not need to invent a new VM. It only needs to re-express the current one in RTL.

The crucial architectural point is this: the GNOSIS VM should remain a layout-and-command engine, not a rasterizer. The VM should compute geometry and emit normalized drawing commands. A separate vector graphics block should consume those commands and handle stroke generation, fills, and text rendering.

## Quick Reference

### One-sentence architecture

Implement GNOSIS as a multicycle stack-machine control core with slot RAM and stack RAM that reads GNDY bytecode from ROM/flash and writes normalized draw commands into a FIFO consumed by a vector graphics controller.

### Why the current VM is a good hardware target

- The opcode set is small and explicit in [bytecode.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/bytecode.py#L8).
- The runtime state is simple: `pc`, `stack`, `slots`, and `draw_ops` in [vm.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/vm.py#L21).
- Slot storage is a flat fixed-width array: 6 fields per node in [compiler.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/compiler.py#L18).
- The compiler already pushes expensive symbolic work out of the runtime.

### Recommended hardware split

| Block | Responsibility | Notes |
| --- | --- | --- |
| `gndy_program_rom` | Stores bytecode blob and possibly header tables | Flash, block RAM, or ROM image |
| `gndy_header_loader` | Reads node count, slot count, bind/string counts, code offset | Can be omitted in the first prototype |
| `gnosis_vm_core` | Fetch/decode/execute VM ops | Main control FSM |
| `slot_ram` | Stores `mw`, `mh`, `x`, `y`, `w`, `h` for each node | 16-bit words are enough for current model |
| `stack_ram` | Operand stack | Depth 32 or 64 is enough for first experiments |
| `bind_resolver_if` | Supplies runtime values for text/numeric binds | Host-facing handshake |
| `text_measure_if` | Returns intrinsic width/height for dynamic text | May be stubbed initially |
| `draw_cmd_fifo` | Buffers drawing commands | Boundary between VM and graphics engine |
| `vector_controller` | Consumes commands and renders | Kept outside the VM |

### First prototype scope

Start with a reduced VM:

- `PUSH_CONST`
- `PUSH_SLOT`
- `ADD`
- `SUB`
- `MUL`
- `DIV`
- `MAX`
- `MIN`
- `STORE_SLOT`
- `DRAW_HLINE`
- `DRAW_VLINE`
- `HALT`

Add text and runtime binds later.

### Core design rule

Do not fuse the VM and the renderer.

The VM:

- computes geometry
- resolves slots
- emits commands

The graphics controller:

- draws lines
- fills bars/rectangles
- renders text or glyph strokes

Keeping those concerns separate makes the hardware much easier to verify.

## Usage Examples

### Example 1: Reading this as an intern before any RTL work

Use this document to understand:

- what part of GNOSIS belongs in the VM core
- what part belongs in a graphics block
- which opcodes should be implemented first
- how to stage the experiment without getting lost in text rendering immediately

Then read [02-vm-microcode-and-fpga-reading-guide.md](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/02-vm-microcode-and-fpga-reading-guide.md) to get the broader background.

### Example 2: Using this as a hardware design note

If someone decides to prototype the VM on FPGA, this document gives the first-pass answers to:

- what modules to build
- what signals to expose
- how to stage implementation
- what to treat as host services
- how to translate draw ops into vector commands

### Example 3: Using this to compare software and hardware execution

An engineer can step through the Python VM in [vm.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/vm.py#L28), then compare the same behavior to the proposed RTL fetch/decode/execute loop below. That is the fastest way to confirm whether the hardware design still matches the current semantics.

## First Principles

Before writing Verilog, the intern should understand what a VM is in this project.

GNOSIS is not a general-purpose CPU runtime. It is a specialized execution engine for layout evaluation and rendering command emission.

The compiler does the expensive reasoning ahead of time:

- normalizes the node tree
- computes symbolic expressions for layout slots
- folds constants
- decides which values remain dynamic
- emits a compact residual program

The runtime then does only the work that must happen late:

- measure runtime-dependent text
- compute remaining geometry
- emit final draw commands

That split is exactly what makes a hardware implementation plausible. The hardware core does not need a parser, optimizer, or symbolic algebra system. It only needs to execute the residual bytecode machine faithfully.

## What The Current VM Actually Does

The Python interpreter in [vm.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/vm.py#L21) keeps only a few pieces of state:

- `pc`
- `stack`
- `slots`
- `draw_ops`

The execution loop is conceptually:

```text
fetch opcode
decode operands
mutate stack or slots
possibly emit a draw command
advance pc
repeat until HALT
```

The important observation is that the current runtime has no heap, no GC, no call stack, no dynamic code generation, and no dynamic tree construction. That is very favorable for a first Verilog implementation.

### Current opcode classes

The opcode set in [bytecode.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/bytecode.py#L8) naturally falls into four groups:

1. Measure ops
   `MEASURE_TEXT_BIND`

2. Stack and arithmetic ops
   `PUSH_CONST`, `PUSH_SLOT`, `ADD`, `SUB`, `MUL`, `DIV`, `MAX`, `MIN`, `STORE_SLOT`

3. Render ops
   `DRAW_TEXT_CONST`, `DRAW_TEXT_BIND`, `DRAW_BAR_BIND`, `DRAW_BAR_CONST`, `DRAW_HLINE`, `DRAW_VLINE`

4. Control termination
   `HALT`

That suggests a hardware implementation should be designed around phases or opcode classes instead of treating every instruction as unrelated.

## Proposed Hardware Architecture

### Top-level view

```text
                +---------------------------+
                | host / MCU / testbench    |
                | runtime bind values       |
                | text metrics              |
                +-------------+-------------+
                              |
                              v
 +------------------+  +-------------+  +------------------+
 | GNDY ROM / flash |->| VM core     |->| draw command FIFO|
 +------------------+  | pc          |  +---------+--------+
                       | ir          |            |
                       | stack RAM   |            v
                       | slot RAM    |   +------------------+
                       | control FSM |   | vector controller|
                       +------+------+   +------------------+
                              |
                              v
                         status / trace
```

### Internal VM core view

```text
                     +------------------+
                     | fetch/decode FSM |
                     +----+--------+----+
                          |        |
                          v        v
                     +--------+  +--------+
                     | stack  |  | slots  |
                     | RAM    |  | RAM    |
                     +---+----+  +----+---+
                         |            |
                         +-----+------+ 
                               |
                               v
                             +---+
                             |ALU|
                             +---+
```

### Why a multicycle FSM is the right first choice

Do not pipeline this first version.

A simple multicycle controller is better because:

- the instruction count is small
- correctness matters more than throughput
- many ops naturally need multiple steps anyway
- it is much easier to debug in simulation
- the current workload is control-oriented, not throughput-oriented

The first implementation should optimize for observability and semantic fidelity, not performance.

## Program Memory Model

The current `Program` format in [bytecode.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/bytecode.py#L34) has:

- magic
- version
- `node_count`
- `slot_count`
- `bind_count`
- `string_count`
- `code_len`
- bind table
- string table
- initial slot values
- code bytes

That format is acceptable for hardware, but the first prototype should simplify.

### Prototype approach

In the first FPGA prototype:

- hardcode decoded code bytes into ROM
- hardcode slot init into a separate ROM
- ignore bind and string tables at reset
- preload any constants needed for the test program

This removes binary parsing from the critical path of the first experiment.

### Later approach

Once the VM core is stable:

- add a header loader state machine
- parse the container format directly from flash
- copy slot init values into slot RAM at reset
- expose bind and string tables to helper blocks

That is the right time to make the design look more like the current software runtime.

## State Representation

### Slot RAM

The compiler defines six fields per node in [compiler.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/compiler.py#L18):

- `mw`
- `mh`
- `x`
- `y`
- `w`
- `h`

This is ideal for hardware because it is already a flat indexed array.

Recommended first representation:

- 16-bit word width
- address = `node_id * 6 + field_index`
- synchronous block RAM if available

### Stack RAM

The current Python VM uses an unbounded list, but the compiled programs are small enough that a fixed stack is reasonable for a prototype.

Recommended first representation:

- 16-bit entries
- depth 32 or 64
- stack pointer register `sp`
- optional underflow/overflow flags for debug

### Program counter and instruction register

- `pc`: byte address into code ROM
- `ir`: current opcode byte
- operand latches: `op_a`, `op_b`, `imm16`, `node_id`, `color`, and so on as needed

## Execution Strategy

### Software view

The Python interpreter looks roughly like this:

```python
while pc < len(code):
    op = code[pc]
    pc += 1
    ...
```

### RTL view

In hardware, expand that into explicit states:

```text
RESET
LOAD_SLOT_INIT
FETCH
DECODE
EXEC_*
FETCH
...
HALT
```

### Pseudocode for the control loop

```text
on reset:
    pc <- code_base
    sp <- 0
    clear draw fifo state
    load slot init into slot RAM
    state <- FETCH

FETCH:
    ir <- code_rom[pc]
    pc <- pc + 1
    state <- DECODE

DECODE:
    case ir of
        MEASURE_TEXT_BIND: state <- EXEC_MEASURE_0
        PUSH_CONST:        state <- EXEC_PUSH_CONST_0
        PUSH_SLOT:         state <- EXEC_PUSH_SLOT_0
        ADD:               state <- EXEC_ADD_0
        SUB:               state <- EXEC_SUB_0
        MUL:               state <- EXEC_MUL_0
        DIV:               state <- EXEC_DIV_0
        MAX:               state <- EXEC_MAX_0
        MIN:               state <- EXEC_MIN_0
        STORE_SLOT:        state <- EXEC_STORE_SLOT_0
        DRAW_TEXT_CONST:   state <- EXEC_DRAW_TEXT_CONST_0
        DRAW_TEXT_BIND:    state <- EXEC_DRAW_TEXT_BIND_0
        DRAW_BAR_BIND:     state <- EXEC_DRAW_BAR_BIND_0
        DRAW_BAR_CONST:    state <- EXEC_DRAW_BAR_CONST_0
        DRAW_HLINE:        state <- EXEC_DRAW_HLINE_0
        DRAW_VLINE:        state <- EXEC_DRAW_VLINE_0
        HALT:              state <- HALT
```

## Opcode Implementation Strategy

The cleanest way to build this is by opcode family.

### Family 1: Arithmetic and slot ops

These are the easiest because they are local to the core.

#### `PUSH_CONST`

Behavior in software:

- read `u16`
- push it onto the stack

RTL sketch:

```text
EXEC_PUSH_CONST_0:
    imm16_hi <- code_rom[pc]
    pc <- pc + 1
    state <- EXEC_PUSH_CONST_1

EXEC_PUSH_CONST_1:
    imm16_lo <- code_rom[pc]
    pc <- pc + 1
    state <- EXEC_PUSH_CONST_2

EXEC_PUSH_CONST_2:
    stack[sp] <- {imm16_hi, imm16_lo}
    sp <- sp + 1
    state <- FETCH
```

#### `PUSH_SLOT`

Behavior in software:

- read slot index
- push slot value

RTL sketch:

```text
EXEC_PUSH_SLOT_0:
    slot_idx_hi <- code_rom[pc]
    pc <- pc + 1
    state <- EXEC_PUSH_SLOT_1

EXEC_PUSH_SLOT_1:
    slot_idx_lo <- code_rom[pc]
    pc <- pc + 1
    state <- EXEC_PUSH_SLOT_2

EXEC_PUSH_SLOT_2:
    addr <- {slot_idx_hi, slot_idx_lo}
    state <- EXEC_PUSH_SLOT_3

EXEC_PUSH_SLOT_3:
    stack[sp] <- slot_ram[addr]
    sp <- sp + 1
    state <- FETCH
```

#### `ADD`, `SUB`, `MUL`, `MAX`, `MIN`

These can all share the same pattern:

- read top two stack values
- run ALU op
- write result back to `sp - 2`
- decrement `sp`

Example for `ADD`:

```text
EXEC_ADD_0:
    a <- stack[sp - 2]
    b <- stack[sp - 1]
    state <- EXEC_ADD_1

EXEC_ADD_1:
    stack[sp - 2] <- a + b
    sp <- sp - 1
    state <- FETCH
```

#### `DIV`

Must preserve current software semantics in [vm.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/vm.py#L51):

- division by zero yields `0`

That detail matters because changing it would make hardware results diverge from the current VM and debugger.

#### `STORE_SLOT`

Behavior in software:

- read slot index
- pop stack top
- clamp to `u16`
- write to slot RAM

In Verilog, the clamp can be:

- `0` if negative values are represented and the result is below zero
- `65535` if above range
- unchanged otherwise

If the implementation uses unsigned-only datapaths in the first prototype, document the simplification clearly and keep tests limited to non-negative ranges.

### Family 2: Measure op

#### `MEASURE_TEXT_BIND`

This is the first opcode that needs external help.

Software behavior in [vm.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/vm.py#L31):

- resolve bind path to a runtime value
- stringify it
- compute width from text length, glyph width, and size
- write `mw`
- write `mh`

For hardware, there are three progressively better options.

Option A: stub with host-supplied measured width

- VM sends `bind_id` and `size`
- host returns `measured_w` and `measured_h`

Option B: host returns string length only

- VM computes `length * glyph_w * size`
- works if using fixed-width font assumptions

Option C: dedicated text metrics engine

- best long-term option
- overkill for first prototype

Recommended first prototype: Option B.

That matches the current fixed-width assumptions in the Python runtime closely enough for a serious experiment.

### Family 3: Draw ops

These should not directly manipulate the graphics hardware. They should emit normalized commands into a FIFO.

#### Proposed command types

```text
CMD_LINE
CMD_RECT
CMD_TEXT
CMD_FRAME_DONE
```

#### Suggested packed payloads

```text
CMD_LINE:
  x0, y0, x1, y1, color

CMD_RECT:
  x, y, w, h, color, filled

CMD_TEXT:
  x, y, w, h, size, color, source_kind, string_or_bind_id

CMD_FRAME_DONE:
  no payload
```

#### `DRAW_HLINE`

Software behavior:

- load node `x`, `y`, `w`
- emit hline op

Hardware behavior:

- read slots
- convert to line endpoints
- push `CMD_LINE`

Pseudocode:

```text
line.x0 = slot(node.x)
line.y0 = slot(node.y)
line.x1 = slot(node.x) + slot(node.w)
line.y1 = slot(node.y)
line.color = color
fifo.push(line)
```

#### `DRAW_VLINE`

Same idea:

```text
line.x0 = slot(node.x)
line.y0 = slot(node.y)
line.x1 = slot(node.x)
line.y1 = slot(node.y) + slot(node.h)
line.color = color
fifo.push(line)
```

#### `DRAW_BAR_CONST` and `DRAW_BAR_BIND`

The software VM computes `fill_w` from value, max, and width in [vm.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/vm.py#L136).

Hardware should do the same:

- read node geometry from slots
- obtain numeric value
- compute clamped fraction
- compute fill width
- emit one or two rectangle commands

Recommended normalized output:

- track rectangle
- fill rectangle

#### `DRAW_TEXT_CONST` and `DRAW_TEXT_BIND`

Text is the hardest part of this design.

There are two reasonable first-stage approaches.

Approach A: emit a high-level text command

- the VM does not rasterize text
- the text engine later resolves the string or bind
- the VM only provides geometry and style

Approach B: omit text rendering in the first FPGA experiment

- still implement `MEASURE_TEXT_BIND`
- emit debug placeholders instead of actual glyph rendering

Recommended first serious implementation: Approach A.

That keeps the VM honest while avoiding glyph-generation complexity inside the control core.

## Bind Resolution Interface

The software runtime resolves binds by path at runtime in [vm.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/vm.py#L156). Hardware should not perform string path lookup itself.

Instead, the compiler’s bind table index should become the hardware runtime interface.

### Proposed handshake

```text
vm_bind_req_valid
vm_bind_req_kind     // text_length, numeric_value, or text_handle
vm_bind_req_bind_id
vm_bind_req_size

host_bind_rsp_valid
host_bind_rsp_value
host_bind_rsp_aux
```

Examples:

- `MEASURE_TEXT_BIND` asks for `text_length`
- `DRAW_BAR_BIND` asks for `numeric_value`
- `DRAW_TEXT_BIND` asks for `text_handle` or leaves resolution to the text engine

This design keeps the VM small and avoids embedding dynamic data structures in RTL.

## Text Rendering Strategy

The intern should treat text separately from lines and rectangles.

### Why text is harder

Text rendering requires:

- string storage or host access
- glyph lookup
- scale handling
- stroke or bitmap rendering

None of that belongs in the first version of the VM core.

### Recommended layering

```text
GNOSIS VM --> CMD_TEXT --> text engine --> vector glyph renderer
```

Possible `CMD_TEXT` fields:

- `x`
- `y`
- `w`
- `h`
- `size`
- `color`
- `source_kind` = const string id or bind id
- `source_id`

That keeps the control core generic and lets the text subsystem evolve independently.

## Microcoded Variant

The simplest first implementation is a hardwired FSM. But this VM is also a strong candidate for a microcoded engine.

### Why microcode might be attractive

- many instructions need several ordered micro-steps
- the instruction set may grow
- a microcoded engine is easier to modify than a large hardwired controller
- it reflects the layered-machine idea discussed in the reading guide

### Microcoded structure

```text
bytecode ROM --> bc_pc --> opcode latch --> dispatch ROM --> microcode entry
                                                   |
                                                   v
                                           control store ROM
                                                   |
                                                   v
                                            datapath controls
```

### Example micro-steps for `ADD`

```text
u0: read stack[sp-2] into A
u1: read stack[sp-1] into B
u2: ALU = A + B
u3: write ALU to stack[sp-2]
u4: sp = sp - 1
u5: goto FETCH
```

### Recommendation

Do not start with the microcoded version.

Build the hardwired multicycle controller first. Once the semantics are stable, the microcoded version becomes a valuable second experiment.

## Suggested Verilog Module Breakdown

### Minimal module set

```text
gndy_program_rom
slot_init_rom
gnosis_vm_core
gnosis_alu
gnosis_stack_ram
gnosis_slot_ram
gnosis_bind_resolver_if
gnosis_draw_fifo
vector_cmd_adapter
```

### Core ports sketch

```text
module gnosis_vm_core (
    input  wire        clk,
    input  wire        rst,

    output wire [31:0] trace_pc,
    output wire [7:0]  trace_ir,
    output wire [15:0] trace_sp,
    output wire [15:0] trace_top,
    output wire        halted,

    output wire        bind_req_valid,
    output wire [1:0]  bind_req_kind,
    output wire [15:0] bind_req_id,
    input  wire        bind_rsp_valid,
    input  wire [31:0] bind_rsp_value,

    output wire        draw_cmd_valid,
    output wire [3:0]  draw_cmd_kind,
    output wire [127:0] draw_cmd_payload,
    input  wire        draw_cmd_ready
);
```

This is not final RTL. It is a sketch of the control boundary the intern should expect.

## Bring-Up Plan

The intern should not try to boot the full real binary format and full text engine on day one.

### Phase 1: Arithmetic-only VM core

Implement:

- ROM fetch
- stack RAM
- slot RAM
- arithmetic ops
- `STORE_SLOT`
- `HALT`

Use a hand-authored ROM program.

Success criteria:

- simulation trace matches expected stack evolution
- slot writes match expected values

### Phase 2: Geometry and line drawing

Add:

- `DRAW_HLINE`
- `DRAW_VLINE`
- draw FIFO

Success criteria:

- expected command sequence appears in FIFO
- line endpoints match slot geometry

### Phase 3: Bars

Add:

- `DRAW_BAR_CONST`
- later `DRAW_BAR_BIND`

Success criteria:

- `fill_w` matches software VM results for the same program and runtime

### Phase 4: Bind interface

Add:

- numeric bind fetch
- text length fetch

Success criteria:

- dynamic slot values match Python VM for the same runtime inputs

### Phase 5: Text path

Add:

- `DRAW_TEXT_CONST`
- `DRAW_TEXT_BIND`
- text command emission

Success criteria:

- emitted text commands match Python draw ops structurally

### Phase 6: Real GNDY container loading

Add:

- header parsing
- slot-init loading from binary
- optional bind/string table support

Success criteria:

- hardware executes the same compiled blob that the software debugger uses

## Verification Plan

The most important habit here is to verify against the current software VM continuously.

### Golden reference

The reference semantics are in [vm.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/vm.py).

Every hardware milestone should be checked against:

- slot values
- line/bar/text command emission
- final halted state

### Recommended test flow

1. Compile a known example in software.
2. Save the code bytes and slot init.
3. Run the Python VM and capture expected slot and draw-op traces.
4. Run the Verilog simulation.
5. Compare traces instruction by instruction or command by command.

### Useful first examples

- `gnosis_dynamic_vm/examples/dynamic_hbox.yaml`
- `gnosis_dynamic_vm/examples/vbox_shrink_wrap.yaml`
- `gnosis_dynamic_vm/examples/sensor_dashboard.yaml`

Start with the smallest one and do not skip trace comparison.

## Risks And Tradeoffs

### Risk 1: Text complexity overwhelms the experiment

Mitigation:

- keep text rendering outside the VM core
- start with text measurement stubs or text command emission only

### Risk 2: Binary parsing distracts from the real challenge

Mitigation:

- start with ROM-initialized code and slot tables
- add full GNDY parsing later

### Risk 3: The VM and renderer get entangled

Mitigation:

- force all rendering through a stable command FIFO
- keep vector generation in a separate block

### Risk 4: Semantic drift from the Python VM

Mitigation:

- use the Python interpreter as the oracle at every stage
- keep division-by-zero, clamping, and geometry math behavior identical

## Intern Checklist

Before writing much RTL, the intern should be able to answer these questions in plain language:

1. What values live in slot RAM?
2. Why does GNOSIS use a residual runtime instead of a full static draw list?
3. Which opcodes need host services?
4. Why should the VM emit draw commands instead of drawing directly?
5. Why is a multicycle FSM the easiest first implementation?
6. Why is text the last thing to implement, not the first?

If those answers are unclear, go back to [gnosis_dynamic_vm/README.md](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/README.md), [compiler.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/compiler.py), [bytecode.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/bytecode.py), and [vm.py](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/vm.py) before proceeding.

## Recommended Next Step If This Becomes Real Work

If this stops being a thought experiment and becomes an actual implementation effort, the first real deliverable should be:

- a very small Verilog simulation project
- one hand-authored program ROM
- one slot RAM
- one draw FIFO
- support for arithmetic ops and line drawing only
- a Python trace comparator

That is the smallest serious prototype that would prove whether the architecture is sound.

## Related

- [02-vm-microcode-and-fpga-reading-guide.md](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/02-vm-microcode-and-fpga-reading-guide.md)
- [01-react-dynamic-vm-debugger-analysis-design-and-implementation-guide.md](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/design-doc/01-react-dynamic-vm-debugger-analysis-design-and-implementation-guide.md)
- [README.md](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/README.md)
- [gnosis_dynamic_vm/README.md](/home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/README.md)
