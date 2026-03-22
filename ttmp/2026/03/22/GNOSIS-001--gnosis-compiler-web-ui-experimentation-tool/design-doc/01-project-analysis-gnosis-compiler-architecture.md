---
Title: Project Analysis - GNOSIS Compiler Architecture
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
    - gnosis_compiler/passes.py
    - gnosis_compiler/constants.py
    - gnosis_compiler/model.py
    - gnosis_compiler/bytecode.py
    - gnosis_compiler/disasm.py
    - gnosis_compiler/cli.py
    - source/gnosis-compiler.jsx
    - source/gnosis-engine.jsx
    - source/gnosis-layout-algorithm.md
ExternalSources: []
Summary: Comprehensive analysis of the GNOSIS compiler architecture, all components, data structures, and compilation pipeline
LastUpdated: 2026-03-22T11:06:51.245643787-04:00
WhatFor: ""
WhenToUse: ""
---

# Project Analysis: GNOSIS Compiler Architecture

## Executive Summary

The GNOSIS compiler is a small, layered compiler that transforms YAML/JSON screen descriptions into compact bytecode programs for e-ink displays on memory-constrained microcontrollers (Cortex-M4, 20 KB RAM, 400x300 1-bit EPD). The compiler follows a conventional three-stage architecture (front-end, middle-end, back-end) and is currently implemented in Python (~900 lines) with two standalone React/JSX prototypes (~2100 lines) that serve as interactive visual debuggers.

The compiler's central insight is **partial evaluation**: everything that can be computed at compile time (layout, static text, list/grid rendering) is resolved ahead of time, leaving only a minimal bytecode interpreter and precomputed refresh metadata for the MCU runtime. This analysis documents every component, data structure, and pipeline stage to provide the foundation for building a Go web UI that exposes the compiler's internals for experimentation.

---

## 1. Project Structure Overview

The project lives at `/home/manuel/code/wesen/2026-03-22--gnosis-compiler/` and contains the following major parts:

### 1.1 Python Compiler (`gnosis_compiler/`)

This is the authoritative compiler implementation, consisting of 15 Python modules:

| File | Lines | Role |
|------|-------|------|
| `compiler.py` | 116 | Orchestrator: wires all stages together |
| `dsl.py` | 215 | Front-end: parsing, prop substitution, normalization |
| `passes.py` | 115 | Middle-end: dead node elimination, box flattening, static classification |
| `layout.py` | 235 | Back-end: compile-time recursive layout engine |
| `lower.py` | 419 | Back-end: bytecode emission, region analysis |
| `serialize.py` | 85 | Back-end: GNBC binary format serialization |
| `constants.py` | 59 | Opcodes, colors, waveforms, node types |
| `model.py` | 81 | Data structures: Program, BindSite, RefreshRegion, CompileOptions |
| `bytecode.py` | 52 | ByteWriter, StringPool, BindTable utilities |
| `disasm.py` | 147 | Text disassembler for bytecode |
| `util.py` | 121 | Rect, deep_clone, interpolation, path lookup |
| `errors.py` | 3 | CompileError exception |
| `cli.py` | 41 | Command-line interface |
| `__init__.py` | — | Package exports |
| `__main__.py` | — | Module entry point |

### 1.2 React/JSX Prototypes (`source/`)

Two standalone React components that bundle their own compilers and renderers:

| File | Lines | Role |
|------|-------|------|
| `gnosis-compiler.jsx` | 1086 | Bytecode compiler + executor + disassembler + hex viewer |
| `gnosis-engine.jsx` | 1063 | Layout engine visualization + debug overlays |
| `gnosis-layout-algorithm.md` | 485 | Formal algorithm specification in pseudocode |

### 1.3 Examples and Output

| Path | Purpose |
|------|---------|
| `examples/dashboard.yaml` | 80-line example screen definition |
| `examples/dashboard.props.yaml` | 11-line props file for the dashboard |
| `out/dashboard.gnbc` | Compiled binary |
| `out/dashboard.asm.txt` | Text disassembly |
| `out/dashboard.manifest.json` | JSON manifest with all metadata |

