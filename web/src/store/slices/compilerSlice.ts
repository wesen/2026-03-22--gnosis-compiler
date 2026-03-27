import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface CompilerState {
  sourceText: string;
  autoCompile: boolean;
  selectedPreset: string;
}

const initialState: CompilerState = {
  sourceText: '',
  autoCompile: true,
  selectedPreset: '',
};

const compilerSlice = createSlice({
  name: 'compiler',
  initialState,
  reducers: {
    setSourceText(state, action: PayloadAction<string>) {
      state.sourceText = action.payload;
    },
    setAutoCompile(state, action: PayloadAction<boolean>) {
      state.autoCompile = action.payload;
    },
    setSelectedPreset(state, action: PayloadAction<string>) {
      state.selectedPreset = action.payload;
    },
  },
});

export const { setSourceText, setAutoCompile, setSelectedPreset } = compilerSlice.actions;

export default compilerSlice.reducer;
