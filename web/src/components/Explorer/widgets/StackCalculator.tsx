import { useState, useCallback, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

type ArithOp = 'ADD' | 'SUB' | 'MUL' | 'DIV' | 'MAX' | 'MIN';

type Instr =
  | { type: 'PUSH_CONST'; value: number }
  | { type: ArithOp }
  | { type: 'STORE_SLOT'; slot: string };

interface StepState {
  instrIndex: number;
  stack: number[];
  result: Record<string, number>;
  explanation: string;
}

// ── Mini interpreter ────────────────────────────────────────────────────────

function executeStep(instrs: Instr[], state: StepState): StepState | null {
  if (state.instrIndex >= instrs.length) return null;
  const instr = instrs[state.instrIndex]!;
  const stack = [...state.stack];
  const result = { ...state.result };
  let explanation = '';

  switch (instr.type) {
    case 'PUSH_CONST':
      stack.push(instr.value);
      explanation = `Pushed ${instr.value} onto the stack.`;
      break;
    case 'ADD': case 'SUB': case 'MUL': case 'DIV': case 'MAX': case 'MIN': {
      const b = stack.pop() ?? 0;
      const a = stack.pop() ?? 0;
      let r = 0;
      switch (instr.type) {
        case 'ADD': r = a + b; explanation = `${a} + ${b} = ${r}`; break;
        case 'SUB': r = a - b; explanation = `${a} - ${b} = ${r}`; break;
        case 'MUL': r = a * b; explanation = `${a} × ${b} = ${r}`; break;
        case 'DIV': r = b === 0 ? 0 : Math.trunc(a / b); explanation = `${a} ÷ ${b} = ${r}`; break;
        case 'MAX': r = Math.max(a, b); explanation = `max(${a}, ${b}) = ${r}`; break;
        case 'MIN': r = Math.min(a, b); explanation = `min(${a}, ${b}) = ${r}`; break;
      }
      stack.push(r);
      break;
    }
    case 'STORE_SLOT': {
      const val = stack.pop() ?? 0;
      result[instr.slot] = val;
      explanation = `Popped ${val} → stored in ${instr.slot}`;
      break;
    }
  }

  return { instrIndex: state.instrIndex + 1, stack, result, explanation };
}

function initialState(): StepState {
  return { instrIndex: 0, stack: [], result: {}, explanation: '' };
}

// ── Default program ─────────────────────────────────────────────────────────

const DEFAULT_INSTRS: Instr[] = [
  { type: 'PUSH_CONST', value: 42 },
  { type: 'PUSH_CONST', value: 10 },
  { type: 'ADD' },
  { type: 'PUSH_CONST', value: 3 },
  { type: 'MUL' },
  { type: 'STORE_SLOT', slot: 'n0.x' },
];

// ── Component ───────────────────────────────────────────────────────────────

export function StackCalculator({
  initialInstructions = DEFAULT_INSTRS,
}: {
  initialInstructions?: Instr[];
}) {
  const [instrs, setInstrs] = useState<Instr[]>(initialInstructions);
  const [state, setState] = useState<StepState>(initialState());
  const [history, setHistory] = useState<StepState[]>([]);

  const handleStep = useCallback(() => {
    const next = executeStep(instrs, state);
    if (next) {
      setHistory((h) => [...h, state]);
      setState(next);
    }
  }, [instrs, state]);

  const handleBack = useCallback(() => {
    const prev = history[history.length - 1];
    if (prev) {
      setHistory((h) => h.slice(0, -1));
      setState(prev);
    }
  }, [history]);

  const handleRun = useCallback(() => {
    let s = state;
    const h = [...history];
    for (let i = 0; i < 100; i++) {
      const next = executeStep(instrs, s);
      if (!next) break;
      h.push(s);
      s = next;
    }
    setHistory(h);
    setState(s);
  }, [instrs, state, history]);

  const handleReset = useCallback(() => {
    setState(initialState());
    setHistory([]);
  }, []);

  const handleEditConst = useCallback(
    (idx: number, value: number) => {
      setInstrs((prev) => {
        const next = [...prev];
        const instr = next[idx];
        if (instr && instr.type === 'PUSH_CONST') {
          next[idx] = { ...instr, value };
        }
        return next;
      });
      // Reset execution when editing
      setState(initialState());
      setHistory([]);
    },
    [],
  );

  const isDone = state.instrIndex >= instrs.length;

  // Compute final result by running all instructions
  const finalResult = useMemo(() => {
    let s = initialState();
    for (let i = 0; i < 100; i++) {
      const next = executeStep(instrs, s);
      if (!next) break;
      s = next;
    }
    return s.result;
  }, [instrs]);

  return (
    <div data-part="stack-calculator">
      <div className="sc-grid">
        {/* Instructions column */}
        <div className="sc-col">
          <div className="sc-col-header">Instructions</div>
          <div className="sc-instr-list">
            {instrs.map((instr, idx) => {
              const isCurrent = idx === state.instrIndex;
              const isDone = idx < state.instrIndex;
              return (
                <div
                  key={idx}
                  className="sc-instr"
                  data-state={isCurrent ? 'current' : isDone ? 'done' : 'pending'}
                >
                  <span className="sc-instr-ptr">{isCurrent ? '\u25B6' : isDone ? '\u2713' : '\u00A0'}</span>
                  <span className="sc-instr-name">{instr.type}</span>
                  {instr.type === 'PUSH_CONST' && (
                    <input
                      className="sc-instr-input"
                      type="number"
                      value={instr.value}
                      onChange={(e) => handleEditConst(idx, parseInt(e.target.value) || 0)}
                    />
                  )}
                  {instr.type === 'STORE_SLOT' && (
                    <span className="sc-instr-slot">{instr.slot}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Stack column */}
        <div className="sc-col">
          <div className="sc-col-header">Stack</div>
          <div className="sc-stack">
            {state.stack.length === 0 ? (
              <div className="sc-stack-empty">(empty)</div>
            ) : (
              [...state.stack].reverse().map((val, i) => {
                const stackIdx = state.stack.length - 1 - i;
                const isTop = i === 0;
                return (
                  <div key={i} className="sc-stack-entry" data-state={isTop ? 'top' : undefined}>
                    <span className="sc-stack-ptr">{isTop ? '\u25B6' : '\u00A0'}</span>
                    <span className="sc-stack-idx">[{stackIdx}]</span>
                    <span className="sc-stack-val">{val}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Explanation column */}
        <div className="sc-col">
          <div className="sc-col-header">Explanation</div>
          <div className="sc-explanation">
            {state.explanation ? (
              <div className="sc-explanation-text">{state.explanation}</div>
            ) : (
              <div className="sc-explanation-hint">
                Press STEP to execute the first instruction.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="sc-controls">
        <button onClick={handleStep} disabled={isDone}>STEP {'\u2192'}</button>
        <button onClick={handleBack} disabled={history.length === 0}>{'\u2190'} BACK</button>
        <button onClick={handleRun} disabled={isDone}>RUN ALL</button>
        <button onClick={handleReset}>RESET</button>
      </div>

      {/* Result */}
      <div className="sc-result">
        {Object.keys(state.result).length > 0 ? (
          Object.entries(state.result).map(([slot, val]) => (
            <span key={slot} className="sc-result-entry">
              <span className="sc-result-slot">{slot}</span> = <strong>{val}</strong>
            </span>
          ))
        ) : (
          <span className="sc-result-preview">
            Final: {Object.entries(finalResult).map(([slot, val]) => (
              <span key={slot}>{slot} = {val}</span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

export type { Instr as StackInstruction };
