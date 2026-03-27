import { useAppSelector } from '../../store/hooks';
import { getPanelById, getPanels } from './panelRegistry';
import { PARTS } from './parts';

export function Inspector() {
  const activeTab = useAppSelector((s) => s.inspector.activeTab);

  const panel = getPanelById(activeTab);
  const panels = getPanels();
  const effectivePanel = panel ?? panels[0];

  const Panel = effectivePanel?.component;

  return (
    <div data-part={PARTS.inspector}>
      {Panel ? (
        <Panel />
      ) : (
        <pre style={{ padding: 8, color: 'var(--color-dim)' }}>No panel available</pre>
      )}
    </div>
  );
}
