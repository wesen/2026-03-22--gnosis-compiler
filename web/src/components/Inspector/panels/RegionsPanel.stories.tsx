import type { Meta, StoryObj } from '@storybook/react';
import { StoreDecorator } from '../../../test/storeFactory';
import { MOCK_COMPILE_RESULT } from '../../../test/mockData';
import { RegionsPanel } from './RegionsPanel';

const meta: Meta<typeof RegionsPanel> = {
  title: 'Inspector/RegionsPanel',
  component: RegionsPanel,
};

export default meta;
type Story = StoryObj<typeof RegionsPanel>;

export const Default: Story = {
  render: () => (
    <StoreDecorator overrides={{ compiler: { compileResult: MOCK_COMPILE_RESULT } as never }}>
      <RegionsPanel />
    </StoreDecorator>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoreDecorator>
      <RegionsPanel />
    </StoreDecorator>
  ),
};
