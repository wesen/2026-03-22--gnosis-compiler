import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setHideZeroNodes } from '../../store/slices/debuggerSlice';
import { slotName, FIELDS } from '../../engine/gndy/decode';
import { PARTS } from './parts';

export function SlotsPane() {
  const dispatch = useAppDispatch();
  const snapshot = useAppSelector((s) => s.debugger.snapshot);
  const compileResult = useAppSelector((s) => s.dynamic.compileResult);
  const selectedEvaluation = useAppSelector((s) => s.dynamic.selectedEvaluation);
  const hideZero = useAppSelector((s) => s.debugger.layout.hideZeroNodes);

  const evaluation = compileResult?.evaluations[selectedEvaluation];

  let slotEntries: Array<{ name: string; value: number }> = [];
  const changedSet = new Set<string>();

  if (snapshot) {
    for (let i = 0; i < snapshot.slots.length; i++) {
      slotEntries.push({ name: slotName(i), value: snapshot.slots[i]! });
    }
    for (const ch of snapshot.changedSlots) {
      changedSet.add(ch.name);
    }
  } else if (evaluation) {
    slotEntries = Object.entries(evaluation.slots).map(([name, value]) => ({ name, value }));
  }

  if (slotEntries.length === 0) {
    return (
      <div data-part={PARTS.slotsPane}>
        <div className="dbg-pane-empty">No slot data</div>
      </div>
    );
  }

  const nodeCount = Math.ceil(slotEntries.length / FIELDS.length);

  // Build visible node indices
  const visibleNodes: number[] = [];
  for (let n = 0; n < nodeCount; n++) {
    if (hideZero) {
      const base = n * FIELDS.length;
      const allZero = FIELDS.every((_, fi) => (slotEntries[base + fi]?.value ?? 0) === 0);
      if (allZero) continue;
    }
    visibleNodes.push(n);
  }

  return (
    <div data-part={PARTS.slotsPane}>
      <div data-part={PARTS.slotsHeader}>
        <span>SLOTS</span>
        <label className="dbg-toggle">
          <input
            type="checkbox"
            checked={hideZero}
            onChange={(e) => dispatch(setHideZeroNodes(e.target.checked))}
          />
          hide zero
        </label>
      </div>

      {/* Changed slots banner */}
      {snapshot && snapshot.changedSlots.length > 0 && (
        <div className="dbg-changed-banner">
          {snapshot.changedSlots.map((ch) => (
            <span key={ch.name}>
              {ch.name}: {ch.before} {'\u2192'} <strong>{ch.after}</strong>
            </span>
          ))}
        </div>
      )}

      <div data-part={PARTS.slotsGrid}>
        {/* Header */}
        <div className="dbg-slot-label dbg-slot-hdr">node</div>
        {FIELDS.map((f) => (
          <div key={f} className="dbg-slot-val dbg-slot-hdr">{f}</div>
        ))}

        {/* Rows */}
        {visibleNodes.map((nodeIdx) => (
          <SlotRow
            key={nodeIdx}
            nodeIdx={nodeIdx}
            slotEntries={slotEntries}
            changedSet={changedSet}
          />
        ))}
      </div>
    </div>
  );
}

function SlotRow({
  nodeIdx,
  slotEntries,
  changedSet,
}: {
  nodeIdx: number;
  slotEntries: Array<{ name: string; value: number }>;
  changedSet: Set<string>;
}) {
  return (
    <>
      <div className="dbg-slot-label">n{nodeIdx}</div>
      {FIELDS.map((field, fieldIdx) => {
        const idx = nodeIdx * FIELDS.length + fieldIdx;
        const entry = slotEntries[idx];
        if (!entry) return <div key={`${nodeIdx}-${field}`} className="dbg-slot-val" />;
        const isChanged = changedSet.has(entry.name);
        return (
          <div
            key={`${nodeIdx}-${field}`}
            className="dbg-slot-val"
            data-state={isChanged ? 'changed' : entry.value === 0 ? 'zero' : undefined}
          >
            {entry.value}
          </div>
        );
      })}
    </>
  );
}
