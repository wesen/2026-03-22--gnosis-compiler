"""GNOSIS Compiler Web UI — Python server.

Serves a browser-based experimentation tool for the GNOSIS layout compiler.
Exposes /api/compile, /api/presets, and serves the frontend from web/.
"""
from __future__ import annotations

import base64
import json
import traceback
from dataclasses import asdict
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_from_directory

import yaml

from gnosis_compiler import Compiler, CompileOptions, disassemble_code
from gnosis_compiler.util import Rect

app = Flask(__name__, static_folder=None)

PROJECT_ROOT = Path(__file__).resolve().parent
EXAMPLES_DIR = PROJECT_ROOT / 'examples'
WEB_DIR = PROJECT_ROOT / 'web'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_json_safe(obj: Any) -> Any:
    """Recursively convert an AST dict so it's JSON-serializable."""
    if isinstance(obj, Rect):
        return {'x': obj.x, 'y': obj.y, 'w': obj.w, 'h': obj.h}
    if isinstance(obj, bytes):
        return base64.b64encode(obj).decode()
    if isinstance(obj, dict):
        return {k: _make_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_make_json_safe(v) for v in obj]
    return obj


# ---------------------------------------------------------------------------
# Presets
# ---------------------------------------------------------------------------

def _load_presets() -> dict[str, dict[str, Any]]:
    presets: dict[str, dict[str, Any]] = {}
    for yaml_file in sorted(EXAMPLES_DIR.glob('*.yaml')):
        if yaml_file.stem.endswith('.props'):
            continue
        name = yaml_file.stem
        source = yaml_file.read_text(encoding='utf-8')
        props_file = yaml_file.with_suffix('').with_suffix('.props.yaml')
        props = props_file.read_text(encoding='utf-8') if props_file.exists() else ''
        presets[name] = {
            'name': name,
            'description': name.replace('-', ' ').replace('_', ' ').title(),
            'source': source,
            'props': props,
        }
    return presets

PRESETS = _load_presets()


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------

@app.route('/api/compile', methods=['POST'])
def api_compile():
    try:
        body = request.get_json(force=True)
    except Exception:
        return jsonify({'success': False, 'error': 'Invalid JSON body'}), 400

    source_text = body.get('source', '')
    props_text = body.get('props', '')
    options_raw = body.get('options', {})

    if not source_text.strip():
        return jsonify({'success': False, 'error': 'source is required'}), 400

    try:
        opts = CompileOptions(
            width=int(options_raw.get('width', 400)),
            height=int(options_raw.get('height', 300)),
            glyph_w=int(options_raw.get('glyph_w', 8)),
            glyph_h=int(options_raw.get('glyph_h', 8)),
            region_merge_threshold=int(options_raw.get('region_merge_threshold', 512)),
        )

        compiler = Compiler(opts)

        # Parse YAML/JSON strings directly (avoid load_source file-path detection)
        source_obj = yaml.safe_load(source_text)
        props = yaml.safe_load(props_text) if props_text.strip() else None

        program, stages = compiler.compile_with_stages(source_obj, props)

        disasm = disassemble_code(program.code, program.strings, program.binds)

        result = {
            'success': True,
            'stages': _make_json_safe(stages),
            'program': _make_json_safe(program.to_manifest()),
            'disassembly': disasm,
            'bytecode_base64': base64.b64encode(program.code).decode(),
            'binary_base64': base64.b64encode(program.binary).decode() if program.binary else None,
        }
        return jsonify(result)

    except Exception as exc:
        return jsonify({
            'success': False,
            'error': str(exc),
            'traceback': traceback.format_exc(),
        }), 400


@app.route('/api/presets', methods=['GET'])
def api_presets():
    listing = [
        {'name': p['name'], 'description': p['description']}
        for p in PRESETS.values()
    ]
    return jsonify({'presets': listing})


@app.route('/api/presets/<name>', methods=['GET'])
def api_preset(name: str):
    preset = PRESETS.get(name)
    if preset is None:
        return jsonify({'error': f'Preset not found: {name}'}), 404
    return jsonify(preset)


@app.route('/api/options', methods=['GET'])
def api_options():
    from gnosis_compiler.constants import (
        COLOR_NAMES, NODE_TYPES, WAVEFORM_NAMES,
        Color, Opcode, Waveform,
    )
    return jsonify({
        'defaults': asdict(CompileOptions()),
        'node_types': sorted(NODE_TYPES),
        'color_names': {int(k): v for k, v in COLOR_NAMES.items()},
        'waveform_names': {int(k): v for k, v in WAVEFORM_NAMES.items()},
        'opcodes': {int(op): op.name for op in Opcode},
    })


# ---------------------------------------------------------------------------
# Frontend static files
# ---------------------------------------------------------------------------

DIST_DIR = WEB_DIR / 'dist'


@app.route('/')
def index():
    # Serve React build if available, otherwise original index.html
    if (DIST_DIR / 'app.html').is_file():
        return send_from_directory(DIST_DIR, 'app.html')
    return send_from_directory(WEB_DIR, 'index.html')


@app.route('/legacy')
def legacy():
    """Original vanilla JS frontend (preserved for comparison)."""
    return send_from_directory(WEB_DIR, 'index.html')


@app.route('/<path:path>')
def static_files(path: str):
    # Serve from dist/ first (React build assets), then web/ (legacy)
    dist_file = DIST_DIR / path
    if dist_file.is_file():
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(WEB_DIR, path)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='GNOSIS Compiler Web UI')
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--debug', action='store_true')
    args = parser.parse_args()

    print(f'Starting GNOSIS Compiler Web UI at http://{args.host}:{args.port}')
    print(f'Presets loaded: {list(PRESETS.keys())}')
    app.run(host=args.host, port=args.port, debug=args.debug)
