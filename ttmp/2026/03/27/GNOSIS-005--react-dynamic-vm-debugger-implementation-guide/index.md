---
Title: React Dynamic VM Debugger Implementation Guide
Ticket: GNOSIS-005
Status: active
Topics:
    - compiler
    - dynamic-vm
    - webui
    - react
    - redux
    - debugger
DocType: index
Intent: long-term
Owners: []
RelatedFiles:
    - Path: web/src/store/slices/dynamicSlice.ts
      Note: Current dynamic-mode state that the debugger work extends
    - Path: web/src/components/Canvas/Canvas.tsx
      Note: Static-only canvas path identified as the main rendering gap
    - Path: web_server.py
      Note: Current dynamic compile endpoint and response contract
    - Path: gnosis_dynamic_vm/gnosis_dynamic/vm.py
      Note: Reference semantics for the browser debugger
ExternalSources: []
Summary: Intern-facing ticket package for building the React dynamic VM debugger in the GNOSIS workbench
LastUpdated: 2026-03-27T18:05:00-04:00
WhatFor: Capture the design and implementation plan for the React debugger work
WhenToUse: Use when onboarding an engineer to build or review the dynamic VM debugger in the React workbench
---

# React Dynamic VM Debugger Implementation Guide

## Overview

This ticket packages the React dynamic VM debugger as its own implementation effort. The main deliverable is a detailed design and implementation guide for a new intern, covering system background, current-state evidence, the proposed browser debugger architecture, ASCII screen designs, Redux state/actions, pseudocode, and a phased file-level implementation plan.

## Key Links

- **Primary Design Doc**: `design-doc/01-react-dynamic-vm-debugger-analysis-design-and-implementation-guide.md`
- **Diary**: `reference/01-investigation-diary.md`
- **Reading Guide**: `reference/02-vm-microcode-and-fpga-reading-guide.md`
- **Vector VM Experiment**: `reference/04-experiment-verilog-gnosis-vm-for-vector-graphics-control.md`

## Status

Current status: **active**

Current state:

- Ticket workspace created
- Static compiler and static workbench paths removed from the active codebase
- Backend and React app simplified to dynamic-only compile and inspection flow
- Design plan rewritten to assume the new dynamic-only baseline
- Diary written
- VM, microcode, and FPGA reading guide added for intern onboarding
- Verilog vector-controller VM experiment note added
- Validation and reMarkable delivery completed for the initial ticket package

## Topics

- compiler
- dynamic-vm
- webui
- react
- redux
- debugger

## Tasks

See [tasks.md](./tasks.md) for the current task list.

## Changelog

See [changelog.md](./changelog.md) for recent changes and decisions.

## Structure

- design/ - Architecture and design documents
- reference/ - Investigation notes and delivery diary
- playbooks/ - Future validation and rollout procedures
- scripts/ - Temporary tooling if implementation work is added later
- various/ - Working notes and scratch analysis
- archive/ - Deprecated or reference-only artifacts
