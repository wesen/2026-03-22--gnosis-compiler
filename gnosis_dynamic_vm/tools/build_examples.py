from __future__ import annotations

import json
from pathlib import Path

from gnosis_dynamic import Compiler, VM


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
OUT.mkdir(exist_ok=True)


def write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, indent=2, sort_keys=True))


def main() -> None:
    compiler = Compiler()
    vm = VM()

    examples = [
        {
            "name": "dynamic_hbox",
            "dsl": ROOT / "examples" / "dynamic_hbox.yaml",
            "contexts": {
                "short": {"props": {"title": "T"}, "sensor": {"temp": "72", "rpm": 3500}},
                "long": {"props": {"title": "Temperature"}, "sensor": {"temp": "72", "rpm": 3500}},
            },
        },
        {
            "name": "vbox_shrink_wrap",
            "dsl": ROOT / "examples" / "vbox_shrink_wrap.yaml",
            "contexts": {
                "short": {"props": {"title": "A"}},
                "long": {"props": {"title": "Telemetry"}},
            },
        },
    ]

    for item in examples:
        result = compiler.compile(item["dsl"])
        program_path = OUT / f"{item['name']}.gndy"
        program_path.write_bytes(result.program.to_bytes())
        (OUT / f"{item['name']}.disasm.txt").write_text(result.disasm)
        (OUT / f"{item['name']}.ir.txt").write_text(result.ir_dump)
        write_json(OUT / f"{item['name']}.manifest.json", result.program.manifest)
        for case_name, runtime in item["contexts"].items():
            eval_result = vm.evaluate(result.program, runtime)
            write_json(
                OUT / f"{item['name']}.{case_name}.eval.json",
                {"runtime": runtime, "slots": eval_result.slots, "draw_ops": eval_result.draw_ops},
            )


if __name__ == "__main__":
    main()
