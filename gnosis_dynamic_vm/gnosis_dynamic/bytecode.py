from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum
from typing import Iterable, List


class Op(IntEnum):
    MEASURE_TEXT_BIND = 0x01
    PUSH_CONST = 0x02
    PUSH_SLOT = 0x03
    ADD = 0x04
    SUB = 0x05
    MUL = 0x06
    DIV = 0x07
    MAX = 0x08
    MIN = 0x09
    STORE_SLOT = 0x0A
    DRAW_TEXT_CONST = 0x0B
    DRAW_TEXT_BIND = 0x0C
    DRAW_BAR_BIND = 0x0D
    DRAW_BAR_CONST = 0x0E
    DRAW_HLINE = 0x0F
    DRAW_VLINE = 0x10
    HALT = 0xFF


OP_NAMES = {int(v): v.name for v in Op}

MAGIC = b"GNDY"
VERSION = 1


@dataclass
class Program:
    node_count: int
    slot_init: List[int]
    binds: List[str]
    strings: List[str]
    code: bytes
    manifest: dict

    def to_bytes(self) -> bytes:
        out = bytearray()
        out.extend(MAGIC)
        out.append(VERSION)
        out.extend(u16(self.node_count))
        out.extend(u16(len(self.slot_init)))
        out.extend(u16(len(self.binds)))
        out.extend(u16(len(self.strings)))
        out.extend(u32(len(self.code)))
        for bind in self.binds:
            data = bind.encode("utf-8")
            out.extend(u16(len(data)))
            out.extend(data)
        for string in self.strings:
            data = string.encode("utf-8")
            out.extend(u16(len(data)))
            out.extend(data)
        for value in self.slot_init:
            out.extend(u16(value))
        out.extend(self.code)
        return bytes(out)

    @classmethod
    def from_bytes(cls, data: bytes) -> "Program":
        view = memoryview(data)
        cursor = 0
        if bytes(view[cursor:cursor + 4]) != MAGIC:
            raise ValueError("bad magic")
        cursor += 4
        version = view[cursor]
        cursor += 1
        if version != VERSION:
            raise ValueError(f"unsupported version {version}")
        node_count = read_u16(view, cursor)
        cursor += 2
        slot_count = read_u16(view, cursor)
        cursor += 2
        bind_count = read_u16(view, cursor)
        cursor += 2
        string_count = read_u16(view, cursor)
        cursor += 2
        code_len = read_u32(view, cursor)
        cursor += 4

        binds = []
        for _ in range(bind_count):
            n = read_u16(view, cursor)
            cursor += 2
            binds.append(bytes(view[cursor:cursor + n]).decode("utf-8"))
            cursor += n

        strings = []
        for _ in range(string_count):
            n = read_u16(view, cursor)
            cursor += 2
            strings.append(bytes(view[cursor:cursor + n]).decode("utf-8"))
            cursor += n

        slot_init = []
        for _ in range(slot_count):
            slot_init.append(read_u16(view, cursor))
            cursor += 2

        code = bytes(view[cursor:cursor + code_len])
        cursor += code_len
        if cursor != len(data):
            raise ValueError("trailing bytes in program")

        return cls(
            node_count=node_count,
            slot_init=slot_init,
            binds=binds,
            strings=strings,
            code=code,
            manifest={},
        )


def u16(value: int) -> bytes:
    value &= 0xFFFF
    return bytes([(value >> 8) & 0xFF, value & 0xFF])


def u32(value: int) -> bytes:
    value &= 0xFFFFFFFF
    return bytes([
        (value >> 24) & 0xFF,
        (value >> 16) & 0xFF,
        (value >> 8) & 0xFF,
        value & 0xFF,
    ])


def read_u16(view: memoryview, offset: int) -> int:
    return (int(view[offset]) << 8) | int(view[offset + 1])


def read_u32(view: memoryview, offset: int) -> int:
    return (
        (int(view[offset]) << 24)
        | (int(view[offset + 1]) << 16)
        | (int(view[offset + 2]) << 8)
        | int(view[offset + 3])
    )


class CodeBuilder:
    def __init__(self) -> None:
        self.bytes = bytearray()

    def emit_u8(self, value: int) -> None:
        self.bytes.append(value & 0xFF)

    def emit_u16(self, value: int) -> None:
        self.bytes.extend(u16(value))

    def emit_op(self, op: Op, *operands: int) -> None:
        self.emit_u8(int(op))
        for operand in operands:
            raise AssertionError("use explicit emit helpers for sized operands")

    def emit_measure_text_bind(self, node_id: int, bind_id: int, size: int) -> None:
        self.emit_u8(Op.MEASURE_TEXT_BIND)
        self.emit_u16(node_id)
        self.emit_u16(bind_id)
        self.emit_u8(size)

    def emit_push_const(self, value: int) -> None:
        self.emit_u8(Op.PUSH_CONST)
        self.emit_u16(value)

    def emit_push_slot(self, slot: int) -> None:
        self.emit_u8(Op.PUSH_SLOT)
        self.emit_u16(slot)

    def emit_store_slot(self, slot: int) -> None:
        self.emit_u8(Op.STORE_SLOT)
        self.emit_u16(slot)

    def emit_stack_op(self, op: Op) -> None:
        assert op in {Op.ADD, Op.SUB, Op.MUL, Op.DIV, Op.MAX, Op.MIN}
        self.emit_u8(op)

    def emit_draw_text_const(self, node_id: int, string_id: int, size: int, color: int) -> None:
        self.emit_u8(Op.DRAW_TEXT_CONST)
        self.emit_u16(node_id)
        self.emit_u16(string_id)
        self.emit_u8(size)
        self.emit_u8(color)

    def emit_draw_text_bind(self, node_id: int, bind_id: int, size: int, color: int) -> None:
        self.emit_u8(Op.DRAW_TEXT_BIND)
        self.emit_u16(node_id)
        self.emit_u16(bind_id)
        self.emit_u8(size)
        self.emit_u8(color)

    def emit_draw_bar_bind(self, node_id: int, bind_id: int, max_value: int, track: int, fill: int) -> None:
        self.emit_u8(Op.DRAW_BAR_BIND)
        self.emit_u16(node_id)
        self.emit_u16(bind_id)
        self.emit_u16(max_value)
        self.emit_u8(track)
        self.emit_u8(fill)

    def emit_draw_bar_const(self, node_id: int, value: int, max_value: int, track: int, fill: int) -> None:
        self.emit_u8(Op.DRAW_BAR_CONST)
        self.emit_u16(node_id)
        self.emit_u16(value)
        self.emit_u16(max_value)
        self.emit_u8(track)
        self.emit_u8(fill)

    def emit_draw_hline(self, node_id: int, color: int) -> None:
        self.emit_u8(Op.DRAW_HLINE)
        self.emit_u16(node_id)
        self.emit_u8(color)

    def emit_draw_vline(self, node_id: int, color: int) -> None:
        self.emit_u8(Op.DRAW_VLINE)
        self.emit_u16(node_id)
        self.emit_u8(color)

    def emit_halt(self) -> None:
        self.emit_u8(Op.HALT)

    def build(self) -> bytes:
        return bytes(self.bytes)
