import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * GNOSIS-003 dynamic VM state — stub for Phase 7.
 * Will hold runtime payloads, debugger snapshots, slot tables, stack state.
 */

interface DynamicRuntime {
  name: string;
  data: string;
}

interface DebuggerState {
  pc: number;
  phase: 'idle' | 'measure' | 'compute' | 'render' | 'halted';
  stepHistory: unknown[];
}

interface DynamicState {
  runtimeA: DynamicRuntime;
  runtimeB: DynamicRuntime;
  compareEnabled: boolean;
  debugger: DebuggerState;
}

const initialState: DynamicState = {
  runtimeA: { name: 'Runtime A', data: '' },
  runtimeB: { name: 'Runtime B', data: '' },
  compareEnabled: false,
  debugger: {
    pc: 0,
    phase: 'idle',
    stepHistory: [],
  },
};

const dynamicSlice = createSlice({
  name: 'dynamic',
  initialState,
  reducers: {
    setRuntimeA(state, action: PayloadAction<DynamicRuntime>) {
      state.runtimeA = action.payload;
    },
    setRuntimeB(state, action: PayloadAction<DynamicRuntime>) {
      state.runtimeB = action.payload;
    },
    setCompareEnabled(state, action: PayloadAction<boolean>) {
      state.compareEnabled = action.payload;
    },
    resetDebugger(state) {
      state.debugger = { pc: 0, phase: 'idle', stepHistory: [] };
    },
  },
});

export const {
  setRuntimeA,
  setRuntimeB,
  setCompareEnabled,
  resetDebugger,
} = dynamicSlice.actions;

export default dynamicSlice.reducer;
