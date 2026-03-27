/** AST node shape as returned by the compiler */
export interface ASTNode {
  type?: string;
  rect?: { x: number; y: number; w: number; h: number };
  children?: ASTNode[];
  bar?: ASTNode;
  body?: ASTNode;
  nav?: ASTNode;
  text?: string;
  bind?: string;
  _static?: boolean;
  id?: string;
  h?: number;
}

/** Region shape as returned by the compiler */
export interface Region {
  rect: { x: number; y: number; w: number; h: number };
  waveform: string;
  bind_names: string[];
}

const SECTIONS = ['bar', 'body', 'nav'] as const;

/** Draw bounding boxes colored by depth */
export function drawBoundsOverlay(
  ctx: CanvasRenderingContext2D,
  node: ASTNode | null | undefined,
  depth: number,
): void {
  if (!node) return;
  const r = node.rect;
  if (r) {
    const hue = (depth * 40) % 360;
    ctx.strokeStyle = `hsla(${hue},70%,55%,0.6)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  }
  for (const section of SECTIONS) {
    if (node[section]) drawBoundsOverlay(ctx, node[section], depth + 1);
  }
  (node.children ?? []).forEach((c) => drawBoundsOverlay(ctx, c, depth + 1));
}

const WAVEFORM_COLORS: Record<string, string> = {
  fast: 'rgba(100,200,100,0.3)',
  part: 'rgba(200,200,50,0.3)',
  full: 'rgba(200,80,80,0.3)',
};

/** Draw refresh regions colored by waveform type */
export function drawDirtyOverlay(
  ctx: CanvasRenderingContext2D,
  regions: Region[],
): void {
  regions.forEach((reg) => {
    const r = reg.rect;
    const color = WAVEFORM_COLORS[reg.waveform] ?? WAVEFORM_COLORS['fast']!;
    ctx.fillStyle = color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = color.replace('0.3', '0.8');
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.fillStyle = '#fff';
    ctx.font = '8px monospace';
    ctx.fillText(
      reg.waveform + ' [' + reg.bind_names.join(',') + ']',
      r.x + 2,
      r.y - 2,
    );
  });
}

/** Draw depth-shaded fill overlay */
export function drawDepthOverlay(
  ctx: CanvasRenderingContext2D,
  node: ASTNode | null | undefined,
  depth: number,
): void {
  if (!node) return;
  const r = node.rect;
  if (r && r.w > 0 && r.h > 0) {
    const alpha = Math.min(0.15, 0.03 * depth);
    const hue = (depth * 40) % 360;
    ctx.fillStyle = `hsla(${hue},60%,50%,${alpha})`;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  for (const section of SECTIONS) {
    if (node[section]) drawDepthOverlay(ctx, node[section], depth + 1);
  }
  (node.children ?? []).forEach((c) => drawDepthOverlay(ctx, c, depth + 1));
}
