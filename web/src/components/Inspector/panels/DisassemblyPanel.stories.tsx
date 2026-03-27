import type { Meta, StoryObj } from '@storybook/react';
import { StoreDecorator } from '../../../test/storeFactory';
import { MOCK_COMPILE_RESULT } from '../../../test/mockData';
import { DisassemblyPanel } from './DisassemblyPanel';

const meta: Meta<typeof DisassemblyPanel> = {
  title: 'Inspector/DisassemblyPanel',
  component: DisassemblyPanel,
};

export default meta;
type Story = StoryObj<typeof DisassemblyPanel>;

export const Default: Story = {
  render: () => (
    <StoreDecorator overrides={{ compiler: { compileResult: MOCK_COMPILE_RESULT } as never }}>
      <DisassemblyPanel />
    </StoreDecorator>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoreDecorator>
      <DisassemblyPanel />
    </StoreDecorator>
  ),
};

export const Highlighted: Story = {
  render: () => (
    <StoreDecorator
      overrides={{
        compiler: { compileResult: MOCK_COMPILE_RESULT } as never,
        inspector: { activeTab: 'disasm', inspectorHeight: 260, astStage: 'laid_out', highlightPc: 0x14 },
      }}
    >
      <DisassemblyPanel />
    </StoreDecorator>
  ),
};
