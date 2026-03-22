from __future__ import annotations

from typing import Iterable

from .constants import COLOR_NAMES, Opcode



def _read_u8(code: bytes, pc: int) -> tuple[int, int]:
    return code[pc], pc + 1



def _read_u16(code: bytes, pc: int) -> tuple[int, int]:
    return code[pc] | (code[pc + 1] << 8), pc + 2



def disassemble_code(code: bytes, strings: list[str] | None = None,
                     binds: list[str] | None = None) -> str:
    strings = strings or []
    binds = binds or []
    lines: list[str] = []
    pc = 0
    while pc < len(code):
        start = pc
        op_value, pc = _read_u8(code, pc)
        op = Opcode(op_value)

        if op == Opcode.HALT:
            lines.append(f'{start:04x}: HALT')
            break

        if op == Opcode.HLINE:
            x, pc = _read_u16(code, pc)
            y, pc = _read_u16(code, pc)
            w, pc = _read_u16(code, pc)
            color, pc = _read_u8(code, pc)
            lines.append(f'{start:04x}: HLINE       x={x} y={y} w={w} color={COLOR_NAMES.get(color, color)}')
            continue

        if op == Opcode.VLINE:
            x, pc = _read_u16(code, pc)
            y, pc = _read_u16(code, pc)
            h, pc = _read_u16(code, pc)
            color, pc = _read_u8(code, pc)
            lines.append(f'{start:04x}: VLINE       x={x} y={y} h={h} color={COLOR_NAMES.get(color, color)}')
            continue

        if op == Opcode.FILL_RECT:
            x, pc = _read_u16(code, pc)
            y, pc = _read_u16(code, pc)
            w, pc = _read_u16(code, pc)
            h, pc = _read_u16(code, pc)
            color, pc = _read_u8(code, pc)
            lines.append(f'{start:04x}: FILL_RECT   x={x} y={y} w={w} h={h} color={COLOR_NAMES.get(color, color)}')
            continue

        if op == Opcode.STROKE_RECT:
            x, pc = _read_u16(code, pc)
            y, pc = _read_u16(code, pc)
            w, pc = _read_u16(code, pc)
            h, pc = _read_u16(code, pc)
            color, pc = _read_u8(code, pc)
            lines.append(f'{start:04x}: STROKE_RECT x={x} y={y} w={w} h={h} color={COLOR_NAMES.get(color, color)}')
            continue

        if op == Opcode.TEXT:
            x, pc = _read_u16(code, pc)
            y, pc = _read_u16(code, pc)
            size, pc = _read_u8(code, pc)
            color, pc = _read_u8(code, pc)
            max_chars, pc = _read_u8(code, pc)
            string_id, pc = _read_u16(code, pc)
            text = strings[string_id] if string_id < len(strings) else f'<str:{string_id}>'
            lines.append(
                f'{start:04x}: TEXT        x={x} y={y} size={size} color={COLOR_NAMES.get(color, color)} '
                f'max={max_chars} string[{string_id}]={text!r}'
            )
            continue

        if op == Opcode.BIND_TEXT:
            x, pc = _read_u16(code, pc)
            y, pc = _read_u16(code, pc)
            size, pc = _read_u8(code, pc)
            color, pc = _read_u8(code, pc)
            max_chars, pc = _read_u8(code, pc)
            bind_id, pc = _read_u8(code, pc)
            bind_name = binds[bind_id] if bind_id < len(binds) else f'<bind:{bind_id}>'
            lines.append(
                f'{start:04x}: BIND_TEXT   x={x} y={y} size={size} color={COLOR_NAMES.get(color, color)} '
                f'max={max_chars} bind[{bind_id}]={bind_name!r}'
            )
            continue

        if op == Opcode.BAR:
            x, pc = _read_u16(code, pc)
            y, pc = _read_u16(code, pc)
            w, pc = _read_u16(code, pc)
            h, pc = _read_u16(code, pc)
            value, pc = _read_u16(code, pc)
            max_value, pc = _read_u16(code, pc)
            track, pc = _read_u8(code, pc)
            fill, pc = _read_u8(code, pc)
            lines.append(
                f'{start:04x}: BAR         x={x} y={y} w={w} h={h} value={value}/{max_value} '
                f'track={COLOR_NAMES.get(track, track)} fill={COLOR_NAMES.get(fill, fill)}'
            )
            continue

        if op == Opcode.BIND_BAR:
            x, pc = _read_u16(code, pc)
            y, pc = _read_u16(code, pc)
            w, pc = _read_u16(code, pc)
            h, pc = _read_u16(code, pc)
            bind_id, pc = _read_u8(code, pc)
            max_value, pc = _read_u16(code, pc)
            track, pc = _read_u8(code, pc)
            fill, pc = _read_u8(code, pc)
            bind_name = binds[bind_id] if bind_id < len(binds) else f'<bind:{bind_id}>'
            lines.append(
                f'{start:04x}: BIND_BAR    x={x} y={y} w={w} h={h} bind[{bind_id}]={bind_name!r} '
                f'max={max_value} track={COLOR_NAMES.get(track, track)} fill={COLOR_NAMES.get(fill, fill)}'
            )
            continue

        if op == Opcode.CIRCLE:
            cx, pc = _read_u16(code, pc)
            cy, pc = _read_u16(code, pc)
            r, pc = _read_u16(code, pc)
            color, pc = _read_u8(code, pc)
            lines.append(f'{start:04x}: CIRCLE      cx={cx} cy={cy} r={r} color={COLOR_NAMES.get(color, color)}')
            continue

        if op == Opcode.CROSS:
            cx, pc = _read_u16(code, pc)
            cy, pc = _read_u16(code, pc)
            length, pc = _read_u16(code, pc)
            color, pc = _read_u8(code, pc)
            lines.append(f'{start:04x}: CROSS       cx={cx} cy={cy} len={length} color={COLOR_NAMES.get(color, color)}')
            continue

        lines.append(f'{start:04x}: DB          0x{op_value:02x}')
        break

    return '\n'.join(lines)
