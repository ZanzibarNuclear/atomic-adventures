# AGENTS.md

Project instructions for AI coding agents working in this repository.

## Project Overview

Atomic Adventures is an educational adventure game where players explore electricity production technologies through story-driven discovery and simulation. Players restore dormant energy facilities in a Myst-inspired world, learning real physics and engineering to progress.

**Current phase:** Early implementation — Part I vertical slice in progress. The repo contains design docs, a map prototype (`web/`), and the playable game app (`game/`).

## Repository layout: prototype vs. game

Two Vue 3 + Vite apps live in this monorepo. **Do not conflate them.**

```
atomic-adventures/
├── web/                 ← PROTOTYPE — independent app for exploring map concepts and demos
├── game/                ← ACTIVE — vertical slice and full game (all gameplay work here)
├── design/              — Narrative, simulation specs, learning objectives
└── docs/                — Roadmaps and implementation plans
```

| App     | Purpose                                                                              | Modify when…                                                                           |
| ------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `web/`  | Standalone map tech demo — hex travel, grid interior, builder tools, hydro mechanics | Prototype experiments, stakeholder demos. No story, save/load, or game features.       |
| `game/` | Playable game — story engine, save/load, player-facing UI                            | Always, for anything that affects gameplay, narrative, or persistence.                 |

### Map code: two apps, one canonical game copy

Map rendering and interaction logic was **copied** (not moved) from `web/src` into **`game/src/lib/maps/`**. That location is intentional — it is the game’s map layer, separate from game-only composables in `game/src/composables/`.

- **`game/src/lib/maps/`** — hex outdoor, grid indoor, HUD, builder components. Edit here for anything the playable game needs.
- **`web/`** — parallel prototype copy. May diverge over time. Use as a reference or sandbox; re-port into `game/` when a prototype change should land in the game.
- **`game/content/world/`** — game world YAML (copied from `web/content/world/`, evolves for story triggers).

**Rule:** Never add game features (story, save/load, narrative overlay) to `web/`. Fix gameplay in `game/`, not by patching `web/`.

### Builder mode

Builder tools (edit handles, builder sidebars, placement overlays) exist so **authors** can edit maps and preview changes. **Players** must never see them — not because builder code is omitted from builds, but because it is **disabled for their role**.

| Mode             | Who              | What they see                                                                                                             |
| ---------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Play mode**    | Players          | Normal HUD only — travel, inventory, doors, actions, story overlay. No builder UI.                                        |
| **Builder mode** | Authors / admins | Play mode **plus** builder components — toggle on to edit YAML-driven layout and immediately preview in non-builder view. |

- The same `game/` build ships both modes. **User role** controls whether builder UI is available (players: off; authors/admins: on). Do not maintain separate player vs. author builds for this.
- During local development, a simple toggle (same pattern as `web/src/App.vue`) is fine until auth/roles exist.
- `web/` is the standalone map demo with builder always available — useful as a reference, not a substitute for role-gated builder in `game/`.
- When copying or extending map features, keep builder layers separate from the player-facing scene wiring so play mode stays clean when builder is off.

### Running the apps

From the repo root:

```bash
npm run dev:prototype   # web/ — map prototype demo
npm run dev:game        # game/ — playable vertical slice
```

### Tests

Gameplay and map changes live in `game/`. **Before finishing work** on travel, barriers, story integration, composables, or world YAML, run the test suite and fix failures:

```bash
npm run test            # from repo root (runs game/ vitest)
```

Run tests again after each meaningful code change in those areas — not only at the end of a large task. A pre-push hook also runs tests locally; do not rely on it as the first time you learn something broke.

When adding or changing movement, barrier, or arrival behavior, add or update a test in `game/src/lib/maps/testing/` or `game/src/composables/`. See [docs/designs/hex-crawling.md](docs/designs/hex-crawling.md) for the movement contract (two-step border-then-stand, in-hex `crossPassage` vs inter-hex travel).

## Architecture

**Bespoke web-native CYOA engine built with Vue 3 + Vite.**

Ren'Py, Twine, and Unity were evaluated and rejected. The sibling mini-game projects are web apps (Vue 3, Nuxt 3), so a web-native adventure frame lets them embed directly.

```
game/
├── content/
│   ├── world/          — Map YAML (copied from web/, evolves for story)
│   └── story/          — Narrative beats (part-i.yaml, etc.)
├── src/
│   ├── composables/    — useGameState, useSaveGame, useStory (game-only)
│   ├── components/     — Story overlay, app chrome
│   └── lib/maps/       — Map engine (hex outdoor, grid indoor, HUD, builder)
```

Integration model:

```
lib/maps (outdoor + indoor)
  → flags + location via useGameState (serializable)
  → useStory (location/flag-triggered beats)
  → StoryOverlay (prose + choices)
  → useSaveGame (localStorage)
```

Future layers (not all built yet):

- Passage graph interpreter (full `go_to`, simulation gates)
- Built-in sims (hydro, PV, nuclear, fusion as Vue components)
- Mini-game embeds (isotope-explorer, crazy-converter)

## Story Data Format

Story content lives in YAML files, one per area. See `design/content/story/story-data-format.md` for the full schema. Key concepts:

- **Passages** — Text + image + choices. The atomic unit.
- **Conditions** — `require: { all: [...], not: [...], items: [...] }`
- **Flags** — Dot-scoped booleans: `hydro.read_ops_manual`
- **Simulation gates** — Passage launches sim, gates on success/failure
- **Area transitions** — `go_to: hydro:arrival` (area:passage syntax)
- **Passage IDs** — kebab-case, unique within area
- **Item IDs** — flat kebab-case

The current slice uses a minimal subset: text, choices, `require`, `set_flags`, and location/flag triggers (`when`).

## Sibling Projects

These embed as mini-games within the adventure:

- **`../crazy-converter/`** — Nuxt 3 + FastAPI + Rust/PyO3. Unit conversion tool. Embeds via iframe.
- **`../isotope-explorer/`** — Vue 3 + Rust/WASM. Nuclear simulation. Embeds as Vue component.

## World & Tone

- **Setting:** Future where energy technology has been lost. Infrastructure remains, knowledge is gone.
- **Inspiration:** Myst (atmosphere, exploration) + Tintin (protagonist personality)
- **Protagonist:** Zanzibar Nuhero — see `design/content/story/characters.md`
- **Story structure:** Part I (several weeks, surface — hydro operations) → Part II (below); Part I ends with a hidden elevator (hydro gate)
- **Core message:** Hopeful. Technology exists to help people thrive.

## Core Loop

Explore → Encounter Problem → Learn Concept → Apply in Simulation → Unlock Story → Repeat

## Level Order

1. Hydroelectric plant (most intuitive)
2. PWR reactor — AP-1000
3. Gen IV reactor — SFR
4. Solar array — PV
5. Fusion facility — Tokamak (most abstract)
