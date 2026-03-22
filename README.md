# GNOSIS Compiler Rebuild

This is a clean restart of the GNOSIS compiler as a small, layered reference implementation.

It compiles a YAML or JSON layout DSL into a compact bytecode program plus the metadata an embedded runtime actually needs:

- a string pool
- a binding table
- per-binding draw sites
- precomputed refresh regions
- a serialized `GNBC` binary blob

The implementation is intentionally split into compiler stages instead of mixing parsing, layout, optimization, rendering, and UI concerns in one file.

## What this rebuild does

- accepts YAML or JSON screen descriptions
- accepts external props and substitutes them into the DSL before compilation
- normalizes the authored DSL into a canonical AST
- runs a small set of middle-end passes:
  - dead node elimination
  - flattening nested same-axis boxes
  - static/dynamic subtree classification
- runs layout at compile time
- lowers the laid-out tree to bytecode
- emits a bind table and dirty-refresh regions for runtime updates
- serializes everything into a single `GNBC` binary

## Implemented DSL surface

Containers:

- `screen`
- `vbox`
- `hbox`
- `fixed`
- `cond`
- `spacer`

Widgets:

- `label`
- `bar`
- `list` (static data, lowered at compile time)
- `grid` (static data, lowered at compile time)
- `sep`
- `btn`
- `fill`
- `circle`
- `cross`

## Props model

The DSL can be parameterized from the outside in two ways.

Scalar interpolation:

```yaml
text: "{{title}}"
```

Whole-value substitution:

```yaml
data: { $prop: tasks }
```

That gives you React-like "compile this component with these props" behavior without introducing a second meta-language.

## Runtime binding model

Props are compile-time inputs. Runtime data stays explicit.

A dynamic label:

```yaml
- type: label
  bind: sensor.roll
  field_w: 3
```

A dynamic bar:

```yaml
- type: bar
  bind: battery.pct
  max: 100
```

Bindings are assigned dense numeric IDs in the compiled program.

## CLI

```bash
PYTHONPATH=. python -m gnosis_compiler.cli \
  examples/dashboard.yaml \
  --props examples/dashboard.props.yaml \
  --binary-out out/dashboard.gnbc \
  --asm-out out/dashboard.asm.txt \
  --manifest-out out/dashboard.manifest.json
```

## Python API

```python
from gnosis_compiler import Compiler

compiler = Compiler()
program = compiler.compile("examples/dashboard.yaml", "examples/dashboard.props.yaml")

print(program.code)        # raw bytecode stream
print(program.binds)       # runtime binding names
print(program.regions)     # precomputed dirty-refresh regions
print(program.binary)      # serialized GNBC binary
```

## Project layout

- `gnosis_compiler/dsl.py` — loading, prop substitution, normalization
- `gnosis_compiler/passes.py` — middle-end AST passes
- `gnosis_compiler/layout.py` — compile-time layout
- `gnosis_compiler/lower.py` — bytecode lowering and region analysis
- `gnosis_compiler/disasm.py` — text disassembly
- `gnosis_compiler/serialize.py` — `GNBC` binary writer
- `tests/` — smoke tests
- `examples/` — example screens and props
- `out/` — generated example artifacts

## Start here

Read `COMPILER_GUIDE.md` first. It explains the design from first principles, the compiler theory behind each stage, and the reading list for going deeper.
