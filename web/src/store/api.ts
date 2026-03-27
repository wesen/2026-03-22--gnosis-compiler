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
  }),
});

export const {
  useCompileMutation,
  useGetPresetsQuery,
  useLazyGetPresetQuery,
} = compilerApi;
