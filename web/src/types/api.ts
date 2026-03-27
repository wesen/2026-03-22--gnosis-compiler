/** Preset entry from GET /api/presets */
export interface Preset {
  name: string;
}

/** Response from GET /api/presets */
export interface PresetsResponse {
  presets: Preset[];
}

// ---------------------------------------------------------------------------
// Dynamic VM types
// ---------------------------------------------------------------------------

export interface RuntimePayload {
  name: string;
  data: Record<string, unknown>;
}

/** Request body for POST /api/compile */
export interface CompileRequest {
  source: string;
  runtimes: RuntimePayload[];
}

export interface DrawOp {
  type: string;
  node: number;
  source?: string;
  bind?: string | null;
  text?: string;
  value?: number;
  max?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  size?: number;
  color?: number;
  intrinsic_w?: number;
  fill_w?: number;
  track?: number;
  fill?: number;
}

/** Single runtime evaluation result */
export interface EvaluationResult {
  name: string;
  runtime_data: Record<string, unknown>;
  slots: Record<string, number>;
  draw_ops: DrawOp[];
}

export interface ProgramManifest {
  screen: { width: number; height: number };
  node_count: number;
  slot_count: number;
  binds: string[];
  strings: string[];
  slot_init: Record<string, number>;
  code_size: number;
  code_base64: string;
  binary_base64: string;
  manifest: Record<string, unknown>;
}

/** Response from POST /api/compile */
export interface CompileResponse {
  success: boolean;
  error?: string;
  program: ProgramManifest;
  disassembly: string;
  ir: string;
  slot_expressions: Record<string, string>;
  evaluations: EvaluationResult[];
}

/** Response from GET /api/presets/<name> */
export interface PresetDetailResponse {
  name: string;
  source: string;
  runtimes: RuntimePayload[];
}
