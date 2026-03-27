import type { Meta, StoryObj } from '@storybook/react';
import { StoreDecorator } from '../../test/storeFactory';
import { Inspector } from './Inspector';
import { TabBar } from './TabBar';

const meta: Meta<typeof Inspector> = {
  title: 'Components/Inspector',
  component: Inspector,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <StoreDecorator>
        <div style={{ width: 600, height: 300, display: 'flex', flexDirection: 'column' }}>
          <TabBar />
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Story />
          </div>
        </div>
      </StoreDecorator>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Inspector>;

export const Default: Story = {};
