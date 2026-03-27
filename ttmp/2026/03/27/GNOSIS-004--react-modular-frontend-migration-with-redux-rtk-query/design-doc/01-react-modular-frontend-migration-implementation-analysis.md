---
Title: React Modular Frontend Migration — Implementation Analysis
Ticket: GNOSIS-004
Status: active
Topics:
    - compiler
    - webui
    - react
    - frontend
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: source/gnosis-compiler.jsx
      Note: Existing React reference implementation (unused)
    - Path: source/gnosis-engine.jsx
      Note: Existing React rendering engine (unused)
    - Path: web/index.html
      Note: Current single-file vanilla JS frontend to be migrated
    - Path: web_server.py
      Note: Flask backend serving API endpoints
ExternalSources: []
Summary: Comprehensive plan to migrate the GNOSIS Compiler Workbench from a single-file vanilla HTML/JS/CSS app into a modular, themeable React application with Redux/RTK-Query state management, preparing the frontend to absorb the GNOSIS-003 dynamic VM debug UI.
LastUpdated: 2026-03-27T14:53:29.063393958-04:00
WhatFor: ""
WhenToUse: ""
---






# React Modular Frontend Migration — Implementation Analysis

## 1. Executive Summary

The GNOSIS Compiler Workbench frontend is currently a single-file vanilla HTML/JS/CSS application (`web/index.html`, ~620 lines). It provides a source editor, canvas renderer, and seven inspector panels for the static bytecode compiler. GNOSIS-003 proposes extending this UI with a dynamic VM debug mode requiring 8+ additional panels, a browser-side VM interpreter, a step debugger, and comparison views.

This ticket plans the migration of the existing frontend into a **modular, themeable React application** using:

- **React 18** with TypeScript for component architecture
- **Redux Toolkit + RTK Query** for state management and API layer
- **Vite** for build tooling and dev server
- **CSS custom properties + `data-part` selectors** for theming (per the react-modular-themable-storybook pattern)
- **Storybook** for component development and visual testing

The migration preserves the current UX pixel-for-pixel while creating the extensible component architecture needed for GNOSIS-003's dynamic mode.

## 2. Problem Statement

### Current limitations

1. **Single-file monolith**: All 620 lines of HTML, CSS, and JS live in one file. Adding GNOSIS-003's dynamic panels (~8 new panels, debugger, comparison mode) would push this past 2000 lines with no separation of concerns.

2. **Global mutable state**: `compileResult`, `highlightPc`, `overlays`, `bindValues`, `currentTab`, `currentEditorTab`, and `astStage` are all top-level `let` variables. Adding dynamic mode state (mode switch, runtime payloads, debugger snapshots, slot tables, stack state) into this model will create tangled dependencies.

3. **No type safety**: Vanilla JS with no TypeScript means no compiler-checked contracts between the API layer, state, and UI panels.

4. **No component reuse**: Panel rendering is done via `innerHTML` string concatenation (e.g., `updateDisasm()`, `updateAST()`, `updateHex()`). These can't be composed, tested, or themed independently.

5. **No build pipeline**: No bundler, no tree-shaking, no code splitting. The existing React JSX files in `source/` are unused because there's no build step.

### What we need for GNOSIS-003

- Mode switch (STATIC / DYNAMIC) controlling which panels, editors, and compile endpoints are active
- Runtime editor panel for dynamic payloads
- 8+ new panels (SLOTS, STACK, IR, EVAL, COMPARE, DEBUGGER, plus modified DISASM and MANIFEST)
- Client-side GNDY VM interpreter with step debugger state
- Comparison view with dual canvases and slot diff tables
- Stable component architecture that an intern can extend

## 3. Proposed Solution: Component Architecture

### 3.1 Project Setup

