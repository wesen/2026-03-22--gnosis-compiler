import { useAppSelector } from '../../../store/hooks';

export function ManifestPanel() {
  const program = useAppSelector((s) => s.compiler.compileResult?.program);

  if (!program) {
    return <pre style={{ padding: 8, color: 'var(--color-dim)' }}>No data</pre>;
  }

  return <pre>{JSON.stringify(program, null, 2)}</pre>;
}
