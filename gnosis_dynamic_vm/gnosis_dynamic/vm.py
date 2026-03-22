from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .bytecode import Op, Program
from .compiler import FIELDS, FIELD_INDEX, GLYPH_H, GLYPH_W, clamp_u16, read_u16


@dataclass
class EvalResult:
    slots: Dict[str, int]
    draw_ops: List[Dict[str, Any]]


class VM:
    def __init__(self, *, glyph_w: int = GLYPH_W, glyph_h: int = GLYPH_H) -> None:
        self.glyph_w = glyph_w
        self.glyph_h = glyph_h

    def evaluate(self, program: Program, runtime: Dict[str, Any]) -> EvalResult:
        slots = list(program.slot_init)
        stack: List[int] = []
        draw_ops: List[Dict[str, Any]] = []
        code = memoryview(program.code)
        pc = 0

        while pc < len(code):
            op = code[pc]
            pc += 1
            if op == Op.MEASURE_TEXT_BIND:
                node = read_u16(code, pc); pc += 2
                bind = read_u16(code, pc); pc += 2
                size = int(code[pc]); pc += 1
                value = resolve_bind(runtime, program.binds[bind])
                text = "" if value is None else str(value)
                slots[slot_id(node, "mw")] = clamp_u16(len(text) * self.glyph_w * size)
                slots[slot_id(node, "mh")] = clamp_u16(self.glyph_h * size)
            elif op == Op.PUSH_CONST:
                value = read_u16(code, pc); pc += 2
                stack.append(value)
            elif op == Op.PUSH_SLOT:
                slot = read_u16(code, pc); pc += 2
                stack.append(slots[slot])
            elif op == Op.ADD:
                rhs = stack.pop(); lhs = stack.pop(); stack.append(lhs + rhs)
            elif op == Op.SUB:
                rhs = stack.pop(); lhs = stack.pop(); stack.append(lhs - rhs)
            elif op == Op.MUL:
                rhs = stack.pop(); lhs = stack.pop(); stack.append(lhs * rhs)
            elif op == Op.DIV:
                rhs = stack.pop(); lhs = stack.pop(); stack.append(0 if rhs == 0 else lhs // rhs)
            elif op == Op.MAX:
                rhs = stack.pop(); lhs = stack.pop(); stack.append(max(lhs, rhs))
            elif op == Op.MIN:
                rhs = stack.pop(); lhs = stack.pop(); stack.append(min(lhs, rhs))
            elif op == Op.STORE_SLOT:
                slot = read_u16(code, pc); pc += 2
                value = stack.pop()
                slots[slot] = clamp_u16(value)
            elif op == Op.DRAW_TEXT_CONST:
                node = read_u16(code, pc); pc += 2
                string_id = read_u16(code, pc); pc += 2
                size = int(code[pc]); pc += 1
                color = int(code[pc]); pc += 1
                draw_ops.append(self._draw_text(node, slots, program.strings[string_id], size, color, source="const"))
            elif op == Op.DRAW_TEXT_BIND:
                node = read_u16(code, pc); pc += 2
                bind = read_u16(code, pc); pc += 2
                size = int(code[pc]); pc += 1
                color = int(code[pc]); pc += 1
                value = resolve_bind(runtime, program.binds[bind])
                draw_ops.append(self._draw_text(node, slots, "" if value is None else str(value), size, color, source="bind", bind=program.binds[bind]))
            elif op == Op.DRAW_BAR_BIND:
                node = read_u16(code, pc); pc += 2
                bind = read_u16(code, pc); pc += 2
                max_value = read_u16(code, pc); pc += 2
                track = int(code[pc]); pc += 1
                fill = int(code[pc]); pc += 1
                value = resolve_bind(runtime, program.binds[bind])
                value_i = to_int(value)
                draw_ops.append(self._draw_bar(node, slots, value_i, max_value, track, fill, bind=program.binds[bind]))
            elif op == Op.DRAW_BAR_CONST:
                node = read_u16(code, pc); pc += 2
                value = read_u16(code, pc); pc += 2
                max_value = read_u16(code, pc); pc += 2
                track = int(code[pc]); pc += 1
                fill = int(code[pc]); pc += 1
                draw_ops.append(self._draw_bar(node, slots, value, max_value, track, fill))
            elif op == Op.DRAW_HLINE:
                node = read_u16(code, pc); pc += 2
                color = int(code[pc]); pc += 1
                draw_ops.append({
                    "type": "hline",
                    "node": node,
                    "x": slots[slot_id(node, "x")],
                    "y": slots[slot_id(node, "y")],
                    "w": slots[slot_id(node, "w")],
                    "color": color,
                })
            elif op == Op.DRAW_VLINE:
                node = read_u16(code, pc); pc += 2
                color = int(code[pc]); pc += 1
                draw_ops.append({
                    "type": "vline",
                    "node": node,
                    "x": slots[slot_id(node, "x")],
                    "y": slots[slot_id(node, "y")],
                    "h": slots[slot_id(node, "h")],
                    "color": color,
                })
            elif op == Op.HALT:
                break
            else:
                raise ValueError(f"unknown opcode 0x{op:02x} at pc {pc - 1}")

        named_slots = {slot_name(i): value for i, value in enumerate(slots)}
        return EvalResult(slots=named_slots, draw_ops=draw_ops)

    def _draw_text(self, node: int, slots: List[int], text: str, size: int, color: int, *, source: str, bind: Optional[str] = None) -> Dict[str, Any]:
        return {
            "type": "text",
            "node": node,
            "source": source,
            "bind": bind,
            "text": text,
            "x": slots[slot_id(node, "x")],
            "y": slots[slot_id(node, "y")],
            "w": slots[slot_id(node, "w")],
            "h": slots[slot_id(node, "h")],
            "size": size,
            "color": color,
            "intrinsic_w": len(text) * self.glyph_w * size,
        }

    def _draw_bar(self, node: int, slots: List[int], value: int, max_value: int, track: int, fill: int, *, bind: Optional[str] = None) -> Dict[str, Any]:
        width = slots[slot_id(node, "w")]
        frac = 0.0 if max_value <= 0 else max(0.0, min(float(value) / float(max_value), 1.0))
        fill_w = int(width * frac)
        return {
            "type": "bar",
            "node": node,
            "bind": bind,
            "value": value,
            "max": max_value,
            "x": slots[slot_id(node, "x")],
            "y": slots[slot_id(node, "y")],
            "w": width,
            "h": slots[slot_id(node, "h")],
            "fill_w": fill_w,
            "track": track,
            "fill": fill,
        }


def resolve_bind(runtime: Dict[str, Any], path: str) -> Any:
    current: Any = runtime
    for part in path.split("."):
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return None
    return current


def to_int(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    try:
        return int(str(value).strip())
    except Exception:
        return 0


def slot_id(node: int, field: str) -> int:
    return node * len(FIELDS) + FIELD_INDEX[field]


def slot_name(slot: int) -> str:
    node_id = slot // len(FIELDS)
    field = FIELDS[slot % len(FIELDS)]
    return f"n{node_id}.{field}"
