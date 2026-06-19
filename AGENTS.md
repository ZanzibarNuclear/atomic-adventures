# AGENTS.md

Project instructions for AI coding agents working in this repository.

## Project Overview

Atomic Adventures is an educational adventure game where players explore electricity production technologies through story-driven discovery and simulation. Players restore dormant energy facilities in a Myst-inspired world, learning real physics and engineering to progress.

**Current phase:** Early implementation — Part I vertical slice in progress. The repo contains game-design docs, a map prototype (`web/`), and the playable game app (`game/`).

## Repository layout: prototype vs. game

Two Vue 3 + Vite apps live in this monorepo. **Do not conflate them.**

```
atomic-adventures/
├── web/                 ← PROTOTYPE — independent app for exploring map concepts and demos
├── game/                ← ACTIVE — vertical slice and full game (all gameplay work here)
├── game-design/         — Narrative, simulation specs, learning objectives
└── docs/                — Technical contracts, deployment, roadmap
```

| App     | Purpose                                                                              | Modify when…                                                                           |
| ------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `web/`  | Standalone map tech demo — hex travel, grid interior, builder tools, hydro mechanics | Prototype experiments, stakeholder demos. No story, save/load, or game features.       |
| `game/` | Playable game, story builder, content API, save/load, and player-facing UI           | Always, for anything that affects gameplay, narrative, authoring, or persistence.      |

### Map code: two apps, one canonical game copy

Map rendering and interaction logic was **copied** (not moved) from `web/src` into **`game/src/lib/maps/`**. That location is intentional — it is the game’s map layer, separate from game-only composables in `game/src/composables/`.

- **`game/src/lib/maps/`** — hex outdoor, grid indoor, HUD, builder components. Edit here for anything the playable game needs.
- **`web/`** — parallel prototype copy. May diverge over time. Use as a reference or sandbox; re-port into `game/` when a prototype change should land in the game.
- **`game/content/world/`** — game world YAML (copied from `web/content/world/`, evolves for story triggers).

**Rule:** Never add game features (story, save/load, narrative overlay) to `web/`. Fix gameplay in `game/`, not by patching `web/`.

### Authoring and builder tools

There are distinct story, world, and prototype builder concerns. Do not conflate them.

#### Story and world builders — active

Authoring uses separate routes in the `game/` app, not modes layered onto the playable scene:

| Route      | Purpose                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| `/`        | Playable game                                                           |
| `/builder/story` | Map-first story authoring for hexes, rooms, exterior nodes, and events |
| `/builder/world` | Canvas-first outdoor geometry and movement authoring |

- `game/src/views/BuilderView.vue` owns the authoring workspace.
- `game/src/views/WorldBuilderView.vue` owns outdoor world authoring.
- `game/content/atomic-adventures.sqlite` is canonical for story and outdoor world content and stores both revision histories.
- `game/server/` provides the SQLite repository, migrations, validation, JSON API, and SSE updates.
- Saving a beat or world document publishes it immediately. Open game windows refresh content without reloading or losing player state.
- The builder is currently for trusted local use and has no authentication or role system.
- Keep builder form state separate from player state, saves, inventory, flags, and movement.
- Outdoor world content is stored as one ordered JSON document; do not normalize individual hexes, routes, or points without a demonstrated need.
- `game/content/world/map.yaml` is outdoor import/export material, not the live runtime source. Direct edits require `world:import`.
- See [docs/contracts/world-authoring.md](docs/contracts/world-authoring.md) for the persistence, reference, and live-update contract.

#### Prototype map geometry tools — separate

The production World Builder uses map-layer edit handles. The older prototype builder remains separate.

- `game/src/lib/maps/` contains the canonical game map components and reusable geometry-builder utilities.
- `web/` remains a useful prototype and sandbox for map editing ideas.
- Indoor geometry remains YAML-driven in `game/content/world/`; outdoor geometry is database-backed.
- Players must never see geometry-editing controls. Keep edit layers separate from player-facing scene wiring.
- Port useful prototype work into `game/`; do not implement game story or persistence features in `web/`.

### Movement audit

The outdoor movement audit is a **development-only diagnostic**, not player UI.

- In development, open it from **Developer → Show movement audit** in the game header.
- The overlay visualizes valid, blocked, and invalid travel outcomes for the checked-in cases in `game/src/lib/maps/testing/mapMovementCases.js`.
- The Developer menu and audit panel are gated by `import.meta.env.DEV` and must remain absent from production builds.
- When changing movement, barriers, passages, or arrival stands, update the shared audit cases and tests when necessary. Do not special-case the visual overlay separately from movement behavior.

### Running the apps

From the repo root:

```bash
npm run dev:prototype   # web/ — map prototype demo
npm run dev:game        # game + builder + local content API
```

`npm run dev:game` requires Node.js 22.19 or newer and starts one localhost server:

- Game: `http://127.0.0.1:5173/`
- Story builder: `http://127.0.0.1:5173/builder/story`
- World builder: `http://127.0.0.1:5173/builder/world`

### Tests

Gameplay and map changes live in `game/`. **Before finishing work** on travel, barriers, story integration, composables, or world YAML, run the test suite and fix failures:

```bash
npm run test            # from repo root (runs game/ vitest)
```

Run tests again after each meaningful code change in those areas — not only at the end of a large task. A pre-push hook also runs tests locally; do not rely on it as the first time you learn something broke.

When adding or changing movement, barrier, or arrival behavior, add or update a test in `game/src/lib/maps/testing/` or `game/src/composables/`. See [docs/contracts/hex-crawling.md](docs/contracts/hex-crawling.md) for the movement contract (two-step border-then-stand, in-hex `crossPassage` vs inter-hex travel).

