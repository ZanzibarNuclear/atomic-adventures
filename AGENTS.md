# AGENTS.md

Project instructions for AI coding agents working in this repository.

## Project Overview

Atomic Adventures is an educational adventure game where players explore electricity production technologies through story-driven discovery and simulation. Players restore dormant energy facilities in a Myst-inspired world, learning real physics and engineering to progress.

**Current phase:** Early implementation — Part I vertical slice in progress. The repo contains game-design docs and the playable game app (`game/`).

## Repository layout

The playable Vue 3 + Vite app lives in `game/`.

```
atomic-adventures/
├── game/                ← ACTIVE — vertical slice and full game (all gameplay work here)
├── game-design/         — Narrative, simulation specs, learning objectives
└── docs/                — Technical contracts, quality checklists, deployment, roadmap
```

### Map code

Map rendering and interaction logic lives in **`game/src/lib/maps/`**. That location is intentional — it is the game’s map layer, separate from game-only composables in `game/src/composables/`.

- **`game/src/lib/maps/`** — hex outdoor, grid indoor, HUD, builder components. Edit here for anything the playable game needs.
- **`game/content/atomic-adventures.sqlite`** — canonical authored story, world, building, and character content.

### Authoring and builder tools

There are distinct story, world, and content builder concerns. Do not conflate them.

#### Story, world, and content builders — active

Authoring uses separate routes in the `game/` app, not modes layered onto the playable scene:

| Route              | Purpose                                                                |
| ------------------ | ---------------------------------------------------------------------- |
| `/`                | Playable game                                                          |
| `/builder/story`   | Map-first story authoring for hexes, rooms, exterior nodes, and events |
| `/builder/world`   | Canvas-first outdoor geometry and movement authoring                   |
| `/builder/content` | Character development and artifact catalog authoring                   |

- `game/src/views/BuilderView.vue` owns the authoring workspace.
- `game/src/views/WorldBuilderView.vue` owns outdoor world authoring.
- `game/src/views/CharacterBuilderView.vue` owns the Content Builder; its
  current route is `/builder/content`.
- `game/content/atomic-adventures.sqlite` is canonical for story, outdoor world, building, and character content and stores revision histories.
- `game/server/` provides the SQLite repository, migrations, validation, JSON API, and SSE updates.
- Saving a beat or world document publishes it immediately. Open game windows refresh content without reloading or losing player state.
- The builder is currently for trusted local use and has no authentication or role system.
- Keep builder form state separate from player state, saves, inventory, flags, and movement.
- Outdoor world content is stored as one ordered JSON document; do not normalize individual hexes, routes, or points without a demonstrated need.
- YAML is an explicit import/export snapshot format only. Do not add canonical content YAML under `game/content/`.
- See [docs/contracts/world-authoring.md](docs/contracts/world-authoring.md) for the persistence, reference, and live-update contract.

### Default authority hierarchy

When project artifacts disagree, use this default order of authority:

1. `game/content/atomic-adventures.sqlite`
2. Recent code changes
3. Written contracts in `docs/contracts/`
4. Tests and fixtures

Treat database content and recent code changes as intentional improvements unless the user says otherwise. Update contracts, tests, fixtures, movement cases, and hardcoded references to match current content and code.

A changed contract often requires code changes to match the contract.

Tests are meant to reveal unexpected regressions due to code changes, where a change in one area of code impacts the behavior in another. Tests are not the source of truth for authored content: IDs, story beats, map nodes, room names, or other evolving content. They are free to use such references to demonstrate correct behavior, but then these values change, the tests that use them need to adapt.

For example, if an authored ID is renamed in the database and a test still uses the old ID, update the test/reference to the new ID.

Remove or replace all "legacy" values as soon as possible. Use current values when the data changes.

#### Map geometry tools

The production World Builder uses map-layer edit handles.

- `game/src/lib/maps/` contains the canonical game map components and reusable geometry-builder utilities.
- Indoor utility-station geometry is database-backed and edited in the World
  Builder; YAML is only an explicit snapshot import/export format.
- Players must never see geometry-editing controls. Keep edit layers separate from player-facing scene wiring.

### Movement audit

The outdoor movement audit is a **development-only diagnostic**, not player UI.

- In development, open it from **Developer → Show movement audit** in the game header.
- The overlay visualizes valid, blocked, and invalid travel outcomes for the checked-in cases in `game/src/lib/maps/testing/mapMovementCases.js`.
- The Developer menu and audit panel are gated by `import.meta.env.DEV` and must remain absent from production builds.
- When changing movement, barriers, passages, or arrival stands, update the shared audit cases and tests when necessary. Do not special-case the visual overlay separately from movement behavior.

### Running the apps

From the repo root:

```bash
npm run dev:game        # game + builder + local content API
```

`npm run dev:game` requires Node.js 22.19 or newer and starts one localhost server:

- Game: `http://127.0.0.1:5173/`
- Story builder: `http://127.0.0.1:5173/builder/story`
- World builder: `http://127.0.0.1:5173/builder/world`
- Content builder: `http://127.0.0.1:5173/builder/content`

### Tests and quality checklists

Gameplay and map changes live in `game/`. **Before finishing work** on travel, barriers, story integration, composables, or world YAML, run the test suite and fix failures:

```bash
npm run test            # from repo root (runs game/ vitest)
```

Run tests again after each meaningful code change in those areas — not only at the end of a large task. A pre-push hook also runs tests locally; do not rely on it as the first time you learn something broke.

When adding or changing movement, barrier, or arrival behavior, add or update a test in `game/src/lib/maps/testing/` or `game/src/composables/`. See [docs/contracts/hex-crawling.md](docs/contracts/hex-crawling.md) for the movement contract (two-step border-then-stand, in-hex `crossPassage` vs inter-hex travel).

For character, inventory, save/load, builder, close-up-view, and simulation
integration changes, also consult
[docs/quality/character-inventory-regression-checklist.md](docs/quality/character-inventory-regression-checklist.md)
for the cross-cutting checks that should stay green.

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
│   └── atomic-adventures.sqlite — Canonical story/world/building/character content and revisions
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
- Close-up views for room detail, holo-reader lessons and videos, buggy rides,
  and simulations; see [docs/plans/close-up-views-implementation.md](docs/plans/close-up-views-implementation.md).
- Built-in sims (hydro, PV, nuclear, fusion as Vue components)
- Mini-game embeds (isotope-explorer, crazy-converter)

## Story Data Format

Story content lives canonically in `game/content/atomic-adventures.sqlite`. Authors normally edit it at `/builder/story`. YAML can be exported or imported as an explicit snapshot, but no story YAML under `game/content/` is canonical.

See [docs/contracts/story-beats.md](docs/contracts/story-beats.md) for the authoritative
current runtime behavior: selection order, triggers, requirements, seen state,
revisit prose, choices, repeatable beats, live authoring, and persistence.

```bash
npm run content:export -w game -- part-i /tmp/part-i.yaml
npm run content:import -w game -- path/to/story.yaml
npm run content:import -w game -- path/to/story.yaml --replace
```

Snapshot edits do not affect the game until imported. See `game-design/content/story/story-data-format.md` for the broader planned schema. Key concepts:

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

Snapshot edits do not affect the game until imported. Utility-station geometry is stored as the `utility-station` building
document in SQLite and edited from the Utility Station workspace in
`/builder/world`.

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
