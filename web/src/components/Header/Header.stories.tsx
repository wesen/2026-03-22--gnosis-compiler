import type { Meta, StoryObj } from '@storybook/react';
import { StoreDecorator } from '../../test/storeFactory';
import { Header } from './Header';

const meta: Meta<typeof Header> = {
  title: 'Components/Header',
  component: Header,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <StoreDecorator>
        <Story />
      </StoreDecorator>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Header>;

export const Default: Story = {};

export const WithDebuggerControls: Story = {
  decorators: [
    (Story) => (
      <StoreDecorator overrides={{
        debugger: {
          status: 'running',
          snapshot: { pc: 0x0009, instrIndex: 2, phase: 'compute', halted: false, stack: [96], slots: [], drawOps: [], changedSlots: [] },
          breakpoints: [],
          historyDepth: 2,
          layout: { canvasHeightPercent: 0.4, disasmWidthPercent: 0.5, slotsHeightPercent: 0.65, hideZeroNodes: false },
          highlightedNode: null,
          error: null,
          oracleMismatches: null,
          selectedRuntimeName: 'Normal readings',
        },
      }}>
        <Story />
      </StoreDecorator>
    ),
  ],
};

export const WithOraclePass: Story = {
  decorators: [
    (Story) => (
      <StoreDecorator overrides={{
        debugger: {
          status: 'halted',
          snapshot: { pc: 0x0054, instrIndex: 14, phase: 'halted', halted: true, stack: [], slots: [], drawOps: [], changedSlots: [] },
          breakpoints: [],
          historyDepth: 14,
          layout: { canvasHeightPercent: 0.4, disasmWidthPercent: 0.5, slotsHeightPercent: 0.65, hideZeroNodes: false },
          highlightedNode: null,
          error: null,
          oracleMismatches: 0,
          selectedRuntimeName: 'Normal readings',
        },
      }}>
        <Story />
      </StoreDecorator>
    ),
  ],
};
