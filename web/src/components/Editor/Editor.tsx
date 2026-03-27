import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setEditorTab } from '../../store/slices/editorSlice';
import type { EditorTab } from '../../store/slices/editorSlice';
import { SourceEditor } from './SourceEditor';
import { PropsEditor } from './PropsEditor';
import { PARTS } from './parts';

export function Editor() {
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector((s) => s.editor.activeTab);
  const error = useAppSelector((s) => s.compiler.error);
  const compileResult = useAppSelector((s) => s.compiler.compileResult);

  const tabs: { id: EditorTab; label: string }[] = [
    { id: 'source', label: 'SOURCE' },
    { id: 'props', label: 'PROPS' },
  ];

  const stats = compileResult?.program.stats;
  const statsHtml = stats
    ? `NODES:<b>${stats.final_nodes}</b> STATIC:<b style="color:var(--color-green)">${stats.static_nodes}</b> DYN:<b style="color:var(--color-orange)">${stats.dynamic_nodes}</b> CODE:<b>${stats.code_size}B</b> STRINGS:<b>${stats.string_count}</b> BINDS:<b>${stats.bind_count}</b> REGIONS:<b>${stats.region_count}</b>`
    : 'Ready';

  return (
    <div data-part={PARTS.editor}>
      <div data-part={PARTS.editorTabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-state={activeTab === tab.id ? 'active' : undefined}
            onClick={() => dispatch(setEditorTab(tab.id))}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div data-part={PARTS.sourceWrap}>
        {activeTab === 'source' ? <SourceEditor /> : <PropsEditor />}
        {error && (
          <div data-part={PARTS.errorBar}>ERR: {error}</div>
        )}
      </div>

      <div
        data-part={PARTS.statsBar}
        dangerouslySetInnerHTML={{ __html: statsHtml }}
      />
    </div>
  );
}
