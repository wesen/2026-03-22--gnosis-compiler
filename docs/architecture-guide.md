# The GNOSIS Compiler: A Complete Architecture Guide

*A textbook-style reference for new engineers joining the project.*

---

## Table of Contents

1. What Is GNOSIS?
2. The Big Picture: From YAML to Bytecode
3. The Target Hardware and Why It Matters
4. The Source Language (DSL)
5. Props vs Binds: The Central Design Decision
6. The Front-End: Parsing and Normalization
7. The Middle-End: Optimization Passes
8. The Back-End Part 1: Layout
9. The Back-End Part 2: Lowering to Bytecode
10. The Back-End Part 3: Serialization (GNBC Binary)
11. The Bytecode Instruction Set
12. Refresh Regions and Dirty Tracking
13. Data Structures Reference
14. File-by-File Guide
15. The Web Experimentation Tool
16. Worked Example: Compiling the Dashboard
17. Compiler Theory Mapping
18. How to Run Everything

---

## 1. What Is GNOSIS?

GNOSIS is a system for driving e-ink displays on microcontrollers. The core problem it solves is this: you have a tiny computer (ARM Cortex-M4) with 20 KB of RAM, connected to a 400x300 pixel e-ink screen, and you need to draw complex UI screens — status bars, lists, calendars, sensor readouts — efficiently enough that the screen can partially refresh in under 100 milliseconds.

The GNOSIS **compiler** is the part of the system that takes a human-authored screen description and turns it into a compact bytecode program that the MCU can execute. This document explains exactly how that compiler works, from first principles, one stage at a time.

The key insight behind the compiler is **partial evaluation**: anything that can be computed before the program reaches the device should be computed at compile time. Static text gets interned. Lists get lowered to individual draw instructions. Layout rectangles get precomputed. The MCU runtime only needs to handle the things that genuinely change at runtime — sensor values, clocks, battery levels — and even for those, the compiler precomputes exactly which screen rectangles need refreshing.

---

## 2. The Big Picture: From YAML to Bytecode

The compiler is a classic three-stage pipeline. Here is the full data flow:

```
  YAML/JSON file          Props file
  (screen description)    (compile-time parameters)
        |                       |
        v                       v
  +-------------------------------------------+
  |            FRONT-END  (dsl.py)             |
  |                                            |
  |  1. Parse YAML/JSON into a Python dict     |
  |  2. Substitute props: {{title}} -> value   |
  |  3. Normalize aliases and validate types   |
  |  4. Wrap in a screen node if needed        |
  +-------------------------------------------+
        |
        v
    Canonical AST  (a normalized Python dict tree)
        |
        v
  +-------------------------------------------+
  |          MIDDLE-END  (passes.py)           |
  |                                            |
  |  1. Eliminate dead nodes (visible: false)  |
  |  2. Flatten nested same-axis boxes         |
  |  3. Assign stable node IDs (n1, n2, ...)   |
  |  4. Classify static vs dynamic subtrees   |
  +-------------------------------------------+
        |
        v
    Optimized AST  (smaller, classified tree)
        |
        v
  +-------------------------------------------+
  |           BACK-END  (layout.py)            |
  |                                            |
  |  Compute pixel Rect(x,y,w,h) for every    |
  |  node. Two-pass flex layout for vbox/hbox. |
  |  Precompute visible chars, rows, cells.    |
  +-------------------------------------------+
        |
        v
    Laid-out AST  (every node has a rect)
        |
        v
  +-------------------------------------------+
  |           BACK-END  (lower.py)             |
  |                                            |
  |  Walk tree, emit bytecode instructions.    |
  |  Intern strings into a string pool.        |
  |  Intern bind names into a bind table.      |
  |  Record bind sites for refresh regions.    |
  |  Merge nearby regions greedily.            |
  +-------------------------------------------+
        |
        v
    Bytecode + String Pool + Bind Table
    + Bind Sites + Refresh Regions
        |
        v
  +-------------------------------------------+
  |         BACK-END  (serialize.py)           |
  |                                            |
  |  Pack everything into the GNBC binary:     |
  |  header + strings + binds + regions + code |
  +-------------------------------------------+
        |
        v
    GNBC Binary  (a single file for the MCU)
```

Each stage takes one representation and produces the next. No stage reaches backward. This is the standard compiler architecture you find in GCC or LLVM, scaled down to a much simpler problem.

---

## 3. The Target Hardware and Why It Matters

Every design decision in this compiler is driven by the target hardware constraints. If you do not understand the hardware, the design will look like arbitrary over-engineering.

**The MCU:**

- ARM Cortex-M4 (e.g., STM32L4 series)
- **20 KB total RAM** — this must hold the framebuffer, the screen tree, the stack, and all runtime data
- No operating system, no heap allocator, no virtual memory
- Clock speed: ~80 MHz (fast enough for simple interpretation)

**The display:**

- 400 x 300 pixels
- 1-bit depth (each pixel is black or white, but the e-ink technology can produce gray tones through dithering and partial refresh waveforms)
- E-ink (electrophoretic): pixels hold their state without power, but updating them is slow and causes visible artifacts ("ghosting")

**Memory budget:**

```
  Framebuffer:  400 x 300 / 8  =  15,000 bytes
  Screen tree:  ~60 nodes x 16B =    960 bytes
  Dirty rects:  32 x 8B        =    256 bytes
  ─────────────────────────────────────────────
  Subtotal:                       16,216 bytes
  Remaining for stack + data:     ~3,800 bytes
```

This is why the compiler does so much work ahead of time. The MCU does not have room for a YAML parser, a layout engine, a string table builder, or a region merge algorithm. All of that happens on the developer's laptop at compile time. The MCU gets a pre-chewed bytecode program and a pre-computed set of metadata.

**Display refresh physics:**

E-ink refreshes are slow and imperfect. There are three classes of refresh waveform:

| Waveform | Speed    | Quality | Use case |
|----------|----------|---------|----------|
| FULL     | ~300 ms  | Perfect (no ghosting) | Infrequent full redraws |
| PART     | ~100 ms  | Good (mild ghosting) | Medium-frequency updates |
| FAST     | ~50 ms   | Acceptable (some ghosting) | High-frequency sensor values |

