# Changelog

## 2026-03-27

- Initial workspace created


## 2026-03-27

Created GNOSIS-004 ticket workspace. Wrote comprehensive implementation analysis covering: component decomposition (16 data-part regions mapped from vanilla HTML to React), Redux store design (4 slices + RTK Query API layer), theming strategy (CSS custom properties + data-part selectors), 7-phase migration plan, Storybook strategy, and risk assessment. Added 7 implementation phase tasks. Related 5 key source files.

### Related Files

- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/web/index.html — Analyzed 620-line frontend for component decomposition


## 2026-03-27

Completed all 7 implementation phases. React app builds and serves via Flask. Commits: scaffold (c4ab17f), engine extraction (c5ea6a6), Redux store (14134be), shell components (ac37180), inspector panels (2b0477f), cutover (e7c3751), GNOSIS-003 extension points (35ec1a3).


## 2026-03-27

Fixed CSS token inheritance (moved from [data-widget] to :root), added auto-load first preset hook, visual regression confirmed via Playwright screenshots. Added dynamic VM backend with /api/compile-dynamic endpoint, 4 dynamic presets with runtime variants, set dynamic as default mode. DisassemblyPanel and ManifestPanel now mode-aware.

### Related Files

- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/examples/dynamic_nav.yaml — New dynamic preset
- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/gnosis_dynamic_vm/examples/sensor_dashboard.yaml — New dynamic preset
- /home/manuel/code/wesen/2026-03-22--gnosis-compiler/web_server.py — Added compile-dynamic and presets-dynamic endpoints

