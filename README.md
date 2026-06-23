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
├── game-design/  # Game design — vision, story, progression, simulation specs, art
├── docs/         # Technical docs — runtime contracts, deployment, roadmap
├── game/       # Playable vertical slice and full game
├── samples/    # Sample map data
├── scripts/    # Repository development scripts
└── web/        # Standalone map prototype and builder sandbox
```

Gameplay, narrative, persistence, and player-facing map changes belong in `game/`. Its main areas are:

- `game/content/atomic-adventures.sqlite` — Canonical story, world, building, and character content with revision history
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

YAML remains available for explicit interchange and review:

```bash
npm run content:export -w game -- part-i /tmp/part-i.yaml
npm run content:import -w game -- path/to/story.yaml
npm run content:import -w game -- path/to/story.yaml --replace
```

Snapshots are not tracked as canonical content. Export to an explicit path,
review or edit that file, then import it when you want SQLite to change.

## World Authoring

Outdoor world content is canonical in SQLite and is edited at
`/builder/world`. The canvas supports zooming and panning while editing hexes,
routes, barriers, passages, landmarks, and stand points. Saves create immutable
world revisions and update open game windows without a page reload.

YAML snapshots remain available for deterministic interchange:

```bash
npm run world:export -w game -- outdoor-main /tmp/map.yaml
npm run world:import -w game -- /tmp/map.yaml --replace
```

Indoor utility-station geometry is revisioned in SQLite and edited from the World
Builder; it can also be exported or imported as an explicit snapshot:

```bash
npm run building:export -w game -- utility-station /tmp/utility-station.yaml
npm run building:import -w game -- /tmp/utility-station.yaml --replace
```

Snapshot files are not tracked as canonical content. See
[docs/contracts/world-authoring.md](docs/contracts/world-authoring.md).

## Deployment

The playable game is deployed to Vercel through GitHub. Production is a
read-only static build: the committed SQLite database is exported to runtime
JSON during the Vercel build, while the local Story and World builders remain
development-only.

See [docs/deployment.md](docs/deployment.md) for Vercel project settings,
content promotion, smoke tests, and rollback procedures.

Run `npm run deploy:check` before promoting a production deployment.

## Documentation

Two top-level directories separate **what we are building** from **how it is implemented**:

| Directory | Audience | Contents |
| --------- | -------- | -------- |
| [`game-design/`](game-design/) | Writers, designers, educators | Vision, narrative, progression, simulation specs, art references |
| [`docs/`](docs/) | Engineers, agents, operators | Runtime contracts, deployment, technology roadmap |

Do not conflate them. Story beats and facility layout live in `game-design/`; beat selection order, hex movement rules, and the SQLite authoring API live in `docs/contracts/`.

### Game design — getting started

Read in this order when onboarding to narrative or simulation design:

1. [Game Design Overview](game-design/game-design-overview.md) — pillars, scope, core loop
2. [Story Overview](game-design/content/story/story-overview.md) — three-part structure and Part I beats
3. [Characters](game-design/content/story/characters.md) — protagonist and cast
4. [Part I Unlocks](game-design/content/part-i-unlocks.md) — hydro progression and discovery chains
5. [Progression Design](game-design/content/progression-design.md) — gates, difficulty curve, staged complexity
6. [Learning Objectives](game-design/content/learning-objectives.md) — concepts mapped to story
7. [Simulation Overview](game-design/content/subject-matter/simulation-overview.md) — per-technology sim specs ([hydro](game-design/content/subject-matter/hydro-simulation.md) is the Part I spine)
8. [Reactor & Extension Catalog](game-design/content/reactor-catalog.md) — trilogy SMR, post-game extensions, future model list

Story art and map references live under [`game-design/art/`](game-design/art/). Most design documents are marked `[DRAFT]`.

### Technical documentation

| Document | Purpose |
| -------- | ------- |
| [Technology Roadmap](docs/tech-roadmap.md) | Decisions made, Part I gaps, future Neon/player features |
| [Story Beats](docs/contracts/story-beats.md) | Beat engine runtime and builder behavior (source of truth) |
| [World Authoring](docs/contracts/world-authoring.md) | Outdoor world builder, SQLite, live updates |
| [Hex Crawling](docs/contracts/hex-crawling.md) | Outdoor movement contract |
| [Hex Viewport](docs/contracts/hex-viewport.md) | Map zoom, fog, and visibility |
| [Deployment](docs/deployment.md) | Vercel production build and content promotion |

Agent and contributor conventions: [AGENTS.md](AGENTS.md).

## Technologies in Scope (Release Trilogy)

| Part | Category | Technologies |
| ---- | -------- | ------------ |
| I | **Hydro** | Diversion / penstock, run-of-river |
| II | **Photovoltaic** | Solar panels, inverters, grid integration |
| III | **Nuclear (Gen IV SMR)** | One real-world SMR design at launch; alternates via extension packs |

Deferred: AP-1000 Gen III+, fusion, wind, geothermal.

## Contributing

Design documents are living documents. Revise, expand, and iterate until the vision is clear.
