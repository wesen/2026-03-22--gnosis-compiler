from __future__ import annotations

from dataclasses import replace
from typing import Any

from .bytecode import BindTable, ByteWriter, StringPool
from .constants import Color, Opcode, Waveform
from .model import BindSite, RefreshRegion
from .util import Rect


COLOR_LOOKUP = {
    None: Color.FG,
    'bg': Color.BG,
    'fg': Color.FG,
    'mid': Color.MID,
    'light': Color.LIGHT,
    'ghost': Color.GHOST,
    0: Color.BG,
    1: Color.FG,
    2: Color.MID,
    3: Color.LIGHT,
    4: Color.GHOST,
}

WAVEFORM_LOOKUP = {
    None: Waveform.FAST,
    'fast': Waveform.FAST,
    'part': Waveform.PART,
    'partial': Waveform.PART,
    'full': Waveform.FULL,
    0: Waveform.FULL,
    1: Waveform.PART,
    2: Waveform.FAST,
}

WAVEFORM_ORDER = {
    'fast': 0,
    'part': 1,
    'full': 2,
}



def color_id(value: Any) -> Color:
    try:
        return COLOR_LOOKUP[value]
    except KeyError:
        return Color.FG



def waveform_name(node: dict[str, Any]) -> str:
    wf = WAVEFORM_LOOKUP.get(node.get('waveform'), Waveform.FAST)
    if wf == Waveform.FULL:
        return 'full'
    if wf == Waveform.PART:
        return 'part'
    return 'fast'



def _emit_hline(writer: ByteWriter, x: int, y: int, w: int, color: Color) -> None:
    writer.emit_u8(Opcode.HLINE)
    writer.emit_u16(x)
    writer.emit_u16(y)
    writer.emit_u16(w)
    writer.emit_u8(color)



def _emit_vline(writer: ByteWriter, x: int, y: int, h: int, color: Color) -> None:
    writer.emit_u8(Opcode.VLINE)
    writer.emit_u16(x)
    writer.emit_u16(y)
    writer.emit_u16(h)
    writer.emit_u8(color)



def _emit_fill_rect(writer: ByteWriter, rect: Rect, color: Color) -> None:
    writer.emit_u8(Opcode.FILL_RECT)
    writer.emit_u16(rect.x)
    writer.emit_u16(rect.y)
    writer.emit_u16(rect.w)
    writer.emit_u16(rect.h)
    writer.emit_u8(color)



def _emit_stroke_rect(writer: ByteWriter, rect: Rect, color: Color) -> None:
    writer.emit_u8(Opcode.STROKE_RECT)
    writer.emit_u16(rect.x)
    writer.emit_u16(rect.y)
    writer.emit_u16(rect.w)
    writer.emit_u16(rect.h)
    writer.emit_u8(color)



def _emit_text(writer: ByteWriter, rect: Rect, text_id: int, size: int, color: Color, max_chars: int) -> None:
    writer.emit_u8(Opcode.TEXT)
    writer.emit_u16(rect.x)
    writer.emit_u16(rect.y)
    writer.emit_u8(size)
    writer.emit_u8(color)
    writer.emit_u8(max_chars)
    writer.emit_u16(text_id)



def _emit_bind_text(writer: ByteWriter, rect: Rect, bind_id: int, size: int, color: Color, max_chars: int) -> None:
    writer.emit_u8(Opcode.BIND_TEXT)
    writer.emit_u16(rect.x)
    writer.emit_u16(rect.y)
    writer.emit_u8(size)
    writer.emit_u8(color)
    writer.emit_u8(max_chars)
    writer.emit_u8(bind_id)



def _emit_bar(writer: ByteWriter, rect: Rect, value: int, max_value: int,
              track: Color, fill: Color) -> None:
    writer.emit_u8(Opcode.BAR)
    writer.emit_u16(rect.x)
    writer.emit_u16(rect.y)
    writer.emit_u16(rect.w)
    writer.emit_u16(rect.h)
    writer.emit_u16(value)
    writer.emit_u16(max_value)
    writer.emit_u8(track)
    writer.emit_u8(fill)



def _emit_bind_bar(writer: ByteWriter, rect: Rect, bind_id: int, max_value: int,
                   track: Color, fill: Color) -> None:
    writer.emit_u8(Opcode.BIND_BAR)
    writer.emit_u16(rect.x)
    writer.emit_u16(rect.y)
    writer.emit_u16(rect.w)
    writer.emit_u16(rect.h)
    writer.emit_u8(bind_id)
    writer.emit_u16(max_value)
    writer.emit_u8(track)
    writer.emit_u8(fill)



def _emit_circle(writer: ByteWriter, cx: int, cy: int, r: int, color: Color) -> None:
    writer.emit_u8(Opcode.CIRCLE)
    writer.emit_u16(cx)
    writer.emit_u16(cy)
    writer.emit_u16(r)
    writer.emit_u8(color)



