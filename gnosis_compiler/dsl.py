from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml

from .constants import NODE_TYPES
from .errors import CompileError
from .util import deep_clone, flatten_once, interpolate_string


JSON_LIKE_PREFIXES = ('{', '[', '"')


def load_source(source: Any) -> Any:
    if isinstance(source, (dict, list)):
        return deep_clone(source)
    if isinstance(source, Path):
        source = str(source)
    if not isinstance(source, str):
        raise TypeError(f'Unsupported source type: {type(source)!r}')

    candidate = Path(source)
    if candidate.exists():
        text = candidate.read_text(encoding='utf-8')
        suffix = candidate.suffix.lower()
        if suffix in {'.yaml', '.yml'}:
            return yaml.safe_load(text)
        if suffix == '.json':
            return json.loads(text)
        try:
            return yaml.safe_load(text)
        except Exception:
            return json.loads(text)

    stripped = source.lstrip()
    if stripped.startswith(JSON_LIKE_PREFIXES):
        return json.loads(source)
    return yaml.safe_load(source)



def resolve_props(value: Any, props: dict[str, Any] | None) -> Any:
    props = props or {}

    def _resolve(current: Any) -> Any:
        if isinstance(current, dict):
            if set(current.keys()) == {'$prop'}:
                try:
                    from .util import lookup_path
                    return deep_clone(lookup_path(props, str(current['$prop'])))
                except KeyError as exc:
                    raise CompileError(f'Missing prop: {current["$prop"]!r}') from exc
            resolved = {}
            for key, val in current.items():
                resolved[key] = _resolve(val)
            return resolved
        if isinstance(current, list):
            values = []
            for item in current:
                resolved_item = _resolve(item)
                if isinstance(resolved_item, list):
                    values.extend(resolved_item)
                else:
                    values.append(resolved_item)
            return values
        if isinstance(current, str):
            try:
                return interpolate_string(current, props)
            except KeyError as exc:
                raise CompileError(f'Missing prop: {exc.args[0]!r}') from exc
            except TypeError as exc:
                raise CompileError(str(exc)) from exc
        return current

    return _resolve(value)



def _normalize_children(raw: Any) -> list[dict[str, Any]]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raw = [raw]
    out: list[dict[str, Any]] = []
    for item in flatten_once(raw):
        if item is None:
            continue
        if not isinstance(item, dict):
            raise CompileError(f'Child nodes must be mappings, got {type(item)!r}')
        out.append(item)
    return out



def _normalize_type(node: dict[str, Any]) -> str:
    if 'type' not in node:
        if node.get('layout') in {'vbox', 'hbox'}:
            node['type'] = node['layout']
        elif node.get('spacer'):
            node['type'] = 'spacer'
        elif 'label' in node or 'content' in node or 'text' in node:
            node['type'] = 'label'
        else:
            raise CompileError(f'Node is missing a type: {node!r}')
    node_type = str(node['type']).lower()
    if node_type not in NODE_TYPES:
        raise CompileError(f'Unsupported node type: {node_type!r}')
    return node_type



def _canonicalize_node(node: dict[str, Any]) -> dict[str, Any]:
    current = deep_clone(node)
    node_type = _normalize_type(current)
    current['type'] = node_type

    if 'items' in current and 'children' not in current:
        current['children'] = current.pop('items')

    if node_type == 'label':
        if 'text' not in current:
            if 'label' in current:
                current['text'] = current.pop('label')
            elif 'content' in current:
                current['text'] = current.pop('content')
        if 'text' not in current and 'bind' not in current:
            current['text'] = ''

    if node_type == 'list':
        current.setdefault('row_h', 14)
        if 'max_items' not in current and 'max' in current:
            current['max_items'] = current['max']

    if node_type == 'bar':
        if 'max' not in current:
            raise CompileError('bar nodes require a max value')

    if node_type == 'cond':
        if 'children' not in current and 'child' in current:
            current['children'] = [current.pop('child')]
        current['children'] = _normalize_children(current.get('children'))
        if not current['children']:
            raise CompileError('cond nodes require a child or children field')
    elif node_type in {'vbox', 'hbox', 'fixed', 'btn'}:
        current['children'] = _normalize_children(current.get('children'))
    else:
        current['children'] = _normalize_children(current.get('children'))

    if 'color' in current and isinstance(current['color'], str):
        current['color'] = current['color'].lower()
    if 'fill_color' in current and isinstance(current['fill_color'], str):
        current['fill_color'] = current['fill_color'].lower()
    if 'stroke_color' in current and isinstance(current['stroke_color'], str):
        current['stroke_color'] = current['stroke_color'].lower()
    if 'waveform' in current and isinstance(current['waveform'], str):
        current['waveform'] = current['waveform'].lower()

    children = current.get('children', [])
    current['children'] = [_canonicalize_node(child) for child in children]
    return current



def normalize_screen(source_ast: Any) -> dict[str, Any]:
    if not isinstance(source_ast, dict):
        raise CompileError('Top-level source must be a mapping')

    root = _canonicalize_node(source_ast)
    if root['type'] != 'screen':
        root = {
            'type': 'screen',
            'bar': {'type': 'fixed', 'h': 0, 'children': []},
            'body': root,
            'nav': {'type': 'fixed', 'h': 0, 'children': []},
        }
    else:
        if 'bar' not in root:
            root['bar'] = {'type': 'fixed', 'h': 0, 'children': []}
        if 'body' not in root:
            raise CompileError('screen nodes require a body field')
        if 'nav' not in root:
            root['nav'] = {'type': 'fixed', 'h': 0, 'children': []}
        root['bar'] = _canonicalize_node(root['bar'])
        root['body'] = _canonicalize_node(root['body'])
        root['nav'] = _canonicalize_node(root['nav'])

    for section_name in ('bar', 'nav'):
        section = root[section_name]
        section.setdefault('h', 0)
        if not isinstance(section.get('h'), int):
            raise CompileError(f'screen.{section_name}.h must be an integer')

    root.setdefault('width', None)
    root.setdefault('height', None)
    return root



def prepare_source(source: Any, props: dict[str, Any] | str | Path | None = None) -> dict[str, Any]:
    loaded = load_source(source)
    if props is None:
        props_obj: dict[str, Any] | None = None
    elif isinstance(props, dict):
        props_obj = props
    else:
        loaded_props = load_source(props)
        if not isinstance(loaded_props, dict):
            raise CompileError('Props source must evaluate to a mapping')
        props_obj = loaded_props
    resolved = resolve_props(loaded, props_obj)
    return normalize_screen(resolved)