### 1.4 Documentation

| File | Purpose |
|------|---------|
| `README.md` | Project overview and quick-start |
| `COMPILER_GUIDE.md` | 596-line design philosophy and compiler theory mapping |
| `MIGRATION_NOTES.md` | Notes on restructuring from the old single-file approach |

---

## 2. The DSL: What the Compiler Accepts

### 2.1 Input Format

The compiler accepts YAML or JSON screen descriptions. The top-level node is a `screen` with three sections:

```yaml
type: screen
width: 400      # display width in pixels (default: 400)
height: 280     # display height in pixels (default: 300)
bar:            # top status bar
  type: hbox
  h: 16
  ...
body:           # main content area
  type: vbox
  ...
nav:            # bottom navigation bar
  type: hbox
  h: 16
  ...
```

### 2.2 Node Types (15 total)

**Container nodes** (have children, participate in layout):

- **`screen`** -- Root node. Mandatory `body`; optional `bar` (top) and `nav` (bottom) with fixed heights.
- **`vbox`** -- Vertical box layout. Children stacked top-to-bottom. Fixed-height children consume their declared height; remaining space is divided equally among flex children.
- **`hbox`** -- Horizontal box layout. Supports a `split` property for two-pane mode (fixed left width + flex right). Otherwise, uses intrinsic widths for labels/buttons and flex space for spacers.
- **`fixed`** -- Absolute positioning. Each child carries `x`, `y` offsets relative to the parent's origin.
- **`btn`** -- Button container with stroke border. Children rendered inside.
- **`cond`** -- Conditional. Removed entirely if `when: false`.

**Leaf nodes** (terminal, no children, produce draw instructions):

- **`label`** -- Text. Static (`text: "HELLO"`) or dynamic (`bind: sensor.roll`). Supports `size` multiplier (1, 2, 4), `color`, `invert`, `field_w` (for bound values).
- **`bar`** -- Progress/value bar. Static (`value: 72, max: 100`) or dynamic (`bind: battery.pct`). Has `track_color` and `fill_color`.
- **`list`** -- Static data list. `data` is an array of strings or objects with `cols`. Lowered to individual `TEXT` instructions at compile time.
- **`grid`** -- Calendar/table grid. `data` array with `cols` count, `cell_w`, `cell_h`. Also lowered to `TEXT` + geometry at compile time.
- **`sep`** -- Horizontal separator line.
- **`spacer`** -- Invisible flex spacer in hbox/vbox. Consumes remaining space.
- **`fill`** -- Solid color rectangle.
- **`circle`** -- Circle shape with `cx`, `cy`, `r`.
- **`cross`** -- Cross/plus shape with `cx`, `cy`, `len`.

### 2.3 Props: Compile-Time Parameterization

Props are resolved **before** layout and lowering. Two mechanisms:

**Scalar interpolation** (Mustache-style):
```yaml
text: "{{title}}"        # title replaced from props
```

**Whole-value substitution** (via `$prop` reference):
```yaml
data: { $prop: tasks }   # entire array injected from props
```

Props support nested path lookup (e.g., `{{settings.display.brightness}}`). If a `$prop` reference is a list, it is spliced into the parent array.

### 2.4 Binds: Runtime Dynamic Values

Binds declare values that change at runtime on the device:

```yaml
bind: sensor.roll     # runtime value, needs refresh metadata
field_w: 3            # worst-case display width (3 characters)
waveform: part        # EPD refresh waveform class
```

The critical distinction: **props** fold into the AST at compile time (allowing full layout and lowering); **binds** only produce placeholder instructions and refresh metadata.

---

## 3. Compiler Pipeline: Stage by Stage

The compilation pipeline is orchestrated by the `Compiler` class in `compiler.py`:

