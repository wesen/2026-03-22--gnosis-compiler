import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface InspectorState {
  activeTab: string;
  inspectorHeight: number;
  astStage: string;
  highlightPc: number;
}

const initialState: InspectorState = {
  activeTab: 'disasm',
  inspectorHeight: 260,
  astStage: 'laid_out',
  highlightPc: -1,
};

const inspectorSlice = createSlice({
  name: 'inspector',
  initialState,
  reducers: {
    setActiveTab(state, action: PayloadAction<string>) {
      state.activeTab = action.payload;
    },
    setInspectorHeight(state, action: PayloadAction<number>) {
      state.inspectorHeight = action.payload;
    },
    setAstStage(state, action: PayloadAction<string>) {
      state.astStage = action.payload;
    },
    setHighlightPc(state, action: PayloadAction<number>) {
      state.highlightPc = action.payload;
    },
  },
});

export const {
  setActiveTab,
  setInspectorHeight,
  setAstStage,
  setHighlightPc,
} = inspectorSlice.actions;

export default inspectorSlice.reducer;
