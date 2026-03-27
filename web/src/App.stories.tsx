import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'react-redux';
import { store } from './store';
import { App } from './App';

const meta: Meta<typeof App> = {
  title: 'App',
  component: App,
  decorators: [
    (Story) => (
      <Provider store={store}>
        <Story />
      </Provider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof App>;

export const Default: Story = {};
