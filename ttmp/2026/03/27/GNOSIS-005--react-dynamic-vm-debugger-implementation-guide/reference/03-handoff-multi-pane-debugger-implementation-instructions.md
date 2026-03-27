---
Title: 'Handoff: Multi-Pane Debugger Implementation Instructions'
Ticket: GNOSIS-005
Status: active
Topics:
    - compiler
    - dynamic-vm
    - webui
    - react
    - redux
    - debugger
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/design-doc/02-multi-pane-debugger-and-interactive-vm-explorer-design.md
      Note: Primary design doc you will be implementing
    - Path: ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/design-doc/01-react-dynamic-vm-debugger-analysis-design-and-implementation-guide.md
      Note: Background on the system architecture and VM model
    - Path: ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/reference/01-investigation-diary.md
      Note: Diary of all work done so far with technical details and lessons learned
ExternalSources: []
Summary: Short handoff guide for the next UX designer implementing the multi-pane debugger and interactive VM explorer
LastUpdated: 2026-03-27
WhatFor: Onboard the next implementer onto the GNOSIS-005 ticket and docmgr workflow
WhenToUse: When starting work on the multi-pane debugger implementation
---


# Handoff: Multi-Pane Debugger Implementation Instructions

## Your Mission

You are implementing a **multi-pane debugger** and **interactive VM explorer** for the GNOSIS dynamic VM workbench. The current debugger works (step, back, run, breakpoints, oracle validation) but forces tab switching to see different views. Your job is to make all views visible simultaneously and add Bret Victor-style interactive article screens.


## 1. Getting Oriented with docmgr

All project documentation lives in `ttmp/` and is managed by the `docmgr` CLI. Here is what you need to know.

### Essential commands

```bash
# See the ticket overview
docmgr ticket list --ticket GNOSIS-005

# See all documents
docmgr doc list --ticket GNOSIS-005

# See open tasks (your work items)
docmgr task list --ticket GNOSIS-005

# See what changed and when
cat ttmp/2026/03/27/GNOSIS-005--react-dynamic-vm-debugger-implementation-guide/changelog.md
```

### Working loop (do this for each piece of work)

```bash
# 1. Implement + test your change
cd web && npx tsc --noEmit && npx vite build

# 2. Commit code
git add <files> && git commit -m "..."

# 3. Check off the task
docmgr task check --ticket GNOSIS-005 --id <N>

# 4. Relate any files you changed to the diary
docmgr doc relate \
  --doc ttmp/.../reference/01-investigation-diary.md \
  --file-note "/abs/path/to/file.tsx:What changed"

# 5. Update changelog
docmgr changelog update --ticket GNOSIS-005 \
  --entry "What you did (commit <hash>)" \
  --file-note "/abs/path/to/file.tsx:Reason"

# 6. Write a diary step (append to the diary doc)
# Follow the step format in the diary skill

# 7. Commit docs
git add ttmp/... && git commit -m "Diary: record step N"
```


## 2. Documents to Read (in order)

### Read first: The design you are implementing

**Design Doc 02: Multi-Pane Debugger and Interactive VM Explorer Design**
`ttmp/.../design-doc/02-multi-pane-debugger-and-interactive-vm-explorer-design.md`

This is your primary spec. It contains:
- ASCII layouts for the multi-pane debugger (full-screen and compact variants)
- Pane details (disassembly, slots, stack, canvas) with exact behaviors
- Connected highlighting rules (how stepping propagates across panes)
- 4 interaction walkthroughs showing real debugging scenarios
- 7 interactive article screens (Bret Victor-style) with ASCII mockups
- Component architecture and Redux state changes
- Implementation plan (Phase 1-4)

### Read second: System architecture background

**Design Doc 01: React Dynamic VM Debugger Analysis, Design, and Implementation Guide**
`ttmp/.../design-doc/01-react-dynamic-vm-debugger-analysis-design-and-implementation-guide.md`

This explains the full system: Python compiler, GNDY bytecode format, 17 opcodes, VM execution model, backend API contract, Redux store shape. Read this to understand *what* the debugger is debugging.

### Read third: What has been built and what was tricky

**Investigation Diary**
`ttmp/.../reference/01-investigation-diary.md`

Steps 1-4 document all prior work. Pay special attention to:
- **Step 3** (the debugger implementation): explains the module-level singleton pattern for `GNDYDebugger` and why `useRef` failed (panels unmount on tab switch).
- The "What was tricky" and "What didn't work" sections -- these save you from repeating mistakes.

### Optional: Deep VM/hardware background

**VM, Microcode, and FPGA Reading Guide**
`ttmp/.../reference/02-vm-microcode-and-fpga-reading-guide.md`

Only if you want to understand the broader system design philosophy.


## 3. What to Do (Your Open Tasks)

