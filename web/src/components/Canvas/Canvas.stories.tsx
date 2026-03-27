import type { Meta, StoryObj } from '@storybook/react';
import { StoreDecorator } from '../../test/storeFactory';
import { Canvas } from './Canvas';

const meta: Meta<typeof Canvas> = {
  title: 'Components/Canvas',
  component: Canvas,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <StoreDecorator>
        <div style={{ width: 600, height: 300 }}>
          <Story />
        </div>
      </StoreDecorator>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Canvas>;

export const Empty: Story = {};
