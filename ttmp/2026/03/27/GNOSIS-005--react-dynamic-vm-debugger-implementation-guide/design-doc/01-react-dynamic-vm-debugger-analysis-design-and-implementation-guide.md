---
Title: React Dynamic VM Debugger Analysis, Design, and Implementation Guide
Ticket: GNOSIS-005
Status: active
Topics:
    - compiler
    - dynamic-vm
    - webui
    - react
    - redux
    - debugger
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: README.md
      Note: Repository now explicitly describes the dynamic-only product direction
    - Path: web_server.py
      Note: Dynamic-only compile and preset API
    - Path: web/src/store/slices/compilerSlice.ts
      Note: Simplified source/autocompile/preset state after static removal
    - Path: web/src/store/slices/dynamicSlice.ts
      Note: Dynamic compile result and runtime-selection state
    - Path: web/src/store/slices/inspectorSlice.ts
      Note: Inspector height, active tab, and highlighted PC state
    - Path: web/src/components/Header/Header.tsx
      Note: Dynamic-only header, compile button, preset loading, and runtime selection
    - Path: web/src/components/Editor/Editor.tsx
      Note: Source-only editor shell after the props/static workflow was removed
    - Path: web/src/components/Canvas/Canvas.tsx
      Note: Dynamic draw-op rendering path and screen sizing
    - Path: web/src/components/Inspector/registerPanels.ts
      Note: Current dynamic-only panel set and debugger expansion point
    - Path: web/src/engine/dynamicRenderer.ts
      Note: Current draw-op renderer that the debugger will later drive incrementally
    - Path: gnosis_dynamic_vm/gnosis_dynamic/compiler.py
      Note: Authoritative dynamic compiler
    - Path: gnosis_dynamic_vm/gnosis_dynamic/vm.py
      Note: Python reference evaluator to mirror in the browser debugger
    - Path: gnosis_dynamic_vm/gnosis_dynamic/bytecode.py
      Note: Opcode and binary format reference
ExternalSources: []
Summary: Updated intern-oriented plan for building the React debugger after removing the old static compiler and collapsing the app/backend to a dynamic-only architecture
LastUpdated: 2026-03-27T16:16:31.776563624-04:00
WhatFor: Explain the new dynamic-only baseline and define the next implementation steps for the browser debugger
WhenToUse: Use when building or reviewing the React debugger after the static compiler removal
---

# React Dynamic VM Debugger Analysis, Design, and Implementation Guide

## 1. Executive Summary

This repository no longer supports the old static compiler path. The static compiler package, its examples, its static docs, its legacy frontend, and the dual-mode API shape have been removed. The application and backend now expose one compiler model only: the GNOSIS dynamic VM.

That scope reduction matters because it changes the debugger problem substantially. The team no longer needs to design around a split-brain product where one part of the UI is static draw-list inspection and another part is dynamic VM debugging. The debugger can now be designed as the primary product surface for the workbench.

The current codebase already reflects that new baseline. The backend now exposes a single `POST /api/compile` and `GET /api/presets` contract for the dynamic compiler. The React app no longer has a mode switch, props editor, or static compile state. The canvas renders dynamic `draw_ops` directly. The remaining work is therefore not "remove static complexity" but "build the actual browser interpreter and step debugger on top of a dynamic-only shell."

## 2. Scope And Product Direction

### 2.1 What changed

The project direction changed from "support both static and dynamic compiler flows" to "focus entirely on the dynamic VM." That decision has now been implemented in the codebase.

The repository no longer treats backward compatibility as a constraint for:

1. API naming,
2. frontend state shape,
3. inspector panel set,
4. examples and tests,
5. repository documentation.

### 2.2 What this ticket now covers

GNOSIS-005 now covers the dynamic debugger only:

1. compile a dynamic program,
2. edit and select runtime payloads,
3. inspect final evaluations,
4. step through GNDY execution in the browser,
5. compare runtime-driven layout reflow,
6. validate browser behavior against the Python VM.

### 2.3 What this ticket no longer covers

This ticket no longer needs to explain how the static compiler and static workbench coexist with the new debugger. That entire compatibility problem has been intentionally deleted.

## 3. Current Architecture After Static Removal

### 3.1 Backend

The backend entrypoint is now `web_server.py`. It imports only the dynamic compiler and dynamic VM. The API now has a single compile route and a single preset route for the dynamic compiler.

Current backend responsibilities:

1. parse YAML source,
2. compile to GNDY,
3. evaluate zero or more runtime payloads with the Python VM,
4. return program metadata, disassembly, IR, slot expressions, and final evaluation oracles.

