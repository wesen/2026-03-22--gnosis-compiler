---
Title: Multi-Pane Debugger and Interactive VM Explorer Design
Ticket: GNOSIS-005
Status: active
Topics:
    - compiler
    - dynamic-vm
    - webui
    - react
    - redux
    - debugger
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: web/src/App.tsx
      Note: |-
        Root component that owns the CSS grid layout
        Root component owning the CSS grid layout that will switch between normal and debugger mode
    - Path: web/src/components/Inspector/Inspector.tsx
      Note: Current single-panel inspector to be replaced
    - Path: web/src/components/Inspector/panels/DebuggerPanel.tsx
      Note: Current debugger panel to be split into sub-panes
    - Path: web/src/engine/gndy/debugger.ts
      Note: |-
        Step debugger engine used by all panes
        Step debugger engine shared across all panes
    - Path: web/src/store/slices/debuggerSlice.ts
      Note: Redux slice shared across all panes
    - Path: web/src/styles/workbench.css
      Note: |-
        Current grid layout definitions
        CSS grid definitions to be extended for multi-pane debugger layout
ExternalSources: []
Summary: Redesign the debugger from a tab-switching inspector into a multi-pane layout where all debugger views are visible simultaneously, plus design for Bret Victor-style interactive article screens that teach the VM through embedded explorable components.
LastUpdated: 2026-03-27T00:00:00Z
WhatFor: Guide the implementation of the multi-pane debugger layout and the interactive VM explorer article
WhenToUse: When implementing the multi-pane debugger UI or the interactive article system
---



# Multi-Pane Debugger and Interactive VM Explorer Design

## Executive Summary

The current debugger requires switching between 8 tabs at the bottom of the screen to see different views (disassembly, slots, stack, eval, IR, hex, manifest, debugger controls). This design replaces the tab-switching inspector with a **multi-pane debugger layout** where all critical views are visible simultaneously. It also introduces an **interactive article system** inspired by Bret Victor's explorable explanations, where VM concepts are taught through embedded, connected, live components.

## Problem Statement

### Current Pain Points

1. **Tab switching breaks flow.** When stepping through instructions, the developer must switch between DEBUGGER (to step), SLOTS (to see the effect), STACK (to see intermediate values), and DISASSEMBLY (to see context). Each switch loses the other view.

2. **No spatial relationship between views.** The developer builds a mental model by remembering what they saw in each tab. The slots panel does not know what the disassembly is showing; the stack panel does not know which instruction is executing.

3. **Canvas is disconnected from the debugger.** The canvas updates with draw ops but has no visual connection to which instruction produced each element.

4. **No learning path.** A new developer sees a wall of panels and has no guided way to understand what the VM does, how slots relate to layout, or how bytecode becomes pixels.

### Design Goals

- **All-at-once visibility.** Show disassembly, slots, stack, canvas, and controls in a single view without tab switching.
- **Connected highlighting.** When the user steps to a STORE_SLOT instruction, the corresponding slot lights up in the slots pane. When a DRAW_TEXT_BIND executes, the drawn element highlights on the canvas.
- **Compact density.** The debugger should feel like a hardware logic analyzer or oscilloscope: dense, information-rich, monospaced.
- **Explorable articles.** Provide a separate "Learn the VM" mode where interactive article screens teach each concept (stack machine, slots, layout, rendering) through embedded live components.


---

## Part 1: Multi-Pane Debugger Layout

### Layout Overview

Replace the current `header / editor+canvas / tabs / inspector` grid with a debugger-aware layout that activates when the debugger is loaded.

**Normal mode** (no debugger): Unchanged from current layout.

**Debugger mode** (after clicking LOAD): The canvas shrinks, and the right side splits into multiple simultaneous panes.

### ASCII Layout: Debugger Mode (Full Screen)

```
+===========================================================================+
| GNOSIS // DYNAMIC VM WORKBENCH   [sensor_dashboard v] COMPILE [x]AUTO    |
| [Normal readings v]  STEP  BACK  RUN  RUN>BP  RESET  VALIDATE     CLOSE |
+========================+==================================================+
|                        |                                                  |
|  SOURCE                |  CANVAS (compact, ~40% height)                   |
|                        |  +--------------------------------------------+ |
|  type: screen          |  | LAB-01                                     | |
|  width: 280            |  | ___________________________________        | |
|  height: 120           |  | TEMP: 22   C                               | |
|  body:                 |  | [======-------]                            | |
|    type: fixed         |  | HUM:  45   %                               | |
|    children:           |  | [=============------]                      | |
|      - type: vbox      |  +--------------------------------------------+ |
|        x: 8            |                                                  |
|        y: 8            +----+-----------------------+--------------------+
|        gap: 4          |DISASSEMBLY (scrollable)    | SLOTS              |
|        children:       |                            |                    |
|          - type: hbox  | . 0000 MEASURE_TEXT_BIND   | node  mw mh  x  y |
|            gap: 2      | . 0006 PUSH_SLOT n4.mw     | n0     0  0  0  0 |
|            children:   | . 0009 STORE_SLOT n4.w      | n1     0  0  0  0 |
|              - type:   |>* 000c DRAW_TEXT_BIND  <--  | n2     0  0  0  0 |
|                label   | . 0013 DRAW_HLINE           | n3     0  0  0  0 |
|                bind:   | . 0017 DRAW_TEXT_CONST      | n4    96 16  8  8 |
|                props.  | . 001e DRAW_TEXT_BIND       | n5     0  0  8 28 |
|                title   | . 0025 DRAW_TEXT_CONST      | n6     0  0  0  0 |
|                size: 2 | . 002c DRAW_BAR_BIND        | n7     0  0  8 33 |
|                        | . 0035 DRAW_TEXT_CONST      | n8     0  0 50 33 |
|          - type: sep   | . 003c DRAW_TEXT_BIND       | n9     0  0 92 33 |
|            w: 260      | . 0043 DRAW_TEXT_CONST      |                   |
|                        | . 004a DRAW_BAR_BIND        +-------------------+
|                        | . 0053 HALT                 | STACK             |
|                        |                             |                   |
|                        | Phase: RENDER               | > [0]  96  0x0060 |
|                        | PC: 0x000c  Step: 3/14      |   [empty]         |
|                        | History: 3                   |                   |
+========================+=============================+====================+
| NODES:16  SLOTS:96  CODE:84B  STRINGS:4  BINDS:3  EVALS:2    ORACLE:PASS |
+===========================================================================+
```

