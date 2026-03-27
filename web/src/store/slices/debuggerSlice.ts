import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DebugSnapshot } from '../../engine/gndy';

export type DebuggerStatus = 'idle' | 'ready' | 'running' | 'halted' | 'error';

export interface DebuggerLayout {
  canvasHeightPercent: number;   // 0.3–0.7, default 0.4
  disasmWidthPercent: number;    // 0.3–0.7, default 0.5
  slotsHeightPercent: number;    // 0.3–0.8, default 0.65
  hideZeroNodes: boolean;
}

interface DebuggerState {
  status: DebuggerStatus;
  /** Name of the runtime currently loaded into the debugger. */
  selectedRuntimeName: string | null;
  /** Current debugger snapshot (null when idle). */
  snapshot: DebugSnapshot | null;
  /** Breakpoint PC offsets. */
  breakpoints: number[];
  /** Number of steps available for step-back. */
  historyDepth: number;
  /** Error message if status is 'error'. */
  error: string | null;

  /** Oracle validation: mismatch count after a full run vs backend eval. */
  oracleMismatches: number | null;

  /** Multi-pane layout percentages. */
  layout: DebuggerLayout;
  /** Node index highlighted across all panes (null = none). */
  highlightedNode: number | null;
}

const initialState: DebuggerState = {
  status: 'idle',
  selectedRuntimeName: null,
  snapshot: null,
  breakpoints: [],
  historyDepth: 0,
  error: null,
  oracleMismatches: null,
  layout: {
    canvasHeightPercent: 0.4,
    disasmWidthPercent: 0.5,
    slotsHeightPercent: 0.65,
    hideZeroNodes: false,
  },
  highlightedNode: null,
};

const debuggerSlice = createSlice({
  name: 'debugger',
  initialState,
  reducers: {
    loadDebugger(state, action: PayloadAction<{ runtimeName: string; snapshot: DebugSnapshot }>) {
      state.status = 'ready';
      state.selectedRuntimeName = action.payload.runtimeName;
      state.snapshot = action.payload.snapshot;
      state.historyDepth = 0;
      state.error = null;
      state.oracleMismatches = null;
    },
    updateSnapshot(state, action: PayloadAction<{ snapshot: DebugSnapshot; historyDepth: number }>) {
      state.snapshot = action.payload.snapshot;
      state.historyDepth = action.payload.historyDepth;
      state.status = action.payload.snapshot.halted ? 'halted' : 'running';
    },
    resetDebugger(state, action: PayloadAction<DebugSnapshot>) {
      state.snapshot = action.payload;
      state.status = 'ready';
      state.historyDepth = 0;
      state.oracleMismatches = null;
    },
    setBreakpoints(state, action: PayloadAction<number[]>) {
      state.breakpoints = action.payload;
    },
    setOracleMismatches(state, action: PayloadAction<number>) {
      state.oracleMismatches = action.payload;
    },
    clearDebugger(state) {
      state.status = 'idle';
      state.selectedRuntimeName = null;
      state.snapshot = null;
      state.breakpoints = [];
      state.historyDepth = 0;
      state.error = null;
      state.oracleMismatches = null;
    },
    setDebuggerError(state, action: PayloadAction<string>) {
      state.status = 'error';
      state.error = action.payload;
    },
    setCanvasHeight(state, action: PayloadAction<number>) {
      state.layout.canvasHeightPercent = Math.max(0.2, Math.min(0.8, action.payload));
    },
    setDisasmWidth(state, action: PayloadAction<number>) {
      state.layout.disasmWidthPercent = Math.max(0.2, Math.min(0.8, action.payload));
    },
    setSlotsHeight(state, action: PayloadAction<number>) {
      state.layout.slotsHeightPercent = Math.max(0.2, Math.min(0.8, action.payload));
    },
    setHideZeroNodes(state, action: PayloadAction<boolean>) {
      state.layout.hideZeroNodes = action.payload;
    },
    setHighlightedNode(state, action: PayloadAction<number | null>) {
      state.highlightedNode = action.payload;
    },
  },
});

export const {
  loadDebugger,
  updateSnapshot,
  resetDebugger,
  setBreakpoints,
  setOracleMismatches,
  clearDebugger,
  setDebuggerError,
  setCanvasHeight,
  setDisasmWidth,
  setSlotsHeight,
  setHideZeroNodes,
  setHighlightedNode,
} = debuggerSlice.actions;

export default debuggerSlice.reducer;
