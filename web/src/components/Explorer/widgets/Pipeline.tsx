import { useState, useMemo, useRef, useEffect } from 'react';

// ── Constants ───────────────────────────────────────────────────────────────

const GLYPH_W = 8;
const GLYPH_H = 8;
const PALETTE = ['#d8d4cc', '#2a2826', '#7a7668', '#b0aa9e', '#e0dcd4'];
const CANVAS_W = 280;
const CANVAS_H = 80;
const SCALE = 2;

const PHASES = ['MEASURE', 'COMPUTE', 'RENDER', 'DONE'] as const;
type Phase = (typeof PHASES)[number];

// ── Mini program simulation ─────────────────────────────────────────────────

interface PhaseData {
  phase: Phase;
  instructions: string[];
  slotChanges: Array<{ name: string; before: number; after: number }>;
  drawOps: Array<{ type: string; text: string; x: number; y: number; w: number; h: number; color: number }>;
  explanation: string;
}

function simulatePhases(title: string, temp: number, _humidity: number, fontSize: number): PhaseData[] {
  const mw = title.length * GLYPH_W * fontSize;
  const mh = GLYPH_H * fontSize;

  const measure: PhaseData = {
    phase: 'MEASURE',
    instructions: [
      `MEASURE_TEXT_BIND node=0 bind=title size=${fontSize}`,
    ],
    slotChanges: [
      { name: 'n0.mw', before: 0, after: mw },
      { name: 'n0.mh', before: 0, after: mh },
    ],
    drawOps: [],
    explanation: `Measures text "${title}" → ${title.length} chars × ${GLYPH_W}px × ${fontSize} = ${mw}px wide, ${GLYPH_H} × ${fontSize} = ${mh}px tall. Only mw/mh slots change during MEASURE.`,
  };

  const compute: PhaseData = {
    phase: 'COMPUTE',
    instructions: [
      'PUSH_SLOT n0.mw',
      'STORE_SLOT n0.w',
      'PUSH_SLOT n0.mh',
      'STORE_SLOT n0.h',
    ],
    slotChanges: [
      { name: 'n0.w', before: 0, after: mw },
      { name: 'n0.h', before: 0, after: mh },
    ],
    drawOps: [],
    explanation: `Copies measured dimensions to final w/h slots. In more complex layouts, this phase would include arithmetic to compute child positions relative to parents.`,
  };

  const barW = 200;
  const barFillW = Math.trunc(barW * temp / 100);

  const render: PhaseData = {
    phase: 'RENDER',
    instructions: [
      `DRAW_TEXT_BIND node=0 bind=title size=${fontSize}`,
      `DRAW_TEXT_CONST node=1 "TEMP:" size=1`,
      `DRAW_TEXT_BIND node=2 bind=temp size=1`,
      `DRAW_BAR_BIND node=3 bind=temp max=100`,
    ],
    slotChanges: [],
    drawOps: [
      { type: 'text', text: title, x: 8, y: 4, w: mw, h: mh, color: 1 },
      { type: 'text', text: 'TEMP:', x: 8, y: 4 + mh + 4, w: 40, h: 8, color: 1 },
      { type: 'text', text: String(temp), x: 48, y: 4 + mh + 4, w: 24, h: 8, color: 1 },
      { type: 'bar', text: `fill: ${barFillW}/${barW}px`, x: 8, y: 4 + mh + 18, w: barW, h: 6, color: 2 },
    ],
    explanation: `Reads slots to position elements on canvas. DRAW_TEXT reads x, y from slots. DRAW_BAR computes fill: ${temp}/100 × ${barW} = ${barFillW}px.`,
  };

  const done: PhaseData = {
    phase: 'DONE',
    instructions: ['HALT'],
    slotChanges: [],
    drawOps: render.drawOps,
    explanation: `Execution complete. All draw operations have been emitted. The canvas shows the final rendered output.`,
  };

  return [measure, compute, render, done];
}