```
web/
  package.json
  tsconfig.json
  vite.config.ts
  index.html              (Vite entry point — minimal shell)
  src/
    main.tsx              (React mount point)
    App.tsx               (Root layout, mode switch)
    store/
      index.ts            (Redux store configuration)
      api.ts              (RTK Query API definition)
      slices/
        compilerSlice.ts  (mode, source, props, compile results)
        editorSlice.ts    (editor tab state, auto-compile)
        inspectorSlice.ts (active tab, panel state)
        canvasSlice.ts    (overlays, hover info, zoom)
        dynamicSlice.ts   (runtime payloads, debugger state — GNOSIS-003)
    components/
      Header/
        Header.tsx
        parts.ts
      Editor/
        Editor.tsx
        SourceEditor.tsx
        PropsEditor.tsx
        parts.ts
      Canvas/
        Canvas.tsx
        CanvasOverlays.tsx
        parts.ts
      Inspector/
        Inspector.tsx
        TabBar.tsx
        parts.ts
        panels/
          DisassemblyPanel.tsx
          ASTPanel.tsx
          HexPanel.tsx
          StatsPanel.tsx
          ManifestPanel.tsx
          RegionsPanel.tsx
          BindSimPanel.tsx
    engine/
      bytecodeExecutor.ts (extracted from current inline executeBytecode)
      bitmapFont.ts       (extracted BM glyph data + blitChar/blitText)
      overlays.ts         (bounds, dirty, depth overlay renderers)
      base64.ts           (base64ToBytes utility)
    styles/
      workbench.css       (base layout using data-part selectors + tokens)
      theme-terminal.css  (current dark terminal theme — default)
      theme-light.css     (optional: light theme for presentations)
    types/
      api.ts              (CompileRequest, CompileResponse, Preset types)
      compiler.ts         (Program, Stats, Region, Bind types)
  .storybook/
    main.ts
    preview.ts
```

### 3.2 Component Decomposition

The current `web/index.html` maps to React components as follows:

| Current HTML/JS | React Component | data-part | Redux State |
|---|---|---|---|
| `#app` grid layout | `<App>` | `root` | — |
| `#header` bar | `<Header>` | `header` | `compiler.mode` |
| `#preset-select` | `<Header>` (child) | `preset-select` | `api.getPresets` |
| `#btn-compile` | `<Header>` (child) | `compile-button` | `compiler.compileStatus` |
| `#left` panel | `<Editor>` | `editor` | `editor.activeTab` |
| `#source-editor` textarea | `<SourceEditor>` | `source-editor` | `compiler.sourceText` |
| `#props-editor` textarea | `<PropsEditor>` | `props-editor` | `compiler.propsText` |
| `#error-bar` | `<Editor>` (child) | `error-bar` | `compiler.error` |
| `#stats-bar` | `<Editor>` (child) | `stats-bar` | `compiler.stats` |
| `#canvas-area` | `<Canvas>` | `canvas-area` | `canvas.overlays` |
| `#epd` canvas element | `<Canvas>` (ref) | `canvas` | `compiler.result` |
| `#overlay-bar` buttons | `<CanvasOverlays>` | `overlay-bar` | `canvas.overlays` |
| `#bottom-tabs` | `<TabBar>` | `tab-bar` | `inspector.activeTab` |
| `#inspector` | `<Inspector>` | `inspector` | `inspector.activeTab` |
| `#panel-disasm` | `<DisassemblyPanel>` | `panel-disasm` | `compiler.result.disassembly` |
| `#panel-ast` | `<ASTPanel>` | `panel-ast` | `compiler.result.stages` |
| `#panel-hex` | `<HexPanel>` | `panel-hex` | `compiler.result.bytecode` |
| `#panel-stats` | `<StatsPanel>` | `panel-stats` | `compiler.result.stats` |
| `#panel-manifest` | `<ManifestPanel>` | `panel-manifest` | `compiler.result.program` |
| `#panel-regions` | `<RegionsPanel>` | `panel-regions` | `compiler.result.regions` |
| `#panel-bindsim` | `<BindSimPanel>` | `panel-bindsim` | `compiler.bindValues` |

### 3.3 Redux Store Design

