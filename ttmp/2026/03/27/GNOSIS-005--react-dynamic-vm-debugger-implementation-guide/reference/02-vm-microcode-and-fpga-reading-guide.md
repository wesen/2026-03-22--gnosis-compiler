---
Title: VM, Microcode, and FPGA Reading Guide
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
      Note: High-level orientation to the current dynamic-only product direction
    - Path: web_server.py
      Note: Current backend contract that serves compiled programs and evaluation data to the React workbench
    - Path: gnosis_dynamic_vm/README.md
      Note: Dynamic compiler and VM overview
    - Path: gnosis_dynamic_vm/gnosis_dynamic/compiler.py
      Note: Host-side compiler that lowers YAML into symbolic slots, bytecode, and manifests
    - Path: gnosis_dynamic_vm/gnosis_dynamic/bytecode.py
      Note: GNDY binary format, opcode table, and encoder/decoder helpers
    - Path: gnosis_dynamic_vm/gnosis_dynamic/vm.py
      Note: Python reference VM semantics that the browser debugger mirrors
    - Path: ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/design-doc/01-react-dynamic-vm-debugger-analysis-design-and-implementation-guide.md
      Note: Primary debugger design document that this reading guide complements
ExternalSources:
    - https://craftinginterpreters.com/
    - https://users.ece.cmu.edu/~koopman/stack_computers/index.html
    - https://github.com/olofk/serv
    - https://www.forth.org/cores.html
Summary: Intern-facing reading and project guide for virtual machines, stack machines, microcode, and FPGA implementation work relevant to GNOSIS
LastUpdated: 2026-03-27T17:55:00-04:00
WhatFor: Give a new intern a practical path from the current GNOSIS dynamic VM to deeper VM, microarchitecture, and FPGA study
WhenToUse: Use when onboarding someone who needs to understand how the GNOSIS VM relates to bytecode interpreters, stack machines, microcoded engines, and FPGA/Verilog implementations
---

# VM, Microcode, and FPGA Reading Guide

## Goal

This document gives a new intern a path for getting deep into the topics that sit behind the GNOSIS dynamic VM: bytecode interpreters, stack machines, compiler/runtime boundaries, microcoded execution, and FPGA implementation. It is not just a book list. It explains why each source matters, what to read first, what to skip at the start, how the ideas map onto this repository, and what small projects will force the concepts to stick.

## Context

GNOSIS is now a dynamic-only system. The Python compiler in `gnosis_dynamic_vm/gnosis_dynamic/compiler.py` lowers a YAML layout DSL into a compact GNDY program, the binary format is defined in `gnosis_dynamic_vm/gnosis_dynamic/bytecode.py`, and the reference interpreter lives in `gnosis_dynamic_vm/gnosis_dynamic/vm.py`. The React workbench receives compile results from `web_server.py` and is where the debugger work is being built.

That means the intern does not need a generic education in all of compilers or all of computer architecture before becoming productive. The relevant question is narrower:

- how does a host compiler lower structured input into a compact executable program?
- how does a tiny VM execute that program?
- how would the same execution model look if the VM were implemented in hardware instead of software?
- when is a stack machine the right shape?
- when is microcode a better fit than a direct one-opcode-one-cycle design?

This guide answers those questions with a reading order that stays anchored to the current codebase.

## Quick Reference

| If the intern wants to learn | Start here | Then read | Then build |
| --- | --- | --- | --- |
| Small bytecode VMs and interpreters | `Crafting Interpreters` | `Engineering a Compiler` | Browser or Python toy bytecode VM |
| Stack-machine hardware | `Stack Computers: The New Wave` | `Digital Design and Computer Architecture` | Tiny stack VM in Verilog |
| Bytecode interpreter as hardware control engine | `Digital Design and Computer Architecture` | `Structured Computer Organization` | Microcoded bytecode engine |
| Soft CPUs and FPGA implementation tradeoffs | `Digital Design and Computer Architecture` | `FPGA Prototyping by Verilog Examples` | FPGA prototype with ROM, RAM, stack, and trace outputs |
| Mapping this repo to those ideas | `gnosis_dynamic_vm/README.md` | `gnosis_dynamic_vm/gnosis_dynamic/compiler.py` | Step through GNDY execution in the browser debugger |

