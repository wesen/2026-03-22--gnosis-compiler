import type { Meta, StoryObj } from '@storybook/react';
import { StoreDecorator } from '../../../test/storeFactory';
import { MOCK_COMPILE_RESULT } from '../../../test/mockData';
import { ASTPanel } from './ASTPanel';

const meta: Meta<typeof ASTPanel> = {
  title: 'Inspector/ASTPanel',
  component: ASTPanel,
};

export default meta;
type Story = StoryObj<typeof ASTPanel>;

export const Default: Story = {
  render: () => (
    <StoreDecorator overrides={{ compiler: { compileResult: MOCK_COMPILE_RESULT } as never }}>
      <ASTPanel />
    </StoreDecorator>
  ),
};

export const Empty: Story = {
  render: () => (
    <StoreDecorator>
      <ASTPanel />
    </StoreDecorator>
  ),
};
