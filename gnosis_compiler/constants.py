from __future__ import annotations

from enum import IntEnum


class Opcode(IntEnum):
    NOP = 0x00
    HLINE = 0x01
    VLINE = 0x02
    FILL_RECT = 0x03
    STROKE_RECT = 0x04
    TEXT = 0x10
    BIND_TEXT = 0x11
    BAR = 0x12
    BIND_BAR = 0x13
    CIRCLE = 0x14
    CROSS = 0x15
    HALT = 0xFF


class Waveform(IntEnum):
    FULL = 0
    PART = 1
    FAST = 2


class Color(IntEnum):
    BG = 0
    FG = 1
    MID = 2
    LIGHT = 3
    GHOST = 4


COLOR_NAMES = {
    Color.BG: 'bg',
    Color.FG: 'fg',
    Color.MID: 'mid',
    Color.LIGHT: 'light',
    Color.GHOST: 'ghost',
}

WAVEFORM_NAMES = {
    Waveform.FULL: 'full',
    Waveform.PART: 'part',
    Waveform.FAST: 'fast',
}

DEFAULT_GLYPH_W = 8
DEFAULT_GLYPH_H = 8

SCREEN_DEFAULT_WIDTH = 400
SCREEN_DEFAULT_HEIGHT = 300

NODE_TYPES = {
    'screen', 'vbox', 'hbox', 'fixed', 'label', 'bar', 'list', 'grid', 'circle',
    'cross', 'sep', 'btn', 'cond', 'spacer', 'fill'
}