This is the correct long-term backend posture for the debugger. The backend remains authoritative for compilation and correctness, while the browser will own interactive stepping.

### 3.2 React store

The frontend store is smaller now.

`compilerSlice.ts` only tracks:

- `sourceText`
- `autoCompile`
- `selectedPreset`

`dynamicSlice.ts` now owns:

- `runtimes`
- `compileResult`
- `compileStatus`
- `error`
- `selectedEvaluation`
- `compareEnabled`

`inspectorSlice.ts` now owns:

- `activeTab`
- `inspectorHeight`
- `highlightPc`

This is already much closer to the right debugger shape than the previous dual-mode store.

### 3.3 React shell

The current shell is:

- `Header` for presets, compile, auto-compile, and runtime selection
- `Editor` for source text
- `Canvas` for dynamic `draw_ops`
- `Inspector` for eval, disassembly, IR, hex, and manifest

The important observation is that the app is now organized around one compile artifact. There is no need to branch on compiler mode or maintain a static result and a dynamic result in parallel.

### 3.4 Current working behavior

The repository already supports this reduced flow:

```text
source YAML
  -> POST /api/compile
  -> DynamicCompiler.compile(...)
  -> VM.evaluate(...) for each runtime
  -> program + disassembly + ir + slot expressions + evaluations
  -> React store
  -> canvas renders selected evaluation draw_ops
  -> inspector shows eval/disasm/ir/hex/manifest
```

This is the new starting point for the debugger project.

## 4. Why The Debugger Is Simpler Now

The static removal simplifies the debugger design in five specific ways.

### 4.1 One compile artifact

There is only one program shape to inspect now. The workbench no longer has to decide whether the current compile result is a static bytecode blob with AST stages or a dynamic residual program with slots and draw ops.

### 4.2 One canvas path

The canvas now renders one thing: dynamic `draw_ops`. It no longer needs a static bytecode executor path.

### 4.3 One preset model

The preset system now only loads dynamic examples plus runtime payloads. There is no split between source+props presets and source+runtimes presets.

### 4.4 One mental model for the intern

The intern no longer has to learn the static compiler first in order to understand why the debugger exists. They can learn GNOSIS directly as a dynamic VM product.

### 4.5 Cleaner API naming

The backend no longer needs parallel `/api/compile` vs `/api/compile-dynamic` or `/api/presets` vs `/api/presets-dynamic` surfaces. The dynamic VM is simply the API.

## 5. Remaining Gaps

The current system is cleaner, but it is not a debugger yet.

### 5.1 No browser interpreter

The browser can render server-provided final `draw_ops`, but it still cannot evaluate GNDY itself. There is no browser equivalent of `VM.evaluate()` yet.

### 5.2 No step state

The store does not yet track:

- current debugger snapshot,
- stack contents,
- slot diffs,
- breakpoint set,
- history for step-back,
- current phase,
- halted/running state.

### 5.3 No runtime editor

Runtimes can be loaded from presets and selected from compile results, but the user still does not have a first-class runtime editor inside the React app.

### 5.4 No compare workflow

There is a placeholder `compareEnabled` flag, but no compare canvas, no side-by-side slot diff, and no synchronized stepping.

### 5.5 No oracle parity checks

The backend already returns evaluation oracles. The browser does not yet compare its own future evaluator output against those oracles.

## 6. Updated Architecture Recommendation

### 6.1 Keep the backend as compiler and oracle

Do not move the compiler into the frontend. The backend should remain responsible for:

1. source parsing,
2. compilation,
3. final oracle evaluations,
4. serving preset/runtime examples.

### 6.2 Add a browser interpreter, not a browser compiler

The browser should implement:

1. GNDY decoding,
2. one-instruction stepping,
3. full-run evaluation,
4. snapshot history,
5. draw-op accumulation,
6. diffing between steps,
7. compare-mode presentation.

That is enough to build a debugger without reintroducing the complexity of a second compiler implementation.

### 6.3 Keep the API minimal

The current response is already close to what the debugger needs:

- `program`
- `disassembly`
- `ir`
- `slot_expressions`
- `evaluations`

Optional enrichments can come later, but the browser should not block on them.

## 7. Proposed Frontend Module Layout

Recommended additions from the new dynamic-only baseline:

