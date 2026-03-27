---
Title: Implementation Diary
Ticket: GNOSIS-004
Status: active
Topics:
    - compiler
    - webui
    - react
    - frontend
DocType: reference
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: "Chronological diary of GNOSIS-004 analysis and implementation work."
LastUpdated: 2026-03-27T14:53:34.862299263-04:00
WhatFor: ""
WhenToUse: ""
---

# Implementation Diary — GNOSIS-004

## 2026-03-27 — Initial Analysis

### Goal

Create a comprehensive implementation plan for migrating `web/index.html` (620 lines, vanilla JS/CSS/HTML) into a modular, themeable React app with Redux/RTK-Query, preparing the architecture for GNOSIS-003's dynamic VM debug UI.

### What was done

1. **Read GNOSIS-003** thoroughly — the intern handoff package is a 22-section design doc covering dynamic VM mode, 8+ new panels, a browser-side VM interpreter, step debugger, and comparison views. The key takeaway: the current single-file frontend cannot absorb this scope without a framework migration.

2. **Inventoried the current frontend**:
   - `web/index.html`: ~620 lines, CSS grid layout, 7 inspector panels, canvas bytecode executor, overlay system, bind simulator, auto-compile with debounce, resize handle. All state is global `let` variables.
   - `source/gnosis-compiler.jsx` (1086 lines): Unused React component with its own compiler/executor. Contains a complete bytecode compiler class and React rendering — useful as reference.
   - `source/gnosis-engine.jsx` (1063 lines): Unused React rendering engine with layout algorithms and bitmap font rendering.
   - `web_server.py` (185 lines): Flask backend with 4 endpoints (`/api/compile`, `/api/presets`, `/api/presets/<name>`, `/api/options`).
   - No `package.json`, no bundler config, no TypeScript — zero build infrastructure exists.

3. **Mapped the react-modular-themable-storybook skill patterns** onto the workbench:
   - `data-part` selectors map to the 16 named regions in the current HTML (header, editor, canvas-area, inspector panels, etc.)
   - CSS custom properties already exist in the current `:root` block (13 color vars) — these become the token foundation
   - Panel registry pattern handles the extensibility GNOSIS-003 requires (6-8 new panels with mode filtering)

4. **Designed the Redux store** with 4 slices + RTK Query:
   - `compilerSlice`: mode, source/props text, compile result, error, bind values — the core state
   - `editorSlice`: active editor tab
   - `inspectorSlice`: active tab, panel height, AST stage, highlight PC
   - `canvasSlice`: overlay toggles, hover info
   - RTK Query API: replaces all 4 `fetch()` calls with declarative hooks

5. **Wrote the design doc** with 7 migration phases, component architecture, theming strategy, data flow diagrams, Storybook strategy, risk assessment, and open questions.

### Key insights

- **The existing React JSX files are not reusable as-is** — they embed their own compiler/executor and don't use the Flask API. But the `Executor` class in `gnosis-compiler.jsx` and the `drawBitmapText()` in `gnosis-engine.jsx` are good reference for the TypeScript engine extraction.

- **The bitmap font data (BM object) is the largest single block** in the current JS (~40% of non-whitespace code). Extracting it to `engine/bitmapFont.ts` is the single biggest win for readability.

- **The overlay system (bounds, dirty, depth) is surprisingly independent** — three pure functions that take a canvas context and an AST node tree. These extract cleanly.

- **RTK Query's mutation pattern maps perfectly to the compile flow**: the compile button, auto-compile timer, and preset load all trigger the same mutation. Loading/error/success states come for free.

- **The panel registry pattern is the architectural keystone for GNOSIS-003**: instead of hardcoding 7 tab buttons and 7 panel divs, we register panels with mode metadata (`static`, `dynamic`, `both`). GNOSIS-003 just registers its panels.

### What warrants attention in next steps

- The Vite proxy to Flask needs testing — the Flask server currently serves static files from `web/` so the proxy must only catch `/api/*` routes.
- The canvas rendering pipeline must be regression-tested against all presets before cutover.
- The resize handle drag behavior has subtle UX (cursor style, user-select, body-level event listeners) that needs careful porting to React refs.

## 2026-03-27 — Implementation Complete (all 7 phases)

### What was built

All 7 phases executed in a single session with 7 commits:

