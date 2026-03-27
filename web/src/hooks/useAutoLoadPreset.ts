import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setSourceText, setPropsText, setSelectedPreset } from '../store/slices/compilerSlice';
import { setRuntimes } from '../store/slices/dynamicSlice';
import {
  useGetPresetsQuery,
  useLazyGetPresetQuery,
  useGetDynamicPresetsQuery,
  useLazyGetDynamicPresetQuery,
} from '../store/api';

/**
 * Auto-load the first preset on initial mount (matching legacy behavior).
 * Mode-aware: loads static presets in static mode, dynamic in dynamic mode.
 */
export function useAutoLoadPreset() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector((s) => s.compiler.mode);
  const sourceText = useAppSelector((s) => s.compiler.sourceText);

  const { data: staticPresets } = useGetPresetsQuery();
  const { data: dynamicPresets } = useGetDynamicPresetsQuery();
  const [getStaticPreset] = useLazyGetPresetQuery();
  const [getDynamicPreset] = useLazyGetDynamicPresetQuery();

  const loaded = useRef<string | null>(null);

  useEffect(() => {
    // Only auto-load once per mode, and only if editor is empty
    if (loaded.current === mode || sourceText) return;

    if (mode === 'dynamic' && dynamicPresets?.presets?.length) {
      loaded.current = mode;
      const firstName = dynamicPresets.presets[0]!.name;
      dispatch(setSelectedPreset(firstName));
      getDynamicPreset(firstName)
        .unwrap()
        .then((result) => {
          dispatch(setSourceText(result.source || ''));
          dispatch(setPropsText(''));
          dispatch(setRuntimes(result.runtimes || []));
        });
    } else if (mode === 'static' && staticPresets?.presets?.length) {
      loaded.current = mode;
      const firstName = staticPresets.presets[0]!.name;
      dispatch(setSelectedPreset(firstName));
      getStaticPreset(firstName)
        .unwrap()
        .then((result) => {
          dispatch(setSourceText(result.source || ''));
          dispatch(setPropsText(result.props || ''));
        });
    }
  }, [mode, staticPresets, dynamicPresets, sourceText, getStaticPreset, getDynamicPreset, dispatch]);
}
