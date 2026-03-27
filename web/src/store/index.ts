import { configureStore } from '@reduxjs/toolkit';
import { compilerApi } from './api';
import compilerReducer from './slices/compilerSlice';
import inspectorReducer from './slices/inspectorSlice';
import dynamicReducer from './slices/dynamicSlice';
import debuggerReducer from './slices/debuggerSlice';

export const store = configureStore({
  reducer: {
    compiler: compilerReducer,
    inspector: inspectorReducer,
    dynamic: dynamicReducer,
    debugger: debuggerReducer,
    [compilerApi.reducerPath]: compilerApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(compilerApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
