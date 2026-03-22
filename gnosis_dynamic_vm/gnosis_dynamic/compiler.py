from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import yaml

from .bytecode import CodeBuilder, Op, Program
from .expr import BinOp, Const, Expr, SlotRef, add, div, max_expr, max_many, mul, sub, sum_expr

GLYPH_W = 8
GLYPH_H = 8

COLORS = {"bg": 0, "fg": 1, "mid": 2, "light": 3, "ghost": 4}
FIELDS = ["mw", "mh", "x", "y", "w", "h"]
FIELD_INDEX = {name: idx for idx, name in enumerate(FIELDS)}


@dataclass
class Node:
    node_id: int
    type: str
    raw: Dict[str, Any]
    path: str
    children: List["Node"] = field(default_factory=list)

    @property
    def x(self) -> Optional[int]:
        return maybe_int(self.raw.get("x"))

    @property
    def y(self) -> Optional[int]:
        return maybe_int(self.raw.get("y"))

    @property
    def w(self) -> Optional[int]:
        value = self.raw.get("w", self.raw.get("width"))
        return maybe_int(value)

    @property
    def h(self) -> Optional[int]:
        value = self.raw.get("h", self.raw.get("height"))
        return maybe_int(value)

    @property
    def gap(self) -> int:
        return maybe_int(self.raw.get("gap")) or 0

    @property
    def grow(self) -> int:
        if self.type == "spacer" and self.raw.get("grow") is None:
            return 1
        return maybe_int(self.raw.get("grow")) or 0

    @property
    def size(self) -> int:
        return maybe_int(self.raw.get("size")) or 1

    @property
    def color(self) -> int:
        value = self.raw.get("color", "fg")
        if isinstance(value, int):
            return value
        return COLORS.get(str(value), COLORS["fg"])

    @property
    def text(self) -> str:
        return str(self.raw.get("text", self.raw.get("content", self.raw.get("label", ""))))

    @property
    def bind(self) -> Optional[str]:
        value = self.raw.get("bind")
        return None if value is None else str(value)

    @property
    def field_w(self) -> Optional[int]:
        value = self.raw.get("field_w")
        return maybe_int(value)

    @property
    def max_value(self) -> int:
        return maybe_int(self.raw.get("max")) or 100

    @property
    def track(self) -> int:
        value = self.raw.get("track", "light")
        return COLORS.get(str(value), COLORS["light"])

    @property
    def fill(self) -> int:
        value = self.raw.get("fill", "fg")
        return COLORS.get(str(value), COLORS["fg"])

    @property
    def explicit_main(self) -> Optional[int]:
        if self.type in {"hbox", "fixed", "label", "bar", "sep", "spacer"}:
            return self.w
        if self.type in {"vbox"}:
            return self.h
        return None

    def slot(self, field_name: str) -> int:
        return self.node_id * len(FIELDS) + FIELD_INDEX[field_name]

    def slot_name(self, field_name: str) -> str:
        return f"n{self.node_id}.{field_name}"


@dataclass
class CompileResult:
    program: Program
    slot_exprs: Dict[int, str]
    slot_init_names: Dict[str, int]
    disasm: str
    ir_dump: str


