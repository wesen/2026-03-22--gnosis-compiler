import { useRef, useEffect } from 'react';
import { useAppSelector } from '../../store/hooks';
import { PALETTE, drawOpsToCanvas } from '../../engine';
import { PARTS } from './parts';

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compileResult = useAppSelector((s) => s.dynamic.compileResult);
  const selectedEvaluation = useAppSelector((s) => s.dynamic.selectedEvaluation);
  const debuggerSnapshot = useAppSelector((s) => s.debugger.snapshot);
  const debuggerStatus = useAppSelector((s) => s.debugger.status);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !compileResult) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = compileResult.program.screen.width;
    const H = compileResult.program.screen.height;
    const scale = 2;

    // When the debugger is active, use its draw_ops for incremental rendering.
    // Otherwise, use the selected evaluation's final draw_ops.
    const isDebugging = debuggerStatus !== 'idle' && debuggerSnapshot;
    const drawOps = isDebugging
      ? debuggerSnapshot.drawOps
      : (compileResult.evaluations[selectedEvaluation] ?? compileResult.evaluations[0])?.draw_ops ?? [];

    canvas.width = W * scale;
    canvas.height = H * scale;
    canvas.style.width = `${W * scale}px`;
    canvas.style.height = `${H * scale}px`;

    ctx.save();
    ctx.scale(scale, scale);

    ctx.fillStyle = PALETTE[0]!;
    ctx.fillRect(0, 0, W, H);

    const img = ctx.getImageData(0, 0, W * scale, H * scale);
    for (let i = 0; i < img.data.length; i += 16) {
      const n = (Math.random() - 0.5) * 6;
      img.data[i]! += n;
      img.data[i + 1]! += n;
      img.data[i + 2]! += n;
    }
    ctx.putImageData(img, 0, 0);
    ctx.scale(1 / scale, 1 / scale);
    ctx.scale(scale, scale);

    drawOpsToCanvas(ctx, drawOps);
    ctx.restore();
  }, [compileResult, selectedEvaluation, debuggerSnapshot, debuggerStatus]);

  return (
    <div data-part={PARTS.canvasArea}>
      <div data-part={PARTS.canvasWrap}>
        <canvas ref={canvasRef} data-part={PARTS.canvas} width={800} height={600} />
      </div>
      <div data-part={PARTS.hoverInfo} />
    </div>
  );
}