The compiler precomputes which parts of the screen use which waveform, so the MCU runtime can issue the cheapest possible refresh for each update.

---

## 4. The Source Language (DSL)

The input to the compiler is a screen description written in YAML (or JSON). Here is a complete example:

```yaml
type: screen
width: 400
height: 280
bar:
  type: hbox
  h: 16
  border_b: true
  children:
    - type: label
      text: "{{title}}"
    - type: spacer
    - type: label
      text: "{{status}}"
      color: ghost
body:
  type: hbox
  split: 188
  children:
    - type: fixed
      children:
        - type: label
          x: 8
          y: 8
          text: ROLL
          color: ghost
        - type: label
          x: 8
          y: 24
          bind: sensor.roll
          field_w: 3
          size: 2
          waveform: part
        - type: bar
          x: 8
          y: 56
          w: 168
          h: 4
          bind: sensor.roll
          max: 360
          waveform: part
    - type: vbox
      children:
        - type: label
          h: 16
          text: TASKS
          color: ghost
        - type: list
          data: { $prop: tasks }
          row_h: 16
          max_items: 6
          selected: 1
nav:
  type: hbox
  h: 16
  border_t: true
  children:
    - type: label
      text: A:OK
      color: mid
    - type: spacer
    - type: label
      text: "{{footer}}"
      color: mid
```

### 4.1 The Screen Structure

Every screen has three vertical bands:

```
  +---------------------------+
  |          BAR              |  fixed height (e.g., 16px)
  +---------------------------+
  |                           |
  |          BODY             |  fills remaining space
  |                           |
  +---------------------------+
  |          NAV              |  fixed height (e.g., 16px)
  +---------------------------+
```

The `bar` is for status information (title, signal strength, time). The `nav` is for bottom navigation hints. The `body` is where the main content goes. Both `bar` and `nav` have a fixed pixel height declared in the DSL; `body` gets whatever is left.

### 4.2 Node Types

There are 15 node types. They fall into two categories:

**Container nodes** (have children, participate in layout):

- **`screen`** — The root. Has `bar`, `body`, and `nav` sections.
- **`vbox`** — Vertical box. Children stack top-to-bottom. Children with explicit `h` get that height; the rest ("flex children") split the remaining space equally.
- **`hbox`** — Horizontal box. Same logic but on the x-axis. Has a special `split` mode for two-pane layouts (fixed left width + flex right).
- **`fixed`** — Absolute positioning. Each child has `x`, `y` offsets relative to the parent.
- **`btn`** — Button. Draws a stroke border, then renders children inside.
- **`cond`** — Conditional. If `when: false`, the entire subtree is removed during dead node elimination.
- **`spacer`** — An invisible flex child that absorbs remaining space in hbox/vbox.

**Leaf nodes** (terminal, produce draw instructions):

- **`label`** — Text. Can be static (`text: "hello"`) or dynamic (`bind: sensor.roll`). Supports a `size` multiplier (1, 2, or 4), `color`, `invert`, and `field_w` (worst-case width for bound values).
- **`bar`** — A progress bar. Static (`value: 72, max: 100`) or dynamic (`bind: battery.pct`).
- **`list`** — A scrollable list of items. The `data` is an array of strings or column objects. Lists are **lowered to individual TEXT instructions at compile time** — there is no list widget in the bytecode.
- **`grid`** — A calendar-style grid. Like lists, grids are lowered to TEXT + geometry instructions at compile time.
- **`sep`** — A horizontal line separator.
- **`fill`** — A solid color rectangle.
- **`circle`** — A circle defined by center point and radius.
- **`cross`** — A cross/plus shape defined by center point and arm length.

### 4.3 Node Properties Reference

Every node can have these common properties:

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | Node type (required) |
| `children` | list | Child nodes (containers only) |
| `h` | int | Explicit height in pixels |
| `w` | int | Explicit width in pixels |
| `x`, `y` | int | Position offset (in `fixed` containers) |
| `color` | string | Drawing color: "fg", "mid", "light", "ghost" |
| `border_t` | bool | Draw a horizontal line at the top edge |
| `border_b` | bool | Draw a horizontal line at the bottom edge |
| `visible` | bool | If false, node is removed during dead elimination |

Label-specific:

| Property | Type | Description |
|----------|------|-------------|
| `text` | string | Static text content |
| `bind` | string | Runtime binding name (mutually exclusive with `text`) |
| `size` | int | Font size multiplier (1, 2, or 4) |
| `field_w` | int | Worst-case character count for bound values |
| `invert` | bool | Draw white text on dark background |
| `waveform` | string | Refresh waveform: "fast", "part", "full" |

Bar-specific:

| Property | Type | Description |
|----------|------|-------------|
| `value` | int | Static bar fill value |
| `max` | int | Maximum bar value (required) |
| `bind` | string | Runtime binding name |
| `track_color` | string | Background track color |
| `fill_color` | string | Fill bar color |

---

## 5. Props vs Binds: The Central Design Decision

This distinction is the single most important concept in the compiler. If you understand nothing else, understand this.

**Props** are compile-time parameters. They are resolved **before** layout and lowering. They become part of the compiled binary.

```yaml
text: "{{title}}"          # 'title' comes from the props file
data: { $prop: tasks }     # 'tasks' array comes from the props file
```

**Binds** are runtime values. They are NOT resolved at compile time. The compiler only reserves space for them and records metadata about where they will be drawn.

```yaml
bind: sensor.roll           # value comes from the MCU at runtime
field_w: 3                  # worst case: 3 characters wide
waveform: part              # use partial refresh when this changes
```

**Why this matters for the compiler:**

When a value is a **prop**, the compiler can:
- Fold it into the AST (constant folding)
- Run layout with the actual text width
- Intern the text in the string pool
- Lower lists/grids into individual draw instructions
- Produce a fully deterministic binary

When a value is a **bind**, the compiler can only:
- Reserve a rectangle based on `field_w`
- Emit a BIND_TEXT or BIND_BAR instruction
- Record the rectangle in a refresh region
- Leave the actual rendering to the MCU runtime

