import { useAppSelector } from '../../../store/hooks';

export function ManifestPanel() {
  const mode = useAppSelector((s) => s.compiler.mode);
  const staticProgram = useAppSelector((s) => s.compiler.compileResult?.program);
  const dynamicProgram = useAppSelector((s) => s.dynamic.compileResult?.program);
  const program = mode === 'dynamic' ? dynamicProgram : staticProgram;

  if (!program) {
    return <pre style={{ padding: 8, color: 'var(--color-dim)' }}>No data</pre>;
  }

  return <pre>{JSON.stringify(program, null, 2)}</pre>;
}
