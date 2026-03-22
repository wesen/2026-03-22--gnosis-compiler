---
Title: Diary
Ticket: GNOSIS-001
Status: active
Topics:
    - compiler
    - webui
    - go
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - /home/manuel/code/wesen/2026-03-22--gnosis-compiler/web_server.py
    - /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_compiler/compiler.py
ExternalSources: []
Summary: Implementation diary for the GNOSIS Compiler Web UI project
LastUpdated: 2026-03-22T12:24:30.177449225-04:00
WhatFor: ""
WhenToUse: ""
---

# Diary

## Goal

Build a browser-based experimentation tool for the GNOSIS layout compiler. Track each implementation step, what worked, what failed, and what to review.

## Step 1: Python web server + compile_with_stages API

The first step was getting a working compile API. Initially the design doc called for a Go server with a Python subprocess bridge, but the user correctly pointed out this was over-engineering for a starting point. Switching to a pure Python Flask server that calls the compiler directly eliminated an entire layer of complexity.

I extended the compiler with `compile_with_stages()` which captures the AST at each pipeline stage (parsed, resolved, canonical, after_dead_elimination, after_flatten, after_classify, laid_out). The server parses YAML/JSON source text directly via `yaml.safe_load` to avoid the `load_source()` file-path detection that breaks on long strings.

### Prompt Context

**User prompt (verbatim):** "add tasks to the ticket, then work on them one by one, keeping a diary as you, committing to git at appropriate intervals (read skills)"

**Assistant interpretation:** Add implementation tasks to the docmgr ticket, work through them sequentially, maintain a diary document, and commit at natural milestones.

**Inferred user intent:** Get a working web UI built incrementally with good documentation of the process.

**Commit (code):** 164bea4 -- "Add Python web server and compile_with_stages API"

### What I did
- Added `Compiler.compile_with_stages()` method that captures intermediate ASTs at each pipeline stage
- Refactored `Compiler.compile()` to share `_compile_from_canonical()` with the new method
- Created `web_server.py` with Flask: `/api/compile`, `/api/presets`, `/api/presets/<name>`, `/api/options`
- Added `_make_json_safe()` helper to convert `Rect` dataclasses and bytes for JSON serialization

### Why
- Need a server to drive the web UI -- the Python compiler can be called directly, no subprocess bridge needed
- Stage snapshots are essential for the AST viewer that shows each compilation phase

### What worked
- `compile_with_stages()` cleanly captures all 7 stages using `copy.deepcopy` at each point
- Flask test client confirms the full round-trip: preset load -> compile -> stages + manifest + disassembly
- Existing tests still pass (no regression in `compile()`)

### What didn't work
- First attempt passed raw YAML text to `load_source()`, which tried to interpret it as a file path and hit `ENAMETOOLONG`. Fixed by parsing source text directly with `yaml.safe_load` in the server.

### What I learned
- `load_source()` has a file-path-first detection heuristic that breaks on long strings. The web server should parse YAML/JSON directly rather than going through `load_source()`.

### What was tricky to build
- N/A -- straightforward once the YAML parsing issue was fixed.

### What warrants a second pair of eyes
- The `_make_json_safe()` recursive converter -- need to ensure no types are missed when serializing the AST (e.g., if new dataclasses are added to the compiler).

### What should be done in the future
- Add more presets (extract from the JSX prototypes' PRESETS objects)
- Consider adding a `/api/compile` WebSocket variant for live-as-you-type

### Code review instructions
- Start at `gnosis_compiler/compiler.py:compile_with_stages()` -- verify stage capture order
- Check `web_server.py:api_compile()` -- verify error handling and JSON serialization
- Run: `python -m unittest tests.test_compiler -v`

### Technical details
- Server requires Flask (`pip install flask`) and PyYAML (already a dependency)
- API response includes `stages` dict with keys: parsed, resolved, canonical, after_dead_elimination, after_flatten, after_classify, laid_out
- Bytecode and binary are base64-encoded in the response

## Step 2: Complete frontend with all inspector panels

Built the entire frontend as a single HTML file (`web/index.html`, 586 lines). The file contains all CSS, JavaScript, and the 5x7 bitmap font data inline — no build step, no dependencies. The frontend auto-compiles on keystroke (400ms debounce), renders the compiled bytecode to an HTML5 canvas with e-ink grain simulation, and provides seven inspector panels covering every compiler artifact.

The JavaScript bytecode interpreter correctly handles all 12 opcodes from the Python compiler using little-endian u16 decoding. The bitmap font is extracted from `gnosis-compiler.jsx` and renders with GLYPH_W=8 spacing to match the compiler's layout calculations. Bind values show the field name as a placeholder but can be overridden via the Bind Simulator panel.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** Continue implementing tasks from the task list.

**Inferred user intent:** Get the full experimentation workbench working end to end.

**Commit (code):** 629c764 — "Add complete frontend with canvas renderer, all inspector panels"

### What I did
- Created `web/index.html` with dark theme matching the existing JSX prototypes' aesthetic
- Implemented JS bytecode interpreter for all 12 Python compiler opcodes (HLINE, VLINE, FILL_RECT, STROKE_RECT, TEXT, BIND_TEXT, BAR, BIND_BAR, CIRCLE, CROSS, NOP, HALT)
- Added 7 inspector panels: Disassembly, AST tree (with stage switching dropdown), Hex dump, Statistics, Manifest (raw JSON), Regions, Bind Simulator
- Added 3 debug overlays: Bounds (depth-colored rectangles), Dirty (refresh regions), Depth (heatmap)
- Added auto-compile with 400ms debounce, preset loading, source/props editor tabs
- Extracted bitmap font from `gnosis-compiler.jsx` (A-Z, a-z, 0-9, punctuation)

### Why
- A single file with no build step is the fastest path to a working experimentation tool
- All panels are needed to make the compiler internals transparent

### What worked
- The bytecode interpreter renders the dashboard preset correctly on first try
- Little-endian decoding matches the Python compiler output perfectly
- Auto-compile gives instant feedback while editing YAML
- The AST stage switching is useful — you can watch nodes disappear through dead elimination

### What didn't work
- N/A — the frontend worked on first integration with the server

### What I learned
- The Python compiler's GLYPH_W=8 with a 5-pixel-wide font means 3px spacing between characters, which looks correct for an 8x8 bitmap font grid
- `ctx.getImageData`/`putImageData` for grain texture needs care with the scale transform

### What was tricky to build
- Getting the bytecode interpreter byte counts right for all 12 opcodes. Each opcode has a different number of operands (ranging from 0 for HALT to 14 bytes for BAR). Had to carefully match `disasm.py`'s decode logic.
- The AST tree viewer needs to handle both `children` arrays and `bar`/`body`/`nav` screen sections.

### What warrants a second pair of eyes
- Bytecode interpreter operand decoding: verify byte counts match the Python lowerer for every opcode
- The Bind Simulator re-renders the entire canvas on each value change — could be optimized for just dirty regions

### What should be done in the future
- Add more presets (calendar, mail, reader, boot, widgets from JSX prototypes)
- Add instruction-to-canvas highlighting (hover disassembly -> highlight pixels)
- Add binary download button
- Consider adding CodeMirror for YAML syntax highlighting

### Code review instructions
- Start at `web/index.html:executeBytecode()` — verify all 12 opcodes decode correctly
- Compare opcode byte counts against `gnosis_compiler/lower.py` emit functions
- Check `renderASTNode()` handles all node types
- Run: `python web_server.py --debug` and open http://localhost:8080
