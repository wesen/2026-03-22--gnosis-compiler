import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DynamicCompileResponse, RuntimePayload } from '../../types/api';
import { compilerApi } from '../api';

interface DynamicState {
  runtimes: RuntimePayload[];
  compileResult: DynamicCompileResponse | null;
  compileStatus: 'idle' | 'compiling' | 'success' | 'error';
  error: string | null;
  selectedEvaluation: number;
  compareEnabled: boolean;
}

const initialState: DynamicState = {
  runtimes: [],
  compileResult: null,
  compileStatus: 'idle',
  error: null,
  selectedEvaluation: 0,
  compareEnabled: false,
};

const dynamicSlice = createSlice({
  name: 'dynamic',
  initialState,
  reducers: {
    setRuntimes(state, action: PayloadAction<RuntimePayload[]>) {
      state.runtimes = action.payload;
    },
    setSelectedEvaluation(state, action: PayloadAction<number>) {
      state.selectedEvaluation = action.payload;
    },
    setCompareEnabled(state, action: PayloadAction<boolean>) {
      state.compareEnabled = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher(compilerApi.endpoints.compileDynamic.matchPending, (state) => {
        state.compileStatus = 'compiling';
        state.error = null;
      })
      .addMatcher(compilerApi.endpoints.compileDynamic.matchFulfilled, (state, action) => {
        const data = action.payload;
        if (!data.success) {
          state.compileStatus = 'error';
          state.error = data.error ?? 'Unknown error';
          return;
        }
        state.compileStatus = 'success';
        state.compileResult = data;
        state.error = null;
      })
      .addMatcher(compilerApi.endpoints.compileDynamic.matchRejected, (state, action) => {
        state.compileStatus = 'error';
        state.error = action.error.message ?? 'Network error';
      });
  },
});

export const {
  setRuntimes,
  setSelectedEvaluation,
  setCompareEnabled,
} = dynamicSlice.actions;

export default dynamicSlice.reducer;
