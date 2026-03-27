import { useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setInspectorHeight } from '../store/slices/inspectorSlice';

export function ResizeHandle() {
  const dispatch = useAppDispatch();
  const currentHeight = useAppSelector((s) => s.inspector.inspectorHeight);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      startY.current = e.clientY;
      startH.current = currentHeight;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = startY.current - ev.clientY;
        const newH = Math.max(80, Math.min(window.innerHeight - 200, startH.current + delta));
        dispatch(setInspectorHeight(newH));
      };

      const handleMouseUp = () => {
        dragging.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      e.preventDefault();
    },
    [dispatch, currentHeight],
  );

  return (
    <div
      data-part="resize-handle"
      data-state={dragging.current ? 'dragging' : undefined}
      onMouseDown={handleMouseDown}
    />
  );
}
