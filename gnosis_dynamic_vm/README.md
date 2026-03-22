# GNOSIS Dynamic Layout Compiler

This is a clean rewrite of the GNOSIS compiler as a **dynamic layout compiler** rather than a static draw-list generator.

It compiles YAML layout DSL programs into a compact binary bytecode (`.gndy`) that is meant to be evaluated on a microcontroller by a tiny VM.

The VM model is deliberately split:

1. **measure** dynamic intrinsic leaves at runtime
2. **evaluate residual geometry expressions** into slot storage
3. **emit render commands** from the final slots

That gives you one compiled program that can still reflow at runtime when a bound string changes length.

## What is implemented

Supported node types:

- `screen`
- `fixed`
- `hbox`
- `vbox`
- `label`
- `bar`
- `sep`
- `spacer`

Supported dynamic behavior:

- intrinsic runtime labels via `bind: ...`
- fixed-width runtime labels via `field_w: N`
- child-size bubbling through `hbox`, `vbox`, and `fixed`
- compile-time constant folding of static text widths and static geometry
- dead slot elimination so container slots disappear when they are not needed by the render phase

## Design summary

Each node gets six slots:

- `mw`, `mh`: measured/intrinsic width and height
- `x`, `y`, `w`, `h`: final placed rectangle

The compiler computes symbolic expressions for those slots, folds all constant expressions on the host, then emits only the residual runtime work.

So a layout like this:

```yaml
- type: hbox
  gap: 2
  children:
    - type: label
      bind: props.title
    - type: label
      text: ": "
    - type: label
      bind: sensor.temp
      field_w: 4
```

turns into a program where only the title width is measured at runtime. The static `": "` width and the reserved width for `sensor.temp` are folded at compile time.

## Repository layout

- `gnosis_dynamic/`
  - `compiler.py`: YAML → symbolic slot IR → bytecode
  - `expr.py`: constant-folding expression IR
  - `bytecode.py`: binary format and encoder
  - `vm.py`: Python reference VM
- `c_runtime/`
  - `gnosis_vm.h`
  - `gnosis_vm.c`
- `examples/`
  - `dynamic_hbox.yaml`
  - `vbox_shrink_wrap.yaml`
- `out/`
  - compiled examples, disassembly, IR dumps, and evaluation traces
- `tests/`
  - regression tests for dynamic reflow and constant folding

## Quickstart

```python
from pathlib import Path
from gnosis_dynamic import Compiler, VM

compiler = Compiler()
result = compiler.compile(Path("examples/dynamic_hbox.yaml"))
program = result.program

blob = program.to_bytes()           # ship this to the MCU
print(result.disasm)                # inspect residual bytecode

vm = VM()
eval_result = vm.evaluate(
    program,
    {
        "props": {"title": "Temperature"},
        "sensor": {"temp": "72", "rpm": 3500},
    },
)
print(eval_result.draw_ops)
```

Run the tests:

```bash
PYTHONPATH=. python -m unittest discover -s tests -v
```

Regenerate the example artifacts:

```bash
PYTHONPATH=. python tools/build_examples.py
```

## Example: same program, different runtime layout

The compiled `dynamic_hbox.gndy` program is reused unchanged.

With `props.title = "T"`:

- title rect: `x=8, w=8`
- `": "` rect: `x=18, w=16`
- value rect: `x=36, w=32`

With `props.title = "Temperature"`:

- title rect: `x=8, w=88`
- `": "` rect: `x=98, w=16`
- value rect: `x=116, w=32`

The program stays the same. Only the measured slots change.

The corresponding disassembly is in [`out/dynamic_hbox.disasm.txt`](sandbox:/mnt/data/gnosis_dynamic_vm/out/dynamic_hbox.disasm.txt).

## Microcontroller model

The intended MCU runtime is the C interpreter in `c_runtime/`.

It expects:

- a program blob in flash
- a slot buffer in RAM (`node_count * 6` `uint16_t`s)
- host hooks for:
  - resolving bound text values
  - resolving bound numeric values
  - drawing text and bars
  - drawing lines

This keeps the runtime small and pushes all expensive reasoning to the host compiler.

## Current limitations

This is a focused vertical slice, not full GNOSIS parity.

Not implemented yet:

- grids, lists, circles, icons, buttons
- clipping opcodes
- conditionals and visibility-driven layout
- sparse slot initialization in the binary format
- string/bind offset tables for O(1) pool lookup in C
- waveform/dirty-region scheduling

The current compiler is enough to validate the dynamic-layout architecture and the bytecode/VM split.

## Most relevant artifacts

- [Compiler guide](sandbox:/mnt/data/gnosis_dynamic_vm/COMPILER_GUIDE.md)
- [Example binary: dynamic_hbox.gndy](sandbox:/mnt/data/gnosis_dynamic_vm/out/dynamic_hbox.gndy)
- [Example disassembly](sandbox:/mnt/data/gnosis_dynamic_vm/out/dynamic_hbox.disasm.txt)
- [Example evaluation, short title](sandbox:/mnt/data/gnosis_dynamic_vm/out/dynamic_hbox.short.eval.json)
- [Example evaluation, long title](sandbox:/mnt/data/gnosis_dynamic_vm/out/dynamic_hbox.long.eval.json)