```
YAML/JSON Source + Props
        |
        v
    [1] FRONT-END (dsl.py)
        - load_source(): parse YAML or JSON
        - resolve_props(): substitute {{...}} and $prop
        - normalize_screen(): canonicalize aliases, validate, wrap in screen
        |
        v
    [2] MIDDLE-END (passes.py)
        - eliminate_dead_nodes(): remove visible:false and cond when:false
        - flatten_boxes(): merge nested same-axis containers (two passes)
        - assign_ids(): give each node a stable ID (n1, n2, ...)
        - mark_static(): classify subtrees as static/dynamic
        |
        v
    [3] BACK-END
        [3a] layout_screen() (layout.py)
            - divide screen into bar/body/nav bands
            - recursively compute Rect(x, y, w, h) for every node
            - precompute max_visible_chars, visible_rows, cell metrics
        |
        v
        [3b] lower_screen() (lower.py)
            - walk laid-out AST, emit bytecode instructions
            - intern strings into StringPool
            - intern bind names into BindTable
            - record BindSite for each dynamic leaf
            - merge nearby BindSites into RefreshRegions
        |
        v
        [3c] serialize_program() (serialize.py)
            - pack header + string section + bind section + region section + code section
            - produce GNBC binary blob
        |
        v
    Program {
        width, height,
        code: bytes,           # raw bytecode
        strings: list[str],    # interned static strings
        binds: list[str],      # runtime binding names
        bind_sites: list[BindSite],
        regions: list[RefreshRegion],
        stats: dict,           # compilation statistics
        ast: dict,             # final laid-out AST
        binary: bytes          # serialized GNBC
    }
```

### 3.1 Front-End Detail

**`load_source(source)`** accepts:
- A Python dict/list (already parsed)
- A file path (auto-detects YAML/JSON by extension)
- A raw string (tries JSON first if it starts with `{["`, otherwise YAML)

**`resolve_props(value, props)`** recursively walks the tree:
- `{{key}}` in strings: looked up in props via dot-path notation
- `{$prop: key}`: replaced with the entire value from props
- Lists containing resolved lists are flattened one level

**`normalize_screen(source_ast)`**:
- Calls `_canonicalize_node()` recursively
- Normalizes aliases: `items` -> `children`, `label`/`content` -> `text`, `layout` -> `type`
- Validates node types against the 15 allowed types
- Wraps non-screen roots in a synthetic screen with empty bar/nav
- Normalizes color and waveform strings to lowercase

### 3.2 Middle-End Detail

Four passes applied in sequence:

**Pass 1: Dead Node Elimination** (`eliminate_dead_nodes`)
- Removes nodes with `visible: false`
- Removes `cond` nodes with `when: false` (their children are discarded)
- `cond` nodes with `when: true` are replaced by their children (unwrapped)
- This is classic dead code elimination on a tree IR

**Pass 2 & 3: Box Flattening** (`flatten_boxes`, applied twice)
- Merges nested vbox-in-vbox when: same axis, no explicit height, no borders
- Merges nested hbox-in-hbox when: same axis, no explicit width, no split, no borders
- Two-pass fixed-point: second pass catches cases exposed by the first
- This is algebraic simplification / peephole optimization on the AST

**Pass 4: ID Assignment** (`assign_ids`)
- Assigns sequential IDs: n1, n2, n3, ... to each node
- Used for debug tracing and bind site identification

**Pass 5: Static Classification** (`mark_static`)
- Bottom-up walk: a node is static iff it has no `bind` and all its children are static
- Sets `_static: true` on purely static subtrees
- This is binding-time analysis (from partial evaluation theory)

The compiler tracks node counts before and after each pass in `stats['passes']`.

### 3.3 Back-End: Layout

The layout engine (`layout.py`) is a direct implementation of the formal algorithm in `gnosis-layout-algorithm.md`.

**`layout_screen(screen, width, height, glyph_w, glyph_h)`**:
1. Allocate vertical bands: bar gets `bar.h`, nav gets `nav.h`, body gets the remainder
2. Call `layout_node()` for each section with its allocated rectangle

