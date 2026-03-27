import { useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../../../store/hooks';
import { setHighlightPc } from '../../../store/slices/inspectorSlice';

export function DisassemblyPanel() {
  const dispatch = useAppDispatch();
  const disassembly = useAppSelector((s) => s.compiler.compileResult?.disassembly ?? '');
  const highlightPc = useAppSelector((s) => s.inspector.highlightPc);

  const lines = disassembly.split('\n').filter(Boolean);

  const handleClick = useCallback(
    (offset: number) => {
      dispatch(setHighlightPc(highlightPc === offset ? -1 : offset));
    },
    [dispatch, highlightPc],
  );

  if (!lines.length) {
    return <pre style={{ padding: 8, color: 'var(--color-dim)' }}>No disassembly</pre>;
  }

  return (
    <div data-part="panel-disasm">
      {lines.map((line, i) => {
        const m = line.match(/^([0-9a-f]+):\s+(\S+)\s*(.*)/i);
        if (!m) return null;
        const offset = parseInt(m[1]!, 16);
        return (
          <div
            key={i}
            className="dasm-line"
            data-state={highlightPc === offset ? 'highlighted' : undefined}
            onClick={() => handleClick(offset)}
          >
            <span className="dasm-off">{m[1]}</span>
            <span className="dasm-op">{m[2]}</span>
            <span className="dasm-args">{m[3]}</span>
          </div>
        );
      })}
    </div>
  );
}
