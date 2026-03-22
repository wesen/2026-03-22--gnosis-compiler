# Compiler Guide: Dynamic GNOSIS Layout Programs

## 1. Problem statement

The original static compiler model specialized the DSL all the way down to draw operations. That is efficient, but it cannot reflow layout when a runtime string changes length.

The new compiler changes the target from:

- **static draw list**

to:

- **residual layout program**

The host compiler still performs as much work as possible ahead of time, but it leaves behind a small program that the microcontroller evaluates with runtime data.

That is the compiler-theory idea here: **partial evaluation**.

## 2. Core model

Every node gets six slots:

- `mw`, `mh`: measured size
- `x`, `y`, `w`, `h`: final rectangle

The compiler computes symbolic expressions for those slots.

Examples:

```text
label(title).mw = measure(bind(props.title))
label(colon).mw = 16
value.x = title.mw + 28
```

After simplification, anything constant becomes data in `slot_init`. Only the residual expressions become bytecode.

## 3. Pipeline

The implemented pipeline is:

1. parse YAML
2. normalize nodes
3. assign node ids and slot ids
4. build symbolic measure expressions bottom-up
5. build symbolic placement expressions top-down
6. constant-fold the expression graph
7. eliminate dead slots
8. emit bytecode
9. serialize program blob

That split matters.

- **bottom-up** is where size bubbling happens
- **top-down** is where positions and allocated rectangles happen

## 4. Binding-time analysis

This compiler uses a simple form of binding-time analysis.

Values are divided into:

### Static

Known on the host compiler:

- literal text
- numeric constants
- explicit `w`/`h`
- fixed field widths
- theme constants
- font metrics

### Dynamic, geometry-affecting

Known only at runtime and may change layout:

- intrinsic labels with `bind: ...` and no `field_w`
- any parent size that depends on those labels
- sibling positions that depend on those parent/child sizes

### Dynamic, geometry-neutral

Known only at runtime but do not change layout:

- `bar` values
- bound labels that use `field_w`

This classification is why the generated program is still efficient.

## 5. Size bubbling

Size bubbling is implemented as symbolic bottom-up measurement.

For `label`:

```text
literal label:
  mw = len(text) * glyph_w * size
  mh = glyph_h * size

bound intrinsic label:
  mw = runtime_measure(bind)
  mh = glyph_h * size
```

For `hbox`:

```text
mw = sum(child widths) + gap * (n - 1)
mh = max(child heights)
```

For `vbox`:

```text
mw = max(child widths)
mh = sum(child heights) + gap * (n - 1)
```

For `fixed`:

```text
mw = max(child.x + child.w)
mh = max(child.y + child.h)
```

Those are symbolic expressions, not immediate numbers. If a child width is dynamic, the parent width remains symbolic until runtime.

## 6. Why a slot machine instead of a tree walker VM

A fully generic tree VM is possible, but it is harder to optimize.

The implemented design is a hybrid:

- tree structure is compiled away on the host
- runtime only sees:
  - a few specialized measure ops
  - a small arithmetic VM over slots
  - draw ops

This keeps the runtime simple:

- no heap allocation
- no recursive traversal required on the MCU
- no dynamic AST objects
- no pattern matching at runtime

The host compiler does the structural work once.

## 7. Expression lowering

The symbolic slot IR uses a tiny expression language:

- constants
- slot references
- `+`
- `-`
- `*`
- `/`
- `max`
- `min`

Example:

```text
value.x = title.mw + 28
```

This lowers to:

```text
PUSH_SLOT  n3.mw
PUSH_CONST 28
ADD
STORE_SLOT n5.x
```

That is the “generic arithmetic layer” that lets the runtime handle formulas like `32 + 2 + measure(x)` without needing a bespoke opcode for every shape of expression.

## 8. Constant folding

The compiler folds constants aggressively.

Example source:

```yaml
- type: label
  text: ": "
```

With `glyph_w = 8`, this becomes:

```text
mw = 16
mh = 8
```

No runtime measurement remains.

The same happens to compounded formulas. For example:

```text
8 + 2 + 16 + 2
```

becomes:

```text
28
```

So sibling placement ends up as one dynamic slot plus one constant, not a chain of additions.

## 9. Dead slot elimination

A notable optimization in this implementation is dead slot elimination.

Example:

- a parent `hbox` width may be computed symbolically
- but if only the child draw rects are needed, the compiler can inline the parent effect into the child formulas
- the parent slot itself then disappears from runtime code

That is why the compiled `dynamic_hbox` example only evaluates the slots that are actually needed for drawing.

This is analogous to dead code elimination in a regular compiler.

## 10. Runtime structure

The runtime program format is:

1. header
2. bind pool
3. string pool
4. slot initialization table
5. bytecode stream

At evaluation time:

1. copy `slot_init` to RAM
2. run measurement ops for live intrinsic leaves
3. run residual expression program
4. execute draw ops

The Python reference VM returns draw traces. The C runtime is structured the same way but calls drawing hooks.

## 11. Why this is efficient on a microcontroller

The runtime cost is bounded and explicit:

- slot buffer: `6 * node_count * sizeof(uint16_t)`
- tiny operand stack
- linear bytecode walk
- no runtime parsing of YAML
- no heap allocation
- no recursion required in the C interpreter

Most of the work stays on the host compiler.

## 12. What was *not* implemented yet

This implementation is intentionally narrow.

Still missing:

- full widget parity with the original GNOSIS code
- dirty-region scheduling and waveform grouping
- conditionals and visibility-based layout
- static subtree rasterization to ROM bitmaps
- faster string pool indexing in the C runtime
- richer draw ops and clipping

Those are engineering follow-ons, not architecture blockers.

## 13. How to read the output

Three artifacts matter most:

### Slot IR dump

Shows the symbolic meaning of every slot.

Example:

```text
node n5: type=label
  x = (s18 + 28)
  w = 32
```

### Disassembly

Shows what actually survived into runtime bytecode.

Example:

```text
0000: MEASURE_TEXT_BIND  n3 bind[0] size=1
0006: PUSH_SLOT          n3.mw
0009: PUSH_CONST         28
000c: ADD
000d: STORE_SLOT         n5.x
```

### Evaluation traces

Show the same program evaluated with different runtime values.

That is the proof that the compiler emits a generic residual program rather than recompiling per input string.

## 14. Most relevant reading

For the theory behind this design, the best follow-up topics are:

- partial evaluation / staging
- attribute grammars
- static single assignment and dataflow
- dead code elimination
- instruction selection
- stack-machine IRs

Practical books and materials:

- *Engineering a Compiler* — Cooper and Torczon
- *Modern Compiler Implementation* — Appel
- *Compilers: Principles, Techniques, and Tools* — Aho, Lam, Sethi, Ullman
- *Essentials of Compilation* — Siek et al.
- MLIR canonicalization and folding docs

The implementation here is closest in spirit to a small staged compiler with a custom VM backend.
