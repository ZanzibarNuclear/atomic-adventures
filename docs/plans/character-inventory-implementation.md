# Character, Inventory, and Shared Game Views — Implementation Plan

**Status:** Planned  
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

- [ ] Extend story model/runtime schema with character requirements and
  ordered effects.
- [ ] Keep `sets` and `set_flags` as migration aliases.
- [ ] Evaluate beat and choice requirements through the shared evaluator.
- [ ] Apply choice effects before movement; abort movement if effects fail.
- [ ] Move utility-station item definitions from the building document into
  `character-main`.
- [ ] Retain building pickups as placement records referencing catalog IDs.
- [ ] Change doors, pickups, and indoor actions to use the character service.
- [ ] Remove the compatibility adapter only after all inventory consumers are
  migrated.
- [ ] Update story/building validators and reference checks.
- [ ] Add tests for item-gated beats, choices, doors, pickup idempotence,
  effect-before-movement, and failed effects.
- [ ] Update `story-beats.md` and `world-authoring.md` when behavior lands.

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

- [ ] Replace the placeholder with the real Character view.
- [ ] Add Map/Character navigation in the app shell.
- [ ] Add tabs configured by authored panel content.
- [ ] Implement Overview with portrait, profile, authored stats, and active
  quest summary.
- [ ] Implement Inventory for directly held items and quantities.
- [ ] Add item details, descriptions, icons, linked documents, and empty states.
- [ ] Remove the old inline `InventoryPanel` from `IndoorScene` once equivalent
  access exists.
- [ ] Preserve the selected Character tab for the browser session.
- [ ] Implement keyboard navigation, focus restoration, textual meter values,
  narrow-screen layout, and non-color status cues.
- [ ] Add UI tests for toggling, tabs, empty/populated states, and accessibility
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

- [ ] Add development route `/builder/character`.
- [ ] Add Character to `BuilderShell`.
- [ ] Implement explicit Save, Revert, dirty-state protection, validation,
  revision history, and restore.
- [ ] Add editors for profile/panel, items, stats, knowledge, skills, quests,
  and documents.
- [ ] Add catalog ID selectors to Story Builder requirements/effects.
- [ ] Add item selectors to relevant World Builder placements, doors, and
  interactions.
- [ ] Add reference search and reference-aware rename previews.
- [ ] Reject deletion while referenced.
- [ ] Add panel previews for empty, early-game, and populated states.
- [ ] Verify the builder route/chunks remain absent from production.

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

- [ ] Define the game-clock contract before implementation: current game time,
  calendar/day representation, and one `advanceTime` boundary.
- [ ] Implement registered activity profiles:
  `resting`, `light`, `moderate`, `strenuous`.
- [ ] Ensure movement, story actions, rest, item actions, and simulations can
  report elapsed game minutes and activity.
- [ ] Implement stat drift integration, bounds, threshold crossing, and
  threshold effects.
- [ ] Guarantee large and small equivalent time advances produce the same
  result.
- [ ] Add authored `health`, `hunger`, and `thirst` definitions.
- [ ] Add authored food/water items with calories/hydration metadata and
  explicit Eat/Drink actions.
- [ ] Add wellbeing meters and warnings to Overview; optionally add a compact
  header summary after usability testing.
- [ ] Add beat/action requirements based on needs where narrative requires.
- [ ] Test time advancement, activity rates, sleep-sized jumps, consumption,
  health thresholds, save/load, and no wall-clock progression while closed.
- [ ] Update the roadmap's time/calendar section with the implemented clock
  contract.

**Exit criterion:** Hunger and thirst change predictably with authored game
time/activity, and authored meals/water affect them through ordinary effects.

---

## Phase 8 — Documents, Knowledge, Practice, Skills, and Badges

**Purpose:** Represent the learning arc from exposure to competence.

- [ ] Implement Documents and Knowledge tabs.
- [ ] Implement lesson/document actions that explicitly grant knowledge.
- [ ] Gate a real story beat or activity on a knowledge ID.
- [ ] Implement skill evidence counters and authored rank-award rules.
- [ ] Evaluate awards after committed effects, in deterministic rank order.
- [ ] Add one-time/repeatable evidence controls to simulation outcomes.
- [ ] Implement Skills display with rank, progress, qualification, badge art,
  and earned text.
- [ ] Wire Part I examples:
  - holo-reader hydro lesson → hydro knowledge;
  - successful operating day → operating-days evidence;
  - leak repair → leak-repairs evidence;
  - evidence thresholds → Hydro Operations ranks/qualification.
- [ ] Test document versus knowledge separation, gated actions, repeat
  protection, award ordering, and save/load.

**Exit criterion:** The full chain works:
`lesson/document → knowledge → successful practice → evidence → skill/badge`.

---

## Phase 9 — Quests and Objectives

**Purpose:** Give the player a readable account of multi-step goals.

- [ ] Implement quest/objective state transitions and counters.
- [ ] Add Quests tab sections for available, active, completed, and failed.
- [ ] Support authored visibility and optional auto-completion.
- [ ] Wire a Part I quest such as Restore Station Power.
- [ ] Ensure quests summarize story/simulation progress without replacing beat
  selection.
- [ ] Test invalid transitions, objective counters, auto-completion, repeat
  effects, save/load, and live definition updates.

**Exit criterion:** A multi-system Part I goal is author-defined, updated by
ordinary effects, and understandable from the Character view.

---

## Phase 10 — Holders, Backpack, World Storage, and eBuggy Cargo

**Purpose:** Complete physical item custody and transport.

- [ ] Implement unique instances, stacks, holder IDs, and ownership
  invariants.
- [ ] Implement character, portable-container, vehicle, fixed-container, and
  world-placement holders.
- [ ] Implement capacity by slots and optional mass.
- [ ] Disallow nested containers by default.
- [ ] Implement `carried` and `nearby` access scopes.
- [ ] Implement atomic item transfer, split/merge stacks, drop, and pickup.
- [ ] Persist runtime placements, fixed-container contents, vehicle contents,
  and container contents.
- [ ] Add the field backpack as a portable container.
- [ ] Add eBuggy cargo as a holder whose location follows the vehicle.
- [ ] Show accessible holder trees in Inventory and permit drag/drop or
  explicit transfer controls.
- [ ] Ensure tools in distant eBuggy cargo or a backpack left elsewhere fail
  physical requirements.
- [ ] Test capacity, stack behavior, transfer rollback, holder cycles,
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
