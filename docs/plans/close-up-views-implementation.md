# Close-Up Views Implementation Plan

**Status:** Partially implemented
**Last updated:** 2026-07-07
**Primary contracts:** [Stage Views](../contracts/stage-views.md), [Character, Artifacts, and Inventory Management](../contracts/character-inventory.md), [Story Beats](../contracts/story-beats.md)
**Quality checklist:** [Character, Inventory, and Game-View Regression Checklist](../quality/character-inventory-regression-checklist.md)

## Goal

Implement close-up views as first-class game views in the `game/` app. A
close-up temporarily replaces the map in the primary play area without changing
the player's logical location, save state, or narrative context.

Close-up views include:

- in-room or fixture views, such as inspecting the eBuggy, holo-reader, tool
  rack, control console, or room detail;
- holo-reader lessons and videos;
- buggy rides and other authored travel presentations;
- documents, consoles, and simulations.

Simulations are one category of close-up view. They use the same navigation,
context restoration, registration, and state-mutation boundaries as other
close-ups. Put another way, the control console is a UI for a simulation.
The buggy could be backed by a simulation of the vehicle in a 3D model of
the game world. The holo-reader may have embedded simulations that pertain
to specific subject matter.

## Decisions

- Implement close-up navigation and story state in `game/`.
- The app shell owns the active game view and the shared Return to Map action.
- Opening a close-up does not create a movement event.
- Returning to the map restores the same outdoor hex, indoor room or stand,
  camera context, story/narrative context, and available actions.
- Close-ups may be authored by ID, but the runtime must use registered view
  descriptors and components rather than arbitrary component names or markup.
- External or iframe content must not mutate player state directly.
- Character, inventory, quest, knowledge, and skill mutations flow through the
  existing validated effects boundary.

## Phase 1 - Shared Close-Up Registry

**Purpose:** Give close-up surfaces one navigation model and one registration
boundary.

- [~] Define a game-view descriptor shape for `map`, `character`, `closeup`,
      `lesson`, `video`, `document`, `console`, `ride`, and `simulation` views.
- [ ] Add a component registry for known close-up view IDs.
- [~] Validate unknown or stale view IDs before opening.
- [x] Preserve the current map and story context when switching away from the
      map.
- [x] Restore context through a shared Return to Map action.
- [~] Add tests for unknown IDs, stale authored references, context restore, and
      save/load while a close-up is open or recently closed.

**Exit criterion:** The game can open and close a registered placeholder
close-up without moving the player or losing map/story context.

## Phase 2 - In-Room and Fixture Close-Ups

**Purpose:** Make Part I inspectable room detail available without overloading
the top-down map.

- [ ] Open an eBuggy close-up from the garage without changing logical location.
- [~] Add fixture-triggered close-up entry points for at least one utility
      station object.
- [ ] Support authored available actions inside a close-up.
- [ ] Keep Character view access consistent unless a modal view explicitly
      blocks leaving.
- [ ] Test blocked exits, repeated open/return cycles, keyboard navigation, and
      save behavior around fixture views.

**Exit criterion:** One in-room fixture close-up ships as a working vertical
slice.

## Phase 3 - Holo-Reader Lessons and Videos

**Purpose:** Treat learning content as close-up views that can award authored
character progress.

- [~] Open a holo-reader lesson or video in the primary stage.
- [x] Grant knowledge, document-read state, evidence, quest progress, or other
      authored effects only on explicit completion.
- [x] Make lesson completion idempotent where the authored effect is one-time.
- [x] Restore the exact map and narrative context on Return to Map.
- [~] Test completion, replay, partial viewing, stale content, and save during or
      after the lesson.

**Exit criterion:** One holo-reader lesson uses the close-up shell and existing
character/effects services.

## Phase 4 - Buggy Rides and Presented Travel

**Purpose:** Allow authored ride presentations without confusing them with map
movement.

- [ ] Define when a ride is presentation-only versus when it commits a movement
      destination.
- [ ] Support a buggy ride close-up that can show authored steps or media.
- [ ] Commit any travel, time, inventory, quest, or story effects through the
      same validated effect boundary as other actions.
- [ ] Test cancel/return behavior, successful completion, blocked destinations,
      and save/load around ride views.

**Exit criterion:** One buggy ride presentation can open, complete, and return
to the map with coherent state.

