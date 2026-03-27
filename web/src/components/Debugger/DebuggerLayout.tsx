import { useCallback, useRef } from 'react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import {
  setCanvasHeight,
  setDisasmWidth,
  setSlotsHeight,
  setBreakpoints,
} from '../../store/slices/debuggerSlice';
import { getDebuggerInstance } from '../Inspector/panels/DebuggerPanel';
import { CanvasPane } from './CanvasPane';
import { DisassemblyPane } from './DisassemblyPane';
import { SlotsPane } from './SlotsPane';
import { StackPane } from './StackPane';
import { Splitter } from './Splitter';
import { PARTS } from './parts';

export function DebuggerLayout() {
  const dispatch = useAppDispatch();
  const layout = useAppSelector((s) => s.debugger.layout);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCanvasSplitter = useCallback(
    (deltaPx: number) => {
      const el = containerRef.current;
      if (!el) return;
      const totalH = el.clientHeight;
      const pctDelta = deltaPx / totalH;
      dispatch(setCanvasHeight(layout.canvasHeightPercent + pctDelta));
    },
    [dispatch, layout.canvasHeightPercent],
  );

  const handleDisasmSplitter = useCallback(
    (deltaPx: number) => {
      const el = containerRef.current;
      if (!el) return;
      const totalW = el.clientWidth;
      const pctDelta = deltaPx / totalW;
      dispatch(setDisasmWidth(layout.disasmWidthPercent + pctDelta));
    },
    [dispatch, layout.disasmWidthPercent],
  );

  const handleSlotsSplitter = useCallback(
    (deltaPx: number) => {
      const el = containerRef.current;
      if (!el) return;
      // The right column height is (1 - canvasHeight) * totalH
      const rightH = el.clientHeight * (1 - layout.canvasHeightPercent);
      const pctDelta = deltaPx / rightH;
      dispatch(setSlotsHeight(layout.slotsHeightPercent + pctDelta));
    },
    [dispatch, layout.canvasHeightPercent, layout.slotsHeightPercent],
  );

  const handleToggleBp = useCallback(
    (pc: number) => {
      const dbg = getDebuggerInstance();
      if (!dbg) return;
      dbg.toggleBreakpoint(pc);
      dispatch(setBreakpoints([...dbg.breakpoints]));
    },
    [dispatch],
  );

  // CSS grid template from layout percentages
  const canvasPct = (layout.canvasHeightPercent * 100).toFixed(1);
  const lowerPct = ((1 - layout.canvasHeightPercent) * 100).toFixed(1);
  const disasmPct = (layout.disasmWidthPercent * 100).toFixed(1);
  const rightPct = ((1 - layout.disasmWidthPercent) * 100).toFixed(1);
  const slotsPct = (layout.slotsHeightPercent * 100).toFixed(1);
  const stackPct = ((1 - layout.slotsHeightPercent) * 100).toFixed(1);

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `${disasmPct}% 5px ${rightPct}%`,
    gridTemplateRows: `${canvasPct}% 5px ${lowerPct}%`,
    overflow: 'hidden',
    flex: 1,
    minHeight: 0,
  };

  const rightColStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateRows: `${slotsPct}% 5px ${stackPct}%`,
    overflow: 'hidden',
    minHeight: 0,
  };

  return (
    <div data-part={PARTS.debuggerLayout} ref={containerRef} style={gridStyle}>
      {/* Canvas — full width top row */}
      <div style={{ gridColumn: '1 / -1', gridRow: 1, overflow: 'hidden', minHeight: 0 }}>
        <CanvasPane />
      </div>

      {/* Horizontal splitter between canvas and lower panes */}
      <div style={{ gridColumn: '1 / -1', gridRow: 2 }}>
        <Splitter
          direction="horizontal"
          onResize={handleCanvasSplitter}
          onDoubleClick={() => dispatch(setCanvasHeight(0.4))}
        />
      </div>

      {/* Disassembly — bottom left */}
      <div style={{ gridColumn: 1, gridRow: 3, overflow: 'hidden', minHeight: 0 }}>
        <DisassemblyPane onToggleBreakpoint={handleToggleBp} />
      </div>

      {/* Vertical splitter between disasm and right column */}
      <div style={{ gridColumn: 2, gridRow: 3 }}>
        <Splitter
          direction="vertical"
          onResize={handleDisasmSplitter}
          onDoubleClick={() => dispatch(setDisasmWidth(0.5))}
        />
      </div>

      {/* Right column: Slots + Stack stacked */}
      <div style={{ gridColumn: 3, gridRow: 3, ...rightColStyle }}>
        <div style={{ gridRow: 1, overflow: 'hidden', minHeight: 0 }}>
          <SlotsPane />
        </div>
        <div style={{ gridRow: 2 }}>
          <Splitter
            direction="horizontal"
            onResize={handleSlotsSplitter}
            onDoubleClick={() => dispatch(setSlotsHeight(0.65))}
          />
        </div>
        <div style={{ gridRow: 3, overflow: 'hidden', minHeight: 0 }}>
          <StackPane />
        </div>
      </div>
    </div>
  );
}
