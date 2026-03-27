---
Title: React Modular Frontend Migration with Redux/RTK-Query
Ticket: GNOSIS-004
Status: active
Topics:
    - compiler
    - webui
    - react
    - frontend
DocType: index
Intent: long-term
Owners: []
RelatedFiles:
    - Path: docs/architecture-guide.md
      Note: System architecture overview for orientation
    - Path: source/gnosis-compiler.jsx
      Note: Reference React bytecode executor and compiler class
    - Path: source/gnosis-engine.jsx
      Note: Reference React rendering engine with bitmap font and layout
    - Path: web/index.html
      Note: Single-file vanilla frontend to be decomposed into React components
    - Path: web_server.py
      Note: Flask backend — API endpoints unchanged
ExternalSources: []
Summary: Migrate the GNOSIS Compiler Workbench from a 620-line single-file vanilla HTML/JS/CSS app into a modular, themeable React 18 application with Redux Toolkit / RTK Query state management, Vite build pipeline, and Storybook. Prepares the frontend architecture to absorb GNOSIS-003 dynamic VM debug UI.
LastUpdated: 2026-03-27T14:53:21.251440974-04:00
WhatFor: ""
WhenToUse: ""
---







# React Modular Frontend Migration with Redux/RTK-Query

## Overview

Migrate the GNOSIS Compiler Workbench frontend from a single-file vanilla HTML/JS/CSS application (`web/index.html`, ~620 lines) into a modular React 18 application with:

- **React 18 + TypeScript** for component architecture
- **Redux Toolkit + RTK Query** for state management and API layer
- **Vite** for build tooling and dev server (proxied to Flask)
- **CSS custom properties + `data-part` selectors** for theming
- **Storybook** for component development and visual testing

This creates the extensible component architecture required by GNOSIS-003's dynamic VM debug UI (8+ new panels, browser VM interpreter, step debugger, comparison views).

## Key Documents

- **Design Doc**: `design-doc/01-react-modular-frontend-migration-implementation-analysis.md` — full component architecture, Redux store design, theming strategy, and 7-phase migration plan
- **Diary**: `reference/01-implementation-diary.md` — chronological work log

## Key Links

- **GNOSIS-003**: Dynamic VM Debug UI UX Handoff Package (the UX this architecture must support)
- **GNOSIS-002**: Dynamic VM Integration (backend API contracts)
- **GNOSIS-001**: Original compiler web UI experimentation

## Status

Current status: **active** — analysis complete, implementation not started.

## Migration Phases

1. **Scaffold and Build Pipeline** — Vite + React + TypeScript + Flask proxy
2. **Extract Engine Code** — bytecode executor, bitmap font, overlays to pure TS modules
3. **Redux Store and RTK Query** — 4 slices + API layer
4. **Shell Components** — Header, Editor, Canvas with theme tokens
5. **Inspector Panels** — 7 panels as React components with Storybook stories
6. **Integration Testing and Cutover** — regression test, swap to React build
7. **GNOSIS-003 Extension Points** — mode switch, panel registry, dynamic slice stubs

## Tasks

See [tasks.md](./tasks.md) for the current task list.

## Changelog

See [changelog.md](./changelog.md) for recent changes and decisions.

## Structure

- design/ - Architecture and design documents
- reference/ - Prompt packs, API contracts, context summaries
- playbooks/ - Command sequences and test procedures
- scripts/ - Temporary code and tooling
- various/ - Working notes and research
- archive/ - Deprecated or reference-only artifacts
