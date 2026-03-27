import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  CompileRequest,
  CompileResponse,
  PresetsResponse,
  PresetDetailResponse,
  DynamicCompileRequest,
  DynamicCompileResponse,
  DynamicPresetDetailResponse,
} from '../types/api';

export const compilerApi = createApi({
  reducerPath: 'compilerApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (builder) => ({
    // Static compiler
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

    // Dynamic compiler
    compileDynamic: builder.mutation<DynamicCompileResponse, DynamicCompileRequest>({
      query: (body) => ({
        url: '/compile-dynamic',
        method: 'POST',
        body,
      }),
    }),
    getDynamicPresets: builder.query<PresetsResponse, void>({
      query: () => '/presets-dynamic',
    }),
    getDynamicPreset: builder.query<DynamicPresetDetailResponse, string>({
      query: (name) => `/presets-dynamic/${name}`,
    }),
  }),
});

export const {
  useCompileMutation,
  useGetPresetsQuery,
  useLazyGetPresetQuery,
  useCompileDynamicMutation,
  useGetDynamicPresetsQuery,
  useLazyGetDynamicPresetQuery,
} = compilerApi;