class Compiler:
    def __init__(self, *, glyph_w: int = GLYPH_W, glyph_h: int = GLYPH_H) -> None:
        self.glyph_w = glyph_w
        self.glyph_h = glyph_h
        self.nodes: List[Node] = []
        self.bind_ids: Dict[str, int] = {}
        self.strings: Dict[str, int] = {}
        self.slot_exprs: Dict[int, Expr] = {}
        self.measure_ops: List[tuple[int, int, int]] = []
        self.render_ops: List[tuple[str, tuple[Any, ...]]] = []
        self.measure_memo: Dict[int, tuple[Expr, Expr]] = {}

    def compile(self, source: str | Path | Dict[str, Any], *, static_props: Optional[Dict[str, Any]] = None) -> CompileResult:
        raw = load_source(source)
        if static_props:
            raw = substitute_static_props(raw, static_props)

        self.nodes = []
        self.bind_ids = {}
        self.strings = {}
        self.slot_exprs = {}
        self.measure_ops = []
        self.render_ops = []
        self.measure_memo = {}

        root = self._normalize_root(raw)
        assert root.type == "screen", "normalized root must be a screen"

        for node in self.nodes:
            self._compute_measures(node)
        self._compile_screen_layout(root)
        self._compile_render(root)

        slot_count = len(self.nodes) * len(FIELDS)
        slot_init = [0] * slot_count
        all_dynamic_exprs: Dict[int, Expr] = {}
        slot_expr_strings: Dict[int, str] = {}
        slot_init_names: Dict[str, int] = {}

        measured_slots = {slot for op in self.measure_ops for slot in (self._slot(op[0], "mw"), self._slot(op[0], "mh"))}

        for slot_id, expr in sorted(self.slot_exprs.items()):
            simplified = expr.simplify()
            slot_expr_strings[slot_id] = str(simplified)
            if not (slot_id in measured_slots and simplified == SlotRef(slot_id)) and not isinstance(simplified, Const):
                all_dynamic_exprs[slot_id] = simplified

        live_slots = compute_live_slots(self.render_ops, all_dynamic_exprs)
        dynamic_exprs = {slot_id: expr for slot_id, expr in all_dynamic_exprs.items() if slot_id in live_slots}

        for slot_id, expr in sorted(self.slot_exprs.items()):
            if slot_id not in live_slots:
                continue
            simplified = expr.simplify()
            if isinstance(simplified, Const):
                slot_init[slot_id] = clamp_u16(simplified.value)
                slot_init_names[self.slot_name(slot_id)] = clamp_u16(simplified.value)

        live_measure_nodes = {
            op[0] for op in self.measure_ops
            if self._slot(op[0], "mw") in live_slots or self._slot(op[0], "mh") in live_slots
        }

        topo = topo_sort_slots(dynamic_exprs)
        cb = CodeBuilder()
        for node_id, bind_id, size in self.measure_ops:
            if node_id in live_measure_nodes:
                cb.emit_measure_text_bind(node_id, bind_id, size)
        for slot_id in topo:
            emit_expr(cb, dynamic_exprs[slot_id])
            cb.emit_store_slot(slot_id)
        for kind, operands in self.render_ops:
            if kind == "draw_text_const":
                cb.emit_draw_text_const(*operands)
            elif kind == "draw_text_bind":
                cb.emit_draw_text_bind(*operands)
            elif kind == "draw_bar_bind":
                cb.emit_draw_bar_bind(*operands)
            elif kind == "draw_bar_const":
                cb.emit_draw_bar_const(*operands)
            elif kind == "draw_hline":
                cb.emit_draw_hline(*operands)
            elif kind == "draw_vline":
                cb.emit_draw_vline(*operands)
            else:
                raise ValueError(f"unknown render op {kind}")
        cb.emit_halt()
        code = cb.build()

        manifest = {
            "version": 1,
            "glyph_w": self.glyph_w,
            "glyph_h": self.glyph_h,
            "binds": [name for name, _ in sorted(self.bind_ids.items(), key=lambda kv: kv[1])],
            "strings": [text for text, _ in sorted(self.strings.items(), key=lambda kv: kv[1])],
            "nodes": [
                {
                    "id": node.node_id,
                    "type": node.type,
                    "path": node.path,
                    "bind": node.bind,
                    "text": node.text if node.type == "label" else None,
                }
                for node in self.nodes
            ],
            "dynamic_slot_count": len(dynamic_exprs),
            "measure_op_count": len(self.measure_ops),
            "render_op_count": len(self.render_ops),
        }

        program = Program(
            node_count=len(self.nodes),
            slot_init=slot_init,
            binds=manifest["binds"],
            strings=manifest["strings"],
            code=code,
            manifest=manifest,
        )

        disasm = disassemble_program(program)
        ir_dump = self._dump_ir(slot_expr_strings)
        return CompileResult(
            program=program,
            slot_exprs={self.slot_name(k): v for k, v in slot_expr_strings.items()},
            slot_init_names=slot_init_names,
            disasm=disasm,
            ir_dump=ir_dump,
        )

    def _normalize_root(self, raw: Dict[str, Any]) -> Node:
        if raw.get("type") == "screen":
            return self._make_node("screen", raw, "root")
        if raw.get("width") is None and raw.get("w") is None:
            raise ValueError("root program must provide width or w")
        if raw.get("height") is None and raw.get("h") is None:
            raise ValueError("root program must provide height or h")
        wrapped = {
            "type": "screen",
            "width": raw.get("width", raw.get("w")),
            "height": raw.get("height", raw.get("h")),
            "body": raw,
        }
        return self._make_node("screen", wrapped, "root")

    def _make_node(self, node_type: str, raw: Dict[str, Any], path: str) -> Node:
        node = Node(node_id=len(self.nodes), type=node_type, raw=raw, path=path)
        self.nodes.append(node)

        children_specs: List[tuple[str, Dict[str, Any]]] = []
        if node_type == "screen":
            if raw.get("bar") is not None:
                children_specs.append(("bar", dict(raw["bar"])))
            if raw.get("body") is not None:
                children_specs.append(("body", dict(raw["body"])))
            for idx, child in enumerate(listify(raw.get("children") or raw.get("items") or [])):
                children_specs.append((f"child{idx}", dict(child)))
            if raw.get("nav") is not None:
                children_specs.append(("nav", dict(raw["nav"])))
        else:
            for idx, child in enumerate(listify(raw.get("children") or raw.get("items") or [])):
                child_dict = dict(child)
                child_type = normalize_type(child_dict)
                child_node = self._make_node(child_type, child_dict, f"{path}/{child_type}[{idx}]")
                node.children.append(child_node)

        if node_type == "screen":
            for label, child_raw in children_specs:
                child_type = normalize_type(child_raw)
                child_node = self._make_node(child_type, child_raw, f"{path}/{label}:{child_type}")
                node.children.append(child_node)
        return node

    def _compute_measures(self, node: Node) -> tuple[Expr, Expr]:
        if node.node_id in self.measure_memo:
            return self.measure_memo[node.node_id]

        mw_slot = SlotRef(node.slot("mw"))
        mh_slot = SlotRef(node.slot("mh"))

        if node.type == "screen":
            width = maybe_int(node.raw.get("width", node.raw.get("w")))
            height = maybe_int(node.raw.get("height", node.raw.get("h")))
            if width is None or height is None:
                raise ValueError("screen needs explicit width and height")
            mw, mh = Const(width), Const(height)

        elif node.type == "label":
            size = node.size
            if node.bind:
                if node.field_w is not None:
                    mw = Const(node.field_w * self.glyph_w * size)
                    mh = Const(self.glyph_h * size)
                else:
                    bind_id = self.bind_id(node.bind)
                    self.measure_ops.append((node.node_id, bind_id, size))
                    mw, mh = mw_slot, Const(self.glyph_h * size)
            else:
                mw = Const(len(node.text) * self.glyph_w * size)
                mh = Const(self.glyph_h * size)

        elif node.type == "bar":
            mw = Const(node.w if node.w is not None else 40)
            mh = Const(node.h if node.h is not None else 4)

        elif node.type == "sep":
            mw = Const(node.w if node.w is not None else 0)
            mh = Const(node.h if node.h is not None else 1)

        elif node.type == "spacer":
            mw = Const(node.w if node.w is not None else 0)
            mh = Const(node.h if node.h is not None else 0)

        elif node.type == "fixed":
            child_sizes = [self._compute_measures(child) for child in node.children]
            max_w_terms = []
            max_h_terms = []
            for child, (child_mw, child_mh) in zip(node.children, child_sizes):
                cw = Const(child.w) if child.w is not None else child_mw
                ch = Const(child.h) if child.h is not None else child_mh
                max_w_terms.append(add(Const(child.x or 0), cw))
                max_h_terms.append(add(Const(child.y or 0), ch))
            mw = Const(node.w) if node.w is not None else max_many(max_w_terms, default=0)
            mh = Const(node.h) if node.h is not None else max_many(max_h_terms, default=0)

        elif node.type == "hbox":
            child_sizes = [self._compute_measures(child) for child in node.children]
            bases = [Const(child.w) if child.w is not None else child_mw for child, (child_mw, _) in zip(node.children, child_sizes)]
            heights = [Const(child.h) if child.h is not None else child_mh for child, (_, child_mh) in zip(node.children, child_sizes)]
            gaps = Const(max(len(node.children) - 1, 0) * node.gap)
            mw = Const(node.w) if node.w is not None else add(sum_expr(bases), gaps)
            mh = Const(node.h) if node.h is not None else max_many(heights, default=0)

        elif node.type == "vbox":
            child_sizes = [self._compute_measures(child) for child in node.children]
            widths = [Const(child.w) if child.w is not None else child_mw for child, (child_mw, _) in zip(node.children, child_sizes)]
            bases = [Const(child.h) if child.h is not None else child_mh for child, (_, child_mh) in zip(node.children, child_sizes)]
            gaps = Const(max(len(node.children) - 1, 0) * node.gap)
            mw = Const(node.w) if node.w is not None else max_many(widths, default=0)
            mh = Const(node.h) if node.h is not None else add(sum_expr(bases), gaps)

        else:
            raise ValueError(f"unsupported node type: {node.type}")

        self.slot_exprs[node.slot("mw")] = mw.simplify()
        self.slot_exprs[node.slot("mh")] = mh.simplify()
        self.measure_memo[node.node_id] = (mw.simplify(), mh.simplify())
        return self.measure_memo[node.node_id]

    def _compile_screen_layout(self, root: Node) -> None:
        width = maybe_int(root.raw.get("width", root.raw.get("w")))
        height = maybe_int(root.raw.get("height", root.raw.get("h")))
        assert width is not None and height is not None
        self._assign_rect(root, Const(0), Const(0), Const(width), Const(height))

        children_by_role = {child.path.split(":")[-2].split("/")[-1] if ":" in child.path else None: child for child in root.children}
        # More robust role resolution.
        bar = next((c for c in root.children if "/bar:" in c.path), None)
        body = next((c for c in root.children if "/body:" in c.path), None)
        nav = next((c for c in root.children if "/nav:" in c.path), None)
        special_children = [child for child in (bar, body, nav) if child is not None]
        loose_children = [c for c in root.children if all(c is not special for special in special_children)]

        if bar or body or nav:
            bar_h = Const(bar.h if (bar and bar.h is not None) else 0)
            nav_h = Const(nav.h if (nav and nav.h is not None) else 0)
            body_h = sub(Const(height), add(bar_h, nav_h))
            if bar:
                self._compile_layout(bar, Const(0), Const(0), Const(width), bar_h)
            if body:
                self._compile_layout(body, Const(0), bar_h, Const(width), body_h)
            if nav:
                self._compile_layout(nav, Const(0), add(bar_h, body_h), Const(width), nav_h)
            for child in loose_children:
                self._compile_layout(child, SlotRef(root.slot("x")), SlotRef(root.slot("y")), SlotRef(root.slot("w")), SlotRef(root.slot("h")))
        else:
            for child in root.children:
                self._compile_layout(child, Const(0), Const(0), Const(width), Const(height))

    def _compile_layout(self, node: Node, x: Expr, y: Expr, w: Expr, h: Expr) -> None:
        self._assign_rect(node, x, y, w, h)
        if node.type == "fixed":
            for child in node.children:
                child_x = add(x, Const(child.x or 0))
                child_y = add(y, Const(child.y or 0))
                child_w = Const(child.w) if child.w is not None else self._measure_ref(child, "mw")
                child_h = Const(child.h) if child.h is not None else self._measure_ref(child, "mh")
                self._compile_layout(child, child_x, child_y, child_w, child_h)
            return

        if node.type == "hbox":
            gap = node.gap
            base_widths = [Const(child.w) if child.w is not None else self._measure_ref(child, "mw") for child in node.children]
            grow_sum = sum(child.grow for child in node.children)
            base_total = add(sum_expr(base_widths), Const(max(len(node.children) - 1, 0) * gap))
            extra = max_expr(sub(w, base_total), Const(0)) if grow_sum > 0 else Const(0)
            cursor = x
            for idx, child in enumerate(node.children):
                child_base_w = base_widths[idx]
                if child.grow > 0 and grow_sum > 0:
                    child_w = add(child_base_w, div(mul(extra, Const(child.grow)), Const(grow_sum)))
                else:
                    child_w = child_base_w
                child_h = Const(child.h) if child.h is not None else h
                self._compile_layout(child, cursor, y, child_w, child_h)
                cursor = add(cursor, child_w)
                if idx + 1 < len(node.children):
                    cursor = add(cursor, Const(gap))
            return

        if node.type == "vbox":
            gap = node.gap
            base_heights = [Const(child.h) if child.h is not None else self._measure_ref(child, "mh") for child in node.children]
            grow_sum = sum(child.grow for child in node.children)
            base_total = add(sum_expr(base_heights), Const(max(len(node.children) - 1, 0) * gap))
            extra = max_expr(sub(h, base_total), Const(0)) if grow_sum > 0 else Const(0)
            cursor = y
            for idx, child in enumerate(node.children):
                child_base_h = base_heights[idx]
                if child.grow > 0 and grow_sum > 0:
                    child_h = add(child_base_h, div(mul(extra, Const(child.grow)), Const(grow_sum)))
                else:
                    child_h = child_base_h
                child_w = Const(child.w) if child.w is not None else w
                self._compile_layout(child, x, cursor, child_w, child_h)
                cursor = add(cursor, child_h)
                if idx + 1 < len(node.children):
                    cursor = add(cursor, Const(gap))
            return

        # Leaf nodes require no descendant layout.
        return

    def _assign_rect(self, node: Node, x: Expr, y: Expr, w: Expr, h: Expr) -> None:
        self.slot_exprs[node.slot("x")] = x.simplify()
        self.slot_exprs[node.slot("y")] = y.simplify()
        self.slot_exprs[node.slot("w")] = w.simplify()
        self.slot_exprs[node.slot("h")] = h.simplify()

    def _measure_ref(self, node: Node, field: str) -> Expr:
        value = self.measure_memo.get(node.node_id)
        if value is None:
            value = self._compute_measures(node)
        return value[0] if field == "mw" else value[1]

    def _compile_render(self, node: Node) -> None:
        if node.type == "label":
            if node.bind:
                self.render_ops.append(("draw_text_bind", (node.node_id, self.bind_id(node.bind), node.size, node.color)))
            else:
                self.render_ops.append(("draw_text_const", (node.node_id, self.string_id(node.text), node.size, node.color)))
        elif node.type == "bar":
            if node.bind:
                self.render_ops.append(("draw_bar_bind", (node.node_id, self.bind_id(node.bind), node.max_value, node.track, node.fill)))
            else:
                self.render_ops.append(("draw_bar_const", (node.node_id, maybe_int(node.raw.get("value")) or 0, node.max_value, node.track, node.fill)))
        elif node.type == "sep":
            self.render_ops.append(("draw_hline", (node.node_id, node.color)))

        for child in node.children:
            self._compile_render(child)

    def bind_id(self, name: str) -> int:
        if name not in self.bind_ids:
            self.bind_ids[name] = len(self.bind_ids)
        return self.bind_ids[name]

    def string_id(self, text: str) -> int:
        if text not in self.strings:
            self.strings[text] = len(self.strings)
        return self.strings[text]

    def slot_name(self, slot_id: int) -> str:
        node_id = slot_id // len(FIELDS)
        field = FIELDS[slot_id % len(FIELDS)]
        return f"n{node_id}.{field}"

    def _slot(self, node_id: int, field_name: str) -> int:
        return node_id * len(FIELDS) + FIELD_INDEX[field_name]

    def _dump_ir(self, slot_expr_strings: Dict[int, str]) -> str:
        lines = []
        lines.append("# Symbolic slot IR")
        lines.append("")
        for node in self.nodes:
            lines.append(f"node n{node.node_id}: type={node.type} path={node.path}")
            for field in FIELDS:
                slot_id = node.slot(field)
                expr = slot_expr_strings.get(slot_id, "<unset>")
                lines.append(f"  {field:>2} = {expr}")
            lines.append("")
        return "\n".join(lines)