**`layout_node(node, x, y, w, h, ...)`** dispatches by type:
- `vbox` -> `layout_vbox()`: two-pass (sum fixed heights, count flex, distribute)
- `hbox` -> `layout_hbox()`: two-pass, with special split-pane mode
- `fixed`/`btn` -> `layout_fixed()`: absolute positioning with intrinsic sizing
- Everything else -> `layout_leaf()`: set rect, compute content metrics

Every node gets a `rect: Rect(x, y, w, h)` field. Leaf nodes get additional computed fields:
- Labels: `max_visible_chars = w // (glyph_w * size)`
- Lists: `visible_rows = min(max_items, h // row_h)`
- Grids: `cell_w`, `cell_h`, `visible_rows`

### 3.4 Back-End: Lowering

The lowering stage (`lower.py`) converts the laid-out AST into a flat bytecode instruction stream.

**`lower_screen(screen)`** walks bar, body, nav in order, calling `lower_node()` recursively:

For each node, the lowerer:
1. Emits border instructions (HLINE) if `border_t` or `border_b` is set
2. Emits the appropriate widget instruction based on type
3. Recurses into children for container nodes

**Constant pools:**
- `StringPool`: maps text strings to dense IDs (0, 1, 2, ...). Deduplicates identical strings.
- `BindTable`: maps bind names (e.g., `sensor.roll`) to dense IDs. Used in BIND_TEXT/BIND_BAR instructions.

**Dynamic site tracking:**
For every bound leaf, the lowerer records a `BindSite`:
```python
BindSite(
    bind_id=0,           # dense ID from BindTable
    bind_name="sensor.roll",
    rect=Rect(8, 40, 48, 16),
    waveform="part",
    node_id="n4",
    opcode_offset=46     # byte offset in code section
)
```

**Region merging** (`merge_regions`):
Nearby BindSites are greedily merged into `RefreshRegion`s if the union area waste is below a threshold (default 512 px^2). This reduces the number of EPD refresh commands at runtime.

### 3.5 Back-End: Serialization

The GNBC binary format (`serialize.py`):

```
Header (30 bytes):
  magic:           4 bytes   "GNBC"
  version:         1 byte    (1)
  flags:           1 byte    (0)
  width:           2 bytes   (u16 LE)
  height:          2 bytes   (u16 LE)
  strings_offset:  2 bytes   (u16 LE)
  strings_count:   2 bytes   (u16 LE)
  binds_offset:    2 bytes   (u16 LE)
  binds_count:     2 bytes   (u16 LE)
  regions_offset:  2 bytes   (u16 LE)
  regions_count:   2 bytes   (u16 LE)
  code_offset:     2 bytes   (u16 LE)
  code_size:       2 bytes   (u16 LE)

String Section:
  For each string: length (u16 LE) + UTF-8 bytes

Bind Section:
  For each bind name: length (u16 LE) + UTF-8 bytes

Region Section:
  For each region: x(u16) y(u16) w(u16) h(u16) waveform(u8) bind_count(u8) bind_ids...

Code Section:
  Raw bytecode stream ending with HALT (0xFF)
```

---

## 4. Bytecode Instruction Set

The instruction set is intentionally minimal (12 opcodes) to keep the MCU interpreter simple:

| Opcode | Hex | Operands | Description |
|--------|-----|----------|-------------|
| NOP | 0x00 | -- | No operation |
| HLINE | 0x01 | x(u16) y(u16) w(u16) color(u8) | Horizontal line |
| VLINE | 0x02 | x(u16) y(u16) h(u16) color(u8) | Vertical line |
| FILL_RECT | 0x03 | x(u16) y(u16) w(u16) h(u16) color(u8) | Filled rectangle |
| STROKE_RECT | 0x04 | x(u16) y(u16) w(u16) h(u16) color(u8) | Stroked rectangle |
| TEXT | 0x10 | x(u16) y(u16) size(u8) color(u8) max(u8) string_id(u16) | Static text |
| BIND_TEXT | 0x11 | x(u16) y(u16) size(u8) color(u8) max(u8) bind_id(u8) | Dynamic text |
| BAR | 0x12 | x(u16) y(u16) w(u16) h(u16) value(u16) max(u16) track(u8) fill(u8) | Static bar |
| BIND_BAR | 0x13 | x(u16) y(u16) w(u16) h(u16) bind_id(u8) max(u16) track(u8) fill(u8) | Dynamic bar |
| CIRCLE | 0x14 | cx(u16) cy(u16) r(u16) color(u8) | Circle |
| CROSS | 0x15 | cx(u16) cy(u16) len(u16) color(u8) | Cross/plus |
| HALT | 0xFF | -- | End of program |