### Key Layout Changes

1. **Header gains debugger controls.** The step buttons (STEP, BACK, RUN, etc.) move to the header bar when the debugger is active. This eliminates the need for a separate debugger controls pane.

2. **Canvas shrinks to ~40% of the right column height.** It remains visible at all times during debugging so the user can see draw ops appear incrementally.

3. **Right column below canvas splits into two columns:**
   - Left: **Disassembly** with breakpoints, current-PC indicator, and phase/step status at the bottom.
   - Right: **Slots** (top) and **Stack** (bottom), stacked vertically.

4. **Editor stays on the left**, unchanged. The source is always visible for reference during debugging.

5. **Status bar at the bottom** shows compile stats + oracle result.

### ASCII Layout: Debugger Mode (Compact Variant for Smaller Screens)

```
+===========================================================================+
| GNOSIS // VM WORKBENCH  [sensor_dashboard v]  COMPILE  [x]AUTO           |
| [Normal readings v]  STEP BACK RUN RUN>BP RESET VALIDATE          CLOSE |
+=========================+=================================================+
|                         | CANVAS (30% height)                             |
|  SOURCE                 | +---------------------------------------------+|
|                         | | LAB-01         TEMP:22 C  HUM:45 %          ||
|  type: screen           | | [====---]      [========-----]              ||
|  width: 280             | +---------------------------------------------+|
|  height: 120            +----------+------------------+------------------+
|  body:                  | DISASM   | SLOTS            | STACK            |
|    type: fixed          |          |                  |                  |
|    children:            |>*0000 M  | n4 96 16  8  8   | >[0] 96  0x0060 |
|      - type: vbox       |  0006 PS | n5  0  0  8 28   |                  |
|        ...              |  0009 SS | n7  0  0  8 33   |                  |
|                         |  000c DT | n8  0  0 50 33   |                  |
|                         |  0013 DH | n10 0  0  8 45   |                  |
|                         |  0017 DT | n12 0  0  8 55   |                  |
|                         |  001e DT | n15 0  0  8 67   |                  |
|                         |  ...     |                  |                  |
|                         | MEASURE  |   Changed:       |                  |
|                         | PC:0000  |   n4.mw: 0->96   |                  |
+=========================+==========+==================+==================+
| NODES:16 SLOTS:96 CODE:84B STRINGS:4 BINDS:3 EVALS:2        ORACLE:PASS |
+===========================================================================+
```

In the compact variant, the disassembly uses abbreviated opcode names (M=MEASURE_TEXT_BIND, PS=PUSH_SLOT, SS=STORE_SLOT, DT=DRAW_TEXT_*, DH=DRAW_HLINE, DB=DRAW_BAR_*) and the slots panel only shows non-zero nodes.


### Pane Details

#### Disassembly Pane

The disassembly pane is the primary navigation surface for the debugger.

```
+------------------------------------------+
| DISASSEMBLY                              |
|                                          |
|   0000  MEASURE_TEXT_BIND                |
|         node=4 bind=props.title size=2   |
|   0006  PUSH_SLOT n4.mw                 |
|   0009  STORE_SLOT n4.w                  |
| >*000c  DRAW_TEXT_BIND                   |  <-- current PC (highlighted row)
|         node=4 bind=props.title size=2   |
|   0013  DRAW_HLINE node=5               |
|  *0017  DRAW_TEXT_CONST                  |  <-- breakpoint (red dot)
|         node=7 "TEMP:" size=1            |
|   001e  DRAW_TEXT_BIND                   |
|         node=8 bind=sensor.temp size=1   |
|   ...                                    |
|   0053  HALT                             |
|                                          |
|  Phase: RENDER    PC: 0x000c             |
|  Step: 3 / 14     History: 3             |
+------------------------------------------+
```

**Behaviors:**
- Click a line to toggle a breakpoint (red dot marker).
- Current PC row has a yellow/accent background and `>` indicator.
- Breakpoints show `*` before the address.
- Instructions with operands show them on a second, indented line.
- Phase and step counter are pinned to the bottom of the pane.
- Scrolls to keep the current PC visible.

#### Slots Pane

Shows slot values grouped by node, with change highlighting.

```
+------------------------------------------+
| SLOTS                       [x]hide zero |
|                                          |
| Changed: n4.w: 0 -> 96                  |
|                                          |
| node   mw  mh   x   y    w   h          |
| ----  --- ---  --- ---  --- ---          |
| n4     96  16    8   8  *96  16          |  <-- *96 = just changed
| n5      0   0    8  28  260   1          |
| n7      0   0    8  33   40   8          |
| n8      0   0   50  33   40   8          |
| n9      0   0   92  33    8   8          |
| n10     0   0    8  45  260   6          |
| n12     0   0    8  55   32   8          |
| n13     0   0   42  55   32   8          |
| n14     0   0   76  55    8   8          |
| n15     0   0    8  67  260   6          |
+------------------------------------------+
```