def load_source(source: str | Path | Dict[str, Any]) -> Dict[str, Any]:
    if isinstance(source, dict):
        return source
    if isinstance(source, Path):
        return yaml.safe_load(source.read_text())
    source = str(source)
    path = Path(source)
    if path.exists():
        return yaml.safe_load(path.read_text())
    return yaml.safe_load(source)


def listify(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def maybe_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str) and value.strip() != "":
        try:
            return int(value)
        except ValueError:
            return None
    return None


def clamp_u16(value: int) -> int:
    return max(0, min(int(value), 65535))


def normalize_type(raw: Dict[str, Any]) -> str:
    if raw.get("spacer"):
        return "spacer"
    if raw.get("type"):
        return str(raw["type"])
    if raw.get("layout"):
        return str(raw["layout"])
    if raw.get("bind") or raw.get("text") or raw.get("label") or raw.get("content"):
        return "label"
    if raw.get("children") or raw.get("items"):
        return "fixed"
    raise ValueError(f"unable to infer node type for {raw!r}")


_TOKEN_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}")


def substitute_static_props(value: Any, props: Dict[str, Any]) -> Any:
    if isinstance(value, dict):
        return {k: substitute_static_props(v, props) for k, v in value.items()}
    if isinstance(value, list):
        return [substitute_static_props(v, props) for v in value]
    if isinstance(value, str):
        def repl(match: re.Match[str]) -> str:
            key = match.group(1)
            current: Any = props
            for part in key.split("."):
                if not isinstance(current, dict) or part not in current:
                    return match.group(0)
                current = current[part]
            return str(current)
        return _TOKEN_RE.sub(repl, value)
    return value


