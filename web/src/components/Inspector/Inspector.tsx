import { useAppSelector } from '../../store/hooks';
import { PARTS } from './parts';

/**
 * Inspector shell — renders the active panel.
 * Panel components are registered in Phase 5.
 */
export function Inspector() {
  const activeTab = useAppSelector((s) => s.inspector.activeTab);
  const inspectorHeight = useAppSelector((s) => s.inspector.inspectorHeight);

  return (
    <div data-part={PARTS.inspector} style={{ height: inspectorHeight }}>
      <pre style={{ padding: 8, color: 'var(--color-dim)' }}>
        Panel: {activeTab} (panels coming in Phase 5)
      </pre>
    </div>
  );
}
