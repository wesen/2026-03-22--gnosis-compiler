import type { DrawOp } from '../types/api';
import { PALETTE, blitText } from './bitmapFont';

export function drawOpsToCanvas(
  ctx: CanvasRenderingContext2D,
  drawOps: DrawOp[],
): void {
  for (const op of drawOps) {
    if (op.type === 'text') {
      blitText(ctx, op.x, op.y, op.text ?? '', op.size ?? 1, op.color ?? 1);
      continue;
    }

    if (op.type === 'bar') {
      ctx.fillStyle = PALETTE[op.track ?? 3] ?? PALETTE[1]!;
      ctx.fillRect(op.x, op.y, op.w, op.h);
      ctx.fillStyle = PALETTE[op.fill ?? 1] ?? PALETTE[1]!;
      ctx.fillRect(op.x, op.y, op.fill_w ?? 0, op.h);
      continue;
    }

    if (op.type === 'hline') {
      ctx.fillStyle = PALETTE[op.color ?? 1] ?? PALETTE[1]!;
      ctx.fillRect(op.x, op.y, op.w, 1);
      continue;
    }

    if (op.type === 'vline') {
      ctx.fillStyle = PALETTE[op.color ?? 1] ?? PALETTE[1]!;
      ctx.fillRect(op.x, op.y, 1, op.h);
    }
  }
}
