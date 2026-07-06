# Dual Play Modes Implementation Plan

**Status:** Planned
**Last updated:** 2026-07-05
**Primary contracts:** [Play Modes and Storyline Control](../contracts/play-modes-and-storyline.md), [Story Beats](../contracts/story-beats.md), [Stage Views](../contracts/stage-views.md), [World Authoring](../contracts/world-authoring.md), [Character, Artifacts, and Inventory Management](../contracts/character-inventory.md)
**Related alpha plan:** [Getting to Alpha](getting-to-alpha.md)

## Goal

Replace the current hybrid beat-driven experience with two explicit modes:

- **Storyline mode**, the default guided alpha experience for Zanzibar's
  canonical hydro startup story.
- **Open-world mode**, an explicit freeform exploration mode that keeps broad
  map, room, inventory, artifact, and facility access without requiring the
  canonical story sequence.

The result should satisfy Wave 4 of the alpha plan: a player knows which mode
they are playing, the UI behavior matches that choice, optional exploration no
longer obscures critical hydro startup steps, and open-world remains available
for experimentation.

## Current Problem

Today, story beats try to do too much:

- trigger prose;
- suggest movement;
- replace generic movement labels;
- set flags and time costs;
- imply the next objective;
- compete with broad map and room actions;
- support both canonical story pacing and free exploration.

That hybrid is brittle. Making beats more conditional would rebuild a generic
quest/action system inside the prose layer. Instead, the migration introduces a
first-class storyline controller and narrows beats to narrative presentation.

## Target Architecture

```txt
new game mode selection
  -> gameState.playMode
  -> useStoryline() when playMode === "storyline"
  -> actionPolicy for the active step
  -> play panel, map clicks, indoor/outdoor action handlers
  -> useStory() filters beats by mode and active step
```

In storyline mode:

- the active step provides the current objective;
- the active step allows only the movement, actions, choices, and stage views
  that keep the canonical sequence coherent;
- the same action policy filters buttons and blocks direct map/action bypasses;
- step completion advances the scenario and may force movement, time passage,
  stage views, or effects.

In open-world mode:

- the storyline controller is inactive;
- ordinary world, facility, character, inventory, and movement rules determine
  action visibility;
- mode labeling makes clear that the player is freely experimenting rather than
  following the authored story.

## Phase 1 - Contract and Content Shape

**Purpose:** Make the new model explicit before implementation starts.

- [x] Add [Play Modes and Storyline Control](../contracts/play-modes-and-storyline.md).
- [x] Revise [Story Beats](../contracts/story-beats.md) so beats support mode
      scoping but do not own objectives or action policy.
- [x] Add a scenario content shape to the server-side model layer.
- [x] Decide whether scenario content lives as a story-area child document or
      as a separate coarse document such as `storyline-main`.
- [x] Define the production JSON export path for scenarios.
- [x] Add scenario references to content-reference validation.

**Exit criterion:** The content model can represent the hydro alpha storyline
without overloading beat conditions.

## Phase 2 - Save State and Mode Selection

**Purpose:** Let a new playthrough explicitly choose its promise.

- [x] Add `playMode` and inactive/active `storyline` state to
      `useGameState.js` snapshots.
- [x] Bump the save version and normalize older saves to the alpha default.
- [x] Add a new-game mode selection surface before normal play begins.
- [x] Make Storyline mode the default highlighted choice for alpha.
- [x] Label Open-world mode as freeform/experimental.
- [x] Keep existing save/load, clear save, and reset flows coherent with mode
      state.
- [x] Do not support open-world-to-storyline switching for alpha.

**Exit criterion:** A fresh alpha player chooses a mode, and save/load restores
that mode.

## Phase 3 - Storyline Controller

**Purpose:** Move canonical sequencing out of beats.

- [x] Implement scenario loading through the content API and production JSON.
- [x] Add `useStoryline()` to resolve the active scenario, active step,
      objective, completion state, and next step.
- [x] Implement typed completion predicates for alpha:
      `flag`, `facility`, `location`, `holding`, and `lesson`.
- [x] Implement `onEnter` and `onComplete` effects for:
      flag effects, validated character/inventory effects, stage views, forced
      movement, and time passage.
- [x] Re-evaluate step completion when flags, facilities, inventory, lessons,
      clock, or location change.
- [x] Persist completed step IDs and current step ID.
- [x] Surface authoring errors clearly in development when the active step is
      missing or invalid.

**Exit criterion:** A scenario can advance through hydro startup steps without
using beat selection as the sequencer.

## Phase 4 - Action Policy

**Purpose:** Ensure storyline gates apply everywhere, not only in the play
panel.

- [x] Define a normalized action identity scheme for movement, story choices,
      stage views, pickups, item actions, room actions, doors, switches,
      passages, searches, and map transitions.
