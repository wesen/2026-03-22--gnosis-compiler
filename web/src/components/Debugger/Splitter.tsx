import { useCallback, useRef } from 'react';
import { PARTS } from './parts';

interface SplitterProps {
  direction: 'horizontal' | 'vertical';
  onResize: (deltaPx: number) => void;
  onDoubleClick?: () => void;
}

export function Splitter({ direction, onResize, onDoubleClick }: SplitterProps) {
  const dragging = useRef(false);
  const lastPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      lastPos.current = direction === 'horizontal' ? e.clientY : e.clientX;
      const cursor = direction === 'horizontal' ? 'ns-resize' : 'ew-resize';
      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';

      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const pos = direction === 'horizontal' ? ev.clientY : ev.clientX;
        const delta = pos - lastPos.current;
        lastPos.current = pos;
        onResize(delta);
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
    [direction, onResize],
  );

  return (
    <div
      data-part={PARTS.splitter}
      data-direction={direction}
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
    />
  );
}
