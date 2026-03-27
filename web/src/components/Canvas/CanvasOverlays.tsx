import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toggleOverlay, type OverlayKey } from '../../store/slices/canvasSlice';
import { PARTS } from './parts';

const OVERLAY_BUTTONS: { key: OverlayKey; label: string }[] = [
  { key: 'bounds', label: 'BOUNDS' },
  { key: 'dirty', label: 'DIRTY' },
  { key: 'depth', label: 'DEPTH' },
];

export function CanvasOverlays() {
  const dispatch = useAppDispatch();
  const overlays = useAppSelector((s) => s.canvas.overlays);

  return (
    <div data-part={PARTS.overlayBar}>
      {OVERLAY_BUTTONS.map(({ key, label }) => (
        <button
          key={key}
          data-role="overlay-button"
          data-state={overlays[key] ? 'on' : undefined}
          onClick={() => dispatch(toggleOverlay(key))}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
