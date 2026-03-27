import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setPropsText } from '../../store/slices/compilerSlice';

export function PropsEditor() {
  const dispatch = useAppDispatch();
  const propsText = useAppSelector((s) => s.compiler.propsText);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      dispatch(setPropsText(e.target.value));
    },
    [dispatch],
  );

  return (
    <textarea
      value={propsText}
      onChange={handleChange}
      spellCheck={false}
      placeholder={'title: Hello\n...'}
    />
  );
}