```typescript
// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { compilerApi } from './api';
import compilerReducer from './slices/compilerSlice';
import editorReducer from './slices/editorSlice';
import inspectorReducer from './slices/inspectorSlice';
import canvasReducer from './slices/canvasSlice';

export const store = configureStore({
  reducer: {
    compiler: compilerReducer,
    editor: editorReducer,
    inspector: inspectorReducer,
    canvas: canvasReducer,
    [compilerApi.reducerPath]: compilerApi.reducer,
  },
  middleware: (getDefault) =>
    getDefault().concat(compilerApi.middleware),
});
```

#### compilerSlice

```typescript
interface CompilerState {
  mode: 'static' | 'dynamic';         // GNOSIS-003 mode switch
  sourceText: string;
  propsText: string;
  compileResult: CompileResponse | null;
  compileStatus: 'idle' | 'compiling' | 'success' | 'error';
  error: string | null;
  bindValues: Record<string, string>;  // runtime bind sim values
  autoCompile: boolean;
}
```

#### editorSlice

```typescript
interface EditorState {
  activeTab: 'source' | 'props';
}
```

#### inspectorSlice

```typescript
interface InspectorState {
  activeTab: string;                    // 'disasm' | 'ast' | 'hex' | ...
  inspectorHeight: number;             // resizable panel height
  astStage: string;                    // 'laid_out' | 'parsed' | etc.
  highlightPc: number;                // disasm highlight offset
}
```

#### canvasSlice

```typescript
interface CanvasState {
  overlays: {
    bounds: boolean;
    dirty: boolean;
    depth: boolean;
  };
  hoverInfo: string;
}
```

### 3.4 RTK Query API Layer

```typescript
// store/api.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { CompileRequest, CompileResponse, Preset } from '../types/api';

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
    getPresets: builder.query<{ presets: Preset[] }, void>({
      query: () => '/presets',
    }),
    getPreset: builder.query<{ source: string; props: string }, string>({
      query: (name) => `/presets/${name}`,
    }),
    getOptions: builder.query<Record<string, unknown>, void>({
      query: () => '/options',
    }),
    // GNOSIS-003: dynamic endpoints (added later)
    // compileDynamic: builder.mutation<DynamicCompileResponse, DynamicCompileRequest>({...}),
    // getDynamicPresets: builder.query<{ presets: Preset[] }, void>({...}),
  }),
});

export const {
  useCompileMutation,
  useGetPresetsQuery,
  useGetPresetQuery,
  useGetOptionsQuery,
} = compilerApi;
```

### 3.5 Theming Strategy

Following the react-modular-themable-storybook pattern:

**Token layer** (CSS custom properties on `[data-widget="gnosis-workbench"]`):

```css
:where([data-widget="gnosis-workbench"]) {
  /* Color tokens */
  --color-bg: #0c0b0a;
  --color-bg2: #161513;
  --color-bg3: #1a1916;
  --color-border: #2e2c28;
  --color-fg: #b0aa9e;
  --color-dim: #5a5850;
  --color-dim2: #3a3830;
  --color-accent: #8a8670;
  --color-green: #6a8a50;
  --color-red: #d04040;
  --color-red-bg: #2a1010;
  --color-orange: #c0a080;

  /* Typography tokens */
  --font-mono: 'Share Tech Mono', 'Courier New', monospace;
  --font-size-xs: 9px;
  --font-size-sm: 10px;
  --font-size-base: 11px;
  --font-size-md: 12px;

  /* Spacing tokens */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;

  /* Layout tokens */
  --editor-width: 380px;
  --inspector-height: 260px;
  --header-height: auto;

  /* E-ink canvas tokens */
  --canvas-bg: #d8d4cc;
}
```

**Part selectors** (stable styling hooks for each component):

```css
/* Base layout — structure only, references tokens */
:where([data-widget="gnosis-workbench"]) [data-part="header"] {
  padding: var(--space-1) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  background: var(--color-bg2);
}

:where([data-widget="gnosis-workbench"]) [data-part="editor"] {
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  background: var(--color-bg2);
}

/* ... etc for each data-part */
```

