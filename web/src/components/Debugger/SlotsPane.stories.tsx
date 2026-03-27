import type { Meta, StoryObj } from '@storybook/react';
import { StoreDecorator } from '../../test/storeFactory';
import { SlotsPane } from './SlotsPane';
import { mockSnapshotStep2, mockSnapshotWithChanges } from '../../test/mockDebugger';
import type { DebugSnapshot } from '../../engine/gndy';

function dbgState(snapshot: DebugSnapshot, hideZero = false) {
  return {
    debugger: {
      status: 'running' as const,
      snapshot,
      breakpoints: [],
      historyDepth: 2,
      layout: { canvasHeightPercent: 0.4, disasmWidthPercent: 0.5, slotsHeightPercent: 0.65, hideZeroNodes: hideZero },
      highlightedNode: null,
      error: null,
      oracleMismatches: null,
      selectedRuntimeName: 'Normal readings',
    },
  };
}

const meta: Meta<typeof SlotsPane> = {
  title: 'Debugger/SlotsPane',
  component: SlotsPane,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <StoreDecorator overrides={dbgState(mockSnapshotStep2)}>
        <div style={{ height: 300, width: 400, overflow: 'hidden' }}>
          <Story />
        </div>
      </StoreDecorator>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SlotsPane>;

export const Default: Story = {};

export const WithChanges: Story = {
  decorators: [
    (Story) => (
      <StoreDecorator overrides={dbgState(mockSnapshotWithChanges)}>
        <div style={{ height: 300, width: 400, overflow: 'hidden' }}>
          <Story />
        </div>
      </StoreDecorator>
    ),
  ],
};

export const HideZeroNodes: Story = {
  decorators: [
    (Story) => (
      <StoreDecorator overrides={dbgState(mockSnapshotStep2, true)}>
        <div style={{ height: 300, width: 400, overflow: 'hidden' }}>
          <Story />
        </div>
      </StoreDecorator>
    ),
  ],
};
