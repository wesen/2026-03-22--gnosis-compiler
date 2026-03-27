import type { FC } from 'react';
import { useAppSelector } from '../../store/hooks';
import { PARTS } from './parts';
import { DisassemblyPanel } from './panels/DisassemblyPanel';
import { ASTPanel } from './panels/ASTPanel';
import { HexPanel } from './panels/HexPanel';
import { StatsPanel } from './panels/StatsPanel';
import { ManifestPanel } from './panels/ManifestPanel';
import { RegionsPanel } from './panels/RegionsPanel';
import { BindSimPanel } from './panels/BindSimPanel';

const PANELS: Record<string, FC> = {
  disasm: DisassemblyPanel,
  ast: ASTPanel,
  hex: HexPanel,
  stats: StatsPanel,
  manifest: ManifestPanel,
  regions: RegionsPanel,
  bindsim: BindSimPanel,
};

export function Inspector() {
  const activeTab = useAppSelector((s) => s.inspector.activeTab);
  const inspectorHeight = useAppSelector((s) => s.inspector.inspectorHeight);

  const Panel = PANELS[activeTab] ?? DisassemblyPanel;

  return (
    <div data-part={PARTS.inspector} style={{ height: inspectorHeight }}>
      <Panel />
    </div>
  );
}
