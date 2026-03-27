import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setSourceText, setSelectedPreset } from '../store/slices/compilerSlice';
import { setRuntimes } from '../store/slices/dynamicSlice';
import { useGetPresetsQuery, useLazyGetPresetQuery } from '../store/api';

export function useAutoLoadPreset() {
  const dispatch = useAppDispatch();
  const sourceText = useAppSelector((s) => s.compiler.sourceText);
  const { data: presets } = useGetPresetsQuery();
  const [getPreset] = useLazyGetPresetQuery();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current || sourceText || !presets?.presets?.length) return;
    loaded.current = true;
    const firstName = presets.presets[0]!.name;
    dispatch(setSelectedPreset(firstName));
    getPreset(firstName)
      .unwrap()
      .then((result) => {
        dispatch(setSourceText(result.source || ''));
        dispatch(setRuntimes(result.runtimes || []));
      });
  }, [presets, sourceText, getPreset, dispatch]);
}
