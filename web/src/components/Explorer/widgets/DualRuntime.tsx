import { useState, useRef, useEffect, useMemo } from 'react';

// ── Constants ───────────────────────────────────────────────────────────────

const GLYPH_W = 8;
const GLYPH_H = 8;
const PALETTE = ['#d8d4cc', '#2a2826', '#7a7668', '#b0aa9e', '#e0dcd4'];
const CANVAS_W = 260;
const CANVAS_H = 80;
const SCALE = 2;
const FONT_SIZE = 2;

// ── Mini evaluator ──────────────────────────────────────────────────────────

interface RuntimeData {
  title: string;
  temp: number;
  humidity: number;
}

interface EvalResult {
  slots: Record<string, number>;
  drawOps: Array<{ type: string; x: number; y: number; w: number; h: number; text: string; color: number; fillW?: number }>;
}

function evaluate(rt: RuntimeData): EvalResult {
  const titleMw = rt.title.length * GLYPH_W * FONT_SIZE;
  const titleMh = GLYPH_H * FONT_SIZE;
  const barW = 200;

  const slots: Record<string, number> = {
    'n0.mw': titleMw, 'n0.mh': titleMh, 'n0.x': 8, 'n0.y': 4, 'n0.w': titleMw, 'n0.h': titleMh,
    'n1.x': 8, 'n1.y': 4 + titleMh + 4, 'n1.w': 40, 'n1.h': 8,
    'n2.x': 48, 'n2.y': 4 + titleMh + 4, 'n2.w': 24, 'n2.h': 8,
    'n3.x': 8, 'n3.y': 4 + titleMh + 18, 'n3.w': barW, 'n3.h': 6,
    'n4.x': 8, 'n4.y': 4 + titleMh + 28, 'n4.w': 40, 'n4.h': 8,
    'n5.x': 48, 'n5.y': 4 + titleMh + 28, 'n5.w': 24, 'n5.h': 8,
    'n6.x': 8, 'n6.y': 4 + titleMh + 40, 'n6.w': barW, 'n6.h': 6,
  };

  const tempFill = Math.trunc(barW * rt.temp / 100);
  const humFill = Math.trunc(barW * rt.humidity / 100);

  const drawOps = [
    { type: 'text', x: 8, y: 4, w: titleMw, h: titleMh, text: rt.title, color: 1 },
    { type: 'text', x: 8, y: 4 + titleMh + 4, w: 40, h: 8, text: 'TEMP:', color: 1 },
    { type: 'text', x: 48, y: 4 + titleMh + 4, w: 24, h: 8, text: String(rt.temp), color: 1 },
    { type: 'bar', x: 8, y: 4 + titleMh + 18, w: barW, h: 6, text: '', color: 2, fillW: tempFill },
    { type: 'text', x: 8, y: 4 + titleMh + 28, w: 40, h: 8, text: 'HUM:', color: 1 },
    { type: 'text', x: 48, y: 4 + titleMh + 28, w: 24, h: 8, text: String(rt.humidity), color: 1 },
    { type: 'bar', x: 8, y: 4 + titleMh + 40, w: barW, h: 6, text: '', color: 2, fillW: humFill },
  ];

  return { slots, drawOps };
}

function renderToCanvas(canvas: HTMLCanvasElement, result: EvalResult) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = CANVAS_W * SCALE;
  canvas.height = CANVAS_H * SCALE;
  ctx.save();
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = PALETTE[0]!;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  for (const op of result.drawOps) {
    if (op.type === 'text') {
      ctx.fillStyle = PALETTE[op.color] ?? PALETTE[1]!;
      ctx.font = `${op.h}px monospace`;
      ctx.textBaseline = 'top';
      ctx.fillText(op.text, op.x, op.y);
    } else if (op.type === 'bar') {
      ctx.fillStyle = PALETTE[3]!;
      ctx.fillRect(op.x, op.y, op.w, op.h);
      ctx.fillStyle = PALETTE[op.color] ?? PALETTE[1]!;
      ctx.fillRect(op.x, op.y, op.fillW ?? 0, op.h);
    }
  }

  ctx.restore();
}

