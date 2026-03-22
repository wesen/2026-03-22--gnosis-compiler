from __future__ import annotations

from typing import Any

from .constants import DEFAULT_GLYPH_H, DEFAULT_GLYPH_W
from .errors import CompileError
from .util import Rect, clamp_non_negative



def _has_explicit_height(node: dict[str, Any]) -> bool:
    return isinstance(node.get('h'), int)



def _has_explicit_width(node: dict[str, Any]) -> bool:
    return isinstance(node.get('w'), int)



def _is_spacer(node: dict[str, Any]) -> bool:
    return node.get('type') == 'spacer' or bool(node.get('spacer'))



def text_width(node: dict[str, Any], glyph_w: int = DEFAULT_GLYPH_W) -> int:
    size = max(1, int(node.get('size', 1) or 1))
    if node.get('bind'):
        n_chars = int(node.get('field_w', max(1, len(str(node.get('text', ''))))))
    else:
        text = '' if node.get('text') is None else str(node.get('text', ''))
        n_chars = len(text)
    return n_chars * glyph_w * size



def intrinsic_width(node: dict[str, Any], glyph_w: int = DEFAULT_GLYPH_W) -> int:
    node_type = node['type']
    if _has_explicit_width(node):
        return int(node['w'])
    if node_type == 'label':
        return text_width(node, glyph_w)
    if node_type == 'btn':
        child_labels = [child for child in node.get('children', []) if child['type'] == 'label']
        if child_labels:
            widest = max(text_width(child, glyph_w) for child in child_labels)
            return widest + 8
    raise CompileError(
        f'hbox child {node_type!r} needs an explicit width or measurable intrinsic width'
    )



def layout_screen(screen: dict[str, Any], width: int, height: int,
                  glyph_w: int = DEFAULT_GLYPH_W,
                  glyph_h: int = DEFAULT_GLYPH_H) -> dict[str, Any]:
    bar_h = int(screen['bar'].get('h', 0))
    nav_h = int(screen['nav'].get('h', 0))
    body_h = clamp_non_negative(height - bar_h - nav_h)

    screen = dict(screen)
    screen['width'] = width
    screen['height'] = height
    screen['bar'] = layout_node(screen['bar'], 0, 0, width, bar_h, glyph_w, glyph_h)
    screen['body'] = layout_node(screen['body'], 0, bar_h, width, body_h, glyph_w, glyph_h)
    screen['nav'] = layout_node(screen['nav'], 0, bar_h + body_h, width, nav_h, glyph_w, glyph_h)
    return screen



def layout_node(node: dict[str, Any], x: int, y: int, w: int, h: int,
                glyph_w: int = DEFAULT_GLYPH_W,
                glyph_h: int = DEFAULT_GLYPH_H) -> dict[str, Any]:
    node = dict(node)
    node['rect'] = Rect(x, y, max(0, int(w)), max(0, int(h)))
    node_type = node['type']
    if node_type == 'vbox':
        return layout_vbox(node, x, y, w, h, glyph_w, glyph_h)
    if node_type == 'hbox':
        return layout_hbox(node, x, y, w, h, glyph_w, glyph_h)
    if node_type == 'fixed' or node_type == 'btn':
        return layout_fixed(node, x, y, w, h, glyph_w, glyph_h)
    return layout_leaf(node, x, y, w, h, glyph_w, glyph_h)



def layout_vbox(node: dict[str, Any], x: int, y: int, w: int, h: int,
                glyph_w: int, glyph_h: int) -> dict[str, Any]:
    children = list(node.get('children', []))
    fixed_total = 0
    flex_count = 0
    for child in children:
        if _has_explicit_height(child):
            fixed_total += int(child['h'])
        else:
            flex_count += 1
    remaining = clamp_non_negative(h - fixed_total)
    flex_h = remaining // flex_count if flex_count > 0 else 0
    cursor_y = y
    laid_out = []
    for child in children:
        child_h = int(child['h']) if _has_explicit_height(child) else flex_h
        laid_out_child = layout_node(child, x, cursor_y, w, child_h, glyph_w, glyph_h)
        laid_out.append(laid_out_child)
        cursor_y += child_h
    node['children'] = laid_out
    return node



