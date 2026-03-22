# GNOSIS Compiler Guide

## 1. Why restart from first principles

The old implementation mixed at least five separate concerns in the same place:

- screen authoring format
- layout algorithm
- optimization logic
- bytecode emission
- visualization / demo UI

That structure makes every change expensive, because there is no stable compiler pipeline. A restart fixes that by restoring the standard front-end / middle-end / back-end split used in real compilers.

This rebuild keeps the authored DSL simple and moves the intelligence into ordinary compiler stages instead of a second transform language.

---

## 2. Design goal

The compiler should answer one concrete question:

> Given a screen description and some compile-time props, what is the smallest runtime program an MCU needs in order to draw and refresh that screen efficiently?

That leads directly to four decisions.

### 2.1 The source language stays descriptive

The authored DSL says **what** the screen is:

- layout containers
- leaf widgets
- bindings
- static strings
- constant dimensions

It does not try to describe optimization rules.

### 2.2 Props are compile-time inputs

External props are resolved before layout and lowering. This lets one authored screen compile into many concrete binaries, similar to instantiating a React component with different props.

### 2.3 Runtime dynamism is explicit

Anything that changes on-device uses `bind`. That separation matters:

- props affect compilation
- binds affect refresh-time redraw

### 2.4 The output is bytecode plus metadata

The embedded runtime needs more than drawing instructions. It also needs:

- a binding table
- exact rectangles for each dynamic site
- merged refresh regions

So the compiler emits a draw program and the metadata required for partial updates.

---

## 3. Compiler architecture

The rebuild follows a conventional compiler pipeline.

```text
source YAML / JSON
  -> load
  -> resolve props
  -> normalize AST
  -> middle-end passes
  -> compile-time layout
  -> instruction selection
  -> bytecode + metadata serialization
```

### 3.1 Front-end

Files:

- `dsl.py`

Responsibilities:

- parse YAML or JSON
- substitute props
- normalize aliases (`items -> children`, `label/content -> text`)
- validate the tree shape
- wrap non-screen roots in a trivial `screen`

Compiler theory name: **parsing + AST normalization**.

Normalization matters because every later pass should operate on one canonical tree, not on every source-level spelling variant.

### 3.2 Middle-end

Files:

- `passes.py`

Responsibilities:

- eliminate dead nodes (`visible: false`, `cond when: false`)
- flatten nested `vbox` / `hbox`
- assign stable node IDs
- classify subtrees as static or dynamic

Compiler theory names:

- **dead code elimination**
- **tree simplification**
- **data-flow style classification**

This stage is where you make the program easier to lower.

### 3.3 Back-end

Files:

- `layout.py`
- `lower.py`
- `serialize.py`

Responsibilities:

- compute concrete rectangles
- choose bytecode instructions
- build constant pools
- assign binding IDs
- compute refresh regions
- serialize the final binary

Compiler theory names:

- **layout as compile-time evaluation**
- **instruction selection**
- **constant pooling**
- **target-specific lowering**

---

## 4. The authored DSL

The clean version of the DSL is small.

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
  type: fixed
  children:
    - type: label
      x: 8
      y: 8
      text: ROLL
    - type: label
      x: 8
      y: 24
      bind: sensor.roll
      field_w: 3
      size: 2
nav:
  type: fixed
  h: 0
  children: []
