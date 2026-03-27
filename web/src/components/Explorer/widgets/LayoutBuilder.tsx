import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

// ── Constants ───────────────────────────────────────────────────────────────

const CANVAS_W = 280;
const CANVAS_H = 120;
const SCALE = 2;
const PALETTE = ['#d8d4cc', '#2a2826', '#7a7668', '#b0aa9e', '#e0dcd4'];
const GLYPH_W = 8;
const GLYPH_H = 8;

// ── Types ───────────────────────────────────────────────────────────────────

interface LayoutElement {
  id: number;
  type: 'label' | 'bar' | 'hline';
  x: number;
  y: number;
  text?: string;
  value?: number;
  max?: number;
  w?: number;
  h?: number;
  size?: number;
}

// ── Mini YAML generator ─────────────────────────────────────────────────────

function toYaml(elements: LayoutElement[]): string {
  const lines = [
    'type: screen',
    `width: ${CANVAS_W}`,
    `height: ${CANVAS_H}`,
    'body:',
    '  type: fixed',
    '  children:',
  ];
  for (const el of elements) {
    switch (el.type) {
      case 'label':
        lines.push(`    - type: label`);
        lines.push(`      text: "${el.text ?? 'Hello'}"`);
        lines.push(`      x: ${el.x}`);
        lines.push(`      y: ${el.y}`);
        if (el.size && el.size !== 1) lines.push(`      size: ${el.size}`);
        break;
      case 'bar':
        lines.push(`    - type: bar`);
        lines.push(`      x: ${el.x}`);
        lines.push(`      y: ${el.y}`);
        lines.push(`      w: ${el.w ?? 100}`);
        lines.push(`      h: ${el.h ?? 6}`);
        lines.push(`      value: ${el.value ?? 50}`);
        lines.push(`      max: ${el.max ?? 100}`);
        break;
      case 'hline':
        lines.push(`    - type: sep`);
        lines.push(`      x: ${el.x}`);
        lines.push(`      y: ${el.y}`);
        lines.push(`      w: ${el.w ?? 200}`);
        break;
    }
  }
  return lines.join('\n');
}

// ── Mini bytecode instruction generator ──────────────────────────────────

function toInstructions(elements: LayoutElement[]): string[] {
  const instrs: string[] = [];
  let pc = 0;
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]!;
    const node = i + 1; // node 0 is root
    switch (el.type) {
      case 'label': {
        const sz = el.size ?? 1;
        instrs.push(`${pc.toString(16).padStart(4, '0')}  DRAW_TEXT_CONST  node=${node} "${el.text ?? 'Hello'}" size=${sz}`);
        pc += 7;
        break;
      }
      case 'bar': {
        const val = el.value ?? 50;
        const max = el.max ?? 100;
        instrs.push(`${pc.toString(16).padStart(4, '0')}  DRAW_BAR_CONST   node=${node} val=${val} max=${max}`);
        pc += 9;
        break;
      }
      case 'hline':
        instrs.push(`${pc.toString(16).padStart(4, '0')}  DRAW_HLINE       node=${node}`);
        pc += 4;
        break;
    }
  }
  instrs.push(`${pc.toString(16).padStart(4, '0')}  HALT`);
  return instrs;
}

// ── Canvas renderer ─────────────────────────────────────────────────────────

function renderElements(canvas: HTMLCanvasElement, elements: LayoutElement[], selectedId: number | null) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = CANVAS_W * SCALE;
  canvas.height = CANVAS_H * SCALE;
  ctx.save();
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = PALETTE[0]!;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  for (const el of elements) {
    const isSelected = el.id === selectedId;
    switch (el.type) {
      case 'label': {
        const sz = el.size ?? 1;
        const text = el.text ?? 'Hello';
        ctx.fillStyle = PALETTE[1]!;
        ctx.font = `${GLYPH_H * sz}px monospace`;
        ctx.textBaseline = 'top';
        ctx.fillText(text, el.x, el.y);
        if (isSelected) {
          const tw = text.length * GLYPH_W * sz;
          const th = GLYPH_H * sz;
          ctx.strokeStyle = 'rgba(138, 134, 112, 0.8)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(el.x - 1, el.y - 1, tw + 2, th + 2);
          ctx.setLineDash([]);
        }
        break;
      }
      case 'bar': {
        const w = el.w ?? 100;
        const h = el.h ?? 6;
        const val = el.value ?? 50;
        const max = el.max ?? 100;
        const fillW = Math.trunc(w * val / max);
        ctx.fillStyle = PALETTE[3]!;
        ctx.fillRect(el.x, el.y, w, h);
        ctx.fillStyle = PALETTE[2]!;
        ctx.fillRect(el.x, el.y, fillW, h);
        if (isSelected) {
          ctx.strokeStyle = 'rgba(138, 134, 112, 0.8)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(el.x - 1, el.y - 1, w + 2, h + 2);
          ctx.setLineDash([]);
        }
        break;
      }
      case 'hline': {
        const w = el.w ?? 200;
        ctx.fillStyle = PALETTE[1]!;
        ctx.fillRect(el.x, el.y, w, 1);
        if (isSelected) {
          ctx.strokeStyle = 'rgba(138, 134, 112, 0.8)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(el.x - 1, el.y - 2, w + 2, 5);
          ctx.setLineDash([]);
        }
        break;
      }
    }
  }

  ctx.restore();
}

// ── Component ───────────────────────────────────────────────────────────────