def _emit_cross(writer: ByteWriter, cx: int, cy: int, length: int, color: Color) -> None:
    writer.emit_u8(Opcode.CROSS)
    writer.emit_u16(cx)
    writer.emit_u16(cy)
    writer.emit_u16(length)
    writer.emit_u8(color)



def lower_screen(screen: dict[str, Any]) -> tuple[bytes, list[str], list[str], list[BindSite]]:
    writer = ByteWriter()
    strings = StringPool()
    binds = BindTable()
    bind_sites: list[BindSite] = []

    for section_name in ('bar', 'body', 'nav'):
        lower_node(screen[section_name], writer, strings, binds, bind_sites)

    writer.emit_u8(Opcode.HALT)
    return writer.to_bytes(), strings.values, binds.values, bind_sites



def lower_node(node: dict[str, Any], writer: ByteWriter, strings: StringPool,
               binds: BindTable, bind_sites: list[BindSite]) -> None:
    rect: Rect = node['rect']
    children = node.get('children', [])

    if node.get('border_t') and rect.h > 0:
        _emit_hline(writer, rect.x, rect.y, rect.w, Color.MID)
    if node.get('border_b') and rect.h > 0:
        _emit_hline(writer, rect.x, rect.y + rect.h - 1, rect.w, Color.MID)

    node_type = node['type']

    if node_type == 'spacer':
        return

    if node_type == 'fill':
        _emit_fill_rect(writer, rect, color_id(node.get('color') or node.get('fill_color')))
        return

    if node_type == 'label':
        size = max(1, int(node.get('size', 1) or 1))
        fg = color_id(node.get('color'))
        max_chars = int(node.get('max_visible_chars', 0))
        if node.get('invert'):
            bg_rect = Rect(rect.x, rect.y, rect.w, rect.h)
            _emit_fill_rect(writer, bg_rect, fg)
            fg = Color.BG

        if node.get('bind'):
            bind_id = binds.intern(str(node['bind']))
            opcode_offset = writer.tell()
            _emit_bind_text(writer, rect, bind_id, size, fg, max_chars)
            bind_sites.append(BindSite(
                bind_id=bind_id,
                bind_name=binds.values[bind_id],
                rect=rect,
                waveform=waveform_name(node),
                node_id=str(node.get('id', '')),
                opcode_offset=opcode_offset,
            ))
        else:
            text = '' if node.get('text') is None else str(node.get('text', ''))
            text_id = strings.intern(text)
            _emit_text(writer, rect, text_id, size, fg, max_chars)
        return

    if node_type == 'bar':
        track = color_id(node.get('track_color') or 'light')
        fill = color_id(node.get('fill_color') or node.get('color') or 'fg')
        max_value = int(node.get('max', 100))
        if node.get('bind'):
            bind_id = binds.intern(str(node['bind']))
            opcode_offset = writer.tell()
            _emit_bind_bar(writer, rect, bind_id, max_value, track, fill)
            bind_sites.append(BindSite(
                bind_id=bind_id,
                bind_name=binds.values[bind_id],
                rect=rect,
                waveform=waveform_name(node),
                node_id=str(node.get('id', '')),
                opcode_offset=opcode_offset,
            ))
        else:
            value = int(node.get('value', 0))
            _emit_bar(writer, rect, value, max_value, track, fill)
        return

    if node_type == 'sep':
        _emit_hline(writer, rect.x, rect.y, rect.w, color_id(node.get('color') or 'mid'))
        return

    if node_type == 'circle':
        cx = int(node.get('_abs_cx', rect.x + rect.w // 2))
        cy = int(node.get('_abs_cy', rect.y + rect.h // 2))
        radius = int(node.get('r', min(rect.w, rect.h) // 2))
        _emit_circle(writer, cx, cy, radius, color_id(node.get('color') or 'mid'))
        return

    if node_type == 'cross':
        cx = int(node.get('_abs_cx', rect.x + rect.w // 2))
        cy = int(node.get('_abs_cy', rect.y + rect.h // 2))
        length = int(node.get('len', min(rect.w, rect.h) // 2))
        _emit_cross(writer, cx, cy, length, color_id(node.get('color') or 'fg'))
        return

    if node_type == 'list':
        lower_list(node, writer, strings)
        return

    if node_type == 'grid':
        lower_grid(node, writer, strings)
        return

    if node_type == 'btn':
        if node.get('fill_color'):
            _emit_fill_rect(writer, rect, color_id(node.get('fill_color')))
        _emit_stroke_rect(writer, rect, color_id(node.get('stroke_color') or node.get('color') or 'fg'))
        for child in children:
            lower_node(child, writer, strings, binds, bind_sites)
        return

    if node_type == 'hbox' and isinstance(node.get('split'), int):
        split_x = rect.x + int(node['split'])
        _emit_vline(writer, split_x, rect.y, rect.h, Color.MID)

    for child in children:
        lower_node(child, writer, strings, binds, bind_sites)



def lower_list(node: dict[str, Any], writer: ByteWriter, strings: StringPool) -> None:
    rect: Rect = node['rect']
    data = node.get('data') or []
    if not isinstance(data, list):
        raise TypeError('list.data must be a concrete array after props resolution')

    row_h = int(node.get('row_h', 14))
    visible = int(node.get('visible_rows', 0))
    selected = node.get('selected')
    default_color = color_id(node.get('color') or 'fg')

    for i in range(min(visible, len(data))):
        row_y = rect.y + i * row_h
        row_rect = Rect(rect.x, row_y, rect.w, row_h)
        if selected is not None and int(selected) == i:
            _emit_fill_rect(writer, row_rect, Color.LIGHT)
        item = data[i]
        if isinstance(item, str):
            text_id = strings.intern(item)
            _emit_text(writer, Rect(rect.x + 2, row_y + 2, max(0, rect.w - 4), row_h), text_id, 1, default_color, max(0, (rect.w - 4) // 8))
            continue
        if isinstance(item, dict) and 'cols' in item:
            cursor_x = rect.x + 2
            for col in item['cols']:
                text = str(col.get('text') or col.get('label') or '')
                text_id = strings.intern(text)
                col_width = int(col.get('w', max(8, len(text) * 8)))
                col_rect = Rect(cursor_x, row_y + 2, col_width, row_h)
                _emit_text(writer, col_rect, text_id, 1, color_id(col.get('color')), max(0, col_width // 8))
                cursor_x += col_width
            continue
        if isinstance(item, dict):
            text = str(item.get('text') or item.get('label') or '')
            text_id = strings.intern(text)
            _emit_text(writer, Rect(rect.x + 2, row_y + 2, max(0, rect.w - 4), row_h), text_id, 1, color_id(item.get('color')) if 'color' in item else default_color, max(0, (rect.w - 4) // 8))
            continue
        text_id = strings.intern(str(item))
        _emit_text(writer, Rect(rect.x + 2, row_y + 2, max(0, rect.w - 4), row_h), text_id, 1, default_color, max(0, (rect.w - 4) // 8))



def lower_grid(node: dict[str, Any], writer: ByteWriter, strings: StringPool) -> None:
    rect: Rect = node['rect']
    data = node.get('data') or node.get('items') or []
    if not isinstance(data, list):
        raise TypeError('grid.data must be a concrete array after props resolution')

    cols = max(1, int(node.get('cols', 1) or 1))
    cell_w = int(node.get('cell_w', 0) or max(1, rect.w // cols))
    cell_h = int(node.get('cell_h', 16) or 16)
    visible_rows = int(node.get('visible_rows', 0))
    max_cells = cols * visible_rows if visible_rows > 0 else len(data)

    for index, item in enumerate(data[:max_cells]):
        col = index % cols
        row = index // cols
        cell_rect = Rect(rect.x + col * cell_w, rect.y + row * cell_h, cell_w, cell_h)
        if isinstance(item, dict):
            text = str(item.get('text') or item.get('label') or '')
            if item.get('today'):
                _emit_stroke_rect(writer, cell_rect, Color.FG)
            if item.get('event'):
                dot_rect = Rect(cell_rect.x + cell_w - 4, cell_rect.y + 2, 2, 2)
                _emit_fill_rect(writer, dot_rect, Color.FG)
            color = color_id(item.get('color')) if 'color' in item else Color.FG
        else:
            text = str(item)
            color = Color.FG
        text_id = strings.intern(text)
        _emit_text(
            writer,
            Rect(cell_rect.x + 2, cell_rect.y + 2, max(0, cell_w - 4), cell_h),
            text_id,
            1,
            color,
            max(0, (cell_w - 4) // 8),
        )



def merge_regions(bind_sites: list[BindSite], threshold: int) -> list[RefreshRegion]:
    regions = [
        RefreshRegion(
            rect=site.rect,
            waveform=site.waveform,
            bind_ids=[site.bind_id],
            bind_names=[site.bind_name],
        )
        for site in bind_sites
    ]

    changed = True
    while changed:
        changed = False
        i = 0
        while i < len(regions):
            j = i + 1
            while j < len(regions):
                merged_rect = regions[i].rect.union(regions[j].rect)
                waste = merged_rect.area() - regions[i].rect.area() - regions[j].rect.area()
                if waste < threshold:
                    merged_waveform = worse_waveform(regions[i].waveform, regions[j].waveform)
                    merged_bind_ids = sorted(set(regions[i].bind_ids + regions[j].bind_ids))
                    merged_bind_names = []
                    seen = set()
                    for name in regions[i].bind_names + regions[j].bind_names:
                        if name not in seen:
                            seen.add(name)
                            merged_bind_names.append(name)
                    regions[i] = RefreshRegion(
                        rect=merged_rect,
                        waveform=merged_waveform,
                        bind_ids=merged_bind_ids,
                        bind_names=merged_bind_names,
                    )
                    regions.pop(j)
                    changed = True
                else:
                    j += 1
            i += 1
    return regions



def worse_waveform(left: str, right: str) -> str:
    return left if WAVEFORM_ORDER[left] >= WAVEFORM_ORDER[right] else right