This is **partial evaluation**: compute everything at compile time that does not depend on runtime state. The result is that the MCU runtime is tiny — it just interprets a flat bytecode stream and patches in bind values.

**Props are provided in a separate YAML file:**

```yaml
# dashboard.props.yaml
title: GNOSIS//NAV
status: LINK
footer: READY
tasks:
  - Calibrate IMU
  - Sync clock
  - Check bus voltage
```

**Two substitution mechanisms:**

1. **Mustache interpolation** for strings: `"{{title}}"` becomes `"GNOSIS//NAV"`
2. **Whole-value substitution** for complex data: `{ $prop: tasks }` is replaced by the entire `tasks` array

Both are resolved recursively. Nested paths work: `"{{settings.display.brightness}}"`.

---

## 6. The Front-End: Parsing and Normalization

**File:** `gnosis_compiler/dsl.py` (215 lines)

The front-end has three responsibilities: parse the source, substitute props, and normalize the tree into a canonical form.

### 6.1 Parsing (`load_source`)

The `load_source()` function accepts:
- A Python dict or list (already parsed — returned as-is via deep clone)
- A file path string (auto-detects YAML vs JSON by extension)
- A raw YAML or JSON string (tries JSON first if it starts with `{`, `[`, or `"`)

```
Pseudocode:

LOAD-SOURCE(source):
    if source is dict or list:
        return DEEP-CLONE(source)
    if source is a file path that exists:
        text = READ-FILE(source)
        if extension is .yaml or .yml: return YAML-PARSE(text)
        if extension is .json: return JSON-PARSE(text)
        try YAML first, fall back to JSON
    if source starts with { or [ or ":
        return JSON-PARSE(source)
    return YAML-PARSE(source)
```

### 6.2 Prop Substitution (`resolve_props`)

This is a recursive tree walk that replaces prop references with their values:

```
Pseudocode:

RESOLVE-PROPS(value, props):
    if value is a dict:
        if value has exactly one key "$prop":
            path = value["$prop"]
            return DEEP-CLONE(LOOKUP-PATH(props, path))
        return { key: RESOLVE-PROPS(v, props) for key, v in value }
    if value is a list:
        result = []
        for item in value:
            resolved = RESOLVE-PROPS(item, props)
            if resolved is a list:
                result.extend(resolved)     # splice lists
            else:
                result.append(resolved)
        return result
    if value is a string:
        return INTERPOLATE-MUSTACHES(value, props)
    return value
```

The `INTERPOLATE-MUSTACHES` function handles `{{path}}` patterns. If the entire string is a single mustache and the resolved value is non-scalar (a dict or list), it returns that value directly — this is how `$prop` replacement works for complex data.

### 6.3 Normalization (`normalize_screen`)

After prop substitution, the tree may contain various aliases and shortcuts. Normalization creates a single canonical representation:

**Alias resolution:**
- `items` becomes `children`
- `label` or `content` becomes `text` (on label nodes)
- `layout: vbox` becomes `type: vbox`

**Type inference:**
- A node without `type` but with `layout: vbox` gets `type: vbox`
- A node without `type` but with `text` gets `type: label`
- A node without `type` and with `spacer: true` gets `type: spacer`

**Screen wrapping:**
- If the root node is not a `screen`, it is wrapped in one:
  ```python
  { 'type': 'screen',
    'bar': { 'type': 'fixed', 'h': 0, 'children': [] },
    'body': root,
    'nav': { 'type': 'fixed', 'h': 0, 'children': [] } }
  ```

**Validation:**
- All node types must be one of the 15 recognized types
- `screen` nodes must have a `body`
- `cond` nodes must have at least one child
- `bar` nodes must have a `max` value
- Color and waveform strings are lowercased

After normalization, every node has a `type` field, a `children` list, and canonical property names. This means every later stage only needs to handle one representation.

---

## 7. The Middle-End: Optimization Passes

**File:** `gnosis_compiler/passes.py` (115 lines)

The middle-end runs four passes over the canonical AST. Each pass is a pure function: it takes a tree and returns a new tree.

### 7.1 Dead Node Elimination (`eliminate_dead_nodes`)

Removes nodes that will never be rendered:
- Nodes with `visible: false` are deleted
- `cond` nodes with `when: false` are deleted (along with their children)
- `cond` nodes with `when: true` are replaced by their children (the `cond` wrapper is removed)

```
Pseudocode:

ELIMINATE-DEAD(node):
    if node.visible is false:
        return NULL
    new_children = []
    for child in node.children:
        result = ELIMINATE-DEAD(child)
        if result is NULL: continue
        if result is a list: new_children.extend(result)  # unwrapped cond
        else: new_children.append(result)
    node.children = new_children
    if node.type is "cond":
        if node.when is false: return NULL
        return node.children    # unwrap the cond
    return node
```

This is standard **dead code elimination** applied to a tree IR. The benefit is not just fewer nodes — dead nodes no longer consume flex space in layout, which improves the visual result.

### 7.2 Box Flattening (`flatten_boxes`)

Merges nested containers when the merge is semantically safe:

- A `vbox` child inside a `vbox` parent is flattened (children promoted) **if** the child has no explicit height, no borders, and no special properties.
- Same for `hbox` inside `hbox`, additionally requiring no `split` and no explicit width.

```
Pseudocode:

FLATTEN-BOXES(node):
    node.children = [FLATTEN-BOXES(child) for child in node.children]
    if node.type is "vbox":
        flattened = []
        for child in node.children:
            if child.type is "vbox" and no-h and no-borders:
                flattened.extend(child.children)  # promote grandchildren
            else:
                flattened.append(child)
        node.children = flattened
    # (mirror for hbox)
    return node
```

This pass is run **twice** to reach a fixed point — the first pass may expose new flattening opportunities. This is a form of **algebraic simplification** on the AST.

### 7.3 ID Assignment (`assign_ids`)

Assigns sequential IDs to every node: `n1`, `n2`, `n3`, ... These IDs are used for debug tracing and for identifying bind sites in the compilation output.

```
Pseudocode:

ASSIGN-IDS(node, counter=[0]):
    counter[0] += 1
    node.id = "n" + counter[0]
    for child in node.children:
        ASSIGN-IDS(child, counter)
    return node
```

