import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { setSelectedEvaluation } from '../../../store/slices/dynamicSlice';

export function EvalPanel() {
  const dispatch = useAppDispatch();
  const compileResult = useAppSelector((s) => s.dynamic.compileResult);
  const selectedEvaluation = useAppSelector((s) => s.dynamic.selectedEvaluation);

  if (!compileResult) {
    return <pre style={{ padding: 8, color: 'var(--color-dim)' }}>No evaluation data</pre>;
  }

  const evaluation =
    compileResult.evaluations[selectedEvaluation] ??
    compileResult.evaluations[0];

  if (!evaluation) {
    return <pre style={{ padding: 8, color: 'var(--color-dim)' }}>No runtimes loaded</pre>;
  }

  return (
    <div style={{ padding: 8 }}>
      <div style={{ marginBottom: 8 }}>
        <select
          value={String(selectedEvaluation)}
          onChange={(e) => dispatch(setSelectedEvaluation(Number(e.target.value)))}
        >
          {compileResult.evaluations.map((item, index) => (
            <option key={item.name} value={index}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <pre>{JSON.stringify(evaluation, null, 2)}</pre>
    </div>
  );
}
