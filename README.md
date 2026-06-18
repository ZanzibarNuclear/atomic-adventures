# Atomic Adventures

**Atomic Ambitions** — An immersive, reality-based fantasy adventure game where players explore electricity production technologies through story, simulation, and discovery.

## Vision

A highly immersive, detailed educational adventure that blends:

- **Reality-based fantasy** — Grounded in real physics and engineering
- **Technology exploration** — Hydro, photovoltaic, and nuclear power
- **Learning through play** — Story requires understanding to advance
- **Informative simulations** — Physics and engineering that are both accurate and fun

## Project Status

**Phase:** Early implementation — Part I vertical slice

This repository contains the playable game, a standalone map prototype, and the design and planning documents that guide their development.

## Project Structure

This monorepo contains two independent Vue 3 + Vite applications:

```text
atomic-adventures/
├── design/     # Narrative, learning, art, and simulation design
├── docs/       # Technical designs and implementation roadmaps
├── game/       # Playable vertical slice and full game
├── samples/    # Sample map data
├── scripts/    # Repository development scripts
└── web/        # Standalone map prototype and builder sandbox
```

Gameplay, narrative, persistence, and player-facing map changes belong in `game/`. Its main areas are:

- `game/content/story/` — YAML story passages and triggers
- `game/content/world/` — YAML world and interior map data
- `game/src/components/` — Story overlay and application UI
- `game/src/composables/` — Game state, story, and save/load logic
- `game/src/lib/maps/` — Outdoor and indoor map engine, HUD, and builder tools

The `web/` app is an independent prototype for experimenting with map concepts and authoring tools. Map code may be prototyped there, but features intended for the playable game must be implemented or ported into `game/`.

Run either app from the repository root:

```bash
npm run dev:game       # Playable game
npm run dev:prototype  # Map prototype
npm run test           # Game test suite
npm run test:movement  # Exercises comprehensive hex-crawling
```

## Quick Links

- [Game Design Overview](design/game-design-overview.md) — Core vision, pillars, and scope
- [Story & Narrative](design/content/story/story-overview.md) — Beginning storyline and narrative design
- [Simulation Specifications](design/content/subject-matter/simulation-overview.md) — Physics and engineering simulation designs

## Technologies in Scope

| Category             | Technologies                                           |
| -------------------- | ------------------------------------------------------ |
| **Hydro**            | Diversion / penstock, run-of-river, pumped storage     |
| **Photovoltaic**     | Solar panels, inverters, grid integration              |
| **Nuclear (Gen IV)** | Sodium-cooled fast reactor, others as they come online |
| **Fusion**           | Tokamak / magnetic confinement concepts                |

## Contributing

Design documents are living documents. Revise, expand, and iterate until the vision is clear.