**Behaviors:**
- When the debugger steps, changed slots flash with accent color and show the before/after in the "Changed" banner.
- "Hide zero nodes" toggle filters out nodes where all 6 fields are zero (reduces clutter for large layouts).
- When hovering a slot value, the corresponding node highlights on the canvas.
- When the current instruction references a node (e.g., `DRAW_TEXT_BIND node=4`), that node's row gets a subtle highlight.

#### Stack Pane

Shows the current stack state.

```
+---------------------------+
| STACK (2 entries)         |
|                           |
| > [1]   10   0x000a      |  <-- top of stack
|   [0]   96   0x0060      |
|                           |
| (after PUSH_CONST 10)    |  <-- context hint
+---------------------------+
```

**Behaviors:**
- Top of stack at the top, with `>` marker.
- Shows decimal and hex.
- After each step, a one-line context hint describes what happened: "(after PUSH_CONST 10)", "(after ADD: 96+10=106)", "(after STORE_SLOT n4.x: popped 106)".
- When the stack has zero entries, shows "(empty)" in dim text.

#### Canvas Pane (Debugger Mode)

The canvas becomes debugger-aware:

```
+----------------------------------------------+
|  LAB-01                                       |
|  ________________________________________     |
|  TEMP: 22   C                                 |  <-- these 3 are drawn
|  [======-------]                              |  <-- this one is drawing now
|                                               |
|                                               |  <-- HUM row not yet drawn
|                                               |
+----------------------------------------------+
| draw_ops: 4/10  |  node=10 bar sensor.temp    |
+----------------------------------------------+
```

