import { useState, useCallback, useMemo } from 'react';

// ── Constants ───────────────────────────────────────────────────────────────

const GLYPH_W = 8;
const GLYPH_H = 8;
const FIELDS = ['mw', 'mh', 'x', 'y', 'w', 'h'] as const;

// ── Types ───────────────────────────────────────────────────────────────────

interface SlotGridState {
  slots: number[];       // 6 per node
  nodeCount: number;
  lastWritten: number | null;  // slot index last written to
  instrIndex: number;
  explanation: string;
}

interface SlotGridProps {
  title?: string;
  fontSize?: number;
  nodeX?: number;
  nodeY?: number;
}

// ── Mini program that mirrors MEASURE_TEXT_BIND + PUSH_SLOT + STORE_SLOT ──

function runProgram(text: string, fontSize: number, x: number, y: number): SlotGridState[] {
  const nodeCount = 1;
  const slots = new Array(6).fill(0);
  // Pre-set x and y from fixed layout
  slots[2] = x; // x
  slots[3] = y; // y

  const states: SlotGridState[] = [{
    slots: [...slots],
    nodeCount,
    lastWritten: null,
    instrIndex: 0,
    explanation: 'Program ready. Node n0 has 6 slots, all starting at 0 (except x and y from the layout).',
  }];

  // Step 1: MEASURE_TEXT_BIND — sets mw and mh
  const mw = text.length * GLYPH_W * fontSize;
  const mh = GLYPH_H * fontSize;
  slots[0] = mw; // mw
  slots[1] = mh; // mh
  states.push({
    slots: [...slots],
    nodeCount,
    lastWritten: 0, // mw
    instrIndex: 1,
    explanation: `MEASURE_TEXT_BIND: "${text}" is ${text.length} chars × ${GLYPH_W}px × size ${fontSize} = ${mw}px wide, ${GLYPH_H} × ${fontSize} = ${mh}px tall.`,
  });

  // Step 2: PUSH_SLOT n0.mw (just for illustration — shows stack intermediary)
  states.push({
    slots: [...slots],
    nodeCount,
    lastWritten: null,
    instrIndex: 2,
    explanation: `PUSH_SLOT n0.mw: Pushed ${mw} onto the stack (reading from the mw slot).`,
  });

  // Step 3: STORE_SLOT n0.w — copy mw to w
  slots[4] = mw; // w
  states.push({
    slots: [...slots],
    nodeCount,
    lastWritten: 4, // w
    instrIndex: 3,
    explanation: `STORE_SLOT n0.w: Popped ${mw} from the stack and stored it in the w slot. Now w = mw = ${mw}.`,
  });

  // Step 4: PUSH_CONST + STORE for h
  slots[5] = mh; // h = mh
  states.push({
    slots: [...slots],
    nodeCount,
    lastWritten: 5, // h
    instrIndex: 4,
    explanation: `STORE_SLOT n0.h: Set h = ${mh}. The node's bounding box is now fully computed: (${x}, ${y}) ${mw}×${mh}.`,
  });

  return states;
}

// ── Component ───────────────────────────────────────────────────────────────

export function SlotGrid({
  title = 'LAB-01',
  fontSize = 2,
  nodeX = 8,
  nodeY = 8,
}: SlotGridProps) {
  const [text, setText] = useState(title);
  const [size, setSize] = useState(fontSize);
  const [x, setX] = useState(nodeX);
  const [y, setY] = useState(nodeY);
  const [stepIdx, setStepIdx] = useState(0);

  const states = useMemo(() => runProgram(text, size, x, y), [text, size, x, y]);

  const state = states[Math.min(stepIdx, states.length - 1)]!;
  const isDone = stepIdx >= states.length - 1;

  const handleStep = useCallback(() => {
    if (!isDone) setStepIdx((i) => i + 1);
  }, [isDone]);

  const handleBack = useCallback(() => {
    setStepIdx((i) => Math.max(0, i - 1));
  }, []);

  const handleRun = useCallback(() => {
    setStepIdx(states.length - 1);
  }, [states.length]);

  const handleReset = useCallback(() => {
    setStepIdx(0);
  }, []);

  return (
    <div data-part="slot-grid-widget">
      {/* Runtime data editors */}
      <div className="sg-runtime">
        <div className="sg-runtime-header">RUNTIME DATA</div>
        <div className="sg-runtime-fields">
          <label>
            <span className="sg-field-label">title:</span>
            <input
              className="sg-field-input sg-field-text"
              type="text"
              value={text}
              onChange={(e) => { setText(e.target.value); setStepIdx(0); }}
            />
          </label>
          <label>
            <span className="sg-field-label">size:</span>
            <select
              className="sg-field-input"
              value={size}
              onChange={(e) => { setSize(Number(e.target.value)); setStepIdx(0); }}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <label>
            <span className="sg-field-label">x:</span>
            <input
              className="sg-field-input sg-field-num"
              type="number"
              value={x}
              onChange={(e) => { setX(parseInt(e.target.value) || 0); setStepIdx(0); }}
            />
          </label>
          <label>
            <span className="sg-field-label">y:</span>
            <input
              className="sg-field-input sg-field-num"
              type="number"
              value={y}
              onChange={(e) => { setY(parseInt(e.target.value) || 0); setStepIdx(0); }}
            />
          </label>
        </div>
      </div>

      <div className="sg-main">
        {/* Slot grid */}
        <div className="sg-grid-container">
          <div className="sg-grid-header">SLOT GRID — node n0</div>
          <div className="sg-grid">
            {/* Header row */}
            {FIELDS.map((f) => (
              <div key={f} className="sg-cell sg-cell-hdr">{f}</div>
            ))}
            {/* Value row */}
            {FIELDS.map((f, fi) => {
              const val = state.slots[fi]!;
              const isLast = fi === state.lastWritten;
              return (
                <div
                  key={`v-${f}`}
                  className="sg-cell sg-cell-val"
                  data-state={isLast ? 'changed' : val === 0 ? 'zero' : undefined}
                >
                  {val}
                </div>
              );
            })}
            {/* Label row */}
            {['measured w', 'measured h', 'x pos', 'y pos', 'final w', 'final h'].map((desc, i) => (
              <div key={`d-${i}`} className="sg-cell sg-cell-desc">{desc}</div>
            ))}
          </div>

          {/* Arrow showing what wrote */}
          {state.lastWritten !== null && (
            <div className="sg-write-indicator">
              {'\u2191'} written by step {state.instrIndex}
            </div>
          )}
        </div>

        {/* Explanation */}
        <div className="sg-explain">
          <div className="sg-explain-step">Step {stepIdx}/{states.length - 1}</div>
          <div className="sg-explain-text">{state.explanation}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="sg-controls">
        <button onClick={handleStep} disabled={isDone}>STEP {'\u2192'}</button>
        <button onClick={handleBack} disabled={stepIdx === 0}>{'\u2190'} BACK</button>
        <button onClick={handleRun} disabled={isDone}>RUN ALL</button>
        <button onClick={handleReset}>RESET</button>
      </div>

      {/* Formula hint */}
      <div className="sg-formula">
        mw = len("{text}") × {GLYPH_W} × {size} = {text.length} × {GLYPH_W} × {size} = <strong>{text.length * GLYPH_W * size}</strong>
        {' '}{'\u2502'}{' '}
        mh = {GLYPH_H} × {size} = <strong>{GLYPH_H * size}</strong>
      </div>
    </div>
  );
}
