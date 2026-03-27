import { useAppSelector } from '../../store/hooks';
import { SourceEditor } from './SourceEditor';
import { PARTS } from './parts';

export function Editor() {
  const error = useAppSelector((s) => s.dynamic.error);
  const compileResult = useAppSelector((s) => s.dynamic.compileResult);

  const program = compileResult?.program;
  const statsHtml = program
    ? `NODES:<b>${program.node_count}</b> SLOTS:<b>${program.slot_count}</b> CODE:<b>${program.code_size}B</b> STRINGS:<b>${program.strings.length}</b> BINDS:<b>${program.binds.length}</b> EVALS:<b>${compileResult.evaluations.length}</b>`
    : 'Ready';

  return (
    <div data-part={PARTS.editor}>
      <div data-part={PARTS.editorTabs}>
        <button data-state="active">SOURCE</button>
      </div>

      <div data-part={PARTS.sourceWrap}>
        <SourceEditor />
        {error && <div data-part={PARTS.errorBar}>ERR: {error}</div>}
      </div>

      <div
        data-part={PARTS.statsBar}
        dangerouslySetInnerHTML={{ __html: statsHtml }}
      />
    </div>
  );
}
