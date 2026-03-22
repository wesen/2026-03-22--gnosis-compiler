---
Title: Web UI Design and Implementation Guide
Ticket: GNOSIS-001
Status: active
Topics:
    - compiler
    - webui
    - go
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - gnosis_compiler/compiler.py
    - gnosis_compiler/dsl.py
    - gnosis_compiler/layout.py
    - gnosis_compiler/lower.py
    - gnosis_compiler/serialize.py
    - gnosis_compiler/model.py
    - gnosis_compiler/constants.py
    - gnosis_compiler/disasm.py
    - gnosis_compiler/cli.py
    - source/gnosis-compiler.jsx
    - source/gnosis-engine.jsx
ExternalSources: []
Summary: Detailed design and implementation guide for a Go web server with web UI for experimenting with the GNOSIS layout compiler
LastUpdated: 2026-03-22T11:06:52.584138654-04:00
WhatFor: ""
WhenToUse: ""
---

# Web UI Design and Implementation Guide

## For New Engineers: A Complete Guide to Building the GNOSIS Compiler Web Experimentation Tool

---

## Executive Summary

This document is a comprehensive design and implementation guide for building a Go web server with a browser-based UI that lets you interactively experiment with the GNOSIS layout compiler. The tool will let you edit screen definitions in YAML/JSON, compile them through the full pipeline, visualize every intermediate representation, inspect the bytecode, render the final screen on a canvas, and explore the compiler's internals -- all in real time.

The goal is not just "a web UI for the compiler." It is an **experimentation workbench** that makes the compiler's behavior transparent: you should be able to see exactly what each compilation stage does, why the layout engine placed a widget where it did, which parts of the screen are static vs. dynamic, how the bytecode encodes the screen, and how the refresh regions map to bind sites. Think of it as a debugger and teaching tool combined.

**Why Go?** The Python compiler already works and has well-separated stages. The Go web server wraps it (initially by calling the Python compiler as a subprocess, later by reimplementing in Go) and serves a modern web frontend. Go is natural for the web server because it has excellent HTTP support, easy static file embedding, and eventual alignment with the MCU-adjacent tooling that will ship the GNBC binaries to devices.

---

## 1. Understanding the System You Are Wrapping

Before you write any code, you need to understand what the GNOSIS compiler does and what data it produces. This section is the orientation every new engineer needs.

### 1.1 What Is the GNOSIS Compiler?

The GNOSIS compiler takes a declarative screen description (written in YAML or JSON) and compiles it into a compact bytecode program that a memory-constrained microcontroller (20 KB RAM, ARM Cortex-M4) can interpret to draw and refresh an e-ink display (400x300 pixels, 1-bit depth).

The key insight: this is a real compiler with a front-end, middle-end, and back-end, not just a layout engine. The compiler performs partial evaluation -- resolving everything it can at compile time so the MCU runtime does as little work as possible.

### 1.2 The Compilation Pipeline

Here is the pipeline in plain English, showing what each stage takes as input and produces as output:

```
                    +------------------+
                    |  YAML/JSON file  |  <-- authored by a human
                    |  + Props file    |  <-- compile-time parameters
                    +--------+---------+
                             |
                    [1] FRONT-END (dsl.py)
                    Parse YAML/JSON, substitute props,
                    normalize aliases, validate types
                             |
                             v
                    +------------------+
                    | Canonical AST    |  <-- one uniform tree representation
                    +--------+---------+
                             |
                    [2] MIDDLE-END (passes.py)
                    Remove dead nodes, flatten boxes,
                    assign IDs, classify static/dynamic
                             |
                             v
                    +------------------+
                    | Optimized AST    |  <-- cleaner, smaller tree
                    +--------+---------+
                             |
                    [3a] LAYOUT (layout.py)
                    Compute pixel rectangles for every node.
                    Precompute text widths, visible rows, etc.
                             |
                             v
                    +------------------+
                    | Laid-out AST     |  <-- every node has rect(x,y,w,h)
                    +--------+---------+
                             |
                    [3b] LOWERING (lower.py)
                    Walk tree, emit bytecode instructions,
                    intern strings, track bind sites
                             |
                             v
                    +------------------+
                    | Bytecode + Meta  |  <-- code bytes + string pool +
                    |                  |      bind table + regions
                    +--------+---------+
                             |
                    [3c] SERIALIZATION (serialize.py)
                    Pack into GNBC binary format
                             |
                             v
                    +------------------+
                    | GNBC Binary      |  <-- single blob for MCU
                    +------------------+
```

**Your web UI needs to expose every one of these intermediate representations.** That is what makes it a useful experimentation tool rather than just a "compile and show result" demo.

### 1.3 The Data the Compiler Produces

After compilation, you get a `Program` object containing:

| Field | Type | What It Is |
|-------|------|------------|
| `code` | bytes | Raw bytecode instruction stream |
| `strings` | list of strings | Interned string pool (static text) |
| `binds` | list of strings | Runtime binding names (e.g., "sensor.roll") |
| `bind_sites` | list of BindSite | Where each bind draws on screen |
| `regions` | list of RefreshRegion | Merged refresh rectangles for EPD |
| `stats` | dict | Per-pass statistics (node counts, sizes) |
| `ast` | dict | The final laid-out AST tree |
| `binary` | bytes | Serialized GNBC file |

Plus, the disassembler can convert `code` back to human-readable assembly text.

The web UI should display all of these, plus the intermediate ASTs (canonical, optimized, laid-out).

---

## 2. Architecture of the Web Experimentation Tool

### 2.1 High-Level Architecture