```text
web/src/
  dynamic/
    gndy/
      decode.ts
      interpreter.ts
      debugger.ts
      diffs.ts
      runtime.ts
  components/
    Editor/
      RuntimeEditor.tsx
    Inspector/panels/
      SlotsPanel.tsx
      StackPanel.tsx
      ComparePanel.tsx
      DebuggerPanel.tsx
```

Keep the existing `dynamicRenderer.ts`. The future debugger should feed that renderer incrementally.

## 8. Updated API Contract

### 8.1 Current contract

The current compile response shape should remain the foundation:

```json
{
  "success": true,
  "program": {
    "screen": {"width": 400, "height": 300},
    "node_count": 9,
    "slot_count": 54,
    "binds": ["props.title", "sensor.temp"],
    "strings": [": ", "RPM"],
    "slot_init": {"n3.mw": 0},
    "code_size": 46,
    "code_base64": "...",
    "binary_base64": "...",
    "manifest": {...}
  },
  "disassembly": "...",
  "ir": "...",
  "slot_expressions": {...},
  "evaluations": [...]
}
```

### 8.2 Optional enrichments

These are helpful but not phase-1 blockers:

```json
{
  "debug": {
    "instructions": [
      {"pc": 0, "op": "MEASURE_TEXT_BIND", "phase": "measure", "operands": {"node": 3, "bind": 0, "size": 1}}
    ],
    "nodes": [
      {"id": 3, "path": "root/body/children/0", "type": "label", "bind": "props.title"}
    ]
  }
}
```

## 9. Updated Redux Model

The next major state addition should be a dedicated debugger slice.

```ts
type DebugPhase = 'init' | 'measure' | 'compute' | 'render' | 'halted';

interface DebuggerSnapshot {
  pc: number;
  phase: DebugPhase;
  halted: boolean;
  stack: number[];
  slots: number[];
  drawOps: DrawOp[];
  changedSlots: Array<{ slot: number; before: number; after: number }>;
}

interface DynamicDebuggerState {
  selectedRuntimeName: string | null;
  breakpoints: number[];
  snapshot: DebuggerSnapshot | null;
  historyDepth: number;
  status: 'idle' | 'ready' | 'running' | 'halted' | 'error';
  compareLeftRuntimeName: string | null;
  compareRightRuntimeName: string | null;
  compareCursorSync: boolean;
}
```

Recommended actions:

- `loadDebugger(runtimeName)`
- `resetDebugger()`
- `stepDebugger()`
- `stepBackDebugger()`
- `runDebugger()`
- `runToBreakpoint()`
- `toggleBreakpoint(pc)`
- `setComparePair({ left, right })`
- `setCompareCursorSync(boolean)`

## 10. Updated Screen Designs

### 10.1 Screen A: Dynamic-only workbench baseline

```text
+--------------------------------------------------------------------------------------------------+
| GNOSIS // DYNAMIC VM WORKBENCH   preset:[dynamic_hbox v]   [COMPILE] [AUTO]   runtime:[A v]     |
+--------------------------------------------------------------------------------------------------+
| SOURCE                                                                                            |
| type: screen                                                                                      |
| width: 400                                                                                        |
| height: 300                                                                                       |
| ...                                                                                               |
+--------------------------------------------------------------------------------------------------+
| CANVAS                                                                                            |
| [final draw_ops render for selected runtime]                                                      |
+--------------------------------------------------------------------------------------------------+
| EVAL | DISASSEMBLY | IR | HEX | MANIFEST                                                          |
+--------------------------------------------------------------------------------------------------+
```

Primary state/actions:

- `compiler.sourceText`
- `compiler.selectedPreset`
- `compiler.autoCompile`
- `dynamic.runtimes`
- `dynamic.selectedEvaluation`
- `compile(...)`
- `setSelectedEvaluation(index)`

### 10.2 Screen B: Step debugger

```text
+----------------------------------------------------------------------------------------------------------------+
| DEBUGGER runtimeA                                      [STEP] [RUN] [BACK] [RESET] [RUN TO BP]               |
+----------------------------------------------------------------------------------------------------------------+
| Phase: COMPUTE   PC: 0x0012   Op: ADD                                                                    |
+---------------------------------------------------------------+------------------------------------------------+
| DISASSEMBLY                                                    | SLOTS CHANGED                                  |
|  0000 MEASURE_TEXT_BIND ...                                     | n4.x: 18 -> 98                                 |
|  0006 PUSH_SLOT ...                                             | n5.x: 36 -> 116                                |
| >0012 ADD                                                       |                                                |
+---------------------------------------------------------------+------------------------------------------------+
| STACK                                                           | CANVAS                                          |
| [88, 10]                                                        | partial draw_ops so far                         |
+---------------------------------------------------------------+------------------------------------------------+
```

