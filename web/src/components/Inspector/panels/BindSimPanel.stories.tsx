import type { Meta, StoryObj } from '@storybook/react';
import { StoreDecorator } from '../../../test/storeFactory';
import { MOCK_COMPILE_RESULT } from '../../../test/mockData';
import { BindSimPanel } from './BindSimPanel';

const meta: Meta<typeof BindSimPanel> = {
  title: 'Inspector/BindSimPanel',
  component: BindSimPanel,
};

export default meta;
type Story = StoryObj<typeof BindSimPanel>;

export const Default: Story = {
  render: () => (
    <StoreDecorator overrides={{ compiler: { compileResult: MOCK_COMPILE_RESULT } as never }}>
      <BindSimPanel />
    </StoreDecorator>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoreDecorator>
      <BindSimPanel />
    </StoreDecorator>
  ),
};
