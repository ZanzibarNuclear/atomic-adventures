# Code Quality and Builder Refactoring - Implementation Plan

**Status:** In progress
**Last updated:** 2026-06-25
**Primary areas:** `game/src/views`, `game/src/lib/maps/composables`, `game/server`

This file is the durable handoff for breaking down oversized builder views,
untangling movement/domain modules, and reducing duplicated authoring
infrastructure. Future work should update the checkboxes and notes here rather
than relying on conversation history.

## Current Progress

The first implementation pass landed shared builder shell pieces, several
component extractions, and the first travel-barrier module splits. The plan is
not complete; unchecked items below are intentional follow-up work, especially
the large document-lifecycle, inspector, runtime-facade, and server-repository
extractions.

Completed in the first pass:

- shared unsaved-change dialog, revision-history panel, and dirty-navigation
  composable;
- shared dirty-navigation wiring in Story Builder, World Builder, and Utility
  Station Builder;
- outdoor and utility-station object-browser components;
- story location picker, beat list, choice editor, and tested story-choice helper
  module;
- tested outdoor landmark/stand draft helper module;
- tested world-builder camera composable;
- tested segment-geometry, hex-polygon, and barrier-context modules;
- compatibility re-exports from `useTravelBarriers.js` so existing callers keep
  working.

Deferred from the first pass:

- Phase 0 audit/checklist work was mostly superseded by direct refactoring and
  targeted test additions.
- `BuilderStatusBanner.vue` remains optional; status/dirty markup duplication is
  smaller but still present.
- The large route-level document lifecycle, selection, most canvas panels, and inspector
  extractions remain open.
- The deeper `useTravelBarriers.js`, `useOutdoorWorld.js`, and server repository
  splits remain open.

## Goal

Improve maintainability in the active `game/` app by:

- splitting large Vue views into focused components and composables;
- sharing repeated builder workflows across story, world, and utility-station
  authoring;
- separating low-level map algorithms from higher-level movement decisions;
- keeping existing public facades stable while internals are reorganized;
- making future builder and map changes easier to verify with useful automated
  tests.

## Locked Decisions

- Implement refactors in `game/`; do not move gameplay or authoring work into
  `web/`.
- Preserve the existing routes:
  - `/builder/story`
  - `/builder/world`
  - `/builder/content`
- Keep SQLite as the canonical authored content store.
- Keep YAML as import/export and preview only; do not add canonical content YAML
  under `game/content/`.
- Prefer mechanical extraction first. Avoid behavior changes unless a test or
  focused review exposes a real defect.
- Keep builder form state separate from player save state.
- Optimize on effective refactoring. Change whatever will improve the code. There
  are no active gameplay sessions to preserve or worry about.
- Treat automated test cleanup as part of the refactor. Keep tests that prove
  useful behavior, remove or rewrite brittle tests that only mirror
  implementation details, and add focused coverage around extracted modules.

## Current Baseline

- `OutdoorWorldBuilderView.vue` is about 1,700 lines and owns document loading,
  saving, dirty navigation, selection, object CRUD, map camera controls,
  landmark/stand draft conversion, movement audit, revision history, YAML
  preview, and a large inspector template.
- `UtilityStationBuilderView.vue` is about 1,300 lines and owns the same broad
  builder concerns for indoor geometry, plus pickups, actions, door preview,
  local rename cascade, and indoor audit.
- `BuilderView.vue` is smaller but still combines location picking, beat list
  management, beat editing, choice editing, revision history, YAML preview, and
  dirty navigation.
- `useTravelBarriers.js` is about 1,200 lines and mixes geometry primitives,
  barrier context, local path search, entry resolution, arrival stand heuristics,
  and the public move-resolution API.
- `useOutdoorWorld.js` is a facade plus map model, passage handling, search,
  movement preview/commit, and game-time advancement.
- Server repositories combine persistence, validation, revisions, reference
  discovery, rename cascade, and cross-domain orchestration.

## Delivery Strategy

Work in small, reversible slices. Start with pure extraction where possible,
then consolidate shared patterns, then split domain modules. Restart the local
server as needed after major view/composable moves. Run the relevant unit tests
when domain behavior or reusable logic is touched, and use each extraction as a
chance to make the tests more meaningful.

Test automation cleanup goals:

- Favor tests that describe observable behavior or stable data contracts.
- Move helper-heavy setup into shared fixtures where it improves readability.
- Delete duplicate tests when a lower-level extracted module now covers the same
  behavior more directly.
- Add tests for new plain modules and composables when they contain branching or
  domain rules.
- Keep browser-level or component-level tests focused on route wiring and
  integration behavior, not every internal helper.

---

## Phase 0 - Refactoring Guardrails

**Purpose:** Prepare the codebase for direct refactoring work.

