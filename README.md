# GNOSIS Dynamic VM Workbench

This repository now focuses exclusively on the GNOSIS dynamic layout VM and the React workbench used to inspect it.

The old static compiler and GNBC pipeline have been removed. The only supported compiler flow is the dynamic compiler in `gnosis_dynamic_vm/`, which emits `GNDY` bytecode and is evaluated in three runtime phases:

1. measure dynamic intrinsic values,
2. compute residual geometry into slots,
3. render draw operations from those final slots.

## Repository layout

- `gnosis_dynamic_vm/` — authoritative dynamic compiler, VM, examples, and tests
- `web/` — React workbench frontend
- `web_server.py` — Flask server exposing the dynamic compile and preset API
- `ttmp/` — ticketed design and implementation documentation

## Run the workbench

```bash
python web_server.py --debug
```

Then open `http://127.0.0.1:8080`.

## Dynamic compiler quickstart

```python
from pathlib import Path
import sys

sys.path.insert(0, "gnosis_dynamic_vm")

from gnosis_dynamic import Compiler, VM

compiler = Compiler()
result = compiler.compile(Path("gnosis_dynamic_vm/examples/dynamic_hbox.yaml"))
program = result.program

vm = VM()
evaluation = vm.evaluate(program, {
    "props": {"title": "Temperature"},
    "sensor": {"temp": "72", "rpm": 3500},
})

print(result.disasm)
print(evaluation.draw_ops)
```

## Current product direction

- dynamic VM only
- no static-mode API
- no static-mode React shell
- no backward compatibility for the removed static compiler path

For debugger planning and implementation guidance, start with the GNOSIS-005 ticket in `ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/`.
