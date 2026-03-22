from __future__ import annotations

import copy
import re
from dataclasses import dataclass
from typing import Any, Iterable


@dataclass(frozen=True)
class Rect:
    x: int
    y: int
    w: int
    h: int

    def area(self) -> int:
        return max(0, self.w) * max(0, self.h)

    def union(self, other: 'Rect') -> 'Rect':
        x1 = min(self.x, other.x)
        y1 = min(self.y, other.y)
        x2 = max(self.x + self.w, other.x + other.w)
        y2 = max(self.y + self.h, other.y + other.h)
        return Rect(x1, y1, x2 - x1, y2 - y1)

    def intersects(self, other: 'Rect') -> bool:
        return not (
            self.x + self.w <= other.x or
            other.x + other.w <= self.x or
            self.y + self.h <= other.y or
            other.y + other.h <= self.y
        )


_INTERP_RE = re.compile(r"{{\s*([a-zA-Z0-9_\.\[\]-]+)\s*}}")


def deep_clone(value: Any) -> Any:
    return copy.deepcopy(value)


def flatten_once(values: Iterable[Any]) -> list[Any]:
    out: list[Any] = []
    for value in values:
        if isinstance(value, list):
            out.extend(value)
        else:
            out.append(value)
    return out


def is_primitive(value: Any) -> bool:
    return value is None or isinstance(value, (str, int, float, bool))


def _tokenize_path(path: str) -> list[str]:
    tokens: list[str] = []
    current = []
    i = 0
    while i < len(path):
        ch = path[i]
        if ch == '.':
            if current:
                tokens.append(''.join(current))
                current = []
            i += 1
            continue
        if ch == '[':
            if current:
                tokens.append(''.join(current))
                current = []
            j = path.find(']', i)
            if j == -1:
                raise KeyError(f'Unclosed bracket in prop path: {path!r}')
            tokens.append(path[i + 1:j])
            i = j + 1
            continue
        current.append(ch)
        i += 1
    if current:
        tokens.append(''.join(current))
    return tokens


def lookup_path(obj: Any, path: str) -> Any:
    current = obj
    for token in _tokenize_path(path):
        if isinstance(current, dict):
            if token not in current:
                raise KeyError(path)
            current = current[token]
        elif isinstance(current, list):
            index = int(token)
            current = current[index]
        else:
            raise KeyError(path)
    return current


def interpolate_string(template: str, props: dict[str, Any]) -> Any:
    matches = list(_INTERP_RE.finditer(template))
    if not matches:
        return template
    if len(matches) == 1 and matches[0].span() == (0, len(template)):
        value = lookup_path(props, matches[0].group(1))
        return deep_clone(value)

    def replace(match: re.Match[str]) -> str:
        value = lookup_path(props, match.group(1))
        if isinstance(value, (dict, list)):
            raise TypeError(
                f'Cannot interpolate non-scalar prop {match.group(1)!r} inside a larger string'
            )
        return '' if value is None else str(value)

    return _INTERP_RE.sub(replace, template)


def clamp_non_negative(value: int) -> int:
    return 0 if value < 0 else value