### 7.4 Static/Dynamic Classification (`mark_static`)

A bottom-up walk that marks subtrees as static (no runtime binds) or dynamic:

```
Pseudocode:

MARK-STATIC(node) -> (node, is_dynamic):
    dynamic_here = node has "bind" property
    subtree_dynamic = dynamic_here
    for child in node.children:
        child, child_dynamic = MARK-STATIC(child)
        subtree_dynamic = subtree_dynamic or child_dynamic
    node._static = not subtree_dynamic
    return node, subtree_dynamic
```

This classification is used during lowering to determine which draw sites need refresh metadata. It is a simple form of **binding-time analysis** from partial evaluation theory.

---

## 8. The Back-End Part 1: Layout

**File:** `gnosis_compiler/layout.py` (235 lines)

The layout engine computes a pixel rectangle `Rect(x, y, w, h)` for every node in the tree. This is done at compile time — the MCU never runs a layout algorithm.

### 8.1 Screen Layout

The entry point divides the display into three vertical bands:

```
Pseudocode:

LAYOUT-SCREEN(screen, W, H, glyph_w, glyph_h):
    bar_h  = screen.bar.h
    nav_h  = screen.nav.h
    body_h = H - bar_h - nav_h

    LAYOUT-NODE(screen.bar,  0, 0,               W, bar_h)
    LAYOUT-NODE(screen.body, 0, bar_h,           W, body_h)
    LAYOUT-NODE(screen.nav,  0, bar_h + body_h,  W, nav_h)
```

### 8.2 Node Dispatch

```
Pseudocode:

LAYOUT-NODE(node, x, y, w, h):
    node.rect = Rect(x, y, w, h)
    if node.type is "vbox":    LAYOUT-VBOX(node, x, y, w, h)
    elif node.type is "hbox":  LAYOUT-HBOX(node, x, y, w, h)
    elif node.type is "fixed": LAYOUT-FIXED(node, x, y, w, h)
    elif node.type is "btn":   LAYOUT-FIXED(node, x, y, w, h)
    else:                      LAYOUT-LEAF(node, x, y, w, h)
```

### 8.3 Vertical Box Layout (two-pass)

This is the most important layout algorithm. It distributes vertical space among children:

```
Pseudocode:

LAYOUT-VBOX(node, x, y, w, h):
    ▷ Pass 1: Measure
    fixed_total = 0
    flex_count = 0
    for child in node.children:
        if child has explicit h:
            fixed_total += child.h
        else:
            flex_count += 1

    ▷ Pass 2: Assign
    remaining = h - fixed_total
    flex_h = remaining / flex_count   (integer division, 0 if no flex children)

    cursor_y = y
    for child in node.children:
        child_h = child.h if explicit, else flex_h
        LAYOUT-NODE(child, x, cursor_y, w, child_h)
        cursor_y += child_h
```

**Example:** A vbox with height 200 containing three children: `[{h:40}, {flex}, {h:60}]`
- fixed_total = 100, flex_count = 1
- remaining = 100, flex_h = 100
- Child 1: y=0, h=40. Child 2: y=40, h=100. Child 3: y=140, h=60.

### 8.4 Horizontal Box Layout

Mirrors the vbox algorithm on the x-axis, with two additions:

**Split-pane mode:** If the hbox has a `split` property, it uses a two-pane layout:
```
  +--------+---+-----------+
  | left   | | |   right   |
  | (fixed |1px|  (flex)   |
  |  width)| | |           |
  +--------+---+-----------+
```
The left pane gets exactly `split` pixels. A 1-pixel vertical divider is drawn. The right pane gets the rest.

**Intrinsic widths:** In the general case, children that are not spacers and don't have explicit widths get their **intrinsic width** — for labels, this is `len(text) * glyph_w * size`. Spacers are the flex elements on the horizontal axis.

### 8.5 Fixed Layout

Children in a `fixed` container have `x`, `y` offsets relative to the parent's origin:

```
Pseudocode:

LAYOUT-FIXED(node, x, y, w, h):
    for child in node.children:
        child_x = x + child.x
        child_y = y + child.y
        child_w = child.w or INTRINSIC-WIDTH(child)
        child_h = child.h or INTRINSIC-HEIGHT(child)
        LAYOUT-NODE(child, child_x, child_y, child_w, child_h)
```

For leaf widgets, the intrinsic size is computed from content:
- Labels: width = `len(text) * glyph_w * size`, height = `glyph_h * size`
- Separators: width = remaining parent width, height = 1
- Bars: width = remaining parent width, height = `h` or 3
- Buttons: width = widest child label + 8px padding

### 8.6 Leaf Measurement

Leaf nodes don't have children to recurse into, but they get their rect set and content metrics precomputed:

```
Pseudocode:

LAYOUT-LEAF(node, x, y, w, h):
    node.rect = Rect(x, y, w, h)
    if node.type is "label":
        size = max(1, node.size or 1)
        node.max_visible_chars = w / (glyph_w * size)
    elif node.type is "list":
        node.visible_rows = min(node.max_items, h / node.row_h)
    elif node.type is "grid":
        node.cell_w = w / node.cols
        node.visible_rows = h / node.cell_h
```

These precomputed values are used during lowering to determine how many characters to display, how many rows fit, etc.

---

## 9. The Back-End Part 2: Lowering to Bytecode

**File:** `gnosis_compiler/lower.py` (419 lines)

Lowering converts the laid-out AST into a flat stream of bytecode instructions. This is the largest and most complex stage.

### 9.1 The Walk

The lowerer walks the tree sections in order: bar, then body, then nav. For each node, it:

1. Emits border instructions (HLINE) if `border_t` or `border_b` is set
2. Emits the appropriate widget instruction based on node type
3. Recurses into children for container nodes
4. Ends with a HALT instruction

### 9.2 Constant Pools

Two interning tables are built during lowering:

**StringPool:** Maps static text strings to dense integer IDs:
```
  "GNOSIS//NAV" -> 0
  "LINK"        -> 1
  "ROLL"        -> 2
  "TEMP"        -> 3
  ...
```
If the same string appears twice, it gets the same ID. This deduplicates storage in the binary.

