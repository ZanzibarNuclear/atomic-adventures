# Character, Inventory, and Shared Game Views — Implementation Plan

**Status:** In progress
**Last updated:** 2026-06-19  
**Primary contract:** [Character and Inventory Management](../contracts/character-inventory.md)  
**Roadmap:** [Technology Roadmap](../tech-roadmap.md)

This file is the durable handoff for implementing character state, inventory,
wellbeing, knowledge, skills, quests, documents, and the shared primary
game-view surface. Future work should update the checkboxes and notes here
rather than relying on conversation history.

## Goal

Deliver a data-driven system in the `game/` app where:

- authors define items, stats, knowledge, skills, quests, and documents;
- player state is global, serializable, and independent of authored content;
- story, world interactions, and simulations share requirements and effects;
- items can be carried, stored in a backpack, left in the world, or transported
  in the eBuggy;
- hunger and thirst advance with game time and activity;
- lessons grant knowledge and practice awards skills or badges;
- Map, Character, close-up, lesson, document, console, and simulation views
  share the same primary game stage and restore map context when closed.

## Locked Decisions

- Implement in `game/`; do not add these systems to `web/`.
- Store authored definitions as the versioned SQLite document
  `character-main`.
- Export production definitions as `/content/character.json`.
- Keep authored definitions separate from player save state.
- Replace the indoor-only inventory `Set` with global holder-based character
  state, preserving existing keys and door behavior through migration.
- Use a finite requirements/effects language; do not execute authored code.
- Use authored game time, never real elapsed wall-clock time, for needs.
- Distinguish documents, knowledge, practice evidence, and skills.
- Treat the character screen and close-ups as peer views of the map, not as
  small overlays around it.
- Keep builder routes development-only and absent from production bundles.

## Current Baseline

- `game/src/views/GameView.vue` directly chooses `OutdoorScene` or
  `IndoorScene` from `place`.
- `game/src/composables/useGameState.js` uses save version 2.
- Inventory is `indoor.inventory`, a `Set<string>`, serialized under
  `snapshot.indoor.inventory`.
- Building-local item definitions and pickups live in the utility-station
  building document.
- Doors and indoor actions read the indoor inventory directly.
- Story requirements currently evaluate flags only.
- Story choices currently set flags and optionally move.
- SQLite migrations currently include `001-story-content.sql` and
  `002-world-content.sql`.
- Development content uses JSON API + SSE; production exports static JSON.

## Delivery Strategy

Implement thin vertical increments. Keep compatibility adapters until all
consumers have moved to the new character service. Run `npm run test` after
every meaningful state, movement, story, or world integration change. Run
`npm run build:game` at every production-content boundary.

Do not begin hunger/thirst or containers by adding special fields to
`useGameState`. First establish the generic definition, state, requirement,
effect, and holder primitives.

---

## Phase 0 — Shared Primary Game-View Shell

**Purpose:** Establish navigation that later character, close-up, lesson, and
simulation views can share.

- [x] Add a `useGameView` composable or equivalent state owned by
  `GameView.vue`.
- [x] Represent at least:
  `map`, `character`, `closeup`, `lesson`, `document`, `console`, and
  `simulation`.
- [x] Keep view payload separate from logical player location. A payload may
  reference a fixture, lesson, document, or simulation ID.
- [x] Add app-shell actions for `openView(...)` and `returnToMap()`.
- [x] Render outdoor/indoor scenes only when the active view is `map`.
- [x] Add a placeholder Character view proving Map ↔ Character switching.
- [x] Preserve outdoor camera, indoor room/stand, narrative card, and available
  actions when returning to Map.
- [x] Decide and document blocking behavior for a required decision or modal
  simulation.
- [x] Keep top-level view selection out of persisted save data initially.
- [x] Add component/composable tests for view switching and context
  preservation.

Likely files:

- `game/src/views/GameView.vue`
- `game/src/components/AppHeader.vue`
- `game/src/composables/useGameView.js` (new)
- `game/src/components/game-views/CharacterView.vue` (placeholder/new)

**Exit criterion:** A player can toggle Map ↔ Character without movement,
story refresh, camera reset, or save-state mutation.

---

## Phase 1 — Character Content Repository and Runtime Delivery

**Purpose:** Establish authored definitions before changing player state.

- [x] Add migration `003-character-content.sql`.
- [x] Store `character-main` and immutable revisions using a coarse JSON
  document, matching world/building revision semantics.
- [x] Implement normalization and validation for profile, panel groups, items,
  stats, knowledge, skills, quests, and documents.