export function LayoutBuilder() {
  const [elements, setElements] = useState<LayoutElement[]>([
    { id: 1, type: 'label', x: 8, y: 8, text: 'Hello World', size: 2 },
  ]);
  const [nextId, setNextId] = useState(2);
  const [selectedId, setSelectedId] = useState<number | null>(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render canvas
  useEffect(() => {
    if (canvasRef.current) renderElements(canvasRef.current, elements, selectedId);
  }, [elements, selectedId]);

  const addElement = useCallback((type: LayoutElement['type']) => {
    const newEl: LayoutElement = {
      id: nextId,
      type,
      x: 8,
      y: 8 + elements.length * 20,
      ...(type === 'label' ? { text: 'Text', size: 1 } : {}),
      ...(type === 'bar' ? { w: 100, h: 6, value: 50, max: 100 } : {}),
      ...(type === 'hline' ? { w: 200 } : {}),
    };
    setElements((prev) => [...prev, newEl]);
    setSelectedId(nextId);
    setNextId((id) => id + 1);
  }, [nextId, elements.length]);

  const updateSelected = useCallback((updates: Partial<LayoutElement>) => {
    setElements((prev) =>
      prev.map((el) => (el.id === selectedId ? { ...el, ...updates } : el)),
    );
  }, [selectedId]);

  const removeSelected = useCallback(() => {
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  const yaml = useMemo(() => toYaml(elements), [elements]);
  const instrs = useMemo(() => toInstructions(elements), [elements]);
  const selectedEl = elements.find((el) => el.id === selectedId);
  const totalBytes = instrs.length > 0 ? parseInt(instrs[instrs.length - 1]!.split(' ')[0]!, 16) + 1 : 0;

  return (
    <div data-part="layout-builder-widget">
      <div className="lb-top">
        {/* Palette */}
        <div className="lb-palette">
          <div className="lb-palette-header">PALETTE</div>
          <button className="lb-palette-btn" onClick={() => addElement('label')}>[Label]</button>
          <button className="lb-palette-btn" onClick={() => addElement('bar')}>[Bar]</button>
          <button className="lb-palette-btn" onClick={() => addElement('hline')}>[HLine]</button>
        </div>

        {/* Canvas */}
        <div className="lb-canvas-area">
          <div className="lb-canvas-header">CANVAS</div>
          <canvas ref={canvasRef} className="lb-canvas" />
          {/* Element list for selection */}
          <div className="lb-element-list">
            {elements.map((el) => (
              <button
                key={el.id}
                className="lb-element-btn"
                data-state={el.id === selectedId ? 'active' : undefined}
                onClick={() => setSelectedId(el.id)}
              >
                {el.type}{el.type === 'label' ? `: "${el.text}"` : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Properties editor */}
      {selectedEl && (
        <div className="lb-props">
          <div className="lb-props-header">
            PROPERTIES — {selectedEl.type} (node {elements.indexOf(selectedEl) + 1})
            <button className="lb-remove-btn" onClick={removeSelected}>REMOVE</button>
          </div>
          <div className="lb-props-grid">
            <label>
              x: <input type="number" value={selectedEl.x} onChange={(e) => updateSelected({ x: Number(e.target.value) })} className="lb-prop-input" />
            </label>
            <label>
              y: <input type="number" value={selectedEl.y} onChange={(e) => updateSelected({ y: Number(e.target.value) })} className="lb-prop-input" />
            </label>
            {selectedEl.type === 'label' && (
              <>
                <label>
                  text: <input type="text" value={selectedEl.text ?? ''} onChange={(e) => updateSelected({ text: e.target.value })} className="lb-prop-input lb-prop-text" />
                </label>
                <label>
                  size: <select value={selectedEl.size ?? 1} onChange={(e) => updateSelected({ size: Number(e.target.value) })} className="lb-prop-input">
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </label>
              </>
            )}
            {selectedEl.type === 'bar' && (
              <>
                <label>
                  w: <input type="number" value={selectedEl.w ?? 100} onChange={(e) => updateSelected({ w: Number(e.target.value) })} className="lb-prop-input" />
                </label>
                <label>
                  value: <input type="number" value={selectedEl.value ?? 50} onChange={(e) => updateSelected({ value: Number(e.target.value) })} className="lb-prop-input" />
                </label>
                <label>
                  max: <input type="number" value={selectedEl.max ?? 100} onChange={(e) => updateSelected({ max: Number(e.target.value) })} className="lb-prop-input" />
                </label>
              </>
            )}
            {selectedEl.type === 'hline' && (
              <label>
                w: <input type="number" value={selectedEl.w ?? 200} onChange={(e) => updateSelected({ w: Number(e.target.value) })} className="lb-prop-input" />
              </label>
            )}
          </div>
        </div>
      )}

      {/* YAML + Bytecode columns */}
      <div className="lb-bottom">
        <div className="lb-yaml">
          <div className="lb-yaml-header">GENERATED YAML</div>
          <pre className="lb-yaml-code">{yaml}</pre>
        </div>
        <div className="lb-bytecode">
          <div className="lb-bytecode-header">COMPILED BYTECODE</div>
          <div className="lb-instr-list">
            {instrs.map((line, i) => (
              <div key={i} className="lb-instr">{line}</div>
            ))}
          </div>
          <div className="lb-bytecode-stats">
            Total: {totalBytes} bytes {'\u2502'} Instructions: {instrs.length}
          </div>
        </div>
      </div>
    </div>
  );
}