```
+-------------------------------------------------------+
|                    BROWSER                             |
|                                                        |
|  +------------------+  +----------------------------+  |
|  | YAML/JSON Editor |  | Canvas (EPD simulation)    |  |
|  | Props Editor     |  | + Debug overlays           |  |
|  +--------+---------+  +----------------------------+  |
|           |                                            |
|  +--------v---------+  +----------------------------+  |
|  | Controls         |  | Inspector Panels:          |  |
|  | (compile, reset, |  | - AST viewer (per stage)   |  |
|  |  presets, opts)   |  | - Disassembly listing      |  |
|  +--------+---------+  | - Hex dump                  |  |
|           |             | - Stats dashboard           |  |
|           |             | - Manifest viewer           |  |
|           |             | - Bind/Region inspector     |  |
|           |             +----------------------------+  |
|           |                                            |
+-----------|--------------------------------------------+
            | HTTP/JSON API (and WebSocket for live updates)
            |
+-----------v--------------------------------------------+
|                    GO WEB SERVER                        |
|                                                        |
|  +------------------+  +----------------------------+  |
|  | HTTP Router      |  | Static File Server         |  |
|  | (net/http or     |  | (embedded via go:embed)    |  |
|  |  chi/echo)       |  +----------------------------+  |
|  +--------+---------+                                  |
|           |                                            |
|  +--------v---------+  +----------------------------+  |
|  | /api/compile     |  | /api/presets               |  |
|  | /api/disassemble |  | /api/options               |  |
|  | /api/layout-only |  | /ws (WebSocket, optional)  |  |
|  +--------+---------+  +----------------------------+  |
|           |                                            |
|  +--------v---------+                                  |
|  | Compiler Bridge   |                                 |
|  | (calls Python or  |                                 |
|  |  native Go impl)  |                                 |
|  +-------------------+                                 |
+---------------------------------------------------------+
```

### 2.2 Two-Phase Strategy

**Phase 1 (Quick Start): Python Bridge**

The Go server calls the Python compiler as a subprocess. This gets you a working web UI immediately without reimplementing the compiler in Go.

```
Go server -> subprocess: python -m gnosis_compiler ... -> parse JSON output
```

The Python CLI already prints a JSON manifest to stdout. You just need to capture that plus the intermediate ASTs (which requires a small extension to the Python CLI).

**Phase 2 (Full Implementation): Native Go Compiler**

Reimplement the compiler stages in Go for better performance and single-binary deployment. The Go implementation follows the same architecture as Python -- the stages are well-documented and modular.

This document focuses primarily on the architecture that supports both phases.

### 2.3 Go Server Components

The Go server has these responsibilities:

1. **Serve the frontend** (HTML, JS, CSS) -- embedded via `go:embed`
2. **Expose a compilation API** -- accept DSL + props, return compiled results
3. **Expose intermediate artifacts** -- ASTs at each stage, not just final output
4. **Manage presets** -- load and serve example screen definitions
5. **Optional: WebSocket** -- push compilation results on save (live preview)

---

## 3. API Design

### 3.1 Core Compilation Endpoint

```
POST /api/compile
Content-Type: application/json

Request Body:
{
    "source": "type: screen\nwidth: 400\n...",   // YAML or JSON string
    "props": "title: GNOSIS//NAV\n...",           // YAML or JSON string (optional)
    "options": {
        "width": 400,
        "height": 280,
        "glyph_w": 8,
        "glyph_h": 8,
        "region_merge_threshold": 512
    }
}

Response Body:
{
    "success": true,
    "error": null,

    // Intermediate representations
    "stages": {
        "parsed": { ... },          // raw parsed AST (after load, before normalize)
        "canonical": { ... },       // after normalization
        "after_dead_elimination": { ... },
        "after_flatten": { ... },
        "after_ids": { ... },
        "after_static_mark": { ... },
        "laid_out": { ... }         // final AST with rect on every node
    },

    // Compilation output
    "program": {
        "width": 400,
        "height": 280,
        "code_size": 205,
        "strings": ["GNOSIS//NAV", "LINK", ...],
        "binds": ["sensor.roll", "sensor.temp"],
        "bind_sites": [
            {
                "bind_id": 0,
                "bind_name": "sensor.roll",
                "rect": {"x": 8, "y": 40, "w": 48, "h": 16},
                "waveform": "part",
                "node_id": "n4",
                "opcode_offset": 46
            }
        ],
        "regions": [
            {
                "rect": {"x": 8, "y": 40, "w": 48, "h": 16},
                "waveform": "part",
                "bind_ids": [0],
                "bind_names": ["sensor.roll"]
            }
        ],
        "stats": {
            "input_nodes": 19,
            "final_nodes": 19,
            "dynamic_nodes": 5,
            "static_nodes": 14,
            "passes": [
                {"name": "dead_node_elimination", "before": 19, "after": 19},
                {"name": "flatten_boxes", "before": 19, "after": 19}
            ]
        }
    },

    // Bytecode artifacts
    "disassembly": "0000: HLINE ...\n0008: TEXT ...\n...",
    "bytecode_hex": "01 00 00 0f 00 90 01 02 ...",
    "bytecode_base64": "AQAADwCQAQ...",
    "binary_base64": "R05CQwEA..."   // full GNBC binary
}
```

This is the central API call. The frontend sends the DSL source and props, and gets back everything it needs to render all panels.

### 3.2 Preset Endpoints

```
GET /api/presets
Response: {
    "presets": [
        {"name": "dashboard", "description": "Navigation dashboard with telemetry"},
        {"name": "calendar", "description": "Calendar with temporal grid"}
    ]
}

GET /api/presets/:name
Response: {
    "name": "dashboard",
    "source": "type: screen\nwidth: 400\n...",
    "props": "title: GNOSIS//NAV\n..."
}
```

### 3.3 Options Endpoint

```
GET /api/options
Response: {
    "defaults": {
        "width": 400,
        "height": 300,
        "glyph_w": 8,
        "glyph_h": 8,
        "region_merge_threshold": 512
    },
    "node_types": ["screen", "vbox", "hbox", "fixed", ...],
    "color_names": {"0": "bg", "1": "fg", "2": "mid", "3": "light", "4": "ghost"},
    "waveform_names": {"0": "full", "1": "part", "2": "fast"},
    "opcode_names": {"0": "NOP", "1": "HLINE", ...}
}
```

### 3.4 Optional WebSocket

```
WS /ws

Client -> Server: { "type": "compile", "source": "...", "props": "..." }
Server -> Client: { "type": "result", "data": { ... same as POST response ... } }
Server -> Client: { "type": "error", "message": "..." }
```

WebSocket enables live-as-you-type compilation. The frontend debounces keystrokes (e.g., 300ms) and sends updated source. The server compiles and pushes results back. This gives a "live preview" experience similar to the existing React prototypes.

