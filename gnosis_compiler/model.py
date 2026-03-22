from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

from .util import Rect


@dataclass
class CompileOptions:
    width: int = 400
    height: int = 300
    glyph_w: int = 8
    glyph_h: int = 8
    region_merge_threshold: int = 512


@dataclass
class BindSite:
    bind_id: int
    bind_name: str
    rect: Rect
    waveform: str
    node_id: str
    opcode_offset: int

    def to_dict(self) -> dict[str, Any]:
        return {
            'bind_id': self.bind_id,
            'bind_name': self.bind_name,
            'rect': asdict(self.rect),
            'waveform': self.waveform,
            'node_id': self.node_id,
            'opcode_offset': self.opcode_offset,
        }


@dataclass
class RefreshRegion:
    rect: Rect
    waveform: str
    bind_ids: list[int] = field(default_factory=list)
    bind_names: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            'rect': asdict(self.rect),
            'waveform': self.waveform,
            'bind_ids': list(self.bind_ids),
            'bind_names': list(self.bind_names),
        }


@dataclass
class Program:
    width: int
    height: int
    code: bytes
    strings: list[str]
    binds: list[str]
    bind_sites: list[BindSite]
    regions: list[RefreshRegion]
    stats: dict[str, Any]
    ast: dict[str, Any]
    binary: bytes | None = None

    def to_manifest(self) -> dict[str, Any]:
        return {
            'width': self.width,
            'height': self.height,
            'code_size': len(self.code),
            'string_count': len(self.strings),
            'bind_count': len(self.binds),
            'region_count': len(self.regions),
            'strings': list(self.strings),
            'binds': list(self.binds),
            'bind_sites': [site.to_dict() for site in self.bind_sites],
            'regions': [region.to_dict() for region in self.regions],
            'stats': self.stats,
        }