**Behaviors:**
- Shows a mini status bar below the canvas: how many draw ops have been emitted so far, and which draw op just executed.
- Elements that have been drawn appear normally.
- The element currently being drawn (the draw op from the most recent step) gets a colored bounding box overlay.
- Elements not yet drawn remain invisible (the canvas only renders the debugger's accumulated `drawOps`).
- Clicking a drawn element on the canvas highlights the corresponding instruction in the disassembly.


### Connected Highlighting (Cross-Pane Links)

The multi-pane layout enables visual connections between views. When a user steps through execution, highlights propagate across all panes simultaneously.

**Example: Stepping to `STORE_SLOT n4.w` (stores the value 96 into n4.w)**

```
  DISASSEMBLY                    SLOTS                    STACK
  -----------                    -----                    -----
  0006  PUSH_SLOT n4.mw         n4  mw=96  ...  w=0      [0] 96
> 0009  STORE_SLOT n4.w ----->  n4  mw=96  ... *w=96     (empty)
  000c  DRAW_TEXT_BIND               ^^^^^^^^^              ^
                                     highlighted            popped
```

**Example: Stepping to `DRAW_TEXT_BIND node=4 bind=props.title`**

```
  DISASSEMBLY                    CANVAS                    SLOTS
  -----------                    ------                    -----
> 000c  DRAW_TEXT_BIND -------> [LAB-01] (bbox highlight)  n4 highlighted
        node=4                   ^^^^^^^
        bind=props.title         just appeared
```

**Example: Stepping to `ADD` (pops 96 and 10, pushes 106)**

```
  DISASSEMBLY                    STACK (before)    STACK (after)
  -----------                    --------------    -------------
  000f  PUSH_CONST 10            [1]  10           [0]  106
> 0012  ADD  ------------------>  [0]  96           (106 = 96+10)
                                  consumed          result
```


### Pane Resize Behavior

Each pane boundary is a draggable splitter:

```
+----------+-----------+--------+
|          |           |        |
|  SOURCE  |  CANVAS   | (full  |
|          |           |  width)|
|          +-----+-----+--------+
|          |DISASM|SLOTS|STACK  |
|          |     |     |       |
+----------+-----+-----+-------+
```

- **Horizontal splitter** between canvas and lower panes: drag to allocate more space to canvas or to the debugger panes.
- **Vertical splitters** between disasm/slots and slots/stack: drag to resize columns.
- All pane sizes persist in Redux (and optionally localStorage) so they survive reloads.
- Double-click a splitter to reset to default proportions.


### Redux State Changes

```typescript
// Add to inspectorSlice (or a new layoutSlice):
interface DebuggerLayout {
  canvasHeightPercent: number;     // 0.3 to 0.7, default 0.4
  disasmWidthPercent: number;      // 0.3 to 0.7, default 0.5
  slotsHeightPercent: number;      // 0.3 to 0.8, default 0.65
  hideZeroNodes: boolean;          // filter zero-only nodes in SlotsPane
  showOperandDetail: boolean;      // two-line vs one-line disasm
}
```

### Component Architecture

```
App.tsx
  <Header />
    <DebuggerControls />          // STEP, BACK, RUN, etc. (when debugger active)
  <Editor />
  {debuggerActive ? (
    <DebuggerLayout>              // new container component
      <CanvasPane />              // compact canvas with status bar
      <HorizontalSplitter />
      <LowerPanes>
        <DisassemblyPane />       // full disasm with breakpoints
        <VerticalSplitter />
        <RightColumn>
          <SlotsPane />           // slot grid
          <VerticalSplitter />
          <StackPane />           // stack display
        </RightColumn>
      </LowerPanes>
    </DebuggerLayout>
  ) : (
    <>
      <Canvas />                  // full-size canvas
      <ResizeHandle />
      <TabBar />
      <Inspector />              // tabbed inspector (normal mode)
    </>
  )}
  <StatusBar />
```


---

## Part 2: Interaction Walkthroughs

These walkthroughs show how the multi-pane debugger is used in practice.

### Walkthrough 1: "What Does MEASURE_TEXT_BIND Do?"

A developer sees `MEASURE_TEXT_BIND` in the disassembly and wants to understand what it does.

**Step 1: Load the debugger.**

The developer has the sensor_dashboard preset compiled. They click the DEBUGGER tab (or a "Debug" button in the header) and click LOAD.

```
  DISASSEMBLY                         SLOTS                  STACK
  > 0000  MEASURE_TEXT_BIND           n4  mw=0  mh=0  ...   (empty)
          node=4 bind=props.title
          size=2
```

The developer sees the first instruction. The slots pane shows n4.mw=0, n4.mh=0. The stack is empty. The canvas is blank.

**Step 2: STEP once.**

```
  DISASSEMBLY                         SLOTS                  STACK
    0000  MEASURE_TEXT_BIND           n4 *mw=96 *mh=16 ...  (empty)
  > 0006  PUSH_SLOT n4.mw
```

The slots pane now shows n4.mw=96 (highlighted) and n4.mh=16 (highlighted). The "Changed" banner says `n4.mw: 0->96, n4.mh: 0->16`. The developer learns: MEASURE_TEXT_BIND computed the text dimensions and stored them directly into the node's measurement slots. No stack involvement.

**Step 3: Hover over the value 96.**

A tooltip appears: `96 = len("LAB-01") * 8 * 2 = 6 chars * glyph_w(8) * size(2)`. The developer now understands the formula.

**Insight gained:** MEASURE_TEXT_BIND writes directly to slots (not the stack). It computes `len(text) * GLYPH_W * size` for width and `GLYPH_H * size` for height.


### Walkthrough 2: "How Does Layout Computation Work?"

A developer wants to understand how the compiler calculates x-coordinates.

**Step 1: Step to the PUSH_SLOT/ADD/STORE_SLOT sequence.**

After MEASURE_TEXT_BIND, the next instructions compute the x-position of the second label:

```
  DISASSEMBLY                    STACK              SLOTS (relevant)
  > 0006  PUSH_SLOT n4.mw       > [0] 96           n4.mw=96  n4.x=8
    0009  STORE_SLOT n4.w
    000c  DRAW_TEXT_BIND
```

The developer sees: PUSH_SLOT pushed the measured width (96) onto the stack.

**Step 2: STEP to STORE_SLOT.**

```
  DISASSEMBLY                    STACK              SLOTS
    0006  PUSH_SLOT n4.mw       (empty)             n4.mw=96 *n4.w=96
  > 0009  STORE_SLOT n4.w
    000c  DRAW_TEXT_BIND
```

The stack is now empty (the value was popped and stored). n4.w went from 0 to 96. The developer understands: STORE_SLOT pops the stack and writes to a slot.

**Insight gained:** The compiler emits PUSH_SLOT / arithmetic / STORE_SLOT sequences to compute layout values. The stack is a scratchpad for arithmetic; slots hold the final layout coordinates.


### Walkthrough 3: "Why Does My Bar Not Fill Correctly?"

A developer's progress bar shows an unexpected fill width.

**Step 1: Set a breakpoint on DRAW_BAR_BIND.**

Click the `002c` line in the disassembly. A red dot appears.

```
  DISASSEMBLY
    ...
  * 002c  DRAW_BAR_BIND          <-- breakpoint set
          node=10 bind=sensor.temp max=100
    ...
```

**Step 2: RUN. Execution stops at the breakpoint.**

```
  DISASSEMBLY                    CANVAS                   SLOTS
    ...                          LAB-01                    n10  x=8  y=45
  >*002c  DRAW_BAR_BIND         TEMP: 22   C                   w=260 h=6
          node=10                [............]
          bind=sensor.temp       ^ not yet drawn
          max=100
```

The developer sees the canvas has the text labels drawn but the bar is not yet rendered. The slots show n10.w=260, n10.h=6.

**Step 3: STEP once to execute the bar draw.**

```
  CANVAS STATUS: draw_ops: 6/10 | bar node=10 bind=sensor.temp
                 value=22 max=100 fill_w=57 (22/100 * 260 = 57px)
```

The canvas now shows the bar with fill_w=57. The developer sees the formula in the status bar and can verify: 22/100 * 260 = 57.2, truncated to 57.

**Insight gained:** The bar fill width is `trunc(w * value / max)`. The developer can now check whether `value`, `max`, and `w` are what they expect.


### Walkthrough 4: "Comparing Two Runtimes"

A developer wants to see why "High readings" produces a different layout than "Normal readings".

**Step 1: Run the debugger to completion with "Normal readings". Click VALIDATE.**

```
  ORACLE: PASS  |  slots: 96/96 match  |  draw_ops: 10/10 match
```

**Step 2: CLOSE the debugger, switch to "High readings" in the header dropdown, open the debugger again, LOAD, RUN, VALIDATE.**

```
  ORACLE: PASS  |  slots: 96/96 match  |  draw_ops: 10/10 match
```

Both pass. But the developer notices n4.w is different:
- Normal: n4.w = 96 (title "LAB-01" = 6 chars * 8 * 2 = 96)
- High: n4.w = 160 (title "REACTOR-7" = 10 chars * 8 * 2 = 160)

**Insight gained:** The layout is runtime-dependent because MEASURE_TEXT_BIND reads bound values. Different runtime data produces different slot values, which cascade through all downstream layout computations.


---

## Part 3: Interactive VM Explorer Article

Inspired by Bret Victor's "Learnable Programming" and "Up and Down the Ladder of Abstraction", this section designs a set of interactive article screens where each concept is taught through embedded, explorable components. The article is not a separate app; it is a mode within the workbench that replaces the editor+canvas area with scrollable article content containing embedded live widgets.

### Design Philosophy

From Bret Victor's principles:

1. **Make the meaning transparent.** Every abstract concept (opcode, slot, stack) should have a concrete, visible representation that the reader can poke at.
2. **Show the state.** The reader should never have to simulate the computer in their head. Every intermediate value should be visible.
3. **Enable exploration.** The reader should be able to change inputs and immediately see how outputs change. No compile-run cycle.
4. **Create a timeline.** Execution is not a single state; it is a sequence of states. The reader should be able to scrub through the timeline.

### Article Structure

The article is a vertical scroll of sections. Each section has prose paragraphs followed by an embedded interactive widget. The widgets are React components that share state via a lightweight context (not Redux, since each widget is self-contained).

```
+===========================================================================+
| GNOSIS // VM EXPLORER                                  [Back to Workbench] |
+===========================================================================+
|                                                                           |
|  # How the GNOSIS Dynamic VM Works                                        |
|                                                                           |
|  The GNOSIS dynamic VM is a stack-based virtual machine that takes a      |
|  compiled layout description and turns it into pixels on an e-ink         |
|  display. This article walks you through each concept interactively.      |
|                                                                           |
|  ## 1. The Stack Machine                                                  |
|                                                                           |
|  The VM uses a stack to compute values. Instructions push values onto     |
|  the stack, perform arithmetic, and pop results into named storage        |
|  locations called "slots."                                                |
|                                                                           |
|  Try it: edit the values below and watch the stack animate.               |
|                                                                           |
|  +---------------------------------------------------------------+       |
|  |  [EMBEDDED: Stack Calculator Widget]                           |       |
|  |                                                                |       |
|  |  Instructions:           Stack:        Result:                 |       |
|  |  PUSH_CONST [42]         [1] 42        --                     |       |
|  |  PUSH_CONST [10]         [1] 10                               |       |
|  |                          [0] 42                                |       |
|  |  [ADD]                   [0] 52        42 + 10 = 52           |       |
|  |                                                                |       |
|  |  [PLAY] [STEP] [RESET]   speed: [====o----]                   |       |
|  +---------------------------------------------------------------+       |
|                                                                           |
|  Notice how ADD popped two values and pushed one. The stack is a          |
|  last-in-first-out (LIFO) structure.                                      |
|                                                                           |
|  ## 2. Slots: The Layout Memory                                           |
|  ...                                                                      |
+===========================================================================+
```


### Screen 1: The Stack Machine

**Purpose:** Teach push/pop/arithmetic without any layout complexity.

```
+-------------------------------------------------------------------+
|  THE STACK MACHINE                                                |
|                                                                   |
|  Instructions              Stack              Explanation          |
|  +-----------------------+ +----------+  +--------------------+   |
|  | PUSH_CONST  [42]    < | | >[0] 42  |  | Pushed 42 onto     |   |
|  | PUSH_CONST  [10]      | |          |  | the stack.          |   |
|  | ADD                    | |          |  |                     |   |
|  | PUSH_CONST  [3 ]      | |          |  | Try changing 42 to  |   |
|  | MUL                    | |          |  | a different number  |   |
|  | STORE_SLOT  [n0.x]    | |          |  | and watch the       |   |
|  +-----------------------+ +----------+  | result change.       |   |
|                                          +---------------------+   |
|  [STEP ->]  [<- BACK]  [RUN ALL]  [RESET]                         |
|                                                                   |
|  Result: n0.x = ___                                               |
+-------------------------------------------------------------------+
```

**Interactive behaviors:**
- The constant values in the instruction list are **editable input fields**. Changing `42` to `100` immediately recalculates the final result.
- STEP advances one instruction. The current instruction highlights. The stack animates: values slide in from the left, arithmetic shows the computation inline.
- The result slot at the bottom shows what value ends up in n0.x.
- The user can try different arithmetic: change ADD to SUB, add more instructions.

**Embedded component:** `<StackCalculatorWidget instructions={[...]} />`


### Screen 2: Slots and the Node Grid

**Purpose:** Teach that each node has 6 slots (mw, mh, x, y, w, h) and how instructions read/write them.

```
+-------------------------------------------------------------------+
|  SLOTS: THE LAYOUT MEMORY                                          |
|                                                                   |
|  Each node in the layout tree has 6 slots:                         |
|                                                                   |
|  +---+---+---+---+---+---+                                        |
|  | mw| mh|  x|  y|  w|  h|  <-- measured width, measured height, |
|  +---+---+---+---+---+---+      x position, y position,          |
|  | 96| 16|  8|  8| 96| 16|      final width, final height        |
|  +---+---+---+---+---+---+                                        |
|    ^                   ^                                           |
|    |                   |                                           |
|    from MEASURE        from STORE_SLOT                             |
|                                                                   |
|  +-------------------------------+  +-------------------------+   |
|  | Program:                      |  | Slot Grid:              |   |
|  |                               |  |                         |   |
|  | MEASURE_TEXT_BIND             |  | node  mw  mh   x  y    |   |
|  |   node=[0] bind=[title]      |  | n0   [96][16] [ 8][ 8] |   |
|  |   size=[2]                   |  |                  w   h  |   |
|  | PUSH_SLOT n0.mw              |  | n0            [96][16] |   |
|  | STORE_SLOT n0.w              |  |                         |   |
|  |                               |  | (click a slot to see   |   |
|  | [STEP] [BACK] [RUN] [RESET]  |  |  which instruction      |   |
|  +-------------------------------+  |  wrote it)              |   |
|                                     +-------------------------+   |
|                                                                   |
|  Runtime data: title = [LAB-01____]                                |
|                                                                   |
|  Change the title above and watch how mw changes.                  |
+-------------------------------------------------------------------+
```

**Interactive behaviors:**
- The runtime value ("LAB-01") is an **editable text field**. Changing it to "HI" makes mw go from 96 to 32 (2 chars * 8 * 2). The slot grid updates live.
- The `size` field is editable (1, 2, 3). Changing size scales mw and mh.
- Clicking a slot cell in the grid highlights the instruction that wrote it and draws an arrow.
- The program auto-executes on any edit (no compile needed; the widget has its own mini-interpreter).


### Screen 3: From Slots to Pixels

**Purpose:** Show how DRAW instructions read slot values to position elements on the canvas.

```
+-------------------------------------------------------------------+
|  FROM SLOTS TO PIXELS                                              |
|                                                                   |
|  Draw instructions read x, y, w, h from the node's slots          |
|  and render to the canvas at those coordinates.                    |
|                                                                   |
|  +----------------------------+  +----------------------------+   |
|  | Slots for node 4:          |  | Canvas (live):             |   |
|  |                            |  |                            |   |
|  |  x = [ 8]  y = [ 8]       |  |    LAB-01                  |   |
|  |  w = [96]  h = [16]       |  |    ^                       |   |
|  |                            |  |    +-- drawn at (8,8)      |   |
|  | text = "LAB-01"            |  |        size 96x16          |   |
|  | size = [2]  color = [fg]   |  |                            |   |
|  |                            |  |    [bounding box shown]    |   |
|  +----------------------------+  +----------------------------+   |
|                                                                   |
|  Drag the x and y sliders to move the text on the canvas:          |
|                                                                   |
|  x: [====o-----------] 8          y: [====o-----------] 8          |
|  w: [=================o--] 96     h: [==========o-----] 16        |
|                                                                   |
|  The text is rendered using a bitmap font where each character     |
|  is 8px wide (GLYPH_W) and 8px tall (GLYPH_H), scaled by size.   |
+-------------------------------------------------------------------+
```

**Interactive behaviors:**
- **Draggable sliders** for x, y, w, h. Moving x slides the text on the canvas in real time.
- The canvas shows a bounding box around the element, with coordinate labels.
- A color picker lets the user switch between the 5 palette colors (bg, fg, mid, light, ghost).
- The text field is editable; changing it updates the canvas immediately.
- The bounding box resizes as w and h change, and text clips to the box.


### Screen 4: The Full Pipeline (Measure, Compute, Render)

**Purpose:** Show the three execution phases and how they connect.

```
+-------------------------------------------------------------------+
|  THE FULL PIPELINE                                                 |
|                                                                   |
|  Execution has three phases. Drag the timeline to see each one.    |
|                                                                   |
|  [MEASURE]----[COMPUTE]----[RENDER]----[DONE]                      |
|      ^                                                             |
|      |--- you are here                                             |
|                                                                   |
|  +---------------------+---------------------+-------------------+ |
|  | Phase: MEASURE      | Slots:              | Canvas:           | |
|  |                     |                     |                   | |
|  | MEASURE_TEXT_BIND   | n4.mw = 96          | (blank)           | |
|  |   -> reads "LAB-01" | n4.mh = 16          |                   | |
|  |   -> 6*8*2 = 96    |                     |                   | |
|  |                     | (only mw/mh change  |                   | |
|  |                     |  during MEASURE)    |                   | |
|  +---------------------+---------------------+-------------------+ |
|                                                                   |
|  Drag the phase marker to [COMPUTE] to see layout calculations,    |
|  or to [RENDER] to see drawing operations.                         |
|                                                                   |
|  +---------------------+---------------------+-------------------+ |
|  | Phase: RENDER       | Slots:              | Canvas:           | |
|  |                     |                     |                   | |
|  | DRAW_TEXT_BIND      | n4.x=8 n4.y=8      | LAB-01            | |
|  |   -> reads n4 slots | n4.w=96 n4.h=16    | __________        | |
|  |   -> renders text   |                     | TEMP: 22 C       | |
|  |                     |                     | [====----]        | |
|  | DRAW_BAR_BIND       | n10.x=8 n10.y=45   | HUM: 45 %        | |
|  |   -> 22/100*260=57  | n10.w=260 n10.h=6  | [========---]     | |
|  +---------------------+---------------------+-------------------+ |
+-------------------------------------------------------------------+
```

**Interactive behaviors:**
- A **phase timeline scrubber** at the top. Dragging it moves through MEASURE/COMPUTE/RENDER/DONE.
- At each phase, the left panel shows which instructions belong to that phase, the middle panel shows which slots changed, and the right panel shows the canvas state at the end of that phase.
- The user can also scrub instruction-by-instruction within each phase.
- Animations show values flowing: from the runtime data into slots (MEASURE), from slots through the stack into other slots (COMPUTE), from slots onto the canvas (RENDER).


### Screen 5: The Binary Format

**Purpose:** Demystify the bytecode encoding.

```
+-------------------------------------------------------------------+
|  THE BINARY FORMAT                                                 |
|                                                                   |
|  The compiled program is a binary blob. Hover over any byte to     |
|  see what it means.                                                |
|                                                                   |
|  +---------------------------------------------------------------+|
|  | 47 4e 44 59 01 00 10 00 60 00 03 00 04 00 00 00 54           ||
|  | ^-MAGIC--^  ^v ^nodes  ^slots ^binds ^strs ^--code len--^    ||
|  |             |                                                  ||
|  |             version=1                                          ||
|  |                                                                ||
|  | [bind table]                                                   ||
|  | 00 0b 70 72 6f 70 73 2e 74 69 74 6c 65               ...     ||
|  |  ^len  ^-- "props.title" (UTF-8) --^                          ||
|  |                                                                ||
|  | [string pool]                                                  ||
|  | 00 05 54 45 4d 50 3a                                          ||
|  |  ^len  ^-- "TEMP:" (UTF-8) --^                                ||
|  |                                                                ||
|  | [slot init] [code section]                                     ||
|  | ...         01 00 04 00 00 02 ...                              ||
|  |             ^MEASURE_TEXT_BIND node=4 bind=0 size=2            ||
|  +---------------------------------------------------------------+|
|                                                                   |
|  Total: [182] bytes  |  Code: [84] bytes  |  Data: [98] bytes     |
+-------------------------------------------------------------------+
```

**Interactive behaviors:**
- **Hover any byte** to see a tooltip explaining what it represents (opcode name, operand value, string content, etc.).
- **Click a byte range** to highlight the corresponding instruction in a mini-disassembly below.
- The hex view and the disassembly view are **linked**: clicking an instruction in the disassembly highlights its bytes in the hex view.
- A **"decode" animation** can be triggered that shows bytes being consumed from left to right, building up the instruction stream.


### Screen 6: Runtime Binding (The Dynamic Part)

**Purpose:** Show how the same compiled bytecode produces different output with different runtime data.

```
+-------------------------------------------------------------------+
|  RUNTIME BINDING                                                   |
|                                                                   |
|  The same compiled program adapts to different data at runtime.    |
|  The program never changes -- only the runtime values do.          |
|                                                                   |
|  +-----------------------------+  +-----------------------------+ |
|  | Runtime A: "Normal"         |  | Runtime B: "Emergency"      | |
|  |                             |  |                             | |
|  | title: [LAB-01____]        |  | title: [REACTOR-7_]        | |
|  | temp:  [==o--------] 22    |  | temp:  [=========o] 95     | |
|  | humidity: [====o---] 45    |  | humidity: [=======o] 88    | |
|  +-----------------------------+  +-----------------------------+ |
|                                                                   |
|  +-----------------------------+  +-----------------------------+ |
|  | Canvas A:                   |  | Canvas B:                   | |
|  |                             |  |                             | |
|  | LAB-01                      |  | REACTOR-7                   | |
|  | _________________________   |  | _________________________   | |
|  | TEMP: 22   C                |  | TEMP: 95   C                | |
|  | [=====----------]          |  | [====================-]    | |
|  | HUM:  45   %                |  | HUM:  88   %                | |
|  | [===========------]        |  | [==================---]    | |
|  +-----------------------------+  +-----------------------------+ |
|                                                                   |
|  Drag the temperature slider on either side and watch only that    |
|  canvas update. The bytecode is identical -- only the runtime      |
|  values differ.                                                    |
|                                                                   |
|  Bytecode: [84 bytes, identical for both]                          |
|  Slot diff: [12 slots differ] [show diff]                          |
+-------------------------------------------------------------------+
```

**Interactive behaviors:**
- Two side-by-side runtime panels with **editable sliders** for numeric values and **text fields** for string values.
- Both canvases render from the **same compiled bytecode** but with different runtime data.
- Changes to one runtime update only that canvas (showing the program is not recompiled).
- A "show diff" button highlights which slots differ between the two evaluations.
- A "swap" button exchanges the two runtime datasets.


### Screen 7: Building a Layout from Scratch

**Purpose:** Let the reader build a layout interactively and see the compilation pipeline in real time.

```
+-------------------------------------------------------------------+
|  BUILD A LAYOUT                                                    |
|                                                                   |
|  Drag elements onto the canvas to build a layout. Watch the        |
|  compiler emit bytecode in real time.                              |
|                                                                   |
|  +----------+  +-----------------------------------------+        |
|  | Palette: |  | Canvas:                                  |        |
|  |          |  |                                          |        |
|  | [Label]  |  |   Hello World                            |        |
|  | [Bar]    |  |   [=======--------]                     |        |
|  | [HLine]  |  |                                          |        |
|  | [VLine]  |  |                                          |        |
|  | [HBox]   |  |                                          |        |
|  | [VBox]   |  +-----------------------------------------+        |
|  +----------+                                                      |
|                                                                   |
|  +------------------------------+  +----------------------------+ |
|  | Generated YAML:              |  | Compiled Bytecode:         | |
|  |                              |  |                            | |
|  | type: screen                 |  | 0000 MEASURE_TEXT_BIND     | |
|  | width: 280                   |  |      node=1 bind=0 sz=1   | |
|  | height: 120                  |  | 0006 PUSH_SLOT n1.mw      | |
|  | body:                        |  | 0009 STORE_SLOT n1.w      | |
|  |   type: fixed               |  | 000c DRAW_TEXT_CONST       | |
|  |   children:                  |  |      node=1 "Hello World" | |
|  |     - type: label            |  | 0013 DRAW_BAR_CONST       | |
|  |       text: "Hello World"   |  |      node=2 val=70 max=100| |
|  |       x: 8                  |  | 001c HALT                  | |
|  |       y: 8                  |  |                            | |
|  |     - type: bar              |  | Total: 29 bytes            | |
|  |       x: 8                  |  +----------------------------+ |
|  |       y: 24                 |                                  |
|  |       w: 200                |                                  |
|  |       h: 6                  |                                  |
|  |       value: 70             |                                  |
|  |       max: 100              |                                  |
|  +------------------------------+                                  |
+-------------------------------------------------------------------+
```

**Interactive behaviors:**
- **Drag and drop** elements from the palette onto the canvas.
- Dropped elements can be **moved** (updates x, y in the YAML) and **resized** (updates w, h).
- The YAML source updates live as elements are placed.
- The bytecode listing updates live (compiled on every change via the backend API).
- Double-click an element on the canvas to edit its properties (text, bind, size, color).
- The developer sees the direct relationship: visual element -> YAML description -> bytecode instructions.


---

## Part 4: Implementation Plan

### Phase 1: Multi-Pane Debugger Layout (Core)

1. Create `<DebuggerLayout>` container component with CSS grid sub-layout.
2. Extract `<CanvasPane>` from `<Canvas>` with mini status bar.
3. Extract `<DisassemblyPane>` from the current DebuggerPanel's inline disassembly.
4. Adapt `<SlotsPane>` from the current SlotsPanel with "hide zero nodes" toggle.
5. Adapt `<StackPane>` from the current StackPanel with context hints.
6. Move step controls to `<Header>` (conditional on debugger active).
7. Add `<SplitterH>` and `<SplitterV>` components for resizable panes.
8. Toggle between normal mode and debugger mode in App.tsx.

### Phase 2: Connected Highlighting

1. Add `highlightedNode` state to debuggerSlice (set from current instruction's node operand).
2. Canvas pane draws bounding box overlay on the highlighted node.
3. Slots pane highlights the row for the highlighted node.
4. Disassembly pane shows which slots are referenced by the current instruction.
5. Canvas click -> set highlightedNode -> highlight corresponding instruction.

### Phase 3: Interactive Article System

1. Create `<VMExplorer>` route/mode component.
2. Build reusable widget components:
   - `<StackCalculatorWidget>` -- editable instruction list with animated stack.
   - `<SlotGridWidget>` -- interactive slot grid with editable runtime values.
   - `<CanvasPreviewWidget>` -- mini canvas with draggable coordinate sliders.
   - `<PipelineWidget>` -- phase scrubber with three-column view.
   - `<HexViewerWidget>` -- interactive hex dump with instruction linking.
   - `<DualRuntimeWidget>` -- side-by-side runtime comparison.
   - `<LayoutBuilderWidget>` -- drag-and-drop layout builder.
3. Write article prose and assemble screens.
4. Add "VM Explorer" button to header that switches modes.

### Phase 4: Polish

1. Persist pane sizes to localStorage.
2. Keyboard shortcuts: N=step, B=back, R=run, space=step, Esc=close debugger.
3. Tooltips on slot values showing the computation formula.
4. Animation for stack push/pop (slide in/out).
5. Print/export article screens as static PDF for offline reading.


---

## Design Decisions

### Why multi-pane instead of floating windows?

Floating/dockable windows (like Chrome DevTools) add significant complexity (z-order, overlap, minimize/maximize, position persistence) for marginal benefit. The fixed 3-pane layout covers the most common debugging workflow (see code, see data, see output) without configuration overhead. Power users can resize panes to emphasize what they care about.

### Why module-level debugger singleton instead of React context?

The GNDYDebugger instance is mutable and not serializable. Putting it in React context would cause unnecessary re-renders. The module-level singleton is invisible to React; only the serializable DebugSnapshot flows through Redux. The multi-pane layout reinforces this: all panes read from `state.debugger.snapshot` (Redux), never from the debugger instance directly.

### Why a separate article mode instead of inline help?

Inline tooltips and contextual help are useful for experts who need a quick reminder. But teaching the VM from scratch requires a narrative structure with progressive disclosure. An article mode provides that narrative while reusing the same widget components that power the debugger. The widgets are the same code; the article just arranges them with prose.

### Why not port the compiler to the browser?

The interactive article widgets that need compilation (Screen 7) call the backend API. This keeps the browser code simple and ensures compilation results are always identical to the authoritative Python compiler. The latency of a local API call (~10ms) is invisible for interactive editing.

---

## Alternatives Considered

### Alternative 1: Tabbed sub-panels within a larger inspector

Keep the tab-switching model but make the inspector take 60% of the screen. Rejected because the fundamental problem (only seeing one view at a time) remains.

### Alternative 2: Floating/dockable panels

Allow panels to be dragged, floated, and docked like VS Code or Chrome DevTools. Rejected because the implementation cost is high and the GNOSIS debugger has a small, fixed set of panels that benefit more from a predictable layout than from infinite configurability.

### Alternative 3: Integrated article within the debugger

Instead of a separate article mode, embed explanatory tooltips and guided tours into the debugger itself. Rejected because guided tours require linear progression (step 1, step 2...) while the debugger is inherently non-linear. The article provides the linear narrative; the debugger provides the freeform exploration.

---

## Open Questions

1. **Should the article mode use the same URL/route as the workbench, or a separate route?** A separate route (`/explorer`) is cleaner but requires routing infrastructure. A mode toggle in the header is simpler but shares URL state.

2. **Should the interactive article widgets use the same GNDYDebugger class or a lighter-weight interpreter?** The full debugger has history and breakpoints that the article widgets do not need. A lighter `evaluate()` call may be more appropriate for stateless widgets.

3. **Should the layout builder (Screen 7) compile in the browser or via the backend?** Browser-side would require porting the compiler. Backend-side adds a network round-trip but keeps the compiler authoritative.

4. **How should keyboard focus work in multi-pane mode?** When the user presses N (step), which pane receives focus? The header controls are always visible, so keyboard shortcuts should be global, not pane-scoped.

---

## References

- Bret Victor, "Learnable Programming" (2012) -- http://worrydream.com/LearnableProgramming/
- Bret Victor, "Up and Down the Ladder of Abstraction" (2011) -- http://worrydream.com/LadderOfAbstraction/
- Nicky Case, "Explorable Explanations" -- https://explorabl.es/
- GNOSIS-005 Design Doc 01: React Dynamic VM Debugger Analysis
- Python VM source: `gnosis_dynamic_vm/gnosis_dynamic/vm.py`
- Current debugger implementation: `web/src/engine/gndy/debugger.ts`