**BindTable:** Maps runtime binding names to dense IDs:
```
  "sensor.roll" -> 0
  "sensor.temp" -> 1
```
These IDs are what the BIND_TEXT and BIND_BAR instructions reference. The MCU runtime uses them to look up current values.

**Implementation (`bytecode.py`):**

```python
class StringPool:
    values: list[str]   # ordered list of strings
    index: dict[str,int] # string -> ID lookup

    def intern(self, text: str) -> int:
        if text not in self.index:
            self.index[text] = len(self.values)
            self.values.append(text)
        return self.index[text]
```

`BindTable` has the identical structure.

### 9.3 Instruction Emission

The `ByteWriter` class accumulates bytes:

```python
class ByteWriter:
    buffer: bytearray

    def emit_u8(self, value):   # append 1 byte
    def emit_u16(self, value):  # append 2 bytes, little-endian
    def tell(self) -> int:      # current byte offset
```

For each node type, the lowerer emits specific instructions. Here is the logic for labels:

```
Pseudocode:

LOWER-LABEL(node, writer, strings, binds, bind_sites):
    rect = node.rect
    size = max(1, node.size or 1)
    color = RESOLVE-COLOR(node.color)
    max_chars = node.max_visible_chars

    if node.invert:
        EMIT(FILL_RECT, rect, color)   # dark background
        color = BG                      # white text

    if node has bind:
        bind_id = binds.intern(node.bind)
        offset = writer.tell()
        EMIT(BIND_TEXT, rect.x, rect.y, size, color, max_chars, bind_id)
        RECORD-BIND-SITE(bind_id, node.bind, rect, node.waveform, node.id, offset)
    else:
        text_id = strings.intern(node.text)
        EMIT(TEXT, rect.x, rect.y, size, color, max_chars, text_id)
```

### 9.4 List and Grid Lowering

Lists and grids are **not** runtime widgets. They are lowered at compile time into individual TEXT instructions:

```
Pseudocode:

LOWER-LIST(node, writer, strings):
    for i in range(visible_rows):
        row_y = node.rect.y + i * row_h
        if i == selected:
            EMIT(FILL_RECT, row area, LIGHT)    # highlight
        item = data[i]
        text_id = strings.intern(item)
        EMIT(TEXT, x+2, row_y+2, 1, FG, max_chars, text_id)
```

This means a list with 6 items produces 6 (or more) TEXT instructions. The MCU runtime has no concept of "list" — it just draws text at the precomputed positions.

### 9.5 Bind Site Recording

Every time the lowerer encounters a bound value (a label or bar with `bind`), it records a `BindSite`:

```python
BindSite(
    bind_id = 0,              # which bind
    bind_name = "sensor.roll", # human-readable name
    rect = Rect(8, 40, 48, 16), # where on screen
    waveform = "part",         # how to refresh
    node_id = "n4",            # which node in the AST
    opcode_offset = 46         # byte offset of the instruction in the code
)
```

This metadata tells the MCU runtime: "when `sensor.roll` changes, redraw this 48x16 rectangle using partial refresh."

---

## 10. The Back-End Part 3: Serialization (GNBC Binary)

**File:** `gnosis_compiler/serialize.py` (85 lines)

The final compilation step packs everything into a single binary blob that the MCU can load.

### 10.1 Binary Layout

```
  Offset   Size   Field
  ──────────────────────────────────
  0x00     4      Magic: "GNBC"
  0x04     1      Version: 1
  0x05     1      Flags: 0
  0x06     2      Screen width (u16 LE)
  0x08     2      Screen height (u16 LE)
  0x0A     2      String section offset (u16 LE)
  0x0C     2      String count (u16 LE)
  0x0E     2      Bind section offset (u16 LE)
  0x10     2      Bind count (u16 LE)
  0x12     2      Region section offset (u16 LE)
  0x14     2      Region count (u16 LE)
  0x16     2      Code section offset (u16 LE)
  0x18     2      Code section size (u16 LE)
  ──────────────────────────────────
  0x1A     ...    String section
                  For each string: length(u16 LE) + UTF-8 bytes
  ...      ...    Bind section
                  For each bind name: length(u16 LE) + UTF-8 bytes
  ...      ...    Region section
                  For each region: x(u16) y(u16) w(u16) h(u16)
                                   waveform(u8) bind_count(u8) bind_ids...
  ...      ...    Code section
                  Raw bytecode ending with HALT (0xFF)
```

All multi-byte values are **little-endian** (least significant byte first). The header is exactly 26 bytes. Section offsets point to absolute positions in the file.

### 10.2 Why This Format

The GNBC format is designed so the MCU can:
1. Read the header to learn section offsets
2. Walk the string pool to resolve TEXT instruction string IDs
3. Walk the bind table to map runtime values to bind IDs
4. Walk the region table to know which rectangles to refresh
5. Interpret the code section sequentially

No parsing, no allocation, no searching. Everything is pre-indexed.

---

## 11. The Bytecode Instruction Set

**File:** `gnosis_compiler/constants.py`

The instruction set has 12 opcodes. Each instruction starts with a 1-byte opcode followed by fixed-format operands.

### 11.1 Instruction Table

```
  Opcode  Hex   Size  Operands                              Description
  ────────────────────────────────────────────────────────────────────────
  NOP     0x00   1    (none)                                 No operation
  HLINE   0x01   8    x(u16) y(u16) w(u16) color(u8)        Horizontal line
  VLINE   0x02   8    x(u16) y(u16) h(u16) color(u8)        Vertical line
  FILL    0x03  10    x(u16) y(u16) w(u16) h(u16) color(u8) Filled rectangle
  STROKE  0x04  10    x(u16) y(u16) w(u16) h(u16) color(u8) Stroked rectangle
  TEXT    0x10  10    x(u16) y(u16) size(u8) color(u8)       Static text
                      max_chars(u8) string_id(u16)
  BIND_T  0x11   9    x(u16) y(u16) size(u8) color(u8)      Dynamic text
                      max_chars(u8) bind_id(u8)
  BAR     0x12  15    x(u16) y(u16) w(u16) h(u16)           Static progress bar
                      value(u16) max(u16) track(u8) fill(u8)
  BIND_B  0x13  14    x(u16) y(u16) w(u16) h(u16)           Dynamic progress bar
                      bind_id(u8) max(u16) track(u8) fill(u8)
  CIRCLE  0x14   8    cx(u16) cy(u16) r(u16) color(u8)      Circle outline
  CROSS   0x15   8    cx(u16) cy(u16) len(u16) color(u8)    Cross/plus shape
  HALT    0xFF   1    (none)                                 End of program
```