- [x] Seed a minimal catalog containing the three existing utility-station
  keys. Do not remove building-local definitions yet.
- [x] Implement repository get/save/revisions/restore and optimistic version
  checks.
- [x] Add development API endpoints:
  - `GET /api/character`
  - `PUT /api/character`
  - `POST /api/character/validate`
  - `GET /api/character/revisions`
  - `POST /api/character/revisions/:revision/restore`
- [x] Add `characterRevision` to the SSE ready payload.
- [x] Broadcast `character.updated` after committed saves/restores.
- [x] Export `/content/character.json` during `npm run build:game`.
- [x] Update production-build verification and deployment documentation.
- [x] Add repository, validation, API, SSE, export, and production-build tests.

Likely files:

- `game/server/migrations/003-character-content.sql`
- `game/server/character-model.js` (new)
- `game/server/character-repository.js` (new)
- `game/server/api.js`
- `game/server/index.js`
- `game/server/export-runtime-content.js`
- `game/server/verify-production-build.js`
- corresponding `*.test.js` files

**Exit criterion:** The same validated character catalog loads from API in
development and static JSON in production, with revisions and live updates.

---

## Phase 2 — Runtime Character Store and Save Migration

**Purpose:** Move player-owned character state out of the indoor map without
breaking existing gameplay.

- [x] Add a character-content loader with API/static fallback and SSE refresh,
  following `useStoryContent`/`useWorldContent` patterns.
- [x] Add a global character store initialized from definitions:
  - holdings, initially using only the character holder;
  - stats;
  - knowledge;
  - skills/evidence;
  - quests/objectives;
  - documents.
- [x] Increase `SAVE_VERSION`.
- [x] Add `snapshot.character`.
- [x] Migrate legacy `snapshot.indoor.inventory` IDs to quantity-one character
  holdings.
- [x] Keep unknown saved IDs as hidden orphans and warn in development.
- [x] Reset character state correctly on New Game and Reset.
- [x] Preserve character state during story, world, building, and character
  live-content refresh.
- [x] Add a temporary compatibility adapter exposing Set-like `has(itemId)`
  behavior to existing door/action code.
- [x] Add save round-trip, v2 migration, reset, orphan, and live-refresh tests.

Likely files:

- `game/src/composables/useCharacterContent.js` (new)
- `game/src/composables/useCharacterState.js` (new)
- `game/src/composables/useGameState.js`
- `game/src/composables/useSaveGame.js`
- `game/src/views/GameView.vue`
- `game/src/composables/useGameState.test.js`

**Exit criterion:** Existing keys, pickups, locks, save/load, reset, and live
refresh work with global character state; no gameplay consumer needs to know
that the old save used `indoor.inventory`.

---

## Phase 3 — Shared Requirements and Atomic Effects

**Purpose:** Create the generic integration boundary used by story, world, and
simulations.

- [x] Implement normalized requirements for flags, items, stats, knowledge,
  skill ranks/evidence, quests, and documents.
- [x] Preserve legacy flag shorthand and `require.items: [id]`.
- [x] Implement registered effects for flags, items, stats, knowledge, skills,
  quests, and documents.
- [x] Validate all references and state transitions before committing.
- [x] Apply an effect list atomically.
- [x] Return structured failure reasons suitable for disabled-action hints.
- [x] Make requirements side-effect free.
- [x] Unit-test every operator, mixed-domain requirements, failed atomic
  commits, bounds, quantities, and legacy normalization.

Likely files:

- `game/src/lib/character/requirements.js` (new)
- `game/src/lib/character/effects.js` (new)
- `game/src/lib/character/holdings.js` (new)
- matching tests

**Exit criterion:** A single tested API can answer whether an action is
available and commit all its rewards/costs without partial mutation.

---

## Phase 4 — Migrate Story and Existing World Inventory

**Purpose:** Put the new core on the current playable path.

- [x] Extend story model/runtime schema with character requirements and
  ordered effects.
- [x] Keep `sets` and `set_flags` as migration aliases.
- [x] Evaluate beat and choice requirements through the shared evaluator.
- [x] Apply choice effects before movement; abort movement if effects fail.
- [x] Move utility-station item definitions from the building document into
  `character-main`.
- [x] Retain building pickups as placement records referencing catalog IDs.
- [x] Change doors, pickups, and indoor actions to use the character service.
- [x] Remove the compatibility adapter only after all inventory consumers are
  migrated.
- [x] Update story/building validators and reference checks.
- [x] Add tests for item-gated beats, choices, doors, pickup idempotence,
  effect-before-movement, and failed effects.