**Theme files** override tokens only:

```css
/* theme-terminal.css — current dark look (default) */
:where([data-widget="gnosis-workbench"]) {
  --color-bg: #0c0b0a;
  --color-fg: #b0aa9e;
  /* ... */
}

/* theme-light.css — light mode for presentations */
:where([data-widget="gnosis-workbench"]) {
  --color-bg: #f5f3ef;
  --color-fg: #2a2a28;
  --color-bg2: #eae8e4;
  --canvas-bg: #ffffff;
  /* ... */
}
```

**`parts.ts` files** export part name constants to prevent typos:

```typescript
// components/Header/parts.ts
export const PARTS = {
  header: 'header',
  presetSelect: 'preset-select',
  compileButton: 'compile-button',
  compileStatus: 'compile-status',
  modeSwitch: 'mode-switch',
} as const;
```

### 3.6 Key Component Sketches

#### App.tsx (root)

```tsx
export function App() {
  return (
    <div data-widget="gnosis-workbench" data-part="root">
      <Header />
      <Editor />
      <Canvas />
      <ResizeHandle />
      <Inspector />
    </div>
  );
}
```

#### Canvas.tsx (extracted bytecode executor)

The canvas component uses a `ref` and calls the extracted `executeBytecode()` engine function imperatively via `useEffect`:

```tsx
export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const result = useSelector(selectCompileResult);
  const overlays = useSelector(selectOverlays);

  useEffect(() => {
    if (!canvasRef.current || !result) return;
    renderToCanvas(canvasRef.current, result, overlays);
  }, [result, overlays]);

  return (
    <div data-part="canvas-area">
      <div data-part="canvas-wrap">
        <canvas ref={canvasRef} data-part="canvas" />
      </div>
      <CanvasOverlays />
    </div>
  );
}
```

#### Inspector.tsx (tab system)

```tsx
export function Inspector() {
  const activeTab = useSelector(selectActiveTab);
  const height = useSelector(selectInspectorHeight);

  const panels: Record<string, React.FC> = {
    disasm: DisassemblyPanel,
    ast: ASTPanel,
    hex: HexPanel,
    stats: StatsPanel,
    manifest: ManifestPanel,
    regions: RegionsPanel,
    bindsim: BindSimPanel,
    // GNOSIS-003 will add: slots, stack, ir, eval, compare, debugger
  };

  const Panel = panels[activeTab] ?? DisassemblyPanel;

  return (
    <div data-part="inspector" style={{ height }}>
      <Panel />
    </div>
  );
}
```

### 3.7 Auto-Compile with RTK Query

The current auto-compile uses a 400ms debounce timer on source/props changes. In Redux:

```typescript
// In a useAutoCompile hook:
const [compile] = useCompileMutation();
const source = useSelector(selectSourceText);
const props = useSelector(selectPropsText);
const auto = useSelector(selectAutoCompile);

useEffect(() => {
  if (!auto) return;
  const timer = setTimeout(() => {
    compile({ source, props });
  }, 400);
  return () => clearTimeout(timer);
}, [source, props, auto, compile]);
```

RTK Query handles loading state, caching, and error state automatically. The `compileStatus` in the store is derived from the mutation state.

## 4. Design Decisions

### D1: Vite over Webpack/Parcel

**Decision**: Use Vite as the build tool.

**Rationale**: Vite provides instant HMR, native ESM dev server, and minimal config. The project has no legacy Webpack config to migrate. Vite's React plugin handles JSX/TSX out of the box. The Flask backend can be proxied in `vite.config.ts`.

### D2: Redux Toolkit + RTK Query over alternatives

**Decision**: Use Redux Toolkit with RTK Query for state management.

**Rationale**:
- The workbench has a single global compile result that feeds 7+ panels simultaneously — this is classic shared state that benefits from a centralized store
- RTK Query replaces all manual `fetch()` calls with declarative hooks, automatic caching, and loading/error state management
- The GNOSIS-003 debugger state (step history, slot snapshots, stack frames) is complex enough to warrant Redux slices over React context
- RTK Query mutations let us trigger compile from multiple places (button, auto-compile, preset load) with consistent behavior
- Redux DevTools provide free state inspection — valuable for a developer tool like this