### 11.2 Color Palette

Five colors, designed for e-ink rendering:

```
  ID  Name   Hex       Usage
  ────────────────────────────────
  0   BG     #d8d4cc   Background (paper color)
  1   FG     #2a2a28   Foreground (near-black)
  2   MID    #9e9a92   Borders, secondary text
  3   LIGHT  #c4c0b8   Selection highlights, bar tracks
  4   GHOST  #b8b4ac   Hints, labels, very subtle text
```

On the actual 1-bit e-ink display, these map to dithering patterns. In the web UI, they render as their hex color values.

### 11.3 Waveform Classes

```
  ID  Name   Speed     Quality           When to use
  ──────────────────────────────────────────────────────
  0   FULL   ~300ms    No ghosting       Full screen redraws
  1   PART   ~100ms    Mild ghosting     Moderate-frequency updates
  2   FAST   ~50ms     Some ghosting     High-frequency sensor values
```

### 11.4 How TEXT and BIND_TEXT Differ

`TEXT` references a string by its pool ID. The MCU looks up the string in the string section and draws it.

`BIND_TEXT` references a bind by its table ID. The MCU looks up the *current runtime value* for that bind and draws it. The `max_chars` field tells the MCU how wide the field is, so it can clear the old value before drawing the new one.

This means static text is fully resolved at compile time (the actual characters are in the binary), while dynamic text requires a runtime lookup.

---

## 12. Refresh Regions and Dirty Tracking

**File:** `gnosis_compiler/lower.py` (`merge_regions` function)

### 12.1 The Problem

When a sensor value changes, the MCU needs to update part of the screen. E-ink partial refreshes are expensive, so we want to refresh the **smallest possible rectangle** with the **fastest possible waveform**.

### 12.2 Bind Sites to Refresh Regions

During lowering, the compiler records a `BindSite` for every bound widget. After lowering, these sites are merged into `RefreshRegion`s using a greedy algorithm:

```
Pseudocode:

MERGE-REGIONS(bind_sites, threshold):
    regions = [one RefreshRegion per BindSite]

    repeat:
        merged_any = false
        for each pair (i, j) where i < j:
            union_rect = UNION(regions[i].rect, regions[j].rect)
            waste = AREA(union_rect) - AREA(regions[i].rect) - AREA(regions[j].rect)
            if waste < threshold:      # default threshold: 512 pixels^2
                MERGE regions[i] and regions[j]
                REMOVE regions[j]
                merged_any = true
                break
    until not merged_any

    return regions
```

**Why merge?** If two bind sites are close together, it's cheaper to refresh one larger rectangle than two separate ones (each partial refresh has fixed overhead). The `threshold` controls how much "waste" area we tolerate.

**Why not always merge?** On e-ink, refreshing a large rectangle is much more visible than refreshing a small one. Merging distant regions creates a big flash. The threshold prevents this.

### 12.3 Waveform Selection

When two bind sites are merged, the resulting region uses the **worst (slowest)** waveform of the two. The ordering is: FAST < PART < FULL. If any bind in the region needs FULL refresh, the entire region uses FULL.

### 12.4 Example

The dashboard has three bind sites:
```
  sensor.roll text:  (8, 40,  48, 16)  waveform=part
  sensor.roll bar:   (8, 72, 168,  4)  waveform=part
  sensor.temp text:  (8, 120,  64, 16)  waveform=fast
```

The roll text and roll bar are close but not close enough to merge (the waste would exceed 512 px^2 at those dimensions). The temp text is far away. Result: 3 separate regions.

---

## 13. Data Structures Reference

### 13.1 Rect (`util.py`)

The fundamental geometry type:

```python
@dataclass(frozen=True)
class Rect:
    x: int    # left edge
    y: int    # top edge
    w: int    # width in pixels
    h: int    # height in pixels

    def area(self) -> int           # w * h
    def union(self, other) -> Rect  # bounding box of both
    def intersects(self, other) -> bool
```

### 13.2 CompileOptions (`model.py`)

```python
@dataclass
class CompileOptions:
    width: int = 400                    # display width
    height: int = 300                   # display height
    glyph_w: int = 8                    # pixels per character horizontally
    glyph_h: int = 8                    # pixels per character vertically
    region_merge_threshold: int = 512   # max waste for region merging
```

### 13.3 BindSite (`model.py`)

```python
@dataclass
class BindSite:
    bind_id: int          # dense index into BindTable
    bind_name: str        # e.g., "sensor.roll"
    rect: Rect            # screen rectangle for this draw site
    waveform: str         # "fast", "part", or "full"
    node_id: str          # AST node ID (e.g., "n4")
    opcode_offset: int    # byte offset in the code section
```

### 13.4 RefreshRegion (`model.py`)

```python
@dataclass
class RefreshRegion:
    rect: Rect            # merged bounding rectangle
    waveform: str         # worst-case waveform in this region
    bind_ids: list[int]   # which binds trigger this region
    bind_names: list[str] # human-readable bind names
```

### 13.5 Program (`model.py`)

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
    stats: dict[str, Any]          # compilation statistics
    ast: dict[str, Any]            # final laid-out AST
    binary: bytes | None           # serialized GNBC
