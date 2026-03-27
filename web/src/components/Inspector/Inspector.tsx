import { useAppSelector } from '../../store/hooks';
import { getPanelById, getPanelsForMode } from './panelRegistry';
import { PARTS } from './parts';

export function Inspector() {
  const activeTab = useAppSelector((s) => s.inspector.activeTab);
  const mode = useAppSelector((s) => s.compiler.mode);

  // Find the panel; fall back to first available in current mode
  const panel = getPanelById(activeTab);
  const modePanels = getPanelsForMode(mode);
  const effectivePanel = panel && panel.modes.includes(mode) ? panel : modePanels[0];

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
