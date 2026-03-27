import { useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../../../store/hooks';
import { setBindValue } from '../../../store/slices/compilerSlice';

export function BindSimPanel() {
  const dispatch = useAppDispatch();
  const binds = useAppSelector((s) => s.compiler.compileResult?.program.binds ?? []);
  const bindValues = useAppSelector((s) => s.compiler.bindValues);

  const handleChange = useCallback(
    (name: string, value: string) => {
      dispatch(setBindValue({ name, value }));
    },
    [dispatch],
  );

  if (binds.length === 0) {
    return (
      <div style={{ padding: 8, color: 'var(--color-dim)' }}>
        No runtime binds in this screen
      </div>
    );
  }

  return (
    <div style={{ padding: 8 }}>
      <p style={{ color: 'var(--color-dim)', marginBottom: 8 }}>
        Enter values for runtime binds. The canvas will update.
      </p>
      {binds.map((b) => (
        <div key={b} style={{ margin: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ width: 150, color: 'var(--color-accent)' }}>{b}</label>
          <input
            type="text"
            value={bindValues[b] ?? ''}
            onChange={(e) => handleChange(b, e.target.value)}
            style={{
              background: 'var(--color-bg2)',
              color: 'var(--color-fg)',
              border: '1px solid var(--color-border)',
              padding: '4px 8px',
              fontFamily: 'inherit',
              fontSize: '11px',
              width: 120,
            }}
          />
        </div>
      ))}
    </div>
  );
}
