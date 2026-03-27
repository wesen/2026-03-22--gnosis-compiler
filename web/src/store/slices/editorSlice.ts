import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type EditorTab = 'source' | 'props';

interface EditorState {
  activeTab: EditorTab;
}

const initialState: EditorState = {
  activeTab: 'source',
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setEditorTab(state, action: PayloadAction<EditorTab>) {
      state.activeTab = action.payload;
    },
  },
});

export const { setEditorTab } = editorSlice.actions;
export default editorSlice.reducer;