- [x] Update `story-beats.md` and `world-authoring.md` when behavior lands.

Likely files:

- `game/server/story-model.js`
- `game/server/building-model.js`
- `game/src/composables/useStory.js`
- `game/src/composables/usePlayPanel.js`
- `game/src/lib/maps/composables/indoor/useIndoorPlayer.js`
- `game/src/lib/maps/composables/indoor/useIndoorDoors.js`
- `game/src/lib/maps/composables/useDoors.js`

**Exit criterion:** Current gameplay uses authored global items and shared
requirements/effects end-to-end.

---

## Phase 5 — Character View: Overview and Simple Inventory

**Purpose:** Deliver the first player-visible value before advanced containers.

- [x] Replace the placeholder with the real Character view.
- [x] Add Map/Character navigation in the app shell.
- [x] Add tabs configured by authored panel content.
- [x] Implement Overview with portrait, profile, authored stats, and active
  quest summary.
- [x] Implement Inventory for directly held items and quantities.
- [x] Add item details, descriptions, icons, linked documents, and empty states.
- [x] Remove the old inline `InventoryPanel` from `IndoorScene` once equivalent
  access exists.
- [x] Preserve the selected Character tab for the browser session.
- [x] Implement keyboard navigation, focus restoration, textual meter values,
  narrow-screen layout, and non-color status cues.
- [x] Add UI tests for toggling, tabs, empty/populated states, and accessibility
  semantics.

Likely files:

- `game/src/components/game-views/CharacterView.vue`
- `game/src/components/character/*` (new)
- `game/src/components/AppHeader.vue`
- `game/src/lib/maps/views/IndoorScene.vue`

**Exit criterion:** The player can review character status and current
possessions in the shared game stage and return to the unchanged map.

---

## Phase 6 — Character Builder

**Purpose:** Give authors control without manual JSON or IDs.

- [x] Add development route `/builder/character`.
- [x] Add Character to `BuilderShell`.
- [x] Implement explicit Save, Revert, dirty-state protection, validation,
  revision history, and restore.
- [x] Add editors for profile/panel, items, stats, knowledge, skills, quests,
  and documents.
- [x] Add catalog ID selectors to Story Builder requirements/effects.
- [x] Add item selectors to relevant World Builder placements, doors, and
  interactions.
- [x] Add reference search and reference-aware rename previews.
- [x] Reject deletion while referenced.
- [x] Add panel previews for empty, early-game, and populated states.
- [x] Verify the builder route/chunks remain absent from production.

Likely files:

- `game/src/router.js`
- `game/src/components/BuilderShell.vue`
- `game/src/views/CharacterBuilderView.vue` (new)
- `game/src/views/BuilderView.vue`
- `game/src/views/UtilityStationBuilderView.vue`
- server reference/rename logic

**Exit criterion:** An author can define and safely reference ordinary
character content without editing source files.

---

## Phase 7 — Game Clock, Activity, Hunger, Thirst, and Consumables

**Purpose:** Support the Part I lived-in survival rhythm generically.

- [x] Define the game-clock contract before implementation: current game time,
  calendar/day representation, and one `advanceTime` boundary.
- [x] Implement registered activity profiles:
  `resting`, `light`, `moderate`, `strenuous`.
- [x] Ensure movement, story actions, rest, item actions, and simulations can
  report elapsed game minutes and activity.
- [x] Implement stat drift integration, bounds, threshold crossing, and
  threshold effects.
- [x] Guarantee large and small equivalent time advances produce the same
  result.
- [x] Add authored `health`, `hunger`, and `thirst` definitions.
- [x] Add authored food/water items with calories/hydration metadata and
  explicit Eat/Drink actions.
- [x] Add wellbeing meters and warnings to Overview; optionally add a compact
  header summary after usability testing.
- [x] Add beat/action requirements based on needs where narrative requires.
- [x] Test time advancement, activity rates, sleep-sized jumps, consumption,
  health thresholds, save/load, and no wall-clock progression while closed.
- [x] Update the roadmap's time/calendar section with the implemented clock
  contract.

**Exit criterion:** Hunger and thirst change predictably with authored game
time/activity, and authored meals/water affect them through ordinary effects.

---

## Phase 8 — Documents, Knowledge, Practice, Skills, and Badges

**Purpose:** Represent the learning arc from exposure to competence.

