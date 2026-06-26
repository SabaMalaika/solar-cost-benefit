# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # dev server at http://localhost:5173 (or 5174 if taken)
npm run build      # production build → dist/
npm run preview    # serve dist/ locally
npm run lint       # oxlint
```

No test suite. No TypeScript.

## Stack

- **React 19 + Vite 8** — single-page app, no router
- **Three.js r185** — 3D rendering via `THREE.InstancedMesh` (do not refactor to individual meshes — performance critical)

## Project purpose

Interactive cost-benefit explainer for solar vs. fossil fuel energy. Three planned sections:

1. **Manufacturing footprint** — cumulative CO₂e/kWh line chart over time (solar payback curve vs. flat gas/coal lines). Data: solar embodied carbon front-loaded at 600,000 g CO₂e/kWp, yield 1,022 kWh/kWp/year; gas flat 490 g/kWh; coal flat 820 g/kWh. Carbon payback crossover ~Year 1.2.
2. **Maintenance/cost footprint** — cost vs. time graph, solar O&M ~£6,000/MW/year vs. gas ~£136k–£350k/MW/year depending on load factor used.
3. **Land walkthrough** — 3D solar field (already built, `src/components/SolarFieldMockup.jsx`).

Case study: Medebridge Solar Farm, Essex — 71 MWp, 72,560 MWh/year, 175 acres, University of Manchester CPPA.

## Architecture

Currently: `App.jsx` → `SolarFieldMockup` only. Planned structure:

```
src/
  components/
    SolarFieldMockup.jsx      ← built (Three.js 3D field)
    ManufacturingChart.jsx    ← to build (recharts or d3)
    MaintenanceCostChart.jsx  ← to build
  data/
    manufacturingData.js      ← to build (Table 1 arrays)
    maintenanceCostData.js    ← to build (Table 2 arrays)
  App.jsx
```

## SolarFieldMockup internals

- `THREE.InstancedMesh` renders up to ~90,000 panel instances — keep this pattern
- Custom hand-rolled orbit camera (drag/scroll) — `THREE.OrbitControls` not used
- `buildField()` rebuilds mesh on every param change; disposes old geometry/material first
- Sliders: rows (10–100), panelsPerRow (10–150), blocks (1–6), tiltDeg (10–40°)
- Scene: sky-blue background + fog, green ground plane, tree border ring, directional sun with shadows

## Visual/tonal direction

Audit-like, data-led — "here's the ledger, judge for yourself." Not a marketing page. Audience is technically literate and skeptical. Avoid generic AI-design defaults.
