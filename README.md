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

- `game/content/atomic-adventures.sqlite` — Canonical story and outdoor-world content with revision history
- `game/content/story/` — Story YAML import/export snapshots
- `game/content/world/` — Outdoor interchange YAML and canonical interior map data
- `game/server/` — Local content API, SQLite repository, migrations, and authoring server
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

`npm run dev:game` requires Node.js 22.19 or newer and starts both the game and
the local authoring API on one server:

- Game: [http://127.0.0.1:5173/](http://127.0.0.1:5173/)
- Story builder: [http://127.0.0.1:5173/builder/story](http://127.0.0.1:5173/builder/story)
- World builder: [http://127.0.0.1:5173/builder/world](http://127.0.0.1:5173/builder/world)

## Story Authoring

The SQLite database at `game/content/atomic-adventures.sqlite` is the canonical
story source. The builder lets authors select a hex, room, exterior location, or
event; edit its story beats; and save a validated revision. Open game windows
receive saved changes immediately without losing player state.

Each successful save writes directly to the tracked SQLite file, so `git status`
shows content edits immediately and committing that file carries them to remote
installations.

YAML remains available for interchange and review:

```bash
npm run content:export -w game -- part-i /tmp/part-i.yaml
npm run content:import -w game -- path/to/story.yaml
npm run content:import -w game -- path/to/story.yaml --replace
```

Direct edits to `game/content/story/*.yaml` do not change the running game until
they are explicitly imported.

## World Authoring

Outdoor world content is canonical in SQLite and is edited at
`/builder/world`. The canvas supports zooming and panning while editing hexes,
routes, barriers, passages, landmarks, and stand points. Saves create immutable
world revisions and update open game windows without a page reload.

`game/content/world/map.yaml` is retained for deterministic interchange:

```bash
npm run world:export -w game -- outdoor-main /tmp/map.yaml
npm run world:import -w game -- /tmp/map.yaml --replace
```

Direct edits to `map.yaml` do not affect the running game until imported. Indoor
building geometry remains YAML-backed for now. See
[docs/design/world-authoring.md](docs/design/world-authoring.md).

## Deployment

The playable game is deployed to Vercel through GitHub. Production is a
read-only static build: the committed SQLite database is exported to runtime
JSON during the Vercel build, while the local Story and World builders remain
development-only.

See [docs/deployment.md](docs/deployment.md) for Vercel project settings,
content promotion, smoke tests, and rollback procedures.

Run `npm run deploy:check` before promoting a production deployment.

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