```
[18] [ ] Implement multi-pane debugger layout (Phase 1)
         - DebuggerLayout container with CSS grid
         - CanvasPane, DisassemblyPane, SlotsPane, StackPane
         - Horizontal and vertical splitters
         - Step controls move to Header when debugger is active
         - Toggle between normal mode and debugger mode in App.tsx

[19] [ ] Implement connected highlighting (Phase 2)
         - highlightedNode in debuggerSlice
         - Canvas bounding box overlay on active node
         - Slots pane row highlight for active node
         - Click canvas element -> highlight instruction in disassembly

[20] [ ] Implement interactive VM explorer article (Phase 3)
         - VMExplorer mode component
         - 7 widget components (StackCalculator, SlotGrid, CanvasPreview,
           Pipeline, HexViewer, DualRuntime, LayoutBuilder)
         - Article prose and screen assembly
```

**Start with task 18.** It is the foundation. Tasks 19 and 20 build on it.


## 4. Key Files You Will Be Working With

### Files to modify

| File | What | Why |
|------|------|-----|
| `web/src/App.tsx` | Root component | Switch between normal and debugger layout |
| `web/src/styles/workbench.css` | CSS grid | Add debugger-mode grid template |
| `web/src/components/Header/Header.tsx` | Header | Add conditional step controls |
| `web/src/store/slices/debuggerSlice.ts` | Redux | Add `highlightedNode`, layout state |
| `web/src/components/Inspector/registerPanels.ts` | Panel registry | May need adjustment |

### Files to create

| File | What |
|------|------|
| `web/src/components/Debugger/DebuggerLayout.tsx` | Multi-pane container |
| `web/src/components/Debugger/CanvasPane.tsx` | Compact canvas with status bar |
| `web/src/components/Debugger/DisassemblyPane.tsx` | Full disassembly with breakpoints |
| `web/src/components/Debugger/SlotsPane.tsx` | Slot grid with hide-zero toggle |
| `web/src/components/Debugger/StackPane.tsx` | Stack with context hints |
| `web/src/components/Debugger/Splitter.tsx` | Resizable pane splitter |
| `web/src/components/Explorer/VMExplorer.tsx` | Article mode container (Phase 3) |
| `web/src/components/Explorer/widgets/*.tsx` | 7 interactive widgets (Phase 3) |

### Files to read (existing engine code, do not modify unless necessary)

| File | What |
|------|------|
| `web/src/engine/gndy/decode.ts` | GNDY binary decoder, opcode definitions |
| `web/src/engine/gndy/interpreter.ts` | VM evaluator (mirrors Python) |
| `web/src/engine/gndy/debugger.ts` | Step debugger class (`GNDYDebugger`) |
| `web/src/engine/gndy/index.ts` | Barrel exports |
| `web/src/components/Inspector/panels/DebuggerPanel.tsx` | Current debugger panel (has module-level singleton pattern) |


## 5. Skills to Read

These are Claude Code skills (in `~/.claude/skills/`) that define workflows you should follow:

| Skill | When to use |
|-------|-------------|
| **`docmgr`** | Every time you touch ticket docs, tasks, changelog, or file relationships |
| **`diary`** | After completing each implementation step -- write a diary entry |
| **`react-modular-themable-storybook`** | When building the new pane components -- use `data-part` selectors, CSS variables, and consider Storybook stories |
| **`frontend-design`** | When designing the visual look of the multi-pane layout and the interactive article |
| **`remarkable-upload`** | When you want to upload updated docs to reMarkable for review |
| **`git-commit-instructions`** | For clean commit hygiene |

To read a skill, run `/skill-name` in Claude Code or look at `~/.claude/skills/<name>/`.


## 6. How to Run and Test

```bash
# Start the backend (in a tmux session or background)
cd /home/manuel/code/wesen/2026-03-22--gnosis-compiler
python web_server.py --port 8085

# TypeScript check
cd web && npx tsc --noEmit

# Dev server (hot reload)
cd web && npx vite --port 3000

# Production build (what Flask serves from dist/)
cd web && npx vite build

# Test in browser
# 1. Open http://localhost:8085 (or :3000 for dev)
# 2. Select "sensor_dashboard" preset
# 3. Click COMPILE
# 4. Open DEBUGGER tab, click LOAD
# 5. Step through, check SLOTS/STACK, run to completion, click VALIDATE
# 6. Should show ORACLE: PASS
```


## 7. One Important Gotcha

The `GNDYDebugger` instance and decoded `GNDYProgram` live as **module-level singletons** in `DebuggerPanel.tsx`, not in React state or refs. This is because inspector panels unmount when you switch tabs, which would destroy `useRef` state. When you refactor into multi-pane layout (where all panes are mounted simultaneously), you may be able to move these back into a shared React context or a parent component's ref. But test carefully -- the singleton pattern works and the multi-pane layout may still unmount panes during the normal-to-debugger mode transition.