Current GNOSIS mental model:

```text
YAML DSL
  |
  v
Python compiler
  - normalize nodes
  - derive symbolic slot expressions
  - fold constants
  - emit GNDY bytecode
  |
  v
Program blob + manifest + slot init + binds + strings
  |
  +--> Python VM evaluates slots and draw ops
  |
  +--> React debugger decodes and steps the same program
  |
  +--> Future MCU / C runtime / hardware experiments can target the same execution model
```

The current GNDY VM is already a small stack machine in software:

- operands are pushed onto a stack
- arithmetic ops consume stack values
- slot values are loaded and stored by index
- draw ops emit structured side effects
- `HALT` terminates execution

That is why stack-machine books and small-VM books are directly relevant here.

## Usage Examples

Use this guide in one of three ways.

### Case 1: The intern needs to contribute to the React debugger now

Read the repo-first section, then read `Crafting Interpreters`, then skim the stack-machine sections in Koopman. The immediate goal is not to build hardware. It is to understand instruction dispatch, stacks, program counters, binary decoding, and state snapshots well enough to work on the TypeScript debugger and browser interpreter.

### Case 2: The intern wants to prototype a stack VM in Verilog

Read Koopman first, then Harris and Harris, then Pong Chu. After that, build a tiny stack machine that supports `PUSH`, arithmetic ops, conditional jump, and `HALT`. Only after that should the intern attempt GNOSIS-like slot loads and draw commands.

### Case 3: The intern wants to explore a hardware bytecode engine

Read Harris and Harris, then Tanenbaum, then return to the GNOSIS bytecode file. The goal is to understand how one visible bytecode instruction can expand into a sequence of lower-level control steps driven by a microinstruction ROM.

## Why This Guide Exists

The danger with this topic is that people either stay too shallow or go too broad.

If they stay too shallow, they know enough to patch debugger UI code but not enough to reason about interpreter correctness, binary layouts, stack effects, or execution traces. That leads to brittle work.

If they go too broad, they disappear into architecture history, advanced compiler theory, or FPGA vendor tooling before they have built anything useful. That also slows the team down.

The right middle ground for GNOSIS is:

- understand the current compiler and VM well enough to reason about execution
- learn one or two strong books that explain why VMs are shaped this way
- build a small machine yourself, in software or RTL, so the abstractions stop being abstract
- come back and apply those ideas to the debugger and future runtime work

## Start With The Repository

Before reading books, the intern should understand what exists here already.

### Core product orientation

- `README.md`
  Explains that the repository is now dynamic-only and that the output of the compiler is a GNDY program instead of a static draw list.
- `gnosis_dynamic_vm/README.md`
  Explains the three-phase execution model: measure runtime intrinsic values, compute residual geometry into slots, then emit draw operations.
- `web_server.py`
  Shows the active product contract. The server compiles YAML, evaluates runtimes, and returns the binary plus disassembly, IR, slot expressions, and evaluations to the browser.

### Core compiler and VM files

- `gnosis_dynamic_vm/gnosis_dynamic/compiler.py`
  This is the host compiler. It normalizes nodes, builds symbolic slot expressions, constant-folds them, determines which slots stay live, then emits bytecode and render ops.
- `gnosis_dynamic_vm/gnosis_dynamic/bytecode.py`
  This defines the opcode set, the `Program` container, the binary layout, and the code emitter. The `Op` enum is the canonical instruction set.
- `gnosis_dynamic_vm/gnosis_dynamic/vm.py`
  This is the semantic oracle. It shows the execution loop, the stack operations, bind resolution, slot writes, and draw-op generation.

### What to notice in those files

In `compiler.py`, the key thing to understand is that GNOSIS is not compiling straight to pixels. It is compiling to a residual program that still does work at runtime. That is the same compiler/runtime split you see in many VM systems.

In `bytecode.py`, notice that the program format has:

- a header with magic and version
- tables for binds and strings
- an initial slot image
- an instruction stream

That is a normal VM shape. It is small, inspectable, and easy to decode in another runtime.

In `vm.py`, notice that the evaluation loop is a classic interpreter loop:

```text
while pc < len(code):
    read opcode
    decode operands
    mutate stack / slots / draw_ops
    advance pc
```

That is the exact execution shape the intern should keep in mind while reading the recommended books.

## Mental Model: How GNOSIS Maps To VM Literature

GNOSIS is not a general-purpose language VM like the JVM or Lua, but it shares several important traits with those systems.

### GNOSIS as a small domain VM

- it has a custom binary format
- it has an explicit opcode set
- it has host-managed runtime data
- it has a stack-based execution model
- it has side-effect instructions that emit render commands

### GNOSIS as a compiler/runtime split

- the expensive symbolic reasoning happens in the host compiler
- the runtime only executes the residual work that must remain dynamic
- static values are folded into slot initialization
- dynamic values are measured or computed at runtime

### GNOSIS as a future hardware candidate

- slot storage maps naturally to RAM
- code maps naturally to ROM or flash
- stack operations map naturally to a tiny datapath
- draw ops can be treated as output commands to a host display layer

That makes GNOSIS a good teaching system for someone who wants to move between software VMs and hardware realizations.

## The Three Learning Tracks

The intern should think in tracks, not in one giant reading list.

### Track 1: VM and interpreter design

This track answers:

- what is a bytecode interpreter?
- how do instruction dispatch loops work?
- why choose a stack VM instead of a register VM?
- how do bytecode programs represent values, locals, and control flow?

This is the right track if the intern is focused on the browser debugger or the Python VM.

### Track 2: Stack machines and microcoded engines

This track answers:

- what does a stack machine look like as an architecture?
- why are stack machines attractive for compact interpreters?
- how can a higher-level opcode expand into multiple lower-level control steps?
- when is microcode useful?

This is the right track if the intern wants to understand how a VM might look as a machine rather than just as software.

### Track 3: FPGA and Verilog implementation

This track answers:

- how do you turn the machine into a real RTL design?
- what datapath and control units are required?
- how do ROM, RAM, stacks, and trace outputs look in HDL?
- how do you prototype and debug the design on FPGA?

This is the right track if the intern wants to build a stack VM or bytecode engine in Verilog.

## Recommended Reading Order

### Path A: Understand small bytecode VMs first

Read in this order:

1. `Crafting Interpreters`
2. `gnosis_dynamic_vm/gnosis_dynamic/vm.py`
3. `gnosis_dynamic_vm/gnosis_dynamic/bytecode.py`
4. `Engineering a Compiler`

Why this order works:

- `Crafting Interpreters` gives the intuition for interpreter loops and bytecode structure.
- The GNOSIS files then feel smaller and easier instead of alien.
- `Engineering a Compiler` adds more formal language about IR, lowering, dataflow, and runtime tradeoffs after the intuition exists.

### Path B: Build a stack VM in Verilog

Read in this order:

1. Philip Koopman, `Stack Computers: The New Wave`
2. Harris and Harris, `Digital Design and Computer Architecture, RISC-V Edition`
3. Pong P. Chu, `FPGA Prototyping by Verilog Examples`
4. James Bowman, `J1: a small Forth CPU core for FPGAs`

Why this order works:

- Koopman gives the architectural mindset.
- Harris and Harris explains datapath and control clearly.
- Pong Chu gets the intern productive in actual Verilog and FPGA workflows.
- J1 shows a real compact stack-oriented hardware design that feels close to a hardware VM.

### Path C: Build a bytecode interpreter as a microcoded engine

Read in this order:

1. Harris and Harris, `Digital Design and Computer Architecture`
2. Tanenbaum, `Structured Computer Organization`
3. Philip Koopman, `Stack Computers: The New Wave`
4. Return to `gnosis_dynamic_vm/gnosis_dynamic/bytecode.py`

Why this order works:

- the intern learns clean datapath and control first
- then learns layered machine design and microprogramming
- then learns why stack-machine bytecode maps naturally to compact hardware execution
- then comes back to the actual GNOSIS instruction set with the right lens

## Book Notes

This section explains what each source is good for and how it relates to GNOSIS.

### `Crafting Interpreters` by Robert Nystrom

Primary use:

- best first book for building intuition about interpreters and bytecode VMs

Why it matters:

- it makes dispatch loops, stacks, values, and runtime data feel concrete
- it is practical instead of academic
- it shows the full stack from parser to VM, which helps the intern understand what the GNOSIS compiler is choosing not to do at runtime

What to extract for GNOSIS:

- the idea of a compact instruction stream
- the role of a disassembler
- stack discipline
- how much debug tooling helps when stepping an interpreter

Read this before:

- any attempt to redesign the browser debugger
- any attempt to port VM logic into TypeScript

Source:

- https://craftinginterpreters.com/

### `Virtual Machines: Versatile Platforms for Systems and Processes`

Primary use:

- conceptual broadening after the intern already understands a small VM

Why it matters:

- it places VMs in a wider systems context instead of treating them as language toys
- it helps the intern reason about portability, isolation, abstraction layers, and system design

What to extract for GNOSIS:

- the idea that a VM is an execution boundary and an abstraction layer
- language for discussing why the GNOSIS compiler and runtime are separated

When to read:

- after `Crafting Interpreters`
- not before the intern has touched the repo

### `Engineering a Compiler`

Primary use:

- learning how compilers organize lowering, optimization, IR design, and runtime contracts

Why it matters:

- GNOSIS is a compiler that performs symbolic rewriting and constant folding before emitting residual bytecode
- this book gives the intern formal vocabulary for that process

What to extract for GNOSIS:

- IR design and lowering
- constant propagation and folding
- live value reasoning
- why compile-time work and runtime work must be partitioned carefully

When to read:

- after the intern can already follow the current compiler pipeline

### `Writing a C Compiler`

Primary use:

- practical backend construction

Why it matters:

- not because GNOSIS is compiling C
- because it shows how a front end connects to a concrete executable backend

What to extract for GNOSIS:

- instruction selection mindset
- backend pragmatism
- test-driven compiler construction

When to read:

- optional, but useful for an intern who wants more backend depth without jumping straight into heavier textbooks

### `Stack Computers: The New Wave` by Philip Koopman

Primary use:

- strongest book for understanding stack-machine architecture

Why it matters:

- GNOSIS bytecode already executes as a stack machine in software
- a future hardware VM for GNOSIS would almost certainly start from stack-machine ideas

What to extract for GNOSIS:

- data stack versus return stack
- zero-operand instruction style
- why stack effects matter
- why stack machines can be compact and elegant

When to read:

- immediately for anyone interested in hardware or VM architecture

Source:

- https://users.ece.cmu.edu/~koopman/stack_computers/index.html

### `Digital Design and Computer Architecture, RISC-V Edition`

Primary use:

- best bridge from software concepts to RTL machine building

Why it matters:

- the intern must understand datapath, control, memories, and sequencing before implementing any VM in Verilog
- even if GNOSIS is not RISC-V, the design method transfers directly

What to extract for GNOSIS:

- fetch, decode, execute structure
- datapath/control decomposition
- state machines
- memory interfaces

When to read:

- before designing a hardware stack VM or microcoded engine

### `Computer Organization and Design, RISC-V Edition`

Primary use:

- broader machine organization and ISA reasoning

Why it matters:

- useful when the intern wants more architectural perspective than raw RTL practice

What to extract for GNOSIS:

- ISA tradeoffs
- machine organization
- execution sequencing
- performance versus simplicity reasoning

### `FPGA Prototyping by Verilog Examples` by Pong P. Chu

Primary use:

- practical HDL and FPGA implementation

Why it matters:

- many interns understand architecture conceptually but fail when they have to actually wire ROMs, RAMs, and control logic
- this book helps close that gap

What to extract for GNOSIS:

- clean RTL module structure
- state-machine implementation
- memory-driven design
- synthesis-friendly Verilog style

When to read:

- while actively building the first hardware prototype

### `Embedded Microprocessor System Design using FPGAs`

Primary use:

- practical soft-processor and embedded-system context

Why it matters:

- helpful when the intern starts thinking beyond the core itself and into system integration on FPGA

What to extract for GNOSIS:

- how a CPU-like engine fits into a wider embedded system
- integration tradeoffs beyond the ALU and stacks

### `Processor Design: System-On-Chip Computing for ASICs and FPGAs`

Primary use:

- broader processor design tradeoffs

Why it matters:

- good for interns who want to move beyond toy RTL and understand reusable design patterns and system-level implications

### `Structured Computer Organization` by Andrew Tanenbaum

Primary use:

- classic mental model for layered machines and microprogramming

Why it matters:

- this is the most directly relevant book for the "microcoded engine interpreting bytecode" idea
- it encourages the intern to think in machine layers instead of treating opcodes as indivisible magic

What to extract for GNOSIS:

- microinstruction sequencing
- control stores
- layered interpretation
- visible machine versus hidden implementation

When to read:

- after basic datapath and control are already familiar

## Non-Book References That Matter

Books are not enough for this topic. The intern should also study a few compact real systems.

### J1 Forth CPU

Why it matters:

- probably the best compact example of a stack-oriented hardware machine that feels close to a VM engine
- useful as a concrete answer to "what would a tiny FPGA-friendly stack machine actually look like?"

What to learn from it:

- instruction encoding
- stack handling
- compact control logic
- how little hardware is needed for a useful machine

### SERV

Why it matters:

- SERV is not a stack VM, but it is a very small soft core and a strong example of aggressively simple CPU design

What to learn from it:

- area-conscious design
- serialized execution tradeoffs
- how far simplicity can be pushed in FPGA-friendly RTL

Source:

- https://github.com/olofk/serv

### Forth CPU cores index

Why it matters:

- it is a good map of stack-oriented hardware designs and adjacent ideas
- useful when the intern wants examples after learning the fundamentals

Source:

- https://www.forth.org/cores.html

## Design Sketches

The intern should be able to picture the relevant machine shapes before trying to build them.

### A software VM like GNOSIS

```text
           +----------------------+
source --> | host compiler        |
           | - symbolic analysis  |
           | - constant folding   |
           | - bytecode emission  |
           +----------+-----------+
                      |
                      v
              +---------------+
              | GNDY program  |
              | binds         |
              | strings       |
              | slot_init     |
              | code          |
              +-------+-------+
                      |
                      v
           +----------------------+
           | interpreter          |
           | pc                   |
           | stack                |
           | slots                |
           | draw_ops             |
           +----------------------+
```

### A stack VM in Verilog

```text
                +-------------------+
                | instruction ROM   |
                +---------+---------+
                          |
                          v
pc -----> fetch -----> instruction register
                          |
                          v
                +-------------------+
                | control / decode  |
                +----+---------+----+
                     |         |
                     v         v
               +---------+   +-----------+
               | ALU     |   | data RAM  |
               +----+----+   +-----------+
                    |
         +----------+----------+
         |                     |
         v                     v
   data stack RAM         return stack RAM
```

### A microcoded bytecode engine

```text
bytecode ROM --> bytecode pc --> opcode latch --> dispatch ROM --+
                                                                  |
                                                                  v
                                                          microcode start
                                                                  |
                                                                  v
control store ROM --> micro-pc --> control word --> datapath controls
                                                |
                                                +--> stack read/write
                                                +--> ALU op
                                                +--> slot RAM access
                                                +--> bytecode pc update
```

## Build Sequence 1: Tiny Stack VM In Verilog

This is the recommended first hardware project.

### Minimal instruction set

Start with:

- `PUSH imm`
- `ADD`
- `SUB`
- `DUP`
- `DROP`
- `SWAP`
- `JMP`
- `JZ`
- `HALT`

Do not add function calls, draw ops, or complicated memory on day one.

### Minimal hardware blocks

