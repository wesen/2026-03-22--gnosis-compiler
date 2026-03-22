---
Title: Diary
Ticket: GNOSIS-002
Status: active
Topics:
    - compiler
    - dynamic-vm
    - webui
    - step-debugging
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/bytecode.py
    - /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/compiler.py
    - /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/vm.py
    - /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/expr.py
    - /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/c_runtime/gnosis_vm.h
    - /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/c_runtime/gnosis_vm.c
ExternalSources: []
Summary: Research diary for dynamic VM integration
LastUpdated: 2026-03-22T16:19:55.880070862-04:00
WhatFor: ""
WhenToUse: ""
---

# Diary

## Goal

Research and analyze the GNOSIS Dynamic VM (`gnosis_dynamic_vm.zip`), understand how it differs from the static compiler, and produce a detailed integration design for adding it to the debug web UI — including step-through debugging of the stack machine.

## Step 1: Codebase analysis and design document

Unpacked and read every file in `gnosis_dynamic_vm.zip`. The dynamic VM is a fundamentally different compilation model from the static GNBC compiler: instead of producing a flat draw list with baked-in pixel positions, it produces a residual layout program — bytecode that measures runtime text, evaluates symbolic layout expressions on a stack machine, and then draws. The slot system (6 fields per node: mw, mh, x, y, w, h) is the central abstraction, and the compiler's binding-time analysis determines which slots are constants (folded into a slot_init table) and which require runtime computation.

The key insight for the web UI integration is the three-phase execution model: MEASURE first, then COMPUTE (stack machine), then RENDER. This structure maps directly to a step debugger — the UI can show which phase the PC is in and annotate transitions. The comparison feature (same program, two runtimes) demonstrates the reflow capability that motivates the entire dynamic VM.

### Prompt Context

**User prompt (verbatim):** "Let's look at ~/Downloads/gnosis_dynamic_vm.zip which is a dynamic version of the VM we have. I would like you to create a new docmgr ticket where you research and analyze how we can integrate the debug UI and the dynamic VM so that we can compile the new version, and potentially step debug or so the program."

**Assistant interpretation:** Unpack and analyze the dynamic VM codebase, create a docmgr ticket with a detailed design document for integrating it with the existing web UI, including step debugging.

**Inferred user intent:** Understand the dynamic VM, have a clear plan for adding it to the web experimentation tool, and potentially use the web UI to step-debug GNDY programs.

### What I did
- Unpacked `gnosis_dynamic_vm.zip` and read all 15+ source files line by line
- Read the Python compiler (9-stage pipeline), reference VM (stack machine), expression system (constant folding), and C runtime
- Read both example programs (dynamic_hbox, vbox_shrink_wrap) and all output artifacts (disasm, IR, manifests, eval JSONs)
- Created docmgr ticket GNOSIS-002 with diary and design doc
- Wrote a comprehensive 19-section design/implementation guide covering:
  - Full analysis of the dynamic VM architecture
  - Comparison with the static compiler (GNBC vs GNDY)
  - The slot system, expression system, and constant folding
  - All 17 opcodes with byte-level encoding
  - Worked example (dynamic_hbox) showing symbolic IR → bytecode → two evaluations
  - Concrete API design for `/api/compile-dynamic`
  - JavaScript GNDY interpreter pseudocode
  - Step debugger class design (step/run/reset/back with snapshot history)
  - Step debugger UI wireframe (disassembly with PC arrow, slot table, stack view, phase indicator)
  - Side-by-side comparison view design
  - 4-phase implementation roadmap

### Why
- The dynamic VM is a fundamentally different system that needs to be understood before any integration work
- A step debugger is the most valuable feature because the stack machine's behavior is non-obvious from reading bytecode

### What worked
- The dynamic VM codebase is very cleanly structured — each file has a single responsibility
- The example output artifacts (IR, disasm, eval JSON) are excellent for understanding the compiler's behavior
- The three-phase execution model maps cleanly to a debugger UI

### What didn't work
- N/A — this was a research and design step, no code written

### What I learned
- GNDY uses **big-endian** encoding, while GNBC uses little-endian. The JS interpreter must use different byte reading functions.
- The dynamic compiler does dead slot elimination — parent container slots that are only intermediates get removed. This means the slot buffer can have "holes" (unused slots left at their init values).
- The `grow` property in hbox/vbox enables flex-like expansion, which doesn't exist in the static compiler.
- The compiler's constant reassociation (flattening nested additions to aggregate constants) is surprisingly effective — it can turn `(0 + 0 + 8 + s18 + 2)` into `(s18 + 10)` with a single ADD instruction.

### What was tricky to build
- Understanding the binding-time analysis: which slots become compile-time constants vs. runtime expressions. The key rule is that a label with `bind` but no `field_w` causes its `mw` to be a dynamic `SlotRef` that propagates through all parent/sibling position expressions.
- The dead slot elimination is a backward dataflow analysis — you start from render ops and chase dependencies backward. Slots not reachable from any render op are dead.

### What warrants a second pair of eyes
- The step debugger design: should stepping be client-side (JS) or server-side (Python)? Client-side is faster but means reimplementing the VM in JS. Server-side is simpler but has network latency per step. **Recommendation: client-side JS for the debugger, server-side Python for bulk evaluation.**
- The binary format difference: GNDY is big-endian, GNBC is little-endian. This is a gotcha that will cause subtle bugs if mixed up.

### What should be done in the future
- Implement the integration following the 4-phase roadmap in the design doc
- Consider adding expression-level debugging (show which sub-expression is being evaluated within a STORE_SLOT)
- Consider adding dirty region analysis to the dynamic VM (currently the dynamic VM has no refresh region concept — it redraws everything)

### Code review instructions
- Read the design doc: `ttmp/2026/03/22/GNOSIS-002--dynamic-vm-integration-with-debug-web-ui/design-doc/01-dynamic-vm-integration-analysis-design-and-implementation-guide.md`
- Key sections: 8 (opcode table), 13 (worked example), 15 (step debugger design)
- Cross-reference against source: `gnosis_dynamic_vm/gnosis_dynamic/vm.py` is the reference implementation

### Technical details
- Dynamic VM source: `gnosis_dynamic_vm/` (copied from `~/Downloads/gnosis_dynamic_vm.zip`)
- 17 opcodes (vs 12 in static): adds MEASURE_TEXT_BIND, PUSH_CONST, PUSH_SLOT, ADD/SUB/MUL/DIV/MAX/MIN, STORE_SLOT
- Slot buffer: node_count * 6 * sizeof(uint16_t) bytes
- Stack: 64 elements max (fixed in C runtime, dynamic in Python)
- Binary format: GNDY, big-endian, header 17 bytes