**Status:** Skipped/superseded. We chose direct refactoring plus focused tests
instead of a separate up-front audit phase.

- [x] Skipped: record current line-count hotspots so progress can be measured without
      treating line count as the only goal.
- [x] Skipped: identify existing tests that cover movement, barriers, world content,
      building content, story builder behavior, and play-panel actions.
- [x] Skipped: identify low-signal tests that mostly restate implementation details and
      mark them for rewrite or deletion during the relevant phase.
- [x] Superseded: add missing low-risk tests where extraction would otherwise be hard to
      verify, especially for plain helper modules.

Likely files:

- `docs/plans/code-quality-refactoring-implementation.md`
- Existing `*.test.js` files under `game/src` and `game/server`

**Exit criterion:** Refactoring work has known automated test targets and a
clear list of test cleanup opportunities before code movement begins.

---

## Phase 1 - Shared Builder Shell Pieces

**Purpose:** Remove duplicated builder chrome and navigation workflows before
splitting the largest views.

**Status:** Mostly complete. The remaining status-banner item is optional and
can be done later if duplication is still annoying.

- [x] Create `UnsavedChangesDialog.vue` for save/discard/keep-editing prompts.
- [x] Create `RevisionHistoryPanel.vue` for revision list and restore actions.
- [ ] Create a small `BuilderStatusBanner.vue` or similar for status and dirty
      messages if the views continue to duplicate that markup.
- [x] Add `useDirtyDocumentNavigation()` for:
  - before-unload warnings;
  - route-leave interception;
  - pending navigation/action storage;
  - save-and-continue/discard-and-continue/keep-editing flows.
- [x] Replace duplicated unsaved-dialog logic in story, outdoor world, and
      utility-station builders.
- [x] Keep labels and button text route-specific through props or slots.

Likely files:

- `game/src/components/builder/UnsavedChangesDialog.vue` (new)
- `game/src/components/builder/RevisionHistoryPanel.vue` (new)
- `game/src/components/builder/BuilderStatusBanner.vue` (optional/new)
- `game/src/composables/useDirtyDocumentNavigation.js` (new)
- `game/src/views/BuilderView.vue`
- `game/src/views/OutdoorWorldBuilderView.vue`
- `game/src/views/UtilityStationBuilderView.vue`

Automation cleanup:

- Add or update composable tests for `useDirtyDocumentNavigation()`.
- Keep route-level tests focused on whether each builder wires the shared prompt
  correctly.
- Remove duplicated prompt-flow assertions once shared composable coverage is in
  place.

**Exit criterion:** All builder routes use shared dirty-navigation UI/logic with
centralized tests for the common behavior.

---

## Phase 2 - Outdoor World Builder Decomposition

**Purpose:** Split `OutdoorWorldBuilderView.vue` into focused pieces while
preserving the current authoring workflow.

**Status:** Partially complete. Pure draft helpers, camera logic, and the object
browser were extracted; document lifecycle, selection, canvas panel, and
inspector extraction remain.

- [ ] Extract document lifecycle to `useOutdoorWorldBuilderDocument()`:
  - load;
  - apply loaded result;
  - save;
  - revert;
  - history/restore;
  - baseline/dirty/errors/status/yaml preview.
- [ ] Extract selection and object operations to `useOutdoorBuilderSelection()`:
  - selected key/type/item;
  - select/select feature;
  - add/duplicate/delete/move/rename;
  - local rename cascade.
- [x] Extract map camera and pan/zoom behavior to `useWorldBuilderCamera()`.
- [x] Extract landmark and stand draft helpers to a plain module:
  - draft-from-model;
  - model-from-draft;
  - validation helpers;
  - point application.
- [x] Extract `OutdoorObjectBrowser.vue`.
- [ ] Extract `OutdoorCanvasPanel.vue`.
- [ ] Extract `OutdoorInspector.vue`.
- [ ] Split the inspector into smaller editors once the first extraction lands:
  - `HexInspector.vue`;
  - `RouteInspector.vue`;
  - `FeatureInspector.vue`;
  - `PassageInspector.vue`;
  - `LandmarkInspector.vue`;
  - `StandInspector.vue`.
- [ ] Keep `OutdoorWorldBuilderView.vue` as the route-level coordinator.

Likely files:

- `game/src/views/OutdoorWorldBuilderView.vue`
- `game/src/composables/useOutdoorWorldBuilderDocument.js` (new)
- `game/src/composables/useOutdoorBuilderSelection.js` (new)
- `game/src/composables/useWorldBuilderCamera.js` (new)
- `game/src/lib/maps/builder/outdoorDrafts.js` (new)
- `game/src/components/builder/outdoor/*.vue` (new)

Automation cleanup:

- [x] Add focused tests for landmark/stand draft conversion helpers.
- Keep selection/object-operation tests at the composable level where possible.
- Avoid large component tests for every inspector field; reserve component tests
  for wiring that cannot be covered by plain modules.

**Exit criterion:** The route-level outdoor builder is mostly orchestration, and
outdoor object browser, canvas, and inspector concerns are separately owned.

---

## Phase 3 - Utility Station Builder Decomposition

**Purpose:** Apply the same route/component boundaries to indoor world authoring.

**Status:** Started. The object browser was extracted; document lifecycle,
selection, canvas, inspector, item placement, and action authoring remain.

- [ ] Extract document lifecycle to `useBuildingBuilderDocument()`:
  - load;
  - save;
  - revert;
  - history/restore;
  - baseline/dirty/errors/status/warnings.
- [ ] Extract selection and object operations to `useGridBuilderSelection()`:
  - selection parsing;
  - collection lookup;
  - add/duplicate/delete/move/rename;
  - stand selection;
  - local rename cascade.
- [ ] Keep reusable geometry operations in `useGridBuilder.js`, but move
      route-view-only behavior out of `UtilityStationBuilderView.vue`.
- [x] Extract `StationObjectBrowser.vue`.
- [ ] Extract `StationCanvasPanel.vue`.
- [ ] Extract `StationInspector.vue`.
- [ ] Split the inspector into smaller editors:
  - `RoomInspector.vue`;
  - `DoorInspector.vue`;
  - `PathInspector.vue`;
  - `ExteriorNodeInspector.vue`;
  - `TransitionInspector.vue`;
  - `FixtureInspector.vue`;
  - `LinkInspector.vue`;
  - `RoomStandInspector.vue`.
- [ ] Extract item placement and action authoring sections into dedicated
      components if they still dominate the station inspector.

Likely files:

- `game/src/views/UtilityStationBuilderView.vue`
- `game/src/composables/useBuildingBuilderDocument.js` (new)
- `game/src/composables/useGridBuilderSelection.js` (new)
- `game/src/components/builder/station/*.vue` (new)
- `game/src/lib/maps/composables/useGridBuilder.js`

Automation cleanup:

- Add focused tests around selection parsing, collection lookup, and rename
  cascade.
- Review existing grid-builder tests for duplication after selection logic moves
  out of the view.
- Keep geometry behavior tests close to `useGridBuilder.js` and route wiring
  tests close to the view/components.

**Exit criterion:** The utility-station route is an orchestration component, and
indoor browser, canvas, inspector, inventory/action authoring, and document
lifecycle concerns are separately owned.

---

## Phase 4 - Story Builder Decomposition

**Purpose:** Make story authoring easier to extend before beat complexity grows.

**Status:** Partially complete. Choice editing and choice helper logic were
extracted along with the location picker and beat list; beat lifecycle and
top-level beat editor remain.

- [x] Extract location/map selection to `StoryLocationPicker.vue`.
- [x] Extract beat list and match warnings to `StoryBeatList.vue`.
- [ ] Extract beat document lifecycle to `useStoryBeatDocument()`:
  - load list;
  - load selected beat;
  - create/copy;
  - save;
  - delete;
  - revisions/restore;
  - draft/baseline/dirty/errors/status.
- [ ] Extract `StoryBeatEditor.vue` for top-level beat fields.
- [x] Extract `StoryChoiceEditor.vue` for one choice.
- [x] Extract choice destination helpers to a plain module if they remain in the
      route after component extraction.

Likely files:

- `game/src/views/BuilderView.vue`
- `game/src/components/builder/story/*.vue` (new)
- `game/src/composables/useStoryBeatDocument.js` (new)
- `game/src/lib/storyChoiceDrafts.js` (optional/new)

Automation cleanup:

- [x] Add focused tests for choice destination helpers.
- Review builder-view tests and keep only integration assertions that remain
  valuable after extraction.
- Move repeated beat fixture creation into a shared helper if it reduces noise.

**Exit criterion:** Story builder has separate location, list, editor, and choice
components with route-level state kept small.

---

## Phase 5 - Travel Barrier Module Split

**Purpose:** Separate movement algorithms by layer so future barrier changes are
easier to test and reason about.

**Status:** Partially complete. Geometry primitives, hex polygon helpers, and
barrier segment/list helpers were extracted; first-hit detection, pathfinding,
arrival stands, and move resolution remain.

- [x] Move geometry primitives from `useTravelBarriers.js` into a plain geometry
      module.
- [x] Move barrier segment extraction and barrier lists into a barrier-context
      module.
- [ ] Move junction cache and first-hit detection into a barrier-context module.
- [x] Move hex polygon helpers and tests to a travel module.
- [ ] Move local pathfinding to a `pathInHex` module.
- [ ] Move destination stand selection and arrival heuristics to an arrival
      module.