## Phase 5 - Simulation Close-Ups

**Purpose:** Integrate simulations as close-up views without giving simulation
internals direct ownership of player state.

- [ ] Open a registered simulation view with a declared read-only character,
      inventory, story, and world snapshot.
- [ ] Validate simulation outcomes against the registered outcome contract.
- [ ] Atomically commit approved simulation outcomes through the effects
      service.
- [ ] Prevent external or iframe simulation content from mutating player state
      directly.
- [ ] Test blocked exits, outcome replay, stale content, invalid outcomes,
      partial commits, and save during or after simulations.

**Exit criterion:** One simulation uses the shared close-up navigation and
validated outcome boundary.

## Implementation Audit - 2026-07-07

Legend: `[x]` implemented, `[~]` partially implemented, `[ ]` not yet implemented.

### Implemented

- `game/src/composables/useGameView.js` now owns active stage-view state with
  `kind`, `payload`, and optional blocking behavior. It supports `map`,
  `inventory`, `character-stats`, `character`, `closeup`, `lesson`, `document`,
  `console`, and `simulation`. `video` and `ride` are still missing from the
  runtime kind list.
- `GameView.vue` switches the primary play area between the map, focused
  inventory, character stats, full character view, holo-reader lesson,
  hydro-console, and instruction-card document views without changing logical
  outdoor/indoor location.
- Story choices can open stage views through `choice.view`. The server model
  validates supported view kinds and rejects choices that combine movement with
  a stage view. The story builder currently exposes Inventory, Character stats,
  and Holo-reader lesson choices.
- Holo-reader lessons are implemented as a primary-stage view. Completion flows
  through `completeLesson`, commits authored effects only after explicit
  completion, and stale selected lesson IDs render an unavailable-state message.
- The hydro control-room console is implemented as a `console` stage view with
  payload validation for `hydro-control-room-panel`. Its live telemetry samples
  runtime hydro state without mutating hydro facility state.
- Instruction cards/documents can open as a `document` stage view from item
  actions.
- Focused inventory and character-stats stage views exist, with reusable
  inventory/character surfaces and Return to Map controls.
- Tests cover the view-state composable, HoloReaderView stale lesson handling
  and completion events, HydroConsoleView payload validation and read-only
  telemetry sampling, story choice stage-view execution, story repository
  round-tripping, and item actions returning document stage views.

### Partially Implemented

- View-kind validation exists, but there is no close-up component registry or
  descriptor registry for concrete view IDs. `GameView.vue` still maps each
  implemented kind directly to a component.
- Stale ID handling is per component for lessons and the hydro console, not a
  shared registry-level validation boundary.
- Context restore works because view state is separate from map/player state,
  but active stage-view state is not saved. Saving while a close-up is open
  resumes at the map after load, which may be acceptable, but it is not yet
  explicitly specified or tested against this plan.
- Utility-station fixture actions exist as map/room actions, and the
  holo-reader and hydro console can open focused views from authored/runtime
  actions. A generic fixture close-up vertical slice, such as eBuggy inspection
  or a service-bench detail view, is not implemented.
- Storyline action policies can allow or block stage views, but the available
  builder UI only authors a small subset of supported stage-view kinds.

### Not Yet Implemented

- No `video` or `ride` runtime stage-view kind.
- No generic `closeup` component, eBuggy close-up, room-detail close-up, or
  authored close-up action set.
- No component registry for known close-up IDs, no stale authored-reference
  tests at the registry boundary, and no common descriptor shape beyond
  `kind`/`payload`/`blocking`.
- No buggy ride or presented-travel close-up flow.
- No simulation close-up boundary that passes declared read-only snapshots,
  validates simulation outcome contracts, and atomically commits approved
  outcomes through the effects service. The hydro simulation runtime exists,
  but the shipped hydro console is a monitor/control-room view rather than the
  Phase 5 simulation close-up boundary.
- No external/iframe mutation sandbox for mini-game simulations.
- No save/load tests that explicitly cover being inside or recently returning
  from a close-up view.

## Implementation Notes

- Keep close-up form or view state separate from player save state unless a
  validated effect explicitly commits progress.
- Do not add one-off navigation for individual close-ups, lessons, rides, or
  simulations.
- Prefer a small built-in close-up vertical slice before integrating embedded
  mini-games.
- Keep production builds free of builder-only close-up authoring chunks.