---

## 4. Go Server Implementation Guide

### 4.1 Project Structure

```
cmd/
    gnosis-web/
        main.go              # entry point, flag parsing, server startup

internal/
    server/
        server.go            # HTTP handler setup, routes
        compile.go           # /api/compile handler
        presets.go           # /api/presets handlers
        options.go           # /api/options handler
        websocket.go         # WebSocket handler (optional)

    compiler/
        bridge.go            # Python subprocess bridge (Phase 1)
        compiler.go          # Native Go compiler (Phase 2)
        types.go             # Go types mirroring Python model.py

    presets/
        presets.go           # Preset loader
        embed.go             # Embedded preset YAML files

web/
    index.html               # Main HTML page
    app.js                   # Frontend JavaScript (or React/Vite build)
    style.css                # Styles
    components/
        editor.js            # YAML/JSON editor (CodeMirror)
        canvas.js            # EPD canvas renderer
        ast-viewer.js        # AST tree viewer
        disassembly.js       # Disassembly listing
        hex-dump.js          # Hex dump view
        stats.js             # Statistics dashboard
        manifest.js          # Manifest/metadata viewer
        regions.js           # Refresh region inspector

presets/
    dashboard.yaml           # Example screens
    dashboard.props.yaml
    ...

go.mod
go.sum
Makefile
```

### 4.2 Entry Point (main.go)

The entry point should:
1. Parse flags (port, Python path, dev mode)
2. Initialize the compiler bridge
3. Load presets
4. Set up HTTP routes
5. Start listening

```
Pseudocode for main.go:

func main():
    flags:
        -port         int    (default 8080)
        -python       string (default "python")
        -dev          bool   (default false)
        -compiler-dir string (path to gnosis_compiler package)

    bridge = NewPythonBridge(flags.python, flags.compilerDir)
    presets = LoadPresets("presets/")
    server = NewServer(bridge, presets)

    if flags.dev:
        // serve web/ directory directly (hot reload)
    else:
        // serve embedded web/ via go:embed

    http.ListenAndServe(":"+port, server.Router())
```

### 4.3 Python Bridge (bridge.go)

The bridge calls the Python compiler as a subprocess and parses its output.

**Current limitation:** The Python CLI only outputs the final manifest. To get intermediate ASTs, we need to either:
- (a) Add a `--debug-stages` flag to the Python CLI that dumps all intermediate ASTs
- (b) Write a small Python wrapper script that calls the compiler's internal functions and outputs all stages
- (c) Use the Python API via a small JSON-RPC server

**Recommended approach:** Option (b) -- a wrapper script.

```python
# compile_with_stages.py (run by Go bridge)
import json, sys, base64
from gnosis_compiler.compiler import Compiler, CompileOptions
from gnosis_compiler.dsl import load_source, resolve_props, normalize_screen
from gnosis_compiler.disasm import disassemble_code

request = json.loads(sys.stdin.read())

# Parse
loaded = load_source(request["source"])
props = load_source(request["props"]) if request.get("props") else None

# Stage: resolved
resolved = resolve_props(loaded, props)

# Stage: canonical
canonical = normalize_screen(resolved)

# Full compilation
options = request.get("options", {})
compiler = Compiler(CompileOptions(**options))
program = compiler.compile(request["source"], props)

# Output everything
result = {
    "success": True,
    "stages": {
        "parsed": loaded,
        "resolved": resolved,
        "canonical": canonical,
        "laid_out": program.ast,
    },
    "program": program.to_manifest(),
    "disassembly": disassemble_code(program.code, program.strings, program.binds),
    "bytecode_base64": base64.b64encode(program.code).decode(),
    "binary_base64": base64.b64encode(program.binary).decode() if program.binary else None,
}
json.dump(result, sys.stdout)
```

The Go bridge calls this script:

```
Pseudocode for bridge.go:

type PythonBridge struct {
    pythonPath  string
    scriptPath  string
}

func (b *PythonBridge) Compile(req CompileRequest) (*CompileResult, error):
    input = json.Marshal(req)
    cmd = exec.Command(b.pythonPath, b.scriptPath)
    cmd.Stdin = bytes.NewReader(input)
    output, err = cmd.Output()
    if err != nil:
        return nil, parse stderr for error message
    var result CompileResult
    json.Unmarshal(output, &result)
    return &result, nil
```

### 4.4 Go Type Definitions (types.go)

These mirror the Python data structures:

```go
// Pseudocode / Go-like type definitions

type Rect struct {
    X int `json:"x"`
    Y int `json:"y"`
    W int `json:"w"`
    H int `json:"h"`
}

type CompileOptions struct {
    Width                int `json:"width"`
    Height               int `json:"height"`
    GlyphW               int `json:"glyph_w"`
    GlyphH               int `json:"glyph_h"`
    RegionMergeThreshold int `json:"region_merge_threshold"`
}

type BindSite struct {
    BindID       int    `json:"bind_id"`
    BindName     string `json:"bind_name"`
    Rect         Rect   `json:"rect"`
    Waveform     string `json:"waveform"`
    NodeID       string `json:"node_id"`
    OpcodeOffset int    `json:"opcode_offset"`
}

type RefreshRegion struct {
    Rect      Rect     `json:"rect"`
    Waveform  string   `json:"waveform"`
    BindIDs   []int    `json:"bind_ids"`
    BindNames []string `json:"bind_names"`
}

type PassStats struct {
    Name   string `json:"name"`
    Before int    `json:"before"`
    After  int    `json:"after"`
}

type CompileRequest struct {
    Source  string          `json:"source"`
    Props   string          `json:"props,omitempty"`
    Options *CompileOptions `json:"options,omitempty"`
}

type CompileResult struct {
    Success bool   `json:"success"`
    Error   string `json:"error,omitempty"`

    Stages map[string]interface{} `json:"stages"`

    Program struct {
        Width      int              `json:"width"`
        Height     int              `json:"height"`
        CodeSize   int              `json:"code_size"`
        Strings    []string         `json:"strings"`
        Binds      []string         `json:"binds"`
        BindSites  []BindSite       `json:"bind_sites"`
        Regions    []RefreshRegion  `json:"regions"`
        Stats      CompileStats     `json:"stats"`
    } `json:"program"`

    Disassembly   string `json:"disassembly"`
    BytecodeB64   string `json:"bytecode_base64"`
    BinaryB64     string `json:"binary_base64"`
}
```