def emit_expr(cb: CodeBuilder, expr: Expr) -> None:
    expr = expr.simplify()
    if isinstance(expr, Const):
        cb.emit_push_const(clamp_u16(expr.value))
        return
    if isinstance(expr, SlotRef):
        cb.emit_push_slot(expr.slot)
        return
    if isinstance(expr, BinOp):
        emit_expr(cb, expr.left)
        emit_expr(cb, expr.right)
        if expr.op == "+":
            cb.emit_stack_op(Op.ADD)
        elif expr.op == "-":
            cb.emit_stack_op(Op.SUB)
        elif expr.op == "*":
            cb.emit_stack_op(Op.MUL)
        elif expr.op == "/":
            cb.emit_stack_op(Op.DIV)
        elif expr.op == "max":
            cb.emit_stack_op(Op.MAX)
        elif expr.op == "min":
            cb.emit_stack_op(Op.MIN)
        else:
            raise ValueError(f"unknown binary op {expr.op}")
        return
    raise TypeError(f"unsupported expression type {type(expr)!r}")


def topo_sort_slots(dynamic_exprs: Dict[int, Expr]) -> List[int]:
    order: List[int] = []
    visiting: set[int] = set()
    visited: set[int] = set()

    def visit(slot_id: int) -> None:
        if slot_id in visited:
            return
        if slot_id in visiting:
            raise ValueError(f"cyclic slot dependency at slot {slot_id}")
        visiting.add(slot_id)
        expr = dynamic_exprs[slot_id]
        for dep in sorted(expr.deps()):
            if dep in dynamic_exprs:
                visit(dep)
        visiting.remove(slot_id)
        visited.add(slot_id)
        order.append(slot_id)

    for slot_id in sorted(dynamic_exprs):
        visit(slot_id)
    return order