def layout_hbox(node: dict[str, Any], x: int, y: int, w: int, h: int,
                glyph_w: int, glyph_h: int) -> dict[str, Any]:
    children = list(node.get('children', []))
    laid_out = []

    if isinstance(node.get('split'), int):
        split_w = int(node['split'])
        right_w = clamp_non_negative(w - split_w - 1)
        if len(children) != 2:
            raise CompileError('hbox with split requires exactly 2 children')
        laid_out.append(layout_node(children[0], x, y, split_w, h, glyph_w, glyph_h))
        laid_out.append(layout_node(children[1], x + split_w + 1, y, right_w, h, glyph_w, glyph_h))
        node['children'] = laid_out
        return node

    fixed_total = 0
    flex_count = 0
    for child in children:
        if _has_explicit_width(child):
            fixed_total += int(child['w'])
        elif _is_spacer(child):
            flex_count += 1
        else:
            fixed_total += intrinsic_width(child, glyph_w)
    remaining = clamp_non_negative(w - fixed_total)
    flex_w = remaining // flex_count if flex_count > 0 else 0
    cursor_x = x
    for child in children:
        if _is_spacer(child):
            child_w = flex_w
        elif _has_explicit_width(child):
            child_w = int(child['w'])
        else:
            child_w = intrinsic_width(child, glyph_w)
        laid_out_child = layout_node(child, cursor_x, y, child_w, h, glyph_w, glyph_h)
        laid_out.append(laid_out_child)
        cursor_x += child_w
    node['children'] = laid_out
    return node



def _intrinsic_fixed_size(child: dict[str, Any], parent_w: int, parent_h: int,
                          glyph_w: int, glyph_h: int) -> tuple[int, int]:
    child_type = child['type']
    if child_type == 'label':
        size = max(1, int(child.get('size', 1) or 1))
        return text_width(child, glyph_w), glyph_h * size
    if child_type == 'sep':
        return parent_w - int(child.get('x', 0)), 1
    if child_type == 'btn':
        return intrinsic_width(child, glyph_w), glyph_h + 4
    if child_type == 'bar':
        return parent_w - int(child.get('x', 0)), max(1, int(child.get('h', 3) or 3))
    if child_type == 'fill':
        return parent_w - int(child.get('x', 0)), parent_h - int(child.get('y', 0))
    if child_type == 'list':
        return parent_w - int(child.get('x', 0)), parent_h - int(child.get('y', 0))
    return parent_w - int(child.get('x', 0)), parent_h - int(child.get('y', 0))



def _layout_fixed_child(child: dict[str, Any], x: int, y: int, w: int, h: int,
                        glyph_w: int, glyph_h: int) -> dict[str, Any]:
    child_type = child['type']
    if child_type == 'circle' and all(k in child for k in ('cx', 'cy', 'r')):
        cx = x + int(child['cx'])
        cy = y + int(child['cy'])
        r = int(child['r'])
        laid_out = layout_leaf(child, cx - r, cy - r, 2 * r + 1, 2 * r + 1, glyph_w, glyph_h)
        laid_out['_abs_cx'] = cx
        laid_out['_abs_cy'] = cy
        return laid_out
    if child_type == 'cross' and all(k in child for k in ('cx', 'cy', 'len')):
        cx = x + int(child['cx'])
        cy = y + int(child['cy'])
        length = int(child['len'])
        laid_out = layout_leaf(child, cx - length, cy - length, 2 * length + 1, 2 * length + 1, glyph_w, glyph_h)
        laid_out['_abs_cx'] = cx
        laid_out['_abs_cy'] = cy
        return laid_out

    child_x = x + int(child.get('x', 0))
    child_y = y + int(child.get('y', 0))
    intrinsic_w, intrinsic_h = _intrinsic_fixed_size(child, w, h, glyph_w, glyph_h)
    child_w = int(child.get('w', 0)) or clamp_non_negative(intrinsic_w)
    child_h = int(child.get('h', 0)) or clamp_non_negative(intrinsic_h)
    return layout_node(child, child_x, child_y, child_w, child_h, glyph_w, glyph_h)



def layout_fixed(node: dict[str, Any], x: int, y: int, w: int, h: int,
                 glyph_w: int, glyph_h: int) -> dict[str, Any]:
    laid_out = []
    for child in node.get('children', []):
        laid_out.append(_layout_fixed_child(child, x, y, w, h, glyph_w, glyph_h))
    node['children'] = laid_out
    return node



def layout_leaf(node: dict[str, Any], x: int, y: int, w: int, h: int,
                glyph_w: int, glyph_h: int) -> dict[str, Any]:
    node = dict(node)
    node['rect'] = Rect(x, y, max(0, int(w)), max(0, int(h)))
    node_type = node['type']
    if node_type == 'label':
        size = max(1, int(node.get('size', 1) or 1))
        max_chars = 0 if w <= 0 else w // (glyph_w * size)
        node['max_visible_chars'] = max_chars
    elif node_type == 'list':
        row_h = int(node.get('row_h', 14))
        max_items = int(node.get('max_items', len(node.get('data', []) or [])))
        visible_rows = 0 if row_h <= 0 else min(max_items, h // row_h)
        node['visible_rows'] = visible_rows
    elif node_type == 'grid':
        cols = int(node.get('cols', 1) or 1)
        cell_w = int(node.get('cell_w', 0)) or (w // cols if cols > 0 else w)
        cell_h = int(node.get('cell_h', 16) or 16)
        visible_rows = 0 if cell_h <= 0 else h // cell_h
        node['cell_w'] = cell_w
        node['cell_h'] = cell_h
        node['visible_rows'] = visible_rows
    return node
