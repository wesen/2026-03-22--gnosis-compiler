import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setActiveTab } from '../../store/slices/inspectorSlice';
import { getPanels } from './panelRegistry';
import { PARTS } from './parts';

export function TabBar() {
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector((s) => s.inspector.activeTab);
  const panels = getPanels();

  return (
    <div data-part={PARTS.tabBar}>
      {panels.map((panel) => (
        <button
          key={panel.id}
          data-state={activeTab === panel.id ? 'active' : undefined}
          onClick={() => dispatch(setActiveTab(panel.id))}
        >
          {panel.label}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <span data-part={PARTS.tabInfo} />
    </div>
  );
}