```

---

## 14. File-by-File Guide

### Compiler Core

| File | Lines | What it does |
|------|-------|-------------|
| `gnosis_compiler/compiler.py` | 146 | **Orchestrator.** The `Compiler` class wires all stages together. `compile()` is the main entry point. `compile_with_stages()` captures intermediate ASTs for the web UI. |
| `gnosis_compiler/dsl.py` | 215 | **Front-end.** `load_source()` parses YAML/JSON. `resolve_props()` substitutes compile-time parameters. `normalize_screen()` creates the canonical AST. |
| `gnosis_compiler/passes.py` | 115 | **Middle-end.** Four pure-function tree transforms: dead elimination, box flattening, ID assignment, static classification. |
| `gnosis_compiler/layout.py` | 235 | **Layout engine.** Recursive two-pass flex layout for vbox/hbox. Fixed positioning for absolute containers. Leaf measurement for labels, lists, grids. |
| `gnosis_compiler/lower.py` | 419 | **Bytecode emission.** The largest file. Walks the laid-out AST, emits instructions, builds string pool and bind table, records bind sites, merges regions. |
| `gnosis_compiler/serialize.py` | 85 | **Binary serialization.** Packs the Program into the GNBC format with header, four sections, and computed offsets. |

### Support Files

| File | Lines | What it does |
|------|-------|-------------|
| `gnosis_compiler/constants.py` | 59 | All enums: Opcode (12 values), Color (5 values), Waveform (3 values). Lookup maps. Default dimensions. Set of valid node types. |
| `gnosis_compiler/model.py` | 81 | Data classes: `CompileOptions`, `BindSite`, `RefreshRegion`, `Program`. The `to_manifest()` method exports everything as JSON. |
| `gnosis_compiler/bytecode.py` | 52 | Low-level utilities: `ByteWriter` (accumulates bytes), `StringPool` (deduplicating string intern table), `BindTable` (same for binds). |
| `gnosis_compiler/disasm.py` | 147 | **Disassembler.** Converts bytecode back to human-readable text. Walks bytes with a program counter, decodes each opcode. |
| `gnosis_compiler/util.py` | 121 | `Rect` dataclass, `deep_clone`, `interpolate_string` (mustache substitution), `lookup_path` (dot-notation access into nested dicts). |
| `gnosis_compiler/errors.py` | 3 | `CompileError` exception class. |
| `gnosis_compiler/cli.py` | 41 | Command-line interface. Accepts source + props paths, writes binary, assembly, and manifest files. |

### Web UI

| File | Lines | What it does |
|------|-------|-------------|
| `web_server.py` | ~150 | Flask server. `/api/compile` calls the compiler and returns all stages + bytecode + disassembly as JSON. `/api/presets` serves example screens. |
| `web/index.html` | ~600 | Single-file frontend. YAML editor, JS bytecode interpreter rendering to canvas, 7 inspector panels (disassembly, AST, hex, stats, manifest, regions, bind sim), 3 debug overlays. |

### Examples

| File | Description |
|------|-------------|
| `examples/dashboard.yaml` + `.props.yaml` | Navigation dashboard with sensor telemetry, task list, split pane |
| `examples/boot.yaml` | Boot/startup screen with concentric circles, progress bar |
| `examples/calendar.yaml` + `.props.yaml` | Calendar grid with agenda and upcoming events |
| `examples/sensors.yaml` + `.props.yaml` | 6 runtime binds: roll, pitch, temp, humidity, battery, voltage |
| `examples/widgets.yaml` | Gallery of all widget types: text sizes, bars, shapes, lists, inverted labels |
| `examples/minimal.yaml` | Simplest possible screen — good starting point |

---

## 15. The Web Experimentation Tool

The project includes a browser-based tool for experimenting with the compiler. It lets you edit YAML in real time, see the compiled screen, and inspect every intermediate artifact.

### 15.1 Running It

```bash
cd /home/manuel/code/wesen/2026-03-22--gnosis-compiler
pip install flask pyyaml    # if not already installed
python web_server.py --debug
# Open http://127.0.0.1:8080
```

### 15.2 Architecture

```
  Browser                              Python Server
  ──────                               ─────────────
  YAML Editor  ──(POST /api/compile)──>  Flask app
  Props Editor                           │
                                         v
                                     Compiler.compile_with_stages()
                                         │
                                         v
                                     JSON response with:
  <──────────────────────────────────  - stages (7 intermediate ASTs)
                                       - program (manifest)
  Canvas ◄── JS bytecode interpreter   - disassembly text
  Disassembly panel                    - base64 bytecode
  AST viewer                           - base64 GNBC binary
  Hex dump
  Stats dashboard
  Region inspector
  Bind simulator
