import { useAppSelector } from '../../../store/hooks';

export function IRPanel() {
  const ir = useAppSelector((s) => s.dynamic.compileResult?.ir ?? '');

  if (!ir.trim()) {
    return <pre style={{ padding: 8, color: 'var(--color-dim)' }}>No IR</pre>;
  }

  return <pre style={{ padding: 8 }}>{ir}</pre>;
}
