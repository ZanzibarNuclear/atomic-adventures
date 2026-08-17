# Technology Roadmap

**Status:** Early implementation — Part I vertical slice in progress  
**Purpose:** Record architecture decisions, summarize what is built, and track what remains to make Part I fully playable.

Detailed behavior for story beats, world authoring, movement, and deployment lives in linked docs below. This file does not duplicate those contracts.

---

## Where we are

The project has moved past stack selection and scaffolding. The playable `game/` app runs a beat-driven adventure on hex outdoor and grid indoor maps, with local save/load, story and world builders, and a static Vercel production build. Part I narrative and exploration work through roughly Day 1 shelter and early hydro foreshadowing; the interactive systems that turn hydro startup, campus exploration, and operations into gameplay are largely still ahead.

---

## Decisions made

| Decision                    | Choice                                               | Notes                                                                                                                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adventure frame             | **Vue 3 + Vite** bespoke CYOA engine                 | Ren'Py, Twine, and Unity were rejected; sibling mini-games are web apps and embed cleanly. See [AGENTS.md](../AGENTS.md).                                                                                                                               |
| Game app                    | **`game/`** is canonical                             | Gameplay, story, persistence, authoring, and player maps live in `game/`.                                                                                                                                                                               |
| Authored content store      | **SQLite** (`game/content/atomic-adventures.sqlite`) | Story beats, outdoor world, building geometry, and character content are canonical in SQLite. YAML is explicit import/export snapshot material only.                                                                                                    |
| Indoor geometry             | **SQLite document** (`utility-station`)              | Edited in the Utility Station workspace under `/builder/world`; YAML snapshots can be imported/exported explicitly.                                                                                                                                     |
| Story runtime unit          | **Story arcs, story beats, and scenes**              | `StoryArc` owns guided progression, `StoryBeat` owns choices/actions/completion/effects, and `Scene` owns prose variants. Planned passage features (`go_to`, simulation gates) are not implemented yet. See [story-beats.md](contracts/story-beats.md). |
| Authoring                   | **Separate builder routes**                          | `/builder/story`, `/builder/world`, and `/builder/content`; local Node API + SSE live updates. Production excludes builders. See [world-authoring.md](contracts/world-authoring.md) and [character-inventory.md](contracts/character-inventory.md).     |
| Player persistence (now)    | **localStorage** via `useSaveGame`                   | No accounts, no server-side saves.                                                                                                                                                                                                                      |
| Production                  | **Static Vercel**                                    | Build exports SQLite → `story.json` + `world.json`; no authoring server in prod. See [deployment.md](deployment.md).                                                                                                                                    |
| Transactional data (future) | **Neon Postgres**                                    | Planned when player registration and server-side state are needed — not required for the current slice. See [deployment.md § Future Neon Integration](deployment.md#future-neon-integration).                                                           |

---

## What is working today

These systems are implemented and exercised by tests where noted:

- **Playable shell** — `GameView`, save/load/reset, dev movement audit (dev builds only).
- **Outdoor map** — Hex travel, barriers, passages, river crossings, compound gate gameplay, stand points. Contract: [hex-crawling.md](contracts/hex-crawling.md).
- **Indoor map** — Grid rooms, doors, roll-ups, keys, facility state (`hydroOnline`, manual modes), hydro diagram overlay (visual only, fogged until discovery).
- **Story engine** — Scene selection, acknowledgment, revisit prose, choice effects (flags + movement destinations), and guided Story mode migration toward `useStoryArc`. Wired through `NarrativeCard` and `usePlayPanel`.
- **Flags & inventory (minimal)** — Dot-scoped flags; inventory as a set of item ids (keys for doors; basic `InventoryPanel`). Serializable in save data.
- **Content pipeline** — Story/world/content JSON API, SSE refresh, SQLite revisions, import/export CLI.
- **Authoring** — Story builder (map-first beat editing), world builder (canvas-first outdoor geometry), and Content builder (character development plus artifact catalogs).
- **Deployment** — `npm run build:game` → static bundle on Vercel.

Design and narrative intent for Part I (unlock chains, hydro phases, discovery track) are documented in [Part I Unlocks](../game-design/content/part-i-unlocks.md), [hydro-simulation.md](../game-design/content/subject-matter/hydro-simulation.md), and [story-overview.md](../game-design/content/story/story-overview.md).

---

## Part I: what remains

Part I is **hydro-centric**: forest arrival → shelter → library → startup the campus penstock plant → weeks of operations and power management → **hydro operator qualified** (solar field discovered on eBuggy tour along the way). The vertical slice must support that spine end-to-end, not only map traversal and prose. The hidden elevator is a **Part II → III** threshold, not Part I.

### 1. Simulation gates and challenge integration

The beat engine does not yet launch simulations or gate progression on sim success. Needed:

- A **simulation gate** contract in story/beats: open a sim UI, pass/fail criteria, set flags on success (e.g. `hydro.clear-intake-debris`, `hydro.level-1-complete`, `hub.hydro_online`).
- Wiring between **challenge IDs** in [Part I Unlocks](../game-design/content/part-i-unlocks.md) and runtime flags/requirements.
- **Failure and retry** feedback aligned with [progression-design.md](../game-design/content/progression-design.md) (early win, then “real life” complexity).

### 2. Hydro power simulator

The core Part I teaching and gating system. Spec: [hydro-simulation.md](../game-design/content/subject-matter/hydro-simulation.md).

**Level 1 startup (one-time gate)** — four linked steps:

1. Clear intake debris
2. Confirm penstock pressure rise
3. Open turbine valve
4. Energize generator → station power on

**Operations (Level 2+)** — recurring rounds over in-game weeks: leaks, gauge literacy, load matching, excess capacity, maintenance, weather/low flow.

The grid map's hydro layer is **diagram-only** today. The sim must drive real facility state (flow, head, power, alarms) and connect to campus load.

### 3. Control room console

After startup, the **hydro control room** is the main monitoring surface (see [part-i.md](../game-design/content/story/part-i.md) Day 2+ beats):

- Gauges and telemetry tied to **simulator state** (not decorative).
- Campus load / generation balance (lighting zones, charge port, auxiliary circuits).
- Map or schematic of campus circuits; optional hints toward discoveries (storage, solar).
- Battery fleet behavior (excess generation → storage; grid runs from batteries) as designed in narrative — needs a simplified but consistent model.

This is distinct from the narrative card: a persistent **facility UI** the player returns to during operations.

### 4. Holo-reader (technical learning)

Power-gated library devices for immersive study ([world-and-style.md](../game-design/content/story/world-and-style.md)):

- Unlocked after station power (`hub.hydro_online`).
- Delivers structured lessons on hydro theory, campus systems, and foreshadowing content (storage, solar, Act II reactor tease).
- **Theory vs actuals** — lesson content vs live values from the hydro sim / control room where appropriate.
- Content format TBD (structured JSON, Markdown rendered in-game, or hybrid). Rich text can grow via a shared prose pipeline when needed; no Nuxt migration of the game app.

### 5. eBuggy driving simulator

Second major interactive system for Part I discovery:

- Found in garage during shelter; **charge and drive** after Level 1 hydro complete.
- Driving sim for **campus-scale exploration** — compound tour, environmental storytelling, access to outdoor areas not practical on foot.
- Integration with charge port, generator running, and flags such as `hub.buggy-mobile`.
- Open design questions (from unlock catalog): field trip to intake vs remote-only debris clearing; how much driving is required vs optional.

### 6. Close-up room views

Grid map shows floor plans; Part I also needs **inspectable room detail** — looking at contents, controls, and props:

- Close-up or alternate view for rooms (garage, library, kitchen, control room, etc.).
- Interact with objects that are too fine-grained for the top-down grid (buggy under cover, holo-readers, tool rack, charge cables, infopods, conference screen).
- Bridge between **exploration beats** and **simulator entry points** (e.g. open control console from control room close-up).

These are top-level **game views**, not overlays squeezed around the map. The
primary play area switches among:

- outdoor or indoor map;
- location close-up (such as inspecting the eBuggy);
- lesson, document, console, or simulation;
- character status and inventory.

Switching views does not move the player or replace gameplay state. Returning
to the map restores the same logical location, selected room or stand, camera,
narrative context, and available actions. A close-up remains associated with
the location or fixture that opened it, while the character view is globally
available unless a modal simulation or required decision deliberately blocks
leaving.

The app shell should own this shared view navigation and a consistent **Return
to map** path. Individual close-ups, lessons, simulations, and character tabs
must not invent separate navigation models.

### 7. Character, items, inventory, and progression

The data-driven character foundation is implemented: revisioned authored
catalogs, global save state, shared requirements/effects, catalog-backed keys
and pickups, Character panel, and Character/Story/World authoring controls.
The first learning progression is also wired: the hydro primer and holo-reader
lesson distinguish document discovery from acquired knowledge; hydro practice
awards evidence; deterministic authored rules promote Hydro Operations through
Introduced, Practiced, and Qualified ranks with earned badge text.
Physical item custody is implemented with stack records, unique instances,
portable containers, world placements, and vehicle/fixed holders. The first
authored examples are a field backpack, a bolt cutter, and eBuggy cargo; the
Inventory tab exposes explicit transfer controls for reachable holders.
Remaining Part I work includes:

- broader authored learning progression and quest content beyond the wired
  Restore Station Power chain;
- simulation-owned evidence outcomes;
- close-up views for room detail, holo-reader lessons and videos, buggy rides,
  and simulations;
- simulation outcome integration through the shared effect boundary.

Server-side item state waits on Neon (below); local save must serialize the expanded model first.
Contract: [character-inventory.md](contracts/character-inventory.md).
Implementation plan:
[close-up-views-implementation.md](plans/close-up-views-implementation.md).

### 8. Time, days, and operations pacing

The game now owns a serializable authored clock (`day`, `minuteOfDay`, and
elapsed game minutes). All clock changes pass through one `advanceGameTime`
boundary with `resting`, `light`, `moderate`, or `strenuous` activity.
Movement, story choices, indoor interactions, rest, and item actions report
game minutes. Hunger/thirst drift and threshold health effects are integrated
in one-minute deterministic steps, so equivalent large and small advances
produce the same result. The clock never advances from real elapsed time while
the game is closed.

Part I still spans **weeks** of in-game time and needs:

- Day/night or phase transitions as a pacing container.
- Scheduling operations rounds and discovery beats across startup vs operations weeks.
- End-of-day / rest beats where design requires them.

The Day 1 end card remains a placeholder; later days need real progression
hooks into hydro and discovery content.

### 9. Narrative and content completion

Map and beat infrastructure support Part I, but the **full beat spine** — forest through hydro ops, eBuggy solar discovery, and hydro-operator threshold — is not authored and wired:

- Beats through library, control room, startup chain, buggy reward, ops rounds, discoveries (solar field, reactor tease), Part I ending.
- Revisit prose and choice trees for repeat visits during operations.
- Align authored flags in SQLite with indoor event hooks in the utility-station building document.

### 10. Presentation polish (non-blocking but visible)

- **Prose** — `proseParagraphs()` today; inline Markdown and richer beat text when authors need it.
- **Simulation UX** — transitions between map, close-ups, sim panels, and holo-reader without losing place context.
- **Shared game-view navigation** — consistent map, close-up, lesson/simulation,
  and character-view switching with location and context restoration.
- Accessibility and mobile layout pass before calling Part I “complete.”

---

## Part I completion checklist (summary)

| Capability                                      | Status                                                        |
| ----------------------------------------------- | ------------------------------------------------------------- |
| Hex outdoor + grid indoor exploration           | **Done**                                                      |
| Beat-driven narrative + save/load               | **Done**                                                      |
| Story & world builders + SQLite pipeline        | **Done**                                                      |
| Static production deploy                        | **Done**                                                      |
| Simulation gates in story engine                | **Not started**                                               |
| Hydro startup sim (Level 1)                     | **Alpha implemented**                                         |
| Hydro operations sim (Level 2+)                 | **Partial** (monitoring/history; full ops rounds still ahead) |
| Control room console                            | **Alpha implemented**                                         |
| Holo-reader                                     | **Partial**                                                   |
| eBuggy driving sim                              | **Not started**                                               |
| Close-up room inspection                        | **Not started**                                               |
| Character stats, progression, inventory & items | **Partial**                                                   |
| In-game calendar / ops pacing                   | **Partial**                                                   |
| Part I content spine authored & gated           | **In progress**                                               |

---

## Beyond Part I

### Player accounts and Neon

When the game needs **registered players** and **server-side persistence**, introduce **Neon Postgres** as the transactional store. Likely first uses:

- Player registration and authentication
- Cloud save slots (replacing or supplementing localStorage)
- Inventory and progression synced across devices

Keep **player/account schema separate** from authored content. SQLite (or a later Neon migration) remains the source for story beats and world geometry; Git promotion of `atomic-adventures.sqlite` stays valid until remote authoring is explicitly designed. Details: [deployment.md § Future Neon Integration](deployment.md#future-neon-integration).

### Later technologies and embeds

After Part I threshold (hydro operator qualified):

- **Part II — PV** — Restore solar field discovered on eBuggy tour; integrate with hydro ([game-design-overview.md](../game-design/game-design-overview.md)).
- **Part III — Gen IV SMR** — Hidden elevator after Part II; underground reactor; traveling party reunion.
- **Mini-game embeds** — isotope-explorer (Vue/WASM), crazy-converter (iframe); integration contract still to be defined before Part III nuclear work.
- **Real-world reactor tracking** — launch SMR choice from designs in development (Natrium, Kairos, X-Energy, etc.); extension packs for alternates.

Deferred: AP-1000, fusion chapters.

### Longer horizon

- Passage graph features beyond beats (`go_to`, cross-area travel, fuller `require` schema).
- Further Utility Station authoring polish, including richer visual editing and validation helpers.
- Localization, modding, or community content — explicitly out of scope until Part I ships.

---

## Related documentation

| Topic                                          | Document                                                                                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent / repo overview                          | [AGENTS.md](../AGENTS.md)                                                                                                                          |
| Beat runtime & authoring                       | [contracts/story-beats.md](contracts/story-beats.md)                                                                                               |
| Game time, durations & simulation time         | [contracts/time.md](contracts/time.md)                                                                                                             |
| Milestones, temporal predicates & achievements | [contracts/milestones.md](contracts/milestones.md)                                                                                                 |
| Outdoor world authoring                        | [contracts/world-authoring.md](contracts/world-authoring.md)                                                                                       |
| Character, inventory, stats, skills & quests   | [contracts/character-inventory.md](contracts/character-inventory.md)                                                                               |
| Close-up views implementation plan             | [plans/close-up-views-implementation.md](plans/close-up-views-implementation.md)                                                                   |
| Character/inventory regression checklist       | [quality/character-inventory-regression-checklist.md](quality/character-inventory-regression-checklist.md)                                         |
| Hex movement contract                          | [contracts/hex-crawling.md](contracts/hex-crawling.md)                                                                                             |
| Production & Neon                              | [deployment.md](deployment.md)                                                                                                                     |
| Part I unlock chains                           | [game-design/content/part-i-unlocks.md](../game-design/content/part-i-unlocks.md)                                                                  |
| Hydro sim spec                                 | [game-design/content/subject-matter/hydro-simulation.md](../game-design/content/subject-matter/hydro-simulation.md)                                |
| Story & facility narrative                     | [game-design/content/story/story-overview.md](../game-design/content/story/story-overview.md), [part-i.md](../game-design/content/story/part-i.md) |
| Planned story schema (future)                  | [game-design/content/story/story-data-format.md](../game-design/content/story/story-data-format.md)                                                |

---

## Document history

| Date    | Change                                                         |
| ------- | -------------------------------------------------------------- |
| 2026-06 | Full rewrite: decisions, Part I gaps, Neon future              |
| 2026-06 | `design/` → `game-design/`; `docs/design/` → `docs/contracts/` |
