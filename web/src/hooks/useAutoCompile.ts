import { useEffect } from 'react';
import { useAppSelector } from '../store/hooks';
import { useCompileMutation, useCompileDynamicMutation } from '../store/api';

/**
 * Auto-compile with 400ms debounce when source/props change and autoCompile is on.
 * Mode-aware: calls the appropriate compile endpoint.
 */
export function useAutoCompile() {
  const [compileStatic] = useCompileMutation();
  const [compileDynamic] = useCompileDynamicMutation();
  const mode = useAppSelector((s) => s.compiler.mode);
  const sourceText = useAppSelector((s) => s.compiler.sourceText);
  const propsText = useAppSelector((s) => s.compiler.propsText);
  const autoCompile = useAppSelector((s) => s.compiler.autoCompile);
  const runtimes = useAppSelector((s) => s.dynamic.runtimes);

  useEffect(() => {
    if (!autoCompile || !sourceText) return;
    const timer = setTimeout(() => {
      if (mode === 'dynamic') {
        compileDynamic({ source: sourceText, runtimes });
      } else {
        compileStatic({ source: sourceText, props: propsText });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [sourceText, propsText, autoCompile, mode, runtimes, compileStatic, compileDynamic]);
}
