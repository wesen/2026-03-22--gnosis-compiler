from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


class ByteWriter:
    def __init__(self) -> None:
        self.buffer = bytearray()

    def emit_u8(self, value: int) -> None:
        self.buffer.append(int(value) & 0xFF)

    def emit_u16(self, value: int) -> None:
        value = int(value) & 0xFFFF
        self.buffer.extend((value & 0xFF, (value >> 8) & 0xFF))

    def emit_bytes(self, data: bytes | bytearray) -> None:
        self.buffer.extend(data)

    def tell(self) -> int:
        return len(self.buffer)

    def to_bytes(self) -> bytes:
        return bytes(self.buffer)


@dataclass
class StringPool:
    values: List[str] = field(default_factory=list)
    index: Dict[str, int] = field(default_factory=dict)

    def intern(self, text: str) -> int:
        key = '' if text is None else str(text)
        if key not in self.index:
            self.index[key] = len(self.values)
            self.values.append(key)
        return self.index[key]


@dataclass
class BindTable:
    values: List[str] = field(default_factory=list)
    index: Dict[str, int] = field(default_factory=dict)

    def intern(self, name: str) -> int:
        key = str(name)
        if key not in self.index:
            self.index[key] = len(self.values)
            self.values.append(key)
        return self.index[key]
