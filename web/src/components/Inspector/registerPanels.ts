import { registerPanel } from './panelRegistry';
import { EvalPanel } from './panels/EvalPanel';
import { DisassemblyPanel } from './panels/DisassemblyPanel';
import { IRPanel } from './panels/IRPanel';
import { HexPanel } from './panels/HexPanel';
import { ManifestPanel } from './panels/ManifestPanel';
import { DebuggerPanel } from './panels/DebuggerPanel';
import { SlotsPanel } from './panels/SlotsPanel';
import { StackPanel } from './panels/StackPanel';

registerPanel({ id: 'debugger', label: 'DEBUGGER', component: DebuggerPanel });
registerPanel({ id: 'eval', label: 'EVAL', component: EvalPanel });
registerPanel({ id: 'slots', label: 'SLOTS', component: SlotsPanel });
registerPanel({ id: 'stack', label: 'STACK', component: StackPanel });
registerPanel({ id: 'disasm', label: 'DISASSEMBLY', component: DisassemblyPanel });
registerPanel({ id: 'ir', label: 'IR', component: IRPanel });
registerPanel({ id: 'hex', label: 'HEX', component: HexPanel });
registerPanel({ id: 'manifest', label: 'MANIFEST', component: ManifestPanel });
