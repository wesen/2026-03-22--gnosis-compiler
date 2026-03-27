import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { StoreDecorator } from '../../test/storeFactory';
import { DisassemblyPane } from './DisassemblyPane';
import { mockProgram, mockSnapshotStep2, mockSnapshotWithChanges, mockSnapshotHalted } from '../../test/mockDebugger';
import type { DebugSnapshot } from '../../engine/gndy';

// Inject mock program via module singleton
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DP = require('../Inspector/panels/DebuggerPanel') as any;

function dbgState(snapshot: DebugSnapshot) {
  return {
    debugger: {
      status: snapshot.halted ? 'halted' : 'running',
      snapshot,
      breakpoints: [0x0013],
      historyDepth: 2,
      layout: { canvasHeightPercent: 0.4, disasmWidthPercent: 0.5, slotsHeightPercent: 0.65, hideZeroNodes: false },
      highlightedNode: null,
      error: null,
      oracleMismatches: null,
      selectedRuntimeName: 'Normal readings',
    },
  };
}

const meta: Meta<typeof DisassemblyPane> = {
  title: 'Debugger/DisassemblyPane',
  component: DisassemblyPane,
  args: { onToggleBreakpoint: fn() },
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => {
      DP._program = mockProgram;
      return (
        <StoreDecorator overrides={dbgState(mockSnapshotStep2)}>
          <div style={{ height: 400, width: 500, overflow: 'hidden' }}>
            <Story />
          </div>
        </StoreDecorator>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof DisassemblyPane>;

export const AtStep2: Story = {};

export const WithChangedSlots: Story = {
  decorators: [
    (Story) => {
      DP._program = mockProgram;
      return (
        <StoreDecorator overrides={dbgState(mockSnapshotWithChanges)}>
          <div style={{ height: 400, width: 500, overflow: 'hidden' }}>
            <Story />
          </div>
        </StoreDecorator>
      );
    },
  ],
};

export const Halted: Story = {
  decorators: [
    (Story) => {
      DP._program = mockProgram;
      return (
        <StoreDecorator overrides={dbgState(mockSnapshotHalted)}>
          <div style={{ height: 400, width: 500, overflow: 'hidden' }}>
            <Story />
          </div>
        </StoreDecorator>
      );
    },
  ],
};
