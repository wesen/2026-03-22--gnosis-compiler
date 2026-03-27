import { useAppSelector } from '../../../store/hooks';

/**
 * Displays the VM stack during debugger stepping.
 * Shows top-of-stack at the top, with index and hex/decimal values.
 */
export function StackPanel() {
  const snapshot = useAppSelector((s) => s.debugger.snapshot);

  if (!snapshot) {
    return <pre style={{ padding: 8, color: 'var(--color-dim)' }}>Debugger not loaded</pre>;
  }

  const stack = snapshot.stack;

  if (stack.length === 0) {
    return (
      <div style={{ padding: 8, fontSize: '11px', fontFamily: 'var(--font-mono, monospace)' }}>
        <div style={{ color: 'var(--color-dim)', marginBottom: 4 }}>
          STACK (empty)
        </div>
        <div style={{ color: 'var(--color-dim)' }}>
          Phase: {snapshot.phase.toUpperCase()} | PC: 0x{snapshot.pc.toString(16).padStart(4, '0')}
        </div>
      </div>
    );
  }

  // Display top-of-stack first
  const reversed = [...stack].reverse();

  return (
    <div style={{ padding: 8, fontSize: '11px', fontFamily: 'var(--font-mono, monospace)' }}>
      <div style={{ color: 'var(--color-dim)', marginBottom: 4 }}>
        STACK ({stack.length} {stack.length === 1 ? 'entry' : 'entries'})
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gap: '1px 12px' }}>
        {/* Header */}
        <div style={{ color: 'var(--color-dim)', fontWeight: 'bold' }}>idx</div>
        <div style={{ color: 'var(--color-dim)', fontWeight: 'bold', textAlign: 'right' }}>dec</div>
        <div style={{ color: 'var(--color-dim)', fontWeight: 'bold', textAlign: 'right' }}>hex</div>

        {reversed.map((value, displayIdx) => {
          const stackIdx = stack.length - 1 - displayIdx;
          const isTop = displayIdx === 0;
          return (
            <StackRow
              key={displayIdx}
              stackIdx={stackIdx}
              value={value}
              isTop={isTop}
            />
          );
        })}
      </div>
    </div>
  );
}

function StackRow({ stackIdx, value, isTop }: { stackIdx: number; value: number; isTop: boolean }) {
  const color = isTop ? 'var(--color-accent)' : 'var(--color-fg)';
  const hexStr = value >= 0
    ? '0x' + value.toString(16).padStart(4, '0')
    : '-0x' + Math.abs(value).toString(16).padStart(4, '0');

  return (
    <>
      <div style={{ color: 'var(--color-dim)' }}>
        {isTop ? '\u25B6' : '\u00A0'} [{stackIdx}]
      </div>
      <div style={{ textAlign: 'right', color, fontWeight: isTop ? 'bold' : undefined }}>
        {value}
      </div>
      <div style={{ textAlign: 'right', color: 'var(--color-dim)' }}>
        {hexStr}
      </div>
    </>
  );
}
