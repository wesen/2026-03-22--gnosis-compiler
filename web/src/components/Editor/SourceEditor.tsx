import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setSourceText } from '../../store/slices/compilerSlice';

export function SourceEditor() {
  const dispatch = useAppDispatch();
  const sourceText = useAppSelector((s) => s.compiler.sourceText);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      dispatch(setSourceText(e.target.value));
    },
    [dispatch],
  );

  return (
    <textarea
      value={sourceText}
      onChange={handleChange}
      spellCheck={false}
      placeholder={'type: screen\nwidth: 400\n...'}
    />
  );
}
