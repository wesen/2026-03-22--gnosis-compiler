import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setSourceText, setAutoCompile, setSelectedPreset } from '../../store/slices/compilerSlice';
import { setRuntimes, setSelectedEvaluation } from '../../store/slices/dynamicSlice';
import {
  updateSnapshot,
  resetDebugger as resetDebuggerAction,
  setOracleMismatches,
  clearDebugger,
} from '../../store/slices/debuggerSlice';
import {
  useCompileMutation,
  useGetPresetsQuery,
  useLazyGetPresetQuery,
} from '../../store/api';
import {
  getDebuggerInstance,
  getDebuggerProgram,
} from '../Inspector/panels/DebuggerPanel';
import { GNDYDebugger } from '../../engine/gndy';
import type { DebugSnapshot } from '../../engine/gndy';
import { PARTS } from './parts';
import { PARTS as DBG_PARTS } from '../Debugger/parts';

export function Header() {
  const dispatch = useAppDispatch();
  const sourceText = useAppSelector((s) => s.compiler.sourceText);
  const autoCompile = useAppSelector((s) => s.compiler.autoCompile);
  const selectedPreset = useAppSelector((s) => s.compiler.selectedPreset);
  const compileResult = useAppSelector((s) => s.dynamic.compileResult);
  const compileStatus = useAppSelector((s) => s.dynamic.compileStatus);
  const error = useAppSelector((s) => s.dynamic.error);
  const runtimes = useAppSelector((s) => s.dynamic.runtimes);
  const selectedEvaluation = useAppSelector((s) => s.dynamic.selectedEvaluation);
  const debuggerStatus = useAppSelector((s) => s.debugger.status);
  const debuggerState = useAppSelector((s) => s.debugger);

  const { data: presets } = useGetPresetsQuery();
  const [getPreset] = useLazyGetPresetQuery();
  const [compile] = useCompileMutation();

  const handleCompile = useCallback(() => {
    compile({ source: sourceText, runtimes });
  }, [compile, sourceText, runtimes]);

  // ── Debugger step controls ──────────────────────────────────

  const dispatchSnap = useCallback(
    (snap: DebugSnapshot) => {
      const dbg = getDebuggerInstance();
      dispatch(updateSnapshot({ snapshot: snap, historyDepth: dbg?.historyDepth ?? 0 }));
    },
    [dispatch],
  );

  const handleStep = useCallback(() => {
    const dbg = getDebuggerInstance();
    if (dbg) dispatchSnap(dbg.step());
  }, [dispatchSnap]);

  const handleStepBack = useCallback(() => {
    const dbg = getDebuggerInstance();
    if (!dbg) return;
    const snap = dbg.stepBack();
    if (snap) dispatchSnap(snap);
  }, [dispatchSnap]);

  const handleRun = useCallback(() => {
    const dbg = getDebuggerInstance();
    if (dbg) dispatchSnap(dbg.run());
  }, [dispatchSnap]);

  const handleRunToBp = useCallback(() => {
    const dbg = getDebuggerInstance();
    if (dbg) dispatchSnap(dbg.runToBreakpoint());
  }, [dispatchSnap]);

  const handleReset = useCallback(() => {
    const dbg = getDebuggerInstance();
    if (dbg) dispatch(resetDebuggerAction(dbg.reset()));
  }, [dispatch]);

  const handleValidate = useCallback(() => {
    const dbg = getDebuggerInstance();
    const program = getDebuggerProgram();
    if (!dbg || !program || !compileResult) return;

    const evaluation = compileResult.evaluations[selectedEvaluation];
    if (!evaluation) return;

    const freshDbg = new GNDYDebugger(program, evaluation.runtime_data);
    const finalSnap = freshDbg.run();

    let mismatches = 0;
    const oracleSlots = evaluation.slots;
    for (let i = 0; i < finalSnap.slots.length; i++) {
      const name = `n${Math.floor(i / 6)}.${['mw', 'mh', 'x', 'y', 'w', 'h'][i % 6]}`;
      if (oracleSlots[name] !== undefined && oracleSlots[name] !== finalSnap.slots[i]) {
        mismatches++;
      }
    }
    if (finalSnap.drawOps.length !== evaluation.draw_ops.length) {
      mismatches++;
    }
    dispatch(setOracleMismatches(mismatches));
  }, [compileResult, selectedEvaluation, dispatch]);

  const handleClose = useCallback(() => {
    dispatch(clearDebugger());
  }, [dispatch]);

  const isDbgActive = debuggerStatus !== 'idle';
  const snap = debuggerState.snapshot;

  const handlePresetChange = useCallback(
    async (name: string) => {
      if (!name) return;
      dispatch(setSelectedPreset(name));
      const result = await getPreset(name).unwrap();
      dispatch(setSourceText(result.source || ''));
      dispatch(setRuntimes(result.runtimes || []));
      dispatch(setSelectedEvaluation(0));
    },
    [getPreset, dispatch],
  );

  const statusText =
    compileStatus === 'compiling'
      ? 'COMPILING...'
      : compileStatus === 'error'
        ? 'ERROR'
        : compileResult
          ? `${compileResult.program.code_size}B / ${compileResult.program.binds.length} BINDS / ${compileResult.evaluations.length} RUNTIMES`
          : '';

  return (
    <div data-part={PARTS.header}>
      <h1>GNOSIS // DYNAMIC VM WORKBENCH</h1>

      <select
        data-part={PARTS.presetSelect}
        value={selectedPreset}
        onChange={(e) => handlePresetChange(e.target.value)}
      >
        <option value="">-- select preset --</option>
        {(presets?.presets ?? []).map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>

      <button data-part={PARTS.compileButton} onClick={handleCompile}>
        COMPILE
      </button>

      <label style={{ fontSize: '9px', color: 'var(--color-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input
          type="checkbox"
          checked={autoCompile}
          onChange={(e) => dispatch(setAutoCompile(e.target.checked))}
        />
        AUTO
      </label>

      {compileResult && compileResult.evaluations.length > 0 && (
        <select
          value={String(selectedEvaluation)}
          onChange={(e) => dispatch(setSelectedEvaluation(Number(e.target.value)))}
        >
          {compileResult.evaluations.map((evaluation, index) => (
            <option key={evaluation.name} value={index}>
              {evaluation.name}
            </option>
          ))}
        </select>
      )}

      <div style={{ flex: 1 }} />

      {/* Debugger step controls when active */}
      {isDbgActive && (
        <div data-part={DBG_PARTS.stepControls}>
          <button onClick={handleStep} disabled={snap?.halted}>STEP</button>
          <button onClick={handleStepBack} disabled={debuggerState.historyDepth === 0}>BACK</button>
          <button onClick={handleRun} disabled={snap?.halted}>RUN</button>
          <button onClick={handleRunToBp} disabled={snap?.halted}>RUN{'\u25B6'}BP</button>
          <button onClick={handleReset}>RESET</button>
          <button onClick={handleValidate}>VALIDATE</button>
          <button onClick={handleClose}>CLOSE</button>
          {debuggerState.oracleMismatches !== null && (
            <span
              data-role="oracle-result"
              style={{
                color: debuggerState.oracleMismatches === 0
                  ? 'var(--color-green)'
                  : 'var(--color-red)',
              }}
            >
              {debuggerState.oracleMismatches === 0
                ? 'ORACLE: PASS'
                : `ORACLE: ${debuggerState.oracleMismatches} MISMATCHES`}
            </span>
          )}
        </div>
      )}

      <span
        data-part={PARTS.compileStatus}
        style={{
          fontSize: '9px',
          color: error ? 'var(--color-red)' : 'var(--color-dim2)',
        }}
      >
        {statusText}
      </span>
    </div>
  );
}