Primary state/actions:

- `dynamicDebugger.snapshot`
- `dynamicDebugger.breakpoints`
- `stepDebugger()`
- `stepBackDebugger()`
- `runToBreakpoint()`
- `resetDebugger()`
- `toggleBreakpoint(pc)`

### 10.3 Screen C: Compare mode

```text
+----------------------------------------------------------------------------------------------------------------+
| COMPARE [on]   left:[runtimeA v]   right:[runtimeB v]   sync:[on]                                             |
+---------------------------------------------------------------+------------------------------------------------+
| LEFT CANVAS                                                    | RIGHT CANVAS                                   |
| [draw_ops render A]                                            | [draw_ops render B]                            |
+---------------------------------------------------------------+------------------------------------------------+
| KEY SLOT DELTAS                                                                                                 |
| n3.mw: 8 -> 88   n4.x: 18 -> 98   n5.x: 36 -> 116                                                           |
+----------------------------------------------------------------------------------------------------------------+
```

Primary state/actions:

- `dynamic.compareEnabled`
- `dynamicDebugger.compareLeftRuntimeName`
- `dynamicDebugger.compareRightRuntimeName`
- `setComparePair(...)`
- `setCompareCursorSync(...)`

## 11. Updated Implementation Plan

### Phase 1. Browser decoder and evaluator

Goal: run GNDY in the browser to completion.

Files:

- `web/src/dynamic/gndy/decode.ts`
- `web/src/dynamic/gndy/interpreter.ts`
- `web/src/dynamic/gndy/runtime.ts`

### Phase 2. Debugger core

Goal: one-instruction stepping with snapshots and history.

Files:

- `web/src/dynamic/gndy/debugger.ts`
- `web/src/dynamic/gndy/diffs.ts`
- `web/src/store/slices/dynamicDebuggerSlice.ts`

### Phase 3. Debugger panels

Goal: make step state visible and actionable.

Files:

- `SlotsPanel.tsx`
- `StackPanel.tsx`
- `DebuggerPanel.tsx`
- `ComparePanel.tsx`

### Phase 4. Runtime editing

Goal: move beyond preset-only runtimes.

Files:

- `RuntimeEditor.tsx`
- `Header.tsx`
- `dynamicSlice.ts`

### Phase 5. Oracle validation

Goal: keep the browser evaluator honest.

Implementation:

1. compare browser full-run output against backend `evaluations`,
2. surface slot mismatches,
3. surface draw-op mismatches,
4. gate step-debugger rollout on parity confidence.

## 12. Testing Strategy

The most important tests are now parity tests, because the static compatibility problem is gone.

Add:

1. opcode decode tests,
2. evaluator unit tests,
3. snapshot diff tests,
4. reducer tests for debugger actions,
5. browser-vs-Python parity tests on committed dynamic examples.

## 13. Risks And Open Questions

### Main risks

1. browser interpreter drift from Python semantics,
2. compare mode complexity arriving before the debugger core is stable,
3. runtime editor UX causing invalid payloads unless parsing and validation are explicit.

### Open questions

1. Should runtime editors use YAML text, JSON text, or a small structured form?
2. Should breakpoints ship in the same phase as step/back/reset or one phase later?
3. Do we want decoded instruction metadata from the backend in phase 1 or later?

## 14. References

- `README.md`
- `web_server.py`
- `web/src/store/slices/compilerSlice.ts`
- `web/src/store/slices/dynamicSlice.ts`
- `web/src/store/slices/inspectorSlice.ts`
- `web/src/components/Header/Header.tsx`
- `web/src/components/Editor/Editor.tsx`
- `web/src/components/Canvas/Canvas.tsx`
- `web/src/components/Inspector/registerPanels.ts`
- `web/src/components/Inspector/panels/EvalPanel.tsx`
- `web/src/components/Inspector/panels/DisassemblyPanel.tsx`
- `web/src/components/Inspector/panels/IRPanel.tsx`
- `web/src/components/Inspector/panels/HexPanel.tsx`
- `web/src/components/Inspector/panels/ManifestPanel.tsx`
- `web/src/engine/dynamicRenderer.ts`
- `gnosis_dynamic_vm/gnosis_dynamic/compiler.py`
- `gnosis_dynamic_vm/gnosis_dynamic/vm.py`
- `gnosis_dynamic_vm/gnosis_dynamic/bytecode.py`
