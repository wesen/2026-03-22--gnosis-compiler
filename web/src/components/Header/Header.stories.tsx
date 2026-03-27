import type { Meta, StoryObj } from '@storybook/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Header } from './Header';
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

const meta: Meta<typeof Header> = {
  title: 'Shell/Header',
  component: Header,
  decorators: [
    (Story) => (
      <div data-widget="gnosis-workbench">
        <Provider store={makeStore()}>
          <Story />
        </Provider>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Header>;

export const Default: Story = {};

export const Compiling: Story = {
  decorators: [
    (Story) => (
      <div data-widget="gnosis-workbench">
        <Provider store={makeStore({ compiler: { mode: 'static', sourceText: '', propsText: '', compileResult: null, compileStatus: 'compiling', error: null, bindValues: {}, autoCompile: true } })}>
          <Story />
        </Provider>
      </div>
    ),
  ],
};

export const WithError: Story = {
  decorators: [
    (Story) => (
      <div data-widget="gnosis-workbench">
        <Provider store={makeStore({ compiler: { mode: 'static', sourceText: '', propsText: '', compileResult: null, compileStatus: 'error', error: 'YAML parse error at line 3', bindValues: {}, autoCompile: true } })}>
          <Story />
        </Provider>
      </div>
    ),
  ],
};
