import { useState, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../../../store/hooks';
import { setAstStage } from '../../../store/slices/inspectorSlice';
import type { ASTNodeData } from '../../../types/api';

function ASTNodeView({ node, depth }: { node: ASTNodeData; depth: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const type = node.type ?? '?';

  const children = node.children ?? [];
  const sections = (['bar', 'body', 'nav'] as const).filter((s) => node[s]);
  const hasKids = children.length > 0 || sections.length > 0;

  return (
    <div className="ast-node">
      {hasKids && (
        <span className="toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? '+' : '-'}
        </span>
      )}{' '}
      <span className="ast-type">{type}</span>
      {node.rect && (
        <span className="ast-rect">
          rect=({node.rect.x},{node.rect.y} {node.rect.w}x{node.rect.h})
        </span>
      )}{' '}
      {node.text !== undefined && (
        <span className="ast-prop">"{String(node.text).slice(0, 20)}"</span>
      )}{' '}
      {node.bind && <span className="ast-bind">bind={node.bind}</span>}{' '}
      {node._static && <span className="ast-static">[STATIC]</span>}{' '}
      {node.id && <span className="ast-prop">{node.id}</span>}{' '}
      {node.h !== undefined && type !== 'screen' && (
        <span className="ast-prop">h={node.h}</span>
      )}
      {hasKids && !collapsed && (
        <div className="ast-children">
          {sections.map((s) => (
            <div key={s}>
              <div style={{ color: 'var(--color-dim)', fontSize: '9px' }}>{s}:</div>
              <ASTNodeView node={node[s] as ASTNodeData} depth={depth + 1} />
            </div>
          ))}
          {children.map((c, i) => (
            <ASTNodeView key={i} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ASTPanel() {
  const dispatch = useAppDispatch();
  const stages = useAppSelector((s) => s.compiler.compileResult?.stages ?? {});
  const astStage = useAppSelector((s) => s.inspector.astStage);

  const stageKeys = Object.keys(stages).sort();

  const handleStageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch(setAstStage(e.target.value));
    },
    [dispatch],
  );

  const tree = stages[astStage];

  return (
    <div>
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}>
        <select value={astStage} onChange={handleStageChange} style={{ marginRight: 8 }}>
          {stageKeys.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      {tree ? (
        <div style={{ padding: '4px 8px' }}>
          <ASTNodeView node={tree} depth={0} />
        </div>
      ) : (
        <div style={{ padding: 8, color: 'var(--color-dim)' }}>No data for stage: {astStage}</div>
      )}
    </div>
  );
}
