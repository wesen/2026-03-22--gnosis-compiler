import type { Meta, StoryObj } from '@storybook/react';
import { StoreDecorator } from '../../../test/storeFactory';
import { MOCK_COMPILE_RESULT } from '../../../test/mockData';
import { HexPanel } from './HexPanel';

const meta: Meta<typeof HexPanel> = {
  title: 'Inspector/HexPanel',
  component: HexPanel,
};

export default meta;
type Story = StoryObj<typeof HexPanel>;

export const Default: Story = {
  render: () => (
    <StoreDecorator overrides={{ compiler: { compileResult: MOCK_COMPILE_RESULT } as never }}>
      <HexPanel />
    </StoreDecorator>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoreDecorator>
      <HexPanel />
    </StoreDecorator>
  ),
};
