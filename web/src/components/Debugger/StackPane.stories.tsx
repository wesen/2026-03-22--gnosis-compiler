import type { Meta, StoryObj } from '@storybook/react';
import { StoreDecorator } from '../../test/storeFactory';
import { StackPane } from './StackPane';
import { mockProgram, mockSnapshotStep2, mockSnapshotWithStack, mockSnapshotHalted } from '../../test/mockDebugger';
import type { DebugSnapshot } from '../../engine/gndy';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DP = require('../Inspector/panels/DebuggerPanel') as any;

function dbgState(snapshot: DebugSnapshot) {
  return {
    debugger: {
      status: snapshot.halted ? 'halted' : 'running',
      snapshot,
      breakpoints: [],
      historyDepth: 2,
      layout: { canvasHeightPercent: 0.4, disasmWidthPercent: 0.5, slotsHeightPercent: 0.65, hideZeroNodes: false },
      highlightedNode: null,
      error: null,
      oracleMismatches: null,
      selectedRuntimeName: 'Normal readings',
    },
  };
}

const meta: Meta<typeof StackPane> = {
  title: 'Debugger/StackPane',
  component: StackPane,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => {
      DP._program = mockProgram;
      return (
        <StoreDecorator overrides={dbgState(mockSnapshotStep2)}>
          <div style={{ height: 200, width: 300, overflow: 'hidden' }}>
            <Story />
          </div>
        </StoreDecorator>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof StackPane>;

export const SingleEntry: Story = {};

export const MultipleEntries: Story = {
  decorators: [
    (Story) => {
      DP._program = mockProgram;
      return (
        <StoreDecorator overrides={dbgState(mockSnapshotWithStack)}>
          <div style={{ height: 200, width: 300, overflow: 'hidden' }}>
            <Story />
          </div>
        </StoreDecorator>
      );
    },
  ],
};

export const EmptyStack: Story = {
  decorators: [
    (Story) => {
      DP._program = mockProgram;
      return (
        <StoreDecorator overrides={dbgState(mockSnapshotHalted)}>
          <div style={{ height: 200, width: 300, overflow: 'hidden' }}>
            <Story />
          </div>
        </StoreDecorator>
      );
    },
  ],
};
