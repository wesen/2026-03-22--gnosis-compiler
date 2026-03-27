import { useAppSelector } from '../../../store/hooks';
import { slotName, FIELDS } from '../../../engine/gndy/decode';

/**
 * Displays slot values in a grid, grouped by node.
 * When the debugger is active, highlights slots that changed in the last step.
 */
export function SlotsPanel() {
  const debuggerSnap = useAppSelector((s) => s.debugger.snapshot);
  const compileResult = useAppSelector((s) => s.dynamic.compileResult);
  const selectedEvaluation = useAppSelector((s) => s.dynamic.selectedEvaluation);

  // Use debugger slots if active, otherwise fall back to compile result slots
  const evaluation = compileResult?.evaluations[selectedEvaluation];

  let slotEntries: Array<{ name: string; value: number }> = [];
  const changedSet = new Set<string>();

  if (debuggerSnap) {
    // Debugger mode: live slots from snapshot
    for (let i = 0; i < debuggerSnap.slots.length; i++) {
      slotEntries.push({ name: slotName(i), value: debuggerSnap.slots[i]! });
    }
    for (const ch of debuggerSnap.changedSlots) {
      changedSet.add(ch.name);
    }
  } else if (evaluation) {
    // Static mode: from backend evaluation
    slotEntries = Object.entries(evaluation.slots).map(([name, value]) => ({ name, value }));
  }

  if (slotEntries.length === 0) {
    return <pre style={{ padding: 8, color: 'var(--color-dim)' }}>No slot data</pre>;
  }

  // Group by node
  const nodeCount = Math.ceil(slotEntries.length / FIELDS.length);

  return (
    <div style={{ padding: 8, fontSize: '11px', fontFamily: 'var(--font-mono, monospace)' }}>
      {/* Changed slots summary */}
      {debuggerSnap && debuggerSnap.changedSlots.length > 0 && (
        <div
          style={{
            marginBottom: 8,
            padding: 4,
            background: 'var(--color-highlight, rgba(255,255,0,0.1))',
            borderLeft: '2px solid var(--color-accent)',
          }}
        >
          <strong style={{ color: 'var(--color-accent)' }}>Changed:</strong>{' '}
          {debuggerSnap.changedSlots.map((ch) => (
            <span key={ch.name} style={{ marginRight: 8 }}>
              {ch.name}: {ch.before} {'→'} <strong>{ch.after}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Slot grid by node */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(6, 1fr)', gap: '1px 8px' }}>
        {/* Header */}
        <div style={{ fontWeight: 'bold', color: 'var(--color-dim)' }}>node</div>
        {FIELDS.map((f) => (
          <div key={f} style={{ fontWeight: 'bold', color: 'var(--color-dim)', textAlign: 'right' }}>
            {f}
          </div>
        ))}

        {/* Rows */}
        {Array.from({ length: nodeCount }, (_, nodeIdx) => (
          <>
            <div key={`label-${nodeIdx}`} style={{ color: 'var(--color-accent)' }}>
              n{nodeIdx}
            </div>
            {FIELDS.map((field, fieldIdx) => {
              const idx = nodeIdx * FIELDS.length + fieldIdx;
              const entry = slotEntries[idx];
              if (!entry) return <div key={`${nodeIdx}-${field}`} />;
              const isChanged = changedSet.has(entry.name);
              return (
                <div
                  key={`${nodeIdx}-${field}`}
                  style={{
                    textAlign: 'right',
                    color: isChanged ? 'var(--color-accent)' : entry.value === 0 ? 'var(--color-dim)' : 'var(--color-fg)',
                    fontWeight: isChanged ? 'bold' : undefined,
                    background: isChanged ? 'var(--color-highlight, rgba(255,255,0,0.08))' : undefined,
                  }}
                >
                  {entry.value}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