**Phase 1 — Scaffold** (`c4ab17f`): Vite + React 18 + TypeScript + Redux Toolkit + Storybook 8.6. Flask proxy at `/api/*`. Production build produces ~245KB JS bundle.

**Phase 2 — Engine extraction** (`c5ea6a6`): 4 pure TypeScript modules:
- `engine/bitmapFont.ts`: 65-character glyph set (5x7), `blitChar()`, `blitText()`, palette constants
- `engine/bytecodeExecutor.ts`: 13 opcodes, `readU16LE()`, `executeBytecode()`
- `engine/overlays.ts`: bounds, dirty region, depth overlays with typed `ASTNode`/`Region` interfaces
- `engine/base64.ts`: `base64ToBytes()`

**Phase 3 — Redux store** (`14134be`): 4 slices + RTK Query:
- `compilerSlice`: mode, sourceText/propsText, compileResult, error, bindValues, autoCompile. Extra reducers auto-sync with RTK Query mutation lifecycle.
- `editorSlice`: activeTab (source/props)
- `inspectorSlice`: activeTab, inspectorHeight, astStage, highlightPc
- `canvasSlice`: overlay toggles, hoverInfo
- RTK Query: compile mutation, getPresets/getPreset queries

**Phase 4 — Shell components** (`ac37180`):
- `<Header>`: presets via RTK Query, compile button, auto-compile toggle, status display
- `<Editor>`: tab switch, `<SourceEditor>` and `<PropsEditor>` wired to Redux
- `<Canvas>`: renders bytecode via engine modules, grain texture, overlay dispatch
- `<ResizeHandle>`: drag behavior via document-level mouse listeners
- `useAutoCompile` hook: 400ms debounce, fires RTK Query mutation
- Storybook stories for Header (Default, Compiling, WithError), Editor, Canvas, App

**Phase 5 — Inspector panels** (`2b0477f`):
- 7 panels: `DisassemblyPanel` (click-to-highlight), `ASTPanel` (stage selector, recursive collapsible tree), `HexPanel`, `StatsPanel`, `ManifestPanel`, `RegionsPanel`, `BindSimPanel`
- Inspector uses record-based panel lookup
- `test/storeFactory.tsx` and `test/mockData.ts` for Storybook decorators
- Stories for each panel (Default + Empty variants, Highlighted for disasm)

**Phase 6 — Cutover** (`e7c3751`):
- `web_server.py` updated: serves React build from `web/dist/` at `/`, original at `/legacy`
- Static file resolution checks `dist/` first, then `web/`

**Phase 7 — GNOSIS-003 extension points** (`35ec1a3`):
- Mode switch (STATIC/DYNAMIC) in Header
- `panelRegistry.ts`: `registerPanel()`, `getPanelsForMode()`, `getPanelById()`
- `registerPanels.ts`: all 7 panels registered with mode metadata, comments mark GNOSIS-003 slots
- `dynamicSlice.ts`: runtimeA/B, compareEnabled, debugger state stub
- RTK Query stubs: `compileDynamic`, `getDynamicPresets`
- TabBar and Inspector auto-filter panels by mode

### What went smoothly

- The Storybook peer dependency conflict was the only real snag — pinning all `@storybook/*` to exact `8.6.14` resolved it.
- TypeScript caught zero runtime issues — `noUncheckedIndexedAccess` forced null-safe array access everywhere, which is exactly right for bytecode parsing.
- The `as never` cast in story decorators for `preloadedState` was the pragmatic choice over fighting RTK's generic types in test code.
- The panel registry pattern worked cleanly — registering panels is a one-liner, mode filtering is automatic.

### What to watch for

- **Canvas fidelity**: The grain texture uses random noise, so pixel-perfect comparison with the vanilla version isn't possible. Visual regression testing should compare structure, not pixels.
- **Storybook stories use mock data**: The `MOCK_COMPILE_RESULT` is hand-crafted. For more realistic stories, consider generating fixtures from actual compilation.
- **Dynamic mode is UI-only**: The mode switch renders and filters tabs, but there's no backend for dynamic compilation yet. The RTK Query stubs will 404 until `web_server.py` adds the routes.
- **The `web/dist/` directory is gitignored**: Production builds must be run before the Flask server can serve the React app. Consider a Makefile target or CI step.
