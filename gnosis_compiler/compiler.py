from __future__ import annotations

import copy
from dataclasses import asdict, dataclass
from typing import Any

from .dsl import load_source, normalize_screen, prepare_source, resolve_props
from .layout import layout_screen
from .lower import lower_screen, merge_regions
from .model import CompileOptions, Program
from .passes import assign_ids, count_dynamic_nodes, count_nodes, eliminate_dead_nodes, flatten_boxes, mark_static
from .serialize import serialize_program


class Compiler:
    def __init__(self, options: CompileOptions | None = None) -> None:
        self.options = options or CompileOptions()

    def compile_with_stages(self, source: Any, props: dict[str, Any] | None = None) -> tuple[Program, dict[str, Any]]:
        """Compile and return (program, stages) where stages captures each intermediate AST."""
        stages: dict[str, Any] = {}

        loaded = load_source(source)
        stages['parsed'] = copy.deepcopy(loaded)

        if props is not None and not isinstance(props, dict):
            props = load_source(props)
        resolved = resolve_props(loaded, props)
        stages['resolved'] = copy.deepcopy(resolved)

        canonical = normalize_screen(resolved)
        stages['canonical'] = copy.deepcopy(canonical)

        program = self._compile_from_canonical(canonical, stages)
        return program, stages

    def compile(self, source: Any, props: dict[str, Any] | None = None) -> Program:
        prepared = prepare_source(source, props)
        return self._compile_from_canonical(prepared)

    def _compile_from_canonical(self, prepared: dict[str, Any],
                                 stages: dict[str, Any] | None = None) -> Program:
        stats: dict[str, Any] = {
            'passes': [],
        }

        before_nodes = self._count_screen_nodes(prepared)
        stats['input_nodes'] = before_nodes

        prepared = self._apply_screen_pass(prepared, eliminate_dead_nodes)
        after_dead = self._count_screen_nodes(prepared)
        stats['passes'].append({'name': 'dead_node_elimination', 'before': before_nodes, 'after': after_dead})
        if stages is not None:
            stages['after_dead_elimination'] = copy.deepcopy(prepared)

        flattened_once = self._apply_screen_pass(prepared, flatten_boxes)
        after_flatten = self._count_screen_nodes(flattened_once)
        stats['passes'].append({'name': 'flatten_boxes', 'before': after_dead, 'after': after_flatten})

        flattened_twice = self._apply_screen_pass(flattened_once, flatten_boxes)
        after_second_flatten = self._count_screen_nodes(flattened_twice)
        stats['passes'].append({'name': 'flatten_boxes_fixed_point', 'before': after_flatten, 'after': after_second_flatten})
        if stages is not None:
            stages['after_flatten'] = copy.deepcopy(flattened_twice)

        prepared = self._apply_screen_pass(flattened_twice, assign_ids)
        prepared = self._apply_screen_mark_static(prepared)
        if stages is not None:
            stages['after_classify'] = copy.deepcopy(prepared)

        width = int(prepared.get('width') or self.options.width)
        height = int(prepared.get('height') or self.options.height)
        laid_out = layout_screen(prepared, width, height, self.options.glyph_w, self.options.glyph_h)
        if stages is not None:
            stages['laid_out'] = copy.deepcopy(laid_out)

        code, strings, binds, bind_sites = lower_screen(laid_out)
        regions = merge_regions(bind_sites, self.options.region_merge_threshold)

        stats['final_nodes'] = self._count_screen_nodes(laid_out)
        stats['dynamic_nodes'] = self._count_screen_dynamic_nodes(laid_out)
        stats['static_nodes'] = stats['final_nodes'] - stats['dynamic_nodes']
        stats['bind_count'] = len(binds)
        stats['string_count'] = len(strings)
        stats['code_size'] = len(code)
        stats['region_count'] = len(regions)
        stats['screen'] = {'width': width, 'height': height}

        program = Program(
            width=width,
            height=height,
            code=code,
            strings=strings,
            binds=binds,
            bind_sites=bind_sites,
            regions=regions,
            stats=stats,
            ast=laid_out,
        )
        program.binary = serialize_program(program)
        return program

    @staticmethod
    def _normalize_section(section: dict[str, Any] | None) -> dict[str, Any]:
        if section is None:
            return {'type': 'fixed', 'h': 0, 'children': []}
        return section

    def _apply_screen_pass(self, screen: dict[str, Any], fn):
        updated = dict(screen)
        for name in ('bar', 'body', 'nav'):
            result = fn(screen[name])
            if result is None:
                updated[name] = {'type': 'fixed', 'h': screen[name].get('h', 0), 'children': []}
            elif isinstance(result, list):
                updated[name] = {'type': 'fixed', 'h': screen[name].get('h', 0), 'children': result}
            else:
                updated[name] = result
                if name in {'bar', 'nav'} and 'h' not in updated[name]:
                    updated[name]['h'] = screen[name].get('h', 0)
        updated['width'] = screen.get('width')
        updated['height'] = screen.get('height')
        updated['type'] = 'screen'
        return updated

    def _apply_screen_mark_static(self, screen: dict[str, Any]) -> dict[str, Any]:
        updated = dict(screen)
        for name in ('bar', 'body', 'nav'):
            marked, _ = mark_static(screen[name])
            updated[name] = marked
        updated['width'] = screen.get('width')
        updated['height'] = screen.get('height')
        updated['type'] = 'screen'
        return updated

    @staticmethod
    def _count_screen_nodes(screen: dict[str, Any]) -> int:
        return sum(count_nodes(screen[name]) for name in ('bar', 'body', 'nav'))

    @staticmethod
    def _count_screen_dynamic_nodes(screen: dict[str, Any]) -> int:
        return sum(count_dynamic_nodes(screen[name]) for name in ('bar', 'body', 'nav'))


__all__ = ['Compiler', 'CompileOptions', 'Program']
