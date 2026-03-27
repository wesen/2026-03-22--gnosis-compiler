# Changelog

## 2026-03-27

- Initial workspace created
- Primary React debugger design and implementation guide drafted
- Investigation diary drafted
- Ticket index and task checklist updated for validation and delivery
- `docmgr doctor --ticket GNOSIS-005 --stale-after 30` passed cleanly
- reMarkable bundle uploaded and verified at `/ai/2026/03/27/GNOSIS-005`
- Static compiler, static examples, and legacy static frontend paths removed from the repo
- Backend API and React app collapsed to a dynamic-only architecture
- GNOSIS-005 design plan rewritten around the new dynamic-only baseline
- VM, microcode, and FPGA reading guide added for intern onboarding and deeper systems study
- Verilog/vector-controller VM experiment note added to preserve the hardware implementation direction

## 2026-03-27

Write the React debugger intern-facing analysis, design, and implementation guide

### Related Files

- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/design-doc/01-react-dynamic-vm-debugger-analysis-design-and-implementation-guide.md — Primary ticket deliverable
- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/01-investigation-diary.md — Delivery diary for the investigation and writeup

## 2026-03-27

Step 3: Implement browser-side GNDY decoder, interpreter, step debugger, Redux slice, and three inspector panels (Debugger, Slots, Stack). Oracle validation passes against Python backend.

### Related Files

- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/web/src/components/Canvas/Canvas.tsx — Canvas updated for debugger draw-op rendering
- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/web/src/components/Inspector/panels/DebuggerPanel.tsx — Debugger panel
- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/web/src/components/Inspector/panels/SlotsPanel.tsx — Slots panel
- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/web/src/components/Inspector/panels/StackPanel.tsx — Stack panel
- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/web/src/components/Inspector/registerPanels.ts — Registered Debugger
- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/web/src/engine/gndy/debugger.ts — Step debugger
- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/web/src/engine/gndy/decode.ts — GNDY binary decoder
- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/web/src/engine/gndy/interpreter.ts — GNDY interpreter
- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/web/src/store/index.ts — Store wired with debugger reducer
- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/web/src/store/slices/debuggerSlice.ts — Debugger Redux slice

## 2026-03-27

Step 4: Add a VM, microcode, and FPGA reading guide for intern onboarding and deeper systems study.

### Related Files

- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/02-vm-microcode-and-fpga-reading-guide.md — New intern-facing reading and project guide
- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/index.md — Ticket index updated with the new reference
- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/01-investigation-diary.md — Diary updated to record the new reference work

## 2026-03-27

Step 5: Add a detailed experiment note for implementing the current GNOSIS VM in Verilog as a vector-graphics control core.

### Related Files

- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/04-experiment-verilog-gnosis-vm-for-vector-graphics-control.md — Detailed hardware experiment note
- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/bytecode.py — Opcode set and binary format referenced by the experiment
- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/gnosis_dynamic/vm.py — Reference runtime semantics the experiment preserves


## 2026-03-27

Added design doc 02: Multi-Pane Debugger and Interactive VM Explorer Design. Covers multi-pane layout (disasm+slots+stack+canvas visible simultaneously), connected highlighting across panes, 4 interaction walkthroughs, and 7 Bret Victor-style interactive article screens for teaching the VM.

### Related Files

- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/design-doc/02-multi-pane-debugger-and-interactive-vm-explorer-design.md — New design doc

## 2026-03-27

Added handoff doc 03: implementation instructions for the next UX designer covering docmgr workflow, reading order, open tasks, key files, skills, and gotchas.

### Related Files

- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/03-handoff-multi-pane-debugger-implementation-instructions.md — Handoff instructions
