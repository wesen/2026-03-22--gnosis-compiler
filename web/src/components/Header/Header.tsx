import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  setSourceText, setPropsText, setAutoCompile,
  setMode, setSelectedPreset, type CompilerMode,
} from '../../store/slices/compilerSlice';
import { setRuntimes } from '../../store/slices/dynamicSlice';
import {
  useCompileMutation, useCompileDynamicMutation,
  useGetPresetsQuery, useLazyGetPresetQuery,
  useGetDynamicPresetsQuery, useLazyGetDynamicPresetQuery,
} from '../../store/api';
import { PARTS } from './parts';

export function Header() {
  const dispatch = useAppDispatch();
  const sourceText = useAppSelector((s) => s.compiler.sourceText);
  const propsText = useAppSelector((s) => s.compiler.propsText);
  const autoCompile = useAppSelector((s) => s.compiler.autoCompile);
  const compileResult = useAppSelector((s) => s.compiler.compileResult);
  const compileStatus = useAppSelector((s) => s.compiler.compileStatus);
  const mode = useAppSelector((s) => s.compiler.mode);
  const selectedPreset = useAppSelector((s) => s.compiler.selectedPreset);
  const error = useAppSelector((s) => s.compiler.error);
  const dynamicResult = useAppSelector((s) => s.dynamic.compileResult);
  const dynamicStatus = useAppSelector((s) => s.dynamic.compileStatus);
  const dynamicError = useAppSelector((s) => s.dynamic.error);
  const runtimes = useAppSelector((s) => s.dynamic.runtimes);

  const { data: staticPresets } = useGetPresetsQuery();
  const { data: dynamicPresets } = useGetDynamicPresetsQuery();
  const [getStaticPreset] = useLazyGetPresetQuery();
  const [getDynamicPreset] = useLazyGetDynamicPresetQuery();
  const [compileStatic] = useCompileMutation();
  const [compileDynamic] = useCompileDynamicMutation();

  const handleCompile = useCallback(() => {
    if (mode === 'dynamic') {
      compileDynamic({ source: sourceText, runtimes });
    } else {
      compileStatic({ source: sourceText, props: propsText });
    }
  }, [mode, compileStatic, compileDynamic, sourceText, propsText, runtimes]);

  const handlePresetChange = useCallback(
    async (name: string) => {
      if (!name) return;
      dispatch(setSelectedPreset(name));
      if (mode === 'dynamic') {
        const result = await getDynamicPreset(name).unwrap();
        dispatch(setSourceText(result.source || ''));
        dispatch(setPropsText(''));
        dispatch(setRuntimes(result.runtimes || []));
      } else {
        const result = await getStaticPreset(name).unwrap();
        dispatch(setSourceText(result.source || ''));
        dispatch(setPropsText(result.props || ''));
      }
    },
    [mode, getStaticPreset, getDynamicPreset, dispatch],
  );

  const handleModeSwitch = useCallback(
    (m: CompilerMode) => {
      if (m === mode) return;
      dispatch(setMode(m));
      dispatch(setSourceText(''));
      dispatch(setPropsText(''));
      dispatch(setSelectedPreset(''));
    },
    [mode, dispatch],
  );

  const presets = mode === 'dynamic' ? dynamicPresets : staticPresets;

  // Status text depends on mode
  const activeStatus = mode === 'dynamic' ? dynamicStatus : compileStatus;
  const activeError = mode === 'dynamic' ? dynamicError : error;
  const statusText =
    activeStatus === 'compiling'
      ? 'COMPILING...'
      : activeStatus === 'error'
        ? 'ERROR'
        : mode === 'dynamic' && dynamicResult
          ? `${dynamicResult.program.code_size}B / ${dynamicResult.program.binds.length} BINDS / ${dynamicResult.evaluations.length} EVALS`
          : mode === 'static' && compileResult
            ? `${compileResult.program.code_size}B / ${compileResult.disassembly.split('\n').length} OPS`
            : '';

  return (
    <div data-part={PARTS.header}>
      <h1>GNOSIS // COMPILER WORKBENCH</h1>

      <div data-part={PARTS.modeSwitch} style={{ display: 'flex', gap: 0 }}>
        {(['static', 'dynamic'] as CompilerMode[]).map((m) => (
          <button
            key={m}
            data-state={mode === m ? 'active' : undefined}
            onClick={() => handleModeSwitch(m)}
            style={{ fontSize: '9px', padding: '4px 8px' }}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>

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

      <div style={{ flex: 1 }} />

      <span
        data-part={PARTS.compileStatus}
        style={{
          fontSize: '9px',
          color: activeError ? 'var(--color-red)' : 'var(--color-dim2)',
        }}
      >
        {statusText}
      </span>
    </div>
  );
}
