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
