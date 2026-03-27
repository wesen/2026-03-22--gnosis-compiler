import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  CompileRequest,
  CompileResponse,
  PresetsResponse,
  PresetDetailResponse,
} from '../types/api';

export const compilerApi = createApi({
  reducerPath: 'compilerApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (builder) => ({
    compile: builder.mutation<CompileResponse, CompileRequest>({
      query: (body) => ({
        url: '/compile',
        method: 'POST',
        body,
      }),
    }),
    getPresets: builder.query<PresetsResponse, void>({
      query: () => '/presets',
    }),
    getPreset: builder.query<PresetDetailResponse, string>({
      query: (name) => `/presets/${name}`,
    }),

    // GNOSIS-003: Dynamic compilation stubs
    // These endpoints will be implemented when the backend routes exist.
    compileDynamic: builder.mutation<unknown, { source: string; runtimes: Array<{ name: string; data: string }> }>({
      query: (body) => ({
        url: '/compile-dynamic',
        method: 'POST',
        body,
      }),
    }),
    getDynamicPresets: builder.query<PresetsResponse, void>({
      query: () => '/presets-dynamic',
    }),
  }),
});

export const {
  useCompileMutation,
  useGetPresetsQuery,
  useLazyGetPresetQuery,
  useCompileDynamicMutation,
  useGetDynamicPresetsQuery,
} = compilerApi;
