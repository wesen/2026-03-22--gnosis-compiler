import { useEffect } from 'react';
import { useAppSelector } from '../store/hooks';
import { useCompileMutation } from '../store/api';

export function useAutoCompile() {
  const [compile] = useCompileMutation();
  const sourceText = useAppSelector((s) => s.compiler.sourceText);
  const autoCompile = useAppSelector((s) => s.compiler.autoCompile);
  const runtimes = useAppSelector((s) => s.dynamic.runtimes);

  useEffect(() => {
    if (!autoCompile || !sourceText) return;
    const timer = setTimeout(() => {
      compile({ source: sourceText, runtimes });
    }, 400);
    return () => clearTimeout(timer);
  }, [sourceText, autoCompile, runtimes, compile]);
}
