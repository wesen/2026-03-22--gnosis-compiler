import { useRef, useEffect, useState, useCallback } from 'react';

// ── Constants ───────────────────────────────────────────────────────────────

const CANVAS_W = 280;
const CANVAS_H = 120;
const GLYPH_W = 8;
const GLYPH_H = 8;
const SCALE = 2;

const PALETTE = ['#d8d4cc', '#2a2826', '#7a7668', '#b0aa9e', '#e0dcd4'];

// ── Component ───────────────────────────────────────────────────────────────

interface CanvasPreviewProps {
  initialText?: string;
  initialSize?: number;
  initialColor?: number;
}

export function CanvasPreview({
  initialText = 'LAB-01',
  initialSize = 2,
  initialColor = 1,
}: CanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState(initialText);
  const [size, setSize] = useState(initialSize);
  const [colorIdx, setColorIdx] = useState(initialColor);
  const [x, setX] = useState(8);
  const [y, setY] = useState(8);

  const textW = text.length * GLYPH_W * size;
  const textH = GLYPH_H * size;
  const [w, setW] = useState(textW);
  const [h, setH] = useState(textH);

  // Keep w/h synced to text when text changes
  useEffect(() => {
    setW(text.length * GLYPH_W * size);
    setH(GLYPH_H * size);
  }, [text, size]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CANVAS_W * SCALE;
    canvas.height = CANVAS_H * SCALE;
    ctx.save();
    ctx.scale(SCALE, SCALE);

    // Background
    ctx.fillStyle = PALETTE[0]!;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Bounding box
    ctx.strokeStyle = 'rgba(138, 134, 112, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.setLineDash([]);

    // Text (bitmap font simulation)
    ctx.fillStyle = PALETTE[colorIdx] ?? PALETTE[1]!;
    ctx.font = `${GLYPH_H * size}px monospace`;
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);

    // Coordinate labels
    ctx.fillStyle = 'rgba(42, 40, 38, 0.6)';
    ctx.font = '8px monospace';
    ctx.fillText(`(${x}, ${y})`, x, y + h + 4);
    ctx.fillText(`${w}×${h}`, x + w + 4, y);

    ctx.restore();
  }, [text, size, colorIdx, x, y, w, h]);

  const slider = useCallback(
    (label: string, value: number, min: number, max: number, onChange: (v: number) => void) => (
      <div className="cp-slider">
        <span className="cp-slider-label">{label}:</span>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="cp-slider-input"
        />
        <span className="cp-slider-val">{value}</span>
      </div>
    ),
    [],
  );

  return (
    <div data-part="canvas-preview-widget">
      <div className="cp-main">
        {/* Slot editors */}
        <div className="cp-slots">
          <div className="cp-slots-header">SLOTS FOR NODE n0</div>
          <div className="cp-slot-pair">
            <span className="cp-slot-label">text =</span>
            <input
              type="text"
              className="cp-slot-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="cp-slot-pair">
            <span className="cp-slot-label">size =</span>
            <select
              className="cp-slot-select"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
            <span className="cp-slot-label" style={{ marginLeft: 12 }}>color =</span>
            <div className="cp-color-picker">
              {PALETTE.slice(1).map((c, i) => (
                <button
                  key={i}
                  className="cp-color-swatch"
                  data-state={i + 1 === colorIdx ? 'active' : undefined}
                  style={{ background: c }}
                  onClick={() => setColorIdx(i + 1)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="cp-canvas-container">
          <div className="cp-canvas-header">CANVAS (LIVE)</div>
          <canvas
            ref={canvasRef}
            className="cp-canvas"
            style={{ width: CANVAS_W * SCALE, height: CANVAS_H * SCALE }}
          />
        </div>
      </div>

      {/* Sliders */}
      <div className="cp-sliders">
        <div className="cp-sliders-header">
          Drag the sliders to move and resize the text on the canvas:
        </div>
        <div className="cp-slider-grid">
          {slider('x', x, 0, CANVAS_W - 10, setX)}
          {slider('y', y, 0, CANVAS_H - 10, setY)}
          {slider('w', w, 0, CANVAS_W, setW)}
          {slider('h', h, 0, CANVAS_H, setH)}
        </div>
      </div>

      {/* Formula */}
      <div className="cp-formula">
        Glyph: {GLYPH_W}×{GLYPH_H}px {'\u2502'} Scaled: {GLYPH_W * size}×{GLYPH_H * size}px {'\u2502'} Text: "{text}" ({text.length} chars) = <strong>{textW}×{textH}px</strong>
      </div>
    </div>
  );
}
