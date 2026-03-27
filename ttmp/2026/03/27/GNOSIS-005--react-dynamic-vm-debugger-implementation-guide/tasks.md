# Tasks

## TODO

- [x] Create GNOSIS-005 ticket workspace and base documents
- [x] Gather evidence from the current compiler, React workbench, backend API, and prior debugger design docs
- [x] Write the initial React debugger analysis, design, and implementation guide
- [x] Remove the static compiler, static API surface, static examples, and legacy static frontend paths
- [x] Simplify the React app to dynamic-only compile and inspection flow
- [x] Update the GNOSIS-005 design plan to assume dynamic-only architecture with no backward compatibility
- [x] Implement the browser-side GNDY interpreter and debugger core
- [x] Add dynamic debugger panels for eval, slots, stack, IR, compare, and step control
- [ ] Add runtime editors and browser-vs-Python oracle validation
- [x] Create GNDY binary decoder (web/src/engine/gndy/decode.ts)
- [x] Create GNDY interpreter mirroring Python VM (web/src/engine/gndy/interpreter.ts)
- [x] Create GNDY debugger with stepping and snapshots (web/src/engine/gndy/debugger.ts)
- [x] Create debugger Redux slice (web/src/store/slices/debuggerSlice.ts)
- [x] Create debugger inspector panels (DebuggerPanel, SlotsPanel, StackPanel)
- [x] Wire debugger into app, Canvas incremental rendering, oracle validation
- [x] Update diary and changelog with implementation details
- [x] Add intern-facing VM, microcode, and FPGA reading/reference guide
- [x] Add experiment note for implementing the current VM in Verilog for vector graphics control
- [ ] Implement multi-pane debugger layout (Phase 1: DebuggerLayout, CanvasPane, DisassemblyPane, SlotsPane, StackPane, splitters)
- [ ] Implement connected highlighting across panes (Phase 2: highlightedNode, canvas bbox overlay, slot row highlight)
- [ ] Implement interactive VM explorer article system (Phase 3: VMExplorer mode, 7 widget components, article prose)