All multi-byte values are little-endian (u16 LE).

### 4.1 Color Palette

Five colors designed for e-ink displays:

| ID | Name | Hex | Usage |
|----|------|-----|-------|
| 0 | BG | #d8d4cc | Background (light beige/paper) |
| 1 | FG | #2a2a28 | Foreground (near-black) |
| 2 | MID | #9e9a92 | Medium gray (borders, secondary text) |
| 3 | LIGHT | #c4c0b8 | Light gray (selection highlight, bar tracks) |
| 4 | GHOST | #b8b4ac | Very light gray (labels, hints) |

### 4.2 Waveform Classes

Three EPD refresh waveforms:

| ID | Name | Description |
|----|------|-------------|
| 0 | FULL | Full refresh. Slow (~300ms), eliminates ghosting |
| 1 | PART | Partial refresh. Medium speed (~100ms), some ghosting |
| 2 | FAST | Fastest partial. Minimal redraw (~50ms), may ghost |

---

## 5. Core Data Structures

### 5.1 Rect (util.py)

```python
@dataclass(frozen=True)
class Rect:
    x: int    # top-left x
    y: int    # top-left y
    w: int    # width
    h: int    # height

    def area(self) -> int          # w * h
    def union(self, other) -> Rect # bounding union
    def intersects(self, other) -> bool
```

This is the fundamental geometry primitive. Every laid-out node carries a Rect.

### 5.2 CompileOptions (model.py)

```python
@dataclass
class CompileOptions:
    width: int = 400                    # display width
    height: int = 300                   # display height
    glyph_w: int = 8                    # pixel width per character
    glyph_h: int = 8                    # pixel height per character
    region_merge_threshold: int = 512   # max waste for region merging
```

### 5.3 BindSite (model.py)

Records where in the bytecode a runtime binding occurs:

```python
@dataclass
class BindSite:
    bind_id: int          # dense ID from BindTable
    bind_name: str        # e.g., "sensor.roll"
    rect: Rect            # bounding box for this draw site
    waveform: str         # "fast", "part", or "full"
    node_id: str          # e.g., "n4"
    opcode_offset: int    # byte offset in code section
```

### 5.4 RefreshRegion (model.py)

Merged refresh regions for the MCU runtime:

```python
@dataclass
class RefreshRegion:
    rect: Rect                     # bounding rectangle
    waveform: str                  # worst-case waveform in region
    bind_ids: list[int]            # which binds trigger this region
    bind_names: list[str]          # human-readable bind names
```

### 5.5 Program (model.py)

The complete output of compilation:

```python
@dataclass
class Program:
    width: int                     # display width
    height: int                    # display height
    code: bytes                    # raw bytecode
    strings: list[str]             # interned string pool
    binds: list[str]               # bind name table
    bind_sites: list[BindSite]     # per-binding draw sites
    regions: list[RefreshRegion]   # merged refresh regions
    stats: dict                    # compilation statistics
    ast: dict                      # final laid-out AST
    binary: bytes | None           # serialized GNBC
```

The `to_manifest()` method exports everything as a JSON-serializable dict.

### 5.6 ByteWriter, StringPool, BindTable (bytecode.py)

Low-level emission utilities:

- **ByteWriter**: Accumulates bytes with `emit_u8()` and `emit_u16()` (little-endian). `tell()` returns current offset.
- **StringPool**: Interns strings to deduplicated integer IDs. `intern("hello")` returns 0 on first call, 0 on subsequent calls.
- **BindTable**: Same interning pattern for bind names.