```

### 15.3 The JavaScript Bytecode Interpreter

The frontend contains a complete bytecode interpreter that executes the compiled bytecode on an HTML5 canvas. It handles all 12 opcodes using **little-endian** u16 decoding (matching the Python compiler). A 5x7 bitmap font renders text character by character. The canvas uses the 5-color e-ink palette with optional grain texture.

### 15.4 Inspector Panels

- **Disassembly**: Each bytecode instruction with offset, opcode, and decoded operands
- **AST**: Interactive tree view with a dropdown to switch between 7 compilation stages (parsed, resolved, canonical, after_dead_elimination, after_flatten, after_classify, laid_out)
- **Hex**: Raw byte dump with ASCII column
- **Stats**: Node counts, code size, pass effects, string/bind counts
- **Manifest**: Full JSON manifest with all compilation metadata
- **Regions**: Refresh regions with rectangles, waveforms, and bound binds
- **Bind Sim**: Enter values for runtime binds to simulate MCU behavior

### 15.5 Debug Overlays

Three overlays can be toggled on the canvas:
- **BOUNDS**: Colored rectangles around every node, hue varies by tree depth
- **DIRTY**: Refresh regions shown as colored rectangles with waveform labels
- **DEPTH**: Transparent heatmap showing tree depth

---

## 16. Worked Example: Compiling the Dashboard

Let us trace the full compilation of `examples/dashboard.yaml` with `examples/dashboard.props.yaml`.

### 16.1 Input

**Source (`dashboard.yaml`)** defines a screen with:
- A bar with `{{title}}`, spacer, `{{status}}` in ghost color
- A body with split-pane: left has roll/temp sensors, right has task list
- A nav with "A:OK" and `{{footer}}`

**Props (`dashboard.props.yaml`):**
```yaml
title: GNOSIS//NAV
status: LINK
footer: READY
tasks: [Calibrate IMU, Sync clock, Check bus voltage, ...]
```

### 16.2 Front-End

1. `load_source()` parses the YAML into a Python dict
2. `resolve_props()` replaces `{{title}}` with `"GNOSIS//NAV"`, `{{status}}` with `"LINK"`, `{{footer}}` with `"READY"`, and `{$prop: tasks}` with the tasks array
3. `normalize_screen()` canonicalizes all node types and validates

### 16.3 Middle-End

- Dead elimination: 19 nodes in, 19 out (no dead nodes in this example)
- Box flattening: 19 nodes in, 19 out (no nested same-axis boxes)
- IDs assigned: n1 through n19
- Static marking: 14 static, 5 dynamic (the sensor labels and bars have binds)

### 16.4 Layout

- Bar: y=0, h=16. Body: y=16, h=248. Nav: y=264, h=16.
- Body is an hbox with split=188: left pane 0-187, divider at 188, right pane 189-399
- Labels get rects based on their text width and position
- `sensor.roll` label (size=2, field_w=3): rect = (8, 40, 48, 16)
- Task list (6 items, row_h=16): each row gets its own rect

### 16.5 Lowering

The lowerer produces 22 instructions:

```
0000: HLINE       x=0 y=15 w=400 color=mid         # bar bottom border
0008: TEXT        x=0 y=0 ... string[0]='GNOSIS//NAV'
0012: TEXT        x=368 y=0 ... string[1]='LINK'
001c: VLINE       x=188 y=16 h=248 color=mid        # split divider
0024: TEXT        x=8 y=24 ... string[2]='ROLL'
002e: BIND_TEXT   x=8 y=40 ... bind[0]='sensor.roll'
0037: BIND_BAR    x=8 y=72 ... bind[0]='sensor.roll'
...
0060: TEXT        x=189 y=16 ... string[4]='TASKS'
006a: TEXT        x=191 y=34 ... string[5]='Calibrate IMU'
0074: FILL_RECT   x=189 y=48 ... color=light         # selected row highlight
007e: TEXT        x=191 y=50 ... string[6]='Sync clock'
...
00b0: HLINE       x=0 y=264 w=400 color=mid          # nav top border
00b8: TEXT        x=0 y=264 ... string[11]='A:OK'
00c2: TEXT        x=360 y=264 ... string[12]='READY'
00cc: HALT
```

Total: 205 bytes of bytecode, 13 interned strings, 2 binds, 3 refresh regions.

### 16.6 Serialization

The GNBC binary is 371 bytes:
- Header: 26 bytes
- String section: ~120 bytes (13 strings with length prefixes)
- Bind section: ~28 bytes (2 bind names)
- Region section: ~36 bytes (3 regions with bind IDs)
- Code section: 205 bytes

### 16.7 Statistics Summary

```
  Input nodes:     19
  Final nodes:     19
  Static nodes:    14
  Dynamic nodes:   5
  Bind count:      2 (sensor.roll, sensor.temp)
  String count:    13
  Code size:       205 bytes
  Region count:    3
  Binary size:     371 bytes
```

---

## 17. Compiler Theory Mapping

For readers with a compiler background, here is how each compiler concept maps to the GNOSIS implementation:

| Compiler Concept | GNOSIS Implementation |
|---|---|
| **Lexing / Parsing** | YAML parsing via PyYAML (`dsl.py:load_source`) |
| **AST normalization** | Alias resolution, type inference, screen wrapping (`dsl.py:normalize_screen`) |
| **Intermediate representation** | Python dicts with canonical fields (type, children, rect, ...) |
| **Constant folding** | Prop substitution before layout (`dsl.py:resolve_props`) |
| **Dead code elimination** | Removing `visible:false` and `cond when:false` nodes (`passes.py:eliminate_dead_nodes`) |
| **Algebraic simplification** | Flattening nested same-axis boxes (`passes.py:flatten_boxes`) |
| **Binding-time analysis** | Static/dynamic subtree classification (`passes.py:mark_static`) |
| **Partial evaluation** | Props resolve at compile time; only binds remain for runtime |
| **Compile-time evaluation** | Layout, list lowering, grid lowering — all done ahead of time |
| **Instruction selection** | Choosing TEXT vs BIND_TEXT, BAR vs BIND_BAR, lowering borders to HLINE (`lower.py`) |
| **Constant pooling** | StringPool for text, BindTable for bind names (`bytecode.py`) |
| **Register allocation** | Not applicable (stack machine with implicit rect arguments) |
| **Object file format** | GNBC binary with header + four sections (`serialize.py`) |
| **Link-time optimization** | Region merging as a post-lowering optimization (`lower.py:merge_regions`) |

---

## 18. How to Run Everything

### 18.1 Prerequisites

```bash
pip install pyyaml flask
```

### 18.2 Compile a Screen from the Command Line

```bash
cd /home/manuel/code/wesen/2026-03-22--gnosis-compiler

# Compile dashboard example
python -m gnosis_compiler.cli \
  examples/dashboard.yaml \
  --props examples/dashboard.props.yaml \
  --binary-out out/dashboard.gnbc \
  --asm-out out/dashboard.asm.txt \
  --manifest-out out/dashboard.manifest.json
```

### 18.3 Use the Python API

```python
from gnosis_compiler import Compiler, CompileOptions

compiler = Compiler(CompileOptions(width=400, height=280))
program = compiler.compile("examples/dashboard.yaml", "examples/dashboard.props.yaml")

print(program.code)        # raw bytecode
print(program.strings)     # string pool
print(program.binds)       # bind names
print(program.regions)     # refresh regions
print(program.stats)       # compilation statistics
print(len(program.binary)) # GNBC binary size
```

### 18.4 Use `compile_with_stages` for Intermediate ASTs

```python
from gnosis_compiler import Compiler

compiler = Compiler()
program, stages = compiler.compile_with_stages(
    "examples/dashboard.yaml",
    "examples/dashboard.props.yaml"
)

print(list(stages.keys()))
# ['parsed', 'resolved', 'canonical', 'after_dead_elimination',
#  'after_flatten', 'after_classify', 'laid_out']
```

### 18.5 Run the Web UI

```bash
python web_server.py --debug
# Open http://127.0.0.1:8080
```

### 18.6 Run Tests

```bash
python -m unittest tests.test_compiler -v
```
