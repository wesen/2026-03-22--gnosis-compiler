import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setSourceText, setPropsText, setSelectedPreset } from '../store/slices/compilerSlice';
import { useGetPresetsQuery, useLazyGetPresetQuery } from '../store/api';

/**
 * Auto-load the first preset on initial mount (matching legacy behavior).
 */
export function useAutoLoadPreset() {
  const dispatch = useAppDispatch();
  const { data: presetsData } = useGetPresetsQuery();
  const [getPreset] = useLazyGetPresetQuery();
  const sourceText = useAppSelector((s) => s.compiler.sourceText);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current || !presetsData?.presets?.length || sourceText) return;
    loaded.current = true;

    const firstName = presetsData.presets[0]!.name;
    dispatch(setSelectedPreset(firstName));
    getPreset(firstName)
      .unwrap()
      .then((result) => {
        dispatch(setSourceText(result.source || ''));
        dispatch(setPropsText(result.props || ''));
      });
  }, [presetsData, sourceText, getPreset, dispatch]);
}
