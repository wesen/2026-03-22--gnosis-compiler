import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type OverlayKey = 'bounds' | 'dirty' | 'depth';

interface CanvasState {
  overlays: Record<OverlayKey, boolean>;
  hoverInfo: string;
}

const initialState: CanvasState = {
  overlays: {
    bounds: false,
    dirty: false,
    depth: false,
  },
  hoverInfo: '',
};

const canvasSlice = createSlice({
  name: 'canvas',
  initialState,
  reducers: {
    toggleOverlay(state, action: PayloadAction<OverlayKey>) {
      state.overlays[action.payload] = !state.overlays[action.payload];
    },
    setHoverInfo(state, action: PayloadAction<string>) {
      state.hoverInfo = action.payload;
    },
  },
});

export const { toggleOverlay, setHoverInfo } = canvasSlice.actions;
export default canvasSlice.reducer;
