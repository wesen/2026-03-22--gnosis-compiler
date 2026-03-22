from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Set


class Expr:
    def simplify(self) -> "Expr":
        return self

    def deps(self) -> Set[int]:
        return set()

    def is_const(self) -> bool:
        return isinstance(self.simplify(), Const)

    def const_value(self) -> int:
        simp = self.simplify()
        if not isinstance(simp, Const):
            raise TypeError("expression is not constant")
        return simp.value


@dataclass(frozen=True)
class Const(Expr):
    value: int

    def simplify(self) -> "Expr":
        return self

    def __str__(self) -> str:
        return str(self.value)


@dataclass(frozen=True)
class SlotRef(Expr):
    slot: int

    def deps(self) -> Set[int]:
        return {self.slot}

    def __str__(self) -> str:
        return f"s{self.slot}"


@dataclass(frozen=True)
class BinOp(Expr):
    op: str
    left: Expr
    right: Expr

    def deps(self) -> Set[int]:
        return self.left.deps() | self.right.deps()

    def simplify(self) -> Expr:
        left = self.left.simplify()
        right = self.right.simplify()

        if isinstance(left, Const) and isinstance(right, Const):
            if self.op == "+":
                return Const(left.value + right.value)
            if self.op == "-":
                return Const(left.value - right.value)
            if self.op == "*":
                return Const(left.value * right.value)
            if self.op == "/":
                if right.value == 0:
                    raise ZeroDivisionError("division by zero in expression simplification")
                return Const(left.value // right.value)
            if self.op == "max":
                return Const(max(left.value, right.value))
            if self.op == "min":
                return Const(min(left.value, right.value))
            raise ValueError(f"unknown op {self.op}")

        if self.op == "+":
            if isinstance(left, Const) and left.value == 0:
                return right
            if isinstance(right, Const) and right.value == 0:
                return left
        elif self.op == "-":
            if isinstance(right, Const) and right.value == 0:
                return left
            if left == right:
                return Const(0)
        elif self.op == "*":
            if isinstance(left, Const):
                if left.value == 0:
                    return Const(0)
                if left.value == 1:
                    return right
            if isinstance(right, Const):
                if right.value == 0:
                    return Const(0)
                if right.value == 1:
                    return left
        elif self.op == "/":
            if isinstance(right, Const):
                if right.value == 1:
                    return left
        elif self.op == "max":
            if left == right:
                return left
            if isinstance(left, Const) and isinstance(right, Const):
                return Const(max(left.value, right.value))
        elif self.op == "min":
            if left == right:
                return left
            if isinstance(left, Const) and isinstance(right, Const):
                return Const(min(left.value, right.value))

        # Constant reassociation for associative ops.
        if self.op == "+":
            left_const, left_terms = flatten_add(left)
            right_const, right_terms = flatten_add(right)
            total_const = left_const + right_const
            terms = left_terms + right_terms
            expr: Expr | None = None
            for term in terms:
                expr = term if expr is None else BinOp("+", expr, term)
            if total_const != 0 or expr is None:
                const_expr = Const(total_const)
                expr = const_expr if expr is None else BinOp("+", expr, const_expr)
            if expr is None:
                expr = Const(0)
            return expr

        if self.op in {"max", "min"}:
            left_const, left_terms = flatten_assoc(left, self.op)
            right_const, right_terms = flatten_assoc(right, self.op)
            const_val = left_const
            if right_const is not None:
                const_val = right_const if const_val is None else (max(const_val, right_const) if self.op == "max" else min(const_val, right_const))
            terms = left_terms + right_terms
            expr: Expr | None = None
            for term in terms:
                expr = term if expr is None else BinOp(self.op, expr, term)
            if const_val is not None:
                const_expr = Const(const_val)
                expr = const_expr if expr is None else BinOp(self.op, expr, const_expr)
            if expr is None:
                expr = Const(0)
            return expr

        return BinOp(self.op, left, right)

    def __str__(self) -> str:
        if self.op in {"max", "min"}:
            return f"{self.op}({self.left}, {self.right})"
        return f"({self.left} {self.op} {self.right})"


def flatten_add(expr: Expr) -> tuple[int, list[Expr]]:
    expr = expr.simplify()
    if isinstance(expr, Const):
        return expr.value, []
    if isinstance(expr, BinOp) and expr.op == "+":
        lc, lt = flatten_add(expr.left)
        rc, rt = flatten_add(expr.right)
        return lc + rc, lt + rt
    return 0, [expr]


def flatten_assoc(expr: Expr, op: str) -> tuple[int | None, list[Expr]]:
    expr = expr.simplify()
    if isinstance(expr, Const):
        return expr.value, []
    if isinstance(expr, BinOp) and expr.op == op:
        lc, lt = flatten_assoc(expr.left, op)
        rc, rt = flatten_assoc(expr.right, op)
        if lc is None:
            const_val = rc
        elif rc is None:
            const_val = lc
        else:
            const_val = max(lc, rc) if op == "max" else min(lc, rc)
        return const_val, lt + rt
    return None, [expr]


def add(a: Expr, b: Expr) -> Expr:
    return BinOp("+", a, b).simplify()


def sub(a: Expr, b: Expr) -> Expr:
    return BinOp("-", a, b).simplify()


def mul(a: Expr, b: Expr) -> Expr:
    return BinOp("*", a, b).simplify()


def div(a: Expr, b: Expr) -> Expr:
    return BinOp("/", a, b).simplify()


def max_expr(a: Expr, b: Expr) -> Expr:
    return BinOp("max", a, b).simplify()


def min_expr(a: Expr, b: Expr) -> Expr:
    return BinOp("min", a, b).simplify()


def sum_expr(items: Iterable[Expr]) -> Expr:
    out: Expr = Const(0)
    for item in items:
        out = add(out, item)
    return out


def max_many(items: Iterable[Expr], default: int = 0) -> Expr:
    out: Expr = Const(default)
    first = True
    for item in items:
        if first:
            out = item
            first = False
        else:
            out = max_expr(out, item)
    return out if not first else Const(default)


def min_many(items: Iterable[Expr], default: int = 0) -> Expr:
    out: Expr = Const(default)
    first = True
    for item in items:
        if first:
            out = item
            first = False
        else:
            out = min_expr(out, item)
    return out if not first else Const(default)
