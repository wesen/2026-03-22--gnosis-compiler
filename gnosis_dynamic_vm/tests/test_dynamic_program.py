from __future__ import annotations

from pathlib import Path
import unittest

from gnosis_dynamic import Compiler, Program, VM


ROOT = Path(__file__).resolve().parents[1]


class DynamicProgramTests(unittest.TestCase):
    def setUp(self) -> None:
        self.compiler = Compiler()
        self.vm = VM()

    def test_same_program_reflows_title_at_runtime(self) -> None:
        result = self.compiler.compile(ROOT / "examples" / "dynamic_hbox.yaml")
        program = result.program

        short = self.vm.evaluate(program, {"props": {"title": "T"}, "sensor": {"temp": "72", "rpm": 3500}})
        long = self.vm.evaluate(program, {"props": {"title": "Temperature"}, "sensor": {"temp": "72", "rpm": 3500}})

        short_ops = [op for op in short.draw_ops if op["type"] == "text"]
        long_ops = [op for op in long.draw_ops if op["type"] == "text"]

        # The same compiled program is reused, but x positions update at runtime.
        self.assertEqual(program.to_bytes(), result.program.to_bytes())
        self.assertEqual(short_ops[0]["text"], "T")
        self.assertEqual(long_ops[0]["text"], "Temperature")
        self.assertLess(short_ops[1]["x"], long_ops[1]["x"])
        self.assertLess(short_ops[2]["x"], long_ops[2]["x"])
        self.assertEqual(short_ops[2]["w"], 32)  # field_w keeps value slot fixed.
        self.assertEqual(long_ops[2]["w"], 32)

    def test_constant_folding_removes_measure_for_fixed_field(self) -> None:
        result = self.compiler.compile(ROOT / "examples" / "dynamic_hbox.yaml")
        disasm = result.disasm
        # props.title is intrinsic and measured at runtime; sensor.temp is fixed field and is not.
        self.assertIn("MEASURE_TEXT_BIND  n3 bind[0]", disasm)
        self.assertEqual(disasm.count("MEASURE_TEXT_BIND"), 1)
        self.assertIn("PUSH_CONST         28", disasm)

    def test_vbox_shrink_wrap_bubbles_dynamic_width_up(self) -> None:
        result = self.compiler.compile(ROOT / "examples" / "vbox_shrink_wrap.yaml")
        program = result.program
        short = self.vm.evaluate(program, {"props": {"title": "A"}})
        long = self.vm.evaluate(program, {"props": {"title": "Telemetry"}})
        # Parent width is bubbled up, then inlined back into live child widths by DCE.
        self.assertEqual(short.slots["n3.w"], 16)
        self.assertEqual(short.slots["n4.w"], 16)
        self.assertEqual(long.slots["n3.w"], 72)
        self.assertEqual(long.slots["n4.w"], 72)

    def test_program_roundtrip(self) -> None:
        result = self.compiler.compile(ROOT / "examples" / "dynamic_hbox.yaml")
        blob = result.program.to_bytes()
        program = Program.from_bytes(blob)
        eval_result = self.vm.evaluate(program, {"props": {"title": "Mode"}, "sensor": {"temp": "9", "rpm": 1000}})
        self.assertTrue(any(op["type"] == "bar" for op in eval_result.draw_ops))
        self.assertTrue(any(op["text"] == "Mode" for op in eval_result.draw_ops if op["type"] == "text"))


if __name__ == "__main__":
    unittest.main()