---

## 6. Existing React Prototypes

### 6.1 gnosis-compiler.jsx (1086 lines)

A self-contained React component that implements its own compiler + executor in JavaScript:

**Architecture:**
- `Compiler` class: JSON DSL -> optimized -> bytecode (Uint8Array)
- `Executor` class: bytecode -> canvas rendering with bitmap font
- `DisassemblyView` component: interactive instruction listing
- `HexView` component: hex dump with highlighting
- Main `GnosisCompiler` component: two-pane layout

**Key differences from Python compiler:**
- Uses a **different, richer opcode set** (RECT, FILL, STROKE, BLIT_TEXT with inline chars, DOT, ICON, GRID_BEGIN/CELL/END, PUSH_CLIP/POP_CLIP, BADGE, etc.)
- Text is stored **inline in the bytecode** (not via string pool)
- Big-endian u16 encoding (vs. little-endian in Python)
- GLYPH_W = 6 (vs. 8 in Python)
- Has 6 preset screen definitions embedded
- Includes full 5x7 bitmap font data for A-Z, 0-9, punctuation

**UI features:**
- Left pane: JSON editor + preset selector + compiler stats
- Right pane: three tabs (DISASSEMBLY, HEX DUMP, EXECUTOR)
- Hovering a disassembly line highlights corresponding pixels on canvas
- E-ink grain texture simulation on the canvas

### 6.2 gnosis-engine.jsx (1063 lines)

A layout engine visualization tool (not a bytecode compiler):

**Architecture:**
- `layoutNode()` function: recursive layout computation (mirrors Python layout.py)
- `renderToCanvas()`: DSL -> layout -> canvas rendering
- Debug overlay system: BOUNDS, DEPTH, CROSS, DIRTY

**UI features:**
- JSON editor with preset switching
- Interactive canvas with hover detection (shows node info)
- Toggle buttons for debug overlays:
  - BOUNDS: colored bounding boxes by depth
  - DEPTH: heatmap overlay
  - CROSS: centerline crosshairs
  - DIRTY: refresh region rectangles with waveform labels

---

## 7. Compilation Statistics and Example Output

For the dashboard example (`examples/dashboard.yaml` + `examples/dashboard.props.yaml`):

```
Input nodes:     19
Final nodes:     19
Dynamic nodes:   5
Static nodes:    14
Bind count:      2  (sensor.roll, sensor.temp)
String count:    13
Code size:       205 bytes
Region count:    3
Screen:          400 x 280
```

**Disassembly output** (23 instructions):
```
0000: HLINE       x=0 y=15 w=400 color=mid
0008: TEXT        x=0 y=0 size=1 color=fg max=11 string[0]='GNOSIS//NAV'
0012: TEXT        x=368 y=0 size=1 color=ghost max=4 string[1]='LINK'
001c: VLINE       x=188 y=16 h=248 color=mid
0024: TEXT        x=8 y=24 size=1 color=ghost max=4 string[2]='ROLL'
002e: BIND_TEXT   x=8 y=40 size=2 color=fg max=3 bind[0]='sensor.roll'
0037: BIND_BAR    x=8 y=72 w=168 h=4 bind[0]='sensor.roll' max=360
...
00cc: HALT
```

---

## 8. Target Platform Constraints

The compiler's design is shaped by the target hardware:

- **MCU**: ARM Cortex-M4 (e.g., STM32)
- **RAM**: 20 KB total
- **Display**: 400x300 pixels, 1-bit depth (e-ink EPD)
- **Font**: 8x8 monospace bitmap
- **Framebuffer**: 400x300/8 = 15,000 bytes
- **Remaining for all data + stack**: ~5 KB