### 4.5 HTTP Handlers (compile.go)

```
Pseudocode for the compile handler:

func (s *Server) handleCompile(w http.ResponseWriter, r *http.Request):
    var req CompileRequest
    json.NewDecoder(r.Body).Decode(&req)

    if req.Source == "":
        http.Error(w, "source is required", 400)
        return

    if req.Options == nil:
        req.Options = &CompileOptions{Width: 400, Height: 300, GlyphW: 8, GlyphH: 8}

    result, err = s.bridge.Compile(req)
    if err != nil:
        json.NewEncoder(w).Encode(CompileResult{Success: false, Error: err.Error()})
        return

    result.Success = true
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
```

### 4.6 Static File Embedding

```go
// Pseudocode for embedding

//go:embed web/*
var webFS embed.FS

func (s *Server) setupRoutes():
    s.router.POST("/api/compile", s.handleCompile)
    s.router.GET("/api/presets", s.handlePresets)
    s.router.GET("/api/presets/:name", s.handlePreset)
    s.router.GET("/api/options", s.handleOptions)

    if s.devMode:
        s.router.Handle("/*", http.FileServer(http.Dir("web/")))
    else:
        sub, _ = fs.Sub(webFS, "web")
        s.router.Handle("/*", http.FileServer(http.FS(sub)))
```

---

## 5. Frontend Design

### 5.1 Layout

The frontend is a single-page application with a multi-panel layout:

```
+------------------------------------------------------------------+
|  GNOSIS // COMPILER WORKBENCH                         [presets v] |
+------------------------------------------------------------------+
|                    |                                              |
|   SOURCE EDITOR    |    CANVAS / VISUALIZATION                   |
|   (YAML/JSON)      |    (EPD simulation + debug overlays)        |
|                    |                                              |
|   +-- props tab ---+    [bounds] [depth] [dirty] [cross]         |
|   PROPS EDITOR     |                                              |
|   (YAML/JSON)      |    Hover info: type=label rect=(8,24,32,8)  |
|                    |                                              |
+--------------------+----------------------------------------------+
|  [AST] [ASM] [HEX] [STATS] [MANIFEST] [REGIONS] [BINARY]       |
+------------------------------------------------------------------+
|                                                                  |
|  INSPECTOR PANEL (tabbed)                                        |
|  Shows selected view: AST tree, disassembly, hex dump, etc.     |
|                                                                  |
+------------------------------------------------------------------+
```

The layout has three main areas:

1. **Left column**: Source and props editors (stacked vertically, resizable split)
2. **Right top**: Canvas visualization with debug overlay toggles
3. **Bottom**: Tabbed inspector panel with multiple views

### 5.2 Component Breakdown

#### 5.2.1 Source Editor

A code editor for the YAML/JSON screen definition. Should support:
- Syntax highlighting for YAML
- Error underlining (when compilation fails)
- Line numbers
- Auto-indent