**Alternatives rejected**:
- *React Context + useReducer*: Would work for simple state but doesn't scale to GNOSIS-003's debugger snapshots; no built-in caching for API calls
- *Zustand*: Lighter weight but lacks RTK Query's API layer; would need a separate data fetching solution
- *TanStack Query + Jotai*: Good combo but more fragmented; Redux is more cohesive for this use case

### D3: CSS custom properties + data-part over CSS-in-JS

**Decision**: Use CSS custom properties for tokens and `data-part` attribute selectors for styling hooks.

**Rationale**:
- The current app already uses CSS custom properties (`:root` vars)
- `data-part` selectors provide stable theming hooks that don't break when component internals change
- No runtime CSS-in-JS overhead (matters for canvas-heavy rendering)
- Themes are swappable via loading different CSS files
- Aligns with the react-modular-themable-storybook pattern

### D4: Extract engine code into pure TypeScript modules

**Decision**: Extract `executeBytecode()`, `BM` font data, `blitChar/blitText`, and overlay renderers into pure `.ts` modules under `engine/`.

**Rationale**:
- These are pure functions (canvas context + data → pixels) with no React dependency
- Must be reusable between static and dynamic (GNOSIS-003) render paths
- Can be unit-tested independently without DOM
- The existing `source/gnosis-compiler.jsx` and `source/gnosis-engine.jsx` have reference implementations that can inform the TypeScript versions

### D5: Dev proxy to Flask backend

**Decision**: Use Vite's proxy config to forward `/api/*` to the Flask server during development.