- `pc`
- instruction ROM
- data stack RAM and stack pointer
- simple ALU
- control FSM
- optional debug outputs: `pc`, opcode, top of stack

### Why this first

This machine is small enough that the intern can understand the whole thing at once. That matters more than feature count. The first goal is to internalize stack effects and control sequencing.

### Example execution shape

```text
PUSH 3
PUSH 4
ADD
HALT
```

State evolution:

- stack = `[]`
- after `PUSH 3`: `[3]`
- after `PUSH 4`: `[3, 4]`
- after `ADD`: `[7]`
- after `HALT`: done

### First extension after the minimal core

Add:

- `CALL`
- `RET`
- return stack
- `LOAD`
- `STORE`

After that, the machine begins to look like a true VM rather than just a teaching ALU.

## Build Sequence 2: Microcoded Bytecode Engine

This is the right second hardware project if the intern specifically wants to explore microcode.

### Bytecode ISA

Start with:

- `PUSH_CONST k`
- `ADD`
- `SUB`
- `LOAD_LOCAL i`
- `STORE_LOCAL i`
- `JUMP addr`
- `JUMP_IF_ZERO addr`
- `CALL addr`
- `RET`
- `HALT`

### Microcode idea

Each bytecode is not executed directly by custom hardwired logic. Instead:

- the bytecode opcode indexes a dispatch table
- the dispatch table yields a microcode entry address
- the microcode engine steps through one or more control words
- those control words manipulate the datapath

### Example micro-steps

`ADD` could look like this:

```text
u0: read TOS and NOS into ALU inputs
u1: perform add
u2: write result back to NOS
u3: decrement stack pointer
u4: return to bytecode fetch
```

`PUSH_CONST k` could look like this:

```text
u0: fetch immediate byte
u1: increment stack pointer
u2: write immediate to TOS
u3: advance bytecode pc
u4: return to fetch
```

### Minimal hardware blocks

- bytecode ROM
- bytecode PC
- micro-PC
- dispatch ROM
- control store ROM
- stack or register file
- ALU
- local variable RAM

### Why this is worth building

This teaches the intern the difference between a visible instruction set and the hidden control mechanism that realizes it. That is a fundamental systems idea and maps directly onto the "VM inside another machine" mindset.

## Suggested Project Ladder For An Intern

The intern should not attempt all of this at once. A staged ladder works better.

### Stage 1: Read the GNOSIS VM code carefully

Deliverable:

- explain the meaning of every opcode in `gnosis_dynamic_vm/gnosis_dynamic/bytecode.py`
- explain the execution loop in `gnosis_dynamic_vm/gnosis_dynamic/vm.py`
- explain how `compiler.py` decides what work remains dynamic

### Stage 2: Build a toy software VM

Deliverable:

- a tiny interpreter in Python or TypeScript
- 8 to 10 opcodes
- disassembler output
- stack trace after each step

Why this matters:

- it removes fear of bytecode systems quickly
- it makes later hardware work much easier

### Stage 3: Build a tiny stack machine in Verilog

Deliverable:

- instruction ROM
- stack
- ALU
- branches
- simulation traces

### Stage 4: Add one GNOSIS-like feature

Pick one:

- slot RAM with indexed load/store
- simple draw command FIFO
- text measurement stub

The point is not fidelity. The point is mapping an abstract GNOSIS VM idea onto hardware structure.

### Stage 5: Try the microcoded version

Deliverable:

- dispatch ROM
- microcode ROM
- visible bytecode execution trace
- micro-step trace

This is where the layered-machine mental model becomes real.

## Pseudocode References

### GNOSIS-style interpreter loop

```python
pc = 0
stack = []
slots = slot_init.copy()
draw_ops = []

while pc < len(code):
    op = code[pc]
    pc += 1

    if op == PUSH_CONST:
        stack.append(read_u16(code, pc))
        pc += 2
    elif op == PUSH_SLOT:
        idx = read_u16(code, pc)
        pc += 2
        stack.append(slots[idx])
    elif op == ADD:
        rhs = stack.pop()
        lhs = stack.pop()
        stack.append(lhs + rhs)
    elif op == STORE_SLOT:
        idx = read_u16(code, pc)
        pc += 2
        slots[idx] = clamp(stack.pop())
    elif op == HALT:
        break
```