### Production deployment

The game deploys to Vercel through GitHub. Production is static and read-only:

- `npm run build:game` exports runtime story/world JSON from the committed SQLite database before building Vite.
- Production reads `/content/story.json` and `/content/world.json`; it does not run the local Node authoring server.
- Builder routes and chunks must remain absent from production builds.
- Author content locally, commit `game/content/atomic-adventures.sqlite`, and promote it through Git.
- Neon is the planned future transactional provider, initially for player registration; it is not currently required.

See [docs/deployment.md](docs/deployment.md) before changing Vercel configuration, production content loading, or deployment scripts.

## Architecture

**Bespoke web-native CYOA engine built with Vue 3 + Vite.**

Ren'Py, Twine, and Unity were evaluated and rejected. The sibling mini-game projects are web apps (Vue 3, Nuxt 3), so a web-native adventure frame lets them embed directly.

```
game/
├── content/
│   ├── atomic-adventures.sqlite — Canonical story/outdoor-world content and revisions
│   ├── world/          — Outdoor and indoor interchange/seed YAML
│   └── story/          — Story YAML import/export snapshots
├── server/             — Unified server, content API, SQLite repository, migrations
├── src/
│   ├── composables/    — useGameState, useSaveGame, useStory (game-only)
│   ├── components/     — Story overlay, app chrome
│   ├── views/          — Playable game and story-builder routes
│   └── lib/maps/       — Map engine, HUD, diagnostics, geometry-builder utilities
```

Integration model:

```
SQLite story + outdoor world content
  → game/server JSON API + SSE
  → reactive story/world content stores
  → useStory + lib/maps

lib/maps (outdoor + indoor)
  → flags + location via useGameState (serializable)
  → useStory (location/flag-triggered beats from reactive content)
  → StoryOverlay (prose + choices)
  → useSaveGame (localStorage)
```

Future layers (not all built yet):

- Passage graph interpreter (full `go_to`, simulation gates)
- Built-in sims (hydro, PV, nuclear, fusion as Vue components)
- Mini-game embeds (isotope-explorer, crazy-converter)

## Story Data Format

Story content lives canonically in `game/content/atomic-adventures.sqlite`. Authors normally edit it at `/builder/story`. YAML is retained as an interchange and review format, not as the live runtime source.

See [docs/contracts/story-beats.md](docs/contracts/story-beats.md) for the authoritative
current runtime behavior: selection order, triggers, requirements, seen state,
revisit prose, choices, repeatable beats, live authoring, and persistence.

```bash
npm run content:export -w game -- part-i /tmp/part-i.yaml
npm run content:import -w game -- path/to/story.yaml
npm run content:import -w game -- path/to/story.yaml --replace
```

Direct edits to `game/content/story/*.yaml` do not affect the game until imported. See `game-design/content/story/story-data-format.md` for the broader planned schema. Key concepts:

- **Passages** — Text + image + choices. The atomic unit.
- **Conditions** — `require: { all: [...], not: [...], items: [...] }`
- **Flags** — Dot-scoped booleans: `hydro.read_ops_manual`
- **Simulation gates** — Passage launches sim, gates on success/failure
- **Area transitions** — `go_to: hydro:arrival` (area:passage syntax)
- **Passage IDs** — kebab-case, unique within area
- **Item IDs** — flat kebab-case

The current builder/runtime supports beat IDs and ordering, `once`, `acknowledge`, headings, prose and revisit prose, outdoor/indoor/event triggers, `require` flag conditions, ordered choices, flag effects, and movement destinations.

## Outdoor World Data

Outdoor world content is the `outdoor-main` JSON document in
`game/content/atomic-adventures.sqlite`. Authors normally edit it at
`/builder/world`.

```bash
npm run world:export -w game -- outdoor-main /tmp/map.yaml
npm run world:import -w game -- /tmp/map.yaml --replace
npm run building:export -w game -- utility-station /tmp/utility-station.yaml
npm run building:import -w game -- /tmp/utility-station.yaml --replace
```

Direct edits to `game/content/world/map.yaml` do not affect the game until
imported. Utility-station geometry is stored as the `utility-station` building
document in SQLite and edited from the Utility Station workspace in
`/builder/world`; its YAML file is seed/import material.

## Sibling Projects

These embed as mini-games within the adventure:

- **`../crazy-converter/`** — Nuxt 3 + FastAPI + Rust/PyO3. Unit conversion tool. Embeds via iframe.
- **`../isotope-explorer/`** — Vue 3 + Rust/WASM. Nuclear simulation. Embeds as Vue component.

## World & Tone

- **Setting:** Future where energy technology has been lost. Infrastructure remains, knowledge is gone.
- **Inspiration:** Myst (atmosphere, exploration) + Tintin (protagonist personality)
- **Protagonist:** Zanzibar Nuhero — see `game-design/content/story/characters.md`
- **Story structure:** Part I (surface — hydro) → Part II (surface — PV) → Part III (underground — Gen IV SMR + party reunion)
- **Core message:** Hopeful. Technology exists to help people thrive.

## Core Loop

Explore → Encounter Problem → Learn Concept → Apply in Simulation → Unlock Story → Repeat

## Level Order (Release Trilogy)

1. Hydroelectric plant — Part I (most intuitive)
2. Solar array — PV — Part II (discovered on eBuggy tour in Part I)
3. Gen IV SMR — Part III (underground; team-assisted)

Extension packs may add alternate SMR models. AP-1000 and fusion are deferred expansion content.
