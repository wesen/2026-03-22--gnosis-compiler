import { registerPanel } from './panelRegistry';
import { DisassemblyPanel } from './panels/DisassemblyPanel';
import { ASTPanel } from './panels/ASTPanel';
import { HexPanel } from './panels/HexPanel';
import { StatsPanel } from './panels/StatsPanel';
import { ManifestPanel } from './panels/ManifestPanel';
import { RegionsPanel } from './panels/RegionsPanel';
import { BindSimPanel } from './panels/BindSimPanel';

// Static-mode panels (also available in dynamic for common ones)
registerPanel({ id: 'disasm', label: 'DISASSEMBLY', modes: ['static', 'dynamic'], component: DisassemblyPanel });
registerPanel({ id: 'ast', label: 'AST', modes: ['static'], component: ASTPanel });
registerPanel({ id: 'hex', label: 'HEX', modes: ['static', 'dynamic'], component: HexPanel });
registerPanel({ id: 'stats', label: 'STATS', modes: ['static'], component: StatsPanel });
registerPanel({ id: 'manifest', label: 'MANIFEST', modes: ['static', 'dynamic'], component: ManifestPanel });
registerPanel({ id: 'regions', label: 'REGIONS', modes: ['static'], component: RegionsPanel });
registerPanel({ id: 'bindsim', label: 'BIND SIM', modes: ['static'], component: BindSimPanel });

// GNOSIS-003 will add:
// registerPanel({ id: 'slots', label: 'SLOTS', modes: ['dynamic'], component: SlotsPanel });
// registerPanel({ id: 'stack', label: 'STACK', modes: ['dynamic'], component: StackPanel });
// registerPanel({ id: 'ir', label: 'IR', modes: ['dynamic'], component: IRPanel });
// registerPanel({ id: 'eval', label: 'EVAL', modes: ['dynamic'], component: EvalPanel });
// registerPanel({ id: 'compare', label: 'COMPARE', modes: ['dynamic'], component: ComparePanel });
// registerPanel({ id: 'debugger', label: 'DEBUGGER', modes: ['dynamic'], component: DebuggerPanel });