// ── Component ───────────────────────────────────────────────────────────────

interface PipelineProps {
  initialTitle?: string;
  initialTemp?: number;
}

export function Pipeline({
  initialTitle = 'LAB-01',
  initialTemp = 22,
}: PipelineProps) {
  const [title, setTitle] = useState(initialTitle);
  const [temp, setTemp] = useState(initialTemp);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const phases = useMemo(() => simulatePhases(title, temp, 0, 2), [title, temp]);
  const current = phases[phaseIdx]!;

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CANVAS_W * SCALE;
    canvas.height = CANVAS_H * SCALE;
    ctx.save();
    ctx.scale(SCALE, SCALE);

    ctx.fillStyle = PALETTE[0]!;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (const op of current.drawOps) {
      if (op.type === 'text') {
        ctx.fillStyle = PALETTE[op.color] ?? PALETTE[1]!;
        ctx.font = `${op.h}px monospace`;
        ctx.textBaseline = 'top';
        ctx.fillText(op.text, op.x, op.y);
      } else if (op.type === 'bar') {
        // Track
        ctx.fillStyle = PALETTE[3]!;
        ctx.fillRect(op.x, op.y, op.w, op.h);
        // Fill
        const fillW = Math.trunc(op.w * temp / 100);
        ctx.fillStyle = PALETTE[op.color] ?? PALETTE[1]!;
        ctx.fillRect(op.x, op.y, fillW, op.h);
      }
    }

    ctx.restore();
  }, [current, temp]);

  return (
    <div data-part="pipeline-widget">
      {/* Runtime editors */}
      <div className="pl-runtime">
        <label>
          <span className="pl-label">title:</span>
          <input
            className="pl-input pl-input-text"
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setPhaseIdx(0); }}
          />
        </label>
        <label>
          <span className="pl-label">temp:</span>
          <input
            className="pl-input pl-input-range"
            type="range"
            min={0}
            max={100}
            value={temp}
            onChange={(e) => setTemp(Number(e.target.value))}
          />
          <span className="pl-val">{temp}</span>
        </label>
      </div>

      {/* Phase timeline */}
      <div className="pl-timeline">
        {PHASES.map((phase, idx) => (
          <button
            key={phase}
            className="pl-phase-btn"
            data-state={idx === phaseIdx ? 'active' : idx < phaseIdx ? 'done' : 'pending'}
            onClick={() => setPhaseIdx(idx)}
          >
            {phase}
          </button>
        ))}
        <div className="pl-timeline-track">
          <div
            className="pl-timeline-fill"
            style={{ width: `${(phaseIdx / (PHASES.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Three-column view */}
      <div className="pl-columns">
        <div className="pl-col">
          <div className="pl-col-header">PHASE: {current.phase}</div>
          <div className="pl-instr-list">
            {current.instructions.map((instr, i) => (
              <div key={i} className="pl-instr">{instr}</div>
            ))}
          </div>
        </div>

        <div className="pl-col">
          <div className="pl-col-header">SLOT CHANGES</div>
          {current.slotChanges.length === 0 ? (
            <div className="pl-empty">
              {current.phase === 'RENDER' ? 'No slot changes during RENDER' : 'No changes'}
            </div>
          ) : (
            <div className="pl-changes">
              {current.slotChanges.map((ch, i) => (
                <div key={i} className="pl-change">
                  <span className="pl-change-name">{ch.name}:</span>
                  <span className="pl-change-before">{ch.before}</span>
                  <span className="pl-change-arrow">{'\u2192'}</span>
                  <strong className="pl-change-after">{ch.after}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pl-col">
          <div className="pl-col-header">CANVAS</div>
          <canvas ref={canvasRef} className="pl-canvas" />
          <div className="pl-draw-count">
            draw_ops: {current.drawOps.length}
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="pl-explanation">{current.explanation}</div>
    </div>
  );
}