```

### 4.1 Why there is no transform DSL

A second declarative language for optimization passes is attractive in the abstract, but it is the wrong next move here.

The actual problem is not “we need a meta-compiler.” The actual problem is “the current compiler is collapsing phases together.”

Once the pipeline is clean, many useful optimizations are just ordinary passes over a normal AST:

- drop unreachable nodes
- flatten trivial containers
- pre-measure labels
- lower static lists to ordinary text draws
- precompute dirty regions

That gives you most of the value with far less machinery.

---

## 5. Props vs binds

This split is one of the most important design choices.

## Props

Props are compile-time substitutions.

```yaml
text: "{{title}}"
data: { $prop: tasks }
```

Use props for:

- static screen variants
- list contents known before compile time
- dimensions or labels selected by build step or host app

## Binds

Binds are runtime inputs.

```yaml
bind: sensor.roll
```

Use binds for:

- sensor values
- clocks
- battery percentages
- anything that changes after the screen is compiled

### Why the split matters

If you blur these together, the compiler loses power.

If a value is a prop, the compiler can:

- fold it into the AST
- run layout with the actual value
- intern the result in the string table
- lower lists and grids into fixed draw ops

If a value is a bind, the compiler can only reserve space and produce redraw metadata.

This is the same basic idea as **partial evaluation**: compute everything at compile time that does not depend on runtime state.

---

## 6. Canonical AST

After loading and prop substitution, all later passes work on a normalized tree.

Examples of normalization:

- `layout: vbox` becomes `type: vbox`
- `items` becomes `children`
- `label` / `content` becomes `text`
- non-screen roots are wrapped in `screen`

Why this matters:

- every pass gets one representation
- every bug only needs to be fixed once
- the back-end does not need source-level special cases

In compiler terms, this is creating a stable **intermediate representation**.

---

## 7. Middle-end passes

## 7.1 Dead node elimination

Two things are removed before layout:

- nodes with `visible: false`
- `cond` nodes whose `when` condition is false

This is standard **dead code elimination** on a tree IR.

The key benefit is not just fewer nodes. It also improves layout quality, because dead nodes no longer consume flex space.

## 7.2 Box flattening

Nested `vbox` and `hbox` nodes are flattened when the rewrite is semantically safe.

Safe cases are deliberately conservative:

- same axis
- no extra borders
- no split pane on the child
- no explicit size on the flattened axis

This is classic **algebraic simplification** / **peephole optimization**, but applied to the AST instead of machine code.

## 7.3 Static / dynamic classification

A subtree is marked static iff it contains no runtime binds.

This classification does two things:

- it identifies which leaves need refresh metadata
- it tells you which subtrees are safe to fully evaluate at compile time

This is a very small form of **binding-time analysis**, the same family of ideas used in partial evaluation.

---

## 8. Compile-time layout

The layout engine is a direct implementation of the recursive box layout from your algorithm spec, with one practical refinement.

### 8.1 Kept from the spec

- screen is divided into `bar`, `body`, `nav`
- `vbox` uses a two-pass fixed-plus-flex layout
- `hbox` mirrors the same algorithm horizontally
- `fixed` places children independently
- labels precompute visible character counts
- lists and grids precompute visible rows / cell metrics

### 8.2 Intentional refinement

For fixed-position leaf widgets, omitted dimensions use **intrinsic sizes** where that is obviously better than “fill the remaining parent area.”

Examples:

- labels default to text width × glyph size and one line of height
- separators default to height `1`
- buttons default to intrinsic width plus padding

Why the change:

The raw “fill remainder” rule is fine for container-like children, but it produces absurd dirty regions for leaf widgets in fixed layouts. A label at `(8, 24)` should not be treated as a giant rectangle extending to the bottom-right corner of the panel.

This refinement makes the output much closer to what an MCU runtime actually wants.

---

## 9. Lowering strategy

Lowering converts the laid-out AST to a flat instruction stream.

### 9.1 Constant pools

Static strings are interned into a string pool.

That gives two wins:

- repeated strings are stored once
- `TEXT` instructions can use small IDs instead of inline text blobs

This is the same basic idea as a **constant pool** in a bytecode VM.

### 9.2 Binding table

Every distinct runtime bind is interned into a dense table.

Example:

```text
sensor.roll -> 0
sensor.temp -> 1
```

This makes runtime dispatch cheap and makes the binary self-contained.

### 9.3 Instruction selection

The back-end emits a small instruction vocabulary:

- `HLINE`
- `VLINE`
- `FILL_RECT`
- `STROKE_RECT`
- `TEXT`
- `BIND_TEXT`
- `BAR`
- `BIND_BAR`
- `CIRCLE`
- `CROSS`
- `HALT`

Static lists and grids are not special runtime widgets in the final program. They are lowered into ordinary draw instructions. That is deliberate.

Why this is good:

- smaller runtime surface area
- less interpreter complexity
- more compile-time work, less device work

This is another form of **partial evaluation**.

---

## 10. Refresh-region analysis

For every dynamic leaf, the compiler records:

- bind ID
- rectangle
- waveform class
- node ID
- opcode offset

That gives you exact redraw sites for runtime updates.

Then the compiler greedily merges nearby rectangles using the same style of area-waste threshold described in your original algorithm.

This stage is best thought of as:

- **dependency analysis** over binds
- followed by **geometric region coalescing**

It is not traditional register allocation or scheduling, but it sits in the same “target-aware late optimization” part of the pipeline.

---

## 11. Binary format

The serialized `GNBC` file contains four sections:

1. string pool
2. bind table
3. region table
4. code section

So the runtime can load one blob and get:

- the draw program
- the symbolic bind mapping
- the refresh regions

This is closer to a real object file format than to a raw instruction array.

---

## 12. How this maps to compiler theory

The implementation uses a narrow, practical subset of compiler ideas.

### Parsing and normalization

Used in:

- YAML / JSON loading
- source alias cleanup
- canonical AST creation

### Intermediate representation design

Used in:

- normalized tree nodes with canonical fields
- layout-annotated AST with `rect` and precomputed metrics

### Dead code elimination

Used in:

- `visible: false`
- `cond when: false`

### Peephole / local tree optimization

Used in:

- flattening nested boxes

### Partial evaluation

Used in:

- prop substitution
- compile-time layout
- static list lowering
- static grid lowering
- static text pooling

### Binding-time analysis

Used in:

- static vs dynamic subtree classification
- deciding which draw sites need runtime metadata

### Instruction selection

Used in:

- choosing `TEXT` vs `BIND_TEXT`
- choosing `BAR` vs `BIND_BAR`
- lowering container borders to line instructions

### Object-format style serialization

Used in:

- turning the compiler result into a binary with multiple sections and offsets

---

## 13. Why this is better than the old single-file approach

The old structure forced one representation to do every job.

This rebuild separates:

- authored syntax
- canonical AST
- laid-out AST
- bytecode
- serialized binary

That gives you three concrete benefits.

### Better reasoning

You can debug a stage in isolation.

### Better optimization

You can add new passes without touching rendering code.

### Better runtime simplicity

The MCU runtime only needs to interpret a compact instruction set and use precomputed metadata.

---

## 14. Extension roadmap

If you keep extending this compiler, the next additions should be ordinary passes, not a meta-language.

A sane order is:

1. prerender static text runs into bitmaps
2. add clipping instructions for scrollable panes
3. split refresh regions by bind set and waveform policy
4. add string formatting descriptors for dynamic labels
5. add an optional C emitter that reads the same laid-out IR

Only after the ordinary pass pipeline starts feeling cramped should you consider a declarative pass language.

---

## 15. Reading list

This is the shortest reading list I would use for this problem.

### For practical compiler structure

- **Engineering a Compiler** — Cooper and Torczon
- **Modern Compiler Implementation** — Appel
- **Essentials of Compilation** — Siek and collaborators

These are the best references for “how do I structure a real compiler pipeline without getting lost in theory.”

### For optimization catalogs and back-end thinking

- **Advanced Compiler Design and Implementation** — Muchnick

Use this when you want the broad optimization vocabulary.

### For rewrite systems and tree transformations

- **Term Rewriting and All That** — Baader and Nipkow

This is the right background if you later revisit declarative rewrite rules.

### For partial evaluation / compile-time execution

- **Partial Evaluation and Automatic Program Generation** — Jones, Gomard, Sestoft

This is the conceptual source for the strongest optimizations in this project.

### For IR and modern compiler infrastructure

- the MLIR documentation on dialects, canonicalization, and pattern rewriting

Even if you never adopt MLIR, it is excellent for learning how to think about multiple IR levels.

---

## 16. Bottom line

The important change is not the specific bytecode format.

The important change is that the compiler now has stable layers:

- front-end
- middle-end
- back-end

Once those exist, the system becomes easy to reason about, easy to optimize, and easy to port to another implementation language later.