This extreme constraint drives every design decision:
- Bytecode (not AST) on device -- smaller, simpler interpreter
- Precomputed rectangles -- no dynamic layout engine needed
- String interning -- deduplicates repeated text
- Dense bind IDs -- fits in single bytes
- Region precomputation -- MCU doesn't merge regions at runtime
- Max ~60 nodes typical -- keeps metadata under 1 KB

---

## 9. Key Design Patterns

### 9.1 Partial Evaluation as Core Strategy

The compiler pushes as much work as possible to compile time:
- Props are folded into the AST (constant folding)
- Layout is fully computed (no runtime layout engine)
- Static lists/grids are lowered to individual TEXT instructions
- String interning eliminates redundant storage
- Refresh regions are precomputed and merged

### 9.2 Separation of Representations

The compiler maintains distinct representations at each stage:
1. **Source AST** (raw YAML/JSON with aliases)
2. **Canonical AST** (normalized, validated)
3. **Optimized AST** (dead nodes removed, boxes flattened, classified)
4. **Laid-out AST** (every node has a `rect`, leaf metrics computed)
5. **Bytecode** (flat instruction stream)
6. **Binary** (GNBC with sections and offsets)

### 9.3 Props vs Binds Separation

This is the compiler's most important type-level distinction:
- Props affect compilation (different props = different binary)
- Binds affect runtime refresh (same binary, different runtime values)
- A prop that could be a bind wastes MCU resources
- A bind that could be a prop wastes binary size and refresh time

---

## 10. API Surface for Web UI Integration

### 10.1 Python API

```python
from gnosis_compiler import Compiler, CompileOptions
from gnosis_compiler.disasm import disassemble_code

compiler = Compiler(CompileOptions(width=400, height=280))
program = compiler.compile("examples/dashboard.yaml", "examples/dashboard.props.yaml")

# All outputs:
program.code          # bytes: raw bytecode
program.strings       # list[str]: string pool
program.binds         # list[str]: bind names
program.bind_sites    # list[BindSite]: draw sites for binds
program.regions       # list[RefreshRegion]: merged refresh regions
program.stats         # dict: compilation statistics per pass
program.ast           # dict: final laid-out AST tree
program.binary        # bytes: serialized GNBC binary
program.to_manifest() # dict: JSON-serializable manifest

# Disassembly:
disassemble_code(program.code, program.strings, program.binds)  # -> str
```

### 10.2 CLI

```bash
python -m gnosis_compiler examples/dashboard.yaml \
    --props examples/dashboard.props.yaml \
    --width 400 --height 280 \
    --binary-out out/dashboard.gnbc \
    --asm-out out/dashboard.asm.txt \
    --manifest-out out/dashboard.manifest.json
```

The CLI prints the manifest JSON to stdout and writes artifacts to the specified paths.

---

## 11. What a Go Web UI Needs to Expose

Based on this analysis, a web UI for experimenting with the compiler should expose:

1. **DSL Editing**: YAML/JSON editor with syntax highlighting and error display
2. **Props Editing**: Separate props editor, showing the props/bind distinction
3. **Pipeline Visualization**: Show the AST at each stage (raw, normalized, optimized, laid-out)
4. **Layout Visualization**: Canvas rendering of the screen with debug overlays (bounds, depth, dirty regions)
5. **Bytecode View**: Disassembly listing with instruction highlighting
6. **Hex Dump**: Raw binary view of the bytecode
7. **Statistics Dashboard**: Node counts, pass effects, code size, region count
8. **Manifest Viewer**: Full JSON manifest with string pool, bind table, bind sites, regions
9. **Binary Download**: Download the compiled GNBC binary
10. **Preset Library**: Quick-load example screens
11. **Interactive Canvas**: Hover to inspect nodes, click to highlight instructions
12. **Bind Simulation**: Provide test values for binds and show refresh region behavior

---

## References

- `COMPILER_GUIDE.md`: Design philosophy, compiler theory mapping, reading list
- `source/gnosis-layout-algorithm.md`: Formal algorithm specification with pseudocode
- `MIGRATION_NOTES.md`: Context on restructuring from old approach
- `README.md`: Project overview and quick-start guide
