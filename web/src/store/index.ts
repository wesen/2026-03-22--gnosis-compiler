import { configureStore } from '@reduxjs/toolkit';
import { compilerApi } from './api';
import compilerReducer from './slices/compilerSlice';
import editorReducer from './slices/editorSlice';
import inspectorReducer from './slices/inspectorSlice';
import canvasReducer from './slices/canvasSlice';

export const store = configureStore({
  reducer: {
    compiler: compilerReducer,
    editor: editorReducer,
    inspector: inspectorReducer,
    canvas: canvasReducer,
    [compilerApi.reducerPath]: compilerApi.reducer,
  },
  middleware: (getDefault) => getDefault().concat(compilerApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
