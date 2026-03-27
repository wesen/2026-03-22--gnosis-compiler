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
