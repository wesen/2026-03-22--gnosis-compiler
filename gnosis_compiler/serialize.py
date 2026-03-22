from __future__ import annotations

import struct

from .constants import Waveform
from .model import Program

_HEADER_FMT = '<4sBBHHHHHHHHHH'
_MAGIC = b'GNBC'
_VERSION = 1



def _encode_strings(values: list[str]) -> bytes:
    out = bytearray()
    for value in values:
        data = value.encode('utf-8')
        if len(data) > 0xFFFF:
            raise ValueError('String too long for program section')
        out.extend(struct.pack('<H', len(data)))
        out.extend(data)
    return bytes(out)



def _waveform_id(name: str) -> int:
    lowered = name.lower()
    if lowered == 'full':
        return int(Waveform.FULL)
    if lowered == 'part':
        return int(Waveform.PART)
    return int(Waveform.FAST)



def _encode_regions(program: Program) -> bytes:
    out = bytearray()
    for region in program.regions:
        bind_ids = list(region.bind_ids)
        if len(bind_ids) > 0xFF:
            raise ValueError('Too many binds attached to one refresh region')
        out.extend(struct.pack(
            '<HHHHBB',
            region.rect.x,
            region.rect.y,
            region.rect.w,
            region.rect.h,
            _waveform_id(region.waveform),
            len(bind_ids),
        ))
        out.extend(bytes(bind_ids))
    return bytes(out)



def serialize_program(program: Program) -> bytes:
    string_section = _encode_strings(program.strings)
    bind_section = _encode_strings(program.binds)
    region_section = _encode_regions(program)
    code_section = program.code

    header_size = struct.calcsize(_HEADER_FMT)
    strings_off = header_size
    binds_off = strings_off + len(string_section)
    regions_off = binds_off + len(bind_section)
    code_off = regions_off + len(region_section)

    header = struct.pack(
        _HEADER_FMT,
        _MAGIC,
        _VERSION,
        0,
        program.width,
        program.height,
        strings_off,
        len(program.strings),
        binds_off,
        len(program.binds),
        regions_off,
        len(program.regions),
        code_off,
        len(code_section),
    )
    return header + string_section + bind_section + region_section + code_section