- [x] Have `useStoryline()` produce an action policy for the current step.
- [x] Filter play-panel actions through the policy in storyline mode.
- [x] Block direct map clicks and direct movement handlers through the same
      policy.
- [x] Block indoor and outdoor interaction handlers through the same policy.
- [ ] Keep shell actions such as save/load, return-to-map, and development-only
      diagnostics available according to contract rules.
- [ ] Verify that storyline policy cannot bypass ordinary movement, door,
      holder, inventory, or facility rules.

**Exit criterion:** If a storyline step hides an action, the player cannot
activate that action through another UI route.

## Phase 5 - Beat Mode Scoping

**Purpose:** Preserve prose while removing hybrid sequencing pressure.

- [ ] Add `modes` and `storylineStep` to beat import/export and Story Builder
      editing.
- [x] Add `modes` and `storylineStep` to beat normalization, validation, and
      runtime projection.
- [x] Update `useStory()` to filter beats by `gameState.playMode` and the
      active storyline step.
- [ ] Let a storyline step select or prefer a beat by ID.
- [ ] Keep open-world ambient beats separate from canonical storyline beats.
- [ ] Update existing hydro startup beats to either storyline-scoped step beats
      or open-world ambient/discovery beats.
- [ ] Remove content patterns where a beat choice is the only thing preventing
      a story-breaking action.

**Exit criterion:** Storyline prose and open-world prose can coexist without
competing for the same trigger as hidden state machines.

## Phase 6 - Objective and Mode UI

**Purpose:** Make the mode visible and actionable to the player.

- [x] Show the current mode in the game UI.
- [x] Show the current storyline objective prominently in storyline mode.
- [x] Do not show a canonical objective in open-world mode.
- [ ] Ensure focused stage views such as the instruction card, holo-reader, and
      console do not hide the objective in a confusing way.
- [ ] Keep the narrative card for prose; use objective UI for "what matters
      right now."

**Exit criterion:** A new player can tell whether they are following Zanzibar's
story or freely experimenting, and can identify the next storyline task.

## Phase 7 - Builder Support

**Purpose:** Make scenario authoring maintainable.

- [ ] Add a Scenario panel to `/builder/story`.
- [ ] Support scenario metadata, ordered steps, objective text, associated beat,
      allowed actions, completion predicates, forced effects, and next step.
- [ ] Provide selectors for hexes, rooms, exterior nodes, transitions, stage
      views, items, item actions, lessons, documents, and facility predicates.
- [ ] Add a step preview that shows the visible action set for the selected
      step.
- [ ] Add reference-aware rename and delete handling for storyline references
      in Story Builder, World Builder, and Content Builder.
- [ ] Show "referenced by storyline step" in relevant object detail panels.

**Exit criterion:** Authors can edit the hydro alpha scenario without manually
copying IDs or creating fragile hidden beat dependencies.

## Phase 8 - Hydro Alpha Migration

**Purpose:** Encode the canonical alpha path as a scenario.

- [ ] Create `part-i-hydro-alpha`.
- [ ] Add steps for:
      intro, read startup card, inspect intake, clear/open intake, align
      upstream/diversion valve, open turbine valve, return to control room,
      connect station power, check console, and complete startup.
- [ ] Gate optional exploration in storyline mode where it obscures the current
      step.
- [ ] Keep open-world mode broad enough to complete hydro startup out of story
      order when facility rules allow it.
- [ ] Move hydro startup beat prose into storyline-scoped step beats or
      open-world ambient beats.
- [ ] Verify the laminated card, beginner lesson, simplified console, inventory,
      and facility state still work in both modes.

**Exit criterion:** The hydro alpha startup sequence plays as a guided
canonical story in Storyline mode and as a freeform experiment in Open-world
mode.

## Phase 9 - Tests and Verification

**Purpose:** Lock down the split before building more content on it.

- [x] Unit test mode normalization, save/load, and reset behavior.
- [x] Unit test storyline step selection, completion predicates, forced effects,
      and missing-content diagnostics.
- [x] Unit test beat filtering by `modes` and `storylineStep`.
- [x] Unit test action-policy filtering for play-panel actions.
- [ ] Integration test map clicks and indoor/outdoor handlers so policy cannot
      be bypassed.
- [ ] Smoke test guided hydro startup with storyline gates active.
- [ ] Smoke test open-world startup with broad actions and valid out-of-order
      completion.
- [ ] Run `npm run test` from the repo root before finishing implementation
      work.

**Exit criterion:** Both modes are covered by tests at the state, action, beat,
and hydro journey levels.

## Deferred

These are deliberately not alpha requirements:

- switching an arbitrary open-world save back into storyline;
- multiple simultaneous storylines;
- branching scenario graphs beyond simple `next` links;
- general boolean scripting for step conditions;
- AI-assisted station operation;
- full electrical-system modeling;
- account-wide progression or cross-device saves.
