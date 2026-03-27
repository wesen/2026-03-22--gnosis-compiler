import { useRef, useEffect } from 'react';
import { useAppSelector } from '../../store/hooks';
import { base64ToBytes, PALETTE, executeBytecode, drawBoundsOverlay, drawDirtyOverlay, drawDepthOverlay } from '../../engine';
import { CanvasOverlays } from './CanvasOverlays';
import { PARTS } from './parts';

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compileResult = useAppSelector((s) => s.compiler.compileResult);
  const bindValues = useAppSelector((s) => s.compiler.bindValues);
  const overlays = useAppSelector((s) => s.canvas.overlays);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !compileResult) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = compileResult.program.stats.screen.width;
    const H = compileResult.program.stats.screen.height;
    const scale = 2;

    canvas.width = W * scale;
    canvas.height = H * scale;
    canvas.style.width = W * scale + 'px';
    canvas.style.height = H * scale + 'px';

    ctx.save();
    ctx.scale(scale, scale);

    // E-ink background
    ctx.fillStyle = PALETTE[0]!;
    ctx.fillRect(0, 0, W, H);

    // Grain texture
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

    // Execute bytecode
    const bytes = base64ToBytes(compileResult.bytecode_base64);
    executeBytecode(ctx, bytes, {
      strings: compileResult.program.strings,
      binds: compileResult.program.binds,
      bindValues,
    });

    // Overlays
    if (overlays.bounds && compileResult.stages.laid_out) {
      drawBoundsOverlay(ctx, compileResult.stages.laid_out, 0);
    }
    if (overlays.dirty && compileResult.program.regions) {
      drawDirtyOverlay(ctx, compileResult.program.regions);
    }
    if (overlays.depth && compileResult.stages.laid_out) {
      drawDepthOverlay(ctx, compileResult.stages.laid_out, 0);
    }

    ctx.restore();
  }, [compileResult, bindValues, overlays]);

  return (
    <div data-part={PARTS.canvasArea}>
      <div data-part={PARTS.canvasWrap}>
        <canvas ref={canvasRef} data-part={PARTS.canvas} width={800} height={600} />
      </div>
      <div data-part={PARTS.hoverInfo} />
      <CanvasOverlays />
    </div>
  );
}
