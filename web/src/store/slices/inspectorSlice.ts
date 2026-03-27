import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface InspectorState {
  activeTab: string;
  inspectorHeight: number;
  highlightPc: number;
}

const initialState: InspectorState = {
  activeTab: 'eval',
  inspectorHeight: 260,
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
    setHighlightPc(state, action: PayloadAction<number>) {
      state.highlightPc = action.payload;
    },
  },
});

export const { setActiveTab, setInspectorHeight, setHighlightPc } = inspectorSlice.actions;

export default inspectorSlice.reducer;
