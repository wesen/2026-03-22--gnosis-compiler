import unittest

from gnosis_compiler import Compiler, disassemble_code
from gnosis_compiler.dsl import prepare_source


class CompilerTests(unittest.TestCase):
    def test_props_are_resolved(self):
        source = {
            'type': 'screen',
            'bar': {'type': 'fixed', 'h': 0, 'children': []},
            'body': {
                'type': 'fixed',
                'children': [
                    {'type': 'label', 'x': 0, 'y': 0, 'text': '{{title}}'},
                    {'type': 'list', 'x': 0, 'y': 16, 'w': 100, 'h': 32, 'data': {'$prop': 'items'}},
                ],
            },
            'nav': {'type': 'fixed', 'h': 0, 'children': []},
        }
        prepared = prepare_source(source, {'title': 'HELLO', 'items': ['A', 'B']})
        label = prepared['body']['children'][0]
        rows = prepared['body']['children'][1]['data']
        self.assertEqual(label['text'], 'HELLO')
        self.assertEqual(rows, ['A', 'B'])

    def test_conditional_nodes_are_removed(self):
        source = {
            'type': 'screen',
            'bar': {'type': 'fixed', 'h': 0, 'children': []},
            'body': {
                'type': 'vbox',
                'children': [
                    {'type': 'cond', 'when': False, 'child': {'type': 'label', 'text': 'NOPE'}},
                    {'type': 'cond', 'when': True, 'child': {'type': 'label', 'text': 'OK'}},
                ],
            },
            'nav': {'type': 'fixed', 'h': 0, 'children': []},
        }
        program = Compiler().compile(source)
        asm = disassemble_code(program.code, program.strings, program.binds)
        self.assertIn("'OK'", asm)
        self.assertNotIn("'NOPE'", asm)

    def test_dynamic_bindings_produce_regions(self):
        source = {
            'type': 'screen',
            'bar': {'type': 'fixed', 'h': 0, 'children': []},
            'body': {
                'type': 'fixed',
                'children': [
                    {'type': 'label', 'x': 0, 'y': 0, 'bind': 'clock.time', 'field_w': 5},
                    {'type': 'bar', 'x': 0, 'y': 16, 'w': 100, 'h': 4, 'bind': 'battery.pct', 'max': 100},
                ],
            },
            'nav': {'type': 'fixed', 'h': 0, 'children': []},
        }
        program = Compiler().compile(source)
        self.assertEqual(program.binds, ['clock.time', 'battery.pct'])
        self.assertEqual(len(program.regions), 2)
        asm = disassemble_code(program.code, program.strings, program.binds)
        self.assertIn('BIND_TEXT', asm)
        self.assertIn('BIND_BAR', asm)


if __name__ == '__main__':
    unittest.main()
