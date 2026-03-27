import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Canvas } from './Canvas';
import compilerReducer from '../../store/slices/compilerSlice';
import editorReducer from '../../store/slices/editorSlice';
import inspectorReducer from '../../store/slices/inspectorSlice';
import canvasReducer from '../../store/slices/canvasSlice';
import { compilerApi } from '../../store/api';

function makeStore(overrides = {}) {
  return configureStore({
    reducer: {
      compiler: compilerReducer,
      editor: editorReducer,
      inspector: inspectorReducer,
      canvas: canvasReducer,
      [compilerApi.reducerPath]: compilerApi.reducer,
    },
    middleware: (getDefault) => getDefault().concat(compilerApi.middleware),
    preloadedState: overrides,
  });
}

const meta: Meta<typeof Canvas> = {
  title: 'Shell/Canvas',
  component: Canvas,
  decorators: [
    (Story) => (
      <div data-widget="gnosis-workbench" style={{ position: 'relative', width: 800, height: 600 }}>
        <Provider store={makeStore()}>
          <Story />
        </Provider>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Canvas>;

export const Empty: Story = {};