### Verilog-oriented stack machine control sketch

```text
state FETCH:
    ir <= rom[pc]
    pc <= pc + 1
    state <= DECODE

state DECODE:
    case ir.opcode
        PUSH: state <= EXEC_PUSH
        ADD:  state <= EXEC_ADD
        JZ:   state <= EXEC_JZ
        HALT: state <= STOP
    endcase

state EXEC_ADD:
    stack[sp-1] <= stack[sp-1] + stack[sp]
    sp <= sp - 1
    state <= FETCH
```

### Microcoded control sketch

```text
FETCH_BYTECODE:
    ir <- bytecode[bc_pc]
    bc_pc <- bc_pc + 1
    u_pc <- dispatch[ir]

MICROSTEP:
    control <- control_store[u_pc]
    execute(control)
    if control.end_of_bytecode:
        goto FETCH_BYTECODE
    else:
        u_pc <- control.next
```

## What Not To Do First

The intern should avoid the following traps.

### Trap 1: Starting with a full CPU book and no implementation

That usually produces vague understanding with no practical grip on the machine.

### Trap 2: Jumping straight into FPGA vendor tooling

Until the core machine model is clear, synthesis tools and board setup are mostly noise.

### Trap 3: Trying to build the final GNOSIS runtime immediately

That is too much scope. The intern should first build a tiny version that proves:

- instruction fetch works
- the stack behaves correctly
- branches work
- traces are understandable

### Trap 4: Treating microcode as mandatory

Microcode is a useful design option, not the only serious way to build a bytecode engine. The intern should understand both hardwired and microcoded control.

## Recommended Study Plan

This is a pragmatic six-step plan.

1. Read `README.md` and `gnosis_dynamic_vm/README.md`.
2. Read `gnosis_dynamic_vm/gnosis_dynamic/bytecode.py` and write down every opcode and operand width.
3. Read `gnosis_dynamic_vm/gnosis_dynamic/vm.py` and trace one sample execution by hand.
4. Read `Crafting Interpreters` or Koopman first, depending on whether the intern is focused on software or hardware.
5. Build one tiny machine yourself.
6. Return to GNOSIS and explain how the ideas map back onto the existing compiler and debugger.

If the intern cannot explain the current GNOSIS VM in plain language after step 3, they should not jump ahead to FPGA work yet.

## Source List

Books and primary references mentioned in this guide:

- Robert Nystrom, `Crafting Interpreters`
- James E. Smith and Ravi Nair, `Virtual Machines: Versatile Platforms for Systems and Processes`
- Keith Cooper and Linda Torczon, `Engineering a Compiler`
- Nora Sandler, `Writing a C Compiler`
- Philip J. Koopman Jr., `Stack Computers: The New Wave`
- Sarah Harris and David Harris, `Digital Design and Computer Architecture, RISC-V Edition`
- David Patterson and John Hennessy, `Computer Organization and Design, RISC-V Edition`
- Pong P. Chu, `FPGA Prototyping by Verilog Examples`
- Uwe Meyer-Baese, `Embedded Microprocessor System Design using FPGAs`
- Jari Nurmi, ed., `Processor Design: System-On-Chip Computing for ASICs and FPGAs`
- Andrew S. Tanenbaum, `Structured Computer Organization`

Online references mentioned in this guide:

- `Crafting Interpreters` website: https://craftinginterpreters.com/
- Koopman stack computers page: https://users.ece.cmu.edu/~koopman/stack_computers/index.html
- SERV repository: https://github.com/olofk/serv
- Forth CPU cores index: https://www.forth.org/cores.html

## Related

- `design-doc/01-react-dynamic-vm-debugger-analysis-design-and-implementation-guide.md`
- `reference/01-investigation-diary.md`
- `README.md`
- `gnosis_dynamic_vm/README.md`
