import type { CompileResponse } from '../types/api';

/** A minimal but realistic compile result for Storybook stories */
export const MOCK_COMPILE_RESULT: CompileResponse = {
  success: true,
  program: {
    stats: {
      screen: { width: 400, height: 300 },
      input_nodes: 5,
      final_nodes: 4,
      static_nodes: 3,
      dynamic_nodes: 1,
      code_size: 42,
      string_count: 2,
      bind_count: 1,
      region_count: 1,
      passes: [
        { name: 'optimize', before: 5, after: 4 },
        { name: 'layout', before: 4, after: 4 },
      ],
    },
    binds: ['sensor.temperature'],
    strings: ['Hello', 'GNOSIS'],
    regions: [
      {
        rect: { x: 10, y: 50, w: 200, h: 30 },
        waveform: 'fast',
        bind_names: ['sensor.temperature'],
      },
    ],
    code_size: 42,
  },
  disassembly: [
    '0000: FILL_RECT  0,0 400x300 col=0',
    '0009: TEXT       10,10 size=1 col=1 max=20 sid=1',
    '0014: BIND_TEXT  10,50 size=1 col=1 max=10 bid=0',
    '001c: HLINE      0,80 w=400 col=2',
    '0023: FILL_RECT  10,90 180x20 col=3',
    '002a: HALT',
  ].join('\n'),
  // Minimal bytecode: FILL_RECT(0,0,400,300,col=0) + HALT
  bytecode_base64: btoa(
    String.fromCharCode(
      0x03, 0, 0, 0, 0, 0x90, 0x01, 0x2c, 0x01, 0,
      0xff,
    ),
  ),
  stages: {
    laid_out: {
      type: 'screen',
      rect: { x: 0, y: 0, w: 400, h: 300 },
      children: [
        {
          type: 'label',
          rect: { x: 10, y: 10, w: 100, h: 14 },
          text: 'GNOSIS',
          _static: true,
        },
        {
          type: 'label',
          rect: { x: 10, y: 50, w: 200, h: 14 },
          bind: 'sensor.temperature',
        },
        {
          type: 'separator',
          rect: { x: 0, y: 80, w: 400, h: 1 },
          _static: true,
        },
      ],
    },
  },
};
