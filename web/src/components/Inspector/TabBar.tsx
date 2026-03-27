import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setActiveTab } from '../../store/slices/inspectorSlice';
import { PARTS } from './parts';

export interface TabDef {
  id: string;
  label: string;
}

const TABS: TabDef[] = [
  { id: 'disasm', label: 'DISASSEMBLY' },
  { id: 'ast', label: 'AST' },
  { id: 'hex', label: 'HEX' },
  { id: 'stats', label: 'STATS' },
  { id: 'manifest', label: 'MANIFEST' },
  { id: 'regions', label: 'REGIONS' },
  { id: 'bindsim', label: 'BIND SIM' },
];

export function TabBar() {
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector((s) => s.inspector.activeTab);

  return (
    <div data-part={PARTS.tabBar}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          data-state={activeTab === tab.id ? 'active' : undefined}
          onClick={() => dispatch(setActiveTab(tab.id))}
        >
          {tab.label}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <span data-part={PARTS.tabInfo} />
    </div>
  );
}
