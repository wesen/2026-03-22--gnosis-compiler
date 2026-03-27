import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CompileResponse } from '../../types/api';
import { compilerApi } from '../api';

export type CompilerMode = 'static' | 'dynamic';

interface CompilerState {
  mode: CompilerMode;
  sourceText: string;
  propsText: string;
  compileResult: CompileResponse | null;
  compileStatus: 'idle' | 'compiling' | 'success' | 'error';
  error: string | null;
  bindValues: Record<string, string>;
  autoCompile: boolean;
  selectedPreset: string;
}

const initialState: CompilerState = {
  mode: 'dynamic',
  sourceText: '',
  propsText: '',
  compileResult: null,
  compileStatus: 'idle',
  error: null,
  bindValues: {},
  autoCompile: true,
  selectedPreset: '',
};

const compilerSlice = createSlice({
  name: 'compiler',
  initialState,
  reducers: {
    setMode(state, action: PayloadAction<CompilerMode>) {
      state.mode = action.payload;
    },
    setSourceText(state, action: PayloadAction<string>) {
      state.sourceText = action.payload;
    },
    setPropsText(state, action: PayloadAction<string>) {
      state.propsText = action.payload;
    },
    setAutoCompile(state, action: PayloadAction<boolean>) {
      state.autoCompile = action.payload;
    },
    setBindValue(state, action: PayloadAction<{ name: string; value: string }>) {
      state.bindValues[action.payload.name] = action.payload.value;
    },
    setSelectedPreset(state, action: PayloadAction<string>) {
      state.selectedPreset = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(compilerApi.endpoints.compile.matchPending, (state) => {
        state.compileStatus = 'compiling';
        state.error = null;
      })
      .addMatcher(compilerApi.endpoints.compile.matchFulfilled, (state, action) => {
        const data = action.payload;
        if (!data.success) {
          state.compileStatus = 'error';
          state.error = data.error ?? 'Unknown error';
          return;
        }
        state.compileStatus = 'success';
        state.compileResult = data;
        state.error = null;
        // Initialize bind values for any new binds
        for (const b of data.program.binds) {
          if (!(b in state.bindValues)) {
            state.bindValues[b] = '';
          }
        }
      })
      .addMatcher(compilerApi.endpoints.compile.matchRejected, (state, action) => {
        state.compileStatus = 'error';
        state.error = action.error.message ?? 'Network error';
      });
  },
});

export const {
  setMode,
  setSourceText,
  setPropsText,
  setAutoCompile,
  setBindValue,
  setSelectedPreset,
  clearError,
} = compilerSlice.actions;

export default compilerSlice.reducer;