- [x] Implement Documents and Knowledge tabs.
- [x] Implement lesson/document actions that explicitly grant knowledge.
- [x] Gate a real story beat or activity on a knowledge ID.
- [x] Implement skill evidence counters and authored rank-award rules.
- [x] Evaluate awards after committed effects, in deterministic rank order.
- [x] Add one-time/repeatable evidence controls to simulation outcomes.
- [x] Implement Skills display with rank, progress, qualification, badge art,
  and earned text.
- [x] Wire Part I examples:
  - holo-reader hydro lesson → hydro knowledge;
  - successful operating day → operating-days evidence;
  - leak repair → leak-repairs evidence;
  - evidence thresholds → Hydro Operations ranks/qualification.
- [x] Test document versus knowledge separation, gated actions, repeat
  protection, award ordering, and save/load.

**Exit criterion:** The full chain works:
`lesson/document → knowledge → successful practice → evidence → skill/badge`.

---

## Phase 9 — Quests and Objectives

**Purpose:** Give the player a readable account of multi-step goals.

- [x] Implement quest/objective state transitions and counters.
- [x] Add Quests tab sections for available, active, completed, and failed.
- [x] Support authored visibility and optional auto-completion.
- [x] Wire a Part I quest such as Restore Station Power.
- [x] Ensure quests summarize story/simulation progress without replacing beat
  selection.
- [x] Test invalid transitions, objective counters, auto-completion, repeat
  effects, save/load, and live definition updates.

**Exit criterion:** A multi-system Part I goal is author-defined, updated by
ordinary effects, and understandable from the Character view.

---

## Phase 10 — Holders, Backpack, World Storage, and eBuggy Cargo

**Purpose:** Complete physical item custody and transport.

- [x] Implement unique instances, stacks, holder IDs, and ownership
  invariants.
- [x] Implement character, portable-container, vehicle, fixed-container, and
  world-placement holders.
- [x] Implement capacity by slots and optional mass.
- [x] Disallow nested containers by default.
- [x] Implement `carried` and `nearby` access scopes.
- [x] Implement atomic item transfer, split/merge stacks, drop, and pickup.
- [x] Persist runtime placements, fixed-container contents, vehicle contents,
  and container contents.
- [x] Add the field backpack as a portable container.
- [x] Add eBuggy cargo as a holder whose location follows the vehicle.
- [x] Show accessible holder trees in Inventory and permit drag/drop or
  explicit transfer controls.
- [x] Ensure tools in distant eBuggy cargo or a backpack left elsewhere fail
  physical requirements.
- [x] Test capacity, stack behavior, transfer rollback, holder cycles,
  backpack movement, leaving a backpack, vehicle travel, proximity, save/load,
  and live world refresh.

**Exit criterion:** Keys, food, cards, and tools can move among character,
backpack, world, and eBuggy while physical access remains coherent.

---

## Phase 11 — Close-Ups, Lessons, and Simulation Integration

**Purpose:** Apply the shared view shell and character effects to actual Part I
content surfaces.

- [ ] Define a registered game-view descriptor and component registry.
- [ ] Open an eBuggy close-up from the garage without changing logical
  location.
- [ ] Open a holo-reader lesson in the primary stage and grant knowledge on its
  authored completion.
- [ ] Open a simulation with a declared read-only character snapshot.
- [ ] Validate and atomically commit registered simulation outcomes.
- [ ] Restore the exact map and narrative context on Return to Map.
- [ ] Prevent external/iframe content from mutating player state directly.
- [ ] Test unknown view IDs, blocked exits, outcome replay, stale content,
  context restoration, and save during/after views.

**Exit criterion:** One close-up, one lesson, and one simulation use the common
view navigation and character integration contract.

---

## Cross-Cutting Test Matrix

Maintain these checks throughout implementation:

- [ ] Existing movement and barrier tests remain green.
- [ ] Existing keys and doors behave identically.
- [ ] Legacy saves migrate and remain playable.
- [ ] New saves round-trip every character domain and holder.
- [ ] Reset/New Game clears player state but not authored definitions.
- [ ] Live authoring never replaces player-owned state.
- [ ] Unknown authored IDs fail validation; unknown saved IDs do not destroy a
  save.
- [ ] Effect lists never partially commit.
- [ ] Production build contains all runtime JSON and no builder chunks.
- [ ] Keyboard-only navigation works for Map/Character and all tabs.
- [ ] Narrow-screen Character and item transfer UI remains usable.

Required commands at relevant phase boundaries:

```bash
npm run test
npm run build:game
```

Use `npm run deploy:check` before considering the complete feature ready for
merge.

## Recommended First Implementation Slice

Start with Phases 0–5, stopping after simple directly carried inventory:

1. shared game-view shell;
2. authored character document and runtime export;
3. global character state plus save migration;
4. requirements/effects core;
5. migrate existing keys and pickups;
6. Character Overview and Inventory UI.

This produces visible value and removes the current architectural constraint
without prematurely combining the game clock, learning progression, and
container transport in one change.

Then implement Phase 7 and Phase 8 as separate vertical slices. Implement
Phase 10 only after the simple inventory UI and save model are stable.

## Resume Checklist

At the start of a future session:

1. Read this plan and
   [character-inventory.md](../contracts/character-inventory.md).
2. Check `git status` and preserve unrelated user changes.
3. Find the first unchecked phase/task that is in scope.
4. Inspect current migrations and `SAVE_VERSION`; do not assume the baseline
   section is still current.
5. Update this plan's checkboxes and **Last updated** date as work lands.
6. Run the phase's tests before handing off.

## Progress Notes

- 2026-06-19 — Plan created. No implementation phases started.
- 2026-06-19 — Phase 0 completed. Added the shared game-view controller,
  Map/Character shell navigation, placeholder Character view, blocking-view
  semantics, tests, production-build verification, and browser interaction
  check.
- 2026-06-19 — Phase 1 completed. Added migration 003, checked-in character
  seed YAML, character normalization/validation, revisioned SQLite repository,
  API and SSE integration, static production export/verification, tracked
  database seed, deployment documentation, and server tests.
- 2026-06-19 — Phase 2 completed. Added character content preload/live refresh,
  global serializable character domains, save version 3, v1/v2 inventory
  migration, Set-compatible global holdings for existing map code, orphan
  retention/hiding, reset and definition-sync behavior, runtime tests, and
  production static-content verification.
- 2026-06-19 — Phase 3 completed. Added shared multi-domain requirement
  normalization/evaluation, structured failure reasons, registered character
  and flag effects, reference/bounds/quantity checks, transactional draft
  application with rollback, legacy requirement normalization, and focused
  unit coverage.
- 2026-06-19 — Phase 4 completed. Added revisioned story requirement/effect
  JSON, shared beat/choice evaluation, disabled unmet choices, atomic
  effect-before-movement handling, global catalog-backed keys and pickups,
  direct character-holdings door/action integration, building/story reference
  validation, SQLite building migration, compatibility-adapter removal,
  contract updates, and end-to-end regression coverage.
- 2026-06-19 — Phase 5 completed. Replaced the placeholder with the authored
  tabbed Character view, profile/portrait fallback, stat and active-quest
  overview, grouped direct inventory and item details, future-domain empty
  states, session tab memory, keyboard tab behavior, focus restoration,
  responsive layout, presentation tests, and production-browser verification.
- 2026-06-19 — Phase 6 completed. Added the development-only Character Builder
  with catalog/profile/panel editors, dirty-state protection, validation,
  revision restore and panel previews; exposed character catalogs to Story and
  Utility Station authoring; added requirement/effect, door-key, pickup and
  interaction selectors; enforced cross-content reference validation and
  reference-aware rename/delete checks; added builder compile/API tests and
  browser verification; confirmed builders remain absent from production.
- 2026-06-19 — Phase 7 completed. Added a serializable authored game clock,
  deterministic minute integration and activity profiles, timed movement,
  story, world, item and simulation outcome boundaries, authored stat drift
  and threshold effects, health/hunger/thirst definitions, consumable food and
  water actions, wellbeing display, save migration and clock round-trip
  coverage. The phase boundary passed 201 tests and a production build.
- 2026-06-19 — Phase 8 completed. Added authored documents, knowledge,
  evidence catalogs and ordered skill awards; idempotent one-time evidence
  events; knowledge/document and ranked skill presentation; Character Builder
  practice-rule editing; character content import/export; and a playable Part
  I chain from hydro reading and holo-reader study through operating days,
  leak repair, and Hydro Operations qualification.
- 2026-06-19 — Phase 9 completed. Added validated quest transitions,
  objective counters and targets, authored automatic completion, status-grouped
  Quest UI with objective progress, Character Builder quest controls, and a
  Restore Station Power quest wired across the existing four-step hydro
  startup chain.
- 2026-06-19 — Phase 10 completed. Replaced flat item totals with physical
  holder state: stack records, unique instances, character/direct holders,
  portable container holders, world-placement holders, and authored vehicle
  cargo. Added capacity, mass, acceptance, no-nesting and cycle guards,
  carried/nearby access scopes, stack splitting/merging, holder movement,
  transfer effects, location-aware Inventory transfer controls, the field
  backpack, the bolt cutter, and eBuggy cargo.
