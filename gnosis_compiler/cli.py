from __future__ import annotations

import argparse
import json
from pathlib import Path

from .compiler import Compiler, CompileOptions
from .disasm import disassemble_code
from .dsl import load_source



def main() -> int:
    parser = argparse.ArgumentParser(description='Compile GNOSIS layout DSL into bytecode.')
    parser.add_argument('source', help='Path to a YAML or JSON screen file')
    parser.add_argument('--props', help='Path to YAML or JSON props file')
    parser.add_argument('--width', type=int, default=400)
    parser.add_argument('--height', type=int, default=300)
    parser.add_argument('--binary-out', help='Where to write the GNBC binary')
    parser.add_argument('--asm-out', help='Where to write disassembly')
    parser.add_argument('--manifest-out', help='Where to write JSON manifest')
    args = parser.parse_args()

    props = load_source(args.props) if args.props else None
    compiler = Compiler(CompileOptions(width=args.width, height=args.height))
    program = compiler.compile(args.source, props)

    if args.binary_out:
        Path(args.binary_out).write_bytes(program.binary or b'')
    if args.asm_out:
        Path(args.asm_out).write_text(disassemble_code(program.code, program.strings, program.binds), encoding='utf-8')
    if args.manifest_out:
        Path(args.manifest_out).write_text(json.dumps(program.to_manifest(), indent=2), encoding='utf-8')

    print(json.dumps(program.to_manifest(), indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
