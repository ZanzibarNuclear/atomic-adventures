# Technology Roadmap

[DRAFT] — Phasing and dependencies for design and implementation.

## Design Phase (Current)

| Milestone | Deliverables |
|-----------|--------------|
| Story complete | `story-overview.md` with full beats |
| Simulation specs | All tech specs with parameters, outputs |
| Learning map | Objectives aligned to story and simulations |
| Art direction | Style guide, concept art |
| Playable prototype | TBD — one simulation (e.g., hydro) |

## Tech Stack Decision

**Bespoke web-native CYOA engine built with Vue 3 + Vite.**

Ren'Py, Twine, and Unity were evaluated and rejected. The sibling mini-game projects (crazy-converter = Nuxt 3, isotope-explorer = Vue 3 + Rust/WASM) are web apps. A Vue 3 adventure frame lets them embed directly — no runtime bridging needed.

Key components:
- **Story engine** — Interprets a declarative passage graph (JSON/YAML) with choices, conditions, flags, and simulation gates
- **Simulation UIs** — Vue components for each technology (hydro, PV, nuclear, fusion)
- **Mini-game integration** — crazy-converter and isotope-explorer embed as components or iframes
- **State management** — Vue composables; save/load for player progress

See [Next Steps Plan](../../docs/next-steps-plan.md#6-tech-stack--scaffold--decided) for full architecture diagram.

## Implementation Phases (Future)

### Phase 1: Foundation

- Vue 3 + Vite project scaffold
- Story engine (passage renderer, choice handler, state/save-load)
- Story data format (JSON/YAML passage schema with gate conditions)
- First chapter (Hydro) — story, simulation, learning
- Integration contract for mini-games (events, result passing)

### Phase 2: Expansion

- PV chapter
- AP-1000 chapter
- Embed isotope-explorer as nuclear mini-game
- Embed crazy-converter as utility mini-game
- Improved simulation engine

### Phase 3: Advanced

- Gen IV chapter
- Fusion chapter
- Polish, accessibility, localization

### Phase 4: Living Game

- New Gen IV reactors as they come online
- Community content? Modding?
- Updates based on real-world tech news

## Dependencies

- **Story** → Drives simulation requirements
- **Learning objectives** → Drive puzzle and gate design
- **Simulation specs** → Drive implementation scope
- **Art** → Can proceed in parallel with design
- **Mini-game projects** → Must define integration contract (Phase 1) before embedding (Phase 2)

## Real-World Tech Tracking

Gen IV and fusion are evolving. Maintain a watch list:

- **Natrium (TerraPower)** — Sodium-cooled; construction timeline
- **Kairos (TerraPower)** — Molten chloride
- **X-Energy Xe-100** — HTGR
- **ITER** — Fusion; first plasma, etc.
- *Add as new designs emerge*

## Revision Notes

- *Refine phases as design solidifies*
- *Set target dates when ready*