// ── Runtime panel ───────────────────────────────────────────────────────────

function RuntimePanel({
  label,
  runtime,
  onChange,
  result,
}: {
  label: string;
  runtime: RuntimeData;
  onChange: (rt: RuntimeData) => void;
  result: EvalResult;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) renderToCanvas(canvasRef.current, result);
  }, [result]);

  return (
    <div className="dr-panel">
      <div className="dr-panel-header">{label}</div>
      <div className="dr-fields">
        <label>
          <span className="dr-label">title:</span>
          <input
            className="dr-input dr-input-text"
            type="text"
            value={runtime.title}
            onChange={(e) => onChange({ ...runtime, title: e.target.value })}
          />
        </label>
        <label className="dr-slider-row">
          <span className="dr-label">temp:</span>
          <input
            type="range" min={0} max={100} value={runtime.temp}
            className="dr-range"
            onChange={(e) => onChange({ ...runtime, temp: Number(e.target.value) })}
          />
          <span className="dr-val">{runtime.temp}</span>
        </label>
        <label className="dr-slider-row">
          <span className="dr-label">humidity:</span>
          <input
            type="range" min={0} max={100} value={runtime.humidity}
            className="dr-range"
            onChange={(e) => onChange({ ...runtime, humidity: Number(e.target.value) })}
          />
          <span className="dr-val">{runtime.humidity}</span>
        </label>
      </div>
      <canvas ref={canvasRef} className="dr-canvas" />
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export function DualRuntime() {
  const [rtA, setRtA] = useState<RuntimeData>({ title: 'LAB-01', temp: 22, humidity: 45 });
  const [rtB, setRtB] = useState<RuntimeData>({ title: 'REACTOR-7', temp: 95, humidity: 88 });
  const [showDiff, setShowDiff] = useState(false);

  const resultA = useMemo(() => evaluate(rtA), [rtA]);
  const resultB = useMemo(() => evaluate(rtB), [rtB]);

  // Compute slot diffs
  const slotDiffs = useMemo(() => {
    const diffs: Array<{ name: string; a: number; b: number }> = [];
    const allKeys = new Set([...Object.keys(resultA.slots), ...Object.keys(resultB.slots)]);
    for (const key of allKeys) {
      const a = resultA.slots[key] ?? 0;
      const b = resultB.slots[key] ?? 0;
      if (a !== b) diffs.push({ name: key, a, b });
    }
    return diffs;
  }, [resultA, resultB]);

  const handleSwap = () => {
    const tmpA = rtA;
    setRtA(rtB);
    setRtB(tmpA);
  };

  return (
    <div data-part="dual-runtime-widget">
      <div className="dr-panels">
        <RuntimePanel label='RUNTIME A: "Normal"' runtime={rtA} onChange={setRtA} result={resultA} />
        <div className="dr-separator">
          <button className="dr-swap-btn" onClick={handleSwap}>{'\u21C4'} SWAP</button>
        </div>
        <RuntimePanel label='RUNTIME B: "Emergency"' runtime={rtB} onChange={setRtB} result={resultB} />
      </div>

      <div className="dr-footer">
        <span>Bytecode: <strong>identical for both</strong></span>
        <span>{'\u2502'}</span>
        <span>Slot diffs: <strong>{slotDiffs.length}</strong></span>
        <button
          className="dr-diff-btn"
          onClick={() => setShowDiff(!showDiff)}
        >
          {showDiff ? 'hide diff' : 'show diff'}
        </button>
      </div>

      {showDiff && slotDiffs.length > 0 && (
        <div className="dr-diff-table">
          <div className="dr-diff-hdr">
            <span>slot</span><span>A</span><span>B</span><span>{'\u0394'}</span>
          </div>
          {slotDiffs.map((d) => (
            <div key={d.name} className="dr-diff-row">
              <span className="dr-diff-name">{d.name}</span>
              <span>{d.a}</span>
              <span>{d.b}</span>
              <span className="dr-diff-delta">{d.b - d.a > 0 ? '+' : ''}{d.b - d.a}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