**Rationale**:
- Keeps the Python compilation backend unchanged
- No CORS issues
- In production, Flask serves the built frontend from `web/dist/`
- Matches the go-web-frontend-embed pattern (two-process dev, single-binary prod)

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
```

### D6: Inspector as extensible panel registry

**Decision**: Use a panel registry pattern where panels are keyed by tab ID and dynamically rendered.

**Rationale**:
- GNOSIS-003 adds 6-8 new panels; a registry avoids hardcoded conditionals
- Each panel is a self-contained component that receives compile result from Redux
- Mode-aware filtering: panels declare which modes they support (`static`, `dynamic`, `both`)
- Tabs can be added/removed without touching the Inspector shell

```typescript
interface PanelRegistration {
  id: string;
  label: string;
  modes: ('static' | 'dynamic')[];
  component: React.FC;
}
```

## 5. Alternatives Considered

### A1: Incremental enhancement of vanilla JS

**Rejected**: Adding GNOSIS-003's 8+ panels, debugger state, and comparison mode into the existing single-file architecture would result in ~2000+ lines of tangled global state. The existing `innerHTML`-based panel rendering doesn't compose and can't be tested.

### A2: Use the existing source/gnosis-compiler.jsx directly

**Rejected**: The existing JSX files are standalone React components with their own embedded compiler and executor — they don't connect to the Flask backend API. They're useful as reference for the bytecode executor but the component architecture doesn't match the modular pattern we need.

### A3: Svelte or Solid instead of React

**Rejected**: React has the broadest ecosystem, the team's JSX files show React familiarity, and Redux Toolkit/RTK Query are React-native. Svelte/Solid would require re-learning patterns and choosing less mature state management libraries.

### A4: Server-side rendering (Next.js)

**Rejected**: This is a developer tool, not a content site. There's no SEO or first-paint benefit. The Flask backend would need to be proxied or replaced. Unnecessary complexity.

## 6. Implementation Plan — Migration Phases

### Phase 1: Scaffold and Build Pipeline (no behavior change)

**Goal**: Set up the React/Vite/TypeScript project, serve a "hello world", proxy to Flask.

**Deliverables**:
- `package.json` with React 18, Redux Toolkit, RTK Query, TypeScript, Vite
- `vite.config.ts` with Flask proxy
- `tsconfig.json`
- `src/main.tsx` mounting `<App>`
- Verify `npm run dev` proxies `/api/compile` to Flask
- Storybook config (`.storybook/main.ts`, `preview.ts`)

**Done when**: `npm run dev` shows a React page, `/api/compile` works through the proxy.

### Phase 2: Extract Engine Code to TypeScript

**Goal**: Move pure rendering logic out of `index.html` into typed, testable modules.

**Deliverables**:
- `engine/bitmapFont.ts` — BM glyph data, `blitChar()`, `blitText()`
- `engine/bytecodeExecutor.ts` — `executeBytecode()`, opcode dispatch, `readU16LE()`
- `engine/overlays.ts` — `drawBoundsOverlay()`, `drawDirtyOverlay()`, `drawDepthOverlay()`
- `engine/base64.ts` — `base64ToBytes()`
- Unit tests for `readU16LE()`, `base64ToBytes()`, opcode parsing

**Done when**: Engine modules compile, tests pass, no React dependency in `engine/`.

### Phase 3: Redux Store and RTK Query

**Goal**: Set up the centralized state and API layer.

**Deliverables**:
- `store/index.ts` — configured store
- `store/api.ts` — RTK Query endpoints (`compile`, `getPresets`, `getPreset`, `getOptions`)
- `store/slices/compilerSlice.ts` — mode, source, props, result, error, bindValues, autoCompile
- `store/slices/editorSlice.ts` — active editor tab
- `store/slices/inspectorSlice.ts` — active inspector tab, height, astStage, highlightPc
- `store/slices/canvasSlice.ts` — overlay toggles, hover info
- `types/api.ts` — TypeScript interfaces for all API contracts

**Done when**: Store compiles, slices have initial state, RTK Query hooks are exported.

### Phase 4: Shell Components (Header, Editor, Canvas)

**Goal**: Rebuild the top-level layout as React components with the current theme.

**Deliverables**:
- `<App>` with CSS grid layout matching current `#app`
- `<Header>` with preset selector, compile button, auto-compile toggle, status
- `<Editor>` with source/props tab switch, textareas wired to Redux
- `<Canvas>` rendering compile result via engine modules
- `<CanvasOverlays>` with bounds/dirty/depth toggles
- `<ResizeHandle>` with drag behavior
- `styles/workbench.css` with `data-part` selectors
- `styles/theme-terminal.css` with current dark theme tokens
- `parts.ts` files for each component

**Done when**: The React app visually matches the current `web/index.html`. All existing features work.

### Phase 5: Inspector Panels

**Goal**: Rebuild all 7 inspector panels as React components.

**Deliverables**:
- `<TabBar>` rendering mode-filtered tabs
- `<Inspector>` with panel registry and dynamic rendering
- `<DisassemblyPanel>` with click-to-highlight
- `<ASTPanel>` with stage selector and collapsible tree
- `<HexPanel>` with offset/byte/ASCII rows
- `<StatsPanel>` with stat cards grid
- `<ManifestPanel>` with JSON viewer
- `<RegionsPanel>` with region items
- `<BindSimPanel>` with bind value inputs that trigger re-render
- Storybook stories for each panel

**Done when**: All 7 panels render correctly from Redux state. Feature parity with vanilla version.

### Phase 6: Integration Testing and Cutover

**Goal**: Validate the React app matches the vanilla version, then replace it.

**Deliverables**:
- Side-by-side manual testing against all presets
- `web_server.py` updated to serve from `web/dist/` (Vite build output)
- `npm run build` produces production bundle
- Old `web/index.html` archived (not deleted — kept as reference)
- Storybook build succeeds

**Done when**: `python web_server.py` serves the React-built frontend, all presets compile and render correctly, inspector panels work.

### Phase 7: GNOSIS-003 Extension Points (stub)

**Goal**: Prepare the architecture for dynamic mode without implementing it.

