/** Request body for POST /api/compile */
export interface CompileRequest {
  source: string;
  props: string;
}

/** Rect geometry */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Region descriptor */
export interface RegionInfo {
  rect: Rect;
  waveform: string;
  bind_names: string[];
}

/** Pass statistics */
export interface PassInfo {
  name: string;
  before: number;
  after: number;
}

/** Compiler stats */
export interface CompilerStats {
  screen: { width: number; height: number };
  input_nodes: number;
  final_nodes: number;
  static_nodes: number;
  dynamic_nodes: number;
  code_size: number;
  string_count: number;
  bind_count: number;
  region_count: number;
  passes: PassInfo[];
}

/** Program manifest */
export interface ProgramManifest {
  stats: CompilerStats;
  binds: string[];
  strings: string[];
  regions: RegionInfo[];
  code_size: number;
}

/** AST node (recursive) */
export interface ASTNodeData {
  type?: string;
  rect?: Rect;
  children?: ASTNodeData[];
  bar?: ASTNodeData;
  body?: ASTNodeData;
  nav?: ASTNodeData;
  text?: string;
  bind?: string;
  _static?: boolean;
  id?: string;
  h?: number;
  [key: string]: unknown;
}

/** Compilation stages */
export interface CompileStages {
  parsed?: ASTNodeData;
  optimized?: ASTNodeData;
  laid_out?: ASTNodeData;
  [key: string]: ASTNodeData | undefined;
}

/** Response from POST /api/compile */
export interface CompileResponse {
  success: boolean;
  error?: string;
  program: ProgramManifest;
  disassembly: string;
  bytecode_base64: string;
  binary_base64?: string;
  stages: CompileStages;
}

/** Preset entry from GET /api/presets */
export interface Preset {
  name: string;
}

/** Response from GET /api/presets */
export interface PresetsResponse {
  presets: Preset[];
}

/** Response from GET /api/presets/<name> */
export interface PresetDetailResponse {
  source: string;
  props: string;
}

// ---------------------------------------------------------------------------
// Dynamic VM types
// ---------------------------------------------------------------------------

/** Runtime payload for dynamic evaluation */
export interface RuntimePayload {
  name: string;
  data: Record<string, unknown>;
}

/** Request body for POST /api/compile-dynamic */
export interface DynamicCompileRequest {
  source: string;
  runtimes: RuntimePayload[];
}

/** Draw operation from dynamic VM evaluation */
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

/** Dynamic program manifest */
export interface DynamicProgramManifest {
  node_count: number;
  slot_count: number;
  binds: string[];
  strings: string[];
  slot_init: Record<string, number>;
  code_size: number;
  code_base64: string;
  binary_base64: string;
}

/** Response from POST /api/compile-dynamic */
export interface DynamicCompileResponse {
  success: boolean;
  error?: string;
  program: DynamicProgramManifest;
  disassembly: string;
  ir: string;
  slot_expressions: Record<string, string>;
  evaluations: EvaluationResult[];
}

/** Response from GET /api/presets-dynamic/<name> */
export interface DynamicPresetDetailResponse {
  name: string;
  source: string;
  runtimes: RuntimePayload[];
}
