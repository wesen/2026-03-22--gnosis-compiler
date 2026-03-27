---
Title: Investigation diary
Ticket: GNOSIS-005
Status: active
Topics:
    - compiler
    - dynamic-vm
    - webui
    - react
    - redux
    - debugger
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: gnosis_dynamic_vm/gnosis_dynamic/vm.py
      Note: |-
        Python evaluator used as the semantic oracle for the proposed browser debugger
        Python oracle reviewed during debugger architecture planning
    - Path: ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/design-doc/01-react-dynamic-vm-debugger-analysis-design-and-implementation-guide.md
      Note: |-
        Primary deliverable produced from this investigation
        Primary deliverable recorded in the diary
    - Path: web/src/components/Canvas/Canvas.tsx
      Note: |-
        Static-only renderer identified as a key gap
        Static-only renderer called out as a key implementation gap
    - Path: web/src/components/Inspector/panels/DebuggerPanel.tsx
      Note: Main debugger panel with step controls and inline disassembly
    - Path: web/src/components/Inspector/panels/SlotsPanel.tsx
      Note: Slot grid panel with change highlighting from debugger
    - Path: web/src/components/Inspector/panels/StackPanel.tsx
      Note: VM stack display during stepping
    - Path: web/src/engine/gndy/debugger.ts
      Note: Step debugger with snapshots
    - Path: web/src/engine/gndy/decode.ts
      Note: GNDY binary decoder - parses program format and decodes all 17 opcodes
    - Path: web/src/engine/gndy/interpreter.ts
      Note: GNDY interpreter mirroring Python VM - evaluate() produces identical results
    - Path: web/src/store/slices/debuggerSlice.ts
      Note: Redux slice for debugger state (snapshot
    - Path: web/src/store/slices/dynamicSlice.ts
      Note: |-
        Existing dynamic-mode state surface inspected during analysis
        Current dynamic state surface reviewed during analysis
    - Path: ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/02-vm-microcode-and-fpga-reading-guide.md
      Note: Intern-facing reading guide for deeper VM, microcode, and FPGA study
    - Path: ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/04-experiment-verilog-gnosis-vm-for-vector-graphics-control.md
      Note: Detailed experiment note for a Verilog implementation of the current VM
    - Path: web_server.py
      Note: |-
        Backend compile and compile-dynamic contracts inspected for debugger integration
        Backend contract reviewed while producing the design
ExternalSources: []
Summary: Chronological diary for the GNOSIS-005 debugger design ticket
LastUpdated: 2026-03-27T18:05:00-04:00
WhatFor: Record the investigation and delivery process for the React dynamic VM debugger design package
WhenToUse: Use when reviewing how the GNOSIS-005 analysis was gathered, written, validated, and delivered
---



# Diary

## Goal

This diary records how the GNOSIS-005 ticket was created, how evidence was gathered from the current compiler and React workbench, why the recommended debugger architecture was chosen, and how the final document bundle was validated and delivered.

## Step 1: Create The Ticket And Write The Intern Guide

The goal of this step was to create a new ticket specifically for the React debugger rather than continuing to overload the prior dynamic UI handoff tickets. The design work needed to be concrete enough for a new intern to pick up, so I treated the task as an evidence-first architecture package rather than a short status note.

The key implementation choice was to keep the scope focused on the debugger product rather than reopening the earlier question of porting the compiler to TypeScript. The repository evidence still points toward Python remaining the authoritative compiler while the browser owns interpretation and debugging. That allowed the guide to stay pragmatic: extend the current React workbench, mirror the Python VM in TypeScript, and use Redux to coordinate debugger state.

### Prompt Context

**User prompt (verbatim):** "ok, that makes total sense. Make a new ticket to create the react debugger. Analyze the whole problem, describe the functionality and implementation, and then do ASCII screenshot designs for the different screens, and list the redux actions or how this would work under the screens too.

Create a detailed analysis / design / implementation guide that is very detailed for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file
  references.
  It should be very clear and detailed. Store in the ticket and the nupload to remarkable."

**Assistant interpretation:** Create a brand new GNOSIS ticket for the React dynamic VM debugger, gather file-backed evidence from the repository, write an intern-ready design and implementation guide with ASCII UI layouts and Redux action/state details, keep ticket bookkeeping up to date, and upload the final docs bundle to reMarkable.

**Inferred user intent:** Produce a standalone onboarding package that a new engineer can use to implement the debugger without needing to reconstruct the system architecture from scratch.

**Commit (code):** N/A

### What I did

- Created ticket `GNOSIS-005` with `docmgr ticket create-ticket --ticket GNOSIS-005 --title "React Dynamic VM Debugger Implementation Guide" --topics compiler,dynamic-vm,webui,react,redux,debugger`.
- Added the primary design document with `docmgr doc add --ticket GNOSIS-005 --doc-type design-doc --title "React Dynamic VM Debugger Analysis, Design, and Implementation Guide"`.
- Added the diary document with `docmgr doc add --ticket GNOSIS-005 --doc-type reference --title "Investigation diary"`.
- Inspected the current static compiler pipeline, React shell, dynamic slice, panel registry, backend endpoints, dynamic VM README, Python VM, and existing GNOSIS-002 / GNOSIS-003 debugger design materials.
- Wrote the primary design document with sections for system orientation, current-state evidence, gap analysis, proposed architecture, backend API contract, Redux model, ASCII screen designs, pseudocode, phased file-level implementation guidance, testing strategy, and risks.

### Why

- The earlier tickets establish context, but they do not isolate the React debugger as its own implementation package.
- A new intern needs the system introduction and the implementation specifics in one place.
- The debugger work is best served by concrete repository evidence rather than generic frontend planning.

### What worked

- The existing repository documentation already contained strong prior work for the dynamic debugger concept, especially the GNOSIS-002 and GNOSIS-003 design docs.
- The current React app is already structured in a way that supports debugger extension: mode-aware state, RTK Query endpoints, and a panel registry.
- The backend contract already returns enough information to support an initial browser interpreter and compare flow.

### What didn't work

- Nothing failed materially during the analysis phase.
- One mismatch that required care: the static canvas executor uses little-endian reads, while the dynamic VM uses big-endian reads. That is not an implementation failure, but it is an easy place for a future frontend implementation to go wrong.

### What I learned

- The debugger is not blocked by missing backend infrastructure. The largest missing pieces are in the frontend state model and canvas/rendering path.
- The current `dynamicSlice` is intentionally shallow and should probably not absorb the full debugger lifecycle. A dedicated debugger slice is cleaner.
- The current React workbench already contains explicit hints about the intended debugger panels, which reduces ambiguity about the intended extension direction.

### What was tricky to build

- The hardest part was keeping the new ticket distinct from the prior dynamic UI handoff work while still reusing the strongest parts of that earlier analysis. The solution was to treat GNOSIS-005 as a focused implementation package for the React debugger, not a duplicate architecture survey.
- Another subtle point was explaining why the browser should own the debugger without sliding into "port the compiler to TypeScript." The repository evidence supports a narrower browser-side interpreter/debugger, so the design doc had to draw that boundary explicitly.

### What warrants a second pair of eyes

- The proposed split between `dynamicSlice` and a new `dynamicDebuggerSlice`.
- The recommendation to enrich `/api/compile-dynamic` with decoded instruction metadata only after the browser decoder is stable.
- The phased plan for compare mode: final-state compare first, synchronized stepping later.

### What should be done in the future

- Implement the React debugger in phases following the design doc.
- Add oracle parity tests early so the browser interpreter cannot drift from the Python VM.
- Revisit backend-enriched decoded instruction metadata after phase 1 or 2 if the UI implementation becomes too decoder-heavy.

### Code review instructions

- Start with the main design document in `ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/design-doc/01-react-dynamic-vm-debugger-analysis-design-and-implementation-guide.md`.
- Compare the proposed state model against `web/src/store/slices/dynamicSlice.ts`, `web/src/store/slices/inspectorSlice.ts`, and `web/src/store/index.ts`.
- Review the recommended browser interpreter behavior against `gnosis_dynamic_vm/gnosis_dynamic/vm.py` and `gnosis_dynamic_vm/gnosis_dynamic/bytecode.py`.
- Validate the ticket after documentation edits with `docmgr doctor --ticket GNOSIS-005 --stale-after 30`.
- Validate delivery with the `remarquee upload bundle --dry-run ...` and final upload commands recorded below.

### Technical details

Commands run during this step:

```bash
docmgr status --summary-only
docmgr ticket create-ticket --ticket GNOSIS-005 --title "React Dynamic VM Debugger Implementation Guide" --topics compiler,dynamic-vm,webui,react,redux,debugger
docmgr doc add --ticket GNOSIS-005 --doc-type design-doc --title "React Dynamic VM Debugger Analysis, Design, and Implementation Guide"
docmgr doc add --ticket GNOSIS-005 --doc-type reference --title "Investigation diary"
rg -n "compile_with_stages|compile-dynamic|debugger|registerPanel|dynamic" web gnosis_compiler gnosis_dynamic_vm ttmp
nl -ba web_server.py | sed -n '102,226p'
nl -ba web/src/store/slices/dynamicSlice.ts | sed -n '1,260p'
nl -ba web/src/components/Canvas/Canvas.tsx | sed -n '1,340p'
nl -ba gnosis_dynamic_vm/gnosis_dynamic/vm.py | sed -n '1,360p'
nl -ba gnosis_dynamic_vm/gnosis_dynamic/bytecode.py | sed -n '1,320p'
```

Primary artifacts produced:

- `ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/design-doc/01-react-dynamic-vm-debugger-analysis-design-and-implementation-guide.md`
- `ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/01-investigation-diary.md`

## Step 2: Remove The Static Compiler And Rewrite The Plan

This step converted the repository and the ticket from a mixed static/dynamic architecture into a dynamic-only product baseline. The user explicitly decided that keeping the static compiler around would complicate the debugger, so the implementation work moved from "design around coexistence" to "delete the old system and simplify the active one."

The code changes were intentionally not cosmetic. The backend API was collapsed to one dynamic compile path, the React app lost its mode switch and static compile state, the canvas was switched to render dynamic draw operations, the old static compiler package and related files were removed, and the GNOSIS-005 plan was rewritten so its phases assume that the static compiler is already gone.

### Prompt Context

**User prompt (verbatim):** "So the first step is going to be to kill the static compiler, we only want to focus on the dynamic one. Add tasks to the ticket to just kill it, no backwards compatibility. that will make the debugger simpler to design. We also don't need backwards compatibility wrt API and such. 

Kill the old compiler, and then update the design plan once you have done that"

**Assistant interpretation:** Remove the static compiler and all static-mode product paths from the active repository, simplify the backend and React app to a single dynamic VM architecture, and then rewrite the ticket plan to reflect that new baseline.

**Inferred user intent:** Reduce architectural complexity before building the debugger so the implementation plan can target only the dynamic VM without compatibility drag.

**Commit (code):** N/A

### What I did

- Rewrote `web_server.py` to serve a dynamic-only API through `/api/compile` and `/api/presets`.
- Simplified the React store by shrinking `compilerSlice`, keeping compile results in `dynamicSlice`, and trimming `inspectorSlice`.
- Removed the static mode switch, props workflow, static bytecode executor path, and static-only inspector panels from the frontend.
- Added a lightweight dynamic draw-op renderer at `web/src/engine/dynamicRenderer.ts`.
- Deleted the old static compiler package, static examples, static tests, static docs, and the legacy static HTML frontend.
- Rewrote the GNOSIS-005 design document and tasks to start from the dynamic-only architecture.

### Why

- The static compiler was no longer a product requirement.
- Maintaining both compiler paths made the debugger plan more complicated than necessary.
- The user explicitly said backward compatibility was not needed, which made deletion the correct move instead of deprecation.

### What worked

- The simplification pass made the active codebase noticeably smaller and easier to reason about.
- The dynamic API and current React shell were already strong enough that removing static mode did not require inventing a new architecture.
- Rewriting the design doc after the code changes produced a much clearer debugger plan than trying to preserve the earlier dual-mode framing.

### What didn't work

- `apply_patch` could not delete the old binary artifact `out/dashboard.gnbc` because it is not valid UTF-8, so I used `rm -rf` for the static compiler cleanup batch instead.

### What I learned

- Removing old architecture early is materially different from marking it deprecated. The design space becomes cleaner immediately.
- The most valuable simplification was not the file deletion itself, but collapsing the frontend and API around a single compile result model.

### What was tricky to build

- The main subtlety was that the dynamic canvas path needed explicit screen dimensions, while the previous static path derived its size from static compiler stats. I resolved that by extending the dynamic compile response with `program.screen`.
- Another tricky point was deciding how much of the old frontend to keep. I chose to keep only the generic shell and dynamic-relevant panels, then delete the static-only components instead of leaving them unused.

### What warrants a second pair of eyes

- The new dynamic-only API contract in `web_server.py`.
- The current decision to keep runtime editing as a later step while still supporting preset-driven runtimes now.
- The reduced frontend shell, especially the switch from static bytecode rendering to dynamic draw-op rendering.

### What should be done in the future

- Implement the browser-side decoder/interpreter next.
- Add a real runtime editor after the interpreter/debugger core is stable.
- Add parity tests against the Python VM before introducing breakpoints and compare stepping.

### Code review instructions

- Start with `web_server.py` to confirm the API collapse.
- Then read `web/src/store/slices/compilerSlice.ts`, `web/src/store/slices/dynamicSlice.ts`, and `web/src/components/Header/Header.tsx`.
- Review `web/src/components/Canvas/Canvas.tsx` and `web/src/engine/dynamicRenderer.ts` to confirm the new rendering path.
- Review the rewritten GNOSIS-005 design doc and task list after the code changes.
- Validate the frontend with `npm run typecheck` in `web/`.

### Technical details

Commands run during this step:

```bash
rg -n "static|compile_with_stages|compile-dynamic|CompilerMode|bindsim|regions|ASTPanel|StatsPanel" web web_server.py README.md docs gnosis_compiler tests
rm -rf gnosis_compiler tests/test_compiler.py examples docs/architecture-guide.md COMPILER_GUIDE.md MIGRATION_NOTES.md source/gnosis-compiler.jsx source/gnosis-engine.jsx source/gnosis-layout-algorithm.md out/dashboard.gnbc out/dashboard.asm.txt out/dashboard.manifest.json
```

Primary artifacts changed:

- `web_server.py`
- `web/src/store/slices/compilerSlice.ts`
- `web/src/store/slices/dynamicSlice.ts`
- `web/src/store/slices/inspectorSlice.ts`
- `web/src/components/Header/Header.tsx`
- `web/src/components/Editor/Editor.tsx`
- `web/src/components/Canvas/Canvas.tsx`
- `web/src/engine/dynamicRenderer.ts`
- `README.md`
- `ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/design-doc/01-react-dynamic-vm-debugger-analysis-design-and-implementation-guide.md`

## Step 3: Implement The Browser-Side GNDY Decoder, Interpreter, And Debugger

This step implemented the full browser-side debugger stack: a TypeScript GNDY binary decoder, a VM interpreter that mirrors the Python evaluator, a step debugger with snapshots and history, a Redux slice for debugger state, and three new inspector panels (Debugger, Slots, Stack). The implementation was validated end-to-end using Playwright, and the oracle validation confirms the browser interpreter produces identical slot values and draw-op counts to the Python backend.

The key architectural decision was to keep the `GNDYDebugger` instance and decoded `GNDYProgram` at module scope rather than in React refs. The panel registry unmounts panels when tabs switch, which would destroy useRef-based state. A module-level singleton survives tab switches while the Redux slice holds the serializable snapshot for cross-panel consumption (Canvas reads `debugger.snapshot.drawOps` for incremental rendering, SlotsPanel reads `debugger.snapshot.slots` for change highlighting).

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Implement the React-side GNDY debugger as designed in the GNOSIS-005 ticket: browser decoder, interpreter, step debugger, Redux state, inspector panels. Track progress via docmgr tasks and diary.

**Inferred user intent:** Get a working in-browser debugger for the dynamic VM bytecode so developers can step through compiled programs, inspect slot/stack state, and validate against the Python oracle.

**Commit (code):** N/A (not yet committed)

### What I did

- Created `web/src/engine/gndy/decode.ts` — GNDY binary format parser and instruction decoder for all 17 opcodes, with typed instruction discriminated unions and convenience `decodeProgramFromBase64()`.
- Created `web/src/engine/gndy/interpreter.ts` — Full VM evaluator mirroring `gnosis_dynamic_vm/gnosis_dynamic/vm.py`. Same fetch-decode-execute loop, same `resolveBind()`, `toInt()`, `clampU16()` semantics, same draw-op output format.
- Created `web/src/engine/gndy/debugger.ts` — `GNDYDebugger` class wrapping the interpreter with: single-step execution, pre-step snapshot capture into a bounded history ring, step-back via history restore, run-to-completion, run-to-breakpoint, breakpoint toggle, reset. Each step records `SlotChange[]` diffs.
- Created `web/src/engine/gndy/index.ts` — Barrel export for the gndy module.
- Created `web/src/store/slices/debuggerSlice.ts` — Redux Toolkit slice with state for `snapshot`, `breakpoints`, `historyDepth`, `status`, `oracleMismatches`. Actions: `loadDebugger`, `updateSnapshot`, `resetDebugger`, `setBreakpoints`, `setOracleMismatches`, `clearDebugger`.
- Wired `debuggerReducer` into `web/src/store/index.ts`.
- Created `web/src/components/Inspector/panels/DebuggerPanel.tsx` — Main debugger panel with LOAD/STEP/BACK/RUN/RUN TO BP/RESET/VALIDATE/CLOSE controls, phase/PC/op display, inline disassembly with current-instruction highlighting and clickable breakpoints, oracle validation result.
- Created `web/src/components/Inspector/panels/SlotsPanel.tsx` — Slot grid grouped by node (n0..nN) showing all 6 fields (mw, mh, x, y, w, h), with change highlighting from the debugger snapshot.
- Created `web/src/components/Inspector/panels/StackPanel.tsx` — Stack display showing top-of-stack first, with decimal and hex values.
- Registered all three new panels in `web/src/components/Inspector/registerPanels.ts` (DEBUGGER, SLOTS, STACK tabs).
- Updated `web/src/components/Canvas/Canvas.tsx` to read `debugger.snapshot.drawOps` when the debugger is active, enabling incremental canvas rendering during stepping.
- Updated `web/src/engine/index.ts` to re-export the gndy module.

### Why

- The GNOSIS-005 design doc specified a browser-side interpreter and debugger as the core deliverable.
- The dynamic-only architecture (from Step 2) made this straightforward: one binary format, one VM model, one set of opcodes.
- Oracle validation was critical to confirm the TypeScript interpreter matches the Python VM before building more complex debugger features.

### What worked

- The Python VM is simple enough (17 opcodes, flat slot array, stack machine) that a faithful TypeScript port was straightforward.
- The decoded instruction discriminated union types (`InstrPushConst`, `InstrDrawTextBind`, etc.) give excellent type safety in the debugger's `executeInstruction()` switch.
- RTK Query's `extraReducers` pattern in `dynamicSlice` already handled compile lifecycle; the new `debuggerSlice` follows the same pattern cleanly.
- The panel registry pattern made adding three new tabs trivial (just `registerPanel()` calls).
- Oracle validation passed on the first run for the sensor_dashboard preset (16 nodes, 96 slots, 10 draw ops).

### What didn't work

- Initial implementation used `useRef` for the `GNDYDebugger` and `GNDYProgram` instances inside `DebuggerPanel`. When switching to SLOTS/STACK tabs and back, the panel unmounted and refs reset to null, losing the debugger session. Switching back showed `--` for the op name and `?` for instruction count.
- TypeScript strict null checks (`noUncheckedIndexedAccess`) required adding `!` assertions or `?? 0` fallbacks on every `Uint8Array` and `number[]` index access. The Python code has no equivalent overhead.

### What I learned

- The panel registry unmounts panels on tab switch. Any mutable state that must survive tab switches needs to live outside the component — module-level singletons or a React context that wraps the Inspector.
- The `sl()` helper pattern (`slots[idx] ?? 0`) is the cleanest way to satisfy TypeScript strict index checks without losing readability.
- The `DebugSnapshot` type needs to carry `changedSlots` from the step that produced it, not from the current state. This is because the snapshot is dispatched to Redux and consumed by other panels asynchronously.

### What was tricky to build

- The module-level singleton for `GNDYDebugger` was the main surprise. The symptom was that after switching tabs and returning to the Debugger panel, all instruction-dependent rendering (op name, instruction count, disassembly listing) disappeared because `programRef.current` was null. The fix was to hoist `_dbg` and `_program` to module scope with exported accessor functions. The Redux slice still owns the serializable snapshot; the module singleton owns the mutable session.
- Getting the `changedSlots` diff correct required snapshotting `[...this.slots]` before executing each instruction and comparing afterward. The diff must be attached to the post-step snapshot, not derived from the pre-step snapshot.

### What warrants a second pair of eyes

- The module-level singleton pattern means only one debugger session can exist at a time. If a future feature needs parallel debugger sessions (e.g., compare mode with two runtimes stepping simultaneously), this will need to be refactored.
- The oracle validation currently compares slot values by name and draw_ops by count. A deeper comparison (draw_op field-by-field) would catch more subtle divergences.
- The `DrawOp` type in `api.ts` uses optional fields, but the interpreter always sets them. A stricter type per draw-op kind would be better.

### What should be done in the future

- Add breakpoint persistence across recompilations (currently breakpoints are stored as PC offsets which change when code changes).
- Add a compare mode that runs two runtimes side by side and highlights slot/draw-op differences.
- Add runtime editing so the user can modify runtime values and re-evaluate without recompiling.
- Add field-by-field oracle validation for draw_ops, not just count comparison.
- Consider a context-based approach instead of module singletons if multiple debugger instances are needed.

### Code review instructions

- Start with `web/src/engine/gndy/decode.ts` — confirm the opcode table and operand sizes match `gnosis_dynamic_vm/gnosis_dynamic/bytecode.py`.
- Compare `web/src/engine/gndy/interpreter.ts` against `gnosis_dynamic_vm/gnosis_dynamic/vm.py` — especially `resolveBind()`, `MEASURE_TEXT_BIND`, `DIV` (div-by-zero returns 0), and `DRAW_BAR_BIND` (frac clamping).
- Review `web/src/engine/gndy/debugger.ts` — check the snapshot/history pattern and that `executeInstruction()` mirrors the interpreter exactly.
- Validate the TypeScript builds cleanly: `cd web && npx tsc --noEmit`.
- Test in browser: select sensor_dashboard preset, compile, open DEBUGGER tab, click LOAD, step through, switch to SLOTS/STACK and back, run to completion, click VALIDATE. Should show ORACLE: PASS.

### Technical details

Files created:

- `web/src/engine/gndy/decode.ts` — 345 lines, GNDY binary decoder
- `web/src/engine/gndy/interpreter.ts` — 219 lines, VM evaluator
- `web/src/engine/gndy/debugger.ts` — 300 lines, step debugger
- `web/src/engine/gndy/index.ts` — 14 lines, barrel exports
- `web/src/store/slices/debuggerSlice.ts` — 75 lines, Redux slice
- `web/src/components/Inspector/panels/DebuggerPanel.tsx` — 340 lines, debugger panel
- `web/src/components/Inspector/panels/SlotsPanel.tsx` — 90 lines, slots panel
- `web/src/components/Inspector/panels/StackPanel.tsx` — 75 lines, stack panel

Files modified:

- `web/src/store/index.ts` — added debugger reducer
- `web/src/components/Inspector/registerPanels.ts` — registered 3 new panels
- `web/src/components/Canvas/Canvas.tsx` — reads debugger snapshot for incremental rendering
- `web/src/engine/index.ts` — re-exports gndy module

## Step 4: Add The VM, Microcode, And FPGA Reading Guide

This step added a separate intern-facing reference document for the broader systems material behind GNOSIS. The React debugger design doc explains what to build in this repo. This reading guide explains how to study the surrounding topics well enough to reason about why the system is shaped this way and how it might evolve into a hardware runtime.

The main design decision was to keep the guide grounded in the current GNOSIS code instead of turning it into a generic architecture bibliography. The document starts from the actual dynamic-only compiler and VM in this repository, then branches outward into three learning tracks: software VM design, stack machines and microcode, and FPGA/Verilog implementation.

### Prompt Context

**User prompt (verbatim):** "Ok, make a detailed document with thi s reference information, maybe we'll get deeper into it (all the research and books I had you do and find, written out for a new intern that wants to get deep into the topic)"

**Assistant interpretation:** Write a detailed intern-oriented reference document inside the GNOSIS-005 ticket that collects the previously discussed books, learning paths, architecture notes, and project suggestions around VMs, microcode, and FPGA implementation.

**Inferred user intent:** Preserve the prior recommendation conversation in a form that is durable, teachable, and tied back to the GNOSIS repository so a new intern can use it as a study guide instead of relying on chat history.

**Commit (code):** N/A

### What I did

- Added `ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/02-vm-microcode-and-fpga-reading-guide.md`.
- Wrote a detailed guide with:
  - repo-first orientation to GNOSIS as a dynamic bytecode VM
  - three learning tracks
  - recommended reading orders for software VMs, stack VMs in Verilog, and microcoded engines
  - annotations for the main books and why each matters
  - non-book references such as J1, SERV, and the Forth cores index
  - ASCII architecture diagrams
  - suggested project ladders and pseudocode sketches
  - explicit advice on what not to over-read first
- Updated the ticket index, tasks, and changelog so the new reference is discoverable from the workspace entry points.

### Why

- The recommendation conversation had become larger than a short answer and was worth preserving as project documentation.
- A new intern benefits more from a curated reading path than from a raw list of titles.
- Tying the reading guide back to `compiler.py`, `bytecode.py`, `vm.py`, and `web_server.py` keeps the material practical and relevant to current implementation work.

### What worked

- The current GNOSIS codebase provides a strong anchor for the concepts, especially because the VM is small and legible.
- The split into three learning tracks makes the material easier to navigate than one long mixed list.
- Including project ladders and ASCII diagrams made the guide more actionable than a bibliography.

### What didn't work

- No material implementation problems occurred during this step.
- One constraint was that the guide needed to stay focused enough for an intern while still covering both software and hardware directions; the track-based structure resolved that.

### What I learned

- The GNOSIS VM is a good teaching system because it is small enough to read in one sitting but still captures real compiler/runtime design tradeoffs.
- The best way to teach this topic is to keep returning to the repo and to small buildable machines, not to stay in abstract theory for too long.

### What warrants a second pair of eyes

- The reading order assumptions, especially for interns with stronger software backgrounds than hardware backgrounds.
- Whether a future follow-up document should add a dedicated chapter on C runtime design for microcontrollers, since that sits between the current Python VM and any FPGA work.

### What should be done in the future

- Expand the guide if the team decides to prototype a C or HDL runtime beyond the browser debugger.
- Add a companion note with exact chapter recommendations if an intern starts one of the hardware project ladders.

### Code review instructions

- Read the new guide and confirm that the repo references still match the current dynamic-only architecture.
- Confirm the reading paths align with the intended team direction: browser debugger first, hardware exploration second.

### Technical details

Primary artifact produced:

- `ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/02-vm-microcode-and-fpga-reading-guide.md`

Supporting ticket files updated:

- `ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/index.md`
- `ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/tasks.md`
- `ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/changelog.md`

## Step 5: Add The Verilog Vector-Controller VM Experiment Note

This step captured the hardware implementation discussion as a proper ticket artifact instead of leaving it in chat. The resulting note is intentionally written as an experiment document rather than a roadmap commitment: it explains how the current GNOSIS VM could be realized in Verilog, what the clean subsystem boundaries are, and how to stage the work so an intern could prototype it without collapsing into text rendering or binary parsing too early.

The most important architectural choice recorded in the document is the separation between the GNOSIS VM and the vector graphics controller. The VM remains responsible for layout evaluation and command emission. A separate graphics block consumes normalized line, rect, bar, and text commands. That separation is the only sane way to keep the design testable and aligned with the current software VM.

### Prompt Context

**User prompt (verbatim):** "Ok flesh this out into an "experiment" document and store it in the ticket, just to save our ideas here. Flesh it out in detailed fashion for an intern to understand, from base principles, with pseudocode and written out prose paragraphs and bullet points and diagrams and such."

**Assistant interpretation:** Create a detailed experiment document inside GNOSIS-005 describing how the current GNOSIS VM could be implemented in Verilog to drive a vector graphics controller, and update ticket bookkeeping so the idea is preserved and discoverable.

**Inferred user intent:** Preserve the hardware direction as a serious design option without treating it as immediate implementation work.

**Commit (code):** N/A

### What I did

- Added `ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/04-experiment-verilog-gnosis-vm-for-vector-graphics-control.md`.
- Wrote the document as an intern-facing experiment note with:
  - first-principles explanation of what part of GNOSIS belongs in hardware
  - hardware block decomposition
  - slot RAM, stack RAM, and program memory model
  - multicycle FSM execution strategy
  - opcode-family implementation notes
  - draw FIFO and vector command interface design
  - text and bind-resolution strategy
  - microcoded alternative discussion
  - bring-up and verification plans
  - risk analysis and intern checklist
- Updated the ticket index, tasks, changelog, and this diary entry set so the experiment note is part of the active ticket package.

### Why

- The VM is still small and understandable right now, which makes this the right time to preserve the hardware mapping ideas.
- A proper document is much more reusable than a transient chat exchange, especially for intern onboarding.
- Capturing the separation between VM core and vector renderer now prevents future architectural confusion.

### What worked

- The current Python VM maps cleanly to a hardware fetch/decode/execute model, which made the experiment document concrete rather than speculative.
- Writing the note around opcode families and subsystem boundaries made it much more teachable than a raw list of Verilog modules.

### What didn't work

- No implementation problem occurred in this step.
- The main constraint was scope control: the note needed to be detailed without turning into a full hardware spec. Treating it as an experiment and staging the bring-up plan solved that.

### What I learned

- The present GNOSIS VM is unusually friendly to hardware experimentation because the runtime state is so small and the compiler has already pushed symbolic complexity out of the execution phase.
- Text remains the dominant complexity driver, so isolating it behind a command interface is the right default assumption.

### What warrants a second pair of eyes

- The suggested command FIFO shape for text and bars.
- The choice to recommend a hardwired multicycle FSM first and defer microcode to a second experiment.

### What should be done in the future

- If hardware work becomes active, create a follow-up ticket with a minimal simulation-only milestone and a Python trace comparator.
- If the text path becomes important, write a companion note dedicated to the text engine and metric interface.

### Code review instructions

- Read the experiment note alongside `gnosis_dynamic_vm/gnosis_dynamic/bytecode.py` and `gnosis_dynamic_vm/gnosis_dynamic/vm.py`.
- Confirm that the suggested hardware control flow preserves the current runtime semantics, especially arithmetic, slot writes, draw-op emission, and division-by-zero behavior.

### Technical details

Primary artifact produced:

- `ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/04-experiment-verilog-gnosis-vm-for-vector-graphics-control.md`

Supporting ticket files updated:

- `ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/index.md`
- `ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/tasks.md`
- `ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/changelog.md`
- `ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/01-investigation-diary.md`
