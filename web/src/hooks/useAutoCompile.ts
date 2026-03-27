import { useEffect } from 'react';
import { useAppSelector } from '../store/hooks';
import { useCompileMutation } from '../store/api';

/**
 * Auto-compile with 400ms debounce when source/props change and autoCompile is on.
 * Also triggers an initial compile when presets first load content.
 */
export function useAutoCompile() {
  const [compile] = useCompileMutation();
  const sourceText = useAppSelector((s) => s.compiler.sourceText);
  const propsText = useAppSelector((s) => s.compiler.propsText);
  const autoCompile = useAppSelector((s) => s.compiler.autoCompile);

  useEffect(() => {
    if (!autoCompile || !sourceText) return;
    const timer = setTimeout(() => {
      compile({ source: sourceText, props: propsText });
    }, 400);
    return () => clearTimeout(timer);
  }, [sourceText, propsText, autoCompile, compile]);
}
