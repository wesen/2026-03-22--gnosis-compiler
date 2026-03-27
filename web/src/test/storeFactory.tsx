import React from 'react';
import { Provider } from 'react-redux';
import { configureStore, type Reducer } from '@reduxjs/toolkit';
import compilerReducer from '../store/slices/compilerSlice';
import inspectorReducer from '../store/slices/inspectorSlice';
import dynamicReducer from '../store/slices/dynamicSlice';
import debuggerReducer from '../store/slices/debuggerSlice';
import { compilerApi } from '../store/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function makeStore(overrides: Record<string, any> = {}) {
  const reducers = {
    compiler: compilerReducer,
    inspector: inspectorReducer,
    dynamic: dynamicReducer,
    debugger: debuggerReducer,
    [compilerApi.reducerPath]: compilerApi.reducer,
  };

  // Wrap each reducer to inject overrides as initial state
  const wrappedReducers: typeof reducers = { ...reducers };
  for (const [key, override] of Object.entries(overrides)) {
    const original = reducers[key as keyof typeof reducers] as Reducer | undefined;
    if (original) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (wrappedReducers as any)[key] = (state: any, action: any) =>
        original(state ?? override, action);
    }
  }

  return configureStore({
    reducer: wrappedReducers,
    middleware: (getDefault) => getDefault().concat(compilerApi.middleware),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function StoreDecorator({ children, overrides = {} }: { children: React.ReactNode; overrides?: Record<string, any> }) {
  return (
    <div data-widget="gnosis-workbench">
      <Provider store={makeStore(overrides)}>
        {children}
      </Provider>
    </div>
  );
}
