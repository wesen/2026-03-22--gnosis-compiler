from __future__ import annotations

from typing import Any

from .util import deep_clone



def _node_visible(node: dict[str, Any]) -> bool:
    visible = node.get('visible', True)
    if visible is None:
        return False
    return bool(visible)



def eliminate_dead_nodes(node: dict[str, Any]) -> dict[str, Any] | None:
    if not _node_visible(node):
        return None

    node = deep_clone(node)
    children: list[dict[str, Any]] = []
    for child in node.get('children', []):
        reduced = eliminate_dead_nodes(child)
        if reduced is None:
            continue
        if isinstance(reduced, list):
            children.extend(reduced)
        else:
            children.append(reduced)
    node['children'] = children

    if node['type'] == 'cond':
        when = bool(node.get('when', True))
        if not when:
            return None
        return children

    return node



def flatten_boxes(node: dict[str, Any]) -> dict[str, Any]:
    node = deep_clone(node)
    children = [flatten_boxes(child) for child in node.get('children', [])]
    node['children'] = children

    if node['type'] == 'vbox':
        flattened: list[dict[str, Any]] = []
        for child in children:
            if (
                child['type'] == 'vbox'
                and not child.get('h')
                and not child.get('border_t')
                and not child.get('border_b')
            ):
                flattened.extend(child.get('children', []))
            else:
                flattened.append(child)
        node['children'] = flattened
    elif node['type'] == 'hbox':
        flattened = []
        for child in children:
            if (
                child['type'] == 'hbox'
                and not child.get('w')
                and not child.get('split')
                and not child.get('border_t')
                and not child.get('border_b')
            ):
                flattened.extend(child.get('children', []))
            else:
                flattened.append(child)
        node['children'] = flattened

    return node



def assign_ids(node: dict[str, Any], prefix: str = 'n', counter: list[int] | None = None) -> dict[str, Any]:
    if counter is None:
        counter = [0]

    node = deep_clone(node)
    counter[0] += 1
    node.setdefault('id', f'{prefix}{counter[0]}')
    node['children'] = [assign_ids(child, prefix, counter) for child in node.get('children', [])]
    return node



def mark_static(node: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    node = deep_clone(node)
    dynamic_here = bool(node.get('bind'))
    new_children = []
    subtree_dynamic = dynamic_here
    for child in node.get('children', []):
        marked, child_dynamic = mark_static(child)
        new_children.append(marked)
        subtree_dynamic = subtree_dynamic or child_dynamic
    node['children'] = new_children
    node['_static'] = not subtree_dynamic
    return node, subtree_dynamic



def count_nodes(node: dict[str, Any]) -> int:
    return 1 + sum(count_nodes(child) for child in node.get('children', []))



def count_dynamic_nodes(node: dict[str, Any]) -> int:
    here = 0 if node.get('_static', False) else 1
    return here + sum(count_dynamic_nodes(child) for child in node.get('children', []))
