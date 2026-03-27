import { useEffect, useRef } from 'react';
import { useAppSelector } from '../../store/hooks';
import { getDebuggerProgram } from '../Inspector/panels/DebuggerPanel';
import { OP_NAMES } from '../../engine/gndy';
import { Op, slotName } from '../../engine/gndy/decode';
import type { Instruction, GNDYProgram as GP } from '../../engine/gndy';
import { PARTS } from './parts';

export function DisassemblyPane({
  onToggleBreakpoint,
}: {
  onToggleBreakpoint: (pc: number) => void;
}) {
  const snapshot = useAppSelector((s) => s.debugger.snapshot);
  const breakpoints = useAppSelector((s) => s.debugger.breakpoints);
  const listRef = useRef<HTMLDivElement>(null);
  const program = getDebuggerProgram();

  // Auto-scroll to keep current instruction visible
  useEffect(() => {
    if (!listRef.current || !snapshot) return;
    const active = listRef.current.querySelector('[data-state="current"]');
    if (active) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [snapshot?.instrIndex]);

  if (!program || !snapshot) {
    return (
      <div data-part={PARTS.disasmPane}>
        <div data-part={PARTS.disasmStatus}>No program loaded</div>
      </div>
    );
  }

  return (
    <div data-part={PARTS.disasmPane}>
      <div data-part={PARTS.disasmList} ref={listRef}>
        {program.instructions.map((instr, idx) => {
          const isCurrent = idx === snapshot.instrIndex;
          const isBp = breakpoints.includes(instr.pc);
          return (
            <div
              key={instr.pc}
              className="dbg-instr"
              data-state={isCurrent ? 'current' : isBp ? 'breakpoint' : undefined}
              onClick={() => onToggleBreakpoint(instr.pc)}
            >
              <span className="dbg-bp">{isBp ? '\u25CF' : '\u00A0'}</span>
              <span className="dbg-ptr">{isCurrent ? '\u25B6' : '\u00A0'}</span>
              <span className="dbg-pc">
                {instr.pc.toString(16).padStart(4, '0')}
              </span>
              <span className="dbg-op">{getOpName(instr.op)}</span>
              <span className="dbg-args">{formatOperands(instr, program)}</span>
            </div>
          );
        })}
      </div>
      <div data-part={PARTS.disasmStatus}>
        <span>
          Phase: <strong>{snapshot.phase.toUpperCase()}</strong>
        </span>
        <span>
          PC: <strong>0x{snapshot.pc.toString(16).padStart(4, '0')}</strong>
        </span>
        <span>
          Step: {snapshot.instrIndex}/{program.instructions.length}
        </span>
      </div>
    </div>
  );
}

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
