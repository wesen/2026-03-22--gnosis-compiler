import type { Meta, StoryObj } from '@storybook/react';
import { StoreDecorator } from '../../test/storeFactory';
import { Editor } from './Editor';

const meta: Meta<typeof Editor> = {
  title: 'Components/Editor',
  component: Editor,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <StoreDecorator>
        <div style={{ width: 380, height: 500 }}>
          <Story />
        </div>
      </StoreDecorator>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Editor>;

export const Empty: Story = {};

export const WithSource: Story = {
  decorators: [
    (Story) => (
      <StoreDecorator overrides={{
        compiler: {
          sourceText: 'type: screen\nwidth: 280\nheight: 120\nbody:\n  type: fixed\n  children:\n    - type: vbox\n      x: 8\n      y: 8',
          autoCompile: true,
          selectedPreset: 'sensor_dashboard',
        },
      }}>
        <div style={{ width: 380, height: 500 }}>
          <Story />
        </div>
      </StoreDecorator>
    ),
  ],
};
