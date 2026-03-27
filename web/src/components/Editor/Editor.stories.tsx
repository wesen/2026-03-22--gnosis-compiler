import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Editor } from './Editor';
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

const meta: Meta<typeof Editor> = {
  title: 'Shell/Editor',
  component: Editor,
  decorators: [
    (Story) => (
      <div data-widget="gnosis-workbench" style={{ width: 380, height: 600 }}>
        <Provider store={makeStore()}>
          <Story />
        </Provider>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Editor>;

export const Default: Story = {};

export const WithSource: Story = {
  decorators: [
    (Story) => (
      <div data-widget="gnosis-workbench" style={{ width: 380, height: 600 }}>
        <Provider store={makeStore({ compiler: { mode: 'static', sourceText: 'type: screen\nwidth: 400\nheight: 300', propsText: '', compileResult: null, compileStatus: 'idle', error: null, bindValues: {}, autoCompile: true }, editor: { activeTab: 'source' } })}>
          <Story />
        </Provider>
      </div>
    ),
  ],
};

export const WithError: Story = {
  decorators: [
    (Story) => (
      <div data-widget="gnosis-workbench" style={{ width: 380, height: 600 }}>
        <Provider store={makeStore({ compiler: { mode: 'static', sourceText: 'bad yaml', propsText: '', compileResult: null, compileStatus: 'error', error: 'Invalid YAML at line 1', bindValues: {}, autoCompile: true }, editor: { activeTab: 'source' } })}>
          <Story />
        </Provider>
      </div>
    ),
  ],
};
