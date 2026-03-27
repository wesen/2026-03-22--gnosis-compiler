import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
  loadDebugger,
  updateSnapshot,
  resetDebugger as resetDebuggerAction,
  setBreakpoints,
  setOracleMismatches,
  clearDebugger,
} from '../../../store/slices/debuggerSlice';
import { GNDYDebugger, decodeProgramFromBase64 } from '../../../engine/gndy';
import type { DebugSnapshot, GNDYProgram } from '../../../engine/gndy';

// Module-level singletons so they survive tab switches (panel unmount/remount).
let _dbg: GNDYDebugger | null = null;
let _program: GNDYProgram | null = null;

/** Access the current debugger instance (for other panels if needed). */
export function getDebuggerInstance(): GNDYDebugger | null { return _dbg; }
export function getDebuggerProgram(): GNDYProgram | null { return _program; }

/**
 * Main debugger control panel.
 *
 * Shows phase, PC, current instruction, step controls, and breakpoint list.
 * The GNDYDebugger instance lives at module scope (not in a ref) since the
 * panel unmounts when tabs switch but the debugger session must persist.
 */
export function DebuggerPanel() {
  const dispatch = useAppDispatch();
  const compileResult = useAppSelector((s) => s.dynamic.compileResult);
  const selectedEvaluation = useAppSelector((s) => s.dynamic.selectedEvaluation);
  const debuggerState = useAppSelector((s) => s.debugger);

  // ── Load debugger for current evaluation ─────────────────────────────

  const handleLoad = useCallback(() => {
    if (!compileResult) return;
    const evaluation = compileResult.evaluations[selectedEvaluation];
    if (!evaluation) return;

    const program = decodeProgramFromBase64(compileResult.program.binary_base64);
    _program = program;

    const runtime = evaluation.runtime_data;
    const dbg = new GNDYDebugger(program, runtime);
    _dbg = dbg;

    // Restore breakpoints from Redux
    for (const bp of debuggerState.breakpoints) {
      dbg.breakpoints.add(bp);
    }

    const snap = dbg.snapshot();
    dispatch(loadDebugger({ runtimeName: evaluation.name, snapshot: snap }));
  }, [compileResult, selectedEvaluation, dispatch, debuggerState.breakpoints]);

  // ── Step controls ────────────────────────────────────────────────────

  const dispatchUpdate = useCallback(
    (snap: DebugSnapshot) => {
      const dbg = _dbg;
      dispatch(updateSnapshot({ snapshot: snap, historyDepth: dbg?.historyDepth ?? 0 }));
    },
    [dispatch],
  );

  const handleStep = useCallback(() => {
    const dbg = _dbg;
    if (!dbg) return;
    dispatchUpdate(dbg.step());
  }, [dispatchUpdate]);

  const handleStepBack = useCallback(() => {
    const dbg = _dbg;
    if (!dbg) return;
    const snap = dbg.stepBack();
    if (snap) dispatchUpdate(snap);
  }, [dispatchUpdate]);

  const handleRun = useCallback(() => {
    const dbg = _dbg;
    if (!dbg) return;
    dispatchUpdate(dbg.run());
  }, [dispatchUpdate]);

  const handleRunToBp = useCallback(() => {
    const dbg = _dbg;
    if (!dbg) return;
    dispatchUpdate(dbg.runToBreakpoint());
  }, [dispatchUpdate]);

  const handleReset = useCallback(() => {
    const dbg = _dbg;
    if (!dbg) return;
    dispatch(resetDebuggerAction(dbg.reset()));
  }, [dispatch]);

  const handleClear = useCallback(() => {
    _dbg = null;
    _program = null;
    dispatch(clearDebugger());
  }, [dispatch]);

  // ── Oracle validation ────────────────────────────────────────────────

  const handleValidate = useCallback(() => {
    const dbg = _dbg;
    if (!dbg || !compileResult) return;

    // Run a fresh debugger to completion
    const program = _program!;
    const evaluation = compileResult.evaluations[selectedEvaluation];
    if (!evaluation) return;

    const freshDbg = new GNDYDebugger(program, evaluation.runtime_data);
    const finalSnap = freshDbg.run();

    // Compare slots
    let mismatches = 0;
    const oracleSlots = evaluation.slots;
    for (let i = 0; i < finalSnap.slots.length; i++) {
      const name = `n${Math.floor(i / 6)}.${['mw', 'mh', 'x', 'y', 'w', 'h'][i % 6]}`;
      if (oracleSlots[name] !== undefined && oracleSlots[name] !== finalSnap.slots[i]) {
        mismatches++;
      }
    }

    // Compare draw_ops count
    if (finalSnap.drawOps.length !== evaluation.draw_ops.length) {
      mismatches++;
    }

    dispatch(setOracleMismatches(mismatches));
  }, [compileResult, selectedEvaluation, dispatch]);

  // ── Breakpoint toggle (on disassembly lines) ────────────────────────

  const handleToggleBp = useCallback(
    (pc: number) => {
      const dbg = _dbg;
      if (!dbg) return;
      dbg.toggleBreakpoint(pc);
      dispatch(setBreakpoints([...dbg.breakpoints]));
    },
    [dispatch],
  );

  // ── Render ───────────────────────────────────────────────────────────

  const snap = debuggerState.snapshot;
  const status = debuggerState.status;
  const program = _program;

  // Current instruction info
  const currentInstr =
    snap && program && snap.instrIndex < program.instructions.length
      ? program.instructions[snap.instrIndex]
      : null;

  const instrName = currentInstr
    ? getOpName(currentInstr.op)
    : snap?.halted
      ? 'HALTED'
      : '--';

  const btnStyle: React.CSSProperties = {
    padding: '2px 8px',
    fontSize: '10px',
    fontFamily: 'inherit',
    cursor: 'pointer',
  };

  return (
    <div style={{ padding: 8, fontSize: '11px', fontFamily: 'var(--font-mono, monospace)' }}>
      {/* Status bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>DEBUGGER</span>
        <span style={{ color: statusColor(status) }}>[{status.toUpperCase()}]</span>
        {debuggerState.selectedRuntimeName && (
          <span style={{ color: 'var(--color-dim)' }}>{debuggerState.selectedRuntimeName}</span>
        )}
        {debuggerState.oracleMismatches !== null && (
          <span
            style={{
              color: debuggerState.oracleMismatches === 0 ? 'var(--color-green, #0f0)' : 'var(--color-red, #f00)',
              marginLeft: 'auto',
            }}
          >
            ORACLE: {debuggerState.oracleMismatches === 0 ? 'PASS' : `${debuggerState.oracleMismatches} MISMATCHES`}
          </span>
        )}
      </div>

      {/* Control buttons */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {status === 'idle' ? (
          <button style={btnStyle} onClick={handleLoad} disabled={!compileResult}>
            LOAD
          </button>
        ) : (
          <>
            <button style={btnStyle} onClick={handleStep} disabled={snap?.halted}>
              STEP
            </button>
            <button
              style={btnStyle}
              onClick={handleStepBack}
              disabled={debuggerState.historyDepth === 0}
            >
              BACK
            </button>
            <button style={btnStyle} onClick={handleRun} disabled={snap?.halted}>
              RUN
            </button>
            <button style={btnStyle} onClick={handleRunToBp} disabled={snap?.halted}>
              RUN TO BP
            </button>
            <button style={btnStyle} onClick={handleReset}>
              RESET
            </button>
            <button style={btnStyle} onClick={handleValidate}>
              VALIDATE
            </button>
            <button style={{ ...btnStyle, marginLeft: 'auto' }} onClick={handleClear}>
              CLOSE
            </button>
          </>
        )}
      </div>

      {/* Phase / PC / Instruction */}
      {snap && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>
              Phase: <strong style={{ color: 'var(--color-accent)' }}>{snap.phase.toUpperCase()}</strong>
            </span>
            <span>
              PC: <strong>0x{snap.pc.toString(16).padStart(4, '0')}</strong>
            </span>
            <span>
              Op: <strong>{instrName}</strong>
            </span>
            <span style={{ color: 'var(--color-dim)' }}>
              Step: {snap.instrIndex} / {program?.instructions.length ?? '?'}
            </span>
            <span style={{ color: 'var(--color-dim)' }}>
              History: {debuggerState.historyDepth}
            </span>
          </div>
        </div>
      )}

      {/* Disassembly with breakpoints and current PC highlight */}
      {program && snap && (
        <div
          style={{
            maxHeight: 200,
            overflow: 'auto',
            borderTop: '1px solid var(--color-border, #333)',
            paddingTop: 4,
          }}
        >
          {program.instructions.map((instr, idx) => {
            const isCurrent = idx === snap.instrIndex;
            const isBp = debuggerState.breakpoints.includes(instr.pc);
            return (
              <div
                key={instr.pc}
                onClick={() => handleToggleBp(instr.pc)}
                style={{
                  padding: '1px 4px',
                  cursor: 'pointer',
                  background: isCurrent ? 'var(--color-highlight, rgba(255,255,0,0.15))' : undefined,
                  color: isCurrent ? 'var(--color-accent)' : 'var(--color-fg)',
                  fontFamily: 'inherit',
                  display: 'flex',
                  gap: 4,
                }}
              >
                <span style={{ width: 12, color: isBp ? 'var(--color-red, #f44)' : 'transparent' }}>
                  {isBp ? '\u25CF' : '\u00A0'}
                </span>
                <span style={{ width: 12 }}>{isCurrent ? '\u25B6' : '\u00A0'}</span>
                <span style={{ color: 'var(--color-dim)', width: 40 }}>
                  {instr.pc.toString(16).padStart(4, '0')}
                </span>
                <span>{getOpName(instr.op)}</span>
                <span style={{ color: 'var(--color-dim)' }}>{formatOperands(instr, program)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

import { OP_NAMES, type Instruction, type GNDYProgram as GP } from '../../../engine/gndy';
import { Op, slotName } from '../../../engine/gndy/decode';

function getOpName(op: number): string {
  return OP_NAMES[op] ?? `0x${op.toString(16)}`;
}

function formatOperands(instr: Instruction, program: GP): string {
  switch (instr.op) {
    case Op.MEASURE_TEXT_BIND:
      return `node=${instr.node} bind=${program.binds[instr.bind] ?? '?'} size=${instr.fontSize}`;
    case Op.PUSH_CONST:
      return `${instr.value}`;
    case Op.PUSH_SLOT:
      return slotName(instr.slot);
    case Op.STORE_SLOT:
      return slotName(instr.slot);
    case Op.DRAW_TEXT_CONST:
      return `node=${instr.node} "${program.strings[instr.stringId] ?? '?'}" size=${instr.fontSize}`;
    case Op.DRAW_TEXT_BIND:
      return `node=${instr.node} bind=${program.binds[instr.bind] ?? '?'} size=${instr.fontSize}`;
    case Op.DRAW_BAR_BIND:
      return `node=${instr.node} bind=${program.binds[instr.bind] ?? '?'} max=${instr.maxValue}`;
    case Op.DRAW_BAR_CONST:
      return `node=${instr.node} val=${instr.value} max=${instr.maxValue}`;
    case Op.DRAW_HLINE:
    case Op.DRAW_VLINE:
      return `node=${instr.node}`;
    default:
      return '';
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'ready':
      return 'var(--color-green, #0f0)';
    case 'running':
      return 'var(--color-accent)';
    case 'halted':
      return 'var(--color-dim)';
    case 'error':
      return 'var(--color-red, #f00)';
    default:
      return 'var(--color-dim)';
  }
}
