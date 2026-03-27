import type { Meta, StoryObj } from '@storybook/react';
import { Splitter } from './Splitter';
import { fn } from '@storybook/test';

const meta: Meta<typeof Splitter> = {
  title: 'Debugger/Splitter',
  component: Splitter,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div data-widget="gnosis-workbench" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 300, height: 300 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Splitter>;

export const Horizontal: Story = {
  args: {
    direction: 'horizontal',
    onResize: fn(),
    onDoubleClick: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ width: 300 }}>
        <div style={{ height: 100, background: 'var(--color-bg2)' }} />
        <Story />
        <div style={{ height: 100, background: 'var(--color-bg2)' }} />
      </div>
    ),
  ],
};

export const Vertical: Story = {
  args: {
    direction: 'vertical',
    onResize: fn(),
    onDoubleClick: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', height: 200 }}>
        <div style={{ width: 100, background: 'var(--color-bg2)' }} />
        <Story />
        <div style={{ width: 100, background: 'var(--color-bg2)' }} />
      </div>
    ),
  ],
};
