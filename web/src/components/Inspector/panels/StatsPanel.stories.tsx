import type { Meta, StoryObj } from '@storybook/react';
import { StoreDecorator } from '../../../test/storeFactory';
import { MOCK_COMPILE_RESULT } from '../../../test/mockData';
import { StatsPanel } from './StatsPanel';

const meta: Meta<typeof StatsPanel> = {
  title: 'Inspector/StatsPanel',
  component: StatsPanel,
};

export default meta;
type Story = StoryObj<typeof StatsPanel>;

export const Default: Story = {
  render: () => (
    <StoreDecorator overrides={{ compiler: { compileResult: MOCK_COMPILE_RESULT } as never }}>
      <StatsPanel />
    </StoreDecorator>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoreDecorator>
      <StatsPanel />
    </StoreDecorator>
  ),
};
