import { useRef, useEffect } from 'react';
import { useAppSelector } from '../../store/hooks';
import { PALETTE, drawOpsToCanvas } from '../../engine';
import { getDebuggerProgram } from '../Inspector/panels/DebuggerPanel';
import { OP_NAMES } from '../../engine/gndy';
import { PARTS } from './parts';

export function CanvasPane() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compileResult = useAppSelector((s) => s.dynamic.compileResult);
  const snapshot = useAppSelector((s) => s.debugger.snapshot);
  const program = getDebuggerProgram();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !compileResult) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = compileResult.program.screen.width;
    const H = compileResult.program.screen.height;
    const scale = 2;

    const drawOps = snapshot?.drawOps ?? [];

    canvas.width = W * scale;
    canvas.height = H * scale;
    canvas.style.width = `${W * scale}px`;
    canvas.style.height = `${H * scale}px`;

    ctx.save();
    ctx.scale(scale, scale);

    ctx.fillStyle = PALETTE[0]!;
    ctx.fillRect(0, 0, W, H);

    // e-ink noise texture
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
  }, [compileResult, snapshot]);

  // Build status bar text
  const totalOps = program?.instructions.length ?? 0;
  const drawOpsCount = snapshot?.drawOps.length ?? 0;
  const currentInstr = snapshot && program && snapshot.instrIndex < program.instructions.length
    ? program.instructions[snapshot.instrIndex]
    : null;
  const instrName = currentInstr ? (OP_NAMES[currentInstr.op] ?? '??') : snapshot?.halted ? 'HALTED' : '--';

  return (
    <div data-part={PARTS.canvasPane}>
      <div className="dbg-canvas-viewport">
        <canvas ref={canvasRef} width={800} height={600} />
      </div>
      <div data-part={PARTS.canvasStatus}>
        <span>draw_ops: {drawOpsCount}</span>
        <span className="dbg-canvas-sep">{'\u2502'}</span>
        <span>{instrName}</span>
        <span className="dbg-canvas-sep">{'\u2502'}</span>
        <span>step {snapshot?.instrIndex ?? 0}/{totalOps}</span>
      </div>
    </div>
  );
}
