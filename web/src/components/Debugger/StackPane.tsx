import { useAppSelector } from '../../store/hooks';
import { getDebuggerProgram } from '../Inspector/panels/DebuggerPanel';
import { OP_NAMES } from '../../engine/gndy';
import { PARTS } from './parts';

export function StackPane() {
  const snapshot = useAppSelector((s) => s.debugger.snapshot);
  const program = getDebuggerProgram();

  if (!snapshot) {
    return (
      <div data-part={PARTS.stackPane}>
        <div className="dbg-pane-empty">No stack data</div>
      </div>
    );
  }

  const stack = snapshot.stack;

  // Context hint: what instruction just executed
  const currentInstr = program && snapshot.instrIndex > 0 && snapshot.instrIndex <= program.instructions.length
    ? program.instructions[snapshot.instrIndex - 1]
    : null;
  const contextHint = currentInstr
    ? `after ${OP_NAMES[currentInstr.op] ?? '??'}`
    : null;

  const reversed = [...stack].reverse();

  return (
    <div data-part={PARTS.stackPane}>
      <div className="dbg-stack-header">
        <span>STACK ({stack.length})</span>
        {contextHint && <span className="dbg-stack-hint">{contextHint}</span>}
      </div>
      {stack.length === 0 ? (
        <div className="dbg-pane-empty">
          (empty) {'\u2502'} {snapshot.phase.toUpperCase()} {'\u2502'} PC 0x{snapshot.pc.toString(16).padStart(4, '0')}
        </div>
      ) : (
        <div data-part={PARTS.stackList}>
          <div className="dbg-stack-row dbg-stack-hdr">
            <span>idx</span>
            <span>dec</span>
            <span>hex</span>
          </div>
          {reversed.map((value, displayIdx) => {
            const stackIdx = stack.length - 1 - displayIdx;
            const isTop = displayIdx === 0;
            const hexStr = value >= 0
              ? '0x' + value.toString(16).padStart(4, '0')
              : '-0x' + Math.abs(value).toString(16).padStart(4, '0');
            return (
              <div
                key={displayIdx}
                className="dbg-stack-row"
                data-state={isTop ? 'top' : undefined}
              >
                <span className="dbg-stack-idx">
                  {isTop ? '\u25B6' : '\u00A0'} [{stackIdx}]
                </span>
                <span className="dbg-stack-dec">{value}</span>
                <span className="dbg-stack-hex">{hexStr}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