def compute_live_slots(render_ops: List[tuple[str, tuple[Any, ...]]], dynamic_exprs: Dict[int, Expr]) -> set[int]:
    live: set[int] = set()

    def mark_node_rect(node_id: int) -> None:
        for field in ("x", "y", "w", "h"):
            live.add(node_id * len(FIELDS) + FIELD_INDEX[field])

    for kind, operands in render_ops:
        if kind in {"draw_text_const", "draw_text_bind", "draw_bar_bind", "draw_bar_const", "draw_hline", "draw_vline"}:
            mark_node_rect(int(operands[0]))

    changed = True
    while changed:
        changed = False
        deps_to_add: set[int] = set()
        for slot_id in list(live):
            expr = dynamic_exprs.get(slot_id)
            if expr is None:
                continue
            deps_to_add |= expr.deps()
        new = deps_to_add - live
        if new:
            live |= new
            changed = True
    return live


def disassemble_program(program: Program) -> str:
    lines = []
    lines.append("# GNDY disassembly")
    lines.append(f"nodes: {program.node_count}")
    lines.append(f"binds: {len(program.binds)}")
    lines.append(f"strings: {len(program.strings)}")
    lines.append("")
    if program.binds:
        lines.append("# Bind table")
        for idx, bind in enumerate(program.binds):
            lines.append(f"  [{idx}] {bind}")
        lines.append("")
    if program.strings:
        lines.append("# String pool")
        for idx, string in enumerate(program.strings):
            lines.append(f"  [{idx}] {string!r}")
        lines.append("")
    lines.append("# Slot init (non-zero only)")
    for slot_id, value in enumerate(program.slot_init):
        if value != 0:
            lines.append(f"  {slot_name(slot_id)} = {value}")
    lines.append("")
    lines.append("# Code")
    code = memoryview(program.code)
    pc = 0
    while pc < len(code):
        op = code[pc]
        start = pc
        pc += 1
        opname = Op(op).name if op in Op._value2member_map_ else f"0x{op:02x}"
        if op == Op.MEASURE_TEXT_BIND:
            node = read_u16(code, pc); pc += 2
            bind = read_u16(code, pc); pc += 2
            size = int(code[pc]); pc += 1
            lines.append(f"{start:04x}: {opname:<18} n{node} bind[{bind}] size={size}")
        elif op == Op.PUSH_CONST:
            value = read_u16(code, pc); pc += 2
            lines.append(f"{start:04x}: {opname:<18} {value}")
        elif op == Op.PUSH_SLOT:
            slot = read_u16(code, pc); pc += 2
            lines.append(f"{start:04x}: {opname:<18} {slot_name(slot)}")
        elif op in {Op.ADD, Op.SUB, Op.MUL, Op.DIV, Op.MAX, Op.MIN}:
            lines.append(f"{start:04x}: {opname}")
        elif op == Op.STORE_SLOT:
            slot = read_u16(code, pc); pc += 2
            lines.append(f"{start:04x}: {opname:<18} {slot_name(slot)}")
        elif op == Op.DRAW_TEXT_CONST:
            node = read_u16(code, pc); pc += 2
            string_id = read_u16(code, pc); pc += 2
            size = int(code[pc]); pc += 1
            color = int(code[pc]); pc += 1
            lines.append(f"{start:04x}: {opname:<18} n{node} string[{string_id}] size={size} color={color}")
        elif op == Op.DRAW_TEXT_BIND:
            node = read_u16(code, pc); pc += 2
            bind = read_u16(code, pc); pc += 2
            size = int(code[pc]); pc += 1
            color = int(code[pc]); pc += 1
            lines.append(f"{start:04x}: {opname:<18} n{node} bind[{bind}] size={size} color={color}")
        elif op == Op.DRAW_BAR_BIND:
            node = read_u16(code, pc); pc += 2
            bind = read_u16(code, pc); pc += 2
            max_value = read_u16(code, pc); pc += 2
            track = int(code[pc]); pc += 1
            fill = int(code[pc]); pc += 1
            lines.append(f"{start:04x}: {opname:<18} n{node} bind[{bind}] max={max_value} track={track} fill={fill}")
        elif op == Op.DRAW_BAR_CONST:
            node = read_u16(code, pc); pc += 2
            value = read_u16(code, pc); pc += 2
            max_value = read_u16(code, pc); pc += 2
            track = int(code[pc]); pc += 1
            fill = int(code[pc]); pc += 1
            lines.append(f"{start:04x}: {opname:<18} n{node} value={value} max={max_value} track={track} fill={fill}")
        elif op in {Op.DRAW_HLINE, Op.DRAW_VLINE}:
            node = read_u16(code, pc); pc += 2
            color = int(code[pc]); pc += 1
            lines.append(f"{start:04x}: {opname:<18} n{node} color={color}")
        elif op == Op.HALT:
            lines.append(f"{start:04x}: HALT")
        else:
            raise ValueError(f"unknown opcode 0x{op:02x} at pc {start}")
    return "\n".join(lines)


def read_u16(view: Any, offset: int) -> int:
    return (int(view[offset]) << 8) | int(view[offset + 1])


def slot_name(slot_id: int) -> str:
    node_id = slot_id // len(FIELDS)
    field = FIELDS[slot_id % len(FIELDS)]
    return f"n{node_id}.{field}"
