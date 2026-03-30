# Next Steps Plan

High-level plan for closing design gaps and moving toward implementation.

## Status Key

- [ ] Not started
- [~] In progress
- [x] Complete

---

## 1. Flesh Out the Story

The narrative is the biggest gap and unblocks the most downstream work (story drives simulation requirements, which drive puzzle/gate design).

- [ ] Define protagonist, world setting, and tone/voice
- [ ] Write story beats for the Hydro chapter (Act 1)
- [ ] Write story beats for remaining chapters (PV, AP-1000, Gen IV, Fusion)
- [ ] Map story beats to learning objectives and simulation gates
- [ ] Update `design/docs/story-overview.md` and `design/docs/narrative-design.md`

## 2. Integrate Existing Assets

The story overview references existing story content and digital art that haven't been brought into the repo yet.

- [ ] Inventory existing story content and digital art
- [ ] Add assets to `design/art/` with descriptions
- [ ] Revise story docs to reference integrated assets

## 3. Build a Hydro Prototype

Hydro is the simplest chapter and the roadmap's Phase 1. A minimal playable prototype validates the core loop: Explore → Learn → Simulate → Unlock.

- [ ] Choose tech stack (Vue/React/other)
- [ ] Scaffold project structure (`src/`, `assets/`, `tests/`)
- [ ] Implement hydro simulation model (P = η ρ g Q H)
- [ ] Build minimal UI for dam builder / flow manager / turbine selector
- [ ] Wire in story gates (simulation success unlocks next beat)
- [ ] Playtest and iterate

## 4. Calibrate Simulations with Real Data

All simulation specs have TBD calibration data. Start with Hydro, then expand.

- [ ] Hydro — source real dam parameters (head, flow, capacity)
- [ ] PV — pull reference data (NREL PVWatts or similar)
- [ ] AP-1000 — reference NRC Design Control Document values
- [ ] Gen IV (SFR) — source available design parameters
- [ ] Fusion — reference ITER parameters

## 5. Define Art Direction

Can proceed in parallel with story and code work.

- [ ] Establish visual style guide (tone, palette, references)
- [ ] Create or commission concept art for key scenes
- [ ] Define UI/UX style for simulation interfaces

## 6. Choose Tech Stack & Scaffold

Prepare the codebase for implementation.

- [ ] Evaluate framework options (Vue, React, other)
- [ ] Decide on simulation engine approach (canvas, WebGL, SVG, etc.)
- [ ] Set up project scaffolding, build tools, and testing
- [ ] Establish coding conventions

---

## Recommended Order

Steps 1 and 2 are the highest priority — story content unblocks everything else. Steps 4 and 5 can run in parallel. Steps 3 and 6 begin the transition from design to implementation.

```
1. Story ──────────┐
2. Integrate Assets ├──► 3. Hydro Prototype
4. Calibrate Data ──┘        ▲
5. Art Direction ─────────────┘
6. Tech Stack ────────► feeds into 3
```