**Deliverables**:
- Mode switch in `<Header>` (STATIC / DYNAMIC) wired to `compiler.mode`
- Panel registry accepts mode filters
- `dynamicSlice.ts` stub with empty state shape
- RTK Query stubs for `/api/compile-dynamic` and `/api/presets-dynamic`
- Documentation of extension points for intern handoff

**Done when**: Mode switch toggles, panel tabs filter by mode, dynamic slice exists in store.

## 7. Data Flow Diagram

```
User types source YAML
  → Redux dispatch: setSourceText(text)
  → useAutoCompile hook: debounce 400ms
  → RTK Query: compile.mutate({ source, props })
  → Flask POST /api/compile
  → Redux: compileResult updated in store
  → All subscribed components re-render:
      → <Canvas> calls executeBytecode() on canvas ref
      → <DisassemblyPanel> renders from result.disassembly
      → <ASTPanel> renders from result.stages
      → <StatsPanel> renders from result.stats
      → etc.

User selects preset
  → RTK Query: getPreset.query(name)
  → Redux dispatch: setSourceText(preset.source), setPropsText(preset.props)
  → Triggers auto-compile chain above

User toggles overlay
  → Redux dispatch: toggleOverlay('bounds')
  → <Canvas> re-renders with overlay

User changes inspector tab
  → Redux dispatch: setActiveTab('hex')
  → <Inspector> renders <HexPanel>
```

## 8. Storybook Strategy

Each component gets stories demonstrating:

1. **Default state** — component with realistic data
2. **Empty state** — component with no compile result
3. **Error state** — component showing compile error
4. **Theme override** — component with custom token values
5. **Unstyled** — component with no theme CSS loaded

Example:

```tsx
// components/Inspector/panels/DisassemblyPanel.stories.tsx
const meta: Meta<typeof DisassemblyPanel> = {
  title: 'Inspector/DisassemblyPanel',
  component: DisassemblyPanel,
  decorators: [withReduxProvider(mockStoreWithDisasm)],
};

export const Default: Story = {};
export const HighlightedLine: Story = {
  args: { highlightPc: 0x0a },
};
export const Empty: Story = {
  decorators: [withReduxProvider(emptyStore)],
};
```

## 9. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Canvas rendering regression | High | Side-by-side testing against all presets; keep engine code as pure functions with tests |
| Performance — Redux re-renders | Medium | Use `createSelector` for memoized selectors; panels only subscribe to their data slice |
| Theme token sprawl | Low | Keep token set minimal (~20 tokens); derive component-specific values from base tokens |
| Build pipeline complexity | Medium | Vite is zero-config for React/TS; proxy config is 3 lines |
| GNOSIS-003 integration friction | Medium | Panel registry and mode switch are designed in from Phase 4; dynamic slice stub in Phase 7 |

## 10. Open Questions

1. **Font loading**: Should `Share Tech Mono` be loaded via Google Fonts CDN or bundled locally? (Current: Google Fonts link assumed, not present in HTML — may be system fallback)
2. **Storybook data**: Should mock compile results be generated from actual preset compilation or hand-crafted fixtures?
3. **Code splitting**: Should inspector panels be lazy-loaded (`React.lazy`) or eagerly bundled? (Likely not worth it at this scale)
4. **E2E tests**: Should we add Playwright tests against the Flask + Vite dev server, or is manual preset testing sufficient for Phase 6?

## 11. References

- **GNOSIS-003**: Dynamic VM Debug UI UX Handoff Package — defines the dynamic mode panels this architecture must support
- **GNOSIS-002**: Dynamic VM Integration — defines the backend API contracts for dynamic compilation
- **GNOSIS-001**: Original compiler web UI experimentation
- `web/index.html`: Current single-file frontend (620 lines)
- `web_server.py`: Flask backend (185 lines)
- `source/gnosis-compiler.jsx`: Reference React implementation with bytecode compiler/executor
- `source/gnosis-engine.jsx`: Reference React rendering engine
- `docs/architecture-guide.md`: System architecture overview