**Recommended library**: CodeMirror 6 with YAML language support. Alternatively, Monaco Editor (VS Code's editor). For a simpler approach, a `<textarea>` with a monospace font works but lacks highlighting.

The editor sends its content to the compilation API on changes (debounced by ~300ms).

#### 5.2.2 Props Editor

A second editor for the props file. Same technology as the source editor. Shown as a collapsible tab below the source editor.

#### 5.2.3 Canvas Renderer

An HTML5 `<canvas>` element that renders the compiled screen. This is a **JavaScript bytecode interpreter** running in the browser that reads the compiled bytecode and draws to the canvas.

The canvas renderer needs:

1. **E-ink palette**: Use the 5 colors from `constants.py`:
   ```javascript
   const PALETTE = {
       0: "#d8d4cc",  // BG
       1: "#2a2a28",  // FG
       2: "#9e9a92",  // MID
       3: "#c4c0b8",  // LIGHT
       4: "#b8b4ac",  // GHOST
   };
   ```

2. **Bitmap font**: A 5x7 or 8x8 monospace bitmap font. The existing `gnosis-compiler.jsx` has a complete 5x7 font in the `BITMAPS` object -- reuse that.

3. **Bytecode interpreter**: Walk the bytecode, decode each instruction, and draw. The disassembler in `disasm.py` is the reference for the byte layout of each instruction.

4. **Debug overlays** (toggled by buttons):
   - **Bounds**: Draw colored rectangles around every node's `rect` from the laid-out AST. Use depth-based hue: `hsl(depth * 30, 60%, 50%)`.
   - **Depth**: Fill each node's rect with a semi-transparent heatmap color based on tree depth.
   - **Dirty**: Draw the refresh regions from `program.regions` as colored rectangles with waveform labels.
   - **Cross**: Draw centerline crosshairs on the canvas.

5. **Hover inspection**: On mousemove, find which node's `rect` contains the cursor. Show a tooltip with type, rect, depth, static/dynamic, waveform, bind name.

```
Pseudocode for canvas renderer:

function renderScreen(ctx, program, overlays):
    // Clear with e-ink background
    ctx.fillStyle = PALETTE[0]
    ctx.fillRect(0, 0, program.width, program.height)

    // Optional: add grain noise for e-ink realism
    addGrain(ctx, program.width, program.height)

    // Execute bytecode
    executeBytecode(ctx, program.bytecodeBytes, program.strings)

    // Draw overlays
    if overlays.bounds:
        drawBoundsOverlay(ctx, program.stages.laid_out)
    if overlays.dirty:
        drawDirtyOverlay(ctx, program.regions)
    if overlays.depth:
        drawDepthOverlay(ctx, program.stages.laid_out)
    if overlays.cross:
        drawCrossOverlay(ctx, program.width, program.height)
```

**Important**: The Python compiler uses **little-endian** u16, while the existing JSX prototypes use big-endian. Your canvas renderer must use **little-endian** to match the Python compiler's output.

#### 5.2.4 AST Viewer

A tree visualization of the AST at any compilation stage. The API returns `stages` with the AST at each point. The viewer shows:

- Collapsible tree nodes
- Each node displays: type, id, key properties
- Highlight differences between stages (e.g., nodes removed by dead elimination)
- Click a node to highlight its `rect` on the canvas

The viewer should support switching between stages via a dropdown:
- Parsed (raw)
- Canonical (after normalization)
- After dead elimination
- After flatten
- After ID assignment + static marking
- Laid out (final)

#### 5.2.5 Disassembly View

A scrollable list showing each bytecode instruction, matching the output of `disasm.py`:

```
OFFSET  OPCODE       OPERANDS
0000    HLINE        x=0 y=15 w=400 color=mid
0008    TEXT         x=0 y=0 size=1 color=fg max=11 string[0]='GNOSIS//NAV'
0012    TEXT         x=368 y=0 size=1 color=ghost max=4 string[1]='LINK'
```

**Interactive features:**
- Hover an instruction -> highlight the corresponding pixels on the canvas
- Click an instruction -> scroll to the corresponding node in the AST viewer
- Show byte count and percentage of total for each instruction

#### 5.2.6 Hex Dump View

A hex dump of the raw bytecode (and optionally the full GNBC binary):

```
OFFSET   HEX                                              ASCII
0000     01 00 00 0F 00 90 01 02  10 00 00 00 01 0B 00 00   ................
0010     47 4E 4F 53 49 53 2F 2F  4E 41 56 10 70 01 00 04   GNOSIS//NAV.p...
```

Highlight bytes corresponding to the hovered instruction in the disassembly view.

#### 5.2.7 Statistics Dashboard

A summary panel showing compilation metrics:

```
+-------------------+    +--------------------+    +-------------------+
| NODES             |    | BYTECODE           |    | BINDS             |
| Input:    19      |    | Code size: 205 B   |    | Count: 2          |
| Final:    19      |    | Instructions: 23   |    | sensor.roll       |
| Static:   14      |    | Binary: 371 B      |    | sensor.temp       |
| Dynamic:  5       |    | Strings: 13        |    +-------------------+
+-------------------+    +--------------------+
|                                               |
| PASSES                                        |
| dead_node_elimination:  19 -> 19 (0 removed)  |
| flatten_boxes:          19 -> 19 (0 removed)  |
+-----------------------------------------------+

| REFRESH REGIONS (3)                           |
| Region 0: (8,40 48x16) part [sensor.roll]    |
| Region 1: (8,72 168x4) part [sensor.roll]    |
| Region 2: (8,120 64x16) fast [sensor.temp]   |
+-----------------------------------------------+
```

#### 5.2.8 Manifest Viewer

A formatted JSON view of the full manifest, with collapsible sections for strings, binds, bind_sites, regions, and stats.

#### 5.2.9 Refresh Region Inspector

Specialized view showing:
- Each refresh region with its bounding rectangle, waveform, and bound bind names
- A minimap of the screen showing region outlines
- Bind name -> region mapping table
- Waveform distribution (how many fast/part/full regions)

### 5.3 Preset System

The UI should have a dropdown to quickly load preset screen definitions. Presets are loaded from the Go server's `/api/presets` endpoint. Each preset has:
- A name and description
- A source YAML file
- An optional props YAML file

The existing `examples/dashboard.yaml` + `examples/dashboard.props.yaml` are the first preset. Additional presets can be extracted from the JSX prototypes' `PRESETS` object (dashboard, calendar, mail inbox, reader, boot, widget gallery).

### 5.4 Controls

- **Compile button**: Triggers compilation (or auto-compile on change)
- **Auto-compile toggle**: Enable/disable compile-on-change
- **Preset selector**: Dropdown to load presets
- **Options panel**: Width, height, glyph_w, glyph_h, merge threshold
- **Export buttons**: Download GNBC binary, download disassembly, download manifest JSON
- **Reset**: Clear editor and start fresh

---

## 6. Frontend-Backend Communication Flow

Here is the complete flow for a typical interaction:

```
1. User types YAML in the source editor

2. After 300ms debounce, frontend sends:
   POST /api/compile { source: "...", props: "..." }

3. Go server receives request, calls Python bridge:
   echo '{"source":"...","props":"..."}' | python compile_with_stages.py

4. Python script:
   a. load_source() -> parsed AST
   b. resolve_props() -> resolved AST
   c. normalize_screen() -> canonical AST
   d. Compiler.compile() -> runs passes, layout, lowering, serialization
   e. Outputs JSON with all stages + program + disassembly + binary

5. Go server parses JSON, returns to frontend

6. Frontend updates all panels:
   a. Canvas re-renders with new bytecode
   b. AST viewer updates tree
   c. Disassembly view updates
   d. Statistics refresh
   e. Error display clears (or shows new error)

7. User hovers over canvas:
   a. Frontend finds node under cursor from laid_out AST
   b. Tooltip shows node info
   c. Corresponding disassembly line highlights

8. User clicks disassembly line:
   a. Canvas highlights the instruction's draw area
   b. AST viewer scrolls to the corresponding node
```

---

## 7. Key Files You Need to Understand

This section maps every Python source file to what you need to know to either call it or reimplement it.

### 7.1 gnosis_compiler/compiler.py (116 lines)

**What it does:** Orchestrates the full compilation pipeline. The `Compiler` class is the single entry point.

**Key method:** `compile(source, props) -> Program`

**Internal flow:**
1. `prepare_source(source, props)` -- front-end
2. `eliminate_dead_nodes()` -- pass 1
3. `flatten_boxes()` twice -- passes 2-3
4. `assign_ids()` -- pass 4
5. `mark_static()` -- pass 5
6. `layout_screen()` -- layout
7. `lower_screen()` -- bytecode emission
8. `merge_regions()` -- region analysis
9. `serialize_program()` -- binary output

**For the Go rewrite:** This file is the roadmap. Reimplement `Compiler.compile()` by calling each stage function in the same order.

### 7.2 gnosis_compiler/dsl.py (215 lines)

**What it does:** The entire front-end. Parsing, prop substitution, and AST normalization.

**Key functions:**
- `load_source(source)` -- YAML/JSON parsing with auto-detection
- `resolve_props(value, props)` -- recursive prop substitution (`{{...}}` and `$prop`)
- `normalize_screen(source_ast)` -- alias normalization, type validation, screen wrapping

**For the Go rewrite:**
- Use `gopkg.in/yaml.v3` for YAML parsing
- Implement `resolve_props` as a recursive tree walk over `map[string]interface{}`
- Implement `normalize_screen` using the same alias rules documented in the code

### 7.3 gnosis_compiler/passes.py (115 lines)

**What it does:** Four AST transformation passes.

**Key functions:**
- `eliminate_dead_nodes(node)` -- removes invisible and false-cond nodes
- `flatten_boxes(node)` -- merges nested same-axis containers
- `assign_ids(node)` -- sequential ID assignment
- `mark_static(node)` -- bottom-up static/dynamic classification

**For the Go rewrite:** These are straightforward tree walks. Each function takes a node (`map[string]interface{}`) and returns a transformed node. The Go version works on the same generic map structure.

### 7.4 gnosis_compiler/layout.py (235 lines)

**What it does:** Compile-time layout engine. Computes pixel rectangles for every node.

**Key functions:**
- `layout_screen(screen, width, height, glyph_w, glyph_h)` -- entry point
- `layout_node(node, x, y, w, h, ...)` -- dispatch by type
- `layout_vbox(...)` -- two-pass vertical flex layout
- `layout_hbox(...)` -- two-pass horizontal flex (+ split-pane)
- `layout_fixed(...)` -- absolute positioning with intrinsic sizing
- `layout_leaf(...)` -- terminal measurement (max_visible_chars, visible_rows)

**For the Go rewrite:** This is the most algorithmically interesting file. The formal specification is in `source/gnosis-layout-algorithm.md`. Implement from the spec; use the Python code as reference for edge cases.

### 7.5 gnosis_compiler/lower.py (419 lines)

**What it does:** Converts the laid-out AST to bytecode. The largest file.

**Key functions:**
- `lower_screen(screen)` -- walks bar/body/nav, returns (code, strings, binds, bind_sites)
- `lower_node(node, ...)` -- recursive dispatch by type
- `lower_list(node, ...)` -- lowers static lists to TEXT instructions
- `lower_grid(node, ...)` -- lowers static grids to TEXT instructions
- `merge_regions(bind_sites, threshold)` -- greedy region merging

**For the Go rewrite:** Create a ByteWriter that accumulates `[]byte`. For each node type, emit the appropriate opcodes with little-endian operands.

### 7.6 gnosis_compiler/serialize.py (85 lines)

**What it does:** Packs compilation output into the GNBC binary format.

**Binary format (all little-endian):**
```
Header: magic("GNBC") version(u8) flags(u8) width(u16) height(u16)
        strings_off(u16) strings_count(u16)
        binds_off(u16) binds_count(u16)
        regions_off(u16) regions_count(u16)
        code_off(u16) code_size(u16)
String section: [len(u16) utf8bytes...]...
Bind section: [len(u16) utf8bytes...]...
Region section: [x(u16) y(u16) w(u16) h(u16) waveform(u8) count(u8) ids...]...
Code section: raw bytecode
```

**For the Go rewrite:** Use `encoding/binary` with `binary.LittleEndian`.

### 7.7 gnosis_compiler/disasm.py (147 lines)

**What it does:** Disassembles bytecode into human-readable text.

**Key function:** `disassemble_code(code, strings, binds) -> str`

**For the Go rewrite:** Direct port. Walk bytes with a PC, switch on opcode, format strings.

---

## 8. Canvas Rendering: Detailed Bytecode Interpreter

This section provides the complete specification for the JavaScript bytecode interpreter that renders to the HTML5 canvas.

### 8.1 Reading Bytecode Values

```javascript
// Little-endian u16 (matches Python compiler output)
function readU16LE(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
}
```

### 8.2 Bitmap Font

Reuse the BITMAPS object from `gnosis-compiler.jsx` (5x7 pixel bitmaps for A-Z, 0-9, punctuation). The blitting function:

```javascript
function blitChar(ctx, ch, x, y, size, colorHex) {
    const bm = BITMAPS[ch] || BITMAPS[" "];
    ctx.fillStyle = colorHex;
    for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
            if (bm[row] & (1 << (4 - col))) {
                ctx.fillRect(x + col * size, y + row * size, size, size);
            }
        }
    }
}

function blitText(ctx, x, y, text, size, colorId, maxChars) {
    const colorHex = PALETTE[colorId];
    const displayText = text.slice(0, maxChars || text.length);
    const glyphW = 8;  // Must match compiler's GLYPH_W
    for (let i = 0; i < displayText.length; i++) {
        blitChar(ctx, displayText[i], x + i * glyphW * size, y, size, colorHex);
    }
}
```

**Note on glyph width:** The Python compiler uses GLYPH_W=8, but the bitmap font in the JSX prototype is 5 pixels wide with 1 pixel spacing (effectively 6px). For the web UI, you should use 8px glyph width to match the compiler's layout calculations. The bitmap font has 5-pixel-wide glyphs, so there will be 3 pixels of spacing between characters -- this matches the actual MCU rendering behavior with an 8x8 font.

### 8.3 Complete Instruction Decode Table

```javascript
function executeInstruction(ctx, bytes, pc, strings, binds) {
    const op = bytes[pc]; pc++;

    switch (op) {
        case 0x00: break; // NOP

        case 0x01: { // HLINE: x(u16) y(u16) w(u16) color(u8)
            const x = readU16LE(bytes, pc); pc += 2;
            const y = readU16LE(bytes, pc); pc += 2;
            const w = readU16LE(bytes, pc); pc += 2;
            const color = bytes[pc]; pc++;
            ctx.fillStyle = PALETTE[color];
            ctx.fillRect(x, y, w, 1);
            break;
        }

        case 0x02: { // VLINE: x(u16) y(u16) h(u16) color(u8)
            const x = readU16LE(bytes, pc); pc += 2;
            const y = readU16LE(bytes, pc); pc += 2;
            const h = readU16LE(bytes, pc); pc += 2;
            const color = bytes[pc]; pc++;
            ctx.fillStyle = PALETTE[color];
            ctx.fillRect(x, y, 1, h);
            break;
        }

        case 0x03: { // FILL_RECT: x(u16) y(u16) w(u16) h(u16) color(u8)
            const x = readU16LE(bytes, pc); pc += 2;
            const y = readU16LE(bytes, pc); pc += 2;
            const w = readU16LE(bytes, pc); pc += 2;
            const h = readU16LE(bytes, pc); pc += 2;
            const color = bytes[pc]; pc++;
            ctx.fillStyle = PALETTE[color];
            ctx.fillRect(x, y, w, h);
            break;
        }

        case 0x04: { // STROKE_RECT: x(u16) y(u16) w(u16) h(u16) color(u8)
            const x = readU16LE(bytes, pc); pc += 2;
            const y = readU16LE(bytes, pc); pc += 2;
            const w = readU16LE(bytes, pc); pc += 2;
            const h = readU16LE(bytes, pc); pc += 2;
            const color = bytes[pc]; pc++;
            ctx.strokeStyle = PALETTE[color];
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
            break;
        }

        case 0x10: { // TEXT: x(u16) y(u16) size(u8) color(u8) max(u8) string_id(u16)
            const x = readU16LE(bytes, pc); pc += 2;
            const y = readU16LE(bytes, pc); pc += 2;
            const size = bytes[pc]; pc++;
            const color = bytes[pc]; pc++;
            const maxChars = bytes[pc]; pc++;
            const stringId = readU16LE(bytes, pc); pc += 2;
            blitText(ctx, x, y, strings[stringId] || "", size, color, maxChars);
            break;
        }

        case 0x11: { // BIND_TEXT: x(u16) y(u16) size(u8) color(u8) max(u8) bind_id(u8)
            const x = readU16LE(bytes, pc); pc += 2;
            const y = readU16LE(bytes, pc); pc += 2;
            const size = bytes[pc]; pc++;
            const color = bytes[pc]; pc++;
            const maxChars = bytes[pc]; pc++;
            const bindId = bytes[pc]; pc++;
            // Show placeholder or user-provided simulation value
            const text = bindValues[binds[bindId]] || "---";
            blitText(ctx, x, y, text, size, color, maxChars);
            break;
        }

        case 0x12: { // BAR: x y w h value max track fill (all u16/u8)
            const x = readU16LE(bytes, pc); pc += 2;
            const y = readU16LE(bytes, pc); pc += 2;
            const w = readU16LE(bytes, pc); pc += 2;
            const h = readU16LE(bytes, pc); pc += 2;
            const value = readU16LE(bytes, pc); pc += 2;
            const max = readU16LE(bytes, pc); pc += 2;
            const track = bytes[pc]; pc++;
            const fill = bytes[pc]; pc++;
            ctx.fillStyle = PALETTE[track]; ctx.fillRect(x, y, w, h);
            const fw = Math.floor(w * Math.min(value, max) / Math.max(max, 1));
            ctx.fillStyle = PALETTE[fill]; ctx.fillRect(x, y, fw, h);
            break;
        }

        case 0x13: { // BIND_BAR: x y w h bind_id max track fill
            const x = readU16LE(bytes, pc); pc += 2;
            const y = readU16LE(bytes, pc); pc += 2;
            const w = readU16LE(bytes, pc); pc += 2;
            const h = readU16LE(bytes, pc); pc += 2;
            const bindId = bytes[pc]; pc++;
            const max = readU16LE(bytes, pc); pc += 2;
            const track = bytes[pc]; pc++;
            const fill = bytes[pc]; pc++;
            ctx.fillStyle = PALETTE[track]; ctx.fillRect(x, y, w, h);
            const val = parseInt(bindValues[binds[bindId]] || "50");
            const fw = Math.floor(w * Math.min(val, max) / Math.max(max, 1));
            ctx.fillStyle = PALETTE[fill]; ctx.fillRect(x, y, fw, h);
            break;
        }

        case 0x14: { // CIRCLE: cx cy r color
            const cx = readU16LE(bytes, pc); pc += 2;
            const cy = readU16LE(bytes, pc); pc += 2;
            const r = readU16LE(bytes, pc); pc += 2;
            const color = bytes[pc]; pc++;
            ctx.strokeStyle = PALETTE[color]; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
            break;
        }

        case 0x15: { // CROSS: cx cy len color
            const cx = readU16LE(bytes, pc); pc += 2;
            const cy = readU16LE(bytes, pc); pc += 2;
            const len = readU16LE(bytes, pc); pc += 2;
            const color = bytes[pc]; pc++;
            ctx.strokeStyle = PALETTE[color]; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx - len, cy); ctx.lineTo(cx + len, cy);
            ctx.moveTo(cx, cy - len); ctx.lineTo(cx, cy + len);
            ctx.stroke();
            break;
        }

        case 0xFF: return -1; // HALT
        default: return -1;   // unknown opcode
    }
    return pc;
}
```

### 8.4 Bind Simulation

Add a **Bind Simulator** panel where the user can type in values for each bind, and the renderer uses those values. This simulates what the MCU runtime does when it receives sensor data.

```
Pseudocode:

// State: map of bind name -> simulated value
state.bindValues = {
    "sensor.roll": "127",
    "sensor.temp": "23.5"
};

// UI: for each bind name in program.binds, show an input field
// When user changes a value, re-render the canvas
```

---

## 9. Implementation Roadmap

### Phase 1: Minimal Viable Tool (Python bridge)

**Goal:** Working compilation and visualization via the browser.

1. Set up Go project with `go mod init`, basic HTTP server
2. Implement the Python bridge (subprocess calling `compile_with_stages.py`)
3. Create the Python helper script that outputs all stages
4. Implement `/api/compile` endpoint
5. Create minimal `index.html` with `<textarea>` for source, `<canvas>` for rendering
6. Implement the JavaScript bytecode interpreter (execute and render)
7. Add disassembly view (plain text from compile response)
8. Add preset loading (`/api/presets`)
9. Add auto-compile on change (debounced)
10. Test with the dashboard example

### Phase 2: Rich UI

**Goal:** All inspector panels, debug overlays, interactive features.

1. Add CodeMirror for syntax highlighting
2. Implement AST tree viewer with stage switching
3. Implement hex dump view
4. Add debug overlays (bounds, depth, dirty, cross)
5. Add hover-to-inspect on canvas
6. Add click-to-highlight linking between disassembly and canvas
7. Implement statistics dashboard
8. Add manifest viewer
9. Add bind simulator
10. Add binary download
11. Style with dark theme matching the existing JSX prototypes' aesthetic

### Phase 3: Native Go Compiler (optional)

**Goal:** Single-binary deployment, no Python dependency.

1. Port `util.py` types (Rect, deep_clone, interpolation)
2. Port `constants.py` enums
3. Port `dsl.py` front-end (YAML parsing, prop resolution, normalization)
4. Port `passes.py` middle-end
5. Port `layout.py` layout engine
6. Port `lower.py` bytecode emission
7. Port `serialize.py` binary format
8. Port `disasm.py` disassembler
9. Replace Python bridge with native compiler calls
10. Add Go tests mirroring `tests/test_compiler.py`

---

## 10. Testing Strategy

### 10.1 Backend Tests

- **Unit tests for the Python bridge**: Compile the dashboard example, verify all fields in the response.
- **Round-trip test**: Compile, serialize, deserialize, verify sections.
- **Error tests**: Invalid YAML, missing props, unknown node types -- verify clean error messages.

### 10.2 Frontend Tests

- **Bytecode interpreter**: Compare canvas output against reference screenshots for preset screens.
- **Disassembly**: Compare text output against `out/dashboard.asm.txt`.
- **AST viewer**: Verify node counts match `stats.final_nodes`.

### 10.3 Integration Tests

- Start Go server, load browser, select preset, verify canvas renders.
- Edit YAML, verify auto-recompile updates canvas.
- Test error recovery: introduce YAML syntax error, verify error message, fix it, verify recovery.

---

## 11. Design Decisions and Rationale

### 11.1 Why Go for the server?

- Excellent HTTP/WebSocket support in the standard library
- Easy to embed static files via `go:embed`
- Single-binary deployment
- Natural path toward a full Go compiler (no Python dependency for production)

### 11.2 Why Python bridge first?

- The Python compiler already works and is well-tested
- Avoids reimplementing 900 lines of compiler before having a working UI
- The UI design can iterate independently of the compiler implementation
- The bridge is a clean interface that maps 1:1 to the future Go compiler

### 11.3 Why not reuse the JSX prototypes directly?

The JSX prototypes are self-contained React components with their own compilers. They are useful as reference, but:
- They use a **different opcode set** than the Python compiler
- They use **big-endian** encoding; Python uses **little-endian**
- They use GLYPH_W=6; Python uses GLYPH_W=8
- They don't have middle-end passes or GNBC serialization

The web UI's canvas renderer should interpret the **Python compiler's bytecode format**. The JSX prototypes are reference for: bitmap font data, e-ink visual aesthetic, UI layout patterns, and preset screen definitions.

### 11.4 Why expose intermediate ASTs?

The whole point of this tool is experimentation and learning. By showing the AST at each stage, an engineer can see exactly what each pass does, trace instructions back to source nodes, and understand the compiler pipeline viscerally.

---

## 12. Reference: File Paths

```
Project root: /home/manuel/code/wesen/2026-03-22--gnosis-compiler/

Python compiler:
  gnosis_compiler/compiler.py      # Orchestrator
  gnosis_compiler/dsl.py           # Front-end
  gnosis_compiler/passes.py        # Middle-end
  gnosis_compiler/layout.py        # Layout engine
  gnosis_compiler/lower.py         # Bytecode emission
  gnosis_compiler/serialize.py     # Binary format
  gnosis_compiler/constants.py     # Enums and defaults
  gnosis_compiler/model.py         # Data structures
  gnosis_compiler/bytecode.py      # ByteWriter, pools
  gnosis_compiler/disasm.py        # Disassembler
  gnosis_compiler/util.py          # Rect, cloning, interpolation
  gnosis_compiler/errors.py        # CompileError
  gnosis_compiler/cli.py           # CLI entry point

React prototypes:
  source/gnosis-compiler.jsx       # Bytecode compiler + executor UI
  source/gnosis-engine.jsx         # Layout engine visualization UI

Algorithm spec:
  source/gnosis-layout-algorithm.md

Examples:
  examples/dashboard.yaml
  examples/dashboard.props.yaml

Build artifacts:
  out/dashboard.gnbc
  out/dashboard.asm.txt
  out/dashboard.manifest.json
```

---

## 13. Glossary

| Term | Meaning |
|------|---------|
| **AST** | Abstract Syntax Tree -- the tree representation of the screen description |
| **Bind** | A runtime-dynamic value (e.g., sensor reading) that the MCU fills in |
| **Bind site** | The exact pixel location where a bind value is drawn |
| **BindTable** | Dense mapping from bind names to integer IDs |
| **Bytecode** | Compact instruction sequence for the MCU interpreter |
| **Canonical AST** | The normalized AST after alias resolution and validation |
| **Dead node** | A node that won't be rendered (visible:false, cond when:false) |
| **EPD** | Electrophoretic Display (e-ink technology) |
| **Flex** | A child without explicit height/width that gets remaining space |
| **GNBC** | GNOSIS Bytecode -- the binary format with sections |
| **Glyph** | A single character in the bitmap font (8x8 pixels) |
| **Intrinsic width** | The natural width of a widget based on its content |
| **Layout** | The process of computing pixel rectangles for all nodes |
| **Lowering** | Converting the high-level AST to low-level bytecode |
| **Partial evaluation** | Computing at compile time what doesn't depend on runtime |
| **Props** | Compile-time parameters substituted into the DSL |
| **Rect** | A rectangle: {x, y, w, h} in pixel coordinates |
| **Refresh region** | A screen area that needs EPD refresh when binds change |
| **Serialization** | Packing compilation output into the GNBC binary format |
| **Static** | A subtree with no runtime binds (fully evaluated at compile time) |
| **StringPool** | Deduplicating mapping from strings to integer IDs |
| **Waveform** | EPD refresh mode: FULL (slow/clean), PART, FAST (quick/ghosty) |
