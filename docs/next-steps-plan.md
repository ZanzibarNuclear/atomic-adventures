# Next Steps Plan

High-level plan for closing design gaps and moving toward implementation.

## Status Key

- [ ] Not started
- [~] In progress
- [x] Complete

---

## 1. Flesh Out the Story

The narrative is the biggest gap and unblocks the most downstream work (story drives simulation requirements, which drive puzzle/gate design).

- [x] Define protagonist, world setting, and tone/voice — protagonist: [Zanzibar Nuhero](../design/content/story/characters.md); setting/tone: [World & Style Guide](../design/content/story/world-and-style.md)
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

- [ ] Scaffold Vue 3 project (see Step 6 for stack details)
- [ ] Implement hydro simulation model (P = η ρ g Q H)
- [ ] Build minimal UI for Part I hydro startup (intake flow, turbine, generator sync)
- [ ] Wire in story gates (simulation success unlocks next beat)
- [ ] Playtest and iterate

## 4. Calibrate Simulations with Real Data

All simulation specs have TBD calibration data. Start with Hydro, then expand.

- [ ] Hydro — source real diversion plant parameters (head, flow, capacity)
- [ ] PV — pull reference data (NREL PVWatts or similar)
- [ ] AP-1000 — reference NRC Design Control Document values
- [ ] Gen IV (SFR) — source available design parameters
- [ ] Fusion — reference ITER parameters

## 5. Define Art Direction

Can proceed in parallel with story and code work.

- [ ] Establish visual style guide (tone, palette, references)
- [ ] Create or commission concept art for key scenes
- [ ] Define UI/UX style for simulation interfaces

## 6. Tech Stack & Scaffold — DECIDED

**Decision: Bespoke web-native CYOA engine built with Vue 3.**

Rationale: The sibling projects (crazy-converter = Nuxt 3, isotope-explorer = Vue 3 + Rust/WASM) are web apps. A web-native adventure frame lets them embed directly as components or micro-frontends — no impedance mismatch. Ren'Py, Twine, and Unity were evaluated and rejected because they all require awkward bridging to host interactive web-based simulations.

### Architecture

```
┌─────────────────────────────────────────────┐
│            Atomic Adventures (Vue 3)         │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  Story Engine                          │  │
│  │  - Passage graph (JSON/YAML data)      │  │
│  │  - Choice/branch logic                 │  │
│  │  - State management (flags, inventory) │  │
│  │  - Save/load                           │  │
│  │  - Simulation gates (pass/fail checks) │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  │
│  │  Hydro   │  │  PV Sim   │  │ Nuclear  │  │
│  │  Sim     │  │           │  │ Sims     │  │
│  │ (built-in│  │ (built-in │  │(built-in │  │
│  │  Vue)    │  │  Vue)     │  │ Vue)     │  │
│  └──────────┘  └───────────┘  └──────────┘  │
│                                              │
│  ┌─────────────────┐  ┌──────────────────┐   │
│  │ crazy-converter  │  │ isotope-explorer │   │
│  │ (embed/iframe)   │  │ (Vue component   │   │
│  │                  │  │  or iframe)      │   │
│  └─────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────┘
```

### Key Design Choices

| Aspect | Choice | Why |
|--------|--------|-----|
| Framework | Vue 3 (Composition API) | Matches isotope-explorer; team familiarity |
| Story data | Declarative JSON/YAML passages | Authorable without code; inspired by Twine's passage graph |
| Simulation gates | Engine checks sim outcomes before unlocking next passage | Implements the core loop directly |
| Mini-game integration | Vue components (isotope-explorer) or iframe (crazy-converter/Nuxt) | No runtime bridging needed |
| Build tool | Vite | Standard for Vue 3; fast HMR |
| State management | Vue composables (start simple) | Upgrade to Pinia if complexity warrants |

### Tasks

- [x] Decide on framework (Vue 3)
- [ ] Define story data format (passage schema, conditions, gates)
- [ ] Scaffold Vue 3 + Vite project
- [ ] Build story engine (passage renderer, choice handler, state manager)
- [ ] Implement save/load system
- [ ] Define integration contract for mini-games (events, result passing)
- [ ] Establish coding conventions

---

## Recommended Order

Steps 1 and 2 are the highest priority — story content unblocks everything else. Step 6 (story data format) should happen early since it shapes how story content is authored. Steps 4 and 5 can run in parallel. Step 3 is the first implementation milestone.

```
1. Story ──────────┐
2. Integrate Assets ├──► 3. Hydro Prototype
4. Calibrate Data ──┘        ▲
5. Art Direction ─────────────┘
6. Tech Stack ────────► feeds into 3
   (Vue 3 + bespoke CYOA engine)
```