- [x] Keep a public compatibility module at `useTravelBarriers.js` that
      re-exports the stable API during the transition.
- [x] Add focused tests for each extracted plain module where existing tests do
      not already cover the behavior directly.
- [x] Run the movement/barrier/audit tests after each extraction step.

Likely files:

- `game/src/lib/maps/composables/useTravelBarriers.js`
- `game/src/lib/maps/geometry/segments.js` (new)
- `game/src/lib/maps/travel/barrierContext.js` (new)
- `game/src/lib/maps/travel/pathInHex.js` (new)
- `game/src/lib/maps/travel/arrivalStand.js` (new)
- existing tests under `game/src/lib/maps/testing/`

Automated checks:

- `npm run test -- -t barrier`
- `npm run test -- -t movement`
- `npm run test -- -t audit`
- Fall back to `npm run test` if targeted names miss related coverage.

**Exit criterion:** Public movement behavior is unchanged, but geometry,
barrier detection, pathfinding, arrival stands, and move resolution are
separated into smaller modules.

---

## Phase 6 - Outdoor Runtime Facade Split

**Purpose:** Keep `useOutdoorWorld()` as a stable facade while reducing the
number of responsibilities inside the file.

**Status:** Not started.

- [ ] Extract map data/model concerns to `useOutdoorWorldModel()`.
- [ ] Extract passage/opening state to `useOutdoorPassages()`.
- [ ] Extract barrier search/discovery behavior to `useOutdoorBarrierSearch()`.
- [ ] Extract movement preview and commit behavior to `useOutdoorMovement()`.
- [ ] Keep `useOutdoorWorld()` returning the existing API while composing the
      smaller modules.
- [ ] Move game-time advancement behind a small callback or option so movement
      logic is not directly responsible for character clock concerns.

Likely files:

- `game/src/lib/maps/composables/useOutdoorWorld.js`
- `game/src/lib/maps/composables/useOutdoorWorldModel.js` (new)
- `game/src/lib/maps/composables/useOutdoorPassages.js` (new)
- `game/src/lib/maps/composables/useOutdoorBarrierSearch.js` (new)
- `game/src/lib/maps/composables/useOutdoorMovement.js` (new)

Automated checks:

- `npm run test -- -t outdoor`
- `npm run test -- -t passage`
- `npm run test -- -t movement`
- Fall back to `npm run test` if targeted names miss related coverage.

**Exit criterion:** `useOutdoorWorld()` remains caller-compatible, but map model,
passages, search, and movement are independently testable modules.

---

## Phase 7 - Server Repository Boundary Cleanup

**Purpose:** Reduce duplicated repository mechanics and isolate cross-domain
reference orchestration.

**Status:** Not started.

- [ ] Extract shared revision behavior to a helper or `RevisionStore`:
  - list revisions;
  - record snapshots;
  - increment/read global revision.
- [ ] Extract shared JSON world-document persistence if it can serve both world
      and building documents without obscuring simple SQL.
- [ ] Extract cross-domain reference preview/cascade/validation to a
      `ContentReferenceService` or small focused modules.
- [ ] Keep repository public APIs stable until all routes and CLIs are updated.
- [ ] Add tests around rename preview/cascade before moving cross-domain logic.

Likely files:

- `game/server/story-repository.js`
- `game/server/world-repository.js`
- `game/server/building-repository.js`
- `game/server/character-repository.js`
- `game/server/revision-store.js` (new)
- `game/server/content-reference-service.js` (optional/new)

Automated checks:

- `npm run test -- -t repository`
- `npm run test -- -t api`
- `npm run test -- -t rename`
- Fall back to `npm run test` if targeted names miss related coverage.

**Exit criterion:** Repositories still expose the same behavior, but revision
storage and cross-domain reference handling have clear ownership.

---

## Suggested Order of Work

1. Phase 1: shared dirty navigation and revision UI.
2. Phase 2: outdoor builder extraction.
3. Phase 3: utility-station builder extraction.
4. Phase 4: story builder extraction.
5. Phase 5: travel barrier split.
6. Phase 6: outdoor runtime facade split.
7. Phase 7: server repository cleanup.

The builder phases can be split among separate branches if needed. The movement
and server phases should be kept in smaller, sequential commits because they
touch behavior-rich modules with more hidden coupling.

## Done Definition

- Large route components are reduced to route orchestration plus wiring.
- Shared builder UI and dirty-navigation behavior are implemented once.
- Movement/barrier internals are organized by algorithm layer.
- `useOutdoorWorld()` remains stable for callers while smaller modules own its
  internals.
- Repository behavior remains stable while revision and reference concerns have
  clearer homes.
- Automated tests are clearer, less duplicative, and focused on observable
  behavior or stable contracts.
- Relevant unit tests pass after domain, builder, or server refactors.
